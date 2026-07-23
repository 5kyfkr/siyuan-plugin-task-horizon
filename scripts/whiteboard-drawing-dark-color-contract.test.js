'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const bodySource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'), 'utf8');
const interactionSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/49-render-whiteboard-interactions.js'), 'utf8');

assert.match(
    bodySource,
    /const displayColor = color\.toLowerCase\(\) === '#1f2937' \? 'var\(--tm-text-color\)' : color;[\s\S]*?stroke="\$\{esc\(displayColor\)\}"/,
    'saved black strokes must use the theme text color when rendered in dark mode',
);
assert.match(
    interactionSource,
    /const color = tool === 'highlighter' \? cfg\.highlighterColor : cfg\.penColor;[\s\S]*?const displayColor = String\(color \|\| ''\)\.toLowerCase\(\) === '#1f2937' \? 'var\(--tm-text-color\)' : color;[\s\S]*?draft\.setAttribute\('stroke', displayColor\);/,
    'the in-progress black stroke preview must also invert in dark mode',
);
assert.match(
    interactionSource,
    /const stroke = \{[\s\S]*?color,[\s\S]*?width,/,
    'theme inversion must remain display-only and preserve the stored pen color',
);

console.log('whiteboard drawing dark color contract tests passed');
