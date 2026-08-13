const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const store = read('src', 'task-horizon', 'main', '10-stores-rules-and-cache.js');
const services = read('src', 'task-horizon', 'main', '20-api-and-runtime-services.js');
const filters = read('src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js');
const rowModel = read('src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js');
const listRuntime = read('src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js');
const whiteboard = read('src', 'task-horizon', 'main', 'render', '44-render-whiteboard-body.js');
const settings = read('src', 'task-horizon', 'main', 'settings', '60-settings-screen.js');
const actions = read('src', 'task-horizon', 'main', 'settings', '70-doc-group-and-settings-actions.js');

assert.match(store, /alwaysShowTaskDocHeadingGroups: false/, 'the setting must default off');
assert.match(store, /cloudData\.alwaysShowTaskDocHeadingGroups/, 'cloud settings must restore the switch');
assert.match(store, /Storage\.get\('tm_always_show_task_doc_heading_groups'/, 'local settings must load the switch');
assert.match(store, /Storage\.set\('tm_always_show_task_doc_heading_groups'/, 'local settings must persist the switch');
assert.match(store, /cloudData\.keepCompletedDocHeadingGroupsVisible[\s\S]*tm_keep_completed_doc_heading_groups_visible/, 'the renamed setting must migrate its previous cloud and local keys');
assert.match(settings, /文档分组下按任务标题级别子分组[\s\S]*有任务的标题分组始终显示[\s\S]*updateAlwaysShowTaskDocHeadingGroups/, 'settings must describe the active task heading level and expose the switch');
assert.match(actions, /updateAlwaysShowTaskDocHeadingGroups[\s\S]*SettingsStore\.save\(\)[\s\S]*__tmRecomputeTaskProjection\(/, 'the switch action must persist the setting and refresh the heading inventory');
assert.match(services, /function __tmShouldAlwaysShowTaskDocHeadingGroups\(\)[\s\S]*state\.groupByDocName === true/, 'persistent heading groups must be limited to document grouping');
assert.doesNotMatch(services.match(/function __tmShouldAlwaysShowTaskDocHeadingGroups\(\)[\s\S]*?\n    \}/)?.[0] || '', /showCompletedTasks/, 'persistent heading groups must not depend on completed-task visibility');
assert.match(filters, /allTaskDocIdsForTabs[\s\S]*scopedTaskDocIds[\s\S]*Object\.values\(taskMap\)\.forEach\(addHeadingTask\)[\s\S]*state\.taskDocHeadingGroupTasks = headingTasks[\s\S]*const filterVisibleTasks/, 'the heading inventory must come from the full task index before task visibility filters');
assert.doesNotMatch(filters, /taskDocHeadingGroupTasks = RuleManager\.applyRuleFilter/, 'the heading inventory must not depend on the active rule');
assert.match(rowModel, /activeDocRootTasks\.length === 0 && alwaysVisibleDocHeadingTasks\.length === 0/, 'row-model views must keep documents that contain persistent headings');
assert.match(rowModel, /h2OrderSource = docTasks\.concat\(alwaysVisibleDocHeadingTasks\)/, 'row-model views must build heading rows from visible tasks and the full heading inventory');
assert.match(listRuntime, /state\.filteredTasks\.length === 0 && alwaysVisibleHeadingTasks\.length === 0/, 'table rendering must not show the empty state when persistent headings exist');
assert.match(listRuntime, /h2OrderSource = docTasks\.concat\(alwaysVisibleDocHeadingTasks\)/, 'table rendering must build heading rows from visible tasks and the full heading inventory');
assert.match(whiteboard, /alwaysVisibleHeadingDocIds[\s\S]*alwaysVisibleHeadingBucketKeys/, 'document-stream cards must keep documents and persistent heading rows');

console.log('task document heading group visibility contract tests passed');
