'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const panels = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
const start = panels.indexOf('window.tmOpenAiSidebar = async function(payload)');
const end = panels.indexOf('window.tmOpenHomepage = async function()', start);
const openAiSidebar = panels.slice(start, end);

assert.ok(start >= 0 && end > start, 'AI sidebar open handler must remain discoverable');
assert.match(openAiSidebar, /const canRenderInCurrentHost = __tmIsPluginVisibleNow\(\);/, 'AI sidebar must reuse the unified active-host visibility check');
assert.match(openAiSidebar, /if \(!canRenderInCurrentHost\) \{\s*await openManager\(/, 'only a hidden or inactive Task Horizon host may reopen the manager');
assert.doesNotMatch(openAiSidebar, /loadSelectedDocuments|__tmRecompute|projection/i, 'opening AI in the current host must not reload or reproject tasks');

console.log('agent sidebar order isolation contract tests passed');
