const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

assert.match(source, /const __tmCalendarModuleLifecycleAbort = new AbortController\(\);/);

for (const eventName of ['touchstart', 'pointerdown', 'mousedown']) {
    const listenerPattern = new RegExp(
        `document\\.addEventListener\\('${eventName}', ensureCalendarEngineExternalDragHostForEvent, \\{[^}]*signal: __tmCalendarModuleLifecycleAbort\\.signal[^}]*\\}\\);`
    );
    assert.match(source, listenerPattern, `${eventName} listener must use the module lifecycle signal`);
}

const cleanupStart = source.indexOf('\n    function cleanup()');
const cleanupEnd = source.indexOf('\n    function setSettingsStore(', cleanupStart);
assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart, 'calendar cleanup function must exist');
const cleanupSource = source.slice(cleanupStart, cleanupEnd);

assert.match(cleanupSource, /__tmCalendarModuleLifecycleAbort\.abort\(\)/);
assert.match(source, /function closeTrackedPrototypeEventPopover\(\)[\s\S]*state\.__tmPrototypeEventPopover = null/,
    'body-level event detail popovers must have a shared tracked cleanup');
assert.match(source, /function unmount\(options = \{\}\)[\s\S]*closeTrackedPrototypeEventPopover\(\)/,
    'calendar unmount must dispose body-level event detail popovers');
assert.doesNotMatch(source, /__tmCalendarDebugLog/,
    'calendar diagnostics must not leave a production debug-log hook');
assert.doesNotMatch(source, /protoResizeLog|logMainCalendarHostDefault/,
    'calendar diagnostics must not leave inert resize or host-default log hooks');

assert.doesNotMatch(source, /calendar-side-visibility-restore|calendar-main-visibility-restore/,
    'calendar instances must not install visibility-restore relayout workarounds');
assert.doesNotMatch(source, /resizeSkipAfterVisibility/,
    'calendar resize handling must not carry visibility-specific skip state');
assert.doesNotMatch(source, /window\.dispatchEvent\(new Event\(['"]resize['"]\)\)/,
    'calendar visibility restore must not dispatch a global resize event');
assert.doesNotMatch(source, /scheduleScheduleReminderRefresh\(['"]visibility['"]\)/,
    'calendar visibility restore must not duplicate the background reminder refresh');
assert.doesNotMatch(source, /handleWindowResize\s*:/,
    'calendar engine 7 does not support handleWindowResize; rely on container observers instead');
assert.match(source, /calendarResizeObserver\.observe\(calendarHost\)/,
    'main calendar must observe its host container for size changes');

console.log('calendar module lifecycle contract tests passed');
