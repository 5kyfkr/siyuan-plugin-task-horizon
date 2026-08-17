const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const kernel = fs.readFileSync(path.join(__dirname, '..', 'kernel.js'), 'utf8');
const workbench = fs.readFileSync(path.join(__dirname, '..', 'src', 'ai', 'agent-workbench.js'), 'utf8');
const toolNames = ['query_focus_statistics', 'query_routine_statistics', 'list_focus_sessions'];

for (const name of toolNames) {
    assert.match(kernel, new RegExp(`MCP_READ_ONLY_TOOLS[\\s\\S]*['"]${name}['"]`), `${name} must be read-only in the Kernel`);
    assert.match(workbench, new RegExp(`TASK_HORIZON_READ_ONLY_TOOLS[\\s\\S]*['"]${name}['"]`), `${name} must be read-only in the Agent UI`);
}

assert.match(kernel, /client\.fetch\(`\/api\/plugin\/rpc\?name=\$\{encodeURIComponent\(DOCK_TOMATO_PLUGIN_ID\)\}`/,
    'Task Horizon must delegate statistics storage and aggregation to DockTomato Kernel RPC');
assert.match(kernel, /dockTomatoQueryFocus[\s\S]*dockTomatoQueryRoutine[\s\S]*dockTomatoListSessions/,
    'all DockTomato statistics methods must use the shared RPC boundary');
assert.doesNotMatch(kernel, /DOCK_TOMATO_KERNEL_SOURCE|DOCK_TOMATO_HISTORY_INDEX|loadDockTomatoHistory|readDockTomatoText/,
    'Task Horizon must not own a second DockTomato history reader or statistics core cache');
assert.doesNotMatch(kernel, /\/api\/file\/getFile[\s\S]{0,800}DockTomato|Function\('globalThis', 'document'/,
    'Task Horizon must not read or evaluate DockTomato source files');

console.log('agent focus statistics tool policy contract tests passed');
