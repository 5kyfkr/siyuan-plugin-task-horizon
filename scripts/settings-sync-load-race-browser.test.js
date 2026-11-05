'use strict';

// Run the complete production store and sync reload against in-memory kernel files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test, before, after } = require('node:test');
const { chromium } = require('./i18n-browser-fixture');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read('src/task-horizon/' + file)).join('\n');
const startup = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(startup > 0);
runtime = runtime.slice(0, startup) + `
    Object.assign(groupProbe, { SettingsStore, state, reload: __tmReloadSyncedPluginData });
    __tmRefreshShellEntrances = () => {};
    globalThis.__tmProjectVisibility.load = async () => {};
    MetaStore.load = WhiteboardStore.load = SemanticDateRecognizedStore.load = async () => {};
})();`;
let server, browser, origin;
before(async () => {
    server = http.createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>Group sync load race</title>'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

async function withPage(holdInitialRead, run) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
        await page.goto(origin);
        await page.evaluate(hold => {
            const settingsPath = '/data/storage/petal/siyuan-plugin-task-horizon/task-settings.json';
            const old = { settingsUpdatedAt: 100, docGroupSettingsUpdatedAt: 100, currentGroupId: 'all',
                docGroups: [{ id: 'daily', name: 'Daily', docs: [] }] };
            const next = { ...old, settingsUpdatedAt: 200, docGroupSettingsUpdatedAt: 200,
                docGroups: [{ id: 'daily', name: 'Renamed', docs: [] }, { id: 'new', name: 'New group', docs: [] }] };
            localStorage.setItem('tm_doc_groups', JSON.stringify(old.docGroups));
            localStorage.setItem('tm_doc_group_settings_updated_at', '100');
            localStorage.setItem('tm_settings_updated_at', '100');
            window.groupProbe = { settingsPath, old, next, hold, reads: 0, writes: [], settingsWrites: [], files: new Map([
                [settingsPath, old],
                ['/data/storage/petal/siyuan-plugin-task-horizon/task-templates.json', { schemaVersion: 1, updatedAt: 100, items: [] }],
            ]) };
            window.fetch = async (url, options = {}) => {
                const p = groupProbe;
                if (String(url).endsWith('/api/file/getFile')) {
                    const target = JSON.parse(options.body).path;
                    if (!p.files.has(target)) return new Response('', { status: 404 });
                    const snapshot = JSON.stringify(p.files.get(target));
                    if (target === p.settingsPath) {
                        p.reads++;
                        if (p.hold) {
                            p.hold = false;
                            p.held = true;
                            await new Promise(resolve => { p.release = resolve; });
                        }
                    }
                    return new Response(snapshot, { status: 200 });
                }
                if (String(url).endsWith('/api/file/putFile')) {
                    const file = options.body.get('file');
                    if (file) {
                        const target = options.body.get('path');
                        const data = JSON.parse(await file.text());
                        p.files.set(target, data);
                        if (target === p.settingsPath) p.settingsWrites.push(data);
                        p.writes.push(target);
                    }
                }
                return new Response(JSON.stringify({ code: 0, data: [] }), { status: 200 });
            };
        }, holdInitialRead);
        await page.addScriptTag({ content: runtime });
        await run(page);
    } finally { await page.close(); }
}

test('sync reload does not join a pre-sync settings read and keep its stale groups', () => withPage(true, async page => {
    await page.evaluate(() => { groupProbe.initialLoad = groupProbe.SettingsStore.load(); });
    await page.waitForFunction(() => groupProbe.held === true);
    await page.evaluate(() => {
        groupProbe.files.set(groupProbe.settingsPath, groupProbe.next);
        groupProbe.reloading = groupProbe.reload({ reason: 'sync', suppressStorageWrites: true });
    });
    await page.evaluate(async () => { groupProbe.release(); await groupProbe.reloading; });
    assert.deepEqual(await page.evaluate(() => groupProbe.SettingsStore.data.docGroups.map(group => group.name)), ['Renamed', 'New group']);
    assert.ok(await page.evaluate(() => groupProbe.reads >= 2), 'the cancelled pre-sync response must be followed by a fresh file read');
    assert.deepEqual(await page.evaluate(() => groupProbe.files.get(groupProbe.settingsPath).docGroups.map(group => group.name)), ['Renamed', 'New group']);
}));

