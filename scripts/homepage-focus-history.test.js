const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'homepage.js'), 'utf8');
const helperStart = source.indexOf('    function isGlobalFocusScope(ctx)');
const helperEnd = source.indexOf('    function getHistoryRecordEndMs', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'focus history helpers must remain extractable');

const context = {
    Date,
    toNumber(value, fallback = 0) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    },
    parseDateTime(value) {
        const date = value instanceof Date ? value : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    },
};
vm.createContext(context);
vm.runInContext(source.slice(helperStart, helperEnd), context);

const dayStart = new Date('2026-07-19T00:00:00+08:00');
const dayEnd = new Date('2026-07-20T00:00:00+08:00');
const record = {
    start: '2026-07-19T10:00:00+08:00',
    end: '2026-07-19T10:15:00+08:00',
    durationSec: 3600,
    durationMin: 60,
};
assert.equal(
    context.getHistoryRecordOverlapSeconds(record, dayStart, dayEnd),
    3600,
    'homepage focus totals must use Dock Tomato actual durationSec instead of rebuilding duration from wall-clock endpoints',
);

const pausedRecord = {
    start: '2026-07-19T10:00:00+08:00',
    end: '2026-07-19T11:00:00+08:00',
    durationSec: 1800,
};
assert.equal(
    context.getHistoryRecordOverlapSeconds(pausedRecord, new Date('2026-07-19T10:00:00+08:00'), new Date('2026-07-19T10:30:00+08:00')),
    900,
    'cross-boundary overlap must allocate stored focus duration proportionally',
);
assert.equal(
    context.getHistoryRecordOverlapSeconds({ ...record, durationSec: 0, durationMin: 25 }, dayStart, dayEnd),
    1500,
    'legacy records must fall back to durationMin',
);
assert.equal(context.isGlobalFocusScope({ currentGroupId: 'all', currentDocId: 'all' }), true);
assert.equal(context.isGlobalFocusScope({ currentGroupId: 'work', currentDocId: 'all' }), false);
assert.equal(context.isGlobalFocusScope({ currentGroupId: 'all', currentDocId: 'doc-1' }), false);

const statsStart = source.indexOf('    function buildFocusStats');
const statsEnd = source.indexOf('    function flattenTasks', statsStart);
const statsBlock = source.slice(statsStart, statsEnd);
assert.match(statsBlock, /if \(!task && !includeUnmatchedRecords\) return;/, 'global focus totals must retain unmatched history records');
assert.match(statsBlock, /if \(task\) addGroupRecord\(dayGroups, task, record, todaySec, win\.focusDayEnd\);/, 'unmatched records must not be assigned to an unrelated task row');
const candidateStart = source.indexOf('    function getTaskCandidateIds');
const candidateEnd = source.indexOf('    function buildFocusTaskIndex', candidateStart);
assert.ok(candidateStart >= 0 && candidateEnd > candidateStart, 'task history candidate helper must remain extractable');
vm.runInContext(source.slice(candidateStart, candidateEnd), context);
assert.deepEqual(
    Array.from(context.getTaskCandidateIds({
        id: 'repeatinst:source-1:1',
        sourceTaskId: 'source-1',
        blockId: 'source-1',
        attrHostId: 'source-1',
        isRecurringInstance: true,
    })),
    ['repeatinst:source-1:1'],
    'a virtual recurring row must not claim Tomato history owned by its source task',
);
assert.ok(context.getTaskCandidateIds({ id: 'source-1', sourceTaskId: 'linked-source' }).includes('linked-source'),
    'non-virtual task aliases must continue participating in history matching');
assert.match(source, /push\(record\?\.routineButtonBlockId\);/, 'routine-button task IDs must participate in history matching');

console.log('homepage focus history tests passed');
