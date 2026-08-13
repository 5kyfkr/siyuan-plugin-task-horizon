'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'), 'utf8');
const settingsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');

assert.match(
    renderSource,
    /const poolPinWithinGroups = !!SettingsStore\.data\.pinTasksWithinGroups && poolGroupMode !== 'none'/,
    'grouped pool modes must honor the existing keep-pinned-within-groups setting'
);
assert.match(
    renderSource,
    /const isPoolActivePinnedTask = \(task\) => __tmIsTaskPinned\(task\) && !isWhiteboardTaskDone\(task\)/,
    'only active pinned roots may enter the standalone pinned group'
);
assert.match(
    renderSource,
    /const pinnedPoolRootEntries = poolPinWithinGroups[\s\S]*?const regularPoolRootEntries = poolPinWithinGroups/,
    'standalone and within-group modes must share one root-entry split'
);
assert.match(
    renderSource,
    /pinnedPoolRootEntries\.forEach[\s\S]*?entry\?\.docData\?\.childrenMap\?\.get\(id\)/,
    'a standalone pinned root must remove its full descendant tree from document sections'
);
assert.match(
    renderSource,
    /kind: 'pinned',[\s\S]*?key: 'pinned_root_tasks',[\s\S]*?label: '置顶'/,
    'the pool must render the checklist-compatible pinned section'
);
assert.match(
    renderSource,
    /const hasSeparatePinnedGroup = pinnedPoolRootEntries\.length > 0;[\s\S]*?label: hasSeparatePinnedGroup \? '普通' : '全部任务'/,
    'ungrouped mode must mirror the checklist pinned and normal sections'
);
assert.match(
    renderSource,
    /if \(poolPinWithinGroups\)[\s\S]*?const aPinned = isPoolActivePinnedTask\(a\)[\s\S]*?if \(aPinned !== bPinned\) return aPinned \? -1 : 1/,
    'within-group mode must promote active pinned roots when no explicit sort overrides it'
);
assert.match(renderSource, /poolHtml = `\$\{pinnedPoolHtml\}\$\{poolHtml\}`/, 'the pinned section must render before every regular pool group');
assert.match(settingsSource, /表格、清单、看板和白板任务池/, 'the shared setting description must name the whiteboard task pool');

console.log('whiteboard pool pinned group contract tests passed');
