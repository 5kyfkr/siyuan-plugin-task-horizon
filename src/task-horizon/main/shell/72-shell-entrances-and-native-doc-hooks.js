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
            if (tabType && String(model.type || '').trim() === tabType) return true;
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
                            try { await openManager({ preserveViewMode: true, skipEnsureTabOpened: true }); } catch (e2) {}
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
        return __tmIsMobileTopBarRegistrationHost()
            ? '[aria-label="任务管理器"], [aria-label="任务管理"], [title="任务管理器"], [title="任务管理"]'
            : '[aria-label="任务管理器"], [aria-label="任务管理"]';
    }

    function __tmIsManagedTopBarEntry(el) {
        if (!(el instanceof Element)) return false;
        if (__tmTopBarEl instanceof Element && el === __tmTopBarEl) return true;
        const label = String(
            __tmIsMobileTopBarRegistrationHost()
                ? (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '')
                : (el.getAttribute?.('aria-label') || '')
        ).trim();
        if (label !== '任务管理器' && label !== '任务管理') return false;
        if (el.closest?.('.layout-tab-bar, .layout-tab-bar__item, .layout-tab-container, .layout-tab-bar .item, .fn__flex-column[data-type="wnd"], .tm-modal')) return false;
        if (__tmElementContainsTaskHorizonIcon(el)) return true;
        if (el.closest?.('#toolbar, .toolbar, .toolbar__item, .topbar, .b3-menu, .b3-menu__item')) return true;
        if (el.closest?.('#toolbar, .toolbar, .toolbar__item, .topbar')) return true;
        try {
            const owner = el.closest?.('[id], [class]') || el;
            const ownerId = String(owner?.id || '').trim();
            const ownerCls = String(owner?.className?.baseVal || owner?.className || '').trim();
            return /(toolbar|topbar|menu)/i.test(`${ownerId} ${ownerCls}`);
        } catch (e) {}
        return false;
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
            return;
        }
        const isMobileTopBarHost = __tmIsMobileTopBarRegistrationHost();
        if (isMobileTopBarHost && globalThis[__TM_MOBILE_TOPBAR_REGISTERED_KEY]) {
            __tmTopBarAdded = true;
            try { __tmBindMobileTopBarDocumentCapture(); } catch (e) {}
            try {
                const exists = __tmDeduplicateTopBarEntries(true);
                if (exists) __tmBindTopBarClickCapture(exists);
            } catch (e) {}
            return;
        }
        if (__tmTopBarAdded) {
            if (isMobileTopBarHost) {
                try { __tmBindMobileTopBarDocumentCapture(); } catch (e) {}
                try {
                    const exists = __tmDeduplicateTopBarEntries(true);
                    if (exists) __tmBindTopBarClickCapture(exists);
                } catch (e) {}
                return;
            }
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
                __tmSetUseIcon(exists, 'iconTaskHorizon');
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
            if (isMobileTopBarHost) {
                try { __tmBindMobileTopBarDocumentCapture(); } catch (e) {}
            }
            try { __tmBindTopBarClickCapture(topBarEl || __tmDeduplicateTopBarEntries(isMobileTopBarHost)); } catch (e) {}
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
            if (__tmShouldShowDocTopbarButton()) addBreadcrumbButton();
            else __tmRemoveBreadcrumbButton();
        } catch (e) {}
        try {
            if (__tmShouldShowWindowTopbarIcon()) addTopBarIcon();
            else __tmRemoveTopBarIcon();
        } catch (e) {}
    }

    function __tmNodeTouchesShellEntrances(node) {
        if (!(node instanceof Element)) return false;
        if (node.closest?.('.tm-modal')) return false;
        if (node.matches?.('.protyle-breadcrumb, [aria-label="任务管理器"], [aria-label="任务管理"]')) return true;
        if (node.querySelector?.('.protyle-breadcrumb, [aria-label="任务管理器"], [aria-label="任务管理"]')) return true;
        try {
            const cls = String(node.className?.baseVal || node.className || '').trim();
            if (/(^|\b)(protyle|breadcrumb|toolbar|topbar|layout__wnd)(\b|$)/i.test(cls)) return true;
        } catch (e) {}
        return false;
    }

    function __tmMutationTouchesShellEntrances(mutation) {
        const target = mutation?.target;
        if (target instanceof Element) {
            if (target.closest?.('.tm-modal')) return false;
            if (__tmNodeTouchesShellEntrances(target)) return true;
        }
        const nodes = [
            ...(Array.isArray(mutation?.addedNodes) ? mutation.addedNodes : Array.from(mutation?.addedNodes || [])),
            ...(Array.isArray(mutation?.removedNodes) ? mutation.removedNodes : Array.from(mutation?.removedNodes || [])),
        ];
        return nodes.some((node) => __tmNodeTouchesShellEntrances(node));
    }

    function __tmScheduleShellEntrancesRefresh() {
        if (__tmShellEntrancesRefreshRaf != null) return;
        try {
            __tmShellEntrancesRefreshRaf = requestAnimationFrame(() => {
                __tmShellEntrancesRefreshRaf = null;
                __tmRefreshShellEntrances();
            });
        } catch (e) {
            __tmRefreshShellEntrances();
        }
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
        if (window.__tmTaskHorizonBreadcrumbObserver) {
            __tmRefreshShellEntrances();
            return;
        }
        // 先尝试添加一次
        __tmRefreshShellEntrances();

        // 使用 MutationObserver 监听面包屑栏变化
        if (__tmBreadcrumbObserver) {
            try { __tmBreadcrumbObserver.disconnect(); } catch (e) {}
            __tmBreadcrumbObserver = null;
        }
        const observer = new MutationObserver((mutations) => {
            const list = Array.isArray(mutations) ? mutations : [];
            const onlyTaskHorizonModalMutations = list.length > 0 && list.every((mutation) => {
                const target = mutation?.target;
                if (target instanceof Element && target.closest?.('.tm-modal')) return true;
                const nodes = [
                    ...(Array.isArray(mutation?.addedNodes) ? mutation.addedNodes : Array.from(mutation?.addedNodes || [])),
                    ...(Array.isArray(mutation?.removedNodes) ? mutation.removedNodes : Array.from(mutation?.removedNodes || [])),
                ];
                if (!nodes.length) return false;
                return nodes.every((node) => {
                    if (!(node instanceof Element)) return true;
                    if (node.matches?.('.tm-modal')) return true;
                    if (node.closest?.('.tm-modal')) return true;
                    if (node.querySelector?.('.tm-modal')) return true;
                    return false;
                });
            });
            if (onlyTaskHorizonModalMutations) return;
            if (!list.some((mutation) => __tmMutationTouchesShellEntrances(mutation))) return;
            __tmScheduleShellEntrancesRefresh();
        });

        // 监听整个文档的子节点变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        __tmBreadcrumbObserver = observer;
        try { window.__tmTaskHorizonBreadcrumbObserver = observer; } catch (e) {}

        // 额外监听顶栏图标注入（如果插件实例加载较晚）
        if (__tmShouldShowWindowTopbarIcon()) __tmTopBarTimer = setTimeout(addTopBarIcon, 1000);
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
                        await window.tmOpenAddOtherBlocksToGroupDialog?.([docId]);
                    } catch (e) {
                        hint(`❌ 添加失败: ${e.message}`, 'error');
                    }
                }
            });
            if (__tmIsAiFeatureEnabled()) {
                menu.addItem({
                    icon: 'iconTaskHorizon',
                    label: 'AI SMART 分析',
                    click: () => {
                        try { window.tmAiAnalyzeDocumentSmart?.(docId); } catch (e) {}
                    }
                });
                menu.addItem({
                    icon: 'iconTaskHorizon',
                    label: 'AI 日程排期',
                    click: () => {
                        try { window.tmAiPlanDocumentSchedule?.(docId); } catch (e) {}
                    }
                });
            }
            menu.addItem({
                icon: 'iconTaskHorizon',
                label: '语义识别截止日期',
                click: () => {
                    try { window.tmAiSemanticCompletionPreview?.(docId); } catch (e) {}
                }
            });
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
                        click: () => {
                            try { window.tmAiAnalyzeDocumentSmart?.(docId); } catch (e) {}
                        }
                    });
                    menu.addItem({
                        icon: 'iconTaskHorizon',
                        label: 'AI 日程排期',
                        click: () => {
                            try { window.tmAiPlanDocumentSchedule?.(docId); } catch (e) {}
                        }
                    });
                    menu.addItem({
                        icon: 'iconTaskHorizon',
                        label: '语义识别截止日期',
                        click: () => {
                            try { window.tmAiSemanticCompletionPreview?.(docId); } catch (e) {}
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
            if (detail?.blockElement) rawBlockElements.push(detail.blockElement);
            if (detail?.element) rawBlockElements.push(detail.element);
            try { rawBlockElements.push(...Array.from(detail?.blockElements || [])); } catch (e) {}
            __tmAddMoveBlockToDailyNoteMenuItem(menu, __tmCollectBlockIdsFromElements(rawBlockElements), {
                protyle: detail?.protyle || null
            });
            const scheduleBlockIds = __tmCollectBlockIdsFromElements(rawBlockElements);
            if (
                scheduleBlockIds.length === 1
                && globalThis.__tmCalendar
                && (typeof globalThis.__tmCalendar.openScheduleEditor === 'function' || typeof globalThis.__tmCalendar.openScheduleEditorByTaskId === 'function')
            ) {
                const scheduleBlockId = String(scheduleBlockIds[0] || '').trim();
                const scheduleBlockElement = rawBlockElements.find((item) => __tmResolveAnyBlockIdFromElement(item) === scheduleBlockId) || rawBlockElements[0] || null;
                if (scheduleBlockId) {
                    menu.addItem({
                        icon: 'iconTaskHorizon',
                        label: '编辑日程',
                        click: async () => {
                            await __tmOpenScheduleEditorForBlock(scheduleBlockId, scheduleBlockElement);
                        }
                    });
                }
            }
            const blockIds = __tmCollectOtherBlockIdsFromElements(rawBlockElements);
            if (!blockIds.length) return;
            menu.addItem({
                icon: 'iconTaskHorizon',
                label: blockIds.length > 1 ? '添加所选块到其他块页签' : '添加到其他块页签',
                click: async () => {
                    try {
                        await window.tmOpenAddOtherBlocksToGroupDialog?.(blockIds);
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
            const fallbackBlockId = String(__tmGetRecentBlockMenuContext()?.blockId || '').trim();
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

    function __tmBindNativeDocMenuEntry() {
        try {
            globalThis.__tmRuntimeEvents?.off?.(document, 'contextmenu', __tmNativeDocMenuCaptureHandler, true);
            globalThis.__tmRuntimeEvents?.off?.(document, 'mousedown', __tmNativeDocMenuCaptureHandler, true);
            globalThis.__tmRuntimeEvents?.off?.(document, 'click', __tmNativeDocMenuCaptureHandler, true);
        } catch (e) {}

        __tmNativeDocMenuCaptureHandler = (e) => {
            try { __tmRememberTitleMenuContext(e?.target); } catch (e2) {}
            try { __tmRememberBlockMenuContext(e?.target, e); } catch (e2) {}
        };
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'contextmenu', __tmNativeDocMenuCaptureHandler, true); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'mousedown', __tmNativeDocMenuCaptureHandler, true); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'click', __tmNativeDocMenuCaptureHandler, true); } catch (e) {}

        try { __tmDocMenuObserver?.disconnect?.(); } catch (e) {}
        __tmDocMenuObserver = new MutationObserver(() => {
            try {
                if (globalThis.__tmCaps?.has?.('commonMenuHook') === false) return;
                const menuItems = globalThis.__tmCompat?.findCommonMenuItems?.() || null;
                if (!menuItems) return;
                const titleMenu = globalThis.__tmCompat?.findCommonTitleMenu?.(menuItems) || null;
                if (titleMenu) {
                    if (menuItems.querySelector('.tm-doc-group-menu-item')) return;
                    const now = Date.now();
                    const isRecent = __tmLastRightClickedTitleProtyle && __tmLastRightClickedTitleProtyle.isConnected && (now - (Number(__tmLastRightClickedTitleAtMs) || 0) < 3000);
                    const targetProtyle = (isRecent ? __tmLastRightClickedTitleProtyle : null) || globalThis.__tmCompat?.findActiveProtyle?.() || __tmFindActiveProtyle?.() || null;
                    const docId = __tmGetDocIdFromProtyle(targetProtyle);
                    if (!docId) return;
                    const menuItem = __tmCreateNativeMenuItem('添加到任务管理器分组', async () => {
                        await window.tmOpenAddDocToGroupDialog?.(docId);
                    });
                    __tmInsertMenuItem(menuItems, menuItem);
                    if (__tmIsAiFeatureEnabled()) {
                        const smartItem = __tmCreateNativeMenuItem('AI SMART 分析', async () => {
                            await window.tmAiAnalyzeDocumentSmart?.(docId);
                        });
                        __tmInsertMenuItem(menuItems, smartItem);
                        const scheduleItem = __tmCreateNativeMenuItem('AI 日程排期', async () => {
                            await window.tmAiPlanDocumentSchedule?.(docId);
                        });
                        __tmInsertMenuItem(menuItems, scheduleItem);
                    }
                    const semanticItem = __tmCreateNativeMenuItem('语义识别截止日期', async () => {
                        await window.tmAiSemanticCompletionPreview?.(docId);
                    });
                    __tmInsertMenuItem(menuItems, semanticItem);
                    return;
                }
                if (menuItems.querySelector('.tm-block-schedule-menu-item')) return;
                const blockCtx = __tmGetRecentBlockMenuContext();
                if (!blockCtx?.blockId) return;
                const scheduleItem = __tmCreateNativeMenuItem('编辑日程', async () => {
                    await __tmOpenScheduleEditorForBlock(blockCtx.blockId, blockCtx.blockElement);
                }, 'tm-block-schedule-menu-item');
                __tmInsertMenuItem(menuItems, scheduleItem);
                __tmLastRightClickedBlockAtMs = 0;
            } catch (e) {}
        });
        try {
            __tmDocMenuObserver.observe(document.body, { childList: true, subtree: true });
        } catch (e) {}
    }

    const __TM_NATIVE_DOC_CHECKBOX_SYNC_DELAY_MS = 260;

    function __tmFindNativeDocTaskListItem(target) {
        try {
            return globalThis.__tmCompat?.resolveNativeTaskListItem?.(target) || null;
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
        const listItem = globalThis.__tmCompat?.findTaskListItemById?.(rawId) || null;
        return listItem instanceof Element ? __tmReadNativeDocTaskDoneFromListItem(listItem) : null;
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
        return Array.isArray(items) ? items : [];
    }

    function __tmMirrorNativeDocTaskStatusAttr(blockIds, customStatus) {
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [blockIds]).map((item) => String(item || '').trim()).filter(Boolean)));
        const nextStatus = String(customStatus || '').trim();
        if (!ids.length) return false;
        const listItems = __tmFindNativeDocTaskListItemsByIds(ids);
        if (!listItems.length) return false;
        let changed = false;
        listItems.forEach((listItem) => {
            const beforeStatus = String(listItem.getAttribute('custom-status') || '').trim();
            try {
                if (nextStatus) listItem.setAttribute('custom-status', nextStatus);
                else listItem.removeAttribute('custom-status');
            } catch (e) {}
            const afterStatus = String(listItem.getAttribute('custom-status') || '').trim();
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

    function __tmMarkNativeDocCheckboxStatusSyncIgnored(blockIds, expectedStatus = '', marker = '', ttlMs = 1200) {
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [blockIds]).map((item) => String(item || '').trim()).filter(Boolean)));
        if (!ids.length) return;
        const expected = String(expectedStatus || '').trim();
        const nextMarker = __tmNormalizeTaskStatusMarker(marker, ' ');
        const until = Date.now() + Math.max(120, Number(ttlMs) || 1200);
        try {
            ids.forEach((rawId) => {
                __tmNativeDocCheckboxSyncIgnoreMap.set(rawId, {
                    expectedStatus: expected,
                    marker: nextMarker,
                    until,
                });
            });
        } catch (e) {}
    }

    function __tmConsumeNativeDocCheckboxStatusSyncIgnore(blockId, domDone) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return null;
        try {
            const entry = __tmNativeDocCheckboxSyncIgnoreMap.get(rawId);
            if (!entry) return null;
            if ((Number(entry.until) || 0) < Date.now()) {
                __tmNativeDocCheckboxSyncIgnoreMap.delete(rawId);
                return null;
            }
            const expectedStatus = String(entry.expectedStatus || '').trim();
            const expectedMarker = __tmNormalizeTaskStatusMarker(entry.marker, ' ');
            const domMatches = !!domDone === __tmIsTaskMarkerDone(expectedMarker);
            if (!domMatches) return null;
            __tmNativeDocCheckboxSyncIgnoreMap.delete(rawId);
            return {
                expectedStatus,
                marker: expectedMarker,
            };
        } catch (e) {
            return null;
        }
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
        try {
            const resolvedAttrId = await __tmResolveTaskAttrHostIdFromAnyBlockId(rawId);
            if (resolvedAttrId) attrTargetId = resolvedAttrId;
        } catch (e) {}
        try {
            const res = await API.call('/api/attr/getBlockAttrs', { id: attrTargetId });
            if (!(res && res.code === 0 && res.data && typeof res.data === 'object')) return { status: '', taskCompleteAt: '' };
            const attrs = res.data;
            const result = {
                status: String(attrs['custom-status'] || '').trim(),
                taskCompleteAt: __tmNormalizeTaskCompleteAtValue(attrs[__TM_TASK_COMPLETE_AT_ATTR] || ''),
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

    async function __tmReconcileNativeDocCheckboxStatus(blockId, taskId, attrPatch, expectedDone, syncVersion = 0) {
        const rawId = String(blockId || '').trim();
        const tid = String(taskId || '').trim();
        const expectedStatus = String(attrPatch?.customStatus || '').trim();
        const expectedCompleteAt = __tmNormalizeTaskCompleteAtValue(attrPatch?.taskCompleteAt || '');
        const done = !!expectedDone;
        if (!rawId || !tid || (!expectedStatus && !expectedCompleteAt) || !__tmIsNativeDocCheckboxReconcileVersionCurrent(rawId, syncVersion)) return false;
        const domDone = __tmReadNativeDocTaskDoneFromDom(rawId);
        const beforeAttrs = await __tmReadDocCheckboxBlockAttrs(tid);
        const beforeStatus = String(beforeAttrs?.status || '').trim();
        const beforeCompleteAt = String(beforeAttrs?.taskCompleteAt || '').trim();
        if (!__tmIsNativeDocCheckboxReconcileVersionCurrent(rawId, syncVersion)) return false;
        const statusMatchedBefore = !expectedStatus || beforeStatus === expectedStatus;
        const completeAtMatchedBefore = !expectedCompleteAt || beforeCompleteAt === expectedCompleteAt;
        if (domDone !== done || (statusMatchedBefore && completeAtMatchedBefore)) return false;
        if (expectedStatus) __tmMirrorNativeDocTaskStatusAttr([rawId, tid], expectedStatus);
        await __tmPersistMetaAndAttrsKernel(tid, attrPatch, {
            touchMetaStore: false,
            skipFlush: false,
            saveMetaNow: false,
        });
        if (!__tmIsNativeDocCheckboxReconcileVersionCurrent(rawId, syncVersion)) return false;
        const afterAttrs = await __tmReadDocCheckboxBlockAttrs(tid);
        const afterStatus = String(afterAttrs?.status || '').trim();
        const afterCompleteAt = String(afterAttrs?.taskCompleteAt || '').trim();
        return (!expectedStatus || afterStatus === expectedStatus)
            && (!expectedCompleteAt || afterCompleteAt === expectedCompleteAt);
    }

    function __tmScheduleNativeDocCheckboxStatusReconcile(blockId, taskId, attrPatch, expectedDone, syncVersion) {
        const rawId = String(blockId || '').trim();
        const tid = String(taskId || '').trim();
        if (!rawId || !tid || !attrPatch || typeof attrPatch !== 'object') return;
        __tmClearNativeDocCheckboxReconcileTimers(rawId);
        const timers = [260, 900].map((delayMs) => setTimeout(() => {
            if (!__tmIsNativeDocCheckboxReconcileVersionCurrent(rawId, syncVersion)) return;
            __tmReconcileNativeDocCheckboxStatus(rawId, tid, attrPatch, expectedDone, syncVersion).catch(() => null);
        }, delayMs));
        __tmNativeDocCheckboxReconcileTimers.set(rawId, timers);
    }

    function __tmApplyNativeDocCheckboxLocalState(taskId, done, statusValue = '', taskLike = null, taskCompleteAtValue = '') {
        const tid = String(taskId || '').trim();
        const nextDone = !!done;
        const nextStatus = String(statusValue || '').trim();
        const nextTaskCompleteAt = __tmNormalizeTaskCompleteAtValue(taskCompleteAtValue);
        if (!tid) return false;
        try {
            const liveTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
            if (liveTask && typeof liveTask === 'object') {
                liveTask.done = nextDone;
                if (nextStatus) {
                    liveTask.customStatus = nextStatus;
                    liveTask.custom_status = nextStatus;
                }
                if (nextTaskCompleteAt) {
                    liveTask.taskCompleteAt = nextTaskCompleteAt;
                    liveTask.task_complete_at = nextTaskCompleteAt;
                }
            }
        } catch (e) {}
        try {
            const pendingTask = globalThis.__tmRuntimeState?.getPendingTaskById?.(tid) || state.pendingInsertedTasks?.[tid];
            if (pendingTask && typeof pendingTask === 'object') {
                pendingTask.done = nextDone;
                if (nextStatus) {
                    pendingTask.customStatus = nextStatus;
                    pendingTask.custom_status = nextStatus;
                }
                if (nextTaskCompleteAt) {
                    pendingTask.taskCompleteAt = nextTaskCompleteAt;
                    pendingTask.task_complete_at = nextTaskCompleteAt;
                }
            }
        } catch (e) {}
        try {
            if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
            state.doneOverrides[tid] = nextDone;
        } catch (e) {}
        try {
            const cachedTask = globalThis.__tmRuntimeState?.getTaskById?.(tid) || null;
            const content = String(
                taskLike?.content
                || cachedTask?.content
                || state.flatTasks?.[tid]?.content
                || state.pendingInsertedTasks?.[tid]?.content
                || ''
            ).trim();
            const metaPatch = { done: nextDone, content };
            if (nextStatus) metaPatch.customStatus = nextStatus;
            if (nextTaskCompleteAt) metaPatch.taskCompleteAt = nextTaskCompleteAt;
            MetaStore.set(tid, metaPatch);
        } catch (e) {}
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
        __tmPushStatusDebug('checkbox-sync:start', {
            blockId: rawId,
            domDone: !!domDone,
            syncVersion,
        }, [rawId], { force: true });

        let taskId = '';
        try { taskId = await __tmResolveTaskIdFromAnyBlockId(rawId); } catch (e) { taskId = ''; }
        const tid = String(taskId || rawId || '').trim();
        if (!tid) return false;

        let task = null;
        try {
            const liveTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
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
        try { __tmMarkLocalDoneTxSuppressionForTask(task, [rawId, tid], 1800); } catch (e) {}
        __tmPushStatusDebug('checkbox-sync:task-resolved', {
            blockId: rawId,
            taskId: tid,
            attrHostId: __tmGetTaskAttrHostId(task),
            currentStatus: String(task.customStatus || '').trim(),
            currentDone: !!task.done,
            domDone: !!domDone,
            syncVersion,
        }, [rawId, tid, __tmGetTaskAttrHostId(task)], { force: true });

        const statusOptions = Array.isArray(SettingsStore?.data?.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        const expectedStatus = String(__tmResolveCheckboxLinkedStatusId(!!domDone, statusOptions) || '').trim();
        const currentStatus = String(task.customStatus || '').trim();
        const currentTaskCompleteAt = String(task.taskCompleteAt || task.task_complete_at || '').trim();
        const taskDoneBefore = !!task.done;
        const shouldDispatchTaskReward = !!SettingsStore?.data?.enablePointsRewardIntegration && !taskDoneBefore && !!domDone && !__tmUndoState?.applying;
        const taskRewardPriorityScore = shouldDispatchTaskReward
            ? Math.max(0, Math.round(Number(__tmEnsureTaskPriorityScore(task, { force: true })) || 0))
            : 0;
        const ignoredSync = __tmConsumeNativeDocCheckboxStatusSyncIgnore(rawId, !!domDone);
        if (ignoredSync) {
            const preservedStatus = String(ignoredSync.expectedStatus || currentStatus || '').trim();
            const preservedTaskCompleteAt = String(task.taskCompleteAt || task.task_complete_at || '').trim();
            __tmPushStatusDebug('checkbox-sync:ignored', {
                blockId: rawId,
                taskId: tid,
                ignoredSync,
                preservedStatus,
                preservedTaskCompleteAt,
            }, [rawId, tid, __tmGetTaskAttrHostId(task)], { force: true });
            __tmApplyNativeDocCheckboxLocalState(tid, !!domDone, preservedStatus, task, preservedTaskCompleteAt);
            try {
                const liveTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
                if (liveTask && typeof liveTask === 'object') {
                    liveTask.customStatus = preservedStatus;
                    liveTask.custom_status = preservedStatus;
                    liveTask.taskMarker = String(ignoredSync.marker || '').trim() || liveTask.taskMarker;
                    liveTask.task_marker = liveTask.taskMarker;
                }
            } catch (e) {}
            return true;
        }
        const persistedAttrsBefore = await __tmReadDocCheckboxBlockAttrs(tid);
        const persistedStatusBefore = String(persistedAttrsBefore?.status || '').trim();
        const persistedTaskCompleteAtBefore = String(persistedAttrsBefore?.taskCompleteAt || '').trim();
        const shouldApplyExpectedStatus = __tmShouldApplyUndoneStatusFallback(task, expectedStatus, currentStatus, persistedStatusBefore, statusOptions, !!domDone);
        const targetStatus = String(shouldApplyExpectedStatus ? expectedStatus : (persistedStatusBefore || currentStatus || '')).trim();
        __tmPushStatusDebug('checkbox-sync:decision', {
            blockId: rawId,
            taskId: tid,
            domDone: !!domDone,
            expectedStatus,
            currentStatus,
            persistedStatusBefore,
            shouldApplyExpectedStatus,
            targetStatus,
            taskDoneBefore,
            currentTaskCompleteAt,
            persistedTaskCompleteAtBefore,
        }, [rawId, tid, __tmGetTaskAttrHostId(task)], { force: true });
        const shouldPersistStatus = !!targetStatus && persistedStatusBefore !== targetStatus;
        const shouldSyncLocalStatus = !!targetStatus && currentStatus !== targetStatus;
        const statusPatch = shouldPersistStatus ? { customStatus: targetStatus } : (shouldSyncLocalStatus ? { customStatus: targetStatus } : null);
        const completeAtPatch = (!!domDone && (!taskDoneBefore || !persistedTaskCompleteAtBefore)) ? __tmBuildTaskCompleteAtPatch() : null;
        const attrPatch = {
            ...((statusPatch && typeof statusPatch === 'object') ? statusPatch : {}),
            ...((completeAtPatch && typeof completeAtPatch === 'object') ? completeAtPatch : {}),
        };
        const resolvedTaskCompleteAt = String(
            (completeAtPatch && typeof completeAtPatch === 'object' ? completeAtPatch.taskCompleteAt : '')
            || persistedTaskCompleteAtBefore
            || currentTaskCompleteAt
            || ''
        ).trim();
        const buildViewPatch = (statusValue, taskCompleteAtValue) => ({
            done: !!domDone,
            ...(statusValue ? { customStatus: statusValue } : {}),
            ...(taskCompleteAtValue ? { taskCompleteAt: taskCompleteAtValue } : {}),
        });
        if (Object.keys(attrPatch).length === 0) {
            const resolvedStatus = String(targetStatus || expectedStatus || persistedStatusBefore || currentStatus || '').trim();
            const viewPatch = buildViewPatch(resolvedStatus, resolvedTaskCompleteAt);
            __tmApplyNativeDocCheckboxLocalState(tid, !!domDone, resolvedStatus, task, resolvedTaskCompleteAt);
            try {
                const docId = String(task.root_id || task.docId || '').trim();
                if (docId) __tmInvalidateTasksQueryCacheByDocId(docId);
            } catch (e) {}
            try {
                if (typeof __tmIsPluginVisibleNow === 'function' && __tmIsPluginVisibleNow()) {
                    __tmRefreshTaskFieldsAcrossViews(tid, viewPatch, {
                        withFilters: true,
                        reason: 'native-doc-checkbox-sync',
                        forceProjectionRefresh: __tmDoesPatchAffectProjection(tid, viewPatch),
                        fallback: true,
                    });
                }
            } catch (e) {}
            try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
            try { globalThis.__taskHorizonQuickbarRefresh?.(); } catch (e) {}
            if (shouldDispatchTaskReward) {
                try {
                    __tmDispatchTaskCompletedForReward(task, {
                        taskId: tid,
                        attrHostId: __tmGetTaskAttrHostId(task) || rawId || tid,
                        priorityScore: taskRewardPriorityScore,
                        completedAt: resolvedTaskCompleteAt || __tmNowInChinaTimezoneIso(),
                        source: 'native-doc-checkbox-sync',
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
            __tmPushStatusDebug('checkbox-sync:end-local-only', {
                blockId: rawId,
                taskId: tid,
                viewPatch,
                resolvedStatus,
                resolvedTaskCompleteAt,
            }, [rawId, tid, __tmGetTaskAttrHostId(task)], { force: true });
            return true;
        }

        let persistedStatus = persistedStatusBefore;
        let persistedTaskCompleteAt = persistedTaskCompleteAtBefore;
        if (shouldPersistStatus || !!(completeAtPatch && Object.keys(completeAtPatch).length > 0)) {
            const mirroredStatus = String(attrPatch.customStatus || '').trim();
            if (mirroredStatus) __tmMirrorNativeDocTaskStatusAttr([rawId, tid], mirroredStatus);
            await __tmPersistMetaAndAttrsKernel(tid, attrPatch, {
                touchMetaStore: false,
                skipFlush: false,
                saveMetaNow: false,
            });
            let persistedAttrs = await __tmReadDocCheckboxBlockAttrs(tid);
            persistedStatus = String(persistedAttrs?.status || '').trim();
            persistedTaskCompleteAt = String(persistedAttrs?.taskCompleteAt || '').trim();
            const expectedTaskCompleteAt = String(completeAtPatch?.taskCompleteAt || '').trim();
            const shouldReconcileStatus = !!targetStatus && shouldPersistStatus && persistedStatus !== targetStatus;
            const shouldReconcileTaskCompleteAt = !!expectedTaskCompleteAt && persistedTaskCompleteAt !== expectedTaskCompleteAt;
            if ((shouldReconcileStatus || shouldReconcileTaskCompleteAt) && __tmIsNativeDocCheckboxReconcileVersionCurrent(rawId, syncVersion)) {
                await __tmReconcileNativeDocCheckboxStatus(rawId, tid, attrPatch, !!domDone, syncVersion);
                persistedAttrs = await __tmReadDocCheckboxBlockAttrs(tid);
                persistedStatus = String(persistedAttrs?.status || '').trim();
                persistedTaskCompleteAt = String(persistedAttrs?.taskCompleteAt || '').trim();
            }
        }
        const finalTaskCompleteAt = String(
            (completeAtPatch && typeof completeAtPatch === 'object' ? completeAtPatch.taskCompleteAt : '')
            || persistedTaskCompleteAt
            || resolvedTaskCompleteAt
            || ''
        ).trim();
        try {
            __tmApplyAttrPatchLocally(tid, attrPatch, {
                render: false,
                withFilters: false,
            });
            if (statusPatch) __tmMirrorDocCheckboxStatusPatch(tid, statusPatch);
        } catch (e) {}
        __tmApplyNativeDocCheckboxLocalState(tid, !!domDone, targetStatus, task, finalTaskCompleteAt);
        try {
            const docId = String(task.root_id || task.docId || '').trim();
            if (docId) __tmInvalidateTasksQueryCacheByDocId(docId);
        } catch (e) {}
        try {
            if (typeof __tmIsPluginVisibleNow === 'function' && __tmIsPluginVisibleNow()) {
                const viewPatch = buildViewPatch(targetStatus, finalTaskCompleteAt);
                __tmRefreshTaskFieldsAcrossViews(tid, viewPatch, {
                    withFilters: true,
                    reason: 'native-doc-checkbox-sync',
                    forceProjectionRefresh: __tmDoesPatchAffectProjection(tid, viewPatch),
                    fallback: true,
                });
            }
        } catch (e) {}
        try {
            __tmDispatchTaskAttrPatchUpdated(rawId, attrPatch, {
                resolvedTaskId: tid,
                source: 'native-doc-checkbox-sync',
            });
        } catch (e) {}
        try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
        try { globalThis.__taskHorizonQuickbarRefresh?.(); } catch (e) {}
        if (shouldDispatchTaskReward) {
            try {
                __tmDispatchTaskCompletedForReward(task, {
                    taskId: tid,
                    attrHostId: __tmGetTaskAttrHostId(task) || rawId || tid,
                    priorityScore: taskRewardPriorityScore,
                    completedAt: finalTaskCompleteAt || __tmNowInChinaTimezoneIso(),
                    source: 'native-doc-checkbox-sync',
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
        __tmPushStatusDebug('checkbox-sync:end', {
            blockId: rawId,
            taskId: tid,
            attrPatch,
            persistedStatus,
            persistedTaskCompleteAt,
            finalTaskCompleteAt,
            targetStatus,
        }, [rawId, tid, __tmGetTaskAttrHostId(task)], { force: true });
        __tmScheduleNativeDocCheckboxStatusReconcile(rawId, tid, attrPatch, !!domDone, syncVersion);
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
                        await __tmSyncNativeDocCheckboxLinkedStatus(nextBlockId);
                    } catch (e) {}
                }
            } finally {
                __tmNativeDocCheckboxSyncQueueRunning = false;
                if (__tmNativeDocCheckboxSyncQueue.length > 0) {
                    __tmDrainNativeDocCheckboxSyncQueue();
                }
            }
        }).catch(() => {
            __tmNativeDocCheckboxSyncQueueRunning = false;
        });
    }

    function __tmEnqueueNativeDocCheckboxStatusSync(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return;
        __tmNativeDocCheckboxSyncQueue.push(rawId);
        __tmDrainNativeDocCheckboxSyncQueue();
    }

    function __tmScheduleNativeDocCheckboxStatusSync(blockId) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return;
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
        } catch (e) {}

        __tmNativeDocCheckboxSyncClickHandler = (event) => {
            if (!event || event.isTrusted !== true) return;
            const blockId = __tmResolveNativeDocTaskToggleBlockId(event.target);
            if (!blockId) return;
            __tmScheduleNativeDocCheckboxStatusSync(blockId);
        };

        try { globalThis.__tmRuntimeEvents?.on?.(document, 'click', __tmNativeDocCheckboxSyncClickHandler, true); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'pointerup', __tmNativeDocCheckboxSyncClickHandler, true); } catch (e) {}
        try {
            __tmNativeDocCheckboxSyncObserver = new MutationObserver((mutations) => {
                const touched = new Set();
                const collect = (target) => {
                    const blockId = __tmResolveNativeDocTaskBlockId(target);
                    if (blockId) touched.add(blockId);
                };
                (Array.isArray(mutations) ? mutations : []).forEach((mutation) => {
                    const target = mutation?.target;
                    const type = String(mutation?.type || '').trim();
                    if (type === 'attributes') {
                        const targetEl = target instanceof Element ? target : null;
                        const attrName = String(mutation?.attributeName || '').trim();
                        if (!targetEl) return;
                        if (attrName === 'class') {
                            const oldDone = /\bprotyle-task--done\b/.test(String(mutation?.oldValue || ''));
                            const newDone = !!targetEl.classList?.contains?.('protyle-task--done');
                            if (oldDone === newDone) return;
                            if (!(targetEl.matches?.('.protyle-action--task, [data-type="NodeListItem"], .li[data-node-id]') || targetEl.closest?.('.protyle-action--task, [data-type="NodeListItem"], .li[data-node-id]'))) return;
                        } else if (attrName === 'href' || attrName === 'xlink:href') {
                            if (!(targetEl.matches?.('use') || targetEl.closest?.('.protyle-action--task'))) return;
                            const oldHref = String(mutation?.oldValue || '').trim();
                            const oldDone = oldHref === '#iconCheck' ? true : (oldHref === '#iconUncheck' ? false : null);
                            const newDone = __tmReadNativeDocCheckboxIconDoneState(targetEl);
                            if (oldDone === null && newDone === null) return;
                            if (oldDone === newDone) return;
                        } else {
                            return;
                        }
                        collect(targetEl);
                        return;
                    }
                    if (type === 'childList') {
                        try {
                            (Array.from(mutation?.addedNodes || [])).forEach((node) => {
                                const el = node instanceof Element ? node : null;
                                const useEl = el?.matches?.('use')
                                    ? el
                                    : (el?.querySelector?.('.protyle-action--task use') || null);
                                const iconDone = __tmReadNativeDocCheckboxIconDoneState(useEl);
                                const hasCheckboxInput = !!(el?.matches?.('input[type="checkbox"]') || el?.querySelector?.('input[type="checkbox"]'));
                                if (iconDone !== null || hasCheckboxInput) {
                                    collect(el);
                                }
                            });
                        } catch (e) {}
                    }
                });
                touched.forEach((blockId) => __tmScheduleNativeDocCheckboxStatusSync(blockId));
            });
            __tmNativeDocCheckboxSyncObserver.observe(document.body, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['class', 'href', 'xlink:href'],
                attributeOldValue: true,
            });
        } catch (e) {}
    }

