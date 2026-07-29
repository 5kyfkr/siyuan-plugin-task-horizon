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
const taskDateRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');

assert.match(index, /CALENDAR_SUBSCRIPTION_CORE_SCRIPT_PATH[\s\S]*loadScriptText\(CALENDAR_SUBSCRIPTION_CORE_SCRIPT_PATH[\s\S]*loadScriptText\(CALENDAR_VIEW_SCRIPT_PATH/, 'ICS core must load before calendar-view');

const buildStart = calendar.indexOf('async function buildCalendarSubscriptionEvents(');
const buildEnd = calendar.indexOf('\n    async function readKernelJsonResponse', buildStart);
assert.ok(buildStart >= 0 && buildEnd > buildStart, 'publisher event projection must remain extractable');
const buildBlock = calendar.slice(buildStart, buildEnd);
assert.match(buildBlock, /const tomatoLoaded = isDockTomatoPluginLoaded\(\);[\s\S]*if \(tomatoLoaded\) \{[\s\S]*waitForDockTomatoSubscriptionBridge\(\)/, 'Tomato bridge may only be read after the loaded-plugin check succeeds');
assert.doesNotMatch(buildBlock, /\/api\/query\/sql|DOCK_TOMATO_FILE|loadReminderBlocks/, 'publisher must not query Tomato SQL or petal fallbacks');
assert.match(buildBlock, /state\.scheduleCache\.lastLoadError[\s\S]*throw new Error/, 'schedule reads must fail closed');
assert.match(buildBlock, /result\.truncated === true[\s\S]*throw new Error/, 'truncated Tomato projections must fail publication');
assert.match(buildBlock, /CALENDAR_SUBSCRIPTION_EVENT_LIMIT/, 'publisher must enforce the total instance limit');
assert.match(buildBlock, /stableIdentity \|\| occurrenceKey/, 'adaptive follow-task reminders must keep a stable ICS UID when their date moves');
assert.match(buildBlock, /settings\.icsIncludeTaskDates[\s\S]*tmQueryCalendarTaskDateEvents[\s\S]*allowInactiveFullLoad: true[\s\S]*excludeCompleted: true/, 'task date events must be opt-in and exclude completed tasks');
assert.match(buildBlock, /source: 'task'[\s\S]*allDay: true[\s\S]*startDate[\s\S]*endDate/, 'task date events must be serialized as all-day date ranges');
assert.match(buildBlock, /throwOnError: true/, 'task date read errors must stop publication');
assert.match(buildBlock, /failOnTruncation: true/, 'truncated task reads must stop publication');
assert.match(buildBlock, /requireCompleteCache: true/, 'incremental task reads may only reuse a verified complete cache');
assert.match(buildBlock, /forceFreshTaskDates[\s\S]*startup[\s\S]*sync-end[\s\S]*day-boundary[\s\S]*task-list-updated[\s\S]*task-completed/, 'manual lifecycle and task mutations must force a full task date read');
assert.match(taskDateRuntime, /opts\.excludeCompleted === true && done[\s\S]*continue;/, 'completed tasks must be removed before task date projection');
assert.match(taskDateRuntime, /opts\.failOnTruncation === true && res\?\.limitReached[\s\S]*throw new Error\('任务数量超过读取上限'\)/, 'task cache reads must expose truncation to strict consumers');
assert.match(taskDateRuntime, /complete: !res\?\.limitReached/, 'full task cache reads must record whether the snapshot is complete');
assert.match(taskDateRuntime, /opts\.throwOnError === true[\s\S]*throw e;/, 'strict task date consumers must receive read failures');

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
const verifyRemoteStart = calendar.indexOf('async function verifyCalendarSubscriptionRemote');
const verifyRemoteEnd = calendar.indexOf('\n    async function uploadCalendarSubscriptionWebdav', verifyRemoteStart);
const verifyRemoteBlock = calendar.slice(verifyRemoteStart, verifyRemoteEnd);
assert.match(verifyRemoteBlock, /options\.cacheBust === true[\s\S]*appendCalendarSubscriptionCacheBuster\(url, expectedFileHash\)[\s\S]*: String\(url\)/, 'remote verification must add a cache buster only when explicitly requested');
const webdavUploadStart = calendar.indexOf('async function uploadCalendarSubscriptionWebdav');
const webdavUploadEnd = calendar.indexOf('\n    function normalizeCloudUserData', webdavUploadStart);
const webdavUploadBlock = calendar.slice(webdavUploadStart, webdavUploadEnd);
assert.match(webdavUploadBlock, /const password = String\(target\.password \|\| ''\)/, 'WebDAV uploads must read the synchronized password from the resolved target');
assert.doesNotMatch(webdavUploadBlock, /localStorage/, 'WebDAV uploads must not depend on browser-local password storage');
assert.match(webdavUploadBlock, /buildCalendarSubscriptionWebdavRequestUrl\(target\.url, target\.username, password\)/, 'WebDAV requests must carry credentials only in their internal request URL');
assert.match(webdavUploadBlock, /ensureCalendarSubscriptionWebdavDirectory\(parent\.toString\(\), authorization\)[\s\S]*forwardCalendarSubscriptionRequest\(requestUrl, 'PUT'/, 'WebDAV must validate its direct parent before uploading');
assert.match(webdavUploadBlock, /payloadEncoding: 'base64'[\s\S]*payload: encodeCalendarSubscriptionUtf8Base64\(icsText\)/, 'WebDAV PUT must send explicit UTF-8 bytes through the kernel base64 payload channel');
assert.match(webdavUploadBlock, /verifyCalendarSubscriptionRemote\(requestUrl, fileHash, authorization, \{ cacheBust: false \}\)/, 'WebDAV verification must read the authenticated file URL without query parameters');
assert.doesNotMatch(webdavUploadBlock, /verifyCalendarSubscriptionRemote\(target\.url/, 'WebDAV verification must not discard its request-only credentials');
const chainUploadStart = calendar.indexOf('async function uploadCalendarSubscriptionChain');
const chainUploadEnd = calendar.indexOf('\n    async function resolveCalendarSubscriptionTarget', chainUploadStart);
const chainUploadBlock = calendar.slice(chainUploadStart, chainUploadEnd);
assert.match(chainUploadBlock, /verifyCalendarSubscriptionRemote\(target\.url, fileHash, '', \{ cacheBust: true \}\)/, 'Chain verification must keep cache-busting its CDN URL');
assert.match(calendar, /'PROPFIND'[\s\S]*depth: 0[\s\S]*response\.status === 404[\s\S]*createCalendarSubscriptionWebdavDirectory/, 'WebDAV must check its direct parent and create it once only when it is missing');
assert.match(webdavUploadBlock, /response\.status === 409[\s\S]*createCalendarSubscriptionWebdavDirectory[\s\S]*'PUT'/, 'WebDAV must preserve its MKCOL-and-retry fallback after a PUT conflict');
assert.match(calendar, /status === 401 \|\| status === 403[\s\S]*坚果云第三方应用密码[\s\S]*status === 404[\s\S]*目录或文件路径不存在/, 'WebDAV errors must distinguish authentication and inaccessible paths');
const webdavRequestUrlStart = calendar.indexOf('function buildCalendarSubscriptionWebdavRequestUrl');
const webdavRequestUrlEnd = calendar.indexOf('\n    function getCalendarSubscriptionWebdavResponseDetail', webdavRequestUrlStart);
const webdavRequestUrlBlock = calendar.slice(webdavRequestUrlStart, webdavRequestUrlEnd);
const buildWebdavRequestUrl = Function(`${webdavRequestUrlBlock}; return buildCalendarSubscriptionWebdavRequestUrl;`)();
const authenticatedWebdavUrl = new URL(buildWebdavRequestUrl('https://dav.example.com/calendar/task-horizon.ics', 'user@example.com', 'app password'));
assert.equal(authenticatedWebdavUrl.username, 'user%40example.com', 'WebDAV internal URL must encode its username');
assert.equal(authenticatedWebdavUrl.password, 'app%20password', 'WebDAV internal URL must encode its application password');
const webdavPayloadStart = calendar.indexOf('function encodeCalendarSubscriptionUtf8Base64');
const webdavPayloadEnd = calendar.indexOf('\n    function getCalendarSubscriptionWebdavResponseDetail', webdavPayloadStart);
const webdavPayloadBlock = calendar.slice(webdavPayloadStart, webdavPayloadEnd);
const encodeWebdavPayload = Function(`${webdavPayloadBlock}; return encodeCalendarSubscriptionUtf8Base64;`)();
const webdavPayloadSample = 'BEGIN:VCALENDAR\r\nSUMMARY:任务管理器\r\nEND:VCALENDAR\r\n';
assert.equal(Buffer.from(encodeWebdavPayload(webdavPayloadSample), 'base64').toString('utf8'), webdavPayloadSample, 'WebDAV base64 payload must preserve UTF-8 text and CRLF bytes');
const displayUrlStart = calendar.indexOf('function getCalendarSubscriptionDisplayUrl');
const displayUrlEnd = calendar.indexOf('\n    function formatCalendarSubscriptionStatusTime', displayUrlStart);
const displayUrlBlock = calendar.slice(displayUrlStart, displayUrlEnd);
assert.doesNotMatch(displayUrlBlock, /buildCalendarSubscriptionWebdavRequestUrl/, 'displayed subscription URLs must never use request-only credentials');
assert.match(displayUrlBlock, /url\.username = ''[\s\S]*url\.password = ''/, 'displayed subscription URLs must explicitly remove any URL credentials');
assert.match(calendar, /CALENDAR_SUBSCRIPTION_WEBDAV_FILE_NAME = 'task-horizon\.ics'/, 'WebDAV directory uploads must use a stable ICS filename');
assert.match(calendar, /if \(!\/\\\.ics\$\/i\.test\(url\.pathname\)\)[\s\S]*CALENDAR_SUBSCRIPTION_WEBDAV_FILE_NAME/, 'WebDAV directory URLs must resolve to the stable ICS file while preserving legacy file URLs');
assert.match(calendar, /WebDAV 目录 URL[\s\S]*placeholder="https:\/\/dav\.jianguoyun\.com\/dav\/task-ics\/"/, 'WebDAV settings must show the concrete Jianguoyun directory URL format');
assert.doesNotMatch(calendar, /WebDAV 文件 URL/, 'WebDAV settings must not describe the directory as a complete ICS file URL');
assert.match(calendar, /需要登录思源账号并具有有效订阅。任务标题和时间会通过公开 URL 提供，上传后会回读校验文件。/, 'Chain settings must explain the account and subscription requirement before upload');
assert.match(calendar, /支持坚果云、NAS 等 WebDAV 服务，请填写用于存放固定文件 task-horizon\.ics 的目录地址。/, 'WebDAV settings must explain compatible services and the generated file location');
assert.match(calendar, /此处 WebDAV 地址只用于上传。上传成功后，请在坚果云中为 task-horizon\.ics 获取外部分享链接，并使用该链接在日历应用中订阅。/, 'WebDAV settings must explain how Jianguoyun users obtain the subscription URL');
const jianguoyunUrlStart = calendar.indexOf('function isJianguoyunCalendarSubscriptionUrl');
const jianguoyunUrlEnd = calendar.indexOf('\n    function buildCalendarSubscriptionWebdavRequestUrl', jianguoyunUrlStart);
const jianguoyunUrlBlock = calendar.slice(jianguoyunUrlStart, jianguoyunUrlEnd);
const isJianguoyunUrl = Function(`${jianguoyunUrlBlock}; return isJianguoyunCalendarSubscriptionUrl;`)();
assert.equal(isJianguoyunUrl('https://dav.jianguoyun.com/dav/task-ics/'), true, 'Jianguoyun WebDAV URLs must show the subscription hint');
assert.equal(isJianguoyunUrl('https://jianguoyun.com/dav/task-ics/'), true, 'the Jianguoyun apex domain must show the subscription hint');
assert.equal(isJianguoyunUrl('https://dav.example.com/jianguoyun.com/task-ics/'), false, 'Jianguoyun text outside the hostname must not show the hint');
assert.equal(isJianguoyunUrl('https://jianguoyun.com.example.com/dav/task-ics/'), false, 'lookalike domains must not show the hint');
assert.equal(isJianguoyunUrl('not a url'), false, 'invalid URLs must not show the hint');
assert.match(calendar, /showJianguoyunSubscriptionHint \? `<div class="tm-calendar-settings-row tm-calendar-settings-row--stacked">[\s\S]*坚果云订阅[\s\S]*: ''/, 'the Jianguoyun subscription hint must be conditionally rendered from the URL hostname');
assert.match(calendar, /uploadCloudByAssetsPaths[\s\S]*verifyCalendarSubscriptionRemote/, 'Chain upload must validate the public asset instead of trusting the API envelope');
assert.doesNotMatch(calendar.slice(calendar.indexOf('const calendarSubscriptionPublisher ='), calendar.indexOf('function renderSettings')), /\bS3\b|calendarIcsS3/i, 'v1 publisher must not introduce S3 support');

const subscriberStart = calendar.indexOf('function isCalendarSubscriptionCloudSubscriber(user)');
const subscriberEnd = calendar.indexOf('\n    async function getCalendarSubscriptionCloudUser', subscriberStart);
assert.ok(subscriberStart >= 0 && subscriberEnd > subscriberStart, 'Chain subscription predicate must remain extractable');
const subscriberBlock = calendar.slice(subscriberStart, subscriberEnd);
const isCloudSubscriber = Function(`${subscriberBlock}; return isCalendarSubscriptionCloudSubscriber;`)();
assert.equal(isCloudSubscriber({ userSiYuanSubscriptionStatus: 0, userSiYuanProExpireTime: -1 }), true, 'lifetime subscribers must be accepted');
assert.equal(isCloudSubscriber({ userSiYuanSubscriptionStatus: 0, userSiYuanProExpireTime: Date.now() + 86400000 }), true, 'active term subscribers must be accepted');
assert.equal(isCloudSubscriber({ userSiYuanSubscriptionStatus: -1, userSiYuanProExpireTime: -1 }), false, 'non-subscribers must be rejected');
assert.equal(isCloudSubscriber({ userSiYuanSubscriptionStatus: 2, userSiYuanProExpireTime: Date.now() + 86400000 }), false, 'expired subscription status must be rejected');
assert.equal(isCloudSubscriber({ userSiYuanSubscriptionStatus: -1, userSiYuanProExpireTime: 0, userSiYuanOneTimePayStatus: 1 }), false, 'one-time feature payment must not be treated as a cloud asset subscription');
assert.match(calendar, /if \(!isCalendarSubscriptionCloudSubscriber\(user\)\) throw new Error\('链滴上传需要有效的思源订阅资格'\)/, 'Chain publishing must use the kernel-compatible subscription predicate');

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
assert.match(calendar, /taskProjectionUpdatedListener[^]*task-list-updated[^]*task-completed/, 'task projection changes must force a refresh when task dates are included');
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
    'calendarIcsIncludeTaskDates',
]) {
    assert.match(settingsStore, new RegExp(`\\b${key}\\b`), `settings store must define ${key}`);
    assert.match(exportRuntime, new RegExp(`['"]${key}['"]`), `settings export must include ${key}`);
}
assert.match(settingsStore, /calendarIcsWebdavPassword:\s*''/, 'WebDAV password must be a formal synchronized setting');
assert.match(settingsStore, /typeof cloudData\.calendarIcsWebdavPassword === 'string'/, 'WebDAV password must merge from synchronized settings');
assert.match(settingsStore, /localStorage\.getItem\('tm_calendar_ics_webdav_password'\)[\s\S]*JSON\.parse\(rawWebdavPassword\)/, 'legacy browser-local passwords must migrate from raw or JSON storage');
assert.match(settingsStore, /Storage\.set\('tm_calendar_ics_webdav_password'/, 'WebDAV password must retain a local fallback cache');
assert.match(calendar, /calendarIcsWebdavPassword: 'string'/, 'publisher startup must refresh the synchronized WebDAV password');
assert.match(calendar, /data-tm-cal-setting="calendarIcsWebdavPassword"/, 'WebDAV password input must use the normal synchronized settings path');
assert.doesNotMatch(calendar, /data-tm-cal-local-setting="webdav-password"/, 'WebDAV password input must not use the legacy local-only handler');
assert.match(calendar, /addEventListener\('input'[\s\S]*calendarIcsWebdavPassword[\s\S]*store\.save/, 'WebDAV password typing must update and debounce-save the settings store before a rerender can discard it');
assert.match(executeBlock, /state\.settingsStore\?\.saveDirty[\s\S]*saveNow[\s\S]*refreshCalendarSubscriptionSharedSettings/, 'publication must flush a pending password edit before re-reading synchronized settings');
const exportExcludedStart = exportRuntime.indexOf('const TM_SETTINGS_EXPORT_EXCLUDED_KEYS');
const exportExcludedEnd = exportRuntime.indexOf('\n    function __tmCloneMigrationValue', exportExcludedStart);
assert.match(exportRuntime.slice(exportExcludedStart, exportExcludedEnd), /'calendarIcsWebdavPassword'/, 'manual settings exports must explicitly exclude the synchronized WebDAV password');
const calendarExportKeysStart = exportRuntime.indexOf('const TM_CALENDAR_SETTING_KEYS');
const calendarExportKeysEnd = exportRuntime.indexOf('\n    const TM_SETTINGS_EXPORT_EXCLUDED_KEYS', calendarExportKeysStart);
assert.doesNotMatch(exportRuntime.slice(calendarExportKeysStart, calendarExportKeysEnd), /calendarIcsWebdavPassword/, 'calendar settings export must not include the WebDAV password');
assert.match(calendar, /随插件设置保存并同步到其他设备，不包含在手动导出的设置包中。/, 'WebDAV password help text must describe its synchronized and non-exported behavior');
assert.doesNotMatch(`${calendar}\n${index}\n${settingsStore}\n${exportRuntime}`, /calendarIcsPublisherDeviceId|icsPublisherDeviceId|isCalendarSubscriptionCurrentPublisher/, 'device ownership settings and gates must be removed');
assert.doesNotMatch(calendar, /发布设备|设为本设备/, 'settings must not expose a publisher-device control');
assert.match(calendar, /各设备均可发布过去 30 天至未来 400 天的完整日历快照。/, 'settings must explain that every device can publish');
assert.ok(calendar.indexOf('data-tm-cal-setting="calendarIcsEnabled"') < calendar.indexOf('data-tm-cal-setting="calendarIcsProvider"'), 'ICS enable switch must be the first subscription setting');
assert.match(settingsStore, /calendarIcsProvider:\s*'chain'/, 'new subscriptions must default to Chain publishing');
assert.match(settingsStore, /calendarIcsCalendarName:\s*'任务管理器'/, 'new subscriptions must default to the localized task manager name');
assert.match(settingsStore, /calendarIcsPublishMode:\s*'auto'/, 'new subscriptions must retain automatic publication by default');
assert.match(settingsStore, /calendarIcsIncludeTaskDates:\s*false/, 'task date ICS export must default to disabled');
assert.match(settingsStore, /typeof cloudData\.calendarIcsIncludeTaskDates === 'boolean'/, 'task date ICS export must merge from synchronized settings');
assert.match(settingsStore, /Storage\.get\('tm_calendar_ics_include_task_dates'/, 'task date ICS export must load from local settings storage');
assert.match(settingsStore, /Storage\.set\('tm_calendar_ics_include_task_dates'/, 'task date ICS export must save to local settings storage');
assert.match(calendar, /calendarIcsIncludeTaskDates: 'boolean'/, 'publisher startup must refresh the synchronized task date setting before publication');
assert.match(calendar, /data-tm-cal-setting="calendarIcsIncludeTaskDates"/, 'task date ICS export must have a settings switch');
assert.match(calendar, /同步任务全天日程[\s\S]*开始日期或截止日期的未完成任务作为全天事件同步/, 'task date ICS settings must explain the included tasks concisely');
assert.doesNotMatch(calendar, /同时设置时按日期范围同步/, 'task date ICS settings must not expose unnecessary range implementation detail');
assert.match(calendar, /包含任务管理器日程、任务全天日程与底栏番茄钟提醒/, 'data scope status must name task all-day events when enabled');
assert.match(calendar, /if \(!calendarName \|\| calendarName === 'Task Horizon'\) \{\s*state\.settingsStore\.data\.calendarIcsCalendarName = '任务管理器'/, 'the legacy English default must migrate without replacing other custom names');
assert.match(settingsStore, /globalThis\.__taskHorizonSettingsStore = SettingsStore/, 'publisher startup must not depend on opening the task manager UI');
assert.match(calendar, /if \(globalThis\.__taskHorizonSettingsStore\) setSettingsStore\(globalThis\.__taskHorizonSettingsStore\)/, 'calendar runtime must bind the already-loaded settings store on startup');
assert.doesNotMatch(calendar, /calendar-subscription\.json/, 'publisher runtime must not create a new petal JSON database');

console.log('calendar subscription contract tests passed');
