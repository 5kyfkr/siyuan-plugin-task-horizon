    const Storage = {
        get(key, defaultValue) {
            try {
                const value = localStorage.getItem(key);
                return value !== null ? JSON.parse(value) : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        },
        has(key) {
            try {
                return localStorage.getItem(key) !== null;
            } catch (e) {
                return false;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {}
        },
        clear() {
            try {
                const extraKeys = new Set([
                    '__tmQuickbarModifiedTasks',
                    'tm-ai-ui-prefs',
                    'tm-calendar-events',
                    'tm-calendar-mobile-notification-registry',
                ]);
                const keys = [];
                for (let i = 0; i < localStorage.length; i += 1) {
                    const key = String(localStorage.key(i) || '');
                    if (!key) continue;
                    if (key.startsWith('tm_') || extraKeys.has(key)) keys.push(key);
                }
                keys.forEach((key) => {
                    try { localStorage.removeItem(key); } catch (e2) {}
                });
            } catch (e) {}
        }
    };

    const PLUGIN_STORAGE_DIR = '/data/storage/petal/siyuan-plugin-task-horizon';
    const META_FILE_PATH = `${PLUGIN_STORAGE_DIR}/task-meta.json`;
    const SETTINGS_FILE_PATH = `${PLUGIN_STORAGE_DIR}/task-settings.json`;
    const WHITEBOARD_DATA_FILE_PATH = `${PLUGIN_STORAGE_DIR}/whiteboard-data.json`;
    const SEMANTIC_DATE_RECOGNIZED_FILE_PATH = `${PLUGIN_STORAGE_DIR}/semantic-date-recognized.json`;
    const TASK_SNAPSHOT_FILE_PATH = `${PLUGIN_STORAGE_DIR}/task-snapshot.json`;
    const TASK_INDEX_FILE_PATH = `${PLUGIN_STORAGE_DIR}/task-index.json`;
    const DOC_SCOPE_CACHE_FILE_PATH = `${PLUGIN_STORAGE_DIR}/doc-scope-cache.json`;
    const __TM_TASK_SNAPSHOT_VERSION = 2;
    const __TM_TASK_SNAPSHOT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
    const __TM_TASK_SNAPSHOT_MAX_ENTRIES = 20;
    const __TM_TASK_SNAPSHOT_MAX_BYTES = 20 * 1024 * 1024;
    const __TM_TASK_SNAPSHOT_MAX_SINGLE_BYTES = 20 * 1024 * 1024;
    const __TM_TASK_INDEX_VERSION = 3;
    const __TM_TASK_INDEX_MAX_BYTES = 24 * 1024 * 1024;
    const __TM_TASK_INDEX_MAX_DOCS = 1200;
    const __TM_TASK_INDEX_MAX_SINGLE_DOC_BYTES = 10 * 1024 * 1024;
    const __TM_TASK_INDEX_QUERY_LIMIT = 20000;
    const __TM_DOC_SCOPE_CACHE_VERSION = 1;
    const __TM_DOC_SCOPE_CACHE_MAX_BYTES = 5 * 1024 * 1024;
    const __TM_DOC_SCOPE_CACHE_MAX_SCOPES = 48;
    const __TM_DOC_SCOPE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    const __TM_TASK_HOT_QUERY_LIMIT = 5000;
    const __TM_TASK_INCREMENTAL_QUERY_LIMIT = Math.min(__TM_TASK_INDEX_QUERY_LIMIT, __TM_TASK_HOT_QUERY_LIMIT);
    const __TM_SQL_MAX_TOTAL_LIMIT = 500000;
    const __TM_DOC_EXPAND_CACHE_TTL_MS = 10 * 60 * 1000;
    const __TM_RESOLVED_DOC_IDS_CACHE_TTL_MS = 10 * 60 * 1000;
    const __TM_OTHER_BLOCK_TAB_ID = '__tm_other_blocks__';
    const __TM_OTHER_BLOCK_TAB_NAME = '其他块';
    const WHITEBOARD_DATA_CACHE_KEY = 'tm_whiteboard_data_cache';
    const __TM_QUICK_ADD_RECENT_DOCS_KEY = 'tm_quick_add_recent_docs';
    const __TM_QUICK_ADD_RECENT_DOCS_LIMIT = 6;
    const __TM_BUILTIN_COLUMN_DEFAULT_ORDER = ['pinned', 'content', 'status', 'score', 'doc', 'h2', 'priority', 'startDate', 'completionTime', 'taskCompleteAt', 'remainingTime', 'duration', 'spent', 'remark', 'attachments'];
    const __TM_BUILTIN_COLUMN_WIDTHS = {
        pinned: 48,
        content: 360,
        status: 96,
        score: 96,
        doc: 180,
        h2: 180,
        priority: 96,
        startDate: 90,
        completionTime: 90,
        taskCompleteAt: 140,
        remainingTime: 116,
        duration: 96,
        spent: 96,
        remark: 240,
        attachments: 180,
    };
    const __TM_BUILTIN_COLUMN_PERCENT_WIDTHS = {
        pinned: 5,
        content: 35,
        status: 8,
        score: 8,
        doc: 12,
        h2: 12,
        priority: 8,
        startDate: 7,
        completionTime: 7,
        taskCompleteAt: 11,
        remainingTime: 10,
        duration: 8,
        spent: 8,
        remark: 19,
        attachments: 14,
    };
    const __TM_FIXED_DATE_COLUMN_KEYS = Object.freeze(['startDate', 'completionTime']);
    const __TM_FIXED_DATE_COLUMN_FALLBACK_WIDTH = 104;
    const __TM_CUSTOM_FIELD_ATTR_PREFIX = 'custom-tm-';
    const __TM_CUSTOM_FIELD_COLUMN_PREFIX = 'cf:';
    const __TM_TASK_ATTACHMENT_ATTR_PREFIX = 'custom-data-assets-th-';
    const __TM_TASK_ATTACHMENT_BLOCK_PREFIX = 'block:';
    const __TM_TASK_ATTACHMENT_BLOCK_ID_PATTERN = /^[0-9]{14}-[A-Za-z0-9]+$/;
    const __TM_TASK_ATTACHMENT_DETAIL_COLLAPSE_COUNT = 6;
    const __TM_TASK_ATTACHMENT_TABLE_PREVIEW_LIMIT = 2;
    const __TM_CUSTOM_FIELD_COLOR_PRESETS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
    const __TM_STATUS_COLOR_PALETTE_GROUPS = [
        { id: 'macaron', label: '马卡龙色系', colors: ['#F78A8A', '#F7B9A6', '#FAD79A', '#BFDCCF', '#67C0D4', '#6A9EE8', '#B18AE6', '#EC6FAE'] },
        { id: 'morandi', label: '莫兰迪色系', colors: ['#D57A63', '#F7C27A', '#DAD85A', '#A5C8B9', '#76C5CF', '#7FA2DA', '#A489C5', '#C779A0'] },
        { id: 'rococo', label: '洛可可色系', colors: ['#C57B76', '#E58F27', '#E8CE75', '#7AAD94', '#5FB59E', '#4D8CC8', '#7F88B0', '#D08B93'] },
        { id: 'classic', label: '经典色系', colors: ['#F15B5D', '#F7AC39', '#FFD35A', '#DDE23C', '#55C99A', '#499CE7', '#BF58EC', '#E668A6'] },
        { id: 'memphis', label: '孟菲斯色系', colors: ['#FF2A21', '#FF7A52', '#FFCD57', '#12CFB3', '#38B5C8', '#7D59F0', '#BE72F0', '#EB59C0'] },
    ];
    const __tmCustomFieldAttrBackfillInFlight = new Set();
    const __tmTaskAttachmentBlockMetaCache = new Map();
    const __tmFixedDateColumnWidthCache = new Map();
    let __tmFixedDateMeasureCanvas = null;

    function __tmIsFixedDateColumn(key) {
        return __TM_FIXED_DATE_COLUMN_KEYS.includes(String(key || '').trim());
    }

    function __tmGetMeasureFontFromStyle(style) {
        if (!style) return '14px sans-serif';
        const direct = String(style.font || '').trim();
        if (direct) return direct;
        const fontStyle = String(style.fontStyle || 'normal').trim() || 'normal';
        const fontVariant = String(style.fontVariant || 'normal').trim() || 'normal';
        const fontWeight = String(style.fontWeight || '400').trim() || '400';
        const fontSize = String(style.fontSize || '14px').trim() || '14px';
        const fontFamily = String(style.fontFamily || 'sans-serif').trim() || 'sans-serif';
        return `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize} ${fontFamily}`;
    }

    function __tmReplaceFontSizeForMeasure(font, fontSize) {
        const size = Number(fontSize);
        if (!Number.isFinite(size) || size <= 0) return font;
        const nextSize = `${size}px`;
        const text = String(font || '').trim() || '14px sans-serif';
        return /\d+(?:\.\d+)?px/.test(text)
            ? text.replace(/\d+(?:\.\d+)?px/, nextSize)
            : `${nextSize} ${text}`;
    }

    function __tmParseStylePx(value, fallback = 0) {
        const n = parseFloat(String(value || ''));
        return Number.isFinite(n) ? n : fallback;
    }

    function __tmGetDateColumnMeasureElement(selectorList) {
        if (typeof document === 'undefined' || !document?.querySelector) return null;
        for (const selector of selectorList) {
            try {
                const el = document.querySelector(selector);
                if (el) return el;
            } catch (e) {}
        }
        return null;
    }

    function __tmBuildDateColumnMeasureInfo(colKey, kind) {
        const selectorKey = String(colKey || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const isHeader = kind === 'header';
        const selectors = isHeader
            ? [
                `.tm-table th[data-col="${selectorKey}"]`,
                '.tm-timeline-table-left thead th',
                '.tm-table thead th',
            ]
            : [
                `.tm-table td.tm-task-meta-cell[data-tm-task-time-field="${selectorKey}"]`,
                `.tm-table td[data-tm-task-time-field="${selectorKey}"]`,
                '.tm-timeline-table-left td.tm-task-meta-cell',
                '.tm-table td.tm-task-meta-cell',
                '.tm-table td',
            ];
        const el = __tmGetDateColumnMeasureElement(selectors);
        let style = null;
        try {
            const target = el || document?.body || document?.documentElement || null;
            style = target && typeof getComputedStyle === 'function' ? getComputedStyle(target) : null;
        } catch (e) {}
        const font = __tmGetMeasureFontFromStyle(style);
        let fontSize = __tmParseStylePx(style?.fontSize, 14);
        let resolvedFont = font;
        if (!el && typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
            try {
                const rootStyle = getComputedStyle(document.documentElement);
                const tableFontSize = __tmParseStylePx(rootStyle?.getPropertyValue?.('--tm-font-size'), 0);
                if (tableFontSize > 0) {
                    fontSize = tableFontSize;
                    resolvedFont = __tmReplaceFontSizeForMeasure(font, tableFontSize);
                }
            } catch (e) {}
        }
        const letterSpacing = __tmParseStylePx(style?.letterSpacing, 0);
        const paddingX = style
            ? (__tmParseStylePx(style.paddingLeft, isHeader ? 4 : 6) + __tmParseStylePx(style.paddingRight, isHeader ? 4 : 6))
            : (isHeader ? 8 : 12);
        const borderX = style
            ? (__tmParseStylePx(style.borderLeftWidth, 0) + __tmParseStylePx(style.borderRightWidth, 1))
            : 1;
        return {
            font: resolvedFont,
            fontSize,
            letterSpacing,
            paddingX,
            borderX,
        };
    }

    function __tmMeasureDateColumnText(text, info) {
        const value = String(text || '');
        if (!value) return 0;
        try {
            if (!__tmFixedDateMeasureCanvas && typeof document !== 'undefined') {
                __tmFixedDateMeasureCanvas = document.createElement('canvas');
            }
            const ctx = __tmFixedDateMeasureCanvas?.getContext?.('2d');
            if (ctx) {
                ctx.font = info.font;
                const base = ctx.measureText(value).width;
                const spacing = Number(info.letterSpacing) || 0;
                return base + Math.max(0, value.length - 1) * spacing;
            }
        } catch (e) {}
        return value.length * (Number(info.fontSize) || 14) * 0.62;
    }

    function __tmCollectFixedDateColumnTexts(colKey) {
        const out = [colKey === 'startDate' ? '开始日期' : '截止日期', '2026-04-29'];
        try {
            const tasks = globalThis.__tmRuntimeState?.getFlatTasks?.() || null;
            if (tasks && typeof tasks === 'object') {
                const seen = new Set(out);
                Object.values(tasks).forEach((task) => {
                    const raw = String(task?.[colKey] || '').trim();
                    if (!raw) return;
                    const text = typeof __tmFormatTaskTime === 'function' ? __tmFormatTaskTime(raw) : raw;
                    if (!text || seen.has(text)) return;
                    seen.add(text);
                    out.push(text);
                });
            }
        } catch (e) {}
        return out;
    }

    function __tmGetFixedDateColumnWidth(column) {
        const colKey = String(column || '').trim();
        const bodyInfo = __tmBuildDateColumnMeasureInfo(colKey, 'body');
        const headerInfo = __tmBuildDateColumnMeasureInfo(colKey, 'header');
        const headerText = colKey === 'startDate' ? '开始日期' : '截止日期';
        const bodyTexts = __tmCollectFixedDateColumnTexts(colKey);
        const bodyTextSig = bodyTexts.join('\u001f');
        const cacheKey = [
            colKey,
            bodyInfo.font,
            bodyInfo.letterSpacing,
            bodyInfo.paddingX,
            bodyInfo.borderX,
            headerInfo.font,
            headerInfo.letterSpacing,
            headerInfo.paddingX,
            headerInfo.borderX,
            bodyTextSig,
        ].join('|');
        if (__tmFixedDateColumnWidthCache.has(cacheKey)) return __tmFixedDateColumnWidthCache.get(cacheKey);
        const dateWidth = bodyTexts.reduce((max, text) => Math.max(max, __tmMeasureDateColumnText(text, bodyInfo)), 0) + bodyInfo.paddingX + bodyInfo.borderX;
        const headerWidth = __tmMeasureDateColumnText(headerText, headerInfo) + headerInfo.paddingX + headerInfo.borderX;
        const width = Math.max(
            80,
            Math.min(320, Math.ceil(Math.max(dateWidth, headerWidth) + 8))
        );
        __tmRememberSmallCache(__tmFixedDateColumnWidthCache, cacheKey, width, 48);
        return width || __TM_FIXED_DATE_COLUMN_FALLBACK_WIDTH;
    }

    function __tmParseVersionNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }

    function __tmParseUpdatedAtNumber(value) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
        const s = String(value || '').trim();
        if (!s) return 0;
        const ts = __tmParseTimeToTs(s);
        return Number.isFinite(ts) && ts > 0 ? ts : 0;
    }

    function __tmNormalizeQuickAddRecentDocs(input, limit = __TM_QUICK_ADD_RECENT_DOCS_LIMIT) {
        const max = Math.max(1, Math.min(20, Math.floor(Number(limit) || __TM_QUICK_ADD_RECENT_DOCS_LIMIT)));
        const list = Array.isArray(input) ? input : [];
        const seen = new Set();
        const out = [];
        list.forEach((entry) => {
            const raw = (entry && typeof entry === 'object') ? entry : { id: entry };
            const id = String(raw?.id || '').trim();
            if (!id || id === '__dailyNote__' || seen.has(id)) return;
            seen.add(id);
            const item = { id };
            const name = String(raw?.name || '').trim();
            const path = String(raw?.path || '').trim();
            const ts = __tmParseUpdatedAtNumber(raw?.ts);
            if (name) item.name = name;
            if (path) item.path = path;
            if (ts > 0) item.ts = ts;
            out.push(item);
        });
        return out.slice(0, max);
    }

    function __tmGetTaskAttachmentAttrIndex(key) {
        const normalized = String(key || '').trim();
        if (!normalized.startsWith(__TM_TASK_ATTACHMENT_ATTR_PREFIX)) return -1;
        const index = Number(normalized.slice(__TM_TASK_ATTACHMENT_ATTR_PREFIX.length));
        return Number.isInteger(index) && index >= 0 ? index : -1;
    }

    function __tmIsTaskAttachmentAttrKey(key) {
        return __tmGetTaskAttachmentAttrIndex(key) >= 0;
    }

    function __tmNormalizeTaskAttachmentBlockId(value, options = {}) {
        const text = String(value ?? '').trim();
        if (!text) return '';
        let match = text.match(/^block:([0-9]{14}-[A-Za-z0-9]+)$/i);
        if (match) return match[1];
        if (__TM_TASK_ATTACHMENT_BLOCK_ID_PATTERN.test(text)) return text;
        match = text.match(/^siyuan:\/\/blocks\/([0-9]{14}-[A-Za-z0-9]+)(?:[/?#].*)?$/i);
        if (match) return match[1];
        match = text.match(/^\(\(\s*([0-9]{14}-[A-Za-z0-9]+)(?:[\s\S]*)\)\)$/);
        if (match) return match[1];
        if (options?.loose === true) {
            match = text.match(/siyuan:\/\/blocks\/([0-9]{14}-[A-Za-z0-9]+)/i);
            if (match) return match[1];
            match = text.match(/\(\(\s*([0-9]{14}-[A-Za-z0-9]+)/);
            if (match) return match[1];
        }
        return '';
    }

    function __tmBuildTaskAttachmentBlockToken(blockId) {
        const normalizedId = __tmNormalizeTaskAttachmentBlockId(blockId);
        return normalizedId ? `${__TM_TASK_ATTACHMENT_BLOCK_PREFIX}${normalizedId}` : '';
    }

    function __tmExtractTaskAttachmentBlockId(value) {
        return __tmNormalizeTaskAttachmentBlockId(value);
    }

    function __tmIsTaskAttachmentBlockRef(value) {
        return !!__tmExtractTaskAttachmentBlockId(value);
    }

    function __tmIsTaskAttachmentSupportedBlockType(type, subtype) {
        const t = String(type || '').trim().toLowerCase();
        const st = String(subtype || '').trim().toLowerCase();
        if (t === 'd' || t === 'h' || t === 'p') return true;
        if (t === 'i') return ['o', 'u', 't', ''].includes(st);
        if (t === 'l') return true;
        return false;
    }

    function __tmGetTaskAttachmentBlockThumbLabel(type, subtype) {
        const t = String(type || '').trim().toLowerCase();
        const st = String(subtype || '').trim().toLowerCase();
        if (t === 'd') return 'DOC';
        if (t === 'h') return 'H';
        if (t === 'p') return 'TXT';
        if (t === 'i' && st === 't') return 'TASK';
        if (t === 'i' || t === 'l') return 'LIST';
        return 'REF';
    }

    function __tmGetTaskAttachmentBlockTypeLabel(type, subtype) {
        const t = String(type || '').trim().toLowerCase();
        const st = String(subtype || '').trim().toLowerCase();
        if (t === 'd') return '文档链接';
        if (t === 'h') return '标题链接';
        if (t === 'p') return '段落链接';
        if (t === 'i' && st === 't') return '任务块链接';
        if (t === 'i' || t === 'l') return '列表块链接';
        return '块链接';
    }

    function __tmGetTaskAttachmentBlockMeta(blockId) {
        const normalizedId = __tmNormalizeTaskAttachmentBlockId(blockId);
        if (!normalizedId) return null;
        return __tmTaskAttachmentBlockMetaCache.get(normalizedId) || null;
    }

    function __tmPrimeTaskAttachmentBlockMeta(input) {
        const source = (input && typeof input === 'object') ? input : { id: input };
        const normalizedId = __tmNormalizeTaskAttachmentBlockId(source?.blockId || source?.id || source?.value || '');
        if (!normalizedId) return null;
        const type = String(source?.type || '').trim().toLowerCase();
        const subtype = String(source?.subtype || '').trim().toLowerCase();
        const isDocBlock = type === 'd';
        const rawContent = String(source?.content || source?.name || source?.title || '').trim();
        const docName = String(source?.doc_name || source?.docName || '').trim();
        const docPath = String(source?.doc_path || source?.docPath || '').trim();
        const label = __tmGetTaskAttachmentBlockThumbLabel(type, subtype);
        const typeLabel = __tmGetTaskAttachmentBlockTypeLabel(type, subtype);
        const name = rawContent
            || (isDocBlock ? (docName || '未命名文档') : '')
            || `块链接 ${normalizedId.slice(0, 8)}`;
        const displayPath = isDocBlock
            ? (docPath || docName || `文档 ID: ${normalizedId}`)
            : ([docName, docPath].filter(Boolean).join(' · ') || `块 ID: ${normalizedId}`);
        const meta = {
            id: normalizedId,
            type,
            subtype,
            isDocBlock,
            name,
            label,
            typeLabel,
            displayPath,
            docId: String(source?.root_id || source?.docId || (isDocBlock ? normalizedId : '')).trim() || (isDocBlock ? normalizedId : ''),
            rawContent,
            docName,
            docPath,
        };
        __tmTaskAttachmentBlockMetaCache.set(normalizedId, meta);
        return meta;
    }

    function __tmNormalizeTaskAttachmentPath(value) {
        const blockId = __tmNormalizeTaskAttachmentBlockId(value);
        if (blockId) return __tmBuildTaskAttachmentBlockToken(blockId);
        let text = String(value ?? '').trim().replace(/\\/g, '/');
        if (!text) return '';
        text = text.replace(/^\/+/, '');
        if (!text) return '';
        if (/^assets\//i.test(text)) return `assets/${text.slice(7)}`;
        return text;
    }

    function __tmGetTaskAttachmentDisplayName(path) {
        const blockId = __tmExtractTaskAttachmentBlockId(path);
        if (blockId) {
            return __tmGetTaskAttachmentBlockMeta(blockId)?.name || `块链接 ${blockId.slice(0, 8)}`;
        }
        const normalized = __tmNormalizeTaskAttachmentPath(path);
        if (!normalized) return '';
        const clean = normalized.split(/[?#]/)[0];
        const segments = clean.split('/').filter(Boolean);
        const name = segments[segments.length - 1] || clean;
        try {
            return decodeURIComponent(name);
        } catch (e) {
            return name;
        }
    }

    function __tmNormalizeTaskAttachmentPaths(value) {
        const list = Array.isArray(value)
            ? value
            : ((value && typeof value === 'object' && Array.isArray(value.paths)) ? value.paths : []);
        const out = [];
        const seen = new Set();
        list.forEach((item) => {
            let rawPath = '';
            if (typeof item === 'string') {
                rawPath = item;
            } else if (item && typeof item === 'object') {
                const maybeBlockId = item.blockId
                    || ((item.isBlockRef || item.kind === 'block-ref' || item.typeLabel === '块链接') ? item.id : '');
                if (maybeBlockId) {
                    try { __tmPrimeTaskAttachmentBlockMeta(item); } catch (e) {}
                    rawPath = __tmBuildTaskAttachmentBlockToken(maybeBlockId);
                } else {
                    rawPath = item.path || item.assetPath || item.value || item.token || item.raw || '';
                }
            }
            const normalized = __tmNormalizeTaskAttachmentPath(rawPath);
            if (!normalized || seen.has(normalized)) return;
            seen.add(normalized);
            out.push(normalized);
        });
        return out;
    }

    function __tmGetTaskAttachmentKind(path) {
        if (__tmIsTaskAttachmentBlockRef(path)) return 'block-ref';
        const normalized = __tmNormalizeTaskAttachmentPath(path);
        const clean = normalized.split(/[?#]/)[0];
        const ext = clean.includes('.') ? clean.slice(clean.lastIndexOf('.') + 1).toLowerCase() : '';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'].includes(ext)) return 'image';
        if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) return 'audio';
        if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) return 'video';
        if (ext === 'pdf') return 'pdf';
        return 'file';
    }

    function __tmBuildTaskAttachmentEntries(value) {
        return __tmNormalizeTaskAttachmentPaths(value).map((path, index) => {
            const blockId = __tmExtractTaskAttachmentBlockId(path);
            if (blockId) {
                const meta = __tmGetTaskAttachmentBlockMeta(blockId);
                const name = meta?.name || `块链接 ${blockId.slice(0, 8)}`;
                const displayPath = meta?.displayPath || `块 ID: ${blockId}`;
                return {
                    index,
                    path,
                    name,
                    ext: '',
                    label: meta?.label || 'REF',
                    kind: 'block-ref',
                    displayPath,
                    tooltip: [meta?.typeLabel || '块链接', name, displayPath].filter(Boolean).join('\n'),
                    blockId,
                    blockType: String(meta?.type || '').trim(),
                    blockSubtype: String(meta?.subtype || '').trim(),
                    isBlockRef: true,
                    isDocBlock: meta?.isDocBlock === true,
                    isImage: false,
                    isAudio: false,
                    isVideo: false,
                    isPdf: false,
                    hasResolvedMeta: !!meta,
                };
            }
            const kind = __tmGetTaskAttachmentKind(path);
            const clean = path.split(/[?#]/)[0];
            const ext = clean.includes('.') ? clean.slice(clean.lastIndexOf('.') + 1).toLowerCase() : '';
            const label = ext ? ext.toUpperCase().slice(0, 4) : 'FILE';
            const name = __tmGetTaskAttachmentDisplayName(path);
            return {
                index,
                path,
                name,
                ext,
                label,
                kind,
                displayPath: path,
                tooltip: [name, path].filter(Boolean).join('\n'),
                isBlockRef: false,
                isDocBlock: false,
                isImage: kind === 'image',
                isAudio: kind === 'audio',
                isVideo: kind === 'video',
                isPdf: kind === 'pdf',
                hasResolvedMeta: true,
            };
        });
    }

    function __tmApplyTaskAttachmentPathsToTask(task, value, options = {}) {
        const target = (task && typeof task === 'object') ? task : null;
        if (!target) return target;
        const opts = (options && typeof options === 'object') ? options : {};
        const paths = __tmNormalizeTaskAttachmentPaths(value);
        const slotCount = Math.max(
            paths.length,
            Math.max(0, Math.floor(Number(opts.slotCount) || 0))
        );
        target.__attachmentPaths = paths;
        target.__attachmentAttrSlotCount = slotCount;
        target.attachments = __tmBuildTaskAttachmentEntries(paths);
        target.attachmentCount = paths.length;
        return target;
    }

    function __tmGetTaskAttachmentPaths(task) {
        const target = (task && typeof task === 'object') ? task : null;
        if (!target) return [];
        if (Array.isArray(target.__attachmentPaths)) return __tmNormalizeTaskAttachmentPaths(target.__attachmentPaths);
        if (Array.isArray(target.attachments)) return __tmNormalizeTaskAttachmentPaths(target.attachments);
        return [];
    }

    function __tmGetTaskAttachmentAttrSlotCount(source) {
        const target = (source && typeof source === 'object') ? source : null;
        if (!target) return 0;
        let slotCount = Math.max(0, Math.floor(Number(
            target.__attachmentAttrSlotCount
            ?? target.attachmentAttrSlotCount
            ?? target.attachment_attr_slot_count
        ) || 0));
        if (!slotCount) {
            Object.keys(target).forEach((key) => {
                const index = __tmGetTaskAttachmentAttrIndex(key);
                if (index >= 0) slotCount = Math.max(slotCount, index + 1);
            });
        }
        if (!slotCount) slotCount = __tmGetTaskAttachmentPaths(target).length;
        return slotCount;
    }

    function __tmExtractTaskAttachmentsFromAttrRow(row) {
        const source = (row && typeof row === 'object') ? row : {};
        const indexed = Object.keys(source)
            .map((key) => ({ key, index: __tmGetTaskAttachmentAttrIndex(key) }))
            .filter((item) => item.index >= 0)
            .sort((a, b) => a.index - b.index);
        if (!indexed.length) return [];
        return __tmNormalizeTaskAttachmentPaths(indexed.map((item) => source[item.key]));
    }

    function __tmBuildTaskAttachmentAttrPayload(nextPaths, currentPaths = [], options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const normalizedNext = __tmNormalizeTaskAttachmentPaths(nextPaths);
        const normalizedCurrent = __tmNormalizeTaskAttachmentPaths(currentPaths);
        const currentSlotCount = Math.max(0, Math.floor(Number(opts.currentSlotCount ?? opts.slotCount) || 0));
        const total = Math.max(normalizedNext.length, normalizedCurrent.length, currentSlotCount);
        const attrs = {};
        for (let i = 0; i < total; i += 1) {
            attrs[`${__TM_TASK_ATTACHMENT_ATTR_PREFIX}${i}`] = normalizedNext[i] || '';
        }
        return attrs;
    }

    async function __tmReadJsonFile(path) {
        const targetPath = String(path || '').trim();
        if (!targetPath) return null;
        try {
            const res = await fetch('/api/file/getFile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: targetPath }),
            });
            if (!res.ok) return null;
            const text = await res.text();
            if (!text || !text.trim()) return null;
            const json = JSON.parse(text);
            return (json && typeof json === 'object') ? json : null;
        } catch (e) {
            return null;
        }
    }

    async function __tmWriteJsonFile(path, data) {
        const targetPath = String(path || '').trim();
        if (!targetPath) return false;
        try {
            const formDir = new FormData();
            formDir.append('path', PLUGIN_STORAGE_DIR);
            formDir.append('isDir', 'true');
            await fetch('/api/file/putFile', { method: 'POST', body: formDir }).catch(() => null);

            const form = new FormData();
            form.append('path', targetPath);
            form.append('isDir', 'false');
            const compactJson = targetPath === TASK_SNAPSHOT_FILE_PATH
                || targetPath === TASK_INDEX_FILE_PATH
                || targetPath === DOC_SCOPE_CACHE_FILE_PATH;
            const jsonText = compactJson ? JSON.stringify(data) : JSON.stringify(data, null, 2);
            form.append('file', new Blob([jsonText], { type: 'application/json' }));
            const res = await fetch('/api/file/putFile', { method: 'POST', body: form });
            return !!(res && res.ok);
        } catch (e) {
            return false;
        }
    }

    function __tmCloneJsonSafe(value, fallback) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (e) {
            return fallback;
        }
    }

    function __tmEstimateJsonByteSize(value) {
        let text = '';
        try {
            text = JSON.stringify(value);
        } catch (e) {
            return Number.POSITIVE_INFINITY;
        }
        if (!text) return 0;
        try {
            if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
        } catch (e) {}
        return text.length * 2;
    }

    function __tmLogTaskSnapshot(stage, payload = {}) {
        void stage;
        void payload;
    }

    function __tmGetTaskSnapshotSignatureDiffKeys(actualSignature, expectedSignature) {
        try {
            const actual = JSON.parse(String(actualSignature || '{}'));
            const expected = JSON.parse(String(expectedSignature || '{}'));
            const keys = Array.from(new Set([
                ...Object.keys(actual || {}),
                ...Object.keys(expected || {}),
            ]));
            return keys.filter((key) => JSON.stringify(actual?.[key]) !== JSON.stringify(expected?.[key])).slice(0, 12);
        } catch (e) {
            return [];
        }
    }

    function __tmNormalizeTaskSnapshotDocIds(docIds = []) {
        return Array.from(new Set((Array.isArray(docIds) ? docIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => __tmIsLikelyBlockId(id))))
            .sort();
    }

    function __tmNormalizeDocScopeDocIds(docIds = []) {
        const out = [];
        const seen = new Set();
        (Array.isArray(docIds) ? docIds : []).forEach((id0) => {
            const id = String(id0 || '').trim();
            if (!__tmIsLikelyBlockId(id) || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    function __tmBuildTaskSnapshotScopeKey(docIds = [], groupId = 'all') {
        const gid = String(groupId || 'all').trim() || 'all';
        return `${gid}|${__tmNormalizeTaskSnapshotDocIds(docIds).join(',')}`;
    }

    function __tmCloneTaskSnapshotValue(value, depth = 0, seen = null) {
        if (depth > 18) return undefined;
        if (value == null) return value;
        const type = typeof value;
        if (type === 'string' || type === 'number' || type === 'boolean') return value;
        if (type === 'bigint') return String(value);
        if (type === 'function' || type === 'symbol' || type === 'undefined') return undefined;
        const refs = seen || new WeakSet();
        if (type === 'object') {
            if (typeof Element !== 'undefined' && value instanceof Element) return undefined;
            if (value instanceof Map || value instanceof Set || value instanceof WeakMap || value instanceof WeakSet) return undefined;
            if (refs.has(value)) return undefined;
            refs.add(value);
            if (Array.isArray(value)) {
                const arr = [];
                value.forEach((item) => {
                    const cloned = __tmCloneTaskSnapshotValue(item, depth + 1, refs);
                    if (cloned !== undefined) arr.push(cloned);
                });
                refs.delete(value);
                return arr;
            }
            const dropKeys = new Set([
                '__tmPriorityScoreCacheVersion',
                '__tmPriorityScoreCacheUntil',
                '__tmPendingInserted',
                '__tmTaskDetailPendingSave',
                '__tmTaskDetailActiveInlinePopover',
                '__tmTaskDetailRefreshHoldUntil',
            ]);
            const out = {};
            Object.entries(value).forEach(([key, item]) => {
                if (!key || dropKeys.has(key)) return;
                if (key.startsWith('__tm') && key !== '__tmLoadedCustomFieldIds') return;
                const cloned = __tmCloneTaskSnapshotValue(item, depth + 1, refs);
                if (cloned !== undefined) out[key] = cloned;
            });
            refs.delete(value);
            return out;
        }
        return undefined;
    }

    function __tmIsTaskSnapshotMeaningfulValue(value) {
        if (value === undefined || value === null || value === '' || value === 'null') return false;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return true;
    }

    function __tmSnapshotPickFirstValue(source, keys = []) {
        const row = (source && typeof source === 'object') ? source : {};
        for (const key0 of (Array.isArray(keys) ? keys : [])) {
            const key = String(key0 || '').trim();
            if (!key || !Object.prototype.hasOwnProperty.call(row, key)) continue;
            const value = row[key];
            if (__tmIsTaskSnapshotMeaningfulValue(value)) return value;
        }
        return undefined;
    }

    function __tmSnapshotPickBooleanTrue(source, keys = []) {
        const row = (source && typeof source === 'object') ? source : {};
        for (const key0 of (Array.isArray(keys) ? keys : [])) {
            const key = String(key0 || '').trim();
            if (!key || !Object.prototype.hasOwnProperty.call(row, key)) continue;
            const value = row[key];
            if (value === true || value === 1 || String(value || '').trim() === '1' || String(value || '').trim().toLowerCase() === 'true') return true;
        }
        return false;
    }

    function __tmSnapshotNormalizeTaskRepeatRuleForStore(source = {}) {
        const raw = __tmSnapshotPickFirstValue(source, [
            'repeatRule',
            'repeat_rule',
            __TM_TASK_REPEAT_RULE_ATTR,
        ]);
        if (!__tmIsTaskSnapshotMeaningfulValue(raw)) return undefined;
        let normalized = raw;
        try {
            normalized = __tmNormalizeTaskRepeatRule(raw, {
                startDate: source?.startDate || source?.start_date || '',
                completionTime: source?.completionTime || source?.completion_time || '',
            });
        } catch (e) {}
        if (!normalized || typeof normalized !== 'object') return undefined;
        if (normalized.enabled === false || String(normalized.type || '').trim().toLowerCase() === 'none') return undefined;
        const cloned = __tmCloneTaskSnapshotValue(normalized, 0);
        return cloned && typeof cloned === 'object' ? cloned : undefined;
    }

    function __tmSnapshotNormalizeTaskRepeatStateForStore(source = {}) {
        const raw = __tmSnapshotPickFirstValue(source, [
            'repeatState',
            'repeat_state',
            __TM_TASK_REPEAT_STATE_ATTR,
        ]);
        if (!__tmIsTaskSnapshotMeaningfulValue(raw)) return undefined;
        const normalized = __tmNormalizeTaskRepeatState(raw);
        const cloned = __tmCloneTaskSnapshotValue(normalized, 0);
        return cloned && typeof cloned === 'object' ? cloned : undefined;
    }

    function __tmSnapshotNormalizeTaskRepeatHistoryForStore(source = {}) {
        const raw = __tmSnapshotPickFirstValue(source, [
            'repeatHistory',
            'repeat_history',
            __TM_TASK_REPEAT_HISTORY_ATTR,
        ]);
        if (!__tmIsTaskSnapshotMeaningfulValue(raw)) return undefined;
        const normalized = __tmNormalizeTaskRepeatHistory(raw);
        const cloned = __tmCloneTaskSnapshotValue(normalized, 0);
        return Array.isArray(cloned) && cloned.length > 0 ? cloned : undefined;
    }

    function __tmSnapshotNormalizeTaskCustomFieldsForStore(source = {}) {
        const row = (source && typeof source === 'object') ? source : {};
        const rawValues = (row.customFieldValues && typeof row.customFieldValues === 'object' && !Array.isArray(row.customFieldValues))
            ? row.customFieldValues
            : ((row.__customFieldRawValues && typeof row.__customFieldRawValues === 'object' && !Array.isArray(row.__customFieldRawValues))
                ? row.__customFieldRawValues
                : null);
        if (!rawValues) return undefined;
        const normalized = __tmNormalizeTaskCustomFieldValues({}, rawValues);
        const cloned = __tmCloneTaskSnapshotValue(normalized, 0);
        return cloned && typeof cloned === 'object' && Object.keys(cloned).length > 0 ? cloned : undefined;
    }

    function __tmCompactTaskSnapshotTaskForStore(task) {
        const source = (task && typeof task === 'object') ? task : null;
        if (!source) return source;
        const out = {};
        const dropKeys = new Set([
            'custom_priority',
            'custom_duration',
            'custom_remark',
            'start_date',
            'completion_time',
            'task_complete_at',
            'custom_milestone',
            'custom_time',
            'custom_status',
            'custom_pinned',
            'repeatRule',
            'repeatState',
            'repeatHistory',
            'repeat_rule',
            'repeat_state',
            'repeat_history',
            'customFieldValues',
            'tomato_minutes',
            'tomato_hours',
            'attachments',
            'tasks',
            '__customFieldRawValues',
            '__tmLoadedAllCustomFields',
            '__tmLoadedCustomFieldIds',
        ]);
        Object.keys(source).sort().forEach((key) => {
            if (!key || key === 'children' || dropKeys.has(key)) return;
            const cloned = __tmCloneTaskSnapshotValue(source[key], 0);
            if (cloned !== undefined) out[key] = cloned;
        });
        const nextPriority = __tmSnapshotPickFirstValue(source, ['priority', 'custom_priority', 'customPriority']);
        if (__tmIsTaskSnapshotMeaningfulValue(nextPriority)) out.priority = String(nextPriority).trim();
        const nextDuration = __tmSnapshotPickFirstValue(source, ['duration', 'custom_duration']);
        if (__tmIsTaskSnapshotMeaningfulValue(nextDuration)) out.duration = String(nextDuration).trim();
        const nextRemark = __tmSnapshotPickFirstValue(source, ['remark', 'custom_remark']);
        if (__tmIsTaskSnapshotMeaningfulValue(nextRemark)) out.remark = String(nextRemark).trim();
        const nextStartDate = __tmSnapshotPickFirstValue(source, ['startDate', 'start_date', 'custom-start-date', 'custom_start_date']);
        if (__tmIsTaskSnapshotMeaningfulValue(nextStartDate)) out.startDate = String(nextStartDate).trim();
        const nextCompletionTime = __tmSnapshotPickFirstValue(source, ['completionTime', 'completion_time', 'custom-completion-time', 'custom_completion_time']);
        if (__tmIsTaskSnapshotMeaningfulValue(nextCompletionTime)) out.completionTime = String(nextCompletionTime).trim();
        const nextTaskCompleteAt = __tmSnapshotPickFirstValue(source, ['taskCompleteAt', 'task_complete_at', __TM_TASK_COMPLETE_AT_ATTR]);
        if (__tmIsTaskSnapshotMeaningfulValue(nextTaskCompleteAt)) out.taskCompleteAt = String(nextTaskCompleteAt).trim();
        const nextMilestone = __tmSnapshotPickBooleanTrue(source, ['milestone', 'custom_milestone', 'customMilestone']);
        if (nextMilestone) out.milestone = true;
        const nextCustomTime = __tmSnapshotPickFirstValue(source, ['customTime', 'custom_time']);
        if (__tmIsTaskSnapshotMeaningfulValue(nextCustomTime)) out.customTime = String(nextCustomTime).trim();
        const nextCustomStatus = __tmSnapshotPickFirstValue(source, ['customStatus', 'custom_status']);
        if (__tmIsTaskSnapshotMeaningfulValue(nextCustomStatus)) out.customStatus = String(nextCustomStatus).trim();
        const nextPinned = __tmSnapshotPickBooleanTrue(source, ['pinned', 'custom_pinned', 'customPinned']);
        if (nextPinned) out.pinned = true;
        const nextRepeatRule = __tmSnapshotNormalizeTaskRepeatRuleForStore(source);
        if (nextRepeatRule) out.repeatRule = nextRepeatRule;
        const nextRepeatState = __tmSnapshotNormalizeTaskRepeatStateForStore(source);
        if (nextRepeatState) out.repeatState = nextRepeatState;
        const nextRepeatHistory = __tmSnapshotNormalizeTaskRepeatHistoryForStore(source);
        if (nextRepeatHistory) out.repeatHistory = nextRepeatHistory;
        const nextCustomFieldValues = __tmSnapshotNormalizeTaskCustomFieldsForStore(source);
        if (nextCustomFieldValues) out.customFieldValues = nextCustomFieldValues;
        const nextAttachments = Array.isArray(source.attachments)
            ? __tmCloneTaskSnapshotValue(source.attachments, 0)
            : undefined;
        if (Array.isArray(nextAttachments) && nextAttachments.length > 0) out.attachments = nextAttachments;
        const nextTasks = Array.isArray(source.tasks)
            ? source.tasks.map((item) => __tmCompactTaskSnapshotTaskForStore(item)).filter(Boolean)
            : undefined;
        if (Array.isArray(nextTasks)) out.tasks = nextTasks;
        const nextChildren = Array.isArray(source.children)
            ? source.children.map((child) => __tmCompactTaskSnapshotTaskForStore(child)).filter(Boolean)
            : [];
        out.children = nextChildren;
        return out;
    }

    function __tmHydrateTaskSnapshotTaskForRuntime(task) {
        const target = (task && typeof task === 'object') ? task : null;
        if (!target) return target;
        const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';
        if (Array.isArray(target.__tmLoadedCustomFieldIds)) {
            target.__tmLoadedCustomFieldIds = Array.from(new Set(target.__tmLoadedCustomFieldIds.map((id) => String(id || '').trim()).filter(Boolean))).sort();
        }
        if (!isValidValue(target.priority) && isValidValue(target.custom_priority)) target.priority = String(target.custom_priority || '').trim();
        if (!isValidValue(target.duration) && isValidValue(target.custom_duration)) target.duration = String(target.custom_duration || '').trim();
        if (!isValidValue(target.remark) && isValidValue(target.custom_remark)) target.remark = String(target.custom_remark || '').trim();
        if (!isValidValue(target.startDate) && isValidValue(target.start_date)) target.startDate = String(target.start_date || '').trim();
        if (!isValidValue(target.completionTime) && isValidValue(target.completion_time)) target.completionTime = String(target.completion_time || '').trim();
        if (!isValidValue(target.taskCompleteAt) && isValidValue(target.task_complete_at)) target.taskCompleteAt = String(target.task_complete_at || '').trim();
        if (!isValidValue(target.customTime) && isValidValue(target.custom_time)) target.customTime = String(target.custom_time || '').trim();
        if (!isValidValue(target.customStatus) && isValidValue(target.custom_status)) target.customStatus = String(target.custom_status || '').trim();
        if (!isValidValue(target.pinned) && isValidValue(target.custom_pinned)) target.pinned = String(target.custom_pinned || '').trim() === '1';
        if (!isValidValue(target.milestone) && isValidValue(target.custom_milestone)) target.milestone = String(target.custom_milestone || '').trim() === '1';
        if (!target.repeatRule && target.repeat_rule) target.repeatRule = __tmCloneTaskSnapshotValue(target.repeat_rule, 0);
        if (!target.repeatRule) {
            target.repeatRule = __tmNormalizeTaskRepeatRule('', {
                startDate: target?.startDate,
                completionTime: target?.completionTime,
            });
        } else {
            target.repeatRule = __tmNormalizeTaskRepeatRule(target.repeatRule, {
                startDate: target?.startDate,
                completionTime: target?.completionTime,
            });
        }
        target.repeat_rule = target.repeatRule;
        if (!target.repeatState && target.repeat_state) target.repeatState = __tmCloneTaskSnapshotValue(target.repeat_state, 0);
        target.repeatState = __tmNormalizeTaskRepeatState(target.repeatState || target.repeat_state || '');
        target.repeat_state = target.repeatState;
        if (!target.repeatHistory && target.repeat_history) target.repeatHistory = __tmCloneTaskSnapshotValue(target.repeat_history, 0);
        target.repeatHistory = Array.isArray(target.repeatHistory) ? target.repeatHistory : __tmNormalizeTaskRepeatHistory(target.repeatHistory || target.repeat_history || '');
        target.repeat_history = target.repeatHistory;
        if (target.customFieldValues && typeof target.customFieldValues === 'object' && !Array.isArray(target.customFieldValues)) {
            target.customFieldValues = __tmNormalizeTaskCustomFieldValues({}, target.customFieldValues);
        }
        if (!Array.isArray(target.children)) target.children = [];
        target.children.forEach((child) => __tmHydrateTaskSnapshotTaskForRuntime(child));
        return target;
    }

    function __tmHydrateTaskSnapshotDocForRuntime(doc) {
        const target = (doc && typeof doc === 'object') ? doc : null;
        if (!target) return target;
        if (Array.isArray(target.tasks)) target.tasks.forEach((task) => __tmHydrateTaskSnapshotTaskForRuntime(task));
        return target;
    }

    function __tmBuildFlatTasksFromTaskSnapshotTree(taskTree) {
        const flat = {};
        const walk = (task) => {
            if (!task || typeof task !== 'object') return;
            const id = String(task.id || '').trim();
            if (id) flat[id] = task;
            (Array.isArray(task.children) ? task.children : []).forEach(walk);
        };
        (Array.isArray(taskTree) ? taskTree : []).forEach((doc) => {
            (Array.isArray(doc?.tasks) ? doc.tasks : []).forEach(walk);
        });
        return flat;
    }

    function __tmHashTaskSnapshotText(text = '') {
        const source = String(text || '');
        let h = 2166136261;
        for (let i = 0; i < source.length; i += 1) {
            h ^= source.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h.toString(36);
    }

    function __tmBuildTaskSnapshotDocDataKey(doc) {
        const source = (doc && typeof doc === 'object') ? doc : {};
        const docId = String(source.id || '').trim();
        let text = '';
        try { text = JSON.stringify(source) || ''; } catch (e) { text = ''; }
        return `${docId || 'doc'}:${__tmHashTaskSnapshotText(text)}:${text.length}`;
    }

    function __tmBuildTaskSnapshotOtherBlockDataKey(otherBlocks) {
        const list = Array.isArray(otherBlocks) ? otherBlocks : [];
        if (!list.length) return '';
        let text = '';
        try { text = JSON.stringify(list) || ''; } catch (e) { text = ''; }
        return `other:${__tmHashTaskSnapshotText(text)}:${text.length}`;
    }

    function __tmNormalizeTaskSnapshotStoreDocPool(rawDocs = null) {
        const out = {};
        const source = (rawDocs && typeof rawDocs === 'object' && !Array.isArray(rawDocs)) ? rawDocs : {};
        Object.entries(source).forEach(([key0, doc0]) => {
            const key = String(key0 || '').trim();
            const doc = (doc0 && typeof doc0 === 'object' && !Array.isArray(doc0)) ? doc0 : null;
            if (!key || !doc || !__tmIsLikelyBlockId(String(doc.id || '').trim())) return;
            out[key] = doc;
        });
        return out;
    }

    function __tmNormalizeTaskSnapshotStoreOtherBlockPool(rawSets = null) {
        const out = {};
        const source = (rawSets && typeof rawSets === 'object' && !Array.isArray(rawSets)) ? rawSets : {};
        Object.entries(source).forEach(([key0, list0]) => {
            const key = String(key0 || '').trim();
            if (!key || !Array.isArray(list0)) return;
            out[key] = list0;
        });
        return out;
    }

    function __tmBuildTaskSnapshotRecordForStore(snapshot, pools = {}) {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        if (!snap) return null;
        const docsPool = (pools.docs && typeof pools.docs === 'object') ? pools.docs : {};
        const otherBlockSets = (pools.otherBlockSets && typeof pools.otherBlockSets === 'object') ? pools.otherBlockSets : {};
        const record = { ...snap };
        const taskTree = Array.isArray(snap.taskTree) ? snap.taskTree : null;
        let docDataKeys = [];
        if (taskTree) {
            taskTree.forEach((doc) => {
                const cloned = __tmCloneTaskSnapshotValue(doc, 0);
                const docId = String(cloned?.id || '').trim();
                if (!cloned || !__tmIsLikelyBlockId(docId)) return;
                const compacted = __tmCompactTaskSnapshotTaskForStore(cloned) || cloned;
                const key = __tmBuildTaskSnapshotDocDataKey(compacted);
                docsPool[key] = compacted;
                docDataKeys.push(key);
            });
        } else {
            docDataKeys = (Array.isArray(snap.docDataKeys) ? snap.docDataKeys : [])
                .map((key) => String(key || '').trim())
                .filter((key) => key && docsPool[key]);
        }
        if (!docDataKeys.length) return null;
        record.dataMode = 'doc-pool';
        record.docDataKeys = docDataKeys;
        delete record.taskTree;

        if (Array.isArray(snap.otherBlocks) && snap.otherBlocks.length > 0) {
            const clonedOtherBlocks = __tmCloneTaskSnapshotValue(snap.otherBlocks, 0) || [];
            const otherKey = __tmBuildTaskSnapshotOtherBlockDataKey(clonedOtherBlocks);
            if (otherKey) {
                otherBlockSets[otherKey] = clonedOtherBlocks;
                record.otherBlockDataKey = otherKey;
            }
        } else {
            const otherKey = String(snap.otherBlockDataKey || '').trim();
            record.otherBlockDataKey = otherKey && otherBlockSets[otherKey] ? otherKey : '';
        }
        delete record.otherBlocks;
        return record;
    }

    function __tmMaterializeTaskSnapshotRecord(snapshot, store = null) {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        if (!snap) return null;
        if (Array.isArray(snap.taskTree)) return snap;
        const docDataKeys = Array.isArray(snap.docDataKeys)
            ? snap.docDataKeys.map((key) => String(key || '').trim()).filter(Boolean)
            : [];
        if (!docDataKeys.length) return null;
        const docsPool = store?.docs && typeof store.docs === 'object' ? store.docs : {};
        const taskTree = [];
        for (const key of docDataKeys) {
            const doc = docsPool[key];
            const cloned = __tmCloneTaskSnapshotValue(doc, 0);
            if (!cloned || !__tmIsLikelyBlockId(String(cloned.id || '').trim())) return null;
            taskTree.push(__tmHydrateTaskSnapshotDocForRuntime(cloned));
        }
        if (!taskTree.length) return null;
        const out = { ...snap, taskTree };
        const otherKey = String(snap.otherBlockDataKey || '').trim();
        const otherBlockSets = store?.otherBlockSets && typeof store.otherBlockSets === 'object'
            ? store.otherBlockSets
            : {};
        out.otherBlocks = otherKey && Array.isArray(otherBlockSets[otherKey])
            ? (__tmCloneTaskSnapshotValue(otherBlockSets[otherKey], 0) || [])
            : [];
        return out;
    }

    function __tmPruneTaskSnapshotStorePools(store) {
        const target = (store && typeof store === 'object') ? store : null;
        if (!target) return target;
        const usedDocKeys = new Set();
        const usedOtherKeys = new Set();
        Object.values(target.snapshots || {}).forEach((snap) => {
            (Array.isArray(snap?.docDataKeys) ? snap.docDataKeys : []).forEach((key0) => {
                const key = String(key0 || '').trim();
                if (key) usedDocKeys.add(key);
            });
            const otherKey = String(snap?.otherBlockDataKey || '').trim();
            if (otherKey) usedOtherKeys.add(otherKey);
        });
        Object.keys(target.docs || {}).forEach((key) => {
            if (!usedDocKeys.has(key)) delete target.docs[key];
        });
        Object.keys(target.otherBlockSets || {}).forEach((key) => {
            if (!usedOtherKeys.has(key)) delete target.otherBlockSets[key];
        });
        return target;
    }

    function __tmGetExpectedTaskCountFromMap(taskCountMap, docId) {
        const did = String(docId || '').trim();
        if (!did) return Number.NaN;
        if (taskCountMap instanceof Map) {
            if (!taskCountMap.has(did)) return Number.NaN;
            const value = Number(taskCountMap.get(did));
            return Number.isFinite(value) ? Math.max(0, Math.round(value)) : Number.NaN;
        }
        if (taskCountMap && typeof taskCountMap === 'object') {
            if (!Object.prototype.hasOwnProperty.call(taskCountMap, did)) return Number.NaN;
            const value = Number(taskCountMap[did]);
            return Number.isFinite(value) ? Math.max(0, Math.round(value)) : Number.NaN;
        }
        return Number.NaN;
    }

    function __tmGetExpectedTaskCountMapFromOptions(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        return opts.taskCountMap || opts.expectedTaskCountMap || opts.docTaskCountMap || null;
    }

    function __tmGetExpectedTaskTotalForDocs(docIds = [], options = {}) {
        const ids = __tmNormalizeTaskSnapshotDocIds(docIds || []);
        const map = __tmGetExpectedTaskCountMapFromOptions(options);
        if (!ids.length || !map) return Number.NaN;
        let total = 0;
        let known = 0;
        ids.forEach((docId) => {
            const count = __tmGetExpectedTaskCountFromMap(map, docId);
            if (!Number.isFinite(count)) return;
            known += 1;
            total += count;
        });
        return known === ids.length ? total : Number.NaN;
    }

    function __tmHasExpectedTaskCountCoverage(docIds = [], actualCount = 0, options = {}) {
        return __tmGetTaskCountCoverageStatus(docIds, actualCount, options).ok;
    }

    function __tmGetTaskCountCoverageStatus(docIds = [], actualCount = 0, options = {}) {
        const expected = __tmGetExpectedTaskTotalForDocs(docIds, options);
        const actual = Math.max(0, Math.round(Number(actualCount || 0) || 0));
        if (!Number.isFinite(expected)) {
            return { ok: true, reason: 'unknown-expected-task-count', actual, expected: Number.NaN, overageTolerance: 0 };
        }
        const rawOverageTolerance = options?.taskCountOverageTolerance ?? options?.expectedTaskCountOverageTolerance;
        const defaultOverageTolerance = Math.min(8, Math.max(0, Math.ceil(expected * 0.01)));
        const overageTolerance = Number.isFinite(Number(rawOverageTolerance))
            ? Math.max(0, Math.round(Number(rawOverageTolerance)))
            : defaultOverageTolerance;
        if (actual < expected) {
            return { ok: false, reason: 'underfilled-task-count', actual, expected, overageTolerance };
        }
        if (actual > expected + overageTolerance) {
            return { ok: false, reason: 'overfilled-task-count', actual, expected, overageTolerance };
        }
        return { ok: true, reason: 'ok', actual, expected, overageTolerance };
    }

    function __tmRememberSmallCache(map, key, value, limit = 12) {
        if (!(map instanceof Map)) return value;
        const cacheKey = String(key || '').trim();
        if (!cacheKey) return value;
        try {
            if (map.has(cacheKey)) map.delete(cacheKey);
            map.set(cacheKey, value);
            const max = Math.max(1, Math.floor(Number(limit) || 12));
            while (map.size > max) {
                const oldestKey = map.keys().next().value;
                if (oldestKey === undefined) break;
                map.delete(oldestKey);
            }
        } catch (e) {}
        return value;
    }

    function __tmClearGroupSessionTaskCache(docId = '') {
        const did = String(docId || '').trim();
        try {
            if (!did) {
                __tmGroupSessionTaskCache.clear();
                return;
            }
            for (const [key, entry] of __tmGroupSessionTaskCache.entries()) {
                const ids = Array.isArray(entry?.docIds) ? entry.docIds : [];
                if (ids.some((id) => String(id || '').trim() === did)) __tmGroupSessionTaskCache.delete(key);
            }
        } catch (e) {}
    }

    function __tmClearDocSessionTaskCache(docId = '') {
        const did = String(docId || '').trim();
        try {
            if (!did) {
                __tmDocSessionTaskCache.clear();
                return;
            }
            __tmDocSessionTaskCache.delete(did);
        } catch (e) {}
    }

    function __tmBuildDocSessionTaskEntry(doc, options = {}) {
        const source = (doc && typeof doc === 'object') ? doc : null;
        const docId = String(source?.id || '').trim();
        if (!source || !__tmIsLikelyBlockId(docId)) return null;
        const tasks = __tmCloneTaskSnapshotValue(Array.isArray(source.tasks) ? source.tasks : [], 0) || [];
        const flat = __tmBuildFlatTasksFromTaskSnapshotTree([{ tasks }]);
        const docInfo = (options?.docInfo && typeof options.docInfo === 'object') ? options.docInfo : {};
        return {
            id: docId,
            name: String(source.name || docInfo.name || '').trim(),
            alias: __tmNormalizeDocAliasValue(source.alias || docInfo.alias),
            icon: __tmNormalizeDocIconValue(source.icon || docInfo.icon),
            created: String(source.created || docInfo.created || '').trim(),
            docUpdated: String(source.docUpdated || source.updated || docInfo.updated || docInfo.docUpdated || '').trim(),
            t: Date.now(),
            taskCount: Object.keys(flat).length,
            inTaskTree: options?.inTaskTree === false ? false : true,
            tasks,
        };
    }

    function __tmRememberDocSessionTaskEntry(doc, options = {}) {
        const entry = __tmBuildDocSessionTaskEntry(doc, options);
        if (!entry) return false;
        __tmRememberSmallCache(__tmDocSessionTaskCache, entry.id, entry, 260);
        try { __tmPruneDocSessionTaskCache(); } catch (e) {}
        return true;
    }

    function __tmRememberDocSessionTaskEntries(taskTree, options = {}) {
        const docs = Array.isArray(taskTree) ? taskTree : [];
        const docIds = new Set(__tmNormalizeTaskSnapshotDocIds(options?.docIds || state.__tmLoadedDocIdsForTasks || []));
        if (!docs.length && !docIds.size) return 0;
        const docInfoById = new Map((Array.isArray(state.allDocuments) ? state.allDocuments : [])
            .map((doc) => [String(doc?.id || '').trim(), doc])
            .filter(([docId]) => __tmIsLikelyBlockId(docId)));
        let count = 0;
        docs.forEach((doc) => {
            const docId = String(doc?.id || '').trim();
            if (!__tmIsLikelyBlockId(docId)) return;
            if (docIds.size > 0 && !docIds.has(docId)) return;
            if (__tmRememberDocSessionTaskEntry(doc, {
                docInfo: docInfoById.get(docId),
                inTaskTree: true,
            })) count += 1;
        });
        return count;
    }

    function __tmRestoreDocSessionTaskState(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const docIds = __tmNormalizeTaskSnapshotDocIds(opts.docIds || []);
        if (!docIds.length) return null;
        const maxAgeMs = Number.isFinite(Number(opts.maxAgeMs)) ? Math.max(0, Number(opts.maxAgeMs)) : 10 * 60 * 1000;
        const docUpdatedMap = opts.docUpdatedMap instanceof Map ? opts.docUpdatedMap : null;
        const taskTree = [];
        let taskCount = 0;
        let oldestAt = Date.now();
        for (const docId of docIds) {
            const cached = __tmDocSessionTaskCache.get(docId);
            if (!cached || !Array.isArray(cached.tasks) || Date.now() - Number(cached.t || 0) > maxAgeMs) {
                try { if (cached) __tmDocSessionTaskCache.delete(docId); } catch (e) {}
                return null;
            }
            if (docUpdatedMap && docUpdatedMap.has(docId)) {
                const currentDocUpdated = String(docUpdatedMap.get(docId) || '').trim();
                const cachedDocUpdated = String(cached.docUpdated || '').trim();
                if (currentDocUpdated && cachedDocUpdated && currentDocUpdated !== cachedDocUpdated) {
                    try { __tmDocSessionTaskCache.delete(docId); } catch (e) {}
                    return null;
                }
            }
            const tasks = __tmCloneTaskSnapshotValue(cached.tasks, 0) || [];
            if (tasks.length || cached.inTaskTree !== false) {
                taskTree.push({
                    id: docId,
                    name: String(cached.name || '').trim() || '未命名文档',
                    alias: __tmNormalizeDocAliasValue(cached.alias),
                    icon: __tmNormalizeDocIconValue(cached.icon),
                    created: String(cached.created || '').trim(),
                    docUpdated: String(cached.docUpdated || '').trim(),
                    tasks,
                });
            }
            taskCount += Math.max(0, Math.round(Number(cached.taskCount || 0) || 0));
            oldestAt = Math.min(oldestAt, Number(cached.t || oldestAt));
        }
        const flatTasks = __tmBuildFlatTasksFromTaskSnapshotTree(taskTree);
        if (!__tmHasExpectedTaskCountCoverage(docIds, Object.keys(flatTasks).length, opts)) return null;
        state.taskTree = __tmSortDocEntriesByPinned(
            taskTree,
            String(opts.groupId || SettingsStore?.data?.currentGroupId || 'all').trim() || 'all'
        );
        try {
            state.flatTasks = __tmMergeOtherBlocksIntoFlatTasks(flatTasks);
        } catch (e) {
            state.flatTasks = flatTasks;
        }
        state.__tmLoadedDocIdsForTasks = docIds.slice();
        state.__tmDocSessionTaskRestoredAt = Date.now();
        return {
            docCount: taskTree.length,
            taskCount: taskCount || Object.keys(flatTasks).length,
            ageMs: Math.max(0, Date.now() - Number(oldestAt || 0)),
        };
    }

    function __tmBuildGroupSessionTaskCacheKey(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const docKey = __tmNormalizeTaskSnapshotDocIds(opts.docIds || []).join(',');
        if (!docKey) return '';
        const currentRuleId = String(opts.ruleId ?? state?.currentRule ?? SettingsStore?.data?.currentRule ?? '').trim();
        const groupMode = String(opts.groupMode ?? SettingsStore?.data?.groupMode ?? '').trim();
        const viewMode = String(opts.viewMode ?? state?.viewMode ?? '').trim();
        const activeDocId = String(opts.activeDocId ?? state?.activeDocId ?? 'all').trim() || 'all';
        const showCompleted = __tmGetShowCompletedTasksFromSettings(SettingsStore?.data) ? 1 : 0;
        const colOrder = Array.isArray(SettingsStore?.data?.columnOrder) ? SettingsStore.data.columnOrder.join(',') : '';
        const customFields = Array.isArray(opts.customFieldIds)
            ? opts.customFieldIds.map((id) => String(id || '').trim()).filter(Boolean).sort().join(',')
            : '';
        return [
            String(opts.groupId || SettingsStore?.data?.currentGroupId || 'all').trim() || 'all',
            activeDocId,
            viewMode,
            groupMode,
            currentRuleId,
            showCompleted,
            colOrder,
            customFields,
            docKey,
        ].join('|');
    }

    function __tmRememberGroupSessionTaskState(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const docIds = __tmNormalizeTaskSnapshotDocIds(opts.docIds || state.__tmLoadedDocIdsForTasks || []);
        const key = __tmBuildGroupSessionTaskCacheKey({ ...opts, docIds });
        if (!key || !docIds.length) return false;
        const taskTree = __tmCloneTaskSnapshotValue(Array.isArray(state.taskTree) ? state.taskTree : [], 0) || [];
        if (!taskTree.length) return false;
        const flatTasks = __tmBuildFlatTasksFromTaskSnapshotTree(taskTree);
        const payload = {
            t: Date.now(),
            docIds,
            taskTree,
            taskCount: Object.keys(flatTasks).length,
            source: String(opts.source || '').trim(),
        };
        __tmRememberSmallCache(__tmGroupSessionTaskCache, key, payload, 5);
        return true;
    }

    function __tmRestoreGroupSessionTaskState(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const docIds = __tmNormalizeTaskSnapshotDocIds(opts.docIds || []);
        const key = __tmBuildGroupSessionTaskCacheKey({ ...opts, docIds });
        if (!key) return null;
        const cached = __tmGroupSessionTaskCache.get(key);
        const maxAgeMs = Number.isFinite(Number(opts.maxAgeMs)) ? Math.max(0, Number(opts.maxAgeMs)) : 10 * 60 * 1000;
        if (!cached || !Array.isArray(cached.taskTree) || Date.now() - Number(cached.t || 0) > maxAgeMs) {
            try { if (cached) __tmGroupSessionTaskCache.delete(key); } catch (e) {}
            return null;
        }
        const taskTree = __tmCloneTaskSnapshotValue(cached.taskTree, 0) || [];
        if (!taskTree.length) return null;
        const flatTasks = __tmBuildFlatTasksFromTaskSnapshotTree(taskTree);
        if (!__tmHasExpectedTaskCountCoverage(docIds, Object.keys(flatTasks).length, opts)) return null;
        state.taskTree = __tmSortDocEntriesByPinned(
            taskTree,
            String(opts.groupId || SettingsStore?.data?.currentGroupId || 'all').trim() || 'all'
        );
        try {
            state.flatTasks = __tmMergeOtherBlocksIntoFlatTasks(flatTasks);
        } catch (e) {
            state.flatTasks = flatTasks;
        }
        state.__tmLoadedDocIdsForTasks = docIds.slice();
        return {
            docCount: taskTree.length,
            taskCount: Object.keys(flatTasks).length,
            ageMs: Math.max(0, Date.now() - Number(cached.t || 0)),
        };
    }

    function __tmGetShowCompletedTasksFromSettings(data = null) {
        const src = (data && typeof data === 'object') ? data : SettingsStore?.data;
        if (src && typeof src.showCompletedTasks === 'boolean') return !!src.showCompletedTasks;
        return !(src && src.excludeCompletedTasks === true);
    }

    function __tmSetShowCompletedTasksInSettings(show, data = null) {
        const target = (data && typeof data === 'object') ? data : SettingsStore?.data;
        if (!target || typeof target !== 'object') return false;
        target.showCompletedTasks = !!show;
        target.excludeCompletedTasks = !target.showCompletedTasks;
        return true;
    }

    function __tmNormalizeCompletedVisibilitySettings(data = null) {
        const target = (data && typeof data === 'object') ? data : SettingsStore?.data;
        if (!target || typeof target !== 'object') return false;
        return __tmSetShowCompletedTasksInSettings(__tmGetShowCompletedTasksFromSettings(target), target);
    }

    function __tmGetTaskSnapshotRuleForView() {
        try {
            const ruleId = String(state?.currentRule ?? SettingsStore?.data?.currentRule ?? '').trim();
            if (!ruleId) return null;
            const rules = Array.isArray(state?.filterRules) && state.filterRules.length > 0
                ? state.filterRules
                : (Array.isArray(SettingsStore?.data?.filterRules) ? SettingsStore.data.filterRules : []);
            return rules.find((rule) => String(rule?.id || '').trim() === ruleId) || null;
        } catch (e) {
            return null;
        }
    }

    function __tmBuildTaskSnapshotViewSignature(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const data = SettingsStore?.data || {};
        const rule = Object.prototype.hasOwnProperty.call(opts, 'rule')
            ? opts.rule
            : __tmGetTaskSnapshotRuleForView();
        const day = (() => {
            try {
                const d = new Date();
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${dd}`;
            } catch (e) {
                return '';
            }
        })();
        const payload = {
            v: 1,
            day,
            groupId: String(opts.groupId || data.currentGroupId || 'all').trim() || 'all',
            viewMode: String(opts.viewMode || state?.viewMode || '').trim(),
            activeDocId: String(opts.activeDocId || state?.activeDocId || 'all').trim() || 'all',
            ruleId: String(state?.currentRule ?? data.currentRule ?? '').trim(),
            rule: rule ? __tmStableSettingsJsonValue({
                conditions: Array.isArray(rule.conditions) ? rule.conditions : [],
                sort: Array.isArray(rule.sort) ? rule.sort : [],
                enabled: rule.enabled !== false,
            }) : null,
            searchKeyword: String(state?.searchKeyword || '').trim(),
            archiveMode: state?.docTabsArchiveMode === true ? 1 : 0,
            groupMode: String(data.groupMode || '').trim(),
            groupByDocName: data.groupByDocName ? 1 : 0,
            groupByTaskName: data.groupByTaskName ? 1 : 0,
            groupByTime: data.groupByTime ? 1 : 0,
            quadrantEnabled: data.quadrantConfig?.enabled ? 1 : 0,
            showCompleted: __tmGetShowCompletedTasksFromSettings(data) ? 1 : 0,
            docTabSortMode: String(data.docTabSortMode || '').trim(),
            taskHeadingLevel: String(data.taskHeadingLevel || 'h2').trim() || 'h2',
            docH2SubgroupEnabled: data.docH2SubgroupEnabled ? 1 : 0,
            whiteboardSequenceMode: data.whiteboardSequenceMode ? 1 : 0,
            customFieldDefsVersion: __tmParseVersionNumber(data.customFieldDefsVersion),
        };
        try {
            return JSON.stringify(__tmStableSettingsJsonValue(payload));
        } catch (e) {
            return '';
        }
    }

    function __tmBuildTaskSnapshotViewState(options = {}) {
        try {
            const filteredTasks = Array.isArray(state?.filteredTasks) ? state.filteredTasks : [];
            const filteredTaskIds = filteredTasks
                .map((task) => String(task?.id || task?.blockId || '').trim())
                .filter(Boolean);
            const filteredDocIdsForTabs = (Array.isArray(state?.filteredDocIdsForTabs) ? state.filteredDocIdsForTabs : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean);
            return {
                version: 1,
                createdAt: Date.now(),
                signature: __tmBuildTaskSnapshotViewSignature(options),
                filteredTaskIds,
                filteredDocIdsForTabs,
                listRenderSignature: String(state?.listRenderSignature || ''),
                listRenderStep: Math.max(20, Math.min(1200, Number(state?.listRenderStep) || 20)),
                listRenderLimit: Math.max(0, Math.round(Number(state?.listRenderLimit) || 0)),
            };
        } catch (e) {
            return null;
        }
    }

    function __tmGetTaskSnapshotViewStateCandidates(snapshot, expectedSignature = '') {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        const out = [];
        const push = (view, source = '') => {
            if (!view || typeof view !== 'object' || Number(view.version || 0) !== 1) return;
            out.push({
                view,
                source: String(source || '').trim() || 'viewState',
                signature: String(view.signature || ''),
            });
        };
        push(snap?.viewState, 'viewState');
        if (snap?.viewStates && typeof snap.viewStates === 'object' && !Array.isArray(snap.viewStates)) {
            Object.entries(snap.viewStates).forEach(([key, view]) => push(view, `viewStates:${key}`));
        }
        if (expectedSignature) {
            out.sort((a, b) => {
                const ah = a.signature === expectedSignature ? 1 : 0;
                const bh = b.signature === expectedSignature ? 1 : 0;
                if (ah !== bh) return bh - ah;
                return Number(b.view?.createdAt || 0) - Number(a.view?.createdAt || 0);
            });
        }
        return out;
    }

    function __tmAttachTaskSnapshotViewState(payload, options = {}) {
        const target = (payload && typeof payload === 'object') ? payload : null;
        if (!target) return target;
        const opts = (options && typeof options === 'object') ? options : {};
        const nextView = __tmBuildTaskSnapshotViewState(opts);
        if (!nextView || !String(nextView.signature || '').trim()) {
            target.viewState = nextView || null;
            return target;
        }
        const viewStates = {};
        const push = (view) => {
            if (!view || typeof view !== 'object' || Number(view.version || 0) !== 1) return;
            const sig = String(view.signature || '').trim();
            if (!sig) return;
            viewStates[sig] = view;
        };
        const previous = (opts.previousSnapshot && typeof opts.previousSnapshot === 'object') ? opts.previousSnapshot : null;
        push(previous?.viewState);
        if (previous?.viewStates && typeof previous.viewStates === 'object' && !Array.isArray(previous.viewStates)) {
            Object.values(previous.viewStates).forEach(push);
        }
        push(target.viewState);
        if (target.viewStates && typeof target.viewStates === 'object' && !Array.isArray(target.viewStates)) {
            Object.values(target.viewStates).forEach(push);
        }
        push(nextView);
        const kept = Object.values(viewStates)
            .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))
            .slice(0, 6);
        target.viewStates = {};
        kept.forEach((view) => {
            const sig = String(view?.signature || '').trim();
            if (sig) target.viewStates[sig] = view;
        });
        target.viewState = nextView;
        return target;
    }

    function __tmRestoreTaskSnapshotViewState(snapshot, options = {}) {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        const logViewMiss = (reason, extra = {}) => {
            __tmLogTaskSnapshot('view-restore-miss', {
                reason: String(reason || '').trim() || 'unknown',
                groupId: String(options?.groupId || snap?.groupId || 'all').trim() || 'all',
                viewMode: String(options?.viewMode || state?.viewMode || '').trim(),
                docCount: Array.isArray(snap?.docIds) ? snap.docIds.length : 0,
                ...((extra && typeof extra === 'object') ? extra : {}),
            });
        };
        const expected = __tmBuildTaskSnapshotViewSignature(options);
        const candidates = __tmGetTaskSnapshotViewStateCandidates(snap, expected);
        const view = candidates.find((item) => item.signature === expected)?.view || null;
        if (!view) {
            const newest = candidates[0] || null;
            logViewMiss(candidates.length ? 'signature-mismatch' : 'missing-view-state', {
                candidateCount: candidates.length,
                diffKeys: __tmGetTaskSnapshotSignatureDiffKeys(newest?.signature || '', expected),
                diffKeyText: __tmGetTaskSnapshotSignatureDiffKeys(newest?.signature || '', expected).join(','),
                source: String(newest?.source || ''),
            });
            return null;
        }
        if (Number(view.version || 0) !== 1) {
            logViewMiss('version-mismatch', { version: Number(view.version || 0) || 0 });
            return null;
        }
        if (!expected) {
            logViewMiss('empty-expected-signature');
            return null;
        }
        const ids = Array.isArray(view.filteredTaskIds) ? view.filteredTaskIds.map((id) => String(id || '').trim()) : null;
        if (!ids) {
            logViewMiss('missing-filtered-ids');
            return null;
        }
        const flat = state?.flatTasks && typeof state.flatTasks === 'object' ? state.flatTasks : {};
        const filtered = [];
        const missingIds = [];
        for (const id of ids) {
            if (!id) continue;
            const task = flat[id];
            if (!task) {
                missingIds.push(id);
                continue;
            }
            filtered.push(task);
        }
        if (missingIds.length > 0) {
            const missingLimit = Math.max(3, Math.min(24, Math.ceil(ids.length * 0.01)));
            if (missingIds.length > missingLimit || filtered.length === 0) {
                logViewMiss('missing-task', {
                    taskId: missingIds[0],
                    missingCount: missingIds.length,
                    missingLimit,
                    filteredIdCount: ids.length,
                });
                return null;
            }
            __tmLogTaskSnapshot('view-restore-partial', {
                reason: 'missing-small-task-set',
                groupId: String(options?.groupId || snap?.groupId || 'all').trim() || 'all',
                viewMode: String(options?.viewMode || state?.viewMode || '').trim(),
                missingCount: missingIds.length,
                missingLimit,
                filteredCount: filtered.length,
                filteredIdCount: ids.length,
                sampleTaskIds: missingIds.slice(0, 5),
            });
        }
        state.filteredTasks = filtered;
        state.filteredDocIdsForTabs = (Array.isArray(view.filteredDocIdsForTabs) ? view.filteredDocIdsForTabs : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean);
        state.listRenderSignature = String(view.listRenderSignature || '');
        const activeDocId = String(state?.activeDocId || 'all').trim() || 'all';
        const docTabStep = activeDocId && activeDocId !== 'all' && activeDocId !== __TM_OTHER_BLOCK_TAB_ID
            ? Math.min(1200, Math.max(100, filtered.length))
            : 0;
        state.listRenderStep = Math.max(
            docTabStep || 20,
            Math.min(1200, Number(view.listRenderStep) || Number(state.listRenderStep) || 20)
        );
        const limit = Math.max(0, Math.round(Number(view.listRenderLimit) || 0));
        if (limit > 0 || docTabStep > 0) {
            state.listRenderLimit = Math.min(filtered.length, Math.max(state.listRenderStep, limit, docTabStep));
        }
        state.__tmLastFilterPerf = {
            cacheHit: 'snapshot-view',
            totalMs: 0,
            orderedCount: filtered.length,
            filteredDocTabCount: state.filteredDocIdsForTabs.length,
            missingSnapshotViewTaskCount: missingIds.length,
        };
        state.__tmTaskSnapshotViewRestoredAt = Date.now();
        try { window.dispatchEvent(new CustomEvent('tm:filtered-tasks-updated')); } catch (e) {}
        return {
            filteredCount: filtered.length,
            docTabCount: state.filteredDocIdsForTabs.length,
            missingCount: missingIds.length,
            ageMs: Math.max(0, Date.now() - Number(view.createdAt || snap.createdAt || 0)),
        };
    }

    function __tmBuildTaskSnapshotPayload(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const docIds = __tmNormalizeTaskSnapshotDocIds(opts.docIds);
        const groupId = String(opts.groupId || SettingsStore?.data?.currentGroupId || 'all').trim() || 'all';
        const activeDocId = String(opts.activeDocId || state?.activeDocId || 'all').trim() || 'all';
        const preserve = groupId !== 'all' && activeDocId === 'all';
        const payload = {
            version: __TM_TASK_SNAPSHOT_VERSION,
            createdAt: Date.now(),
            groupId,
            scopeKey: __tmBuildTaskSnapshotScopeKey(docIds, groupId),
            docIds,
            activeDocId,
            preserve,
            queryLimit: Number.isFinite(Number(opts.queryLimit)) ? Math.max(1, Math.round(Number(opts.queryLimit))) : 0,
            taskTree: __tmCloneTaskSnapshotValue(Array.isArray(state.taskTree) ? state.taskTree : [], 0) || [],
            otherBlocks: __tmCloneTaskSnapshotValue(Array.isArray(state.otherBlocks) ? state.otherBlocks : [], 0) || [],
        };
        return __tmAttachTaskSnapshotViewState(payload, { groupId });
    }

    function __tmBuildTaskSnapshotPersistSignature(payload) {
        try {
            const snap = (payload && typeof payload === 'object') ? payload : null;
            if (!snap) return '';
            const taskTree = Array.isArray(snap.taskTree) ? snap.taskTree : [];
            const taskSig = [];
            const walk = (task) => {
                if (!task || typeof task !== 'object') return;
                const id = String(task.id || task.blockId || '').trim();
                if (id) {
                    taskSig.push([
                        id,
                        task.done ? 1 : 0,
                        String(task.updated || task.updatedAt || '').trim(),
                        String(task.startDate || task.start_date || '').trim(),
                        String(task.completionTime || task.completion_time || task.taskCompleteAt || '').trim(),
                        String(task.customTime || task.custom_time || '').trim(),
                        String(task.parentTaskId || task.parent_task_id || '').trim(),
                        Number.isFinite(Number(task.level)) ? Number(task.level) : '',
                        Number.isFinite(Number(task.docSeq)) ? Number(task.docSeq) : '',
                    ].join('\u0001'));
                }
                if (Array.isArray(task.children)) task.children.forEach(walk);
            };
            taskTree.forEach((doc) => {
                const docId = String(doc?.id || '').trim();
                taskSig.push(`doc:${docId}:${String(doc?.updated || doc?.docUpdated || '').trim()}`);
                (Array.isArray(doc?.tasks) ? doc.tasks : []).forEach(walk);
            });
            const otherBlocks = Array.isArray(snap.otherBlocks) ? snap.otherBlocks : [];
            otherBlocks.forEach(walk);
            const viewKeys = Object.keys(snap.viewStates || {}).sort();
            const viewSig = viewKeys.map((key) => {
                const view = snap.viewStates?.[key];
                return [
                    key,
                    Array.isArray(view?.filteredTaskIds) ? view.filteredTaskIds.length : 0,
                    String(view?.listRenderSignature || '').trim(),
                    Number(view?.listRenderLimit || 0) || 0,
                ].join(':');
            });
            return JSON.stringify({
                version: Number(snap.version || 0) || 0,
                groupId: String(snap.groupId || '').trim(),
                scopeKey: String(snap.scopeKey || '').trim(),
                docIds: Array.isArray(snap.docIds) ? snap.docIds.slice() : [],
                queryLimit: Number(snap.queryLimit || 0) || 0,
                tasks: taskSig,
                otherBlockCount: otherBlocks.length,
                views: viewSig,
            });
        } catch (e) {
            return '';
        }
    }

    function __tmIsUsableTaskSnapshot(snapshot) {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        if (!snap || Number(snap.version) !== __TM_TASK_SNAPSHOT_VERSION) return false;
        const createdAt = Number(snap.createdAt || 0);
        if (!createdAt) return false;
        if (!__tmIsPreservedTaskSnapshot(snap) && Date.now() - createdAt > __TM_TASK_SNAPSHOT_MAX_AGE_MS) return false;
        if (!Array.isArray(snap.taskTree) && !Array.isArray(snap.docDataKeys)) return false;
        if (!String(snap.scopeKey || '').trim()) return false;
        return true;
    }

    function __tmIsPreservedTaskSnapshot(snapshot) {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        if (!snap) return false;
        return snap.preserve === true
            || snap.retain === true
            || snap.keep === true
            || snap.keepAlive === true;
    }

    function __tmCreateEmptyTaskSnapshotStore(updatedAt = Date.now()) {
        return {
            version: __TM_TASK_SNAPSHOT_VERSION,
            updatedAt: Number(updatedAt || 0) || Date.now(),
            order: [],
            snapshots: {},
            docs: {},
            otherBlockSets: {},
        };
    }

    function __tmBuildTaskSnapshotStore(raw = null) {
        const snapshots = {};
        const pooledDocs = __tmNormalizeTaskSnapshotStoreDocPool(raw?.docs);
        const pooledOtherBlockSets = __tmNormalizeTaskSnapshotStoreOtherBlockPool(raw?.otherBlockSets);
        const skipStats = {
            unusable: 0,
            maxEntries: 0,
            missingKey: 0,
            tooLarge: 0,
            storeTooLarge: 0,
            preserved: 0,
        };
        const push = (item) => {
            const snap = (item && typeof item === 'object') ? item : null;
            const materialized = __tmMaterializeTaskSnapshotRecord(snap, {
                docs: pooledDocs,
                otherBlockSets: pooledOtherBlockSets,
            });
            if (!__tmIsUsableTaskSnapshot(materialized)) {
                skipStats.unusable += 1;
                return;
            }
            snapshots[String(materialized.scopeKey || '').trim()] = materialized;
        };
        if (raw && typeof raw === 'object' && raw.snapshots && typeof raw.snapshots === 'object') {
            Object.values(raw.snapshots).forEach(push);
        } else {
            push(raw);
        }
        const out = __tmCreateEmptyTaskSnapshotStore(Date.now());
        out.docs = {};
        out.otherBlockSets = {};
        const candidates = Object.values(snapshots)
            .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
        const preservedCandidates = candidates.filter((snap) => __tmIsPreservedTaskSnapshot(snap));
        const normalCandidates = candidates.filter((snap) => !__tmIsPreservedTaskSnapshot(snap));
        const addSnapshot = (snap, countTowardsLimit = true) => {
            const key = String(snap?.scopeKey || '').trim();
            if (!key) {
                skipStats.missingKey += 1;
                return false;
            }
            const record = __tmBuildTaskSnapshotRecordForStore(snap, {
                docs: out.docs,
                otherBlockSets: out.otherBlockSets,
            });
            if (!record) {
                skipStats.unusable += 1;
                return false;
            }
            if (__tmEstimateJsonByteSize(record) > __TM_TASK_SNAPSHOT_MAX_SINGLE_BYTES) {
                skipStats.tooLarge += 1;
                return false;
            }
            if (countTowardsLimit && out.order.length >= __TM_TASK_SNAPSHOT_MAX_ENTRIES) {
                skipStats.maxEntries += 1;
                return false;
            }
            out.order.push(key);
            out.snapshots[key] = record;
            if (countTowardsLimit && __tmEstimateJsonByteSize(out) > __TM_TASK_SNAPSHOT_MAX_BYTES) {
                out.order.pop();
                delete out.snapshots[key];
                __tmPruneTaskSnapshotStorePools(out);
                skipStats.storeTooLarge += 1;
                return false;
            }
            return true;
        };
        preservedCandidates.forEach((snap) => {
            if (addSnapshot(snap, false)) skipStats.preserved += 1;
        });
        normalCandidates.forEach((snap) => {
            addSnapshot(snap, true);
        });
        __tmPruneTaskSnapshotStorePools(out);
        try {
            const skipped = Object.values(skipStats).reduce((sum, value) => sum + Number(value || 0), 0);
            if (skipped > 0) {
                __tmLogTaskSnapshot('store-pruned', {
                    kept: out.order.length,
                    candidateCount: candidates.length,
                    maxEntries: __TM_TASK_SNAPSHOT_MAX_ENTRIES,
                    ...skipStats,
                });
            }
        } catch (e) {}
        return out;
    }

    function __tmValidateTaskSnapshotForScope(snapshot, options = {}) {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        if (!__tmIsUsableTaskSnapshot(snap)) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const docIds = __tmNormalizeTaskSnapshotDocIds(opts.docIds);
        const groupId = String(opts.groupId || 'all').trim() || 'all';
        return String(snap.scopeKey || '') === __tmBuildTaskSnapshotScopeKey(docIds, groupId);
    }

    async function __tmLoadTaskSnapshotForScope(options = {}) {
        try {
            const opts = (options && typeof options === 'object') ? options : {};
            if (opts.cachedOnly && !__tmTaskSnapshotStoreCache) {
                __tmScheduleWarmTaskSnapshotStore(1800);
                __tmLogTaskSnapshot('scope-miss', {
                    reason: 'cached-store-empty',
                    cachedOnly: 1,
                    groupId: String(opts.groupId || 'all').trim() || 'all',
                    docCount: __tmNormalizeTaskSnapshotDocIds(opts.docIds || []).length,
                });
                return null;
            }
            const store = opts.cachedOnly
                ? __tmTaskSnapshotStoreCache
                : await __tmLoadTaskSnapshotStore();
            const scopeKey = __tmBuildTaskSnapshotScopeKey(opts.docIds, opts.groupId || 'all');
            const snapshot = store?.snapshots?.[scopeKey];
            const valid = __tmValidateTaskSnapshotForScope(snapshot, options);
            if (!valid) {
                __tmLogTaskSnapshot('scope-miss', {
                    reason: snapshot ? 'invalid-scope' : 'not-found',
                    cachedOnly: opts.cachedOnly ? 1 : 0,
                    groupId: String(opts.groupId || 'all').trim() || 'all',
                    docCount: __tmNormalizeTaskSnapshotDocIds(opts.docIds || []).length,
                    storeEntryCount: Object.keys(store?.snapshots || {}).length,
                });
                return null;
            }
            const materialized = __tmMaterializeTaskSnapshotRecord(snapshot, store);
            if (!materialized || !__tmValidateTaskSnapshotForScope(materialized, options)) {
                __tmLogTaskSnapshot('scope-miss', {
                    reason: 'missing-pooled-data',
                    cachedOnly: opts.cachedOnly ? 1 : 0,
                    groupId: String(opts.groupId || 'all').trim() || 'all',
                    docCount: __tmNormalizeTaskSnapshotDocIds(opts.docIds || []).length,
                    storeEntryCount: Object.keys(store?.snapshots || {}).length,
                });
                return null;
            }
            __tmLogTaskSnapshot('scope-hit', {
                cachedOnly: opts.cachedOnly ? 1 : 0,
                groupId: String(materialized?.groupId || opts.groupId || 'all').trim() || 'all',
                docCount: Array.isArray(materialized?.docIds) ? materialized.docIds.length : 0,
                ageMs: Math.max(0, Date.now() - Number(materialized?.createdAt || 0)),
                dataMode: String(snapshot?.dataMode || ''),
            });
            return materialized;
        } catch (e) {
            __tmLogTaskSnapshot('scope-error', {
                error: String(e?.message || e || '').trim() || 'load-failed',
            });
            return null;
        }
    }

    function __tmSelectLatestTaskSnapshotForGroupFromStore(store, groupId = 'all') {
        try {
            const gid = String(groupId || 'all').trim() || 'all';
            const snapshots = Object.values(store?.snapshots || {});
            const groups = Array.from(new Set(snapshots.map((snap) => String(
                snap?.groupId
                || String(snap?.scopeKey || '').split('|')[0]
                || 'all'
            ).trim() || 'all'))).slice(0, 12);
            const items = snapshots
                .filter((snap) => {
                    if (!__tmIsUsableTaskSnapshot(snap)) return false;
                    const snapGroupId = String(
                        snap?.groupId
                        || String(snap?.scopeKey || '').split('|')[0]
                        || 'all'
                    ).trim() || 'all';
                    return snapGroupId === gid;
                })
                .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
            let selected = null;
            let materialized = null;
            for (const item of items) {
                const next = __tmMaterializeTaskSnapshotRecord(item, store);
                if (!__tmIsUsableTaskSnapshot(next)) continue;
                selected = item;
                materialized = next;
                break;
            }
            __tmLogTaskSnapshot(materialized ? 'latest-hit' : 'latest-miss', {
                groupId: gid,
                storeEntryCount: snapshots.length,
                matchingCount: items.length,
                groups,
                ageMs: selected ? Math.max(0, Date.now() - Number(selected?.createdAt || 0)) : 0,
                docCount: materialized && Array.isArray(materialized?.docIds) ? materialized.docIds.length : 0,
                dataMode: String(selected?.dataMode || ''),
            });
            return materialized;
        } catch (e) {
            __tmLogTaskSnapshot('latest-error', {
                groupId: String(groupId || 'all').trim() || 'all',
                error: String(e?.message || e || '').trim() || 'select-failed',
            });
            return null;
        }
    }

    async function __tmLoadTaskSnapshotStore(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (!opts.force && __tmTaskSnapshotStoreCache) return __tmTaskSnapshotStoreCache;
        if (!opts.force && __tmTaskSnapshotStoreLoadPromise) return await __tmTaskSnapshotStoreLoadPromise;
        __tmTaskSnapshotStoreLoadPromise = Promise.resolve()
            .then(async () => {
                const raw = await __tmReadJsonFile(TASK_SNAPSHOT_FILE_PATH);
                const store = __tmBuildTaskSnapshotStore(raw);
                __tmTaskSnapshotStoreCache = store;
                try {
                    const rawBytes = raw ? __tmEstimateJsonByteSize(raw) : 0;
                    const storeBytes = __tmEstimateJsonByteSize(store);
                    if (rawBytes > (storeBytes + 1024)) {
                        __tmLogTaskSnapshot('store-compaction-scheduled', {
                            rawBytes,
                            storeBytes,
                            savedBytes: Math.max(0, rawBytes - storeBytes),
                            storeEntryCount: Object.keys(store?.snapshots || {}).length,
                            pooledDocCount: Object.keys(store?.docs || {}).length,
                        });
                        __tmScheduleIdleTask(async () => {
                            const ok = await __tmWriteJsonFile(TASK_SNAPSHOT_FILE_PATH, store);
                            __tmLogTaskSnapshot('store-compaction-done', {
                                ok: ok ? 1 : 0,
                                rawBytes,
                                storeBytes,
                                savedBytes: Math.max(0, rawBytes - storeBytes),
                                storeEntryCount: Object.keys(store?.snapshots || {}).length,
                                pooledDocCount: Object.keys(store?.docs || {}).length,
                            });
                        }, 2200);
                    }
                } catch (e) {}
                return store;
            })
            .finally(() => {
                __tmTaskSnapshotStoreLoadPromise = null;
            });
        return await __tmTaskSnapshotStoreLoadPromise;
    }

    async function __tmLoadLatestTaskSnapshotForGroup(groupId = 'all', options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        try {
            if (opts.cachedOnly) {
                return __tmSelectLatestTaskSnapshotForGroupFromStore(__tmTaskSnapshotStoreCache, groupId);
            }
            const store = await __tmLoadTaskSnapshotStore({ force: !!opts.force });
            return __tmSelectLatestTaskSnapshotForGroupFromStore(store, groupId);
        } catch (e) {
            return null;
        }
    }

    function __tmWarmTaskSnapshotStore() {
        if (__tmTaskSnapshotStoreCache || __tmTaskSnapshotStoreLoadPromise) return;
        try { __tmLoadTaskSnapshotStore().catch(() => null); } catch (e) {}
    }

    function __tmScheduleWarmTaskSnapshotStore(delayMs = 1800) {
        if (__tmTaskSnapshotStoreCache || __tmTaskSnapshotStoreLoadPromise) return false;
        const delay0 = Number(delayMs);
        const waitMs = Math.max(80, Number.isFinite(delay0) ? delay0 : 1800);
        const run = () => {
            if (__tmTaskSnapshotStoreCache || __tmTaskSnapshotStoreLoadPromise) return;
            try { __tmWarmTaskSnapshotStore(); } catch (e) {}
        };
        try { __tmScheduleIdleTask(run, waitMs); } catch (e) { setTimeout(run, waitMs); }
        return true;
    }

    function __tmRestoreTaskSnapshotIntoState(snapshot, options = {}) {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        if (!snap || !Array.isArray(snap.taskTree)) return null;
        const taskTree = __tmCloneTaskSnapshotValue(snap.taskTree, 0) || [];
        const flatTasks = __tmBuildFlatTasksFromTaskSnapshotTree(taskTree);
        const coverage = __tmGetTaskCountCoverageStatus(snap.docIds || [], Object.keys(flatTasks).length, options);
        if (!coverage.ok) {
            __tmLogTaskSnapshot('restore-reject', {
                reason: coverage.reason,
                groupId: String(snap.groupId || options?.groupId || SettingsStore?.data?.currentGroupId || 'all').trim() || 'all',
                docCount: Array.isArray(snap.docIds) ? snap.docIds.length : 0,
                taskCount: coverage.actual,
                expectedTaskCount: coverage.expected,
                overageTolerance: coverage.overageTolerance,
            });
            return null;
        }
        state.taskTree = taskTree;
        state.otherBlocks = __tmCloneTaskSnapshotValue(Array.isArray(snap.otherBlocks) ? snap.otherBlocks : [], 0) || [];
        try {
            state.flatTasks = __tmMergeOtherBlocksIntoFlatTasks(flatTasks);
        } catch (e) {
            state.flatTasks = flatTasks;
        }
        state.__tmLoadedDocIdsForTasks = Array.isArray(snap.docIds) ? snap.docIds.slice() : [];
        state.__tmTaskSnapshotRestoredAt = Date.now();
        return {
            docCount: taskTree.length,
            taskCount: Object.keys(flatTasks).length,
            otherBlockCount: Array.isArray(state.otherBlocks) ? state.otherBlocks.length : 0,
            ageMs: Math.max(0, Date.now() - Number(snap.createdAt || 0)),
        };
    }

    function __tmFlattenTaskIndexTree(tasks, out = []) {
        (Array.isArray(tasks) ? tasks : []).forEach((task) => {
            if (!task || typeof task !== 'object') return;
            out.push(task);
            if (Array.isArray(task.children) && task.children.length > 0) {
                __tmFlattenTaskIndexTree(task.children, out);
            }
        });
        return out;
    }

    function __tmCompactTaskIndexText(value, maxLength = 0) {
        const text = String(value || '').trim();
        const limit = Math.max(0, Math.floor(Number(maxLength) || 0));
        if (!limit || text.length <= limit) return text;
        return text.slice(0, limit);
    }

    function __tmCompactTaskIndexValue(value, options = {}) {
        if (value == null || value === '' || value === false) return undefined;
        if (Array.isArray(value) && value.length === 0) return undefined;
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return undefined;
        const cloned = __tmCloneTaskSnapshotValue(value, 0);
        const maxBytes = Math.max(0, Math.floor(Number(options?.maxBytes || 0) || 0));
        if (maxBytes > 0 && __tmEstimateJsonByteSize(cloned) > maxBytes) return undefined;
        return cloned;
    }

    function __tmBuildTaskIndexBlockEntry(task, doc = null, fallbackParentTaskId = '') {
        const source = (task && typeof task === 'object') ? task : null;
        const id = String(source?.id || source?.blockId || '').trim();
        if (!source || !__tmIsLikelyBlockId(id)) return null;
        const docId = String(source.root_id || source.docId || doc?.id || '').trim();
        if (!__tmIsLikelyBlockId(docId)) return null;
        const parentTaskId = String(source.parentTaskId || source.parent_task_id || fallbackParentTaskId || '').trim();
        const out = {
            id,
            root_id: docId,
            parent_id: String(source.parent_id || '').trim(),
            parentTaskId,
            blockSort: String(source.blockSort || source.block_sort || source.sort || '').trim(),
            content: __tmCompactTaskIndexText(source.content || source.raw_content || source.title || source.markdown || '', 3200),
            done: source.done === true,
            taskMarker: String(source.taskMarker || source.task_marker || '').trim(),
            priority: String(source.priority || source.custom_priority || '').trim(),
            pinned: source.pinned === true || source.custom_pinned === true || String(source.custom_pinned || '').trim() === '1',
            milestone: source.milestone === true || source.custom_milestone === true || String(source.custom_milestone || '').trim() === '1',
            completionTime: String(source.completionTime || source.completion_time || '').trim(),
            startDate: String(source.startDate || source.start_date || '').trim(),
            customTime: String(source.customTime || source.custom_time || '').trim(),
            customStatus: String(source.customStatus || source.custom_status || '').trim(),
            duration: String(source.duration || source.custom_duration || '').trim(),
            remark: __tmCompactTaskIndexText(source.remark || source.custom_remark || '', 900),
            taskCompleteAt: String(source.taskCompleteAt || source.task_complete_at || '').trim(),
            tomatoHours: String(source.tomatoHours || source.tomato_hours || '').trim(),
            tomatoMinutes: String(source.tomatoMinutes || source.tomato_minutes || '').trim(),
            docName: __tmCompactTaskIndexText(source.docName || source.rawDocName || source.doc_name || doc?.name || '', 180),
            blockPath: __tmCompactTaskIndexText(source.blockPath || source.block_path || source.hPath || '', 800),
            docSeq: Number.isFinite(Number(source.docSeq ?? source.doc_seq)) ? Number(source.docSeq ?? source.doc_seq) : undefined,
            h2: __tmCompactTaskIndexText(source.h2 || '', 320),
            h2Id: String(source.h2Id || '').trim(),
            h2Path: __tmCompactTaskIndexText(source.h2Path || '', 800),
            h2Sort: Number.isFinite(Number(source.h2Sort)) ? Number(source.h2Sort) : undefined,
            h2Created: String(source.h2Created || '').trim(),
            h2Rank: Number.isFinite(Number(source.h2Rank)) ? Number(source.h2Rank) : undefined,
            headingLevel: String(source.headingLevel || '').trim(),
            level: Math.max(0, Math.round(Number(source.level || 0) || 0)),
            priorityScore: Number.isFinite(Number(source.priorityScore)) ? Number(source.priorityScore) : undefined,
            repeatRule: __tmCompactTaskIndexValue(source.repeatRule || source.repeat_rule, { maxBytes: 4096 }),
            repeatState: __tmCompactTaskIndexValue(source.repeatState || source.repeat_state, { maxBytes: 4096 }),
            attachmentCount: Number.isFinite(Number(source.attachmentCount)) ? Number(source.attachmentCount) : undefined,
        };
        Object.keys(out).forEach((key) => {
            const next = __tmCompactTaskIndexValue(out[key]);
            if (next === undefined) delete out[key];
            else out[key] = next;
        });
        return out;
    }

    function __tmBuildTaskIndexBlocksFromTree(tasks, doc = null) {
        const out = [];
        const walk = (items, parentTaskId = '') => {
            (Array.isArray(items) ? items : []).forEach((task) => {
                const entry = __tmBuildTaskIndexBlockEntry(task, doc, parentTaskId);
                if (entry) out.push(entry);
                const taskId = String(task?.id || '').trim();
                if (Array.isArray(task?.children) && task.children.length > 0) {
                    walk(task.children, taskId || parentTaskId);
                }
            });
        };
        walk(tasks, '');
        return out;
    }

    function __tmRestoreTaskIndexBlockEntry(block, docEntry) {
        const item = (block && typeof block === 'object') ? block : null;
        if (!item) return null;
        const id = String(item.id || item.blockId || '').trim();
        const docId = String(item.root_id || item.rootId || item.docId || docEntry?.id || '').trim();
        if (!__tmIsLikelyBlockId(id) || !__tmIsLikelyBlockId(docId)) return null;
        const content = String(item.content || item.title || item.raw_content || '').trim();
        const markdown = String(item.markdown || '').trim() || `- [${item.done === true ? 'X' : ' '}] ${content}`;
        const task = {
            id,
            root_id: docId,
            docId,
            parent_id: String(item.parent_id || '').trim(),
            parentTaskId: String(item.parentTaskId || item.parent_task_id || '').trim(),
            block_sort: String(item.blockSort || item.block_sort || '').trim(),
            blockSort: String(item.blockSort || item.block_sort || '').trim(),
            block_path: String(item.blockPath || item.block_path || '').trim(),
            blockPath: String(item.blockPath || item.block_path || '').trim(),
            doc_name: String(item.rawDocName || item.docName || docEntry?.name || '').trim(),
            rawDocName: String(item.rawDocName || item.docName || docEntry?.name || '').trim(),
            docName: String(item.docName || item.rawDocName || docEntry?.name || '').trim() || '未命名文档',
            markdown,
            raw_content: content,
            content,
            done: item.done === true,
            taskMarker: String(item.taskMarker || '').trim() || (item.done === true ? 'X' : ' '),
            task_marker: String(item.taskMarker || '').trim() || (item.done === true ? 'X' : ' '),
            priority: String(item.priority || '').trim(),
            custom_priority: String(item.priority || '').trim(),
            pinned: item.pinned === true,
            custom_pinned: item.pinned === true ? '1' : '',
            milestone: item.milestone === true,
            custom_milestone: item.milestone === true ? '1' : '',
            completionTime: String(item.completionTime || '').trim(),
            completion_time: String(item.completionTime || '').trim(),
            startDate: String(item.startDate || '').trim(),
            start_date: String(item.startDate || '').trim(),
            customTime: String(item.customTime || '').trim(),
            custom_time: String(item.customTime || '').trim(),
            customStatus: String(item.customStatus || '').trim(),
            custom_status: String(item.customStatus || '').trim(),
            duration: String(item.duration || '').trim(),
            remark: String(item.remark || '').trim(),
            taskCompleteAt: String(item.taskCompleteAt || '').trim(),
            task_complete_at: String(item.taskCompleteAt || '').trim(),
            tomatoHours: String(item.tomatoHours || '').trim(),
            tomato_hours: String(item.tomatoHours || '').trim(),
            tomatoMinutes: String(item.tomatoMinutes || '').trim(),
            tomato_minutes: String(item.tomatoMinutes || '').trim(),
            docSeq: Number.isFinite(Number(item.docSeq)) ? Number(item.docSeq) : Number.POSITIVE_INFINITY,
            doc_seq: Number.isFinite(Number(item.docSeq)) ? Number(item.docSeq) : Number.POSITIVE_INFINITY,
            h2: String(item.h2 || '').trim(),
            h2Id: String(item.h2Id || '').trim(),
            h2Path: String(item.h2Path || '').trim(),
            h2Sort: Number(item.h2Sort),
            h2Created: String(item.h2Created || '').trim(),
            h2Rank: Number(item.h2Rank),
            headingLevel: String(item.headingLevel || SettingsStore?.data?.taskHeadingLevel || 'h2').trim() || 'h2',
            level: Math.max(0, Math.round(Number(item.level || 0) || 0)),
            priorityScore: Number.isFinite(Number(item.priorityScore)) ? Number(item.priorityScore) : undefined,
            repeatRule: __tmCloneTaskSnapshotValue(item.repeatRule, 0),
            repeat_rule: __tmCloneTaskSnapshotValue(item.repeatRule, 0),
            repeatState: __tmCloneTaskSnapshotValue(item.repeatState, 0),
            repeat_state: __tmCloneTaskSnapshotValue(item.repeatState, 0),
            repeatHistory: __tmCloneTaskSnapshotValue(item.repeatHistory, 0) || [],
            repeat_history: __tmCloneTaskSnapshotValue(item.repeatHistory, 0) || [],
            customFieldValues: __tmCloneTaskSnapshotValue(item.customFieldValues, 0) || {},
            attachments: __tmCloneTaskSnapshotValue(item.attachments, 0) || [],
            attachmentCount: Math.max(0, Math.round(Number(item.attachmentCount || 0) || 0)),
            children: [],
        };
        if (task.priorityScore === undefined) delete task.priorityScore;
        return task;
    }

    function __tmBuildTaskTreeFromTaskIndexBlocks(entry) {
        const source = (entry && typeof entry === 'object') ? entry : {};
        const blocks = Array.isArray(source.blocks)
            ? source.blocks
            : __tmBuildTaskIndexBlocksFromTree(source.tasks || [], source);
        const tasks = blocks
            .map((block) => __tmRestoreTaskIndexBlockEntry(block, source))
            .filter(Boolean);
        const byId = new Map();
        tasks.forEach((task) => {
            task.children = [];
            byId.set(String(task.id || '').trim(), task);
        });
        const roots = [];
        tasks.forEach((task) => {
            const parentTaskId = String(task.parentTaskId || task.parent_task_id || '').trim();
            const parent = parentTaskId ? byId.get(parentTaskId) : null;
            if (parent && parent !== task) {
                parent.children.push(task);
            } else {
                roots.push(task);
            }
        });
        const sortBySeq = (list) => {
            (Array.isArray(list) ? list : []).sort((a, b) => {
                const sa = Number.isFinite(Number(a?.docSeq)) ? Number(a.docSeq) : Number.POSITIVE_INFINITY;
                const sb = Number.isFinite(Number(b?.docSeq)) ? Number(b.docSeq) : Number.POSITIVE_INFINITY;
                if (sa !== sb) return sa - sb;
                const ba = Number(a?.blockSort || a?.block_sort || 0) || 0;
                const bb = Number(b?.blockSort || b?.block_sort || 0) || 0;
                if (ba !== bb) return ba - bb;
                return String(a?.id || '').localeCompare(String(b?.id || ''));
            });
            list.forEach((task, index) => {
                task.level = Math.max(0, Math.round(Number(task.level || 0) || 0));
                if (Array.isArray(task.children) && task.children.length > 0) sortBySeq(task.children);
                if (!Number.isFinite(Number(task.docSeq))) task.docSeq = index;
            });
        };
        sortBySeq(roots);
        return roots;
    }

    function __tmNormalizeTaskIndexBlocksForStore(entry, options = {}) {
        const source = (entry && typeof entry === 'object') ? entry : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const rawBlocks = Array.isArray(source.blocks)
            ? source.blocks
            : __tmBuildTaskIndexBlocksFromTree(source.tasks || [], source);
        const shouldCompact = opts.compact === true;
        const out = [];
        (Array.isArray(rawBlocks) ? rawBlocks : []).forEach((block) => {
            let next = null;
            if (shouldCompact) {
                const restored = __tmRestoreTaskIndexBlockEntry(block, source);
                next = __tmBuildTaskIndexBlockEntry(restored || block, source);
            } else {
                next = (block && typeof block === 'object') ? block : null;
            }
            const id = String(next?.id || next?.blockId || '').trim();
            const docId = String(next?.root_id || next?.rootId || next?.docId || source?.id || '').trim();
            if (__tmIsLikelyBlockId(id) && __tmIsLikelyBlockId(docId)) out.push(next);
        });
        return out;
    }

    function __tmNormalizeTaskIndexStore(raw = null) {
        const source = (raw && typeof raw === 'object') ? raw : {};
        const docs = {};
        const sourceDocs = (source.docs && typeof source.docs === 'object') ? source.docs : {};
        const sourceVersion = Math.max(0, Math.round(Number(source.version || 0) || 0));
        if (Object.keys(sourceDocs).length > 0 && sourceVersion !== __TM_TASK_INDEX_VERSION) {
            return {
                version: __TM_TASK_INDEX_VERSION,
                updatedAt: Date.now(),
                docs,
            };
        }
        Object.entries(sourceDocs).forEach(([docId0, entry0]) => {
            const docId = String(docId0 || entry0?.id || '').trim();
            const entry = (entry0 && typeof entry0 === 'object') ? entry0 : null;
            if (!__tmIsLikelyBlockId(docId) || !entry) return;
            const updatedAt = Number(entry.updatedAt || entry.indexedAt || source.updatedAt || 0) || 0;
            const blocks = __tmNormalizeTaskIndexBlocksForStore(
                { ...entry, id: docId },
                { compact: sourceVersion !== __TM_TASK_INDEX_VERSION }
            );
            const taskCount = Math.max(0, Math.round(Number(entry.taskCount || blocks.length) || 0));
            const inTaskTree = (typeof entry.inTaskTree === 'boolean')
                ? entry.inTaskTree
                : blocks.length > 0;
            docs[docId] = {
                id: docId,
                name: String(entry.name || '').trim(),
                alias: __tmNormalizeDocAliasValue(entry.alias),
                icon: __tmNormalizeDocIconValue(entry.icon),
                created: String(entry.created || '').trim(),
                docUpdated: String(entry.docUpdated || entry.updated || '').trim(),
                updatedAt,
                inTaskTree,
                queryLimit: Math.max(0, Math.round(Number(entry.queryLimit || 0) || 0)),
                taskCount,
                blocks,
            };
        });
        return {
            version: __TM_TASK_INDEX_VERSION,
            updatedAt: Number(source.updatedAt || 0) || Date.now(),
            docs,
        };
    }

    function __tmPruneTaskIndexStoreToLimits(store, options = {}) {
        const source = (store && typeof store === 'object') ? store : {};
        const sourceDocs = (source.docs && typeof source.docs === 'object') ? source.docs : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const keepDocIds = new Set(__tmNormalizeTaskSnapshotDocIds(opts.keepDocIds || []));
        const candidates = Object.values(sourceDocs)
            .filter((entry) => entry && __tmIsLikelyBlockId(entry.id) && (Array.isArray(entry.blocks) || Array.isArray(entry.tasks)))
            .filter((entry) => {
                const count = Array.isArray(entry.blocks) ? entry.blocks.length : (Array.isArray(entry.tasks) ? entry.tasks.length : 0);
                return count > 0 || entry.inTaskTree !== false;
            })
            .sort((a, b) => {
                const aid = String(a?.id || '').trim();
                const bid = String(b?.id || '').trim();
                const keepDiff = (keepDocIds.has(bid) ? 1 : 0) - (keepDocIds.has(aid) ? 1 : 0);
                if (keepDiff) return keepDiff;
                return Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0);
            });
        const out = {
            version: __TM_TASK_INDEX_VERSION,
            updatedAt: Number(source.updatedAt || 0) || Date.now(),
            docs: {},
        };
        let outDocCount = 0;
        let outBytes = __tmEstimateJsonByteSize(out);
        for (const entry of candidates) {
            const docId = String(entry?.id || '').trim();
            if (!docId || out.docs[docId]) continue;
            if (outDocCount >= __TM_TASK_INDEX_MAX_DOCS) break;
            const entryBytes = __tmEstimateJsonByteSize(entry);
            if (entryBytes > __TM_TASK_INDEX_MAX_SINGLE_DOC_BYTES) continue;
            const nextBytes = outBytes + entryBytes + docId.length + 16;
            if (nextBytes > __TM_TASK_INDEX_MAX_BYTES) {
                if (keepDocIds.has(docId)) break;
                continue;
            }
            out.docs[docId] = entry;
            outDocCount += 1;
            outBytes = nextBytes;
        }
        return out;
    }

    function __tmRememberTaskIndexEntriesInMemory(entries, options = {}) {
        const list = (Array.isArray(entries) ? entries : [])
            .filter((entry) => entry && __tmIsLikelyBlockId(entry.id));
        if (!list.length) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        const cachedStore = (__tmTaskIndexStoreCache
            && __tmTaskIndexStoreCache.version === __TM_TASK_INDEX_VERSION
            && __tmTaskIndexStoreCache.docs
            && typeof __tmTaskIndexStoreCache.docs === 'object')
            ? __tmTaskIndexStoreCache
            : null;
        const store = cachedStore || __tmNormalizeTaskIndexStore({
            version: __TM_TASK_INDEX_VERSION,
            updatedAt: Date.now(),
            docs: {},
        });
        list.forEach((entry) => {
            store.docs[entry.id] = entry;
        });
        store.version = __TM_TASK_INDEX_VERSION;
        store.updatedAt = Date.now();
        const docCount = Object.keys(store.docs || {}).length;
        const shouldPrune = opts.pruneNow === true || docCount > __TM_TASK_INDEX_MAX_DOCS;
        const nextStore = shouldPrune
            ? __tmPruneTaskIndexStoreToLimits(store, {
                keepDocIds: opts.keepDocIds || list.map((entry) => entry?.id),
            })
            : store;
        __tmTaskIndexStoreCache = nextStore;
        return nextStore;
    }

    function __tmBuildTaskIndexDocEntry(doc, options = {}) {
        const source = (doc && typeof doc === 'object') ? doc : null;
        const docId = String(source?.id || '').trim();
        if (!source || !__tmIsLikelyBlockId(docId)) return null;
        const tasks = Array.isArray(source.tasks) ? source.tasks : [];
        const blocks = __tmBuildTaskIndexBlocksFromTree(tasks, { ...source, id: docId });
        const opts = (options && typeof options === 'object') ? options : {};
        const inTaskTree = (typeof opts.inTaskTree === 'boolean') ? opts.inTaskTree : blocks.length > 0;
        return {
            id: docId,
            name: String(source.name || '').trim(),
            alias: __tmNormalizeDocAliasValue(source.alias),
            icon: __tmNormalizeDocIconValue(source.icon),
            created: String(source.created || '').trim(),
            docUpdated: String(source.docUpdated || source.updated || '').trim(),
            updatedAt: Date.now(),
            inTaskTree,
            queryLimit: Math.max(0, Math.round(Number(opts.queryLimit || __TM_TASK_INDEX_QUERY_LIMIT) || 0)),
            taskCount: blocks.length,
            blocks,
        };
    }

    function __tmBuildDocUpdatedFingerprintMap(docs = null) {
        const out = new Map();
        (Array.isArray(docs) ? docs : (Array.isArray(state.allDocuments) ? state.allDocuments : [])).forEach((doc) => {
            const id = String(doc?.id || '').trim();
            if (!__tmIsLikelyBlockId(id)) return;
            const updated = String(doc?.updated || doc?.docUpdated || '').trim();
            if (updated) out.set(id, updated);
        });
        return out;
    }

    function __tmNormalizeDocScopeCache(raw = null) {
        const source = (raw && typeof raw === 'object') ? raw : {};
        const sourceScopes = (source.scopes && typeof source.scopes === 'object') ? source.scopes : {};
        const now = Date.now();
        const scopes = {};
        Object.entries(sourceScopes).forEach(([key0, entry0]) => {
            const key = String(key0 || '').trim();
            const entry = (entry0 && typeof entry0 === 'object') ? entry0 : null;
            if (!key || !entry) return;
            const ids = __tmNormalizeDocScopeDocIds(entry.docIds || entry.ids || []);
            if (!ids.length) return;
            const updatedAt = Number(entry.updatedAt || entry.t || 0) || 0;
            if (updatedAt > 0 && (now - updatedAt) > __TM_DOC_SCOPE_CACHE_MAX_AGE_MS) return;
            scopes[key] = {
                key,
                groupId: String(entry.groupId || '').trim(),
                docIds: ids,
                updatedAt: updatedAt || now,
                docCount: ids.length,
            };
        });
        return {
            version: __TM_DOC_SCOPE_CACHE_VERSION,
            updatedAt: Number(source.updatedAt || 0) || now,
            scopes,
        };
    }

    function __tmPruneDocScopeCacheToLimits(store) {
        const source = (store && typeof store === 'object') ? store : {};
        const candidates = Object.values(source.scopes || {})
            .filter((entry) => entry && Array.isArray(entry.docIds) && entry.docIds.length > 0)
            .sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0));
        const out = {
            version: __TM_DOC_SCOPE_CACHE_VERSION,
            updatedAt: Number(source.updatedAt || 0) || Date.now(),
            scopes: {},
        };
        for (const entry of candidates) {
            const key = String(entry?.key || '').trim();
            if (!key || out.scopes[key]) continue;
            if (Object.keys(out.scopes).length >= __TM_DOC_SCOPE_CACHE_MAX_SCOPES) break;
            out.scopes[key] = {
                key,
                groupId: String(entry.groupId || '').trim(),
                docIds: __tmNormalizeDocScopeDocIds(entry.docIds || []),
                updatedAt: Number(entry.updatedAt || 0) || Date.now(),
                docCount: Math.max(0, Math.round(Number(entry.docCount || entry.docIds?.length || 0) || 0)),
            };
            if (__tmEstimateJsonByteSize(out) > __TM_DOC_SCOPE_CACHE_MAX_BYTES) {
                delete out.scopes[key];
                break;
            }
        }
        return out;
    }

    let __tmDocScopeCacheStore = null;
    let __tmDocScopeCacheLoadPromise = null;
    let __tmDocScopeCacheSaveTimer = null;
    let __tmDocScopeCacheSaveInFlight = false;

    async function __tmLoadDocScopeCacheStore(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (!opts.force && __tmDocScopeCacheStore) return __tmDocScopeCacheStore;
        if (!opts.force && __tmDocScopeCacheLoadPromise) return await __tmDocScopeCacheLoadPromise;
        __tmDocScopeCacheLoadPromise = Promise.resolve()
            .then(async () => {
                const raw = await __tmReadJsonFile(DOC_SCOPE_CACHE_FILE_PATH);
                const store = __tmPruneDocScopeCacheToLimits(__tmNormalizeDocScopeCache(raw));
                __tmDocScopeCacheStore = store;
                try {
                    if (raw && __tmEstimateJsonByteSize(raw) > (__tmEstimateJsonByteSize(store) + 1024)) {
                        __tmScheduleIdleTask(() => __tmWriteJsonFile(DOC_SCOPE_CACHE_FILE_PATH, store), 2600);
                    }
                } catch (e) {}
                return store;
            })
            .finally(() => {
                __tmDocScopeCacheLoadPromise = null;
            });
        return await __tmDocScopeCacheLoadPromise;
    }

    function __tmGetCachedDocScope(scopeKey) {
        try {
            const key = String(scopeKey || '').trim();
            if (!key) return null;
            const store = __tmDocScopeCacheStore;
            const entry = store?.scopes?.[key];
            if (!entry || !Array.isArray(entry.docIds) || !entry.docIds.length) return null;
            if ((Date.now() - Number(entry.updatedAt || 0)) > __TM_DOC_SCOPE_CACHE_MAX_AGE_MS) return null;
            return {
                key,
                groupId: String(entry.groupId || '').trim(),
                docIds: __tmNormalizeDocScopeDocIds(entry.docIds),
                updatedAt: Number(entry.updatedAt || 0) || 0,
            };
        } catch (e) {
            return null;
        }
    }

    function __tmRememberDocScope(scopeKey, docIds = [], options = {}) {
        const key = String(scopeKey || '').trim();
        const ids = __tmNormalizeDocScopeDocIds(docIds || []);
        if (!key || !ids.length) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const store = __tmPruneDocScopeCacheToLimits(__tmDocScopeCacheStore || {
            version: __TM_DOC_SCOPE_CACHE_VERSION,
            updatedAt: Date.now(),
            scopes: {},
        });
        store.scopes[key] = {
            key,
            groupId: String(opts.groupId || '').trim(),
            docIds: ids,
            updatedAt: Date.now(),
            docCount: ids.length,
        };
        const nextStore = __tmPruneDocScopeCacheToLimits(store);
        nextStore.updatedAt = Date.now();
        __tmDocScopeCacheStore = nextStore;
        try {
            if (__tmDocScopeCacheSaveTimer) clearTimeout(__tmDocScopeCacheSaveTimer);
        } catch (e) {}
        const delayMs = Math.max(300, Number(opts.delayMs || 1200) || 1200);
        __tmDocScopeCacheSaveTimer = setTimeout(() => {
            __tmDocScopeCacheSaveTimer = null;
            if (__tmDocScopeCacheSaveInFlight) {
                __tmRememberDocScope(key, ids, { ...opts, delayMs: 1800 });
                return;
            }
            __tmDocScopeCacheSaveInFlight = true;
            Promise.resolve()
                .then(async () => {
                    const raw = await __tmReadJsonFile(DOC_SCOPE_CACHE_FILE_PATH);
                    const latest = __tmNormalizeDocScopeCache(raw || __tmDocScopeCacheStore);
                    latest.scopes[key] = __tmDocScopeCacheStore?.scopes?.[key] || {
                        key,
                        groupId: String(opts.groupId || '').trim(),
                        docIds: ids,
                        updatedAt: Date.now(),
                        docCount: ids.length,
                    };
                    latest.updatedAt = Date.now();
                    const pruned = __tmPruneDocScopeCacheToLimits(latest);
                    __tmDocScopeCacheStore = pruned;
                    await __tmWriteJsonFile(DOC_SCOPE_CACHE_FILE_PATH, pruned);
                })
                .catch(() => null)
                .finally(() => {
                    __tmDocScopeCacheSaveInFlight = false;
                });
        }, delayMs);
        return true;
    }

    function __tmScheduleWarmDocScopeCache(delayMs = 1400) {
        if (__tmDocScopeCacheStore || __tmDocScopeCacheLoadPromise) return false;
        const delay0 = Number(delayMs);
        const waitMs = Math.max(200, Number.isFinite(delay0) ? delay0 : 1400);
        const run = () => {
            if (__tmDocScopeCacheStore || __tmDocScopeCacheLoadPromise) return;
            try { __tmLoadDocScopeCacheStore().catch(() => null); } catch (e) {}
        };
        try { __tmScheduleIdleTask(run, waitMs); } catch (e) { setTimeout(run, waitMs); }
        return true;
    }

    function __tmInvalidateDocScopeCache() {
        try { __tmDocScopeCacheStore = null; } catch (e) {}
        try { __tmDocScopeCacheLoadPromise = null; } catch (e) {}
    }

    window.__tmInvalidateDocScopeCache = __tmInvalidateDocScopeCache;

    function __tmIsUsableTaskIndexDoc(entry, options = {}) {
        const item = (entry && typeof entry === 'object') ? entry : null;
        if (!item || !__tmIsLikelyBlockId(item.id)) return false;
        if (!Array.isArray(item.blocks) && !Array.isArray(item.tasks)) return false;
        const updatedAt = Number(item.updatedAt || 0);
        if (!updatedAt) return false;
        const docUpdatedMap = options?.docUpdatedMap instanceof Map ? options.docUpdatedMap : null;
        if (options?.strictDocUpdated === true && docUpdatedMap && docUpdatedMap.has(item.id)) {
            const currentDocUpdated = String(docUpdatedMap.get(item.id) || '').trim();
            const indexedDocUpdated = String(item.docUpdated || '').trim();
            if (currentDocUpdated && !indexedDocUpdated) return false;
            if (currentDocUpdated && indexedDocUpdated && currentDocUpdated !== indexedDocUpdated) return false;
        }
        const currentLimit = Math.max(0, Math.round(Number(options?.queryLimit || 0) || 0));
        const entryLimit = Math.max(0, Math.round(Number(item.queryLimit || 0) || 0));
        const taskCount = Math.max(0, Math.round(Number(item.taskCount || 0) || 0));
        if (currentLimit > entryLimit && entryLimit > 0 && taskCount >= entryLimit) return false;
        const expectedCount = __tmGetExpectedTaskCountFromMap(__tmGetExpectedTaskCountMapFromOptions(options), item.id);
        if (Number.isFinite(expectedCount)) {
            const blockCount = Array.isArray(item.blocks)
                ? item.blocks.length
                : (Array.isArray(item.tasks) ? Object.keys(__tmBuildFlatTasksFromTaskSnapshotTree([{ id: item.id, tasks: item.tasks }])).length : taskCount);
            if (Math.max(0, Math.round(Number(blockCount || 0) || 0)) < expectedCount) return false;
        }
        return true;
    }

    function __tmBuildTaskIndexTaskTreeForDocs(store, docIds = [], options = {}) {
        const source = (store && typeof store === 'object') ? store : null;
        const docs = source?.docs && typeof source.docs === 'object' ? source.docs : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const out = [];
        const missingDocIds = [];
        const staleDocIds = [];
        const softStaleDocIds = [];
        const docUpdatedMap = opts.docUpdatedMap instanceof Map ? opts.docUpdatedMap : null;
        const ids = __tmNormalizeTaskSnapshotDocIds(docIds);
        ids.forEach((docId) => {
            const entry = docs[docId];
            if (!entry) {
                missingDocIds.push(docId);
                return;
            }
            if (!__tmIsUsableTaskIndexDoc(entry, opts)) {
                staleDocIds.push(docId);
                return;
            }
            if (docUpdatedMap && docUpdatedMap.has(docId)) {
                const currentDocUpdated = String(docUpdatedMap.get(docId) || '').trim();
                const indexedDocUpdated = String(entry.docUpdated || '').trim();
                if (currentDocUpdated && indexedDocUpdated && currentDocUpdated !== indexedDocUpdated) {
                    softStaleDocIds.push(docId);
                }
            }
            const tasks = __tmBuildTaskTreeFromTaskIndexBlocks(entry);
            if (!tasks.length && entry.inTaskTree === false) return;
            out.push({
                id: docId,
                name: String(entry.name || '').trim() || '未命名文档',
                alias: __tmNormalizeDocAliasValue(entry.alias),
                icon: __tmNormalizeDocIconValue(entry.icon),
                created: String(entry.created || '').trim(),
                docUpdated: String(entry.docUpdated || '').trim(),
                tasks,
            });
        });
        return { taskTree: out, missingDocIds, staleDocIds, softStaleDocIds };
    }

    let __tmTaskIndexStoreCache = null;
    let __tmTaskIndexStoreLoadPromise = null;
    let __tmTaskIndexSaveTimer = null;
    let __tmTaskIndexSaveInFlight = false;

    async function __tmLoadTaskIndexStore(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (!opts.force && __tmTaskIndexStoreCache) return __tmTaskIndexStoreCache;
        if (!opts.force && __tmTaskIndexStoreLoadPromise) return await __tmTaskIndexStoreLoadPromise;
        __tmTaskIndexStoreLoadPromise = Promise.resolve()
            .then(async () => {
                const raw = await __tmReadJsonFile(TASK_INDEX_FILE_PATH);
                const normalizedStore = __tmNormalizeTaskIndexStore(raw);
                const store = __tmPruneTaskIndexStoreToLimits(normalizedStore);
                __tmTaskIndexStoreCache = store;
                try {
                    const rawVersion = Math.max(0, Math.round(Number(raw?.version || 0) || 0));
                    if (raw && (rawVersion !== __TM_TASK_INDEX_VERSION
                        || __tmEstimateJsonByteSize(raw) > (__tmEstimateJsonByteSize(store) + 1024))) {
                        __tmScheduleIdleTask(() => __tmWriteJsonFile(TASK_INDEX_FILE_PATH, store), 2600);
                    }
                } catch (e) {}
                return store;
            })
            .finally(() => {
                __tmTaskIndexStoreLoadPromise = null;
            });
        return await __tmTaskIndexStoreLoadPromise;
    }

    function __tmRestoreTaskIndexIntoState(store, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const docIds = __tmNormalizeTaskSnapshotDocIds(opts.docIds || []);
        if (!docIds.length) return null;
        const built = __tmBuildTaskIndexTaskTreeForDocs(store, docIds, opts);
        const reloadDocIds = Array.from(new Set([
            ...((Array.isArray(built?.missingDocIds) ? built.missingDocIds : [])),
            ...((Array.isArray(built?.staleDocIds) ? built.staleDocIds : [])),
        ].map((id) => String(id || '').trim()).filter(Boolean)));
        const softReloadDocIds = Array.from(new Set(
            (Array.isArray(built?.softStaleDocIds) ? built.softStaleDocIds : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean)
        ));
        if (!built) return null;
        if (reloadDocIds.length) {
            const allowPartial = opts.allowPartial === true;
            const maxPartialMisses = Math.max(0, Math.round(Number(opts.maxPartialMisses || 0) || 0));
            if (!allowPartial || reloadDocIds.length > maxPartialMisses) return null;
        }
        const taskTree = built.taskTree;
        if (!taskTree.length && reloadDocIds.length > 0) return null;
        const flatTasks = __tmBuildFlatTasksFromTaskSnapshotTree(taskTree);
        if (!__tmHasExpectedTaskCountCoverage(docIds, Object.keys(flatTasks).length, opts)) return null;
        state.taskTree = __tmSortDocEntriesByPinned(
            taskTree,
            String(opts.groupId || SettingsStore?.data?.currentGroupId || 'all').trim() || 'all'
        );
        try {
            state.flatTasks = __tmMergeOtherBlocksIntoFlatTasks(flatTasks);
        } catch (e) {
            state.flatTasks = flatTasks;
        }
        state.__tmLoadedDocIdsForTasks = docIds.slice();
        state.__tmTaskIndexRestoredAt = Date.now();
        return {
            docCount: taskTree.length,
            taskCount: Object.keys(flatTasks).length,
            indexUpdatedAt: Number(store?.updatedAt || 0) || 0,
            partial: reloadDocIds.length > 0,
            missingDocIds: Array.isArray(built.missingDocIds) ? built.missingDocIds.slice() : [],
            staleDocIds: Array.isArray(built.staleDocIds) ? built.staleDocIds.slice() : [],
            softStaleDocIds: softReloadDocIds,
            reloadDocIds,
            softReloadDocIds,
        };
    }

    async function __tmLoadTaskIndexForScope(options = {}) {
        try {
            const opts = (options && typeof options === 'object') ? options : {};
            const docIds = __tmNormalizeTaskSnapshotDocIds(opts.docIds || []);
            if (!docIds.length) return null;
            if (opts.cachedOnly && !__tmTaskIndexStoreCache) {
                __tmScheduleWarmTaskIndexStore(2200);
                return null;
            }
            const store = opts.cachedOnly
                ? __tmTaskIndexStoreCache
                : await __tmLoadTaskIndexStore({ force: !!opts.force });
            return __tmRestoreTaskIndexIntoState(store, opts);
        } catch (e) {
            return null;
        }
    }

    function __tmWarmTaskIndexStore() {
        if (__tmTaskIndexStoreCache || __tmTaskIndexStoreLoadPromise) return;
        try { __tmLoadTaskIndexStore().catch(() => null); } catch (e) {}
    }

    function __tmScheduleWarmTaskIndexStore(delayMs = 2200) {
        if (__tmTaskIndexStoreCache || __tmTaskIndexStoreLoadPromise) return false;
        const delay0 = Number(delayMs);
        const waitMs = Math.max(80, Number.isFinite(delay0) ? delay0 : 2200);
        const run = () => {
            if (__tmTaskIndexStoreCache || __tmTaskIndexStoreLoadPromise) return;
            try { __tmWarmTaskIndexStore(); } catch (e) {}
        };
        try { __tmScheduleIdleTask(run, waitMs); } catch (e) { setTimeout(run, waitMs); }
        return true;
    }

    function __tmInvalidateTaskIndexStoreCache() {
        try { __tmTaskIndexStoreCache = null; } catch (e) {}
        try { __tmTaskIndexStoreLoadPromise = null; } catch (e) {}
    }

    async function __tmEnsureTaskIndexStoreReadyForFastPath(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        try {
            if (!__tmDocScopeCacheStore) await __tmLoadDocScopeCacheStore({ force: !!opts.force });
        } catch (e) {}
        try {
            if (!__tmTaskIndexStoreCache) await __tmLoadTaskIndexStore({ force: !!opts.force });
        } catch (e) {}
        return !!__tmTaskIndexStoreCache;
    }

    function __tmSchedulePersistTaskIndex(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const docIds = __tmNormalizeTaskSnapshotDocIds(opts.docIds || state.__tmLoadedDocIdsForTasks || []);
        if (!docIds.length) return false;
        if (docIds.length > __TM_TASK_INDEX_MAX_DOCS) return false;
        const docsById = new Map((Array.isArray(state.taskTree) ? state.taskTree : [])
            .map((doc) => [String(doc?.id || '').trim(), doc])
            .filter(([docId]) => __tmIsLikelyBlockId(docId)));
        const allDocInfoById = new Map((Array.isArray(state.allDocuments) ? state.allDocuments : [])
            .map((doc) => [String(doc?.id || '').trim(), doc])
            .filter(([docId]) => __tmIsLikelyBlockId(docId)));
        const nextEntries = [];
        docIds.forEach((docId) => {
            const hasTaskTreeDoc = docsById.has(docId);
            const docInfo = allDocInfoById.get(docId) || {};
            const doc = docsById.get(docId) || {
                id: docId,
                name: String(docInfo?.name || '').trim(),
                alias: __tmNormalizeDocAliasValue(docInfo?.alias),
                icon: __tmNormalizeDocIconValue(docInfo?.icon),
                created: String(docInfo?.created || '').trim(),
                updated: String(docInfo?.updated || '').trim(),
                tasks: [],
            };
            const entry = __tmBuildTaskIndexDocEntry({
                ...doc,
                docUpdated: String(doc?.docUpdated || doc?.updated || docInfo?.updated || docInfo?.docUpdated || '').trim(),
            }, { ...opts, inTaskTree: hasTaskTreeDoc });
            const expectedCount = __tmGetExpectedTaskCountFromMap(__tmGetExpectedTaskCountMapFromOptions(opts), docId);
            if (entry && Number.isFinite(expectedCount) && Math.max(0, Math.round(Number(entry.taskCount || 0) || 0)) < expectedCount) return;
            if (entry && __tmEstimateJsonByteSize(entry) > __TM_TASK_INDEX_MAX_SINGLE_DOC_BYTES) return;
            if (entry) nextEntries.push(entry);
        });
        if (!nextEntries.length) return false;
        try {
            __tmRememberTaskIndexEntriesInMemory(nextEntries, {
                keepDocIds: nextEntries.map((entry) => entry?.id),
            });
        } catch (e) {}
        try {
            if (__tmTaskIndexSaveTimer) clearTimeout(__tmTaskIndexSaveTimer);
        } catch (e) {}
        const delayMs = Math.max(120, Number(opts.delayMs || 700) || 700);
        __tmTaskIndexSaveTimer = setTimeout(() => {
            __tmTaskIndexSaveTimer = null;
            if (__tmTaskIndexSaveInFlight) {
                __tmSchedulePersistTaskIndex({ ...opts, delayMs: 1000 });
                return;
            }
            __tmTaskIndexSaveInFlight = true;
            Promise.resolve()
                .then(async () => {
                    const raw = await __tmReadJsonFile(TASK_INDEX_FILE_PATH);
                    const store = __tmNormalizeTaskIndexStore(raw || __tmTaskIndexStoreCache);
                    nextEntries.forEach((entry) => {
                        store.docs[entry.id] = entry;
                    });
                    store.version = __TM_TASK_INDEX_VERSION;
                    store.updatedAt = Date.now();
                    const nextStore = __tmPruneTaskIndexStoreToLimits(store, {
                        keepDocIds: nextEntries.map((entry) => entry?.id),
                    });
                    __tmTaskIndexStoreCache = nextStore;
                    await __tmWriteJsonFile(TASK_INDEX_FILE_PATH, nextStore);
                })
                .catch(() => null)
                .finally(() => {
                    __tmTaskIndexSaveInFlight = false;
                });
        }, delayMs);
        return true;
    }

    const __TM_SETTINGS_FIELD_SYNC_EXCLUDED_KEYS = new Set([
        'settingsUpdatedAt',
        'settingsFieldUpdatedAt',
        'docGroupSettingsUpdatedAt',
        'collapseStateUpdatedAt',
        'customFieldDefsVersion',
        'whiteboardStateVersion',
        'checklistCompactTreeGuidesUpdatedAt',
        'selectedDocIds',
        'defaultDocId',
        'defaultDocIdByGroup',
        'allDocsExcludedDocIds',
        'docGroups',
        'otherBlockRefs',
        'docPinnedByGroup',
        'collapsedTaskIds',
        'kanbanCollapsedTaskIds',
        'collapsedGroups',
        'expandedCompletedGroups',
        'customFieldDefs',
        'whiteboardLinks',
        'whiteboardDetachedChildren',
        'whiteboardNotes',
        'whiteboardTool',
        'whiteboardSidebarCollapsed',
        'whiteboardSidebarWidth',
        'whiteboardShowDone',
        'whiteboardCardFields',
        'whiteboardView',
        'whiteboardNodePos',
        'whiteboardPlacedTaskIds',
        'whiteboardDocFrameSize',
        'whiteboardAllTabsLayoutMode',
        'whiteboardAllTabsDocOrderByGroup',
        'whiteboardSequenceMode',
    ]);

    function __tmIsSettingsFieldSyncKey(key) {
        const normalized = String(key || '').trim();
        if (!normalized) return false;
        if (__TM_SETTINGS_FIELD_SYNC_EXCLUDED_KEYS.has(normalized)) return false;
        if (normalized.startsWith('__')) return false;
        if (normalized.endsWith('UpdatedAt')) return false;
        return true;
    }

    function __tmStableSettingsJsonValue(value) {
        if (Array.isArray(value)) return value.map(__tmStableSettingsJsonValue);
        if (value && typeof value === 'object') {
            const out = {};
            Object.keys(value).sort().forEach((key) => {
                out[key] = __tmStableSettingsJsonValue(value[key]);
            });
            return out;
        }
        return value;
    }

    function __tmGetSettingsFieldFingerprint(value) {
        try {
            return JSON.stringify(__tmStableSettingsJsonValue(value));
        } catch (e) {
            return '';
        }
    }

    function __tmBuildSettingsFieldSyncSnapshot(source) {
        const src = (source && typeof source === 'object') ? source : {};
        const out = {};
        Object.keys(src).forEach((key) => {
            if (!__tmIsSettingsFieldSyncKey(key)) return;
            out[key] = __tmCloneJsonSafe(src[key], src[key]);
        });
        return out;
    }

    function __tmNormalizeSettingsFieldUpdatedAtMap(input, source = null, options = {}) {
        const src = (source && typeof source === 'object') ? source : {};
        const raw = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
        const out = {};
        Object.keys(raw).forEach((key) => {
            if (!__tmIsSettingsFieldSyncKey(key)) return;
            const ts = __tmParseUpdatedAtNumber(raw[key]);
            if (ts > 0) out[key] = ts;
        });
        const fallbackUpdatedAt = __tmParseUpdatedAtNumber(src.settingsUpdatedAt);
        if (fallbackUpdatedAt > 0 && options?.seedFromSettingsUpdatedAt === true) {
            Object.keys(__tmBuildSettingsFieldSyncSnapshot(src)).forEach((key) => {
                if (!out[key]) out[key] = fallbackUpdatedAt;
            });
        }
        const treeGuidesUpdatedAt = __tmParseUpdatedAtNumber(src.checklistCompactTreeGuidesUpdatedAt);
        if (treeGuidesUpdatedAt > 0 && __tmIsSettingsFieldSyncKey('checklistCompactTreeGuides')) {
            out.checklistCompactTreeGuides = Math.max(Number(out.checklistCompactTreeGuides) || 0, treeGuidesUpdatedAt);
        }
        return out;
    }

    function __tmMarkChangedSettingsFields(data, loadedSnapshot, updatedAt) {
        const target = (data && typeof data === 'object') ? data : {};
        const current = __tmBuildSettingsFieldSyncSnapshot(target);
        const loaded = (loadedSnapshot && typeof loadedSnapshot === 'object') ? loadedSnapshot : {};
        const map = __tmNormalizeSettingsFieldUpdatedAtMap(target.settingsFieldUpdatedAt, target);
        const ts = __tmParseUpdatedAtNumber(updatedAt) || Date.now();
        const changed = new Set();
        Object.keys(current).forEach((key) => {
            const before = Object.prototype.hasOwnProperty.call(loaded, key) ? loaded[key] : undefined;
            if (__tmGetSettingsFieldFingerprint(current[key]) === __tmGetSettingsFieldFingerprint(before)) return;
            map[key] = ts;
            changed.add(key);
        });
        target.settingsFieldUpdatedAt = map;
        return { changedKeys: changed, map };
    }

    function __tmLooksLegacySeededSettingsFieldMap(input, source = null) {
        const src = (source && typeof source === 'object') ? source : {};
        const map = __tmNormalizeSettingsFieldUpdatedAtMap(input, src);
        const keys = Object.keys(map);
        if (!keys.length) return false;
        const fallbackUpdatedAt = __tmParseUpdatedAtNumber(src.settingsUpdatedAt);
        if (fallbackUpdatedAt <= 0) return false;
        const hasNonFallbackTs = keys.some((key) => __tmParseUpdatedAtNumber(map[key]) !== fallbackUpdatedAt);
        if (hasNonFallbackTs) return false;
        const syncKeys = Object.keys(__tmBuildSettingsFieldSyncSnapshot(src));
        if (!syncKeys.length) return false;
        const coverage = keys.length / Math.max(1, syncKeys.length);
        return coverage >= 0.85;
    }

    function __tmApplySettingsFieldUpdatesByMap(target, source, options = {}) {
        const out = (target && typeof target === 'object') ? target : {};
        const src = (source && typeof source === 'object') ? source : {};
        if (!out || !src || !Object.keys(src).length) return [];
        const skip = options?.skipKeys instanceof Set ? options.skipKeys : new Set(options?.skipKeys || []);
        const localRawMap = __tmNormalizeSettingsFieldUpdatedAtMap(out.settingsFieldUpdatedAt, out);
        const remoteRawMap = __tmNormalizeSettingsFieldUpdatedAtMap(src.settingsFieldUpdatedAt, src);
        const localLegacySeeded = __tmLooksLegacySeededSettingsFieldMap(out.settingsFieldUpdatedAt, out);
        const remoteLegacySeeded = __tmLooksLegacySeededSettingsFieldMap(src.settingsFieldUpdatedAt, src);
        const localHasExplicit = Object.keys(localRawMap).length > 0 && !localLegacySeeded;
        const remoteHasExplicit = Object.keys(remoteRawMap).length > 0 && !remoteLegacySeeded;
        const seedBothFromSettingsUpdatedAt = !localHasExplicit && !remoteHasExplicit;
        const localMap = __tmNormalizeSettingsFieldUpdatedAtMap(localLegacySeeded ? {} : localRawMap, out, {
            seedFromSettingsUpdatedAt: seedBothFromSettingsUpdatedAt,
        });
        const remoteMap = __tmNormalizeSettingsFieldUpdatedAtMap(remoteLegacySeeded ? {} : remoteRawMap, src, {
            seedFromSettingsUpdatedAt: seedBothFromSettingsUpdatedAt,
        });
        const applied = [];
        Object.keys(remoteMap).forEach((key) => {
            if (!__tmIsSettingsFieldSyncKey(key)) return;
            if (skip.has(key)) return;
            if (!Object.prototype.hasOwnProperty.call(src, key)) return;
            const remoteTs = __tmParseUpdatedAtNumber(remoteMap[key]);
            const localTs = __tmParseUpdatedAtNumber(localMap[key]);
            if (remoteTs <= localTs) return;
            out[key] = __tmCloneJsonSafe(src[key], src[key]);
            localMap[key] = remoteTs;
            applied.push(key);
        });
        out.settingsFieldUpdatedAt = localMap;
        return applied;
    }

    function __tmNormalizeWhiteboardLinkArray(input) {
        const list = Array.isArray(input) ? input : [];
        return list.map((item) => {
            const link = (item && typeof item === 'object') ? item : {};
            const from = String(link.from || '').trim();
            const to = String(link.to || '').trim();
            const docId = String(link.docId || '').trim();
            if (!from || !to || !docId || from === to) return null;
            return {
                id: String(link.id || '').trim() || `link_${docId}_${from}_${to}`,
                from,
                to,
                docId,
                createdAt: String(link.createdAt || Date.now()),
            };
        }).filter(Boolean);
    }

    function __tmMergeWhiteboardLinkArrays(remoteInput, localInput) {
        const out = new Map();
        const push = (list) => {
            __tmNormalizeWhiteboardLinkArray(list).forEach((link) => {
                const semanticKey = `${link.docId}::${link.from}->${link.to}`;
                const prev = out.get(semanticKey);
                if (!prev) {
                    out.set(semanticKey, link);
                    return;
                }
                const prevTs = __tmParseUpdatedAtNumber(prev.createdAt);
                const nextTs = __tmParseUpdatedAtNumber(link.createdAt);
                if (nextTs >= prevTs) out.set(semanticKey, link);
            });
        };
        push(remoteInput);
        push(localInput);
        return Array.from(out.values());
    }

    function __tmMergeTimestampedObjectMaps(remoteInput, localInput) {
        const remote = (remoteInput && typeof remoteInput === 'object' && !Array.isArray(remoteInput)) ? remoteInput : {};
        const local = (localInput && typeof localInput === 'object' && !Array.isArray(localInput)) ? localInput : {};
        const out = {};
        const ids = new Set([...Object.keys(remote), ...Object.keys(local)]);
        ids.forEach((id0) => {
            const id = String(id0 || '').trim();
            if (!id) return;
            const rv = remote[id];
            const lv = local[id];
            if (rv == null && lv == null) return;
            if (rv == null) {
                out[id] = __tmCloneJsonSafe(lv, lv);
                return;
            }
            if (lv == null) {
                out[id] = __tmCloneJsonSafe(rv, rv);
                return;
            }
            const rTs = __tmParseUpdatedAtNumber(rv?.updatedAt);
            const lTs = __tmParseUpdatedAtNumber(lv?.updatedAt);
            out[id] = __tmCloneJsonSafe(lTs >= rTs ? lv : rv, lTs >= rTs ? lv : rv);
        });
        return out;
    }

    function __tmMergeWhiteboardNotes(remoteInput, localInput) {
        const out = new Map();
        const push = (list) => {
            const arr = Array.isArray(list) ? list : [];
            arr.forEach((item, index) => {
                const note = (item && typeof item === 'object') ? item : {};
                const id = String(note.id || '').trim() || `note_${index}`;
                const prev = out.get(id);
                if (!prev) {
                    out.set(id, __tmCloneJsonSafe({ ...note, id }, { ...note, id }));
                    return;
                }
                const prevTs = Math.max(__tmParseUpdatedAtNumber(prev.updatedAt), __tmParseUpdatedAtNumber(prev.createdAt));
                const nextTs = Math.max(__tmParseUpdatedAtNumber(note.updatedAt), __tmParseUpdatedAtNumber(note.createdAt));
                if (nextTs >= prevTs) out.set(id, __tmCloneJsonSafe({ ...note, id }, { ...note, id }));
            });
        };
        push(remoteInput);
        push(localInput);
        return Array.from(out.values());
    }

    function __tmMergeWhiteboardPlacedTaskIds(remoteInput, localInput) {
        const remote = (remoteInput && typeof remoteInput === 'object' && !Array.isArray(remoteInput)) ? remoteInput : {};
        const local = (localInput && typeof localInput === 'object' && !Array.isArray(localInput)) ? localInput : {};
        const out = {};
        [...Object.keys(remote), ...Object.keys(local)].forEach((id0) => {
            const id = String(id0 || '').trim();
            if (!id) return;
            if (remote[id] || local[id]) out[id] = true;
        });
        return out;
    }

    function __tmBuildWhiteboardSettingsState(data) {
        const src = (data && typeof data === 'object') ? data : {};
        return {
            whiteboardStateVersion: __tmParseVersionNumber(src.whiteboardStateVersion),
            whiteboardLinks: __tmCloneJsonSafe(src.whiteboardLinks || [], []),
            whiteboardDetachedChildren: __tmCloneJsonSafe(src.whiteboardDetachedChildren || {}, {}),
            whiteboardNotes: __tmCloneJsonSafe(src.whiteboardNotes || [], []),
            whiteboardTool: String(src.whiteboardTool || 'pan').trim() || 'pan',
            whiteboardSidebarCollapsed: !!src.whiteboardSidebarCollapsed,
            whiteboardSidebarWidth: Number(src.whiteboardSidebarWidth) || 300,
            whiteboardShowDone: !!src.whiteboardShowDone,
            whiteboardCardFields: __tmCloneJsonSafe(src.whiteboardCardFields || [], []),
            whiteboardView: __tmCloneJsonSafe(src.whiteboardView || { x: 64, y: 40, zoom: 1 }, { x: 64, y: 40, zoom: 1 }),
            whiteboardNodePos: __tmCloneJsonSafe(src.whiteboardNodePos || {}, {}),
            whiteboardPlacedTaskIds: __tmCloneJsonSafe(src.whiteboardPlacedTaskIds || {}, {}),
            whiteboardDocFrameSize: __tmCloneJsonSafe(src.whiteboardDocFrameSize || {}, {}),
            whiteboardAllTabsLayoutMode: String(src.whiteboardAllTabsLayoutMode || 'board').trim() || 'board',
            whiteboardAllTabsDocOrderByGroup: __tmCloneJsonSafe(src.whiteboardAllTabsDocOrderByGroup || {}, {}),
            whiteboardSequenceMode: !!src.whiteboardSequenceMode,
        };
    }

    function __tmGetWhiteboardSettingsFingerprint(data) {
        try {
            return JSON.stringify(__tmBuildWhiteboardSettingsState(data));
        } catch (e) {
            return '';
        }
    }

    function __tmBuildCollapsedSessionState(data) {
        const src = (data && typeof data === 'object') ? data : {};
        const normalizeList = (list) => Array.from(new Set(
            (Array.isArray(list) ? list : [])
                .map((item) => String(item || '').trim())
                .filter(Boolean)
        )).sort();
        return {
            collapsedTaskIds: normalizeList(src.collapsedTaskIds),
            kanbanCollapsedTaskIds: normalizeList(src.kanbanCollapsedTaskIds),
            collapsedGroups: normalizeList(src.collapsedGroups),
            expandedCompletedGroups: normalizeList(src.expandedCompletedGroups),
        };
    }

    function __tmAssignCollapsedSessionState(target, source) {
        const next = __tmBuildCollapsedSessionState(source);
        const out = (target && typeof target === 'object') ? target : {};
        out.collapsedTaskIds = next.collapsedTaskIds.slice();
        out.kanbanCollapsedTaskIds = next.kanbanCollapsedTaskIds.slice();
        out.collapsedGroups = next.collapsedGroups.slice();
        out.expandedCompletedGroups = next.expandedCompletedGroups.slice();
        return next;
    }

    function __tmGetCollapsedSessionStateFingerprint(data) {
        try {
            return JSON.stringify(__tmBuildCollapsedSessionState(data));
        } catch (e) {
            return '';
        }
    }

    function __tmGetCollapsedSessionUpdatedAt(data) {
        const src = (data && typeof data === 'object') ? data : {};
        return __tmParseUpdatedAtNumber(src.collapseStateUpdatedAt)
            || __tmParseUpdatedAtNumber(src.settingsUpdatedAt);
    }

    function __tmMergeWhiteboardSettingsState(remoteData, localData) {
        const remote = __tmBuildWhiteboardSettingsState(remoteData);
        const local = __tmBuildWhiteboardSettingsState(localData);
        return {
            whiteboardStateVersion: Math.max(__tmParseVersionNumber(remote.whiteboardStateVersion), __tmParseVersionNumber(local.whiteboardStateVersion)),
            whiteboardLinks: __tmMergeWhiteboardLinkArrays(remote.whiteboardLinks, local.whiteboardLinks),
            whiteboardDetachedChildren: __tmMergeTimestampedObjectMaps(remote.whiteboardDetachedChildren, local.whiteboardDetachedChildren),
            whiteboardNotes: __tmMergeWhiteboardNotes(remote.whiteboardNotes, local.whiteboardNotes),
            whiteboardTool: String(local.whiteboardTool || remote.whiteboardTool || 'pan').trim() || 'pan',
            whiteboardSidebarCollapsed: local.whiteboardSidebarCollapsed,
            whiteboardSidebarWidth: Number(local.whiteboardSidebarWidth) || Number(remote.whiteboardSidebarWidth) || 300,
            whiteboardShowDone: local.whiteboardShowDone,
            whiteboardCardFields: __tmCloneJsonSafe(local.whiteboardCardFields || remote.whiteboardCardFields || [], []),
            whiteboardView: __tmCloneJsonSafe(local.whiteboardView || remote.whiteboardView || { x: 64, y: 40, zoom: 1 }, { x: 64, y: 40, zoom: 1 }),
            whiteboardNodePos: __tmMergeTimestampedObjectMaps(remote.whiteboardNodePos, local.whiteboardNodePos),
            whiteboardPlacedTaskIds: __tmMergeWhiteboardPlacedTaskIds(remote.whiteboardPlacedTaskIds, local.whiteboardPlacedTaskIds),
            whiteboardDocFrameSize: __tmMergeTimestampedObjectMaps(remote.whiteboardDocFrameSize, local.whiteboardDocFrameSize),
            whiteboardAllTabsLayoutMode: String(local.whiteboardAllTabsLayoutMode || remote.whiteboardAllTabsLayoutMode || 'board').trim() || 'board',
            whiteboardAllTabsDocOrderByGroup: {
                ...__tmCloneJsonSafe(remote.whiteboardAllTabsDocOrderByGroup || {}, {}),
                ...__tmCloneJsonSafe(local.whiteboardAllTabsDocOrderByGroup || {}, {}),
            },
            whiteboardSequenceMode: !!(local.whiteboardSequenceMode || remote.whiteboardSequenceMode),
        };
    }

    function __tmApplyMergedWhiteboardContentState(target, remoteData) {
        const out = (target && typeof target === 'object') ? target : {};
        const merged = __tmMergeWhiteboardSettingsState(remoteData, out);
        out.whiteboardStateVersion = merged.whiteboardStateVersion;
        out.whiteboardLinks = merged.whiteboardLinks;
        out.whiteboardDetachedChildren = merged.whiteboardDetachedChildren;
        out.whiteboardNotes = merged.whiteboardNotes;
        out.whiteboardNodePos = merged.whiteboardNodePos;
        out.whiteboardPlacedTaskIds = merged.whiteboardPlacedTaskIds;
        out.whiteboardDocFrameSize = merged.whiteboardDocFrameSize;
        out.whiteboardAllTabsDocOrderByGroup = merged.whiteboardAllTabsDocOrderByGroup;
        return out;
    }

    function __tmNormalizeWhiteboardStoreData(input) {
        const raw = (input && typeof input === 'object') ? input : {};
        const cards0 = (raw.cards && typeof raw.cards === 'object' && !Array.isArray(raw.cards)) ? raw.cards : {};
        const cards = {};
        Object.keys(cards0).forEach((k) => {
            const id = String(k || '').trim();
            if (!id) return;
            const v = cards0[k];
            if (!v || typeof v !== 'object') return;
            const docId = String(v.docId || '').trim();
            const content = String(v.content || '').trim();
            if (!docId || !content) return;
            cards[id] = {
                id,
                docId,
                content,
                parentTaskId: String(v.parentTaskId || '').trim(),
                h2: String(v.h2 || '').trim(),
                h2Id: String(v.h2Id || '').trim(),
                h2Path: String(v.h2Path || '').trim(),
                h2Sort: Number(v.h2Sort),
                h2Created: String(v.h2Created || '').trim(),
                h2Rank: Number(v.h2Rank),
                headingLevel: String(v.headingLevel || '').trim(),
                startDate: String(v.startDate || '').trim(),
                completionTime: String(v.completionTime || '').trim(),
                done: !!v.done,
                updatedAt: String(v.updatedAt || Date.now()),
            };
        });
        return {
            version: __tmParseVersionNumber(raw.version),
            cards,
            links: __tmNormalizeWhiteboardLinkArray(raw.links),
        };
    }

    function __tmMergeWhiteboardStoreData(remoteInput, localInput) {
        const remote = __tmNormalizeWhiteboardStoreData(remoteInput);
        const local = __tmNormalizeWhiteboardStoreData(localInput);
        const cards = __tmMergeTimestampedObjectMaps(remote.cards, local.cards);
        return {
            version: Math.max(remote.version, local.version),
            cards,
            links: __tmMergeWhiteboardLinkArrays(remote.links, local.links),
        };
    }

    function __tmGetTaskHeadingColumnLabel() {
        const level = String(SettingsStore?.data?.taskHeadingLevel || 'h2').trim() || 'h2';
        const labels = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
        return labels[level] || '标题';
    }

    function __tmNormalizeCustomFieldId(raw, fallback = '') {
        const normalizeToken = (value) => String(value || '').trim().toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
        const fallbackToken = normalizeToken(fallback || '');
        const base = normalizeToken(raw || '');
        return base || fallbackToken || `field-${Date.now().toString(36)}`;
    }

    function __tmNormalizeCustomFieldAttrName(raw, fallback = '') {
        const fallbackToken = __tmNormalizeCustomFieldId(fallback || '', 'field');
        let base = String(raw || '').trim();
        if (!base) base = String(fallback || '').trim();
        if (base.startsWith(__TM_CUSTOM_FIELD_ATTR_PREFIX)) {
            base = String(base.slice(__TM_CUSTOM_FIELD_ATTR_PREFIX.length) || '').trim();
        }
        return __tmNormalizeCustomFieldId(base, fallbackToken);
    }

    function __tmBuildCustomFieldAttrStorageKey(attrName, fallback = 'field') {
        const fallbackToken = __tmNormalizeCustomFieldAttrName(fallback || '', 'field');
        const name = __tmNormalizeCustomFieldAttrName(attrName, fallbackToken || 'field');
        const safeFallback = `${__TM_CUSTOM_FIELD_ATTR_PREFIX}${fallbackToken || 'field'}`;
        return __tmSafeAttrName(`${__TM_CUSTOM_FIELD_ATTR_PREFIX}${name}`, safeFallback);
    }

    function __tmBuildCustomFieldColumnKey(fieldId) {
        const id = __tmNormalizeCustomFieldId(fieldId);
        return id ? `${__TM_CUSTOM_FIELD_COLUMN_PREFIX}${id}` : '';
    }

    function __tmParseCustomFieldColumnKey(key) {
        const raw = String(key || '').trim();
        if (raw.startsWith(__TM_CUSTOM_FIELD_COLUMN_PREFIX)) {
            return __tmNormalizeCustomFieldId(raw.slice(__TM_CUSTOM_FIELD_COLUMN_PREFIX.length));
        }
        if (raw.startsWith('customField:')) {
            return __tmNormalizeCustomFieldId(raw.slice('customField:'.length));
        }
        return '';
    }

    function __tmCollectCustomFieldLoadPlan(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const viewMode = String(opts.viewMode || state?.viewMode || '').trim();
        const colOrder = Array.isArray(opts.colOrder)
            ? opts.colOrder
            : (Array.isArray(SettingsStore?.data?.columnOrder) ? SettingsStore.data.columnOrder : []);
        const rule = (opts.rule && typeof opts.rule === 'object')
            ? opts.rule
            : (typeof __tmGetCurrentRule === 'function' ? __tmGetCurrentRule() : null);
        const ruleFieldIds = new Set();
        const columnFieldIds = new Set();
        const pushField = (targetSet, fieldValue) => {
            const fieldId = __tmParseCustomFieldColumnKey(fieldValue);
            if (fieldId) targetSet.add(fieldId);
        };
        colOrder.forEach((col) => pushField(columnFieldIds, col));
        (Array.isArray(rule?.conditions) ? rule.conditions : []).forEach((condition) => {
            pushField(ruleFieldIds, condition?.field);
        });
        (Array.isArray(rule?.sort) ? rule.sort : []).forEach((sortRule) => {
            pushField(ruleFieldIds, sortRule?.field);
        });
        const bulkFieldIdsSet = new Set(ruleFieldIds);
        if (viewMode === 'checklist') {
            const checklistCompact = !!SettingsStore?.data?.checklistCompactMode;
            if (checklistCompact) {
                [
                    SettingsStore?.data?.desktopChecklistCompactMetaFields,
                    SettingsStore?.data?.dockChecklistCompactMetaFields,
                    SettingsStore?.data?.mobileChecklistCompactMetaFields,
                ].forEach((fields) => {
                    __tmNormalizeCompactChecklistMetaFields(fields, []).forEach((fieldKey) => pushField(bulkFieldIdsSet, fieldKey));
                });
            } else {
                __tmGetCustomFieldDefs().forEach((field) => {
                    const fieldId = String(field?.id || '').trim();
                    if (!fieldId || field?.enabled === false || String(field?.type || '').trim() === 'text') return;
                    bulkFieldIdsSet.add(fieldId);
                });
            }
        }
        const deferredListFieldIds = [];
        if (viewMode === 'list') {
            columnFieldIds.forEach((fieldId) => {
                if (!ruleFieldIds.has(fieldId)) deferredListFieldIds.push(fieldId);
            });
        } else {
            columnFieldIds.forEach((fieldId) => bulkFieldIdsSet.add(fieldId));
        }
        const bulkFieldIds = Array.from(bulkFieldIdsSet);
        return {
            bulkFieldIds,
            deferredListFieldIds,
            allFieldIds: Array.from(new Set(bulkFieldIds.concat(deferredListFieldIds))),
        };
    }

    function __tmNormalizeCustomFieldIdList(list) {
        return Array.from(new Set(
            (Array.isArray(list) ? list : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean)
        )).sort();
    }

    function __tmBuildRuntimeCustomFieldLoadPlan(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const hasOwn = (key) => Object.prototype.hasOwnProperty.call(opts, key);
        const viewMode = String((hasOwn('viewMode') ? opts.viewMode : state?.viewMode) || '').trim();
        const colOrder = Array.isArray(opts.colOrder)
            ? opts.colOrder
            : (Array.isArray(SettingsStore?.data?.columnOrder) ? SettingsStore.data.columnOrder : []);
        let rule = null;
        if (hasOwn('rule')) {
            rule = (opts.rule && typeof opts.rule === 'object') ? opts.rule : null;
        } else if (hasOwn('ruleId')) {
            rule = __tmFindRuleById(opts.ruleId);
        } else if (typeof __tmGetCurrentRule === 'function') {
            rule = __tmGetCurrentRule();
        }
        const plan = __tmCollectCustomFieldLoadPlan({
            viewMode,
            colOrder,
            rule,
        });
        return {
            bulkFieldIds: __tmNormalizeCustomFieldIdList(plan?.bulkFieldIds),
            deferredListFieldIds: __tmNormalizeCustomFieldIdList(plan?.deferredListFieldIds),
            allFieldIds: __tmNormalizeCustomFieldIdList(plan?.allFieldIds),
        };
    }

    function __tmDoesCustomFieldPlanNeedReload(prevPlan, nextPlan) {
        const prevBulkSet = new Set(__tmNormalizeCustomFieldIdList(prevPlan?.bulkFieldIds));
        return __tmNormalizeCustomFieldIdList(nextPlan?.bulkFieldIds).some((fieldId) => !prevBulkSet.has(fieldId));
    }

    async function __tmCommitCustomFieldLoadPlan(prevPlan, nextPlan, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const isListView = String(state?.viewMode || '').trim() === 'list';
        const prevAllFieldSet = new Set(__tmNormalizeCustomFieldIdList(prevPlan?.allFieldIds));
        const nextDeferredFieldIds = __tmNormalizeCustomFieldIdList(nextPlan?.deferredListFieldIds);
        state.deferredListCustomFieldIds = isListView ? nextDeferredFieldIds.slice() : [];
        if (!isListView || opts.hydrateVisible !== true) return null;
        const hydrateFieldIds = nextDeferredFieldIds.filter((fieldId) => !prevAllFieldSet.has(fieldId));
        if (!hydrateFieldIds.length) return null;
        try {
            return await __tmHydrateVisibleListCustomFields(hydrateFieldIds, opts);
        } catch (e) {
            return null;
        }
    }

    function __tmCollectCustomFieldIdsForBulkTaskLoad(options = {}) {
        return __tmCollectCustomFieldLoadPlan(options).allFieldIds;
    }

    function __tmBuildCustomFieldAttrKey(fieldId) {
        const id = __tmNormalizeCustomFieldId(fieldId);
        if (!id) return '';
        const field = __tmGetCustomFieldDefMap().get(id);
        return __tmBuildCustomFieldAttrStorageKey(field?.attrKey || field?.id || field?.name || id, id);
    }

    function __tmParseCustomFieldAttrKey(attrKey) {
        const raw = String(attrKey || '').trim();
        if (!raw.startsWith(__TM_CUSTOM_FIELD_ATTR_PREFIX)) return '';
        return __tmNormalizeCustomFieldAttrName(raw.slice(__TM_CUSTOM_FIELD_ATTR_PREFIX.length));
    }

    function __tmGetCustomFieldPresetColor(index = 0) {
        const palette = Array.isArray(__TM_CUSTOM_FIELD_COLOR_PRESETS) && __TM_CUSTOM_FIELD_COLOR_PRESETS.length
            ? __TM_CUSTOM_FIELD_COLOR_PRESETS
            : ['#3b82f6'];
        const idx = Math.abs(Number(index) || 0) % palette.length;
        return String(palette[idx] || '#3b82f6').trim() || '#3b82f6';
    }

    function __tmGetStatusColorPaletteGroups() {
        return (Array.isArray(__TM_STATUS_COLOR_PALETTE_GROUPS) ? __TM_STATUS_COLOR_PALETTE_GROUPS : [])
            .map((group, groupIndex) => {
                const colors = (Array.isArray(group?.colors) ? group.colors : [])
                    .map((color) => __tmNormalizeHexColor(color, ''))
                    .filter(Boolean);
                if (!colors.length) return null;
                return {
                    id: String(group?.id || `status-palette-${groupIndex + 1}`).trim() || `status-palette-${groupIndex + 1}`,
                    label: String(group?.label || `色系 ${groupIndex + 1}`).trim() || `色系 ${groupIndex + 1}`,
                    colors,
                };
            })
            .filter(Boolean);
    }

    function __tmGetStatusPresetColor(index = 0) {
        const palette = __tmGetStatusColorPaletteGroups().flatMap((group) => group.colors || []);
        const fallbackPalette = palette.length ? palette : __TM_CUSTOM_FIELD_COLOR_PRESETS;
        const idx = Math.abs(Number(index) || 0) % fallbackPalette.length;
        return String(fallbackPalette[idx] || '#3b82f6').trim() || '#3b82f6';
    }

    function __tmBuildPresetColorPickerOptions(defaultColor, extra = {}) {
        const normalizedDefault = __tmNormalizeHexColor(defaultColor, '#3b82f6') || '#3b82f6';
        return {
            defaultColor: normalizedDefault,
            paletteGroups: __tmGetStatusColorPaletteGroups(),
            customSectionLabel: '自定义颜色',
            pickLabel: '+',
            formatHint: '支持 HEX、RGBA、HSL/HSLA、透明色 transparent、var(--token) 等格式',
            ...extra,
        };
    }

    function __tmNormalizeCustomFieldOption(option, index = 0, seenIds = null) {
        const source = (option && typeof option === 'object') ? option : {};
        const baseName = String(source.name || source.label || '').trim() || `选项${index + 1}`;
        let id = __tmNormalizeCustomFieldId(source.id || baseName, `option-${index + 1}`);
        const seen = seenIds instanceof Set ? seenIds : new Set();
        let dedupe = 2;
        while (seen.has(id)) {
            id = `${__tmNormalizeCustomFieldId(source.id || baseName, `option-${index + 1}`)}-${dedupe}`;
            dedupe += 1;
        }
        seen.add(id);
        const color = __tmNormalizeHexColor(source.color, __tmGetCustomFieldPresetColor(index)) || __tmGetCustomFieldPresetColor(index);
        return {
            id,
            name: baseName,
            color,
        };
    }

    function __tmNormalizeCustomFieldDef(field, index = 0, seenIds = null, seenAttrKeys = null) {
        const source = (field && typeof field === 'object') ? field : {};
        const name = String(source.name || source.label || '').trim() || `自定义列${index + 1}`;
        let id = __tmNormalizeCustomFieldId(source.id || name, `field-${index + 1}`);
        const seen = seenIds instanceof Set ? seenIds : new Set();
        let dedupe = 2;
        while (seen.has(id)) {
            id = `${__tmNormalizeCustomFieldId(source.id || name, `field-${index + 1}`)}-${dedupe}`;
            dedupe += 1;
        }
        seen.add(id);
        let attrKey = __tmNormalizeCustomFieldAttrName(source.attrKey || name, id || `field-${index + 1}`);
        const seenAttrs = seenAttrKeys instanceof Set ? seenAttrKeys : new Set();
        const attrBase = attrKey;
        let attrDedupe = 2;
        while (seenAttrs.has(attrKey)) {
            attrKey = `${attrBase}-${attrDedupe}`;
            attrDedupe += 1;
        }
        seenAttrs.add(attrKey);
        const rawType = String(source.type || '').trim();
        const type = rawType === 'multi'
            ? 'multi'
            : (rawType === 'text' ? 'text' : 'single');
        const optionSeen = new Set();
        const options = (Array.isArray(source.options) ? source.options : [])
            .map((item, optionIndex) => __tmNormalizeCustomFieldOption(item, optionIndex, optionSeen))
            .filter(Boolean);
        return {
            id,
            name,
            attrKey,
            type,
            options,
            enabled: source.enabled !== false,
        };
    }

    function __tmNormalizeCustomFieldDefs(input) {
        const source = Array.isArray(input) ? input : [];
        const seen = new Set();
        const seenAttrKeys = new Set();
        return source.map((item, index) => __tmNormalizeCustomFieldDef(item, index, seen, seenAttrKeys)).filter(Boolean);
    }

    const __tmCustomFieldDefsRuntimeCache = {
        input: null,
        version: Number.NaN,
        defs: [],
        defMap: new Map(),
        attrKeyMap: new Map(),
    };
    const __tmCustomFieldAttrValueCache = new Map();

    function __tmClearCustomFieldAttrValueCache() {
        try { __tmCustomFieldAttrValueCache.clear(); } catch (e) {}
    }

    function __tmInvalidateCustomFieldDefsRuntimeCache() {
        __tmCustomFieldDefsRuntimeCache.input = null;
        __tmCustomFieldDefsRuntimeCache.version = Number.NaN;
        __tmCustomFieldDefsRuntimeCache.defs = [];
        __tmCustomFieldDefsRuntimeCache.defMap = new Map();
        __tmCustomFieldDefsRuntimeCache.attrKeyMap = new Map();
        try { __tmClearCustomFieldAttrValueCache(); } catch (e) {}
    }

    function __tmGetCustomFieldDefsRuntimeArtifacts() {
        const input = Array.isArray(SettingsStore?.data?.customFieldDefs) ? SettingsStore.data.customFieldDefs : [];
        const version = __tmParseVersionNumber(SettingsStore?.data?.customFieldDefsVersion);
        const cache = __tmCustomFieldDefsRuntimeCache;
        if (cache.input === input && cache.version === version) {
            return cache;
        }
        const defs = __tmNormalizeCustomFieldDefs(input);
        const defMap = new Map();
        const attrKeyMap = new Map();
        defs.forEach((field) => {
            const id = String(field?.id || '').trim();
            if (id) defMap.set(id, field);
            const fieldId = __tmNormalizeCustomFieldId(field?.id, 'field');
            const attrKey = __tmNormalizeCustomFieldAttrName(field?.attrKey || fieldId || field?.name || 'field', fieldId || 'field');
            if (attrKey) attrKeyMap.set(attrKey, field);
        });
        cache.input = input;
        cache.version = version;
        cache.defs = defs;
        cache.defMap = defMap;
        cache.attrKeyMap = attrKeyMap;
        return cache;
    }

    function __tmGetCustomFieldDefs() {
        return __tmGetCustomFieldDefsRuntimeArtifacts().defs;
    }

    function __tmGetCustomFieldDefMap() {
        return __tmGetCustomFieldDefsRuntimeArtifacts().defMap;
    }

    function __tmGetCustomFieldAttrKeyMap() {
        return __tmGetCustomFieldDefsRuntimeArtifacts().attrKeyMap;
    }

    function __tmGetCustomFieldDefByAttrStorageKey(attrKey) {
        const attrName = __tmParseCustomFieldAttrKey(attrKey);
        if (!attrName) return null;
        return __tmGetCustomFieldAttrKeyMap().get(attrName) || null;
    }

    function __tmCloneCustomFieldDefs(input) {
        return __tmCloneJsonSafe(__tmNormalizeCustomFieldDefs(input), []);
    }

    function __tmGetCustomFieldDefsFingerprint(input) {
        try {
            return JSON.stringify(__tmNormalizeCustomFieldDefs(input));
        } catch (e) {
            return '';
        }
    }

    function __tmMergeLegacyCustomFieldDefs(localInput, remoteInput) {
        const out = [];
        const seen = new Set();
        const push = (list) => {
            __tmCloneCustomFieldDefs(list).forEach((field) => {
                const id = String(field?.id || '').trim();
                if (!id || seen.has(id)) return;
                seen.add(id);
                out.push(__tmCloneJsonSafe(field, field));
            });
        };
        push(localInput);
        push(remoteInput);
        return __tmNormalizeCustomFieldDefs(out);
    }

    function __tmMergeCustomFieldDefsThreeWay(baseInput, localInput, remoteInput, options = {}) {
        const prefer = String(options.prefer || 'local').trim() === 'remote' ? 'remote' : 'local';
        const base = __tmCloneCustomFieldDefs(baseInput);
        const local = __tmCloneCustomFieldDefs(localInput);
        const remote = __tmCloneCustomFieldDefs(remoteInput);
        const toMap = (list) => {
            const map = new Map();
            list.forEach((field) => {
                const id = String(field?.id || '').trim();
                if (!id || map.has(id)) return;
                map.set(id, field);
            });
            return map;
        };
        const isSame = (left, right) => {
            try {
                return JSON.stringify(left || null) === JSON.stringify(right || null);
            } catch (e) {
                return false;
            }
        };
        const pickConflict = (localValue, remoteValue) => {
            const preferred = prefer === 'remote' ? remoteValue : localValue;
            const fallback = prefer === 'remote' ? localValue : remoteValue;
            return preferred
                ? __tmCloneJsonSafe(preferred, preferred)
                : (fallback ? __tmCloneJsonSafe(fallback, fallback) : null);
        };
        const baseMap = toMap(base);
        const localMap = toMap(local);
        const remoteMap = toMap(remote);
        const orderedIds = [];
        const seenIds = new Set();
        const pushOrder = (list) => {
            list.forEach((field) => {
                const id = String(field?.id || '').trim();
                if (!id || seenIds.has(id)) return;
                seenIds.add(id);
                orderedIds.push(id);
            });
        };
        if (prefer === 'remote') {
            pushOrder(remote);
            pushOrder(local);
        } else {
            pushOrder(local);
            pushOrder(remote);
        }
        pushOrder(base);

        const merged = [];
        orderedIds.forEach((id) => {
            const baseValue = baseMap.get(id) || null;
            const localValue = localMap.get(id) || null;
            const remoteValue = remoteMap.get(id) || null;
            const sameLocalBase = isSame(localValue, baseValue);
            const sameRemoteBase = isSame(remoteValue, baseValue);
            const sameLocalRemote = isSame(localValue, remoteValue);
            let chosen = null;
            if (sameLocalRemote) chosen = localValue || remoteValue || null;
            else if (sameLocalBase) chosen = remoteValue || null;
            else if (sameRemoteBase) chosen = localValue || null;
            else if (!baseValue) chosen = pickConflict(localValue, remoteValue);
            else if (!localValue && !remoteValue) chosen = null;
            else if (!localValue) chosen = pickConflict(null, remoteValue);
            else if (!remoteValue) chosen = pickConflict(localValue, null);
            else chosen = pickConflict(localValue, remoteValue);
            if (chosen) merged.push(chosen);
        });
        return __tmNormalizeCustomFieldDefs(merged);
    }

    function __tmResolveCustomFieldDefsOnLoad(localInput, remoteInput, options = {}) {
        const localVersion = __tmParseVersionNumber(options.localVersion);
        const remoteVersion = __tmParseVersionNumber(options.remoteVersion);
        const local = __tmCloneCustomFieldDefs(localInput);
        const hasRemote = Array.isArray(remoteInput);
        const remote = hasRemote ? __tmCloneCustomFieldDefs(remoteInput) : [];
        if (!hasRemote) {
            return {
                defs: local,
                version: localVersion,
            };
        }
        if (remoteVersion > localVersion) {
            return {
                defs: remote,
                version: remoteVersion,
            };
        }
        if (localVersion > remoteVersion) {
            return {
                defs: remoteVersion === 0 && remote.length
                    ? __tmMergeLegacyCustomFieldDefs(local, remote)
                    : local,
                version: localVersion,
            };
        }
        return {
            defs: __tmMergeLegacyCustomFieldDefs(local, remote),
            version: Math.max(localVersion, remoteVersion),
        };
    }

    function __tmMaybeBackfillTaskCustomFieldAttrs(task, metaSource = null, options = {}) {
        const tid = String(task?.id || '').trim();
        if (!tid || __tmCustomFieldAttrBackfillInFlight.has(tid)) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const customFieldDefMap = opts.customFieldDefMap instanceof Map ? opts.customFieldDefMap : __tmGetCustomFieldDefMap();
        if (!(customFieldDefMap instanceof Map) || customFieldDefMap.size === 0) return;
        const meta = (metaSource && typeof metaSource === 'object') ? metaSource : (MetaStore.get(tid) || null);
        const metaValues = (meta?.customFieldValues && typeof meta.customFieldValues === 'object' && !Array.isArray(meta.customFieldValues))
            ? meta.customFieldValues
            : null;
        if (!metaValues || !Object.keys(metaValues).length) return;
        const rawValues = (task?.__customFieldRawValues && typeof task.__customFieldRawValues === 'object' && !Array.isArray(task.__customFieldRawValues))
            ? task.__customFieldRawValues
            : {};
        const patch = {};
        Object.entries(metaValues).forEach(([fieldId, fieldValue]) => {
            const fid = String(fieldId || '').trim();
            if (!fid) return;
            const field = customFieldDefMap.get(fid);
            if (!field) return;
            const normalized = __tmNormalizeCustomFieldValue(field, fieldValue);
            const serialized = __tmSerializeCustomFieldValue(field, normalized);
            const currentRaw = Object.prototype.hasOwnProperty.call(rawValues, fid) ? String(rawValues[fid] ?? '') : '';
            if (serialized === currentRaw) return;
            if (!serialized && !currentRaw) return;
            patch[fid] = normalized;
        });
        if (!Object.keys(patch).length) return;
        __tmCustomFieldAttrBackfillInFlight.add(tid);
        Promise.resolve().then(async () => {
            try {
                await __tmPersistMetaAndAttrsKernel(tid, { customFieldValues: patch }, {
                    touchMetaStore: false,
                    skipFlush: true,
                });
                if (!task.__customFieldRawValues || typeof task.__customFieldRawValues !== 'object' || Array.isArray(task.__customFieldRawValues)) {
                    task.__customFieldRawValues = {};
                }
                Object.entries(patch).forEach(([fieldId, fieldValue]) => {
                    const field = customFieldDefMap.get(String(fieldId || '').trim());
                    if (!field) return;
                    const serialized = __tmSerializeCustomFieldValue(field, fieldValue);
                    if (serialized) task.__customFieldRawValues[fieldId] = serialized;
                    else delete task.__customFieldRawValues[fieldId];
                });
            } catch (e) {
            } finally {
                __tmCustomFieldAttrBackfillInFlight.delete(tid);
            }
        });
    }

    function __tmGetColumnWidthDefaults() {
        const widths = { ...__TM_BUILTIN_COLUMN_WIDTHS };
        __tmGetCustomFieldDefs().forEach((field) => {
            const key = __tmBuildCustomFieldColumnKey(field?.id);
            if (!key) return;
            const type = String(field?.type || '').trim();
            widths[key] = type === 'multi'
                ? 180
                : (type === 'text' ? 220 : 140);
        });
        return widths;
    }

    function __tmGetColumnPercentDefaults() {
        const widths = { ...__TM_BUILTIN_COLUMN_PERCENT_WIDTHS };
        __tmGetCustomFieldDefs().forEach((field) => {
            const key = __tmBuildCustomFieldColumnKey(field?.id);
            if (!key) return;
            const type = String(field?.type || '').trim();
            widths[key] = type === 'multi'
                ? 14
                : (type === 'text' ? 18 : 12);
        });
        return widths;
    }

    function __tmGetDefaultColumnOrder() {
        const order = __TM_BUILTIN_COLUMN_DEFAULT_ORDER.slice();
        __tmGetCustomFieldDefs().forEach((field) => {
            if (field?.enabled === false) return;
            const key = __tmBuildCustomFieldColumnKey(field?.id);
            if (key && !order.includes(key)) order.push(key);
        });
        return order;
    }

    function __tmGetKnownColumnKeys() {
        return new Set(__tmGetDefaultColumnOrder());
    }

    function __tmResolveColumnLabel(key) {
        const raw = String(key || '').trim();
        if (!raw) return '';
        if (raw === 'pinned') return '置顶';
        if (raw === 'content') return '任务内容';
        if (raw === 'status') return '状态';
        if (raw === 'score') return '优先级';
        if (raw === 'doc') return '文档';
        if (raw === 'h2') return __tmGetTaskHeadingColumnLabel();
        if (raw === 'priority') return '重要性';
        if (raw === 'startDate') return '开始日期';
        if (raw === 'completionTime') return '截止日期';
        if (raw === 'taskCompleteAt') return '完成时间';
        if (raw === 'remainingTime') return '剩余时间';
        if (raw === 'duration') return '时长';
        if (raw === 'spent') return '耗时';
        if (raw === 'remark') return '备注';
        if (raw === 'attachments') return '附件';
        const fieldId = __tmParseCustomFieldColumnKey(raw);
        if (!fieldId) return raw;
        const field = __tmGetCustomFieldDefMap().get(fieldId);
        return String(field?.name || fieldId).trim() || fieldId;
    }

    function __tmGetAllColumnDefs() {
        const builtins = [
            { key: 'pinned', label: '置顶', kind: 'builtin' },
            { key: 'content', label: '任务内容', kind: 'builtin' },
            { key: 'status', label: '状态', kind: 'builtin' },
            { key: 'score', label: '优先级', kind: 'builtin' },
            { key: 'doc', label: '文档', kind: 'builtin' },
            { key: 'h2', label: __tmGetTaskHeadingColumnLabel(), kind: 'builtin' },
            { key: 'priority', label: '重要性', kind: 'builtin' },
            { key: 'startDate', label: '开始日期', kind: 'builtin' },
            { key: 'completionTime', label: '截止日期', kind: 'builtin' },
            { key: 'taskCompleteAt', label: '完成时间', kind: 'builtin' },
            { key: 'remainingTime', label: '剩余时间', kind: 'builtin' },
            { key: 'duration', label: '时长', kind: 'builtin' },
            { key: 'spent', label: '耗时', kind: 'builtin' },
            { key: 'remark', label: '备注', kind: 'builtin' },
            { key: 'attachments', label: '附件', kind: 'builtin' },
        ];
        const customs = __tmGetCustomFieldDefs().map((field) => ({
            key: __tmBuildCustomFieldColumnKey(field?.id),
            label: String(field?.name || field?.id || '').trim(),
            kind: 'custom',
            fieldId: String(field?.id || '').trim(),
            field,
        })).filter((item) => item.key && item.fieldId);
        return builtins.concat(customs);
    }

    function __tmGetColumnDefMap() {
        const map = new Map();
        __tmGetAllColumnDefs().forEach((def) => {
            const key = String(def?.key || '').trim();
            if (!key) return;
            map.set(key, def);
        });
        return map;
    }

    function __tmFindCustomFieldOption(field, rawValue) {
        const def = (field && typeof field === 'object') ? field : {};
        const token = String(rawValue ?? '').trim();
        if (!token) return null;
        const options = Array.isArray(def.options) ? def.options : [];
        let matchedByName = null;
        for (const option of options) {
            const optionId = String(option?.id || '').trim();
            if (optionId && optionId === token) return option;
            if (!matchedByName) {
                const optionName = String(option?.name || '').trim();
                if (optionName && optionName === token) matchedByName = option;
            }
        }
        return matchedByName;
    }

    function __tmNormalizeCustomFieldValue(field, rawValue) {
        const def = (field && typeof field === 'object') ? field : {};
        const rawType = String(def.type || '').trim();
        const type = rawType === 'multi'
            ? 'multi'
            : (rawType === 'text' ? 'text' : 'single');
        if (type === 'multi') {
            let list = [];
            if (Array.isArray(rawValue)) {
                list = rawValue;
            } else {
                const raw = String(rawValue ?? '').trim();
                if (!raw) return [];
                try {
                    const parsed = JSON.parse(raw);
                    list = Array.isArray(parsed) ? parsed : (parsed == null ? [] : [parsed]);
                } catch (e) {
                    list = raw.split(/\s*[,，、]\s*/).map((item) => String(item || '').trim()).filter(Boolean);
                }
            }
            const out = [];
            const seen = new Set();
            list.forEach((item) => {
                const rawToken = String(item || '').trim();
                if (!rawToken) return;
                const option = __tmFindCustomFieldOption(def, rawToken);
                const normalizedToken = String(option?.id || rawToken).trim();
                if (!normalizedToken || seen.has(normalizedToken)) return;
                seen.add(normalizedToken);
                out.push(normalizedToken);
            });
            return out;
        }
        if (type === 'text') {
            return String(rawValue ?? '').trim();
        }
        const rawToken = String(rawValue ?? '').trim();
        if (!rawToken) return '';
        const option = __tmFindCustomFieldOption(def, rawToken);
        return String(option?.id || rawToken).trim();
    }

    function __tmSerializeCustomFieldValue(field, value) {
        const def = (field && typeof field === 'object') ? field : {};
        const rawType = String(def.type || '').trim();
        const type = rawType === 'multi'
            ? 'multi'
            : (rawType === 'text' ? 'text' : 'single');
        if (type === 'multi') {
            const list = __tmNormalizeCustomFieldValue(def, value);
            if (!list.length) return '';
            return list
                .map((item) => {
                    const token = String(item || '').trim();
                    if (!token) return '';
                    const option = __tmFindCustomFieldOption(def, token);
                    return String(option?.name || token).trim();
                })
                .filter(Boolean)
                .join(', ');
        }
        if (type === 'text') {
            return String(value ?? '').trim();
        }
        const token = String(__tmNormalizeCustomFieldValue(def, value) || '').trim();
        if (!token) return '';
        const option = __tmFindCustomFieldOption(def, token);
        return String(option?.name || token).trim();
    }

    function __tmNormalizeTaskCustomFieldValues(rawValues, metaValues = null, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const hasSourceObject = !!rawValues && typeof rawValues === 'object' && !Array.isArray(rawValues);
        const hasMetaObject = !!metaValues && typeof metaValues === 'object' && !Array.isArray(metaValues);
        if (!hasSourceObject && !hasMetaObject) return {};
        const source = hasSourceObject ? rawValues : {};
        const meta = hasMetaObject ? metaValues : {};
        if (!Object.keys(source).length && !Object.keys(meta).length) return {};
        const customFieldDefs = Array.isArray(opts.customFieldDefs) ? opts.customFieldDefs : __tmGetCustomFieldDefs();
        if (!customFieldDefs.length) return {};
        const out = {};
        customFieldDefs.forEach((field) => {
            const fieldId = String(field?.id || '').trim();
            if (!fieldId) return;
            const hasRaw = Object.prototype.hasOwnProperty.call(source, fieldId);
            const hasMeta = Object.prototype.hasOwnProperty.call(meta, fieldId);
            const normalized = __tmNormalizeCustomFieldValue(field, hasRaw ? source[fieldId] : (hasMeta ? meta[fieldId] : ''));
            if (Array.isArray(normalized)) {
                if (normalized.length) out[fieldId] = normalized;
                return;
            }
            if (String(normalized || '').trim()) out[fieldId] = normalized;
        });
        return out;
    }

    function __tmGetTaskCustomFieldValue(task, fieldId) {
        const values = (task?.customFieldValues && typeof task.customFieldValues === 'object' && !Array.isArray(task.customFieldValues))
            ? task.customFieldValues
            : {};
        return values[String(fieldId || '').trim()];
    }

    function __tmGetActiveListTaskRenderLimit() {
        const mode = String(state?.viewMode || '').trim();
        if (mode !== 'list' && mode !== 'checklist') return 0;
        const filteredCount = Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0;
        if (filteredCount <= 0) return 0;
        const virtualThreshold = 50;
        if (filteredCount <= virtualThreshold) return filteredCount;
        const step = Math.max(20, Math.min(1200, Number(state?.listRenderStep) || 20));
        return Math.max(step, Math.min(filteredCount, Number(state?.listRenderLimit) || step));
    }

    function __tmBuildCurrentViewDomRenderSignature(modeInput = '') {
        const mode = String(modeInput || state?.viewMode || '').trim() || 'list';
        if (mode !== 'list' && mode !== 'checklist') return '';
        try {
            const filtered = Array.isArray(state?.filteredTasks) ? state.filteredTasks : [];
            const limit = Math.max(0, Math.min(filtered.length, __tmGetActiveListTaskRenderLimit() || filtered.length));
            const sampleIds = [];
            const sampleTask = (idx) => {
                if (idx < 0 || idx >= limit) return;
                const id = String(filtered[idx]?.id || '').trim();
                if (id) sampleIds.push(`${idx}:${id}`);
            };
            sampleTask(0);
            sampleTask(1);
            sampleTask(Math.floor(limit / 2));
            sampleTask(limit - 2);
            sampleTask(limit - 1);
            const multiSelectedIds = Array.isArray(state?.multiSelectedTaskIds)
                ? state.multiSelectedTaskIds.map((id) => String(id || '').trim()).filter(Boolean).sort()
                : [];
            const multiSelectedSig = multiSelectedIds.length > 24
                ? `${multiSelectedIds.length}:${multiSelectedIds.slice(0, 12).join(',')}:${multiSelectedIds.slice(-12).join(',')}`
                : multiSelectedIds.join(',');
            const collapsedTaskIds = state?.collapsedTaskIds instanceof Set
                ? Array.from(state.collapsedTaskIds).map((id) => String(id || '').trim()).filter(Boolean).sort()
                : [];
            const collapsedGroups = state?.collapsedGroups instanceof Set
                ? Array.from(state.collapsedGroups).map((id) => String(id || '').trim()).filter(Boolean).sort()
                : [];
            const expandedCompletedGroups = state?.expandedCompletedGroups instanceof Set
                ? Array.from(state.expandedCompletedGroups).map((id) => String(id || '').trim()).filter(Boolean).sort()
                : [];
            return [
                mode,
                String(state?.activeDocId || 'all').trim() || 'all',
                String(state?.currentRule || '').trim(),
                String(state?.searchKeyword || '').trim(),
                String(state?.listRenderSignature || '').trim(),
                String(limit),
                String(filtered.length),
                String(state?.groupByDocName ? 1 : 0),
                String(state?.groupByTaskName ? 1 : 0),
                String(state?.groupByTime ? 1 : 0),
                String(state?.quadrantEnabled ? 1 : 0),
                String(state?.docTabsArchiveMode ? 1 : 0),
                String(state?.docTabsHidden ? 1 : 0),
                String(state?.multiSelectModeEnabled ? 1 : 0),
                String(Array.isArray(state?.multiSelectedTaskIds) ? state.multiSelectedTaskIds.length : 0),
                multiSelectedSig,
                String(collapsedTaskIds.length),
                collapsedTaskIds.join(','),
                String(collapsedGroups.length),
                collapsedGroups.join(','),
                String(expandedCompletedGroups.length),
                expandedCompletedGroups.join(','),
                String(state?.detailTaskId || '').trim(),
                sampleIds.join(','),
            ].join('|');
        } catch (e) {
            return '';
        }
    }

    function __tmCollectVisibleListTasks(options = {}) {
        if (String(state?.viewMode || '').trim() !== 'list') return [];
        const opts = (options && typeof options === 'object') ? options : {};
        const limit0 = Number.isFinite(Number(opts.limit))
            ? Math.max(1, Math.round(Number(opts.limit)))
            : __tmGetActiveListTaskRenderLimit();
        if (limit0 <= 0) return [];
        const rowModel = Array.isArray(opts.rowModel) ? opts.rowModel : __tmBuildTaskRowModel();
        const taskMap = (opts.taskMap && typeof opts.taskMap === 'object') ? opts.taskMap : (state?.flatTasks || {});
        const out = [];
        const seen = new Set();
        for (let i = 0; i < rowModel.length; i += 1) {
            const row = rowModel[i];
            if (String(row?.type || '').trim() !== 'task') continue;
            const taskId = String(row?.id || '').trim();
            if (!taskId || seen.has(taskId)) continue;
            const task = taskMap?.[taskId];
            if (!task || typeof task !== 'object') continue;
            out.push(task);
            seen.add(taskId);
            if (out.length >= limit0) break;
        }
        return out;
    }

    async function __tmHydrateVisibleListCustomFields(fieldIds, options = {}) {
        const requestedFieldIds = Array.from(new Set((Array.isArray(fieldIds) ? fieldIds : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        if (!requestedFieldIds.length || String(state?.viewMode || '').trim() !== 'list') {
            return {
                durationMs: 0,
                taskCount: 0,
                fieldCount: requestedFieldIds.length,
                cacheHitCount: 0,
                cacheMissCount: 0,
                hostQueryCount: 0,
                selfFallbackCount: 0,
                hostAssignedCount: 0,
                selfAssignedCount: 0,
            };
        }
        const opts = (options && typeof options === 'object') ? options : {};
        const tasks = Array.isArray(opts.tasks)
            ? opts.tasks.filter((task) => task && typeof task === 'object')
            : __tmCollectVisibleListTasks({
                limit: opts.limit,
                rowModel: opts.rowModel,
                taskMap: opts.taskMap,
            });
        if (!tasks.length) {
            return {
                durationMs: 0,
                taskCount: 0,
                fieldCount: requestedFieldIds.length,
                cacheHitCount: 0,
                cacheMissCount: 0,
                hostQueryCount: 0,
                selfFallbackCount: 0,
                hostAssignedCount: 0,
                selfAssignedCount: 0,
            };
        }
        const startTime = __tmPerfNow();
        let attachMeta = null;
        try {
            attachMeta = await __tmAttachCustomFieldAttrsToTasks(tasks, { fieldIds: requestedFieldIds });
        } catch (e) {
            attachMeta = null;
        }
        const customFieldDefs = Array.isArray(opts.customFieldDefs) ? opts.customFieldDefs : __tmGetCustomFieldDefs();
        tasks.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            const meta = taskId ? MetaStore.get(taskId) : null;
            const metaCustomFieldValues = (meta?.customFieldValues && typeof meta.customFieldValues === 'object' && !Array.isArray(meta.customFieldValues))
                ? meta.customFieldValues
                : null;
            task.customFieldValues = __tmNormalizeTaskCustomFieldValues(task?.__customFieldRawValues, metaCustomFieldValues, {
                customFieldDefs,
            });
        });
        return {
            durationMs: __tmRoundPerfMs(__tmPerfNow() - startTime),
            taskCount: tasks.length,
            fieldCount: requestedFieldIds.length,
            cacheHitCount: Number(attachMeta?.cacheHitCount || 0),
            cacheMissCount: Number(attachMeta?.cacheMissCount || 0),
            hostQueryCount: Number(attachMeta?.hostQueryCount || 0),
            selfFallbackCount: Number(attachMeta?.selfFallbackCount || 0),
            hostAssignedCount: Number(attachMeta?.hostAssignedCount || 0),
            selfAssignedCount: Number(attachMeta?.selfAssignedCount || 0),
        };
    }

    function __tmResolveCustomFieldSelectedOptions(field, rawValue) {
        const def = (field && typeof field === 'object') ? field : {};
        const normalized = __tmNormalizeCustomFieldValue(def, rawValue);
        const optionMap = new Map((Array.isArray(def.options) ? def.options : []).map((option) => [String(option?.id || '').trim(), option]));
        const values = Array.isArray(normalized) ? normalized : (String(normalized || '').trim() ? [String(normalized || '').trim()] : []);
        return values.map((value, index) => {
            const id = String(value || '').trim();
            const option = optionMap.get(id);
            if (option) return option;
            return {
                id,
                name: id || `未知选项${index + 1}`,
                color: '#9ca3af',
                missing: true,
            };
        });
    }

    function __tmBuildCustomFieldTagsHtml(field, rawValue, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const selected = __tmResolveCustomFieldSelectedOptions(field, rawValue);
        const max = Math.max(1, Number(opts.maxTags) || 3);
        const shown = selected.slice(0, max);
        const chips = shown.map((item) => `<span class="tm-status-tag${item?.missing ? ' is-missing' : ''}" style="${__tmBuildStatusChipStyle(item?.color || '#9ca3af')}">${esc(String(item?.name || item?.id || '').trim() || '未命名')}</span>`).join('');
        const remain = selected.length - shown.length;
        const remainHtml = remain > 0
            ? `<span class="tm-status-tag tm-custom-field-tag--more" style="${__tmBuildStatusChipStyle('#9ca3af')}">+${remain}</span>`
            : '';
        const emptyText = String(opts.emptyText || '').trim() || '未设置';
        if (!chips && !remainHtml) {
            return opts.allowEmpty === false ? '' : `<span class="tm-status-tag tm-custom-field-tag--empty" style="${__tmBuildStatusChipStyle('#9ca3af')}">${esc(emptyText)}</span>`;
        }
        return `${chips}${remainHtml}`;
    }

    function __tmBuildCustomFieldDisplayHtml(field, rawValue, options = {}) {
        const def = (field && typeof field === 'object') ? field : {};
        const type = String(def.type || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (type === 'text') {
            const text = String(__tmNormalizeCustomFieldValue(def, rawValue) || '').trim();
            if (!text) {
                if (opts.allowEmpty === false) return '';
                const emptyText = String(opts.emptyText || '').trim() || '未设置';
                return `<span class="tm-task-remark-text" style="color:var(--tm-secondary-text);">${esc(emptyText)}</span>`;
            }
            return `<span class="tm-task-remark-text">${esc(text)}</span>`;
        }
        return __tmBuildCustomFieldTagsHtml(def, rawValue, opts);
    }

    const MetaStore = {
        data: Storage.get('tm_meta_cache', {}) || {},
        loaded: false,
        saving: false,
        saveTimer: null,

        async load() {
            if (this.loaded) return;

            // 从云端加载元数据（优先）
            try {
                const res = await fetch('/api/file/getFile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: META_FILE_PATH }),
                });

                if (res.ok) {
                    const text = await res.text();
                    // 如果文件内容有效
                    if (text && text.trim() !== '') {
                        try {
                            const json = JSON.parse(text);
                            if (json && typeof json === 'object' && Object.keys(json).length > 0) {
                                this.data = json;
                                Storage.set('tm_meta_cache', this.data);
                                this.loaded = true;
                                return;
                            }
                        } catch (parseError) {
                        }
                    }
                }
            } catch (e) {
            }

            // 云端没有数据，使用本地缓存（已在初始化时加载）
            this.loaded = true;
        },

        get(id) {
            if (!id) return null;
            const v = this.data?.[id];
            return v && typeof v === 'object' ? v : null;
        },

        applyToTask(task) {
            const v = this.get(task?.id);
            if (!v) return;
            // 优先使用 MetaStore 的值（非空字符串、非 'null'、非 undefined）
            // 排除 'null' 字符串（SQL 查询返回的 null 会被转成字符串 'null'）
            const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';
            const taskId = String(task?.id || '').trim();
            const allowVisibleDateFallback = __tmHasPendingVisibleDatePersistence(taskId);
            const allowCustomStatusFallback = __tmHasPendingTaskFieldPersistence(taskId, ['customStatus']);

            // 对于从数据库查询的字段，如果数据库已有有效值，则优先使用数据库的值
            // 这样可以确保悬浮条修改后，切换页签时能获取到最新数据
            // 注意：数据库返回的字段名是 custom_priority, custom_status 等，会被规范化为 priority, customStatus
            const dbHasPriority = isValidValue(task.priority) || isValidValue(task.custom_priority);
            const dbHasPinned = isValidValue(task.pinned);
            const dbHasMilestone = isValidValue(task.milestone);
            const dbHasDuration = isValidValue(task.duration);
            const dbHasRemark = isValidValue(task.remark);
            const dbHasCompletionTime = isValidValue(task.completionTime) || isValidValue(task.completion_time);
            const dbHasTaskCompleteAt = isValidValue(task.taskCompleteAt) || isValidValue(task.task_complete_at);
            const dbHasCustomTime = isValidValue(task.customTime) || isValidValue(task.custom_time);
            const dbHasCustomStatus = isValidValue(task.customStatus) || isValidValue(task.custom_status);
            const dbHasRepeatRule = isValidValue(task.repeat_rule)
                || isValidValue(task?.[__TM_TASK_REPEAT_RULE_ATTR])
                || (typeof task.repeatRule === 'string' && isValidValue(task.repeatRule));
            const dbHasRepeatState = isValidValue(task.repeat_state)
                || isValidValue(task?.[__TM_TASK_REPEAT_STATE_ATTR])
                || (typeof task.repeatState === 'string' && isValidValue(task.repeatState));
            const dbHasRepeatHistory = isValidValue(task.repeat_history)
                || isValidValue(task?.[__TM_TASK_REPEAT_HISTORY_ATTR])
                || (typeof task.repeatHistory === 'string' && isValidValue(task.repeatHistory));
            const dbHasAttachments = __tmGetTaskAttachmentPaths(task).length > 0;

            // 只有当数据库没有有效值时，才使用 MetaStore 的缓存值
            if (!dbHasPriority && 'priority' in v && isValidValue(v.priority)) task.priority = v.priority;
            if (!dbHasPinned && 'pinned' in v && isValidValue(v.pinned)) task.pinned = v.pinned;
            if (!dbHasMilestone && 'milestone' in v && isValidValue(v.milestone)) task.milestone = v.milestone;
            if (!dbHasDuration && 'duration' in v && isValidValue(v.duration)) task.duration = v.duration;
            if (!dbHasRemark && 'remark' in v && isValidValue(v.remark)) task.remark = v.remark;
            if (!dbHasCompletionTime && allowVisibleDateFallback && 'completionTime' in v && isValidValue(v.completionTime)) task.completionTime = v.completionTime;
            if (!dbHasTaskCompleteAt && 'taskCompleteAt' in v && isValidValue(v.taskCompleteAt)) task.taskCompleteAt = v.taskCompleteAt;
            if (!dbHasCustomTime && allowVisibleDateFallback && 'customTime' in v && isValidValue(v.customTime)) task.customTime = v.customTime;
            if (!dbHasCustomStatus && allowCustomStatusFallback && 'customStatus' in v && isValidValue(v.customStatus)) task.customStatus = v.customStatus;
            if (!dbHasRepeatRule && Object.prototype.hasOwnProperty.call(v, 'repeatRule')) task.repeatRule = __tmNormalizeTaskRepeatRule(v.repeatRule, {
                startDate: task?.startDate,
                completionTime: task?.completionTime,
            });
            if (!dbHasRepeatState && Object.prototype.hasOwnProperty.call(v, 'repeatState')) task.repeatState = __tmNormalizeTaskRepeatState(v.repeatState);
            if (!dbHasRepeatHistory && Object.prototype.hasOwnProperty.call(v, 'repeatHistory')) task.repeatHistory = __tmNormalizeTaskRepeatHistory(v.repeatHistory);
            if (!dbHasAttachments && Object.prototype.hasOwnProperty.call(v, 'attachments')) __tmApplyTaskAttachmentPathsToTask(task, v.attachments);
            if (v.customFieldValues && typeof v.customFieldValues === 'object' && !Array.isArray(v.customFieldValues)) {
                const current = (task.customFieldValues && typeof task.customFieldValues === 'object' && !Array.isArray(task.customFieldValues))
                    ? task.customFieldValues
                    : {};
                task.customFieldValues = __tmNormalizeTaskCustomFieldValues(current, v.customFieldValues);
            }
        },

        mergeFromTaskIfMissing(task) {
            if (!task?.id) return;
            const existing = this.get(task.id);
            if (existing) return;
            const candidate = {};
            if (task.priority) candidate.priority = task.priority;
            if (task.pinned !== undefined) candidate.pinned = task.pinned;
            if (task.milestone !== undefined) candidate.milestone = task.milestone;
            if (task.duration) candidate.duration = task.duration;
            if (task.remark) candidate.remark = task.remark;
            if (task.completionTime) candidate.completionTime = task.completionTime;
            if (task.taskCompleteAt) candidate.taskCompleteAt = task.taskCompleteAt;
            if (task.customTime) candidate.customTime = task.customTime;
            if (task.customStatus) candidate.customStatus = task.customStatus;
            if (task.repeatRule && typeof task.repeatRule === 'object') candidate.repeatRule = __tmNormalizeTaskRepeatRule(task.repeatRule, {
                startDate: task?.startDate,
                completionTime: task?.completionTime,
            });
            if (task.repeatState && typeof task.repeatState === 'object') candidate.repeatState = __tmNormalizeTaskRepeatState(task.repeatState);
            if (Array.isArray(task.repeatHistory) && task.repeatHistory.length) candidate.repeatHistory = __tmNormalizeTaskRepeatHistory(task.repeatHistory);
            if (__tmGetTaskAttachmentPaths(task).length) candidate.attachments = __tmGetTaskAttachmentPaths(task);
            if (task.customFieldValues && typeof task.customFieldValues === 'object' && Object.keys(task.customFieldValues).length > 0) {
                candidate.customFieldValues = { ...task.customFieldValues };
            }
            if (Object.keys(candidate).length === 0) return;
            this.data[task.id] = candidate;
            this.scheduleSave();
        },

        set(id, patch) {
            if (!id) return;
            if (!this.data || typeof this.data !== 'object') this.data = {};
            const prev = (this.data[id] && typeof this.data[id] === 'object') ? this.data[id] : {};
            const nextPatch = (patch && typeof patch === 'object') ? { ...patch } : {};
            if (nextPatch.customFieldValues && typeof nextPatch.customFieldValues === 'object' && !Array.isArray(nextPatch.customFieldValues)) {
                const mergedCustomValues = {
                    ...((prev.customFieldValues && typeof prev.customFieldValues === 'object' && !Array.isArray(prev.customFieldValues)) ? prev.customFieldValues : {})
                };
                Object.entries(nextPatch.customFieldValues).forEach(([fieldId, rawValue]) => {
                    const field = __tmGetCustomFieldDefMap().get(String(fieldId || '').trim());
                    const normalized = __tmNormalizeCustomFieldValue(field, rawValue);
                    if (Array.isArray(normalized)) {
                        if (normalized.length) mergedCustomValues[fieldId] = normalized;
                        else delete mergedCustomValues[fieldId];
                        return;
                    }
                    if (String(normalized || '').trim()) mergedCustomValues[fieldId] = normalized;
                    else delete mergedCustomValues[fieldId];
                });
                nextPatch.customFieldValues = mergedCustomValues;
            }
            this.data[id] = { ...prev, ...nextPatch };
            this.scheduleSave();
        },

        remapId(oldId, newId) {
            if (!oldId || !newId || oldId === newId) return;
            if (!this.data || typeof this.data !== 'object') this.data = {};
            if (this.data[oldId] && !this.data[newId]) {
                this.data[newId] = this.data[oldId];
            }
            if (this.data[oldId]) delete this.data[oldId];
            this.scheduleSave();
        },

        scheduleSave() {
            try {
                if (this.saveTimer) clearTimeout(this.saveTimer);
            } catch (e) {}
            this.saveTimer = setTimeout(() => {
                this.saveTimer = null;
                this.saveNow();
            }, 500);
        },

        async saveNow() {
            if (this.saving) return;
            this.saving = true;
            try {
                Storage.set('tm_meta_cache', this.data || {});
                const formDir = new FormData();
                formDir.append('path', PLUGIN_STORAGE_DIR);
                formDir.append('isDir', 'true');
                await fetch('/api/file/putFile', { method: 'POST', body: formDir }).catch(() => null);

                const form = new FormData();
                form.append('path', META_FILE_PATH);
                form.append('isDir', 'false');
                form.append('file', new Blob([JSON.stringify(this.data || {}, null, 2)], { type: 'application/json' }));
                await fetch('/api/file/putFile', { method: 'POST', body: form });
            } catch (e) {} finally {
                this.saving = false;
            }
        }
    };

    const TM_TASK_PARENT_LOOKUP_DEPTH_DEFAULT = 0;
    const TM_TASK_PARENT_LOOKUP_DEPTH_MAX = 6;

    function __tmNormalizeTaskParentLookupDepth(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return TM_TASK_PARENT_LOOKUP_DEPTH_DEFAULT;
        return Math.max(0, Math.min(TM_TASK_PARENT_LOOKUP_DEPTH_MAX, Math.round(n)));
    }

    // 设置存储（使用云端同步存储，支持跨设备同步）
    const SettingsStore = {
        data: {
            settingsUpdatedAt: 0,
            settingsFieldUpdatedAt: {},
            docGroupSettingsUpdatedAt: 0,
            collapseStateUpdatedAt: 0,
            selectedDocIds: [],
            queryLimit: __TM_TASK_INDEX_QUERY_LIMIT,
            recursiveDocLimit: 2000,
            legacyWin7CompatMode: false,
            taskParentLookupDepth: TM_TASK_PARENT_LOOKUP_DEPTH_DEFAULT,
            groupByDocName: true,
            groupByTime: false,
            defaultViewMode: 'checklist',
            defaultViewModeMobile: 'checklist',
            dockSidebarEnabled: true,
            dockDefaultViewMode: 'follow-mobile',
            dockChecklistCompactTitleJump: true,
            mobileChecklistCompactTitleJump: true,
            desktopChecklistCompactMetaFields: ['completionTime', 'status'],
            dockChecklistCompactMetaFields: ['completionTime', 'status'],
            mobileChecklistCompactMetaFields: ['completionTime', 'status'],
            checklistCompactRightFontSize: 'large',
            checklistCompactTitleOpenDetailPage: false,
            enabledViews: ['list', 'checklist', 'timeline', 'kanban', 'calendar', 'whiteboard'],
            kanbanCompactMode: false,
            checklistCompactMode: true,
            checklistCompactTreeGuides: false,
            checklistCompactTreeGuidesUpdatedAt: 0,
            kanbanColumnWidth: 320,
            kanbanFillColumns: false,
            kanbanShowDoneColumn: false,
            kanbanDragSyncSubtasks: true,
            kanbanCardFields: ['priority', 'status', 'date'],
            taskCardDateOnlyWithValue: false,
            kanbanHeadingGroupMode: false,
            whiteboardAllTabsCardMinWidth: 320,
            whiteboardStreamMobileTwoColumns: true,
            docH2SubgroupEnabled: true,
            groupByTaskName: false,
            groupMode: 'doc',
            collapsedTaskIds: [],
            kanbanCollapsedTaskIds: [],
            collapsedGroups: [],
            expandedCompletedGroups: [],
            currentRule: null,
            viewProfiles: {
                global: { ruleId: null, groupMode: 'doc' },
                allTabs: {},
                groups: {},
                docs: {}
            },
            filterRules: [],
            fontSize: 14,
            fontSizeMobile: 14,
            rowHeightMode: 'normal',
            rowHeightPx: 0,
            taskAutoWrapEnabled: true,
            taskContentWrapMaxLines: 3,
            taskRemarkWrapMaxLines: 2,
            enableQuickbar: true,
            taskDoneDelightEnabled: true,
            aiEnabled: false,
            aiProvider: 'minimax',
            aiMiniMaxApiKey: '',
            aiMiniMaxBaseUrl: 'https://api.minimaxi.com/anthropic',
            aiMiniMaxModel: 'MiniMax-M2.5',
            aiDeepSeekApiKey: '',
            aiDeepSeekBaseUrl: 'https://api.deepseek.com',
            aiDeepSeekModel: 'deepseek-chat',
            aiMiniMaxTemperature: 0.2,
            aiMiniMaxMaxTokens: 1600,
            aiMiniMaxTimeoutMs: 30000,
            aiDefaultContextMode: 'nearby',
            aiScheduleWindows: ['09:00-18:00'],
            aiSideDockEnabled: true,
            pinNewTasksByDefault: false,
            enableMoveBlockToDailyNote: false,
            taskDetailCompletedSubtasksVisibilityByTask: {},
            newTaskDocId: '',
            newTaskDailyNoteNotebookId: '',
            newTaskDailyNoteAppendToBottom: false,
            quickAddRecentDocs: [],
            headingGroupCreateAtSectionEnd: false,
            enableTomatoIntegration: true,
            enablePointsRewardIntegration: false,
            enablePointsPenaltyIntegration: false,
            pointsPenaltyScheduleEnabled: true,
            pointsPenaltyDeadlineEnabled: true,
            pointsPenaltyScheduleAmount: 20,
            pointsPenaltyDeadlineAmount: 30,
            pointsPenaltyCheckTimes: ['23:00', '+1 08:00'],
            pointsPenaltyCheckOnStartup: false,
            pointsPenaltyConfirmModalEnabled: true,
            tomatoSpentAttrMode: 'minutes',
            tomatoSpentAttrKeyMinutes: 'custom-tomato-minutes',
            tomatoSpentAttrKeyHours: 'custom-tomato-time',
            calendarEnabled: true,
            calendarLinkDockTomato: true,
            calendarInitialView: 'timeGridWeek',
            calendarFirstDay: 1,
            calendarMonthAggregate: true,
            calendarMonthAdaptiveRowHeight: true,
            calendarMonthMinVisibleEvents: 3,
            calendarShowSchedule: true,
            calendarScheduleReminderEnabled: true,
            calendarScheduleReminderSystemEnabled: true,
            calendarScheduleReminderDefaultMode: '0',
            calendarAllDayReminderEnabled: true,
            calendarAllDayReminderTime: '09:00',
            calendarTaskDateAllDayReminderEnabled: true,
            calendarAllDaySummaryIncludeExtras: true,
            calendarShowFocus: true,
            calendarShowBreak: true,
            calendarShowStopwatch: true,
            calendarShowIdle: false,
            calendarColorFocus: 'var(--tm-primary-color)',
            calendarColorBreak: 'var(--tm-success-color)',
            calendarColorStopwatch: 'var(--tm-warning-color, #f9ab00)',
            calendarColorIdle: 'var(--tm-secondary-text)',
            calendarCalendarsConfig: {},
            calendarDefaultCalendarId: 'default',
            calendarLastViewType: '',
            calendarLastDate: '',
            calendarSidebarWidth: 280,
            calendarSidebarDefaultPage: 'calendar',
            calendarSidebarCollapsedDesktopDefault: false,
            calendarColumnWidths: { content: 140, duration: 60, spent: 60 },
            calendarSidebarCollapseCalendars: false,
            calendarSidebarCollapseDocGroups: false,
            calendarSidebarCollapseTomato: false,
            calendarSidebarCollapseTasks: false,
            calendarShowTomatoMaster: true,
            calendarShowTaskDates: true,
            calendarHideScheduledTaskDatesInAllDay: false,
            calendarShowOtherBlockCheckbox: true,
            calendarTaskDateColorMode: 'group',
            calendarScheduleFollowDocColor: false,
            calendar3DayTodayPosition: 1,
            calendarNewScheduleMaxDurationMin: 60,
            calendarQuickAddScheduleTimeMode: 'current',
            calendarQuickAddScheduleCustomTime: '09:00',
            calendarHourSlotHeightMode: 'normal',
            calendarVisibleStartTime: '00:00',
            calendarVisibleEndTime: '24:00',
            calendarScheduleColor: '',
            calendarTaskDatesColor: '#6b7280',
            calendarShowCnHoliday: true,
            calendarCnHolidayColor: '#ff3333',
            calendarShowLunar: false,
            calendarSideDockEnabled: false,
            calendarSideDockWidth: 340,
            checklistDetailWidth: 320,
            docTopbarButtonDesktop: true,
            docTopbarButtonMobile: true,
            docTopbarButtonSwapPressActions: false,
            docTopbarButtonLocateCurrentDocTab: false,
            windowTopbarIconDesktop: true,
            windowTopbarIconMobile: true,
            semanticDateAutoPromptEnabled: true,
            defaultDocId: '',
            defaultDocIdByGroup: {},
            allDocsExcludedDocIds: [],
            // 默认状态选项
            customStatusOptions: [
                { id: 'todo', name: '待办', color: '#757575', marker: ' ' },
                { id: 'done', name: '已完成', color: '#4CAF50', marker: 'X' },
                { id: 'cancelled', name: '已取消', color: '#9E9E9E', marker: '-' },
                { id: 'blocked', name: '阻塞', color: '#F44336', marker: ' ' },
                { id: 'review', name: '待审核', color: '#FF9800', marker: ' ' }
            ],
            customDurationOptions: [],
            checkboxDoneStatusId: 'done',
            checkboxUndoneStatusId: 'todo',
            customFieldDefs: [],
            customFieldDefsVersion: 0,
            // 文档分组配置
            // 结构: [{ id: 'uuid', name: '分组名', docs: [{ id: 'docId', recursive: boolean }] }]
            docGroups: [],
            // 旧版全局其他块页签收集项（兼容迁移到分组内 otherBlockRefs）
            // 结构: [{ id: 'blockId' }]
            otherBlockRefs: [],
            // 文档页签钉住（按分组存储）
            // 结构: { [groupId]: ['docId1', 'docId2'] }
            docPinnedByGroup: {},
            // 文档页签排序：created_desc | created_asc | deadline_desc | deadline_asc | name_asc | name_desc
            docTabSortMode: 'created_desc',
            // 文档显示名称：name | alias
            docDisplayNameMode: 'name',
            // 当前选中的分组ID (UI显示用)
            currentGroupId: 'all',
            // 任务标题级别 (h1-h6)
            taskHeadingLevel: 'h2',
            // 时长显示格式: 'hours' 或 'minutes'
            durationFormat: 'hours',
            // 默认隐藏已完成任务（仅视图过滤，任务仍会进入索引）
            excludeCompletedTasks: true,
            showCompletedTasks: false,
            // 开始日期（新增列）
            startDate: 90,
            // 时间轴模式左侧宽度
            timelineLeftWidth: 540,
            timelineSidebarCollapsed: false,
            // 时间轴模式任务内容列宽度（不影响表格视图）
            timelineContentWidth: 360,
            timelineCardFields: ['title', 'status'],
            timelineForceSortByCompletionNearToday: false,
            groupSortByBestSubtaskTimeInTimeQuadrant: false,
            // 白板视图
            whiteboardLinks: [],
            whiteboardAutoConnectByCreated: false,
            whiteboardDetachedChildren: {},
            whiteboardNotes: [],
            whiteboardTool: 'pan',
            whiteboardSidebarCollapsed: false,
            whiteboardSidebarWidth: 300,
            whiteboardShowDone: false,
            whiteboardNavigatorHidden: false,
            whiteboardCardFields: ['priority', 'status', 'date'],
            whiteboardView: { x: 64, y: 40, zoom: 1 },
            whiteboardNodePos: {},
            whiteboardAutoLayout: false,
            whiteboardPlacedTaskIds: {},
            whiteboardStateVersion: 0,
            whiteboardDocFrameSize: {},
            whiteboardAllTabsLayoutMode: 'board',
            whiteboardAllTabsDocOrderByGroup: {},
            whiteboardSequenceMode: false,
            collapseAllIncludesGroups: false,
            serverSyncOnManualRefresh: false,
            serverSyncSessionStateOnManualRefresh: false,
            docColorMap: {},
            docColorSeed: 1,
            docDefaultColorScheme: {
                palette: 'random',
                seed: 1,
                baseColor: '#3b82f6'
            },
            themeConfig: {
                source: 'preset',
                presetId: 'task-horizon-slate',
                importName: '',
                importLight: {},
                importDark: {}
            },
            priorityIconStyle: 'jira',
            // 外观配色（支持亮/暗）
            topbarGradientLightStart: '#E3ECF2',
            topbarGradientLightEnd: '#E3ECF2',
            topbarGradientDarkStart: '#2D2D2D',
            topbarGradientDarkEnd: '#2D2D2D',
            topbarTextColorLight: '#003252',
            topbarTextColorDark: '#FFFFFF',
            topbarControlBgLight: '',
            topbarControlBgDark: '',
            topbarControlTextLight: '',
            topbarControlTextDark: '',
            topbarControlBorderLight: '',
            topbarControlBorderDark: '',
            topbarControlHoverLight: '',
            topbarControlHoverDark: '',
            topbarControlSegmentBgLight: '',
            topbarControlSegmentBgDark: '',
            topbarControlSegmentActiveBgLight: '',
            topbarControlSegmentActiveBgDark: '',
            topbarControlShadowColorLight: '',
            topbarControlShadowColorDark: '',
            topbarControlRadiusPx: 10,
            topbarControlBorderWidthPx: 1,
            topbarControlShadowYOffsetPx: 0,
            topbarControlShadowBlurPx: 0,
            topbarControlShadowStrengthPct: 100,
            taskContentColorLight: 'var(--foreground)',
            taskContentColorDark: 'var(--foreground)',
            taskMetaColorLight: 'var(--muted-foreground)',
            taskMetaColorDark: 'var(--muted-foreground)',
            groupDocLabelColorLight: 'var(--foreground)',
            groupDocLabelColorDark: 'var(--foreground)',
            timeGroupBaseColorLight: 'var(--tm-primary-color)',
            timeGroupBaseColorDark: 'var(--tm-primary-color)',
            timeGroupOverdueColorLight: 'var(--tm-danger-color)',
            timeGroupOverdueColorDark: 'var(--tm-danger-color)',
            timeGroupPendingTaskBgColorLight: 'var(--tm-secondary-text)',
            timeGroupPendingTaskBgColorDark: 'var(--tm-secondary-text)',
            progressBarColorLight: 'var(--tm-success-color)',
            progressBarColorDark: 'var(--tm-success-color)',
            calendarTodayHighlightColorLight: '',
            calendarTodayHighlightColorDark: '',
            calendarGridBorderColorLight: 'var(--border)',
            calendarGridBorderColorDark: 'var(--border)',
            tableBorderColorLight: 'var(--border)',
            tableBorderColorDark: 'var(--border)',
            enableGroupTaskBgByGroupColor: true,
            enableQuickbarInlineMeta: false,
            quickbarInlineFields: ['custom-status', 'custom-completion-time'],
            quickbarVisibleItems: ['custom-status', 'custom-priority', 'custom-start-date', 'custom-completion-time', 'custom-duration', 'custom-remark', 'action-ai-title', 'action-reminder', 'action-more'],
            quickbarInlineShowOnMobile: false,
            priorityScoreConfig: {
                base: 100,
                weights: { importance: 1, status: 1, due: 1, duration: 1, doc: 1 },
                importanceDelta: { high: 20, medium: 10, low: -5, none: 0 },
                statusDelta: { todo: 0, in_progress: 15, done: -80, blocked: -10, review: 5 },
                dueRanges: [
                    { days: 0, delta: 20 },
                    { days: 1, delta: 15 },
                    { days: 3, delta: 10 },
                    { days: 7, delta: 5 },
                    { days: 30, delta: 0 }
                ],
                durationBuckets: [
                    { maxMinutes: 15, delta: 10 },
                    { maxMinutes: 60, delta: 0 },
                    { maxMinutes: 240, delta: -5 },
                    { maxMinutes: 999999, delta: -10 }
                ],
                docDeltas: {}
            },
            // 四象限分组配置
            quadrantConfig: {
                enabled: false,
                rules: [
                    {
                        id: 'urgent-important',
                        name: '重要紧急',
                        color: 'red',
                        importance: ['high', 'medium'],
                        timeRanges: ['overdue', 'within7days']
                    },
                    {
                        id: 'not-urgent-important',
                        name: '重要不紧急',
                        color: 'yellow',
                        importance: ['high', 'medium'],
                        timeRanges: ['beyond7days', 'nodate']
                    },
                    {
                        id: 'urgent-not-important',
                        name: '不重要紧急',
                        color: 'blue',
                        importance: ['low', 'none'],
                        timeRanges: ['overdue', 'within7days']
                    },
                    {
                        id: 'not-urgent-not-important',
                        name: '不重要不紧急',
                        color: 'green',
                        importance: ['low', 'none'],
                        timeRanges: ['beyond7days', 'nodate']
                    }
                ]
            },
            // 列宽度设置（像素）
            columnWidths: { ...__TM_BUILTIN_COLUMN_WIDTHS },
            // 列顺序设置（注意：startDate 在 completionTime 前面）
            columnOrder: __TM_BUILTIN_COLUMN_DEFAULT_ORDER.slice(),
            // 隐藏列设置
            hiddenColumns: null
        },
        loaded: false,
        saving: false,
        saveTimer: null,
        saveDirty: false,
        savePromise: null,
        savePromiseResolve: null,
        savePromiseReject: null,
        loadedWhiteboardStateVersion: 0,
        lastWhiteboardFingerprint: '',
        loadedDocGroupUpdatedAt: 0,
        loadedDocGroupFingerprint: '',
        loadedCollapseUpdatedAt: 0,
        loadedCollapseFingerprint: '',
        loadedCustomFieldDefsVersion: 0,
        lastCustomFieldDefsFingerprint: '',
        loadedCustomFieldDefsSnapshot: [],
        loadedSettingsFieldSnapshot: {},
        loadedSettingsFieldUpdatedAt: {},

        refreshDocGroupSyncState(updatedAt = null) {
            const resolvedUpdatedAt = __tmParseUpdatedAtNumber(updatedAt);
            const nextUpdatedAt = resolvedUpdatedAt > 0
                ? resolvedUpdatedAt
                : __tmGetDocGroupSettingsUpdatedAt(this.data);
            this.data.docGroupSettingsUpdatedAt = nextUpdatedAt;
            this.loadedDocGroupUpdatedAt = nextUpdatedAt;
            this.loadedDocGroupFingerprint = __tmBuildDocGroupSyncFingerprint(this.data);
        },

        refreshCustomFieldSyncState() {
            this.data.customFieldDefsVersion = __tmParseVersionNumber(this.data.customFieldDefsVersion);
            try { __tmInvalidateCustomFieldDefsRuntimeCache(); } catch (e) {}
            this.loadedCustomFieldDefsVersion = this.data.customFieldDefsVersion;
            this.lastCustomFieldDefsFingerprint = __tmGetCustomFieldDefsFingerprint(this.data.customFieldDefs);
            this.loadedCustomFieldDefsSnapshot = __tmCloneCustomFieldDefs(this.data.customFieldDefs);
        },

        refreshCollapsedStateSyncState(updatedAt = null) {
            const next = __tmAssignCollapsedSessionState(this.data, this.data);
            this.loadedCollapseFingerprint = __tmGetCollapsedSessionStateFingerprint(next);
            const resolvedUpdatedAt = __tmParseUpdatedAtNumber(updatedAt);
            this.data.collapseStateUpdatedAt = resolvedUpdatedAt > 0
                ? resolvedUpdatedAt
                : __tmGetCollapsedSessionUpdatedAt(this.data);
            this.loadedCollapseUpdatedAt = resolvedUpdatedAt > 0
                ? resolvedUpdatedAt
                : __tmGetCollapsedSessionUpdatedAt(this.data);
        },

        refreshSettingsFieldSyncState() {
            this.data.settingsFieldUpdatedAt = __tmNormalizeSettingsFieldUpdatedAtMap(this.data.settingsFieldUpdatedAt, this.data);
            this.loadedSettingsFieldUpdatedAt = __tmCloneJsonSafe(this.data.settingsFieldUpdatedAt, {});
            this.loadedSettingsFieldSnapshot = __tmBuildSettingsFieldSyncSnapshot(this.data);
        },

        migrateLegacyTopbarDefaults() {
            const legacyDefaults = {
                topbarGradientLightStart: '#667eea',
                topbarGradientLightEnd: '#764ba2',
                topbarGradientDarkStart: '#3b49b7',
                topbarGradientDarkEnd: '#5b2d7a',
                topbarTextColorLight: '#ffffff',
                topbarTextColorDark: '#ffffff',
            };
            const currentDefaults = {
                topbarGradientLightStart: '#E3ECF2',
                topbarGradientLightEnd: '#E3ECF2',
                topbarGradientDarkStart: '#2D2D2D',
                topbarGradientDarkEnd: '#2D2D2D',
                topbarTextColorLight: '#003252',
                topbarTextColorDark: '#FFFFFF',
            };
            let changed = false;
            Object.keys(legacyDefaults).forEach((key) => {
                const current = String(this.data?.[key] || '').trim().toLowerCase();
                const legacy = String(legacyDefaults[key] || '').trim().toLowerCase();
                if (!current || current !== legacy) return;
                this.data[key] = currentDefaults[key];
                changed = true;
            });
            return changed;
        },

        buildCloudPayload() {
            let payload = {};
            try {
                payload = JSON.parse(JSON.stringify(this.data || {}));
            } catch (e) {
                payload = { ...(this.data || {}) };
            }
            return payload;
        },

        async load() {
            if (this.loaded) return;

            // 先从本地缓存加载一份作为兜底（避免云端旧版本配置缺字段导致覆盖丢失）
            // 云端数据存在时，再用云端字段覆盖本地字段
            try { this.loadFromLocal(); } catch (e) {}

            // 从云端加载设置（优先）
            try {
                const res = await fetch('/api/file/getFile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: SETTINGS_FILE_PATH }),
                });

                if (res.ok) {
                    const text = await res.text();
                    // 如果文件内容有效且有数据
                    if (text && text.trim() !== '') {
                        try {
                            const cloudData = JSON.parse(text);
                            if (cloudData && typeof cloudData === 'object' && Object.keys(cloudData).length > 0) {
                                const localSettingsBeforeCloud = __tmCloneJsonSafe(this.data, { ...(this.data || {}) });
                                const localSettingsUpdatedAt = Number(this.data.settingsUpdatedAt) || 0;
                                const cloudSettingsUpdatedAt = Number(cloudData.settingsUpdatedAt) || 0;
                                const shouldApplyCloudDocGroupState = __tmShouldPreferRemoteDocGroupState(this.data, cloudData, {
                                    localSettingsUpdatedAt,
                                    remoteSettingsUpdatedAt: cloudSettingsUpdatedAt,
                                    groupId: this.data.currentGroupId,
                                    allowSettingsFallback: true,
                                });
                                const localCollapseUpdatedAt = __tmGetCollapsedSessionUpdatedAt(this.data);
                                const cloudCollapseUpdatedAt = __tmGetCollapsedSessionUpdatedAt(cloudData);
                                const localWhiteboardStateVersion = __tmParseVersionNumber(this.data.whiteboardStateVersion);
                                const cloudWhiteboardStateVersion = __tmParseVersionNumber(cloudData.whiteboardStateVersion);
                                const localCustomFieldDefsVersion = __tmParseVersionNumber(this.data.customFieldDefsVersion);
                                const cloudCustomFieldDefsVersion = __tmParseVersionNumber(cloudData.customFieldDefsVersion);
                                const resolvedCustomFieldSchema = __tmResolveCustomFieldDefsOnLoad(
                                    this.data.customFieldDefs,
                                    cloudData.customFieldDefs,
                                    {
                                        localVersion: localCustomFieldDefsVersion,
                                        remoteVersion: cloudCustomFieldDefsVersion,
                                    }
                                );
                                if (localSettingsUpdatedAt > 0 && cloudSettingsUpdatedAt < localSettingsUpdatedAt) {
                                    if (cloudCollapseUpdatedAt > localCollapseUpdatedAt) {
                                        __tmAssignCollapsedSessionState(this.data, cloudData);
                                        this.data.collapseStateUpdatedAt = cloudCollapseUpdatedAt;
                                    }
                                    if (shouldApplyCloudDocGroupState) {
                                        __tmApplyDocGroupSyncSnapshot(cloudData, {
                                            targetData: this.data,
                                            syncOverallUpdatedAt: false,
                                        });
                                    }
                                    __tmApplySettingsFieldUpdatesByMap(this.data, cloudData);
                                    if (cloudWhiteboardStateVersion > localWhiteboardStateVersion) {
                                        __tmApplyMergedWhiteboardContentState(this.data, cloudData);
                                    }
                                    {
                                        const cloudTreeGuidesUpdatedAt = __tmParseUpdatedAtNumber(cloudData.checklistCompactTreeGuidesUpdatedAt)
                                            || (typeof cloudData.checklistCompactTreeGuides === 'boolean' ? cloudSettingsUpdatedAt : 0);
                                        const localTreeGuidesUpdatedAt = __tmParseUpdatedAtNumber(this.data.checklistCompactTreeGuidesUpdatedAt);
                                        if (typeof cloudData.checklistCompactTreeGuides === 'boolean' && cloudTreeGuidesUpdatedAt > localTreeGuidesUpdatedAt) {
                                            this.data.checklistCompactTreeGuides = cloudData.checklistCompactTreeGuides;
                                            this.data.checklistCompactTreeGuidesUpdatedAt = cloudTreeGuidesUpdatedAt;
                                        }
                                    }
                                    this.data.customFieldDefs = resolvedCustomFieldSchema.defs;
                                    this.data.customFieldDefsVersion = resolvedCustomFieldSchema.version;
                                    const migratedLegacyTopbarDefaults = this.migrateLegacyTopbarDefaults();
                                    __tmEnsureDocGroupContextValidAfterSync();
                                    this.normalizeColumns();
                                    this.syncToLocal();
                                    this.loadedWhiteboardStateVersion = __tmParseVersionNumber(this.data.whiteboardStateVersion);
                                    this.lastWhiteboardFingerprint = __tmGetWhiteboardSettingsFingerprint(this.data);
                                    this.refreshDocGroupSyncState(this.data.docGroupSettingsUpdatedAt);
                                    this.refreshCustomFieldSyncState();
                                    this.refreshCollapsedStateSyncState();
                                    this.refreshSettingsFieldSyncState();
                                    this.loaded = true;
                                    if (migratedLegacyTopbarDefaults) {
                                        try { await this.save(); } catch (e) {}
                                    }
                                    return;
                                }
                                if (cloudSettingsUpdatedAt > 0) this.data.settingsUpdatedAt = cloudSettingsUpdatedAt;
                                {
                                    const cloudFieldMap = __tmNormalizeSettingsFieldUpdatedAtMap(cloudData.settingsFieldUpdatedAt, cloudData);
                                    this.data.settingsFieldUpdatedAt = __tmLooksLegacySeededSettingsFieldMap(cloudFieldMap, cloudData) ? {} : cloudFieldMap;
                                }
                                if (cloudCollapseUpdatedAt > 0) this.data.collapseStateUpdatedAt = cloudCollapseUpdatedAt;
                                // 应用云端数据
                                if (shouldApplyCloudDocGroupState && Array.isArray(cloudData.selectedDocIds)) this.data.selectedDocIds = cloudData.selectedDocIds;
                                if (typeof cloudData.queryLimit === 'number') this.data.queryLimit = __TM_TASK_INDEX_QUERY_LIMIT;
                                if (typeof cloudData.recursiveDocLimit === 'number') this.data.recursiveDocLimit = cloudData.recursiveDocLimit;
                                if (typeof cloudData.legacyWin7CompatMode === 'boolean') this.data.legacyWin7CompatMode = cloudData.legacyWin7CompatMode;
                                if (typeof cloudData.taskParentLookupDepth === 'number') this.data.taskParentLookupDepth = __tmNormalizeTaskParentLookupDepth(cloudData.taskParentLookupDepth);
                                if (typeof cloudData.groupByDocName === 'boolean') this.data.groupByDocName = cloudData.groupByDocName;
                                if (typeof cloudData.groupByTime === 'boolean') this.data.groupByTime = cloudData.groupByTime;
                                if (typeof cloudData.defaultViewMode === 'string') this.data.defaultViewMode = cloudData.defaultViewMode;
                                if (typeof cloudData.defaultViewModeMobile === 'string') this.data.defaultViewModeMobile = cloudData.defaultViewModeMobile;
                                if (typeof cloudData.dockSidebarEnabled === 'boolean') this.data.dockSidebarEnabled = cloudData.dockSidebarEnabled;
                                if (typeof cloudData.dockDefaultViewMode === 'string') this.data.dockDefaultViewMode = cloudData.dockDefaultViewMode;
                                if (typeof cloudData.dockChecklistCompactTitleJump === 'boolean') this.data.dockChecklistCompactTitleJump = cloudData.dockChecklistCompactTitleJump;
                                if (typeof cloudData.mobileChecklistCompactTitleJump === 'boolean') {
                                    this.data.mobileChecklistCompactTitleJump = cloudData.mobileChecklistCompactTitleJump;
                                } else {
                                    this.data.mobileChecklistCompactTitleJump = this.data.dockChecklistCompactTitleJump;
                                }
                                if (Array.isArray(cloudData.desktopChecklistCompactMetaFields)) this.data.desktopChecklistCompactMetaFields = cloudData.desktopChecklistCompactMetaFields;
                                if (Array.isArray(cloudData.dockChecklistCompactMetaFields)) this.data.dockChecklistCompactMetaFields = cloudData.dockChecklistCompactMetaFields;
                                if (Array.isArray(cloudData.mobileChecklistCompactMetaFields)) this.data.mobileChecklistCompactMetaFields = cloudData.mobileChecklistCompactMetaFields;
                                if (typeof cloudData.checklistCompactRightFontSize === 'string') this.data.checklistCompactRightFontSize = __tmNormalizeChecklistCompactRightFontSize(cloudData.checklistCompactRightFontSize);
                                if (typeof cloudData.checklistCompactTitleOpenDetailPage === 'boolean') this.data.checklistCompactTitleOpenDetailPage = cloudData.checklistCompactTitleOpenDetailPage;
                                if (Array.isArray(cloudData.enabledViews)) this.data.enabledViews = __tmNormalizeEnabledViews(cloudData.enabledViews);
                                if (typeof cloudData.kanbanCompactMode === 'boolean') this.data.kanbanCompactMode = cloudData.kanbanCompactMode;
                                if (typeof cloudData.checklistCompactMode === 'boolean') this.data.checklistCompactMode = cloudData.checklistCompactMode;
                                if (typeof cloudData.checklistCompactTreeGuides === 'boolean') this.data.checklistCompactTreeGuides = cloudData.checklistCompactTreeGuides;
                                if (typeof cloudData.checklistCompactTreeGuides === 'boolean') {
                                    this.data.checklistCompactTreeGuidesUpdatedAt = __tmParseUpdatedAtNumber(cloudData.checklistCompactTreeGuidesUpdatedAt) || cloudSettingsUpdatedAt;
                                }
                                if (typeof cloudData.kanbanColumnWidth === 'number') this.data.kanbanColumnWidth = cloudData.kanbanColumnWidth;
                                if (typeof cloudData.kanbanFillColumns === 'boolean') this.data.kanbanFillColumns = cloudData.kanbanFillColumns;
                                if (typeof cloudData.kanbanShowDoneColumn === 'boolean') this.data.kanbanShowDoneColumn = cloudData.kanbanShowDoneColumn;
                                if (typeof cloudData.kanbanDragSyncSubtasks === 'boolean') this.data.kanbanDragSyncSubtasks = cloudData.kanbanDragSyncSubtasks;
                                if (Array.isArray(cloudData.kanbanCardFields)) this.data.kanbanCardFields = cloudData.kanbanCardFields;
                                if (typeof cloudData.kanbanHeadingGroupMode === 'boolean') this.data.kanbanHeadingGroupMode = cloudData.kanbanHeadingGroupMode;
                                if (typeof cloudData.whiteboardAllTabsCardMinWidth === 'number') this.data.whiteboardAllTabsCardMinWidth = cloudData.whiteboardAllTabsCardMinWidth;
                                if (typeof cloudData.whiteboardStreamMobileTwoColumns === 'boolean') this.data.whiteboardStreamMobileTwoColumns = cloudData.whiteboardStreamMobileTwoColumns;
                                if (typeof cloudData.docH2SubgroupEnabled === 'boolean') this.data.docH2SubgroupEnabled = cloudData.docH2SubgroupEnabled;
                                if (typeof cloudData.groupByTaskName === 'boolean') this.data.groupByTaskName = cloudData.groupByTaskName;
                                if (typeof cloudData.groupMode === 'string') this.data.groupMode = cloudData.groupMode;
                                if (cloudCollapseUpdatedAt >= localCollapseUpdatedAt) {
                                    if (Array.isArray(cloudData.collapsedTaskIds)) this.data.collapsedTaskIds = cloudData.collapsedTaskIds;
                                    if (Array.isArray(cloudData.kanbanCollapsedTaskIds)) this.data.kanbanCollapsedTaskIds = cloudData.kanbanCollapsedTaskIds;
                                    if (Array.isArray(cloudData.collapsedGroups)) this.data.collapsedGroups = cloudData.collapsedGroups;
                                    if (Array.isArray(cloudData.expandedCompletedGroups)) this.data.expandedCompletedGroups = cloudData.expandedCompletedGroups;
                                }
                                if (cloudData.currentRule !== undefined) this.data.currentRule = cloudData.currentRule;
                                if (cloudData.viewProfiles !== undefined) this.data.viewProfiles = cloudData.viewProfiles;
                                if (Array.isArray(cloudData.filterRules)) this.data.filterRules = cloudData.filterRules;
                                if (typeof cloudData.fontSize === 'number') this.data.fontSize = cloudData.fontSize;
                                if (typeof cloudData.fontSizeMobile === 'number') this.data.fontSizeMobile = cloudData.fontSizeMobile;
                                if (typeof cloudData.rowHeightMode === 'string') this.data.rowHeightMode = cloudData.rowHeightMode;
                                if (typeof cloudData.rowHeightPx === 'number') this.data.rowHeightPx = cloudData.rowHeightPx;
                                if (typeof cloudData.taskAutoWrapEnabled === 'boolean') this.data.taskAutoWrapEnabled = cloudData.taskAutoWrapEnabled;
                                if (typeof cloudData.taskContentWrapMaxLines === 'number') this.data.taskContentWrapMaxLines = cloudData.taskContentWrapMaxLines;
                                if (typeof cloudData.taskRemarkWrapMaxLines === 'number') this.data.taskRemarkWrapMaxLines = cloudData.taskRemarkWrapMaxLines;
                                if (typeof cloudData.enableQuickbar === 'boolean') this.data.enableQuickbar = cloudData.enableQuickbar;
                                if (typeof cloudData.taskDoneDelightEnabled === 'boolean') this.data.taskDoneDelightEnabled = cloudData.taskDoneDelightEnabled;
                                if (typeof cloudData.enableQuickbarInlineMeta === 'boolean') this.data.enableQuickbarInlineMeta = cloudData.enableQuickbarInlineMeta;
                                if (typeof cloudData.enableMoveBlockToDailyNote === 'boolean') this.data.enableMoveBlockToDailyNote = cloudData.enableMoveBlockToDailyNote;
                                if (Array.isArray(cloudData.quickbarInlineFields)) this.data.quickbarInlineFields = cloudData.quickbarInlineFields;
                                if (Array.isArray(cloudData.quickbarVisibleItems)) this.data.quickbarVisibleItems = cloudData.quickbarVisibleItems;
                                if (typeof cloudData.quickbarInlineShowOnMobile === 'boolean') this.data.quickbarInlineShowOnMobile = cloudData.quickbarInlineShowOnMobile;
                                if (typeof cloudData.aiSideDockEnabled === 'boolean') this.data.aiSideDockEnabled = cloudData.aiSideDockEnabled;
                                if (typeof cloudData.pinNewTasksByDefault === 'boolean') this.data.pinNewTasksByDefault = cloudData.pinNewTasksByDefault;
                                if (cloudData.taskDetailCompletedSubtasksVisibilityByTask && typeof cloudData.taskDetailCompletedSubtasksVisibilityByTask === 'object') {
                                    this.data.taskDetailCompletedSubtasksVisibilityByTask = cloudData.taskDetailCompletedSubtasksVisibilityByTask;
                                }
                                if (typeof cloudData.newTaskDocId === 'string') this.data.newTaskDocId = cloudData.newTaskDocId;
                                if (typeof cloudData.newTaskDailyNoteNotebookId === 'string') this.data.newTaskDailyNoteNotebookId = cloudData.newTaskDailyNoteNotebookId;
                                if (typeof cloudData.newTaskDailyNoteAppendToBottom === 'boolean') this.data.newTaskDailyNoteAppendToBottom = cloudData.newTaskDailyNoteAppendToBottom;
                                if (Array.isArray(cloudData.quickAddRecentDocs)) this.data.quickAddRecentDocs = __tmNormalizeQuickAddRecentDocs(cloudData.quickAddRecentDocs);
                                if (typeof cloudData.headingGroupCreateAtSectionEnd === 'boolean') this.data.headingGroupCreateAtSectionEnd = cloudData.headingGroupCreateAtSectionEnd;
                                if (typeof cloudData.enableTomatoIntegration === 'boolean') this.data.enableTomatoIntegration = cloudData.enableTomatoIntegration;
                                if (typeof cloudData.enablePointsRewardIntegration === 'boolean') this.data.enablePointsRewardIntegration = cloudData.enablePointsRewardIntegration;
                                if (typeof cloudData.enablePointsPenaltyIntegration === 'boolean') this.data.enablePointsPenaltyIntegration = cloudData.enablePointsPenaltyIntegration;
                                if (typeof cloudData.pointsPenaltyScheduleEnabled === 'boolean') this.data.pointsPenaltyScheduleEnabled = cloudData.pointsPenaltyScheduleEnabled;
                                if (typeof cloudData.pointsPenaltyDeadlineEnabled === 'boolean') this.data.pointsPenaltyDeadlineEnabled = cloudData.pointsPenaltyDeadlineEnabled;
                                if (typeof cloudData.pointsPenaltyScheduleAmount === 'number') this.data.pointsPenaltyScheduleAmount = cloudData.pointsPenaltyScheduleAmount;
                                if (typeof cloudData.pointsPenaltyDeadlineAmount === 'number') this.data.pointsPenaltyDeadlineAmount = cloudData.pointsPenaltyDeadlineAmount;
                                if (Array.isArray(cloudData.pointsPenaltyCheckTimes)) this.data.pointsPenaltyCheckTimes = cloudData.pointsPenaltyCheckTimes;
                                if (typeof cloudData.pointsPenaltyCheckOnStartup === 'boolean') this.data.pointsPenaltyCheckOnStartup = cloudData.pointsPenaltyCheckOnStartup;
                                if (typeof cloudData.pointsPenaltyConfirmModalEnabled === 'boolean') this.data.pointsPenaltyConfirmModalEnabled = cloudData.pointsPenaltyConfirmModalEnabled;
                                if (typeof cloudData.tomatoSpentAttrMode === 'string') this.data.tomatoSpentAttrMode = cloudData.tomatoSpentAttrMode;
                                if (typeof cloudData.tomatoSpentAttrKeyMinutes === 'string') this.data.tomatoSpentAttrKeyMinutes = cloudData.tomatoSpentAttrKeyMinutes;
                                if (typeof cloudData.tomatoSpentAttrKeyHours === 'string') this.data.tomatoSpentAttrKeyHours = cloudData.tomatoSpentAttrKeyHours;
                                if (typeof cloudData.calendarEnabled === 'boolean') this.data.calendarEnabled = cloudData.calendarEnabled;
                                if (typeof cloudData.calendarLinkDockTomato === 'boolean') this.data.calendarLinkDockTomato = cloudData.calendarLinkDockTomato;
                                if (typeof cloudData.calendarInitialView === 'string') this.data.calendarInitialView = cloudData.calendarInitialView;
                                if (typeof cloudData.calendarFirstDay === 'number') this.data.calendarFirstDay = cloudData.calendarFirstDay;
                                if (typeof cloudData.calendarMonthAggregate === 'boolean') this.data.calendarMonthAggregate = cloudData.calendarMonthAggregate;
                                if (typeof cloudData.calendarMonthAdaptiveRowHeight === 'boolean') this.data.calendarMonthAdaptiveRowHeight = cloudData.calendarMonthAdaptiveRowHeight;
                                if (typeof cloudData.calendarMonthMinVisibleEvents === 'number') this.data.calendarMonthMinVisibleEvents = cloudData.calendarMonthMinVisibleEvents;
                                if (typeof cloudData.calendarShowSchedule === 'boolean') this.data.calendarShowSchedule = cloudData.calendarShowSchedule;
                                if (typeof cloudData.calendarScheduleReminderEnabled === 'boolean') this.data.calendarScheduleReminderEnabled = cloudData.calendarScheduleReminderEnabled;
                                if (typeof cloudData.calendarScheduleReminderSystemEnabled === 'boolean') this.data.calendarScheduleReminderSystemEnabled = cloudData.calendarScheduleReminderSystemEnabled;
                                if (typeof cloudData.calendarScheduleReminderDefaultMode === 'string') this.data.calendarScheduleReminderDefaultMode = cloudData.calendarScheduleReminderDefaultMode;
                                if (typeof cloudData.calendarAllDayReminderEnabled === 'boolean') this.data.calendarAllDayReminderEnabled = cloudData.calendarAllDayReminderEnabled;
                                if (typeof cloudData.calendarAllDayReminderTime === 'string') this.data.calendarAllDayReminderTime = cloudData.calendarAllDayReminderTime;
                                if (typeof cloudData.calendarTaskDateAllDayReminderEnabled === 'boolean') this.data.calendarTaskDateAllDayReminderEnabled = cloudData.calendarTaskDateAllDayReminderEnabled;
                                if (typeof cloudData.calendarAllDaySummaryIncludeExtras === 'boolean') this.data.calendarAllDaySummaryIncludeExtras = cloudData.calendarAllDaySummaryIncludeExtras;
                                if (typeof cloudData.calendarShowTomatoMaster === 'boolean') this.data.calendarShowTomatoMaster = cloudData.calendarShowTomatoMaster;
                                if (typeof cloudData.calendarShowFocus === 'boolean') this.data.calendarShowFocus = cloudData.calendarShowFocus;
                                if (typeof cloudData.calendarShowBreak === 'boolean') this.data.calendarShowBreak = cloudData.calendarShowBreak;
                                if (typeof cloudData.calendarShowStopwatch === 'boolean') this.data.calendarShowStopwatch = cloudData.calendarShowStopwatch;
                                if (typeof cloudData.calendarShowIdle === 'boolean') this.data.calendarShowIdle = cloudData.calendarShowIdle;
                                if (typeof cloudData.calendarColorFocus === 'string') this.data.calendarColorFocus = cloudData.calendarColorFocus;
                                if (typeof cloudData.calendarColorBreak === 'string') this.data.calendarColorBreak = cloudData.calendarColorBreak;
                                if (typeof cloudData.calendarColorStopwatch === 'string') this.data.calendarColorStopwatch = cloudData.calendarColorStopwatch;
                                if (typeof cloudData.calendarColorIdle === 'string') this.data.calendarColorIdle = cloudData.calendarColorIdle;
                                if (typeof cloudData.calendarSidebarWidth === 'number') this.data.calendarSidebarWidth = cloudData.calendarSidebarWidth;
                                if (typeof cloudData.calendarSidebarDefaultPage === 'string') this.data.calendarSidebarDefaultPage = cloudData.calendarSidebarDefaultPage;
                                if (typeof cloudData.calendarSidebarCollapsedDesktopDefault === 'boolean') this.data.calendarSidebarCollapsedDesktopDefault = cloudData.calendarSidebarCollapsedDesktopDefault;
                                if (cloudData.calendarColumnWidths && typeof cloudData.calendarColumnWidths === 'object') this.data.calendarColumnWidths = cloudData.calendarColumnWidths;
                                if (typeof cloudData.calendarLastViewType === 'string') this.data.calendarLastViewType = cloudData.calendarLastViewType;
                                if (typeof cloudData.calendarLastDate === 'string') this.data.calendarLastDate = cloudData.calendarLastDate;
                                if (cloudData.calendarCalendarsConfig && typeof cloudData.calendarCalendarsConfig === 'object') this.data.calendarCalendarsConfig = cloudData.calendarCalendarsConfig;
                                if (typeof cloudData.calendarDefaultCalendarId === 'string') this.data.calendarDefaultCalendarId = cloudData.calendarDefaultCalendarId;
                                if (typeof cloudData.calendarSidebarCollapseCalendars === 'boolean') this.data.calendarSidebarCollapseCalendars = cloudData.calendarSidebarCollapseCalendars;
                                if (typeof cloudData.calendarSidebarCollapseDocGroups === 'boolean') this.data.calendarSidebarCollapseDocGroups = cloudData.calendarSidebarCollapseDocGroups;
                                if (typeof cloudData.calendarSidebarCollapseTomato === 'boolean') this.data.calendarSidebarCollapseTomato = cloudData.calendarSidebarCollapseTomato;
                                if (typeof cloudData.calendarSidebarCollapseTasks === 'boolean') this.data.calendarSidebarCollapseTasks = cloudData.calendarSidebarCollapseTasks;
                                if (typeof cloudData.calendarShowTaskDates === 'boolean') this.data.calendarShowTaskDates = cloudData.calendarShowTaskDates;
                                if (typeof cloudData.calendarHideScheduledTaskDatesInAllDay === 'boolean') this.data.calendarHideScheduledTaskDatesInAllDay = cloudData.calendarHideScheduledTaskDatesInAllDay;
                                if (typeof cloudData.calendarShowOtherBlockCheckbox === 'boolean') this.data.calendarShowOtherBlockCheckbox = cloudData.calendarShowOtherBlockCheckbox;
                                if (typeof cloudData.calendarTaskDateColorMode === 'string') this.data.calendarTaskDateColorMode = cloudData.calendarTaskDateColorMode;
                                if (typeof cloudData.calendarScheduleFollowDocColor === 'boolean') this.data.calendarScheduleFollowDocColor = cloudData.calendarScheduleFollowDocColor;
                                if (typeof cloudData.calendar3DayTodayPosition === 'number') this.data.calendar3DayTodayPosition = cloudData.calendar3DayTodayPosition;
                                if (typeof cloudData.calendarNewScheduleMaxDurationMin === 'number') this.data.calendarNewScheduleMaxDurationMin = cloudData.calendarNewScheduleMaxDurationMin;
                                if (typeof cloudData.calendarQuickAddScheduleTimeMode === 'string') this.data.calendarQuickAddScheduleTimeMode = cloudData.calendarQuickAddScheduleTimeMode;
                                if (typeof cloudData.calendarQuickAddScheduleCustomTime === 'string') this.data.calendarQuickAddScheduleCustomTime = cloudData.calendarQuickAddScheduleCustomTime;
                                if (typeof cloudData.calendarHourSlotHeightMode === 'string') this.data.calendarHourSlotHeightMode = cloudData.calendarHourSlotHeightMode;
                                if (typeof cloudData.calendarVisibleStartTime === 'string') this.data.calendarVisibleStartTime = cloudData.calendarVisibleStartTime;
                                if (typeof cloudData.calendarVisibleEndTime === 'string') this.data.calendarVisibleEndTime = cloudData.calendarVisibleEndTime;
                                if (typeof cloudData.calendarScheduleColor === 'string') this.data.calendarScheduleColor = cloudData.calendarScheduleColor;
                                if (typeof cloudData.calendarTaskDatesColor === 'string') this.data.calendarTaskDatesColor = cloudData.calendarTaskDatesColor;
                                if (typeof cloudData.calendarShowCnHoliday === 'boolean') this.data.calendarShowCnHoliday = cloudData.calendarShowCnHoliday;
                                if (typeof cloudData.calendarCnHolidayColor === 'string') this.data.calendarCnHolidayColor = cloudData.calendarCnHolidayColor;
                                if (typeof cloudData.calendarShowLunar === 'boolean') this.data.calendarShowLunar = cloudData.calendarShowLunar;
                                if (typeof cloudData.calendarSideDockEnabled === 'boolean') this.data.calendarSideDockEnabled = cloudData.calendarSideDockEnabled;
                                if (typeof cloudData.calendarSideDockWidth === 'number') this.data.calendarSideDockWidth = cloudData.calendarSideDockWidth;
                                if (typeof cloudData.docTopbarButtonDesktop === 'boolean') this.data.docTopbarButtonDesktop = cloudData.docTopbarButtonDesktop;
                                if (typeof cloudData.docTopbarButtonMobile === 'boolean') this.data.docTopbarButtonMobile = cloudData.docTopbarButtonMobile;
                                if (typeof cloudData.docTopbarButtonSwapPressActions === 'boolean') this.data.docTopbarButtonSwapPressActions = cloudData.docTopbarButtonSwapPressActions;
                                if (typeof cloudData.docTopbarButtonLocateCurrentDocTab === 'boolean') this.data.docTopbarButtonLocateCurrentDocTab = cloudData.docTopbarButtonLocateCurrentDocTab;
                                if (typeof cloudData.windowTopbarIconDesktop === 'boolean') this.data.windowTopbarIconDesktop = cloudData.windowTopbarIconDesktop;
                                if (typeof cloudData.windowTopbarIconMobile === 'boolean') this.data.windowTopbarIconMobile = cloudData.windowTopbarIconMobile;
                                if (typeof cloudData.semanticDateAutoPromptEnabled === 'boolean') this.data.semanticDateAutoPromptEnabled = cloudData.semanticDateAutoPromptEnabled;
                                if (typeof cloudData.checklistDetailWidth === 'number') this.data.checklistDetailWidth = cloudData.checklistDetailWidth;
                                if (shouldApplyCloudDocGroupState && typeof cloudData.defaultDocId === 'string') this.data.defaultDocId = cloudData.defaultDocId;
                                if (shouldApplyCloudDocGroupState && cloudData.defaultDocIdByGroup && typeof cloudData.defaultDocIdByGroup === 'object') this.data.defaultDocIdByGroup = cloudData.defaultDocIdByGroup;
                                if (shouldApplyCloudDocGroupState && Array.isArray(cloudData.allDocsExcludedDocIds)) this.data.allDocsExcludedDocIds = cloudData.allDocsExcludedDocIds;
                                if (cloudData.priorityScoreConfig && typeof cloudData.priorityScoreConfig === 'object') this.data.priorityScoreConfig = cloudData.priorityScoreConfig;
                                if (cloudData.quadrantConfig && typeof cloudData.quadrantConfig === 'object') this.data.quadrantConfig = cloudData.quadrantConfig;
                                if (shouldApplyCloudDocGroupState && Array.isArray(cloudData.docGroups)) this.data.docGroups = cloudData.docGroups;
                                if (shouldApplyCloudDocGroupState && Array.isArray(cloudData.otherBlockRefs)) this.data.otherBlockRefs = cloudData.otherBlockRefs;
                                if (shouldApplyCloudDocGroupState && cloudData.docPinnedByGroup && typeof cloudData.docPinnedByGroup === 'object') this.data.docPinnedByGroup = cloudData.docPinnedByGroup;
                                if (cloudData.currentGroupId) this.data.currentGroupId = cloudData.currentGroupId;
                                if (cloudData.taskHeadingLevel) this.data.taskHeadingLevel = cloudData.taskHeadingLevel;
                                if (cloudData.themeConfig && typeof cloudData.themeConfig === 'object') this.data.themeConfig = cloudData.themeConfig;
                                if (typeof cloudData.priorityIconStyle === 'string') this.data.priorityIconStyle = String(cloudData.priorityIconStyle || '').trim() === 'flag' ? 'flag' : 'jira';
                                if (typeof cloudData.topbarGradientLightStart === 'string') this.data.topbarGradientLightStart = cloudData.topbarGradientLightStart;
                                if (typeof cloudData.topbarGradientLightEnd === 'string') this.data.topbarGradientLightEnd = cloudData.topbarGradientLightEnd;
                                if (typeof cloudData.topbarGradientDarkStart === 'string') this.data.topbarGradientDarkStart = cloudData.topbarGradientDarkStart;
                                if (typeof cloudData.topbarGradientDarkEnd === 'string') this.data.topbarGradientDarkEnd = cloudData.topbarGradientDarkEnd;
                                if (typeof cloudData.topbarTextColorLight === 'string') this.data.topbarTextColorLight = cloudData.topbarTextColorLight;
                                if (typeof cloudData.topbarTextColorDark === 'string') this.data.topbarTextColorDark = cloudData.topbarTextColorDark;
                                if (typeof cloudData.topbarControlBgLight === 'string') this.data.topbarControlBgLight = cloudData.topbarControlBgLight;
                                if (typeof cloudData.topbarControlBgDark === 'string') this.data.topbarControlBgDark = cloudData.topbarControlBgDark;
                                if (typeof cloudData.topbarControlTextLight === 'string') this.data.topbarControlTextLight = cloudData.topbarControlTextLight;
                                if (typeof cloudData.topbarControlTextDark === 'string') this.data.topbarControlTextDark = cloudData.topbarControlTextDark;
                                if (typeof cloudData.topbarControlBorderLight === 'string') this.data.topbarControlBorderLight = cloudData.topbarControlBorderLight;
                                if (typeof cloudData.topbarControlBorderDark === 'string') this.data.topbarControlBorderDark = cloudData.topbarControlBorderDark;
                                if (typeof cloudData.topbarControlHoverLight === 'string') this.data.topbarControlHoverLight = cloudData.topbarControlHoverLight;
                                if (typeof cloudData.topbarControlHoverDark === 'string') this.data.topbarControlHoverDark = cloudData.topbarControlHoverDark;
                                if (typeof cloudData.topbarControlSegmentBgLight === 'string') this.data.topbarControlSegmentBgLight = cloudData.topbarControlSegmentBgLight;
                                if (typeof cloudData.topbarControlSegmentBgDark === 'string') this.data.topbarControlSegmentBgDark = cloudData.topbarControlSegmentBgDark;
                                if (typeof cloudData.topbarControlSegmentActiveBgLight === 'string') this.data.topbarControlSegmentActiveBgLight = cloudData.topbarControlSegmentActiveBgLight;
                                if (typeof cloudData.topbarControlSegmentActiveBgDark === 'string') this.data.topbarControlSegmentActiveBgDark = cloudData.topbarControlSegmentActiveBgDark;
                                if (typeof cloudData.topbarControlShadowColorLight === 'string') this.data.topbarControlShadowColorLight = cloudData.topbarControlShadowColorLight;
                                if (typeof cloudData.topbarControlShadowColorDark === 'string') this.data.topbarControlShadowColorDark = cloudData.topbarControlShadowColorDark;
                                if (typeof cloudData.topbarControlRadiusPx === 'number') this.data.topbarControlRadiusPx = cloudData.topbarControlRadiusPx;
                                if (typeof cloudData.topbarControlBorderWidthPx === 'number') this.data.topbarControlBorderWidthPx = cloudData.topbarControlBorderWidthPx;
                                if (typeof cloudData.topbarControlShadowYOffsetPx === 'number') this.data.topbarControlShadowYOffsetPx = cloudData.topbarControlShadowYOffsetPx;
                                if (typeof cloudData.topbarControlShadowBlurPx === 'number') this.data.topbarControlShadowBlurPx = cloudData.topbarControlShadowBlurPx;
                                if (typeof cloudData.topbarControlShadowStrengthPct === 'number') this.data.topbarControlShadowStrengthPct = cloudData.topbarControlShadowStrengthPct;
                                if (typeof cloudData.taskContentColorLight === 'string') this.data.taskContentColorLight = cloudData.taskContentColorLight;
                                if (typeof cloudData.taskContentColorDark === 'string') this.data.taskContentColorDark = cloudData.taskContentColorDark;
                                if (typeof cloudData.taskMetaColorLight === 'string') this.data.taskMetaColorLight = cloudData.taskMetaColorLight;
                                if (typeof cloudData.taskMetaColorDark === 'string') this.data.taskMetaColorDark = cloudData.taskMetaColorDark;
                                if (typeof cloudData.groupDocLabelColorLight === 'string') this.data.groupDocLabelColorLight = cloudData.groupDocLabelColorLight;
                                if (typeof cloudData.groupDocLabelColorDark === 'string') this.data.groupDocLabelColorDark = cloudData.groupDocLabelColorDark;
                                if (typeof cloudData.timeGroupBaseColorLight === 'string') this.data.timeGroupBaseColorLight = cloudData.timeGroupBaseColorLight;
                                if (typeof cloudData.timeGroupBaseColorDark === 'string') this.data.timeGroupBaseColorDark = cloudData.timeGroupBaseColorDark;
                                if (typeof cloudData.timeGroupOverdueColorLight === 'string') this.data.timeGroupOverdueColorLight = cloudData.timeGroupOverdueColorLight;
                                if (typeof cloudData.timeGroupOverdueColorDark === 'string') this.data.timeGroupOverdueColorDark = cloudData.timeGroupOverdueColorDark;
                                if (typeof cloudData.timeGroupPendingTaskBgColorLight === 'string') this.data.timeGroupPendingTaskBgColorLight = cloudData.timeGroupPendingTaskBgColorLight;
                                if (typeof cloudData.timeGroupPendingTaskBgColorDark === 'string') this.data.timeGroupPendingTaskBgColorDark = cloudData.timeGroupPendingTaskBgColorDark;
                                if (typeof cloudData.progressBarColorLight === 'string') this.data.progressBarColorLight = cloudData.progressBarColorLight;
                                if (typeof cloudData.progressBarColorDark === 'string') this.data.progressBarColorDark = cloudData.progressBarColorDark;
                                if (typeof cloudData.calendarTodayHighlightColorLight === 'string') this.data.calendarTodayHighlightColorLight = cloudData.calendarTodayHighlightColorLight;
                                if (typeof cloudData.calendarTodayHighlightColorDark === 'string') this.data.calendarTodayHighlightColorDark = cloudData.calendarTodayHighlightColorDark;
                                if (typeof cloudData.calendarGridBorderColorLight === 'string') this.data.calendarGridBorderColorLight = cloudData.calendarGridBorderColorLight;
                                if (typeof cloudData.calendarGridBorderColorDark === 'string') this.data.calendarGridBorderColorDark = cloudData.calendarGridBorderColorDark;
                                if (typeof cloudData.tableBorderColorLight === 'string') this.data.tableBorderColorLight = cloudData.tableBorderColorLight;
                                if (typeof cloudData.tableBorderColorDark === 'string') this.data.tableBorderColorDark = cloudData.tableBorderColorDark;
                                if (Array.isArray(cloudData.customStatusOptions)) this.data.customStatusOptions = cloudData.customStatusOptions;
                                if (Array.isArray(cloudData.customDurationOptions)) this.data.customDurationOptions = cloudData.customDurationOptions;
                                if (typeof cloudData.checkboxDoneStatusId === 'string') this.data.checkboxDoneStatusId = cloudData.checkboxDoneStatusId;
                                if (typeof cloudData.checkboxUndoneStatusId === 'string') this.data.checkboxUndoneStatusId = cloudData.checkboxUndoneStatusId;
                                this.data.customFieldDefs = resolvedCustomFieldSchema.defs;
                                this.data.customFieldDefsVersion = resolvedCustomFieldSchema.version;
                                if (cloudData.columnWidths && typeof cloudData.columnWidths === 'object') {
                                    // 旧版本兼容：如果有 customTime 配置，迁移到 completionTime
                                    if (cloudData.columnWidths.customTime && !cloudData.columnWidths.completionTime) {
                                        cloudData.columnWidths.completionTime = cloudData.columnWidths.customTime;
                                    }
                                    this.data.columnWidths = { ...this.data.columnWidths, ...cloudData.columnWidths };
                                }
                                if (Array.isArray(cloudData.columnOrder)) this.data.columnOrder = cloudData.columnOrder;
                                if (Array.isArray(cloudData.hiddenColumns)) this.data.hiddenColumns = cloudData.hiddenColumns;

                                // 新增字段处理
                                if (typeof cloudData.durationFormat === 'string') this.data.durationFormat = cloudData.durationFormat;
                                const cloudHasShowCompletedTasks = typeof cloudData.showCompletedTasks === 'boolean';
                                const cloudHasExcludeCompletedTasks = typeof cloudData.excludeCompletedTasks === 'boolean';
                                if (cloudHasShowCompletedTasks) this.data.showCompletedTasks = cloudData.showCompletedTasks;
                                if (cloudHasExcludeCompletedTasks) this.data.excludeCompletedTasks = cloudData.excludeCompletedTasks;
                                if (!cloudHasShowCompletedTasks && cloudHasExcludeCompletedTasks) this.data.showCompletedTasks = !this.data.excludeCompletedTasks;
                                __tmNormalizeCompletedVisibilitySettings(this.data);
                                if (typeof cloudData.startDate === 'number') this.data.startDate = cloudData.startDate;
                                if (typeof cloudData.timelineLeftWidth === 'number') this.data.timelineLeftWidth = cloudData.timelineLeftWidth;
                                if (typeof cloudData.timelineSidebarCollapsed === 'boolean') this.data.timelineSidebarCollapsed = cloudData.timelineSidebarCollapsed;
                                if (typeof cloudData.timelineContentWidth === 'number') this.data.timelineContentWidth = cloudData.timelineContentWidth;
                                if (Array.isArray(cloudData.timelineCardFields)) this.data.timelineCardFields = __tmNormalizeTimelineCardFields(cloudData.timelineCardFields);
                                if (typeof cloudData.timelineForceSortByCompletionNearToday === 'boolean') this.data.timelineForceSortByCompletionNearToday = cloudData.timelineForceSortByCompletionNearToday;
                                if (typeof cloudData.groupSortByBestSubtaskTimeInTimeQuadrant === 'boolean') this.data.groupSortByBestSubtaskTimeInTimeQuadrant = cloudData.groupSortByBestSubtaskTimeInTimeQuadrant;
                                if (typeof cloudData.collapseAllIncludesGroups === 'boolean') this.data.collapseAllIncludesGroups = cloudData.collapseAllIncludesGroups;
                                if (typeof cloudData.enableGroupTaskBgByGroupColor === 'boolean') this.data.enableGroupTaskBgByGroupColor = cloudData.enableGroupTaskBgByGroupColor;
                                __tmApplyMergedWhiteboardContentState(this.data, cloudData);
                                if (typeof cloudData.whiteboardAutoConnectByCreated === 'boolean') this.data.whiteboardAutoConnectByCreated = cloudData.whiteboardAutoConnectByCreated;
                                if (typeof cloudData.whiteboardTool === 'string') this.data.whiteboardTool = cloudData.whiteboardTool;
                                if (typeof cloudData.whiteboardSidebarCollapsed === 'boolean') this.data.whiteboardSidebarCollapsed = cloudData.whiteboardSidebarCollapsed;
                                if (typeof cloudData.whiteboardSidebarWidth === 'number') this.data.whiteboardSidebarWidth = cloudData.whiteboardSidebarWidth;
                                if (typeof cloudData.whiteboardShowDone === 'boolean') this.data.whiteboardShowDone = cloudData.whiteboardShowDone;
                                if (Array.isArray(cloudData.whiteboardCardFields)) this.data.whiteboardCardFields = cloudData.whiteboardCardFields;
                                if (cloudData.whiteboardView && typeof cloudData.whiteboardView === 'object') this.data.whiteboardView = cloudData.whiteboardView;
                                if (typeof cloudData.whiteboardAutoLayout === 'boolean') this.data.whiteboardAutoLayout = cloudData.whiteboardAutoLayout;
                                if (typeof cloudData.whiteboardAllTabsLayoutMode === 'string') this.data.whiteboardAllTabsLayoutMode = cloudData.whiteboardAllTabsLayoutMode;
                                if (typeof cloudData.whiteboardSequenceMode === 'boolean') this.data.whiteboardSequenceMode = cloudData.whiteboardSequenceMode;
                                if (cloudData.docColorMap && typeof cloudData.docColorMap === 'object') this.data.docColorMap = cloudData.docColorMap;
                                if (typeof cloudData.docColorSeed === 'number') this.data.docColorSeed = cloudData.docColorSeed;
                                if (cloudData.docDefaultColorScheme && typeof cloudData.docDefaultColorScheme === 'object') this.data.docDefaultColorScheme = cloudData.docDefaultColorScheme;
                                if (typeof cloudData.docTabSortMode === 'string') this.data.docTabSortMode = cloudData.docTabSortMode;
                                if (typeof cloudData.docDisplayNameMode === 'string') this.data.docDisplayNameMode = cloudData.docDisplayNameMode;
                                if (typeof cloudData.aiEnabled === 'boolean') this.data.aiEnabled = cloudData.aiEnabled;
                                if (typeof cloudData.aiProvider === 'string') this.data.aiProvider = cloudData.aiProvider;
                                if (typeof cloudData.aiMiniMaxApiKey === 'string') this.data.aiMiniMaxApiKey = cloudData.aiMiniMaxApiKey;
                                if (typeof cloudData.aiMiniMaxBaseUrl === 'string') this.data.aiMiniMaxBaseUrl = cloudData.aiMiniMaxBaseUrl;
                                if (typeof cloudData.aiMiniMaxModel === 'string') this.data.aiMiniMaxModel = cloudData.aiMiniMaxModel;
                                if (typeof cloudData.aiDeepSeekApiKey === 'string') this.data.aiDeepSeekApiKey = cloudData.aiDeepSeekApiKey;
                                if (typeof cloudData.aiDeepSeekBaseUrl === 'string') this.data.aiDeepSeekBaseUrl = cloudData.aiDeepSeekBaseUrl;
                                if (typeof cloudData.aiDeepSeekModel === 'string') this.data.aiDeepSeekModel = cloudData.aiDeepSeekModel;
                                if (typeof cloudData.aiMiniMaxTemperature === 'number') this.data.aiMiniMaxTemperature = cloudData.aiMiniMaxTemperature;
                                if (typeof cloudData.aiMiniMaxMaxTokens === 'number') this.data.aiMiniMaxMaxTokens = cloudData.aiMiniMaxMaxTokens;
                                if (typeof cloudData.aiMiniMaxTimeoutMs === 'number') this.data.aiMiniMaxTimeoutMs = cloudData.aiMiniMaxTimeoutMs;
                                if (typeof cloudData.aiDefaultContextMode === 'string') this.data.aiDefaultContextMode = cloudData.aiDefaultContextMode;
                                if (Array.isArray(cloudData.aiScheduleWindows)) this.data.aiScheduleWindows = cloudData.aiScheduleWindows;
                                else if (typeof cloudData.aiScheduleWindows === 'string') this.data.aiScheduleWindows = String(cloudData.aiScheduleWindows).split(/\r?\n/);
                                if (typeof cloudData.serverSyncOnManualRefresh === 'boolean') this.data.serverSyncOnManualRefresh = cloudData.serverSyncOnManualRefresh;
                                if (typeof cloudData.serverSyncSessionStateOnManualRefresh === 'boolean') this.data.serverSyncSessionStateOnManualRefresh = cloudData.serverSyncSessionStateOnManualRefresh;
                                const restoredLocalSettingFields = __tmApplySettingsFieldUpdatesByMap(this.data, localSettingsBeforeCloud);

                                const validModes = new Set(['none', 'doc', 'time', 'quadrant', 'task']);
                                if (!validModes.has(String(this.data.groupMode || ''))) {
                                    // groupMode 无效时，根据标志位推导模式
                                    const q = !!(this.data.quadrantConfig && this.data.quadrantConfig.enabled);
                                    this.data.groupMode = q ? 'quadrant' : (this.data.groupByTime ? 'time' : (this.data.groupByDocName ? 'doc' : (this.data.groupByTaskName ? 'task' : 'none')));
                                }
                                // 根据 groupMode 设置标志位，但 groupByTaskName 只在 groupMode === 'task' 时才设置为 true
                                // 这样切换到其他模式后，groupByTaskName 的值会被保留，设置开关就不会被关闭
                                // 但需要在 groupMode === 'none' 时额外检查 groupByTaskName 是否为 true，如果是则设置为 'task'
                                if (this.data.groupMode === 'doc') {
                                    this.data.groupByDocName = true;
                                    this.data.groupByTime = false;
                                    this.data.quadrantConfig = this.data.quadrantConfig || {};
                                    this.data.quadrantConfig.enabled = false;
                                } else if (this.data.groupMode === 'time') {
                                    this.data.groupByDocName = false;
                                    this.data.groupByTime = true;
                                    this.data.quadrantConfig = this.data.quadrantConfig || {};
                                    this.data.quadrantConfig.enabled = false;
                                } else if (this.data.groupMode === 'task') {
                                    this.data.groupByDocName = false;
                                    this.data.groupByTaskName = true;
                                    this.data.groupByTime = false;
                                    this.data.quadrantConfig = this.data.quadrantConfig || {};
                                    this.data.quadrantConfig.enabled = false;
                                } else if (this.data.groupMode === 'quadrant') {
                                    this.data.groupByDocName = false;
                                    this.data.groupByTime = false;
                                    this.data.quadrantConfig = this.data.quadrantConfig || {};
                                    this.data.quadrantConfig.enabled = true;
                                } else {
                                    this.data.groupByDocName = false;
                                    this.data.groupByTime = false;
                                    this.data.quadrantConfig = this.data.quadrantConfig || {};
                                    this.data.quadrantConfig.enabled = false;
                                    // 当 groupMode 为 'none' 时，保持 groupMode 不变
                                    // 这样可以保留用户上次选择的分组模式（即使设置开关开启）
                                    // 只有当 groupMode 无效时才设置为 'none'
                                    if (!this.data.groupMode || this.data.groupMode === 'none') {
                                        this.data.groupMode = 'none';
                                    }
                                    // 注意：这里不再强制将 groupMode 设置为 'task'
                                    // 因为用户可能选择了"不分组"或其他分组模式
                                }

                                const migratedLegacyTopbarDefaults = this.migrateLegacyTopbarDefaults();
                                // 同步到本地缓存
                                __tmEnsureDocGroupContextValidAfterSync();
                                this.normalizeColumns();
                                this.syncToLocal();
                                this.loadedWhiteboardStateVersion = __tmParseVersionNumber(this.data.whiteboardStateVersion);
                                this.lastWhiteboardFingerprint = __tmGetWhiteboardSettingsFingerprint(this.data);
                                this.refreshDocGroupSyncState(this.data.docGroupSettingsUpdatedAt);
                                this.refreshCustomFieldSyncState();
                                this.refreshCollapsedStateSyncState();
                                this.refreshSettingsFieldSyncState();
                                this.loaded = true;
                                if (migratedLegacyTopbarDefaults || restoredLocalSettingFields.length > 0) {
                                    try { await this.save(); } catch (e) {}
                                }
                                return;
                            }
                        } catch (parseError) {
                        }
                    }
                }
            } catch (e) {
            }
            const migratedLegacyTopbarDefaults = this.migrateLegacyTopbarDefaults();
            this.loadedWhiteboardStateVersion = __tmParseVersionNumber(this.data.whiteboardStateVersion);
            this.lastWhiteboardFingerprint = __tmGetWhiteboardSettingsFingerprint(this.data);
            this.refreshDocGroupSyncState(this.data.docGroupSettingsUpdatedAt);
            this.refreshCustomFieldSyncState();
            this.refreshCollapsedStateSyncState();
            this.refreshSettingsFieldSyncState();
            this.loaded = true;
            if (migratedLegacyTopbarDefaults) {
                try { await this.save(); } catch (e) {}
            }
        },

        // 从本地缓存加载
        loadFromLocal() {
            this.data.settingsUpdatedAt = Number(Storage.get('tm_settings_updated_at', this.data.settingsUpdatedAt)) || 0;
            {
                const localFieldMap = __tmNormalizeSettingsFieldUpdatedAtMap(Storage.get('tm_settings_field_updated_at', this.data.settingsFieldUpdatedAt), this.data);
                this.data.settingsFieldUpdatedAt = __tmLooksLegacySeededSettingsFieldMap(localFieldMap, this.data) ? {} : localFieldMap;
            }
            this.data.docGroupSettingsUpdatedAt = Number(Storage.get('tm_doc_group_settings_updated_at', this.data.docGroupSettingsUpdatedAt)) || 0;
            this.data.collapseStateUpdatedAt = Number(Storage.get('tm_collapse_state_updated_at', this.data.collapseStateUpdatedAt)) || 0;
            this.data.selectedDocIds = Storage.get('tm_selected_doc_ids', []) || [];
            this.data.queryLimit = __TM_TASK_INDEX_QUERY_LIMIT;
            this.data.recursiveDocLimit = Storage.get('tm_recursive_doc_limit', this.data.recursiveDocLimit);
            this.data.legacyWin7CompatMode = !!Storage.get('tm_legacy_win7_compat_mode', this.data.legacyWin7CompatMode);
            this.data.taskParentLookupDepth = __tmNormalizeTaskParentLookupDepth(Storage.get('tm_task_parent_lookup_depth', this.data.taskParentLookupDepth));
            this.data.groupByDocName = Storage.get('tm_group_by_docname', true);
            this.data.groupByTime = Storage.get('tm_group_by_time', false);
            this.data.defaultViewMode = Storage.get('tm_default_view_mode', this.data.defaultViewMode);
            this.data.defaultViewModeMobile = Storage.get('tm_default_view_mode_mobile', this.data.defaultViewModeMobile || this.data.defaultViewMode);
            this.data.dockSidebarEnabled = !!Storage.get('tm_dock_sidebar_enabled', this.data.dockSidebarEnabled);
            this.data.dockDefaultViewMode = Storage.get('tm_dock_default_view_mode', this.data.dockDefaultViewMode || 'follow-mobile');
            this.data.dockChecklistCompactTitleJump = !!Storage.get('tm_dock_checklist_compact_title_jump', this.data.dockChecklistCompactTitleJump);
            this.data.mobileChecklistCompactTitleJump = !!Storage.get('tm_mobile_checklist_compact_title_jump', this.data.mobileChecklistCompactTitleJump ?? this.data.dockChecklistCompactTitleJump);
            this.data.desktopChecklistCompactMetaFields = __tmNormalizeCompactChecklistMetaFields(Storage.get('tm_desktop_checklist_compact_meta_fields', this.data.desktopChecklistCompactMetaFields));
            this.data.dockChecklistCompactMetaFields = __tmNormalizeCompactChecklistMetaFields(Storage.get('tm_dock_checklist_compact_meta_fields', this.data.dockChecklistCompactMetaFields));
            this.data.mobileChecklistCompactMetaFields = __tmNormalizeCompactChecklistMetaFields(Storage.get('tm_mobile_checklist_compact_meta_fields', this.data.mobileChecklistCompactMetaFields));
            this.data.checklistCompactRightFontSize = __tmNormalizeChecklistCompactRightFontSize(Storage.get('tm_checklist_compact_right_font_size', this.data.checklistCompactRightFontSize));
            this.data.checklistCompactTitleOpenDetailPage = !!Storage.get('tm_checklist_compact_title_open_detail_page', this.data.checklistCompactTitleOpenDetailPage);
            this.data.enabledViews = __tmNormalizeEnabledViews(Storage.get('tm_enabled_views', this.data.enabledViews));
            this.data.kanbanCompactMode = !!Storage.get('tm_kanban_compact_mode', this.data.kanbanCompactMode);
            this.data.checklistCompactMode = !!Storage.get('tm_checklist_compact_mode', this.data.checklistCompactMode);
            this.data.checklistCompactTreeGuides = !!Storage.get('tm_checklist_compact_tree_guides', this.data.checklistCompactTreeGuides);
            this.data.checklistCompactTreeGuidesUpdatedAt = __tmParseUpdatedAtNumber(Storage.get('tm_checklist_compact_tree_guides_updated_at', this.data.checklistCompactTreeGuidesUpdatedAt));
            this.data.kanbanColumnWidth = Storage.get('tm_kanban_column_width', this.data.kanbanColumnWidth);
            this.data.kanbanFillColumns = !!Storage.get('tm_kanban_fill_columns', this.data.kanbanFillColumns);
            this.data.kanbanShowDoneColumn = !!Storage.get('tm_kanban_show_done_column', this.data.kanbanShowDoneColumn);
            this.data.kanbanDragSyncSubtasks = !!Storage.get('tm_kanban_drag_sync_subtasks', this.data.kanbanDragSyncSubtasks);
            this.data.kanbanCardFields = Storage.get('tm_kanban_card_fields', this.data.kanbanCardFields) || this.data.kanbanCardFields;
            this.data.taskCardDateOnlyWithValue = !!Storage.get('tm_task_card_date_only_with_value', this.data.taskCardDateOnlyWithValue);
            this.data.kanbanHeadingGroupMode = !!Storage.get('tm_kanban_heading_group_mode', this.data.kanbanHeadingGroupMode);
            this.data.whiteboardAllTabsCardMinWidth = Storage.get('tm_whiteboard_all_tabs_card_min_width', this.data.whiteboardAllTabsCardMinWidth);
            this.data.whiteboardStreamMobileTwoColumns = !!Storage.get('tm_whiteboard_stream_mobile_two_columns', this.data.whiteboardStreamMobileTwoColumns);
            this.data.docH2SubgroupEnabled = !!Storage.get('tm_doc_h2_subgroup_enabled', this.data.docH2SubgroupEnabled);
            this.data.groupByTaskName = !!Storage.get('tm_group_by_taskname', this.data.groupByTaskName);
            this.data.groupMode = Storage.get('tm_group_mode', this.data.groupMode);
            this.data.collapsedTaskIds = Storage.get('tm_collapsed_task_ids', []) || [];
            this.data.kanbanCollapsedTaskIds = Storage.get('tm_kanban_collapsed_task_ids', []) || [];
            this.data.collapsedGroups = Storage.get('tm_collapsed_groups', []) || [];
            this.data.expandedCompletedGroups = Storage.get('tm_expanded_completed_groups', []) || [];
            this.data.currentRule = Storage.get('tm_current_rule', null);
            this.data.viewProfiles = Storage.get('tm_view_profiles', this.data.viewProfiles) || this.data.viewProfiles;
            this.data.filterRules = Storage.get('tm_filter_rules', []);
            this.data.fontSize = Storage.get('tm_font_size', 14);
            this.data.fontSizeMobile = Storage.get('tm_font_size_mobile', this.data.fontSize);
            this.data.rowHeightMode = Storage.get('tm_row_height_mode', this.data.rowHeightMode);
            this.data.rowHeightPx = Storage.get('tm_row_height_px', this.data.rowHeightPx);
            this.data.topbarGradientLightStart = Storage.get('tm_topbar_gradient_light_start', this.data.topbarGradientLightStart);
            this.data.topbarGradientLightEnd = Storage.get('tm_topbar_gradient_light_end', this.data.topbarGradientLightEnd);
            this.data.topbarGradientDarkStart = Storage.get('tm_topbar_gradient_dark_start', this.data.topbarGradientDarkStart);
            this.data.topbarGradientDarkEnd = Storage.get('tm_topbar_gradient_dark_end', this.data.topbarGradientDarkEnd);
            this.data.topbarTextColorLight = Storage.get('tm_topbar_text_color_light', this.data.topbarTextColorLight);
            this.data.topbarTextColorDark = Storage.get('tm_topbar_text_color_dark', this.data.topbarTextColorDark);
            this.data.topbarControlBgLight = Storage.get('tm_topbar_control_bg_light', this.data.topbarControlBgLight);
            this.data.topbarControlBgDark = Storage.get('tm_topbar_control_bg_dark', this.data.topbarControlBgDark);
            this.data.topbarControlTextLight = Storage.get('tm_topbar_control_text_light', this.data.topbarControlTextLight);
            this.data.topbarControlTextDark = Storage.get('tm_topbar_control_text_dark', this.data.topbarControlTextDark);
            this.data.topbarControlBorderLight = Storage.get('tm_topbar_control_border_light', this.data.topbarControlBorderLight);
            this.data.topbarControlBorderDark = Storage.get('tm_topbar_control_border_dark', this.data.topbarControlBorderDark);
            this.data.topbarControlHoverLight = Storage.get('tm_topbar_control_hover_light', this.data.topbarControlHoverLight);
            this.data.topbarControlHoverDark = Storage.get('tm_topbar_control_hover_dark', this.data.topbarControlHoverDark);
            this.data.topbarControlSegmentBgLight = Storage.get('tm_topbar_control_segment_bg_light', this.data.topbarControlSegmentBgLight);
            this.data.topbarControlSegmentBgDark = Storage.get('tm_topbar_control_segment_bg_dark', this.data.topbarControlSegmentBgDark);
            this.data.topbarControlSegmentActiveBgLight = Storage.get('tm_topbar_control_segment_active_bg_light', this.data.topbarControlSegmentActiveBgLight);
            this.data.topbarControlSegmentActiveBgDark = Storage.get('tm_topbar_control_segment_active_bg_dark', this.data.topbarControlSegmentActiveBgDark);
            this.data.topbarControlShadowColorLight = Storage.get('tm_topbar_control_shadow_color_light', this.data.topbarControlShadowColorLight);
            this.data.topbarControlShadowColorDark = Storage.get('tm_topbar_control_shadow_color_dark', this.data.topbarControlShadowColorDark);
            this.data.topbarControlRadiusPx = Number(Storage.get('tm_topbar_control_radius_px', this.data.topbarControlRadiusPx));
            this.data.topbarControlBorderWidthPx = Number(Storage.get('tm_topbar_control_border_width_px', this.data.topbarControlBorderWidthPx));
            this.data.topbarControlShadowYOffsetPx = Number(Storage.get('tm_topbar_control_shadow_y_offset_px', this.data.topbarControlShadowYOffsetPx));
            this.data.topbarControlShadowBlurPx = Number(Storage.get('tm_topbar_control_shadow_blur_px', this.data.topbarControlShadowBlurPx));
            this.data.topbarControlShadowStrengthPct = Number(Storage.get('tm_topbar_control_shadow_strength_pct', this.data.topbarControlShadowStrengthPct));
            if (!Number.isFinite(this.data.topbarControlRadiusPx)) this.data.topbarControlRadiusPx = 10;
            if (!Number.isFinite(this.data.topbarControlBorderWidthPx)) this.data.topbarControlBorderWidthPx = 1;
            if (!Number.isFinite(this.data.topbarControlShadowYOffsetPx)) this.data.topbarControlShadowYOffsetPx = 0;
            if (!Number.isFinite(this.data.topbarControlShadowBlurPx)) this.data.topbarControlShadowBlurPx = 0;
            if (!Number.isFinite(this.data.topbarControlShadowStrengthPct)) this.data.topbarControlShadowStrengthPct = 100;
            this.data.taskContentColorLight = Storage.get('tm_task_content_color_light', this.data.taskContentColorLight);
            this.data.taskContentColorDark = Storage.get('tm_task_content_color_dark', this.data.taskContentColorDark);
            this.data.taskMetaColorLight = Storage.get('tm_task_meta_color_light', this.data.taskMetaColorLight);
            this.data.taskMetaColorDark = Storage.get('tm_task_meta_color_dark', this.data.taskMetaColorDark);
            this.data.groupDocLabelColorLight = Storage.get('tm_group_doc_label_color_light', this.data.groupDocLabelColorLight);
            this.data.groupDocLabelColorDark = Storage.get('tm_group_doc_label_color_dark', this.data.groupDocLabelColorDark);
            this.data.timeGroupBaseColorLight = Storage.get('tm_time_group_base_color_light', this.data.timeGroupBaseColorLight);
            this.data.timeGroupBaseColorDark = Storage.get('tm_time_group_base_color_dark', this.data.timeGroupBaseColorDark);
            this.data.timeGroupOverdueColorLight = Storage.get('tm_time_group_overdue_color_light', this.data.timeGroupOverdueColorLight);
            this.data.timeGroupOverdueColorDark = Storage.get('tm_time_group_overdue_color_dark', this.data.timeGroupOverdueColorDark);
            this.data.timeGroupPendingTaskBgColorLight = Storage.get('tm_time_group_pending_task_bg_color_light', this.data.timeGroupPendingTaskBgColorLight);
            this.data.timeGroupPendingTaskBgColorDark = Storage.get('tm_time_group_pending_task_bg_color_dark', this.data.timeGroupPendingTaskBgColorDark);
            this.data.progressBarColorLight = Storage.get('tm_progress_bar_color_light', this.data.progressBarColorLight);
            this.data.progressBarColorDark = Storage.get('tm_progress_bar_color_dark', this.data.progressBarColorDark);
            this.data.calendarTodayHighlightColorLight = Storage.get('tm_calendar_today_highlight_color_light', this.data.calendarTodayHighlightColorLight);
            this.data.calendarTodayHighlightColorDark = Storage.get('tm_calendar_today_highlight_color_dark', this.data.calendarTodayHighlightColorDark);
            this.data.calendarGridBorderColorLight = Storage.get('tm_calendar_grid_border_color_light', this.data.calendarGridBorderColorLight);
            this.data.calendarGridBorderColorDark = Storage.get('tm_calendar_grid_border_color_dark', this.data.calendarGridBorderColorDark);
            this.data.tableBorderColorLight = Storage.get('tm_table_border_color_light', this.data.tableBorderColorLight);
            this.data.tableBorderColorDark = Storage.get('tm_table_border_color_dark', this.data.tableBorderColorDark);
            this.data.enableQuickbar = Storage.get('tm_enable_quickbar', true);
            this.data.enableQuickbarInlineMeta = !!Storage.get('tm_enable_quickbar_inline_meta', this.data.enableQuickbarInlineMeta);
            this.data.taskDoneDelightEnabled = Storage.get('tm_task_done_delight_enabled', this.data.taskDoneDelightEnabled);
            this.data.enableMoveBlockToDailyNote = !!Storage.get('tm_enable_move_block_to_daily_note', this.data.enableMoveBlockToDailyNote);
            this.data.quickbarInlineFields = Storage.get('tm_quickbar_inline_fields', this.data.quickbarInlineFields) || this.data.quickbarInlineFields;
            this.data.quickbarVisibleItems = Storage.get('tm_quickbar_visible_items', this.data.quickbarVisibleItems) || this.data.quickbarVisibleItems;
            this.data.quickbarInlineShowOnMobile = !!Storage.get('tm_quickbar_inline_show_on_mobile', this.data.quickbarInlineShowOnMobile);
            this.data.pinNewTasksByDefault = Storage.get('tm_pin_new_tasks_by_default', false);
            this.data.taskDetailCompletedSubtasksVisibilityByTask = Storage.get('tm_task_detail_show_completed_subtasks_by_task', this.data.taskDetailCompletedSubtasksVisibilityByTask) || this.data.taskDetailCompletedSubtasksVisibilityByTask;
            this.data.newTaskDocId = Storage.get('tm_new_task_doc_id', '');
            this.data.newTaskDailyNoteNotebookId = String(Storage.get('tm_new_task_daily_note_notebook_id', this.data.newTaskDailyNoteNotebookId) || '').trim();
            this.data.quickAddRecentDocs = __tmNormalizeQuickAddRecentDocs(Storage.get(__TM_QUICK_ADD_RECENT_DOCS_KEY, this.data.quickAddRecentDocs));
            this.data.docTabSortMode = String(Storage.get('tm_doc_tab_sort_mode', this.data.docTabSortMode) || this.data.docTabSortMode || 'created_desc').trim() || 'created_desc';
            this.data.docDisplayNameMode = String(Storage.get('tm_doc_display_name_mode', this.data.docDisplayNameMode) || this.data.docDisplayNameMode || 'name').trim() || 'name';
            this.data.taskAutoWrapEnabled = Storage.get('tm_task_auto_wrap_enabled', this.data.taskAutoWrapEnabled);
            this.data.taskContentWrapMaxLines = Number(Storage.get('tm_task_content_wrap_max_lines', this.data.taskContentWrapMaxLines));
            this.data.taskRemarkWrapMaxLines = Number(Storage.get('tm_task_remark_wrap_max_lines', this.data.taskRemarkWrapMaxLines));
            this.data.enableTomatoIntegration = Storage.get('tm_enable_tomato_integration', true);
            this.data.enablePointsRewardIntegration = !!Storage.get('tm_enable_points_reward_integration', this.data.enablePointsRewardIntegration);
            this.data.enablePointsPenaltyIntegration = !!Storage.get('tm_enable_points_penalty_integration', this.data.enablePointsPenaltyIntegration);
            this.data.pointsPenaltyScheduleEnabled = !!Storage.get('tm_points_penalty_schedule_enabled', this.data.pointsPenaltyScheduleEnabled);
            this.data.pointsPenaltyDeadlineEnabled = !!Storage.get('tm_points_penalty_deadline_enabled', this.data.pointsPenaltyDeadlineEnabled);
            this.data.pointsPenaltyScheduleAmount = Number(Storage.get('tm_points_penalty_schedule_amount', this.data.pointsPenaltyScheduleAmount));
            this.data.pointsPenaltyDeadlineAmount = Number(Storage.get('tm_points_penalty_deadline_amount', this.data.pointsPenaltyDeadlineAmount));
            this.data.pointsPenaltyCheckTimes = Storage.get('tm_points_penalty_check_times', this.data.pointsPenaltyCheckTimes);
            this.data.pointsPenaltyCheckOnStartup = !!Storage.get('tm_points_penalty_check_on_startup', this.data.pointsPenaltyCheckOnStartup);
            this.data.pointsPenaltyConfirmModalEnabled = !!Storage.get('tm_points_penalty_confirm_modal_enabled', this.data.pointsPenaltyConfirmModalEnabled);
            this.data.tomatoSpentAttrMode = Storage.get('tm_tomato_spent_attr_mode', 'minutes');
            this.data.tomatoSpentAttrKeyMinutes = Storage.get('tm_tomato_spent_attr_key_minutes', this.data.tomatoSpentAttrKeyMinutes);
            this.data.tomatoSpentAttrKeyHours = Storage.get('tm_tomato_spent_attr_key_hours', this.data.tomatoSpentAttrKeyHours);
            this.data.calendarEnabled = Storage.get('tm_calendar_enabled', this.data.calendarEnabled);
            this.data.calendarLinkDockTomato = Storage.get('tm_calendar_link_docktomato', this.data.calendarLinkDockTomato);
            this.data.calendarInitialView = Storage.get('tm_calendar_initial_view', this.data.calendarInitialView);
            this.data.calendarFirstDay = Number(Storage.get('tm_calendar_first_day', this.data.calendarFirstDay));
            this.data.calendarMonthAggregate = Storage.get('tm_calendar_month_aggregate', this.data.calendarMonthAggregate);
            this.data.calendarMonthAdaptiveRowHeight = !!Storage.get('tm_calendar_month_adaptive_row_height', this.data.calendarMonthAdaptiveRowHeight);
            this.data.calendarMonthMinVisibleEvents = Number(Storage.get('tm_calendar_month_min_visible_events', this.data.calendarMonthMinVisibleEvents));
            this.data.calendarShowSchedule = Storage.get('tm_calendar_show_schedule', this.data.calendarShowSchedule);
            this.data.calendarScheduleReminderEnabled = !!Storage.get('tm_calendar_schedule_reminder_enabled', this.data.calendarScheduleReminderEnabled);
            this.data.calendarScheduleReminderSystemEnabled = !!Storage.get('tm_calendar_schedule_reminder_system_enabled', this.data.calendarScheduleReminderSystemEnabled);
            this.data.calendarScheduleReminderDefaultMode = String(Storage.get('tm_calendar_schedule_reminder_default_mode', this.data.calendarScheduleReminderDefaultMode) || '');
            this.data.calendarAllDayReminderEnabled = !!Storage.get('tm_calendar_all_day_reminder_enabled', this.data.calendarAllDayReminderEnabled);
            this.data.calendarAllDayReminderTime = String(Storage.get('tm_calendar_all_day_reminder_time', this.data.calendarAllDayReminderTime) || '');
            this.data.calendarTaskDateAllDayReminderEnabled = !!Storage.get('tm_calendar_taskdate_all_day_reminder_enabled', this.data.calendarTaskDateAllDayReminderEnabled);
            this.data.calendarAllDaySummaryIncludeExtras = !!Storage.get('tm_calendar_all_day_summary_include_extras', this.data.calendarAllDaySummaryIncludeExtras);
            this.data.calendarShowTomatoMaster = Storage.get('tm_calendar_show_tomato_master', this.data.calendarShowTomatoMaster);
            this.data.calendarShowFocus = Storage.get('tm_calendar_show_focus', this.data.calendarShowFocus);
            this.data.calendarShowBreak = Storage.get('tm_calendar_show_break', this.data.calendarShowBreak);
            this.data.calendarShowStopwatch = Storage.get('tm_calendar_show_stopwatch', this.data.calendarShowStopwatch);
            this.data.calendarShowIdle = Storage.get('tm_calendar_show_idle', this.data.calendarShowIdle);
            this.data.calendarShowTaskDates = Storage.get('tm_calendar_show_task_dates', this.data.calendarShowTaskDates);
            this.data.calendarHideScheduledTaskDatesInAllDay = !!Storage.get('tm_calendar_hide_scheduled_task_dates_in_all_day', this.data.calendarHideScheduledTaskDatesInAllDay);
            this.data.calendarShowOtherBlockCheckbox = Storage.get('tm_calendar_show_other_block_checkbox', this.data.calendarShowOtherBlockCheckbox);
            this.data.calendarTaskDateColorMode = Storage.get('tm_calendar_task_date_color_mode', this.data.calendarTaskDateColorMode);
            this.data.calendarScheduleFollowDocColor = !!Storage.get('tm_calendar_schedule_follow_doc_color', this.data.calendarScheduleFollowDocColor);
            this.data.calendar3DayTodayPosition = Number(Storage.get('tm_calendar_3day_today_position', this.data.calendar3DayTodayPosition));
            this.data.calendarNewScheduleMaxDurationMin = Number(Storage.get('tm_calendar_new_schedule_max_duration_min', this.data.calendarNewScheduleMaxDurationMin));
            this.data.calendarQuickAddScheduleTimeMode = String(Storage.get('tm_calendar_quick_add_schedule_time_mode', this.data.calendarQuickAddScheduleTimeMode) || 'current');
            this.data.calendarQuickAddScheduleCustomTime = String(Storage.get('tm_calendar_quick_add_schedule_custom_time', this.data.calendarQuickAddScheduleCustomTime) || '09:00');
            this.data.calendarHourSlotHeightMode = Storage.get('tm_calendar_hour_slot_height_mode', this.data.calendarHourSlotHeightMode);
            this.data.calendarVisibleStartTime = String(Storage.get('tm_calendar_visible_start_time', this.data.calendarVisibleStartTime) || this.data.calendarVisibleStartTime || '00:00');
            this.data.calendarVisibleEndTime = String(Storage.get('tm_calendar_visible_end_time', this.data.calendarVisibleEndTime) || this.data.calendarVisibleEndTime || '24:00');
            this.data.calendarScheduleColor = Storage.get('tm_calendar_schedule_color', this.data.calendarScheduleColor);
            this.data.calendarTaskDatesColor = Storage.get('tm_calendar_task_dates_color', this.data.calendarTaskDatesColor);
            this.data.calendarShowCnHoliday = Storage.get('tm_calendar_show_cn_holiday', this.data.calendarShowCnHoliday);
            this.data.calendarCnHolidayColor = Storage.get('tm_calendar_cn_holiday_color', this.data.calendarCnHolidayColor);
            this.data.calendarShowLunar = Storage.get('tm_calendar_show_lunar', this.data.calendarShowLunar);
            this.data.calendarSideDockEnabled = Storage.get('tm_calendar_side_dock_enabled', this.data.calendarSideDockEnabled);
            this.data.calendarSideDockWidth = Storage.get('tm_calendar_side_dock_width', this.data.calendarSideDockWidth);
            this.data.checklistDetailWidth = Storage.get('tm_checklist_detail_width', this.data.checklistDetailWidth);
            this.data.docTopbarButtonDesktop = !!Storage.get('tm_doc_topbar_button_desktop', this.data.docTopbarButtonDesktop);
            this.data.docTopbarButtonMobile = !!Storage.get('tm_doc_topbar_button_mobile', this.data.docTopbarButtonMobile);
            this.data.docTopbarButtonSwapPressActions = !!Storage.get('tm_doc_topbar_button_swap_press_actions', this.data.docTopbarButtonSwapPressActions);
            this.data.docTopbarButtonLocateCurrentDocTab = !!Storage.get('tm_doc_topbar_button_locate_current_doc_tab', this.data.docTopbarButtonLocateCurrentDocTab);
            this.data.windowTopbarIconDesktop = !!Storage.get('tm_window_topbar_icon_desktop', this.data.windowTopbarIconDesktop);
            this.data.windowTopbarIconMobile = !!Storage.get('tm_window_topbar_icon_mobile', this.data.windowTopbarIconMobile);
            this.data.semanticDateAutoPromptEnabled = !!Storage.get('tm_semantic_date_auto_prompt_enabled', this.data.semanticDateAutoPromptEnabled);
            this.data.calendarColorFocus = Storage.get('tm_calendar_color_focus', this.data.calendarColorFocus);
            this.data.calendarColorBreak = Storage.get('tm_calendar_color_break', this.data.calendarColorBreak);
            this.data.calendarColorStopwatch = Storage.get('tm_calendar_color_stopwatch', this.data.calendarColorStopwatch);
            this.data.calendarColorIdle = Storage.get('tm_calendar_color_idle', this.data.calendarColorIdle);
            this.data.calendarSidebarWidth = Storage.get('tm_calendar_sidebar_width', this.data.calendarSidebarWidth);
            this.data.calendarSidebarDefaultPage = Storage.get('tm_calendar_sidebar_default_page', this.data.calendarSidebarDefaultPage);
            this.data.calendarSidebarCollapsedDesktopDefault = !!Storage.get('tm_calendar_sidebar_collapsed_desktop_default', this.data.calendarSidebarCollapsedDesktopDefault);
            this.data.calendarColumnWidths = Storage.get('tm_calendar_column_widths', this.data.calendarColumnWidths) || this.data.calendarColumnWidths;
            this.data.calendarLastViewType = Storage.get('tm_calendar_last_view_type', this.data.calendarLastViewType);
            this.data.calendarLastDate = Storage.get('tm_calendar_last_date', this.data.calendarLastDate);
            this.data.calendarCalendarsConfig = Storage.get('tm_calendar_calendars_config', this.data.calendarCalendarsConfig) || this.data.calendarCalendarsConfig;
            this.data.calendarDefaultCalendarId = Storage.get('tm_calendar_default_calendar_id', this.data.calendarDefaultCalendarId);
            this.data.calendarSidebarCollapseCalendars = Storage.get('tm_calendar_sidebar_collapse_calendars', this.data.calendarSidebarCollapseCalendars);
            this.data.calendarSidebarCollapseDocGroups = Storage.get('tm_calendar_sidebar_collapse_doc_groups', this.data.calendarSidebarCollapseDocGroups);
            this.data.calendarSidebarCollapseTomato = Storage.get('tm_calendar_sidebar_collapse_tomato', this.data.calendarSidebarCollapseTomato);
            this.data.calendarSidebarCollapseTasks = Storage.get('tm_calendar_sidebar_collapse_tasks', this.data.calendarSidebarCollapseTasks);
            this.data.defaultDocId = Storage.get('tm_default_doc_id', '');
            this.data.defaultDocIdByGroup = Storage.get('tm_default_doc_id_by_group', {}) || {};
            this.data.allDocsExcludedDocIds = Storage.get('tm_all_docs_excluded_doc_ids', this.data.allDocsExcludedDocIds) || [];
            this.data.priorityScoreConfig = Storage.get('tm_priority_score_config', this.data.priorityScoreConfig) || this.data.priorityScoreConfig;
            this.data.quadrantConfig = Storage.get('tm_quadrant_config', this.data.quadrantConfig);
            this.data.docGroups = Storage.get('tm_doc_groups', []);
            this.data.otherBlockRefs = Storage.get('tm_other_block_refs', this.data.otherBlockRefs) || [];
            this.data.docPinnedByGroup = Storage.get('tm_doc_pinned_by_group', this.data.docPinnedByGroup) || {};
            this.data.currentGroupId = Storage.get('tm_current_group_id', 'all');
            this.data.customStatusOptions = Storage.get('tm_custom_status_options', this.data.customStatusOptions);
            this.data.customDurationOptions = Storage.get('tm_custom_duration_options', this.data.customDurationOptions);
            this.data.checkboxDoneStatusId = String(Storage.get('tm_checkbox_done_status_id', this.data.checkboxDoneStatusId) || this.data.checkboxDoneStatusId || '');
            this.data.checkboxUndoneStatusId = String(Storage.get('tm_checkbox_undone_status_id', this.data.checkboxUndoneStatusId) || this.data.checkboxUndoneStatusId || '');
            this.data.customFieldDefs = Storage.get('tm_custom_field_defs', this.data.customFieldDefs) || this.data.customFieldDefs;
            this.data.customFieldDefsVersion = __tmParseVersionNumber(Storage.get('tm_custom_field_defs_version', this.data.customFieldDefsVersion));
            this.data.taskHeadingLevel = Storage.get('tm_task_heading_level', this.data.taskHeadingLevel);
            this.data.columnOrder = Storage.get('tm_column_order', this.data.columnOrder);
            this.data.hiddenColumns = Storage.get('tm_hidden_columns', this.data.hiddenColumns);
            this.data.durationFormat = Storage.get('tm_duration_format', this.data.durationFormat);
            const hasStoredShowCompletedTasks = Storage.has('tm_show_completed_tasks');
            if (hasStoredShowCompletedTasks) {
                this.data.showCompletedTasks = Storage.get('tm_show_completed_tasks', this.data.showCompletedTasks);
            }
            this.data.excludeCompletedTasks = Storage.get('tm_exclude_completed_tasks', this.data.excludeCompletedTasks);
            if (!hasStoredShowCompletedTasks) this.data.showCompletedTasks = !this.data.excludeCompletedTasks;
            __tmNormalizeCompletedVisibilitySettings(this.data);
            this.data.startDate = Storage.get('tm_start_date', this.data.startDate);
            this.data.timelineLeftWidth = Storage.get('tm_timeline_left_width', this.data.timelineLeftWidth);
            this.data.timelineSidebarCollapsed = !!Storage.get('tm_timeline_sidebar_collapsed', this.data.timelineSidebarCollapsed);
            this.data.timelineContentWidth = Storage.get('tm_timeline_content_width', this.data.timelineContentWidth);
            this.data.timelineCardFields = __tmNormalizeTimelineCardFields(Storage.get('tm_timeline_card_fields', this.data.timelineCardFields));
            this.data.timelineForceSortByCompletionNearToday = Storage.get('tm_timeline_force_sort_completion_near_today', this.data.timelineForceSortByCompletionNearToday);
            this.data.groupSortByBestSubtaskTimeInTimeQuadrant = Storage.get('tm_group_sort_best_subtask_time_time_quadrant', this.data.groupSortByBestSubtaskTimeInTimeQuadrant);
            this.data.whiteboardLinks = Storage.get('tm_whiteboard_links', this.data.whiteboardLinks) || [];
            this.data.whiteboardAutoConnectByCreated = Storage.get('tm_whiteboard_auto_connect_by_created', this.data.whiteboardAutoConnectByCreated);
            this.data.whiteboardDetachedChildren = Storage.get('tm_whiteboard_detached_children', this.data.whiteboardDetachedChildren) || {};
            this.data.whiteboardNotes = Storage.get('tm_whiteboard_notes', this.data.whiteboardNotes) || [];
            this.data.whiteboardTool = Storage.get('tm_whiteboard_tool', this.data.whiteboardTool);
            this.data.whiteboardSidebarCollapsed = Storage.get('tm_whiteboard_sidebar_collapsed', this.data.whiteboardSidebarCollapsed);
            this.data.whiteboardSidebarWidth = Storage.get('tm_whiteboard_sidebar_width', this.data.whiteboardSidebarWidth);
            this.data.whiteboardShowDone = Storage.get('tm_whiteboard_show_done', this.data.whiteboardShowDone);
            this.data.whiteboardNavigatorHidden = !!Storage.get('tm_whiteboard_navigator_hidden', this.data.whiteboardNavigatorHidden);
            this.data.whiteboardCardFields = Storage.get('tm_whiteboard_card_fields', this.data.whiteboardCardFields) || this.data.whiteboardCardFields;
            this.data.whiteboardView = Storage.get('tm_whiteboard_view', this.data.whiteboardView) || this.data.whiteboardView;
            this.data.collapseAllIncludesGroups = !!Storage.get('tm_collapse_all_includes_groups', this.data.collapseAllIncludesGroups);
            this.data.whiteboardNodePos = Storage.get('tm_whiteboard_node_pos', this.data.whiteboardNodePos) || {};
            this.data.whiteboardAutoLayout = Storage.get('tm_whiteboard_auto_layout', this.data.whiteboardAutoLayout);
            this.data.whiteboardPlacedTaskIds = Storage.get('tm_whiteboard_placed_task_ids', this.data.whiteboardPlacedTaskIds) || {};
            this.data.whiteboardStateVersion = Number(Storage.get('tm_whiteboard_state_version', this.data.whiteboardStateVersion)) || 0;
            this.data.whiteboardDocFrameSize = Storage.get('tm_whiteboard_doc_frame_size', this.data.whiteboardDocFrameSize) || {};
            this.data.whiteboardAllTabsLayoutMode = Storage.get('tm_whiteboard_all_tabs_layout_mode', this.data.whiteboardAllTabsLayoutMode);
            this.data.whiteboardAllTabsDocOrderByGroup = Storage.get('tm_whiteboard_all_tabs_doc_order_by_group', this.data.whiteboardAllTabsDocOrderByGroup) || {};
            this.data.whiteboardSequenceMode = Storage.get('tm_whiteboard_sequence_mode', this.data.whiteboardSequenceMode);
            this.data.docColorMap = Storage.get('tm_doc_color_map', this.data.docColorMap) || {};
            this.data.docColorSeed = Storage.get('tm_doc_color_seed', this.data.docColorSeed);
            this.data.docDefaultColorScheme = Storage.get('tm_doc_default_color_scheme', this.data.docDefaultColorScheme) || this.data.docDefaultColorScheme;
            this.data.themeConfig = Storage.get('tm_theme_config', this.data.themeConfig) || this.data.themeConfig;
            this.data.priorityIconStyle = String(Storage.get('tm_priority_icon_style', this.data.priorityIconStyle) || this.data.priorityIconStyle || 'jira').trim() === 'flag' ? 'flag' : 'jira';
            this.data.enableGroupTaskBgByGroupColor = Storage.get('tm_enable_group_task_bg_by_group_color', this.data.enableGroupTaskBgByGroupColor);
            this.data.aiEnabled = !!Storage.get('tm_ai_enabled', this.data.aiEnabled);
            this.data.aiSideDockEnabled = !!Storage.get('tm_ai_side_dock_enabled', this.data.aiSideDockEnabled);
            this.data.aiProvider = String(Storage.get('tm_ai_provider', this.data.aiProvider) || this.data.aiProvider).trim() === 'deepseek' ? 'deepseek' : 'minimax';
            this.data.aiMiniMaxApiKey = String(Storage.get('tm_ai_minimax_api_key', this.data.aiMiniMaxApiKey) || '');
            this.data.aiMiniMaxBaseUrl = String(Storage.get('tm_ai_minimax_base_url', this.data.aiMiniMaxBaseUrl) || this.data.aiMiniMaxBaseUrl).trim() || 'https://api.minimaxi.com/anthropic';
            this.data.aiMiniMaxModel = String(Storage.get('tm_ai_minimax_model', this.data.aiMiniMaxModel) || this.data.aiMiniMaxModel).trim() || 'MiniMax-M2.5';
            this.data.aiDeepSeekApiKey = String(Storage.get('tm_ai_deepseek_api_key', this.data.aiDeepSeekApiKey) || '');
            this.data.aiDeepSeekBaseUrl = String(Storage.get('tm_ai_deepseek_base_url', this.data.aiDeepSeekBaseUrl) || this.data.aiDeepSeekBaseUrl).trim() || 'https://api.deepseek.com';
            this.data.aiDeepSeekModel = String(Storage.get('tm_ai_deepseek_model', this.data.aiDeepSeekModel) || this.data.aiDeepSeekModel).trim() || 'deepseek-chat';
            this.data.aiMiniMaxTemperature = Number(Storage.get('tm_ai_minimax_temperature', this.data.aiMiniMaxTemperature));
            this.data.aiMiniMaxMaxTokens = Number(Storage.get('tm_ai_minimax_max_tokens', this.data.aiMiniMaxMaxTokens));
            this.data.aiMiniMaxTimeoutMs = Number(Storage.get('tm_ai_minimax_timeout_ms', this.data.aiMiniMaxTimeoutMs));
            this.data.aiDefaultContextMode = String(Storage.get('tm_ai_default_context_mode', this.data.aiDefaultContextMode) || this.data.aiDefaultContextMode).trim() === 'fulltext' ? 'fulltext' : 'nearby';
            this.data.aiScheduleWindows = Storage.get('tm_ai_schedule_windows', this.data.aiScheduleWindows) || this.data.aiScheduleWindows;
            if (!Number.isFinite(this.data.aiMiniMaxTemperature)) this.data.aiMiniMaxTemperature = 0.2;
            if (!Number.isFinite(this.data.aiMiniMaxMaxTokens)) this.data.aiMiniMaxMaxTokens = 1600;
            if (!Number.isFinite(this.data.aiMiniMaxTimeoutMs)) this.data.aiMiniMaxTimeoutMs = 30000;
            if (!Array.isArray(this.data.aiScheduleWindows)) this.data.aiScheduleWindows = String(this.data.aiScheduleWindows || '').split(/\r?\n/);
            this.data.aiScheduleWindows = this.data.aiScheduleWindows.map(v => String(v || '').trim()).filter(Boolean);
            if (!this.data.aiScheduleWindows.length) this.data.aiScheduleWindows = ['09:00-18:00'];
            this.data.serverSyncOnManualRefresh = !!Storage.get('tm_server_sync_on_manual_refresh', this.data.serverSyncOnManualRefresh);
            this.data.serverSyncSessionStateOnManualRefresh = !!Storage.get('tm_server_sync_session_state_on_manual_refresh', this.data.serverSyncSessionStateOnManualRefresh);
            this.data.newTaskDailyNoteAppendToBottom = !!Storage.get('tm_new_task_daily_note_append_to_bottom', this.data.newTaskDailyNoteAppendToBottom);
            this.data.headingGroupCreateAtSectionEnd = !!Storage.get('tm_heading_group_create_at_section_end', this.data.headingGroupCreateAtSectionEnd);
            this.data.desktopChecklistCompactMetaFields = __tmNormalizeCompactChecklistMetaFields(this.data.desktopChecklistCompactMetaFields);
            this.data.dockChecklistCompactMetaFields = __tmNormalizeCompactChecklistMetaFields(this.data.dockChecklistCompactMetaFields);
            this.data.mobileChecklistCompactMetaFields = __tmNormalizeCompactChecklistMetaFields(this.data.mobileChecklistCompactMetaFields, this.data.dockChecklistCompactMetaFields);
            {
                const allowInlineFields = new Set(['custom-status', 'custom-completion-time', 'custom-priority', 'custom-start-date', 'custom-duration', 'custom-remark']);
                const rawInlineFields = Array.isArray(this.data.quickbarInlineFields) ? this.data.quickbarInlineFields : ['custom-status', 'custom-completion-time'];
                const seenInlineFields = new Set();
                this.data.quickbarInlineFields = rawInlineFields.map((v) => {
                    const key = String(v || '').trim();
                    const customFieldId = __tmParseCustomFieldColumnKey(key);
                    return customFieldId ? `customField:${customFieldId}` : key;
                }).filter((v) => {
                    if ((!allowInlineFields.has(v) && !__tmParseCustomFieldColumnKey(v)) || seenInlineFields.has(v)) return false;
                    seenInlineFields.add(v);
                    return true;
                });
                if (!this.data.quickbarInlineFields.length) this.data.quickbarInlineFields = ['custom-status', 'custom-completion-time'];
            }
            {
                const allowQuickbarVisibleItems = new Set(['custom-status', 'custom-priority', 'custom-start-date', 'custom-completion-time', 'custom-duration', 'custom-remark', 'action-ai-title', 'action-reminder', 'action-more']);
                const rawQuickbarVisibleItems = Array.isArray(this.data.quickbarVisibleItems) ? this.data.quickbarVisibleItems : ['custom-status', 'custom-priority', 'custom-start-date', 'custom-completion-time', 'custom-duration', 'custom-remark', 'action-ai-title', 'action-reminder', 'action-more'];
                const seenQuickbarVisibleItems = new Set();
                this.data.quickbarVisibleItems = rawQuickbarVisibleItems.map((v) => {
                    const key = String(v || '').trim();
                    const customFieldId = __tmParseCustomFieldColumnKey(key);
                    return customFieldId ? `customField:${customFieldId}` : key;
                }).filter((v) => {
                    if ((!allowQuickbarVisibleItems.has(v) && !__tmParseCustomFieldColumnKey(v)) || seenQuickbarVisibleItems.has(v)) return false;
                    seenQuickbarVisibleItems.add(v);
                    return true;
                });
            }
            const savedWidths = Storage.get('tm_column_widths', null);
            if (savedWidths && typeof savedWidths === 'object') {
                if (savedWidths.customTime && !savedWidths.completionTime) {
                    savedWidths.completionTime = savedWidths.customTime;
                }
                this.data.columnWidths = { ...this.data.columnWidths, ...savedWidths };
            }
            this.data.otherBlockRefs = __tmNormalizeOtherBlockRefs(this.data.otherBlockRefs);
            __tmNormalizeCheckboxStatusBindingConfig(this.data);
            this.data.customDurationOptions = __tmNormalizeCustomDurationOptions(this.data.customDurationOptions);
            const validModes = new Set(['none', 'doc', 'time', 'quadrant', 'task']);
            if (!validModes.has(String(this.data.groupMode || ''))) {
                // groupMode 无效时，根据标志位推导模式
                const q = !!(this.data.quadrantConfig && this.data.quadrantConfig.enabled);
                this.data.groupMode = q ? 'quadrant' : (this.data.groupByTime ? 'time' : (this.data.groupByDocName ? 'doc' : (this.data.groupByTaskName ? 'task' : 'none')));
            }
            this.data.viewProfiles = __tmNormalizeViewProfiles(this.data.viewProfiles, {
                ruleId: this.data.currentRule,
                groupMode: this.data.groupMode
            });
            // 根据 groupMode 设置标志位，但 groupByTaskName 只在 groupMode === 'task' 时才设置为 true
            // 这样切换到其他模式后，groupByTaskName 的值会被保留，设置开关就不会被关闭
            // 但需要在 groupMode === 'none' 时额外检查 groupByTaskName 是否为 true，如果是则设置为 'task'
            if (this.data.groupMode === 'doc') {
                this.data.groupByDocName = true;
                this.data.groupByTime = false;
                this.data.quadrantConfig = this.data.quadrantConfig || {};
                this.data.quadrantConfig.enabled = false;
            } else if (this.data.groupMode === 'time') {
                this.data.groupByDocName = false;
                this.data.groupByTime = true;
                this.data.quadrantConfig = this.data.quadrantConfig || {};
                this.data.quadrantConfig.enabled = false;
            } else if (this.data.groupMode === 'task') {
                this.data.groupByDocName = false;
                this.data.groupByTaskName = true;
                this.data.groupByTime = false;
                this.data.quadrantConfig = this.data.quadrantConfig || {};
                this.data.quadrantConfig.enabled = false;
            } else if (this.data.groupMode === 'quadrant') {
                this.data.groupByDocName = false;
                this.data.groupByTime = false;
                this.data.quadrantConfig = this.data.quadrantConfig || {};
                this.data.quadrantConfig.enabled = true;
            } else {
                this.data.groupByDocName = false;
                this.data.groupByTime = false;
                this.data.quadrantConfig = this.data.quadrantConfig || {};
                this.data.quadrantConfig.enabled = false;
                // 当 groupMode 为 'none' 时，保持 groupMode 不变
                // 这样可以保留用户上次选择的分组模式（即使设置开关开启）
                // 只有当 groupMode 无效时才设置为 'none'
                if (!this.data.groupMode || this.data.groupMode === 'none') {
                    this.data.groupMode = 'none';
                }
                // 注意：这里不再强制将 groupMode 设置为 'task'
                // 因为用户可能选择了"不分组"或其他分组模式
            }
            this.data.docDisplayNameMode = __tmNormalizeDocDisplayNameMode(this.data.docDisplayNameMode);
            this.data.timelineSidebarCollapsed = !!this.data.timelineSidebarCollapsed;
            this.data.timelineCardFields = __tmNormalizeTimelineCardFields(this.data.timelineCardFields);
            {
                const normalizedFieldMap = __tmNormalizeSettingsFieldUpdatedAtMap(this.data.settingsFieldUpdatedAt, this.data);
                this.data.settingsFieldUpdatedAt = __tmLooksLegacySeededSettingsFieldMap(normalizedFieldMap, this.data) ? {} : normalizedFieldMap;
            }
            this.normalizeColumns();
        },

        // 同步到本地缓存
        syncToLocal() {
            Storage.set('tm_settings_updated_at', Number(this.data.settingsUpdatedAt) || 0);
            this.data.settingsFieldUpdatedAt = __tmNormalizeSettingsFieldUpdatedAtMap(this.data.settingsFieldUpdatedAt, this.data);
            Storage.set('tm_settings_field_updated_at', this.data.settingsFieldUpdatedAt);
            Storage.set('tm_doc_group_settings_updated_at', Number(this.data.docGroupSettingsUpdatedAt) || 0);
            Storage.set('tm_collapse_state_updated_at', Number(this.data.collapseStateUpdatedAt) || 0);
            Storage.set('tm_selected_doc_ids', this.data.selectedDocIds);
            this.data.queryLimit = __TM_TASK_INDEX_QUERY_LIMIT;
            Storage.set('tm_recursive_doc_limit', this.data.recursiveDocLimit);
            Storage.set('tm_legacy_win7_compat_mode', !!this.data.legacyWin7CompatMode);
            this.data.taskParentLookupDepth = __tmNormalizeTaskParentLookupDepth(this.data.taskParentLookupDepth);
            Storage.set('tm_task_parent_lookup_depth', this.data.taskParentLookupDepth);
            Storage.set('tm_group_by_docname', this.data.groupByDocName);
            Storage.set('tm_group_by_time', this.data.groupByTime);
            this.data.enabledViews = __tmNormalizeEnabledViews(this.data.enabledViews);
            this.data.defaultViewMode = __tmGetSafeViewMode(this.data.defaultViewMode);
            this.data.defaultViewModeMobile = __tmGetSafeViewMode(this.data.defaultViewModeMobile || this.data.defaultViewMode);
            this.data.dockSidebarEnabled = this.data.dockSidebarEnabled !== false;
            Storage.set('tm_default_view_mode', String(this.data.defaultViewMode || 'checklist').trim() || 'checklist');
            Storage.set('tm_default_view_mode_mobile', String(this.data.defaultViewModeMobile || this.data.defaultViewMode || 'checklist').trim() || 'checklist');
            Storage.set('tm_dock_sidebar_enabled', !!this.data.dockSidebarEnabled);
            Storage.set('tm_dock_default_view_mode', String(this.data.dockDefaultViewMode || 'follow-mobile').trim() || 'follow-mobile');
            Storage.set('tm_dock_checklist_compact_title_jump', !!this.data.dockChecklistCompactTitleJump);
            Storage.set('tm_mobile_checklist_compact_title_jump', !!this.data.mobileChecklistCompactTitleJump);
            this.data.desktopChecklistCompactMetaFields = __tmNormalizeCompactChecklistMetaFields(this.data.desktopChecklistCompactMetaFields);
            this.data.dockChecklistCompactMetaFields = __tmNormalizeCompactChecklistMetaFields(this.data.dockChecklistCompactMetaFields);
            this.data.mobileChecklistCompactMetaFields = __tmNormalizeCompactChecklistMetaFields(this.data.mobileChecklistCompactMetaFields, this.data.dockChecklistCompactMetaFields);
            this.data.checklistCompactRightFontSize = __tmNormalizeChecklistCompactRightFontSize(this.data.checklistCompactRightFontSize);
            Storage.set('tm_desktop_checklist_compact_meta_fields', this.data.desktopChecklistCompactMetaFields);
            Storage.set('tm_dock_checklist_compact_meta_fields', this.data.dockChecklistCompactMetaFields);
            Storage.set('tm_mobile_checklist_compact_meta_fields', this.data.mobileChecklistCompactMetaFields);
            Storage.set('tm_checklist_compact_right_font_size', this.data.checklistCompactRightFontSize);
            Storage.set('tm_checklist_compact_title_open_detail_page', !!this.data.checklistCompactTitleOpenDetailPage);
            Storage.set('tm_enabled_views', this.data.enabledViews);
            Storage.set('tm_kanban_compact_mode', !!this.data.kanbanCompactMode);
            Storage.set('tm_checklist_compact_mode', !!this.data.checklistCompactMode);
            Storage.set('tm_checklist_compact_tree_guides', !!this.data.checklistCompactTreeGuides);
            Storage.set('tm_checklist_compact_tree_guides_updated_at', __tmParseUpdatedAtNumber(this.data.checklistCompactTreeGuidesUpdatedAt));
            Storage.set('tm_kanban_column_width', Number(this.data.kanbanColumnWidth) || 320);
            Storage.set('tm_kanban_fill_columns', !!this.data.kanbanFillColumns);
            Storage.set('tm_kanban_show_done_column', !!this.data.kanbanShowDoneColumn);
            Storage.set('tm_kanban_drag_sync_subtasks', !!this.data.kanbanDragSyncSubtasks);
            Storage.set('tm_kanban_card_fields', this.data.kanbanCardFields || []);
            Storage.set('tm_task_card_date_only_with_value', !!this.data.taskCardDateOnlyWithValue);
            Storage.set('tm_kanban_heading_group_mode', !!this.data.kanbanHeadingGroupMode);
            Storage.set('tm_whiteboard_all_tabs_card_min_width', Number(this.data.whiteboardAllTabsCardMinWidth) || 320);
            Storage.set('tm_whiteboard_stream_mobile_two_columns', !!this.data.whiteboardStreamMobileTwoColumns);
            Storage.set('tm_doc_h2_subgroup_enabled', !!this.data.docH2SubgroupEnabled);
            Storage.set('tm_group_by_taskname', !!this.data.groupByTaskName);
            Storage.set('tm_group_mode', String(this.data.groupMode || '').trim() || 'none');
            Storage.set('tm_collapsed_task_ids', this.data.collapsedTaskIds);
            Storage.set('tm_kanban_collapsed_task_ids', this.data.kanbanCollapsedTaskIds || []);
            Storage.set('tm_collapsed_groups', this.data.collapsedGroups || []);
            Storage.set('tm_expanded_completed_groups', this.data.expandedCompletedGroups || []);
            Storage.set('tm_current_rule', this.data.currentRule);
            Storage.set('tm_view_profiles', __tmNormalizeViewProfiles(this.data.viewProfiles, {
                ruleId: this.data.currentRule,
                groupMode: this.data.groupMode
            }));
            Storage.set('tm_filter_rules', this.data.filterRules);
            Storage.set('tm_font_size', this.data.fontSize);
            Storage.set('tm_font_size_mobile', this.data.fontSizeMobile);
            Storage.set('tm_row_height_mode', String(this.data.rowHeightMode || 'auto').trim() || 'auto');
            Storage.set('tm_row_height_px', Number(this.data.rowHeightPx) || 0);
            Storage.set('tm_topbar_gradient_light_start', String(this.data.topbarGradientLightStart || '').trim());
            Storage.set('tm_topbar_gradient_light_end', String(this.data.topbarGradientLightEnd || '').trim());
            Storage.set('tm_topbar_gradient_dark_start', String(this.data.topbarGradientDarkStart || '').trim());
            Storage.set('tm_topbar_gradient_dark_end', String(this.data.topbarGradientDarkEnd || '').trim());
            Storage.set('tm_topbar_text_color_light', String(this.data.topbarTextColorLight || '').trim());
            Storage.set('tm_topbar_text_color_dark', String(this.data.topbarTextColorDark || '').trim());
            Storage.set('tm_topbar_control_bg_light', String(this.data.topbarControlBgLight || '').trim());
            Storage.set('tm_topbar_control_bg_dark', String(this.data.topbarControlBgDark || '').trim());
            Storage.set('tm_topbar_control_text_light', String(this.data.topbarControlTextLight || '').trim());
            Storage.set('tm_topbar_control_text_dark', String(this.data.topbarControlTextDark || '').trim());
            Storage.set('tm_topbar_control_border_light', String(this.data.topbarControlBorderLight || '').trim());
            Storage.set('tm_topbar_control_border_dark', String(this.data.topbarControlBorderDark || '').trim());
            Storage.set('tm_topbar_control_hover_light', String(this.data.topbarControlHoverLight || '').trim());
            Storage.set('tm_topbar_control_hover_dark', String(this.data.topbarControlHoverDark || '').trim());
            Storage.set('tm_topbar_control_segment_bg_light', String(this.data.topbarControlSegmentBgLight || '').trim());
            Storage.set('tm_topbar_control_segment_bg_dark', String(this.data.topbarControlSegmentBgDark || '').trim());
            Storage.set('tm_topbar_control_segment_active_bg_light', String(this.data.topbarControlSegmentActiveBgLight || '').trim());
            Storage.set('tm_topbar_control_segment_active_bg_dark', String(this.data.topbarControlSegmentActiveBgDark || '').trim());
            Storage.set('tm_topbar_control_shadow_color_light', String(this.data.topbarControlShadowColorLight || '').trim());
            Storage.set('tm_topbar_control_shadow_color_dark', String(this.data.topbarControlShadowColorDark || '').trim());
            Storage.set('tm_topbar_control_radius_px', Number.isFinite(Number(this.data.topbarControlRadiusPx)) ? Number(this.data.topbarControlRadiusPx) : 10);
            Storage.set('tm_topbar_control_border_width_px', Number.isFinite(Number(this.data.topbarControlBorderWidthPx)) ? Number(this.data.topbarControlBorderWidthPx) : 1);
            Storage.set('tm_topbar_control_shadow_y_offset_px', Number.isFinite(Number(this.data.topbarControlShadowYOffsetPx)) ? Number(this.data.topbarControlShadowYOffsetPx) : 0);
            Storage.set('tm_topbar_control_shadow_blur_px', Number.isFinite(Number(this.data.topbarControlShadowBlurPx)) ? Number(this.data.topbarControlShadowBlurPx) : 0);
            Storage.set('tm_topbar_control_shadow_strength_pct', Number.isFinite(Number(this.data.topbarControlShadowStrengthPct)) ? Number(this.data.topbarControlShadowStrengthPct) : 100);
            Storage.set('tm_task_content_color_light', String(this.data.taskContentColorLight || '').trim());
            Storage.set('tm_task_content_color_dark', String(this.data.taskContentColorDark || '').trim());
            Storage.set('tm_task_meta_color_light', String(this.data.taskMetaColorLight || '').trim());
            Storage.set('tm_task_meta_color_dark', String(this.data.taskMetaColorDark || '').trim());
            Storage.set('tm_group_doc_label_color_light', String(this.data.groupDocLabelColorLight || '').trim());
            Storage.set('tm_group_doc_label_color_dark', String(this.data.groupDocLabelColorDark || '').trim());
            Storage.set('tm_time_group_base_color_light', String(this.data.timeGroupBaseColorLight || '').trim());
            Storage.set('tm_time_group_base_color_dark', String(this.data.timeGroupBaseColorDark || '').trim());
            Storage.set('tm_time_group_overdue_color_light', String(this.data.timeGroupOverdueColorLight || '').trim());
            Storage.set('tm_time_group_overdue_color_dark', String(this.data.timeGroupOverdueColorDark || '').trim());
            Storage.set('tm_time_group_pending_task_bg_color_light', String(this.data.timeGroupPendingTaskBgColorLight || '').trim());
            Storage.set('tm_time_group_pending_task_bg_color_dark', String(this.data.timeGroupPendingTaskBgColorDark || '').trim());
            Storage.set('tm_progress_bar_color_light', String(this.data.progressBarColorLight || '').trim());
            Storage.set('tm_progress_bar_color_dark', String(this.data.progressBarColorDark || '').trim());
            Storage.set('tm_calendar_today_highlight_color_light', String(this.data.calendarTodayHighlightColorLight || '').trim());
            Storage.set('tm_calendar_today_highlight_color_dark', String(this.data.calendarTodayHighlightColorDark || '').trim());
            Storage.set('tm_calendar_grid_border_color_light', String(this.data.calendarGridBorderColorLight || '').trim());
            Storage.set('tm_calendar_grid_border_color_dark', String(this.data.calendarGridBorderColorDark || '').trim());
            Storage.set('tm_table_border_color_light', String(this.data.tableBorderColorLight || '').trim());
            Storage.set('tm_table_border_color_dark', String(this.data.tableBorderColorDark || '').trim());
            Storage.set('tm_enable_quickbar', !!this.data.enableQuickbar);
            Storage.set('tm_enable_quickbar_inline_meta', !!this.data.enableQuickbarInlineMeta);
            Storage.set('tm_task_done_delight_enabled', !!this.data.taskDoneDelightEnabled);
            Storage.set('tm_enable_move_block_to_daily_note', !!this.data.enableMoveBlockToDailyNote);
            Storage.set('tm_quickbar_inline_fields', Array.isArray(this.data.quickbarInlineFields) ? this.data.quickbarInlineFields : ['custom-status', 'custom-completion-time']);
            Storage.set('tm_quickbar_visible_items', Array.isArray(this.data.quickbarVisibleItems) ? this.data.quickbarVisibleItems : ['custom-status', 'custom-priority', 'custom-start-date', 'custom-completion-time', 'custom-duration', 'custom-remark', 'action-ai-title', 'action-reminder', 'action-more']);
            Storage.set('tm_quickbar_inline_show_on_mobile', !!this.data.quickbarInlineShowOnMobile);
            Storage.set('tm_pin_new_tasks_by_default', !!this.data.pinNewTasksByDefault);
            Storage.set('tm_task_detail_show_completed_subtasks_by_task', this.data.taskDetailCompletedSubtasksVisibilityByTask || {});
            Storage.set('tm_new_task_doc_id', String(this.data.newTaskDocId || '').trim());
            Storage.set('tm_new_task_daily_note_notebook_id', String(this.data.newTaskDailyNoteNotebookId || '').trim());
            Storage.set('tm_new_task_daily_note_append_to_bottom', !!this.data.newTaskDailyNoteAppendToBottom);
            Storage.set(__TM_QUICK_ADD_RECENT_DOCS_KEY, __tmNormalizeQuickAddRecentDocs(this.data.quickAddRecentDocs));
            Storage.set('tm_heading_group_create_at_section_end', !!this.data.headingGroupCreateAtSectionEnd);
            Storage.set('tm_doc_tab_sort_mode', String(this.data.docTabSortMode || 'created_desc').trim() || 'created_desc');
            Storage.set('tm_doc_display_name_mode', __tmNormalizeDocDisplayNameMode(this.data.docDisplayNameMode));
            Storage.set('tm_priority_icon_style', String(this.data.priorityIconStyle || 'jira').trim() === 'flag' ? 'flag' : 'jira');
            Storage.set('tm_task_auto_wrap_enabled', !!this.data.taskAutoWrapEnabled);
            Storage.set('tm_task_content_wrap_max_lines', Number(this.data.taskContentWrapMaxLines) || 3);
            Storage.set('tm_task_remark_wrap_max_lines', Number(this.data.taskRemarkWrapMaxLines) || 2);
            Storage.set('tm_enable_tomato_integration', !!this.data.enableTomatoIntegration);
            Storage.set('tm_enable_points_reward_integration', !!this.data.enablePointsRewardIntegration);
            Storage.set('tm_enable_points_penalty_integration', !!this.data.enablePointsPenaltyIntegration);
            Storage.set('tm_points_penalty_schedule_enabled', !!this.data.pointsPenaltyScheduleEnabled);
            Storage.set('tm_points_penalty_deadline_enabled', !!this.data.pointsPenaltyDeadlineEnabled);
            Storage.set('tm_points_penalty_schedule_amount', Math.max(0, Math.min(9999, Math.round(Number(this.data.pointsPenaltyScheduleAmount) || 0))));
            Storage.set('tm_points_penalty_deadline_amount', Math.max(0, Math.min(9999, Math.round(Number(this.data.pointsPenaltyDeadlineAmount) || 0))));
            Storage.set('tm_points_penalty_check_times', Array.isArray(this.data.pointsPenaltyCheckTimes) ? this.data.pointsPenaltyCheckTimes : ['23:00', '+1 08:00']);
            Storage.set('tm_points_penalty_check_on_startup', !!this.data.pointsPenaltyCheckOnStartup);
            Storage.set('tm_points_penalty_confirm_modal_enabled', !!this.data.pointsPenaltyConfirmModalEnabled);
            Storage.set('tm_tomato_spent_attr_mode', String(this.data.tomatoSpentAttrMode || 'minutes'));
            Storage.set('tm_tomato_spent_attr_key_minutes', String(this.data.tomatoSpentAttrKeyMinutes || '').trim());
            Storage.set('tm_tomato_spent_attr_key_hours', String(this.data.tomatoSpentAttrKeyHours || '').trim());
            Storage.set('tm_calendar_enabled', !!this.data.calendarEnabled);
            Storage.set('tm_calendar_link_docktomato', !!this.data.calendarLinkDockTomato);
            Storage.set('tm_calendar_initial_view', String(this.data.calendarInitialView || 'timeGridWeek').trim() || 'timeGridWeek');
            Storage.set('tm_calendar_first_day', Number(this.data.calendarFirstDay) === 0 ? 0 : 1);
            Storage.set('tm_calendar_month_aggregate', !!this.data.calendarMonthAggregate);
            Storage.set('tm_calendar_month_adaptive_row_height', !!this.data.calendarMonthAdaptiveRowHeight);
            Storage.set('tm_calendar_month_min_visible_events', Number(this.data.calendarMonthMinVisibleEvents) || 3);
            Storage.set('tm_calendar_show_schedule', !!this.data.calendarShowSchedule);
            Storage.set('tm_calendar_schedule_reminder_enabled', !!this.data.calendarScheduleReminderEnabled);
            Storage.set('tm_calendar_schedule_reminder_system_enabled', !!this.data.calendarScheduleReminderSystemEnabled);
            Storage.set('tm_calendar_schedule_reminder_default_mode', String(this.data.calendarScheduleReminderDefaultMode || '').trim());
            Storage.set('tm_calendar_all_day_reminder_enabled', !!this.data.calendarAllDayReminderEnabled);
            Storage.set('tm_calendar_all_day_reminder_time', String(this.data.calendarAllDayReminderTime || '').trim());
            Storage.set('tm_calendar_taskdate_all_day_reminder_enabled', !!this.data.calendarTaskDateAllDayReminderEnabled);
            Storage.set('tm_calendar_all_day_summary_include_extras', !!this.data.calendarAllDaySummaryIncludeExtras);
            Storage.set('tm_calendar_show_tomato_master', !!this.data.calendarShowTomatoMaster);
            Storage.set('tm_calendar_show_focus', !!this.data.calendarShowFocus);
            Storage.set('tm_calendar_show_break', !!this.data.calendarShowBreak);
            Storage.set('tm_calendar_show_stopwatch', !!this.data.calendarShowStopwatch);
            Storage.set('tm_calendar_show_idle', !!this.data.calendarShowIdle);
            Storage.set('tm_calendar_show_task_dates', !!this.data.calendarShowTaskDates);
            Storage.set('tm_calendar_hide_scheduled_task_dates_in_all_day', !!this.data.calendarHideScheduledTaskDatesInAllDay);
            Storage.set('tm_calendar_show_other_block_checkbox', !!this.data.calendarShowOtherBlockCheckbox);
            Storage.set('tm_calendar_task_date_color_mode', String(this.data.calendarTaskDateColorMode || 'group').trim() || 'group');
            Storage.set('tm_calendar_schedule_follow_doc_color', !!this.data.calendarScheduleFollowDocColor);
            Storage.set('tm_calendar_3day_today_position', Number(this.data.calendar3DayTodayPosition) || 1);
            Storage.set('tm_calendar_new_schedule_max_duration_min', Number(this.data.calendarNewScheduleMaxDurationMin) || 60);
            Storage.set('tm_calendar_quick_add_schedule_time_mode', String(this.data.calendarQuickAddScheduleTimeMode || 'current').trim() || 'current');
            Storage.set('tm_calendar_quick_add_schedule_custom_time', String(this.data.calendarQuickAddScheduleCustomTime || '09:00').trim() || '09:00');
            Storage.set('tm_calendar_hour_slot_height_mode', String(this.data.calendarHourSlotHeightMode || 'normal').trim() || 'normal');
            Storage.set('tm_calendar_visible_start_time', String(this.data.calendarVisibleStartTime || '00:00').trim() || '00:00');
            Storage.set('tm_calendar_visible_end_time', String(this.data.calendarVisibleEndTime || '24:00').trim() || '24:00');
            Storage.set('tm_calendar_schedule_color', String(this.data.calendarScheduleColor || '').trim());
            Storage.set('tm_calendar_task_dates_color', String(this.data.calendarTaskDatesColor || '').trim());
            Storage.set('tm_calendar_show_cn_holiday', !!this.data.calendarShowCnHoliday);
            Storage.set('tm_calendar_cn_holiday_color', String(this.data.calendarCnHolidayColor || '').trim());
            Storage.set('tm_calendar_show_lunar', !!this.data.calendarShowLunar);
            Storage.set('tm_calendar_side_dock_enabled', !!this.data.calendarSideDockEnabled);
            Storage.set('tm_calendar_side_dock_width', Number(this.data.calendarSideDockWidth) || 340);
            Storage.set('tm_checklist_detail_width', Number(this.data.checklistDetailWidth) || 320);
            Storage.set('tm_doc_topbar_button_desktop', !!this.data.docTopbarButtonDesktop);
            Storage.set('tm_doc_topbar_button_mobile', !!this.data.docTopbarButtonMobile);
            Storage.set('tm_doc_topbar_button_swap_press_actions', !!this.data.docTopbarButtonSwapPressActions);
            Storage.set('tm_doc_topbar_button_locate_current_doc_tab', !!this.data.docTopbarButtonLocateCurrentDocTab);
            Storage.set('tm_window_topbar_icon_desktop', !!this.data.windowTopbarIconDesktop);
            Storage.set('tm_window_topbar_icon_mobile', !!this.data.windowTopbarIconMobile);
            Storage.set('tm_semantic_date_auto_prompt_enabled', !!this.data.semanticDateAutoPromptEnabled);
            Storage.set('tm_calendar_color_focus', String(this.data.calendarColorFocus || '').trim());
            Storage.set('tm_calendar_color_break', String(this.data.calendarColorBreak || '').trim());
            Storage.set('tm_calendar_color_stopwatch', String(this.data.calendarColorStopwatch || '').trim());
            Storage.set('tm_calendar_color_idle', String(this.data.calendarColorIdle || '').trim());
            Storage.set('tm_calendar_sidebar_width', Number(this.data.calendarSidebarWidth) || 280);
            Storage.set('tm_calendar_sidebar_default_page', String(this.data.calendarSidebarDefaultPage || '').trim() === 'tasks' ? 'tasks' : 'calendar');
            Storage.set('tm_calendar_sidebar_collapsed_desktop_default', !!this.data.calendarSidebarCollapsedDesktopDefault);
            Storage.set('tm_calendar_column_widths', this.data.calendarColumnWidths || {});
            Storage.set('tm_calendar_last_view_type', String(this.data.calendarLastViewType || '').trim());
            Storage.set('tm_calendar_last_date', String(this.data.calendarLastDate || '').trim());
            Storage.set('tm_calendar_calendars_config', this.data.calendarCalendarsConfig || {});
            Storage.set('tm_calendar_default_calendar_id', String(this.data.calendarDefaultCalendarId || 'default').trim() || 'default');
            Storage.set('tm_calendar_sidebar_collapse_calendars', !!this.data.calendarSidebarCollapseCalendars);
            Storage.set('tm_calendar_sidebar_collapse_doc_groups', !!this.data.calendarSidebarCollapseDocGroups);
            Storage.set('tm_calendar_sidebar_collapse_tomato', !!this.data.calendarSidebarCollapseTomato);
            Storage.set('tm_calendar_sidebar_collapse_tasks', !!this.data.calendarSidebarCollapseTasks);
            Storage.set('tm_default_doc_id', this.data.defaultDocId);
            Storage.set('tm_default_doc_id_by_group', this.data.defaultDocIdByGroup || {});
            Storage.set('tm_all_docs_excluded_doc_ids', __tmNormalizeDocGroupExcludedDocIds(this.data.allDocsExcludedDocIds));
            Storage.set('tm_priority_score_config', this.data.priorityScoreConfig || {});
            Storage.set('tm_quadrant_config', this.data.quadrantConfig);
            Storage.set('tm_doc_groups', this.data.docGroups);
            const legacyOtherBlockRefs = __tmNormalizeOtherBlockRefs(this.data.otherBlockRefs);
            if (legacyOtherBlockRefs.length > 0) Storage.set('tm_other_block_refs', legacyOtherBlockRefs);
            else Storage.remove('tm_other_block_refs');
            Storage.set('tm_doc_pinned_by_group', this.data.docPinnedByGroup || {});
            Storage.set('tm_current_group_id', this.data.currentGroupId);
            __tmNormalizeCheckboxStatusBindingConfig(this.data);
            Storage.set('tm_custom_status_options', this.data.customStatusOptions);
            this.data.customDurationOptions = __tmNormalizeCustomDurationOptions(this.data.customDurationOptions);
            Storage.set('tm_custom_duration_options', this.data.customDurationOptions);
            Storage.set('tm_checkbox_done_status_id', String(this.data.checkboxDoneStatusId || '').trim());
            Storage.set('tm_checkbox_undone_status_id', String(this.data.checkboxUndoneStatusId || '').trim());
            Storage.set('tm_custom_field_defs', Array.isArray(this.data.customFieldDefs) ? this.data.customFieldDefs : []);
            Storage.set('tm_custom_field_defs_version', __tmParseVersionNumber(this.data.customFieldDefsVersion));
            Storage.set('tm_task_heading_level', String(this.data.taskHeadingLevel || 'h2').trim() || 'h2');
            Storage.set('tm_column_widths', this.data.columnWidths);
            Storage.set('tm_column_order', this.data.columnOrder);
            Storage.set('tm_hidden_columns', Array.isArray(this.data.hiddenColumns) ? this.data.hiddenColumns : []);
            Storage.set('tm_duration_format', String(this.data.durationFormat || 'hours').trim() === 'minutes' ? 'minutes' : 'hours');
            __tmNormalizeCompletedVisibilitySettings(this.data);
            Storage.set('tm_show_completed_tasks', !!this.data.showCompletedTasks);
            Storage.set('tm_exclude_completed_tasks', !!this.data.excludeCompletedTasks);
            Storage.set('tm_start_date', Number(this.data.startDate) || 90);
            Storage.set('tm_timeline_left_width', this.data.timelineLeftWidth);
            Storage.set('tm_timeline_sidebar_collapsed', !!this.data.timelineSidebarCollapsed);
            Storage.set('tm_timeline_content_width', this.data.timelineContentWidth);
            this.data.timelineCardFields = __tmNormalizeTimelineCardFields(this.data.timelineCardFields);
            Storage.set('tm_timeline_card_fields', this.data.timelineCardFields);
            Storage.set('tm_timeline_force_sort_completion_near_today', !!this.data.timelineForceSortByCompletionNearToday);
            Storage.set('tm_group_sort_best_subtask_time_time_quadrant', !!this.data.groupSortByBestSubtaskTimeInTimeQuadrant);
            Storage.set('tm_whiteboard_links', this.data.whiteboardLinks || []);
            Storage.set('tm_whiteboard_auto_connect_by_created', !!this.data.whiteboardAutoConnectByCreated);
            Storage.set('tm_whiteboard_detached_children', this.data.whiteboardDetachedChildren || {});
            Storage.set('tm_whiteboard_notes', this.data.whiteboardNotes || []);
            Storage.set('tm_whiteboard_tool', String(this.data.whiteboardTool || 'pan').trim() || 'pan');
            Storage.set('tm_whiteboard_sidebar_collapsed', !!this.data.whiteboardSidebarCollapsed);
            Storage.set('tm_whiteboard_sidebar_width', Number(this.data.whiteboardSidebarWidth) || 300);
            Storage.set('tm_whiteboard_show_done', !!this.data.whiteboardShowDone);
            Storage.set('tm_whiteboard_navigator_hidden', !!this.data.whiteboardNavigatorHidden);
            Storage.set('tm_whiteboard_card_fields', this.data.whiteboardCardFields || []);
            Storage.set('tm_whiteboard_view', this.data.whiteboardView || { x: 64, y: 40, zoom: 1 });
            Storage.set('tm_collapse_all_includes_groups', !!this.data.collapseAllIncludesGroups);
            Storage.set('tm_whiteboard_node_pos', this.data.whiteboardNodePos || {});
            Storage.set('tm_whiteboard_auto_layout', this.data.whiteboardAutoLayout !== false);
            Storage.set('tm_whiteboard_placed_task_ids', this.data.whiteboardPlacedTaskIds || {});
            Storage.set('tm_whiteboard_state_version', __tmParseVersionNumber(this.data.whiteboardStateVersion));
            Storage.set('tm_whiteboard_doc_frame_size', this.data.whiteboardDocFrameSize || {});
            Storage.set('tm_whiteboard_all_tabs_layout_mode', __tmNormalizeWhiteboardAllTabsLayoutMode(this.data.whiteboardAllTabsLayoutMode));
            Storage.set('tm_whiteboard_all_tabs_doc_order_by_group', this.data.whiteboardAllTabsDocOrderByGroup || {});
            Storage.set('tm_whiteboard_sequence_mode', !!this.data.whiteboardSequenceMode);
            Storage.set('tm_doc_color_map', this.data.docColorMap || {});
            Storage.set('tm_doc_color_seed', Number(this.data.docColorSeed) || 1);
            Storage.set('tm_doc_default_color_scheme', this.data.docDefaultColorScheme || { palette: 'random', seed: Number(this.data.docColorSeed) || 1, baseColor: '#3b82f6' });
            Storage.set('tm_theme_config', __tmNormalizeThemeConfig(this.data.themeConfig));
            Storage.set('tm_enable_group_task_bg_by_group_color', !!this.data.enableGroupTaskBgByGroupColor);
            Storage.set('tm_ai_enabled', !!this.data.aiEnabled);
            Storage.set('tm_ai_side_dock_enabled', !!this.data.aiSideDockEnabled);
            Storage.set('tm_ai_provider', String(this.data.aiProvider || '').trim() === 'deepseek' ? 'deepseek' : 'minimax');
            Storage.set('tm_ai_minimax_api_key', String(this.data.aiMiniMaxApiKey || ''));
            Storage.set('tm_ai_minimax_base_url', String(this.data.aiMiniMaxBaseUrl || '').trim() || 'https://api.minimaxi.com/anthropic');
            Storage.set('tm_ai_minimax_model', String(this.data.aiMiniMaxModel || '').trim() || 'MiniMax-M2.5');
            Storage.set('tm_ai_deepseek_api_key', String(this.data.aiDeepSeekApiKey || ''));
            Storage.set('tm_ai_deepseek_base_url', String(this.data.aiDeepSeekBaseUrl || '').trim() || 'https://api.deepseek.com');
            Storage.set('tm_ai_deepseek_model', String(this.data.aiDeepSeekModel || '').trim() || 'deepseek-chat');
            Storage.set('tm_ai_minimax_temperature', Number.isFinite(Number(this.data.aiMiniMaxTemperature)) ? Number(this.data.aiMiniMaxTemperature) : 0.2);
            Storage.set('tm_ai_minimax_max_tokens', Number.isFinite(Number(this.data.aiMiniMaxMaxTokens)) ? Math.round(Number(this.data.aiMiniMaxMaxTokens)) : 1600);
            Storage.set('tm_ai_minimax_timeout_ms', Number.isFinite(Number(this.data.aiMiniMaxTimeoutMs)) ? Math.round(Number(this.data.aiMiniMaxTimeoutMs)) : 30000);
            Storage.set('tm_ai_default_context_mode', String(this.data.aiDefaultContextMode || '').trim() === 'fulltext' ? 'fulltext' : 'nearby');
            Storage.set('tm_ai_schedule_windows', Array.isArray(this.data.aiScheduleWindows) ? this.data.aiScheduleWindows.map(v => String(v || '').trim()).filter(Boolean) : ['09:00-18:00']);
            Storage.set('tm_server_sync_on_manual_refresh', !!this.data.serverSyncOnManualRefresh);
            Storage.set('tm_server_sync_session_state_on_manual_refresh', !!this.data.serverSyncSessionStateOnManualRefresh);
        },

        normalizeColumns() {
            this.data.customFieldDefs = __tmNormalizeCustomFieldDefs(this.data.customFieldDefs);
            this.data.customFieldDefsVersion = __tmParseVersionNumber(this.data.customFieldDefsVersion);
            try { __tmInvalidateCustomFieldDefsRuntimeCache(); } catch (e) {}
            const defaultOrder = __tmGetDefaultColumnOrder();
            const known = __tmGetKnownColumnKeys();
            const normalizeKeyList = (list) => {
                const out = [];
                const seen = new Set();
                (Array.isArray(list) ? list : []).forEach((item) => {
                    const key = String(item || '').trim();
                    if (!key || !known.has(key) || seen.has(key)) return;
                    seen.add(key);
                    out.push(key);
                });
                return out;
            };
            const hasHiddenColumnsConfig = Array.isArray(this.data.hiddenColumns);
            let visibleOrder = normalizeKeyList(this.data.columnOrder);
            let hiddenColumns = normalizeKeyList(this.data.hiddenColumns);
            if (!visibleOrder.length && !hasHiddenColumnsConfig) {
                visibleOrder = [...defaultOrder];
                hiddenColumns = [];
            } else {
                if (!hasHiddenColumnsConfig) {
                    hiddenColumns = defaultOrder.filter((key) => !visibleOrder.includes(key));
                }
                hiddenColumns = hiddenColumns.filter((key) => !visibleOrder.includes(key));
                defaultOrder.forEach((key) => {
                    if (visibleOrder.includes(key) || hiddenColumns.includes(key)) return;
                    visibleOrder.push(key);
                });
                if (!visibleOrder.length && !hiddenColumns.length) visibleOrder = [...defaultOrder];
            }
            this.data.columnOrder = visibleOrder;
            this.data.hiddenColumns = hiddenColumns;

            const percentFallback = __tmGetColumnPercentDefaults();
            const pxDefault = __tmGetColumnWidthDefaults();

            const widths = (this.data.columnWidths && typeof this.data.columnWidths === 'object') ? { ...this.data.columnWidths } : {};
            const vals = Object.values(widths).filter(v => typeof v === 'number' && Number.isFinite(v));
            const sum = vals.reduce((a, b) => a + b, 0);
            const max = vals.reduce((m, v) => Math.max(m, v), 0);
            const looksPercent = vals.length > 0 && sum <= 160 && max <= 60;
            if (looksPercent) {
                const basePx = 1200;
                defaultOrder.forEach(k => {
                    const pct = Number(widths[k] ?? percentFallback[k] ?? 10);
                    const safePct = Number.isFinite(pct) ? pct : 10;
                    widths[k] = Math.round(basePx * safePct / 100);
                });
            }
            defaultOrder.forEach(k => {
                if (__tmIsFixedDateColumn(k)) {
                    widths[k] = __tmGetFixedDateColumnWidth(k);
                    return;
                }
                const raw = Number(widths[k]);
                const d = pxDefault[k] || 120;
                const normalized = Number.isFinite(raw) ? Math.round(raw) : d;
                widths[k] = Math.max(10, Math.min(800, normalized));
            });
            this.data.columnWidths = widths;
            const map = this.data.docColorMap;
            this.data.docColorMap = (map && typeof map === 'object' && !Array.isArray(map)) ? map : {};
            this.data.themeConfig = __tmNormalizeThemeConfig(this.data.themeConfig);
            this.data.docDefaultColorScheme = __tmNormalizeDocColorSchemeConfig(this.data.docDefaultColorScheme, {
                seedFallback: this.data.docColorSeed
            });
            this.data.docColorSeed = Number(this.data.docDefaultColorScheme.seed) || 1;
            this.data.docGroupSettingsUpdatedAt = __tmParseUpdatedAtNumber(this.data.docGroupSettingsUpdatedAt);
            this.data.allDocsExcludedDocIds = __tmNormalizeDocGroupExcludedDocIds(this.data.allDocsExcludedDocIds);
            const rawDocGroups = Array.isArray(this.data.docGroups) ? this.data.docGroups : [];
            this.data.docGroups = rawDocGroups.map((group) => __tmNormalizeDocGroupConfig(group, this.data.docDefaultColorScheme)).filter(Boolean);
            const pinMap0 = this.data.docPinnedByGroup;
            const pinMap = (pinMap0 && typeof pinMap0 === 'object' && !Array.isArray(pinMap0)) ? pinMap0 : {};
            const normalizedPinMap = {};
            Object.keys(pinMap).forEach((k) => {
                const key = String(k || '').trim() || 'all';
                const arr = Array.isArray(pinMap[k]) ? pinMap[k] : [];
                const seen = new Set();
                const list = [];
                arr.forEach((id) => {
                    const s = String(id || '').trim();
                    if (!s || seen.has(s)) return;
                    seen.add(s);
                    list.push(s);
                });
                normalizedPinMap[key] = list;
            });
            this.data.docPinnedByGroup = normalizedPinMap;
            const seed = Number(this.data.docColorSeed);
            this.data.docColorSeed = (Number.isFinite(seed) && seed > 0) ? Math.floor(seed) : 1;
            this.data.docDefaultColorScheme.seed = this.data.docColorSeed;
            this.data.taskParentLookupDepth = __tmNormalizeTaskParentLookupDepth(this.data.taskParentLookupDepth);
            this.data.quickAddRecentDocs = __tmNormalizeQuickAddRecentDocs(this.data.quickAddRecentDocs);
            const kw = Number(this.data.kanbanColumnWidth);
            this.data.kanbanColumnWidth = Number.isFinite(kw) ? Math.max(220, Math.min(520, Math.round(kw))) : 320;
            const wbStreamMinW = Number(this.data.whiteboardAllTabsCardMinWidth);
            this.data.whiteboardAllTabsCardMinWidth = Number.isFinite(wbStreamMinW) ? Math.max(220, Math.min(520, Math.round(wbStreamMinW))) : 320;
            this.data.whiteboardStreamMobileTwoColumns = this.data.whiteboardStreamMobileTwoColumns !== false;
            this.data.kanbanFillColumns = !!this.data.kanbanFillColumns;
            this.data.kanbanCardFields = __tmNormalizeTaskCardFieldList(this.data.kanbanCardFields, ['priority', 'status', 'date']);
            this.data.taskCardDateOnlyWithValue = !!this.data.taskCardDateOnlyWithValue;
            this.data.checklistCompactTreeGuides = !!this.data.checklistCompactTreeGuides;
            this.data.checklistCompactTreeGuidesUpdatedAt = __tmParseUpdatedAtNumber(this.data.checklistCompactTreeGuidesUpdatedAt);
            this.data.settingsFieldUpdatedAt = __tmNormalizeSettingsFieldUpdatedAtMap(this.data.settingsFieldUpdatedAt, this.data);
            this.data.docH2SubgroupEnabled = this.data.docH2SubgroupEnabled !== false;
            this.data.taskAutoWrapEnabled = this.data.taskAutoWrapEnabled !== false;
            this.data.aiSideDockEnabled = this.data.aiSideDockEnabled !== false;
            {
                const validCalendarHourSlotHeightModes = new Set(['normal', 'high', 'higher', 'ultra']);
                const calendarHourSlotHeightMode = String(this.data.calendarHourSlotHeightMode || '').trim();
                this.data.calendarHourSlotHeightMode = validCalendarHourSlotHeightModes.has(calendarHourSlotHeightMode) ? calendarHourSlotHeightMode : 'normal';
            }
            {
                const validQuickAddModes = new Set(['current', 'nextHour', 'custom']);
                const quickAddMode = String(this.data.calendarQuickAddScheduleTimeMode || '').trim();
                this.data.calendarQuickAddScheduleTimeMode = validQuickAddModes.has(quickAddMode) ? quickAddMode : 'current';
                const rawTime = String(this.data.calendarQuickAddScheduleCustomTime || '').trim();
                const m = rawTime.match(/^(\d{1,2}):(\d{2})$/);
                const hh = m ? Number(m[1]) : NaN;
                const mm = m ? Number(m[2]) : NaN;
                this.data.calendarQuickAddScheduleCustomTime = (Number.isInteger(hh) && Number.isInteger(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59)
                    ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
                    : '09:00';
            }
            {
                const monthMinVisibleEvents = Number(this.data.calendarMonthMinVisibleEvents);
                this.data.calendarMonthMinVisibleEvents = Number.isFinite(monthMinVisibleEvents)
                    ? Math.max(1, Math.min(8, Math.round(monthMinVisibleEvents)))
                    : 3;
            }
            this.data.calendarMonthAdaptiveRowHeight = this.data.calendarMonthAdaptiveRowHeight !== false;
            this.data.calendarSidebarDefaultPage = String(this.data.calendarSidebarDefaultPage || '').trim() === 'tasks' ? 'tasks' : 'calendar';
            {
                const pos = Number(this.data.calendar3DayTodayPosition);
                this.data.calendar3DayTodayPosition = (pos === 2 || pos === 3) ? pos : 1;
            }
            const wrapContentLines = Number(this.data.taskContentWrapMaxLines);
            this.data.taskContentWrapMaxLines = Number.isFinite(wrapContentLines) ? Math.max(1, Math.min(10, Math.round(wrapContentLines))) : 3;
            const wrapRemarkLines = Number(this.data.taskRemarkWrapMaxLines);
            this.data.taskRemarkWrapMaxLines = Number.isFinite(wrapRemarkLines) ? Math.max(1, Math.min(10, Math.round(wrapRemarkLines))) : 2;
            this.data.enableMoveBlockToDailyNote = !!this.data.enableMoveBlockToDailyNote;
            this.data.enablePointsPenaltyIntegration = !!this.data.enablePointsPenaltyIntegration;
            this.data.pointsPenaltyScheduleEnabled = this.data.pointsPenaltyScheduleEnabled !== false;
            this.data.pointsPenaltyDeadlineEnabled = this.data.pointsPenaltyDeadlineEnabled !== false;
            {
                const amount = Number(this.data.pointsPenaltyScheduleAmount);
                this.data.pointsPenaltyScheduleAmount = Number.isFinite(amount) ? Math.max(0, Math.min(9999, Math.round(amount))) : 20;
            }
            {
                const amount = Number(this.data.pointsPenaltyDeadlineAmount);
                this.data.pointsPenaltyDeadlineAmount = Number.isFinite(amount) ? Math.max(0, Math.min(9999, Math.round(amount))) : 30;
            }
            {
                const rawTimes = Array.isArray(this.data.pointsPenaltyCheckTimes) ? this.data.pointsPenaltyCheckTimes : [];
                const seen = new Set();
                const normalized = [];
                const parseItem = (input) => {
                    const text = String(input || '').trim();
                    if (!text) return null;
                    let dayOffset = 0;
                    let hh = NaN;
                    let mm = NaN;
                    let hasOffset = false;
                    let m = /^\+(\d+)\s+(\d{1,2}):(\d{2})$/.exec(text);
                    if (m) {
                        hasOffset = true;
                        dayOffset = Number(m[1]);
                        hh = Number(m[2]);
                        mm = Number(m[3]);
                    } else {
                        m = /^(\d{1,2}):(\d{2})$/.exec(text);
                        if (!m) return null;
                        hh = Number(m[1]);
                        mm = Number(m[2]);
                    }
                    if (!Number.isInteger(dayOffset)) return null;
                    if (hasOffset && (dayOffset < 1 || dayOffset > 7)) return null;
                    if (!hasOffset) dayOffset = 0;
                    if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
                    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
                    const timeText = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
                    return {
                        dayOffset,
                        minute: hh * 60 + mm,
                        normalized: dayOffset > 0 ? `+${dayOffset} ${timeText}` : timeText,
                    };
                };
                rawTimes.forEach((value) => {
                    const parsed = parseItem(value);
                    if (!parsed) return;
                    if (seen.has(parsed.normalized)) return;
                    seen.add(parsed.normalized);
                    normalized.push(parsed);
                });
                normalized.sort((a, b) => {
                    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
                    if (a.minute !== b.minute) return a.minute - b.minute;
                    return a.normalized.localeCompare(b.normalized);
                });
                this.data.pointsPenaltyCheckTimes = normalized.length ? normalized.map((item) => item.normalized) : ['23:00', '+1 08:00'];
            }
            this.data.pointsPenaltyCheckOnStartup = !!this.data.pointsPenaltyCheckOnStartup;
            this.data.pointsPenaltyConfirmModalEnabled = this.data.pointsPenaltyConfirmModalEnabled !== false;
            this.data.newTaskDailyNoteAppendToBottom = !!this.data.newTaskDailyNoteAppendToBottom;
            this.data.headingGroupCreateAtSectionEnd = !!this.data.headingGroupCreateAtSectionEnd;
            this.data.taskDetailCompletedSubtasksVisibilityByTask = (this.data.taskDetailCompletedSubtasksVisibilityByTask && typeof this.data.taskDetailCompletedSubtasksVisibilityByTask === 'object' && !Array.isArray(this.data.taskDetailCompletedSubtasksVisibilityByTask))
                ? this.data.taskDetailCompletedSubtasksVisibilityByTask
                : {};
            this.data.docTopbarButtonDesktop = this.data.docTopbarButtonDesktop !== false;
            this.data.docTopbarButtonMobile = this.data.docTopbarButtonMobile !== false;
            this.data.docTopbarButtonSwapPressActions = !!this.data.docTopbarButtonSwapPressActions;
            this.data.docTopbarButtonLocateCurrentDocTab = !!this.data.docTopbarButtonLocateCurrentDocTab;
            this.data.windowTopbarIconDesktop = this.data.windowTopbarIconDesktop !== false;
            this.data.windowTopbarIconMobile = this.data.windowTopbarIconMobile !== false;
            this.data.semanticDateAutoPromptEnabled = !!this.data.semanticDateAutoPromptEnabled;
            this.data.serverSyncOnManualRefresh = !!this.data.serverSyncOnManualRefresh;
            this.data.serverSyncSessionStateOnManualRefresh = !!this.data.serverSyncSessionStateOnManualRefresh;
            this.data.timelineForceSortByCompletionNearToday = !!this.data.timelineForceSortByCompletionNearToday;
            this.data.groupSortByBestSubtaskTimeInTimeQuadrant = !!this.data.groupSortByBestSubtaskTimeInTimeQuadrant;
            this.data.whiteboardLinks = Array.isArray(this.data.whiteboardLinks) ? this.data.whiteboardLinks : [];
            this.data.whiteboardAutoConnectByCreated = false;
            this.data.whiteboardDetachedChildren = (this.data.whiteboardDetachedChildren && typeof this.data.whiteboardDetachedChildren === 'object' && !Array.isArray(this.data.whiteboardDetachedChildren))
                ? this.data.whiteboardDetachedChildren
                : {};
            this.data.whiteboardNotes = Array.isArray(this.data.whiteboardNotes) ? this.data.whiteboardNotes : [];
            const wbTool = String(this.data.whiteboardTool || 'pan').trim();
            this.data.whiteboardTool = (wbTool === 'select' || wbTool === 'text' || wbTool === 'sticky' || wbTool === 'pan') ? wbTool : 'pan';
            this.data.whiteboardSidebarCollapsed = !!this.data.whiteboardSidebarCollapsed;
            const wbSidebarWidth = Number(this.data.whiteboardSidebarWidth);
            this.data.whiteboardSidebarWidth = Number.isFinite(wbSidebarWidth) ? Math.max(220, Math.min(520, Math.round(wbSidebarWidth))) : 300;
            this.data.whiteboardShowDone = !!this.data.whiteboardShowDone;
            this.data.whiteboardNavigatorHidden = !!this.data.whiteboardNavigatorHidden;
            this.data.whiteboardCardFields = __tmNormalizeTaskCardFieldList(this.data.whiteboardCardFields, ['priority', 'status', 'date']);
            const wv0 = (this.data.whiteboardView && typeof this.data.whiteboardView === 'object') ? this.data.whiteboardView : {};
            const x0 = Number(wv0.x);
            const y0 = Number(wv0.y);
            const z0 = Number(wv0.zoom);
            this.data.whiteboardView = {
                x: Number.isFinite(x0) ? x0 : 64,
                y: Number.isFinite(y0) ? y0 : 40,
                zoom: Number.isFinite(z0) ? Math.max(0.35, Math.min(2.5, z0)) : 1,
            };
            this.data.whiteboardNodePos = (this.data.whiteboardNodePos && typeof this.data.whiteboardNodePos === 'object' && !Array.isArray(this.data.whiteboardNodePos))
                ? this.data.whiteboardNodePos
                : {};
            this.data.whiteboardAutoLayout = false;
            this.data.whiteboardAllTabsLayoutMode = __tmNormalizeWhiteboardAllTabsLayoutMode(this.data.whiteboardAllTabsLayoutMode);
            this.data.whiteboardSequenceMode = !!this.data.whiteboardSequenceMode;
            const wbPlaced0 = (this.data.whiteboardPlacedTaskIds && typeof this.data.whiteboardPlacedTaskIds === 'object' && !Array.isArray(this.data.whiteboardPlacedTaskIds))
                ? this.data.whiteboardPlacedTaskIds
                : {};
            const wbPlaced = {};
            Object.keys(wbPlaced0).forEach((k) => {
                const id = String(k || '').trim();
                if (!id) return;
                if (wbPlaced0[k]) wbPlaced[id] = true;
            });
            this.data.whiteboardPlacedTaskIds = wbPlaced;
            this.data.whiteboardStateVersion = __tmParseVersionNumber(this.data.whiteboardStateVersion);
            const wbFrame0 = (this.data.whiteboardDocFrameSize && typeof this.data.whiteboardDocFrameSize === 'object' && !Array.isArray(this.data.whiteboardDocFrameSize))
                ? this.data.whiteboardDocFrameSize
                : {};
            const wbFrame = {};
            Object.keys(wbFrame0).forEach((k) => {
                const id = String(k || '').trim();
                if (!id) return;
                const w = Number(wbFrame0[k]?.w);
                const h = Number(wbFrame0[k]?.h);
                if (!Number.isFinite(w) || !Number.isFinite(h)) return;
                wbFrame[id] = { w: Math.max(520, Math.round(w)), h: Math.max(220, Math.round(h)) };
            });
            this.data.whiteboardDocFrameSize = wbFrame;
            const wbAllTabsOrder0 = (this.data.whiteboardAllTabsDocOrderByGroup && typeof this.data.whiteboardAllTabsDocOrderByGroup === 'object' && !Array.isArray(this.data.whiteboardAllTabsDocOrderByGroup))
                ? this.data.whiteboardAllTabsDocOrderByGroup
                : {};
            const wbAllTabsOrder = {};
            Object.keys(wbAllTabsOrder0).forEach((k) => {
                const gid = String(k || '').trim() || 'all';
                const ids = Array.isArray(wbAllTabsOrder0[k]) ? wbAllTabsOrder0[k] : [];
                const nextIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
                if (nextIds.length > 0) wbAllTabsOrder[gid] = nextIds;
            });
            this.data.whiteboardAllTabsDocOrderByGroup = wbAllTabsOrder;
        },

        async save() {
            this.saveDirty = true;
            try { if (this.saveTimer) clearTimeout(this.saveTimer); } catch (e) {}
            if (!this.savePromise) {
                this.savePromise = new Promise((resolve, reject) => {
                    this.savePromiseResolve = resolve;
                    this.savePromiseReject = reject;
                });
            }
            this.saveTimer = setTimeout(() => {
                this.saveTimer = null;
                this.flushSave();
            }, 350);
            return this.savePromise;
        },

        async saveNow() {
            try { if (this.saveTimer) clearTimeout(this.saveTimer); } catch (e) {}
            this.saveTimer = null;
            if (this.saving) return this.savePromise || undefined;
            if (!this.saveDirty) return this.savePromise || undefined;
            return this.flushSave();
        },

        async flushSave() {
            if (this.saving) return this.savePromise || undefined;
            if (!this.saveDirty) return this.savePromise || undefined;
            this.saving = true;
            this.saveDirty = false;
            try {
                const prevWhiteboardFingerprint = String(this.lastWhiteboardFingerprint || '');
                const whiteboardChangedLocal = __tmGetWhiteboardSettingsFingerprint(this.data) !== prevWhiteboardFingerprint;
                const loadedWhiteboardStateVersion = __tmParseVersionNumber(this.loadedWhiteboardStateVersion);
                const prevDocGroupFingerprint = String(this.loadedDocGroupFingerprint || '');
                const docGroupChangedLocal = __tmBuildDocGroupSyncFingerprint(this.data) !== prevDocGroupFingerprint;
                const loadedDocGroupUpdatedAt = __tmParseUpdatedAtNumber(this.loadedDocGroupUpdatedAt);
                const prevCustomFieldDefsFingerprint = String(this.lastCustomFieldDefsFingerprint || '');
                const customFieldDefsChangedLocal = __tmGetCustomFieldDefsFingerprint(this.data.customFieldDefs) !== prevCustomFieldDefsFingerprint;
                const loadedCustomFieldDefsVersion = __tmParseVersionNumber(this.loadedCustomFieldDefsVersion);
                const loadedCustomFieldDefsSnapshot = __tmCloneCustomFieldDefs(this.loadedCustomFieldDefsSnapshot);
                const prevCollapseFingerprint = String(this.loadedCollapseFingerprint || '');
                const collapseChangedLocal = __tmGetCollapsedSessionStateFingerprint(this.data) !== prevCollapseFingerprint;
                const loadedCollapseUpdatedAt = __tmParseUpdatedAtNumber(this.loadedCollapseUpdatedAt);
                const remoteSettings = await __tmReadJsonFile(SETTINGS_FILE_PATH);
                const remoteDocGroupUpdatedAt = __tmGetDocGroupSettingsUpdatedAt(remoteSettings, {
                    fallbackSettingsUpdatedAt: remoteSettings?.settingsUpdatedAt,
                    useSettingsFallback: true,
                });
                const remoteCollapseUpdatedAt = __tmGetCollapsedSessionUpdatedAt(remoteSettings);
                const remoteWhiteboardStateVersion = __tmParseVersionNumber(remoteSettings?.whiteboardStateVersion);
                const settingsFieldChange = __tmMarkChangedSettingsFields(this.data, this.loadedSettingsFieldSnapshot, Date.now());
                const appliedRemoteSettingFields = __tmApplySettingsFieldUpdatesByMap(this.data, remoteSettings, {
                    skipKeys: settingsFieldChange.changedKeys,
                });
                if (appliedRemoteSettingFields.length) {
                    this.normalizeColumns();
                }
                if (remoteWhiteboardStateVersion > loadedWhiteboardStateVersion) {
                    const mergedWhiteboardState = __tmMergeWhiteboardSettingsState(remoteSettings, this.data);
                    Object.assign(this.data, mergedWhiteboardState);
                }
                if (!docGroupChangedLocal && __tmShouldPreferRemoteDocGroupState(this.data, remoteSettings, {
                    localSettingsUpdatedAt: this.data.settingsUpdatedAt,
                    remoteSettingsUpdatedAt: remoteSettings?.settingsUpdatedAt,
                    groupId: this.data.currentGroupId,
                    allowSettingsFallback: true,
                })) {
                    __tmApplyDocGroupSyncSnapshot(remoteSettings, {
                        targetData: this.data,
                        syncOverallUpdatedAt: false,
                    });
                    if (remoteDocGroupUpdatedAt > 0) {
                        this.data.docGroupSettingsUpdatedAt = remoteDocGroupUpdatedAt;
                    }
                }
                if (remoteCollapseUpdatedAt > loadedCollapseUpdatedAt && !collapseChangedLocal) {
                    __tmAssignCollapsedSessionState(this.data, remoteSettings);
                    this.data.collapseStateUpdatedAt = remoteCollapseUpdatedAt;
                }
                const remoteCustomFieldDefsVersion = __tmParseVersionNumber(remoteSettings?.customFieldDefsVersion);
                const customFieldDefsFingerprintBeforeSync = __tmGetCustomFieldDefsFingerprint(this.data.customFieldDefs);
                if (remoteCustomFieldDefsVersion > loadedCustomFieldDefsVersion) {
                    this.data.customFieldDefs = customFieldDefsChangedLocal
                        ? __tmMergeCustomFieldDefsThreeWay(
                            loadedCustomFieldDefsSnapshot,
                            this.data.customFieldDefs,
                            remoteSettings?.customFieldDefs,
                            { prefer: 'local' }
                        )
                        : (Array.isArray(remoteSettings?.customFieldDefs)
                            ? __tmCloneCustomFieldDefs(remoteSettings.customFieldDefs)
                            : this.data.customFieldDefs);
                } else if (remoteCustomFieldDefsVersion === 0
                    && loadedCustomFieldDefsVersion > 0
                    && Array.isArray(remoteSettings?.customFieldDefs)
                    && remoteSettings.customFieldDefs.length) {
                    this.data.customFieldDefs = customFieldDefsChangedLocal
                        ? __tmMergeCustomFieldDefsThreeWay(
                            loadedCustomFieldDefsSnapshot,
                            this.data.customFieldDefs,
                            remoteSettings.customFieldDefs,
                            { prefer: 'local' }
                        )
                        : __tmMergeLegacyCustomFieldDefs(this.data.customFieldDefs, remoteSettings.customFieldDefs);
                }
                const customFieldDefsFingerprintAfterSync = __tmGetCustomFieldDefsFingerprint(this.data.customFieldDefs);
                const customFieldDefsChangedDuringSync = customFieldDefsFingerprintAfterSync !== customFieldDefsFingerprintBeforeSync;
                const nextCustomFieldDefsVersionBase = Math.max(
                    __tmParseVersionNumber(this.data.customFieldDefsVersion),
                    loadedCustomFieldDefsVersion,
                    remoteCustomFieldDefsVersion
                );
                this.data.customFieldDefsVersion = customFieldDefsChangedLocal
                    ? nextCustomFieldDefsVersionBase + 1
                    : nextCustomFieldDefsVersionBase;
                if (customFieldDefsChangedLocal || customFieldDefsChangedDuringSync) {
                    this.normalizeColumns();
                }
                if (whiteboardChangedLocal) {
                    const nextWhiteboardStateVersion = Math.max(
                        __tmParseVersionNumber(this.data.whiteboardStateVersion),
                        loadedWhiteboardStateVersion,
                        remoteWhiteboardStateVersion
                    ) + 1;
                    this.data.whiteboardStateVersion = nextWhiteboardStateVersion;
                } else {
                    this.data.whiteboardStateVersion = Math.max(
                        __tmParseVersionNumber(this.data.whiteboardStateVersion),
                        loadedWhiteboardStateVersion,
                        remoteWhiteboardStateVersion
                    );
                }
                if (collapseChangedLocal) {
                    this.data.collapseStateUpdatedAt = Date.now();
                } else {
                    this.data.collapseStateUpdatedAt = Math.max(
                        __tmGetCollapsedSessionUpdatedAt(this.data),
                        loadedCollapseUpdatedAt,
                        remoteCollapseUpdatedAt
                    );
                }
                if (docGroupChangedLocal) {
                    this.data.docGroupSettingsUpdatedAt = Date.now();
                } else {
                    this.data.docGroupSettingsUpdatedAt = Math.max(
                        __tmGetDocGroupSettingsUpdatedAt(this.data),
                        loadedDocGroupUpdatedAt,
                        remoteDocGroupUpdatedAt
                    );
                }
                this.data.settingsUpdatedAt = Date.now();
                // 本地缓存延后到 flush，避免每次 save() 都全量写 localStorage
                this.syncToLocal();
                const payload = this.buildCloudPayload();
                const formDir = new FormData();
                formDir.append('path', PLUGIN_STORAGE_DIR);
                formDir.append('isDir', 'true');
                await fetch('/api/file/putFile', { method: 'POST', body: formDir }).catch(() => null);

                const formData = new FormData();
                formData.append('path', SETTINGS_FILE_PATH);
                formData.append('isDir', 'false');
                formData.append('file', new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));

                await fetch('/api/file/putFile', { method: 'POST', body: formData }).catch(() => null);
            } catch (e) {
            } finally {
                this.saving = false;
                this.loadedWhiteboardStateVersion = __tmParseVersionNumber(this.data.whiteboardStateVersion);
                this.lastWhiteboardFingerprint = __tmGetWhiteboardSettingsFingerprint(this.data);
                this.refreshDocGroupSyncState(this.data.docGroupSettingsUpdatedAt);
                this.refreshCustomFieldSyncState();
                this.refreshCollapsedStateSyncState();
                this.refreshSettingsFieldSyncState();
                if (this.saveDirty) {
                    try { if (this.saveTimer) clearTimeout(this.saveTimer); } catch (e) {}
                    this.saveTimer = setTimeout(() => {
                        this.saveTimer = null;
                        this.flushSave();
                    }, 50);
                    return;
                }
                try { this.savePromiseResolve?.(); } catch (e) {}
                this.savePromise = null;
                this.savePromiseResolve = null;
            }
        },

        // 便捷方法：更新列宽度
        async updateColumnWidth(column, width) {
            const colKey = String(column || '').trim();
            if (__tmIsFixedDateColumn(colKey)) return;
            if (typeof width === 'number' && width >= 10 && width <= 800) {
                this.data.columnWidths[colKey] = width;
                await this.save();
            }
        },

        // 便捷方法：更新文档ID列表
        async updateDocIds(docIds) {
            this.data.selectedDocIds = docIds;
            await this.save();
        },

        // 便捷方法：添加文档
        async addDocId(docId) {
            if (!this.data.selectedDocIds.includes(docId)) {
                this.data.selectedDocIds.push(docId);
                await this.save();
            }
        },

        // 便捷方法：移除文档
        async removeDocId(index) {
            if (index >= 0 && index < this.data.selectedDocIds.length) {
                this.data.selectedDocIds.splice(index, 1);
                await this.save();
            }
        },

        // 便捷方法：清空文档
        async clearDocIds() {
            this.data.selectedDocIds = [];
            await this.save();
        },

        // 便捷方法：保存规则
        async saveRules(rules) {
            this.data.filterRules = rules;
            await this.save();
        },

        // 便捷方法：更新文档分组
        async updateDocGroups(groups) {
            this.data.docGroups = (Array.isArray(groups) ? groups : []).map((group) => __tmNormalizeDocGroupConfig(group, this.data.docDefaultColorScheme)).filter(Boolean);
            await this.save();
        },

        // 便捷方法：更新当前分组ID
        async updateCurrentGroupId(groupId) {
            this.data.currentGroupId = groupId;
            await this.save();
        },

        // 便捷方法：更新字体大小
        async updateFontSize(size) {
            this.data.fontSize = size;
            await this.save();
        },
        // 便捷方法：更新移动端字体大小
        async updateFontSizeMobile(size) {
            this.data.fontSizeMobile = size;
            await this.save();
        }
    };

    const WhiteboardStore = {
        data: Storage.get(WHITEBOARD_DATA_CACHE_KEY, { version: 0, cards: {}, links: [] }) || { version: 0, cards: {}, links: [] },
        loaded: false,
        saving: false,
        saveTimer: null,
        saveDirty: false,
        loadedVersion: 0,

        normalize() {
            this.data = __tmNormalizeWhiteboardStoreData(this.data);
        },

        async load() {
            if (this.loaded) return;
            try { this.normalize(); } catch (e) {}
            try {
                const res = await fetch('/api/file/getFile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: WHITEBOARD_DATA_FILE_PATH }),
                });
                if (res.ok) {
                    const text = await res.text();
                    if (text && text.trim()) {
                        const json = JSON.parse(text);
                        if (json && typeof json === 'object') this.data = json;
                    }
                }
            } catch (e) {}
            try { this.normalize(); } catch (e) {}
            try { Storage.set(WHITEBOARD_DATA_CACHE_KEY, this.data || { version: 0, cards: {}, links: [] }); } catch (e) {}
            this.loaded = true;
            this.loadedVersion = __tmParseVersionNumber(this.data?.version);
            if (this.saveDirty) this.scheduleSave();
        },

        scheduleSave() {
            this.saveDirty = true;
            try { if (this.saveTimer) clearTimeout(this.saveTimer); } catch (e) {}
            this.saveTimer = setTimeout(() => {
                this.saveTimer = null;
                this.saveNow();
            }, 420);
        },

        async saveNow() {
            if (!this.loaded) return;
            if (this.saving) return;
            if (!this.saveDirty) return;
            this.saving = true;
            this.saveDirty = false;
            try {
                this.normalize();
                const remoteData = await __tmReadJsonFile(WHITEBOARD_DATA_FILE_PATH);
                const remoteVersion = __tmParseVersionNumber(remoteData?.version);
                if (remoteVersion > __tmParseVersionNumber(this.loadedVersion)) {
                    this.data = __tmMergeWhiteboardStoreData(remoteData, this.data);
                }
                this.data.version = Math.max(
                    __tmParseVersionNumber(this.data?.version),
                    __tmParseVersionNumber(this.loadedVersion),
                    remoteVersion
                ) + 1;
                this.normalize();
                try { Storage.set(WHITEBOARD_DATA_CACHE_KEY, this.data || { version: 0, cards: {}, links: [] }); } catch (e) {}
                const formDir = new FormData();
                formDir.append('path', PLUGIN_STORAGE_DIR);
                formDir.append('isDir', 'true');
                await fetch('/api/file/putFile', { method: 'POST', body: formDir }).catch(() => null);

                const formData = new FormData();
                formData.append('path', WHITEBOARD_DATA_FILE_PATH);
                formData.append('isDir', 'false');
                formData.append('file', new Blob([JSON.stringify(this.data || { version: 0, cards: {}, links: [] }, null, 2)], { type: 'application/json' }));
                await fetch('/api/file/putFile', { method: 'POST', body: formData }).catch(() => null);
            } catch (e) {
            } finally {
                this.saving = false;
                this.loadedVersion = __tmParseVersionNumber(this.data?.version);
                if (this.saveDirty) this.scheduleSave();
            }
        },

        getTask(taskId) {
            const id = String(taskId || '').trim();
            if (!id) return null;
            const cards = (this.data && this.data.cards && typeof this.data.cards === 'object') ? this.data.cards : {};
            const item = cards[id];
            return (item && typeof item === 'object') ? item : null;
        },

        upsertTask(task, opts = {}) {
            const t = (task && typeof task === 'object') ? task : {};
            const id = String(t.id || '').trim();
            const docId = String(t.root_id || t.docId || '').trim();
            const content = String(t.content || '').trim();
            if (!id || !docId || !content) return false;
            const cards = (this.data.cards && typeof this.data.cards === 'object' && !Array.isArray(this.data.cards))
                ? this.data.cards
                : {};
            const prev = cards[id] || {};
            const next = {
                id,
                docId,
                content,
                parentTaskId: String(t.parentTaskId || '').trim(),
                h2: String(t.h2 || '').trim(),
                h2Id: String(t.h2Id || '').trim(),
                h2Path: String(t.h2Path || '').trim(),
                h2Sort: Number(t.h2Sort),
                h2Created: String(t.h2Created || '').trim(),
                h2Rank: Number(t.h2Rank),
                headingLevel: String(SettingsStore.data.taskHeadingLevel || 'h2').trim() || 'h2',
                startDate: String(t.startDate || '').trim(),
                completionTime: String(t.completionTime || '').trim(),
                done: !!t.done,
                updatedAt: String(Date.now()),
            };
            const changed = JSON.stringify({
                docId: prev.docId || '',
                content: prev.content || '',
                parentTaskId: prev.parentTaskId || '',
                h2: prev.h2 || '',
                h2Id: prev.h2Id || '',
                h2Path: prev.h2Path || '',
                h2Sort: Number(prev.h2Sort),
                h2Created: prev.h2Created || '',
                h2Rank: Number(prev.h2Rank),
                headingLevel: prev.headingLevel || '',
                startDate: prev.startDate || '',
                completionTime: prev.completionTime || '',
                done: !!prev.done,
            }) !== JSON.stringify({
                docId: next.docId,
                content: next.content,
                parentTaskId: next.parentTaskId,
                h2: next.h2,
                h2Id: next.h2Id,
                h2Path: next.h2Path,
                h2Sort: Number(next.h2Sort),
                h2Created: next.h2Created,
                h2Rank: Number(next.h2Rank),
                headingLevel: next.headingLevel,
                startDate: next.startDate,
                completionTime: next.completionTime,
                done: next.done,
            });
            if (!changed) return false;
            cards[id] = next;
            this.data.cards = cards;
            // 清除白板快照缓存
            try { __tmClearWhiteboardCardSnapshotCache(); } catch (e) {}
            if (opts && opts.persist === false) return true;
            this.scheduleSave();
            return true;
        },

        upsertTasks(tasks, opts = {}) {
            const list = Array.isArray(tasks) ? tasks : [];
            if (!list.length) return false;
            let changed = false;
            list.forEach((t) => {
                if (this.upsertTask(t, { persist: false })) changed = true;
            });
            if (!changed) return false;
            // 清除白板快照缓存
            try { __tmClearWhiteboardCardSnapshotCache(); } catch (e) {}
            if (opts && opts.persist === false) return true;
            this.scheduleSave();
            return true;
        },
    };

    // 规则管理器
    const RuleManager = {
        __availableFieldsCacheKey: '',
        __availableFieldsCache: [],
        __availableFieldsMapCache: new Map(),

        // 获取所有规则（优先从 SettingsStore 获取）
        getRules() {
            // 优先从 SettingsStore 获取
            if (SettingsStore.loaded && Array.isArray(SettingsStore.data.filterRules) && SettingsStore.data.filterRules.length > 0) {
                return SettingsStore.data.filterRules;
            }
            // 回退到本地存储
            return Storage.get('tm_filter_rules', []);
        },

        // 保存规则（使用 SettingsStore 保存到云端和本地）
        async saveRules(rules) {
            SettingsStore.data.filterRules = rules;
            await SettingsStore.save();
        },

        // 获取默认规则
        getDefaultRules() {
            return [
                {
                    id: 'default_all',
                    name: '所有任务',
                    enabled: true,
                    conditions: [],
                    sort: [
                        { field: 'priority', order: 'desc' },
                        { field: 'created', order: 'asc' }
                    ]
                },
                {
                    id: 'default_todo',
                    name: '待办任务',
                    enabled: true,
                    conditions: [
                        { field: 'done', operator: '=', value: false }
                    ],
                    sort: [
                        { field: 'priority', order: 'desc' },
                        { field: 'updated', order: 'desc' }
                    ]
                },
                {
                    id: 'default_today',
                    name: '今日任务',
                    enabled: true,
                    conditions: [
                        { field: 'done', operator: '=', value: false },
                        {
                            field: 'completionTime',
                            operator: 'range_today',
                            value: { from: '', to: '' }
                        }
                    ],
                    sort: [
                        { field: 'priority', order: 'desc' },
                        { field: 'completionTime', order: 'asc' }
                    ]
                },
                {
                    id: 'high_priority',
                    name: '高优先级',
                    enabled: true,
                    conditions: [
                        { field: 'done', operator: '=', value: false },
                        { field: 'priority', operator: '=', value: 'high' }
                    ],
                    sort: [
                        { field: 'created', order: 'asc' },
                        { field: 'completionTime', order: 'asc' }
                    ]
                }
            ];
        },

        // 初始化规则
        async initRules() {
            const rules = this.getRules();
            if (rules.length === 0) {
                const defaultRules = this.getDefaultRules();
                await this.saveRules(defaultRules);
                return defaultRules;
            }
            return rules;
        },

        // 创建新规则
        createRule(name) {
            return {
                id: 'rule_' + Date.now(),
                name: name || '新规则',
                enabled: true,
                conditions: [],
                sort: [
                    { field: 'priorityScore', order: 'desc' },
                    { field: 'priority', order: 'desc' }
                ]
            };
        },

        // 获取可用字段
        getAvailableFields() {
            const headingLevel = String(SettingsStore.data.taskHeadingLevel || 'h2').trim() || 'h2';
            const cacheKey = [
                Number(SettingsStore.data?.settingsUpdatedAt || 0),
                __tmParseVersionNumber(SettingsStore.data?.customFieldDefsVersion),
                headingLevel,
            ].join('|');
            if (this.__availableFieldsCacheKey === cacheKey && Array.isArray(this.__availableFieldsCache) && this.__availableFieldsCache.length > 0) {
                return this.__availableFieldsCache;
            }
            const statusOptions = __tmGetStatusOptions(Array.isArray(SettingsStore.data.customStatusOptions)
                ? SettingsStore.data.customStatusOptions
                : []);
            const statusOptionIds = statusOptions
                .map((option) => String(option?.id || '').trim())
                .filter(Boolean);
            const statusOptionLabels = statusOptions.reduce((acc, option) => {
                const id = String(option?.id || '').trim();
                if (!id) return acc;
                acc[id] = String(option?.name || id).trim() || id;
                return acc;
            }, {});
            const defaultUndoneStatusId = __tmGetDefaultUndoneStatusId(statusOptions);
            const customFieldRuleFields = __tmGetCustomFieldDefs().map((field) => {
                const fieldId = String(field?.id || '').trim();
                if (!fieldId || String(field?.type || '').trim() === 'text') return null;
                const optionIds = Array.isArray(field?.options)
                    ? field.options.map((option) => String(option?.id || '').trim()).filter(Boolean)
                    : [];
                const optionLabels = (Array.isArray(field?.options) ? field.options : []).reduce((acc, option) => {
                    const id = String(option?.id || '').trim();
                    if (!id) return acc;
                    acc[id] = String(option?.name || id).trim() || id;
                    return acc;
                }, {});
                return {
                    value: __tmBuildCustomFieldColumnKey(fieldId),
                    label: `${String(field?.name || fieldId).trim() || fieldId}（自定义列）`,
                    type: 'select',
                    options: optionIds,
                    optionLabels,
                    customFieldId: fieldId,
                    multi: String(field?.type || '').trim() === 'multi',
                    allowEmpty: true,
                    emptyLabel: '未设置',
                };
            }).filter(Boolean);
            const fields = [
                { value: 'content', label: '任务内容', type: 'text' },
                { value: 'done', label: '完成状态', type: 'boolean' },
                {
                    value: 'priority',
                    label: '优先级',
                    type: 'select',
                    options: ['high', 'medium', 'low', 'none'],
                    optionLabels: { high: '高', medium: '中', low: '低', none: '无' },
                    emptyLabel: '无',
                },
                { value: 'priorityScore', label: '优先级数值', type: 'number' },
                {
                    value: 'customStatus',
                    label: '状态',
                    type: 'select',
                    options: statusOptionIds,
                    optionLabels: statusOptionLabels,
                    emptyLabel: '未设置',
                    statusOptions,
                    defaultStatusId: defaultUndoneStatusId,
                },
                { value: 'startDate', label: '开始日期', type: 'datetime' },
                { value: 'completionTime', label: '截止日期', type: 'datetime' },
                { value: 'taskCompleteAt', label: '完成时间', type: 'datetime' },
                { value: 'created', label: '创建时间', type: 'datetime' },
                { value: 'updated', label: '更新时间', type: 'datetime' },
                { value: 'duration', label: '任务时长', type: 'text' },
                { value: 'remark', label: '备注', type: 'text' },
                { value: 'docName', label: '文档名称', type: 'text' },
                { value: 'level', label: '任务层级', type: 'number' }
            ].concat(customFieldRuleFields);
            this.__availableFieldsCacheKey = cacheKey;
            this.__availableFieldsCache = fields;
            this.__availableFieldsMapCache = new Map(fields.map((field) => [String(field?.value || '').trim(), field]).filter(([value]) => !!value));
            return fields;
        },

        getFieldInfo(fieldValue) {
            const key = String(fieldValue || '').trim();
            if (!key) return null;
            this.getAvailableFields();
            return this.__availableFieldsMapCache.get(key) || null;
        },

        isTimeField(fieldValue) {
            const fieldInfo = (fieldValue && typeof fieldValue === 'object') ? fieldValue : this.getFieldInfo(fieldValue);
            const key = String(fieldInfo?.value || fieldValue || '').trim();
            if (!key) return false;
            return String(fieldInfo?.type || '').trim() === 'datetime'
                || key === 'startDate'
                || key === 'created'
                || key === 'updated'
                || key.includes('Time');
        },

        __getFieldInfoCached(fieldValue, cache = null) {
            if (fieldValue && typeof fieldValue === 'object') return fieldValue;
            const key = String(fieldValue || '').trim();
            const fieldInfoCache = cache instanceof Map ? cache : null;
            if (!fieldInfoCache) return this.getFieldInfo(key);
            if (!fieldInfoCache.has(key)) {
                fieldInfoCache.set(key, this.getFieldInfo(key) || null);
            }
            return fieldInfoCache.get(key) || null;
        },

        __getTaskMemoMap(task, memoStore) {
            if (!task || typeof task !== 'object' || !(memoStore instanceof WeakMap)) return null;
            let taskMemo = memoStore.get(task);
            if (!(taskMemo instanceof Map)) {
                taskMemo = new Map();
                memoStore.set(task, taskMemo);
            }
            return taskMemo;
        },

        getTaskFieldValue(task, fieldValue, options = {}) {
            const opts = (options && typeof options === 'object') ? options : {};
            const fieldInfo = this.__getFieldInfoCached(fieldValue, opts.fieldInfoCache);
            const key = String(fieldInfo?.value || fieldValue || '').trim();
            const taskMemo = this.__getTaskMemoMap(task, opts.valueMemo);
            if (taskMemo && taskMemo.has(key)) return taskMemo.get(key);
            const customFieldId = String(fieldInfo?.customFieldId || __tmParseCustomFieldColumnKey(key) || '').trim();
            let result;
            if (customFieldId) result = __tmGetTaskCustomFieldValue(task, customFieldId);
            else if (key === 'customStatus') result = __tmResolveTaskStatusId(task, fieldInfo?.statusOptions || null);
            else if (key === 'priorityScore') result = __tmEnsureTaskPriorityScore(task);
            else if (key === 'startDate') result = task?.startDate ?? task?.start_date;
            else if (key === 'completionTime') result = task?.completionTime ?? task?.completion_time;
            else if (key === 'taskCompleteAt') result = typeof __tmResolveTaskCompletedAtRaw === 'function'
                ? __tmResolveTaskCompletedAtRaw(task)
                : (task?.taskCompleteAt ?? task?.task_complete_at);
            else result = task ? task[key] : undefined;
            if (taskMemo) taskMemo.set(key, result);
            return result;
        },

        getTaskSelectFieldValues(task, fieldValue, options = {}) {
            const opts = (options && typeof options === 'object') ? options : {};
            const fieldInfo = this.__getFieldInfoCached(fieldValue, opts.fieldInfoCache);
            const key = String(fieldInfo?.value || fieldValue || '').trim();
            const taskMemo = this.__getTaskMemoMap(task, opts.selectValueMemo);
            const memoKey = `__select__:${key}`;
            if (taskMemo && taskMemo.has(memoKey)) return taskMemo.get(memoKey);
            const rawValue = this.getTaskFieldValue(task, fieldInfo || fieldValue, opts);
            const normalized = this.normalizeSelectFieldValues(fieldInfo, rawValue);
            if (taskMemo) taskMemo.set(memoKey, normalized);
            return normalized;
        },

        getTaskTimeValue(task, fieldValue, options = {}) {
            const opts = (options && typeof options === 'object') ? options : {};
            const fieldInfo = this.__getFieldInfoCached(fieldValue, opts.fieldInfoCache);
            const key = String(fieldInfo?.value || fieldValue || '').trim();
            const taskMemo = this.__getTaskMemoMap(task, opts.timeValueMemo);
            const memoKey = `__time__:${key}`;
            if (taskMemo && taskMemo.has(memoKey)) return taskMemo.get(memoKey);
            const rawValue = this.getTaskFieldValue(task, fieldInfo || fieldValue, opts);
            const parsed = rawValue ? __tmParseTimeToTs(rawValue) : 0;
            const timeValue = Number.isFinite(parsed) ? parsed : 0;
            if (taskMemo) taskMemo.set(memoKey, timeValue);
            return timeValue;
        },

        buildConditionRuntime(condition, options = {}) {
            const opts = (options && typeof options === 'object') ? options : {};
            const field = String(condition?.field || '').trim();
            const operator = String(condition?.operator || '').trim();
            const value = condition?.value;
            const fieldInfo = this.__getFieldInfoCached(field, opts.fieldInfoCache);
            const isSelectField = fieldInfo?.type === 'select';
            const isTimeField = this.isTimeField(fieldInfo || field);
            const selectValues = isSelectField ? this.normalizeSelectFieldValues(fieldInfo, value) : [];
            const rawValues = Array.isArray(value)
                ? value
                : (typeof value === 'string' && value.includes(','))
                    ? value.split(',').map((item) => String(item || '').trim())
                    : [value];
            const emptyTokens = new Set(['', '无', '未设置', String(fieldInfo?.emptyLabel || '').trim()].filter(Boolean));
            const valueText = String(value ?? '').trim();
            const valueLower = valueText.toLowerCase();
            const doneTargetValue = (value === '' || value === null || typeof value === 'undefined')
                ? true
                : (value === true || value === 'true');
            const nowDate = opts.nowDate instanceof Date ? opts.nowDate : new Date();
            const timeRuntime = (() => {
                if (!isTimeField) return null;
                switch (operator) {
                    case 'range_today': {
                        const startTs = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
                        return { startTs, endTs: startTs + 24 * 60 * 60 * 1000 };
                    }
                    case 'before_today':
                    case 'after_today':
                    case 'on_or_before_today':
                    case 'on_or_after_today': {
                        const todayStartTs = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
                        return { todayStartTs, tomorrowStartTs: todayStartTs + 24 * 60 * 60 * 1000 };
                    }
                    case 'range_week': {
                        const startTs = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - nowDate.getDay()).getTime();
                        return { startTs, endTs: startTs + 7 * 24 * 60 * 60 * 1000 };
                    }
                    case 'range_month': {
                        const startTs = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
                        const endTs = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1).getTime();
                        return { startTs, endTs };
                    }
                    case 'range_year': {
                        const startTs = new Date(nowDate.getFullYear(), 0, 1).getTime();
                        const endTs = new Date(nowDate.getFullYear() + 1, 0, 1).getTime();
                        return { startTs, endTs };
                    }
                    case 'before':
                    case 'after':
                    case '=':
                    case '!=': {
                        const targetTs = __tmParseTimeToTs(value) || 0;
                        return { targetTs: Number.isFinite(targetTs) ? targetTs : 0 };
                    }
                    case 'between': {
                        let from = '';
                        let to = '';
                        if (value && typeof value === 'object') {
                            from = value.from || '';
                            to = value.to || '';
                        } else {
                            const parts = String(value || '').split(',');
                            from = parts[0] || '';
                            to = parts[1] || '';
                        }
                        const fromTs = __tmParseTimeToTs(from) || 0;
                        const toTs = __tmParseTimeToTs(to) || 0;
                        return {
                            fromTs: Number.isFinite(fromTs) ? fromTs : 0,
                            toTs: Number.isFinite(toTs) ? toTs : 0,
                        };
                    }
                    default:
                        return null;
                }
            })();
            return {
                condition,
                field,
                operator,
                value,
                fieldInfo,
                isSelectField,
                isTimeField,
                selectValues,
                rawValues,
                emptyTokens,
                firstSelectValue: selectValues[0] || '',
                valueText,
                valueLower,
                doneTargetValue,
                timeRuntime,
            };
        },

        normalizeSelectFieldValues(fieldValue, rawValue) {
            const fieldInfo = (fieldValue && typeof fieldValue === 'object') ? fieldValue : this.getFieldInfo(fieldValue);
            const optionLabels = (fieldInfo?.optionLabels && typeof fieldInfo.optionLabels === 'object') ? fieldInfo.optionLabels : {};
            const labelToValue = new Map();
            Object.entries(optionLabels).forEach(([value, label]) => {
                const text = String(label || '').trim();
                const key = String(value || '').trim();
                if (!text || !key || labelToValue.has(text)) return;
                labelToValue.set(text, key);
            });
            const normalizeOne = (input) => {
                const raw = String(input ?? '').trim();
                if (!raw) return '';
                if (Object.prototype.hasOwnProperty.call(optionLabels, raw)) return raw;
                return labelToValue.get(raw) || raw;
            };
            let list = [];
            if (Array.isArray(rawValue)) {
                list = rawValue;
            } else if (typeof rawValue === 'string' && rawValue.includes(',')) {
                list = rawValue.split(',').map((item) => String(item || '').trim());
            } else {
                list = [rawValue];
            }
            const out = [];
            const seen = new Set();
            list.forEach((item) => {
                const normalized = normalizeOne(item);
                if (!normalized || seen.has(normalized)) return;
                seen.add(normalized);
                out.push(normalized);
            });
            return out;
        },

        getSelectFieldLabel(fieldValue, rawValue) {
            const fieldInfo = (fieldValue && typeof fieldValue === 'object') ? fieldValue : this.getFieldInfo(fieldValue);
            const emptyLabel = String(fieldInfo?.emptyLabel || '未设置').trim() || '未设置';
            const normalized = this.normalizeSelectFieldValues(fieldInfo, rawValue);
            const token = String((normalized[0] || rawValue || '') ?? '').trim();
            if (!token) return emptyLabel;
            const optionLabels = (fieldInfo?.optionLabels && typeof fieldInfo.optionLabels === 'object') ? fieldInfo.optionLabels : {};
            return String(optionLabels[token] || token).trim() || token;
        },

        normalizeConditionMatchMode(condition, fieldValue = null) {
            const fieldInfo = (fieldValue && typeof fieldValue === 'object')
                ? fieldValue
                : this.getFieldInfo(fieldValue || condition?.field);
            return fieldInfo?.multi && String(condition?.matchMode || '').trim() === 'all' ? 'all' : 'any';
        },

        // 获取可用操作符
        getOperators(fieldType) {
            const baseOperators = [
                { value: '=', label: '等于' },
                { value: '!=', label: '不等于' },
                { value: 'in', label: '在列表中' },        // 多值匹配
                { value: 'not_in', label: '不在列表中' },  // 多值排除
                { value: 'contains', label: '包含' },
                { value: 'not_contains', label: '不包含' }
            ];

            const numberOperators = [
                { value: '>', label: '大于' },
                { value: '<', label: '小于' },
                { value: '>=', label: '大于等于' },
                { value: '<=', label: '小于等于' },
                { value: 'between', label: '介于' }
            ];

            const datetimeOperators = [
                { value: 'range_today', label: '今天' },
                { value: 'range_week', label: '本周' },
                { value: 'range_month', label: '本月' },
                { value: 'range_year', label: '今年' },
                { value: 'before_today', label: '今天之前' },
                { value: 'after_today', label: '今天之后' },
                { value: 'on_or_before_today', label: '今天及之前' },
                { value: 'on_or_after_today', label: '今天及之后' },
                { value: 'before', label: '之前' },
                { value: 'after', label: '之后' },
                { value: 'between', label: '介于' }
            ];

            switch(fieldType) {
                case 'number':
                    return [...baseOperators, ...numberOperators];
                case 'datetime':
                    return [...baseOperators, ...datetimeOperators];
                case 'boolean':
                    return [
                        { value: '=', label: '是' },
                        { value: '!=', label: '不是' }
                    ];
                default:
                    return baseOperators;
            }
        },

        // 获取排序字段
        getSortFields() {
            const sortFields = [
                { value: 'priorityScore', label: '优先级数值' },
                { value: 'priority', label: '优先级' },
                { value: 'customStatus', label: '状态' },
                { value: 'docSeq', label: '文档出现顺序' },
                { value: 'startDate', label: '开始日期' },
                { value: 'completionTime', label: '截止日期' },
                { value: 'taskCompleteAt', label: '完成时间' },
                { value: 'created', label: '创建时间' },
                { value: 'updated', label: '更新时间' },
                { value: 'content', label: '任务内容' },
                { value: 'docName', label: '文档名称' },
                { value: 'h2', label: (() => {
                    const level = SettingsStore.data.taskHeadingLevel || 'h2';
                    const labels = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
                    return labels[level] || '标题';
                })() },
                { value: 'duration', label: '任务时长' }
            ];
            __tmGetCustomFieldDefs().forEach((field) => {
                const fieldId = String(field?.id || '').trim();
                if (!fieldId || String(field?.type || '').trim() === 'text') return;
                sortFields.push({
                    value: __tmBuildCustomFieldColumnKey(fieldId),
                    label: `${String(field?.name || fieldId).trim() || fieldId}（自定义列）`,
                    customFieldId: fieldId,
                });
            });
            return sortFields;
        },

        // 应用规则筛选
        // 条件按从左到右顺序求值：每个条件的 join ('and' | 'or') 把它接到目前累计结果上。
        // 第 0 个条件的 join 被忽略（作为 reduce 的种子）。
        // 例：[a and b or c and d] = (((a AND b) OR c) AND d)
        applyRuleFilter(tasks, rule, options = {}) {
            if (!rule || !rule.conditions || rule.conditions.length === 0) {
                return tasks;
            }
            const opts = (options && typeof options === 'object') ? options : {};
            const compiledConditions = rule.conditions.map((condition) => ({
                runtime: this.buildConditionRuntime(condition, opts),
                join: String(condition?.join || 'and').toLowerCase() === 'or' ? 'or' : 'and',
            }));
            return tasks.filter(task => {
                let acc = false;
                for (let i = 0; i < compiledConditions.length; i++) {
                    const { runtime, join } = compiledConditions[i];
                    const v = this.evaluateCondition(task, runtime, opts);
                    if (i === 0) {
                        acc = v;
                    } else if (join === 'or') {
                        acc = acc || v;
                    } else {
                        acc = acc && v;
                    }
                }
                return acc;
            });
        },

        // 评估单个条件
        evaluateCondition(task, condition, options = {}) {
            const opts = (options && typeof options === 'object') ? options : {};
            const runtime = (condition && typeof condition === 'object' && Object.prototype.hasOwnProperty.call(condition, 'fieldInfo'))
                ? condition
                : this.buildConditionRuntime(condition, opts);
            const { field, operator, value, fieldInfo, isSelectField } = runtime;
            let taskValue = this.getTaskFieldValue(task, fieldInfo || field, opts);
            if (field === 'customStatus') {
                const raw = String(taskValue || '').trim();
                if (raw) {
                    taskValue = raw;
                } else {
                    const fallback = String(fieldInfo?.defaultStatusId || __tmGetDefaultUndoneStatusId(fieldInfo?.statusOptions || null) || '').trim();
                    taskValue = fallback;
                }
            }
            const taskSelectValues = isSelectField ? this.getTaskSelectFieldValues(task, fieldInfo || field, opts) : [];

            // 处理布尔值
            if (field === 'done') {
                if (String(value) === '__all__') return true;
                const targetValue = runtime.doneTargetValue;
                if (operator === '=') return task.done === targetValue;
                if (operator === '!=') return task.done !== targetValue;
            }

            // 处理多值匹配（in / not_in）
            if (operator === 'in' || operator === 'not_in') {
                // value 应该是数组格式 ['high', 'medium', 'low']
                let values = [];
                if (isSelectField) {
                    values = runtime.selectValues;
                } else {
                    if (Array.isArray(value)) {
                        values = value;
                    } else if (typeof value === 'string' && value.includes(',')) {
                        values = value.split(',').map(v => v.trim());
                    } else {
                        values = [value];
                    }
                }

                // 空值（无）也作为一个选项
                const hasEmpty = runtime.rawValues.some((item) => {
                    const token = String(item ?? '').trim();
                    return runtime.emptyTokens.has(token);
                });
                const nonEmptyValues = values.filter((item) => !runtime.emptyTokens.has(String(item ?? '').trim()));

                const taskValueStr = String(taskValue || '').trim();
                const taskMatch = isSelectField
                    ? taskSelectValues.some((item) => nonEmptyValues.includes(item))
                    : nonEmptyValues.includes(taskValueStr);
                const hasEmptyMatch = isSelectField
                    ? taskSelectValues.length === 0 && hasEmpty
                    : (!taskValueStr || taskValueStr === '') && hasEmpty;

                if (isSelectField && fieldInfo?.multi) {
                    const matchMode = this.normalizeConditionMatchMode(condition, fieldInfo);
                    const taskHasValue = taskSelectValues.length > 0;
                    const hasAnySelectedValue = nonEmptyValues.length > 0;
                    const anySelectedMatch = hasAnySelectedValue && taskSelectValues.some((item) => nonEmptyValues.includes(item));
                    const allSelectedMatch = hasAnySelectedValue && nonEmptyValues.every((item) => taskSelectValues.includes(item));
                    let positiveMatch = false;

                    if (matchMode === 'all') {
                        if (hasEmpty && hasAnySelectedValue) {
                            positiveMatch = false;
                        } else if (hasEmpty) {
                            positiveMatch = !taskHasValue;
                        } else {
                            positiveMatch = allSelectedMatch;
                        }
                    } else {
                        positiveMatch = anySelectedMatch || (hasEmpty && !taskHasValue);
                    }

                    return operator === 'in' ? positiveMatch : !positiveMatch;
                }

                if (operator === 'in') {
                    return taskMatch || hasEmptyMatch;
                } else { // not_in
                    return !taskMatch && !hasEmptyMatch;
                }
            }

            if (isSelectField) {
                const targetValue = runtime.firstSelectValue || '';
                const isEmptyTarget = !targetValue && (value === '' || value === null || typeof value === 'undefined');
                switch (operator) {
                    case '=':
                    case 'contains':
                        return isEmptyTarget ? taskSelectValues.length === 0 : taskSelectValues.includes(targetValue);
                    case '!=':
                    case 'not_contains':
                        return isEmptyTarget ? taskSelectValues.length > 0 : !taskSelectValues.includes(targetValue);
                }
            }

            // 处理文本字段
            if (typeof taskValue === 'string') {
                const taskStr = taskValue.toLowerCase();
                const valueStr = runtime.valueLower;

                switch(operator) {
                    case '=': return taskStr === valueStr;
                    case '!=': return taskStr !== valueStr;
                    case 'contains': return taskStr.includes(valueStr);
                    case 'not_contains': return !taskStr.includes(valueStr);
                }
            }

            // 处理时间字段
            if (runtime.isTimeField) {
                return this.evaluateTimeCondition(task, runtime, opts);
            }

            // 默认比较
            if (operator === '=') return taskValue === value;
            if (operator === '!=') return taskValue !== value;

            return true;
        },

        // 评估时间条件
        evaluateTimeCondition(task, runtime, options = {}) {
            const opts = (options && typeof options === 'object') ? options : {};
            const operator = String(runtime?.operator || '').trim();
            const taskTs = this.getTaskTimeValue(task, runtime.fieldInfo || runtime.field, opts);
            if (!taskTs) return operator === '!='; // 空时间处理

            const timeRuntime = runtime?.timeRuntime || null;
            switch(operator) {
                case 'range_today': {
                    return taskTs >= Number(timeRuntime?.startTs || 0) && taskTs < Number(timeRuntime?.endTs || 0);
                }
                case 'before_today': {
                    return taskTs < Number(timeRuntime?.todayStartTs || 0);
                }
                case 'after_today': {
                    return taskTs >= Number(timeRuntime?.tomorrowStartTs || 0);
                }
                case 'on_or_before_today': {
                    return taskTs < Number(timeRuntime?.tomorrowStartTs || 0);
                }
                case 'on_or_after_today': {
                    return taskTs >= Number(timeRuntime?.todayStartTs || 0);
                }
                case 'range_week': {
                    return taskTs >= Number(timeRuntime?.startTs || 0) && taskTs < Number(timeRuntime?.endTs || 0);
                }
                case 'range_month': {
                    return taskTs >= Number(timeRuntime?.startTs || 0) && taskTs < Number(timeRuntime?.endTs || 0);
                }
                case 'range_year': {
                    return taskTs >= Number(timeRuntime?.startTs || 0) && taskTs < Number(timeRuntime?.endTs || 0);
                }
                case 'before': {
                    return taskTs < Number(timeRuntime?.targetTs || 0);
                }
                case 'after': {
                    return taskTs > Number(timeRuntime?.targetTs || 0);
                }
                case 'between': {
                    return taskTs >= Number(timeRuntime?.fromTs || 0) && taskTs <= Number(timeRuntime?.toTs || 0);
                }
                case '=': return taskTs === Number(timeRuntime?.targetTs || 0);
                case '!=': return taskTs !== Number(timeRuntime?.targetTs || 0);
            }

            return true;
        },

        // 应用规则排序
        applyRuleSort(tasks, rule, options = {}) {
            const source = Array.isArray(tasks) ? tasks : [];
            const opts = (options && typeof options === 'object') ? options : {};
            // 置顶任务始终排在最前
            const pinnedSort = (a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return 0;
            };

            if (__tmRuleUsesDocFlowSort(rule)) {
                return [...source].sort(pinnedSort);
            }

            const timeSortMemo = opts.timeSortMemo instanceof Map ? opts.timeSortMemo : new Map();
            const sortRules = __tmGetNormalizedRuleSorts(rule);
            if (!sortRules.length) {
                return [...source].sort(pinnedSort);
            }

            const fieldInfoCache = opts.fieldInfoCache instanceof Map ? opts.fieldInfoCache : new Map();
            const getFieldInfoCached = (field) => {
                const key = String(field || '').trim();
                if (!fieldInfoCache.has(key)) {
                    fieldInfoCache.set(key, this.getFieldInfo(key) || null);
                }
                return fieldInfoCache.get(key);
            };

            const priorityOrder = { high: 3, medium: 2, low: 1 };
            const statusOptions = __tmGetStatusOptions(Array.isArray(SettingsStore.data.customStatusOptions)
                ? SettingsStore.data.customStatusOptions
                : []);
            const defaultStatusId = __tmGetDefaultUndoneStatusId(statusOptions);
            const statusOrderMap = new Map(statusOptions.map((option, index) => [String(option?.id || '').trim(), index]).filter(([id]) => !!id));
            const sortContexts = sortRules.map((sortRule) => {
                const field = String(sortRule?.field || '').trim();
                const fieldInfo = getFieldInfoCached(field);
                const kind = (() => {
                    if (field === 'priority') return 'priority';
                    if (field === 'priorityScore') return 'number';
                    if (field === 'docSeq') return 'docSeq';
                    if (field === 'customStatus') return 'customStatus';
                    if (fieldInfo?.customFieldId) return 'customSelect';
                    if (this.isTimeField(fieldInfo || field)) return 'time';
                    return 'default';
                })();
                return {
                    field,
                    fieldInfo,
                    kind,
                    useEffectiveCompletionTime: field === 'completionTime' && __tmShouldUseBestSubtaskTimeForSort(field),
                    optionOrderMap: fieldInfo?.customFieldId
                        ? new Map((Array.isArray(fieldInfo?.options) ? fieldInfo.options : []).map((value, index) => [String(value || '').trim(), index]).filter(([value]) => !!value))
                        : null,
                    optionLabelMap: (fieldInfo?.optionLabels && typeof fieldInfo.optionLabels === 'object') ? fieldInfo.optionLabels : null,
                };
            });

            const buildPreparedSortKey = (task, ctx) => {
                let raw;
                if (ctx.useEffectiveCompletionTime) {
                    raw = __tmGetTaskEffectiveCompletionTimeSortValue(task, { field: ctx.field, memo: timeSortMemo });
                } else if (ctx.field === 'priorityScore') {
                    raw = __tmEnsureTaskPriorityScore(task, { timeInfoMemo: timeSortMemo });
                } else if (ctx.kind === 'customSelect') {
                    raw = this.getTaskSelectFieldValues(task, ctx.fieldInfo || ctx.field, opts);
                } else {
                    raw = this.getTaskFieldValue(task, ctx.fieldInfo || ctx.field, opts);
                }

                switch (ctx.kind) {
                    case 'priority': {
                        const token = ({ '高': 'high', '中': 'medium', '低': 'low' }[String(raw ?? '').trim()] || String(raw ?? '').trim());
                        return Number(priorityOrder[token] || 0);
                    }
                    case 'number': {
                        const value = Number(raw);
                        return Number.isFinite(value) ? value : 0;
                    }
                    case 'docSeq': {
                        const value = Number(raw);
                        return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
                    }
                    case 'customStatus': {
                        const token = String(raw || '').trim() || defaultStatusId;
                        return statusOrderMap.has(token) ? statusOrderMap.get(token) : 9999;
                    }
                    case 'customSelect': {
                        const values = Array.isArray(raw) ? raw : this.normalizeSelectFieldValues(ctx.fieldInfo, raw);
                        if (!values.length) {
                            return { empty: 1, ranks: [], len: 0, label: '' };
                        }
                        const ranks = values
                            .map((value) => ctx.optionOrderMap?.has(value) ? ctx.optionOrderMap.get(value) : 9999)
                            .sort((a, b) => a - b);
                        const label = values
                            .map((value) => String(ctx.optionLabelMap?.[value] || value || '').trim() || String(value || '').trim())
                            .join('\u0001');
                        return { empty: 0, ranks, len: values.length, label };
                    }
                    case 'time': {
                        if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
                            return { has: true, ts: raw };
                        }
                        const hasValue = !!raw;
                        const ts = hasValue ? __tmParseTimeToTs(raw) : 0;
                        return { has: hasValue, ts: Number.isFinite(ts) ? ts : 0 };
                    }
                    default:
                        return raw;
                }
            };

            const comparePreparedSortKey = (leftKey, rightKey, ctx) => {
                switch (ctx.kind) {
                    case 'priority':
                    case 'number':
                    case 'customStatus':
                        return Number(leftKey || 0) - Number(rightKey || 0);
                    case 'docSeq': {
                        const va = Number.isFinite(Number(leftKey)) ? Number(leftKey) : Number.POSITIVE_INFINITY;
                        const vb = Number.isFinite(Number(rightKey)) ? Number(rightKey) : Number.POSITIVE_INFINITY;
                        return vb - va;
                    }
                    case 'customSelect': {
                        if (leftKey?.empty && rightKey?.empty) return 0;
                        if (leftKey?.empty) return 1;
                        if (rightKey?.empty) return -1;
                        const ranksA = Array.isArray(leftKey?.ranks) ? leftKey.ranks : [];
                        const ranksB = Array.isArray(rightKey?.ranks) ? rightKey.ranks : [];
                        const length = Math.max(ranksA.length, ranksB.length);
                        for (let i = 0; i < length; i += 1) {
                            const va = Number.isFinite(ranksA[i]) ? ranksA[i] : 9999;
                            const vb = Number.isFinite(ranksB[i]) ? ranksB[i] : 9999;
                            if (va !== vb) return va - vb;
                        }
                        if (Number(leftKey?.len || 0) !== Number(rightKey?.len || 0)) {
                            return Number(leftKey?.len || 0) - Number(rightKey?.len || 0);
                        }
                        return String(leftKey?.label || '').localeCompare(String(rightKey?.label || ''), 'zh-CN');
                    }
                    case 'time': {
                        const hasA = !!leftKey?.has;
                        const hasB = !!rightKey?.has;
                        if (!hasA && !hasB) return 0;
                        if (!hasA) return 1;
                        if (!hasB) return -1;
                        return Number(leftKey?.ts || 0) - Number(rightKey?.ts || 0);
                    }
                    default:
                        if (leftKey === rightKey) return 0;
                        return leftKey < rightKey ? -1 : 1;
                }
            };

            const decorated = source.map((task, index) => {
                const keys = sortContexts.map((ctx) => buildPreparedSortKey(task, ctx));
                return {
                    task,
                    index,
                    pinned: !!task?.pinned,
                    keys,
                };
            });

            decorated.sort((left, right) => {
                if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
                for (let i = 0; i < sortRules.length; i += 1) {
                    const sortRule = sortRules[i] || {};
                    const sortContext = sortContexts[i];
                    const result = comparePreparedSortKey(left.keys[i], right.keys[i], sortContext);
                    if (result !== 0) {
                        return sortRule.order === 'desc' ? -result : result;
                    }
                }
                return left.index - right.index;
            });

            return decorated.map((item) => item.task);
        },

        // 比较值
        compareValues(a, b, field, fieldInfo = null) {
            const info = (fieldInfo && typeof fieldInfo === 'object') ? fieldInfo : this.getFieldInfo(field);
            // 处理优先级特殊比较
            if (field === 'priority') {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                const na = ({ '高': 'high', '中': 'medium', '低': 'low' }[String(a ?? '').trim()] || String(a ?? '').trim());
                const nb = ({ '高': 'high', '中': 'medium', '低': 'low' }[String(b ?? '').trim()] || String(b ?? '').trim());
                return (priorityOrder[na] || 0) - (priorityOrder[nb] || 0);
            }
            if (field === 'priorityScore') {
                const na = Number(a);
                const nb = Number(b);
                const va = Number.isFinite(na) ? na : 0;
                const vb = Number.isFinite(nb) ? nb : 0;
                return va - vb;
            }
            if (field === 'docSeq') {
                const na = Number(a);
                const nb = Number(b);
                const va = Number.isFinite(na) ? na : Number.POSITIVE_INFINITY;
                const vb = Number.isFinite(nb) ? nb : Number.POSITIVE_INFINITY;
                return vb - va;
            }

            // 处理状态排序
            if (field === 'customStatus') {
                const options = SettingsStore.data.customStatusOptions || [];
                const fallback = __tmGetDefaultUndoneStatusId(options);
                const normalizeStatus = (value) => {
                    const raw = String(value ?? '').trim();
                    return raw || fallback;
                };
                const indexA = options.findIndex(o => o.id === normalizeStatus(a));
                const indexB = options.findIndex(o => o.id === normalizeStatus(b));
                const valA = indexA === -1 ? 9999 : indexA;
                const valB = indexB === -1 ? 9999 : indexB;
                return valA - valB;
            }
            if (info?.customFieldId) {
                const valuesA = this.normalizeSelectFieldValues(info, a);
                const valuesB = this.normalizeSelectFieldValues(info, b);
                if (!valuesA.length && !valuesB.length) return 0;
                if (!valuesA.length) return 1;
                if (!valuesB.length) return -1;
                const optionOrder = new Map((Array.isArray(info.options) ? info.options : []).map((value, index) => [String(value || '').trim(), index]));
                const rankList = (values) => values
                    .map((value) => optionOrder.has(value) ? optionOrder.get(value) : 9999)
                    .sort((x, y) => x - y);
                const rankedA = rankList(valuesA);
                const rankedB = rankList(valuesB);
                const length = Math.max(rankedA.length, rankedB.length);
                for (let i = 0; i < length; i += 1) {
                    const va = Number.isFinite(rankedA[i]) ? rankedA[i] : 9999;
                    const vb = Number.isFinite(rankedB[i]) ? rankedB[i] : 9999;
                    if (va !== vb) return va - vb;
                }
                if (rankedA.length !== rankedB.length) return rankedA.length - rankedB.length;
                const labelA = valuesA.map((value) => this.getSelectFieldLabel(info, value)).join('\u0001');
                const labelB = valuesB.map((value) => this.getSelectFieldLabel(info, value)).join('\u0001');
                return labelA.localeCompare(labelB, 'zh-CN');
            }

            // 处理时间比较
            if (this.isTimeField(info || field)) {
                const timeA = a ? __tmParseTimeToTs(a) : 0;
                const timeB = b ? __tmParseTimeToTs(b) : 0;
                // 空日期（返回0）视为最大，这样升序时会排在最后面
                // 实际有日期的会排在前面
                const hasA = !!a;
                const hasB = !!b;
                if (!hasA && !hasB) return 0;
                if (!hasA) return 1;  // a为空，视为最大，排在后面
                if (!hasB) return -1; // b为空，视为最大，排在后面
                return timeA - timeB;
            }

            // 默认比较
            if (a === b) return 0;
            return a < b ? -1 : 1;
        }
    };

    const __tmTasksQueryCache = new Map();
    const __tmDocExpandCache = new Map();
    const __tmResolvedDocIdsCacheMap = new Map();
    const __tmGroupSessionTaskCache = new Map();
    const __tmDocSessionTaskCache = new Map();
    const __tmDocHasTaskQueryCache = new Map();
    const __tmDocEnhanceSnapshotCache = new Map();
    const __tmTaskDocMapCache = new Map();
    const __tmAttrHostParentResolutionCache = new Map();
    const __tmDocFlowRankHoldUntil = new Map();
    const __tmDocEnhanceWarmQueue = { items: [], set: new Set(), running: 0, timer: null };
    const __tmSqlInFlight = new Map();
    const __tmSqlQueue = { max: 3, active: 0, q: [] };
    const __tmAuxQueryCache = new Map();
    const __tmTaskIndexPrewarmState = {
        running: false,
        pendingDocIds: new Set(),
        timer: null,
        lastStartedAt: 0,
    };
    const __tmResolvedDocIdsPrewarmState = {
        timer: null,
        running: false,
    };
    let __tmResolvedDocIdsCache = null;
    let __tmResolvedDocIdsPromise = null;
    let __tmSqlCacheInvalidationBound = false;
    let __tmSqlCacheInvalidationHandler = null;
    let __tmSqlCacheEventBusHandler = null;
    let __tmSqlCacheEventBuses = [];
    let __tmCalendarTxRefreshTimer = null;
    let __tmCalendarTxRefreshPending = false;
    let __tmTxTaskRefreshTimer = null;
    let __tmTxTaskRefreshInFlight = false;
    let __tmWsTaskTxBatchTimer = null;
    let __tmWsTaskTxBatch = null;
    let __tmTaskSnapshotSaveTimer = null;
    let __tmTaskSnapshotSaveInFlight = false;
    let __tmTaskSnapshotStoreCache = null;
    let __tmTaskSnapshotStoreLoadPromise = null;
    const __tmTaskSnapshotPersistSignatureCache = new Map();
    const __tmTxTaskRefreshDocIds = new Set();
    const __tmTxTaskRefreshBlockIds = new Set();
    let __tmLocalTimeTxSuppressUntil = 0;
    const __tmLocalTimeTxSuppressTaskIds = new Set();
    const __tmLocalTimeTxSuppressDocIds = new Set();
    let __tmLocalDoneTxSuppressUntil = 0;
    const __tmLocalDoneTxSuppressBlockIds = new Set();
    const __tmLocalDoneTxSuppressDocIds = new Set();
    let __tmLocalMoveTxSuppressUntil = 0;
    const __tmLocalMoveTxSuppressBlockIds = new Set();
    const __tmLocalMoveTxSuppressDocIds = new Set();
    const __tmRecentVisibleDateFallbackTasks = new Map();

    function __tmClearAttrHostResolutionCache() {
        try { __tmAttrHostParentResolutionCache.clear(); } catch (e) {}
    }

    function __tmBuildTaskParentListHostShape(parentListId = '', source = null) {
        const src = (source && typeof source === 'object') ? source : {};
        const siblingTaskCountRaw = src.parentListTaskCount
            ?? src.parent_list_task_count
            ?? src.parentTaskCount
            ?? src.parent_task_count
            ?? src.siblingTaskCount;
        return {
            parentId: String(parentListId || src.parent_id || src.parentId || '').trim(),
            parentType: String(src.parentListType || src.parent_list_type || src.parentType || '').trim().toLowerCase(),
            siblingTaskCount: Number.isFinite(Number(siblingTaskCountRaw)) ? Number(siblingTaskCountRaw) : NaN,
        };
    }

    function __tmResolveTaskAttrHostIdFromParentShape(taskId, parentListId = '', source = null) {
        const tid = String(taskId || '').trim();
        const shape = __tmBuildTaskParentListHostShape(parentListId, source);
        const parentId = String(shape.parentId || '').trim();
        if (!tid) {
            return { resolved: true, attrHostId: '', useParentHost: false, parentId };
        }
        if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(parentId)) {
            return { resolved: true, attrHostId: tid, useParentHost: false, parentId };
        }
        if (shape.parentType && shape.parentType !== 'l') {
            return { resolved: true, attrHostId: tid, useParentHost: false, parentId };
        }
        if (shape.parentType === 'l' && Number.isFinite(shape.siblingTaskCount)) {
            const useParentHost = shape.siblingTaskCount === 1;
            return {
                resolved: true,
                attrHostId: useParentHost ? parentId : tid,
                useParentHost,
                parentId,
            };
        }
        return { resolved: false, attrHostId: '', useParentHost: false, parentId };
    }

    function __tmRememberAttrHostParentResolution(parentId, useParentHost, nowTs = Date.now()) {
        const pid = String(parentId || '').trim();
        if (!pid) return;
        try {
            __tmAttrHostParentResolutionCache.set(pid, {
                t: Number(nowTs) || Date.now(),
                useParentHost: useParentHost === true,
            });
            if (__tmAttrHostParentResolutionCache.size > 2400) {
                const oldestKey = __tmAttrHostParentResolutionCache.keys().next().value;
                if (oldestKey !== undefined) __tmAttrHostParentResolutionCache.delete(oldestKey);
            }
        } catch (e) {}
    }

    async function __tmResolveStableTaskAttrHostId(taskId, parentListId = '', source = null) {
        const tid = String(taskId || '').trim();
        const parentId = String(parentListId || '').trim();
        if (!tid) return '';
        const resolvedFromShape = __tmResolveTaskAttrHostIdFromParentShape(tid, parentId, source);
        if (resolvedFromShape.resolved) {
            if (/^[0-9]+-[a-zA-Z0-9]+$/.test(resolvedFromShape.parentId)) {
                __tmRememberAttrHostParentResolution(resolvedFromShape.parentId, resolvedFromShape.useParentHost === true);
            }
            return resolvedFromShape.attrHostId || tid;
        }
        if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(parentId)) return tid;
        const cacheTtlMs = 20000;
        const nowTs = Date.now();
        try {
            const cached = __tmAttrHostParentResolutionCache.get(parentId);
            if (cached && (nowTs - Number(cached.t || 0)) < cacheTtlMs) {
                if (cached.useParentHost === true) return parentId;
                return tid;
            }
        } catch (e) {}
        let parentRow = null;
        try {
            const rows = await API.getBlocksByIds([parentId]);
            parentRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        } catch (e) {
            parentRow = null;
        }
        const parentType = String(parentRow?.type || '').trim().toLowerCase();
        if (parentType !== 'l') {
            __tmRememberAttrHostParentResolution(parentId, false, nowTs);
            return tid;
        }
        let taskCount = 0;
        try {
            const taskCountMap = await __tmQueryTaskSiblingCountsByParentIds([parentId]);
            taskCount = Number(taskCountMap.get(parentId) || 0);
        } catch (e) {
            taskCount = 0;
        }
        const useParentHost = taskCount === 1;
        __tmRememberAttrHostParentResolution(parentId, useParentHost, nowTs);
        if (useParentHost) return parentId;
        return tid;
    }

    function __tmIsVisibleDateAttrKey(key) {
        const normalized = String(key || '').trim();
        return normalized === 'custom-start-date'
            || normalized === 'custom-completion-time'
            || normalized === 'custom-time';
    }

    function __tmIsQuickbarRefreshDebugEnabled() {
        return false;
    }

    function __tmQuickbarRefreshDebugLog(tag, payload = {}) {
        return;
    }

    function __tmPruneRecentVisibleDateFallbackTasks(maxAgeMs = 20000) {
        const now = Date.now();
        const ttl = Math.max(1000, Number(maxAgeMs) || 20000);
        __tmRecentVisibleDateFallbackTasks.forEach((ts, taskId) => {
            if (!taskId || !ts || (now - Number(ts)) > ttl) {
                __tmRecentVisibleDateFallbackTasks.delete(taskId);
            }
        });
    }

    function __tmMarkVisibleDateFallbackTask(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return;
        __tmPruneRecentVisibleDateFallbackTasks();
        __tmRecentVisibleDateFallbackTasks.set(tid, Date.now());
    }

    function __tmTransferVisibleDateFallbackTaskId(fromTaskId, toTaskId) {
        const fromId = String(fromTaskId || '').trim();
        const toId = String(toTaskId || '').trim();
        if (!fromId || !toId || fromId === toId) return;
        __tmPruneRecentVisibleDateFallbackTasks();
        const recentTs = Number(__tmRecentVisibleDateFallbackTasks.get(fromId) || 0);
        if (!recentTs) return;
        __tmRecentVisibleDateFallbackTasks.set(toId, recentTs);
        __tmRecentVisibleDateFallbackTasks.delete(fromId);
    }

    function __tmHasPendingVisibleDatePersistence(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        __tmPruneRecentVisibleDateFallbackTasks();
        if (state.pendingInsertedTasks?.[tid]) return true;
        const recentTs = Number(__tmRecentVisibleDateFallbackTasks.get(tid) || 0);
        if (recentTs && (Date.now() - recentTs) <= 20000) return true;
        const items = Array.isArray(__tmOpQueue?.items) ? __tmOpQueue.items : [];
        return items.some((op) => {
            if (!op || String(op.status || '').trim() !== 'queued') return false;
            if (String(op.type || '').trim() !== 'attrPatch') return false;
            if (String(op?.data?.taskId || '').trim() !== tid) return false;
            const patch = (op?.data?.patch && typeof op.data.patch === 'object') ? op.data.patch : null;
            if (!patch) return false;
            return Object.prototype.hasOwnProperty.call(patch, 'startDate')
                || Object.prototype.hasOwnProperty.call(patch, 'completionTime')
                || Object.prototype.hasOwnProperty.call(patch, 'customTime');
        });
    }

    function __tmBuildVisibleDateFallbackTaskIdSet() {
        const out = new Set();
        try { __tmPruneRecentVisibleDateFallbackTasks(); } catch (e) {}
        try {
            Object.keys(state.pendingInsertedTasks || {}).forEach((taskId) => {
                const tid = String(taskId || '').trim();
                if (tid) out.add(tid);
            });
        } catch (e) {}
        try {
            const now = Date.now();
            __tmRecentVisibleDateFallbackTasks.forEach((recentTs, taskId) => {
                const tid = String(taskId || '').trim();
                if (!tid) return;
                if (Number(recentTs) && (now - Number(recentTs)) <= 20000) out.add(tid);
            });
        } catch (e) {}
        try {
            const items = Array.isArray(__tmOpQueue?.items) ? __tmOpQueue.items : [];
            items.forEach((op) => {
                if (!op || String(op.status || '').trim() !== 'queued') return;
                if (String(op.type || '').trim() !== 'attrPatch') return;
                const tid = String(op?.data?.taskId || '').trim();
                if (!tid) return;
                const patch = (op?.data?.patch && typeof op.data.patch === 'object') ? op.data.patch : null;
                if (!patch) return;
                if (Object.prototype.hasOwnProperty.call(patch, 'startDate')
                    || Object.prototype.hasOwnProperty.call(patch, 'completionTime')
                    || Object.prototype.hasOwnProperty.call(patch, 'customTime')) {
                    out.add(tid);
                }
            });
        } catch (e) {}
        return out;
    }

    function __tmShouldSyncAttrKeyFromTx(key) {
        const normalized = String(key || '').trim();
        if (!normalized) return false;
        if (normalized === 'custom-status'
            || normalized === 'custom-priority'
            || normalized === 'custom-start-date'
            || normalized === 'custom-completion-time'
            || normalized === 'custom-time'
            || normalized === __TM_TASK_COMPLETE_AT_ATTR
            || normalized === 'custom-duration'
            || normalized === 'custom-remark'
            || normalized === 'custom-milestone-event'
            || normalized === 'custom-pinned'
            || normalized === __TM_TASK_REPEAT_RULE_ATTR
            || normalized === __TM_TASK_REPEAT_STATE_ATTR
            || normalized === __TM_TASK_REPEAT_HISTORY_ATTR
            || normalized === 'bookmark'
            || normalized === 'custom-reminder') {
            return true;
        }
        if (__tmIsTaskAttachmentAttrKey(normalized)) return true;
        try {
            return !!__tmGetCustomFieldDefByAttrStorageKey(normalized);
        } catch (e) {
            return false;
        }
    }

    function __tmShouldSuppressLocalAttrTxKey(key) {
        const normalized = String(key || '').trim();
        if (!normalized) return false;
        if (__tmShouldSyncAttrKeyFromTx(normalized)) return true;
        return normalized === 'custom-time'
            || normalized === __TM_TASK_COMPLETE_AT_ATTR
            || normalized === __TM_TASK_REPEAT_RULE_ATTR
            || normalized === __TM_TASK_REPEAT_STATE_ATTR
            || normalized === __TM_TASK_REPEAT_HISTORY_ATTR
            || normalized === 'custom-milestone-event';
    }

    function __tmExtractAttrUpdatesFromTx(payload) {
        const updateMap = new Map();
        const mergeNameValueAttr = (target, source) => {
            if (!source || typeof source !== 'object' || Array.isArray(source)) return;
            const key = String(
                source.name
                || source.attrName
                || source.attrKey
                || source.key
                || ''
            ).trim();
            if (!__tmShouldSyncAttrKeyFromTx(key)) return;
            const rawValue = Object.prototype.hasOwnProperty.call(source, 'value')
                ? source.value
                : (Object.prototype.hasOwnProperty.call(source, 'val') ? source.val : source.data);
            target[key] = rawValue == null ? '' : String(rawValue);
        };
        const mergePatchFromSource = (target, source) => {
            if (!source || typeof source !== 'object' || Array.isArray(source)) return;
            Object.entries(source).forEach(([rawKey, rawValue]) => {
                const key = String(rawKey || '').trim();
                if (!__tmShouldSyncAttrKeyFromTx(key)) return;
                target[key] = rawValue == null ? '' : String(rawValue);
            });
        };
        const collectFromNode = (node) => {
            if (!node || typeof node !== 'object') return;
            const data = (node.data && typeof node.data === 'object' && !Array.isArray(node.data)) ? node.data : null;
            const action = String(node.action || node.cmd || node.operation || data?.action || '').trim().toLowerCase();
            const blockId = [
                data?.id,
                data?.block_id,
                data?.blockID,
                data?.blockId,
                node.id,
                node.block_id,
                node.blockID,
                node.blockId
            ].map((value) => String(value || '').trim()).find((value) => __tmIsLikelyBlockId(value)) || '';
            if (!blockId) return;
            const patch = {};
            mergePatchFromSource(patch, data?.attrs);
            mergePatchFromSource(patch, data?.new);
            mergePatchFromSource(patch, data?.newAttrs);
            mergePatchFromSource(patch, node.attrs);
            mergePatchFromSource(patch, node.new);
            mergePatchFromSource(patch, node.newAttrs);
            mergeNameValueAttr(patch, data);
            mergeNameValueAttr(patch, node);
            if (!Object.keys(patch).length && (action === 'updateattrs' || action === 'setattrs' || action === 'setblockattrs')) {
                mergePatchFromSource(patch, data);
            }
            if (!Object.keys(patch).length) return;
            Object.entries(patch).forEach(([key, value]) => {
                updateMap.set(`${blockId}::${key}`, { taskId: blockId, key, value });
            });
        };
        const walk = (node, depth) => {
            if (depth > 7 || !node) return;
            if (Array.isArray(node)) {
                node.forEach((item) => walk(item, depth + 1));
                return;
            }
            if (typeof node !== 'object') return;
            collectFromNode(node);
            [
                node.data,
                node.detail,
                node.tx,
                node.payload,
                node.rows,
                node.ops,
                node.operations,
                node.doOperations,
                node.undoOperations,
                node.children,
                node.items,
                node.srcs,
                node.dsts
            ].forEach((next) => walk(next, depth + 1));
        };
        walk(payload, 0);
        return Array.from(updateMap.values());
    }

    function __tmHasOnlyAttrOperationsInTx(payload) {
        const neutralActions = new Set([
            'transactions',
            'savedoc',
            'backgroundtask',
        ]);
        const explicitAttrActions = new Set([
            'updateattrs',
            'setattrs',
            'setattr',
            'setblockattrs',
            'setblockattr',
            'updateblockattrs',
            'updateblockattr',
        ]);
        const isAttrAction = (action) => {
            const normalized = String(action || '').trim().toLowerCase();
            if (!normalized) return false;
            if (explicitAttrActions.has(normalized)) return true;
            return normalized.includes('attr');
        };
        let hasAnyOperation = false;
        let hasNonAttrOperation = false;
        const walk = (node, depth) => {
            if (depth > 7 || !node || hasNonAttrOperation) return;
            if (Array.isArray(node)) {
                node.forEach((item) => walk(item, depth + 1));
                return;
            }
            if (typeof node !== 'object') return;
            const data = (node.data && typeof node.data === 'object' && !Array.isArray(node.data)) ? node.data : null;
            const action = String(
                node.action
                || node.cmd
                || node.operation
                || node.op
                || data?.action
                || data?.cmd
                || data?.operation
                || ''
            ).trim().toLowerCase();
            if (action && !neutralActions.has(action)) {
                hasAnyOperation = true;
                if (!isAttrAction(action)) {
                    hasNonAttrOperation = true;
                    return;
                }
            }
            [
                node.data,
                node.detail,
                node.tx,
                node.payload,
                node.rows,
                node.ops,
                node.operations,
                node.doOperations,
                node.undoOperations,
                node.children,
                node.items,
                node.srcs,
                node.dsts,
            ].forEach((next) => walk(next, depth + 1));
        };
        walk(payload, 0);
        return hasAnyOperation && !hasNonAttrOperation;
    }

    function __tmIsFastAttrOnlyRefreshEligible(txAttrUpdates = [], txAttrApplyResult = null, isAttrOnlyTx = false) {
        if (!isAttrOnlyTx) return false;
        const updates = Array.isArray(txAttrUpdates) ? txAttrUpdates : [];
        if (!updates.length) return false;
        const result = (txAttrApplyResult && typeof txAttrApplyResult === 'object') ? txAttrApplyResult : {};
        const appliedCount = Number(result.appliedCount || 0) + Number(result.resolvedAppliedCount || 0);
        if (appliedCount <= 0) return false;
        if (Number(result.unresolvedCount || 0) > 0) return false;
        const structuralKeys = new Set([
            __TM_TASK_REPEAT_RULE_ATTR,
            __TM_TASK_REPEAT_STATE_ATTR,
            __TM_TASK_REPEAT_HISTORY_ATTR,
        ]);
        return updates.every((update) => {
            const key = String(update?.key || '').trim();
            if (!key) return false;
            if (structuralKeys.has(key)) return false;
            if (__tmIsTaskAttachmentAttrKey(key)) return false;
            return true;
        });
    }

    function __tmApplyTxAttrUpdatesInState(payload) {
        const updates = __tmExtractAttrUpdatesFromTx(payload);
        const result = {
            totalUpdates: updates.length,
            applied: false,
            appliedCount: 0,
            resolvedAppliedCount: 0,
            unresolvedCount: 0,
            noopCount: 0,
            skippedCount: 0,
        };
        if (!updates.length) return result;
        let applied = false;
        const appliedUpdates = [];
        const unresolved = [];
        updates.forEach((update) => {
            const taskId = String(update?.taskId || '').trim();
            const attrKey = String(update?.key || '').trim();
            const attrValue = String(update?.value ?? '');
            if (!taskId || !attrKey) return;
            if (attrKey === 'custom-status' && __tmShouldLogStatusDebug([taskId], false)) {
                __tmPushStatusDebug('tx-attr-update', {
                    taskId,
                    attrKey,
                    attrValue,
                }, [taskId], { force: false });
            }
            if (__tmMutationEngine.isTaskSuppressed(taskId)) {
                result.skippedCount += 1;
                return;
            }
            const applyResult = __tmApplyQuickbarAttrUpdateInState(taskId, attrKey, attrValue, {
                returnReason: true,
            });
            if (applyResult?.ok) {
                applied = true;
                result.appliedCount += 1;
                appliedUpdates.push({
                    taskId,
                    key: attrKey,
                    value: attrValue,
                });
                return;
            }
            const reason = String(applyResult?.reason || '').trim();
            if (reason === 'noop') {
                result.noopCount += 1;
                return;
            }
            if (!reason || reason === 'task-missing') {
                const localBinding = __tmResolveLocalTaskBindingFromAnyBlockId(taskId);
                const localTaskId = String(localBinding?.taskId || '').trim();
                if (localTaskId && localTaskId !== taskId) {
                    const localApplyResult = __tmApplyQuickbarAttrUpdateInState(localTaskId, attrKey, attrValue, {
                        returnReason: true,
                    });
                    if (localApplyResult?.ok) {
                        applied = true;
                        result.resolvedAppliedCount += 1;
                        appliedUpdates.push({
                            taskId: localTaskId,
                            key: attrKey,
                            value: attrValue,
                        });
                        return;
                    }
                    const localReason = String(localApplyResult?.reason || '').trim();
                    if (localReason === 'noop') {
                        result.noopCount += 1;
                        return;
                    }
                    if (localReason && localReason !== 'task-missing') {
                        result.skippedCount += 1;
                        return;
                    }
                }
            }
            if (reason && reason !== 'task-missing') {
                result.skippedCount += 1;
                return;
            }
            unresolved.push({ taskId, attrKey, attrValue });
        });
        result.unresolvedCount = unresolved.length;
        const refreshOrDeferView = (refreshUpdates = [], phase = 'direct') => {
            const sourceUpdates = Array.isArray(refreshUpdates) ? refreshUpdates : [];
            if (!sourceUpdates.length) return;
            if (__tmShouldDeferTaskFieldRefreshWork()) {
                try {
                    __tmScheduleViewRefresh({
                        mode: 'current',
                        withFilters: true,
                        reason: phase === 'resolved' ? 'tx-attr-update-resolved' : 'tx-attr-update',
                    });
                } catch (e) {}
                return;
            }
            refreshView(sourceUpdates);
        };
        const refreshView = (refreshUpdates = []) => {
            const sourceUpdates = Array.isArray(refreshUpdates) ? refreshUpdates : [];
            if (!sourceUpdates.length) return;
            const mergedByTask = new Map();
            sourceUpdates.forEach((update) => {
                const taskId = String(update?.taskId || '').trim();
                const patch = __tmChangeFeed.buildPatchFromAttr(taskId, update?.key, update?.value);
                if (!taskId || !patch) return;
                mergedByTask.set(taskId, __tmWritePlanner.mergeTaskPatches(mergedByTask.get(taskId) || {}, patch));
            });
            if (mergedByTask.size === 0) return;
            mergedByTask.forEach((patch, taskId) => {
                try {
                    __tmRefreshTaskFieldsAcrossViews(taskId, patch, {
                        withFilters: true,
                        reason: 'tx-attr-update',
                        forceProjectionRefresh: __tmDoesPatchAffectProjection(taskId, patch),
                        fallback: true,
                    });
                } catch (e) {}
            });
        };
        if (applied) refreshOrDeferView(appliedUpdates, 'direct');
        if (unresolved.length) {
            Promise.resolve().then(async () => {
                let resolvedApplied = false;
                const resolvedUpdates = [];
                for (const update of unresolved) {
                    try {
                        const resolvedTaskId = await __tmResolveTaskIdFromAnyBlockId(update.taskId);
                        const nextTaskId = String(resolvedTaskId || '').trim();
                        if (!nextTaskId || nextTaskId === update.taskId) continue;
                        const applyResult = __tmApplyQuickbarAttrUpdateInState(nextTaskId, update.attrKey, update.attrValue, {
                            returnReason: true,
                        });
                        if (applyResult?.ok) {
                            resolvedApplied = true;
                            result.resolvedAppliedCount += 1;
                            resolvedUpdates.push({
                                taskId: nextTaskId,
                                key: update.attrKey,
                                value: update.attrValue,
                            });
                        } else if (String(applyResult?.reason || '').trim() === 'noop') {
                            result.noopCount += 1;
                        }
                    } catch (e) {}
                }
                if (resolvedApplied) refreshOrDeferView(resolvedUpdates, 'resolved');
            }).catch(() => null);
        }
        result.applied = applied;
        return result;
    }

    function __tmMarkLocalTimeTxSuppression(taskId, docIds = [], ttlMs = 1200) {
        const tid = String(taskId || '').trim();
        if (tid) __tmLocalTimeTxSuppressTaskIds.add(tid);
        (Array.isArray(docIds) ? docIds : []).forEach((docId) => {
            const did = String(docId || '').trim();
            if (did) __tmLocalTimeTxSuppressDocIds.add(did);
        });
        __tmLocalTimeTxSuppressUntil = Date.now() + Math.max(200, Number(ttlMs) || 1200);
    }

    function __tmMarkLocalTimeTxSuppressionIds(ids = [], docIds = [], ttlMs = 1200) {
        (Array.isArray(ids) ? ids : []).forEach((id) => {
            const tid = String(id || '').trim();
            if (tid) __tmLocalTimeTxSuppressTaskIds.add(tid);
        });
        (Array.isArray(docIds) ? docIds : []).forEach((docId) => {
            const did = String(docId || '').trim();
            if (did) __tmLocalTimeTxSuppressDocIds.add(did);
        });
        __tmLocalTimeTxSuppressUntil = Date.now() + Math.max(200, Number(ttlMs) || 1200);
    }

    function __tmClearLocalTimeTxSuppression() {
        __tmLocalTimeTxSuppressUntil = 0;
        __tmLocalTimeTxSuppressTaskIds.clear();
        __tmLocalTimeTxSuppressDocIds.clear();
    }

    function __tmMarkLocalDoneTxSuppressionIds(ids = [], docIds = [], ttlMs = 1600) {
        (Array.isArray(ids) ? ids : []).forEach((id) => {
            const bid = String(id || '').trim();
            if (bid && __tmIsLikelyBlockId(bid)) __tmLocalDoneTxSuppressBlockIds.add(bid);
        });
        (Array.isArray(docIds) ? docIds : []).forEach((docId) => {
            const did = String(docId || '').trim();
            if (did && __tmIsLikelyBlockId(did)) __tmLocalDoneTxSuppressDocIds.add(did);
        });
        __tmLocalDoneTxSuppressUntil = Date.now() + Math.max(300, Number(ttlMs) || 1600);
    }

    function __tmMarkLocalDoneTxSuppressionForTask(taskLike, ids = [], ttlMs = 1600) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const nextIds = Array.from(new Set([
            String(task?.id || '').trim(),
            String(task?.attrHostId || '').trim(),
            String(task?.attr_host_id || '').trim(),
            ...(Array.isArray(ids) ? ids.map((id) => String(id || '').trim()) : []),
        ].filter(Boolean)));
        const docIds = Array.from(new Set([
            String(task?.root_id || '').trim(),
            String(task?.docId || '').trim(),
        ].filter(Boolean)));
        __tmMarkLocalDoneTxSuppressionIds(nextIds, docIds, ttlMs);
    }

    function __tmClearLocalDoneTxSuppression() {
        __tmLocalDoneTxSuppressUntil = 0;
        __tmLocalDoneTxSuppressBlockIds.clear();
        __tmLocalDoneTxSuppressDocIds.clear();
    }

    function __tmMarkLocalMoveTxSuppressionIds(ids = [], docIds = [], ttlMs = 2200) {
        (Array.isArray(ids) ? ids : []).forEach((id) => {
            const bid = String(id || '').trim();
            if (bid && __tmIsLikelyBlockId(bid)) __tmLocalMoveTxSuppressBlockIds.add(bid);
        });
        (Array.isArray(docIds) ? docIds : []).forEach((docId) => {
            const did = String(docId || '').trim();
            if (did && __tmIsLikelyBlockId(did)) __tmLocalMoveTxSuppressDocIds.add(did);
        });
        __tmLocalMoveTxSuppressUntil = Date.now() + Math.max(400, Number(ttlMs) || 2200);
    }

    function __tmClearLocalMoveTxSuppression() {
        __tmLocalMoveTxSuppressUntil = 0;
        __tmLocalMoveTxSuppressBlockIds.clear();
        __tmLocalMoveTxSuppressDocIds.clear();
    }

    function __tmShouldSuppressLocalMoveTx(payload) {
        try {
            const until = Number(__tmLocalMoveTxSuppressUntil || 0);
            if (!until || Date.now() > until) {
                __tmClearLocalMoveTxSuppression();
                return false;
            }
            const updates = __tmExtractAttrUpdatesFromTx(payload);
            if (updates.length) {
                return false;
            }
            const blockIds = Array.from(__tmExtractBlockIdsFromTx(payload) || [])
                .map((id) => String(id || '').trim())
                .filter(Boolean);
            const docIds = Array.from(__tmExtractDocIdsFromTx(payload) || [])
                .map((id) => String(id || '').trim())
                .filter(Boolean);
            const hasMatchingBlockId = blockIds.some((id) => __tmLocalMoveTxSuppressBlockIds.has(id));
            const hasMatchingDocIds = docIds.length > 0 && docIds.every((id) => __tmLocalMoveTxSuppressDocIds.has(id));
            const ok = hasMatchingBlockId || hasMatchingDocIds;
            if (ok) __tmClearLocalMoveTxSuppression();
            return ok;
        } catch (e) {
            return false;
        }
    }

    function __tmShouldSuppressLocalDoneTx(payload) {
        try {
            const until = Number(__tmLocalDoneTxSuppressUntil || 0);
            if (!until || Date.now() > until) {
                __tmClearLocalDoneTxSuppression();
                return false;
            }
            const blockIds = Array.from(__tmExtractBlockIdsFromTx(payload) || [])
                .map((id) => String(id || '').trim())
                .filter(Boolean);
            const docIds = Array.from(__tmExtractDocIdsFromTx(payload) || [])
                .map((id) => String(id || '').trim())
                .filter(Boolean);
            const updates = __tmExtractAttrUpdatesFromTx(payload);
            const keys = updates.map((update) => String(update?.key || '').trim()).filter(Boolean);
            const hasMatchingBlockId = blockIds.some((id) => __tmLocalDoneTxSuppressBlockIds.has(id));
            const hasMatchingDocIds = docIds.length > 0 && docIds.every((id) => __tmLocalDoneTxSuppressDocIds.has(id));
            if (!updates.length) {
                if (hasMatchingBlockId || hasMatchingDocIds) {
                    return true;
                }
                return false;
            }
            const allowed = new Set([
                'custom-status',
                __TM_TASK_COMPLETE_AT_ATTR,
            ]);
            if (updates.length && !updates.every((update) => allowed.has(String(update?.key || '').trim()))) {
                return false;
            }
            const candidateIds = Array.from(new Set([
                ...blockIds,
                ...updates.map((update) => String(update?.taskId || '').trim()).filter(Boolean),
            ]));
            const hasMatchingCandidateBlockId = candidateIds.some((id) => __tmLocalDoneTxSuppressBlockIds.has(id));
            if (!hasMatchingCandidateBlockId) {
                return false;
            }
            if (docIds.length && !docIds.every((id) => __tmLocalDoneTxSuppressDocIds.has(id))) {
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function __tmShouldSuppressLocalTimeTx(payload) {
        try {
            if (String(state.viewMode || '').trim() === 'calendar') return false;
            const until = Number(__tmLocalTimeTxSuppressUntil || 0);
            if (!until || Date.now() > until) {
                __tmClearLocalTimeTxSuppression();
                return false;
            }
            const updates = __tmExtractAttrUpdatesFromTx(payload);
            if (!updates.length) {
                return false;
            }
            const keys = updates.map((update) => String(update?.key || '').trim());
            if (!updates.every((update) => __tmShouldSuppressLocalAttrTxKey(update?.key))) {
                return false;
            }
            const taskIds = Array.from(new Set(updates.map((update) => String(update?.taskId || '').trim()).filter(Boolean)));
            if (taskIds.length && !taskIds.every((id) => __tmLocalTimeTxSuppressTaskIds.has(id))) {
                return false;
            }
            const docIds = Array.from(__tmExtractDocIdsFromTx(payload) || []).map((id) => String(id || '').trim()).filter(Boolean);
            if (docIds.length && !docIds.every((id) => __tmLocalTimeTxSuppressDocIds.has(id))) {
                return false;
            }
            __tmClearLocalTimeTxSuppression();
            return true;
        } catch (e) {
            return false;
        }
    }

    function __tmShouldSkipCalendarTxRefreshForTimeEdit(payload) {
        try {
            const viewMode = String(state.viewMode || '').trim();
            if (viewMode === 'calendar') {
                return false;
            }
            const updates = __tmExtractAttrUpdatesFromTx(payload);
            if (!updates.length) {
                return false;
            }
            const allowed = new Set([
                'custom-start-date',
                'custom-completion-time',
                __TM_TASK_COMPLETE_AT_ATTR,
                'custom-duration',
                'custom-time',
                'custom-status',
                'custom-pinned',
            ]);
            const keys = updates.map((update) => String(update?.key || '').trim());
            const ok = updates.every((update) => allowed.has(String(update?.key || '').trim()));
            return ok;
        } catch (e) {
            return false;
        }
    }

    function __tmCloneTaskQueryRows(rows) {
        if (!Array.isArray(rows) || rows.length === 0) return [];
        const out = new Array(rows.length);
        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            const next = (row && typeof row === 'object') ? { ...row } : {};
            if (next.__customFieldRawValues && typeof next.__customFieldRawValues === 'object') {
                next.__customFieldRawValues = { ...next.__customFieldRawValues };
            }
            if (next.customFieldValues && typeof next.customFieldValues === 'object') {
                next.customFieldValues = { ...next.customFieldValues };
            }
            if (Array.isArray(next.__tmLoadedCustomFieldIds)) {
                next.__tmLoadedCustomFieldIds = next.__tmLoadedCustomFieldIds.slice();
            }
            try { delete next.children; } catch (e) {}
            try { delete next.level; } catch (e) {}
            try { delete next.priorityScore; } catch (e) {}
            try { delete next.__tmPriorityScoreCacheVersion; } catch (e) {}
            try { delete next.__tmPriorityScoreCacheUntil; } catch (e) {}
            try { delete next.__tmPendingInserted; } catch (e) {}
            out[i] = next;
        }
        return out;
    }

    function __tmCloneTaskQueryResult(result) {
        const src = (result && typeof result === 'object') ? result : {};
        return {
            ...src,
            tasks: __tmCloneTaskQueryRows(src.tasks),
            limitReachedDocIds: Array.isArray(src.limitReachedDocIds) ? src.limitReachedDocIds.slice() : [],
        };
    }

    function __tmBuildDocQueryInfoMap(docIds = null) {
        const targetIdSet = Array.isArray(docIds) && docIds.length
            ? new Set(docIds.map((id) => String(id || '').trim()).filter(Boolean))
            : null;
        const out = new Map();
        const pushDoc = (doc) => {
            const id = String(doc?.id || '').trim();
            if (!id) return;
            if (targetIdSet && !targetIdSet.has(id)) return;
            if (out.has(id)) return;
            out.set(id, {
                doc_name: String(doc?.name || doc?.doc_name || doc?.content || '').trim(),
                doc_path: String(doc?.path || doc?.doc_path || '').trim(),
            });
        };
        (Array.isArray(state.allDocuments) ? state.allDocuments : []).forEach(pushDoc);
        (Array.isArray(state.taskTree) ? state.taskTree : []).forEach(pushDoc);
        return out;
    }

    async function __tmBuildDocQueryInfoMapWithFallback(docIds = null) {
        const out = __tmBuildDocQueryInfoMap(docIds);
        const targetIds = Array.isArray(docIds)
            ? Array.from(new Set(docIds.map((id) => String(id || '').trim()).filter(Boolean)))
            : [];
        const missingIds = targetIds.filter((id) => !out.has(id));
        if (!missingIds.length) return out;
        const chunkSize = 200;
        for (let i = 0; i < missingIds.length; i += chunkSize) {
            const chunk = missingIds.slice(i, i + chunkSize);
            if (!chunk.length) continue;
            const idList = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
            const sql = `SELECT id, content AS doc_name, hpath AS doc_path FROM blocks WHERE type = 'd' AND id IN (${idList}) LIMIT ${Math.max(1, Math.min(5000, chunk.length))}`;
            try {
                const res = await API.call('/api/query/sql', { stmt: sql });
                if (res.code !== 0 || !Array.isArray(res.data)) continue;
                res.data.forEach((row) => {
                    const id = String(row?.id || '').trim();
                    if (!id || out.has(id)) return;
                    const docName = String(row?.doc_name || '').trim();
                    const docPath = String(row?.doc_path || '').trim();
                    out.set(id, {
                        doc_name: docName,
                        doc_path: docPath,
                    });
                    if (!Array.isArray(state.allDocuments)) state.allDocuments = [];
                    const existing = state.allDocuments.find((doc) => String(doc?.id || '').trim() === id);
                    if (existing) {
                        if (!String(existing.name || '').trim() && docName) existing.name = docName;
                        if (!String(existing.path || '').trim() && docPath) existing.path = docPath;
                    } else {
                        state.allDocuments.push({
                            id,
                            name: docName || '未命名文档',
                            alias: '',
                            icon: '',
                            path: docPath,
                            notebook: '',
                            taskCount: 0,
                            created: ''
                        });
                    }
                });
            } catch (e) {}
        }
        return out;
    }

    function __tmApplyDocQueryInfoToTasks(tasks, docInfoMap = null) {
        const list = Array.isArray(tasks) ? tasks : [];
        const infoMap = docInfoMap instanceof Map ? docInfoMap : __tmBuildDocQueryInfoMap();
        if (!list.length || !(infoMap instanceof Map) || !infoMap.size) return list;
        for (let i = 0; i < list.length; i += 1) {
            const task = list[i];
            const docId = String(task?.root_id || task?.docId || '').trim();
            if (!docId) continue;
            const info = infoMap.get(docId);
            if (!info) continue;
            if (!String(task?.doc_name || '').trim()) task.doc_name = info.doc_name || '';
            if (!String(task?.doc_path || '').trim()) task.doc_path = info.doc_path || '';
        }
        return list;
    }

    function __tmShouldReadRepeatAttrsInline() {
        try {
            const cfg = __tmGetPerfTuningOptions();
            return cfg.readRepeatAttrsInline !== false;
        } catch (e) {
            return true;
        }
    }

    function __tmGetTaskInlineAttrSpecs() {
        const tomatoEnabled = !!SettingsStore.data.enableTomatoIntegration;
        const tomatoMinutesKey = __tmSafeAttrName(SettingsStore.data.tomatoSpentAttrKeyMinutes, 'custom-tomato-minutes');
        const tomatoHoursKey = __tmSafeAttrName(SettingsStore.data.tomatoSpentAttrKeyHours, 'custom-tomato-time');
        const repeatInlineEnabled = __tmShouldReadRepeatAttrsInline();
        return [
            { name: 'custom-priority', alias: 'custom_priority', enabled: true },
            { name: 'custom-duration', alias: 'duration', enabled: true },
            { name: 'custom-remark', alias: 'remark', enabled: true },
            { name: 'custom-start-date', alias: 'start_date', enabled: true },
            { name: 'custom-completion-time', alias: 'completion_time', enabled: true },
            { name: __TM_TASK_COMPLETE_AT_ATTR, alias: 'task_complete_at', enabled: true },
            { name: 'custom-milestone-event', alias: 'milestone', enabled: true },
            { name: 'custom-time', alias: 'custom_time', enabled: true },
            { name: 'custom-status', alias: 'custom_status', enabled: true },
            { name: 'custom-pinned', alias: 'pinned', enabled: true },
            { name: __TM_TASK_REPEAT_RULE_ATTR, alias: 'repeat_rule', enabled: repeatInlineEnabled },
            { name: __TM_TASK_REPEAT_STATE_ATTR, alias: 'repeat_state', enabled: repeatInlineEnabled },
            { name: __TM_TASK_REPEAT_HISTORY_ATTR, alias: 'repeat_history', enabled: repeatInlineEnabled },
            { name: tomatoMinutesKey, alias: 'tomato_minutes', enabled: tomatoEnabled },
            { name: tomatoHoursKey, alias: 'tomato_hours', enabled: tomatoEnabled },
        ];
    }

    function __tmBuildTaskInlineAttrNamesSql(indent = '                        ') {
        const pad = (typeof indent === 'string' && indent.length > 0) ? indent : '                        ';
        return __tmGetTaskInlineAttrSpecs()
            .filter((spec) => spec && spec.enabled)
            .map((spec) => `'${String(spec.name || '').replace(/'/g, "''")}'`)
            .join(`,\n${pad}`);
    }

    function __tmBuildTaskInlineAttrAggregateSql(indent = '                        ') {
        const pad = (typeof indent === 'string' && indent.length > 0) ? indent : '                        ';
        return __tmGetTaskInlineAttrSpecs()
            .map((spec) => {
                if (!spec?.alias) return '';
                if (spec.enabled) {
                    return `MAX(CASE WHEN a.name = '${String(spec.name || '').replace(/'/g, "''")}' THEN a.value ELSE NULL END) AS ${spec.alias}`;
                }
                return `NULL AS ${spec.alias}`;
            })
            .filter(Boolean)
            .join(`,\n${pad}`);
    }

    function __tmGetTaskMetaAttrStorageKeys() {
        return Array.from(new Set(__tmGetTaskInlineAttrSpecs()
            .filter((spec) => spec && spec.enabled)
            .map((spec) => String(spec.name || '').trim())
            .filter(Boolean)));
    }

    async function __tmQueryTaskMetaAttrRowsByBlockIds(blockIds) {
        const safeBlockIds = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => /^[0-9]+-[a-zA-Z0-9]+$/.test(id))));
        if (!safeBlockIds.length) return [];
        const attrNames = __tmGetTaskMetaAttrStorageKeys();
        if (!attrNames.length) return [];
        const nameList = attrNames.map((name) => `'${name.replace(/'/g, "''")}'`).join(',');
        const rows = [];
        const chunkSize = 400;
        for (let i = 0; i < safeBlockIds.length; i += chunkSize) {
            const chunk = safeBlockIds.slice(i, i + chunkSize);
            if (!chunk.length) continue;
            const idList = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
            const sql = `
                SELECT block_id, name, value
                FROM attributes
                WHERE block_id IN (${idList})
                  AND (
                      name IN (${nameList})
                      OR name LIKE '${__TM_TASK_ATTACHMENT_ATTR_PREFIX}%'
                  )
            `;
            const res = await API.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && Array.isArray(res.data)) rows.push(...res.data);
        }
        return rows;
    }

    async function __tmQueryTaskSiblingCountsByParentIds(parentIds) {
        const safeParentIds = Array.from(new Set((Array.isArray(parentIds) ? parentIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => /^[0-9]+-[a-zA-Z0-9]+$/.test(id))));
        const countMap = new Map();
        if (!safeParentIds.length) return countMap;
        const chunkSize = 400;
        for (let i = 0; i < safeParentIds.length; i += chunkSize) {
            const chunk = safeParentIds.slice(i, i + chunkSize);
            if (!chunk.length) continue;
            const idList = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
            const sql = `
                SELECT parent_id, COUNT(*) AS task_count
                FROM blocks
                WHERE parent_id IN (${idList})
                  AND type = 'i'
                  AND subtype = 't'
                GROUP BY parent_id
            `;
            const res = await API.call('/api/query/sql', { stmt: sql });
            if (res.code !== 0 || !Array.isArray(res.data)) continue;
            res.data.forEach((row) => {
                const parentId = String(row?.parent_id || '').trim();
                const taskCount = Number(row?.task_count || 0);
                if (!parentId) return;
                countMap.set(parentId, taskCount);
            });
        }
        return countMap;
    }

    async function __tmPopulateTaskAttrHostIds(tasks) {
        const list = Array.isArray(tasks) ? tasks.filter((task) => task && typeof task === 'object') : [];
        if (!list.length) return list;
        const nowTs = Date.now();
        const cacheTtlMs = 20000;
        const parentHostMap = new Map();
        const unresolvedParentIds = [];
        list.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            const resolvedFromShape = __tmResolveTaskAttrHostIdFromParentShape(taskId, task?.parent_id, task);
            const parentId = String(resolvedFromShape.parentId || '').trim();
            if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(parentId)) {
                task.attrHostId = taskId;
                task.attr_host_id = taskId;
                return;
            }
            if (resolvedFromShape.resolved) {
                parentHostMap.set(parentId, resolvedFromShape.useParentHost === true);
                __tmRememberAttrHostParentResolution(parentId, resolvedFromShape.useParentHost === true, nowTs);
                return;
            }
            const cached = __tmAttrHostParentResolutionCache.get(parentId);
            if (cached && (nowTs - Number(cached.t || 0)) < cacheTtlMs) {
                parentHostMap.set(parentId, cached.useParentHost === true);
                return;
            }
            unresolvedParentIds.push(parentId);
        });
        const pendingParentIds = Array.from(new Set(unresolvedParentIds));
        if (pendingParentIds.length) {
            const parentMap = new Map();
            const chunkSize = 400;
            for (let i = 0; i < pendingParentIds.length; i += chunkSize) {
                const chunk = pendingParentIds.slice(i, i + chunkSize);
                if (!chunk.length) continue;
                let rows = [];
                try { rows = await API.getBlocksByIds(chunk); } catch (e) { rows = []; }
                (Array.isArray(rows) ? rows : []).forEach((row) => {
                    const id = String(row?.id || '').trim();
                    if (!id) return;
                    parentMap.set(id, row);
                });
            }
            const listTaskParentIds = [];
            parentMap.forEach((row, parentId) => {
                const parentType = String(row?.type || '').trim().toLowerCase();
                if (parentType === 'l') listTaskParentIds.push(parentId);
            });
            const taskCountMap = listTaskParentIds.length
                ? await __tmQueryTaskSiblingCountsByParentIds(listTaskParentIds)
                : new Map();
            pendingParentIds.forEach((parentId) => {
                const parentRow = parentMap.get(parentId);
                const parentType = String(parentRow?.type || '').trim().toLowerCase();
                const useParentHost = parentType === 'l'
                    && Number(taskCountMap.get(parentId) || 0) === 1;
                parentHostMap.set(parentId, useParentHost);
                __tmRememberAttrHostParentResolution(parentId, useParentHost, nowTs);
            });
        }
        list.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            const parentId = String(task?.parent_id || '').trim();
            let attrHostId = taskId;
            if (parentId && parentHostMap.get(parentId) === true) {
                attrHostId = parentId;
            }
            task.attrHostId = attrHostId || taskId;
            task.attr_host_id = task.attrHostId;
        });
        return list;
    }

    function __tmHasTaskMetaAttrRowValues(attrs) {
        const row = (attrs && typeof attrs === 'object') ? attrs : null;
        if (!row) return false;
        const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';
        const keys = [
            'custom-priority',
            'custom-duration',
            'custom-remark',
            'custom-start-date',
            'custom-completion-time',
            __TM_TASK_COMPLETE_AT_ATTR,
            'custom-milestone-event',
            'custom-time',
            'custom-status',
            'custom-pinned',
            __TM_TASK_REPEAT_RULE_ATTR,
            __TM_TASK_REPEAT_STATE_ATTR,
            __TM_TASK_REPEAT_HISTORY_ATTR,
        ];
        if (keys.some((key) => Object.prototype.hasOwnProperty.call(row, key) && isValidValue(row[key]))) return true;
        return Object.keys(row).some((key) => __tmIsTaskAttachmentAttrKey(key) && isValidValue(row[key]));
    }

    function __tmApplyTaskMetaAttrRow(task, attrs, options = {}) {
        const target = (task && typeof task === 'object') ? task : null;
        const row = (attrs && typeof attrs === 'object') ? attrs : null;
        const opts = (options && typeof options === 'object') ? options : {};
        if (!target || !row) return target;
        const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';
        const shouldApply = (...candidates) => {
            if (opts.preferExisting !== true) return true;
            return !candidates.some((value) => isValidValue(value));
        };
        const shouldApplyVisibleDate = (value, ...candidates) => {
            if (opts.preferExistingVisibleDates === true && candidates.some((item) => isValidValue(item))) {
                return false;
            }
            if (opts.preserveExistingVisibleDatesOnBlank === true && !isValidValue(value)) {
                return !candidates.some((item) => isValidValue(item));
            }
            return shouldApply(...candidates);
        };
        if (Object.prototype.hasOwnProperty.call(row, 'custom-priority')) {
            const value = String(row['custom-priority'] ?? '');
            if (shouldApply(target.custom_priority, target.priority)) {
                target.custom_priority = value;
                target.priority = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, 'custom-duration')) {
            const value = String(row['custom-duration'] ?? '');
            if (shouldApply(target.duration, target.custom_duration)) {
                target.duration = value;
                target.custom_duration = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, 'custom-remark')) {
            const value = String(row['custom-remark'] ?? '');
            if (shouldApply(target.remark, target.custom_remark)) {
                target.remark = value;
                target.custom_remark = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, 'custom-start-date')) {
            const value = String(row['custom-start-date'] ?? '');
            if (shouldApplyVisibleDate(value, target.startDate, target.start_date)) {
                target.startDate = value;
                target.start_date = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, 'custom-completion-time')) {
            const value = String(row['custom-completion-time'] ?? '');
            if (shouldApplyVisibleDate(value, target.completionTime, target.completion_time)) {
                target.completionTime = value;
                target.completion_time = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, __TM_TASK_COMPLETE_AT_ATTR)) {
            const value = String(row[__TM_TASK_COMPLETE_AT_ATTR] ?? '');
            if (shouldApply(target.taskCompleteAt, target.task_complete_at)) {
                target.taskCompleteAt = value;
                target.task_complete_at = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, 'custom-milestone-event')) {
            const value = String(row['custom-milestone-event'] ?? '');
            if (shouldApply(target.milestone, target.custom_milestone)) {
                target.milestone = value;
                target.custom_milestone = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, 'custom-time')) {
            const value = String(row['custom-time'] ?? '');
            if (shouldApplyVisibleDate(value, target.customTime, target.custom_time)) {
                target.customTime = value;
                target.custom_time = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, 'custom-status')) {
            const value = String(row['custom-status'] ?? '');
            if (shouldApply(target.customStatus, target.custom_status)) {
                target.customStatus = value;
                target.custom_status = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, 'custom-pinned')) {
            const value = String(row['custom-pinned'] ?? '');
            if (shouldApply(target.pinned, target.custom_pinned)) {
                target.pinned = value;
                target.custom_pinned = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, __TM_TASK_REPEAT_RULE_ATTR)) {
            const value = String(row[__TM_TASK_REPEAT_RULE_ATTR] ?? '');
            if (shouldApply(target.repeatRule, target.repeat_rule, target[__TM_TASK_REPEAT_RULE_ATTR])) {
                target[__TM_TASK_REPEAT_RULE_ATTR] = value;
                target.repeatRule = value;
                target.repeat_rule = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, __TM_TASK_REPEAT_STATE_ATTR)) {
            const value = String(row[__TM_TASK_REPEAT_STATE_ATTR] ?? '');
            if (shouldApply(target.repeatState, target.repeat_state, target[__TM_TASK_REPEAT_STATE_ATTR])) {
                target[__TM_TASK_REPEAT_STATE_ATTR] = value;
                target.repeatState = value;
                target.repeat_state = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, __TM_TASK_REPEAT_HISTORY_ATTR)) {
            const value = String(row[__TM_TASK_REPEAT_HISTORY_ATTR] ?? '');
            if (shouldApply(target.repeatHistory, target.repeat_history, target[__TM_TASK_REPEAT_HISTORY_ATTR])) {
                target[__TM_TASK_REPEAT_HISTORY_ATTR] = value;
                target.repeatHistory = value;
                target.repeat_history = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, String(__tmSafeAttrName(SettingsStore.data.tomatoSpentAttrKeyMinutes, 'custom-tomato-minutes')))) {
            const value = String(row[__tmSafeAttrName(SettingsStore.data.tomatoSpentAttrKeyMinutes, 'custom-tomato-minutes')] ?? '');
            if (shouldApply(target.tomatoMinutes, target.tomato_minutes)) {
                target.tomato_minutes = value;
                target.tomatoMinutes = value;
            }
        }
        if (Object.prototype.hasOwnProperty.call(row, String(__tmSafeAttrName(SettingsStore.data.tomatoSpentAttrKeyHours, 'custom-tomato-time')))) {
            const value = String(row[__tmSafeAttrName(SettingsStore.data.tomatoSpentAttrKeyHours, 'custom-tomato-time')] ?? '');
            if (shouldApply(target.tomatoHours, target.tomato_hours)) {
                target.tomato_hours = value;
                target.tomatoHours = value;
            }
        }
        if (Object.keys(row).some((key) => __tmIsTaskAttachmentAttrKey(key))) {
            __tmApplyTaskAttachmentPathsToTask(target, __tmExtractTaskAttachmentsFromAttrRow(row), {
                slotCount: __tmGetTaskAttachmentAttrSlotCount(row),
            });
        }
        return target;
    }

    async function __tmApplyTaskAttrHostOverrides(tasks) {
        const list = Array.isArray(tasks) ? tasks.filter((task) => task && typeof task === 'object') : [];
        if (!list.length) return list;
        await __tmPopulateTaskAttrHostIds(list);
        const hostIds = [];
        list.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            const hostId = String(task?.attrHostId || task?.attr_host_id || taskId).trim();
            const parentId = String(task?.parent_id || '').trim();
            if (hostId && hostId !== taskId) hostIds.push(hostId);
            if (parentId && parentId !== taskId) hostIds.push(parentId);
        });
        const uniqueHostIds = Array.from(new Set(hostIds.filter(Boolean)));
        if (!uniqueHostIds.length) return list;
        const rows = await __tmQueryTaskMetaAttrRowsByBlockIds(uniqueHostIds);
        if (!rows.length) return list;
        const rowMap = new Map();
        rows.forEach((row) => {
            const blockId = String(row?.block_id || '').trim();
            const name = String(row?.name || '').trim();
            if (!blockId || !name) return;
            if (!rowMap.has(blockId)) rowMap.set(blockId, {});
            rowMap.get(blockId)[name] = String(row?.value ?? '');
        });
        list.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            const parentId = String(task?.parent_id || '').trim();
            let hostId = String(task?.attrHostId || task?.attr_host_id || taskId).trim();
            let hostRow = (hostId && hostId !== taskId) ? rowMap.get(hostId) : null;
            const parentRow = (parentId && parentId !== taskId) ? rowMap.get(parentId) : null;
            if (hostId === parentId && parentRow && __tmHasTaskMetaAttrRowValues(parentRow)) {
                hostId = parentId;
                hostRow = parentRow;
                task.attrHostId = hostId;
                task.attr_host_id = hostId;
            }
            if (!hostId || hostId === taskId || !hostRow) {
                return;
            }
            const shouldLogStatus = __tmShouldLogStatusDebug([taskId, hostId], false);
            const beforeStatus = shouldLogStatus ? String(task?.customStatus || task?.custom_status || '').trim() : '';
            // attrHostId != taskId 时，宿主块才是这些属性字段的真实持久化位置。
            // 任务块自身可能残留历史值，不能再用 preferExisting 阻止宿主回读覆盖。
            __tmApplyTaskMetaAttrRow(task, hostRow, {
                preferExistingVisibleDates: true,
                preserveExistingVisibleDatesOnBlank: true,
            });
            if (shouldLogStatus) {
                __tmPushStatusDebug('attr-host-override', {
                    taskId,
                    hostId,
                    beforeStatus,
                    rowStatus: String(hostRow?.['custom-status'] || '').trim(),
                    afterStatus: String(task?.customStatus || task?.custom_status || '').trim(),
                }, [taskId, hostId], { force: false });
            }
        });
        return list;
    }

    async function __tmQueryCustomFieldAttrRowsByTaskIds(taskIds, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const allDefs = __tmGetCustomFieldDefs();
        const requestedFieldIdSet = Array.isArray(opts.fieldIds)
            ? new Set(opts.fieldIds.map((id) => String(id || '').trim()).filter(Boolean))
            : null;
        const defs = requestedFieldIdSet instanceof Set
            ? allDefs.filter((field) => requestedFieldIdSet.has(String(field?.id || '').trim()))
            : allDefs;
        const requestedFieldIds = defs
            .map((field) => String(field?.id || '').trim())
            .filter(Boolean)
            .sort();
        const isAllFieldRequest = !(requestedFieldIdSet instanceof Set);
        if (!defs.length) {
            return {
                valueMapByTaskId: new Map(),
                cacheHitCount: 0,
                cacheMissCount: 0,
                requestedFieldCount: 0,
            };
        }
        const safeTaskIds = Array.from(new Set((Array.isArray(taskIds) ? taskIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => /^[0-9]+-[a-zA-Z0-9]+$/.test(id))));
        if (!safeTaskIds.length) {
            return {
                valueMapByTaskId: new Map(),
                cacheHitCount: 0,
                cacheMissCount: 0,
                requestedFieldCount: defs.length,
            };
        }
        const attrNameToFieldId = new Map();
        const attrNames = defs.map((field) => {
            const fieldId = String(field?.id || '').trim();
            const attrName = __tmBuildCustomFieldAttrStorageKey(field?.attrKey || field?.id || field?.name || 'field', field?.id || 'field');
            if (fieldId && attrName) attrNameToFieldId.set(attrName, fieldId);
            return attrName;
        }).filter(Boolean);
        if (!attrNames.length) {
            return {
                valueMapByTaskId: new Map(),
                cacheHitCount: 0,
                cacheMissCount: 0,
                requestedFieldCount: 0,
            };
        }
        const nowTs = Date.now();
        const version = __tmParseVersionNumber(SettingsStore?.data?.customFieldDefsVersion);
        const cacheTtlMs = 20000;
        const valueMapByTaskId = new Map();
        const uncachedTaskIds = [];
        let cacheHitCount = 0;
        safeTaskIds.forEach((taskId) => {
            const cached = __tmCustomFieldAttrValueCache.get(taskId);
            const cachedFieldIds = Array.isArray(cached?.fieldIds)
                ? cached.fieldIds.map((id) => String(id || '').trim()).filter(Boolean)
                : [];
            const cachedFieldIdSet = new Set(cachedFieldIds);
            const cacheSatisfied = !!(
                cached
                && Number(cached.version) === version
                && (nowTs - Number(cached.t || 0)) < cacheTtlMs
                && cached.values
                && typeof cached.values === 'object'
                && !Array.isArray(cached.values)
                && (
                    cached.allFields === true
                    || (!isAllFieldRequest && requestedFieldIds.every((fieldId) => cachedFieldIdSet.has(fieldId)))
                )
            );
            if (cacheSatisfied) {
                const cachedValues = (cached?.values && typeof cached.values === 'object' && !Array.isArray(cached.values))
                    ? cached.values
                    : {};
                const nextValues = (cached?.allFields === true || isAllFieldRequest)
                    ? { ...cachedValues }
                    : requestedFieldIds.reduce((acc, fieldId) => {
                        if (Object.prototype.hasOwnProperty.call(cachedValues, fieldId)) acc[fieldId] = cachedValues[fieldId];
                        return acc;
                    }, {});
                valueMapByTaskId.set(taskId, nextValues);
                cacheHitCount += 1;
                return;
            }
            uncachedTaskIds.push(taskId);
        });
        if (!uncachedTaskIds.length) {
            return {
                valueMapByTaskId,
                cacheHitCount,
                cacheMissCount: 0,
                requestedFieldCount: defs.length,
            };
        }
        const nameList = attrNames.map((name) => `'${name.replace(/'/g, "''")}'`).join(',');
        const queriedValueMap = new Map();
        const chunkSize = 400;
        for (let i = 0; i < uncachedTaskIds.length; i += chunkSize) {
            const chunk = uncachedTaskIds.slice(i, i + chunkSize);
            if (!chunk.length) continue;
            const idList = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
            const sql = `
                SELECT block_id, name, value
                FROM attributes
                WHERE block_id IN (${idList})
                  AND name IN (${nameList})
            `;
            const res = await API.call('/api/query/sql', { stmt: sql });
            if (res.code !== 0 || !Array.isArray(res.data)) continue;
            res.data.forEach((row) => {
                const blockId = String(row?.block_id || '').trim();
                const attrName = String(row?.name || '').trim();
                const fieldId = String(attrNameToFieldId.get(attrName) || '').trim();
                if (!blockId || !fieldId) return;
                if (!queriedValueMap.has(blockId)) queriedValueMap.set(blockId, {});
                queriedValueMap.get(blockId)[fieldId] = String(row?.value ?? '');
            });
        }
        uncachedTaskIds.forEach((taskId) => {
            const cached = __tmCustomFieldAttrValueCache.get(taskId);
            const cachedValues = (cached
                && Number(cached.version) === version
                && (nowTs - Number(cached.t || 0)) < cacheTtlMs
                && cached.values
                && typeof cached.values === 'object'
                && !Array.isArray(cached.values))
                ? cached.values
                : null;
            const cachedFieldIds = (cached
                && Number(cached.version) === version
                && (nowTs - Number(cached.t || 0)) < cacheTtlMs
                && Array.isArray(cached.fieldIds))
                ? cached.fieldIds.map((id) => String(id || '').trim()).filter(Boolean)
                : [];
            const values = queriedValueMap.get(taskId);
            const queriedValues = (values && typeof values === 'object' && !Array.isArray(values))
                ? { ...values }
                : {};
            const normalizedValues = (!isAllFieldRequest && cachedValues && typeof cachedValues === 'object')
                ? { ...cachedValues, ...queriedValues }
                : queriedValues;
            valueMapByTaskId.set(taskId, isAllFieldRequest ? { ...normalizedValues } : requestedFieldIds.reduce((acc, fieldId) => {
                if (Object.prototype.hasOwnProperty.call(normalizedValues, fieldId)) acc[fieldId] = normalizedValues[fieldId];
                return acc;
            }, {}));
            try {
                __tmCustomFieldAttrValueCache.set(taskId, {
                    t: nowTs,
                    version,
                    values: normalizedValues,
                    allFields: isAllFieldRequest || cached?.allFields === true,
                    fieldIds: (isAllFieldRequest
                        ? requestedFieldIds
                        : Array.from(new Set(cachedFieldIds.concat(requestedFieldIds))).sort()),
                });
                if (__tmCustomFieldAttrValueCache.size > 12000) {
                    const oldestKey = __tmCustomFieldAttrValueCache.keys().next().value;
                    if (oldestKey !== undefined) __tmCustomFieldAttrValueCache.delete(oldestKey);
                }
            } catch (e) {}
        });
        return {
            valueMapByTaskId,
            cacheHitCount,
            cacheMissCount: uncachedTaskIds.length,
            requestedFieldCount: defs.length,
        };
    }

    async function __tmAttachCustomFieldAttrsToTasks(tasks, options = {}) {
        const list = Array.isArray(tasks) ? tasks.filter((task) => task && typeof task === 'object') : [];
        if (!list.length) {
            return {
                cacheHitCount: 0,
                cacheMissCount: 0,
                hostQueryCount: 0,
                selfFallbackCount: 0,
                hostAssignedCount: 0,
                selfAssignedCount: 0,
                requestedFieldCount: 0,
            };
        }
        const opts = (options && typeof options === 'object') ? options : {};
        const requestedFieldIds = Array.isArray(opts.fieldIds)
            ? Array.from(new Set(opts.fieldIds.map((id) => String(id || '').trim()).filter(Boolean))).sort()
            : [];
        const loadedAllFields = !Array.isArray(opts.fieldIds);
        const hostIds = new Set();
        list.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            const hostId = String(task?.attrHostId || task?.attr_host_id || taskId).trim();
            if (!taskId || !hostId) return;
            hostIds.add(hostId);
        });
        const hostResult = await __tmQueryCustomFieldAttrRowsByTaskIds(Array.from(hostIds), opts);
        const hostValueMap = hostResult?.valueMapByTaskId instanceof Map ? hostResult.valueMapByTaskId : new Map();
        const selfFallbackTaskIds = new Set();
        list.forEach((task) => {
            const tid = String(task?.id || '').trim();
            const hostId = String(task?.attrHostId || task?.attr_host_id || tid).trim();
            const hostValues = hostId ? hostValueMap.get(hostId) : null;
            const hostHasValues = !!(hostValues && typeof hostValues === 'object' && Object.keys(hostValues).length > 0);
            if (hostId && hostId !== tid && !hostHasValues && tid) selfFallbackTaskIds.add(tid);
        });
        const selfResult = selfFallbackTaskIds.size > 0
            ? await __tmQueryCustomFieldAttrRowsByTaskIds(Array.from(selfFallbackTaskIds), opts)
            : { valueMapByTaskId: new Map(), cacheHitCount: 0, cacheMissCount: 0, requestedFieldCount: Number(hostResult?.requestedFieldCount || 0) };
        const selfValueMap = selfResult?.valueMapByTaskId instanceof Map ? selfResult.valueMapByTaskId : new Map();
        const applyResolvedRawValues = (task, resolvedValues) => {
            const nextResolvedValues = (resolvedValues && typeof resolvedValues === 'object' && !Array.isArray(resolvedValues))
                ? resolvedValues
                : {};
            if (loadedAllFields) {
                task.__customFieldRawValues = { ...nextResolvedValues };
                return;
            }
            const nextRawValues = {
                ...((task?.__customFieldRawValues && typeof task.__customFieldRawValues === 'object' && !Array.isArray(task.__customFieldRawValues))
                    ? task.__customFieldRawValues
                    : {})
            };
            requestedFieldIds.forEach((fieldId) => {
                if (Object.prototype.hasOwnProperty.call(nextResolvedValues, fieldId)) nextRawValues[fieldId] = nextResolvedValues[fieldId];
                else delete nextRawValues[fieldId];
            });
            task.__customFieldRawValues = nextRawValues;
        };
        let hostAssignedCount = 0;
        let selfAssignedCount = 0;
        list.forEach((task) => {
            const tid = String(task?.id || '').trim();
            const hostId = String(task?.attrHostId || task?.attr_host_id || tid).trim();
            const hostValues = hostId ? hostValueMap.get(hostId) : null;
            const markLoadedFields = () => {
                if (loadedAllFields) {
                    task.__tmLoadedAllCustomFields = true;
                    try { delete task.__tmLoadedCustomFieldIds; } catch (e) {}
                } else if (requestedFieldIds.length > 0) {
                    const loadedFieldIds = Array.isArray(task.__tmLoadedCustomFieldIds)
                        ? task.__tmLoadedCustomFieldIds.map((id) => String(id || '').trim()).filter(Boolean)
                        : [];
                    task.__tmLoadedCustomFieldIds = Array.from(new Set(loadedFieldIds.concat(requestedFieldIds))).sort();
                }
            };
            if (hostId && hostId !== tid && hostValues && typeof hostValues === 'object' && Object.keys(hostValues).length > 0) {
                applyResolvedRawValues(task, hostValues);
                hostAssignedCount += 1;
                markLoadedFields();
                return;
            }
            const selfValues = tid ? selfValueMap.get(tid) : null;
            applyResolvedRawValues(
                task,
                (selfValues && typeof selfValues === 'object')
                    ? selfValues
                    : ((hostValues && typeof hostValues === 'object') ? hostValues : {})
            );
            if (selfValues && typeof selfValues === 'object' && Object.keys(selfValues).length > 0) selfAssignedCount += 1;
            markLoadedFields();
        });
        return {
            cacheHitCount: Number(hostResult?.cacheHitCount || 0) + Number(selfResult?.cacheHitCount || 0),
            cacheMissCount: Number(hostResult?.cacheMissCount || 0) + Number(selfResult?.cacheMissCount || 0),
            hostQueryCount: hostIds.size,
            selfFallbackCount: selfFallbackTaskIds.size,
            hostAssignedCount,
            selfAssignedCount,
            requestedFieldCount: Number(hostResult?.requestedFieldCount || selfResult?.requestedFieldCount || 0),
        };
    }

    async function __tmQueryAttrRowsByName(attrName) {
        const safeName = String(attrName || '').trim();
        if (!safeName) return [];
        const sql = `
            SELECT block_id, value
            FROM attributes
            WHERE name = '${safeName.replace(/'/g, "''")}'
        `;
        const res = await API.call('/api/query/sql', { stmt: sql });
        return (res.code === 0 && Array.isArray(res.data)) ? res.data : [];
    }

    async function __tmMigrateCustomFieldAttrStorageKey(prevAttrName, nextAttrName) {
        const prevName = __tmNormalizeCustomFieldAttrName(prevAttrName);
        const nextName = __tmNormalizeCustomFieldAttrName(nextAttrName);
        const prevKey = __tmBuildCustomFieldAttrStorageKey(prevName);
        const nextKey = __tmBuildCustomFieldAttrStorageKey(nextName);
        if (!prevKey || !nextKey || prevKey === nextKey) return 0;
        const rows = await __tmQueryAttrRowsByName(prevKey);
        if (!rows.length) return 0;
        let migrated = 0;
        for (const row of rows) {
            const blockId = String(row?.block_id || '').trim();
            if (!blockId) continue;
            await API.setAttrs(blockId, {
                [nextKey]: String(row?.value ?? ''),
                [prevKey]: '',
            });
            migrated += 1;
        }
        try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e) {}
        return migrated;
    }

    function __tmRunSqlQueued(fn) {
        const run = () => Promise.resolve().then(fn);
        return new Promise((resolve, reject) => {
            const start = () => {
                __tmSqlQueue.active += 1;
                run().then(resolve, reject).finally(() => {
                    __tmSqlQueue.active = Math.max(0, (__tmSqlQueue.active || 0) - 1);
                    const next = __tmSqlQueue.q.shift();
                    if (typeof next === 'function') next();
                });
            };
            if ((__tmSqlQueue.active || 0) < (__tmSqlQueue.max || 1)) start();
            else __tmSqlQueue.q.push(start);
        });
    }

    function __tmInvalidateTasksQueryCacheByDocId(docId) {
        const did = String(docId || '').trim();
        if (!did) {
            try { __tmTasksQueryCache.clear(); } catch (e) {}
            try { __tmDocHasTaskQueryCache.clear(); } catch (e) {}
            try { __tmDocEnhanceSnapshotCache.clear(); } catch (e) {}
            try { __tmTaskDocMapCache.clear(); } catch (e) {}
            try { __tmClearAttrHostResolutionCache(); } catch (e) {}
            try { __tmClearCustomFieldAttrValueCache(); } catch (e) {}
            try { __tmDocEnhanceWarmQueue.items.length = 0; __tmDocEnhanceWarmQueue.set.clear(); } catch (e) {}
            try { __tmAuxQueryCache.clear(); } catch (e) {}
            try { __tmDocExpandCache.clear(); } catch (e) {}
            try { __tmResolvedDocIdsCacheMap.clear(); } catch (e) {}
            try { __tmClearGroupSessionTaskCache(); } catch (e) {}
            try { __tmClearDocSessionTaskCache(); } catch (e) {}
            try { __tmResolvedDocIdsCache = null; } catch (e) {}
            try { __tmResolvedDocIdsPromise = null; } catch (e) {}
            return;
        }
        try {
            for (const [k, ent] of __tmTasksQueryCache.entries()) {
                const set = ent?.docIdSet;
                if (set instanceof Set && set.has(did)) {
                    __tmTasksQueryCache.delete(k);
                }
            }
        } catch (e) {}
        try { __tmDocHasTaskQueryCache.delete(did); } catch (e) {}
        try {
            for (const [k] of __tmDocEnhanceSnapshotCache.entries()) {
                if (String(k || '').startsWith(`${did}:`)) __tmDocEnhanceSnapshotCache.delete(k);
            }
        } catch (e) {}
        try { __tmClearAttrHostResolutionCache(); } catch (e) {}
        try { __tmClearCustomFieldAttrValueCache(); } catch (e) {}
        try { __tmAuxQueryCache.clear(); } catch (e) {}
        try { __tmDocExpandCache.clear(); } catch (e) {}
        try { __tmResolvedDocIdsCacheMap.clear(); } catch (e) {}
        try { __tmClearGroupSessionTaskCache(did); } catch (e) {}
        try { __tmClearDocSessionTaskCache(did); } catch (e) {}
        try { __tmResolvedDocIdsCache = null; } catch (e) {}
        try { __tmResolvedDocIdsPromise = null; } catch (e) {}
    }

    function __tmInvalidateAllSqlCaches() {
        try { __tmTasksQueryCache.clear(); } catch (e) {}
        try { __tmDocHasTaskQueryCache.clear(); } catch (e) {}
        try { __tmDocEnhanceSnapshotCache.clear(); } catch (e) {}
        try { __tmTaskDocMapCache.clear(); } catch (e) {}
        try { __tmClearAttrHostResolutionCache(); } catch (e) {}
        try { __tmClearCustomFieldAttrValueCache(); } catch (e) {}
        try { __tmDocEnhanceWarmQueue.items.length = 0; __tmDocEnhanceWarmQueue.set.clear(); } catch (e) {}
        try { __tmSqlInFlight.clear(); } catch (e) {}
        try { __tmAuxQueryCache.clear(); } catch (e) {}
        try { __tmDocExpandCache.clear(); } catch (e) {}
        try { __tmResolvedDocIdsCacheMap.clear(); } catch (e) {}
        try { __tmClearGroupSessionTaskCache(); } catch (e) {}
        try { __tmClearDocSessionTaskCache(); } catch (e) {}
        try { __tmResolvedDocIdsCache = null; } catch (e) {}
        try { __tmResolvedDocIdsPromise = null; } catch (e) {}
    }

    function __tmPruneDocSessionTaskCache(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const maxEntries = Math.max(40, Math.floor(Number(opts.maxEntries || 260) || 260));
        const maxAgeMs = Math.max(5 * 60 * 1000, Math.floor(Number(opts.maxAgeMs || 20 * 60 * 1000) || 20 * 60 * 1000));
        try {
            const now = Date.now();
            for (const [docId, entry] of Array.from(__tmDocSessionTaskCache.entries())) {
                if (!__tmIsLikelyBlockId(String(docId || '').trim()) || !entry || typeof entry !== 'object') {
                    __tmDocSessionTaskCache.delete(docId);
                    continue;
                }
                if (now - Number(entry?.t || 0) > maxAgeMs) {
                    __tmDocSessionTaskCache.delete(docId);
                }
            }
            if (__tmDocSessionTaskCache.size <= maxEntries) return;
            const survivors = Array.from(__tmDocSessionTaskCache.entries())
                .sort((a, b) => Number(b[1]?.t || 0) - Number(a[1]?.t || 0))
                .slice(0, maxEntries);
            __tmDocSessionTaskCache.clear();
            survivors.forEach(([docId, entry]) => {
                __tmDocSessionTaskCache.set(docId, entry);
            });
        } catch (e) {}
    }

    async function __tmFillDocHasTasksMap(docIds, tasksMap) {
        const ids = Array.from(new Set((docIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
        if (!ids.length || !(tasksMap instanceof Map)) return tasksMap;
        const now = Date.now();
        const ttlMs = 20000;
        let taskIndexStore = null;
        const docUpdatedMap = __tmBuildDocUpdatedFingerprintMap(state.allDocuments);
        try { taskIndexStore = await __tmLoadTaskIndexStore(); } catch (e) { taskIndexStore = null; }
        const uncheckedIds = [];
        ids.forEach((id) => {
            if (tasksMap.has(id)) return;
            const cached = __tmDocHasTaskQueryCache.get(id);
            if (cached && (now - Number(cached.t || 0)) < ttlMs) {
                if (cached.hasTasks) tasksMap.set(id, true);
                return;
            }
            const indexedDoc = taskIndexStore?.docs?.[id];
            if (__tmIsUsableTaskIndexDoc(indexedDoc, { queryLimit: __TM_TASK_INDEX_QUERY_LIMIT, docUpdatedMap })) {
                const hasIndexedTasks = Number(indexedDoc?.taskCount || 0) > 0
                    || (Array.isArray(indexedDoc?.blocks) && indexedDoc.blocks.length > 0)
                    || (Array.isArray(indexedDoc?.tasks) && indexedDoc.tasks.length > 0);
                __tmDocHasTaskQueryCache.set(id, { t: now, hasTasks: hasIndexedTasks });
                if (hasIndexedTasks) tasksMap.set(id, true);
                return;
            }
            uncheckedIds.push(id);
        });
        if (!uncheckedIds.length) return tasksMap;
        const found = new Set();
        const CHUNK_SIZE = 50;
        for (let i = 0; i < uncheckedIds.length; i += CHUNK_SIZE) {
            const chunk = uncheckedIds.slice(i, i + CHUNK_SIZE);
            if (!chunk.length) continue;
            const idsStr = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
            const sql = `SELECT DISTINCT root_id FROM blocks WHERE type='i' AND subtype='t' AND root_id IN (${idsStr}) LIMIT ${Math.max(1, Math.min(5000, chunk.length))}`;
            try {
                const res = await API.call('/api/query/sql', { stmt: sql });
                if (res.code === 0 && Array.isArray(res.data)) {
                    res.data.forEach((row) => {
                        const rid = String(row?.root_id || '').trim();
                        if (!rid) return;
                        found.add(rid);
                        tasksMap.set(rid, true);
                    });
                }
            } catch (e) {}
        }
        uncheckedIds.forEach((id) => {
            const hasTasks = found.has(id);
            __tmDocHasTaskQueryCache.set(id, { t: Date.now(), hasTasks });
        });
        return tasksMap;
    }

    async function __tmBuildTaskDocMap(taskIds) {
        const ids = Array.from(new Set((taskIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
        const out = new Map();
        if (!ids.length) return out;
        const now = Date.now();
        const ttlMs = 15000;
        const misses = [];
        ids.forEach((tid) => {
            const cached = __tmTaskDocMapCache.get(tid);
            if (cached && (now - Number(cached.t || 0)) < ttlMs) {
                const did = String(cached.docId || '').trim();
                if (did) out.set(tid, did);
                return;
            }
            misses.push(tid);
        });
        const chunkSize = 200;
        for (let i = 0; i < misses.length; i += chunkSize) {
            const chunk = misses.slice(i, i + chunkSize);
            if (!chunk.length) continue;
            const idList = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
            const batchLimit = Math.max(1, Math.min(5000, chunk.length));
            const sql = `SELECT id AS task_id, root_id FROM blocks WHERE id IN (${idList}) LIMIT ${batchLimit}`;
            const foundSet = new Set();
            try {
                const res = await API.call('/api/query/sql', { stmt: sql });
                if (res.code === 0 && Array.isArray(res.data)) {
                    res.data.forEach((row) => {
                        const tid = String(row?.task_id || '').trim();
                        const did = String(row?.root_id || '').trim();
                        if (!tid) return;
                        foundSet.add(tid);
                        __tmTaskDocMapCache.set(tid, { t: Date.now(), docId: did });
                        if (did) out.set(tid, did);
                    });
                }
            } catch (e) {}
            chunk.forEach((tid) => {
                if (!foundSet.has(tid)) __tmTaskDocMapCache.set(tid, { t: Date.now(), docId: '' });
            });
        }
        return out;
    }

    function __tmCollectTaskEnhanceTargets(tasks) {
        const source = Array.isArray(tasks) ? tasks : [];
        const taskIds = [];
        const taskDocMap = new Map();
        const now = Date.now();
        source.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            if (!taskId) return;
            taskIds.push(taskId);
            const docId = String(task?.root_id || '').trim();
            if (!docId) return;
            taskDocMap.set(taskId, docId);
            __tmTaskDocMapCache.set(taskId, { t: now, docId });
        });
        return { taskIds, taskDocMap };
    }

    const __tmDebugChannels = {
        status: { enabled: false, log: [], limit: 400 },
        detail: { enabled: false, log: [], limit: 400 },
    };
    const __TM_TASK_HORIZON_DEBUG_RELAY_STORAGE_KEY = '__tmTaskHorizonDebugRelay';
    const __TM_TASK_HORIZON_ATTR_RELAY_STORAGE_KEY = '__tmTaskHorizonAttrRelay';

    function __tmGetDebugChannelPersistKey(channel) {
        const key = String(channel || '').trim();
        if (key === 'status') return 'tm_task_horizon_debug_status';
        if (key === 'detail') return 'tm_task_horizon_debug_detail';
        return '';
    }

    function __tmReadPersistedDebugChannelEnabled(channel) {
        const storageKey = __tmGetDebugChannelPersistKey(channel);
        if (!storageKey) return false;
        try {
            const raw = String(localStorage.getItem(storageKey) || '').trim().toLowerCase();
            return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
        } catch (e) {
            return false;
        }
    }

    function __tmPersistDebugChannelEnabled(channel, enabled = true) {
        const storageKey = __tmGetDebugChannelPersistKey(channel);
        if (!storageKey) return false;
        try {
            if (enabled === false) localStorage.removeItem(storageKey);
            else localStorage.setItem(storageKey, '1');
            return true;
        } catch (e) {
            return false;
        }
    }

    try {
        Object.keys(__tmDebugChannels).forEach((channel) => {
            __tmDebugChannels[channel].enabled = __tmReadPersistedDebugChannelEnabled(channel);
        });
    } catch (e) {}

    function __tmCloneDebugValue(value, depth = 0) {
        if (depth > 4) return '[MaxDepth]';
        if (value == null) return value;
        const type = typeof value;
        if (type === 'string' || type === 'number' || type === 'boolean') return value;
        if (type === 'bigint') return String(value);
        if (type === 'function') return `[Function ${value.name || 'anonymous'}]`;
        if (value instanceof Date) return value.toISOString();
        if (value instanceof Error) {
            return {
                name: String(value.name || 'Error'),
                message: String(value.message || ''),
                stack: String(value.stack || '').split('\n').slice(0, 6),
            };
        }
        if (value instanceof Element) return __tmDescribeDebugElement(value);
        if (Array.isArray(value)) return value.slice(0, 24).map((item) => __tmCloneDebugValue(item, depth + 1));
        if (type === 'object') {
            const out = {};
            Object.keys(value).slice(0, 40).forEach((key) => {
                try {
                    out[key] = __tmCloneDebugValue(value[key], depth + 1);
                } catch (e) {
                    out[key] = `[CloneError ${String(e?.message || e || '')}]`;
                }
            });
            return out;
        }
        try {
            return String(value);
        } catch (e) {
            return '[Unserializable]';
        }
    }

    function __tmBuildDebugEntry(channel, tag, payload) {
        const now = Date.now();
        return {
            channel: String(channel || '').trim(),
            tag: String(tag || '').trim() || 'unknown',
            ts: now,
            time: new Date(now).toISOString(),
            viewMode: String(state.viewMode || '').trim(),
            currentRule: String(state.currentRule || '').trim(),
            detailTaskId: String(state.detailTaskId || '').trim(),
            payload: __tmCloneDebugValue(payload),
        };
    }

    function __tmSetDebugChannelEnabled(channel, enabled = true) {
        const key = String(channel || '').trim();
        const target = __tmDebugChannels[key];
        if (!target) return { ok: false, channel: key, enabled: false };
        target.enabled = enabled !== false;
        try { __tmPersistDebugChannelEnabled(key, target.enabled === true); } catch (e) {}
        return {
            ok: true,
            channel: key,
            enabled: target.enabled === true,
            size: Array.isArray(target.log) ? target.log.length : 0,
        };
    }

    function __tmDumpDebugChannel(channel, limit = 120) {
        const key = String(channel || '').trim();
        const target = __tmDebugChannels[key];
        if (!target) return [];
        const count = Math.max(1, Math.min(Math.max(1, Number(target.limit) || 400), Number(limit) || 120));
        const out = target.log.slice(-count);
        try {
            console.table(out.map((entry) => ({
                time: entry?.time || '',
                tag: entry?.tag || '',
                viewMode: entry?.viewMode || '',
                detailTaskId: entry?.detailTaskId || '',
                payload: entry?.payload || null,
            })));
        } catch (e) {}
        return out;
    }

    function __tmClearDebugChannel(channel) {
        const key = String(channel || '').trim();
        const target = __tmDebugChannels[key];
        if (!target) return { ok: false, channel: key };
        target.log.length = 0;
        try {
            if (key === 'status') {
                globalThis.__tmTaskHorizonStatusDebugLog = target.log;
                globalThis.__tmTaskHorizonStatusDebugLast = null;
            } else if (key === 'detail') {
                globalThis.__tmTaskHorizonDetailDebugLog = target.log;
                globalThis.__tmTaskHorizonDetailDebugLast = null;
            }
        } catch (e) {}
        return { ok: true, channel: key };
    }

    function __tmPushDebugChannel(channel, tag, payload = {}) {
        const key = String(channel || '').trim();
        const target = __tmDebugChannels[key];
        if (!target || target.enabled !== true) return null;
        const entry = __tmBuildDebugEntry(key, tag, payload);
        target.log.push(entry);
        if (target.log.length > target.limit) {
            target.log.splice(0, target.log.length - target.limit);
        }
        try {
            if (key === 'status') {
                globalThis.__tmTaskHorizonStatusDebugLog = target.log;
                globalThis.__tmTaskHorizonStatusDebugLast = entry;
            } else if (key === 'detail') {
                globalThis.__tmTaskHorizonDetailDebugLog = target.log;
                globalThis.__tmTaskHorizonDetailDebugLast = entry;
            }
        } catch (e) {}
        // Keep debug data in the in-memory ring buffer and expose it through
        // the dump helpers. Real-time console echo creates massive log spam
        // during refresh storms and can visibly hurt scrolling performance.
        return entry;
    }

    function __tmShouldLogStatusDebug(taskIds = [], force = false) {
        if (force === true) return true;
        return __tmDebugChannels.status.enabled === true;
    }

    function __tmPushStatusDebug(tag, payload = {}) {
        return __tmPushDebugChannel('status', tag, payload);
    }

    function __tmDescribeDebugElement(element) {
        const el = element instanceof Element ? element : null;
        if (!(el instanceof Element)) return '';
        const tag = String(el.tagName || '').toLowerCase();
        const id = String(el.id || '').trim();
        const cls = Array.from(el.classList || []).slice(0, 4).join('.');
        const taskId = String(el.getAttribute?.('data-id') || el.getAttribute?.('data-task-id') || '').trim();
        const field = String(el.getAttribute?.('data-tm-field') || '').trim();
        return `${tag}${id ? `#${id}` : ''}${cls ? `.${cls}` : ''}${taskId ? `[task=${taskId}]` : ''}${field ? `[field=${field}]` : ''}`;
    }

    function __tmPushDetailDebug(tag, payload = {}) {
        return __tmPushDebugChannel('detail', tag, payload);
    }

    try {
        try { delete globalThis.tmTaskHorizonDetailDebugDump; } catch (e) {}
        try { delete globalThis.tmTaskHorizonDetailDebugClear; } catch (e) {}
        try { delete globalThis.tmTaskHorizonDetailDebugEnable; } catch (e) {}
        try { delete globalThis.__tmTaskHorizonDetailDebugLog; } catch (e) {}
        try { delete globalThis.__tmTaskHorizonDetailDebugLast; } catch (e) {}
        try { delete window.tmTaskHorizonDetailDebug; } catch (e) {}
    } catch (e) {}

    try {
        try { delete globalThis.__tmTaskHorizonDebugPush; } catch (e) {}
        try { delete globalThis.tmTaskHorizonDebugMoveDump; } catch (e) {}
        try { delete globalThis.tmTaskHorizonDebugMoveLatest; } catch (e) {}
        try { delete globalThis.tmTaskHorizonStatusDebugEnable; } catch (e) {}
        try { delete globalThis.tmTaskHorizonStatusDebugDump; } catch (e) {}
        try { delete globalThis.tmTaskHorizonStatusDebugClear; } catch (e) {}
        try { delete globalThis.__tmTaskHorizonStatusDebugLog; } catch (e) {}
        try { delete globalThis.__tmTaskHorizonStatusDebugLast; } catch (e) {}
        try { delete globalThis.__tmTaskHorizonPerfTrace; } catch (e) {}
        try { delete globalThis.__tmTaskHorizonPerfTraceLast; } catch (e) {}
        try { delete globalThis.__tmTaskHorizonPerfTraceCurrent; } catch (e) {}
        try { delete globalThis.__tmTaskHorizonPerfCreate; } catch (e) {}
        try { delete globalThis.__tmTaskHorizonPerfMark; } catch (e) {}
        try { delete globalThis.__tmTaskHorizonPerfFinish; } catch (e) {}
    } catch (e) {}

    try {
        globalThis.__tmTaskHorizonDebugPush = function(channel, tag, payload = {}) {
            return __tmPushDebugChannel(channel, tag, payload);
        };
        globalThis.tmTaskHorizonStatusDebugEnable = function(enabled = true) {
            return __tmSetDebugChannelEnabled('status', enabled);
        };
        globalThis.tmTaskHorizonStatusDebugDump = function(limit = 120) {
            return __tmDumpDebugChannel('status', limit);
        };
        globalThis.tmTaskHorizonStatusDebugClear = function() {
            return __tmClearDebugChannel('status');
        };
        globalThis.tmTaskHorizonDetailDebugEnable = function(enabled = true) {
            return __tmSetDebugChannelEnabled('detail', enabled);
        };
        globalThis.tmTaskHorizonDetailDebugDump = function(limit = 120) {
            return __tmDumpDebugChannel('detail', limit);
        };
        globalThis.tmTaskHorizonDetailDebugClear = function() {
            return __tmClearDebugChannel('detail');
        };
        globalThis.__tmTaskHorizonPerfTrace = __tmPerfTraceStore.log;
        globalThis.__tmTaskHorizonPerfTraceLast = null;
        globalThis.__tmTaskHorizonPerfTraceCurrent = null;
        globalThis.__tmTaskHorizonPerfCreate = function(name, meta = {}) {
            return __tmCreatePerfTrace(name, meta);
        };
        globalThis.__tmTaskHorizonPerfMark = function(trace, tag, payload = {}) {
            return __tmPerfTraceMark(trace, tag, payload);
        };
        globalThis.__tmTaskHorizonPerfFinish = function(trace, detail = {}) {
            return __tmPerfTraceFinish(trace, detail);
        };
        globalThis.tmTaskHorizonPerfDump = function(limit = 5) {
            return __tmDumpPerfTraces(limit);
        };
        globalThis.tmTaskHorizonPerfClear = function() {
            return __tmClearPerfTraces();
        };
        globalThis.tmTaskHorizonPerfLatest = function() {
            return __tmClonePerfTrace(globalThis.__tmTaskHorizonPerfTraceLast || null);
        };
        globalThis.tmTaskHorizonStats = function() {
            return __tmGetStatsSnapshot();
        };
        if (!window.tmTaskHorizonPerf || typeof window.tmTaskHorizonPerf !== 'object') {
            window.tmTaskHorizonPerf = {};
        }
        window.tmTaskHorizonPerf.dump = function(limit = 5) {
            return __tmDumpPerfTraces(limit);
        };
        window.tmTaskHorizonPerf.clear = function() {
            return __tmClearPerfTraces();
        };
        window.tmTaskHorizonPerf.latest = function() {
            return __tmClonePerfTrace(globalThis.__tmTaskHorizonPerfTraceLast || null);
        };
        window.tmTaskHorizonPerf.stats = function() {
            return __tmGetStatsSnapshot();
        };
        window.tmTaskHorizonDetailDebug = {
            enable(enabled = true) {
                return __tmSetDebugChannelEnabled('detail', enabled);
            },
            dump(limit = 120) {
                return __tmDumpDebugChannel('detail', limit);
            },
            clear() {
                return __tmClearDebugChannel('detail');
            },
        };
    } catch (e) {}

    function __tmRoundPerfMs(value) {
        const num = Number(value);
        return Number.isFinite(num) ? Math.round(num * 10) / 10 : 0;
    }

    const __tmPerfTraceStore = {
        log: [],
        limit: 80,
        seq: 0,
    };

    function __tmPerfNow() {
        try {
            if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
                return performance.now();
            }
        } catch (e) {}
        return Date.now();
    }

    function __tmClonePerfTrace(trace) {
        const src = (trace && typeof trace === 'object') ? trace : null;
        if (!src) return null;
        return {
            id: Number(src.id || 0),
            name: String(src.name || '').trim() || 'trace',
            createdAt: Number(src.createdAt || 0),
            createdTime: String(src.createdTime || ''),
            meta: __tmCloneDebugValue(src.meta || {}),
            finished: src.finished === true,
            totalMs: __tmRoundPerfMs(src.totalMs || 0),
            marks: Array.isArray(src.marks)
                ? src.marks.map((mark) => ({
                    index: Number(mark?.index || 0),
                    tag: String(mark?.tag || '').trim(),
                    time: String(mark?.time || ''),
                    sinceStartMs: __tmRoundPerfMs(mark?.sinceStartMs || 0),
                    sincePrevMs: __tmRoundPerfMs(mark?.sincePrevMs || 0),
                    payload: __tmCloneDebugValue(mark?.payload || {}),
                }))
                : [],
            finishDetail: __tmCloneDebugValue(src.finishDetail || {}),
        };
    }

    function __tmPushPerfTrace(trace) {
        const entry = __tmClonePerfTrace(trace);
        if (!entry) return null;
        __tmPerfTraceStore.log.push(entry);
        if (__tmPerfTraceStore.log.length > __tmPerfTraceStore.limit) {
            __tmPerfTraceStore.log.splice(0, __tmPerfTraceStore.log.length - __tmPerfTraceStore.limit);
        }
        try {
            globalThis.__tmTaskHorizonPerfTrace = __tmPerfTraceStore.log;
            globalThis.__tmTaskHorizonPerfTraceLast = entry;
            globalThis.__tmTaskHorizonPerfTraceCurrent = null;
        } catch (e) {}
        return entry;
    }

    function __tmCreatePerfTrace(name = '', meta = {}) {
        const now = Date.now();
        const trace = {
            id: ++__tmPerfTraceStore.seq,
            name: String(name || '').trim() || 'trace',
            createdAt: now,
            createdTime: new Date(now).toISOString(),
            startPerf: __tmPerfNow(),
            marks: [],
            meta: __tmCloneDebugValue(meta || {}),
            finished: false,
            totalMs: 0,
            finishDetail: null,
        };
        try {
            globalThis.__tmTaskHorizonPerfTrace = __tmPerfTraceStore.log;
            globalThis.__tmTaskHorizonPerfTraceCurrent = trace;
        } catch (e) {}
        return trace;
    }

    function __tmPerfTraceMark(trace, tag = '', payload = {}) {
        const target = (trace && typeof trace === 'object') ? trace : null;
        if (!target || target.finished === true) return trace;
        const now = Date.now();
        const perfNow = __tmPerfNow();
        const prev = Array.isArray(target.marks) && target.marks.length ? target.marks[target.marks.length - 1] : null;
        const entry = {
            index: Array.isArray(target.marks) ? target.marks.length + 1 : 1,
            tag: String(tag || '').trim() || 'mark',
            at: now,
            time: new Date(now).toISOString(),
            perfNow,
            sinceStartMs: __tmRoundPerfMs(perfNow - Number(target.startPerf || perfNow)),
            sincePrevMs: __tmRoundPerfMs(prev ? (perfNow - Number(prev.perfNow || perfNow)) : 0),
            payload: __tmCloneDebugValue(payload || {}),
        };
        if (!Array.isArray(target.marks)) target.marks = [];
        target.marks.push(entry);
        try { globalThis.__tmTaskHorizonPerfTraceCurrent = target; } catch (e) {}
        return trace;
    }

    function __tmPerfTraceFinish(trace, detail = {}) {
        const target = (trace && typeof trace === 'object') ? trace : null;
        if (!target) return trace;
        if (target.finished === true) return __tmClonePerfTrace(target);
        const perfNow = __tmPerfNow();
        target.finished = true;
        target.totalMs = __tmRoundPerfMs(perfNow - Number(target.startPerf || perfNow));
        target.finishDetail = __tmCloneDebugValue(detail || {});
        const entry = __tmPushPerfTrace(target);
        return entry || __tmClonePerfTrace(target);
    }

    function __tmDumpPerfTraces(limit = 5) {
        const count = Math.max(1, Math.min(80, Number(limit) || 5));
        const traces = __tmPerfTraceStore.log.slice(-count).map((trace) => __tmClonePerfTrace(trace)).filter(Boolean);
        return traces;
    }

    function __tmClearPerfTraces() {
        __tmPerfTraceStore.log.length = 0;
        try {
            globalThis.__tmTaskHorizonPerfTrace = __tmPerfTraceStore.log;
            globalThis.__tmTaskHorizonPerfTraceLast = null;
            globalThis.__tmTaskHorizonPerfTraceCurrent = null;
        } catch (e) {}
        return { ok: true, size: 0 };
    }

    function __tmGetStatsSnapshot() {
        return __tmCloneDebugValue(state?.stats || {});
    }

    function __tmGetPerfTraceMarkPayload(tag = 'normalize', trace = null) {
        const targetTrace = (trace && typeof trace === 'object')
            ? trace
            : (globalThis.__tmTaskHorizonPerfTraceLast || null);
        const marks = Array.isArray(targetTrace?.marks) ? targetTrace.marks : [];
        const query = String(tag || '').trim();
        let mark = null;
        if (/^\d+$/.test(query)) {
            const index = Math.max(1, Number(query));
            mark = marks.find((item) => Number(item?.index || 0) === index) || null;
        } else {
            for (let i = marks.length - 1; i >= 0; i -= 1) {
                const item = marks[i];
                if (String(item?.tag || '').trim() === query) {
                    mark = item;
                    break;
                }
            }
        }
        return __tmCloneDebugValue(mark?.payload || null);
    }

    function __tmDumpPerfTraceMarkPayload(tag = 'normalize', trace = null) {
        return __tmGetPerfTraceMarkPayload(tag, trace);
    }

    function __tmScheduleIdleTask(task, timeout = 180) {
        const run = () => Promise.resolve().then(task).catch(() => null);
        try {
            if (typeof window !== 'undefined' && window && typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(() => { run(); }, { timeout: Math.max(0, Number(timeout) || 0) });
                return;
            }
        } catch (e) {}
        setTimeout(() => { run(); }, 0);
    }

    function __tmGetInitialLoadBudget(options = {}) {
        const cfg = __tmGetPerfTuningOptions();
        const forceFullLoadBudget = !!(options && options.forceFullLoadBudget);
        const runtimeMobile = typeof __tmIsRuntimeMobileClient === 'function' && __tmIsRuntimeMobileClient();
        const viewMode = String(options?.viewMode || state?.viewMode || '').trim();
        const baseQueryLimit = Number.isFinite(Number(options?.queryLimit))
            ? Math.max(1, Math.round(Number(options.queryLimit)))
            : __TM_TASK_INDEX_QUERY_LIMIT;
        const forced = !!(options && options.forceFastFirstPaintBudget);
        const viewSupportsAutoBudget = viewMode === 'checklist' || viewMode === 'list';
        const enabled = !!((forced || (cfg.mobileFastFirstPaint && runtimeMobile && viewSupportsAutoBudget)) && !forceFullLoadBudget);
        const overrideQueryLimit = Number(options?.initialQueryLimit);
        const overrideRenderLimit = Number(options?.initialRenderLimit);
        const overrideListStep = Number(options?.initialListStep);
        const queryLimit = Math.max(20, Math.min(
            baseQueryLimit,
            Number.isFinite(overrideQueryLimit) ? Math.round(overrideQueryLimit) : (Number(cfg.mobileInitialQueryLimit) || 60)
        ));
        const renderLimit = Math.max(10, Math.min(
            queryLimit,
            Number.isFinite(overrideRenderLimit) ? Math.round(overrideRenderLimit) : (Number(cfg.mobileInitialRenderLimit) || 30)
        ));
        const listStep = Math.max(10, Math.min(
            renderLimit,
            Number.isFinite(overrideListStep) ? Math.round(overrideListStep) : (Number(cfg.mobileInitialListStep) || 30)
        ));
        return { enabled, queryLimit, renderLimit, listStep };
    }

    function __tmGetPerfTuningOptions() {
        const cfg = (typeof window !== 'undefined' && window && typeof window.tmTaskHorizonPerf === 'object' && window.tmTaskHorizonPerf)
            ? window.tmTaskHorizonPerf
            : {};
        const deferThreshold0 = Number(cfg.deferEnhanceThreshold);
        const fetchConcurrency0 = Number(cfg.docEnhanceFetchConcurrency ?? cfg.enhanceDocConcurrency);
        const warmLimit0 = Number(cfg.docEnhanceWarmLimit);
        const prefetchLimit0 = Number(cfg.prefetchGroupDocsLimit);
        const warmConcurrency0 = Number(cfg.docEnhanceWarmConcurrency);
        const mobileInitialQuery0 = Number(cfg.mobileInitialQueryLimit);
        const mobileInitialRender0 = Number(cfg.mobileInitialRenderLimit);
        const mobileInitialStep0 = Number(cfg.mobileInitialListStep);
        const taskIndexPrewarmDelay0 = Number(cfg.taskIndexPrewarmDelayMs);
        const taskIndexPrewarmChunk0 = Number(cfg.taskIndexPrewarmChunkSize);
        const taskIndexPrewarmMaxDocs0 = Number(cfg.taskIndexPrewarmMaxDocs);
        const taskBlockIncrementalMax0 = Number(cfg.taskBlockIncrementalMaxTasks);
        const disableSiblingRank = cfg.disableSiblingRank === true || cfg.perfDisableSiblingRank === true;
        const deferRecurringReconcile = cfg.deferRecurringReconcile === true || cfg.perfDeferRecurringReconcile === true;
        const readRepeatAttrsInline = cfg.readRepeatAttrsInline !== false && cfg.perfReadRepeatAttrsInline !== false;
        return {
            asyncEnhance: cfg.asyncEnhance !== false,
            deferEnhanceThreshold: Number.isFinite(deferThreshold0) ? Math.max(50, Math.floor(deferThreshold0)) : 180,
            docEnhanceFetchConcurrency: Number.isFinite(fetchConcurrency0) ? Math.max(1, Math.min(8, Math.floor(fetchConcurrency0))) : 6,
            warmEnhance: cfg.warmEnhance !== false,
            warmEnhanceLimit: Number.isFinite(warmLimit0) ? Math.max(0, Math.floor(warmLimit0)) : 80,
            prefetchGroupDocsLimit: Number.isFinite(prefetchLimit0) ? Math.max(0, Math.floor(prefetchLimit0)) : 30,
            warmEnhanceConcurrency: Number.isFinite(warmConcurrency0) ? Math.max(1, Math.min(4, Math.floor(warmConcurrency0))) : 2,
            mobileFastFirstPaint: cfg.mobileFastFirstPaint !== false,
            mobileInitialQueryLimit: Number.isFinite(mobileInitialQuery0) ? Math.max(50, Math.floor(mobileInitialQuery0)) : 180,
            mobileInitialRenderLimit: Number.isFinite(mobileInitialRender0) ? Math.max(20, Math.floor(mobileInitialRender0)) : 60,
            mobileInitialListStep: Number.isFinite(mobileInitialStep0) ? Math.max(20, Math.floor(mobileInitialStep0)) : 60,
            taskIndexPrewarm: cfg.taskIndexPrewarm !== false && cfg.disableTaskIndexPrewarm !== true,
            taskIndexPrewarmDelayMs: Number.isFinite(taskIndexPrewarmDelay0) ? Math.max(120, Math.floor(taskIndexPrewarmDelay0)) : 900,
            taskIndexPrewarmChunkSize: Number.isFinite(taskIndexPrewarmChunk0) ? Math.max(2, Math.min(30, Math.floor(taskIndexPrewarmChunk0))) : 12,
            taskIndexPrewarmMaxDocs: Number.isFinite(taskIndexPrewarmMaxDocs0) ? Math.max(0, Math.floor(taskIndexPrewarmMaxDocs0)) : 1200,
            taskBlockIncrementalRefresh: cfg.taskBlockIncrementalRefresh !== false && cfg.disableTaskBlockIncrementalRefresh !== true,
            taskBlockIncrementalMaxTasks: Number.isFinite(taskBlockIncrementalMax0) ? Math.max(1, Math.min(30, Math.floor(taskBlockIncrementalMax0))) : 8,
            disableSiblingRank,
            deferRecurringReconcile,
            readRepeatAttrsInline,
        };
    }

    function __tmDrainDocEnhanceWarmQueue() {
        const cfg = __tmGetPerfTuningOptions();
        if (!cfg.warmEnhance) return;
        while (__tmDocEnhanceWarmQueue.running < cfg.warmEnhanceConcurrency && __tmDocEnhanceWarmQueue.items.length > 0) {
            const next = __tmDocEnhanceWarmQueue.items.shift();
            if (!next) continue;
            __tmDocEnhanceWarmQueue.set.delete(next.key);
            __tmDocEnhanceWarmQueue.running += 1;
            Promise.resolve().then(async () => {
                try {
                    if (API && typeof API.getDocEnhanceSnapshot === 'function') {
                        await API.getDocEnhanceSnapshot(next.docId, next.headingLevel, { needH2: true, needFlow: false });
                    }
                } catch (e) {}
            }).finally(() => {
                __tmDocEnhanceWarmQueue.running = Math.max(0, Number(__tmDocEnhanceWarmQueue.running || 0) - 1);
                if (__tmDocEnhanceWarmQueue.items.length > 0) {
                    try { if (__tmDocEnhanceWarmQueue.timer) clearTimeout(__tmDocEnhanceWarmQueue.timer); } catch (e) {}
                    __tmDocEnhanceWarmQueue.timer = setTimeout(() => {
                        __tmDocEnhanceWarmQueue.timer = null;
                        __tmDrainDocEnhanceWarmQueue();
                    }, 0);
                }
            });
        }
    }

    function __tmEnqueueDocEnhanceWarm(docIds, headingLevel) {
        const cfg = __tmGetPerfTuningOptions();
        if (!cfg.warmEnhance) return;
        const ids = Array.from(new Set((docIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
        if (!ids.length) return;
        ids.forEach((docId) => {
            const key = `${docId}:${String(headingLevel || 'h2').trim().toLowerCase()}`;
            if (__tmDocEnhanceWarmQueue.set.has(key)) return;
            __tmDocEnhanceWarmQueue.set.add(key);
            __tmDocEnhanceWarmQueue.items.push({ key, docId, headingLevel });
        });
        __tmDrainDocEnhanceWarmQueue();
    }

    function __tmCollectPrefetchDocIdsByGroups(currentGroupId, limit) {
        const out = [];
        const seen = new Set();
        const push = (id0) => {
            const id = String(id0 || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        };
        const groups = Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [];
        groups.forEach((group) => {
            const gid = String(group?.id || '').trim();
            if (!gid || gid === String(currentGroupId || '').trim()) return;
            const entries = __tmGetGroupSourceEntries(group);
            entries.forEach((entry) => {
                if (String(entry?.kind || 'doc').trim() !== 'doc') return;
                push(entry?.id);
            });
        });
        const max = Math.max(0, Number(limit) || 0);
        return max > 0 ? out.slice(0, max) : [];
    }

    function __tmScheduleEnhanceWarmup(currentDocIds, currentGroupId) {
        const cfg = __tmGetPerfTuningOptions();
        if (!cfg.warmEnhance) return;
        const headingLevel = String(SettingsStore?.data?.taskHeadingLevel || 'h2').trim().toLowerCase();
        const warmIds = (Array.isArray(currentDocIds) ? currentDocIds : []).slice(0, cfg.warmEnhanceLimit);
        __tmEnqueueDocEnhanceWarm(warmIds, headingLevel);
        const prefetchIds = __tmCollectPrefetchDocIdsByGroups(currentGroupId, cfg.prefetchGroupDocsLimit);
        __tmEnqueueDocEnhanceWarm(prefetchIds, headingLevel);
    }

    async function __tmCollectAllConfiguredTaskScopeDocIds() {
        const out = [];
        const seen = new Set();
        const pushDocId = (id0) => {
            const id = String(id0 || '').trim();
            if (!__tmIsLikelyBlockId(id) || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        };
        const entries = [];
        const quickAddDocId = String(SettingsStore?.data?.newTaskDocId || '').trim();
        if (__tmIsLikelyBlockId(quickAddDocId)) entries.push({ id: quickAddDocId, kind: 'doc', recursive: false });
        const legacyIds = Array.isArray(SettingsStore?.data?.selectedDocIds) ? SettingsStore.data.selectedDocIds : [];
        legacyIds.forEach((id) => entries.push({ id, kind: 'doc', recursive: false }));
        const groups = Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [];
        groups.forEach((group) => {
            try {
                entries.push(...__tmGetGroupSourceEntries(group));
            } catch (e) {}
        });
        for (const entry of entries) {
            try {
                await __tmExpandSourceEntryDocIds(entry, pushDocId);
            } catch (e) {}
        }
        const stillMissingIds = targetIds.filter((id) => !out.has(id));
        if (stillMissingIds.length && API && typeof API.getDocMetaById === 'function') {
            for (const id of stillMissingIds) {
                if (out.has(id)) continue;
                try {
                    const meta = await API.getDocMetaById(id);
                    if (!meta) continue;
                    const docName = String(meta?.name || '').trim();
                    const docPath = String(meta?.path || '').trim();
                    out.set(id, {
                        doc_name: docName,
                        doc_path: docPath,
                    });
                    if (!Array.isArray(state.allDocuments)) state.allDocuments = [];
                    const existing = state.allDocuments.find((doc) => String(doc?.id || '').trim() === id);
                    if (existing) {
                        if (!String(existing.name || '').trim() && docName) existing.name = docName;
                        if (!String(existing.path || '').trim() && docPath) existing.path = docPath;
                    } else {
                        state.allDocuments.push({
                            id,
                            name: docName || '未命名文档',
                            alias: '',
                            icon: '',
                            path: docPath,
                            notebook: String(meta?.notebook || '').trim(),
                            taskCount: 0,
                            created: ''
                        });
                    }
                } catch (e) {}
            }
        }
        return out;
    }

    async function __tmBuildTaskIndexEntriesFromRows(docIds, rows, options = {}) {
        const ids = __tmNormalizeTaskSnapshotDocIds(docIds || []);
        if (!ids.length) return [];
        const idSet = new Set(ids);
        const opts = (options && typeof options === 'object') ? options : {};
        const queryLimit = Math.max(1, Math.round(Number(opts.queryLimit || __TM_TASK_INDEX_QUERY_LIMIT) || __TM_TASK_INDEX_QUERY_LIMIT));
        const allDocuments = Array.isArray(state.allDocuments) ? state.allDocuments : [];
        const docInfoById = new Map(allDocuments
            .map((doc) => [String(doc?.id || '').trim(), doc])
            .filter(([docId]) => __tmIsLikelyBlockId(docId)));
        const normalizeCustomFieldDefs = __tmGetCustomFieldDefs();
        const normalizeCustomFieldDefMap = new Map(normalizeCustomFieldDefs
            .map((field) => [String(field?.id || '').trim(), field])
            .filter(([fieldId]) => !!fieldId));
        const normalizeDocDisplayNameCache = new Map();
        const visibleDateFallbackTaskIds = __tmBuildVisibleDateFallbackTaskIdSet();
        const normalizeTaskOptions = {
            docDisplayNameCache: normalizeDocDisplayNameCache,
            docDisplayNameMode: String(__tmGetDocDisplayNameMode() || '').trim() || 'name',
            customFieldDefs: normalizeCustomFieldDefs,
            customFieldDefMap: normalizeCustomFieldDefMap,
            visibleDateFallbackTaskIds,
            todayDateKey: __tmNormalizeDateOnly(new Date()),
        };
        const tasksByDoc = new Map();
        const taskIds = [];
        const taskDocMap = new Map();
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            if (!row || typeof row !== 'object') return;
            const docId = String(row.root_id || row.docId || '').trim();
            if (!idSet.has(docId)) return;
            const task = { ...row };
            const taskId = String(task.id || '').trim();
            const prevTask = taskId ? (state.flatTasks?.[taskId] || null) : null;
            if (taskId) {
                taskIds.push(taskId);
                taskDocMap.set(taskId, docId);
            }
            const parsed = (API && typeof API.parseTaskStatus === 'function')
                ? API.parseTaskStatus(task.markdown)
                : { done: false, content: String(task.content || task.markdown || '').trim(), marker: '' };
            task.done = !!parsed.done;
            task.content = parsed.content;
            const parsedMarker = __tmNormalizeTaskStatusMarker(parsed?.marker, '');
            if (parsedMarker) {
                task.taskMarker = parsedMarker;
                task.task_marker = parsedMarker;
            }
            try { __tmMergeVisibleDateFieldsFromPrevTask(task, prevTask); } catch (e) {}
            const docName = task.docName || task.doc_name || docInfoById.get(docId)?.name || '未命名文档';
            try {
                normalizeTaskFields(task, docName, normalizeTaskOptions);
            } catch (e) {}
            if (prevTask && typeof prevTask === 'object') {
                try { __tmCopyTaskHeadingContext(task, prevTask); } catch (e) {}
            } else {
                try { __tmApplyTaskHeadingContext(task, ''); } catch (e) {}
            }
            if (!tasksByDoc.has(docId)) tasksByDoc.set(docId, []);
            tasksByDoc.get(docId).push(task);

            const repeatHistory = Array.isArray(task.repeatHistory) ? task.repeatHistory : [];
            if (repeatHistory.length > 0) {
                repeatHistory.forEach((historyItem, historyIndex) => {
                    const virtualTask = __tmBuildRecurringInstanceTask(task, historyItem, historyIndex);
                    if (!virtualTask?.id) return;
                    if (!tasksByDoc.has(virtualTask.root_id)) tasksByDoc.set(virtualTask.root_id, []);
                    tasksByDoc.get(virtualTask.root_id).push(virtualTask);
                });
            }
        });

        let h2ContextMap = new Map();
        if (taskIds.length > 0 && API && typeof API.fetchTaskEnhanceBundle === 'function') {
            try {
                const bundle = await API.fetchTaskEnhanceBundle(taskIds, {
                    taskDocMap,
                    needH2: true,
                    needFlow: false,
                });
                h2ContextMap = bundle?.h2ContextMap instanceof Map ? bundle.h2ContextMap : new Map();
            } catch (e) {
                h2ContextMap = new Map();
            }
        }
        if (h2ContextMap.size > 0) {
            tasksByDoc.forEach((list) => {
                (Array.isArray(list) ? list : []).forEach((task) => {
                    const taskId = String(task?.id || '').trim();
                    const sourceTaskId = String(task?.sourceTaskId || task?.recurringSourceTaskId || '').trim();
                    const h2ctx = h2ContextMap.get(taskId) || (sourceTaskId ? h2ContextMap.get(sourceTaskId) : null);
                    if (h2ctx) {
                        try { __tmApplyTaskHeadingContext(task, h2ctx); } catch (e) {}
                    }
                });
            });
        }

        let siblingOrderRanks = new Map();
        if (tasksByDoc.size > 0) {
            try {
                siblingOrderRanks = await __tmResolveTaskSiblingOrderRanks(tasksByDoc);
            } catch (e) {
                siblingOrderRanks = new Map();
            }
        }
        const calcLevel = (tasks, level) => {
            (Array.isArray(tasks) ? tasks : []).forEach((task) => {
                task.level = level;
                if (Array.isArray(task.children) && task.children.length > 0) calcLevel(task.children, level + 1);
            });
        };
        const entries = [];
        for (const docId of ids) {
            const rawTasks = tasksByDoc.get(docId) || [];
            let rootTasks = [];
            try {
                const parentLinkResolved = await __tmResolveDocTaskParentLinks(rawTasks, {
                    docId,
                    source: 'task-index-prewarm',
                });
                rootTasks = Array.isArray(parentLinkResolved?.rootTasks)
                    ? parentLinkResolved.rootTasks
                    : [];
            } catch (e) {
                rootTasks = Array.isArray(rawTasks) ? rawTasks.slice() : [];
            }
            try { __tmSortTaskTreeBySiblingRankMap(rootTasks, siblingOrderRanks); } catch (e) {}
            calcLevel(rootTasks, 0);
            try { __tmAssignDocSeqByTree(rootTasks, 0); } catch (e) {}
            const docInfo = docInfoById.get(docId) || {};
            const entry = __tmBuildTaskIndexDocEntry({
                id: docId,
                name: String(docInfo?.name || rawTasks?.[0]?.docName || '未命名文档').trim() || '未命名文档',
                alias: __tmNormalizeDocAliasValue(docInfo?.alias),
                icon: __tmNormalizeDocIconValue(docInfo?.icon),
                created: String(docInfo?.created || '').trim(),
                docUpdated: String(docInfo?.updated || docInfo?.docUpdated || '').trim(),
                tasks: rootTasks,
            }, {
                queryLimit,
                inTaskTree: rawTasks.length > 0,
            });
            if (entry) entries.push(entry);
        }
        return entries;
    }

    async function __tmMergeTaskIndexEntries(entries) {
        const list = (Array.isArray(entries) ? entries : []).filter((entry) => entry && __tmIsLikelyBlockId(entry.id));
        if (!list.length) return false;
        await __tmLoadTaskIndexStore();
        const nextStore = __tmRememberTaskIndexEntriesInMemory(list, {
            keepDocIds: list.map((entry) => entry?.id),
            pruneNow: true,
        });
        if (!nextStore) return false;
        await __tmWriteJsonFile(TASK_INDEX_FILE_PATH, nextStore);
        return true;
    }

    function __tmScheduleTaskIndexPrewarmForDocIds(docIds, options = {}) {
        const cfg = __tmGetPerfTuningOptions();
        if (!cfg.taskIndexPrewarm) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const maxDocs = Math.max(0, Math.floor(Number(cfg.taskIndexPrewarmMaxDocs) || 0));
        if (maxDocs <= 0) return false;
        const ids = __tmNormalizeTaskSnapshotDocIds(docIds || []).slice(0, maxDocs);
        if (!ids.length) return false;
        ids.forEach((docId) => __tmTaskIndexPrewarmState.pendingDocIds.add(docId));
        if (__tmTaskIndexPrewarmState.running || __tmTaskIndexPrewarmState.timer) return true;
        const delayMs = Math.max(0, Number(opts.delayMs ?? cfg.taskIndexPrewarmDelayMs) || 0);
        __tmTaskIndexPrewarmState.timer = setTimeout(() => {
            __tmTaskIndexPrewarmState.timer = null;
            __tmRunTaskIndexPrewarm().catch(() => null);
        }, delayMs);
        return true;
    }

    function __tmScheduleTaskIndexPrewarm(options = {}) {
        const cfg = __tmGetPerfTuningOptions();
        if (!cfg.taskIndexPrewarm) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const currentDocIds = new Set(__tmNormalizeTaskSnapshotDocIds(opts.currentDocIds || []));
        const currentGroupId = String(opts.currentGroupId || SettingsStore?.data?.currentGroupId || 'all').trim() || 'all';
        const delayMs = Math.max(300, Number(opts.delayMs ?? cfg.taskIndexPrewarmDelayMs) || cfg.taskIndexPrewarmDelayMs);
        if (__tmTaskIndexPrewarmState.timer) return true;
        __tmTaskIndexPrewarmState.timer = setTimeout(() => {
            __tmTaskIndexPrewarmState.timer = null;
            Promise.resolve()
                .then(async () => {
                    const allDocIds = await __tmCollectAllConfiguredTaskScopeDocIds();
                    const currentIds = allDocIds.filter((docId) => currentDocIds.has(docId));
                    const otherDocIds = allDocIds.filter((docId) => !currentDocIds.has(docId));
                    const currentGroupDocs = currentGroupId === 'all'
                        ? currentIds
                        : currentIds;
                    return currentGroupDocs.concat(otherDocIds);
                })
                .then((docIds) => {
                    __tmScheduleTaskIndexPrewarmForDocIds(docIds, { delayMs: 0 });
                })
                .catch(() => null);
        }, delayMs);
        return true;
    }

    async function __tmRunTaskIndexPrewarm() {
        if (__tmTaskIndexPrewarmState.running) return false;
        const cfg = __tmGetPerfTuningOptions();
        if (!cfg.taskIndexPrewarm) return false;
        __tmTaskIndexPrewarmState.running = true;
        __tmTaskIndexPrewarmState.lastStartedAt = Date.now();
        const chunkSize = Math.max(2, Math.min(30, Math.floor(Number(cfg.taskIndexPrewarmChunkSize) || 10)));
        const queryLimit = __TM_TASK_INDEX_QUERY_LIMIT;
        const customFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan();
        const bulkCustomFieldIds = __tmNormalizeCustomFieldIdList(customFieldPlan?.bulkFieldIds);
        let pendingAfterRun = false;
        try {
            const store = await __tmLoadTaskIndexStore();
            const docUpdatedMap = __tmBuildDocUpdatedFingerprintMap(state.allDocuments);
            const ids = Array.from(__tmTaskIndexPrewarmState.pendingDocIds)
                .map((id) => String(id || '').trim())
                .filter((id) => __tmIsLikelyBlockId(id));
            const staleIds = [];
            ids.forEach((docId) => {
                const indexedDoc = store?.docs?.[docId];
                if (__tmIsUsableTaskIndexDoc(indexedDoc, { queryLimit, docUpdatedMap })) {
                    __tmTaskIndexPrewarmState.pendingDocIds.delete(docId);
                    return;
                }
                staleIds.push(docId);
            });
            let bufferedEntries = [];
            let bufferedChunkCount = 0;
            const flushBufferedEntries = async () => {
                if (!bufferedEntries.length) return;
                const nextEntries = bufferedEntries;
                bufferedEntries = [];
                bufferedChunkCount = 0;
                await __tmMergeTaskIndexEntries(nextEntries);
            };
            for (let i = 0; i < staleIds.length; i += chunkSize) {
                const chunk = staleIds.slice(i, i + chunkSize);
                if (!chunk.length) continue;
                try {
                    const res = await API.getTasksByDocuments(chunk, queryLimit, {
                        doneOnly: false,
                        forceFresh: false,
                        skipParentTaskJoin: false,
                        skipDocJoin: true,
                        customFieldIds: bulkCustomFieldIds,
                    });
                    const entries = await __tmBuildTaskIndexEntriesFromRows(chunk, Array.isArray(res?.tasks) ? res.tasks : [], {
                        queryLimit,
                    });
                    if (entries.length) {
                        bufferedEntries.push(...entries);
                        bufferedChunkCount += 1;
                    }
                    chunk.forEach((docId) => __tmTaskIndexPrewarmState.pendingDocIds.delete(docId));
                    if (bufferedChunkCount >= 5) await flushBufferedEntries();
                } catch (e) {
                    chunk.forEach((docId) => __tmTaskIndexPrewarmState.pendingDocIds.delete(docId));
                }
                try { await new Promise((resolve) => setTimeout(resolve, 80)); } catch (e) {}
            }
            await flushBufferedEntries();
        } finally {
            __tmTaskIndexPrewarmState.running = false;
            pendingAfterRun = __tmTaskIndexPrewarmState.pendingDocIds.size > 0;
            if (pendingAfterRun && !__tmTaskIndexPrewarmState.timer) {
                __tmTaskIndexPrewarmState.timer = setTimeout(() => {
                    __tmTaskIndexPrewarmState.timer = null;
                    __tmRunTaskIndexPrewarm().catch(() => null);
                }, 1200);
            }
        }
        return true;
    }

    function __tmHashIds(ids) {
        let h = 2166136261;
        const list = Array.isArray(ids) ? ids : [];
        for (let i = 0; i < list.length; i += 1) {
            const s = String(list[i] || '');
            for (let j = 0; j < s.length; j += 1) {
                h ^= s.charCodeAt(j);
                h = Math.imul(h, 16777619);
            }
            h ^= 10;
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0).toString(16);
    }

    function __tmGetAuxCache(key, ttlMs) {
        const ent = __tmAuxQueryCache.get(key);
        if (!ent || !ent.t) return null;
        if ((Date.now() - ent.t) > (Number(ttlMs) || 0)) return null;
        return ent.v;
    }

    function __tmSetAuxCache(key, value) {
        __tmAuxQueryCache.set(key, { t: Date.now(), v: value });
    }

    function __tmIsLikelyBlockId(value) {
        return /^[0-9]+-[a-zA-Z0-9]+$/.test(String(value || '').trim());
    }

    function __tmExtractDocIdsFromTx(payload) {
        const out = new Set();
        const walk = (v, depth) => {
            if (depth > 5 || !v) return;
            if (Array.isArray(v)) {
                v.forEach((x) => walk(x, depth + 1));
                return;
            }
            if (typeof v !== 'object') return;
            const candidates = [v.root_id, v.rootId, v.rootID, v.root];
            candidates.forEach((x) => {
                const s = String(x || '').trim();
                if (/^[0-9]+-[a-zA-Z0-9]+$/.test(s)) out.add(s);
            });
            const next = [
                v.data,
                v.detail,
                v.tx,
                v.payload,
                v.rows,
                v.ops,
                v.operations,
                v.doOperations,
                v.undoOperations,
                v.children,
                v.items,
                v.srcs,
                v.dsts
            ];
            next.forEach((x) => walk(x, depth + 1));
        };
        walk(payload, 0);
        return out;
    }

    function __tmExtractBlockIdsFromTx(payload) {
        const out = new Set();
        const walk = (v, depth) => {
            if (depth > 6 || !v) return;
            if (Array.isArray(v)) {
                v.forEach((x) => walk(x, depth + 1));
                return;
            }
            if (typeof v !== 'object') return;
            [
                v.id,
                v.blockID,
                v.blockId,
                v.parentID,
                v.parentId,
                v.previousID,
                v.previousId,
                v.nextID,
                v.nextId,
                v.root_id,
                v.rootId,
                v.rootID,
                v.root
            ].forEach((x) => {
                const s = String(x || '').trim();
                if (__tmIsLikelyBlockId(s)) out.add(s);
            });
            [
                v.data,
                v.detail,
                v.tx,
                v.payload,
                v.rows,
                v.ops,
                v.operations,
                v.doOperations,
                v.undoOperations,
                v.children,
                v.items,
                v.srcs,
                v.dsts
            ].forEach((x) => walk(x, depth + 1));
        };
        walk(payload, 0);
        return out;
    }

    function __tmShouldIgnoreWsMainTaskRefreshMessage(msg) {
        const cmd = String(msg?.detail?.cmd || msg?.cmd || '').trim().toLowerCase();
        if (cmd && cmd !== 'transactions' && cmd !== 'savedoc') return true;
        if (cmd === 'savedoc') {
            const saveType = String(
                msg?.detail?.data?.type
                || msg?.data?.type
                || msg?.detail?.type
                || msg?.type
                || ''
            ).trim().toLowerCase();
            // SiYuan kernel pushes `savedoc(type=tx)` after transaction commit.
            // The task plugin already reacts to the preceding `transactions` event.
            // Some document-side edits only surface here, so keep loaded task scopes dirty
            // when the save payload points at the currently loaded document.
            if (!saveType || saveType === 'tx') {
                try {
                    if (__tmTxTargetsAffectLoadedScope(__tmCollectTxRefreshTargets(msg))) return false;
                } catch (e) {}
                return true;
            }
        }
        return false;
    }

    async function __tmResolveDocIdsFromBlockIds(blockIds) {
        const out = new Set();
        const list = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => __tmIsLikelyBlockId(id))));
        if (list.length === 0) return out;
        const batchSize = 200;
        for (let i = 0; i < list.length; i += batchSize) {
            const chunk = list.slice(i, i + batchSize);
            if (chunk.length === 0) continue;
            let rows = [];
            try {
                rows = await API.getBlocksByIds(chunk);
            } catch (e) {
                rows = [];
            }
            (Array.isArray(rows) ? rows : []).forEach((row) => {
                const docId = String(row?.root_id || '').trim();
                if (__tmIsLikelyBlockId(docId)) {
                    out.add(docId);
                    return;
                }
                const blockId = String(row?.id || '').trim();
                const type = String(row?.type || '').trim().toLowerCase();
                if (type === 'd' && __tmIsLikelyBlockId(blockId)) {
                    out.add(blockId);
                }
            });
        }
        return out;
    }

    function __tmRememberPendingTxRefreshTargets(docIds = [], blockIds = []) {
        (Array.isArray(docIds) ? docIds : []).forEach((docId) => {
            const did = String(docId || '').trim();
            if (did && __tmIsLikelyBlockId(did)) __tmTxTaskRefreshDocIds.add(did);
        });
        (Array.isArray(blockIds) ? blockIds : []).forEach((blockId) => {
            const bid = String(blockId || '').trim();
            if (bid && __tmIsLikelyBlockId(bid)) __tmTxTaskRefreshBlockIds.add(bid);
        });
    }

    function __tmCollectTxRefreshTargets(payload = null, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        let docIds = new Set();
        let blockIds = new Set();
        try { docIds = __tmExtractDocIdsFromTx(payload); } catch (e) { docIds = new Set(); }
        try { blockIds = __tmExtractBlockIdsFromTx(payload); } catch (e) { blockIds = new Set(); }
        (Array.isArray(opts.docIds) ? opts.docIds : []).forEach((docId) => {
            const did = String(docId || '').trim();
            if (did && __tmIsLikelyBlockId(did)) docIds.add(did);
        });
        (Array.isArray(opts.blockIds) ? opts.blockIds : []).forEach((blockId) => {
            const bid = String(blockId || '').trim();
            if (bid && __tmIsLikelyBlockId(bid)) blockIds.add(bid);
        });
        return { docIds, blockIds };
    }

    function __tmTxTargetsAffectLoadedScope(targets = {}) {
        const docIds = targets?.docIds instanceof Set ? targets.docIds : new Set(targets?.docIds || []);
        const blockIds = targets?.blockIds instanceof Set ? targets.blockIds : new Set(targets?.blockIds || []);
        const loadedDocIds = new Set(
            ((Array.isArray(state.__tmLoadedDocIdsForTasks) && state.__tmLoadedDocIdsForTasks.length > 0)
                ? state.__tmLoadedDocIdsForTasks
                : (Array.isArray(state.taskTree) ? state.taskTree.map((doc) => doc?.id) : []))
                .map((id) => String(id || '').trim())
                .filter((id) => __tmIsLikelyBlockId(id))
        );
        const activeDocId = String(state.activeDocId || '').trim();
        if (__tmIsLikelyBlockId(activeDocId)) loadedDocIds.add(activeDocId);
        for (const docId of docIds) {
            if (loadedDocIds.has(String(docId || '').trim())) return true;
        }
        for (const blockId of blockIds) {
            const bid = String(blockId || '').trim();
            if (loadedDocIds.has(bid)) return true;
            const task = state.flatTasks?.[bid];
            const taskDocId = String(task?.root_id || task?.docId || '').trim();
            if (taskDocId && loadedDocIds.has(taskDocId)) return true;
        }
        return false;
    }

    function __tmSnapshotPendingTxRefreshTargets() {
        return {
            docIds: Array.from(__tmTxTaskRefreshDocIds),
            blockIds: Array.from(__tmTxTaskRefreshBlockIds),
        };
    }

    function __tmClearPendingTxRefreshTargets(targets = null) {
        const next = (targets && typeof targets === 'object') ? targets : null;
        if (!next) {
            __tmTxTaskRefreshDocIds.clear();
            __tmTxTaskRefreshBlockIds.clear();
            return;
        }
        (Array.isArray(next.docIds) ? next.docIds : []).forEach((docId) => {
            const did = String(docId || '').trim();
            if (did) __tmTxTaskRefreshDocIds.delete(did);
        });
        (Array.isArray(next.blockIds) ? next.blockIds : []).forEach((blockId) => {
            const bid = String(blockId || '').trim();
            if (bid) __tmTxTaskRefreshBlockIds.delete(bid);
        });
    }

    async function __tmResolveIncrementalRefreshDocIds(docIds = [], blockIds = []) {
        const resolved = new Set(
            (Array.isArray(docIds) ? docIds : [])
                .map((id) => String(id || '').trim())
                .filter((id) => __tmIsLikelyBlockId(id))
        );
        const blockList = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => __tmIsLikelyBlockId(id))));
        if (blockList.length > 0) {
            try {
                const extraDocIds = await __tmResolveDocIdsFromBlockIds(blockList);
                extraDocIds.forEach((docId) => {
                    const did = String(docId || '').trim();
                    if (did && __tmIsLikelyBlockId(did)) resolved.add(did);
                });
            } catch (e) {}
        }
        const loadedDocIds = new Set(
            ((Array.isArray(state.__tmLoadedDocIdsForTasks) && state.__tmLoadedDocIdsForTasks.length > 0)
                ? state.__tmLoadedDocIdsForTasks
                : (Array.isArray(state.taskTree) ? state.taskTree.map((doc) => doc?.id) : []))
                .map((id) => String(id || '').trim())
                .filter((id) => __tmIsLikelyBlockId(id))
        );
        return Array.from(resolved).filter((docId) => loadedDocIds.has(docId));
    }

    function __tmFindLoadedTaskTreeSlot(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return null;
        const docs = Array.isArray(state.taskTree) ? state.taskTree : [];
        const walk = (list, doc) => {
            const items = Array.isArray(list) ? list : [];
            for (let i = 0; i < items.length; i += 1) {
                const task = items[i];
                if (!task || typeof task !== 'object') continue;
                if (String(task.id || '').trim() === tid) return { doc, list: items, index: i, task };
                const child = walk(task.children, doc);
                if (child) return child;
            }
            return null;
        };
        for (const doc of docs) {
            const found = walk(doc?.tasks, doc);
            if (found) return found;
        }
        return null;
    }

    async function __tmResolveLoadedTaskIdsFromBlockIds(blockIds, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const maxTasks = Math.max(1, Math.floor(Number(opts.maxTasks || 8) || 8));
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => __tmIsLikelyBlockId(id))));
        const out = [];
        const seen = new Set();
        let needsDocRefresh = false;
        const loadedDocIds = new Set(
            ((Array.isArray(state.__tmLoadedDocIdsForTasks) && state.__tmLoadedDocIdsForTasks.length > 0)
                ? state.__tmLoadedDocIdsForTasks
                : (Array.isArray(state.taskTree) ? state.taskTree.map((doc) => doc?.id) : []))
                .map((id) => String(id || '').trim())
                .filter((id) => __tmIsLikelyBlockId(id))
        );
        const pushTaskId = (taskId0) => {
            const taskId = String(taskId0 || '').trim();
            if (!__tmIsLikelyBlockId(taskId) || seen.has(taskId)) return;
            if (seen.size >= maxTasks) {
                needsDocRefresh = true;
                return;
            }
            const loadedTask = state.flatTasks?.[taskId] || null;
            if (!loadedTask) {
                needsDocRefresh = true;
                return;
            }
            seen.add(taskId);
            out.push(taskId);
        };
        for (const blockId of ids) {
            if (seen.size > maxTasks) {
                needsDocRefresh = true;
                break;
            }
            if (loadedDocIds.has(blockId)) continue;
            let localBinding = null;
            try { localBinding = __tmResolveLocalTaskBindingFromAnyBlockId(blockId); } catch (e) { localBinding = null; }
            const localTaskId = String(localBinding?.taskId || '').trim();
            if (localTaskId) {
                pushTaskId(localTaskId);
                continue;
            }
            let directRow = null;
            try { directRow = await API.getTaskById(blockId); } catch (e) { directRow = null; }
            if (directRow && typeof directRow === 'object') {
                const directTaskId = String(directRow.id || blockId).trim();
                if (state.flatTasks?.[directTaskId]) pushTaskId(directTaskId);
                else needsDocRefresh = true;
                continue;
            }
            let resolvedTaskId = '';
            try { resolvedTaskId = await __tmResolveTaskIdFromAnyBlockId(blockId); } catch (e) { resolvedTaskId = ''; }
            if (resolvedTaskId) {
                pushTaskId(resolvedTaskId);
            }
        }
        return {
            taskIds: out,
            needsDocRefresh: needsDocRefresh || out.length > maxTasks,
        };
    }

    function __tmApplyDoneOverrideToTaskIfPresent(task) {
        const target = (task && typeof task === 'object') ? task : null;
        if (!target) return false;
        const taskId = String(target.id || '').trim();
        if (!taskId || !state.doneOverrides || typeof state.doneOverrides !== 'object') return false;
        if (!Object.prototype.hasOwnProperty.call(state.doneOverrides, taskId)) return false;
        const nextDone = !!state.doneOverrides[taskId];
        target.done = nextDone;
        target.__tmDoneOverrideApplied = true;
        if (nextDone) {
            target.taskMarker = 'X';
            target.task_marker = 'X';
        } else if (__tmIsTaskMarkerDone(target.taskMarker || target.task_marker)) {
            target.taskMarker = ' ';
            target.task_marker = ' ';
        }
        return true;
    }

    function __tmPrepareTaskBlockIncrementalRow(row, prevTask, normalizeOptions) {
        const source = (row && typeof row === 'object') ? row : null;
        if (!source) return null;
        const task = { ...source };
        const taskId = String(task.id || '').trim();
        if (!taskId) return null;
        try {
            const parsed = API.parseTaskStatus(task.markdown);
            task.done = !!parsed.done;
            task.content = parsed.content;
            const parsedMarker = __tmNormalizeTaskStatusMarker(parsed?.marker, '');
            if (parsedMarker) {
                task.taskMarker = parsedMarker;
                task.task_marker = parsedMarker;
            }
        } catch (e) {}
        __tmApplyDoneOverrideToTaskIfPresent(task);
        try { __tmMergeVisibleDateFieldsFromPrevTask(task, prevTask); } catch (e) {}
        try { MetaStore.applyToTask(task); } catch (e) {}
        const docName = task.docName || task.doc_name || prevTask?.docName || prevTask?.doc_name || '未命名文档';
        try { normalizeTaskFields(task, docName, normalizeOptions); } catch (e) {}
        if (prevTask && typeof prevTask === 'object') {
            try { __tmCopyTaskHeadingContext(task, prevTask); } catch (e) {}
            const prevFlowRank = Number(prevTask.resolvedFlowRank ?? prevTask.resolved_flow_rank ?? prevTask.__tmResolvedFlowRank);
            if (Number.isFinite(prevFlowRank)) {
                task.resolvedFlowRank = prevFlowRank;
                task.resolved_flow_rank = prevFlowRank;
                task.__tmResolvedFlowRank = prevFlowRank;
            }
        } else {
            try { __tmApplyTaskHeadingContext(task, ''); } catch (e) {}
        }
        return task;
    }

    function __tmCanPatchTaskBlockIncrementally(prevTask, nextTask) {
        if (!prevTask || !nextTask) return false;
        const prevDocId = String(prevTask.root_id || prevTask.docId || '').trim();
        const nextDocId = String(nextTask.root_id || nextTask.docId || '').trim();
        if (!prevDocId || !nextDocId || prevDocId !== nextDocId) return false;
        const prevParentTaskId = String(prevTask.parentTaskId || prevTask.parent_task_id || '').trim();
        const nextParentTaskId = String(nextTask.parentTaskId || nextTask.parent_task_id || '').trim();
        if (prevParentTaskId !== nextParentTaskId) return false;
        const prevParentId = String(prevTask.parent_id || prevTask.parentId || '').trim();
        const nextParentId = String(nextTask.parent_id || nextTask.parentId || '').trim();
        if (prevParentId && nextParentId && prevParentId !== nextParentId) return false;
        const prevSort = String(prevTask.block_sort ?? prevTask.blockSort ?? prevTask.sort ?? '').trim();
        const nextSort = String(nextTask.block_sort ?? nextTask.blockSort ?? nextTask.sort ?? '').trim();
        if (prevSort && nextSort && prevSort !== nextSort) return false;
        return true;
    }

    function __tmPatchLoadedTaskBlockInPlace(taskId, nextTask) {
        const tid = String(taskId || '').trim();
        const slot = __tmFindLoadedTaskTreeSlot(tid);
        if (!slot || !slot.task || !nextTask) return '';
        const target = slot.task;
        const preservedChildren = Array.isArray(target.children) ? target.children : [];
        Object.keys(target).forEach((key) => {
            if (key !== 'children') {
                try { delete target[key]; } catch (e) {}
            }
        });
        Object.assign(target, nextTask);
        target.children = preservedChildren;
        if (!state.flatTasks || typeof state.flatTasks !== 'object') state.flatTasks = {};
        state.flatTasks[tid] = target;
        try { __tmRestoreTaskFlatMap(target); } catch (e) {}
        return String(slot.doc?.id || target.root_id || target.docId || '').trim();
    }

    function __tmNormalizeTaskBlockMarkdownWithoutMarker(markdown = '') {
        return String(markdown || '').replace(/^(\s*(?:[-*]|\d+\.)\s*)\[[^\]]\]/, '$1[ ]');
    }

    function __tmTaskBlockScalarValue(task, keys = []) {
        const source = (task && typeof task === 'object') ? task : {};
        for (const key of keys) {
            const value = source[key];
            if (value !== undefined && value !== null) return value;
        }
        return '';
    }

    function __tmTaskBlockStringValue(task, keys = []) {
        return String(__tmTaskBlockScalarValue(task, keys) ?? '').trim();
    }

    function __tmTaskBlockJsonValue(value) {
        try { return JSON.stringify(value ?? null); } catch (e) { return String(value ?? ''); }
    }

    function __tmBuildTaskBlockVisibleDomPatch(prevTask, nextTask) {
        const prev = (prevTask && typeof prevTask === 'object') ? prevTask : null;
        const next = (nextTask && typeof nextTask === 'object') ? nextTask : null;
        if (!prev || !next) return null;
        const prevContent = __tmTaskBlockStringValue(prev, ['content', 'raw_content']);
        const nextContent = __tmTaskBlockStringValue(next, ['content', 'raw_content']);
        const prevMarkdown = __tmNormalizeTaskBlockMarkdownWithoutMarker(prev.markdown || '');
        const nextMarkdown = __tmNormalizeTaskBlockMarkdownWithoutMarker(next.markdown || '');
        const structuralVisibleKeys = [
            ['repeatRule', 'repeat_rule'],
            ['repeatState', 'repeat_state'],
            ['repeatHistory', 'repeat_history'],
        ];
        for (const keys of structuralVisibleKeys) {
            if (__tmTaskBlockJsonValue(__tmTaskBlockScalarValue(prev, keys)) !== __tmTaskBlockJsonValue(__tmTaskBlockScalarValue(next, keys))) {
                return null;
            }
        }

        const patch = {};
        if (prevContent !== nextContent || prevMarkdown !== nextMarkdown) patch.content = nextContent;
        if (!!prev.done !== !!next.done) patch.done = !!next.done;
        const prevStatus = __tmTaskBlockStringValue(prev, ['customStatus', 'custom_status']);
        const nextStatus = __tmTaskBlockStringValue(next, ['customStatus', 'custom_status']);
        if (prevStatus !== nextStatus) patch.customStatus = nextStatus;
        const scalarFields = [
            ['priority', ['priority']],
            ['pinned', ['pinned']],
            ['startDate', ['startDate', 'start_date']],
            ['completionTime', ['completionTime', 'completion_time']],
            ['taskCompleteAt', ['taskCompleteAt', 'task_complete_at']],
            ['duration', ['duration']],
            ['customTime', ['customTime', 'custom_time']],
            ['remark', ['remark']],
        ];
        scalarFields.forEach(([field, keys]) => {
            const prevValue = __tmTaskBlockStringValue(prev, keys);
            const nextValue = __tmTaskBlockStringValue(next, keys);
            if (prevValue !== nextValue) patch[field] = nextValue;
        });
        try {
            const prevAttachments = __tmTaskBlockJsonValue(__tmGetTaskAttachmentPaths(prev));
            const nextAttachments = __tmTaskBlockJsonValue(__tmGetTaskAttachmentPaths(next));
            if (prevAttachments !== nextAttachments) patch.attachments = __tmGetTaskAttachmentPaths(next);
        } catch (e) {}
        return patch;
    }

    function __tmCanApplyTaskBlockDomPatch(taskId, patch = {}) {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const keys = Object.keys(nextPatch);
        if (!tid) return false;
        if (!keys.length) return true;
        if (typeof __tmRefreshTaskFieldsAcrossViews !== 'function') return false;
        const viewMode = String(state.viewMode || '').trim();
        if (viewMode === 'calendar') return false;
        const supportedByView = {
            list: new Set(['content', 'done', 'customStatus', 'priority', 'pinned', 'startDate', 'completionTime', 'taskCompleteAt', 'duration', 'customTime', 'remark', 'attachments']),
            checklist: new Set(['content', 'done', 'customStatus', 'priority', 'pinned', 'startDate', 'completionTime', 'taskCompleteAt', 'duration', 'customTime', 'remark', 'attachments']),
            timeline: new Set(['content', 'done', 'startDate', 'completionTime']),
            kanban: new Set(['content', 'done', 'customStatus', 'priority', 'startDate', 'completionTime', 'remark']),
            whiteboard: new Set(['content', 'done', 'startDate', 'completionTime']),
        };
        const supported = supportedByView[viewMode] || null;
        if (!supported || keys.some((key) => !supported.has(String(key || '').trim()))) return false;
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'done') && !__tmGetShowCompletedTasksFromSettings()) return false;
        if (viewMode === 'kanban' && (Object.prototype.hasOwnProperty.call(nextPatch, 'done') || Object.prototype.hasOwnProperty.call(nextPatch, 'customStatus'))) return false;
        try {
            if (typeof __tmDoesPatchNeedProjectionRefresh === 'function'
                && __tmDoesPatchNeedProjectionRefresh(tid, nextPatch, { withFilters: false })) return false;
        } catch (e) {
            return false;
        }
        return true;
    }

    function __tmApplyTaskBlockDomPatches(patches = [], reason = '') {
        if (!Array.isArray(patches) || patches.length === 0) return true;
        if (typeof __tmRefreshTaskFieldsAcrossViews !== 'function') return false;
        const sourceReason = String(reason || 'task-block-dom-patch').trim() || 'task-block-dom-patch';
        let hadEffectivePatch = false;
        let touchedAny = false;
        for (const item of patches) {
            const taskId = String(item?.taskId || '').trim();
            const patch = (item?.patch && typeof item.patch === 'object') ? item.patch : {};
            if (!__tmCanApplyTaskBlockDomPatch(taskId, patch)) return false;
        }
        patches.forEach((item) => {
            const taskId = String(item?.taskId || '').trim();
            const patch = (item?.patch && typeof item.patch === 'object') ? item.patch : {};
            if (!Object.keys(patch).length) return;
            hadEffectivePatch = true;
            try {
                const touched = __tmRefreshTaskFieldsAcrossViews(taskId, patch, {
                    withFilters: false,
                    reason: sourceReason,
                    forceProjectionRefresh: false,
                    fallback: false,
                    skipDetailPatch: true,
                });
                if (touched) touchedAny = true;
            } catch (e) {}
        });
        if (!hadEffectivePatch) return false;
        return touchedAny;
    }

    async function __tmRefreshAffectedTaskBlocksIncrementally(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const cfg = __tmGetPerfTuningOptions();
        if (!cfg.taskBlockIncrementalRefresh) return false;
        const viewMode = String(state.viewMode || '').trim();
        if (!state.modal || !document.body.contains(state.modal)) return false;
        if (viewMode === 'calendar') return false;
        try { await __tmFlushSqlTransactionsSafe('task-block-incremental-refresh'); } catch (e) {}
        const rawBlockIds = Array.isArray(opts.blockIds) ? opts.blockIds : [];
        const blockIds = Array.from(new Set(rawBlockIds
            .map((id) => String(id || '').trim())
            .filter((id) => __tmIsLikelyBlockId(id))));
        if (!blockIds.length) return false;
        const maxTasks = Math.max(1, Math.floor(Number(cfg.taskBlockIncrementalMaxTasks) || 8));
        if (blockIds.length > maxTasks * 4) return false;
        const resolved = await __tmResolveLoadedTaskIdsFromBlockIds(blockIds, { maxTasks });
        const taskIds = Array.isArray(resolved?.taskIds) ? resolved.taskIds : [];
        if (resolved?.needsDocRefresh || taskIds.length === 0 || taskIds.length > maxTasks) return false;
        const patches = [];
        const rule0 = state.currentRule ? state.filterRules.find((rule) => rule.id === state.currentRule) : null;
        const colOrder0 = Array.isArray(SettingsStore.data.columnOrder) ? SettingsStore.data.columnOrder : [];
        const customFieldLoadPlan0 = __tmCollectCustomFieldLoadPlan({
            viewMode,
            colOrder: colOrder0,
            rule: rule0,
        });
        const normalizeCustomFieldDefs = __tmGetCustomFieldDefs();
        const normalizeCustomFieldDefMap = new Map(normalizeCustomFieldDefs
            .map((field) => [String(field?.id || '').trim(), field])
            .filter(([fieldId]) => !!fieldId));
        const normalizeTaskOptions = {
            docDisplayNameCache: new Map(),
            docDisplayNameMode: String(__tmGetDocDisplayNameMode() || '').trim() || 'name',
            customFieldDefs: normalizeCustomFieldDefs,
            customFieldDefMap: normalizeCustomFieldDefMap,
            visibleDateFallbackTaskIds: __tmBuildVisibleDateFallbackTaskIdSet(),
            todayDateKey: __tmNormalizeDateOnly(new Date()),
        };
        for (const taskId of taskIds) {
            const slot = __tmFindLoadedTaskTreeSlot(taskId);
            const prevTask = slot?.task || state.flatTasks?.[taskId] || null;
            if (!slot || !prevTask) return false;
            let row = null;
            try { row = await API.getTaskById(taskId); } catch (e) { row = null; }
            if (!row || typeof row !== 'object') return false;
            const nextTask = __tmPrepareTaskBlockIncrementalRow(row, prevTask, normalizeTaskOptions);
            if (!nextTask || !__tmCanPatchTaskBlockIncrementally(prevTask, nextTask)) return false;
            const visiblePatch = __tmBuildTaskBlockVisibleDomPatch(prevTask, nextTask);
            if (visiblePatch === null) return false;
            patches.push({ taskId, nextTask, patch: visiblePatch });
        }
        if (!patches.length) return false;
        const changedDocIds = new Set();
        patches.forEach((patch) => {
            const docId = __tmPatchLoadedTaskBlockInPlace(patch.taskId, patch.nextTask);
            if (__tmIsLikelyBlockId(docId)) changedDocIds.add(docId);
        });
        if (!changedDocIds.size) return false;
        changedDocIds.forEach((docId) => {
            try { __tmInvalidateTasksQueryCacheByDocId(docId); } catch (e) {}
            try { __tmRebuildLocalDocTree(docId); } catch (e) {}
        });
        try { __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
        try { recalcStats(); } catch (e) {}
        state.deferredListCustomFieldIds = String(state.viewMode || '').trim() === 'list'
            ? customFieldLoadPlan0.deferredListFieldIds.slice()
            : [];
        const canPatchDomOnly = __tmApplyTaskBlockDomPatches(
            patches,
            String(opts.reason || 'task-block-incremental-refresh').trim() || 'task-block-incremental-refresh'
        );
        if (opts.withFilters !== false && !canPatchDomOnly) {
            try { applyFilters(); } catch (e) {}
            try {
                __tmScheduleDeferredVisibleListCustomFieldHydration({
                    delayMs: 120,
                    reason: String(opts.reason || 'task-block-incremental-refresh').trim() || 'task-block-incremental-refresh',
                    customFieldDefs: normalizeCustomFieldDefs,
                });
            } catch (e) {}
        }
        try {
            __tmSchedulePersistTaskIndex({
                docIds: Array.from(changedDocIds),
                queryLimit: __TM_TASK_INDEX_QUERY_LIMIT,
                delayMs: 250,
            });
        } catch (e) {}
        if (!canPatchDomOnly) {
            __tmRefreshMainViewInPlace({
                withFilters: false,
                reason: String(opts.reason || 'task-block-incremental-refresh').trim() || 'task-block-incremental-refresh',
                deferIfDetailBusy: opts.deferIfDetailBusy !== false,
            });
        }
        return true;
    }

    function __tmCountLoadedDocTasksForQueryLimit(docId) {
        const did = String(docId || '').trim();
        if (!did || !Array.isArray(state.taskTree)) return 0;
        const doc = state.taskTree.find((item) => String(item?.id || '').trim() === did);
        if (!doc || !Array.isArray(doc.tasks)) return 0;
        let count = 0;
        const stack = doc.tasks.slice();
        while (stack.length) {
            const task = stack.pop();
            count += 1;
            if (Array.isArray(task?.children) && task.children.length) {
                task.children.forEach((child) => stack.push(child));
            }
        }
        return count;
    }

    function __tmGetIncrementalTaskQueryLimit(docIds = []) {
        const hotLimit = Math.max(500, Math.min(__TM_TASK_INDEX_QUERY_LIMIT, Number(__TM_TASK_INCREMENTAL_QUERY_LIMIT) || 5000));
        const ids = Array.from(new Set((Array.isArray(docIds) ? docIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => __tmIsLikelyBlockId(id))));
        const hasLargeLoadedDoc = ids.some((docId) => __tmCountLoadedDocTasksForQueryLimit(docId) >= hotLimit);
        return hasLargeLoadedDoc ? __TM_TASK_INDEX_QUERY_LIMIT : hotLimit;
    }

    async function __tmRefreshAffectedDocsIncrementally(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const targets = {
            docIds: Array.isArray(opts.docIds) ? opts.docIds.slice() : [],
            blockIds: Array.isArray(opts.blockIds) ? opts.blockIds.slice() : [],
        };
        const viewMode = String(state.viewMode || '').trim();
        if (!state.modal || !document.body.contains(state.modal)) return false;
        if (viewMode === 'calendar') return false;
        try { await __tmFlushSqlTransactionsSafe('doc-incremental-refresh'); } catch (e) {}
        try {
            const taskBlockOk = await __tmRefreshAffectedTaskBlocksIncrementally(opts);
            if (taskBlockOk) return true;
        } catch (e) {}
        const docIds = await __tmResolveIncrementalRefreshDocIds(targets.docIds, targets.blockIds);
        if (!docIds.length) return false;
        if (docIds.length > 12) return false;
        docIds.forEach((docId) => {
            try { __tmInvalidateTasksQueryCacheByDocId(docId); } catch (e) {}
        });

        const queryLimit = __tmGetIncrementalTaskQueryLimit(docIds);
        const rule0 = state.currentRule ? state.filterRules.find((rule) => rule.id === state.currentRule) : null;
        const normalizedRuleSorts0 = __tmGetNormalizedRuleSorts(rule0);
        const isUngroup = !state.groupByDocName && !state.groupByTaskName && !state.groupByTime && !state.quadrantEnabled;
        const ruleNeedsFlowRank = normalizedRuleSorts0.some((item) => String(item?.field || '').trim() === 'docSeq');
        const needFlowRank = !!ruleNeedsFlowRank || (!__tmRuleHasExplicitSort(rule0) && (!!state.groupByDocName || isUngroup || !!state.groupByTaskName || !!state.groupByTime || !!state.quadrantEnabled));
        const colOrder0 = Array.isArray(SettingsStore.data.columnOrder) ? SettingsStore.data.columnOrder : [];
        const docHeadingSubgroupActive = !!state.groupByDocName && SettingsStore.data.docH2SubgroupEnabled !== false;
        const kanbanHeadingGroupingActive = !!SettingsStore.data.kanbanHeadingGroupMode;
        const needH2 = colOrder0.includes('h2')
            || normalizedRuleSorts0.some((item) => String(item?.field || '').trim() === 'h2')
            || docHeadingSubgroupActive
            || kanbanHeadingGroupingActive;
        const customFieldLoadPlan0 = __tmCollectCustomFieldLoadPlan({
            viewMode,
            colOrder: colOrder0,
            rule: rule0,
        });
        const res = await API.getTasksByDocuments(docIds, queryLimit, {
            doneOnly: false,
            forceFresh: true,
            // parent list 子任务首次增量刷新时必须直接带回真实 parent_task_id，
            // 否则后面的前端兜底只补一层，容易把父任务先挂错再来回跳。
            skipParentTaskJoin: false,
            skipDocJoin: true,
            customFieldIds: customFieldLoadPlan0.bulkFieldIds,
        });
        const rows = Array.isArray(res?.tasks) ? res.tasks.slice() : [];
        const enhanceTargets0 = __tmCollectTaskEnhanceTargets(rows);
        const taskIds0 = enhanceTargets0.taskIds;
        const taskDocMap0 = enhanceTargets0.taskDocMap;
        let h2ContextMap = new Map();
        let taskFlowRankMap = new Map();
        if ((needH2 || needFlowRank) && taskIds0.length > 0) {
            try {
                const bundle = await API.fetchTaskEnhanceBundle(taskIds0, {
                    taskDocMap: taskDocMap0,
                    needH2,
                    needFlow: needFlowRank,
                });
                h2ContextMap = bundle?.h2ContextMap instanceof Map ? bundle.h2ContextMap : new Map();
                taskFlowRankMap = bundle?.taskFlowRankMap instanceof Map ? bundle.taskFlowRankMap : new Map();
            } catch (e) {
                h2ContextMap = new Map();
                taskFlowRankMap = new Map();
            }
        }

        const tasksByDoc = new Map();
        const nextFlatTasksByDoc = new Map();
        const allDocuments = Array.isArray(state.allDocuments) ? state.allDocuments : [];
        const normalizeDocDisplayNameCache = new Map();
        const normalizeCustomFieldDefs = __tmGetCustomFieldDefs();
        const normalizeCustomFieldDefMap = new Map(normalizeCustomFieldDefs
            .map((field) => [String(field?.id || '').trim(), field])
            .filter(([fieldId]) => !!fieldId));
        const visibleDateFallbackTaskIds = __tmBuildVisibleDateFallbackTaskIdSet();
        const normalizeTaskOptions = {
            docDisplayNameCache: normalizeDocDisplayNameCache,
            docDisplayNameMode: String(__tmGetDocDisplayNameMode() || '').trim() || 'name',
            customFieldDefs: normalizeCustomFieldDefs,
            customFieldDefMap: normalizeCustomFieldDefMap,
            visibleDateFallbackTaskIds,
            todayDateKey: __tmNormalizeDateOnly(new Date()),
        };
        rows.forEach((task) => {
            if (!task || !task.root_id) return;
            const taskId = String(task.id || '').trim();
            const prevTask = taskId ? (state.flatTasks?.[taskId] || null) : null;
            const flowRank = Number(taskFlowRankMap.get(taskId));
            __tmApplyResolvedFlowRankIfNeeded(task, flowRank);

            const parsed = API.parseTaskStatus(task.markdown);
            task.done = !!parsed.done;
            task.content = parsed.content;
            const parsedMarker = __tmNormalizeTaskStatusMarker(parsed?.marker, '');
            if (parsedMarker) {
                task.taskMarker = parsedMarker;
                task.task_marker = parsedMarker;
            }
            __tmMergeVisibleDateFieldsFromPrevTask(task, prevTask);
            __tmApplyDoneOverrideToTaskIfPresent(task);

            const docName = task.docName || task.doc_name || '未命名文档';
            normalizeTaskFields(task, docName, normalizeTaskOptions);

            const h2ctx = taskId ? h2ContextMap.get(taskId) : null;
            if (h2ctx) {
                __tmApplyTaskHeadingContext(task, h2ctx);
            } else if (prevTask && typeof prevTask === 'object') {
                __tmCopyTaskHeadingContext(task, prevTask);
            } else {
                __tmApplyTaskHeadingContext(task, '');
            }

            if (!tasksByDoc.has(task.root_id)) tasksByDoc.set(task.root_id, []);
            tasksByDoc.get(task.root_id).push(task);
            if (!nextFlatTasksByDoc.has(task.root_id)) nextFlatTasksByDoc.set(task.root_id, []);
            nextFlatTasksByDoc.get(task.root_id).push(task);

            const repeatHistory = Array.isArray(task.repeatHistory) ? task.repeatHistory : [];
            if (repeatHistory.length > 0) {
                repeatHistory.forEach((historyItem, historyIndex) => {
                    const virtualTask = __tmBuildRecurringInstanceTask(task, historyItem, historyIndex);
                    if (!virtualTask?.id) return;
                    if (!tasksByDoc.has(virtualTask.root_id)) tasksByDoc.set(virtualTask.root_id, []);
                    tasksByDoc.get(virtualTask.root_id).push(virtualTask);
                    if (!nextFlatTasksByDoc.has(virtualTask.root_id)) nextFlatTasksByDoc.set(virtualTask.root_id, []);
                    nextFlatTasksByDoc.get(virtualTask.root_id).push(virtualTask);
                });
            }
        });

        const quickAddDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        let siblingOrderRanks = new Map();
        try {
            siblingOrderRanks = await __tmResolveTaskSiblingOrderRanks(tasksByDoc);
        } catch (e) {
            siblingOrderRanks = new Map();
        }
        for (const docId of docIds) {
            const rawTasks = tasksByDoc.get(docId) || [];
            const existingDoc = state.taskTree.find((doc) => doc.id === docId) || null;
            const cachedDoc = allDocuments.find((doc) => doc.id === docId) || null;
            let rootTasks = [];
            try {
                const parentLinkResolved = await __tmResolveDocTaskParentLinks(rawTasks, {
                    docId,
                    source: 'incremental-doc-refresh',
                });
                rootTasks = Array.isArray(parentLinkResolved?.rootTasks)
                    ? parentLinkResolved.rootTasks
                    : [];
            } catch (e) {
                rootTasks = Array.isArray(rawTasks) ? rawTasks.slice() : [];
            }
            const calcLevel = (tasks, level) => {
                (Array.isArray(tasks) ? tasks : []).forEach((task) => {
                    task.level = level;
                    if (Array.isArray(task.children) && task.children.length > 0) {
                        calcLevel(task.children, level + 1);
                    }
                });
            };
            const preferResolvedFlowOrder = __tmShouldUseResolvedFlowRankForDoc(docId)
                && rawTasks.some((task) => taskFlowRankMap.has(String(task?.id || '').trim()));
            if (preferResolvedFlowOrder) __tmSortTaskTreeByDocFlow(rootTasks);
            else __tmSortTaskTreeBySiblingRankMap(rootTasks, siblingOrderRanks);
            calcLevel(rootTasks, 0);
            __tmAssignDocSeqByTree(rootTasks, 0);

            const nextDoc = {
                id: docId,
                name: String(cachedDoc?.name || existingDoc?.name || rawTasks?.[0]?.docName || '未命名文档').trim() || '未命名文档',
                alias: __tmNormalizeDocAliasValue(cachedDoc?.alias || existingDoc?.alias),
                icon: __tmNormalizeDocIconValue(cachedDoc?.icon || existingDoc?.icon),
                created: String(cachedDoc?.created || existingDoc?.created || '').trim(),
                tasks: rootTasks,
            };
            const existingIndex = state.taskTree.findIndex((doc) => doc.id === docId);
            const shouldKeepDoc = rawTasks.length > 0 || !!existingDoc || (quickAddDocId && quickAddDocId === docId);
            if (existingIndex >= 0) {
                if (shouldKeepDoc) state.taskTree[existingIndex] = nextDoc;
                else state.taskTree.splice(existingIndex, 1);
            } else if (shouldKeepDoc) {
                state.taskTree.push(nextDoc);
            }
        }
        try {
            state.taskTree = __tmSortDocEntriesByPinned(
                state.taskTree || [],
                String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all'
            );
        } catch (e) {}
        __tmInvalidateFilteredTaskDerivedStateCache();

        docIds.forEach((docId) => {
            Object.keys(state.flatTasks || {}).forEach((taskId) => {
                const task = state.flatTasks?.[taskId];
                const rootId = String(task?.root_id || task?.docId || '').trim();
                if (rootId === docId) delete state.flatTasks[taskId];
            });
            (nextFlatTasksByDoc.get(docId) || []).forEach((task) => {
                state.flatTasks[task.id] = task;
            });
        });
        state.flatTasks = __tmMergeOtherBlocksIntoFlatTasks(state.flatTasks);
        state.stats.queryTime = Number(res?.queryTime) || 0;
        recalcStats();
        try {
            __tmSchedulePersistTaskIndex({
                docIds,
                queryLimit,
                delayMs: 300,
            });
        } catch (e) {}
        if (opts.withFilters !== false) applyFilters();
        state.deferredListCustomFieldIds = String(state.viewMode || '').trim() === 'list'
            ? customFieldLoadPlan0.deferredListFieldIds.slice()
            : [];
        if (opts.withFilters !== false) {
            try {
                __tmScheduleDeferredVisibleListCustomFieldHydration({
                    delayMs: 180,
                    reason: String(opts.reason || 'incremental-doc-refresh').trim() || 'incremental-doc-refresh',
                    customFieldDefs: normalizeCustomFieldDefs,
                });
            } catch (e) {}
        }
        __tmRefreshMainViewInPlace({
            withFilters: false,
            reason: String(opts.reason || 'incremental-doc-refresh').trim() || 'incremental-doc-refresh',
            deferIfDetailBusy: opts.deferIfDetailBusy !== false,
        });
        return true;
    }

    async function __tmFlushSqlTransactionsSafe(reason = '') {
        try {
            const res = await API.call('/api/sqlite/flushTransaction', {});
            if (res && res.code !== 0) {
                try { console.warn('[task-horizon] flushTransaction failed', reason || 'unknown', res?.msg || res); } catch (e) {}
                return false;
            }
            // Give the attributes query a brief moment to observe the flushed rows.
            await new Promise((resolve) => setTimeout(resolve, 40));
            return true;
        } catch (e) {
            try { console.warn('[task-horizon] flushTransaction error', reason || 'unknown', e); } catch (err) {}
            return false;
        }
    }

    async function __tmBuildInjectedTasksByDocFromBlockIds(blockIds) {
        const out = new Map();
        const list = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => __tmIsLikelyBlockId(id))));
        if (list.length === 0) return out;

        const taskIdSourceMap = new Map();
        for (const blockId of list) {
            let taskId = '';
            try { taskId = await __tmResolveTaskIdFromAnyBlockId(blockId); } catch (e) { taskId = ''; }
            const resolvedId = String(taskId || blockId || '').trim();
            if (__tmIsLikelyBlockId(resolvedId) && !taskIdSourceMap.has(resolvedId)) {
                taskIdSourceMap.set(resolvedId, blockId);
            }
        }
        const taskIds = Array.from(taskIdSourceMap.keys());
        if (taskIds.length === 0) return out;

        const rows = await Promise.all(taskIds.map(async (taskId) => {
            let row = null;
            try { row = await API.getTaskById(taskId); } catch (e) { row = null; }
            if (!row) {
                try { row = await __tmBuildTaskLikeFromBlockId(taskId); } catch (e) { row = null; }
            }
            if (!row) {
                const sourceId = String(taskIdSourceMap.get(taskId) || '').trim();
                if (sourceId && sourceId !== taskId) {
                    try { row = await __tmBuildTaskLikeFromBlockId(sourceId); } catch (e) { row = null; }
                }
            }
            return row;
        }));

        rows.forEach((row) => {
            if (!row || typeof row !== 'object') return;
            const docId = String(row.root_id || row.docId || '').trim();
            const taskId = String(row.id || '').trim();
            if (!__tmIsLikelyBlockId(docId) || !__tmIsLikelyBlockId(taskId)) return;
            if (!out.has(docId)) out.set(docId, []);
            const list0 = out.get(docId);
            if (!list0.find((item) => String(item?.id || '').trim() === taskId)) {
                list0.push(row);
            }
        });

        return out;
    }

    function __tmSchedulePersistTaskSnapshot(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const groupIdForLog = String(opts.groupId || SettingsStore?.data?.currentGroupId || 'all').trim() || 'all';
        const activeDocIdForLog = String(opts.activeDocId || state?.activeDocId || 'all').trim() || 'all';
        if (opts.forceFullLoadBudget === true) {
            __tmLogTaskSnapshot('save-skip', {
                reason: 'force-full-load-budget',
                groupId: groupIdForLog,
            });
            return false;
        }
        const docIds = __tmNormalizeTaskSnapshotDocIds(opts.docIds || state.__tmLoadedDocIdsForTasks || []);
        if (!docIds.length) {
            __tmLogTaskSnapshot('save-skip', {
                reason: 'empty-docs',
                groupId: groupIdForLog,
            });
            return false;
        }
        if (!Array.isArray(state.taskTree) || state.taskTree.length === 0) {
            __tmLogTaskSnapshot('save-skip', {
                reason: 'empty-task-tree',
                groupId: groupIdForLog,
                docCount: docIds.length,
            });
            return false;
        }
        try {
            const flatTasks = __tmBuildFlatTasksFromTaskSnapshotTree(state.taskTree);
            const taskCount = Object.keys(flatTasks).length;
            const coverage = __tmGetTaskCountCoverageStatus(docIds, taskCount, opts);
            if (!coverage.ok) {
                __tmLogTaskSnapshot('save-skip', {
                    reason: coverage.reason,
                    groupId: groupIdForLog,
                    docCount: docIds.length,
                    taskCount: coverage.actual,
                    expectedTaskCount: coverage.expected,
                    overageTolerance: coverage.overageTolerance,
                });
                return false;
            }
        } catch (e) {}
        if (state.__tmCacheFirstPaintNeedsVerify && opts.allowCacheFirstPaintPersist !== true) {
            __tmLogTaskSnapshot('save-skip', {
                reason: 'cache-first-paint-needs-verify',
                groupId: groupIdForLog,
                docCount: docIds.length,
            });
            return false;
        }
        try {
            if (__tmTaskSnapshotSaveTimer) clearTimeout(__tmTaskSnapshotSaveTimer);
        } catch (e) {}
        const delayMs = Math.max(200, Number(opts.delayMs || 900) || 900);
        const scheduledGroupId = groupIdForLog;
        const scheduledDocKey = docIds.join(',');
        const scheduledActiveDocId = activeDocIdForLog;
        const scheduledOpenToken = Number(state.openToken) || 0;
        __tmLogTaskSnapshot('save-scheduled', {
            groupId: groupIdForLog,
            docCount: docIds.length,
            delayMs,
        });
        __tmTaskSnapshotSaveTimer = setTimeout(() => {
            __tmTaskSnapshotSaveTimer = null;
            const runSave = () => {
                if (__tmTaskSnapshotSaveInFlight) {
                    __tmLogTaskSnapshot('save-rescheduled', {
                        reason: 'in-flight',
                        groupId: groupIdForLog,
                        docCount: docIds.length,
                    });
                    __tmSchedulePersistTaskSnapshot({ ...opts, delayMs: 1200 });
                    return;
                }
                __tmTaskSnapshotSaveInFlight = true;
                Promise.resolve()
                    .then(async () => {
                    const currentGroupId = String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all';
                    const currentActiveDocId = String(state?.activeDocId || 'all').trim() || 'all';
                    const currentLoadedDocKey = __tmNormalizeTaskSnapshotDocIds(state.__tmLoadedDocIdsForTasks || []).join(',');
                    const currentTreeDocIds = __tmNormalizeTaskSnapshotDocIds((Array.isArray(state.taskTree) ? state.taskTree : [])
                        .map((doc) => doc?.id));
                    const scheduledDocSet = new Set(docIds);
                    const hasUnexpectedTreeDoc = currentTreeDocIds.some((docId) => !scheduledDocSet.has(docId));
                    if (currentGroupId !== scheduledGroupId
                        || currentActiveDocId !== scheduledActiveDocId
                        || (currentLoadedDocKey && currentLoadedDocKey !== scheduledDocKey)
                        || hasUnexpectedTreeDoc) {
                        __tmLogTaskSnapshot('save-skip', {
                            reason: 'stale-state',
                            groupId: scheduledGroupId,
                            currentGroupId,
                            currentActiveDocId,
                            docCount: docIds.length,
                            currentLoadedDocCount: currentLoadedDocKey ? currentLoadedDocKey.split(',').filter(Boolean).length : 0,
                            currentTreeDocCount: currentTreeDocIds.length,
                            unexpectedTreeDocCount: hasUnexpectedTreeDoc
                                ? currentTreeDocIds.filter((docId) => !scheduledDocSet.has(docId)).length
                                : 0,
                            scheduledOpenToken,
                            currentOpenToken: Number(state.openToken) || 0,
                        });
                        return;
                    }
                    let payload = __tmBuildTaskSnapshotPayload({
                        docIds,
                        groupId: scheduledGroupId,
                        activeDocId: scheduledActiveDocId,
                        queryLimit: opts.queryLimit || __TM_TASK_INDEX_QUERY_LIMIT,
                    });
                    const rawStore = await __tmReadJsonFile(TASK_SNAPSHOT_FILE_PATH);
                    const store = __tmBuildTaskSnapshotStore(rawStore);
                    payload = __tmAttachTaskSnapshotViewState(payload, {
                        groupId: payload?.groupId || scheduledGroupId,
                        previousSnapshot: store?.snapshots?.[payload?.scopeKey],
                    }) || payload;
                    const payloadFlatTasks = __tmBuildFlatTasksFromTaskSnapshotTree(Array.isArray(payload?.taskTree) ? payload.taskTree : []);
                    const payloadCoverage = __tmGetTaskCountCoverageStatus(payload?.docIds || docIds, Object.keys(payloadFlatTasks).length, opts);
                    if (!payloadCoverage.ok) {
                        __tmLogTaskSnapshot('save-skip', {
                            reason: payloadCoverage.reason,
                            groupId: String(payload?.groupId || groupIdForLog).trim() || 'all',
                            docCount: Array.isArray(payload?.docIds) ? payload.docIds.length : docIds.length,
                            taskDocCount: Array.isArray(payload?.taskTree) ? payload.taskTree.length : 0,
                            otherBlockCount: Array.isArray(payload?.otherBlocks) ? payload.otherBlocks.length : 0,
                            taskCount: payloadCoverage.actual,
                            expectedTaskCount: payloadCoverage.expected,
                            overageTolerance: payloadCoverage.overageTolerance,
                        });
                        return;
                    }
                    const persistSignature = __tmBuildTaskSnapshotPersistSignature(payload);
                    const prevPersistSignature = String(__tmTaskSnapshotPersistSignatureCache.get(payload?.scopeKey) || '').trim();
                    if (persistSignature && prevPersistSignature && persistSignature === prevPersistSignature) {
                        __tmLogTaskSnapshot('save-skip', {
                            reason: 'unchanged-signature',
                            groupId: String(payload?.groupId || groupIdForLog).trim() || 'all',
                            docCount: Array.isArray(payload?.docIds) ? payload.docIds.length : docIds.length,
                            taskDocCount: Array.isArray(payload?.taskTree) ? payload.taskTree.length : 0,
                            otherBlockCount: Array.isArray(payload?.otherBlocks) ? payload.otherBlocks.length : 0,
                            hasViewState: payload?.viewState ? 1 : 0,
                            viewStatesCount: payload?.viewStates && typeof payload.viewStates === 'object'
                                ? Object.keys(payload.viewStates).length
                                : 0,
                        });
                        return;
                    }
                    const pooledPayloadPreview = __tmBuildTaskSnapshotRecordForStore(payload, {
                        docs: {},
                        otherBlockSets: {},
                    });
                    const payloadBytes = __tmEstimateJsonByteSize(pooledPayloadPreview || payload);
                    if (payloadBytes > __TM_TASK_SNAPSHOT_MAX_SINGLE_BYTES) {
                        __tmLogTaskSnapshot('save-skip', {
                            reason: 'payload-too-large',
                            groupId: String(payload?.groupId || groupIdForLog).trim() || 'all',
                            docCount: Array.isArray(payload?.docIds) ? payload.docIds.length : docIds.length,
                            taskDocCount: Array.isArray(payload?.taskTree) ? payload.taskTree.length : 0,
                            otherBlockCount: Array.isArray(payload?.otherBlocks) ? payload.otherBlocks.length : 0,
                            bytes: payloadBytes,
                            maxBytes: __TM_TASK_SNAPSHOT_MAX_SINGLE_BYTES,
                        });
                        try {
                            __tmTaskSnapshotStoreCache = store;
                            await __tmWriteJsonFile(TASK_SNAPSHOT_FILE_PATH, store);
                        } catch (e) {}
                        return;
                    }
                    store.snapshots[payload.scopeKey] = payload;
                    store.updatedAt = Date.now();
                    const nextStore = __tmBuildTaskSnapshotStore(store);
                    __tmTaskSnapshotStoreCache = nextStore;
                    await __tmWriteJsonFile(TASK_SNAPSHOT_FILE_PATH, nextStore);
                    if (persistSignature) {
                        try { __tmTaskSnapshotPersistSignatureCache.set(payload.scopeKey, persistSignature); } catch (e) {}
                    }
                    __tmLogTaskSnapshot('save-done', {
                        groupId: String(payload?.groupId || groupIdForLog).trim() || 'all',
                        docCount: Array.isArray(payload?.docIds) ? payload.docIds.length : docIds.length,
                        taskDocCount: Array.isArray(payload?.taskTree) ? payload.taskTree.length : 0,
                        otherBlockCount: Array.isArray(payload?.otherBlocks) ? payload.otherBlocks.length : 0,
                        bytes: payloadBytes,
                        hasViewState: payload?.viewState ? 1 : 0,
                        viewStatesCount: payload?.viewStates && typeof payload.viewStates === 'object'
                            ? Object.keys(payload.viewStates).length
                            : 0,
                        storeEntryCount: Object.keys(nextStore?.snapshots || {}).length,
                        storeBytes: __tmEstimateJsonByteSize(nextStore),
                        pooledDocCount: Object.keys(nextStore?.docs || {}).length,
                        pooledOtherBlockSetCount: Object.keys(nextStore?.otherBlockSets || {}).length,
                        dataMode: String(nextStore?.snapshots?.[payload.scopeKey]?.dataMode || ''),
                        maxEntries: __TM_TASK_SNAPSHOT_MAX_ENTRIES,
                    });
                    })
                    .catch((e) => {
                    __tmLogTaskSnapshot('save-error', {
                        groupId: groupIdForLog,
                        error: String(e?.message || e || '').trim() || 'save-failed',
                    });
                    })
                    .finally(() => {
                    __tmTaskSnapshotSaveInFlight = false;
                    });
            };
            try { __tmScheduleIdleTask(runSave, Math.max(900, Math.round(delayMs))); } catch (e) { setTimeout(runSave, 0); }
        }, delayMs);
        return true;
    }

    function __tmScheduleBatchedTaskIncrementalRefreshFromTx(payload, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const targets = __tmCollectTxRefreshTargets(payload, opts);
        if ((!targets.docIds || targets.docIds.size === 0) && (!targets.blockIds || targets.blockIds.size === 0)) return false;
        if (!__tmWsTaskTxBatch) {
            __tmWsTaskTxBatch = {
                docIds: new Set(),
                blockIds: new Set(),
                delayMs: 80,
                source: 'ws-main-batch',
                forceImmediate: false,
            };
        }
        targets.docIds.forEach((docId) => __tmWsTaskTxBatch.docIds.add(docId));
        targets.blockIds.forEach((blockId) => __tmWsTaskTxBatch.blockIds.add(blockId));
        const nextDelayMs = (opts.forceImmediate === true || opts.force === true)
            ? 0
            : Math.max(0, Number(opts.delayMs ?? 80) || 80);
        __tmWsTaskTxBatch.delayMs = Math.min(Number(__tmWsTaskTxBatch.delayMs ?? 80), nextDelayMs);
        __tmWsTaskTxBatch.forceImmediate = __tmWsTaskTxBatch.forceImmediate || opts.forceImmediate === true || opts.force === true;
        const source = String(opts.source || '').trim();
        if (source) __tmWsTaskTxBatch.source = source;
        if (__tmWsTaskTxBatchTimer) return true;
        const flushDelayMs = Math.max(0, Number(opts.flushDelayMs ?? 16) || 16);
        __tmWsTaskTxBatchTimer = setTimeout(() => {
            __tmWsTaskTxBatchTimer = null;
            const batch = __tmWsTaskTxBatch;
            __tmWsTaskTxBatch = null;
            if (!batch) return;
            __tmScheduleTaskIncrementalRefreshFromTx(null, {
                docIds: Array.from(batch.docIds || []),
                blockIds: Array.from(batch.blockIds || []),
                delayMs: Number(batch.delayMs ?? 0),
                source: String(batch.source || 'ws-main-batch').trim() || 'ws-main-batch',
                forceImmediate: batch.forceImmediate === true,
            });
        }, flushDelayMs);
        return true;
    }

    function __tmScheduleTaskIncrementalRefreshFromTx(payload, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const { docIds, blockIds } = __tmCollectTxRefreshTargets(payload, opts);
        if ((!docIds || docIds.size === 0) && (!blockIds || blockIds.size === 0)) return;
        __tmRememberPendingTxRefreshTargets(Array.from(docIds || []), Array.from(blockIds || []));
        __tmMarkExternalTaskTxDirty();
        try {
            if (__tmTxTaskRefreshTimer) clearTimeout(__tmTxTaskRefreshTimer);
        } catch (e) {}
        const delayMs = (opts.forceImmediate === true || opts.force === true)
            ? 0
            : Math.max(0, Number(opts.delayMs ?? 280) || 280);
        const flushOptions = {
            source: String(opts.source || 'ws-main').trim() || 'ws-main',
            forceImmediate: opts.forceImmediate === true || opts.force === true,
            force: opts.force === true,
            ignoreContextQuiet: opts.ignoreContextQuiet === true,
            bypassThrottle: opts.bypassThrottle === true,
        };
        __tmTxTaskRefreshTimer = setTimeout(() => {
            __tmTxTaskRefreshTimer = null;
            __tmFlushTaskIncrementalRefreshFromTx(flushOptions).catch(() => {});
        }, delayMs);
    }

    async function __tmFlushTaskIncrementalRefreshFromTx(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const sourceLabel = String(opts.source || 'ws-main').trim() || 'ws-main';
        const forceImmediate = opts.force === true || opts.forceImmediate === true;
        const retryOptions = {
            ignoreContextQuiet: opts.ignoreContextQuiet === true || forceImmediate,
            bypassThrottle: opts.bypassThrottle === true || forceImmediate,
        };
        if (__tmTxTaskRefreshInFlight) {
            try {
                if (__tmTxTaskRefreshTimer) clearTimeout(__tmTxTaskRefreshTimer);
            } catch (e) {}
            __tmTxTaskRefreshTimer = setTimeout(() => {
                __tmTxTaskRefreshTimer = null;
                __tmFlushTaskIncrementalRefreshFromTx(opts).catch(() => {});
            }, forceImmediate ? 80 : 220);
            return;
        }

        const pendingTargets = __tmSnapshotPendingTxRefreshTargets();
        const pendingDocIds = pendingTargets.docIds;
        const pendingBlockIds = pendingTargets.blockIds;
        if (!state.externalTaskTxDirty && pendingDocIds.length === 0 && pendingBlockIds.length === 0) return;
        const retryMeta0 = __tmGetTxRefreshRetryMeta(sourceLabel, retryOptions);
        if (!retryMeta0.allowRun) {
            if (retryMeta0.parkUntilScrollIdle) {
                try { __tmScheduleDeferredRefreshAfterScroll('ws-main'); } catch (e) {}
                return;
            }
            if (!retryMeta0.parkUntilVisible) {
                try {
                    if (__tmTxTaskRefreshTimer) clearTimeout(__tmTxTaskRefreshTimer);
                } catch (e) {}
                __tmTxTaskRefreshTimer = setTimeout(() => {
                    __tmTxTaskRefreshTimer = null;
                    __tmFlushTaskIncrementalRefreshFromTx(opts).catch(() => {});
                }, Math.max(180, Number(retryMeta0.waitMs || 0) || 180));
            }
            return;
        }

        __tmTxTaskRefreshInFlight = true;
        try {
            await __tmRunAutoRefreshIfNeeded(sourceLabel, {
                affectedDocIds: pendingDocIds,
                affectedBlockIds: pendingBlockIds,
                force: forceImmediate,
                ignoreContextQuiet: retryOptions.ignoreContextQuiet,
                bypassThrottle: retryOptions.bypassThrottle,
            });
        } finally {
            __tmTxTaskRefreshInFlight = false;
            if (state.externalTaskTxDirty) {
                const retryMeta = __tmGetTxRefreshRetryMeta(sourceLabel, retryOptions);
                if (!retryMeta.allowRun && retryMeta.parkUntilVisible) {
                    return;
                }
                if (!retryMeta.allowRun && retryMeta.parkUntilScrollIdle) {
                    try { __tmScheduleDeferredRefreshAfterScroll('ws-main'); } catch (e) {}
                    return;
                }
                try {
                    if (__tmTxTaskRefreshTimer) clearTimeout(__tmTxTaskRefreshTimer);
                } catch (e) {}
                const retryDelayMs = !retryMeta.allowRun
                    ? Math.max(180, Number(retryMeta.waitMs || 0) || 180)
                    : (forceImmediate ? 120 : 400);
                __tmTxTaskRefreshTimer = setTimeout(() => {
                    __tmTxTaskRefreshTimer = null;
                    __tmFlushTaskIncrementalRefreshFromTx(opts).catch(() => {});
                }, retryDelayMs);
            }
            try { __tmFlushDeferredViewRefreshAfterTaskFieldWork('ws-main:end'); } catch (e) {}
        }
    }

    function __tmRequestCalendarRefresh(detail = {}, fallbackOptions = {}) {
        const calApi = globalThis.__tmCalendar;
        if (!calApi) return false;
        try {
            if (typeof calApi.requestRefresh === 'function') {
                calApi.requestRefresh(detail);
                return true;
            }
            if (typeof calApi.refreshInPlace === 'function') {
                calApi.refreshInPlace({
                    hard: detail?.hard === true || fallbackOptions?.hard === true,
                    layoutOnly: detail?.layoutOnly === true || fallbackOptions?.layoutOnly === true,
                });
                return true;
            }
        } catch (e) {}
        return false;
    }

    function __tmScheduleCalendarRefetchFromTx() {
        try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
        __tmCalendarTxRefreshPending = true;
        const calApi = globalThis.__tmCalendar;
        if (!calApi || (typeof calApi.requestRefresh !== 'function' && typeof calApi.refreshInPlace !== 'function')) {
            __tmCalendarTxRefreshPending = false;
            return;
        }
        try { if (__tmCalendarTxRefreshTimer) clearTimeout(__tmCalendarTxRefreshTimer); } catch (e) {}
        const arm = (delayMs, reason = '') => {
            __tmCalendarTxRefreshTimer = setTimeout(() => {
                __tmCalendarTxRefreshTimer = null;
                const gateMeta = __tmGetBackgroundRefreshGateMeta('calendar-tx');
                if (!gateMeta.allowRun) {
                    if (gateMeta.parkUntilScrollIdle) {
                        try { __tmScheduleDeferredRefreshAfterScroll('calendar-tx'); } catch (e) {}
                        return;
                    }
                    if (!gateMeta.parkUntilVisible) {
                        arm(Math.max(180, Number(gateMeta.waitMs || 0) || 180), gateMeta.reason || reason || 'deferred');
                    }
                    return;
                }
                __tmCalendarTxRefreshPending = false;
                try {
                    
                    __tmRequestCalendarRefresh({
                        reason: 'task-tx-refresh',
                        main: true,
                        side: true,
                        flushTaskPanel: true,
                        hard: false,
                    }, { hard: false });
                } catch (e) {}
            }, Math.max(120, Number(delayMs || 0) || 120));
        };
        const gateMeta = __tmGetBackgroundRefreshGateMeta('calendar-tx');
        if (!gateMeta.allowRun) {
            if (gateMeta.parkUntilScrollIdle) {
                try { __tmScheduleDeferredRefreshAfterScroll('calendar-tx'); } catch (e) {}
                return;
            }
            if (!gateMeta.parkUntilVisible) {
                arm(Math.max(180, Number(gateMeta.waitMs || 0) || 180), gateMeta.reason || 'deferred');
            }
            return;
        }
        arm(250, '');
    }

    function __tmBindSqlCacheInvalidation() {
        if (__tmSqlCacheInvalidationBound) return;
        __tmSqlCacheInvalidationBound = true;
        __tmSqlCacheInvalidationHandler = (ev) => {
            const docId = String(ev?.detail?.docId || '').trim();
            if (docId) __tmInvalidateTasksQueryCacheByDocId(docId);
            else __tmInvalidateAllSqlCaches();
        };
        try { window.addEventListener('tm:sql-cache-invalidate', __tmSqlCacheInvalidationHandler); } catch (e) {}
        try {
            const seen = new Set();
            const buses = (globalThis.__tmHost?.getEventBuses?.() || []).map((eb, index) => ({
                label: `host-${index}`,
                eb,
            }));
            __tmSqlCacheEventBuses = [];
            __tmSqlCacheEventBusHandler = (msg) => {
                const cmd = String(msg?.detail?.cmd || msg?.cmd || '').trim().toLowerCase();
                if (__tmShouldIgnoreWsMainTaskRefreshMessage(msg)) {
                    return;
                }
                const txTargets = __tmCollectTxRefreshTargets(msg);
                const docIds = txTargets.docIds;
                const blockIds = txTargets.blockIds;
                const hasTxTargets = (docIds && docIds.size > 0) || (blockIds && blockIds.size > 0);
                const suppressLocalTimeTx = __tmShouldSuppressLocalTimeTx(msg);
                const suppressLocalDoneTx = !suppressLocalTimeTx && __tmShouldSuppressLocalDoneTx(msg);
                const suppressLocalMoveTx = !suppressLocalTimeTx && !suppressLocalDoneTx && __tmShouldSuppressLocalMoveTx(msg);
                let txAttrApplyResult = {
                    totalUpdates: 0,
                    applied: false,
                    appliedCount: 0,
                    resolvedAppliedCount: 0,
                    unresolvedCount: 0,
                    noopCount: 0,
                    skippedCount: 0,
                };
                let isAttrOnlyTx = false;
                let skipNoopAttrOnlyTx = false;
                let txAttrUpdates = [];
                if (!suppressLocalTimeTx && !suppressLocalDoneTx && !suppressLocalMoveTx) {
                    let txAttrApplyFailed = false;
                    try {
                        isAttrOnlyTx = __tmHasOnlyAttrOperationsInTx(msg);
                    } catch (e) {
                        isAttrOnlyTx = false;
                    }
                    try {
                        txAttrUpdates = __tmExtractAttrUpdatesFromTx(msg);
                    } catch (e) {
                        txAttrUpdates = [];
                    }
                    try {
                        txAttrApplyResult = __tmApplyTxAttrUpdatesInState(msg) || txAttrApplyResult;
                    } catch (e) {
                        txAttrApplyFailed = true;
                    }
                    const attrOnlyWithUnparsedTargets = isAttrOnlyTx && txAttrUpdates.length === 0 && hasTxTargets;
                    skipNoopAttrOnlyTx = !attrOnlyWithUnparsedTargets
                        && !txAttrApplyFailed
                        && Number(txAttrApplyResult.appliedCount || 0) === 0
                        && Number(txAttrApplyResult.resolvedAppliedCount || 0) === 0
                        && Number(txAttrApplyResult.unresolvedCount || 0) === 0
                        && isAttrOnlyTx
                        && (
                            Number(txAttrApplyResult.totalUpdates || 0) <= 0
                            || (
                                Number(txAttrApplyResult.noopCount || 0) + Number(txAttrApplyResult.skippedCount || 0)
                            ) >= Number(txAttrApplyResult.totalUpdates || 0)
                        );
                    if (!skipNoopAttrOnlyTx) {
                        __tmMarkExternalTaskTxDirty();
                    }
                }
                if (docIds && docIds.size > 0) docIds.forEach((d) => __tmInvalidateTasksQueryCacheByDocId(d));
                else __tmInvalidateAllSqlCaches();
                if (suppressLocalTimeTx || suppressLocalDoneTx || suppressLocalMoveTx) {
                    if (suppressLocalDoneTx || suppressLocalMoveTx) {
                        try {
                            __tmRememberPendingTxRefreshTargets(Array.from(docIds || []), Array.from(blockIds || []));
                            if (typeof __tmIsPluginVisibleNow !== 'function' || !__tmIsPluginVisibleNow()) __tmMarkExternalTaskTxDirty();
                        } catch (e) {}
                    }
                    return;
                }
                if (skipNoopAttrOnlyTx) return;
                const fastAttrOnlyRefresh = __tmIsFastAttrOnlyRefreshEligible(txAttrUpdates, txAttrApplyResult, isAttrOnlyTx);
                if (fastAttrOnlyRefresh) {
                    const skipCalendarTxRefresh = __tmShouldSkipCalendarTxRefreshForTimeEdit(msg);
                    if (!skipCalendarTxRefresh) {
                        __tmScheduleCalendarRefetchFromTx();
                    }
                    if (typeof __tmIsPluginVisibleNow === 'function' && __tmIsPluginVisibleNow()) {
                        try { __tmClearExternalTaskTxDirty(); } catch (e) { try { state.externalTaskTxDirty = false; } catch (e2) {} }
                    } else {
                        try {
                            __tmRememberPendingTxRefreshTargets(
                                Array.from(docIds || []),
                                txAttrUpdates.map((update) => update?.taskId)
                            );
                            __tmMarkExternalTaskTxDirty();
                        } catch (e) {}
                    }
                    try {
                        __tmSchedulePersistTaskSnapshot({
                            docIds: state.__tmLoadedDocIdsForTasks,
                            groupId: SettingsStore?.data?.currentGroupId || 'all',
                            queryLimit: __TM_TASK_INDEX_QUERY_LIMIT,
                            delayMs: 1800,
                        });
                    } catch (e) {}
                    return;
                }
                __tmScheduleBatchedTaskIncrementalRefreshFromTx(msg, {
                    blockIds: txAttrUpdates.map((update) => update?.taskId),
                    delayMs: 80,
                    flushDelayMs: 16,
                    source: 'ws-main-batch',
                });
                const skipCalendarTxRefresh = __tmShouldSkipCalendarTxRefreshForTimeEdit(msg);
                if (!skipCalendarTxRefresh) {
                    __tmScheduleCalendarRefetchFromTx();
                }
            };
            buses.forEach(({ label, eb }) => {
                if (!eb || typeof eb.on !== 'function') return;
                if (seen.has(eb)) return;
                seen.add(eb);
                try {
                    eb.on('ws-main', __tmSqlCacheEventBusHandler);
                    __tmSqlCacheEventBuses.push(eb);
                } catch (e) {}
            });
        } catch (e) {}
    }

