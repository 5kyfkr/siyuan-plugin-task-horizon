    function __tmClearTimelineTodayIndicatorTimer() {
        try {
            if (__tmTimelineTodayIndicatorTimer != null) {
                clearTimeout(__tmTimelineTodayIndicatorTimer);
                __tmTimelineTodayIndicatorTimer = null;
            }
        } catch (e) {
            __tmTimelineTodayIndicatorTimer = null;
        }
    }

    function __tmRefreshTimelineTodayIndicatorInPlace() {
        if (state.viewMode !== 'timeline') return false;
        const modal = state.modal;
        if (!(modal instanceof Element) || !document.body.contains(modal)) return false;
        const body = modal.querySelector('#tmGanttBody');
        if (!(body instanceof HTMLElement)) return false;
        const todayLine = body.querySelector('.tm-gantt-today');
        if (!(todayLine instanceof HTMLElement)) return false;
        const startTs = Number(body.dataset.tmGanttStartTs);
        const dayWidth = Number(body.dataset.tmGanttDayWidth);
        const totalWidth = Number(body.dataset.tmGanttTotalWidth);
        const dayMs = Number(globalThis.__TaskHorizonGanttView?.DAY_MS) || 86400000;
        if (!Number.isFinite(startTs) || !Number.isFinite(dayWidth) || dayWidth <= 0 || !Number.isFinite(totalWidth) || totalWidth < 0) return false;
        const nextLeftRaw = ((Date.now() - startTs) / dayMs) * dayWidth;
        const nextLeft = Math.max(0, Math.min(totalWidth, nextLeftRaw));
        try { todayLine.style.left = `${nextLeft}px`; } catch (e) { return false; }
        return true;
    }

    function __tmGetTimelineTodayIndicatorDelayMs() {
        const intervalMs = __TM_TIMELINE_TODAY_REFRESH_MS;
        const now = Date.now();
        const remainder = now % intervalMs;
        const delay = remainder === 0 ? intervalMs : (intervalMs - remainder);
        return Math.max(1000, delay);
    }

    function __tmScheduleTimelineTodayIndicatorRefresh() {
        __tmClearTimelineTodayIndicatorTimer();
        if (!__tmRefreshTimelineTodayIndicatorInPlace()) return;
        const tick = () => {
            if (!__tmRefreshTimelineTodayIndicatorInPlace()) {
                __tmClearTimelineTodayIndicatorTimer();
                return;
            }
            __tmTimelineTodayIndicatorTimer = setTimeout(tick, __tmGetTimelineTodayIndicatorDelayMs());
        };
        __tmTimelineTodayIndicatorTimer = setTimeout(tick, __tmGetTimelineTodayIndicatorDelayMs());
    }

    function __tmShouldShowTopbarSelectorsInDesktopMenu() {
        const modal = state.modal instanceof HTMLElement ? state.modal : null;
        if (!(modal instanceof HTMLElement)) return false;
        const toolbar = modal.querySelector('.tm-header-selectors');
        if (!(toolbar instanceof HTMLElement)) return false;
        try {
            const computed = window.getComputedStyle(toolbar);
            if (!computed) return false;
            if (computed.display === 'none' || computed.visibility === 'hidden') return true;
        } catch (e) {}
        try {
            if (toolbar.getClientRects().length === 0) return true;
        } catch (e) {}
        return (Number(toolbar.offsetWidth) || 0) <= 0 || (Number(toolbar.offsetHeight) || 0) <= 0;
    }

    function __tmBuildDocGroupMenuOptions() {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const docGroups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        return [
            {
                value: 'all',
                label: '全部文档',
                selected: currentGroupId === 'all',
                action: `tmSwitchDocGroup('all')`
            },
            ...docGroups.map((group) => {
                const groupId = String(group?.id || '').trim();
                return {
                    value: groupId,
                    label: __tmResolveDocGroupName(group),
                    selected: currentGroupId === groupId,
                    action: `tmSwitchDocGroup('${escSq(groupId)}')`
                };
            })
        ];
    }

    function __tmBuildRuleMenuOptions() {
        return [
            {
                value: '',
                label: '全部',
                selected: !state.currentRule,
                action: `applyFilterRule('')`
            },
            ...state.filterRules
                .filter((rule) => rule.enabled)
                .map((rule) => {
                    const ruleId = String(rule?.id || '').trim();
                    return {
                        value: ruleId,
                        label: String(rule?.name || '').trim() || '未命名规则',
                        selected: state.currentRule === rule.id,
                        action: `applyFilterRule('${escSq(ruleId)}')`
                    };
                })
        ];
    }

    function __tmBuildGroupModeMenuOptions() {
        const hasTaskModeOption = !!(SettingsStore.data.groupByTaskName || state.groupByTaskName);
        return [
            {
                value: 'none',
                label: '不分组',
                selected: (!state.groupByDocName && !state.groupByTaskName && !state.groupByTime && !state.quadrantEnabled),
                action: `tmSwitchGroupMode('none')`
            },
            {
                value: 'doc',
                label: '按文档',
                selected: state.groupByDocName,
                action: `tmSwitchGroupMode('doc')`
            },
            {
                value: 'time',
                label: '按时间',
                selected: state.groupByTime,
                action: `tmSwitchGroupMode('time')`
            },
            {
                value: 'quadrant',
                label: '四象限',
                selected: state.quadrantEnabled,
                action: `tmSwitchGroupMode('quadrant')`
            },
            ...(hasTaskModeOption ? [{
                value: 'task',
                label: '按任务名',
                selected: state.groupByTaskName,
                action: `tmSwitchGroupMode('task')`
            }] : [])
        ];
    }

    let __desktopMenuUnstack = null;

    window.tmToggleDesktopMenu = function(e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }

        // 移除现有的菜单
        const existing = document.getElementById('tmDesktopMenu');
        if (existing) {
            try { if (state.desktopMenuCloseTimer) { clearTimeout(state.desktopMenuCloseTimer); state.desktopMenuCloseTimer = null; } } catch (e2) {}
            if (state.desktopMenuCloseHandler) {
                try { document.removeEventListener('click', state.desktopMenuCloseHandler); } catch (e2) {}
                state.desktopMenuCloseHandler = null;
            }
            __desktopMenuUnstack?.();
            __desktopMenuUnstack = null;
            __tmAnimatePopupOutAndRemove(existing);
            return;
        }

        const menu = document.createElement('div');
        menu.id = 'tmDesktopMenu';
        menu.className = 'tm-popup-menu bc-dropdown-menu';
        if (!__tmIsDarkMode()) menu.classList.add('tm-desktop-menu--light');
        menu.style.cssText = `
            position: fixed;
            background: var(--tm-ui-popover);
            border: var(--tm-topbar-control-border-width) solid var(--tm-ui-border);
            border-radius: calc(var(--tm-topbar-control-radius) + 2px);
            box-shadow: 0 10px 26px rgba(15,23,42,0.16);
            padding: 8px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 0;
            width: max-content;
            max-width: calc(100vw - 16px);
        `;
        const renderDesktopMenuButton = (labelHtml, action, extraClass = '') => `
            <div class="tm-desktop-menu-row ${extraClass}">
                <button type="button" class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="${action}" style="flex:1; padding: 6px 10px;">
                    <span class="tm-desktop-menu-btn-content">${labelHtml}</span>
                </button>
            </div>
        `;
        const renderDesktopMenuToggle = (labelText, checked, action, extraClass = '') => `
            <div class="tm-desktop-menu-row ${extraClass}">
                <label class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-desktop-menu-toggle" title="${esc(String(labelText || '').trim())}">
                    <span class="tm-desktop-menu-toggle-content"><span>${esc(String(labelText || '').trim())}</span></span>
                    <input class="b3-switch fn__flex-center" type="checkbox" ${checked ? 'checked' : ''} onchange="${action}">
                </label>
            </div>
        `;
        const renderDesktopMenuSelect = (labelText, selectHtml, extraClass = '') => `
            <div class="tm-desktop-menu-row tm-desktop-menu-row--select ${extraClass}">
                <span class="tm-desktop-menu-label">${esc(String(labelText || '').trim())}:</span>
                <div class="tm-desktop-menu-item__main">${selectHtml}</div>
            </div>
        `;
        const showTopbarSelectorsInMenu = __tmShouldShowTopbarSelectorsInDesktopMenu();
        const docGroupMenuOptions = showTopbarSelectorsInMenu ? __tmBuildDocGroupMenuOptions() : [];
        const ruleMenuOptions = showTopbarSelectorsInMenu ? __tmBuildRuleMenuOptions() : [];
        const groupModeMenuOptions = showTopbarSelectorsInMenu ? __tmBuildGroupModeMenuOptions() : [];
        if (showTopbarSelectorsInMenu) menu.classList.add('tm-desktop-menu--with-selects');

        menu.innerHTML = `
            ${showTopbarSelectorsInMenu ? renderDesktopMenuSelect('文档', __tmRenderTopbarSelect({ id: 'tmDesktopDocSelect', label: '文档', options: docGroupMenuOptions, style: 'flex:1;' })) : ''}
            ${showTopbarSelectorsInMenu ? renderDesktopMenuSelect('规则', __tmRenderTopbarSelect({ id: 'tmDesktopRuleSelect', label: '规则', options: ruleMenuOptions, style: 'flex:1;' })) : ''}
            ${showTopbarSelectorsInMenu ? renderDesktopMenuSelect('分组', __tmRenderTopbarSelect({ id: 'tmDesktopGroupModeSelect', label: '分组', options: groupModeMenuOptions, style: 'flex:1;' })) : ''}
            ${renderDesktopMenuButton(`${__tmRenderHomepageEntryIcon(14)}<span>${state.homepageOpen ? '返回工作区' : '主页总览'}</span>`, `tmToggleHomepage(); tmCloseDesktopMenu()`) }
            ${renderDesktopMenuButton(`${__tmRenderLucideIcon('search')}<span>搜索${state.searchKeyword ? ` (${esc(String(state.searchKeyword || '').trim())})` : ''}</span>`, `tmShowSearchModal(); tmCloseDesktopMenu()`)}
            ${renderDesktopMenuButton(`${__tmRenderLucideIcon('file-text')}<span>摘要</span>`, `tmShowSummaryModal(); tmCloseDesktopMenu()`)}
            ${String(state.viewMode || '').trim() === 'list' ? renderDesktopMenuButton(`${__tmRenderLucideIcon('chart-column')}<span>导出 Excel</span>`, `tmExportCurrentTableExcel(); tmCloseDesktopMenu()`) : ''}
            ${renderDesktopMenuButton(`${__tmRenderLucideIcon('calendar-days')}<span>语义日期</span>`, `window.tmAiSemanticCompletionPreview?.(); tmCloseDesktopMenu()`)}
            ${renderDesktopMenuToggle('多选模式', !!state.multiSelectModeEnabled, `tmToggleMultiSelectMode(this.checked); tmCloseDesktopMenu()`)}
            ${__tmIsAiFeatureEnabled() ? renderDesktopMenuToggle('AI 对话', !!SettingsStore.data.aiSideDockEnabled, `tmToggleAiSideDock(this.checked); tmCloseDesktopMenu()`) : ''}
            ${renderDesktopMenuToggle('日历侧边栏', !!SettingsStore.data.calendarSideDockEnabled, `tmToggleCalendarSideDock(this.checked); tmCloseDesktopMenu()`)}
            ${state.searchKeyword ? renderDesktopMenuButton(`<span>清除搜索</span>`, `tmSearch(''); tmCloseDesktopMenu()`) : ''}
            ${renderDesktopMenuToggle('白板顺序模式', !!SettingsStore.data.whiteboardSequenceMode, `tmToggleWhiteboardSequenceMode(this.checked); tmCloseDesktopMenu()`)}
            ${renderDesktopMenuButton(`${__tmRenderLucideIcon('chevrons-down-up')}<span>全部折叠</span>`, `tmCollapseAllTasks(); tmCloseDesktopMenu()`)}
            ${renderDesktopMenuButton(`${__tmRenderLucideIcon('chevrons-up-down')}<span>全部展开</span>`, `tmExpandAllTasks(); tmCloseDesktopMenu()`)}
        `;
        if (!__tmIsDarkMode()) {
            try {
                menu.querySelectorAll('.bc-btn, .bc-btn span, .tm-tree-toggle-icon').forEach((el) => {
                    try { el.style.setProperty('color', '#1f2329', 'important'); } catch (e2) {}
                });
                menu.querySelectorAll('.bc-btn').forEach((el) => {
                    try { el.style.setProperty('border-color', '#1f2329', 'important'); } catch (e2) {}
                });
                menu.querySelectorAll('.tm-tree-toggle-icon path').forEach((el) => {
                    try { el.style.setProperty('stroke', '#1f2329', 'important'); } catch (e2) {}
                });
            } catch (e2) {}
        }

        // 点击外部关闭
        const closeHandler = (ev) => {
            if (!menu.contains(ev.target) && ev.target !== e.target) {
                __desktopMenuUnstack?.();
                __desktopMenuUnstack = null;
                menu.remove();
                try { document.removeEventListener('click', closeHandler); } catch (e2) {}
                if (state.desktopMenuCloseHandler === closeHandler) state.desktopMenuCloseHandler = null;
            }
        };
        state.desktopMenuCloseHandler = closeHandler;
        try { if (state.desktopMenuCloseTimer) { clearTimeout(state.desktopMenuCloseTimer); state.desktopMenuCloseTimer = null; } } catch (e2) {}
        state.desktopMenuCloseTimer = setTimeout(() => {
            try { document.addEventListener('click', closeHandler); } catch (e2) {}
            try { state.desktopMenuCloseTimer = null; } catch (e2) {}
        }, 0);

        const trigger = e?.currentTarget instanceof Element
            ? e.currentTarget
            : (e?.target instanceof Element ? e.target.closest('.tm-desktop-menu-btn') : null);
        const rect = trigger instanceof Element ? trigger.getBoundingClientRect() : null;
        const fallbackWidth = 220;
        const left0 = rect ? Math.round(rect.right - fallbackWidth) : Math.max(8, window.innerWidth - fallbackWidth - 16);
        const top0 = rect ? Math.round(rect.bottom + 8) : 56;
        menu.style.left = `${Math.max(8, left0)}px`;
        menu.style.top = `${Math.max(8, top0)}px`;
        document.body.appendChild(menu);
        try {
            const menuRect = menu.getBoundingClientRect();
            const nextLeft = Math.min(
                Math.max(8, rect ? Math.round(rect.right - menuRect.width) : left0),
                Math.max(8, window.innerWidth - menuRect.width - 8)
            );
            const nextTop = Math.min(
                Math.max(8, top0),
                Math.max(8, window.innerHeight - menuRect.height - 8)
            );
            menu.style.left = `${nextLeft}px`;
            menu.style.top = `${nextTop}px`;
        } catch (e2) {}
        __tmAnimatePopupIn(menu, { origin: 'top-right' });
        __desktopMenuUnstack = __tmModalStackBind(window.tmCloseDesktopMenu);
    };

    window.tmCloseDesktopMenu = function() {
        __desktopMenuUnstack?.();
        __desktopMenuUnstack = null;
        try {
            if (state.desktopMenuCloseTimer) {
                clearTimeout(state.desktopMenuCloseTimer);
                state.desktopMenuCloseTimer = null;
            }
        } catch (e) {}
        if (state.desktopMenuCloseHandler) {
            try { document.removeEventListener('click', state.desktopMenuCloseHandler); } catch (e) {}
            state.desktopMenuCloseHandler = null;
        }
        try { __tmAnimatePopupOutAndRemove(document.getElementById('tmDesktopMenu')); } catch (e) {}
    };

    window.tmToggleWhiteboardSequenceMode = async function(enabled) {
        const next = (typeof enabled === 'boolean') ? enabled : !SettingsStore.data.whiteboardSequenceMode;
        SettingsStore.data.whiteboardSequenceMode = !!next;
        try { await SettingsStore.save(); } catch (e) {}
        try { applyFilters(); } catch (e) {}
        render();
    };

    function __tmHideMobileMenu() {
        const menu = document.getElementById('tmMobileMenu');
        if (menu instanceof HTMLElement) {
            try {
                if (menu.__tmHideAnim && typeof menu.__tmHideAnim.cancel === 'function') {
                    menu.__tmHideAnim.cancel();
                }
            } catch (e) {}
            if (__tmPopupMotionDisabled() || typeof menu.animate !== 'function') {
                try {
                    menu.style.display = 'none';
                    menu.style.opacity = '';
                    menu.style.transform = '';
                    delete menu.dataset.tmClosing;
                } catch (e) {}
            } else if (menu.style.display !== 'none') {
                if (menu.dataset.tmClosing !== 'true') {
                    try { menu.dataset.tmClosing = 'true'; } catch (e) {}
                    try {
                        const anim = menu.animate([
                            { opacity: 1, transform: 'translateY(0) scale(1)' },
                            { opacity: 0, transform: 'translateY(-4px) scale(0.985)' }
                        ], {
                            duration: 120,
                            easing: 'ease-out',
                            fill: 'forwards'
                        });
                        menu.__tmHideAnim = anim;
                        const finalize = () => {
                            try { menu.style.display = 'none'; } catch (e2) {}
                            try { menu.style.opacity = ''; } catch (e2) {}
                            try { menu.style.transform = ''; } catch (e2) {}
                            try { delete menu.dataset.tmClosing; } catch (e2) {}
                            try { menu.__tmHideAnim = null; } catch (e2) {}
                        };
                        anim.onfinish = finalize;
                        anim.oncancel = finalize;
                    } catch (e) {
                        try {
                            menu.style.display = 'none';
                            menu.style.opacity = '';
                            menu.style.transform = '';
                            delete menu.dataset.tmClosing;
                        } catch (e2) {}
                    }
                }
            }
        }
        try { if (state.mobileMenuCloseTimer) { clearTimeout(state.mobileMenuCloseTimer); state.mobileMenuCloseTimer = null; } } catch (e) {}
        if (state.mobileMenuCloseHandler) {
            try { document.removeEventListener('click', state.mobileMenuCloseHandler); } catch (e) {}
            try { document.removeEventListener('touchstart', state.mobileMenuCloseHandler); } catch (e) {}
            state.mobileMenuCloseHandler = null;
        }
    }

    window.tmToggleMobileMenu = function(e) {
        const menu = document.getElementById('tmMobileMenu');
        if (!menu) return;

        const now = Date.now();
        const type = String(e?.type || '');
        if (type.startsWith('touch')) {
            state.mobileMenuLastTouchTs = now;
        } else {
            const lastTouchTs = Number(state.mobileMenuLastTouchTs) || 0;
            if (lastTouchTs && now - lastTouchTs < 500) return;
        }
        if (e) {
            try { e.stopPropagation?.(); } catch (e2) {}
            try { e.preventDefault?.(); } catch (e2) {}
        }

        const open = menu.style.display !== 'none';
        if (!open) {
            try {
                if (menu.__tmHideAnim && typeof menu.__tmHideAnim.cancel === 'function') {
                    menu.__tmHideAnim.cancel();
                }
            } catch (e2) {}
            try { delete menu.dataset.tmClosing; } catch (e2) {}
            menu.style.display = 'block';
            try { __tmAnimatePopupIn(menu, { origin: 'top-right' }); } catch (e2) {}
            try {
                const switcher = menu.querySelector('.tm-mobile-view-switcher');
                if (switcher instanceof HTMLElement) {
                    const switcherWidth = switcher.getBoundingClientRect().width;
                    const sidePadding = 20; // 菜单左右各 10px 内边距
                    const hostWidth = (() => {
                        try {
                            const modal = menu.closest('.tm-modal');
                            if (modal instanceof HTMLElement) return Number(modal.clientWidth) || 0;
                        } catch (e3) {}
                        return 0;
                    })();
                    const maxWidth = Math.max(0, Math.min(
                        Math.max(0, window.innerWidth - 20),
                        hostWidth > 0 ? Math.max(180, hostWidth - 16) : Number.POSITIVE_INFINITY
                    ));
                    const nextWidth = Math.round(Math.min(maxWidth, Math.max(180, switcherWidth + sidePadding)));
                    if (nextWidth > 0) {
                        menu.style.setProperty('width', `${nextWidth}px`, 'important');
                        menu.style.setProperty('max-width', `${nextWidth}px`, 'important');
                        const contentMax = Math.max(120, nextWidth - sidePadding);
                        menu.querySelectorAll('.tm-mobile-only-item, .tm-mobile-menu-row').forEach((el) => {
                            if (!(el instanceof HTMLElement)) return;
                            try { el.style.setProperty('max-width', `${contentMax}px`, 'important'); } catch (e3) {}
                            try { el.style.setProperty('min-width', '0', 'important'); } catch (e3) {}
                        });
                    }
                }
            } catch (e2) {}
            try {
                requestAnimationFrame(() => {
                    try { __tmSyncTopbarOverflowTooltips(state.modal); } catch (e3) {}
                });
            } catch (e2) {}

            if (state.mobileMenuCloseHandler) {
                try { document.removeEventListener('click', state.mobileMenuCloseHandler); } catch (e2) {}
                try { document.removeEventListener('touchstart', state.mobileMenuCloseHandler); } catch (e2) {}
                state.mobileMenuCloseHandler = null;
            }
            const closeHandler = (ev) => {
                if (menu.contains(ev.target)) return;
                if (ev.target.closest('.tm-mobile-menu-btn')) return;
                __tmHideMobileMenu();
            };
            state.mobileMenuCloseHandler = closeHandler;

            try { if (state.mobileMenuCloseTimer) { clearTimeout(state.mobileMenuCloseTimer); state.mobileMenuCloseTimer = null; } } catch (e2) {}
            state.mobileMenuCloseTimer = setTimeout(() => {
                try { document.addEventListener('click', closeHandler); } catch (e2) {}
                try { document.addEventListener('touchstart', closeHandler, { passive: true }); } catch (e2) {}
                try { state.mobileMenuCloseTimer = null; } catch (e2) {}
            }, 0);
        } else {
            __tmHideMobileMenu();
        }
    };

    window.tmHideMobileMenu = function() {
        try { __tmHideMobileMenu(); } catch (e) {}
    };

    window.tmTouchMobileBottomViewbar = function(event) {
        try { event?.stopPropagation?.(); } catch (e) {}
        const target = event?.target instanceof Element ? event.target : null;
        const bar = target?.closest?.('.tm-mobile-bottom-viewbar');
        if (!(bar instanceof HTMLElement)) return;
        try { state.mobileBottomViewbarActiveUntil = Date.now() + 3000; } catch (e) {}
        try { bar.classList.add('tm-mobile-bottom-viewbar--active'); } catch (e) {}
        try {
            if (bar.__tmActiveTimer) clearTimeout(bar.__tmActiveTimer);
            if (state.mobileBottomViewbarTimer) clearTimeout(state.mobileBottomViewbarTimer);
        } catch (e) {}
        try {
            const clearActive = () => {
                try { state.mobileBottomViewbarActiveUntil = 0; } catch (e2) {}
                try { bar.classList.remove('tm-mobile-bottom-viewbar--active'); } catch (e2) {}
                try { state.modal?.querySelector?.('.tm-mobile-bottom-viewbar')?.classList?.remove?.('tm-mobile-bottom-viewbar--active'); } catch (e2) {}
                try { bar.__tmActiveTimer = 0; } catch (e2) {}
                try { state.mobileBottomViewbarTimer = 0; } catch (e2) {}
            };
            bar.__tmActiveTimer = setTimeout(clearActive, 3000);
            state.mobileBottomViewbarTimer = bar.__tmActiveTimer;
        } catch (e) {}
        try {
            const currentBar = state.modal?.querySelector?.('.tm-mobile-bottom-viewbar');
            if (currentBar && currentBar !== bar) {
                try { currentBar.classList.add('tm-mobile-bottom-viewbar--active'); } catch (e2) {}
                try { currentBar.__tmActiveTimer = state.mobileBottomViewbarTimer; } catch (e2) {}
            }
        } catch (e) {}
        try {
            if (target && target.closest?.('.tm-mobile-bottom-view-switcher')) {
                setTimeout(() => {
                    try {
                        const rerenderedBar = state.modal?.querySelector?.('.tm-mobile-bottom-viewbar');
                        if (rerenderedBar && Date.now() < (Number(state.mobileBottomViewbarActiveUntil) || 0)) {
                            rerenderedBar.classList.add('tm-mobile-bottom-viewbar--active');
                        }
                    } catch (e2) {}
                }, 0);
            }
        } catch (e) {}
    };

    window.tmTouchTimelineMobileToolbarButton = function(event) {
        const target = event?.target instanceof Element ? event.target : null;
        const btn = target?.closest?.('.tm-timeline-mobile-toolbar__btn');
        if (!(btn instanceof HTMLElement)) return;
        try {
            try { btn.blur?.(); } catch (e2) {}
            btn.classList.add('tm-timeline-mobile-toolbar__btn--active');
            if (btn.__tmActiveTimer) clearTimeout(btn.__tmActiveTimer);
            btn.__tmActiveTimer = setTimeout(() => {
                try { btn.classList.remove('tm-timeline-mobile-toolbar__btn--active'); } catch (e2) {}
                try { btn.blur?.(); } catch (e2) {}
                try { btn.__tmActiveTimer = 0; } catch (e2) {}
            }, 220);
        } catch (e) {}
    };

    function __tmCloseTopbarSelects() {
        try {
            if (state.__docTopbarSelectSyncTimer) {
                clearTimeout(state.__docTopbarSelectSyncTimer);
                state.__docTopbarSelectSyncTimer = null;
            }
        } catch (e) {}
        state.__topbarSelectUnstack?.();
        state.__topbarSelectUnstack = null;
        try {
            document.querySelectorAll('.tm-topbar-select[data-open="true"]').forEach((el) => {
                try { el.dataset.open = 'false'; } catch (e) {}
                try { el.querySelector('.bc-select-trigger')?.setAttribute('aria-expanded', 'false'); } catch (e) {}
            });
        } catch (e) {}
        try { __tmAnimatePopupOutAndRemove(document.getElementById('tmTopbarFloatingMenu')); } catch (e) {}
    }

    window.tmCloseTopbarSelects = function() {
        try { __tmCloseTopbarSelects(); } catch (e) {}
    };

    function __tmPopupMotionDisabled() {
        try {
            return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function __tmAnimatePopupIn(el, opts = {}) {
        if (!(el instanceof HTMLElement)) return;
        try { el.classList.add('tm-popup-surface'); } catch (e) {}
        const origin = String(opts.origin || 'top-center').trim() || 'top-center';
        try { el.dataset.popupOrigin = origin; } catch (e) {}
        if (__tmPopupMotionDisabled() || typeof el.animate !== 'function') {
            try {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0) scale(1)';
            } catch (e) {}
            return;
        }
        try {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-6px) scale(0.97)';
            const anim = el.animate([
                { opacity: 0, transform: 'translateY(-6px) scale(0.97)' },
                { opacity: 1, transform: 'translateY(0) scale(1)' }
            ], {
                duration: Number(opts.duration) || 170,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'forwards'
            });
            anim.onfinish = () => {
                try {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0) scale(1)';
                } catch (e2) {}
            };
        } catch (e) {
            try {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0) scale(1)';
            } catch (e2) {}
        }
    }

    function __tmAnimatePopupOutAndRemove(el, opts = {}) {
        if (!(el instanceof HTMLElement)) return;
        if (el.dataset.tmClosing === 'true') return;
        try { el.dataset.tmClosing = 'true'; } catch (e) {}
        if (__tmPopupMotionDisabled() || typeof el.animate !== 'function') {
            try { el.remove(); } catch (e) {}
            return;
        }
        try {
            const anim = el.animate([
                { opacity: 1, transform: 'translateY(0) scale(1)' },
                { opacity: 0, transform: 'translateY(-4px) scale(0.985)' }
            ], {
                duration: Number(opts.duration) || 120,
                easing: 'ease-out',
                fill: 'forwards'
            });
            anim.onfinish = () => {
                try { el.remove(); } catch (e2) {}
            };
            anim.oncancel = () => {
                try { el.remove(); } catch (e2) {}
            };
        } catch (e) {
            try { el.remove(); } catch (e2) {}
        }
    }

    function __tmScheduleDocTopbarSelectSync(id, root) {
        try {
            if (state.__docTopbarSelectSyncTimer) {
                clearTimeout(state.__docTopbarSelectSyncTimer);
                state.__docTopbarSelectSyncTimer = null;
            }
        } catch (e) {}
        if (!__tmIsDocTopbarSelectId(id) || !(root instanceof HTMLElement)) return;
        state.__docTopbarSelectSyncTimer = setTimeout(async () => {
            state.__docTopbarSelectSyncTimer = null;
            if (!document.body.contains(root)) return;
            if (String(root.dataset.open || '') !== 'true') return;
            try { await __tmSyncRemoteDocGroupSettingsIfNeeded(); } catch (e) {}
        }, 1000);
    }

    window.tmToggleTopbarSelect = async function(id, event) {
        try { event?.stopPropagation?.(); } catch (e) {}
        try { event?.preventDefault?.(); } catch (e) {}
        const root = document.getElementById(String(id || '').trim());
        if (!(root instanceof HTMLElement)) return;
        const open = String(root.dataset.open || '') === 'true';
        __tmCloseTopbarSelects();
        if (!open) {
            try { root.dataset.open = 'true'; } catch (e) {}
            const trigger = root.querySelector('.bc-select-trigger');
            const sourceMenu = root.querySelector('.bc-select-menu');
            try { trigger?.setAttribute('aria-expanded', 'true'); } catch (e) {}
            if (trigger instanceof HTMLElement && sourceMenu instanceof HTMLElement) {
                const rect = trigger.getBoundingClientRect();
                const menu = document.createElement('div');
                menu.id = 'tmTopbarFloatingMenu';
                menu.className = 'bc-select-menu';
                menu.style.display = 'flex';
                menu.style.position = 'fixed';
                menu.style.zIndex = String(__tmResolveFloatingTooltipZIndex(trigger));
                menu.style.left = `${Math.max(8, Math.round(rect.left))}px`;
                menu.style.top = `${Math.round(rect.bottom + 8)}px`;
                menu.style.minWidth = `${Math.max(Math.round(rect.width), 160)}px`;
                menu.style.maxWidth = `min(${Math.max(Math.round(rect.width), 160)}px, calc(100vw - 16px))`;
                menu.innerHTML = sourceMenu.innerHTML;
                document.body.appendChild(menu);
                const menuRect = menu.getBoundingClientRect();
                const maxLeft = Math.max(8, window.innerWidth - menuRect.width - 8);
                const maxTop = Math.max(8, window.innerHeight - menuRect.height - 8);
                menu.style.left = `${Math.min(Math.max(8, Math.round(rect.left)), maxLeft)}px`;
                menu.style.top = `${Math.min(Math.round(rect.bottom + 8), maxTop)}px`;
                __tmAnimatePopupIn(menu, { origin: 'top-left' });
            }
            __tmScheduleDocTopbarSelectSync(id, root);
            state.__topbarSelectUnstack = __tmModalStackBind(() => __tmCloseTopbarSelects());
        }
    };

    function __tmOnTopbarSelectOutsideClick(event) {
        if (event?.target instanceof Element && event.target.closest('.tm-topbar-select')) return;
        __tmCloseTopbarSelects();
    }

    if (!window.__tmTopbarSelectOutsideBound) {
        window.__tmTopbarSelectOutsideBound = true;
        document.addEventListener('click', __tmOnTopbarSelectOutsideClick, true);
    }

    window.tmClose = function(event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        state.openToken = (Number(state.openToken) || 0) + 1;
        try { __tmHideMobileMenu(); } catch (e) {}
        try {
            if (state.desktopMenuCloseTimer) {
                clearTimeout(state.desktopMenuCloseTimer);
                state.desktopMenuCloseTimer = null;
            }
            if (state.desktopMenuCloseHandler) {
                document.removeEventListener('click', state.desktopMenuCloseHandler);
                state.desktopMenuCloseHandler = null;
            }
            __tmAnimatePopupOutAndRemove(document.getElementById('tmDesktopMenu'));
        } catch (e) {}
        try {
            if (state.taskContextMenuCloseHandler) {
                __tmClearOutsideCloseHandler(state.taskContextMenuCloseHandler);
                state.taskContextMenuCloseHandler = null;
            }
            document.getElementById('tm-task-context-menu')?.remove?.();
        } catch (e) {}
        try {
            if (__tmResizeState) {
                document.removeEventListener('mousemove', __tmOnResize);
                document.removeEventListener('mouseup', __tmStopResize);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                __tmResizeState = null;
            }
        } catch (e) {}
        try {
            if (__tmTimelineSplitResizeOnMove) document.removeEventListener('mousemove', __tmTimelineSplitResizeOnMove);
            if (__tmTimelineSplitResizeOnUp) document.removeEventListener('mouseup', __tmTimelineSplitResizeOnUp);
            __tmTimelineSplitResizeOnMove = null;
            __tmTimelineSplitResizeOnUp = null;
            __tmTimelineSplitResizeState = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        } catch (e) {}
        try {
            if (__tmTimelineContentResizeOnMove) document.removeEventListener('mousemove', __tmTimelineContentResizeOnMove);
            if (__tmTimelineContentResizeOnUp) document.removeEventListener('mouseup', __tmTimelineContentResizeOnUp);
            __tmTimelineContentResizeOnMove = null;
            __tmTimelineContentResizeOnUp = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        } catch (e) {}
        try {
            if (__tmWhiteboardSidebarResizeOnMove) document.removeEventListener('mousemove', __tmWhiteboardSidebarResizeOnMove);
            if (__tmWhiteboardSidebarResizeOnUp) document.removeEventListener('mouseup', __tmWhiteboardSidebarResizeOnUp);
            __tmWhiteboardSidebarResizeOnMove = null;
            __tmWhiteboardSidebarResizeOnUp = null;
            __tmWhiteboardSidebarResizeState = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        } catch (e) {}
        try { state.dockTaskPointerGestureCleanup?.(); } catch (e) {}
        try { state.dockTaskPointerDragAbort?.abort?.(); } catch (e) {}
        try { state.multiSelectPointerGestureCleanup?.(); } catch (e) {}
        try { state.multiSelectPointerSweepAbort?.abort?.(); } catch (e) {}
        try { __tmCloseMultiSelectMoreMenu(); } catch (e) {}
        state.dockTaskPointerGestureCleanup = null;
        state.dockTaskPointerDragAbort = null;
        state.dockTaskPointerSuppressClickUntil = 0;
        state.multiSelectPointerGestureCleanup = null;
        state.multiSelectPointerSweepAbort = null;
        try { __tmUnbindMobileViewportAutoRefresh(); } catch (e) {}
        __tmClearTimelineTodayIndicatorTimer();

        // 强制移除所有可能的模态框（防御性编程）
        const modals = document.querySelectorAll('.tm-modal, .tm-settings-modal, .tm-rules-modal, .tm-prompt-modal');
        modals.forEach(el => {
            try { el.remove(); } catch (e) {}
        });

        // 清理状态引用
        state.modal = null;
        state.settingsModal = null;
        state.summaryModal = null;
        state.rulesModal = null;
        state.priorityModal = null;
        state.quickAddModal = null;
        state.exportModal = null;
    };

    // 列宽调整功能
    let __tmResizeState = null;
    let __tmTimelineSplitResizeState = null;
    let __tmTimelineSplitResizeOnMove = null;
    let __tmTimelineSplitResizeOnUp = null;
    let __tmTimelineContentResizeOnMove = null;
    let __tmTimelineContentResizeOnUp = null;
    let __tmWhiteboardSidebarResizeState = null;
    let __tmWhiteboardSidebarResizeOnMove = null;
    let __tmWhiteboardSidebarResizeOnUp = null;

    window.startColResize = function(event, colName) {
        event.preventDefault();
        event.stopPropagation();
        const th = event.target.closest('th');
        const startX = event.clientX;
        const startWidth = th.offsetWidth;
        const isCalendar = !!th.closest('.tm-calendar-task-list');

        __tmResizeState = {
            colName,
            startX,
            startWidth,
            th,
            isCalendar
        };

        document.addEventListener('mousemove', __tmOnResize);
        document.addEventListener('mouseup', __tmStopResize);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    function __tmOnResize(event) {
        if (!__tmResizeState) return;
        const deltaX = event.clientX - __tmResizeState.startX;
        const newWidth = Math.max(10, Math.min(800, Math.round(__tmResizeState.startWidth + deltaX)));
        __tmResizeState.th.style.width = newWidth + 'px';
        __tmResizeState.th.style.minWidth = newWidth + 'px';
        __tmResizeState.th.style.maxWidth = newWidth + 'px';
    }

    function __tmStopResize(event) {
        if (!__tmResizeState) return;

        const deltaX = event.clientX - __tmResizeState.startX;
        const newWidth = Math.max(10, Math.min(800, Math.round(__tmResizeState.startWidth + deltaX)));

        if (__tmResizeState.isCalendar) {
            if (!SettingsStore.data.calendarColumnWidths) SettingsStore.data.calendarColumnWidths = {};
            SettingsStore.data.calendarColumnWidths[__tmResizeState.colName] = newWidth;
            SettingsStore.save();
        } else {
            SettingsStore.updateColumnWidth(__tmResizeState.colName, newWidth);
        }

        // 清理
        document.removeEventListener('mousemove', __tmOnResize);
        document.removeEventListener('mouseup', __tmStopResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        __tmResizeState = null;
    };

    window.tmStartTimelineSplitResize = function(event) {
        try { event.preventDefault(); } catch (e) {}
        try { event.stopPropagation(); } catch (e) {}
        const leftEl = state.modal?.querySelector?.('.tm-timeline-left');
        if (!leftEl) return;
        try {
            if (__tmTimelineSplitResizeOnMove) document.removeEventListener('mousemove', __tmTimelineSplitResizeOnMove);
            if (__tmTimelineSplitResizeOnUp) document.removeEventListener('mouseup', __tmTimelineSplitResizeOnUp);
        } catch (e) {}
        __tmTimelineSplitResizeOnMove = null;
        __tmTimelineSplitResizeOnUp = null;
        const startX = event.clientX;
        const startWidth = leftEl.getBoundingClientRect().width;
        __tmTimelineSplitResizeState = { startX, startWidth, leftEl };

        const onMove = (ev) => {
            if (!__tmTimelineSplitResizeState) return;
            const dx = ev.clientX - __tmTimelineSplitResizeState.startX;
            const next = Math.max(360, Math.min(900, Math.round(__tmTimelineSplitResizeState.startWidth + dx)));
            __tmTimelineSplitResizeState.leftEl.style.width = `${next}px`;
        };
        const onUp = async (ev) => {
            if (!__tmTimelineSplitResizeState) return;
            const dx = ev.clientX - __tmTimelineSplitResizeState.startX;
            const next = Math.max(360, Math.min(900, Math.round(__tmTimelineSplitResizeState.startWidth + dx)));
            __tmTimelineSplitResizeState = null;
            try { document.removeEventListener('mousemove', onMove); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp); } catch (e) {}
            __tmTimelineSplitResizeOnMove = null;
            __tmTimelineSplitResizeOnUp = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            SettingsStore.data.timelineLeftWidth = next;
            try { await SettingsStore.save(); } catch (e) {}
        };

        __tmTimelineSplitResizeOnMove = onMove;
        __tmTimelineSplitResizeOnUp = onUp;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    window.tmStartTimelineContentResize = function(event) {
        try { event.preventDefault(); } catch (e) {}
        try { event.stopPropagation(); } catch (e) {}
        const th = event.target.closest('th');
        if (!th) return;
        try {
            if (__tmTimelineContentResizeOnMove) document.removeEventListener('mousemove', __tmTimelineContentResizeOnMove);
            if (__tmTimelineContentResizeOnUp) document.removeEventListener('mouseup', __tmTimelineContentResizeOnUp);
        } catch (e) {}
        __tmTimelineContentResizeOnMove = null;
        __tmTimelineContentResizeOnUp = null;
        const startX = event.clientX;
        const table = state.modal?.querySelector?.('#tmTimelineLeftTable');
        const col = state.modal?.querySelector?.('#tmTimelineColContent');
        const startWidth = th.getBoundingClientRect().width;
        const startW = Number.isFinite(startWidth) ? startWidth : th.offsetWidth;

        const onMove = (ev) => {
            const dx = ev.clientX - startX;
            const next = Math.max(10, Math.min(800, Math.round(startW + dx)));
            if (col) col.style.width = `${next}px`;
            th.style.width = `${next}px`;
            th.style.minWidth = `${next}px`;
            th.style.maxWidth = `${next}px`;
            const startW2 = Number(SettingsStore.data.columnWidths?.startDate) || 90;
            const endW2 = Number(SettingsStore.data.columnWidths?.completionTime) || 170;
            const total = Math.round(next + startW2 + endW2 + 2);
            if (table) {
                table.style.width = `${total}px`;
                table.style.minWidth = `${total}px`;
                table.style.maxWidth = `${total}px`;
            }
        };

        const onUp = async (ev) => {
            const dx = ev.clientX - startX;
            const next = Math.max(10, Math.min(800, Math.round(startW + dx)));
            try { document.removeEventListener('mousemove', onMove); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp); } catch (e) {}
            __tmTimelineContentResizeOnMove = null;
            __tmTimelineContentResizeOnUp = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            SettingsStore.data.timelineContentWidth = next;
            try { await SettingsStore.save(); } catch (e) {}
            render();
        };

        __tmTimelineContentResizeOnMove = onMove;
        __tmTimelineContentResizeOnUp = onUp;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    window.tmStartWhiteboardSidebarResize = function(event) {
        try { event.preventDefault(); } catch (e) {}
        try { event.stopPropagation(); } catch (e) {}
        if (SettingsStore.data.whiteboardSidebarCollapsed) return;
        const layout = state.modal?.querySelector?.('.tm-whiteboard-layout');
        const sidebar = layout?.querySelector?.('.tm-whiteboard-sidebar');
        if (!layout || !sidebar) return;
        try {
            if (__tmWhiteboardSidebarResizeOnMove) document.removeEventListener('mousemove', __tmWhiteboardSidebarResizeOnMove);
            if (__tmWhiteboardSidebarResizeOnUp) document.removeEventListener('mouseup', __tmWhiteboardSidebarResizeOnUp);
        } catch (e) {}
        __tmWhiteboardSidebarResizeOnMove = null;
        __tmWhiteboardSidebarResizeOnUp = null;
        const startX = event.clientX;
        const startWidth = sidebar.getBoundingClientRect().width;
        __tmWhiteboardSidebarResizeState = { startX, startWidth, layout };

        const onMove = (ev) => {
            if (!__tmWhiteboardSidebarResizeState) return;
            const dx = ev.clientX - __tmWhiteboardSidebarResizeState.startX;
            const next = Math.max(220, Math.min(520, Math.round(__tmWhiteboardSidebarResizeState.startWidth + dx)));
            const el = __tmWhiteboardSidebarResizeState.layout;
            el.style.setProperty('--tm-wb-sidebar-width', `${next}px`);
        };
        const onUp = async (ev) => {
            if (!__tmWhiteboardSidebarResizeState) return;
            const dx = ev.clientX - __tmWhiteboardSidebarResizeState.startX;
            const next = Math.max(220, Math.min(520, Math.round(__tmWhiteboardSidebarResizeState.startWidth + dx)));
            __tmWhiteboardSidebarResizeState = null;
            try { document.removeEventListener('mousemove', onMove); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp); } catch (e) {}
            __tmWhiteboardSidebarResizeOnMove = null;
            __tmWhiteboardSidebarResizeOnUp = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            SettingsStore.data.whiteboardSidebarWidth = next;
            try { await SettingsStore.save(); } catch (e) {}
        };

        __tmWhiteboardSidebarResizeOnMove = onMove;
        __tmWhiteboardSidebarResizeOnUp = onUp;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

