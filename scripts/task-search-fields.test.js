'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const stores = read('10-stores-rules-and-cache.js');
const services = read('20-api-and-runtime-services.js');
function extract(source, name) {
    const start = source.indexOf(`    function ${name}(`);
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + 6);
}
const definitions = [
    { id: 'notes', name: '项目说明', type: 'text' },
    { id: 'client', name: '客户', type: 'text', docId: 'doc-a' },
    { id: 'disabled', name: '停用列', type: 'text', enabled: false },
    { id: 'stage', name: '阶段', type: 'single' },
];
const context = vm.createContext({
    console, Map, Set,
    state: { viewMode: 'list', searchKeyword: '', flatTasks: {} },
    SettingsStore: { data: { columnOrder: ['content'] } },
    __TM_CUSTOM_FIELD_COLUMN_PREFIX: 'custom:',
    __tmGetCustomFieldDefs: () => definitions,
    __tmGetCustomFieldDefMap: () => new Map(definitions.map((field) => [field.id, field])),
    __tmIsCustomFieldApplicableToTask: (field, task) => !field.docId || field.docId === task.root_id,
    __tmNormalizePriorityCustomFieldDelta: () => ({}),
    __tmGetTaskCardFieldList: () => [],
    __tmGetTimelineColumnOrder: () => ['content'],
    __tmNormalizeCompactChecklistMetaFields: () => [],
    esc: (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
});
for (const name of [
    '__tmNormalizeCustomFieldId', '__tmParseCustomFieldColumnKey', '__tmGetTaskSearchFieldOptions', '__tmGetTaskSearchFields',
    '__tmCollectCustomFieldLoadPlan', '__tmNormalizeCustomFieldValue', '__tmGetTaskCustomFieldValue',
]) vm.runInContext(extract(stores, name), context);
for (const name of [
    '__tmGetTaskRemarkSearchText', '__tmTaskRemarkMatchesSearch', '__tmGetTaskSearchFieldText',
    '__tmTaskMatchesSearch', '__tmBuildTaskSearchSnippet',
]) vm.runInContext(extract(services, name), context);
vm.runInContext(read('09-task-field-schema.js'), context);
vm.runInContext(read('34-task-projection-engine.js'), context);
const fields = () => Array.from(context.__tmGetTaskSearchFields());
const setFields = (value) => { context.SettingsStore.data.taskSearchFields = value; };
const matches = (task, query) => context.__tmTaskMatchesSearch(task, query);
const task = { content: '标题专用', remark: '备注专用', root_id: 'doc-a', customFieldValues: { notes: '  API\nDev [x] <客户>  ', client: 'Acme' } };

assert.deepEqual(fields(), ['content', 'remark']);
assert.equal(matches(task, '标题'), true);
assert.equal(matches(task, '备注'), true);
assert.equal(matches(task, 'Acme'), false);
setFields(['customField:notes']);
assert.equal(matches(task, '标题'), false, 'search only the selected column');
assert.equal(matches(task, '备注'), false);
assert.equal(matches(task, 'api dev'), true, 'normalize whitespace and case');
assert.equal(matches(task, '[x]'), true, 'search literals, not regular expressions');
assert.equal(matches(task, '.*'), false);
assert.equal(matches(task, ''), true);
let snippet = context.__tmBuildTaskSearchSnippet(task, '客户');
assert.ok(snippet.includes('项目说明') && snippet.includes('&lt;客户&gt;'));
assert.ok(!snippet.includes('<客户>'), 'escape user text');
setFields(['customField:client', 'customField:notes']);
assert.equal(matches(task, 'Acme'), true);
assert.equal(matches(task, '[x]'), true, 'multiple columns use OR');
assert.equal(matches({ ...task, root_id: 'doc-b' }, 'Acme'), false, 'honor column applicability');
definitions[1].name = '客户名称';
assert.deepEqual(fields(), ['customField:client', 'customField:notes'], 'renames preserve saved IDs');
assert.ok(context.__tmBuildTaskSearchSnippet(task, 'acme').includes('客户名称'));
setFields(['remark', 'customField:notes']);
assert.equal(context.__tmBuildTaskSearchSnippet(task, '备注', { excludeFields: ['remark'] }), '');
setFields(['customField:disabled', 'customField:stage', 'customField:deleted']);
assert.deepEqual(fields(), ['content', 'remark'], 'invalid selections fall back to useful defaults');
setFields(['customField:notes', 'customField:notes', 'customField:deleted']);
assert.deepEqual(fields(), ['customField:notes']);

for (const viewMode of ['list', 'checklist', 'kanban', 'whiteboard', 'timeline']) {
    context.state.viewMode = viewMode;
    context.state.searchKeyword = 'API';
    assert.ok(context.__tmCollectCustomFieldLoadPlan().bulkFieldIds.includes('notes'), `${viewMode}: hidden search columns must load for the complete candidate set`);
}
context.state.viewMode = 'list';
context.state.searchKeyword = '';
assert.ok(!context.__tmCollectCustomFieldLoadPlan().bulkFieldIds.includes('notes'), 'idle search does not broaden loading');

const projectionContext = { searchActive: true, searchFields: fields(), groupMode: 'doc' };
const engine = context.__tmTaskProjectionEngine;
assert.equal(engine.analyzePatch({ customFieldValues: { notes: 'new' } }, projectionContext).filter, true);
assert.equal(engine.analyzePatch({ customFieldValues: { client: 'new' } }, projectionContext).filter, false);
assert.equal(engine.analyzePatch({ content: 'new', remark: 'new' }, projectionContext).filter, false);
assert.equal(engine.analyzePatch({ customFieldValues: {} }, projectionContext).filter, true, 'empty replacement must refresh selected custom columns');
assert.equal(engine.analyzePatch({ customFieldValues: { notes: 'new' } }, { ...projectionContext, searchActive: false }).filter, false);
console.log('task search fields behavior tests passed');
