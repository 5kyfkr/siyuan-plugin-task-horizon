'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const listRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
const checklistRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/42-render-list-and-checklist-body.js'), 'utf8');
const viewSwitchRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
const renderRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const dialogRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

assert.match(listRuntime, /const virtualThreshold = state\.__tmSnapshotFirstRenderLimitMode \? 0 : 50;/, 'large list views must use the existing incremental render window');
assert.match(checklistRuntime, /const checklistVirtualThreshold = state\.__tmSnapshotFirstRenderLimitMode \? 0 : 50;/, 'large checklist views must use the existing incremental render window');
assert.match(viewSwitchRuntime, /__tmMarkHighPriorityInteraction\('view-switch', mobileLike \? 460 : 240\);/, 'desktop and mobile view switches must defer non-critical render work');
assert.match(viewSwitchRuntime, /state\.uiAnimKind = '';\s*state\.uiAnimTs = 0;/, 'all task view switches must render without transition animation');
assert.doesNotMatch(viewSwitchRuntime, /reduceSwitchMotion|prevIdx|nextIdx/, 'view switching must not retain task-count-specific animation branches');
assert.match(viewSwitchRuntime, /__TM_BODY_ONLY_VIEW_SWITCH_MODES = new Set\(\['list', 'checklist', 'timeline', 'kanban'\]\)/, 'the body-only fast path must stay limited to the four proven desktop task views');
assert.match(viewSwitchRuntime, /function __tmTrySwitchViewBodyInPlace[\s\S]*?stage\.innerHTML =[\s\S]*?modal\.setAttribute\('data-tm-render-mode', nextMode\)/, 'common desktop switches must replace only the main stage and keep the live plugin shell');
assert.match(viewSwitchRuntime, /if \(!__tmTrySwitchViewBodyInPlace\(prev, next\)\) render\(\);/, 'body-only switching must retain the full render fallback');
assert.match(viewSwitchRuntime, /state\.homepageOpen \|\| state\.attachmentLibraryOpen[\s\S]*?__tmIsDockHost\(\)[\s\S]*?width > 0 && width <= 768/, 'complex, docked, mobile, and narrow hosts must bypass the body-only fast path');
assert.match(renderRuntime, /data-tm-view-toolbar-extra="1"/, 'the persistent shell must expose a stable slot for view-specific toolbar controls');
assert.match(renderRuntime, /__tmBindTimelineStageInteractions\(state\.modal\)/, 'full rendering and the fast path must share timeline stage interaction binding');
assert.match(renderRuntime, /kind === 'from-left' \? ' tm-stage-anim--from-left' : ''/, 'an empty animation kind must not fall through to the vertical stage animation');
assert.doesNotMatch(styles, /tmViewFadeIn|tm-stage-anim--fade/, 'the removed large-view fade must not leave dead CSS behind');
assert.match(dialogRuntime, /__tmScheduleDocGroupSwitchVerifyAfterFirstPaint\(\{[\s\S]*?source: 'switch-doc-group:snapshot-verify',[\s\S]*?scopeVerifyTtlMs: 60000/, 'snapshot-backed group switches must schedule lightweight group and task verification after first paint');
assert.doesNotMatch(dialogRuntime, /snapshotRendered\)[\s\S]*?await loadSelectedDocuments\([\s\S]*?source: 'switch-doc-group:full:snapshot'/, 'snapshot-backed group switches must not synchronously rebuild the full view');
assert.match(dialogRuntime, /const deferForScroll = __tmShouldDeferMainViewRefreshForActiveScroll\([\s\S]*?__tmScheduleIdleTask\(run, 120\)/, 'silent snapshot verification must wait until active scrolling is quiet');
assert.doesNotMatch(dialogRuntime, /source: 'switch-doc-group:snapshot-cache'/, 'group switching must not use the unconditional full task snapshot verifier');
assert.match(styles, /\.tm-table td \{[\s\S]*?border-bottom: 1px solid var\(--tm-table-border-color\);[\s\S]*?box-shadow: none;/, 'ordinary table cells must use the cheaper border separator');
assert.match(styles, /\.tm-body\.tm-body--list #tmTaskTable tbody tr\[data-id\] \{[\s\S]*?content-visibility: auto;[\s\S]*?contain-intrinsic-size: auto var\(--tm-row-height\);/, 'large table views must skip rendering offscreen task row contents');

console.log('large snapshot view switch performance contract tests passed');
