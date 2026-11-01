'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
const { createI18n } = require('../src/i18n/runtime');
const dictionaries = require('../i18n/zh-CN.json');

const source = fs.readFileSync(path.resolve(__dirname, '../src/task-horizon/main/task-runtime/53d-task-template-runtime.js'), 'utf8');
const quickAdd = fs.readFileSync(path.resolve(__dirname, '../src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const draft = fs.readFileSync(path.resolve(__dirname, '../src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const stores = fs.readFileSync(path.resolve(__dirname, '../src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/task-horizon/manifest.main.json'), 'utf8'));
function readFunction(name) {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, `${name} must exist`);
    const firstBrace = source.indexOf('{', start);
    let depth = 0;
    for (let index = firstBrace; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        else if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Incomplete function ${name}`);
}

const context = vm.createContext({ SettingsStore: { data: { taskTemplateLibrary: null } }, Math, Date,
    __tmT: createI18n(dictionaries, { locale: 'zh-CN' }).t });
vm.runInContext([
    'const $ = () => null;',
    'const state = {};',
    'const __tmTemplateId = (() => { let id = 0; return () => `generated-${++id}`; })();',
    readFunction('__tmDefaultTaskTemplateLibrary'),
    readFunction('__tmNormalizeTaskTemplateLibrary'),
    readFunction('__tmTemplateFlat'),
    readFunction('__tmTaskTemplateLibrary'),
    readFunction('__tmNormalizeTaskTemplateDraft'),
    readFunction('__tmTemplatePlan'),
    `const library = __tmTaskTemplateLibrary();
     const counts = library.items.map(item => __tmTemplateFlat(item.nodes).length);
     const article = library.items.find(item => item.id === 'builtin-article');
     const week = library.items.find(item => item.id === 'builtin-weekly');
     const draft = __tmNormalizeTaskTemplateDraft({ templateId: article.id, name: article.name, revision: 1,
       topic: '发布演示', nodes: article.nodes, excludedIds: ['editing'], collapsedIds: [] });
     const malformed = __tmNormalizeTaskTemplateLibrary({ items: [{ id:'bad', name:'坏', nodes:[
       { id:'same', title:'父', offset:9, priority:'high', children:[{id:'same',title:'子',offset:2,children:[]}] },
     ] }] });
     globalThis.result = { names: library.items.map(item => item.name), counts,
       articleRoots: article.nodes.length, weekRoots: week.nodes.length,
       plan: __tmTemplatePlan(draft), ids: __tmTemplateFlat(malformed.items[0].nodes).map(item => item.node.id),
       fields: Object.keys(__tmTemplateFlat(malformed.items[0].nodes)[0].node) };`,
].join('\n'), context);

const result = JSON.parse(JSON.stringify(context.result));
assert.deepEqual(result.names, ['功能发布', '文章发布', '每周计划']);
assert.deepEqual(result.counts, [8, 7, 7]);
assert.equal(result.articleRoots, 1);
assert.equal(result.weekRoots, 2);
assert.equal(result.plan.length, 4, 'excluding one branch excludes its descendants');
assert.deepEqual(result.plan.map(item => item.title), ['发布《发布演示》', '确认选题与读者', '完成内容初稿', '发布并记录反馈']);
assert.deepEqual(result.plan.map(item => item.parentId), ['', 'article', 'article', 'article']);
assert.equal(new Set(result.ids).size, result.ids.length, 'duplicate template node IDs are regenerated');
assert.deepEqual(result.fields, ['id', 'title', 'children'], 'template nodes retain structure only');

console.log('task template defaults, hierarchy, topic replacement, exclusion and legacy normalization passed');

assert.ok(manifest.scripts.includes('main/task-runtime/53d-task-template-runtime.js'), 'template runtime must load after quick-add');
assert.ok(manifest.scripts.indexOf('main/task-runtime/53d-task-template-runtime.js') > manifest.scripts.indexOf('main/task-runtime/53b-task-create-and-quick-add-runtime.js'));
assert.match(quickAdd, /data-quick-add-template-trigger[\s\S]*taskTemplate\.menu/, 'More exposes a template submenu trigger');
assert.match(quickAdd, /data-quick-add-template-id/, 'the submenu lists available templates');
assert.match(quickAdd, /data-quick-add-template-back[\s\S]*data-quick-add-action="template-manage"/, 'manager entry is inside the replace-view template submenu');
assert.match(source, /savedInstance\.execution \|\| savedInstance\.revision === template\.revision/, 'a changed template revision starts from its current default topic');
assert.match(source, /data-template-order="up"[\s\S]*data-template-order="down"/, 'template manager exposes ordering controls for library entries');
assert.match(source, /manager\.library\.items\.splice\(target, 0, item\)/, 'ordering changes the template library sequence');
assert.match(draft, /template\s*=\s*typeof __tmNormalizeTaskTemplateDraft[\s\S]*template,/, 'quick-add draft persists a normalized template snapshot');
assert.match(stores, /taskTemplateLibrary: null/, 'the settings store has a template default');
assert.match(stores, /Storage\.get\('tm_task_template_library'/, 'templates load from host-backed settings storage');
assert.match(stores, /Storage\.set\('tm_task_template_library'/, 'templates persist with the settings store');
assert.match(stores, /async saveTaskTemplates\(input\)[\s\S]*taskTemplateFingerprint/, 'the dedicated template file save exposes a verifiable receipt');
assert.match(source, /requestedTaskId: step\.requestedTaskId[\s\S]*requestedContainerId: step\.requestedContainerId/, 'template retries pass pre-generated IDs into existing mutation calls');
assert.match(source, /if \(parent && parent\.status !== 'done'\)/, 'children cannot be submitted before their parent commits');
assert.match(source, /taskTemplate\.topicHint/, 'default-topic guidance is part of the manager');
assert.match(source, /taskTemplate\.partialFailure/, 'partial failures describe completed and remaining nodes');

async function verifyExecution() {
    const writes = [];
    let sequence = 0;
    let failTitle = '';
    let failResponse = false;
    const committedIds = new Set();
    const ctx = vm.createContext({ window: {}, SettingsStore: { data: {} }, state: {},
        __tmT: createI18n(dictionaries, { locale: 'zh-CN' }).t,
        __tmNewTaskBlockId: () => `20261101120000-${String(++sequence).padStart(7, '0')}`,
        __tmApplyHeadingPatchToTaskLocal: () => {},
        __tmBuildCreateTaskInDocAttrPatchFromPayload: payload => ({ priority: payload.priority, customStatus: payload.customStatus,
            remark: payload.remark, attachments: payload.attachments, startDate: payload.startDate, completionTime: payload.completionTime }),
        __tmResolveDefaultNewTaskInsertOptions: async (_doc, _mode, options) => ({
            ...(options.headingId === 'after' ? { insertAfterId: 'heading' } : { insertBeforeId: 'next-block' }),
            headingPatch: { h2Id: 'heading' },
        }),
        __tmRequireTaskMutation: kind => async (...args) => {
            const payload = kind === 'createTaskInDoc' ? args[0] : args[2];
            const title = kind === 'createTaskInDoc' ? payload.content : args[1];
            const id = payload.requestedTaskId;
            if (title === failTitle && !failResponse) { failTitle = ''; throw new Error('before-commit'); }
            if (!committedIds.has(id)) {
                committedIds.add(id);
                writes.push({ kind, id, title, parent: kind === 'createTaskInDoc' ? '' : args[0], payload });
            }
            if (title === failTitle && failResponse) { failTitle = ''; throw new Error('after-commit-before-response'); }
            return id;
        },
    });
    vm.runInContext(source + '\n__tmPersistTemplateInstance = () => {};', ctx);
    const makeInstance = () => ctx.__tmNormalizeTaskTemplateDraft({ templateId: 'two-roots', name: 'test', revision: 1, topic: '主题',
        nodes: [{ id: 'a', title: 'A', children: [{ id: 'a1', title: 'A1', children: [{ id: 'a2', title: 'A2', children: [] }] }] },
            { id: 'b', title: 'B', children: [{ id: 'b1', title: 'B1', children: [] }] }], excludedIds: [] });
    const shared = { docId: 'target-doc', docMode: 'doc', priority: 'high', customStatus: 'todo',
        startDate: '', completionTime: '', customFieldValues: {}, remark: 'first task only', attachments: ['assets/test.png'] };
    for (const [relation, headingId, expected] of [
        ['', '', ['A', 'A1', 'A2', 'B', 'B1']], ['', 'after', ['B', 'B1', 'A', 'A1', 'A2']],
        ['subtask', '', ['A', 'A1', 'A2', 'B', 'B1']], ['sibling', '', ['B', 'B1', 'A', 'A1', 'A2']],
    ]) {
        writes.length = 0;
        const instance = makeInstance();
        assert.equal(await ctx.__tmExecuteTaskTemplatePlan(instance, { ...shared, relation, headingId, sourceTaskId: 'source' }), 5);
        assert.deepEqual(writes.map(item => item.title), expected, 'root insertion preserves the order expected by the host placement');
        for (const item of writes.filter(item => ['A1', 'A2', 'B1'].includes(item.title))) {
            const parent = writes.find(value => value.title === { A1:'A', A2:'A1', B1:'B' }[item.title]);
            assert.equal(item.kind, 'createSubtask');
            assert.equal(item.parent, parent.id, 'children use the committed parent block ID');
        }
        for (const item of writes.filter(item => ['A', 'B'].includes(item.title))) {
            assert.equal(item.kind, relation === 'subtask' ? 'createSubtask' : relation === 'sibling' ? 'createSibling' : 'createTaskInDoc');
        }
        const first = writes.find(item => item.title === 'A');
        assert.deepEqual(first.payload.initialPatch?.attachments || first.payload.attachments, ['assets/test.png']);
        assert.equal(writes.filter(item => (item.payload.initialPatch?.remark || item.payload.remark) === shared.remark).length, 1,
            'remark and attachments belong to the first task in template order, even when roots are submitted in reverse');
    }
    for (const afterCommit of [false, true]) {
        writes.length = 0; failTitle = 'A1'; failResponse = afterCommit;
        const instance = makeInstance();
        await assert.rejects(ctx.__tmExecuteTaskTemplatePlan(instance, { ...shared, relation: '', headingId: '' }));
        assert.equal(instance.execution.steps.filter(step => step.status === 'done').length, 1);
        const failedId = instance.execution.steps.find(step => step.title === 'A1').requestedTaskId;
        assert.equal(await ctx.__tmExecuteTaskTemplatePlan(instance, { ...shared, docId:'changed-doc', relation:'sibling' }), 5);
        assert.equal(writes.length, 5, 'retry does not duplicate blocks after ambiguous responses');
        assert.equal(writes.find(item => item.title === 'A1').id, failedId);
        assert.equal(writes[0].payload.docId, 'target-doc', 'retry preserves the first submit context');
        assert.equal(instance.execution.payload.docId, 'target-doc');
    }
    console.log('task template root ordering, nested writes, first-task attributes and stable retries passed');
}
verifyExecution().catch(error => { console.error(error); process.exitCode = 1; });
