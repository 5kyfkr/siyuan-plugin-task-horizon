'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (name) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', name), 'utf8');
const store = read('10-stores-rules-and-cache.js');
const model = read('task-runtime/50-task-model-and-repeat-utils.js');
const runtime = read('task-runtime/51-whiteboard-and-link-runtime.js');
const actions = read('settings/70-doc-group-and-settings-actions.js');
const editor = read('task-runtime/53a-list-field-edit-runtime.js');

function extract(source, name) {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, `missing ${name}`);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
}

const fields = [
    { id: 'team', name: '团队', type: 'single', options: [{ id: 'design', name: '设计', color: '#557799' }] },
    { id: 'tags', name: '标签', type: 'multi', options: ['a', 'b', 'c'].map((id) => ({ id, name: id })) },
    { id: 'text', name: '文本', type: 'text' },
    { id: 'disabled', type: 'single', enabled: false },
    { id: 'scoped', type: 'single', docId: 'other-doc' },
];
const task = { id: 'task-a', root_id: 'doc-a', customFieldValues: { team: 'design', tags: ['a', 'b', 'c'] } };
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
class Element {
    constructor(classes = [], owner = null, fieldId = '') {
        this.classList = { contains: (name) => classes.includes(name) };
        this.owner = owner;
        this.fieldId = fieldId;
        this.nodes = [];
        this.innerHTML = '';
        this.style = {};
    }
    matches() { return this.classList.contains('tm-kanban-card'); }
    closest() { return this.owner; }
    querySelector() { return null; }
    querySelectorAll(selector) {
        const fieldId = selector.match(/="([^"]+)"/)?.[1];
        return this.nodes.filter((node) => !fieldId || node.fieldId === fieldId);
    }
    getAttribute() { return this.fieldId; }
}
const context = vm.createContext({
    Map, Set, Element, HTMLElement: Element, CSS: { escape: (value) => value },
    esc, escSq: esc,
    SettingsStore: { data: {}, save: async () => {} },
    state: {}, window: {}, showSettings() {},
    __TM_CUSTOM_FIELD_COLUMN_PREFIX: 'cf:',
    __TM_TASK_CARD_FIELD_OPTIONS: [{ key: 'priority' }, { key: 'status' }, { key: 'date' }],
    __tmGetCustomFieldDefMap: () => new Map(fields.map((field) => [field.id, field])),
    __tmIsCustomFieldApplicableToTask: (field, value) => !field.docId || field.docId === value.root_id,
    __tmBuildStatusChipStyle: () => '',
    __tmNormalizePriorityCustomFieldDelta: () => ({}),
    __tmBuildCustomFieldOptionRuntime: () => ({ pathById: new Map() }),
});
for (const name of [
    '__tmNormalizeCustomFieldId', '__tmParseCustomFieldColumnKey', '__tmFindCustomFieldOption',
    '__tmNormalizeCustomFieldValue', '__tmGetTaskCustomFieldValue', '__tmResolveCustomFieldSelectedOptions',
    '__tmBuildCustomFieldTagsHtml', '__tmBuildCustomFieldDisplayHtml',
]) vm.runInContext(extract(store, name), context);
for (const name of ['__tmNormalizeTaskCardFieldList', '__tmGetTaskCardFieldList', '__tmRenderTaskCardCustomFieldChips']) {
    vm.runInContext(extract(model, name), context);
}
vm.runInContext(extract(runtime, '__tmUpdateTaskCustomFieldsInDOM'), context);
for (const name of ['__tmNormalizeCustomFieldIdList', '__tmCollectCustomFieldLoadPlan', '__tmBuildRuntimeCustomFieldLoadPlan', '__tmDoesCustomFieldPlanNeedReload']) {
    vm.runInContext(extract(store, name), context);
}
const normalize = context.__tmNormalizeTaskCardFieldList;
assert.deepEqual(Array.from(normalize(null)), ['priority', 'status', 'date']);
assert.deepEqual(Array.from(normalize([])), []);
assert.deepEqual(Array.from(normalize(['status', 'cf:team', 'customField:team', 'unknown', 'customField:tags'])),
    ['status', 'customField:team', 'customField:tags']);

