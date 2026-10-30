(function () {
    const APP_ID = 'siyuan-plugin-task-horizon';
    const LICENSE_STORAGE_KEY = 'task-license.json';
    const LICENSE_CODE_PREFIX = 'TH1';
    const LICENSE_PUBLIC_JWK = Object.freeze({
        kty: 'EC',
        x: 'd3_WbIwbuyWp9RxG0dKyIyCcaiF5ejbb8aCnCpLk3d8',
        y: 'Qav0xJ_N4QHou-rtPObKlCfYnuns5raX4uFnDATYFKk',
        crv: 'P-256',
    });
    const LICENSE_PLANS = Object.freeze({
        trial: { label: __tmT("task.trial"), durationDays: 30 },
        yearly: { label: __tmT("task.yearly"), durationDays: 365 },
        lifetime: { label: __tmT("task.lifetime"), durationDays: null },
    });

    let __tmLicenseRecord = null;
    let __tmLicenseLoaded = false;
    let __tmLicenseLoadPromise = null;
    let __tmLicensePublicKeyPromise = null;
    let __tmLicenseLoginHandler = null;

    const __tmLicenseEsc = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const __tmLicenseTextEncoder = () => new TextEncoder();
    const __tmLicenseTextDecoder = () => new TextDecoder();

    function __tmLicenseBytesToBase64Url(bytesInput) {
        const bytes = bytesInput instanceof Uint8Array ? bytesInput : new Uint8Array(bytesInput || []);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    function __tmLicenseBase64UrlToBytes(value) {
        const raw = String(value || '').trim();
        if (!raw) return new Uint8Array();
        const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - raw.length % 4) % 4);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    function __tmLicenseDecodePayload(payloadBase64Url) {
        const bytes = __tmLicenseBase64UrlToBytes(payloadBase64Url);
        return __tmLicenseTextDecoder().decode(bytes);
    }

    function __tmLicenseTodayIso() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function __tmLicenseIsDateOnly(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
    }

    function __tmLicenseCompareDateOnly(a, b) {
        const av = String(a || '').trim();
        const bv = String(b || '').trim();
        if (!__tmLicenseIsDateOnly(av) || !__tmLicenseIsDateOnly(bv)) return 0;
        if (av < bv) return -1;
        if (av > bv) return 1;
        return 0;
    }

    function __tmLicenseFormatDate(value, fallback = __tmT("common.none")) {
        const raw = String(value || '').trim();
        return raw || fallback;
    }

    function __tmLicenseGetUserObject() {
        try {
            const user = window?.siyuan?.user || globalThis?.siyuan?.user || null;
            return user && typeof user === 'object' ? user : null;
        } catch (e) {
            return null;
        }
    }

    function __tmLicenseGetAuthInfo() {
        const user = __tmLicenseGetUserObject();
        const userId = String(user?.userId || '').trim();
        const userName = String(user?.userName || user?.nickname || user?.name || '').trim();
        if (userId || userName) {
            const primarySubject = userName;
            const validSubjects = primarySubject ? [primarySubject] : [];
            return {
                subject: primarySubject,
                validSubjects,
                kind: 'account',
                userId,
                userName,
                displayName: primarySubject || __tmT("task.accountNameNotFound"),
                loggedIn: true,
            };
        }
        let systemId = '';
        try {
            systemId = String(window?.siyuan?.config?.system?.id || globalThis?.siyuan?.config?.system?.id || '').trim();
        } catch (e) {
            systemId = '';
        }
        return {
            subject: systemId ? `device:${systemId}` : '',
            validSubjects: systemId ? [`device:${systemId}`] : [],
            kind: systemId ? 'device' : 'missing',
            userId: '',
            userName: '',
            displayName: systemId ? __tmT("task.notSignedInUsingThisDeviceId") : __tmT("task.couldNotReadTheSiyuanAccountOrDeviceId"),
            loggedIn: false,
        };
    }

    async function __tmLicenseWaitForSiyuanIdentity(timeoutMs = 5000) {
        const timeout = Math.max(0, Number(timeoutMs) || 0);
        const startedAt = Date.now();
        while (true) {
            const auth = __tmLicenseGetAuthInfo();
            if (auth.kind === 'account') return auth;
            const elapsed = Date.now() - startedAt;
            if (elapsed >= timeout) return auth;
            await new Promise((resolve) => setTimeout(resolve, Math.min(100, timeout - elapsed)));
        }
    }

    function __tmLicenseGetCrypto() {
        try {
            const c = globalThis.crypto || window.crypto;
            if (c?.subtle) return c;
        } catch (e) {}
        return null;
    }

    async function __tmLicenseImportPublicKey() {
        if (__tmLicensePublicKeyPromise) return await __tmLicensePublicKeyPromise;
        __tmLicensePublicKeyPromise = (async () => {
            const cryptoObj = __tmLicenseGetCrypto();
            if (!cryptoObj?.subtle) throw new Error(__tmT("task.thisEnvironmentDoesNotSupportWebCryptoTheActivation"));
            return await cryptoObj.subtle.importKey(
                'jwk',
                LICENSE_PUBLIC_JWK,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['verify'],
            );
        })();
        return await __tmLicensePublicKeyPromise;
    }

    function __tmLicenseNormalizeCode(value) {
        return String(value || '').trim().replace(/\s+/g, '');
    }

    function __tmLicenseValidatePayloadShape(payload) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return __tmT("task.invalidActivationCodeContent");
        }
        if (Number(payload.v) !== 1) return __tmT("task.unsupportedActivationCodeVersion");
        if (String(payload.app || '').trim() !== APP_ID) return __tmT("task.theActivationCodeDoesNotBelongToTaskHorizon");
        const plan = String(payload.plan || '').trim();
        if (!Object.prototype.hasOwnProperty.call(LICENSE_PLANS, plan)) return __tmT("task.unknownPlan");
        const sub = String(payload.sub || '').trim();
        if (!sub) return __tmT("task.theActivationCodeIsMissingTheAccountOrDevice");
        if (plan !== 'lifetime' && !__tmLicenseIsDateOnly(payload.exp)) return __tmT("task.theActivationCodeIsMissingAValidExpiryDate");
        if (plan === 'lifetime' && payload.exp != null && String(payload.exp || '').trim() && !__tmLicenseIsDateOnly(payload.exp)) {
            return __tmT("task.invalidExpiryFieldForALifetimeActivationCode");
        }
        return '';
    }

    async function __tmLicenseParseAndVerify(codeInput) {
        const code = __tmLicenseNormalizeCode(codeInput);
        if (!code) return { ok: false, reason: 'empty', message: __tmT("task.enterTheActivationCode") };
        const parts = code.split('.');
        if (parts.length !== 3 || parts[0] !== LICENSE_CODE_PREFIX) {
            return { ok: false, reason: 'format', message: __tmT("task.incorrectActivationCodeFormat") };
        }
        const payloadPart = parts[1];
        const signaturePart = parts[2];
        if (!payloadPart || !signaturePart) {
            return { ok: false, reason: 'format', message: __tmT("task.incompleteActivationCodeFormat") };
        }
        let payload = null;
        try {
            payload = JSON.parse(__tmLicenseDecodePayload(payloadPart));
        } catch (e) {
            return { ok: false, reason: 'payload', message: __tmT("task.theActivationCodeContentCannotBeParsed") };
        }
        const shapeError = __tmLicenseValidatePayloadShape(payload);
        if (shapeError) return { ok: false, reason: 'payload', message: shapeError, payload };
        try {
            const publicKey = await __tmLicenseImportPublicKey();
            const signature = __tmLicenseBase64UrlToBytes(signaturePart);
            const signedBytes = __tmLicenseTextEncoder().encode(payloadPart);
            const ok = await __tmLicenseGetCrypto().subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                publicKey,
                signature,
                signedBytes,
            );
            if (!ok) return { ok: false, reason: 'signature', message: __tmT("task.incorrectActivationCodeSignature"), payload };
        } catch (e) {
            return { ok: false, reason: 'crypto', message: String(e?.message || e || __tmT("task.verificationFailed")), payload };
        }
        return { ok: true, code, payload };
    }

    function __tmLicenseBuildState(record) {
        const auth = __tmLicenseGetAuthInfo();
        const base = {
            loaded: __tmLicenseLoaded,
            hasLicense: false,
            active: false,
            pro: false,
            reason: '',
            statusText: __tmT("task.free"),
            plan: 'free',
            label: __tmT("task.free"),
            features: [],
            issuedAt: '',
            expiresAt: '',
            subject: '',
            currentSubject: auth.subject,
            authKind: auth.kind,
            authDisplayName: auth.displayName,
            loggedIn: auth.loggedIn,
            userId: auth.userId,
            userName: auth.userName,
            code: '',
            rawPayload: null,
        };
        const payload = record?.payload && typeof record.payload === 'object' ? record.payload : null;
        if (!record?.code || !payload) {
            return __tmLicenseLoaded ? base : { ...base, reason: 'loading', statusText: __tmT("task.reading") };
        }
        const plan = String(payload.plan || '').trim();
        const planMeta = LICENSE_PLANS[plan] || null;
        const features = Array.isArray(payload.features) ? payload.features.map((item) => String(item || '').trim()).filter(Boolean) : [];
        const next = {
            ...base,
            hasLicense: true,
            plan: plan || 'unknown',
            label: planMeta?.label || String(payload.label || '').trim() || plan || __tmT("calendar.unknown"),
            features,
            issuedAt: String(payload.iat || '').trim(),
            expiresAt: String(payload.exp || '').trim(),
            subject: String(payload.sub || '').trim(),
            code: String(record.code || '').trim(),
            rawPayload: payload,
        };
        if (!auth.subject) {
            return {
                ...next,
                reason: 'missing_subject',
                statusText: __tmT("task.cannotReadTheAccountOrDeviceId"),
            };
        }
        const validSubjects = Array.isArray(auth.validSubjects) ? auth.validSubjects : [auth.subject].filter(Boolean);
        if (!validSubjects.includes(next.subject)) {
            return {
                ...next,
                reason: 'subject_mismatch',
                statusText: __tmT("task.accountOrDeviceIdMismatch"),
            };
        }
        if (plan !== 'lifetime') {
            const exp = String(payload.exp || '').trim();
            if (!__tmLicenseIsDateOnly(exp)) {
                return {
                    ...next,
                    reason: 'missing_expiry',
                    statusText: __tmT("task.invalidExpiryDate"),
                };
            }
            const today = __tmLicenseTodayIso();
            if (__tmLicenseCompareDateOnly(today, exp) > 0) {
                return {
                    ...next,
                    reason: 'expired',
                    statusText: __tmT("homepage.overdue3"),
                };
            }
        }
        return {
            ...next,
            active: true,
            pro: features.includes('pro'),
            reason: 'active',
            statusText: planMeta?.label || __tmT("task.activated"),
        };
    }

    function __tmLicenseDispatchStateChanged() {
        try {
            const state = __tmLicenseBuildState(__tmLicenseRecord);
            window.dispatchEvent(new CustomEvent('tm:task-horizon-license-changed', {
                detail: { active: state.active === true, features: Array.isArray(state.features) ? state.features.slice() : [] }
            }));
        } catch (e) {}
    }

    function __tmLicenseNormalizeStoredRecord(raw) {
        if (!raw) return null;
        if (typeof raw === 'string') return { code: __tmLicenseNormalizeCode(raw), payload: null, activatedAt: '' };
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            const code = __tmLicenseNormalizeCode(raw.code || raw.licenseCode || '');
            if (!code) return null;
            return {
                code,
                payload: raw.payload && typeof raw.payload === 'object' ? raw.payload : null,
                activatedAt: String(raw.activatedAt || '').trim(),
            };
        }
        return null;
    }

    async function __tmLicenseLoadRecord(force = false) {
        if (__tmLicenseLoadPromise && !force) return await __tmLicenseLoadPromise;
        __tmLicenseLoadPromise = (async () => {
            await __tmLicenseWaitForSiyuanIdentity();
            let stored = null;
            try {
                if (globalThis.__tmHost?.loadData) {
                    stored = await globalThis.__tmHost.loadData(LICENSE_STORAGE_KEY, null);
                } else {
                    const raw = localStorage.getItem(`tm_${LICENSE_STORAGE_KEY}`);
                    stored = raw ? JSON.parse(raw) : null;
                }
            } catch (e) {
                stored = null;
            }
            const record = __tmLicenseNormalizeStoredRecord(stored);
            if (record?.code) {
                const verified = await __tmLicenseParseAndVerify(record.code);
                if (verified.ok) {
                    record.code = verified.code;
                    record.payload = verified.payload;
                } else {
                    record.verifyError = verified.message;
                }
            }
            __tmLicenseRecord = record;
            __tmLicenseLoaded = true;
            __tmLicenseDispatchStateChanged();
            return record;
        })();
        try {
            return await __tmLicenseLoadPromise;
        } finally {
            __tmLicenseLoadPromise = null;
        }
    }

    async function __tmLicenseSaveRecord(record) {
        const normalized = __tmLicenseNormalizeStoredRecord(record);
        if (!normalized) return false;
        try {
            if (globalThis.__tmHost?.saveData) {
                await globalThis.__tmHost.saveData(LICENSE_STORAGE_KEY, normalized);
            } else {
                localStorage.setItem(`tm_${LICENSE_STORAGE_KEY}`, JSON.stringify(normalized));
            }
            __tmLicenseRecord = normalized;
            __tmLicenseLoaded = true;
            __tmLicenseDispatchStateChanged();
            return true;
        } catch (e) {
            return false;
        }
    }

    async function __tmLicenseRemoveRecord() {
        try {
            if (globalThis.__tmHost?.removeData) {
                await globalThis.__tmHost.removeData(LICENSE_STORAGE_KEY);
            } else {
                localStorage.removeItem(`tm_${LICENSE_STORAGE_KEY}`);
            }
            __tmLicenseRecord = null;
            __tmLicenseLoaded = true;
            __tmLicenseDispatchStateChanged();
            return true;
        } catch (e) {
            return false;
        }
    }

    function __tmLicenseNotify(message, type = 'info') {
        try {
            if (window.__tmBasecoat?.toast) {
                window.__tmBasecoat.toast({
                    title: String(message || '').trim(),
                    variant: String(type || 'info').trim() || 'info',
                    duration: 2500,
                });
                return;
            }
        } catch (e) {}
        try {
            const colors = { success: 'var(--tm-success-color)', error: 'var(--tm-danger-color)', info: 'var(--tm-primary-color)', warning: 'var(--tm-warning-color, #f9ab00)' };
            const el = document.createElement('div');
            el.className = 'tm-hint';
            el.style.background = colors[type] || '#666';
            el.textContent = String(message || '');
            document.body.appendChild(el);
            const timer = setTimeout(() => {
                try { el.remove(); } catch (e2) {}
            }, 2500);
            el.addEventListener('click', () => {
                clearTimeout(timer);
                try { el.remove(); } catch (e2) {}
            }, { once: true });
        } catch (e) {}
    }

    async function __tmLicenseCopyText(text) {
        const value = String(text || '');
        if (!value) return false;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                return true;
            }
        } catch (e) {}
        try {
            const ta = document.createElement('textarea');
            ta.value = value;
            ta.setAttribute('readonly', 'readonly');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            return !!ok;
        } catch (e) {
            return false;
        }
    }

    function __tmLicenseOpenBenefitsSettings() {
        try {
            if (typeof window.tmSwitchSettingsTab === 'function') {
                window.tmSwitchSettingsTab('benefits');
                try {
                    if (!document.querySelector('.tm-settings-modal') && typeof window.showSettings === 'function') {
                        window.showSettings();
                    }
                } catch (e2) {}
                return true;
            }
        } catch (e) {}
        try {
            if (typeof window.showSettings === 'function') {
                window.showSettings();
                setTimeout(() => {
                    try { window.tmSwitchSettingsTab?.('benefits'); } catch (e2) {}
                }, 0);
                return true;
            }
        } catch (e) {}
        return false;
    }

    function __tmLicenseShowFullFeaturePrompt(featureName) {
        const name = String(featureName || __tmT("task.thisFeature")).trim() || __tmT("task.thisFeature");
        try {
            const existing = document.querySelector('.tm-prompt-modal.tm-license-feature-prompt');
            if (existing) existing.remove();
            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal tm-license-feature-prompt';
            modal.innerHTML = `
                <div class="tm-prompt-box">
                    <div class="tm-prompt-title">${__tmT("task.fullFeatureBenefits")}</div>
                    <div style="padding:10px 0;color:var(--tm-text-color);font-size:14px;line-height:1.65;">
                        <div style="font-weight:700;margin-bottom:6px;">${__tmT("task.isPartOfTheFullFeatureBenefits", { value1: __tmLicenseEsc(name) })}</div>
                        <div style="color:var(--tm-secondary-text);font-size:13px;">${__tmT("task.unlockWithTheFullFeatureTrialYearlyOrLifetime")}</div>
                    </div>
                    <div class="tm-prompt-buttons">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" type="button" data-tm-license-feature-close>${__tmT("common.cancel")}</button>
                        <button class="tm-prompt-btn tm-prompt-btn-primary" type="button" data-tm-license-feature-benefits>${__tmT("task.viewFeatureBenefits")}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            try { __tmApplyPopupOpenAnimation?.(modal, modal.querySelector('.tm-prompt-box')); } catch (e) {}
            let removeFromStack = null;
            try {
                if (typeof __tmModalStackBind === 'function') {
                    removeFromStack = __tmModalStackBind(() => close());
                }
            } catch (e) {}
            const close = () => {
                try { if (typeof removeFromStack === 'function') removeFromStack(); } catch (e) {}
                try { modal.remove(); } catch (e) {}
            };
            modal.querySelector('[data-tm-license-feature-close]')?.addEventListener('click', close);
            modal.querySelector('[data-tm-license-feature-benefits]')?.addEventListener('click', () => {
                close();
                __tmLicenseOpenBenefitsSettings();
            });
            modal.addEventListener('click', (event) => {
                if (event.target === modal) close();
            });
            return true;
        } catch (e) {
            __tmLicenseNotify(__tmT("task.isPartOfTheFullFeatureBenefits2", { name: name }), 'warning');
            return false;
        }
    }

    function __tmLicenseRefreshSettingsUi() {
        try {
            if (typeof window.showSettings === 'function') {
                window.showSettings();
                return;
            }
        } catch (e) {}
        try {
            const root = document.querySelector('[data-tm-license-settings-root]');
            if (root instanceof HTMLElement && typeof window.tmRenderLicenseSettingsPanel === 'function') {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = window.tmRenderLicenseSettingsPanel();
                const next = wrapper.firstElementChild;
                if (next) root.replaceWith(next);
            }
        } catch (e) {}
    }

    async function __tmLicenseActivate(codeInput) {
        const verified = await __tmLicenseParseAndVerify(codeInput);
        if (!verified.ok) return verified;
        const auth = __tmLicenseGetAuthInfo();
        if (!auth.subject) {
            return { ok: false, reason: 'missing_subject', message: __tmT("task.theCurrentEnvironmentCouldNotReadASiyuanAccount") };
        }
        const validSubjects = Array.isArray(auth.validSubjects) ? auth.validSubjects : [auth.subject].filter(Boolean);
        if (!validSubjects.includes(String(verified.payload?.sub || '').trim())) {
            return {
                ok: false,
                reason: 'subject_mismatch',
                message: __tmT("task.theAccountOrDeviceIdBoundToTheActivation"),
                payload: verified.payload,
            };
        }
        const state = __tmLicenseBuildState({ code: verified.code, payload: verified.payload });
        if (!state.active) {
            return { ok: false, reason: state.reason || 'inactive', message: state.statusText || __tmT("task.activationCodeUnavailable"), payload: verified.payload };
        }
        const saved = await __tmLicenseSaveRecord({
            code: verified.code,
            payload: verified.payload,
            activatedAt: new Date().toISOString(),
        });
        if (!saved) return { ok: false, reason: 'save_failed', message: __tmT("task.activationCodeVerifiedButSavingFailed") };
        return { ok: true, payload: verified.payload, state: __tmLicenseBuildState(__tmLicenseRecord) };
    }

    function __tmLicenseRenderStatusBadge(state) {
        const active = !!state?.active;
        const tone = active ? 'var(--tm-success-color)' : (state?.hasLicense ? 'var(--tm-warning-color, #f9ab00)' : 'var(--tm-secondary-text)');
        const bg = active
            ? 'color-mix(in srgb, var(--tm-success-color) 12%, transparent)'
            : (state?.hasLicense ? 'color-mix(in srgb, var(--tm-warning-color, #f9ab00) 14%, transparent)' : 'var(--tm-rule-group-bg)');
        return `<span style="display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:999px;background:${bg};color:${tone};font-size:12px;font-weight:700;">${__tmLicenseEsc(state?.statusText || __tmT("task.free"))}</span>`;
    }

    function __tmLicenseRenderMetaRows(state) {
        const expText = state?.plan === 'lifetime'
            ? __tmT("task.lifetime")
            : (__tmLicenseFormatDate(state?.expiresAt, state?.hasLicense ? __tmT("common.none") : __tmT("task.notActivated")));
        const rows = [
            [__tmT("task.siyuanUsername"), state?.loggedIn ? (state?.userName || __tmT("common.notSet")) : __tmT("task.notSignedIn")],
            [__tmT("task.licenseType"), state?.loggedIn ? __tmT("task.siyuanAccount") : (state?.authKind === 'device' ? __tmT("task.deviceId") : __tmT("task.notDetected"))],
            [__tmT("task.currentPlan"), state?.hasLicense ? state.label : __tmT("task.free")],
            [__tmT("task.currentAccountDevice"), state?.currentSubject || __tmT("task.notDetected")],
            [__tmT("task.boundAccountDevice"), state?.subject || __tmT("task.notActivated")],
            [__tmT("task.issued"), __tmLicenseFormatDate(state?.issuedAt, __tmT("task.notActivated"))],
            [__tmT("task.expires"), expText],
        ];
        return rows.map(([label, value]) => `
            <div style="font-size:12px;color:var(--tm-secondary-text);">${__tmLicenseEsc(label)}</div>
            <div style="font-size:12px;color:var(--tm-text-color);word-break:break-all;font-family:${label.includes('ID') ? 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' : 'inherit'};">${__tmLicenseEsc(value)}</div>
        `).join('');
    }

    function __tmLicenseRenderSettingsPanel() {
        const auth = __tmLicenseGetAuthInfo();
        const state = __tmLicenseBuildState(__tmLicenseRecord);
        const accountLine = auth.loggedIn
            ? __tmT("task.signedInAccount", { displayName: auth.displayName })
            : __tmT("task.notSignedInToSiyuanTheLocalDeviceId");
        const note = auth.loggedIn
            ? __tmT("task.provideTheMatchingAccountNameWhenPaying")
            : __tmT("task.whenNotSignedInTheActivationCodeBindsTo");
        const clearBtn = state.hasLicense
            ? `<button class="tm-btn tm-btn-danger" type="button" onclick="tmClearLicenseFromSettings()">${__tmT("task.clearActivation")}</button>`
            : '';
        const disabled = auth.subject ? '' : ' disabled';
        return `
            <div class="tm-settings-panel" data-tm-license-settings-root style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
                    <div style="min-width:220px;flex:1;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <div style="font-weight:700;font-size:15px;">${__tmT("task.taskHorizonLicense")}</div>
                            ${__tmLicenseRenderStatusBadge(state)}
                        </div>
                        <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:6px;line-height:1.7;">
                            ${__tmLicenseEsc(accountLine)}。${__tmLicenseEsc(note)}
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="tm-btn tm-btn-secondary" type="button" onclick="tmRefreshLicenseStatus()">${__tmT("task.refreshLicense")}</button>
                        ${clearBtn}
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:12px;align-items:stretch;">
                    <div style="min-width:0;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);padding:12px;">
                        <div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:6px;">${__tmT("task.currentAccountDevice")}</div>
                        <div style="display:flex;gap:8px;align-items:center;min-width:0;flex-wrap:wrap;">
                            <code style="flex:1;min-width:220px;padding:8px 10px;border-radius:8px;background:var(--tm-sidebar-bg);border:1px solid var(--tm-border-color);color:var(--tm-text-color);word-break:break-all;">${__tmLicenseEsc(auth.subject || __tmT("task.notDetected"))}</code>
                            <button class="tm-btn tm-btn-primary" type="button" onclick="tmCopyLicenseAuthSubject()"${disabled}>${__tmT("task.copy")}</button>
                        </div>
                        <div style="margin-top:10px;display:grid;grid-template-columns:86px minmax(0,1fr);gap:8px 10px;">
                            ${__tmLicenseRenderMetaRows(state)}
                        </div>
                    </div>

                    <div style="min-width:0;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);padding:12px;">
                        <label for="tmLicenseCodeInput" style="display:block;font-size:12px;color:var(--tm-secondary-text);margin-bottom:6px;">${__tmT("task.activationCode")}</label>
                        <textarea id="tmLicenseCodeInput" rows="4" spellcheck="false" style="width:100%;box-sizing:border-box;resize:vertical;min-height:82px;padding:8px 10px;border:1px solid var(--tm-input-border);border-radius:8px;background:var(--tm-input-bg);color:var(--tm-text-color);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.55;"></textarea>
                        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;flex-wrap:wrap;">
                            <button class="tm-btn tm-btn-primary" type="button" onclick="tmActivateLicenseFromSettings()"${disabled}>${__tmT("task.activate")}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    window.tmGetLicenseAuthInfo = __tmLicenseGetAuthInfo;
    window.tmGetLicenseState = function() {
        return __tmLicenseBuildState(__tmLicenseRecord);
    };
    window.tmLicenseIsPro = function() {
        return __tmLicenseBuildState(__tmLicenseRecord).pro === true;
    };
    window.tmLicenseHasFeature = function(feature) {
        const state = __tmLicenseBuildState(__tmLicenseRecord);
        return state.active === true && state.features.includes(String(feature || '').trim());
    };
    window.tmRequireFullFeature = function(feature, label) {
        const name = String(label || feature || __tmT("task.thisFeature")).trim() || __tmT("task.thisFeature");
        const state = __tmLicenseBuildState(__tmLicenseRecord);
        if (state.active === true && state.features.includes('pro')) return true;
        __tmLicenseShowFullFeaturePrompt(name);
        return false;
    };
    window.tmLicenseLoad = function(force = false) {
        return __tmLicenseLoadRecord(!!force);
    };
    window.tmRenderLicenseSettingsPanel = __tmLicenseRenderSettingsPanel;
    window.tmRefreshLicenseStatus = async function() {
        await __tmLicenseLoadRecord(true);
        __tmLicenseNotify(__tmT("task.licenseStatusRefreshed"), 'success');
        __tmLicenseRefreshSettingsUi();
    };
    window.tmCopyLicenseAuthSubject = async function() {
        const auth = __tmLicenseGetAuthInfo();
        if (!auth.subject) {
            __tmLicenseNotify(__tmT("task.couldNotReadTheAccountOrDeviceId"), 'warning');
            return false;
        }
        const ok = await __tmLicenseCopyText(auth.subject);
        __tmLicenseNotify(ok ? __tmT("task.accountDeviceIdCopied") : __tmT("task.copyFailedSelectAndCopyManually"), ok ? 'success' : 'warning');
        return ok;
    };
    window.tmActivateLicenseFromSettings = async function() {
        const input = document.getElementById('tmLicenseCodeInput');
        const code = input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement ? input.value : '';
        const result = await __tmLicenseActivate(code);
        if (!result.ok) {
            __tmLicenseNotify(result.message || __tmT("task.activationFailed"), 'error');
            return false;
        }
        __tmLicenseNotify(__tmT("task.thankYouForYourSupportActivated", { value1: result.state?.label || 'Pro' }), 'success');
        __tmLicenseRefreshSettingsUi();
        return true;
    };
    window.tmClearLicenseFromSettings = async function() {
        try {
            if (typeof confirm === 'function' && !confirm(__tmT("task.clearTheCurrentActivationInformation"))) return false;
        } catch (e) {}
        const ok = await __tmLicenseRemoveRecord();
        __tmLicenseNotify(ok ? __tmT("task.activationInformationCleared") : __tmT("task.clearFailed"), ok ? 'success' : 'error');
        __tmLicenseRefreshSettingsUi();
        return ok;
    };

    __tmLicenseLoginHandler = () => { void __tmLicenseLoadRecord(true); };
    try { window.addEventListener('siyuan-login-success', __tmLicenseLoginHandler); } catch (e) {}

    globalThis.__tmLicenseCleanup = function() {
        try { window.removeEventListener('siyuan-login-success', __tmLicenseLoginHandler); } catch (e) {}
        __tmLicenseLoginHandler = null;
        try { delete window.tmGetLicenseAuthInfo; } catch (e) {}
        try { delete window.tmGetLicenseState; } catch (e) {}
        try { delete window.tmLicenseIsPro; } catch (e) {}
        try { delete window.tmLicenseHasFeature; } catch (e) {}
        try { delete window.tmRequireFullFeature; } catch (e) {}
        try { delete window.tmLicenseLoad; } catch (e) {}
        try { delete window.tmRenderLicenseSettingsPanel; } catch (e) {}
        try { delete window.tmRefreshLicenseStatus; } catch (e) {}
        try { delete window.tmCopyLicenseAuthSubject; } catch (e) {}
        try { delete window.tmActivateLicenseFromSettings; } catch (e) {}
        try { delete window.tmClearLicenseFromSettings; } catch (e) {}
        try { delete globalThis.__tmLicenseCleanup; } catch (e) {}
    };

    void __tmLicenseLoadRecord(false);
})();
