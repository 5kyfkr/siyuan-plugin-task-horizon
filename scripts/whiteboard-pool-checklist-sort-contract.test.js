'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'), 'utf8');

assert.match(renderSource, /const poolSortContext = \(\(\) => \{[\s\S]*?__tmBuildRuleSortContext/, 'the pool must reuse the checklist rule-sort context');
assert.match(
    renderSource,
    /const sortPoolTasksLikeChecklist[\s\S]*?if \(poolHasExplicitSort\)[\s\S]*?RuleManager\.applyRuleSort[\s\S]*?if \(poolPinWithinGroups\)[\s\S]*?fallbackCompare/,
    'pool sorting precedence must be explicit rule, within-group pinning, then fallback order'
);
assert.match(
    renderSource,
    /const comparePoolByTimePriority[\s\S]*?aBucket[\s\S]*?aRank[\s\S]*?ats[\s\S]*?getOrder\(a\?\.id\)/,
    'time-priority fallback must match the checklist overdue, date, timestamp, and source-order comparison'
);
assert.match(
    renderSource,
    /const preferTimeGroupSort = !!SettingsStore\.data\.groupSortByBestSubtaskTimeInTimeQuadrant[\s\S]*?section\?\.kind === 'time'[\s\S]*?section\?\.kind === 'quadrant'/,
    'time and quadrant pool groups must honor the checklist best-subtask-time setting'
);
assert.match(renderSource, /sortPoolTasksLikeChecklist\(groupRootTasks\)/, 'document and H2 pool roots must use checklist sorting');
assert.match(renderSource, /const sortedTasks = sortPoolTasksLikeChecklist\(/, 'non-document pool groups must use checklist sorting');
assert.doesNotMatch(
    renderSource,
    /poolHtml = Array\.from\(groups\.values\(\)\)[\s\S]{0,180}localeCompare/,
    'task-name pool groups must preserve checklist first-occurrence order instead of sorting labels alphabetically'
);

const sorterStart = renderSource.indexOf('const sortPoolTasksLikeChecklist =');
const sorterEnd = renderSource.indexOf('\n            const poolDocRankMap', sorterStart);
assert.ok(sorterStart >= 0 && sorterEnd > sorterStart, 'the checklist-style pool sorter must be extractable');
const sorterSource = renderSource.slice(sorterStart, sorterEnd);
const buildSorter = ({ explicit, pinWithinGroups }) => {
    const context = { RuleManager: { applyRuleSort: (items) => items.slice().sort((a, b) => a.ruleRank - b.ruleRank) } };
    vm.runInNewContext(`
        const poolHasExplicitSort = ${explicit ? 'true' : 'false'};
        const poolPinWithinGroups = ${pinWithinGroups ? 'true' : 'false'};
        const poolSortContext = { rule: {}, runtime: {} };
        const isPoolActivePinnedTask = (task) => task?.pinned === true && task?.done !== true;
        ${sorterSource}
        globalThis.sortPoolTasks = sortPoolTasksLikeChecklist;
    `, context, { filename: 'whiteboard-pool-checklist-sort.js' });
    return context.sortPoolTasks;
};
const tasks = [
    { id: 'normal', pinned: false, done: false, order: 1, ruleRank: 2 },
    { id: 'pinned', pinned: true, done: false, order: 3, ruleRank: 3 },
    { id: 'done-pinned', pinned: true, done: true, order: 0, ruleRank: 1 },
];
const fallbackCompare = (a, b) => a.order - b.order;
assert.deepEqual(
    Array.from(buildSorter({ explicit: true, pinWithinGroups: true })(tasks.slice(), fallbackCompare), (task) => task.id),
    ['done-pinned', 'normal', 'pinned'],
    'an explicit rule must override both pinned and fallback ordering'
);
assert.deepEqual(
    Array.from(buildSorter({ explicit: false, pinWithinGroups: true })(tasks.slice(), fallbackCompare), (task) => task.id),
    ['pinned', 'done-pinned', 'normal'],
    'within-group mode must promote only active pinned tasks, then use fallback order'
);
assert.deepEqual(
    Array.from(buildSorter({ explicit: false, pinWithinGroups: false })(tasks.slice(), fallbackCompare), (task) => task.id),
    ['done-pinned', 'normal', 'pinned'],
    'without within-group pinning, the fallback comparator must control the full order'
);

console.log('whiteboard pool checklist sort contract tests passed');
