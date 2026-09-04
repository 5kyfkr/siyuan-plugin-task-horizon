(function (global) {
    'use strict';

    const layout = global.__tmCalendarLayout || {};

    function createCalendarRenderer(options = {}) {
        let raf = 0;
        let pending = null;
        let destroyed = false;
        const render = typeof options.render === 'function' ? options.render : () => {};
        const commit = () => {
            raf = 0;
            if (destroyed || !pending) return;
            const next = pending;
            pending = null;
            try { render(next); } catch (error) { try { options.onError?.(error); } catch (e) {} }
        };
        return {
            invalidate(model, reason = 'change') {
                if (destroyed) return;
                pending = { ...(model || {}), reason };
                if (raf) return;
                try { raf = requestAnimationFrame(commit); } catch (e) { commit(); }
            },
            flush() { if (raf) { try { cancelAnimationFrame(raf); } catch (e) {} raf = 0; } commit(); },
            destroy() { destroyed = true; pending = null; if (raf) { try { cancelAnimationFrame(raf); } catch (e) {} raf = 0; } },
            buildViewModel(view, events, options = {}) { return layout.buildViewModel?.(view, events, options) || { view, events }; },
        };
    }

    global.__tmCalendarRenderer = Object.freeze({ createCalendarRenderer });
})(typeof globalThis !== 'undefined' ? globalThis : window);
