'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const interactionSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/49-render-whiteboard-interactions.js'),
    'utf8',
);

const routeStart = interactionSource.indexOf('const resolveVisibleTaskId');
const routeEnd = interactionSource.indexOf('const markerIdIn', routeStart);
assert.ok(routeStart >= 0 && routeEnd > routeStart, 'whiteboard edge router must be extractable');

const sourceRootRect = { taskId: 'right-root', x: 500, y: 20, w: 230, h: 570 };
const sourceRect = { taskId: 'right-child', x: 508, y: 275, w: 214, h: 52 };
const targetRect = { taskId: 'left', x: 40, y: 425, w: 230, h: 72 };
const obstacleRects = [sourceRootRect, targetRect];
const context = {
    obstacleRects,
    rectByTaskId: new Map([sourceRootRect, sourceRect, targetRect].map((rect) => [rect.taskId, rect])),
    rootTaskIdByTaskId: new Map([
        ['right-root', 'right-root'],
        ['right-child', 'right-root'],
        ['left', 'left'],
    ]),
};
context.globalThis = context;

vm.runInNewContext(`
    ${interactionSource.slice(routeStart, routeEnd)}
    globalThis.__testBuildAvoidPath = buildAvoidPath;
`, context, { filename: 'whiteboard-edge-obstacle-router.js' });

const routed = context.__testBuildAvoidPath(
    { x: 723, y: 301 },
    { x: 39, y: 461 },
    ['right-child', 'left'],
    { fromTaskId: 'right-child', toTaskId: 'left' },
);

assert.ok(routed.pts.length >= 6, 'right-to-left links must use an orthogonal avoidance route');
assert.match(routed.d, / Q /, 'right-to-left avoidance routes must retain rounded corners');

const crossingY = routed.pts[2].y;
for (const rect of [sourceRootRect, targetRect]) {
    assert.ok(
        crossingY < (rect.y - 10) || crossingY > (rect.y + rect.h + 10),
        `the cross-card segment must clear the full ${rect.taskId} card bounds`,
    );
}

const offsetRouted = context.__testBuildAvoidPath(
    { x: 723, y: 301 },
    { x: 39, y: 461 },
    ['right-child', 'left'],
    {
        fromTaskId: 'right-child',
        toTaskId: 'left',
        fromLaneOffset: 24,
        laneOffset: 24,
    },
);
assert.equal(
    offsetRouted.pts[1].x,
    routed.pts[1].x + 24,
    'parallel subtask routes must use distinct vertical exit lanes',
);
assert.equal(
    Math.abs(offsetRouted.pts[2].y - crossingY),
    24,
    'parallel subtask routes must also separate their horizontal clearance lanes',
);

console.log('whiteboard edge obstacle routing tests passed');
