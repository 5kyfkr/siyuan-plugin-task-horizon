'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', name), 'utf8');
const stores = read('10-stores-rules-and-cache.js');
const runtime = read('20-api-and-runtime-services.js');
const dialogs = read('30-dialogs-and-ui-foundation.js');
const extract = (source, name) => {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
};
const persisted = new Map();
let saves = 0;
const settings = {
    loaded: true,
    data: { filterRules: [], calendarFirstDay: 1, columnOrder: [] },
    async save() { saves++; persisted.set('tm_filter_rules', this.data.filterRules); },
};
const state = { currentRule: null, filterRules: [] };
const context = vm.createContext({
    console, Date, Map, Set, WeakMap, Intl, SettingsStore: settings, state, window: {},
    Storage: { get: (key, fallback) => persisted.has(key) ? persisted.get(key) : fallback, has: key => persisted.has(key) },
    __TM_CUSTOM_ORDER_SORT_FIELD: '__customOrder',
    __tmRuleSortsUseCustomOrderField: rule => rule.sort?.some(item => item.field === '__customOrder'),
    __tmParseVersionNumber: value => Number(value) || 0,
    __tmGetCustomFieldDefs: () => [],
    __tmParseCustomFieldColumnKey: () => '',
    __tmGetStatusOptions: options => context.__tmTaskStatusRules.normalizeOptions(options),
    __tmGetDefaultUndoneStatusId: () => 'todo',
    __tmResolveTaskStatusId: task => task.customStatus || 'todo',
    __tmIsTaskDoneEffective: task => task.done === true,
    __tmIsTaskCanceled: task => task.taskMarker === '-',
    __tmIsCheckinTask: task => task.checkin === true,
    __tmGetTaskCheckinCurrentDate: task => task.plannedDay || '',
    __tmShouldUseBestSubtaskTimeForSort: () => false,
    __tmEnsureTaskPriorityScore: task => Number(task.priorityScore || 0),
    escSq: String,
    __tmEnsureSettingsLoaded: async () => {},
    __tmFlushSettingsAutosave: async () => {},
    __tmRefreshRuleTopbarSelectsInPlace() {},
    __tmRerenderRulesManagerUI() {},
    __tmScheduleRender() {},
    hint() {},
    showConfirm: async () => true,
});
vm.runInContext(extract(runtime, '__tmCreateTaskStatusRules') + '\nglobalThis.__tmTaskStatusRules = __tmCreateTaskStatusRules();', context);
vm.runInContext(extract(read('task-runtime/50-task-model-and-repeat-utils.js'), '__tmParseTimeToTs'), context);
for (const name of ['__tmGetNormalizedRuleSorts', '__tmRuleUsesDocFlowSort', '__tmRuleUsesCustomOrderSort', '__tmIsAllRuleLike', '__tmNormalizeRuleIdValue']) {
    vm.runInContext(extract(dialogs, name), context);
}
vm.runInContext(stores.slice(stores.indexOf('const RuleManager = {'), stores.indexOf('    const __tmTasksQueryCache')) + '\nglobalThis.manager = RuleManager;', context);
vm.runInContext(extract(read('render/45-render-shell-controls-and-resize.js'), '__tmBuildRuleMenuOptions'), context);
const manager = context.manager;
vm.runInContext('let __tmFilterRulesEnsurePromise = null;\n' + extract(runtime, '__tmEnsureFilterRulesLoaded'), context);
const restoreFrom = dialogs.indexOf('    window.tmRestoreRecommendedRules = async function()');
vm.runInContext(dialogs.slice(restoreFrom, dialogs.indexOf('\n    };', restoreFrom) + 7), context);
const plain = value => JSON.parse(JSON.stringify(value));
const ids = tasks => Array.from(tasks, task => task.id);
const nowDate = new Date(2026, 9, 29, 12);
const task = (id, fields = {}) => ({ id, done: false, root_id: 'doc', ...fields });
const filter = (name, tasks) => manager.applyRuleFilter(tasks, manager.getDefaultRules().find(rule => rule.name === name), { nowDate });

