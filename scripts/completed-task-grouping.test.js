'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
const read = (file) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', file), 'utf8');
const section = (source, start, end) => {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, start);
    return source.slice(a, b);
};
const stores = read('10-stores-rules-and-cache.js');
const services = read('20-api-and-runtime-services.js');
const completed = read('task-runtime/51-whiteboard-and-link-runtime.js');
const foundation = read('30-dialogs-and-ui-foundation.js');
const context = vm.createContext({
    Map, Set, state: { activeDocId: 'all', taskTree: [{ id: 'a', name: '文档 A' }, { id: 'b', name: '文档 B' }] },
    SettingsStore: { data: { taskHeadingLevel: 'h2', currentGroupId: 'all' } },
    __tmNormalizeHeadingText: (value) => String(value || '').trim(),
    __tmNormalizeHeadingLevel: (value) => value,
    __tmCompareTasksByDocFlow: (a, b) => (a.h2Rank ?? 999) - (b.h2Rank ?? 999),
    __tmNormalizeDateOnly: (value) => value instanceof Date
        ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
        : String(value || '').slice(0, 10),
    __tmGetTaskCompletedAtDateKey: (task) => String(task.taskCompleteAt || '').slice(0, 10),
    __tmResolveTaskCompletedAtRaw: (task) => task.taskCompleteAt || '',
    __tmParseTimeToTs: (value) => Date.parse(value),
    __tmIsDocTabCustomGroupActiveId: (value) => String(value).startsWith('tabs:'),
    __tmSortDocEntriesForTabs: (docs) => docs,
});
vm.runInContext([
    read('09-task-field-schema.js'), read('34-task-projection-engine.js'),
    section(stores, '    function __tmNormalizeCompletedTasksGroupBy(', '    function __tmGetTaskSnapshotRuleForView('),
    section(services, '    function __tmGetDocHeadingBucket(', '    function __tmTaskHasResolvedHeading('),
    section(services, '    function __tmBuildDocHeadingBuckets(', '    let __tmKanbanColsHtmlCache'),
    section(completed, '    function __tmGetTaskDoneSortTs(', '    function __tmShouldShowTaskInCompletedRootGroup('),
    section(completed, '    function __tmBuildCompletedTaskGroups(', '    function __tmBuildTaskRowModelCacheMeta('),
].join('\n'), context);
const plain = (value) => JSON.parse(JSON.stringify(value));
const tasks = [
    { id: 'old', root_id: 'a', h2Id: 'a-head', h2: '开发', h2Rank: 0, content: '同名任务', taskCompleteAt: '2026-10-10 09:00' },
    { id: 'new', root_id: 'a', h2Id: 'a-head', h2: '开发', h2Rank: 0, content: '另一个任务', taskCompleteAt: '2026-10-10 18:00' },
    { id: 'b-task', root_id: 'b', h2Id: 'b-head', h2: '开发', h2Rank: 0, content: '同名任务', taskCompleteAt: '2026-10-11 12:00' },
    { id: 'unknown-date', root_id: 'a', h2: '', content: '__none__', taskCompleteAt: '' },
];
const original = JSON.stringify(tasks);
const build = (input = tasks) => context.__tmBuildCompletedTaskGroups(input, { parentKey: 'completed_root_tasks::test' });
for (const raw of [undefined, null, '', 'none', 'day', 'unexpected', 'date']) {
    assert.equal(context.__tmNormalizeCompletedTasksGroupBy(raw), 'date');
}
const defaultDate = plain(build());
assert.deepEqual(defaultDate.map((g) => g.kind), ['done-date', 'done-date', 'done-date']);
assert.deepEqual(defaultDate.map((g) => g.items.map((t) => t.id)), [['b-task'], ['new', 'old'], ['unknown-date']]);
assert.equal(defaultDate.at(-1).label, '无完成日期');
assert.ok(defaultDate.every((g) => !g.key.startsWith('completed_root_tasks')), 'subgroups use ordinary collapse state');
context.SettingsStore.data.completedTasksGroupBy = 'title';
const titles = plain(build());
assert.deepEqual(titles.map((g) => g.docId), ['a', 'b']);
assert.deepEqual(titles[0].groups[0].items.map((t) => t.id), ['new', 'old']);
assert.equal(titles[0].groups[0].label, '开发');
assert.equal(titles[1].groups[0].label, '开发');
assert.notEqual(titles[0].groups[0].key, titles[1].groups[0].key, 'same heading labels in different documents stay separate');
assert.ok(titles.every((doc) => doc.groups.every((g) => !g.groups)), 'headings contain task trees directly');
const titleBaseline = JSON.stringify(titles);
for (const flag of ['groupByDocName', 'groupByTime', 'groupByTaskName', 'quadrantEnabled']) {
    context.state[flag] = true;
    assert.equal(JSON.stringify(plain(build())), titleBaseline, `${flag} must not alter completed grouping`);
    delete context.state[flag];
}
context.state.activeDocId = 'a';
assert.deepEqual(plain(build(tasks.filter((t) => t.root_id === 'a'))).map((g) => g.kind), ['done-h2', 'done-h2']);
context.state.activeDocId = 'tabs:custom';
assert.equal(build()[0].kind, 'done-doc');
assert.equal(JSON.stringify(tasks), original, 'grouping does not mutate tasks, their dates or placement');
const engine = context.__tmTaskProjectionEngine;
assert.equal(engine.analyzePatch({ h2Id: 'new-heading' }, { groupMode: 'none', completedTasksGroupBy: 'title' }).group, true,
    'heading changes must refresh completed groups even with no main grouping');
