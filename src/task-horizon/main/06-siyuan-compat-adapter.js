(function () {
    const firstElement = (items) => {
        const list = Array.isArray(items) ? items : [];
        for (const item of list) {
            if (item instanceof HTMLElement) return item;
        }
        return null;
    };

    const queryOne = (root, selector) => {
        try {
            const base = root && typeof root.querySelector === 'function' ? root : document;
            const found = base.querySelector(selector);
            return found instanceof HTMLElement ? found : null;
        } catch (e) {
            return null;
        }
    };

    const isVisibleElement = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        try {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
        } catch (e) {}
        try {
            const rect = el.getBoundingClientRect?.();
            if (rect && rect.width <= 0 && rect.height <= 0 && el.offsetParent === null) return false;
        } catch (e) {}
        return true;
    };

    const findActiveWindow = () => queryOne(document, '.layout__wnd--active');

    const findActiveProtyle = (preferred = null) => {
        const candidates = [];
        if (preferred instanceof HTMLElement && preferred.isConnected) candidates.push(preferred);
        const activeWindow = findActiveWindow();
        if (activeWindow) {
            const fromWindow = queryOne(activeWindow, '.protyle');
            if (fromWindow) candidates.push(fromWindow);
        }
        try {
            candidates.push(...Array.from(document.querySelectorAll('.protyle')).filter((el) => el instanceof HTMLElement));
        } catch (e) {}
        for (const candidate of candidates) {
            if (candidate instanceof HTMLElement && candidate.isConnected && isVisibleElement(candidate)) {
                return candidate;
            }
        }
        return firstElement(candidates);
    };

    const findBreadcrumb = () => {
        const activeWindow = findActiveWindow();
        const activeProtyle = findActiveProtyle();
        return firstElement([
            queryOne(activeProtyle, '.protyle-breadcrumb'),
            queryOne(activeWindow, '.protyle-breadcrumb'),
            queryOne(document, '.protyle-breadcrumb'),
        ]);
    };

    const findCommonMenuItems = () => queryOne(document, '#commonMenu .b3-menu__items');

    const findCommonTitleMenu = (menuItems = null) => {
        const items = menuItems instanceof HTMLElement ? menuItems : findCommonMenuItems();
        if (!(items instanceof HTMLElement)) return null;
        try {
            const titleMenu = items.closest?.('[data-name="titleMenu"]');
            if (titleMenu instanceof HTMLElement) return titleMenu;
        } catch (e) {}
        return queryOne(document, '#commonMenu [data-name="titleMenu"]');
    };

    const closeGlobalMenu = () => {
        try {
            window.siyuan?.menus?.menu?.remove?.();
            return true;
        } catch (e) {
            return false;
        }
    };

    const getTaskListItemSelectors = (rawId) => [
        `[data-type="NodeListItem"][data-node-id="${rawId}"]`,
        `.li[data-node-id="${rawId}"]`,
        `[data-id="${rawId}"][data-type="NodeListItem"]`,
        `[data-id="${rawId}"].li`,
    ];

    const findTaskListItemById = (blockId, root = null) => {
        const rawId = String(blockId || '').trim();
        if (!rawId) return null;
        const searchRoots = [];
        if (root instanceof HTMLElement || root === document) searchRoots.push(root);
        const activeProtyle = findActiveProtyle();
        if (activeProtyle) {
            const wysiwyg = queryOne(activeProtyle, '.protyle-wysiwyg');
            if (wysiwyg) searchRoots.push(wysiwyg);
            searchRoots.push(activeProtyle);
        }
        searchRoots.push(document);
        for (const searchRoot of searchRoots) {
            for (const selector of getTaskListItemSelectors(rawId)) {
                const found = queryOne(searchRoot, selector);
                if (found) return found;
            }
        }
        return null;
    };

    const findTaskListItemsByIds = (blockIds, root = null) => {
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [blockIds]).map((item) => String(item || '').trim()).filter(Boolean)));
        const out = [];
        const seen = new Set();
        ids.forEach((id) => {
            const item = findTaskListItemById(id, root);
            if (!(item instanceof HTMLElement)) return;
            const itemId = String(item.getAttribute('data-node-id') || item.getAttribute('data-id') || id).trim();
            if (!itemId || seen.has(itemId)) return;
            seen.add(itemId);
            out.push(item);
        });
        return out;
    };

    const findTaskCheckboxAction = (target) => {
        try {
            const node = target instanceof Element ? target : target?.parentElement || null;
            if (!(node instanceof Element) || !node.closest) return null;
            if (node.matches?.('.protyle-action--task')) return node;
            const inNode = node.querySelector?.('.protyle-action--task');
            if (inNode instanceof HTMLElement) return inNode;
            const toggle = node.closest('.protyle-action--task');
            return toggle instanceof HTMLElement ? toggle : null;
        } catch (e) {
            return null;
        }
    };

    const resolveNativeTaskListItem = (target) => {
        try {
            const node = target instanceof Element ? target : target?.parentElement || null;
            if (!(node instanceof Element) || !node.closest) return null;
            if ((node.matches?.('[data-type="NodeListItem"]') || node.matches?.('.li[data-node-id]')) && findTaskCheckboxAction(node)) {
                return node;
            }
            const toggle = findTaskCheckboxAction(node);
            if (!(toggle instanceof HTMLElement)) return null;
            if (!toggle.closest('.protyle')) return null;
            const listItem = toggle.closest('[data-type="NodeListItem"], .li[data-node-id]');
            if (!(listItem instanceof HTMLElement)) return null;
            if (!findTaskCheckboxAction(listItem)) return null;
            return listItem;
        } catch (e) {
            return null;
        }
    };

    const findDockHost = (mountEl) => {
        if (!(mountEl instanceof HTMLElement)) return null;
        try {
            const host = mountEl.closest?.('.dock__item, .dock__panel') || mountEl.parentElement || null;
            return host instanceof HTMLElement ? host : null;
        } catch (e) {
            return null;
        }
    };

    const getCenterLayout = () => {
        try {
            return window.siyuan?.layout?.centerLayout || null;
        } catch (e) {
            return null;
        }
    };

    const switchTabLegacy = (tab) => {
        const centerLayout = getCenterLayout();
        if (!tab || typeof centerLayout?.switchTab !== 'function') return false;
        try {
            centerLayout.switchTab(tab);
            return true;
        } catch (e) {
            return false;
        }
    };

    const installSwitchTabObserver = (flag, onSwitched) => {
        const centerLayout = getCenterLayout();
        const original = centerLayout?.switchTab;
        if (typeof original !== 'function') return { ok: false, original: null };
        if (flag && original[flag]) {
            return { ok: true, original: original.__tmOriginal || null, reused: true };
        }
        const wrapped = function (tab, ...rest) {
            const result = original.apply(this, [tab, ...rest]);
            try {
                onSwitched?.(tab, ...rest);
            } catch (e) {}
            return result;
        };
        if (flag) {
            wrapped[flag] = true;
            wrapped.__tmOriginal = original;
        }
        try {
            centerLayout.switchTab = wrapped;
            return { ok: true, original };
        } catch (e) {
            return { ok: false, original: null };
        }
    };

    const restoreSwitchTabObserver = (original, flag) => {
        const centerLayout = getCenterLayout();
        if (!centerLayout || typeof original !== 'function') return false;
        try {
            if (!flag || centerLayout.switchTab?.[flag]) {
                centerLayout.switchTab = original;
                return true;
            }
        } catch (e) {}
        return false;
    };

    const scrollToBlockLegacy = (blockId) => {
        const rawId = String(blockId || '').trim();
        if (!rawId) return false;
        try {
            if (typeof window.siyuan?.block?.scrollToBlock === 'function') {
                window.siyuan.block.scrollToBlock(rawId);
                return true;
            }
        } catch (e) {}
        return false;
    };

    globalThis.__tmCompat = {
        findActiveWindow,
        findActiveProtyle,
        findBreadcrumb,
        findCommonMenuItems,
        findCommonTitleMenu,
        closeGlobalMenu,
        findTaskListItemById,
        findTaskListItemsByIds,
        findTaskCheckboxAction,
        resolveNativeTaskListItem,
        findDockHost,
        getCenterLayout,
        switchTabLegacy,
        installSwitchTabObserver,
        restoreSwitchTabObserver,
        scrollToBlockLegacy,
    };
})();
