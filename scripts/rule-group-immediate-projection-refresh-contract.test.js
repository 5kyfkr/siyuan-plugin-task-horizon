'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const renderRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const settingsActions = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/70-doc-group-and-settings-actions.js'), 'utf8');

function extractFunction(source, name) {
    const start = source.indexOf('function ' + name + '(');
    assert.notEqual(start, -1, name + ' must exist');
    const bodyStart = source.indexOf('{', source.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error('Unable to extract ' + name);
}

function segment(source, startText, endText) {
    const start = source.indexOf(startText);
    const end = source.indexOf(endText, start + startText.length);
    assert.ok(start >= 0 && end > start, 'missing segment: ' + startText);
    return source.slice(start, end);
}

const refreshHelper = extractFunction(settingsActions, '__tmRefreshSettingsProjectionView');
assert.match(refreshHelper, /state\.listDomRenderSignature = ''/,
    'rule and grouping changes must invalidate the mounted list/checklist signature');
assert.match(refreshHelper, /__tmRecomputeTaskProjection\(\{ reason: refreshReason \}\)[\s\S]*__tmRefreshMainViewInPlace\(\{[\s\S]*withFilters:\s*false,[\s\S]*deferIfDetailBusy:\s*false/,
    'rule and grouping changes must recompute before an immediate detail-safe in-place redraw');
assert.doesNotMatch(refreshHelper, /__tmScheduleViewRefresh|__tmScheduleRender/,
    'explicit rule and grouping switches must not wait in the generic detail-busy refresh queue');

const applyRule = segment(
    renderRuntime,
    'window.applyFilterRule = async function(ruleId)',
    'window.clearFilterRule = async function()',
);
const clearRule = segment(
    renderRuntime,
    'window.clearFilterRule = async function()',
    '// 原有的其他函数保持不变',
);
for (const entry of [['apply', applyRule], ['clear', clearRule]]) {
    const label = entry[0];
    const source = entry[1];
    assert.match(source, /__tmRefreshSettingsProjectionView\(/,
        label + ' rule must use the immediate projection refresh');
    assert.doesNotMatch(source, /__tmScheduleRender\(/,
        label + ' rule must not queue a full render behind active task detail');
}

const calls = [];
const state = { listDomRenderSignature: 'old', filteredTasks: ['old'] };
const context = vm.createContext({
    String,
    state,
    __tmRecomputeTaskProjection(options) {
        calls.push(['projection', options]);
        state.filteredTasks = ['sorted'];
    },
    __tmRefreshMainViewInPlace(options) {
        calls.push(['refresh', options, state.filteredTasks.slice()]);
        return true;
    },
    __tmRerenderCurrentViewInPlace() {
        calls.push(['fallback-rerender']);
        return true;
    },
    render() { calls.push(['fallback-render']); },
});
vm.runInContext(refreshHelper, context);
context.__tmRefreshSettingsProjectionView('rule-switch');
assert.equal(state.listDomRenderSignature, '');
assert.deepEqual(calls.map((entry) => entry[0]), ['projection', 'refresh']);
assert.deepEqual(calls[1][2], ['sorted'], 'the redraw must observe the newly sorted projection');
assert.equal(calls[1][1].withFilters, false);
assert.equal(calls[1][1].deferIfDetailBusy, false);

console.log('rule and group immediate projection refresh contract tests passed');
