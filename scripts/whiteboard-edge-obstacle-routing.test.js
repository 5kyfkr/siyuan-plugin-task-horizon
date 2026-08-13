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
const routeEnd = interactionSource.indexOf('const markerIdOut', routeStart);
assert.ok(routeStart >= 0 && routeEnd > routeStart, 'whiteboard edge router must be extractable');
const routeSource = interactionSource.slice(routeStart, routeEnd);
assert.match(routeSource, /const buildRoundedRoutePath/, 'obstacle routes must use the shared rounded-corner path builder');
assert.match(routeSource, /const buildRoundedRoutePath = \(pts, radius = 24\)/, 'orthogonal detours must use the larger shared corner radius');
assert.match(routeSource, /inLength \* 0\.48, outLength \* 0\.48/, 'short route segments must allow visibly larger corners without overlap');
assert.doesNotMatch(routeSource, /buildRoundedRoutePath\(pts, 10\)/, 'detour branches must not override the shared radius with small corners');
assert.doesNotMatch(routeSource, /:\s*\{ d: '', pts: \[\] \}/, 'a valid pair of endpoints must never lose its line when strict routing has no solution');
assert.doesNotMatch(routeSource, /\sQ\s/, 'the whiteboard router must not mix quadratic corners with cubic Bezier corners');
assert.match(
    routeSource,
    /const directRouteIsClear = \(pts\)[\s\S]*?pathLeavesEndpointRootThroughSide\(pts, fromRect, fromAnchor\)[\s\S]*?pathLeavesEndpointRootThroughSide\(pts, toRect, toAnchor, true\)/,
    'every direct curve must leave and enter through its declared card edges before bypassing obstacle routing',
);
assert.match(
    interactionSource,
    /<marker[^>]*orient="auto"[\s\S]*?<path d="M0,0 L8,3 L0,6 Z"/,
    'whiteboard arrows must derive their rotation from the rendered path tangent',
);
assert.match(
    interactionSource,
    /const rawPts = Array\.isArray\(routed\.pts\)[\s\S]*?const pts = simplifyRoundedRoutePoints\(rawPts\)[\s\S]*?pathMidPoint\(pts\)/,
    'selected-link tools must use the same simplified route geometry as the rendered rounded path',
);

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
    globalThis.__testBuildRoundedRoutePath = buildRoundedRoutePath;
    globalThis.__testSegmentHitsRect = segmentHitsRect;
