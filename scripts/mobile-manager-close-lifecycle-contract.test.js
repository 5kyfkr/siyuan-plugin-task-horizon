'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const closeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/45-render-shell-controls-and-resize.js'), 'utf8');
const lifecycleSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/80-shell-lifecycle.js'), 'utf8');

assert.doesNotMatch(apiSource, /tmMobileKeepaliveHidden|__tmHideMobileManagerModalForKeepalive|__tmRestoreMobileManagerModalFromKeepalive/, 'closed mobile manager DOM must not be kept alive');
assert.doesNotMatch(lifecycleSource, /__tmRestoreMobileManagerModalFromKeepalive/, 'opening must not revive a retained mobile modal');
assert.match(closeSource, /document\.querySelectorAll\('\.tm-modal, \.tm-settings-modal, \.tm-rules-modal, \.tm-prompt-modal'\)[\s\S]*el\.remove\(\)[\s\S]*state\.modal = null;/, 'closing must remove manager modals and clear state.modal');
assert.doesNotMatch(closeSource, /keepaliveModal|__tmHideMobileManagerModalForKeepalive/, 'close path must not exempt the mobile manager modal');

console.log('mobile manager close lifecycle contract tests passed');
