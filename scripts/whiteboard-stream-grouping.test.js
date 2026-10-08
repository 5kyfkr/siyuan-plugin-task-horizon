'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (name) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', name), 'utf8');
const foundation = read('30-dialogs-and-ui-foundation.js');
const runtime = read('20-api-and-runtime-services.js');
const tasks = read('task-runtime/50-task-model-and-repeat-utils.js');
const projection = read('task-runtime/51-whiteboard-and-link-runtime.js');
const settings = read('settings/70-doc-group-and-settings-actions.js');
const whiteboard = read('render/44-render-whiteboard-body.js');
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing source boundary: ${start}`);
    return source.slice(from, to);
}

// Exercise production grouping, tree rendering, settings switches and disclosure.
// Host services and card decorations are the only stubs.
const harnessSource = `
const state = { viewMode: 'whiteboard', activeDocId: 'all', filteredTasks: [], taskTree: [], collapsedGroups: new Set(), expandedCompletedGroups: new Set() };
const SettingsStore = { data: { currentGroupId: 'all', pinTasksWithinGroups: true }, save: async () => {}, syncToLocal() {} };
const Storage = { set() {} };
const fixture = { state, SettingsStore, options: {}, html: '', selectedDocIds: null, taskCollapsed: new Set(), archivedDocIds: new Set(), refreshes: 0 };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const __tmNormalizeDateOnly = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return !value || isNaN(date.getTime()) ? '' : date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
};
const __tmNormalizeHexColor = (color, fallback) => color || fallback;
const __tmClamp = (value, min, max) => Math.min(max, Math.max(min, value));
const __tmWithAlpha = (color, alpha) => 'color-mix(in srgb, ' + color + ' ' + alpha * 100 + '%, transparent)';
const __tmGetTaskRepeatWeekdayLabel = (date) => ['周日','周一','周二','周三','周四','周五','周六'][date.getDay()];
const __tmIsCheckinTask = (task) => !!task?.checkin;
const __tmGetTaskCheckinCurrentDate = (task) => task.checkinDate;
const __tmIsTaskActive = (task) => !task.done && task.customStatus !== 'canceled';
const __tmIsTaskClosedForDisplay = (task) => !__tmIsTaskActive(task);
const __tmGetArchivedDocIdsForAllTabCompletedTailGroup = () => fixture.archivedDocIds;
const __tmResolveTaskCompletedAtRaw = (task) => task.completedAt;
const __tmIsTaskCompletedToday = (task) => __tmNormalizeDateOnly(task.completedAt) === __tmNormalizeDateOnly(new Date());
const __tmGetCompletedRootGroupScopeKey = () => 'group:' + SettingsStore.data.currentGroupId;
const __tmGetVisibleDocTabsForCurrentGroup = () => state.taskTree.filter((doc) => !doc.hidden);
const __tmGetWhiteboardAllTabsOrderedDocIds = (_groupId, ids) => ids;
const __tmGetAlwaysVisibleTaskDocHeadingTasks = () => [];
const __tmDocHasAnyHeading = (_docId, rows) => rows.some((task) => task.h2);
const __tmGetDocHeadingBucket = (task, fallback) => ({ key: task.h2 || fallback, label: task.h2 || fallback });
const __tmBuildDocHeadingBuckets = (rows, fallback) => Array.from(new Set(rows.map((task) => task.h2 || fallback)), (key) => ({ key, label: key }));
const __tmResolveHideCompletedDescendantsFlag = (task, inherited) => inherited || task.hideCompletedSubtasks === true;
const __tmShouldKeepChildTaskVisible = (task, child, inherited) => !__tmResolveHideCompletedDescendantsFlag(task, inherited) || !__tmIsTaskClosedForDisplay(child);
const __tmKanbanGetCollapsedSet = () => fixture.taskCollapsed;
const __tmIsTaskMultiSelected = () => false;
const __tmRenderCompletedTodayBadge = () => '';
const __tmBuildTooltipAttrs = (title) => ' title="' + esc(title) + '"';
const __tmBuildTaskTitleOpacityStyle = () => '';
const __tmRenderGlobalCollectDocTaskInlineIcon = () => '';
const __tmRenderRecurringTaskInlineIcon = () => '';
const __tmRenderRecurringInstanceBadge = () => '';
const __tmRenderTaskCheckboxWrap = (id, task, options) => '<input type="checkbox" aria-label="完成状态" data-task-id="' + esc(id) + '"' + (options.checked ? ' checked' : '') + ' onchange="' + options.onchange + '">';
const __tmRenderDocIcon = (_id, options) => '<span class="' + (options.className || '') + '">▤</span>';
const __tmGetDocColorHex = () => '#5e81ac';
const __tmParseCssColorToRgba = () => null;
const __tmRenderLucideIcon = () => '+';
const __tmLucideIconSvg = (_name, options) => '<svg class="' + options.className + '" width="' + options.size + '" height="' + options.size + '" viewBox="0 0 16 16" style="' + options.style + '"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const __tmRenderInlineIcon = () => '<span aria-hidden="true">◆</span>';
const API = { getTaskTitlePresentation: (_markdown, text) => ({ text }), renderTaskContentHtml: (_markdown, text) => esc(text) };
const __tmPersistGlobalViewProfileFromCurrentState = () => {};
const __tmRecomputeTaskProjection = () => {};
const __tmRefreshMainViewInPlace = () => { fixture.refreshes++; fixture.html = renderStream(fixture.options); globalThis.onRender?.(fixture.html); return true; };
const __tmHasCalendarSidebarChecklist = () => false;
const __tmMarkHighPriorityInteraction = () => {};
const __tmGetCollapseAnimMode = () => 'none';
const __tmResetFlipState = () => {};
const __tmMarkCollapseStateChanged = () => {};
const __tmUpdateToggleGlyphInDom = () => {};
const __tmApplyVisibilityFromState = () => false;
const __tmScheduleCollapseRerender = () => __tmRefreshMainViewInPlace();
${read('render/40-render-list-context-helpers.js')}
${read('09-task-field-schema.js')}
${read('34-task-projection-engine.js')}
${section(projection, 'function __tmGetCurrentProjectionRule()', 'function __tmDoesPatchAffectCurrentFilter(')}
${section(foundation, 'function __tmGetCurrentGroupModeValue()', 'function __tmFindRuleById(')}
${section(foundation, 'function __tmIsTaskPinned(', 'function __tmGetVisibleDocTabsForCurrentGroup(')}
${section(foundation, 'function __tmRenderToggleIcon(', 'function __tmRenderReminderIcon(')}
${section(tasks, 'function __tmParseTimeToTs(', 'function __tmShouldUseBestSubtaskTimeForSort(')}
${section(tasks, 'function __tmGetTaskTimePriorityInfo(', 'function __tmGetTaskEffectiveCompletionTimeInfo(')}
${section(projection, 'function __tmIsTaskDoneForTailGroup(', 'function __tmGetArchivedDocIdsForAllTabCompletedTailGroup(')}
${section(projection, 'function __tmShouldSeparateCompletedRootGroup(', 'function __tmBuildTaskRowModelCacheMeta(')}
${section(runtime, 'function __tmBuildCompletedRootGroupKey(', 'function __tmResetArchiveCompletedRootGroupCollapse(')}
${section(settings, 'function __tmRefreshSettingsProjectionView(', 'function __tmScheduleSettingsViewRefresh(')}
${section(settings, 'window.toggleGroupByTime =', 'window.tmToggleKanbanHeadingGroupMode =')}
${section(settings, 'window.tmToggleGroupCollapse =', 'window.tmToggleCollapse =')}
${section(whiteboard, 'function __tmBuildWhiteboardStreamGroupCards(', 'function __tmBuildRenderSceneWhiteboardBodyHtml(')}
function renderStream(options = {}) {
    const filtered = state.filteredTasks, alwaysVisibleHeadingTasks = __tmGetAlwaysVisibleTaskDocHeadingTasks();
    const isMobile = !!options.isMobile, isDark = !!options.isDark, bodyAnimClass = '';
    const currentGroupId = SettingsStore.data.currentGroupId;
    const docsInOrder0 = state.taskTree.map((doc) => doc.id);
    const selectedDocIds = fixture.selectedDocIds || __tmGetVisibleDocTabsForCurrentGroup().map((doc) => doc.id);
    const docNameById = new Map(state.taskTree.map((doc) => [doc.id, doc.name]));
    const enableDocH2Subgroup = SettingsStore.data.docH2SubgroupEnabled !== false;
    const noHeadingLabel = '无二级标题', todayKey = __tmNormalizeDateOnly(new Date());
    const escSq = (value) => String(value).replace(/'/g, "\\'");
    const allView = true, allTabsLayoutMode = 'stream';
    ${section(whiteboard, "if (allView && allTabsLayoutMode === 'stream')", 'const ensureNodePos =')}
}
fixture.render = renderStream;
fixture.load = (rows) => {
    const model = rows.map((row) => ({ root_id: 'doc1', content: row.id, children: [], ...row }));
    const byId = new Map(model.map((task) => [task.id, task]));
    model.forEach((task) => { if (byId.has(task.parentTaskId)) byId.get(task.parentTaskId).children.push(task); });
    state.filteredTasks = model;
    state.taskTree = Array.from(new Set(model.map((task) => task.root_id)), (id) => ({ id, name: id === 'doc1' ? '项目计划' : '个人事项' }));
};
fixture.date = (days) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + days); return __tmNormalizeDateOnly(date); };
globalThis.fixture = fixture;
`;

function cards(html) {
    return Array.from(html.matchAll(/<section class="tm-whiteboard-stream-doc[\s\S]*?<\/section>/g), ([value]) => value);
}
function taskIds(html) {
    return Array.from(html.matchAll(/class="tm-whiteboard-stream-task-node" data-task-id="([^"]+)"/g), (match) => match[1]);
}
function findCard(html, key) {
    const card = cards(html).find((value) => value.includes(`data-group-key="${key}"`));
    assert.ok(card, `missing card ${key}`);
    return card;
}

async function test() {
    const context = { innerWidth: 1200 }; context.window = context;
    vm.runInNewContext(harnessSource, context, { filename: 'whiteboard-stream-harness.js' });
    const { fixture } = context;
    const { state, SettingsStore: store } = fixture;
    const switchMode = async (mode) => { await context.tmSwitchGroupMode(mode); return fixture.html; };
    fixture.load([
        { id: 'root', content: '发布版本', completionTime: fixture.date(0), priority: 'a', h2: '研发' },
        { id: 'child', parentTaskId: 'root', completionTime: fixture.date(20), priority: 'c' },
        { id: 'today2', root_id: 'doc2', completionTime: fixture.date(0), priority: 'b' },
        { id: 'tomorrow', completionTime: fixture.date(1), priority: 'c' },
        { id: 'after', completionTime: fixture.date(2) },
        { id: 'days15', completionTime: fixture.date(15) },
        { id: 'farther', completionTime: fixture.date(16) },
        { id: 'overdue', completionTime: fixture.date(-3) },
        { id: 'pending' },
        { id: 'pinned', pinned: true, completionTime: fixture.date(0) },
        { id: 'pinchild', parentTaskId: 'pinned', completionTime: fixture.date(10) },
        { id: 'doneOld', done: true, completionTime: fixture.date(0), completedAt: fixture.date(-1) },
        { id: 'doneNew', done: true, completionTime: fixture.date(0), completedAt: new Date().toISOString() },
        { id: 'doneChild', parentTaskId: 'doneNew', done: true, completionTime: fixture.date(5) },
        { id: 'canceled', customStatus: 'canceled', completionTime: fixture.date(0) },
    ]);
    const noneHtml = await switchMode('none');
    assert.equal(cards(noneHtml).length, 2);
    assert.match(noneHtml, /tmWhiteboardAllTabsDocDragStart/);
    assert.match(noneHtml, /tmQuickAddOpenForDoc/);
    assert.match(noneHtml, /wb_stream_h2_doc1_研发/);
    assert.equal(await switchMode('doc'), noneHtml, 'none retains the same document cards and headings');

    let html = await switchMode('time');
    const todayKey = 'wb_stream_time_all_group_today';
    const todayCard = findCard(html, todayKey);
    assert.deepEqual(taskIds(todayCard), ['pinned', 'pinchild', 'root', 'child', 'today2']);
    assert.match(todayCard, /tm-badge--count">6<\/span>/, 'group count measures roots, including closed roots');
    assert.match(todayCard, /tm-time-group-weekday-chip/);
    assert.equal(cards(html).length, 7, 'children do not create extra time cards');
    assert.match(html, /已过期[\s\S]*今天/);
    assert.match(html, /group_days_15/);
    assert.doesNotMatch(html, /tmWhiteboardAllTabsDocDragStart|tmQuickAddOpenForDoc|wb_stream_h2_/);
    assert.equal(taskIds(html).length, new Set(taskIds(html)).size, 'tasks render once');
    assert.match(todayCard, /打开文档：个人事项/);
    assert.match(html, /tm-whiteboard-stream-task-doc/);

    const collapseEvent = { preventDefault() {}, stopPropagation() {} };
    await context.tmToggleGroupCollapse(todayKey, collapseEvent);
    assert.deepEqual(taskIds(findCard(fixture.html, todayKey)), []);
    assert.match(findCard(fixture.html, todayKey), /aria-expanded="false"/);
    assert.match(findCard(fixture.html, todayKey), /tm-whiteboard-stream-doc-list" hidden/);
    await switchMode('quadrant');
    await switchMode('time');
    assert.match(findCard(fixture.html, todayKey), /aria-expanded="false"/, 'mode switch preserves collapse');
    await context.tmToggleGroupCollapse(todayKey, collapseEvent);
    const doneKey = 'completed_root_tasks::group:all::whiteboard-stream:' + todayKey;
    await context.tmToggleGroupCollapse(doneKey, collapseEvent);
    assert.deepEqual(taskIds(findCard(fixture.html, todayKey)).slice(-4), ['doneNew', 'doneChild', 'doneOld', 'canceled']);
    store.data.completedTasksTodayOnly = true;
    assert.ok(!taskIds(fixture.render()).includes('doneOld'));
    delete store.data.completedTasksTodayOnly;
    store.data.completedTasksInlineInGroups = true;
    assert.doesNotMatch(fixture.render(), /tm-whiteboard-stream-heading--done/);
    delete store.data.completedTasksInlineInGroups;
    fixture.archivedDocIds.add('doc1');
    assert.ok(!taskIds(fixture.render()).includes('doneNew'), 'archived completed roots stay hidden');
    fixture.archivedDocIds.clear();

    store.data.pinTasksWithinGroups = false;
    html = fixture.render();
    assert.deepEqual(taskIds(findCard(html, 'wb_stream_time_all_pinned')), ['pinned', 'pinchild']);
    assert.ok(!taskIds(findCard(html, todayKey)).includes('pinned'));
    store.data.pinTasksWithinGroups = true;
    assert.equal(taskIds(findCard(fixture.render(), todayKey))[0], 'pinned', 'inline pins lead their group');
    fixture.taskCollapsed.add('root');
    assert.ok(!taskIds(fixture.render()).includes('child'));
    fixture.taskCollapsed.clear();
    fixture.selectedDocIds = ['doc2'];
    assert.deepEqual(taskIds(fixture.render()), ['today2'], 'aggregate document subsets stay scoped');
    fixture.selectedDocIds = null;

    store.data.quadrantConfig.rules = [
        { id: 'urgent-not-important', name: '紧急不重要', color: 'blue', importance: ['low'], timeRanges: ['within7days'] },
        { id: 'custom', name: '自定义', color: 'yellow', importance: ['medium'], timeRanges: ['within7days'] },
        { id: 'urgent-important', name: '紧急且重要', color: 'red', importance: ['high'], timeRanges: ['within7days'] },
    ];
    html = await switchMode('quadrant');
    assert.deepEqual(taskIds(findCard(html, 'wb_stream_quadrant_all_group_urgent-important')), ['root', 'child']);
    assert.match(html, /--tm-quadrant-red/);
    assert.match(html, /未匹配四象限/);
    assert.deepEqual(taskIds(findCard(html, 'wb_stream_quadrant_all_group_custom')), ['today2']);
    const quadrant = context.__tmCreateTaskCardGroupingContext(false);
    assert.equal(quadrant.resolveQuadrantRule({ priority: 'a', completionTime: fixture.date(7) }).id, 'urgent-important');
    assert.equal(quadrant.resolveQuadrantRule({ priority: 'a', completionTime: fixture.date(8) }), null);
    assert.equal(quadrant.resolveQuadrantRule({ priority: 'a', checkin: true, checkinDate: fixture.date(0), completionTime: fixture.date(20) }).id, 'urgent-important');

    assert.equal(context.__tmAnalyzeTaskProjectionPatch('root', { priority: 'c' }).group, true);
    state.filteredTasks.find((task) => task.id === 'root').priority = 'c';
    assert.deepEqual(taskIds(findCard(fixture.render(), 'wb_stream_quadrant_all_group_urgent-not-important')), ['root', 'child', 'tomorrow']);
    await switchMode('time');
    assert.equal(context.__tmAnalyzeTaskProjectionPatch('root', { completionTime: fixture.date(2) }).group, true);
    state.filteredTasks.find((task) => task.id === 'root').completionTime = fixture.date(2);
    assert.ok(!taskIds(findCard(fixture.render(), todayKey)).includes('root'));
    assert.deepEqual(taskIds(findCard(fixture.render(), 'wb_stream_time_all_group_after_tomorrow')), ['root', 'child', 'after']);

    fixture.load([{ id: 'same1', content: '同步计划' }, { id: 'same2', content: '同步计划', root_id: 'doc2' }, { id: 'empty', content: '' }, { id: 'special', content: "引号'、&和<script>" }]);
    html = await switchMode('task');
    assert.equal(context.__tmAnalyzeTaskProjectionPatch('same1', { content: '调整计划' }).group, true);
    assert.equal(cards(html).length, 3);
    assert.deepEqual(taskIds(findCard(html, 'wb_stream_task_all_group_' + encodeURIComponent('同步计划'))), ['same1', 'same2']);
    assert.ok(taskIds(html).includes('empty'));
    assert.ok(!html.includes('<script>'));
    assert.ok(!cards(html).find((card) => card.includes('data-task-id="special"')).match(/data-group-key="[^\"]*'/));
    fixture.options = { isMobile: true }; html = fixture.render(fixture.options);
    assert.equal((html.match(/class="tm-whiteboard-stream-col"/g) || []).length, 2);
    assert.ok(!cards(html).some((card) => card.includes('tm-badge--count')));
    store.data.whiteboardStreamMobileTwoColumns = false;
    assert.equal((fixture.render(fixture.options).match(/class="tm-whiteboard-stream-col"/g) || []).length, 1);
    fixture.load([]);
    assert.match(fixture.render(), /暂无任务可用于卡片流/);
    assert.ok(fixture.refreshes > 5, 'topbar switches refresh the current projection');
    console.log('whiteboard stream grouping behavior tests passed');
}

module.exports = { harnessSource };
if (require.main === module) test().catch((error) => { console.error(error); process.exitCode = 1; });
