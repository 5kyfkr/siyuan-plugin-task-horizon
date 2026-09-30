'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
function readFunction(name) {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
}
const tasks = new Map([
    ['quit', { id: 'quit', taskMarker: '-', done: false }],
    ['pending', { id: 'pending', taskMarker: ' ', done: false }],
    ['progress', { id: 'progress', taskMarker: '/', done: false }],
    ['done', { id: 'done', taskMarker: 'X', done: true }],
]);
const context = vm.createContext({
    getCalendarTaskSnapshotById: id => tasks.get(id) || null,
    __tmCalendarKanbanCardHelpers: { isCanceled: task => task.taskMarker === '-' },
});
vm.runInContext(readFunction('isCalendarForegroundEvent'), context);
const event = (id, sourceType = 'taskdate', extra = {}) => ({
    id: `${sourceType}-${id}`, allDay: sourceType === 'taskdate',
    extendedProps: { __tmSource: sourceType, __tmTaskId: id, ...extra },
});
for (const sourceType of ['taskdate', 'schedule', 'reminder']) {
    const canceled = event('quit', sourceType);
    assert.equal(context.isCalendarForegroundEvent(canceled), false,
        `${sourceType}: canceled tasks must be hidden from calendar surfaces like the list`);
    tasks.delete('quit');
    assert.equal(context.isCalendarForegroundEvent(canceled), false,
        'invalidating task caches must not bring an abandoned task back');
    tasks.set('quit', { id: 'quit', taskMarker: ' ', done: false });
    assert.equal(context.isCalendarForegroundEvent(canceled), true, 'reopening must restore visibility');
    tasks.set('quit', { id: 'quit', taskMarker: '-', done: false });
}
for (const id of ['pending', 'progress', 'done', 'unknown']) {
    assert.equal(context.isCalendarForegroundEvent(event(id)), true, `${id} must remain visible`);
}
assert.equal(context.isCalendarForegroundEvent(event('quit', 'schedule', {
    __tmScheduleCompletionIndependent: true,
})), true, 'independent schedules keep their own lifecycle');
assert.equal(context.isCalendarForegroundEvent(event('quit', 'taskdate', {
    __tmTaskDateReadOnly: true, __tmTaskDone: true,
})), true, 'completed recurring history must not inherit source-task cancellation');
assert.equal(context.isCalendarForegroundEvent(event('quit', 'tomato')), true, 'focus history remains visible');
assert.equal(context.isCalendarForegroundEvent({ ...event('pending'), display: 'background' }), false);
context.__tmTaskStore = { getProjected: id => id === 'quit' ? { id, taskMarker: ' ', done: false } : null };
assert.equal(context.isCalendarForegroundEvent(event('quit')), true, 'latest projected intent must override stale cached cancellation');
delete context.__tmTaskStore;

vm.runInContext(readFunction('isCalendarRelationTaskDone'), context);
context.__tmTaskBoundary = { isTaskCompleted: task => task.done === true };
assert.equal(context.isCalendarRelationTaskDone(tasks.get('quit')), true, 'relation checkboxes must match the list closed-state checkbox');
assert.equal(context.isCalendarRelationTaskDone(tasks.get('progress')), false);
assert.equal(context.isCalendarRelationTaskDone(tasks.get('done')), true);
assert.equal(context.__tmTaskBoundary.isTaskCompleted(tasks.get('quit')), false, 'abandonment must not become successful completion');
console.log('calendar canceled task visibility tests passed');
