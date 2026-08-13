'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const schemaSource = read('src/task-horizon/main/09-task-field-schema.js');
const storeSource = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const migrationSource = read('src/task-horizon/main/settings/62-settings-columns-and-rules.js');

const context = { Object, Array, String, Map, Set };
context.globalThis = context;
vm.runInNewContext(schemaSource, context, { filename: '09-task-field-schema.js' });
const schema = context.__tmTaskFieldSchema;
assert.ok(schema, 'the shared task field schema must be exported');

const aliases = {
    title: 'content',
    raw_content: 'content',
    custom_priority: 'priority',
    'custom-priority': 'priority',
    custom_status: 'customStatus',
    'custom-status': 'customStatus',
    start_date: 'startDate',
    'custom-start-date': 'startDate',
    completion_time: 'completionTime',
    'custom-completion-time': 'completionTime',
    custom_task_date_color: 'taskDateColor',
    'custom-task-date-color': 'taskDateColor',
    custom_pinned: 'pinned',
    'custom-pinned': 'pinned',
    custom_all_day_bottom: 'allDayBottom',
    'custom-all-day-bottom': 'allDayBottom',
    parent_task_id: 'parentTaskId',
    rootId: 'root_id',
};
Object.entries(aliases).forEach(([alias, canonical]) => {
    assert.equal(schema.normalizeField(alias), canonical, `${alias} must normalize to ${canonical}`);
});
assert.deepEqual(
    Array.from(schema.getReadKeys('customStatus')),
    ['customStatus', 'custom_status', 'custom-status'],
    'runtime receipt verification must read canonical and in-memory aliases',
);
assert.deepEqual(
    Array.from(schema.getGroup('search')),
    ['content', 'remark'],
    'search projection dependencies must match the title-and-remark search matcher',
);

assert.match(storeSource, /function __tmGetTaskMetaAttrReadKeys[\s\S]*__tmGetTaskMetaAttrKey[\s\S]*__tmGetTaskMetaAttrAliases[\s\S]*def\.defaultKey/,
    'persistent attribute reads must retain current key, historical aliases, and the default key');
assert.match(migrationSource, /if \(prev && prev !== next\) aliases\.add\(prev\)/,
    'renaming a persistent attribute must preserve its previous key as a migration alias');
assert.match(migrationSource, /aliases\.add\(def\.defaultKey\)/,
    'persistent migration must always retain the default attribute key');
assert.match(migrationSource, /if \(isValueSet\(nextValue\)\)[\s\S]*conflict[\s\S]*return;/,
    'migration must never overwrite a populated destination attribute');
assert.match(migrationSource, /await adapter\.setAttrs\(entry\.hostId, \{ \[entry\.newKey\]: entry\.value \}\)/,
    'migration must copy through the backend adapter one destination attribute at a time');
assert.doesNotMatch(migrationSource, /removeBlockAttrs|deleteBlockAttrs/,
    'migration must not delete historical attributes');

console.log('task field schema and migration contract tests passed');
