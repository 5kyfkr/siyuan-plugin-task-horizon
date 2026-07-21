    const __tmAgentPolicyView = {
        loaded: false,
        loading: null,
        policy: null,
        draft: null,
        selectedScope: 'global',
        addDocumentOverrideID: '',
        addGroupOverrideID: '',
        deletedDocumentOverrides: new Set(),
        deletedGroupOverrides: new Set(),
        preview: null,
        error: '',
        saving: false,
        savingTarget: '',
    };

    const __TM_AGENT_POLICY_DAYS = Object.freeze([
        ['mon', '周一'], ['tue', '周二'], ['wed', '周三'], ['thu', '周四'],
        ['fri', '周五'], ['sat', '周六'], ['sun', '周日'],
    ]);
    const __TM_AGENT_POLICY_MAX_DAILY_RANGES = 5;
    const __TM_AGENT_DURATION_MINUTES_MIN = 15;
    const __TM_AGENT_DURATION_MINUTES_MAX = 480;

    function __tmAgentPolicyDefaultWeeklyAvailability() {
        return Object.fromEntries(__TM_AGENT_POLICY_DAYS.map(([key]) => [key, '09:00-12:00, 14:00-18:00']));
    }

    function __tmAgentPolicyDefaultDurationDefaults() {
        return {
            enabled: true,
            syncToManualDrag: false,
            fallbackMinutes: 25,
            rules: [
                { id: 'meeting', name: '会议', keywords: ['会议', '例会', '周会'], minutes: 30 },
                { id: 'writing', name: '写作', keywords: ['报告', '周报', '复盘', '方案', '文档', '撰写'], minutes: 60 },
                { id: 'communication-admin', name: '沟通杂务', keywords: ['邮件', '回复', '整理', '报销', '归档'], minutes: 15 },
            ],
        };
    }

    function __tmAgentPolicyNormalizeDurationDefaults(value) {
        const defaults = __tmAgentPolicyDefaultDurationDefaults();
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : defaults;
        const fallbackMinutes = Number(source.fallbackMinutes);
        return {
            enabled: source.enabled !== false,
            syncToManualDrag: source.syncToManualDrag === true,
            fallbackMinutes: Number.isFinite(fallbackMinutes) ? Math.round(fallbackMinutes) : defaults.fallbackMinutes,
            rules: (Array.isArray(source.rules) ? source.rules : defaults.rules).map((item, index) => ({
                id: String(item?.id || `duration-rule-${index + 1}`).trim() || `duration-rule-${index + 1}`,
                name: String(item?.name || '').trim(),
                keywords: (Array.isArray(item?.keywords) ? item.keywords : []).map((keyword) => String(keyword || '').trim()).filter(Boolean),
                minutes: Number.isFinite(Number(item?.minutes)) ? Math.round(Number(item.minutes)) : defaults.fallbackMinutes,
            })),
        };
    }

    function __tmAgentPolicyClone(value, fallback = null) {
        try { return JSON.parse(JSON.stringify(value)); } catch (e) { return fallback; }
    }

    function __tmAgentPolicyKernelMethod(name) {
        const kernel = globalThis.__taskHorizonHostBridge?.kernel || globalThis.__taskHorizonHostBridge?.plugin?.kernel;
        const method = kernel?.rpc?.call?.[name];
        return typeof method === 'function' ? method : null;
    }

    async function __tmAgentPolicyCall(name, ...args) {
        const method = __tmAgentPolicyKernelMethod(name);
        if (!method) throw new Error('当前思源版本未提供安排规则服务');
        const result = await method(...args);
        if (!result || result.ok !== true) {
            const error = new Error(String(result?.error?.message || '安排规则服务调用失败'));
            error.code = String(result?.error?.code || 'STORAGE_ERROR');
            throw error;
        }
        return result.data;
    }

    function __tmAgentPolicyNormalize(policy) {
        const source = policy && typeof policy === 'object' && !Array.isArray(policy) ? policy : {};
        const weeklyAvailability = source.global?.weeklyAvailability && typeof source.global.weeklyAvailability === 'object'
            ? source.global.weeklyAvailability
            : {};
        return {
            schemaVersion: Number(source.schemaVersion) || 2,
            revision: Math.max(1, Number(source.revision) || 1),
            durationDefaults: __tmAgentPolicyNormalizeDurationDefaults(source.durationDefaults),
            global: {
                weeklyAvailability: Object.keys(weeklyAvailability).length ? weeklyAvailability : __tmAgentPolicyDefaultWeeklyAvailability(),
                fixedOccupancy: Array.isArray(source.global?.fixedOccupancy) ? source.global.fixedOccupancy : [],
                deadlinePriority: source.global?.deadlinePriority && typeof source.global.deadlinePriority === 'object' ? source.global.deadlinePriority : { enabled: true, priority: 'high' },
                defaultCalendarID: String(source.global?.defaultCalendarID || ''),
                customInstructions: String(source.global?.customInstructions || ''),
            },
            documentOverrides: source.documentOverrides && typeof source.documentOverrides === 'object' && !Array.isArray(source.documentOverrides)
                ? source.documentOverrides
                : (source.listOverrides && typeof source.listOverrides === 'object' && !Array.isArray(source.listOverrides) ? source.listOverrides : {}),
            groupOverrides: source.groupOverrides && typeof source.groupOverrides === 'object' && !Array.isArray(source.groupOverrides) ? source.groupOverrides : {},
            previous: source.previous || null,
        };
    }

    function __tmAgentPolicyParseScope(value = __tmAgentPolicyView.selectedScope) {
        const scope = String(value || '').trim();
        if (scope === 'global') return { type: 'global', id: '' };
        if (scope.startsWith('document:')) return { type: 'document', id: scope.slice(9) };
        if (scope.startsWith('group:')) return { type: 'group', id: scope.slice(6) };
        return { type: 'global', id: '' };
    }

    function __tmAgentPolicyScopeExists(policy, scopeValue) {
        const scope = __tmAgentPolicyParseScope(scopeValue);
        if (scope.type === 'global') return true;
        if (scope.type === 'document') return !!policy?.documentOverrides?.[scope.id];
        return !!policy?.groupOverrides?.[scope.id];
    }

    async function __tmLoadAgentPolicySettings(force = false) {
        if (__tmAgentPolicyView.loading) return __tmAgentPolicyView.loading;
        if (__tmAgentPolicyView.loaded && !force) return __tmAgentPolicyView.policy;
        __tmAgentPolicyView.loading = __tmAgentPolicyCall('taskHorizonGetPolicy').then((policy) => {
            const normalized = __tmAgentPolicyNormalize(policy);
            __tmAgentPolicyView.policy = normalized;
            __tmAgentPolicyView.draft = __tmAgentPolicyClone(normalized, __tmAgentPolicyNormalize(null));
            __tmAgentPolicyView.loaded = true;
            __tmAgentPolicyView.error = '';
            __tmAgentPolicyView.preview = null;
            __tmAgentPolicyView.deletedDocumentOverrides.clear();
            __tmAgentPolicyView.deletedGroupOverrides.clear();
            if (!__tmAgentPolicyScopeExists(normalized, __tmAgentPolicyView.selectedScope)) {
                __tmAgentPolicyView.selectedScope = 'global';
            }
            return normalized;
        }).catch((error) => {
            __tmAgentPolicyView.error = String(error?.message || error || '安排规则读取失败');
            return null;
        }).finally(() => {
            __tmAgentPolicyView.loading = null;
        });
        return __tmAgentPolicyView.loading;
    }

    function __tmAgentPolicyRerender() {
        if (state.settingsActiveTab === 'ai' && state.settingsModal) showSettings();
    }

    function __tmAgentPolicyIcon(name) {
        try { return __tmPhosphorBoldSvg(name, { size: 14, className: 'tm-agent-policy-icon' }); } catch (e) { return ''; }
    }

    function __tmAgentPolicyDocumentName(id) {
        const key = String(id || '').trim();
        const doc = (Array.isArray(state.allDocuments) ? state.allDocuments : []).find((item) => String(item?.id || '').trim() === key);
        return String(doc?.name || doc?.content || key || '未命名文档').trim() || '未命名文档';
    }

    function __tmAgentPolicyDocumentGroupName(id) {
        const key = String(id || '').trim();
        const group = (Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [])
            .find((item) => String(item?.id || '').trim() === key);
        return String(group?.name || key || '未命名文档分组').trim() || '未命名文档分组';
    }

    function __tmAgentPolicyGroupOptions(selected, includeEmpty = true) {
        const current = String(selected || '').trim();
        const groups = new Map();
        (Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : []).forEach((group) => {
            const id = String(group?.id || '').trim();
            if (id) groups.set(id, __tmAgentPolicyDocumentGroupName(id));
        });
        Object.keys(__tmAgentPolicyView.draft?.groupOverrides || {}).forEach((id) => {
            if (!groups.has(id)) groups.set(id, __tmAgentPolicyDocumentGroupName(id));
        });
        if (current && !groups.has(current)) groups.set(current, __tmAgentPolicyDocumentGroupName(current));
        return `${includeEmpty ? '<option value="">选择文档分组</option>' : ''}${Array.from(groups, ([id, name]) => `<option value="${esc(id)}" ${id === current ? 'selected' : ''}>${esc(name)}</option>`).join('')}`;
    }

    function __tmAgentPolicyCalendarOptions(selected) {
        const current = String(selected || '').trim();
        const calendars = new Map([['', '跟随日历默认'], ['default', '未分组']]);
        (Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : []).forEach((group) => {
            const id = String(group?.id || '').trim();
            if (id) calendars.set(`group:${id}`, String(group?.name || id).trim() || id);
        });
        if (current && !calendars.has(current)) calendars.set(current, current);
        return Array.from(calendars, ([id, name]) => `<option value="${esc(id)}" ${id === current ? 'selected' : ''}>${esc(name)}</option>`).join('');
    }

    function __tmAgentPolicyScopeConfig(create = false) {
        const draft = __tmAgentPolicyView.draft;
        if (!draft) return null;
        const scope = __tmAgentPolicyParseScope();
        if (scope.type === 'global') return draft.global;
        const overrides = scope.type === 'document' ? draft.documentOverrides : draft.groupOverrides;
        if (!overrides[scope.id] && create) overrides[scope.id] = {};
        return overrides[scope.id] || null;
    }

    function __tmAgentPolicyMatchingGroupOverride(documentID) {
        const id = String(documentID || '').trim();
        const draft = __tmAgentPolicyView.draft;
        if (!id || !draft) return null;
        const docs = Array.isArray(state.allDocuments) ? state.allDocuments : [];
        const target = docs.find((item) => String(item?.id || '').trim() === id) || null;
        return (Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : []).find((group) => {
            const groupID = String(group?.id || '').trim();
            if (!groupID || !draft.groupOverrides?.[groupID]) return false;
            const excluded = new Set((Array.isArray(group?.excludedDocIds) ? group.excludedDocIds : []).map((item) => String(item || '').trim()));
            if (excluded.has(id)) return false;
            const notebookID = String(group?.notebookId || '').trim();
            if (notebookID && target && notebookID === String(target?.notebook || target?.box || '').trim()) return true;
            return (Array.isArray(group?.docs) ? group.docs : []).some((entry) => {
                const entryID = String((entry && typeof entry === 'object' ? entry.id : entry) || '').trim();
                if (!entryID) return false;
                if (entryID === id) return true;
                if (!(entry && typeof entry === 'object' && entry.recursive) || !target) return false;
                const root = docs.find((item) => String(item?.id || '').trim() === entryID);
                const targetPath = String(target?.path || target?.hpath || '').replace(/\/+$/, '');
                const rootPath = String(root?.path || root?.hpath || '').replace(/\/+$/, '');
                const sameNotebook = String(target?.notebook || target?.box || '').trim() === String(root?.notebook || root?.box || '').trim();
                return !!rootPath && sameNotebook && (targetPath === rootPath || targetPath.startsWith(`${rootPath}/`));
            });
        }) || null;
    }

    function __tmAgentPolicyInheritedConfig() {
        const draft = __tmAgentPolicyView.draft || __tmAgentPolicyNormalize(null);
        const scope = __tmAgentPolicyParseScope();
        if (scope.type !== 'document') return draft.global;
        const group = __tmAgentPolicyMatchingGroupOverride(scope.id);
        return group ? { ...draft.global, ...(draft.groupOverrides?.[group.id] || {}) } : draft.global;
    }

    function __tmAgentPolicyEffectiveConfig() {
        const draft = __tmAgentPolicyView.draft || __tmAgentPolicyNormalize(null);
        const scoped = __tmAgentPolicyScopeConfig(false) || {};
        const scope = __tmAgentPolicyParseScope();
        return scope.type === 'global' ? draft.global : { ...__tmAgentPolicyInheritedConfig(), ...scoped };
    }

    function __tmAgentPolicyFieldEnabled(field) {
        if (__tmAgentPolicyParseScope().type === 'global') return true;
        const scoped = __tmAgentPolicyScopeConfig(false) || {};
        return Object.prototype.hasOwnProperty.call(scoped, field);
    }

    function __tmAgentPolicyEditableConfig(field) {
        const scoped = __tmAgentPolicyScopeConfig(true);
        if (!scoped) return null;
        if (__tmAgentPolicyParseScope().type !== 'global' && !Object.prototype.hasOwnProperty.call(scoped, field)) {
            scoped[field] = __tmAgentPolicyClone(__tmAgentPolicyInheritedConfig()[field], null);
        }
        return scoped;
    }

    function __tmAgentPolicyRenderFieldHeading(title, field) {
        if (__tmAgentPolicyParseScope().type === 'global') return `<div class="tm-agent-policy-group__title">${esc(title)}</div>`;
        const enabled = __tmAgentPolicyFieldEnabled(field);
        return `<div class="tm-agent-policy-group__heading"><div class="tm-agent-policy-group__title">${esc(title)}</div><label><input class="b3-switch fn__flex-center" type="checkbox" ${enabled ? 'checked' : ''} data-tm-call="tmAgentPolicyToggleOverrideField" data-tm-args='${esc(JSON.stringify([field]))}'><span>${enabled ? '单独设置' : '继承上级，编辑后覆盖'}</span></label></div>`;
    }

    function __tmAgentPolicyAvailabilityRanges(value) {
        const items = Array.isArray(value) ? value : String(value || '').split(',');
        return items.map((item) => {
            if (item && typeof item === 'object') return { start: String(item.start || ''), end: String(item.end || '') };
            const match = String(item || '').trim().match(/^([0-2]\d:[0-5]\d)-([0-2]\d:[0-5]\d)$/);
            return match ? { start: match[1], end: match[2] } : null;
        }).filter((item) => item?.start && item?.end);
    }

    function __tmAgentPolicyStoreAvailabilityRanges(config, day, ranges) {
        config.weeklyAvailability = config.weeklyAvailability && typeof config.weeklyAvailability === 'object' ? config.weeklyAvailability : {};
        config.weeklyAvailability[String(day || '')] = ranges.map((range) => `${range.start}-${range.end}`).join(', ');
    }

    function __tmAgentPolicyRenderAvailability(config) {
        const value = config.weeklyAvailability && typeof config.weeklyAvailability === 'object' ? config.weeklyAvailability : {};
        return `<section class="tm-agent-policy-group tm-agent-policy-group--availability">${__tmAgentPolicyRenderFieldHeading('每周可安排时间', 'weeklyAvailability')}<div class="tm-agent-policy-week">${__TM_AGENT_POLICY_DAYS.map(([key, label]) => {
            const ranges = __tmAgentPolicyAvailabilityRanges(value[key]);
            const atLimit = ranges.length >= __TM_AGENT_POLICY_MAX_DAILY_RANGES;
            return `<div class="tm-agent-policy-day"><span class="tm-agent-policy-day__label"><strong>${label}</strong><small>${ranges.length}/${__TM_AGENT_POLICY_MAX_DAILY_RANGES}</small></span><div class="tm-agent-policy-day__ranges">${ranges.map((range, index) => `<div class="tm-agent-policy-time-range"><input class="b3-text-field" type="time" value="${esc(range.start)}" aria-label="${label}开始时间" data-tm-call="tmAgentPolicyUpdateAvailabilityRange" data-tm-args='${esc(JSON.stringify([key, index, 'start']))}'><span>至</span><input class="b3-text-field" type="time" value="${esc(range.end)}" aria-label="${label}结束时间" data-tm-call="tmAgentPolicyUpdateAvailabilityRange" data-tm-args='${esc(JSON.stringify([key, index, 'end']))}'><button class="tm-agent-policy-icon-button tm-agent-policy-icon-button--danger" type="button" data-tm-call="tmAgentPolicyRemoveAvailabilityRange" data-tm-args='${esc(JSON.stringify([key, index]))}' aria-label="删除${label}时段" title="删除时段">${__tmAgentPolicyIcon('trash')}</button></div>`).join('') || '<span class="tm-agent-policy-day__empty">不安排</span>'}</div><button class="tm-agent-policy-icon-button tm-agent-policy-day__add" type="button" ${!atLimit ? '' : 'disabled'} data-tm-call="tmAgentPolicyAddAvailabilityRange" data-tm-args='${esc(JSON.stringify([key]))}' aria-label="${atLimit ? `${label}已达到 5 段上限` : `${label}添加时段`}" title="${atLimit ? '已达到 5 段上限' : '添加时段（最多 5 段）'}">${__tmAgentPolicyIcon('plus')}</button></div>`;
        }).join('')}</div></section>`;
    }

    function __tmAgentPolicyRenderOccupancy(config) {
        const rows = Array.isArray(config.fixedOccupancy) ? config.fixedOccupancy : [];
        return `<section class="tm-agent-policy-group">${__tmAgentPolicyRenderFieldHeading('固定占用', 'fixedOccupancy')}<div class="tm-agent-policy-list">${rows.map((item, index) => `<div class="tm-agent-policy-row tm-agent-policy-row--occupancy"><select class="b3-select" data-tm-call="tmAgentPolicyUpdateOccupancy" data-tm-args='${esc(JSON.stringify([index, 'day']))}'>${__TM_AGENT_POLICY_DAYS.map(([key, label]) => `<option value="${key}" ${String(item?.day || '') === key ? 'selected' : ''}>${label}</option>`).join('')}</select><input class="b3-text-field" type="time" value="${esc(item?.start || '')}" data-tm-call="tmAgentPolicyUpdateOccupancy" data-tm-args='${esc(JSON.stringify([index, 'start']))}'><span>至</span><input class="b3-text-field" type="time" value="${esc(item?.end || '')}" data-tm-call="tmAgentPolicyUpdateOccupancy" data-tm-args='${esc(JSON.stringify([index, 'end']))}'><input class="b3-text-field" type="text" value="${esc(item?.label || '')}" placeholder="会议或通勤" data-tm-call="tmAgentPolicyUpdateOccupancy" data-tm-args='${esc(JSON.stringify([index, 'label']))}'><button class="tm-agent-policy-icon-button tm-agent-policy-icon-button--danger" type="button" data-tm-call="tmAgentPolicyRemoveOccupancy" data-tm-args='${esc(JSON.stringify([index]))}' aria-label="删除固定占用" title="删除">${__tmAgentPolicyIcon('trash')}</button></div>`).join('') || '<div class="tm-agent-policy-empty">没有固定占用</div>'}</div><button class="tm-btn tm-btn-secondary tm-agent-policy-add" type="button" data-tm-call="tmAgentPolicyAddOccupancy">${__tmAgentPolicyIcon('plus')}<span>添加占用</span></button></section>`;
    }

    function __tmAgentPolicyRenderDurationDefaults() {
        const config = __tmAgentPolicyNormalizeDurationDefaults(__tmAgentPolicyView.draft?.durationDefaults);
        const disabled = config.enabled ? '' : 'disabled';
        const rows = config.rules.map((rule, index) => `<div class="tm-agent-policy-duration-row">
            <input class="b3-text-field tm-agent-policy-duration-row__name" type="text" maxlength="40" value="${esc(rule.name)}" placeholder="类型名称" aria-label="规则类型名称" data-tm-call="tmAgentPolicyUpdateDurationRule" data-tm-args='${esc(JSON.stringify([index, 'name']))}'>
            <input class="b3-text-field tm-agent-policy-duration-row__keywords" type="text" maxlength="800" value="${esc(rule.keywords.join('、'))}" placeholder="关键词，用逗号或顿号分隔" aria-label="${esc(rule.name || `规则 ${index + 1}`)}关键词" data-tm-call="tmAgentPolicyUpdateDurationRule" data-tm-args='${esc(JSON.stringify([index, 'keywords']))}'>
            <label class="tm-agent-policy-duration-row__minutes"><input class="b3-text-field" type="number" min="${__TM_AGENT_DURATION_MINUTES_MIN}" max="${__TM_AGENT_DURATION_MINUTES_MAX}" step="5" value="${rule.minutes}" aria-label="${esc(rule.name || `规则 ${index + 1}`)}时长" data-tm-call="tmAgentPolicyUpdateDurationRule" data-tm-args='${esc(JSON.stringify([index, 'minutes']))}'><span>分钟</span></label>
            <div class="tm-agent-policy-duration-row__actions"><button class="tm-agent-policy-icon-button" type="button" ${index > 0 ? '' : 'disabled'} data-tm-call="tmAgentPolicyMoveDurationRule" data-tm-args='${esc(JSON.stringify([index, -1]))}' aria-label="上移${esc(rule.name || `规则 ${index + 1}`)}" title="上移">${__tmAgentPolicyIcon('arrow-up')}</button><button class="tm-agent-policy-icon-button" type="button" ${index < config.rules.length - 1 ? '' : 'disabled'} data-tm-call="tmAgentPolicyMoveDurationRule" data-tm-args='${esc(JSON.stringify([index, 1]))}' aria-label="下移${esc(rule.name || `规则 ${index + 1}`)}" title="下移">${__tmAgentPolicyIcon('arrow-down')}</button><button class="tm-agent-policy-icon-button tm-agent-policy-icon-button--danger" type="button" data-tm-call="tmAgentPolicyRemoveDurationRule" data-tm-args='${esc(JSON.stringify([index]))}' aria-label="删除${esc(rule.name || `规则 ${index + 1}`)}" title="删除">${__tmAgentPolicyIcon('trash')}</button></div>
        </div>`).join('');
        const saving = __tmAgentPolicyView.saving && __tmAgentPolicyView.savingTarget === 'duration';
        return `<section class="tm-agent-policy-group tm-agent-policy-duration-defaults"><div class="tm-agent-policy-group__heading"><div class="tm-agent-policy-group__title">任务默认时长</div><label><input class="b3-switch fn__flex-center" type="checkbox" ${config.enabled ? 'checked' : ''} data-tm-call="tmAgentPolicySetDurationDefaultsEnabled"><span>启用默认时长规则</span></label></div><div class="tm-agent-policy-help">独立保存，全局生效。规则仅决定排程块长度，不会填写任务时长；按从上到下首个匹配。</div><div class="tm-agent-policy-duration-controls"><label><input class="b3-switch fn__flex-center" type="checkbox" ${config.syncToManualDrag ? 'checked' : ''} ${disabled} data-tm-call="tmAgentPolicySetManualDragDurationSync"><span>同步应用到手动拖拽</span></label><label class="tm-agent-policy-duration-fallback"><span>未命中时长</span><input class="b3-text-field" type="number" min="${__TM_AGENT_DURATION_MINUTES_MIN}" max="${__TM_AGENT_DURATION_MINUTES_MAX}" step="5" value="${config.fallbackMinutes}" data-tm-call="tmAgentPolicySetDurationFallback"><span>分钟</span></label></div><div class="tm-agent-policy-duration-list">${rows || '<div class="tm-agent-policy-empty">没有关键词规则，未填写时长的任务将使用未命中时长。</div>'}</div><div class="tm-agent-policy-duration-footer"><button class="tm-btn tm-btn-secondary tm-agent-policy-add" type="button" data-tm-call="tmAgentPolicyAddDurationRule">${__tmAgentPolicyIcon('plus')}<span>添加类型规则</span></button><button class="tm-btn tm-btn-primary" type="button" ${__tmAgentPolicyView.saving ? 'disabled' : ''} data-tm-call="tmAgentPolicySaveDurationDefaults">${saving ? '保存中…' : '保存默认时长'}</button></div></section>`;
    }

    function __tmAgentPolicyRenderCustomInstructions(config) {
        return `<section class="tm-agent-policy-group">${__tmAgentPolicyRenderFieldHeading('自定义要求', 'customInstructions')}<div class="tm-agent-policy-help">补充希望 AI 在当前规则作用域内遵守的安排或处理要求。</div><textarea class="b3-text-field tm-agent-policy-instructions" rows="4" maxlength="4000" data-tm-call="tmAgentPolicySetCustomInstructions" placeholder="例如：会议前后预留 15 分钟；本组任务只安排在工作日上午。">${esc(String(config.customInstructions || ''))}</textarea></section>`;
    }

    function __tmAgentPolicyRenderDefaults(config) {
        const priority = config.deadlinePriority && typeof config.deadlinePriority === 'object' ? config.deadlinePriority : { enabled: true, priority: 'high' };
        return `<section class="tm-agent-policy-group">${__tmAgentPolicyRenderFieldHeading('截止时间优先级', 'deadlinePriority')}<div class="tm-agent-policy-inline"><label><input class="b3-switch fn__flex-center" type="checkbox" ${priority.enabled !== false ? 'checked' : ''} data-tm-call="tmAgentPolicySetDeadlineEnabled"><span>有截止时间时自动设置</span></label><select class="b3-select" data-tm-call="tmAgentPolicySetDeadlinePriority"><option value="high" ${priority.priority === 'high' ? 'selected' : ''}>高</option><option value="medium" ${priority.priority === 'medium' ? 'selected' : ''}>中</option><option value="low" ${priority.priority === 'low' ? 'selected' : ''}>低</option></select></div></section><section class="tm-agent-policy-group">${__tmAgentPolicyRenderFieldHeading('默认日历', 'defaultCalendarID')}<select class="b3-select tm-agent-policy-calendar" data-tm-call="tmAgentPolicySetDefaultCalendar">${__tmAgentPolicyCalendarOptions(config.defaultCalendarID)}</select></section>`;
    }

    function __tmRenderAgentPolicySettingsPanel() {
        if (!__tmAgentPolicyView.loaded && !__tmAgentPolicyView.loading && !__tmAgentPolicyView.error) {
            Promise.resolve(__tmLoadAgentPolicySettings()).then(__tmAgentPolicyRerender);
        }
        if (!__tmAgentPolicyView.loaded) {
            return `<div class="tm-settings-panel tm-agent-policy-panel" data-tm-settings-section="ai-policy" ${__tmSettingsSearchAttrs('ai', '安排规则', '默认时长、时间地图、固定占用、自定义要求、优先级和默认日历', { key: 'ai-policy' })}><div class="tm-settings-section-title">安排规则</div><div class="tm-settings-section-desc">${esc(__tmAgentPolicyView.error || '正在读取安排规则...')}</div>${__tmAgentPolicyView.error ? '<div class="tm-agent-policy-footer"><button class="tm-btn tm-btn-secondary" type="button" data-tm-call="tmAgentPolicyReload">重试</button></div>' : ''}</div>`;
        }
        const draft = __tmAgentPolicyView.draft;
        const documentOverrides = Object.keys(draft.documentOverrides || {});
        const groupOverrides = Object.keys(draft.groupOverrides || {});
        const config = __tmAgentPolicyEffectiveConfig();
        const selected = __tmAgentPolicyView.selectedScope;
        const scope = __tmAgentPolicyParseScope(selected);
        const deleteLabel = scope.type === 'group' ? '删除文档分组规则' : '删除文档规则';
        const documentPickerLabel = __tmAgentPolicyView.addDocumentOverrideID
            ? __tmAgentPolicyDocumentName(__tmAgentPolicyView.addDocumentOverrideID)
            : '搜索并选择文档';
        const scopeOptions = [
            ...groupOverrides.map((id) => `<option value="group:${esc(id)}" ${selected === `group:${id}` ? 'selected' : ''}>文档分组 · ${esc(__tmAgentPolicyDocumentGroupName(id))}</option>`),
            ...documentOverrides.map((id) => `<option value="document:${esc(id)}" ${selected === `document:${id}` ? 'selected' : ''}>文档 · ${esc(__tmAgentPolicyDocumentName(id))}</option>`),
        ].join('');
        const addControls = `<div class="tm-agent-policy-scope__add"><button class="tm-btn tm-btn-secondary tm-agent-policy-document-picker" type="button" data-tm-call="tmAgentPolicyPickDocumentOverride" title="搜索文档">${__tmAgentPolicyIcon('search')}<span>${esc(documentPickerLabel)}</span></button><button class="tm-btn tm-btn-secondary" type="button" data-tm-call="tmAgentPolicyAddDocumentOverride">${__tmAgentPolicyIcon('plus')}<span>添加文档规则</span></button></div><div class="tm-agent-policy-scope__add"><select class="b3-select" data-tm-call="tmAgentPolicyChooseGroupOverride">${__tmAgentPolicyGroupOptions(__tmAgentPolicyView.addGroupOverrideID, true)}</select><button class="tm-btn tm-btn-secondary" type="button" data-tm-call="tmAgentPolicyAddGroupOverride">${__tmAgentPolicyIcon('plus')}<span>添加文档分组规则</span></button></div>`;
        const savingOther = __tmAgentPolicyView.saving && __tmAgentPolicyView.savingTarget === 'other';
        return `<div class="tm-settings-panel tm-agent-policy-panel" data-tm-settings-section="ai-policy" ${__tmSettingsSearchAttrs('ai', '安排规则', '默认时长、时间地图、固定占用、自定义要求、优先级和默认日历', { key: 'ai-policy' })}><div class="tm-agent-policy-toolbar"><div><div class="tm-settings-section-title">安排规则</div><div class="tm-settings-section-desc">智能体规划任务时读取这些规则。本次对话的临时要求不会自动保存。</div></div></div>${__tmAgentPolicyRenderDurationDefaults()}<div class="tm-agent-policy-scope"><select class="b3-select" data-tm-call="tmAgentPolicySelectScope"><option value="global" ${selected === 'global' ? 'selected' : ''}>全局规则</option>${scopeOptions}</select>${scope.type !== 'global' ? `<button class="tm-btn tm-btn-secondary" type="button" data-tm-call="tmAgentPolicyDeleteOverride">${__tmAgentPolicyIcon('trash')}<span>${deleteLabel}</span></button>` : addControls}</div>${__tmAgentPolicyRenderAvailability(config)}${__tmAgentPolicyRenderOccupancy(config)}${__tmAgentPolicyRenderCustomInstructions(config)}${__tmAgentPolicyRenderDefaults(config)}<div class="tm-agent-policy-footer"><button class="tm-btn tm-btn-secondary" type="button" data-tm-call="tmAgentPolicyReload">重新读取</button><button class="tm-btn tm-btn-primary" type="button" ${__tmAgentPolicyView.saving ? 'disabled' : ''} data-tm-call="tmAgentPolicySave">${savingOther ? '保存中…' : '保存其他规则'}</button></div></div>`;
    }

    window.tmAgentPolicySelectScope = function (value) {
        const key = String(value || '').trim();
        __tmAgentPolicyView.selectedScope = __tmAgentPolicyScopeExists(__tmAgentPolicyView.draft, key) ? key : 'global';
        __tmAgentPolicyView.preview = null;
        __tmAgentPolicyRerender();
    };

    async function __tmAgentPolicySearchDocuments() {
        const docs = new Map();
        (Array.isArray(state.allDocuments) ? state.allDocuments : []).forEach((doc) => {
            const id = String(doc?.id || '').trim();
            if (id) docs.set(id, { ...doc, id, name: __tmAgentPolicyDocumentName(id) });
        });
        try {
            const scopes = await __tmAgentPolicyCall('taskHorizonListTaskScopes');
            (Array.isArray(scopes?.documents) ? scopes.documents : []).forEach((doc) => {
                const id = String(doc?.id || '').trim();
                if (id && !docs.has(id)) docs.set(id, doc);
            });
        } catch (e) {}
        Object.keys(__tmAgentPolicyView.draft?.documentOverrides || {}).forEach((id) => {
            if (!docs.has(id)) docs.set(id, { id, name: __tmAgentPolicyDocumentName(id) });
        });
        return Array.from(docs.values());
    }

    window.tmAgentPolicyPickDocumentOverride = async function () {
        const docs = await __tmAgentPolicySearchDocuments();
        const id = await __tmOpenDocSearchPrompt('选择文档', docs, {
            placeholder: '输入文档名、别名或 ID',
            emptyText: '没有匹配的文档',
        });
        if (!id) return;
        __tmAgentPolicyView.addDocumentOverrideID = String(id).trim();
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicyAddDocumentOverride = function () {
        const id = String(__tmAgentPolicyView.addDocumentOverrideID || '').trim();
        if (!id) return hint('请先搜索并选择文档', 'warning');
        __tmAgentPolicyView.draft.documentOverrides[id] = __tmAgentPolicyView.draft.documentOverrides[id] || {};
        __tmAgentPolicyView.deletedDocumentOverrides.delete(id);
        __tmAgentPolicyView.selectedScope = `document:${id}`;
        __tmAgentPolicyView.addDocumentOverrideID = '';
        __tmAgentPolicyView.preview = null;
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicyChooseGroupOverride = function (value) {
        __tmAgentPolicyView.addGroupOverrideID = String(value || '').trim();
    };

    window.tmAgentPolicyAddGroupOverride = function () {
        const id = String(__tmAgentPolicyView.addGroupOverrideID || '').trim();
        if (!id) return hint('请选择文档分组', 'warning');
        __tmAgentPolicyView.draft.groupOverrides[id] = __tmAgentPolicyView.draft.groupOverrides[id] || {};
        __tmAgentPolicyView.deletedGroupOverrides.delete(id);
        __tmAgentPolicyView.selectedScope = `group:${id}`;
        __tmAgentPolicyView.addGroupOverrideID = '';
        __tmAgentPolicyView.preview = null;
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicyDeleteOverride = function () {
        const scope = __tmAgentPolicyParseScope();
        if (!scope.id || scope.type === 'global') return;
        const overrides = scope.type === 'document' ? __tmAgentPolicyView.draft.documentOverrides : __tmAgentPolicyView.draft.groupOverrides;
        const deleted = scope.type === 'document' ? __tmAgentPolicyView.deletedDocumentOverrides : __tmAgentPolicyView.deletedGroupOverrides;
        delete overrides[scope.id];
        deleted.add(scope.id);
        __tmAgentPolicyView.selectedScope = 'global';
        __tmAgentPolicyView.preview = null;
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicyToggleOverrideField = function (field, enabled) {
        const scoped = __tmAgentPolicyScopeConfig(true);
        if (!scoped || __tmAgentPolicyParseScope().type === 'global') return;
        if (enabled) scoped[field] = __tmAgentPolicyClone(__tmAgentPolicyInheritedConfig()[field], null);
        else delete scoped[field];
        __tmAgentPolicyView.preview = null;
        __tmAgentPolicyRerender();
    };

    function __tmAgentPolicyDurationDraft() {
        if (!__tmAgentPolicyView.draft) return null;
        __tmAgentPolicyView.draft.durationDefaults = __tmAgentPolicyNormalizeDurationDefaults(__tmAgentPolicyView.draft.durationDefaults);
        return __tmAgentPolicyView.draft.durationDefaults;
    }

    function __tmAgentPolicySplitDurationKeywords(value) {
        const seen = new Set();
        return String(value || '').split(/[,，、\n]+/).map((keyword) => keyword.trim()).filter((keyword) => {
            let normalized = keyword.toLowerCase();
            try { normalized = keyword.normalize('NFKC').toLowerCase(); } catch (e) {}
            if (!normalized || seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
        });
    }

    window.tmAgentPolicySetDurationDefaultsEnabled = function (value) {
        const config = __tmAgentPolicyDurationDraft();
        if (!config) return;
        config.enabled = value === true;
        __tmAgentPolicyView.preview = null;
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicySetManualDragDurationSync = function (value) {
        const config = __tmAgentPolicyDurationDraft();
        if (!config) return;
        config.syncToManualDrag = value === true;
        __tmAgentPolicyView.preview = null;
    };

    window.tmAgentPolicySetDurationFallback = function (value) {
        const config = __tmAgentPolicyDurationDraft();
        if (!config) return;
        config.fallbackMinutes = Number(value);
        __tmAgentPolicyView.preview = null;
    };

    window.tmAgentPolicyUpdateDurationRule = function (index, field, value) {
        const config = __tmAgentPolicyDurationDraft();
        const rule = config?.rules?.[Number(index)];
        if (!rule || !['name', 'keywords', 'minutes'].includes(String(field || ''))) return;
        if (field === 'keywords') rule.keywords = __tmAgentPolicySplitDurationKeywords(value);
        else if (field === 'minutes') rule.minutes = Number(value);
        else rule.name = String(value || '').trim();
        __tmAgentPolicyView.preview = null;
    };

    window.tmAgentPolicyAddDurationRule = function () {
        const config = __tmAgentPolicyDurationDraft();
        if (!config) return;
        config.rules.push({ id: `duration-rule-${Date.now().toString(36)}`, name: '', keywords: [], minutes: config.fallbackMinutes });
        __tmAgentPolicyView.preview = null;
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicyMoveDurationRule = function (index, delta) {
        const config = __tmAgentPolicyDurationDraft();
        const from = Number(index);
        const to = from + Number(delta);
        if (!config || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= config.rules.length || to >= config.rules.length) return;
        const [rule] = config.rules.splice(from, 1);
        config.rules.splice(to, 0, rule);
        __tmAgentPolicyView.preview = null;
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicyRemoveDurationRule = function (index) {
        const config = __tmAgentPolicyDurationDraft();
        if (!config || !Array.isArray(config.rules)) return;
        config.rules.splice(Number(index), 1);
        __tmAgentPolicyView.preview = null;
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicyUpdateAvailabilityRange = function (day, index, field, value) {
        const config = __tmAgentPolicyEditableConfig('weeklyAvailability');
        if (!config) return;
        const ranges = __tmAgentPolicyAvailabilityRanges(config.weeklyAvailability?.[String(day || '')]);
        if (!ranges[Number(index)] || !['start', 'end'].includes(field)) return;
        const next = String(value || '').trim();
        if (!next) {
            ranges.splice(Number(index), 1);
            __tmAgentPolicyStoreAvailabilityRanges(config, day, ranges);
            __tmAgentPolicyView.preview = null;
            __tmAgentPolicyRerender();
            return;
        }
        ranges[Number(index)][field] = next;
        __tmAgentPolicyStoreAvailabilityRanges(config, day, ranges);
        __tmAgentPolicyView.preview = null;
    };

    window.tmAgentPolicyAddAvailabilityRange = function (day) {
        const config = __tmAgentPolicyEditableConfig('weeklyAvailability');
        if (!config) return;
        const ranges = __tmAgentPolicyAvailabilityRanges(config.weeklyAvailability?.[String(day || '')]);
        if (ranges.length >= __TM_AGENT_POLICY_MAX_DAILY_RANGES) return;
        const start = ranges.length ? ranges[ranges.length - 1].end : '09:00';
        const [hour, minute] = start.split(':').map(Number);
        const end = Number.isFinite(hour) && hour < 23
            ? `${String(hour + 1).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`
            : '23:59';
        ranges.push({ start, end });
        __tmAgentPolicyStoreAvailabilityRanges(config, day, ranges);
        __tmAgentPolicyView.preview = null;
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicyRemoveAvailabilityRange = function (day, index) {
        const config = __tmAgentPolicyEditableConfig('weeklyAvailability');
        if (!config) return;
        const ranges = __tmAgentPolicyAvailabilityRanges(config.weeklyAvailability?.[String(day || '')]);
        ranges.splice(Number(index), 1);
        __tmAgentPolicyStoreAvailabilityRanges(config, day, ranges);
        __tmAgentPolicyView.preview = null;
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicyAddOccupancy = function () {
        const config = __tmAgentPolicyEditableConfig('fixedOccupancy');
        if (!config) return;
        config.fixedOccupancy = Array.isArray(config.fixedOccupancy) ? config.fixedOccupancy : [];
        config.fixedOccupancy.push({ day: 'mon', start: '09:00', end: '10:00', label: '' });
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicyUpdateOccupancy = function (index, field, value) {
        const rows = __tmAgentPolicyEditableConfig('fixedOccupancy')?.fixedOccupancy;
        if (!Array.isArray(rows) || !rows[index]) return;
        rows[index][field] = String(value || '').trim();
        __tmAgentPolicyView.preview = null;
    };

    window.tmAgentPolicyRemoveOccupancy = function (index) {
        const config = __tmAgentPolicyEditableConfig('fixedOccupancy');
        if (!Array.isArray(config?.fixedOccupancy)) return;
        config.fixedOccupancy.splice(Number(index), 1);
        __tmAgentPolicyRerender();
    };

    window.tmAgentPolicySetCustomInstructions = function (value) {
        const config = __tmAgentPolicyEditableConfig('customInstructions');
        if (!config) return;
        config.customInstructions = String(value || '').slice(0, 4000);
        __tmAgentPolicyView.preview = null;
    };

    window.tmAgentPolicySetDeadlineEnabled = function (value) {
        const config = __tmAgentPolicyEditableConfig('deadlinePriority');
        if (!config) return;
        config.deadlinePriority = config.deadlinePriority && typeof config.deadlinePriority === 'object' ? config.deadlinePriority : {};
        config.deadlinePriority.enabled = value === true;
        __tmAgentPolicyView.preview = null;
    };

    window.tmAgentPolicySetDeadlinePriority = function (value) {
        const config = __tmAgentPolicyEditableConfig('deadlinePriority');
        if (!config) return;
        config.deadlinePriority = config.deadlinePriority && typeof config.deadlinePriority === 'object' ? config.deadlinePriority : {};
        config.deadlinePriority.priority = ['high', 'medium', 'low'].includes(String(value || '')) ? String(value) : 'high';
        __tmAgentPolicyView.preview = null;
    };

    window.tmAgentPolicySetDefaultCalendar = function (value) {
        const config = __tmAgentPolicyEditableConfig('defaultCalendarID');
        if (!config) return;
        config.defaultCalendarID = String(value || '').trim();
        __tmAgentPolicyView.preview = null;
    };

    function __tmAgentPolicyValidateDurationDefaults(durationDefaults) {
        const fallbackMinutes = Number(durationDefaults?.fallbackMinutes);
        if (!Number.isFinite(fallbackMinutes) || fallbackMinutes < __TM_AGENT_DURATION_MINUTES_MIN || fallbackMinutes > __TM_AGENT_DURATION_MINUTES_MAX) {
            return `未命中时长应为 ${__TM_AGENT_DURATION_MINUTES_MIN}-${__TM_AGENT_DURATION_MINUTES_MAX} 分钟`;
        }
        for (const [index, rule] of (Array.isArray(durationDefaults?.rules) ? durationDefaults.rules : []).entries()) {
            if (!String(rule?.name || '').trim()) return `第 ${index + 1} 条时长规则缺少类型名称`;
            if (!(Array.isArray(rule?.keywords) && rule.keywords.some((keyword) => String(keyword || '').trim()))) return `第 ${index + 1} 条时长规则缺少关键词`;
            const minutes = Number(rule?.minutes);
            if (!Number.isFinite(minutes) || minutes < __TM_AGENT_DURATION_MINUTES_MIN || minutes > __TM_AGENT_DURATION_MINUTES_MAX) {
                return `第 ${index + 1} 条时长规则应为 ${__TM_AGENT_DURATION_MINUTES_MIN}-${__TM_AGENT_DURATION_MINUTES_MAX} 分钟`;
            }
        }
        return '';
    }

    function __tmAgentPolicyValidate(draft, includeDurationDefaults = true) {
        if (includeDurationDefaults) {
            const durationError = __tmAgentPolicyValidateDurationDefaults(draft?.durationDefaults);
            if (durationError) return durationError;
        }
        const configs = [
            draft.global,
            ...Object.values(draft.documentOverrides || {}),
            ...Object.values(draft.groupOverrides || {}),
        ];
        for (const config of configs) {
            if (String(config?.customInstructions || '').length > 4000) return '自定义要求不能超过 4000 字';
            const availability = config?.weeklyAvailability;
            if (availability && typeof availability === 'object') {
                for (const value of Object.values(availability)) {
                    const ranges = String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
                    if (ranges.some((item) => !/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(item))) return '可安排时间格式应为 09:00-12:00，多个时段用逗号分隔';
                }
            }
            for (const item of Array.isArray(config?.fixedOccupancy) ? config.fixedOccupancy : []) {
                if (!item.start || !item.end || item.end <= item.start) return '固定占用的结束时间必须晚于开始时间';
            }
        }
        return '';
    }

    window.tmAgentPolicySaveDurationDefaults = async function () {
        if (__tmAgentPolicyView.saving) return false;
        const error = __tmAgentPolicyValidateDurationDefaults(__tmAgentPolicyView.draft?.durationDefaults);
        if (error) return hint(error, 'warning');
        __tmAgentPolicyView.saving = true;
        __tmAgentPolicyView.savingTarget = 'duration';
        __tmAgentPolicyRerender();
        try {
            const preview = await __tmAgentPolicyCall('taskHorizonPreviewPolicyPatch', {
                expectedRevision: __tmAgentPolicyView.policy.revision,
                patch: {
                    durationDefaults: __tmAgentPolicyClone(__tmAgentPolicyView.draft.durationDefaults, __tmAgentPolicyDefaultDurationDefaults()),
                },
            });
            const applied = await __tmAgentPolicyCall('taskHorizonApplyPolicyPatch', {
                expectedRevision: preview.expectedRevision,
                previewToken: preview.previewToken,
            });
            const saved = __tmAgentPolicyNormalize(applied?.policy);
            __tmAgentPolicyView.policy = saved;
            __tmAgentPolicyView.draft.revision = saved.revision;
            __tmAgentPolicyView.draft.durationDefaults = __tmAgentPolicyClone(saved.durationDefaults, __tmAgentPolicyDefaultDurationDefaults());
            __tmAgentPolicyView.error = '';
            hint('任务默认时长已保存', 'success');
            return true;
        } catch (error2) {
            if (String(error2?.code || '') === 'STALE_REVISION') {
                await __tmLoadAgentPolicySettings(true);
                hint('安排规则已在其他位置发生变化，已重新读取最新设置，请重新修改后保存', 'warning');
            } else {
                __tmAgentPolicyView.error = String(error2?.message || error2 || '任务默认时长保存失败');
                hint(__tmAgentPolicyView.error, 'error');
            }
            return false;
        } finally {
            __tmAgentPolicyView.saving = false;
            __tmAgentPolicyView.savingTarget = '';
            __tmAgentPolicyRerender();
        }
    };

    window.tmAgentPolicySave = async function () {
        if (__tmAgentPolicyView.saving) return false;
        const error = __tmAgentPolicyValidate(__tmAgentPolicyView.draft, false);
        if (error) return hint(error, 'warning');
        const documentOverrides = __tmAgentPolicyClone(__tmAgentPolicyView.draft.documentOverrides, {});
        const groupOverrides = __tmAgentPolicyClone(__tmAgentPolicyView.draft.groupOverrides, {});
        __tmAgentPolicyView.deletedDocumentOverrides.forEach((id) => { documentOverrides[id] = null; });
        __tmAgentPolicyView.deletedGroupOverrides.forEach((id) => { groupOverrides[id] = null; });
        __tmAgentPolicyView.saving = true;
        __tmAgentPolicyView.savingTarget = 'other';
        __tmAgentPolicyRerender();
        try {
            const preview = await __tmAgentPolicyCall('taskHorizonPreviewPolicyPatch', {
                expectedRevision: __tmAgentPolicyView.policy.revision,
                patch: {
                    global: __tmAgentPolicyClone(__tmAgentPolicyView.draft.global, {}),
                    documentOverrides,
                    groupOverrides,
                },
            });
            const pendingDurationDefaults = __tmAgentPolicyClone(__tmAgentPolicyView.draft.durationDefaults, __tmAgentPolicyDefaultDurationDefaults());
            const applied = await __tmAgentPolicyCall('taskHorizonApplyPolicyPatch', {
                expectedRevision: preview.expectedRevision,
                previewToken: preview.previewToken,
            });
            const saved = __tmAgentPolicyNormalize(applied?.policy);
            __tmAgentPolicyView.policy = saved;
            __tmAgentPolicyView.draft = __tmAgentPolicyClone(saved, __tmAgentPolicyNormalize(null));
            __tmAgentPolicyView.draft.durationDefaults = pendingDurationDefaults;
            __tmAgentPolicyView.deletedDocumentOverrides.clear();
            __tmAgentPolicyView.deletedGroupOverrides.clear();
            __tmAgentPolicyView.error = '';
            hint('其他安排规则已保存', 'success');
        } catch (error2) {
            if (String(error2?.code || '') === 'STALE_REVISION') {
                await __tmLoadAgentPolicySettings(true);
                hint('安排规则已在其他位置发生变化，已重新读取最新设置，请重新修改后保存', 'warning');
            } else {
                __tmAgentPolicyView.error = String(error2?.message || error2 || '安排规则保存失败');
                hint(__tmAgentPolicyView.error, 'error');
            }
        } finally {
            __tmAgentPolicyView.saving = false;
            __tmAgentPolicyView.savingTarget = '';
            __tmAgentPolicyRerender();
        }
    };

    window.tmAgentPolicyReload = async function () {
        __tmAgentPolicyView.error = '';
        await __tmLoadAgentPolicySettings(true);
        __tmAgentPolicyRerender();
    };
