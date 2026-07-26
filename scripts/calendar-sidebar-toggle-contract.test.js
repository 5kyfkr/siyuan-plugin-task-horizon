'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
const start = source.indexOf('function __tmRenderBodyOnlyViewToolbarExtra');
const end = source.indexOf('function __tmSyncBodyOnlyViewSwitcherButtons', start);

assert.ok(start >= 0 && end > start, 'body-only toolbar renderer must exist');
const toolbarRenderer = source.slice(start, end);

assert.match(toolbarRenderer, /mode === 'calendar'/, 'body-only calendar switches must render calendar toolbar controls');
assert.match(toolbarRenderer, /onclick="tmCalendarToggleSidebar\(\)"/, 'body-only calendar switches must preserve the sidebar toggle');
assert.match(toolbarRenderer, /__tmRenderLucideIcon\('calendar-days'\)/, 'calendar sidebar toggle must preserve its existing icon');
assert.match(toolbarRenderer, /tm-modal--dock[\s\S]*tm-modal--mobile[\s\S]*tm-modal--runtime-mobile[\s\S]*tm-modal--host-mobile-ui[\s\S]*if \(usesCompactToggle\) return '';/, 'compact hosts must keep using their existing sidebar toggle');

console.log('calendar sidebar toggle contract tests passed');
