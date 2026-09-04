const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

const metadataStart = source.indexOf('    async function __tmBuildScheduleLinkedMetadataMaps');
const metadataEnd = source.indexOf('\n    function buildEventsFromSchedule', metadataStart);
assert.ok(metadataStart >= 0 && metadataEnd > metadataStart, 'linked schedule metadata builder must remain inspectable');
const metadata = source.slice(metadataStart, metadataEnd);

assert.match(
    metadata,
    /const snapshotDocId = getCalendarTaskDocumentId\(snapshot\);[\s\S]*if \(snapshotDocId\) setDoc\(id, snapshotDocId\);[\s\S]*else if \(directDocId\) setDoc\(id, directDocId\);/,
    'the linked task current document must override the schedule stored document',
);
assert.match(
    metadata,
    /if \(row\.docId\) setDoc\(id, row\.docId\);/,
    'fresh block metadata must replace a stale schedule document fallback',
);

const eventsStart = source.indexOf('    function buildEventsFromSchedule');
const eventsEnd = source.indexOf('\n    function isMonthScheduleEventRange', eventsStart);
assert.ok(eventsStart >= 0 && eventsEnd > eventsStart, 'schedule event builder must remain inspectable');
const events = source.slice(eventsStart, eventsEnd);

assert.match(
    events,
    /const linkedDocId = String\([\s\S]*docIdMap\?\.get\(taskId\)[\s\S]*docIdMap\?\.get\(blockId\)[\s\S]*directDocId/,
    'resolved current task documents must win over the stored schedule document',
);
assert.match(
    events,
    /const color = rawColor \|\| docColor \|\| inheritedCalendarColor;/,
    'custom schedule colors must remain above document and document-group colors',
);

assert.match(
    source,
    /linkedDocIdDraft = getCalendarTaskDocumentId\(task\);[\s\S]*syncColorToContext\(\);/,
    'the legacy editor must update inherited color when its linked task changes',
);
assert.match(
    source,
    /linkedDocId = getCalendarTaskDocumentId\(task\);[\s\S]*syncInlineColorToContext\(\);/,
    'the inline editor must update inherited color when its linked task changes',
);
assert.match(
    source,
    /if \(type === 'moveTask'\)[\s\S]*movedAcrossDocuments[\s\S]*scheduleFollowDocColor === true[\s\S]*scheduleCalendarRefresh\(/,
    'cross-document task moves must refresh schedule colors when document-follow mode is enabled',
);

console.log('calendar schedule document color contract tests passed');
