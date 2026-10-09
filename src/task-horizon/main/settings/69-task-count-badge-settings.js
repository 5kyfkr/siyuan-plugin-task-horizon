    function __tmRenderTaskCountBadgeSettings(renderSwitch, renderField) {
        const cfg = __tmNormalizeTaskCountBadge(SettingsStore.data.taskCountBadge);
        const result = globalThis.__tmTaskCountBadge.getResult();
        const mobile = __tmIsRuntimeMobileClient();
        const topbarEnabled = SettingsStore.data[mobile ? 'windowTopbarIconMobile' : 'windowTopbarIconDesktop'] !== false;
        const dockEnabled = mobile ? SettingsStore.data.mobileSidebarEnabled === true : SettingsStore.data.dockSidebarEnabled !== false;
        const rules = SettingsStore.data.filterRules || [];
        const groups = SettingsStore.data.docGroups || [];
        const switchInput = (key, checked) => `<input class="b3-switch fn__flex-center" type="checkbox" ${checked ? 'checked' : ''} onchange="tmUpdateTaskCountBadge('${key}', this.checked)">`;
        const select = (key, options, value) => `<select class="b3-select" aria-label="${key === 'ruleId' ? '统计规则' : key === 'groupId' ? '文档分组' : '文档范围'}" onchange="tmUpdateTaskCountBadge('${key}', this.value)">${options.map(([id, name]) => `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select>`;
        const entryIcon = '<svg class="tm-task-count-preview-icon" aria-hidden="true"><use href="#iconTaskHorizon"></use></svg>';
        const preview = `<span class="tm-task-count-preview">${entryIcon}<span class="tm-task-count-badge">3</span></span>`;
        const entryTitle = (text) => `<span class="tm-task-count-entry-title">${preview}${text}</span>`;
        const ruleOptions = rules.filter((item) => item.enabled !== false).map((item) => [item.id, item.name]);
        if (!ruleOptions.some(([id]) => id === cfg.ruleId)) ruleOptions.unshift([cfg.ruleId, '所选规则已失效']);
        const groupOptions = [['', '请选择文档分组'], ...groups.map((group) => [group.id, group.name])];
        if (cfg.groupId && !groups.some((group) => group.id === cfg.groupId)) groupOptions.unshift([cfg.groupId, '所选分组已失效']);
        return `<div class="tm-settings-panel tm-task-count-settings" data-tm-settings-section="task-count-badge" data-tm-settings-page="appearance" data-tm-settings-subpage="l-icon" ${__tmSettingsSearchAttrs('appearance', '任务数量角标', '今日任务 统计规则 文档范围 顶栏 Dock 侧栏 数量', { section: 'task-count-badge' })}>
            <div class="tm-settings-section-title">任务数量角标</div>
            ${renderSwitch('启用任务数量角标', '顶栏和任务 Dock 共用统计结果；在文档中完成任务也会更新。', switchInput('enabled', cfg.enabled), { section: 'task-count-badge' })}
            ${renderSwitch(entryTitle('思源窗口顶栏'), '在窗口顶栏的任务管理器图标上显示数量。', switchInput('topbar', cfg.topbar), { section: 'task-count-badge' })}
            ${!topbarEnabled ? `<div class="tm-task-count-entry-note">顶栏入口已关闭 <button class="tm-btn tm-btn-secondary" type="button" onclick="${mobile ? 'updateWindowTopbarIconMobile' : 'updateWindowTopbarIconDesktop'}(true)">显示顶栏入口</button></div>` : ''}
            ${renderSwitch(entryTitle('任务 Dock 侧栏'), '在侧栏的任务管理器图标上显示数量，侧栏收起时仍会更新。', switchInput('dock', cfg.dock), { section: 'task-count-badge' })}
            ${!dockEnabled ? `<div class="tm-task-count-entry-note">任务侧栏入口已关闭 <button class="tm-btn tm-btn-secondary" type="button" onclick="${mobile ? 'updateMobileSidebarEnabled' : 'updateDockSidebarEnabled'}(true)">显示侧栏入口</button></div>` : ''}
            ${renderField('统计规则', '默认按“今日任务”规则统计；可选择其他已保存规则。', `${select('ruleId', ruleOptions, cfg.ruleId)}<button class="tm-btn tm-btn-secondary" type="button" onclick="tmOpenSettingsV2Page('algo', 'r-rules')">管理规则</button>`, { section: 'task-count-badge' })}
            ${renderSwitch('仅统计未完成任务', '排除已完成、放弃和今日已打卡任务；关闭后完全按所选规则统计。', switchInput('unfinishedOnly', cfg.unfinishedOnly), { section: 'task-count-badge' })}
            ${renderField('文档范围', '固定统计范围，不随当前文档、分组或搜索条件变化。', select('scope', [['all', '全部已配置文档'], ['group', '指定文档分组']], cfg.scope), { section: 'task-count-badge' })}
            ${cfg.scope === 'group' ? renderField('文档分组', '沿用该分组的文档来源、子文档和排除设置。', select('groupId', groupOptions, cfg.groupId), { section: 'task-count-badge' }) : ''}
            ${renderSwitch('数量为零时隐藏', '超过 99 项显示为 99+，悬停可查看完整数量。', switchInput('hideZero', cfg.hideZero), { section: 'task-count-badge' })}
            <div class="tm-task-count-status-row" ${__tmSettingsSearchAttrs('appearance', '角标统计结果', '刷新任务数量', { section: 'task-count-badge' })}><span data-tm-task-count-status>${esc(result.message || (result.status === 'ready' ? `${result.label}：${result.count} 项` : cfg.enabled ? '等待统计结果' : '角标已关闭'))}</span>
                <button class="tm-btn tm-btn-secondary" type="button" onclick="tmRefreshTaskCountBadge()" ${cfg.enabled ? '' : 'disabled'}>刷新数量</button></div>
            <div class="tm-setting-field-desc">角标使用当前插件图标预设；首次统计在启动后执行。任务数量按实际命中的任务计算。</div>
        </div>`;
    }

    window.tmUpdateTaskCountBadge = async function(key, value) {
        const cfg = __tmNormalizeTaskCountBadge(SettingsStore.data.taskCountBadge);
        if (!Object.prototype.hasOwnProperty.call(cfg, key)) return;
        SettingsStore.data.taskCountBadge = __tmNormalizeTaskCountBadge({ ...cfg, [key]: value });
        globalThis.__tmTaskCountBadge.configure();
        await SettingsStore.save();
        if (state.settingsModal) showSettings();
        globalThis.__tmTaskCountBadge.render();
    };
    window.tmRefreshTaskCountBadge = function() {
        globalThis.__tmTaskCountBadge.configure();
        globalThis.__tmTaskCountBadge.refresh();
    };
