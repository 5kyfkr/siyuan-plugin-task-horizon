const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const calendarStyles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const storeSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'),
    'utf8',
);
const exportSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/settings/64-export-runtime.js'),
    'utf8',
);

function readFunction(source, name) {
    const start = source.indexOf(`function ${name}(value) {`);
    assert.ok(start >= 0, `${name} must be defined`);
    const end = source.indexOf('\n    }', start);
    assert.ok(end > start, `${name} must have a complete function body`);
    return vm.runInNewContext(`(${source.slice(start, end + 6)})`);
}

for (const normalize of [
    readFunction(calendarSource, 'normalizeCalendarEventFontSize'),
    readFunction(storeSource, '__tmNormalizeCalendarEventFontSize'),
]) {
    assert.equal(normalize(undefined), 11, 'missing values must use the default');
    assert.equal(normalize(''), 11, 'empty values must use the default');
    assert.equal(normalize('invalid'), 11, 'invalid values must use the default');
    assert.equal(normalize(9), 10, 'values below the range must clamp to 10');
    assert.equal(normalize(12.6), 13, 'fractional values must normalize to an integer');
    assert.equal(normalize(15), 14, 'values above the range must clamp to 14');
}

assert.match(storeSource, /calendarEventFontSize:\s*11,/, 'the store must define the default value');
assert.match(
    storeSource,
    /cloudData\.calendarEventFontSize[\s\S]*?__tmNormalizeCalendarEventFontSize\(cloudData\.calendarEventFontSize\)/,
    'cloud restore must normalize the setting',
);
assert.match(
    storeSource,
    /Storage\.get\('tm_calendar_event_font_size',[\s\S]*?Storage\.set\('tm_calendar_event_font_size'/,
    'local persistence must use the calendar event font-size key',
);
const calendarExportKeysStart = exportSource.indexOf('const TM_CALENDAR_SETTING_KEYS');
const calendarExportKeysEnd = exportSource.indexOf('\n    const TM_SETTINGS_EXPORT_EXCLUDED_KEYS', calendarExportKeysStart);
assert.ok(calendarExportKeysStart >= 0 && calendarExportKeysEnd > calendarExportKeysStart, 'calendar export keys must be discoverable');
assert.match(
    exportSource.slice(calendarExportKeysStart, calendarExportKeysEnd),
    /'calendarEventFontSize'/,
    'calendar settings exports must include the event font-size setting',
);
assert.match(
    calendarSource,
    /document\.documentElement\.style\.setProperty\('--tm-cal-event-font-size',\s*`\$\{size\}px`\)/,
    'runtime updates must write the global CSS variable',
);
assert.match(
    calendarSource,
    /type="number" min="10" max="14" step="1"[^>]*data-tm-cal-setting="calendarEventFontSize"/,
    'settings must expose a bounded native number input',
);
assert.match(
    calendarSource,
    /key === 'calendarEventFontSize'[\s\S]*?normalizeCalendarEventFontSize\(el\.value\)[\s\S]*?applyCalendarEventFontSize\(store\.data\.calendarEventFontSize\)/,
    'settings changes must normalize and apply the value',
);
assert.match(
    calendarStyles,
    /--tm-cal-event-title-font-size:\s*var\(--tm-cal-event-font-size,\s*11px\)/,
    'event titles must consume the global setting',
);
assert.match(
    calendarStyles,
    /--tm-cal-event-time-font-size:\s*calc\(var\(--tm-cal-event-font-size,\s*11px\)\s*-\s*1px\)/,
    'event times must remain one pixel smaller than titles',
);
assert.match(calendarStyles, /\.tm-proto-event-title\s*\{[\s\S]*?font-size:\s*var\(--tm-cal-event-title-font-size,\s*11px\)/, 'prototype event titles must consume the shared title size');
assert.match(calendarStyles, /\.tm-proto-span-title\s*\{[\s\S]*?font-size:\s*var\(--tm-cal-event-title-font-size,\s*11px\)/, 'cross-day event titles must consume the shared title size');

const prototypeTitleRules = [...calendarStyles.matchAll(/([^{}]*(?:\.tm-proto-event-title|\.tm-proto-span-title)[^{}]*)\{([^{}]*)\}/g)];
assert.ok(prototypeTitleRules.length > 0, 'prototype title rules must be discoverable');
for (const [, selector, declarations] of prototypeTitleRules) {
    const fontSize = declarations.match(/font-size:\s*([^;!}]+)/)?.[1]?.trim();
    if (!fontSize) continue;
    const hidesContinuationTitle = fontSize === '0' && selector.includes('.is-span-continuation');
    const isCompactMonthTitle = selector.includes('.tm-calendar-root--month-view .tm-proto-event--chip.tm-proto-month-event .tm-proto-event-title')
        || selector.includes('.tm-proto-surface--compact-month .tm-proto-event--chip:not(.tm-proto-month-event) .tm-proto-event-title');
    if (isCompactMonthTitle) {
        assert.match(
            declarations,
            /font-size:\s*(?:9|10\.5)px\s*!important/,
            `compact month event titles must retain their fixed compact size: ${selector.trim()}`,
        );
        continue;
    }
    assert.ok(
        hidesContinuationTitle || fontSize.startsWith('var(--tm-cal-event-title-font-size,'),
        `prototype event title font size must use the setting variable: ${selector.trim()}`,
    );
}
assert.match(calendarStyles, /\.tm-proto-event-time\s*\{[\s\S]*font-size:\s*10px/, 'prototype event times must remain visually subordinate');
assert.match(calendarStyles, /\.tm-proto-list-time\s*\{[\s\S]*font-size:\s*11px/, 'prototype list rows must retain a compact time column');

console.log('calendar event font-size contract tests passed');
