const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const renderRuntime = read('src/task-horizon/main/40-render-runtime.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const contentRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');

// Geometry is exercised by checklist-style-integration-browser.test.js.
// Keep the distinct refresh-hook checks until they have behavior coverage.
assert.match(services, /item\.querySelector\('\.tm-checklist-title-text'\) \|\| item\.querySelector\('\.tm-checklist-title-button > span'\)/,
    'measure text while remaining compatible with existing markup');
assert.match(services, /function __tmSyncChecklistWrappedTitleClasses\(rootEl, itemsToSync = null\)/);
assert.match(services, /title\.getBoundingClientRect\?\.\(\)\.height/);
assert.match(services, /tm-checklist-item--title-wrapped/);
assert.match(renderRuntime, /__tmSyncChecklistWrappedTitleClasses\?\.\(state\.modal\)/);
assert.match(dialogs, /__tmSyncChecklistWrappedTitleClasses\?\.\(modal\)/);
assert.match(contentRuntime, /__tmSyncChecklistWrappedTitleClasses\?\.\(root\)/);

console.log('checklist multiline leading contract tests passed');
