'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const auxStart = source.indexOf('id: EVENT_SOURCE_IDS.mainAux');
const auxEnd = source.indexOf('id: EVENT_SOURCE_IDS.mainSchedule', auxStart);
assert.ok(auxStart >= 0 && auxEnd > auxStart, 'main auxiliary source must be extractable');
const mainAux = source.slice(auxStart, auxEnd);

assert.match(mainAux, /if \(recordsPromise\)\s*\{\s*deferCalendarTomatoHistoryRefetch\(recordsPromise,[\s\S]*?allowPartial:\s*true,[\s\S]*?kind:\s*'tomato-history'/,
    'tomato history completion must schedule its own refetch instead of waiting for unrelated auxiliary categories');
assert.match(mainAux, /if \(preservedAuxEvents\?\.length && historyNeedsBackgroundRead\)/,
    'a stale auxiliary snapshot must not hide newly materialized tomato history');
assert.match(mainAux, /deferCalendarTomatoHistoryRefetch\(optionalBackgroundPromise,[\s\S]*?kind:\s*'complete'/,
    'the complete auxiliary refresh must remain available to reconcile reminders and holidays');

const deferred = source.slice(source.indexOf('function deferCalendarTomatoHistoryRefetch'), source.indexOf('function clearDockHistoryRangeCache'));
assert.match(deferred, /const pendingKey = `\$\{rangeKey\}\|\$\{refetchKind\}`/);
assert.match(deferred, /const refetchAtKey = `\$\{rangeKey\}\|\$\{refetchKind\}`/,
    'each auxiliary category must have independent deduplication and rate limiting');

console.log('calendar tomato switch refresh contract tests passed');
