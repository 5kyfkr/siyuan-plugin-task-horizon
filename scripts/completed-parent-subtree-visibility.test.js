'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const source = read('30-dialogs-and-ui-foundation.js');
const start = source.indexOf('    function applyFilters()');
const end = source.indexOf('    function __tmIsTaskAndDescDone(', start);
assert.ok(start >= 0 && end > start);

function createHarness() {
    const flatTasks = {};
    const task = (id, done = false, children = []) => {
        const value = { id, content: id, done, root_id: 'doc', children };
        children.forEach((child) => { child.parentTaskId = id; });
        flatTasks[id] = value;
        return value;
    };
    const tasks = [
        task('323232', false, [
            task('122121', true, [
                task('2121212'),
                task('b1', true, [task('12121212')]),
            ]),
            task('visible-child'),
        ]),
        task('232'),
        task('done-root', true, [task('active-middle', false, [task('active-leaf')])]),
    ];
    const state = {
        activeDocId: 'all',
        taskTree: [{ id: 'doc', tasks }],
        flatTasks,
        otherBlocks: [],
        showCompletedTasks: false,
        groupByDocName: true,
        searchKeyword: '',
    };
    let rule = { conditions: [] };
    const context = vm.createContext({
        Map, Set, state,
        SettingsStore: { data: { currentGroupId: 'all' } },
        window: { dispatchEvent() {} },
        CustomEvent: class {},
        __tmTaskStore: { revision: () => 0, getFlatMap: () => flatTasks },
        __tmGetCurrentRule: () => rule,
        __tmGetArchiveModeFilterRule: (value) => value,
        __tmRuleUsesCustomOrderSort: () => false,
        __tmIsOtherBlockTabId: () => false,
        __tmParseDocTabCustomGroupActiveId: (id) => id === 'group' ? 'group' : '',
        __tmSortDocEntriesForTabs: (docs) => docs,
        __tmGetDocTabCustomGroupDocIdSet: () => new Set(['doc']),
        __tmFindDocTabCustomGroupById: () => ({}),
        __tmGetDocTabCustomGroupRegionState: () => ({}),
        __tmShouldShowDocTabCustomGroupInRegion: () => true,
        __tmGetActiveDocTabCustomGroupDocIdSet: (id) => new Set(id === 'group' ? ['doc'] : []),
        __tmShouldIncludeDocInActiveAggregateTaskScope: () => true,
        __tmIsTaskDoneEffective: (value) => value.effectiveDone ?? value.done === true,
        __tmIsTaskCanceled: (value) => value.taskMarker === '-',
        __tmRuleIncludesCanceledStatus: (value) => value.includeCanceled === true,
        __tmRuleHasExplicitSort: () => false,
        __tmIsAllRuleLike: (value) => !value.conditions.length,
        __tmHasActiveDocTabContentFilter: () => true,
        __tmRuleUsesDocFlowSort: () => true,
        __tmTaskMatchesSearch: (value, keyword) => value.content.includes(keyword),
        __tmDocShouldShowInDocTabs: () => true,
        __tmIsCollectedOtherBlockTask: () => false,
        __tmApplyWhiteboardSequenceFilter: (values) => values,
        __tmUpdateFilteredTaskRenderWindowState() {},
        RuleManager: {
            applyRuleFilter: (values) => values.filter((value) => rule.matchIds.includes(value.id)),
            applyRuleSort: (values) => values,
        },
    });
    vm.runInContext(read('34-task-projection-engine.js'), context);
    vm.runInContext(source.slice(start, end), context);
    return {
        state, flatTasks, context,
        setRule(value) { rule = value; },
        visible() {
            context.applyFilters();
            return Array.from(state.filteredTasks, (value) => value.id);
        },
    };
}

for (const scope of ['all', 'doc', 'group']) {
    const harness = createHarness();
    const { state, flatTasks } = harness;
    state.activeDocId = scope;
    const visible = ['323232', 'visible-child', '232'];
    assert.deepEqual(harness.visible(), visible,
        `${scope}: completed parents must hide their whole subtree, including unfinished descendants`);
    assert.deepEqual(Array.from(state.filteredDocIdsForTabs), ['doc']);

    state.showCompletedTasks = true;
    const all = ['323232', '122121', '2121212', 'b1', '12121212', 'visible-child', '232', 'done-root', 'active-middle', 'active-leaf'];
    assert.deepEqual(harness.visible(), all, `${scope}: enabling completion visibility must restore the full tree`);
    state.showCompletedTasks = false;
    assert.deepEqual(harness.visible(), visible, `${scope}: toggling off again must remove the same subtrees`);

    state.searchKeyword = '2121212';
    assert.deepEqual(harness.visible(), [], `${scope}: searching for hidden descendants must not resurrect them or their ancestors`);
    assert.deepEqual(Array.from(state.filteredDocIdsForTabs), []);
    state.searchKeyword = '323232';
    assert.deepEqual(harness.visible(), scope === 'all' ? ['323232'] : ['323232', 'visible-child'],
        `${scope}: matching a parent must not reintroduce a hidden completed branch during tree expansion`);
    state.searchKeyword = '';

    harness.setRule({ conditions: [{ field: 'priority' }], matchIds: ['323232', '2121212'] });
    assert.deepEqual(harness.visible(), scope === 'all' ? ['323232'] : ['323232', 'visible-child'],
        `${scope}: rule filtering must preserve the completion boundary`);
    harness.setRule({ conditions: [] });

    flatTasks['122121'].done = false;
    assert.deepEqual(harness.visible(), ['323232', '122121', '2121212', 'visible-child', '232'],
        `${scope}: reopening a parent restores its active children but still hides a completed nested branch`);
    flatTasks['done-root'].done = false;
    assert.deepEqual(harness.visible(), ['323232', '122121', '2121212', 'visible-child', '232', 'done-root', 'active-middle', 'active-leaf']);
    flatTasks['122121'].effectiveDone = true;
    assert.deepEqual(harness.visible(), ['323232', 'visible-child', '232', 'done-root', 'active-middle', 'active-leaf'],
        `${scope}: ancestor completion must use the effective status resolver`);

    assert.equal(flatTasks['2121212'].done, false, 'visibility must not change descendant completion');
    assert.equal(flatTasks['2121212'].parentTaskId, '122121', 'visibility must not reparent descendants');
}

