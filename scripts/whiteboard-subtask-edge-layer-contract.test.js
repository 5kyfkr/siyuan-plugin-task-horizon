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
    /\.tm-whiteboard-edges\s*\{[\s\S]*?pointer-events:\s*none;[\s\S]*?z-index:\s*11\s*;/,
    'all visible edges and arrow markers must render above parent cards and their connection dots',
);
assert.match(cssSource, /\.tm-task-link-dot\s*\{[\s\S]*?z-index:\s*5\s*;/, 'base connection dots must stay below edge visuals');
assert.match(
    cssSource,
    /\.tm-whiteboard-collapse-proxy-dot\s*\{[\s\S]*?z-index:\s*6\s*;/,
    'collapsed-subtask proxy dots must stay below edge visuals',
);
assert.match(
    cssSource,
    /\.tm-whiteboard-edge\.tm-whiteboard-edge--manual\s*\{[\s\S]*?pointer-events:\s*none\s*;/,
    'the raised visible edge must not intercept connection-dot dragging',
);
assert.match(
    interactionSource,
    /const hitEndpointGap = Math\.min\(12,[\s\S]*?stroke-dasharray="0 \$\{hitEndpointGap\.toFixed\(2\)\} \$\{hitMiddleLength\.toFixed\(2\)\} \$\{hitEndpointGap\.toFixed\(2\)\}"/,
    'manual edge hit paths must leave both endpoint dot areas interactive',
);
assert.match(
    interactionSource,
    /const subtaskTaskIds = new Set\(\)[\s\S]*?classList\.contains\('tm-whiteboard-node--sub'\)[\s\S]*?const isSubtaskEndpoint[\s\S]*?subtaskTaskIds\.has\(id\)[\s\S]*?const subtaskPaths = \[\]/,
    'edge rendering must cache visible subtask endpoints and route them into a separate path group',
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
