'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');

assert.match(
    runtimeSource,
    /probe\.style\.cssText = '[^']*transition:none!important;[^']*';[\s\S]*?host\.appendChild\(__tmCssColorProbeEl\)/,
    'the attached theme color probe must disable third-party transitions before reading computed colors',
);

console.log('theme follow color probe contract tests passed');
