'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const calendarCss = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const settingsStore = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const exportRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/64-export-runtime.js'), 'utf8');

assert.match(index, /CALENDAR_SUBSCRIPTION_CORE_SCRIPT_PATH[\s\S]*loadScriptText\(CALENDAR_SUBSCRIPTION_CORE_SCRIPT_PATH[\s\S]*loadScriptText\(CALENDAR_VIEW_SCRIPT_PATH/, 'ICS core must load before calendar-view');

const buildStart = calendar.indexOf('async function buildCalendarSubscriptionEvents()');
const buildEnd = calendar.indexOf('\n    async function readKernelJsonResponse', buildStart);
assert.ok(buildStart >= 0 && buildEnd > buildStart, 'publisher event projection must remain extractable');
const buildBlock = calendar.slice(buildStart, buildEnd);
assert.match(buildBlock, /const tomatoLoaded = isDockTomatoPluginLoaded\(\);[\s\S]*if \(tomatoLoaded\) \{[\s\S]*waitForDockTomatoSubscriptionBridge\(\)/, 'Tomato bridge may only be read after the loaded-plugin check succeeds');
assert.doesNotMatch(buildBlock, /\/api\/query\/sql|DOCK_TOMATO_FILE|loadReminderBlocks/, 'publisher must not query Tomato SQL or petal fallbacks');
assert.match(buildBlock, /state\.scheduleCache\.lastLoadError[\s\S]*throw new Error/, 'schedule reads must fail closed');
assert.match(buildBlock, /result\.truncated === true[\s\S]*throw new Error/, 'truncated Tomato projections must fail publication');
assert.match(buildBlock, /CALENDAR_SUBSCRIPTION_EVENT_LIMIT/, 'publisher must enforce the total instance limit');
assert.match(buildBlock, /stableIdentity \|\| occurrenceKey/, 'adaptive follow-task reminders must keep a stable ICS UID when their date moves');

const bridgeWaitStart = calendar.indexOf('async function waitForDockTomatoSubscriptionBridge()');
const bridgeWaitEnd = calendar.indexOf('\n    async function buildCalendarSubscriptionEvents', bridgeWaitStart);
const bridgeWaitBlock = calendar.slice(bridgeWaitStart, bridgeWaitEnd);
assert.match(bridgeWaitBlock, /Date\.now\(\) \+ 5000/, 'active Tomato bridge initialization may wait at most five seconds');
assert.match(bridgeWaitBlock, /Number\(bridge\?\.version\) >= 2/, 'publisher must require the v2 bridge');

const executeStart = calendar.indexOf('async function executeCalendarSubscriptionPublication');
const executeEnd = calendar.indexOf('\n    async function publishCalendarSubscriptionNow', executeStart);
const executeBlock = calendar.slice(executeStart, executeEnd);
assert.ok(executeBlock.indexOf('uploadCalendarSubscriptionChain') < executeBlock.indexOf('putCalendarSubscriptionFile(STORAGE.CALENDAR_SUBSCRIPTION_FILE'), 'successful remote verification must happen before replacing the local snapshot');
assert.ok(executeBlock.indexOf('uploadCalendarSubscriptionWebdav') < executeBlock.indexOf('putCalendarSubscriptionFile(STORAGE.CALENDAR_SUBSCRIPTION_FILE'), 'WebDAV upload must finish before replacing the local snapshot');
assert.match(executeBlock, /core\.utf8ByteLength\(icsText\)[\s\S]*CALENDAR_SUBSCRIPTION_FILE_LIMIT/, 'publisher must enforce the 9 MiB file limit');
assert.match(executeBlock, /previous\.contentHash === semanticHash[\s\S]*previous\.targetKey === target\.targetKey/, 'automatic publication must skip only on content and target equality');
assert.match(executeBlock, /options\.force !== true/, 'manual force publication must bypass semantic skip');
assert.match(executeBlock, /!previous\.lastError/, 'a failed upload must be retried even when its semantic content is unchanged');
assert.match(executeBlock, /refreshCalendarSubscriptionSharedSettings\(\)/, 'every publication must refresh synchronized settings before reading data');

assert.match(calendar, /verifyCalendarSubscriptionRemote\([\s\S]*remoteHash !== expectedFileHash/, 'providers must verify the uploaded bytes by remote readback');
assert.match(calendar, /response\.status === 409[\s\S]*'MKCOL'[\s\S]*'PUT'/, 'WebDAV must create the direct parent once and retry PUT after 409');
assert.match(calendar, /CALENDAR_SUBSCRIPTION_WEBDAV_FILE_NAME = 'task-horizon\.ics'/, 'WebDAV directory uploads must use a stable ICS filename');
assert.match(calendar, /if \(!\/\\\.ics\$\/i\.test\(url\.pathname\)\)[\s\S]*CALENDAR_SUBSCRIPTION_WEBDAV_FILE_NAME/, 'WebDAV directory URLs must resolve to the stable ICS file while preserving legacy file URLs');
assert.match(calendar, /WebDAV 目录 URL[\s\S]*placeholder="https:\/\/dav\.example\.com\/calendar\/task-ics\/"/, 'WebDAV settings must ask for a directory URL and show a directory example');
assert.doesNotMatch(calendar, /WebDAV 文件 URL/, 'WebDAV settings must not describe the directory as a complete ICS file URL');
assert.match(calendar, /uploadCloudByAssetsPaths[\s\S]*verifyCalendarSubscriptionRemote/, 'Chain upload must validate the public asset instead of trusting the API envelope');
assert.doesNotMatch(calendar.slice(calendar.indexOf('const calendarSubscriptionPublisher ='), calendar.indexOf('function renderSettings')), /\bS3\b|calendarIcsS3/i, 'v1 publisher must not introduce S3 support');

const reconcileStart = calendar.indexOf('function reconcileCalendarSubscriptionPublisher');
const reconcileEnd = calendar.indexOf('\n    const calendarSubscriptionApi', reconcileStart);
const reconcileBlock = calendar.slice(reconcileStart, reconcileEnd);
assert.match(reconcileBlock, /settings\.icsEnabled === true[\s\S]*settings\.icsPublishMode === 'auto'/, 'automatic listeners may bind on every enabled device in automatic mode');
assert.doesNotMatch(reconcileBlock, /isCalendarSubscriptionCurrentPublisher|PublisherDeviceId/, 'automatic publication must not be gated by device ownership');
assert.match(reconcileBlock, /else unbindCalendarSubscriptionPublisher\(\)/, 'disabling or selecting manual mode must unbind automatic publication lifecycle');
assert.doesNotMatch(executeBlock, /icsPublishMode/, 'manual publication must remain available in manual-only mode');
assert.match(calendar, /startupPending[^]*releaseCalendarSubscriptionStartup\('sync-end', 1000\)/, 'automatic startup publication must wait for the first sync-end');
assert.match(calendar, /releaseCalendarSubscriptionStartup\('startup-fallback', 0\);[^]*?20000/, 'startup publication must retain a delayed offline fallback');
assert.match(calendar, /if \(calendarSubscriptionPublisher\.startupPending[^]*return true;/, 'business events before startup readiness must be coalesced instead of publishing pre-sync data');
assert.match(calendar, /taskAttrUpdatedListener[^]*custom-completion-time[^]*custom-task-repeat-state[^]*markCalendarSubscriptionDirty\('task-attr-updated'\)/, 'task date and repeat-state changes must dirty the ICS projection directly');
assert.match(calendar, /removeEventListener\('tm-task-attr-updated', calendarSubscriptionPublisher\.taskAttrUpdatedListener\)/, 'the task attribute listener must be removed with the publisher lifecycle');
assert.match(calendar, /日程、提醒或相关设置变更后 30 秒更新；启动、同步完成和每日跨日会补偿检查，内容未变化时不重复上传。失败会保留上次成功文件，等待下次触发或手动重试。/, 'settings must explain the automatic publication lifecycle');
assert.match(calendar, /仅在设置页或顶栏点击“立即更新”时生成并上传。/, 'settings must explain manual-only publication');

const topbarSyncStart = index.indexOf('syncCalendarSubscriptionTopBar(meta)');
const topbarSyncEnd = index.indexOf('\n    async openQuickAddTaskWindow', topbarSyncStart);
const topbarSyncBlock = index.slice(topbarSyncStart, topbarSyncEnd);
assert.match(topbarSyncBlock, /current\.enabled !== true[\s\S]*removeCalendarSubscriptionTopBar\(\)/, 'topbar item must be physically removed when ICS upload is disabled');
assert.doesNotMatch(topbarSyncBlock, /isRuntimeMobileClient|isPublisher/, 'manual upload must remain registered on mobile and every enabled device');
assert.match(index, /addTopBar\(\{[\s\S]*CALENDAR_SUBSCRIPTION_TOPBAR_ICON_ID[\s\S]*publishNow\(\{ source: "topbar", force: true, interactive: true \}\)/, 'topbar icon must force a complete publication');
assert.match(index, /removeCalendarSubscriptionTopBar\(\)[\s\S]*topBarIcons\.splice|removeWindowTopBarElement/, 'topbar cleanup must remove plugin references as well as DOM');
assert.doesNotMatch(calendarCss, /\[data-task-horizon-calendar-subscription-topbar="1"\]\s*\{/, 'subscription topbar must inherit the native toolbar item box instead of overriding its alignment');
assert.match(calendar, /tm-calendar-settings-section-title">日历 ICS 上传</, 'settings must use the user-facing feature name');
assert.doesNotMatch(calendar, /立即上传日历 ICS（上次/, 'topbar tooltip must not include the previous event count');

for (const key of [
    'calendarIcsEnabled',
    'calendarIcsProvider',
    'calendarIcsPublishMode',
    'calendarIcsCalendarName',
    'calendarIcsWebdavUrl',
    'calendarIcsWebdavUsername',
    'calendarIcsChainFileName',
    'calendarIcsChainPublicConfirmed',
]) {
    assert.match(settingsStore, new RegExp(`\\b${key}\\b`), `settings store must define ${key}`);
    assert.match(exportRuntime, new RegExp(`['"]${key}['"]`), `settings export must include ${key}`);
}
assert.doesNotMatch(settingsStore, /calendarIcsWebdavPassword/, 'WebDAV password must not enter synchronized settings');
assert.doesNotMatch(exportRuntime, /calendarIcsWebdavPassword/, 'WebDAV password must not be exported');
assert.doesNotMatch(`${calendar}\n${index}\n${settingsStore}\n${exportRuntime}`, /calendarIcsPublisherDeviceId|icsPublisherDeviceId|isCalendarSubscriptionCurrentPublisher/, 'device ownership settings and gates must be removed');
assert.doesNotMatch(calendar, /发布设备|设为本设备/, 'settings must not expose a publisher-device control');
assert.match(calendar, /各设备均可发布过去 30 天至未来 400 天的完整日历快照。/, 'settings must explain that every device can publish');
assert.ok(calendar.indexOf('data-tm-cal-setting="calendarIcsEnabled"') < calendar.indexOf('data-tm-cal-setting="calendarIcsProvider"'), 'ICS enable switch must be the first subscription setting');
assert.match(settingsStore, /calendarIcsProvider:\s*'chain'/, 'new subscriptions must default to Chain publishing');
assert.match(settingsStore, /calendarIcsCalendarName:\s*'任务管理器'/, 'new subscriptions must default to the localized task manager name');
assert.match(settingsStore, /calendarIcsPublishMode:\s*'auto'/, 'new subscriptions must retain automatic publication by default');
assert.match(calendar, /if \(!calendarName \|\| calendarName === 'Task Horizon'\) \{\s*state\.settingsStore\.data\.calendarIcsCalendarName = '任务管理器'/, 'the legacy English default must migrate without replacing other custom names');
assert.match(settingsStore, /globalThis\.__taskHorizonSettingsStore = SettingsStore/, 'publisher startup must not depend on opening the task manager UI');
assert.match(calendar, /if \(globalThis\.__taskHorizonSettingsStore\) setSettingsStore\(globalThis\.__taskHorizonSettingsStore\)/, 'calendar runtime must bind the already-loaded settings store on startup');
assert.doesNotMatch(calendar, /calendar-subscription\.json/, 'publisher runtime must not create a new petal JSON database');

console.log('calendar subscription contract tests passed');
