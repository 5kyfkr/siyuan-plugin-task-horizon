    window.tmUpdateAiEnabled = async function(enabled) {
        SettingsStore.data.aiEnabled = !!enabled;
        await SettingsStore.save();
        showSettings();
    };
    window.tmUpdateAiConversationFontSize = async function(value) {
        const n = Number(value);
        const size = Number.isFinite(n) ? Math.max(12, Math.min(22, Math.round(n))) : 14;
        SettingsStore.data.aiConversationFontSize = size;
        await SettingsStore.save();
        try { globalThis.__tmAI?.setConversationFontSize?.(size); } catch (e) {}
    };
    window.tmUpdateAiExperienceMode = async function(value) {
        const mode = String(value || '').trim() === 'legacy' ? 'legacy' : 'agent';
        const previousMode = String(SettingsStore.data.aiExperienceMode || '').trim() === 'legacy' ? 'legacy' : 'agent';
        if (mode === previousMode) return true;
        if (globalThis.__tmAI?.isBusy?.() === true) {
            hint('请先停止当前 AI 请求，再切换工作方式', 'warning');
            showSettings();
            return false;
        }
        try {
            if (typeof globalThis.__taskHorizonSetAiExperienceMode === 'function') {
                const ready = await globalThis.__taskHorizonSetAiExperienceMode(mode, {
                    open: SettingsStore.data.aiSideDockEnabled === true,
                });
                if (!ready) throw new Error('目标 AI 运行时未就绪');
            }
            SettingsStore.data.aiExperienceMode = mode;
            SettingsStore.data.aiExperienceModeInitialized = true;
            await SettingsStore.save();
        } catch (e) {
            SettingsStore.data.aiExperienceMode = previousMode;
            try {
                await globalThis.__taskHorizonSetAiExperienceMode?.(previousMode, {
                    open: SettingsStore.data.aiSideDockEnabled === true,
                });
            } catch (restoreError) {}
            hint(`切换失败：${String(e?.message || e || '未知错误')}`, 'error');
            showSettings();
            return false;
        }
        showSettings();
        return true;
    };
    let __tmAgentMcpEntitlementSyncPromise = null;
    let __tmAgentMcpCapabilities = null;

    function __tmAgentMcpHasFullFeature() {
        return typeof window.tmLicenseHasFeature === 'function' && window.tmLicenseHasFeature('pro');
    }

    function __tmRememberAgentMcpCapabilities(value) {
        if (!value || typeof value !== 'object' || !Array.isArray(value.toolGroups)) return false;
        const wasEmpty = !__tmAgentMcpCapabilities;
        __tmAgentMcpCapabilities = value;
        return wasEmpty;
    }

    async function __tmLoadAgentMcpCapabilities() {
        const kernel = globalThis.__taskHorizonHostBridge?.kernel || globalThis.__taskHorizonHostBridge?.plugin?.kernel;
        const method = kernel?.rpc?.call?.taskHorizonGetCapabilities;
        if (typeof method !== 'function') return null;
        try {
            const result = await method();
            if (!result || result.ok !== true) return null;
            __tmRememberAgentMcpCapabilities(result.data);
            return result.data;
        } catch (e) {
            return null;
        }
    }

    async function __tmSyncAgentMcpAuthorization(allowed, enabled) {
        const kernel = globalThis.__taskHorizonHostBridge?.kernel || globalThis.__taskHorizonHostBridge?.plugin?.kernel;
        const method = kernel?.rpc?.call?.taskHorizonSyncMcpEntitlement;
        if (typeof method !== 'function') return null;
        const input = { allowed: allowed === true };
        if (typeof enabled === 'boolean') input.enabled = enabled === true;
        const result = await method(input);
        if (!result || result.ok !== true) throw new Error(String(result?.error?.message || '任务工具权益同步失败'));
        __tmRememberAgentMcpCapabilities(result.data);
        return result.data;
    }

    window.tmGetAgentMcpToolGroups = function() {
        const groups = __tmAgentMcpCapabilities?.toolGroups;
        return Array.isArray(groups) ? groups : [];
    };

    async function __tmSetAgentMcpEnabled(enabled, options = {}) {
        const opt = options && typeof options === 'object' ? options : {};
        const allowed = __tmAgentMcpHasFullFeature();
        const next = allowed && enabled === true;
        const kernel = globalThis.__taskHorizonHostBridge?.kernel || globalThis.__taskHorizonHostBridge?.plugin?.kernel;
        const method = kernel?.rpc?.call?.taskHorizonSetMcpEnabled;
        if (typeof method !== 'function') {
            SettingsStore.data.agentMcpEnabled = false;
            await SettingsStore.save();
            if (opt.notify !== false) hint('任务 MCP 工具服务未启动，请重启思源笔记后再试', 'warning');
            if (opt.refreshSettings !== false) showSettings();
            return false;
        }
        try {
            await __tmSyncAgentMcpAuthorization(allowed, next);
            const result = await method(next);
            if (!result || result.ok !== true) throw new Error(String(result?.error?.message || '任务工具设置失败'));
            const capabilitiesLoaded = __tmRememberAgentMcpCapabilities(result.data);
            SettingsStore.data.agentMcpEnabled = allowed && result.data?.mcpEnabled === true;
            if (allowed) SettingsStore.data.agentMcpEnabledInitialized = true;
            await SettingsStore.save();
            if (opt.notify !== false) {
                if (!allowed && enabled === true) hint('任务 MCP 工具属于全功能权益，免费版保持关闭', 'warning');
                else hint(SettingsStore.data.agentMcpEnabled ? '任务 MCP 工具已启用' : '任务 MCP 工具已停用', 'success');
            }
            if (capabilitiesLoaded && opt.refreshSettings === false && state.settingsModal && state.settingsActiveTab === 'ai') {
                setTimeout(() => showSettings(), 0);
            }
        } catch (e) {
            const current = await __tmLoadAgentMcpCapabilities();
            SettingsStore.data.agentMcpEnabled = allowed && current?.mcpEnabled === true;
            await SettingsStore.save();
            if (opt.notify !== false) hint(`任务工具设置失败：${String(e?.message || e || '未知错误')}`, 'error');
        }
        if (opt.refreshSettings !== false) showSettings();
        return SettingsStore.data.agentMcpEnabled;
    }

    async function __tmSyncAgentMcpEntitlementDefault() {
        if (__tmAgentMcpEntitlementSyncPromise) return await __tmAgentMcpEntitlementSyncPromise;
        __tmAgentMcpEntitlementSyncPromise = Promise.resolve().then(async () => {
            if (!SettingsStore.loaded) await SettingsStore.load();
            try { await window.tmLicenseLoad?.(false); } catch (e) {}
            const allowed = __tmAgentMcpHasFullFeature();
            const initialized = SettingsStore.data.agentMcpEnabledInitialized === true;
            const authorized = await __tmSyncAgentMcpAuthorization(allowed);
            const current = authorized || await __tmLoadAgentMcpCapabilities();
            const desired = allowed && (initialized ? current?.mcpEnabled === true : true);
            return await __tmSetAgentMcpEnabled(desired, { notify: false, refreshSettings: false });
        }).finally(() => {
            __tmAgentMcpEntitlementSyncPromise = null;
        });
        return await __tmAgentMcpEntitlementSyncPromise;
    }

    window.tmUpdateAgentMcpEnabled = async function(enabled) {
        return await __tmSetAgentMcpEnabled(enabled === true, { notify: true, refreshSettings: true });
    };

    async function __tmSetAgentMcpToolConfig(input) {
        if (!__tmAgentMcpHasFullFeature()) {
            hint('任务 MCP 工具属于全功能权益', 'warning');
            showSettings();
            return false;
        }
        if (SettingsStore.data.agentMcpEnabled !== true) {
            hint('请先启用任务 MCP 工具', 'warning');
            showSettings();
            return false;
        }
        const kernel = globalThis.__taskHorizonHostBridge?.kernel || globalThis.__taskHorizonHostBridge?.plugin?.kernel;
        const method = kernel?.rpc?.call?.taskHorizonSetMcpToolConfig;
        if (typeof method !== 'function') {
            hint('当前思源版本不支持单独设置工具', 'warning');
            return false;
        }
        try {
            const result = await method(input || {});
            if (!result || result.ok !== true) throw new Error(String(result?.error?.message || '工具设置失败'));
            __tmRememberAgentMcpCapabilities(result.data);
            SettingsStore.data.agentMcpEnabled = result.data?.mcpEnabled === true;
            await SettingsStore.save();
            hint(input?.enabled === true ? '工具已启用' : '工具已关闭', 'success');
            showSettings();
            return true;
        } catch (error) {
            hint(`工具设置失败：${String(error?.message || error || '未知错误')}`, 'error');
            showSettings();
            return false;
        }
    }

    window.tmUpdateAgentMcpTool = async function(toolName, enabled) {
        return await __tmSetAgentMcpToolConfig({ toolName: String(toolName || '').trim(), enabled: enabled === true });
    };

    window.tmUpdateAgentMcpGroup = async function(groupID, enabled) {
        return await __tmSetAgentMcpToolConfig({ groupID: String(groupID || '').trim(), enabled: enabled === true });
    };

    try {
        globalThis.__tmRuntimeEvents?.on?.(window, 'tm:task-horizon-license-changed', () => {
            void __tmSyncAgentMcpEntitlementDefault();
        });
    } catch (e) {}
    Promise.resolve().then(async () => {
        await __tmSyncAgentMcpEntitlementDefault();
    }).catch(() => null);
    function __tmResolveAiProvider(raw) {
        const v = String(raw || '').trim();
        if (v === 'deepseek') return 'deepseek';
        if (v === 'openai') return 'openai';
        if (v === 'anthropic') return 'anthropic';
        return 'minimax';
    }
    window.tmUpdateAiProvider = async function(value) {
        SettingsStore.data.aiProvider = __tmResolveAiProvider(value);
        await SettingsStore.save();
        showSettings();
    };
    window.tmUpdateAiApiKey = async function(value) {
        const provider = __tmResolveAiProvider(SettingsStore.data.aiProvider);
        const next = String(value || '').trim();
        if (provider === 'deepseek') SettingsStore.data.aiDeepSeekApiKey = next;
        else if (provider === 'openai') SettingsStore.data.aiOpenAIApiKey = next;
        else if (provider === 'anthropic') SettingsStore.data.aiAnthropicApiKey = next;
        else SettingsStore.data.aiMiniMaxApiKey = next;
        await SettingsStore.save();
    };
    window.tmUpdateAiBaseUrl = async function(value) {
        const provider = __tmResolveAiProvider(SettingsStore.data.aiProvider);
        const fallback = provider === 'deepseek'
            ? 'https://api.deepseek.com'
            : (provider === 'openai'
                ? 'https://api.openai.com/v1'
                : (provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.minimaxi.com/anthropic'));
        const next = (String(value || '').trim() || fallback).replace(/\/+$/, '');
        if (provider === 'deepseek') SettingsStore.data.aiDeepSeekBaseUrl = next;
        else if (provider === 'openai') SettingsStore.data.aiOpenAIBaseUrl = next;
        else if (provider === 'anthropic') SettingsStore.data.aiAnthropicBaseUrl = next;
        else SettingsStore.data.aiMiniMaxBaseUrl = next;
        await SettingsStore.save();
    };
    window.tmUpdateAiModel = async function(value) {
        const provider = __tmResolveAiProvider(SettingsStore.data.aiProvider);
        const next = String(value || '').trim();
        if (provider === 'deepseek') SettingsStore.data.aiDeepSeekModel = next || 'deepseek-v4-flash';
        else if (provider === 'openai') SettingsStore.data.aiOpenAIModel = next || 'gpt-5.4-mini';
        else if (provider === 'anthropic') SettingsStore.data.aiAnthropicModel = next || 'claude-sonnet-4-5';
        else SettingsStore.data.aiMiniMaxModel = next || 'MiniMax-M2.7-highspeed';
        await SettingsStore.save();
    };
    window.tmUpdateAiTemperature = async function(value) {
        const n = Number(value);
        SettingsStore.data.aiMiniMaxTemperature = Number.isFinite(n) ? Math.max(0, Math.min(1.5, n)) : 0.2;
        await SettingsStore.save();
    };
    window.tmUpdateAiMaxTokens = async function(value) {
        const n = Number(value);
        SettingsStore.data.aiMiniMaxMaxTokens = Number.isFinite(n) ? Math.max(256, Math.min(8192, Math.round(n))) : 1600;
        await SettingsStore.save();
    };
    window.tmUpdateAiTimeoutMs = async function(value) {
        const n = Number(value);
        SettingsStore.data.aiMiniMaxTimeoutMs = Number.isFinite(n) ? Math.max(5000, Math.min(180000, Math.round(n))) : 30000;
        await SettingsStore.save();
    };
    window.tmUpdateAiDefaultContextMode = async function(value) {
        SettingsStore.data.aiDefaultContextMode = String(value || '').trim() === 'fulltext' ? 'fulltext' : 'nearby';
        await SettingsStore.save();
    };
    window.tmUpdateAiScheduleWindows = async function(value) {
        const list = String(value || '').split(/\r?\n/).map(v => String(v || '').trim()).filter(Boolean);
        SettingsStore.data.aiScheduleWindows = list.length ? list : ['09:00-18:00'];
        await SettingsStore.save();
    };
    window.tmAiTestConnection = async function() {
        const ready = await __tmEnsureAiRuntimeLoaded();
        const fn = ready ? globalThis.__tmAI?.testConnection : null;
        if (typeof fn !== 'function') {
            hint('⚠ AI 模块尚未加载完成', 'warning');
            return;
        }
        try {
            await fn();
        } catch (e) {}
    };

    window.saveSettings = async function() {
        // 同步到 SettingsStore 并保存到本地插件存储
        SettingsStore.data.selectedDocIds = state.selectedDocIds;
        SettingsStore.data.queryLimit = __TM_TASK_INDEX_QUERY_LIMIT;
        SettingsStore.data.showCompletionTime = state.showCompletionTime;
        SettingsStore.data.groupByDocName = state.groupByDocName;
        SettingsStore.data.groupByTime = state.groupByTime;
        await SettingsStore.save();
        hint('✅ 设置已保存', 'success');
        render();
        closeSettings();
    };

    // 全局点击监听器，用于点击窗口外关闭
    __tmGlobalClickHandler = (e) => {
        // 关闭主模态框
        if (state.modal && e.target === state.modal) {
            tmClose();
        }
        // 关闭设置模态框
        if (state.settingsModal && e.target === state.settingsModal) {
            closeSettings();
        }
        // 关闭规则管理模态框
        if (state.rulesModal && e.target === state.rulesModal) {
            closeRulesManager();
        }
        // 关闭提示框
        const promptModal = document.querySelector('.tm-prompt-modal');
        if (promptModal && e.target === promptModal) {
            // 取消操作
            promptModal.remove();
            if (window._tmPromptResolve) {
                window._tmPromptResolve(null);
                window._tmPromptResolve = null;
            }
        }
    };
    window.addEventListener('click', __tmGlobalClickHandler);

    // 初始化
    /**
     * 在移动端文档顶栏右上角添加任务管理按钮
     * 复用单例按钮，避免文档重新加载时反复销毁/重建图标
     */
    let breadcrumbTimer = null;
    let breadcrumbTries = 0;
