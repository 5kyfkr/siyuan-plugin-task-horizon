'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'),
    'utf8'
);
const lifecycle = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/shell/80-shell-lifecycle.js'),
    'utf8'
);
const wakeBindingStart = runtime.indexOf('function __tmBindWakeReload');
const wakeBindingEnd = runtime.indexOf('let __tmOriginalCenterSwitchTab', wakeBindingStart);
assert.ok(wakeBindingStart >= 0 && wakeBindingEnd > wakeBindingStart,
    'wake binding must remain independently inspectable');
const wakeBinding = runtime.slice(wakeBindingStart, wakeBindingEnd);

assert.match(runtime,
    /requestIdleCallback\(run, \{ timeout: 900 \}\)/,
    'visible resume work must yield to an idle period before refreshing the view');
assert.match(runtime,
    /__tmVisibleResumeLastRunAt[\s\S]*< 1200/,
    'repeated visibility/focus events must be coalesced during a short cooldown');
assert.match(runtime,
    /void __tmScheduleVisibleResumeSync\('visibilitychange'\)/,
    'visibilitychange must not await the refresh pipeline on the event turn');
assert.match(runtime,
    /void __tmScheduleVisibleResumeSync\('focus'\)/,
    'focus must not await the refresh pipeline on the event turn');
assert.match(runtime,
    /if \(interactionWait > 0\)[\s\S]*setTimeout\(run, Math\.max\(48, interactionWait\)\)/,
    'visible-resume work must yield while a high-priority interaction is active');
assert.doesNotMatch(wakeBinding,
    /getComputedStyle|getBoundingClientRect|offset(?:Width|Height|Top|Left)|client(?:Width|Height|Top|Left)/,
    'visibilitychange must not trigger synchronous style or layout reads');
assert.match(wakeBinding,
    /modal\.isConnected === false[\s\S]*modal\.hidden === true[\s\S]*getAttribute\?\.\('aria-hidden'\)[\s\S]*modalStyle\.display === 'none'/,
    'visibilitychange must use non-layout DOM visibility state');
assert.match(lifecycle,
    /__tmVisibleResumeIdleHandleKind === 'idle'[\s\S]*cancelIdleCallback/,
    'destroy must cancel queued idle resume work');
assert.match(lifecycle,
    /clearTimeout\(__tmVisibleResumeSyncTimer\)/,
    'destroy must cancel the delayed visible-resume timer');

console.log('visibility resume performance contract tests passed');
