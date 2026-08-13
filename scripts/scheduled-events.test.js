const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadScheduledCore() {
    const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/65-scheduled-events-runtime.js'), 'utf8');
    const hints = [];
    const context = {
        console,
        Date,
        Math,
        Promise,
        Set,
        Map,
        JSON,
        setTimeout,
        clearTimeout,
        hint: (...args) => hints.push(args),
        window: {
            siyuan: { config: { system: { kernelVersion: '3.7.3' } } },
            addEventListener() {},
            removeEventListener() {},
        },
        document: {
            visibilityState: 'visible',
            addEventListener() {},
            removeEventListener() {},
        },
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(source, context, { filename: '65-scheduled-events-runtime.js' });
    return { ...context.__tmScheduledEventsTest, context, hints };
}

function loadAutomationSafety() {
    const source = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
    const context = {
        console,
        Date,
        Math,
        Promise,
        Set,
        Map,
        JSON,
        AbortController,
        TextDecoder,
        setTimeout,
        clearTimeout,
        window: {},
    };
    context.interactionResponse = { ok: true, status: 200, text: async () => '' };
    context.fetch = async () => context.interactionResponse;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'agent-workbench.js' });
    return { ...context.__tmAIAutomationTest, context };
}

function event(overrides = {}) {
    const base = {
        id: 'evt-1',
        type: 'agent_prompt',
        createdAt: new Date(2026, 6, 1, 0, 0).getTime(),
        name: 'Test',
        enabled: true,
        prompt: 'Summarize',
        condition: 'always',
        schedule: { kind: 'daily', date: '', weekday: 1, time: '19:00' },
        output: { mode: 'notification', documentId: '' },
    };
    return {
        ...base,
        ...overrides,
        schedule: { ...base.schedule, ...(overrides.schedule || {}) },
        output: { ...base.output, ...(overrides.output || {}) },
    };
}