const selected = fields.map((field) => `customField:${field.id}`).concat('customField:deleted');
const html = context.__tmRenderTaskCardCustomFieldChips(task, selected);
assert.match(html, /tmOpenCustomFieldSelect\('task-a', 'team', event, this\)/);
assert.match(html, />设计<\/span>/);
assert.match(html, />\+1<\/span>/, 'multi-select chips must cap visible tags');
assert.equal((html.match(/<button /g) || []).length, 2, 'disabled, text, deleted and out-of-scope fields must stay hidden');
assert.equal(context.__tmRenderTaskCardCustomFieldChips(task, []), '');
const empty = context.__tmRenderTaskCardCustomFieldChips({ ...task, customFieldValues: {} }, ['customField:team']);
assert.match(empty, />团队<\/span>/, 'an unset selected field must remain available for editing');
assert.match(empty, /onclick=/);
for (const flags of [{ __tmGhost: true }, { __tmGlobalFrozen: true }, { __tmGlobalCollectionOverlay: true }]) {
    const readonly = context.__tmRenderTaskCardCustomFieldChips({ ...task, ...flags }, ['customField:team']);
    assert.match(readonly, / disabled>/);
    assert.doesNotMatch(readonly, /onclick=/);
}
assert.doesNotMatch(context.__tmRenderTaskCardCustomFieldChips(task, ['customField:team'], false), /onclick=/);

// Editing a parent field must keep its popup anchor and its child's value intact.
const parent = new Element(['tm-kanban-card']);
const child = new Element(['tm-kanban-card']);
const parentChip = new Element(['tm-task-card-custom-field'], parent, 'team');
const childChip = new Element(['tm-task-card-custom-field'], child, 'team');
childChip.innerHTML = 'Child value';
parent.nodes = [parentChip, childChip];
context.__tmUpdateTaskCustomFieldsInDOM(parent, task, { customFieldValues: { team: 'design' } });
assert.match(parentChip.innerHTML, />设计<\/span>/);
assert.equal(childChip.innerHTML, 'Child value');
context.__tmUpdateTaskCustomFieldsInDOM(parent, { ...task, customFieldValues: {} }, { customFieldValues: { team: '' } });
assert.strictEqual(parent.nodes[0], parentChip, 'clearing must retain the mounted popup anchor');
assert.match(parentChip.innerHTML, />团队<\/span>/);

const actionStart = actions.indexOf('    window.updateTaskCardFieldVisibility =');
vm.runInContext(actions.slice(actionStart, actions.indexOf('\n    };', actionStart) + 7), context);
const openStart = editor.indexOf('    window.tmOpenCustomFieldSelect =');
vm.runInContext(editor.slice(openStart, editor.indexOf('\n    };', openStart) + 7), context);
let stopped = false;
let prevented = false;
let opened = null;
context.__tmOpenCustomFieldInlineEditor = (...args) => { opened = args; };
context.window.tmOpenCustomFieldSelect('task-a', 'team', {
    stopPropagation: () => { stopped = true; }, preventDefault: () => { prevented = true; },
}, parentChip);
assert.equal(stopped && prevented, true, 'editing must not trigger the card click action');
assert.deepEqual(opened.slice(0, 3), ['task-a', 'team', parentChip]);

(async () => {
    const toggle = context.window.updateTaskCardFieldVisibility;
    await toggle('kanban', 'customField:team', true);
    await toggle('whiteboard', 'customField:tags', true);
    assert.ok(context.__tmGetTaskCardFieldList('kanban').includes('customField:team'));
    assert.ok(!context.__tmGetTaskCardFieldList('kanban').includes('customField:tags'));
    assert.ok(context.__tmGetTaskCardFieldList('whiteboard').includes('customField:tags'));
    assert.deepEqual(Array.from(context.__tmCollectCustomFieldLoadPlan({ viewMode: 'kanban', colOrder: [] }).bulkFieldIds), ['team'],
        'card fields must load even when absent from table columns');
    assert.deepEqual(Array.from(context.__tmCollectCustomFieldLoadPlan({ viewMode: 'whiteboard', colOrder: [] }).bulkFieldIds), ['tags']);
    context.SettingsStore.data = JSON.parse(JSON.stringify(context.SettingsStore.data));
    assert.ok(context.__tmGetTaskCardFieldList('kanban').includes('customField:team'), 'selection must survive reload normalization');
    await toggle('kanban', 'customField:team', false);
    assert.ok(!context.__tmGetTaskCardFieldList('kanban').includes('customField:team'));
    assert.ok(context.__tmGetTaskCardFieldList('whiteboard').includes('customField:tags'));
    let reloads = 0;
    context.state.viewMode = 'kanban';
    context.state.modal = new Element();
    context.document = { body: { contains: () => true } };
    context.loadSelectedDocuments = async () => { reloads += 1; };
    context.__tmRerenderCurrentViewInPlace = () => true;
    await toggle('kanban', 'customField:team', true);
    assert.equal(reloads, 1, 'enabling an unloaded field in the visible board must load its stored values');
    await toggle('whiteboard', 'customField:team', true);
    await toggle('kanban', 'customField:team', false);
    assert.equal(reloads, 1, 'hiding a field or configuring another view must not reload tasks');
    console.log('card custom-field settings, rendering, editing and refresh tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
