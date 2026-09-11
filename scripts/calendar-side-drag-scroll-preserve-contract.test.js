'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const sidePanels = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', 'render', '47-render-side-panels-and-view-switching.js'), 'utf8');

assert.match(
    source,
    /let sidePrototypeDragScrollSnapshot = null[\s\S]*beginSidePrototypeDragScrollSnapshot[\s\S]*scrollTop = scroller instanceof HTMLElement \? Number\(scroller\.scrollTop \|\| 0\)/,
    'side event drag must capture the current time scroller position',
);
assert.match(
    source,
    /autoCenterSuppressed = true[\s\S]*autoCenterToken = Number\(sideState\.autoCenterToken \|\| 0\) \+ 1/,
    'side event drag must invalidate pending auto-center retries',
);
assert.match(
    source,
    /scope === 'sideDay' && state\.sideDay\?\.autoCenterSuppressed === true\) return false/,
    'side auto-center must stay disabled while an event drag owns the viewport',
);
assert.match(
    source,
    /const dragScrollTop = state\.sideDay\?\.autoCenterSuppressed === true[\s\S]*const restoreTimeScrollTop = Number\.isFinite\(dragScrollTop\) \? dragScrollTop : previousTimeScrollTop/,
    'side prototype repaint must prefer the drag scroll snapshot',
);
assert.match(
    source,
    /finishSidePrototypeDragScroll\(surface, true\)/,
    'accepted side event drags must restore the viewport after repaint',
);
assert.match(
    source,
    /bindPrototypeSurfacePointerHandler\(surface, 'pointerdown', \(event\) => \{[\s\S]*\}, true\);[\s\S]*bindPrototypeSurfacePointerHandler\(surface, 'pointermove', \(event\) => \{[\s\S]*\}, true\);[\s\S]*bindPrototypeSurfacePointerHandler\(surface, 'pointerup', \(event\) => \{/,
    'side event gesture handlers must run before host gesture delegation',
);
assert.match(
    source,
    /event\.pointerType === 'touch' \|\| event\.pointerType === 'pen'[\s\S]*surface\.setPointerCapture\?\.\(event\.pointerId\)[\s\S]*if \(distance > 4 && !drag\.moved\)[\s\S]*drag\.moved = true[\s\S]*surface\.setPointerCapture\?\.\(event\.pointerId\)/,
    'mouse taps must keep their native click target until the drag threshold is crossed',
);
assert.match(
    source,
    /const getSidePrototypeEvent = \(activeCalendar, eventId\) =>[\s\S]*getCalendarEvents\(activeCalendar\)\.find/,
    'side event drags must resolve events from the current side calendar store',
);
assert.match(
    source,
    /const sidePrototypeDayStart = \(value\) =>[\s\S]*timeDayStart: timeDayKey \? sidePrototypeDayStart/,
    'side event drags must use a date helper defined in the side timeline scope',
);
assert.doesNotMatch(
    source.slice(source.indexOf('function mountSideDayTimeline'), source.indexOf('function mountSideDayTimeline') + 110000),
    /\bprotoDayStart\(/,
    'side timeline drag code must not reference the main prototype date helper',
);
assert.match(
    sidePanels,
    /const prototypeTimeScroller = root\.querySelector\('\.tm-proto-time-scroll'\)[\s\S]*if \(prototypeTimeScroller instanceof HTMLElement\) return prototypeTimeScroller/,
    'persistent side-dock transfers must recognize the prototype time scroller',
);

console.log('calendar side drag scroll preserve contract tests passed');
