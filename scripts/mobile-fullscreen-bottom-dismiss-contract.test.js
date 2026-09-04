'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/45-render-shell-controls-and-resize.js'),
    'utf8',
);
const css = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
const runtimeSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/40-render-runtime.js'),
    'utf8',
);
const bindStart = source.indexOf('function __tmBindMobileFullscreenBottomViewbarSwipe');
const bindEnd = source.indexOf('function __tmMarkMobileBottomViewbarSwitching', bindStart);
const gesture = source.slice(bindStart, bindEnd);
const beginStart = gesture.indexOf('const beginInput =');
const moveStart = gesture.indexOf('const moveInput =', beginStart);
const moveEnd = gesture.indexOf('const onPointerDown =', moveStart);
const begin = gesture.slice(beginStart, moveStart);
const move = gesture.slice(moveStart, moveEnd);
const renderRuntime = runtimeSource.slice(runtimeSource.indexOf('function render()'), runtimeSource.indexOf('function render()', runtimeSource.indexOf('function render()') + 1));
const closeStart = gesture.indexOf('const close =');
const closeEnd = gesture.indexOf('const runCssDismiss =', closeStart);
const closeBlock = gesture.slice(closeStart, closeEnd);

assert.ok(bindStart >= 0 && bindEnd > bindStart, 'the mobile fullscreen bottom-bar gesture must be bound');
assert.match(
    gesture,
    /modal\.classList\.contains\('tm-modal--dock'\)\) return false;/,
    'mobile Dock hosts must stay outside the fullscreen dismiss gesture',
);
assert.doesNotMatch(
    begin,
    /setPageScrollLock\(true\)/,
    'a bottom navigation tap must not synchronously mutate the page scroll lock',
);
assert.match(
    move,
    /if \(axis !== 'y'\) return;[\s\S]*setPageScrollLock\(true\)/,
    'the page scroll lock must start only after vertical drag intent is confirmed',
);
assert.match(
    move,
    /dy < 0 && Math\.abs\(dy\) >= resolveDismissThreshold\(\)[\s\S]*axis === 'y'[\s\S]*finishDismiss\(-1\)/,
    'a full-distance upward move must dismiss when the WebView does not deliver a usable release event',
);
assert.match(
    gesture,
    /if \(Number\(direction\) !== -1\) return;/,
    'the dismiss finalizer must reject every non-upward direction',
);
assert.doesNotMatch(
    gesture,
    /finishDismiss\(dy < 0 \? -1 : 1\)/,
    'downward movement must not be routed to the dismiss finalizer',
);
assert.doesNotMatch(
    gesture,
    /resolveDismissThreshold\(dy\)/,
    'dismiss threshold must not have a special downward branch',
);
assert.match(
    gesture,
    /const isVerticalIntent = \(dx, dy\) =>[\s\S]*absY >= absX \* 0\.8/,
    'vertical intent must allow a natural diagonal finger path',
);
assert.match(
    gesture,
    /Math\.max\(24, Math\.min\(44, Math\.round\(viewportHeight \* 0\.04\)\)\)/,
    'the upward dismiss distance must stay reachable from the bottom hit area',
);
assert.doesNotMatch(
    move,
    /axis = 'x'/,
    'a diagonal start must not permanently lock the gesture to horizontal scrolling',
);
assert.doesNotMatch(
    move,
    /quickVerticalIntent/,
    'short high-velocity movement must remain finger-led until the input stream ends',
);
assert.match(
    css,
    /\.tm-modal\.tm-modal--mobile:not\(\.tm-modal--dock\) \.tm-mobile-bottom-viewbar \{[\s\S]*pointer-events: auto !important;[\s\S]*height: 52px;[\s\S]*min-height: 52px;/,
    'the fullscreen bar itself must be a full-width transparent hit surface',
);
assert.match(
    runtimeSource,
    /\.tm-modal\.tm-modal--mobile:not\(\.tm-modal--dock\) \.tm-mobile-bottom-viewbar \{[\s\S]*pointer-events: auto;[\s\S]*height: 52px;[\s\S]*min-height: 52px;/,
    'runtime-injected mobile styles must expose the fullscreen bar hit surface',
);
assert.match(
    runtimeSource,
    /mobileBottomViewbarDismissDragging === true[\s\S]*document\.body\.contains\(dismissingModal\)\) return;/,
    'render must stay paused while a bottom-bar touch stream is in flight',
);
assert.match(
    css,
    /html\.tm-task-horizon-mobile-dismiss-drag[\s\S]*\.tm-main-stage > :not\(\.tm-mobile-bottom-viewbar\)[\s\S]*pointer-events: none !important;/,
    'recognized vertical drags must isolate the plugin view from event penetration',
);
assert.match(
    runtimeSource,
    /html\.tm-task-horizon-mobile-dismiss-drag[\s\S]*\.tm-main-stage > :not\(\.tm-mobile-bottom-viewbar\)[\s\S]*pointer-events: none !important;/,
    'runtime-injected styles must preserve event isolation before the external stylesheet settles',
);
assert.match(
    css,
    /tm-mobile-bottom-viewbar--gesture-active \{[\s\S]*touch-action: none !important;/,
    'recognized vertical drags must take exclusive touch ownership from the plugin view',
);
assert.match(
    closeBlock,
    /window\.tmClose\(\)[\s\S]*finally[\s\S]*clearMotionStyles\(\);/,
    'the modal must be removed before animation styles are cleared to avoid a table-view flash',
);

console.log('mobile fullscreen bottom dismiss contract tests passed');