test('a normal completed load still refreshes from a later downloaded settings file', () => withPage(false, async page => {
    await page.evaluate(() => groupProbe.SettingsStore.load());
    assert.deepEqual(await page.evaluate(() => groupProbe.SettingsStore.data.docGroups.map(group => group.name)), ['Daily']);
    await page.evaluate(async () => {
        groupProbe.files.set(groupProbe.settingsPath, groupProbe.next);
        await groupProbe.reload({ reason: 'sync', suppressStorageWrites: true });
    });
    assert.deepEqual(await page.evaluate(() => groupProbe.SettingsStore.data.docGroups.map(group => group.name)), ['Renamed', 'New group']);
}));

test('loading downloaded settings cannot promote an old cached group through the overall settings timestamp', () => withPage(false, async page => {
    await page.evaluate(async () => {
        localStorage.setItem('tm_settings_updated_at', '3000');
        localStorage.setItem('tm_settings_field_updated_at', JSON.stringify({ currentRule: 2900 }));
        localStorage.setItem('tm_doc_group_settings_updated_at', '100');
        groupProbe.files.set(groupProbe.settingsPath, {
            ...groupProbe.next,
            settingsUpdatedAt: 4000,
            settingsFieldUpdatedAt: { currentRule: 2900 },
        });
        groupProbe.SettingsStore.loaded = false;
        groupProbe.SettingsStore.data.docGroupSettingsUpdatedAt = 0;
        groupProbe.SettingsStore.loadFromLocal();
        await groupProbe.SettingsStore.load();
    });
    assert.deepEqual(await page.evaluate(() => groupProbe.SettingsStore.data.docGroups.map(group => group.name)), ['Renamed', 'New group']);
}));

test('a previously persisted virtual group clock cannot veto the downloaded settings file', () => withPage(false, async page => {
    await page.evaluate(async () => {
        localStorage.setItem('tm_settings_updated_at', '3000');
        localStorage.setItem('tm_settings_field_updated_at', JSON.stringify({ currentRule: 2900, docGroupSyncState: 9000 }));
        localStorage.setItem('tm_doc_group_settings_updated_at', '9000');
        groupProbe.files.set(groupProbe.settingsPath, {
            ...groupProbe.next,
            settingsUpdatedAt: 4000,
            settingsFieldUpdatedAt: { currentRule: 2900, docGroupSyncState: 200 },
        });
        await groupProbe.reload({ reason: 'sync', suppressStorageWrites: true });
    });
    assert.deepEqual(await page.evaluate(() => groupProbe.SettingsStore.data.docGroups.map(group => group.name)), ['Renamed', 'New group']);
    assert.equal(await page.evaluate(() => Object.hasOwn(groupProbe.SettingsStore.data.settingsFieldUpdatedAt, 'docGroupSyncState')), false);
}));

test('sync merges the actual docGroups setting and a following ordinary save preserves its clock', () => withPage(false, async page => {
    await page.evaluate(async () => {
        groupProbe.files.set(groupProbe.settingsPath, {
            ...groupProbe.old,
            settingsUpdatedAt: 3000,
            settingsFieldUpdatedAt: { docGroups: 100, currentGroupId: 2900 },
        });
        await groupProbe.SettingsStore.load();
        groupProbe.files.set(groupProbe.settingsPath, {
            ...groupProbe.next,
            settingsUpdatedAt: 2000,
            settingsFieldUpdatedAt: { docGroups: 200, currentGroupId: 1900 },
        });
        await groupProbe.reload({ reason: 'sync', suppressStorageWrites: true });
        groupProbe.SettingsStore.data.currentGroupId = 'daily';
        const saved = groupProbe.SettingsStore.save();
        await groupProbe.SettingsStore.saveNow();
        await saved;
    });
    const saved = await page.evaluate(() => groupProbe.files.get(groupProbe.settingsPath));
    assert.deepEqual(saved.docGroups.map(group => group.name), ['Renamed', 'New group']);
    assert.equal(saved.settingsFieldUpdatedAt.docGroups, 200);
    assert.equal(Object.hasOwn(saved, 'docGroupSettingsUpdatedAt'), false);
}));

