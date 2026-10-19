'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const kanbanSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js'), 'utf8');

function extractFunction(input, name) {
    const start = input.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `missing function ${name}`);
    const braceStart = input.indexOf('{', start);
    let depth = 0;
    for (let index = braceStart; index < input.length; index += 1) {
        if (input[index] === '{') depth += 1;
        if (input[index] === '}') depth -= 1;
        if (depth === 0) return input.slice(start, index + 1);
    }
    throw new Error(`unterminated function ${name}`);
}

const helperSource = extractFunction(source, '__tmMoveGlobalNewTaskDocFirst');
const context = { SettingsStore: { data: { newTaskDocId: 'doc-global' } } };
vm.runInNewContext(`${helperSource}\nthis.move = __tmMoveGlobalNewTaskDocFirst;`, context);

const objectEntries = context.move([
    { id: 'doc-user', name: '用户文档' },
    { id: 'doc-global', name: '全局收集箱' },
    { id: 'doc-other', name: '其他文档' },
]);
assert.deepEqual(Array.from(objectEntries, (doc) => doc.id), ['doc-global', 'doc-user', 'doc-other'], 'object document entries must promote the global collection document');
assert.deepEqual(Array.from(context.move(['doc-user', 'doc-global'])), ['doc-global', 'doc-user'], 'document ID entries must keep the existing promotion behavior');
assert.match(
    source,
    /function __tmSortDocEntriesForTabs\([\s\S]*?return __tmMoveGlobalNewTaskDocFirst\(\[\.\.\.pinnedPart, \.\.\.normalPart\]\);/,
    'table/list document sorting must apply the global collection ordering'
);
assert.match(
    kanbanSource,
    /__tmMoveGlobalNewTaskDocFirst\(\s*docsInOrder\.filter\(/,
    'kanban document columns must keep the global collection document first'
);

console.log('global collection document order contract tests passed');
