'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const bindSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js'),
    'utf8',
);
const lifecycleSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'task-horizon', 'main', 'shell', '80-shell-lifecycle.js'),
    'utf8',
);

assert.match(bindSource, /state\.__tmTimelineGroupRangeTouchOpenHandler = onTouchEnd;/);
assert.match(
    lifecycleSource,
    /state\.__tmTimelineGroupRangeTouchOpenHandler[\s\S]*document\.removeEventListener\('touchend', state\.__tmTimelineGroupRangeTouchOpenHandler, true\)/,
);
assert.match(lifecycleSource, /state\.__tmTimelineGroupRangeTouchOpenBound = false;/);

console.log('timeline touch lifecycle contract tests passed');
