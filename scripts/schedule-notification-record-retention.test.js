'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const normalizeStart = source.indexOf('function normalizeScheduleNotificationRecordLedger');
const normalizeEnd = source.indexOf('function getScheduleNotificationMutationSignature', normalizeStart);
assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart, 'schedule record normalization must remain extractable');

const nowMs = Date.parse('2026-07-30T00:00:00Z');
const retentionMs = 30 * 24 * 60 * 60 * 1000;
const context = vm.createContext({
    Array,
    Date,
    Number,
    String,
    SCHEDULE_NOTIFICATION_RECORD_RETENTION_MS: retentionMs,
    sanitizeScheduleNotificationSchedules: (value) => value || {},
});
vm.runInContext(source.slice(normalizeStart, normalizeEnd) + '\nthis.normalizeLedger = normalizeScheduleNotificationRecordLedger;', context);

const ledger = context.normalizeLedger({
    records: [
        { entityId: 'expired-event', retainedAtMs: nowMs - retentionMs - 1, notificationSchedules: {} },
        { entityId: 'active-event', retainedAtMs: nowMs - retentionMs + 1, notificationSchedules: {} },
        {
            entityId: 'canceled-event',
            retainedAtMs: nowMs - 1000,
            notificationSchedules: { mobile: { status: 'canceled', entries: [{ id: 7 }] } },
        },
    ],
}, nowMs);

assert.deepEqual(
    Array.from(ledger.records, (record) => record.entityId),
    ['active-event', 'canceled-event'],
    'schedule records must be retained for 30 days',
);
assert.equal(ledger.records[1].notificationSchedules.mobile.status, 'canceled', 'mobile cleanup acknowledgements must remain in the ledger');

assert.match(source, /async function saveScheduleAll[\s\S]*?retainScheduleNotificationRecords\(/, 'schedule edits and deletes must retain previous appointment records before saving');
assert.match(source, /async function refreshScheduleCacheFromSharedFile[\s\S]*?retainScheduleNotificationRecords\(/, 'remote schedule changes must also retain the previous local appointment record');
assert.match(source, /async function syncScheduleMobileNotifications[\s\S]*?reconcileScheduleNotificationRecordLedger\(\)/, 'mobile notification sync must consume retained cancellation records');
assert.match(source, /record\.notificationSchedules\[SCHEDULE_SYNC_DEVICE_ID\][\s\S]*?status:\s*'canceled'/, 'mobile cancellation must be acknowledged without deleting the record');

console.log('schedule notification record retention tests passed');
