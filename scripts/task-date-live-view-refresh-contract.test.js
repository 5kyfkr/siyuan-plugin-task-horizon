'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calendarSupport = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'),
    'utf8',
);
const taskRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'),
    'utf8',
);
const detailRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'),
    'utf8',
);

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const dateMutation = segment(
    calendarSupport,
    'window.tmUpdateTaskDates = async function',
    'const __tmUpdateTaskDatesCore = window.tmUpdateTaskDates',
);
const controllers = segment(
    taskRuntime,
    'const __tmViewControllers = {',
    'function __tmSyncVisibleCalendarTaskPatch',
);
const detailTimeHub = segment(
    detailRuntime,
    'const openTaskTimeHubPopover = (trigger, options = {}) => {',
    'const bindCustomFieldEditors = () => {',
);
const detailTimeHubSingleDate = segment(
    detailTimeHub,
    'const updateDateField = async (field, value) => {',
    'const updateDateRange = async (left, right) => {',
);
const detailTimeHubDateRange = segment(
    detailTimeHub,
    'const updateDateRange = async (left, right) => {',
    'const loadHubSchedules = async (force = false) => {',
);

assert.match(
    dateMutation,
    /__tmApplyTaskMetaPatchWithUndo\(persistId, attrPatch, \{[\s\S]*renderOptimistic: true/,
    'optimistic date mutations must publish through the shared field projection manager',
);
assert.doesNotMatch(
    dateMutation,
    /refreshViaQueuedOptimisticPatch|__tmKanbanDateProjectionRefresh|__tmRefreshTaskTimeAcrossViews|__tmScheduleListProjectionRefresh/,
    'date mutations must not retain a second manual projection path',
);
assert.match(
    controllers,
    /checklist:[\s\S]*__tmUpdateChecklistTaskTimeInDOM\(taskId, item, task\)/,
    'checklist compact fields must consume shared date projections',
);
assert.match(
    controllers,
    /kanban:[\s\S]*__tmDoesPatchAffectTaskCardMetaChips\(patch\)[\s\S]*__tmSyncTaskCardMetaChipsInDOM\(card, task, 'kanban'\)/,
    'kanban cards must consume shared date projections',
);
assert.match(
    controllers,
    /whiteboard:[\s\S]*__tmDoesPatchAffectTaskCardMetaChips\(patch\)[\s\S]*__tmSyncTaskCardMetaChipsInDOM\(node, task, 'whiteboard'\)/,
    'whiteboard cards must consume shared date projections',
);
assert.doesNotMatch(
    detailTimeHub,
    /patchLocal|boundTask\.(?:startDate|start_date|completionTime|completion_time)\s*=/,
    'the detail time hub must not overwrite mutation inverses with an entry-point local patch',
);
assert.match(detailTimeHubSingleDate, /window\.tmUpdateTaskDates\(boundId, patch/,
    'single-date edits must use the authoritative date mutation command');
assert.match(detailTimeHubDateRange, /window\.tmUpdateTaskDates\(boundId, patch/,
    'date-range edits must use the authoritative date mutation command');

console.log('task date live view refresh contract tests passed');
