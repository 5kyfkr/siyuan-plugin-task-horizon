const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

assert.match(source, /const __tmCalendarModuleLifecycleAbort = new AbortController\(\);/);

for (const eventName of ['touchstart', 'pointerdown', 'mousedown']) {
    const listenerPattern = new RegExp(
        `document\\.addEventListener\\('${eventName}', ensureFullCalendarExternalDragHostForEvent, \\{[^}]*signal: __tmCalendarModuleLifecycleAbort\\.signal[^}]*\\}\\);`
    );
    assert.match(source, listenerPattern, `${eventName} listener must use the module lifecycle signal`);
}

const cleanupStart = source.indexOf('\n    function cleanup()');
const cleanupEnd = source.indexOf('\n    function setSettingsStore(', cleanupStart);
assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart, 'calendar cleanup function must exist');
const cleanupSource = source.slice(cleanupStart, cleanupEnd);

assert.match(cleanupSource, /__tmCalendarModuleLifecycleAbort\.abort\(\)/);
assert.match(cleanupSource, /globalThis\.__tmCalendarDebugLog === __tmCalendarDebugLog/);
assert.match(cleanupSource, /delete globalThis\.__tmCalendarDebugLog/);

assert.doesNotMatch(source, /calendar-side-visibility-restore|calendar-main-visibility-restore/,
    'calendar instances must not install visibility-restore relayout workarounds');
assert.doesNotMatch(source, /resizeSkipAfterVisibility/,
    'calendar resize handling must not carry visibility-specific skip state');
assert.doesNotMatch(source, /window\.dispatchEvent\(new Event\(['"]resize['"]\)\)/,
    'calendar visibility restore must not dispatch a global resize event');
assert.doesNotMatch(source, /scheduleScheduleReminderRefresh\(['"]visibility['"]\)/,
    'calendar visibility restore must not duplicate the background reminder refresh');
assert.doesNotMatch(source, /handleWindowResize\s*:/,
    'FullCalendar 7 does not support handleWindowResize; rely on container observers instead');
assert.match(source, /calendarResizeObserver\.observe\(calendarHost\)/,
    'main calendar must observe its host container for size changes');

console.log('calendar module lifecycle contract tests passed');
