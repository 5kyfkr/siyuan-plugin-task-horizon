    window.tmUpdateAiEnabled = async function(enabled) {
        SettingsStore.data.aiEnabled = !!enabled;
        await SettingsStore.save();
        showSettings();
    };
    window.tmUpdateAiProvider = async function(value) {
        SettingsStore.data.aiProvider = String(value || '').trim() === 'deepseek' ? 'deepseek' : 'minimax';
        await SettingsStore.save();
        showSettings();
    };
    window.tmUpdateAiApiKey = async function(value) {
        const provider = String(SettingsStore.data.aiProvider || '').trim() === 'deepseek' ? 'deepseek' : 'minimax';
        if (provider === 'deepseek') SettingsStore.data.aiDeepSeekApiKey = String(value || '').trim();
        else SettingsStore.data.aiMiniMaxApiKey = String(value || '').trim();
        await SettingsStore.save();
    };
    window.tmUpdateAiBaseUrl = async function(value) {
        const provider = String(SettingsStore.data.aiProvider || '').trim() === 'deepseek' ? 'deepseek' : 'minimax';
        const next = String(value || '').trim() || (provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.minimaxi.com/anthropic');
        if (provider === 'deepseek') SettingsStore.data.aiDeepSeekBaseUrl = next.replace(/\/+$/, '');
        else SettingsStore.data.aiMiniMaxBaseUrl = next.replace(/\/+$/, '');
        await SettingsStore.save();
    };
    window.tmUpdateAiModel = async function(value) {
        const provider = String(SettingsStore.data.aiProvider || '').trim() === 'deepseek' ? 'deepseek' : 'minimax';
        if (provider === 'deepseek') SettingsStore.data.aiDeepSeekModel = String(value || '').trim() || 'deepseek-chat';
        else SettingsStore.data.aiMiniMaxModel = String(value || '').trim() || 'MiniMax-M2.5';
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
        SettingsStore.data.queryLimit = state.queryLimit;
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

