'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

assert.match(
    source,
    /let timeHubAutoSaveRequest = false;/,
    'the inline editor must track secondary-hub auto-save separately from manual saves',
);
assert.match(
    source,
    /timeHubAutoSaveRequest = true;\s*try \{\s*saveButton\.click\(\);/,
    'closing a changed date/time hub must route through the primary save handler',
);
assert.match(
    source,
    /const keepPopoverOpen = timeHubAutoSaveRequest === true;\s*timeHubAutoSaveRequest = false;/,
    'the auto-save intent must be captured before asynchronous persistence begins',
);
assert.match(
    source,
    /const onDocumentPointerDown = \(event\) => \{[\s\S]*timeHub\.contains\(target\)[\s\S]*closeTimeHub\(\)[\s\S]*close\(\);[\s\S]*document\.addEventListener\('pointerdown', onDocumentPointerDown, true\)/,
    'date/time hub must close on an outside pointerdown when embedded surfaces suppress click',
);
assert.match(
    source,
    /document\.removeEventListener\('pointerdown', current\.onDocumentPointerDown, true\)/,
    'date/time hub outside-pointer listener must be removed with the editor popover',
);

const saveStart = source.indexOf("pop.querySelector('[data-tm-proto-edit-action=\"save\"]')?.addEventListener('click'");
assert.ok(saveStart >= 0, 'inline editor save handler must remain inspectable');
const saveEnd = source.indexOf("\n                });\n            };\n            const close = () =>", saveStart);
assert.ok(saveEnd > saveStart, 'inline editor save handler must have a bounded body');
const saveBlock = source.slice(saveStart, saveEnd);
assert.match(saveBlock, /if \(!keepPopoverOpen\) close\(\);/, 'successful auto-save must keep the first-level editor card open');
assert.equal(
    (saveBlock.match(/if \(!keepPopoverOpen\) close\(\);/g) || []).length,
    2,
    'task-date and schedule save branches must both preserve the first-level card',
);

const editorStart = source.indexOf('const showPrototypeScheduleEditorCard =');
const editorEnd = source.indexOf('const openPrototypeNewScheduleCard =', editorStart);
const editor = source.slice(editorStart, editorEnd);
const popCreated = editor.indexOf("const pop = document.createElement('div')");
const monthListener = editor.indexOf("pop.addEventListener('click', onInlineMonthDayClick)");
assert.ok(popCreated >= 0 && monthListener > popCreated, 'month-day events must bind after the popover element exists');
assert.doesNotMatch(editor.slice(0, popCreated), /pop\.addEventListener/, 'popover initialization must not access a DOM binding in its temporal dead zone');
assert.match(editor, /weekdayPickerHTML\(inlineMonthWeek/);
console.log('calendar inline editor preserve contract tests passed');
