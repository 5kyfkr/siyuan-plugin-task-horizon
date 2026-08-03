'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const detailSource = read('src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js');
const settingsSource = read('src', 'task-horizon', 'main', 'settings', '62-settings-columns-and-rules.js');
const styleSource = read('task-horizon.css');

const detailBuilderStart = detailSource.indexOf('function __tmBuildTaskDetailInnerHtml(');
const detailBuilderEnd = detailSource.indexOf('\n\n    function __tmBuildTaskDetailNoteViewInnerHtml', detailBuilderStart);
assert.ok(detailBuilderStart >= 0 && detailBuilderEnd > detailBuilderStart, 'task detail builder must remain extractable');
const detailBuilder = detailSource.slice(detailBuilderStart, detailBuilderEnd);

assert.match(
    detailBuilder,
    /const configuredColumnOrder = Array\.isArray\(SettingsStore\?\.data\?\.columnOrder\)[\s\S]*const visibleColumnOrder = \[\][\s\S]*appendVisibleColumn[\s\S]*visibleColumnSet = new Set\(visibleColumnOrder\)/,
    'detail rendering must normalize the configured visible column order',
);
assert.match(
    detailBuilder,
    /const detailColumnSectionsHtml = visibleColumnOrder\.map\(\(columnKey\) => \{[\s\S]*if \(columnKey === 'remark'\) return __tmBuildTaskDetailRemarkSectionHtml\([\s\S]*const field = textCustomFieldByColumnKey\.get\(columnKey\)/,
    'remark and text custom fields must be rendered from the configured column order',
);
assert.match(
    detailBuilder,
    /<div class="tm-task-detail-core">[\s\S]*\$\{customFieldsHtml\}[\s\S]*<\/div>[\s\S]*\$\{detailColumnSectionsHtml\}/,
    'single and multi custom fields must remain in the existing core button area',
);
assert.doesNotMatch(
    detailBuilder,
    /visibleOptionCustomFieldDefs\.sort|visibleOptionCustomFieldDefs\s*=\s*visibleColumnOrder/,
    'single and multi custom fields must keep their existing group order',
);
assert.match(
    detailBuilder,
    /\$\{detailColumnSectionsHtml\}\s*\$\{__tmBuildTaskDetailAttachmentSectionHtml\(task, detailTip\)\}/,
    'attachments must remain after the dynamic remark/text field region',
);
assert.match(
    detailBuilder,
    /<textarea class="bc-textarea tm-task-detail-custom-textarea" data-tm-detail-custom-text-field=/,
    'text custom fields must use a dedicated detail textarea class',
);
assert.match(
    styleSource,
    /\.tm-task-detail-shell \.bc-textarea\.tm-task-detail-custom-textarea[\s\S]*background: color-mix\(in srgb, var\(--tm-input-bg\) 94%, var\(--tm-bg-color\)\)/,
    'text custom detail textareas must use the detail input background instead of the topbar input background',
);

const refreshHelperStart = settingsSource.indexOf('function __tmRefreshVisibleTaskDetailsForColumnSettings(');
const refreshHelperEnd = settingsSource.indexOf('\n\n    window.toggleColumn', refreshHelperStart);
assert.ok(refreshHelperStart >= 0 && refreshHelperEnd > refreshHelperStart, 'column settings detail refresh helper must remain extractable');
const refreshHelper = settingsSource.slice(refreshHelperStart, refreshHelperEnd);
assert.match(
    refreshHelper,
    /__tmCollectVisibleTaskDetailTargetIds\(\)[\s\S]*__tmRefreshVisibleTaskDetailForTask\(taskId, \{[\s\S]*forceRebuild: true/,
    'column settings must force-refresh currently visible detail panels',
);
assert.match(
    settingsSource,
    /window\.toggleColumn = async function[\s\S]*__tmRefreshVisibleTaskDetailsForColumnSettings\('toggle-column'\)/,
    'toggling a column must refresh visible details',
);
assert.match(
    settingsSource,
    /window\.moveColumn = function[\s\S]*__tmRefreshVisibleTaskDetailsForColumnSettings\('move-column'\)/,
    'moving a column must refresh visible details',
);

console.log('task detail column settings contract tests passed');
