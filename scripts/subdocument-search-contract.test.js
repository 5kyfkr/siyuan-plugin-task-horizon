'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'),
    'utf8',
);
const methodStart = source.indexOf('        async getSubDocIds(');
const methodEnd = source.indexOf('\n\n        async readDir(', methodStart);
assert.ok(methodStart >= 0 && methodEnd > methodStart, 'getSubDocIds must be discoverable');

const methodSource = source.slice(methodStart, methodEnd).trim().replace(/,$/, '');
const { getSubDocIds } = vm.runInNewContext(`({${methodSource}})`, {
    SettingsStore: { data: { recursiveDocLimit: 37 } },
});

function createApi(meta, ids) {
    const calls = [];
    return {
        calls,
        getSubDocIds,
        async call(url, body) {
            calls.push({ url, body });
            if (calls.length === 1) return { code: 0, data: [meta] };
            return { code: 0, data: ids.map((id) => ({ id })) };
        },
    };
}

async function run() {
    const parentId = '20260721090000-parent';
    const boxId = '20260721090001-boxroot';
    const ordinaryApi = createApi(
        { path: `/${parentId}.sy`, box: boxId },
        ['20260721090002-childa', '20260721090003-childb'],
    );
    assert.deepEqual(
        await ordinaryApi.getSubDocIds(parentId),
        ['20260721090002-childa', '20260721090003-childb'],
    );
    assert.equal(ordinaryApi.calls.length, 2);
    assert.match(ordinaryApi.calls[0].body.stmt, /SELECT path, box FROM blocks/);
    assert.match(ordinaryApi.calls[1].body.stmt, new RegExp(`box = '${boxId}'`));
    assert.match(ordinaryApi.calls[1].body.stmt, new RegExp(`path LIKE '/${parentId}/%'`));
    assert.doesNotMatch(ordinaryApi.calls[1].body.stmt, /hpath LIKE/);
    assert.match(ordinaryApi.calls[1].body.stmt, /LIMIT 37$/);

    const boxDocApi = createApi(
        { path: `/${boxId}.sy`, box: boxId },
        ['20260721090004-topdoc', '20260721090005-nested'],
    );
    assert.deepEqual(
        await boxDocApi.getSubDocIds(boxId, { limit: 0 }),
        ['20260721090004-topdoc', '20260721090005-nested'],
    );
    assert.equal(boxDocApi.calls.length, 2);
    assert.match(boxDocApi.calls[1].body.stmt, new RegExp(`box = '${boxId}'`));
    assert.match(boxDocApi.calls[1].body.stmt, new RegExp(`id != '${boxId}'`));
    assert.doesNotMatch(boxDocApi.calls[1].body.stmt, /path LIKE/);
    assert.doesNotMatch(boxDocApi.calls[1].body.stmt, / LIMIT /);

    const invalidApi = createApi({}, []);
    assert.deepEqual(Array.from(await invalidApi.getSubDocIds('not-a-document-id')), []);
    assert.equal(invalidApi.calls.length, 0);
}

run()
    .then(() => console.log('subdocument search contract tests passed'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
