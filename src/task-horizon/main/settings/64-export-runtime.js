    function __tmExcelSanitizeFileName(name) {
        const raw = String(name || '').trim();
        const safe = raw.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
        return safe || '任务管理器_表格导出';
    }

    function __tmExcelDateStamp() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }

    function __tmExcelResolveExportFileBaseName() {
        const activeDocId = String(state.activeDocId || '').trim();
        if (activeDocId && activeDocId !== 'all' && !__tmIsOtherBlockTabId(activeDocId)) {
            const docName = String(__tmGetDocDisplayName(activeDocId, '') || '').trim();
            if (docName) return docName;
        }
        return '任务管理器';
    }

    function __tmExcelGetNoHeadingLabel() {
        const headingLevel = String(SettingsStore.data.taskHeadingLevel || 'h2').trim() || 'h2';
        const headingLabelMap = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
        return `无${headingLabelMap[headingLevel] || '标题'}`;
    }

    const TM_SETTINGS_EXPORT_SCHEMA = 'task-horizon-settings-export';
    const TM_SETTINGS_EXPORT_VERSION = 1;
    const TM_SETTINGS_EXPORT_MODULES = Object.freeze([
        { id: 'settings', label: '常规设置', desc: '常规、外观、规则、状态、自定义字段、视图布局、白板、优先级等。', defaultChecked: true },
        { id: 'docGroups', label: '文档分组', desc: '文档分组、默认文档、排除文档、文档颜色、页签排序/钉住等。', defaultChecked: true },
        { id: 'ai', label: 'AI 接入设置', desc: 'AI 供应商、API Key、Base URL、模型、上下文与排期窗口。', defaultChecked: false },
        { id: 'aiData', label: 'AI 会话/提示词', desc: 'AI 提示词模板与会话记录。', defaultChecked: false },
        { id: 'calendar', label: '日历设置/日程', desc: '日历配置与用户自建日程。', defaultChecked: true },
        { id: 'calendarOffline', label: '节假日/农历缓存', desc: '去年、今年、明年范围内真实可用的节假日/农历缓存。', defaultChecked: true },
    ]);
    const TM_DOC_GROUP_SETTING_KEYS = Object.freeze([
        'selectedDocIds',
        'docGroups',
        'docTabCustomGroups',
        'otherBlockRefs',
        'docPinnedByGroup',
        'docTabSortMode',
        'docDisplayNameMode',
        'currentGroupId',
        'defaultDocId',
        'defaultDocIdByGroup',
        'allDocsExcludedDocIds',
        'newTaskDocId',
        'newTaskDailyNoteNotebookId',
        'newTaskDailyNoteAppendToBottom',
        'quickAddRecentDocs',
        'docColorMap',
        'docColorSeed',
        'docDefaultColorScheme',
        'serverSyncOnManualRefresh',
        'serverSyncSessionStateOnManualRefresh',
    ]);
    const TM_AI_SETTING_KEYS = Object.freeze([
        'aiEnabled',
        'aiProvider',
        'aiMiniMaxApiKey',
        'aiMiniMaxBaseUrl',
        'aiMiniMaxModel',
        'aiDeepSeekApiKey',
        'aiDeepSeekBaseUrl',
        'aiDeepSeekModel',
        'aiOpenAIApiKey',
        'aiOpenAIBaseUrl',
        'aiOpenAIModel',
        'aiAnthropicApiKey',
        'aiAnthropicBaseUrl',
        'aiAnthropicModel',
        'aiMiniMaxTemperature',
        'aiMiniMaxMaxTokens',
        'aiMiniMaxTimeoutMs',
        'aiDefaultContextMode',
        'aiScheduleWindows',
        'aiSideDockEnabled',
    ]);
    const TM_CALENDAR_SETTING_KEYS = Object.freeze([
        'calendarEnabled',
        'calendarLinkDockTomato',
        'calendarInitialView',
        'calendarInitialViewDesktop',
        'calendarInitialViewMobile',
        'calendarFirstDay',
        'calendarMonthAggregate',
        'calendarMonthAdaptiveRowHeight',
        'calendarMonthMinVisibleEvents',
        'calendarShowSchedule',
        'calendarScheduleReminderEnabled',
        'calendarScheduleReminderSystemEnabled',
        'calendarScheduleReminderDefaultMode',
        'calendarAllDayReminderEnabled',
        'calendarAllDayReminderTime',
        'calendarTaskDateAllDayReminderEnabled',
        'calendarAllDaySummaryIncludeExtras',
        'calendarShowFocus',
        'calendarShowBreak',
        'calendarShowStopwatch',
        'calendarShowIdle',
        'calendarColorFocus',
        'calendarColorBreak',
        'calendarColorStopwatch',
        'calendarColorIdle',
        'calendarCalendarsConfig',
        'calendarDefaultCalendarId',
        'calendarLastViewType',
        'calendarLastDate',
        'calendarSidebarWidth',
        'calendarSidebarDefaultPage',
        'calendarSidebarCollapsedDesktopDefault',
        'calendarColumnWidths',
        'calendarSidebarCollapseCalendars',
        'calendarSidebarCollapseDocGroups',
        'calendarSidebarCollapseTomato',
        'calendarSidebarCollapseTasks',
        'calendarShowTomatoMaster',
        'calendarShowTaskReminders',
        'calendarShowTaskDates',
        'calendarHideScheduledTaskDatesInAllDay',
        'calendarShowCompletedAllDaySchedules',
        'calendarShowOtherBlockCheckbox',
        'calendarTaskDateColorMode',
        'calendarScheduleDatesFollowSchedule',
        'calendarScheduleFollowDocColor',
        'calendar3DayTodayPosition',
        'calendarNewScheduleMaxDurationMin',
        'calendarQuickAddScheduleTimeMode',
        'calendarQuickAddScheduleCustomTime',
        'calendarHourSlotHeightMode',
        'calendarVisibleStartTime',
        'calendarVisibleEndTime',
        'calendarScheduleColor',
        'calendarTaskDatesColor',
        'calendarTodayHighlightColorLight',
        'calendarTodayHighlightColorDark',
        'calendarGridBorderColorLight',
        'calendarGridBorderColorDark',
        'calendarShowCnHoliday',
        'calendarCnHolidayColor',
        'calendarShowLunar',
        'calendarSideDockEnabled',
        'calendarSideDockWidth',
    ]);
    const TM_SETTINGS_EXPORT_EXCLUDED_KEYS = new Set([
        'settingsUpdatedAt',
        'settingsFieldUpdatedAt',
        'docGroupSettingsUpdatedAt',
        'collapseStateUpdatedAt',
        ...TM_DOC_GROUP_SETTING_KEYS,
        ...TM_AI_SETTING_KEYS,
        ...TM_CALENDAR_SETTING_KEYS,
    ]);

    function __tmCloneMigrationValue(value, fallback = null) {
        try { return JSON.parse(JSON.stringify(value)); } catch (e) { return fallback; }
    }

    function __tmPickSettingsKeys(keys) {
        const out = {};
        (Array.isArray(keys) ? keys : []).forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(SettingsStore.data || {}, key)) return;
            out[key] = __tmCloneMigrationValue(SettingsStore.data[key], SettingsStore.data[key]);
        });
        return out;
    }

    function __tmBuildGeneralSettingsMigrationData() {
        const out = {};
        Object.keys(SettingsStore.data || {}).forEach((key) => {
            if (TM_SETTINGS_EXPORT_EXCLUDED_KEYS.has(key)) return;
            out[key] = __tmCloneMigrationValue(SettingsStore.data[key], SettingsStore.data[key]);
        });
        return out;
    }

    function __tmMergeArrayById(current, incoming) {
        const map = new Map();
        const push = (item) => {
            const src = (item && typeof item === 'object') ? item : null;
            const id = String(src?.id || '').trim();
            if (!src || !id) return;
            map.set(id, __tmCloneMigrationValue(src, src));
        };
        (Array.isArray(current) ? current : []).forEach(push);
        (Array.isArray(incoming) ? incoming : []).forEach(push);
        return Array.from(map.values());
    }

    function __tmMergeStringArray(current, incoming) {
        return Array.from(new Set([
            ...(Array.isArray(current) ? current : []),
            ...(Array.isArray(incoming) ? incoming : []),
        ].map((item) => String(item || '').trim()).filter(Boolean)));
    }

    function __tmApplyMigrationSettingsPatch(patch, mode) {
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return;
        Object.entries(patch).forEach(([key, value]) => {
            if (!key) return;
            if (mode === 'docGroups') {
                if (key === 'docGroups') {
                    SettingsStore.data.docGroups = __tmMergeArrayById(SettingsStore.data.docGroups, value);
                    return;
                }
                if (key === 'selectedDocIds' || key === 'allDocsExcludedDocIds') {
                    SettingsStore.data[key] = __tmMergeStringArray(SettingsStore.data[key], value);
                    return;
                }
                if (key === 'quickAddRecentDocs') {
                    SettingsStore.data[key] = __tmMergeArrayById(SettingsStore.data[key], value).slice(0, 6);
                    return;
                }
                if (key === 'docColorMap' || key === 'defaultDocIdByGroup' || key === 'docPinnedByGroup') {
                    SettingsStore.data[key] = {
                        ...(SettingsStore.data[key] && typeof SettingsStore.data[key] === 'object' ? SettingsStore.data[key] : {}),
                        ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
                    };
                    return;
                }
            }
            if (Array.isArray(value)) {
                const hasIds = value.some((item) => item && typeof item === 'object' && String(item.id || '').trim());
                if (hasIds) {
                    SettingsStore.data[key] = __tmMergeArrayById(SettingsStore.data[key], value);
                    return;
                }
            }
            SettingsStore.data[key] = __tmCloneMigrationValue(value, value);
        });
    }

    function __tmGetHolidayMigrationYears() {
        const y = new Date().getFullYear();
        return [y - 1, y, y + 1];
    }

    function __tmBuildSettingsMigrationSummary(modules = {}) {
        const m = modules && typeof modules === 'object' ? modules : {};
        const holidays = m.calendarOffline?.calendarData?.holidayStatuses || [];
        return {
            settingsKeys: m.settings?.settings ? Object.keys(m.settings.settings).length : 0,
            docGroups: Array.isArray(m.docGroups?.settings?.docGroups) ? m.docGroups.settings.docGroups.length : 0,
            aiIncluded: !!m.ai,
            aiConversations: Number(m.aiData?.summary?.conversations || 0),
            aiPromptTemplates: Number(m.aiData?.summary?.promptTemplates || 0),
            schedules: Number(m.calendar?.calendarData?.summary?.schedules || 0),
            holidayYears: Number(m.calendarOffline?.calendarData?.summary?.holidayYears || 0),
            holidayMissingYears: Array.isArray(m.calendarOffline?.calendarData?.summary?.holidayMissingYears) ? m.calendarOffline.calendarData.summary.holidayMissingYears : [],
            holidayStatuses: Array.isArray(m.calendarOffline?.calendarData?.holidayStatuses) ? m.calendarOffline.calendarData.holidayStatuses : holidays,
        };
    }

    function __tmFilterSettingsMigrationModules(payload, selected = null) {
        const modules = payload?.modules && typeof payload.modules === 'object' ? payload.modules : {};
        if (!(selected instanceof Set)) return modules;
        const out = {};
        Object.entries(modules).forEach(([key, value]) => {
            if (selected.has(key)) out[key] = value;
        });
        return out;
    }

    function __tmSettingsMigrationStatusText(status) {
        const s = String(status || '').trim();
        if (s === 'refreshed') return '已刷新';
        if (s === 'cached') return '已缓存';
        if (s === 'missing') return '缺失';
        return s || '未知';
    }

    function __tmDownloadTextFile(filename, content, mimeType = 'application/json') {
        const blob = new Blob([String(content || '')], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function __tmEnsureMigrationAiRuntime() {
        if (globalThis.__tmAI?.loaded) return true;
        try {
            if (typeof __tmEnsureAiRuntimeLoaded === 'function') return await __tmEnsureAiRuntimeLoaded();
        } catch (e) {}
        return !!globalThis.__tmAI?.loaded;
    }

    async function __tmBuildSettingsMigrationPackage(selectedModules) {
        const selected = new Set(Array.isArray(selectedModules) ? selectedModules : []);
        if (!selected.size) throw new Error('请至少选择一个导出模块');
        if (typeof __tmEnsureSettingsLoaded === 'function') {
            try { await __tmEnsureSettingsLoaded(false); } catch (e) {}
        }
        const modules = {};
        if (selected.has('settings')) {
            modules.settings = { settings: __tmBuildGeneralSettingsMigrationData() };
        }
        if (selected.has('docGroups')) {
            modules.docGroups = { settings: __tmPickSettingsKeys(TM_DOC_GROUP_SETTING_KEYS) };
        }
        if (selected.has('ai')) {
            modules.ai = { settings: __tmPickSettingsKeys(TM_AI_SETTING_KEYS), includesApiKeys: true };
        }
        if (selected.has('calendar')) {
            const calendarData = globalThis.__tmCalendar?.exportMigrationData
                ? await globalThis.__tmCalendar.exportMigrationData({ includeSchedule: true, includeHolidays: false })
                : { schedules: [], summary: { schedules: 0 } };
            modules.calendar = {
                settings: __tmPickSettingsKeys(TM_CALENDAR_SETTING_KEYS),
                calendarData,
            };
        }
        if (selected.has('calendarOffline')) {
            const years = __tmGetHolidayMigrationYears();
            const calendarData = globalThis.__tmCalendar?.exportMigrationData
                ? await globalThis.__tmCalendar.exportMigrationData({
                    includeSchedule: false,
                    includeHolidays: true,
                    holidayYears: years,
                    refreshCurrentYear: true,
                })
                : {
                    cnHolidays: {},
                    holidayStatuses: years.map((year) => ({ year, status: 'missing', count: 0 })),
                    summary: { holidayYears: 0, holidayMissingYears: years },
                };
            modules.calendarOffline = { calendarData };
        }
        if (selected.has('aiData')) {
            const ready = await __tmEnsureMigrationAiRuntime();
            modules.aiData = ready && globalThis.__tmAI?.exportMigrationData
                ? await globalThis.__tmAI.exportMigrationData()
                : { conversations: { activeId: '', conversations: [] }, promptTemplates: { templates: [] }, summary: { conversations: 0, promptTemplates: 0 } };
        }
        const payload = {
            schema: TM_SETTINGS_EXPORT_SCHEMA,
            version: TM_SETTINGS_EXPORT_VERSION,
            exportedAt: new Date().toISOString(),
            pluginVersion: String(globalThis?.siyuan?.plugins?.find?.((p) => p?.name === 'siyuan-plugin-task-horizon')?.version || ''),
            modules,
        };
        payload.summary = __tmBuildSettingsMigrationSummary(modules);
        return payload;
    }

    function __tmRenderMigrationModuleOptions(prefix, defaults = null) {
        const selected = defaults instanceof Set ? defaults : null;
        return TM_SETTINGS_EXPORT_MODULES.map((mod) => {
            const checked = selected ? selected.has(mod.id) : mod.defaultChecked;
            const warning = mod.id === 'ai'
                ? '<div style="font-size:12px;color:var(--tm-danger-color);line-height:1.5;margin-top:3px;">包含 API Key，设置包为明文 JSON。</div>'
                : '';
            return `
                <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--tm-border-color);border-radius:8px;background:var(--tm-card-bg);cursor:pointer;">
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-migration-module="${esc(mod.id)}" ${checked ? 'checked' : ''} style="margin-top:2px;">
                    <span style="display:block;min-width:0;">
                        <span style="display:block;font-weight:600;color:var(--tm-text-color);">${esc(mod.label)}</span>
                        <span style="display:block;font-size:12px;color:var(--tm-secondary-text);line-height:1.5;margin-top:3px;">${esc(mod.desc)}</span>
                        ${warning}
                    </span>
                </label>
            `;
        }).join('');
    }

    function __tmRenderMigrationSummary(payload, selected = null) {
        const visibleModules = __tmFilterSettingsMigrationModules(payload, selected);
        const summary = __tmBuildSettingsMigrationSummary(visibleModules);
        const moduleIds = Object.keys(payload?.modules || {});
        const selectedSet = selected instanceof Set ? selected : new Set(moduleIds);
        const labels = TM_SETTINGS_EXPORT_MODULES
            .filter((mod) => moduleIds.includes(mod.id))
            .map((mod) => `${selectedSet.has(mod.id) ? '✓' : '○'} ${mod.label}`)
            .join(' · ');
        const holidayStatuses = Array.isArray(summary.holidayStatuses) ? summary.holidayStatuses : [];
        const holidayText = holidayStatuses.length
            ? holidayStatuses.map((it) => `${it.year}:${__tmSettingsMigrationStatusText(it.status)}`).join('，')
            : '无';
        return `
            <div style="padding:10px 12px;border:1px solid var(--tm-border-color);border-radius:8px;background:var(--tm-card-bg);font-size:12px;line-height:1.8;color:var(--tm-secondary-text);">
                <div style="color:var(--tm-text-color);font-weight:600;margin-bottom:4px;">设置包摘要</div>
                <div>导出时间：${esc(String(payload?.exportedAt || '未知'))}</div>
                <div>模块：${esc(labels || '无')}</div>
                <div>文档分组：${Number(summary.docGroups || 0)} 个 · AI 会话：${Number(summary.aiConversations || 0)} 个 · 提示词：${Number(summary.aiPromptTemplates || 0)} 个</div>
                <div>日程：${Number(summary.schedules || 0)} 条 · 节假日年份：${Number(summary.holidayYears || 0)} 个（${esc(holidayText)}）</div>
                <div style="margin-top:4px;color:var(--tm-warning-color, #f9ab00);">节假日调休通常只有最近一年较可靠，缺失年份不会生成空数据。</div>
            </div>
        `;
    }

    window.tmOpenSettingsExportDialog = function() {
        const modal = document.createElement('div');
        modal.className = 'tm-prompt-modal';
        modal.innerHTML = `
            <div class="tm-prompt-box" style="max-width:640px;width:min(92vw,640px);">
                <h3 style="margin-bottom:8px;">导出设置包</h3>
                <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.7;margin-bottom:12px;">
                    选择要导出的内容。设置包是明文 JSON；勾选 AI 接入设置时会包含 API Key。
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;margin-bottom:12px;">
                    ${__tmRenderMigrationModuleOptions('export')}
                </div>
                <div style="padding:10px 12px;border:1px solid rgba(249,171,0,0.35);background:rgba(249,171,0,0.10);border-radius:8px;font-size:12px;line-height:1.7;color:var(--tm-text-color);">
                    节假日/农历会检查去年、今年、明年；只导出已有缓存或成功刷新到的真实数据。
                </div>
                <div data-tm-migration-export-summary style="display:none;margin-top:12px;"></div>
                <div class="tm-prompt-buttons" style="margin-top:14px;">
                    <button class="tm-prompt-btn tm-prompt-btn-secondary" data-tm-migration-cancel>取消</button>
                    <button class="tm-prompt-btn tm-prompt-btn-primary" data-tm-migration-export>导出</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        try { __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-prompt-box')); } catch (e) {}
        let removeFromStack = () => {};
        const close = () => {
            removeFromStack();
            try { modal.remove(); } catch (e) {}
        };
        removeFromStack = __tmModalStackBind(close);
        modal.addEventListener('click', async (event) => {
            if (event.target === modal || event.target?.closest?.('[data-tm-migration-cancel]')) {
                close();
                return;
            }
            if (!event.target?.closest?.('[data-tm-migration-export]')) return;
            const btn = event.target.closest('[data-tm-migration-export]');
            const selected = Array.from(modal.querySelectorAll('[data-tm-migration-module]:checked'))
                .map((input) => String(input.getAttribute('data-tm-migration-module') || '').trim())
                .filter(Boolean);
            try {
                btn.disabled = true;
                btn.textContent = '正在导出...';
                const payload = await __tmBuildSettingsMigrationPackage(selected);
                const stamp = new Date().toISOString().slice(0, 10);
                __tmDownloadTextFile(`task-horizon-settings-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
                const summaryEl = modal.querySelector('[data-tm-migration-export-summary]');
                if (summaryEl) {
                    summaryEl.style.display = '';
                    summaryEl.innerHTML = __tmRenderMigrationSummary(payload, new Set(selected));
                }
                hint('✅ 设置包已导出', 'success');
                btn.disabled = false;
                btn.textContent = '再次导出';
                const cancelBtn = modal.querySelector('[data-tm-migration-cancel]');
                if (cancelBtn) cancelBtn.textContent = '关闭';
            } catch (e) {
                hint(`❌ 导出失败：${String(e?.message || e || '')}`, 'error');
                btn.disabled = false;
                btn.textContent = '导出';
            }
        });
    };

    function __tmParseSettingsImportFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try { resolve(JSON.parse(String(reader.result || ''))); }
                catch (e) { reject(new Error('设置包不是合法 JSON')); }
            };
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsText(file, 'utf-8');
        });
    }

    async function __tmApplySettingsMigrationPackage(payload, selectedModules) {
        const selected = new Set(Array.isArray(selectedModules) ? selectedModules : []);
        const modules = payload?.modules || {};
        if (selected.has('settings')) __tmApplyMigrationSettingsPatch(modules.settings?.settings, 'settings');
        if (selected.has('docGroups')) __tmApplyMigrationSettingsPatch(modules.docGroups?.settings, 'docGroups');
        if (selected.has('ai')) __tmApplyMigrationSettingsPatch(modules.ai?.settings, 'ai');
        if (selected.has('calendar')) {
            __tmApplyMigrationSettingsPatch(modules.calendar?.settings, 'calendar');
            if (modules.calendar?.calendarData && globalThis.__tmCalendar?.importMigrationData) {
                await globalThis.__tmCalendar.importMigrationData(modules.calendar.calendarData);
            }
        }
        if (selected.has('calendarOffline') && modules.calendarOffline?.calendarData && globalThis.__tmCalendar?.importMigrationData) {
            await globalThis.__tmCalendar.importMigrationData(modules.calendarOffline.calendarData);
        }
        if (selected.has('aiData')) {
            const ready = await __tmEnsureMigrationAiRuntime();
            if (ready && globalThis.__tmAI?.importMigrationData) {
                await globalThis.__tmAI.importMigrationData(modules.aiData || {});
            }
        }
        SettingsStore.normalizeColumns?.();
        SettingsStore.syncToLocal?.();
        SettingsStore.saveDirty = true;
        if (typeof SettingsStore.saveNow === 'function') await SettingsStore.saveNow();
        else await SettingsStore.save();
        try { render(); } catch (e) {}
        try { if (state.settingsModal) showSettings(); } catch (e) {}
        try { globalThis.__tmCalendar?.refreshInPlace?.({ hard: true }); } catch (e) {}
    }

    window.tmOpenSettingsImportDialog = function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = async () => {
            const file = input.files && input.files[0];
            try { input.remove(); } catch (e) {}
            if (!file) return;
            let payload = null;
            try {
                payload = await __tmParseSettingsImportFile(file);
                if (!payload || payload.schema !== TM_SETTINGS_EXPORT_SCHEMA || !payload.modules || typeof payload.modules !== 'object') {
                    throw new Error('这不是任务管理器设置包');
                }
            } catch (e) {
                hint(`❌ 读取失败：${String(e?.message || e || '')}`, 'error');
                return;
            }
            const moduleIds = Object.keys(payload.modules || {});
            const selected = new Set(moduleIds);
            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';
            modal.innerHTML = `
                <div class="tm-prompt-box" style="max-width:680px;width:min(92vw,680px);">
                    <h3 style="margin-bottom:8px;">导入设置包</h3>
                    <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.7;margin-bottom:12px;">
                        先确认要导入的模块。导入会与当前配置合并；同 ID 的分组、日程、提示词和会话以设置包为准。
                    </div>
                    <div data-tm-migration-summary style="margin-bottom:12px;">${__tmRenderMigrationSummary(payload, selected)}</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;margin-bottom:12px;">
                        ${TM_SETTINGS_EXPORT_MODULES.filter((mod) => moduleIds.includes(mod.id)).map((mod) => `
                            <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--tm-border-color);border-radius:8px;background:var(--tm-card-bg);cursor:pointer;">
                                <input class="b3-switch fn__flex-center" type="checkbox" data-tm-migration-module="${esc(mod.id)}" checked style="margin-top:2px;">
                                <span style="display:block;min-width:0;">
                                    <span style="display:block;font-weight:600;">${esc(mod.label)}</span>
                                    <span style="display:block;font-size:12px;color:var(--tm-secondary-text);line-height:1.5;margin-top:3px;">${esc(mod.desc)}</span>
                                </span>
                            </label>
                        `).join('')}
                    </div>
                    <div class="tm-prompt-buttons" style="margin-top:14px;">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" data-tm-migration-cancel>取消</button>
                        <button class="tm-prompt-btn tm-prompt-btn-primary" data-tm-migration-import>确认导入</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            try { __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-prompt-box')); } catch (e) {}
            let removeFromStack = () => {};
            const close = () => {
                removeFromStack();
                try { modal.remove(); } catch (e) {}
            };
            removeFromStack = __tmModalStackBind(close);
            const refreshSummary = () => {
                const current = new Set(Array.from(modal.querySelectorAll('[data-tm-migration-module]:checked')).map((el) => String(el.getAttribute('data-tm-migration-module') || '').trim()).filter(Boolean));
                const summaryEl = modal.querySelector('[data-tm-migration-summary]');
                if (summaryEl) summaryEl.innerHTML = __tmRenderMigrationSummary(payload, current);
            };
            modal.addEventListener('change', refreshSummary);
            modal.addEventListener('click', async (event) => {
                if (event.target === modal || event.target?.closest?.('[data-tm-migration-cancel]')) {
                    close();
                    return;
                }
                if (!event.target?.closest?.('[data-tm-migration-import]')) return;
                const btn = event.target.closest('[data-tm-migration-import]');
                const selectedModules = Array.from(modal.querySelectorAll('[data-tm-migration-module]:checked'))
                    .map((el) => String(el.getAttribute('data-tm-migration-module') || '').trim())
                    .filter(Boolean);
                if (!selectedModules.length) {
                    hint('⚠ 请至少选择一个导入模块', 'warning');
                    return;
                }
                try {
                    btn.disabled = true;
                    btn.textContent = '正在导入...';
                    await __tmApplySettingsMigrationPackage(payload, selectedModules);
                    hint('✅ 设置包已导入', 'success');
                    close();
                } catch (e) {
                    hint(`❌ 导入失败：${String(e?.message || e || '')}`, 'error');
                    btn.disabled = false;
                    btn.textContent = '确认导入';
                }
            });
        };
        input.click();
    };

    function __tmResolveXlsxRuntime() {
        const candidates = [
            globalThis.XLSX,
            (typeof window !== 'undefined' ? window.XLSX : null),
            globalThis.exports,
            globalThis.module?.exports,
            (typeof window !== 'undefined' ? window.exports : null),
            (typeof window !== 'undefined' ? window.module?.exports : null),
        ];
        for (const candidate of candidates) {
            if (candidate && candidate.utils && (typeof candidate.writeFile === 'function' || typeof candidate.writeFileXLSX === 'function')) {
                try {
                    if (!globalThis.XLSX) globalThis.XLSX = candidate;
                    if (typeof window !== 'undefined' && !window.XLSX) window.XLSX = candidate;
                } catch (e) {}
                return candidate;
            }
        }
        return null;
    }

    async function __tmEnsureXlsxRuntimeLoaded() {
        let runtime = __tmResolveXlsxRuntime();
        if (runtime) return runtime;
        const loader = globalThis.__taskHorizonEnsureXlsxModuleLoaded;
        if (typeof loader === 'function') {
            try { await loader(); } catch (e) {}
        }
        runtime = __tmResolveXlsxRuntime();
        return runtime || null;
    }

    function __tmExcelResolveStatusName(task) {
        const currentStatus = __tmResolveTaskStatusId(task);
        const statusOptions = __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
        const statusOption = statusOptions.find((item) => String(item?.id || '').trim() === currentStatus);
        return String(statusOption?.name || currentStatus || '').trim();
    }

    function __tmExcelParseDateCell(value) {
        const normalized = __tmFormatTaskTime(value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
        const parts = normalized.split('-').map((item) => Number(item));
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
        const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function __tmExcelGetVisibleRootTask(task, taskMap) {
        let current = task;
        const seen = new Set();
        while (current) {
            const currentId = String(current?.id || '').trim();
            const parentId = String(current?.parentTaskId || '').trim();
            if (!parentId || seen.has(parentId)) return current;
            seen.add(parentId);
            const parent = taskMap.get(parentId);
            if (!parent) return current;
            current = parent;
            if (!currentId) return current;
        }
        return task;
    }

    function __tmGetTaskRemainingTimeInfo(task, options = {}) {
        const DAY_MS = 24 * 60 * 60 * 1000;
        const parseToLocalDayBoundaryTs = (value, boundary = 'start') => {
            const normalized = __tmNormalizeDateOnly(value);
            if (normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
                const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
                if (match) {
                    const dt = boundary === 'end'
                        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 0, 0)
                        : new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
                    const ts = dt.getTime();
                    return Number.isFinite(ts) ? ts : 0;
                }
            }
            const parsedTs = __tmParseTimeToTs(value);
            if (!Number.isFinite(parsedTs) || parsedTs <= 0) return 0;
            const parsed = new Date(parsedTs);
            const dt = boundary === 'end'
                ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 0, 0)
                : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
            const ts = dt.getTime();
            return Number.isFinite(ts) ? ts : 0;
        };
        const nowTs = Number.isFinite(Number(options?.nowTs)) ? Number(options.nowTs) : Date.now();
        const nowDate = new Date(nowTs);
        const todayStartTs = Number.isFinite(Number(options?.todayStartTs))
            ? Number(options.todayStartTs)
            : new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0).getTime();
        const calcDayDiff = (targetDayStartTs) => {
            if (!Number.isFinite(targetDayStartTs) || targetDayStartTs <= 0) return Infinity;
            return Math.round((targetDayStartTs - todayStartTs) / DAY_MS);
        };
        const makeInfo = (label, color, sortPrefix, emphasis = false) => ({
            label: String(label || '').trim() || '待定',
            color: String(color || 'var(--tm-secondary-text)').trim() || 'var(--tm-secondary-text)',
            sortPrefix: String(sortPrefix || '8').trim() || '8',
            emphasis: !!emphasis,
        });
        const colors = {
            overdue: __tmIsDarkMode()
                ? (__tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b') || '#ff6b6b')
                : (__tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025') || '#d93025'),
            done: '#4CAF50',
            active: '#5fc25f',
            activeStrong: '#05ba05',
            waiting: '#999999',
            pending: '#8e69c9',
        };
        if (task?.done === true) return makeInfo('完成', colors.done, '9');

        const startStartTs = parseToLocalDayBoundaryTs(task?.startDate, 'start');
        const startEndTs = parseToLocalDayBoundaryTs(task?.startDate, 'end');
        const endStartTs = parseToLocalDayBoundaryTs(task?.completionTime, 'start');
        const endEndTs = parseToLocalDayBoundaryTs(task?.completionTime, 'end');
        const hasStart = Number.isFinite(startStartTs) && startStartTs > 0;
        const hasEnd = Number.isFinite(endEndTs) && endEndTs > 0;

        if (hasEnd) {
            if (hasStart && nowTs < startStartTs) {
                const daysUntilStart = calcDayDiff(startStartTs);
                if (daysUntilStart <= 0) return makeInfo('开始', colors.active, '2', true);
                if (daysUntilStart === 1) return makeInfo('明天→', colors.waiting, '4');
                if (daysUntilStart === 2) return makeInfo('后天→', colors.waiting, '5');
                if (daysUntilStart <= 7) return makeInfo(`${daysUntilStart}天后→`, colors.waiting, '6');
                return makeInfo(`${daysUntilStart}天后→`, colors.waiting, '7');
            }
            const remainingDays = calcDayDiff(endStartTs);
            if (remainingDays < 0 || nowTs > endEndTs) return makeInfo('过期', colors.overdue, '1', true);
            if (remainingDays === 0) return makeInfo('今天', colors.activeStrong, '1', true);
            if (remainingDays <= 7) return makeInfo(`余${remainingDays}天`, colors.active, '1', true);
            return makeInfo(`余${remainingDays}天`, colors.active, '1');
        }

        if (hasStart) {
            if (nowTs > startEndTs) return makeInfo('开始', colors.active, '2', true);
            const daysUntilStart = calcDayDiff(startStartTs);
            if (daysUntilStart <= 0) return makeInfo('今天', colors.activeStrong, '1', true);
            if (daysUntilStart === 1) return makeInfo('明天→', colors.waiting, '4');
            if (daysUntilStart === 2) return makeInfo('后天→', colors.waiting, '5');
            if (daysUntilStart <= 7) return makeInfo(`${daysUntilStart}天后→`, colors.waiting, '6');
            return makeInfo(`${daysUntilStart}天后→`, colors.waiting, '7');
        }

        return makeInfo('待定', colors.pending, '8');
    }

    function __tmRenderTaskRemainingTimeInfoHtml(info) {
        const item = (info && typeof info === 'object') ? info : null;
        const label = String(item?.label || '待定').trim() || '待定';
        const color = String(item?.color || 'var(--tm-secondary-text)').trim() || 'var(--tm-secondary-text)';
        const sortPrefix = String(item?.sortPrefix || '8').trim() || '8';
        const weight = item?.emphasis ? '700' : '500';
        return `<span style="display:none;">${esc(sortPrefix)}</span><span style="color:${esc(color)};font-weight:${weight};">${esc(label)}</span>`;
    }

    function __tmRenderTaskRemainingTimeHtml(task, options = {}) {
        return __tmRenderTaskRemainingTimeInfoHtml(__tmGetTaskRemainingTimeInfo(task, options));
    }

    function __tmGetTaskRemainingTimeLabel(task, options = {}) {
        return __tmGetTaskRemainingTimeInfo(task, options).label;
    }

    function __tmExcelGetTimeGroupLabel(task) {
        const info = __tmGetTaskTimePriorityInfo(task);
        const diffDays = Number(info?.diffDays);
        if (!Number.isFinite(diffDays)) return '待定';
        if (diffDays < 0) return '已过期';
        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '明天';
        if (diffDays === 2) return '后天';
        if (diffDays >= 16) return '更远';
        return `余${diffDays}天`;
    }

    function __tmExcelGetQuadrantGroupLabel(task) {
        const quadrantRules = (SettingsStore.data.quadrantConfig && SettingsStore.data.quadrantConfig.rules) || [];
        const priority = String(task?.priority || '').toLowerCase();
        const importance = (priority === 'a' || priority === '高' || priority === 'high')
            ? 'high'
            : ((priority === 'b' || priority === '中' || priority === 'medium')
                ? 'medium'
                : ((priority === 'c' || priority === '低' || priority === 'low') ? 'low' : 'none'));
        const diffDays = Number(__tmGetTaskTimePriorityInfo(task)?.diffDays);
        const timeRange = !Number.isFinite(diffDays)
            ? 'nodate'
            : (diffDays < 0 ? 'overdue' : (diffDays <= 7 ? 'within7days' : (diffDays <= 15 ? 'within15days' : (diffDays <= 30 ? 'within30days' : 'beyond30days'))));
        for (const rule of quadrantRules) {
            const importanceMatch = Array.isArray(rule?.importance) && rule.importance.includes(importance);
            let timeRangeMatch = Array.isArray(rule?.timeRanges) && rule.timeRanges.includes(timeRange);
            if (!timeRangeMatch && Array.isArray(rule?.timeRanges)) {
                for (const range of rule.timeRanges) {
                    if (!String(range || '').startsWith('beyond') || range === 'beyond30days') continue;
                    const days = parseInt(String(range).replace('beyond', '').replace('days', ''), 10);
                    if (!Number.isNaN(days) && diffDays > days) {
                        timeRangeMatch = true;
                        break;
                    }
                }
            }
            if (importanceMatch && timeRangeMatch) return String(rule?.name || '').trim();
        }
        return '';
    }

    function __tmExcelGetGroupLabel(task, rootTask) {
        const root = rootTask || task;
        if (!root) return '';
        if (state.groupByDocName) {
            const labels = [String(root.docName || root.rawDocName || '').trim() || '未命名文档'];
            if (SettingsStore.data.docH2SubgroupEnabled !== false) {
                const bucket = __tmGetDocHeadingBucket(root, __tmExcelGetNoHeadingLabel());
                const headingLabel = String(bucket?.label || '').trim();
                if (headingLabel) labels.push(headingLabel);
            }
            return labels.filter(Boolean).join(' / ');
        }
        if (state.groupByTime) return __tmExcelGetTimeGroupLabel(root);
        if (state.quadrantEnabled) return __tmExcelGetQuadrantGroupLabel(root);
        if (state.groupByTaskName) return String(root.content || '').trim();
        return root?.pinned ? '置顶' : '';
    }

    function __tmExcelGetExportColumnDefs() {
        const headingLevel = String(SettingsStore.data.taskHeadingLevel || 'h2').trim() || 'h2';
        const headingLabels = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
        const seenColumnKeys = new Set();
        const columnOrder = [];
        const knownColumnKeys = typeof __tmGetKnownColumnKeys === 'function' ? __tmGetKnownColumnKeys() : null;
        const appendColumnKeys = (keys) => {
            (Array.isArray(keys) ? keys : []).forEach((key) => {
                const colKey = String(key || '').trim();
                if (!colKey || seenColumnKeys.has(colKey) || (knownColumnKeys && !knownColumnKeys.has(colKey))) return;
                seenColumnKeys.add(colKey);
                columnOrder.push(colKey);
            });
        };
        appendColumnKeys(Array.isArray(SettingsStore.data.columnOrder) ? SettingsStore.data.columnOrder : []);
        appendColumnKeys(__tmGetDefaultColumnOrder());
        const widthMap = (SettingsStore.data.columnWidths && typeof SettingsStore.data.columnWidths === 'object') ? SettingsStore.data.columnWidths : {};
        const pxToWch = (px, fallback) => {
            const n = Number(px);
            if (!Number.isFinite(n) || n <= 0) return fallback;
            return Math.max(8, Math.min(80, Math.round(n / 8)));
        };
        const defs = {
            pinned: {
                key: 'pinned',
                label: '置顶',
                wch: 6,
                value: (task) => task?.pinned ? '是' : ''
            },
            content: {
                key: 'content',
                label: '任务内容',
                wch: pxToWch(widthMap.content, 36),
                value: (task) => String(task?.content || '').trim()
            },
            status: {
                key: 'status',
                label: '状态',
                wch: pxToWch(widthMap.status, 12),
                value: (task) => __tmExcelResolveStatusName(task)
            },
            score: {
                key: 'score',
                label: '优先级分',
                wch: pxToWch(widthMap.score, 12),
                value: (task) => Math.round(__tmEnsureTaskPriorityScore(task))
            },
            doc: {
                key: 'doc',
                label: '文档',
                wch: pxToWch(widthMap.doc, 22),
                value: (task) => String(task?.docName || task?.rawDocName || '').trim()
            },
            h2: {
                key: 'h2',
                label: headingLabels[headingLevel] || '标题',
                wch: pxToWch(widthMap.h2, 22),
                value: (task) => __tmNormalizeHeadingText(task?.h2)
            },
            priority: {
                key: 'priority',
                label: '重要性',
                wch: pxToWch(widthMap.priority, 10),
                value: (task) => String(__tmGetPriorityJiraInfo(task?.priority)?.label || '').trim()
            },
            startDate: {
                key: 'startDate',
                label: '开始日期',
                kind: 'date',
                wch: pxToWch(widthMap.startDate, 14),
                value: (task) => String(task?.startDate || '').trim()
            },
            completionTime: {
                key: 'completionTime',
                label: '截止日期',
                kind: 'date',
                wch: pxToWch(widthMap.completionTime, 14),
                value: (task) => String(task?.completionTime || '').trim()
            },
            taskCompleteAt: {
                key: 'taskCompleteAt',
                label: '完成时间',
                wch: pxToWch(widthMap.taskCompleteAt, 18),
                value: (task) => __tmFormatTaskCompletedAtTime(__tmResolveTaskCompletedAtRaw(task))
            },
            remainingTime: {
                key: 'remainingTime',
                label: '剩余时间',
                wch: pxToWch(widthMap.remainingTime, 14),
                value: (task) => __tmGetTaskRemainingTimeLabel(task)
            },
            duration: {
                key: 'duration',
                label: '时长',
                wch: pxToWch(widthMap.duration, 12),
                value: (task) => String(task?.duration || '').trim()
            },
            tomatoSummary: {
                key: 'tomatoSummary',
                label: '专注',
                wch: pxToWch(widthMap.tomatoSummary, 16),
                value: (task) => __tmGetTaskTomatoSummaryText(task)
            },
            spent: {
                key: 'spent',
                label: '耗时',
                wch: pxToWch(widthMap.spent, 12),
                value: (task) => {
                    const mode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() || 'minutes';
                    return (SettingsStore.data.enableTomatoIntegration && mode === 'hours')
                        ? String(__tmFormatSpentHours(__tmParseNumber(task?.tomatoHours)) || '').trim()
                        : String(__tmFormatSpentMinutes(__tmGetTaskSpentMinutes(task)) || '').trim();
                }
            },
            remark: {
                key: 'remark',
                label: '备注',
                wch: pxToWch(widthMap.remark, 30),
                value: (task) => String(task?.remark || '').trim()
            }
        };
        __tmGetCustomFieldDefs().forEach((field) => {
            const fieldId = String(field?.id || '').trim();
            const colKey = __tmBuildCustomFieldColumnKey(fieldId);
            if (!fieldId || !colKey) return;
            const fieldType = String(field?.type || '').trim();
            defs[colKey] = {
                key: colKey,
                label: String(field?.name || fieldId).trim() || fieldId,
                wch: pxToWch(widthMap[colKey], fieldType === 'multi' ? 24 : (fieldType === 'text' ? 28 : 18)),
                value: (task) => fieldType === 'text'
                    ? String(__tmNormalizeCustomFieldValue(field, __tmGetTaskCustomFieldValue(task, fieldId)) || '').trim()
                    : __tmResolveCustomFieldSelectedOptions(field, __tmGetTaskCustomFieldValue(task, fieldId))
                        .map((option) => String(option?.name || option?.id || '').trim())
                        .filter(Boolean)
                        .join(', ')
            };
        });
        return columnOrder.map((key) => defs[key]).filter(Boolean);
    }

    function __tmBuildCurrentTableExcelExportModel() {
        const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks.slice() : [];
        if (filtered.length === 0) return { columns: [], rows: [] };
        const taskMap = new Map(filtered.map((task) => [String(task?.id || '').trim(), task]).filter(([id]) => !!id));
        const depthMemo = new Map();
        const getDepth = (task) => {
            const id = String(task?.id || '').trim();
            if (!id) return 0;
            if (depthMemo.has(id)) return depthMemo.get(id);
            const parentId = String(task?.parentTaskId || '').trim();
            if (!parentId || !taskMap.has(parentId)) {
                depthMemo.set(id, 0);
                return 0;
            }
            const depth = Math.max(0, Math.min(32, getDepth(taskMap.get(parentId)) + 1));
            depthMemo.set(id, depth);
            return depth;
        };
        const prevCollapsedTaskIds = state.collapsedTaskIds instanceof Set ? new Set(state.collapsedTaskIds) : new Set();
        const prevCollapsedGroups = state.collapsedGroups instanceof Set ? new Set(state.collapsedGroups) : new Set();
        const prevExpandedCompletedGroups = state.expandedCompletedGroups instanceof Set ? new Set(state.expandedCompletedGroups) : new Set();
        let orderedTaskRows = [];
        try {
            state.collapsedTaskIds = new Set();
            state.collapsedGroups = new Set();
            state.expandedCompletedGroups = new Set([__tmBuildCompletedRootGroupKey()]);
            orderedTaskRows = (__tmBuildTaskRowModel() || []).filter((row) => row && row.type === 'task' && row.id);
        } catch (e) {
            orderedTaskRows = filtered.map((task) => ({
                type: 'task',
                id: String(task?.id || '').trim(),
                depth: getDepth(task),
            }));
        } finally {
            state.collapsedTaskIds = prevCollapsedTaskIds;
            state.collapsedGroups = prevCollapsedGroups;
            state.expandedCompletedGroups = prevExpandedCompletedGroups;
        }
        const exportedTaskIdSet = new Set();
        orderedTaskRows = orderedTaskRows.filter((row) => {
            const id = String(row?.id || '').trim();
            if (!id || exportedTaskIdSet.has(id)) return false;
            exportedTaskIdSet.add(id);
            return true;
        });
        const fixedColumns = [
            { key: '__group', label: '当前分组', wch: 10, value: (_, ctx) => ctx.groupLabel || '' },
            { key: '__depth', label: '层级', wch: 6, value: (_, ctx) => ctx.depth },
            { key: '__done', label: '完成状态', wch: 10, value: (task) => task?.done ? '已完成' : '未完成' },
        ];
        const visibleColumns = __tmExcelGetExportColumnDefs();
        const rows = orderedTaskRows.map((row) => {
            const id = String(row?.id || '').trim();
            const task = taskMap.get(id) || state.flatTasks?.[id] || null;
            if (!task) return null;
            const parentTaskId = String(task?.parentTaskId || '').trim();
            const rootTask = __tmExcelGetVisibleRootTask(task, taskMap) || task;
            return {
                id,
                task,
                depth: Math.max(0, Number(row?.depth) || getDepth(task)),
                groupLabel: __tmExcelGetGroupLabel(task, rootTask),
                parentTaskId,
            };
        }).filter(Boolean);
        return {
            columns: fixedColumns.concat(visibleColumns),
            rows,
        };
    }

    window.tmExportCurrentTableExcel = async function() {
        if (String(state.viewMode || '').trim() !== 'list') {
            hint('⚠️ 仅表格视图支持导出 Excel', 'warning');
            return;
        }
        const cachedXlsx = __tmResolveXlsxRuntime();
        if (!cachedXlsx) hint('⏳ 正在准备 Excel 导出组件...', 'info');
        const XLSX = cachedXlsx || await __tmEnsureXlsxRuntimeLoaded();
        if (!XLSX || !XLSX.utils) {
            hint('❌ Excel 导出组件未加载', 'error');
            return;
        }
        const model = __tmBuildCurrentTableExcelExportModel();
        if (!Array.isArray(model.rows) || model.rows.length === 0) {
            hint('⚠️ 当前没有可导出的任务', 'warning');
            return;
        }
        const columns = Array.isArray(model.columns) ? model.columns : [];
        if (!columns.length) {
            hint('❌ 导出列配置为空', 'error');
            return;
        }
        const aoa = [columns.map((col) => String(col?.label || '').trim())];
        model.rows.forEach((row) => {
            aoa.push(columns.map((col) => {
                const raw = typeof col?.value === 'function' ? col.value(row.task, row) : '';
                if (col?.kind === 'date') {
                    const dt = __tmExcelParseDateCell(raw);
                    return dt || (raw ? String(raw) : '');
                }
                return raw == null ? '' : raw;
            }));
        });
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = columns.map((col) => ({ wch: Math.max(8, Number(col?.wch) || 12) }));
        ws['!rows'] = aoa.map((_, idx) => {
            if (idx === 0) return { level: 0 };
            const depth = Number(model.rows[idx - 1]?.depth) || 0;
            return { level: Math.max(0, Math.min(7, depth)) };
        });
        ws['!outline'] = { above: true };
        if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
        columns.forEach((col, colIndex) => {
            if (col?.kind !== 'date') return;
            for (let rowIndex = 1; rowIndex < aoa.length; rowIndex += 1) {
                const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
                const cell = ws[cellRef];
                if (!cell || (cell.t !== 'd' && cell.t !== 'n')) continue;
                cell.z = 'yyyy-mm-dd';
            }
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '任务导出');
        const fileBaseName = __tmExcelResolveExportFileBaseName();
        const filename = __tmExcelSanitizeFileName(`${fileBaseName}_表格导出_${__tmExcelDateStamp()}.xlsx`);
        if (typeof XLSX.writeFileXLSX === 'function') XLSX.writeFileXLSX(wb, filename, { compression: true, cellStyles: true });
        else XLSX.writeFile(wb, filename, { bookType: 'xlsx', compression: true, cellStyles: true });
        hint(`✅ 已导出 Excel（${model.rows.length} 条任务）`, 'success');
    };

    // 新增：导出当前分组任务
    window.exportCurrentGroup = async function() {
        // 从当前DOM中获取当前选中的分组ID
        const groupSelect = document.getElementById('groupSelector');
        const currentId = groupSelect ? groupSelect.value : (SettingsStore.data.currentGroupId || 'all');

        if (currentId === 'all') {
            hint('⚠️ 请先选择一个分组进行导出', 'error');
            return;
        }

        // 直接从 taskTree 获取当前页签显示的所有文档和任务
        // taskTree 包含了分组开启"包含子文档"后解析的所有子文档
        const docNames = {};
        const flatTasks = state.flatTasks || {};

        if (!Array.isArray(state.taskTree) || state.taskTree.length === 0) {
            hint('⚠️ 当前没有显示的文档', 'error');
            return;
        }

        // 遍历 taskTree 中当前显示的所有文档，获取文档名称
        state.taskTree.forEach(doc => {
            const docId = String(doc?.id || '').trim();
            if (!docId) return;
            docNames[docId] = doc.name || '未命名文档';
        });

        // 直接从 flatTasks 获取所有任务（包括子任务）
        const tasksByDoc = {};

        // 首先获取所有顶级任务（没有 parentTaskId 的）
        Object.values(flatTasks).forEach(task => {
            if (!task || !task.id) return;
            if (task.parentTaskId) return; // 先跳过子任务，稍后处理

            const docId = String(task.docId || task.root_id || '').trim();
            if (!docId || !docNames[docId]) return; // 只处理在当前分组的文档

            if (!tasksByDoc[docId]) {
                tasksByDoc[docId] = [];
            }

            // 添加顶级任务，设置二级标题信息
            const h2Id = task.h2Id || '';
            let h2Name = task.h2 || '';
            if (!h2Name && h2Id) {
                const h2Task = flatTasks[h2Id];
                if (h2Task) h2Name = h2Task.content || '';
            }

            tasksByDoc[docId].push({
                ...task,
                h2Id: h2Id,
                h2Name: h2Name,
                level: 0
            });

            // 递归收集所有子任务
            const collectChildren = (parentTask, parentH2Id, parentH2Name) => {
                const children = parentTask.children || [];
                children.forEach(child => {
                    if (child && child.id) {
                        // 子任务的h2Id使用父级的
                        tasksByDoc[docId].push({
                            ...child,
                            h2Id: parentH2Id,
                            h2Name: parentH2Name,
                            level: 1
                        });
                        // 递归收集更深层的子任务
                        if (child.children && child.children.length > 0) {
                            collectChildren(child, parentH2Id, parentH2Name);
                        }
                    }
                });
            };

            if (task.children && task.children.length > 0) {
                collectChildren(task, h2Id, h2Name);
            }
        });

        // 检查是否有任务
        let totalTasks = 0;
        Object.values(tasksByDoc).forEach(tasks => {
            totalTasks += tasks.length;
        });

        if (totalTasks === 0) {
            hint('⚠️ 当前分组没有任务可导出', 'error');
            return;
        }

        // 获取当前分组名称
        const groups = SettingsStore.data.docGroups || [];
        const group = groups.find(g => g.id === currentId);
        const groupName = group ? __tmResolveDocGroupName(group) : '当前分组';

        // 显示导出设置对话框
        __tmShowExportDialog(groupName, tasksByDoc, docNames);
    };

    // 导出对话框函数
    function __tmShowExportDialog(groupName, tasksByDoc, docNames) {
        // 关闭现有的导出对话框
        if (state.exportModal) {
            try { state.exportModal.remove(); } catch (e) {}
            state.exportModal = null;
        }

        state.exportModal = document.createElement('div');
        state.exportModal.className = 'tm-modal';
        state.exportModal.style.cssText = 'z-index: 200000;';

        const dialog = document.createElement('div');
        dialog.className = 'tm-box';
        dialog.style.cssText = 'width: 480px; max-width: 90vw; height: auto; flex: none;';

        dialog.innerHTML = `
            <div class="tm-header" style="padding: 16px 20px; border-bottom: 1px solid var(--tm-border-color); flex-shrink: 0;">
                <div style="font-size: 16px; font-weight: 600;">导出任务 - ${esc(groupName)}</div>
                <button class="tm-btn tm-btn-gray" data-tm-action="closeExportDialog" style="padding: 4px 8px; font-size: 12px;">✕</button>
            </div>
            <div class="tm-body" style="padding: 20px; flex: 1; overflow-y: auto;">
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">导出格式</div>
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
                        <input type="radio" name="exportFormat" value="markdown" checked>
                        <span style="font-size: 13px;">Markdown (推荐 AI 阅读)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
                        <input type="radio" name="exportFormat" value="json">
                        <span style="font-size: 13px;">JSON (结构化数据)</span>
                    </label>
                </div>
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">文件名</div>
                    <input type="text" id="exportFilename" value="${esc(groupName)}_任务导出"
                           style="width: 100%; padding: 8px 12px; border: 1px solid var(--tm-input-border); border-radius: 6px; background: var(--tm-input-bg); color: var(--tm-text-color); font-size: 13px; box-sizing: border-box;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="exportIncludeDone" checked>
                        <span style="font-size: 13px;">包含已完成任务</span>
                    </label>
                </div>
                <div style="font-size: 12px; color: var(--tm-secondary-text);">
                    共 ${Object.keys(tasksByDoc).length} 个文档，${Object.values(tasksByDoc).reduce((sum, tasks) => sum + tasks.length, 0)} 个任务
                </div>
            </div>
            <div class="tm-header" style="padding: 16px 20px; border-top: 1px solid var(--tm-border-color); justify-content: flex-end; gap: 10px; flex-shrink: 0;">
                <button class="tm-btn tm-btn-secondary" data-tm-action="closeExportDialog" style="padding: 8px 16px;">取消</button>
                <button class="tm-btn tm-btn-primary" data-tm-action="confirmExport" style="padding: 8px 16px;">导出</button>
            </div>
        `;

        state.exportModal.appendChild(dialog);
        document.body.appendChild(state.exportModal);

        // 绑定事件
        const root = state.exportModal;
        root.addEventListener('click', async (e) => {
            const target = e.target?.closest?.('[data-tm-action]');
            if (!target) return;

            const action = String(target.dataset.tmAction || '');
            if (action === 'closeExportDialog') {
                try { state.exportModal.remove(); } catch (e) {}
                state.exportModal = null;
            } else if (action === 'confirmExport') {
                const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'markdown';
                const filename = document.getElementById('exportFilename')?.value || groupName;
                const includeDone = document.getElementById('exportIncludeDone')?.checked !== false;

                // 执行导出
                __tmDoExport(groupName, tasksByDoc, docNames, format, filename, includeDone);

                try { state.exportModal.remove(); } catch (e) {}
                state.exportModal = null;
            }
        });
    }

    // 执行导出
    function __tmDoExport(groupName, tasksByDoc, docNames, format, filename, includeDone) {
        let content = '';
        let mimeType = 'text/plain';
        let extension = 'txt';

        if (format === 'markdown') {
            content = __tmGenerateMarkdownExport(groupName, tasksByDoc, docNames, includeDone);
            mimeType = 'text/markdown';
            extension = 'md';
        } else {
            content = __tmGenerateJSONExport(tasksByDoc, docNames, includeDone);
            mimeType = 'application/json';
            extension = 'json';
        }

        // 下载文件
        const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        hint('✅ 任务导出成功', 'success');
    }

    // 生成 Markdown 格式导出
    function __tmGenerateMarkdownExport(groupName, tasksByDoc, docNames, includeDone) {
        const lines = [];
        const now = new Date().toISOString().split('T')[0];

        lines.push(`# ${groupName} - 任务导出`);
        lines.push('');
        lines.push(`> 导出时间：${now}`);
        lines.push('');

        // 按文档分组
        Object.entries(tasksByDoc).forEach(([docId, tasks]) => {
            // 过滤任务
            let filteredTasks = tasks;
            if (!includeDone) {
                filteredTasks = tasks.filter(t => !t.done);
            }

            if (filteredTasks.length === 0) return;

            const docName = docNames[docId] || '未命名文档';
            lines.push(`## 📄 ${docName}`);
            lines.push('');

            // 按二级文档分组
            const tasksByH2 = {};
            filteredTasks.forEach(task => {
                const h2Key = task.h2Id || '__no_h2__';
                const h2Name = task.h2Name || '无二级标题';
                if (!tasksByH2[h2Key]) {
                    tasksByH2[h2Key] = {
                        name: h2Name,
                        tasks: []
                    };
                }
                tasksByH2[h2Key].tasks.push(task);
            });

            // 输出任务
            Object.values(tasksByH2).forEach(h2Group => {
                if (h2Group.name !== '无二级标题') {
                    lines.push(`### ${h2Group.name}`);
                    lines.push('');
                }

                h2Group.tasks.forEach(task => {
                    const checkbox = task.done ? '[x]' : '[ ]';

                    // 根据层级计算缩进
                    const level = task.level || 0;
                    const indent = '  '.repeat(level + 1); // 顶级任务2空格，子任务4空格

                    // 任务内容行
                    let line = `${indent}- ${checkbox} ${task.content || '无内容'}`;

                    // 添加标签信息
                    const tags = [];
                    if (task.priority) {
                        const priorityText = task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : task.priority === 'low' ? '低' : task.priority;
                        tags.push(`**优先级：${priorityText}**`);
                    }
                    if (task.startDate) {
                        tags.push(`📅 开始：${task.startDate}`);
                    }
                    if (task.completionTime) {
                        tags.push(`🎯 截止：${task.completionTime}`);
                    }
                    if (task.done && task.completionTime) {
                        tags.push(`✨ 已完成：${task.completionTime}`);
                    }
                    if (task.status) {
                        tags.push(`📌 状态：${task.status}`);
                    }

                    if (tags.length > 0) {
                        line += ` ${tags.join(' | ')}`;
                    }

                    lines.push(line);

                    // 添加备注（如果存在）
                    if (task.remark) {
                        lines.push(`${indent}  > 备注：${task.remark}`);
                    }
                });

                lines.push('');
            });
        });

        // 添加汇总信息
        const totalTasks = Object.values(tasksByDoc).reduce((sum, tasks) => sum + tasks.length, 0);
        const doneTasks = Object.values(tasksByDoc).reduce((sum, tasks) => sum + tasks.filter(t => t.done).length, 0);
        const pendingTasks = totalTasks - doneTasks;

        lines.push('---');
        lines.push('');
        lines.push('## 📊 汇总统计');
        lines.push('');
        lines.push(`- 总任务数：${totalTasks}`);
        lines.push(`- 已完成：${doneTasks}`);
        lines.push(`- 待完成：${pendingTasks}`);
        lines.push(`- 完成率：${totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0}%`);
        lines.push('');

        return lines.join('\n');
    }

    // 生成 JSON 格式导出
    function __tmGenerateJSONExport(tasksByDoc, docNames, includeDone) {
        const exportData = {
            exportTime: new Date().toISOString(),
            documents: []
        };

        Object.entries(tasksByDoc).forEach(([docId, tasks]) => {
            let filteredTasks = tasks;
            if (!includeDone) {
                filteredTasks = tasks.filter(t => !t.done);
            }

            if (filteredTasks.length === 0) return;

            const docData = {
                docId: docId,
                docName: docNames[docId] || '未命名文档',
                tasks: filteredTasks.map(task => ({
                    content: task.content || '',
                    done: !!task.done,
                    priority: task.priority || null,
                    status: task.status || null,
                    startDate: task.startDate || null,
                    completionTime: task.completionTime || null,
                    duration: task.duration || null,
                    tomatoSummary: __tmGetTaskTomatoSummaryText(task) || null,
                    tomatoEstimateCount: __tmGetTaskTomatoEstimateCount(task) || null,
                    tomatoCount: __tmGetTaskTomatoCount(task) || null,
                    remark: task.remark || null,
                    h2Id: task.h2Id || null,
                    h2Name: task.h2Name || null,
                    id: task.id || null
                }))
            };

            exportData.documents.push(docData);
        });

        // 添加统计信息
        const totalTasks = exportData.documents.reduce((sum, doc) => sum + doc.tasks.length, 0);
        const doneTasks = exportData.documents.reduce((sum, doc) => sum + doc.tasks.filter(t => t.done).length, 0);
        exportData.stats = {
            total: totalTasks,
            done: doneTasks,
            pending: totalTasks - doneTasks,
            completionRate: totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0
        };

        return JSON.stringify(exportData, null, 2);
    };

    // 新增：清空当前分组文档
