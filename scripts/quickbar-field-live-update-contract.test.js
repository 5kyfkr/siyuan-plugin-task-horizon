const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');

function segment(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, `${startMarker} must exist`);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(end, -1, `${endMarker} must exist after ${startMarker}`);
    return source.slice(start, end);
}

const patchHelper = segment(
    'function patchCurrentFloatbarPropsFromAttrUpdate',
    'function refreshInlineMetaByTaskId'
);
assert.match(patchHelper, /getInlineFieldConfig\(attrKey\)/);
assert.match(patchHelper, /currentProps = normalizeCustomProps/);
assert.match(patchHelper, /\[cacheKey\]: detail\?\.value/);

const handler = segment(
    'taskAttrUpdatedHandler = async',
    "window.addEventListener('tm-task-attr-updated'"
);
assert.match(handler, /patchCurrentFloatbarPropsFromAttrUpdate\(e\.detail, normalizedAttrKey\)/);
assert.match(handler, /if \(!isReminderRelatedAttrKey\(normalizedAttrKey\)\)[\s\S]*renderFloatBar\(\)[\s\S]*updatePosition\(\)/,
    'non-reminder fields such as priority must repaint the visible float bar');
assert.match(handler, /currentIds\.has\(incomingTaskId\)[\s\S]*currentIds\.has\(incomingResolvedTaskId\)[\s\S]*currentIds\.has\(incomingAttrHostId\)/,
    'unrelated task updates must not repaint the current float bar');
assert.match(handler, /await refreshCurrentReminderSnapshot\(true\)/,
    'reminder-derived values must retain their authoritative refresh');

const fieldSave = segment(
    'async function saveTaskAttrWithUndo',
    '// 格式化日期'
);
assert.match(fieldSave, /applyTaskAttrUpdateWithUndo/,
    'Quickbar task fields must use the shared task command');
assert.match(fieldSave, /background: true,[\s\S]*wait: false,[\s\S]*renderOptimistic: true/,
    'Quickbar field updates must publish an immediate optimistic patch');
assert.doesNotMatch(fieldSave, /setBlockCustomAttrs|\/api\/attr\/setBlockAttrs/,
    'Quickbar must not fall back to a raw attribute write after a task command failure');
assert.doesNotMatch(source, /\/api\/attr\/setBlockAttrs/,
    'Quickbar must not retain a second task field writer');

console.log('quickbar field live update contract tests passed');
