'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.css'), 'utf8');

assert.match(workbench, /data-agent-action="rename-session"[\s\S]*data-agent-action="toggle-session-menu"[\s\S]*data-agent-action="delete-session"/, 'session rows must expose native-style rename and more-menu delete actions');
assert.match(workbench, /function beginSessionRename\(id, trigger\)[\s\S]*dataset\.agentSessionRename = sessionID[\s\S]*name="title"/, 'session rename must use an inline editor');
assert.match(workbench, /async function renameSession\(id, value\)[\s\S]*post\('\/getSession'[\s\S]*expectedRevision: Number\(session\.revision\) \|\| 0[\s\S]*post\('\/saveSession'/, 'renaming must update the authoritative SiYuan session with revision protection');
assert.match(workbench, /session\.agentRunning === true[\s\S]*会话正在其他实例中处理/, 'sessions running in another SiYuan instance must not be renamed');
assert.match(workbench, /if \(sessionID === runtime\.activeSessionID\) runtime\.session = next;/, 'renaming the active session must update the visible header source');
assert.match(workbench, /async function removeSession\(id\)[\s\S]*runtime\.busy[\s\S]*runtime\.sessions\.find\([\s\S]*await loadSession\(next\.id\)[\s\S]*else createSession\(\)[\s\S]*post\('\/removeSession'/, 'deleting the active session must reject busy sessions and switch before removing it');
assert.match(styles, /\.tm-agent-history__row\.is-menu-open \.tm-agent-history__menu\s*\{[\s\S]*display: block/, 'the session delete command must be presented in a more menu');
assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*\.tm-agent-history__row:hover[\s\S]*opacity: 1/, 'desktop session actions must appear on row hover while remaining available on touch clients');

console.log('agent session management contract tests passed');
