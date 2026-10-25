'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const source = read('task-runtime/51-whiteboard-and-link-runtime.js');
const store = read('10-stores-rules-and-cache.js');
const api = read('20-api-and-runtime-services.js');
const extract = (text, name) => {
    const start = text.search(new RegExp(`    (?:async )?function ${name}\\(`));
    const end = text.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return text.slice(start, end + 6);
};
const methodStart = api.indexOf('        async createDocWithMd(');
const methodEnd = api.indexOf('\n        async createDailyNote(', methodStart);
assert.ok(methodStart >= 0 && methodEnd > methodStart);
const apiMethod = api.slice(methodStart, methodEnd);
const ids = { task: '20261025080000-task001', parent: '20261025080000-parent1', other: '20261025080000-parent2', doc: '20261025080000-doc0001' };
const clone = value => JSON.parse(JSON.stringify(value));

function harness() {
    const calls = { creates: [], patches: [], meta: [], requests: [] };
    let paths = ['assets/existing.pdf'];
    let queued = null;
    let createError = false;
    let saveError = false;
    let saveFalse = false;
    let missingParent = false;
    let structuredUnsupported = false;
    let createResponse = null;
    let probeResponse = null;
    let releaseSave;
    let releaseCreate;
    const context = vm.createContext({
        __TM_TASK_ATTACHMENT_BLOCK_ID_PATTERN: /^[0-9]{14}-[A-Za-z0-9]+$/,
        __TM_TASK_ATTACHMENT_BLOCK_PREFIX: 'block:',
        __tmNormalizeTaskAttachmentLocalPath: () => '',
        __tmPrimeTaskAttachmentBlockMeta: meta => calls.meta.push(clone(meta)),
        __tmGetQueuedTaskAttachmentPatchPaths: () => queued,
        __tmGetCurrentTaskAttachmentPatchBase: () => paths.slice(),
        __tmReconcileQueuedTaskAttachmentPaths: (_id, values) => values,
        __tmNewTaskBlockId: () => ids.doc,
        __tmRequireTaskMutation: () => async (id, patch, options) => {
            calls.patches.push(clone({ id, patch, options }));
            if (releaseSave) await new Promise(resolve => { releaseSave = resolve; });
            if (saveError) throw new Error('save failed');
            if (saveFalse) return false;
            paths = Array.from(patch.attachments);
            return { id };
        },
    });
    vm.runInContext(`const API = { ${apiMethod} }; globalThis.API = API;`, context);
    context.API.call = async (endpoint, data) => {
        calls.requests.push(clone({ endpoint, data }));
        if (endpoint === '/api/filetree/getDocPaths') {
            if (probeResponse) return probeResponse;
            return structuredUnsupported ? {code:-1, msg:'HTTP 404'} : {code:0, data:{documents:[{id:data.ids[0]}], missingIDs:[]}};
        }
        if (endpoint === '/api/filetree/createDocByParent' && structuredUnsupported) return { code: -1, msg: 'HTTP 404' };
        if (endpoint === '/api/filetree/createDocWithMd' && !structuredUnsupported) {
            return { code: -1, msg: 'legacy document paths are unsupported; use structured document addressing', data: { reason: 'legacyPathUnsupported' } };
        }
        if (endpoint === '/api/filetree/createDocByParent') {
            assert.equal(Object.hasOwn(data, 'path'), false);
            assert.equal(Object.hasOwn(data, 'hPath'), false);
            assert.deepEqual(clone(data.title), { format: 'plain', text: data.title.text });
            assert.match(data.id, /^[0-9]{14}-[A-Za-z0-9]+$/);
        } else assert.equal(endpoint, '/api/filetree/createDocWithMd');
        calls.creates.push(clone(data));
        if (releaseCreate) await new Promise(resolve => { releaseCreate = resolve; });
        if (createResponse) return createResponse;
        if (createError) return { code: -1, msg: 'create failed' };
        return { code: 0, data: endpoint === '/api/filetree/createDocByParent' ? { id: ids.doc, document: { id: ids.doc } } : ids.doc };
    };
    context.API.getDocMetaById = async id => missingParent ? null : {
        id, notebook: 'notebook-1', path: id === ids.other ? '/其他项目/同名文档' : '/项目/同名文档',
    };
    for (const name of ['__tmNormalizeTaskAttachmentBlockId', '__tmBuildTaskAttachmentBlockToken', '__tmNormalizeTaskAttachmentPath', '__tmNormalizeTaskAttachmentPaths']) {
        vm.runInContext(extract(store, name), context);
    }
    for (const name of ['__tmUpdateTaskAttachmentsField', '__tmCreateTaskAttachmentDocument']) vm.runInContext(extract(source, name), context);
    return {
        calls,
        draft: () => ({ title: '  会议记录  ', parentDocId: ids.parent }),
        create: draft => context.__tmCreateTaskAttachmentDocument(ids.task, draft),
        update: (values, options) => context.__tmUpdateTaskAttachmentsField(ids.task, values, options),
        api: context.API,
        set: values => { paths = values.paths ?? paths; queued = values.queued ?? queued; createError = values.createError ?? createError; saveError = values.saveError ?? saveError; saveFalse = values.saveFalse ?? saveFalse; missingParent = values.missingParent ?? missingParent; structuredUnsupported = values.structuredUnsupported ?? structuredUnsupported; createResponse = values.createResponse ?? createResponse; probeResponse = values.probeResponse ?? probeResponse; },
        holdSave: () => { releaseSave = true; }, releaseSave: () => releaseSave(),
        holdCreate: () => { releaseCreate = true; }, releaseCreate: () => releaseCreate(),
    };
}

