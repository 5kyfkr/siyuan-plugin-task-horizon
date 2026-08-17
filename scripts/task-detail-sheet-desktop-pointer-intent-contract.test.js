'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const gestureSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');

assert.match(
    gestureSource,
    /const waitForIntent = allowBodySheetGesture && inBody && !fromHandle && \(startedFullscreen \|\| touchTextInputTarget \|\| touchGestureTarget \|\| !touchInput\);/,
    'desktop pointer gestures in the sheet body must wait for movement intent before changing sheet layout',
);
assert.match(
    gestureSource,
    /const intentDistance = __tmIsMobileDevice\(\) \? 5 : 6;[\s\S]*?if \(absX < intentDistance && absY < intentDistance\) return;[\s\S]*?if \(absX > absY \* 1\.2\) \{[\s\S]*?cancelGesture\(\);/,
    'desktop sheet dragging must require six pixels of primarily vertical movement',
);

console.log('task detail sheet desktop pointer intent contract tests passed');
