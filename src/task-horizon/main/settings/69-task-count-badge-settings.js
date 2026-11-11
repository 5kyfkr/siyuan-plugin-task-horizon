    function __tmRenderTaskCountBadgeSettings(renderSwitch, renderField) {
        const cfg = __tmNormalizeTaskCountBadge(SettingsStore.data.taskCountBadge);
        const result = globalThis.__tmTaskCountBadge.getResult();
        const mobile = __tmIsRuntimeMobileClient();
        const topbarEnabled = SettingsStore.data[mobile ? 'windowTopbarIconMobile' : 'windowTopbarIconDesktop'] !== false;
        const dockEnabled = mobile ? SettingsStore.data.mobileSidebarEnabled === true : SettingsStore.data.dockSidebarEnabled !== false;
        const rules = SettingsStore.data.filterRules || [];
        const groups = SettingsStore.data.docGroups || [];
        const switchInput = (key, checked) => `<input class="b3-switch fn__flex-center" type="checkbox" ${checked ? 'checked' : ''} onchange="tmUpdateTaskCountBadge('${key}', this.checked)">`;
        const select = (key, options, value) => `<select class="b3-select" aria-label="${key === 'ruleId' ? __tmT("settings.statisticsRule") : key === 'groupId' ? __tmT("calendar.documentGroups") : __tmT("kernel.documentScope")}" onchange="tmUpdateTaskCountBadge('${key}', this.value)">${options.map(([id, name]) => `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select>`;
        const entryIcon = '<svg class="tm-task-count-preview-icon" aria-hidden="true"><use href="#iconTaskHorizon"></use></svg>';
        const preview = `<span class="tm-task-count-preview">${entryIcon}<span class="tm-task-count-badge">3</span></span>`;
        const entryTitle = (text) => `<span class="tm-task-count-entry-title">${preview}${text}</span>`;
        const ruleOptions = [['', __tmT("calendar.all")], ...rules.filter((item) => item.enabled !== false).map((item) => [item.id, item.name])];
        if (!ruleOptions.some(([id]) => id === cfg.ruleId)) ruleOptions.unshift([cfg.ruleId, __tmT("settings.theSelectedRuleIsNoLongerValid")]);
        const groupOptions = [['', __tmT("settings.selectDocumentGroups")], ...groups.map((group) => [group.id, group.name])];
        if (cfg.groupId && !groups.some((group) => group.id === cfg.groupId)) groupOptions.unshift([cfg.groupId, __tmT("settings.theSelectedGroupIsNoLongerValid")]);
        return `<div class="tm-settings-panel tm-task-count-settings" data-tm-settings-section="task-count-badge" data-tm-settings-page="appearance" data-tm-settings-subpage="l-icon" ${__tmSettingsSearchAttrs('appearance', __tmT("settings.taskCountBadge"), __tmT("settings.todaySTasksStatisticsRuleDocumentScopeTopBar"), { section: 'task-count-badge' })}>
            <div class="tm-settings-section-title">${__tmT("settings.taskCountBadge")}</div>
            ${renderSwitch(__tmT("settings.enableTheTaskCountBadge"), __tmT("settings.theTopBarAndTheTaskDockShareThe"), switchInput('enabled', cfg.enabled), { section: 'task-count-badge' })}
            ${renderSwitch(entryTitle(__tmT("settings.siyuanWindowTopBar")), __tmT("settings.showsTheCountOnTheTaskManagerIconIn"), switchInput('topbar', cfg.topbar), { section: 'task-count-badge' })}
            ${!topbarEnabled ? `<div class="tm-task-count-entry-note">${__tmT("settings.topBarEntryIsDisabled")}<button class="tm-btn tm-btn-secondary" type="button" onclick="${mobile ? 'updateWindowTopbarIconMobile' : 'updateWindowTopbarIconDesktop'}(true)">${__tmT("settings.showTopBarEntry")}</button></div>` : ''}
            ${renderSwitch(entryTitle(__tmT("settings.taskDockSidebar")), __tmT("settings.showsTheCountOnTheTaskManagerIconIn2"), switchInput('dock', cfg.dock), { section: 'task-count-badge' })}
            ${!dockEnabled ? `<div class="tm-task-count-entry-note">${__tmT("settings.taskDockEntryIsDisabled")}<button class="tm-btn tm-btn-secondary" type="button" onclick="${mobile ? 'updateMobileSidebarEnabled' : 'updateDockSidebarEnabled'}(true)">${__tmT("settings.showSidebarEntry")}</button></div>` : ''}
            ${renderField(__tmT("settings.statisticsRule"), __tmT("settings.countsByTheTodaySTasksRuleByDefault"), `${select('ruleId', ruleOptions, cfg.ruleId)}<button class="tm-btn tm-btn-secondary" type="button" onclick="tmOpenSettingsV2Page('algo', 'r-rules')">${__tmT("settings.manageRules")}</button>`, { section: 'task-count-badge' })}
            ${renderSwitch(__tmT("settings.countUnfinishedTasksOnly"), __tmT("settings.excludesCompletedAbandonedAndCheckInTodayTasksWhen"), switchInput('unfinishedOnly', cfg.unfinishedOnly), { section: 'task-count-badge' })}
            ${renderField(__tmT("kernel.documentScope"), __tmT("settings.aFixedScopeThatDoesNotFollowTheCurrent"), select('scope', [['all', __tmT("settings.allConfiguredDocuments")], ['group', __tmT("calendar.specifiedDocumentGroups")]], cfg.scope), { section: 'task-count-badge' })}
            ${cfg.scope === 'group' ? renderField(__tmT("calendar.documentGroups"), __tmT("settings.reusesTheGroupSDocumentSourcesSubdocumentAndExclusion"), select('groupId', groupOptions, cfg.groupId), { section: 'task-count-badge' }) : ''}
            ${renderSwitch(__tmT("settings.hideWhenTheCountIsZero"), __tmT("settings.countsAboveAreShownAsHoverToSeeThe"), switchInput('hideZero', cfg.hideZero), { section: 'task-count-badge' })}
            <div class="tm-task-count-status-row" ${__tmSettingsSearchAttrs('appearance', __tmT("settings.badgeResult"), __tmT("settings.refreshTaskCount"), { section: 'task-count-badge' })}><span data-tm-task-count-status>${esc(result.message || (result.status === 'ready' ? __tmT("task.items2", { label: result.label, count: result.count }) : cfg.enabled ? __tmT("settings.waitingForTheResult") : __tmT("task.badgeIsDisabled")))}</span>
                <button class="tm-btn tm-btn-secondary" type="button" onclick="tmRefreshTaskCountBadge()" ${cfg.enabled ? '' : 'disabled'}>${__tmT("settings.refreshCount")}</button></div>
            <div class="tm-setting-field-desc">${__tmT("settings.theBadgeUsesTheCurrentPluginIconPresetThe")}</div>
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
