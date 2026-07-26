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
