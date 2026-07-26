'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const settingsScreen = read('src/task-horizon/main/settings/60-settings-screen.js');
const settingsActions = read('src/task-horizon/main/settings/70-doc-group-and-settings-actions.js');
const settingsStore = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const fsrsRuntime = read('src/task-horizon/main/task-runtime/50a-fsrs-runtime.js');
const detailRuntime = read('src/task-horizon/main/task-runtime/52-task-detail-runtime.js');
const listRuntime = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const recurringRuntime = read('src/task-horizon/main/task-runtime/54-recurring-task-runtime.js');
const css = read('task-horizon.css');

assert.match(dialogs, /option value="fsrs"[^>]*>FSRS 间隔重复<\/option>/, 'repeat selection must expose FSRS interval repetition');
assert.doesNotMatch(dialogs, /FSRS 智能复习/, 'repeat selection must not use the legacy FSRS name');
assert.match(dialogs, /勾选任务表示“良好”；也可从任务菜单选择重来、困难、良好或简单。/, 'repeat dialog must explain checkbox and explicit rating behavior');
for (const [rating, label] of [[1, '重来'], [2, '困难'], [3, '良好'], [4, '简单']]) {
    assert.match(dialogs, new RegExp(`reviewAction\\(${rating}, '${label}'`), `task detail must expose the ${label} rating`);
    assert.match(fsrsRuntime, new RegExp(`${rating}: '${label}'`), `FSRS history must use SiYuan's ${label} label`);
    assert.match(fsrsRuntime, new RegExp(`rating: ${rating}, label: '${label}'`), `shared FSRS previews must expose the ${label} rating`);
}
assert.match(listRuntime, /const createFsrsReviewBlock = \(\) =>/, 'task context menu must render ratings as one compact block');
assert.match(listRuntime, /__tmBuildFsrsReviewPreviews\(task, \{ reviewedAt \}\)/, 'the context menu must use shared next-date previews');
assert.match(listRuntime, /data-tm-fsrs-rating/, 'context rating buttons must expose semantic rating values');
assert.doesNotMatch(listRuntime, /没记住，重新安排/, 'the old single Again menu item must be removed');
assert.match(css, /\.tm-task-context-fsrs__row[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/, 'the four ratings must stay in one stable row');
assert.match(css, /\.tm-task-context-fsrs__btn--good\.is-default[\s\S]*?background:/, 'the checkbox-default Good rating must be visually recommended');
assert.match(css, /\.tm-task-context-fsrs__due[\s\S]*?background:/, 'context preview dates must have a distinct background');
assert.match(listRuntime, /if \(!fsrsRating && ev\?\.target\) fsrsRating = 3/, 'a real checkbox event must default to Good');
assert.match(recurringRuntime, /if \(!fsrsRating \|\| fsrsRating === 1\) return false/, 'Again and missing ratings must not enter the completion transaction');
assert.match(detailRuntime, /data-tm-detail-fsrs-review/, 'task detail must render inline ratings below the title');
assert.match(detailRuntime, /默认良好 · 下次/, 'task detail must show the default Good preview');
assert.match(detailRuntime, /data-tm-detail-fsrs-rating/, 'task detail ratings must be directly actionable');
assert.match(detailRuntime, /tmReviewFsrsTask\(taskId, rating, \{ source: 'task-detail-inline-fsrs-review' \}\)/, 'inline ratings must use the authoritative FSRS transaction');
assert.match(css, /\.tm-task-detail-fsrs__row[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/, 'task detail ratings must remain in one stable row');
assert.match(css, /\.tm-task-detail-fsrs__due[\s\S]*?background:/, 'task detail preview dates must have a distinct background');
assert.match(css, /\.tm-task-detail-header\s*\{[\s\S]*?container-type:\s*inline-size;/, 'task detail must expose its actual panel width to responsive review controls');
assert.match(css, /@container\s*\(max-width:\s*560px\)[\s\S]*?\.tm-task-detail-fsrs__btn\s*\{[\s\S]*?flex-direction:\s*column;/, 'narrow task detail panels must stack each rating above its date');
assert.match(detailRuntime, /function __tmGetTaskTimeHubFsrsGoodDate\([\s\S]*?option\.rating === 3/, 'the task calendar must derive the Good review date from FSRS previews');
assert.equal((detailRuntime.match(/key === fsrsGoodValue \? 'is-fsrs-good' : ''/g) || []).length, 2, 'both task calendar renderers must mark the Good review date');
assert.match(css, /\.tm-task-time-hub__day\.is-fsrs-good::after\s*\{[\s\S]*?background:/, 'the Good review date must have a visible calendar background');
assert.equal((detailRuntime.match(/cards\.push\(\['progress', 'hash', '当前轮次', currentOccurrenceText, true\]\)/g) || []).length, 2, 'both detail renderers must fill the FSRS end slot with current occurrence');
assert.equal((detailRuntime.match(/role="status"/g) || []).length, 2, 'the current occurrence summary must remain non-interactive');
assert.match(dialogs, /\bhash:\s*'M224,84H180\.2l7\.61-41\.85/, 'the current occurrence summary must use the bundled Phosphor Bold hash icon');

assert.doesNotMatch(settingsScreen, /data-tm-settings-section="fsrs"/, 'FSRS settings must not create a separate general-settings tab');
assert.doesNotMatch(listRuntime, /\{ id: 'fsrs', label:/, 'the general-settings navigation must not expose a standalone FSRS tab');
assert.match(settingsScreen, /data-tm-settings-section="status"[\s\S]*?tm-settings-section-title">FSRS 间隔重复<\/div>[\s\S]*?目标记忆率/, 'status options must contain the FSRS interval repetition settings');
assert.match(settingsScreen, /目标记忆率[\s\S]*?min="80" max="97"/, 'retention control must use the supported range');
assert.match(settingsScreen, /最大复习间隔[\s\S]*?min="30" max="3650"/, 'maximum interval control must use the supported range');
assert.match(settingsScreen, /分散复习日期[\s\S]*?updateFsrsEnableFuzz/, 'settings must expose optional fuzz');
assert.match(settingsActions, /Math\.max\(80, Math\.min\(97,[\s\S]*?fsrsDesiredRetention = percent \/ 100/, 'retention updates must be clamped');
assert.match(settingsActions, /fsrsMaximumIntervalDays = Math\.max\(30, Math\.min\(3650,/, 'maximum interval updates must be clamped');

for (const key of ['fsrsDesiredRetention', 'fsrsMaximumIntervalDays', 'fsrsEnableFuzz']) {
    assert.match(settingsStore, new RegExp(`\\b${key}\\b`), `settings store must define ${key}`);
    assert.match(settingsStore, new RegExp(`cloudData\\.${key}`), `cloud settings must restore ${key}`);
}
for (const storageKey of ['tm_fsrs_desired_retention', 'tm_fsrs_maximum_interval_days', 'tm_fsrs_enable_fuzz']) {
    const matches = settingsStore.match(new RegExp(storageKey, 'g')) || [];
    assert.equal(matches.length, 2, `${storageKey} must be read and written locally`);
}

console.log('FSRS UI and settings contract tests passed');
