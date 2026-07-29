'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const policySource = fs.readFileSync(path.join(root, 'src/task-horizon/main/31-view-host-policies.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/41-render-scene-context.js'), 'utf8');
const detailSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
const gestureSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');

assert.match(
    policySource,
    /taskDetailSheetViewModes\s*=\s*new Set\(\['list', 'kanban', 'whiteboard', 'calendar', 'timeline'\]\)/,
    'table, kanban, whiteboard, calendar, and timeline views must share the mobile task detail sheet',
);
assert.match(
    renderSource,
    /id="tmTaskDetailSheet"[\s\S]*?onpointerdown="tmTaskDetailSheetDragStart\(event\)"/,
    'the shared task detail sheet must expose the pointer gesture entry',
);
assert.match(
    detailSource,
    /stage\.appendChild\(sheet\);[\s\S]*?__tmBindChecklistSheetTouchFallback\?\.\(modal\)/,
    'a task detail sheet mounted after the view render must retain the Touch Event fallback',
);
assert.match(
    gestureSource,
    /const usesTouchEvents = source === 'touch';[\s\S]*?const touchInput = usesTouchEvents \|\| source === 'pointer-touch' \|\| pointerType === 'touch';/,
    'touch semantics must work for both Pointer Events and legacy Touch Events',
);
assert.match(
    gestureSource,
    /if \(pointerType === 'touch'\) \{[\s\S]*?setTimeout\(\(\) => \{[\s\S]*?__tmChecklistSheetLastTouchStartAt >= pointerStartAt[\s\S]*?__tmStartChecklistSheetDrag\(ev, 'pointer-touch', options\)/,
    'Pointer-only HarmonyOS and Android WebViews must start the sheet gesture',
);
assert.doesNotMatch(
    gestureSource.slice(
        gestureSource.indexOf('function __tmStartChecklistSheetPointerDrag'),
        gestureSource.indexOf('window.tmChecklistSheetTouchStart'),
    ),
    /if \(pointerType === 'touch'\) return;/,
    'touch Pointer Events must not be discarded',
);
assert.match(
    gestureSource,
    /if \(\(now - __tmChecklistSheetLastPointerTouchStartAt\) < 700\) return;/,
    'hybrid iOS and Android Pointer plus Touch streams must be deduplicated',
);
assert.match(
    gestureSource,
    /target\?\.closest\?\.\('#tmChecklistSheet, #tmTaskDetailSheet'\)[\s\S]*?modal\.addEventListener\('touchstart', onTouchStart/,
    'the stable modal host must delegate legacy Touch Events to sheets mounted after render',
);

console.log('task detail sheet mobile gesture contract tests passed');
