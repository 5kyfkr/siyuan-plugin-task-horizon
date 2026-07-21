'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');

assert.match(workbench, /const SESSION_LIST_PAGE_SIZE = 100;/, 'global session loading must use a bounded page size');
assert.match(workbench, /post\('\/lsSessions', \{ page: 1, pageSize: SESSION_LIST_PAGE_SIZE, keyword: '' \}\)[\s\S]*for \(let page = 2; page <= pageCount; page \+= 1\)[\s\S]*sessions\.push\(\.\.\.data\.sessions\)/, 'the workbench must load every page from the SiYuan Agent session index');
assert.doesNotMatch(workbench, /const allowed = new Set\(runtime\.store\.sessionIDs\)[\s\S]{0,240}\.filter\(/, 'SiYuan Agent sessions must not be filtered to plugin-created IDs');

console.log('agent global session list contract tests passed');
