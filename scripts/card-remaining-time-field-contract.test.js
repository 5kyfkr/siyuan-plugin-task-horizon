'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const taskModelSource = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
const settingsSource = read('src/task-horizon/main/settings/60-settings-screen.js');
const kanbanSource = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');
const whiteboardSource = read('src/task-horizon/main/render/44-render-whiteboard-body.js');
const cardRuntimeSource = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');

assert.match(
    taskModelSource,
    /\{ key: 'date', label: '截止日期' \},\s*\{ key: 'remainingTime', label: '剩余时间' \},\s*\{ key: 'tomatoSummary', label: '专注' \}/,
    'remaining time must be offered immediately after the due-date card field',
);
assert.match(
    taskModelSource,
    /function __tmShouldRenderTaskCardRemainingTime\(task\) \{\s*return !!String\(__tmGetTaskCardDateValue\(task\) \|\| ''\)\.trim\(\);\s*\}/,
    'remaining time must stay hidden when both start and due dates are empty',
);
assert.match(
    settingsSource,
    /'看板卡片字段'[\s\S]*__TM_TASK_CARD_FIELD_OPTIONS[\s\S]*'白板卡片字段'[\s\S]*__TM_TASK_CARD_FIELD_OPTIONS/,
    'kanban and whiteboard settings must share the canonical card-field options',
);
assert.match(
    kanbanSource,
    /has\('date'\)[\s\S]*has\('remainingTime'\) && __tmShouldRenderTaskCardRemainingTime\(task\)[\s\S]*data-tm-task-time-field="remainingTime"[\s\S]*has\('tomatoSummary'\)/,
    'kanban cards must render remaining time after the due date',
);
assert.match(
    whiteboardSource,
    /has\('date'\)[\s\S]*has\('remainingTime'\) && __tmShouldRenderTaskCardRemainingTime\(task\)[\s\S]*data-tm-task-time-field="remainingTime"[\s\S]*has\('tomatoSummary'\)/,
    'whiteboard cards must render remaining time after the due date',
);
assert.match(
    cardRuntimeSource,
    /field === 'date'\s*\|\| field === 'remainingTime'/,
    'live card metadata replacement must manage remaining-time chips',
);
assert.match(
    cardRuntimeSource,
    /__tmTaskCardFieldEnabled\(viewKey, 'remainingTime'\) && __tmShouldRenderTaskCardRemainingTime\(taskLike\)[\s\S]*__tmGetTaskRemainingTimeInfo\(taskLike\)[\s\S]*__tmRenderTaskRemainingTimeInfoHtml\(remainingInfo\)/,
    'live card metadata updates must reuse the canonical remaining-time calculation and renderer',
);

console.log('kanban and whiteboard remaining-time card field contract tests passed');
