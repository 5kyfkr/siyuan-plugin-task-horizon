'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');

assert.match(
    source,
    /function getCalendarUpdateSizeSignature\(calendar, rootEl, scope\)[\s\S]*activeStart[\s\S]*dayMaxEventRows/,
    'calendar layout must derive updateSize invalidation from dimensions and view/options',
);
assert.match(
    source,
    /function syncSideDayLayout\(rootEl, calendar, settings(?:, trace = null)?\)[\s\S]*lastUpdateSizeSignature !== sizeSignature[\s\S]*callFullCalendarUpdateSize\(calendar\)/,
    'sidebar layout must skip FullCalendar updateSize when its size signature is unchanged',
);
assert.match(
    source,
    /markStage\('core-dom-ready'\)[\s\S]*markStage\('time-axis'\)[\s\S]*markStage\('slot-height'\)[\s\S]*markStage\('update-size'[\s\S]*markStage\('auto-center'\)/,
    'sidebar layout must expose per-stage timing so forced reflow hotspots can be isolated',
);
assert.match(
    source,
    /if \(state\.mainLayoutRaf\) \{[\s\S]*coalesced: true[\s\S]*__tmPerfFinish\(layoutTrace/,
    'coalesced main layout requests must close their diagnostic trace',
);
assert.match(
    source,
    /function scheduleSyncTimeGridAllDayCollapseUi\(rootEl, calendar\)[\s\S]*hasPendingSync[\s\S]*if \(!hasPendingSync\)/,
    'all-day layout sync must avoid repeating the immediate DOM pass while a frame is already pending',
);
assert.match(
    source,
    /function scheduleMainCalendarMonthLayoutPass\(host, calendar\)[\s\S]*__tmMonthLayoutPassToken[\s\S]*String\(getCalendarView\(targetCalendar\)\?\.type \|\| ''\)\.trim\(\) !== 'dayGridMonth'/,
    'stale month layout frames must be discarded after switching away from month view',
);
assert.doesNotMatch(
    source,
    /requestAnimationFrame\(\(\) => \{[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*month-day-max-changed/,
    'month dayMax changes must not enqueue a second nested layout frame',
);
assert.match(
    source,
    /progressiveEventRendering: false[\s\S]*dayMaxEvents: preferredInitialView/,
    'main calendar view switches must avoid progressive partial source paints',
);
assert.match(
    source,
    /const viewSwitching = wrap\.classList\.contains\('tm-calendar-wrap--view-switching'\)[\s\S]*if \(!viewSwitching\)[\s\S]*scheduleMainCalendarLayoutRefresh/,
    'main eventsSet must not schedule layout work for every partial source during a view switch',
);
assert.match(
    source,
    /const isMainCalendarEventSourceRequestCurrent = \(sourceId, viewType, info\)[\s\S]*mainCalendarEventSourceRequestSignatures\.get\(sourceKey\)[\s\S]*const dropStaleMainCalendarEventSourceResult/,
    'main source callbacks must drop results that belong to a previous view or range',
);
assert.match(
    source,
    /function deferMainCalendarViewDataLoad\(calendar, nextView\)[\s\S]*requestAnimationFrame\(queueRefetch\)[\s\S]*refetchEvents/,
    'view buttons must let the new view paint before refetching its event sources',
);
assert.match(
    source,
    /view-switch-deferred[\s\S]*success\(\[\]\)[\s\S]*deferred: true/,
    'event sources must return an empty shell while a view switch is being committed',
);
assert.match(
    source,
    /const onMainViewButtonClickCapture = \(e\) => \{[\s\S]*deferMainCalendarViewDataLoad\(calendar, nextView\)[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*view-button-capture/,
    'view button capture must defer scroll/data work until after the click turn',
);
assert.match(
    source,
    /e\.preventDefault\?\.\(\); e\.stopPropagation\?\.\(\);[\s\S]*callCalendarAdapter\(calendar, 'changeView', nextView, targetDate\)/,
    'built-in view button clicks must not synchronously enter FullCalendar changeView',
);

console.log('calendar layout performance contract tests passed');
