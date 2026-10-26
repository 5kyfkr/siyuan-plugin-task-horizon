(function () {
    'use strict';

    if (typeof globalThis.__tmCreateDurationPicker === 'function') return;
    if (!globalThis.__tmDuration || typeof document === 'undefined') return;

    const duration = globalThis.__tmDuration;

    function clampInt(value, min, max, fallback = 0) {
        const n = Number(value);
        const safe = Number.isFinite(n) ? Math.round(n) : fallback;
        return Math.max(min, Math.min(max, safe));
    }

    function applyAttributes(el, attrs) {
        if (!(el instanceof Element) || !attrs || typeof attrs !== 'object') return;
        Object.entries(attrs).forEach(([key, value]) => {
            if (!key || key === 'type' || key === 'value') return;
            if (key === 'class') {
                String(value || '').split(/\s+/).filter(Boolean).forEach((name) => el.classList.add(name));
                return;
            }
            try { el.setAttribute(key, value == null ? '' : String(value)); } catch (e) {}
        });
    }

    function createDurationPicker(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const unit = duration.normalizeUnit(opts.unit || duration.getUnit());
        const providedStorage = opts.storageInput instanceof HTMLInputElement ? opts.storageInput : null;
        const storageInput = providedStorage || document.createElement('input');
        if (!providedStorage) {
            storageInput.type = 'hidden';
            storageInput.setAttribute('data-tm-duration-value', '');
        }
        applyAttributes(storageInput, opts.storageAttributes);
        if (providedStorage) storageInput.classList.add('tm-duration-picker__storage');

        const root = document.createElement('div');
        root.className = 'tm-duration-picker';
        root.setAttribute('data-tm-duration-picker', '');

        const fields = document.createElement('div');
        fields.className = 'tm-duration-picker__fields';

        const makeField = (labelText, ariaLabel, max, dataAttr) => {
            const label = document.createElement('label');
            label.className = 'tm-duration-picker__field';
            const caption = document.createElement('span');
            caption.textContent = labelText;
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'tm-duration-picker__input';
            input.min = '0';
            input.max = String(max);
            input.step = '1';
            input.inputMode = 'numeric';
            input.setAttribute('pattern', '[0-9]*');
            input.setAttribute('aria-label', ariaLabel);
            input.setAttribute(dataAttr, '');
            label.appendChild(input);
            label.appendChild(caption);
            fields.appendChild(label);
            return input;
        };

        const hourInput = makeField('小时', '预计时长（小时）', 999, 'data-tm-duration-hours');
        const minuteInput = makeField('分钟', '预计时长（分钟）', 59, 'data-tm-duration-minutes');

        const preview = document.createElement('div');
        preview.className = 'tm-duration-picker__preview';
        preview.setAttribute('aria-live', 'polite');

        fields.appendChild(preview);
        root.appendChild(fields);
        if (!providedStorage) root.appendChild(storageInput);

        const setPreview = (totalMinutes) => {
            const text = duration.formatPreview(
                Math.floor(totalMinutes / 60),
                totalMinutes % 60
            );
            preview.textContent = text ? `= ${text}` : '';
        };

        const syncFromStorage = () => {
            const parsed = duration.parse(storageInput.value, unit);
            const total = parsed == null || !Number.isFinite(parsed)
                ? 0
                : Math.max(0, Math.round(parsed));
            const parts = duration.split(total);
            hourInput.value = String(parts.hours);
            minuteInput.value = String(parts.minutes);
            setPreview(total);
        };

        let notifying = false;
        let syncingFromFields = false;
        const notify = () => {
            if (notifying) return;
            notifying = true;
            try {
                storageInput.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (e) {} finally {
                notifying = false;
            }
            if (typeof opts.onChange === 'function') {
                try { opts.onChange(storageInput.value); } catch (e) {}
            }
        };

        const applyFromFields = () => {
            const hours = clampInt(hourInput.value, 0, 999);
            const minutes = clampInt(minuteInput.value, 0, 59);
            const total = duration.join(hours, minutes);
            const next = duration.toStorage(total, unit);
            if (storageInput.value !== next) {
                storageInput.value = next;
                syncingFromFields = true;
                try { notify(); } finally { syncingFromFields = false; }
            }
            setPreview(total);
        };

        const onFieldInput = () => applyFromFields();
        const onFieldBlur = () => {
            hourInput.value = String(clampInt(hourInput.value, 0, 999));
            minuteInput.value = String(clampInt(minuteInput.value, 0, 59));
            applyFromFields();
        };
        const forwardKey = (ev) => {
            if (!ev || ev.isComposing) return;
            if (ev.key !== 'Enter' && ev.key !== 'Escape') return;
            try { ev.preventDefault(); } catch (e) {}
            try {
                const clone = new KeyboardEvent('keydown', {
                    key: ev.key,
                    bubbles: true,
                    cancelable: true,
                });
                storageInput.dispatchEvent(clone);
            } catch (e) {}
        };

        hourInput.addEventListener('input', onFieldInput);
        minuteInput.addEventListener('input', onFieldInput);
        hourInput.addEventListener('blur', onFieldBlur);
        minuteInput.addEventListener('blur', onFieldBlur);
        hourInput.addEventListener('keydown', forwardKey);
        minuteInput.addEventListener('keydown', forwardKey);

        const onStorageInput = () => {
            if (syncingFromFields) return;
            syncFromStorage();
        };
        storageInput.addEventListener('input', onStorageInput);

        const initialValue = opts.value != null ? String(opts.value) : String(storageInput.value || '');
        if (opts.value != null) storageInput.value = initialValue;
        syncFromStorage();
        const parsedInitial = duration.parse(storageInput.value, unit);
        if (parsedInitial != null && Number.isFinite(parsedInitial)) {
            const canonical = duration.toStorage(parsedInitial, unit);
            if (canonical !== storageInput.value) storageInput.value = canonical;
        }

        let destroyed = false;
        const api = {
            root,
            input: storageInput,
            unit,
            hourInput,
            minuteInput,
            preview,
            focus() {
                try {
                    hourInput.focus();
                    hourInput.select?.();
                } catch (e) {}
            },
            setValue(value) {
                storageInput.value = String(value == null ? '' : value).trim();
                syncFromStorage();
            },
            getValue() {
                return String(storageInput.value || '').trim();
            },
            sync: syncFromStorage,
            destroy() {
                if (destroyed) return;
                destroyed = true;
                storageInput.removeEventListener('input', onStorageInput);
                hourInput.removeEventListener('input', onFieldInput);
                minuteInput.removeEventListener('input', onFieldInput);
                hourInput.removeEventListener('blur', onFieldBlur);
                minuteInput.removeEventListener('blur', onFieldBlur);
                hourInput.removeEventListener('keydown', forwardKey);
                minuteInput.removeEventListener('keydown', forwardKey);
                if (storageInput.__tmDurationPicker === api) {
                    try { delete storageInput.__tmDurationPicker; } catch (e) { storageInput.__tmDurationPicker = null; }
                }
                if (providedStorage) storageInput.classList.remove('tm-duration-picker__storage');
                try { root.remove(); } catch (e) {}
            },
        };
        storageInput.__tmDurationPicker = api;
        return api;
    }

    globalThis.__tmCreateDurationPicker = createDurationPicker;
})();
