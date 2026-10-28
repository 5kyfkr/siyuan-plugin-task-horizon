'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');

function readFunction(name) {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, name);
    const end = source.indexOf('\n    }', start);
    assert.ok(end > start, `${name} must end at a top-level closing brace`);
    return source.slice(start, end + 6);
}

// Calendar chrome controls must draw their arrows through one shared Phosphor
// renderer so no paging control depends on the active text font.
const helper = readFunction('buildCalendarChromeIcon');
assert.match(
    helper,
    /globalThis\.__tmPhosphorBoldSvg[\s\S]*renderIcon\(name, \{ size, className \}\)/,
    'calendar chrome icons must reuse the shared Phosphor bold renderer',
);
assert.match(
    helper,
    /function buildCalendarChromeIcon\(name, size = 14, className = 'tm-cal-chrome-icon'\)/,
    'the shared chrome icon must default to the 14px topbar icon size',
);

const panelSource = readFunction('buildSharedPrototypeDayPanelMarkup');
assert.match(
    panelSource,
    /const actionIcon = \(name\) => \(typeof buildCalendarChromeIcon === 'function'\s*\? buildCalendarChromeIcon\(name, 14\)/,
    'the day panel must step with the calendar toolbar chevrons at topbar size',
);
assert.match(
    panelSource,
    /const prevIcon = actionIcon\('chevron-left'\);\s*const nextIcon = actionIcon\('chevron-right'\);\s*const closeIcon = actionIcon\('x'\);/,
    'the day panel must step with chevrons and close with an x icon',
);

const pagingControls = [
    ['mini calendar previous month', /data-tm-mini-action="prev"[^>]*aria-label="上个月"[^>]*>\$\{buildCalendarChromeIcon\('chevron-left', 12\)\}/],
    ['mini calendar next month', /data-tm-mini-action="next"[^>]*aria-label="下个月"[^>]*>\$\{buildCalendarChromeIcon\('chevron-right', 12\)\}/],
    ['mini calendar month picker previous year', /data-tm-mini-year-step="-1"[^>]*>\$\{buildCalendarChromeIcon\('chevron-left', 14\)\}/],
    ['mini calendar month picker next year', /data-tm-mini-year-step="1"[^>]*>\$\{buildCalendarChromeIcon\('chevron-right', 14\)\}/],
    ['list view previous week', /data-tm-proto-list-action="prev-week"[^>]*>\$\{buildCalendarChromeIcon\('chevron-left', 18\)\}/],
    ['list view next week', /data-tm-proto-list-action="next-week"[^>]*>\$\{buildCalendarChromeIcon\('chevron-right', 18\)\}/],
    ['inline date hub previous month', /data-tm-proto-hub-month="-1"[^>]*>\$\{buildCalendarChromeIcon\('chevron-left', 12\)\}/],
    ['inline date hub next month', /data-tm-proto-hub-month="1"[^>]*>\$\{buildCalendarChromeIcon\('chevron-right', 12\)\}/],
    ['holiday editor previous year', /data-tm-holiday-editor-action="prev-year"[^>]*>\$\{buildCalendarChromeIcon\('chevron-left', 18\)\}/],
    ['holiday editor previous month', /data-tm-holiday-editor-action="prev-month"[^>]*>\$\{buildCalendarChromeIcon\('chevron-left', 18\)\}/],
    ['holiday editor next month', /data-tm-holiday-editor-action="next-month"[^>]*>\$\{buildCalendarChromeIcon\('chevron-right', 18\)\}/],
    ['holiday editor next year', /data-tm-holiday-editor-action="next-year"[^>]*>\$\{buildCalendarChromeIcon\('chevron-right', 18\)\}/],
];
for (const [label, pattern] of pagingControls) {
    assert.match(source, pattern, `${label} must render a chevron icon instead of a text glyph`);
}
assert.doesNotMatch(
    source,
    /data-tm-(?:mini-action|mini-year-step|proto-list-action|proto-hub-month|holiday-editor-action)="(?:prev|next|-?1)[^"]*"[^>]*>[‹›×]</,
    'no calendar paging control may fall back to the ‹ › × text glyphs',
);

// One shared sizing rule, then per-surface overrides that keep each control's
// original optical weight.
assert.match(
    styles,
    /\.tm-cal-chrome-icon\{[\s\S]*?width: 14px;[\s\S]*?height: 14px;[\s\S]*?display: block;[\s\S]*?fill: currentColor;[\s\S]*?stroke: none;[\s\S]*?pointer-events: none;/,
    'calendar chrome icons must be 14px filled glyphs that keep clicks on the button',
);
assert.match(styles, /\.tm-mini-cal-btn \.tm-cal-chrome-icon\{\s*width: 12px;\s*height: 12px;/, 'mini calendar arrows must stay compact');
assert.match(styles, /\.tm-proto-list-week-nav \.tm-cal-chrome-icon,\s*\.tm-calendar-holiday-editor__toolbar \.tm-cal-chrome-icon\{\s*width: 18px;\s*height: 18px;/, 'week and holiday paging arrows must match their taller targets');
assert.match(styles, /\.tm-proto-inline-hub-month-actions \.tm-cal-chrome-icon\{width:12px;height:12px\}/, 'date hub arrows must fit the compact month head');
assert.doesNotMatch(styles, /\.tm-proto-day-panel-actions \.tm-proto-icon-btn\{[^}]*font-family/, 'day panel buttons must not depend on a font family');

// Render the shared day panel header with the Phosphor renderer stubbed so the
// test can prove which icons reach the DOM and at what size.
function renderDayPanel(renderIcon) {
    const sandbox = {
        Date,
        getSettings: () => ({}),
        formatDateKey: () => '2026-10-28',
        esc: (value) => String(value ?? ''),
        buildSharedPrototypeTimelineMarkup: () => '<div class="tm-proto-timeline"></div>',
    };
    if (renderIcon) sandbox.__tmPhosphorBoldSvg = renderIcon;
    const context = vm.createContext(sandbox);
    vm.runInContext(`${helper}\n${panelSource}`, context);
    return context.buildSharedPrototypeDayPanelMarkup({ date: new Date(2026, 9, 28) });
}

const rendered = renderDayPanel((name, options = {}) => `<svg class="${options.className || ''}" data-icon="${name}" width="${options.size || 0}" height="${options.size || 0}"></svg>`);
assert.doesNotMatch(rendered, /[‹›×]/, 'the rendered day panel header must not contain text glyph buttons');
for (const icon of ['chevron-left', 'chevron-right', 'x']) {
    assert.match(
        rendered,
        new RegExp(`<svg class="tm-cal-chrome-icon" data-icon="${icon}" width="14" height="14"></svg>`),
        `the rendered day panel header must contain the ${icon} icon at 14px`,
    );
}
for (const label of ['前一天', '今天', '后一天', '关闭']) {
    assert.match(rendered, new RegExp(`title="${label}"`), `the day panel must keep the ${label} hit target labelled`);
}

// Without the shared renderer the controls stay as labelled buttons instead of
// reintroducing font-dependent glyphs (the contract fixtures evaluate this
// builder on its own).
const degraded = renderDayPanel(null);
assert.doesNotMatch(degraded, /[‹›×]/, 'the day panel must never fall back to text glyph buttons');
assert.match(degraded, /title="关闭"/, 'the close button must still be labelled without the icon renderer');

console.log('calendar chrome icon contract tests passed');
