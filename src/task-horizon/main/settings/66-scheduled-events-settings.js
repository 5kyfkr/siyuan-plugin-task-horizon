    function __tmScheduledSettingsSupported() {
        const raw = String(
            window.siyuan?.config?.system?.kernelVersion
            || window.siyuan?.config?.system?.version
            || window.siyuan?.config?.appearance?.version
            || ''
        ).trim().replace(/^v/i, '');
        const parts = raw.split(/[.-]/).slice(0, 3).map((part) => Number(part) || 0);
        if (!raw) return !!globalThis.__tmAI?.runAutomation;
        const current = parts[0] * 1000000 + parts[1] * 1000 + parts[2];
        return current >= 3007003;
    }

    function __tmScheduledSettingsApi() {
        return globalThis['siyuan-plugin-task-horizon']?.scheduledEvents || null;
    }

    function __tmScheduledSettingsIcon(name, size = 16) {
        try { return __tmPhosphorBoldSvg(name, { size, className: 'tm-scheduled-events-icon-svg' }); } catch (e) { return ''; }
    }

    function __tmScheduledSettingsDraft(base = {}) {
        const source = base && typeof base === 'object' ? base : {};
        return __tmNormalizeScheduledEvent({
            id: source.id || __tmScheduledNewId(),
            type: 'agent_prompt',
            name: source.name || __tmT("settings.scheduledEvents"),
            enabled: source.enabled !== false,
            prompt: source.prompt || '',
            includeInternalPrompt: source.includeInternalPrompt !== false,
            conversationId: source.conversationId || '',
            conversationUpdatedAt: source.conversationUpdatedAt || 0,
            conversationTitle: source.conversationTitle || '',
            condition: source.condition || 'always',
            schedule: source.schedule || { kind: 'daily', date: __tmScheduledLocalDateKey(new Date()), weekday: 1, time: '19:00' },
            output: source.output || { mode: 'notification', documentId: '', documentMode: 'target', insertPosition: 'bottom' },
            lastOccurrence: source.lastOccurrence,
            lastRun: source.lastRun,
        });
    }

    function __tmScheduledSummaryTemplate() {
        return __tmScheduledSettingsDraft({
            name: '每日完成总结',
            prompt: __tmT("settings.summarizeTodaySCompletedTasksHighlightTheMainResults"),
            condition: 'today_has_completed_tasks',
            schedule: { kind: 'daily', date: '', weekday: 1, time: '19:00' },
            output: { mode: 'notification', documentId: '' },
        });
    }

    function __tmScheduledRecurrenceLabel(event) {
        const schedule = event?.schedule || {};
        const weekdayNames = [__tmT("calendar.sunday"), __tmT("calendar.monday"), __tmT("calendar.tuesday"), __tmT("calendar.wednesday"), __tmT("calendar.thursday"), __tmT("calendar.friday"), __tmT("calendar.saturday")];
        if (schedule.kind === 'once') return `${schedule.date || __tmT("settings.noDateSet")} ${schedule.time}`;
        if (schedule.kind === 'weekdays') return __tmT("settings.workdays", { time: schedule.time });
        if (schedule.kind === 'weekly') return __tmT("settings.weekly", { value1: weekdayNames[Number(schedule.weekday)] || '一', time: schedule.time });
        return __tmT("settings.everyDay", { time: schedule.time });
    }

    function __tmScheduledNextRunLabel(event) {
        if (!event?.enabled) return __tmT("settings.disabled");
        const timing = __tmScheduledResolveTiming(event, new Date());
        if (timing.due && timing.occurrence) return __tmT("settings.waitingToRun");
        if (!timing.nextAt) return event.schedule?.kind === 'once' ? __tmT("homepage.overdue3") : __tmT("settings.pending2");
        const next = timing.nextAt;
        const today = __tmScheduledLocalDateKey(new Date());
        const date = __tmScheduledLocalDateKey(next);
        return `${date === today ? __tmT("common.today") : date} ${__tmScheduledPad(next.getHours())}:${__tmScheduledPad(next.getMinutes())}`;
    }

    function __tmScheduledStatusMeta(status) {
        const map = {
            idle: [__tmT("settings.waiting"), 'is-idle'],
            running: [__tmT("settings.running"), 'is-running'],
            succeeded: [__tmT("ai.success"), 'is-success'],
            skipped_empty: [__tmT("settings.skippedNoTasks"), 'is-muted'],
            blocked: [__tmT("settings.blockedSafety"), 'is-danger'],
            config_error: [__tmT("settings.misconfigured"), 'is-warning'],
            desktop_only: [__tmT("settings.desktopOnly"), 'is-muted'],
            failed: [__tmT("ai.failed2"), 'is-danger'],
            delivery_commit_pending: [__tmT("settings.deliveredAwaitingConfirmation"), 'is-warning'],
            commit_pending: [__tmT("settings.deliveredAwaitingConfirmation"), 'is-warning'],
        };
        return map[String(status || '')] || map.idle;
    }

    function __tmScheduledDocumentOptions(documentId) {
        const selected = String(documentId || '').trim();
        const map = new Map();
        (Array.isArray(state.allDocuments) ? state.allDocuments : []).forEach((doc) => {
            const id = String(doc?.id || '').trim();
            if (!id) return;
            map.set(id, String(doc?.name || doc?.content || id).trim() || id);
        });
        if (selected && !map.has(selected)) map.set(selected, selected);
        return [
            `<option value="">${__tmT("task.selectDocument")}</option>`,
            ...Array.from(map.entries()).map(([id, name]) => `<option value="${esc(id)}" ${id === selected ? 'selected' : ''}>${esc(name)}</option>`),
        ].join('');
    }

    function __tmScheduledRenderEditor(draft) {
        if (!draft) return '';
        const schedule = draft.schedule || {};
        const output = draft.output || {};
        const weekdays = [__tmT("calendar.sunday"), __tmT("calendar.monday"), __tmT("calendar.tuesday"), __tmT("calendar.wednesday"), __tmT("calendar.thursday"), __tmT("calendar.friday"), __tmT("calendar.saturday")];
        return `
            <section class="tm-scheduled-events-editor" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.scheduledEventEditor")}">
                <div class="tm-scheduled-events-editor__heading">
                    <div>
                        <div class="tm-settings-section-title">${state.scheduledEventEditingId ? __tmT("settings.editScheduledEvent") : __tmT("settings.newScheduledEvent")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.changesTakeEffectImmediatelyNewEventsStartPausedEnable")}</div>
                    </div>
                    <button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledCancelEdit" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.closeEditor")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.closeEditor")}">${__tmScheduledSettingsIcon('x')}</button>
                </div>
                <div class="tm-scheduled-events-form-grid">
                    <label class="tm-scheduled-events-field tm-scheduled-events-field--wide">
                        <span>${__tmT("ai.name")}</span>
                        <input class="b3-text-field" type="text" value="${esc(draft.name)}" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["name"]' placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.forExampleDailyCompletionSummary")}">
                    </label>
                    <label class="tm-scheduled-events-field tm-scheduled-events-field--wide">
                        <span>${__tmT("settings.prompt")}</span>
                        <textarea class="b3-text-field" rows="5" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["prompt"]' placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.tellTheAgentWhatToSummarizeOrAnalyze")}">${esc(draft.prompt)}</textarea>
                    </label>
                    <div class="tm-scheduled-events-field tm-scheduled-events-field--wide">
                        <span>${__tmT("settings.internalPrompt")}</span>
                        <label class="fn__flex-center" style="gap:8px;">
                            <input class="b3-switch fn__flex-center" type="checkbox" ${draft.includeInternalPrompt ? 'checked' : ''} data-tm-call="tmScheduledUpdateDraft" data-tm-args='["includeInternalPrompt"]'>
                            <span>${__tmT("settings.attachUnattendedSafetyRulesAndStatisticsRules")}</span>
                        </label>
                        <small class="tm-settings-section-desc">${__tmT("settings.onlyControlsWhetherThisTextBlockIsAttachedScheduled")}</small>
                    </div>
                    <label class="tm-scheduled-events-field">
                        <span>${__tmT("kernel.runCondition")}</span>
                        <select class="b3-select" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["condition"]'>
                            <option value="always" ${draft.condition === 'always' ? 'selected' : ''}>${__tmT("settings.alwaysRun")}</option>
                            <option value="today_has_completed_tasks" ${draft.condition === 'today_has_completed_tasks' ? 'selected' : ''}>${__tmT("settings.hasCompletedTasksToday")}</option>
                        </select>
                    </label>
                    <label class="tm-scheduled-events-field">
                        <span>${__tmT("settings.repeatRule")}</span>
                        <select class="b3-select" data-tm-call="tmScheduledChangeScheduleKind">
                            <option value="once" ${schedule.kind === 'once' ? 'selected' : ''}>${__tmT("settings.once")}</option>
                            <option value="daily" ${schedule.kind === 'daily' ? 'selected' : ''}>${__tmT("calendar.daily2")}</option>
                            <option value="weekdays" ${schedule.kind === 'weekdays' ? 'selected' : ''}>${__tmT("calendar.workdays")}</option>
                            <option value="weekly" ${schedule.kind === 'weekly' ? 'selected' : ''}>${__tmT("calendar.weekly")}</option>
                        </select>
                    </label>
                    ${schedule.kind === 'once' ? `
                        <label class="tm-scheduled-events-field">
                            <span>${__tmT("calendar.date")}</span>
                            <input class="b3-text-field" type="date" value="${esc(schedule.date)}" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["schedule.date"]'>
                        </label>
                    ` : ''}
                    ${schedule.kind === 'weekly' ? `
                        <label class="tm-scheduled-events-field">
                            <span>${__tmT("calendar.weekdays")}</span>
                            <select class="b3-select" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["schedule.weekday"]'>
                                ${weekdays.map((label, index) => `<option value="${index}" ${Number(schedule.weekday) === index ? 'selected' : ''}>${label}</option>`).join('')}
                            </select>
                        </label>
                    ` : ''}
                    <label class="tm-scheduled-events-field">
                        <span>${__tmT("task.time")}</span>
                        <input class="b3-text-field" type="time" value="${esc(schedule.time)}" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["schedule.time"]'>
                    </label>
                    <div class="tm-scheduled-events-field tm-scheduled-events-field--wide">
                        <span>${__tmT("settings.outputMethod")}</span>
                        <div class="tm-scheduled-events-segmented tm-scheduled-events-segmented--output" role="group" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.outputMethod")}">
                            <button type="button" class="${output.mode === 'notification' ? 'is-active' : ''}" data-tm-call="tmScheduledSetOutputMode" data-tm-args='["notification"]'>${__tmT("settings.notification")}</button>
                            <button type="button" class="${output.mode === 'document' ? 'is-active' : ''}" data-tm-call="tmScheduledSetOutputMode" data-tm-args='["document"]'>${__tmT("settings.writeToDocument")}</button>
                            <button type="button" class="${output.mode === 'daily_note' ? 'is-active' : ''}" data-tm-call="tmScheduledSetOutputMode" data-tm-args='["daily_note"]'>${__tmT("settings.writeToDailyNote")}</button>
                        </div>
                    </div>
                    ${output.mode === 'document' ? `
                        <div class="tm-scheduled-events-field">
                            <span>${__tmT("settings.documentOrganization")}</span>
                            <div class="tm-scheduled-events-segmented" role="group" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.documentOrganization")}">
                                <button type="button" class="${output.documentMode === 'target' ? 'is-active' : ''}" data-tm-call="tmScheduledSetDocumentMode" data-tm-args='["target"]'>${__tmT("kernel.writeDirectly")}</button>
                                <button type="button" class="${output.documentMode === 'monthly_child' ? 'is-active' : ''}" data-tm-call="tmScheduledSetDocumentMode" data-tm-args='["monthly_child"]'>${__tmT("settings.monthlySubdocument")}</button>
                            </div>
                        </div>
                        <div class="tm-scheduled-events-field">
                            <span>${__tmT("kernel.insertPosition")}</span>
                            <div class="tm-scheduled-events-segmented" role="group" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("kernel.insertPosition")}">
                                <button type="button" class="${output.insertPosition === 'bottom' ? 'is-active' : ''}" data-tm-call="tmScheduledSetInsertPosition" data-tm-args='["bottom"]'>${__tmT("settings.documentBottom")}</button>
                                <button type="button" class="${output.insertPosition === 'top' ? 'is-active' : ''}" data-tm-call="tmScheduledSetInsertPosition" data-tm-args='["top"]'>${__tmT("settings.documentTop")}</button>
                            </div>
                        </div>
                        <label class="tm-scheduled-events-field">
                            <span>${output.documentMode === 'monthly_child' ? __tmT("settings.parentDocument") : __tmT("kernel.targetDocument")}</span>
                            <select class="b3-select" data-tm-call="tmScheduledPickDocument">${__tmScheduledDocumentOptions(output.documentId)}</select>
                        </label>
                        <label class="tm-scheduled-events-field">
                            <span>${output.documentMode === 'monthly_child' ? __tmT("kernel.parentDocumentId") : __tmT("kernel.documentsId")}</span>
                            <input class="b3-text-field" type="text" value="${esc(output.documentId)}" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["output.documentId"]' placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.orEnterADocumentIdDirectly")}">
                        </label>
                    ` : ''}
                    ${output.mode === 'daily_note' ? `
                        <div class="tm-scheduled-events-field tm-scheduled-events-field--wide">
                            <span>${__tmT("settings.dailyNoteTarget")}</span>
                            <div class="tm-settings-section-desc">${__tmT("settings.usesTheDefaultNotebookForTodaySDailyNote")}</div>
                        </div>
                    ` : ''}
                </div>
                <div class="tm-scheduled-events-editor__actions">
                    <button class="tm-btn tm-btn-secondary" type="button" data-tm-call="tmScheduledCancelEdit">${__tmT("quickbar.done")}</button>
                </div>
            </section>
        `;
    }

    function __tmScheduledRenderResult(event) {
        if (!event || state.scheduledEventResultId !== event.id) return '';
        const run = event.lastRun || {};
        return `
            <div class="tm-scheduled-events-result">
                <div class="tm-scheduled-events-result__heading">
                    <strong>${esc(run.title || event.name)}</strong>
                    <button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledCloseResult" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.offresult")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.offresult")}">${__tmScheduledSettingsIcon('x')}</button>
                </div>
                ${run.markdown ? `<pre>${esc(run.markdown)}</pre>` : `<div class="tm-scheduled-events-empty">${esc(run.error || __tmT("settings.noResultsYet"))}</div>`}
                ${run.error ? `<div class="tm-scheduled-events-result__error">${esc(run.error)}</div>` : ''}
            </div>
        `;
    }

    function __tmRenderScheduledEventsSettingsPanel() {
        const supported = __tmScheduledSettingsSupported();
        const events = __tmScheduledSettingsApi()?.list?.() || [];
        const rows = events.map((event) => {
            const status = __tmScheduledStatusMeta(event.lastRun?.status);
            const statusError = String(event.lastRun?.error || '').trim().replace(/^(?:已阻止\s*){2,}/, '已阻止').slice(0, 500);
            const outputLabel = event.output?.mode === 'document'
                ? `${event.output?.documentMode === 'monthly_child' ? __tmT("settings.monthlySubdocument2") : __tmT("kernel.targetDocument")} · ${event.output?.insertPosition === 'top' ? __tmT("settings.top") : __tmT("settings.bottom")}`
                : event.output?.mode === 'daily_note'
                    ? __tmT("settings.todaySDailyNote2", { value1: SettingsStore.data.newTaskDailyNoteAppendToBottom === true ? __tmT("settings.bottom") : __tmT("settings.top") })
                    : __tmT("settings.notification");
            const args = esc(JSON.stringify([event.id]));
            return `
                <div class="tm-scheduled-events-row${event.enabled ? '' : ' is-disabled'}">
                    <div class="tm-scheduled-events-row__toggle">
                        <input class="b3-switch fn__flex-center" type="checkbox" ${event.enabled ? 'checked' : ''} ${supported ? '' : 'disabled'} data-tm-call="tmScheduledToggle" data-tm-args='${args}' aria-label="${event.enabled ? __tmT("settings.disable") : __tmT("settings.enable")} ${esc(event.name)}">
                    </div>
                    <div class="tm-scheduled-events-row__main">
                        <strong title="${esc(event.name)}">${esc(event.name)}</strong>
                        <span>${esc(__tmScheduledRecurrenceLabel(event))}</span>
                    </div>
                    <div class="tm-scheduled-events-cell"><span class="tm-scheduled-events-cell__label">${__tmT("settings.nextRun")}</span><span>${esc(__tmScheduledNextRunLabel(event))}</span></div>
                    <div class="tm-scheduled-events-cell"><span class="tm-scheduled-events-cell__label">${__tmT("settings.output")}</span><span>${outputLabel}</span></div>
                    <div class="tm-scheduled-events-cell tm-scheduled-events-cell--status"><span class="tm-scheduled-events-cell__label">${__tmT("kernel.status")}</span><span class="tm-scheduled-events-status ${status[1]}" ${statusError ? `title="${esc(statusError)}"` : ''}>${status[0]}</span>${statusError ? `<small class="tm-scheduled-events-status-detail">${esc(statusError)}</small>` : ''}</div>
                    <div class="tm-scheduled-events-row__actions">
                        <button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledRunNow" data-tm-args='${args}' ${supported ? '' : 'disabled'} title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.runNow")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.runNow")}">${__tmScheduledSettingsIcon('play')}</button>
                        ${event.conversationId ? `<button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledOpenConversation" data-tm-args='${args}' title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.openConversation")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.openConversation")}">${__tmScheduledSettingsIcon('chat-circle-text')}</button>` : ''}
                        <button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledViewResult" data-tm-args='${args}' title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.viewresult")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.viewresult")}">${__tmScheduledSettingsIcon('file-text')}</button>
                        <button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledEdit" data-tm-args='${args}' ${supported ? '' : 'disabled'} title="${globalThis.__taskHorizonHostBridge.i18n.html("calendar.edit")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("calendar.edit")}">${__tmScheduledSettingsIcon('pencil')}</button>
                        <button class="tm-scheduled-events-icon-btn is-danger" type="button" data-tm-call="tmScheduledDelete" data-tm-args='${args}' ${supported ? '' : 'disabled'} title="${globalThis.__taskHorizonHostBridge.i18n.html("common.delete")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("common.delete")}">${__tmScheduledSettingsIcon('trash-2')}</button>
                    </div>
                </div>
                ${__tmScheduledRenderResult(event)}
            `;
        }).join('');
        return `
            <div class="tm-settings-panel tm-scheduled-events-panel" data-tm-settings-section="ai-scheduled" ${__tmSettingsSearchAttrs('ai', __tmT("settings.scheduledEvents"), __tmT("settings.runsAgentPromptsAutomaticallyAndNotifiesOrWritesTo"), { key: 'ai-scheduled-events' })}>
                <div class="tm-scheduled-events-toolbar">
                    <div>
                        <div class="tm-settings-section-title">${__tmT("settings.scheduledEvents")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.eventConfigurationsAndRunRecordsSyncWithCloudSettings")}</div>
                    </div>
                    <div class="tm-scheduled-events-toolbar__actions">
                        <button class="tm-btn tm-btn-secondary" type="button" data-tm-call="tmScheduledUseSummaryTemplate" ${supported ? '' : 'disabled'}>${__tmScheduledSettingsIcon('calendar-check')}<span>${__tmT("settings.dailyCompletionSummary")}</span></button>
                        <button class="tm-btn tm-btn-primary" type="button" data-tm-call="tmScheduledCreate" ${supported ? '' : 'disabled'}>${__tmScheduledSettingsIcon('plus')}<span>${__tmT("settings.newScheduledEvent")}</span></button>
                    </div>
                </div>
                ${supported ? '' : `<div class="tm-scheduled-events-compat">${__tmT("settings.scheduledEventsRequireSiyuanOrLaterOtherPluginFeatures")}</div>`}
                <div class="tm-scheduled-events-list">
                    ${rows || `<div class="tm-scheduled-events-empty">${__tmT("settings.noScheduledEvents")}</div>`}
                </div>
                ${__tmScheduledRenderEditor(state.scheduledEventDraft)}
            </div>
        `;
    }

    function __tmScheduledRerenderSettings() {
        if (state.settingsActiveTab === 'ai' && state.settingsModal) showSettings();
    }

    window.tmScheduledCreate = function () {
        state.scheduledEventEditingId = '';
        state.scheduledEventDraft = __tmScheduledSettingsDraft({ enabled: false, prompt: __tmT("settings.summarizeTodaySTasks") });
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledUseSummaryTemplate = function () {
        state.scheduledEventEditingId = '';
        state.scheduledEventDraft = __tmScheduledSummaryTemplate();
        state.scheduledEventDraft.enabled = false;
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledEdit = function (id) {
        __tmFlushSettingsInputs();
        const event = (__tmScheduledSettingsApi()?.list?.() || []).find((item) => item.id === String(id || '').trim());
        if (!event) return;
        state.scheduledEventEditingId = event.id;
        state.scheduledEventDraft = __tmScheduledSettingsDraft(event);
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledCancelEdit = function () {
        __tmFlushSettingsInputs();
        __tmFlushSettingsAutosave();
        state.scheduledEventEditingId = '';
        state.scheduledEventDraft = null;
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledUpdateDraft = function (path, value) {
        const draft = state.scheduledEventDraft;
        if (!draft) return;
        const parts = String(path || '').split('.').filter(Boolean);
        if (!parts.length) return;
        let target = draft;
        while (parts.length > 1) {
            const part = parts.shift();
            target[part] = target[part] && typeof target[part] === 'object' ? target[part] : {};
            target = target[part];
        }
        const key = parts[0];
        target[key] = path === 'schedule.weekday' ? Number(value) : value;
    };

    window.tmScheduledChangeScheduleKind = function (value) {
        window.tmScheduledUpdateDraft('schedule.kind', value);
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledSetOutputMode = function (value) {
        window.tmScheduledUpdateDraft('output.mode', value);
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledSetDocumentMode = function (value) {
        window.tmScheduledUpdateDraft('output.documentMode', value);
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledSetInsertPosition = function (value) {
        window.tmScheduledUpdateDraft('output.insertPosition', value);
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledPickDocument = function (value) {
        window.tmScheduledUpdateDraft('output.documentId', value);
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledSaveDraft = async function () {
        const draft = __tmNormalizeScheduledEvent(state.scheduledEventDraft);
        const error = __tmScheduledValidate(draft);
        if (error) {
            hint(`⚠ ${error}`, 'warning');
            return;
        }
        await __tmScheduledSettingsApi()?.save?.(draft);
        state.scheduledEventEditingId = '';
        state.scheduledEventDraft = null;
        hint(__tmT("settings.scheduledEventSaved"), 'success');
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledToggle = async function (id, enabled) {
        __tmFlushSettingsInputs();
        const event = (__tmScheduledSettingsApi()?.list?.() || []).find((item) => item.id === String(id || '').trim());
        if (!event) return;
        const draft = state.scheduledEventDraft?.id === event.id ? state.scheduledEventDraft : __tmSettingsClone(event);
        draft.enabled = enabled === true;
        __tmQueueSettingsSave(`scheduled:${event.id}`, draft, __tmPersistScheduledSetting, 0);
        await __tmRunSettingsSave(`scheduled:${event.id}`);
    };

    window.tmScheduledRunNow = async function (id) {
        hint(__tmT("settings.theScheduledEventIsRunning"), 'info');
        const result = await __tmScheduledSettingsApi()?.runNow?.(id);
        const status = __tmScheduledStatusMeta(result?.status);
        const notificationFailed = result?.status === 'succeeded' && result?.notificationDelivered === false;
        const message = result?.error
            ? `${status[0]}：${result.error}`
            : (notificationFailed
                ? __tmT("settings.theScheduledEventCompletedButTheSystemNotificationWas", { value1: result.notificationError || __tmT("calendar.unknownReason") })
                : (result?.status === 'succeeded' ? '' : __tmT("settings.scheduledEvents2", { value1: status[0] })));
        if (message) hint(message, notificationFailed ? 'warning' : (result?.status === 'skipped_empty' ? 'info' : 'warning'));
        if (result?.status === 'succeeded') state.scheduledEventResultId = String(id || '').trim();
        __tmScheduledRerenderSettings();
        if (result?.status === 'succeeded') await window.tmScheduledOpenConversation(id);
    };

    window.tmScheduledOpenConversation = async function (id) {
        const event = (__tmScheduledSettingsApi()?.list?.() || []).find((item) => item.id === String(id || '').trim());
        const conversationId = String(event?.conversationId || '').trim();
        if (!conversationId) {
            hint(__tmT("settings.thisEventHasNoRunConversationYet"), 'info');
            return;
        }
        try { await globalThis.__taskHorizonEnsureAiModuleLoaded?.(); } catch (e) {}
        if (typeof globalThis.__tmAI?.openConversation !== 'function') {
            hint(__tmT("settings.theTaskAgentConversationIsTemporarilyUnavailable"), 'warning');
            return;
        }
        try { window.closeSettings?.(); } catch (e) {}
        await globalThis.__tmAI.openConversation(conversationId, { sessionUpdatedAt: event.conversationUpdatedAt });
    };

    window.tmScheduledViewResult = function (id) {
        state.scheduledEventResultId = state.scheduledEventResultId === id ? '' : String(id || '').trim();
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledCloseResult = function () {
        state.scheduledEventResultId = '';
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledDelete = async function (id) {
        const event = (__tmScheduledSettingsApi()?.list?.() || []).find((item) => item.id === String(id || '').trim());
        if (!event) return;
        if (!window.confirm(__tmT("settings.deleteTheScheduledEvent", { name: event.name }))) return;
        __tmFlushSettingsInputs();
        await __tmRunSettingsSave(`scheduled:${event.id}`);
        await __tmScheduledSettingsApi()?.remove?.(event.id);
        __tmSettingsSaveJobs.delete(`scheduled:${event.id}`);
        __tmSettingsSaveFeedback(`scheduled:${event.id}`);
        if (state.scheduledEventEditingId === event.id) {
            state.scheduledEventEditingId = '';
            state.scheduledEventDraft = null;
        }
        if (state.scheduledEventResultId === event.id) state.scheduledEventResultId = '';
        __tmScheduledRerenderSettings();
    };
