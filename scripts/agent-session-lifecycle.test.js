'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const workbench = fs.readFileSync(process.argv[2] || path.join(__dirname, '../src/ai/agent-workbench.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
let sequence = 0;

// Run the complete workbench, substituting only the host and kernel API boundaries.
function install(saved = null, sessions = new Map()) {
    let store = saved && plain(saved);
    let getSessionOverride = null;
    const requests = [];
    const notices = [];
    const context = vm.createContext({
        window: { siyuan: { config: { ai: { agent: { modelId: 'model' }, providers: [
            { enabled: true, models: [{ id: 'model', name: 'model', enabled: true }] },
        ] } }, storage: {} } },
        HTMLElement: class {},
        AbortController, TextDecoder,
        Lute: { NewNodeID: () => `20261020120000-${String(++sequence).padStart(7, '0')}` },
        setTimeout: () => 1,
        clearTimeout: () => {},
        __taskHorizonHostBridge: {
            loadData: async () => store && plain(store),
            saveData: async (_name, value) => { store = plain(value); },
        },
        'siyuan-plugin-task-horizon': { aiBridge: {
            hint: (message, type) => notices.push({ message, type }),
        } },
        fetch: async (url, options) => {
            const body = JSON.parse(options.body);
            requests.push({ url, body });
            let data = null;
            if (url.endsWith('/getSession')) {
                if (getSessionOverride) return await getSessionOverride(body.id);
                if (!sessions.has(body.id)) return Response.json({ code: -1, msg: 'session not found' });
                data = plain(sessions.get(body.id));
            } else if (url.endsWith('/saveSession')) {
                const session = { ...body, revision: (sessions.get(body.id)?.revision || 0) + 1 };
                delete session.expectedRevision;
                sessions.set(body.id, session);
                data = { session };
            } else if (url.endsWith('/lsSessions')) {
                data = { sessions: [...sessions.values()], total: sessions.size };
            } else if (url.endsWith('/chat')) {
                return new Response('event: content\ndata: {"token":"Done"}\n\nevent: done\ndata: {}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
            } else if (!url.endsWith('/title')) {
                throw new Error(`Unexpected API: ${url}`);
            }
            return Response.json({ code: 0, data });
        },
    });
    const marker = '    globalThis.__tmAIAutomationTest = {';
    assert.ok(workbench.includes(marker));
    vm.runInContext(workbench.replace(marker,
        `    globalThis.sessionTest = { runtime, getDraft, setDraft, persistStore };\n${marker}`), context);
    return {
        api: context.__tmAI,
        automation: context.__tmAIAutomationTest,
        ...context.sessionTest,
        requests, notices, sessions,
        saved: () => plain(store),
        overrideGet: callback => { getSessionOverride = callback; },
    };
}

(async () => {
    const initial = install();
    await initial.api.reloadData();
    const empty = await initial.api.createConversation();
    initial.setDraft('  首条消息\n保留草稿  ');
    await initial.persistStore();
    const saved = initial.saved();
    assert.equal(empty.id, '', 'blank conversations have no persisted session ID');
    assert.equal(saved.activeSessionID, '');
    assert.equal(saved.sessionIDs.length, 0, 'blank conversations must not appear in recent sessions');
    assert.equal(saved.drafts.new, '  首条消息\n保留草稿  ');
    assert.equal(initial.sessions.size, 0, 'new empty sessions are not yet stored by the kernel');
    assert.equal(initial.requests.length, 0);

    // Reproduce: create an empty conversation, restart the plugin, then send.
    const restarted = install(saved);
    await restarted.api.reloadData();
    assert.equal(restarted.runtime.session, null);
    await restarted.automation.sendMessage();
    const chats = restarted.requests.filter(item => item.url.endsWith('/chat'));
    assert.equal(chats.length, 1, 'a missing restored session must not block sending');
    assert.notEqual(chats[0].body.sessionID, empty.id);
    assert.equal(restarted.runtime.session.entries[0].content.startsWith('首条消息\n保留草稿'), true);
    assert.equal(restarted.sessions.has(chats[0].body.sessionID), true, 'the replacement must be saved before chatting');
    assert.equal(restarted.runtime.busy, false);
    assert.equal(restarted.notices.length, 0, 'restarting a blank conversation needs no missing-session recovery');
    assert.equal(restarted.requests.filter(item => item.url.endsWith('/getSession')).length, 1, 'only the first-turn checkpoint needs a session lookup');
    await restarted.persistStore();
    assert.equal(restarted.saved().activeSessionID, chats[0].body.sessionID);
    assert.equal(restarted.saved().drafts.new, '', 'the sent draft must be cleared');

    // A blank session keeps model/approval choices until its first checkpoint.
    const configured = install(saved);
    await configured.api.reloadData();
    await configured.api.createConversation();
    configured.runtime.session.permissionMode = 'allowSession';
    configured.setDraft('configured message');
    await configured.automation.sendMessage();
    assert.equal(configured.requests.find(item => item.url.endsWith('/saveSession')).body.permissionMode, 'allowSession');

    // Reloading the same panel state keeps a blank draft; explicitly creating a new conversation clears it.
    const blank = install(saved);
    await blank.api.reloadData();
    await blank.api.createConversation();
    const blankSession = blank.runtime.session;
    await blank.api.reloadData();
    assert.equal(blank.runtime.session, blankSession);
    assert.equal(blank.getDraft(), saved.drafts.new);
    await blank.api.createConversation();
    assert.equal(blank.getDraft(), '');

    // Already-saved conversations resume under their authoritative ID after a restart.
    const resumed = install(restarted.saved(), restarted.sessions);
    await resumed.api.reloadData();
    await resumed.automation.sendMessage('continue');
    assert.equal(resumed.requests.find(item => item.url.endsWith('/chat')).body.sessionID, chats[0].body.sessionID);
    assert.equal(resumed.runtime.session.entries.filter(item => item.type === 'user').length, 2);

    // Compatibility with stale IDs written by older versions.
    const legacyID = '20261020120000-legacy1';
    const legacy = { ...saved, activeSessionID: legacyID, sessionIDs: [legacyID], drafts: { [legacyID]: saved.drafts.new } };

    // Recovery keeps the exact draft, selected context and preset without deleting the original session.
    const contextualStore = { ...legacy, presetID: 'task-review', context: {
        taskIDs: ['20261020120000-task001'], documentIDs: ['20261020120000-doc0001'],
    } };
    const recovery = install(contextualStore);
    await recovery.api.reloadData();
    const previousContext = plain(recovery.runtime.context);
    const replacement = await recovery.automation.loadSession(legacyID, { recoverMissing: true });
    assert.ok(replacement);
    assert.equal(replacement.id, '');
    assert.equal(recovery.getDraft(), saved.drafts.new);
    assert.deepEqual(plain(recovery.runtime.context), previousContext);
    assert.equal(recovery.runtime.presetID, 'task-review');
    assert.equal(recovery.runtime.store.sessionIDs.includes(legacyID), true);
    assert.equal(recovery.requests.some(item => item.url.endsWith('/removeSession')), false);

    // Explicit history/scheduled opens and timestamp-bound sessions must still wait for sync.
    for (const options of [{}, { sessionUpdatedAt: 123 }, { recoverMissing: true, sessionUpdatedAt: 123 }]) {
        const explicit = install(legacy);
        await explicit.api.reloadData();
        assert.equal(await explicit.automation.loadSession(legacyID, options), null);
        assert.equal(explicit.runtime.activeSessionID, legacyID);
        assert.equal(explicit.getDraft(), saved.drafts.new);
    }
    const foreign = install(legacy);
    await foreign.api.reloadData();
    assert.equal(await foreign.automation.loadSession('20261020120000-foreign', { recoverMissing: true }), null);
    assert.equal(foreign.runtime.activeSessionID, legacyID);

    // Normal synced sessions retain their ID, history and revision; stale snapshots remain blocked.
    const existing = { ...plain(empty), id: legacyID, revision: 7, updatedAt: 123, entries: [{ id: 'entry', type: 'user', content: 'history' }] };
    const synced = install(legacy, new Map([[legacyID, existing]]));
    await synced.api.reloadData();
    const loaded = await synced.automation.loadSession(legacyID, { recoverMissing: true });
    assert.deepEqual(plain(loaded), existing);
    assert.equal(synced.notices.length, 0);
    assert.equal(await synced.automation.loadSession(legacyID, { recoverMissing: true, sessionUpdatedAt: 124 }), null);
    assert.equal(synced.runtime.activeSessionID, legacyID);

    // Network, auth, permission, HTTP and malformed JSON errors must not create replacements.
    for (const failure of [
        () => { throw new TypeError('Failed to fetch'); },
        () => Response.json({ code: -1, msg: 'permission denied' }),
        () => Response.json({ code: -1, msg: 'Auth failed [session]' }),
        () => new Response('Not Found', { status: 404 }),
        () => new Response('{invalid JSON'),
    ]) {
        const failed = install(legacy);
        await failed.api.reloadData();
        failed.overrideGet(failure);
        assert.equal(await failed.automation.loadSession(legacyID, { recoverMissing: true }), null);
        assert.equal(failed.runtime.activeSessionID, legacyID);
        assert.equal(failed.getDraft(), saved.drafts.new);
        assert.equal(failed.runtime.session, null);
    }
    for (const message of [
        'open C:\\workspace\\data\\storage\\ai\\agent\\sessions\\id\\session.json: The system cannot find the path specified.',
        'open /workspace/data/storage/ai/agent/sessions/id/session.json: no such file or directory',
    ]) {
        const missing = install(legacy);
        await missing.api.reloadData();
        missing.overrideGet(() => Response.json({ code: -1, msg: message }));
        assert.ok(await missing.automation.loadSession(legacyID, { recoverMissing: true }));
        assert.equal(missing.runtime.activeSessionID, '');
    }

    // A delayed missing response cannot replace a session selected or started in the meantime.
    for (const state of ['switch', 'busy', 'settingsBusy']) {
        const raced = install(legacy);
        await raced.api.reloadData();
        let reject;
        raced.overrideGet(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
        const pending = raced.automation.loadSession(legacyID, { recoverMissing: true });
        let selectedID = legacyID;
        if (state === 'switch') selectedID = (await raced.api.createConversation()).id;
        else raced.runtime[state] = true;
        reject(new Error('session not found'));
        assert.equal(await pending, null);
        assert.equal(raced.runtime.activeSessionID, selectedID);
    }

    assert.match(workbench, /if \(runtime\.activeSessionID\) await loadSession\(runtime\.activeSessionID, \{ recoverMissing: true \}\);/, 'initial mount must recover the implicitly restored session');
    // A background schedule owns its session and must not replace the visible blank conversation.
    const background = install(saved);
    await background.api.reloadData();
    const foreground = await background.api.createConversation();
    const checkpoints = [];
    const firstRun = await background.automation.runAutomation({ prompt: 'scheduled', persistSession: true,
        onSessionSaved: session => checkpoints.push(plain(session)) });
    assert.ok(firstRun.sessionID);
    assert.equal(checkpoints[0].sessionID, firstRun.sessionID);
    assert.equal(background.runtime.activeSessionID, '');
    assert.equal(background.runtime.session, foreground);
    assert.equal(background.getDraft(), saved.drafts.new);
    await background.persistStore();
    assert.equal(background.saved().activeSessionID, '');
    const secondRun = await background.automation.runAutomation({ prompt: 'continue scheduled', persistSession: true,
        sessionID: firstRun.sessionID, sessionUpdatedAt: firstRun.sessionUpdatedAt });
    assert.equal(secondRun.sessionID, firstRun.sessionID);
    assert.equal(background.sessions.get(firstRun.sessionID).entries.filter(item => item.type === 'user').length, 2);
    background.sessions.delete(firstRun.sessionID);
    await assert.rejects(() => background.automation.runAutomation({ prompt: 'missing scheduled', persistSession: true,
        sessionID: firstRun.sessionID }), /已绑定.*数据同步/);
    assert.equal(background.runtime.session, foreground);
    assert.equal(background.getDraft(), saved.drafts.new);

    console.log('agent session lifecycle tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
