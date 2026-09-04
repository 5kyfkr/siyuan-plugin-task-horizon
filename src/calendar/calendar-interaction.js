(function (global) {
    'use strict';

    function bindCalendarPointerInteractions(root, options = {}) {
        if (typeof Element === 'undefined' || !(root instanceof Element) || root.__tmCalendarPointerInteractions) return () => {};
        const cleanup = new AbortController();
        const state = { pointerId: null, target: null, started: false, moved: false, startX: 0, startY: 0, timer: 0 };
        const longPressMs = Math.max(0, Number(options.longPressMs ?? 500));
        const threshold = Math.max(2, Number(options.threshold ?? 6));
        const clear = () => {
            if (state.timer) clearTimeout(state.timer);
            state.timer = 0;
            state.pointerId = null;
            state.target = null;
            state.started = false;
            state.moved = false;
        };
        const onDown = (event) => {
            if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
            const target = event.target instanceof Element ? event.target.closest('[data-tm-proto-event], [data-tm-calendar-event]') : null;
            if (!target) return;
            clear();
            state.pointerId = event.pointerId;
            state.target = target;
            state.startX = event.clientX;
            state.startY = event.clientY;
            try { target.setPointerCapture?.(event.pointerId); } catch (e) {}
            const begin = () => {
                state.started = true;
                try { options.onStart?.({ event, target }); } catch (e) {}
            };
            state.timer = event.pointerType === 'touch' ? setTimeout(begin, longPressMs) : 0;
            if (event.pointerType === 'mouse') begin();
        };
        const onMove = (event) => {
            if (state.pointerId !== event.pointerId || !state.target) return;
            const dx = event.clientX - state.startX;
            const dy = event.clientY - state.startY;
            const distance = Math.hypot(dx, dy);
            if (!state.started && distance > threshold) { clear(); return; }
            if (!state.started) return;
            state.moved = true;
            try { options.onMove?.({ event, target: state.target, dx, dy }); } catch (e) {}
            event.preventDefault();
        };
        const onUp = (event) => {
            if (state.pointerId !== event.pointerId) return;
            if (state.started) {
                try { options.onEnd?.({ event, target: state.target, moved: state.moved }); } catch (e) {}
            }
            clear();
        };
        root.addEventListener('pointerdown', onDown, { signal: cleanup.signal });
        root.addEventListener('pointermove', onMove, { signal: cleanup.signal, passive: false });
        root.addEventListener('pointerup', onUp, { signal: cleanup.signal });
        root.addEventListener('pointercancel', onUp, { signal: cleanup.signal });
        root.__tmCalendarPointerInteractions = cleanup;
        return () => {
            clear();
            try { cleanup.abort(); } catch (e) {}
            try { delete root.__tmCalendarPointerInteractions; } catch (e) {}
        };
    }

    global.__tmCalendarInteraction = Object.freeze({ bindCalendarPointerInteractions });
})(typeof globalThis !== 'undefined' ? globalThis : window);
