'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const services = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'),
    'utf8',
);
const render = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/40-render-runtime.js'),
    'utf8',
);
const lifecycle = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/shell/80-shell-lifecycle.js'),
    'utf8',
);
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

assert.match(index, /SIYUAN_SYNC_STATUS_EVENT = "tm:task-horizon-siyuan-sync-status"/);
assert.match(index, /eventBus\.on\("sync-start"|"sync-start":/);
assert.match(index, /eventBus\.on\("sync-end"|"sync-end":/);
assert.match(index, /eventBus\.on\("sync-fail"|"sync-fail":/);
assert.match(index, /思源数据正在同步/);
assert.match(index, /已同步/);
assert.match(index, /window\.dispatchEvent\(new CustomEvent\(SIYUAN_SYNC_STATUS_EVENT/);
assert.match(index, /unregisterSiyuanSyncStatusListeners\(\)/);
assert.match(index, /eventBus\?\.off\?\.\(eventName, handler\)/);

assert.match(services, /__TM_SIYUAN_SYNC_STATUS_EVENT = 'tm:task-horizon-siyuan-sync-status'/);
assert.match(services, /window\.addEventListener\(__TM_SIYUAN_SYNC_STATUS_EVENT, __tmSiyuanSyncStatusHandler\)/);
assert.match(services, /state\.siyuanSyncStatus = next/);
assert.doesNotMatch(services, /data-tm-siyuan-sync-status-text/);

assert.match(render, /class="tm-manager-brand-icon"[\s\S]*data-tm-siyuan-sync-status="\$\{siyuanSyncStatus\}"/);
assert.doesNotMatch(render, /class="tm-siyuan-sync-status"/);
assert.match(lifecycle, /removeEventListener\(__TM_SIYUAN_SYNC_STATUS_EVENT, __tmSiyuanSyncStatusHandler\)/);

assert.match(styles, /tm-manager-brand-icon\[data-tm-siyuan-sync-status="syncing"\][\s\S]*var\(--tm-primary-color\)/);
assert.match(styles, /tm-manager-brand-icon\[data-tm-siyuan-sync-status="failed"\][\s\S]*var\(--tm-danger-color\)/);
assert.doesNotMatch(styles, /tm-manager-brand-icon\[data-tm-siyuan-sync-status="synced"\]/);
assert.doesNotMatch(styles, /\.tm-siyuan-sync-status/);

console.log('siyuan sync status contract tests passed');