test('creates under the selected parent ID and appends a document attachment', async () => {
    const h = harness(), draft = h.draft();
    draft.parentDocId = ids.other;
    const result = await h.create(draft);
    assert.deepEqual(h.calls.creates, [{ notebook: 'notebook-1', parentID: ids.other, id: ids.doc, title: { format: 'plain', text: '会议记录' }, markdown: '' }]);
    assert.equal(draft.createdDocId, ids.doc);
    assert.deepEqual(Array.from(result.paths), ['assets/existing.pdf', `block:${ids.doc}`]);
    assert.equal(h.calls.patches[0].options.wait, true);
    assert.equal(h.calls.patches[0].options.background, false);
    assert.equal(h.calls.meta[0].type, 'd');
});

test('waits for saved association and merges attachments added during document creation', async () => {
    const h = harness();
    h.holdCreate(); h.holdSave();
    let settled = false;
    const operation = h.create(h.draft()).then(result => { settled = true; return result; });
    await new Promise(resolve => setImmediate(resolve));
    h.set({ queued: ['assets/existing.pdf', 'assets/concurrent.png'] });
    h.releaseCreate();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false);
    assert.deepEqual(h.calls.patches[0].patch.attachments, ['assets/existing.pdf', 'assets/concurrent.png', `block:${ids.doc}`]);
    h.releaseSave();
    await operation;
    assert.equal(settled, true);
});

test('association failure retains the document and retries without creating again', async () => {
    const h = harness(), draft = h.draft();
    h.set({ saveError: true });
    await assert.rejects(h.create(draft), /save failed/);
    assert.equal(draft.createdDocId, ids.doc);
    h.set({ saveError: false, paths: ['assets/new.pdf'] });
    const result = await h.create(draft);
    assert.equal(h.calls.creates.length, 1);
    assert.deepEqual(Array.from(result.paths), ['assets/new.pdf', `block:${ids.doc}`]);
    assert.equal(h.calls.patches[1].options.skipNoopCheck, true);
});

test('a false write result is treated as a failed association', async () => {
    const h = harness(), draft = h.draft();
    h.set({ saveFalse: true });
    await assert.rejects(h.create(draft), /未保存/);
    assert.equal(draft.createdDocId, ids.doc);
});