test('an unchanged startup save leaves the receiver clean so a completed file sync can download renamed groups', () => withPage(false, async page => {
    const outcome = await page.evaluate(async () => {
        const p = groupProbe;
        const store = p.SettingsStore;
        await store.load();
        if (store.saveDirty || store.saving) await store.saveNow();
        // Start from a complete, normalized shared file, as on an existing installation.
        const baseline = store.buildCloudPayload();
        p.files.set(p.settingsPath, JSON.parse(JSON.stringify(baseline)));
        p.settingsWrites.length = 0;
        const unchanged = store.save();
        await store.saveNow();
        await unchanged;
        const writesBeforeSync = p.settingsWrites.length;
        const downloaded = {
            ...baseline,
            settingsUpdatedAt: baseline.settingsUpdatedAt + 1000,
            settingsFieldUpdatedAt: { ...baseline.settingsFieldUpdatedAt, docGroups: Date.now() + 1000 },
            docGroups: p.next.docGroups,
        };
        // A file conflict can retain the receiver's modified local file. A clean receiver downloads it.
        if (!writesBeforeSync) p.files.set(p.settingsPath, downloaded);
        await p.reload({ reason: 'sync', suppressStorageWrites: true });
        return { writesBeforeSync, groups: store.data.docGroups.map(g => g.name) };
    });
    assert.equal(outcome.writesBeforeSync, 0, 'an unchanged startup save must not dirty the shared settings file');
    assert.deepEqual(outcome.groups, ['Renamed', 'New group']);
}));

test('an unchanged settings save preserves both file contents and the overall timestamp', () => withPage(false, async page => {
    const result = await page.evaluate(async () => {
        const p = groupProbe;
        const store = p.SettingsStore;
        await store.load();
        if (store.saveDirty || store.saving) await store.saveNow();
        const baseline = store.buildCloudPayload();
        p.files.set(p.settingsPath, JSON.parse(JSON.stringify(baseline)));
        p.settingsWrites.length = 0;
        const before = JSON.stringify(p.files.get(p.settingsPath));
        const at = store.data.settingsUpdatedAt;
        for (let i = 0; i < 3; i++) {
            const saved = store.save();
            await store.saveNow();
            await saved;
        }
        return {
            writes: p.settingsWrites.length,
            unchanged: before === JSON.stringify(p.files.get(p.settingsPath)),
            timestampUnchanged: store.data.settingsUpdatedAt === at,
            skipped: store.lastSaveResult?.skipped,
        };
    });
    assert.deepEqual(result, { writes: 0, unchanged: true, timestampUnchanged: true, skipped: true });
}));

test('two isolated plugin instances converge after startup, a source rename, file sync, and a receiver group switch', () => withPage(false, async source => {
    const baseline = await source.evaluate(async () => {
        const store = groupProbe.SettingsStore;
        await store.load();
        if (store.saveDirty || store.saving) await store.saveNow();
        return store.buildCloudPayload();
    });
    await withPage(false, async receiver => {
        const receiverWrites = await receiver.evaluate(async shared => {
            const p = groupProbe;
            p.files.set(p.settingsPath, shared);
            p.settingsWrites.length = 0;
            await p.SettingsStore.load();
            const saved = p.SettingsStore.save();
            await p.SettingsStore.saveNow();
            await saved;
            return p.settingsWrites.length;
        }, baseline);
        assert.equal(receiverWrites, 0, 'receiver startup must not create a settings-file conflict');
        const published = await source.evaluate(async () => {
            const p = groupProbe;
            p.SettingsStore.data.docGroups[0].name = 'Daily renamed on source';
            const saved = p.SettingsStore.save();
            await p.SettingsStore.saveNow();
            await saved;
            return p.files.get(p.settingsPath);
        });
        const synced = await receiver.evaluate(async downloaded => {
            const p = groupProbe;
            p.files.set(p.settingsPath, downloaded);
            await p.reload({ reason: 'sync', suppressStorageWrites: true });
            const afterSync = p.SettingsStore.data.docGroups.map(g => g.name);
            p.SettingsStore.data.currentGroupId = 'daily';
            const saved = p.SettingsStore.save();
            await p.SettingsStore.saveNow();
            await saved;
            return { afterSync, persisted: p.files.get(p.settingsPath) };
        }, published);
        assert.deepEqual(synced.afterSync, ['Daily renamed on source']);
        assert.deepEqual(synced.persisted.docGroups.map(g => g.name), ['Daily renamed on source']);
        assert.equal(synced.persisted.settingsFieldUpdatedAt.docGroups, published.settingsFieldUpdatedAt.docGroups);
    });
}));
