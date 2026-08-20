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
            name: source.name || '定时事件',
            enabled: source.enabled !== false,
            prompt: source.prompt || '',
            conversationId: source.conversationId || '',
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
            prompt: '请总结今天完成的任务，提炼主要成果、推进中的方向和明天值得优先关注的事项。内容应简洁、具体，不要虚构任务数据。',
            condition: 'today_has_completed_tasks',
            schedule: { kind: 'daily', date: '', weekday: 1, time: '19:00' },
            output: { mode: 'notification', documentId: '' },
        });
    }

    function __tmScheduledRecurrenceLabel(event) {
        const schedule = event?.schedule || {};
        const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        if (schedule.kind === 'once') return `${schedule.date || '未设置日期'} ${schedule.time}`;
        if (schedule.kind === 'weekdays') return `工作日 ${schedule.time}`;
        if (schedule.kind === 'weekly') return `每周${weekdayNames[Number(schedule.weekday)] || '一'} ${schedule.time}`;
        return `每天 ${schedule.time}`;
    }

    function __tmScheduledNextRunLabel(event) {
        if (!event?.enabled) return '已停用';
        const timing = __tmScheduledResolveTiming(event, new Date());
        if (timing.due && timing.occurrence) return '等待执行';
        if (!timing.nextAt) return event.schedule?.kind === 'once' ? '已过期' : '待计算';
        const next = timing.nextAt;
        const today = __tmScheduledLocalDateKey(new Date());
        const date = __tmScheduledLocalDateKey(next);
        return `${date === today ? '今天' : date} ${__tmScheduledPad(next.getHours())}:${__tmScheduledPad(next.getMinutes())}`;
    }

    function __tmScheduledStatusMeta(status) {
        const map = {
            idle: ['等待', 'is-idle'],
            running: ['运行中', 'is-running'],
            succeeded: ['成功', 'is-success'],
            skipped_empty: ['空任务跳过', 'is-muted'],
            blocked: ['安全阻断', 'is-danger'],
            config_error: ['配置错误', 'is-warning'],
            failed: ['失败', 'is-danger'],
            delivery_commit_pending: ['已投递，等待确认', 'is-warning'],
            commit_pending: ['已投递，等待确认', 'is-warning'],
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
            '<option value="">选择文档</option>',
            ...Array.from(map.entries()).map(([id, name]) => `<option value="${esc(id)}" ${id === selected ? 'selected' : ''}>${esc(name)}</option>`),
        ].join('');
    }

    function __tmScheduledRenderEditor(draft) {
        if (!draft) return '';
        const schedule = draft.schedule || {};
        const output = draft.output || {};
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `
            <section class="tm-scheduled-events-editor" aria-label="定时事件编辑器">
                <div class="tm-scheduled-events-editor__heading">
                    <div>
                        <div class="tm-settings-section-title">${state.scheduledEventEditingId ? '编辑定时事件' : '新建定时事件'}</div>
                        <div class="tm-settings-section-desc">每条事件使用一个固定智能体对话，后续运行持续追加；智能体只允许调用任务读取和聚合工具。</div>
                    </div>
                    <button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledCancelEdit" title="关闭编辑器" aria-label="关闭编辑器">${__tmScheduledSettingsIcon('x')}</button>
                </div>
                <div class="tm-scheduled-events-form-grid">
                    <label class="tm-scheduled-events-field tm-scheduled-events-field--wide">
                        <span>名称</span>
                        <input class="b3-text-field" type="text" value="${esc(draft.name)}" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["name"]' placeholder="例如：每日完成总结">
                    </label>
                    <label class="tm-scheduled-events-field tm-scheduled-events-field--wide">
                        <span>提示词</span>
                        <textarea class="b3-text-field" rows="5" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["prompt"]' placeholder="告诉智能体需要总结或分析什么">${esc(draft.prompt)}</textarea>
                    </label>
                    <label class="tm-scheduled-events-field">
                        <span>运行条件</span>
                        <select class="b3-select" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["condition"]'>
                            <option value="always" ${draft.condition === 'always' ? 'selected' : ''}>始终运行</option>
                            <option value="today_has_completed_tasks" ${draft.condition === 'today_has_completed_tasks' ? 'selected' : ''}>当天有已完成任务</option>
                        </select>
                    </label>
                    <label class="tm-scheduled-events-field">
                        <span>重复规则</span>
                        <select class="b3-select" data-tm-call="tmScheduledChangeScheduleKind">
                            <option value="once" ${schedule.kind === 'once' ? 'selected' : ''}>一次</option>
                            <option value="daily" ${schedule.kind === 'daily' ? 'selected' : ''}>每日</option>
                            <option value="weekdays" ${schedule.kind === 'weekdays' ? 'selected' : ''}>工作日</option>
                            <option value="weekly" ${schedule.kind === 'weekly' ? 'selected' : ''}>每周</option>
                        </select>
                    </label>
                    ${schedule.kind === 'once' ? `
                        <label class="tm-scheduled-events-field">
                            <span>日期</span>
                            <input class="b3-text-field" type="date" value="${esc(schedule.date)}" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["schedule.date"]'>
                        </label>
                    ` : ''}
                    ${schedule.kind === 'weekly' ? `
                        <label class="tm-scheduled-events-field">
                            <span>星期</span>
                            <select class="b3-select" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["schedule.weekday"]'>
                                ${weekdays.map((label, index) => `<option value="${index}" ${Number(schedule.weekday) === index ? 'selected' : ''}>${label}</option>`).join('')}
                            </select>
                        </label>
                    ` : ''}
                    <label class="tm-scheduled-events-field">
                        <span>时间</span>
                        <input class="b3-text-field" type="time" value="${esc(schedule.time)}" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["schedule.time"]'>
                    </label>
                    <div class="tm-scheduled-events-field tm-scheduled-events-field--wide">
                        <span>输出方式</span>
                        <div class="tm-scheduled-events-segmented tm-scheduled-events-segmented--output" role="group" aria-label="输出方式">
                            <button type="button" class="${output.mode === 'notification' ? 'is-active' : ''}" data-tm-call="tmScheduledSetOutputMode" data-tm-args='["notification"]'>通知展示</button>
                            <button type="button" class="${output.mode === 'document' ? 'is-active' : ''}" data-tm-call="tmScheduledSetOutputMode" data-tm-args='["document"]'>写入文档</button>
                            <button type="button" class="${output.mode === 'daily_note' ? 'is-active' : ''}" data-tm-call="tmScheduledSetOutputMode" data-tm-args='["daily_note"]'>写入到日记</button>
                        </div>
                    </div>
                    ${output.mode === 'document' ? `
                        <div class="tm-scheduled-events-field">
                            <span>文档组织</span>
                            <div class="tm-scheduled-events-segmented" role="group" aria-label="文档组织">
                                <button type="button" class="${output.documentMode === 'target' ? 'is-active' : ''}" data-tm-call="tmScheduledSetDocumentMode" data-tm-args='["target"]'>直接写入</button>
                                <button type="button" class="${output.documentMode === 'monthly_child' ? 'is-active' : ''}" data-tm-call="tmScheduledSetDocumentMode" data-tm-args='["monthly_child"]'>按月子文档</button>
                            </div>
                        </div>
                        <div class="tm-scheduled-events-field">
                            <span>插入位置</span>
                            <div class="tm-scheduled-events-segmented" role="group" aria-label="插入位置">
                                <button type="button" class="${output.insertPosition === 'bottom' ? 'is-active' : ''}" data-tm-call="tmScheduledSetInsertPosition" data-tm-args='["bottom"]'>文档底部</button>
                                <button type="button" class="${output.insertPosition === 'top' ? 'is-active' : ''}" data-tm-call="tmScheduledSetInsertPosition" data-tm-args='["top"]'>文档顶部</button>
                            </div>
                        </div>
                        <label class="tm-scheduled-events-field">
                            <span>${output.documentMode === 'monthly_child' ? '父文档' : '目标文档'}</span>
                            <select class="b3-select" data-tm-call="tmScheduledPickDocument">${__tmScheduledDocumentOptions(output.documentId)}</select>
                        </label>
                        <label class="tm-scheduled-events-field">
                            <span>${output.documentMode === 'monthly_child' ? '父文档 ID' : '文档 ID'}</span>
                            <input class="b3-text-field" type="text" value="${esc(output.documentId)}" data-tm-call="tmScheduledUpdateDraft" data-tm-args='["output.documentId"]' placeholder="也可直接输入文档 ID">
                        </label>
                    ` : ''}
                    ${output.mode === 'daily_note' ? `
                        <div class="tm-scheduled-events-field tm-scheduled-events-field--wide">
                            <span>日记目标</span>
                            <div class="tm-settings-section-desc">使用常规设置中的“今天日记默认笔记本”；插入位置由“日记追加到底部”控制。</div>
                        </div>
                    ` : ''}
                </div>
                <div class="tm-scheduled-events-editor__actions">
                    <button class="tm-btn tm-btn-secondary" type="button" data-tm-call="tmScheduledCancelEdit">取消</button>
                    <button class="tm-btn tm-btn-success" type="button" data-tm-call="tmScheduledSaveDraft">保存事件</button>
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
                    <button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledCloseResult" title="关闭结果" aria-label="关闭结果">${__tmScheduledSettingsIcon('x')}</button>
                </div>
                ${run.markdown ? `<pre>${esc(run.markdown)}</pre>` : `<div class="tm-scheduled-events-empty">${esc(run.error || '尚无运行结果')}</div>`}
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
                ? `${event.output?.documentMode === 'monthly_child' ? '月度子文档' : '目标文档'} · ${event.output?.insertPosition === 'top' ? '顶部' : '底部'}`
                : event.output?.mode === 'daily_note'
                    ? `今天日记 · ${SettingsStore.data.newTaskDailyNoteAppendToBottom === true ? '底部' : '顶部'}`
                    : '通知展示';
            const args = esc(JSON.stringify([event.id]));
            return `
                <div class="tm-scheduled-events-row${event.enabled ? '' : ' is-disabled'}">
                    <div class="tm-scheduled-events-row__toggle">
                        <input class="b3-switch fn__flex-center" type="checkbox" ${event.enabled ? 'checked' : ''} ${supported ? '' : 'disabled'} data-tm-call="tmScheduledToggle" data-tm-args='${args}' aria-label="${event.enabled ? '停用' : '启用'} ${esc(event.name)}">
                    </div>
                    <div class="tm-scheduled-events-row__main">
                        <strong title="${esc(event.name)}">${esc(event.name)}</strong>
                        <span>${esc(__tmScheduledRecurrenceLabel(event))}</span>
                    </div>
                    <div class="tm-scheduled-events-cell"><span class="tm-scheduled-events-cell__label">下次运行</span><span>${esc(__tmScheduledNextRunLabel(event))}</span></div>
                    <div class="tm-scheduled-events-cell"><span class="tm-scheduled-events-cell__label">输出</span><span>${outputLabel}</span></div>
                    <div class="tm-scheduled-events-cell tm-scheduled-events-cell--status"><span class="tm-scheduled-events-cell__label">状态</span><span class="tm-scheduled-events-status ${status[1]}" ${statusError ? `title="${esc(statusError)}"` : ''}>${status[0]}</span>${statusError ? `<small class="tm-scheduled-events-status-detail">${esc(statusError)}</small>` : ''}</div>
                    <div class="tm-scheduled-events-row__actions">
                        <button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledRunNow" data-tm-args='${args}' ${supported ? '' : 'disabled'} title="立即运行" aria-label="立即运行">${__tmScheduledSettingsIcon('play')}</button>
                        ${event.conversationId ? `<button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledOpenConversation" data-tm-args='${args}' title="打开对话" aria-label="打开对话">${__tmScheduledSettingsIcon('chat-circle-text')}</button>` : ''}
                        <button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledViewResult" data-tm-args='${args}' title="查看结果" aria-label="查看结果">${__tmScheduledSettingsIcon('file-text')}</button>
                        <button class="tm-scheduled-events-icon-btn" type="button" data-tm-call="tmScheduledEdit" data-tm-args='${args}' ${supported ? '' : 'disabled'} title="编辑" aria-label="编辑">${__tmScheduledSettingsIcon('pencil')}</button>
                        <button class="tm-scheduled-events-icon-btn is-danger" type="button" data-tm-call="tmScheduledDelete" data-tm-args='${args}' ${supported ? '' : 'disabled'} title="删除" aria-label="删除">${__tmScheduledSettingsIcon('trash-2')}</button>
                    </div>
                </div>
                ${__tmScheduledRenderResult(event)}
            `;
        }).join('');
        return `
            <div class="tm-settings-panel tm-scheduled-events-panel" data-tm-settings-section="ai-scheduled" ${__tmSettingsSearchAttrs('ai', '定时事件', '自动运行智能体提示词并通知或写入文档', { key: 'ai-scheduled-events' })}>
                <div class="tm-scheduled-events-toolbar">
                    <div>
                        <div class="tm-settings-section-title">定时事件</div>
                        <div class="tm-settings-section-desc">事件配置和执行记录随云端设置同步；每次结果追加到固定智能体对话，同一 occurrenceKey 不会重复执行。</div>
                    </div>
                    <div class="tm-scheduled-events-toolbar__actions">
                        <button class="tm-btn tm-btn-secondary" type="button" data-tm-call="tmScheduledUseSummaryTemplate" ${supported ? '' : 'disabled'}>${__tmScheduledSettingsIcon('calendar-check')}<span>每日完成总结</span></button>
                        <button class="tm-btn tm-btn-primary" type="button" data-tm-call="tmScheduledCreate" ${supported ? '' : 'disabled'}>${__tmScheduledSettingsIcon('plus')}<span>新建定时事件</span></button>
                    </div>
                </div>
                ${supported ? '' : '<div class="tm-scheduled-events-compat">定时事件需要思源 3.7.3 或更高版本。当前版本仍可使用插件其他功能。</div>'}
                <div class="tm-scheduled-events-list">
                    ${rows || '<div class="tm-scheduled-events-empty">暂无定时事件</div>'}
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
        state.scheduledEventDraft = __tmScheduledSettingsDraft();
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledUseSummaryTemplate = function () {
        state.scheduledEventEditingId = '';
        state.scheduledEventDraft = __tmScheduledSummaryTemplate();
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledEdit = function (id) {
        const event = (__tmScheduledSettingsApi()?.list?.() || []).find((item) => item.id === String(id || '').trim());
        if (!event) return;
        state.scheduledEventEditingId = event.id;
        state.scheduledEventDraft = __tmScheduledSettingsDraft(event);
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledCancelEdit = function () {
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
        hint('定时事件已保存', 'success');
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledToggle = async function (id, enabled) {
        const event = (__tmScheduledSettingsApi()?.list?.() || []).find((item) => item.id === String(id || '').trim());
        if (!event) return;
        event.enabled = enabled === true;
        await __tmScheduledSettingsApi()?.save?.(event);
        __tmScheduledRerenderSettings();
    };

    window.tmScheduledRunNow = async function (id) {
        hint('定时事件正在运行', 'info');
        const result = await __tmScheduledSettingsApi()?.runNow?.(id);
        const status = __tmScheduledStatusMeta(result?.status);
        const notificationFailed = result?.status === 'succeeded' && result?.notificationDelivered === false;
        const message = result?.error
            ? `${status[0]}：${result.error}`
            : (notificationFailed
                ? `定时事件已完成，但系统通知未发送：${result.notificationError || '未知原因'}；正在打开对话`
                : (result?.status === 'succeeded' ? '' : `定时事件：${status[0]}`));
        if (message) hint(message, notificationFailed ? 'warning' : (result?.status === 'skipped_empty' ? 'info' : 'warning'));
        if (result?.status === 'succeeded') state.scheduledEventResultId = String(id || '').trim();
        __tmScheduledRerenderSettings();
        if (result?.status === 'succeeded') await window.tmScheduledOpenConversation(id);
    };

    window.tmScheduledOpenConversation = async function (id) {
        const event = (__tmScheduledSettingsApi()?.list?.() || []).find((item) => item.id === String(id || '').trim());
        const conversationId = String(event?.conversationId || '').trim();
        if (!conversationId) {
            hint('该事件还没有运行对话', 'info');
            return;
        }
        try { await globalThis.__taskHorizonEnsureAiModuleLoaded?.(); } catch (e) {}
        if (typeof globalThis.__tmAI?.openConversation !== 'function') {
            hint('任务智能体对话暂不可用', 'warning');
            return;
        }
        try { window.closeSettings?.(); } catch (e) {}
        await globalThis.__tmAI.openConversation(conversationId);
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
        if (!window.confirm(`删除定时事件“${event.name}”？`)) return;
        await __tmScheduledSettingsApi()?.remove?.(event.id);
        if (state.scheduledEventEditingId === event.id) {
            state.scheduledEventEditingId = '';
            state.scheduledEventDraft = null;
        }
        if (state.scheduledEventResultId === event.id) state.scheduledEventResultId = '';
        __tmScheduledRerenderSettings();
    };
