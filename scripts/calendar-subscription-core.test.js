'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const core = require(path.resolve(__dirname, '..', 'calendar-subscription-core.js'));

assert.equal(core.escapeText('a,b;c\\d\nnext'), 'a\\,b\\;c\\\\d\\nnext');

const folded = core.foldLine(`SUMMARY:${'日程标题'.repeat(40)}`);
const foldedLines = folded.split('\r\n');
assert.ok(foldedLines.length > 1, 'long UTF-8 lines must be folded');
for (const line of foldedLines) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `physical line exceeds 75 octets: ${Buffer.byteLength(line, 'utf8')}`);
}
assert.ok(foldedLines.slice(1).every((line) => line.startsWith(' ')), 'continuation lines must start with one space');

const generatedAt = Date.UTC(2026, 6, 24, 12, 0, 0);
const empty = core.serializeCalendar({ generatedAt, events: [] });
assert.match(empty, /X-WR-CALNAME:任务管理器\r\n/);
assert.doesNotMatch(empty, /\r\nMETHOD:/, 'subscription feeds must not declare an incomplete iTIP method');
const timed = core.serializeCalendar({
    calendarName: '任务,日历',
    generatedAt,
    events: [{
        uidSeed: 'schedule:s1:100',
        source: 'schedule',
        title: '评审;会议',
        startAt: Date.UTC(2026, 6, 25, 1, 0, 0),
        endAt: Date.UTC(2026, 6, 25, 2, 0, 0),
        alarm: { trigger: '-PT15M' },
    }],
});
assert.ok(timed.endsWith('\r\n'));
assert.equal(timed.replaceAll('\r\n', '').includes('\n'), false, 'ICS output must not contain bare LF');
assert.match(timed, /X-WR-CALNAME:任务\\,日历\r\n/);
assert.match(timed, /X-WR-TIMEZONE:Asia\/Shanghai\r\n/);
assert.match(timed, /BEGIN:VTIMEZONE\r\nTZID:Asia\/Shanghai\r\n/);
assert.match(timed, /DTSTAMP:20260724T120000Z/);
assert.match(timed, /DTSTART;TZID=Asia\/Shanghai:20260725T090000/);
assert.match(timed, /DTEND;TZID=Asia\/Shanghai:20260725T100000/);
assert.doesNotMatch(timed, /DTSTART:.*Z|DTEND:.*Z/, 'event times must not be serialized as UTC');
assert.match(timed, /TRIGGER:-PT15M/);
assert.match(timed, /SUMMARY:评审\\;会议/);

const pointInTime = core.serializeCalendar({
    generatedAt,
    events: [{
        uidSeed: 'tomato:t1:100',
        source: 'tomato',
        title: '任务提醒',
        startAt: Date.UTC(2026, 6, 25, 3, 0, 0),
        alarm: { trigger: 'PT0M' },
    }],
});
assert.match(pointInTime, /DTSTART;TZID=Asia\/Shanghai:20260725T110000\r\nDTEND;TZID=Asia\/Shanghai:20260725T110100/);
assert.match(pointInTime, /TRIGGER:PT0M/);

const allDay = core.serializeCalendar({
    generatedAt,
    events: [{
        uidSeed: 'schedule:s2:200',
        source: 'schedule',
        title: '全天日程',
        allDay: true,
        startDate: '2026-07-25',
        endDate: '2026-07-27',
        alarm: { absoluteAt: Date.UTC(2026, 6, 25, 1, 0, 0) },
    }],
});
assert.match(allDay, /DTSTART;VALUE=DATE:20260725/);
assert.match(allDay, /DTEND;VALUE=DATE:20260727/);
assert.match(allDay, /TRIGGER;VALUE=DATE-TIME:20260725T010000Z/);

const completed = core.serializeCalendar({
    generatedAt,
    events: [{
        uidSeed: 'schedule:s3:300',
        source: 'schedule',
        title: '已完成',
        startAt: Date.UTC(2026, 6, 25, 3, 0, 0),
        completed: true,
        alarm: { trigger: 'PT0M' },
    }],
});
assert.match(completed, /X-TASK-HORIZON-COMPLETED:TRUE/);
assert.doesNotMatch(completed, /BEGIN:VALARM/);

const firstUid = timed.match(/UID:([^\r]+)/)?.[1];
const secondUid = core.serializeCalendar({
    generatedAt: generatedAt + 60000,
    events: [{
        uidSeed: 'schedule:s1:100',
        source: 'schedule',
        title: 'changed title',
        startAt: Date.UTC(2026, 6, 25, 5, 0, 0),
    }],
}).match(/UID:([^\r]+)/)?.[1];
assert.equal(firstUid, secondUid, 'UID must depend only on the stable seed');

(async () => {
    const left = await core.hashText(core.stableStringify({ b: 2, a: [1, { d: 4, c: 3 }] }));
    const right = await core.hashText(core.stableStringify({ a: [1, { c: 3, d: 4 }], b: 2 }));
    assert.equal(left, right, 'semantic hashing must be independent of object key order');
})().catch((error) => {
    process.nextTick(() => { throw error; });
});
