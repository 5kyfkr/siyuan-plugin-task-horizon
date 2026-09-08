'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const uiFoundation = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');

assert.match(
    source,
    /const isCalendarEngineManagedDrag = \(\) => \{[\s\S]*?const managed = !taskDragActive && hasMirror;[\s\S]*?return managed;\s*\};/,
    'native table/checklist task drags must not be mistaken for calendar-event drags',
);
assert.match(
    source,
    /if \(!payload\?\.taskId \|\| !Number\.isFinite\(x\) \|\| !Number\.isFinite\(y\)\) \{\s*return \{ overMainCalendar: false, overSideDay: false, main: null, side: null, payload: payload \|\| null \};\s*\}/,
    'a floating-mini update without a task payload must not clear another view drag state',
);

function readFunction(sourceText, name, context = {}) {
    const start = sourceText.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} must be defined`);
    const signatureEnd = sourceText.indexOf(') {', start);
    const bodyStart = signatureEnd >= 0 ? signatureEnd + 2 : sourceText.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < sourceText.length; index += 1) {
        if (sourceText[index] === '{') depth += 1;
        if (sourceText[index] === '}') depth -= 1;
        if (depth === 0) return vm.runInNewContext(`(${sourceText.slice(start, index + 1)})`, context);
    }
    assert.fail(`${name} must have a complete function body`);
}

const getCalendarLongPressDelay = readFunction(source, 'getCalendarLongPressDelay', {
    getCalendarOption: (calendar, name) => calendar?.[name],
});
assert.equal(getCalendarLongPressDelay({ eventLongPressDelay: 900 }, 'eventLongPressDelay'), 900);
assert.equal(getCalendarLongPressDelay({ selectLongPressDelay: 950 }, 'selectLongPressDelay'), 950);
assert.equal(getCalendarLongPressDelay({ longPressDelay: 750 }, 'eventLongPressDelay'), 750);
assert.equal(getCalendarLongPressDelay({}, 'eventLongPressDelay', 600), 600);

class FakeElement {}
class FakeHTMLElement extends FakeElement {}
const dropCanvas = new FakeHTMLElement();
const dropColumns = ['2026-09-07', '2026-09-08'].map((dayKey, index) => {
    const element = new FakeHTMLElement();
    element.getAttribute = () => dayKey;
    element.getBoundingClientRect = () => ({ left: index * 200, right: (index + 1) * 200, top: 50, bottom: 1000 });
    element.closest = (selector) => selector === '.tm-proto-time-canvas' ? dropCanvas
        : selector.includes('.tm-proto-time-col') ? element : null;
    return element;
});
const dropAllDay = Object.assign(new FakeHTMLElement(), {
    getAttribute: () => '2026-09-08',
    getBoundingClientRect: () => ({ left: 200, right: 400, top: 0, bottom: 50 }),
    closest: () => null,
});
const dropHost = Object.assign(new FakeHTMLElement(), {
    querySelector: () => dropHost,
    querySelectorAll: (selector) => selector === '.tm-proto-time-col' ? dropColumns
        : selector === '.tm-proto-allday-cell' ? [dropAllDay] : [],
    contains: () => true,
});
const dropDocument = {
    elementFromPoint: () => dropColumns[0],
    elementsFromPoint: () => [],
};
const resolveDropHit = readFunction(source, 'resolveMainCalendarDropHitFromPoint', {
    Element: FakeElement,
    HTMLElement: FakeHTMLElement,
    state: {},
    document: dropDocument,
    getSettings: () => ({}),
    prototypeTimelineMinutesAtPoint: () => 547,
    getCalendarView: () => ({ type: 'timeGridWeek' }),
    shouldIgnoreCalendarExternalDragHitElement: () => false,
});
const timedHit = resolveDropHit(dropHost, dropColumns[0], 100, 350);
assert.ok(timedHit, 'a direct time-column hit must retain the element, not a boolean');
assert.equal(timedHit.start.getDate(), 7);
assert.equal(timedHit.start.getHours(), 9);
assert.equal(timedHit.start.getMinutes(), 0, 'timed drops must retain 15-minute snapping');
assert.equal(timedHit.allDay, false);
const nestedDropTarget = Object.assign(new FakeHTMLElement(), { closest: (selector) => dropColumns[0].closest(selector) });
assert.ok(resolveDropHit(dropHost, nestedDropTarget, 100, 350), 'nested event targets must resolve their time column');
assert.ok(resolveDropHit(dropHost, null, 100, 350), 'touch drops must resolve the element under the pointer');
const adjacentHit = resolveDropHit(dropHost, dropColumns[0], 200, 350);
assert.equal(adjacentHit.start.getDate(), 8, 'a stale target at a column boundary must use pointer geometry');
const allDayHit = resolveDropHit(dropHost, dropColumns[0], 250, 25);
assert.equal(allDayHit.allDay, true, 'the all-day lane must take precedence over a stale timed target');
assert.equal(allDayHit.start.getDate(), 8);
assert.equal(resolveDropHit(dropHost, dropColumns[0], 500, 350), null, 'out-of-grid drops must not create a schedule');

const canvas = Object.assign(new FakeHTMLElement(), {
    getBoundingClientRect: () => ({ top: 0, height: 1000 }),
});
const column = Object.assign(new FakeHTMLElement(), {
    closest: () => column,
    getAttribute: () => '2026-08-24',
    getBoundingClientRect: () => ({ left: 100, right: 300 }),
});
const nextColumn = Object.assign(new FakeHTMLElement(), {
    closest: () => nextColumn,
    getAttribute: () => '2026-08-25',
    getBoundingClientRect: () => ({ left: 300, right: 500 }),
});
const surface = Object.assign(new FakeHTMLElement(), {
    querySelector: () => canvas,
    querySelectorAll: () => [column, nextColumn],
    contains: (element) => element === column || element === nextColumn,
});
const resolvePrototypeSelectionRange = readFunction(source, 'resolvePrototypeSelectionRange', {
    Element: FakeElement,
    HTMLElement: FakeHTMLElement,
    document: { elementFromPoint: (x) => x >= 300 ? nextColumn : column },
    parseCalendarTimeToMinutes: (value) => {
        const [hours, minutes] = String(value).split(':').map(Number);
        return hours * 60 + minutes;
    },
});
const selectionRange = resolvePrototypeSelectionRange(
    surface,
    { dayKey: '2026-08-24', clientY: 250 },
    200,
    500,
    { visibleStartTime: '06:00', visibleEndTime: '24:00' },
);
assert.equal(selectionRange.start.getHours(), 10, 'selection preview start hour must follow the pointer');
assert.equal(selectionRange.start.getMinutes(), 30, 'selection preview start must snap to 15 minutes');
assert.equal(selectionRange.end.getHours(), 15, 'selection preview end hour must follow the pointer');
assert.equal(selectionRange.end.getMinutes(), 0, 'selection preview end must snap to 15 minutes');
const crossDayRange = resolvePrototypeSelectionRange(
    surface,
    { dayKey: '2026-08-24', clientY: 750 },
    400,
    250,
    { visibleStartTime: '06:00', visibleEndTime: '24:00' },
);
assert.equal(crossDayRange.start.getDate(), 24, 'cross-column selection must retain its starting date');
assert.equal(crossDayRange.end.getDate(), 25, 'cross-column selection must follow the pointer date');

const checkboxGuard = "if (target?.closest?.('.tm-proto-event-check, .tm-cal-task-event-check')) return;";
assert.equal(source.split(checkboxGuard).length - 1, 2, 'main and side event drags must ignore checkbox presses');
assert.doesNotMatch(
    source,
    /eventApi\.allDay === true && prototypeEventDrag\.eventCell\?\.matches\?\.\('\.tm-proto-month-cell'\)/,
    'dragging a single-day all-day card must not raise the whole month cell over neighboring cross-day bars',
);
assert.match(
    source,
    /eventApi\?\.allDay === true && drag\.isMonthCell && !drag\.resizeEdge[\s\S]*?getPrototypeAllDayDragDates\(drag, eventApi, targetDay\)[\s\S]*?drag\.previewMode = 'allday'/,
    'month all-day movement must keep its preview in the all-day range renderer',
);
assert.match(
    source,
    /eventApi\?\.allDay !== true && drag\.isMonthCell && !drag\.resizeEdge/,
    'month timed movement must not reuse the all-day preview branch',
);
assert.match(
    source,
    /const resolvePrototypeAllDayCellAtPoint = \(drag, clientX, clientY\) =>[\s\S]*?const allDayRect = allDay\.getBoundingClientRect\?\.[\s\S]*?return cells\.find\(\(cell\) =>/,
    'week all-day dragging must resolve the all-day lane from pointer geometry',
);
assert.match(
    source,
    /const timedDrop = !drag\.resizeEdge && !allDayCell\s*\n\s*\? resolvePrototypeTimedDropAtPoint/,
    'week all-day dragging must enter the time axis only after leaving the all-day lane',
);
assert.match(
    source,
    /if \(allDayCell && drag\.originStart instanceof Date && drag\.originEnd instanceof Date\)[\s\S]*?drag\.previewMode = 'allday';[\s\S]*?renderPrototypeSurface\(\);[\s\S]*?return;/,
    'returning from the time axis must rerender the all-day preview instead of translating the stale timed card',
);
assert.match(
    source,
    /prototypeEventDrag\.previewMode === 'timed'[\s\S]*?prototypeEventDrag\.previewMode === 'allday'/,
    'week all-day preview ranges must participate in prototype rerendering',
);
assert.match(
    source,
    /const timedDrop = eventApi\.allDay === true && !drag\.resizeEdge\s*\n\s*&& !resolvePrototypeAllDayCellAtPoint\(drag, event\.clientX, event\.clientY\)/,
    'pointerup must use the same all-day lane boundary as pointermove',
);
assert.match(
    source,
    /const previousCell = drag\.eventCell[\s\S]*?previousCell\.classList\.remove\('tm-proto-cell--dragging'\)[\s\S]*?if \(drag\.resizeEdge\)[\s\S]*?drag\.eventCell\?\.classList\?\.add\?\.\('tm-proto-cell--dragging'\)/,
    'drag preview rebinding must only raise the date cell for resize operations',
);
assert.match(
    source,
    /if \(source === 'tomato'\) \{\s*openRecordModal\(eventApi\);/,
    'tomato popover editing must open the existing record editor',
);
assert.match(
    source,
    /if \(action === 'jumpTask'\) \{\s*const jumped = taskBlockId \? await openCalendarLinkedTask\(taskBlockId, e\) : false;[\s\S]*if \(jumped !== false\) closeModal\(\);/,
    'the tomato record dialog must use the shared task navigation path',
);
assert.doesNotMatch(
    source,
    /if \(action === 'jumpTask'\) \{[\s\S]{0,300}siyuan\?\.block\?\.scrollToBlock/,
    'the tomato record dialog must not depend only on the optional scrollToBlock API',
);
assert.match(
    source,
    /eventApi && !drag\.resizeEdge && event\.pointerType !== 'mouse'/,
    'mouse clicks must rely on the click delegate instead of opening a duplicate popover on pointerup',
);
assert.match(
    source,
    /surface\.addEventListener\('touchmove',[\s\S]{0,180}?sidePrototypeEventDrag\?\.started \|\| sidePrototypePointerSelection\?\.started[\s\S]{0,120}?passive: false/,
    'the side touch drag must block scrolling only after long press activation',
);
assert.match(
    source,
    /prototypeSurface\.addEventListener\('touchmove',[\s\S]{0,180}?prototypeEventDrag\?\.started \|\| prototypePointerSelection\?\.started[\s\S]{0,120}?passive: false/,
    'the main touch drag must block scrolling only after long press activation',
);
assert.doesNotMatch(source, /setCalendarTouchGestureLock/, 'obsolete synchronous gesture locks must be removed');
assert.match(source, /renderPrototypeSelectionPreview\(surface, selection, range\)/, 'the side blank-range drag must render the shared live preview');
assert.match(source, /renderPrototypeSelectionPreview\(prototypeSurface, selection, range\)/, 'the main blank-range drag must render the shared live preview');
const sideDateClickStart = source.indexOf("const panel = target?.closest?.('.tm-proto-side-panel')");
const sideDateClickEnd = source.indexOf("surface.addEventListener('contextmenu'", sideDateClickStart);
assert.ok(sideDateClickStart >= 0 && sideDateClickEnd > sideDateClickStart, 'side date-click handler must remain inspectable');
const sideDateClick = source.slice(sideDateClickStart, sideDateClickEnd);
assert.match(sideDateClick, /const timeArea = target\?\.closest\?\.\('\.tm-proto-time-col'\)/);
assert.match(sideDateClick, /const canvas = target\?\.closest\?\.\('\.tm-proto-time-canvas'\)/);
assert.match(sideDateClick, /if \(canvas instanceof HTMLElement && !\(timeArea instanceof HTMLElement\)\) return;/, 'side time-axis clicks must not create a timed schedule outside a real day column');
assert.match(styles, /\.tm-proto-day-panel\s*>\s*header\s*\{[^}]*min-height:\s*40px;[^}]*padding:\s*3px 8px;/, 'the side panel header must stay compact while retaining button clearance');
const prototypeClickStart = source.indexOf("prototypeSurface.addEventListener('click'");
const prototypeViewStart = source.indexOf("else if (action === 'view')", prototypeClickStart);
assert.ok(prototypeClickStart >= 0 && prototypeViewStart > prototypeClickStart, 'prototype view click handler must remain inspectable');
const prototypeClickPrefix = source.slice(prototypeClickStart, prototypeViewStart);
const prototypeViewAction = source.slice(prototypeViewStart, prototypeViewStart + 5000);
assert.match(prototypeClickPrefix, /const activeCalendar = state\.calendar \|\| calendar;/, 'prototype actions must resolve the live main calendar');
assert.match(prototypeViewAction, /deferMainCalendarViewDataLoad\(activeCalendar, viewType\)/, 'prototype view changes must defer their data load');
assert.match(prototypeViewAction, /callCalendarAdapter\(activeCalendar, 'changeView', viewType, targetDate\)/, 'prototype view buttons must synchronously commit the requested view');
assert.match(source, /tm-proto-segmented bc-tabs-list/, 'calendar toolbar must use the Basecoat tabs list component');
assert.match(source, /tm-proto-view-btn tm-view-seg-item bc-tabs-trigger/, 'calendar view buttons must use the Basecoat tabs trigger component');
assert.match(source, /data-state="\$\{active \? 'active' : 'inactive'\}"/, 'calendar view tabs must expose Basecoat active state');
assert.match(source, /aria-selected="\$\{active \? 'true' : 'false'\}"/, 'calendar view tabs must expose aria-selected state');
assert.match(source, /tm-proto-opacity-btn tm-btn tm-btn-info bc-btn bc-btn--sm/, 'calendar opacity control must use Basecoat button classes');
assert.match(source, /protoToolbarIcon\('circle-half'\)/, 'calendar opacity control must use the Phosphor Bold circle-half icon');
assert.match(source, /tm-proto-toolbar-spacer[\s\S]*tm-proto-segmented bc-tabs-list[\s\S]*tm-proto-opacity-btn/, 'calendar view switcher must sit immediately before the opacity control');
assert.match(source, /tm-proto-opacity-btn[^>]*aria-label="不透明度"[^>]*title="不透明度"[^>]*>\$\{protoToolbarIcon\('circle-half'\)\}<\/button>/, 'calendar opacity control must expose a tooltip without visible text');
assert.match(source, /tm-proto-day-btn[^>]*aria-label="单日"[^>]*title="单日"[^>]*>\$\{protoToolbarIcon\('calendar-blank'\)\}<\/button>/, 'calendar day-panel control must expose a tooltip without visible text');
assert.doesNotMatch(source, /tm-proto-opacity-btn[\s\S]{0,260}<span>不透明度<\/span>/, 'calendar opacity control must not render a visible text label');
assert.doesNotMatch(source, /tm-proto-day-btn[\s\S]{0,260}<span>单日<\/span>/, 'calendar day-panel control must not render a visible text label');
assert.match(source, /tm-proto-view-select-wrap[\s\S]*tm-proto-view-select[\s\S]*data-tm-proto-view-select/, 'calendar toolbar must provide a mobile view select control');
assert.match(source, /prototypeSurface\.addEventListener\('change',[\s\S]*data-tm-proto-view-select[\s\S]*dispatchEvent\(new MouseEvent\('click'/, 'mobile view select must reuse the deferred tab switch interaction');
assert.match(source, /className} tm-btn tm-btn-info bc-btn bc-btn--sm/, 'side day panel controls must reuse the Basecoat button component');
assert.match(source, /if \(sideAction === 'prev'\) \{\s*shiftSideDay\(-1\);[\s\S]*sideAction === 'next'\) \{\s*shiftSideDay\(1\);/, 'side day panel arrows must shift the shared side calendar date directly');
assert.match(source, /prototypeShowDayPanel && prototypePanelDate instanceof Date \? protoDateKey\(prototypePanelDate\) : ''/, 'main day panel date must participate in the prototype render cache key');
assert.doesNotMatch(source, /meta\.push\('重复'\)/, 'calendar event cards must not render the repeat metadata label');
assert.doesNotMatch(source, /__tmRepeatCalendarMode \? '重复' : ''/, 'shared calendar event cards must not render the repeat metadata label');
assert.match(styles, /\.tm-proto-month-cell\.is-today\s*\{[^}]*box-shadow:\s*inset 0 0 0 1px var\(--tm-cal-primary\)/, 'month view today cell must use a theme-colored highlight border');
assert.match(uiFoundation, /__tmPhosphorBoldPaths\['circle-half'\]\s*=\s*'/, 'the shared Phosphor Bold icon table must include circle-half');
assert.match(uiFoundation, /globalThis\.__tmPhosphorBoldSvg\s*=\s*__tmPhosphorBoldSvg/, 'the shared Phosphor renderer must be exported for the independent calendar script');
assert.match(styles, /\.tm-proto-toolbar\s*\{[\s\S]*--radius:\s*var\(--tm-topbar-control-radius/, 'calendar toolbar must inherit the appearance control radius setting');
assert.match(styles, /\.tm-proto-toolbar \.bc-btn\s*\{[\s\S]*border:\s*var\(--tm-topbar-control-border-width/, 'calendar buttons must inherit the appearance control border width setting');
assert.doesNotMatch(
    source,
    /<button[^>]+data-tm-proto-action="refresh"/,
    'calendar toolbar must not render the removed refresh button',
);
assert.match(
    source,
    /key === 'calendarLinkDockTomato'[\s\S]{0,1000}refreshDockTomatoCalendarData\(state\.calendar\)/,
    'the Dock Tomato setting must use the shared immediate refresh path',
);
assert.match(
    source,
    /function refreshDockTomatoCalendarData\(/,
    'the shared Dock Tomato refresh helper must exist',
);
assert.match(source, /clearDockHistoryRangeCache\(\);/, 'Dock Tomato refresh must invalidate its range cache');
assert.match(source, /loadRecordsForRange\(rangeStart, rangeEnd\)/, 'Dock Tomato refresh must preload the visible range');
assert.match(source, /__tmRefetchCalendarSource\(calendar, EVENT_SOURCE_IDS\.mainAux\)/, 'Dock Tomato refresh must refetch the main source');
assert.match(source, /if \(master === 'tomato'\) \{\s*try \{ refreshDockTomatoCalendarData\(calendar\);/, 'the sidebar Tomato master switch must use the shared refresh path');
assert.match(styles, /\.tm-proto-time-col > \.tm-proto-event--block\.tm-proto-selection-preview/, 'selection preview styling must use event-card geometry');

console.log('calendar interaction regression contract tests passed');