test('creation and validation failures never write an attachment', async () => {
    const h = harness();
    for (const title of ['', ' ', '../错误位置', 'folder\\note', '.', '..', 'a'.repeat(513)]) {
        await assert.rejects(h.create({ title, parentDocId: ids.parent }));
    }
    h.set({ missingParent: true });
    await assert.rejects(h.create(h.draft()), /创建位置/);
    assert.equal(h.calls.creates.length, 0);
    h.set({ missingParent: false, createError: true });
    const draft = h.draft();
    await assert.rejects(h.create(draft), /create failed/);
    assert.equal(draft.createdDocId, undefined);
    assert.equal(h.calls.patches.length, 0);
});

test('ordinary attachments and existing create callers keep their defaults', async () => {
    const h = harness();
    await h.update(['assets/a.pdf']);
    assert.equal(h.calls.patches[0].options.wait, false);
    assert.equal(h.calls.patches[0].options.background, true);
    h.set({ structuredUnsupported: true });
    await h.api.createDocWithMd('box', '/import.sy', '');
    assert.deepEqual(h.calls.creates[0], { notebook: 'box', path: '/import.sy', markdown: '' });
});

test('older hosts fall back only when the structured endpoint is unavailable', async () => {
    const h = harness();
    h.set({ structuredUnsupported: true });
    await h.create(h.draft());
    assert.deepEqual(h.calls.requests.map(item => item.endpoint), ['/api/filetree/getDocPaths', '/api/filetree/createDocWithMd']);
    assert.deepEqual(h.calls.creates, [{ notebook:'notebook-1', path:'/项目/同名文档/会议记录.sy', markdown:'', parentID:ids.parent }]);
});

test('structured business, authentication and server errors never fall back to path addressing', async () => {
    for (const response of [
        { code:-1, msg:'index unavailable', data:{reason:'indexUnavailable'} },
        { code:-1, msg:'parent unavailable', data:{reason:'parentUnavailable'} },
        { code:-1, msg:'HTTP 401' },
        { code:-1, msg:'HTTP 500' },
    ]) {
        const h = harness();
        h.set({ createResponse:response });
        await assert.rejects(h.create(h.draft()));
        assert.deepEqual(h.calls.requests.map(item => item.endpoint), ['/api/filetree/getDocPaths', '/api/filetree/createDocByParent']);
        assert.equal(h.calls.patches.length, 0);
    }
});

test('older hosts with HTTP 200 empty replies are detected without probing a write', async () => {
    const h = harness();
    h.set({ structuredUnsupported:true, probeResponse:{} });
    await h.create(h.draft());
    assert.deepEqual(h.calls.requests.map(item => item.endpoint), ['/api/filetree/getDocPaths', '/api/filetree/createDocWithMd']);
    assert.equal(h.calls.patches.length, 1);
});

test('failed structured reads do not trigger a legacy write', async () => {
    const h = harness();
    h.set({ probeResponse:{code:-1, msg:'index unavailable', data:{reason:'indexUnavailable'}} });
    await assert.rejects(h.create(h.draft()), /index unavailable/);
    assert.equal(h.calls.creates.length, 0);
    assert.equal(h.calls.patches.length, 0);
});

test('a committed document is retained when post-create processing fails', async () => {
    const h = harness(), draft = h.draft();
    h.set({ createResponse:{code:-1, msg:'refresh failed', data:{reason:'writeFailed', commitState:'committed', id:ids.doc}} });
    await assert.rejects(h.create(draft), /refresh failed/);
    assert.equal(draft.createdDocId, ids.doc);
    assert.equal(h.calls.patches.length, 0);
    await h.create(draft);
    assert.equal(h.calls.creates.length, 1);
    assert.equal(h.calls.patches.length, 1);
});

test('failed requests retain their allocated document ID for retry', async () => {
    const h = harness(), draft = h.draft();
    h.set({ createError:true });
    await assert.rejects(h.create(draft));
    assert.equal(draft.requestedDocId, ids.doc);
    h.set({ createError:false });
    await h.create(draft);
    assert.equal(h.calls.creates[0].id, h.calls.creates[1].id);
});
