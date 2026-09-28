'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');

assert.doesNotMatch(source, /tm-(?:calendar-edit|proto-inline)-relation-icon/, 'the linked-task arrow icon is removed from both schedule editors');
assert.match(source, /tm-task-checkbox tm-calendar-edit-relation-check[\s\S]*data-tm-cal-relation-task-check/, 'the modal editor renders a real linked-task checkbox');
assert.match(source, /tm-task-checkbox tm-proto-inline-relation-check[\s\S]*data-tm-proto-edit-relation-task-check/, 'the inline editor renders a real linked-task checkbox');
assert.match(source, /pop\.addEventListener\('change', async \(event\) => \{[\s\S]*data-tm-proto-edit-relation-task-check[\s\S]*handleCalendarRelationTaskCheckboxToggle/, 'the inline editor delegates checkbox changes so initial and rerendered controls both work');
assert.match(source, /function getCalendarRelationCheckboxShapeClass\(\)[\s\S]*taskCheckboxCircleStyleEnabled/, 'the linked-task checkbox follows the configured circle or square shape');
assert.match(styles, /tm-calendar-schedule-editor-modal input\.tm-calendar-edit-relation-check\[type="checkbox"\][\s\S]*tm-proto-inline-schedule-editor input\.tm-proto-inline-relation-check\[type="checkbox"\]/, 'both editor surfaces explicitly style the task checkbox input');

const start = source.indexOf('    async function handleCalendarRelationTaskCheckboxToggle(');
const end = source.indexOf('\n    function shouldEnableCalendarEventContextMenu(', start);
assert.ok(start >= 0 && end > start, 'linked-task checkbox handler remains bounded and inspectable');
const handler = source.slice(start, end);

class FakeCheckbox {
    constructor(checked) { this.checked = checked; }
}
const calls = [];
const context = vm.createContext({
    HTMLInputElement: FakeCheckbox,
    window: {
        tmSetDone: async (...args) => { calls.push(args); return true; },
    },
});
vm.runInContext(`${handler}\nglobalThis.toggleRelationTask = handleCalendarRelationTaskCheckboxToggle;`, context);

(async () => {
    const input = new FakeCheckbox(true);
    const event = { stopPropagation() {} };
    assert.equal(await context.toggleRelationTask(input, 'task-1', event), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'task-1');
    assert.equal(calls[0][1], true);
    assert.equal(calls[0][2], event);
    assert.equal(calls[0][3].source, 'calendar-relation-checkbox');

    context.window.tmSetDone = async () => false;
    const failedInput = new FakeCheckbox(false);
    assert.equal(await context.toggleRelationTask(failedInput, 'task-1', event), false);
    assert.equal(failedInput.checked, true, 'failed writes restore the previous task state');
    console.log('calendar relation task checkbox contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
