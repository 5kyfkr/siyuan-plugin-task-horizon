'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'kernel.js'), 'utf8');
function extract(start, end) {
    const left = source.indexOf(start);
    const right = source.indexOf(end, left);
    assert.ok(left >= 0 && right > left);
    return source.slice(left, right);
}
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE blocks (id TEXT PRIMARY KEY, parent_id TEXT, root_id TEXT DEFAULT 'doc', type TEXT, subtype TEXT, sort INTEGER, created TEXT DEFAULT '20260917000000');
    CREATE INDEX blocks_parent ON blocks(parent_id);`);
const insert = db.prepare('INSERT INTO blocks(id, parent_id, type, subtype, sort) VALUES (?, ?, ?, ?, ?)');
const rows = [
    ['doc', '', 'd', '', 0],
    ['list', 'doc', 'l', '', 1],
    ['task', 'list', 'i', 't', 1],
    ['sibling', 'list', 'i', 't', 2],
    ['paragraph', 'task', 'p', '', 1],
    ['sibling-paragraph', 'sibling', 'p', '', 1],
    ['child-list', 'task', 'l', '', 2],
    ['child-task', 'child-list', 'i', 't', 1],
    ['child-paragraph', 'child-task', 'p', '', 1],
    ['plain-list', 'task', 'l', '', 3],
    ['plain-item', 'plain-list', 'i', 'u', 1],
    ['plain-paragraph', 'plain-item', 'p', '', 1],
    ['null-subtype-item', 'plain-list', 'i', null, 2],
    ['container', 'task', 's', '', 4],
    ['deep-paragraph', 'container', 'p', '', 1],
];
for (let depth = 1; depth <= 31; depth += 1) {
    rows.push([`depth-${depth}`, depth === 1 ? 'task' : `depth-${depth - 1}`, 's', '', 1]);
}
rows.forEach((row) => insert.run(...row));
const context = vm.createContext({
    FOCUS_STATS_CANDIDATE_LIMIT: 20000,
    text: (value) => String(value || '').trim(),
    uniqueStrings: (values) => [...new Set(values.filter(Boolean))],
    escapeSql: (value) => String(value).replace(/'/g, "''"),
    assertFocusStatsDeadline() {},
    focusStatsScopeTooLarge: (details) => Object.assign(new Error('scope too large'), { code: 'FOCUS_SCOPE_TOO_LARGE', details }),
    sql: async (statement) => db.prepare(statement).all(),
});
vm.runInContext(extract('async function expandFocusCandidateIDs(', 'async function resolveFocusCandidateIDs(')
    + extract('async function readFocusBlockRolesBatch(', 'async function readFocusTaskRowsBatch('), context);

(async () => {
    // Compare the SQL prefilter with the actual historical binding resolver, including task boundaries.
    const bindings = await context.resolveFocusBindingsBatch(rows.map(([id]) => [id]));
    for (const selected of [['task'], ['sibling'], ['child-task'], ['task', 'child-task']]) {
        const actual = Array.from(await context.expandFocusCandidateIDs(selected, {}));
        const expected = rows.map(([id]) => id).filter((id) => selected.includes(bindings.resolved.get(id))).sort();
        assert.deepEqual(actual, expected, `prefilter must preserve exactly the historical bindings for ${selected}`);
    }
    const candidates = await context.expandFocusCandidateIDs(['task'], {});
    const history = [
        { id: 'task', minutes: 87 },
        { id: 'list', minutes: 16.51 },
        { id: 'sibling', minutes: 60 },
        { id: 'child-list', minutes: 20 },
    ];
    assert.equal(Math.round(history.filter((row) => candidates.includes(row.id)).reduce((sum, row) => sum + row.minutes, 0)), 104,
        '87 task minutes plus 16.51 legacy list minutes must survive filtering without sibling/child minutes');
    assert.deepEqual(Array.from(await context.expandFocusCandidateIDs([], {})), []);
    assert.deepEqual(Array.from(await context.expandFocusCandidateIDs(['missing-task'], {})), ['missing-task'],
        'unpersisted task identities must remain available for frontend aliases');

    // Resolve across chunk boundaries without dropping list aliases or duplicating candidates.
    const manyTasks = [];
    for (let index = 0; index < 101; index += 1) {
        insert.run(`many-list-${index}`, 'doc', 'l', '', index);
        insert.run(`many-task-${index}`, `many-list-${index}`, 'i', 't', 1);
        manyTasks.push(`many-task-${index}`);
    }
    assert.equal((await context.expandFocusCandidateIDs(manyTasks, {})).length, 202);
    for (let index = 0; index < 20001; index += 1) insert.run(`large-${index}`, 'task', 'p', '', index);
    await assert.rejects(context.expandFocusCandidateIDs(['task'], {}),
        (error) => error.code === 'FOCUS_SCOPE_TOO_LARGE' && error.details.maxCandidateCount === 20000,
        'oversized structural scopes must fail rather than silently return incomplete totals');
    console.log('focus candidate bindings contract tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