const canceled = createHarness();
canceled.flatTasks['122121'].done = false;
canceled.flatTasks['122121'].taskMarker = '-';
assert.deepEqual(canceled.visible(), ['323232', 'visible-child', '232'], 'a hidden canceled parent must also hide its subtree');
canceled.setRule({ conditions: [], includeCanceled: true });
assert.deepEqual(canceled.visible(), ['323232', 'visible-child', '232'],
    'a canceled-status rule must not bypass the closed-task visibility toggle');
canceled.state.showCompletedTasks = true;
assert.ok(canceled.visible().includes('122121'), 'enabling completion visibility must restore canceled tasks');
canceled.state.showCompletedTasks = false;
canceled.setRule({ conditions: [{ field: 'done', operator: '=', value: '__all__' }],
    includeCanceled: true, matchIds: ['122121', '2121212', '232'] });
assert.deepEqual(canceled.visible(), ['232'], 'all-status rules must still honor cancellation visibility');
for (const mode of ['list', 'checklist', 'timeline', 'kanban', 'whiteboard']) {
    const harness = createHarness();
    harness.state.viewMode = mode;
    harness.flatTasks['232'].taskMarker = '-';
    harness.flatTasks['122121'].done = false;
    harness.flatTasks['122121'].taskMarker = '-';
    harness.setRule({ conditions: [], includeCanceled: true });
    assert.deepEqual(harness.visible(), ['323232', 'visible-child'],
        `${mode}: hiding completed tasks must hide canceled roots and their descendants`);
    harness.state.showCompletedTasks = true;
    assert.ok(harness.visible().includes('232'), `${mode}: show-completed must restore canceled roots`);
    assert.ok(harness.visible().includes('2121212'), `${mode}: show-completed must restore canceled subtrees`);
    assert.equal(harness.flatTasks['232'].done, false, 'cancellation must remain distinct from successful completion');
}

for (const condition of [
    { field: 'done', operator: '=', value: true },
    { field: 'done', operator: '=', value: '__all__' },
]) {
    const explicitRule = createHarness();
    explicitRule.setRule({ conditions: [condition], matchIds: ['122121', '2121212'] });
    assert.deepEqual(explicitRule.visible(), ['323232', '122121', '2121212'],
        'rules explicitly requesting completed/all statuses must retain their existing override');
}

const aliases = createHarness();
aliases.flatTasks['2121212'].parent_task_id = '122121';
delete aliases.flatTasks['2121212'].parentTaskId;
assert.deepEqual(aliases.visible(), ['323232', 'visible-child', '232'], 'legacy parent identifiers must respect the same ancestor filter');

const orphan = createHarness();
orphan.flatTasks['232'].parentTaskId = 'unloaded-parent';
assert.ok(orphan.visible().includes('232'), 'an unavailable ancestor must not hide an otherwise visible task');

console.log('completed parent subtree visibility tests passed');

async function checkManualProjectPriority() {
    for (const scope of ['all', 'doc', 'group']) {
        const h = createHarness();
        h.state.activeDocId = scope;
        h.state.showCompletedTasks = true;
        h.flatTasks['323232'].h2Id = 'visible-heading';
        h.flatTasks['122121'].h2Id = 'closed-heading';
        const original = JSON.stringify(h.flatTasks);
        let saved = { completedProjects: { 'heading:closed-heading': true } };
        h.context.__tmHost = {
            async loadData() { return saved; },
            async saveData(_key, value) { saved = JSON.parse(JSON.stringify(value)); return true; },
        };
        vm.runInContext(read('37-project-visibility-service.js'), h.context);
        const service = h.context.__tmProjectVisibility;
        await service.load();
        const hiddenIds = ['122121', '2121212', 'b1', '12121212'];
        for (const archive of [false, true]) {
            h.state.docTabsArchiveMode = archive;
            for (const condition of [null, { field: 'done', operator: '=', value: '__all__' }, { field: 'done', operator: '=', value: true }]) {
                h.setRule(condition ? { conditions: [condition], matchIds: Object.keys(h.flatTasks) } : { conditions: [] });
                const visible = h.visible();
                assert.ok(hiddenIds.every((id) => !visible.includes(id)), scope + ': manual project hiding overrides completion, archive and all-status rules');
                assert.ok(visible.includes('232'), 'other headings remain visible');
            }
        }
        h.state.searchKeyword = '323232';
        assert.ok(hiddenIds.every((id) => !h.visible().includes(id)), 'matching a parent cannot reintroduce a hidden heading subtree');
        h.state.searchKeyword = '';
        await service.setCompleted('heading', 'closed-heading', false);
        assert.ok(h.visible().includes('2121212'), 'unmarking restores the original descendants');
        await service.setCompleted('doc', 'doc', true);
        assert.deepEqual(h.visible(), [], scope + ': document completion hides every task even with all statuses visible');
        await service.setCompleted('doc', 'doc', false);
        assert.ok(h.visible().includes('2121212'));
        assert.equal(JSON.stringify(h.flatTasks), original, 'project hiding must not write task state');
    }
    console.log('manual project visibility priority tests passed');
}
checkManualProjectPriority().catch((error) => { console.error(error); process.exitCode = 1; });