async function run() {
    const fresh = await manager.initRules();
    state.filterRules = fresh;
    assert.deepEqual(Array.from(context.__tmBuildRuleMenuOptions(), option => option.label),
        ['全部', '未完成', '今日', '已逾期', '未来七天', '未安排']);
    assert.ok(!fresh.some(rule => ['default_all', 'high_priority', 'default_completed'].includes(rule.id)));
    const statusDefaults = context.__tmTaskStatusRules.normalizeOptions([]);
    assert.deepEqual(Array.from(statusDefaults, option => option.name), ['待办', '进行中', '已完成', '放弃']);
    const storeStatusDefaults = /customStatusOptions:\s*(\[[\s\S]*?\n\s*\]),/.exec(stores)[1];
    assert.deepEqual(plain(vm.runInContext(storeStatusDefaults, context)), plain(statusDefaults));
    const existingStatuses = [...plain(statusDefaults), { id: 'blocked', name: '等供应商', color: '#123456', marker: ' ' }];
    assert.deepEqual(plain(context.__tmTaskStatusRules.normalizeOptions(existingStatuses)), existingStatuses,
        'existing custom states and their labels must survive normalization');
    const legacyStatuses = [...plain(statusDefaults).filter(item => item.id !== 'in_progress'),
        { id: 'blocked', name: '阻塞', color: '#F44336', marker: ' ' },
        { id: 'review', name: '待审核', color: '#FF9800', marker: ' ' }]
        .map(({ id, name, ...item }) => ({ value: id, label: id === 'cancelled' ? '已取消' : name, ...item }));
    assert.deepEqual(Array.from(context.__tmTaskStatusRules.normalizeOptions(legacyStatuses), item => item.id),
        ['todo', 'in_progress', 'done', 'cancelled', 'blocked', 'review'], 'legacy value/label states must not be lost');

    const open = task('open');
    const done = task('done', { done: true, taskCompleteAt: '2026-10-29 10:00' });
    const cancelled = task('cancelled', { taskMarker: '-' });
    assert.deepEqual(ids(filter('未完成', [open, done, cancelled])), ['open']);
    const completedRule = { conditions: [{ field: 'done', operator: '=', value: true }], sort: [{ field: 'taskCompleteAt', order: 'desc' }] };
    assert.deepEqual(ids(manager.applyRuleFilter([open, done, cancelled], completedRule)), ['done']);
    assert.deepEqual(ids(filter('未安排', [open, task('scheduled', { startDate: '2026-11-01' }), done, cancelled,
        task('checkin', { checkin: true, plannedDay: '2026-10-30' })])), ['open']);

    const dated = [
        task('yesterday', { completionTime: '2026-10-28' }),
        task('today', { completionTime: '2026-10-29' }),
        task('late', { completionTime: '2026-10-29 11:59' }),
        task('now', { completionTime: '2026-10-29 12:00' }),
        task('later', { completionTime: '2026-10-29 13:00' }),
        task('tomorrow', { completionTime: '2026-10-30' }),
        task('seventh', { startDate: '2026-11-05' }),
        task('eighth', { completionTime: '2026-11-06' }),
        task('spanning', { startDate: '2026-10-28', completionTime: '2026-10-30' }),
        task('checkin', { checkin: true, plannedDay: '2026-10-29', completionTime: '2026-09-01' }),
        task('done-old', { completionTime: '2026-10-28', done: true }),
        task('cancelled-old', { completionTime: '2026-10-28', taskMarker: '-' }),
        open,
    ];
    assert.deepEqual(ids(filter('已逾期', dated)), ['yesterday', 'late']);
    assert.deepEqual(ids(filter('今日', dated)), ['today', 'late', 'now', 'later', 'spanning', 'checkin']);
    assert.deepEqual(ids(filter('未来七天', dated)), ['tomorrow', 'seventh', 'spanning']);
    assert.deepEqual(ids(filter('已逾期', [task('numeric-date', { completionTime: '20261029' }),
        task('numeric-time', { completionTime: '20261029115900' })])), ['numeric-time']);

    for (const order of ['asc', 'desc']) {
        const sorted = manager.applyRuleSort([
            task('old', { completionTime: '2026-10-28' }), task('empty'),
            task('new', { completionTime: '2026-10-30' }), task('pinned', { pinned: true }),
        ], { sort: [{ field: 'completionTime', order }] });
        assert.deepEqual(ids(sorted), order === 'asc' ? ['pinned', 'old', 'new', 'empty'] : ['pinned', 'new', 'old', 'empty']);
    }
    const pending = fresh.find(rule => rule.id === 'default_todo');
    const pendingTasks = [task('later', { priority: 'high', completionTime: '2026-11-01', updated: '2026-10-29' }),
        task('sooner', { priority: 'high', completionTime: '2026-10-30', updated: '2026-10-01' }),
        task('low', { priority: 'low', completionTime: '2026-10-29' })];
    assert.deepEqual(ids(manager.applyRuleSort(pendingTasks, pending)), ['sooner', 'later', 'low']);
    pendingTasks[0].updated = '2099-01-01';
    assert.deepEqual(ids(manager.applyRuleSort(pendingTasks, pending)), ['sooner', 'later', 'low']);
    const completed = completedRule;
    assert.deepEqual(ids(manager.applyRuleSort([task('old', { taskCompleteAt: '2026-10-28' }),
        task('empty'), done], completed)), ['done', 'old', 'empty']);
    settings.data.filterRules = fresh;
    state.currentRule = pending.id;
    const inherited = manager.createRule('只改筛选');
    assert.deepEqual(plain(inherited.sort), plain(pending.sort));
    inherited.sort[0].order = 'asc';
    assert.equal(pending.sort[0].order, 'desc', 'new rules must not share mutable sort objects');
    state.currentRule = null;
    assert.deepEqual(plain(manager.createRule('文档顺序').sort), []);

    const week = manager.buildConditionRuntime({ field: 'completionTime', operator: 'range_week' }, { nowDate });
    assert.equal(new Date(week.timeRuntime.startTs).getDay(), 1);
    settings.data.calendarFirstDay = 0;
    assert.equal(new Date(manager.buildConditionRuntime({ field: 'completionTime', operator: 'range_week' }, { nowDate }).timeRuntime.startTs).getDay(), 0);
    assert.equal(manager.getFieldInfo('priority').label, '重要性');
    assert.equal(manager.getFieldInfo('priorityScore').label, '优先级分值');

    const custom = { id: 'custom-all', name: '所有任务', conditions: [{ field: 'done', operator: '=', value: false }], sort: [] };
    settings.data.filterRulesDefaultsVersion = 0;
    settings.data.filterRules = [
        { id: 'default_all', name: '所有任务', conditions: [], sort: [] },
        { id: 'default_todo', name: '待办任务', enabled: true, conditions: [{ field: 'done', operator: '=', value: false }],
            sort: [{ field: 'priority', order: 'desc' }, { field: 'updated', order: 'desc' }] },
        { id: 'default_today', name: '今日任务', enabled: true, conditions: [{ field: 'done', operator: '=', value: false },
            { field: 'completionTime', operator: 'range_today', value: '' }],
            sort: [{ field: 'priority', order: 'desc' }, { field: 'completionTime', order: 'asc' }] },
        { id: 'high_priority', conditions: [], sort: [] }, custom,
    ];
    settings.data.currentRule = 'default_all';
    state.currentRule = 'high_priority';
    settings.data.viewProfiles = { global: { ruleId: 'default_all' }, docs: { doc: { ruleId: 'high_priority' } } };
    settings.data.shortcutItems = [{ ruleId: 'default_all' }, { ruleId: custom.id }];
    settings.data.taskCountBadge = { ruleId: 'default_all', enabled: true };
    state.filterRules = settings.data.filterRules;
    const migrated = await context.__tmEnsureFilterRulesLoaded();
    assert.deepEqual(Array.from(migrated, rule => rule.id), ['default_todo', 'default_today', custom.id],
        'existing rule lists must not gain newly introduced defaults');
    assert.strictEqual(migrated[2], custom, 'same-named user rules must survive');
    assert.equal(migrated[0].name, '待办任务');
    assert.equal(migrated[0].sort[1].field, 'updated', 'existing sorting choices must be preserved');
    assert.equal(migrated[1].name, '今日任务');
    assert.equal(settings.data.currentRule, null);
    assert.equal(state.currentRule, null);
    assert.equal(settings.data.viewProfiles.docs.doc.ruleId, null);
    assert.equal(settings.data.shortcutItems[1].ruleId, custom.id);
    assert.equal(settings.data.taskCountBadge.ruleId, null);
    const savesAfterMigration = saves;
    await manager.initRules();
    assert.equal(saves, savesAfterMigration, 'migration must not keep writing on every load');
    const customizedBuiltin = { id: 'default_today', name: '自定今日', conditions: [{ field: 'completionTime', operator: 'before_today' }], sort: [{ field: 'updated', order: 'desc' }] };
    settings.data.filterRules = [customizedBuiltin];
    settings.data.filterRulesDefaultsVersion = 0;
    assert.strictEqual((await manager.initRules())[0], customizedBuiltin);
    assert.equal(settings.data.filterRules.length, 1, 'upgrading an existing custom rule list must not add presets');

    const localVersionLine = stores.split('\n').find(line => line.includes("this.data.filterRulesDefaultsVersion = Number(Storage.get('tm_filter_rules_defaults_version'"));
    vm.runInContext(`function readLocalRuleVersion() { ${localVersionLine} }`, context);
    persisted.clear();
    context.readLocalRuleVersion.call(settings);
    assert.equal(settings.data.filterRulesDefaultsVersion, 0, 'a new installation is eligible for initial presets');
    persisted.set('tm_filter_rules', []);
    context.readLocalRuleVersion.call(settings);
    assert.equal(settings.data.filterRulesDefaultsVersion, 1, 'legacy empty lists count as existing configuration');
    settings.data.filterRules = [];
    assert.deepEqual(plain(await manager.initRules()), [], 'an existing empty configuration must remain empty after upgrade');

    await manager.saveRules([]);
    persisted.set('tm_filter_rules', fresh);
    assert.deepEqual(plain(await manager.initRules()), [], 'saved empty lists must not refill or fall back to stale storage');
    state.filterRules = fresh;
    assert.deepEqual(plain(await context.__tmEnsureFilterRulesLoaded()), [], 'cached runtime lists must not resurrect cleared rules');
    state.filterRules = [custom];
    settings.data.filterRules = [custom];
    await context.window.tmRestoreRecommendedRules();
    assert.deepEqual(Array.from(state.filterRules, rule => rule.name), ['未完成', '今日', '已逾期', '未来七天', '未安排', '所有任务']);
    assert.strictEqual(state.filterRules.at(-1), custom);
    const restored = state.filterRules;
    const originalSave = settings.save;
    settings.save = async () => { throw new Error('disk failure'); };
    await assert.rejects(manager.saveRules([]), /disk failure/);
    assert.strictEqual(settings.data.filterRules, restored, 'a failed save must preserve the last rule list');
    settings.save = originalSave;
    assert.deepEqual(ids(manager.applyRuleFilter([open, done], { ...custom, id: 'default_all' })), ['open'],
        'legacy IDs must never bypass edited conditions');
    assert.equal(context.__tmNormalizeRuleIdValue('default_all'), null);
    assert.equal(context.__tmNormalizeRuleIdValue('high_priority'), null);
    console.log('filter defaults, six flat entries, date boundaries, stable sorting and first-use-only initialization tests passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