async function run() {
    const core = loadScheduledCore();
    const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
    const scheduledRuntimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/65-scheduled-events-runtime.js'), 'utf8');
    const settingsScreenSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');
    const scheduledSettingsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/66-scheduled-events-settings.js'), 'utf8');
    const exportRuntimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/64-export-runtime.js'), 'utf8');
    const taskStyles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
    assert.match(scheduledRuntimeSource, /taskHorizonLoadAgentSchedules/, 'scheduled-event UI must read the shared kernel store');
    assert.match(scheduledRuntimeSource, /taskHorizonReplaceAgentSchedules/, 'scheduled-event UI must atomically replace the shared kernel snapshot');
    assert.doesNotMatch(scheduledRuntimeSource, /for \(const event of SettingsStore\.data\.scheduledEvents\)[\s\S]*taskHorizonSaveAgentSchedule/, 'scheduled-event persistence must not rewrite the full file once per event');
    assert.match(scheduledRuntimeSource, /taskHorizonClaimAgentScheduleOccurrence/, 'scheduled-event execution must claim an occurrence atomically in the kernel');
    assert.match(scheduledRuntimeSource, /taskHorizonRenewAgentScheduleOccurrence/, 'long-running scheduled events must renew their Kernel lease');
    assert.match(scheduledRuntimeSource, /taskHorizonFinishAgentScheduleOccurrence/, 'scheduled-event execution must finish an occurrence through the kernel');
    assert.match(scheduledRuntimeSource, /TM_SCHEDULED_KERNEL_RPC_TIMEOUT_MS/, 'scheduled Kernel calls must not hang the minute runner indefinitely');
    assert.match(scheduledRuntimeSource, /finally\s*\{\s*__tmScheduledArmTimer\(\);\s*\}/, 'the minute timer must re-arm after both successful and failed checks');
    assert.match(scheduledRuntimeSource, /delivery_commit_pending/, 'successful delivery must be checkpointed separately from its final Kernel commit');
    assert.match(scheduledRuntimeSource, /__tmScheduledFinishWithRetry/, 'completion commits must retry without re-delivering content');
    assert.match(scheduledRuntimeSource, /resolvedConversationId[\s\S]*result\?\.sessionID[\s\S]*resolvedConversationId !== event\.conversationId/, 'a replacement Agent session must update the scheduled-event binding');
    assert.match(scheduledRuntimeSource, /error\?\.sessionID[\s\S]*scheduled conversation binding update failed/, 'a replacement session must remain bound even when the Agent run later fails');
    assert.doesNotMatch(scheduledRuntimeSource, /Math\.random\(\).*420/, 'scheduled-event deduplication must not rely on randomized frontend timing');
    assert.match(exportRuntimeSource, /scheduledEvents\?\.importDefinitions/, 'settings import must persist scheduled definitions through the scheduled-event domain API');

    assert.equal(settingsScreenSource.includes('data-tab="scheduled"'), false, 'scheduled events must not use a standalone settings tab');
    assert.equal(settingsScreenSource.includes("const scheduledEventsPanel = __tmRenderScheduledEventsSettingsPanel();"), true, 'AI settings must render scheduled events');
    assert.equal(settingsScreenSource.includes("if (v === 'scheduled') return 'ai';"), true, 'legacy scheduled links must route to AI settings');
    assert.match(settingsScreenSource, /targetTab !== currentTab \|\| !settingsOpen/, 'scheduled settings links must reopen a closed settings window');
    assert.equal(scheduledSettingsSource.includes("__tmSettingsSearchAttrs('ai', '定时事件'"), true, 'scheduled settings search entry must belong to AI');
    assert.equal(scheduledSettingsSource.includes("state.settingsActiveTab === 'ai'"), true, 'scheduled editor actions must rerender the AI settings page');
    assert.match(scheduledSettingsSource, /__tmPhosphorBoldSvg/, 'scheduled actions must use Phosphor Bold icons');
    assert.match(scheduledSettingsSource, /chat-circle-text/, 'scheduled conversations must use the Phosphor chat icon');
    assert.match(taskStyles, /grid-template-columns: repeat\(5, 30px\)/, 'scheduled rows must reserve all five action slots');
    assert.match(taskStyles, /@container scheduled-events \(max-width: 720px\)/, 'scheduled rows must adapt to the settings panel width');
    assert.match(scheduledSettingsSource, /系统通知未发送/, 'manual runs must surface system notification failures');
    assert.equal(calendarSource.includes('showCompletionNotification: showScheduleCompletionNotification'), true, 'calendar completion notifications must be reusable by scheduled events');
    assert.match(calendarSource, /async function showScheduleSystemNotification/, 'system notification delivery must be awaitable');

    {
        const recovery = loadScheduledCore();
        const localEvent = event({ id: 'evt-local-recovery', enabled: false });
        let kernelEvents = null;
        let replaceCalls = 0;
        let settingsSaves = 0;
        recovery.context.SettingsStore = {
            data: { scheduledEvents: [localEvent], scheduledEventsSchemaVersion: 2 },
            syncToLocal() {},
            async save() { settingsSaves += 1; },
        };
        recovery.context.__tmCallTaskHorizonKernelRpc = async (name, input) => {
            if (name === 'taskHorizonLoadAgentSchedules') {
                if (kernelEvents === null) {
                    const error = new Error('scheduled event file is missing');
                    error.code = 'STORAGE_MISSING';
                    throw error;
                }
                return { available: true, data: kernelEvents };
            }
            if (name === 'taskHorizonReplaceAgentSchedules') {
                replaceCalls += 1;
                kernelEvents = input.events;
                return { available: true, data: kernelEvents };
            }
            throw new Error(`unexpected RPC: ${name}`);
        };
        const api = recovery.context['siyuan-plugin-task-horizon'].scheduledEvents;
        api.init();
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(replaceCalls, 1, 'a missing Kernel file must be restored from the ordinary settings mirror even after schema migration');
        assert.equal(kernelEvents[0].id, localEvent.id);
        assert.equal(settingsSaves, 1, 'recovery must retain the synchronized settings mirror');
        api.dispose();
    }

    {
        const unavailable = loadScheduledCore();
        const localEvent = event({ id: 'evt-local-unavailable', enabled: false });
        let replaceCalls = 0;
        unavailable.context.SettingsStore = {
            data: { scheduledEvents: [localEvent], scheduledEventsSchemaVersion: 2 },
            syncToLocal() {},
            async save() {},
        };
        unavailable.context.__tmCallTaskHorizonKernelRpc = async (name) => {
            if (name === 'taskHorizonLoadAgentSchedules') return { available: false, data: null };
            if (name === 'taskHorizonReplaceAgentSchedules') {
                replaceCalls += 1;
                return { available: true, data: [] };
            }
            throw new Error(`unexpected RPC: ${name}`);
        };
        const api = unavailable.context['siyuan-plugin-task-horizon'].scheduledEvents;
        api.init();
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(replaceCalls, 0, 'a transient Kernel outage must not overwrite a potentially newer schedule file');
        assert.equal(api.list()[0].id, localEvent.id, 'the local recovery mirror must remain visible during a transient outage');
        api.dispose();
    }

    {
        const validEmpty = loadScheduledCore();
        const localEvent = event({ id: 'evt-stale-local', enabled: false });
        let replaceCalls = 0;
        validEmpty.context.SettingsStore = {
            data: { scheduledEvents: [localEvent], scheduledEventsSchemaVersion: 2 },
            syncToLocal() {},
            async save() {},
        };
        validEmpty.context.__tmCallTaskHorizonKernelRpc = async (name) => {
            if (name === 'taskHorizonLoadAgentSchedules') return { available: true, data: [] };
            if (name === 'taskHorizonReplaceAgentSchedules') {
                replaceCalls += 1;
                return { available: true, data: [] };
            }
            throw new Error(`unexpected RPC: ${name}`);
        };
        const api = validEmpty.context['siyuan-plugin-task-horizon'].scheduledEvents;
        api.init();
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(replaceCalls, 0, 'an existing empty Kernel list must not resurrect stale local events');
        assert.equal(api.list().length, 0);
        api.dispose();
    }

    {
        const transient = loadScheduledCore();
        const now = new Date();
        const timers = new Map();
        let timerID = 0;
        transient.context.console = { ...console, warn() {} };
        transient.context.setTimeout = (handler, delay) => {
            const id = ++timerID;
            timers.set(id, { handler, delay });
            return id;
        };
        transient.context.clearTimeout = (id) => timers.delete(id);
        const due = event({
            createdAt: now.getTime() - 86400000,
            schedule: { time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` },
        });
        transient.context.SettingsStore = { data: { scheduledEvents: [due] }, syncToLocal() {} };
        transient.context.__tmCallTaskHorizonKernelRpc = async (name) => {
            if (name === 'taskHorizonLoadAgentSchedules') return { available: true, data: [due] };
            if (name === 'taskHorizonClaimAgentScheduleOccurrence') return { available: false, data: null };
            throw new Error(`unexpected RPC: ${name}`);
        };
        const api = transient.context['siyuan-plugin-task-horizon'].scheduledEvents;
        await api.refresh();
        assert.equal(timers.size, 1, 'a transient claim failure must still leave one minute timer armed');
        api.dispose();
        assert.equal(timers.size, 0);
    }

    {
        const completion = loadScheduledCore();
        let stored = event({ id: 'evt-finish-retry', conversationId: 'session-1' });
        let notifications = 0;
        let finishCalls = 0;
        completion.context.SettingsStore = { data: { scheduledEvents: [stored], aiExperienceMode: 'agent' }, syncToLocal() {} };
        completion.context.__tmAI = {
            async ensureAutomationConversation() { return 'session-1'; },
            async runAutomation() { return { title: 'Result', markdown: 'Done', sessionID: 'session-2' }; },
        };
        completion.context.__tmCalendar = { async showCompletionNotification() { notifications += 1; return { ok: true }; } };
        completion.context.__tmCallTaskHorizonKernelRpc = async (name, input) => {
            if (name === 'taskHorizonReplaceAgentSchedules') {
                stored = input.events.find((item) => item.id === stored.id) || stored;
                return { available: true, data: input.events };
            }
            if (name === 'taskHorizonClaimAgentScheduleOccurrence') {
                stored.lastRun = { occurrenceKey: input.occurrenceKey, status: 'running' };
                return { available: true, data: { claimed: true, ownerID: 'manual-owner', event: stored } };
            }
            if (name === 'taskHorizonFinishAgentScheduleOccurrence') {
                finishCalls += 1;
                if (finishCalls === 1) throw new Error('transient finish failure');
                stored.lastRun = { ...stored.lastRun, ...input.patch, status: input.status };
                return { available: true, data: stored };
            }
            throw new Error(`unexpected RPC: ${name}`);
        };
        const api = completion.context['siyuan-plugin-task-horizon'].scheduledEvents;
        const result = await api.runNow(stored.id);
        assert.equal(result.status, 'succeeded');
        assert.equal(notifications, 1, 'a completion retry must not deliver the result twice');
        assert.equal(finishCalls, 2, 'the completion state should retry after a transient failure');
        assert.equal(api.list().find((item) => item.id === stored.id)?.conversationId, 'session-2', 'the resolved Agent session must replace a stale scheduled-event binding');
        api.dispose();
    }

    {
        const saved = [];
        const existing = event({
            conversationId: '20260715100000-abc1234',
            lastOccurrence: { occurrenceKey: 'evt-1:old', status: 'succeeded', attempts: 1 },
            lastRun: { occurrenceKey: 'evt-1:old', status: 'succeeded', markdown: '保留结果' },
        });
        core.context.SettingsStore = {
            data: { scheduledEvents: [existing] },
            syncToLocal() {},
        };
        core.context.__tmCallTaskHorizonKernelRpc = async (name, value) => {
            if (name === 'taskHorizonReplaceAgentSchedules') {
                saved.push(JSON.parse(JSON.stringify(value.events)));
                return { available: true, data: value.events };
            }
            return { available: true, data: value };
        };
        const api = core.context['siyuan-plugin-task-horizon'].scheduledEvents;
        const imported = await api.importDefinitions([
            event({ name: 'Imported definition', conversationId: '', lastOccurrence: {}, lastRun: {} }),
            event({ id: 'evt-2', name: 'New definition' }),
        ]);
        assert.equal(imported.length, 2);
        assert.equal(imported[0].name, 'Imported definition');
        assert.equal(imported[0].conversationId, '20260715100000-abc1234', 'import must preserve the existing conversation binding');
        assert.equal(imported[0].lastRun.markdown, '保留结果', 'import must preserve execution state');
        assert.equal(saved.length, 1, 'import must persist the merged definitions in one atomic Kernel write');
        assert.equal(saved[0].length, 2);
        api.dispose();
    }

    {
        const legacy = core.normalizeEvent(event({
            output: { mode: 'document', documentId: '20260716080000-doc0001' },
        }));
        assert.equal(legacy.output.documentMode, 'target', 'legacy document outputs must keep writing to the selected document');
        assert.equal(legacy.output.insertPosition, 'bottom', 'legacy document outputs must keep appending at the bottom');

        const notifications = [];
        core.context.__tmCalendar = {
            showCompletionNotification: async (...args) => {
                notifications.push(args);
                await new Promise((resolve) => setTimeout(resolve, 5));
                return { ok: true, id: 42 };
            },
        };
        const delivered = await core.deliver(event({ conversationId: '20260715100000-abc1234' }), {
            title: '上周总结',
            markdown: '本周完成 12 项任务。',
        }, new Date(2026, 6, 16, 9, 0));
        assert.equal(delivered.blockId, '');
        assert.equal(notifications.length, 1, 'successful Agent output must trigger one system notification');
        assert.equal(notifications[0][0], '定时事件完成：Test');
        assert.match(notifications[0][1], /上周总结/);
        assert.match(notifications[0][1], /已追加到任务智能体对话/);
        assert.equal(notifications[0][2].channel, 'task-horizon-scheduled-events');
        assert.equal(delivered.notificationDelivered, true, 'delivery must wait for a successful system notification');
        assert.equal(delivered.notificationError, '');
        assert.equal(core.hints.length, 1, 'in-app notification fallback must remain available');

        const documentWrites = [];
        core.context.__tmBackendAdapter = {
            appendBlock: async (...args) => {
                documentWrites.push(['append', ...args]);
                return '20260716090000-block01';
            },
            insertBlock: async (...args) => {
                documentWrites.push(['insert', ...args]);
                return '20260716090001-block02';
            },
        };
        core.context.API = { getFirstDirectChildIdOfDoc: async () => '' };
        const documentDelivery = await core.deliver(event({
            output: { mode: 'document', documentId: '20260716080000-doc0001' },
        }), { title: '日报', markdown: '今日任务总结。' }, new Date(2026, 6, 16, 9, 0));
        assert.equal(documentDelivery.blockId, '20260716090000-block01');
        assert.equal(documentWrites[0][0], 'append');
        assert.equal(documentWrites[0][1], '20260716080000-doc0001');
        assert.equal(notifications.length, 2, 'document delivery must also trigger a system notification');

        core.context.API.getFirstDirectChildIdOfDoc = async () => '20260716070000-first01';
        const topDelivery = await core.deliver(event({
            output: { mode: 'document', documentId: '20260716080000-doc0001', insertPosition: 'top' },
        }), { title: '日报', markdown: '最新总结。' }, new Date(2026, 6, 16, 10, 0));
        assert.equal(topDelivery.blockId, '20260716090001-block02');
        assert.deepEqual(documentWrites[1].slice(0, 3), ['insert', '20260716080000-doc0001', '## 2026-07-16 日报\n\n最新总结。']);
        assert.equal(documentWrites[1][3].nextID, '20260716070000-first01');

        const monthlyCalls = [];
        core.context.__tmCallTaskHorizonKernelRpc = async (name, input) => {
            monthlyCalls.push([name, input]);
            return { available: true, data: { documentID: '20260101000000-month01' } };
        };
        core.context.API.getFirstDirectChildIdOfDoc = async () => '';
        const monthlyDelivery = await core.deliver(event({
            output: {
                mode: 'document',
                documentId: '20260716080000-doc0001',
                documentMode: 'monthly_child',
                insertPosition: 'top',
            },
        }), { title: '月末日报 · 2026-01-31', markdown: '按计划日期归档。' }, new Date(2026, 0, 31, 23, 59));
        assert.equal(monthlyDelivery.blockId, '20260716090000-block01', 'an empty monthly document may append for top placement');
        assert.equal(monthlyCalls[0][0], 'taskHorizonResolveAgentScheduleOutputDocument');
        assert.deepEqual(JSON.parse(JSON.stringify(monthlyCalls[0][1])), {
            parentDocumentID: '20260716080000-doc0001',
            month: '2026-01',
        }, 'catch-up delivery must resolve the month from the scheduled occurrence');
        assert.equal(documentWrites.at(-1)[1], '20260101000000-month01');
        assert.equal(documentWrites.at(-1)[2], '## 月末日报 · 2026-01-31\n\n按计划日期归档。', 'the occurrence date must not be duplicated when the Agent title already contains it');

        core.context.__tmCalendar.showCompletionNotification = async () => ({ ok: false, error: '通知权限未开启' });
        const failedNotification = await core.deliver(event(), { title: '日报', markdown: '今日任务总结。' }, new Date(2026, 6, 16, 9, 0));
        assert.equal(failedNotification.notificationDelivered, false, 'notification failure must be reported without failing the Agent result');
        assert.equal(failedNotification.notificationError, '通知权限未开启');
        assert.match(core.hints.at(-1)[0], /系统通知未发送：通知权限未开启/);
    }

    {
        const now = new Date(2026, 6, 15, 19, 10);
        const result = core.resolveTiming(event(), now);
        assert.equal(result.due, true, 'daily occurrence should be due after its local time');
        assert.equal(result.occurrenceKey, 'evt-1:2026-07-15T19:00');
        assert.equal(core.localDateTimeKey(result.nextAt), '2026-07-16T19:00');
    }

    {
        const createdAt = new Date(2026, 6, 15, 18, 30).getTime();
        const now = new Date(2026, 6, 15, 18, 40);
        const result = core.resolveTiming(event({ createdAt }), now);
        assert.equal(result.due, false, 'new daily event must not catch up an occurrence before it was created');
        assert.equal(core.localDateTimeKey(result.nextAt), '2026-07-15T19:00');
    }

    {
        const now = new Date(2026, 6, 15, 0, 5);
        const result = core.resolveTiming(event({ schedule: { time: '23:59' } }), now);
        assert.equal(result.due, true, 'daily event should catch up across midnight');
        assert.equal(result.occurrenceKey, 'evt-1:2026-07-14T23:59');
    }

    {
        const within = core.resolveTiming(event({ schedule: { kind: 'once', date: '2026-07-14', time: '20:00' } }), new Date(2026, 6, 15, 19, 59));
        const expired = core.resolveTiming(event({ schedule: { kind: 'once', date: '2026-07-14', time: '19:00' } }), new Date(2026, 6, 15, 19, 1));
        assert.equal(within.due, true, 'one-time event should catch up within 24 hours');
        assert.equal(expired.due, false, 'one-time event must not catch up after 24 hours');
        assert.equal(expired.expired, true);
    }

    {
        const monday = new Date(2026, 6, 13, 9, 1);
        const saturday = new Date(2026, 6, 18, 9, 1);
        assert.equal(core.resolveTiming(event({ schedule: { kind: 'weekdays', time: '09:00' } }), monday).due, true);
        assert.equal(core.resolveTiming(event({ schedule: { kind: 'weekdays', time: '09:00' } }), saturday).due, false);
    }

    {
        const wednesday = new Date(2026, 6, 15, 8, 1);
        const weekly = event({ schedule: { kind: 'weekly', weekday: 3, time: '08:00' } });
        assert.equal(core.resolveTiming(weekly, wednesday).due, true);
        assert.equal(core.resolveTiming({
            ...weekly,
            lastOccurrence: { occurrenceKey: 'evt-1:2026-07-15T08:00', status: 'succeeded' },
        }, wednesday).due, false, 'terminal occurrence ledger must deduplicate repeated checks');
    }

    {
        const now = new Date(2026, 6, 15, 19, 2);
        const key = 'evt-1:2026-07-15T19:00';
        const running = event({ lastOccurrence: { occurrenceKey: key, status: 'running', leaseUntil: now.getTime() + 60000, attempts: 1 } });
        const stale = event({ lastOccurrence: { occurrenceKey: key, status: 'running', leaseUntil: now.getTime() - 1, attempts: 1 } });
        const retryLater = event({ lastOccurrence: { occurrenceKey: key, status: 'failed', nextAttemptAt: now.getTime() + 60000, attempts: 1 } });
        const exhausted = event({ lastOccurrence: { occurrenceKey: key, status: 'failed', nextAttemptAt: 0, attempts: 3 } });
        assert.equal(core.resolveTiming(running, now).due, false, 'active lease must prevent a second runner');
        assert.equal(core.resolveTiming(stale, now).due, true, 'expired lease should be recoverable');
        assert.equal(core.resolveTiming(retryLater, now).due, false, 'retry delay must be honored');
        assert.equal(core.resolveTiming(exhausted, now).due, false, 'three attempts must be terminal');
    }

    {
        const definitions = core.normalizeEvents([event({ conversationId: '20260715100000-abc1234', lastRun: { markdown: 'secret result' }, lastOccurrence: { occurrenceKey: 'x', status: 'succeeded' } })], { stripRuntime: true });
        assert.equal(Object.prototype.hasOwnProperty.call(definitions[0], 'conversationId'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(definitions[0], 'lastRun'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(definitions[0], 'lastOccurrence'), false);
    }

    {
        const normalized = core.normalizeEvent(event({ conversationId: '20260715100000-abc1234' }));
        assert.equal(normalized.conversationId, '20260715100000-abc1234', 'scheduled events must retain their Agent conversation ID');
    }

    {
        const localOnly = event({ id: 'deleted-remotely', updatedAt: 200 });
        const shared = event({ id: 'shared', updatedAt: 300, name: 'Local newer' });
        const remoteOnly = event({ id: 'remote-only', updatedAt: 100 });
        const merged = core.mergeEventSnapshots([localOnly, shared], [
            event({ id: 'shared', updatedAt: 100, name: 'Remote older' }),
            remoteOnly,
        ]);
        assert.deepEqual(merged.map((item) => item.id).sort(), ['remote-only', 'shared'], 'an event absent from the authoritative kernel snapshot must stay deleted');
        assert.equal(merged.find((item) => item.id === 'shared').name, 'Local newer', 'newer in-flight runtime state must survive a stale remote copy');
        assert.deepEqual(core.mergeEventSnapshots([localOnly], []), [], 'an authoritative empty kernel snapshot must clear stale local events');
        assert.equal(core.mergeEventSnapshots([localOnly], null)[0].id, 'deleted-remotely', 'a failed remote read must not clear local events');
    }

    {
        const migrated = core.normalizeEvent(event({
            name: '定时8点40生成上周任务总结',
            prompt: '定时8点40生成上周任务总结',
            schedule: { kind: 'once', date: '2026-07-15', time: '08:40' },
        }));
        const manual = core.normalizeEvent(event({
            name: '会议复盘',
            prompt: '分析10点会议记录',
            schedule: { kind: 'once', date: '2026-07-15', time: '08:40' },
        }));
        assert.equal(migrated.prompt, '生成上周任务总结', 'legacy natural-language prompts must drop scheduling metadata');
        assert.equal(manual.prompt, '分析10点会议记录', 'manually authored action times must be preserved');
    }

    {
        const completed = core.filterCompletedTasks([
            { id: 'a', done: true, taskCompleteAt: '20260715000100', updatedAt: '20260716000100', due: '2026-07-16' },
            { id: 'b', done: true, taskCompleteAt: '20260714235959', updatedAt: '20260715000100' },
            { id: 'c', done: false, taskCompleteAt: '20260715120000' },
            { id: 'd', done: true, updatedAt: '20260715120000', due: '2026-07-15' },
        ], new Date(2026, 6, 15, 19, 0));
        assert.deepEqual(completed.map((item) => item.id), ['a'], 'today filtering must use taskCompleteAt local date only');
    }

    {
        const calls = [];
        core.context.SettingsStore = { data: { selectedDocIds: ['20260715000000-legacy'] } };
        core.context.__tmSummaryBuildGroupScope = async () => ({ allDocIds: ['20260715000001-group'] });
        core.context.__tmSummaryLoadTasksByDocs = async (docIds, options) => {
            calls.push({ docIds: Array.from(docIds), options: { ...options } });
            return [{ id: 'today', done: true, content: '今日完成', taskCompleteAt: '20260715120000' }];
        };
        const loaded = await core.loadTodayCompletedTasks(new Date(2026, 6, 15, 19, 0));
        assert.deepEqual(Array.from(loaded, (item) => item.id), ['today']);
        assert.deepEqual(calls[0].docIds, ['20260715000000-legacy', '20260715000001-group'], 'scheduled summaries must resolve modern document-group scope as well as legacy selected documents');
        assert.deepEqual(calls[0].options, { ignoreExcludeCompleted: true, forceFresh: true, throwOnError: true }, 'scheduled completion checks must bypass stale task caches and surface load failures');
        core.context.__tmSummaryLoadTasksByDocs = async () => { throw new Error('query failed'); };
        await assert.rejects(
            () => core.loadTodayCompletedTasks(new Date(2026, 6, 15, 19, 0)),
            /query failed/,
            'task query failures must not be reported as an empty completed-task list',
        );
    }

    const safety = loadAutomationSafety();
    const agentSource = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
    assert.equal(agentSource.includes('const persistent = request.persistSession === true;'), true, 'automation must support persistent conversations');
    assert.equal(agentSource.includes('if (!persistent) scheduleAutomationSessionCleanup(sessionID);'), true, 'persistent conversations must not be deleted');
    assert.equal(agentSource.includes('openConversation: async (sessionID)'), true, 'scheduled conversations must be openable from settings');
    assert.equal(agentSource.includes('session.entries = baseEntries;'), true, 'each automation run must append visible conversation entries');
    assert.match(agentSource, /async function ensureAutomationTaskToolsReady\(\)[\s\S]*ensureTaskToolsReadyForSend\(\)[\s\S]*syncBuiltinSkills\(\)[\s\S]*async function runAutomation[\s\S]*await ensureAutomationTaskToolsReady\(\)/, 'scheduled automation must restore task capabilities and current built-in skills before starting a model round');
    assert.equal(scheduledSettingsSource.includes('tmScheduledOpenConversation'), true, 'scheduled settings must expose the conversation entry');
    assert.equal(safety.isAllowedTool('plugin__siyuan_plugin_task_horizon__query_tasks'), true);
    assert.equal(safety.isAllowedTool('plugin__siyuan_plugin_task_horizon__query_tasks__0123456789ab'), true);
    assert.equal(safety.normalizeToolName('plugin__siyuan-plugin-task-horizon__query_tasks'), 'query_tasks');
    assert.equal(safety.normalizeToolName('plugin__siyuan_plugin_task_horizon__query_tasks__0123456789ab'), 'query_tasks');
    assert.equal(safety.automaticConfirmKind({ confirmID: 'foreign', name: 'plugin__another_plugin__create_task', arguments: { action: 'create' } }), '', 'another plugin must never inherit Task Horizon quick-write approval');
    assert.equal(safety.isAllowedTool('plugin__another_plugin__query_tasks'), false, 'scheduled automation must reject another plugin that reuses a Task Horizon local tool name');
    assert.equal(safety.automaticConfirmKind({ confirmID: 'read', name: 'plugin__siyuan-plugin-task-horizon__query_tasks', arguments: { action: 'query' } }), 'read');
    assert.equal(safety.automaticConfirmKind({ confirmID: 'reminder', name: 'plugin__siyuan-plugin-task-horizon__configure_task_reminder', arguments: { action: 'apply' } }), 'reminder');
    assert.equal(safety.automaticConfirmKind({ confirmID: 'update', name: 'plugin__siyuan-plugin-task-horizon__update_task', arguments: { action: 'update' } }), '', 'ordinary writes must still require confirmation');
    assert.equal(safety.isAllowedTool('aggregate_task_stats'), true);
    assert.equal(safety.isAllowedTool('todo_write', { todos: [{ content: '汇总任务', status: 'in_progress' }] }), true, 'session-only todo tracking is safe');
    assert.equal(safety.isAllowedTool('file_write', { path: 'result.md' }), false, 'workspace writes must remain blocked');
    assert.equal(safety.isAllowedTool('sql', { action: 'query', stmt: 'SELECT * FROM blocks LIMIT 1' }), true, 'SiYuan read-only SQL queries must be available to scheduled summaries');
    assert.equal(safety.isAllowedTool('sql', { action: 'select', stmt: 'SELECT * FROM blocks' }), false, 'only the declared SQL query action may run unattended');
    assert.equal(safety.isAllowedTool('sql', { stmt: 'SELECT * FROM blocks' }), false, 'SQL calls without the declared read-only action must remain blocked');
    assert.equal(safety.isAllowedTool('skill', { action: 'list' }), true, 'listing skills is read-only in SiYuan 3.8');
    assert.equal(safety.isAllowedTool('skill', { action: 'load', name: 'task-review' }), true);
    assert.equal(safety.isAllowedTool('skill', { action: 'save', name: 'task-review' }), false);
    assert.equal(safety.isAllowedTool('skill', { action: 'install', name: 'task-review' }), false);
    assert.equal(safety.isAllowedTool('skill', { action: 'remove', name: 'task-review' }), false);
    assert.equal(safety.isAllowedTool('skill', { action: 'rename', name: 'task-review' }), false);
    assert.equal(safety.isAllowedTool('skill', { action: 'load', name: 'unknown-skill' }), false);
    assert.equal(safety.isAllowedConfirm({ confirmID: 'read-skill', name: 'skill', arguments: { action: 'load', name: 'task-review' } }), true);
    assert.equal(safety.isAllowedConfirm({ confirmID: 'write-skill', name: 'skill', arguments: { action: 'save', name: 'task-review' } }), false);
    assert.equal(safety.isAllowedConfirm({ confirmID: 'read-tool', name: 'plugin__siyuan_plugin_task_horizon__aggregate_task_stats', arguments: { action: 'query' } }), true);
    assert.equal(safety.isAllowedConfirm({ name: 'skill', arguments: { action: 'load', name: 'task-review' } }), false, 'confirmID is required for automatic approval');
    assert.equal(safety.isAllowedTool('plugin__siyuan_plugin_task_horizon__update_task'), false);
    assert.equal(safety.isAllowedTool('delete_block'), false);
    assert.equal(safety.isAllowedTool('unknown_tool'), false);
    assert.equal(safety.isBlockedEventType('confirm'), true);
    assert.equal(safety.isBlockedEventType('question'), true);
    assert.equal(safety.isBlockedEventType('frontend_tool_call'), true);
    assert.equal(safety.isBlockedEventType('browser_capability_call'), true, 'SiYuan 3.8 browser capabilities must remain blocked during unattended runs');
    assert.equal(safety.isBlockedEventType('content'), false);
    assert.equal(safety.isScheduledEventCreateIntent('每天下午7点定时总结今日完成任务'), true);
    assert.equal(safety.isScheduledEventCreateIntent('定时事件功能怎么用'), false);
    assert.equal(safety.isScheduledEventListIntent('查看已有的定时事件'), true);
    assert.equal(safety.isScheduledEventHelpIntent('现在你有哪些定时功能'), true);
    assert.equal(safety.isScheduledEventHelpIntent('定时功能支持什么'), true);
    assert.equal(safety.isScheduledEventCreateIntent('现在你有哪些定时功能'), false);
    assert.equal(safety.isReminderModeChoiceIntent('设置今天9点15的提醒'), true, 'ambiguous reminder writes must ask which reminder system to use');
    assert.equal(safety.isReminderModeChoiceIntent('每天下午7点定时总结今日完成任务'), true, 'scheduled Agent writes must also pass through the reminder choice');
    assert.equal(safety.isReminderModeChoiceIntent('给当前任务添加提醒'), true, 'task reminder writes without a time must still choose follow or independent mode');
    assert.equal(safety.isReminderModeChoiceIntent('查看已有的定时事件'), false, 'read-only scheduled-event requests must not open the choice');
    assert.equal(safety.isReminderModeChoiceIntent('提醒功能怎么用'), false, 'help requests must not open the choice');
    {
        const automation = loadAutomationSafety();
        const requests = [];
        let storedSession = null;
        automation.context.fetch = async (url, options = {}) => {
            const route = String(url).replace('/api/ai/agent', '');
            const body = options.body ? JSON.parse(options.body) : {};
            requests.push({ route, body });
            const jsonResponse = (payload) => ({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => payload,
            });
            if (route === '/getSession') {
                return jsonResponse(storedSession ? { code: 0, data: storedSession } : { code: -1, msg: 'not found' });
            }
            if (route === '/saveSession') {
                storedSession = { ...body, revision: Number(storedSession?.revision || 0) + 1 };
                delete storedSession.expectedRevision;
                return jsonResponse({ code: 0, data: { revision: storedSession.revision } });
            }
            if (route === '/chat') {
                const encoded = new TextEncoder().encode('event: turn\ndata: {"turnID":"turn-new"}\n\nevent: content\ndata: {"token":"Done"}\n\nevent: done\ndata: {"turnID":"turn-new"}\n\n');
                let reads = 0;
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'text/event-stream' },
                    body: { getReader: () => ({ read: async () => reads++ === 0 ? { done: false, value: encoded } : { done: true } }) },
                };
            }
            if (route === '/lsSessions') return jsonResponse({ code: 0, data: { sessions: [], total: 0 } });
            throw new Error(`unexpected request: ${route}`);
        };
        const result = await automation.runAutomation({ prompt: 'Summarize', sessionID: '20260722120000-abcdefg', sessionTitle: '定时：Test', persistSession: true });
        assert.equal(result.markdown, 'Done');
        assert.notEqual(result.sessionID, '20260722120000-abcdefg', 'a genuinely missing historical session must receive a fresh ID');
        assert.deepEqual(requests.slice(0, 3).map((item) => item.route), ['/getSession', '/saveSession', '/chat'], 'a new automation conversation must be saved before chat starts');
        const preSave = requests.find((item) => item.route === '/saveSession').body;
        const chat = requests.find((item) => item.route === '/chat').body;
        assert.equal(preSave.entries.length, 1);
        assert.equal(preSave.entries[0].content, chat.message, 'the persisted user anchor must exactly match the model request');
        assert.match(preSave.entries[0].content, /无人值守的定时执行[\s\S]*只能读取、筛选和聚合数据/);
        assert.equal(preSave.entries[0].blockHTML, '<div>Summarize</div>', 'the conversation UI must still show only the scheduled-event prompt');
        assert.equal(chat.userEntryID, preSave.entries[0].id);
        assert.equal(chat.sessionID, result.sessionID);
        assert.equal(chat.contentRevision, 1);
        assert.match(chat.message, /无人值守的定时执行[\s\S]*只能读取、筛选和聚合数据/, 'scheduled requests must tell the model about the read-only safety boundary');
        assert.deepEqual(chat.frontendCapabilities, [], 'scheduled requests must not expose SiYuan 3.8 browser capabilities');
        const finalSave = requests.filter((item) => item.route === '/saveSession').at(-1);
        assert.equal(finalSave.body.commitTurnID, 'turn-new', 'scheduled conversations must explicitly commit the SiYuan 3.8 runtime turn');
        assert.equal(finalSave.body.expectedRevision, 1, 'the runtime commit must use the authoritative session revision');
        assert.equal(storedSession.entries.filter((entry) => entry.type === 'user' && entry.blockHTML === '<div>Summarize</div>').length, 1, 'finalization must not duplicate the pre-saved user prompt');
    }
    {
        const automation = loadAutomationSafety();
        let saveCalls = 0;
        automation.context.fetch = async (url) => {
            const route = String(url).replace('/api/ai/agent', '');
            const payload = route === '/getSession'
                ? { code: -1, msg: 'service unavailable' }
                : { code: 0, data: null };
            if (route === '/saveSession') saveCalls += 1;
            return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => payload };
        };
        await assert.rejects(
            () => automation.runAutomation({ prompt: 'Summarize', sessionID: '20260716115238-n9v9of6', persistSession: true }),
            /智能体会话初始化失败：service unavailable/
        );
        assert.equal(saveCalls, 0, 'a failed session read must never fall through to a revision-0 save');
    }
    {
        const automation = loadAutomationSafety();
        const requests = [];
        let saveCalls = 0;
        let storedSession = {
            id: '20260716115238-n9v9of6',
            title: '定时：今晚任务总结',
            titled: true,
            revision: 52,
            entries: [{ id: 'existing-entry', type: 'assistant', content: 'Earlier result', timestamp: 1 }],
            createdAt: 1,
            updatedAt: 1,
        };
        const jsonResponse = (payload) => ({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => payload,
        });
        automation.context.fetch = async (url, options = {}) => {
            const route = String(url).replace('/api/ai/agent', '');
            const body = options.body ? JSON.parse(options.body) : {};
            requests.push({ route, body });
            if (route === '/getSession') return jsonResponse({ code: 0, data: storedSession });
            if (route === '/saveSession') {
                saveCalls += 1;
                if (saveCalls === 1) {
                    storedSession = {
                        ...storedSession,
                        revision: 53,
                        entries: storedSession.entries.concat({ id: 'concurrent-entry', type: 'assistant', content: 'Concurrent update', timestamp: 2 }),
                    };
                    return jsonResponse({ code: -1, msg: 'agent session revision conflict' });
                }
                storedSession = { ...body, revision: Number(storedSession.revision) + 1 };
                delete storedSession.expectedRevision;
                return jsonResponse({ code: 0, data: { revision: storedSession.revision } });
            }
            if (route === '/chat') {
                const encoded = new TextEncoder().encode('event: content\ndata: {"token":"Done"}\n\nevent: done\ndata: {}\n\n');
                let reads = 0;
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'text/event-stream' },
                    body: { getReader: () => ({ read: async () => reads++ === 0 ? { done: false, value: encoded } : { done: true } }) },
                };
            }
            if (route === '/lsSessions') return jsonResponse({ code: 0, data: { sessions: [], total: 0 } });
            throw new Error(`unexpected request: ${route}`);
        };
        const result = await automation.runAutomation({
            prompt: 'Summarize without duplication',
            sessionID: storedSession.id,
            sessionTitle: storedSession.title,
            persistSession: true,
        });
        assert.equal(result.markdown, 'Done');
        assert.deepEqual(requests.slice(0, 5).map((item) => item.route), ['/getSession', '/saveSession', '/getSession', '/saveSession', '/chat']);
        const retriedSave = requests.filter((item) => item.route === '/saveSession')[1].body;
        assert.equal(retriedSave.expectedRevision, 53, 'the retry must use the latest authoritative revision');
        assert.equal(retriedSave.entries.some((entry) => entry.id === 'concurrent-entry'), true, 'the retry must preserve concurrent entries');
        assert.equal(retriedSave.entries.filter((entry) => entry.type === 'user' && entry.blockHTML === '<div>Summarize without duplication</div>').length, 1);
        assert.equal(requests.find((item) => item.route === '/chat').body.contentRevision, 54);
        assert.equal(storedSession.entries.filter((entry) => entry.type === 'user' && entry.blockHTML === '<div>Summarize without duplication</div>').length, 1, 'finalization must not duplicate the retried prompt');
    }
    {
        const automation = loadAutomationSafety();
        const requests = [];
        let storedSession = {
            id: '20260809101624-o9z3n7c',
            title: '定时：今晚任务总结',
            titled: true,
            revision: 20,
            recoveryTurnID: 'turn-old',
            recoveryState: 'finished',
            entries: [{ id: 'old-user', type: 'user', content: 'Earlier prompt', timestamp: 1 }],
            createdAt: 1,
            updatedAt: 1,
        };
        let currentTurnID = '';
        const jsonResponse = (payload) => ({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => payload,
        });
        automation.context.fetch = async (url, options = {}) => {
            const route = String(url).replace('/api/ai/agent', '');
            const body = options.body ? JSON.parse(options.body) : {};
            requests.push({ route, body, headers: options.headers || {} });
            if (route === '/getSession') {
                const session = currentTurnID
                    ? { ...storedSession, recoveryTurnID: currentTurnID, recoveryState: 'finished' }
                    : storedSession;
                return jsonResponse({ code: 0, data: session });
            }
            if (route === '/saveSession') {
                if (body.commitTurnID === 'turn-old') {
                    assert.equal(options.headers['X-SiYuan-Agent-Checkpoint'], '2', 'recovered turns must use the explicit checkpoint protocol');
                    storedSession = {
                        ...body,
                        revision: 21,
                        entries: body.entries.concat({ id: 'runtime_turn-old_0', type: 'assistant', content: 'Earlier answer', timestamp: 2 }),
                    };
                    delete storedSession.expectedRevision;
                    delete storedSession.commitTurnID;
                    delete storedSession.recoveryTurnID;
                    delete storedSession.recoveryState;
                    return jsonResponse({ code: 0, data: { revision: 21, session: storedSession } });
                }
                if (body.commitTurnID === 'turn-current') {
                    assert.equal(options.headers['X-SiYuan-Agent-Checkpoint'], '2');
                    storedSession = { ...body, revision: 23 };
                    delete storedSession.expectedRevision;
                    delete storedSession.commitTurnID;
                    currentTurnID = '';
                    return jsonResponse({ code: 0, data: { revision: 23, session: storedSession } });
                }
                storedSession = { ...body, revision: 22 };
                delete storedSession.expectedRevision;
                return jsonResponse({ code: 0, data: { revision: 22 } });
            }
            if (route === '/chat') {
                assert.equal(storedSession.entries.some((entry) => entry.id === body.userEntryID), true, 'the new user anchor must be persisted after the recovered turn is committed');
                assert.equal(body.contentRevision, 22);
                currentTurnID = 'turn-current';
                const encoded = new TextEncoder().encode('event: turn\ndata: {"turnID":"turn-current"}\n\nevent: content\ndata: {"token":"Recovered"}\n\nevent: done\ndata: {"turnID":"turn-current"}\n\n');
                let reads = 0;
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'text/event-stream' },
                    body: { getReader: () => ({ read: async () => reads++ === 0 ? { done: false, value: encoded } : { done: true } }) },
                };
            }
            if (route === '/lsSessions') return jsonResponse({ code: 0, data: { sessions: [], total: 0 } });
            throw new Error(`unexpected request: ${route}`);
        };
        const result = await automation.runAutomation({
            prompt: 'Summarize after recovery',
            sessionID: storedSession.id,
            sessionTitle: storedSession.title,
            persistSession: true,
        });
        assert.equal(result.markdown, 'Recovered');
        assert.deepEqual(requests.slice(0, 4).map((item) => item.route), ['/getSession', '/saveSession', '/saveSession', '/chat']);
        assert.equal(requests.filter((item) => item.route === '/saveSession').at(-1).body.commitTurnID, 'turn-current');
        assert.equal(storedSession.entries.some((entry) => entry.type === 'user' && entry.blockHTML === '<div>Summarize after recovery</div>'), true);
    }
    safety.context.interactionResponse = {
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ msg: 'service unavailable' }),
    };
    await assert.rejects(() => safety.postAgentInteraction('/confirm', { confirmID: 'confirm-1', approved: true }), /service unavailable/);
    safety.context.interactionResponse = {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ code: -1, msg: 'invalid confirm' }),
    };
    await assert.rejects(() => safety.postAgentInteraction('/confirm', { confirmID: '', approved: true }), /invalid confirm/, 'SiYuan HTTP 200 error envelopes must not be treated as success');
    const encoded = new TextEncoder().encode('event:done\ndata:{}');
    let readCount = 0;
    safety.context.interactionResponse = {
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: { getReader: () => ({ read: async () => readCount++ === 0 ? { done: false, value: encoded } : { done: true } }) },
    };
    const streamedEvents = [];
    await safety.chat({ message: 'test' }, async (item) => streamedEvents.push(item));
    assert.deepEqual(streamedEvents.map((item) => item.type), ['done'], 'the final SSE event must be consumed even without a trailing newline');
    const truncated = new TextEncoder().encode('event:content\ndata:{"token":"partial"}\n\n');
    readCount = 0;
    safety.context.interactionResponse = {
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: { getReader: () => ({ read: async () => readCount++ === 0 ? { done: false, value: truncated } : { done: true } }) },
    };
    await assert.rejects(
        () => safety.chat({ message: 'test' }, async () => {}),
        /连接.*中断|完整终态/,
        'a stream that closes without done/error/interrupted must fail instead of accepting partial output',
    );
    const fallbackHash = await safety.hashContent('same workflow');
    assert.equal(fallbackHash, await safety.hashContent('same workflow'), 'hash fallback must be deterministic');
    assert.notEqual(fallbackHash, await safety.hashContent('changed workflow'), 'hash fallback must detect content changes');
    assert.equal(fallbackHash.startsWith('fallback:'), true, 'test context should exercise the non-WebCrypto fallback');

    console.log('scheduled-events tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
