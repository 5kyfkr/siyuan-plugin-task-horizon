'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const bodySource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'), 'utf8');
const interactionSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/49-render-whiteboard-interactions.js'), 'utf8');

assert.match(
    bodySource,
    /onpointerdown="tmWhiteboardFramePointerDown\(event,[\s\S]*?onmousedown="tmWhiteboardFrameMouseDown\(event,/,
    'whiteboard frames must use a touch-specific pointer entry while preserving desktop mouse drag',
);
assert.match(
    interactionSource,
    /window\.tmWhiteboardFramePointerDown\s*=\s*function[\s\S]*?pointerType[\s\S]*?!==\s*'touch'[\s\S]*?setTimeout\([\s\S]*?__tmFromLongPress:\s*true[\s\S]*?tmWhiteboardFrameMouseDown\(startEvent,[\s\S]*?,\s*500\)/,
    'touch frame drag must start only after the same 500 ms long press used by whiteboard cards',
);
assert.match(
    interactionSource,
    /window\.tmWhiteboardFramePointerDown\s*=\s*function[\s\S]*?\(dx \* dx \+ dy \* dy\) > 16\) cleanup\(\)/,
    'moving before the long-press threshold must cancel frame drag so the viewport can pan',
);
assert.match(
    interactionSource,
    /window\.tmWhiteboardFrameMouseDown\s*=\s*function[\s\S]*?!ev\?\.__tmFromLongPress[\s\S]*?whiteboardSuppressSyntheticMouseUntil/,
    'synthetic mouse events after touch must not bypass the long-press gate',
);

console.log('whiteboard frame long-press contract tests passed');
