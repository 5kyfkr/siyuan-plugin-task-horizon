(function () {
    'use strict';

    if (globalThis.__tmAI?.loaded && globalThis.__tmAI?.runtimeKind === 'agent') return;

    const STORE_FILE = 'agent-workbench.json';
    const API_ROOT = '/api/ai/agent';
    const SKILL_ROOT = '/data/plugins/siyuan-plugin-task-horizon/skills';
    const DEFAULT_SESSION_TITLE = '任务工作台';
    const SIYUAN_DEFAULT_SESSION_TITLE = 'AI Agent';
    const SESSION_LIST_PAGE_SIZE = 100;
    const WORKBENCH_BINDING_TOKEN = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const MAX_RECENT_SESSIONS = 60;
    const MAX_DIRECT_TASK_REFERENCES = 20;
    const CAPABILITY_RETRY_INTERVAL_MS = 1000;
    const CAPABILITY_RETRY_LIMIT = 5;
    const KERNEL_PLUGIN_PACKAGE_NAME = 'siyuan-plugin-task-horizon';
    const TASK_HORIZON_BACKEND_CAPABILITY_PREFIX = `plugin/backend/${KERNEL_PLUGIN_PACKAGE_NAME}/`;
    const KERNEL_SESSION_AUTH_ERROR = 'Auth failed [session]';
    const KERNEL_AUTH_RECOVERY_STORAGE_KEY = 'tm_agent_kernel_auth_recovery_at';
    const KERNEL_AUTH_RECOVERY_COOLDOWN_MS = 30000;
    const KERNEL_AUTH_RECOVERY_PEER_WAIT_MS = 1000;
    const TASK_HORIZON_TOOL_PREFIXES = Object.freeze([
        'plugin__siyuan-plugin-task-horizon__',
        'plugin__siyuan_plugin_task_horizon__',
    ]);
    const KERNEL_AUTH_RETRYABLE_READ_CALLS = new Set([
        'taskHorizonGetCapabilities',
        'taskHorizonQueryTasks',
        'taskHorizonSearchDocuments',
        'taskHorizonGetPolicy',
        'taskHorizonPreviewPolicyPatch',
        'taskHorizonRegisterDocumentGroupSnapshot',
    ]);
    let kernelAuthRecoveryPromise = null;
    const TASK_CONTEXT_DRAG_TYPES = Object.freeze([
        'application/x-tm-task-ids',
        'application/x-tm-task-id',
        'application/x-tm-task',
        'application/x-tm-whiteboard-pool',
        'application/x-tm-whiteboard-task',
    ]);
    const BUILTIN_SKILL_NAMES = Object.freeze(['task-capture', 'task-planning', 'task-review', 'task-template']);
    const BUILTIN_PRESETS = Object.freeze({
        'title-rewrite': {
            label: '优化标题',
            prompt: '请结合当前任务和思源文档上下文，给出更明确、可执行的任务标题。需要修改时使用任务工具更新标题。',
            starter: '优化当前任务标题',
        },
        'field-edit': {
            label: '修改字段',
            prompt: '请根据用户要求检查当前任务，只修改明确要求的安全字段。写入前先说明变更并等待确认。',
            starter: '帮我检查并修改当前任务字段',
        },
        'smart-review': {
            label: '目标分析',
            prompt: '请用 SMART 原则分析当前目标，优先利用思源文档上下文；只有用户明确要求时才写入任务。',
            starter: '分析当前目标是否清晰可执行',
        },
        'task-capture': {
            label: '拆分任务',
            prompt: '使用 task-capture 工作流程，把用户表达整理为少量明确任务。先给出计划，再整批确认写入。',
            starter: '把当前内容拆分成可执行任务',
        },
        'task-create': {
            label: '创建任务',
            prompt: '直接创建用户要求的单个任务，不要擅自拆分。用户没有明确指定位置时使用本轮提供的插件默认新建位置，直接调用 create_task，不询问位置、不预览，也不要求额外确认。',
            starter: '我想创建一个任务',
        },
        'task-planning': {
            label: '安排时间',
            prompt: '使用 task-planning 工作流程读取任务、日程和安排规则，先生成无冲突预览，再一次确认写入。',
            starter: '为当前任务安排合适的时间',
        },
        'task-review': {
            label: '生成复盘',
            prompt: '使用 task-review 工作流程和聚合统计工具生成复盘。长期范围必须使用聚合工具，不要拉取全部原始任务自行计数。',
            starter: '总结当前范围的完成情况和投入时间',
        },
        'task-template': {
            label: '场景模板',
            prompt: '使用 task-template 工作流程，根据用户描述生成可复用的任务与日程计划，先预览后整批确认。',
            starter: '按我的固定场景生成一套任务安排',
        },
    });

    // Paths from phosphor-icons-core 2.1.1 assets/bold.
    const PHOSPHOR_BOLD_CONTEXT_PATHS = Object.freeze({
        plus: 'M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z',
        caretUp: 'M216.49,168.49a12,12,0,0,1-17,0L128,97,56.49,168.49a12,12,0,0,1-17-17l80-80a12,12,0,0,1,17,0l80,80A12,12,0,0,1,216.49,168.49Z',
        caretDown: 'M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z',
        broom: 'M237.24,213.21C216.12,203,204,180.64,204,152V134.73a19.94,19.94,0,0,0-12.62-18.59l-24.86-9.81a4,4,0,0,1-2.26-5.14l21.33-53A32,32,0,0,0,167.17,6,32.13,32.13,0,0,0,126.25,24.2l-.07.18-21,53.09a3.94,3.94,0,0,1-2.14,2.2,3.89,3.89,0,0,1-3,.06L74.6,69.43A19.89,19.89,0,0,0,52.87,74C31.06,96.43,20,122.68,20,152a115.46,115.46,0,0,0,32.29,80.3A12,12,0,0,0,61,236H232a12,12,0,0,0,5.24-22.79ZM68.19,92.73,91.06,102A28,28,0,0,0,127.5,86.31l20.95-53a8.32,8.32,0,0,1,10.33-4.81,8,8,0,0,1,4.61,10.57,1.17,1.17,0,0,0,0,.11L142,92.29a28.05,28.05,0,0,0,15.68,36.33L180,137.45V152c0,1,0,2.07.05,3.1l-122.44-49A101.91,101.91,0,0,1,68.19,92.73ZM116.74,212a83.73,83.73,0,0,1-22.09-39,12,12,0,0,0-23.25,6,110.27,110.27,0,0,0,14.49,33H66.25A91.53,91.53,0,0,1,44,152a84,84,0,0,1,3.41-24.11l136.67,54.66A86.58,86.58,0,0,0,198.66,212Z',
        calendarDots: 'M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0h16V76H52V52ZM52,204V100H204V204Zm92-76a16,16,0,1,1-16-16A16,16,0,0,1,144,128Zm48,0a16,16,0,1,1-16-16A16,16,0,0,1,192,128ZM96,176a16,16,0,1,1-16-16A16,16,0,0,1,96,176Zm48,0a16,16,0,1,1-16-16A16,16,0,0,1,144,176Zm48,0a16,16,0,1,1-16-16A16,16,0,0,1,192,176Z',
        arrowCounterClockwise: 'M228,128a100,100,0,0,1-98.66,100H128a99.39,99.39,0,0,1-68.62-27.29,12,12,0,0,1,16.48-17.45,76,76,0,1,0-1.57-109c-.13.13-.25.25-.39.37L54.89,92H72a12,12,0,0,1,0,24H24a12,12,0,0,1-12-12V56a12,12,0,0,1,24,0V76.72L57.48,57.06A100,100,0,0,1,228,128Z',
        pencilSimple: 'M230.14,70.54,185.46,25.85a20,20,0,0,0-28.29,0L33.86,149.17A19.85,19.85,0,0,0,28,163.31V208a20,20,0,0,0,20,20H92.69a19.86,19.86,0,0,0,14.14-5.86L230.14,98.82a20,20,0,0,0,0-28.28ZM91,204H52V165l84-84,39,39ZM192,103,153,64l18.34-18.34,39,39Z',
        trash: 'M216,48H180V36A28,28,0,0,0,152,8H104A28,28,0,0,0,76,36V48H40a12,12,0,0,0,0,24h4V208a20,20,0,0,0,20,20H192a20,20,0,0,0,20-20V72h4a12,12,0,0,0,0-24ZM100,36a4,4,0,0,1,4-4h48a4,4,0,0,1,4,4V48H100Zm88,168H68V72H188ZM116,104v64a12,12,0,0,1-24,0V104a12,12,0,0,1,24,0Zm48,0v64a12,12,0,0,1-24,0V104a12,12,0,0,1,24,0Z',
        copy: 'M216,28H88A12,12,0,0,0,76,40V76H40A12,12,0,0,0,28,88V216a12,12,0,0,0,12,12H168a12,12,0,0,0,12-12V180h36a12,12,0,0,0,12-12V40A12,12,0,0,0,216,28ZM156,204H52V100H156Zm48-48H180V88a12,12,0,0,0-12-12H100V52H204Z',
        check: 'M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z',
    });

    const runtime = {
        host: null,
        mobile: false,
        mounted: false,
        busy: false,
        abortController: null,
        activeSessionID: '',
        session: null,
        sessions: [],
        context: { taskIDs: [], documentIDs: [], scope: null },
        presetID: '',
        live: null,
        capabilities: null,
        skillSync: { busy: false, installed: false, results: [], error: '' },
        undoAvailable: false,
        undoID: '',
        undoCount: 0,
        roundUndoIDs: [],
        conversationFollowBottom: true,
        historyOpen: false,
        historyScheduledOnly: false,
        storeLoaded: false,
        storeLoadPromise: null,
        presetsOpen: false,
        presetEditorID: '',
        contextPickerOpen: false,
        contextPickerMode: 'task',
        contextPickerQuery: '',
        contextPickerResults: [],
        contextPickerLoading: false,
        contextPickerError: '',
        contextPickerSearchSeq: 0,
        contextPickerScrollTop: 0,
        contextExpanded: false,
        contextLabelSeq: 0,
        contextResizeObserver: null,
        viewContextSyncSeq: 0,
        viewContextSyncTimer: 0,
        viewContextListener: null,
        capabilityRetryTimer: 0,
        capabilityRetrySeq: 0,
        statusText: '',
        streamRenderFrame: 0,
        hostListenerController: null,
        automationControllers: new Set(),
        sessionSaveQueues: new Map(),
        store: {
            schemaVersion: 2,
            activeSessionID: '',
            sessionIDs: [],
            drafts: {},
            context: { taskIDs: [], documentIDs: [], scope: null },
            presetID: '',
            toolsOnboardingDismissed: false,
            builtinSkills: {},
            builtinPresetOverrides: {},
            hiddenBuiltinPresetIDs: [],
            customPresets: [],
            pinnedPresetIDs: [],
            ui: {},
        },
    };

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function phosphorBoldContextIcon(name) {
        const path = PHOSPHOR_BOLD_CONTEXT_PATHS[name];
        if (!path) return '';
        return `<svg viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="${path}"></path></svg>`;
    }

    function text(value) {
        return String(value == null ? '' : value).trim();
    }

    function isTaskBlockID(value) {
        return /^[0-9]{14}-[A-Za-z0-9]+$/.test(text(value));
    }

    function isVirtualTaskID(value) {
        return /^repeatinst:[0-9]{14}-[A-Za-z0-9]+:[^:]+$/.test(text(value));
    }

    function isTaskContextID(value) {
        return isTaskBlockID(value) || isVirtualTaskID(value);
    }

    async function writeClipboardText(value) {
        const content = String(value == null ? '' : value);
        if (!content) return false;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(content);
                return true;
            }
        } catch (error) {}
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        try {
            textarea.focus();
            textarea.select();
            return document.execCommand('copy');
        } catch (error) {
            return false;
        } finally {
            textarea.remove();
        }
    }

    function plainMarkupText(value) {
        const raw = String(value == null ? '' : value);
        if (!raw.includes('<')) return text(raw);
        try {
            const template = document.createElement('template');
            template.innerHTML = raw;
            return text(template.content.textContent);
        } catch (error) {
            return text(raw);
        }
    }

    function userEntryBlockHTML(value) {
        return `<div>${esc(value).replace(/\r?\n/g, '<br>')}</div>`;
    }

    function userEntryText(entry) {
        const blockHTML = String(entry?.blockHTML || '');
        if (!blockHTML) return text(entry?.content);
        try {
            const template = document.createElement('template');
            template.innerHTML = blockHTML.replace(/<br\s*\/?\s*>/gi, '\n');
            return text(template.content.textContent);
        } catch (error) {
            return text(blockHTML
                .replace(/<br\s*\/?\s*>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&'));
        }
    }

    function clone(value) {
        try { return JSON.parse(JSON.stringify(value)); } catch (error) { return value; }
    }

    function bridge() {
        return globalThis.__taskHorizonHostBridge || {};
    }

    function aiBridge() {
        return globalThis['siyuan-plugin-task-horizon']?.aiBridge || null;
    }

    function normalizeConversationFontSize(value) {
        const size = Number(value);
        return Number.isFinite(size) ? Math.max(12, Math.min(22, Math.round(size))) : 14;
    }

    function conversationFontSizeRem(value) {
        return `${Number((normalizeConversationFontSize(value) / 16).toFixed(4))}rem`;
    }

    function setConversationFontSize(value) {
        const size = normalizeConversationFontSize(value);
        runtime.host?.querySelector?.('.tm-agent-workbench')?.style?.setProperty('--tm-agent-conversation-font-size', conversationFontSizeRem(size));
        return size;
    }

    function agentHeaders(options = {}) {
        const headers = { 'Content-Type': 'application/json' };
        const appID = text(bridge().app?.appId || bridge().plugin?.app?.appId);
        if (appID) headers['X-SiYuan-App-ID'] = appID;
        if (options.checkpoint === true) headers['X-SiYuan-Agent-Checkpoint'] = '2';
        return headers;
    }

    function newID() {
        try { return globalThis.Lute?.NewNodeID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
        catch (error) { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
    }

    let markdownRenderer = null;
    function getMarkdownRenderer() {
        if (markdownRenderer) return markdownRenderer;
        try {
            const lute = globalThis.Lute?.New?.();
            if (!lute) return null;
            [
                ['SetSpellcheck', false],
                ['SetProtyleMarkNetImg', false],
                ['SetFileAnnotationRef', true],
                ['SetHTMLTag2TextMark', true],
                ['SetTextMark', true],
                ['SetHeadingID', false],
                ['SetYamlFrontMatter', false],
                ['SetInlineMathAllowDigitAfterOpenMarker', true],
                ['SetToC', false],
                ['SetIndentCodeBlock', false],
                ['SetSetext', false],
                ['SetFootnotes', false],
                ['SetLinkRef', false],
                ['SetSanitize', true],
                ['SetImgPathAllowSpace', true],
                ['SetKramdownIAL', true],
                ['SetSuperBlock', true],
                ['SetCallout', true],
                ['SetInlineAsterisk', true],
                ['SetInlineUnderscore', true],
                ['SetSup', true],
                ['SetSub', true],
                ['SetTag', true],
                ['SetInlineMath', true],
                ['SetGFMStrikethrough1', false],
                ['SetGFMStrikethrough', true],
                ['SetMark', true],
                ['SetSpin', true],
                ['SetProtyleWYSIWYG', true],
                ['SetBlockRef', true],
                ['SetDataTask', true],
                ['SetExportNormalizeTaskListMarker', true],
                ['SetArbitraryTaskListItemMarker', true],
                ['SetEnsureListItemParagraph', true],
            ].forEach(([name, value]) => {
                try { lute[name]?.(value); } catch (error) {}
            });
            try { lute.SetUnorderedListMarker?.('-'); } catch (error) {}
            markdownRenderer = lute;
            return markdownRenderer;
        } catch (error) {
            return null;
        }
    }

    function renderMarkdown(value) {
        const source = String(value == null ? '' : value);
        if (!source) return '';
        try {
            const html = getMarkdownRenderer()?.ProtylePreviewStr?.('', source);
            if (html) return decorateMarkdownCodeBlocks(html);
        } catch (error) {}
        return esc(source).replace(/\n/g, '<br>');
    }

    function decorateMarkdownCodeBlocks(html) {
        if (typeof document === 'undefined') return html;
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        template.content.querySelectorAll('pre.code-block, pre[data-language]').forEach((pre) => {
            const code = pre.querySelector(':scope > code');
            if (!code || pre.querySelector('.tm-agent-code-copy')) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'block__icon tm-agent-code-copy ariaLabel';
            button.dataset.agentAction = 'copy-code-block';
            button.setAttribute('data-position', 'north');
            button.setAttribute('aria-label', '复制代码块');
            button.setAttribute('title', '复制代码块');
            button.innerHTML = phosphorBoldContextIcon('copy');
            pre.classList.add('tm-agent-code-block');
            pre.appendChild(button);
        });
        return template.innerHTML;
    }

    function normalizeCustomPreset(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const label = text(source.label || source.name).slice(0, 60);
        const prompt = text(source.prompt || source.instruction).slice(0, 8000);
        if (!label || !prompt) return null;
        return {
            id: text(source.id) || `preset_${newID()}`,
            label,
            prompt,
            starter: text(source.starter).slice(0, 500),
        };
    }

    function normalizeBuiltinPresetOverrides(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const overrides = {};
        for (const id of Object.keys(BUILTIN_PRESETS)) {
            const normalized = normalizeCustomPreset({ ...(source[id] || {}), id });
            if (!normalized) continue;
            overrides[id] = { label: normalized.label, prompt: normalized.prompt, starter: normalized.starter };
        }
        return overrides;
    }

    function normalizeHiddenBuiltinPresetIDs(value) {
        return Array.from(new Set((Array.isArray(value) ? value : []).map(text).filter((id) => !!BUILTIN_PRESETS[id])));
    }

    function normalizePinnedPresetIDs(value) {
        return Array.from(new Set((Array.isArray(value) ? value : []).map(text).filter(Boolean)));
    }

    function saveBuiltinPresetOverride(id, preset) {
        const key = text(id);
        const base = BUILTIN_PRESETS[key];
        if (!base || !preset) return false;
        const content = { label: preset.label, prompt: preset.prompt, starter: preset.starter };
        if (content.label === base.label && content.prompt === base.prompt && content.starter === base.starter) {
            delete runtime.store.builtinPresetOverrides[key];
        } else {
            runtime.store.builtinPresetOverrides[key] = content;
        }
        return true;
    }

    function getPreset(id) {
        const key = text(id);
        if (BUILTIN_PRESETS[key]) {
            if (runtime.store.hiddenBuiltinPresetIDs.includes(key)) return null;
            const override = runtime.store.builtinPresetOverrides[key];
            return { id: key, ...BUILTIN_PRESETS[key], ...(override || {}), builtin: true, customized: !!override };
        }
        if (!key.startsWith('custom:')) return null;
        const customID = key.slice('custom:'.length);
        const preset = runtime.store.customPresets.find((item) => text(item?.id) === customID);
        return preset ? { ...preset, id: key, builtin: false } : null;
    }

    async function post(path, body, options = {}) {
        const response = await fetch(`${API_ROOT}${path}`, {
            method: 'POST',
            headers: agentHeaders(options),
            body: JSON.stringify(body || {}),
        });
        let payload = null;
        try { payload = await response.json(); } catch (error) {}
        if (!response.ok || !payload || Number(payload.code) !== 0) {
            throw new Error(text(payload?.msg || payload?.message) || `智能体请求失败 (${response.status})`);
        }
        return payload.data;
    }

    async function postAgentInteraction(path, body) {
        const response = await fetch(`${API_ROOT}${path}`, {
            method: 'POST',
            headers: agentHeaders(),
            body: JSON.stringify(body || {}),
        });
        let message = '';
        let payload = null;
        try {
            const raw = await response.text();
            payload = raw ? JSON.parse(raw) : null;
            message = text(payload?.msg || payload?.message);
        } catch (error) {}
        if (!response.ok || (payload && Number(payload.code) !== 0)) {
            throw new Error(message || `智能体交互请求失败 (${response.status})`);
        }
        return true;
    }

    function kernelRecoveryAppID() {
        return text(bridge().app?.appId || bridge().plugin?.app?.appId);
    }

    function readKernelRecoveryTime() {
        try {
            const value = Number(globalThis.localStorage?.getItem?.(KERNEL_AUTH_RECOVERY_STORAGE_KEY));
            return Number.isFinite(value) && value > 0 ? value : 0;
        } catch (error) {
            return 0;
        }
    }

    function markKernelRecoveryStarted(value) {
        try { globalThis.localStorage?.setItem?.(KERNEL_AUTH_RECOVERY_STORAGE_KEY, String(value)); }
        catch (error) {}
    }

    function clearKernelRecoveryMark(value) {
        try {
            if (readKernelRecoveryTime() === value) {
                globalThis.localStorage?.removeItem?.(KERNEL_AUTH_RECOVERY_STORAGE_KEY);
            }
        } catch (error) {}
    }

    function waitForKernelRecovery(delay) {
        return new Promise((resolve) => setTimeout(resolve, delay));
    }

    async function restartKernelPluginSession() {
        const appID = kernelRecoveryAppID();
        if (!appID) throw new Error('缺少当前窗口标识，无法安全重启任务工具内核');

        const now = Date.now();
        const recentRecovery = readKernelRecoveryTime();
        if (recentRecovery && now >= recentRecovery && now - recentRecovery < KERNEL_AUTH_RECOVERY_COOLDOWN_MS) {
            await waitForKernelRecovery(KERNEL_AUTH_RECOVERY_PEER_WAIT_MS);
            const currentRecovery = readKernelRecoveryTime();
            if (currentRecovery && Date.now() >= currentRecovery && Date.now() - currentRecovery < KERNEL_AUTH_RECOVERY_COOLDOWN_MS) {
                return false;
            }
        }

        const recoveryStartedAt = Date.now();
        markKernelRecoveryStarted(recoveryStartedAt);
        try {
            const response = await fetch('/api/petal/setPetalEnabled', {
                method: 'POST',
                headers: agentHeaders(),
                body: JSON.stringify({
                    packageName: KERNEL_PLUGIN_PACKAGE_NAME,
                    enabled: true,
                    app: appID,
                }),
            });
            let payload = null;
            try { payload = await response.json(); } catch (error) {}
            if (!response.ok || !payload || Number(payload.code) !== 0) {
                throw new Error(text(payload?.msg || payload?.message) || `任务工具内核重启失败 (${response.status})`);
            }
            return true;
        } catch (error) {
            clearKernelRecoveryMark(recoveryStartedAt);
            throw error;
        }
    }

    async function recoverKernelSession() {
        if (typeof globalThis.__tmRecoverTaskHorizonKernelSession === 'function') {
            return await globalThis.__tmRecoverTaskHorizonKernelSession();
        }
        if (!kernelAuthRecoveryPromise) {
            kernelAuthRecoveryPromise = restartKernelPluginSession().finally(() => {
                kernelAuthRecoveryPromise = null;
            });
        }
        return await kernelAuthRecoveryPromise;
    }

    async function callKernelMethod(name, args) {
        const kernel = bridge().kernel || bridge().plugin?.kernel;
        const method = kernel?.rpc?.call?.[name];
        if (typeof method !== 'function') throw new Error('当前思源版本未提供任务工具服务');
        const result = await method(...args);
        if (!result || result.ok !== true) {
            const error = new Error(text(result?.error?.message) || '任务工具服务调用失败');
            error.code = text(result?.error?.code) || 'STORAGE_ERROR';
            error.details = result?.error?.details || null;
            throw error;
        }
        return result.data;
    }

    async function kernelCall(name, ...args) {
        try {
            return await callKernelMethod(name, args);
        } catch (error) {
            if (text(error?.message) !== KERNEL_SESSION_AUTH_ERROR) throw error;
            try {
                await recoverKernelSession();
            } catch (recoveryError) {
                const failure = new Error(`任务工具会话失效，自动恢复失败：${text(recoveryError?.message || recoveryError) || '未知错误'}`);
                failure.code = 'KERNEL_SESSION_RECOVERY_FAILED';
                throw failure;
            }
            if (KERNEL_AUTH_RETRYABLE_READ_CALLS.has(name)) {
                return await callKernelMethod(name, args);
            }
            const retry = new Error('任务工具会话已恢复，请重试刚才的操作');
            retry.code = 'KERNEL_SESSION_RECOVERED';
            retry.details = { call: name };
            throw retry;
        }
    }

    function normalizeStore(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const context = source.context && typeof source.context === 'object' ? source.context : {};
        return {
            schemaVersion: 2,
            activeSessionID: text(source.activeSessionID),
            sessionIDs: Array.from(new Set((Array.isArray(source.sessionIDs) ? source.sessionIDs : []).map(text).filter(Boolean))).slice(0, MAX_RECENT_SESSIONS),
            drafts: source.drafts && typeof source.drafts === 'object' && !Array.isArray(source.drafts) ? source.drafts : {},
            context: {
                taskIDs: Array.from(new Set((Array.isArray(context.taskIDs) ? context.taskIDs : []).map(text).filter(isTaskContextID))),
                documentIDs: Array.from(new Set((Array.isArray(context.documentIDs) ? context.documentIDs : []).map(text).filter(Boolean))),
                scope: context.scope && typeof context.scope === 'object' ? context.scope : null,
                labels: (Array.isArray(context.labels) ? context.labels : []).map((item) => ({
                    kind: text(item?.kind),
                    id: text(item?.id),
                    label: text(item?.label),
                })).filter((item) => item.kind && item.id && item.label),
            },
            presetID: text(source.presetID),
            toolsOnboardingDismissed: source.toolsOnboardingDismissed === true,
            builtinSkills: source.builtinSkills && typeof source.builtinSkills === 'object' && !Array.isArray(source.builtinSkills) ? source.builtinSkills : {},
            builtinPresetOverrides: normalizeBuiltinPresetOverrides(source.builtinPresetOverrides),
            hiddenBuiltinPresetIDs: normalizeHiddenBuiltinPresetIDs(source.hiddenBuiltinPresetIDs),
            customPresets: Array.isArray(source.customPresets) ? source.customPresets.map(normalizeCustomPreset).filter(Boolean) : [],
            pinnedPresetIDs: normalizePinnedPresetIDs(source.pinnedPresetIDs),
            ui: source.ui && typeof source.ui === 'object' ? source.ui : {},
        };
    }

    async function loadStore() {
        try {
            const value = await bridge().loadData?.(STORE_FILE);
            runtime.store = normalizeStore(value);
        } catch (error) {
            runtime.store = normalizeStore(null);
        }
        runtime.activeSessionID = runtime.store.activeSessionID;
        runtime.context = clone(runtime.store.context);
        runtime.presetID = getPreset(runtime.store.presetID) ? runtime.store.presetID : '';
        runtime.store.pinnedPresetIDs = runtime.store.pinnedPresetIDs.filter((id) => !!getPreset(id));
    }

    async function ensureStoreLoaded() {
        if (runtime.storeLoaded) return runtime.store;
        if (!runtime.storeLoadPromise) {
            runtime.storeLoadPromise = loadStore().then(() => {
                runtime.storeLoaded = true;
                return runtime.store;
            }).finally(() => {
                runtime.storeLoadPromise = null;
            });
        }
        return runtime.storeLoadPromise;
    }

    let saveTimer = 0;
    let contextSearchTimer = 0;
    let contextScrollbarHideTimer = 0;
    let contextScrollbarDrag = null;
    let questionOptionMouseState = null;
    function persistStore() {
        runtime.store.activeSessionID = runtime.activeSessionID;
        runtime.store.context = clone(runtime.context);
        runtime.store.presetID = runtime.presetID;
        return Promise.resolve(bridge().saveData?.(STORE_FILE, clone(runtime.store))).catch(() => null);
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = 0;
            void persistStore();
        }, 80);
    }

    function rememberSession(id) {
        const sessionID = text(id);
        if (!sessionID) return;
        runtime.store.sessionIDs = [sessionID, ...runtime.store.sessionIDs.filter((item) => item !== sessionID)].slice(0, MAX_RECENT_SESSIONS);
        scheduleSave();
    }

    async function ensureAutomationConversation(sessionID) {
        await ensureStoreLoaded();
        const id = text(sessionID) || newID();
        rememberSession(id);
        return id;
    }

    function isMissingAgentSessionError(error) {
        return /(?:not\s+found|not\s+exist|does\s+not\s+exist|不存在|未找到|找不到)/i.test(text(error?.message || error));
    }

    function isAgentSessionRevisionConflict(error) {
        return /(?:session\s+)?revision\s+conflict|会话.*版本.*冲突/i.test(text(error?.message || error));
    }

    async function persistSessionCheckpoint(session, commitTurnID = '') {
        if (!session || typeof session !== 'object' || !text(session.id)) return session;
        const snapshot = clone(session);
        const turnID = text(commitTurnID || snapshot.recoveryTurnID);
        snapshot.expectedRevision = Number(session?.revision) || 0;
        if (turnID) snapshot.commitTurnID = turnID;
        else delete snapshot.commitTurnID;
        delete snapshot.messages;
        delete snapshot.recoveryTurnID;
        delete snapshot.recoveryState;
        delete snapshot.recoveryRevision;
        delete snapshot.agentRunning;
        const saved = await post('/saveSession', snapshot, { checkpoint: true });
        if (saved?.session && typeof saved.session === 'object') return saved.session;
        if (turnID) return await post('/getSession', { id: text(session.id) });
        snapshot.revision = Number(saved?.revision) || snapshot.expectedRevision + 1;
        delete snapshot.expectedRevision;
        delete snapshot.commitTurnID;
        return snapshot;
    }

    async function commitRecoveredSessionTurn(session) {
        if (!text(session?.recoveryTurnID)) return session;
        return await persistSessionCheckpoint(session);
    }

    async function recoverConversationSession(sessionID, expectedTurnID = '') {
        const id = text(sessionID);
        if (!id) return null;
        for (const delay of [0, 150, 450]) {
            if (delay) await waitForKernelRecovery(delay);
            let session;
            try { session = await post('/getSession', { id }); }
            catch (error) { continue; }
            const recoveryTurnID = text(session?.recoveryTurnID);
            if (!recoveryTurnID || (expectedTurnID && recoveryTurnID !== expectedTurnID)) continue;
            try { return await commitRecoveredSessionTurn(session); }
            catch (error) { if (!isAgentSessionRevisionConflict(error)) throw error; }
        }
        return null;
    }

    async function prepareConversationTurn(sessionID, prompt, title, options = {}) {
        let id = text(sessionID) || newID();
        let session = null;
        try {
            session = await post('/getSession', { id });
        } catch (error) {
            if (!isMissingAgentSessionError(error)) throw error;
            if (options.replaceMissingSession === true) id = newID();
        }
        if (session?.agentRunning === true) throw new Error('智能体会话正在其他实例中执行');
        if (text(session?.recoveryTurnID)) {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    session = await commitRecoveredSessionTurn(session);
                    break;
                } catch (error) {
                    if (attempt > 0 || !isAgentSessionRevisionConflict(error)) throw error;
                    session = await post('/getSession', { id });
                }
            }
        }
        const userEntryID = newID();
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const now = Date.now();
            const entries = Array.isArray(session?.entries) ? clone(session.entries) : [];
            if (!entries.some((entry) => text(entry?.id) === userEntryID)) {
                entries.push({
                    id: userEntryID,
                    type: 'user',
                    content: prompt,
                    blockHTML: userEntryBlockHTML(options.displayPrompt || prompt),
                    ...(Array.isArray(options.references) && options.references.length ? { references: clone(options.references) } : {}),
                    ...(options.editorContext && typeof options.editorContext === 'object' ? { editorContext: clone(options.editorContext) } : {}),
                    timestamp: now,
                });
            }
            const next = {
                ...(session && typeof session === 'object' ? clone(session) : {}),
                id,
                title: text(session?.title || title) || SIYUAN_DEFAULT_SESSION_TITLE,
                titled: typeof options.titled === 'boolean' ? options.titled : session?.titled === true,
                entries,
                createdAt: Number(session?.createdAt) || now,
                updatedAt: now,
                expectedRevision: Number(session?.revision) || 0,
            };
            delete next.messages;
            delete next.commitTurnID;
            delete next.recoveryTurnID;
            delete next.recoveryState;
            delete next.recoveryRevision;
            delete next.agentRunning;
            try {
                const saved = await post('/saveSession', next, { checkpoint: true });
                rememberSession(id);
                const stored = saved?.session && typeof saved.session === 'object'
                    ? saved.session
                    : { ...next, revision: Number(saved?.revision) || next.expectedRevision + 1 };
                delete stored.expectedRevision;
                return {
                    sessionID: id,
                    session: stored,
                    entries: clone(stored.entries || entries),
                    userEntryID,
                    revision: Number(stored.revision) || Number(saved?.revision) || next.expectedRevision + 1,
                };
            } catch (error) {
                if (attempt > 0 || !isAgentSessionRevisionConflict(error)) throw error;
                session = await post('/getSession', { id });
                const latestEntries = Array.isArray(session?.entries) ? session.entries : [];
                if (latestEntries.some((entry) => text(entry?.id) === userEntryID)) {
                    rememberSession(id);
                    return {
                        sessionID: id,
                        session: clone(session),
                        entries: clone(latestEntries),
                        userEntryID,
                        revision: Number(session?.revision) || 0,
                    };
                }
            }
        }
        throw new Error('智能体会话保存失败');
    }

    async function finalizeAutomationConversation(sessionID, title, run = {}) {
        const id = text(sessionID);
        if (!id) return;
        await ensureStoreLoaded();
        rememberSession(id);
        try {
            const session = await post('/getSession', { id });
            if (session) {
                const desiredTitle = text(title);
                const currentTitle = text(session.title);
                if (desiredTitle && (session.titled !== true || !currentTitle || currentTitle === 'AI Agent' || currentTitle === DEFAULT_SESSION_TITLE || currentTitle.startsWith('定时：'))) {
                    session.title = desiredTitle;
                    session.titled = true;
                    session.updatedAt = Date.now();
                }
                const baseEntries = Array.isArray(run.baseEntries) ? clone(run.baseEntries) : [];
                const markdown = text(run.markdown);
                if (markdown) baseEntries.push({ id: newID(), type: 'assistant', content: markdown, timestamp: Date.now() });
                if (markdown) session.entries = baseEntries;
                session.updatedAt = Date.now();
                await persistSessionCheckpoint(session, run.turnID);
            }
        } catch (error) {}
        await listSessions();
        if (runtime.mounted) render();
    }

    function getDraft() {
        return String(runtime.store.drafts[runtime.activeSessionID || 'new'] || '');
    }

    function setDraft(value) {
        runtime.store.drafts[runtime.activeSessionID || 'new'] = String(value || '');
        scheduleSave();
    }

    function applyTaskToolCapabilityPolicy(capabilities) {
        const value = capabilities && typeof capabilities === 'object' ? capabilities : {};
        const policy = window.siyuan?.config?.ai?.agent?.capabilityPolicy;
        const overrides = policy?.overrides && typeof policy.overrides === 'object' ? policy.overrides : {};
        const defaultDecision = String(policy?.default || 'allow');
        const tools = (Array.isArray(value.toolGroups) ? value.toolGroups : [])
            .flatMap((group) => Array.isArray(group?.tools) ? group.tools : [])
            .filter((tool) => tool?.registered === true);
        const denied = tools.filter((tool) => String(overrides[`${TASK_HORIZON_BACKEND_CAPABILITY_PREFIX}${encodeURIComponent(text(tool?.name))}`] || defaultDecision) === 'deny');
        return {
            ...value,
            agentDeniedToolCount: denied.length,
            effectiveRegisteredToolCount: Math.max(0, tools.length - denied.length),
        };
    }

    async function getCapabilities() {
        const kernel = bridge().kernel || bridge().plugin?.kernel;
        const method = kernel?.rpc?.call?.taskHorizonGetCapabilities;
        if (typeof method !== 'function') {
            runtime.capabilities = {
                kernelAvailable: false,
                mcpAvailable: false,
                mcpEnabled: false,
                mcpAuthorized: false,
                registeredToolCount: 0,
                unavailableReason: 'kernel-rpc-missing',
            };
            return runtime.capabilities;
        }
        try {
            runtime.capabilities = applyTaskToolCapabilityPolicy(await kernelCall('taskHorizonGetCapabilities'));
        } catch (error) {
            runtime.capabilities = {
                kernelAvailable: false,
                mcpAvailable: false,
                mcpEnabled: false,
                mcpAuthorized: false,
                registeredToolCount: 0,
                unavailableReason: 'kernel-rpc-error',
                unavailableDetail: text(error?.message || error),
            };
        }
        try {
            const current = aiBridge()?.getSettings?.();
            if (current?.agentMcpAllowed !== true && runtime.capabilities.mcpEnabled === true) {
                await aiBridge()?.setAgentMcpEnabled?.(false);
                runtime.capabilities = applyTaskToolCapabilityPolicy(await kernelCall('taskHorizonGetCapabilities'));
            }
        } catch (error) {}
        return runtime.capabilities;
    }

    function stopCapabilityRetry() {
        clearTimeout(runtime.capabilityRetryTimer);
        runtime.capabilityRetryTimer = 0;
        runtime.capabilityRetrySeq += 1;
    }

    function shouldRetryCapabilities() {
        const settings = aiBridge()?.getSettings?.() || {};
        return runtime.mounted
            && settings.agentMcpEnabled === true
            && runtime.capabilities?.mcpEnabled !== true;
    }

    function startCapabilityRetry() {
        stopCapabilityRetry();
        if (!shouldRetryCapabilities()) return false;
        const sequence = runtime.capabilityRetrySeq;
        let attempts = 0;
        const retry = async () => {
            runtime.capabilityRetryTimer = 0;
            if (sequence !== runtime.capabilityRetrySeq || !shouldRetryCapabilities()) return;
            attempts += 1;
            await getCapabilities();
            if (sequence !== runtime.capabilityRetrySeq || !runtime.mounted) return;
            render();
            if (runtime.capabilities?.mcpEnabled === true) {
                await syncBuiltinSkills();
                return;
            }
            if (attempts < CAPABILITY_RETRY_LIMIT && shouldRetryCapabilities()) {
                runtime.capabilityRetryTimer = setTimeout(retry, CAPABILITY_RETRY_INTERVAL_MS);
            }
        };
        runtime.capabilityRetryTimer = setTimeout(retry, CAPABILITY_RETRY_INTERVAL_MS);
        return true;
    }

    function taskToolStatusText(caps = runtime.capabilities || {}) {
        if (caps.mcpEnabled) {
            const available = Number.isFinite(Number(caps.effectiveRegisteredToolCount))
                ? Number(caps.effectiveRegisteredToolCount)
                : (Number(caps.registeredToolCount) || 0);
            const denied = Number(caps.agentDeniedToolCount) || 0;
            return `${available} 个任务工具可用${denied ? ` · ${denied} 个被思源关闭` : ''}${runtime.skillSync.installed ? ` · ${BUILTIN_SKILL_NAMES.length} 个工作流程` : ''}`;
        }
        if (caps.kernelAvailable !== true) return caps.unavailableReason === 'kernel-rpc-error' ? '任务工具内核连接失败' : '任务工具内核未加载';
        if (caps.mcpAvailable !== true) return '当前思源内核未提供 MCP';
        if (aiBridge()?.getSettings?.()?.agentMcpAllowed !== true) return '文档对话模式 · 任务工具未授权';
        return '文档对话模式 · 任务工具未启用';
    }

    async function setToolsEnabled(enabled) {
        stopCapabilityRetry();
        const settings = aiBridge()?.getSettings?.() || {};
        if (enabled === true && settings.agentMcpAllowed !== true) {
            runtime.statusText = '任务工具属于全功能权益，当前保持文档对话模式';
            render();
            return false;
        }
        runtime.statusText = enabled ? '正在启用任务工具...' : '正在停用任务工具...';
        render();
        try {
            if (typeof aiBridge()?.setAgentMcpEnabled === 'function') {
                await aiBridge().setAgentMcpEnabled(enabled === true, { syncAgentPolicy: true });
                runtime.capabilities = applyTaskToolCapabilityPolicy(await kernelCall('taskHorizonGetCapabilities'));
            } else {
                runtime.capabilities = await kernelCall('taskHorizonSetMcpEnabled', enabled === true);
            }
            runtime.store.toolsOnboardingDismissed = enabled !== true;
            scheduleSave();
            if (enabled === true && runtime.capabilities.mcpEnabled === true) await syncBuiltinSkills();
        } finally {
            runtime.statusText = '';
            render();
        }
    }

    async function ensureTaskToolsReadyForSend() {
        const settings = aiBridge()?.getSettings?.() || {};
        if (settings.agentMcpEnabled !== true) return true;
        let capabilities = await getCapabilities();
        if (capabilities?.mcpEnabled === true) return true;
        if (settings.agentMcpAllowed === true
            && capabilities?.kernelAvailable === true
            && capabilities?.mcpAvailable === true
            && typeof aiBridge()?.setAgentMcpEnabled === 'function') {
            try {
                await aiBridge().setAgentMcpEnabled(true);
                capabilities = await getCapabilities();
            } catch (error) {}
        }
        if (capabilities?.mcpEnabled === true) return true;
        runtime.statusText = capabilities?.unavailableDetail
            ? `任务工具连接恢复失败：${capabilities.unavailableDetail}`
            : '任务工具正在恢复，请稍后重试';
        startCapabilityRetry();
        render();
        return false;
    }

    async function hashContent(content) {
        const value = String(content || '');
        if (globalThis.crypto?.subtle && typeof TextEncoder === 'function') {
            try {
                const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
                return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, '0')).join('');
            } catch (error) {}
        }
        let first = 0x811c9dc5;
        let second = 0x9e3779b9;
        for (let index = 0; index < value.length; index += 1) {
            const code = value.charCodeAt(index);
            first = Math.imul(first ^ code, 0x01000193) >>> 0;
            second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
        }
        return `fallback:${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}:${value.length}`;
    }

    async function loadBundledSkill(name) {
        const path = `${SKILL_ROOT}/${encodeURIComponent(name)}/SKILL.md`;
        const response = await fetch('/api/file/getFile', {
            method: 'POST',
            headers: agentHeaders(),
            body: JSON.stringify({ path }),
        });
        const content = await response.text();
        if (!response.ok || response.status !== 200) {
            let message = '';
            try {
                const payload = JSON.parse(content);
                message = text(payload?.msg || payload?.message);
            } catch (error) {}
            throw new Error(message || `无法读取内置工作流程 ${name}`);
        }
        return content;
    }

    async function loadInstalledSkill(name) {
        try {
            const data = await post('/getSkill', { name });
            return typeof data?.content === 'string' ? data.content : '';
        } catch (error) {
            if (/skill not found/i.test(String(error?.message || error))) return null;
            throw error;
        }
    }

    async function syncBuiltinSkills() {
        if (runtime.skillSync.busy) return runtime.skillSync;
        runtime.skillSync = { busy: true, installed: false, results: [], error: '' };
        runtime.statusText = '正在同步工作流程...';
        render();
        try {
            for (const name of BUILTIN_SKILL_NAMES) {
                const bundledContent = await loadBundledSkill(name);
                if (!text(bundledContent)) throw new Error(`内置工作流程 ${name} 内容为空`);
                const bundledHash = await hashContent(bundledContent);
                const trackedHash = text(runtime.store.builtinSkills?.[name]?.hash);
                const installedContent = await loadInstalledSkill(name);
                const installedHash = installedContent == null ? '' : await hashContent(installedContent);
                const installedBlank = installedContent != null && !text(installedContent);
                let status = 'unchanged';
                if (installedContent == null || installedBlank) {
                    await post('/saveSkill', { name, content: bundledContent });
                    status = installedBlank ? 'repaired' : 'installed';
                } else if (installedHash !== bundledHash && trackedHash && installedHash === trackedHash) {
                    await post('/saveSkill', { name, content: bundledContent });
                    status = 'updated';
                } else if (installedHash !== bundledHash) {
                    status = 'preserved';
                }
                runtime.store.builtinSkills[name] = { version: 2, hash: bundledHash };
                runtime.skillSync.results.push({ name, status });
            }
            runtime.skillSync.installed = runtime.skillSync.results.length === BUILTIN_SKILL_NAMES.length;
            scheduleSave();
        } catch (error) {
            runtime.skillSync.error = text(error?.message || error) || '工作流程同步失败';
        } finally {
            runtime.skillSync.busy = false;
            runtime.statusText = '';
            render();
        }
        return runtime.skillSync;
    }

    function createSession() {
        const id = newID();
        runtime.activeSessionID = id;
        runtime.session = { id, title: DEFAULT_SESSION_TITLE, titled: false, entries: [], createdAt: Date.now(), updatedAt: Date.now() };
        runtime.live = null;
        runtime.conversationFollowBottom = true;
        runtime.historyOpen = false;
        rememberSession(id);
        runtime.store.activeSessionID = id;
        scheduleSave();
        render();
        return runtime.session;
    }

    function currentSessionHeaderTitle() {
        const title = text(runtime.session?.title);
        if (runtime.session?.titled === false || !title || title === DEFAULT_SESSION_TITLE || title === SIYUAN_DEFAULT_SESSION_TITLE) {
            return '任务智能体';
        }
        return title;
    }

    async function listSessions() {
        try {
            const first = await post('/lsSessions', { page: 1, pageSize: SESSION_LIST_PAGE_SIZE, keyword: '' });
            const sessions = Array.isArray(first?.sessions) ? first.sessions.slice() : [];
            const pageCount = Math.ceil(Math.max(sessions.length, Number(first?.total) || 0) / SESSION_LIST_PAGE_SIZE);
            for (let page = 2; page <= pageCount; page += 1) {
                const data = await post('/lsSessions', { page, pageSize: SESSION_LIST_PAGE_SIZE, keyword: '' });
                if (Array.isArray(data?.sessions)) sessions.push(...data.sessions);
            }
            runtime.sessions = sessions;
        } catch (error) {
            runtime.sessions = [];
        }
        return runtime.sessions;
    }

    async function loadSession(id) {
        const sessionID = text(id);
        if (!sessionID) return createSession();
        try {
            const session = await post('/getSession', { id: sessionID });
            if (!session) return createSession();
            runtime.activeSessionID = sessionID;
            if (typeof session.titled !== 'boolean') {
                const savedTitle = text(session.title);
                session.titled = Boolean(savedTitle && savedTitle !== DEFAULT_SESSION_TITLE && savedTitle !== SIYUAN_DEFAULT_SESSION_TITLE);
            }
            runtime.session = session;
            runtime.live = null;
            runtime.conversationFollowBottom = true;
            rememberSession(sessionID);
            runtime.historyOpen = false;
            scheduleSave();
            render();
            return session;
        } catch (error) {
            return createSession();
        }
    }

    async function saveSession(commitTurnID = '') {
        if (!runtime.session || !runtime.activeSessionID) return null;
        const sessionID = runtime.activeSessionID;
        const fallback = clone(runtime.session);
        const requestedTurnID = text(commitTurnID);
        const persist = async () => {
            const source = runtime.activeSessionID === sessionID && runtime.session ? runtime.session : fallback;
            const entries = sessionEntries(source);
            if (!entries.length) return source;
            const snapshot = {
                ...clone(source),
                id: sessionID,
                title: text(source.title) || DEFAULT_SESSION_TITLE,
                titled: source.titled !== false,
                entries: clone(entries),
                createdAt: Number(source.createdAt) || Date.now(),
                updatedAt: Date.now(),
            };
            const turnID = text(requestedTurnID || source.recoveryTurnID);
            const next = await persistSessionCheckpoint(snapshot, turnID);
            if (runtime.activeSessionID === sessionID) runtime.session = next;
            return next;
        };
        const previous = runtime.sessionSaveQueues.get(sessionID);
        const pending = previous ? previous.catch(() => null).then(persist) : persist();
        runtime.sessionSaveQueues.set(sessionID, pending);
        try {
            return await pending;
        } finally {
            if (runtime.sessionSaveQueues.get(sessionID) === pending) runtime.sessionSaveQueues.delete(sessionID);
        }
    }

    function showSessionNotice(message, type = 'info') {
        const value = text(message);
        if (!value) return;
        try {
            if (typeof aiBridge()?.hint === 'function') {
                aiBridge().hint(value, type);
                return;
            }
        } catch (error) {}
        runtime.statusText = value;
        render();
    }

    function beginSessionRename(id, trigger) {
        const sessionID = text(id);
        const session = runtime.sessions.find((item) => text(item?.id) === sessionID);
        const row = trigger?.closest?.('.tm-agent-history__row');
        const main = row?.querySelector?.('.tm-agent-history__main');
        if (!session || !(row instanceof HTMLElement) || !(main instanceof HTMLElement)) return;
        const title = text(session.title) || DEFAULT_SESSION_TITLE;
        const form = document.createElement('form');
        form.className = 'tm-agent-history__rename';
        form.dataset.agentSessionRename = sessionID;
        form.innerHTML = `<input class="b3-text-field b3-text-field--small" name="title" value="${esc(title)}" aria-label="会话名称"><button type="submit" class="block__icon" aria-label="保存会话名称"><svg><use xlink:href="#iconSelect"></use></svg></button><button type="button" class="block__icon" data-agent-action="cancel-session-rename" aria-label="取消重命名"><svg><use xlink:href="#iconClose"></use></svg></button>`;
        main.replaceWith(form);
        row.classList.add('is-renaming');
        const input = form.elements?.title;
        input?.focus?.();
        input?.select?.();
    }

    async function renameSession(id, value) {
        const sessionID = text(id);
        const title = text(value);
        if (!sessionID || !title) {
            showSessionNotice('会话名称不能为空', 'warning');
            return false;
        }
        if (sessionID === runtime.activeSessionID && runtime.busy) {
            showSessionNotice('当前会话正在处理，请完成后再重命名', 'warning');
            return false;
        }
        try {
            const session = await post('/getSession', { id: sessionID });
            if (!session) throw new Error('会话不存在');
            if (session.agentRunning === true) throw new Error('会话正在其他实例中处理');
            const next = {
                ...session,
                title,
                titled: true,
                updatedAt: Date.now(),
                expectedRevision: Number(session.revision) || 0,
            };
            const result = await post('/saveSession', next);
            delete next.expectedRevision;
            next.revision = Number(result?.revision) || Number(session.revision) || 0;
            if (sessionID === runtime.activeSessionID) runtime.session = next;
            await listSessions();
            render();
            return true;
        } catch (error) {
            showSessionNotice(`重命名失败：${text(error?.message || error)}`, 'error');
            return false;
        }
    }

    function tryGenerateSessionTitle() {
        if (!runtime.session || runtime.session.titled !== false) return;
        const firstUserEntry = sessionEntries().find((entry) => entry?.type === 'user' && userEntryText(entry));
        const message = userEntryText(firstUserEntry).slice(0, 500);
        if (!message) return;
        const sessionID = runtime.activeSessionID;
        runtime.session.titled = true;
        void post('/title', {
            message,
            model: '',
            language: window.siyuan?.config?.appearance?.lang || 'zh_CN',
        }).then(async (generatedTitle) => {
            const title = text(generatedTitle);
            if (!title || runtime.activeSessionID !== sessionID || !runtime.session) return;
            const currentTitle = text(runtime.session.title);
            if (currentTitle && currentTitle !== DEFAULT_SESSION_TITLE) return;
            runtime.session.title = title;
            if (runtime.busy) return;
            await saveSession();
            await listSessions();
            render();
        }).catch(() => {});
    }

    async function removeSession(id) {
        const sessionID = text(id);
        if (!sessionID) return false;
        if (sessionID === runtime.activeSessionID && runtime.busy) {
            showSessionNotice('当前会话正在处理，暂时无法删除', 'warning');
            return false;
        }
        try {
            if (runtime.activeSessionID === sessionID) {
                const next = runtime.sessions.find((item) => text(item?.id) && text(item.id) !== sessionID);
                if (next) await loadSession(next.id);
                else createSession();
            }
            await post('/removeSession', { id: sessionID });
            runtime.store.sessionIDs = runtime.store.sessionIDs.filter((item) => item !== sessionID);
            delete runtime.store.drafts[sessionID];
            await listSessions();
            scheduleSave();
            render();
            return true;
        } catch (error) {
            showSessionNotice(`删除失败：${text(error?.message || error)}`, 'error');
            return false;
        }
    }

    function sessionEntries(session = runtime.session) {
        const entries = Array.isArray(session?.entries) ? session.entries : [];
        const messages = Array.isArray(session?.messages) ? session.messages : [];
        if (entries.length >= messages.length) return entries;
        return messages.map((message) => ({
            id: newID(),
            type: message.role === 'user' ? 'user' : 'assistant',
            content: String(message.content || ''),
            toolCalls: message.toolCalls,
        }));
    }

    function renderToolCall(call) {
        const name = normalizeToolName(toolCallName(call));
        const result = typeof call?.result === 'string' ? call.result : (call?.result == null ? '' : JSON.stringify(call.result));
        const completed = toolCallCompleted(call);
        if (name === 'todo_write') return renderTodoCall(call, completed);
        return `<details class="tm-agent-tool" ${completed ? '' : 'open'}>
            <summary><svg aria-hidden="true"><use xlink:href="#iconTools"></use></svg><span>${esc(name || '工具调用')}</span><span class="tm-agent-tool__state">${completed ? '已完成' : '执行中'}</span></summary>
            ${result ? renderDomainResult(name, result, call) : ''}
        </details>`;
    }

    function toolCallCompleted(call) {
        if (call?.completed === true) return true;
        return Object.prototype.hasOwnProperty.call(call || {}, 'result') && call?.result !== '' && call?.result != null;
    }

    function renderToolGroup(calls, completedResponse) {
        const items = Array.isArray(calls) ? calls.filter((call) => !isTodoToolCall(call)) : [];
        if (!items.length) return '';
        const completedCount = items.filter(toolCallCompleted).length;
        const completed = completedResponse === true;
        return `<details class="tm-agent-tool-group" ${completed ? '' : 'open'}>
            <summary class="tm-agent-tool-group__header">
                <svg class="tm-agent-tool-group__icon" aria-hidden="true"><use xlink:href="#iconTools"></use></svg>
                <span class="tm-agent-tool-group__title">执行过程</span>
                <span class="tm-agent-tool-group__state">${completed ? '已完成' : `${completedCount}/${items.length}`}</span>
                <svg class="tm-agent-tool-group__caret" aria-hidden="true"><use xlink:href="#iconRight"></use></svg>
            </summary>
            <div class="tm-agent-tool-group__items">${items.map(renderToolCall).join('')}</div>
        </details>`;
    }

    function toolCallName(call) {
        if (typeof call === 'string') return call;
        return call?.name || call?.toolName || call?.tool_name || call?.function?.name || '';
    }

    const TASK_HORIZON_READ_ONLY_TOOLS = new Set([
        'list_task_scopes', 'get_task', 'query_tasks', 'query_schedules',
        'get_task_policy', 'preview_task_policy_patch', 'aggregate_task_stats', 'aggregate_time_usage',
    ]);
    const TASK_HORIZON_MIXED_READ_TOOLS = new Set([
        'manage_agent_schedules', 'delete_task', 'batch_tasks', 'delete_schedule', 'batch_schedules',
    ]);

    function normalizeToolName(name) {
        const raw = text(name).toLowerCase();
        const prefix = TASK_HORIZON_TOOL_PREFIXES.find((item) => raw.startsWith(item));
        const localName = prefix ? raw.slice(prefix.length) : raw;
        return prefix ? localName.replace(/__[0-9a-f]{12}$/, '') : localName;
    }

    function isTaskHorizonToolName(name) {
        const raw = text(name).toLowerCase();
        return !raw.includes('__') || TASK_HORIZON_TOOL_PREFIXES.some((prefix) => raw.startsWith(prefix));
    }

    function isTodoToolCall(call) {
        return normalizeToolName(toolCallName(call)) === 'todo_write';
    }

    function todoResultText(result) {
        let value = result;
        if (typeof value === 'string') {
            const raw = value;
            try { value = JSON.parse(raw); } catch (error) { return raw; }
        }
        if (value && Array.isArray(value.content)) {
            return value.content
                .filter((item) => item?.type === 'text' && typeof item.text === 'string')
                .map((item) => item.text)
                .join('\n');
        }
        if (value && typeof value.result === 'string') return value.result;
        if (value && typeof value.text === 'string') return value.text;
        return '';
    }

    function todoArguments(call) {
        let value = call?.arguments ?? call?.args ?? call?.function?.arguments;
        if (typeof value === 'string') {
            try { value = JSON.parse(value); } catch (error) { value = null; }
        }
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function parseTodoItems(call) {
        const items = [];
        const result = todoResultText(call?.result);
        result.split(/\r?\n/).forEach((line) => {
            const match = line.match(/^\s*-\s*\[([xX/\- ])\]\s*(.+?)\s*$/);
            if (!match) return;
            const marker = match[1].toLowerCase();
            const status = marker === 'x' ? 'completed' : (marker === '/' ? 'in_progress' : (marker === '-' ? 'cancelled' : 'pending'));
            items.push({ content: text(match[2]), status });
        });
        if (items.length) return items;
        const args = todoArguments(call);
        const todos = Array.isArray(args.todos) ? args.todos : [];
        return todos.map((item) => ({
            content: text(item?.content || item?.text || item?.activeForm),
            status: ['completed', 'in_progress', 'cancelled'].includes(text(item?.status).toLowerCase())
                ? text(item.status).toLowerCase()
                : 'pending',
        })).filter((item) => item.content);
    }

    function renderTodoCall(call, completedResponse) {
        const items = parseTodoItems(call);
        const completedCount = items.filter((item) => item.status === 'completed').length;
        const statusIcon = (status) => status === 'completed'
            ? 'iconCheck'
            : (status === 'in_progress' ? 'iconRefresh' : (status === 'cancelled' ? 'iconCloseRound' : 'iconUncheck'));
        return `<details class="tm-agent-todo agent-chat__tool-card agent-chat__tool-card--todo" ${completedResponse ? '' : 'open'}>
            <summary class="tm-agent-todo__header agent-chat__todo-header">
                <svg class="tm-agent-todo__title-icon agent-chat__tool-icon" aria-hidden="true"><use xlink:href="#iconList"></use></svg>
                <span class="tm-agent-todo__title agent-chat__tool-title">任务清单</span>
                <span class="tm-agent-todo__progress">${completedCount}/${items.length}</span>
                <svg class="tm-agent-todo__caret" aria-hidden="true"><use xlink:href="#iconRight"></use></svg>
            </summary>
            <div class="tm-agent-todo__items agent-chat__todo-items">${items.map((item) => `<div class="tm-agent-todo__item tm-agent-todo__item--${esc(item.status.replace('_', '-'))} agent-chat__todo-item agent-chat__todo-item--${esc(item.status.replace('_', '-'))}"><svg class="tm-agent-todo__status agent-chat__todo-status" aria-hidden="true"><use xlink:href="#${statusIcon(item.status)}"></use></svg><span>${esc(item.content)}</span></div>`).join('') || '<div class="tm-agent-todo__empty">暂无任务</div>'}</div>
        </details>`;
    }

    function parseDomainResult(result) {
        let value = result;
        if (typeof value === 'string') {
            const raw = value.trim();
            const wrapped = raw.match(/^\[tool_output\]\s*([\s\S]*?)\s*\[\/tool_output\]$/);
            try { value = JSON.parse(wrapped ? wrapped[1] : raw); } catch (error) { return null; }
        }
        if (value && Array.isArray(value.content)) {
            const block = value.content.find((item) => item?.type === 'text' && typeof item.text === 'string');
            if (block) {
                try { value = JSON.parse(block.text); } catch (error) {}
            }
        }
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        return value.ok === true ? value.data : value;
    }

    function collectTaskMutationRefresh(result) {
        const tasks = new Map();
        const taskIDs = new Set();
        const documentIDs = new Set();
        const deletedTaskIDs = new Set();
        let found = false;
        let requiresDocumentReload = false;
        const addIDs = (target, values) => {
            (Array.isArray(values) ? values : [values]).forEach((value) => {
                const id = text(value);
                if (id) target.add(id);
            });
        };
        const visit = (value) => {
            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }
            if (!value || typeof value !== 'object') return;
            const refresh = value.refresh;
            if (refresh?.kind === 'task-mutation' || refresh?.kind === 'task-reminder') {
                found = true;
                addIDs(taskIDs, refresh.taskIDs || refresh.taskID);
                addIDs(documentIDs, refresh.documentIDs || refresh.documentID);
                if (['create', 'move', 'delete'].includes(text(refresh.action))) requiresDocumentReload = true;
                if (text(refresh.action) === 'delete') addIDs(deletedTaskIDs, refresh.taskIDs || refresh.taskID);
                const task = value.task;
                const taskID = text(task?.id);
                if (taskID) tasks.set(taskID, task);
            }
            visit(value.changes);
            visit(value.data);
            visit(value.items);
        };
        visit(result);
        return found ? {
            tasks: Array.from(tasks.values()),
            taskIDs: Array.from(taskIDs),
            documentIDs: Array.from(documentIDs),
            deletedTaskIDs: Array.from(deletedTaskIDs),
            requiresDocumentReload,
        } : null;
    }

    const SCHEDULE_MUTATION_TOOLS = new Set([
        'create_schedule', 'update_schedule', 'delete_schedule', 'batch_schedules', 'apply_task_operation_plan',
    ]);

    function containsScheduleMutation(value, seen = new Set()) {
        if (Array.isArray(value)) return value.some((item) => containsScheduleMutation(item, seen));
        if (!value || typeof value !== 'object' || seen.has(value)) return false;
        seen.add(value);
        if (text(value.kind).startsWith('schedule:') || text(value.deletedScheduleID)) return true;
        if (value.schedule && typeof value.schedule === 'object' && text(value.schedule.id || value.schedule.start)) return true;
        return containsScheduleMutation(value.changes, seen)
            || containsScheduleMutation(value.data, seen)
            || containsScheduleMutation(value.items, seen);
    }

    async function applyDomainResultEffects(name, result) {
        const parsed = parseDomainResult(result);
        if (!parsed || parsed.ok === false) return;
        const refresh = collectTaskMutationRefresh(parsed);
        if (refresh) {
            try { await aiBridge()?.refreshTaskMutation?.(refresh); } catch (error) {}
        }
        const toolName = normalizeToolName(name);
        if ((SCHEDULE_MUTATION_TOOLS.has(toolName) || toolName === 'undo_last_mutation') && containsScheduleMutation(parsed)) {
            try { await aiBridge()?.refreshScheduleMutation?.({ reason: `ai-${toolName}` }); } catch (error) {}
        }
        if (toolName !== 'configure_task_reminder') return;
        const taskID = text(parsed.taskID || parsed.task?.id);
        if (!taskID) return;
        const value = parsed.hasReminder && parsed.reminder ? JSON.stringify(parsed.reminder) : '';
        const detail = { taskId: taskID, source: 'task-horizon-agent-reminder' };
        try {
            window.dispatchEvent(new CustomEvent('tm-task-attr-updated', {
                detail: { ...detail, attrKey: 'custom-tomato-reminder', value },
            }));
            window.dispatchEvent(new CustomEvent('tm-task-attr-updated', {
                detail: { ...detail, attrKey: 'bookmark', value: parsed.hasReminder ? '⏰' : '' },
            }));
            if (parsed.completionChanged === true) {
                window.dispatchEvent(new CustomEvent('tm-task-attr-updated', {
                    detail: { ...detail, attrKey: 'custom-completion-time', value: parsed.completionTime || '' },
                }));
            }
            window.dispatchEvent(new CustomEvent('tomato-reminder-updated', {
                detail: { ...detail, blockId: parsed.attrHostID, reminder: parsed.reminder || null, value },
            }));
        } catch (error) {}
        try { globalThis.__tomatoReminder?.refresh?.(); } catch (error) {}
        try { globalThis.__tomatoUpdateReminderBadge?.(); } catch (error) {}
        try {
            globalThis.__tmBasecoat?.toast?.({
                title: parsed.hasReminder ? '任务提醒创建完成' : '任务提醒已清除',
                variant: 'success',
                duration: 2500,
            });
        } catch (error) {}
    }

    function toolArgumentsObject(call) {
        let value = call?.arguments ?? call?.args ?? call?.function?.arguments;
        if (typeof value === 'string') {
            try { value = JSON.parse(value); } catch (error) { value = null; }
        }
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function failedRetryPayload(call) {
        const name = normalizeToolName(toolCallName(call));
        if (!['batch_tasks', 'batch_schedules', 'apply_task_operation_plan'].includes(name)) return null;
        const receipt = parseDomainResult(call?.result);
        if (!receipt || !Array.isArray(receipt.items)) return null;
        const args = toolArgumentsObject(call);
        if (name === 'batch_tasks' || name === 'batch_schedules') {
            const operations = Array.isArray(args.operations) ? args.operations : [];
            const failed = operations.filter((operation, index) => {
                const item = receipt.items[index];
                return item && item.ok !== true && item.skipped !== true;
            });
            return failed.length ? { name, args: { operations: failed } } : null;
        }
        const taskItems = receipt.items.filter((item) => text(item?.kind).startsWith('task:'));
        const scheduleItems = receipt.items.filter((item) => text(item?.kind).startsWith('schedule:'));
        const taskOperations = (Array.isArray(args.taskOperations) ? args.taskOperations : []).filter((operation, index) => {
            const item = taskItems[index];
            return item && item.ok !== true && item.skipped !== true;
        });
        const scheduleOperations = (Array.isArray(args.scheduleOperations) ? args.scheduleOperations : []).filter((operation, index) => {
            const item = scheduleItems[index];
            return item && item.ok !== true && item.skipped !== true;
        });
        return taskOperations.length || scheduleOperations.length
            ? { name, args: { taskOperations, scheduleOperations } }
            : null;
    }

    function findToolCall(callID) {
        const id = text(callID);
        const calls = [];
        (Array.isArray(runtime.session?.entries) ? runtime.session.entries : []).forEach((entry) => {
            if (Array.isArray(entry?.toolCalls)) calls.push(...entry.toolCalls);
        });
        if (Array.isArray(runtime.live?.toolCalls)) calls.push(...runtime.live.toolCalls);
        return calls.find((call) => text(call?.callID || call?.callId || call?.id) === id) || null;
    }

    async function retryFailedToolCall(callID) {
        if (runtime.busy) return;
        const retry = failedRetryPayload(findToolCall(callID));
        if (!retry) {
            runtime.statusText = '没有可重试的失败项';
            render();
            return;
        }
        const instruction = retry.name === 'apply_task_operation_plan'
            ? '先展示这些失败项的新预览，再调用组合操作工具；不要重复已经成功的项目。'
            : '先重新调用预览阶段，再只执行这些失败项；不要重复已经成功的项目。';
        setDraft(`只重试上一批中的失败项。${instruction}\n工具：${retry.name}\n参数：${JSON.stringify(retry.args)}`);
        await sendMessage();
    }

    function canUndoToolResult(name, result) {
        const toolName = normalizeToolName(name);
        const reversibleTools = new Set(['create_task', 'update_task', 'move_task', 'batch_tasks', 'create_schedule', 'update_schedule', 'batch_schedules', 'apply_task_operation_plan']);
        if (!reversibleTools.has(toolName)) return false;
        const parsed = parseDomainResult(result);
        if (!parsed || parsed.ok === false) return false;
        if (Array.isArray(parsed.items)) {
            const successful = parsed.items.filter((item) => item?.ok === true);
            return successful.length > 0 && successful.every((item) => item.reversible !== false);
        }
        return true;
    }

    function toolResultUndoID(result) {
        return text(parseDomainResult(result)?.undoID);
    }

    function clearUndoAvailability() {
        runtime.undoAvailable = false;
        runtime.undoID = '';
        runtime.undoCount = 0;
        (Array.isArray(runtime.session?.entries) ? runtime.session.entries : []).forEach((entry) => {
            (Array.isArray(entry?.toolCalls) ? entry.toolCalls : []).forEach((call) => { call.undoAvailable = false; });
        });
        (Array.isArray(runtime.live?.toolCalls) ? runtime.live.toolCalls : []).forEach((call) => { call.undoAvailable = false; });
    }

    function registerRoundUndo(undoID) {
        const id = text(undoID);
        if (!id) return;
        if (!runtime.roundUndoIDs.length) clearUndoAvailability();
        if (!runtime.roundUndoIDs.includes(id)) runtime.roundUndoIDs.push(id);
        runtime.undoID = id;
        runtime.undoCount = runtime.roundUndoIDs.length;
        runtime.undoAvailable = true;
    }

    async function finalizeRoundUndoBatch() {
        const undoIDs = runtime.roundUndoIDs.slice();
        runtime.roundUndoIDs = [];
        if (undoIDs.length <= 1) return '';
        try {
            const grouped = await kernelCall('taskHorizonGroupUndoMutations', {
                undoIDs,
                label: '撤销本轮 AI 操作',
            });
            runtime.undoID = text(grouped?.undoID) || undoIDs[undoIDs.length - 1];
            runtime.undoCount = Number(grouped?.count) || undoIDs.length;
            runtime.undoAvailable = true;
            return '';
        } catch (error) {
            clearUndoAvailability();
            return `整体撤销准备失败：${text(error?.message || error)}`;
        }
    }

    function renderResultRows(rows) {
        return `<div class="tm-agent-result__rows">${rows.map((row) => `<div><span>${esc(row.label)}</span><strong>${esc(row.value)}</strong></div>`).join('')}</div>`;
    }

    function formatMinutes(value) {
        const minutes = Math.max(0, Math.round(Number(value) || 0));
        if (minutes < 60) return `${minutes} 分钟`;
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
    }

    function renderBreakdown(title, items) {
        const rows = Array.isArray(items) ? items.filter((item) => item && Number(item.count) > 0).slice(0, 10) : [];
        if (!rows.length) return '';
        return `<section class="tm-agent-result__breakdown"><strong>${esc(title)}</strong>${rows.map((item) => `<div><span>${esc(item.key || '未设置')}</span><b>${Number(item.count) || 0}</b></div>`).join('')}</section>`;
    }

    function renderStatsBreakdowns(parsed) {
        const sections = [
            renderBreakdown('文档', parsed.byDocument),
            renderBreakdown('状态', parsed.byStatus),
            renderBreakdown('重要性', parsed.byPriority),
            ...(Array.isArray(parsed.byCustomField) ? parsed.byCustomField.map((field) => renderBreakdown(field.label || field.fieldID, field.items)) : []),
        ].filter(Boolean);
        if (!sections.length) return '';
        return `<details class="tm-agent-result__breakdowns"><summary>查看分组明细</summary><div>${sections.join('')}</div></details>`;
    }

    function renderDomainResult(name, result, call = null) {
        const parsed = parseDomainResult(result);
        if (!parsed) return `<pre>${esc(result)}</pre>`;
        if (parsed.ok === false && parsed.error) {
            return `<div class="tm-agent-result tm-agent-result--error"><strong>${esc(parsed.error.code || '操作失败')}</strong><span>${esc(parsed.error.message || '')}</span></div>`;
        }
        const receipt = parsed.summary && Array.isArray(parsed.items) ? parsed : null;
        if (receipt) {
            const summary = receipt.summary || {};
            const retry = failedRetryPayload(call);
            const retryAction = retry
                ? `<div class="tm-agent-result__actions"><button type="button" class="b3-button b3-button--cancel" data-agent-action="retry-failed" data-id="${esc(call?.callID || call?.callId || call?.id || '')}">只重试失败项</button></div>`
                : '';
            return `<div class="tm-agent-result">${renderResultRows([
                { label: '成功', value: Number(summary.succeeded) || 0 },
                { label: '失败', value: Number(summary.failed) || 0 },
                { label: '跳过', value: Number(summary.skipped) || 0 },
            ])}<div class="tm-agent-result__items">${receipt.items.slice(0, 20).map((item) => `<div class="${item.ok ? 'is-success' : 'is-error'}"><span>${esc(item.targetLabel || item.targetID || item.kind)}</span><small>${esc(item.ok ? '已完成' : (item.error?.message || '失败'))}</small></div>`).join('')}</div>${retryAction}</div>`;
        }
        if (name === 'aggregate_task_stats' || Object.prototype.hasOwnProperty.call(parsed, 'totalCompleted')) {
            const trend = Array.isArray(parsed.trend) ? parsed.trend : [];
            const max = Math.max(1, ...trend.map((item) => Number(item.count) || 0));
            const coverage = parsed.coverage || {};
            return `<div class="tm-agent-result">${renderResultRows([
                { label: '完成任务', value: Number(parsed.totalCompleted) || 0 },
                { label: '统计周期', value: parsed.period || 'month' },
                { label: '缺少完成时间', value: Number(coverage.missingCompletionTime) || 0 },
            ])}${trend.length ? `<div class="tm-agent-result__trend">${trend.slice(-24).map((item) => `<div><span>${esc(item.key)}</span><i style="--tm-agent-bar:${Math.max(2, Math.round(((Number(item.count) || 0) / max) * 100))}%"></i><strong>${Number(item.count) || 0}</strong></div>`).join('')}</div>` : '<div class="tm-agent-result__empty">当前范围没有可绘制的完成时间</div>'}${renderStatsBreakdowns(parsed)}</div>`;
        }
        if (name === 'aggregate_time_usage' || (parsed.estimated && parsed.planned && parsed.actual)) {
            return `<div class="tm-agent-result">${renderResultRows([
                { label: '预估', value: parsed.estimated?.available ? formatMinutes(parsed.estimated.minutes) : '无数据' },
                { label: '计划', value: parsed.planned?.available ? formatMinutes(parsed.planned.minutes) : '无数据' },
                { label: '番茄实际', value: parsed.actual?.available ? formatMinutes(parsed.actual.minutes) : '无数据' },
            ])}<details class="tm-agent-result__availability"><summary>查看数据覆盖</summary><div>${[
                ['预估', parsed.estimated], ['计划', parsed.planned], ['番茄实际', parsed.actual],
            ].map(([label, item]) => `<p><span>${label}</span><b>${Number(item?.availableCount) || 0} 条可用</b><small>${Number(item?.missingCount) || 0} 条缺失</small></p>`).join('')}</div></details></div>`;
        }
        if (normalizeToolName(name) === 'configure_task_reminder') {
            const preview = !!parsed.previewToken;
            const reminder = preview ? parsed.next : parsed.reminder;
            const mode = text(parsed.mode || (reminder?.repeatMode === 'followTaskRepeat' ? 'follow_task' : (reminder ? 'independent' : '')));
            return `<div class="tm-agent-result">${renderResultRows([
                { label: '任务', value: parsed.taskTitle || parsed.taskID || '' },
                { label: '任务来源', value: parsed.taskReused ? (parsed.taskMatchType === 'fuzzy' ? '已绑定相似任务' : '已绑定同名任务') : (parsed.taskCreated ? '已新建任务' : '当前任务') },
                { label: '操作', value: parsed.operation === 'clear' ? '清除提醒' : (preview ? '设置提醒预览' : '提醒已设置') },
                { label: '模式', value: mode === 'follow_task' ? '跟随截止日期' : (mode === 'independent' ? '独立提醒' : '无') },
                { label: '时间', value: reminder ? `${reminder.startDate || ''} ${(reminder.times || []).join('、')}`.trim() : '无' },
            ])}</div>`;
        }
        if (Array.isArray(parsed.changes)) {
            return `<div class="tm-agent-result"><div class="tm-agent-result__items">${parsed.changes.map((item) => `<div><span>${esc(item.path || '字段')}</span><small>${esc(`${JSON.stringify(item.before ?? null)} → ${JSON.stringify(item.after ?? null)}`)}</small></div>`).join('') || '<div><span>没有变化</span></div>'}</div></div>`;
        }
        const items = Array.isArray(parsed.items) ? parsed.items : null;
        if (items && items.length) {
            return `<div class="tm-agent-result"><div class="tm-agent-result__items">${items.slice(0, 50).map((item) => `<div><span>${esc(item.title || item.name || item.id || '结果')}</span><small>${esc(item.documentName || item.start || item.path || '')}</small></div>`).join('')}</div></div>`;
        }
        const task = parsed.task && typeof parsed.task === 'object' ? parsed.task : (parsed.id && parsed.title ? parsed : null);
        if (task) return `<div class="tm-agent-result">${renderResultRows([{ label: '任务', value: task.title || task.id }, { label: '状态', value: task.done ? '已完成' : '未完成' }, { label: '文档', value: task.documentName || task.documentID || '' }])}</div>`;
        return `<pre>${esc(result)}</pre>`;
    }

    function renderMessageActions(index, copyable) {
        const copyButton = copyable
            ? `<button type="button" class="tm-agent-message__copy ariaLabel" data-position="north" data-agent-action="copy-message" data-index="${Number(index)}" aria-label="复制这条消息">${phosphorBoldContextIcon('copy')}</button>`
            : '';
        return copyButton ? `<div class="tm-agent-message__actions">${copyButton}</div>` : '';
    }

    function agentLanguage(key, fallback) {
        return text(globalThis.siyuan?.languages?.[key]) || fallback;
    }

    function renderConfirmEffects(effects) {
        const source = effects && typeof effects === 'object' ? effects : {};
        const items = [];
        if (source.dataEgress === true) items.push(agentLanguage('agentEffectDataEgress', '将向已配置的 API 提供商发送文档或图片数据'));
        if (source.externalCost === true) items.push(agentLanguage('agentEffectExternalCost', '可能产生外部 API 调用费用'));
        if (source.localWrite === true) items.push(agentLanguage('agentEffectLocalWrite', '将修改本地数据'));
        return items.length ? `<ul class="agent-chat__confirm-effects">${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '';
    }

    function agentToolCategory(name) {
        const categories = {
            block: 'agentCatBlock', document: 'agentCatDoc', notebook: 'agentCatNotebook', tag: 'agentCatTag',
            bookmark: 'agentCatBookmark', file: 'agentCatFile', asset: 'agentCatAsset', attr: 'agentCatAttr',
            dailynote: 'agentCatDailynote', import: 'agentCatImport', repo: 'agentCatRepo', history: 'agentCatHistory',
            sync: 'agentCatSync', database: 'agentCatDatabase',
        };
        const key = categories[text(name)];
        return key ? agentLanguage(key, text(name)) : agentLanguage('agentCatDefault', '任务');
    }

    function renderEntry(entry, index, options = {}) {
        const type = text(entry?.type);
        if (type === 'user') {
            const content = userEntryText(entry);
            return `<article class="tm-agent-message tm-agent-message--user"><div class="tm-agent-message__body">${esc(content)}</div>${renderMessageActions(index, content)}</article>`;
        }
        if (type === 'assistant') {
            const calls = Array.isArray(entry.toolCalls) ? entry.toolCalls : [];
            const todoCall = calls.filter(isTodoToolCall).pop();
            const todo = options.omitTodos === true || !todoCall ? '' : renderTodoCall(todoCall, true);
            const tools = options.omitTools === true
                ? ''
                : renderToolGroup(calls.filter((call) => !isTodoToolCall(call)), true);
            return `<article class="tm-agent-message tm-agent-message--assistant">${todo}${tools}<div class="tm-agent-message__body tm-agent-markdown b3-typography">${renderMarkdown(entry.content)}</div>${renderMessageActions(index, text(entry.content))}</article>`;
        }
        if (type === 'thinking') return `<div class="tm-agent-thinking"><svg aria-hidden="true"><use xlink:href="#iconSparkles"></use></svg><span>${esc(entry.content || entry.reasoning || '正在思考')}</span></div>`;
        if (type === 'confirm') {
            const status = text(entry.status || entry.confirmStatus || 'pending');
            const processed = status !== 'pending';
            const interactive = !processed && runtime.busy;
            const confirmID = text(entry.confirmID);
            const name = text(entry.name || entry.confirmName);
            const args = entry.args || entry.confirmArgs || {};
            const description = agentLanguage('agentConfirmDesc', '智能体：{category} 操作').replace('{category}', esc(agentToolCategory(name)));
            const statusLabel = status === 'approved'
                ? agentLanguage('agentConfirmApprove', '已批准')
                : (status === 'rejected'
                    ? agentLanguage('agentConfirmReject', '已拒绝')
                    : (status === 'always'
                        ? agentLanguage('agentConfirmAlways', '本会话允许')
                        : agentLanguage('agentConfirmPending', '等待确认')));
            const card = `<div class="agent-chat__confirm-card">
                    <div class="agent-chat__confirm-header"><svg class="agent-chat__confirm-icon"><use xlink:href="#iconInfo"></use></svg> ${description}</div>
                    ${renderConfirmEffects(entry.effects)}
                    <pre class="agent-chat__confirm-args">${esc(JSON.stringify(args, null, 2))}</pre>
                    <div class="agent-chat__confirm-actions">${interactive
                        ? `<button type="button" class="b3-button b3-button--cancel agent-chat__confirm-reject" data-agent-action="reject-confirm" data-id="${esc(confirmID)}">${esc(agentLanguage('agentConfirmReject', '拒绝'))}</button><button type="button" class="b3-button b3-button--text agent-chat__confirm-approve" data-agent-action="approve-confirm" data-id="${esc(confirmID)}">${esc(agentLanguage('agentConfirmApprove', '批准'))}</button><button type="button" class="b3-button b3-button--text agent-chat__confirm-always ariaLabel" data-position="n" aria-label="${esc(agentLanguage('agentConfirmAlwaysDesc', '本会话后续不再询问'))}" data-agent-action="always-confirm" data-id="${esc(confirmID)}">${esc(agentLanguage('agentConfirmAlways', '本会话允许'))}</button>`
                        : `<span class="agent-chat__confirm-done">${esc(statusLabel)}</span>`}</div>
                </div>`;
            if (processed) return `<details class="agent-chat__msg agent-chat__msg--confirm agent-chat__msg--confirmed tm-agent-interaction" data-confirm-id="${esc(confirmID)}">
                <summary class="tm-agent-interaction__summary"><svg class="tm-agent-interaction__icon" aria-hidden="true"><use xlink:href="#iconInfo"></use></svg><span class="tm-agent-interaction__title">${description}</span><span class="tm-agent-interaction__state agent-chat__confirm-done">${esc(statusLabel)}</span><svg class="tm-agent-interaction__caret" aria-hidden="true"><use xlink:href="#iconRight"></use></svg></summary>
                <div class="tm-agent-interaction__body">${card}</div>
            </details>`;
            return `<div class="agent-chat__msg agent-chat__msg--confirm${interactive ? '' : ' agent-chat__msg--confirmed'}" data-confirm-id="${esc(confirmID)}">
                ${card}
            </div>`;
        }
        if (type === 'question') {
            const questionID = text(entry.questionID);
            const questions = normalizeQuestions(entry.questions);
            const submitted = text(entry.status) === 'submitted';
            const interactive = !submitted && runtime.busy;
            const answers = new Set((Array.isArray(entry.answers) ? entry.answers : []).map(text).filter(Boolean));
            const optionAnswers = new Set(questions.flatMap((question) => question.options.map((option) => option.label)));
            const customAnswer = Array.from(answers).find((answer) => !optionAnswers.has(answer)) || '';
            const card = `<div class="agent-chat__question-card">
                ${questions.map((question, index) => {
                    const options = question.options;
                    const inputType = question?.multiple === true ? 'checkbox' : 'radio';
                    const name = `q_${questionID}_${index}`;
                    const custom = question?.custom !== false;
                    return `<div class="agent-chat__question-item" data-question-item="${index}">
                        ${question?.header ? `<div class="agent-chat__question-header">${esc(question.header)}</div>` : ''}
                        ${question?.question ? `<div class="agent-chat__question-text">${esc(question.question)}</div>` : ''}
                        <div class="agent-chat__question-options" data-qi="${index}">${options.map((option) => `<label class="agent-chat__question-option"><input type="${inputType}" name="${esc(name)}" value="${esc(option?.label)}" ${answers.has(option.label) ? 'checked' : ''} ${interactive ? '' : 'disabled'}><span class="agent-chat__question-option-label">${esc(option?.label)}</span>${option?.description ? `<span class="agent-chat__question-option-desc">${esc(option.description)}</span>` : ''}</label>`).join('')}${custom ? `<input class="agent-chat__question-custom" data-question-custom data-qi="${index}" type="text" value="${esc(submitted ? customAnswer : '')}" placeholder="${esc(agentLanguage('agentQuestionCustom', '输入其他回答…'))}" ${interactive ? '' : 'disabled'}>` : ''}</div>
                    </div>`;
                }).join('')}
                ${questions.length ? `<div class="agent-chat__question-submit">${interactive ? `<button type="button" class="b3-button b3-button--text agent-chat__question-submit-btn" data-agent-action="submit-question" data-id="${esc(questionID)}">${esc(agentLanguage('agentQuestionSubmit', '提交'))}</button>` : `<span class="agent-chat__confirm-done">${esc(submitted ? agentLanguage('agentQuestionSubmitted', '已提交') : agentLanguage('agentQuestionPending', '等待回答'))}</span>`}</div>` : ''}
                </div>`;
            if (submitted) {
                const title = text(questions[0]?.header || questions[0]?.question) || '回答问题';
                const answer = Array.from(answers).join('、') || agentLanguage('agentQuestionSubmitted', '已提交');
                return `<details class="agent-chat__msg agent-chat__msg--question agent-chat__msg--confirmed tm-agent-interaction" data-question-id="${esc(questionID)}">
                    <summary class="tm-agent-interaction__summary"><svg class="tm-agent-interaction__icon" aria-hidden="true"><use xlink:href="#iconHelp"></use></svg><span class="tm-agent-interaction__title">${esc(title)}</span><span class="tm-agent-interaction__state">${esc(answer)}</span><svg class="tm-agent-interaction__caret" aria-hidden="true"><use xlink:href="#iconRight"></use></svg></summary>
                    <div class="tm-agent-interaction__body">${card}</div>
                </details>`;
            }
            return `<div class="agent-chat__msg agent-chat__msg--question${interactive ? '' : ' agent-chat__msg--confirmed'}" data-question-id="${esc(questionID)}">
                ${card}
            </div>`;
        }
        if (type === 'snapshot') return `<div class="tm-agent-notice">已创建操作快照 ${esc(entry.snapshotID || '')}</div>`;
        return '';
    }

    function interactionArguments(event) {
        let value = event?.arguments ?? event?.args ?? event?.input ?? event?.data ?? null;
        if (typeof value === 'string') {
            try { value = JSON.parse(value); } catch (error) { value = null; }
        }
        if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.arguments === 'string') {
            try { value = { ...value, ...JSON.parse(value.arguments) }; } catch (error) {}
        }
        return value;
    }

    function normalizeQuestions(value) {
        let source = value;
        if (typeof source === 'string') {
            try { source = JSON.parse(source); } catch (error) { source = []; }
        }
        if (source && typeof source === 'object' && !Array.isArray(source)) {
            source = Array.isArray(source.questions) ? source.questions : [source];
        }
        return (Array.isArray(source) ? source : []).map((question) => {
            if (typeof question === 'string') return { header: '', question: text(question), options: [], multiple: false, custom: true };
            const options = Array.isArray(question?.options) ? question.options : (Array.isArray(question?.choices) ? question.choices : []);
            return {
                header: text(question?.header || question?.title),
                question: text(question?.question || question?.text || question?.prompt),
                options: options.map((option) => typeof option === 'string'
                    ? { label: text(option), description: '' }
                    : { label: text(option?.label || option?.value || option?.name), description: text(option?.description || option?.detail) }).filter((option) => option.label),
                multiple: question?.multiple === true,
                custom: question?.custom !== false,
            };
        }).filter((question) => question.question || question.header || question.options.length);
    }

    function renderLiveMessage(live, options = {}) {
        if (!live) return '';
        const calls = Array.isArray(live.toolCalls) ? live.toolCalls : [];
        const todoCall = calls.filter(isTodoToolCall).pop();
        const todo = options.omitTodos === true || !todoCall ? '' : renderTodoCall(todoCall, live.done === true);
        const tools = options.omitTools === true
            ? ''
            : renderToolGroup(calls.filter((call) => !isTodoToolCall(call)), live.done === true);
        if (!text(live.content) && !todo && !tools && !text(live.status)) return '';
        return `<article class="tm-agent-message tm-agent-message--assistant" data-tm-agent-live><div class="tm-agent-thinking" data-tm-agent-live-status ${live.status ? '' : 'hidden'}>${esc(live.status || '')}</div>${todo}${tools}<div class="tm-agent-message__body" data-tm-agent-live-content>${esc(live.content || '')}</div></article>`;
    }

    function renderConversation(entries, live) {
        let html = '';
        let deferredInteractions = [];
        const flushInteractions = () => {
            html += deferredInteractions.map(({ entry, index }) => renderEntry(entry, index)).join('');
            deferredInteractions = [];
        };
        entries.forEach((entry, index) => {
            const type = text(entry?.type);
            if (type === 'user') {
                flushInteractions();
                html += renderEntry(entry, index);
            } else if (type === 'confirm' || type === 'question') {
                deferredInteractions.push({ entry, index });
            } else {
                html += renderEntry(entry, index);
            }
        });
        html += renderLiveMessage(live);
        flushInteractions();
        return html;
    }

    function settleLiveBeforeInteraction() {
        const live = runtime.live;
        if (!live) return false;
        const calls = Array.isArray(live.toolCalls) ? live.toolCalls : [];
        const completedCalls = calls.filter(toolCallCompleted);
        const content = String(live.content || '');
        live.content = '';
        live.toolCalls = calls.filter((call) => !toolCallCompleted(call));
        live.status = '';
        if (!text(content) && !completedCalls.length) return false;
        runtime.session.entries.push({
            id: newID(),
            type: 'assistant',
            content,
            toolCalls: clone(completedCalls),
            timestamp: Date.now(),
        });
        return true;
    }

    function contextLabels() {
        const labels = [];
        runtime.context.taskIDs.forEach((id) => labels.push({ kind: 'task', id, label: `任务 ${id.slice(-6)}` }));
        runtime.context.documentIDs.forEach((id) => labels.push({ kind: 'document', id, label: `文档 ${id.slice(-6)}` }));
        if (runtime.context.scope) labels.push({ kind: 'scope', id: 'scope', label: text(runtime.context.scope.label) || '当前任务视图' });
        return labels;
    }

    function resolvedContextLabels() {
        const known = new Map((Array.isArray(runtime.context.labels) ? runtime.context.labels : []).map((item) => [`${text(item?.kind)}:${text(item?.id)}`, text(item?.label)]));
        return contextLabels().map((item) => ({ ...item, label: known.get(`${item.kind}:${item.id}`) || item.label }));
    }

    function contextItemSelected(kind, id) {
        if (kind === 'task') return runtime.context.taskIDs.includes(id);
        if (kind === 'document') return runtime.context.documentIDs.includes(id);
        return kind === 'scope' && !!runtime.context.scope;
    }

    function rememberContextLabel(kind, id, label) {
        const labels = resolvedContextLabels();
        const item = labels.find((entry) => entry.kind === kind && entry.id === id);
        if (item && text(label)) item.label = text(label);
        runtime.context.labels = labels;
    }

    function addContextItem(kind, id, label) {
        const targetID = text(id);
        if (!targetID) return false;
        if (kind === 'task' && !isTaskContextID(targetID)) return false;
        if (kind === 'task' && !runtime.context.taskIDs.includes(targetID)) runtime.context.taskIDs.push(targetID);
        else if (kind === 'document' && !runtime.context.documentIDs.includes(targetID)) runtime.context.documentIDs.push(targetID);
        else if (kind !== 'task' && kind !== 'document') return false;
        rememberContextLabel(kind, targetID, label);
        scheduleSave();
        void enrichContextLabels();
        return true;
    }

    function collectDraggedTaskContextIDs(value, output = [], seen = new Set()) {
        if (Array.isArray(value)) {
            value.forEach((item) => collectDraggedTaskContextIDs(item, output, seen));
            return output;
        }
        if (value && typeof value === 'object') {
            if (seen.has(value)) return output;
            seen.add(value);
            ['taskIDs', 'taskIds', 'selectedTaskIds', 'ids'].forEach((key) => {
                collectDraggedTaskContextIDs(value[key], output, seen);
            });
            ['taskID', 'taskId', 'id'].forEach((key) => {
                const taskID = text(value[key]);
                if (isTaskContextID(taskID) && !output.includes(taskID)) output.push(taskID);
            });
            return output;
        }
        const raw = text(value);
        if (!raw) return output;
        if (isTaskContextID(raw)) {
            if (!output.includes(raw)) output.push(raw);
            return output;
        }
        if (!raw.startsWith('[') && !raw.startsWith('{')) return output;
        try { collectDraggedTaskContextIDs(JSON.parse(raw), output, seen); } catch (error) {}
        return output;
    }

    function normalizeTaskContextDragPayload(value) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            taskIDs: collectDraggedTaskContextIDs(value),
            label: text(source.label || source.title || source.content),
        };
    }

    function taskContextDragTypes(dataTransfer) {
        try { return Array.from(dataTransfer?.types || []).map((type) => text(type).toLowerCase()).filter(Boolean); }
        catch (error) { return []; }
    }

    function isTaskContextDataTransfer(dataTransfer) {
        const types = taskContextDragTypes(dataTransfer);
        if (types.includes('application/x-tm-task-link')) return false;
        return TASK_CONTEXT_DRAG_TYPES.some((type) => types.includes(type));
    }

    function readTaskContextDataTransfer(dataTransfer) {
        if (!dataTransfer || !isTaskContextDataTransfer(dataTransfer)) return { taskIDs: [], label: '' };
        const values = [];
        TASK_CONTEXT_DRAG_TYPES.forEach((type) => {
            try {
                const raw = text(dataTransfer.getData?.(type));
                if (raw) values.push(raw);
            } catch (error) {}
        });
        try {
            const plain = text(dataTransfer.getData?.('text/plain'));
            if (plain) values.push(plain);
        } catch (error) {}
        const taskIDs = collectDraggedTaskContextIDs(values);
        let label = '';
        for (const value of values) {
            if (!text(value).startsWith('{')) continue;
            try {
                const parsed = JSON.parse(value);
                label = text(parsed?.title || parsed?.content);
                if (label) break;
            } catch (error) {}
        }
        return { taskIDs, label };
    }

    function setTaskContextDropState(active) {
        const workbench = runtime.host?.querySelector?.('.tm-agent-workbench');
        if (!(workbench instanceof HTMLElement)) return false;
        workbench.classList.toggle('is-task-drag-over', active === true);
        return true;
    }

    function handleTaskContextDragOver(payload) {
        if (!normalizeTaskContextDragPayload(payload).taskIDs.length) return false;
        return setTaskContextDropState(true);
    }

    function clearTaskContextDropState() {
        return setTaskContextDropState(false);
    }

    function addDraggedTasksToContext(payload) {
        const normalized = normalizeTaskContextDragPayload(payload);
        const taskIDs = normalized.taskIDs;
        clearTaskContextDropState();
        if (!taskIDs.length) return false;
        const newTaskIDs = taskIDs.filter((taskID) => !runtime.context.taskIDs.includes(taskID));
        if (!newTaskIDs.length) {
            aiBridge()?.hint?.(taskIDs.length > 1 ? '这些任务已在智能体上下文中' : '该任务已在智能体上下文中', 'info');
            return true;
        }
        runtime.context.taskIDs.push(...newTaskIDs);
        if (newTaskIDs.length === 1 && taskIDs.length === 1 && normalized.label) {
            rememberContextLabel('task', newTaskIDs[0], normalized.label);
        } else {
            runtime.context.labels = resolvedContextLabels();
        }
        scheduleSave();
        render();
        void enrichContextLabels();
        aiBridge()?.hint?.(`已添加 ${newTaskIDs.length} 个任务到智能体上下文`, 'success');
        return true;
    }

    function removeContextItem(kind, id) {
        if (kind === 'task') runtime.context.taskIDs = runtime.context.taskIDs.filter((item) => item !== id);
        else if (kind === 'document') runtime.context.documentIDs = runtime.context.documentIDs.filter((item) => item !== id);
        else {
            runtime.context.scope = null;
            runtime.contextLabelSeq += 1;
            clearTimeout(runtime.viewContextSyncTimer);
            runtime.viewContextSyncTimer = 0;
            runtime.viewContextSyncSeq += 1;
        }
        runtime.context.labels = resolvedContextLabels();
        if (!runtime.context.taskIDs.length && !runtime.context.documentIDs.length && !runtime.context.scope) runtime.contextExpanded = false;
        scheduleSave();
    }

    function clearContext() {
        runtime.context = { taskIDs: [], documentIDs: [], scope: null, labels: [] };
        runtime.contextExpanded = false;
        runtime.contextLabelSeq += 1;
        clearTimeout(runtime.viewContextSyncTimer);
        runtime.viewContextSyncTimer = 0;
        runtime.viewContextSyncSeq += 1;
        scheduleSave();
    }

    async function setCurrentViewContext() {
        runtime.context.scope = {
            type: 'current_view',
            id: text(aiBridge()?.getCurrentGroupId?.()) || 'current',
            label: '当前任务视图',
        };
        runtime.context.labels = resolvedContextLabels();
        scheduleSave();
        return await syncCurrentViewContext();
    }

    function currentViewScopeLabel(snapshot, scopeType) {
        const parts = [text(snapshot?.groupLabel) || '当前分组'];
        if (scopeType !== 'current_group') parts.push(text(snapshot?.activeDocLabel) || '全部页签');
        if (text(snapshot?.viewLabel) || text(snapshot?.view)) parts.push(text(snapshot.viewLabel) || text(snapshot.view));
        return parts.filter(Boolean).join(' · ');
    }

    async function syncCurrentViewContext(options = {}) {
        const scope = runtime.context.scope;
        if (!scope || (scope.type !== 'current_view' && scope.type !== 'current_group')) return null;
        if (options.cancelQueued !== false) {
            clearTimeout(runtime.viewContextSyncTimer);
            runtime.viewContextSyncTimer = 0;
        }
        const seq = ++runtime.viewContextSyncSeq;
        let snapshot = null;
        try { snapshot = await aiBridge()?.getCurrentViewContext?.(); } catch (error) { snapshot = null; }
        if (!snapshot || seq !== runtime.viewContextSyncSeq || !runtime.context.scope) return null;
        let registered = null;
        let containerRegistered = null;
        try {
            const readScopes = [{
                taskIDs: Array.isArray(snapshot.visibleTaskIDs) ? snapshot.visibleTaskIDs : [],
                documentIDs: [],
                taskValues: Array.isArray(snapshot.taskValues) ? snapshot.taskValues : [],
                virtualTasks: Array.isArray(snapshot.virtualTasks) ? snapshot.virtualTasks : [],
            }];
            if (runtime.context.taskIDs.length) readScopes.push(await aiBridge()?.getTaskReadScope?.(runtime.context.taskIDs) || {});
            if (runtime.context.documentIDs.length) readScopes.push(await aiBridge()?.getDocumentTaskReadScope?.(runtime.context.documentIDs) || {});
            const mergedScope = mergeTaskReadScopes(readScopes);
            const explicitScopeTaskIDs = Array.from(new Set([
                ...(Array.isArray(snapshot.visibleTaskIDs) ? snapshot.visibleTaskIDs : []),
                ...runtime.context.taskIDs.filter(isTaskBlockID),
            ].map(text).filter(isTaskBlockID)));
            registered = await kernelCall('taskHorizonRegisterTaskScope', {
                scopeID: `${text(snapshot.scopeID)}|context:${runtime.context.taskIDs.length}:${runtime.context.documentIDs.slice().sort().join(',')}`,
                scopeMode: runtime.context.documentIDs.length ? 'documents' : 'tasks',
                taskIDs: runtime.context.documentIDs.length ? explicitScopeTaskIDs : mergedScope.taskIDs,
                documentIDs: runtime.context.documentIDs.length ? runtime.context.documentIDs.slice() : (Array.isArray(snapshot.documentIDs) ? snapshot.documentIDs : []),
                taskValues: mergedScope.taskValues,
                virtualTasks: mergedScope.virtualTasks,
            });
            const containerDocumentIDs = Array.from(new Set([
                ...(Array.isArray(snapshot.documentIDs) ? snapshot.documentIDs : []),
                ...runtime.context.documentIDs,
            ].map(text).filter(Boolean)));
            containerRegistered = registered;
            if (containerDocumentIDs.length) {
                const containerScope = await aiBridge()?.getDocumentTaskReadScope?.(containerDocumentIDs) || {};
                containerRegistered = await kernelCall('taskHorizonRegisterTaskScope', {
                    scopeID: `${text(snapshot.groupID) || 'all'}|${text(snapshot.activeDocID) || 'all'}|container`,
                    scopeMode: 'documents',
                    taskIDs: [],
                    documentIDs: containerDocumentIDs,
                    taskValues: Array.isArray(containerScope.taskValues) ? containerScope.taskValues : [],
                    virtualTasks: Array.isArray(containerScope.virtualTasks) ? containerScope.virtualTasks : [],
                });
            }
        } catch (error) {
            if (seq === runtime.viewContextSyncSeq) runtime.statusText = `任务范围注册失败：${text(error?.message || error)}`;
            return null;
        }
        if (seq !== runtime.viewContextSyncSeq || !runtime.context.scope) return null;
        const label = currentViewScopeLabel(snapshot, scope.type);
        const nextScope = {
            type: scope.type,
            id: text(snapshot.scopeID) || text(scope.id) || 'current',
            label,
            scopeToken: text(registered?.scopeToken),
            containerScopeToken: text(containerRegistered?.scopeToken),
            groupID: text(snapshot.groupID) || 'all',
            activeDocID: text(snapshot.activeDocID) || 'all',
            view: text(snapshot.view),
            visibleTaskCount: Math.max(0, Number(registered?.taskCount ?? snapshot.visibleTaskCount) || 0),
        };
        const changed = JSON.stringify(runtime.context.scope) !== JSON.stringify(nextScope);
        runtime.contextLabelSeq += 1;
        runtime.context.scope = nextScope;
        runtime.context.labels = resolvedContextLabels().map((item) => item.kind === 'scope' ? { ...item, label } : item);
        if (changed) scheduleSave();
        if (changed && options.render === true) render();
        return {
            scopeToken: text(registered?.scopeToken),
            viewScopeToken: text(registered?.scopeToken),
            containerScopeToken: text(containerRegistered?.scopeToken),
            scopeID: text(snapshot.scopeID),
            expiresAt: text(registered?.expiresAt),
            visibleTaskCount: Math.max(0, Number(registered?.taskCount ?? snapshot.visibleTaskCount) || 0),
            documentCount: Math.max(0, Number(registered?.documentCount) || 0),
        };
    }

    async function syncDocumentGroupSnapshot() {
        try {
            const snapshot = await aiBridge()?.getDocumentGroupSnapshot?.();
            if (!snapshot || !Array.isArray(snapshot.groups)) return null;
            return await kernelCall('taskHorizonRegisterDocumentGroupSnapshot', snapshot);
        } catch (error) {
            return null;
        }
    }

    function scheduleCurrentViewContextSync() {
        if (!runtime.context.scope || (runtime.context.scope.type !== 'current_view' && runtime.context.scope.type !== 'current_group')) return;
        clearTimeout(runtime.viewContextSyncTimer);
        runtime.viewContextSyncTimer = setTimeout(() => {
            runtime.viewContextSyncTimer = 0;
            void syncCurrentViewContext({ render: true, cancelQueued: false });
        }, 80);
    }

    function notifyTaskViewChanged() {
        const scopeType = text(runtime.context.scope?.type);
        if (!runtime.mounted || !(runtime.host instanceof HTMLElement) || !runtime.host.isConnected) return false;
        if (scopeType !== 'current_view' && scopeType !== 'current_group') return false;
        scheduleCurrentViewContextSync();
        return true;
    }

    async function enrichContextLabels() {
        const seq = ++runtime.contextLabelSeq;
        const labels = resolvedContextLabels();
        const previousLabels = JSON.stringify(labels);
        for (const item of labels) {
            try {
                if (item.kind === 'task') {
                    const task = await aiBridge()?.getTaskSnapshot?.(item.id, { forceFresh: false });
                    if (task) item.label = text(task.content || task.title) || item.label;
                } else if (item.kind === 'document') {
                    const doc = await aiBridge()?.getDocumentSnapshot?.(item.id, { forceFresh: false });
                    if (doc) item.label = text(doc.name) || item.label;
                }
            } catch (error) {}
        }
        if (seq !== runtime.contextLabelSeq) return;
        runtime.context.labels = labels;
        if (JSON.stringify(labels) !== previousLabels) scheduleSave();
        render();
    }

    async function searchContextPicker(queryOverride) {
        const query = text(queryOverride != null ? queryOverride : runtime.contextPickerQuery);
        const mode = runtime.contextPickerMode === 'document' ? 'document' : 'task';
        const seq = ++runtime.contextPickerSearchSeq;
        runtime.contextPickerScrollTop = 0;
        runtime.contextPickerQuery = query;
        runtime.contextPickerLoading = mode === 'task' || !!query;
        runtime.contextPickerError = '';
        if (!runtime.contextPickerLoading) {
            runtime.contextPickerResults = [];
            render();
            return;
        }
        render();
        try {
            let results = [];
            if (mode === 'task') {
                const data = await kernelCall('taskHorizonQueryTasks', {
                    filters: query ? { keyword: query } : {},
                    fields: ['documentName', 'documentPath', 'updated'],
                    limit: 20,
                });
                results = (Array.isArray(data?.items) ? data.items : []).map((item) => ({
                    kind: 'task',
                    id: text(item?.id),
                    label: text(item?.title) || `任务 ${text(item?.id).slice(-6)}`,
                    meta: text(item?.documentName || item?.documentPath),
                })).filter((item) => item.id);
            } else {
                const data = await kernelCall('taskHorizonSearchDocuments', {
                    keyword: query,
                    limit: 20,
                });
                results = (Array.isArray(data?.items) ? data.items : []).map((item) => ({
                    kind: 'document',
                    id: text(item?.id),
                    label: text(item?.name) || `文档 ${text(item?.id).slice(-6)}`,
                    meta: text(item?.path),
                })).filter((item) => item.id);
            }
            if (seq !== runtime.contextPickerSearchSeq || mode !== runtime.contextPickerMode) return;
            runtime.contextPickerResults = results;
        } catch (error) {
            if (seq !== runtime.contextPickerSearchSeq) return;
            runtime.contextPickerResults = [];
            runtime.contextPickerError = text(error?.message || error) || '搜索失败';
        } finally {
            if (seq === runtime.contextPickerSearchSeq) {
                runtime.contextPickerLoading = false;
                render();
            }
        }
    }

    function suggestions() {
        let items;
        if (runtime.context.taskIDs.length) items = [
            { label: '优化标题', preset: 'title-rewrite' },
            { label: '拆分下一步', preset: 'task-capture' },
            { label: '安排时间', preset: 'task-planning' },
        ];
        else if (runtime.context.scope) items = [
            { label: '规划今天', preset: 'task-planning' },
            { label: '处理逾期', text: '检查当前范围内的逾期任务，给出处理计划' },
            { label: '查看工作量', preset: 'task-review' },
        ];
        else if (runtime.context.documentIDs.length) items = [
            { label: '提取任务', preset: 'task-capture' },
            { label: '分析目标', preset: 'smart-review' },
            { label: '生成复盘', preset: 'task-review' },
        ];
        else items = [
            { label: '询问思源内容', text: '请帮我查找并整理思源笔记中的相关内容' },
            { label: '创建任务', preset: 'task-create' },
            { label: '打开最近会话', action: 'history' },
        ];
        const pinned = runtime.store.pinnedPresetIDs
            .map((id) => getPreset(id))
            .filter(Boolean)
            .map((preset) => ({ label: preset.label, preset: preset.id, pinned: true }));
        const seen = new Set(pinned.map((item) => item.preset));
        return pinned.concat(items.filter((item) => !item.preset || (!!getPreset(item.preset) && !seen.has(item.preset))));
    }

    function presetPinned(id) {
        return runtime.store.pinnedPresetIDs.includes(text(id));
    }

    function presetListRow(item, options = {}) {
        const id = text(item?.id);
        const editAction = options.builtin ? 'edit-builtin-preset' : 'edit-preset';
        const editID = options.builtin ? id : text(item?.id);
        const deleteAction = options.builtin ? 'delete-builtin-preset' : 'delete-preset';
        const selectID = options.builtin ? id : `custom:${id}`;
        const pinned = presetPinned(selectID);
        return `<div class="tm-agent-preset-list-row"><button type="button" class="tm-agent-preset-row ${runtime.presetID === selectID ? 'is-active' : ''}" data-agent-action="select-preset" data-id="${esc(selectID)}"><span>${esc(item.label)}</span><small>${esc(item.starter || item.prompt)}${item.customized ? ' · 已自定义' : ''}</small></button><button type="button" class="block__icon tm-agent-preset-action tm-agent-preset-pin ${pinned ? 'is-active is-unpin' : ''}" data-agent-action="toggle-pin-preset" data-id="${esc(selectID)}" aria-label="${pinned ? '取消置顶' : '置顶'} ${esc(item.label)}" aria-pressed="${pinned ? 'true' : 'false'}"><svg><use xlink:href="#iconPin"></use></svg></button><button type="button" class="block__icon tm-agent-preset-action" data-agent-action="${editAction}" data-id="${esc(editID)}" aria-label="编辑 ${esc(item.label)}">${phosphorBoldContextIcon('pencilSimple')}</button><button type="button" class="block__icon tm-agent-preset-action" data-agent-action="${deleteAction}" data-id="${esc(editID)}" aria-label="删除 ${esc(item.label)}">${phosphorBoldContextIcon('trash')}</button></div>`;
    }

    function fillPresetEditorFromBuiltin(select) {
        const form = select?.closest?.('[data-preset-editor-id]');
        if (!form || text(form.dataset.presetEditorId) !== '__new__') return;
        const preset = getPreset(select.value);
        const labelInput = form.elements?.label;
        const promptInput = form.elements?.prompt;
        const starterInput = form.elements?.starter;
        if (!preset) {
            if (labelInput) labelInput.value = '';
            if (promptInput) promptInput.value = '';
            if (starterInput) starterInput.value = '';
            return;
        }
        if (labelInput) labelInput.value = `${preset.label}副本`.slice(0, 60);
        if (promptInput) promptInput.value = preset.prompt;
        if (starterInput) starterInput.value = preset.starter;
        labelInput?.focus?.();
        labelInput?.select?.();
    }

    function renderOnboarding() {
        const caps = runtime.capabilities || {};
        if (caps.mcpEnabled && runtime.skillSync.error) {
            return `<section class="tm-agent-onboarding tm-agent-onboarding--warning"><div><strong>任务工具可用</strong><span>工作流程同步失败：${esc(runtime.skillSync.error)}</span></div><button type="button" class="b3-button b3-button--cancel" data-agent-action="retry-skills">重试</button></section>`;
        }
        if (caps.mcpEnabled) return '';
        if (caps.kernelAvailable !== true) {
            const rpcFailed = caps.unavailableReason === 'kernel-rpc-error';
            return `<section class="tm-agent-onboarding tm-agent-onboarding--warning"><div><strong>${rpcFailed ? '任务工具内核连接失败' : '任务工具内核未加载'}</strong><span>${rpcFailed ? `插件 Kernel RPC 调用失败${caps.unavailableDetail ? `：${esc(caps.unavailableDetail)}` : ''}。` : '未找到 Task Horizon 的 Kernel RPC。请确认当前思源支持 Kernel 插件，并在重启思源后重新检测。'}普通文档对话仍可使用。</span></div><button type="button" class="b3-button b3-button--cancel" data-agent-action="refresh-capabilities">重新检测</button></section>`;
        }
        if (caps.mcpAvailable !== true) {
            return `<section class="tm-agent-onboarding tm-agent-onboarding--warning"><div><strong>当前思源内核未提供 MCP</strong><span>Task Horizon Kernel 已正常加载，但当前客户端没有提供 siyuan.mcp，暂时无法注册任务工具。普通文档对话仍可使用。</span></div><button type="button" class="b3-button b3-button--cancel" data-agent-action="refresh-capabilities">重新检测</button></section>`;
        }
        if (runtime.store.toolsOnboardingDismissed) return '';
        if (aiBridge()?.getSettings?.()?.agentMcpAllowed !== true) {
            return `<section class="tm-agent-onboarding tm-agent-onboarding--warning"><div><strong>文档对话模式</strong><span>任务工具属于全功能权益，免费版不会启用。</span></div></section>`;
        }
        return `<section class="tm-agent-onboarding"><div><strong>启用任务工具</strong><span>智能体可以读取任务和日程；写入前会展示确认。</span></div><div class="tm-agent-onboarding__actions"><button type="button" class="b3-button b3-button--cancel" data-agent-action="dismiss-tools">暂时只用文档对话</button><button type="button" class="b3-button b3-button--text" data-agent-action="enable-tools">启用任务工具</button></div></section>`;
    }

    function renderHistory() {
        if (!runtime.historyOpen) return '';
        const activeScheduledSessionIDs = new Set(aiBridge()?.listActiveScheduledConversationIDs?.() || []);
        const sessions = runtime.historyScheduledOnly
            ? runtime.sessions.filter((session) => activeScheduledSessionIDs.has(text(session?.id)))
            : runtime.sessions;
        return `<aside class="tm-agent-history" aria-label="任务工作台会话">
            <div class="tm-agent-history__head"><strong>会话</strong><div class="tm-agent-history__actions"><label class="tm-agent-history__filter"><span>已启用定时任务</span><input class="b3-switch fn__flex-center" type="checkbox" data-agent-action="toggle-scheduled-history" ${runtime.historyScheduledOnly ? 'checked' : ''} aria-label="只显示已启用定时任务的会话"></label><button type="button" class="block__icon" data-agent-action="close-history" aria-label="关闭会话列表"><svg><use xlink:href="#iconClose"></use></svg></button></div></div>
            <div class="tm-agent-history__list">${sessions.map((session) => `<div class="tm-agent-history__row ${text(session.id) === runtime.activeSessionID ? 'is-active' : ''}"><button type="button" class="tm-agent-history__main" data-agent-action="select-session" data-id="${esc(session.id)}"><span>${esc(session.title || DEFAULT_SESSION_TITLE)}</span><small>${new Date(Number(session.updatedAt) || Date.now()).toLocaleString()}</small></button><div class="tm-agent-history__row-actions"><button type="button" class="block__icon ariaLabel" data-position="parentW" data-agent-action="rename-session" data-id="${esc(session.id)}" aria-label="重命名会话"><svg><use xlink:href="#iconEdit"></use></svg></button><button type="button" class="block__icon ariaLabel" data-position="parentW" data-agent-action="toggle-session-menu" data-id="${esc(session.id)}" aria-label="更多"><svg><use xlink:href="#iconMore"></use></svg></button><div class="tm-agent-history__menu b3-menu"><button type="button" class="b3-menu__item b3-menu__item--warning" data-agent-action="delete-session" data-id="${esc(session.id)}"><svg class="b3-menu__icon"><use xlink:href="#iconTrashcan"></use></svg><span class="b3-menu__label">删除</span></button></div></div></div>`).join('') || `<div class="tm-agent-empty">${runtime.historyScheduledOnly ? '当前没有已启用定时任务的会话' : '还没有思源智能体会话'}</div>`}</div>
        </aside>`;
    }

    function renderPresetPanel() {
        if (!runtime.presetsOpen) return '';
        const editingID = text(runtime.presetEditorID);
        const editingBuiltinID = editingID.startsWith('builtin:') ? editingID.slice('builtin:'.length) : '';
        const editing = editingID === '__new__'
            ? { id: '__new__', label: '', prompt: '', starter: '' }
            : (editingBuiltinID
                ? getPreset(editingBuiltinID)
                : runtime.store.customPresets.find((item) => text(item?.id) === editingID));
        const hiddenBuiltinCount = runtime.store.hiddenBuiltinPresetIDs.length;
        const builtinRows = Object.keys(BUILTIN_PRESETS).map((id) => getPreset(id)).filter(Boolean).sort((a, b) => Number(presetPinned(b.id)) - Number(presetPinned(a.id)));
        const customRows = runtime.store.customPresets.slice().sort((a, b) => Number(presetPinned(`custom:${b.id}`)) - Number(presetPinned(`custom:${a.id}`)));
        const editorTitle = editingID === '__new__' ? '新建自定义预设' : (editingBuiltinID ? '编辑内置预设' : '编辑自定义预设');
        const builtinTemplateField = editingID === '__new__' ? `<label><span>基于内置模板（可选）</span><select class="b3-select" name="builtinTemplate" data-agent-preset-template><option value="">空白预设</option>${builtinRows.map((item) => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join('')}</select></label>` : '';
        return `<aside class="tm-agent-presets" aria-label="对话预设">
            <div class="tm-agent-panel__head"><strong>对话预设</strong><button type="button" class="block__icon" data-agent-action="close-presets" aria-label="关闭预设"><svg><use xlink:href="#iconClose"></use></svg></button></div>
            <div class="tm-agent-presets__body">
                <section class="tm-agent-presets__section"><div class="tm-agent-presets__section-head"><span>内置</span>${hiddenBuiltinCount ? `<button type="button" class="block__icon tm-agent-preset-action ariaLabel" data-position="south" data-agent-action="restore-builtin-presets" aria-label="恢复 ${hiddenBuiltinCount} 个已删除的内置预设">${phosphorBoldContextIcon('arrowCounterClockwise')}</button>` : ''}</div>
                    <div class="tm-agent-presets__list">${builtinRows.map((item) => presetListRow(item, { builtin: true })).join('') || '<div class="tm-agent-presets__empty">已删除全部内置预设，可从右上角恢复</div>'}</div>
                </section>
                <section class="tm-agent-presets__section"><div class="tm-agent-presets__section-head"><span>自定义</span><button type="button" class="block__icon tm-agent-preset-action ariaLabel" data-position="south" data-agent-action="new-preset" aria-label="新建预设">${phosphorBoldContextIcon('plus')}</button></div>
                    <div class="tm-agent-presets__list">${customRows.map((item) => presetListRow(item)).join('') || '<div class="tm-agent-presets__empty">新建预设以复用常用指令</div>'}</div>
                </section>
                ${editing ? `<div class="tm-agent-preset-editor-backdrop"><form class="tm-agent-preset-editor" data-preset-editor-id="${esc(editingID)}" role="dialog" aria-modal="true" aria-labelledby="tm-agent-preset-editor-title"><div class="tm-agent-preset-editor__head"><div><strong id="tm-agent-preset-editor-title">${editorTitle}</strong>${editingBuiltinID ? '<span>修改只影响你的预设</span>' : ''}</div><button type="button" class="block__icon" data-agent-action="cancel-preset-edit" aria-label="关闭预设编辑"><svg><use xlink:href="#iconClose"></use></svg></button></div>${builtinTemplateField}<label><span>名称</span><input class="b3-text-field" name="label" maxlength="60" value="${esc(editing.label)}" required></label><label><span>对话附带指令</span><textarea class="b3-text-field" name="prompt" rows="5" maxlength="8000" required>${esc(editing.prompt)}</textarea></label><label><span>输入提示</span><input class="b3-text-field" name="starter" maxlength="500" value="${esc(editing.starter)}"></label><div class="tm-agent-preset-editor__actions">${editingBuiltinID && editing.customized ? `<button type="button" class="b3-button b3-button--cancel" data-agent-action="reset-builtin-preset" data-id="${esc(editingBuiltinID)}">恢复默认</button>` : ''}<span class="fn__flex-1"></span><button type="button" class="b3-button b3-button--cancel" data-agent-action="cancel-preset-edit">取消</button><button type="button" class="b3-button b3-button--text" data-agent-action="save-preset">保存</button></div></form></div>` : ''}
            </div>
        </aside>`;
    }

    function renderContextPicker() {
        if (!runtime.contextPickerOpen) return '';
        const currentTaskID = text(aiBridge()?.getCurrentTaskId?.());
        const currentDocumentID = text(aiBridge()?.getCurrentDocId?.());
        const mode = runtime.contextPickerMode === 'document' ? 'document' : 'task';
        const selectedCount = runtime.context.taskIDs.length + runtime.context.documentIDs.length + (runtime.context.scope ? 1 : 0);
        const resultHtml = runtime.contextPickerLoading
            ? '<div class="tm-agent-context-picker__empty">正在搜索...</div>'
            : (runtime.contextPickerError
                ? `<div class="tm-agent-context-picker__empty is-error">${esc(runtime.contextPickerError)}</div>`
                : (runtime.contextPickerResults.map((item) => {
                    const selected = contextItemSelected(item.kind, item.id);
                    return `<button type="button" class="tm-agent-context-result ${selected ? 'is-selected' : ''}" data-agent-action="toggle-context-result" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}" aria-pressed="${selected ? 'true' : 'false'}">
                        <span class="tm-agent-context-result__copy"><strong>${esc(item.label)}</strong>${item.meta ? `<small>${esc(item.meta)}</small>` : ''}</span>
                        <svg aria-hidden="true"><use xlink:href="#${selected ? 'iconCheck' : 'iconAdd'}"></use></svg>
                    </button>`;
                }).join('') || `<div class="tm-agent-context-picker__empty">${runtime.contextPickerQuery ? '没有匹配结果' : (mode === 'task' ? '没有最近任务' : '输入关键词搜索文档')}</div>`));
        return `<aside class="tm-agent-context-picker" aria-label="添加上下文">
            <div class="tm-agent-panel__head"><strong>添加上下文</strong><button type="button" class="block__icon" data-agent-action="close-context-picker" aria-label="关闭上下文选择"><svg><use xlink:href="#iconClose"></use></svg></button></div>
            <div class="tm-agent-context-picker__body">
                <div class="tm-agent-context-picker__quick" aria-label="快速添加">
                    <button type="button" data-agent-action="add-current-task" ${currentTaskID ? '' : 'disabled'} aria-pressed="${currentTaskID && contextItemSelected('task', currentTaskID) ? 'true' : 'false'}"><svg aria-hidden="true"><use xlink:href="#iconListItem"></use></svg><span>当前任务</span></button>
                    <button type="button" data-agent-action="add-current-document" ${currentDocumentID ? '' : 'disabled'} aria-pressed="${currentDocumentID && contextItemSelected('document', currentDocumentID) ? 'true' : 'false'}"><svg aria-hidden="true"><use xlink:href="#iconFile"></use></svg><span>当前文档</span></button>
                    <button type="button" data-agent-action="add-current-view" aria-pressed="${runtime.context.scope ? 'true' : 'false'}"><svg aria-hidden="true"><use xlink:href="#iconFilter"></use></svg><span>当前视图</span></button>
                </div>
                <div class="tm-agent-context-picker__tabs" role="tablist" aria-label="上下文类型">
                    <button type="button" role="tab" aria-selected="${mode === 'task'}" class="${mode === 'task' ? 'is-active' : ''}" data-agent-action="set-context-picker-mode" data-mode="task">任务</button>
                    <button type="button" role="tab" aria-selected="${mode === 'document'}" class="${mode === 'document' ? 'is-active' : ''}" data-agent-action="set-context-picker-mode" data-mode="document">文档</button>
                </div>
                <label class="tm-agent-context-picker__search">
                    <svg aria-hidden="true"><use xlink:href="#iconSearch"></use></svg>
                    <input class="b3-text-field" type="search" data-agent-context-search value="${esc(runtime.contextPickerQuery)}" placeholder="搜索${mode === 'task' ? '任务' : '文档'}" autocomplete="off">
                    ${runtime.contextPickerQuery ? '<button type="button" data-agent-action="clear-context-search" aria-label="清除搜索"><svg><use xlink:href="#iconClose"></use></svg></button>' : ''}
                </label>
                <div class="tm-agent-context-picker__results">${resultHtml}</div>
                <div class="tm-agent-context-picker__footer">
                    <button type="button" class="b3-button b3-button--text" data-agent-action="finish-context-picker">完成</button>
                    <span role="status">已选 ${selectedCount} 项</span>
                </div>
            </div>
        </aside>`;
    }

    function syncContextScrollbar(show = false) {
        const items = runtime.host?.querySelector?.('.tm-agent-context__items');
        const scrollbar = runtime.host?.querySelector?.('.tm-agent-context__scrollbar');
        const thumb = scrollbar?.querySelector?.('.tm-agent-context__scrollbar-thumb');
        if (!(items instanceof HTMLElement) || !(scrollbar instanceof HTMLElement) || !(thumb instanceof HTMLElement)) return;
        const trackWidth = scrollbar.clientWidth;
        const viewportWidth = items.clientWidth;
        const scrollWidth = items.scrollWidth;
        const maxScroll = Math.max(0, scrollWidth - viewportWidth);
        const needed = !runtime.contextExpanded && trackWidth > 0 && maxScroll > 1;
        scrollbar.classList.toggle('is-needed', needed);
        if (!needed) {
            scrollbar.classList.remove('is-visible', 'is-dragging');
            thumb.style.width = '';
            thumb.style.transform = '';
            return;
        }
        const thumbWidth = Math.min(trackWidth, Math.max(24, Math.round(trackWidth * viewportWidth / scrollWidth)));
        const maxTravel = Math.max(0, trackWidth - thumbWidth);
        const offset = maxScroll > 0 ? Math.round(maxTravel * items.scrollLeft / maxScroll) : 0;
        thumb.style.width = `${thumbWidth}px`;
        thumb.style.transform = `translate3d(${offset}px, 0, 0)`;
        if (!show) return;
        scrollbar.classList.add('is-visible');
        clearTimeout(contextScrollbarHideTimer);
        contextScrollbarHideTimer = setTimeout(() => {
            if (!scrollbar.classList.contains('is-dragging')) scrollbar.classList.remove('is-visible');
        }, 700);
    }

    function beginContextScrollbarDrag(event, thumb) {
        const scrollbar = thumb?.closest?.('.tm-agent-context__scrollbar');
        const items = runtime.host?.querySelector?.('.tm-agent-context__items');
        if (!(scrollbar instanceof HTMLElement) || !(items instanceof HTMLElement)) return false;
        const maxTravel = Math.max(0, scrollbar.clientWidth - thumb.offsetWidth);
        const maxScroll = Math.max(0, items.scrollWidth - items.clientWidth);
        if (maxTravel <= 0 || maxScroll <= 0) return false;
        clearTimeout(contextScrollbarHideTimer);
        contextScrollbarDrag = {
            pointerID: event.pointerId,
            startX: event.clientX,
            startScrollLeft: items.scrollLeft,
            maxTravel,
            maxScroll,
            items,
            scrollbar,
        };
        scrollbar.classList.add('is-visible', 'is-dragging');
        thumb.setPointerCapture?.(event.pointerId);
        return true;
    }

    function moveContextScrollbarDrag(event) {
        const drag = contextScrollbarDrag;
        if (!drag || drag.pointerID !== event.pointerId) return false;
        drag.items.scrollLeft = drag.startScrollLeft + (event.clientX - drag.startX) * drag.maxScroll / drag.maxTravel;
        syncContextScrollbar(true);
        return true;
    }

    function endContextScrollbarDrag(event) {
        const drag = contextScrollbarDrag;
        if (!drag || drag.pointerID !== event.pointerId) return false;
        contextScrollbarDrag = null;
        drag.scrollbar.classList.remove('is-dragging');
        syncContextScrollbar(true);
        return true;
    }

    function shouldFollowConversation(messages) {
        if (!(messages instanceof HTMLElement)) return true;
        return messages.scrollHeight - messages.scrollTop - messages.clientHeight <= 64;
    }

    function updateConversationBottomButton(messages) {
        const button = runtime.host?.querySelector?.('[data-agent-action="scroll-to-bottom"]');
        if (!(button instanceof HTMLElement)) return;
        button.hidden = runtime.conversationFollowBottom !== false;
    }

    function captureConversationScroll(messages) {
        if (!(messages instanceof HTMLElement)) return null;
        return {
            scrollTop: messages.scrollTop,
            follow: runtime.conversationFollowBottom !== false,
        };
    }

    function restoreConversationScroll(messages, snapshot, follow) {
        if (!(messages instanceof HTMLElement)) return;
        const restore = () => {
            if (!messages.isConnected) return;
            messages.scrollTop = follow === true || !snapshot ? messages.scrollHeight : Math.max(0, snapshot.scrollTop);
            runtime.conversationFollowBottom = follow === true || !snapshot;
            updateConversationBottomButton(messages);
        };
        restore();
        requestAnimationFrame(restore);
    }

    function scheduleStreamRender() {
        if (runtime.streamRenderFrame) return;
        runtime.streamRenderFrame = requestAnimationFrame(() => {
            runtime.streamRenderFrame = 0;
            const messages = runtime.host?.querySelector?.('.tm-agent-messages');
            const article = messages?.querySelector?.('[data-tm-agent-live]');
            const live = runtime.live;
            if (!(messages instanceof HTMLElement) || !(article instanceof HTMLElement) || !live) {
                render({ followConversation: runtime.conversationFollowBottom !== false });
                return;
            }
            const follow = runtime.conversationFollowBottom !== false;
            const content = article.querySelector('[data-tm-agent-live-content]');
            const status = article.querySelector('[data-tm-agent-live-status]');
            if (content instanceof HTMLElement) content.textContent = String(live.content || '');
            if (status instanceof HTMLElement) {
                status.textContent = text(live.status);
                status.hidden = !text(live.status);
            }
            if (follow) messages.scrollTop = messages.scrollHeight;
            updateConversationBottomButton(messages);
        });
    }

    function scrollConversationToBottom() {
        const messages = runtime.host?.querySelector?.('.tm-agent-messages');
        if (!(messages instanceof HTMLElement)) return;
        runtime.conversationFollowBottom = true;
        try { messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' }); }
        catch (error) { messages.scrollTop = messages.scrollHeight; }
        updateConversationBottomButton(messages);
    }

    function render(options = {}) {
        const host = runtime.host;
        if (!(host instanceof HTMLElement)) return;
        const previousMessages = host.querySelector('.tm-agent-messages');
        const scrollSnapshot = captureConversationScroll(previousMessages);
        const followConversation = typeof options.followConversation === 'boolean'
            ? options.followConversation
            : (scrollSnapshot ? scrollSnapshot.follow : runtime.conversationFollowBottom !== false);
        const entries = sessionEntries();
        const labels = resolvedContextLabels();
        const preset = getPreset(runtime.presetID);
        const live = runtime.live;
        const caps = runtime.capabilities || {};
        const headerTitle = currentSessionHeaderTitle();
        const conversationFontSize = aiBridge()?.getSettings?.()?.aiConversationFontSize;
        host.innerHTML = `<div class="tm-agent-workbench ${runtime.mobile ? 'tm-agent-workbench--mobile' : ''}" style="--tm-agent-conversation-font-size:${conversationFontSizeRem(conversationFontSize)};">
            <header class="tm-agent-header">
                <div class="tm-agent-header__title" title="${esc(headerTitle)}"><span class="tm-agent-status-dot ${caps.mcpEnabled ? 'is-ready' : ''}" aria-hidden="true"></span><span>${esc(headerTitle)}</span></div>
                <div class="tm-agent-header__actions">
                    <button type="button" class="block__icon block__icon--show ariaLabel" data-position="south" data-agent-action="new-session" aria-label="新会话"><svg><use xlink:href="#iconAdd"></use></svg></button>
                    <button type="button" class="block__icon block__icon--show ariaLabel" data-position="south" data-agent-action="open-scheduled-events" aria-label="管理定时事件">${phosphorBoldContextIcon('calendarDots')}</button>
                    <button type="button" class="block__icon block__icon--show ariaLabel" data-position="south" data-agent-action="open-history" aria-label="会话历史"><svg><use xlink:href="#iconHistory"></use></svg></button>
                    ${runtime.mobile ? '<button type="button" class="block__icon block__icon--show ariaLabel" data-position="south" data-agent-action="close-sidebar" aria-label="关闭 AI 对话"><svg><use xlink:href="#iconClose"></use></svg></button>' : ''}
                </div>
            </header>
            <div class="tm-agent-context ${runtime.contextExpanded ? 'is-expanded' : ''}" aria-label="当前上下文">
                <div class="tm-agent-context__items">
                    ${labels.map((item) => `<span class="tm-agent-context__chip"><span>${esc(item.label)}</span><button type="button" data-agent-action="remove-context" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}" aria-label="移除 ${esc(item.label)}"><svg><use xlink:href="#iconClose"></use></svg></button></span>`).join('') || '<span class="tm-agent-context__empty">未选择任务或文档</span>'}
                </div>
                <span class="tm-agent-context__scrollbar" aria-hidden="true"><span class="tm-agent-context__scrollbar-thumb"></span></span>
                <div class="tm-agent-context__actions">
                    <button type="button" class="tm-agent-context__control tm-agent-context__add ariaLabel" data-position="south" data-agent-action="open-context-picker" aria-label="添加任务、文档或当前视图">${phosphorBoldContextIcon('plus')}</button>
                    ${labels.length ? `<button type="button" class="tm-agent-context__control ariaLabel" data-position="south" data-agent-action="clear-context" aria-label="清空上下文">${phosphorBoldContextIcon('broom')}</button><button type="button" class="tm-agent-context__control ariaLabel" data-position="south" data-agent-action="toggle-context-expanded" aria-expanded="${runtime.contextExpanded ? 'true' : 'false'}" aria-label="${runtime.contextExpanded ? '收起上下文' : '展开上下文'}">${phosphorBoldContextIcon(runtime.contextExpanded ? 'caretUp' : 'caretDown')}</button>` : ''}
                </div>
            </div>
            ${renderOnboarding()}
            <div class="tm-agent-messages-shell">
                <main class="tm-agent-messages" aria-live="polite">
                    ${renderConversation(entries, live)}
                    ${!entries.length && !live ? '<div class="tm-agent-empty"><strong>从当前内容开始</strong><span>选择下面的建议，或直接输入你的问题。</span></div>' : ''}
                </main>
                <button type="button" class="tm-agent-scroll-bottom" data-agent-action="scroll-to-bottom" aria-label="回到底部" title="回到底部" hidden>${phosphorBoldContextIcon('caretDown')}</button>
            </div>
            <div class="tm-agent-suggestions">${suggestions().slice(0, 3).map((item, index) => `<button type="button" data-agent-action="suggestion" data-index="${index}">${esc(item.label)}</button>`).join('')}<button type="button" class="block__icon block__icon--show ariaLabel tm-agent-suggestions__settings" data-position="north" data-agent-action="open-presets" aria-label="对话预设设置"><svg><use xlink:href="#iconSettings"></use></svg></button></div>
            <footer class="tm-agent-composer">
                ${runtime.undoAvailable ? `<div class="tm-agent-undo-bar"><span>${runtime.undoCount > 1 ? '本轮写入可整体撤销' : '最近一次写入可撤销'}</span><div class="tm-agent-undo-bar__actions"><button type="button" class="b3-button b3-button--cancel" data-agent-action="undo-last-mutation"><svg aria-hidden="true"><use xlink:href="#iconUndo"></use></svg><span>撤销</span></button><button type="button" class="block__icon block__icon--show ariaLabel tm-agent-undo-bar__close" data-position="north" data-agent-action="dismiss-undo" aria-label="关闭撤销提示"><svg aria-hidden="true"><use xlink:href="#iconClose"></use></svg></button></div></div>` : ''}
                <div class="tm-agent-composer__selections">${preset ? `<div class="tm-agent-preset"><span>${esc(preset.label)}</span><button type="button" data-agent-action="clear-preset" aria-label="清除预设"><svg><use xlink:href="#iconClose"></use></svg></button></div>` : ''}</div>
                <div class="tm-agent-composer__row"><textarea class="b3-text-field" data-agent-draft placeholder="输入问题或任务要求" rows="2" ${runtime.busy ? 'disabled' : ''}>${esc(getDraft())}</textarea>
                ${runtime.busy ? '<button type="button" class="b3-button b3-button--cancel tm-agent-send" data-agent-action="stop" aria-label="停止"><svg><use xlink:href="#iconSquareStop"></use></svg></button>' : '<button type="button" class="b3-button b3-button--text tm-agent-send" data-agent-action="send" aria-label="发送"><svg><use xlink:href="#iconForward"></use></svg></button>'}</div>
                <div class="tm-agent-composer__status" role="status">${esc(runtime.statusText || taskToolStatusText(caps))}</div>
            </footer>
            <div class="tm-agent-task-drop-hint" aria-hidden="true"><span>${phosphorBoldContextIcon('plus')}添加到智能体上下文</span></div>
            ${renderContextPicker()}
            ${renderHistory()}
            ${renderPresetPanel()}
        </div>`;
        const messages = host.querySelector('.tm-agent-messages');
        if (messages instanceof HTMLElement) requestAnimationFrame(() => restoreConversationScroll(messages, scrollSnapshot, followConversation));
        requestAnimationFrame(() => syncContextScrollbar());
        if (runtime.contextPickerOpen) requestAnimationFrame(() => {
            const input = host.querySelector('[data-agent-context-search]');
            if (input instanceof HTMLInputElement) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
            const results = host.querySelector('.tm-agent-context-picker__results');
            if (results instanceof HTMLElement) results.scrollTop = Math.max(0, Number(runtime.contextPickerScrollTop) || 0);
        });
        if (runtime.presetsOpen && runtime.presetEditorID) requestAnimationFrame(() => {
            runtime.host?.querySelector?.('.tm-agent-preset-editor [name="label"]')?.focus?.();
        });
    }

    async function postConfirm(confirmID, approved, always = false) {
        const entry = runtime.session?.entries?.find((item) => item.type === 'confirm' && item.confirmID === confirmID);
        try {
            await postAgentInteraction('/confirm', { confirmID, approved: approved === true, ...(always ? { always: true } : {}) });
            if (entry) entry.status = always ? 'always' : (approved ? 'approved' : 'rejected');
            runtime.statusText = '';
            render();
            saveSession().catch(() => null);
            return true;
        } catch (error) {
            runtime.statusText = `确认提交失败：${text(error?.message || error)}`;
            render();
            return false;
        }
    }

    function automaticConfirmKind(event = {}) {
        if (!text(event.confirmID)) return '';
        if (!isTaskHorizonToolName(event.name)) return '';
        const name = normalizeToolName(event.name);
        const args = interactionArguments(event) || {};
        const action = text(args.action).toLowerCase();
        if (TASK_HORIZON_READ_ONLY_TOOLS.has(name)
            || (TASK_HORIZON_MIXED_READ_TOOLS.has(name) && ['get', 'list', 'query'].includes(action))) return 'read';
        if (name === 'configure_task_reminder' && action === 'apply') return 'reminder';
        if (name === 'create_task' && text(args.action) === 'create') return 'task-create';
        return '';
    }

    async function autoApproveImmediateWriteConfirm(event = {}) {
        await postAgentInteraction('/confirm', { confirmID: text(event.confirmID), approved: true });
    }

    async function postQuestion(questionID, answers) {
        const entry = runtime.session?.entries?.find((item) => item.type === 'question' && item.questionID === questionID);
        try {
            await postAgentInteraction('/question', { questionID, answers });
            if (entry) { entry.status = 'submitted'; entry.answers = answers; }
            runtime.statusText = '';
            render();
            saveSession().catch(() => null);
            return true;
        } catch (error) {
            runtime.statusText = `回答提交失败：${text(error?.message || error)}`;
            render();
            return false;
        }
    }

    async function copyMessage(index, button) {
        const entry = sessionEntries()[Number(index)];
        const copied = await writeClipboardText(entry?.content);
        if (!copied) {
            aiBridge()?.hint?.('复制失败', 'error');
            return false;
        }
        if (button instanceof HTMLElement) {
            button.classList.add('is-copied');
            button.setAttribute('aria-label', '已复制');
            button.innerHTML = phosphorBoldContextIcon('check');
            setTimeout(() => {
                if (!button.isConnected) return;
                button.classList.remove('is-copied');
                button.setAttribute('aria-label', '复制这条消息');
                button.innerHTML = phosphorBoldContextIcon('copy');
            }, 1600);
        }
        return true;
    }

    async function copyCodeBlock(button) {
        const code = button instanceof HTMLElement
            ? button.closest('pre.tm-agent-code-block')?.querySelector(':scope > code')
            : null;
        const copied = await writeClipboardText(code?.textContent || '');
        if (!copied) {
            aiBridge()?.hint?.('复制失败', 'error');
            return false;
        }
        button.classList.add('is-copied');
        button.setAttribute('aria-label', '已复制');
        button.setAttribute('title', '已复制');
        button.innerHTML = phosphorBoldContextIcon('check');
        setTimeout(() => {
            if (!button.isConnected) return;
            button.classList.remove('is-copied');
            button.setAttribute('aria-label', '复制代码块');
            button.setAttribute('title', '复制代码块');
            button.innerHTML = phosphorBoldContextIcon('copy');
        }, 1600);
        return true;
    }

    function frontendActionResult(outcome) {
        if (outcome?.error) return { result: text(outcome.error), isError: true };
        const value = outcome?.result ?? outcome;
        return {
            result: typeof value === 'string' ? value : JSON.stringify(value ?? 'ok'),
            structuredContent: outcome?.structuredContent,
            structuredContentSet: !!outcome && Object.prototype.hasOwnProperty.call(outcome, 'structuredContent'),
            isError: false,
        };
    }

    function frontendCapabilityAllowed(capabilityID) {
        const id = text(capabilityID);
        if (!id) return false;
        const policy = window.siyuan?.config?.ai?.agent?.capabilityPolicy;
        if (!policy || typeof policy !== 'object') return true;
        const overrides = policy.overrides && typeof policy.overrides === 'object' ? policy.overrides : {};
        return String(overrides[id] || policy.default || 'allow') !== 'deny';
    }

    async function invokeFrontendTool(event) {
        const args = event.arguments && typeof event.arguments === 'object' ? event.arguments : {};
        const action = text(args.action);
        let outcome;
        try {
            outcome = frontendActionResult(await globalThis.__taskHorizonInvokeAgentAction?.(action, args));
        } catch (error) {
            outcome = { result: text(error?.message || error) || '前端操作失败', isError: true };
        }
        await postAgentInteraction('/frontendToolResult', { callID: event.callID, result: outcome.result, isError: outcome.isError });
    }

    async function invokeBrowserCapability(event) {
        const capabilityID = text(event.capabilityID);
        const args = event.arguments && typeof event.arguments === 'object' ? event.arguments : {};
        let outcome;
        try {
            if (!frontendCapabilityAllowed(capabilityID)) throw new Error(`前端能力已在思源设置中关闭：${capabilityID}`);
            const descriptors = Array.isArray(globalThis.__taskHorizonFrontendCapabilityDescriptors)
                ? globalThis.__taskHorizonFrontendCapabilityDescriptors
                : [];
            const descriptor = descriptors.find((item) => text(item?.id) === capabilityID);
            if (!descriptor || (Number(event.generation) > 0 && Number(descriptor.generation) !== Number(event.generation))) {
                throw new Error(`前端能力不可用：${capabilityID}`);
            }
            outcome = frontendActionResult(await globalThis.__taskHorizonInvokeAgentAction?.(capabilityID, args));
        } catch (error) {
            outcome = { result: text(error?.message || error) || '前端能力执行失败', isError: true };
        }
        await postAgentInteraction('/browserCapabilityResult', {
            callID: event.callID,
            result: outcome.result,
            ...(outcome.structuredContentSet ? {
                structuredContent: outcome.structuredContent,
                structuredContentSet: true,
            } : {}),
            isError: outcome.isError,
        });
    }

    function normalizeSSEEvent(name, data) {
        if (name === 'content') return { type: name, token: String(data.token || '') };
        if (name === 'reasoning') return { type: name, token: String(data.token || '') };
        if (name === 'thinking') return { type: name, reasoning: String(data.reasoning || '') };
        if (name === 'error') return { type: name, message: String(data.message || data.error || '') };
        return { type: name, ...data };
    }

    class AgentClient {
        async chat(request, onEvent, signal) {
            const response = await fetch(`${API_ROOT}/chat`, {
                method: 'POST',
                headers: agentHeaders(),
                body: JSON.stringify(request),
                signal,
            });
            if (!response.ok) {
                let message = `智能体请求失败 (${response.status})`;
                try { message = text((await response.json())?.msg) || message; } catch (error) {}
                throw new Error(message);
            }
            if (!(response.headers.get('Content-Type') || '').includes('text/event-stream')) {
                const payload = await response.json().catch(() => null);
                throw new Error(text(payload?.msg || payload?.message) || '智能体尚未配置可用模型');
            }
            const reader = response.body?.getReader();
            if (!reader) throw new Error('无法读取智能体响应');
            const decoder = new TextDecoder();
            let buffer = '';
            let eventName = '';
            let terminalReceived = false;
            const emit = async (name, payload) => {
                const event = normalizeSSEEvent(name, payload);
                if (event.type === 'done' || event.type === 'error' || event.type === 'interrupted') terminalReceived = true;
                await onEvent(event);
            };
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                buffer += decoder.decode(chunk.value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const raw of lines) {
                    const line = raw.replace(/\r$/, '');
                    if (line.startsWith('event:')) eventName = line.slice(6).trim();
                    else if (line.startsWith('data:') && eventName) {
                        const json = line.slice(5).trim();
                        if (!json) continue;
                        let payload;
                        try { payload = JSON.parse(json); } catch (error) { continue; }
                        await emit(eventName, payload);
                        eventName = '';
                    }
                }
            }
            buffer += decoder.decode();
            for (const raw of buffer.split('\n')) {
                const line = raw.replace(/\r$/, '');
                if (line.startsWith('event:')) eventName = line.slice(6).trim();
                else if (line.startsWith('data:') && eventName) {
                    const json = line.slice(5).trim();
                    if (!json) continue;
                    let payload;
                    try { payload = JSON.parse(json); } catch (error) { continue; }
                    await emit(eventName, payload);
                    eventName = '';
                }
            }
            if (!terminalReceived && !signal?.aborted) {
                throw new Error('智能体连接意外中断，未收到完整终态');
            }
        }
    }

    const client = new AgentClient();

    async function buildReferences(omitTaskReferences = false) {
        const refs = [];
        const labels = resolvedContextLabels();
        labels.forEach((item) => {
            if ((item.kind === 'task' && !omitTaskReferences && isTaskBlockID(item.id)) || item.kind === 'document') refs.push({ id: item.id, title: item.label });
        });
        return refs;
    }

    function mergeTaskReadScopes(scopes) {
        const taskIDs = new Set();
        const documentIDs = new Set();
        const taskValues = new Map();
        const virtualTasks = new Map();
        (Array.isArray(scopes) ? scopes : []).forEach((scope) => {
            (Array.isArray(scope?.taskIDs) ? scope.taskIDs : []).map(text).filter(Boolean).forEach((id) => taskIDs.add(id));
            (Array.isArray(scope?.documentIDs) ? scope.documentIDs : []).map(text).filter(Boolean).forEach((id) => documentIDs.add(id));
            (Array.isArray(scope?.taskValues) ? scope.taskValues : []).forEach((item) => {
                const id = text(item?.id);
                if (id) taskValues.set(id, item);
            });
            (Array.isArray(scope?.virtualTasks) ? scope.virtualTasks : []).forEach((item) => {
                const id = text(item?.id);
                if (id) virtualTasks.set(id, item);
            });
        });
        return {
            taskIDs: Array.from(taskIDs),
            documentIDs: Array.from(documentIDs),
            taskValues: Array.from(taskValues.values()),
            virtualTasks: Array.from(virtualTasks.values()),
        };
    }

    function isScheduledEventListIntent(value) {
        const input = text(value);
        return /(查看|列出|查询|显示|有哪些|多少).{0,8}(定时|计划).{0,4}(事件|任务|提醒)|(?:定时|计划).{0,4}(事件|任务|提醒).{0,8}(查看|列出|查询|显示|有哪些|多少)/.test(input);
    }

    function isScheduledEventHelpIntent(value) {
        const input = text(value);
        if (!input) return false;
        return /(?:你|目前|现在)?\s*(?:有|支持|提供|具备)?\s*(?:哪些|什么).{0,6}(?:定时|计划).{0,4}(?:功能|能力)|(?:定时|计划).{0,4}(?:功能|能力).{0,8}(?:有哪些|是什么|怎么用|支持什么)/.test(input);
    }

    function isScheduledEventCreateIntent(value) {
        const input = text(value);
        if (!input || isScheduledEventListIntent(input) || isScheduledEventHelpIntent(input)) return false;
        const hasSchedule = /(定时|提醒|每天|每日|每个工作日|工作日|每周|单次|一次|到点|今天|明天|后天)/.test(input);
        const hasCommand = /(创建|新建|设置|添加|安排|帮我|请|提醒|总结|执行)/.test(input);
        const hasTime = /\b\d{1,2}:\d{2}\b|(?:凌晨|早上|上午|中午|下午|晚上)?\s*[零〇一二两三四五六七八九十\d]{1,3}\s*(?:点|时)/.test(input);
        return hasSchedule && hasCommand && hasTime;
    }

    function isReminderModeChoiceIntent(value) {
        const input = text(value);
        if (!input || isScheduledEventListIntent(input) || isScheduledEventHelpIntent(input)) return false;
        if (isScheduledEventCreateIntent(input)) return true;
        if (/(怎么|如何|说明|介绍|支持什么|有哪些).{0,12}提醒|提醒.{0,12}(怎么|如何|说明|介绍|支持什么|有哪些)/.test(input)) return false;
        return /(?:创建|新建|设置|添加|安排|帮我|请).{0,16}(?:任务)?提醒|提醒我/.test(input);
    }

    function reminderIntentInstruction(value) {
        if (!isReminderModeChoiceIntent(value)) return '';
        return '\n\n提醒意图选择：执行任何写入前，必须先调用思源 question 工具单选询问“这次要设置哪种提醒？”。选项固定为：AI 定时任务（到点后让智能体执行指令）、跟随任务提醒（根据要求时间直接设置截止日期并默认同步完成任务）、独立提醒（固定日期或独立重复）；multiple=false，custom=false。用户选择后立即继续，禁止自行猜测，也禁止追加写入确认。选择跟随任务提醒后，直接从用户原话解析日期和时间并传入 follow.date（YYYY-MM-DD）与 follow.times。用户说“今天/今晚”时日期唯一确定为当日，只有说“明天/明晚”时才使用次日；禁止调用 question 询问截止日期，禁止生成“今天/明天”或任何其他日期候选。configure_task_reminder 使用 action=apply 单次直接写入，不要先调用预览，也不要再索要 previewToken。没有由上下文明确绑定真实任务块时，必须先从用户原话提炼不含日期、时间和“提醒我”等命令词的任务核心词，调用 query_tasks（action=query、filters.keyword=核心词，且 filters 不传 scopeToken、ids 或 documentIDs）检索全部任务；不要沿用当前视图的范围令牌。优先选择未完成且标题完全一致的任务，其次选择语义明确对应的未完成任务，并把其 taskID 传给 configure_task_reminder；有多个合理候选时用 question 让用户选择目标任务。只有没有合理候选时才省略 taskID，传入 taskTitle 和插件默认新建位置 documentID，且不要先调用 create_task。提醒工具仍会按可见标题在全部任务中先精确、再模糊兜底匹配，少量错字也会优先绑定未完成任务，只有两种匹配都找不到时才创建任务并立即设置提醒；执行时会同时写入任务截止日期，也不询问跟随开始日期、日期偏移或是否同步完成。';
    }

    function isTaskCreationIntent(value) {
        const input = text(value);
        return /(?:创建|新建|添加).{0,10}(?:任务|待办)|(?:任务|待办).{0,10}(?:创建|新建|添加)/.test(input);
    }

    async function taskCreationDestinationInstruction(value) {
        const taskCreation = isTaskCreationIntent(value);
        const reminderCreation = isReminderModeChoiceIntent(value);
        if (!taskCreation && !reminderCreation) return '';
        let destinations = null;
        try { destinations = await aiBridge()?.getTaskCreationDestinations?.() || null; } catch (error) {}
        const defaultTarget = destinations?.defaultTarget;
        const pinned = Array.isArray(destinations?.pinned) ? destinations.pinned : [];
        const available = [defaultTarget, ...pinned]
            .filter((item) => text(item?.id))
            .filter((item, index, list) => list.findIndex((other) => text(other?.id) === text(item?.id)) === index);
        if (!available.length) return '\n\n创建任务位置：插件未配置可用的默认新建文档，当前分组也没有可用的置顶文档。只有确实需要新建任务（包括没有任务块的跟随或独立提醒）时，才调用思源 question 工具询问“创建到哪个文档？”，multiple=false，custom=true，让用户手动输入文档名；随后先用思源文档搜索能力解析真实文档 ID，同名或结果不明确时继续确认。';
        const mapping = available.map((item, index) => `${index + 1}. ${text(item.label) || '未命名文档'}（documentID：${text(item.id)}${item === defaultTarget ? '，默认新建位置' : '，置顶文档'}）`).join('\n');
        if (defaultTarget) {
            return `\n\n创建任务位置（本轮实时）：\n${mapping}\n用户没有明确指定目标文档时，单个任务直接调用 create_task 并使用插件默认新建位置 documentID：${text(defaultTarget.id)}；不要询问位置、不要预览、不要要求额外确认。只有用户明确指定其他文档时才使用对应位置。设置跟随任务提醒或独立提醒但没有真实任务块时，先调用 query_tasks 用任务核心词检索全部任务，filters 不传 scopeToken、ids 或 documentIDs；有明确匹配时把已有 taskID 传给 configure_task_reminder。只有没有合理候选时才省略 taskID，传入简短任务标题 taskTitle 和默认 documentID：${text(defaultTarget.id)}，且不要先调用 create_task。工具还会按可见标题先精确、再模糊查重，少量错字也会匹配，只有都找不到时才在默认位置创建承载任务并立即写入提醒。提醒类型已经通过 question 选择后不得再询问位置或写入确认。`;
        }
        return `\n\n创建任务位置（本轮实时）：\n${mapping}\n当前没有可用的插件默认新建位置。确实需要新建任务时，调用思源 question 工具单选询问“创建到哪个文档？”，固定选项使用上面的文档名称，multiple=false，custom=true，允许用户手动输入其他文档名。用户选择固定项时使用对应 documentID；手动输入名称时先解析真实文档 ID，同名或结果不明确时继续确认。`;
    }

    async function customFieldHierarchyInstruction() {
        let definitions = [];
        try { definitions = await kernelCall('taskHorizonGetCustomFieldDefinitions'); } catch (error) { return ''; }
        const hierarchical = (Array.isArray(definitions) ? definitions : []).map((field) => ({
            fieldID: text(field?.id),
            label: text(field?.label),
            type: text(field?.type),
            options: (Array.isArray(field?.options) ? field.options : []).map((option) => ({
                id: text(option?.id),
                label: text(option?.label),
                parentID: text(option?.parentID),
                ancestorIDs: Array.isArray(option?.ancestorIDs) ? option.ancestorIDs.map(text).filter(Boolean) : [],
                path: text(option?.path),
                archived: option?.archived === true,
                effectiveArchived: option?.effectiveArchived === true,
            })),
        })).filter((field) => field.fieldID && field.options.some((option) => option.parentID || option.archived || option.effectiveArchived));
        if (!hierarchical.length) return '';
        return `\n\n自定义标签层级（本轮实时、只读定义）：${JSON.stringify(hierarchical)}。任务 customFieldValues 仍保存直接选中的标签，不保存完整路径；子标签同时归属于 ancestorIDs 中的所有父级。归档标签仍是有效历史数据。需要层级统计时调用 aggregate_task_stats 并传 customFieldIDs，hierarchyItems.totalCount 是包含后代且按任务去重的汇总，directCount 是直接选择数。只有实际改选标签时才写任务 patch。`;
    }

    async function sendMessage(textOverride) {
        if (runtime.busy) return;
        const raw = text(textOverride != null ? textOverride : getDraft());
        const preset = getPreset(runtime.presetID);
        const userText = raw || text(preset?.starter);
        if (!userText) return;
        if (!await ensureTaskToolsReadyForSend()) return;
        await syncDocumentGroupSnapshot();
        if (!runtime.activeSessionID) createSession();
        const currentViewSnapshot = await syncCurrentViewContext();
        if (runtime.context.scope && !text(currentViewSnapshot?.scopeToken)) {
            runtime.statusText = runtime.statusText || '无法注册完整任务范围，请稍后重试';
            render();
            return;
        }
        let selectedTaskSnapshot = null;
        if (!runtime.context.scope && (runtime.context.taskIDs.length > 0 || runtime.context.documentIDs.length > 0)) {
            try {
                const readScopes = [];
                if (runtime.context.taskIDs.length > 0) {
                    readScopes.push(await aiBridge()?.getTaskReadScope?.(runtime.context.taskIDs) || {
                        taskIDs: runtime.context.taskIDs.filter(isTaskBlockID),
                        taskValues: await aiBridge()?.getTaskReadValues?.(runtime.context.taskIDs.filter(isTaskBlockID)) || [],
                        virtualTasks: [],
                    });
                }
                if (runtime.context.documentIDs.length > 0) {
                    readScopes.push(await aiBridge()?.getDocumentTaskReadScope?.(runtime.context.documentIDs) || {
                        documentIDs: runtime.context.documentIDs.slice(),
                        taskIDs: [],
                        taskValues: [],
                        virtualTasks: [],
                    });
                }
                const readScope = mergeTaskReadScopes(readScopes);
                selectedTaskSnapshot = await kernelCall('taskHorizonRegisterTaskScope', {
                    scopeID: `context:${runtime.context.taskIDs.length}:${runtime.context.documentIDs.slice().sort().join(',')}`,
                    scopeMode: runtime.context.documentIDs.length ? 'documents' : 'tasks',
                    taskIDs: runtime.context.documentIDs.length
                        ? runtime.context.taskIDs.filter(isTaskBlockID)
                        : (Array.isArray(readScope.taskIDs) ? readScope.taskIDs : []),
                    documentIDs: runtime.context.documentIDs.slice(),
                    taskValues: Array.isArray(readScope.taskValues) ? readScope.taskValues : [],
                    virtualTasks: Array.isArray(readScope.virtualTasks) ? readScope.virtualTasks : [],
                });
            } catch (error) {
                runtime.statusText = `上下文任务范围注册失败：${text(error?.message || error)}`;
                render();
                return;
            }
        }
        const creationDestinationInstruction = await taskCreationDestinationInstruction(userText);
        const customFieldInstruction = await customFieldHierarchyInstruction();
        const basePrompt = `${preset ? `${preset.prompt}\n\n用户请求：${userText}` : userText}${creationDestinationInstruction}${reminderIntentInstruction(userText)}${customFieldInstruction}`;
        const taskScopeSnapshot = currentViewSnapshot || selectedTaskSnapshot;
        const taskScopeLabel = currentViewSnapshot
            ? (text(runtime.context.scope?.label) || '当前任务视图')
            : (runtime.context.taskIDs.length && runtime.context.documentIDs.length
                ? '已选任务与文档'
                : (runtime.context.documentIDs.length ? '已选文档中的任务' : '已选任务'));
        const taskScopeCount = currentViewSnapshot
            ? Math.max(0, Number(currentViewSnapshot.visibleTaskCount ?? runtime.context.scope?.visibleTaskCount) || 0)
            : Math.max(0, Number(selectedTaskSnapshot?.taskCount) || 0);
        const taskScopeToken = text(taskScopeSnapshot?.scopeToken);
        const containerScopeToken = text(currentViewSnapshot?.containerScopeToken || taskScopeToken);
        const alternateScopeHint = currentViewSnapshot && containerScopeToken && containerScopeToken !== taskScopeToken
            ? `用户要求当前界面以外的时间、完成状态、优先级或状态范围时，改用 containerScopeToken：${containerScopeToken}，并在 query_tasks.filters 中传 done、dateRange、overdue、priorities、customStatuses 或 includeVirtual；默认仍使用当前视图 scopeToken。`
            : '';
        const virtualScheduleHint = Number(taskScopeSnapshot?.virtualTaskCount) > 0
            ? `当前范围含循环虚拟实例。虚拟实例本身仍只读，不能更新、移动、删除或配置任务提醒；但可以为某次实例安排日程：使用 query_tasks 的 includeVirtual 查询实例，把其 repeatinst ID 作为 taskId，并把当前 scopeToken（${taskScopeToken}）传给 create_schedule 或重新关联它的 update_schedule。batch_schedules 与 apply_task_operation_plan 中每个关联虚拟实例的日程 create/update 操作也要各自携带该 scopeToken。只有修改来源任务本身时才改用 sourceTaskID。`
            : '';
        const scopeHint = taskScopeSnapshot
            ? `\n\n当前任务范围（本轮实时）：${taskScopeLabel}；任务数：${taskScopeCount}；scopeToken：${taskScopeToken}。调用 query_tasks 时把该令牌放入 filters.scopeToken；调用 aggregate_task_stats 或 aggregate_time_usage 时放入顶层 scopeToken。${alternateScopeHint}${virtualScheduleHint}令牌代表完整范围，不要索取或复述全部任务 ID；明细按游标分页，统计直接使用聚合工具。若令牌过期，再调用 Task Horizon 的 get_task_view_context 前端动作获取新令牌；禁止复用之前轮次的范围。`
            : '';
        const prompt = `${basePrompt}${scopeHint}`;
        const omitDirectTaskReferences = !runtime.context.scope && runtime.context.taskIDs.length > MAX_DIRECT_TASK_REFERENCES;
        const refs = await buildReferences(omitDirectTaskReferences);
        const taskIDs = runtime.context.taskIDs.slice();
        const documentIDs = runtime.context.documentIDs.slice();
        const directTaskIDs = omitDirectTaskReferences ? [] : taskIDs.filter(isTaskBlockID);
        const editorContext = {
            activeDocID: documentIDs[0] || undefined,
            focusedBlockID: directTaskIDs[0] || undefined,
            selectedBlockIDs: Array.from(new Set([...directTaskIDs, ...documentIDs])),
        };
        setDraft('');
        runtime.busy = true;
        runtime.roundUndoIDs = [];
        runtime.conversationFollowBottom = true;
        runtime.statusText = '智能体正在处理...';
        runtime.live = { content: '', status: '正在连接', toolCalls: [] };
        runtime.abortController = new AbortController();
        rememberSession(runtime.activeSessionID);
        let turnID = '';
        try {
            const prepared = await prepareConversationTurn(runtime.activeSessionID, prompt, runtime.session?.title, {
                displayPrompt: userText,
                references: refs,
                editorContext,
                titled: runtime.session?.titled === true,
            });
            runtime.activeSessionID = prepared.sessionID;
            runtime.session = prepared.session;
            render();
            const request = {
                message: prompt,
                language: window.siyuan?.config?.appearance?.lang || 'zh_CN',
                references: refs,
                sessionID: runtime.activeSessionID,
                editorContext,
                pluginActions: Array.isArray(globalThis.__taskHorizonAgentActionDescriptors) ? globalThis.__taskHorizonAgentActionDescriptors : [],
                frontendCapabilities: Array.isArray(globalThis.__taskHorizonFrontendCapabilityDescriptors) ? globalThis.__taskHorizonFrontendCapabilityDescriptors : [],
                userEntryID: prepared.userEntryID,
                contentRevision: prepared.revision,
            };
            await client.chat(request, async (event) => {
                if (event.type === 'turn') {
                    turnID = text(event.turnID) || turnID;
                    return;
                }
                if (event.type === 'content') {
                    runtime.live.content += event.token || '';
                    scheduleStreamRender();
                    return;
                }
                if (event.type === 'reasoning') {
                    runtime.live.status = '正在推理';
                    scheduleStreamRender();
                    return;
                }
                if (event.type === 'thinking') {
                    runtime.live.status = text(event.reasoning) || '正在思考';
                    scheduleStreamRender();
                    return;
                }
                if (event.type === 'tool_call') runtime.live.toolCalls.push({
                    callID: text(event.callID || event.callId || event.id),
                    name: toolCallName(event),
                    arguments: event.arguments ?? event.args ?? event.function?.arguments,
                    result: '',
                    completed: false,
                });
                else if (event.type === 'tool_result') {
                    const eventCallID = text(event.callID || event.callId || event.id);
                    const eventName = normalizeToolName(toolCallName(event));
                    const call = [...runtime.live.toolCalls].reverse().find((item) => {
                        if (item.result) return false;
                        if (eventCallID && text(item.callID) === eventCallID) return true;
                        return eventName && normalizeToolName(toolCallName(item)) === eventName;
                    });
                    if (call) {
                        call.result = typeof event.result === 'string' ? event.result : JSON.stringify(event.result ?? '');
                        call.completed = true;
                        await applyDomainResultEffects(call.name, call.result);
                        const undoID = toolResultUndoID(call.result);
                        if (undoID && canUndoToolResult(call.name, call.result)) {
                            registerRoundUndo(undoID);
                        }
                    }
                } else if (event.type === 'confirm') {
                    const immediateKind = automaticConfirmKind(event);
                    if (immediateKind) {
                        try {
                            await autoApproveImmediateWriteConfirm(event);
                            runtime.live.status = immediateKind === 'read'
                                ? '正在读取任务数据'
                                : (immediateKind === 'task-create' ? '正在新建任务' : '正在写入提醒');
                        } catch (error) {
                            runtime.session.entries.push({ id: newID(), type: 'confirm', name: event.name, args: event.arguments, confirmID: event.confirmID, effects: event.effects, status: 'pending' });
                            runtime.live.status = '';
                        }
                    } else {
                        runtime.session.entries.push({ id: newID(), type: 'confirm', name: event.name, args: event.arguments, confirmID: event.confirmID, effects: event.effects, status: 'pending' });
                        runtime.live.status = '';
                    }
                } else if (event.type === 'question') {
                    const args = interactionArguments(event);
                    const questions = normalizeQuestions(event.questions ?? args?.questions ?? args);
                    runtime.session.entries.push({
                        id: newID(),
                        type: 'question',
                        questionID: text(event.questionID || event.questionId || event.id),
                        questions,
                    });
                    runtime.live.status = '';
                } else if (event.type === 'frontend_tool_call') await invokeFrontendTool(event);
                else if (event.type === 'browser_capability_call') await invokeBrowserCapability(event);
                else if (event.type === 'snapshot') {
                    settleLiveBeforeInteraction();
                    runtime.session.entries.push({ id: newID(), type: 'snapshot', snapshotID: event.snapshotID });
                }
                else if (event.type === 'error') throw new Error(text(event.message) || '智能体执行失败');
                else if (event.type === 'interrupted') throw new Error(text(event.message) || '智能体响应已中断');
                else if (event.type === 'done') {
                    turnID = text(event.turnID) || turnID;
                    runtime.live.status = '';
                    runtime.live.done = true;
                }
                render();
            }, runtime.abortController.signal);
            const live = runtime.live;
            if (live && (text(live.content) || (Array.isArray(live.toolCalls) && live.toolCalls.length))) {
                runtime.session.entries.push({
                    id: newID(),
                    type: 'assistant',
                    content: String(live.content || ''),
                    toolCalls: clone(live.toolCalls || []),
                    timestamp: Date.now(),
                });
            }
            await saveSession(turnID);
            await listSessions();
        } catch (error) {
            const recovered = turnID ? await recoverConversationSession(runtime.activeSessionID, turnID).catch(() => null) : null;
            if (recovered) runtime.session = recovered;
            if (error?.name !== 'AbortError' && !recovered) {
                const live = runtime.live;
                if (live && (text(live.content) || (Array.isArray(live.toolCalls) && live.toolCalls.length))) {
                    runtime.session.entries.push({
                        id: newID(),
                        type: 'assistant',
                        content: String(live.content || ''),
                        toolCalls: clone(live.toolCalls || []),
                        timestamp: Date.now(),
                    });
                }
                runtime.session.entries.push({ id: newID(), type: 'assistant', content: `请求失败：${text(error?.message || error)}`, timestamp: Date.now() });
            }
            if (!turnID) {
                try { await saveSession(); } catch (saveError) {}
            }
        } finally {
            const undoGroupError = await finalizeRoundUndoBatch();
            runtime.busy = false;
            runtime.abortController = null;
            runtime.live = null;
            runtime.statusText = undoGroupError;
            render();
            if (runtime.session?.titled === false) tryGenerateSessionTitle();
        }
    }

    function stop() {
        runtime.abortController?.abort?.();
        runtime.statusText = '已停止';
    }

    function applyPreset(id, draft) {
        runtime.presetID = getPreset(id) ? id : '';
        if (draft != null) setDraft(draft);
        else if (runtime.presetID && !getDraft()) setDraft(getPreset(runtime.presetID)?.starter || '');
        scheduleSave();
        render();
        runtime.host?.querySelector?.('[data-agent-draft]')?.focus?.();
    }

    async function resolveOpenContext(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const hasExplicitContext = !!text(source.taskID || source.taskId || source.documentID || source.documentId || source.docID || source.docId || source.contextScope)
            || (Array.isArray(source.selectedTaskIds) && source.selectedTaskIds.length > 0)
            || (Array.isArray(source.selectedDocIds) && source.selectedDocIds.length > 0);
        if (!hasExplicitContext) {
            void enrichContextLabels();
            return;
        }
        const taskIDs = Array.from(new Set([
            source.taskID, source.taskId,
            ...(Array.isArray(source.selectedTaskIds) ? source.selectedTaskIds : []),
        ].map(text).filter(isTaskContextID)));
        const documentIDs = Array.from(new Set([
            source.documentID, source.documentId, source.docID, source.docId,
            ...(Array.isArray(source.selectedDocIds) ? source.selectedDocIds : []),
        ].map(text).filter(Boolean)));
        if (!taskIDs.length && source.contextScope === 'current_task') {
            const currentTaskID = text(aiBridge()?.getCurrentTaskId?.());
            if (currentTaskID) taskIDs.push(currentTaskID);
        }
        if (!documentIDs.length && source.contextScope === 'current_doc') {
            const currentDocID = text(aiBridge()?.getCurrentDocId?.());
            if (currentDocID) documentIDs.push(currentDocID);
        }
        runtime.context = {
            taskIDs,
            documentIDs,
            scope: source.contextScope === 'current_group' || source.contextScope === 'current_view'
                ? { type: source.contextScope, id: text(aiBridge()?.getCurrentGroupId?.()) || 'current', label: source.contextScope === 'current_group' ? '当前分区' : '当前任务视图' }
                : null,
        };
        if (runtime.context.scope) await syncCurrentViewContext();
        scheduleSave();
        void enrichContextLabels();
    }

    function presetFromPayload(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        if (getPreset(source.presetID)) return source.presetID;
        if (source.type === 'smart') return 'smart-review';
        if (source.type === 'schedule') return 'task-planning';
        if (source.type === 'summary') return 'task-review';
        return '';
    }

    async function openSidebar(payload) {
        await ensureStoreLoaded();
        runtime.contextPickerOpen = false;
        runtime.contextPickerSearchSeq += 1;
        await resolveOpenContext(payload || {});
        const requestedSessionID = text(payload?.sessionID || payload?.conversationID);
        if (requestedSessionID) await loadSession(requestedSessionID);
        const presetID = presetFromPayload(payload);
        if (presetID) applyPreset(presetID, payload?.draft || payload?.prompt);
        else if (payload?.draft != null || payload?.prompt != null) {
            setDraft(payload?.draft != null ? payload.draft : payload.prompt);
            scheduleSave();
        }
        if (payload?.showHistory) {
            runtime.historyOpen = true;
            await listSessions();
        }
        render();
        if (payload?.autorun === true) await sendMessage();
        return true;
    }

    async function openWorkbench(payload) {
        const openPanel = aiBridge()?.openAiPanel || globalThis.tmOpenAiSidebar;
        if (typeof openPanel === 'function') return await openPanel(payload || {});
        return await openSidebar(payload || {});
    }

    async function mountSidebar(host, options) {
        if (!(host instanceof HTMLElement) || !host.isConnected) return false;
        const previousHost = runtime.host;
        if (previousHost && previousHost !== host) {
            runtime.hostListenerController?.abort?.();
            runtime.hostListenerController = null;
            if (previousHost.dataset.tmAgentWorkbenchBound === WORKBENCH_BINDING_TOKEN) {
                delete previousHost.dataset.tmAgentWorkbenchBound;
            }
        }
        runtime.host = host;
        runtime.mobile = options?.mobile === true;
        if (!runtime.mounted) {
            runtime.mounted = true;
            await ensureStoreLoaded();
            await Promise.all([getCapabilities(), listSessions()]);
            if (runtime.capabilities?.mcpEnabled) await syncBuiltinSkills();
            else startCapabilityRetry();
            if (runtime.activeSessionID) await loadSession(runtime.activeSessionID);
            else createSession();
        }
        if (!host.isConnected || runtime.host !== host) return false;
        if (!runtime.viewContextListener) {
            runtime.viewContextListener = scheduleCurrentViewContextSync;
            window.addEventListener('tm:filtered-tasks-updated', runtime.viewContextListener);
        }
        if (typeof ResizeObserver === 'function') {
            if (!runtime.contextResizeObserver) runtime.contextResizeObserver = new ResizeObserver(() => syncContextScrollbar());
            runtime.contextResizeObserver.disconnect();
            runtime.contextResizeObserver.observe(host);
        }
        if (runtime.context.scope) void syncCurrentViewContext({ render: true });
        const listenerActive = runtime.hostListenerController && runtime.hostListenerController.signal.aborted !== true;
        if (!listenerActive || host.dataset.tmAgentWorkbenchBound !== WORKBENCH_BINDING_TOKEN) {
            runtime.hostListenerController?.abort?.();
            runtime.hostListenerController = new AbortController();
            host.dataset.tmAgentWorkbenchBound = WORKBENCH_BINDING_TOKEN;
            const listenerSignal = runtime.hostListenerController.signal;
            const listen = (type, listener, options = {}) => {
                const normalized = typeof options === 'boolean' ? { capture: options } : options;
                host.addEventListener(type, listener, { ...normalized, signal: listenerSignal });
            };
            listen('submit', (event) => {
                const renameForm = event.target?.closest?.('[data-agent-session-rename]');
                if (renameForm) {
                    event.preventDefault();
                    void renameSession(renameForm.dataset.agentSessionRename, renameForm.elements?.title?.value);
                    return;
                }
                const form = event.target?.closest?.('[data-preset-editor-id]');
                if (!form) return;
                event.preventDefault();
                form.querySelector('[data-agent-action="save-preset"]')?.click?.();
            });
            listen('input', (event) => {
                if (event.target?.matches?.('[data-agent-draft]')) setDraft(event.target.value);
                else if (event.target?.matches?.('[data-agent-context-search]')) {
                    runtime.contextPickerQuery = String(event.target.value || '');
                    clearTimeout(contextSearchTimer);
                    contextSearchTimer = setTimeout(() => {
                        contextSearchTimer = 0;
                        void searchContextPicker(runtime.contextPickerQuery);
                    }, 180);
                }
            });
            listen('change', (event) => {
                if (event.target?.matches?.('[data-agent-preset-template]')) fillPresetEditorFromBuiltin(event.target);
            });
            listen('scroll', (event) => {
                const target = event.target;
                if (target instanceof HTMLElement && target.matches('.tm-agent-context-picker__results')) {
                    runtime.contextPickerScrollTop = target.scrollTop;
                } else if (target instanceof HTMLElement && target.matches('.tm-agent-context__items')) {
                    syncContextScrollbar(true);
                } else if (target instanceof HTMLElement && target.matches('.tm-agent-messages')) {
                    runtime.conversationFollowBottom = shouldFollowConversation(target);
                    updateConversationBottomButton(target);
                }
            }, true);
            listen('wheel', (event) => {
                const context = event.target?.closest?.('.tm-agent-context');
                const items = context?.querySelector?.('.tm-agent-context__items');
                if (!(context instanceof HTMLElement) || !(items instanceof HTMLElement) || runtime.contextExpanded || items.scrollWidth <= items.clientWidth) return;
                const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
                if (!rawDelta) return;
                const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
                    ? 16
                    : (event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? items.clientWidth : 1);
                const previous = items.scrollLeft;
                items.scrollLeft += rawDelta * unit;
                if (items.scrollLeft === previous) return;
                event.preventDefault();
                syncContextScrollbar(true);
            }, { passive: false });
            listen('mousedown', (event) => {
                const option = event.target?.closest?.('.agent-chat__question-option');
                const input = option?.querySelector?.('input');
                questionOptionMouseState = input?.type === 'radio' ? { input, wasChecked: input.checked } : null;
            });
            listen('pointerdown', (event) => {
                const thumb = event.target?.closest?.('.tm-agent-context__scrollbar-thumb');
                if (!thumb || !beginContextScrollbarDrag(event, thumb)) return;
                event.preventDefault();
            });
            listen('pointermove', (event) => {
                if (!moveContextScrollbarDrag(event)) return;
                event.preventDefault();
            });
            listen('pointerup', (event) => { endContextScrollbarDrag(event); });
            listen('pointercancel', (event) => { endContextScrollbarDrag(event); });
            listen('dragenter', (event) => {
                if (!isTaskContextDataTransfer(event.dataTransfer)) return;
                event.preventDefault();
                setTaskContextDropState(true);
            });
            listen('dragover', (event) => {
                if (!isTaskContextDataTransfer(event.dataTransfer)) return;
                event.preventDefault();
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
                setTaskContextDropState(true);
            });
            listen('dragleave', (event) => {
                const related = event.relatedTarget;
                if (related instanceof Node && host.contains(related)) return;
                clearTaskContextDropState();
            });
            listen('drop', (event) => {
                const payload = readTaskContextDataTransfer(event.dataTransfer);
                if (!payload.taskIDs.length) return;
                event.preventDefault();
                event.stopPropagation();
                addDraggedTasksToContext(payload);
            });
            listen('keydown', (event) => {
                if (event.key === 'Escape') {
                    const renameForm = event.target?.closest?.('[data-agent-session-rename]');
                    const openMenu = host.querySelector('.tm-agent-history__row.is-menu-open');
                    if (renameForm || openMenu) {
                        event.preventDefault();
                        if (renameForm) render();
                        else openMenu.classList.remove('is-menu-open');
                        return;
                    }
                }
                if (event.key === 'Escape' && runtime.presetsOpen && runtime.presetEditorID) {
                    event.preventDefault();
                    runtime.presetEditorID = '';
                    render();
                    return;
                }
                if (event.target?.matches?.('[data-agent-context-search]')) {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        clearTimeout(contextSearchTimer);
                        contextSearchTimer = 0;
                        void searchContextPicker(event.target.value);
                    } else if (event.key === 'Escape') {
                        event.preventDefault();
                        clearTimeout(contextSearchTimer);
                        contextSearchTimer = 0;
                        runtime.contextPickerOpen = false;
                        runtime.contextPickerSearchSeq += 1;
                        render();
                    }
                    return;
                }
                if (!event.target?.matches?.('[data-agent-draft]')) return;
                if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && !event.shiftKey && !event.altKey) {
                    event.preventDefault();
                    void sendMessage();
                } else if (event.key === 'Escape' && runtime.busy) {
                    event.preventDefault();
                    stop();
                }
            });
            listen('click', async (event) => {
                const questionOption = event.target?.closest?.('.agent-chat__question-option');
                const questionInput = questionOption?.querySelector?.('input');
                if (questionInput?.type === 'radio'
                    && !questionOption.closest('.agent-chat__msg--confirmed')
                    && questionOptionMouseState?.input === questionInput
                    && questionOptionMouseState.wasChecked) {
                    event.preventDefault();
                    questionInput.checked = false;
                }
                questionOptionMouseState = null;
                const target = event.target?.closest?.('[data-agent-action]');
                const openSessionMenu = event.target?.closest?.('.tm-agent-history__row.is-menu-open');
                host.querySelectorAll('.tm-agent-history__row.is-menu-open').forEach((row) => {
                    if (row !== openSessionMenu || !event.target?.closest?.('.tm-agent-history__row-actions')) row.classList.remove('is-menu-open');
                });
                if (!target) return;
                const action = text(target.dataset.agentAction);
                const id = text(target.dataset.id);
                if (action === 'send') await sendMessage();
                else if (action === 'stop') stop();
                else if (action === 'scroll-to-bottom') scrollConversationToBottom();
                else if (action === 'new-session') createSession();
                else if (action === 'open-scheduled-events') globalThis.tmOpenSettingsSearchResult?.('ai', '', 'ai-scheduled-events');
                else if (action === 'open-history') { runtime.presetsOpen = false; runtime.historyOpen = true; await listSessions(); render(); }
                else if (action === 'close-sidebar') await aiBridge()?.closeAiPanel?.();
                else if (action === 'close-history') { runtime.historyOpen = false; render(); }
                else if (action === 'toggle-scheduled-history') { runtime.historyScheduledOnly = target.checked === true; render(); }
                else if (action === 'open-presets') { runtime.historyOpen = false; runtime.presetsOpen = true; runtime.presetEditorID = ''; render(); }
                else if (action === 'close-presets') { runtime.presetsOpen = false; runtime.presetEditorID = ''; render(); }
                else if (action === 'open-context-picker') {
                    runtime.historyOpen = false;
                    runtime.presetsOpen = false;
                    runtime.contextPickerOpen = true;
                    runtime.contextPickerMode = 'task';
                    runtime.contextPickerQuery = '';
                    runtime.contextPickerResults = [];
                    runtime.contextPickerError = '';
                    runtime.contextPickerScrollTop = 0;
                    await searchContextPicker('');
                }
                else if (action === 'toggle-context-expanded') {
                    runtime.contextExpanded = !runtime.contextExpanded;
                    render();
                }
                else if (action === 'clear-context') {
                    clearContext();
                    render();
                }
                else if (action === 'close-context-picker') {
                    clearTimeout(contextSearchTimer);
                    contextSearchTimer = 0;
                    runtime.contextPickerOpen = false;
                    runtime.contextPickerSearchSeq += 1;
                    render();
                }
                else if (action === 'finish-context-picker') {
                    clearTimeout(contextSearchTimer);
                    contextSearchTimer = 0;
                    runtime.contextPickerOpen = false;
                    runtime.contextPickerSearchSeq += 1;
                    render();
                    runtime.host?.querySelector?.('[data-agent-draft]')?.focus?.();
                }
                else if (action === 'set-context-picker-mode') {
                    runtime.contextPickerMode = text(target.dataset.mode) === 'document' ? 'document' : 'task';
                    runtime.contextPickerResults = [];
                    runtime.contextPickerError = '';
                    await searchContextPicker(runtime.contextPickerQuery);
                }
                else if (action === 'clear-context-search') {
                    runtime.contextPickerQuery = '';
                    await searchContextPicker('');
                }
                else if (action === 'add-current-task') {
                    const taskID = text(aiBridge()?.getCurrentTaskId?.());
                    if (contextItemSelected('task', taskID)) removeContextItem('task', taskID);
                    else addContextItem('task', taskID, '当前任务');
                    render();
                }
                else if (action === 'add-current-document') {
                    const documentID = text(aiBridge()?.getCurrentDocId?.());
                    if (contextItemSelected('document', documentID)) removeContextItem('document', documentID);
                    else addContextItem('document', documentID, '当前文档');
                    render();
                }
                else if (action === 'add-current-view') {
                    if (runtime.context.scope) removeContextItem('scope', 'scope');
                    else await setCurrentViewContext();
                    render();
                }
                else if (action === 'toggle-context-result') {
                    const kind = text(target.dataset.kind);
                    const result = runtime.contextPickerResults.find((item) => item.kind === kind && item.id === id);
                    if (!result) return;
                    const resultList = target.closest('.tm-agent-context-picker__results');
                    if (resultList instanceof HTMLElement) runtime.contextPickerScrollTop = resultList.scrollTop;
                    if (contextItemSelected(kind, id)) removeContextItem(kind, id);
                    else addContextItem(kind, id, result.label);
                    render();
                }
                else if (action === 'select-preset') {
                    runtime.presetsOpen = false;
                    runtime.presetEditorID = '';
                    applyPreset(id);
                }
                else if (action === 'toggle-pin-preset') {
                    if (presetPinned(id)) runtime.store.pinnedPresetIDs = runtime.store.pinnedPresetIDs.filter((item) => item !== id);
                    else runtime.store.pinnedPresetIDs.push(id);
                    scheduleSave();
                    render();
                }
                else if (action === 'new-preset') { runtime.presetEditorID = '__new__'; render(); }
                else if (action === 'edit-preset') { runtime.presetEditorID = id; render(); }
                else if (action === 'edit-builtin-preset') { runtime.presetEditorID = `builtin:${id}`; render(); }
                else if (action === 'cancel-preset-edit') { runtime.presetEditorID = ''; render(); }
                else if (action === 'save-preset') {
                    const form = target.closest('[data-preset-editor-id]');
                    const editorID = text(form?.dataset?.presetEditorId);
                    const builtinID = editorID.startsWith('builtin:') ? editorID.slice('builtin:'.length) : '';
                    const preset = normalizeCustomPreset({
                        id: editorID === '__new__' ? '' : (builtinID || editorID),
                        label: form?.elements?.label?.value,
                        prompt: form?.elements?.prompt?.value,
                        starter: form?.elements?.starter?.value,
                    });
                    if (!preset) { runtime.statusText = '预设名称和指令不能为空'; render(); return; }
                    if (builtinID) {
                        saveBuiltinPresetOverride(builtinID, preset);
                    } else {
                        const index = runtime.store.customPresets.findIndex((item) => text(item?.id) === preset.id);
                        if (index >= 0) runtime.store.customPresets[index] = preset;
                        else runtime.store.customPresets.push(preset);
                    }
                    runtime.presetEditorID = '';
                    runtime.statusText = '';
                    scheduleSave(); render();
                }
                else if (action === 'reset-builtin-preset') {
                    delete runtime.store.builtinPresetOverrides[id];
                    runtime.presetEditorID = '';
                    scheduleSave(); render();
                }
                else if (action === 'delete-builtin-preset') {
                    runtime.store.hiddenBuiltinPresetIDs = normalizeHiddenBuiltinPresetIDs(runtime.store.hiddenBuiltinPresetIDs.concat(id));
                    delete runtime.store.builtinPresetOverrides[id];
                    if (runtime.presetID === id) runtime.presetID = '';
                    runtime.store.pinnedPresetIDs = runtime.store.pinnedPresetIDs.filter((item) => item !== id);
                    if (runtime.presetEditorID === `builtin:${id}`) runtime.presetEditorID = '';
                    scheduleSave(); render();
                }
                else if (action === 'restore-builtin-presets') {
                    runtime.store.hiddenBuiltinPresetIDs = [];
                    scheduleSave(); render();
                }
                else if (action === 'delete-preset') {
                    runtime.store.customPresets = runtime.store.customPresets.filter((item) => text(item?.id) !== id);
                    if (runtime.presetID === `custom:${id}`) runtime.presetID = '';
                    runtime.store.pinnedPresetIDs = runtime.store.pinnedPresetIDs.filter((item) => item !== `custom:${id}`);
                    if (runtime.presetEditorID === id) runtime.presetEditorID = '';
                    scheduleSave(); render();
                }
                else if (action === 'select-session') await loadSession(id);
                else if (action === 'rename-session') beginSessionRename(id, target);
                else if (action === 'cancel-session-rename') render();
                else if (action === 'toggle-session-menu') {
                    const row = target.closest('.tm-agent-history__row');
                    const shouldOpen = !row?.classList?.contains('is-menu-open');
                    host.querySelectorAll('.tm-agent-history__row.is-menu-open').forEach((item) => item.classList.remove('is-menu-open'));
                    if (shouldOpen) row?.classList?.add('is-menu-open');
                }
                else if (action === 'delete-session') await removeSession(id);
                else if (action === 'copy-message') await copyMessage(target.dataset.index, target);
                else if (action === 'copy-code-block') await copyCodeBlock(target);
                else if (action === 'retry-failed') await retryFailedToolCall(id);
                else if (action === 'enable-tools') await setToolsEnabled(true);
                else if (action === 'refresh-capabilities') { runtime.statusText = '正在检测任务工具能力...'; render(); await getCapabilities(); runtime.statusText = ''; render(); }
                else if (action === 'retry-skills') await syncBuiltinSkills();
                else if (action === 'undo-last-mutation') {
                    target.disabled = true;
                    runtime.statusText = '正在撤销...';
                    render();
                    try {
                        const result = await kernelCall('taskHorizonUndoLastMutation', { undoID: runtime.undoID });
                        await applyDomainResultEffects('undo_last_mutation', result);
                        clearUndoAvailability();
                        runtime.session.entries = Array.isArray(runtime.session.entries) ? runtime.session.entries : [];
                        runtime.session.entries.push({ id: newID(), type: 'assistant', content: `已撤销：${text(result?.label) || '本次操作'}`, timestamp: Date.now() });
                        runtime.statusText = '';
                    } catch (error) {
                        if (['CONFLICT', 'NOT_FOUND'].includes(text(error?.code))) clearUndoAvailability();
                        runtime.statusText = `撤销失败：${text(error?.message || error)}`;
                    }
                    render();
                }
                else if (action === 'dismiss-undo') { clearUndoAvailability(); render(); }
                else if (action === 'dismiss-tools') { runtime.store.toolsOnboardingDismissed = true; scheduleSave(); render(); }
                else if (action === 'clear-preset') applyPreset('');
                else if (action === 'remove-context') {
                    const kind = text(target.dataset.kind);
                    removeContextItem(kind, id);
                    render();
                } else if (action === 'suggestion') {
                    const item = suggestions()[Number(target.dataset.index) || 0];
                    if (!item) return;
                    if (item.action === 'history') { runtime.historyOpen = true; await listSessions(); render(); }
                    else if (item.preset) applyPreset(item.preset);
                    else if (item.clearPreset) applyPreset('', item.text || '');
                    else { setDraft(item.text || ''); render(); }
                } else if (action === 'approve-confirm' || action === 'reject-confirm' || action === 'always-confirm') {
                    target.disabled = true;
                    const submitted = await postConfirm(id, action !== 'reject-confirm', action === 'always-confirm');
                    if (!submitted && target.isConnected) target.disabled = false;
                }
                else if (action === 'submit-question') {
                    const card = target.closest('[data-question-id]');
                    const answers = Array.from(card?.querySelectorAll?.('[data-question-item]') || []).flatMap((item) => {
                        const selected = Array.from(item.querySelectorAll('input:checked')).map((input) => text(input.value)).filter(Boolean);
                        const custom = text(item.querySelector('[data-question-custom]')?.value);
                        return custom ? selected.concat(custom) : selected;
                    });
                    target.disabled = true;
                    const submitted = await postQuestion(id, answers);
                    if (!submitted && target.isConnected) target.disabled = false;
                }
            });
        }
        if (runtime.context.taskIDs.length || runtime.context.documentIDs.length) void enrichContextLabels();
        render();
        return true;
    }

    async function testConnection() {
        await post('/lsSessions', { page: 1, pageSize: 1, keyword: '' });
        aiBridge()?.hint?.('智能体连接正常', 'success');
        return true;
    }

    const AUTOMATION_READ_TOOLS = TASK_HORIZON_READ_ONLY_TOOLS;
    const AUTOMATION_SESSION_TOOLS = new Set(['todo_write']);
    const AUTOMATION_NATIVE_READ_ACTIONS = new Map([
        ['sql', new Set(['query'])],
    ]);
    const AUTOMATION_READ_SKILLS = new Set(['task-capture', 'task-planning', 'task-review', 'task-template']);

    function automationToolName(name) {
        const raw = text(name).toLowerCase();
        return isTaskHorizonToolName(raw) ? normalizeToolName(raw) : raw;
    }

    function automationToolAllowed(name, args = {}) {
        const normalized = automationToolName(name);
        if (AUTOMATION_READ_TOOLS.has(normalized) || AUTOMATION_SESSION_TOOLS.has(normalized)) return true;
        const nativeActions = AUTOMATION_NATIVE_READ_ACTIONS.get(normalized);
        if (nativeActions) return nativeActions.has(text(args?.action).toLowerCase());
        if (normalized !== 'skill') return false;
        const action = text(args?.action).toLowerCase();
        if (action === 'list') return true;
        const skillName = text(args?.name).toLowerCase();
        return action === 'load' && AUTOMATION_READ_SKILLS.has(skillName);
    }

    function automationBlock(message) {
        const error = new Error(message || '定时智能体请求触发了安全阻断');
        error.code = 'TM_AUTOMATION_BLOCKED';
        return error;
    }

    function automationEventBlocked(type) {
        return type === 'confirm'
            || type === 'question'
            || type === 'frontend_tool_call'
            || type === 'browser_capability_call';
    }

    function automationSafetyInstruction() {
        return '\n\n这是无人值守的定时执行。只能读取、筛选和聚合数据，也可以使用只读的 sql.query、skill.list 或加载 Task Horizon 内置技能；禁止创建、修改或删除任何数据，禁止请求用户确认或提问，禁止调用浏览器或其他前端能力。已有任务数据附在提示词中时直接使用，不要重复查询。';
    }

    function automationConfirmAllowed(event = {}) {
        return !!text(event.confirmID)
            && automationToolAllowed(event.name, event.arguments);
    }

    async function approveAutomationConfirm(event) {
        const response = await fetch(`${API_ROOT}/confirm`, {
            method: 'POST',
            headers: agentHeaders(),
            body: JSON.stringify({ confirmID: text(event.confirmID), approved: true }),
        });
        if (!response.ok) throw new Error(`只读工具确认失败 (${response.status})`);
    }

    function scheduleAutomationSessionCleanup(sessionID) {
        [5000, 15000, 45000].forEach((delay) => {
            setTimeout(() => {
                post('/removeSession', { id: sessionID }).catch(() => null);
            }, delay);
        });
    }

    function automationTitle(markdown, fallback) {
        const lines = String(markdown || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const heading = lines.find((line) => /^#{1,6}\s+/.test(line));
        return text((heading || lines[0] || fallback || '定时事件结果').replace(/^#{1,6}\s+/, '').replace(/[*_`]/g, '')).slice(0, 120);
    }

    async function ensureAutomationTaskToolsReady() {
        await ensureStoreLoaded();
        const settings = aiBridge()?.getSettings?.() || {};
        if (settings.agentMcpEnabled !== true) return true;
        if (!await ensureTaskToolsReadyForSend()) {
            throw new Error('任务工具正在恢复，本次定时事件尚未发起模型请求');
        }
        if (!runtime.skillSync.installed) {
            const sync = await syncBuiltinSkills();
            if (!sync.installed) throw new Error(`任务工作流程同步失败：${text(sync.error) || '未知错误'}`);
        }
        return true;
    }

    async function runAutomation(request = {}) {
        const prompt = text(request.prompt || request.message);
        if (!prompt) throw new Error('自动化提示词不能为空');
        const agentPrompt = `${prompt}${automationSafetyInstruction()}`;
        await ensureAutomationTaskToolsReady();
        const persistent = request.persistSession === true;
        const requestedSessionID = text(request.sessionID);
        let sessionID = persistent
            ? await ensureAutomationConversation(request.sessionID)
            : newID();
        let baseEntries = [];
        let userEntryID = '';
        let contentRevision;
        if (persistent) {
            try {
                const prepared = await prepareConversationTurn(sessionID, agentPrompt, request.sessionTitle, {
                    replaceMissingSession: Boolean(requestedSessionID),
                    displayPrompt: prompt,
                });
                sessionID = prepared.sessionID;
                baseEntries = prepared.entries;
                userEntryID = prepared.userEntryID;
                contentRevision = prepared.revision;
            } catch (error) {
                throw new Error(`智能体会话初始化失败：${text(error?.message || error) || '未知错误'}`);
            }
        }
        const controller = new AbortController();
        runtime.automationControllers.add(controller);
        const toolCalls = [];
        let markdown = '';
        let turnID = '';
        try {
            await client.chat({
                message: agentPrompt,
                language: window.siyuan?.config?.appearance?.lang || 'zh_CN',
                references: [],
                sessionID,
                editorContext: {},
                pluginActions: [],
                frontendCapabilities: [],
                ...(userEntryID ? { userEntryID, contentRevision } : {}),
            }, async (event) => {
                if (event.type === 'turn') {
                    turnID = text(event.turnID) || turnID;
                    return;
                }
                if (event.type === 'content') {
                    markdown += String(event.token || '');
                    return;
                }
                if (event.type === 'tool_call') {
                    const name = automationToolName(event.name);
                    if (!automationToolAllowed(event.name, event.arguments)) {
                        controller.abort();
                        const action = text(event.arguments?.action);
                        throw automationBlock(`非只读工具调用：${text(event.name) || '未知工具'}${action ? `.${action}` : ''}`);
                    }
                    toolCalls.push({ name, arguments: clone(event.arguments || {}) });
                    return;
                }
                if (event.type === 'confirm') {
                    if (!automationConfirmAllowed(event)) {
                        controller.abort();
                        throw automationBlock(`非只读工具确认：${text(event.name) || '未知工具'}`);
                    }
                    await approveAutomationConfirm(event);
                    return;
                }
                if (automationEventBlocked(event.type)) {
                    controller.abort();
                    throw automationBlock(`交互或前端操作：${event.type}`);
                }
                if (event.type === 'error') throw new Error(text(event.message) || '智能体执行失败');
                if (event.type === 'interrupted') throw new Error(text(event.message) || '智能体响应已中断');
                if (event.type === 'done') turnID = text(event.turnID) || turnID;
            }, controller.signal);
            const output = String(markdown || '').trim();
            if (!output) throw new Error('智能体未返回内容');
            if (persistent) await finalizeAutomationConversation(sessionID, request.sessionTitle, { baseEntries, markdown: output, turnID });
            return {
                title: automationTitle(output, request.title),
                markdown: output,
                toolCalls,
                sessionID,
            };
        } catch (error) {
            const reportedError = text(error?.message || error) === '网络异常，请稍后再试'
                ? Object.assign(new Error('智能体请求失败：网络异常，请稍后再试'), { code: error?.code })
                : error;
            try { if (persistent && sessionID) reportedError.sessionID = sessionID; } catch (assignError) {}
            if (persistent) {
                const failure = String(markdown || '').trim() || `执行失败：${text(reportedError?.message || reportedError) || '未知错误'}`;
                await finalizeAutomationConversation(sessionID, request.sessionTitle, { baseEntries, markdown: failure, turnID });
            }
            throw reportedError;
        } finally {
            runtime.automationControllers.delete(controller);
            try { controller.abort(); } catch (error) {}
            if (!persistent) scheduleAutomationSessionCleanup(sessionID);
        }
    }

    async function exportMigrationData() {
        const customPresets = clone(runtime.store.customPresets);
        const builtinPresetOverrides = clone(runtime.store.builtinPresetOverrides);
        const hiddenBuiltinPresetIDs = clone(runtime.store.hiddenBuiltinPresetIDs);
        const pinnedPresetIDs = clone(runtime.store.pinnedPresetIDs);
        const policy = await kernelCall('taskHorizonGetPolicy').catch(() => null);
        return {
            mode: 'agent',
            customPresets,
            builtinPresetOverrides,
            hiddenBuiltinPresetIDs,
            pinnedPresetIDs,
            policy,
            summary: {
                customPresets: customPresets.length + Object.keys(builtinPresetOverrides).length,
                policyIncluded: !!policy,
            },
        };
    }

    async function importMigrationData(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        if (Array.isArray(source.customPresets)) runtime.store.customPresets = source.customPresets.map(normalizeCustomPreset).filter(Boolean);
        if (source.builtinPresetOverrides && typeof source.builtinPresetOverrides === 'object') runtime.store.builtinPresetOverrides = normalizeBuiltinPresetOverrides(source.builtinPresetOverrides);
        if (Array.isArray(source.hiddenBuiltinPresetIDs)) runtime.store.hiddenBuiltinPresetIDs = normalizeHiddenBuiltinPresetIDs(source.hiddenBuiltinPresetIDs);
        if (Array.isArray(source.pinnedPresetIDs)) runtime.store.pinnedPresetIDs = normalizePinnedPresetIDs(source.pinnedPresetIDs).filter((id) => !!getPreset(id));
        let policyImported = false;
        if (source.policy && typeof source.policy === 'object' && !Array.isArray(source.policy)) {
            const current = await kernelCall('taskHorizonGetPolicy');
            const patch = {
                ...(source.policy.durationDefaults && typeof source.policy.durationDefaults === 'object' && !Array.isArray(source.policy.durationDefaults)
                    ? { durationDefaults: source.policy.durationDefaults }
                    : {}),
                global: source.policy.global && typeof source.policy.global === 'object' ? source.policy.global : {},
                documentOverrides: source.policy.documentOverrides && typeof source.policy.documentOverrides === 'object'
                    ? source.policy.documentOverrides
                    : (source.policy.listOverrides && typeof source.policy.listOverrides === 'object' ? source.policy.listOverrides : {}),
                groupOverrides: source.policy.groupOverrides && typeof source.policy.groupOverrides === 'object' ? source.policy.groupOverrides : {},
            };
            const preview = await kernelCall('taskHorizonPreviewPolicyPatch', { expectedRevision: current.revision, patch });
            await kernelCall('taskHorizonApplyPolicyPatch', { expectedRevision: preview.expectedRevision, previewToken: preview.previewToken });
            policyImported = true;
        }
        scheduleSave();
        return { customPresets: runtime.store.customPresets.length + Object.keys(runtime.store.builtinPresetOverrides).length, policyImported };
    }

    function cleanup() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = 0;
            void persistStore();
        }
        clearTimeout(contextSearchTimer);
        clearTimeout(contextScrollbarHideTimer);
        stopCapabilityRetry();
        contextScrollbarDrag = null;
        runtime.contextResizeObserver?.disconnect?.();
        runtime.contextResizeObserver = null;
        clearTimeout(runtime.viewContextSyncTimer);
        runtime.viewContextSyncTimer = 0;
        runtime.viewContextSyncSeq += 1;
        if (runtime.viewContextListener) window.removeEventListener('tm:filtered-tasks-updated', runtime.viewContextListener);
        runtime.viewContextListener = null;
        runtime.abortController?.abort?.();
        runtime.automationControllers.forEach((controller) => controller.abort?.());
        runtime.automationControllers.clear();
        if (runtime.streamRenderFrame) cancelAnimationFrame(runtime.streamRenderFrame);
        runtime.streamRenderFrame = 0;
        runtime.hostListenerController?.abort?.();
        runtime.hostListenerController = null;
        if (runtime.host?.dataset?.tmAgentWorkbenchBound === WORKBENCH_BINDING_TOKEN) {
            delete runtime.host.dataset.tmAgentWorkbenchBound;
        }
        runtime.host = null;
        runtime.mounted = false;
        try { delete globalThis.tmAiOptimizeTaskName; } catch (error) {}
        try { delete globalThis.tmAiEditTask; } catch (error) {}
        try { delete globalThis.tmAiAnalyzeDocumentSmart; } catch (error) {}
        try { delete globalThis.tmAiPlanDocumentSchedule; } catch (error) {}
        try { delete globalThis.tmAiPlanTaskSchedule; } catch (error) {}
        try { delete globalThis.tmAiOpenSummary; } catch (error) {}
        try { delete globalThis.tmAiOpenChat; } catch (error) {}
        try { delete globalThis.tmAiShowHistory; } catch (error) {}
        try { delete globalThis.__tmAI; } catch (error) {}
    }

    globalThis.tmAiOptimizeTaskName = (taskID) => openWorkbench({ presetID: 'title-rewrite', taskID });
    globalThis.tmAiEditTask = (taskID) => openWorkbench({ presetID: 'field-edit', taskID });
    globalThis.tmAiAnalyzeDocumentSmart = (docID) => openWorkbench({ presetID: 'smart-review', docID });
    globalThis.tmAiPlanDocumentSchedule = (docID) => openWorkbench({ presetID: 'task-planning', docID });
    globalThis.tmAiPlanTaskSchedule = (taskID) => openWorkbench({ presetID: 'task-planning', taskID });
    globalThis.tmAiOpenSummary = (docID) => openWorkbench({ presetID: 'task-review', docID });
    globalThis.tmAiOpenChat = (docID) => openWorkbench({ docID });
    globalThis.tmAiShowHistory = async (docID) => openWorkbench({ docID, showHistory: true });
    const reloadData = async () => {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = 0;
        }
        try { await runtime.storeLoadPromise; } catch (error) {}
        await loadStore();
        runtime.storeLoaded = true;
        if (runtime.host?.isConnected) render();
        return true;
    };
    globalThis.__taskHorizonAiCleanup = cleanup;
    globalThis.__tmAI = {
        loaded: true,
        runtimeKind: 'agent',
        isBusy: () => runtime.busy === true,
        cleanup,
        mountSidebar,
        openSidebar,
        notifyTaskViewChanged,
        refreshSidebar: async () => { await listSessions(); render(); },
        reloadData,
        setConversationFontSize,
        handleTaskContextDragOver,
        clearTaskContextDropState,
        addDraggedTasksToContext,
        testConnection,
        runAutomation,
        ensureAutomationConversation,
        openConversation: async (sessionID) => openWorkbench({ sessionID }),
        createConversation: async () => createSession(),
        listConversations: listSessions,
        deleteConversation: removeSession,
        exportMigrationData,
        importMigrationData,
    };
    globalThis.__tmAIAutomationTest = {
        toolName: automationToolName,
        normalizeToolName,
        automaticConfirmKind,
        isAllowedTool: automationToolAllowed,
        isAllowedConfirm: automationConfirmAllowed,
        isBlockedEventType: automationEventBlocked,
        hashContent,
        postAgentInteraction,
        persistSessionCheckpoint,
        prepareConversationTurn,
        chat: (request, onEvent, signal) => client.chat(request, onEvent, signal),
        runAutomation,
        isScheduledEventCreateIntent,
        isReminderModeChoiceIntent,
        isScheduledEventListIntent,
        isScheduledEventHelpIntent,
    };
})();
