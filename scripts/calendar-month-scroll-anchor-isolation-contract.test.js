'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');

assert.match(
    source,
    /mainCalendarNonMonthAnchorDate:\s*null/,
    'main calendar state must keep a date anchor separate from month scrolling',
);
assert.match(
    source,
    /function rememberMainCalendarNonMonthAnchorDate\(calendar, viewType, date\)[\s\S]*state\.mainCalendarNonMonthAnchorDate\s*=\s*new Date\(nextDate\.getTime\(\)\)/,
    'non-month navigation must update the independent date anchor',
);
assert.match(
    source,
    /function getMainCalendarViewSwitchSourceDate\(calendar, currentView\)[\s\S]*viewType === 'dayGridMonth'[\s\S]*state\.mainCalendarNonMonthAnchorDate/,
    'month-to-other-view switches must read the independent date anchor',
);
assert.match(
    source,
    /const currentDate = getMainCalendarViewSwitchSourceDate\(cal, currentView\)/,
    'compact view selection must use the isolated switch date',
);
assert.match(
    source,
    /const currentDate = getMainCalendarViewSwitchSourceDate\(activeCalendar, currentView\)/,
    'prototype view selection must use the isolated switch date',
);
assert.match(
    source,
    /const currentDate = getMainCalendarViewSwitchSourceDate\(calendar, currentView\)/,
    'legacy view selection must use the isolated switch date',
);
assert.match(
    source,
    /const activeViewType = String\(getCalendarView\(calendar\)\?\.type \|\| ''\)\.trim\(\);[\s\S]*activeViewType !== 'dayGridMonth'[\s\S]*rememberMainCalendarNonMonthAnchorDate\(calendar, activeViewType\)/,
    'datesSet must only refresh the independent anchor for non-month views',
);
assert.doesNotMatch(
    source,
    /const currentDate = \(currentView === 'dayGridMonth'[\s\S]*prototypeMonthScrollAnchorDate/,
    'view switches must not use the month scroll anchor as their source date',
);
assert.match(
    source,
    /const userScrollSinceCapture = capturedAt > 0[\s\S]*if \(Math\.abs\(before - expected\) > 1 && \(userInputSinceCapture \|\| userScrollSinceCapture\)\) \{[\s\S]*schedulePrototypeMonthScrollSync\(scroller\)[\s\S]*return false/,
    'month loading must not restore a stale scroll snapshot after the user moved the virtual strip',
);
assert.match(
    source,
    /prototypeSurface\.addEventListener\('pointerdown', prototypeMonthUserInputListener[\s\S]*prototypeSurface\.addEventListener\('touchstart', prototypeMonthUserInputListener/,
    'month scrollbar and touch gestures must be tracked as user input during loading',
);
assert.match(
    source,
    /let prototypeMonthPendingScrollRestore = null[\s\S]*const restorePrototypeMonthPendingScroll = \(scroller\)[\s\S]*targetTop > 0 && maxTop <= 0[\s\S]*return false/,
    'month re-entry must retain a pending anchor while the new canvas has no scroll range yet',
);
assert.match(
    source,
    /const syncPrototypeMonthVirtualWindow = \(scroller, options = \{\}\)[\s\S]*pendingTargetTop[\s\S]*actualScrollTop <= 1[\s\S]*pendingTargetTop/,
    'month virtualization must use the pending target instead of requesting the 1970 viewport during re-entry',
);
assert.match(
    source,
    /syncPrototypeMonthVirtualWindow\(scroller, \{ reason: 'scroll-sync' \}\);[\s\S]*if \(prototypeMonthPendingScrollRestore\) return false/,
    'month cue detection must not persist a transient zero scrollTop while restoration is pending',
);
assert.match(
    source,
    /const transientEpochCue = date\.getFullYear\(\) === 1970[\s\S]*engineAnchor\.getFullYear\(\) !== 1970[\s\S]*if \(transientEpochCue\) \{[\s\S]*return false/,
    'month cue detection must ignore the virtual epoch when the engine is anchored in the real month',
);

console.log('calendar month scroll anchor isolation contract tests passed');