assert.equal(engine.analyzePatch({ taskCompleteAt: '2026-10-12 09:00' }, { groupMode: 'none', completedTasksGroupBy: 'date' }).group, true,
    'completion-date changes must refresh completed date groups');

let projected = {};
const archiveContext = vm.createContext({
    Map, Set, SettingsStore: { data: { currentGroupId: 'all', docTabsManualArchiveOnly: false } },
    __tmTaskStore: { getFlatMap: () => projected },
    __tmIsTaskDoneEffective: (task) => task.done === true,
    __tmIsDocManuallyArchivedInGroup: () => false,
    __tmIsDocManuallyUnarchivedInGroup: () => false,
});
vm.runInContext(section(foundation, '    function __tmGetDocTaskStateForTabs(', '    function __tmShouldIncludeDocInActiveAggregateTaskScope('), archiveContext);
const doc = { id: 'a', tasks: [{ id: 'parent', done: true, children: [{ id: 'child', done: false, children: [{ id: 'leaf', done: false }] }] }] };
const docBefore = JSON.stringify(doc);
const parent = { id: 'parent', root_id: 'a', done: true };
const child = { id: 'child', root_id: 'a', done: false, parentTaskId: 'parent' };
const leaf = { id: 'leaf', root_id: 'a', done: false, parent_task_id: 'child' };
projected = { parent, child, leaf };
for (const mode of ['date', 'title']) {
    archiveContext.SettingsStore.data.completedTasksGroupBy = mode;
    assert.equal(archiveContext.__tmDocShouldShowInDocTabs(doc, { archiveMode: false }), false);
    assert.equal(archiveContext.__tmDocShouldShowInDocTabs(doc, { archiveMode: true }), true);
    assert.equal(archiveContext.__tmGetDocTaskStateForTabs(doc).hasUndone, false);
}
projected.parent = { ...parent, done: false };
assert.equal(archiveContext.__tmGetDocTaskStateForTabs(doc).hasUndone, true, 'reopened projected parent overrides stale tree');
projected = { parent, child: { ...child, parentTaskId: '' }, leaf };
assert.equal(archiveContext.__tmGetDocTaskStateForTabs(doc).hasUndone, true, 'detached child becomes independently active');
projected = { parent, child: { id: 'child', root_id: 'a', done: false }, leaf };
assert.equal(archiveContext.__tmGetDocTaskStateForTabs(doc).hasUndone, false, 'legacy mirrors retain nested ancestry');
projected.extra = { id: 'extra', root_id: 'a', done: false };
assert.equal(archiveContext.__tmGetDocTaskStateForTabs(doc).hasUndone, true, 'a new independent task keeps the document active');
projected = { child, leaf };
assert.equal(archiveContext.__tmGetDocTaskStateForTabs(doc).hasUndone, true, 'an unavailable parent must not hide an active child');
projected = {};
assert.equal(archiveContext.__tmGetDocTaskStateForTabs(doc).hasUndone, false, 'tree-only documents keep ancestor completion semantics');
assert.equal(JSON.stringify(doc), docBefore);
console.log('completed grouping and parent-aware document archive tests passed');
