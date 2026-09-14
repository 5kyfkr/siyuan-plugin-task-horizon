'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const modelSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
const extract = (source, start, end) => {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first);
    return source.slice(first, last);
};
class Element {
    constructor(inputs = []) { this.inputs = inputs; }
    querySelectorAll(selector) {
        const taskId = selector.match(/data-task-id="([^"]+)"/)?.[1];
        return this.inputs.filter((input) => !taskId || input.taskId === taskId);
    }
}
class Input extends Element {
    constructor(taskId) {
        super();
        this.taskId = taskId;
        this.checked = taskId === 'child';
        this.style = { setProperty(name, value) { this[name] = value; } };
        this.parentElement = new Element([this]);
    }
}
const parent = new Input('parent');
const repeated = new Input('parent');
const child = new Input('child');
const external = new Input('external');
const side = new Input('parent');
const tasks = { parent: { id: 'parent', priority: 'high' }, child: { id: 'child', priority: 'low' } };
const context = vm.createContext({
    Element, HTMLElement: Element, HTMLInputElement: Input,
    CSS: { escape: (value) => value },
    state: { wrapEl: new Element([parent, repeated, child, external]), sideDay: { rootEl: new Element([side]) }, viewMode: 'calendar' },
    __tmTaskStore: { getProjected: (taskId) => tasks[taskId] },
    getCalendarTaskSnapshotById: (taskId) => taskId === 'external' ? { id: taskId, priority: 'medium' } : { id: taskId, priority: 'low' },
    __tmGetPriorityAccentColor: (priority) => ({ high: '#ff0000', medium: '#ff9900', low: '#0000ff' })[priority],
});
vm.runInContext(extract(modelSource, 'function __tmResolveTaskPriorityValue(', 'function __tmBuildTaskCheckboxStyle(')
    + extract(runtimeSource, 'function __tmUpdateTaskCheckboxPriorityInDOM(', 'function __tmUpdateTaskPriorityInDOM(')
    + extract(calendarSource, 'function syncTaskPriorityInPlace(', 'function syncTaskDoneInPlace(')
    + ';this.__tmCalendarKanbanCardHelpers = {updateCheckboxPriority:__tmUpdateTaskCheckboxPriorityInDOM};this.sync = syncTaskPriorityInPlace;', context);
assert.equal(context.sync('parent'), true);
for (const input of [parent, repeated, side]) assert.equal(input.style.borderColor, '#ff0000');
assert.equal(child.style.borderColor, undefined, 'Parent edits must not recolor children');
assert.equal(child.checked, true);
assert.equal(context.sync('external'), true, 'Tasks outside the current document group use the shared calendar snapshot');
assert.equal(external.style.borderColor, '#ff9900');
tasks.parent.priority = 'medium';
context.sync('parent', { side: false });
assert.equal(parent.style.borderColor, '#ff9900');
assert.equal(side.style.borderColor, '#ff0000');
tasks.parent.priority = '';
context.sync('parent');
assert.equal(parent.style.borderColor, '#a9afb8');
tasks.parent.priority = 'low';
context.sync('parent');
assert.equal(parent.style.borderColor, '#0000ff', 'Rollback reads the current projected value, not the original mutation patch');
context.sync('child');
assert.equal(child.style.borderColor, '#0000ff');
assert.equal(child.checked, true, 'Recoloring must retain completion state and the input node');
assert.equal(parent.style['--tm-checklist-checkbox-color'], parent.style.borderColor);
let readbacks = 0;
Object.assign(context, {
    __tmCalendar: { syncTaskPriorityInPlace: context.sync, syncTaskDateInPlace: () => { readbacks += 1; return {}; } },
    __tmPatchAffectsCalendar: () => true,
    __tmGetPatchFieldKeys: Object.keys,
});
vm.runInContext(extract(runtimeSource, 'function __tmSyncVisibleCalendarTaskPatch(', 'function __tmRefreshTaskFieldsAcrossViews(')
    + ';this.refresh = __tmSyncVisibleCalendarTaskPatch;', context);
assert.equal(context.refresh('parent', { priority: 'low' }), true);
assert.equal(readbacks, 0, 'Priority-only edits must not refetch dates or rebuild the calendar');
assert.equal(context.refresh('parent', { priority: 'low', customStatus: 'todo' }), true);
assert.equal(readbacks, 1, 'Other calendar-affecting fields retain their existing refresh path');
assert.match(calendarSource, /hasOwnProperty\.call\(patch, 'priority'\)[\s\S]*?syncTaskPriorityInPlace\(id\)/);
assert.match(modelSource, /updateCheckboxPriority: \(container, task\) => __tmUpdateTaskCheckboxPriorityInDOM\(container, task\)/);
console.log('calendar list priority local update tests passed');
