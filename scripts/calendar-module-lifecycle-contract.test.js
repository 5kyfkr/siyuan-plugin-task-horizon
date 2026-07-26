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

console.log('calendar module lifecycle contract tests passed');
