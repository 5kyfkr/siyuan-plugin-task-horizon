'use strict';

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

let server;
let browser;
let origin;

before(async () => {
    server = http.createServer((_req, res) => {
        res.setHeader('content-type', 'text/html');
        res.end('<!doctype html><title>Settings file authority</title>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await new Promise(resolve => server?.close(resolve));
});

const settingsPath = '/data/storage/petal/siyuan-plugin-task-horizon/task-settings.json';
const templatePath = '/data/storage/petal/siyuan-plugin-task-horizon/task-templates.json';
const localSettings = {
    settingsUpdatedAt: 9000,
    docGroupSettingsUpdatedAt: 9000,
    currentGroupId: 'all',
    kanbanAppearance: 'classic',
    docGroups: [{ id: 'daily', name: 'Local stale group', docs: [] }],
};
const fileSettings = {
    settingsUpdatedAt: 200,
    currentGroupId: 'all',
    kanbanAppearance: 'lanes',
    docGroups: [{ id: 'daily', name: 'File group', docs: [] }, { id: 'new', name: 'New group', docs: [] }],
};

async function withPage({ holdInitialRead = false, includeSettingsFile = true, cache = localSettings, file = fileSettings }, run) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
        await page.goto(origin);
        await page.evaluate(({ cache, includeSettingsFile, holdInitialRead, settingsPath, templatePath, fileSettings }) => {
            localStorage.setItem('tm_settings_updated_at', JSON.stringify(cache.settingsUpdatedAt));
            localStorage.setItem('tm_doc_group_settings_updated_at', JSON.stringify(cache.docGroupSettingsUpdatedAt));
            localStorage.setItem('tm_current_group_id', JSON.stringify(cache.currentGroupId));
            localStorage.setItem('tm_kanban_appearance', JSON.stringify(cache.kanbanAppearance));
            localStorage.setItem('tm_doc_groups', JSON.stringify(cache.docGroups));
            localStorage.setItem('tm_settings_field_updated_at', JSON.stringify({ docGroups: 9999 }));
            window.groupProbe = {
                holdInitialRead,
                reads: 0,
                writes: [],
                files: new Map([
                    [templatePath, { schemaVersion: 1, updatedAt: 100, items: [] }],
                    ...(includeSettingsFile ? [[settingsPath, fileSettings]] : []),
                ]),
            };
            window.fetch = async (url, options = {}) => {
                const probe = groupProbe;
                if (String(url).endsWith('/api/file/getFile')) {
                    const target = JSON.parse(options.body).path;
                    if (!probe.files.has(target)) return new Response('', { status: 404 });
                    const snapshot = JSON.stringify(probe.files.get(target));
                    if (target === settingsPath) {
                        probe.reads++;
                        if (probe.holdInitialRead) {
                            probe.holdInitialRead = false;
                            probe.held = true;
                            await new Promise(resolve => { probe.release = resolve; });
                        }
                    }
                    return new Response(snapshot, { status: 200 });
                }
                if (String(url).endsWith('/api/file/putFile')) {
                    const file = options.body.get('file');
                    if (file) {
                        const target = options.body.get('path');
                        const data = JSON.parse(await file.text());
                        probe.files.set(target, data);
                        probe.writes.push(target);
                    }
                }
                return new Response(JSON.stringify({ code: 0, data: [] }), { status: 200 });
            };
        }, { cache, includeSettingsFile, holdInitialRead, settingsPath, templatePath, fileSettings: file });
        await page.addScriptTag({ content: runtime });
        await run(page);
    } finally {
        await page.close();
    }
}

test('a valid settings file replaces stale local cache even when the local clock is newer', () => withPage({}, async page => {
    await page.evaluate(() => groupProbe.SettingsStore.load());
    const loaded = await page.evaluate(() => ({
        groups: groupProbe.SettingsStore.data.docGroups.map(group => group.name),
        appearance: groupProbe.SettingsStore.data.kanbanAppearance,
        cachedGroups: JSON.parse(localStorage.getItem('tm_doc_groups')).map(group => group.name),
    }));
    assert.deepEqual(loaded.groups, ['File group', 'New group']);
    assert.equal(loaded.appearance, 'lanes');
    assert.deepEqual(loaded.cachedGroups, ['File group', 'New group']);
}));

test('sync reload cannot join a pre-sync settings read and keep stale state', () => withPage({ holdInitialRead: true }, async page => {
    await page.evaluate(() => { groupProbe.initialLoad = groupProbe.SettingsStore.load(); });
    await page.waitForFunction(() => groupProbe.held === true);
    await page.evaluate(next => {
        groupProbe.files.set('/data/storage/petal/siyuan-plugin-task-horizon/task-settings.json', next);
        groupProbe.reloading = groupProbe.reload({ reason: 'sync', suppressStorageWrites: true });
    }, { ...fileSettings, docGroups: [{ id: 'synced', name: 'Synced group', docs: [] }] });
    await page.evaluate(async () => { groupProbe.release(); await groupProbe.reloading; });
    assert.deepEqual(
        await page.evaluate(() => groupProbe.SettingsStore.data.docGroups.map(group => group.name)),
        ['Synced group'],
    );
    assert.ok(await page.evaluate(() => groupProbe.reads >= 2));
}));

test('the local cache is only used to seed a missing settings file', () => withPage({ includeSettingsFile: false }, async page => {
    await page.evaluate(() => groupProbe.SettingsStore.load());
    await page.waitForFunction(settingsPath => groupProbe.files.has(settingsPath), settingsPath);
    const result = await page.evaluate(settingsPath => ({
        groups: groupProbe.SettingsStore.data.docGroups.map(group => group.name),
        file: groupProbe.files.get(settingsPath),
        writes: groupProbe.writes.slice(),
    }), settingsPath);
    assert.deepEqual(result.groups, ['Local stale group']);
    assert.ok(result.file, `the migrated settings file must be written: ${JSON.stringify(result)}`);
    assert.deepEqual(result.file.docGroups.map(group => group.name), ['Local stale group']);
    assert.equal(Object.hasOwn(result.file, 'settingsFieldUpdatedAt'), false);
}));

test('two clients with different caches load the same synchronized file configuration', async () => {
    let first;
    let second;
    await withPage({ cache: { ...localSettings, docGroups: [{ id: 'a', name: 'Cache A', docs: [] }] } }, async page => {
        await page.evaluate(() => groupProbe.SettingsStore.load());
        first = await page.evaluate(() => groupProbe.SettingsStore.data.docGroups.map(group => group.name));
    });
    await withPage({ cache: { ...localSettings, docGroups: [{ id: 'b', name: 'Cache B', docs: [] }] } }, async page => {
        await page.evaluate(() => groupProbe.SettingsStore.load());
        second = await page.evaluate(() => groupProbe.SettingsStore.data.docGroups.map(group => group.name));
    });
    assert.deepEqual(first, ['File group', 'New group']);
    assert.deepEqual(second, first);
});

test('view switcher text style is written once and reloads on the other client', async () => {
    let published;
    await withPage({}, async page => {
        await page.evaluate(async () => {
            await groupProbe.SettingsStore.load();
            groupProbe.SettingsStore.data.enabledViews = ['list', 'calendar'];
            groupProbe.SettingsStore.data.shortcutSidebarEnabled = false;
            groupProbe.SettingsStore.data.enablePointsRewardIntegration = true;
            groupProbe.SettingsStore.data.pointsPenaltyScheduleEnabled = false;
            groupProbe.SettingsStore.data.docTitleGroupFocusEnabled = false;
            await updateViewSwitcherStyle('text');
        });
        await page.waitForFunction(settingsPath => groupProbe.files.get(settingsPath)?.viewSwitcherStyle === 'text', settingsPath);
        published = await page.evaluate(settingsPath => groupProbe.files.get(settingsPath), settingsPath);
        assert.equal(published.viewSwitcherStyle, 'text');
        assert.deepEqual(published.enabledViews, ['list', 'calendar']);
        assert.equal(published.shortcutSidebarEnabled, false);
        assert.equal(published.enablePointsRewardIntegration, true);
        assert.equal(published.pointsPenaltyScheduleEnabled, false);
        assert.equal(published.docTitleGroupFocusEnabled, false);
    });
    await withPage({ file: published }, async page => {
        const result = await page.evaluate(async next => {
            await groupProbe.SettingsStore.load();
            groupProbe.files.set('/data/storage/petal/siyuan-plugin-task-horizon/task-settings.json', next);
            groupProbe.styleRefreshes = [];
            groupProbe.controlRefreshes = [];
            groupProbe.enabledViewRefreshes = [];
            groupProbe.settingsChipRefreshes = [];
            groupProbe.pointsPenaltyRefreshes = [];
            groupProbe.docTitleMarkerRefreshes = [];
            groupProbe.shortcutSidebarRefreshes = [];
            groupProbe.state.__tmRefreshEnabledViewSettingsLight = () => groupProbe.enabledViewRefreshes.push(true);
            groupProbe.state.__tmRefreshViewSwitcherStyleSettingsLight = value => groupProbe.styleRefreshes.push(value);
            groupProbe.state.__tmSettingsChipLightRefresh = () => groupProbe.settingsChipRefreshes.push(true);
            globalThis.__tmRefreshViewSwitcherControlsInPlace = () => {
                groupProbe.controlRefreshes.push(groupProbe.SettingsStore.data.viewSwitcherStyle);
                return true;
            };
            globalThis.__tmPointsPenaltyRuntimeRefresh = options => groupProbe.pointsPenaltyRefreshes.push(options.reason);
            globalThis.__tmMarkDocTitleMarkersDirty = (docIds, options) => groupProbe.docTitleMarkerRefreshes.push({ docIds, options });
            globalThis.__tmRefreshShortcutSidebarEnabled = () => groupProbe.shortcutSidebarRefreshes.push(true);
            await groupProbe.reload({ reason: 'sync', suppressStorageWrites: true });
            return {
                value: groupProbe.SettingsStore.data.viewSwitcherStyle,
                enabledViews: groupProbe.SettingsStore.data.enabledViews,
                shortcutSidebarEnabled: groupProbe.SettingsStore.data.shortcutSidebarEnabled,
                enablePointsRewardIntegration: groupProbe.SettingsStore.data.enablePointsRewardIntegration,
                pointsPenaltyScheduleEnabled: groupProbe.SettingsStore.data.pointsPenaltyScheduleEnabled,
                docTitleGroupFocusEnabled: groupProbe.SettingsStore.data.docTitleGroupFocusEnabled,
                enabledViewRefreshes: groupProbe.enabledViewRefreshes,
                styleRefreshes: groupProbe.styleRefreshes,
                settingsChipRefreshes: groupProbe.settingsChipRefreshes,
                controlRefreshes: groupProbe.controlRefreshes,
                pointsPenaltyRefreshes: groupProbe.pointsPenaltyRefreshes,
                docTitleMarkerRefreshes: groupProbe.docTitleMarkerRefreshes,
                shortcutSidebarRefreshes: groupProbe.shortcutSidebarRefreshes,
            };
        }, published);
        assert.equal(result.value, 'text');
        assert.deepEqual(result.enabledViews, ['list', 'calendar']);
        assert.equal(result.shortcutSidebarEnabled, false);
        assert.equal(result.enablePointsRewardIntegration, true);
        assert.equal(result.pointsPenaltyScheduleEnabled, false);
        assert.equal(result.docTitleGroupFocusEnabled, false);
        assert.deepEqual(result.enabledViewRefreshes, [true]);
        assert.deepEqual(result.styleRefreshes, ['text']);
        assert.deepEqual(result.settingsChipRefreshes, [true]);
        assert.deepEqual(result.controlRefreshes, ['text']);
        assert.deepEqual(result.pointsPenaltyRefreshes, ['sync:sync']);
        assert.deepEqual(result.shortcutSidebarRefreshes, [true]);
        assert.ok(result.docTitleMarkerRefreshes.some(call =>
            call.docIds === null
            && call.options?.tasks === true
            && call.options?.scope === true
            && call.options?.duration === true
        ));
    });
});

test('saving shared settings writes the current file payload without field timestamps', () => withPage({}, async page => {
    await page.evaluate(async () => {
        await groupProbe.SettingsStore.load();
        groupProbe.SettingsStore.data.kanbanAppearance = 'classic';
        await groupProbe.SettingsStore.save();
        await groupProbe.SettingsStore.saveNow();
    });
    const file = await page.evaluate(settingsPath => groupProbe.files.get(settingsPath), settingsPath);
    assert.equal(file.kanbanAppearance, 'classic');
    assert.equal(Object.hasOwn(file, 'settingsFieldUpdatedAt'), false);
}));
