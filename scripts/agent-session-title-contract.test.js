'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');

assert.match(workbench, /const DEFAULT_SESSION_TITLE = '任务工作台'/, 'the workbench default title must have one source');
assert.match(workbench, /function currentSessionHeaderTitle\(\)[\s\S]*return '任务智能体';[\s\S]*return title;/, 'the header must prefer a real current session title and keep the product title for untitled sessions');
assert.match(workbench, /tm-agent-header__title" title="\$\{esc\(headerTitle\)\}"[\s\S]*\$\{esc\(headerTitle\)\}/, 'the rendered header must expose the resolved session title');
assert.match(workbench, /title: DEFAULT_SESSION_TITLE, titled: false/, 'new sessions must allow one title generation attempt');
assert.match(workbench, /typeof session\.titled !== 'boolean'[\s\S]*savedTitle !== DEFAULT_SESSION_TITLE && savedTitle !== SIYUAN_DEFAULT_SESSION_TITLE/, 'older workbench and SiYuan sessions must derive their title state without treating placeholder titles as real names');
assert.match(workbench, /function tryGenerateSessionTitle\(\)[\s\S]*runtime\.session\.titled = true;[\s\S]*post\('\/title', \{[\s\S]*message,[\s\S]*model: '',[\s\S]*language:/, 'title generation must reuse the native Agent title endpoint and default Agent model');
assert.match(workbench, /userEntryText\(firstUserEntry\)\.slice\(0, 500\)/, 'title input must use the visible user text and match the native 500 character limit');
assert.match(workbench, /runtime\.activeSessionID !== sessionID[\s\S]*currentTitle !== DEFAULT_SESSION_TITLE/, 'an asynchronous title must not overwrite another or already titled session');
assert.match(workbench, /finally \{[\s\S]*runtime\.busy = false;[\s\S]*if \(runtime\.session\?\.titled === false\) tryGenerateSessionTitle\(\);/, 'title generation must wait until the Agent turn is finalized');
assert.equal((workbench.match(/tryGenerateSessionTitle\(\);/g) || []).length, 1, 'all requests must use the single Agent conversation title flow');

console.log('agent session title contract tests passed');
