(function() {
    'use strict';

    const VIEWPORT_ID = 'tmBasecoatToastViewport';

    function escHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ensureToastViewport(doc) {
        const targetDoc = doc || document;
        let viewport = targetDoc.getElementById(VIEWPORT_ID);
        if (viewport) return viewport;
        viewport = targetDoc.createElement('div');
        viewport.id = VIEWPORT_ID;
        viewport.className = 'bc-toast-viewport';
        targetDoc.body.appendChild(viewport);
        return viewport;
    }

    function removeToast(el) {
        if (!(el instanceof HTMLElement)) return;
        try { el.remove(); } catch (e) {}
    }

    function toast(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const doc = opts.document || document;
        const viewport = ensureToastViewport(doc);
        const el = doc.createElement('div');
        el.className = 'bc-toast';
        el.dataset.variant = String(opts.variant || 'info').trim() || 'info';
        const title = String(opts.title || '').trim();
        const description = String(opts.description || '').trim();
        const actionLabel = String(opts.actionLabel || '').trim();
        el.innerHTML = [
            '<div class="bc-toast__content">',
            title ? `<div class="bc-toast__title">${escHtml(title)}</div>` : '',
            description ? `<div class="bc-toast__description">${escHtml(description)}</div>` : '',
            '</div>',
            actionLabel ? `<button class="bc-toast__action" type="button">${escHtml(actionLabel)}</button>` : '',
        ].join('');
        viewport.appendChild(el);
        const duration = Number.isFinite(Number(opts.duration)) ? Math.max(800, Number(opts.duration)) : 2500;
        const timer = setTimeout(() => removeToast(el), duration);
        const action = el.querySelector('.bc-toast__action');
        if (action) {
            action.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                try { clearTimeout(timer); } catch (e) {}
                action.disabled = true;
                removeToast(el);
                try { Promise.resolve(opts.onAction?.()).catch(() => null); } catch (e) {}
            });
        }
        el.addEventListener('click', () => {
            try { clearTimeout(timer); } catch (e) {}
            removeToast(el);
        });
        return el;
    }

    window.__tmBasecoat = Object.assign(window.__tmBasecoat || {}, {
        ensureToastViewport,
        toast,
        removeToast,
    });
})();
