const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');

const start = source.indexOf('window.tmOpenTaskDetail = async function');
const end = source.indexOf('window.tmToggleTaskDetailCompletedSubtasks', start);
assert.ok(start >= 0 && end > start, 'shared task-detail opener must exist');
const openTaskDetail = source.slice(start, end);

assert.match(openTaskDetail, /detailButton = ev\?\.target\?\.closest\?\.\('\.tm-kanban-more'\)[\s\S]*detailCard = detailButton\?\.closest\?\.\('\.tm-kanban-card'\)/, 'only the task-detail button inside a card may toggle an open detail');
assert.match(openTaskDetail, /useTaskDetailSheetMode[\s\S]*checklistDetailSheetOpen === true[\s\S]*isSameDetailTask\(state\.detailTaskId\)[\s\S]*typeof window\.tmTaskDetailSheetClose === 'function'[\s\S]*tmTaskDetailSheetClose/, 'the same card button must close the matching mobile or Dock detail sheet');
assert.match(openTaskDetail, /kanbanDetailFloat = state\.modal[\s\S]*activeRenderMode === 'kanban'[\s\S]*kanbanDetailFloat instanceof HTMLElement[\s\S]*isSameDetailTask\(state\.kanbanDetailTaskId\)[\s\S]*__tmCloseKanbanDetailFloating\(\)/, 'the same card button must close the matching desktop kanban detail float');
assert.match(openTaskDetail, /tm-task-detail-overlay[\s\S]*isSameDetailTask\(standaloneTaskId\)[\s\S]*typeof standaloneOverlay\.__tmTaskDetailOnClose === 'function'[\s\S]*__tmTaskDetailOnClose/, 'the same card button must close the matching standalone detail overlay used by whiteboard cards');
assert.match(openTaskDetail, /if \(useTaskDetailSheetMode\)[\s\S]*__tmOpenTaskDetailSheetInPlace[\s\S]*activeRenderMode === 'kanban'[\s\S]*__tmOpenKanbanDetailFloatingInPlace/, 'non-toggle requests and different cards must keep the existing detail opening routes');

console.log('card detail button toggle contract tests passed');
