'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const dialogs = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const listBody = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/42-render-list-and-checklist-body.js'), 'utf8');
const listRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');

assert.match(
    runtime,
    /const __tmHasTouchInputCapability = \(\) => \{[\s\S]*navigator\?\.maxTouchPoints[\s\S]*pointer: coarse/,
    'desktop tablet mode must detect touch input capability',
);
assert.match(
    runtime,
    /const __tmShouldUseCustomTouchTaskDrag = \(\) => \{[\s\S]*return kind !== 'desktop-browser' \|\| __tmHasTouchInputCapability\(\);/,
    'touch-capable desktop mode must use the custom touch drag path',
);

const checklistPointerStart = dialogs.indexOf('function __tmIsTouchLikeChecklistPointer');
const checklistPointerEnd = dialogs.indexOf('function __tmResolveTouchTaskDragSource', checklistPointerStart);
assert.ok(checklistPointerStart >= 0 && checklistPointerEnd > checklistPointerStart, 'checklist pointer classifier must exist');
const checklistPointer = dialogs.slice(checklistPointerStart, checklistPointerEnd);
assert.match(checklistPointer, /if \(pType === 'touch' \|\| pType === 'pen'\) return true;/, 'touch and pen pointers must use long press');
assert.match(checklistPointer, /if \(pType === 'mouse'\) return false;/, 'mouse pointers must keep desktop drag behavior');

assert.match(listBody, /const touchDragAttr = __tmShouldUseCustomTouchTaskDrag\(\)[\s\S]*tmTaskTouchDragStart/);
assert.match(listRuntime, /const touchDragAttr = useCustomTouchTaskDrag[\s\S]*tmTaskTouchDragStart/);
assert.match(dialogs, /const longPressMs = 500;/, 'checklist touch drag must keep the 500ms hold threshold');

console.log('table touch drag contract tests passed');
