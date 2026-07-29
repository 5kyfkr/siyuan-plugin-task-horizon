'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const bodySource = read('src', 'task-horizon', 'main', 'render', '44-render-whiteboard-body.js');
const interactionSource = read('src', 'task-horizon', 'main', 'render', '49-render-whiteboard-interactions.js');
const cssSource = read('task-horizon.css');

const overlayLayers = bodySource.match(/<svg class="tm-whiteboard-edges tm-whiteboard-edges--subtask"/g) || [];
assert.equal(overlayLayers.length, 3, 'every whiteboard canvas variant must include a subtask edge overlay');

assert.match(
    cssSource,
    /\.tm-whiteboard-edges--subtask\s*\{[\s\S]*?z-index:\s*11\s*;/,
    'subtask edges must render above parent and selected task cards',
);
assert.match(
    interactionSource,
    /const isSubtaskEndpoint[\s\S]*?tm-whiteboard-node--sub[\s\S]*?const subtaskPaths = \[\]/,
    'edge rendering must classify visible subtask endpoints into a separate path group',
);
assert.match(
    interactionSource,
    /subtaskPaths\.push\(pathHtml\)[\s\S]*?subtaskSvg\.innerHTML/,
    'subtask edge paths must be written to the foreground SVG',
);
assert.match(
    interactionSource,
    /const subtaskLaneCounts = new Map\(\)[\s\S]*?const claimSubtaskLane[\s\S]*?\(laneIndex \+ 1\) \* 12/,
    'visible child endpoints must use separate 12 px lanes while lane zero stays reserved for the root task',
);
assert.match(
    interactionSource,
    /fromLaneOffset[\s\S]*?toLaneOffset[\s\S]*?laneOffset:\s*Math\.max\(fromLaneOffset, toLaneOffset\)/,
    'subtask lane offsets must be passed into obstacle routing',
);

console.log('whiteboard subtask edge layer contract tests passed');
