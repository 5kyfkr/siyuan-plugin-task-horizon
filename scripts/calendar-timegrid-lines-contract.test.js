'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const formaTheme = fs.readFileSync(path.join(root, 'src/fullcalendar/themes/forma/global.js'), 'utf8');
const todayTimeGridRule = styles.match(/\.fc-timegrid-col\.fc-day-today\s*\{([\s\S]*?)\}/)?.[1] || '';

assert.match(
    source,
    /const CALENDAR_TIMEGRID_SLOT_MINUTES = 15;/,
    'time-grid behavior must use one 15-minute slot constant',
);
assert.match(
    source,
    /const slotDuration = formatCalendarDurationFromMinutes\(CALENDAR_TIMEGRID_SLOT_MINUTES\);[\s\S]*?slotDuration,[\s\S]*?snapDuration: slotDuration,[\s\S]*?slotMinHeight: getCalendarTimeGridSlotHeight\(nextSettings\)[\s\S]*?slotHeaderInterval: getCalendarSlotHeaderInterval\(visibleRange\)/,
    'FullCalendar slot, snap, and existing label interval settings must share the 15-minute grid layout',
);
assert.equal(
    (source.match(/const slotLayout = getTimeGridSlotLayoutOptions\(/g) || []).length,
    2,
    'main and side calendars must share the same time-grid layout options',
);
assert.match(
    source,
    /function getCalendarTimeGridSlotHeight\(settings\) \{[\s\S]*?return getCalendarHalfHourSlotHeight\(settings\) \/ 2;/,
    'each 15-minute slot must be half of the configured half-hour height',
);
assert.match(
    styles,
    /--tm-calendar-half-hour-slot-height:\s*var\(--tm-cal-slot-half-hour-height[^;]*;[\s\S]*?--tm-calendar-timegrid-slot-height:\s*calc\(var\(--tm-calendar-half-hour-slot-height\) \/ 2\);/,
    'the actual slot height must retain the legacy half-hour variable as its source',
);
assert.match(
    styles,
    /\.fc-timegrid-slot[\s\S]*?height:\s*var\(--tm-calendar-timegrid-slot-height, 14\.5px\) !important;/,
    'stable slot-height rules must use the actual 15-minute slot variable',
);
assert.match(
    source,
    /function getCalendarQuarterHourSlotClass\(info\) \{[\s\S]*?minute === 15 \|\| minute === 45 \? 'tm-cal-timegrid-slot-quarter' : '';/,
    'quarter-hour slots must expose one stable semantic class',
);
assert.match(
    source,
    /slotHeaderClass:[\s\S]*?getCalendarQuarterHourSlotClass\(info\)[\s\S]*?slotLaneClass:[\s\S]*?getCalendarQuarterHourSlotClass\(info\)/,
    'FullCalendar must add the quarter-hour class to both axis labels and timed lanes',
);
assert.match(
    source,
    /node\.classList\.contains\('tm-cal-timegrid-slot-quarter'\)[\s\S]*?node\.style\.setProperty\('border-top', '0', 'important'\);/,
    'time-grid layout sync must force quarter-hour borders off even when theme rules are important',
);
assert.match(
    source,
    /const slotCount = Math\.max\(1, Math\.round\(totalMinutes \/ CALENDAR_TIMEGRID_SLOT_MINUTES\)\);[\s\S]*?return slotCount \* getCalendarTimeGridSlotHeight\(settings\);/,
    'time-grid content height must preserve total hourly density with 15-minute slots',
);
assert.match(
    source,
    /targetContentY = contentStartY \+ \(\(nowMinutes - guard\.startMinutes\) \/ CALENDAR_TIMEGRID_SLOT_MINUTES\) \* slotHeight;/,
    'current-time centering must use the shared 15-minute slot geometry',
);
assert.match(
    source,
    /const startMinutes = getVisibleStartMinutes\(\) \+ slotIndex \* CALENDAR_TIMEGRID_SLOT_MINUTES;/,
    'side-calendar touch hit fallback must resolve 15-minute positions',
);
assert.match(
    source,
    /\(eventStartMinutes - startMinutesBase\) \/ CALENDAR_TIMEGRID_SLOT_MINUTES[\s\S]*?previewDurationMin \/ CALENDAR_TIMEGRID_SLOT_MINUTES/,
    'side-calendar drag preview position and height must share the 15-minute geometry',
);
assert.equal(
    (source.match(/info\?\.allDay === true \? 24 \* 60 : 30/g) || []).length,
    2,
    'main and side date clicks must retain the 30-minute creation default',
);

assert.match(
    todayTimeGridRule,
    /background-color:\s*color-mix\(in srgb, var\(--fc-today-bg-color\) 22%, transparent\) !important;/,
    'today highlight must stay faint enough for the original slot lines to remain visible',
);
assert.match(
    todayTimeGridRule,
    /background-image:\s*none\s*!important;/,
    'today column must rely on the original slot DOM instead of drawing a second grid',
);
assert.doesNotMatch(
    todayTimeGridRule,
    /repeating-linear-gradient/,
    'today column must not add repeated lines that can drift from the slot DOM',
);
assert.doesNotMatch(
    styles,
    /\.fc-timegrid-col\.fc-day-today::before/,
    'today grid lines must not depend on a synthetic overlay with separate geometry',
);
assert.match(
    source,
    /const row = allDayWrap\.closest\('tr, \[role="row"\]'\);/,
    'all-day separator lookup must support FullCalendar div rows',
);
assert.match(
    source,
    /const bottomBorder = isDivRow \? '1px solid var\(--fc-border-color\)' : '0';[\s\S]*setImp\(row, 'border-bottom', bottomBorder\);/,
    'div-based all-day rows must retain their bottom separator',
);
assert.match(
    formaTheme,
    /fillerClass:\s*"[^"]*\btm-cal-scrollgrid-filler\b[^"]*"/,
    'scrollbar compensation cells must expose a stable semantic class',
);
assert.match(
    source,
    /querySelectorAll\('\.fc-timegrid\.fc-scrollgrid,[^']*'\)[\s\S]*?setImp\(el, 'border-inline-start', '0'\);/,
    'time-grid outer-edge cleanup must match the v7 combined root and logical start border',
);
assert.match(
    source,
    /querySelectorAll\('\.fc-timegrid\.fc-scrollgrid,[^']*'\)[\s\S]*?setImp\(el, 'border-inline-end', '0'\);/,
    'time-grid outer-edge cleanup must remove the logical end border',
);
assert.match(
    styles,
    /\.fc-timegrid \.tm-cal-scrollgrid-filler\s*\{[\s\S]*?border-inline-start:\s*0 !important;/,
    'scrollbar compensation cells must not draw a leading edge line',
);
assert.match(
    styles,
    /\.fc-timegrid\.fc-scrollgrid\s*\{[\s\S]*?border-inline-start:\s*0 !important;/,
    'the combined v7 time-grid root must not draw an outer leading edge line',
);
assert.match(
    styles,
    /\.fc-timegrid\.fc-scrollgrid\s*\{[\s\S]*?border-inline-end:\s*0 !important;/,
    'the combined v7 time-grid root must not draw an outer trailing edge line',
);
assert.match(
    styles,
    /\.fc-dayGridMonth-view\.fc-scrollgrid\s*\{[\s\S]*?border-inline-start:\s*0 !important;[\s\S]*?border-inline-end:\s*0 !important;/,
    'the combined v7 month-grid root must not draw outer vertical edge lines',
);

console.log('calendar time-grid line contract tests passed');
