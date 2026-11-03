'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('./i18n-vm-fixture');
const read = (file) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', file), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const helpers = read('render/40-render-list-context-helpers.js');
const foundation = read('30-dialogs-and-ui-foundation.js');
const rules = () => [
    { id: 'urgent-important', name: '重要紧急', importance: ['medium', 'high'], timeRanges: ['overdue', 'within7days'] },
    { id: 'not-urgent-important', name: '重要不紧急', importance: ['medium', 'high'], timeRanges: ['beyond7days', 'nodate'] },
    { id: 'urgent-not-important', name: '不重要紧急', importance: ['none', 'low'], timeRanges: ['overdue', 'within7days'] },
    { id: 'not-urgent-not-important', name: '不重要不紧急', importance: ['none', 'low'], timeRanges: ['beyond7days', 'nodate'] },
];
class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 10, 3, 12])); }
}
function date(days) {
    const value = new FixedDate();
    value.setDate(value.getDate() + days);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
function fixture() {
    const tasks = {}, writes = [], hints = [];
    const context = vm.createContext({
        Date: FixedDate, Map, Set,
        SettingsStore: { data: { quadrantConfig: { rules: rules() } } },
        state: { quadrantEnabled: true },
        __tmIsCheckinTask: (task) => !!task?.checkin,
        __tmGetTaskCheckinCurrentDate: (task) => task.checkinDate,
        __tmNormalizeDateOnly: (value) => typeof value === 'string' ? value.slice(0, 10)
            : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
        __tmEnsureEditableTaskLike: (task) => !task.readonly,
        __tmTaskBoundary: { getTask: (id) => tasks[id] },
        __tmRequireTaskMutation: () => async (id, patch, options) => {
            writes.push({ id, patch: plain(patch), options: plain(options) });
            if (tasks[id].fail) throw new Error('storage unavailable');
            Object.assign(tasks[id], patch);
            return true;
        },
        hint: (message, kind) => hints.push({ message, kind }),
    });
    context.window = context;
    vm.runInContext(helpers
        + section(read('render/46-render-local-task-time-refresh.js'), 'const __TM_TASK_PRIORITY_NORMALIZE_MAP', 'function __tmBindTaskDateFollowUpdatedRefresh(')
        + section(read('40-render-runtime.js'), 'function __tmNormalizeTaskPriorityValue(', 'function __tmParseTaskLooseBoolean(')
        + section(foundation, 'function __tmResolveQuadrantGroupDropElementFromTarget(', 'function __tmResolveTimeGroupDropElementFromTarget('), context);
    return { context, tasks, writes, hints, rules: context.SettingsStore.data.quadrantConfig.rules };
}

test('cross-quadrant drops select the highest importance and the agreed deadline in all twelve directions', () => {
    const { context } = fixture();
    const input = [
        { priority: 'medium', completionTime: date(1) },
        { priority: 'medium', completionTime: date(20) },
        { priority: '', completionTime: date(-1) },
        { priority: '', completionTime: date(20) },
    ];
    for (let source = 0; source < 4; source++) {
        for (let target = 0; target < 4; target++) {
            const task = { ...input[source], startDate: date(-5) };
            const original = plain(task);
            const result = context.__tmBuildQuadrantDropPatch(task, rules()[target].id);
            if (source === target) {
                assert.equal(result.reason, 'noop');
            } else {
                assert.equal(result.ok, true, `${source} -> ${target}`);
                assert.deepEqual(plain(result.patch), { priority: target < 2 ? 'high' : 'low', completionTime: target % 2 ? '' : date(0) });
                assert.equal(context.__tmResolveQuadrantRule({ ...task, ...result.patch }).id, rules()[target].id);
            }
            assert.deepEqual(task, original, 'planning a drop never mutates its source');
        }
    }
});

test('non-urgent ranges use the nearest permitted future day unless no-date is selected', () => {
    const { context, rules: config } = fixture();
    const task = { priority: 'low', completionTime: date(0) };
    for (const days of [3, 7, 15, 30]) {
        config[0].timeRanges = [`within${days}days`];
        config[1].timeRanges = [`beyond${days}days`];
        assert.equal(context.__tmBuildQuadrantDropPatch(task, config[1].id).patch.completionTime, date(days + 1));
    }
    config[0].timeRanges = ['within3days'];
    config[1].timeRanges = ['beyond30days', 'beyond3days', 'beyond15days'];
    assert.equal(context.__tmBuildQuadrantDropPatch(task, config[1].id).patch.completionTime, date(4));
    config[1].timeRanges.push('nodate');
    assert.equal(context.__tmBuildQuadrantDropPatch(task, config[1].id).patch.completionTime, '');
    config[0].importance = ['low', 'medium'];
    assert.equal(context.__tmBuildQuadrantDropPatch({ priority: 'high', completionTime: date(20) }, config[0].id).patch.priority, 'medium');
    config[2].importance = ['none'];
    assert.equal(context.__tmBuildQuadrantDropPatch({ priority: 'high', completionTime: date(20) }, config[2].id).patch.priority, '');
});

test('range boundaries include today, exclude overdue from within, and never treat no-date as a future date', () => {
    const { context, rules: config } = fixture();
    const resolve = (deadline) => context.__tmResolveQuadrantRule({ priority: 'a', completionTime: deadline });
    for (const days of [1, 3, 7, 15, 30]) {
        config[0].timeRanges = [`within${days}days`];
        config[1].timeRanges = [`beyond${days}days`];
        assert.equal(resolve(date(0)).id, config[0].id);
        assert.equal(resolve(`${date(days)} 23:59`).id, config[0].id);
        assert.equal(resolve(date(days + 1)).id, config[1].id);
        assert.equal(resolve(date(-1)), null);
        assert.equal(resolve(''), null);
    }
    config[0].timeRanges = ['overdue'];
    config[1].timeRanges = ['nodate'];
    assert.equal(resolve(date(-1)).id, config[0].id);
    assert.equal(resolve('').id, config[1].id);
    assert.equal(context.__tmBuildQuadrantDropPatch({ priority: 'low', completionTime: date(0) }, config[0].id).reason, 'date');
});

test('check-in dates remain authoritative and conflicting rules cannot silently place a drop in a different quadrant', () => {
    const { context, rules: config } = fixture();
    const task = { priority: 'high', checkin: true, checkinDate: date(0), completionTime: date(20) };
    assert.equal(context.__tmResolveQuadrantRule(task).id, config[0].id);
    assert.equal(context.__tmBuildQuadrantDropPatch(task, config[1].id).reason, 'checkin');
    config[1].timeRanges = ['within7days'];
    const result = context.__tmBuildQuadrantDropPatch({ priority: 'low', completionTime: date(0) }, config[1].id);
    assert.equal(result.reason, 'overlap');
    assert.equal(result.conflictingRule.id, config[0].id);
    const reverseOrderResult = context.__tmBuildQuadrantDropPatch(
        { priority: 'low', completionTime: date(20) },
        config[0].id,
    );
    assert.equal(reverseOrderResult.reason, 'overlap');
    assert.equal(reverseOrderResult.conflictingRule.id, config[1].id);
});

test('shared drop writes both fields once, preserves placement, skips same-quadrant and read-only tasks, and reports write failures', async () => {
    const { context, tasks, writes, hints } = fixture();
    Object.assign(tasks, {
        a: { priority: 'low', completionTime: date(0), parentTaskId: 'parent', root_id: 'doc', startDate: date(-1) },
        b: { priority: 'medium', completionTime: date(20) },
        c: { priority: 'low', completionTime: date(0), readonly: true },
        d: { priority: 'low', completionTime: date(0), fail: true },
    });
    assert.equal(await context.__tmApplyQuadrantDrop(['a', 'a', 'b', 'c', 'd'], 'not-urgent-important'), 1);
    assert.deepEqual(writes.map((write) => write.id), ['a', 'd']);
    assert.deepEqual(writes[0].patch, { priority: 'high', completionTime: '' });
    assert.equal(writes[0].options.persistSnapshot, true);
    assert.equal(writes[0].options.wait, true);
    assert.equal(tasks.a.startDate, date(-1));
    assert.equal(tasks.a.parentTaskId, 'parent');
    assert.equal(tasks.a.root_id, 'doc');
    assert.equal(tasks.b.priority, 'medium', 'same-quadrant drops keep the current importance');
    assert.equal(tasks.d.priority, 'low');
    assert.equal(hints.filter((hint) => hint.kind === 'error').length, 1);
    assert.deepEqual(hints.filter((hint) => hint.kind === 'success'), [{ message: '已移动至目标象限', kind: 'success' }]);
});

test('row model retains all four empty quadrant groups, including when no tasks match the current filter', () => {
    const { context } = fixture();
    Object.assign(context.state, { viewMode: 'checklist', filteredTasks: [], collapsedGroups: new Set(), collapsedTaskIds: new Set() });
    Object.assign(context, {
        __tmBuildTaskRowModelCacheMeta: () => ({ viewMode: 'checklist' }),
        __tmTaskRowModelCacheMatches: () => false,
        __tmRememberTaskRowModelCache: (rows) => rows,
        __tmGetAlwaysVisibleTaskDocHeadingTasks: () => [],
        __tmIsDarkMode: () => false,
        __tmNormalizeHexColor: (_color, fallback) => fallback,
        __tmGetFilteredTaskDerivedState: () => ({ rootTasks: [], filteredIdSet: new Set(), baseOrderMap: new Map(), docsInOrder: [], docEntryById: new Map(), filteredTasksByDoc: new Map(), docRootTasksByDoc: new Map() }),
        __tmBuildRuleSortContext: () => ({}),
        __tmHasCalendarSidebarChecklist: () => false,
        __tmSplitTasksByDoneState: (tasks) => ({ active: tasks, done: [] }),
        __tmCalcGroupDurationText: () => '',
        esc: (value) => String(value),
    });
    vm.runInContext(section(read('task-runtime/51-whiteboard-and-link-runtime.js'), 'function __tmBuildTaskRowModel(', 'function __tmResolveFirstVisibleTaskIdFromRowModel'), context);
    const rows = context.__tmBuildTaskRowModel();
    assert.deepEqual(plain(rows).map((row) => ({ kind: row.kind, key: row.key, count: row.count })), rules().map((rule) => ({ kind: 'quadrant', key: `quadrant_${rule.id}`, count: 0 })));
});
