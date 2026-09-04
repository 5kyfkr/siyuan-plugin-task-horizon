'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');

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

const normalizeCalendarVisibleTime = (value, fallback, allow24Hour = false) => {
    const raw = String(value || '').trim();
    const safeFallback = String(fallback || '').trim() || (allow24Hour ? '24:00' : '00:00');
    const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
    if (!match) return safeFallback;
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    if ((mm !== 0 && mm !== 30) || hh < 0 || hh > (allow24Hour ? 24 : 23) || (hh === 24 && mm !== 0)) return safeFallback;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
const getCalendarVisibleSlotRange = readFunction(source, 'getCalendarVisibleSlotRange', {
    normalizeCalendarVisibleTime,
});
const getPrototypeHourHeight = () => 60;
const metricsFn = readFunction(source, 'getPrototypeTimelineMetrics', {
    getCalendarVisibleSlotRange,
    getPrototypeHourHeight,
});
const yForMinute = readFunction(source, 'prototypeTimelineYForMinute');
const minuteForY = readFunction(source, 'prototypeTimelineMinuteForY');
const minuteIsVisible = readFunction(source, 'prototypeTimelineMinuteIsVisible');
const visibleEventSegments = readFunction(source, 'getPrototypeTimelineVisibleEventSegments');

const settings = { visibleStartTime: '06:00', visibleEndTime: '22:00' };
const collapsed = metricsFn(settings, { hourHeight: 60, bandHeight: 28 });
assert.equal(collapsed.expanded, false);
assert.deepEqual(JSON.parse(JSON.stringify(collapsed.collapsedRanges)), [
    { key: 'before', start: 0, end: 360 },
    { key: 'after', start: 1320, end: 1440 },
]);
assert.equal(collapsed.canvasHeight, 1016);
assert.equal(yForMinute(0, collapsed), 0);
assert.equal(yForMinute(360, collapsed), 28);
assert.equal(yForMinute(1320, collapsed), 988);
assert.equal(yForMinute(1440, collapsed), 1016);
assert.equal(Math.round(minuteForY(28, collapsed)), 360);
assert.equal(Math.round(minuteForY(14, collapsed)), 360);
assert.equal(Math.round(minuteForY(988, collapsed)), 1320);
assert.equal(Math.round(minuteForY(1002, collapsed)), 1320);

const expanded = metricsFn(settings, { hourHeight: 60, bandHeight: 28, timeRangeExpanded: true });
assert.equal(expanded.expanded, true);
assert.equal(expanded.canvasHeight, 1496, 'expanded timelines reserve one separator slot per fold range');
assert.equal(yForMinute(0, expanded), 28, 'a fold beginning at midnight must leave its control slot above 00:00');
assert.equal(yForMinute(720, expanded), 748, 'minutes after the first fold must include its reserved slot');
assert.equal(Math.round(minuteForY(yForMinute(720, expanded), expanded)), 720, 'expanded minute mapping must round-trip through reserved slots');

const narrow = metricsFn({ visibleStartTime: '23:00', visibleEndTime: '23:30' }, { hourHeight: 60, bandHeight: 28 });
assert.equal(narrow.visibleEnd, 1410, 'a configured 30-minute visible range must remain 30 minutes wide');

const overnightRange = getCalendarVisibleSlotRange({ visibleStartTime: '06:00', visibleEndTime: '02:00' });
assert.equal(overnightRange.slotMinTime, '06:00:00');
assert.equal(overnightRange.slotMaxTime, '02:00:00');
assert.equal(overnightRange.overnight, true, 'a visible window may cross midnight');
assert.equal(overnightRange.visibleMinutes, 1200, '06:00 -> 02:00 must preserve its 20-hour visible span');
const overnight = metricsFn({ visibleStartTime: '06:00', visibleEndTime: '02:00' }, { hourHeight: 60, bandHeight: 28 });
assert.equal(overnight.overnight, true);
assert.deepEqual(JSON.parse(JSON.stringify(overnight.collapsedRanges)), [
    { key: 'overnight', start: 120, end: 360 },
]);
assert.deepEqual(JSON.parse(JSON.stringify(overnight.visibleRanges)), [
    { start: 0, end: 120 },
    { start: 360, end: 1440 },
]);
assert.equal(overnight.canvasHeight, 1228, 'the overnight collapsed band must retain the visible 20-hour canvas');
assert.equal(yForMinute(120, overnight), 120);
assert.equal(yForMinute(360, overnight), 148);
assert.equal(yForMinute(1440, overnight), 1228);
assert.equal(Math.round(minuteForY(134, overnight)), 360, 'points inside the overnight collapsed band resolve to its visible boundary');
assert.equal(minuteIsVisible(119, overnight), true);
assert.equal(minuteIsVisible(120, overnight), false);
assert.equal(minuteIsVisible(359, overnight), false);
assert.equal(minuteIsVisible(360, overnight), true);
assert.deepEqual(JSON.parse(JSON.stringify(visibleEventSegments(0, 480, overnight))), [
    { start: 0, end: 120 },
    { start: 360, end: 480 },
], 'events crossing a folded range must retain both visible outside segments');
assert.deepEqual(JSON.parse(JSON.stringify(visibleEventSegments(180, 480, overnight))), [
    { start: 360, end: 480 },
], 'events beginning inside a folded range must retain their visible trailing segment');
assert.deepEqual(JSON.parse(JSON.stringify(visibleEventSegments(180, 300, overnight))), [], 'events fully inside a folded range stay hidden');

assert.match(source, /toggleTimeRange/);
assert.match(source, /data-tm-proto-time-expanded/);
assert.match(styles, /\.tm-proto-time-collapse\{/);
assert.match(styles, /\.tm-proto-event--fold-fragment:not\(\.is-fold-fragment-start\)/);
assert.doesNotMatch(source, /tm-proto-time-collapse-toggle/);
assert.doesNotMatch(styles, /tm-proto-time-collapse-toggle/);

console.log('calendar timegrid collapse contract tests passed');
