    const __tmCollapseMotion = (() => {
        const config = Object.freeze({
            duration: 180,
            liteDuration: 130,
            enterDuration: 120,
            easing: 'cubic-bezier(0, 0, 0.2, 1)',
            maxVisibleNodes: 32,
            maxTimelineNodes: 64,
            maxDisclosureItems: 24,
        });
        const rootStates = new WeakMap();
        const activeElements = new WeakMap();

        function __tmCollapseMotionIsElement(value) {
            return typeof Element !== 'undefined' && value instanceof Element;
        }

        function __tmCollapseMotionRoot(value) {
            if (__tmCollapseMotionIsElement(value)) return value;
            try {
                if (typeof document !== 'undefined' && document.body) return document.body;
            } catch (e) {}
            return null;
        }

        function __tmCollapseMotionState(rootInput) {
            const root = __tmCollapseMotionRoot(rootInput);
            if (!root) return null;
            let runtime = rootStates.get(root);
            if (!runtime) {
                runtime = { animations: new Set(), pendingLayout: null };
                rootStates.set(root, runtime);
            }
            return runtime;
        }

        function __tmCollapseMotionReduced() {
            try {
                return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
            } catch (e) {
                return false;
            }
        }

        function __tmCollapseMotionBusy(rootInput, options = {}) {
            const root = __tmCollapseMotionRoot(rootInput);
            if (!root) return true;
            try {
                if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return true;
                const busySelector = options.allowDuringScroll === true
                    ? '.tm-kanban-card--dragging,.tm-whiteboard-viewport--moving,.tm-whiteboard-viewport--panning'
                    : '.tm-scroll-active,.tm-kanban-card--dragging,.tm-whiteboard-viewport--moving,.tm-whiteboard-viewport--panning';
                if (root.matches?.(busySelector)) return true;
                return !!root.querySelector?.(busySelector);
            } catch (e) {
                return false;
            }
        }

        function __tmCollapseMotionCanAnimate(rootInput, options = {}) {
            if (__tmCollapseMotionReduced() || __tmCollapseMotionBusy(rootInput, options)) return false;
            try {
                return typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
            } catch (e) {
                return false;
            }
        }

        function __tmCollapseMotionCancelElement(element) {
            if (!__tmCollapseMotionIsElement(element)) return false;
            const entry = activeElements.get(element);
            if (!entry) return false;
            try { entry.animation?.cancel?.(); } catch (e) {}
            try { entry.finish?.(false); } catch (e) {}
            return true;
        }

        function __tmCollapseMotionTrack(rootInput, element, animation, options = {}) {
            const root = __tmCollapseMotionRoot(rootInput);
            const runtime = __tmCollapseMotionState(root);
            if (!root || !runtime || !__tmCollapseMotionIsElement(element) || !animation) return null;
            __tmCollapseMotionCancelElement(element);
            const previousWillChange = element.style.willChange;
            const requestedWillChange = String(options.willChange || '').trim();
            if (requestedWillChange) element.style.willChange = requestedWillChange;
            let settled = false;
            const entry = {
                animation,
                finish(completed) {
                    if (settled) return;
                    settled = true;
                    animation.onfinish = null;
                    animation.oncancel = null;
                    runtime.animations.delete(entry);
                    if (activeElements.get(element) === entry) activeElements.delete(element);
                    try {
                        if (completed) options.onFinish?.();
                        else options.onCancel?.();
                    } catch (e) {}
                    try { options.cleanup?.(); } catch (e) {}
                    if (element.style.willChange === requestedWillChange) element.style.willChange = previousWillChange;
                    if (completed) {
                        try { animation.cancel(); } catch (e) {}
                    }
                },
            };
            runtime.animations.add(entry);
            activeElements.set(element, entry);
            animation.onfinish = () => entry.finish(true);
            animation.oncancel = () => entry.finish(false);
            return entry;
        }

        function __tmCollapseMotionAnimate(rootInput, element, keyframes, options = {}) {
            const root = __tmCollapseMotionRoot(rootInput);
            if (!root || !__tmCollapseMotionIsElement(element) || !__tmCollapseMotionCanAnimate(root, options)) return null;
            try {
                const animation = element.animate(keyframes, {
                    duration: Math.max(0, Number(options.duration) || config.duration),
                    easing: String(options.easing || config.easing),
                    fill: 'both',
                });
                return __tmCollapseMotionTrack(root, element, animation, options);
            } catch (e) {
                try { options.onFinish?.(); } catch (e2) {}
                try { options.cleanup?.(); } catch (e2) {}
                return null;
            }
        }

        function __tmCollapseMotionCancel(rootInput) {
            const root = __tmCollapseMotionRoot(rootInput);
            const runtime = root ? rootStates.get(root) : null;
            if (!runtime) return false;
            runtime.pendingLayout = null;
            Array.from(runtime.animations).forEach((entry) => {
                try { entry.animation?.cancel?.(); } catch (e) {}
                try { entry.finish?.(false); } catch (e) {}
            });
            runtime.animations.clear();
            return true;
        }

        function __tmCollapseMotionKey(element, prefix) {
            if (!__tmCollapseMotionIsElement(element)) return '';
            const direct = String(
                element.getAttribute('data-id')
                || element.getAttribute('data-task-id')
                || element.getAttribute('data-group-key')
                || element.getAttribute('data-pool-section-key')
                || ''
            ).trim();
            let key = direct;
            if (!key) return '';
            const kind = element.hasAttribute('data-group-key')
                || element.hasAttribute('data-pool-section-key')
                || element.classList.contains('tm-kanban-group')
                ? 'group'
                : 'task';
            return `${prefix}:${kind}:${key}`;
        }

        function __tmCollapseMotionSurface(container, viewport, selector, prefix, limit) {
            if (!__tmCollapseMotionIsElement(container)) return null;
            return {
                container,
                viewport: __tmCollapseMotionIsElement(viewport) ? viewport : container,
                selector: String(selector || '').trim(),
                prefix: String(prefix || 'surface'),
                limit: Math.max(1, Number(limit) || config.maxVisibleNodes),
            };
        }

        function __tmCollapseMotionSurfaces(rootInput, profileInput, scopeInput = null) {
            const root = __tmCollapseMotionRoot(rootInput);
            const profile = String(profileInput || 'table').trim();
            if (!root) return [];
            const requestedScope = __tmCollapseMotionIsElement(scopeInput) ? scopeInput : root;
            const scope = requestedScope === root || root.contains?.(requestedScope) ? requestedScope : root;
            const surfaces = [];
            const push = (surface) => { if (surface) surfaces.push(surface); };
            if (profile === 'timeline') {
                const leftBody = root.querySelector?.('#tmTimelineLeftBody');
                const leftTable = root.querySelector?.('#tmTimelineLeftTable tbody');
                const ganttBody = root.querySelector?.('#tmGanttBody');
                const surfaceLimit = Math.max(1, Math.floor(config.maxTimelineNodes / 2));
                push(__tmCollapseMotionSurface(leftTable, leftBody, ':scope > tr[data-id],:scope > tr[data-group-key]', 'timeline-table', surfaceLimit));
                push(__tmCollapseMotionSurface(ganttBody, ganttBody, '.tm-gantt-row[data-id],.tm-gantt-row--group[data-group-key]', 'timeline-gantt', surfaceLimit));
                return surfaces;
            }
            if (profile === 'checklist' || profile === 'calendar-sidebar') {
                const scope = profile === 'calendar-sidebar'
                    ? root.querySelector?.('[data-tm-cal-role="task-page-list"]')
                    : root;
                const items = scope?.querySelector?.('.tm-checklist-items');
                const viewport = scope?.querySelector?.('.tm-checklist-scroll') || items;
                const limit = profile === 'checklist' ? config.maxDisclosureItems : config.maxVisibleNodes;
                push(__tmCollapseMotionSurface(items, viewport, '.tm-checklist-item[data-id],.tm-checklist-group[data-group-key]', profile, limit));
                return surfaces;
            }
            if (profile === 'kanban-column') {
                const columnBody = scope.matches?.('.tm-kanban-col-body') ? scope : scope.querySelector?.('.tm-kanban-col-body');
                const column = columnBody?.closest?.('.tm-kanban-col');
                const columnKey = String(column?.getAttribute?.('data-col-key') || column?.getAttribute?.('data-status') || 'column').trim();
                push(__tmCollapseMotionSurface(columnBody, columnBody, '.tm-kanban-card[data-id],.tm-kanban-group', `kanban-${columnKey}`, config.maxVisibleNodes));
                return surfaces;
            }
            if (profile === 'whiteboard-pool') {
                const items = root.querySelector?.('#tmWhiteboardPoolContent') || root;
                const viewport = root.querySelector?.('.tm-whiteboard-sidebar') || items;
                push(__tmCollapseMotionSurface(items, viewport, '.tm-whiteboard-pool-doc[data-pool-section-key],.tm-whiteboard-pool-item[data-task-id]', 'whiteboard-pool', config.maxVisibleNodes));
                return surfaces;
            }
            const tbody = root.querySelector?.('#tmTaskTable tbody');
            const viewport = tbody?.closest?.('.tm-body') || root.querySelector?.('.tm-body');
            push(__tmCollapseMotionSurface(tbody, viewport, ':scope > tr[data-id],:scope > tr[data-group-key]', 'table', config.maxVisibleNodes));
            return surfaces;
        }

        function __tmCollapseMotionCaptureSurface(surface) {
            const out = new Map();
            if (!surface?.selector) return out;
            let viewportRect;
            try { viewportRect = surface.viewport.getBoundingClientRect(); } catch (e) { return out; }
            const viewportHeight = Math.max(1, Number(viewportRect?.height) || Number(surface.viewport.clientHeight) || 1);
            const overscan = Math.min(240, viewportHeight * 0.35);
            const minTop = Number(viewportRect?.top || 0) - overscan;
            const maxBottom = Number(viewportRect?.bottom || minTop + viewportHeight) + overscan;
            let reachedViewport = false;
            const candidates = surface.container.querySelectorAll?.(surface.selector) || [];
            for (const element of candidates) {
                if (!__tmCollapseMotionIsElement(element)) continue;
                let rect;
                try { rect = element.getBoundingClientRect(); } catch (e) { continue; }
                if (!rect || rect.width <= 0 || rect.height <= 0) continue;
                if (rect.bottom < minTop) continue;
                if (rect.top > maxBottom) {
                    if (reachedViewport) break;
                    continue;
                }
                reachedViewport = true;
                const key = __tmCollapseMotionKey(element, surface.prefix);
                if (!key || out.has(key)) continue;
                out.set(key, { element, rect });
                if (out.size >= surface.limit) break;
            }
            return out;
        }

        function __tmCollapseMotionCapture(surfaces) {
            const snapshot = new Map();
            (Array.isArray(surfaces) ? surfaces : []).forEach((surface) => {
                __tmCollapseMotionCaptureSurface(surface).forEach((value, key) => snapshot.set(key, value));
            });
            return snapshot;
        }

        function __tmCollapseMotionBeginLayout(rootInput, options = {}) {
            const root = __tmCollapseMotionRoot(rootInput);
            const runtime = __tmCollapseMotionState(root);
            if (!root || !runtime) return false;
            __tmCollapseMotionCancel(root);
            if (!__tmCollapseMotionCanAnimate(root, options)) return false;
            const profile = String(options.profile || 'table').trim();
            const scope = __tmCollapseMotionIsElement(options.scope) ? options.scope : root;
            const surfaces = __tmCollapseMotionSurfaces(root, profile, scope);
            if (!surfaces.length) return false;
            runtime.pendingLayout = {
                first: __tmCollapseMotionCapture(surfaces),
                profile,
                scope,
                action: String(options.action || '').trim(),
                lite: options.lite === true,
                allowDuringScroll: options.allowDuringScroll === true,
            };
            return true;
        }

        function __tmCollapseMotionPlayLayout(rootInput) {
            const root = __tmCollapseMotionRoot(rootInput);
            const runtime = root ? __tmCollapseMotionState(root) : null;
            const pending = runtime?.pendingLayout || null;
            if (!root || !runtime || !pending) return false;
            runtime.pendingLayout = null;
            if (!__tmCollapseMotionCanAnimate(root, pending)) return false;
            const last = __tmCollapseMotionCapture(__tmCollapseMotionSurfaces(root, pending.profile, pending.scope));
            const duration = pending.lite ? config.liteDuration : config.duration;
            last.forEach((next, key) => {
                const previous = pending.first.get(key);
                if (!previous) {
                    __tmCollapseMotionAnimate(root, next.element, [
                        { opacity: 0 },
                        { opacity: 1 },
                    ], { duration: config.enterDuration, willChange: 'opacity' });
                    return;
                }
                const dx = Math.round(Number(previous.rect.left || 0) - Number(next.rect.left || 0));
                const dy = Math.round(Number(previous.rect.top || 0) - Number(next.rect.top || 0));
                if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
                __tmCollapseMotionAnimate(root, next.element, [
                    { transform: `translate3d(${dx}px, ${dy}px, 0)` },
                    { transform: 'translate3d(0, 0, 0)' },
                ], { duration, willChange: 'transform' });
            });
            return true;
        }

        function __tmCollapseMotionSetDisclosure(content, expanded, options = {}) {
            if (!__tmCollapseMotionIsElement(content)) return 'none';
            const nextExpanded = !!expanded;
            __tmCollapseMotionCancelElement(content);
            content.hidden = !nextExpanded;
            content.setAttribute('aria-hidden', nextExpanded ? 'false' : 'true');
            const requestedMode = String(options.forceMode || '').trim();
            const mode = requestedMode === 'layout' ? 'layout' : 'none';
            content.style.removeProperty('height');
            content.style.removeProperty('overflow');
            content.style.removeProperty('pointer-events');
            try { options.onFinish?.(); } catch (e) {}
            return mode;
        }

        function __tmCollapseMotionFadeClip(rootInput, element, options = {}) {
            const root = __tmCollapseMotionRoot(rootInput);
            if (!root || !__tmCollapseMotionIsElement(element)) return false;
            const expanded = options.expanded !== false;
            const frames = expanded
                ? [
                    { opacity: 0.68, clipPath: 'inset(0 0 14% 0)', transform: 'translate3d(0, -3px, 0)' },
                    { opacity: 1, clipPath: 'inset(0 0 0 0)', transform: 'translate3d(0, 0, 0)' },
                ]
                : [
                    { opacity: 0.78, clipPath: 'inset(0 0 6% 0)', transform: 'translate3d(0, -2px, 0)' },
                    { opacity: 1, clipPath: 'inset(0 0 0 0)', transform: 'translate3d(0, 0, 0)' },
                ];
            return !!__tmCollapseMotionAnimate(root, element, frames, {
                duration: expanded ? config.duration : config.liteDuration,
                willChange: 'transform, opacity, clip-path',
            });
        }

        function __tmCollapseMotionFade(rootInput, element, options = {}) {
            const root = __tmCollapseMotionRoot(rootInput);
            if (!root || !__tmCollapseMotionIsElement(element)) return false;
            const from = Math.max(0, Math.min(1, Number(options.from) || 0.5));
            return !!__tmCollapseMotionAnimate(root, element, [
                { opacity: from },
                { opacity: 1 },
            ], {
                duration: Math.max(1, Number(options.duration) || config.enterDuration),
                willChange: 'opacity',
            });
        }

        return Object.freeze({
            config,
            beginLayout: __tmCollapseMotionBeginLayout,
            playLayout: __tmCollapseMotionPlayLayout,
            cancel: __tmCollapseMotionCancel,
            setDisclosure: __tmCollapseMotionSetDisclosure,
            fadeClip: __tmCollapseMotionFadeClip,
            fade: __tmCollapseMotionFade,
            prefersReducedMotion: __tmCollapseMotionReduced,
        });
    })();
    try { globalThis.__tmCollapseMotionRuntime = __tmCollapseMotion; } catch (e) {}
