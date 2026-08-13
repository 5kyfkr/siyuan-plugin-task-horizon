    function __tmRemoveBreadcrumbButton(options = {}) {
        const destroy = !!options.destroy;
        try {
            if (breadcrumbTimer != null) {
                clearTimeout(breadcrumbTimer);
                breadcrumbTimer = null;
            }
        } catch (e) {}
        breadcrumbTries = 0;
        try {
            if (__tmBreadcrumbBtnEl?.parentElement) __tmBreadcrumbBtnEl.parentElement.removeChild(__tmBreadcrumbBtnEl);
        } catch (e) {}
        try {
            document.querySelectorAll('.tm-breadcrumb-btn').forEach((btn) => {
                if (__tmBreadcrumbBtnEl && btn === __tmBreadcrumbBtnEl) return;
                try { btn.remove(); } catch (e2) {}
            });
        } catch (e) {}
        if (destroy) __tmBreadcrumbBtnEl = null;
    }

    function __tmSyncBreadcrumbButtonVisual(btn) {
        if (!(btn instanceof HTMLElement)) return;
        try {
            const title = __tmGetDocTopbarButtonTitle();
            btn.title = title;
            btn.setAttribute('aria-label', title);
        } catch (e) {}
    }

    function __tmEnsureBreadcrumbButtonElement() {
        if (__tmBreadcrumbBtnEl instanceof HTMLButtonElement) {
            __tmSyncBreadcrumbButtonVisual(__tmBreadcrumbBtnEl);
            return __tmBreadcrumbBtnEl;
        }

        const tmBtn = document.createElement('button');
        tmBtn.type = 'button';
        tmBtn.className = 'block__icon fn__flex-center ariaLabel tm-breadcrumb-btn';
        tmBtn.innerHTML = '<svg aria-hidden="true"><use href="#iconTaskHorizon" xlink:href="#iconTaskHorizon"></use></svg>';
        tmBtn.style.cssText = `
            margin: 0 4px;
            flex-shrink: 0;
            z-index: 10;
        `;

        tmBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (tmBtn.__tmLongPressFired) {
                tmBtn.__tmLongPressFired = false;
                return;
            }
            try {
                const meta = __tmGetDocTopbarButtonPressActionMeta();
                meta.shortRun?.();
            } catch (e2) {}
        };

        try {
            let pressTimer = null;
            const startHandler = () => {
                tmBtn.__tmLongPressFired = false;
                try { state.__tmPluginIconLongPressing = true; } catch (e) {}
                if (pressTimer) clearTimeout(pressTimer);
                pressTimer = setTimeout(() => {
                    tmBtn.__tmLongPressFired = true;
                    try {
                        const meta = __tmGetDocTopbarButtonPressActionMeta();
                        meta.longRun?.();
                    } catch (e) {}
                }, 450);
            };
            const cancelHandler = () => {
                if (pressTimer) clearTimeout(pressTimer);
                pressTimer = null;
                try { state.__tmPluginIconLongPressing = false; } catch (e) {}
            };
            const endHandler = (e) => {
                if (pressTimer) clearTimeout(pressTimer);
                pressTimer = null;
                try { state.__tmPluginIconLongPressing = false; } catch (e) {}
                if (tmBtn.__tmLongPressFired) {
                    try { e.preventDefault(); } catch (e2) {}
                    try { e.stopPropagation(); } catch (e2) {}
                }
            };

            globalThis.__tmRuntimeEvents?.on?.(tmBtn, 'touchstart', startHandler, { passive: true });
            globalThis.__tmRuntimeEvents?.on?.(tmBtn, 'touchmove', cancelHandler, { passive: true });
            globalThis.__tmRuntimeEvents?.on?.(tmBtn, 'touchend', endHandler, { passive: false });
            globalThis.__tmRuntimeEvents?.on?.(tmBtn, 'mousedown', startHandler);
            globalThis.__tmRuntimeEvents?.on?.(tmBtn, 'mouseleave', cancelHandler);
            globalThis.__tmRuntimeEvents?.on?.(tmBtn, 'mouseup', endHandler);
        } catch (e) {}

        __tmBreadcrumbBtnEl = tmBtn;
        __tmSyncBreadcrumbButtonVisual(tmBtn);
        return tmBtn;
    }

    function __tmGetLiveBreadcrumbButtonElement() {
        try {
            if (__tmBreadcrumbBtnEl instanceof HTMLButtonElement && document.body.contains(__tmBreadcrumbBtnEl)) {
                return __tmBreadcrumbBtnEl;
            }
        } catch (e) {}
        try {
            const existing = document.querySelector('.tm-breadcrumb-btn');
            if (existing instanceof HTMLButtonElement && document.body.contains(existing)) {
                __tmBreadcrumbBtnEl = existing;
                __tmSyncBreadcrumbButtonVisual(existing);
                return existing;
            }
        } catch (e) {}
        return null;
    }

    function __tmGetBreadcrumbButtonIn(breadcrumb) {
        if (!(breadcrumb instanceof HTMLElement)) return null;
        try {
            const btn = breadcrumb.querySelector('.tm-breadcrumb-btn');
            if (btn instanceof HTMLButtonElement) return btn;
        } catch (e) {}
        return null;
    }

    function __tmFindTomatoBreadcrumbAnchor(breadcrumb) {
        if (!(breadcrumb instanceof HTMLElement)) return null;
        const selectors = [
            '#tomato-breadcrumb-btn',
            '[id*="tomato"][class*="breadcrumb"]',
            '[class*="tomato"][class*="breadcrumb"]',
            '[aria-label*="番茄"]',
            '[title*="番茄"]',
            '[aria-label*="Tomato"]',
            '[title*="Tomato"]',
        ];
        for (const selector of selectors) {
            try {
                const el = breadcrumb.querySelector(selector);
                if (el instanceof HTMLElement) return el;
            } catch (e) {}
        }
        try {
            const children = Array.from(breadcrumb.children || []);
            return children.find((el) => {
                if (!(el instanceof HTMLElement) || el.classList.contains('tm-breadcrumb-btn')) return false;
                const text = String(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
                if (!text) return false;
                return /番茄|tomato/i.test(text);
            }) || null;
        } catch (e) {}
        return null;
    }

    function __tmPlaceBreadcrumbButton(breadcrumb, tmBtn) {
        if (!(breadcrumb instanceof HTMLElement) || !(tmBtn instanceof HTMLElement)) return false;
        try {
            const tomatoAnchor = __tmFindTomatoBreadcrumbAnchor(breadcrumb);
            if (tomatoAnchor instanceof HTMLElement && tomatoAnchor !== tmBtn) {
                if (tmBtn.parentElement !== breadcrumb || tmBtn.nextElementSibling !== tomatoAnchor) {
                    breadcrumb.insertBefore(tmBtn, tomatoAnchor);
                }
                return true;
            }
            if (tmBtn.parentElement !== breadcrumb) {
                breadcrumb.appendChild(tmBtn);
            } else if (breadcrumb.lastElementChild !== tmBtn) {
                breadcrumb.appendChild(tmBtn);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function addBreadcrumbButton() {
        if (!__tmShouldShowDocTopbarButton()) {
            __tmRemoveBreadcrumbButton();
            return;
        }
        if (breadcrumbTimer != null) return;

        const scheduleTry = (delayMs) => {
            if (breadcrumbTimer != null) return;
            const d = Math.max(0, Number(delayMs) || 0);
            breadcrumbTimer = setTimeout(() => {
                breadcrumbTimer = null;
                tryAddButton();
            }, d);
        };

        const tryAddButton = () => {
            const breadcrumb = globalThis.__tmCompat?.findBreadcrumb?.() || null;
            if (!(breadcrumb instanceof HTMLElement)) {
                breadcrumbTries += 1;
                if (breadcrumbTries <= 60) scheduleTry(500);
                return;
            }
            const currentBtn = __tmGetBreadcrumbButtonIn(breadcrumb);
            if (currentBtn instanceof HTMLButtonElement) {
                __tmBreadcrumbBtnEl = currentBtn;
                __tmSyncBreadcrumbButtonVisual(currentBtn);
                try {
                    document.querySelectorAll('.tm-breadcrumb-btn').forEach((btn) => {
                        if (btn === currentBtn) return;
                        try { btn.remove(); } catch (e2) {}
                    });
                } catch (e) {}
                __tmPlaceBreadcrumbButton(breadcrumb, currentBtn);
                breadcrumbTries = 0;
                return;
            }

            try {
                document.querySelectorAll('.tm-breadcrumb-btn').forEach((btn) => {
                    try { btn.remove(); } catch (e2) {}
                });
            } catch (e) {}
            __tmBreadcrumbBtnEl = null;

            const tmBtn = __tmEnsureBreadcrumbButtonElement();
            __tmSyncBreadcrumbButtonVisual(tmBtn);
            __tmPlaceBreadcrumbButton(breadcrumb, tmBtn);
            breadcrumbTries = 0;
        };

        tryAddButton();
    }

    /**
     * 注册顶栏图标
     */
    const __TM_TOPBAR_ENTRY_ATTR = 'data-task-horizon-topbar';

    function __tmSetUseIcon(root, iconId) {
        if (!root) return false;
        const use = root.querySelector?.('use');
        if (!use) return false;
        const href = `#${iconId}`;
        try { use.setAttribute('href', href); } catch (e) {}
        try { use.setAttribute('xlink:href', href); } catch (e) {}
        try { use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href); } catch (e) {}
        return true;
    }

    function __tmElementContainsTaskHorizonIcon(el) {
        if (!(el instanceof Element)) return false;
        try {
            return !!el.querySelector?.('use[href="#iconTaskHorizon"], use[xlink\\:href="#iconTaskHorizon"]');
        } catch (e) {
            return false;
        }
    }

    function __tmMarkManagedTopBarEntry(el) {
        if (!(el instanceof HTMLElement)) return null;
        try { el.setAttribute(__TM_TOPBAR_ENTRY_ATTR, '1'); } catch (e) {}
        try { if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', '任务管理器'); } catch (e) {}
        try { if (!el.getAttribute('title')) el.setAttribute('title', '任务管理器'); } catch (e) {}
        try { __tmSetUseIcon(el, 'iconTaskHorizon'); } catch (e) {}
        try { globalThis.__taskHorizonApplyWindowTopBarIdentity?.(el); } catch (e) {}
        return el;
    }

    function __tmResetTopBarRegistrationState() {
        try { delete globalThis[__TM_MOBILE_TOPBAR_REGISTERED_KEY]; } catch (e) {}
        __tmTopBarAdded = false;
        __tmTopBarEl = null;
    }

    function __tmIsTaskHorizonTabHeaderEl(el) {
        if (!(el instanceof Element)) return false;
        const tabId = String(globalThis.__taskHorizonCustomTabId || '').trim();
        try {
            if (tabId && (String(el.getAttribute?.('data-id') || '').trim() === tabId || String(el.getAttribute?.('data-key') || '').trim() === tabId)) {
                return true;
            }
        } catch (e) {}
        if (__tmElementContainsTaskHorizonIcon(el)) return true;
        return false;
    }

    function __tmIsTaskHorizonCustomModel(model) {
        if (!model || typeof model !== 'object') return false;
        const tabType = String(globalThis.__taskHorizonTabType || 'task-horizon').trim();
        const tabId = String(globalThis.__taskHorizonCustomTabId || '').trim();
        try {
            const modelType = String(model.type || '').trim();
            if ((tabType && modelType === tabType) || (tabId && modelType === tabId)) return true;
        } catch (e) {}
        try {
            if (tabId && String(model?.tab?.id || '').trim() === tabId) return true;
        } catch (e) {}
        try {
            if (__tmIsTaskHorizonTabHeaderEl(model?.headElement)) return true;
        } catch (e) {}
        try {
            const element = model?.element;
            if (element instanceof HTMLElement) {
                if (tabId && (String(element.getAttribute?.('data-id') || '').trim() === tabId || String(element.getAttribute?.('data-key') || '').trim() === tabId)) {
                    return true;
                }
                if (__tmIsTabRootElement(element) || element.querySelector?.('.tm-tab-root')) return true;
                if (__tmMountEl && (element === __tmMountEl || element.contains?.(__tmMountEl))) return true;
                if (globalThis.__taskHorizonTabElement instanceof HTMLElement && (element === globalThis.__taskHorizonTabElement || element.contains?.(globalThis.__taskHorizonTabElement))) {
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    function __tmPatchTaskHorizonTabIcon() {
        const iconId = 'iconTaskHorizon';
        const tabId = String(globalThis.__taskHorizonCustomTabId || '').trim();
        if (!tabId) return false;
        const uses = Array.from(document.querySelectorAll('use[href], use[xlink\\:href]'));
        let ok = false;
        for (const use of uses) {
            try {
                const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
                if (!href.includes('iconList') && !href.includes(iconId)) continue;
                const owner = use.closest?.(`[data-id="${tabId}"], [data-key="${tabId}"]`) || use.closest?.('.layout-tab-bar__item, [data-id], [data-key], li, button, div');
                if (!owner) continue;
                if (__tmIsTaskHorizonTabHeaderEl(owner)) {
                    const root = owner.closest?.(`[data-id="${tabId}"], [data-key="${tabId}"]`) || owner;
                    if (__tmSetUseIcon(root, iconId)) ok = true;
                }
            } catch (e) {}
        }
        return ok;
    }

    function __tmFocusExistingTaskHorizonTab() {
        try {
            const tabId = globalThis.__taskHorizonCustomTabId;
            if (!tabId) return false;
            try {
                const tab = __tmFindExistingTaskManagerTab?.();
                if (tab && globalThis.__tmCompat?.switchTabLegacy?.(tab)) {
                    return true;
                }
            } catch (e) {}

            const els = Array.from(document.querySelectorAll(`[data-id="${tabId}"], [data-key="${tabId}"]`));
            if (els.length === 0) return false;
            const el = els.find(x => x && x.querySelector && x.querySelector('.tm-tab-root')) || els[0];
            try {
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            } catch (e) {
                try { el.click(); } catch (e2) {}
            }
            return true;
        } catch (e) {}
        return false;
    }

    let __tmEnsureTabPromise = null;

    function __tmBindTopBarClickCapture(topBarEl) {
        const el = __tmResolveManagedTopBarEntry(topBarEl || __tmTopBarEl);
        if (!el) return;
        if (__tmTopBarEl && __tmTopBarEl !== el && __tmTopBarClickCaptureHandler) {
            try { globalThis.__tmRuntimeEvents?.off?.(__tmTopBarEl, 'click', __tmTopBarClickCaptureHandler, true); } catch (e) {}
        }
        __tmTopBarEl = el;
        if (!__tmTopBarClickCaptureHandler) {
            __tmTopBarClickCaptureHandler = (e) => {
                if (__tmTopBarClickInFlight) return;
                try {
                    const suppressUntil = Number(globalThis.__taskHorizonSuppressMobileTopbarOpenUntil || 0);
                    if (suppressUntil > Date.now()) return;
                } catch (e2) {}
                __tmTopBarClickInFlight = true;
                try {
                    try { e.preventDefault?.(); } catch (e2) {}
                    try { e.stopImmediatePropagation?.(); } catch (e2) {}
                    try { e.stopPropagation?.(); } catch (e2) {}
                    const hostInfo = globalThis.__tmRuntimeHost?.getInfo?.() || null;
                    const isDesktopTabHost = !(hostInfo?.runtimeMobileClient ?? __tmIsRuntimeMobileClient()) && !(hostInfo?.isDockHost ?? __tmIsDockHost());
                    if (isDesktopTabHost) {
                        Promise.resolve().then(async () => {
                            try { await __tmEnsureTabOpened(1800); } catch (e2) {}
                            try { await __tmOpenManagerFromTopbarEntry({ skipEnsureTabOpened: true }); } catch (e2) {}
                        }).catch(() => null);
                    } else {
                        try { __tmOpenManagerFromTopbarEntry(); } catch (e2) {}
                    }
                } finally {
                    setTimeout(() => { __tmTopBarClickInFlight = false; }, 0);
                }
            };
        }
        try { globalThis.__tmRuntimeEvents?.on?.(el, 'click', __tmTopBarClickCaptureHandler, true); } catch (e) {}
    }

    function __tmIsMobileTopBarRegistrationHost() {
        try {
            const hostInfo = globalThis.__tmRuntimeHost?.getInfo?.() || null;
            return !!((hostInfo?.runtimeMobileClient ?? __tmIsRuntimeMobileClient()) && !(hostInfo?.isDockHost ?? __tmIsDockHost()));
        } catch (e) {
            return false;
        }
    }

    function __tmGetManagedTopBarLookupSelector() {
        const markedSelector = `[${__TM_TOPBAR_ENTRY_ATTR}="1"]`;
        return __tmIsMobileTopBarRegistrationHost()
            ? `${markedSelector}, [aria-label="任务管理器"], [aria-label="任务管理"], [title="任务管理器"], [title="任务管理"]`
            : `${markedSelector}, [aria-label="任务管理器"], [aria-label="任务管理"]`;
    }

    function __tmIsManagedTopBarEntry(el) {
        if (!(el instanceof Element)) return false;
        if (__tmTopBarEl instanceof Element && el === __tmTopBarEl) return true;
        if (el.closest?.('.layout-tab-bar, .layout-tab-bar__item, .layout-tab-container, .layout-tab-bar .item, .fn__flex-column[data-type="wnd"], .tm-modal')) return false;
        const marked = String(el.getAttribute?.(__TM_TOPBAR_ENTRY_ATTR) || '').trim() === '1';
        const label = String(
            __tmIsMobileTopBarRegistrationHost()
                ? (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '')
                : (el.getAttribute?.('aria-label') || '')
        ).trim();
        if (!marked && label !== '任务管理器' && label !== '任务管理') return false;
        return __tmElementContainsTaskHorizonIcon(el);
    }

    function __tmResolveManagedTopBarEntry(sourceEl) {
        if (sourceEl instanceof Element) {
            if (__tmIsManagedTopBarEntry(sourceEl)) return sourceEl;
            try {
                const nested = sourceEl.querySelector?.(__tmGetManagedTopBarLookupSelector());
                if (nested instanceof Element && __tmIsManagedTopBarEntry(nested)) return nested;
            } catch (e) {}
        }
        try {
            return Array.from(document.querySelectorAll(__tmGetManagedTopBarLookupSelector()))
                .find((el) => __tmIsManagedTopBarEntry(el)) || null;
        } catch (e) {}
        return null;
    }

    function __tmGetTopBarEntries() {
        try {
            const seen = new Set();
            const entries = [];
            const currentTopBar = __tmResolveManagedTopBarEntry(__tmTopBarEl);
            if (currentTopBar instanceof Element && document.body.contains(currentTopBar)) {
                entries.push(currentTopBar);
                seen.add(currentTopBar);
            }
            Array.from(document.querySelectorAll(__tmGetManagedTopBarLookupSelector())).forEach((el) => {
                if (!(el instanceof Element) || seen.has(el) || !__tmIsManagedTopBarEntry(el)) return;
                seen.add(el);
                entries.push(el);
            });
            return entries;
        } catch (e) {
            return [];
        }
    }

    function __tmDeduplicateTopBarEntries(allowRemoval = __tmIsMobileTopBarRegistrationHost()) {
        const entries = __tmGetTopBarEntries();
        if (!entries.length) return null;
        const keeper = (__tmTopBarEl instanceof Element && entries.includes(__tmTopBarEl))
            ? __tmTopBarEl
            : entries[0];
        __tmMarkManagedTopBarEntry(keeper);
        if (allowRemoval) {
            entries.forEach((el) => {
                if (!(el instanceof Element) || el === keeper) return;
                try { el.remove(); } catch (e) {}
            });
        }
        return keeper instanceof Element ? keeper : null;
    }

    function __tmRemoveTopBarIcon(options = {}) {
        const shouldRemoveDom = options?.removeDom ?? __tmIsMobileTopBarRegistrationHost();
        try {
            const currentTopBar = __tmResolveManagedTopBarEntry(__tmTopBarEl);
            if (currentTopBar && __tmTopBarClickCaptureHandler) {
                try { globalThis.__tmRuntimeEvents?.off?.(currentTopBar, 'click', __tmTopBarClickCaptureHandler, true); } catch (e) {}
            }
        } catch (e) {}
        try {
            if (__tmTopBarDocumentCaptureHandler) {
                try { globalThis.__tmRuntimeEvents?.off?.(document, 'click', __tmTopBarDocumentCaptureHandler, true); } catch (e2) {}
                __tmTopBarDocumentCaptureHandler = null;
            }
        } catch (e) {}
        if (shouldRemoveDom) {
            try {
                const entries = __tmGetTopBarEntries();
                entries.forEach((el) => { try { el.remove(); } catch (e) {} });
            } catch (e) {}
        }
        try { delete globalThis[__TM_MOBILE_TOPBAR_REGISTERED_KEY]; } catch (e) {}
        __tmTopBarEl = null;
        __tmTopBarAdded = false;
    }

    function addTopBarIcon() {
        if (!__tmShouldShowWindowTopbarIcon()) {
            __tmRemoveTopBarIcon();
            try { globalThis.__taskHorizonSyncWindowTopBar?.(); } catch (e) {}
            return;
        }
        const isMobileTopBarHost = __tmIsMobileTopBarRegistrationHost();
        if (!isMobileTopBarHost) {
            try { globalThis.__taskHorizonSyncWindowTopBar?.(); } catch (e) {}
            return;
        }
        if (isMobileTopBarHost && globalThis[__TM_MOBILE_TOPBAR_REGISTERED_KEY]) {
            try {
                const exists = __tmDeduplicateTopBarEntries(true);
                if (exists) {
                    __tmTopBarAdded = true;
                    try { __tmBindMobileTopBarDocumentCapture(); } catch (e2) {}
                    __tmBindTopBarClickCapture(exists);
                    return;
                }
            } catch (e) {}
            __tmResetTopBarRegistrationState();
        }
        if (__tmTopBarAdded) {
            if (isMobileTopBarHost) {
                try {
                    const exists = __tmDeduplicateTopBarEntries(true);
                    if (exists) {
                        try { __tmBindMobileTopBarDocumentCapture(); } catch (e2) {}
                        __tmBindTopBarClickCapture(exists);
                        return;
                    }
                } catch (e) {}
                __tmResetTopBarRegistrationState();
            } else {
                try {
                    const exists = __tmDeduplicateTopBarEntries(false);
                    if (exists) {
                        __tmSetUseIcon(exists, 'iconTaskHorizon');
                        __tmBindTopBarClickCapture(exists);
                        return;
                    }
                } catch (e) {}
                __tmTopBarAdded = false;
                __tmTopBarEl = null;
            }
        }
        // 尝试通过全局插件实例添加
        const pluginInstance = globalThis.__taskHorizonPluginInstance || globalThis.__tomatoPluginInstance;
        if (pluginInstance && typeof pluginInstance.addTopBar === 'function') {
            // 检查是否已添加（避免重复）
            // addTopBar 通常由插件管理，我们这里只是尝试调用
            // 如果已经添加过，思源可能会处理，或者我们可以检查 DOM
            // 但是 addTopBar 没有 ID 参数，不好检查。
            // 我们可以检查 aria-label 或 title
            const exists = __tmDeduplicateTopBarEntries(isMobileTopBarHost);
            if (exists) {
                __tmMarkManagedTopBarEntry(exists);
                if (isMobileTopBarHost) {
                    try { __tmBindMobileTopBarDocumentCapture(); } catch (e) {}
                }
                try { __tmBindTopBarClickCapture(exists); } catch (e) {}
                __tmTopBarAdded = true;
                if (isMobileTopBarHost) {
                    try { globalThis[__TM_MOBILE_TOPBAR_REGISTERED_KEY] = true; } catch (e) {}
                }
                return;
            }

            const topBarEl = pluginInstance.addTopBar({
                icon: "iconTaskHorizon",
                title: "任务管理器",
                position: "right",
                callback: () => {
                    try { __tmOpenManagerFromTopbarEntry(); } catch (e) {}
                }
            });
            __tmMarkManagedTopBarEntry(topBarEl);
            const managedTopBarEl = __tmDeduplicateTopBarEntries(isMobileTopBarHost) || topBarEl;
            if (isMobileTopBarHost) {
                try { __tmBindMobileTopBarDocumentCapture(); } catch (e) {}
            }
            try { __tmBindTopBarClickCapture(managedTopBarEl); } catch (e) {}
            __tmTopBarAdded = true;
            if (isMobileTopBarHost) {
                try { globalThis[__TM_MOBILE_TOPBAR_REGISTERED_KEY] = true; } catch (e) {}
            }
            setTimeout(() => {
                try {
                    const exists = __tmDeduplicateTopBarEntries(isMobileTopBarHost);
                    try { __tmSetUseIcon(exists, 'iconTaskHorizon'); } catch (e2) {}
                    try { if (exists) __tmBindTopBarClickCapture(exists); } catch (e2) {}
                } catch (e) {}
            }, 0);
        } else {
        }
    }

    function __tmRefreshShellEntrances() {
        try {
            const breadcrumb = globalThis.__tmCompat?.findBreadcrumb?.() || null;
            const liveBreadcrumbBtn = __tmBreadcrumbBtnEl instanceof HTMLElement && breadcrumb instanceof HTMLElement && breadcrumb.contains(__tmBreadcrumbBtnEl);
            const mobileTopbarHost = __tmIsMobileTopBarRegistrationHost();
            const shouldDocTopbar = __tmShouldShowDocTopbarButton();
            const shouldWindowTopbar = __tmShouldShowWindowTopbarIcon();
            const topbarEntries = __tmGetTopBarEntries();
            const liveTopbarIcon = topbarEntries.some((el) => el instanceof Element && document.body.contains(el));
            const signature = [
                shouldDocTopbar ? 1 : 0,
                liveBreadcrumbBtn ? 1 : 0,
                mobileTopbarHost ? 1 : 0,
                shouldWindowTopbar ? 1 : 0,
                __tmTopBarAdded ? 1 : 0,
                liveTopbarIcon ? 1 : 0,
                topbarEntries.length,
            ].join('|');
            if (signature && signature === String(__tmShellEntrancesLastSignature || '')) return;
            __tmShellEntrancesLastSignature = signature;
        } catch (e) {}
        try {
            if (__tmShouldShowDocTopbarButton()) addBreadcrumbButton();
            else __tmRemoveBreadcrumbButton();
        } catch (e) {}
        try {
            const isMobileTopBarHost = __tmIsMobileTopBarRegistrationHost();
            if (isMobileTopBarHost) {
                if (__tmShouldShowWindowTopbarIcon()) addTopBarIcon();
                else __tmRemoveTopBarIcon();
            } else {
                try { globalThis.__taskHorizonSyncWindowTopBar?.(); } catch (e2) {}
            }
        } catch (e) {}
    }

    function __tmScheduleShellEntrancesRefresh() {
        if (__tmShellEntrancesRefreshTimer != null) return;
        if (__tmShellEntrancesRefreshRaf != null) return;
        const run = () => {
            __tmShellEntrancesRefreshTimer = null;
            try {
                __tmRefreshShellEntrances();
            } catch (e) {}
        };
        try {
            __tmShellEntrancesRefreshTimer = setTimeout(() => {
                try { __tmScheduleIdleTask(run, 180); } catch (e) { run(); }
            }, 80);
        } catch (e) { run(); }
    }

    function __tmFindExistingTaskHorizonCustomModel() {
        try {
            const inst = globalThis.__taskHorizonPluginInstance;
            if (inst && typeof inst.getOpenedTab === 'function') {
                const opened = inst.getOpenedTab();
                if (opened && typeof opened === 'object') {
                    const customs = [];
                    Object.values(opened).forEach((arr) => {
                        if (Array.isArray(arr)) arr.forEach((c) => customs.push(c));
                    });
                    for (const c of customs) {
                        if (__tmIsTaskHorizonCustomModel(c)) return c;
                    }
                }
            }
        } catch (e) {}
        try {
            const models = globalThis.__tmHost?.getAllModels?.() || null;
            const list = Array.isArray(models?.custom) ? models.custom : [];
            for (const c of list) {
                if (__tmIsTaskHorizonCustomModel(c)) return c;
            }
        } catch (e) {}
        return null;
    }

    async function __tmWaitForTaskHorizonTabRoot(maxWaitMs = 1800) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < Math.max(200, Number(maxWaitMs) || 1800)) {
            try {
                const custom = __tmFindExistingTaskHorizonCustomModel();
                const fromCustom = custom?.element instanceof HTMLElement ? custom.element : null;
                if (fromCustom && document.body.contains(fromCustom)) {
                    return fromCustom;
                }
            } catch (e) {}
            try {
                const tabId = String(globalThis.__taskHorizonCustomTabId || '').trim();
                if (tabId) {
                    const root = document.querySelector(`[data-id="${tabId}"] .tm-tab-root, [data-key="${tabId}"] .tm-tab-root`);
                    if (root instanceof HTMLElement && document.body.contains(root)) {
                        return root;
                    }
                }
            } catch (e) {}
            try {
                const best = __tmFindBestTabRoot?.();
                if (best instanceof HTMLElement && document.body.contains(best)) {
                    return best;
                }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 50));
        }
        return null;
    }

    /**
     * 监听面包屑栏变化
     */
    function observeBreadcrumb() {
        __tmRefreshShellEntrances();
        const breadcrumb = globalThis.__tmCompat?.findBreadcrumb?.() || null;
        if (__tmBreadcrumbObserver && __tmBreadcrumbObserverTarget === breadcrumb) return;
        if (__tmBreadcrumbObserver) {
            try { __tmBreadcrumbObserver.disconnect(); } catch (e) {}
            __tmBreadcrumbObserver = null;
        }
        __tmBreadcrumbObserverTarget = breadcrumb instanceof HTMLElement ? breadcrumb : null;
        if (__tmBreadcrumbObserverTarget) {
            const observer = new MutationObserver(() => __tmScheduleShellEntrancesRefresh());
            observer.observe(__tmBreadcrumbObserverTarget, { childList: true, subtree: true });
            __tmBreadcrumbObserver = observer;
            try { window.__tmTaskHorizonBreadcrumbObserver = observer; } catch (e) {}
        } else {
            try { delete window.__tmTaskHorizonBreadcrumbObserver; } catch (e) {}
        }

        // 额外监听顶栏图标注入（如果插件实例加载较晚）
        if (__tmShouldShowWindowTopbarIcon()) __tmTopBarTimer = setTimeout(addTopBarIcon, 1000);
    }

    const __tmDocTitleMarkerControllers = new Map();
    const __tmDocTitleMarkerMembershipCache = new Map();
    const __tmDocTitleMarkerMembershipInFlight = new Map();
    const __tmDocTitleMarkerFocusCache = new Map();
    const __tmDocTitleMarkerFocusInFlight = new Map();
    const __tmDocTitleMarkerFocusRevisionByDoc = new Map();
    let __tmDocTitleMarkerScopeRevision = 0;
    let __tmDocTitleMarkerFocusEpoch = 0;
    let __tmDocTitleMarkerLoadedHandler = null;
    let __tmDocTitleMarkerDestroyedHandler = null;
    let __tmDocTitleMarkerEventBuses = [];

    function __tmResolveDocTitleMarkerContext(input) {
        const protyleLike = input?.detail?.protyle || input?.protyle || input || null;
        const protyle = __tmResolveProtyleElement(protyleLike);
        if (!(protyle instanceof HTMLElement) || !protyle.isConnected) return null;
        const runtime = protyleLike?.options ? protyleLike : (protyle?.protyle || null);
        if (runtime?.options?.render?.title === false) return null;
        if (runtime?.backlinkData || runtime?.options?.backlinkData) return null;
        const title = protyle.querySelector('.protyle-title');
        if (!(title instanceof HTMLElement)) return null;
        const attr = Array.from(title.children || []).find((child) => child?.classList?.contains?.('protyle-attr')) || null;
        if (!(attr instanceof HTMLElement)) return null;
        const docId = String(__tmGetDocIdFromProtyle(protyle) || runtime?.block?.rootID || '').trim();
        if (!__tmIsLikelyBlockId(docId)) return null;
        return { protyle, runtime, title, attr, docId };
    }

    function __tmGetDocTitleMarkerMembershipKey(docId) {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        return `${__tmDocTitleMarkerScopeRevision}:${currentGroupId}:${String(docId || '').trim()}`;
    }

    function __tmGetDocTitleMarkerFocusSignature() {
        const mode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() === 'hours' ? 'hours' : 'minutes';
        const attrKey = mode === 'hours'
            ? String(SettingsStore.data.tomatoSpentAttrKeyHours || '').trim()
            : String(SettingsStore.data.tomatoSpentAttrKeyMinutes || '').trim();
        return `${mode}:${attrKey}`;
    }

    function __tmGetDocTitleMarkerFocusRevision(docId) {
        return Math.max(0, Number(__tmDocTitleMarkerFocusRevisionByDoc.get(String(docId || '').trim()) || 0) || 0);
    }

    function __tmFormatDocTitleFocusDuration(tasks, mode = 'minutes') {
        const list = Array.isArray(tasks) ? tasks : [];
        const useHours = String(mode || '').trim() === 'hours';
        let total = 0;
        list.forEach((task) => {
            const focus = __tmGetTaskTomatoFocusValues(task);
            const value = useHours ? focus.tomatoHours : focus.tomatoMinutes;
            const amount = typeof __tmParseNumber === 'function' ? __tmParseNumber(value) : Number(value);
            if (Number.isFinite(amount) && amount > 0) total += amount;
        });
        if (useHours) return String(__tmFormatSpentHours(total) || '').trim();
        return String(__tmFormatSpentMinutes(total) || '').trim();
    }

    function __tmRefreshDocTitleMarkerControllers(docIds = null, options = {}) {
        const ids = Array.isArray(docIds)
            ? new Set(docIds.map((id) => String(id || '').trim()).filter(Boolean))
            : null;
        const includeEmbedded = options?.includeEmbedded === true;
        Array.from(__tmDocTitleMarkerControllers.values()).forEach((controller) => {
            if (!controller) return;
            if (ids && !ids.has(String(controller.docId || '').trim())) {
                const matchesEmbeddedSource = includeEmbedded
                    && controller.embeddedSourceDocIds instanceof Set
                    && Array.from(ids).some((id) => controller.embeddedSourceDocIds.has(id));
                if (!matchesEmbeddedSource) return;
            }
            __tmScheduleDocTitleMarkerSync(controller);
        });
    }

    function __tmMarkDocTitleMarkersDirty(docIds = null, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const ids = Array.isArray(docIds)
            ? Array.from(new Set(docIds.map((id) => String(id || '').trim()).filter(Boolean)))
            : null;
        if (opts.scope === true) {
            __tmDocTitleMarkerScopeRevision += 1;
            __tmDocTitleMarkerMembershipCache.clear();
            __tmDocTitleMarkerMembershipInFlight.clear();
        }
        if (opts.tasks === true || opts.duration === true) {
            const clearDurationCache = opts.duration === true;
            if (!ids) {
                __tmDocTitleMarkerFocusEpoch += 1;
                if (clearDurationCache) __tmDocTitleMarkerFocusCache.clear();
            } else {
                ids.forEach((docId) => {
                    if (clearDurationCache) __tmDocTitleMarkerFocusCache.delete(docId);
                    __tmDocTitleMarkerFocusRevisionByDoc.set(docId, __tmGetDocTitleMarkerFocusRevision(docId) + 1);
                });
            }
        }
        if (opts.scope === true || opts.tasks === true || opts.duration === true) {
            Array.from(__tmDocTitleMarkerControllers.values()).forEach((controller) => {
                if (!controller) return;
                if (!__tmHasDocTitleEmbeddedState(controller)) return;
                const hostMatched = !ids || ids.includes(String(controller.docId || '').trim());
                const embeddedMatched = !ids || (controller.embeddedSourceDocIds instanceof Set
                    && ids.some((id) => controller.embeddedSourceDocIds.has(id)));
                if (!hostMatched && !embeddedMatched) return;
                controller.embeddedFocusRevision = Math.max(0, Number(controller.embeddedFocusRevision || 0)) + 1;
                controller.embeddedRequestToken = Math.max(0, Number(controller.embeddedRequestToken || 0)) + 1;
                if (opts.scope === true || opts.duration === true) controller.embeddedFocus = null;
            });
        }
        __tmRefreshDocTitleMarkerControllers(ids, {
            includeEmbedded: opts.scope === true || opts.tasks === true || opts.duration === true,
        });
    }

    function __tmRemoveDocTitleMarker(controller) {
        const attr = controller?.attr;
        if (!(attr instanceof HTMLElement)) return;
        try {
            Array.from(attr.children || []).forEach((child) => {
                if (child?.classList?.contains?.('tm-doc-title-marker')) child.remove();
            });
        } catch (e) {}
        try {
            attr.classList.remove('tm-doc-title-attr', 'tm-doc-title-attr--plugin-only');
        } catch (e) {}
    }

    function __tmRenderDocTitleMarker(controller, target, durationText = '') {
        const attr = controller?.attr;
        const title = controller?.title;
        const docId = String(controller?.docId || '').trim();
        if (!(attr instanceof HTMLElement) || !(title instanceof HTMLElement) || !docId || !target?.groupId) {
            __tmRemoveDocTitleMarker(controller);
            return;
        }
        const groupId = String(target.groupId || '').trim();
        const groupName = groupId === 'all'
            ? ''
            : (String(__tmResolveDocGroupName(target.group) || '').trim() || '未命名分组');
        const duration = String(durationText || '').trim();
        const pluginOnly = !title.classList.contains('protyle-wysiwyg--attr');
        attr.classList.add('tm-doc-title-attr');
        attr.classList.toggle('tm-doc-title-attr--plugin-only', pluginOnly);

        const markers = Array.from(attr.children || []).filter((child) => child?.classList?.contains?.('tm-doc-title-marker'));
        let marker = markers.shift() || null;
        markers.forEach((item) => {
            try { item.remove(); } catch (e) {}
        });
        if (!(marker instanceof HTMLButtonElement)) {
            marker = document.createElement('button');
            marker.type = 'button';
            marker.className = 'tm-doc-title-marker ariaLabel';
            marker.setAttribute('contenteditable', 'false');
            marker.innerHTML = '<svg aria-hidden="true"><use href="#iconTaskHorizon" xlink:href="#iconTaskHorizon"></use></svg><span class="tm-doc-title-marker__group"></span><span class="tm-doc-title-marker__separator" aria-hidden="true">·</span><span class="tm-doc-title-marker__duration"></span>';
            marker.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const markerDocId = String(marker?.dataset?.docId || '').trim();
                if (!markerDocId) return;
                try {
                    void __tmOpenManagerFromDocTopbarEntry({
                        docId: markerDocId,
                        requireTasks: false,
                        forceLocate: true,
                        openAll: marker?.dataset?.embeddedOnly === '1',
                    });
                } catch (e) {}
            });
        }
        marker.dataset.docId = docId;
        marker.dataset.embeddedOnly = target?.matchedBy === 'embedded' ? '1' : '0';
        const groupEl = marker.querySelector('.tm-doc-title-marker__group');
        const separatorEl = marker.querySelector('.tm-doc-title-marker__separator');
        const durationEl = marker.querySelector('.tm-doc-title-marker__duration');
        if (groupEl) {
            groupEl.textContent = groupName;
            groupEl.hidden = !groupName;
        }
        if (separatorEl) separatorEl.hidden = !groupName || !duration;
        if (durationEl) {
            durationEl.textContent = duration;
            durationEl.hidden = !duration;
        }
        const label = target?.matchedBy === 'embedded'
            ? (duration ? `任务管理器范围内的嵌入待办，专注 ${duration}` : '任务管理器范围内的嵌入待办')
            : groupName
            ? (duration ? `任务管理器分组：${groupName}，专注 ${duration}` : `任务管理器分组：${groupName}`)
            : (duration ? `任务管理器，专注 ${duration}` : '任务管理器');
        marker.setAttribute('aria-label', label);

        const refcount = Array.from(attr.children || []).find((child) => child?.classList?.contains?.('protyle-attr--refcount')) || null;
        if (refcount) {
            if (marker.parentElement !== attr || marker.nextElementSibling !== refcount) attr.insertBefore(marker, refcount);
        } else if (marker.parentElement !== attr || attr.lastElementChild !== marker) {
            attr.appendChild(marker);
        }
    }

    function __tmRequestDocTitleMarkerMembership(controller) {
        const docId = String(controller?.docId || '').trim();
        if (!docId) return;
        const key = __tmGetDocTitleMarkerMembershipKey(docId);
        if (__tmDocTitleMarkerMembershipCache.has(key) || __tmDocTitleMarkerMembershipInFlight.has(key)) return;
        const scopeRevision = __tmDocTitleMarkerScopeRevision;
        const promise = new Promise((resolve) => {
            __tmScheduleIdleTask(async () => {
                try { resolve(await __tmResolveDocTopbarTargetGroup(docId)); } catch (e) { resolve(null); }
            }, 600);
        }).then((target) => {
            if (scopeRevision === __tmDocTitleMarkerScopeRevision) {
                __tmDocTitleMarkerMembershipCache.set(key, target?.groupId ? target : null);
            }
            return target;
        }).finally(() => {
            __tmDocTitleMarkerMembershipInFlight.delete(key);
            __tmRefreshDocTitleMarkerControllers([docId]);
        });
        __tmDocTitleMarkerMembershipInFlight.set(key, promise);
    }

    function __tmRequestDocTitleMarkerFocus(controller) {
        const docId = String(controller?.docId || '').trim();
        if (!docId || !SettingsStore.data.enableTomatoIntegration) return;
        const signature = __tmGetDocTitleMarkerFocusSignature();
        const revision = __tmGetDocTitleMarkerFocusRevision(docId);
        const epoch = __tmDocTitleMarkerFocusEpoch;
        const cached = __tmDocTitleMarkerFocusCache.get(docId);
        if (cached && cached.signature === signature && cached.revision === revision && cached.epoch === epoch) return;
        if (__tmDocTitleMarkerFocusInFlight.has(docId)) return;
        const promise = new Promise((resolve) => {
            __tmScheduleIdleTask(async () => {
                try {
                    const isStale = () => epoch !== __tmDocTitleMarkerFocusEpoch
                        || revision !== __tmGetDocTitleMarkerFocusRevision(docId)
                        || signature !== __tmGetDocTitleMarkerFocusSignature();
                    if (isStale()) {
                        resolve(null);
                        return;
                    }
                    const hasTasks = await __tmDocHasTaskBlocks(docId);
                    if (!hasTasks) {
                        resolve({ text: '', hasTasks: false });
                        return;
                    }
                    if (isStale()) {
                        resolve(null);
                        return;
                    }
                    const result = await API.getTasksByDocument(docId, __TM_TASK_INDEX_QUERY_LIMIT, {
                        fullTree: true,
                        doneOnly: false,
                        skipParentTaskJoin: true,
                        skipDocJoin: true,
                        customFieldIds: [],
                    });
                    const tasks = Array.isArray(result?.tasks) ? result.tasks : [];
                    const mode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() === 'hours' ? 'hours' : 'minutes';
                    resolve({
                        text: tasks.length > 0 ? __tmFormatDocTitleFocusDuration(tasks, mode) : '',
                        hasTasks: tasks.length > 0,
                    });
                } catch (e) {
                    resolve(null);
                }
            }, 900);
        }).then((result) => {
            if (result && epoch === __tmDocTitleMarkerFocusEpoch && revision === __tmGetDocTitleMarkerFocusRevision(docId)) {
                __tmDocTitleMarkerFocusCache.set(docId, {
                    ...result,
                    signature,
                    revision,
                    epoch,
                });
            }
            return result;
        }).finally(() => {
            __tmDocTitleMarkerFocusInFlight.delete(docId);
            __tmRefreshDocTitleMarkerControllers([docId]);
        });
        __tmDocTitleMarkerFocusInFlight.set(docId, promise);
    }

    function __tmIsDocTitleEmbeddedTaskFocusEnabled() {
        return !!SettingsStore.data.enableTomatoIntegration
            && !!SettingsStore.data.docTitleEmbeddedTaskFocusEnabled;
    }

    function __tmCollectDocTitleEmbeddedBlockIds(controller) {
        const root = controller?.embeddedRoot;
        if (!(root instanceof HTMLElement)) return [];
        const ids = new Set();
        const addId = (value) => {
            const id = String(value || '').trim();
            if (__tmIsLikelyBlockId(id)) ids.add(id);
        };
        root.querySelectorAll('[data-type="NodeBlockQueryEmbed"] .protyle-wysiwyg__embed').forEach((result) => {
            addId(result.getAttribute('data-id'));
            result.querySelectorAll('[data-node-id]').forEach((block) => addId(block.getAttribute('data-node-id')));
        });
        return Array.from(ids).sort();
    }

    function __tmDoesDocTitleEmbedMutationAffectResults(records) {
        const selector = '[data-type="NodeBlockQueryEmbed"], .protyle-wysiwyg__embed';
        return (Array.isArray(records) ? records : Array.from(records || [])).some((record) => {
            const target = record?.target instanceof Element ? record.target : record?.target?.parentElement;
            if (target?.closest?.('[data-type="NodeBlockQueryEmbed"]')) return true;
            return Array.from(record?.addedNodes || []).concat(Array.from(record?.removedNodes || [])).some((node) => {
                if (!(node instanceof Element)) return false;
                return node.matches(selector) || !!node.querySelector(selector);
            });
        });
    }

    function __tmHasDocTitleEmbeddedState(controller) {
        return !!controller?.embeddedObserver
            || !!controller?.embeddedRoot
            || controller?.embeddedTimer != null
            || !!controller?.embeddedInFlight
            || !!controller?.embeddedFocus
            || controller?.embeddedCandidateKey !== null
            || (controller?.embeddedSourceDocIds instanceof Set && controller.embeddedSourceDocIds.size > 0);
    }

    function __tmResetDocTitleEmbeddedFocusController(controller) {
        if (!controller) return;
        if (!__tmHasDocTitleEmbeddedState(controller)) return;
        try { controller.embeddedObserver?.disconnect?.(); } catch (e) {}
        controller.embeddedObserver = null;
        controller.embeddedRoot = null;
        if (controller.embeddedTimer != null) {
            try { clearTimeout(controller.embeddedTimer); } catch (e) {}
            controller.embeddedTimer = null;
        }
        controller.embeddedRequestToken = Math.max(0, Number(controller.embeddedRequestToken || 0)) + 1;
        controller.embeddedInFlight = null;
        controller.embeddedCandidateKey = null;
        controller.embeddedSourceDocIds = new Set();
        controller.embeddedFocus = null;
    }

    function __tmObserveDocTitleEmbeddedTasks(controller, context) {
        if (!__tmIsDocTitleEmbeddedTaskFocusEnabled()) {
            __tmResetDocTitleEmbeddedFocusController(controller);
            return false;
        }
        const root = context?.protyle?.querySelector?.('.protyle-wysiwyg');
        if (!(root instanceof HTMLElement)) {
            __tmResetDocTitleEmbeddedFocusController(controller);
            return false;
        }
        if (controller.embeddedRoot === root && controller.embeddedObserver) return true;
        __tmResetDocTitleEmbeddedFocusController(controller);
        controller.embeddedRoot = root;
        controller.embeddedObserver = new MutationObserver((records) => {
            if (!__tmDoesDocTitleEmbedMutationAffectResults(records)) return;
            if (controller.embeddedTimer != null) clearTimeout(controller.embeddedTimer);
            controller.embeddedTimer = setTimeout(() => {
                controller.embeddedTimer = null;
                controller.embeddedCandidateKey = null;
                controller.embeddedFocus = null;
                controller.embeddedSourceDocIds = new Set();
                controller.embeddedRequestToken = Math.max(0, Number(controller.embeddedRequestToken || 0)) + 1;
                __tmScheduleDocTitleMarkerSync(controller);
            }, 250);
        });
        controller.embeddedObserver.observe(root, { childList: true, subtree: true });
        return true;
    }

    function __tmPrepareDocTitleEmbeddedCandidates(controller) {
        const taskIds = __tmCollectDocTitleEmbeddedBlockIds(controller);
        const candidateKey = taskIds.join(',');
        if (controller.embeddedCandidateKey !== candidateKey) {
            controller.embeddedCandidateKey = candidateKey;
            controller.embeddedSourceDocIds = new Set();
            controller.embeddedFocus = null;
            controller.embeddedRequestToken = Math.max(0, Number(controller.embeddedRequestToken || 0)) + 1;
        }
        return taskIds;
    }

    function __tmGetDocTitleEmbeddedFocusSignature(controller) {
        return `${__tmDocTitleMarkerScopeRevision}:${__tmGetDocTitleMarkerFocusSignature()}:${String(controller?.embeddedCandidateKey || '')}`;
    }

    function __tmRequestDocTitleEmbeddedFocus(controller, candidateTaskIds = null) {
        if (!controller || !__tmIsDocTitleEmbeddedTaskFocusEnabled()) return;
        const taskIds = Array.isArray(candidateTaskIds)
            ? candidateTaskIds
            : __tmPrepareDocTitleEmbeddedCandidates(controller);
        const signature = __tmGetDocTitleEmbeddedFocusSignature(controller);
        const revision = Math.max(0, Number(controller.embeddedFocusRevision || 0));
        if (controller.embeddedFocus?.signature === signature && controller.embeddedFocus?.revision === revision) return;
        if (controller.embeddedInFlight?.signature === signature && controller.embeddedInFlight?.revision === revision) return;
        if (!taskIds.length) {
            controller.embeddedFocus = { signature, revision, text: '', hasTasks: false };
            return;
        }
        const requestToken = Math.max(0, Number(controller.embeddedRequestToken || 0));
        const request = { signature, revision, requestToken };
        controller.embeddedInFlight = request;
        new Promise((resolve) => {
            __tmScheduleIdleTask(async () => {
                const isStale = () => !controller?.protyle?.isConnected
                    || !__tmIsDocTitleEmbeddedTaskFocusEnabled()
                    || requestToken !== Math.max(0, Number(controller.embeddedRequestToken || 0))
                    || revision !== Math.max(0, Number(controller.embeddedFocusRevision || 0))
                    || signature !== __tmGetDocTitleEmbeddedFocusSignature(controller);
                if (isStale()) {
                    resolve(null);
                    return;
                }
                try {
                    const [tasks, managedDocIds] = await Promise.all([
                        API.getTasksByIds(taskIds),
                        resolveDocIdsFromGroups({ groupId: 'all', includeQuickAddDoc: true }),
                    ]);
                    if (isStale()) {
                        resolve(null);
                        return;
                    }
                    const managedSet = new Set((Array.isArray(managedDocIds) ? managedDocIds : [])
                        .map((id) => String(id || '').trim()).filter(Boolean));
                    const managedTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => {
                        const sourceDocId = String(task?.root_id || task?.docId || '').trim();
                        return sourceDocId && managedSet.has(sourceDocId);
                    });
                    const sourceDocIds = Array.from(new Set(managedTasks
                        .map((task) => String(task?.root_id || task?.docId || '').trim()).filter(Boolean)));
                    const mode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() === 'hours' ? 'hours' : 'minutes';
                    resolve({
                        signature,
                        revision,
                        text: managedTasks.length ? __tmFormatDocTitleFocusDuration(managedTasks, mode) : '',
                        hasTasks: managedTasks.length > 0,
                        sourceDocIds,
                    });
                } catch (e) {
                    resolve({ signature, revision, text: '', hasTasks: false, sourceDocIds: [] });
                }
            }, 900);
        }).then((result) => {
            if (!result) return;
            const isCurrent = requestToken === Math.max(0, Number(controller.embeddedRequestToken || 0))
                && revision === Math.max(0, Number(controller.embeddedFocusRevision || 0))
                && signature === __tmGetDocTitleEmbeddedFocusSignature(controller);
            if (!isCurrent) return;
            controller.embeddedFocus = result;
            controller.embeddedSourceDocIds = new Set(result.sourceDocIds || []);
        }).finally(() => {
            if (controller.embeddedInFlight === request) controller.embeddedInFlight = null;
            __tmScheduleDocTitleMarkerSync(controller);
        });
    }

    function __tmObserveDocTitleMarkerController(controller, context) {
        const hostChanged = controller.title !== context.title || controller.attr !== context.attr;
        controller.docId = context.docId;
        controller.title = context.title;
        controller.attr = context.attr;
        if (!hostChanged && controller.observer) return;
        try { controller.observer?.disconnect?.(); } catch (e) {}
        controller.observer = new MutationObserver(() => __tmScheduleDocTitleMarkerSync(controller));
        controller.observer.observe(controller.attr, { childList: true });
        controller.observer.observe(controller.title, { attributes: true, attributeFilter: ['class'] });
    }

    function __tmSyncDocTitleMarkerController(controller) {
        if (!controller?.protyle?.isConnected) {
            __tmCleanupDocTitleMarkerController(controller);
            return;
        }
        const context = __tmResolveDocTitleMarkerContext(controller.protyle);
        if (!context) {
            __tmRemoveDocTitleMarker(controller);
            return;
        }
        __tmObserveDocTitleMarkerController(controller, context);
        const membershipKey = __tmGetDocTitleMarkerMembershipKey(context.docId);
        if (!__tmDocTitleMarkerMembershipCache.has(membershipKey)) {
            __tmRemoveDocTitleMarker(controller);
            __tmRequestDocTitleMarkerMembership(controller);
            return;
        }
        const target = __tmDocTitleMarkerMembershipCache.get(membershipKey);
        if (!target?.groupId) {
            if (!__tmObserveDocTitleEmbeddedTasks(controller, context)) {
                __tmRemoveDocTitleMarker(controller);
                return;
            }
            const embeddedTaskIds = __tmPrepareDocTitleEmbeddedCandidates(controller);
            const embeddedFocus = controller.embeddedFocus;
            const embeddedSignature = __tmGetDocTitleEmbeddedFocusSignature(controller);
            if (embeddedFocus?.hasTasks === true && embeddedFocus?.signature === embeddedSignature) {
                __tmRenderDocTitleMarker(controller, {
                    groupId: 'all',
                    group: null,
                    matchedBy: 'embedded',
                }, String(embeddedFocus.text || '').trim());
            } else {
                __tmRemoveDocTitleMarker(controller);
            }
            __tmRequestDocTitleEmbeddedFocus(controller, embeddedTaskIds);
            return;
        }
        __tmResetDocTitleEmbeddedFocusController(controller);
        const focus = __tmDocTitleMarkerFocusCache.get(context.docId);
        const focusSignature = __tmGetDocTitleMarkerFocusSignature();
        const durationText = SettingsStore.data.enableTomatoIntegration
            && focus?.signature === focusSignature
            ? String(focus.text || '').trim()
            : '';
        __tmRenderDocTitleMarker(controller, target, durationText);
        __tmRequestDocTitleMarkerFocus(controller);
    }

    function __tmScheduleDocTitleMarkerSync(controller) {
        if (!controller || controller.raf != null) return;
        const run = () => {
            controller.raf = null;
            try { __tmSyncDocTitleMarkerController(controller); } catch (e) {}
        };
        try {
            controller.raf = requestAnimationFrame(run);
        } catch (e) {
            controller.raf = setTimeout(run, 0);
        }
    }

    function __tmEnsureDocTitleMarker(input) {
        const context = __tmResolveDocTitleMarkerContext(input);
        if (!context) return null;
        let controller = __tmDocTitleMarkerControllers.get(context.protyle) || null;
        if (!controller) {
            controller = {
                protyle: context.protyle,
                title: null,
                attr: null,
                docId: context.docId,
                observer: null,
                raf: null,
                embeddedObserver: null,
                embeddedRoot: null,
                embeddedTimer: null,
                embeddedRequestToken: 0,
                embeddedFocusRevision: 0,
                embeddedInFlight: null,
                embeddedCandidateKey: null,
                embeddedSourceDocIds: new Set(),
                embeddedFocus: null,
            };
            __tmDocTitleMarkerControllers.set(context.protyle, controller);
        }
        __tmObserveDocTitleMarkerController(controller, context);
        __tmScheduleDocTitleMarkerSync(controller);
        return controller;
    }

    function __tmCleanupDocTitleMarkerController(controller, options = {}) {
        if (!controller) return;
        try { controller.observer?.disconnect?.(); } catch (e) {}
        controller.observer = null;
        __tmResetDocTitleEmbeddedFocusController(controller);
        if (controller.raf != null) {
            try { cancelAnimationFrame(controller.raf); } catch (e) { try { clearTimeout(controller.raf); } catch (e2) {} }
            controller.raf = null;
        }
        if (options.removeMarker !== false) __tmRemoveDocTitleMarker(controller);
        try { __tmDocTitleMarkerControllers.delete(controller.protyle); } catch (e) {}
    }

    function __tmDestroyDocTitleMarkers() {
        const buses = Array.isArray(__tmDocTitleMarkerEventBuses) ? __tmDocTitleMarkerEventBuses : [];
        buses.forEach((bus) => {
            if (__tmDocTitleMarkerLoadedHandler) {
                ['loaded-protyle-static', 'loaded-protyle-dynamic', 'switch-protyle'].forEach((name) => {
                    try { globalThis.__tmRuntimeEvents?.offEventBus?.(name, __tmDocTitleMarkerLoadedHandler, bus); } catch (e) {}
                });
            }
            if (__tmDocTitleMarkerDestroyedHandler) {
                try { globalThis.__tmRuntimeEvents?.offEventBus?.('destroy-protyle', __tmDocTitleMarkerDestroyedHandler, bus); } catch (e) {}
            }
        });
        __tmDocTitleMarkerLoadedHandler = null;
        __tmDocTitleMarkerDestroyedHandler = null;
        __tmDocTitleMarkerEventBuses = [];
        Array.from(__tmDocTitleMarkerControllers.values()).forEach((controller) => {
            __tmCleanupDocTitleMarkerController(controller);
        });
        __tmDocTitleMarkerControllers.clear();
        __tmDocTitleMarkerMembershipCache.clear();
        __tmDocTitleMarkerMembershipInFlight.clear();
        __tmDocTitleMarkerFocusCache.clear();
        __tmDocTitleMarkerFocusInFlight.clear();
        __tmDocTitleMarkerFocusRevisionByDoc.clear();
        __tmDocTitleMarkerScopeRevision += 1;
        __tmDocTitleMarkerFocusEpoch += 1;
        try {
            if (globalThis.__tmMarkDocTitleMarkersDirty === __tmMarkDocTitleMarkersDirty) {
                delete globalThis.__tmMarkDocTitleMarkersDirty;
            }
        } catch (e) {}
    }

    function __tmBindDocTitleMarkers() {
        __tmDestroyDocTitleMarkers();
        try { globalThis.__tmMarkDocTitleMarkersDirty = __tmMarkDocTitleMarkersDirty; } catch (e) {}
        __tmDocTitleMarkerLoadedHandler = (event) => {
            try { __tmEnsureDocTitleMarker(event); } catch (e) {}
        };
        __tmDocTitleMarkerDestroyedHandler = (event) => {
            try {
                const protyle = __tmResolveProtyleElement(event?.detail?.protyle || event?.protyle || null);
                const controller = protyle ? __tmDocTitleMarkerControllers.get(protyle) : null;
                if (controller) __tmCleanupDocTitleMarkerController(controller);
            } catch (e) {}
        };
        __tmDocTitleMarkerEventBuses = Array.from(new Set(globalThis.__tmHost?.getEventBuses?.() || [globalThis.__tmHost?.getEventBus?.()].filter(Boolean)));
        __tmDocTitleMarkerEventBuses.forEach((bus) => {
            ['loaded-protyle-static', 'loaded-protyle-dynamic', 'switch-protyle'].forEach((name) => {
                try { globalThis.__tmRuntimeEvents?.onEventBus?.(name, __tmDocTitleMarkerLoadedHandler, bus); } catch (e) {}
            });
            try { globalThis.__tmRuntimeEvents?.onEventBus?.('destroy-protyle', __tmDocTitleMarkerDestroyedHandler, bus); } catch (e) {}
        });
        document.querySelectorAll('.protyle').forEach((protyle) => {
            try { __tmEnsureDocTitleMarker(protyle); } catch (e) {}
        });
    }

    const __TM_DOCK_SIDEBAR_FOLLOW_DELAY_MS = 60;
    let __tmDockSidebarFollowProtyleHandler = null;
    let __tmDockSidebarFollowEventBuses = [];
    let __tmDockSidebarFollowTimer = null;
    let __tmDockSidebarFollowPendingDocId = '';
    let __tmDockSidebarFollowRunning = false;

    function __tmCanDockSidebarFollowCurrentDocument() {
        if (SettingsStore.data.dockSidebarFollowCurrentDocument !== true) return false;
        if (SettingsStore.data.dockSidebarEnabled === false) return false;
        const hostInfo = globalThis.__tmRuntimeHost?.getInfo?.() || null;
        if (!(hostInfo?.isDesktopDockHost ?? __tmIsDesktopDockHost())) return false;
        if (__tmIsTaskHorizonTabActiveNow()) return false;
        return __tmIsPluginVisibleNow();
    }

    function __tmResolveDockSidebarFollowDocId(event) {
        const runtime = event?.detail?.protyle || event?.protyle || null;
        const protyle = __tmResolveProtyleElement(runtime);
        if (!(protyle instanceof HTMLElement) || !protyle.isConnected) return '';
        if (state.modal instanceof Element && state.modal.contains(protyle)) return '';
        if (runtime?.backlinkData || runtime?.options?.backlinkData) return '';
        const activeWindow = globalThis.__tmCompat?.findActiveWindow?.() || null;
        if (activeWindow instanceof HTMLElement && !activeWindow.contains(protyle)) return '';
        const docId = String(
            runtime?.block?.rootID
            || runtime?.protyle?.block?.rootID
            || __tmGetDocIdFromProtyle(protyle)
            || ''
        ).trim();
        return __tmIsLikelyBlockId(docId) ? docId : '';
    }

    function __tmFlushDockSidebarCurrentDocumentFollow() {
        __tmDockSidebarFollowTimer = null;
        if (__tmDockSidebarFollowRunning) return;
        __tmDockSidebarFollowRunning = true;
        Promise.resolve().then(async () => {
            while (__tmDockSidebarFollowPendingDocId) {
                const docId = __tmDockSidebarFollowPendingDocId;
                __tmDockSidebarFollowPendingDocId = '';
                if (!__tmCanDockSidebarFollowCurrentDocument()) continue;
                if (String(state.activeDocId || '').trim() === docId) continue;
                await window.tmSwitchDoc?.(docId, { fallbackToAll: false });
            }
        }).catch(() => null).finally(() => {
            __tmDockSidebarFollowRunning = false;
            if (__tmDockSidebarFollowPendingDocId && !__tmDockSidebarFollowTimer) {
                __tmDockSidebarFollowTimer = setTimeout(__tmFlushDockSidebarCurrentDocumentFollow, 0);
            }
        });
    }

    function __tmScheduleDockSidebarCurrentDocumentFollow(docId) {
        const targetDocId = String(docId || '').trim();
        if (!targetDocId) return false;
        __tmDockSidebarFollowPendingDocId = targetDocId;
        if (__tmDockSidebarFollowTimer) clearTimeout(__tmDockSidebarFollowTimer);
        __tmDockSidebarFollowTimer = setTimeout(
            __tmFlushDockSidebarCurrentDocumentFollow,
            __TM_DOCK_SIDEBAR_FOLLOW_DELAY_MS
        );
        return true;
    }

    function __tmDestroyDockSidebarCurrentDocumentFollow() {
        const buses = Array.isArray(__tmDockSidebarFollowEventBuses) ? __tmDockSidebarFollowEventBuses : [];
        buses.forEach((bus) => {
            if (!__tmDockSidebarFollowProtyleHandler) return;
            try { globalThis.__tmRuntimeEvents?.offEventBus?.('switch-protyle', __tmDockSidebarFollowProtyleHandler, bus); } catch (e) {}
        });
        if (__tmDockSidebarFollowTimer) {
            try { clearTimeout(__tmDockSidebarFollowTimer); } catch (e) {}
        }
        __tmDockSidebarFollowProtyleHandler = null;
        __tmDockSidebarFollowEventBuses = [];
        __tmDockSidebarFollowTimer = null;
        __tmDockSidebarFollowPendingDocId = '';
    }

    function __tmBindDockSidebarCurrentDocumentFollow() {
        __tmDestroyDockSidebarCurrentDocumentFollow();
        __tmDockSidebarFollowProtyleHandler = (event) => {
            if (!__tmCanDockSidebarFollowCurrentDocument()) return;
            const docId = __tmResolveDockSidebarFollowDocId(event);
            if (!docId || String(state.activeDocId || '').trim() === docId) return;
            __tmScheduleDockSidebarCurrentDocumentFollow(docId);
        };
        __tmDockSidebarFollowEventBuses = Array.from(new Set(
            globalThis.__tmHost?.getEventBuses?.()
            || [globalThis.__tmHost?.getEventBus?.()].filter(Boolean)
        ));
        __tmDockSidebarFollowEventBuses.forEach((bus) => {
            try { globalThis.__tmRuntimeEvents?.onEventBus?.('switch-protyle', __tmDockSidebarFollowProtyleHandler, bus); } catch (e) {}
        });
    }

    async function __tmAddOtherBlocksToSourceDocGroupFromMenu(blockIdsInput, options = {}) {
        const blockIds = __tmNormalizeOtherBlockRefs(Array.isArray(blockIdsInput) ? blockIdsInput : [blockIdsInput]).map((item) => item.id);
        if (!blockIds.length) {
            hint('⚠ 未找到当前块', 'warning');
            return null;
        }
        const addOtherBlock = window.tmAutoAddOtherBlocksToSourceDocGroup;
        if (typeof addOtherBlock !== 'function') {
            hint('⚠ 其他块页签功能尚未加载完成', 'warning');
            return null;
        }
        const result = await addOtherBlock(blockIds, {
            ...options,
            silent: false,
            forceRefresh: options?.forceRefresh !== false,
        });
        if (!result?.group) {
            const reason = String(result?.reason || '').trim();
            if (reason === 'cancelled') {
                return result;
            }
            if (reason === 'no-source-group' || reason === 'no-doc') {
                hint('⚠ 当前文档不在任何文档分组中，无法自动添加到其他块页签', 'warning');
            } else if (reason !== 'empty' && reason !== 'no-groups') {
                hint('⚠ 未找到可添加的文档分组', 'warning');
            }
            return result || null;
        }
        if (!result.added) return result;

        const groupName = __tmResolveDocGroupName(result.group);
        if (result.existed > 0) {
            hint(blockIds.length > 1
                ? `✅ 已添加 ${result.added} 个块到“${groupName}”，${result.existed} 个已存在`
                : `✅ 已添加到“${groupName}”，该分组中已有 ${result.existed} 个重复块`, 'success');
            return result;
        }
        hint(blockIds.length > 1 ? `✅ 已将 ${result.added} 个块添加到“${groupName}”` : `✅ 已添加到“${groupName}”`, 'success');
        return result;
    }

    function __tmBindDocGroupMenuEntry() {
        const eb = globalThis.__tmHost?.getEventBus?.() || null;
        if (!eb || typeof eb.on !== 'function') return;
        __tmDocMenuEventBus = eb;

        if (__tmEditorTitleIconMenuHandler && typeof eb.off === 'function') {
            try { globalThis.__tmRuntimeEvents?.offEventBus?.('click-editortitleicon', __tmEditorTitleIconMenuHandler, eb); } catch (e) {}
            __tmEditorTitleIconMenuHandler = null;
        }
        if (__tmDocTreeMenuHandler && typeof eb.off === 'function') {
            try { globalThis.__tmRuntimeEvents?.offEventBus?.('open-menu-doctree', __tmDocTreeMenuHandler, eb); } catch (e) {}
            __tmDocTreeMenuHandler = null;
        }
        if (__tmContentMenuHandler && typeof eb.off === 'function') {
            try { globalThis.__tmRuntimeEvents?.offEventBus?.('open-menu-content', __tmContentMenuHandler, eb); } catch (e) {}
            __tmContentMenuHandler = null;
        }
        if (__tmBlockIconMenuHandler && typeof eb.off === 'function') {
            try { globalThis.__tmRuntimeEvents?.offEventBus?.('click-blockicon', __tmBlockIconMenuHandler, eb); } catch (e) {}
            __tmBlockIconMenuHandler = null;
        }

        __tmEditorTitleIconMenuHandler = (event) => {
            const detail = event?.detail || {};
            const menu = detail.menu;
            if (!menu || typeof menu.addItem !== 'function') return;
            try {
                __tmLastRightClickedTitleProtyle = __tmResolveProtyleElement(detail?.protyle || null);
                __tmLastRightClickedTitleAtMs = Date.now();
            } catch (e) {}
            const docId = String(detail?.data?.id || detail?.protyle?.block?.rootID || '').trim();
            if (!docId) return;
            menu.addItem({
                icon: 'iconTaskHorizon',
                label: '添加到任务管理器分组',
                click: () => {
                    try { window.tmOpenAddDocToGroupDialog?.(docId); } catch (e) {}
                }
            });
            menu.addItem({
                icon: 'iconTaskHorizon',
                label: '添加到其他块页签',
                click: async () => {
                    try {
                        await __tmAddOtherBlocksToSourceDocGroupFromMenu([docId], { docId });
                    } catch (e) {
                        hint(`❌ 添加失败: ${e.message}`, 'error');
                    }
                }
            });
            if (__tmIsAiFeatureEnabled()) {
                menu.addItem({
                    icon: 'iconTaskHorizon',
                    label: 'AI SMART 分析',
                    click: async () => {
                        if (typeof __tmEnsureAiRuntimeLoaded === 'function' && !await __tmEnsureAiRuntimeLoaded()) return;
                        try { await window.tmAiAnalyzeDocumentSmart?.(docId); } catch (e) {}
                    }
                });
                menu.addItem({
                    icon: 'iconTaskHorizon',
                    label: 'AI 日程排期',
                    click: async () => {
                        if (typeof __tmEnsureAiRuntimeLoaded === 'function' && !await __tmEnsureAiRuntimeLoaded()) return;
                        try { await window.tmAiPlanDocumentSchedule?.(docId); } catch (e) {}
                    }
                });
            }
        };

        __tmDocTreeMenuHandler = (event) => {
            const detail = event?.detail || {};
            const menu = detail.menu;
            if (!menu || typeof menu.addItem !== 'function') return;
            const type = String(detail?.type || '').trim();
            if (type !== 'doc' && type !== 'docs') return;
            const docIds = __tmTryCollectDocIdsFromElements(detail?.elements);
            if (!docIds.length) return;
            menu.addItem({
                icon: 'iconTaskHorizon',
                label: docIds.length > 1 ? '添加所选文档到任务管理器分组' : '添加到任务管理器分组',
                click: () => {
                    try { window.tmOpenAddDocToGroupDialog?.(docIds); } catch (e) {}
                }
            });
            if (__tmIsAiFeatureEnabled() && docIds.length === 1) {
                const docId = String(docIds[0] || '').trim();
                if (docId) {
                    menu.addItem({
                        icon: 'iconTaskHorizon',
                        label: 'AI SMART 分析',
                        click: async () => {
                            if (typeof __tmEnsureAiRuntimeLoaded === 'function' && !await __tmEnsureAiRuntimeLoaded()) return;
                            try { await window.tmAiAnalyzeDocumentSmart?.(docId); } catch (e) {}
                        }
                    });
                    menu.addItem({
                        icon: 'iconTaskHorizon',
                        label: 'AI 日程排期',
                        click: async () => {
                            if (typeof __tmEnsureAiRuntimeLoaded === 'function' && !await __tmEnsureAiRuntimeLoaded()) return;
                            try { await window.tmAiPlanDocumentSchedule?.(docId); } catch (e) {}
                        }
                    });
                }
            }
        };

        __tmBlockIconMenuHandler = (event) => {
            const detail = event?.detail || {};
            const menu = detail.menu;
            if (!menu || typeof menu.addItem !== 'function') return;
            const rawBlockElements = [];
            const pushRawBlockElement = (item) => {
                if (!(item instanceof Element) || rawBlockElements.includes(item)) return;
                rawBlockElements.push(item);
            };
            const resolveRawBlockElementById = (rawId) => {
                const id = String(rawId || '').trim();
                if (!id) return null;
                try {
                    const protyle = __tmResolveProtyleElement(detail?.protyle || null);
                    const root = protyle?.querySelector?.('.protyle-wysiwyg, .protyle-content') || protyle;
                    if (!root) return null;
                    const escId = globalThis.CSS?.escape ? globalThis.CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
                    const found = root.querySelector?.(`[data-node-id="${escId}"], [data-id="${escId}"]`);
                    return found instanceof Element ? found : null;
                } catch (e) {}
                return null;
            };
            const pushRawBlockElementById = (rawId) => {
                pushRawBlockElement(resolveRawBlockElementById(rawId));
            };
            const pushSelectedBlockElementsForOtherBlocks = () => {
                try {
                    const protyle = __tmResolveProtyleElement(detail?.protyle || null);
                    const root = protyle?.querySelector?.('.protyle-wysiwyg, .protyle-content') || protyle;
                    Array.from(root?.querySelectorAll?.('.protyle-wysiwyg--select, .protyle-content--select') || []).forEach(pushRawBlockElement);
                } catch (e) {}
            };
            pushRawBlockElement(detail?.blockElement);
            pushRawBlockElement(detail?.element);
            try { Array.from(detail?.blockElements || []).forEach(pushRawBlockElement); } catch (e) {}
            const rawBlockIds = __tmCollectBlockIdsFromElements(rawBlockElements);
            __tmAddMoveBlockToDailyNoteMenuItem(menu, rawBlockIds, {
                protyle: detail?.protyle || null
            });
            const scheduleBlockIds = rawBlockIds;
            if (
                scheduleBlockIds.length === 1
                && globalThis.__tmCalendar
                && typeof globalThis.__tmCalendar.addTaskSchedule === 'function'
            ) {
                const scheduleBlockId = String(scheduleBlockIds[0] || '').trim();
                const scheduleBlockElement = rawBlockElements.find((item) => __tmResolveAnyBlockIdFromElement(item) === scheduleBlockId) || rawBlockElements[0] || null;
                if (scheduleBlockId) {
                    menu.addItem({
                        icon: 'iconTaskHorizon',
                        label: '添加至今天日程',
                        click: async () => {
                            await __tmAddBlockToTodaySchedule(scheduleBlockId, scheduleBlockElement);
                        }
                    });
                }
            }
            let blockIds = __tmCollectOtherBlockIdsFromElements(rawBlockElements);
            if (!blockIds.length) {
                pushRawBlockElement(detail?.buttonElement);
                pushRawBlockElementById(detail?.id);
                pushRawBlockElementById(detail?.nodeId);
                pushRawBlockElementById(detail?.blockId);
                pushRawBlockElementById(detail?.data?.id);
                pushRawBlockElementById(detail?.data?.nodeId);
                pushRawBlockElementById(detail?.data?.blockId);
                pushSelectedBlockElementsForOtherBlocks();
                blockIds = __tmCollectOtherBlockIdsFromElements(rawBlockElements);
            }
            if (!blockIds.length) return;
            menu.addItem({
                icon: 'iconTaskHorizon',
                label: blockIds.length > 1 ? '添加所选块到其他块页签' : '添加到其他块页签',
                click: async () => {
                    try {
                        await __tmAddOtherBlocksToSourceDocGroupFromMenu(blockIds);
                    } catch (e) {
                        hint(`❌ 添加失败: ${e.message}`, 'error');
                    }
                }
            });
        };

        __tmContentMenuHandler = (event) => {
            const detail = event?.detail || {};
            const menu = detail.menu;
            if (!menu || typeof menu.addItem !== 'function') return;
            const fallbackBlockId = String(__tmResolveAnyBlockIdFromElement(detail?.element) || '').trim();
            const blockIds = __tmCollectSelectedBlockIdsFromProtyle(detail?.protyle || null, fallbackBlockId);
            __tmAddMoveBlockToDailyNoteMenuItem(menu, blockIds, {
                protyle: detail?.protyle || null
            });
        };

        globalThis.__tmRuntimeEvents?.onEventBus?.('click-editortitleicon', __tmEditorTitleIconMenuHandler, eb);
        globalThis.__tmRuntimeEvents?.onEventBus?.('open-menu-doctree', __tmDocTreeMenuHandler, eb);
        globalThis.__tmRuntimeEvents?.onEventBus?.('open-menu-content', __tmContentMenuHandler, eb);
        globalThis.__tmRuntimeEvents?.onEventBus?.('click-blockicon', __tmBlockIconMenuHandler, eb);
    }

    const __TM_NATIVE_DOC_CHECKBOX_SYNC_DELAY_MS = 260;
    const __TM_NATIVE_DOC_CHECKBOX_PREVIOUS_STATE_TTL_MS = 5000;
    const __TM_NATIVE_DOC_CHECKBOX_RECENT_SYNC_SKIP_MS = 8000;
    const __TM_NATIVE_DOC_CHECKBOX_STRUCTURAL_EMPTY_STATUS_GRACE_MS = 5000;
    const __TM_NATIVE_DOC_TASK_CONTENT_SYNC_DELAY_MS = 80;
    const __tmNativeDocCheckboxPreviousStateMap = new Map();
    const __tmNativeDocCheckboxLastSyncedStateMap = new Map();
    const __tmNativeDocCheckboxStructuralChangeAtMap = new Map();
    const __tmNativeDocTaskContentSyncTimers = new Map();
    let __tmNativeDocTaskContentInputHandler = null;

    function __tmResolveNativeDocEventElement(target) {
        try {
            if (target instanceof Element) return target;
            if (target?.parentElement instanceof Element) return target.parentElement;
        } catch (e) {}
        return null;
    }

    function __tmIsNativeDocCheckboxSyncExcludedTarget(target) {
        const node = __tmResolveNativeDocEventElement(target);
        if (!(node instanceof Element)) return false;
        try {
            if (typeof __tmIsTaskDetailNoteViewLocalEventTarget === 'function'
                && __tmIsTaskDetailNoteViewLocalEventTarget(node)) return true;
        } catch (e) {}
        try {
            if (node.closest?.([
                '.tm-modal',
                '.siyuan-comment-popover',
                '#siyuan-comment-app',
                '.siyuan-comment-preview-wysiwyg',
                '.block__popover',
                '.b3-dialog',
                '.protyle--preview',
                '.protyle--embed',
                '.protyle-util',
                '.protyle-hint',
                '[data-siyuan-comment-popover-protyle="true"]',
            ].join(','))) return true;
        } catch (e) {}
        return false;
    }

    function __tmFindNativeDocTaskListItem(target) {
        try {
            if (__tmIsNativeDocCheckboxSyncExcludedTarget(target)) return null;
            const node = __tmResolveNativeDocEventElement(target);
            const closestListItem = node?.closest?.('[data-type="NodeListItem"], .li[data-node-id]') || null;
            if (closestListItem instanceof Element) {
                const ownsTaskAction = Array.from(closestListItem.children || [])
                    .some((child) => child instanceof Element && child.classList?.contains?.('protyle-action--task'));
                if (ownsTaskAction && !__tmIsNativeDocCheckboxSyncExcludedTarget(closestListItem)) return closestListItem;
            }
            const listItem = globalThis.__tmCompat?.resolveNativeTaskListItem?.(node) || null;
            if (listItem instanceof Element && __tmIsNativeDocCheckboxSyncExcludedTarget(listItem)) return null;
            return listItem;
        } catch (e) {
            return null;
        }
    }

    function __tmResolveNativeDocTaskBlockId(target) {
        try {
            const listItem = __tmFindNativeDocTaskListItem(target);
            if (!(listItem instanceof Element)) return '';
            return String(__tmResolveAnyBlockIdFromElement(listItem) || '').trim();
        } catch (e) {
            return '';
        }
    }

    function __tmResolveNativeDocTaskToggleBlockId(target) {
        try {
            const toggle = globalThis.__tmCompat?.findTaskCheckboxAction?.(target) || null;
            if (!(toggle instanceof Element) || !toggle.closest('.protyle')) return '';
            return __tmResolveNativeDocTaskBlockId(toggle);
        } catch (e) {
            return '';
        }
    }

    function __tmResolveNativeDocTaskToggleBlockIdFromEventTarget(target) {
        try {
            if (__tmIsNativeDocCheckboxSyncExcludedTarget(target)) return '';
            const node = __tmResolveNativeDocEventElement(target);
            if (!(node instanceof Element) || !node.closest) return '';
            const toggle = node.closest('.protyle-action--task');
            if (!(toggle instanceof Element) || !toggle.closest('.protyle')) return '';
            return __tmResolveNativeDocTaskBlockId(toggle);
        } catch (e) {
            return '';
        }
    }

    function __tmReadNativeDocTaskDoneFromListItem(listItem) {
        try {
            if (!(listItem instanceof Element)) return null;
            if (listItem.classList?.contains?.('protyle-task--done')) return true;
            const toggle = globalThis.__tmCompat?.findTaskCheckboxAction?.(listItem) || listItem.querySelector('.protyle-action--task');
            const useEl = toggle?.querySelector?.('use') || null;
            const href = String(useEl?.getAttribute?.('xlink:href') || useEl?.getAttribute?.('href') || '').trim();
            if (href === '#iconCheck') return true;
            if (href === '#iconUncheck') return false;
            const checkboxInput = listItem.querySelector('input[type="checkbox"]');
            if (checkboxInput instanceof HTMLInputElement) return !!checkboxInput.checked;
            return null;
        } catch (e) {
            return null;
        }
    }

    function __tmReadNativeDocTaskDoneFromDom(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return null;
        const scopedItems = __tmFindNativeDocTaskListItemsByIds([rawId]);
        const listItem = scopedItems[0] || null;
        return listItem instanceof Element ? __tmReadNativeDocTaskDoneFromListItem(listItem) : null;
    }

    function __tmMarkNativeDocCheckboxSyncedState(blockIds, done) {
        if (typeof done !== 'boolean') return;
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [blockIds])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        if (!ids.length) return;
        try {
            const entry = {
                done: !!done,
                at: Date.now(),
            };
            ids.forEach((id) => __tmNativeDocCheckboxLastSyncedStateMap.set(id, entry));
            while (__tmNativeDocCheckboxLastSyncedStateMap.size > 600) {
                const oldestKey = __tmNativeDocCheckboxLastSyncedStateMap.keys().next().value;
                if (oldestKey === undefined) break;
                __tmNativeDocCheckboxLastSyncedStateMap.delete(oldestKey);
            }
        } catch (e) {}
    }

    function __tmShouldSkipNativeDocCheckboxDirtyRerun(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return false;
        try {
            const entry = __tmNativeDocCheckboxLastSyncedStateMap.get(rawId);
            if (!entry || typeof entry.done !== 'boolean') return false;
            if ((Date.now() - Number(entry.at || 0)) > __TM_NATIVE_DOC_CHECKBOX_RECENT_SYNC_SKIP_MS) return false;
            const currentDone = __tmReadNativeDocTaskDoneFromDom(rawId);
            return typeof currentDone === 'boolean' && currentDone === entry.done;
        } catch (e) {
            return false;
        }
    }

    function __tmWasNativeDocCheckboxRecentlySynced(blockId, done) {
        const rawId = String(blockId || '').trim();
        if (!rawId || typeof done !== 'boolean') return false;
        try {
            const entry = __tmNativeDocCheckboxLastSyncedStateMap.get(rawId);
            if (!entry || typeof entry.done !== 'boolean') return false;
            if ((Date.now() - Number(entry.at || 0)) > __TM_NATIVE_DOC_CHECKBOX_RECENT_SYNC_SKIP_MS) return false;
            return entry.done === !!done;
        } catch (e) {
            return false;
        }
    }

    function __tmReadNativeDocCheckboxIconDoneState(target) {
        try {
            const el = target instanceof Element ? target : null;
            if (!(el instanceof Element)) return null;
            const href = String(el.getAttribute('xlink:href') || el.getAttribute('href') || '').trim();
            if (href === '#iconCheck') return true;
            if (href === '#iconUncheck') return false;
            return null;
        } catch (e) {
            return null;
        }
    }

    function __tmFindNativeDocTaskListItemsByIds(blockIds) {
        const items = globalThis.__tmCompat?.findTaskListItemsByIds?.(blockIds) || [];
        return (Array.isArray(items) ? items : [])
            .filter((item) => item instanceof Element && !__tmIsNativeDocCheckboxSyncExcludedTarget(item));
    }

    function __tmFindNativeDocBlockElementsByIds(blockIds) {
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [blockIds])
            .map((item) => String(item || '').trim())
            .filter(Boolean)));
        if (!ids.length || typeof document === 'undefined') return [];
        const roots = Array.from(document.querySelectorAll?.('.protyle-wysiwyg') || []);
        const out = [];
        const seen = new Set();
        roots.forEach((root) => {
            if (!(root instanceof Element)) return;
            let candidates = [];
            const safeIds = ids.filter((id) => /^[A-Za-z0-9_-]+$/.test(id));
            if (safeIds.length === ids.length) {
                const selector = safeIds
                    .flatMap((id) => [`[data-node-id="${id}"]`, `[data-id="${id}"]`])
                    .join(',');
                try { candidates = Array.from(root.querySelectorAll(selector)); } catch (e) { candidates = []; }
            }
            if (safeIds.length !== ids.length) {
                try { candidates = Array.from(root.querySelectorAll('[data-node-id], [data-id]')); } catch (e) { candidates = []; }
            }
            candidates.forEach((candidate) => {
                if (!(candidate instanceof Element) || seen.has(candidate)) return;
                const candidateId = String(candidate.getAttribute('data-node-id') || candidate.getAttribute('data-id') || '').trim();
                if (!ids.includes(candidateId) || __tmIsNativeDocCheckboxSyncExcludedTarget(candidate)) return;
                seen.add(candidate);
                out.push(candidate);
            });
        });
        return out;
    }

    function __tmMirrorNativeDocTaskPriorityAttr(detail = {}) {
        const attrKey = String(detail?.attrKey || '').trim();
        if (!attrKey || __tmResolveTaskMetaFieldByAttrKey(attrKey) !== 'priority') return false;
        const priorityKeys = (typeof __tmGetTaskMetaAttrReadKeys === 'function'
            ? __tmGetTaskMetaAttrReadKeys('priority')
            : ['custom-priority'])
            .map((key) => String(key || '').trim())
            .filter(Boolean);
        const writeKey = priorityKeys.includes(attrKey)
            ? attrKey
            : (String(__tmGetTaskMetaAttrKey?.('priority') || '').trim() || 'custom-priority');
        const value = String(detail?.value ?? '').trim();
        const attrHostId = String(detail?.attrHostId || '').trim();
        let targets = attrHostId ? __tmFindNativeDocBlockElementsByIds([attrHostId]) : [];
        if (!targets.length) {
            targets = __tmFindNativeDocBlockElementsByIds([
                detail?.resolvedTaskId,
                detail?.requestedTaskId,
                detail?.taskId,
            ]).filter((item) => item.matches?.('[data-type="NodeListItem"], .li[data-node-id]'));
        }
        let changed = false;
        targets.forEach((target) => {
            const before = priorityKeys.map((key) => String(target.getAttribute(key) ?? '')).join('\n');
            priorityKeys.forEach((key) => {
                try { target.removeAttribute(key); } catch (e) {}
            });
            if (value) {
                try { target.setAttribute(writeKey, value); } catch (e) {}
            }
            const after = priorityKeys.map((key) => String(target.getAttribute(key) ?? '')).join('\n');
            if (before !== after) changed = true;
        });
        return changed;
    }

    function __tmReadNativeDocCheckboxTaskSnapshot(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return { taskId: '', status: '', taskCompleteAt: '' };
        let taskId = rawId;
        let task = null;
        try {
            const binding = typeof __tmResolveLocalTaskBindingFromAnyBlockId === 'function'
                ? __tmResolveLocalTaskBindingFromAnyBlockId(rawId)
                : null;
            const boundTaskId = String(binding?.taskId || '').trim();
            if (boundTaskId) taskId = boundTaskId;
            task = binding?.task || null;
        } catch (e) {
            task = null;
        }
        try {
            task = task || globalThis.__tmTaskBoundary?.getTask?.(taskId) || null;
        } catch (e) {}
        return {
            taskId,
            status: String(task?.customStatus || task?.custom_status || '').trim(),
            taskCompleteAt: __tmNormalizeTaskCompleteAtValue(task?.taskCompleteAt || task?.task_complete_at || ''),
        };
    }

    function __tmRememberNativeDocCheckboxPreviousState(blockId, options = {}) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        const now = Date.now();
        const hasExplicitPreviousDone = typeof opts.previousDone === 'boolean';
        let existing = null;
        try {
            existing = __tmNativeDocCheckboxPreviousStateMap.get(rawId) || null;
            if (existing && Number(existing.expiresAt || 0) <= now) existing = null;
            if (existing && !hasExplicitPreviousDone) return existing;
        } catch (e) {}
        const previousDone = hasExplicitPreviousDone
            ? opts.previousDone
            : __tmReadNativeDocTaskDoneFromDom(rawId);
        if (previousDone === null) return null;
        const snapshot = existing || __tmReadNativeDocCheckboxTaskSnapshot(rawId);
        const source = String(opts.source || '').trim();
        const userInitiated = /^native-doc-checkbox-(?:click|pointerup)$/.test(source) || existing?.userInitiated === true;
        const entry = {
            blockId: rawId,
            taskId: String(snapshot.taskId || rawId).trim() || rawId,
            previousDone: !!previousDone,
            status: String(snapshot.status || '').trim(),
            taskCompleteAt: String(snapshot.taskCompleteAt || '').trim(),
            source,
            userInitiated,
            expiresAt: now + __TM_NATIVE_DOC_CHECKBOX_PREVIOUS_STATE_TTL_MS,
        };
        try {
            __tmNativeDocCheckboxPreviousStateMap.set(rawId, entry);
            if (entry.taskId && entry.taskId !== rawId) __tmNativeDocCheckboxPreviousStateMap.set(entry.taskId, entry);
            if (__tmNativeDocCheckboxPreviousStateMap.size > 600) {
                const oldestKey = __tmNativeDocCheckboxPreviousStateMap.keys().next().value;
                if (oldestKey !== undefined) __tmNativeDocCheckboxPreviousStateMap.delete(oldestKey);
            }
        } catch (e) {}
        return entry;
    }

    function __tmConsumeNativeDocCheckboxPreviousState(blockIds) {
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [blockIds])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        if (!ids.length) return null;
        const now = Date.now();
        let hit = null;
        ids.some((id) => {
            try {
                const entry = __tmNativeDocCheckboxPreviousStateMap.get(id);
                if (!entry) return false;
                if (Number(entry.expiresAt || 0) <= now) {
                    __tmNativeDocCheckboxPreviousStateMap.delete(id);
                    return false;
                }
                hit = entry;
                return true;
            } catch (e) {
                return false;
            }
        });
        if (!hit) return null;
        try {
            ids.forEach((id) => __tmNativeDocCheckboxPreviousStateMap.delete(id));
            if (hit.blockId) __tmNativeDocCheckboxPreviousStateMap.delete(hit.blockId);
            if (hit.taskId) __tmNativeDocCheckboxPreviousStateMap.delete(hit.taskId);
        } catch (e) {}
        return hit;
    }

    function __tmMirrorNativeDocTaskStatusAttr(blockIds, customStatus) {
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [blockIds]).map((item) => String(item || '').trim()).filter(Boolean)));
        const nextStatus = String(customStatus || '').trim();
        if (!ids.length) return false;
        const listItems = __tmFindNativeDocTaskListItemsByIds(ids);
        if (!listItems.length) return false;
        const statusAttrKey = typeof __tmGetTaskMetaAttrKey === 'function' ? __tmGetTaskMetaAttrKey('customStatus') : 'custom-status';
        let changed = false;
        listItems.forEach((listItem) => {
            const beforeStatus = String(listItem.getAttribute(statusAttrKey) || listItem.getAttribute('custom-status') || '').trim();
            try {
                if (nextStatus) listItem.setAttribute(statusAttrKey, nextStatus);
                else listItem.removeAttribute(statusAttrKey);
                if (statusAttrKey !== 'custom-status') listItem.removeAttribute('custom-status');
            } catch (e) {}
            const afterStatus = String(listItem.getAttribute(statusAttrKey) || '').trim();
            if (beforeStatus !== afterStatus) changed = true;
        });
        return changed;
    }

    function __tmBumpNativeDocCheckboxReconcileVersion(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return 0;
        const nextVersion = (Number(__tmNativeDocCheckboxReconcileVersions.get(rawId)) || 0) + 1;
        __tmNativeDocCheckboxReconcileVersions.set(rawId, nextVersion);
        return nextVersion;
    }

    function __tmIsNativeDocCheckboxReconcileVersionCurrent(blockId, version) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return false;
        return (Number(__tmNativeDocCheckboxReconcileVersions.get(rawId)) || 0) === (Number(version) || 0);
    }

    function __tmClearNativeDocCheckboxReconcileTimers(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return;
        try {
            const timers = __tmNativeDocCheckboxReconcileTimers.get(rawId);
            if (Array.isArray(timers)) timers.forEach((timer) => clearTimeout(timer));
        } catch (e) {}
        try { __tmNativeDocCheckboxReconcileTimers.delete(rawId); } catch (e) {}
    }

    function __tmMarkNativeDocCheckboxInsertedBlocks(blockIds, ttlMs = 5000) {
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [blockIds]).map((item) => String(item || '').trim()).filter(Boolean)));
        if (!ids.length) return;
        const until = Date.now() + Math.max(500, Number(ttlMs) || 5000);
        try {
            ids.forEach((rawId) => {
                __tmNativeDocCheckboxInsertedBlockMap.set(rawId, until);
            });
        } catch (e) {}
    }

    function __tmMarkNativeDocCheckboxStructuralChange(blockIds) {
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [blockIds]).map((item) => String(item || '').trim()).filter(Boolean)));
        if (!ids.length) return;
        const now = Date.now();
        try {
            ids.forEach((rawId) => __tmNativeDocCheckboxStructuralChangeAtMap.set(rawId, now));
            if (__tmNativeDocCheckboxStructuralChangeAtMap.size > 600) {
                for (const [key, ts] of __tmNativeDocCheckboxStructuralChangeAtMap.entries()) {
                    if ((now - Number(ts || 0)) > __TM_NATIVE_DOC_CHECKBOX_STRUCTURAL_EMPTY_STATUS_GRACE_MS) {
                        __tmNativeDocCheckboxStructuralChangeAtMap.delete(key);
                    }
                }
            }
        } catch (e) {}
    }

    function __tmHasRecentNativeDocCheckboxStructuralChange(blockIds) {
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [blockIds]).map((item) => String(item || '').trim()).filter(Boolean)));
        const now = Date.now();
        try {
            if (typeof globalThis.__taskHorizonQuickbarHasRecentAttrHostStructuralChange === 'function'
                && globalThis.__taskHorizonQuickbarHasRecentAttrHostStructuralChange(__TM_NATIVE_DOC_CHECKBOX_STRUCTURAL_EMPTY_STATUS_GRACE_MS)) {
                return true;
            }
        } catch (e) {}
        if (!ids.length) return false;
        try {
            return ids.some((rawId) => {
                const ts = Number(__tmNativeDocCheckboxStructuralChangeAtMap.get(rawId) || 0);
                if (!ts) return false;
                if ((now - ts) > __TM_NATIVE_DOC_CHECKBOX_STRUCTURAL_EMPTY_STATUS_GRACE_MS) {
                    __tmNativeDocCheckboxStructuralChangeAtMap.delete(rawId);
                    return false;
                }
                return true;
            });
        } catch (e) {
            return false;
        }
    }

    function __tmConsumeNativeDocCheckboxInsertedBlock(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return false;
        try {
            const until = Number(__tmNativeDocCheckboxInsertedBlockMap.get(rawId) || 0);
            if (!until) return false;
            __tmNativeDocCheckboxInsertedBlockMap.delete(rawId);
            return until >= Date.now();
        } catch (e) {
            return false;
        }
    }

    function __tmIsNativeDocTaskBlockInsertionElement(el) {
        if (!(el instanceof Element)) return false;
        try {
            if (el.matches?.('[data-type="NodeListItem"], .li[data-node-id]')) return true;
            return !!el.querySelector?.('[data-type="NodeListItem"], .li[data-node-id]');
        } catch (e) {
            return false;
        }
    }

    function __tmResolveNativeDocCheckboxAttrHostIdFromDom(blockId, taskId = '') {
        const rawId = String(blockId || '').trim();
        const tid = String(taskId || '').trim();
        if (!rawId || typeof document === 'undefined') return '';
        const readId = (el) => String(el?.dataset?.nodeId || el?.getAttribute?.('data-node-id') || '').trim();
        const isTaskList = (el) => {
            if (!(el instanceof Element)) return false;
            if (!el.matches?.('.list,[data-type="NodeList"]')) return false;
            const subtype = String(el.getAttribute?.('data-subtype') || el.dataset?.subtype || '').trim().toLowerCase();
            return subtype === 't';
        };
        const directTaskItems = (listEl) => {
            if (!(listEl instanceof Element) || !isTaskList(listEl)) return [];
            return Array.from(listEl.children || []).filter((child) => {
                if (!(child instanceof Element)) return false;
                if (!child.matches?.('.li,[data-type="NodeListItem"]')) return false;
                return !!readId(child);
            });
        };
        const siblingTaskList = (listEl, direction = 'next') => {
            if (!(listEl instanceof Element)) return null;
            let sibling = direction === 'prev' ? listEl.previousElementSibling : listEl.nextElementSibling;
            while (sibling instanceof Element && !readId(sibling)) {
                sibling = direction === 'prev' ? sibling.previousElementSibling : sibling.nextElementSibling;
            }
            if (!isTaskList(sibling)) return null;
            return directTaskItems(sibling).length ? sibling : null;
        };
        const hasAdjacentTaskList = (listEl) => !!(siblingTaskList(listEl, 'prev') || siblingTaskList(listEl, 'next'));
        let el = null;
        try {
            const escId = globalThis.CSS?.escape ? globalThis.CSS.escape(rawId) : rawId.replace(/["\\]/g, '\\$&');
            el = document.querySelector?.(`[data-node-id="${escId}"]`) || null;
        } catch (e) {
            el = null;
        }
        if (!(el instanceof Element)) return '';
        if (el.matches?.('.list,[data-type="NodeList"]')) {
            const listId = readId(el);
            const taskItems = directTaskItems(el);
            const firstTaskId = readId(taskItems[0]);
            if (listId && taskItems.length <= 1 && !hasAdjacentTaskList(el) && (!tid || !firstTaskId || firstTaskId === tid)) return listId;
            if (firstTaskId && (!tid || firstTaskId === tid)) return firstTaskId;
            return '';
        }
        const taskLi = el.matches?.('.li,[data-type="NodeListItem"]')
            ? el
            : el.closest?.('.li,[data-type="NodeListItem"]');
        const taskLiId = readId(taskLi);
        if (!taskLiId) return '';
        const parentList = taskLi?.parentElement instanceof Element && taskLi.parentElement.matches?.('.list,[data-type="NodeList"]')
            ? taskLi.parentElement
            : null;
        const parentListId = readId(parentList);
        const firstTask = directTaskItems(parentList)[0] || null;
        const siblingTasks = directTaskItems(parentList);
        if (parentListId && siblingTasks.length === 1 && firstTask === taskLi && !hasAdjacentTaskList(parentList)) return parentListId;
        return taskLiId;
    }

    function __tmMirrorDocCheckboxStatusPatch(taskId, patch) {
        const tid = String(taskId || '').trim();
        if (!tid || !patch || typeof patch !== 'object') return;
        const value = String(patch.customStatus || '').trim();
        if (!value) return;
        try {
            const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
            if (task && typeof task === 'object') {
                task.customStatus = value;
                task.custom_status = value;
            }
        } catch (e) {}
        try {
            const pending = globalThis.__tmRuntimeState?.getPendingTaskById?.(tid) || state.pendingInsertedTasks?.[tid];
            if (pending && typeof pending === 'object') {
                pending.customStatus = value;
                pending.custom_status = value;
            }
        } catch (e) {}
    }

    async function __tmReadDocCheckboxBlockAttrs(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return { status: '', taskCompleteAt: '' };
        let attrTargetId = rawId;
        let taskMirrorId = '';
        try {
            const binding = typeof __tmResolveTaskBindingFromAnyBlockId === 'function'
                ? await __tmResolveTaskBindingFromAnyBlockId(rawId)
                : null;
            const resolvedAttrId = String(binding?.attrHostId || '').trim();
            const resolvedTaskId = String(binding?.taskId || '').trim();
            if (resolvedAttrId) attrTargetId = resolvedAttrId;
            if (resolvedTaskId && resolvedTaskId !== attrTargetId) taskMirrorId = resolvedTaskId;
        } catch (e) {}
        try {
            const res = await API.call('/api/attr/getBlockAttrs', { id: attrTargetId });
            let attrs = (res && res.code === 0 && res.data && typeof res.data === 'object') ? res.data : {};
            if (taskMirrorId) {
                try {
                    const mirrorRes = await API.call('/api/attr/getBlockAttrs', { id: taskMirrorId });
                    const mirrorAttrs = (mirrorRes && mirrorRes.code === 0 && mirrorRes.data && typeof mirrorRes.data === 'object') ? mirrorRes.data : {};
                    attrs = { ...mirrorAttrs, ...attrs };
                } catch (e) {}
            }
            const result = {
                status: typeof __tmReadTaskMetaAttrValue === 'function'
                    ? String(__tmReadTaskMetaAttrValue(attrs, 'customStatus') || '').trim()
                    : String(attrs['custom-status'] || '').trim(),
                taskCompleteAt: __tmNormalizeTaskCompleteAtValue(typeof __tmReadTaskMetaAttrValue === 'function'
                    ? __tmReadTaskMetaAttrValue(attrs, 'taskCompleteAt')
                    : (attrs['custom-task-complete-at'] || '')),
            };
            if (__tmShouldLogStatusDebug([rawId, attrTargetId], false)) {
                __tmPushStatusDebug('checkbox-attrs-read', {
                    blockId: rawId,
                    attrTargetId,
                    result,
                }, [rawId, attrTargetId], { force: false });
            }
            return result;
        } catch (e) {
            if (__tmShouldLogStatusDebug([rawId, attrTargetId], false)) {
                __tmPushStatusDebug('checkbox-attrs-read:error', {
                    blockId: rawId,
                    attrTargetId,
                    error: String(e?.message || e || ''),
                }, [rawId, attrTargetId], { force: false });
            }
            return { status: '', taskCompleteAt: '' };
        }
    }

    async function __tmReconcileNativeDocCheckboxStatus(blockId, taskId, attrPatch, expectedDone, syncVersion = 0, options = {}) {
        const rawId = String(blockId || '').trim();
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const expectedStatus = String(attrPatch?.customStatus || '').trim();
        const hasExpectedCompleteAtPatch = !!(attrPatch && typeof attrPatch === 'object'
            && Object.prototype.hasOwnProperty.call(attrPatch, 'taskCompleteAt'));
        const expectedCompleteAt = hasExpectedCompleteAtPatch
            ? __tmNormalizeTaskCompleteAtValue(attrPatch?.taskCompleteAt || '')
            : '';
        const done = !!expectedDone;
        if (!rawId || !tid || (!expectedStatus && !hasExpectedCompleteAtPatch) || !__tmIsNativeDocCheckboxReconcileVersionCurrent(rawId, syncVersion)) return false;
        let attrTargetId = String(opts.attrTargetId || '').trim();
        if (!attrTargetId) {
            try { attrTargetId = __tmResolveNativeDocCheckboxAttrHostIdFromDom(rawId, tid); } catch (e) { attrTargetId = ''; }
        }
        if (!attrTargetId) {
            try { attrTargetId = await __tmResolveTaskAttrHostIdFromAnyBlockId(rawId); } catch (e) { attrTargetId = ''; }
        }
        const domDone = __tmReadNativeDocTaskDoneFromDom(rawId);
        const beforeAttrs = await __tmReadDocCheckboxBlockAttrs(attrTargetId || tid);
        const beforeStatus = String(beforeAttrs?.status || '').trim();
        const beforeCompleteAt = String(beforeAttrs?.taskCompleteAt || '').trim();
        if (!__tmIsNativeDocCheckboxReconcileVersionCurrent(rawId, syncVersion)) return false;
        const statusMatchedBefore = !expectedStatus || beforeStatus === expectedStatus;
        const completeAtMatchedBefore = !hasExpectedCompleteAtPatch || beforeCompleteAt === expectedCompleteAt;
        if (domDone !== done || (statusMatchedBefore && completeAtMatchedBefore)) return false;
        if (expectedStatus) __tmMirrorNativeDocTaskStatusAttr([rawId, tid, attrTargetId], expectedStatus);
        const patchTask = globalThis.__tmRequireTaskMutation?.('patchTask');
        if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
        await patchTask(tid, attrPatch, {
            background: true,
            wait: false,
            skipFlush: true,
            skipInteractionGate: true,
            source: 'native-doc-checkbox-reconcile',
            reason: 'native-doc-checkbox-reconcile',
            label: '文档任务状态',
            saveMetaNow: false,
            attrTargetId,
            mirrorTaskAttrs: false,
            skipNoopCheck: true,
        });
        try { globalThis.__taskHorizonQuickbarScheduleAttrHostMigration?.('native-checkbox-reconcile'); } catch (e) {}
        return true;
    }

    function __tmScheduleNativeDocCheckboxStatusReconcile(blockId, taskId, attrPatch, expectedDone, syncVersion, options = {}) {
        const rawId = String(blockId || '').trim();
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!rawId || !tid || !attrPatch || typeof attrPatch !== 'object') return;
        __tmClearNativeDocCheckboxReconcileTimers(rawId);
        const timers = [260, 900].map((delayMs) => setTimeout(() => {
            if (!__tmIsNativeDocCheckboxReconcileVersionCurrent(rawId, syncVersion)) return;
            __tmReconcileNativeDocCheckboxStatus(rawId, tid, attrPatch, expectedDone, syncVersion, opts).catch(() => null);
        }, delayMs));
        __tmNativeDocCheckboxReconcileTimers.set(rawId, timers);
    }

    function __tmApplyNativeDocCheckboxLocalState(taskId, done, statusValue = '', taskLike = null, taskCompleteAtValue = '', options = {}) {
        const tid = String(taskId || '').trim();
        const nextDone = !!done;
        const nextStatus = String(statusValue || '').trim();
        const nextTaskCompleteAt = __tmNormalizeTaskCompleteAtValue(taskCompleteAtValue);
        const opts = (options && typeof options === 'object') ? options : {};
        const shouldSyncTaskCompleteAt = opts.syncTaskCompleteAt === true || !!nextTaskCompleteAt;
        const nextMarker = nextDone ? 'X' : ' ';
        if (!tid) return false;
        const taskForRetention = taskLike || globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        const retentionPatch = typeof __tmProtectMarkdownMutationTaskFields === 'function'
            ? __tmProtectMarkdownMutationTaskFields(tid, taskForRetention, { source: 'native-doc-checkbox-sync' })
            : {};
        const applyMarkerState = (target) => {
            if (!(target && typeof target === 'object')) return;
            target.done = nextDone;
            target.taskMarker = nextMarker;
            target.task_marker = nextMarker;
            try { target.markdown = __tmBuildTaskMarkdownWithMarker(target, nextMarker); } catch (e) {}
        };
        try {
            const liveTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
            if (liveTask && typeof liveTask === 'object') {
                applyMarkerState(liveTask);
                if (nextStatus) {
                    liveTask.customStatus = nextStatus;
                    liveTask.custom_status = nextStatus;
                }
                if (shouldSyncTaskCompleteAt) {
                    liveTask.taskCompleteAt = nextTaskCompleteAt;
                    liveTask.task_complete_at = nextTaskCompleteAt;
                }
            }
        } catch (e) {}
        try {
            const pendingTask = globalThis.__tmRuntimeState?.getPendingTaskById?.(tid) || state.pendingInsertedTasks?.[tid];
            if (pendingTask && typeof pendingTask === 'object') {
                applyMarkerState(pendingTask);
                if (nextStatus) {
                    pendingTask.customStatus = nextStatus;
                    pendingTask.custom_status = nextStatus;
                }
                if (shouldSyncTaskCompleteAt) {
                    pendingTask.taskCompleteAt = nextTaskCompleteAt;
                    pendingTask.task_complete_at = nextTaskCompleteAt;
                }
            }
        } catch (e) {}
        try {
            const cachedTask = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
            const content = String(
                taskLike?.content
                || cachedTask?.content
                || ''
            ).trim();
            const metaPatch = {
                ...((retentionPatch && typeof retentionPatch === 'object') ? retentionPatch : {}),
                done: nextDone,
                content,
            };
            metaPatch.taskMarker = nextMarker;
            metaPatch.markdown = String((globalThis.__tmTaskBoundary?.getTask?.(tid))?.markdown || '').trim();
            if (nextStatus) metaPatch.customStatus = nextStatus;
            if (shouldSyncTaskCompleteAt) metaPatch.taskCompleteAt = nextTaskCompleteAt;
            MetaStore.set(tid, metaPatch);
            try {
                __tmScheduleTaskSnapshotAfterLocalPatch?.(tid, metaPatch, {
                    source: 'native-doc-checkbox-sync',
                });
            } catch (e) {}
        } catch (e) {}
        return true;
    }

    function __tmApplyNativeDocCheckboxTaskStorePatch(taskId, patch, taskLike = null, source = 'native-doc-checkbox-sync') {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object' && !Array.isArray(patch)) ? patch : {};
        if (!tid || !Object.keys(nextPatch).length) return false;
        const task = taskLike || globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        const docId = String(task?.root_id || task?.docId || '').trim();
        try {
            globalThis.__tmTaskStore?.applyMutation?.({
                type: 'taskPatch',
                phase: 'local',
                taskId: tid,
                docId,
                source: String(source || 'native-doc-checkbox-sync').trim() || 'native-doc-checkbox-sync',
                patch: { ...nextPatch },
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    function __tmApplyNativeDocCheckboxDomProjection(blockId, done, source = 'native-doc-checkbox-dom') {
        const rawId = String(blockId || '').trim();
        if (!rawId || typeof done !== 'boolean') return false;
        const task = globalThis.__tmTaskBoundary?.getTask?.(rawId, { includePending: false, preferPending: false }) || null;
        const tid = String(task?.id || rawId).trim();
        if (!task || !tid) return false;
        const marker = done ? 'X' : ' ';
        const patch = {
            done: !!done,
            taskMarker: marker,
            task_marker: marker,
            markdown: __tmBuildTaskMarkdownWithMarker(task, marker),
        };
        try { __tmMarkLocalTaskPatchWatermark?.(tid, patch, { source }); } catch (e) {}
        return __tmApplyNativeDocCheckboxTaskStorePatch(tid, patch, task, source);
    }

    function __tmScheduleNativeDocCheckboxDetailRefresh(taskId, taskLike = null, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const source = String(opts.source || 'native-doc-checkbox-sync').trim() || 'native-doc-checkbox-sync';
        const collectVisibleTargets = () => {
            try {
                const targets = typeof __tmCollectVisibleTaskDetailTargetIds === 'function'
                    ? __tmCollectVisibleTaskDetailTargetIds()
                    : [];
                return (Array.isArray(targets) ? targets : [])
                    .map((targetId) => String(targetId || '').trim())
                    .filter(Boolean);
            } catch (e) {
                return [];
            }
        };
        const isSameDetailTask = (left, right) => {
            const a = String(left || '').trim();
            const b = String(right || '').trim();
            if (!a || !b) return false;
            try {
                if (typeof __tmAreTaskDetailIdsEquivalent === 'function') {
                    return !!__tmAreTaskDetailIdsEquivalent(a, b);
                }
            } catch (e) {}
            return a === b;
        };
        const isVisibleTarget = (targetId, targets) => {
            const rawTargetId = String(targetId || '').trim();
            if (!rawTargetId || !Array.isArray(targets) || !targets.length) return false;
            return targets.some((id) => isSameDetailTask(id, rawTargetId));
        };
        const visibleTargets = collectVisibleTargets();
        if (!visibleTargets.length) return false;
        const refreshOne = (targetId, reason = '') => {
            const targetTid = String(targetId || '').trim();
            if (!targetTid || typeof __tmRefreshVisibleTaskDetailForTask !== 'function') return false;
            try {
                return !!__tmRefreshVisibleTaskDetailForTask(targetTid, {
                    forceRebuild: true,
                    source: reason ? `${source}:${reason}` : source,
                });
            } catch (e) {
                return false;
            }
        };
        const knownParentId = String(taskLike?.parentTaskId || taskLike?.parent_task_id || '').trim();
        let touchedVisibleDetail = false;
        if (isVisibleTarget(tid, visibleTargets)) {
            touchedVisibleDetail = !!refreshOne(tid, 'task') || touchedVisibleDetail;
        }
        if (knownParentId && knownParentId !== tid && isVisibleTarget(knownParentId, visibleTargets)) {
            touchedVisibleDetail = !!refreshOne(knownParentId, 'parent') || touchedVisibleDetail;
        }
        if (!touchedVisibleDetail) return false;
        const run = async () => {
            let latestTask = null;
            try {
                if (typeof globalThis.__tmRefreshTaskDocForFreshDetail === 'function') {
                    latestTask = await globalThis.__tmRefreshTaskDocForFreshDetail(tid, taskLike, {
                        source: `${source}:detail-refresh`,
                        forceFresh: opts.forceFresh !== false,
                    });
                }
            } catch (e) {
                latestTask = null;
            }
            const parentId = String(
                latestTask?.parentTaskId
                || latestTask?.parent_task_id
                || taskLike?.parentTaskId
                || taskLike?.parent_task_id
                || ''
            ).trim();
            if (parentId && parentId !== tid && isVisibleTarget(parentId, visibleTargets)) refreshOne(parentId, 'parent-fresh');
            try {
                visibleTargets.forEach((targetId) => {
                    if (isSameDetailTask(targetId, tid) || (parentId && isSameDetailTask(targetId, parentId))) {
                        refreshOne(targetId, 'visible-target');
                    }
                });
            } catch (e) {}
        };
        try { Promise.resolve().then(run).catch(() => null); } catch (e) {}
        return true;
    }

    async function __tmSyncNativeDocCheckboxLinkedStatus(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return false;
        const syncVersion = __tmBumpNativeDocCheckboxReconcileVersion(rawId);
        try {
            await __tmFlushSqlTransactionsSafe('native-doc-checkbox-status-sync');
        } catch (e) {}

        const domDone = __tmReadNativeDocTaskDoneFromDom(rawId);
        if (domDone === null) return false;
        if (__tmWasNativeDocCheckboxRecentlySynced(rawId, !!domDone)) {
            return true;
        }
        __tmPushStatusDebug('checkbox-sync:start', {
            blockId: rawId,
            domDone: !!domDone,
            syncVersion,
        }, [rawId], { force: true });

        let taskId = '';
        try { taskId = await __tmResolveTaskIdFromAnyBlockId(rawId); } catch (e) { taskId = ''; }
        const tid = String(taskId || rawId || '').trim();
        if (!tid) return false;
        const previousState = __tmConsumeNativeDocCheckboxPreviousState([rawId, tid]);
        const insertedSync = __tmConsumeNativeDocCheckboxInsertedBlock(rawId) || __tmConsumeNativeDocCheckboxInsertedBlock(tid);

        let task = null;
        try {
            const liveTask = globalThis.__tmTaskBoundary?.getTask?.(tid, { includePending: false, preferPending: false });
            task = liveTask ? { ...liveTask } : null;
        } catch (e) { task = null; }
        if (!task || typeof task !== 'object') {
            try { task = await API.getTaskById(tid); } catch (e) { task = null; }
        }
        if (!task || typeof task !== 'object') {
            try { task = await __tmBuildTaskLikeFromBlockId(tid); } catch (e) { task = null; }
        }
        if (!task || typeof task !== 'object') return false;
        try { normalizeTaskFields(task, String(task.doc_name || task.docName || '').trim()); } catch (e) {}
        let checkboxAttrTargetId = '';
        try { checkboxAttrTargetId = __tmResolveNativeDocCheckboxAttrHostIdFromDom(rawId, tid); } catch (e) { checkboxAttrTargetId = ''; }
        if (!checkboxAttrTargetId) {
            try { checkboxAttrTargetId = await __tmResolveTaskAttrHostIdFromAnyBlockId(rawId); } catch (e) { checkboxAttrTargetId = ''; }
        }
        if (!checkboxAttrTargetId) checkboxAttrTargetId = String(__tmGetTaskAttrHostId(task) || '').trim();
        if (__tmWasNativeDocCheckboxRecentlySynced(tid, !!domDone)
            || __tmWasNativeDocCheckboxRecentlySynced(checkboxAttrTargetId, !!domDone)) {
            __tmMarkNativeDocCheckboxSyncedState([rawId, tid, checkboxAttrTargetId], !!domDone);
            return true;
        }
        __tmMarkNativeDocCheckboxSyncedState([rawId, tid, checkboxAttrTargetId], !!domDone);
        try { __tmMarkLocalDoneTxSuppressionForTask(task, [rawId, tid], 1800); } catch (e) {}
        __tmPushStatusDebug('checkbox-sync:task-resolved', {
            blockId: rawId,
            taskId: tid,
            attrHostId: checkboxAttrTargetId || __tmGetTaskAttrHostId(task),
            checkboxAttrTargetId,
            currentStatus: String(task.customStatus || '').trim(),
            currentDone: !!task.done,
            domDone: !!domDone,
            syncVersion,
            insertedSync,
        }, [rawId, tid, __tmGetTaskAttrHostId(task)], { force: true });

        const statusOptions = Array.isArray(SettingsStore?.data?.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        const expectedStatus = String(__tmResolveCheckboxLinkedStatusId(!!domDone, statusOptions) || '').trim();
        const currentStatus = String(task.customStatus || '').trim();
        const currentTaskCompleteAt = String(task.taskCompleteAt || task.task_complete_at || '').trim();
        const hasPreviousState = !!(previousState && typeof previousState.previousDone === 'boolean');
        const previousStatus = String(previousState?.status || '').trim();
        const previousTaskCompleteAt = String(previousState?.taskCompleteAt || '').trim();
        const userInitiatedCheckboxChange = previousState?.userInitiated === true;
        const taskDoneBefore = hasPreviousState ? !!previousState.previousDone : !!task.done;
        const currentStatusDoneBefore = currentStatus ? __tmDoesStatusIdResolveToDone(currentStatus, statusOptions) : false;
        const previousStatusDoneBefore = previousStatus ? __tmDoesStatusIdResolveToDone(previousStatus, statusOptions) : false;
        const statusDoneBefore = hasPreviousState ? false : currentStatusDoneBefore;
        const effectiveTaskDoneBefore = taskDoneBefore || statusDoneBefore;
        const persistedAttrsBefore = await __tmReadDocCheckboxBlockAttrs(checkboxAttrTargetId || rawId || tid);
        const persistedStatusBefore = String(persistedAttrsBefore?.status || '').trim();
        const persistedTaskCompleteAtBefore = String(persistedAttrsBefore?.taskCompleteAt || '').trim();
        const recentStructuralEmptyStatus = !domDone
            && !hasPreviousState
            && !currentStatus
            && !persistedStatusBefore
            && !!expectedStatus
            && __tmHasRecentNativeDocCheckboxStructuralChange([rawId, tid, checkboxAttrTargetId]);
        if (recentStructuralEmptyStatus) {
            __tmPushStatusDebug('checkbox-sync:skip-structural-empty-status', {
                blockId: rawId,
                taskId: tid,
                attrTargetId: checkboxAttrTargetId,
                expectedStatus,
                insertedSync,
            }, [rawId, tid, checkboxAttrTargetId], { force: true });
            try { globalThis.__taskHorizonQuickbarScheduleAttrHostMigration?.('native-checkbox-structural-empty-status'); } catch (e) {}
            try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
            __tmMarkNativeDocCheckboxSyncedState([rawId, tid, checkboxAttrTargetId], !!domDone);
            return true;
        }
        const persistedStatusDoneBefore = persistedStatusBefore ? __tmDoesStatusIdResolveToDone(persistedStatusBefore, statusOptions) : false;
        const persistedDoneBefore = hasPreviousState
            ? false
            : (persistedStatusBefore ? persistedStatusDoneBefore : (!!domDone && !!persistedTaskCompleteAtBefore));
        const wasDoneBefore = effectiveTaskDoneBefore || persistedDoneBefore;
        const shouldDispatchTaskReward = !!SettingsStore?.data?.enablePointsRewardIntegration
            && userInitiatedCheckboxChange
            && !insertedSync
            && !wasDoneBefore
            && !!domDone
            && !__tmUndoState?.applying;
        const taskRewardPriorityScore = shouldDispatchTaskReward
            ? Math.max(0, Math.round(Number(__tmEnsureTaskPriorityScore(task, { force: true })) || 0))
            : 0;
        const shouldApplyExpectedStatus = __tmShouldApplyUndoneStatusFallback(task, expectedStatus, currentStatus, persistedStatusBefore, statusOptions, !!domDone);
        let targetStatus = String(shouldApplyExpectedStatus ? expectedStatus : (persistedStatusBefore || currentStatus || '')).trim();
        const targetStatusMatchesDomDone = targetStatus ? (__tmDoesStatusIdResolveToDone(targetStatus, statusOptions) === !!domDone) : false;
        if (expectedStatus && (!targetStatus || !targetStatusMatchesDomDone)) {
            targetStatus = expectedStatus;
        }
        __tmPushStatusDebug('checkbox-sync:decision', {
            blockId: rawId,
            taskId: tid,
            domDone: !!domDone,
            expectedStatus,
            currentStatus,
            persistedStatusBefore,
            shouldApplyExpectedStatus,
            targetStatusMatchesDomDone,
            targetStatus,
            taskDoneBefore,
            currentStatusDoneBefore,
            previousStatusDoneBefore,
            persistedStatusDoneBefore,
            persistedDoneBefore,
            wasDoneBefore,
            insertedSync,
            previousState: previousState ? {
                previousDone: previousState.previousDone === true,
                status: previousStatus,
                taskCompleteAt: previousTaskCompleteAt,
                source: String(previousState.source || '').trim(),
                userInitiated: previousState.userInitiated === true,
            } : null,
            userInitiatedCheckboxChange,
            currentTaskCompleteAt,
            persistedTaskCompleteAtBefore,
        }, [rawId, tid, __tmGetTaskAttrHostId(task)], { force: true });
        const shouldPersistStatus = !!targetStatus && persistedStatusBefore !== targetStatus;
        const shouldSyncLocalStatus = !!targetStatus && currentStatus !== targetStatus;
        const statusPatch = shouldPersistStatus ? { customStatus: targetStatus } : (shouldSyncLocalStatus ? { customStatus: targetStatus } : null);
        const shouldClearTaskCompleteAt = !domDone && !!(persistedTaskCompleteAtBefore || currentTaskCompleteAt || previousTaskCompleteAt);
        const completeAtPatch = (!!domDone && !wasDoneBefore)
            ? __tmBuildTaskCompleteAtPatch()
            : (shouldClearTaskCompleteAt ? { taskCompleteAt: '' } : null);
        const hasCompleteAtPatch = !!(completeAtPatch && typeof completeAtPatch === 'object'
            && Object.prototype.hasOwnProperty.call(completeAtPatch, 'taskCompleteAt'));
        const attrPatch = {
            ...((statusPatch && typeof statusPatch === 'object') ? statusPatch : {}),
            ...((completeAtPatch && typeof completeAtPatch === 'object') ? completeAtPatch : {}),
        };
        const resolvedTaskCompleteAt = String(
            hasCompleteAtPatch
                ? completeAtPatch.taskCompleteAt
                : (persistedTaskCompleteAtBefore || currentTaskCompleteAt || '')
        ).trim();
        const buildViewPatch = (statusValue, taskCompleteAtValue, options = {}) => {
            const viewOpts = (options && typeof options === 'object') ? options : {};
            const shouldIncludeTaskCompleteAt = viewOpts.syncTaskCompleteAt === true || !!taskCompleteAtValue;
            return {
                done: !!domDone,
                ...(statusValue ? { customStatus: statusValue } : {}),
                ...(shouldIncludeTaskCompleteAt ? { taskCompleteAt: String(taskCompleteAtValue || '').trim() } : {}),
            };
        };
        if (Object.keys(attrPatch).length === 0) {
            const resolvedStatus = String(targetStatus || expectedStatus || persistedStatusBefore || currentStatus || '').trim();
            const viewPatch = buildViewPatch(resolvedStatus, resolvedTaskCompleteAt);
            __tmApplyNativeDocCheckboxLocalState(tid, !!domDone, resolvedStatus, task, resolvedTaskCompleteAt);
            try {
                const docId = String(task.root_id || task.docId || '').trim();
                if (docId) __tmInvalidateTasksQueryCacheByDocId(docId);
            } catch (e) {}
            try {
                __tmApplyNativeDocCheckboxTaskStorePatch(tid, viewPatch, task);
            } catch (e) {}
            try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
            try { globalThis.__taskHorizonQuickbarRefresh?.(); } catch (e) {}
            if (domDone !== wasDoneBefore) {
                try {
                    void globalThis.__tmSyncParentDoneStateFromSubtasks?.(tid, {
                        done: domDone,
                        source: 'native-doc-checkbox-sync',
                    }).catch(() => null);
                } catch (e) {}
            }
            if (domDone) {
                try {
                    await __tmSettleTomatoAfterTaskDone(tid, {
                        blockId: rawId,
                        attrHostId: checkboxAttrTargetId || __tmGetTaskAttrHostId(task),
                        task,
                        source: 'native-doc-checkbox-sync',
                    });
                } catch (e) {}
            }
            try { __tmScheduleNativeDocCheckboxDetailRefresh(tid, task, { source: 'native-doc-checkbox-sync' }); } catch (e) {}
            if (shouldDispatchTaskReward) {
                try {
                    __tmDispatchTaskCompletedForReward(task, {
                        taskId: tid,
                        attrHostId: checkboxAttrTargetId || __tmGetTaskAttrHostId(task) || rawId || tid,
                        priorityScore: taskRewardPriorityScore,
                        completedAt: resolvedTaskCompleteAt || __tmNowInChinaTimezoneIso(),
                        source: 'native-doc-checkbox-sync',
                        previousDone: false,
                        nextDone: true,
                        userInitiated: userInitiatedCheckboxChange === true,
                    });
                } catch (e) {}
            }
            if (domDone) {
                try {
                    __tmScheduleRecurringTaskAdvanceAfterCompletion(tid, {
                        source: 'native-doc-checkbox-sync',
                        completedAt: resolvedTaskCompleteAt || __tmNowInChinaTimezoneIso(),
                    });
                } catch (e) {}
            } else {
                try { __tmClearRecurringTaskAdvanceTimer(tid); } catch (e) {}
            }
            if (userInitiatedCheckboxChange && wasDoneBefore !== !!domDone) {
                try {
                    globalThis.__tmTaskLifecycle?.notifyCompletion?.(tid, !!domDone, {
                        task,
                        previousDone: wasDoneBefore,
                        source: 'native-doc-checkbox-sync',
                    });
                } catch (e) {}
            }
            __tmPushStatusDebug('checkbox-sync:end-local-only', {
                blockId: rawId,
                taskId: tid,
                viewPatch,
                resolvedStatus,
                resolvedTaskCompleteAt,
            }, [rawId, tid, __tmGetTaskAttrHostId(task)], { force: true });
            __tmMarkNativeDocCheckboxSyncedState([rawId, tid, checkboxAttrTargetId], !!domDone);
            return true;
        }

        let persistedStatus = persistedStatusBefore;
        let persistedTaskCompleteAt = persistedTaskCompleteAtBefore;
        let didQueueAttrPatch = false;
        if (shouldPersistStatus || !!(completeAtPatch && Object.keys(completeAtPatch).length > 0)) {
            const mirroredStatus = String(attrPatch.customStatus || '').trim();
            if (mirroredStatus) __tmMirrorNativeDocTaskStatusAttr([rawId, tid, checkboxAttrTargetId], mirroredStatus);
            const patchTask = globalThis.__tmRequireTaskMutation?.('patchTask');
            if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
            try {
                const schedulePersistReconcile = () => {
                    try {
                        __tmScheduleNativeDocCheckboxStatusReconcile(rawId, tid, attrPatch, !!domDone, syncVersion, {
                            attrTargetId: checkboxAttrTargetId,
                        });
                    } catch (e) {}
                };
                const handlePersistError = (error) => {
                    try { globalThis.__tmReportTaskMutationFailure?.(error, { action: '同步文档任务状态' }); } catch (e) {}
                    schedulePersistReconcile();
                };
                const handlePersistResult = (result) => {
                    if (result === false) schedulePersistReconcile();
                };
                const request = patchTask(tid, attrPatch, {
                    background: true,
                    wait: false,
                    skipFlush: true,
                    skipInteractionGate: true,
                    source: 'native-doc-checkbox-sync',
                    reason: 'native-doc-checkbox-sync',
                    label: '文档任务状态',
                    saveMetaNow: false,
                    attrTargetId: checkboxAttrTargetId,
                    mirrorTaskAttrs: false,
                    skipNoopCheck: true,
                    onPending: (promise) => {
                        try { Promise.resolve(promise).catch(handlePersistError); } catch (e) {}
                    },
                });
                didQueueAttrPatch = true;
                try { globalThis.__taskHorizonQuickbarScheduleAttrHostMigration?.('native-checkbox'); } catch (e) {}
                try { Promise.resolve(request).then(handlePersistResult, handlePersistError); } catch (e) {}
            } catch (error) {
                try { globalThis.__tmReportTaskMutationFailure?.(error, { action: '同步文档任务状态' }); } catch (e) {}
            }
            if (targetStatus) persistedStatus = targetStatus;
            if (completeAtPatch && Object.keys(completeAtPatch).length > 0) {
                persistedTaskCompleteAt = hasCompleteAtPatch
                    ? String(completeAtPatch.taskCompleteAt || '').trim()
                    : String(persistedTaskCompleteAt || '').trim();
            }
        }
        const finalTaskCompleteAt = String(
            hasCompleteAtPatch
                ? completeAtPatch.taskCompleteAt
                : (persistedTaskCompleteAt || resolvedTaskCompleteAt || '')
        ).trim();
        try {
            __tmApplyAttrPatchLocally(tid, attrPatch, {
                render: false,
                source: 'native-doc-checkbox-sync',
            });
            if (statusPatch) __tmMirrorDocCheckboxStatusPatch(tid, statusPatch);
        } catch (e) {}
        __tmApplyNativeDocCheckboxLocalState(tid, !!domDone, targetStatus, task, finalTaskCompleteAt, {
            syncTaskCompleteAt: hasCompleteAtPatch,
        });
        try {
            const docId = String(task.root_id || task.docId || '').trim();
            if (docId) __tmInvalidateTasksQueryCacheByDocId(docId);
        } catch (e) {}
        try {
            const viewPatch = buildViewPatch(targetStatus, finalTaskCompleteAt, {
                syncTaskCompleteAt: hasCompleteAtPatch,
            });
            __tmApplyNativeDocCheckboxTaskStorePatch(tid, viewPatch, task);
        } catch (e) {}
        try {
            __tmDispatchTaskAttrPatchUpdated(rawId, attrPatch, {
                resolvedTaskId: tid,
                attrHostId: checkboxAttrTargetId || __tmGetTaskAttrHostId(task) || rawId || tid,
                source: 'native-doc-checkbox-sync',
            });
        } catch (e) {}
        try { globalThis.__taskHorizonQuickbarRefresh?.(); } catch (e) {}
        if (domDone !== wasDoneBefore) {
            try {
                void globalThis.__tmSyncParentDoneStateFromSubtasks?.(tid, {
                    done: domDone,
                    source: 'native-doc-checkbox-sync',
                }).catch(() => null);
            } catch (e) {}
        }
        if (domDone) {
            try {
                await __tmSettleTomatoAfterTaskDone(tid, {
                    blockId: rawId,
                    attrHostId: checkboxAttrTargetId || __tmGetTaskAttrHostId(task),
                    task,
                    source: 'native-doc-checkbox-sync',
                });
            } catch (e) {}
        }
        try { __tmScheduleNativeDocCheckboxDetailRefresh(tid, task, { source: 'native-doc-checkbox-sync' }); } catch (e) {}
        if (shouldDispatchTaskReward) {
            try {
                __tmDispatchTaskCompletedForReward(task, {
                    taskId: tid,
                    attrHostId: checkboxAttrTargetId || __tmGetTaskAttrHostId(task) || rawId || tid,
                    priorityScore: taskRewardPriorityScore,
                    completedAt: finalTaskCompleteAt || __tmNowInChinaTimezoneIso(),
                    source: 'native-doc-checkbox-sync',
                    previousDone: false,
                    nextDone: true,
                    userInitiated: userInitiatedCheckboxChange === true,
                });
            } catch (e) {}
        }
        if (domDone) {
            try {
                __tmScheduleRecurringTaskAdvanceAfterCompletion(tid, {
                    source: 'native-doc-checkbox-sync',
                    completedAt: finalTaskCompleteAt || __tmNowInChinaTimezoneIso(),
                });
            } catch (e) {}
        } else {
            try { __tmClearRecurringTaskAdvanceTimer(tid); } catch (e) {}
        }
        if (userInitiatedCheckboxChange && wasDoneBefore !== !!domDone) {
            try {
                globalThis.__tmTaskLifecycle?.notifyCompletion?.(tid, !!domDone, {
                    task,
                    previousDone: wasDoneBefore,
                    source: 'native-doc-checkbox-sync',
                });
            } catch (e) {}
        }
        __tmPushStatusDebug('checkbox-sync:end', {
            blockId: rawId,
            taskId: tid,
            attrTargetId: checkboxAttrTargetId,
            attrPatch,
            persistedStatus,
            persistedTaskCompleteAt,
            finalTaskCompleteAt,
            targetStatus,
        }, [rawId, tid, __tmGetTaskAttrHostId(task)], { force: true });
        if (!didQueueAttrPatch) {
            __tmScheduleNativeDocCheckboxStatusReconcile(rawId, tid, attrPatch, !!domDone, syncVersion, {
                attrTargetId: checkboxAttrTargetId,
            });
        }
        __tmMarkNativeDocCheckboxSyncedState([rawId, tid, checkboxAttrTargetId], !!domDone);
        return true;
    }

    function __tmDrainNativeDocCheckboxSyncQueue() {
        if (__tmNativeDocCheckboxSyncQueueRunning) return;
        __tmNativeDocCheckboxSyncQueueRunning = true;
        Promise.resolve().then(async () => {
            try {
                while (__tmNativeDocCheckboxSyncQueue.length > 0) {
                    const nextBlockId = String(__tmNativeDocCheckboxSyncQueue.shift() || '').trim();
                    if (!nextBlockId) continue;
                    try {
                        __tmNativeDocCheckboxSyncQueuedIds.delete(nextBlockId);
                        __tmNativeDocCheckboxSyncRunningIds.add(nextBlockId);
                        __tmNativeDocCheckboxSyncDirtyIds.delete(nextBlockId);
                    } catch (e) {}
                    try {
                        await __tmSyncNativeDocCheckboxLinkedStatus(nextBlockId);
                    } catch (e) {}
                    finally {
                        let shouldRerun = false;
                        try {
                            shouldRerun = __tmNativeDocCheckboxSyncDirtyIds.has(nextBlockId);
                            __tmNativeDocCheckboxSyncRunningIds.delete(nextBlockId);
                            __tmNativeDocCheckboxSyncDirtyIds.delete(nextBlockId);
                            if (shouldRerun && __tmShouldSkipNativeDocCheckboxDirtyRerun(nextBlockId)) {
                                shouldRerun = false;
                            }
                        } catch (e) {
                            shouldRerun = false;
                        }
                        if (shouldRerun) {
                            __tmEnqueueNativeDocCheckboxStatusSync(nextBlockId);
                        }
                    }
                }
            } finally {
                __tmNativeDocCheckboxSyncQueueRunning = false;
                if (__tmNativeDocCheckboxSyncQueue.length > 0) {
                    __tmDrainNativeDocCheckboxSyncQueue();
                }
            }
        }).catch(() => {
            __tmNativeDocCheckboxSyncQueueRunning = false;
            try {
                __tmNativeDocCheckboxSyncQueuedIds.clear();
                __tmNativeDocCheckboxSyncRunningIds.clear();
                __tmNativeDocCheckboxSyncDirtyIds.clear();
            } catch (e) {}
        });
    }

    function __tmEnqueueNativeDocCheckboxStatusSync(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return;
        try {
            if (__tmNativeDocCheckboxSyncRunningIds.has(rawId)) {
                __tmNativeDocCheckboxSyncDirtyIds.add(rawId);
                return;
            }
            if (__tmNativeDocCheckboxSyncQueuedIds.has(rawId)) {
                return;
            }
            __tmNativeDocCheckboxSyncQueuedIds.add(rawId);
        } catch (e) {}
        __tmNativeDocCheckboxSyncQueue.push(rawId);
        __tmDrainNativeDocCheckboxSyncQueue();
    }

    function __tmScheduleNativeDocCheckboxStatusSync(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return;
        try {
            const domDone = __tmReadNativeDocTaskDoneFromDom(rawId);
            if (typeof domDone === 'boolean' && __tmWasNativeDocCheckboxRecentlySynced(rawId, domDone)) {
                return;
            }
        } catch (e) {}
        try {
            __tmNativeDocCheckboxPendingBatch.set(rawId, ++__tmNativeDocCheckboxBatchSeq);
        } catch (e) {}
        try {
            if (__tmNativeDocCheckboxBatchTimer) clearTimeout(__tmNativeDocCheckboxBatchTimer);
        } catch (e) {}
        __tmNativeDocCheckboxBatchTimer = setTimeout(() => {
            let batchIds = [];
            try {
                batchIds = Array.from(__tmNativeDocCheckboxPendingBatch.entries())
                    .sort((a, b) => Number(a[1]) - Number(b[1]))
                    .map(([id]) => String(id || '').trim())
                    .filter(Boolean);
                __tmNativeDocCheckboxPendingBatch.clear();
            } catch (e) {
                batchIds = rawId ? [rawId] : [];
            }
            __tmNativeDocCheckboxBatchTimer = null;
            batchIds.forEach((id) => __tmEnqueueNativeDocCheckboxStatusSync(id));
        }, __TM_NATIVE_DOC_CHECKBOX_SYNC_DELAY_MS);
    }

    function __tmResolveNativeDocTaskContentInput(target) {
        const eventNode = __tmResolveNativeDocEventElement(target);
        if (!(eventNode instanceof Element)) return null;
        let node = eventNode;
        const editorRoot = eventNode.matches?.('.protyle-wysiwyg')
            ? eventNode
            : eventNode.closest?.('.protyle-wysiwyg');
        if (editorRoot instanceof Element && eventNode === editorRoot) {
            try {
                const selection = document.getSelection?.();
                const rangeNode = selection?.rangeCount
                    ? selection.getRangeAt(0)?.startContainer
                    : selection?.anchorNode;
                const selectionNode = __tmResolveNativeDocEventElement(rangeNode);
                if (selectionNode instanceof Element && editorRoot.contains(selectionNode)) node = selectionNode;
            } catch (e) {}
        }
        if (!(node instanceof Element) || __tmIsNativeDocCheckboxSyncExcludedTarget(node)) return null;
        const taskItem = __tmFindNativeDocTaskListItem(node);
        if (!(taskItem instanceof Element) || !taskItem.closest?.('.protyle-wysiwyg')) return null;
        const contentBlock = __tmFindLiveDocumentTaskContentBlock(taskItem);
        if (!(contentBlock instanceof Element) || !(node === contentBlock || contentBlock.contains(node))) return null;
        const taskId = String(__tmResolveAnyBlockIdFromElement(taskItem) || '').trim();
        if (!taskId || !globalThis.__tmTaskBoundary?.getTask?.(taskId)) return null;
        return { taskId, taskItem };
    }

    function __tmScheduleNativeDocTaskContentSync(taskId, taskItem, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid || !globalThis.__tmTaskBoundary?.getTask?.(tid)) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const previous = __tmNativeDocTaskContentSyncTimers.get(tid);
        if (previous?.timer) {
            try { clearTimeout(previous.timer); } catch (e) {}
        }
        const delayMs = opts.immediate === true ? 0 : __TM_NATIVE_DOC_TASK_CONTENT_SYNC_DELAY_MS;
        const timer = setTimeout(() => {
            __tmNativeDocTaskContentSyncTimers.delete(tid);
            try {
                __tmApplyLiveDocumentTaskContentPatch(tid, {
                    taskItem: taskItem?.isConnected ? taskItem : null,
                    source: 'native-document-input',
                });
            } catch (e) {}
        }, delayMs);
        __tmNativeDocTaskContentSyncTimers.set(tid, { timer, taskItem });
        return true;
    }

    function __tmBindNativeDocTaskContentSync() {
        if (__tmNativeDocTaskContentInputHandler) {
            try { globalThis.__tmRuntimeEvents?.off?.(document, 'input', __tmNativeDocTaskContentInputHandler, true); } catch (e) {}
            try { globalThis.__tmRuntimeEvents?.off?.(document, 'compositionend', __tmNativeDocTaskContentInputHandler, true); } catch (e) {}
        }
        __tmNativeDocTaskContentInputHandler = (event) => {
            if (!event || event.isTrusted !== true || event.isComposing === true) return;
            const binding = __tmResolveNativeDocTaskContentInput(event.target);
            if (!binding) return;
            __tmScheduleNativeDocTaskContentSync(binding.taskId, binding.taskItem, {
                immediate: String(event.type || '').trim() === 'compositionend',
            });
        };
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'input', __tmNativeDocTaskContentInputHandler, true); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'compositionend', __tmNativeDocTaskContentInputHandler, true); } catch (e) {}
    }

    function __tmBindNativeDocCheckboxStatusSync() {
        try {
            if (__tmNativeDocCheckboxSyncClickHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'click', __tmNativeDocCheckboxSyncClickHandler, true);
                globalThis.__tmRuntimeEvents?.off?.(document, 'pointerup', __tmNativeDocCheckboxSyncClickHandler, true);
            }
        } catch (e) {}
        try {
            __tmNativeDocCheckboxSyncObserver?.disconnect?.();
            __tmNativeDocCheckboxSyncObserver = null;
            __tmNativeDocCheckboxObserverRoots.clear();
        } catch (e) {}
        try {
            const buses = Array.isArray(__tmNativeDocProtyleEventBuses) ? __tmNativeDocProtyleEventBuses : [];
            buses.forEach((bus) => {
                if (__tmNativeDocProtyleLoadedHandler) {
                    ['loaded-protyle-static', 'loaded-protyle-dynamic', 'switch-protyle'].forEach((name) => {
                        globalThis.__tmRuntimeEvents?.offEventBus?.(name, __tmNativeDocProtyleLoadedHandler, bus);
                    });
                }
                if (__tmNativeDocProtyleDestroyedHandler) {
                    globalThis.__tmRuntimeEvents?.offEventBus?.('destroy-protyle', __tmNativeDocProtyleDestroyedHandler, bus);
                }
            });
        } catch (e) {}
        __tmNativeDocProtyleLoadedHandler = null;
        __tmNativeDocProtyleDestroyedHandler = null;
        __tmNativeDocProtyleEventBuses = [];

        __tmNativeDocCheckboxSyncClickHandler = (event) => {
            if (!event || event.isTrusted !== true) return;
            try {
                if (typeof __tmIsTaskDetailNoteViewLocalEventTarget === 'function'
                    && __tmIsTaskDetailNoteViewLocalEventTarget(event.target)) return;
            } catch (e) {}
            const blockId = __tmResolveNativeDocTaskToggleBlockIdFromEventTarget(event.target);
            if (!blockId) return;
            __tmRememberNativeDocCheckboxPreviousState(blockId, {
                source: `native-doc-checkbox-${String(event.type || 'event').trim() || 'event'}`,
            });
            setTimeout(() => {
                const domDone = __tmReadNativeDocTaskDoneFromDom(blockId);
                if (typeof domDone === 'boolean') {
                    __tmApplyNativeDocCheckboxDomProjection(blockId, domDone, 'native-doc-checkbox-click');
                }
            }, 0);
            __tmScheduleNativeDocCheckboxStatusSync(blockId);
        };

        try { globalThis.__tmRuntimeEvents?.on?.(document, 'click', __tmNativeDocCheckboxSyncClickHandler, true); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'pointerup', __tmNativeDocCheckboxSyncClickHandler, true); } catch (e) {}
        try {
            __tmNativeDocCheckboxSyncObserver = new MutationObserver((mutations) => {
                const touched = new Set();
                const inserted = new Set();
                const structural = new Set();
                const collect = (target, options = {}) => {
                    try {
                        if (typeof __tmIsTaskDetailNoteViewLocalEventTarget === 'function'
                            && __tmIsTaskDetailNoteViewLocalEventTarget(target)) return;
                    } catch (e) {}
                    const blockId = __tmResolveNativeDocTaskBlockId(target);
                    if (blockId) {
                        if (typeof options?.previousDone === 'boolean') {
                            __tmRememberNativeDocCheckboxPreviousState(blockId, {
                                previousDone: options.previousDone,
                                source: String(options.source || 'native-doc-checkbox-mutation').trim() || 'native-doc-checkbox-mutation',
                            });
                        }
                        touched.add(blockId);
                        if (typeof options?.done === 'boolean') {
                            __tmApplyNativeDocCheckboxDomProjection(blockId, options.done, options.source);
                        }
                        if (options?.inserted === true) inserted.add(blockId);
                        if (options?.structural === true) structural.add(blockId);
                    }
                };
                const markStructural = (target) => {
                    try {
                        if (typeof __tmIsTaskDetailNoteViewLocalEventTarget === 'function'
                            && __tmIsTaskDetailNoteViewLocalEventTarget(target)) return;
                    } catch (e) {}
                    const blockId = __tmResolveNativeDocTaskBlockId(target);
                    if (blockId) structural.add(blockId);
                };
                (Array.isArray(mutations) ? mutations : []).forEach((mutation) => {
                    const target = mutation?.target;
                    const type = String(mutation?.type || '').trim();
                    if (type === 'attributes') {
                        const targetEl = target instanceof Element ? target : null;
                        const attrName = String(mutation?.attributeName || '').trim();
                        if (!targetEl) return;
                        try {
                            if (typeof __tmIsTaskDetailNoteViewLocalEventTarget === 'function'
                                && __tmIsTaskDetailNoteViewLocalEventTarget(targetEl)) return;
                        } catch (e) {}
                        if (attrName === 'class') {
                            const oldDone = /\bprotyle-task--done\b/.test(String(mutation?.oldValue || ''));
                            const newDone = !!targetEl.classList?.contains?.('protyle-task--done');
                            if (oldDone === newDone) return;
                            if (!(targetEl.matches?.('.protyle-action--task, [data-type="NodeListItem"], .li[data-node-id]') || targetEl.closest?.('.protyle-action--task, [data-type="NodeListItem"], .li[data-node-id]'))) return;
                            collect(targetEl, { previousDone: oldDone, done: newDone, source: 'native-doc-checkbox-mutation-class' });
                            return;
                        } else if (attrName === 'href' || attrName === 'xlink:href') {
                            if (!(targetEl.matches?.('use') || targetEl.closest?.('.protyle-action--task'))) return;
                            const oldHref = String(mutation?.oldValue || '').trim();
                            const oldDone = oldHref === '#iconCheck' ? true : (oldHref === '#iconUncheck' ? false : null);
                            const newDone = __tmReadNativeDocCheckboxIconDoneState(targetEl);
                            if (oldDone === null && newDone === null) return;
                            if (oldDone === newDone) return;
                            collect(targetEl, {
                                previousDone: oldDone,
                                done: newDone,
                                source: 'native-doc-checkbox-mutation-icon',
                            });
                            return;
                        } else {
                            return;
                        }
                    }
                    if (type === 'childList') {
                        try {
                            if (typeof __tmIsTaskDetailNoteViewLocalEventTarget === 'function'
                                && __tmIsTaskDetailNoteViewLocalEventTarget(target)) return;
                        } catch (e) {}
                        markStructural(target);
                        try {
                            (Array.from(mutation?.addedNodes || [])).forEach((node) => {
                                const el = node instanceof Element ? node : null;
                                try {
                                    if (typeof __tmIsTaskDetailNoteViewLocalEventTarget === 'function'
                                        && __tmIsTaskDetailNoteViewLocalEventTarget(el)) return;
                                } catch (e) {}
                                const useEl = el?.matches?.('use')
                                    ? el
                                    : (el?.querySelector?.('.protyle-action--task use') || null);
                                const iconDone = __tmReadNativeDocCheckboxIconDoneState(useEl);
                                const hasCheckboxInput = !!(el?.matches?.('input[type="checkbox"]') || el?.querySelector?.('input[type="checkbox"]'));
                                if (iconDone !== null || hasCheckboxInput) {
                                    collect(el, {
                                        inserted: __tmIsNativeDocTaskBlockInsertionElement(el),
                                        structural: true,
                                    });
                                }
                            });
                        } catch (e) {}
                        try {
                            (Array.from(mutation?.removedNodes || [])).forEach((node) => {
                                const el = node instanceof Element ? node : null;
                                if (!el) return;
                                markStructural(el);
                            });
                        } catch (e) {}
                    }
                });
                structural.forEach((blockId) => __tmMarkNativeDocCheckboxStructuralChange(blockId));
                inserted.forEach((blockId) => __tmMarkNativeDocCheckboxInsertedBlocks(blockId));
                touched.forEach((blockId) => __tmScheduleNativeDocCheckboxStatusSync(blockId));
            });

            const observerOptions = {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['class', 'href', 'xlink:href'],
                attributeOldValue: true,
            };
            const resolveRoot = (input) => {
                const candidate = input?.wysiwyg?.element
                    || input?.element
                    || input;
                if (!(candidate instanceof Element)) return null;
                if (candidate.matches?.('.protyle-wysiwyg')) return candidate;
                return candidate.querySelector?.('.protyle-wysiwyg') || null;
            };
            const observeRoot = (input) => {
                const root = resolveRoot(input);
                if (!(root instanceof Element) || __tmNativeDocCheckboxObserverRoots.has(root)) return null;
                __tmNativeDocCheckboxObserverRoots.add(root);
                __tmNativeDocCheckboxSyncObserver.observe(root, observerOptions);
                return root;
            };
            const reobserveRoots = () => {
                __tmNativeDocCheckboxSyncObserver.disconnect();
                Array.from(__tmNativeDocCheckboxObserverRoots).forEach((root) => {
                    if (root?.isConnected) __tmNativeDocCheckboxSyncObserver.observe(root, observerOptions);
                    else __tmNativeDocCheckboxObserverRoots.delete(root);
                });
            };

            document.querySelectorAll('.protyle-wysiwyg').forEach((root) => observeRoot(root));
            __tmNativeDocProtyleLoadedHandler = (event) => {
                try { observeRoot(event?.detail?.protyle || event?.protyle || null); } catch (e) {}
                try { observeBreadcrumb(); } catch (e) {}
            };
            __tmNativeDocProtyleDestroyedHandler = (event) => {
                try {
                    const root = resolveRoot(event?.detail?.protyle || event?.protyle || null);
                    if (root) __tmNativeDocCheckboxObserverRoots.delete(root);
                    reobserveRoots();
                } catch (e) {}
                try { observeBreadcrumb(); } catch (e) {}
            };
            __tmNativeDocProtyleEventBuses = Array.from(new Set(globalThis.__tmHost?.getEventBuses?.() || [globalThis.__tmHost?.getEventBus?.()].filter(Boolean)));
            __tmNativeDocProtyleEventBuses.forEach((bus) => {
                ['loaded-protyle-static', 'loaded-protyle-dynamic', 'switch-protyle'].forEach((name) => {
                    globalThis.__tmRuntimeEvents?.onEventBus?.(name, __tmNativeDocProtyleLoadedHandler, bus);
                });
                globalThis.__tmRuntimeEvents?.onEventBus?.('destroy-protyle', __tmNativeDocProtyleDestroyedHandler, bus);
            });
        } catch (e) {}
    }
