const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const styles = read('task-horizon.css');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const renderRuntime = read('src/task-horizon/main/40-render-runtime.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const contentRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');

assert.match(styles, /--tm-checklist-title-line-height:\s*calc\(var\(--tm-font-size\) \* 1\.45\)/,
    'checkbox, tree control, status and title icons share the same first-line reference');
assert.match(styles, /\.tm-checklist-pane--compact \.tm-checklist-leading\s*\{[^}]*align-self:\s*stretch;/,
    'the leading container retains row geometry while controls align to the first title line');
assert.match(styles,
    /\.tm-modal \.tm-checklist-pane--compact \.tm-checklist-leading input\.tm-task-checkbox\[type="checkbox"\]:not\(\.tm-task-checkbox--delight\)\s*\{[^}]*top:\s*calc\(var\(--tm-checklist-title-line-height\) \/ 2\)\s*!important;/,
    'native checkbox resets preserve shared first-line geometry');
const calendarStyles=read('calendar-view.css');
assert.doesNotMatch(calendarStyles,
    /\.tm-calendar-task-page-list \.tm-checklist-pane--compact \.tm-checklist-leading input\.tm-task-checkbox[^}]*top:\s*50%/,
    'calendar must not override first-line alignment with whole-row centering');
assert.match(services, /item\.querySelector\('\.tm-checklist-title-text'\) \|\| item\.querySelector\('\.tm-checklist-title-button > span'\)/,
    'measure text while remaining compatible with existing markup');
assert.match(services, /function __tmSyncChecklistWrappedTitleClasses\(rootEl, itemsToSync = null\)/);
assert.match(services, /title\.getBoundingClientRect\?\.\(\)\.height/);
assert.match(services, /tm-checklist-item--title-wrapped/);
assert.match(renderRuntime, /__tmSyncChecklistWrappedTitleClasses\?\.\(state\.modal\)/);
assert.match(dialogs, /__tmSyncChecklistWrappedTitleClasses\?\.\(modal\)/);
assert.match(contentRuntime, /__tmSyncChecklistWrappedTitleClasses\?\.\(root\)/);

console.log('checklist multiline leading contract tests passed');
