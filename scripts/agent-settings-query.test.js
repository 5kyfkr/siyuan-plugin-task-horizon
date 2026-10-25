'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const screen = read('src/task-horizon/main/settings/60-settings-screen.js');
const navigation = read('src/task-horizon/main/settings/68-settings-v2.js');
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const registered = [];
let loadCalls = 0;
const namespace = {};
const initialData = Object.freeze({
    fontSize: 14, fontSizeMobile: 16, rowHeightMode: 'normal', taskAutoWrapEnabled: true,
    taskContentWrapMaxLines: 2, taskContentWrapMaxLinesMobile: 3, remainingTimeUseWorkdays: false,
    taskDoneDelightEnabled: true, checklistCompactMode: true, showCompletedTasks: true,
    showCompletedTasksByGroup: Object.freeze({ work: false, personal: true }), currentGroupId: 'work',
    completedTasksTodayOnly: false, completedTasksInlineInGroups: false,
    aiMiniMaxApiKey: 'private-model-key', calendarIcsWebdavPassword: 'private-webdav-password',
    calendarIcsWebdavUrl: 'https://private.example/calendar',
    docGroups: Object.freeze([{ id: 'work', name: 'Private project name' }]),
});
const settingsStore = {
    loaded: false, data: initialData,
    save() { throw new Error('settings queries must not save'); },
};
class PluginStub {
    constructor() {
        this.name = 'siyuan-plugin-task-horizon';
        this.displayName = 'Task Horizon';
        this.agentCapabilities = [];
    }
    addAgentCapability(options) {
        const id = `plugin/frontend/${this.name}/${options.name}`;
        this.agentCapabilities.push({ id, generation: this.agentCapabilities.length + 1 });
        registered.push(options);
        return id;
    }
}
const context = {
    console, module: { exports: {} }, exports: {},
    require(name) {
        assert.equal(name, 'siyuan');
        return { Plugin: PluginStub, Protyle: class {}, openTab() {}, openMobileFileById() {} };
    },
    window: {
        tmLicenseHasFeature: () => false,
        tmRequireFullFeature() { throw new Error('the public settings query must not open the paid workbench'); },
    },
    document: new Proxy({}, { get() { throw new Error('settings queries must not access the UI'); } }),
    localStorage: {
        getItem: () => null,
        setItem() { throw new Error('settings queries must not write localStorage'); },
    },
    navigator: { userAgent: '' }, setTimeout, clearTimeout,
    SettingsStore: settingsStore, __tmNs: namespace,
    async __tmEnsureSettingsLoaded(force) {
        assert.equal(force, false);
        loadCalls++;
        settingsStore.loaded = true;
    },
    'siyuan-plugin-task-horizon': namespace,
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(read('index.js'), context, { filename: 'index.js' });
vm.runInContext(navigation.slice(navigation.indexOf('    const TM_SETTINGS_V2_PAGES'), navigation.indexOf('    const __tmSettingsV2Sources')), context);
vm.runInContext(stores.slice(stores.indexOf('    function __tmGetShowCompletedTasksFromSettings'), stores.indexOf('    function __tmSetShowCompletedTasksInSettings')), context);
vm.runInContext(screen.slice(screen.indexOf('    const __tmSettingsQueryDefinitions'), screen.indexOf('    let __tmSettingsSearchCaptureBuffer')), context);

const plugin = new context.module.exports();
assert.equal(plugin.registerTaskHorizonAgentActions(), true);
const capability = registered.find(item => item.name === 'query_plugin_settings');
assert.ok(capability, 'the query must be available on a free native Agent registration');
assert.equal(capability.effects.localRead, true);
assert.equal(capability.effects.localWrite, undefined);
assert.equal(capability.inputSchema.additionalProperties, false);

async function query(args) {
    const result = await capability.handler(args);
    assert.equal(result.error, undefined, result.error);
    return JSON.parse(result.result);
}

(async () => {
    const before = JSON.stringify(settingsStore.data);
    const catalog = await query({});
    assert.equal(loadCalls, 1, 'cold queries must await settings without opening the settings page');
    assert.equal(catalog.readOnly, true);
    assert.equal(catalog.items.length, 12);
    assert.equal(catalog.total, 12);
    assert.match(catalog.coverage, /仅覆盖常用/);
    assert.ok(catalog.items.every(item => typeof item.currentValue !== 'object'));
    const serialized = JSON.stringify(catalog);
    for (const privateValue of ['private-model-key', 'private-webdav-password', 'private.example', 'Private project name']) {
        assert.equal(serialized.includes(privateValue), false, 'only explicitly supported display/behavior values may leave the plugin');
    }

    const mobile = await query({ query: '手机字太小', limit: 1 });
    assert.equal(mobile.items[0].id, 'fontSizeMobile');
    assert.equal(mobile.items[0].currentValue, 16);
    assert.equal(mobile.items[0].path, '外观 → 字号与密度 → 移动端字体');
    assert.equal(mobile.items[0].scope, '移动端');
    const layout = await query({ query: '字段不要挤在右侧' });
    assert.equal(layout.items[0].id, 'checklistCompactMode');
    assert.equal(layout.items[0].path, '视图 → 表格 / 清单 → 清单紧凑模式');
    const completed = await query({ query: '任务完成后不要消失' });
    assert.equal(completed.items[0].id, 'showCompletedTasks');
    assert.equal(completed.items[0].currentValue, false, 'group-specific values must override global defaults');
    assert.equal(completed.items[0].groupID, 'work');
    assert.match(completed.items[0].note, /筛选规则/);
    assert.equal((await query({ query: 'fontSizeMobile' })).items[0].id, 'fontSizeMobile', 'returned setting IDs must support subsequent queries');
    assert.equal((await query({ query: '   ', limit: 2 })).items.length, 2);
    assert.equal((await query({ query: 'API Key' })).items.length, 0);
    assert.equal((await query({ query: '不存在的选项' })).total, 0);
    assert.equal((await query({ query: '免费使用功能' })).total, 0);
    assert.equal(loadCalls, 1, 'loaded settings must not be reloaded on every query');
    assert.equal(JSON.stringify(settingsStore.data), before, 'queries must leave settings unchanged');

    settingsStore.data = Object.freeze({ ...initialData, fontSize: 18, fontSizeMobile: 0, currentGroupId: 'personal' });
    assert.equal((await query({ query: '移动端字体' })).items[0].currentValue, 18, 'unconfigured mobile font size follows desktop');
    assert.equal((await query({ query: '显示已完成任务' })).items[0].currentValue, true, 'queries must use the current group at call time');
    settingsStore.data = Object.freeze({ ...initialData, currentGroupId: 'other', showCompletedTasks: false });
    assert.equal((await query({ query: '显示已完成任务' })).items[0].currentValue, false, 'unconfigured groups follow the global setting');

    for (const args of [[], { query: {} }, { query: 'a'.repeat(201) }, { limit: 0 }, { limit: 21 }, { limit: 1.5 }, { limit: '2' }]) {
        const result = await capability.handler(args);
        assert.equal(typeof result.error, 'string', 'invalid query inputs must report an error');
        assert.equal(result.result, undefined);
    }
    settingsStore.loaded = false;
    context.__tmEnsureSettingsLoaded = async () => {};
    assert.match((await capability.handler({})).error, /设置尚未加载/, 'failed loads must not report default values as current settings');
    console.log('native Agent settings query tests passed (free access, cold load, scope, read-only and private-value isolation)');
})().catch(error => { console.error(error); process.exitCode = 1; });
