'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

const root = path.resolve(__dirname, '..');
const refreshSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'),
    'utf8',
);

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const bodyStart = source.indexOf('{', source.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unable to extract ${name}`);
}

function segment(source, startText, endText) {
    const start = source.indexOf(startText);
    const end = source.indexOf(endText, start + startText.length);
    assert.ok(start >= 0 && end > start, `missing segment: ${startText}`);
    return source.slice(start, end);
}

const initial = {
    viewMode: 'checklist',
    activeDocId: 'doc-2',
    detailTaskId: 'child-2',
    checklistDetailSheetOpen: false,
    checklistDetailDismissed: false,
    kanbanDetailTaskId: '',
    kanbanDetailAnchorTaskId: '',
    homepageOpen: false,
};
const state = { ...initial };
const context = vm.createContext({ state });
vm.runInContext(
    `${extractFunction(refreshSource, '__tmRefreshUiContextMatches')}\nthis.matches = __tmRefreshUiContextMatches;`,
    context,
);

assert.equal(context.matches(initial), true,
    'an unchanged refresh context must retain the existing UI restoration path');

const changes = [
    ['activeDocId', 'doc-1', 'a document switch during refresh must reject the old snapshot'],
    ['detailTaskId', 'child-1', 'a detail switch during refresh must reject the old snapshot'],
    ['viewMode', 'list', 'a view switch during refresh must reject the old snapshot'],
    ['checklistDetailSheetOpen', true, 'a detail sheet change during refresh must reject the old snapshot'],
    ['checklistDetailDismissed', true, 'closing a detail during refresh must reject the old snapshot'],
    ['kanbanDetailTaskId', 'kanban-task', 'a kanban detail change must reject the old snapshot'],
    ['kanbanDetailAnchorTaskId', 'kanban-anchor', 'a kanban anchor change must reject the old snapshot'],
    ['homepageOpen', true, 'opening another manager surface must reject the old snapshot'],
];
for (const [field, value, message] of changes) {
    Object.assign(state, initial, { [field]: value });
    assert.equal(context.matches(initial), false, message);
}

const refreshCore = segment(
    refreshSource,
    'async function __tmRefreshCore(',
    'window.tmRefreshCalendarInPlace',
);
assert.match(
    refreshCore,
    /if \(preserveUi && snapshot && __tmRefreshUiContextMatches\(snapshot\)\) \{\s*try \{ __tmRestoreRefreshUiState\(snapshot\); \} catch \(e\) \{\}\s*\}/,
    'refresh completion must restore UI only when the user context is unchanged',
);
assert.equal((refreshCore.match(/__tmRestoreRefreshUiState\(snapshot\)/g) || []).length, 1,
    'the guarded refresh must retain exactly one UI restoration path');

console.log('foreground refresh context race contract tests passed');