`, context, { filename: 'whiteboard-edge-obstacle-router.js' });

const backtrackingCorner = context.__testBuildRoundedRoutePath([
    { x: 100, y: 400 },
    { x: 100, y: 40 },
    { x: 100, y: 80 },
    { x: 20, y: 80 },
]);
assert.doesNotMatch(
    backtrackingCorner,
    /100\.00 40\.00/,
    'rounded routes must remove a collinear overshoot instead of drawing a hook before the corner',
);
assert.match(backtrackingCorner, / C /, 'the simplified turn must retain its rounded cubic corner');

const routed = context.__testBuildAvoidPath(
    { x: 723, y: 301 },
    { x: 39, y: 461 },
    ['right-child', 'left'],
    { fromTaskId: 'right-child', toTaskId: 'left' },
);

assert.ok(routed.pts.length >= 6, 'right-to-left links must use an orthogonal avoidance route');
assert.match(routed.d, / C /, 'right-to-left routes must retain cubic rounded corners');
assert.doesNotMatch(routed.d, / Q /, 'right-to-left routes must use the shared cubic geometry');
assert.match(routed.d, / L /, 'right-to-left routes must keep stable straight clearance segments');

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
assert.equal(offsetRouted.pts[1].x, routed.pts[1].x + 24, 'parallel subtask routes must use distinct vertical exit lanes');
assert.equal(Math.abs(offsetRouted.pts[2].y - crossingY), 24, 'parallel subtask routes must also separate their horizontal clearance lanes');

const reverseSourceRect = { taskId: 'reverse-source', x: 420, y: 500, w: 220, h: 80 };
const reverseTargetRect = { taskId: 'reverse-target', x: 80, y: 40, w: 220, h: 80 };
context.obstacleRects.splice(0, context.obstacleRects.length, reverseSourceRect, reverseTargetRect);
context.rectByTaskId.clear();
[reverseSourceRect, reverseTargetRect].forEach((rect) => context.rectByTaskId.set(rect.taskId, rect));
context.rootTaskIdByTaskId.clear();
[reverseSourceRect, reverseTargetRect].forEach((rect) => context.rootTaskIdByTaskId.set(rect.taskId, rect.taskId));

const reverseDiagonal = context.__testBuildAvoidPath(
    { x: 640, y: 540 },
    { x: 80, y: 80 },
    ['reverse-source', 'reverse-target'],
    { fromTaskId: 'reverse-source', toTaskId: 'reverse-target' },
);
assert.ok(reverseDiagonal.pts.length >= 6, 'a clear reverse link must keep the original orthogonal route');
assert.match(reverseDiagonal.d, / C /, 'a clear reverse link must use rounded corners');
assert.match(reverseDiagonal.d, / L /, 'a clear reverse link must keep straight clearance segments');

const reverseObstacleRect = { taskId: 'reverse-obstacle', x: 310, y: 250, w: 130, h: 130 };
context.obstacleRects.splice(1, 0, reverseObstacleRect);
context.rectByTaskId.set(reverseObstacleRect.taskId, reverseObstacleRect);
context.rootTaskIdByTaskId.set(reverseObstacleRect.taskId, reverseObstacleRect.taskId);
const reverseDetour = context.__testBuildAvoidPath(
    { x: 640, y: 540 },
    { x: 80, y: 80 },
    ['reverse-source', 'reverse-target'],
    { fromTaskId: 'reverse-source', toTaskId: 'reverse-target' },
);
assert.ok((reverseDetour.d.match(/ C /g) || []).length > 3, 'a blocked reverse diagonal must fall back to the rounded avoidance corridor');
assert.ok(
    reverseDetour.pts[2].y < (reverseObstacleRect.y - 10)
        || reverseDetour.pts[2].y > (reverseObstacleRect.y + reverseObstacleRect.h + 10),
    'the reverse fallback corridor must clear an intervening card',
);

const forwardSourceRect = { taskId: 'forward-source', x: 40, y: 100, w: 180, h: 80 };
const forwardObstacleRect = { taskId: 'forward-obstacle', x: 330, y: 180, w: 180, h: 160 };
const forwardTargetRect = { taskId: 'forward-target', x: 700, y: 400, w: 180, h: 80 };
context.obstacleRects.splice(0, context.obstacleRects.length, forwardSourceRect, forwardObstacleRect, forwardTargetRect);
context.rectByTaskId.clear();
[forwardSourceRect, forwardObstacleRect, forwardTargetRect].forEach((rect) => context.rectByTaskId.set(rect.taskId, rect));
context.rootTaskIdByTaskId.clear();
[forwardSourceRect, forwardObstacleRect, forwardTargetRect].forEach((rect) => context.rootTaskIdByTaskId.set(rect.taskId, rect.taskId));

const forwardRouted = context.__testBuildAvoidPath(
    { x: 220, y: 140 },
    { x: 700, y: 440 },
    ['forward-source', 'forward-target'],
    { fromTaskId: 'forward-source', toTaskId: 'forward-target' },
);
assert.ok(forwardRouted.pts.length >= 6, 'left-to-right links must detour when the direct Bezier crosses a card');
assert.match(forwardRouted.d, / C /, 'left-to-right detours must use the shared cubic Bezier corner style');
assert.doesNotMatch(forwardRouted.d, / Q /, 'left-to-right links must not switch to quadratic corners');
assert.ok((forwardRouted.d.match(/ C /g) || []).length > 1, 'an obstacle detour must use a multi-segment cubic route');
assert.match(forwardRouted.d, / L /, 'left-to-right detours must keep stable straight clearance segments');
const forwardCrossingY = forwardRouted.pts[2].y;
assert.ok(
    forwardCrossingY < (forwardObstacleRect.y - 10) || forwardCrossingY > (forwardObstacleRect.y + forwardObstacleRect.h + 10),
    'the left-to-right horizontal corridor must clear the intervening card',
);

context.obstacleRects.splice(0, context.obstacleRects.length, forwardSourceRect, forwardTargetRect);
const compactForward = context.__testBuildAvoidPath(
    { x: 220, y: 140 },
    { x: 700, y: 440 },
    ['forward-source', 'forward-target'],
    { fromTaskId: 'forward-source', toTaskId: 'forward-target' },
);
assert.equal(compactForward.pts.length, 25, 'an unobstructed left-to-right Bezier must expose collision samples');
assert.equal((compactForward.d.match(/ C /g) || []).length, 1, 'an unobstructed left-to-right link must use one cubic Bezier');
assert.doesNotMatch(compactForward.d, / L /, 'an unobstructed left-to-right link must not contain right-angle segments');
assert.doesNotMatch(compactForward.d, / Q /, 'all routed links must use one consistent cubic geometry language');
const compactForwardControls = compactForward.d.match(/ C ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)$/);
assert.ok(compactForwardControls, 'the forward Bezier must expose its terminal tangent controls');
assert.notEqual(
    Number(compactForwardControls[4]),
    Number(compactForwardControls[6]),
    'a diagonal side-to-side link must give its arrow the incoming curve angle instead of forcing it horizontal',
);

const compactForwardOffset = context.__testBuildAvoidPath(
    { x: 220, y: 140 },
    { x: 700, y: 440 },
    ['forward-source', 'forward-target'],
    { fromTaskId: 'forward-source', toTaskId: 'forward-target', fromLaneOffset: 24, laneOffset: 24 },
);
assert.notEqual(compactForwardOffset.d, compactForward.d, 'parallel left-to-right subtask links must keep distinct Bezier lanes');
assert.equal((compactForwardOffset.d.match(/ C /g) || []).length, 1, 'parallel forward lanes must remain a single cubic Bezier');

const nearSourceRect = { taskId: 'near-source', x: 40, y: 100, w: 180, h: 80 };
const nearTargetRect = { taskId: 'near-target', x: 244, y: 210, w: 180, h: 80 };
context.obstacleRects.splice(0, context.obstacleRects.length, nearSourceRect, nearTargetRect);
context.rectByTaskId.clear();
[nearSourceRect, nearTargetRect].forEach((rect) => context.rectByTaskId.set(rect.taskId, rect));
context.rootTaskIdByTaskId.clear();
[nearSourceRect, nearTargetRect].forEach((rect) => context.rootTaskIdByTaskId.set(rect.taskId, rect.taskId));
const nearForward = context.__testBuildAvoidPath(
    { x: 220, y: 140 },
    { x: 244, y: 250 },
    ['near-source', 'near-target'],
    { fromTaskId: 'near-source', toTaskId: 'near-target' },
);
assert.equal(
    (nearForward.d.match(/ C /g) || []).length,
    1,
    'nearby forward anchors must keep a compact Bezier even when fixed clearance stubs would overlap',
);
assert.doesNotMatch(nearForward.d, / L /, 'a clear nearby forward link must not fall back to an outer U-shaped corridor');
context.obstacleRects.splice(0, context.obstacleRects.length, forwardSourceRect, forwardTargetRect);
context.rectByTaskId.clear();
[forwardSourceRect, forwardTargetRect].forEach((rect) => context.rectByTaskId.set(rect.taskId, rect));
context.rootTaskIdByTaskId.clear();
[forwardSourceRect, forwardTargetRect].forEach((rect) => context.rootTaskIdByTaskId.set(rect.taskId, rect.taskId));

const verticalAnchored = context.__testBuildAvoidPath(
    { x: 220, y: 180 },
    { x: 700, y: 400 },
    ['forward-source', 'forward-target'],
    {
        fromTaskId: 'forward-source',
        toTaskId: 'forward-target',
        fromAnchor: 'bottom',
        toAnchor: 'top',
    },
);
assert.doesNotMatch(verticalAnchored.d, / L /, 'a clear vertical-anchor link must not add fixed endpoint stubs');
const verticalAnchoredControls = verticalAnchored.d.match(/ C ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)$/);
assert.ok(verticalAnchoredControls, 'a clear vertical-anchor link must remain one cubic Bezier');
assert.notEqual(Number(verticalAnchoredControls[1]), 220, 'the bottom output tangent must blend into the curve direction');
assert.notEqual(Number(verticalAnchoredControls[3]), Number(verticalAnchoredControls[5]), 'the top arrow must follow the incoming curve angle');
assert.ok(Number(verticalAnchoredControls[4]) < 400, 'the top input control must still approach from above');

const nearVerticalSourceRect = { taskId: 'near-vertical-source', x: 275, y: 20, w: 280, h: 80 };
const nearVerticalTargetRect = { taskId: 'near-vertical-target', x: 45, y: 128, w: 280, h: 72 };
context.obstacleRects.splice(0, context.obstacleRects.length, nearVerticalSourceRect, nearVerticalTargetRect);
context.rectByTaskId.clear();
[nearVerticalSourceRect, nearVerticalTargetRect].forEach((rect) => context.rectByTaskId.set(rect.taskId, rect));
context.rootTaskIdByTaskId.clear();
[nearVerticalSourceRect, nearVerticalTargetRect].forEach((rect) => context.rootTaskIdByTaskId.set(rect.taskId, rect.taskId));
const nearVertical = context.__testBuildAvoidPath(
    { x: 416, y: 100 },
    { x: 185, y: 128 },
    ['near-vertical-source', 'near-vertical-target'],
    {
        fromTaskId: 'near-vertical-source',
        toTaskId: 'near-vertical-target',
        fromAnchor: 'bottom',
        toAnchor: 'top',
    },
);
assert.equal((nearVertical.d.match(/ C /g) || []).length, 1, 'nearby bottom-to-top anchors must keep one compact Bezier');
assert.doesNotMatch(nearVertical.d, / L /, 'nearby vertical anchors must not reintroduce endpoint stubs');
context.obstacleRects.splice(0, context.obstacleRects.length, forwardSourceRect, forwardTargetRect);
context.rectByTaskId.clear();
[forwardSourceRect, forwardTargetRect].forEach((rect) => context.rectByTaskId.set(rect.taskId, rect));
context.rootTaskIdByTaskId.clear();
[forwardSourceRect, forwardTargetRect].forEach((rect) => context.rootTaskIdByTaskId.set(rect.taskId, rect.taskId));

const verticalReverseX = context.__testBuildAvoidPath(
    { x: 700, y: 180 },
    { x: 220, y: 400 },
    ['forward-source', 'forward-target'],
    {
        fromTaskId: 'forward-source',
        toTaskId: 'forward-target',
        fromAnchor: 'bottom',
        toAnchor: 'top',
    },
);
assert.equal(
    (verticalReverseX.d.match(/ C /g) || []).length,
    1,
    'a clear top-to-bottom link must remain one Bezier when the target is to the left',
);
assert.doesNotMatch(verticalReverseX.d, / L /, 'a clear leftward top-to-bottom link must not add endpoint stubs');

const mixedSourceRect = { taskId: 'mixed-source', x: 460, y: 30, w: 380, h: 110 };
const mixedTargetRect = { taskId: 'mixed-target', x: 50, y: 365, w: 390, h: 75 };
context.obstacleRects.splice(0, context.obstacleRects.length, mixedSourceRect, mixedTargetRect);
context.rectByTaskId.clear();
[mixedSourceRect, mixedTargetRect].forEach((rect) => context.rectByTaskId.set(rect.taskId, rect));
context.rootTaskIdByTaskId.clear();
[mixedSourceRect, mixedTargetRect].forEach((rect) => context.rootTaskIdByTaskId.set(rect.taskId, rect.taskId));

const rightToLowerTop = context.__testBuildAvoidPath(
    { x: 840, y: 85 },
    { x: 245, y: 365 },
    ['mixed-source', 'mixed-target'],
    {
        fromTaskId: 'mixed-source',
        toTaskId: 'mixed-target',
        fromAnchor: 'right',
        toAnchor: 'top',
    },
);
assert.ok(rightToLowerTop.pts.length >= 6, 'a right output linking to a lower-left top input must avoid re-entering its source card');
assert.ok(rightToLowerTop.pts[1].x > mixedSourceRect.x + mixedSourceRect.w, 'the mixed-anchor route must clear the source card on the right before turning');
assert.ok(
    rightToLowerTop.pts[2].y > mixedSourceRect.y + mixedSourceRect.h + 10,
    'the mixed-anchor route must turn back left only after clearing the source card vertically',
);
assert.ok((rightToLowerTop.d.match(/ C /g) || []).length > 1, 'the self-avoiding mixed-anchor route must keep the shared rounded-corner style');

const nestedSourceRootRect = { taskId: 'nested-source-root', x: 195, y: 40, w: 344, h: 514 };
const nestedSourceChildRect = { taskId: 'nested-source-child', x: 208, y: 195, w: 331, h: 46 };
const nestedTargetRect = { taskId: 'nested-target', x: 55, y: 630, w: 344, h: 100 };
context.obstacleRects.splice(0, context.obstacleRects.length, nestedSourceRootRect, nestedTargetRect);
context.rectByTaskId.clear();
[nestedSourceRootRect, nestedSourceChildRect, nestedTargetRect].forEach((rect) => context.rectByTaskId.set(rect.taskId, rect));
context.rootTaskIdByTaskId.clear();
context.rootTaskIdByTaskId.set('nested-source-root', 'nested-source-root');
context.rootTaskIdByTaskId.set('nested-source-child', 'nested-source-root');
context.rootTaskIdByTaskId.set('nested-target', 'nested-target');

const nestedChildToLowerTop = context.__testBuildAvoidPath(
    { x: 539, y: 218 },
    { x: 227, y: 630 },
    ['nested-source-child', 'nested-target'],
    {
        fromTaskId: 'nested-source-child',
        toTaskId: 'nested-target',
        fromAnchor: 'right',
        toAnchor: 'top',
    },
);
assert.equal((nestedChildToLowerTop.d.match(/ C /g) || []).length, 1, 'an unobstructed subtask output must retain the original direct Bezier');
assert.doesNotMatch(nestedChildToLowerTop.d, / L /, 'the direct right-to-top route must not add endpoint stubs');
const nestedChildControls = nestedChildToLowerTop.d.match(/ C ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)$/);
assert.ok(nestedChildControls, 'the direct right-to-top route must remain one cubic Bezier');
assert.ok(Number(nestedChildControls[1]) > 539, 'the direct subtask route must still leave through its right side');
assert.notEqual(Number(nestedChildControls[3]), 227, 'the direct subtask route arrow must follow the incoming curve angle');
assert.ok(Number(nestedChildControls[4]) < 630, 'the direct subtask route must still approach the top anchor from above');

const lowerParentToNestedChild = context.__testBuildAvoidPath(
    { x: 227, y: 730 },
    { x: 208, y: 218 },
    ['nested-target', 'nested-source-child'],
    {
        fromTaskId: 'nested-target',
        toTaskId: 'nested-source-child',
        fromAnchor: 'bottom',
        toAnchor: 'left',
    },
);
assert.ok(lowerParentToNestedChild.pts.length >= 6, 'a parent output linking to a subtask must route around the subtask parent card');
assert.ok(
    lowerParentToNestedChild.pts[lowerParentToNestedChild.pts.length - 2].x < nestedSourceRootRect.x - 10,
    'a parent-to-subtask route must reach the outside of the target parent card before entering the child',
);
assert.equal(
    lowerParentToNestedChild.pts[lowerParentToNestedChild.pts.length - 2].y,
    lowerParentToNestedChild.pts[lowerParentToNestedChild.pts.length - 1].y,
    'a parent-to-subtask route must enter the child through a horizontal final segment',
);
assert.ok((lowerParentToNestedChild.d.match(/ C /g) || []).length > 1, 'parent-to-subtask avoidance must retain rounded corners');

const upperParentRect = { taskId: 'upper-parent', x: 65, y: -80, w: 330, h: 100 };
context.obstacleRects.splice(0, context.obstacleRects.length, nestedSourceRootRect, upperParentRect);
context.rectByTaskId.set(upperParentRect.taskId, upperParentRect);
context.rootTaskIdByTaskId.set(upperParentRect.taskId, upperParentRect.taskId);
const upperParentToNestedChild = context.__testBuildAvoidPath(
    { x: 400, y: 20 },
    { x: 208, y: 218 },
    ['upper-parent', 'nested-source-child'],
    {
        fromTaskId: 'upper-parent',
        toTaskId: 'nested-source-child',
        fromAnchor: 'bottom',
        toAnchor: 'left',
    },
);
assert.ok((upperParentToNestedChild.d.match(/ C /g) || []).length > 1, 'a bottom output that would enter the child parent through its top must use an avoidance route');
assert.ok(
    upperParentToNestedChild.pts[upperParentToNestedChild.pts.length - 2].x < nestedSourceRootRect.x - 10,
    'the avoided bottom-to-child route must reach the target parent left side before entering the child',
);

const flushNestedRootRect = { taskId: 'flush-nested-root', x: 92, y: 303, w: 247, h: 371 };
const flushNestedChildRect = { taskId: 'flush-nested-child', x: 92, y: 552, w: 247, h: 52 };
const alignedUpperParentRect = { taskId: 'aligned-upper-parent', x: 85, y: 84, w: 247, h: 72 };
context.obstacleRects.splice(0, context.obstacleRects.length, flushNestedRootRect, alignedUpperParentRect);
context.rectByTaskId.clear();
[flushNestedRootRect, flushNestedChildRect, alignedUpperParentRect].forEach((rect) => context.rectByTaskId.set(rect.taskId, rect));
context.rootTaskIdByTaskId.clear();
context.rootTaskIdByTaskId.set('flush-nested-root', 'flush-nested-root');
context.rootTaskIdByTaskId.set('flush-nested-child', 'flush-nested-root');
context.rootTaskIdByTaskId.set('aligned-upper-parent', 'aligned-upper-parent');
const alignedBottomToFlushChild = context.__testBuildAvoidPath(
    { x: 208, y: 156 },
    { x: 92, y: 578 },
    ['aligned-upper-parent', 'flush-nested-child'],
    {
        fromTaskId: 'aligned-upper-parent',
        toTaskId: 'flush-nested-child',
        fromAnchor: 'bottom',
        toAnchor: 'left',
    },
);
assert.ok(
    (alignedBottomToFlushChild.d.match(/ C /g) || []).length > 1,
    'a bottom-to-child curve must detour when it exits at the child edge after already crossing the target parent card',
);
assert.ok(
    alignedBottomToFlushChild.pts[alignedBottomToFlushChild.pts.length - 2].x < flushNestedRootRect.x - 10,
    'the detour must remain outside the full parent card until its final horizontal entry into the child',
);
for (let i = 1; i < alignedBottomToFlushChild.pts.length - 1; i++) {
    assert.equal(
        context.__testSegmentHitsRect(
            alignedBottomToFlushChild.pts[i - 1],
            alignedBottomToFlushChild.pts[i],
            flushNestedRootRect,
            10,
        ),
        false,
        'the detour must not cross the target parent before its final child-entry segment',
    );
}

const leftParentRect = { taskId: 'left-parent', x: -210, y: 20, w: 180, h: 100 };
context.obstacleRects.splice(0, context.obstacleRects.length, nestedSourceRootRect, leftParentRect);
context.rectByTaskId.set(leftParentRect.taskId, leftParentRect);
context.rootTaskIdByTaskId.set(leftParentRect.taskId, leftParentRect.taskId);
const leftParentToNestedChild = context.__testBuildAvoidPath(
    { x: -120, y: 120 },
    { x: 208, y: 218 },
    ['left-parent', 'nested-source-child'],
    {
        fromTaskId: 'left-parent',
        toTaskId: 'nested-source-child',
        fromAnchor: 'bottom',
        toAnchor: 'left',
    },
);
assert.equal((leftParentToNestedChild.d.match(/ C /g) || []).length, 1, 'a clear bottom-to-child curve that enters through the target parent left side must remain direct');
assert.doesNotMatch(leftParentToNestedChild.d, / L /, 'the clear bottom-to-left route must not add endpoint stubs');

const nestedBlockerRect = { taskId: 'nested-blocker', x: 405, y: 300, w: 130, h: 150 };
context.obstacleRects.splice(0, context.obstacleRects.length, nestedSourceRootRect, nestedBlockerRect, nestedTargetRect);
context.rectByTaskId.set(nestedBlockerRect.taskId, nestedBlockerRect);
context.rootTaskIdByTaskId.set(nestedBlockerRect.taskId, nestedBlockerRect.taskId);
const blockedNestedChildRoute = context.__testBuildAvoidPath(
    { x: 539, y: 218 },
    { x: 227, y: 630 },
    ['nested-source-child', 'nested-target'],
    {
        fromTaskId: 'nested-source-child',
        toTaskId: 'nested-target',
        fromAnchor: 'right',
        toAnchor: 'top',
    },
);
assert.ok((blockedNestedChildRoute.d.match(/ C /g) || []).length > 1, 'a blocked subtask link must switch from the direct Bezier to an avoidance route');
for (let i = 1; i < blockedNestedChildRoute.pts.length; i++) {
    const a = blockedNestedChildRoute.pts[i - 1];
    const b = blockedNestedChildRoute.pts[i];
    assert.equal(
        context.__testSegmentHitsRect(a, b, nestedBlockerRect, 10),
        false,
        'the blocked subtask avoidance route must not pass through the intervening card',
    );
}

const overlapSourceRect = { taskId: 'overlap-source', x: 100, y: 100, w: 220, h: 100 };
const overlapTargetRect = { taskId: 'overlap-target', x: 100, y: 100, w: 220, h: 100 };
const distantRect = { taskId: 'distant-card', x: 5000, y: -5000, w: 200, h: 100 };
context.obstacleRects.splice(0, context.obstacleRects.length, overlapSourceRect, overlapTargetRect, distantRect);
context.rectByTaskId.clear();
[overlapSourceRect, overlapTargetRect, distantRect].forEach((rect) => context.rectByTaskId.set(rect.taskId, rect));
context.rootTaskIdByTaskId.clear();
[overlapSourceRect, overlapTargetRect, distantRect].forEach((rect) => context.rootTaskIdByTaskId.set(rect.taskId, rect.taskId));
const overlappingCardsRoute = context.__testBuildAvoidPath(
    { x: 320, y: 150 },
    { x: 100, y: 150 },
    ['overlap-source', 'overlap-target'],
    { fromTaskId: 'overlap-source', toTaskId: 'overlap-target' },
);
assert.ok(overlappingCardsRoute.d, 'overlapping endpoint cards must still render their connection');
assert.ok(overlappingCardsRoute.pts.length >= 2, 'the overlap fallback must retain usable route geometry');
assert.ok(
    overlappingCardsRoute.pts.every((point) => Math.abs(point.x) < 1000 && Math.abs(point.y) < 1000),
    'a distant unrelated card must not pull a fallback route across the canvas',
);

const lowerSourceRect = { taskId: 'lower-source', x: 500, y: 400, w: 180, h: 80 };
const upperTargetRect = { taskId: 'upper-target', x: 100, y: 100, w: 180, h: 80 };
context.obstacleRects.splice(0, context.obstacleRects.length, lowerSourceRect, upperTargetRect);
context.rectByTaskId.clear();
[lowerSourceRect, upperTargetRect].forEach((rect) => context.rectByTaskId.set(rect.taskId, rect));
context.rootTaskIdByTaskId.clear();
[lowerSourceRect, upperTargetRect].forEach((rect) => context.rootTaskIdByTaskId.set(rect.taskId, rect.taskId));

const reverseVertical = context.__testBuildAvoidPath(
    { x: 590, y: 480 },
    { x: 190, y: 100 },
    ['lower-source', 'upper-target'],
    {
        fromTaskId: 'lower-source',
        toTaskId: 'upper-target',
        fromAnchor: 'bottom',
        toAnchor: 'top',
    },
);
assert.ok(reverseVertical.pts.length >= 6, 'a bottom-to-top reverse link must use a side avoidance corridor');
assert.ok(reverseVertical.pts[1].y > lowerSourceRect.y + lowerSourceRect.h, 'the reverse link must leave below its source card');
assert.ok(reverseVertical.pts[4].y < upperTargetRect.y, 'the reverse link must approach above its target card');
assert.equal(reverseVertical.pts[2].x, reverseVertical.pts[3].x, 'the avoidance corridor must have one stable vertical lane');
[lowerSourceRect, upperTargetRect].forEach((rect) => {
    assert.ok(
        reverseVertical.pts[2].x < rect.x - 10
            || reverseVertical.pts[2].x > rect.x + rect.w + 10,
        `the reverse vertical lane must stay outside the ${rect.taskId} card`,
    );
});
assert.match(reverseVertical.d, / C /, 'the reverse vertical avoidance corridor must retain rounded corners');
assert.doesNotMatch(compactForward.d, /^M 220\.00 140\.00 L /, 'existing right-to-left anchors must keep the original direct Bezier');

console.log('whiteboard edge obstacle routing tests passed');
