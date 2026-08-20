'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modelSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

assert.match(renderSource, /tm-kanban-card--dependency-affected/, 'whiteboard cards must expose dependency-affected state');
assert.match(renderSource, /tm-kanban-card--has-date/, 'whiteboard cards must expose dated state');
assert.match(runtimeSource, /function __tmSyncWhiteboardDependencyClassesInDOM/, 'whiteboard dependency state must update in place');
assert.match(cssSource, /--tm-whiteboard-dependency-color:/, 'dependency state must use a theme-aware color token');
assert.match(cssSource, /tm-kanban-card--has-date[\s\S]*?var\(--tm-whiteboard-dated-color\)/, 'dated cards must use the fixed blue border token');
assert.match(cssSource, /tm-kanban-card--dependency-affected[\s\S]*?var\(--tm-whiteboard-dependency-color\)/, 'affected cards must use the dependency color border');
assert.match(cssSource, /tm-kanban-card--dependency-affected[\s\S]*?tm-kanban-card--overdue/, 'affected border must yield to overdue state');

const start = modelSource.indexOf('function __tmHasTaskCardDate');
const end = modelSource.indexOf('function __tmFormatTaskCardDateValue', start);
assert.ok(start >= 0 && end > start, 'whiteboard dependency helpers must be extractable');

const context = {
    console,
    __tmNormalizeDateOnly(value) {
        const raw = String(value || '').trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '2026-08-21';
    },
    __tmIsTaskDoneEffective(task) { return task?.done === true; },
};
context.globalThis = context;
vm.runInNewContext(`
    function __tmIsTaskCardDateOverdue(task, todayKey = '') {
        if (task?.done === true) return false;
        const due = String(task?.completionTime || '').trim();
        return !!due && due < (todayKey || '2026-08-21');
    }
    ${modelSource.slice(start, end)}
    globalThis.__testHasTaskCardDate = __tmHasTaskCardDate;
    globalThis.__testBuildAffected = __tmBuildWhiteboardDependencyAffectedTaskIdSet;
`, context, { filename: 'whiteboard-dependency-state-runtime.js' });

const tasks = [
    { id: '1', completionTime: '2026-08-22', done: false },
    { id: '2', completionTime: '2026-08-22', done: false },
    { id: '3', completionTime: '2026-08-20', done: false },
    { id: '4', startDate: '2026-08-23', done: false },
    { id: '5', done: false },
];
const links = [
    { from: '1', to: '2' },
    { from: '2', to: '3' },
    { from: '3', to: '4' },
    { from: '4', to: '5' },
];

assert.deepEqual(
    Array.from(context.__testBuildAffected(tasks, links, '2026-08-21')).sort(),
    ['4', '5'],
    'only tasks downstream from the overdue card must be affected',
);
assert.equal(context.__testHasTaskCardDate(tasks[3]), true, 'start date must count as a dated card');
assert.equal(context.__testHasTaskCardDate(tasks[4]), false, 'cards without start or due dates must remain undated');

tasks[3].done = true;
assert.deepEqual(
    Array.from(context.__testBuildAffected(tasks, links, '2026-08-21')).sort(),
    [],
    'completed downstream tasks must stop affected-state propagation',
);

console.log('whiteboard dependency state contract tests passed');
