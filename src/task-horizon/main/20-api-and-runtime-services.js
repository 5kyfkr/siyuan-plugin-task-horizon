    const API = {
        // ... 原有的API方法保持不变 ...
        async call(url, body) {
            try {
                const isSql = String(url || '').trim() === '/api/query/sql';
                if (isSql && __tmSqlQueue && typeof __tmIsMobileDevice === 'function') {
                    __tmSqlQueue.max = 3; // 统一使用3并发
                }
                const stmtKey = isSql ? String(body?.stmt || '').trim() : '';
                const inFlightKey = isSql ? (stmtKey || '') : '';
                if (inFlightKey && __tmSqlInFlight.has(inFlightKey)) {
                    return await __tmSqlInFlight.get(inFlightKey);
                }
                const doFetch = async () => {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const text = await res.text();
                    let data;
                    try {
                        data = text ? JSON.parse(text) : {};
                    } catch (e) {
                        return { code: -1, msg: `HTTP ${res.status}` };
                    }
                    if (!res.ok && (data == null || typeof data !== 'object' || typeof data.code === 'undefined')) {
                        return { code: -1, msg: `HTTP ${res.status}` };
                    }
                    return data;
                };
                if (isSql) {
                    const p = __tmRunSqlQueued(doFetch);
                    if (inFlightKey) __tmSqlInFlight.set(inFlightKey, p);
                    try {
                        return await p;
                    } finally {
                        if (inFlightKey) __tmSqlInFlight.delete(inFlightKey);
                    }
                }
                return await doFetch();
            } catch (err) {
                return { code: -1, msg: err.message };
            }
        },

        async lsNotebooks() {
            const res = await this.call('/api/notebook/lsNotebooks', {});
            const notebooks = res?.data?.notebooks;
            return Array.isArray(notebooks) ? notebooks : [];
        },

        async createDocWithMd(notebook, path, markdown) {
            const res = await this.call('/api/filetree/createDocWithMd', { notebook, path, markdown });
            if (res.code !== 0) throw new Error(res.msg || '创建文档失败');
            return res.data;
        },

        async createDailyNote(notebook) {
            const box = String(notebook || '').trim();
            if (!box) throw new Error('未指定笔记本');
            const res = await this.call('/api/filetree/createDailyNote', { notebook: box });
            if (res.code !== 0) throw new Error(res.msg || '创建日记失败');
            const data = res.data;
            if (typeof data === 'string') return data;
            if (data && typeof data === 'object') {
                const id = data.id || data.ID || data.docId || data.docID || data.docid;
                if (id) return id;
            }
            throw new Error('创建日记失败');
        },

        async getDocNotebook(docId) {
            const id = String(docId || '').trim();
            if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(id)) return '';
            const sql = `SELECT box FROM blocks WHERE id = '${id.replace(/'/g, "''")}' AND type = 'd' LIMIT 1`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && Array.isArray(res.data) && res.data.length > 0) {
                return String(res.data[0]?.box || '').trim();
            }
            return '';
        },

        async getSubDocIds(docId, options = null) {
            try {
                const did = String(docId || '').trim();
                if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(did)) return [];
                const recursiveDocLimit = Number.isFinite(Number(SettingsStore.data?.recursiveDocLimit)) ? Math.max(1, Math.min(500000, Math.round(Number(SettingsStore.data.recursiveDocLimit)))) : 2000;
                const limitRaw = Number(options?.limit);
                const totalLimit = Number.isFinite(limitRaw)
                    ? Math.max(0, Math.min(500000, Math.round(limitRaw)))
                    : recursiveDocLimit;
                // 先获取根文档的 path
                const pathSql = `SELECT hpath FROM blocks WHERE id = '${did.replace(/'/g, "''")}' AND type = 'd' LIMIT 1`;
                const pathRes = await this.call('/api/query/sql', { stmt: pathSql });
                if (pathRes.code !== 0 || !pathRes.data || pathRes.data.length === 0) return [];

                const hpath = String(pathRes.data[0].hpath || '');

                // 查询子文档
                const limitSql = totalLimit > 0 ? ` LIMIT ${totalLimit}` : '';
                const sql = `SELECT id FROM blocks WHERE hpath LIKE '${hpath.replace(/'/g, "''")}/%' AND type = 'd' ORDER BY created DESC, hpath DESC${limitSql}`;
                const res = await this.call('/api/query/sql', { stmt: sql });
                if (res.code === 0 && res.data) {
                    return res.data.map(d => d.id);
                }
            } catch (e) {
            }
            return [];
        },

        async getNotebookDocuments(notebookId, options = null) {
            const box = String(notebookId || '').trim();
            if (!box) return [];
            try {
                const recursiveDocLimit = Number.isFinite(Number(SettingsStore.data?.recursiveDocLimit)) ? Math.max(1, Math.min(500000, Math.round(Number(SettingsStore.data.recursiveDocLimit)))) : 2000;
                const limitRaw = Number(options?.limit);
                const totalLimit = Number.isFinite(limitRaw)
                    ? Math.max(0, Math.min(500000, Math.round(limitRaw)))
                    : recursiveDocLimit;
                const limitSql = totalLimit > 0 ? ` LIMIT ${totalLimit}` : '';
                const sql = `SELECT id, content, hpath FROM blocks WHERE box = '${box.replace(/'/g, "''")}' AND type = 'd' ORDER BY created DESC, hpath DESC${limitSql}`;
                const res = await this.call('/api/query/sql', { stmt: sql });
                if (res.code === 0 && Array.isArray(res.data)) {
                    return res.data.map((row) => ({
                        id: String(row?.id || '').trim(),
                        name: String(row?.content || '').trim() || '未命名文档',
                        path: String(row?.hpath || '').trim()
                    })).filter((row) => row.id);
                }
            } catch (e) {}
            return [];
        },

        async getBlockKramdown(id) {
            const res = await this.call('/api/block/getBlockKramdown', { id });
            if (res.code !== 0) throw new Error(res.msg || '获取块内容失败');
            const data = res.data;
            if (typeof data === 'string') return data;
            return data?.kramdown || data?.content || '';
        },

        async getBlockDOM(id) {
            const res = await this.call('/api/block/getBlockDOM', { id });
            if (res.code !== 0) throw new Error(res.msg || '获取块DOM失败');
            const data = res.data;
            if (typeof data === 'string') return data;
            return data?.dom || data?.content || '';
        },

        async getDocEnhanceSnapshot(docId, headingLevel = 'h2', options = {}) {
            const did = String(docId || '').trim();
            if (!did) return { flowRankMap: new Map(), headingContextMap: new Map() };
            const opts = (options && typeof options === 'object') ? options : {};
            const needH2Snapshot = opts.needH2 !== false;
            const needFlowSnapshot = opts.needFlow !== false;
            const lvRaw = String(headingLevel || 'h2').trim().toLowerCase();
            const lvNum0 = Number((lvRaw.match(/^h([1-6])$/) || [])[1]);
            const lvNum = Number.isFinite(lvNum0) ? lvNum0 : 2;
            const cacheKey = `${did}:${lvRaw}:${needH2Snapshot ? 1 : 0}:${needFlowSnapshot ? 1 : 0}`;
            const now = Date.now();
            const ttlMs = 30000;
            const cached = __tmDocEnhanceSnapshotCache.get(cacheKey);
            if (cached && cached.snapshot && (now - Number(cached.t || 0)) < ttlMs) {
                return cached.snapshot;
            }
            if (cached && cached.promise) {
                try { return await cached.promise; } catch (e) {}
            }
            const promise = Promise.resolve().then(async () => {
                let km = '';
                if (needH2Snapshot) {
                    try { km = await this.getBlockKramdown(did); } catch (e) { km = ''; }
                }
                const flowRankMap = new Map();
                const headingContextMap = new Map();
                const parseDomTaskFlowRanks = (html) => {
                    const out = new Map();
                    const sourceHtml = String(html || '');
                    if (!sourceHtml) return out;
                    let host = null;
                    try {
                        if (typeof DOMParser !== 'undefined') {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(`<div data-tm-dom-host="1">${sourceHtml}</div>`, 'text/html');
                            host = doc.body?.firstElementChild || null;
                        }
                    } catch (e) {
                        host = null;
                    }
                    if (!host && typeof document !== 'undefined' && document?.createElement) {
                        try {
                            const fallbackHost = document.createElement('div');
                            fallbackHost.innerHTML = sourceHtml;
                            host = fallbackHost;
                        } catch (e) {
                            host = null;
                        }
                    }
                    const isElementLike = (el) => !!el && typeof el.getAttribute === 'function';
                    const isTaskItem = (el) => isElementLike(el)
                        && String(el.getAttribute('data-type') || '').trim() === 'NodeListItem'
                        && (String(el.getAttribute('data-subtype') || '').trim() === 't' || el.hasAttribute?.('data-task'));
                    let rank = 0;
                    const walk = (el) => {
                        if (!isElementLike(el)) return;
                        if (isTaskItem(el)) {
                            const tid = String(el.getAttribute('data-node-id') || '').trim();
                            if (tid && !out.has(tid)) {
                                rank += 1;
                                out.set(tid, rank);
                            }
                        }
                        Array.from(el.children || []).forEach(walk);
                    };
                    walk(host);
                    return out;
                };
                const applyDomFlowRanks = async () => {
                    let dom = '';
                    try { dom = String(await this.getBlockDOM(did) || ''); } catch (e) { dom = ''; }
                    const domFlowRanks = parseDomTaskFlowRanks(dom);
                    if (domFlowRanks.size <= 0) return false;
                    flowRankMap.clear();
                    domFlowRanks.forEach((rank, taskId) => {
                        flowRankMap.set(taskId, rank);
                    });
                    return true;
                };
                const lines = km ? String(km).split(/\r?\n/) : [];
                const parseIds = (line) => {
                    const out = [];
                    const s = String(line || '');
                    const re = /\bid=(?:"([^"]+)"|'([^']+)')/g;
                    let m;
                    while ((m = re.exec(s)) !== null) {
                        const id = String(m[1] || m[2] || '').trim();
                        if (id) out.push(id);
                    }
                    return out;
                };
                const stripHeadingText = (line) => {
                    return __tmNormalizeHeadingText(line);
                };
                const applyHeadingToStack = (stack, heading) => {
                    const level = Number(heading?.level);
                    if (!Number.isFinite(level) || level < 1 || level > 6) return;
                    for (let i = level; i <= 6; i += 1) stack[i] = null;
                    stack[level] = heading;
                };
                let flowRank = 0;
                let headingRank = -1;
                const headingStack = Array(7).fill(null);
                let pendingHeading = null;
                const emptyIds = [];
                for (let ln = 0; ln < lines.length; ln += 1) {
                    const line = String(lines[ln] || '');
                    const hm = line.charCodeAt(0) === 35 ? line.match(/^(#{1,6})\s+(.*)$/) : null;
                    if (hm) {
                        pendingHeading = {
                            level: Number(hm[1].length),
                            text: stripHeadingText(line),
                            expires: ln + 4,
                        };
                    }
                    const ids = line.indexOf('id=') >= 0 ? parseIds(line) : emptyIds;
                    if (pendingHeading && ids.length > 0) {
                        headingRank += 1;
                        const resolvedHeading = {
                            id: String(ids[0] || '').trim(),
                            content: String(pendingHeading.text || '').trim(),
                            level: Number(pendingHeading.level),
                            rank: headingRank,
                        };
                        applyHeadingToStack(headingStack, resolvedHeading);
                        pendingHeading = null;
                    }
                    if (pendingHeading && ln > Number(pendingHeading.expires || 0)) {
                        pendingHeading = null;
                    }
                    if (!ids.length) continue;
                    ids.forEach((bid) => {
                        const tid = String(bid || '').trim();
                        if (!tid) return;
                        if (needFlowSnapshot && !flowRankMap.has(tid)) {
                            flowRank += 1;
                            flowRankMap.set(tid, flowRank);
                        }
                        if (needH2Snapshot) {
                            const currentHeading = headingStack[lvNum];
                            headingContextMap.set(tid, {
                                id: String(currentHeading?.id || '').trim(),
                                content: String(currentHeading?.content || '').trim(),
                                path: '',
                                sort: Number.NaN,
                                created: '',
                                rank: Number(currentHeading?.rank),
                            });
                        }
                    });
                }
                if (needFlowSnapshot) await applyDomFlowRanks();
                const snapshot = { flowRankMap, headingContextMap };
                __tmDocEnhanceSnapshotCache.set(cacheKey, { t: Date.now(), snapshot });
                return snapshot;
            });
            __tmDocEnhanceSnapshotCache.set(cacheKey, { t: now, promise });
            try {
                return await promise;
            } catch (e) {
                __tmDocEnhanceSnapshotCache.delete(cacheKey);
                return { flowRankMap: new Map(), headingContextMap: new Map() };
            }
        },

        async fetchTaskEnhanceBundle(taskIds, options = {}) {
            const ids = Array.from(new Set((taskIds || []).map(x => String(x || '').trim()).filter(Boolean))).sort();
            const needH2 = options?.needH2 !== false;
            const needFlow = options?.needFlow !== false;
            if (!ids.length || (!needH2 && !needFlow)) {
                return {
                    h2ContextMap: new Map(),
                    taskFlowRankMap: new Map(),
                    meta: {
                        cacheHit: 0,
                        docCount: 0,
                        docConcurrency: 0,
                        taskDocMapMs: 0,
                        snapshotMs: 0,
                        fallbackFlowMs: 0,
                        fallbackH2Ms: 0,
                        fallbackH2RecoveredCount: 0,
                        missingFlowCount: 0,
                        missingH2Count: 0,
                    },
                };
            }
            const headingLevel = String(SettingsStore.data.taskHeadingLevel || 'h2');
            const cacheKey = `enhance_bundle:${ids.length}:${__tmHashIds(ids)}:${headingLevel}:${needH2 ? 1 : 0}:${needFlow ? 1 : 0}`;
            const cached = __tmGetAuxCache(cacheKey, 5000);
            if (cached && cached.h2 && cached.flow) {
                return {
                    h2ContextMap: new Map(cached.h2),
                    taskFlowRankMap: new Map(cached.flow),
                    meta: {
                        cacheHit: 1,
                        docCount: 0,
                        docConcurrency: 0,
                        taskDocMapMs: 0,
                        snapshotMs: 0,
                        fallbackFlowMs: 0,
                        fallbackH2Ms: 0,
                        fallbackH2RecoveredCount: 0,
                        missingFlowCount: 0,
                        missingH2Count: 0,
                    },
                };
            }
            const h2ContextMap = new Map();
            const taskFlowRankMap = new Map();
            const tasksByDoc = new Map();
            const perfMeta = {
                cacheHit: 0,
                docCount: 0,
                docConcurrency: 0,
                taskDocMapMs: 0,
                snapshotMs: 0,
                fallbackFlowMs: 0,
                fallbackH2Ms: 0,
                fallbackH2RecoveredCount: 0,
                missingFlowCount: 0,
                missingH2Count: 0,
            };
            const providedTaskDocMap = options?.taskDocMap instanceof Map ? options.taskDocMap : null;
            let perfMark = __tmPerfNow();
            const taskDocMap = providedTaskDocMap || await __tmBuildTaskDocMap(ids);
            perfMeta.taskDocMapMs = __tmRoundPerfMs(__tmPerfNow() - perfMark);
            taskDocMap.forEach((docId, tid) => {
                const did = String(docId || '').trim();
                const taskId = String(tid || '').trim();
                if (!did || !taskId) return;
                if (!tasksByDoc.has(did)) tasksByDoc.set(did, new Set());
                tasksByDoc.get(did).add(taskId);
            });
            const docEntries = Array.from(tasksByDoc.entries());
            perfMeta.docCount = docEntries.length;
            const perfTuning = __tmGetPerfTuningOptions();
            const docConcurrency = docEntries.length > 0
                ? Math.max(1, Math.min(docEntries.length, Number(perfTuning.docEnhanceFetchConcurrency) || 6))
                : 0;
            perfMeta.docConcurrency = docConcurrency;
            perfMark = __tmPerfNow();
            if (docConcurrency > 0) {
                let cursor = 0;
                const workers = Array.from({ length: docConcurrency }, async () => {
                    while (true) {
                        const index = cursor;
                        cursor += 1;
                        if (index >= docEntries.length) return;
                        const [docId, tidSet] = docEntries[index];
                        let snapshot = null;
                        try { snapshot = await this.getDocEnhanceSnapshot(docId, headingLevel, { needH2, needFlow }); } catch (e) { snapshot = null; }
                        if (!snapshot) continue;
                        tidSet.forEach((tid) => {
                            if (needFlow) {
                                const rk = Number(snapshot.flowRankMap?.get(tid));
                                if (Number.isFinite(rk)) taskFlowRankMap.set(tid, rk);
                            }
                            if (needH2) {
                                const ctx = snapshot.headingContextMap?.get(tid);
                                if (ctx && typeof ctx === 'object') h2ContextMap.set(tid, ctx);
                            }
                        });
                    }
                });
                await Promise.all(workers);
            }
            perfMeta.snapshotMs = __tmRoundPerfMs(__tmPerfNow() - perfMark);
            if (needFlow) {
                const missingFlowIds = ids.filter((id) => !taskFlowRankMap.has(id));
                perfMeta.missingFlowCount = missingFlowIds.length;
                if (missingFlowIds.length > 0) {
                    perfMark = __tmPerfNow();
                    try {
                        const fallbackFlow = await this.fetchTaskFlowRanksLegacy(missingFlowIds);
                        fallbackFlow.forEach((rank, taskId) => {
                            const tid = String(taskId || '').trim();
                            const rk = Number(rank);
                            if (!tid || !Number.isFinite(rk) || taskFlowRankMap.has(tid)) return;
                            taskFlowRankMap.set(tid, rk);
                        });
                    } catch (e) {}
                    perfMeta.fallbackFlowMs = __tmRoundPerfMs(__tmPerfNow() - perfMark);
                }
            }
            if (needH2) {
                const missingH2Ids = ids.filter((id) => !h2ContextMap.has(id));
                perfMeta.missingH2Count = missingH2Ids.length;
                if (missingH2Ids.length > 0) {
                    perfMark = __tmPerfNow();
                    try {
                        const fallbackH2 = await this.fetchH2ContextsLegacy(missingH2Ids, {
                            taskDocMap,
                            skipHeadingOrderFetch: true,
                            skipKramdownRealign: false,
                        });
                        perfMeta.fallbackH2RecoveredCount = fallbackH2 instanceof Map ? fallbackH2.size : 0;
                        fallbackH2.forEach((ctx, taskId) => {
                            const tid = String(taskId || '').trim();
                            if (!tid || h2ContextMap.has(tid)) return;
                            h2ContextMap.set(tid, ctx);
                        });
                    } catch (e) {}
                    perfMeta.fallbackH2Ms = __tmRoundPerfMs(__tmPerfNow() - perfMark);
                }
            }
            __tmSetAuxCache(cacheKey, {
                h2: Array.from(h2ContextMap.entries()),
                flow: Array.from(taskFlowRankMap.entries())
            });
            return { h2ContextMap, taskFlowRankMap, meta: perfMeta };
        },

        async fetchHeadingOrderByDocs(docIds, headingLevel = 'h2') {
            const ids = Array.from(new Set((docIds || []).map(x => String(x || '').trim()).filter(Boolean)));
            const out = new Map();
            if (ids.length === 0) return out;
            const lvRaw = String(headingLevel || 'h2').trim().toLowerCase();
            const lvNum0 = Number((lvRaw.match(/^h([1-6])$/) || [])[1]);
            const lvNum = Number.isFinite(lvNum0) ? lvNum0 : 2;
            const parseId = (line) => {
                const s = String(line || '');
                const m = s.match(/\{\:\s*[^}]*\bid="([^"]+)"/);
                return m ? String(m[1] || '').trim() : '';
            };
            for (const docId of ids) {
                let km = '';
                try { km = await this.getBlockKramdown(docId); } catch (e) { km = ''; }
                if (!km) continue;
                const lines = String(km).split(/\r?\n/);
                let rank = 0;
                const seen = new Set();
                for (let i = 0; i < lines.length; i++) {
                    const line = String(lines[i] || '');
                    const hm = line.match(/^(#{1,6})\s+/);
                    if (!hm || hm[1].length !== lvNum) continue;
                    let hid = parseId(line);
                    if (!hid) {
                        for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
                            hid = parseId(lines[j]);
                            if (hid) break;
                        }
                    }
                    if (!hid || seen.has(hid)) continue;
                    seen.add(hid);
                    out.set(`${docId}::${hid}`, rank++);
                }
            }
            __tmSetAuxCache(cacheKey, Array.from(out.entries()));
            return out;
        },

        async getDocId() {
            try {
                const m = location.hash.match(/id=([0-9a-z-]+)/);
                if (m) return m[1];
            } catch(e) {
            }
            return null;
        },

        extractTaskContentLine(markdown) {
            const text = String(markdown || '');
            const newlineIndex = text.indexOf('\n');
            const firstLine = (newlineIndex >= 0 ? text.slice(0, newlineIndex) : text).trim();
            return firstLine.replace(/^\s*(?:[\*\-]|\d+\.)\s*\[[^\]]\]\s*/, '').trim();
        },

        shouldUseRichTaskContentParse(content) {
            const text = String(content || '').trim();
            if (!text) return false;
            return text.includes('<')
                || text.includes('{:')
                || text.includes('[[')
                || text.includes('((')
                || text.includes('](');
        },

        getTaskContentSegments(content) {
            let text = String(content || '').trim();
            if (!text) return [];
            if (!this.shouldUseRichTaskContentParse(text)) {
                const plain = text.replace(/\s+/g, ' ').trim();
                return plain ? [{ text: plain, linked: false }] : [];
            }
            text = text.replace(/<span[^>]*>[\s\S]*?<\/span>/gi, '');
            text = text.replace(/\{\:\s*[^}]*\}/g, '');
            text = text.replace(/<[^>]+>/g, '');
            const pattern = /\(\(([0-9]{14}-[A-Za-z0-9]+)(?:\s+(['"])([\s\S]*?)\2)?\)\)|\[\[([^\]]+)\]\]|\[([^\]]+)\]\((?:[^)(]+|\([^)]*\))*\)/g;
            const segments = [];
            let lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    segments.push({ text: text.slice(lastIndex, match.index), linked: false });
                }
                const label = String(match[3] || match[4] || match[5] || '').trim();
                if (label) segments.push({ text: label, linked: true });
                lastIndex = pattern.lastIndex;
            }
            if (lastIndex < text.length) {
                segments.push({ text: text.slice(lastIndex), linked: false });
            }
            const normalized = [];
            for (const seg of segments) {
                const segText = String(seg?.text || '').replace(/\s+/g, ' ');
                if (!segText) continue;
                const prev = normalized[normalized.length - 1];
                if (prev && prev.linked === !!seg.linked) {
                    prev.text += segText;
                } else {
                    normalized.push({ text: segText, linked: !!seg.linked });
                }
            }
            return normalized;
        },

        normalizeTaskContent(content) {
            const text = String(content || '').trim();
            if (!text) return '';
            if (!this.shouldUseRichTaskContentParse(text)) {
                return text.replace(/\s{2,}/g, ' ').trim();
            }
            return this.getTaskContentSegments(text).map(seg => seg.text).join('').replace(/\s{2,}/g, ' ').trim();
        },

        hasLinkedTaskContent(content) {
            return this.getTaskContentSegments(content).some(seg => seg.linked);
        },

        renderTaskContentHtml(markdown, fallback = '') {
            const source = this.extractTaskContentLine(markdown || fallback);
            const cached = __tmTaskContentHtmlCache.get(source);
            if (cached !== undefined) return cached;
            const segments = this.getTaskContentSegments(source);
            if (!segments.length) {
                const plain = this.normalizeTaskContent(source || fallback) || '(无内容)';
                const html = esc(plain);
                __tmRememberTaskContentHtml(source, html);
                return html;
            }
            const html = segments.map((seg) => {
                const text = esc(seg.text);
                return seg.linked ? `<span class="tm-linked-text">${text}</span>` : text;
            }).join('');
            __tmRememberTaskContentHtml(source, html);
            return html;
        },

        parseTaskStatus(markdown) {
            if (!markdown) return { done: false, marker: ' ', firstLine: '', content: '' };

            const text = String(markdown || '');
            const cached = __tmTaskStatusParseCache.get(text);
            if (cached && typeof cached === 'object') return cached;
            const newlineIndex = text.indexOf('\n');
            const firstLine = (newlineIndex >= 0 ? text.slice(0, newlineIndex) : text).trim();
            const markerMatch = /^\s*(?:[\*\-]|\d+\.)\s*\[([^\]])\]/.exec(firstLine);
            const marker = __tmNormalizeTaskStatusMarker(markerMatch?.[1], ' ');

            const done = __tmIsTaskMarkerDone(marker);

            const content = this.normalizeTaskContent(firstLine.replace(/^\s*(?:[\*\-]|\d+\.)\s*\[[^\]]\]\s*/, '').trim());

            return __tmRememberTaskStatusParse(text, { done, marker, firstLine, content });
        },

        async getAllDocuments() {
            try {
                const queryLimit = Number.isFinite(Number(SettingsStore.data?.queryLimit)) ? Math.max(1, Math.min(5000, Math.round(Number(SettingsStore.data.queryLimit)))) : 500;
                const totalLimit = Math.max(2000, Math.min(500000, queryLimit * 20));
                const sql = `
                    SELECT
                        d.id,
                        d.content as name,
                        d.hpath as path,
                        d.box as notebook,
                        d.created,
                        d.ial as ial,
                        COALESCE(attr.alias, '') as alias,
                        COALESCE(tc.task_count, 0) as task_count
                    FROM blocks d
                    LEFT JOIN (
                        SELECT block_id, MAX(value) as alias
                        FROM attributes
                        WHERE name = 'alias'
                        GROUP BY block_id
                    ) attr ON attr.block_id = d.id
                    LEFT JOIN (
                        SELECT root_id, COUNT(*) as task_count
                        FROM blocks
                        WHERE type = 'i' AND subtype = 't'
                        GROUP BY root_id
                    ) tc ON tc.root_id = d.id
                    WHERE d.type = 'd'
                    ORDER BY d.content
                    LIMIT ${totalLimit}
                `;

                const res = await this.call('/api/query/sql', { stmt: sql });
                if (res.code === 0 && res.data) {
                    return res.data.map(doc => ({
                        id: doc.id,
                        name: doc.name || '未命名文档',
                        alias: __tmNormalizeDocAliasValue(doc.alias),
                        icon: __tmNormalizeDocIconValue(__tmReadIalAttrValue(doc.ial, 'icon')),
                        path: doc.path || '',
                        notebook: doc.notebook || '',
                        taskCount: parseInt(doc.task_count) || 0,
                        created: doc.created
                    }));
                }
                return [];
            } catch (e) {
                console.error('[文档] 获取文档列表失败:', e);
                return [];
            }
        },

        async getTasksByDocument(docId, limit = 500, options = null) {
            const did = String(docId || '').trim();
            if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(did)) return { tasks: [], queryTime: 0 };
            const lim0 = Number(limit);
            const lim = Number.isFinite(lim0) ? Math.max(1, Math.min(5000, Math.round(lim0))) : 500;
            const ignoreExcludeCompleted = !!(options && options.ignoreExcludeCompleted === true);
            const fullTree = !!(options && options.fullTree === true);
            const skipParentTaskJoin = !!(options && options.skipParentTaskJoin === true);
            const skipDocJoin = !!(options && options.skipDocJoin === true);
            const doneOnly = !!(options && options.doneOnly === true);
            const customFieldIds = Array.isArray(options?.customFieldIds) ? options.customFieldIds : null;
            const attrNamesSql = __tmBuildTaskInlineAttrNamesSql('                            ');
            const attrAggregateSql = __tmBuildTaskInlineAttrAggregateSql('                        ');
            // 不查找已完成任务的过滤条件
            // 不查找已完成任务的过滤条件（数据库层面暂不过滤，全部在JavaScript中过滤）
            const excludeCompletedCondition = '';
            const doneOnlyCondition = '';
            const parentListSelectSql = `parent_list.type as parent_list_type,
                    parent_list.parent_id as parent_list_parent_id,
                    COALESCE(parent_counts.parent_list_task_count, 0) as parent_list_task_count,`;
            const parentListJoinSql = `LEFT JOIN blocks AS parent_list ON parent_list.id = task.parent_id
                LEFT JOIN (
                    SELECT parent_id, COUNT(*) AS parent_list_task_count
                    FROM blocks
                    WHERE
                        type = 'i'
                        AND subtype = 't'
                        AND root_id = '${did}'
                        AND parent_id IS NOT NULL
                        AND markdown IS NOT NULL
                        AND markdown != ''${excludeCompletedCondition}${doneOnlyCondition}
                    GROUP BY parent_id
                ) AS parent_counts ON parent_counts.parent_id = task.parent_id`;
            const parentTaskSelectSql = skipParentTaskJoin
                ? 'NULL as parent_task_id,'
                : 'parent_task.id as parent_task_id,';
            const parentTaskJoinSql = skipParentTaskJoin
                ? ''
                : `
                LEFT JOIN blocks AS parent_task ON parent_task.id = parent_list.parent_id AND parent_task.type = 'i' AND parent_task.subtype = 't'`;
            const docSelectSql = skipDocJoin
                ? `'' as doc_name,
                    '' as doc_path,`
                : `doc.content as doc_name,
                    doc.hpath as doc_path,`;
            const docJoinSql = skipDocJoin
                ? ''
                : 'INNER JOIN blocks AS doc ON task.root_id = doc.id';
            const limitClause = fullTree ? '' : `\n                LIMIT ${lim}`;

            const sql = `
                SELECT
                    task.id,
                    task.markdown,
                    task.content as raw_content,
                    task.parent_id,
                    ${parentListSelectSql}
                    ${parentTaskSelectSql}
                    task.root_id,
                    task.path as block_path,
                    task.sort as block_sort,
                    task.created,
                    task.updated,

                    -- 文档信息
                    ${docSelectSql}

                    -- 自定义属性
                    attr.custom_priority,
                    attr.duration,
                    attr.remark,
                    attr.start_date,
                    attr.completion_time,
                    attr.task_complete_at,
                    attr.milestone,
                    attr.custom_time,
                    attr.custom_status,
                    attr.pinned,
                    attr.repeat_rule,
                    attr.repeat_state,
                    attr.repeat_history,
                    attr.tomato_minutes,
                    attr.tomato_hours

                FROM blocks AS task

                -- 连接文档信息
                ${docJoinSql}
                ${parentListJoinSql}
                ${parentTaskJoinSql}

                -- 左连接自定义属性（限制在当前文档的任务上，避免全表聚合）
                LEFT JOIN (
                    SELECT
                        a.block_id,
                        ${attrAggregateSql}
                    FROM attributes a
                    INNER JOIN blocks t ON t.id = a.block_id
                    WHERE
                        t.type = 'i'
                        AND t.subtype = 't'
                        AND t.root_id = '${did}'
                        AND a.name IN (
                            ${attrNamesSql}
                        )
                    GROUP BY a.block_id
                ) AS attr ON attr.block_id = task.id

                WHERE
                    task.type = 'i'
                    AND task.subtype = 't'
                    AND task.root_id = '${did}'
                    AND task.markdown IS NOT NULL
                    AND task.markdown != ''${excludeCompletedCondition}${doneOnlyCondition}

                ORDER BY task.path, task.sort, task.created${limitClause}
            `;

            const startTime = Date.now();
            const res = await this.call('/api/query/sql', { stmt: sql });
            const queryTime = Date.now() - startTime;

            if (res.code !== 0) {
                console.error(`[查询] 文档 ${did.slice(0, 8)} 查询失败:`, res.msg);
                return { tasks: [], queryTime };
            }
            const tasks = Array.isArray(res.data) ? res.data : [];
            if (skipDocJoin) {
                const docInfoMap = await __tmBuildDocQueryInfoMapWithFallback([did]);
                __tmApplyDocQueryInfoToTasks(tasks, docInfoMap);
            }
            let attrHostReadTime = 0;
            let customFieldReadTime = 0;
            let attrReadTime = 0;
            let customFieldReadMeta = null;
            const shouldLoadCustomFieldAttrs = !Array.isArray(customFieldIds) || customFieldIds.length > 0;
            const attrHostReadStart = Date.now();
            try { await __tmApplyTaskAttrHostOverrides(tasks); } catch (e) {}
            attrHostReadTime = Date.now() - attrHostReadStart;
            if (shouldLoadCustomFieldAttrs) {
                const customFieldReadStart = Date.now();
                try { customFieldReadMeta = await __tmAttachCustomFieldAttrsToTasks(tasks, { fieldIds: customFieldIds }); } catch (e) { customFieldReadMeta = null; }
                customFieldReadTime = Date.now() - customFieldReadStart;
            } else {
                customFieldReadMeta = {
                    cacheHitCount: 0,
                    cacheMissCount: 0,
                    hostQueryCount: 0,
                    selfFallbackCount: 0,
                    hostAssignedCount: 0,
                    selfAssignedCount: 0,
                    requestedFieldCount: 0,
                };
                customFieldReadTime = 0;
            }
            attrReadTime = attrHostReadTime + customFieldReadTime;
            const filteredTasks = doneOnly
                ? tasks.filter((task) => {
                    try { return !!API.parseTaskStatus(task?.markdown).done; } catch (e) { return false; }
                })
                : tasks;
            // 注意：这里不能提前过滤已完成任务。
            // 子任务进度条、父子层级和“父任务未完成时显示已完成子任务”的规则，都依赖完整树结构。
            // 真正的显隐交给 applyFilters/filterVisibleTasks 统一处理。
            return {
                tasks: filteredTasks,
                queryTime,
                sqlQueryTime: queryTime,
                attrReadTime,
                attrHostReadTime,
                customFieldReadTime,
                customFieldCacheHitCount: Number(customFieldReadMeta?.cacheHitCount || 0),
                customFieldCacheMissCount: Number(customFieldReadMeta?.cacheMissCount || 0),
                customFieldHostQueryCount: Number(customFieldReadMeta?.hostQueryCount || 0),
                customFieldSelfFallbackCount: Number(customFieldReadMeta?.selfFallbackCount || 0),
                customFieldHostAssignedCount: Number(customFieldReadMeta?.hostAssignedCount || 0),
                customFieldSelfAssignedCount: Number(customFieldReadMeta?.selfAssignedCount || 0),
                customFieldRequestedFieldCount: Number(customFieldReadMeta?.requestedFieldCount || 0),
                readRepeatAttrsInline: __tmShouldReadRepeatAttrsInline(),
            };
        },

        async getTasksByDocuments(docIds, limitPerDoc = 500, options = null) {
            const safeDocIds0 = Array.isArray(docIds) ? docIds.filter(id => /^[0-9]+-[a-zA-Z0-9]+$/.test(String(id || ''))) : [];
            const safeDocIds = Array.from(new Set(safeDocIds0.map((x) => String(x || '').trim()).filter(Boolean))).sort();
            if (safeDocIds.length === 0) return { tasks: [], queryTime: 0 };
            const idList = safeDocIds.map(id => `'${id}'`).join(',');
            const perDocLimit = Number.isFinite(limitPerDoc) ? Math.max(1, Math.min(5000, limitPerDoc)) : 500;
            const totalLimit = Math.max(perDocLimit, Math.min(500000, safeDocIds.length * perDocLimit));
            const doneOnly = !!(options && options.doneOnly === true);
            const ignoreExcludeCompleted = !!(options && options.ignoreExcludeCompleted === true);
            const forceFresh = !!(options && options.forceFresh === true);
            const skipParentTaskJoin = !!(options && options.skipParentTaskJoin === true);
            const skipDocJoin = !!(options && options.skipDocJoin === true);
            const customFieldIds = Array.isArray(options?.customFieldIds) ? options.customFieldIds : null;
            const customFieldIdsKey = Array.isArray(customFieldIds)
                ? customFieldIds.map((id) => String(id || '').trim()).filter(Boolean).sort().join(',') || '__none__'
                : '__all__';
            const cacheTtlMs = (() => {
                if (doneOnly) return 3000;
                if (safeDocIds.length >= 120) return 15000;
                if (safeDocIds.length >= 40) return 10000;
                return 6000;
            })();
            const repeatAttrsInline = __tmShouldReadRepeatAttrsInline();
            const cacheKey = `getTasksByDocuments:${idList}:${perDocLimit}:${doneOnly ? 1 : 0}:${ignoreExcludeCompleted ? 1 : 0}:${skipParentTaskJoin ? 1 : 0}:${skipDocJoin ? 1 : 0}:${SettingsStore.data.enableTomatoIntegration ? 1 : 0}:${repeatAttrsInline ? 1 : 0}:${customFieldIdsKey}:plp2`;
            const cached = __tmTasksQueryCache.get(cacheKey);
            if (!forceFresh && cached && cached.t && (Date.now() - cached.t) < cacheTtlMs && cached.v) {
                const out = __tmCloneTaskQueryResult(cached.v);
                const sourceQueryTime = Number(out?.queryTime || 0);
                const sourceSqlQueryTime = Number(out?.sqlQueryTime || sourceQueryTime || 0);
                const sourceAttrReadTime = Number(out?.attrReadTime || 0);
                const sourceAttrHostReadTime = Number(out?.attrHostReadTime || 0);
                const sourceCustomFieldReadTime = Number(out?.customFieldReadTime || 0);
                const sourceCustomFieldCacheHitCount = Number(out?.customFieldCacheHitCount || 0);
                const sourceCustomFieldCacheMissCount = Number(out?.customFieldCacheMissCount || 0);
                const sourceCustomFieldHostQueryCount = Number(out?.customFieldHostQueryCount || 0);
                const sourceCustomFieldSelfFallbackCount = Number(out?.customFieldSelfFallbackCount || 0);
                const sourceCustomFieldHostAssignedCount = Number(out?.customFieldHostAssignedCount || 0);
                const sourceCustomFieldSelfAssignedCount = Number(out?.customFieldSelfAssignedCount || 0);
                const sourceCustomFieldRequestedFieldCount = Number(out?.customFieldRequestedFieldCount || 0);
                out.cacheHit = 1;
                out.cacheAgeMs = Math.max(0, Date.now() - Number(cached.t || 0));
                out.sourceQueryTime = sourceQueryTime;
                out.sourceSqlQueryTime = sourceSqlQueryTime;
                out.sourceAttrReadTime = sourceAttrReadTime;
                out.sourceAttrHostReadTime = sourceAttrHostReadTime;
                out.sourceCustomFieldReadTime = sourceCustomFieldReadTime;
                out.sourceCustomFieldCacheHitCount = sourceCustomFieldCacheHitCount;
                out.sourceCustomFieldCacheMissCount = sourceCustomFieldCacheMissCount;
                out.sourceCustomFieldHostQueryCount = sourceCustomFieldHostQueryCount;
                out.sourceCustomFieldSelfFallbackCount = sourceCustomFieldSelfFallbackCount;
                out.sourceCustomFieldHostAssignedCount = sourceCustomFieldHostAssignedCount;
                out.sourceCustomFieldSelfAssignedCount = sourceCustomFieldSelfAssignedCount;
                out.sourceCustomFieldRequestedFieldCount = sourceCustomFieldRequestedFieldCount;
                out.queryTime = 0;
                out.sqlQueryTime = 0;
                out.attrReadTime = 0;
                out.attrHostReadTime = 0;
                out.customFieldReadTime = 0;
                out.customFieldCacheHitCount = 0;
                out.customFieldCacheMissCount = 0;
                out.customFieldHostQueryCount = 0;
                out.customFieldSelfFallbackCount = 0;
                out.customFieldHostAssignedCount = 0;
                out.customFieldSelfAssignedCount = 0;
                out.customFieldRequestedFieldCount = 0;
                try {
                    __tmGetValueDebugWatchTaskIds().forEach((watchId) => {
                        const matches = __tmResolveValueDebugTaskMatches(out?.tasks, watchId);
                        if (!matches.length) {
                            __tmPushValueDebug('query:cache-hit', {
                                watchId,
                                taskId: watchId,
                                cacheKey,
                                cacheAgeMs: out.cacheAgeMs,
                                sourceQueryTime,
                                sourceAttrReadTime,
                                sourceAttrHostReadTime,
                                sourceCustomFieldReadTime,
                                task: null,
                            }, [watchId]);
                            return;
                        }
                        matches.forEach(({ task, matchedBy, matchKeys }) => {
                            const taskIds = Array.from(new Set([watchId].concat(matchKeys || [])));
                            __tmPushValueDebug('query:cache-hit', {
                                watchId,
                                taskId: String(task?.id || '').trim() || watchId,
                                matchedBy,
                                matchKeys,
                                cacheKey,
                                cacheAgeMs: out.cacheAgeMs,
                                sourceQueryTime,
                                sourceAttrReadTime,
                                sourceAttrHostReadTime,
                                sourceCustomFieldReadTime,
                                task: __tmSnapshotTaskValueDebugFields(task),
                            }, taskIds);
                        });
                    });
                } catch (e) {}
                return out;
            }
            const docIdSet = new Set(safeDocIds);

            const attrNamesSql = __tmBuildTaskInlineAttrNamesSql('                        ');
            const attrAggregateSql = __tmBuildTaskInlineAttrAggregateSql('                        ');
            const parentTaskSelectSql = skipParentTaskJoin
                ? 'NULL AS parent_task_id,'
                : 'parent_task.id AS parent_task_id,';
            const parentTaskJoinSql = skipParentTaskJoin
                ? ''
                : `
                LEFT JOIN blocks parent_task ON parent_task.id = t.parent_list_parent_id AND parent_task.type = 'i' AND parent_task.subtype = 't'`;
            const docSelectSql = skipDocJoin
                ? `'' AS doc_name,
                        '' AS doc_path,`
                : `doc.content AS doc_name,
                        doc.hpath AS doc_path,`;
            const docJoinSql = skipDocJoin
                ? ''
                : 'INNER JOIN blocks AS doc ON task.root_id = doc.id';

            // 不查找已完成任务的过滤条件
            // 不查找已完成任务的过滤条件（数据库层面暂不过滤，全部在JavaScript中过滤）
            const excludeCompletedCondition = '';
            const doneOnlyCondition = '';

            const sql = `
                WITH parent_counts AS (
                    SELECT
                        task.parent_id,
                        COUNT(*) AS parent_list_task_count
                    FROM blocks AS task
                    WHERE
                        task.type = 'i'
                        AND task.subtype = 't'
                        AND task.root_id IN (${idList})
                        AND task.parent_id IS NOT NULL
                        AND task.markdown IS NOT NULL
                        AND task.markdown != ''${excludeCompletedCondition}${doneOnlyCondition}
                    GROUP BY task.parent_id
                ),
                tasks0 AS (
                    SELECT
                        task.id,
                        task.markdown,
                        task.content AS raw_content,
                        task.parent_id,
                        parent_list.type AS parent_list_type,
                        parent_list.parent_id AS parent_list_parent_id,
                        COALESCE(parent_counts.parent_list_task_count, 0) AS parent_list_task_count,
                        task.root_id,
                        task.path AS block_path,
                        task.sort AS block_sort,
                        task.created,
                        task.updated,
                        ${docSelectSql}
                        ROW_NUMBER() OVER (PARTITION BY task.root_id ORDER BY task.path, task.sort, task.created) AS rn
                    FROM blocks AS task
                    ${docJoinSql}
                    LEFT JOIN blocks AS parent_list ON parent_list.id = task.parent_id
                    LEFT JOIN parent_counts ON parent_counts.parent_id = task.parent_id
                    WHERE
                        task.type = 'i'
                        AND task.subtype = 't'
                        AND task.root_id IN (${idList})
                        AND task.markdown IS NOT NULL
                        AND task.markdown != ''${excludeCompletedCondition}${doneOnlyCondition}
                ),
                tasks AS (
                    SELECT * FROM tasks0 WHERE rn <= ${perDocLimit}
                ),
                attr AS (
                    SELECT
                        a.block_id,
                        ${attrAggregateSql}
                    FROM attributes a
                    INNER JOIN tasks t ON t.id = a.block_id
                    WHERE a.name IN (
                        ${attrNamesSql}
                    )
                    GROUP BY a.block_id
                )
                SELECT
                    t.id,
                    t.markdown,
                    t.raw_content,
                    t.parent_id,
                    t.parent_list_type,
                    t.parent_list_parent_id,
                    t.parent_list_task_count,
                    ${parentTaskSelectSql}
                    t.root_id,
                    t.block_path,
                    t.block_sort,
                    t.rn AS doc_seq,
                    t.created,
                    t.updated,
                    t.doc_name,
                    t.doc_path,
                    attr.custom_priority,
                    attr.duration,
                    attr.remark,
                    attr.start_date,
                    attr.completion_time,
                    attr.task_complete_at,
                    attr.milestone,
                    attr.custom_time,
                    attr.custom_status,
                    attr.pinned,
                    attr.repeat_rule,
                    attr.repeat_state,
                    attr.repeat_history,
                    attr.tomato_minutes,
                    attr.tomato_hours
                FROM tasks t
                ${parentTaskJoinSql}
                LEFT JOIN attr ON attr.block_id = t.id
                ORDER BY t.root_id, t.block_path, t.block_sort, t.created
                LIMIT ${totalLimit}
            `;

            const startTime = Date.now();
            const res = await this.call('/api/query/sql', { stmt: sql });
            const queryTime = Date.now() - startTime;
            if (res.code !== 0) {
                console.error(`[查询] 批量查询失败:`, res.msg);
                try {
                    const fallbackStart = Date.now();
                    const results = await Promise.all(safeDocIds.map(id => this.getTasksByDocument(id, perDocLimit, options)));
                    const tasks = [];
                    let attrReadTime = 0;
                    let attrHostReadTime = 0;
                    let customFieldReadTime = 0;
                    let customFieldCacheHitCount = 0;
                    let customFieldCacheMissCount = 0;
                    let customFieldHostQueryCount = 0;
                    let customFieldSelfFallbackCount = 0;
                    let customFieldHostAssignedCount = 0;
                    let customFieldSelfAssignedCount = 0;
                    let customFieldRequestedFieldCount = 0;
                    results.forEach(r => tasks.push(...(r?.tasks || [])));
                    results.forEach((r) => {
                        attrReadTime += Number(r?.attrReadTime || 0);
                        attrHostReadTime += Number(r?.attrHostReadTime || 0);
                        customFieldReadTime += Number(r?.customFieldReadTime || 0);
                        customFieldCacheHitCount += Number(r?.customFieldCacheHitCount || 0);
                        customFieldCacheMissCount += Number(r?.customFieldCacheMissCount || 0);
                        customFieldHostQueryCount += Number(r?.customFieldHostQueryCount || 0);
                        customFieldSelfFallbackCount += Number(r?.customFieldSelfFallbackCount || 0);
                        customFieldHostAssignedCount += Number(r?.customFieldHostAssignedCount || 0);
                        customFieldSelfAssignedCount += Number(r?.customFieldSelfAssignedCount || 0);
                        customFieldRequestedFieldCount = Math.max(customFieldRequestedFieldCount, Number(r?.customFieldRequestedFieldCount || 0));
                    });
                    const fallbackTime = Date.now() - fallbackStart;
                    const out = {
                        tasks: __tmCloneTaskQueryRows(tasks),
                        queryTime: queryTime + fallbackTime,
                        sqlQueryTime: queryTime + fallbackTime,
                        attrReadTime,
                        attrHostReadTime,
                        customFieldReadTime,
                        customFieldCacheHitCount,
                        customFieldCacheMissCount,
                        customFieldHostQueryCount,
                        customFieldSelfFallbackCount,
                        customFieldHostAssignedCount,
                        customFieldSelfAssignedCount,
                        customFieldRequestedFieldCount,
                        readRepeatAttrsInline: repeatAttrsInline,
                    };
                    __tmTasksQueryCache.set(cacheKey, { t: Date.now(), v: __tmCloneTaskQueryResult(out), docIdSet, ttl: cacheTtlMs });
                    return out;
                } catch (e) {
                    return { tasks: [], queryTime };
                }
            }
            const tasks = Array.isArray(res.data) ? res.data : [];
            if (skipDocJoin) {
                const docInfoMap = await __tmBuildDocQueryInfoMapWithFallback(safeDocIds);
                __tmApplyDocQueryInfoToTasks(tasks, docInfoMap);
            }
            try {
                __tmGetValueDebugWatchTaskIds().forEach((watchId) => {
                    const matches = __tmResolveValueDebugTaskMatches(tasks, watchId);
                    if (!matches.length) {
                        __tmPushValueDebug('query:sql-row', {
                            watchId,
                            taskId: watchId,
                            cacheHit: 0,
                            queryTime,
                            task: null,
                        }, [watchId]);
                        return;
                    }
                    matches.forEach(({ task, matchedBy, matchKeys }) => {
                        const taskIds = Array.from(new Set([watchId].concat(matchKeys || [])));
                        __tmPushValueDebug('query:sql-row', {
                            watchId,
                            taskId: String(task?.id || '').trim() || watchId,
                            matchedBy,
                            matchKeys,
                            cacheHit: 0,
                            queryTime,
                            task: __tmSnapshotTaskValueDebugFields(task),
                        }, taskIds);
                    });
                });
            } catch (e) {}
            let attrHostReadTime = 0;
            let customFieldReadTime = 0;
            let attrReadTime = 0;
            let customFieldReadMeta = null;
            const shouldLoadCustomFieldAttrs = !Array.isArray(customFieldIds) || customFieldIds.length > 0;
            const attrHostReadStart = Date.now();
            try { await __tmApplyTaskAttrHostOverrides(tasks); } catch (e) {}
            attrHostReadTime = Date.now() - attrHostReadStart;
            if (shouldLoadCustomFieldAttrs) {
                const customFieldReadStart = Date.now();
                try { customFieldReadMeta = await __tmAttachCustomFieldAttrsToTasks(tasks, { fieldIds: customFieldIds }); } catch (e) { customFieldReadMeta = null; }
                customFieldReadTime = Date.now() - customFieldReadStart;
            } else {
                customFieldReadMeta = {
                    cacheHitCount: 0,
                    cacheMissCount: 0,
                    hostQueryCount: 0,
                    selfFallbackCount: 0,
                    hostAssignedCount: 0,
                    selfAssignedCount: 0,
                    requestedFieldCount: 0,
                };
                customFieldReadTime = 0;
            }
            attrReadTime = attrHostReadTime + customFieldReadTime;
            const filteredTasks = doneOnly
                ? tasks.filter((task) => {
                    try { return !!API.parseTaskStatus(task?.markdown).done; } catch (e) { return false; }
                })
                : tasks;
            // 注意：这里不能提前过滤已完成任务。
            // 子任务进度条、父子层级和“父任务未完成时显示已完成子任务”的规则，都依赖完整树结构。
            // 真正的显隐交给 applyFilters/filterVisibleTasks 统一处理。
            const out = {
                tasks: filteredTasks,
                queryTime,
                sqlQueryTime: queryTime,
                attrReadTime,
                attrHostReadTime,
                customFieldReadTime,
                customFieldCacheHitCount: Number(customFieldReadMeta?.cacheHitCount || 0),
                customFieldCacheMissCount: Number(customFieldReadMeta?.cacheMissCount || 0),
                customFieldHostQueryCount: Number(customFieldReadMeta?.hostQueryCount || 0),
                customFieldSelfFallbackCount: Number(customFieldReadMeta?.selfFallbackCount || 0),
                customFieldHostAssignedCount: Number(customFieldReadMeta?.hostAssignedCount || 0),
                customFieldSelfAssignedCount: Number(customFieldReadMeta?.selfAssignedCount || 0),
                customFieldRequestedFieldCount: Number(customFieldReadMeta?.requestedFieldCount || 0),
                readRepeatAttrsInline: repeatAttrsInline,
            };
            try {
                __tmGetValueDebugWatchTaskIds().forEach((watchId) => {
                    const matches = __tmResolveValueDebugTaskMatches(filteredTasks, watchId);
                    if (!matches.length) {
                        __tmPushValueDebug('query:return', {
                            watchId,
                            taskId: watchId,
                            cacheHit: 0,
                            queryTime,
                            attrHostReadTime,
                            customFieldReadTime,
                            task: null,
                        }, [watchId]);
                        return;
                    }
                    matches.forEach(({ task, matchedBy, matchKeys }) => {
                        const taskIds = Array.from(new Set([watchId].concat(matchKeys || [])));
                        __tmPushValueDebug('query:return', {
                            watchId,
                            taskId: String(task?.id || '').trim() || watchId,
                            matchedBy,
                            matchKeys,
                            cacheHit: 0,
                            queryTime,
                            attrHostReadTime,
                            customFieldReadTime,
                            task: __tmSnapshotTaskValueDebugFields(task),
                        }, taskIds);
                    });
                });
            } catch (e) {}
            __tmTasksQueryCache.set(cacheKey, { t: Date.now(), v: __tmCloneTaskQueryResult(out), docIdSet, ttl: cacheTtlMs });
            return out;
        },

        async getTaskById(id) {
            const tid = String(id || '').trim();
            if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(tid)) return null;
            const attrNamesSql = __tmBuildTaskInlineAttrNamesSql('                            ');
            const attrAggregateSql = __tmBuildTaskInlineAttrAggregateSql('                        ');
            const sql = `
                SELECT
                    task.id,
                    task.markdown,
                    task.content as raw_content,
                    task.parent_id,
                    parent_list.type as parent_list_type,
                    (
                        SELECT COUNT(*)
                        FROM blocks siblings
                        WHERE siblings.parent_id = task.parent_id
                          AND siblings.type = 'i'
                          AND siblings.subtype = 't'
                    ) as parent_list_task_count,
                    parent_task.id as parent_task_id,
                    task.root_id,
                    task.created,
                    task.updated,
                    doc.content as doc_name,
                    doc.hpath as doc_path,
                    attr.custom_priority,
                    attr.duration,
                    attr.remark,
                    attr.start_date,
                    attr.completion_time,
                    attr.task_complete_at,
                    attr.milestone,
                    attr.custom_time,
                    attr.custom_status,
                    attr.pinned,
                    attr.repeat_rule,
                    attr.repeat_state,
                    attr.repeat_history,
                    attr.tomato_minutes,
                    attr.tomato_hours
                FROM blocks AS task
                INNER JOIN blocks AS doc ON task.root_id = doc.id
                LEFT JOIN blocks AS parent_list ON parent_list.id = task.parent_id
                LEFT JOIN blocks AS parent_task ON parent_task.id = parent_list.parent_id AND parent_task.type = 'i' AND parent_task.subtype = 't'
                LEFT JOIN (
                    SELECT
                        a.block_id,
                        ${attrAggregateSql}
                    FROM attributes a
                    WHERE a.block_id = '${tid}'
                      AND a.name IN (
                            ${attrNamesSql}
                      )
                    GROUP BY a.block_id
                ) AS attr ON attr.block_id = task.id
                WHERE task.id = '${tid}'
                LIMIT 1
            `;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const row = res.data[0];
                try { await __tmApplyTaskAttrHostOverrides([row]); } catch (e) {}
                try { await __tmAttachCustomFieldAttrsToTasks([row]); } catch (e) {}
                return row;
            }
            return null;
        },

        async getTasksHierarchy(taskIds) {
            if (!taskIds || taskIds.length === 0) return {};

            const idList = taskIds.map(id => `'${id}'`).join(',');
            const totalLimit = Math.max(1, Math.min(5000, taskIds.length));
            const sql = `
                WITH RECURSIVE task_tree AS (
                    -- 起始：所有指定任务
                    SELECT
                        id,
                        parent_id,
                        0 as level,
                        id as original_id
                    FROM blocks
                    WHERE id IN (${idList})

                    UNION ALL

                    -- 递归：向上查找父列表
                    SELECT
                        b.id,
                        b.parent_id,
                        tt.level + 1,
                        tt.original_id
                    FROM blocks b
                    INNER JOIN task_tree tt ON b.id = tt.parent_id
                    WHERE b.type = 'l' AND tt.level < 5
                )
                SELECT
                    original_id as task_id,
                    MAX(level) as depth
                FROM task_tree
                GROUP BY original_id
                LIMIT ${totalLimit}
            `;

            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data) {
                const hierarchy = {};
                res.data.forEach(row => {
                    hierarchy[row.task_id] = {
                        level: row.depth || 0
                    };
                });
                return hierarchy;
            }
            return {};
        },

        async fetchH2Contexts(taskIds) {
            const ids = Array.from(new Set((taskIds || []).map(x => String(x || '').trim()).filter(Boolean))).sort();
            if (ids.length === 0) return new Map();
            const cacheKey = `h2ctx:${ids.length}:${__tmHashIds(ids)}:${String(SettingsStore.data.taskHeadingLevel || 'h2')}`;
            const cached = __tmGetAuxCache(cacheKey, 8000);
            if (cached) return new Map(cached);
            try {
                const bundle = await this.fetchTaskEnhanceBundle(ids, { needH2: true, needFlow: false });
                const out = bundle?.h2ContextMap instanceof Map ? bundle.h2ContextMap : new Map();
                __tmSetAuxCache(cacheKey, Array.from(out.entries()));
                return out;
            } catch (e) {
                return this.fetchH2ContextsLegacy(ids);
            }
        },

        async fetchTaskFlowRanks(taskIds) {
            const ids = Array.from(new Set((taskIds || []).map(x => String(x || '').trim()).filter(Boolean))).sort();
            if (ids.length === 0) return new Map();
            const cacheKey = `flowrank:${ids.length}:${__tmHashIds(ids)}`;
            const cached = __tmGetAuxCache(cacheKey, 5000);
            if (cached) return new Map(cached);
            try {
                const bundle = await this.fetchTaskEnhanceBundle(ids, { needH2: false, needFlow: true });
                const out = bundle?.taskFlowRankMap instanceof Map ? bundle.taskFlowRankMap : new Map();
                __tmSetAuxCache(cacheKey, Array.from(out.entries()));
                return out;
            } catch (e) {
                return this.fetchTaskFlowRanksLegacy(ids);
            }
        },

        async fetchH2ContextsLegacy(taskIds, options = {}) {
            const ids = Array.from(new Set((taskIds || []).map(x => String(x || '').trim()).filter(Boolean))).sort();
            if (ids.length === 0) return new Map();
            const opts = (options && typeof options === 'object') ? options : {};
            const providedTaskDocMap = opts.taskDocMap instanceof Map ? opts.taskDocMap : null;
            const skipHeadingOrderFetch = opts.skipHeadingOrderFetch === true;
            const skipKramdownRealign = opts.skipKramdownRealign === true;
            const cacheMode = `${skipHeadingOrderFetch ? 1 : 0}${skipKramdownRealign ? 1 : 0}`;
            const cacheKey = `h2ctx:${ids.length}:${__tmHashIds(ids)}:${String(SettingsStore.data.taskHeadingLevel || 'h2')}:${cacheMode}`;
            const cached = __tmGetAuxCache(cacheKey, 8000);
            if (cached) return new Map(cached);
            const batchSize = 100;
            const contextMap = new Map();
            const escId = (s) => String(s || '').replace(/'/g, "''");
            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                if (batch.length === 0) continue;
                const idList = batch.map(id => `'${escId(id)}'`).join(',');
                const batchLimit = Math.max(1, Math.min(5000, batch.length));
                const taskRootMap = new Map();
                if (providedTaskDocMap instanceof Map) {
                    batch.forEach((tid) => {
                        const rid = String(providedTaskDocMap.get(String(tid || '').trim()) || '').trim();
                        if (rid) taskRootMap.set(String(tid || '').trim(), rid);
                    });
                }
                if (!skipKramdownRealign) {
                    const unresolvedRoots = batch.filter((tid) => !taskRootMap.has(String(tid || '').trim()));
                    if (unresolvedRoots.length > 0) {
                        const rootsIdList = unresolvedRoots.map((id) => `'${escId(id)}'`).join(',');
                        const rootsLimit = Math.max(1, Math.min(5000, unresolvedRoots.length));
                        try {
                            const rootsSql = `SELECT id AS task_id, root_id FROM blocks WHERE id IN (${rootsIdList}) LIMIT ${rootsLimit}`;
                            const rootsRes = await this.call('/api/query/sql', { stmt: rootsSql });
                            if (rootsRes.code === 0 && Array.isArray(rootsRes.data)) {
                                rootsRes.data.forEach((r) => {
                                    const tid = String(r?.task_id || '').trim();
                                    const rid = String(r?.root_id || '').trim();
                                    if (tid && rid) taskRootMap.set(tid, rid);
                                });
                            }
                        } catch (e) {}
                    }
                }
                const sql = `
                    WITH RECURSIVE task_roots AS (
                        SELECT id AS task_id, root_id
                        FROM blocks
                        WHERE id IN (${idList})
                    ),
                    doc_roots AS (
                        SELECT DISTINCT task_roots.root_id AS doc_root_id
                        FROM task_roots
                    ),
                    doc_tree AS (
                        SELECT
                            d.id,
                            d.id AS root_id,
                            0 AS depth,
                            '' AS order_key
                        FROM blocks d
                        WHERE d.id IN (SELECT doc_root_id FROM doc_roots)

                        UNION ALL

                        SELECT
                            b.id,
                            t.root_id,
                            t.depth + 1 AS depth,
                            (t.order_key || '/' ||
                                CASE
                                    WHEN TRIM(CAST(b.sort AS TEXT)) GLOB '[0-9]*' AND TRIM(CAST(b.sort AS TEXT)) != ''
                                        THEN ('0:' || printf('%020d', CAST(TRIM(CAST(b.sort AS TEXT)) AS INTEGER)))
                                    ELSE ('1:' || COALESCE(NULLIF(TRIM(CAST(b.sort AS TEXT)), ''), ''))
                                END
                                || ':' || b.id) AS order_key
                        FROM blocks b
                        INNER JOIN doc_tree t ON b.parent_id = t.id
                        WHERE t.depth < 128
                    ),
                    headings AS (
                        SELECT
                            b.id,
                            b.root_id,
                            b.path,
                            b.sort,
                            b.created,
                            COALESCE(dt.order_key, '') AS heading_order_key,
                            ROW_NUMBER() OVER (
                                PARTITION BY b.root_id
                                ORDER BY COALESCE(dt.order_key, ''), b.created, b.id
                            ) AS heading_rank
                        FROM blocks b
                        LEFT JOIN doc_tree dt ON dt.id = b.id
                        WHERE b.type = 'h'
                          AND b.subtype = '${SettingsStore.data.taskHeadingLevel || 'h2'}'
                          AND b.root_id IN (SELECT DISTINCT task_roots.root_id FROM task_roots)
                    ),
                    -- 获取任务的父块信息（包括类型）
                    task_parents AS (
                        SELECT
                            tr.task_id,
                            tr.root_id,
                            b.parent_id AS immediate_parent_id,
                            b.type AS task_type,
                            b.subtype AS task_subtype
                        FROM task_roots tr
                        LEFT JOIN blocks b ON b.id = tr.task_id
                    ),
                    -- 递归查找最外层的列表块或文档块的order_key
                    task_order_keys AS (
                        -- 基础情况：直接父块
                        SELECT
                            tp.task_id,
                            tp.root_id,
                            tp.immediate_parent_id AS current_parent_id,
                            dt_parent.order_key AS parent_order_key,
                            0 AS depth
                        FROM task_parents tp
                        LEFT JOIN doc_tree dt_parent ON dt_parent.id = tp.immediate_parent_id

                        UNION ALL

                        -- 递归情况：父块是任务块，继续向上查找
                        SELECT
                            tok.task_id,
                            tok.root_id,
                            b.parent_id AS current_parent_id,
                            dt_parent.order_key AS parent_order_key,
                            tok.depth + 1 AS depth
                        FROM task_order_keys tok
                        LEFT JOIN blocks b ON b.id = tok.current_parent_id
                        LEFT JOIN doc_tree dt_parent ON dt_parent.id = b.parent_id
                        WHERE tok.depth < 10
                          AND b.type IN ('i', 't', 's') -- 继续向上查找（包含超级块's'）
                    ),
                    -- 获取最终的order_key（最外层非任务块的order_key）
                    task_orders AS (
                        SELECT
                            tok.task_id AS task_id,
                            tok.root_id AS task_root_id,
                            COALESCE(
                                (SELECT parent_order_key FROM task_order_keys tok2
                                 WHERE tok2.task_id = tok.task_id AND tok2.parent_order_key != ''
                                 ORDER BY tok2.depth DESC LIMIT 1),
                                dt_task.order_key,
                                ''
                            ) AS task_order_key
                        FROM task_order_keys tok
                        LEFT JOIN doc_tree dt_task ON dt_task.id = tok.task_id
                        GROUP BY tok.task_id, tok.root_id
                    ),
                    matched AS (
                        SELECT
                            t.task_id,
                            t.task_root_id,
                            h.id AS heading_id,
                            h.path AS heading_path,
                            h.sort AS heading_sort,
                            h.created AS heading_created,
                            h.heading_rank,
                            ROW_NUMBER() OVER (
                                PARTITION BY t.task_id
                                ORDER BY h.heading_order_key DESC, h.heading_rank DESC
                            ) AS rn
                        FROM task_orders t
                        LEFT JOIN headings h
                            ON h.root_id = t.task_root_id
                           AND h.heading_order_key <= t.task_order_key
                    )
                    SELECT
                        m.task_id,
                        m.task_root_id AS root_id,
                        m.heading_id,
                        hb.content,
                        m.heading_path,
                        m.heading_sort,
                        m.heading_created,
                        m.heading_rank
                    FROM matched m
                    LEFT JOIN blocks hb ON hb.id = m.heading_id
                    WHERE m.rn = 1
                    LIMIT ${batchLimit}
                `;
                try {
                    const res = await this.call('/api/query/sql', { stmt: sql });
                    if (res.code === 0 && res.data) {
                        const rows = Array.isArray(res.data) ? res.data : [];
                        let headingOrderMap = new Map();
                        if (!skipHeadingOrderFetch) {
                            try {
                                const rootIds = Array.from(new Set(rows.map(r => String(r?.root_id || '').trim()).filter(Boolean)));
                                headingOrderMap = await this.fetchHeadingOrderByDocs(rootIds, SettingsStore.data.taskHeadingLevel || 'h2');
                            } catch (e) {
                                headingOrderMap = new Map();
                            }
                        }
                        rows.forEach(row => {
                            if (!contextMap.has(row.task_id)) {
                                const hid = String(row?.heading_id || '').trim();
                                if (!hid) return;
                                const did = String(row?.root_id || '').trim();
                                const rankByDocText = headingOrderMap.get(`${did}::${hid}`);
                                const rank = Number.isFinite(Number(rankByDocText)) ? Number(rankByDocText) : Number(row?.heading_rank);
                                contextMap.set(row.task_id, {
                                    id: hid,
                                    content: String(row?.content || '').trim(),
                                    path: String(row?.heading_path || '').trim(),
                                    sort: Number(row?.heading_sort),
                                    created: String(row?.heading_created || '').trim(),
                                    rank,
                                });
                            }
                        });
                    }
                } catch (e) {}

                // 强制对齐文档真实文本顺序：按 Kramdown 文本流映射“任务 -> 前置最近标题”
                if (!skipKramdownRealign) try {
                    const lvRaw = String(SettingsStore.data.taskHeadingLevel || 'h2').trim().toLowerCase();
                    const lvNum0 = Number((lvRaw.match(/^h([1-6])$/) || [])[1]);
                    const lvNum = Number.isFinite(lvNum0) ? lvNum0 : 2;
                    const tasksByDoc = new Map();
                    batch.forEach((tid0) => {
                        const tid = String(tid0 || '').trim();
                        const rid = String(taskRootMap.get(tid) || '').trim();
                        if (!tid || !rid) return;
                        if (!tasksByDoc.has(rid)) tasksByDoc.set(rid, new Set());
                        tasksByDoc.get(rid).add(tid);
                    });
                    const parseIds = (line) => {
                        const out = [];
                        const s = String(line || '');
                        const re = /\bid="([^"]+)"/g;
                        let m;
                        while ((m = re.exec(s)) !== null) {
                            const id = String(m[1] || '').trim();
                            if (id) out.push(id);
                        }
                        return out;
                    };
                    const stripHeadingText = (line) => {
                        return __tmNormalizeHeadingText(line);
                    };
                    const applyHeadingToStack = (stack, heading) => {
                        const level = Number(heading?.level);
                        if (!Number.isFinite(level) || level < 1 || level > 6) return;
                        for (let i = level; i <= 6; i++) stack[i] = null;
                        stack[level] = heading;
                    };
                    for (const [docId, tidSet] of tasksByDoc.entries()) {
                        let km = '';
                        try { km = await this.getBlockKramdown(docId); } catch (e) { km = ''; }
                        if (!km) continue;
                        const lines = String(km).split(/\r?\n/);
                        let headingRank = -1;
                        const headingStack = Array(7).fill(null);
                        let pendingHeading = null;
                        for (let ln = 0; ln < lines.length; ln++) {
                            const line = String(lines[ln] || '');
                            const hm = line.match(/^(#{1,6})\s+(.*)$/);
                            if (hm) {
                                const lineLevel = Number(hm[1].length);
                                pendingHeading = {
                                    level: lineLevel,
                                    text: stripHeadingText(line),
                                    expires: ln + 4,
                                };
                                const idsInline = parseIds(line);
                                if (idsInline.length > 0) {
                                    const headingLevel = Number(pendingHeading.level);
                                    headingRank += 1;
                                    const resolvedHeading = {
                                        id: String(idsInline[0] || '').trim(),
                                        content: String(pendingHeading.text || '').trim(),
                                        level: headingLevel,
                                        rank: headingRank,
                                    };
                                    applyHeadingToStack(headingStack, resolvedHeading);
                                    pendingHeading = null;
                                }
                            }
                            const ids = parseIds(line);
                            if (pendingHeading && ids.length > 0) {
                                const headingLevel = Number(pendingHeading.level);
                                headingRank += 1;
                                const resolvedHeading = {
                                    id: String(ids[0] || '').trim(),
                                    content: String(pendingHeading.text || '').trim(),
                                    level: headingLevel,
                                    rank: headingRank,
                                };
                                applyHeadingToStack(headingStack, resolvedHeading);
                                pendingHeading = null;
                            }
                            if (pendingHeading && ln > Number(pendingHeading.expires || 0)) {
                                pendingHeading = null;
                            }
                            if (!ids.length) continue;
                            ids.forEach((bid) => {
                                const tid = String(bid || '').trim();
                                if (!tid || !tidSet.has(tid)) return;
                                const currentHeading = headingStack[lvNum];
                                contextMap.set(tid, {
                                    id: String(currentHeading?.id || '').trim(),
                                    content: String(currentHeading?.content || '').trim(),
                                    path: '',
                                    sort: Number.NaN,
                                    created: '',
                                    rank: Number(currentHeading?.rank),
                                });
                            });
                        }
                    }
                } catch (e) {}
            }
            __tmSetAuxCache(cacheKey, Array.from(contextMap.entries()));
            return contextMap;
        },

        async fetchTaskFlowRanksLegacy(taskIds) {
            const ids = Array.from(new Set((taskIds || []).map(x => String(x || '').trim()).filter(Boolean))).sort();
            if (ids.length === 0) return new Map();
            const cacheKey = `flowrank:${ids.length}:${__tmHashIds(ids)}`;
            const cached = __tmGetAuxCache(cacheKey, 5000);
            if (cached) return new Map(cached);
            const out = new Map();
            const escId = (s) => String(s || '').replace(/'/g, "''");
            const batchSize = 200;

            // 先按文档划分任务
            const tasksByDoc = new Map();
            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                const idList = batch.map(id => `'${escId(id)}'`).join(',');
                const batchLimit = Math.max(1, Math.min(5000, batch.length));
                const sql = `
                    SELECT id AS task_id, root_id
                    FROM blocks
                    WHERE id IN (${idList})
                    LIMIT ${batchLimit}
                `;
                try {
                    const res = await this.call('/api/query/sql', { stmt: sql });
                    if (res.code === 0 && Array.isArray(res.data)) {
                        res.data.forEach((r) => {
                            const tid = String(r?.task_id || '').trim();
                            const docId = String(r?.root_id || '').trim();
                            if (!tid || !docId) return;
                            if (!tasksByDoc.has(docId)) tasksByDoc.set(docId, new Set());
                            tasksByDoc.get(docId).add(tid);
                        });
                    }
                } catch (e) {}
            }

            // 主路径：基于文档 kramdown 中 block id 的出现顺序，得到最稳定的文档流顺序
            for (const [docId, tidSet] of tasksByDoc.entries()) {
                let km = '';
                try { km = await this.getBlockKramdown(docId); } catch (e) { km = ''; }
                if (!km) continue;
                let rank = 0;
                const re = /\{\:\s*[^}]*\bid=(?:"([^"]+)"|'([^']+)')[^}]*\}/g;
                let m;
                while ((m = re.exec(String(km))) !== null) {
                    const bid = String(m?.[1] || m?.[2] || '').trim();
                    if (!bid || !tidSet.has(bid) || out.has(bid)) continue;
                    rank += 1;
                    out.set(bid, rank);
                }
            }

            // 回退：对于未在 kramdown 顺序中命中的任务，再用 SQL 递归顺序补齐
            const missing = ids.filter((id) => !out.has(id));
            for (let i = 0; i < missing.length; i += batchSize) {
                const batch = missing.slice(i, i + batchSize);
                if (batch.length === 0) continue;
                const idList = batch.map(id => `'${escId(id)}'`).join(',');
                const batchLimit = Math.max(1, Math.min(5000, batch.length));
                const sql = `
                    WITH RECURSIVE task_roots AS (
                        SELECT id AS task_id, root_id
                        FROM blocks
                        WHERE id IN (${idList})
                    ),
                    doc_roots AS (
                        SELECT DISTINCT task_roots.root_id AS doc_root_id
                        FROM task_roots
                    ),
                    doc_tree AS (
                        SELECT
                            d.id,
                            d.id AS root_id,
                            0 AS depth,
                            '' AS order_key
                        FROM blocks d
                        WHERE d.id IN (SELECT doc_root_id FROM doc_roots)
                        UNION ALL
                        SELECT
                            b.id,
                            t.root_id,
                            t.depth + 1 AS depth,
                            (t.order_key || '/' ||
                                CASE
                                    WHEN TRIM(CAST(b.sort AS TEXT)) GLOB '[0-9]*' AND TRIM(CAST(b.sort AS TEXT)) != ''
                                        THEN ('0:' || printf('%020d', CAST(TRIM(CAST(b.sort AS TEXT)) AS INTEGER)))
                                    ELSE ('1:' || COALESCE(NULLIF(TRIM(CAST(b.sort AS TEXT)), ''), ''))
                                END
                                || ':' || b.id) AS order_key
                        FROM blocks b
                        INNER JOIN doc_tree t ON b.parent_id = t.id
                        WHERE t.depth < 128
                    ),
                    task_pos AS (
                        SELECT
                            tr.task_id,
                            tr.root_id,
                            COALESCE(dt.order_key, '') AS task_order_key
                        FROM task_roots tr
                        LEFT JOIN doc_tree dt ON dt.id = tr.task_id
                    )
                    SELECT
                        task_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY task_pos.root_id
                            ORDER BY task_order_key, task_id
                        ) AS task_rank
                    FROM task_pos
                    LIMIT ${batchLimit}
                `;
                try {
                    const res = await this.call('/api/query/sql', { stmt: sql });
                    if (res.code === 0 && Array.isArray(res.data)) {
                        res.data.forEach((r) => {
                            const tid = String(r?.task_id || '').trim();
                            const rank = Number(r?.task_rank);
                            if (!tid || !Number.isFinite(rank) || out.has(tid)) return;
                            out.set(tid, rank);
                        });
                    }
                } catch (e) {}
            }
            return out;
        },

        async fetchNearestCustomPriority(taskIds, maxDepth = 8) {
            const ids = Array.from(new Set((taskIds || []).map(x => String(x || '').trim()).filter(Boolean)));
            if (ids.length === 0) return new Map();
            const depth = Number.isFinite(Number(maxDepth)) ? Math.max(1, Math.min(20, Math.floor(Number(maxDepth)))) : 8;
            const escapeId = (s) => String(s).replace(/'/g, "''");
            const seeds = ids.map(id => `('${escapeId(id)}','${escapeId(id)}',0)`).join(',');
            const totalLimit = Math.max(1, Math.min(5000, ids.length));
            const sql = `
                WITH RECURSIVE up(start_id, id, depth) AS (
                    VALUES ${seeds}
                    UNION ALL
                    SELECT up.start_id, b.parent_id, up.depth + 1
                    FROM blocks b
                    JOIN up ON b.id = up.id
                    WHERE up.depth < ${depth}
                      AND b.parent_id IS NOT NULL
                      AND b.parent_id != ''
                ),
                candidates AS (
                    SELECT
                        up.start_id,
                        a.value AS priority,
                        up.depth,
                        ROW_NUMBER() OVER (PARTITION BY up.start_id ORDER BY up.depth ASC) AS rn
                    FROM up
                    JOIN attributes a ON a.block_id = up.id
                    WHERE a.name = 'custom-priority'
                      AND a.value IS NOT NULL
                      AND a.value != ''
                )
                SELECT start_id, priority
                FROM candidates
                WHERE rn = 1
                LIMIT ${totalLimit}
            `;
            const res = await this.call('/api/query/sql', { stmt: sql });
            const map = new Map();
            if (res.code === 0 && Array.isArray(res.data)) {
                res.data.forEach(row => {
                    const id = String(row?.start_id || '').trim();
                    const v = String(row?.priority || '').trim();
                    if (id && v) map.set(id, v);
                });
            }
            return map;
        },

        async setAttr(id, key, val) {
            const res = await this.call('/api/attr/setBlockAttrs', {
                id: id,
                attrs: { [`custom-${key}`]: String(val) }
            });
            if (res.code !== 0) throw new Error(res.msg || '保存属性失败');
            return true;
        },

        async setAttrs(id, attrs) {
            const payload = {};
            try {
                Object.entries(attrs || {}).forEach(([k, v]) => {
                    if (!k) return;
                    payload[String(k)] = String(v ?? '');
                });
            } catch (e) {}
            const res = await this.call('/api/attr/setBlockAttrs', { id, attrs: payload });
            if (res.code !== 0) throw new Error(res.msg || '保存属性失败');
            return true;
        },

        async searchAssets(keyword, options = {}) {
            const query = String(keyword || '').trim();
            if (!query) return [];
            const opts = (options && typeof options === 'object') ? options : {};
            const exts = Array.isArray(opts.exts)
                ? opts.exts.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
                : [];
            const res = await this.call('/api/search/searchAsset', { k: query, exts });
            if (res.code !== 0) throw new Error(res.msg || '搜索附件失败');
            const limit = Number.isFinite(Number(opts.limit))
                ? Math.max(1, Math.min(200, Math.floor(Number(opts.limit))))
                : 60;
            return (Array.isArray(res.data) ? res.data : [])
                .map((item) => {
                    const path = __tmNormalizeTaskAttachmentPath(item?.path || '');
                    if (!path) return null;
                    return {
                        path,
                        name: __tmGetTaskAttachmentDisplayName(path),
                        hName: String(item?.hName || item?.name || '').trim(),
                    };
                })
                .filter(Boolean)
                .slice(0, limit);
        },

        async searchDocs(keyword, options = {}) {
            const query = String(keyword || '').trim();
            if (!query) return [];
            const opts = (options && typeof options === 'object') ? options : {};
            const excludeIDs = Array.isArray(opts.excludeIDs)
                ? opts.excludeIDs.map((item) => String(item || '').trim()).filter(Boolean)
                : [];
            const res = await this.call('/api/filetree/searchDocs', {
                k: query,
                flashcard: false,
                excludeIDs,
            });
            if (res.code !== 0) throw new Error(res.msg || '搜索文档失败');
            const limit = Number.isFinite(Number(opts.limit))
                ? Math.max(1, Math.min(200, Math.floor(Number(opts.limit))))
                : 60;
            const uniqueRows = [];
            const seen = new Set();
            (Array.isArray(res.data) ? res.data : []).forEach((item) => {
                const box = String(item?.box || '').trim();
                const path = String(item?.path || '').trim();
                const hPath = String(item?.hPath || '').trim();
                if (!box || !path || path === '/' || !hPath) return;
                const key = `${box}::${path}`;
                if (seen.has(key)) return;
                seen.add(key);
                uniqueRows.push({ box, path, hPath });
            });
            const pickedRows = uniqueRows.slice(0, limit);
            if (!pickedRows.length) return [];
            const where = pickedRows
                .map((item) => `(box = '${item.box.replace(/'/g, "''")}' AND path = '${item.path.replace(/'/g, "''")}')`)
                .join(' OR ');
            const sql = `
                SELECT id, box, path, hpath, content
                FROM blocks
                WHERE type = 'd' AND (${where})
                LIMIT ${Math.max(1, pickedRows.length)}
            `;
            const docRes = await this.call('/api/query/sql', { stmt: sql });
            if (docRes.code !== 0) throw new Error(docRes.msg || '解析文档失败');
            const docMap = new Map();
            (Array.isArray(docRes.data) ? docRes.data : []).forEach((row) => {
                const box = String(row?.box || '').trim();
                const path = String(row?.path || '').trim();
                const id = String(row?.id || '').trim();
                if (!box || !path || !id) return;
                docMap.set(`${box}::${path}`, row);
            });
            return pickedRows.map((item) => {
                const row = docMap.get(`${item.box}::${item.path}`);
                const id = String(row?.id || '').trim();
                if (!id) return null;
                const name = String(row?.content || '').trim() || '未命名文档';
                const displayPath = item.hPath || String(row?.hpath || '').trim() || name;
                try {
                    __tmPrimeTaskAttachmentBlockMeta({
                        id,
                        type: 'd',
                        content: name,
                        doc_name: name,
                        doc_path: displayPath,
                    });
                } catch (e) {}
                return {
                    id,
                    path: __tmBuildTaskAttachmentBlockToken(id),
                    name,
                    displayPath,
                    hPath: displayPath,
                };
            }).filter(Boolean);
        },

        async uploadAssets(files, options = {}) {
            const list = Array.from(files || []).filter((file) => file instanceof File);
            if (!list.length) return [];
            const opts = (options && typeof options === 'object') ? options : {};
            const form = new FormData();
            form.append('assetsDirPath', String(opts.assetsDirPath || '/assets/').trim() || '/assets/');
            list.forEach((file) => {
                form.append('file[]', file, file.name);
            });
            const res = await fetch('/api/asset/upload', {
                method: 'POST',
                body: form,
            });
            const text = await res.text();
            let json = {};
            try {
                json = text ? JSON.parse(text) : {};
            } catch (e) {
                throw new Error(`HTTP ${res.status}`);
            }
            if (!res.ok || Number(json?.code) !== 0) {
                throw new Error(String(json?.msg || `HTTP ${res.status}` || '上传附件失败'));
            }
            const succMap = (json?.data?.succMap && typeof json.data.succMap === 'object') ? json.data.succMap : {};
            return list
                .map((file) => __tmNormalizeTaskAttachmentPath(succMap[file.name] || ''))
                .filter(Boolean);
        },

        async updateBlock(id, md, dataType = 'markdown') {
            const res = await this.call('/api/block/updateBlock', {
                id: id,
                data: md,
                dataType: dataType
            });
            if (res.code !== 0) {
                if (res.msg?.includes('not found')) {
                    throw new Error(`块 ${id.slice(-6)} 不存在`);
                }
                throw new Error(res.msg || '更新块失败');
            }
            const opId = this._getInsertedId(res);
            return { res, id: opId || id };
        },

        async updateTaskListItemMarker(id, marker) {
            const payload = {
                id: String(id || '').trim(),
                marker: __tmNormalizeTaskStatusMarker(marker, ' '),
            };
            const res = await this.call('/api/block/updateTaskListItemMarker', payload);
            if (res.code !== 0) throw new Error(res.msg || '更新任务状态标记失败');
            return res.data;
        },

        async batchUpdateTaskListItemMarker(items) {
            const payloadItems = (Array.isArray(items) ? items : [])
                .map((item) => ({
                    id: String(item?.id || '').trim(),
                    marker: __tmNormalizeTaskStatusMarker(item?.marker, ' '),
                }))
                .filter((item) => item.id);
            if (!payloadItems.length) return [];
            const res = await this.call('/api/block/batchUpdateTaskListItemMarker', { items: payloadItems });
            if (res.code !== 0) throw new Error(res.msg || '批量更新任务状态标记失败');
            return res.data;
        },

        // 生成任务DOM（用于DOM模式更新，避免ID变化）
        generateTaskDOM(id, content, done = false) {
            // HTML转义内容，防止特殊字符导致DOM解析错误
            const escapedContent = String(content || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            // 使用思源正确的DOM格式
            const checkboxIcon = done
                ? '<svg><use xlink:href="#iconCheck"></use></svg>'
                : '<svg><use xlink:href="#iconUncheck"></use></svg>';
            const doneClass = done ? ' protyle-task--done' : '';
            // 正确的DOM结构：div.NodeList > div.NodeListItem > div.protyle-action + div.NodeParagraph
            return `<div data-type="NodeList" data-subtype="t">
<div data-type="NodeListItem" class="li${doneClass}" data-node-id="${id}">
  <div class="protyle-action protyle-action--task" draggable="true">${checkboxIcon}</div>
  <div data-type="NodeParagraph" class="p">
    <div contenteditable="true" spellcheck="false">${escapedContent}</div>
    <div class="protyle-attr" contenteditable="false"></div>
  </div>
  <div class="protyle-attr" contenteditable="false"></div>
</div>
</div>`;
        },

        _getInsertedId(res) {
            try {
                const ops = res?.data;
                const id = ops?.[0]?.doOperations?.[0]?.id;
                return id || null;
            } catch (e) {
                return null;
            }
        },

        async insertBlock(parentId, md, placement) {
            const payload = { parentID: parentId, data: md, dataType: 'markdown' };
            if (placement && typeof placement === 'object') {
                const nextID = String(placement.nextID || '').trim();
                const previousID = String(placement.previousID || '').trim();
                const parentID = String(placement.parentID || parentId || '').trim();
                if (nextID) payload.nextID = nextID;
                if (previousID) payload.previousID = previousID;
                if (!nextID && !previousID && parentID) payload.parentID = parentID;
            } else {
                const nextID = String(placement || '').trim();
                if (nextID) payload.nextID = nextID;
            }
            const res = await this.call('/api/block/insertBlock', payload);
            if (res.code !== 0) throw new Error(res.msg);
            const id = this._getInsertedId(res);
            if (!id) throw new Error('插入失败');
            return id;
        },

        async appendBlock(parentId, md) {
            const res = await this.call('/api/block/appendBlock', { parentID: parentId, data: md, dataType: 'markdown' });
            if (res.code !== 0) throw new Error(res.msg);
            const id = this._getInsertedId(res);
            if (!id) throw new Error('追加失败');
            return id;
        },

        async moveBlock(id, { previousID, parentID, nextID } = {}) {
            const pid = String(previousID || '');
            const par = String(parentID || '');
            const nid = String(nextID || '');
            if (!pid && !par && !nid) throw new Error('移动失败：缺少目标位置');
            const payload = { id };
            if (pid) payload.previousID = pid;
            if (par) payload.parentID = par;
            if (nid) payload.nextID = nid;
            const res = await this.call('/api/block/moveBlock', payload);
            if (res.code !== 0) throw new Error(res.msg || '移动块失败');
            return true;
        },

        async getLastDirectChildIdOfDoc(docId) {
            const id = String(docId || '').trim();
            if (!id) return null;
            const sql = `SELECT id FROM blocks WHERE parent_id = '${id}' ORDER BY created DESC LIMIT 1`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const lastId = String(res.data[0]?.id || '').trim();
                if (lastId && lastId !== id) return lastId;
            }
            return null;
        },

        async getFirstDirectChildIdOfDoc(docId) {
            const id = String(docId || '').trim();
            if (!id) return null;
            const sql = `SELECT id FROM blocks WHERE parent_id = '${id}' ORDER BY sort ASC, created ASC, id ASC LIMIT 1`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const firstId = String(res.data[0]?.id || '').trim();
                if (firstId && firstId !== id) return firstId;
            }
            return null;
        },

        async getChildBlocks(blockId) {
            const id = String(blockId || '').trim();
            if (!id) return [];
            const res = await this.call('/api/block/getChildBlocks', { id });
            if (res.code === 0 && Array.isArray(res.data)) return res.data;
            return [];
        },

        async getFirstDirectChildListIdOfDoc(docId) {
            const id = String(docId || '').trim();
            if (!id) return null;
            const sql = `SELECT id FROM blocks WHERE parent_id = '${id}' AND type = 'l' ORDER BY created ASC LIMIT 1`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const listId = String(res.data[0]?.id || '').trim();
                if (listId) return listId;
            }
            return null;
        },

        async getBlockInfo(id) {
            const res = await this.call('/api/block/getBlockInfo', { id });
            if (res.code !== 0) throw new Error(res.msg);
            return res.data;
        },

        async getChildListIdOfTask(taskId) {
            const sql = `SELECT id FROM blocks WHERE parent_id = '${taskId}' AND type = 'l' LIMIT 1`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) return res.data[0].id || null;
            return null;
        },

        async getDirectChildTaskIdsOfTaskByDom(taskId) {
            const tid = String(taskId || '').trim();
            if (!tid) return [];
            let html = '';
            try { html = String(await this.getBlockDOM(tid) || ''); } catch (e) { html = ''; }
            if (!html) return [];

            const pickRoot = (host) => {
                if (!(host instanceof Element)) return null;
                const direct = Array.from(host.children || []).find((el) => String(el?.getAttribute?.('data-node-id') || '').trim() === tid);
                if (direct) return direct;
                const all = Array.from(host.querySelectorAll?.('[data-node-id]') || []);
                return all.find((el) => String(el?.getAttribute?.('data-node-id') || '').trim() === tid) || null;
            };
            const isTaskItem = (el) => String(el?.getAttribute?.('data-type') || '').trim() === 'NodeListItem'
                && String(el?.getAttribute?.('data-subtype') || '').trim() === 't';
            const isTaskList = (el) => String(el?.getAttribute?.('data-type') || '').trim() === 'NodeList';
            const getTaskId = (el) => String(el?.getAttribute?.('data-node-id') || '').trim();
            const collectDirectTaskIdsInList = (listEl) => {
                if (!(listEl instanceof Element)) return [];
                return Array.from(listEl.children || [])
                    .filter((child) => isTaskItem(child))
                    .map((child) => getTaskId(child))
                    .filter(Boolean);
            };

            let host = null;
            try {
                if (typeof DOMParser !== 'undefined') {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(`<div data-tm-dom-host="1">${html}</div>`, 'text/html');
                    host = doc.body?.firstElementChild || null;
                }
            } catch (e) {
                host = null;
            }
            if (!(host instanceof Element) && typeof document !== 'undefined' && document?.createElement) {
                try {
                    const fallbackHost = document.createElement('div');
                    fallbackHost.innerHTML = html;
                    host = fallbackHost;
                } catch (e) {
                    host = null;
                }
            }
            if (!(host instanceof Element)) return [];

            const root = pickRoot(host);
            if (!(root instanceof Element)) return [];
            const out = [];
            Array.from(root.children || []).forEach((child) => {
                if (!(child instanceof Element)) return;
                if (isTaskItem(child)) {
                    const childId = getTaskId(child);
                    if (childId) out.push(childId);
                    return;
                }
                if (isTaskList(child)) {
                    out.push(...collectDirectTaskIdsInList(child));
                }
            });
            return out.filter(Boolean);
        },

        async getTaskIdsInListByDom(listId) {
            const lid = String(listId || '').trim();
            if (!lid) return [];
            let html = '';
            try { html = String(await this.getBlockDOM(lid) || ''); } catch (e) { html = ''; }
            if (!html) return [];

            const pickRoot = (host) => {
                if (!(host instanceof Element)) return null;
                const direct = Array.from(host.children || []).find((el) => String(el?.getAttribute?.('data-node-id') || '').trim() === lid);
                if (direct) return direct;
                const all = Array.from(host.querySelectorAll?.('[data-node-id]') || []);
                return all.find((el) => String(el?.getAttribute?.('data-node-id') || '').trim() === lid) || null;
            };
            const collectTaskIds = (container) => {
                if (!(container instanceof Element)) return [];
                const children = Array.from(container.children || []);
                return children
                    .filter((child) => String(child?.getAttribute?.('data-type') || '').trim() === 'NodeListItem'
                        && String(child?.getAttribute?.('data-subtype') || '').trim() === 't')
                    .map((child) => String(child?.getAttribute?.('data-node-id') || '').trim())
                    .filter(Boolean);
            };

            let host = null;
            try {
                if (typeof DOMParser !== 'undefined') {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(`<div data-tm-dom-host="1">${html}</div>`, 'text/html');
                    host = doc.body?.firstElementChild || null;
                }
            } catch (e) {
                host = null;
            }
            if (!(host instanceof Element) && typeof document !== 'undefined' && document?.createElement) {
                try {
                    const fallbackHost = document.createElement('div');
                    fallbackHost.innerHTML = html;
                    host = fallbackHost;
                } catch (e) {
                    host = null;
                }
            }
            if (!(host instanceof Element)) return [];

            const root = pickRoot(host);
            const directTaskIds = collectTaskIds(root || host);
            return directTaskIds;
        },

        async getDirectChildTaskIdsOfTask(taskId, options = {}) {
            const tid = String(taskId || '').trim();
            const opts = (options && typeof options === 'object') ? options : {};
            if (!tid) return [];
            if (opts.preferDom === true) {
                try {
                    const domTaskIds = await this.getDirectChildTaskIdsOfTaskByDom(tid);
                    if (Array.isArray(domTaskIds) && domTaskIds.length > 0) return domTaskIds;
                } catch (e) {}
            }
            const sql = `SELECT id, type, subtype FROM blocks WHERE parent_id = '${tid}' ORDER BY sort ASC, created ASC, id ASC`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            const rows = (res.code === 0 && Array.isArray(res.data)) ? res.data : [];
            const out = [];
            for (const row of rows) {
                const blockId = String(row?.id || '').trim();
                const blockType = String(row?.type || '').trim().toLowerCase();
                const blockSubtype = String(row?.subtype || '').trim().toLowerCase();
                if (!blockId) continue;
                if (blockType === 'i' && blockSubtype === 't') {
                    out.push(blockId);
                    continue;
                }
                if (blockType === 'l') {
                    try {
                        const childTaskIds = await this.getTaskIdsInList(blockId, { preferDom: opts.preferDom === true });
                        if (Array.isArray(childTaskIds) && childTaskIds.length > 0) out.push(...childTaskIds);
                    } catch (e) {}
                }
            }
            return out.filter(Boolean);
        },

        async getTaskIdsInList(listId, options = {}) {
            const opts = (options && typeof options === 'object') ? options : {};
            if (opts.preferDom === true) {
                try {
                    const domTaskIds = await this.getTaskIdsInListByDom(listId);
                    if (Array.isArray(domTaskIds) && domTaskIds.length > 0) return domTaskIds;
                } catch (e) {}
            }
            const queryLimit = Number.isFinite(Number(SettingsStore.data?.queryLimit)) ? Math.max(1, Math.min(5000, Math.round(Number(SettingsStore.data.queryLimit)))) : 500;
            const totalLimit = Math.max(2000, Math.min(500000, queryLimit * 4));
            const sql = `SELECT id FROM blocks WHERE parent_id = '${listId}' AND type = 'i' AND subtype = 't' ORDER BY sort ASC, created ASC, id ASC LIMIT ${totalLimit}`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data) return res.data.map(r => r.id).filter(Boolean);
            return [];
        },

        async getFirstTaskIdUnderBlock(blockId) {
            const id = String(blockId || '').trim();
            if (!id) return null;
            const sql = `SELECT id FROM blocks WHERE parent_id = '${id}' AND type = 'i' AND subtype = 't' ORDER BY created ASC LIMIT 1`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const tid = String(res.data[0]?.id || '').trim();
                return tid || null;
            }
            return null;
        },

        async getFirstTaskDescendantId(blockId, maxDepth = 6) {
            const id = String(blockId || '').trim();
            const depth = Number.isFinite(Number(maxDepth)) ? Math.max(1, Math.min(20, Math.floor(Number(maxDepth)))) : 6;
            if (!id) return null;
            const sql = `
                WITH RECURSIVE tree(id, depth) AS (
                    SELECT '${id}' AS id, 0 AS depth
                    UNION ALL
                    SELECT b.id, t.depth + 1
                    FROM blocks b
                    JOIN tree t ON b.parent_id = t.id
                    WHERE t.depth < ${depth}
                )
                SELECT b.id
                FROM blocks b
                JOIN tree t ON t.id = b.id
                WHERE b.type = 'i' AND b.subtype = 't'
                ORDER BY t.depth ASC, b.created DESC
                LIMIT 1
            `;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const tid = String(res.data[0]?.id || '').trim();
                return tid || null;
            }
            return null;
        },

        async getBlocksByIds(ids) {
            const list = Array.from(new Set((ids || []).map(x => String(x || '').trim()).filter(Boolean)));
            if (list.length === 0) return [];
            const quoted = list.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
            const totalLimit = Math.max(1, Math.min(5000, list.length));
            const sql = `SELECT id, parent_id, root_id, type, subtype FROM blocks WHERE id IN (${quoted}) LIMIT ${totalLimit}`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && Array.isArray(res.data)) return res.data;
            return [];
        },

        async getOtherBlocksByIds(ids) {
            const list = Array.from(new Set((ids || []).map(x => String(x || '').trim()).filter(Boolean)));
            if (list.length === 0) return [];
            const quoted = list.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
            const totalLimit = Math.max(1, Math.min(5000, list.length));
            const sql = `
                SELECT
                    b.id,
                    b.parent_id,
                    b.root_id,
                    b.type,
                    b.subtype,
                    b.content,
                    b.path,
                    b.sort,
                    b.created,
                    b.updated,
                    CASE
                        WHEN b.type = 'd' THEN b.content
                        ELSE COALESCE(doc.content, '')
                    END AS doc_name,
                    CASE
                        WHEN b.type = 'd' THEN b.hpath
                        ELSE COALESCE(doc.hpath, '')
                    END AS doc_path
                FROM blocks b
                LEFT JOIN blocks doc ON doc.id = b.root_id AND doc.type = 'd'
                WHERE b.id IN (${quoted})
                LIMIT ${totalLimit}
            `;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && Array.isArray(res.data)) return res.data;
            return [];
        },

        async deleteBlock(id) {
            const res = await this.call('/api/block/deleteBlock', { id: id });
            if (res.code !== 0) throw new Error(res.msg);
        }
    };

    const __TM_TASK_REPEAT_RULE_ATTR = 'custom-task-repeat-rule';
    const __TM_TASK_REPEAT_STATE_ATTR = 'custom-task-repeat-state';
    const __TM_TASK_REPEAT_HISTORY_ATTR = 'custom-task-repeat-history';
    const __TM_TASK_COMPLETE_AT_ATTR = 'custom-task-complete-at';
    const __TM_CHINA_TZ_OFFSET_MINUTES = 8 * 60;
    const __TM_CHINA_TZ_SUFFIX = '+08:00';

    const __tmMetaAttrMap = {
        priority: 'custom-priority',
        duration: 'custom-duration',
        remark: 'custom-remark',
        startDate: 'custom-start-date',
        completionTime: 'custom-completion-time',
        taskCompleteAt: __TM_TASK_COMPLETE_AT_ATTR,
        milestone: 'custom-milestone-event',
        customTime: 'custom-time',
        customStatus: 'custom-status',
        pinned: 'custom-pinned',
        repeatRule: __TM_TASK_REPEAT_RULE_ATTR,
        repeatState: __TM_TASK_REPEAT_STATE_ATTR,
        repeatHistory: __TM_TASK_REPEAT_HISTORY_ATTR,
    };

    function __tmFormatTsToChinaTimezoneIso(ts) {
        const num = Number(ts);
        if (!Number.isFinite(num) || num <= 0) return '';
        const dt = new Date(num + __TM_CHINA_TZ_OFFSET_MINUTES * 60000);
        if (Number.isNaN(dt.getTime())) return '';
        const pad = (value, size = 2) => String(value).padStart(size, '0');
        return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())}.${pad(dt.getUTCMilliseconds(), 3)}${__TM_CHINA_TZ_SUFFIX}`;
    }

    function __tmNowInChinaTimezoneIso() {
        return __tmFormatTsToChinaTimezoneIso(Date.now());
    }

    function __tmNormalizeTaskCompleteAtValue(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return '';
        const ts = __tmParseTimeToTs(raw);
        if (Number.isFinite(ts) && ts > 0) {
            try {
                const normalized = __tmFormatTsToChinaTimezoneIso(ts);
                if (normalized) return normalized;
            } catch (e) {}
        }
        return raw;
    }

    function __tmBuildTaskCompleteAtPatch(value = '') {
        const normalized = __tmNormalizeTaskCompleteAtValue(String(value ?? '').trim() || __tmNowInChinaTimezoneIso());
        return normalized ? { taskCompleteAt: normalized } : {};
    }

    function __tmFormatStatusMarkerText(marker) {
        const normalized = __tmNormalizeTaskStatusMarker(marker, ' ');
        return normalized === ' ' ? '空格' : normalized;
    }

    function __tmGuessStatusOptionDefaultMarker(optionLike, fallback = ' ') {
        const option = (optionLike && typeof optionLike === 'object') ? optionLike : {};
        const id = String(option?.id || '').trim().toLowerCase();
        const name = String(option?.name || '').trim().toLowerCase();
        const source = `${id} ${name}`;
        if (!source) return __tmNormalizeTaskStatusMarker(fallback, ' ');
        if (id === 'todo' || id === 'undone' || id === 'in_progress' || id === 'blocked' || id === 'review' || source.includes('待办') || source.includes('未完成') || source.includes('进行中') || source.includes('阻塞') || source.includes('审核')) return ' ';
        if (id === 'cancelled' || id === 'canceled' || id === 'cancel' || source.includes('取消') || source.includes('放弃')) return '-';
        if (id === 'done' || source.includes('完成')) return 'X';
        return __tmNormalizeTaskStatusMarker(fallback, ' ');
    }

    function __tmNormalizeTaskStatusMarker(value, fallback = 'X') {
        const normalizeOne = (input, fallbackValue = 'X') => {
            let raw = input == null ? '' : String(input);
            if (raw === '__space__') raw = ' ';
            const chars = Array.from(raw);
            const first = chars.length ? String(chars[0] || '') : '';
            if (!first) return '';
            if (first === '[' || first === ']') return '';
            try {
                if (typeof TextEncoder !== 'undefined' && new TextEncoder().encode(first).length !== 1) return '';
            } catch (e) {}
            return first;
        };
        const rawFallback = fallback == null ? 'X' : String(fallback);
        const fallbackMarker = rawFallback === '' ? '' : (normalizeOne(rawFallback, 'X') || 'X');
        const normalized = normalizeOne(value, fallbackMarker);
        return normalized || fallbackMarker;
    }

    function __tmNormalizeCustomStatusOption(option, index = 0) {
        const source = (option && typeof option === 'object') ? option : {};
        const id = String(source?.id || '').trim();
        if (!id) return null;
        const name = String(source?.name || id).trim() || id;
        const color = __tmNormalizeHexColor(source?.color, __tmGetStatusPresetColor(index)) || __tmGetStatusPresetColor(index);
        const markerFallback = __tmGuessStatusOptionDefaultMarker({ id, name }, ' ');
        const marker = __tmNormalizeTaskStatusMarker(Object.prototype.hasOwnProperty.call(source, 'marker') ? source.marker : markerFallback, markerFallback);
        return { id, name, color, marker };
    }

    function __tmNormalizeCustomStatusOptions(optionsInput) {
        const list = Array.isArray(optionsInput) ? optionsInput : [];
        const out = [];
        const seen = new Set();
        list.forEach((item, index) => {
            const normalized = __tmNormalizeCustomStatusOption(item, index);
            const id = String(normalized?.id || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(normalized);
        });
        return out.length
            ? out
            : [
                { id: 'todo', name: '待办', color: '#757575', marker: ' ' },
                { id: 'done', name: '已完成', color: '#4CAF50', marker: 'X' },
                { id: 'cancelled', name: '已取消', color: '#9E9E9E', marker: '-' },
                { id: 'blocked', name: '阻塞', color: '#F44336', marker: ' ' },
                { id: 'review', name: '待审核', color: '#FF9800', marker: ' ' }
            ];
    }

    function __tmNormalizeDurationPresetValue(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return '';
        const matched = raw.match(/-?\d+(?:\.\d+)?/);
        return matched ? String(matched[0] || '').trim() : '';
    }

    function __tmNormalizeCustomDurationOption(option) {
        const source = (option && typeof option === 'object' && !Array.isArray(option)) ? option : null;
        return __tmNormalizeDurationPresetValue(source ? (source.value ?? source.name ?? source.label) : option);
    }

    function __tmNormalizeCustomDurationOptions(optionsInput) {
        const list = Array.isArray(optionsInput) ? optionsInput : [];
        const out = [];
        const seen = new Set();
        list.forEach((item) => {
            const normalized = __tmNormalizeCustomDurationOption(item);
            const value = String(normalized || '').trim().toLowerCase();
            if (!value || seen.has(value)) return;
            seen.add(value);
            out.push(normalized);
        });
        return out;
    }

    function __tmGetDurationPresetOptions(optionsInput = null) {
        const durationOptions = Array.isArray(optionsInput)
            ? optionsInput
            : (Array.isArray(SettingsStore?.data?.customDurationOptions) ? SettingsStore.data.customDurationOptions : []);
        return __tmNormalizeCustomDurationOptions(durationOptions);
    }

    function __tmBuildDurationPresetOptionsHtml(selectedValue, optionsInput = null) {
        const options = __tmGetDurationPresetOptions(optionsInput);
        const selected = __tmNormalizeDurationPresetValue(selectedValue).toLowerCase();
        return options.map((item) => {
            const value = __tmNormalizeDurationPresetValue(item);
            const active = !!selected && value.toLowerCase() === selected;
            return `
                <button type="button" class="tm-duration-preset-option ${active ? 'is-selected' : ''}" data-tm-duration-preset-value="${esc(value)}" aria-pressed="${active ? 'true' : 'false'}">
                    <span class="tm-duration-preset-option__main">
                        <span class="tm-duration-preset-option__title">${esc(value)}</span>
                    </span>
                    <span class="tm-duration-preset-option__check" aria-hidden="true">✓</span>
                </button>
            `;
        }).join('');
    }

    function __tmBindDurationPresetSelection(root, input, options = {}) {
        if (!(root instanceof Element) || !(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
            return {
                sync() {},
                getValue() {
                    return '';
                },
                setValue() {},
            };
        }
        const opts = (options && typeof options === 'object') ? options : {};
        const bind = (target, type, handler, listenerOptions) => {
            if (!target?.addEventListener) return;
            try {
                target.addEventListener(type, handler, listenerOptions || false);
            } catch (e) {
                try { target.addEventListener(type, handler); } catch (e2) {}
            }
        };
        const buttons = Array.from(root.querySelectorAll('[data-tm-duration-preset-value]')).filter((el) => el instanceof HTMLButtonElement);
        const normalize = (value) => __tmNormalizeDurationPresetValue(value).toLowerCase();
        const sync = () => {
            const current = normalize(input.value);
            buttons.forEach((btn) => {
                const value = normalize(btn.getAttribute('data-tm-duration-preset-value') || '');
                const selected = !!current && current === value;
                btn.classList.toggle('is-selected', selected);
                btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
            });
        };
        buttons.forEach((btn) => {
            bind(btn, 'click', async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                input.value = __tmNormalizeDurationPresetValue(btn.getAttribute('data-tm-duration-preset-value') || '');
                sync();
                if (typeof opts.onSelect === 'function') {
                    try { await opts.onSelect(input.value, btn); } catch (e) {}
                }
                if (opts.focusInputOnSelect !== false) {
                    try {
                        input.focus();
                        if (opts.selectInput !== false) input.select?.();
                    } catch (e) {}
                }
            });
        });
        bind(input, 'input', sync);
        bind(input, 'change', sync);
        sync();
        return {
            sync,
            getValue() {
                return String(input.value || '').trim();
            },
            setValue(nextValue) {
                input.value = __tmNormalizeDurationPresetValue(nextValue);
                sync();
            },
        };
    }

    const __tmStatusOptionsRuntimeCache = {
        input: null,
        fingerprint: '',
        settingsVersion: 0,
        options: [],
        idMap: new Map(),
        markerMap: new Map(),
    };

    function __tmBuildStatusOptionsLookupMaps(statusOptions) {
        const source = Array.isArray(statusOptions) ? statusOptions : [];
        const idMap = new Map();
        const markerMap = new Map();
        source.forEach((item) => {
            const id = String(item?.id || '').trim();
            if (id && !idMap.has(id)) idMap.set(id, item);
            const marker = __tmNormalizeTaskStatusMarker(item?.marker, __tmGuessStatusOptionDefaultMarker(item));
            if (!markerMap.has(marker)) markerMap.set(marker, item);
        });
        return { idMap, markerMap };
    }

    function __tmGetStatusOptionsRuntimeArtifacts(statusOptionsInput = null) {
        const input = Array.isArray(statusOptionsInput)
            ? statusOptionsInput
            : (Array.isArray(SettingsStore?.data?.customStatusOptions) ? SettingsStore.data.customStatusOptions : []);
        const settingsVersion = Number(SettingsStore?.data?.settingsUpdatedAt || 0);
        if (statusOptionsInput == null
            && __tmStatusOptionsRuntimeCache.input === input
            && __tmStatusOptionsRuntimeCache.settingsVersion === settingsVersion
            && Array.isArray(__tmStatusOptionsRuntimeCache.options)
            && __tmStatusOptionsRuntimeCache.idMap instanceof Map
            && __tmStatusOptionsRuntimeCache.markerMap instanceof Map) {
            return __tmStatusOptionsRuntimeCache;
        }
        let fingerprint = '';
        try {
            fingerprint = JSON.stringify(input);
        } catch (e) {}
        if (__tmStatusOptionsRuntimeCache.input === input
            && __tmStatusOptionsRuntimeCache.fingerprint === fingerprint
            && Array.isArray(__tmStatusOptionsRuntimeCache.options)
            && __tmStatusOptionsRuntimeCache.idMap instanceof Map
            && __tmStatusOptionsRuntimeCache.markerMap instanceof Map) {
            return __tmStatusOptionsRuntimeCache;
        }
        const nextOptions = __tmNormalizeCustomStatusOptions(input);
        const lookupMaps = __tmBuildStatusOptionsLookupMaps(nextOptions);
        __tmStatusOptionsRuntimeCache.input = input;
        __tmStatusOptionsRuntimeCache.fingerprint = fingerprint;
        __tmStatusOptionsRuntimeCache.settingsVersion = settingsVersion;
        __tmStatusOptionsRuntimeCache.options = nextOptions;
        __tmStatusOptionsRuntimeCache.idMap = lookupMaps.idMap;
        __tmStatusOptionsRuntimeCache.markerMap = lookupMaps.markerMap;
        return __tmStatusOptionsRuntimeCache;
    }

    function __tmGetStatusOptions(statusOptionsInput = null) {
        return __tmGetStatusOptionsRuntimeArtifacts(statusOptionsInput).options;
    }

    function __tmFindStatusOptionById(statusId, statusOptionsInput = null) {
        const id = String(statusId || '').trim();
        if (!id) return null;
        const artifacts = __tmGetStatusOptionsRuntimeArtifacts(statusOptionsInput);
        if (artifacts.idMap instanceof Map) return artifacts.idMap.get(id) || null;
        const statusOptions = Array.isArray(artifacts.options) ? artifacts.options : [];
        return statusOptions.find((item) => String(item?.id || '').trim() === id) || null;
    }

    function __tmFindStatusOptionByMarker(marker, statusOptionsInput = null) {
        const normalizedMarker = __tmNormalizeTaskStatusMarker(marker, ' ');
        const artifacts = __tmGetStatusOptionsRuntimeArtifacts(statusOptionsInput);
        if (artifacts.markerMap instanceof Map) return artifacts.markerMap.get(normalizedMarker) || null;
        const statusOptions = Array.isArray(artifacts.options) ? artifacts.options : [];
        return statusOptions.find((item) => __tmNormalizeTaskStatusMarker(item?.marker, __tmGuessStatusOptionDefaultMarker(item)) === normalizedMarker) || null;
    }

    function __tmIsTaskMarkerDone(marker) {
        return __tmNormalizeTaskStatusMarker(marker, ' ') !== ' ';
    }

    function __tmResolveTaskMarkdownMarker(task) {
        const markdown = String(task?.markdown || '');
        if (!markdown) return '';
        try {
            const parsed = API.parseTaskStatus(markdown);
            return __tmNormalizeTaskStatusMarker(parsed?.marker, '');
        } catch (e) {
            return '';
        }
    }

    function __tmResolveTaskMarker(task, statusOptionsInput = null) {
        const taskLike = (task && typeof task === 'object') ? task : {};
        const directMarker = taskLike.taskMarker ?? taskLike.task_marker ?? taskLike.marker;
        const normalizedDirect = __tmNormalizeTaskStatusMarker(directMarker, '');
        if (normalizedDirect) return normalizedDirect;
        const parsedMarker = __tmResolveTaskMarkdownMarker(taskLike);
        if (parsedMarker) return parsedMarker;
        const configuredStatus = String(taskLike?.customStatus ?? taskLike?.custom_status ?? '').trim();
        if (configuredStatus) {
            const matched = __tmFindStatusOptionById(configuredStatus, statusOptionsInput);
            if (matched) return __tmNormalizeTaskStatusMarker(matched?.marker, __tmGuessStatusOptionDefaultMarker(matched));
        }
        return taskLike?.done ? 'X' : ' ';
    }

    function __tmResolveTaskStatusId(task, statusOptionsInput = null) {
        const statusOptions = __tmGetStatusOptions(statusOptionsInput);
        const configuredStatus = String(task?.customStatus ?? task?.custom_status ?? '').trim();
        if (configuredStatus) return configuredStatus;
        const marker = __tmResolveTaskMarker(task, statusOptions);
        const matched = __tmFindStatusOptionByMarker(marker, statusOptions);
        if (matched?.id) return String(matched.id || '').trim();
        return __tmIsTaskMarkerDone(marker)
            ? String(__tmResolveCheckboxLinkedStatusId(true, statusOptions) || 'done').trim() || 'done'
            : __tmGetDefaultUndoneStatusId(statusOptions);
    }

    function __tmNormalizeCheckboxStatusBindingValue(value) {
        const normalized = String(value ?? '').trim();
        if (!normalized || normalized === '__none__') return '';
        return normalized;
    }

    function __tmGetCheckboxStatusBindingFallbackId(done, statusOptionsInput = null) {
        const statusOptions = __tmGetStatusOptions(statusOptionsInput);
        if (done) {
            const exists = statusOptions.some((item) => String(item?.id || '').trim() === 'done');
            return exists ? 'done' : '';
        }
        const todoExists = statusOptions.some((item) => String(item?.id || '').trim() === 'todo');
        if (todoExists) return 'todo';
        return String(statusOptions[0]?.id || '').trim();
    }

    function __tmGetDefaultUndoneStatusId(statusOptionsInput = null) {
        const statusOptions = __tmGetStatusOptions(statusOptionsInput);
        const configured = __tmNormalizeCheckboxStatusBindingValue(SettingsStore?.data?.checkboxUndoneStatusId);
        if (configured && statusOptions.some((item) => String(item?.id || '').trim() === configured)) return configured;
        return __tmGetCheckboxStatusBindingFallbackId(false, statusOptions) || 'todo';
    }

    function __tmResolveUndoneStatusValue(value, statusOptionsInput = null) {
        const raw = String(value ?? '').trim();
        if (raw) return raw;
        return __tmGetDefaultUndoneStatusId(statusOptionsInput);
    }

    function __tmNormalizeCheckboxStatusBindingConfig(target) {
        const store = (target && typeof target === 'object') ? target : null;
        if (!store) return target;
        store.customStatusOptions = __tmNormalizeCustomStatusOptions(store.customStatusOptions);
        const statusOptions = Array.isArray(store.customStatusOptions) ? store.customStatusOptions : [];
        const statusIds = new Set(statusOptions.map((item) => String(item?.id || '').trim()).filter(Boolean));
        const normalizeOne = (rawValue, done) => {
            const normalized = __tmNormalizeCheckboxStatusBindingValue(rawValue);
            if (!normalized) return done ? '' : (__tmGetCheckboxStatusBindingFallbackId(false, statusOptions) || 'todo');
            if (!statusIds.size || statusIds.has(normalized)) return normalized;
            return __tmGetCheckboxStatusBindingFallbackId(done, statusOptions);
        };
        store.checkboxDoneStatusId = normalizeOne(store.checkboxDoneStatusId, true);
        store.checkboxUndoneStatusId = normalizeOne(store.checkboxUndoneStatusId, false);
        return store;
    }

    function __tmResolveCheckboxLinkedStatusId(done, statusOptionsInput = null) {
        const statusOptions = __tmGetStatusOptions(statusOptionsInput);
        const configured = __tmNormalizeCheckboxStatusBindingValue(done ? SettingsStore?.data?.checkboxDoneStatusId : SettingsStore?.data?.checkboxUndoneStatusId);
        if (!configured) return '';
        if (statusOptions.some((item) => String(item?.id || '').trim() === configured)) return configured;
        return done ? __tmGetCheckboxStatusBindingFallbackId(true, statusOptions) : __tmGetDefaultUndoneStatusId(statusOptions);
    }

    function __tmDoesStatusIdResolveToDone(statusId, statusOptionsInput = null) {
        const sid = String(statusId || '').trim();
        if (!sid) return false;
        const matched = __tmFindStatusOptionById(sid, statusOptionsInput);
        if (!matched) return false;
        const marker = __tmNormalizeTaskStatusMarker(matched?.marker, __tmGuessStatusOptionDefaultMarker(matched));
        return __tmIsTaskMarkerDone(marker);
    }

    function __tmShouldApplyUndoneStatusFallback(task, expectedStatus, currentStatus = '', persistedStatus = '', statusOptionsInput = null, domDone = false) {
        const expected = String(expectedStatus || '').trim();
        if (!expected) return false;
        const persisted = String(persistedStatus || '').trim();
        const current = String(currentStatus || '').trim();
        const effective = persisted || current;
        if (!effective) return true;
        if (effective === expected) return true;
        const effectiveDone = __tmDoesStatusIdResolveToDone(effective, statusOptionsInput);
        if (effectiveDone !== !!domDone) return true;
        return false;
    }

    function __tmResolveTaskStatusDisplayOption(task, statusOptionsInput = null, options = {}) {
        const statusArtifacts = __tmGetStatusOptionsRuntimeArtifacts(statusOptionsInput);
        const statusOptions = Array.isArray(statusArtifacts.options) ? statusArtifacts.options : [];
        const opts = (options && typeof options === 'object') ? options : {};
        const taskLike = (task && typeof task === 'object') ? task : {};
        const directMarker = taskLike.taskMarker ?? taskLike.task_marker ?? taskLike.marker;
        let marker = __tmNormalizeTaskStatusMarker(directMarker, '');
        if (!marker) marker = __tmResolveTaskMarkdownMarker(taskLike);
        const configuredStatus = String(taskLike?.customStatus ?? taskLike?.custom_status ?? '').trim();
        const configuredMatched = configuredStatus
            ? ((statusArtifacts.idMap instanceof Map ? statusArtifacts.idMap.get(configuredStatus) : null) || null)
            : null;
        if (!marker) {
            if (configuredMatched) marker = __tmNormalizeTaskStatusMarker(configuredMatched?.marker, __tmGuessStatusOptionDefaultMarker(configuredMatched));
            else marker = taskLike?.done ? 'X' : ' ';
        }
        const done = __tmIsTaskMarkerDone(marker);
        let resolvedId = configuredStatus;
        let matched = configuredMatched;
        if (!resolvedId) {
            matched = (statusArtifacts.markerMap instanceof Map ? statusArtifacts.markerMap.get(marker) : null) || null;
            if (matched?.id) resolvedId = String(matched.id || '').trim();
            else resolvedId = done
                ? String(__tmResolveCheckboxLinkedStatusId(true, statusOptions) || 'done').trim() || 'done'
                : __tmGetDefaultUndoneStatusId(statusOptions);
        }
        const fallbackColor = String(opts.fallbackColor || (done ? '#9e9e9e' : '#757575')).trim() || (done ? '#9e9e9e' : '#757575');
        const fallbackName = String(opts.fallbackName || (done ? '完成' : '待办')).trim() || (done ? '完成' : '待办');
        if (matched) {
            return {
                id: String(matched.id || resolvedId || '').trim(),
                name: String(matched.name || matched.id || fallbackName).trim() || fallbackName,
                color: String(matched.color || fallbackColor).trim() || fallbackColor,
            };
        }
        if (resolvedId) {
            return {
                id: resolvedId,
                name: resolvedId,
                color: fallbackColor,
            };
        }
        return {
            id: done ? '__done__' : 'todo',
            name: fallbackName,
            color: fallbackColor,
        };
    }

    function __tmBuildCheckboxStatusPatch(task, done, explicitPatch = null) {
        const statusOptions = Array.isArray(SettingsStore?.data?.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        const inputPatch = (explicitPatch && typeof explicitPatch === 'object' && !Array.isArray(explicitPatch)) ? explicitPatch : null;
        if (inputPatch && Object.keys(inputPatch).length > 0) {
            const normalizedPatch = {};
            Object.entries(inputPatch).forEach(([key, rawValue]) => {
                const normalizedValue = __tmNormalizeQueueTaskValue(key, rawValue);
                if (key === 'customStatus') {
                    if (!normalizedValue) return;
                    if (statusOptions.length && !statusOptions.some((item) => String(item?.id || '').trim() === normalizedValue)) return;
                }
                normalizedPatch[key] = normalizedValue;
            });
            return Object.keys(normalizedPatch).length ? normalizedPatch : null;
        }
        const nextStatusId = __tmResolveCheckboxLinkedStatusId(done, statusOptions);
        if (!nextStatusId) return null;
        const currentStatusId = String(task?.customStatus || '').trim();
        if (currentStatusId === nextStatusId) return null;
        return { customStatus: nextStatusId };
    }

    function __tmRenderCheckboxStatusBindingOptionsHtml(selectedValue, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const allowNone = opts.allowNone !== false;
        const normalizedSelected = __tmNormalizeCheckboxStatusBindingValue(selectedValue);
        const statusOptions = Array.isArray(SettingsStore?.data?.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        const rows = [
            ...(allowNone ? [{ id: '__none__', name: '不自动切换' }] : []),
            ...statusOptions.map((item) => ({
                id: String(item?.id || '').trim(),
                name: String(item?.name || item?.id || '').trim() || String(item?.id || '').trim()
            })).filter((item) => item.id)
        ];
        if (normalizedSelected && !rows.some((item) => item.id === normalizedSelected)) {
            rows.push({ id: normalizedSelected, name: `当前值已删除：${normalizedSelected}` });
        }
        const selectedId = normalizedSelected || (allowNone ? '__none__' : __tmGetDefaultUndoneStatusId(statusOptions));
        return rows.map((item) => `<option value="${esc(item.id)}" ${selectedId === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('');
    }

    function __tmBuildAttrPayloadFromPatch(patch, options = {}) {
        const attrs = {};
        const opts = (options && typeof options === 'object') ? options : {};
        Object.entries(patch || {}).forEach(([key, val]) => {
            const attrKey = __tmMetaAttrMap[key];
            if (attrKey) {
                if (key === 'repeatRule') {
                    const normalized = __tmNormalizeTaskRepeatRule(val);
                    attrs[attrKey] = normalized.enabled ? JSON.stringify(normalized) : '';
                    return;
                }
                if (key === 'repeatState') {
                    attrs[attrKey] = JSON.stringify(__tmNormalizeTaskRepeatState(val));
                    return;
                }
                if (key === 'repeatHistory') {
                    attrs[attrKey] = JSON.stringify(__tmNormalizeTaskRepeatHistory(val));
                    return;
                }
                attrs[attrKey] = String(val ?? '');
                return;
            }
            if (key === 'customFieldValues' && val && typeof val === 'object' && !Array.isArray(val)) {
                Object.entries(val).forEach(([fieldId, fieldValue]) => {
                    const field = __tmGetCustomFieldDefMap().get(String(fieldId || '').trim());
                    const nextAttrKey = __tmBuildCustomFieldAttrStorageKey(field?.attrKey || field?.id || field?.name || fieldId, field?.id || fieldId);
                    if (!nextAttrKey) return;
                    attrs[nextAttrKey] = __tmSerializeCustomFieldValue(field, fieldValue);
                });
                return;
            }
            if (key === 'attachments') {
                Object.assign(attrs, __tmBuildTaskAttachmentAttrPayload(val, opts.previousAttachmentPaths || [], {
                    currentSlotCount: opts.previousAttachmentSlotCount,
                }));
            }
        });
        return attrs;
    }

    async function __tmPersistMetaAndAttrsKernel(id, patch, options = {}) {
        if (!id || !patch || typeof patch !== 'object') return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const taskId = String(id || '').trim();
        const currentTask = globalThis.__tmRuntimeState?.getTaskById?.(taskId) || state.flatTasks?.[taskId] || state.pendingInsertedTasks?.[taskId] || null;
        let previousAttachmentPaths = [];
        let previousAttachmentSlotCount = 0;
        let attrTargetId = String(opts.attrTargetId || '').trim();
        if (!attrTargetId) {
            const task = currentTask;
            attrTargetId = __tmGetTaskAttrHostId(task);
        }
        if (!attrTargetId) {
            try { attrTargetId = await __tmResolveTaskAttrHostIdFromAnyBlockId(id); } catch (e) { attrTargetId = ''; }
        }
        if (!attrTargetId) attrTargetId = String(id || '').trim();
        if (Object.prototype.hasOwnProperty.call(patch, 'attachments')) {
            const fallbackAttachmentSource = MetaStore.get(taskId) || currentTask || {};
            previousAttachmentPaths = __tmGetTaskAttachmentPaths(fallbackAttachmentSource);
            previousAttachmentSlotCount = __tmGetTaskAttachmentAttrSlotCount(fallbackAttachmentSource);
            if (attrTargetId) {
                try {
                    const res = await API.call('/api/attr/getBlockAttrs', { id: attrTargetId });
                    const row = (res && res.code === 0 && res.data && typeof res.data === 'object') ? res.data : null;
                    if (row) {
                        previousAttachmentPaths = __tmExtractTaskAttachmentsFromAttrRow(row);
                        previousAttachmentSlotCount = __tmGetTaskAttachmentAttrSlotCount(row);
                    }
                } catch (e) {}
            }
            try {
                opts.__resolvedPreviousAttachmentPaths = previousAttachmentPaths.slice();
                opts.__resolvedPreviousAttachmentSlotCount = previousAttachmentSlotCount;
            } catch (e) {}
        }
        if (opts.touchMetaStore !== false) MetaStore.set(id, patch);
        const attrs = __tmBuildAttrPayloadFromPatch(patch, {
            previousAttachmentPaths,
            previousAttachmentSlotCount,
        });
        if (Object.keys(attrs).length === 0) return true;
        const hasStatusAttr = Object.prototype.hasOwnProperty.call(attrs, 'custom-status') || Object.prototype.hasOwnProperty.call(patch, 'customStatus');
        if (hasStatusAttr) {
            __tmPushStatusDebug('attrs-kernel:start', {
                taskId: String(id || '').trim(),
                attrTargetId,
                patch: { ...patch },
                attrs: { ...attrs },
                touchMetaStore: opts.touchMetaStore !== false,
                skipFlush: opts.skipFlush === true,
            }, [id, attrTargetId], { force: true });
        }
        let lastErr = null;
        for (let i = 0; i < 3; i++) {
            try {
                if (hasStatusAttr) {
                    __tmPushStatusDebug('attrs-kernel:attempt', {
                        taskId: String(id || '').trim(),
                        attrTargetId,
                        attempt: i + 1,
                        attrs: { ...attrs },
                    }, [id, attrTargetId], { force: true });
                }
                await API.setAttrs(attrTargetId, attrs);
                if (opts.skipFlush !== true) {
                    try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e) {}
                    if (opts.saveMetaNow !== false) {
                        try { await MetaStore.saveNow(); } catch (e) {}
                    }
                }
                if (hasStatusAttr) {
                    __tmPushStatusDebug('attrs-kernel:success', {
                        taskId: String(id || '').trim(),
                        attrTargetId,
                        attempt: i + 1,
                        attrs: { ...attrs },
                    }, [id, attrTargetId], { force: true });
                }
                return true;
            } catch (e) {
                lastErr = e;
                if (hasStatusAttr) {
                    __tmPushStatusDebug('attrs-kernel:error', {
                        taskId: String(id || '').trim(),
                        attrTargetId,
                        attempt: i + 1,
                        error: String(e?.message || e || ''),
                    }, [id, attrTargetId], { force: true });
                }
                await new Promise(r => setTimeout(r, 120 + i * 200));
            }
        }
        throw lastErr || new Error('保存属性失败');
    }

    function __tmQueueAttrPatch(taskId, patch, options = {}) {
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        if (!tid || !Object.keys(nextPatch).length) return Promise.resolve(false);
        const task = globalThis.__tmRuntimeState?.getTaskById?.(tid) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null;
        const docId = String(options.docId || task?.root_id || task?.docId || '').trim();
        const inversePatch = __tmCaptureTaskPatchInverse(tid, nextPatch);
        return __tmEnqueueQueuedOp({
            type: 'attrPatch',
            docId,
            laneKey: `task:${tid}`,
            coalesceKey: `attr:${tid}`,
            data: {
                taskId: tid,
                patch: { ...nextPatch },
                docId,
                skipFlush: opts.skipFlush !== false,
                renderOptimistic: opts.renderOptimistic !== false,
                withFilters: opts.withFilters !== false,
            },
            inversePatch,
        }, { wait: !!opts.wait });
    }

    function __tmPersistMetaAndAttrs(id, patch, options = {}) {
        if (!id || !patch || typeof patch !== 'object') return;
        const opts = (options && typeof options === 'object') ? options : {};
        __tmQueueAttrPatch(id, patch, { ...opts, wait: false, skipFlush: true }).catch(() => null);
    }

    async function __tmPersistMetaAndAttrsAsync(id, patch, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.queued === true || opts.background === true) {
            return await __tmQueueAttrPatch(id, patch, {
                wait: opts.background !== true,
                skipFlush: opts.skipFlush !== false,
                docId: opts.docId,
                renderOptimistic: opts.renderOptimistic !== false && opts.background !== true,
                withFilters: opts.withFilters !== false,
            });
        }
        return await __tmPersistMetaAndAttrsKernel(id, patch, opts);
    }
    let state = {
        // 数据状态
        taskTree: [],
        flatTasks: {},
        otherBlocks: [],
        filteredTasks: [],
        doneOverrides: {},

        // UI状态
        modal: null,
        settingsModal: null,
        summaryModal: null,
        rulesModal: null,
        priorityModal: null,
        semanticDateConfirmModal: null,
        homepageOpen: !!Storage.get('tm_homepage_open', false),
        aiSidebarOpen: !!Storage.get('tm_ai_sidebar_open', false),
        aiSidebarWidth: Math.max(320, Math.min(720, Math.round(Number(Storage.get('tm_ai_sidebar_width', 380)) || 380))),
        aiMobilePanelOpen: false,
        quickAddModal: null,
        quickAddDocPicker: null,
        quickAdd: null,
        quickAddSubmitting: false,
        viewMode: 'list',
        viewModeInitialized: false,
        deferredListCustomFieldIds: [],
        detailTaskId: '',
        checklistDetailSheetOpen: false,
        checklistDetailDismissed: false,
        kanbanDetailTaskId: '',
        kanbanDetailAnchorTaskId: '',
        multiSelectModeEnabled: false,
        multiSelectedTaskIds: [],
        multiBulkEditFieldKey: '',
        calendarSideDockDragHidden: false,
        listRenderStep: 100,
        listRenderLimit: 100,
        listRenderSignature: '',
        listAutoLoadMoreInFlight: false,
        listAutoLoadMoreLastTs: 0,
        listAutoLoadMoreHydrateTimer: 0,
        listAutoLoadMoreHydrateToken: 0,
        calendarDockDate: '',
        docTabsHidden: false,
        topbarManagerIconLongPressTimer: null,
        topbarManagerIconLongPressFired: false,
        topbarManagerIconLongPressMoved: false,
        topbarManagerIconLongPressStartX: 0,
        topbarManagerIconLongPressStartY: 0,
        topbarManagerIconTrigger: null,
        topbarManagerIconSuppressClickUntil: 0,
        topbarManagerIconIgnoreContextMenuUntil: 0,
        docTabsScrollLeft: 0,
        settingsSubtabsScrollLeft: 0,
        settingsSectionJump: null,
        statusOptionDraft: null,
        statusOptionDraftShouldFocus: false,
        dockTaskPointerDragAbort: null,
        dockTaskPointerGestureCleanup: null,
        dockTaskPointerSuppressClickUntil: 0,
        multiSelectPointerSweepAbort: null,
        multiSelectPointerGestureCleanup: null,
        multiSelectMenuEl: null,
        multiSelectMenuAnchorEl: null,
        multiSelectMenuCloseHandler: null,
        mobileBottomViewbarActiveUntil: 0,
        mobileBottomViewbarTimer: 0,
        mobileViewportRefreshSig: '',
        mobileViewportRefreshTimer: 0,
        mobileViewportRefreshHandler: null,
        mobileViewportRefreshVisualViewport: null,
        ganttView: {
            dayWidth: 24,
            paddingDays: 7,
        },

        // 筛选状态
        currentRule: null,
        filterRules: [],  // 从 SettingsStore 加载
        searchKeyword: '',
        activeDocId: 'all',

        // 操作状态
        isRefreshing: false,
        openToken: 0,
        contextInteractionQuietUntil: 0,
        contextInteractionQuietReason: '',
        uiInlineLoadingActive: false,
        uiInlineLoadingVisible: false,
        uiInlineLoadingTimer: 0,
        uiInlineLoadingToken: 0,
        uiInlineLoadingStyleKind: '',
        renderChecklistBodyHtml: null,
        renderKanbanBodyHtml: null,
        renderWhiteboardBodyHtml: null,
        // 悬浮条修改的任务ID列表（用于切换页签时强制刷新）
        quickbarModifiedTaskIds: new Set(),
        quickbarModifiedTaskIdsLoaded: false,
        // 悬浮条最后更新时间（用于判断是否需要刷新）
        lastQuickbarUpdateTime: 0,
        // 外部事务更新的脏标记（文档页编辑/新建任务后用于切回页签静默刷新）
        externalTaskTxDirty: false,
        lastExternalTaskTxTime: 0,
        // 刚插入但 SQL 索引可能尚未返回的任务，短暂保活避免刷新后闪现消失
        pendingInsertedTasks: {},
        semanticDateAutoApplying: false,
        viewRefreshTimer: 0,
        viewRefreshPending: null,
        viewRefreshSeq: 0,
        scrollDeferredRefreshTimer: 0,
        listProjectionRefreshTimer: 0,
        listProjectionRefreshPending: null,
        busyDetailViewRefreshTimer: 0,
        busyDetailViewRefreshPending: null,

        // 设置（从 SettingsStore 读取）
        selectedDocIds: [],
        allDocuments: [],
        notebooks: [],
        notebooksFetchedAt: 0,
        notebooksLoadingPromise: null,
        queryLimit: 500,
        recursiveDocLimit: 2000,
        groupByDocName: true,
        groupByTaskName: false,
        groupByTime: false,
        collapsedTaskIds: new Set(),
        timerFocusTaskId: '',

        // 统计信息
        stats: {
            totalTasks: 0,
            doneTasks: 0,
            todoTasks: 0,
            queryTime: 0,
            docCount: 0
        },

        // 规则编辑器状态
        editingRule: null,
        priorityScoreDraft: null,

        // 四象限分组状态
        quadrantEnabled: false,
        // 白板视图交互状态
        whiteboardLinkFromTaskId: '',
        whiteboardLinkFromDocId: '',
        whiteboardLinkPress: null,
        whiteboardLinkPreview: null,
        whiteboardLinkPointerFallback: null,
        whiteboardLinkHoverTaskId: '',
        whiteboardLinkHoverDocId: '',
        whiteboardSelectedLinkId: '',
        whiteboardSelectedLinkDocId: '',
        timelineLinkHoverTaskId: '',
        timelineSelectedLinkId: '',
        whiteboardSelectedTaskId: '',
        whiteboardSelectedNoteId: '',
        whiteboardMultiSelectedTaskIds: [],
        whiteboardMultiSelectedNoteIds: [],
        whiteboardMultiSelectedLinkKeys: [],
        whiteboardNoteEditor: null,
        whiteboardEdgeRafId: 0,
        whiteboardPanSession: null,
        whiteboardNodeDrag: null,
        whiteboardNoteDrag: null,
        whiteboardMarqueeSession: null,
        whiteboardSuppressClickUntil: 0,
        whiteboardPoolSelectedTaskIds: [],
        whiteboardPoolDragGhostEl: null,
        whiteboardAllTabsDocDragId: '',
        whiteboardAllTabsVisibleDocIds: [],
        whiteboardAllTabsBaseDocIds: [],
        whiteboardDocFrameMap: {},
        whiteboardDocResize: null,
        whiteboardNoteClickTimer: 0,
        timelineDotPinnedTaskId: '',
        timelineMultiSelectedTaskIds: [],
        __tmTimelineRenderDeps: null,
        todayScheduledTaskIds: new Set(),
        todayScheduledTaskIdsDay: '',
        todayScheduledTaskIdsLoading: null,
        todayScheduledSourceReady: false,
        kanbanDocHeadingsByDocId: {},
        kanbanDocHeadingsLevel: '',
        kanbanDocHeadingsLoadedAt: 0,
        __tmLoadedDocIdsForTasks: [],
    };

    const __TM_OP_QUEUE_STORAGE_KEY = 'tm_op_queue_v1';
    const __tmOpQueue = {
        hydrated: false,
        seq: 0,
        items: [],
        activeCount: 0,
        maxParallel: 2,
        activeLanes: new Set(),
        drainTimer: 0,
        persistTimer: 0,
    };
    const __TM_UNDO_STACK_LIMIT = 80;
    const __tmUndoState = {
        seq: 0,
        undoStack: [],
        redoStack: [],
        applying: false,
        keydownHandler: null,
    };

    function __tmNormalizeQueueTaskValue(field, value) {
        const key = String(field || '').trim();
        if (key === 'pinned') return !!(value === true || value === '1' || value === 1);
        if (key === 'milestone') return (value === true || value === '1' || value === 1) ? '1' : '';
        if (key === 'remark') return __tmNormalizeRemarkMarkdown(value);
        if (key === 'attachments') return __tmNormalizeTaskAttachmentPaths(value);
        if (key === 'repeatRule') return __tmNormalizeTaskRepeatRule(value);
        if (key === 'repeatState') return __tmNormalizeTaskRepeatState(value);
        if (key === 'repeatHistory') return __tmNormalizeTaskRepeatHistory(value);
        if (key === 'customFieldValues') {
            const input = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
            const out = {};
            Object.entries(input).forEach(([fieldId, rawValue]) => {
                const field = __tmGetCustomFieldDefMap().get(String(fieldId || '').trim());
                const normalized = __tmNormalizeCustomFieldValue(field, rawValue);
                if (Array.isArray(normalized)) {
                    if (normalized.length) out[fieldId] = normalized;
                    return;
                }
                if (String(normalized || '').trim()) out[fieldId] = normalized;
            });
            return out;
        }
        if (key === 'priority' || key === 'customStatus' || key === 'duration' || key === 'startDate' || key === 'completionTime' || key === 'customTime' || key === 'taskCompleteAt') {
            return String(value ?? '').trim();
        }
        return value;
    }

    function __tmSerializeOpQueueItem(op) {
        if (!op || typeof op !== 'object') return null;
        const status = String(op.status || '').trim();
        if (status && status !== 'queued') return null;
        const type = String(op.type || '').trim();
        const persistableTypes = new Set(['attrPatch', 'contentPatch', 'createTaskInDoc', 'createSubtask', 'createSibling', 'setDone', 'taskPatch']);
        if (!persistableTypes.has(type)) return null;
        return {
            id: String(op.id || '').trim(),
            type,
            data: (op.data && typeof op.data === 'object') ? { ...op.data } : {},
            docId: String(op.docId || '').trim(),
            laneKey: String(op.laneKey || '').trim(),
            coalesceKey: String(op.coalesceKey || '').trim(),
            retry: Math.max(0, Number(op.retry) || 0),
            nextRunAt: Math.max(0, Number(op.nextRunAt) || 0),
            createdAt: Math.max(0, Number(op.createdAt) || Date.now()),
            optimisticApplied: !!op.optimisticApplied,
        };
    }

    function __tmScheduleOpQueuePersist() {
        try {
            if (__tmOpQueue.persistTimer) clearTimeout(__tmOpQueue.persistTimer);
        } catch (e) {}
        __tmOpQueue.persistTimer = setTimeout(() => {
            __tmOpQueue.persistTimer = 0;
            try {
                const serialized = __tmOpQueue.items
                    .map((op) => __tmSerializeOpQueueItem(op))
                    .filter(Boolean);
                Storage.set(__TM_OP_QUEUE_STORAGE_KEY, serialized);
            } catch (e) {}
        }, 180);
    }

    function __tmScheduleOpQueueDrain(delay = 0) {
        const waitMs = Math.max(0, Number(delay) || 0);
        try {
            if (__tmOpQueue.drainTimer) clearTimeout(__tmOpQueue.drainTimer);
        } catch (e) {}
        __tmOpQueue.drainTimer = setTimeout(() => {
            __tmOpQueue.drainTimer = 0;
            __tmDrainOpQueue();
        }, waitMs);
    }

    function __tmHydrateOpQueue() {
        if (__tmOpQueue.hydrated) return;
        __tmOpQueue.hydrated = true;
        let list = [];
        try {
            list = Storage.get(__TM_OP_QUEUE_STORAGE_KEY, []);
        } catch (e) {
            list = [];
        }
        if (!Array.isArray(list) || !list.length) return;
        list.forEach((raw) => {
            const type = String(raw?.type || '').trim();
            const id = String(raw?.id || '').trim();
            if (!type || !id) return;
            __tmOpQueue.items.push({
                id,
                type,
                data: (raw.data && typeof raw.data === 'object') ? { ...raw.data } : {},
                docId: String(raw.docId || '').trim(),
                laneKey: String(raw.laneKey || '').trim() || String(raw.docId || '').trim() || 'default',
                coalesceKey: String(raw.coalesceKey || '').trim(),
                retry: Math.max(0, Number(raw.retry) || 0),
                nextRunAt: Math.max(0, Number(raw.nextRunAt) || 0),
                createdAt: Math.max(0, Number(raw.createdAt) || Date.now()),
                optimisticApplied: false,
                status: 'queued',
                promise: null,
                resolve: null,
                reject: null,
            });
            const seqMatch = id.match(/(\d+)$/);
            if (seqMatch) {
                __tmOpQueue.seq = Math.max(__tmOpQueue.seq, Number(seqMatch[1]) || 0);
            }
        });
        if (__tmOpQueue.items.length) __tmScheduleOpQueueDrain(80);
    }

    function __tmCaptureTaskPatchInverse(taskId, patch) {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const task = globalThis.__tmRuntimeState?.getTaskById?.(tid) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null;
        const meta = MetaStore.get(tid) || {};
        const inverse = {};
        Object.keys(nextPatch).forEach((key) => {
            if (key === 'customFieldValues') {
                const currentTaskValues = (task?.customFieldValues && typeof task.customFieldValues === 'object') ? task.customFieldValues : {};
                const currentMetaValues = (meta?.customFieldValues && typeof meta.customFieldValues === 'object') ? meta.customFieldValues : {};
                const source = (nextPatch.customFieldValues && typeof nextPatch.customFieldValues === 'object') ? nextPatch.customFieldValues : {};
                const inverseValues = {};
                Object.keys(source).forEach((fieldId) => {
                    if (Object.prototype.hasOwnProperty.call(currentTaskValues, fieldId)) inverseValues[fieldId] = currentTaskValues[fieldId];
                    else if (Object.prototype.hasOwnProperty.call(currentMetaValues, fieldId)) inverseValues[fieldId] = currentMetaValues[fieldId];
                    else inverseValues[fieldId] = '';
                });
                inverse[key] = inverseValues;
                return;
            }
            if (key === 'attachments') {
                inverse[key] = __tmGetTaskAttachmentPaths(task || meta || {});
                return;
            }
            if (task && Object.prototype.hasOwnProperty.call(task, key)) inverse[key] = task[key];
            else if (Object.prototype.hasOwnProperty.call(meta, key)) inverse[key] = meta[key];
            else inverse[key] = '';
        });
        return inverse;
    }

    function __tmDoesPatchAffectPriorityScore(patch = {}) {
        const keys = __tmGetPatchFieldKeys(patch);
        if (!keys.length) return false;
        const affectKeys = new Set([
            'done',
            'customStatus',
            'priority',
            'priorityScore',
            'completionTime',
            'taskCompleteAt',
            'customTime',
            'duration',
            'docId',
            'root_id',
        ]);
        return keys.some((key) => affectKeys.has(String(key || '').trim()));
    }

    function __tmDoesPatchAffectAncestorPriorityScore(patch = {}) {
        const keys = __tmGetPatchFieldKeys(patch);
        if (!keys.length) return false;
        const affectKeys = new Set([
            'done',
            'customStatus',
            'completionTime',
        ]);
        return keys.some((key) => affectKeys.has(String(key || '').trim()));
    }

    function __tmCollectAncestorTaskIds(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return [];
        const opts = (options && typeof options === 'object') ? options : {};
        const includeSelf = opts.includeSelf === true;
        const result = [];
        const seen = new Set();
        const pushId = (id) => {
            const nextId = String(id || '').trim();
            if (!nextId || seen.has(nextId)) return false;
            seen.add(nextId);
            result.push(nextId);
            return true;
        };
        if (includeSelf) pushId(tid);
        let cursor = globalThis.__tmRuntimeState?.getTaskById?.(tid) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null;
        let parentId = String(cursor?.parentTaskId || '').trim();
        while (parentId) {
            if (!pushId(parentId)) break;
            cursor = globalThis.__tmRuntimeState?.getTaskById?.(parentId) || state.flatTasks?.[parentId] || state.pendingInsertedTasks?.[parentId] || null;
            parentId = String(cursor?.parentTaskId || '').trim();
        }
        return result;
    }

    function __tmSyncTaskPriorityScoreLocal(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const memo = opts.timeInfoMemo instanceof Map ? opts.timeInfoMemo : new Map();
        const ancestorIds = opts.includeAncestors === true
            ? __tmCollectAncestorTaskIds(tid, { includeSelf: false })
            : [];
        const targetIds = [tid].concat(ancestorIds);
        let touched = false;
        const syncOne = (targetId, target) => {
            if (!(target && typeof target === 'object')) return;
            target.priorityScore = __tmEnsureTaskPriorityScore(target, { timeInfoMemo: memo, force: true });
            touched = true;
        };
        targetIds.forEach((targetId) => {
            syncOne(targetId, globalThis.__tmRuntimeState?.getFlatTaskById?.(targetId) || state.flatTasks?.[targetId]);
            syncOne(targetId, globalThis.__tmRuntimeState?.getPendingTaskById?.(targetId) || state.pendingInsertedTasks?.[targetId]);
        });
        if (opts.refreshAncestorViews === true && ancestorIds.length > 0) {
            ancestorIds.forEach((ancestorId) => {
                try {
                    __tmRefreshTaskFieldsAcrossViews(ancestorId, { priorityScore: true }, {
                        withFilters: false,
                        reason: String(opts.reason || 'priority-score-ancestor-sync').trim() || 'priority-score-ancestor-sync',
                        forceProjectionRefresh: false,
                        fallback: false,
                    });
                } catch (e) {}
            });
        }
        return touched;
    }

    function __tmApplyAttrPatchLocally(taskId, patch, options = {}) {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        if (!tid || !Object.keys(nextPatch).length) return false;
        const hasStatusPatch = Object.prototype.hasOwnProperty.call(nextPatch, 'customStatus');
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'startDate')
            || Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime')
            || Object.prototype.hasOwnProperty.call(nextPatch, 'customTime')) {
            __tmMarkVisibleDateFallbackTask(tid);
        }
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null;
        const pending = globalThis.__tmRuntimeState?.getPendingTaskById?.(tid) || state.pendingInsertedTasks?.[tid] || null;
        Object.entries(nextPatch).forEach(([key, rawValue]) => {
            const value = __tmNormalizeQueueTaskValue(key, rawValue);
            if (key === 'customFieldValues') {
                const applyCustomValues = (target) => {
                    if (!(target && typeof target === 'object')) return;
                    const nextValues = {
                        ...((target.customFieldValues && typeof target.customFieldValues === 'object' && !Array.isArray(target.customFieldValues)) ? target.customFieldValues : {})
                    };
                    const nextRawValues = {
                        ...((target.__customFieldRawValues && typeof target.__customFieldRawValues === 'object' && !Array.isArray(target.__customFieldRawValues)) ? target.__customFieldRawValues : {})
                    };
                    Object.entries(value || {}).forEach(([fieldId, fieldValue]) => {
                        const field = __tmGetCustomFieldDefMap().get(String(fieldId || '').trim());
                        const normalized = __tmNormalizeCustomFieldValue(field, fieldValue);
                        const serialized = __tmSerializeCustomFieldValue(field, normalized);
                        if (Array.isArray(normalized)) {
                            if (normalized.length) nextValues[fieldId] = normalized;
                            else delete nextValues[fieldId];
                        } else if (String(normalized || '').trim()) {
                            nextValues[fieldId] = normalized;
                        } else {
                            delete nextValues[fieldId];
                        }
                        if (serialized) nextRawValues[fieldId] = serialized;
                        else delete nextRawValues[fieldId];
                    });
                    target.customFieldValues = nextValues;
                    target.__customFieldRawValues = nextRawValues;
                };
                applyCustomValues(task);
                applyCustomValues(pending);
                return;
            }
            if (key === 'attachments') {
                __tmApplyTaskAttachmentPathsToTask(task, value);
                __tmApplyTaskAttachmentPathsToTask(pending, value);
                return;
            }
            const applyOne = (target) => {
                if (!(target && typeof target === 'object')) return;
                target[key] = value;
                switch (key) {
                    case 'customStatus':
                        target.customStatus = String(value ?? '').trim();
                        target.custom_status = target.customStatus;
                        break;
                    case 'priority':
                        target.priority = String(value ?? '').trim();
                        target.custom_priority = target.priority;
                        break;
                    case 'startDate':
                        target.startDate = String(value ?? '').trim();
                        target.start_date = target.startDate;
                        break;
                    case 'completionTime':
                        target.completionTime = String(value ?? '').trim();
                        target.completion_time = target.completionTime;
                        break;
                    case 'taskCompleteAt':
                        target.taskCompleteAt = __tmNormalizeTaskCompleteAtValue(value);
                        target.task_complete_at = target.taskCompleteAt;
                        break;
                    case 'customTime':
                        target.customTime = String(value ?? '').trim();
                        target.custom_time = target.customTime;
                        break;
                    case 'repeatRule':
                        target.repeatRule = __tmNormalizeTaskRepeatRule(value, {
                            startDate: target?.startDate,
                            completionTime: target?.completionTime,
                        });
                        target.repeat_rule = target.repeatRule;
                        break;
                    case 'repeatState':
                        target.repeatState = __tmNormalizeTaskRepeatState(value);
                        target.repeat_state = target.repeatState;
                        break;
                    case 'repeatHistory':
                        target.repeatHistory = __tmNormalizeTaskRepeatHistory(value);
                        target.repeat_history = target.repeatHistory;
                        break;
                    case 'duration':
                        target.duration = String(value ?? '').trim();
                        target.custom_duration = target.duration;
                        break;
                    case 'remark':
                        target.remark = String(value ?? '');
                        target.custom_remark = target.remark;
                        break;
                    case 'pinned':
                        {
                            const pin = !!(value === true || value === '1' || value === 1 || String(value || '').trim().toLowerCase() === 'true');
                            target.pinned = pin;
                            target.custom_pinned = pin ? '1' : '';
                        }
                        break;
                    case 'milestone':
                        {
                            const milestone = !!(value === true || value === '1' || value === 1 || String(value || '').trim().toLowerCase() === 'true');
                            target.milestone = milestone;
                            target.custom_milestone = milestone ? '1' : '';
                        }
                        break;
                    default:
                        break;
                }
            };
            applyOne(task);
            applyOne(pending);
        });
        if (__tmDoesPatchAffectPriorityScore(nextPatch)) {
            try {
                const affectAncestors = __tmDoesPatchAffectAncestorPriorityScore(nextPatch);
                __tmSyncTaskPriorityScoreLocal(tid, {
                    includeAncestors: affectAncestors,
                    refreshAncestorViews: affectAncestors && options.render === false,
                    reason: 'attr-patch-priority-sync',
                });
            } catch (e) {}
        }
        try { MetaStore.set(tid, nextPatch); } catch (e) {}
        if (hasStatusPatch) {
            __tmPushStatusDebug('attr-patch-local', {
                taskId: tid,
                patch: { ...nextPatch },
                currentStatus: String(task?.customStatus || pending?.customStatus || '').trim(),
                currentDone: !!(task?.done ?? pending?.done),
            }, [tid], { force: true });
        }
        if (options.render !== false) {
            try { __tmScheduleRender({ withFilters: options.withFilters !== false }); } catch (e) {}
        }
        return true;
    }

    function __tmRollbackAttrPatchLocally(taskId, inversePatch, options = {}) {
        const tid = String(taskId || '').trim();
        const prevPatch = (inversePatch && typeof inversePatch === 'object') ? inversePatch : {};
        if (!tid || !Object.keys(prevPatch).length) return false;
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null;
        const pending = globalThis.__tmRuntimeState?.getPendingTaskById?.(tid) || state.pendingInsertedTasks?.[tid] || null;
        Object.entries(prevPatch).forEach(([key, rawValue]) => {
            const value = __tmNormalizeQueueTaskValue(key, rawValue);
            if (key === 'customFieldValues') {
                const applyCustomValues = (target) => {
                    if (!(target && typeof target === 'object')) return;
                    const nextValues = {
                        ...((target.customFieldValues && typeof target.customFieldValues === 'object' && !Array.isArray(target.customFieldValues)) ? target.customFieldValues : {})
                    };
                    const nextRawValues = {
                        ...((target.__customFieldRawValues && typeof target.__customFieldRawValues === 'object' && !Array.isArray(target.__customFieldRawValues)) ? target.__customFieldRawValues : {})
                    };
                    Object.entries(value || {}).forEach(([fieldId, fieldValue]) => {
                        const field = __tmGetCustomFieldDefMap().get(String(fieldId || '').trim());
                        const normalized = __tmNormalizeCustomFieldValue(field, fieldValue);
                        const serialized = __tmSerializeCustomFieldValue(field, normalized);
                        if (Array.isArray(normalized)) {
                            if (normalized.length) nextValues[fieldId] = normalized;
                            else delete nextValues[fieldId];
                        } else if (String(normalized || '').trim()) {
                            nextValues[fieldId] = normalized;
                        } else {
                            delete nextValues[fieldId];
                        }
                        if (serialized) nextRawValues[fieldId] = serialized;
                        else delete nextRawValues[fieldId];
                    });
                    target.customFieldValues = nextValues;
                    target.__customFieldRawValues = nextRawValues;
                };
                applyCustomValues(task);
                applyCustomValues(pending);
                return;
            }
            if (key === 'attachments') {
                __tmApplyTaskAttachmentPathsToTask(task, value);
                __tmApplyTaskAttachmentPathsToTask(pending, value);
                return;
            }
            const applyOne = (target) => {
                if (!(target && typeof target === 'object')) return;
                target[key] = value;
                switch (key) {
                    case 'customStatus':
                        target.customStatus = String(value ?? '').trim();
                        target.custom_status = target.customStatus;
                        break;
                    case 'priority':
                        target.priority = String(value ?? '').trim();
                        target.custom_priority = target.priority;
                        break;
                    case 'startDate':
                        target.startDate = String(value ?? '').trim();
                        target.start_date = target.startDate;
                        break;
                    case 'completionTime':
                        target.completionTime = String(value ?? '').trim();
                        target.completion_time = target.completionTime;
                        break;
                    case 'taskCompleteAt':
                        target.taskCompleteAt = __tmNormalizeTaskCompleteAtValue(value);
                        target.task_complete_at = target.taskCompleteAt;
                        break;
                    case 'customTime':
                        target.customTime = String(value ?? '').trim();
                        target.custom_time = target.customTime;
                        break;
                    case 'repeatRule':
                        target.repeatRule = __tmNormalizeTaskRepeatRule(value, {
                            startDate: target?.startDate,
                            completionTime: target?.completionTime,
                        });
                        target.repeat_rule = target.repeatRule;
                        break;
                    case 'repeatState':
                        target.repeatState = __tmNormalizeTaskRepeatState(value);
                        target.repeat_state = target.repeatState;
                        break;
                    case 'repeatHistory':
                        target.repeatHistory = __tmNormalizeTaskRepeatHistory(value);
                        target.repeat_history = target.repeatHistory;
                        break;
                    case 'duration':
                        target.duration = String(value ?? '').trim();
                        target.custom_duration = target.duration;
                        break;
                    case 'remark':
                        target.remark = String(value ?? '');
                        target.custom_remark = target.remark;
                        break;
                    case 'pinned':
                        {
                            const pin = !!(value === true || value === '1' || value === 1 || String(value || '').trim().toLowerCase() === 'true');
                            target.pinned = pin;
                            target.custom_pinned = pin ? '1' : '';
                        }
                        break;
                    case 'milestone':
                        {
                            const milestone = !!(value === true || value === '1' || value === 1 || String(value || '').trim().toLowerCase() === 'true');
                            target.milestone = milestone;
                            target.custom_milestone = milestone ? '1' : '';
                        }
                        break;
                    default:
                        break;
                }
            };
            applyOne(task);
            applyOne(pending);
        });
        if (__tmDoesPatchAffectPriorityScore(prevPatch)) {
            try {
                const affectAncestors = __tmDoesPatchAffectAncestorPriorityScore(prevPatch);
                __tmSyncTaskPriorityScoreLocal(tid, {
                    includeAncestors: affectAncestors,
                    refreshAncestorViews: affectAncestors && options.render === false,
                    reason: 'attr-patch-priority-rollback-sync',
                });
            } catch (e) {}
        }
        try { MetaStore.set(tid, prevPatch); } catch (e) {}
        if (options.render !== false) {
            try { __tmScheduleRender({ withFilters: options.withFilters !== false }); } catch (e) {}
        }
        return true;
    }

    async function __tmExecuteQueuedOp(op) {
        const type = String(op?.type || '').trim();
        if (type === 'attrPatch') {
            return await __tmPersistMetaAndAttrsKernel(op?.data?.taskId, op?.data?.patch, {
                touchMetaStore: false,
                skipFlush: !!op?.data?.skipFlush,
            });
        }
        if (type === 'taskPatch') {
            const taskId = String(op?.data?.taskId || '').trim();
            const patch = (op?.data?.patch && typeof op.data.patch === 'object') ? op.data.patch : {};
            if (!taskId || !Object.keys(patch).length) return false;
            const plan = __tmWritePlanner.buildWritePlan(taskId, patch);
            if (op?.data?.statusBefore && typeof op.data.statusBefore === 'object') {
                plan.statusBefore = { ...op.data.statusBefore };
            }
            const taskLike = __tmTaskStateKernel.getTask(taskId);
            const suppressionIds = __tmGetTaskSuppressionIds(taskId, taskLike);
            return await __tmMutationEngine.withSuppressedTasks(suppressionIds, () => __tmWriteExecutor.executePlan(plan, {
                source: String(op?.data?.source || 'task-patch-queue').trim() || 'task-patch-queue',
                label: String(op?.data?.label || '任务字段').trim() || '任务字段',
                broadcast: op?.data?.broadcast !== false,
                queued: true,
                skipFlush: op?.data?.skipFlush !== false,
            }));
        }
        if (type === 'contentPatch') {
            return await __tmUpdateTaskContentBlockKernel(op?.data?.taskId, op?.data?.nextContent, {
                touchState: false,
            });
        }
        if (type === 'createTaskInDoc') {
            const payload = (op?.data && typeof op.data === 'object') ? op.data : {};
            // Optimistic queue create has already inserted a temp task locally.
            // Re-inserting the committed task here would briefly duplicate it until a refresh.
            const realId = await __tmCreateTaskInDocKernel({
                ...payload,
                localInsert: false,
            });
            return { realId };
        }
        if (type === 'createSubtask') {
            const payload = (op?.data && typeof op.data === 'object') ? op.data : {};
            const realId = await __tmCreateSubtaskForTaskKernel(payload.parentTaskId, payload.content);
            return { realId };
        }
        if (type === 'createSibling') {
            const payload = (op?.data && typeof op.data === 'object') ? op.data : {};
            const realId = await __tmCreateSiblingTaskForTaskKernel(payload.sourceTaskId, payload.content);
            return { realId };
        }
        if (type === 'deleteTask') {
            return await __tmDeleteTaskKernel(op?.data?.taskId);
        }
        if (type === 'setDone') {
            return await __tmSetDoneKernel(op?.data?.taskId, !!op?.data?.done, null, {
                force: true,
                statusPatch: op?.data?.statusPatch,
                suppressHint: op?.data?.suppressHint === true,
                source: op?.data?.source,
                scheduleId: op?.data?.scheduleId,
            });
        }
        if (type === 'moveTask') {
            const payload = (op?.data && typeof op.data === 'object') ? op.data : {};
            const mode = String(payload.mode || '').trim();
            try {
                const suppressMeta = __tmCollectMoveSuppressionIds(payload);
                __tmMarkLocalMoveTxSuppressionIds(suppressMeta.blockIds, suppressMeta.docIds, 2400);
                __tmPushRefreshDebug('move-task:suppress-mark', {
                    mode,
                    taskId: String(payload.taskId || '').trim(),
                    blockIds: suppressMeta.blockIds,
                    docIds: suppressMeta.docIds,
                });
            } catch (e) {}
            if (mode === 'heading') return await __tmMoveTaskToHeading(payload.taskId, payload.targetDocId, payload.headingId, { silentHint: true });
            if (mode === 'docTop') return await __tmMoveTaskToDocTop(payload.taskId, payload.targetDocId, { silentHint: true, clearHeading: true });
            if (mode === 'before') return await __tmMoveTaskBeforeTask(payload.taskId, payload.targetTaskId, { silentHint: true, targetDocId: payload.targetDocId });
            if (mode === 'after') return await __tmMoveTaskAfterTask(payload.taskId, payload.targetTaskId, { silentHint: true, targetDocId: payload.targetDocId });
            if (mode === 'child-top') return await __tmMoveTaskAsChildTop(payload.taskId, payload.targetTaskId, { silentHint: true, targetDocId: payload.targetDocId });
            if (mode === 'child') return await __tmMoveTaskAsChild(payload.taskId, payload.targetTaskId, { silentHint: true, targetDocId: payload.targetDocId });
            return await __tmMoveTaskToDoc(payload.taskId, payload.targetDocId, { silentHint: true });
        }
        throw new Error(`未支持的队列操作: ${type || 'unknown'}`);
    }

    function __tmApplyQueuedOpOptimistic(op) {
        const type = String(op?.type || '').trim();
        if (type === 'attrPatch') {
            __tmApplyAttrPatchLocally(op?.data?.taskId, op?.data?.patch, {
                render: op?.data?.renderOptimistic !== false,
                withFilters: op?.data?.withFilters !== false,
            });
            return;
        }
        if (type === 'taskPatch') {
            const taskId = String(op?.data?.taskId || '').trim();
            const patch = (op?.data?.patch && typeof op.data.patch === 'object') ? op.data.patch : {};
            if (!taskId || !Object.keys(patch).length) return;
            if (op?.data?.optimistic === false) return;
            __tmTaskStateKernel.patchTaskLocal(taskId, patch, {
                source: String(op?.data?.source || '').trim(),
            });
            if (op?.data?.skipViewRefresh === true) return;
            __tmRefreshTaskFieldsAcrossViews(taskId, patch, {
                withFilters: false,
                reason: String(op?.data?.reason || op?.data?.source || 'task-patch-optimistic').trim() || 'task-patch-optimistic',
                forceProjectionRefresh: false,
                fallback: false,
                skipDetailPatch: op?.data?.skipDetailPatch === true || op?.data?.optimisticSkipDetailPatch === true,
            });
            return;
        }
        if (type === 'contentPatch') {
            __tmApplyContentPatchLocally(op?.data?.taskId, op?.data?.nextContent, {
                render: op?.data?.renderOptimistic !== false,
                withFilters: op?.data?.withFilters !== false,
            });
            return;
        }
        if (type === 'createTaskInDoc') {
            __tmApplyOptimisticDocTask(op?.data);
            return;
        }
        if (type === 'createSubtask') {
            __tmApplyOptimisticSubtask(op?.data?.parentTaskId, op?.data?.tempId, op?.data?.content);
            return;
        }
        if (type === 'createSibling') {
            __tmApplyOptimisticSiblingTask(op?.data?.sourceTaskId, op?.data?.tempId, op?.data?.content);
            return;
        }
        if (type === 'deleteTask') {
            __tmApplyDeleteOptimisticLocal(op?.data?.snapshot);
            return;
        }
        if (type === 'setDone') {
            __tmApplyDoneOptimisticLocal(op?.data?.taskId, !!op?.data?.done, op?.data?.statusPatch, op?.data?.source);
            return;
        }
        if (type === 'moveTask') {
            __tmApplyMoveOptimisticLocal(op?.data);
            return;
        }
    }

    function __tmRollbackQueuedOp(op) {
        const type = String(op?.type || '').trim();
        if (type === 'attrPatch') {
            __tmRollbackAttrPatchLocally(op?.data?.taskId, op?.inversePatch, { render: true, withFilters: true });
            return;
        }
        if (type === 'taskPatch') {
            const taskId = String(op?.data?.taskId || '').trim();
            const inversePatch = (op?.inversePatch && typeof op.inversePatch === 'object') ? op.inversePatch : {};
            if (!taskId || !Object.keys(inversePatch).length) return;
            if (op?.data?.optimistic === false) return;
            __tmTaskStateKernel.rollbackTaskLocal(taskId, inversePatch, {
                source: String(op?.data?.source || '').trim(),
            });
            if (op?.data?.skipViewRefresh === true) return;
            __tmRefreshTaskFieldsAcrossViews(taskId, inversePatch, {
                withFilters: true,
                reason: String(op?.data?.reason || op?.data?.source || 'task-patch-rollback').trim() || 'task-patch-rollback',
                forceProjectionRefresh: op?.data?.affectsProjection === true,
                fallback: true,
                skipDetailPatch: op?.data?.skipDetailPatch === true,
            });
            return;
        }
        if (type === 'contentPatch') {
            __tmRollbackContentPatchLocally(op?.data?.taskId, op?.inversePatch, { render: true, withFilters: true });
            return;
        }
        if (type === 'createTaskInDoc' || type === 'createSubtask' || type === 'createSibling') {
            __tmRemoveTaskFromLocalState(op?.data?.tempId);
            try { __tmScheduleRender({ withFilters: true }); } catch (e) {}
            return;
        }
        if (type === 'deleteTask') {
            __tmRollbackDeleteOptimisticLocal(op?.data?.snapshot);
            return;
        }
        if (type === 'setDone') {
            __tmRollbackDoneOptimisticLocal(op?.data?.taskId, op?.inversePatch, op?.data?.source);
            return;
        }
        if (type === 'moveTask') {
            __tmRollbackMoveOptimisticLocal(op?.data?.snapshot);
            return;
        }
    }

    function __tmCommitQueuedOp(op, result) {
        const type = String(op?.type || '').trim();
        if (type === 'taskPatch') {
            const taskId = String(op?.data?.taskId || '').trim();
            const patch = (op?.data?.patch && typeof op.data.patch === 'object') ? op.data.patch : {};
            if (!taskId || !Object.keys(patch).length) return;
            if (op?.data?.skipViewRefresh === true || op?.data?.skipSettledRefresh === true) return;
            __tmRefreshTaskFieldsAcrossViews(taskId, patch, {
                withFilters: true,
                reason: String(op?.data?.reason || op?.data?.source || 'task-patch-settled').trim() || 'task-patch-settled',
                forceProjectionRefresh: op?.data?.affectsProjection === true,
                fallback: true,
                skipDetailPatch: op?.data?.skipDetailPatch === true,
            });
            return;
        }
        if (type === 'createTaskInDoc' || type === 'createSubtask' || type === 'createSibling') {
            const tempId = String(op?.data?.tempId || '').trim();
            const realId = String(result?.realId || '').trim();
            if (tempId && realId) {
                __tmCommitOptimisticTaskId(tempId, realId);
                try { __tmScheduleRender({ withFilters: true }); } catch (e) {}
            }
            return;
        }
        if (type === 'moveTask') {
            try {
                __tmMarkDocsPreferSiblingOrder([
                    String(op?.data?.targetDocId || '').trim(),
                    String(op?.data?.snapshot?.docId || '').trim(),
                ], 45000, 'move-task-commit');
            } catch (e) {}
            try {
                __tmScheduleTaskRowDropReconcileRefresh(op?.data);
            } catch (e) {
                try { __tmRefreshMainViewInPlace({ withFilters: true, reason: 'move-task-commit-fallback' }); } catch (e2) {}
            }
        }
    }

    function __tmFindQueuedMergeTarget(nextOp) {
        const key = String(nextOp?.coalesceKey || '').trim();
        if (!key) return null;
        for (let i = __tmOpQueue.items.length - 1; i >= 0; i -= 1) {
            const op = __tmOpQueue.items[i];
            if (!op || op.status !== 'queued') continue;
            if (String(op.coalesceKey || '').trim() !== key) continue;
            return op;
        }
        return null;
    }

    function __tmMergeQueuedOp(target, nextOp) {
        if (!target || !nextOp) return false;
        if (String(target.type || '').trim() === 'taskPatch' && String(nextOp.type || '').trim() === 'taskPatch') {
            const mergedStatusBefore = (target.data?.statusBefore && typeof target.data.statusBefore === 'object')
                ? { ...target.data.statusBefore }
                : ((nextOp.data?.statusBefore && typeof nextOp.data.statusBefore === 'object') ? { ...nextOp.data.statusBefore } : null);
            target.data = {
                ...(target.data && typeof target.data === 'object' ? target.data : {}),
                ...(nextOp.data && typeof nextOp.data === 'object' ? nextOp.data : {}),
                patch: __tmWritePlanner.mergeTaskPatches(
                    target.data?.patch && typeof target.data.patch === 'object' ? target.data.patch : {},
                    nextOp.data?.patch && typeof nextOp.data.patch === 'object' ? nextOp.data.patch : {}
                ),
                statusBefore: mergedStatusBefore,
            };
            target.inversePatch = __tmWritePlanner.mergeTaskPatches(
                target.inversePatch && typeof target.inversePatch === 'object' ? target.inversePatch : {},
                nextOp.inversePatch && typeof nextOp.inversePatch === 'object' ? nextOp.inversePatch : {},
                { preferExisting: true }
            );
            target.docId = String(nextOp.docId || target.docId || '').trim();
            target.nextRunAt = Math.max(
                Math.max(0, Number(target.nextRunAt) || 0),
                Math.max(0, Number(nextOp.nextRunAt) || 0)
            );
            return true;
        }
        if (String(target.type || '').trim() === 'attrPatch' && String(nextOp.type || '').trim() === 'attrPatch') {
            const mergedPatch = {
                ...(target.data?.patch && typeof target.data.patch === 'object' ? target.data.patch : {}),
                ...(nextOp.data?.patch && typeof nextOp.data.patch === 'object' ? nextOp.data.patch : {}),
            };
            const mergedInverse = {
                ...(target.inversePatch && typeof target.inversePatch === 'object' ? target.inversePatch : {}),
            };
            Object.keys(nextOp.inversePatch || {}).forEach((key) => {
                if (!Object.prototype.hasOwnProperty.call(mergedInverse, key)) mergedInverse[key] = nextOp.inversePatch[key];
            });
            target.data = {
                ...(target.data && typeof target.data === 'object' ? target.data : {}),
                ...(nextOp.data && typeof nextOp.data === 'object' ? nextOp.data : {}),
                patch: mergedPatch,
            };
            target.inversePatch = mergedInverse;
            target.docId = String(nextOp.docId || target.docId || '').trim();
            target.nextRunAt = 0;
            return true;
        }
        if (String(target.type || '').trim() === 'contentPatch' && String(nextOp.type || '').trim() === 'contentPatch') {
            target.data = {
                ...(target.data && typeof target.data === 'object' ? target.data : {}),
                ...(nextOp.data && typeof nextOp.data === 'object' ? nextOp.data : {}),
            };
            target.inversePatch = (target.inversePatch && typeof target.inversePatch === 'object')
                ? { ...target.inversePatch }
                : { ...(nextOp.inversePatch && typeof nextOp.inversePatch === 'object' ? nextOp.inversePatch : {}) };
            target.nextRunAt = 0;
            return true;
        }
        if (String(target.type || '').trim() === 'setDone' && String(nextOp.type || '').trim() === 'setDone') {
            target.data = {
                ...(target.data && typeof target.data === 'object' ? target.data : {}),
                ...(nextOp.data && typeof nextOp.data === 'object' ? nextOp.data : {}),
            };
            target.inversePatch = (target.inversePatch && typeof target.inversePatch === 'object')
                ? { ...target.inversePatch }
                : { ...(nextOp.inversePatch && typeof nextOp.inversePatch === 'object' ? nextOp.inversePatch : {}) };
            target.docId = String(nextOp.docId || target.docId || '').trim();
            target.laneKey = String(nextOp.laneKey || target.laneKey || '').trim() || 'setDone:global';
            target.nextRunAt = 0;
            return true;
        }
        return false;
    }

    function __tmDrainOpQueue() {
        if (__tmOpQueue.activeCount >= __tmOpQueue.maxParallel) return;
        const now = Date.now();
        let nextDelay = 0;
        while (__tmOpQueue.activeCount < __tmOpQueue.maxParallel) {
            const nextOp = __tmOpQueue.items.find((op) => {
                if (!op || op.status !== 'queued') return false;
                const opType = String(op.type || '').trim();
                if (opType === 'setDone') {
                    const hasRunningSetDone = __tmOpQueue.items.some((item) => item && item !== op && item.status === 'running' && String(item.type || '').trim() === 'setDone');
                    if (hasRunningSetDone) return false;
                }
                const laneKey = String(op.laneKey || '').trim() || 'default';
                if (__tmOpQueue.activeLanes.has(laneKey)) return false;
                const runAt = Math.max(0, Number(op.nextRunAt) || 0);
                if (runAt > now) {
                    const delta = runAt - now;
                    if (!nextDelay || delta < nextDelay) nextDelay = delta;
                    return false;
                }
                return true;
            });
            if (!nextOp) break;
            nextOp.status = 'running';
            const laneKey = String(nextOp.laneKey || '').trim() || 'default';
            __tmOpQueue.activeCount += 1;
            __tmOpQueue.activeLanes.add(laneKey);
            __tmScheduleOpQueuePersist();
            Promise.resolve()
                .then(() => __tmExecuteQueuedOp(nextOp))
                .then((result) => {
                    try { __tmCommitQueuedOp(nextOp, result); } catch (e) {}
                    nextOp.status = 'done';
                    try { nextOp.resolve?.(result); } catch (e) {}
                    try {
                        const docId = String(nextOp.docId || nextOp?.data?.docId || '').trim();
                        if (docId) __tmInvalidateTasksQueryCacheByDocId(docId);
                    } catch (e) {}
                })
                .catch((error) => {
                    const retry = Math.max(0, Number(nextOp.retry) || 0);
                    if (retry < 2) {
                        nextOp.retry = retry + 1;
                        nextOp.status = 'queued';
                        nextOp.nextRunAt = Date.now() + (180 * Math.pow(2, retry));
                        __tmScheduleOpQueuePersist();
                        return;
                    }
                    nextOp.status = 'failed';
                    try { __tmRollbackQueuedOp(nextOp); } catch (e) {}
                    try { nextOp.reject?.(error); } catch (e) {}
                })
                .finally(() => {
                    __tmOpQueue.activeCount = Math.max(0, __tmOpQueue.activeCount - 1);
                    __tmOpQueue.activeLanes.delete(laneKey);
                    __tmOpQueue.items = __tmOpQueue.items.filter((item) => item && item.status !== 'done' && item.status !== 'failed');
                    __tmScheduleOpQueuePersist();
                    __tmScheduleOpQueueDrain(0);
                });
        }
        if (nextDelay > 0) __tmScheduleOpQueueDrain(nextDelay);
    }

    function __tmEnqueueQueuedOp(definition, options = {}) {
        __tmHydrateOpQueue();
        const def = (definition && typeof definition === 'object') ? definition : {};
        const delayMs = Math.max(0, Number(options.delayMs ?? def.delayMs) || 0);
        const op = {
            id: String(def.id || `tmop_${Date.now()}_${++__tmOpQueue.seq}`).trim(),
            type: String(def.type || '').trim(),
            data: (def.data && typeof def.data === 'object') ? { ...def.data } : {},
            inversePatch: (def.inversePatch && typeof def.inversePatch === 'object') ? { ...def.inversePatch } : {},
            docId: String(def.docId || '').trim(),
            laneKey: String(def.laneKey || '').trim() || String(def.docId || '').trim() || 'default',
            coalesceKey: String(def.coalesceKey || '').trim(),
            retry: 0,
            nextRunAt: Math.max(0, Number(def.nextRunAt) || 0, delayMs > 0 ? (Date.now() + delayMs) : 0),
            createdAt: Date.now(),
            optimisticApplied: false,
            status: 'queued',
            promise: null,
            resolve: null,
            reject: null,
        };
        const wait = !!options.wait;
        const promise = new Promise((resolve, reject) => {
            op.resolve = resolve;
            op.reject = reject;
        });
        op.promise = promise;
        const mergeTarget = __tmFindQueuedMergeTarget(op);
        if (mergeTarget && __tmMergeQueuedOp(mergeTarget, op)) {
            if (!mergeTarget.optimisticApplied) {
                __tmApplyQueuedOpOptimistic(mergeTarget);
                mergeTarget.optimisticApplied = true;
            } else {
                __tmApplyQueuedOpOptimistic({ ...mergeTarget, data: op.data });
            }
            __tmScheduleOpQueuePersist();
            __tmScheduleOpQueueDrain(0);
            return wait ? (mergeTarget.promise || Promise.resolve(mergeTarget.id)) : Promise.resolve(mergeTarget.id);
        }
        __tmOpQueue.items.push(op);
        __tmApplyQueuedOpOptimistic(op);
        op.optimisticApplied = true;
        __tmScheduleOpQueuePersist();
        __tmScheduleOpQueueDrain(0);
        return wait ? promise : Promise.resolve(op.id);
    }

    function __tmHasTaskDataReadyForUi() {
        try {
            if (Array.isArray(state.filteredTasks) && state.filteredTasks.length > 0) return true;
            if (Array.isArray(state.taskTree) && state.taskTree.length > 0) return true;
            return !!(state.flatTasks && Object.keys(state.flatTasks).length > 0);
        } catch (e) {}
        return false;
    }

    function __tmHasPendingQueuedOps() {
        try { __tmHydrateOpQueue(); } catch (e) {}
        try {
            return Array.isArray(__tmOpQueue?.items) && __tmOpQueue.items.some((op) => {
                const status = String(op?.status || '').trim();
                return status === 'queued' || status === 'running';
            });
        } catch (e) {}
        return false;
    }

    async function __tmWaitForQueuedOpsIdle(timeoutMs = 900) {
        try { __tmHydrateOpQueue(); } catch (e) {}
        try { __tmScheduleOpQueueDrain(0); } catch (e) {}
        const timeout = Math.max(0, Number(timeoutMs) || 0);
        if (timeout <= 0) return !__tmHasPendingQueuedOps();
        const start = Date.now();
        while ((Date.now() - start) < timeout) {
            if (!__tmHasPendingQueuedOps()) return true;
            await new Promise((resolve) => setTimeout(resolve, 40));
        }
        return !__tmHasPendingQueuedOps();
    }

    function __tmBuildQueuedTaskFieldPatchMap(options = {}) {
        try { __tmHydrateOpQueue(); } catch (e) {}
        const opts = (options && typeof options === 'object') ? options : {};
        const statusSet = new Set(
            (Array.isArray(opts.statuses) ? opts.statuses : ['queued', 'running'])
                .map((status) => String(status || '').trim())
                .filter(Boolean)
        );
        const out = new Map();
        const mergePatch = (taskId, patch) => {
            const tid = String(taskId || '').trim();
            const sourcePatch = (patch && typeof patch === 'object' && !Array.isArray(patch)) ? patch : null;
            if (!tid || !sourcePatch) return;
            const normalizedPatch = {};
            Object.entries(sourcePatch).forEach(([rawKey, rawValue]) => {
                const key = String(rawKey || '').trim();
                if (!key) return;
                normalizedPatch[key] = __tmNormalizeQueueTaskValue(key, rawValue);
            });
            if (!Object.keys(normalizedPatch).length) return;
            out.set(tid, __tmWritePlanner.mergeTaskPatches(out.get(tid) || {}, normalizedPatch));
        };
        const items = Array.isArray(__tmOpQueue?.items) ? __tmOpQueue.items : [];
        items.forEach((op) => {
            if (!op || !statusSet.has(String(op?.status || '').trim())) return;
            const type = String(op?.type || '').trim();
            if (type === 'attrPatch') {
                mergePatch(op?.data?.taskId, op?.data?.patch);
                return;
            }
            if (type === 'taskPatch') {
                mergePatch(op?.data?.taskId, op?.data?.patch);
                mergePatch(op?.data?.taskId, op?.data?.statusPatch);
                return;
            }
            if (type === 'setDone') {
                const patch = {};
                if (Object.prototype.hasOwnProperty.call(op?.data || {}, 'done')) {
                    patch.done = !!op.data.done;
                }
                if (op?.data?.statusPatch && typeof op.data.statusPatch === 'object' && !Array.isArray(op.data.statusPatch)) {
                    Object.assign(patch, op.data.statusPatch);
                }
                mergePatch(op?.data?.taskId, patch);
            }
        });
        return out;
    }

    function __tmHasPendingTaskFieldPersistence(taskId, fieldKeys = []) {
        const tid = String(taskId || '').trim();
        const keys = Array.isArray(fieldKeys) ? fieldKeys : [fieldKeys];
        const keySet = new Set(keys.map((key) => String(key || '').trim()).filter(Boolean));
        if (!tid || keySet.size === 0) return false;
        const patchMap = __tmBuildQueuedTaskFieldPatchMap({ statuses: ['queued', 'running'] });
        const patch = patchMap.get(tid);
        if (!patch || typeof patch !== 'object') return false;
        return Object.keys(patch).some((key) => keySet.has(String(key || '').trim()));
    }

    function __tmApplyQueuedTaskFieldPatchToTask(task, patch) {
        const target = (task && typeof task === 'object') ? task : null;
        const nextPatch = (patch && typeof patch === 'object' && !Array.isArray(patch)) ? patch : null;
        if (!target || !nextPatch) return target;
        const taskId = String(target?.id || '').trim();
        const shouldLogValue = __tmShouldLogValueDebug([taskId], false);
        const beforeValueSnapshot = shouldLogValue ? __tmSnapshotTaskValueDebugFields(target) : null;
        Object.entries(nextPatch).forEach(([key, rawValue]) => {
            const value = __tmNormalizeQueueTaskValue(key, rawValue);
            if (key === 'customFieldValues') {
                const currentValues = (target.customFieldValues && typeof target.customFieldValues === 'object' && !Array.isArray(target.customFieldValues))
                    ? target.customFieldValues
                    : {};
                target.customFieldValues = {
                    ...currentValues,
                    ...((value && typeof value === 'object' && !Array.isArray(value)) ? value : {}),
                };
                return;
            }
            if (key === 'done') {
                target.done = !!value;
                return;
            }
            if (key === 'customStatus') {
                target.customStatus = String(value ?? '').trim();
                target.custom_status = target.customStatus;
                return;
            }
            if (key === 'priority') {
                target.priority = String(value ?? '').trim();
                target.custom_priority = target.priority;
                return;
            }
            if (key === 'startDate') {
                target.startDate = String(value ?? '').trim();
                target.start_date = target.startDate;
                return;
            }
            if (key === 'completionTime') {
                target.completionTime = String(value ?? '').trim();
                target.completion_time = target.completionTime;
                return;
            }
            if (key === 'taskCompleteAt') {
                target.taskCompleteAt = __tmNormalizeTaskCompleteAtValue(value);
                target.task_complete_at = target.taskCompleteAt;
                return;
            }
            if (key === 'customTime') {
                target.customTime = String(value ?? '').trim();
                target.custom_time = target.customTime;
                return;
            }
            if (key === 'duration') {
                target.duration = String(value ?? '').trim();
                target.custom_duration = target.duration;
                return;
            }
            if (key === 'remark') {
                target.remark = String(value ?? '');
                target.custom_remark = target.remark;
                return;
            }
            if (key === 'pinned') {
                const pinned = !!(value === true || value === '1' || value === 1 || String(value || '').trim().toLowerCase() === 'true');
                target.pinned = pinned;
                target.custom_pinned = pinned ? '1' : '';
                return;
            }
            if (key === 'milestone') {
                const milestone = !!(value === true || value === '1' || value === 1 || String(value || '').trim().toLowerCase() === 'true');
                target.milestone = milestone;
                target.custom_milestone = milestone ? '1' : '';
                return;
            }
            if (key === 'repeatRule') {
                target.repeatRule = __tmNormalizeTaskRepeatRule(value, {
                    startDate: target?.startDate,
                    completionTime: target?.completionTime,
                });
                target.repeat_rule = target.repeatRule;
                return;
            }
            if (key === 'repeatState') {
                target.repeatState = __tmNormalizeTaskRepeatState(value);
                target.repeat_state = target.repeatState;
                return;
            }
            if (key === 'repeatHistory') {
                target.repeatHistory = __tmNormalizeTaskRepeatHistory(value);
                target.repeat_history = target.repeatHistory;
            }
        });
        if (shouldLogValue) {
            __tmPushValueDebug('queue:task-patch', {
                taskId,
                patchKeys: Object.keys(nextPatch),
                patch: nextPatch,
                before: beforeValueSnapshot,
                after: __tmSnapshotTaskValueDebugFields(target),
            }, [taskId]);
        }
        return target;
    }

    function __tmClearInlineLoadingTimer() {
        const timer = Number(state.uiInlineLoadingTimer) || 0;
        if (!timer) return;
        try { clearTimeout(timer); } catch (e) {}
        state.uiInlineLoadingTimer = 0;
    }

    function __tmBuildInlineLoadingSkeletonMarkup() {
        const mode = String(state.viewMode || 'list').trim() || 'list';
        const titleMap = {
            list: '正在准备任务列表',
            checklist: '正在准备清单视图',
            timeline: '正在准备时间线',
            kanban: '正在准备看板视图',
            calendar: '正在准备日历视图',
            whiteboard: '正在准备白板视图',
        };
        const title = titleMap[mode] || '正在准备任务视图';
        const listRows = [84, 72, 66, 78, 61, 74]
            .map((width, index) => `
                <div class="tm-inline-loading-list-row">
                    <span class="tm-skeleton-block tm-inline-loading-check"></span>
                    <span class="tm-skeleton-block tm-inline-loading-line" style="width:${width}%;"></span>
                    ${index % 2 === 0 ? '<span class="tm-skeleton-block tm-inline-loading-chip"></span>' : ''}
                </div>
            `)
            .join('');
        if (mode === 'calendar') {
            const toolbar = `
                <div class="tm-inline-loading-toolbar">
                    <span class="tm-skeleton-block tm-inline-loading-btn"></span>
                    <span class="tm-skeleton-block tm-inline-loading-btn tm-inline-loading-btn--wide"></span>
                    <span class="tm-skeleton-block tm-inline-loading-btn"></span>
                </div>
            `;
            const week = Array.from({ length: 7 }, () => '<span class="tm-skeleton-block tm-inline-loading-cal-head"></span>').join('');
            const cells = Array.from({ length: 35 }, () => '<span class="tm-skeleton-block tm-inline-loading-cal-cell"></span>').join('');
            return `
                <div class="tm-inline-loading-surface tm-inline-loading-surface--calendar">
                    <div class="tm-inline-loading-title">${title}</div>
                    ${toolbar}
                    <div class="tm-inline-loading-calendar">
                        <div class="tm-inline-loading-calendar-head">${week}</div>
                        <div class="tm-inline-loading-calendar-grid">${cells}</div>
                    </div>
                </div>
            `;
        }
        if (mode === 'kanban') {
            const cols = Array.from({ length: 3 }, (_, index) => `
                <div class="tm-inline-loading-kanban-col">
                    <span class="tm-skeleton-block tm-inline-loading-kanban-head" style="width:${62 + index * 8}%;"></span>
                    <span class="tm-skeleton-block tm-inline-loading-kanban-card"></span>
                    <span class="tm-skeleton-block tm-inline-loading-kanban-card tm-inline-loading-kanban-card--sm"></span>
                    <span class="tm-skeleton-block tm-inline-loading-kanban-card"></span>
                </div>
            `).join('');
            return `
                <div class="tm-inline-loading-surface tm-inline-loading-surface--kanban">
                    <div class="tm-inline-loading-title">${title}</div>
                    <div class="tm-inline-loading-kanban-grid">${cols}</div>
                </div>
            `;
        }
        if (mode === 'timeline') {
            const left = Array.from({ length: 6 }, (_, index) => `<span class="tm-skeleton-block tm-inline-loading-timeline-line" style="width:${74 - index * 5}%;"></span>`).join('');
            const right = Array.from({ length: 6 }, (_, index) => `<span class="tm-skeleton-block tm-inline-loading-timeline-bar" style="width:${42 + index * 8}%;margin-left:${(index % 3) * 10}%;"></span>`).join('');
            return `
                <div class="tm-inline-loading-surface tm-inline-loading-surface--timeline">
                    <div class="tm-inline-loading-title">${title}</div>
                    <div class="tm-inline-loading-timeline">
                        <div class="tm-inline-loading-timeline-left">${left}</div>
                        <div class="tm-inline-loading-timeline-right">${right}</div>
                    </div>
                </div>
            `;
        }
        if (mode === 'whiteboard') {
            const cards = [18, 58, 30, 66]
                .map((left) => `
                    <div class="tm-inline-loading-board-card" style="left:${left}%;top:${18 + (left % 3) * 14}%;"></div>
                `)
                .join('');
            return `
                <div class="tm-inline-loading-surface tm-inline-loading-surface--whiteboard">
                    <div class="tm-inline-loading-title">${title}</div>
                    <div class="tm-inline-loading-board">${cards}</div>
                </div>
            `;
        }
        return `
            <div class="tm-inline-loading-surface">
                <div class="tm-inline-loading-title">${title}</div>
                <div class="tm-inline-loading-list">${listRows}</div>
            </div>
        `;
    }

    function __tmBuildInlineLoadingTopbarMarkup() {
        return `
            <div class="tm-inline-loading-topbar-shell">
                <div class="tm-inline-loading-topbar-line">
                    <span class="tm-inline-loading-topbar-track"></span>
                    <span class="tm-inline-loading-topbar-indicator"></span>
                </div>
                <div class="tm-inline-loading-topbar-badge">
                    <span class="tm-inline-loading-spinner" aria-hidden="true"></span>
                    <span class="tm-inline-loading-topbar-text">加载中</span>
                </div>
            </div>
        `;
    }

    function __tmSyncInlineLoadingOverlay(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const stage = modal?.querySelector?.('.tm-main-stage');
        if (!(stage instanceof HTMLElement)) return false;
        const active = !!state.uiInlineLoadingActive;
        const visible = !!(active && state.uiInlineLoadingVisible);
        try { stage.setAttribute('aria-busy', active ? 'true' : 'false'); } catch (e) {}
        let overlay = null;
        try { overlay = stage.querySelector('.tm-inline-loading-overlay'); } catch (e) {}
        if (!visible) {
            if (overlay) {
                try { overlay.remove(); } catch (e) {}
            }
            return false;
        }
        const mode = String(state.viewMode || 'list').trim() || 'list';
        if (!(overlay instanceof HTMLElement)) {
            overlay = document.createElement('div');
            overlay.className = 'tm-inline-loading-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            try { stage.appendChild(overlay); } catch (e) { return false; }
        }
        const styleKind = String(state.uiInlineLoadingStyleKind || '').trim() || (__tmHasTaskDataReadyForUi() ? 'topbar' : 'skeleton');
        if (String(overlay.getAttribute('data-tm-loading-style') || '').trim() !== styleKind) {
            try { overlay.setAttribute('data-tm-loading-style', styleKind); } catch (e) {}
            try { overlay.className = `tm-inline-loading-overlay tm-inline-loading-overlay--${styleKind}`; } catch (e) {}
        }
        const renderSig = styleKind === 'topbar' ? styleKind : `${styleKind}:${mode}`;
        if (String(overlay.getAttribute('data-tm-loading-render-sig') || '').trim() !== renderSig) {
            try { overlay.setAttribute('data-tm-loading-mode', mode); } catch (e) {}
            try { overlay.setAttribute('data-tm-loading-render-sig', renderSig); } catch (e) {}
            try {
                overlay.innerHTML = styleKind === 'topbar'
                    ? __tmBuildInlineLoadingTopbarMarkup()
                    : __tmBuildInlineLoadingSkeletonMarkup();
            } catch (e) {}
        }
        return true;
    }

    function __tmSetInlineLoading(active, options = {}) {
        const next = !!active;
        if (!next) {
            const changed = !!(state.uiInlineLoadingActive || state.uiInlineLoadingVisible || state.uiInlineLoadingTimer);
            __tmClearInlineLoadingTimer();
            state.uiInlineLoadingActive = false;
            state.uiInlineLoadingVisible = false;
            state.uiInlineLoadingToken = 0;
            state.uiInlineLoadingStyleKind = '';
            if (changed) {
                try { __tmSyncInlineLoadingOverlay(state.modal); } catch (e) {}
            }
            return;
        }
        const token = Number(options?.token) || Number(state.openToken) || 0;
        const styleKind = String(options?.styleKind || '').trim() || (__tmHasTaskDataReadyForUi() ? 'topbar' : 'skeleton');
        const delayMs = Number.isFinite(Number(options?.delayMs))
            ? Math.max(0, Math.round(Number(options.delayMs)))
            : (__tmHasTaskDataReadyForUi() ? 220 : 140);
        __tmClearInlineLoadingTimer();
        state.uiInlineLoadingActive = true;
        state.uiInlineLoadingVisible = false;
        state.uiInlineLoadingToken = token;
        state.uiInlineLoadingStyleKind = styleKind;
        try { __tmSyncInlineLoadingOverlay(state.modal); } catch (e) {}
        const reveal = () => {
            if (!state.uiInlineLoadingActive) return;
            if (token && token !== (Number(state.uiInlineLoadingToken) || 0)) return;
            state.uiInlineLoadingVisible = true;
            try { __tmSyncInlineLoadingOverlay(state.modal); } catch (e) {}
        };
        if (delayMs <= 0) {
            reveal();
            return;
        }
        state.uiInlineLoadingTimer = setTimeout(() => {
            state.uiInlineLoadingTimer = 0;
            reveal();
        }, delayMs);
    }

    const __tmModalStack = [];
    let __tmModalStackEscHandler = null;

    function __tmModalStackPush(entry) {
        if (!entry || typeof entry.close !== 'function') return __tmModalStack.length;
        __tmModalStack.push(entry);
        return __tmModalStack.length;
    }

    function __tmModalStackRemove(entry) {
        const idx = __tmModalStack.indexOf(entry);
        if (idx !== -1) __tmModalStack.splice(idx, 1);
        return __tmModalStack.length;
    }

    function __tmModalStackPop() {
        if (__tmModalStack.length === 0) return 0;
        const top = __tmModalStack[__tmModalStack.length - 1];
        try { top.close(); } catch (e) {}
        __tmModalStackRemove(top);
        return __tmModalStack.length;
    }

    function __tmModalStackBind(closeFn) {
        let entry = { close: closeFn };
        __tmModalStackPush(entry);
        return () => {
            if (entry) { __tmModalStackRemove(entry); entry = null; }
        };
    }

    (function __tmInitModalStackEscHandler() {
        if (__tmModalStackEscHandler) {
            try { globalThis.__tmRuntimeEvents?.off?.(document, 'keydown', __tmModalStackEscHandler, true); } catch (e) {}
        }
        __tmModalStackEscHandler = (e) => {
            if (e.key !== 'Escape') return;
            if (__tmModalStack.length === 0) return;
            try { e.preventDefault(); } catch (e2) {}
            try { e.stopPropagation(); } catch (e2) {}
            __tmModalStackPop();
        };
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'keydown', __tmModalStackEscHandler, true); } catch (e) {}
    })();

    function __tmGetTodayDateKey() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    const __TM_SEMANTIC_DATE_RECOGNIZED_KEY = 'tm_semantic_date_recognized';
    const __TM_SEMANTIC_DATE_AUTO_SCAN_BATCH_SIZE = 120;
    const __TM_SEMANTIC_DATE_AUTO_PROMPT_BATCH_SIZE = 50;

    function __tmYieldSemanticDateScan() {
        return new Promise((resolve) => {
            try { setTimeout(resolve, 0); } catch (e) { resolve(); }
        });
    }

    const SemanticDateRecognizedStore = {
        data: Storage.get(__TM_SEMANTIC_DATE_RECOGNIZED_KEY, {}) || {},
        loaded: false,
        loadingPromise: null,
        saving: false,
        saveDirty: false,
        saveTimer: null,

        normalize(input) {
            const source = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
            const out = {};
            Object.entries(source).forEach(([taskId, raw]) => {
                const id = String(taskId || '').trim();
                if (!id) return;
                const item = (raw && typeof raw === 'object' && !Array.isArray(raw))
                    ? raw
                    : { signature: String(raw || '').trim() };
                const signature = String(item.signature || '').trim();
                if (!signature) return;
                out[id] = {
                    signature,
                    recognizedAt: Number(item.recognizedAt) || Date.now(),
                    completionValue: String(item.completionValue || '').trim(),
                    hasTime: !!item.hasTime,
                };
            });
            return out;
        },

        mergeMaps(baseInput, incomingInput) {
            const base = this.normalize(baseInput);
            const incoming = this.normalize(incomingInput);
            const out = { ...base };
            Object.entries(incoming).forEach(([taskId, item]) => {
                const id = String(taskId || '').trim();
                if (!id || !item) return;
                const prev = out[id];
                const prevAt = Number(prev?.recognizedAt) || 0;
                const nextAt = Number(item?.recognizedAt) || 0;
                if (!prev || nextAt >= prevAt) out[id] = { ...item };
            });
            return out;
        },

        syncLocalCache() {
            this.data = this.normalize(this.data);
            this.loaded = true;
            try { Storage.set(__TM_SEMANTIC_DATE_RECOGNIZED_KEY, this.data || {}); } catch (e) {}
        },

        async load() {
            if (this.loaded) return this.data;
            if (this.loadingPromise) return this.loadingPromise;
            this.loadingPromise = Promise.resolve().then(async () => {
                let next = this.normalize(Storage.get(__TM_SEMANTIC_DATE_RECOGNIZED_KEY, {}) || {});
                try {
                    const res = await fetch('/api/file/getFile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: SEMANTIC_DATE_RECOGNIZED_FILE_PATH }),
                    });
                    if (res.ok) {
                        const text = await res.text();
                        if (text && text.trim()) {
                            const json = JSON.parse(text);
                            const fromFile = this.normalize(json);
                            if (Object.keys(fromFile).length > 0) next = this.mergeMaps(fromFile, next);
                        }
                    }
                } catch (e) {}
                this.data = next;
                this.syncLocalCache();
                return this.data;
            }).finally(() => {
                this.loadingPromise = null;
            });
            return this.loadingPromise;
        },

        snapshot() {
            return this.normalize(this.data);
        },

        upsertMany(items, options = {}) {
            const list = Array.isArray(items) ? items : [];
            if (!list.length) return;
            const persist = options?.persist !== false;
            const base = this.normalize(this.data);
            const now = Date.now();
            list.forEach((item) => {
                const taskId = String(item?.taskId || '').trim();
                const signature = String(item?.signature || '').trim();
                if (!taskId || !signature) return;
                base[taskId] = {
                    signature,
                    recognizedAt: now,
                    completionValue: String(item?.completionValue || '').trim(),
                    hasTime: !!item?.hasTime,
                };
            });
            this.data = base;
            this.syncLocalCache();
            if (!persist) return;
            this.saveDirty = true;
            try { if (this.saveTimer) clearTimeout(this.saveTimer); } catch (e) {}
            this.saveTimer = setTimeout(() => {
                this.saveTimer = null;
                this.saveNow();
            }, 120);
            try { this.saveNow(); } catch (e) {}
        },

        async saveNow() {
            if (this.saving) return;
            if (!this.saveDirty) return;
            this.saving = true;
            this.saveDirty = false;
            try {
                this.syncLocalCache();
                const formDir = new FormData();
                formDir.append('path', PLUGIN_STORAGE_DIR);
                formDir.append('isDir', 'true');
                await fetch('/api/file/putFile', { method: 'POST', body: formDir }).catch(() => null);

                const form = new FormData();
                form.append('path', SEMANTIC_DATE_RECOGNIZED_FILE_PATH);
                form.append('isDir', 'false');
                form.append('file', new Blob([JSON.stringify(this.data || {}, null, 2)], { type: 'application/json' }));
                await fetch('/api/file/putFile', { method: 'POST', body: form }).catch(() => null);
            } catch (e) {
            } finally {
                this.saving = false;
                if (this.saveDirty) {
                    try { if (this.saveTimer) clearTimeout(this.saveTimer); } catch (e2) {}
                    this.saveTimer = setTimeout(() => {
                        this.saveTimer = null;
                        this.saveNow();
                    }, 120);
                }
            }
        }
    };

    function __tmSemanticPad2(n) {
        return String(Math.max(0, Math.floor(Number(n) || 0))).padStart(2, '0');
    }

    function __tmSemanticFormatDateKey(dt) {
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
        return `${dt.getFullYear()}-${__tmSemanticPad2(dt.getMonth() + 1)}-${__tmSemanticPad2(dt.getDate())}`;
    }

    function __tmSemanticFormatDateTime(dt) {
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
        return `${__tmSemanticFormatDateKey(dt)} ${__tmSemanticPad2(dt.getHours())}:${__tmSemanticPad2(dt.getMinutes())}`;
    }

    function __tmSemanticStartOfDay(baseDate) {
        const now = (baseDate instanceof Date && !Number.isNaN(baseDate.getTime()))
            ? new Date(baseDate.getTime())
            : new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    }

    function __tmSemanticClampYmd(y, m1, d) {
        const year = Number(y);
        const month1 = Number(m1);
        const day = Number(d);
        if (!Number.isFinite(year) || !Number.isFinite(month1) || !Number.isFinite(day)) return null;
        if (year < 1970 || year > 9999 || month1 < 1 || month1 > 12) return null;
        const last = new Date(year, month1, 0).getDate();
        const dt = new Date(year, month1 - 1, Math.max(1, Math.min(last, day)), 0, 0, 0, 0);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function __tmSemanticDowFromToken(token) {
        const t = String(token || '').trim();
        if (!t) return null;
        if (/^[1-7]$/.test(t)) {
            const n = parseInt(t, 10);
            if (n === 7) return 0;
            return n;
        }
        const map = { '日': 0, '天': 0, '七': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
        return Object.prototype.hasOwnProperty.call(map, t) ? map[t] : null;
    }

    function __tmSemanticAdjustHourByPeriod(hour, period) {
        let hh = Number(hour);
        if (!Number.isFinite(hh) || hh < 0 || hh > 23) return null;
        const p = String(period || '').trim();
        if (!p) return hh;
        if (p === '凌晨') {
            if (hh === 12) hh = 0;
        } else if (['上午', '早上', '早晨', '清晨', '今早', '今晨', '明早', '明晨', '早'].includes(p)) {
            if (hh === 12) hh = 0;
        } else if (p === '中午') {
            if (hh >= 1 && hh <= 10) hh += 12;
        } else if (['下午', '傍晚', '晚上', '今晚', '明晚', '晚'].includes(p)) {
            if (hh < 12) hh += 12;
        }
        return (hh >= 0 && hh <= 23) ? hh : null;
    }

    function __tmSemanticNormalizeMatchText(value) {
        return String(value || '')
            .replace(/[，。；、]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function __tmSemanticExtractTimeInfo(rawText) {
        const text = String(rawText || '')
            .replace(/[，。；、]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text) return null;
        const colon = /(?:^|[^\d])(?:(凌晨|上午|早上|早晨|清晨|今早|今晨|明早|明晨|中午|下午|傍晚|晚上|今晚|明晚|晚|早)\s*)?(\d{1,2})\s*[:：]\s*(\d{1,2})(?!\d)/.exec(text);
        if (colon) {
            const hour0 = Number(colon[2]);
            const minute = Number(colon[3]);
            const hour = __tmSemanticAdjustHourByPeriod(hour0, colon[1]);
            if (Number.isFinite(hour) && Number.isFinite(minute) && minute >= 0 && minute <= 59) {
                const matchedText = __tmSemanticNormalizeMatchText(colon[0]);
                return {
                    hour,
                    minute,
                    label: `${hour0}:${__tmSemanticPad2(minute)}${colon[1] ? `（${colon[1]}）` : ''}`,
                    stableKey: `clock:${matchedText}`,
                    matchedText,
                };
            }
        }
        const cn = /(?:^|[^\d])(?:(凌晨|上午|早上|早晨|清晨|今早|今晨|明早|明晨|中午|下午|傍晚|晚上|今晚|明晚|晚|早)\s*)?(\d{1,2})\s*点\s*(半|一刻|三刻|整|(\d{1,2})\s*分?)?/.exec(text);
        if (!cn) return null;
        const hour0 = Number(cn[2]);
        let minute = 0;
        const suffix = String(cn[3] || '').trim();
        if (suffix === '半') minute = 30;
        else if (suffix === '一刻') minute = 15;
        else if (suffix === '三刻') minute = 45;
        else if (cn[4] !== undefined && cn[4] !== null && String(cn[4]).trim() !== '') minute = Number(cn[4]);
        const hour = __tmSemanticAdjustHourByPeriod(hour0, cn[1]);
        if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return null;
        const matchedText = __tmSemanticNormalizeMatchText(cn[0]);
        return {
            hour,
            minute,
            label: `${hour0}点${suffix || ''}${cn[1] ? `（${cn[1]}）` : ''}`,
            stableKey: `cn:${matchedText}`,
            matchedText,
        };
    }

    function __tmSemanticExtractDateInfo(rawText, baseDate) {
        const text = String(rawText || '')
            .replace(/[，。；、]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text) return null;
        const today = __tmSemanticStartOfDay(baseDate);
        const todayMs = today.getTime();
        const ymd = /(\d{4})[./-](\d{1,2})[./-](\d{1,2})/.exec(text);
        const mdCn = /(\d{1,2})\s*月\s*(\d{1,2})\s*(日|号)?/.exec(text);
        // 仅保留斜杠月日简写，避免把版本号/编号如 5-2、5.2 误识别成 5月2日
        const md = /(^|[^\d])(\d{1,2})\/(\d{1,2})(?!\d)/.exec(text);
        const rel = /(今天|今日|今早|今晨|今晚|明天|明早|明晨|明晚|后天|大后天)/.exec(text);
        const dur = /(\d+)\s*(天|日|周|星期|礼拜)\s*后/.exec(text);
        const weekday = /((本周|这周|下周|下下周)?\s*(周|星期|礼拜)\s*([一二三四五六日天1-7]))/.exec(text);
        let dt = null;
        let reason = '';
        let stableKey = '';
        let matchedText = '';
        let isRelative = false;
        if (ymd) {
            dt = __tmSemanticClampYmd(ymd[1], ymd[2], ymd[3]);
            reason = '识别到明确日期';
            matchedText = __tmSemanticNormalizeMatchText(ymd[0]);
            stableKey = `ymd:${matchedText}`;
        } else if (mdCn) {
            dt = __tmSemanticClampYmd(today.getFullYear(), mdCn[1], mdCn[2]);
            if (dt && dt.getTime() < todayMs) dt.setFullYear(dt.getFullYear() + 1);
            reason = '识别到月日表达';
            matchedText = __tmSemanticNormalizeMatchText(mdCn[0]);
            stableKey = `mdcn:${matchedText}`;
        } else if (md) {
            dt = __tmSemanticClampYmd(today.getFullYear(), md[2], md[3]);
            if (dt && dt.getTime() < todayMs) dt.setFullYear(dt.getFullYear() + 1);
            reason = '识别到数字日期';
            matchedText = __tmSemanticNormalizeMatchText(md[0]);
            stableKey = `md:${matchedText}`;
        } else if (rel) {
            dt = new Date(today.getTime());
            const token = String(rel[1] || '').trim();
            if (token.startsWith('明')) dt.setDate(dt.getDate() + 1);
            else if (token === '后天') dt.setDate(dt.getDate() + 2);
            else if (token === '大后天') dt.setDate(dt.getDate() + 3);
            reason = `识别到${token}`;
            matchedText = __tmSemanticNormalizeMatchText(rel[0]);
            stableKey = `rel:${matchedText}`;
            isRelative = true;
        } else if (dur) {
            dt = new Date(today.getTime());
            const n = parseInt(dur[1], 10) || 0;
            if (dur[2] === '天' || dur[2] === '日') dt.setDate(dt.getDate() + n);
            else dt.setDate(dt.getDate() + n * 7);
            reason = `识别到“${dur[0]}”`;
            matchedText = __tmSemanticNormalizeMatchText(dur[0]);
            stableKey = `dur:${matchedText}`;
            isRelative = true;
        } else if (weekday) {
            const scope = String(weekday[2] || '').trim();
            const targetDow = __tmSemanticDowFromToken(weekday[4]);
            if (Number.isFinite(targetDow)) {
                dt = new Date(today.getTime());
                let forward = (targetDow - dt.getDay() + 7) % 7;
                if (scope === '下周') forward += 7;
                else if (scope === '下下周') forward += 14;
                else if (!scope && forward === 0) forward += 7;
                dt.setDate(dt.getDate() + forward);
                reason = `识别到${weekday[1]}`;
                matchedText = __tmSemanticNormalizeMatchText(weekday[1]);
                stableKey = `weekday:${matchedText}`;
                isRelative = true;
            }
        }
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return null;
        return {
            date: dt,
            reason: reason || '识别到日期',
            stableKey: stableKey || `date:${__tmSemanticFormatDateKey(dt)}`,
            matchedText: matchedText || __tmSemanticFormatDateKey(dt),
            isRelative,
        };
    }

    function __tmBuildSemanticTaskLegacySignature(task, completionValue, sourceKey) {
        return [
            String(task?.content || '').trim(),
            String(task?.remark || '').trim(),
            String(sourceKey || '').trim(),
            String(completionValue || '').trim(),
        ].join('||');
    }

    function __tmBuildSemanticTaskSignature(task, sourceKey, dateStableKey, timeStableKey) {
        return [
            String(sourceKey || '').trim(),
            String(dateStableKey || '').trim(),
            String(timeStableKey || '').trim(),
        ].join('||');
    }

    function __tmLoadSemanticDateRecognizedMap() {
        return SemanticDateRecognizedStore.snapshot();
    }

    function __tmSaveSemanticDateRecognizedMap(map) {
        SemanticDateRecognizedStore.data = SemanticDateRecognizedStore.normalize(map);
        SemanticDateRecognizedStore.syncLocalCache();
        SemanticDateRecognizedStore.saveDirty = true;
        try { SemanticDateRecognizedStore.saveNow(); } catch (e) {}
    }

    function __tmMarkSemanticDateSuggestionsRecognized(items, options = {}) {
        SemanticDateRecognizedStore.upsertMany(items, options);
    }

    function __tmLoadCalendarScheduledTaskIds() {
        const raw = Storage.get('tm-calendar-events', []);
        const set = new Set();
        (Array.isArray(raw) ? raw : []).forEach((item) => {
            const taskId = String(item?.taskId || item?.task_id || item?.linkedTaskId || item?.linked_task_id || '').trim();
            if (taskId) set.add(taskId);
        });
        return set;
    }

    function __tmExtractSemanticTaskDateSuggestion(task, baseDate) {
        const target = (task && typeof task === 'object') ? task : null;
        const sources = [
            { key: 'content', label: '任务内容', text: String(target?.content || '').trim() },
            { key: 'remark', label: '备注', text: String(target?.remark || '').trim() },
        ].filter((item) => item.text);
        for (const source of sources) {
            const dateInfo = __tmSemanticExtractDateInfo(source.text, baseDate);
            if (!dateInfo) continue;
            const timeInfo = __tmSemanticExtractTimeInfo(source.text);
            const resolved = new Date(dateInfo.date.getTime());
            let completionValue = __tmSemanticFormatDateKey(resolved);
            if (timeInfo) {
                resolved.setHours(timeInfo.hour, timeInfo.minute, 0, 0);
                completionValue = __tmSemanticFormatDateTime(resolved);
            }
            if (!completionValue) continue;
            return {
                taskId: String(target?.id || '').trim(),
                docId: String(target?.root_id || target?.docId || '').trim(),
                content: String(target?.content || '').trim() || '未命名任务',
                remark: String(target?.remark || '').trim(),
                currentCompletionTime: String(target?.completionTime || '').trim(),
                completionValue,
                hasTime: !!timeInfo,
                start: timeInfo ? new Date(resolved.getTime()) : null,
                reason: `${source.label}：${dateInfo.reason}${timeInfo ? `，识别到 ${timeInfo.label}` : ''}`,
                isRelativeDate: !!dateInfo.isRelative,
                sourceKey: String(source.key || '').trim(),
                dateStableKey: String(dateInfo.stableKey || '').trim(),
                timeStableKey: String(timeInfo?.stableKey || '').trim(),
                signature: __tmBuildSemanticTaskSignature(target, source.key, dateInfo.stableKey, timeInfo?.stableKey),
            };
        }
        return null;
    }

    async function __tmCollectSemanticDateSuggestions(tasks, options = {}) {
        try { await SemanticDateRecognizedStore.load(); } catch (e) {}
        const opts = (options && typeof options === 'object') ? options : {};
        const maxSuggestions0 = Number(opts.maxSuggestions);
        const maxSuggestions = Number.isFinite(maxSuggestions0) && maxSuggestions0 > 0
            ? Math.max(1, Math.min(200, Math.floor(maxSuggestions0)))
            : 0;
        const batchSize0 = Number(opts.batchSize);
        const batchSize = Number.isFinite(batchSize0) && batchSize0 > 0
            ? Math.max(20, Math.min(500, Math.floor(batchSize0)))
            : __TM_SEMANTIC_DATE_AUTO_SCAN_BATCH_SIZE;
        const shouldStop = typeof opts.shouldStop === 'function' ? opts.shouldStop : null;
        const list = Array.isArray(tasks) ? tasks : [];
        const recognizedMap = __tmLoadSemanticDateRecognizedMap();
        const scheduledTaskIds = __tmLoadCalendarScheduledTaskIds();
        const hasCalendarModule = !!globalThis.__tmCalendar?.addTaskSchedule;
        const out = [];
        let truncated = false;
        const now = new Date();
        for (let index = 0; index < list.length; index += 1) {
            if (shouldStop && shouldStop()) {
                return { items: out, truncated, interrupted: true };
            }
            const task = list[index];
            if (truncated) break;
            const taskId = String(task?.id || '').trim();
            if (taskId && task && !task.done && !String(task?.completionTime || '').trim()) {
                const suggestion = __tmExtractSemanticTaskDateSuggestion(task, now);
                if (suggestion) {
                    const recognized = recognizedMap[taskId];
                    const prevSignature = String(recognized?.signature || recognized || '').trim();
                    let skipSuggestion = !!(prevSignature && prevSignature === suggestion.signature);
                    if (!skipSuggestion && suggestion.isRelativeDate) {
                        const legacySignature = __tmBuildSemanticTaskLegacySignature(task, recognized?.completionValue, suggestion.sourceKey);
                        skipSuggestion = !!(prevSignature && recognized?.completionValue && prevSignature === legacySignature);
                    }
                    if (!skipSuggestion) {
                        const scheduleExists = scheduledTaskIds.has(taskId);
                        const calendarEligible = !!suggestion.hasTime && !scheduleExists && hasCalendarModule;
                        out.push({
                            ...suggestion,
                            scheduleExists,
                            calendarEligible,
                            actionLabel: suggestion.hasTime
                                ? (calendarEligible
                                    ? '写入截止日期并添加到日历'
                                    : (scheduleExists ? '写入截止日期（该任务已有日历）' : '写入截止日期（日历模块未加载）'))
                                : '写入截止日期',
                        });
                        if (maxSuggestions > 0 && out.length >= maxSuggestions) {
                            truncated = true;
                        }
                    }
                }
            }
            if ((index + 1) % batchSize === 0) {
                await __tmYieldSemanticDateScan();
                if (shouldStop && shouldStop()) {
                    return { items: out, truncated, interrupted: true };
                }
            }
        }
        return { items: out, truncated, interrupted: false };
    }

    function __tmCloseSemanticDateConfirmModal() {
        state.__semanticDateConfirmUnstack?.();
        state.__semanticDateConfirmUnstack = null;
        if (!state.semanticDateConfirmModal) return;
        try { state.semanticDateConfirmModal.remove(); } catch (e) {}
        state.semanticDateConfirmModal = null;
        state.semanticDateAutoApplying = false;
    }

    function __tmGetSemanticDateConfirmHost() {
        try {
            const mountRoot = __tmGetMountRoot?.();
            if (mountRoot instanceof HTMLElement && document.body.contains(mountRoot)) {
                return mountRoot;
            }
        } catch (e) {}
        return document.body;
    }

    function __tmPrepareTaskForSemanticScan(rawTask) {
        if (!rawTask || typeof rawTask !== 'object') return null;
        if (rawTask.otherBlockType || rawTask.otherBlockSubtype || rawTask.otherBlockGroupId) return null;
        const task = { ...rawTask };
        const taskId = String(task?.id || '').trim();
        const docId = String(task?.root_id || task?.docId || '').trim();
        if (!taskId || !docId) return null;
        try {
            if (typeof task.markdown === 'string' && task.markdown) {
                const parsed = API.parseTaskStatus(task.markdown);
                task.done = !!parsed.done;
                task.content = parsed.content;
            }
        } catch (e) {}
        try { MetaStore.applyToTask(task); } catch (e) {}
        try {
            const docName = String(task.docName || task.doc_name || '未命名文档').trim() || '未命名文档';
            normalizeTaskFields(task, docName);
        } catch (e) {}
        return task;
    }

    async function __tmLoadSemanticDateTasksForAutoPrompt(token) {
        try { await MetaStore.load(); } catch (e) {}
        const mergedTasks = [];
        const seenTaskIds = new Set();
        Object.values(state.flatTasks || {}).forEach((rawTask) => {
            const task = __tmPrepareTaskForSemanticScan(rawTask);
            const taskId = String(task?.id || '').trim();
            if (!taskId || seenTaskIds.has(taskId)) return;
            seenTaskIds.add(taskId);
            mergedTasks.push(task);
        });

        const currentGroupId = String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all';
        if (currentGroupId === 'all') return mergedTasks;

        const allDocIds = await resolveDocIdsFromGroups({
            groupId: 'all',
            forceRefreshScope: !!state.isRefreshing,
        });
        if (token !== undefined && token !== null && token !== (Number(state.openToken) || 0)) return mergedTasks;

        const loadedDocIdSet = new Set(
            (Array.isArray(state.__tmLoadedDocIdsForTasks) ? state.__tmLoadedDocIdsForTasks : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean)
        );
        const missingDocIds = (Array.isArray(allDocIds) ? allDocIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => id && !loadedDocIdSet.has(id));
        if (!missingDocIds.length) return mergedTasks;

        const queryLimit = Number.isFinite(Number(state.queryLimit || SettingsStore?.data?.queryLimit))
            ? Math.max(1, Math.min(5000, Math.round(Number(state.queryLimit || SettingsStore?.data?.queryLimit))))
            : 500;
        try {
            const res = await API.getTasksByDocuments(missingDocIds, queryLimit, {
                doneOnly: false,
                forceFresh: !!state.isRefreshing,
            });
            const extraTasks = Array.isArray(res?.tasks) ? res.tasks : [];
            extraTasks.forEach((rawTask) => {
                const task = __tmPrepareTaskForSemanticScan(rawTask);
                const taskId = String(task?.id || '').trim();
                if (!taskId || seenTaskIds.has(taskId)) return;
                seenTaskIds.add(taskId);
                mergedTasks.push(task);
            });
        } catch (e) {}
        return mergedTasks;
    }

    async function __tmApplySemanticDateSuggestions(items) {
        const chosen = Array.isArray(items) ? items.filter(Boolean) : [];
        if (!chosen.length) return { completionApplied: 0, calendarApplied: 0, failures: [], appliedItems: [] };
        const failures = [];
        const touchedDocIds = new Set();
        const appliedItems = [];
        let docsToGroupMap = null;
        try {
            if (typeof __tmGetCalendarDocsToGroupMapSync === 'function') {
                docsToGroupMap = __tmGetCalendarDocsToGroupMapSync();
            }
        } catch (e) {}
        let completionApplied = 0;
        let calendarApplied = 0;
        let calendarChanged = false;
        for (const item of chosen) {
            const taskId = String(item?.taskId || '').trim();
            if (!taskId) continue;
            const task = state.flatTasks?.[taskId] || null;
            const taskTitle = String(item?.content || task?.content || taskId).trim() || taskId;
            const completionValue = String(item?.completionValue || '').trim();
            if (!completionValue) continue;
            try {
                await __tmPersistMetaAndAttrsAsync(taskId, { completionTime: completionValue });
                if (task && typeof task === 'object') task.completionTime = completionValue;
                touchedDocIds.add(String(item?.docId || task?.root_id || task?.docId || '').trim());
                completionApplied += 1;
                appliedItems.push(item);
            } catch (e) {
                failures.push(`${taskTitle}：截止日期写入失败（${String(e?.message || e || '未知错误')}）`);
                continue;
            }
            if (item?.calendarEligible && item?.start instanceof Date && !Number.isNaN(item.start.getTime())) {
                try {
                    const calendar = globalThis.__tmCalendar;
                    if (!calendar?.addTaskSchedule) throw new Error('日历模块未加载');
                    const durationMin = 60;
                    const end = new Date(item.start.getTime() + durationMin * 60000);
                    const taskDocId = String(item?.docId || task?.root_id || task?.docId || '').trim();
                    const defaultCalendarId = String(SettingsStore?.data?.calendarDefaultCalendarId || 'default').trim() || 'default';
                    let resolvedCalendarId = defaultCalendarId;
                    if (docsToGroupMap instanceof Map && taskDocId) {
                        const groupId = String(docsToGroupMap.get(taskDocId) || '').trim();
                        if (groupId) resolvedCalendarId = `group:${groupId}`;
                    }
                    await calendar.addTaskSchedule({
                        taskId,
                        title: taskTitle,
                        start: new Date(item.start.getTime()),
                        end,
                        calendarId: resolvedCalendarId,
                        preferCalendarColor: true,
                        durationMin,
                        allDay: false,
                        refresh: false,
                    });
                    calendarApplied += 1;
                    calendarChanged = true;
                } catch (e) {
                    failures.push(`${taskTitle}：日历写入失败（${String(e?.message || e || '未知错误')}）`);
                }
            }
        }
        touchedDocIds.forEach((docId) => {
            if (!docId) return;
            try { __tmInvalidateTasksQueryCacheByDocId(docId); } catch (e) {}
        });
        try { applyFilters(); } catch (e) {}
        try {
            if (state.modal && document.body.contains(state.modal)) render();
        } catch (e) {}
        if (calendarChanged) {
            try {
                if (typeof globalThis.__tmCalendar?.requestRefresh === 'function') {
                    await globalThis.__tmCalendar.requestRefresh({
                        reason: 'semantic-date-apply',
                        main: true,
                        side: true,
                        flushTaskPanel: true,
                        hard: false,
                    });
                } else {
                    await globalThis.__tmCalendar?.refreshInPlace?.({ silent: false, hard: false });
                }
            } catch (e) {}
        }
        return { completionApplied, calendarApplied, failures, appliedItems };
    }

    function __tmShowSemanticDateConfirmModal(items, options = {}) {
        const list = Array.isArray(items) ? items.filter(Boolean) : [];
        if (!list.length) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const host = __tmGetSemanticDateConfirmHost();
        const scopedToManager = host instanceof HTMLElement && host !== document.body;
        const batchCount0 = Number(opts.batchCount);
        const batchCount = Number.isFinite(batchCount0) && batchCount0 > 0 ? Math.max(1, Math.floor(batchCount0)) : 1;
        const batchIndex0 = Number(opts.batchIndex);
        const batchIndex = Number.isFinite(batchIndex0) && batchIndex0 > 0 ? Math.min(batchCount, Math.floor(batchIndex0)) : 1;
        const totalCount0 = Number(opts.totalCount);
        const totalCount = Number.isFinite(totalCount0) && totalCount0 > 0 ? Math.max(list.length, Math.floor(totalCount0)) : list.length;
        const remainingItems = Array.isArray(opts.remainingItems) ? opts.remainingItems.filter(Boolean) : [];
        __tmCloseSemanticDateConfirmModal();
        const dateOnlyCount = list.filter((item) => !item?.hasTime).length;
        const dateTimeCount = list.filter((item) => !!item?.hasTime).length;
        const modal = document.createElement('div');
        modal.className = 'tm-modal';
        modal.style.cssText = scopedToManager
            ? 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:200002;'
            : 'z-index:200002;';
        const box = document.createElement('div');
        box.className = 'tm-box';
        box.style.cssText = 'width:min(920px,94vw);height:min(82vh,760px);display:flex;flex-direction:column;';
        box.innerHTML = `
            <div class="tm-header" style="padding:12px 16px;border-bottom:1px solid var(--tm-border-color);">
                <div style="font-size:16px;font-weight:600;">语义日期识别确认</div>
                <button class="tm-btn tm-btn-gray" data-tm-semantic-action="close" style="padding:4px 8px;font-size:12px;">✕</button>
            </div>
            <div class="tm-body" style="padding:12px 16px;display:flex;flex-direction:column;gap:10px;overflow:auto;">
                <div style="font-size:13px;color:var(--tm-secondary-text);line-height:1.6;">
                    本次刷新自动识别到 <b>${totalCount}</b> 条语义日期。
                    ${batchCount > 1 ? `当前展示第 <b>${batchIndex}</b> / <b>${batchCount}</b> 批，本批 <b>${list.length}</b> 条。` : `本批共 <b>${list.length}</b> 条。`}
                    其中仅日期 <b>${dateOnlyCount}</b> 条，带时分 <b>${dateTimeCount}</b> 条。
                    已识别过的同一任务内容后续重载不会再次扫描；新建任务刷新后会继续识别。
                </div>
                ${batchCount > 1 ? `
                    <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.6;padding:8px 10px;border:1px dashed var(--tm-border-color);border-radius:8px;background:var(--tm-card-bg);">
                        自动识别会先分批扫描全量任务，再按批次展示确认列表。
                        应用当前批次后会继续弹出下一批；取消则停止后续批次。
                    </div>
                ` : ''}
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="tm-btn tm-btn-secondary" data-tm-semantic-action="select-all" style="padding:6px 12px;">全选</button>
                    <button class="tm-btn tm-btn-secondary" data-tm-semantic-action="clear-all" style="padding:6px 12px;">全不选</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${list.map((item, index) => `
                        <label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);cursor:pointer;">
                            <input type="checkbox" data-tm-semantic-item="${index}" checked style="margin-top:2px;">
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:14px;font-weight:600;line-height:1.5;word-break:break-word;">${esc(item.content || '未命名任务')}</div>
                                <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.6;">当前截止日期：${esc(item.currentCompletionTime || '未设置')}</div>
                                <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.6;">识别结果：${esc(item.completionValue || '')}</div>
                                <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.6;">将执行：${esc(item.actionLabel || '写入截止日期')}</div>
                                <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.6;">依据：${esc(item.reason || '识别到日期表达')}</div>
                            </div>
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="tm-header" style="padding:12px 16px;border-top:1px solid var(--tm-border-color);justify-content:flex-end;gap:10px;">
                <button class="tm-btn tm-btn-secondary" data-tm-semantic-action="close" style="padding:8px 16px;">取消</button>
                <button class="tm-btn tm-btn-primary" data-tm-semantic-action="apply" style="padding:8px 16px;">应用勾选项</button>
            </div>
        `;
        modal.appendChild(box);
        modal.addEventListener('click', async (e) => {
            if (e.target === modal) {
                __tmCloseSemanticDateConfirmModal();
                return;
            }
            const target = e.target?.closest?.('[data-tm-semantic-action]');
            if (!target) return;
            const action = String(target.dataset.tmSemanticAction || '').trim();
            if (action === 'close') {
                __tmCloseSemanticDateConfirmModal();
                return;
            }
            if (action === 'select-all' || action === 'clear-all') {
                modal.querySelectorAll('input[data-tm-semantic-item]').forEach((input) => {
                    input.checked = action === 'select-all';
                });
                return;
            }
            if (action !== 'apply' || state.semanticDateAutoApplying) return;
            const chosen = list.filter((item, index) => {
                const input = modal.querySelector(`input[data-tm-semantic-item="${index}"]`);
                return !!input?.checked;
            });
            if (!chosen.length) {
                hint('⚠️ 请至少勾选一条识别结果', 'warning');
                return;
            }
            state.semanticDateAutoApplying = true;
            const allButtons = Array.from(modal.querySelectorAll('[data-tm-semantic-action]'));
            allButtons.forEach((btn) => { btn.disabled = true; });
            const applyBtn = target instanceof HTMLButtonElement ? target : modal.querySelector('[data-tm-semantic-action="apply"]');
            const prevText = applyBtn?.textContent || '应用勾选项';
            if (applyBtn) applyBtn.textContent = '应用中...';
            try {
                const result = await __tmApplySemanticDateSuggestions(chosen);
                if (Array.isArray(result.appliedItems) && result.appliedItems.length > 0) {
                    __tmMarkSemanticDateSuggestionsRecognized(result.appliedItems);
                }
                if (result.completionApplied > 0 || result.calendarApplied > 0) {
                    hint(`✅ 已写入 ${result.completionApplied} 条截止日期${result.calendarApplied > 0 ? `，新增 ${result.calendarApplied} 条日历` : ''}`, 'success');
                }
                if (result.failures.length > 0) {
                    try { console.warn('[task-horizon] semantic date apply failures:', result.failures); } catch (e2) {}
                    hint(`⚠️ ${result.failures.length} 条处理失败，请查看控制台`, 'warning');
                }
                __tmCloseSemanticDateConfirmModal();
                if (remainingItems.length > 0) {
                    const nextBatch = remainingItems.slice(0, __TM_SEMANTIC_DATE_AUTO_PROMPT_BATCH_SIZE);
                    const nextRemaining = remainingItems.slice(__TM_SEMANTIC_DATE_AUTO_PROMPT_BATCH_SIZE);
                    try {
                        setTimeout(() => {
                            try {
                                if (typeof __tmIsPluginVisibleNow === 'function' && !__tmIsPluginVisibleNow()) return;
                                __tmShowSemanticDateConfirmModal(nextBatch, {
                                    totalCount,
                                    batchCount,
                                    batchIndex: batchIndex + 1,
                                    remainingItems: nextRemaining,
                                });
                            } catch (e) {}
                        }, 0);
                    } catch (e) {
                        try {
                            if (typeof __tmIsPluginVisibleNow === 'function' && !__tmIsPluginVisibleNow()) return;
                            __tmShowSemanticDateConfirmModal(nextBatch, {
                                totalCount,
                                batchCount,
                                batchIndex: batchIndex + 1,
                                remainingItems: nextRemaining,
                            });
                        } catch (e2) {}
                    }
                }
            } catch (err) {
                allButtons.forEach((btn) => { btn.disabled = false; });
                if (applyBtn) applyBtn.textContent = prevText;
                state.semanticDateAutoApplying = false;
                hint(`❌ ${String(err?.message || err || '应用失败')}`, 'error');
            }
        });
        try { host.appendChild(modal); } catch (e) { document.body.appendChild(modal); }
        state.semanticDateConfirmModal = modal;
        state.__semanticDateConfirmUnstack = __tmModalStackBind(() => __tmCloseSemanticDateConfirmModal());
    }

    async function __tmMaybeAutoPromptSemanticDates(token) {
        if (token !== undefined && token !== null && token !== (Number(state.openToken) || 0)) return;
        if (!SettingsStore?.data?.semanticDateAutoPromptEnabled) return;
        if (state.semanticDateAutoApplying) return;
        if (state.semanticDateConfirmModal && document.body.contains(state.semanticDateConfirmModal)) return;
        if (typeof __tmIsPluginVisibleNow === 'function' && !__tmIsPluginVisibleNow()) return;
        const tasks = await __tmLoadSemanticDateTasksForAutoPrompt(token);
        if (token !== undefined && token !== null && token !== (Number(state.openToken) || 0)) return;
        const { items: suggestions, interrupted } = await __tmCollectSemanticDateSuggestions(tasks, {
            batchSize: __TM_SEMANTIC_DATE_AUTO_SCAN_BATCH_SIZE,
            shouldStop: () => {
                if (token !== undefined && token !== null && token !== (Number(state.openToken) || 0)) return true;
                if (typeof __tmIsPluginVisibleNow === 'function' && !__tmIsPluginVisibleNow()) return true;
                return false;
            },
        });
        if (interrupted) return;
        if (token !== undefined && token !== null && token !== (Number(state.openToken) || 0)) return;
        if (typeof __tmIsPluginVisibleNow === 'function' && !__tmIsPluginVisibleNow()) return;
        if (!suggestions.length) return;
        __tmMarkSemanticDateSuggestionsRecognized(suggestions, { persist: false });
        const batchCount = Math.max(1, Math.ceil(suggestions.length / __TM_SEMANTIC_DATE_AUTO_PROMPT_BATCH_SIZE));
        const firstBatch = suggestions.slice(0, __TM_SEMANTIC_DATE_AUTO_PROMPT_BATCH_SIZE);
        const remainingItems = suggestions.slice(__TM_SEMANTIC_DATE_AUTO_PROMPT_BATCH_SIZE);
        __tmShowSemanticDateConfirmModal(firstBatch, {
            totalCount: suggestions.length,
            batchCount,
            batchIndex: 1,
            remainingItems,
        });
    }

    function __tmHasTaskScheduledToday(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        if (String(state.todayScheduledTaskIdsDay || '') !== __tmGetTodayDateKey()) return false;
        const set = state.todayScheduledTaskIds;
        return !!(set instanceof Set && set.has(tid));
    }

    async function __tmLoadTodayScheduledTaskIds(force = false) {
        const dayKey = __tmGetTodayDateKey();
        const api = globalThis.__tmCalendar?.listTaskSchedulesByDay;
        const sourceReady = typeof api === 'function';
        state.todayScheduledSourceReady = !!sourceReady;
        if (!sourceReady) {
            return {
                changed: false,
                set: (state.todayScheduledTaskIds instanceof Set) ? state.todayScheduledTaskIds : new Set(),
            };
        }
        if (!force && state.todayScheduledSourceReady && String(state.todayScheduledTaskIdsDay || '') === dayKey && state.todayScheduledTaskIds instanceof Set) {
            return { changed: false, set: state.todayScheduledTaskIds };
        }
        if (!force && state.todayScheduledTaskIdsLoading) return state.todayScheduledTaskIdsLoading;
        const runner = (async () => {
            const next = new Set();
            try {
                const list = await api(dayKey);
                (Array.isArray(list) ? list : []).forEach((it) => {
                    const tid = String(it?.taskId || it?.task_id || it?.linkedTaskId || it?.linked_task_id || '').trim();
                    if (tid) next.add(tid);
                });
            } catch (e) {}
            const prev = (state.todayScheduledTaskIds instanceof Set) ? state.todayScheduledTaskIds : new Set();
            let changed = prev.size !== next.size;
            if (!changed) {
                for (const id of prev) {
                    if (!next.has(id)) { changed = true; break; }
                }
            }
            state.todayScheduledTaskIds = next;
            state.todayScheduledTaskIdsDay = dayKey;
            state.todayScheduledSourceReady = true;
            return { changed, set: next };
        })();
        state.todayScheduledTaskIdsLoading = runner;
        try {
            return await runner;
        } finally {
            if (state.todayScheduledTaskIdsLoading === runner) state.todayScheduledTaskIdsLoading = null;
        }
    }

    function __tmApplyTodayScheduledTaskNameMarks(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        const selectors = [
            '#tmTaskTable tbody tr[data-id] .tm-task-content-clickable',
            '#tmTimelineLeftTable tbody tr[data-id] .tm-task-content-clickable',
            '.tm-checklist-item[data-id] .tm-checklist-title',
            '.tm-body--kanban .tm-kanban-card[data-id] .tm-task-content-clickable',
        ].join(',');
        const items = modal.querySelectorAll(selectors);
        items.forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            const owner = el.closest('tr[data-id], .tm-kanban-card[data-id], .tm-checklist-item[data-id]');
            const tid = String(owner?.getAttribute?.('data-id') || '').trim();
            if (!tid) return;
            if (__tmHasTaskScheduledToday(tid)) el.style.color = 'var(--tm-primary-color)';
            else el.style.removeProperty('color');
        });
    }

    const __tmReminderMarkCache = new Map();
    const __tmReminderMarkLoading = new Set();
    const __tmReminderSnapshotCache = new Map();
    const __tmReminderListCache = {
        fetchedAt: 0,
        map: new Map(),
        inflight: null,
    };
    const __TM_REMINDER_REPEAT_MODE_FOLLOW_TASK = 'followTaskRepeat';
    const __TM_REMINDER_SNAPSHOT_TTL_MS = 1800;

    function __tmReminderToDateSafe(value) {
        if (value instanceof Date) return new Date(value.getTime());
        const s = String(value || '').trim();
        if (!s) return new Date(NaN);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`);
        if (/^\d+$/.test(s)) {
            const n = Number(s);
            if (Number.isFinite(n) && n > 0) {
                return new Date(n < 1e12 ? n * 1000 : n);
            }
        }
        const next = new Date(s.replace(' ', 'T'));
        return next;
    }

    function __tmNormalizeReminderDateKey(value) {
        if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) return '';
            const pad = (n) => String(n).padStart(2, '0');
            return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
        }
        const raw = String(value || '').trim();
        if (!raw) return '';
        const matched = raw.match(/^\d{4}-\d{2}-\d{2}/);
        if (matched) return matched[0];
        const dt = __tmReminderToDateSafe(raw);
        if (Number.isNaN(dt.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    }

    function __tmParseReminderTime(value) {
        const raw = String(value || '').trim();
        const matched = raw.match(/^(\d{1,2}):(\d{2})/);
        if (!matched) return null;
        const hh = Number(matched[1]);
        const mm = Number(matched[2]);
        if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
        return {
            hh,
            mm,
            key: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
        };
    }

    function __tmReminderOccurrenceKey(dateKey, timeKey) {
        return `${String(dateKey || '').trim()} ${String(timeKey || '').trim()}`.trim();
    }

    function __tmNormalizeReminderRepeatMode(value) {
        const raw = String(value || '').trim();
        if (raw === __TM_REMINDER_REPEAT_MODE_FOLLOW_TASK || raw === 'follow' || raw === 'task') {
            return __TM_REMINDER_REPEAT_MODE_FOLLOW_TASK;
        }
        return 'manual';
    }

    function __tmNormalizeReminderTaskRepeatRule(value) {
        let raw = value;
        if (typeof raw === 'string') {
            const text = String(raw || '').trim();
            if (!text) return null;
            try { raw = JSON.parse(text); } catch (e) { return null; }
        }
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const typeRaw = String(raw.type || raw.repeatType || raw.interval || '').trim().toLowerCase();
        const type = (!typeRaw || typeRaw === 'none' || typeRaw === 'once')
            ? 'none'
            : (typeRaw === 'weekday' || typeRaw === 'weekdays' ? 'workday' : typeRaw);
        const enabled = raw.enabled === undefined ? (type !== 'none') : !!raw.enabled;
        return {
            enabled: enabled && type !== 'none',
            type,
            every: Math.max(1, Math.min(3650, parseInt(raw.every, 10) || 1)),
        };
    }

    function __tmGetReminderRepeatMode(reminder) {
        return __tmNormalizeReminderRepeatMode(
            reminder?.repeatMode || reminder?.mode || reminder?.repeat_mode || (reminder?.followTaskRepeat ? __TM_REMINDER_REPEAT_MODE_FOLLOW_TASK : '')
        );
    }

    function __tmHasReminderFollowTaskRepeat(reminder) {
        const rule = __tmNormalizeReminderTaskRepeatRule(reminder?.taskRepeatRule);
        return __tmGetReminderRepeatMode(reminder) === __TM_REMINDER_REPEAT_MODE_FOLLOW_TASK && !!rule?.enabled;
    }

    function __tmGetReminderFollowTaskAnchorKey(reminder) {
        const dueKey = __tmNormalizeReminderDateKey(reminder?.taskCompletionTime || '');
        if (dueKey) return dueKey;
        return __tmNormalizeReminderDateKey(reminder?.taskStartDate || '');
    }

    function __tmGetReminderCompletedSet(reminder) {
        const set = new Set();
        try {
            const arr = reminder?.completedOccurrences || reminder?.completed || reminder?.done || [];
            if (!Array.isArray(arr)) return set;
            arr.forEach((item) => {
                if (!item) return;
                if (typeof item === 'string') {
                    const key = item.trim();
                    if (key) set.add(key);
                    return;
                }
                const key = __tmReminderOccurrenceKey(item.date || item.dateKey || item.day, item.time || item.timeKey);
                if (key) set.add(key);
            });
        } catch (e) {}
        return set;
    }

    function __tmIsReminderOccurrenceCompleted(reminder, dateKey, timeKey) {
        const key = __tmReminderOccurrenceKey(dateKey, timeKey);
        if (!key) return false;
        return __tmGetReminderCompletedSet(reminder).has(key);
    }

    function __tmGetReminderEvery(reminder) {
        try {
            const raw = reminder?.every ?? reminder?.intervalEvery ?? reminder?.repeatEvery;
            const n = parseInt(raw, 10);
            if (!Number.isFinite(n) || n <= 0) return 1;
            return Math.min(3650, Math.max(1, n));
        } catch (e) {
            return 1;
        }
    }

    function __tmCollectReminderTimes(reminder) {
        const out = [];
        const seen = new Set();
        const pushTime = (value) => {
            const parsed = __tmParseReminderTime(value);
            if (!parsed || seen.has(parsed.key)) return;
            seen.add(parsed.key);
            out.push(parsed.key);
        };
        try {
            (Array.isArray(reminder?.times) ? reminder.times : []).forEach(pushTime);
        } catch (e) {}
        [
            reminder?.time,
            reminder?.timeKey,
            reminder?.reminderTime,
            reminder?.notifyTime,
            reminder?.at,
        ].forEach(pushTime);
        const dateTimeCandidates = [
            reminder?.dateTime,
            reminder?.datetime,
            reminder?.remindAt,
            reminder?.scheduledAt,
        ];
        dateTimeCandidates.forEach((value) => {
            const dt = __tmReminderToDateSafe(value);
            if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return;
            pushTime(`${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`);
        });
        out.sort();
        return out;
    }

    function __tmNormalizeReminderInterval(reminder) {
        const raw = String(
            reminder?.interval
            || reminder?.repeatType
            || reminder?.repeat_type
            || reminder?.type
            || reminder?.repeat
            || ''
        ).trim().toLowerCase();
        if (['once', 'daily', 'weekly', 'monthly', 'yearly'].includes(raw)) return raw;
        if (raw === 'day') return 'daily';
        if (raw === 'week') return 'weekly';
        if (raw === 'month') return 'monthly';
        if (raw === 'year') return 'yearly';
        return 'once';
    }

    function __tmNormalizeReminderRecord(reminder, taskId = '') {
        const raw = (reminder && typeof reminder === 'object' && !Array.isArray(reminder)) ? reminder : {};
        const times = __tmCollectReminderTimes(raw);
        const explicitEnabled = raw.enabled;
        const enabled = explicitEnabled === undefined
            ? !!(times.length
                || raw.time
                || raw.timeKey
                || raw.reminderTime
                || raw.date
                || raw.dateKey
                || raw.startDate
                || raw.startDateKey
                || raw.dateTime
                || raw.datetime
                || raw.remindAt)
            : !!explicitEnabled;
        return {
            ...raw,
            blockId: String(raw.blockId || taskId || '').trim(),
            enabled,
            interval: __tmNormalizeReminderInterval(raw),
            every: __tmGetReminderEvery(raw),
            times,
            startDate: __tmNormalizeReminderDateKey(
                raw.startDate
                || raw.startDateKey
                || raw.date
                || raw.dateKey
                || raw.day
                || ''
            ),
            endDate: __tmNormalizeReminderDateKey(raw.endDate || raw.until || raw.repeatUntil || ''),
            repeatMode: __tmGetReminderRepeatMode(raw),
            taskStartDate: __tmNormalizeReminderDateKey(raw.taskStartDate || ''),
            taskCompletionTime: __tmNormalizeReminderDateKey(raw.taskCompletionTime || ''),
            taskRepeatRule: raw.taskRepeatRule || raw.task_repeat_rule || null,
            taskRepeatState: raw.taskRepeatState || raw.task_repeat_state || null,
            completedOccurrences: Array.isArray(raw.completedOccurrences)
                ? raw.completedOccurrences
                : (Array.isArray(raw.completed) ? raw.completed : (Array.isArray(raw.done) ? raw.done : [])),
        };
    }

    function __tmGetReminderStartDateKey(reminder) {
        const v = __tmNormalizeReminderDateKey(reminder?.startDate || '');
        if (v) return v;
        return __tmNormalizeReminderDateKey(reminder?.createdAt || new Date());
    }

    function __tmGetNextReminderDateTime(reminder, fromDate) {
        if (!reminder?.enabled) return null;
        const times = Array.from(new Set((reminder.times || [])
            .map(__tmParseReminderTime)
            .filter(Boolean)
            .map((item) => item.key))).sort();
        if (!times.length) return null;
        const from = __tmReminderToDateSafe(fromDate || new Date());
        if (!(from instanceof Date) || Number.isNaN(from.getTime())) return null;

        const nowKey = __tmNormalizeReminderDateKey(from);
        const nowMinutes = from.getHours() * 60 + from.getMinutes();
        const startKey = __tmGetReminderStartDateKey(reminder);
        const interval = String(reminder?.interval || 'daily').trim() || 'daily';
        const every = interval === 'once' ? 1 : __tmGetReminderEvery(reminder);
        const endDate = reminder?.endDate ? __tmNormalizeReminderDateKey(reminder.endDate) : '';
        const isBeforeStartDate = (dateKey) => dateKey < startKey;
        const isBeyondEndDate = (dateKey) => !!endDate && dateKey > endDate;

        const pickOnDate = (dateKey, requireFutureTime) => {
            if (isBeforeStartDate(dateKey) || isBeyondEndDate(dateKey)) return null;
            const base = new Date(`${dateKey}T00:00:00`);
            if (Number.isNaN(base.getTime())) return null;
            for (const timeKey of times) {
                const parsed = __tmParseReminderTime(timeKey);
                if (!parsed) continue;
                if (__tmIsReminderOccurrenceCompleted(reminder, dateKey, parsed.key)) continue;
                const minutes = parsed.hh * 60 + parsed.mm;
                if (requireFutureTime && minutes < nowMinutes) continue;
                const dt = new Date(base);
                dt.setHours(parsed.hh, parsed.mm, 0, 0);
                return dt;
            }
            return null;
        };

        const pickEarliest = (dateKey) => {
            if (isBeforeStartDate(dateKey) || isBeyondEndDate(dateKey)) return null;
            return pickOnDate(dateKey, false);
        };

        if (__tmHasReminderFollowTaskRepeat(reminder)) {
            const followKey = __tmGetReminderFollowTaskAnchorKey(reminder);
            if (!followKey) return null;
            if (followKey < nowKey) return null;
            if (followKey === nowKey) return pickOnDate(followKey, true);
            return pickEarliest(followKey);
        }

        if (interval === 'once') {
            if (startKey < nowKey) return null;
            if (startKey === nowKey) return pickOnDate(startKey, true);
            return pickEarliest(startKey);
        }

        if (interval === 'daily') {
            const anchor = new Date(`${startKey}T00:00:00`);
            if (Number.isNaN(anchor.getTime())) return null;
            const fromDay = new Date(from);
            fromDay.setHours(0, 0, 0, 0);
            const dayMs = 86400000;
            let diffDays = Math.floor((fromDay.getTime() - anchor.getTime()) / dayMs);
            if (!Number.isFinite(diffDays)) diffDays = 0;
            if (diffDays < 0) diffDays = 0;
            let offset = diffDays % every;
            if (offset < 0) offset += every;
            let candidateDay = new Date(fromDay);
            if (offset !== 0) candidateDay.setDate(candidateDay.getDate() + (every - offset));
            if (candidateDay.getTime() < anchor.getTime()) candidateDay = new Date(anchor);
            for (let i = 0; i < 366; i += 1) {
                const candidateKey = __tmNormalizeReminderDateKey(candidateDay);
                if (isBeyondEndDate(candidateKey)) return null;
                if (candidateKey === nowKey) {
                    const at = pickOnDate(candidateKey, true);
                    if (at) return at;
                } else {
                    const at = pickEarliest(candidateKey);
                    if (at) return at;
                }
                candidateDay.setDate(candidateDay.getDate() + every);
            }
            return null;
        }

        if (interval === 'weekly') {
            const anchor = new Date(`${startKey}T00:00:00`);
            if (Number.isNaN(anchor.getTime())) return null;
            const targetDow = anchor.getDay();
            const fromDay = new Date(from);
            fromDay.setHours(0, 0, 0, 0);
            const dayMs = 86400000;
            const dowOffset = (targetDow - fromDay.getDay() + 7) % 7;
            let candidate = new Date(fromDay);
            candidate.setDate(candidate.getDate() + dowOffset);
            if (candidate.getTime() < anchor.getTime()) candidate = new Date(anchor);
            let diffWeeks = Math.floor((candidate.getTime() - anchor.getTime()) / (dayMs * 7));
            if (!Number.isFinite(diffWeeks)) diffWeeks = 0;
            if (diffWeeks < 0) diffWeeks = 0;
            let offsetWeeks = diffWeeks % every;
            if (offsetWeeks < 0) offsetWeeks += every;
            if (offsetWeeks !== 0) candidate.setDate(candidate.getDate() + (every - offsetWeeks) * 7);
            for (let i = 0; i < 104; i += 1) {
                const candidateKey = __tmNormalizeReminderDateKey(candidate);
                if (isBeyondEndDate(candidateKey)) return null;
                if (candidateKey === nowKey) {
                    const at = pickOnDate(candidateKey, true);
                    if (at) return at;
                } else {
                    const at = pickEarliest(candidateKey);
                    if (at) return at;
                }
                candidate.setDate(candidate.getDate() + every * 7);
            }
            return null;
        }

        if (interval === 'monthly') {
            const anchor = new Date(`${startKey}T00:00:00`);
            if (Number.isNaN(anchor.getTime())) return null;
            const targetDay = anchor.getDate();
            const anchorY = anchor.getFullYear();
            const anchorM = anchor.getMonth();
            const fromY = from.getFullYear();
            const fromM = from.getMonth();
            let monthsFromAnchor = (fromY - anchorY) * 12 + (fromM - anchorM);
            if (!Number.isFinite(monthsFromAnchor)) monthsFromAnchor = 0;
            if (monthsFromAnchor < 0) monthsFromAnchor = 0;
            const mod = monthsFromAnchor % every;
            if (mod !== 0) monthsFromAnchor += (every - mod);
            const buildCandidate = (monthOffset) => {
                const d = new Date(anchorY, anchorM + monthOffset, 1, 0, 0, 0, 0);
                const y = d.getFullYear();
                const m = d.getMonth();
                const lastDay = new Date(y, m + 1, 0).getDate();
                d.setDate(Math.min(targetDay, lastDay));
                return d;
            };
            let offset = monthsFromAnchor;
            for (let i = 0; i < 120; i += 1) {
                const candidate = buildCandidate(offset);
                const candidateKey = __tmNormalizeReminderDateKey(candidate);
                if (isBeyondEndDate(candidateKey)) return null;
                if (candidateKey < nowKey) {
                    offset += every;
                    continue;
                }
                if (candidateKey === nowKey) {
                    const at = pickOnDate(candidateKey, true);
                    if (at) return at;
                } else {
                    const at = pickEarliest(candidateKey);
                    if (at) return at;
                }
                offset += every;
            }
            return null;
        }

        if (interval === 'yearly') {
            const anchor = new Date(`${startKey}T00:00:00`);
            if (Number.isNaN(anchor.getTime())) return null;
            const targetMonth = anchor.getMonth();
            const targetDay = anchor.getDate();
            const anchorY = anchor.getFullYear();
            const fromY = from.getFullYear();
            let yearsFromAnchor = fromY - anchorY;
            if (!Number.isFinite(yearsFromAnchor)) yearsFromAnchor = 0;
            if (yearsFromAnchor < 0) yearsFromAnchor = 0;
            const mod = yearsFromAnchor % every;
            if (mod !== 0) yearsFromAnchor += (every - mod);
            const buildCandidate = (yearOffset) => {
                const y = anchorY + yearOffset;
                const lastDay = new Date(y, targetMonth + 1, 0).getDate();
                return new Date(y, targetMonth, Math.min(targetDay, lastDay), 0, 0, 0, 0);
            };
            let offset = yearsFromAnchor;
            for (let i = 0; i < 30; i += 1) {
                const candidate = buildCandidate(offset);
                const candidateKey = __tmNormalizeReminderDateKey(candidate);
                if (isBeyondEndDate(candidateKey)) return null;
                if (candidateKey < nowKey) {
                    offset += every;
                    continue;
                }
                if (candidateKey === nowKey) {
                    const at = pickOnDate(candidateKey, true);
                    if (at) return at;
                } else {
                    const at = pickEarliest(candidateKey);
                    if (at) return at;
                }
                offset += every;
            }
        }

        return null;
    }

    function __tmGetLastDueReminderDateTime(reminder, toDate) {
        try {
            if (!reminder?.enabled) return null;
            const times = Array.from(new Set((reminder.times || [])
                .map(__tmParseReminderTime)
                .filter(Boolean)
                .map((item) => item.key))).sort();
            if (!times.length) return null;
            const to = __tmReminderToDateSafe(toDate || new Date());
            if (!(to instanceof Date) || Number.isNaN(to.getTime())) return null;
            const nowKey = __tmNormalizeReminderDateKey(to);
            const nowMinutes = to.getHours() * 60 + to.getMinutes();
            const startKey = __tmGetReminderStartDateKey(reminder);
            const interval = String(reminder?.interval || 'daily').trim() || 'daily';
            const every = interval === 'once' ? 1 : __tmGetReminderEvery(reminder);

            const pickLatestOnDate = (dateKey, requirePastTime) => {
                const base = new Date(`${dateKey}T00:00:00`);
                if (Number.isNaN(base.getTime())) return null;
                for (let i = times.length - 1; i >= 0; i -= 1) {
                    const parsed = __tmParseReminderTime(times[i]);
                    if (!parsed) continue;
                    if (__tmIsReminderOccurrenceCompleted(reminder, dateKey, parsed.key)) continue;
                    const minutes = parsed.hh * 60 + parsed.mm;
                    if (requirePastTime && minutes > nowMinutes) continue;
                    const dt = new Date(base);
                    dt.setHours(parsed.hh, parsed.mm, 0, 0);
                    if (dt.getTime() > to.getTime()) continue;
                    return dt;
                }
                return null;
            };

            if (__tmHasReminderFollowTaskRepeat(reminder)) {
                const followKey = __tmGetReminderFollowTaskAnchorKey(reminder);
                if (!followKey || followKey > nowKey) return null;
                return pickLatestOnDate(followKey, followKey === nowKey);
            }

            if (interval === 'once') {
                if (startKey > nowKey) return null;
                return pickLatestOnDate(startKey, startKey === nowKey);
            }

            if (interval === 'daily') {
                const anchor = new Date(`${startKey}T00:00:00`);
                if (Number.isNaN(anchor.getTime())) return null;
                const today0 = new Date(to);
                today0.setHours(0, 0, 0, 0);
                const dayMs = 86400000;
                let diffDays = Math.floor((today0.getTime() - anchor.getTime()) / dayMs);
                if (!Number.isFinite(diffDays) || diffDays < 0) return null;
                diffDays -= diffDays % every;
                let candidate = new Date(anchor);
                candidate.setDate(candidate.getDate() + diffDays);
                for (let i = 0; i < 366; i += 1) {
                    const candidateKey = __tmNormalizeReminderDateKey(candidate);
                    if (candidateKey < startKey) return null;
                    const at = pickLatestOnDate(candidateKey, candidateKey === nowKey);
                    if (at) return at;
                    candidate.setDate(candidate.getDate() - every);
                }
                return null;
            }

            if (interval === 'weekly') {
                const anchor = new Date(`${startKey}T00:00:00`);
                if (Number.isNaN(anchor.getTime())) return null;
                const targetDow = anchor.getDay();
                const today0 = new Date(to);
                today0.setHours(0, 0, 0, 0);
                const back = (today0.getDay() - targetDow + 7) % 7;
                let candidate = new Date(today0);
                candidate.setDate(candidate.getDate() - back);
                if (candidate.getTime() < anchor.getTime()) return null;
                const dayMs = 86400000;
                let diffWeeks = Math.floor((candidate.getTime() - anchor.getTime()) / (dayMs * 7));
                if (!Number.isFinite(diffWeeks) || diffWeeks < 0) return null;
                diffWeeks -= diffWeeks % every;
                candidate = new Date(anchor);
                candidate.setDate(candidate.getDate() + diffWeeks * 7);
                for (let i = 0; i < 104; i += 1) {
                    const candidateKey = __tmNormalizeReminderDateKey(candidate);
                    const at = pickLatestOnDate(candidateKey, candidateKey === nowKey);
                    if (at) return at;
                    candidate.setDate(candidate.getDate() - every * 7);
                    if (candidate.getTime() < anchor.getTime()) break;
                }
                return null;
            }

            if (interval === 'monthly') {
                const anchor = new Date(`${startKey}T00:00:00`);
                if (Number.isNaN(anchor.getTime())) return null;
                const targetDay = anchor.getDate();
                const anchorY = anchor.getFullYear();
                const anchorM = anchor.getMonth();
                const toY = to.getFullYear();
                const toM = to.getMonth();
                let monthsFromAnchor = (toY - anchorY) * 12 + (toM - anchorM);
                if (!Number.isFinite(monthsFromAnchor) || monthsFromAnchor < 0) return null;
                monthsFromAnchor -= monthsFromAnchor % every;
                const buildCandidate = (monthOffset) => {
                    const d = new Date(anchorY, anchorM + monthOffset, 1, 0, 0, 0, 0);
                    const y = d.getFullYear();
                    const m = d.getMonth();
                    const lastDay = new Date(y, m + 1, 0).getDate();
                    d.setDate(Math.min(targetDay, lastDay));
                    return d;
                };
                let offset = monthsFromAnchor;
                for (let i = 0; i < 120; i += 1) {
                    const candidate = buildCandidate(offset);
                    if (candidate.getTime() > to.getTime()) {
                        offset -= every;
                        continue;
                    }
                    const candidateKey = __tmNormalizeReminderDateKey(candidate);
                    const at = pickLatestOnDate(candidateKey, candidateKey === nowKey);
                    if (at) return at;
                    offset -= every;
                    if (offset < 0) break;
                }
                return null;
            }

            if (interval === 'yearly') {
                const anchor = new Date(`${startKey}T00:00:00`);
                if (Number.isNaN(anchor.getTime())) return null;
                const targetMonth = anchor.getMonth();
                const targetDay = anchor.getDate();
                const anchorY = anchor.getFullYear();
                const toY = to.getFullYear();
                let yearsFromAnchor = toY - anchorY;
                if (!Number.isFinite(yearsFromAnchor) || yearsFromAnchor < 0) return null;
                yearsFromAnchor -= yearsFromAnchor % every;
                const buildCandidate = (yearOffset) => {
                    const y = anchorY + yearOffset;
                    const lastDay = new Date(y, targetMonth + 1, 0).getDate();
                    return new Date(y, targetMonth, Math.min(targetDay, lastDay), 0, 0, 0, 0);
                };
                let offset = yearsFromAnchor;
                for (let i = 0; i < 30; i += 1) {
                    const candidate = buildCandidate(offset);
                    if (candidate.getTime() > to.getTime()) {
                        offset -= every;
                        continue;
                    }
                    const candidateKey = __tmNormalizeReminderDateKey(candidate);
                    const at = pickLatestOnDate(candidateKey, candidateKey === nowKey);
                    if (at) return at;
                    offset -= every;
                    if (offset < 0) break;
                }
            }
        } catch (e) {}
        return null;
    }

    function __tmFormatReminderDateTimeCompact(value) {
        const dt = value instanceof Date ? new Date(value.getTime()) : __tmReminderToDateSafe(value);
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        const now = new Date();
        const datePart = dt.getFullYear() === now.getFullYear()
            ? `${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
            : `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        return `${datePart} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    }

    function __tmBuildReminderSnapshot(taskId, reminder) {
        const tid = String(taskId || '').trim();
        const normalizedReminder = (reminder && typeof reminder === 'object' && !Array.isArray(reminder))
            ? __tmNormalizeReminderRecord(reminder, tid)
            : null;
        const hasReminder = !!normalizedReminder;
        const nextAt = hasReminder ? __tmGetNextReminderDateTime(normalizedReminder, new Date()) : null;
        const lastAt = hasReminder && !nextAt ? __tmGetLastDueReminderDateTime(normalizedReminder, new Date()) : null;
        const displayAt = nextAt || lastAt || null;
        const displayText = displayAt ? __tmFormatReminderDateTimeCompact(displayAt) : '';
        const isOverdue = !nextAt && !!lastAt;
        return {
            taskId: tid,
            hasReminder,
            displayAt: displayAt instanceof Date && !Number.isNaN(displayAt.getTime()) ? new Date(displayAt.getTime()) : null,
            displayMs: displayAt instanceof Date && !Number.isNaN(displayAt.getTime()) ? displayAt.getTime() : 0,
            displayText,
            isOverdue,
            kind: nextAt ? 'next' : (lastAt ? 'last' : (hasReminder ? 'set' : 'none')),
            tooltip: hasReminder
                ? (displayText ? `${isOverdue ? '最近一次提醒' : '提醒'}：${displayText}` : '已添加提醒')
                : '提醒',
            reminder: hasReminder ? normalizedReminder : null,
        };
    }

    function __tmBuildReminderLookupIds(taskOrId) {
        const ids = [];
        const pushId = (value) => {
            const id = String(value || '').trim();
            if (!id || ids.includes(id)) return;
            ids.push(id);
        };
        if (taskOrId && typeof taskOrId === 'object') {
            pushId(taskOrId.id);
            pushId(taskOrId.attrHostId);
            pushId(taskOrId.attr_host_id);
            pushId(taskOrId.taskId);
            pushId(taskOrId.task_id);
            return ids;
        }
        pushId(taskOrId);
        return ids;
    }

    async function __tmFetchReminderRecordByBlockId(blockId) {
        const id = String(blockId || '').trim();
        if (!id) return null;
        try {
            const res = await API.call('/api/attr/getBlockAttrs', { id });
            const attrs = (res && res.code === 0 && res.data && typeof res.data === 'object') ? res.data : null;
            const raw = String(attrs?.['custom-tomato-reminder'] || '').trim();
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return __tmNormalizeReminderRecord(parsed, id);
        } catch (e) {
            return null;
        }
    }

    async function __tmLoadReminderListMap(force = false) {
        const getter = globalThis.__tomatoReminder?.getBlocks;
        if (typeof getter !== 'function') return new Map();
        const now = Date.now();
        if (!force && (__tmReminderListCache.map instanceof Map) && (now - Number(__tmReminderListCache.fetchedAt || 0) < __TM_REMINDER_SNAPSHOT_TTL_MS)) {
            return __tmReminderListCache.map;
        }
        if (!force && __tmReminderListCache.inflight) {
            try { return await __tmReminderListCache.inflight; } catch (e) { return __tmReminderListCache.map instanceof Map ? __tmReminderListCache.map : new Map(); }
        }
        const task = Promise.resolve().then(async () => {
            let list = [];
            try {
                list = await getter(false);
            } catch (e) {
                list = [];
            }
            const map = new Map();
            (Array.isArray(list) ? list : []).forEach((item) => {
                const id = String(item?.blockId || '').trim();
                if (!id) return;
                map.set(id, item);
            });
            __tmReminderListCache.fetchedAt = Date.now();
            __tmReminderListCache.map = map;
            return map;
        }).finally(() => {
            if (__tmReminderListCache.inflight === task) __tmReminderListCache.inflight = null;
        });
        __tmReminderListCache.inflight = task;
        return await task;
    }

    function __tmPeekTaskReminderSnapshotByAnyId(taskOrId) {
        const ids = __tmBuildReminderLookupIds(taskOrId);
        for (const id of ids) {
            const cached = __tmReminderSnapshotCache.get(id);
            if (!cached || typeof cached !== 'object') continue;
            return cached.snapshot || null;
        }
        return null;
    }

    function __tmClearReminderSnapshotCache(taskId = '') {
        const tid = String(taskId || '').trim();
        if (tid) {
            try {
                Array.from(__tmReminderSnapshotCache.entries()).forEach(([key, entry]) => {
                    const cachedTaskId = String(entry?.snapshot?.taskId || '').trim();
                    if (String(key || '').trim() === tid || cachedTaskId === tid) {
                        __tmReminderSnapshotCache.delete(key);
                    }
                });
            } catch (e) {
                __tmReminderSnapshotCache.delete(tid);
            }
            __tmReminderListCache.fetchedAt = 0;
            return;
        }
        try { __tmReminderSnapshotCache.clear(); } catch (e) {}
        __tmReminderListCache.fetchedAt = 0;
        try { __tmReminderListCache.map = new Map(); } catch (e) {}
    }

    async function __tmGetTaskReminderSnapshotByAnyId(taskIdOrBlockId, options = {}) {
        const candidateIds = __tmBuildReminderLookupIds(taskIdOrBlockId);
        const rawId = String(candidateIds[0] || '').trim();
        if (!rawId) return __tmBuildReminderSnapshot('', null);
        let primaryTaskId = (taskIdOrBlockId && typeof taskIdOrBlockId === 'object')
            ? String(taskIdOrBlockId?.id || '').trim()
            : '';
        try {
            const binding = await __tmResolveTaskBindingFromAnyBlockId(rawId);
            if (binding && typeof binding === 'object') {
                const taskId = String(binding.taskId || '').trim();
                const attrHostId = String(binding.attrHostId || '').trim();
                if (taskId) primaryTaskId = taskId;
                if (attrHostId && !candidateIds.includes(attrHostId)) candidateIds.push(attrHostId);
                if (taskId && !candidateIds.includes(taskId)) candidateIds.push(taskId);
            }
        } catch (e) {}
        if (!primaryTaskId) {
            try {
                const nextId = await __tmResolveTaskIdFromAnyBlockId(rawId);
                if (nextId) primaryTaskId = String(nextId || '').trim() || rawId;
            } catch (e) {}
        }
        if (!primaryTaskId) primaryTaskId = rawId;
        const now = Date.now();
        if (!options?.force) {
            for (const id of candidateIds) {
                const cached = __tmReminderSnapshotCache.get(id);
                if (cached && (now - Number(cached.fetchedAt || 0) < __TM_REMINDER_SNAPSHOT_TTL_MS)) {
                    return cached.snapshot || __tmBuildReminderSnapshot(primaryTaskId, null);
                }
            }
        }
        const map = await __tmLoadReminderListMap(!!options?.force);
        let reminder = null;
        for (const id of candidateIds) {
            reminder = map.get(id) || null;
            if (reminder) break;
        }
        if (!reminder) {
            for (const id of candidateIds) {
                reminder = await __tmFetchReminderRecordByBlockId(id);
                if (reminder) break;
            }
        }
        const snapshot = __tmBuildReminderSnapshot(primaryTaskId, reminder);
        const entry = { fetchedAt: Date.now(), snapshot };
        candidateIds.forEach((id) => {
            try { __tmReminderSnapshotCache.set(id, entry); } catch (e) {}
        });
        try { __tmReminderSnapshotCache.set(primaryTaskId, entry); } catch (e) {}
        return snapshot;
    }

    function __tmHasReminderMark(task) {
        const tid = String(task?.id || '').trim();
        if (!tid) return false;
        if (String(task?.bookmark || '').includes('⏰')) return true;
        return __tmReminderMarkCache.get(tid) === true;
    }

    function __tmSetTaskReminderMark(taskId, hasReminder) {
        const tid = String(taskId || '').trim();
        if (!tid) return;
        const mark = hasReminder ? '⏰' : '';
        __tmReminderMarkCache.set(tid, !!hasReminder);
        if (!hasReminder) __tmClearReminderSnapshotCache(tid);
        try {
            const t = state.flatTasks?.[tid];
            if (t && typeof t === 'object') t.bookmark = mark;
        } catch (e) {}
        try {
            (Array.isArray(state.filteredTasks) ? state.filteredTasks : []).forEach((t) => {
                if (String(t?.id || '').trim() === tid) t.bookmark = mark;
            });
        } catch (e) {}
    }

    function __tmInvalidateTaskReminderMark(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return;
        __tmReminderMarkCache.delete(tid);
        __tmReminderMarkLoading.delete(tid);
        __tmClearReminderSnapshotCache(tid);
        try {
            const t = state.flatTasks?.[tid];
            if (t && typeof t === 'object') delete t.bookmark;
        } catch (e) {}
        try {
            (Array.isArray(state.filteredTasks) ? state.filteredTasks : []).forEach((t) => {
                if (String(t?.id || '').trim() === tid) delete t.bookmark;
            });
        } catch (e) {}
    }

    function __tmRefreshReminderMarkForTask(taskId, delayMs = 0) {
        const tid = String(taskId || '').trim();
        if (!tid) return;
        const run = () => {
            try { __tmInvalidateTaskReminderMark(tid); } catch (e) {}
            try { __tmClearReminderSnapshotCache(tid); } catch (e) {}
            try {
                if (state.modal && document.body.contains(state.modal)) {
                    __tmScheduleReminderTaskNameMarksRefresh(state.modal, true);
                }
            } catch (e) {}
        };
        if (delayMs > 0) {
            try { setTimeout(run, delayMs); } catch (e) {}
        } else {
            run();
        }
    }

    function __tmScheduleReminderMarkRefreshBurst(taskId, delays) {
        const tid = String(taskId || '').trim();
        if (!tid) return;
        const plan = Array.isArray(delays) ? delays : [0, 600, 1600, 3200, 5200, 8000];
        plan.forEach((ms) => {
            try { __tmRefreshReminderMarkForTask(tid, Math.max(0, Number(ms) || 0)); } catch (e) {}
        });
    }

    function __tmApplyReminderTaskNameMarks(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        const rows = modal.querySelectorAll('#tmTaskTable tbody tr[data-id], #tmTimelineLeftTable tbody tr[data-id], .tm-checklist-item[data-id]');
        rows.forEach((row) => {
            if (!(row instanceof HTMLElement)) return;
            const tid = String(row.getAttribute('data-id') || '').trim();
            if (!tid) return;
            const contentEl = row.querySelector('.tm-task-content-clickable, .tm-checklist-title');
            if (!(contentEl instanceof HTMLElement)) return;
            const hasReminder = __tmReminderMarkCache.get(tid) === true;
            let badge = contentEl.querySelector('.tm-task-reminder-emoji');
            if (hasReminder) {
                if (!(badge instanceof HTMLElement)) {
                    badge = document.createElement('span');
                    badge.className = 'tm-task-reminder-emoji';
                    badge.title = '已添加提醒';
                    badge.textContent = '⏰';
                    contentEl.appendChild(badge);
                }
            } else if (badge instanceof HTMLElement) {
                badge.remove();
            }
        });
    }

    async function __tmFetchReminderMarksByTaskIds(taskIds) {
        const ids = Array.from(new Set((Array.isArray(taskIds) ? taskIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => /^[0-9]+-[a-zA-Z0-9]+$/.test(id))));
        const out = new Map();
        ids.forEach((id) => out.set(id, false));
        if (!ids.length) return out;
        const chunkSize = 180;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            if (!chunk.length) continue;
            const idSql = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
            const sql = `
                SELECT block_id, value
                FROM attributes
                WHERE name = 'bookmark'
                    AND block_id IN (${idSql})
            `;
            let rows = [];
            try {
                const res = await API.call('/api/query/sql', { stmt: sql });
                rows = (res && res.code === 0 && Array.isArray(res.data)) ? res.data : [];
            } catch (e) {
                rows = [];
            }
            rows.forEach((row) => {
                const taskId = String(row?.block_id || '').trim();
                if (!taskId || !out.has(taskId)) return;
                const val = String(row?.value || '').trim();
                out.set(taskId, val.includes('⏰'));
            });
        }
        return out;
    }

    function __tmScheduleReminderTaskNameMarksRefresh(modalEl, force = false) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        __tmApplyReminderTaskNameMarks(modal);
        Promise.resolve().then(async () => {
            const rows = Array.from(modal.querySelectorAll('#tmTaskTable tbody tr[data-id], #tmTimelineLeftTable tbody tr[data-id], .tm-checklist-item[data-id]'));
            const ids = Array.from(new Set(rows
                .map((row) => String(row?.getAttribute?.('data-id') || '').trim())
                .filter(Boolean)));
            const pendingIds = ids.filter((tid) => force || !__tmReminderMarkCache.has(tid));
            if (!pendingIds.length) return;
            const queryIds = [];
            pendingIds.forEach((tid) => {
                if (__tmReminderMarkLoading.has(tid)) return;
                __tmReminderMarkLoading.add(tid);
                queryIds.push(tid);
            });
            if (!queryIds.length) return;
            try {
                const markMap = await __tmFetchReminderMarksByTaskIds(queryIds);
                queryIds.forEach((tid) => {
                    __tmSetTaskReminderMark(tid, markMap.get(tid) === true);
                });
            } catch (e) {
                queryIds.forEach((tid) => {
                    if (!__tmReminderMarkCache.has(tid)) __tmReminderMarkCache.set(tid, false);
                });
            } finally {
                queryIds.forEach((tid) => __tmReminderMarkLoading.delete(tid));
            }
            if (!modal.isConnected) return;
            __tmApplyReminderTaskNameMarks(modal);
        }).catch(() => null);
    }

    function __tmScheduleTodayScheduledTaskNameMarksRefresh(modalEl, force = false) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        Promise.resolve().then(async () => {
            try {
                await __tmLoadTodayScheduledTaskIds(force);
            } catch (e) {}
            if (!modal.isConnected) return;
            __tmApplyTodayScheduledTaskNameMarks(modal);
        }).catch(() => null);
    }

    function __tmBindCalendarScheduleUpdated() {
        if (__tmCalendarScheduleUpdatedHandler) return;
        __tmCalendarScheduleUpdatedHandler = () => {
            try {
                if (__tmTodayScheduleRefreshTimer) {
                    clearTimeout(__tmTodayScheduleRefreshTimer);
                    __tmTodayScheduleRefreshTimer = null;
                }
            } catch (e) {}
            __tmTodayScheduleRefreshTimer = setTimeout(() => {
                __tmTodayScheduleRefreshTimer = null;
                const modal = state.modal;
                if (modal && modal.isConnected) {
                    __tmScheduleTodayScheduledTaskNameMarksRefresh(modal, true);
                } else {
                    Promise.resolve().then(() => __tmLoadTodayScheduledTaskIds(true)).catch(() => null);
                }
            }, 60);
        };
        try { globalThis.__tmRuntimeEvents?.on?.(window, 'tm:calendar-schedule-updated', __tmCalendarScheduleUpdatedHandler); } catch (e) {}
    }

    function __tmBootstrapCalendarBackgroundRefresh(tryCount = 0) {
        try {
            if (__tmCalendarBootstrapRetryTimer) {
                clearTimeout(__tmCalendarBootstrapRetryTimer);
                __tmCalendarBootstrapRetryTimer = null;
            }
        } catch (e) {}
        Promise.resolve().then(async () => {
            try { await SettingsStore.load(); } catch (e) {}
            try {
                if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.setSettingsStore === 'function') {
                    globalThis.__tmCalendar.setSettingsStore(SettingsStore);
                    return;
                }
            } catch (e) {}
            if (tryCount >= 20) return;
            __tmCalendarBootstrapRetryTimer = setTimeout(() => {
                __tmCalendarBootstrapRetryTimer = null;
                __tmBootstrapCalendarBackgroundRefresh(tryCount + 1);
            }, 1000);
        }).catch(() => null);
    }

    let __tmMountEl = null;
    let __tmWakeReloadBound = false;
    let __tmWasHiddenAt = 0;
    let __tmWakeReloadTimer = null;
    let __tmWakeReloadInFlight = false;
    let __tmVisibilityHandler = null;
    let __tmFocusHandler = null;
    let __tmWhiteboardViewSaveTimer = null;
    let __tmTimelineTodayIndicatorTimer = null;
    // 存储被悬浮条修改过的任务 ID
    let __tmModifiedTaskIds = new Set();
    // 追踪最小化前插件页面是否正在显示（用于控制是否在恢复后刷新）
    let __tmWasPluginVisibleBeforeHide = false;

    function __tmSetMount(el) {
        const prevMount = __tmMountEl;
        const prevHostKey = __tmGetHostSessionKeyByEl(prevMount);
        const nextHostKey = __tmGetHostSessionKeyByEl(el);
        if (prevHostKey) {
            try { __tmCaptureHostSessionState(prevHostKey); } catch (e) {}
        }
        if (el && !document.body.contains(el)) {
            // if element not attached yet, still allow mount
        }
        __tmMountEl = el || null;
        if (nextHostKey && nextHostKey !== prevHostKey) {
            try { __tmRestoreHostSessionState(nextHostKey); } catch (e) {}
        }
    }

    function __tmReadHostMeta(name) {
        const key = String(name || '').trim();
        if (!key) return '';
        try {
            const fromMount = String(__tmMountEl?.dataset?.[key] || '').trim();
            if (fromMount) return fromMount;
        } catch (e) {}
        try {
            const fromBody = String(document.body?.dataset?.[key] || '').trim();
            if (fromBody) return fromBody;
        } catch (e) {}
        return '';
    }

    function __tmGetMountHostMode() {
        return __tmReadHostMeta('tmHostMode');
    }

    function __tmHostUsesMobileUI() {
        return __tmReadHostMeta('tmUiMode') === 'mobile';
    }

    function __tmIsDockHost() {
        return __tmGetMountHostMode() === 'dock';
    }

    function __tmIsTabHost() {
        return __tmGetMountHostMode() === 'tab';
    }

    function __tmUsesEmbeddedHostScrollIsolation() {
        return __tmIsDockHost() || __tmIsTabHost();
    }

    function __tmFindBestTabRoot() {
        try {
            const all = Array.from(document.querySelectorAll('.tm-tab-root')).filter(el => !!el && document.body.contains(el));
            if (all.length === 0) return null;
            const isVisible = (el) => {
                try {
                    if (!el) return false;
                    const rect = el.getBoundingClientRect?.();
                    if (!rect) return false;
                    return rect.width > 0 && rect.height > 0;
                } catch (e) {
                    return false;
                }
            };
            const visible = all.filter(isVisible);
            return visible[visible.length - 1] || all[all.length - 1] || null;
        } catch (e) {
            return null;
        }
    }

    function __tmEnsureMount() {
        if (__tmMountEl && !document.body.contains(__tmMountEl)) {
            __tmMountEl = null;
        }
        try {
            if (globalThis.__taskHorizonTabElement && !document.body.contains(globalThis.__taskHorizonTabElement)) {
                globalThis.__taskHorizonTabElement = null;
            }
        } catch (e) {}
        try {
            const best = __tmFindBestTabRoot();
            if (best && __tmIsTaskHorizonTabActiveNow()) {
                try { globalThis.__taskHorizonTabElement = best; } catch (e) {}
                if (__tmMountEl !== best) {
                    __tmSetMount(best);
                }
                try { __tmTryReattachExistingModalToMount(best); } catch (e) {}
                return;
            }
        } catch (e) {}
        if (!__tmMountEl && globalThis.__taskHorizonTabElement && document.body.contains(globalThis.__taskHorizonTabElement)) {
            __tmSetMount(globalThis.__taskHorizonTabElement);
        }
        if (!__tmMountEl) {
            const best = __tmFindBestTabRoot();
            if (best) {
                try { globalThis.__taskHorizonTabElement = best; } catch (e) {}
                __tmSetMount(best);
            }
        }
    }

    function __tmGetMountRoot() {
        __tmEnsureMount();
        return __tmMountEl || document.body;
    }

    function __tmCanReattachExistingModalToMount(targetEl = null) {
        const modal = state?.modal;
        if (!(modal instanceof HTMLElement)) return false;
        const mountRoot = targetEl instanceof HTMLElement ? targetEl : __tmGetMountRoot();
        if (!(mountRoot instanceof HTMLElement)) return false;
        const prevMountRoot = modal.parentElement instanceof HTMLElement ? modal.parentElement : null;
        if (!(prevMountRoot instanceof HTMLElement)) return false;
        if (prevMountRoot === mountRoot) return true;
        const prevHostKey = __tmGetHostSessionKeyByEl(prevMountRoot);
        const nextHostKey = __tmGetHostSessionKeyByEl(mountRoot);
        if (!prevHostKey || !nextHostKey) return false;
        return prevHostKey === nextHostKey;
    }

    function __tmTryReattachExistingModalToMount(targetEl = null) {
        const modal = state?.modal;
        if (!(modal instanceof HTMLElement)) return false;
        const mountRoot = targetEl instanceof HTMLElement ? targetEl : __tmGetMountRoot();
        if (!(mountRoot instanceof HTMLElement)) return false;
        if (!__tmCanReattachExistingModalToMount(mountRoot)) return false;
        if (modal.parentElement === mountRoot && document.body.contains(modal)) return true;
        try {
            mountRoot.appendChild(modal);
        } catch (e) {
            return false;
        }
        try { __tmSyncInlineLoadingOverlay(modal); } catch (e) {}
        return modal.parentElement === mountRoot;
    }

    function __tmIsPrimaryManagerModal(el) {
        if (!(el instanceof HTMLElement)) return false;
        if (String(el.getAttribute('data-task-horizon-shell') || '').trim() === '1') return true;
        if (!el.classList.contains('tm-modal')) return false;
        if (String(el.getAttribute('data-task-horizon-dock-snapshot') || '').trim() === '1') return true;
        if (el.classList.contains('tm-view-profile-config-modal')) return false;
        try {
            return !!el.querySelector?.('.tm-main-stage');
        } catch (e) {
            return false;
        }
    }

    function __tmPruneMountedManagerShells(root, keepEl = null) {
        if (!(root instanceof HTMLElement)) return 0;
        const keep = keepEl instanceof HTMLElement ? keepEl : null;
        let removed = 0;
        try { __tmClearKeepaliveSnapshots(root); } catch (e) {}
        try {
            Array.from(root.children || []).forEach((child) => {
                if (!(child instanceof HTMLElement)) return;
                if (keep && child === keep) return;
                if (!__tmIsPrimaryManagerModal(child)) return;
                try {
                    if (child.querySelector?.('#tmCalendarRoot')) {
                        globalThis.__tmCalendar?.unmount?.();
                    }
                } catch (e) {}
                try {
                    child.remove();
                    removed += 1;
                } catch (e) {}
            });
        } catch (e) {}
        return removed;
    }

    function __tmIsDockRootElement(el) {
        try {
            return !!(el instanceof HTMLElement && String(el.getAttribute('data-task-horizon-dock-root') || '').trim() === '1');
        } catch (e) {
            return false;
        }
    }

    function __tmIsTabRootElement(el) {
        try {
            return !!(el instanceof HTMLElement && el.classList.contains('tm-tab-root'));
        } catch (e) {
            return false;
        }
    }

    function __tmGetHostSessionKeyByEl(el) {
        if (__tmIsDockRootElement(el)) return 'dock';
        if (__tmIsTabRootElement(el)) return 'tab';
        return '';
    }

    const __tmHostUiState = {
        tab: null,
        dock: null,
    };

    function __tmCloneHostSessionValue(value) {
        if (value instanceof Set) return new Set(Array.from(value));
        if (Array.isArray(value)) return value.map((item) => __tmCloneHostSessionValue(item));
        if (value && typeof value === 'object') {
            const out = {};
            Object.keys(value).forEach((key) => {
                out[key] = __tmCloneHostSessionValue(value[key]);
            });
            return out;
        }
        return value;
    }

    function __tmCaptureHostSessionState(hostKey) {
        const key = String(hostKey || '').trim();
        if (!key) return;
        __tmHostUiState[key] = {
            viewMode: String(state.viewMode || 'list').trim() || 'list',
            viewModeInitialized: state.viewModeInitialized === true,
            currentRule: state.currentRule == null ? null : String(state.currentRule || ''),
            searchKeyword: String(state.searchKeyword || ''),
            activeDocId: String(state.activeDocId || 'all').trim() || 'all',
            detailTaskId: String(state.detailTaskId || ''),
            checklistDetailSheetOpen: !!state.checklistDetailSheetOpen,
            checklistDetailDismissed: !!state.checklistDetailDismissed,
            kanbanDetailTaskId: String(state.kanbanDetailTaskId || ''),
            kanbanDetailAnchorTaskId: String(state.kanbanDetailAnchorTaskId || ''),
            multiSelectModeEnabled: !!state.multiSelectModeEnabled,
            multiSelectedTaskIds: Array.isArray(state.multiSelectedTaskIds) ? state.multiSelectedTaskIds.slice() : [],
            multiBulkEditFieldKey: String(state.multiBulkEditFieldKey || ''),
            docTabsHidden: !!state.docTabsHidden,
            homepageOpen: !!state.homepageOpen,
            aiSidebarOpen: !!state.aiSidebarOpen,
            aiMobilePanelOpen: !!state.aiMobilePanelOpen,
            calendarDockDate: String(state.calendarDockDate || ''),
            listRenderLimit: Number(state.listRenderLimit) || 100,
            listRenderStep: Number(state.listRenderStep) || 100,
            viewScroll: __tmCloneHostSessionValue(state.viewScroll || {}),
        };
    }

    function __tmRestoreHostSessionState(hostKey) {
        const key = String(hostKey || '').trim();
        if (!key) return;
        const snap = __tmHostUiState[key];
        if (!snap || typeof snap !== 'object') return;
        state.viewMode = String(snap.viewMode || state.viewMode || 'list').trim() || 'list';
        state.viewModeInitialized = snap.viewModeInitialized === true;
        state.currentRule = snap.currentRule == null ? null : String(snap.currentRule || '');
        state.searchKeyword = String(snap.searchKeyword || '');
        state.activeDocId = String(snap.activeDocId || 'all').trim() || 'all';
        state.detailTaskId = String(snap.detailTaskId || '');
        state.checklistDetailSheetOpen = !!snap.checklistDetailSheetOpen;
        state.checklistDetailDismissed = !!snap.checklistDetailDismissed;
        state.kanbanDetailTaskId = String(snap.kanbanDetailTaskId || '');
        state.kanbanDetailAnchorTaskId = String(snap.kanbanDetailAnchorTaskId || '');
        state.multiSelectModeEnabled = !!snap.multiSelectModeEnabled;
        state.multiSelectedTaskIds = Array.isArray(snap.multiSelectedTaskIds)
            ? snap.multiSelectedTaskIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [];
        state.multiBulkEditFieldKey = String(snap.multiBulkEditFieldKey || '').trim();
        state.docTabsHidden = !!snap.docTabsHidden;
        state.homepageOpen = !!snap.homepageOpen;
        state.aiSidebarOpen = !!snap.aiSidebarOpen;
        state.aiMobilePanelOpen = !!snap.aiMobilePanelOpen;
        state.calendarDockDate = String(snap.calendarDockDate || '');
        state.listRenderLimit = Number(snap.listRenderLimit) || 100;
        state.listRenderStep = Number(snap.listRenderStep) || 100;
        state.viewScroll = __tmCloneHostSessionValue(snap.viewScroll || {});
    }

    function __tmIsMultiSelectSupportedView(mode) {
        const viewMode = String(mode || (state.homepageOpen ? 'home' : state.viewMode) || '').trim();
        if (viewMode === 'whiteboard') return __tmIsWhiteboardAllTabsStreamMode();
        return viewMode === 'list' || viewMode === 'checklist' || viewMode === 'timeline' || viewMode === 'kanban';
    }

    function __tmNormalizeMultiSelectedTaskIds(ids) {
        const out = [];
        const seen = new Set();
        (Array.isArray(ids) ? ids : []).forEach((rawId) => {
            const id = String(rawId || '').trim();
            if (!id || seen.has(id)) return;
            if (state.flatTasks && Object.keys(state.flatTasks).length > 0 && !state.flatTasks[id]) return;
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    function __tmGetMultiSelectedTaskIds() {
        return __tmNormalizeMultiSelectedTaskIds(state.multiSelectedTaskIds);
    }

    function __tmGetMultiSelectedTaskIdSet() {
        return new Set(__tmGetMultiSelectedTaskIds());
    }

    function __tmIsMultiSelectActive(mode) {
        return !!state.multiSelectModeEnabled && __tmIsMultiSelectSupportedView(mode);
    }

    function __tmIsTaskMultiSelected(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return false;
        return __tmGetMultiSelectedTaskIdSet().has(id);
    }

    function __tmRefreshMultiSelectBarInPlace(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        const bar = modal.querySelector('.tm-multi-bulkbar');
        if (!(bar instanceof HTMLElement)) return false;
        const count = __tmGetMultiSelectedTaskIds().length;
        const countEl = bar.querySelector('[data-tm-multi-count]');
        if (countEl instanceof HTMLElement) countEl.textContent = String(count);
        bar.querySelectorAll('[data-tm-multi-action]').forEach((btn) => {
            try { btn.toggleAttribute('disabled', count <= 0); } catch (e) {
                try { btn.disabled = count <= 0; } catch (e2) {}
            }
        });
        if (count <= 0) {
            try { __tmCloseMultiSelectMoreMenu(); } catch (e) {}
        }
        try { bar.setAttribute('data-tm-multi-has-selection', count > 0 ? 'true' : 'false'); } catch (e) {}
        return true;
    }

    function __tmRefreshMultiSelectUiInPlace(modalEl, options = {}) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        const refreshed = __tmRefreshMultiSelectedRowsInPlace(modal);
        try { __tmRefreshMultiSelectBarInPlace(modal); } catch (e) {}
        if (String(state.viewMode || '').trim() === 'checklist') {
            try { __tmRefreshChecklistSelectionInPlace(modal, 'multi-select-ui'); } catch (e) {}
        } else if (!refreshed && options.renderFallback !== false) {
            try { __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'multi-select-ui-fallback' }); } catch (e) {}
        }
        return refreshed;
    }

    function __tmAddTaskIdsToMultiSelection(ids, options = {}) {
        if (!__tmIsMultiSelectActive()) return false;
        const nextSet = __tmGetMultiSelectedTaskIdSet();
        let changed = false;
        (Array.isArray(ids) ? ids : [ids]).forEach((rawId) => {
            const id = String(rawId || '').trim();
            if (!id || nextSet.has(id)) return;
            nextSet.add(id);
            changed = true;
        });
        if (!changed && options.forceRefresh !== true) return false;
        __tmSetMultiSelectedTaskIds(Array.from(nextSet), { render: false });
        if (options.render !== false && state.modal && document.body.contains(state.modal)) {
            __tmRefreshMultiSelectUiInPlace(state.modal, { renderFallback: options.renderFallback });
        }
        return changed;
    }

    function __tmSetTaskMultiSelection(taskId, selected, options = {}) {
        const id = String(taskId || '').trim();
        if (!id || !__tmIsMultiSelectActive()) return false;
        const nextSet = __tmGetMultiSelectedTaskIdSet();
        const shouldSelect = !!selected;
        const hasSelection = nextSet.has(id);
        if (shouldSelect === hasSelection && options.forceRefresh !== true) return false;
        if (shouldSelect) nextSet.add(id);
        else nextSet.delete(id);
        __tmSetMultiSelectedTaskIds(Array.from(nextSet), { render: false });
        if (options.render !== false && state.modal && document.body.contains(state.modal)) {
            __tmRefreshMultiSelectUiInPlace(state.modal, { renderFallback: options.renderFallback });
        }
        return shouldSelect !== hasSelection;
    }

    function __tmSetMultiSelectedTaskIds(ids, options = {}) {
        state.multiSelectedTaskIds = __tmNormalizeMultiSelectedTaskIds(ids);
        if (state.multiSelectedTaskIds.length === 0) {
            state.multiBulkEditFieldKey = '';
        }
        if (state.modal && document.body.contains(state.modal)) {
            try { __tmRefreshMultiSelectBarInPlace(state.modal); } catch (e) {}
        }
        if (options.render !== false && state.modal && document.body.contains(state.modal)) {
            try {
                if (!__tmRefreshMultiSelectUiInPlace(state.modal, { renderFallback: false })) {
                    __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'set-multi-selected-task-ids' });
                }
            } catch (e) {}
        }
    }

    function __tmClearMultiTaskSelection(options = {}) {
        __tmSetMultiSelectedTaskIds([], { render: false });
        state.multiBulkEditFieldKey = '';
        if (options.keepMode !== true) state.multiSelectModeEnabled = false;
        if (options.render !== false && state.modal && document.body.contains(state.modal)) {
            try {
                if (!__tmRefreshMultiSelectUiInPlace(state.modal, { renderFallback: false })) {
                    __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'clear-multi-task-selection' });
                }
            } catch (e) {}
        }
    }

    window.tmToggleMultiSelectMode = function(enabled, options = {}) {
        const next = typeof enabled === 'boolean' ? enabled : !state.multiSelectModeEnabled;
        state.multiSelectModeEnabled = !!next;
        if (!state.multiSelectModeEnabled) {
            __tmClearMultiTaskSelection({ keepMode: true, render: false });
            state.multiBulkEditFieldKey = '';
        } else if (String(state.viewMode || '').trim() === 'checklist') {
            state.detailTaskId = '';
            state.checklistDetailDismissed = true;
            state.checklistDetailSheetOpen = false;
        } else if (!__tmIsMultiSelectSupportedView()) {
            try { hint('ℹ 当前仅清单、表格、时间轴、看板和卡片流支持多选模式', 'info'); } catch (e) {}
        }
        if (options.render !== false && state.modal && document.body.contains(state.modal)) {
            try { render(); } catch (e) {
                try { __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'toggle-multi-select-mode' }); } catch (e2) {}
            }
        }
    };

    function __tmRefreshMultiSelectedRowsInPlace(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        const selectedSet = __tmGetMultiSelectedTaskIdSet();
        let touched = false;
        modal.querySelectorAll('#tmTaskTable tbody tr[data-id], #tmTimelineLeftTable tbody tr[data-id], .tm-checklist-item[data-id], .tm-kanban-card[data-id], .tm-whiteboard-stream-task-head[data-id]').forEach((row) => {
            if (!(row instanceof HTMLElement)) return;
            const id = String(row.getAttribute('data-id') || '').trim();
            row.classList.toggle('tm-task-row--multi-selected', !!id && selectedSet.has(id));
            try { row.setAttribute('aria-selected', !!id && selectedSet.has(id) ? 'true' : 'false'); } catch (e) {}
            touched = true;
        });
        return touched;
    }

    function __tmToggleTaskMultiSelection(taskId, options = {}) {
        const id = String(taskId || '').trim();
        if (!id || !__tmIsMultiSelectActive()) return false;
        const nextSet = __tmGetMultiSelectedTaskIdSet();
        if (nextSet.has(id)) nextSet.delete(id);
        else nextSet.add(id);
        __tmSetMultiSelectedTaskIds(Array.from(nextSet), { render: false });
        if (options.render !== false && state.modal && document.body.contains(state.modal)) {
            __tmRefreshMultiSelectUiInPlace(state.modal);
        }
        return true;
    }

    function __tmCloneUndoValue(value) {
        if (value == null) return value;
        if (typeof value !== 'object') return value;
        try { return JSON.parse(JSON.stringify(value)); } catch (e) { return value; }
    }

    function __tmUndoComparableValue(value) {
        if (value == null) return '';
        if (Array.isArray(value)) {
            try { return JSON.stringify(value); } catch (e) { return String(value); }
        }
        if (typeof value === 'object') {
            try { return JSON.stringify(value); } catch (e) { return String(value); }
        }
        return String(value);
    }

    function __tmCreateUndoRecord(definition = {}) {
        const def = (definition && typeof definition === 'object') ? definition : {};
        return {
            id: String(def.id || `tmundo_${Date.now()}_${++__tmUndoState.seq}`).trim(),
            type: String(def.type || '').trim(),
            taskId: String(def.taskId || '').trim(),
            requestedTaskId: String(def.requestedTaskId || '').trim(),
            patch: __tmCloneUndoValue(def.patch && typeof def.patch === 'object' ? def.patch : {}),
            inversePatch: __tmCloneUndoValue(def.inversePatch && typeof def.inversePatch === 'object' ? def.inversePatch : {}),
            label: String(def.label || '').trim(),
            source: String(def.source || '').trim(),
            createdAt: Math.max(0, Number(def.createdAt) || Date.now()),
        };
    }

    function __tmPushUndoRecord(definition = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const record = __tmCreateUndoRecord(definition);
        if (!record.type || !record.taskId) return null;
        __tmUndoState.undoStack.push(record);
        if (__tmUndoState.undoStack.length > __TM_UNDO_STACK_LIMIT) {
            __tmUndoState.undoStack.splice(0, __tmUndoState.undoStack.length - __TM_UNDO_STACK_LIMIT);
        }
        if (opts.clearRedo !== false) __tmUndoState.redoStack = [];
        return record;
    }

    function __tmGetUndoLabel(label, fallback = '最近一次修改') {
        const text = String(label || '').trim();
        return text || String(fallback || '最近一次修改').trim() || '最近一次修改';
    }

    function __tmBuildAttrUndoLabel(attrKey, fallbackName = '') {
        const key = String(attrKey || '').trim();
        const named = String(fallbackName || '').trim();
        if (named) return named;
        if (__tmIsTaskAttachmentAttrKey(key)) return '附件';
        if (key === 'custom-status') return '状态';
        if (key === 'custom-priority') return '优先级';
        if (key === 'custom-start-date') return '开始日期';
        if (key === 'custom-completion-time') return '截止日期';
        if (key === __TM_TASK_COMPLETE_AT_ATTR) return '截止时间';
        if (key === 'custom-duration') return '时长';
        if (key === 'custom-remark') return '备注';
        if (key === __TM_TASK_REPEAT_RULE_ATTR) return '循环规则';
        if (key === __TM_TASK_REPEAT_STATE_ATTR) return '循环状态';
        const field = __tmGetCustomFieldDefByAttrStorageKey(key);
        const fieldName = String(field?.name || '').trim();
        return fieldName || '任务字段';
    }

    function __tmExtractUndoEligibleMetaPatch(patch) {
        const input = (patch && typeof patch === 'object') ? patch : {};
        const out = {};
        ['customStatus', 'startDate', 'completionTime', 'duration', 'remark', 'attachments', 'repeatRule', 'repeatState'].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];
        });
        return out;
    }

    function __tmBuildUndoLabelFromMetaPatch(patch, fallback = '任务字段') {
        const nextPatch = __tmExtractUndoEligibleMetaPatch(patch);
        const keys = Object.keys(nextPatch);
        if (keys.length === 1) {
            const key = keys[0];
            if (key === 'customStatus') return '状态';
            if (key === 'startDate') return '开始日期';
            if (key === 'completionTime') return '截止日期';
            if (key === 'duration') return '时长';
            if (key === 'remark') return '备注';
            if (key === 'attachments') return '附件';
            if (key === 'repeatRule') return '循环规则';
            if (key === 'repeatState') return '循环状态';
        }
        if (keys.length === 2 && keys.includes('startDate') && keys.includes('completionTime')) return '日期';
        return String(fallback || '任务字段').trim() || '任务字段';
    }

    function __tmBuildMetaPatchFromAttrUpdate(attrKey, attrValue, taskLike = null) {
        const key = String(attrKey || '').trim();
        if (!key) return null;
        const rawValue = attrValue == null ? '' : String(attrValue);
        const trimmedValue = String(rawValue || '').trim();
        if (__tmIsTaskAttachmentAttrKey(key)) {
            const currentPaths = __tmGetTaskAttachmentPaths(taskLike || {});
            const nextPaths = currentPaths.slice();
            const index = __tmGetTaskAttachmentAttrIndex(key);
            while (nextPaths.length <= index) nextPaths.push('');
            nextPaths[index] = __tmNormalizeTaskAttachmentPath(rawValue);
            const normalizedPaths = __tmNormalizeTaskAttachmentPaths(nextPaths);
            return {
                patch: { attachments: normalizedPaths },
                attrValue: __tmNormalizeTaskAttachmentPath(rawValue),
            };
        }
        if (key === 'custom-status') return { patch: { customStatus: trimmedValue }, attrValue: trimmedValue };
        if (key === 'custom-priority') return { patch: { priority: trimmedValue }, attrValue: trimmedValue };
        if (key === 'custom-start-date') return { patch: { startDate: trimmedValue }, attrValue: trimmedValue };
        if (key === 'custom-completion-time') return { patch: { completionTime: trimmedValue }, attrValue: trimmedValue };
        if (key === 'custom-time') return { patch: { customTime: trimmedValue }, attrValue: trimmedValue };
        if (key === __TM_TASK_COMPLETE_AT_ATTR) {
            const normalizedValue = __tmNormalizeTaskCompleteAtValue(trimmedValue);
            return { patch: { taskCompleteAt: normalizedValue }, attrValue: normalizedValue };
        }
        if (key === 'custom-duration') return { patch: { duration: trimmedValue }, attrValue: trimmedValue };
        if (key === 'custom-remark') return { patch: { remark: rawValue }, attrValue: rawValue };
        if (key === 'custom-milestone-event') {
            const milestone = !!(trimmedValue === '1' || trimmedValue.toLowerCase() === 'true');
            return { patch: { milestone }, attrValue: milestone ? '1' : '' };
        }
        if (key === __TM_TASK_REPEAT_RULE_ATTR) return { patch: { repeatRule: __tmNormalizeTaskRepeatRule(rawValue) }, attrValue: rawValue };
        if (key === __TM_TASK_REPEAT_STATE_ATTR) return { patch: { repeatState: __tmNormalizeTaskRepeatState(rawValue) }, attrValue: rawValue };
        if (key === __TM_TASK_REPEAT_HISTORY_ATTR) return { patch: { repeatHistory: __tmNormalizeTaskRepeatHistory(rawValue) }, attrValue: rawValue };
        if (key === 'custom-pinned') {
            const pin = trimmedValue === '1' || trimmedValue.toLowerCase() === 'true';
            return { patch: { pinned: pin ? '1' : '' }, attrValue: pin ? '1' : '' };
        }
        const field = __tmGetCustomFieldDefByAttrStorageKey(key);
        const fieldId = String(field?.id || '').trim();
        if (!field || !fieldId) return null;
        const normalizedValue = __tmNormalizeCustomFieldValue(field, rawValue);
        const serializedValue = __tmSerializeCustomFieldValue(field, normalizedValue);
        return {
            patch: { customFieldValues: { [fieldId]: normalizedValue } },
            attrValue: serializedValue,
        };
    }

    function __tmIsPatchNoop(nextPatch, inversePatch) {
        const patch = (nextPatch && typeof nextPatch === 'object') ? nextPatch : {};
        const inverse = (inversePatch && typeof inversePatch === 'object') ? inversePatch : {};
        const keys = Object.keys(patch);
        if (!keys.length) return true;
        return keys.every((key) => {
            const nextValue = __tmNormalizeQueueTaskValue(key, patch[key]);
            const prevValue = __tmNormalizeQueueTaskValue(key, inverse[key]);
            return __tmUndoComparableValue(nextValue) === __tmUndoComparableValue(prevValue);
        });
    }

    function __tmDispatchTaskAttrPatchUpdated(taskId, patch, extra = {}) {
        const tid = String(taskId || '').trim();
        if (!tid || !patch || typeof patch !== 'object') return;
        const previousAttachmentPaths = Array.isArray(extra?.previousAttachmentPaths)
            ? extra.previousAttachmentPaths
            : __tmNormalizeTaskAttachmentPaths(extra?.previousPatch?.attachments || []);
        const previousAttachmentSlotCount = Math.max(0, Math.floor(Number(extra?.previousAttachmentSlotCount) || 0));
        const attrs = __tmBuildAttrPayloadFromPatch(patch, {
            previousAttachmentPaths,
            previousAttachmentSlotCount,
        });
        Object.entries(attrs || {}).forEach(([attrKey, value]) => {
            const key = String(attrKey || '').trim();
            if (!key) return;
            try {
                window.dispatchEvent(new CustomEvent('tm-task-attr-updated', {
                    detail: {
                        taskId: tid,
                        attrKey: key,
                        value: value == null ? '' : String(value),
                        ...extra,
                    }
                }));
            } catch (e) {}
        });
    }

    async function __tmResolveTaskMutationContext(taskId) {
        const requestedId = String(taskId || '').trim();
        if (!requestedId) return null;
        let resolvedId = requestedId;
        let task = globalThis.__tmRuntimeState?.getFlatTaskById?.(requestedId) || state.flatTasks?.[requestedId] || null;
        if (!task) {
            try {
                const nextResolved = await __tmResolveTaskIdFromAnyBlockId(requestedId);
                if (nextResolved) resolvedId = String(nextResolved || '').trim() || requestedId;
            } catch (e) {}
        }
        if (!task && resolvedId && resolvedId !== requestedId) {
            task = globalThis.__tmRuntimeState?.getFlatTaskById?.(resolvedId) || state.flatTasks?.[resolvedId] || null;
        }
        if (!task) {
            try { task = await __tmEnsureTaskInStateById(resolvedId || requestedId); } catch (e) { task = null; }
        }
        if (!task && resolvedId && resolvedId !== requestedId) {
            try { task = await __tmBuildTaskLikeFromBlockId(resolvedId); } catch (e) { task = null; }
        }
        if (!task) {
            try { task = await __tmBuildTaskLikeFromBlockId(requestedId); } catch (e) { task = null; }
        }
        if (task && typeof task === 'object') {
            try {
                task = __tmCacheTaskInState(task, {
                    docNameFallback: task.doc_name || task.docName || '未命名文档'
                }) || task;
            } catch (e) {}
        }
        const persistId = String(task?.id || resolvedId || requestedId).trim();
        if (!persistId) return null;
        return {
            requestedId,
            resolvedId,
            persistId,
            task: task || null,
            docId: String(task?.root_id || task?.docId || '').trim(),
        };
    }

    function __tmRefreshViewsAfterTaskMutation(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        try { __tmPushRefreshDebug('refresh-views-after-task-mutation', { ...opts }); } catch (e) {}
        if (opts.refresh === false) return;
        const calendarOnly = opts.calendarOnly === true;
        let refreshed = false;
        if (opts.refreshCalendar !== false) {
            try {
                if (globalThis.__tmCalendar && (typeof globalThis.__tmCalendar.requestRefresh === 'function' || typeof globalThis.__tmCalendar.refreshInPlace === 'function')) {
                    __tmRequestCalendarRefresh({
                        reason: String(opts.reason || 'task-mutation').trim() || 'task-mutation',
                        main: true,
                        side: true,
                        flushTaskPanel: true,
                        hard: opts.hard === true,
                    }, { hard: opts.hard === true });
                    refreshed = true;
                }
            } catch (e) {}
        }
        if (!calendarOnly) {
            if (state.homepageOpen) {
                try {
                    __tmScheduleHomepageRefresh(String(opts.reason || 'task-mutation').trim() || 'task-mutation');
                    refreshed = true;
                } catch (e) {}
                return;
            }
            try {
                __tmRefreshMainViewInPlace({ withFilters: opts.withFilters !== false });
                refreshed = true;
            } catch (e) {}
            if (!refreshed) {
                try { __tmScheduleRender({ withFilters: opts.withFilters !== false }); } catch (e) {
                    try { render(); } catch (e2) {}
                }
            }
        }
    }

    async function __tmApplyTaskMetaPatchWithUndo(taskId, patch, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        if (!Object.keys(nextPatch).length) return { ok: true, changed: false, taskId: String(taskId || '').trim() };
        const hasStatusPatch = Object.prototype.hasOwnProperty.call(nextPatch, 'customStatus');
        if (hasStatusPatch) {
            __tmPushStatusDebug('meta-patch:start', {
                taskId: String(taskId || '').trim(),
                patch: { ...nextPatch },
                source: String(opts.source || '').trim(),
                refresh: opts.refresh !== false,
                refreshCalendar: opts.refreshCalendar !== false,
                withFilters: opts.withFilters !== false,
            }, [taskId], { force: true });
        }
        try {
            if (Object.prototype.hasOwnProperty.call(nextPatch, 'startDate') || Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime')) {
                __tmPushRefreshDebug('meta-patch-date-start', {
                    taskId: String(taskId || '').trim(),
                    patch: { ...nextPatch },
                    source: String(opts.source || '').trim(),
                    refresh: opts.refresh !== false,
                    refreshCalendar: opts.refreshCalendar !== false,
                });
            }
        } catch (e) {}
        const context = await __tmResolveTaskMutationContext(taskId);
        if (!context?.persistId) throw new Error('未找到任务');
        const inversePatch = __tmCaptureTaskPatchInverse(context.persistId, nextPatch);
        const localAttrSuppressionIds = Array.from(new Set([
            context.requestedId,
            context.persistId,
            __tmGetTaskAttrHostId(context.task),
            String(opts.broadcastTaskId || '').trim(),
        ].filter(Boolean)));
        const localAttrSuppressionDocIds = Array.from(new Set([
            context.docId,
            String(context.task?.root_id || '').trim(),
            String(context.task?.docId || '').trim(),
        ].filter(Boolean)));
        __tmMarkLocalTimeTxSuppressionIds(localAttrSuppressionIds, localAttrSuppressionDocIds, 2200);
        try {
            __tmPushRefreshDebug('local-attr-tx-suppress-arm', {
                taskId: context.persistId,
                requestedTaskId: context.requestedId,
                patchKeys: Object.keys(nextPatch),
                ids: localAttrSuppressionIds,
                docIds: localAttrSuppressionDocIds,
                source: String(opts.source || '').trim(),
            });
        } catch (e) {}
        if (hasStatusPatch) {
            __tmPushStatusDebug('meta-patch:context', {
                requestedTaskId: context.requestedId,
                persistId: context.persistId,
                attrHostId: __tmGetTaskAttrHostId(context.task),
                inversePatch: { ...inversePatch },
            }, [context.requestedId, context.persistId, __tmGetTaskAttrHostId(context.task)], { force: true });
        }
        if (opts.skipNoopCheck !== true && __tmIsPatchNoop(nextPatch, inversePatch)) {
            if (hasStatusPatch) {
                __tmPushStatusDebug('meta-patch:noop', {
                    requestedTaskId: context.requestedId,
                    persistId: context.persistId,
                    patch: { ...nextPatch },
                    inversePatch: { ...inversePatch },
                }, [context.requestedId, context.persistId], { force: true });
            }
            return {
                ok: true,
                changed: false,
                taskId: context.persistId,
                requestedTaskId: context.requestedId,
                patch: __tmCloneUndoValue(nextPatch),
                inversePatch,
            };
        }
        const suppressionIds = __tmGetTaskSuppressionIds(context.persistId, context.task);
        return await __tmMutationEngine.withSuppressedTasks(suppressionIds, async () => {
            if (hasStatusPatch) {
                __tmPushStatusDebug('meta-patch:persist', {
                    requestedTaskId: context.requestedId,
                    persistId: context.persistId,
                    suppressionIds,
                    patch: { ...nextPatch },
                }, suppressionIds, { force: true });
            }
            const persistOptions = {
                queued: opts.queued === true,
                background: opts.background === true,
                skipFlush: opts.skipFlush,
                docId: context.docId,
                renderOptimistic: opts.renderOptimistic,
                withFilters: opts.withFilters,
            };
            await __tmPersistMetaAndAttrsAsync(context.persistId, nextPatch, persistOptions);
            const settledInversePatch = Object.prototype.hasOwnProperty.call(nextPatch, 'attachments')
                ? {
                    ...inversePatch,
                    attachments: Array.isArray(persistOptions.__resolvedPreviousAttachmentPaths)
                        ? __tmNormalizeTaskAttachmentPaths(persistOptions.__resolvedPreviousAttachmentPaths)
                        : __tmNormalizeTaskAttachmentPaths(inversePatch?.attachments || []),
                }
                : inversePatch;
            let statusReadback = null;
            if (hasStatusPatch) {
                try { statusReadback = await __tmReadDocCheckboxBlockAttrs(context.persistId); } catch (e) { statusReadback = null; }
                __tmPushStatusDebug('meta-patch:after-persist', {
                    requestedTaskId: context.requestedId,
                    persistId: context.persistId,
                    patch: { ...nextPatch },
                    readback: statusReadback,
                }, suppressionIds, { force: true });
            }
            __tmApplyAttrPatchLocally(context.persistId, nextPatch, { render: false, withFilters: opts.withFilters !== false });
            try {
                if (context.docId) __tmInvalidateTasksQueryCacheByDocId(context.docId);
                else __tmInvalidateAllSqlCaches();
            } catch (e) {}
            try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
            if (opts.refresh !== false) {
                try {
                    __tmRefreshTaskFieldsAcrossViews(context.persistId, nextPatch, {
                        withFilters: opts.withFilters !== false,
                        reason: String(opts.source || 'attr-patch').trim() || 'attr-patch',
                        forceProjectionRefresh: __tmDoesPatchAffectProjection(context.persistId, nextPatch),
                        fallback: true,
                    });
                } catch (e) {
                    try {
                        __tmRefreshViewsAfterTaskMutation({
                            refresh: true,
                            refreshCalendar: false,
                            withFilters: opts.withFilters !== false,
                            hard: opts.hard === true,
                            reason: String(opts.source || 'attr-patch').trim() || 'attr-patch',
                        });
                    } catch (e2) {}
                }
            }
            if (opts.refreshCalendar !== false && __tmPatchAffectsCalendar(nextPatch)) {
                try {
                    __tmRequestCalendarRefresh({
                        reason: String(opts.source || 'attr-patch').trim() || 'attr-patch',
                        main: String(state.viewMode || '').trim() === 'calendar',
                        side: __tmShouldShowCalendarSideDock(),
                        flushTaskPanel: true,
                        hard: opts.hard === true,
                    }, { hard: opts.hard === true });
                } catch (e) {}
            }
            try {
                if (Object.prototype.hasOwnProperty.call(nextPatch, 'startDate') || Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime')) {
                    __tmPushRefreshDebug('meta-patch-date-end', {
                        taskId: context.persistId,
                        source: String(opts.source || '').trim(),
                    });
                }
            } catch (e) {}
            if (opts.broadcast !== false) {
                __tmDispatchTaskAttrPatchUpdated(opts.broadcastTaskId || context.requestedId || context.persistId, nextPatch, {
                    resolvedTaskId: context.persistId,
                    source: String(opts.source || '').trim(),
                    previousPatch: settledInversePatch,
                    previousAttachmentPaths: persistOptions.__resolvedPreviousAttachmentPaths,
                    previousAttachmentSlotCount: persistOptions.__resolvedPreviousAttachmentSlotCount,
                });
            }
            if (hasStatusPatch) {
                __tmPushStatusDebug('meta-patch:end', {
                    requestedTaskId: context.requestedId,
                    persistId: context.persistId,
                    patch: { ...nextPatch },
                    source: String(opts.source || '').trim(),
                }, suppressionIds, { force: true });
            }
            if (opts.recordUndo !== false && !__tmUndoState.applying) {
                __tmPushUndoRecord({
                    type: 'attrPatch',
                    taskId: context.persistId,
                    requestedTaskId: context.requestedId,
                    patch: nextPatch,
                    inversePatch: settledInversePatch,
                    label: __tmGetUndoLabel(opts.label, '任务字段'),
                    source: String(opts.source || '').trim(),
                });
            }
            return {
                ok: true,
                changed: true,
                taskId: context.persistId,
                requestedTaskId: context.requestedId,
                patch: __tmCloneUndoValue(nextPatch),
                inversePatch: settledInversePatch,
            };
        });
    }

    async function __tmApplyTaskAttrUpdateWithUndo(taskId, attrKey, attrValue, options = {}) {
        const key = String(attrKey || '').trim();
        const task = globalThis.__tmRuntimeState?.getTaskById?.(taskId) || state.flatTasks?.[String(taskId || '').trim()] || state.pendingInsertedTasks?.[String(taskId || '').trim()] || null;
        const meta = __tmBuildMetaPatchFromAttrUpdate(key, attrValue, task);
        if (!meta || !meta.patch) throw new Error('未找到可更新字段');
        const opts = (options && typeof options === 'object') ? options : {};
        const result = await __tmApplyTaskMetaPatchWithUndo(taskId, meta.patch, {
            ...opts,
            label: __tmGetUndoLabel(opts.label, __tmBuildAttrUndoLabel(key, opts.fieldName)),
        });
        return {
            ...result,
            attrKey: key,
            attrValue: meta.attrValue,
        };
    }

    function __tmReplaceTaskListItemMarkerInMarkdown(markdown, marker) {
        const md = String(markdown || '');
        const nextMarker = __tmNormalizeTaskStatusMarker(marker, ' ');
        if (!md) return '';
        const lines = md.split(/\r?\n/);
        const firstLine = String(lines[0] || '');
        const statusRegex = /^(\s*(?:[\*\-]|\d+\.)\s*\[)([^\]])(\])/;
        const fallbackRegex = /(\[)([^\]])(\])/;
        if (statusRegex.test(firstLine)) {
            lines[0] = firstLine.replace(statusRegex, `$1${nextMarker}$3`);
            return lines.join('\n');
        }
        if (fallbackRegex.test(firstLine)) {
            lines[0] = firstLine.replace(fallbackRegex, `$1${nextMarker}$3`);
            return lines.join('\n');
        }
        return '';
    }

    function __tmBuildTaskMarkdownWithMarker(taskLike, marker) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const nextMarker = __tmNormalizeTaskStatusMarker(marker, ' ');
        const replaced = __tmReplaceTaskListItemMarkerInMarkdown(task?.markdown, nextMarker);
        if (replaced) return replaced;
        const content = String(task?.content || task?.raw_content || '').trim();
        return `- [${nextMarker}] ${content}`;
    }

    async function __tmUpdateTaskListItemMarkerWithFallback(taskId, marker) {
        const tid = String(taskId || '').trim();
        if (!tid) throw new Error('缺少任务 ID');
        const nextMarker = __tmNormalizeTaskStatusMarker(marker, ' ');
        __tmPushStatusDebug('marker-update:start', {
            taskId: tid,
            marker: nextMarker,
        }, [tid], { force: true });
        try {
            await API.updateTaskListItemMarker(tid, nextMarker);
            __tmPushStatusDebug('marker-update:success', {
                taskId: tid,
                marker: nextMarker,
                mode: 'direct',
            }, [tid], { force: true });
            return { id: tid, marker: nextMarker, markdown: null, usedBatch: false, usedFallback: false };
        } catch (apiErr) {
            __tmPushStatusDebug('marker-update:fallback', {
                taskId: tid,
                marker: nextMarker,
                error: String(apiErr?.message || apiErr || ''),
            }, [tid], { force: true });
            let kramdown = '';
            try { kramdown = await API.getBlockKramdown(tid); } catch (e) { kramdown = ''; }
            const nextMarkdown = __tmReplaceTaskListItemMarkerInMarkdown(kramdown, nextMarker);
            if (!nextMarkdown) throw apiErr;
            const updateResult = await API.updateBlock(tid, nextMarkdown);
            const nextId = String(updateResult?.id || tid).trim() || tid;
            __tmPushStatusDebug('marker-update:fallback-success', {
                taskId: tid,
                marker: nextMarker,
                nextId,
                markdown: nextMarkdown,
            }, [tid, nextId], { force: true });
            return { id: nextId, marker: nextMarker, markdown: nextMarkdown, usedBatch: false, usedFallback: true };
        }
    }

    async function __tmBatchUpdateTaskListItemMarkersWithFallback(items) {
        const list = Array.isArray(items) ? items : [];
        const payload = list
            .map((item) => ({
                id: String(item?.id || '').trim(),
                marker: __tmNormalizeTaskStatusMarker(item?.marker, ' '),
            }))
            .filter((item) => item.id);
        const successMap = new Map();
        const failures = [];
        if (!payload.length) return { successMap, failures };
        try {
            await API.batchUpdateTaskListItemMarker(payload);
            payload.forEach((item) => {
                successMap.set(item.id, {
                    id: item.id,
                    marker: item.marker,
                    markdown: null,
                    usedBatch: true,
                    usedFallback: false,
                });
            });
            return { successMap, failures };
        } catch (batchErr) {
            for (const item of payload) {
                try {
                    const result = await __tmUpdateTaskListItemMarkerWithFallback(item.id, item.marker);
                    successMap.set(item.id, result);
                } catch (e) {
                    failures.push({
                        id: item.id,
                        error: e instanceof Error ? e : new Error(String(e || batchErr || '更新任务状态标记失败')),
                    });
                }
            }
            return { successMap, failures };
        }
    }

    function __tmApplyTaskStatusLocalState(taskId, statusId, marker, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const nextStatusId = String(statusId || '').trim();
        const nextMarker = __tmNormalizeTaskStatusMarker(marker, ' ');
        const nextDone = __tmIsTaskMarkerDone(nextMarker);
        const applyOne = (target) => {
            if (!(target && typeof target === 'object')) return;
            target.customStatus = nextStatusId;
            target.custom_status = nextStatusId;
            target.done = nextDone;
            target.taskMarker = nextMarker;
            target.task_marker = nextMarker;
            if (typeof opts.markdown === 'string' && opts.markdown) {
                target.markdown = opts.markdown;
            } else {
                target.markdown = __tmBuildTaskMarkdownWithMarker(target, nextMarker);
            }
        };
        try { applyOne(globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid]); } catch (e) {}
        try { applyOne(globalThis.__tmRuntimeState?.getPendingTaskById?.(tid) || state.pendingInsertedTasks?.[tid]); } catch (e) {}
        try {
            if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
            state.doneOverrides[tid] = nextDone;
        } catch (e) {}
        try {
            const content = String(
                globalThis.__tmRuntimeState?.getFlatTaskById?.(tid)?.content
                || globalThis.__tmRuntimeState?.getPendingTaskById?.(tid)?.content
                || state.flatTasks?.[tid]?.content
                || state.pendingInsertedTasks?.[tid]?.content
                || ''
            ).trim();
            MetaStore.set(tid, { customStatus: nextStatusId, done: nextDone, content });
        } catch (e) {}
        try {
            __tmSyncTaskPriorityScoreLocal(tid, {
                includeAncestors: true,
                refreshAncestorViews: true,
                reason: 'status-local-priority-sync',
            });
        } catch (e) {}
        __tmPushStatusDebug('status-local-state', {
            taskId: tid,
            customStatus: nextStatusId,
            marker: nextMarker,
            done: nextDone,
            hasMarkdown: !!(typeof opts.markdown === 'string' && opts.markdown),
        }, [tid], { force: true });
        return true;
    }

    async function __tmApplyTaskStatus(taskId, statusId, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const statusOptions = __tmGetStatusOptions();
        const fallbackStatusId = __tmGetDefaultUndoneStatusId(statusOptions);
        const requestedStatusId = String(statusId || '').trim() || fallbackStatusId;
        const statusOption = __tmFindStatusOptionById(requestedStatusId, statusOptions);
        if (!statusOption) throw new Error('状态不存在，请先在设置中配置');
        const nextStatusId = String(statusOption.id || requestedStatusId).trim();
        const nextMarker = __tmNormalizeTaskStatusMarker(statusOption.marker, __tmGuessStatusOptionDefaultMarker(statusOption));
        const nextDone = __tmIsTaskMarkerDone(nextMarker);
        const context = await __tmResolveTaskMutationContext(taskId);
        if (!context?.persistId) throw new Error('未找到任务');
        const task = context.task
            || globalThis.__tmRuntimeState?.getTaskById?.(context.persistId)
            || state.flatTasks?.[context.persistId]
            || state.pendingInsertedTasks?.[context.persistId]
            || null;
        const currentStatusId = __tmResolveTaskStatusId(task, statusOptions);
        const currentMarker = __tmResolveTaskMarker(task, statusOptions);
        const currentDone = __tmIsTaskMarkerDone(currentMarker);
        const prevStatusId = String(opts.previousStatusId || '').trim() || currentStatusId;
        const hasPreviousMarker = Object.prototype.hasOwnProperty.call(opts, 'previousMarker');
        const prevMarker = hasPreviousMarker
            ? __tmNormalizeTaskStatusMarker(opts.previousMarker, '')
            : currentMarker;
        const prevDone = Object.prototype.hasOwnProperty.call(opts, 'previousDone')
            ? !!opts.previousDone
            : __tmIsTaskMarkerDone(prevMarker);
        const initialStatusLogIds = Array.from(new Set([
            context.requestedId,
            context.persistId,
            __tmGetTaskAttrHostId(task),
        ].filter(Boolean)));
        const localStatusSuppressionTask = (task && typeof task === 'object')
            ? task
            : {
                id: context.persistId,
                root_id: context.docId,
                docId: context.docId,
            };
        const localStatusSuppressionIds = Array.from(new Set([
            context.requestedId,
            context.persistId,
            __tmGetTaskAttrHostId(task),
            String(opts.broadcastTaskId || '').trim(),
        ].filter(Boolean)));
        try {
            __tmMarkLocalDoneTxSuppressionForTask(localStatusSuppressionTask, localStatusSuppressionIds, 2600);
        } catch (e) {}
        try {
            __tmPushRefreshDebug('local-status-tx-suppress-arm', {
                taskId: context.persistId,
                requestedTaskId: context.requestedId,
                statusId: nextStatusId,
                marker: nextMarker,
                done: nextDone,
                ids: localStatusSuppressionIds,
                docId: String(context.docId || '').trim(),
                source: String(opts.source || '').trim(),
            });
        } catch (e) {}
        __tmPushStatusDebug('apply-status:start', {
            requestedTaskId: context.requestedId,
            persistId: context.persistId,
            attrHostId: __tmGetTaskAttrHostId(task),
            requestedStatusId,
            nextStatusId,
            nextMarker,
            nextDone,
            currentStatusId,
            currentMarker,
            currentDone,
            prevStatusId,
            prevMarker,
            prevDone,
            source: String(opts.source || '').trim(),
        }, initialStatusLogIds, { force: true });
        if (prevStatusId === nextStatusId && prevMarker === nextMarker) {
            __tmPushStatusDebug('apply-status:noop', {
                requestedTaskId: context.requestedId,
                persistId: context.persistId,
                nextStatusId,
                nextMarker,
            }, initialStatusLogIds, { force: true });
            return {
                ok: true,
                changed: false,
                taskId: context.persistId,
                requestedTaskId: context.requestedId,
                patch: { customStatus: nextStatusId, done: nextDone },
                inversePatch: { customStatus: prevStatusId, done: prevDone },
            };
        }
        if (prevMarker === nextMarker) {
            __tmPushStatusDebug('apply-status:same-marker-meta-path', {
                requestedTaskId: context.requestedId,
                persistId: context.persistId,
                prevStatusId,
                nextStatusId,
                marker: nextMarker,
            }, initialStatusLogIds, { force: true });
            return await __tmApplyTaskMetaPatchWithUndo(context.persistId, { customStatus: nextStatusId }, {
                source: String(opts.source || 'task-status').trim() || 'task-status',
                label: String(opts.label || '状态').trim() || '状态',
                refresh: opts.refresh !== false,
                refreshCalendar: opts.refreshCalendar !== false,
                withFilters: opts.withFilters !== false,
                hard: opts.hard === true,
                broadcast: opts.broadcast !== false,
                recordUndo: opts.recordUndo !== false,
                broadcastTaskId: opts.broadcastTaskId || context.requestedId || context.persistId,
                skipNoopCheck: true,
            });
        }

        let markerResult = null;
        const completeAtPatch = nextDone ? __tmBuildTaskCompleteAtPatch() : null;
        const persistPatch = {
            customStatus: nextStatusId,
            ...((completeAtPatch && typeof completeAtPatch === 'object') ? completeAtPatch : {}),
        };
        const suppressionIds = __tmGetTaskSuppressionIds(context.persistId, task);
        return await __tmMutationEngine.withSuppressedTasks(suppressionIds, async () => {
            try {
                __tmPushStatusDebug('apply-status:marker-path', {
                    requestedTaskId: context.requestedId,
                    persistId: context.persistId,
                    suppressionIds,
                    persistPatch: { ...persistPatch },
                }, suppressionIds, { force: true });
                __tmMarkNativeDocCheckboxStatusSyncIgnored(suppressionIds, nextStatusId, nextMarker, 1600);
                markerResult = await __tmUpdateTaskListItemMarkerWithFallback(context.persistId, nextMarker);
                const markerAnchorId = String(markerResult?.id || context.persistId).trim() || context.persistId;
                let attrTargetId = '';
                try { attrTargetId = await __tmResolveTaskAttrHostIdFromAnyBlockId(markerAnchorId); } catch (e) { attrTargetId = ''; }
                if (!attrTargetId) {
                    try {
                        const latestTask = globalThis.__tmRuntimeState?.getTaskById?.(context.persistId)
                            || state.flatTasks?.[context.persistId]
                            || state.pendingInsertedTasks?.[context.persistId]
                            || task;
                        attrTargetId = String(__tmGetTaskAttrHostId(latestTask) || '').trim();
                    } catch (e) { attrTargetId = ''; }
                }
                __tmPushStatusDebug('apply-status:resolved-host', {
                    requestedTaskId: context.requestedId,
                    persistId: context.persistId,
                    markerResult,
                    markerAnchorId,
                    attrTargetId,
                }, [context.requestedId, context.persistId, markerAnchorId, attrTargetId], { force: true });
                __tmMarkNativeDocCheckboxStatusSyncIgnored([markerAnchorId, attrTargetId], nextStatusId, nextMarker, 1600);
                await __tmPersistMetaAndAttrsAsync(context.persistId, persistPatch, {
                    attrTargetId,
                    queued: opts.queued === true,
                    background: opts.background === true,
                    skipFlush: opts.skipFlush,
                    saveMetaNow: false,
                    docId: context.docId,
                    renderOptimistic: false,
                    withFilters: opts.withFilters,
                });
                let readback = null;
                try { readback = await __tmReadDocCheckboxBlockAttrs(context.persistId); } catch (e) { readback = null; }
                __tmPushStatusDebug('apply-status:after-persist', {
                    requestedTaskId: context.requestedId,
                    persistId: context.persistId,
                    markerResult,
                    readback,
                }, [context.requestedId, context.persistId, markerAnchorId, attrTargetId], { force: true });
            } catch (e) {
                __tmPushStatusDebug('apply-status:error', {
                    requestedTaskId: context.requestedId,
                    persistId: context.persistId,
                    error: String(e?.message || e || ''),
                    markerResult,
                }, suppressionIds, { force: true });
                if (markerResult && prevMarker !== nextMarker) {
                    try { await __tmUpdateTaskListItemMarkerWithFallback(context.persistId, prevMarker); } catch (rollbackErr) {}
                }
                throw e;
            }

            try { __tmApplyAttrPatchLocally(context.persistId, persistPatch, { render: false, withFilters: false }); } catch (e) {}
            try { __tmApplyTaskStatusLocalState(context.persistId, nextStatusId, nextMarker, { markdown: markerResult?.markdown || '' }); } catch (e) {}
            try {
                if (context.docId) __tmInvalidateTasksQueryCacheByDocId(context.docId);
                else __tmInvalidateAllSqlCaches();
            } catch (e) {}
            try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
            const settledPatch = {
                customStatus: nextStatusId,
                done: nextDone,
                ...((completeAtPatch && typeof completeAtPatch === 'object') ? completeAtPatch : {}),
            };
            if (opts.refresh !== false) {
                try {
                    __tmRefreshTaskFieldsAcrossViews(context.persistId, settledPatch, {
                        withFilters: opts.withFilters !== false,
                        reason: String(opts.source || 'task-status').trim() || 'task-status',
                        forceProjectionRefresh: __tmDoesPatchAffectProjection(context.persistId, settledPatch),
                        fallback: true,
                    });
                } catch (e) {
                    try {
                        __tmRefreshViewsAfterTaskMutation({
                            refresh: true,
                            refreshCalendar: false,
                            withFilters: opts.withFilters !== false,
                            hard: opts.hard === true,
                            reason: String(opts.source || 'task-status').trim() || 'task-status',
                        });
                    } catch (e2) {}
                }
            }
            if (opts.refreshCalendar !== false && __tmPatchAffectsCalendar(settledPatch)) {
                try {
                    __tmRequestCalendarRefresh({
                        reason: String(opts.source || 'task-status').trim() || 'task-status',
                        main: String(state.viewMode || '').trim() === 'calendar',
                        side: __tmShouldShowCalendarSideDock(),
                        flushTaskPanel: true,
                        hard: opts.hard === true,
                    }, { hard: opts.hard === true });
                } catch (e) {}
            }
            if (opts.broadcast !== false) {
                __tmDispatchTaskAttrPatchUpdated(opts.broadcastTaskId || context.requestedId || context.persistId, persistPatch, {
                    resolvedTaskId: context.persistId,
                    source: String(opts.source || '').trim(),
                });
            }
            if (opts.recordUndo !== false && !__tmUndoState.applying) {
                __tmPushUndoRecord({
                    type: 'taskStatus',
                    taskId: context.persistId,
                    requestedTaskId: context.requestedId,
                    patch: { customStatus: nextStatusId, done: nextDone },
                    inversePatch: { customStatus: prevStatusId, done: prevDone },
                    label: __tmGetUndoLabel(opts.label, '状态'),
                    source: String(opts.source || '').trim(),
                });
            }
            __tmPushStatusDebug('apply-status:end', {
                requestedTaskId: context.requestedId,
                persistId: context.persistId,
                settledPatch,
                markerResult,
            }, suppressionIds, { force: true });
            return {
                ok: true,
                changed: true,
                taskId: context.persistId,
                requestedTaskId: context.requestedId,
                patch: { customStatus: nextStatusId, done: nextDone },
                inversePatch: { customStatus: prevStatusId, done: prevDone },
            };
        });
    }

    async function __tmApplyTaskStatusBatch(taskIds, statusId, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const ids = Array.from(new Set((Array.isArray(taskIds) ? taskIds : []).map((id) => String(id || '').trim()).filter(Boolean)));
        if (!ids.length) return { successCount: 0, failureCount: 0, failures: [] };
        const statusOptions = __tmGetStatusOptions();
        const fallbackStatusId = __tmGetDefaultUndoneStatusId(statusOptions);
        const requestedStatusId = String(statusId || '').trim() || fallbackStatusId;
        const statusOption = __tmFindStatusOptionById(requestedStatusId, statusOptions);
        if (!statusOption) throw new Error('状态不存在，请先在设置中配置');
        const nextStatusId = String(statusOption.id || requestedStatusId).trim();
        return await __tmMutationEngine.requestTaskPatchBatch(ids, { customStatus: nextStatusId }, {
            source: String(opts.source || 'task-status-batch').trim() || 'task-status-batch',
            label: __tmGetUndoLabel(opts.label, '状态'),
            reason: String(opts.source || 'task-status-batch').trim() || 'task-status-batch',
        });
    }

    async function __tmUndoLastMutation(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (__tmUndoState.applying) return false;
        const record = __tmUndoState.undoStack.pop();
        if (!record) {
            if (opts.silentEmpty !== true) hint('ℹ 当前没有可撤销的修改', 'info');
            return false;
        }
        __tmUndoState.applying = true;
        try {
            if (record.type === 'attrPatch') {
                await __tmApplyTaskMetaPatchWithUndo(record.taskId || record.requestedTaskId, record.inversePatch, {
                    recordUndo: false,
                    refresh: true,
                    refreshCalendar: true,
                    source: 'undo',
                    label: record.label,
                    broadcastTaskId: record.requestedTaskId || record.taskId,
                });
            } else if (record.type === 'setDone') {
                const statusPatch = {
                    ...((record.inversePatch && typeof record.inversePatch === 'object') ? record.inversePatch : {})
                };
                delete statusPatch.done;
                await window.tmSetDone(record.taskId || record.requestedTaskId, !!record.inversePatch?.done, null, {
                    recordUndo: false,
                    statusPatch: Object.keys(statusPatch).length ? statusPatch : null,
                    suppressHint: true,
                    source: 'undo',
                });
            } else if (record.type === 'taskStatus') {
                const targetStatusId = String(record.inversePatch?.customStatus || '').trim();
                await __tmApplyTaskStatus(record.taskId || record.requestedTaskId, targetStatusId, {
                    recordUndo: false,
                    refresh: true,
                    refreshCalendar: true,
                    withFilters: true,
                    hard: false,
                    suppressHint: true,
                    source: 'undo',
                });
            } else {
                throw new Error(`未支持的撤销类型: ${record.type || 'unknown'}`);
            }
            __tmUndoState.redoStack.push(__tmCreateUndoRecord(record));
            hint(`✅ 已撤销${__tmGetUndoLabel(record.label) ? `：${__tmGetUndoLabel(record.label)}` : ''}`, 'success');
            return true;
        } catch (e) {
            __tmUndoState.undoStack.push(record);
            if (opts.silentError !== true) hint(`❌ 撤销失败: ${e?.message || String(e)}`, 'error');
            return false;
        } finally {
            __tmUndoState.applying = false;
        }
    }

    function __tmShouldIgnoreUndoShortcutTarget(target) {
        const el = target instanceof Element ? target : null;
        if (!el) return false;
        if (el.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""],.ace_editor,.CodeMirror,.cm-editor')) return true;
        const role = String(el.getAttribute?.('role') || '').trim().toLowerCase();
        if (role === 'textbox' || role === 'combobox') return true;
        return false;
    }

    function __tmBindUndoShortcut() {
        if (__tmUndoState.keydownHandler || __tmIsMobileDevice()) return;
        __tmUndoState.keydownHandler = (event) => {
            if (!event || event.defaultPrevented) return;
            if (__tmIsMobileDevice()) return;
            if (event.isComposing) return;
            const key = String(event.key || '').toLowerCase();
            if (key !== 'z') return;
            if (!event.ctrlKey && !event.metaKey) return;
            if (event.altKey || event.shiftKey) return;
            if (!__tmUndoState.undoStack.length) return;
            if (__tmShouldIgnoreUndoShortcutTarget(event.target)) return;
            try { event.preventDefault(); } catch (e) {}
            try { event.stopPropagation(); } catch (e) {}
            void __tmUndoLastMutation({ silentEmpty: true, silentError: false });
        };
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'keydown', __tmUndoState.keydownHandler, true); } catch (e) {}
    }

    function __tmResolveMultiSelectSweepSource(target) {
        if (!__tmIsMultiSelectActive()) return null;
        const el = target instanceof Element ? target : null;
        if (!(el instanceof Element)) return null;
        const candidate = el.closest('.tm-checklist-item[data-id], #tmTimelineLeftTable tbody tr[data-id], #tmTaskTable tbody tr[data-id], .tm-kanban-card[data-id], .tm-whiteboard-stream-task-head[data-id]');
        if (!(candidate instanceof HTMLElement)) return null;
        const taskId = String(candidate.getAttribute('data-id') || '').trim();
        if (!taskId) return null;
        const isKanban = candidate.classList.contains('tm-kanban-card');
        const isWhiteboardStream = candidate.classList.contains('tm-whiteboard-stream-task-head');
        const skipSelector = isKanban
            ? 'input,button,select,textarea,a,label,[contenteditable="true"],.tm-task-checkbox,.tm-task-checkbox-wrap,.tm-kanban-toggle,.tm-kanban-more,.tm-status-tag,.tm-kanban-chip,.tm-priority-jira,.tm-kanban-priority-chip'
            : (isWhiteboardStream
                ? 'input,button,select,textarea,a,label,[contenteditable="true"],.tm-task-checkbox,.tm-task-checkbox-wrap,.tm-kanban-toggle'
                : 'input,button,select,textarea,a,label,[contenteditable="true"],.tm-tree-toggle,.tm-col-resize,.tm-checklist-mobile-toggle,.tm-status-tag');
        if (el.closest(skipSelector)) return null;
        return { taskId, sourceEl: candidate };
    }

    function __tmResolveMultiSelectRowFromPoint(clientX, clientY) {
        if (!Number.isFinite(Number(clientX)) || !Number.isFinite(Number(clientY))) return null;
        let hit = null;
        try { hit = document.elementFromPoint(Number(clientX), Number(clientY)); } catch (e) {}
        if (!(hit instanceof Element)) return null;
        const row = hit.closest('.tm-checklist-item[data-id], #tmTimelineLeftTable tbody tr[data-id], #tmTaskTable tbody tr[data-id], .tm-kanban-card[data-id], .tm-whiteboard-stream-task-head[data-id]');
        if (!(row instanceof HTMLElement)) return null;
        const taskId = String(row.getAttribute('data-id') || '').trim();
        if (!taskId) return null;
        return { taskId, rowEl: row };
    }

    function __tmBindMultiSelectPointerSweep(modalEl) {
        try { state.multiSelectPointerSweepAbort?.abort?.(); } catch (e) {}
        state.multiSelectPointerSweepAbort = null;
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        if (!__tmIsMultiSelectActive()) return;
        const viewMode = String(state.viewMode || '').trim();
        if (!__tmIsMultiSelectSupportedView(viewMode)) return;
        const abort = new AbortController();
        state.multiSelectPointerSweepAbort = abort;

        modal.addEventListener('dragstart', (ev) => {
            if (!__tmIsMultiSelectActive()) return;
            const source = __tmResolveMultiSelectSweepSource(ev?.target);
            if (!source) return;
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
        }, { capture: true, signal: abort.signal });

        modal.addEventListener('pointerdown', (ev) => {
            if (!__tmIsMultiSelectActive()) return;
            if (ev && typeof ev.button === 'number' && ev.button !== 0) return;
            const pointerType = String(ev?.pointerType || '').trim().toLowerCase();
            if (pointerType === 'touch') return;
            const source = __tmResolveMultiSelectSweepSource(ev?.target);
            if (!source) return;

            try { state.multiSelectPointerGestureCleanup?.(); } catch (e) {}

            const taskId = String(source.taskId || '').trim();
            const sourceEl = source.sourceEl instanceof HTMLElement ? source.sourceEl : null;
            if (!taskId || !(sourceEl instanceof HTMLElement)) return;

            const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : NaN;
            const threshold = 4;
            const suppressClickMs = 260;
            const baselineSelectedSet = __tmGetMultiSelectedTaskIdSet();
            const sweepPath = [];
            const startX = Number(ev?.clientX) || 0;
            const startY = Number(ev?.clientY) || 0;
            let lastX = startX;
            let lastY = startY;
            let sweeping = false;
            let ended = false;
            let captured = false;

            const samePointer = (e2) => {
                if (!Number.isFinite(pointerId)) return true;
                const currentPointerId = Number(e2?.pointerId);
                if (!Number.isFinite(currentPointerId)) return true;
                return currentPointerId === pointerId;
            };

            const capturePointer = () => {
                if (captured || !Number.isFinite(pointerId) || typeof sourceEl.setPointerCapture !== 'function') return;
                try {
                    sourceEl.setPointerCapture(pointerId);
                    captured = true;
                } catch (e) {}
            };

            const applySelection = (id) => {
                const normalizedId = String(id || '').trim();
                if (!normalizedId) return;
                __tmSetTaskMultiSelection(normalizedId, true, { render: true });
            };

            const revertSelection = (id) => {
                const normalizedId = String(id || '').trim();
                if (!normalizedId) return;
                __tmSetTaskMultiSelection(normalizedId, baselineSelectedSet.has(normalizedId), { render: true });
            };

            const syncPathSelection = (id) => {
                const normalizedId = String(id || '').trim();
                if (!normalizedId) return;
                const lastId = sweepPath.length ? sweepPath[sweepPath.length - 1] : '';
                if (lastId === normalizedId) return;
                const existingIndex = sweepPath.lastIndexOf(normalizedId);
                if (existingIndex >= 0) {
                    while ((sweepPath.length - 1) > existingIndex) {
                        const removedId = String(sweepPath.pop() || '').trim();
                        if (!removedId) continue;
                        revertSelection(removedId);
                    }
                    return;
                }
                sweepPath.push(normalizedId);
                applySelection(normalizedId);
            };

            const sweepAtPoint = (x, y) => {
                const hit = __tmResolveMultiSelectRowFromPoint(x, y);
                if (!hit) return;
                syncPathSelection(hit.taskId);
            };

            const startSweep = () => {
                if (sweeping || ended) return;
                sweeping = true;
                capturePointer();
                syncPathSelection(taskId);
                try { sourceEl.classList.add('tm-task-row--multi-sweeping'); } catch (e) {}
                try {
                    document.body.style.userSelect = 'none';
                    document.body.style.cursor = 'crosshair';
                } catch (e) {}
            };

            const cleanup = (suppressClick) => {
                if (ended) return;
                ended = true;
                try { globalThis.__tmRuntimeEvents?.off?.(document, 'pointermove', onMove, true); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(document, 'pointerup', onUp, true); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(document, 'pointercancel', onUp, true); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(window, 'blur', onUp, true); } catch (e) {}
                if (captured && Number.isFinite(pointerId) && typeof sourceEl.releasePointerCapture === 'function') {
                    try { sourceEl.releasePointerCapture(pointerId); } catch (e) {}
                }
                try { sourceEl.classList.remove('tm-task-row--multi-sweeping'); } catch (e) {}
                try {
                    document.body.style.userSelect = '';
                    document.body.style.cursor = '';
                } catch (e) {}
                if (suppressClick) {
                    __tmSuppressDockPointerTaskClick(suppressClickMs);
                }
                if (state.multiSelectPointerGestureCleanup === cleanup) {
                    state.multiSelectPointerGestureCleanup = null;
                }
            };

            const onMove = (e2) => {
                if (ended || !samePointer(e2)) return;
                lastX = Number(e2?.clientX) || lastX;
                lastY = Number(e2?.clientY) || lastY;
                if (!sweeping) {
                    const dx = lastX - startX;
                    const dy = lastY - startY;
                    if ((dx * dx + dy * dy) < (threshold * threshold)) return;
                    startSweep();
                }
                sweepAtPoint(lastX, lastY);
                try { e2.preventDefault(); } catch (e) {}
            };

            const onUp = (e2) => {
                if (ended || !samePointer(e2)) return;
                if (sweeping) {
                    lastX = Number(e2?.clientX) || lastX;
                    lastY = Number(e2?.clientY) || lastY;
                    sweepAtPoint(lastX, lastY);
                }
                cleanup(sweeping);
            };

            state.multiSelectPointerGestureCleanup = () => cleanup(false);
            try { globalThis.__tmRuntimeEvents?.on?.(document, 'pointermove', onMove, true); } catch (e) {}
            try { globalThis.__tmRuntimeEvents?.on?.(document, 'pointerup', onUp, true); } catch (e) {}
            try { globalThis.__tmRuntimeEvents?.on?.(document, 'pointercancel', onUp, true); } catch (e) {}
            try { globalThis.__tmRuntimeEvents?.on?.(window, 'blur', onUp, true); } catch (e) {}
        }, { capture: true, signal: abort.signal });
    }

    function __tmGetKeepaliveSnapshotKind(el) {
        if (__tmIsDockRootElement(el)) return 'dock';
        if (__tmIsTabRootElement(el)) return 'tab';
        return '';
    }

    function __tmClearKeepaliveSnapshots(root) {
        if (!(root instanceof Element)) return;
        try {
            root.querySelectorAll('[data-task-horizon-dock-snapshot="1"]').forEach((el) => {
                try { el.remove(); } catch (e) {}
            });
        } catch (e) {}
    }

    function __tmBindKeepaliveSnapshotRestore(snapshot, root) {
        if (!(snapshot instanceof HTMLElement) || !(root instanceof HTMLElement)) return;
        try {
            snapshot.addEventListener('click', (ev) => {
                try { ev?.preventDefault?.(); } catch (e) {}
                try { ev?.stopPropagation?.(); } catch (e) {}
                try { __tmClearKeepaliveSnapshots(root); } catch (e) {}
                try {
                    if (typeof globalThis.__taskHorizonMount === 'function') {
                        globalThis.__taskHorizonMount(root);
                    }
                } catch (e) {}
            });
        } catch (e) {}
    }

    function __tmCreateKeepaliveSnapshot(sourceEl, kind = 'dock') {
        if (!(sourceEl instanceof HTMLElement)) return null;
        try {
            const snapshot = sourceEl.cloneNode(true);
            snapshot.setAttribute('data-task-horizon-dock-snapshot', '1');
            snapshot.setAttribute('data-task-horizon-snapshot-kind', kind === 'tab' ? 'tab' : 'dock');
            snapshot.setAttribute('aria-hidden', 'true');
            try { snapshot.classList.add('tm-modal--dock-snapshot'); } catch (e) {}
            try {
                const computed = getComputedStyle(sourceEl);
                const freezeVars = [
                    '--tm-font-size',
                    '--tm-row-height',
                    '--tm-row-height-scale',
                    '--tm-row-height-offset',
                    '--tm-row-height-min',
                    '--tm-row-height-max',
                    '--tm-task-content-wrap-lines',
                    '--tm-task-remark-wrap-lines',
                ];
                freezeVars.forEach((name) => {
                    const value = String(computed.getPropertyValue(name) || '').trim();
                    if (!value) return;
                    try { snapshot.style.setProperty(name, value); } catch (e) {}
                });
                try { snapshot.style.fontFamily = computed.fontFamily; } catch (e) {}
                try { snapshot.style.fontSize = computed.fontSize; } catch (e) {}
                try { snapshot.style.fontWeight = computed.fontWeight; } catch (e) {}
                try { snapshot.style.fontStyle = computed.fontStyle; } catch (e) {}
                try { snapshot.style.lineHeight = computed.lineHeight; } catch (e) {}
                try { snapshot.style.letterSpacing = computed.letterSpacing; } catch (e) {}
                try { snapshot.style.fontFeatureSettings = computed.fontFeatureSettings; } catch (e) {}
                try { snapshot.style.fontVariationSettings = computed.fontVariationSettings; } catch (e) {}
                try { snapshot.style.fontVariantNumeric = computed.fontVariantNumeric; } catch (e) {}
            } catch (e) {}
            if (kind === 'tab') {
                try {
                    snapshot.style.position = 'relative';
                    snapshot.style.top = 'auto';
                    snapshot.style.left = 'auto';
                    snapshot.style.width = '100%';
                    snapshot.style.height = '100%';
                    snapshot.style.background = 'transparent';
                    snapshot.style.zIndex = '0';
                    snapshot.style.overflow = 'hidden';
                } catch (e) {}
                try {
                    const box = snapshot.querySelector('.tm-box');
                    if (box instanceof HTMLElement) {
                        box.style.width = '100%';
                        box.style.height = '100%';
                        box.style.maxWidth = 'none';
                        box.style.maxHeight = 'none';
                        box.style.borderRadius = '0';
                    }
                } catch (e) {}
                try {
                    const body = snapshot.querySelector('.tm-body');
                    if (body instanceof HTMLElement) {
                        body.style.maxHeight = 'none';
                    }
                } catch (e) {}
            }
            try {
                if (snapshot.hasAttribute('id')) snapshot.removeAttribute('id');
            } catch (e) {}
            try {
                snapshot.querySelectorAll('[id]').forEach((el) => {
                    try { el.removeAttribute('id'); } catch (e2) {}
                });
            } catch (e) {}
            try {
                snapshot.querySelectorAll('*').forEach((el) => {
                    Array.from(el.attributes || []).forEach((attr) => {
                        if (!attr?.name || !/^on/i.test(attr.name)) return;
                        try { el.removeAttribute(attr.name); } catch (e2) {}
                    });
                    try {
                        if (el instanceof HTMLElement) {
                            el.removeAttribute('contenteditable');
                            el.setAttribute('tabindex', '-1');
                        }
                    } catch (e2) {}
                });
            } catch (e) {}
            return snapshot;
        } catch (e) {
            return null;
        }
    }

    // ===== 全局清理句柄 =====
    let __tmGlobalClickHandler = null;
    let __tmDomReadyHandler = null;
    let __tmBreadcrumbObserver = null;
    let __tmBreadcrumbBtnEl = null;
    let __tmThemeModeObserver = null;
    let __tmTopBarTimer = null;
    let __tmShellEntrancesRefreshRaf = null;
    let __tmMountRetryTimer = null;
    let __tmTopBarAdded = false;
    let __tmTopBarEl = null;
    let __tmTopBarClickCaptureHandler = null;
    let __tmTopBarDocumentCaptureHandler = null;
    let __tmTopBarClickInFlight = false;
    let __tmTomatoTimerHooked = false;
    let __tmTomatoOriginalTimerFns = null;
    let __tmTomatoAssociationListenerAdded = false;
    let __tmTomatoAssociationHandler = null;
    let __tmTomatoFocusModeChangedHandler = null;
    let __tmPinnedListenerAdded = false;
    let __tmQuickAddGlobalClickHandler = null;
    let __tmCalendarScheduleUpdatedHandler = null;
    let __tmTodayScheduleRefreshTimer = null;
    let __tmCalendarBootstrapRetryTimer = null;
    let __tmQuickbarTaskUpdateHandler = null;
    let __tmQuickbarRelayStorageHandler = null;
    let __tmQuickbarRelayPollTimer = null;
    const __tmQuickbarRelayLastTokenByKey = new Map();
    let __tmEditorTitleIconMenuHandler = null;
    let __tmContentMenuHandler = null;
    const __TM_MOBILE_TOPBAR_REGISTERED_KEY = '__taskHorizonMobileTopBarRegistered';
    let __tmDocTreeMenuHandler = null;
    let __tmBlockIconMenuHandler = null;
    let __tmDocMenuObserver = null;
    let __tmNativeDocCheckboxSyncClickHandler = null;
    let __tmNativeDocCheckboxSyncObserver = null;
    const __tmNativeDocCheckboxReconcileTimers = new Map();
    const __tmNativeDocCheckboxReconcileVersions = new Map();
    const __tmNativeDocCheckboxSyncIgnoreMap = new Map();
    const __tmNativeDocCheckboxSyncQueue = [];
    let __tmNativeDocCheckboxSyncQueueRunning = false;
    const __tmNativeDocCheckboxPendingBatch = new Map();
    let __tmNativeDocCheckboxBatchTimer = null;
    let __tmNativeDocCheckboxBatchSeq = 0;
    let __tmLastRightClickedTitleProtyle = null;
    let __tmLastRightClickedTitleAtMs = 0;
    let __tmLastRightClickedBlockEl = null;
    let __tmLastRightClickedBlockId = '';
    let __tmLastRightClickedBlockAtMs = 0;
    let __tmNativeDocMenuCaptureHandler = null;
    let __tmDocMenuEventBus = null;
    const __TM_TIMELINE_TODAY_REFRESH_MS = 5 * 60 * 1000;

    async function __tmSafeOpenManager(reason) {
        try {
            await openManager({ preserveViewMode: true });
        } catch (e) {
            try { console.error(`[OpenManager:${String(reason || '')}]`, e); } catch (e2) {}
            try { hint(`❌ 加载失败: ${e?.message || String(e)}`, 'error'); } catch (e3) {}
        }
    }

    let __tmSettingsEnsurePromise = null;
    let __tmFilterRulesEnsurePromise = null;

    async function __tmEnsureSettingsLoaded(force = false) {
        if (!force && SettingsStore.loaded) return SettingsStore.data;
        if (!force && __tmSettingsEnsurePromise) return await __tmSettingsEnsurePromise;
        const task = Promise.resolve().then(async () => {
            await SettingsStore.load();
            return SettingsStore.data;
        }).finally(() => {
            __tmSettingsEnsurePromise = null;
        });
        __tmSettingsEnsurePromise = task;
        return await task;
    }

    async function __tmEnsureFilterRulesLoaded(force = false) {
        if (!force && Array.isArray(state.filterRules) && state.filterRules.length > 0) {
            return state.filterRules;
        }
        if (!force && SettingsStore.loaded && Array.isArray(SettingsStore.data.filterRules) && SettingsStore.data.filterRules.length > 0) {
            state.filterRules = SettingsStore.data.filterRules;
            return state.filterRules;
        }
        if (!force && __tmFilterRulesEnsurePromise) return await __tmFilterRulesEnsurePromise;
        const task = Promise.resolve().then(async () => {
            await __tmEnsureSettingsLoaded(force);
            const rules = await RuleManager.initRules();
            state.filterRules = Array.isArray(rules) ? rules : [];
            return state.filterRules;
        }).finally(() => {
            __tmFilterRulesEnsurePromise = null;
        });
        __tmFilterRulesEnsurePromise = task;
        return await task;
    }

    async function __tmEnsureAiRuntimeLoaded() {
        try {
            if (globalThis.__tmAI?.loaded) return true;
        } catch (e) {}
        const loader = globalThis.__taskHorizonEnsureAiModuleLoaded;
        if (typeof loader !== 'function') return !!globalThis.__tmAI?.loaded;
        try {
            const ok = await loader();
            return !!(ok && globalThis.__tmAI?.loaded);
        } catch (e) {
            return false;
        }
    }

    async function __tmEnsureHomepageRuntimeLoaded() {
        try {
            if (globalThis.__tmHomepage?.loaded) return true;
        } catch (e) {}
        const loader = globalThis.__taskHorizonEnsureHomepageModuleLoaded;
        if (typeof loader !== 'function') return !!globalThis.__tmHomepage?.loaded;
        try {
            const ok = await loader();
            return !!(ok && globalThis.__tmHomepage?.loaded);
        } catch (e) {
            return false;
        }
    }

    function __tmCollectHomepageTasks() {
        const out = [];
        const seen = new Set();
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        const pushTask = (task) => {
            if (!task || typeof task !== 'object') return;
            const taskDocId = String(task?.root_id || task?.docId || '').trim();
            if (!__tmIsOtherBlockTabId(activeDocId) && activeDocId !== 'all' && taskDocId && taskDocId !== activeDocId) return;
            const id = String(task.id || '').trim();
            if (id && seen.has(id)) return;
            if (id) seen.add(id);
            out.push(task);
        };
        const appendWalk = (items) => {
            (Array.isArray(items) ? items : []).forEach((task) => {
                if (!task || typeof task !== 'object') return;
                pushTask(task);
                if (Array.isArray(task.children) && task.children.length) appendWalk(task.children);
            });
        };
        if (__tmIsOtherBlockTabId(activeDocId)) {
            (Array.isArray(state.otherBlocks) ? state.otherBlocks : []).forEach(pushTask);
            return out;
        }
        const flatTasks = (state.flatTasks && typeof state.flatTasks === 'object')
            ? Object.values(state.flatTasks)
            : [];
        if (flatTasks.length) {
            flatTasks.forEach(pushTask);
            return out;
        }
        (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
            const docId = String(doc?.id || '').trim();
            if (activeDocId !== 'all' && docId !== activeDocId) return;
            appendWalk(doc?.tasks || []);
        });
        return out;
    }

    function __tmBuildHomepageCtx(rootEl = null) {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const currentGroup = currentGroupId === 'all' ? null : groups.find((group) => String(group?.id || '').trim() === currentGroupId);
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        const docName = activeDocId === 'all'
            ? ''
            : String((Array.isArray(state.taskTree) ? state.taskTree : []).find((doc) => String(doc?.id || '').trim() === activeDocId)?.name || '').trim();
        const currentRule = state.currentRule
            ? (Array.isArray(state.filterRules) ? state.filterRules.find((rule) => String(rule?.id || '').trim() === String(state.currentRule || '').trim()) : null)
            : null;
        const measureHost = rootEl instanceof HTMLElement
            ? (rootEl.closest('.tm-body.tm-body--homepage') || rootEl.parentElement || rootEl)
            : null;
        const measureRect = measureHost instanceof HTMLElement && typeof measureHost.getBoundingClientRect === 'function'
            ? measureHost.getBoundingClientRect()
            : null;
        const width = measureHost instanceof HTMLElement ? Math.round((measureRect?.width || measureHost.clientWidth || 0)) : 0;
        const height = measureHost instanceof HTMLElement ? Math.round((measureRect?.height || measureHost.clientHeight || 0)) : 0;
        return {
            tasks: __tmCollectHomepageTasks(),
            stats: { ...(state.stats || {}) },
            currentGroupId,
            currentGroupName: currentGroupId === 'all' ? '全部文档' : __tmResolveDocGroupName(currentGroup),
            currentRuleId: String(currentRule?.id || '').trim(),
            currentRuleName: String(currentRule?.name || '').trim(),
            currentDocId: activeDocId,
            currentDocName: docName,
            aiEnabled: __tmIsAiFeatureEnabled(),
            isDockHost: __tmIsDockHost(),
            isMobileDevice: __tmIsMobileDevice(),
            hostUsesMobileUI: __tmHostUsesMobileUI(),
            containerWidth: width,
            containerHeight: height,
            todayKey: __tmNormalizeDateOnly(new Date()),
            animateOnMount: state.__tmHomepageNextMountAnimate !== false,
            onOpenTask(taskId) {
                try { window.tmOpenTaskDetail?.(taskId); } catch (e) {}
            },
        };
    }

    let __tmHomepageRefreshTimer = 0;
    let __tmHomepageRefreshReason = '';
    let __tmHomepageMountSeq = 0;

    function __tmInvalidateHomepageMount() {
        __tmHomepageMountSeq += 1;
        return __tmHomepageMountSeq;
    }

    function __tmScheduleHomepageRefresh(reason = '', delayMs = 96) {
        const nextReason = String(reason || '').trim() || 'homepage-refresh';
        __tmHomepageRefreshReason = nextReason;
        try {
            if (__tmHomepageRefreshTimer) clearTimeout(__tmHomepageRefreshTimer);
        } catch (e) {}
        __tmHomepageRefreshTimer = setTimeout(() => {
            __tmHomepageRefreshTimer = 0;
            const currentReason = __tmHomepageRefreshReason;
            __tmHomepageRefreshReason = '';
            try { __tmPushRefreshDebug('homepage-refresh-scheduled', { reason: currentReason }); } catch (e) {}
            if (!state.homepageOpen) return;
            try { __tmRefreshHomepageInPlace().catch(() => null); } catch (e) {}
        }, Math.max(0, Number(delayMs) || 96));
        return true;
    }

    async function __tmMountHomepageRoot() {
        const root = state.modal?.querySelector?.('#tmHomepageRoot');
        if (!(root instanceof HTMLElement)) return false;
        const mountSeq = __tmInvalidateHomepageMount();
        const ready = await __tmEnsureHomepageRuntimeLoaded();
        if (mountSeq !== __tmHomepageMountSeq) return false;
        const currentRoot = state.modal?.querySelector?.('#tmHomepageRoot');
        if (!state.homepageOpen || !(currentRoot instanceof HTMLElement) || currentRoot !== root || !document.body.contains(root)) {
            return false;
        }
        if (!ready || !globalThis.__tmHomepage || typeof globalThis.__tmHomepage.mount !== 'function') {
            root.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">主页模块未加载。</div>`;
            return false;
        }
        return !!globalThis.__tmHomepage.mount(root, __tmBuildHomepageCtx(root));
    }

    async function __tmRefreshHomepageInPlace() {
        const root = state.modal?.querySelector?.('#tmHomepageRoot');
        if (!(root instanceof HTMLElement)) return false;
        if (!globalThis.__tmHomepage || typeof globalThis.__tmHomepage.update !== 'function') {
            return await __tmMountHomepageRoot();
        }
        return !!globalThis.__tmHomepage.update(__tmBuildHomepageCtx(root));
    }

    const __tmShouldLocateCurrentDocTabFromDocTopbar = () => !!SettingsStore.data.docTopbarButtonLocateCurrentDocTab;

    function __tmResolveDocTopbarSourceDocId() {
        const candidates = [];
        const seen = new Set();
        const pushProtyle = (protyle) => {
            if (!(protyle instanceof HTMLElement) || seen.has(protyle)) return;
            seen.add(protyle);
            candidates.push(protyle);
        };
        try {
            const isRecent = __tmLastRightClickedTitleProtyle
                && __tmLastRightClickedTitleProtyle.isConnected
                && (Date.now() - (Number(__tmLastRightClickedTitleAtMs) || 0) < 3000);
            if (isRecent) pushProtyle(__tmLastRightClickedTitleProtyle);
        } catch (e) {}
        try {
            if (__tmLastFocusedProtyle && __tmLastFocusedProtyle.isConnected) {
                pushProtyle(__tmLastFocusedProtyle);
            }
        } catch (e) {}
        try { pushProtyle(globalThis.__tmCompat?.findActiveProtyle?.() || null); } catch (e) {}
        try { pushProtyle(typeof __tmFindActiveProtyle === 'function' ? __tmFindActiveProtyle() : null); } catch (e) {}
        try {
            const breadcrumb = globalThis.__tmCompat?.findBreadcrumb?.() || null;
            pushProtyle(breadcrumb?.closest?.('.protyle') || null);
        } catch (e) {}
        for (const protyle of candidates) {
            try {
                const docId = String(__tmGetDocIdFromProtyle?.(protyle) || '').trim();
                if (docId) return docId;
            } catch (e) {}
        }
        return '';
    }

    async function __tmDocHasTaskBlocks(docId) {
        const did = String(docId || '').trim();
        if (!did) return false;
        try {
            const cachedDoc = (Array.isArray(state.taskTree) ? state.taskTree : [])
                .find((doc) => String(doc?.id || '').trim() === did);
            if (cachedDoc && Array.isArray(cachedDoc.tasks) && cachedDoc.tasks.length > 0) {
                return true;
            }
        } catch (e) {}
        const tasksMap = new Map();
        try { await __tmFillDocHasTasksMap([did], tasksMap); } catch (e) {}
        return tasksMap.has(did);
    }

    function __tmDoesDocTopbarGroupExplicitlyContainDocId(group, docId) {
        const did = String(docId || '').trim();
        if (!group || !did) return false;
        try {
            const excluded = new Set(__tmGetGroupExcludedDocIds(group));
            if (excluded.has(did)) return false;
        } catch (e) {}
        try {
            const entries = __tmGetGroupSourceEntries(group);
            return entries.some((entry) => String(entry?.kind || 'doc').trim() === 'doc' && String(entry?.id || '').trim() === did);
        } catch (e) {
            return false;
        }
    }

    async function __tmDoesDocTopbarGroupContainDocId(group, docId) {
        const did = String(docId || '').trim();
        const gid = String(group?.id || '').trim();
        if (!did || !gid) return { matched: false, matchedBy: '' };
        if (__tmDoesDocTopbarGroupExplicitlyContainDocId(group, did)) {
            return { matched: true, matchedBy: 'direct' };
        }
        let matched = false;
        try {
            const entries = __tmGetGroupSourceEntries(group);
            await Promise.all(entries.map((entry) => __tmExpandSourceEntryDocIds(entry, (sid) => {
                if (matched) return;
                if (String(sid || '').trim() === did) matched = true;
            })));
        } catch (e) {}
        return matched ? { matched: true, matchedBy: 'expanded' } : { matched: false, matchedBy: '' };
    }

    async function __tmResolveDocTopbarTargetGroup(docId) {
        const did = String(docId || '').trim();
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        if (!did || !groups.length) return null;
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (currentGroupId !== 'all') {
            const currentGroup = groups.find((group) => String(group?.id || '').trim() === currentGroupId);
            if (currentGroup) {
                const currentMatch = await __tmDoesDocTopbarGroupContainDocId(currentGroup, did);
                if (currentMatch.matched) {
                    return { groupId: currentGroupId, group: currentGroup, matchedBy: currentMatch.matchedBy };
                }
            }
        }
        const explicitMatches = [];
        const deferredGroups = [];
        groups.forEach((group) => {
            const gid = String(group?.id || '').trim();
            if (!gid || gid === currentGroupId) return;
            if (__tmDoesDocTopbarGroupExplicitlyContainDocId(group, did)) {
                explicitMatches.push(group);
                return;
            }
            deferredGroups.push(group);
        });
        if (explicitMatches.length > 0) {
            const group = explicitMatches[0];
            return { groupId: String(group?.id || '').trim(), group, matchedBy: 'direct' };
        }
        for (const group of deferredGroups) {
            const match = await __tmDoesDocTopbarGroupContainDocId(group, did);
            if (match.matched) {
                return { groupId: String(group?.id || '').trim(), group, matchedBy: match.matchedBy };
            }
        }
        return null;
    }

    async function __tmTryApplyDocTopbarManagerTarget() {
        if (!__tmShouldLocateCurrentDocTabFromDocTopbar()) {
            return { changed: false, reason: 'disabled' };
        }
        const docId = __tmResolveDocTopbarSourceDocId();
        if (!docId) return { changed: false, reason: 'no-doc' };
        const hasTasks = await __tmDocHasTaskBlocks(docId);
        if (!hasTasks) return { changed: false, reason: 'no-tasks', docId };
        const target = await __tmResolveDocTopbarTargetGroup(docId);
        if (!target?.groupId) return { changed: false, reason: 'group-not-found', docId };

        const prevGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const prevDocId = String(state.activeDocId || 'all').trim() || 'all';
        const nextGroupId = String(target.groupId || 'all').trim() || 'all';
        SettingsStore.data.currentGroupId = nextGroupId;
        state.activeDocId = docId;
        const changed = prevGroupId !== nextGroupId || prevDocId !== docId;
        if (changed) state.__tmForceShellRenderOnOpen = true;
        if (prevGroupId !== nextGroupId) {
            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedNoteId = '';
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
            state.whiteboardMultiSelectedTaskIds = [];
            state.whiteboardMultiSelectedNoteIds = [];
            try { await SettingsStore.save(); } catch (e) {}
        }
        try { __tmMarkContextInteractionQuiet('doc-topbar-locate-current-doc', 1600); } catch (e) {}
        return {
            changed,
            reason: 'matched',
            docId,
            groupId: nextGroupId,
            matchedBy: String(target.matchedBy || '').trim(),
        };
    }

    async function __tmOpenManagerFromDocTopbarEntry() {
        try {
            await __tmTryApplyDocTopbarManagerTarget();
        } catch (e) {
            try { console.warn('[task-horizon] doc topbar locate current doc failed', e); } catch (e2) {}
        }
        return __tmOpenManagerFromTopbarEntry();
    }

    function __tmOpenManagerFromTopbarEntry() {
        try {
            const suppressUntil = Number(globalThis.__taskHorizonSuppressMobileTopbarOpenUntil || 0);
            if (suppressUntil > Date.now()) return false;
        } catch (e) {}
        const options = { preserveViewMode: true };
        try {
            if (!__tmIsRuntimeMobileClient()) options.forceOpenTab = true;
        } catch (e) {
            options.forceOpenTab = true;
        }
        return openManager(options);
    }

    function __tmFindMobileTopBarTriggerFromEventTarget(target) {
        let el = target instanceof Element ? target : null;
        let depth = 0;
        while (el && depth < 8) {
            if (el.closest?.('.tm-modal')) return null;
            if (__tmTopBarEl instanceof Element && (__tmTopBarEl === el || __tmTopBarEl.contains?.(el))) return __tmTopBarEl;
            if (__tmIsManagedTopBarEntry(el)) return el;
            el = el.parentElement;
            depth += 1;
        }
        try {
            const targetEl = target instanceof Element ? target : null;
            if (!targetEl) return null;
            const entries = __tmGetTopBarEntries();
            return entries.find((entry) => entry instanceof Element && (entry === targetEl || entry.contains?.(targetEl))) || null;
        } catch (e) {}
        return null;
    }

    function __tmBindMobileTopBarDocumentCapture() {
        if (!__tmIsMobileTopBarRegistrationHost()) return;
        if (__tmTopBarDocumentCaptureHandler) return;
        __tmTopBarDocumentCaptureHandler = (e) => {
            if (__tmTopBarClickInFlight) return;
            try {
                const suppressUntil = Number(globalThis.__taskHorizonSuppressMobileTopbarOpenUntil || 0);
                if (suppressUntil > Date.now()) return;
            } catch (e2) {}
            const trigger = __tmFindMobileTopBarTriggerFromEventTarget(e?.target);
            if (!trigger) return;
            __tmTopBarClickInFlight = true;
            try {
                try { e.preventDefault?.(); } catch (e2) {}
                try { e.stopImmediatePropagation?.(); } catch (e2) {}
                try { e.stopPropagation?.(); } catch (e2) {}
                try { __tmOpenManagerFromTopbarEntry(); } catch (e2) {}
            } finally {
                setTimeout(() => { __tmTopBarClickInFlight = false; }, 0);
            }
        };
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'click', __tmTopBarDocumentCaptureHandler, true); } catch (e) {}
    }

function __tmScheduleWakeReload(reason) {
    try { if (__tmWakeReloadTimer) clearTimeout(__tmWakeReloadTimer); } catch (e) {}
    __tmWakeReloadTimer = setTimeout(() => {
        __tmWakeReloadTimer = null;
        // 只刷新数据，不自动打开管理器
        __tmRefreshAfterWake(reason).catch(() => {});
    }, 350);
}

function __tmBuildCalendarWakeTaskSignature() {
    try {
        const flat = state && state.flatTasks && typeof state.flatTasks === 'object' ? state.flatTasks : {};
        const keys = Object.keys(flat).sort();
        const parts = [];
        for (const id of keys) {
            const t = flat[id];
            if (!t || typeof t !== 'object') continue;
            const tid = String(t.id || id || '').trim();
            if (!tid) continue;
            parts.push([
                tid,
                t.done ? '1' : '0',
                String(t.startDate || ''),
                String(t.completionTime || ''),
                String(t.updated || ''),
                String(t.content || '')
            ].join('|'));
        }
        return parts.join('||');
    } catch (e) {
        return '';
    }
}

// 新增：后台唤醒后只刷新数据，不自动跳转
async function __tmRefreshAfterWake(reason) {
    if (__tmWakeReloadInFlight) return;
    __tmWakeReloadInFlight = true;
    try {
        if (document.visibilityState === 'hidden') return;

        // 只有在管理器已经打开的情况下才刷新
        if (!state.modal || !document.body.contains(state.modal)) {
            return;
        }

        const best = __tmFindBestTabRoot();
        if (!best) return;

        try { globalThis.__taskHorizonTabElement = best; } catch (e) {}
        __tmSetMount(best);
        __tmEnsureMount();
        if (!__tmMountEl) return;
        const isCalendarView = String(state.viewMode || '').trim() === 'calendar';
        const prevCalendarSig = isCalendarView ? __tmBuildCalendarWakeTaskSignature() : '';

        // 静默刷新数据，不显示加载提示
        try {
            await loadSelectedDocuments({ skipRender: true });
        } catch (e) {}

        try {
            await __tmEnsureSettingsLoaded();
            try { await __tmSyncRemoteCollapsedSessionStateIfNeeded(); } catch (e2) {}
            try {
                if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.setSettingsStore === 'function') {
                    globalThis.__tmCalendar.setSettingsStore(SettingsStore);
                }
            } catch (e2) {}
            const isMobileDevice = __tmIsMobileDevice();
            const current = String(state.viewMode || '').trim();
            SettingsStore.data.enabledViews = __tmNormalizeEnabledViews(SettingsStore.data.enabledViews);
            SettingsStore.data.defaultViewMode = __tmGetSafeViewMode(SettingsStore.data.defaultViewMode);
            SettingsStore.data.defaultViewModeMobile = __tmGetSafeViewMode(SettingsStore.data.defaultViewModeMobile || SettingsStore.data.defaultViewMode);
            const currentSafe = __tmGetSafeViewMode(current);
            if (current !== currentSafe) {
                state.viewMode = __tmGetConfiguredDefaultViewMode(isMobileDevice);
            }
            if (String(state.viewMode || '').trim() === 'calendar' && globalThis.__tmCalendar && (typeof globalThis.__tmCalendar.requestRefresh === 'function' || typeof globalThis.__tmCalendar.refreshInPlace === 'function')) {
                const nextCalendarSig = __tmBuildCalendarWakeTaskSignature();
                const changed = prevCalendarSig !== nextCalendarSig;
                if (changed) {
                    try {
                        __tmRequestCalendarRefresh({
                            reason: 'wake-calendar-data',
                            main: true,
                            side: true,
                            flushTaskPanel: true,
                            hard: true,
                        }, { hard: true });
                    } catch (e2) {}
                } else {
                    try {
                        __tmRequestCalendarRefresh({
                            reason: 'wake-calendar-layout',
                            main: true,
                            side: true,
                            flushTaskPanel: true,
                            layoutOnly: true,
                            hard: true,
                        }, { layoutOnly: true, hard: true });
                    } catch (e2) {}
                }
            } else {
                try {
                    __tmRerenderCurrentViewInPlace(state.modal);
                } catch (e2) {}
            }
        } catch (e) {}

    } finally {
        __tmWakeReloadInFlight = false;
    }
}


    function __tmBindWakeReload() {
        if (__tmWakeReloadBound) return;
        __tmWakeReloadBound = true;

        // 检查插件页面是否正在显示
        const isPluginVisible = () => {
            // 首先检查 state.modal 是否存在且已添加到 DOM
            if (!state.modal || !document.body.contains(state.modal)) {
                return false;
            }

            // 检查弹窗是否可见（display 不为 none，opacity 大于 0）
            const style = window.getComputedStyle(state.modal);
            if (style.display === 'none' || style.opacity === '0') {
                return false;
            }

            // 关键：检查插件是否在当前激活的思源窗口中
            // 思源使用 .layout__wnd--active 标记当前激活的窗口
            const activeWindow = globalThis.__tmCompat?.findActiveWindow?.() || null;
            if (activeWindow) {
                // 检查插件的挂载元素是否在活动窗口中
                const mountEl = __tmGetMountRoot();
                if (mountEl && mountEl !== document.body && activeWindow.contains(mountEl)) {
                    return true;
                }
                // 也检查 modal 元素是否在活动窗口中
                if (activeWindow.contains(state.modal)) {
                    return true;
                }
            }

            // 如果没有找到活动窗口（可能是在移动端或其他特殊布局），则回退到原来的检查
            return true;
        };

        __tmVisibilityHandler = async () => {
            try {
                if (document.visibilityState === 'hidden') {
                    __tmWasHiddenAt = Date.now();
                    // 标记页面曾被隐藏，用于下次打开时跳过加载提示
                    state.wasHidden = true;
                    // 记录最小化前插件页面是否正在显示
                    __tmWasPluginVisibleBeforeHide = isPluginVisible();
                    return;
                }

                // 只有当最小化前插件页面正在显示时才继续处理
                if (!__tmWasPluginVisibleBeforeHide) {
                    return;
                }

                if (__tmHasAutoRefreshPendingSync()) {
                    await __tmRunAutoRefreshIfNeeded('visibilitychange');
                } else if (state.modal && document.body.contains(state.modal)) {
                    const syncedCollapsed = await __tmSyncRemoteCollapsedSessionStateIfNeeded({ rerender: true });
                    if (!syncedCollapsed) {
                        try { __tmScheduleReminderTaskNameMarksRefresh(state.modal, true); } catch (e) {}
                    }
                }
			} catch (e) {}
		};
		__tmFocusHandler = async () => {
			try {
                if (__tmWasPluginVisibleBeforeHide && __tmHasAutoRefreshPendingSync()) {
                    await __tmRunAutoRefreshIfNeeded('focus');
                } else if (state.modal && document.body.contains(state.modal)) {
                    const syncedCollapsed = await __tmSyncRemoteCollapsedSessionStateIfNeeded({ rerender: true });
                    if (!syncedCollapsed) {
                        try { __tmScheduleReminderTaskNameMarksRefresh(state.modal, true); } catch (e) {}
                    }
                }
            } catch (e) {}
        };
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'visibilitychange', __tmVisibilityHandler); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(window, 'focus', __tmFocusHandler); } catch (e) {}
    }

    let __tmOriginalCenterSwitchTab = null;
    let __tmTabEnterAutoRefreshBound = false;
    let __tmTabEnterAutoRefreshInFlight = false;
    let __tmTabEnterAutoRefreshLastTs = 0;
    let __tmTabEnterAutoRefreshTimer = null;
    let __tmTabEnterAutoRefreshTryCount = 0;
    let __tmTabHeaderAutoRefreshHandler = null;
    let __tmTabActivationObserver = null;
    let __tmTabActivationObserverTimer = 0;
    let __tmTaskHorizonTabWasActive = false;

    function __tmParseQuickbarRelayStorageEntry(raw) {
        const text = String(raw || '').trim();
        if (!text) return null;
        try {
            const parsed = JSON.parse(text);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function __tmBuildQuickbarRelayToken(relay, relayDetail = null) {
        const detail = (relayDetail && typeof relayDetail === 'object' && !Array.isArray(relayDetail)) ? relayDetail : {};
        return [
            String(relay?.kind || '').trim(),
            String(relay?.source || '').trim(),
            String(relay?.time || '').trim(),
            Number(relay?.seq || 0) || 0,
            String(detail.channel || detail.taskId || '').trim(),
            String(detail.tag || detail.attrKey || '').trim(),
            String(detail.attrHostId || '').trim(),
        ].join('|');
    }

    function __tmHandleQuickbarDebugRelayEntry(relay, relayDetail, transport = 'storage') {
        const detail = (relayDetail && typeof relayDetail === 'object' && !Array.isArray(relayDetail)) ? relayDetail : null;
        const channel = String(detail?.channel || '').trim();
        const tag = String(detail?.tag || '').trim();
        if (!channel || !tag) return false;
        const relayPayload = (detail?.payload && typeof detail.payload === 'object' && !Array.isArray(detail.payload))
            ? { ...detail.payload }
            : {};
        relayPayload.relayTransport = String(transport || '').trim() || 'storage';
        relayPayload.relaySource = String(relay?.source || 'quickbar').trim() || 'quickbar';
        relayPayload.relaySeq = Number(relay?.seq || 0) || 0;
        relayPayload.relayTime = String(relay?.time || '').trim();
        __tmPushDebugChannel(channel, tag, relayPayload);
        return true;
    }

    function __tmHandleQuickbarAttrRelayEntry(relay, relayDetail, transport = 'storage') {
        const detail = (relayDetail && typeof relayDetail === 'object' && !Array.isArray(relayDetail)) ? relayDetail : null;
        const relayTaskId = String(detail?.taskId || '').trim();
        const relayAttrHostId = String(detail?.attrHostId || '').trim();
        const relayAttrKey = String(detail?.attrKey || '').trim();
        if (!relayTaskId || typeof __tmQuickbarTaskUpdateHandler !== 'function') return false;
        __tmQuickbarTaskUpdateHandler({
            detail: {
                ...detail,
                __relayTransport: String(transport || '').trim() || 'storage',
                __relaySource: String(relay?.source || 'quickbar').trim() || 'quickbar',
                __relaySeq: Number(relay?.seq || 0) || 0,
                __relayTime: String(relay?.time || '').trim(),
            }
        });
        try {
            globalThis.__taskHorizonMarkModified?.(relayTaskId);
            __tmPushRefreshDebug('quickbar-auto-update:relay-mark-modified', {
                taskId: relayTaskId,
                attrHostId: relayAttrHostId,
                attrKey: relayAttrKey,
                relayTransport: String(transport || '').trim() || 'storage',
                relaySeq: Number(relay?.seq || 0) || 0,
                relayTime: String(relay?.time || '').trim(),
            });
        } catch (e2) {}
        try {
            __tmPushRefreshDebug('quickbar-auto-update:relay-refresh-scheduled', {
                taskId: relayTaskId,
                attrHostId: relayAttrHostId,
                attrKey: relayAttrKey,
                relayTransport: String(transport || '').trim() || 'storage',
                relaySeq: Number(relay?.seq || 0) || 0,
                relayTime: String(relay?.time || '').trim(),
            });
        } catch (e2) {}
        setTimeout(() => {
            try {
                __tmPushRefreshDebug('quickbar-auto-update:relay-refresh-fire', {
                    taskId: relayTaskId,
                    attrHostId: relayAttrHostId,
                    attrKey: relayAttrKey,
                    relayTransport: String(transport || '').trim() || 'storage',
                    relaySeq: Number(relay?.seq || 0) || 0,
                    relayTime: String(relay?.time || '').trim(),
                });
            } catch (e2) {}
            try { globalThis.__taskHorizonRefresh?.(); } catch (e2) {}
        }, 0);
        return true;
    }

    function __tmConsumeQuickbarRelayStorageEntry(storageKey, rawValue, transport = 'storage') {
        const key = String(storageKey || '').trim();
        if (!key || !String(rawValue || '').trim()) return false;
        if (key !== __TM_TASK_HORIZON_DEBUG_RELAY_STORAGE_KEY && key !== __TM_TASK_HORIZON_ATTR_RELAY_STORAGE_KEY) return false;
        const relay = __tmParseQuickbarRelayStorageEntry(rawValue);
        const relayDetail = (relay?.detail && typeof relay.detail === 'object' && !Array.isArray(relay.detail))
            ? relay.detail
            : null;
        if (!relay || !relayDetail) return false;
        const token = __tmBuildQuickbarRelayToken(relay, relayDetail);
        if (!token) return false;
        if (__tmQuickbarRelayLastTokenByKey.get(key) === token) return false;
        __tmQuickbarRelayLastTokenByKey.set(key, token);
        if (key === __TM_TASK_HORIZON_DEBUG_RELAY_STORAGE_KEY) {
            return __tmHandleQuickbarDebugRelayEntry(relay, relayDetail, transport);
        }
        return __tmHandleQuickbarAttrRelayEntry(relay, relayDetail, transport);
    }

    function __tmPollQuickbarRelayStorage() {
        try {
            __tmConsumeQuickbarRelayStorageEntry(
                __TM_TASK_HORIZON_DEBUG_RELAY_STORAGE_KEY,
                localStorage.getItem(__TM_TASK_HORIZON_DEBUG_RELAY_STORAGE_KEY),
                'poll'
            );
        } catch (e) {}
        try {
            __tmConsumeQuickbarRelayStorageEntry(
                __TM_TASK_HORIZON_ATTR_RELAY_STORAGE_KEY,
                localStorage.getItem(__TM_TASK_HORIZON_ATTR_RELAY_STORAGE_KEY),
                'poll'
            );
        } catch (e) {}
    }

    function __tmHasQuickbarModificationsSync() {
        __tmLoadQuickbarModifiedTasksFromStorage(true);
        let has = false;
        try {
            has = !!(state.quickbarModifiedTaskIds && state.quickbarModifiedTaskIds.size > 0);
        } catch (e) {
            has = false;
        }
        return has;
    }

    function __tmLoadQuickbarModifiedTasksFromStorage(force = false) {
        if (!force && state.quickbarModifiedTaskIdsLoaded) return state.quickbarModifiedTaskIds;
        state.quickbarModifiedTaskIdsLoaded = true;
        try { state.quickbarModifiedTaskIds?.clear?.(); } catch (e) {}
        try {
            const stored = JSON.parse(localStorage.getItem('__tmQuickbarModifiedTasks') || '[]');
            if (Array.isArray(stored) && stored.length > 0) {
                stored.forEach((taskId) => {
                    const id = String(taskId || '').trim();
                    if (id) state.quickbarModifiedTaskIds.add(id);
                });
                if (state.quickbarModifiedTaskIds.size > 0) {
                    state.lastQuickbarUpdateTime = Date.now();
                }
            }
        } catch (ex) {}
        return state.quickbarModifiedTaskIds;
    }

    function __tmPersistQuickbarModifiedTasksToStorage() {
        try {
            const ids = Array.from(state.quickbarModifiedTaskIds || [])
                .map((taskId) => String(taskId || '').trim())
                .filter(Boolean);
            if (ids.length > 0) localStorage.setItem('__tmQuickbarModifiedTasks', JSON.stringify(ids));
            else localStorage.removeItem('__tmQuickbarModifiedTasks');
        } catch (ex) {}
    }

    function __tmMarkQuickbarModifiedTask(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return false;
        const taskIds = __tmLoadQuickbarModifiedTasksFromStorage();
        const prevSize = Number(taskIds?.size) || 0;
        try { taskIds.add(id); } catch (e) { return false; }
        if ((Number(taskIds?.size) || 0) !== prevSize) {
            __tmPersistQuickbarModifiedTasksToStorage();
        }
        state.lastQuickbarUpdateTime = Date.now();
        return true;
    }

    function __tmClearQuickbarModifications() {
        try { state.quickbarModifiedTaskIds && state.quickbarModifiedTaskIds.clear(); } catch (e) {}
        state.quickbarModifiedTaskIdsLoaded = true;
        try { localStorage.removeItem('__tmQuickbarModifiedTasks'); } catch (ex) {}
    }

    function __tmHasExternalTaskTxDirtySync() {
        return state.externalTaskTxDirty === true;
    }

    function __tmClearExternalTaskTxDirty() {
        state.externalTaskTxDirty = false;
        state.lastExternalTaskTxTime = 0;
    }

    function __tmMarkExternalTaskTxDirty() {
        state.externalTaskTxDirty = true;
        state.lastExternalTaskTxTime = Date.now();
    }

    function __tmHasAutoRefreshPendingSync() {
        return __tmHasQuickbarModificationsSync() || __tmHasExternalTaskTxDirtySync();
    }

    function __tmGetTxRefreshRetryMeta(source = 'ws-main') {
        const sourceLabel = String(source || '').trim() || 'ws-main';
        const gateMeta = __tmGetBackgroundRefreshGateMeta(sourceLabel);
        if (!gateMeta.allowRun) {
            return {
                allowRun: false,
                parkUntilVisible: gateMeta.parkUntilVisible === true,
                parkUntilScrollIdle: gateMeta.parkUntilScrollIdle === true,
                reason: String(gateMeta.reason || '').trim() || 'deferred',
                waitMs: Math.max(180, Number(gateMeta.waitMs || 0) || 180),
                source: sourceLabel,
            };
        }
        const detailBarrier = __tmGetBusyTaskDetailBarrier();
        if (detailBarrier) {
            return {
                allowRun: false,
                parkUntilVisible: false,
                parkUntilScrollIdle: false,
                reason: 'detail-busy',
                waitMs: Math.max(180, Number(detailBarrier.waitMs || 0) || 180),
                source: sourceLabel,
            };
        }
        if (__tmTabEnterAutoRefreshInFlight) {
            return {
                allowRun: false,
                parkUntilVisible: false,
                parkUntilScrollIdle: false,
                reason: 'auto-refresh-in-flight',
                waitMs: 220,
                source: sourceLabel,
            };
        }
        const throttleLeft = 1200 - (Date.now() - (Number(__tmTabEnterAutoRefreshLastTs) || 0));
        if (throttleLeft > 0) {
            return {
                allowRun: false,
                parkUntilVisible: false,
                parkUntilScrollIdle: false,
                reason: 'auto-refresh-throttled',
                waitMs: Math.max(220, throttleLeft + 48),
                source: sourceLabel,
            };
        }
        return {
            allowRun: true,
            parkUntilVisible: false,
            parkUntilScrollIdle: false,
            reason: '',
            waitMs: 0,
            source: sourceLabel,
        };
    }

    async function __tmRunAutoRefreshIfNeeded(source, options = {}) {
        const force = options?.force === true;
        const sourceLabel = String(source || '').trim() || 'unknown';
        if (!__tmIsPluginVisibleNow()) {
            try { __tmPushRefreshDebug('auto-refresh:skip', { source: sourceLabel, reason: 'plugin-hidden', force }); } catch (e) {}
            return false;
        }
        if (!force && !__tmHasAutoRefreshPendingSync()) {
            try { __tmPushRefreshDebug('auto-refresh:skip', { source: sourceLabel, reason: 'no-pending-dirty', force }); } catch (e) {}
            return false;
        }
        if (options?.deferIfDetailBusy !== false) {
            const barrier = __tmGetBusyTaskDetailBarrier();
            if (barrier) {
                try {
                    __tmPushDetailDebug('detail-host-auto-refresh-deferred', {
                        source: sourceLabel,
                        force,
                        barrier: barrier.entries.map((entry) => ({
                            scope: entry.scope,
                            taskId: entry.taskId,
                            reasons: entry.reasons.slice(),
                            holdMsLeft: entry.holdMsLeft,
                        })),
                    });
                } catch (e) {}
                try { __tmPushRefreshDebug('auto-refresh:skip', { source: sourceLabel, reason: 'detail-busy', force }); } catch (e) {}
                return false;
            }
        }
        if (options?.ignoreContextQuiet !== true) {
            const delayMeta = __tmGetEnterAutoRefreshDelayMeta(sourceLabel);
            if (delayMeta.shouldDelay) {
                try {
                    __tmPushRefreshDebug('auto-refresh:skip', {
                        source: sourceLabel,
                        reason: delayMeta.reason || 'context-quiet',
                        force,
                        waitMs: Number(delayMeta.waitMs || 0),
                    });
                } catch (e) {}
                return false;
            }
        }
        const now = Date.now();
        if (__tmTabEnterAutoRefreshInFlight) {
            try { __tmPushRefreshDebug('auto-refresh:skip', { source: sourceLabel, reason: 'in-flight', force }); } catch (e) {}
            return false;
        }
        if (now - (Number(__tmTabEnterAutoRefreshLastTs) || 0) < 1200) {
            try { __tmPushRefreshDebug('auto-refresh:skip', { source: sourceLabel, reason: 'throttled', force }); } catch (e) {}
            return false;
        }
        const hadQuickbarDirty = __tmHasQuickbarModificationsSync();
        const hadExternalDirty = __tmHasExternalTaskTxDirtySync();
        const pendingTargets = {
            docIds: Array.isArray(options?.affectedDocIds) ? options.affectedDocIds.slice() : Array.from(__tmTxTaskRefreshDocIds),
            blockIds: Array.isArray(options?.affectedBlockIds) ? options.affectedBlockIds.slice() : Array.from(__tmTxTaskRefreshBlockIds),
        };
        __tmTabEnterAutoRefreshLastTs = now;
        __tmTabEnterAutoRefreshInFlight = true;
        const startedAt = __tmPerfNow();
        try {
            __tmPushRefreshDebug('auto-refresh:start', {
                source: sourceLabel,
                force,
                hadQuickbarDirty,
                hadExternalDirty,
                docCount: pendingTargets.docIds.length,
                blockCount: pendingTargets.blockIds.length,
            });
        } catch (e) {}
        try {
            await new Promise((resolve) => setTimeout(resolve, hadQuickbarDirty ? 200 : 80));
            const lateGateMeta = __tmGetBackgroundRefreshGateMeta(sourceLabel, {
                ignoreContextQuiet: options?.ignoreContextQuiet === true,
            });
            if (!lateGateMeta.allowRun) {
                try {
                    __tmPushRefreshDebug('auto-refresh:skip', {
                        source: sourceLabel,
                        reason: lateGateMeta.reason || 'deferred',
                        force,
                        waitMs: Number(lateGateMeta.waitMs || 0),
                        lateCheck: true,
                        parked: lateGateMeta.parkUntilVisible === true,
                    });
                } catch (e) {}
                return false;
            }
            if (!hadQuickbarDirty && hadExternalDirty) {
                try {
                    const incrementalOk = await __tmRefreshAffectedDocsIncrementally({
                        docIds: pendingTargets.docIds,
                        blockIds: pendingTargets.blockIds,
                        withFilters: true,
                        reason: `auto:${sourceLabel}:incremental`,
                        deferIfDetailBusy: options?.deferIfDetailBusy !== false,
                    });
                    if (incrementalOk) {
                        __tmClearExternalTaskTxDirty();
                        __tmClearPendingTxRefreshTargets(pendingTargets);
                        try {
                            __tmPushRefreshDebug('auto-refresh:end', {
                                source: sourceLabel,
                                path: 'incremental',
                                ok: true,
                                durationMs: __tmRoundPerfMs(__tmPerfNow() - startedAt),
                            });
                        } catch (e) {}
                        return true;
                    }
                } catch (e) {}
            }
            const ok = await __tmRefreshCore({
                silent: true,
                reason: `auto:${sourceLabel}`,
                preserveUi: true,
            });
            if (ok) {
                if (hadQuickbarDirty) __tmClearQuickbarModifications();
                if (hadExternalDirty) __tmClearExternalTaskTxDirty();
                __tmClearPendingTxRefreshTargets(pendingTargets);
            }
            try {
                __tmPushRefreshDebug('auto-refresh:end', {
                    source: sourceLabel,
                    path: 'full',
                    ok: ok === true,
                    durationMs: __tmRoundPerfMs(__tmPerfNow() - startedAt),
                });
            } catch (e) {}
            return ok;
        } finally {
            __tmTabEnterAutoRefreshInFlight = false;
            try { __tmFlushDeferredViewRefreshAfterTaskFieldWork(`auto-refresh:${sourceLabel}:end`); } catch (e) {}
        }
    }

    async function __tmSilentRefreshAfterQuickbarUpdate() {
        try {
            const mode = String(state.viewMode || '').trim();
            try {
                __tmPushRefreshDebug('quickbar-silent-refresh:start', {
                    viewMode: mode,
                    isRefreshing: state.isRefreshing === true,
                    modifiedCount: Number(__tmModifiedTaskIds?.size || 0),
                });
            } catch (e2) {}
            if (mode === 'calendar' && typeof window.tmRefreshCalendarInPlace === 'function') {
                try { await window.tmRefreshCalendarInPlace({ silent: true }); } catch (e) {}
                try {
                    __tmPushRefreshDebug('quickbar-silent-refresh:end', {
                        path: 'calendar-in-place',
                        ok: true,
                        viewMode: mode,
                    });
                } catch (e2) {}
                return;
            }
        } catch (e) {}
        if (__tmGetBusyTaskDetailBarrier()) {
            try {
                __tmPushDetailDebug('detail-host-silent-refresh-deferred', {
                    source: 'quickbar-silent-refresh',
                });
            } catch (e) {}
            try {
                __tmPushRefreshDebug('quickbar-silent-refresh:deferred', {
                    reason: 'detail-busy',
                    viewMode: String(state.viewMode || '').trim() || '',
                });
            } catch (e2) {}
            setTimeout(() => { try { __tmSilentRefreshAfterQuickbarUpdate(); } catch (e2) {} }, 320);
            return;
        }
        if (state.isRefreshing) {
            try {
                __tmPushRefreshDebug('quickbar-silent-refresh:deferred', {
                    reason: 'refresh-in-flight',
                    viewMode: String(state.viewMode || '').trim() || '',
                });
            } catch (e2) {}
            setTimeout(() => { try { __tmSilentRefreshAfterQuickbarUpdate(); } catch (e) {} }, 300);
            return;
        }
        state.isRefreshing = true;
        let removedCount = 0;
        let refreshOk = true;
        let refreshPath = 'load-selected-documents';
        try {
            try { __tmInvalidateAllSqlCaches(); } catch (e) {}
            try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
            await loadSelectedDocuments({ skipRender: true, source: 'quickbar-silent-refresh' });
            try {
                removedCount = Number(await __tmSyncWhiteboardFrozenTasksWithLiveTasks()) || 0;
            } catch (e) {}
            if (removedCount > 0) {
                try { applyFilters(); } catch (e) {}
            }
            if (__tmGetBusyTaskDetailBarrier()) {
                try {
                    __tmPushDetailDebug('detail-host-silent-refresh-still-busy', {
                        source: 'quickbar-silent-refresh',
                    });
                } catch (e) {}
                try {
                    __tmPushRefreshDebug('quickbar-silent-refresh:end', {
                        path: 'detail-busy-after-load',
                        ok: false,
                        removedCount,
                        viewMode: String(state.viewMode || '').trim() || '',
                    });
                } catch (e2) {}
                refreshOk = false;
                refreshPath = 'detail-busy-after-load';
                return;
            }
            try {
                if (state.modal && document.body.contains(state.modal)) {
                    __tmRerenderCurrentViewInPlace(state.modal);
                }
            } catch (e) {}
        } catch (e) {
            try {
                __tmPushRefreshDebug('quickbar-silent-refresh:error', {
                    error: String(e?.message || e || '').trim(),
                    viewMode: String(state.viewMode || '').trim() || '',
                });
            } catch (e2) {}
            refreshOk = false;
            refreshPath = 'error';
        } finally {
            state.isRefreshing = false;
            if (refreshPath !== 'detail-busy-after-load') {
                try {
                    __tmPushRefreshDebug('quickbar-silent-refresh:end', {
                        path: refreshPath,
                        ok: refreshOk,
                        removedCount,
                        viewMode: String(state.viewMode || '').trim() || '',
                    });
                } catch (e2) {}
            }
            try { __tmFlushDeferredViewRefreshAfterTaskFieldWork('quickbar-silent-refresh:end'); } catch (e2) {}
        }
    }

    function __tmIsPluginVisibleNow() {
        try {
            if (!state.modal || !document.body.contains(state.modal)) return false;
        } catch (e) {
            return false;
        }
        try {
            const style = window.getComputedStyle(state.modal);
            if (style.display === 'none' || style.opacity === '0' || style.visibility === 'hidden') return false;
        } catch (e) {}
        try {
            const modalRect = state.modal.getBoundingClientRect?.();
            if (modalRect && !(modalRect.width > 0 && modalRect.height > 0)) return false;
        } catch (e) {}
        try {
            const mountEl = __tmGetMountRoot();
            if (__tmIsDockHost() && mountEl && mountEl !== document.body) {
                const dockHost = globalThis.__tmCompat?.findDockHost?.(mountEl) || null;
                if (dockHost instanceof HTMLElement) {
                    const dockStyle = window.getComputedStyle(dockHost);
                    if (dockStyle.display === 'none' || dockStyle.visibility === 'hidden') return false;
                    if (String(dockHost.getAttribute('aria-hidden') || '').trim() === 'true') return false;
                    const dockRect = dockHost.getBoundingClientRect?.();
                    if (dockRect && !(dockRect.width > 0 && dockRect.height > 0)) return false;
                }
                const mountStyle = window.getComputedStyle(mountEl);
                if (mountStyle.display === 'none' || mountStyle.visibility === 'hidden') return false;
                const mountRect = mountEl.getBoundingClientRect?.();
                if (mountRect && !(mountRect.width > 0 && mountRect.height > 0)) return false;
                return true;
            }
            if (__tmIsTabHost() && mountEl && mountEl !== document.body) {
                const tabHosts = [
                    mountEl,
                    mountEl.parentElement,
                    mountEl.closest?.('.layout-tab-container'),
                ];
                const seen = new Set();
                for (const host of tabHosts) {
                    if (!(host instanceof HTMLElement) || seen.has(host)) continue;
                    seen.add(host);
                    const hostStyle = window.getComputedStyle(host);
                    if (hostStyle.display === 'none' || hostStyle.visibility === 'hidden') return false;
                    if (String(host.getAttribute('aria-hidden') || '').trim() === 'true') return false;
                    const hostRect = host.getBoundingClientRect?.();
                    if (hostRect && !(hostRect.width > 0 && hostRect.height > 0)) return false;
                }
                if (__tmIsTaskHorizonTabActiveNow()) return true;
            }
        } catch (e) {}
        try {
            const activeWindow = globalThis.__tmCompat?.findActiveWindow?.() || null;
            if (activeWindow) {
                const mountEl = __tmGetMountRoot();
                if (mountEl && mountEl !== document.body && activeWindow.contains(mountEl)) return true;
                if (activeWindow.contains(state.modal)) return true;
                return false;
            }
        } catch (e) {}
        try {
            const mountEl = __tmGetMountRoot();
            if (mountEl && mountEl !== document.body) {
                const mountStyle = window.getComputedStyle(mountEl);
                if (mountStyle.display === 'none' || mountStyle.visibility === 'hidden') return false;
                const mountRect = mountEl.getBoundingClientRect?.();
                if (mountRect && !(mountRect.width > 0 && mountRect.height > 0)) return false;
            }
        } catch (e) {}
        return true;
    }

    async function __tmMaybeAutoRefreshOnEnter(source) {
        const hasPendingDirty = __tmHasAutoRefreshPendingSync();
        await __tmRunAutoRefreshIfNeeded(source, { force: hasPendingDirty });
    }

    function __tmScheduleMaybeAutoRefreshOnEnter(source) {
        if (__tmTabEnterAutoRefreshTimer) return;
        __tmTabEnterAutoRefreshTryCount = 0;
        const tick = async () => {
            __tmTabEnterAutoRefreshTimer = null;
            __tmTabEnterAutoRefreshTryCount += 1;
            try {
                if (__tmIsPluginVisibleNow()) {
                    const delayMeta = __tmGetEnterAutoRefreshDelayMeta(source);
                    if (delayMeta.shouldDelay) {
                        try {
                            __tmPushRefreshDebug('auto-refresh:skip', {
                                source: String(source || '').trim() || 'unknown',
                                reason: delayMeta.reason || 'context-quiet',
                                force: __tmHasAutoRefreshPendingSync(),
                                tryCount: Number(__tmTabEnterAutoRefreshTryCount || 0),
                                waitMs: Number(delayMeta.waitMs || 0),
                            });
                        } catch (e) {}
                        if (__tmTabEnterAutoRefreshTryCount < 16) {
                            __tmTabEnterAutoRefreshTimer = setTimeout(tick, Number(delayMeta.waitMs || 180));
                        }
                        return;
                    }
                    await __tmMaybeAutoRefreshOnEnter(source);
                    return;
                }
            } catch (e) {}
            if (__tmTabEnterAutoRefreshTryCount < 16) {
                __tmTabEnterAutoRefreshTimer = setTimeout(tick, 120);
            }
        };
        const initialDelayMeta = __tmGetEnterAutoRefreshDelayMeta(source);
        __tmTabEnterAutoRefreshTimer = setTimeout(tick, Number(initialDelayMeta.waitMs || 120));
    }

    function __tmBindTabEnterAutoRefresh() {
        if (__tmTabEnterAutoRefreshBound) return;
        __tmTabEnterAutoRefreshBound = true;
        try {
            const installMeta = globalThis.__tmCompat?.installSwitchTabObserver?.('__tmTaskHorizonWrapped', (tab) => {
                try {
                    const isMine = __tmIsTaskHorizonCustomModel(tab);
                    if (isMine) __tmScheduleMaybeAutoRefreshOnEnter('switchTab');
                } catch (e) {}
            }) || null;
            if (installMeta?.ok && typeof installMeta.original === 'function') {
                __tmOriginalCenterSwitchTab = installMeta.original;
            }
        } catch (e) {}
        try {
            if (!__tmTabHeaderAutoRefreshHandler) {
                __tmTabHeaderAutoRefreshHandler = (event) => {
                    try {
                        const target = event?.target instanceof Element ? event.target : null;
                        const header = target?.closest?.('.layout-tab-bar__item');
                        if (!header || !__tmIsTaskHorizonTabHeaderEl(header)) return;
                        __tmScheduleMaybeAutoRefreshOnEnter('tabHeaderClick');
                    } catch (e) {}
                };
                try { globalThis.__tmRuntimeEvents?.on?.(document, 'click', __tmTabHeaderAutoRefreshHandler, true); } catch (e) {}
            }
        } catch (e) {}
        try {
            if (!__tmTabActivationObserver) {
                __tmTaskHorizonTabWasActive = __tmIsTaskHorizonTabActiveNow();
                __tmTabActivationObserver = new MutationObserver(() => {
                    try {
                        if (__tmTabActivationObserverTimer) return;
                    } catch (e) {}
                    __tmTabActivationObserverTimer = setTimeout(() => {
                        __tmTabActivationObserverTimer = 0;
                        const active = __tmIsTaskHorizonTabActiveNow();
                        const prev = __tmTaskHorizonTabWasActive === true;
                        __tmTaskHorizonTabWasActive = active;
                        if (!active || prev) return;
                        __tmRunAutoRefreshIfNeeded('tabActivatedObserver', { force: true }).catch(() => {});
                    }, 60);
                });
                __tmTabActivationObserver.observe(document.body, {
                    subtree: true,
                    attributes: true,
                    childList: true,
                    attributeFilter: ['class', 'aria-selected'],
                });
            }
        } catch (e) {}
    }

    function __tmHookTomatoTimer() {
        if (__tmTomatoTimerHooked) return;
        const timer = globalThis.__tomatoTimer;
        if (!timer || typeof timer !== 'object') return;
        if (!__tmTomatoOriginalTimerFns) __tmTomatoOriginalTimerFns = {};
        const wrap = (name) => {
            const current = timer[name];
            if (typeof current !== 'function') return;
            if (current.__tmWrapped) return;
            if (!__tmTomatoOriginalTimerFns[name]) __tmTomatoOriginalTimerFns[name] = current;
            const original = __tmTomatoOriginalTimerFns[name];
            if (typeof original !== 'function') return;
            const wrapped = function(...args) {
                const res = original.apply(this, args);
                try {
                    state.timerFocusTaskId = '';
                    if (state.modal && document.body.contains(state.modal)) render();
                } catch (e) {}
                return res;
            };
            wrapped.__tmWrapped = true;
            try { timer[name] = wrapped; } catch (e) {}
        };
        [
            'clearTaskAssociation',
            'clearAssociation',
            'clearTask',
            'clearCurrentTask',
            'unbindTask',
            'stop',
            'reset',
        ].forEach(wrap);
        __tmTomatoTimerHooked = true;
    }

    function __tmListenTomatoAssociationCleared() {
        if (__tmTomatoAssociationListenerAdded) return;
        __tmTomatoAssociationHandler = () => {
            try {
                state.timerFocusTaskId = '';
                if (state.modal && document.body.contains(state.modal)) render();
            } catch (e) {}
        };
        __tmTomatoFocusModeChangedHandler = (event) => {
            try {
                const enabled = event?.detail?.enabled !== false;
                if (enabled) return;
                state.timerFocusTaskId = '';
                __tmClearTomatoFocusRowClasses();
                if (state.modal && document.body.contains(state.modal)) render();
            } catch (e) {}
        };
        try { globalThis.__tmRuntimeEvents?.on?.(window, 'tomato:association-cleared', __tmTomatoAssociationHandler); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(window, 'tomato:focus-mode-changed', __tmTomatoFocusModeChangedHandler); } catch (e) {}
        globalThis.__taskHorizonOnTomatoAssociationCleared = () => {
            try {
                state.timerFocusTaskId = '';
                if (state.modal && document.body.contains(state.modal)) render();
            } catch (e) {}
        };
        __tmTomatoAssociationListenerAdded = true;
    }

    function __tmClearTomatoFocusRowClasses() {
        try {
            const root = (state.modal && document.body.contains(state.modal)) ? state.modal : document;
            root.querySelectorAll?.('.tm-timer-dim, .tm-timer-focus')?.forEach?.((el) => {
                try {
                    el.classList.remove('tm-timer-dim', 'tm-timer-focus');
                } catch (e) {}
            });
        } catch (e) {}
    }

    function __tmIsTomatoFocusModeEnabled() {
        try {
            if (typeof globalThis.__dockTomatoFocusModeEnabled === 'boolean') {
                return globalThis.__dockTomatoFocusModeEnabled !== false;
            }
            const raw = String(localStorage.getItem('tomato-user-settings') || '').trim();
            if (!raw) return true;
            const parsed = JSON.parse(raw);
            return parsed?.main?.enableFocusMode !== false;
        } catch (e) {
            return true;
        }
    }

    function __tmListenPinnedChanged() {
        if (__tmPinnedListenerAdded) return;
        globalThis.__taskHorizonOnPinnedChanged = (taskId, pinned) => {
            try {
                const id = String(taskId || '').trim();
                if (!id) return;
                const task = state.flatTasks?.[id];
                if (!task) return;
                const val = !!pinned;
                task.pinned = val;
                try { MetaStore.set(id, { pinned: val }); } catch (e) {}
                try { applyFilters(); } catch (e) {}
                if (state.modal && document.body.contains(state.modal)) render();
            } catch (e) {}
        };
        __tmPinnedListenerAdded = true;
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = String(s ?? '');
        return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function escSq(s) {
        return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    const __tmRemarkRenderCache = new Map();
    const __tmRemarkStripCache = new Map();

    function __tmTrimOuterBlankLines(input) {
        const lines = String(input || '').split('\n');
        while (lines.length && !String(lines[0] || '').trim()) lines.shift();
        while (lines.length && !String(lines[lines.length - 1] || '').trim()) lines.pop();
        return lines.join('\n');
    }

    function __tmNormalizeRemarkMarkdown(input) {
        const text = String(input || '').replace(/\r\n?/g, '\n');
        const lines = text.split('\n').map((line) => String(line || '').replace(/[ \t]+$/g, ''));
        const normalized = [];
        let blankCount = 0;
        lines.forEach((line) => {
            const nextLine = String(line || '');
            if (!nextLine.trim()) {
                blankCount += 1;
                if (blankCount <= 2) normalized.push('');
                return;
            }
            blankCount = 0;
            normalized.push(nextLine);
        });
        return __tmTrimOuterBlankLines(normalized.join('\n'));
    }

    function __tmSanitizeRemarkHref(rawHref) {
        const href = String(rawHref || '').trim();
        if (!href) return '';
        if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
        return /^\/(?!\/)/.test(href) ? href : '';
    }

    function __tmRenderRemarkInlineHtml(input, depth = 0) {
        const text = String(input || '');
        if (!text) return '';
        if (depth > 6) return esc(text);
        const tokens = [];
        const stash = (html) => `\u0000${tokens.push(String(html || '')) - 1}\u0000`;
        let source = text;

        source = source.replace(/\[([^\]]+)\]\(([^)\s]+(?:\s[^)]*)?)\)/g, (match, label, href) => {
            const safeHref = __tmSanitizeRemarkHref(href);
            const labelHtml = __tmRenderRemarkInlineHtml(label, depth + 1);
            if (!safeHref) return stash(labelHtml);
            return stash(`<a class="tm-task-detail-remark-link" href="${esc(safeHref)}" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`);
        });
        source = source.replace(/\*\*([\s\S]+?)\*\*/g, (match, inner) => stash(`<strong>${__tmRenderRemarkInlineHtml(inner, depth + 1)}</strong>`));
        source = source.replace(/__([\s\S]+?)__/g, (match, inner) => stash(`<strong>${__tmRenderRemarkInlineHtml(inner, depth + 1)}</strong>`));
        source = source.replace(/(^|[^\*])\*([^\*\n]+)\*(?!\*)/g, (match, prefix, inner) => `${prefix}${stash(`<em>${__tmRenderRemarkInlineHtml(inner, depth + 1)}</em>`)}`);
        source = source.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, (match, prefix, inner) => `${prefix}${stash(`<em>${__tmRenderRemarkInlineHtml(inner, depth + 1)}</em>`)}`);
        source = source.replace(/`([^`\n]+)`/g, (match, inner) => stash(`<code>${esc(inner)}</code>`));

        let html = esc(source);
        html = html.replace(/\u0000(\d+)\u0000/g, (match, index) => tokens[Number(index)] || '');
        return html;
    }

    function __tmRenderRemarkLineHtml(input) {
        return `<span class="tm-task-detail-remark-inline">${__tmRenderRemarkInlineHtml(input)}</span>`;
    }

    function __tmMeasureRemarkIndent(rawLine) {
        const leading = (String(rawLine || '').match(/^[\t ]*/) || [''])[0];
        let width = 0;
        for (let i = 0; i < leading.length; i += 1) {
            width += leading[i] === '\t' ? 4 : 1;
        }
        return width;
    }

    function __tmRenderRemarkListHtml(entries) {
        const list = Array.isArray(entries) ? entries.filter((item) => item && item.text) : [];
        if (!list.length) return '';
        let html = '';
        const stack = [];
        const openList = (type, indent) => {
            html += `<${type}>`;
            stack.push({ type, indent, liOpen: false });
        };
        const closeList = () => {
            const current = stack.pop();
            if (!current) return;
            if (current.liOpen) html += '</li>';
            html += `</${current.type}>`;
        };
        list.forEach((entry) => {
            const type = entry.type === 'ol' ? 'ol' : 'ul';
            const indent = Math.max(0, Number(entry.indent) || 0);
            while (stack.length && indent < stack[stack.length - 1].indent) closeList();
            if (stack.length && indent === stack[stack.length - 1].indent && type !== stack[stack.length - 1].type) {
                closeList();
            }
            if (!stack.length || indent > stack[stack.length - 1].indent) {
                openList(type, indent);
            } else if (stack[stack.length - 1].type !== type) {
                openList(type, indent);
            } else if (stack[stack.length - 1].liOpen) {
                html += '</li>';
                stack[stack.length - 1].liOpen = false;
            }
            if (!stack.length || stack[stack.length - 1].indent !== indent || stack[stack.length - 1].type !== type) {
                openList(type, indent);
            }
            html += `<li>${__tmRenderRemarkLineHtml(entry.text)}`;
            stack[stack.length - 1].liOpen = true;
        });
        while (stack.length) closeList();
        return html;
    }

    function __tmRenderRemarkMarkdown(input) {
        const source = __tmNormalizeRemarkMarkdown(input);
        if (!source) return '<div class="tm-task-detail-remark-empty">点击添加备注</div>';
        const cached = __tmRemarkRenderCache.get(source);
        if (cached) return cached;
        const lines = source.split('\n');
        const blocks = [];
        let paragraph = [];
        let quote = [];
        let listEntries = [];

        const flushParagraph = () => {
            if (!paragraph.length) return;
            blocks.push(`<p>${paragraph.map((line) => __tmRenderRemarkLineHtml(line)).join('<br>')}</p>`);
            paragraph = [];
        };
        const flushQuote = () => {
            if (!quote.length) return;
            blocks.push(`<blockquote>${quote.map((line) => __tmRenderRemarkLineHtml(line)).join('<br>')}</blockquote>`);
            quote = [];
        };
        const flushList = () => {
            if (!listEntries.length) return;
            blocks.push(__tmRenderRemarkListHtml(listEntries));
            listEntries = [];
        };

        lines.forEach((line) => {
            const rawLine = String(line || '');
            const trimmed = rawLine.trim();
            const quoteMatch = rawLine.match(/^\s*>\s?(.*)$/);
            const orderedMatch = rawLine.match(/^\s*(\d+)\.\s+(.+)$/);
            const bulletMatch = rawLine.match(/^\s*[-*+]\s+(.+)$/);

            if (!trimmed) {
                flushParagraph();
                flushQuote();
                flushList();
                return;
            }
            if (quoteMatch) {
                flushParagraph();
                flushList();
                quote.push(String(quoteMatch[1] || ''));
                return;
            }
            if (orderedMatch) {
                flushParagraph();
                flushQuote();
                listEntries.push({
                    type: 'ol',
                    indent: __tmMeasureRemarkIndent(rawLine),
                    text: String(orderedMatch[2] || ''),
                });
                return;
            }
            if (bulletMatch) {
                flushParagraph();
                flushQuote();
                listEntries.push({
                    type: 'ul',
                    indent: __tmMeasureRemarkIndent(rawLine),
                    text: String(bulletMatch[1] || ''),
                });
                return;
            }
            flushQuote();
            flushList();
            paragraph.push(rawLine);
        });

        flushParagraph();
        flushQuote();
        flushList();

        const html = blocks.join('') || '<div class="tm-task-detail-remark-empty">点击添加备注</div>';
        if (__tmRemarkRenderCache.size > 400) __tmRemarkRenderCache.clear();
        __tmRemarkRenderCache.set(source, html);
        return html;
    }

    function __tmStripRemarkMarkdown(input) {
        const source = __tmNormalizeRemarkMarkdown(input);
        if (!source) return '';
        const cached = __tmRemarkStripCache.get(source);
        if (cached !== undefined) return cached;
        const text = source
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
            .replace(/^\s*>\s?/gm, '')
            .replace(/^\s*[-*+]\s+/gm, '')
            .replace(/^\s*\d+\.\s+/gm, '')
            .replace(/(\*\*|__)([\s\S]+?)\1/g, '$2')
            .replace(/(^|[^\*])\*([^\*\n]+)\*(?!\*)/g, '$1$2')
            .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1$2')
            .replace(/`([^`\n]+)`/g, '$1')
            .replace(/\n+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        if (__tmRemarkStripCache.size > 400) __tmRemarkStripCache.clear();
        __tmRemarkStripCache.set(source, text);
        return text;
    }

    function __tmGetTextareaSelectionRange(textarea) {
        if (!(textarea instanceof HTMLTextAreaElement)) return { start: 0, end: 0, value: '' };
        return {
            start: Math.max(0, Number(textarea.selectionStart) || 0),
            end: Math.max(0, Number(textarea.selectionEnd) || 0),
            value: String(textarea.value || ''),
        };
    }

    function __tmSetTextareaValueAndSelection(textarea, nextValue, start, end = start) {
        if (!(textarea instanceof HTMLTextAreaElement)) return;
        textarea.value = String(nextValue || '');
        try { textarea.focus({ preventScroll: true }); } catch (e) { try { textarea.focus(); } catch (e2) {} }
        try { textarea.setSelectionRange(start, end); } catch (e) {}
        try { textarea.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    }

    function __tmWrapRemarkSelection(textarea, prefix, suffix = prefix) {
        if (!(textarea instanceof HTMLTextAreaElement)) return false;
        const { start, end, value } = __tmGetTextareaSelectionRange(textarea);
        const selected = value.slice(start, end);
        const fallback = prefix === '`' ? '代码' : '文本';
        const nextInner = selected || fallback;
        const nextValue = `${value.slice(0, start)}${prefix}${nextInner}${suffix}${value.slice(end)}`;
        const selectionStart = start + prefix.length;
        const selectionEnd = selectionStart + nextInner.length;
        __tmSetTextareaValueAndSelection(textarea, nextValue, selectionStart, selectionEnd);
        return true;
    }

    function __tmToggleRemarkLinePrefix(textarea, prefix) {
        if (!(textarea instanceof HTMLTextAreaElement)) return false;
        const { start, end, value } = __tmGetTextareaSelectionRange(textarea);
        const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const lineEndIndex = value.indexOf('\n', end);
        const lineEnd = lineEndIndex < 0 ? value.length : lineEndIndex;
        const block = value.slice(lineStart, lineEnd);
        const lines = block.split('\n');
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefixRe = new RegExp(`^(\\s*)${escapedPrefix}`);
        const nonEmptyLines = lines.filter((line) => !!line.trim());
        const shouldRemove = nonEmptyLines.length > 0 && nonEmptyLines.every((line) => prefixRe.test(line));
        if (nonEmptyLines.length === 0) {
            const insertText = prefix;
            const nextValue = `${value.slice(0, lineStart)}${insertText}${value.slice(lineEnd)}`;
            const caret = lineStart + insertText.length;
            __tmSetTextareaValueAndSelection(textarea, nextValue, caret, caret);
            return true;
        }
        const nextLines = lines.map((line) => {
            if (!line.trim()) return line;
            if (shouldRemove) return line.replace(prefixRe, '$1');
            const indent = (line.match(/^\s*/) || [''])[0];
            return `${indent}${prefix}${line.slice(indent.length)}`;
        });
        const nextBlock = nextLines.join('\n');
        const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
        const delta = nextBlock.length - block.length;
        __tmSetTextareaValueAndSelection(textarea, nextValue, start + (shouldRemove ? -prefix.length : prefix.length), end + delta);
        return true;
    }

    function __tmToggleRemarkOrderedList(textarea) {
        if (!(textarea instanceof HTMLTextAreaElement)) return false;
        const { start, end, value } = __tmGetTextareaSelectionRange(textarea);
        const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const lineEndIndex = value.indexOf('\n', end);
        const lineEnd = lineEndIndex < 0 ? value.length : lineEndIndex;
        const block = value.slice(lineStart, lineEnd);
        const lines = block.split('\n');
        const orderedRe = /^(\s*)(\d+)\.\s+/;
        const nonEmptyLines = lines.filter((line) => !!line.trim());
        const shouldRemove = nonEmptyLines.length > 0 && nonEmptyLines.every((line) => orderedRe.test(line));
        if (nonEmptyLines.length === 0) {
            const insertText = '1. ';
            const nextValue = `${value.slice(0, lineStart)}${insertText}${value.slice(lineEnd)}`;
            const caret = lineStart + insertText.length;
            __tmSetTextareaValueAndSelection(textarea, nextValue, caret, caret);
            return true;
        }
        const nextLines = lines.map((line, index) => {
            if (!line.trim()) return line;
            if (shouldRemove) return line.replace(orderedRe, '$1');
            const indent = (line.match(/^\s*/) || [''])[0];
            return `${indent}${index + 1}. ${line.slice(indent.length)}`;
        });
        const nextBlock = nextLines.join('\n');
        const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
        const delta = nextBlock.length - block.length;
        __tmSetTextareaValueAndSelection(textarea, nextValue, Math.max(lineStart, start + (shouldRemove ? -3 : 3)), end + delta);
        return true;
    }

    function __tmIsRemarkLinkHref(value) {
        const text = String(value || '').trim();
        if (!text) return false;
        return /^(https?:\/\/|mailto:|tel:)[^\s<>"']+$/i.test(text);
    }

    function __tmEscapeRemarkLinkLabel(value) {
        return String(value || '').replace(/([\\\[\]])/g, '\\$1').replace(/\n+/g, ' ').trim();
    }

    function __tmEscapeRemarkLinkHref(value) {
        return String(value || '').trim();
    }

    function __tmInsertRemarkLinkTemplate(textarea) {
        if (!(textarea instanceof HTMLTextAreaElement)) return false;
        const { start, end, value } = __tmGetTextareaSelectionRange(textarea);
        const selected = value.slice(start, end);
        const selectedText = String(selected || '').trim();
        const selectedIsHref = __tmIsRemarkLinkHref(selectedText);
        const label = __tmEscapeRemarkLinkLabel(selectedIsHref ? selectedText : (selected || '链接文本'));
        const href = selectedIsHref ? __tmEscapeRemarkLinkHref(selectedText) : 'https://';
        const template = `[${label}](${href})`;
        const nextValue = `${value.slice(0, start)}${template}${value.slice(end)}`;
        if (selectedIsHref) {
            const labelStart = start + 1;
            __tmSetTextareaValueAndSelection(textarea, nextValue, labelStart, labelStart + label.length);
            return true;
        }
        const urlStart = start + label.length + 3;
        const caret = urlStart + href.length;
        __tmSetTextareaValueAndSelection(textarea, nextValue, caret, caret);
        return true;
    }

    function __tmAdjustRemarkIndent(textarea, outdent = false) {
        if (!(textarea instanceof HTMLTextAreaElement)) return false;
        const { start, end, value } = __tmGetTextareaSelectionRange(textarea);
        const indentUnit = '    ';
        const effectiveEnd = end > start && value[end - 1] === '\n' ? (end - 1) : end;
        const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const lineEndIndex = value.indexOf('\n', Math.max(0, effectiveEnd));
        const lineEnd = lineEndIndex < 0 ? value.length : lineEndIndex;
        const block = value.slice(lineStart, lineEnd);
        const lines = block.split('\n');
        let changed = false;
        const meta = lines.map((line) => {
            if (!outdent) {
                changed = true;
                return {
                    nextLine: `${indentUnit}${line}`,
                    removed: 0,
                };
            }
            let removed = 0;
            if (line.startsWith('\t')) removed = 1;
            else {
                const match = line.match(/^ {1,4}/);
                removed = match ? match[0].length : 0;
            }
            if (removed > 0) changed = true;
            return {
                nextLine: line.slice(removed),
                removed,
            };
        });
        if (!changed) return true;
        const nextLines = meta.map((item) => item.nextLine);
        const nextBlock = nextLines.join('\n');
        const mapOffset = (offset) => {
            const safeOffset = Math.max(0, Math.min(offset, block.length));
            let originalCursor = 0;
            let nextCursor = 0;
            for (let index = 0; index < lines.length; index += 1) {
                const currentLine = lines[index];
                const nextLine = nextLines[index];
                const lineLength = currentLine.length;
                const lineEndOffset = originalCursor + lineLength;
                if (safeOffset <= lineEndOffset) {
                    const column = safeOffset - originalCursor;
                    if (!outdent) return nextCursor + indentUnit.length + column;
                    return nextCursor + Math.max(0, column - (meta[index].removed || 0));
                }
                if (safeOffset === lineEndOffset + 1 && index < lines.length - 1) {
                    return nextCursor + nextLine.length + 1;
                }
                originalCursor = lineEndOffset + 1;
                nextCursor += nextLine.length + 1;
            }
            return nextBlock.length;
        };
        const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
        const nextStart = lineStart + mapOffset(start - lineStart);
        const nextEnd = lineStart + mapOffset(end - lineStart);
        __tmSetTextareaValueAndSelection(textarea, nextValue, nextStart, nextEnd);
        return true;
    }

    function __tmHandleRemarkTextareaKeydown(textarea, event) {
        if (!(textarea instanceof HTMLTextAreaElement) || !event || event.defaultPrevented) return false;
        if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing) {
            event.preventDefault();
            return __tmAdjustRemarkIndent(textarea, !!event.shiftKey);
        }
        const isMeta = !!(event.metaKey || event.ctrlKey);
        if (isMeta && !event.altKey) {
            const key = String(event.key || '').toLowerCase();
            if (key === 'b') {
                event.preventDefault();
                return __tmWrapRemarkSelection(textarea, '**');
            }
            if (key === 'i') {
                event.preventDefault();
                return __tmWrapRemarkSelection(textarea, '*');
            }
            if (key === 'k') {
                event.preventDefault();
                return __tmInsertRemarkLinkTemplate(textarea);
            }
        }
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return false;
        const { start, end, value } = __tmGetTextareaSelectionRange(textarea);
        if (start !== end) return false;
        const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const lineEndIndex = value.indexOf('\n', start);
        const lineEnd = lineEndIndex < 0 ? value.length : lineEndIndex;
        const line = value.slice(lineStart, lineEnd);
        const orderedMatch = line.match(/^(\s*)(\d+)\.\s*(.*)$/);
        const bulletMatch = line.match(/^(\s*)([-*+])\s*(.*)$/);
        if (!orderedMatch && !bulletMatch) return false;
        event.preventDefault();
        if (orderedMatch) {
            const indent = orderedMatch[1] || '';
            const index = Math.max(1, Number(orderedMatch[2]) || 1);
            const body = String(orderedMatch[3] || '');
            if (!body.trim()) {
                const nextLine = line.replace(/^(\s*)\d+\.\s*$/, '$1');
                const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
                const cursor = lineStart + nextLine.length;
                __tmSetTextareaValueAndSelection(textarea, nextValue, cursor);
                return true;
            }
            const insert = `\n${indent}${index + 1}. `;
            const nextValue = `${value.slice(0, start)}${insert}${value.slice(end)}`;
            const cursor = start + insert.length;
            __tmSetTextareaValueAndSelection(textarea, nextValue, cursor);
            return true;
        }
        const indent = bulletMatch[1] || '';
        const marker = bulletMatch[2] || '-';
        const body = String(bulletMatch[3] || '');
        if (!body.trim()) {
            const nextLine = line.replace(/^(\s*)[-*+]\s*$/, '$1');
            const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
            const cursor = lineStart + nextLine.length;
            __tmSetTextareaValueAndSelection(textarea, nextValue, cursor);
            return true;
        }
        const insert = `\n${indent}${marker} `;
        const nextValue = `${value.slice(0, start)}${insert}${value.slice(end)}`;
        const cursor = start + insert.length;
        __tmSetTextareaValueAndSelection(textarea, nextValue, cursor);
        return true;
    }

    try {
        globalThis.__tmRemarkMarkdownTools = {
            normalize: __tmNormalizeRemarkMarkdown,
            renderHtml: __tmRenderRemarkMarkdown,
            stripText: __tmStripRemarkMarkdown,
            wrapSelection: __tmWrapRemarkSelection,
            toggleLinePrefix: __tmToggleRemarkLinePrefix,
            toggleOrderedList: __tmToggleRemarkOrderedList,
            insertLinkTemplate: __tmInsertRemarkLinkTemplate,
            adjustIndent: __tmAdjustRemarkIndent,
            handleTextareaKeydown: __tmHandleRemarkTextareaKeydown,
        };
    } catch (e) {}

    function __tmNormalizeHeadingText(value) {
        let text = String(value || '').trim();
        if (!text) return '';
        text = text.replace(/^#{1,6}\s+/, '').trim();
        text = text.replace(/\s*\{\:\s*[^}]*\}\s*$/, '').trim();
        text = text.replace(/<span[^>]*>[\s\S]*?<\/span>/gi, '');
        text = text.replace(/<[^>]+>/g, '');
        text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
        text = text.replace(/\[([^\]]+)\]\((?:[^)(]+|\([^)]*\))*\)/g, '$1');
        text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
        text = text.replace(/(~~)(.*?)\1/g, '$2');
        text = text.replace(/`([^`]+)`/g, '$1');
        text = text.replace(/\\([\\`*_{}\[\]()#+\-.!~>])/g, '$1');
        return text.replace(/\s{2,}/g, ' ').trim();
    }

    function __tmParseCreatedTs(value) {
        const raw = String(value || '').trim();
        if (!raw) return 0;
        if (/^\d{14}$/.test(raw)) {
            const y = Number(raw.slice(0, 4));
            const m = Number(raw.slice(4, 6)) - 1;
            const d = Number(raw.slice(6, 8));
            const hh = Number(raw.slice(8, 10));
            const mm = Number(raw.slice(10, 12));
            const ss = Number(raw.slice(12, 14));
            const ts = new Date(y, m, d, hh, mm, ss, 0).getTime();
            return Number.isFinite(ts) ? ts : 0;
        }
        const ts = new Date(raw).getTime();
        return Number.isFinite(ts) ? ts : 0;
    }

    function __tmNormalizeWhiteboardAllTabsLayoutMode(mode) {
        const m = String(mode || '').trim().toLowerCase();
        return m === 'stream' ? 'stream' : 'board';
    }

    function __tmCompareTasksByDocFlow(a, b) {
        const ra = Number(a?.resolvedFlowRank ?? a?.resolved_flow_rank ?? a?.__tmResolvedFlowRank);
        const rb = Number(b?.resolvedFlowRank ?? b?.resolved_flow_rank ?? b?.__tmResolvedFlowRank);
        if (Number.isFinite(ra) && Number.isFinite(rb) && ra !== rb) return ra - rb;
        if (Number.isFinite(ra) && !Number.isFinite(rb)) return -1;
        if (!Number.isFinite(ra) && Number.isFinite(rb)) return 1;
        const qa = Number(a?.docSeq);
        const qb = Number(b?.docSeq);
        if (Number.isFinite(qa) && Number.isFinite(qb) && qa !== qb) return qa - qb;
        const pa = String(a?.blockPath || '').trim();
        const pb = String(b?.blockPath || '').trim();
        if (pa && pb && pa !== pb) return pa.localeCompare(pb);
        if (pa && !pb) return -1;
        if (!pa && pb) return 1;
        const sa = Number(a?.blockSort);
        const sb = Number(b?.blockSort);
        if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb) return sa - sb;
        const ssa = String(a?.blockSort || '').trim();
        const ssb = String(b?.blockSort || '').trim();
        if (ssa && ssb && ssa !== ssb) return ssa.localeCompare(ssb);
        if (ssa && !ssb) return -1;
        if (!ssa && ssb) return 1;
        const ca = String(a?.created || '');
        const cb = String(b?.created || '');
        if (ca !== cb) return ca.localeCompare(cb);
        return String(a?.id || '').localeCompare(String(b?.id || ''));
    }

    function __tmGetTaskSiblingRankEntry(rankMap, taskLike) {
        const ranks = rankMap instanceof Map ? rankMap : null;
        const taskId = typeof taskLike === 'string'
            ? String(taskLike || '').trim()
            : String(taskLike?.id || '').trim();
        if (!ranks || !taskId) return null;
        const raw = ranks.get(taskId);
        if (raw && typeof raw === 'object') return raw;
        const legacyRank = Number(raw);
        if (Number.isFinite(legacyRank)) return { localRank: legacyRank };
        return null;
    }

    function __tmGetTaskParentScopedRank(rankMap, taskLike) {
        const entry = __tmGetTaskSiblingRankEntry(rankMap, taskLike);
        const value = Number(entry?.parentRank);
        return Number.isFinite(value) ? value : undefined;
    }

    function __tmGetTaskLocalSiblingRank(rankMap, taskLike) {
        const entry = __tmGetTaskSiblingRankEntry(rankMap, taskLike);
        const value = Number(entry?.localRank);
        return Number.isFinite(value) ? value : undefined;
    }

    function __tmApplyResolvedFlowRankIfNeeded(task, flowRank) {
        if (!task || typeof task !== 'object') return false;
        const nextRank = Number(flowRank);
        if (!Number.isFinite(nextRank)) return false;
        const currentResolvedRank = Number(task?.resolvedFlowRank ?? task?.resolved_flow_rank ?? task?.__tmResolvedFlowRank);
        if (Number.isFinite(currentResolvedRank) && currentResolvedRank === nextRank) {
            task.resolvedFlowRank = currentResolvedRank;
            task.resolved_flow_rank = currentResolvedRank;
            task.__tmResolvedFlowRank = currentResolvedRank;
            task.docSeq = currentResolvedRank;
            task.doc_seq = currentResolvedRank;
            return false;
        }
        task.resolvedFlowRank = nextRank;
        task.resolved_flow_rank = nextRank;
        task.__tmResolvedFlowRank = nextRank;
        task.docSeq = nextRank;
        task.doc_seq = nextRank;
        return true;
    }

    function __tmMarkDocsPreferSiblingOrder(docIds, holdMs = 45000, reason = '') {
        const until = Date.now() + Math.max(1000, Number(holdMs) || 0);
        const ids = Array.from(new Set((Array.isArray(docIds) ? docIds : [docIds]).map((id) => String(id || '').trim()).filter(Boolean)));
        ids.forEach((docId) => {
            const prevUntil = Number(__tmDocFlowRankHoldUntil.get(docId) || 0);
            __tmDocFlowRankHoldUntil.set(docId, Math.max(prevUntil, until));
        });
        try {
            if (ids.length > 0) {
                __tmPushRefreshDebug('doc-flow-rank:hold', {
                    docIds: ids,
                    holdMs: Math.max(1000, Number(holdMs) || 0),
                    reason: String(reason || '').trim(),
                });
            }
        } catch (e) {}
    }

    function __tmShouldUseResolvedFlowRankForDoc(docId) {
        const did = String(docId || '').trim();
        if (!did) return true;
        const holdUntil = Number(__tmDocFlowRankHoldUntil.get(did) || 0);
        if (!Number.isFinite(holdUntil) || holdUntil <= 0) {
            __tmDocFlowRankHoldUntil.delete(did);
            return true;
        }
        if (holdUntil <= Date.now()) {
            __tmDocFlowRankHoldUntil.delete(did);
            return true;
        }
        return false;
    }

    function __tmGetDocHeadingBucket(task, noHeadingLabel) {
        const noneLabel = String(noHeadingLabel || '').trim() || '无标题';
        const raw = __tmNormalizeHeadingText(task?.h2);
        const label = raw || noneLabel;
        const hid = String(task?.h2Id || '').trim();
        if (hid) return { key: `id:${hid}`, label, id: hid };
        const hrank0 = Number(task?.h2Rank);
        if (Number.isFinite(hrank0)) return { key: `rank:${Math.trunc(hrank0)}`, label, id: '' };
        const hpath = String(task?.h2Path || '').trim();
        const hsort0 = Number(task?.h2Sort);
        const hsort = Number.isFinite(hsort0) ? String(Math.trunc(hsort0)) : '';
        const hcreated = String(task?.h2Created || '').trim();
        if (hpath || hsort || hcreated) {
            return { key: `pos:${hpath}|${hsort}|${hcreated}`, label, id: '' };
        }
        return { key: `label:${label}`, label, id: '' };
    }

    function __tmTaskHasResolvedHeading(task) {
        if (!task || typeof task !== 'object') return false;
        if (__tmNormalizeHeadingText(task?.h2)) return true;
        if (String(task?.h2Id || '').trim()) return true;
        if (Number.isFinite(Number(task?.h2Rank))) return true;
        if (String(task?.h2Path || '').trim()) return true;
        if (Number.isFinite(Number(task?.h2Sort))) return true;
        if (String(task?.h2Created || '').trim()) return true;
        return false;
    }

    function __tmCollectDocTasksForHeadingCheck(docId, extraTask = null) {
        const did = String(docId || '').trim();
        if (!did) return [];
        const out = [];
        const seen = new Set();
        const push = (task) => {
            if (!task || typeof task !== 'object') return;
            const taskDocId = String(task?.root_id || task?.docId || '').trim();
            if (!taskDocId || taskDocId !== did) return;
            const tid = String(task?.id || '').trim();
            if (tid && seen.has(tid)) return;
            if (tid) seen.add(tid);
            out.push(task);
        };
        (Array.isArray(state.filteredTasks) ? state.filteredTasks : []).forEach(push);
        const flatTasks = (state.flatTasks && typeof state.flatTasks === 'object')
            ? Object.values(state.flatTasks)
            : [];
        flatTasks.forEach(push);
        push(extraTask);
        return out;
    }

    function __tmDocHasAnyHeading(docId, tasks = null) {
        const did = String(docId || '').trim();
        if (!did) return false;
        const cached = state.kanbanDocHeadingsByDocId?.[did];
        if (Array.isArray(cached)) {
            return cached.some((heading) => !!String(heading?.id || heading?.content || '').trim());
        }
        const list = Array.isArray(tasks) ? tasks : __tmCollectDocTasksForHeadingCheck(did);
        return list.some((task) => __tmTaskHasResolvedHeading(task));
    }

    function __tmPrimeDocHeadingCache(docId, onReady, options = {}) {
        const did = String(docId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const force = opts === true || opts.force === true;
        if (!did) return;
        if (!force && Array.isArray(state.kanbanDocHeadingsByDocId?.[did])) return;
        Promise.resolve().then(async () => {
            try { await __tmWarmKanbanDocHeadings([did], { force }); } catch (e) {}
        }).then(() => {
            try { onReady?.(); } catch (e) {}
        }).catch(() => null);
    }

    function __tmBuildDocHeadingBuckets(tasks, noHeadingLabel) {
        const list = Array.isArray(tasks) ? tasks : [];
        const buckets = [];
        const seen = new Set();
        // 修复排序逻辑：严格按照任务在文档中的顺序来生成 buckets
        // 首先按照文档内顺序对任务进行排序
        const sortedList = list.slice().sort(__tmCompareTasksByDocFlow);
        // 然后提取每个任务对应的 bucket，按出现顺序依次添加
        // 这样可以确保 buckets 的顺序与任务在文档中的顺序一致
        sortedList.forEach((task) => {
            const b = __tmGetDocHeadingBucket(task, noHeadingLabel);
            if (!b || seen.has(b.key)) return;
            seen.add(b.key);
            buckets.push(b);
        });
        return buckets;
    }

    let __tmKanbanColsHtmlCache = null;

    function __tmHashStringFNV1a(seed, value) {
        let hash = Number(seed) >>> 0;
        const s = String(value ?? '');
        for (let i = 0; i < s.length; i++) {
            hash ^= s.charCodeAt(i);
            hash = Math.imul(hash, 16777619) >>> 0;
        }
        return hash >>> 0;
    }

    function __tmBuildKanbanColsCacheKey(options = {}) {
        let hash = 2166136261 >>> 0;
        const feed = (value) => {
            hash = __tmHashStringFNV1a(hash, value);
        };
        const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
        const statusOptions = Array.isArray(SettingsStore.data.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        const docs = Array.isArray(state.taskTree) ? state.taskTree : [];
        const collapsedGroups = state.collapsedGroups instanceof Set ? Array.from(state.collapsedGroups).sort() : [];
        const kanbanCollapsedIds = state.__tmKanbanCollapsedIds instanceof Set ? Array.from(state.__tmKanbanCollapsedIds).sort() : [];
        const quadrantRules = Array.isArray(SettingsStore.data?.quadrantConfig?.rules) ? SettingsStore.data.quadrantConfig.rules : [];

        feed(options.isAllTabsView ? 1 : 0);
        feed(options.isCompact ? 1 : 0);
        feed(options.kanbanColW);
        feed(options.kanbanFillColumns ? 1 : 0);
        feed(options.showDoneCol ? 1 : 0);
        feed(options.headingMode ? 1 : 0);
        feed(options.currentGroupId);
        feed(options.activeDocId);
        feed(options.isDark ? 1 : 0);
        feed(options.isGloballyLocked ? 1 : 0);
        feed(options.groupByDocName ? 1 : 0);
        feed(options.groupByTaskName ? 1 : 0);
        feed(options.groupByTime ? 1 : 0);
        feed(options.quadrantEnabled ? 1 : 0);
        feed(options.kanbanCardFields || '');
        feed(SettingsStore.data.taskHeadingLevel || 'h2');
        feed(SettingsStore.data.newTaskDocId || '');
        feed(SettingsStore.data.timeGroupBaseColorLight || '');
        feed(SettingsStore.data.timeGroupBaseColorDark || '');
        feed(SettingsStore.data.timeGroupOverdueColorLight || '');
        feed(SettingsStore.data.timeGroupOverdueColorDark || '');
        feed(Number(state.kanbanDocHeadingsLoadedAt) || 0);
        feed(String(state.kanbanDocHeadingsLevel || ''));

        feed(statusOptions.length);
        statusOptions.forEach((opt) => {
            feed(opt?.id);
            feed(opt?.name);
            feed(opt?.color);
        });

        feed(quadrantRules.length);
        quadrantRules.forEach((rule) => {
            feed(rule?.id);
            feed(rule?.name);
            feed(rule?.color);
            feed(Array.isArray(rule?.importance) ? rule.importance.join('|') : '');
            feed(Array.isArray(rule?.timeRanges) ? rule.timeRanges.join('|') : '');
        });

        feed(docs.length);
        docs.forEach((doc) => {
            feed(doc?.id);
            feed(doc?.name);
            feed(doc?.created);
        });

        feed(collapsedGroups.length);
        collapsedGroups.forEach(feed);

        feed(kanbanCollapsedIds.length);
        kanbanCollapsedIds.forEach(feed);

        feed(filtered.length);
        filtered.forEach((task) => {
            const markdown = String(task?.markdown || '');
            const nl = markdown.indexOf('\n');
            const firstLine = nl >= 0 ? markdown.slice(0, nl) : markdown;
            feed(task?.id);
            feed(firstLine);
            feed(task?.content);
            feed(task?.done ? 1 : 0);
            feed(task?.customStatus);
            feed(task?.priority);
            feed(task?.startDate);
            feed(task?.completionTime);
            feed(task?.remark);
            feed(task?.root_id);
            feed(task?.parentTaskId);
            feed(task?.h2);
            feed(task?.h2Id);
            feed(task?.h2Path);
            feed(task?.h2Sort);
            feed(task?.h2Created);
            feed(task?.h2Rank);
            feed(task?.docSeq);
            feed(task?.blockPath);
            feed(task?.blockSort);
            feed(task?.created);
            feed(task?.pinned ? 1 : 0);
            feed(Array.isArray(task?.children) ? task.children.length : 0);
        });

        return `${filtered.length}:${hash >>> 0}`;
    }

    function __tmSafeAttrName(name, fallback) {
        const f = String(fallback || '').trim() || 'custom-tomato-minutes';
        const s = String(name || '').trim() || f;
        if (!/^custom-[a-zA-Z0-9_-]+$/.test(s)) return f;
        return s;
    }

    function __tmParseNumber(value) {
        const s = String(value ?? '').trim();
        if (!s) return Number.NaN;
        const m = s.match(/-?\d+(?:\.\d+)?/);
        if (!m) return Number.NaN;
        return Number(m[0]);
    }

    const __tmTaskContentHtmlCache = new Map();
    const __tmTaskStatusParseCache = new Map();
    function __tmRememberTaskContentHtml(source, html) {
        const key = String(source || '');
        if (!key) return html;
        try {
            __tmTaskContentHtmlCache.set(key, html);
            if (__tmTaskContentHtmlCache.size > 1500) {
                const oldestKey = __tmTaskContentHtmlCache.keys().next().value;
                if (oldestKey !== undefined) __tmTaskContentHtmlCache.delete(oldestKey);
            }
        } catch (e) {}
        return html;
    }

    function __tmRememberTaskStatusParse(source, parsed) {
        const key = String(source || '');
        if (!key || !parsed || typeof parsed !== 'object') return parsed;
        try {
            __tmTaskStatusParseCache.set(key, parsed);
            if (__tmTaskStatusParseCache.size > 1500) {
                const oldestKey = __tmTaskStatusParseCache.keys().next().value;
                if (oldestKey !== undefined) __tmTaskStatusParseCache.delete(oldestKey);
            }
        } catch (e) {}
        return parsed;
    }

    const __tmGetRuntimeBackendType = () => {
        try {
            const container = window?.siyuan?.config?.system?.container;
            if (typeof container === 'string' && container.trim()) return container.trim().toLowerCase();
        } catch (e) {}
        try {
            const os = window?.siyuan?.config?.system?.os;
            if (typeof os === 'string' && os.trim()) return os.trim().toLowerCase();
        } catch (e) {}
        return '';
    };

    const __tmHasOfficialMobileRuntimeSignal = () => {
        try {
            if (globalThis.__taskHorizonPluginIsNativeMobile !== undefined) return !!globalThis.__taskHorizonPluginIsNativeMobile;
        } catch (e) {}
        try {
            if (globalThis?.JSAndroid) return true;
        } catch (e) {}
        try {
            if (globalThis?.JSHarmony) return true;
        } catch (e) {}
        try {
            const hasIosBridge = !!globalThis?.webkit?.messageHandlers;
            if (!hasIosBridge) return false;
            const ua = String(navigator?.userAgent || '');
            const maxTouchPoints = Number(navigator?.maxTouchPoints) || 0;
            if (/iPhone|iPad|iPod/i.test(ua)) return true;
            if (maxTouchPoints > 0) return true;
            return true;
        } catch (e) {}
        return false;
    };

    const __tmIsMobileBrowserViewport = () => {
        try {
            if (navigator?.userAgentData?.mobile === true) return true;
        } catch (e) {}
        try {
            const ua = String(navigator?.userAgent || '');
            if (/Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(ua)) return true;
        } catch (e) {}
        try {
            const maxTouchPoints = Number(navigator?.maxTouchPoints) || 0;
            const width = Number(window?.innerWidth) || 0;
            const coarse = !!window?.matchMedia?.('(pointer: coarse)')?.matches;
            if ((coarse || maxTouchPoints > 0) && width > 0 && width <= 900) return true;
        } catch (e) {}
        return false;
    };

    const __tmGetRuntimeClientKind = () => {
        try {
            if (globalThis.__taskHorizonRuntimeClientKind) return String(globalThis.__taskHorizonRuntimeClientKind || '').trim() || 'desktop-browser';
        } catch (e) {}
        if (__tmHasOfficialMobileRuntimeSignal()) {
            try {
                if (globalThis?.JSAndroid) return 'android-app';
            } catch (e) {}
            try {
                if (globalThis?.JSHarmony) return 'harmony-app';
            } catch (e) {}
            return 'ios-app';
        }
        return __tmIsMobileBrowserViewport() ? 'mobile-browser' : 'desktop-browser';
    };

    const __tmIsRuntimeMobileClient = () => {
        try {
            if (globalThis.__taskHorizonPluginIsMobile !== undefined) return !!globalThis.__taskHorizonPluginIsMobile;
        } catch (e) {}
        return __tmGetRuntimeClientKind() !== 'desktop-browser';
    };

    const __tmIsNativeMobileRuntimeClient = () => __tmHasOfficialMobileRuntimeSignal();

    const __tmIsMobileDevice = () => {
        if (__tmHostUsesMobileUI()) return true;
        return __tmIsRuntimeMobileClient();
    };

    const __tmUsesMobileInteractionUi = () => (
        __tmHostUsesMobileUI() || __tmIsRuntimeMobileClient()
    );

    const __tmIsDesktopDockHost = () => (
        __tmIsDockHost() && !__tmIsRuntimeMobileClient()
    );

    const __tmIsDesktopTabHost = () => (
        __tmIsTabHost() && !__tmIsRuntimeMobileClient()
    );

    const __tmIsScopedMobileHost = () => (
        __tmIsMobileDevice() && !__tmIsDesktopDockHost()
    );

    const __tmShouldUseMobileTaskDragLogic = () => __tmUsesMobileInteractionUi();

    const __tmShouldUseDesktopTaskDragLogic = () => !__tmShouldUseMobileTaskDragLogic();

    const __tmGetFloatingMiniDragMode = () => (__tmShouldUseMobileTaskDragLogic() ? 'mobile' : 'desktop');

    const __tmShouldUseBrowserTouchTaskDrag = () => __tmGetRuntimeClientKind() === 'mobile-browser';

    const __tmShouldUseCustomTouchTaskDrag = () => {
        const kind = __tmGetRuntimeClientKind();
        return kind === 'mobile-browser' || kind === 'android-app';
    };

    const __tmResolveNavigationTopWindow = (isDockHost = __tmIsDockHost()) => {
        if (!isDockHost) return window;
        try { return window.parent || window.top || window; } catch (e) {}
        return window;
    };

    const __tmGetRuntimeHostInfo = () => ({
        mountRoot: __tmGetMountRoot(),
        hostMode: __tmGetMountHostMode(),
        hostUsesMobileUI: __tmHostUsesMobileUI(),
        usesMobileInteractionUi: __tmUsesMobileInteractionUi(),
        isDockHost: __tmIsDockHost(),
        isTabHost: __tmIsTabHost(),
        isDesktopDockHost: __tmIsDesktopDockHost(),
        isDesktopTabHost: __tmIsDesktopTabHost(),
        isScopedMobileHost: __tmIsScopedMobileHost(),
        usesEmbeddedHostScrollIsolation: __tmUsesEmbeddedHostScrollIsolation(),
        runtimeClientKind: __tmGetRuntimeClientKind(),
        runtimeMobileClient: __tmIsRuntimeMobileClient(),
        nativeMobileClient: __tmIsNativeMobileRuntimeClient(),
        isMobileDevice: __tmIsMobileDevice(),
    });

    const __tmGetNavigationContext = () => {
        const info = __tmGetRuntimeHostInfo();
        const topWin = __tmResolveNavigationTopWindow(info.isDockHost);
        let topDoc = document;
        try { topDoc = topWin?.document || document; } catch (e) { topDoc = document; }
        const app = globalThis.__tmHost?.getApp?.() || globalThis.__taskHorizonPluginApp || globalThis.__tomatoPluginApp || null;
        return {
            ...info,
            app,
            topWin,
            topDoc,
            closeAfterMobileAction(delayMs = 120) {
                if (!info.runtimeMobileClient) return false;
                setTimeout(() => {
                    try { window.tmClose?.(); } catch (e) {}
                }, Math.max(0, Number(delayMs) || 0));
                return true;
            },
        };
    };

    globalThis.__tmRuntimeHost = {
        readHostMeta: __tmReadHostMeta,
        getMountRoot: __tmGetMountRoot,
        getHostMode: __tmGetMountHostMode,
        hostUsesMobileUI: __tmHostUsesMobileUI,
        usesMobileInteractionUi: __tmUsesMobileInteractionUi,
        isDockHost: __tmIsDockHost,
        isTabHost: __tmIsTabHost,
        isDesktopDockHost: __tmIsDesktopDockHost,
        isDesktopTabHost: __tmIsDesktopTabHost,
        isScopedMobileHost: __tmIsScopedMobileHost,
        usesEmbeddedHostScrollIsolation: __tmUsesEmbeddedHostScrollIsolation,
        getRuntimeClientKind: __tmGetRuntimeClientKind,
        isRuntimeMobileClient: __tmIsRuntimeMobileClient,
        isNativeMobileRuntimeClient: __tmIsNativeMobileRuntimeClient,
        isMobileDevice: __tmIsMobileDevice,
        shouldUseMobileTaskDragLogic: __tmShouldUseMobileTaskDragLogic,
        shouldUseDesktopTaskDragLogic: __tmShouldUseDesktopTaskDragLogic,
        getFloatingMiniDragMode: __tmGetFloatingMiniDragMode,
        shouldUseBrowserTouchTaskDrag: __tmShouldUseBrowserTouchTaskDrag,
        shouldUseCustomTouchTaskDrag: __tmShouldUseCustomTouchTaskDrag,
        getInfo: __tmGetRuntimeHostInfo,
        getNavigationContext: __tmGetNavigationContext,
    };

    const __TM_MOBILE_RUNTIME_CONTAINERS = new Set(['android', 'ios', 'harmony']);

    const __tmGetUserAgentDataMobile = () => {
        try {
            const mobile = navigator?.userAgentData?.mobile;
            return typeof mobile === 'boolean' ? mobile : null;
        } catch (e) {}
        return null;
    };

    const __tmHasAndroidNativeBridge = () => {
        try { return !!globalThis?.JSAndroid; } catch (e) {}
        return false;
    };

    const __tmHasHarmonyNativeBridge = () => {
        try { return !!globalThis?.JSHarmony; } catch (e) {}
        return false;
    };

    const __tmHasIOSNativeBridge = () => {
        try { return !!globalThis?.webkit?.messageHandlers; } catch (e) {}
        return false;
    };

    const __tmIsReferenceMobileBrowserClient = () => {
        const uaDataMobile = __tmGetUserAgentDataMobile();
        if (uaDataMobile === true) return true;
        try {
            const ua = String(navigator?.userAgent || '');
            if (/Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(ua)) return true;
        } catch (e) {}
        try {
            const width = Number(window?.innerWidth) || 0;
            const maxTouchPoints = Number(navigator?.maxTouchPoints) || 0;
            const coarse = !!window.matchMedia?.('(pointer: coarse)')?.matches;
            if ((coarse || maxTouchPoints > 0) && width > 0 && width <= 900) return true;
        } catch (e) {}
        return false;
    };

    const __tmInferReferenceClientKind = () => {
        if (__tmHasAndroidNativeBridge()) return 'android-app';
        if (__tmHasHarmonyNativeBridge()) return 'harmony-app';
        if (__tmHasIOSNativeBridge()) return 'ios-app';
        if (__tmIsReferenceMobileBrowserClient()) return 'mobile-browser';
        return 'desktop-browser';
    };

    const __tmInferReferenceUiMode = () => (__tmInferReferenceClientKind() === 'desktop-browser' ? 'desktop' : 'mobile');

    const __tmDescribeReferenceScenario = (backend, clientKind) => {
        const kernelIsMobile = __TM_MOBILE_RUNTIME_CONTAINERS.has(String(backend || '').trim().toLowerCase());
        const client = String(clientKind || '').trim();
        if (kernelIsMobile) {
            if (client === 'desktop-browser') return '移动端本体 -> 桌面浏览器伺服访问';
            if (client === 'mobile-browser') return '移动端本体 -> 手机浏览器伺服访问';
            return '移动端本体 -> 原生移动客户端';
        }
        if (client === 'desktop-browser') return '桌面端本体 -> 桌面访问';
        if (client === 'mobile-browser') return '桌面端本体 -> 手机浏览器访问';
        return '桌面端本体 -> 原生移动客户端访问';
    };

    const __tmFormatDiagnosticValue = (value) => {
        if (value == null) return '—';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (Array.isArray(value)) return value.length ? value.join(', ') : '[]';
        if (typeof value === 'object') {
            try { return JSON.stringify(value); } catch (e) {}
        }
        const text = String(value).trim();
        return text || '—';
    };

    const __tmGetPluginManifestCompatInfo = () => {
        try {
            const manifest = globalThis.__taskHorizonPluginManifest || globalThis.__taskHorizonPluginInstance?.manifest;
            if (manifest && typeof manifest === 'object') {
                return {
                    version: String(manifest.version || '').trim() || '—',
                    frontends: Array.isArray(manifest.frontends) ? manifest.frontends : ['all'],
                    backends: Array.isArray(manifest.backends) ? manifest.backends : ['all'],
                };
            }
        } catch (e) {}
        return {
            version: '—',
            frontends: ['all'],
            backends: ['all'],
        };
    };

    const __tmBuildDeviceRecognitionSnapshot = () => {
        const backend = __tmGetRuntimeBackendType();
        const config = window?.siyuan?.config || {};
        const system = config?.system || {};
        const referenceClientKind = __tmInferReferenceClientKind();
        const referenceUiMode = __tmInferReferenceUiMode();
        const manifestCompat = __tmGetPluginManifestCompatInfo();
        const currentUiMode = __tmIsMobileDevice() ? 'mobile' : 'desktop';
        return {
            now: new Date().toISOString(),
            plugin: {
                name: 'Task Horizon',
                version: manifestCompat.version,
                frontends: manifestCompat.frontends,
                backends: manifestCompat.backends,
            },
            current: {
                hostMode: __tmGetMountHostMode() || '',
                hostUsesMobileUI: __tmHostUsesMobileUI(),
                runtimeMobileClient: __tmIsRuntimeMobileClient(),
                nativeMobileClient: __tmIsNativeMobileRuntimeClient(),
                mobileDevice: __tmIsMobileDevice(),
                pluginIsMobileFlag: globalThis.__taskHorizonPluginIsMobile,
                pluginIsNativeMobileFlag: globalThis.__taskHorizonPluginIsNativeMobile,
                uiMode: currentUiMode,
            },
            reference: {
                clientKind: referenceClientKind,
                uiMode: referenceUiMode,
                scenario: __tmDescribeReferenceScenario(backend, referenceClientKind),
                differsFromCurrent: currentUiMode !== referenceUiMode,
            },
            runtime: {
                container: String(system?.container || '').trim(),
                os: String(system?.os || '').trim(),
                osPlatform: String(system?.osPlatform || '').trim(),
                networkServe: !!system?.networkServe,
                configIsMobile: typeof config?.isMobile === 'boolean' ? config.isMobile : null,
                siyuanMobileObject: !!window?.siyuan?.mobile,
            },
            bridges: {
                JSAndroid: __tmHasAndroidNativeBridge(),
                JSHarmony: __tmHasHarmonyNativeBridge(),
                webkitMessageHandlers: __tmHasIOSNativeBridge(),
                platformUtils: !!globalThis.__taskHorizonPlatformUtils,
            },
            browser: {
                ua: String(navigator?.userAgent || ''),
                uaDataMobile: __tmGetUserAgentDataMobile(),
                language: String(navigator?.language || ''),
                maxTouchPoints: Number(navigator?.maxTouchPoints) || 0,
                coarsePointer: !!window.matchMedia?.('(pointer: coarse)')?.matches,
                width: Number(window?.innerWidth) || 0,
                height: Number(window?.innerHeight) || 0,
                devicePixelRatio: Number(window?.devicePixelRatio) || 0,
            },
            relatedPlugins: {
                tomatoPluginIsMobile: globalThis.__tomatoPluginIsMobile,
                tomatoPlatformUtils: !!globalThis.__tomatoPlatformUtils,
            },
        };
    };

    const __tmBuildDeviceRecognitionReportText = () => {
        const snapshot = __tmBuildDeviceRecognitionSnapshot();
        return JSON.stringify(snapshot, null, 2);
    };

    function __tmRenderDiagnosticRows(rows) {
        return rows.map(([label, value]) => `
            <div style="padding:8px 10px;border-bottom:1px solid var(--tm-border-color);font-size:12px;color:var(--tm-secondary-text);">${esc(String(label || ''))}</div>
            <div style="padding:8px 10px;border-bottom:1px solid var(--tm-border-color);font-size:12px;color:var(--tm-text-color);word-break:break-all;">${esc(__tmFormatDiagnosticValue(value))}</div>
        `).join('');
    }

    function __tmRenderAboutSettingsPanel() {
        const snapshot = __tmBuildDeviceRecognitionSnapshot();
        const refreshDebugEnabled = SettingsStore?.data?.refreshDebugLogEnabled === true;
        const refreshDebugLogCount = Array.isArray(__tmDebugChannels?.refresh?.log) ? __tmDebugChannels.refresh.log.length : 0;
        const refreshDebugLogLimit = Number((__tmDebugChannels?.refresh && __tmDebugChannels.refresh.limit) || 400);
        const summaryCards = [
            ['当前插件 UI 判定', snapshot.current.uiMode === 'mobile' ? '移动端' : '桌面端'],
            ['参考 UI 判定', snapshot.reference.uiMode === 'mobile' ? '移动端' : '桌面端'],
            ['参考客户端类型', snapshot.reference.clientKind],
            ['访问场景推断', snapshot.reference.scenario],
        ];
        const runtimeRows = [
            ['kernel container', snapshot.runtime.container],
            ['system.os', snapshot.runtime.os],
            ['system.osPlatform', snapshot.runtime.osPlatform],
            ['networkServe', snapshot.runtime.networkServe],
            ['config.isMobile', snapshot.runtime.configIsMobile],
            ['window.siyuan.mobile', snapshot.runtime.siyuanMobileObject],
            ['挂载宿主模式', snapshot.current.hostMode || '—'],
            ['挂载宿主移动 UI', snapshot.current.hostUsesMobileUI],
            ['当前 runtimeMobileClient()', snapshot.current.runtimeMobileClient],
            ['当前 nativeMobileClient()', snapshot.current.nativeMobileClient],
            ['当前 isMobileDevice()', snapshot.current.mobileDevice],
            ['入口层 __taskHorizonPluginIsMobile', snapshot.current.pluginIsMobileFlag],
            ['入口层 __taskHorizonPluginIsNativeMobile', snapshot.current.pluginIsNativeMobileFlag],
        ];
        const browserRows = [
            ['userAgentData.mobile', snapshot.browser.uaDataMobile],
            ['navigator.maxTouchPoints', snapshot.browser.maxTouchPoints],
            ['pointer: coarse', snapshot.browser.coarsePointer],
            ['innerWidth', snapshot.browser.width],
            ['innerHeight', snapshot.browser.height],
            ['devicePixelRatio', snapshot.browser.devicePixelRatio],
            ['language', snapshot.browser.language],
        ];
        const bridgeRows = [
            ['JSAndroid', snapshot.bridges.JSAndroid],
            ['JSHarmony', snapshot.bridges.JSHarmony],
            ['webkit.messageHandlers', snapshot.bridges.webkitMessageHandlers],
            ['__taskHorizonPlatformUtils', snapshot.bridges.platformUtils],
            ['__tomatoPlatformUtils', snapshot.relatedPlugins.tomatoPlatformUtils],
            ['__tomatoPluginIsMobile', snapshot.relatedPlugins.tomatoPluginIsMobile],
        ];
        const pluginRows = [
            ['插件名称', snapshot.plugin.name],
            ['插件版本', snapshot.plugin.version],
            ['plugin.json frontends', snapshot.plugin.frontends],
            ['plugin.json backends', snapshot.plugin.backends],
        ];
        return `
            <div class="tm-settings-panel">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
                    <div>
                        <div style="font-weight:700;font-size:15px;">ℹ️ 关于与设备识别</div>
                        <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:6px;line-height:1.7;">这里会展示当前页面的设备识别结果、原生桥信号、浏览器信号和插件兼容声明，方便排查桌面/移动端误判。</div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="tm-btn tm-btn-secondary" onclick="tmRefreshDeviceRecognitionStatus()">刷新检测</button>
                        <button class="tm-btn tm-btn-primary" onclick="tmCopyDeviceRecognitionReport()">复制诊断</button>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px;">
                    ${summaryCards.map(([label, value]) => `
                        <div style="padding:12px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);">
                            <div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:6px;">${esc(String(label || ''))}</div>
                            <div style="font-size:14px;font-weight:700;color:var(--tm-text-color);word-break:break-word;">${esc(__tmFormatDiagnosticValue(value))}</div>
                        </div>
                    `).join('')}
                </div>

                <div style="margin-bottom:14px;padding:12px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                        <div style="min-width:0;flex:1 1 260px;">
                            <div style="font-weight:600;">后台调试日志</div>
                            <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:6px;line-height:1.7;">关闭后不再记录后台刷新、滚动门禁、自动刷新等诊断日志，并会立即清空当前内存缓存。默认关闭。</div>
                            <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:8px;">当前状态：${refreshDebugEnabled ? '已开启' : '已关闭'} ｜ 缓存 ${refreshDebugLogCount} / ${refreshDebugLogLimit} 条</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            ${refreshDebugLogCount > 0 ? `<button class="tm-btn tm-btn-secondary" onclick="tmClearRefreshDebugLog()">清空缓存</button>` : ''}
                            <label style="display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--tm-border-color);border-radius:999px;background:var(--tm-sidebar-bg);cursor:pointer;">
                                <span style="font-size:12px;color:var(--tm-text-color);">记录日志</span>
                                <input class="b3-switch fn__flex-center" type="checkbox" ${refreshDebugEnabled ? 'checked' : ''} onchange="tmToggleRefreshDebugLog(this.checked)">
                            </label>
                        </div>
                    </div>
                </div>

                ${snapshot.reference.differsFromCurrent ? `
                    <div style="padding:10px 12px;border:1px solid rgba(249,171,0,0.35);background:rgba(249,171,0,0.12);border-radius:10px;color:var(--tm-text-color);font-size:12px;line-height:1.7;margin-bottom:14px;">
                        当前插件判定与“参考判定”不一致。这通常意味着宿主内核、原生桥和当前浏览器信号之间存在冲突，建议复制下方诊断信息用于定位。
                    </div>
                ` : ''}

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;">
                    <div style="border:1px solid var(--tm-border-color);border-radius:10px;overflow:hidden;background:var(--tm-card-bg);">
                        <div style="padding:10px 12px;font-weight:600;background:var(--tm-sidebar-bg);">当前判定链路</div>
                        <div style="display:grid;grid-template-columns:132px minmax(0,1fr);">${__tmRenderDiagnosticRows(runtimeRows)}</div>
                    </div>
                    <div style="border:1px solid var(--tm-border-color);border-radius:10px;overflow:hidden;background:var(--tm-card-bg);">
                        <div style="padding:10px 12px;font-weight:600;background:var(--tm-sidebar-bg);">浏览器与视口信号</div>
                        <div style="display:grid;grid-template-columns:132px minmax(0,1fr);">${__tmRenderDiagnosticRows(browserRows)}</div>
                    </div>
                    <div style="border:1px solid var(--tm-border-color);border-radius:10px;overflow:hidden;background:var(--tm-card-bg);">
                        <div style="padding:10px 12px;font-weight:600;background:var(--tm-sidebar-bg);">原生桥与联动插件</div>
                        <div style="display:grid;grid-template-columns:132px minmax(0,1fr);">${__tmRenderDiagnosticRows(bridgeRows)}</div>
                    </div>
                    <div style="border:1px solid var(--tm-border-color);border-radius:10px;overflow:hidden;background:var(--tm-card-bg);">
                        <div style="padding:10px 12px;font-weight:600;background:var(--tm-sidebar-bg);">插件兼容声明</div>
                        <div style="display:grid;grid-template-columns:132px minmax(0,1fr);">${__tmRenderDiagnosticRows(pluginRows)}</div>
                    </div>
                </div>

                <div style="margin-top:14px;padding:12px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);">
                    <div style="font-weight:600;margin-bottom:8px;">官方/SDK 参考</div>
                    <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.8;">
                        <div><code>system.container</code> 更接近“本体内核运行环境”，不等于“当前访问页面客户端”。</div>
                        <div>SDK <code>platformUtils</code> 来自兼容层，可用于原生能力调用；而当前页面是不是移动端，还需要结合原生桥与浏览器信号判断。</div>
                        <div><code>window.siyuan.mobile</code> 更偏向页面层的移动 UI/状态对象，不应单独当成原生移动桥信号。</div>
                        <div>插件清单支持 <code>frontends</code> / <code>backends</code> 兼容声明，常见前端包括 <code>browser-desktop</code>、<code>browser-mobile</code>、<code>desktop-window</code>。</div>
                    </div>
                </div>

                <details style="margin-top:14px;">
                    <summary style="cursor:pointer;color:var(--tm-primary-color);font-size:12px;">展开原始诊断 JSON</summary>
                    <pre style="margin-top:10px;padding:12px;border-radius:10px;background:var(--tm-sidebar-bg);border:1px solid var(--tm-border-color);font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;">${esc(__tmBuildDeviceRecognitionReportText())}</pre>
                </details>
                <div style="margin-top:10px;font-size:12px;color:var(--tm-secondary-text);line-height:1.7;">浏览器 UA：${esc(snapshot.browser.ua)}</div>
            </div>
        `;
    }

    const __tmShouldShowDocTopbarButton = () => (__tmIsMobileDevice()
        ? (SettingsStore.data.docTopbarButtonMobile !== false)
        : (SettingsStore.data.docTopbarButtonDesktop !== false));

    const __tmShouldSwapDocTopbarButtonPressActions = () => !!SettingsStore.data.docTopbarButtonSwapPressActions;

    function __tmGetDocTopbarButtonPressActionMeta() {
        const swapped = __tmShouldSwapDocTopbarButtonPressActions();
        return swapped
            ? {
                shortLabel: '打开任务管理器',
                longLabel: '快速新建任务',
                shortRun: () => __tmOpenManagerFromDocTopbarEntry(),
                longRun: () => window.tmQuickAddOpen?.(),
            }
            : {
                shortLabel: '快速新建任务',
                longLabel: '打开任务管理器',
                shortRun: () => window.tmQuickAddOpen?.(),
                longRun: () => __tmOpenManagerFromDocTopbarEntry(),
            };
    }

    function __tmGetDocTopbarButtonTitle() {
        const meta = __tmGetDocTopbarButtonPressActionMeta();
        return `短按${meta.shortLabel}，长按${meta.longLabel}`;
    }

    const __tmShouldShowWindowTopbarIcon = () => (__tmIsMobileDevice()
        ? (SettingsStore.data.windowTopbarIconMobile !== false)
        : (SettingsStore.data.windowTopbarIconDesktop !== false));

    const __tmGetFontSize = () => {
        const base = SettingsStore.data.fontSize || 14;
        const mobileSize = SettingsStore.data.fontSizeMobile || base;
        return __tmIsMobileDevice() ? mobileSize : base;
    };

    const __TM_ALL_VIEWS = Object.freeze([
        { id: 'list', label: '表格', longLabel: '表格视图' },
        { id: 'checklist', label: '清单', longLabel: '清单视图' },
        { id: 'timeline', label: '时间轴', longLabel: '时间轴视图' },
        { id: 'kanban', label: '看板', longLabel: '看板视图' },
        { id: 'calendar', label: '日历', longLabel: '日历视图' },
        { id: 'whiteboard', label: '白板', longLabel: '白板视图' },
    ]);

    const __tmNormalizeEnabledViews = (views) => {
        const allow = new Set(__TM_ALL_VIEWS.map(v => v.id));
        const arr = Array.isArray(views) ? views.map(v => String(v || '').trim()).filter(v => allow.has(v)) : [];
        const unique = [];
        for (const id of arr) {
            if (!unique.includes(id)) unique.push(id);
        }
        return unique.length ? unique : ['list'];
    };

    const __tmGetEnabledViews = () => __tmNormalizeEnabledViews(SettingsStore?.data?.enabledViews);

    const __tmIsViewEnabled = (mode) => __tmGetEnabledViews().includes(String(mode || '').trim());

    const __tmGetSafeViewMode = (mode) => {
        const current = String(mode || '').trim();
        const enabled = __tmGetEnabledViews();
        return enabled.includes(current) ? current : (enabled[0] || 'list');
    };

    const __tmGetDockDefaultViewValue = () => {
        const raw = String(SettingsStore?.data?.dockDefaultViewMode || 'follow-mobile').trim();
        return (raw === 'follow-mobile' || __TM_ALL_VIEWS.some(v => v.id === raw)) ? raw : 'follow-mobile';
    };

    const __TM_CHECKLIST_COMPACT_META_FIELD_OPTIONS = Object.freeze([
        { key: 'docName', label: '文档名' },
        { key: 'startDate', label: '开始时间' },
        { key: 'completionTime', label: '截止日期' },
        { key: 'remainingTime', label: '剩余时间' },
        { key: 'duration', label: '时长' },
        { key: 'status', label: '状态标签' },
    ]);

    const __TM_CHECKLIST_COMPACT_META_FIELD_DEFAULTS = Object.freeze(['completionTime', 'status']);

    const __tmNormalizeCompactChecklistMetaFields = (fields, defaults = __TM_CHECKLIST_COMPACT_META_FIELD_DEFAULTS) => {
        const allow = new Set(__TM_CHECKLIST_COMPACT_META_FIELD_OPTIONS.map((item) => item.key));
        const source = Array.isArray(fields) ? fields : defaults;
        const result = [];
        source.forEach((value) => {
            const key = String(value || '').trim();
            if (!allow.has(key) || result.includes(key)) return;
            result.push(key);
        });
        return result;
    };

    const __TM_CHECKLIST_COMPACT_RIGHT_FONT_SIZE_OPTIONS = Object.freeze([
        { key: 'large', label: '大' },
        { key: 'medium', label: '中' },
        { key: 'small', label: '小' },
    ]);

    const __tmNormalizeChecklistCompactRightFontSize = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        if (raw === 'medium' || raw === 'small') return raw;
        return 'large';
    };

    const __tmGetChecklistCompactRightFontSize = () =>
        __tmNormalizeChecklistCompactRightFontSize(SettingsStore?.data?.checklistCompactRightFontSize);

    const __TM_TIMELINE_CARD_FIELD_OPTIONS = Object.freeze([
        { key: 'title', label: '任务名称' },
        { key: 'status', label: '状态标签' },
    ]);

    const __TM_TIMELINE_CARD_FIELD_DEFAULTS = Object.freeze(['title', 'status']);

    const __tmNormalizeTimelineCardFields = (fields, defaults = __TM_TIMELINE_CARD_FIELD_DEFAULTS) => {
        const allow = new Set(__TM_TIMELINE_CARD_FIELD_OPTIONS.map((item) => item.key));
        const source = Array.isArray(fields) ? fields : defaults;
        const result = [];
        source.forEach((value) => {
            const key = String(value || '').trim();
            if (!allow.has(key) || result.includes(key)) return;
            result.push(key);
        });
        return result;
    };

    const __tmGetCompactChecklistMetaFieldsForCurrentHost = () => {
        const isDockHost = __tmIsDesktopDockHost();
        const isMobileHost = __tmIsScopedMobileHost();
        const isCalendarSidebarChecklist = state.__tmCalendarSidebarChecklistRender === true || __tmHasCalendarSidebarChecklist(state.modal);
        if (isDockHost) {
            return __tmNormalizeCompactChecklistMetaFields(SettingsStore?.data?.dockChecklistCompactMetaFields);
        }
        if (isMobileHost) {
            return __tmNormalizeCompactChecklistMetaFields(
                SettingsStore?.data?.mobileChecklistCompactMetaFields,
                SettingsStore?.data?.dockChecklistCompactMetaFields
            );
        }
        if (isCalendarSidebarChecklist) {
            return __tmNormalizeCompactChecklistMetaFields(SettingsStore?.data?.dockChecklistCompactMetaFields);
        }
        return __tmNormalizeCompactChecklistMetaFields(SettingsStore?.data?.desktopChecklistCompactMetaFields);
    };

    const __tmShouldShowCompactChecklistDocName = () => {
        if (state.__tmCalendarSidebarChecklistRender === true) return false;
        if (__tmHasCalendarSidebarChecklist(state.modal)) return false;
        if (__tmIsDesktopDockHost()) return false;
        return true;
    };

    const __tmShouldJumpOnDockChecklistTitleClick = () => {
        const appliesToCurrentHost = __tmIsDesktopDockHost();
        return appliesToCurrentHost
            && !!SettingsStore?.data?.checklistCompactMode
            && !!SettingsStore?.data?.dockChecklistCompactTitleJump;
    };

    const __tmShouldJumpOnMobileChecklistTitleClick = () => {
        const appliesToCurrentHost = __tmIsScopedMobileHost();
        return appliesToCurrentHost
            && !!SettingsStore?.data?.checklistCompactMode
            && !!SettingsStore?.data?.mobileChecklistCompactTitleJump;
    };

    const __tmChecklistTitleClickUsesScopedJumpSettings = () => {
        const appliesToDock = __tmIsDesktopDockHost();
        const appliesToMobile = __tmIsScopedMobileHost();
        return !!SettingsStore?.data?.checklistCompactMode && (appliesToDock || appliesToMobile);
    };

    const __tmShouldOpenTaskDetailPageOnChecklistTitleClick = () =>
        (__tmShouldJumpOnDockChecklistTitleClick() || __tmShouldJumpOnMobileChecklistTitleClick())
        && !!SettingsStore?.data?.checklistCompactTitleOpenDetailPage;

    const __tmShouldOpenChecklistDetailDrawerOnTitleClick = () =>
        __tmShouldOpenTaskDetailPageOnChecklistTitleClick()
        && __tmIsDesktopDockHost();

    const __tmIsTaskTitleClickEvent = (ev) => {
        const selector = '.tm-task-content-clickable,.tm-whiteboard-stream-task-title,.tm-checklist-title,.tm-checklist-title-button > span,.tm-cal-task-event-title,.tm-cal-task-event-title-text';
        const target = ev?.target instanceof Element ? ev.target : null;
        const current = ev?.currentTarget instanceof Element ? ev.currentTarget : null;
        return !!(
            (current?.matches?.(selector))
            || (current?.closest?.(selector))
            || (target?.closest?.(selector))
        );
    };

    const __tmShouldOpenTaskDetailPageOnAnyTitleClick = (ev) =>
        !!SettingsStore?.data?.checklistCompactTitleOpenDetailPage
        && __tmIsTaskTitleClickEvent(ev);

    const __tmGetConfiguredDefaultViewMode = (isMobile = __tmIsMobileDevice()) => {
        let raw = '';
        if (__tmIsDockHost()) {
            const dockMode = __tmGetDockDefaultViewValue();
            raw = dockMode === 'follow-mobile'
                ? String(SettingsStore?.data?.defaultViewModeMobile || SettingsStore?.data?.defaultViewMode || 'checklist').trim()
                : dockMode;
        } else {
            raw = isMobile
                ? String(SettingsStore?.data?.defaultViewModeMobile || SettingsStore?.data?.defaultViewMode || 'checklist').trim()
                : String(SettingsStore?.data?.defaultViewMode || 'checklist').trim();
        }
        return __tmGetSafeViewMode(raw);
    };

    const __tmEscAttr = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const __tmDispatchDockSettingsChanged = (reason = '') => {
        const runtimeMobile = __tmIsRuntimeMobileClient();
        const detail = {
            enabled: !runtimeMobile && SettingsStore?.data?.dockSidebarEnabled !== false,
            defaultViewMode: __tmGetDockDefaultViewValue(),
            reason: String(reason || '').trim()
        };
        try { window.dispatchEvent(new CustomEvent('tm:task-horizon-dock-settings-changed', { detail })); } catch (e) {}
        try {
            if (window.top && window.top !== window) {
                window.top.dispatchEvent(new CustomEvent('tm:task-horizon-dock-settings-changed', { detail }));
            }
        } catch (e) {}
    };

    const __tmTooltipAttrsCache = new Map();

    const __tmBuildTooltipAttrs = (label, opts = {}) => {
        const text = String(label || '').trim();
        if (!text) return '';
        const side = String(opts.side || 'top').trim() || 'top';
        const align = String(opts.align || 'center').trim() || 'center';
        const ariaLabelRaw = opts.ariaLabel === false
            ? ''
            : (opts.ariaLabel == null ? text : String(opts.ariaLabel || ''));
        const ariaLabel = String(ariaLabelRaw || '').trim();
        const cacheKey = `${text}\u0001${side}\u0001${align}\u0001${ariaLabel}`;
        if (__tmTooltipAttrsCache.has(cacheKey)) return __tmTooltipAttrsCache.get(cacheKey) || '';
        const attrs = [
            `data-tm-floating-tooltip-label="${__tmEscAttr(text)}"`,
            `data-tm-tooltip-side="${__tmEscAttr(side)}"`,
            `data-tm-tooltip-align="${__tmEscAttr(align)}"`,
        ];
        if (ariaLabel) attrs.push(`aria-label="${__tmEscAttr(ariaLabel)}"`);
        return __tmRememberSmallCache(__tmTooltipAttrsCache, cacheKey, ` ${attrs.join(' ')}`, 1200);
    };

    const __tmApplyTooltipAttrsToElement = (el, label, opts = {}) => {
        if (!(el instanceof HTMLElement)) return;
        const text = String(label || '').trim();
        const side = String(opts.side || 'top').trim() || 'top';
        const align = String(opts.align || 'center').trim() || 'center';
        if (!text) {
            try { el.removeAttribute('data-tm-floating-tooltip-label'); } catch (e) {}
            try { el.removeAttribute('data-tm-tooltip-side'); } catch (e) {}
            try { el.removeAttribute('data-tm-tooltip-align'); } catch (e) {}
            try { el.removeAttribute('title'); } catch (e) {}
            return;
        }
        try { el.setAttribute('data-tm-floating-tooltip-label', text); } catch (e) {}
        try { el.setAttribute('data-tm-tooltip-side', side); } catch (e) {}
        try { el.setAttribute('data-tm-tooltip-align', align); } catch (e) {}
        try { el.removeAttribute('title'); } catch (e) {}
    };

    function __tmHideFloatingTooltip() {
        try {
            if (state.floatingTooltipHideTimer) {
                clearTimeout(state.floatingTooltipHideTimer);
                state.floatingTooltipHideTimer = null;
            }
        } catch (e) {}
        try { state.floatingTooltipTarget = null; } catch (e) {}
        try { state.floatingTooltipEl?.remove?.(); } catch (e) {}
        state.floatingTooltipEl = null;
    }

    function __tmPositionFloatingTooltip(target, tooltipEl, opts = {}) {
        if (!(target instanceof HTMLElement) || !(tooltipEl instanceof HTMLElement)) return;
        const side = String(opts.side || target.getAttribute('data-tm-tooltip-side') || 'bottom').trim() || 'bottom';
        const gap = 8;
        const margin = 8;
        const rect = target.getBoundingClientRect();
        const tipRect = tooltipEl.getBoundingClientRect();
        let left = rect.left + (rect.width - tipRect.width) / 2;
        left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));
        let top = side === 'top'
            ? rect.top - tipRect.height - gap
            : rect.bottom + gap;
        if (side === 'top' && top < margin) top = Math.min(rect.bottom + gap, window.innerHeight - tipRect.height - margin);
        if (side !== 'top' && top + tipRect.height > window.innerHeight - margin) {
            top = Math.max(margin, rect.top - tipRect.height - gap);
        }
        tooltipEl.style.left = `${Math.round(left)}px`;
        tooltipEl.style.top = `${Math.round(top)}px`;
    }

    function __tmResolveFloatingTooltipZIndex(target, fallback = 64) {
        let maxZ = Number(fallback) || 64;
        let node = target instanceof Element ? target : null;
        while (node && node !== document.body && node !== document.documentElement) {
            try {
                const raw = window.getComputedStyle(node).zIndex;
                const z = Number.parseInt(String(raw || '').trim(), 10);
                if (Number.isFinite(z)) maxZ = Math.max(maxZ, z + 1);
            } catch (e) {}
            node = node.parentElement;
        }
        return maxZ;
    }

    function __tmShowFloatingTooltip(target, label, opts = {}) {
        if (!(target instanceof HTMLElement)) return;
        const text = String(label || '').trim();
        if (!text) {
            __tmHideFloatingTooltip();
            return;
        }
        try {
            if (state.floatingTooltipHideTimer) {
                clearTimeout(state.floatingTooltipHideTimer);
                state.floatingTooltipHideTimer = null;
            }
        } catch (e) {}
        let tooltipEl = state.floatingTooltipEl;
        if (!(tooltipEl instanceof HTMLElement)) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'tm-floating-tooltip';
            tooltipEl.style.position = 'fixed';
            tooltipEl.style.left = '0';
            tooltipEl.style.top = '0';
            tooltipEl.style.maxWidth = 'min(240px, calc(100vw - 24px))';
            tooltipEl.style.padding = '6px 8px';
            tooltipEl.style.border = '1px solid var(--border)';
            tooltipEl.style.borderRadius = 'calc(var(--radius) - 2px)';
            tooltipEl.style.background = 'var(--popover)';
            tooltipEl.style.color = 'var(--popover-foreground)';
            tooltipEl.style.boxShadow = 'var(--shadow-sm)';
            tooltipEl.style.fontSize = '12px';
            tooltipEl.style.fontWeight = '600';
            tooltipEl.style.lineHeight = '1.35';
            tooltipEl.style.whiteSpace = 'normal';
            tooltipEl.style.wordBreak = 'break-word';
            tooltipEl.style.pointerEvents = 'none';
            tooltipEl.style.opacity = '0';
            tooltipEl.style.transition = 'opacity 120ms ease';
            document.body.appendChild(tooltipEl);
            state.floatingTooltipEl = tooltipEl;
        }
        tooltipEl.textContent = text;
        tooltipEl.style.zIndex = String(__tmResolveFloatingTooltipZIndex(target));
        tooltipEl.style.opacity = '0';
        state.floatingTooltipTarget = target;
        __tmPositionFloatingTooltip(target, tooltipEl, opts);
        requestAnimationFrame(() => {
            if (state.floatingTooltipEl === tooltipEl && state.floatingTooltipTarget === target) {
                tooltipEl.style.opacity = '1';
            }
        });
    }

    function __tmBindFloatingTooltips(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        modal.querySelectorAll('[data-tm-floating-tooltip-label]').forEach((el) => {
            if (!(el instanceof HTMLElement) || el.__tmFloatingTooltipBound) return;
            try { el.removeAttribute('title'); } catch (e) {}
            const show = () => {
                try {
                    const text = String(el.getAttribute('data-tm-floating-tooltip-label') || '').trim();
                    const side = String(el.getAttribute('data-tm-tooltip-side') || 'bottom').trim() || 'bottom';
                    const align = String(el.getAttribute('data-tm-tooltip-align') || 'center').trim() || 'center';
                    __tmShowFloatingTooltip(el, text, { side, align });
                } catch (e) {}
            };
            const hide = () => {
                try {
                    if (state.floatingTooltipHideTimer) clearTimeout(state.floatingTooltipHideTimer);
                } catch (e) {}
                state.floatingTooltipHideTimer = setTimeout(() => {
                    if (state.floatingTooltipTarget === el) __tmHideFloatingTooltip();
                }, 40);
            };
            el.addEventListener('mouseenter', show);
            el.addEventListener('focus', show, true);
            el.addEventListener('mouseleave', hide);
            el.addEventListener('blur', hide, true);
            el.addEventListener('mousedown', () => __tmHideFloatingTooltip(), true);
            el.addEventListener('click', () => __tmHideFloatingTooltip(), true);
            el.__tmFloatingTooltipBound = true;
        });
    }

    window.tmBindFloatingTooltipsForTaskModal = function(modalEl) {
        try {
            __tmBindFloatingTooltips(modalEl instanceof Element ? modalEl : state.modal);
            return true;
        } catch (e) {
            return false;
        }
    };

    function __tmSyncTopbarOverflowTooltips(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        modal.querySelectorAll('.tm-topbar-select .bc-select-trigger').forEach((trigger) => {
            if (!(trigger instanceof HTMLElement)) return;
            const labelText = String(trigger.getAttribute('data-tm-tooltip-label') || '').trim();
            const side = String(trigger.getAttribute('data-tm-tooltip-side') || 'bottom').trim() || 'bottom';
            const align = String(trigger.getAttribute('data-tm-tooltip-align') || 'center').trim() || 'center';
            __tmApplyTooltipAttrsToElement(trigger, labelText, { side, align });
        });
    }

    function __tmOnTopbarOverflowTooltipWindowResize() {
        try { __tmSyncTopbarOverflowTooltips(state.modal); } catch (e) {}
    }

    function __tmResolveDockTopbarScrollTarget(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return null;
        if (state.homepageOpen) {
            return modal.querySelector('.tm-body.tm-body--homepage');
        }
        if (state.viewMode === 'timeline') {
            return __tmGetTimelineGlobalScrollHost(modal) || modal.querySelector('#tmTimelineLeftBody');
        }
        if (state.viewMode === 'kanban') {
            return modal.querySelector('.tm-body.tm-body--kanban');
        }
        if (state.viewMode === 'checklist') {
            return modal.querySelector('.tm-checklist-scroll');
        }
        if (state.viewMode === 'whiteboard' && __tmIsWhiteboardAllTabsStreamMode()) {
            return modal.querySelector('.tm-body.tm-body--whiteboard-stream');
        }
        if (state.viewMode === 'calendar') {
            return modal.querySelector('.tm-body.tm-body--calendar');
        }
        return modal.querySelector('.tm-body');
    }

    function __tmBindDockScrollIsolation(modalEl) {
        try {
            state.dockScrollIsolationCleanup?.();
        } catch (e) {}
        state.dockScrollIsolationCleanup = null;
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element) || !__tmUsesEmbeddedHostScrollIsolation()) return;
        const wheelRegions = Array.from(modal.querySelectorAll('.tm-filter-rule-bar, .tm-doc-tabs'))
            .filter((el) => el instanceof HTMLElement);
        if (!wheelRegions.length) return;
        const onTopbarWheel = (event) => {
            const absDeltaX = Math.abs(Number(event.deltaX) || 0);
            const absDeltaY = Math.abs(Number(event.deltaY) || 0);
            const preferHorizontal = absDeltaX > absDeltaY && !event.shiftKey;
            try { event.stopPropagation(); } catch (e) {}
            if (preferHorizontal) return;
            const scrollTarget = __tmResolveDockTopbarScrollTarget(modal);
            if (!(scrollTarget instanceof HTMLElement)) {
                try { event.preventDefault(); } catch (e) {}
                return;
            }
            const maxTop = Math.max(0, Number(scrollTarget.scrollHeight || 0) - Number(scrollTarget.clientHeight || 0));
            if (maxTop <= 0) {
                try { event.preventDefault(); } catch (e) {}
                return;
            }
            const currentTop = Number(scrollTarget.scrollTop || 0);
            const nextTop = Math.max(0, Math.min(maxTop, currentTop + (Number(event.deltaY) || 0)));
            if (Math.abs(nextTop - currentTop) > 0.5) {
                try { scrollTarget.scrollTop = nextTop; } catch (e) {}
            }
            try { event.preventDefault(); } catch (e) {}
        };
        wheelRegions.forEach((el) => {
            try { el.addEventListener('wheel', onTopbarWheel, { passive: false }); } catch (e) {}
        });
        state.dockScrollIsolationCleanup = () => {
            wheelRegions.forEach((el) => {
                try { el.removeEventListener('wheel', onTopbarWheel); } catch (e) {}
            });
        };
    }

    function __tmBindTopbarOverflowTooltips(modalEl) {
        try {
            if (state.topbarOverflowTooltipResizeObserver) {
                state.topbarOverflowTooltipResizeObserver.disconnect();
                state.topbarOverflowTooltipResizeObserver = null;
            }
        } catch (e) {}
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        const sync = () => {
            try { __tmSyncTopbarOverflowTooltips(modal); } catch (e) {}
        };
        sync();
        try { requestAnimationFrame(sync); } catch (e) {}
        try { requestAnimationFrame(() => requestAnimationFrame(sync)); } catch (e) {}
        if (typeof ResizeObserver === 'function') {
            try {
                const ro = new ResizeObserver(() => sync());
                modal.querySelectorAll('.tm-topbar-select, .tm-topbar-select .bc-select-trigger__value').forEach((el) => {
                    if (el instanceof Element) ro.observe(el);
                });
                state.topbarOverflowTooltipResizeObserver = ro;
            } catch (e) {
                state.topbarOverflowTooltipResizeObserver = null;
            }
        }
    }

    if (!window.__tmTopbarOverflowTooltipWindowBound) {
        window.__tmTopbarOverflowTooltipWindowBound = true;
        try { globalThis.__tmRuntimeEvents?.on?.(window, 'resize', __tmOnTopbarOverflowTooltipWindowResize, { passive: true }); } catch (e) {}
    }

    function __tmBindResponsiveTableResize(modalEl) {
        try {
            if (state.tableResponsiveResizeObserver) {
                state.tableResponsiveResizeObserver.disconnect();
                state.tableResponsiveResizeObserver = null;
            }
        } catch (e) {}
        try {
            if (state.tableResponsiveResizeRaf) {
                cancelAnimationFrame(state.tableResponsiveResizeRaf);
                state.tableResponsiveResizeRaf = 0;
            }
        } catch (e) {}
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        const isStreamWhiteboard = state.viewMode === 'whiteboard' && __tmIsWhiteboardAllTabsStreamMode();
        if (state.viewMode !== 'list' && state.viewMode !== 'calendar' && !isStreamWhiteboard) return;
        if (!isStreamWhiteboard && SettingsStore.data.kanbanFillColumns !== true) return;
        const body = modal.querySelector(
            isStreamWhiteboard
                ? '.tm-body.tm-body--whiteboard-stream'
                : (state.viewMode === 'calendar' ? '.tm-body.tm-body--calendar' : '.tm-body')
        );
        if (!(body instanceof HTMLElement)) return;
        let lastWidth = Math.round(Number(body.clientWidth) || 0);
        state.tableResponsiveLastWidth = lastWidth;
        if (typeof ResizeObserver !== 'function') return;
        try {
            const ro = new ResizeObserver(() => {
                const nextWidth = Math.round(Number(body.clientWidth) || 0);
                if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;
                if (Math.abs(nextWidth - lastWidth) < 2) return;
                lastWidth = nextWidth;
                state.tableResponsiveLastWidth = nextWidth;
                try {
                    if (state.tableResponsiveResizeRaf) cancelAnimationFrame(state.tableResponsiveResizeRaf);
                } catch (e) {}
                state.tableResponsiveResizeRaf = requestAnimationFrame(() => {
                    state.tableResponsiveResizeRaf = 0;
                    if (!state.modal || !document.body.contains(state.modal)) return;
                    if (state.viewMode !== 'list' && state.viewMode !== 'calendar' && !(state.viewMode === 'whiteboard' && __tmIsWhiteboardAllTabsStreamMode())) return;
                    try { render(); } catch (e) {}
                });
            });
            ro.observe(body);
            state.tableResponsiveResizeObserver = ro;
        } catch (e) {
            state.tableResponsiveResizeObserver = null;
        }
    }

    function __tmOnFloatingTooltipWindowResize() {
        try { __tmHideFloatingTooltip(); } catch (e) {}
    }

    function __tmOnFloatingTooltipWindowScroll() {
        try { __tmHideFloatingTooltip(); } catch (e) {}
    }

    if (!window.__tmFloatingTooltipWindowBound) {
        window.__tmFloatingTooltipWindowBound = true;
        try { globalThis.__tmRuntimeEvents?.on?.(window, 'resize', __tmOnFloatingTooltipWindowResize, { passive: true }); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(window, 'scroll', __tmOnFloatingTooltipWindowScroll, { passive: true, capture: true }); } catch (e) {}
    }

    function __tmComputeMobileBottomViewbarLayoutSig() {
        const isMobile = __tmIsMobileDevice();
        const isRuntimeMobile = __tmIsRuntimeMobileClient();
        const isDockHost = __tmIsDockHost();
        const hostUsesMobileUI = __tmHostUsesMobileUI();
        const browserBottomGap = __tmComputeMobileBrowserViewportBottomInsetPx();
        const isLandscape = !!(isMobile && (() => { try { return !!window.matchMedia?.('(orientation: landscape)')?.matches; } catch (e) { return false; } })());
        const showMobileBottomViewBar = isDockHost
            ? (!isRuntimeMobile || !isLandscape)
            : !!(isMobile && !isLandscape);
        return `${isMobile ? 1 : 0}|${isRuntimeMobile ? 1 : 0}|${isDockHost ? 1 : 0}|${hostUsesMobileUI ? 1 : 0}|${isLandscape ? 1 : 0}|${showMobileBottomViewBar ? 1 : 0}|${browserBottomGap}`;
    }

    function __tmComputeMobileBrowserViewportBottomInsetPx() {
        if (!__tmShouldUseBrowserTouchTaskDrag()) return 0;
        try {
            const vv = window.visualViewport;
            if (!vv) return 12;
            const clientHeight = Number(document.documentElement?.clientHeight || 0);
            const innerHeight = Number(window.innerHeight || 0);
            const layoutHeight = Math.max(clientHeight, innerHeight, Math.round(Number(vv.height || 0) + Number(vv.offsetTop || 0)));
            const vvBottom = Number(vv.height || 0) + Number(vv.offsetTop || 0);
            const hiddenBottom = Math.max(0, Math.round(layoutHeight - vvBottom));
            return Math.max(12, hiddenBottom);
        } catch (e) {
            return 12;
        }
    }

    function __tmComputeMobileBottomViewbarOffsetCss() {
        const browserBottomGap = __tmComputeMobileBrowserViewportBottomInsetPx();
        return `calc(env(safe-area-inset-bottom, 0px) + ${10 + browserBottomGap}px)`;
    }

    function __tmApplyMobileBrowserViewportMetrics(modalEl) {
        const modal = modalEl instanceof HTMLElement ? modalEl : state.modal;
        if (!(modal instanceof HTMLElement)) return false;
        if (__tmGetRuntimeClientKind() !== 'mobile-browser' || !modal.classList.contains('tm-modal--mobile')) {
            try { modal.style.removeProperty('left'); } catch (e) {}
            try { modal.style.removeProperty('top'); } catch (e) {}
            try { modal.style.removeProperty('width'); } catch (e) {}
            try { modal.style.removeProperty('height'); } catch (e) {}
            try { modal.style.removeProperty('--tm-mobile-browser-visible-height'); } catch (e) {}
            try { modal.style.removeProperty('--tm-mobile-browser-visible-width'); } catch (e) {}
            try { modal.style.removeProperty('--tm-mobile-bottom-browser-gap'); } catch (e) {}
            try { modal.style.removeProperty('--tm-mobile-bottom-viewbar-offset'); } catch (e) {}
            return false;
        }
        try {
            const vv = window.visualViewport;
            const width = Math.max(0, Math.round(Number(vv?.width || window.innerWidth || document.documentElement?.clientWidth || 0)));
            const height = Math.max(0, Math.round(Number(vv?.height || window.innerHeight || document.documentElement?.clientHeight || 0)));
            const offsetLeft = Math.max(0, Math.round(Number(vv?.offsetLeft || 0)));
            const offsetTop = Math.max(0, Math.round(Number(vv?.offsetTop || 0)));
            if (width > 0) {
                modal.style.left = `${offsetLeft}px`;
                modal.style.width = `${width}px`;
                modal.style.setProperty('--tm-mobile-browser-visible-width', `${width}px`);
            }
            if (height > 0) {
                modal.style.top = `${offsetTop}px`;
                modal.style.height = `${height}px`;
                modal.style.setProperty('--tm-mobile-browser-visible-height', `${height}px`);
            }
            modal.style.setProperty('--tm-mobile-bottom-browser-gap', `${__tmComputeMobileBrowserViewportBottomInsetPx()}px`);
            modal.style.setProperty('--tm-mobile-bottom-viewbar-offset', __tmComputeMobileBottomViewbarOffsetCss());
            return true;
        } catch (e) {
            return false;
        }
    }

    function __tmUnbindMobileViewportAutoRefresh() {
        try {
            if (state.mobileViewportRefreshTimer) {
                clearTimeout(state.mobileViewportRefreshTimer);
                state.mobileViewportRefreshTimer = 0;
            }
        } catch (e) {}
        try {
            if (state.mobileViewportRefreshHandler) {
                globalThis.__tmRuntimeEvents?.off?.(window, 'resize', state.mobileViewportRefreshHandler);
                globalThis.__tmRuntimeEvents?.off?.(window, 'orientationchange', state.mobileViewportRefreshHandler);
                globalThis.__tmRuntimeEvents?.off?.(state.mobileViewportRefreshVisualViewport, 'resize', state.mobileViewportRefreshHandler);
                globalThis.__tmRuntimeEvents?.off?.(state.mobileViewportRefreshVisualViewport, 'scroll', state.mobileViewportRefreshHandler);
            }
        } catch (e) {}
        state.mobileViewportRefreshHandler = null;
        state.mobileViewportRefreshVisualViewport = null;
        state.mobileViewportRefreshSig = '';
    }

    function __tmBindMobileViewportAutoRefresh(modalEl) {
        __tmUnbindMobileViewportAutoRefresh();
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        state.mobileViewportRefreshSig = __tmComputeMobileBottomViewbarLayoutSig();
        const onViewportChange = () => {
            try {
                if (state.mobileViewportRefreshTimer) clearTimeout(state.mobileViewportRefreshTimer);
            } catch (e) {}
            state.mobileViewportRefreshTimer = setTimeout(() => {
                state.mobileViewportRefreshTimer = 0;
                if (!state.modal || !document.body.contains(state.modal)) return;
                try { __tmApplyMobileBrowserViewportMetrics(state.modal); } catch (e) {}
                const nextSig = __tmComputeMobileBottomViewbarLayoutSig();
                if (nextSig === state.mobileViewportRefreshSig) return;
                state.mobileViewportRefreshSig = nextSig;
                // 移动端从后台恢复到前台时，visualViewport/resize 可能会抖动多次，
                // 这里避免触发整套面板重绘，减少“像重新打开插件”的感觉。
                const hiddenGap = Date.now() - (Number(__tmWasHiddenAt) || 0);
                if (Number.isFinite(hiddenGap) && hiddenGap >= 0 && hiddenGap < 4000) return;
                try { __tmRerenderCurrentViewInPlace(state.modal); } catch (e) {}
            }, 120);
        };
        state.mobileViewportRefreshHandler = onViewportChange;
        try { globalThis.__tmRuntimeEvents?.on?.(window, 'resize', onViewportChange, { passive: true }); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(window, 'orientationchange', onViewportChange, { passive: true }); } catch (e) {}
        try {
            if (window.visualViewport?.addEventListener) {
                globalThis.__tmRuntimeEvents?.on?.(window.visualViewport, 'resize', onViewportChange, { passive: true });
                globalThis.__tmRuntimeEvents?.on?.(window.visualViewport, 'scroll', onViewportChange, { passive: true });
                state.mobileViewportRefreshVisualViewport = window.visualViewport;
            }
        } catch (e) {}
    }

    const __tmRenderViewSwitcherButtons = (opts = {}) => {
        const activeMode = state.homepageOpen
            ? ''
            : __tmGetSafeViewMode(state.viewMode || SettingsStore.data.defaultViewMode || 'checklist');
        const buttonStyle = opts.compact ? ' style="line-height:28px; padding:0 10px;"' : '';
        const buttons = __tmGetEnabledViews().map((viewId) => {
            const view = __TM_ALL_VIEWS.find(v => v.id === viewId);
            if (!view) return '';
            const extra = view.id === 'calendar'
                ? ' oncontextmenu="return tmHandleCalendarViewButtonContextMenu(event)"'
                : '';
            const active = activeMode === view.id;
            return `<button class="tm-view-seg-item bc-tabs-trigger ${active ? 'tm-view-seg-item--active' : ''}" data-state="${active ? 'active' : 'inactive'}" onclick="tmSwitchViewMode('${view.id}')"${extra} role="tab" aria-selected="${active ? 'true' : 'false'}"${buttonStyle}>${view.label}</button>`;
        }).join('');
        return buttons;
    };

    const __tmRenderTopbarSelect = (opts = {}) => {
        const id = String(opts.id || '').trim();
        const label = String(opts.label || '').trim();
        const options = Array.isArray(opts.options) ? opts.options : [];
        const extraClass = String(opts.className || '').trim();
        const autoWidth = opts.autoWidth !== false;
        const current = options.find((item) => item && item.selected) || options[0] || { label: '' };
        const styleParts = [];
        if (opts.style) styleParts.push(String(opts.style));
        const styleAttr = styleParts.length ? ` style="${__tmEscAttr(styleParts.join(' '))}"` : '';
        const tooltipLabel = String(opts.tooltip || label || current.label || '').trim();
        return `
            <div class="tm-topbar-select ${extraClass}" id="${__tmEscAttr(id)}" data-open="false" data-tm-auto-width="${autoWidth ? 'true' : 'false'}"${styleAttr}>
                <button class="bc-select-trigger" type="button" onclick="tmToggleTopbarSelect('${escSq(id)}', event)" aria-haspopup="listbox" aria-expanded="false" data-tm-tooltip-label="${__tmEscAttr(tooltipLabel)}" data-tm-tooltip-side="bottom" data-tm-tooltip-align="center">
                    <span class="bc-select-trigger__value">${esc(String(current?.label || ''))}</span>
                    <span class="bc-select-trigger__chevron" aria-hidden="true">
                        ${__tmLucideIconSvg('caret-down', { size: 14, className: 'tm-inline-icon__svg' })}
                    </span>
                </button>
                <div class="bc-select-menu" role="listbox" aria-label="${__tmEscAttr(label)}">
                    ${options.map((item) => {
                        const itemValue = String(item?.value || '');
                        const itemLabel = String(item?.label || itemValue);
                        const action = String(item?.action || '').trim();
                        const selected = item?.selected === true;
                        return `<button class="bc-select-option ${selected ? 'is-selected' : ''}" type="button" role="option" aria-selected="${selected ? 'true' : 'false'}" onclick="${__tmEscAttr(action)}; tmCloseTopbarSelects();"><span>${esc(itemLabel)}</span><span class="bc-select-option__check" aria-hidden="true">✓</span></button>`;
                    }).join('')}
                </div>
            </div>
        `;
    };

    const __tmApplyRowHeightVars = () => {
        const px = Number(SettingsStore.data.rowHeightPx);
        if (Number.isFinite(px) && px > 0) {
            try { document.documentElement.style.setProperty('--tm-row-height', `${Math.round(px)}px`); } catch (e) {}
            return;
        }
        try { document.documentElement.style.removeProperty('--tm-row-height'); } catch (e) {}
        const mode = String(SettingsStore.data.rowHeightMode || 'auto').trim() || 'auto';
        const presets = {
            auto: { scale: 1.35, offset: 14, min: 28, max: 48 },
            compact: { scale: 1.25, offset: 12, min: 24, max: 42 },
            normal: { scale: 1.5, offset: 16, min: 32, max: 56 },
            comfortable: { scale: 1.75, offset: 20, min: 38, max: 64 },
        };
        const p = presets[mode] || presets.auto;
        try { document.documentElement.style.setProperty('--tm-row-height-scale', String(p.scale)); } catch (e) {}
        try { document.documentElement.style.setProperty('--tm-row-height-offset', `${p.offset}px`); } catch (e) {}
        try { document.documentElement.style.setProperty('--tm-row-height-min', `${p.min}px`); } catch (e) {}
        try { document.documentElement.style.setProperty('--tm-row-height-max', `${p.max}px`); } catch (e) {}
    };

    const __tmGetWrapConfig = () => {
        const enabled = SettingsStore.data.taskAutoWrapEnabled !== false;
        const contentRaw = Number(SettingsStore.data.taskContentWrapMaxLines);
        const remarkRaw = Number(SettingsStore.data.taskRemarkWrapMaxLines);
        return {
            enabled,
            contentLines: Number.isFinite(contentRaw) ? Math.max(1, Math.min(10, Math.round(contentRaw))) : 3,
            remarkLines: Number.isFinite(remarkRaw) ? Math.max(1, Math.min(10, Math.round(remarkRaw))) : 2,
        };
    };

    const __tmApplyTaskWrapVars = () => {
        const cfg = __tmGetWrapConfig();
        try { document.documentElement.style.setProperty('--tm-task-content-wrap-lines', String(cfg.contentLines)); } catch (e) {}
        try { document.documentElement.style.setProperty('--tm-task-remark-wrap-lines', String(cfg.remarkLines)); } catch (e) {}
    };

    const __tmIsDarkMode = () => {
        try {
            return String(document.documentElement.getAttribute('data-theme-mode') || '').toLowerCase() === 'dark';
        } catch (e) {
            return false;
        }
    };

    function __tmClamp(n, min, max) {
        const v = Number(n);
        if (!Number.isFinite(v)) return min;
        return Math.min(max, Math.max(min, v));
    }

    function __tmNormalizeLiteralHexColor(input) {
        const s = String(input || '').trim();
        const m = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(s);
        if (!m) return '';
        let body = String(m[1] || '').toLowerCase();
        if (body.length === 3 || body.length === 4) body = body.split('').map((ch) => ch + ch).join('');
        return `#${body}`;
    }

    function __tmNormalizeHexColor(input, fallback) {
        const normalize = (value) => {
            const s = String(value || '').trim();
            if (!s) return '';
            const hex = __tmNormalizeLiteralHexColor(s);
            if (hex) return hex;
            if (/^var\(\s*--[a-zA-Z0-9\-_]+(?:\s*,[\s\S]+)?\)$/.test(s)) return s;
            try {
                if (typeof CSS !== 'undefined' && CSS && typeof CSS.supports === 'function' && CSS.supports('color', s)) return s;
            } catch (e) {}
            try {
                if (typeof document !== 'undefined' && document?.createElement) {
                    const probe = document.createElement('span');
                    probe.style.color = '';
                    probe.style.color = s;
                    if (probe.style.color) return s;
                }
            } catch (e) {}
            return '';
        };
        return normalize(input) || normalize(fallback) || '';
    }

    function __tmFormatColorDisplayValue(input) {
        const s = String(input || '').trim();
        if (!s) return '';
        const hex = __tmNormalizeLiteralHexColor(s);
        return hex ? hex.toUpperCase() : s;
    }

    function __tmHexToRgb(hex) {
        const h = __tmNormalizeLiteralHexColor(hex);
        if (!h) return null;
        const r = parseInt(h.slice(1, 3), 16);
        const g = parseInt(h.slice(3, 5), 16);
        const b = parseInt(h.slice(5, 7), 16);
        const a = h.length >= 9 ? parseInt(h.slice(7, 9), 16) / 255 : 1;
        if (![r, g, b, a].every((x) => Number.isFinite(x))) return null;
        return h.length >= 9 ? { r, g, b, a } : { r, g, b };
    }

    function __tmRgbToHex(rgb) {
        const r = __tmClamp(rgb?.r, 0, 255);
        const g = __tmClamp(rgb?.g, 0, 255);
        const b = __tmClamp(rgb?.b, 0, 255);
        const to2 = (n) => Math.round(n).toString(16).padStart(2, '0');
        const a = Number(rgb?.a);
        return Number.isFinite(a)
            ? `#${to2(r)}${to2(g)}${to2(b)}${to2(__tmClamp(a, 0, 1) * 255)}`.toLowerCase()
            : `#${to2(r)}${to2(g)}${to2(b)}`.toLowerCase();
    }

    function __tmRgbToHsl(rgb) {
        const r = __tmClamp(Number(rgb?.r) || 0, 0, 255) / 255;
        const g = __tmClamp(Number(rgb?.g) || 0, 0, 255) / 255;
        const b = __tmClamp(Number(rgb?.b) || 0, 0, 255) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        const d = max - min;
        let h = 0;
        let s = 0;
        if (d !== 0) {
            s = d / (1 - Math.abs(2 * l - 1));
            switch (max) {
                case r:
                    h = 60 * (((g - b) / d) % 6);
                    break;
                case g:
                    h = 60 * (((b - r) / d) + 2);
                    break;
                default:
                    h = 60 * (((r - g) / d) + 4);
                    break;
            }
        }
        if (h < 0) h += 360;
        return { h, s: s * 100, l: l * 100 };
    }

    function __tmMixRgb(a, b, t) {
        const x = __tmClamp(t, 0, 1);
        const aAlpha = Number(a?.a);
        const bAlpha = Number(b?.a);
        const hasAlpha = Number.isFinite(aAlpha) || Number.isFinite(bAlpha);
        return {
            r: Math.round((a.r || 0) + ((b.r || 0) - (a.r || 0)) * x),
            g: Math.round((a.g || 0) + ((b.g || 0) - (a.g || 0)) * x),
            b: Math.round((a.b || 0) + ((b.b || 0) - (a.b || 0)) * x),
            ...(hasAlpha ? { a: __tmClamp((Number.isFinite(aAlpha) ? aAlpha : 1) + ((Number.isFinite(bAlpha) ? bAlpha : 1) - (Number.isFinite(aAlpha) ? aAlpha : 1)) * x, 0, 1) } : {}),
        };
    }

    const __TM_DOC_COLOR_SCHEME_PRESETS = [
        { id: 'random', label: '随机', description: '保持较高区分度，适合通用场景。' },
        { id: 'morandi', label: '莫兰迪', description: '低饱和灰调，更安静耐看。' },
        { id: 'natural', label: '低饱和自然', description: '偏植物和土壤感，柔和但有层次。' },
        { id: 'warm', label: '暖复古', description: '陶土、赭石、焦糖一类暖色调。' },
        { id: 'mist', label: '冷雾灰蓝', description: '雾蓝、灰紫、石板蓝，偏冷静。' },
        { id: 'vivid', label: '高饱和活力', description: '更明快跳脱，区分度最高。' },
        { id: 'custom', label: '自定义主色调', description: '围绕主色自动扩展一组文档色。' }
    ];
    const __TM_DOC_COLOR_SCHEME_IDS = new Set(__TM_DOC_COLOR_SCHEME_PRESETS.map((item) => item.id));

    function __tmGetDocColorSchemePreset(id) {
        const key = String(id || '').trim();
        return __TM_DOC_COLOR_SCHEME_PRESETS.find((item) => item.id === key) || __TM_DOC_COLOR_SCHEME_PRESETS[0];
    }

    function __tmGetDefaultDocColorSchemeConfig(seedFallback = 1) {
        const seed = Number(seedFallback);
        return {
            palette: 'random',
            seed: (Number.isFinite(seed) && seed > 0) ? Math.floor(seed) : 1,
            baseColor: '#3b82f6'
        };
    }

    function __tmNormalizeDocColorSchemePalette(input) {
        const value = String(input || '').trim();
        return __TM_DOC_COLOR_SCHEME_IDS.has(value) ? value : 'random';
    }

    function __tmNormalizeDocColorSchemeConfig(input, options = {}) {
        const source = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
        const seedFallback = Number(options?.seedFallback);
        const fallback = __tmGetDefaultDocColorSchemeConfig(Number.isFinite(seedFallback) ? seedFallback : 1);
        const rawSeed = Number(source.seed);
        const normalized = {
            palette: __tmNormalizeDocColorSchemePalette(source.palette || source.mode),
            seed: (Number.isFinite(rawSeed) && rawSeed > 0) ? Math.floor(rawSeed) : fallback.seed,
            baseColor: __tmNormalizeHexColor(source.baseColor || source.primaryColor, fallback.baseColor) || fallback.baseColor
        };
        if (options?.allowInherit) normalized.inherit = source.inherit !== false;
        return normalized;
    }

    function __tmGetGlobalDocColorSchemeConfig() {
        return __tmNormalizeDocColorSchemeConfig(
            SettingsStore?.data?.docDefaultColorScheme,
            { seedFallback: Number(SettingsStore?.data?.docColorSeed) || 1 }
        );
    }

    function __tmGetCurrentDocGroupForColorScheme(groupId) {
        const gid = String(groupId || SettingsStore?.data?.currentGroupId || 'all').trim() || 'all';
        if (gid === 'all') return null;
        const groups = Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [];
        return groups.find((group) => String(group?.id || '').trim() === gid) || null;
    }

    function __tmGetEffectiveDocColorSchemeConfig(groupId) {
        const globalConfig = __tmGetGlobalDocColorSchemeConfig();
        const group = __tmGetCurrentDocGroupForColorScheme(groupId);
        const groupConfig = __tmNormalizeDocColorSchemeConfig(group?.docColorConfig, {
            allowInherit: true,
            seedFallback: globalConfig.seed
        });
        if (!group || groupConfig.inherit !== false) {
            return {
                ...globalConfig,
                scope: 'global',
                inherit: true,
                groupId: String(group?.id || '').trim() || ''
            };
        }
        return {
            ...groupConfig,
            scope: 'group',
            groupId: String(group?.id || '').trim() || ''
        };
    }

    function __tmDescribeDocColorSchemeConfig(config, options = {}) {
        const normalized = __tmNormalizeDocColorSchemeConfig(config, {
            allowInherit: options?.allowInherit,
            seedFallback: Number(config?.seed) || Number(SettingsStore?.data?.docColorSeed) || 1
        });
        const preset = __tmGetDocColorSchemePreset(normalized.palette);
        if (options?.allowInherit && normalized.inherit !== false) return `继承全局 / ${preset.label}`;
        if (normalized.palette === 'custom') return `${preset.label} · ${String(__tmFormatColorDisplayValue(normalized.baseColor) || '').trim() || '#3B82F6'}`;
        return preset.label;
    }

    function __tmGetDocColorSchemeSummary(groupId) {
        const group = __tmGetCurrentDocGroupForColorScheme(groupId);
        const effective = __tmGetEffectiveDocColorSchemeConfig(groupId);
        const preset = __tmGetDocColorSchemePreset(effective.palette);
        if (!group) return `当前：${preset.label}`;
        const groupConfig = __tmNormalizeDocColorSchemeConfig(group?.docColorConfig, {
            allowInherit: true,
            seedFallback: effective.seed
        });
        if (groupConfig.inherit !== false) return `当前：继承全局 / ${preset.label}`;
        return `当前：${preset.label}`;
    }

    function __tmResolveHueFromBands(hash, bands) {
        const list = Array.isArray(bands) ? bands.filter((band) => Array.isArray(band) && band.length >= 2) : [];
        if (!list.length) return hash % 360;
        const widths = list.map((band) => {
            const start = Number(band[0]) || 0;
            const end = Number(band[1]) || 0;
            return Math.max(1, Math.round(((end - start) + 360) % 360) || Math.max(1, end - start));
        });
        const total = widths.reduce((sum, width) => sum + width, 0) || 360;
        let cursor = hash % total;
        for (let i = 0; i < list.length; i += 1) {
            const width = widths[i];
            if (cursor < width) {
                const start = Number(list[i][0]) || 0;
                return (start + cursor + 360) % 360;
            }
            cursor -= width;
        }
        return hash % 360;
    }

    function __tmBuildAutoDocColorFromScheme(docId, isDark, config) {
        const palette = __tmNormalizeDocColorSchemePalette(config?.palette);
        const seed = Number(config?.seed) || 1;
        const hash = __tmHash32(`${String(docId || '')}:${String(seed)}`);
        if (palette === 'custom') {
            const baseHex = __tmNormalizeHexColor(config?.baseColor, '#3b82f6') || '#3b82f6';
            const rgb = __tmHexToRgb(baseHex) || { r: 59, g: 130, b: 246 };
            const hsl = __tmRgbToHsl(rgb);
            const hueOffset = (((hash >>> 3) % 7) - 3) * (isDark ? 7 : 9);
            const satOffset = ((hash >>> 11) % 15) - 7;
            const lightOffset = ((hash >>> 17) % 15) - 7;
            const hue = (hsl.h + hueOffset + 360) % 360;
            const sat = __tmClamp((isDark ? Math.max(hsl.s, 42) : Math.max(hsl.s, 38)) + satOffset, isDark ? 38 : 30, isDark ? 76 : 72);
            const light = __tmClamp((isDark ? Math.max(hsl.l, 58) : Math.min(hsl.l, 50)) + lightOffset, isDark ? 56 : 34, isDark ? 74 : 56);
            return __tmRgbToHex(__tmHslToRgb(hue, sat, light));
        }
        const schemes = {
            random: {
                bands: [[0, 360]],
                light: { satBase: 62, satSpan: 16, lightBase: 42, lightSpan: 14 },
                dark: { satBase: 58, satSpan: 16, lightBase: 58, lightSpan: 12 }
            },
            morandi: {
                bands: [[0, 360]],
                light: { satBase: 22, satSpan: 14, lightBase: 42, lightSpan: 12 },
                dark: { satBase: 24, satSpan: 12, lightBase: 60, lightSpan: 10 }
            },
            natural: {
                bands: [[30, 90], [102, 164], [172, 212]],
                light: { satBase: 28, satSpan: 18, lightBase: 40, lightSpan: 12 },
                dark: { satBase: 30, satSpan: 16, lightBase: 58, lightSpan: 10 }
            },
            warm: {
                bands: [[8, 60], [64, 86], [330, 356]],
                light: { satBase: 40, satSpan: 18, lightBase: 40, lightSpan: 12 },
                dark: { satBase: 38, satSpan: 18, lightBase: 58, lightSpan: 10 }
            },
            mist: {
                bands: [[188, 220], [224, 254], [260, 292]],
                light: { satBase: 26, satSpan: 16, lightBase: 42, lightSpan: 12 },
                dark: { satBase: 28, satSpan: 16, lightBase: 60, lightSpan: 10 }
            },
            vivid: {
                bands: [[0, 360]],
                light: { satBase: 66, satSpan: 20, lightBase: 40, lightSpan: 12 },
                dark: { satBase: 62, satSpan: 18, lightBase: 60, lightSpan: 10 }
            }
        };
        const preset = schemes[palette] || schemes.random;
        const range = isDark ? preset.dark : preset.light;
        const hue = __tmResolveHueFromBands(hash, preset.bands);
        const sat = range.satBase + ((hash >>> 8) % Math.max(1, range.satSpan));
        const light = range.lightBase + ((hash >>> 16) % Math.max(1, range.lightSpan));
        return __tmRgbToHex(__tmHslToRgb(hue, sat, light));
    }

    function __tmHslToRgb(h, s, l) {
        const hh = ((Number(h) % 360) + 360) % 360;
        const ss = __tmClamp(s, 0, 100) / 100;
        const ll = __tmClamp(l, 0, 100) / 100;
        const c = (1 - Math.abs(2 * ll - 1)) * ss;
        const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
        const m = ll - c / 2;
        let r1 = 0, g1 = 0, b1 = 0;
        if (hh < 60) { r1 = c; g1 = x; b1 = 0; }
        else if (hh < 120) { r1 = x; g1 = c; b1 = 0; }
        else if (hh < 180) { r1 = 0; g1 = c; b1 = x; }
        else if (hh < 240) { r1 = 0; g1 = x; b1 = c; }
        else if (hh < 300) { r1 = x; g1 = 0; b1 = c; }
        else { r1 = c; g1 = 0; b1 = x; }
        return {
            r: Math.round((r1 + m) * 255),
            g: Math.round((g1 + m) * 255),
            b: Math.round((b1 + m) * 255),
        };
    }

    function __tmHash32(str) {
        const s = String(str || '');
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function __tmAutoDocColor(docId, isDark) {
        const effective = __tmGetEffectiveDocColorSchemeConfig();
        return __tmBuildAutoDocColorFromScheme(docId, isDark, effective);
    }

    const __tmCssColorRgbaCache = new Map();
    const __tmGroupBgColorCache = new Map();
    const __tmStatusChipStyleCache = new Map();
    const __tmPriorityChipStyleCache = new Map();
    const __tmDocColorHexCache = new Map();
    let __tmCssColorParseCtx = null;

    function __tmRememberSmallCache(cache, key, value, limit = 400) {
        if (!(cache instanceof Map)) return value;
        try {
            cache.set(key, value);
            if (cache.size > limit) {
                const oldestKey = cache.keys().next().value;
                if (oldestKey !== undefined) cache.delete(oldestKey);
            }
        } catch (e) {}
        return value;
    }

    function __tmGetColorCacheThemeKey() {
        return __tmIsDarkMode() ? 'dark' : 'light';
    }

    function __tmGetCssColorParseCtx() {
        if (__tmCssColorParseCtx) return __tmCssColorParseCtx;
        try {
            const canvas = document.createElement('canvas');
            __tmCssColorParseCtx = canvas.getContext('2d') || null;
        } catch (e) {
            __tmCssColorParseCtx = null;
        }
        return __tmCssColorParseCtx;
    }

    function __tmThemeAdjustHex(hex, isDark) {
        const rgb = __tmHexToRgb(hex);
        if (!rgb) return __tmNormalizeHexColor(hex, '#6ba5ff') || '#6ba5ff';
        const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
        if (isDark) {
            if (lum < 0.42) return __tmRgbToHex(__tmMixRgb(rgb, { r: 255, g: 255, b: 255 }, __tmClamp((0.52 - lum) * 1.2, 0.12, 0.55)));
            return __tmRgbToHex(rgb);
        }
        if (lum > 0.78) return __tmRgbToHex(__tmMixRgb(rgb, { r: 0, g: 0, b: 0 }, __tmClamp((lum - 0.72) * 1.1, 0.10, 0.55)));
        return __tmRgbToHex(rgb);
    }

    function __tmGetReadableTextColor(background, darkText = '#0f172a', lightText = '#ffffff') {
        const rgba = __tmParseCssColorToRgba(background);
        if (!rgba) return lightText;
        const alpha = __tmClamp(Number(rgba.a ?? 1), 0, 1);
        const lum = ((0.2126 * rgba.r + 0.7152 * rgba.g + 0.0722 * rgba.b) / 255) * alpha + (1 - alpha);
        return lum > 0.62 ? darkText : lightText;
    }

    const __tmDocProgressCache = new Map();
    const __TM_DOC_EXPECTED_START_ATTR = 'custom-tm-doc-start-date';
    const __TM_DOC_EXPECTED_DEADLINE_ATTR = 'custom-tm-doc-deadline';
    const __tmDocExpectedMetaCache = new Map();
    const __tmDocExpectedMetaInflight = new Map();
    const __tmDocTabSortMetaWarmupIds = new Set();
    const __tmDocExpectedMetaLatestRequestToken = new Map();
    let __tmDocExpectedMetaRequestSeq = 0;

    function __tmNormalizeDocAliasValue(value) {
        return String(value ?? '').trim();
    }

    function __tmNormalizeDocDisplayNameMode(value) {
        return String(value || '').trim().toLowerCase() === 'alias' ? 'alias' : 'name';
    }

    function __tmGetDocDisplayNameMode() {
        return __tmNormalizeDocDisplayNameMode(SettingsStore?.data?.docDisplayNameMode);
    }

    function __tmFindDocMetaById(docId) {
        const id = String(docId || '').trim();
        if (!id) return null;
        return state.taskTree?.find?.((doc) => String(doc?.id || '').trim() === id)
            || state.allDocuments?.find?.((doc) => String(doc?.id || '').trim() === id)
            || null;
    }

    function __tmGetDocAliasValue(docOrId) {
        const entry = (docOrId && typeof docOrId === 'object') ? docOrId : null;
        const fallbackEntry = entry ? __tmFindDocMetaById(entry?.id) : __tmFindDocMetaById(docOrId);
        return __tmNormalizeDocAliasValue(entry?.alias || fallbackEntry?.alias);
    }

    function __tmGetDocRawName(docOrId, fallback = '未命名文档') {
        const entry = (docOrId && typeof docOrId === 'object') ? docOrId : null;
        const fallbackEntry = entry ? __tmFindDocMetaById(entry?.id) : __tmFindDocMetaById(docOrId);
        const name = String(entry?.name || fallbackEntry?.name || '').trim();
        return name || String(fallback || '').trim() || '未命名文档';
    }

    function __tmGetDocDisplayName(docOrId, fallback = '未命名文档') {
        const rawName = __tmGetDocRawName(docOrId, fallback);
        const alias = __tmGetDocAliasValue(docOrId);
        if (__tmGetDocDisplayNameMode() === 'alias') return alias || rawName;
        return rawName || alias || String(fallback || '').trim() || '未命名文档';
    }

    function __tmRefreshTaskDocDisplayNames(options = {}) {
        const targetDocId = String(options?.docId || '').trim();
        const visited = new Set();
        const visitTask = (task) => {
            if (!task || typeof task !== 'object' || visited.has(task)) return;
            visited.add(task);
            const taskDocId = String(task.docId || task.root_id || '').trim();
            if (!targetDocId || taskDocId === targetDocId) {
                try {
                    const fallbackName = String(task.rawDocName || task.raw_doc_name || task.doc_name || task.docName || '未命名文档').trim() || '未命名文档';
                    normalizeTaskFields(task, fallbackName);
                } catch (e) {}
            }
            if (Array.isArray(task.children)) task.children.forEach(visitTask);
            if (Array.isArray(task.subtasks)) task.subtasks.forEach(visitTask);
        };
        if (state.flatTasks && typeof state.flatTasks === 'object') {
            Object.values(state.flatTasks).forEach(visitTask);
        }
        if (Array.isArray(state.taskTree)) {
            state.taskTree.forEach((doc) => {
                if (Array.isArray(doc?.tasks)) doc.tasks.forEach(visitTask);
                if (Array.isArray(doc?.children)) doc.children.forEach(visitTask);
            });
        }
    }

    function __tmDecodeHtmlEntities(value) {
        const raw = String(value ?? '').trim();
        if (!raw || !/[&]/.test(raw)) return raw;
        const textarea = document.createElement('textarea');
        textarea.innerHTML = raw;
        return textarea.value;
    }

    function __tmReadIalAttrValue(ial, attrName) {
        const source = String(ial || '').trim();
        const key = String(attrName || '').trim();
        if (!source || !key) return '';
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = new RegExp(`${escapedKey}="([^"]*)"`).exec(source);
        if (!match) return '';
        return __tmDecodeHtmlEntities(String(match[1] || '').replace(/\\"/g, '"').replace(/\\\\/g, '\\')).trim();
    }

    function __tmNormalizeDocIconValue(value) {
        return String(value ?? '').trim();
    }

    function __tmGetDocIconValue(docOrId) {
        const entry = (docOrId && typeof docOrId === 'object') ? docOrId : null;
        const fallbackEntry = entry ? __tmFindDocMetaById(entry?.id) : __tmFindDocMetaById(docOrId);
        return __tmNormalizeDocIconValue(entry?.icon || fallbackEntry?.icon);
    }

    function __tmDocIconCodeToEmoji(iconValue) {
        const raw = __tmNormalizeDocIconValue(iconValue).toLowerCase();
        if (!raw || /[./]/.test(raw) || /^https?:\/\//i.test(raw) || /^(?:\/)?api\/icon\//i.test(raw)) return '';
        const parts = raw.split('-').map((part) => String(part || '').trim()).filter(Boolean);
        if (!parts.length || parts.some((part) => !/^[0-9a-f]{1,6}$/.test(part))) return '';
        try {
            return parts.map((part) => String.fromCodePoint(parseInt(part.length < 5 ? `0${part}` : part, 16))).join('');
        } catch (e) {
            return '';
        }
    }

    function __tmResolveDocIconImageSrc(iconValue) {
        const raw = __tmDecodeHtmlEntities(__tmNormalizeDocIconValue(iconValue));
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) return raw;
        if (/^(?:\/)?api\/icon\/getDynamicIcon/i.test(raw)) return raw.startsWith('/') ? raw : `/${raw}`;
        if (raw.includes('.')) {
            if (/^(?:\/)?emojis\//i.test(raw)) return raw.startsWith('/') ? raw : `/${raw}`;
            const encoded = raw.split('/').map((part) => encodeURIComponent(part)).join('/');
            return `/emojis/${encoded}`;
        }
        return '';
    }

    function __tmRenderDocIcon(docOrId, options = {}) {
        const className = ['tm-doc-icon', String(options?.className || '').trim()].filter(Boolean).join(' ');
        const imgClassName = ['tm-doc-icon__img', String(options?.imgClassName || '').trim()].filter(Boolean).join(' ');
        const styleParts = [];
        const size = Number(options?.size);
        if (Number.isFinite(size) && size > 0) {
            styleParts.push(`width:${size}px;`, `height:${size}px;`, `font-size:${size}px;`);
        }
        const extraStyle = String(options?.style || '').trim();
        if (extraStyle) styleParts.push(extraStyle);
        const styleAttr = styleParts.length ? ` style="${__tmEscAttr(styleParts.join(''))}"` : '';
        const iconValue = __tmGetDocIconValue(docOrId);
        const emoji = __tmDocIconCodeToEmoji(iconValue);
        if (emoji) {
            return `<span class="${__tmEscAttr(className)}" aria-hidden="true"${styleAttr}>${esc(emoji)}</span>`;
        }
        const imgSrc = __tmResolveDocIconImageSrc(iconValue);
        if (imgSrc) {
            return `<span class="${__tmEscAttr(className)}" aria-hidden="true"${styleAttr}><img class="${__tmEscAttr(imgClassName)}" src="${__tmEscAttr(imgSrc)}" alt="" draggable="false" referrerpolicy="no-referrer"></span>`;
        }
        if (Object.prototype.hasOwnProperty.call(options || {}, 'fallbackText')) {
            const fallbackText = String(options?.fallbackText ?? '');
            if (fallbackText) {
                return `<span class="${__tmEscAttr(className)}" aria-hidden="true"${styleAttr}>${esc(fallbackText)}</span>`;
            }
        }
        return String(options?.fallbackHtml || '');
    }

    function __tmRenderDocGroupLabel(docOrId, text, options = {}) {
        const cls = ['tm-icon-label', String(options?.className || '').trim()].filter(Boolean).join(' ');
        const style = String(options?.style || '').trim();
        const styleAttr = style ? ` style="${__tmEscAttr(style)}"` : '';
        const size = Number(options?.size);
        const iconSize = Number.isFinite(size) && size > 0 ? size : 14;
        const fallbackHtml = __tmRenderInlineIcon('file-text', { size: iconSize });
        const iconHtml = __tmRenderDocIcon(docOrId, {
            size: iconSize,
            fallbackHtml,
        });
        return `<span class="${cls}"${styleAttr}>${iconHtml}<span>${esc(String(text || ''))}</span></span>`;
    }

    function __tmSyncDocAliasInState(docId, alias) {
        const id = String(docId || '').trim();
        if (!id) return;
        const normalizedAlias = __tmNormalizeDocAliasValue(alias);
        [state.allDocuments, state.taskTree].forEach((list) => {
            if (!Array.isArray(list)) return;
            list.forEach((doc) => {
                if (String(doc?.id || '').trim() !== id) return;
                doc.alias = normalizedAlias;
            });
        });
    }

    async function __tmSaveNativeDocAlias(docId, alias) {
        const id = String(docId || '').trim();
        if (!id || __tmIsOtherBlockTabId(id)) return '';
        const normalizedAlias = __tmNormalizeDocAliasValue(alias);
        await API.setAttrs(id, { alias: normalizedAlias });
        __tmSyncDocAliasInState(id, normalizedAlias);
        __tmRefreshTaskDocDisplayNames({ docId: id });
        return normalizedAlias;
    }

    function __tmParseDateOnlyToLocalNoonTs(value) {
        const s = String(value || '').trim();
        if (!s) return 0;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
            const y = Number(m[1]);
            const mon = Number(m[2]) - 1;
            const d = Number(m[3]);
            const dt = new Date(y, mon, d, 12, 0, 0, 0);
            return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
        }
        const t = new Date(s).getTime();
        return Number.isNaN(t) ? 0 : t;
    }

    function __tmNormalizeDocExpectedMeta(meta) {
        return {
            startDate: __tmNormalizeDateOnly(meta?.startDate || ''),
            deadline: __tmNormalizeDateOnly(meta?.deadline || ''),
        };
    }

    function __tmGetCachedDocExpectedMeta(docId) {
        const id = String(docId || '').trim();
        if (!id || !__tmDocExpectedMetaCache.has(id)) return null;
        return __tmDocExpectedMetaCache.get(id) || null;
    }

    function __tmRememberDocExpectedMeta(docId, meta) {
        const id = String(docId || '').trim();
        if (!id) return __tmNormalizeDocExpectedMeta({});
        const normalized = __tmNormalizeDocExpectedMeta(meta);
        __tmDocExpectedMetaCache.set(id, normalized);
        return normalized;
    }

    async function __tmLoadDocExpectedMeta(docId, force = false) {
        const id = String(docId || '').trim();
        if (!id || __tmIsOtherBlockTabId(id)) return __tmNormalizeDocExpectedMeta({});
        if (!force) {
            const cached = __tmGetCachedDocExpectedMeta(id);
            if (cached) return cached;
            if (__tmDocExpectedMetaInflight.has(id)) {
                return await __tmDocExpectedMetaInflight.get(id);
            }
        }
        const requestToken = ++__tmDocExpectedMetaRequestSeq;
        __tmDocExpectedMetaLatestRequestToken.set(id, requestToken);
        let requestPromise = null;
        requestPromise = (async () => {
            try {
                const res = await API.call('/api/attr/getBlockAttrs', { id });
                const attrs = (res && res.code === 0 && res.data && typeof res.data === 'object') ? res.data : {};
                const nextMeta = {
                    startDate: attrs[__TM_DOC_EXPECTED_START_ATTR],
                    deadline: attrs[__TM_DOC_EXPECTED_DEADLINE_ATTR],
                };
                if (__tmDocExpectedMetaLatestRequestToken.get(id) !== requestToken) {
                    return __tmGetCachedDocExpectedMeta(id) || __tmNormalizeDocExpectedMeta(nextMeta);
                }
                return __tmRememberDocExpectedMeta(id, nextMeta);
            } catch (e) {
                if (__tmDocExpectedMetaLatestRequestToken.get(id) !== requestToken) {
                    return __tmGetCachedDocExpectedMeta(id) || __tmNormalizeDocExpectedMeta({});
                }
                return __tmRememberDocExpectedMeta(id, {});
            } finally {
                if (__tmDocExpectedMetaInflight.get(id) === requestPromise) {
                    __tmDocExpectedMetaInflight.delete(id);
                }
            }
        })();
        __tmDocExpectedMetaInflight.set(id, requestPromise);
        return await requestPromise;
    }

    function __tmComputeDocExpectedProgressPercent(meta) {
        const normalized = __tmNormalizeDocExpectedMeta(meta);
        const startTs = __tmParseDateOnlyToLocalNoonTs(normalized.startDate);
        const endTs = __tmParseDateOnlyToLocalNoonTs(normalized.deadline);
        if (!startTs || !endTs) return null;
        if (endTs < startTs) return null;
        const todayTs = __tmParseDateOnlyToLocalNoonTs(__tmNormalizeDateOnly(new Date()));
        if (!todayTs) return null;
        if (endTs === startTs) return todayTs < startTs ? 0 : 100;
        if (todayTs <= startTs) return 0;
        if (todayTs >= endTs) return 100;
        return Math.min(100, Math.max(0, Math.round(((todayTs - startTs) / (endTs - startTs)) * 100)));
    }

    function __tmFormatDocExpectedProgressTip(meta) {
        const normalized = __tmNormalizeDocExpectedMeta(meta);
        if (!normalized.startDate && !normalized.deadline) return '';
        const base = `${normalized.startDate || '未设置'} → ${normalized.deadline || '未设置'}`;
        const percent = __tmComputeDocExpectedProgressPercent(normalized);
        return percent == null ? base : `${base}（${percent}%）`;
    }

    function __tmApplyDocExpectedProgress(el, meta) {
        if (!(el instanceof HTMLElement)) return;
        const percent = __tmComputeDocExpectedProgressPercent(meta);
        if (percent == null) {
            el.style.width = '0%';
            el.classList.remove('is-visible');
            return;
        }
        el.style.width = `${percent}%`;
        el.classList.add('is-visible');
    }

    function __tmIsDocExpectedRangeInvalid(meta) {
        const normalized = __tmNormalizeDocExpectedMeta(meta);
        const startTs = __tmParseDateOnlyToLocalNoonTs(normalized.startDate);
        const endTs = __tmParseDateOnlyToLocalNoonTs(normalized.deadline);
        return !!(startTs && endTs && endTs < startTs);
    }

    async function __tmSaveDocExpectedMetaField(docId, field, value) {
        const id = String(docId || '').trim();
        if (!id) return __tmNormalizeDocExpectedMeta({});
        const normalizedValue = value ? __tmNormalizeDateOnly(value) : '';
        const attrKey = field === 'startDate' ? __TM_DOC_EXPECTED_START_ATTR : __TM_DOC_EXPECTED_DEADLINE_ATTR;
        await API.setAttrs(id, { [attrKey]: normalizedValue });
        return await __tmLoadDocExpectedMeta(id, true);
    }

    window.__tmUpdateDocTabProgress = async (docId, elId, expectedElId) => {
        const el = elId ? document.getElementById(elId) : null;
        const expectedEl = expectedElId ? document.getElementById(expectedElId) : null;
        if (!el && !expectedEl) return;

        if (el && __tmDocProgressCache.has(docId)) {
            const cachedPercent = __tmDocProgressCache.get(docId);
            el.style.width = `${cachedPercent}%`;
        }

        const cachedExpectedMeta = expectedEl ? __tmGetCachedDocExpectedMeta(docId) : null;
        if (expectedEl && cachedExpectedMeta) {
            __tmApplyDocExpectedProgress(expectedEl, cachedExpectedMeta);
        }

        const progressPromise = el ? (async () => {
            const sql = `SELECT
                (SELECT count(*) FROM blocks WHERE root_id = '${docId}' AND type='i' AND subtype='t') as total,
                (SELECT count(*) FROM blocks WHERE root_id = '${docId}' AND type='i' AND subtype='t' AND markdown LIKE '%[x]%') as completed
                LIMIT 1`;
            try {
                const res = await fetch("/api/query/sql", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ stmt: sql }),
                }).then(r => r.json());
                return res.data?.[0] || null;
            } catch (e) {
                return null;
            }
        })() : Promise.resolve(null);

        const expectedPromise = expectedEl
            ? (cachedExpectedMeta || __tmLoadDocExpectedMeta(docId))
            : Promise.resolve(null);

        const [data, expectedMeta] = await Promise.all([progressPromise, expectedPromise]);

        if (el && data) {
            const total = Number(data.total) || 0;
            const completed = Number(data.completed) || 0;
            let percent = 0;
            if (total > 0) {
                percent = Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
            }
            if (__tmDocProgressCache.get(docId) !== percent) {
                __tmDocProgressCache.set(docId, percent);
            }
            el.style.width = `${percent}%`;
        }

        if (expectedEl) {
            __tmApplyDocExpectedProgress(expectedEl, expectedMeta || {});
        }
    };

    function __tmGetDocColorHex(docId, isDark) {
        const id = String(docId || '').trim();
        const map = (SettingsStore?.data?.docColorMap && typeof SettingsStore.data.docColorMap === 'object') ? SettingsStore.data.docColorMap : null;
        const rawInput = map ? String(map[id] || '').trim() : '';
        const effective = __tmGetEffectiveDocColorSchemeConfig();
        const cacheKey = `${isDark ? 1 : 0}|${id}|${rawInput}|${effective.groupId || 'all'}|${effective.scope}|${effective.palette}|${effective.seed}|${effective.baseColor || ''}`;
        if (__tmDocColorHexCache.has(cacheKey)) return __tmDocColorHexCache.get(cacheKey);
        const raw = rawInput ? __tmNormalizeHexColor(rawInput, '') : '';
        const resolved = raw ? __tmThemeAdjustHex(raw, isDark) : __tmBuildAutoDocColorFromScheme(id, isDark, effective);
        return __tmRememberSmallCache(__tmDocColorHexCache, cacheKey, resolved, 1000);
    }

    window.tmGetDocColorHex = function(docId, options = {}) {
        const id = String(docId || '').trim();
        if (!id) return '';
        const opts = (options && typeof options === 'object') ? options : {};
        const isDark = (typeof opts.isDark === 'boolean') ? opts.isDark : __tmIsDarkMode();
        return __tmGetDocColorHex(id, isDark) || '';
    };

    function __tmDarkenHex(hex, amount) {
        const rgb = __tmHexToRgb(hex);
        if (!rgb) return __tmNormalizeHexColor(hex, '#6ba5ff') || '#6ba5ff';
        const t = __tmClamp(amount, 0, 1);
        return __tmRgbToHex(__tmMixRgb(rgb, { r: 0, g: 0, b: 0 }, t));
    }

    function __tmDesaturateHex(hex, amount) {
        const rgb = __tmHexToRgb(hex);
        if (!rgb) return __tmNormalizeHexColor(hex, '#6ba5ff') || '#6ba5ff';
        const t = __tmClamp(amount, 0, 1);
        const g = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
        return __tmRgbToHex(__tmMixRgb(rgb, { r: g, g: g, b: g }, t));
    }

    function __tmGetHeadingSubgroupLabelColor(colorStr, isDark) {
        const rgba = __tmParseCssColorToRgba(colorStr);
        if (!rgba) return 'var(--tm-secondary-text)';
        const baseHex = __tmRgbToHex({
            r: Math.round(rgba.r),
            g: Math.round(rgba.g),
            b: Math.round(rgba.b),
        });
        const desaturated = __tmDesaturateHex(baseHex, isDark ? 0.22 : 0.34);
        return __tmDarkenHex(desaturated, isDark ? 0.12 : 0.18);
    }

    function __tmParseCssColorToRgba(input) {
        const s0 = String(input || '').trim();
        if (!s0) return null;
        const cacheKey = `${__tmGetColorCacheThemeKey()}|${s0}`;
        if (__tmCssColorRgbaCache.has(cacheKey)) {
            const cached = __tmCssColorRgbaCache.get(cacheKey);
            return cached || null;
        }
        const hex = __tmNormalizeLiteralHexColor(s0);
        if (hex) {
            const rgb = __tmHexToRgb(hex);
            const out = rgb ? { r: rgb.r, g: rgb.g, b: rgb.b, a: __tmClamp(Number(rgb.a ?? 1), 0, 1) } : null;
            __tmRememberSmallCache(__tmCssColorRgbaCache, cacheKey, out, 600);
            return out;
        }
        const rgbm = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+)\s*)?\)$/.exec(s0);
        if (rgbm) {
            const r = __tmClamp(Number(rgbm[1]), 0, 255);
            const g = __tmClamp(Number(rgbm[2]), 0, 255);
            const b = __tmClamp(Number(rgbm[3]), 0, 255);
            const a = rgbm[4] === undefined ? 1 : __tmClamp(Number(rgbm[4]), 0, 1);
            const out = { r, g, b, a };
            __tmRememberSmallCache(__tmCssColorRgbaCache, cacheKey, out, 600);
            return out;
        }
        const varMatch = /^var\(\s*(--[a-zA-Z0-9\-_]+)(?:\s*,\s*([\s\S]+))?\)$/.exec(s0);
        if (varMatch) {
            try {
                const host = document.documentElement || document.body;
                const resolvedVar = String(host ? getComputedStyle(host).getPropertyValue(varMatch[1]) : '').trim();
                const fallback = String(varMatch[2] || '').trim();
                const next = resolvedVar || fallback;
                const out = (!next || next === s0) ? null : __tmParseCssColorToRgba(next);
                __tmRememberSmallCache(__tmCssColorRgbaCache, cacheKey, out, 600);
                return out;
            } catch (e) {
                __tmRememberSmallCache(__tmCssColorRgbaCache, cacheKey, null, 600);
                return null;
            }
        }
        try {
            const probe = document.createElement('span');
            probe.style.color = '';
            probe.style.color = s0;
            const normalized = String(probe.style.color || '').trim();
            if (!normalized) {
                __tmRememberSmallCache(__tmCssColorRgbaCache, cacheKey, null, 600);
                return null;
            }
            const ctx = __tmGetCssColorParseCtx();
            if (ctx) {
                try {
                    ctx.fillStyle = '#010203';
                    ctx.fillStyle = normalized;
                    const canvasColor = String(ctx.fillStyle || '').trim();
                    if (canvasColor) {
                        const out = (canvasColor === s0) ? null : (__tmParseCssColorToRgba(canvasColor) || __tmParseCssColorToRgba(normalized));
                        __tmRememberSmallCache(__tmCssColorRgbaCache, cacheKey, out, 600);
                        return out;
                    }
                } catch (e) {}
            }
            const out = normalized !== s0 ? __tmParseCssColorToRgba(normalized) : null;
            __tmRememberSmallCache(__tmCssColorRgbaCache, cacheKey, out, 600);
            return out;
        } catch (e) {}
        __tmRememberSmallCache(__tmCssColorRgbaCache, cacheKey, null, 600);
        return null;
    }

    function __tmGroupBgFromLabelColor(colorStr, isDark) {
        const cacheKey = `${isDark ? 1 : 0}|${String(colorStr || '').trim()}`;
        if (__tmGroupBgColorCache.has(cacheKey)) return __tmGroupBgColorCache.get(cacheKey) || '';
        const rgba = __tmParseCssColorToRgba(colorStr);
        if (!rgba) return '';
        const alpha0 = __tmClamp(Number(rgba.a ?? 1), 0, 1);
        const g = Math.round(0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b);
        const mixBase = isDark ? 0.42 : 0.34;
        const mixExtra = (1 - alpha0) * (isDark ? 0.18 : 0.22);
        const mix = __tmClamp(mixBase + mixExtra, 0, 0.9);
        const soft = __tmMixRgb(rgba, { r: g, g: g, b: g }, mix);
        const baseA = isDark ? 0.22 : 0.10;
        const a = baseA * alpha0;
        const out = `rgba(${soft.r}, ${soft.g}, ${soft.b}, ${a})`;
        return __tmRememberSmallCache(__tmGroupBgColorCache, cacheKey, out, 400);
    }

    function __tmGetPendingTimeGroupTaskBg(isDark) {
        const raw = String(
            isDark
                ? (SettingsStore.data?.timeGroupPendingTaskBgColorDark || '#8ab4f8')
                : (SettingsStore.data?.timeGroupPendingTaskBgColorLight || '#9aa0a6')
        ).trim();
        const normalized = __tmNormalizeHexColor(raw, isDark ? '#8ab4f8' : '#9aa0a6') || (isDark ? '#8ab4f8' : '#9aa0a6');
        return __tmGroupBgFromLabelColor(normalized, isDark);
    }

    function __tmWithAlpha(hex, alpha) {
        const rgba = __tmParseCssColorToRgba(hex);
        if (!rgba) return String(hex || '').trim();
        const a = __tmClamp(alpha, 0, 1) * __tmClamp(Number(rgba.a ?? 1), 0, 1);
        return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${a})`;
    }

    function __tmScaleColorAlpha(color, factor) {
        const rgba = __tmParseCssColorToRgba(color);
        if (!rgba) return String(color || '').trim();
        const a = __tmClamp(Number(rgba.a ?? 1) * __tmClamp(Number(factor), 0, 3), 0, 1);
        return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${a})`;
    }

    const __TM_THEME_TOKEN_KEYS = new Set([
        'background', 'foreground',
        'sidebar',
        'card', 'card-foreground',
        'popover', 'popover-foreground',
        'primary', 'primary-foreground',
        'secondary', 'secondary-foreground',
        'muted', 'muted-foreground',
        'accent', 'accent-foreground',
        'destructive', 'destructive-foreground',
        'border', 'input', 'ring',
        'success', 'warning', 'info'
    ]);
    const __TM_THEME_TOKEN_KEY_ALIASES = Object.freeze({
        'background-sidebar': 'sidebar',
        'bg-sidebar': 'sidebar',
        'sidebar-background': 'sidebar',
    });
    const __TM_TWEAKCN_URL = 'https://tweakcn.com';

    const __TM_THEME_PRESETS = [
        {
            id: 'task-horizon-slate',
            name: 'Modern Minimal',
            description: '克制蓝灰，适合作为默认工作主题。',
            light: {
                background: '#ffffff',
                foreground: '#333333',
                card: '#ffffff',
                'card-foreground': '#333333',
                popover: '#ffffff',
                'popover-foreground': '#333333',
                primary: '#3b82f6',
                'primary-foreground': '#ffffff',
                secondary: '#f3f4f6',
                'secondary-foreground': '#4b5563',
                muted: '#f9fafb',
                'muted-foreground': '#6b7280',
                accent: '#e0f2fe',
                'accent-foreground': '#1e3a8a',
                destructive: '#ef4444',
                'destructive-foreground': '#ffffff',
                border: '#e5e7eb',
                input: '#e5e7eb',
                ring: '#3b82f6',
                success: 'hsl(142 71% 45%)',
                warning: 'hsl(38 92% 50%)',
                info: 'hsl(199 89% 48%)'
            },
            dark: {
                background: '#171717',
                foreground: '#e5e5e5',
                card: '#262626',
                'card-foreground': '#e5e5e5',
                popover: '#262626',
                'popover-foreground': '#e5e5e5',
                primary: '#3b82f6',
                'primary-foreground': '#ffffff',
                secondary: '#262626',
                'secondary-foreground': '#e5e5e5',
                muted: '#1f1f1f',
                'muted-foreground': '#a3a3a3',
                accent: '#1e3a8a',
                'accent-foreground': '#bfdbfe',
                destructive: '#ef4444',
                'destructive-foreground': '#ffffff',
                border: '#404040',
                input: '#404040',
                ring: '#3b82f6',
                success: 'hsl(142 71% 52%)',
                warning: 'hsl(40 96% 60%)',
                info: 'hsl(199 94% 56%)'
            }
        },
        {
            id: 'task-horizon-warm-stone',
            name: 'Warm Stone',
            description: '暖灰米色，阅读感更柔和。',
            light: {
                background: 'hsl(36 33% 97%)',
                foreground: 'hsl(24 10% 10%)',
                card: 'hsl(36 24% 99%)',
                'card-foreground': 'hsl(24 10% 10%)',
                popover: 'hsl(36 24% 99%)',
                'popover-foreground': 'hsl(24 10% 10%)',
                primary: 'hsl(23 79% 50%)',
                'primary-foreground': 'hsl(36 24% 99%)',
                secondary: 'hsl(32 23% 92%)',
                'secondary-foreground': 'hsl(24 10% 14%)',
                muted: 'hsl(30 20% 93%)',
                'muted-foreground': 'hsl(25 8% 40%)',
                accent: 'hsl(42 90% 88%)',
                'accent-foreground': 'hsl(24 18% 22%)',
                destructive: 'hsl(0 72% 54%)',
                'destructive-foreground': 'hsl(36 24% 99%)',
                border: 'hsl(30 16% 86%)',
                input: 'hsl(30 16% 86%)',
                ring: 'hsl(23 79% 50%)',
                success: 'hsl(142 65% 38%)',
                warning: 'hsl(35 92% 50%)',
                info: 'hsl(204 78% 44%)'
            },
            dark: {
                background: 'hsl(24 10% 11%)',
                foreground: 'hsl(35 25% 94%)',
                card: 'hsl(24 9% 14%)',
                'card-foreground': 'hsl(35 25% 94%)',
                popover: 'hsl(24 9% 14%)',
                'popover-foreground': 'hsl(35 25% 94%)',
                primary: 'hsl(28 88% 62%)',
                'primary-foreground': 'hsl(20 14% 10%)',
                secondary: 'hsl(25 10% 18%)',
                'secondary-foreground': 'hsl(35 25% 94%)',
                muted: 'hsl(25 10% 18%)',
                'muted-foreground': 'hsl(34 11% 68%)',
                accent: 'hsl(30 38% 22%)',
                'accent-foreground': 'hsl(35 25% 94%)',
                destructive: 'hsl(0 72% 62%)',
                'destructive-foreground': 'hsl(35 25% 94%)',
                border: 'hsl(25 8% 26%)',
                input: 'hsl(25 8% 26%)',
                ring: 'hsl(28 88% 62%)',
                success: 'hsl(142 60% 48%)',
                warning: 'hsl(39 96% 62%)',
                info: 'hsl(204 88% 62%)'
            }
        },
        {
            id: 'task-horizon-forest',
            name: 'Forest Slate',
            description: '森林中性，强调色偏青绿。',
            light: {
                background: 'hsl(160 28% 97%)',
                foreground: 'hsl(170 28% 12%)',
                card: 'hsl(0 0% 100%)',
                'card-foreground': 'hsl(170 28% 12%)',
                popover: 'hsl(0 0% 100%)',
                'popover-foreground': 'hsl(170 28% 12%)',
                primary: 'hsl(165 65% 36%)',
                'primary-foreground': 'hsl(160 28% 97%)',
                secondary: 'hsl(160 20% 92%)',
                'secondary-foreground': 'hsl(170 28% 14%)',
                muted: 'hsl(160 18% 93%)',
                'muted-foreground': 'hsl(170 12% 38%)',
                accent: 'hsl(154 46% 88%)',
                'accent-foreground': 'hsl(170 28% 18%)',
                destructive: 'hsl(0 75% 54%)',
                'destructive-foreground': 'hsl(160 28% 97%)',
                border: 'hsl(160 16% 86%)',
                input: 'hsl(160 16% 86%)',
                ring: 'hsl(165 65% 36%)',
                success: 'hsl(145 63% 40%)',
                warning: 'hsl(37 92% 48%)',
                info: 'hsl(197 82% 44%)'
            },
            dark: {
                background: 'hsl(173 27% 10%)',
                foreground: 'hsl(160 24% 95%)',
                card: 'hsl(172 24% 13%)',
                'card-foreground': 'hsl(160 24% 95%)',
                popover: 'hsl(172 24% 13%)',
                'popover-foreground': 'hsl(160 24% 95%)',
                primary: 'hsl(162 63% 52%)',
                'primary-foreground': 'hsl(173 27% 10%)',
                secondary: 'hsl(168 15% 18%)',
                'secondary-foreground': 'hsl(160 24% 95%)',
                muted: 'hsl(168 15% 18%)',
                'muted-foreground': 'hsl(160 12% 68%)',
                accent: 'hsl(164 33% 22%)',
                'accent-foreground': 'hsl(160 24% 95%)',
                destructive: 'hsl(0 72% 62%)',
                'destructive-foreground': 'hsl(160 24% 95%)',
                border: 'hsl(168 13% 24%)',
                input: 'hsl(168 13% 24%)',
                ring: 'hsl(162 63% 52%)',
                success: 'hsl(145 63% 52%)',
                warning: 'hsl(40 96% 60%)',
                info: 'hsl(196 92% 62%)'
            }
        },
        {
            id: 'task-horizon-graphite',
            name: 'Graphite',
            description: '更冷静的石墨灰配蓝光强调。',
            light: {
                background: 'hsl(220 14% 96%)',
                foreground: 'hsl(222 26% 14%)',
                card: 'hsl(0 0% 100%)',
                'card-foreground': 'hsl(222 26% 14%)',
                popover: 'hsl(0 0% 100%)',
                'popover-foreground': 'hsl(222 26% 14%)',
                primary: 'hsl(223 68% 54%)',
                'primary-foreground': 'hsl(210 40% 98%)',
                secondary: 'hsl(220 16% 91%)',
                'secondary-foreground': 'hsl(222 26% 16%)',
                muted: 'hsl(220 16% 92%)',
                'muted-foreground': 'hsl(220 10% 42%)',
                accent: 'hsl(222 82% 92%)',
                'accent-foreground': 'hsl(224 64% 24%)',
                destructive: 'hsl(0 72% 51%)',
                'destructive-foreground': 'hsl(210 40% 98%)',
                border: 'hsl(220 13% 84%)',
                input: 'hsl(220 13% 84%)',
                ring: 'hsl(223 68% 54%)',
                success: 'hsl(142 69% 40%)',
                warning: 'hsl(38 92% 50%)',
                info: 'hsl(207 90% 48%)'
            },
            dark: {
                background: 'hsl(222 22% 9%)',
                foreground: 'hsl(210 16% 94%)',
                card: 'hsl(222 18% 12%)',
                'card-foreground': 'hsl(210 16% 94%)',
                popover: 'hsl(222 18% 12%)',
                'popover-foreground': 'hsl(210 16% 94%)',
                primary: 'hsl(221 83% 66%)',
                'primary-foreground': 'hsl(222 22% 9%)',
                secondary: 'hsl(223 15% 17%)',
                'secondary-foreground': 'hsl(210 16% 94%)',
                muted: 'hsl(223 15% 17%)',
                'muted-foreground': 'hsl(217 10% 68%)',
                accent: 'hsl(223 32% 22%)',
                'accent-foreground': 'hsl(210 16% 94%)',
                destructive: 'hsl(0 72% 62%)',
                'destructive-foreground': 'hsl(210 16% 94%)',
                border: 'hsl(223 13% 24%)',
                input: 'hsl(223 13% 24%)',
                ring: 'hsl(221 83% 66%)',
                success: 'hsl(142 69% 52%)',
                warning: 'hsl(40 96% 60%)',
                info: 'hsl(207 96% 62%)'
            }
        }
    ];

    function __tmGetDefaultThemeConfig() {
        return {
            source: 'preset',
            presetId: 'task-horizon-slate',
            importName: '',
            importLight: {},
            importDark: {},
            overrideLight: {},
            overrideDark: {}
        };
    }

    function __tmNormalizeThemeTokenKey(input) {
        const rawKey = String(input || '').trim().replace(/^--/, '').toLowerCase();
        const key = __TM_THEME_TOKEN_KEY_ALIASES[rawKey] || rawKey;
        return __TM_THEME_TOKEN_KEYS.has(key) ? key : '';
    }

    function __tmNormalizeThemeSemanticColorValue(input) {
        const raw = String(input || '').trim().replace(/;+$/, '').trim();
        if (!raw) return '';
        const direct = __tmNormalizeHexColor(raw, '');
        if (direct) return direct;
        if (/^[0-9.\s,%/+-]+$/.test(raw) && /%/.test(raw)) {
            return __tmNormalizeHexColor(`hsl(${raw})`, '');
        }
        if (/^[0-9.\s/+-]+$/.test(raw)) {
            return __tmNormalizeHexColor(`oklch(${raw})`, '');
        }
        return '';
    }

    function __tmNormalizeThemeTokenMap(input) {
        const out = {};
        if (!input || typeof input !== 'object') return out;
        Object.keys(input).forEach((key) => {
            const normalizedKey = __tmNormalizeThemeTokenKey(key);
            if (!normalizedKey) return;
            const normalizedValue = __tmNormalizeThemeSemanticColorValue(input[key]);
            if (!normalizedValue) return;
            out[normalizedKey] = normalizedValue;
        });
        return out;
    }

    function __tmNormalizeThemeConfig(input) {
        const defaults = __tmGetDefaultThemeConfig();
        const source = String(input?.source || defaults.source).trim() === 'imported' ? 'imported' : 'preset';
        const preset = __tmGetThemePresetById(String(input?.presetId || defaults.presetId).trim() || defaults.presetId);
        return {
            source,
            presetId: String(preset?.id || defaults.presetId),
            importName: String(input?.importName || '').trim(),
            importLight: __tmNormalizeThemeTokenMap(input?.importLight),
            importDark: __tmNormalizeThemeTokenMap(input?.importDark),
            overrideLight: __tmNormalizeThemeTokenMap(input?.overrideLight),
            overrideDark: __tmNormalizeThemeTokenMap(input?.overrideDark),
        };
    }

    function __tmGetThemePresetById(id) {
        const normalizedId = String(id || '').trim();
        return __TM_THEME_PRESETS.find((item) => item.id === normalizedId) || __TM_THEME_PRESETS[0];
    }

    function __tmResolveThemeTokenMap(themeConfig, isDark) {
        const config = __tmNormalizeThemeConfig(themeConfig || SettingsStore?.data?.themeConfig);
        const preset = __tmGetThemePresetById(config.presetId);
        const presetTokens = __tmNormalizeThemeTokenMap(isDark ? preset?.dark : preset?.light);
        const overrideTokens = __tmNormalizeThemeTokenMap(isDark ? config.overrideDark : config.overrideLight);
        if (config.source !== 'imported') return { ...presetTokens, ...overrideTokens };
        const importedLight = __tmNormalizeThemeTokenMap(config.importLight);
        const importedDark = __tmNormalizeThemeTokenMap(config.importDark);
        const activeImport = isDark ? ((Object.keys(importedDark).length ? importedDark : importedLight)) : importedLight;
        return { ...presetTokens, ...activeImport, ...overrideTokens };
    }

    function __tmMixThemeColors(a, b, ratio, alphaScale = 1) {
        const left = __tmParseCssColorToRgba(a);
        const right = __tmParseCssColorToRgba(b);
        if (!left && !right) return String(a || b || '').trim();
        if (!left) return __tmScaleColorAlpha(b, alphaScale);
        if (!right) return __tmScaleColorAlpha(a, alphaScale);
        const mixed = __tmMixRgb(left, right, __tmClamp(ratio, 0, 1));
        const alpha = __tmClamp(Number(mixed.a ?? 1) * __tmClamp(alphaScale, 0, 1), 0, 1);
        return `rgba(${Math.round(mixed.r)}, ${Math.round(mixed.g)}, ${Math.round(mixed.b)}, ${alpha})`;
    }

    function __tmBuildThemePalette(themeConfig, isDark) {
        const tokens = __tmResolveThemeTokenMap(themeConfig, isDark);
        const background = tokens.background || (isDark ? 'hsl(222 47% 11%)' : 'hsl(210 20% 98%)');
        const foreground = tokens.foreground || (isDark ? 'hsl(210 40% 98%)' : 'hsl(222 47% 11%)');
        const card = tokens.card || __tmMixThemeColors(background, foreground, isDark ? 0.08 : 0.02);
        const cardForeground = tokens['card-foreground'] || foreground;
        const popover = tokens.popover || card;
        const popoverForeground = tokens['popover-foreground'] || foreground;
        const primary = tokens.primary || (isDark ? 'hsl(217 91% 60%)' : 'hsl(221 83% 53%)');
        const primaryForeground = tokens['primary-foreground'] || __tmGetReadableTextColor(primary, '#0f172a', '#ffffff');
        const secondary = tokens.secondary || __tmMixThemeColors(background, foreground, isDark ? 0.14 : 0.06);
        const secondaryForeground = tokens['secondary-foreground'] || foreground;
        const sidebar = tokens.sidebar || secondary;
        const muted = tokens.muted || __tmMixThemeColors(background, foreground, isDark ? 0.18 : 0.08);
        const mutedForeground = tokens['muted-foreground'] || __tmMixThemeColors(foreground, background, isDark ? 0.42 : 0.52);
        const accent = tokens.accent || __tmMixThemeColors(primary, background, isDark ? 0.78 : 0.86);
        const accentForeground = tokens['accent-foreground'] || __tmGetReadableTextColor(accent, '#0f172a', '#ffffff');
        const destructive = tokens.destructive || (isDark ? 'hsl(0 72% 62%)' : 'hsl(0 72% 51%)');
        const destructiveForeground = tokens['destructive-foreground'] || __tmGetReadableTextColor(destructive, '#0f172a', '#ffffff');
        const border = tokens.border || __tmMixThemeColors(background, foreground, isDark ? 0.22 : 0.12);
        const input = tokens.input || border;
        const ring = tokens.ring || primary;
        const success = tokens.success || (isDark ? 'hsl(142 71% 52%)' : 'hsl(142 71% 45%)');
        const warning = tokens.warning || (isDark ? 'hsl(40 96% 60%)' : 'hsl(38 92% 50%)');
        const info = tokens.info || __tmMixThemeColors(primary, background, isDark ? 0.12 : 0.08);
        return {
            background,
            foreground,
            card,
            cardForeground,
            popover,
            popoverForeground,
            primary,
            primaryForeground,
            secondary,
            secondaryForeground,
            sidebar,
            muted,
            mutedForeground,
            accent,
            accentForeground,
            destructive,
            destructiveForeground,
            border,
            input,
            ring,
            success,
            warning,
            info,
        };
    }

    function __tmBuildThemeAppearanceDefaults(themeConfig, isDark) {
        const palette = __tmBuildThemePalette(themeConfig, isDark);
        const topbarStart = __tmMixThemeColors(palette.background, palette.primary, isDark ? 0.24 : 0.14);
        const topbarEnd = __tmMixThemeColors(palette.background, palette.accent, isDark ? 0.34 : 0.28);
        const topbarMid = __tmMixThemeColors(topbarStart, topbarEnd, 0.5);
        const topbarText = __tmGetReadableTextColor(topbarMid, palette.foreground, '#ffffff');
        const controlBg = __tmMixThemeColors(topbarMid, palette.background, isDark ? 0.42 : 0.56);
        const controlText = __tmGetReadableTextColor(controlBg, palette.foreground, '#ffffff');
        const controlBorder = __tmWithAlpha(controlText, isDark ? 0.26 : 0.18);
        const controlHover = __tmMixThemeColors(controlBg, palette.accent, isDark ? 0.34 : 0.22);
        const controlSegBg = __tmMixThemeColors(controlBg, palette.background, isDark ? 0.16 : 0.24);
        const controlSegActive = __tmMixThemeColors(palette.primary, controlBg, isDark ? 0.26 : 0.18);
        const shadowColor = isDark ? 'rgba(2, 6, 23, 0.38)' : 'rgba(15, 23, 42, 0.12)';
        return {
            topbarGradientStart: topbarStart,
            topbarGradientEnd: topbarEnd,
            topbarTextColor: topbarText,
            topbarControlBg: controlBg,
            topbarControlText: controlText,
            topbarControlBorder: controlBorder,
            topbarControlHover: controlHover,
            topbarControlSegmentBg: controlSegBg,
            topbarControlSegmentActiveBg: controlSegActive,
            topbarControlShadowColor: shadowColor,
            taskContentColor: palette.foreground,
            taskMetaColor: palette.mutedForeground,
            groupDocLabelColor: palette.foreground,
            timeGroupBaseColor: palette.primary,
            timeGroupOverdueColor: palette.destructive,
            timeGroupPendingTaskBgColor: palette.mutedForeground,
            progressBarColor: palette.success,
            calendarTodayHighlightColor: controlHover,
            calendarGridBorderColor: palette.border,
            tableBorderColor: palette.border,
        };
    }

    function __tmApplyThemeConfigToAppearanceFields(themeConfig) {
        const config = __tmNormalizeThemeConfig(themeConfig || SettingsStore?.data?.themeConfig);
        const light = __tmBuildThemeAppearanceDefaults(config, false);
        const dark = __tmBuildThemeAppearanceDefaults(config, true);
        SettingsStore.data.themeConfig = config;
        SettingsStore.data.topbarGradientLightStart = light.topbarGradientStart;
        SettingsStore.data.topbarGradientLightEnd = light.topbarGradientEnd;
        SettingsStore.data.topbarGradientDarkStart = dark.topbarGradientStart;
        SettingsStore.data.topbarGradientDarkEnd = dark.topbarGradientEnd;
        SettingsStore.data.topbarTextColorLight = light.topbarTextColor;
        SettingsStore.data.topbarTextColorDark = dark.topbarTextColor;
        SettingsStore.data.topbarControlBgLight = light.topbarControlBg;
        SettingsStore.data.topbarControlBgDark = dark.topbarControlBg;
        SettingsStore.data.topbarControlTextLight = light.topbarControlText;
        SettingsStore.data.topbarControlTextDark = dark.topbarControlText;
        SettingsStore.data.topbarControlBorderLight = light.topbarControlBorder;
        SettingsStore.data.topbarControlBorderDark = dark.topbarControlBorder;
        SettingsStore.data.topbarControlHoverLight = light.topbarControlHover;
        SettingsStore.data.topbarControlHoverDark = dark.topbarControlHover;
        SettingsStore.data.topbarControlSegmentBgLight = light.topbarControlSegmentBg;
        SettingsStore.data.topbarControlSegmentBgDark = dark.topbarControlSegmentBg;
        SettingsStore.data.topbarControlSegmentActiveBgLight = light.topbarControlSegmentActiveBg;
        SettingsStore.data.topbarControlSegmentActiveBgDark = dark.topbarControlSegmentActiveBg;
        SettingsStore.data.topbarControlShadowColorLight = light.topbarControlShadowColor;
        SettingsStore.data.topbarControlShadowColorDark = dark.topbarControlShadowColor;
        SettingsStore.data.taskContentColorLight = light.taskContentColor;
        SettingsStore.data.taskContentColorDark = dark.taskContentColor;
        SettingsStore.data.taskMetaColorLight = light.taskMetaColor;
        SettingsStore.data.taskMetaColorDark = dark.taskMetaColor;
        SettingsStore.data.groupDocLabelColorLight = light.groupDocLabelColor;
        SettingsStore.data.groupDocLabelColorDark = dark.groupDocLabelColor;
        SettingsStore.data.timeGroupBaseColorLight = light.timeGroupBaseColor;
        SettingsStore.data.timeGroupBaseColorDark = dark.timeGroupBaseColor;
        SettingsStore.data.timeGroupOverdueColorLight = light.timeGroupOverdueColor;
        SettingsStore.data.timeGroupOverdueColorDark = dark.timeGroupOverdueColor;
        SettingsStore.data.timeGroupPendingTaskBgColorLight = light.timeGroupPendingTaskBgColor;
        SettingsStore.data.timeGroupPendingTaskBgColorDark = dark.timeGroupPendingTaskBgColor;
        SettingsStore.data.progressBarColorLight = light.progressBarColor;
        SettingsStore.data.progressBarColorDark = dark.progressBarColor;
        SettingsStore.data.calendarTodayHighlightColorLight = light.calendarTodayHighlightColor;
        SettingsStore.data.calendarTodayHighlightColorDark = dark.calendarTodayHighlightColor;
        SettingsStore.data.calendarGridBorderColorLight = light.calendarGridBorderColor;
        SettingsStore.data.calendarGridBorderColorDark = dark.calendarGridBorderColor;
        SettingsStore.data.tableBorderColorLight = light.tableBorderColor;
        SettingsStore.data.tableBorderColorDark = dark.tableBorderColor;
        SettingsStore.data.calendarColorFocus = 'var(--tm-primary-color)';
        SettingsStore.data.calendarColorBreak = 'var(--tm-success-color)';
        SettingsStore.data.calendarColorStopwatch = 'var(--tm-warning-color, #f9ab00)';
        SettingsStore.data.calendarColorIdle = 'var(--tm-secondary-text)';
        SettingsStore.data.calendarScheduleColor = 'var(--tm-primary-color)';
        SettingsStore.data.calendarTaskDatesColor = 'var(--tm-secondary-text)';
    }

    function __tmParseThemeCssVariables(input) {
        const source = String(input || '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (!source) return null;
        const light = {};
        const dark = {};
        let matched = false;
        const assignBlock = (target, body) => {
            const blockRegex = /--([a-zA-Z0-9\-_]+)\s*:\s*([^;]+);/g;
            let match;
            while ((match = blockRegex.exec(body))) {
                const key = __tmNormalizeThemeTokenKey(match[1]);
                if (!key) continue;
                const value = __tmNormalizeThemeSemanticColorValue(match[2]);
                if (!value) continue;
                target[key] = value;
            }
        };
        const selectorRegex = /([^{}]+)\{([^{}]+)\}/g;
        let match;
        while ((match = selectorRegex.exec(source))) {
            const selectors = String(match[1] || '').toLowerCase();
            const body = String(match[2] || '');
            if (!body.includes('--')) continue;
            if (/:root\b/.test(selectors) || /:host\b/.test(selectors) || /\.light\b/.test(selectors) || /\[data-theme(?:-mode)?=["']?light/.test(selectors)) {
                assignBlock(light, body);
                matched = true;
            }
            if (/\.dark\b/.test(selectors) || /\[data-theme(?:-mode)?=["']?dark/.test(selectors)) {
                assignBlock(dark, body);
                matched = true;
            }
        }
        if (!matched && source.includes('--')) {
            assignBlock(light, source);
        }
        const normalizedLight = __tmNormalizeThemeTokenMap(light);
        const normalizedDark = __tmNormalizeThemeTokenMap(Object.keys(dark).length ? dark : light);
        if (!Object.keys(normalizedLight).length && !Object.keys(normalizedDark).length) return null;
        return {
            light: normalizedLight,
            dark: normalizedDark,
        };
    }

    function __tmBuildStatusChipStyle(color) {
        const darkMode = __tmIsDarkMode();
        const cacheKey = `${darkMode ? 1 : 0}|${String(color || '').trim()}`;
        if (__tmStatusChipStyleCache.has(cacheKey)) return __tmStatusChipStyleCache.get(cacheKey);
        const base = __tmNormalizeHexColor(color, '#757575') || '#757575';
        const fg = darkMode ? __tmThemeAdjustHex(base, true) : __tmDarkenHex(base, 0.18);
        const bg = __tmWithAlpha(base, darkMode ? 0.24 : 0.16);
        const border = __tmWithAlpha(base, darkMode ? 0.58 : 0.34);
        const out = `--tm-status-bg:${bg};--tm-status-fg:${fg};--tm-status-border:${border};`;
        return __tmRememberSmallCache(__tmStatusChipStyleCache, cacheKey, out, 200);
    }

    function __tmBuildPriorityChipStyle(value) {
        const info = __tmGetPriorityJiraInfo(value);
        const darkMode = __tmIsDarkMode();
        const cacheKey = `${darkMode ? 1 : 0}|${String(info?.key || 'none')}`;
        if (__tmPriorityChipStyleCache.has(cacheKey)) return __tmPriorityChipStyleCache.get(cacheKey);
        const baseByKey = {
            high: '#de350b',
            medium: '#ff991f',
            low: '#1d7afc',
            none: 'var(--tm-task-done-color)'
        };
        const baseRaw = baseByKey[info.key] || '#9aa0a6';
        const rgba = __tmParseCssColorToRgba(baseRaw) || { r: 154, g: 160, b: 166, a: 1 };
        const bgA = darkMode ? 0.24 : 0.16;
        const borderA = darkMode ? 0.58 : 0.34;
        const fg = `rgb(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)})`;
        const bg = `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${bgA})`;
        const border = `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${borderA})`;
        const out = `--tm-priority-bg:${bg};--tm-priority-fg:${fg};--tm-priority-border:${border};background:${bg};color:${fg};border-color:${border};`;
        return __tmRememberSmallCache(__tmPriorityChipStyleCache, cacheKey, out, 32);
    }

    function __tmRemoveElementsById(...ids) {
        try {
            ids.forEach((id) => {
                const el = document.getElementById(String(id || '').trim());
                if (el) el.remove();
            });
        } catch (e) {}
    }

    function __tmCancelAnimationsWithin(rootEl) {
        const root = rootEl instanceof Element ? rootEl : null;
        if (!root) return;
        const list = root.querySelectorAll('tr[data-id],tr[data-group-key],.tm-gantt-row[data-id],.tm-gantt-row--group[data-group-key]');
        list.forEach((el) => {
            try {
                const anims = el.getAnimations?.() || [];
                anims.forEach((a) => {
                    try { a.cancel(); } catch (e2) {}
                });
            } catch (e) {}
        });
    }

    function __tmResetFlipState(modalEl) {
        const root = modalEl instanceof Element ? modalEl : state.modal;
        try { if (root) __tmCancelAnimationsWithin(root); } catch (e) {}
        try {
            const a = state.__tmFlipRunningAnims;
            if (Array.isArray(a)) {
                a.forEach((x) => { try { x?.cancel?.(); } catch (e2) {} });
                a.length = 0;
            }
        } catch (e) {}
        state.__tmFlipFirst = null;
        state.__tmFlipAction = null;
        state.__tmFlipTs = Date.now();
    }

    function __tmShouldReduceUiAnimationByScale() {
        try {
            const totalFiltered = Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0;
            if (totalFiltered > 120) return true;
            const totalRows = state.modal?.querySelectorAll?.('#tmTaskTable tbody tr[data-id], #tmTimelineLeftTable tbody tr[data-id]')?.length || 0;
            if (totalRows > 180) return true;
        } catch (e) {}
        return false;
    }

    function __tmUpdateToggleGlyphInDom(opts) {
        const o = (opts && typeof opts === 'object') ? opts : {};
        const kind = String(o.kind || '');
        const key = String(o.key || '').trim();
        const action = String(o.action || '');
        if (!key) return;
        const modal = state.modal;
        if (!modal) return;
        if (kind === 'task') {
            const row = modal.querySelector(`#tmTaskTable tbody tr[data-id="${CSS.escape(key)}"],#tmTimelineLeftTable tbody tr[data-id="${CSS.escape(key)}"]`);
            const leading = row?.querySelector?.('.tm-task-leading--branch');
            if (leading) {
                const collapsed = action === 'collapse';
                leading.classList.toggle('tm-task-leading--collapsed', collapsed);
                row?.querySelectorAll?.('.tm-tree-toggle-icon')?.forEach?.((icon) => {
                    if (icon instanceof HTMLElement || icon instanceof SVGElement) {
                        icon.style.transform = `rotate(${collapsed ? 0 : 90}deg)`;
                    }
                });
                const ring = leading.querySelector('.tm-task-leading-ring');
                if (collapsed && !ring) {
                    leading.insertAdjacentHTML('afterbegin', '<span class="tm-task-leading-ring" aria-hidden="true"></span>');
                } else if (!collapsed && ring) {
                    ring.remove();
                }
            }
            return;
        }
        if (kind === 'group') {
            const row = modal.querySelector(`#tmTaskTable tbody tr[data-group-key="${CSS.escape(key)}"],#tmTimelineLeftTable tbody tr[data-group-key="${CSS.escape(key)}"]`);
            const t = row?.querySelector?.('.tm-group-toggle');
            if (t) {
                const collapsed = action === 'collapse';
                t.classList.toggle('tm-group-toggle--collapsed', collapsed);
                row?.querySelectorAll?.('.tm-group-toggle-icon')?.forEach?.((icon) => {
                    if (icon instanceof HTMLElement || icon instanceof SVGElement) {
                        icon.style.transform = `rotate(${collapsed ? 0 : 90}deg)`;
                    }
                });
            }
        }
    }

    function __tmTryCollapseTaskBranchInList(modalEl, taskId) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!modal) return false;
        if (String(state.viewMode || '').trim() !== 'list') return false;
        const key = String(taskId || '').trim();
        if (!key) return false;
        const tbody = modal.querySelector('#tmTaskTable tbody');
        if (!tbody) return false;
        const anchor = tbody.querySelector(`tr[data-id="${CSS.escape(key)}"]`);
        if (!anchor) return false;
        const baseDepth = Number(anchor.getAttribute('data-depth')) || 0;
        let changed = false;
        let node = anchor.nextElementSibling;
        while (node) {
            if (!(node instanceof Element)) break;
            if (node.matches('tr[data-group-key]')) break;
            const depth = Number(node.getAttribute('data-depth'));
            if (!Number.isFinite(depth) || depth <= baseDepth) break;
            if (node.matches('tr[data-id]')) {
                node.style.display = 'none';
                node.style.visibility = '';
                node.style.pointerEvents = '';
                changed = true;
            }
            node = node.nextElementSibling;
        }
        if (!changed) return false;
        try { modal.querySelector('.tm-body')?.__tmTableScrollUpdateThumb?.(); } catch (e) {}
        return true;
    }

    function __tmScheduleCollapseRerender() {
        if (String(state.viewMode || '').trim() === 'checklist') {
            __tmRenderChecklistPreserveScroll();
            return;
        }
        if (String(state.viewMode || '').trim() === 'timeline') {
            try {
                const id0 = Number(state.__tmCollapseRafId) || 0;
                if (id0) cancelAnimationFrame(id0);
                state.__tmCollapseRafId = 0;
            } catch (e) {}
            if (!__tmRerenderCollapseInPlace()) render();
            return;
        }
        try {
            const id0 = Number(state.__tmCollapseRafId) || 0;
            if (id0) cancelAnimationFrame(id0);
        } catch (e) {}
        try {
            state.__tmCollapseRafId = requestAnimationFrame(() => {
                state.__tmCollapseRafId = 0;
                if (!__tmRerenderCollapseInPlace()) render();
            });
        } catch (e) {
            if (!__tmRerenderCollapseInPlace()) render();
        }
    }

    function __tmGetActiveTbody(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!modal) return null;
        if (state.viewMode === 'timeline') return modal.querySelector('#tmTimelineLeftTable tbody');
        return modal.querySelector('#tmTaskTable tbody');
    }

    function __tmApplyVisibilityFromState(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!modal) return false;
        const tbody = __tmGetActiveTbody(modal);
        if (!tbody) return false;
        const collapsedTaskIds = state.collapsedTaskIds instanceof Set ? state.collapsedTaskIds : new Set();
        const collapsedGroups = state.collapsedGroups instanceof Set ? state.collapsedGroups : new Set();
        const getGroupLevel = (groupKey) => {
            const k = String(groupKey || '').trim();
            if (!k) return 0;
            if (k.includes('__h2_')) return 1;
            return 0;
        };

        const leftRows = tbody.querySelectorAll('tr');
        const groupStack = [];
        let collapsedAncestorDepth = null;

        leftRows.forEach((row) => {
            if (!(row instanceof Element)) return;
            if (row.matches('tr[data-group-key]')) {
                const gk = String(row.getAttribute('data-group-key') || '').trim();
                const level = getGroupLevel(gk);
                while (groupStack.length > 0 && groupStack[groupStack.length - 1].level >= level) {
                    groupStack.pop();
                }
                const parentCollapsed = groupStack.some(it => !!it.collapsed);
                const selfCollapsed = !!(gk && collapsedGroups.has(gk));
                const effectiveCollapsed = parentCollapsed || selfCollapsed;
                groupStack.push({ level, collapsed: effectiveCollapsed });
                row.style.display = parentCollapsed ? 'none' : '';
                collapsedAncestorDepth = null;
                return;
            }
            if (!row.matches('tr[data-id]')) return;
            const id = String(row.getAttribute('data-id') || '').trim();
            const d = Number(row.getAttribute('data-depth')) || 0;
            while (collapsedAncestorDepth !== null && d <= collapsedAncestorDepth) collapsedAncestorDepth = null;
            const groupCollapsed = groupStack.some(it => !!it.collapsed);
            const hide = groupCollapsed || collapsedAncestorDepth !== null;
            row.style.display = hide ? 'none' : '';
            row.style.visibility = '';
            row.style.pointerEvents = '';
            if (id) {
                const toggleEl = row.querySelector('.tm-tree-toggle');
                const hasToggle = !!toggleEl;
                const leadingEl = row.querySelector('.tm-task-leading--branch');
                const isCollapsed = hasToggle && collapsedTaskIds.has(id);
                if (leadingEl) {
                    leadingEl.classList.toggle('tm-task-leading--collapsed', !!isCollapsed);
                    const ring = leadingEl.querySelector('.tm-task-leading-ring');
                    if (isCollapsed && !ring) {
                        leadingEl.insertAdjacentHTML('afterbegin', '<span class="tm-task-leading-ring" aria-hidden="true"></span>');
                    } else if (!isCollapsed && ring) {
                        ring.remove();
                    }
                }
                if (!hide && isCollapsed) collapsedAncestorDepth = d;
            }
        });

        if (state.viewMode !== 'timeline') return true;

        const ganttBody = modal.querySelector('#tmGanttBody');
        if (!ganttBody) return true;
        const rightRows = ganttBody.querySelectorAll('.tm-gantt-row,.tm-gantt-row--group');
        const n = Math.min(leftRows.length, rightRows.length);
        for (let i = 0; i < n; i++) {
            const lr = leftRows[i];
            const rr = rightRows[i];
            if (!(lr instanceof Element) || !(rr instanceof Element)) continue;
            const disp = lr.style.display || '';
            rr.style.display = disp;
        }

        const syncRowHeightsOnce = (force = false) => {
            if (!force && Date.now() - (Number(state.__tmFlipTs) || 0) < 240) return;
            const n2 = Math.min(leftRows.length, rightRows.length);
            for (let i = 0; i < n2; i++) {
                const lr = leftRows[i];
                const rr = rightRows[i];
                if (!(lr instanceof Element) || !(rr instanceof Element)) continue;
                if ((lr.style.display || '') === 'none') continue;
                const h = lr.getBoundingClientRect?.().height;
                if (!Number.isFinite(h) || h <= 0) continue;
                rr.style.height = `${h}px`;
                rr.style.minHeight = `${h}px`;
                rr.style.maxHeight = `${h}px`;
                const bar = rr.querySelector?.('.tm-gantt-bar');
                if (bar) {
                    bar.style.top = 'calc((var(--tm-row-height) - var(--tm-gantt-card-height)) / 2)';
                    bar.style.transform = 'none';
                }
            }
            try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
        };
        try {
            syncRowHeightsOnce(true);
            requestAnimationFrame(() => {
                syncRowHeightsOnce();
                if (leftRows.length <= 400) {
                    setTimeout(syncRowHeightsOnce, 60);
                    setTimeout(syncRowHeightsOnce, 260);
                }
            });
        } catch (e) {}

        return true;
    }

    function __tmGetFlipKeyForEl(el) {
        if (!(el instanceof Element)) return '';
        const isGanttRow = !!(el.classList?.contains('tm-gantt-row') || el.classList?.contains('tm-gantt-row--group'));
        const prefix = isGanttRow ? 'gantt' : 'table';
        const id = String(el.getAttribute('data-id') || '').trim();
        if (id) return `${prefix}:task:${id}`;
        const gk = String(el.getAttribute('data-group-key') || '').trim();
        if (gk) return `${prefix}:group:${gk}`;
        return '';
    }

    function __tmCaptureFlipSnapshot(modalEl) {
        const root = modalEl instanceof Element ? modalEl : state.modal;
        if (!root) return new Map();
        const list = root.querySelectorAll('tr[data-id],tr[data-group-key],.tm-gantt-row[data-id],.tm-gantt-row--group[data-group-key]');
        const m = new Map();
        list.forEach((el) => {
            const k = __tmGetFlipKeyForEl(el);
            if (!k) return;
            try {
                const r = el.getBoundingClientRect();
                if (!r || r.height <= 0 || r.width <= 0) return;
                m.set(k, r);
            } catch (e) {}
        });
        return m;
    }

    function __tmCollectAffectedRowsForCollapse(containerEl, opts) {
        const container = containerEl instanceof Element ? containerEl : null;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const kind = String(o.kind || '');
        const key = String(o.key || '').trim();
        if (!container || !key) return [];
        const anchor = kind === 'group'
            ? container.querySelector(`tr[data-group-key="${CSS.escape(key)}"]`)
            : container.querySelector(`tr[data-id="${CSS.escape(key)}"]`);
        if (!anchor) return [];

        const out = [];
        if (kind === 'group') {
            let n = anchor.nextElementSibling;
            while (n) {
                if (n instanceof Element && n.matches('tr[data-group-key]')) break;
                if (n instanceof Element && n.matches('tr[data-id]')) out.push(n);
                n = n.nextElementSibling;
            }
            return out;
        }

        const baseDepth = Number(anchor.getAttribute('data-depth')) || 0;
        let n = anchor.nextElementSibling;
        while (n) {
            if (!(n instanceof Element)) break;
            if (n.matches('tr[data-group-key]')) break;
            const d = Number(n.getAttribute('data-depth'));
            if (!Number.isFinite(d) || d <= baseDepth) break;
            if (n.matches('tr[data-id]')) out.push(n);
            n = n.nextElementSibling;
        }
        return out;
    }

    function __tmCountAffectedRowsForCollapse(containerEl, opts, stopAfter = Infinity) {
        const container = containerEl instanceof Element ? containerEl : null;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const kind = String(o.kind || '');
        const key = String(o.key || '').trim();
        if (!container || !key) return 0;
        const anchor = kind === 'group'
            ? container.querySelector(`tr[data-group-key="${CSS.escape(key)}"]`)
            : container.querySelector(`tr[data-id="${CSS.escape(key)}"]`);
        if (!anchor) return 0;

        let count = 0;
        if (kind === 'group') {
            let n = anchor.nextElementSibling;
            while (n) {
                if (n instanceof Element && n.matches('tr[data-group-key]')) break;
                if (n instanceof Element && n.matches('tr[data-id]')) {
                    count++;
                    if (count >= stopAfter) break;
                }
                n = n.nextElementSibling;
            }
            return count;
        }

        const baseDepth = Number(anchor.getAttribute('data-depth')) || 0;
        let n = anchor.nextElementSibling;
        while (n) {
            if (!(n instanceof Element)) break;
            if (n.matches('tr[data-group-key]')) break;
            const d = Number(n.getAttribute('data-depth'));
            if (!Number.isFinite(d) || d <= baseDepth) break;
            if (n.matches('tr[data-id]')) {
                count++;
                if (count >= stopAfter) break;
            }
            n = n.nextElementSibling;
        }
        return count;
    }

    function __tmCollectAffectedRowsForCollapseLimited(containerEl, opts, limit = 0) {
        const rows = [];
        const cap = Math.max(0, Number(limit) || 0);
        if (cap <= 0) return { rows, count: 0, truncated: false };
        const container = containerEl instanceof Element ? containerEl : null;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const kind = String(o.kind || '');
        const key = String(o.key || '').trim();
        if (!container || !key) return { rows, count: 0, truncated: false };
        const anchor = kind === 'group'
            ? container.querySelector(`tr[data-group-key="${CSS.escape(key)}"]`)
            : container.querySelector(`tr[data-id="${CSS.escape(key)}"]`);
        if (!anchor) return { rows, count: 0, truncated: false };

        let count = 0;
        let truncated = false;
        if (kind === 'group') {
            let n = anchor.nextElementSibling;
            while (n) {
                if (n instanceof Element && n.matches('tr[data-group-key]')) break;
                if (n instanceof Element && n.matches('tr[data-id]')) {
                    count++;
                    if (rows.length < cap) rows.push(n);
                    else truncated = true;
                }
                n = n.nextElementSibling;
            }
            return { rows, count, truncated };
        }

        const baseDepth = Number(anchor.getAttribute('data-depth')) || 0;
        let n = anchor.nextElementSibling;
        while (n) {
            if (!(n instanceof Element)) break;
            if (n.matches('tr[data-group-key]')) break;
            const d = Number(n.getAttribute('data-depth'));
            if (!Number.isFinite(d) || d <= baseDepth) break;
            if (n.matches('tr[data-id]')) {
                count++;
                if (rows.length < cap) rows.push(n);
                else truncated = true;
            }
            n = n.nextElementSibling;
        }
        return { rows, count, truncated };
    }

    function __tmShouldSkipCollapseAnimByScale() {
        return __tmShouldReduceUiAnimationByScale();
    }

    function __tmGetCollapseAnimMode() {
        try {
            const totalFiltered = Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0;
            const totalRows = state.modal?.querySelectorAll?.('#tmTaskTable tbody tr[data-id], #tmTimelineLeftTable tbody tr[data-id]')?.length || 0;
            if (totalFiltered > 220 || totalRows > 320) return 'none';
            if (totalFiltered > 120 || totalRows > 180) return 'lite';
        } catch (e) {}
        return 'full';
    }

    function __tmAnimateExitingRows(rows) {
        const list = Array.isArray(rows) ? rows : [];
        if (list.length === 0) return;
        list.forEach((row) => {
            if (!(row instanceof Element)) return;
            let rect;
            try { rect = row.getBoundingClientRect(); } catch (e) { return; }
            if (!rect || rect.height <= 0 || rect.width <= 0) return;
            const wrap = document.createElement('div');
            wrap.style.position = 'fixed';
            wrap.style.left = `${rect.left}px`;
            wrap.style.top = `${rect.top}px`;
            wrap.style.width = `${rect.width}px`;
            wrap.style.height = `${rect.height}px`;
            wrap.style.pointerEvents = 'none';
            wrap.style.zIndex = '100004';
            const table = document.createElement('table');
            table.className = 'tm-table';
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            const tbody = document.createElement('tbody');
            tbody.appendChild(row.cloneNode(true));
            table.appendChild(tbody);
            wrap.appendChild(table);
            document.body.appendChild(wrap);
            try { row.style.visibility = 'hidden'; } catch (e) {}
            try { row.style.pointerEvents = 'none'; } catch (e) {}
            try {
                const anim = wrap.animate([
                    { transform: 'translateY(0px)', opacity: 1 },
                    { transform: 'translateY(-10px)', opacity: 0 },
                ], { duration: 130, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' });
                anim.onfinish = () => { try { wrap.remove(); } catch (e) {} };
            } catch (e) {
                try { wrap.remove(); } catch (e2) {}
            }
        });
    }

    function __tmPrepareFlipAnimation(opts) {
        if (!state.modal) return;
        if (__tmShouldReduceUiAnimationByScale()) {
            state.__tmFlipFirst = null;
            state.__tmFlipAction = null;
            return;
        }
        try { __tmCancelAnimationsWithin(state.modal); } catch (e) {}
        state.__tmFlipFirst = __tmCaptureFlipSnapshot(state.modal);
        state.__tmFlipAction = (opts && typeof opts === 'object') ? { ...opts } : null;
        state.__tmFlipTs = Date.now();
        if (state.__tmFlipAction?.action !== 'collapse') return;
        if (state.__tmFlipAction?.lite) return;
        const tbody = state.viewMode === 'timeline'
            ? state.modal.querySelector('#tmTimelineLeftTable tbody')
            : state.modal.querySelector('#tmTaskTable tbody');
        if (!tbody) return;
        const r = __tmCollectAffectedRowsForCollapseLimited(tbody, state.__tmFlipAction, 24);
        if (!r.truncated && Array.isArray(r.rows) && r.rows.length > 0) __tmAnimateExitingRows(r.rows);
    }

    function __tmAnimateEnteringRows(modalEl, opts) {
        const root = modalEl instanceof Element ? modalEl : state.modal;
        const o = (opts && typeof opts === 'object') ? opts : {};
        if (!root || o.action !== 'expand') return;
        if (o.lite) return;
        const tbody = state.viewMode === 'timeline'
            ? root.querySelector('#tmTimelineLeftTable tbody')
            : root.querySelector('#tmTaskTable tbody');
        if (!tbody) return;
        const kind = String(o.kind || '');
        const key = String(o.key || '').trim();
        if (!key) return;
        const anchor = kind === 'group'
            ? tbody.querySelector(`tr[data-group-key="${CSS.escape(key)}"]`)
            : tbody.querySelector(`tr[data-id="${CSS.escape(key)}"]`);
        if (!anchor) return;
        const r = __tmCollectAffectedRowsForCollapseLimited(tbody, o, 24);
        if (r.truncated || r.rows.length === 0) return;
        const rows = r.rows;
        rows.forEach((row) => {
            try {
                row.animate([
                    { opacity: 0 },
                    { opacity: 1 },
                ], { duration: 130, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'both' });
            } catch (e) {}
        });
    }

    function __tmRunFlipAnimation(modalEl) {
        const first = state.__tmFlipFirst;
        if (!(first instanceof Map) || first.size === 0) return;
        const root = modalEl instanceof Element ? modalEl : state.modal;
        if (!root) return;
        if (__tmShouldReduceUiAnimationByScale()) {
            try { __tmResetFlipState(root); } catch (e) {}
            return;
        }

        // 检查是否滚动到了页面下方，如果是则跳过 FLIP 动画以避免闪烁
        const timelineLeftBody = root.querySelector('#tmTimelineLeftBody');
        const listBody = root.querySelector('.tm-body');
        const isScrolledDown = timelineLeftBody
            ? (Number(timelineLeftBody.scrollTop) || 0) > 100
            : (listBody ? (Number(listBody.scrollTop) || 0) > 100 : false);
        if (isScrolledDown) {
            // 滚动到下方时直接清除 FLIP 状态，不运行动画，避免闪烁
            try { __tmResetFlipState(root); } catch (e) {}
            return;
        }

        try { __tmCancelAnimationsWithin(root); } catch (e) {}
        try { state.__tmFlipRunningAnims = Array.isArray(state.__tmFlipRunningAnims) ? state.__tmFlipRunningAnims : []; } catch (e) {}
        const els = root.querySelectorAll('tr[data-id],tr[data-group-key],.tm-gantt-row[data-id],.tm-gantt-row--group[data-group-key]');
        els.forEach((el) => {
            const k = __tmGetFlipKeyForEl(el);
            if (!k) return;
            const r0 = first.get(k);
            if (!r0) return;
            let r1;
            try { r1 = el.getBoundingClientRect(); } catch (e) { return; }
            if (!r1 || r1.height <= 0 || r1.width <= 0) return;
            const dy0 = (r0.top - r1.top);
            if (!Number.isFinite(dy0) || Math.abs(dy0) < 0.5) return;
            const dy = Math.round(dy0);
            if (!Number.isFinite(dy) || Math.abs(dy) < 1) return;
            try {
                try { el.style.willChange = 'transform'; } catch (e2) {}
                const anim = el.animate([
                    { transform: `translate3d(0px, ${dy}px, 0px)` },
                    { transform: 'translate3d(0px, 0px, 0px)' },
                ], {
                    duration: state.__tmFlipAction?.lite ? 130 : 180,
                    easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
                    fill: 'both'
                });
                try { state.__tmFlipRunningAnims.push(anim); } catch (e2) {}
                if (anim && typeof anim.commitStyles === 'function') {
                    anim.onfinish = () => {
                        try { anim.commitStyles(); } catch (e2) {}
                        try { anim.cancel(); } catch (e2) {}
                        try { el.style.willChange = ''; } catch (e2) {}
                        try {
                            const a = state.__tmFlipRunningAnims;
                            if (Array.isArray(a)) {
                                const idx = a.indexOf(anim);
                                if (idx !== -1) a.splice(idx, 1);
                            }
                        } catch (e2) {}
                    };
                } else if (anim) {
                    anim.onfinish = () => {
                        try { el.style.willChange = ''; } catch (e2) {}
                        try {
                            const a = state.__tmFlipRunningAnims;
                            if (Array.isArray(a)) {
                                const idx = a.indexOf(anim);
                                if (idx !== -1) a.splice(idx, 1);
                            }
                        } catch (e2) {}
                    };
                }
            } catch (e) {}
        });
        try { __tmAnimateEnteringRows(root, state.__tmFlipAction); } catch (e) {}
        state.__tmFlipFirst = null;
        state.__tmFlipAction = null;
    }

    function __tmRerenderListInPlace(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!modal) return false;
        const body = modal.querySelector('.tm-body');
        const table = modal.querySelector('#tmTaskTable');
        const tbody = modal.querySelector('#tmTaskTable tbody');
        if (!tbody) return false;
        const top = Number(body?.scrollTop) || 0;
        const left = Number(body?.scrollLeft) || 0;
        const isCalendarTaskTable = String(table?.getAttribute?.('data-tm-table') || '') === 'calendar';
        const originalOrder = SettingsStore.data.columnOrder;
        const originalWidths = SettingsStore.data.columnWidths;
        if (isCalendarTaskTable) {
            try {
                if (!SettingsStore.data.calendarColumnWidths || Object.keys(SettingsStore.data.calendarColumnWidths).length === 0) {
                    SettingsStore.data.calendarColumnWidths = { content: 140, duration: 60, spent: 60 };
                }
                SettingsStore.data.columnOrder = ['content', 'duration', 'spent'];
                SettingsStore.data.columnWidths = SettingsStore.data.calendarColumnWidths;
            } catch (e) {}
        }
        try { tbody.innerHTML = renderTaskList(); } catch (e) { return false; } finally {
            if (isCalendarTaskTable) {
                SettingsStore.data.columnOrder = originalOrder;
                SettingsStore.data.columnWidths = originalWidths;
            }
        }
        try { if (body) body.scrollTop = top; } catch (e) {}
        try { if (body) body.scrollLeft = left; } catch (e) {}
        try { body?.__tmTableScrollUpdateThumb?.(); } catch (e) {}
        try { __tmApplyReminderTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleReminderTaskNameMarksRefresh(modal); } catch (e) {}
        try { __tmApplyTodayScheduledTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleTodayScheduledTaskNameMarksRefresh(modal); } catch (e) {}
        try { queueMicrotask(() => { try { __tmRunFlipAnimation(modal); } catch (e) {} }); } catch (e) {
            try { Promise.resolve().then(() => { try { __tmRunFlipAnimation(modal); } catch (e2) {} }); } catch (e2) {}
        }
        try {
            __tmPushRefreshDebug('list-rerender-in-place:ok', {
                top,
                left,
                modalConnected: modal.isConnected === true,
            });
        } catch (e) {}
        return true;
    }

    function __tmShouldUseGlobalTimelineScroll(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        try {
            return !!modal.classList.contains('tm-modal--mobile');
        } catch (e) {
            return false;
        }
    }

    function __tmGetTimelineGlobalScrollHost(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!__tmShouldUseGlobalTimelineScroll(modal)) return null;
        const body = modal?.querySelector?.('.tm-body.tm-body--timeline');
        return body instanceof HTMLElement ? body : null;
    }

    function __tmGetTimelineLeftPaneWidth(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const leftEl = modal?.querySelector?.('.tm-timeline-left');
        if (!(leftEl instanceof HTMLElement)) return 0;
        const rectWidth = Number(leftEl.getBoundingClientRect?.().width);
        if (Number.isFinite(rectWidth) && rectWidth > 0) return rectWidth;
        const scrollWidth = Number(leftEl.scrollWidth);
        return Number.isFinite(scrollWidth) && scrollWidth > 0 ? scrollWidth : 0;
    }

    function __tmSyncTimelineMobileGroupStickyOffset(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const scrollHost = __tmGetTimelineGlobalScrollHost(modal);
        if (!(scrollHost instanceof HTMLElement)) return false;
        const offset = Math.max(0, Number(scrollHost.scrollLeft) || 0);
        try {
            scrollHost.style.setProperty('--tm-mobile-timeline-group-shift', `${offset}px`);
        } catch (e) {
            return false;
        }
        return true;
    }

    function __tmBindTimelineLeftCollapseInteractions(leftBodyEl) {
        const leftBody = leftBodyEl instanceof HTMLElement ? leftBodyEl : null;
        if (!leftBody) return;
        const prev = leftBody.__tmTimelineLeftCollapseHandler;
        if (prev && typeof prev === 'object') {
            try {
                if (typeof prev.onPointerDown === 'function') leftBody.removeEventListener('pointerdown', prev.onPointerDown, true);
            } catch (e) {}
        } else if (typeof prev === 'function') {
            try { leftBody.removeEventListener('click', prev, true); } catch (e) {}
        }
        try { leftBody.__tmTimelineLeftCollapseHandler = null; } catch (e) {}
    }

    function __tmRerenderTimelineInPlace(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!modal) return false;
        const leftBody = modal.querySelector('#tmTimelineLeftBody');
        const ganttBody = modal.querySelector('#tmGanttBody');
        const ganttHeader = modal.querySelector('#tmGanttHeader');
        const tbody = modal.querySelector('#tmTimelineLeftTable tbody');
        if (!leftBody || !ganttBody || !tbody) return false;

        const globalScrollHost = __tmGetTimelineGlobalScrollHost(modal);
        const useGlobalScroll = !!globalScrollHost;
        const savedTop = useGlobalScroll ? (Number(globalScrollHost.scrollTop) || 0) : (Number(leftBody.scrollTop) || 0);
        const savedLeft = useGlobalScroll ? (Number(globalScrollHost.scrollLeft) || 0) : (Number(ganttBody.scrollLeft) || 0);

        const widths = SettingsStore.data.columnWidths || {};
        const isGloballyLocked = GlobalLock.isLocked();
        const timelineContentWidth0 = Number(SettingsStore.data.timelineContentWidth);
        const timelineContentWidth = Number.isFinite(timelineContentWidth0) ? Math.max(10, Math.min(800, Math.round(timelineContentWidth0))) : (Number(widths.content) || 360);
        const timelineStartW = Math.max(10, Math.min(240, Math.round(Number(widths.startDate) || 90)));
        const timelineEndW = Math.max(10, Math.min(360, Math.round(Number(widths.completionTime) || 170)));
        const isDark = __tmIsDarkMode();
        const progressBarColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.progressBarColorDark, '#81c784')
            : __tmNormalizeHexColor(SettingsStore.data.progressBarColorLight, '#4caf50');
        const enableGroupBg = !!SettingsStore.data.enableGroupTaskBgByGroupColor;
        let currentGroupBg = '';

            const renderGroupRow = (row) => {
                const isCollapsed = !!row?.collapsed;
                const toggle = `<span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;">${__tmRenderToggleIcon(16, isCollapsed ? 0 : 90, 'tm-group-toggle-icon')}</span>`;
                if (row.kind === 'pinned') {
                    return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-checklist-group-pin-icon">${__tmRenderBadgeIcon('pin', 14)}</span><span class="tm-group-label" style="color:var(--tm-warning-color);">${esc(row.label || '')}</span><span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span></div></td></tr>`;
                }
                if (row.kind === 'doc') {
                    const labelColor = String(row.labelColor || 'var(--tm-group-doc-label-color)');
                    return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">${__tmRenderDocGroupLabel(row.docId || row.id, row.label || '')}</span><span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span></div></td></tr>`;
                }
            // 按任务名分组：分组行使用 PHOSPHOR 风格图标
            if (row.kind === 'task') {
                const labelColor = String(row.labelColor || 'var(--tm-primary-color)');
                return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">${__tmRenderIconLabel('puzzle', row.label || '')}</span><span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span></div></td></tr>`;
            }
            if (row.kind === 'time') {
                const labelColor = String(row.labelColor || 'var(--tm-text-color)');
                const durationSum = String(row.durationSum || '').trim();
                return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">${esc(row.label || '')}</span><span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span>${durationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(durationSum)}</span>` : ''}</div></td></tr>`;
            }
                if (row.kind === 'h2') {
                    const createBtnHtml = __tmBuildHeadingGroupCreateBtnHtml(row.docId, row.headingId, '在该标题下新建任务');
                    const labelColor = String(row.labelColor || __tmGetHeadingSubgroupLabelColor('var(--tm-group-doc-label-color)', isDark));
                    return `<tr class="tm-group-row tm-timeline-row" data-group-kind="h2" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky" style="padding-left:2ch;">${toggle}<span class="tm-group-label" style="color:${labelColor};">${__tmRenderHeadingLevelIconLabel(row.label || '', row.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2')}</span><span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span>${createBtnHtml}</div></td></tr>`;
                }
            if (row.kind === 'quadrant') {
                const durationSum = String(row.durationSum || '').trim();
                const colorMap = { red: 'var(--tm-quadrant-red)', yellow: 'var(--tm-quadrant-yellow)', blue: 'var(--tm-quadrant-blue)', green: 'var(--tm-quadrant-green)' };
                const color = colorMap[String(row.color || '')] || 'var(--tm-text-color)';
                return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:${color};"><div class="tm-group-sticky">${toggle}${esc(row.label || '')}<span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span>${durationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(durationSum)}</span>` : ''}</div></td></tr>`;
            }
            return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}${esc(row.label || '')}</div></td></tr>`;
        };

        const renderTaskRow = (row) => {
            const task = state.flatTasks[row.id];
            if (!task) return '';
            const isMultiSelected = __tmIsTaskMultiSelected(task.id);
            const depth = Math.max(0, Number(row.depth) || 0);
            const contentIndent = 12 + depth * 16;
            const treeGuides = depth > 0
                ? `<span class="tm-tree-guides" aria-hidden="true">${Array.from({ length: depth }, (_, i) => `<span class="tm-tree-guide-line" style="left:${18 + i * 16}px"></span>`).join('')}</span>`
                : '';
            const leadingClass = [
                'tm-task-leading',
                row.hasChildren && depth === 0 ? 'tm-task-leading--toplevel' : '',
                row.hasChildren ? 'tm-task-leading--branch' : '',
                row.hasChildren && row.collapsed ? 'tm-task-leading--collapsed' : '',
            ].filter(Boolean).join(' ');
            const leadingRing = row.hasChildren && row.collapsed
                ? '<span class="tm-task-leading-ring" aria-hidden="true"></span>'
                : '';
            const toggle = row.hasChildren
                ? `<span class="tm-tree-toggle" onclick="tmToggleCollapse('${task.id}', event)">${__tmRenderToggleIcon(16, row.collapsed ? 0 : 90, 'tm-tree-toggle-icon')}</span>`
                : '';
            const tomatoFocusTaskId = SettingsStore.data.enableTomatoIntegration ? String(state.timerFocusTaskId || '').trim() : '';
            const tomatoFocusModeEnabled = __tmIsTomatoFocusModeEnabled();
            const rowClass = tomatoFocusTaskId
                ? (tomatoFocusTaskId === String(task.id)
                    ? 'tm-timer-focus'
                    : (tomatoFocusModeEnabled ? 'tm-timer-dim' : ''))
                : '';
            const finalRowClass = [rowClass, isMultiSelected ? 'tm-task-row--multi-selected' : ''].filter(Boolean).join(' ');

            const allChildren = task.children || [];
            const totalChildren = allChildren.length;
            const completedChildren = allChildren.filter(c => c.done).length;
            const progressPercent = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
            const isDoneSubtask = !!task.done && (Math.max(0, Number(row.depth) || 0) > 0);
            const groupBg = enableGroupBg ? (currentGroupBg || resolvePinnedTaskGroupBg(task)) : '';
            const doneSubtaskBg = (!enableGroupBg && isDoneSubtask) ? __tmWithAlpha(progressBarColor, isDark ? 0.22 : 0.14) : '';
            const baseBg = groupBg || doneSubtaskBg;
            const progressBgStyle = (row.hasChildren && progressPercent > 0)
                ? (enableGroupBg && groupBg
                    ? `background-image:linear-gradient(90deg, ${progressBarColor} ${progressPercent}%, transparent ${progressPercent}%);background-repeat:no-repeat;background-size:100% 3px;background-position:left bottom;`
                    : `background-image:linear-gradient(90deg, ${progressBarColor} ${progressPercent}%, transparent ${progressPercent}%);background-repeat:no-repeat;`)
                : '';
            const contentCellBgStyle = `${baseBg ? `background-color:${baseBg};` : ''}${progressBgStyle ? `${progressBgStyle};` : ''}`;
            const otherCellBgStyle = groupBg ? `background-color:${groupBg};` : '';

            return `
                <tr class="tm-timeline-row ${finalRowClass}" data-id="${task.id}" data-depth="${row.depth}" onclick="tmRowClick(event, '${task.id}')" oncontextmenu="tmShowTaskContextMenu(event, '${task.id}')">
                    <td class="tm-task-content-cell" style="width: ${timelineContentWidth}px; min-width: ${timelineContentWidth}px; max-width: ${timelineContentWidth}px; ${contentCellBgStyle}">
                            <div class="tm-task-cell" style="padding-left:${contentIndent}px">
                                ${treeGuides}
                                <span class="${leadingClass}">
                                    ${leadingRing}
                                ${__tmRenderTaskCheckbox(task.id, task, { checked: task.done, extraClass: isGloballyLocked ? 'tm-operating' : '' })}
                            ${toggle}
                                </span>
                            <span class="tm-task-text ${task.done ? 'tm-task-done' : ''}" data-level="${row.depth}">
                                <span class="tm-task-content-clickable" onclick="tmJumpToTask('${task.id}', event)"${__tmBuildTooltipAttrs(String(task.content || '').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })}>${API.renderTaskContentHtml(task.markdown, task.content || '')}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span>
                            </span>
                        </div>
                    </td>
                    <td class="tm-cell-editable" style="width:${timelineStartW}px; min-width:${timelineStartW}px; max-width:${timelineStartW}px; ${otherCellBgStyle}" onclick="tmBeginCellEdit('${task.id}','startDate',this,event)">${__tmFormatTaskTime(task.startDate)}</td>
                    <td class="tm-cell-editable" style="width:${timelineEndW}px; min-width:${timelineEndW}px; max-width:${timelineEndW}px; ${otherCellBgStyle}" onclick="tmBeginCellEdit('${task.id}','completionTime',this,event)">${__tmFormatTaskTime(task.completionTime)}</td>
                </tr>
            `;
        };

        const rowModel = __tmBuildTaskRowModel();
        try { globalThis.__tmTimelineRowModel = rowModel; } catch (e) {}
        const leftRows = [];
        for (const r of (Array.isArray(rowModel) ? rowModel : [])) {
            if (r?.type === 'group') {
                let labelColor = '';
                if (r.kind === 'doc') labelColor = String(r.labelColor || 'var(--tm-group-doc-label-color)');
                else if (r.kind === 'task') labelColor = String(r.labelColor || 'var(--tm-primary-color)');
                else if (r.kind === 'time') labelColor = String(r.labelColor || 'var(--tm-text-color)');
                else if (r.kind === 'quadrant') {
                    const colorMap = { red: 'var(--tm-quadrant-red)', yellow: 'var(--tm-quadrant-yellow)', blue: 'var(--tm-quadrant-blue)', green: 'var(--tm-quadrant-green)' };
                    labelColor = colorMap[String(r.color || '')] || 'var(--tm-text-color)';
                } else {
                    labelColor = 'var(--tm-text-color)';
                }
                // 任务名分组使用文档颜色作为背景
                if (r.kind === 'task' && r.groupDocColor) {
                    currentGroupBg = enableGroupBg ? __tmGroupBgFromLabelColor(r.groupDocColor, isDark) : '';
                } else {
                    currentGroupBg = enableGroupBg ? __tmGroupBgFromLabelColor(labelColor, isDark) : '';
                }
                leftRows.push(renderGroupRow(r));
                continue;
            }
            if (r?.type === 'task') {
                const task = state.flatTasks[r.id];
                if (task?.root_id) {
                    const taskDocColor = __tmGetDocColorHex(task.root_id, isDark) || '';
                    if (taskDocColor && enableGroupBg) {
                        currentGroupBg = __tmGroupBgFromLabelColor(taskDocColor, isDark);
                    } else {
                        currentGroupBg = '';
                    }
                } else {
                    currentGroupBg = '';
                }
                leftRows.push(renderTaskRow(r));
                continue;
            }
        }
        const html = leftRows.join('') || `<tr><td colspan="3" style="text-align:center; padding:40px; color:var(--tm-secondary-text);">暂无任务</td></tr>`;
        try { tbody.innerHTML = html; } catch (e) { return false; }
        try { __tmBindTimelineLeftCollapseInteractions(leftBody); } catch (e) {}

        const view = globalThis.__TaskHorizonGanttView;
        if (view && typeof view.render === 'function' && ganttHeader && ganttBody) {
            try {
                view.render({
                    headerEl: ganttHeader,
                    bodyEl: ganttBody,
                    rowModel,
                    getTaskById: (id) => state.flatTasks[String(id)],
                    viewState: state.ganttView,
                    onUpdateTaskDates: async (taskId, patch) => {
                        const id = String(taskId || '').trim();
                        if (!id) return;
                        const task = state.flatTasks[id];
                        if (!task) return;
                        const startDate = String(patch?.startDate || '').trim();
                        const completionTime = String(patch?.completionTime || '').trim();
                        const nextStart = startDate ? __tmNormalizeDateOnly(startDate) : '';
                        const nextEnd = completionTime ? __tmNormalizeDateOnly(completionTime) : '';
                        task.startDate = nextStart;
                        task.completionTime = nextEnd;
                        try {
                            await __tmPersistMetaAndAttrsAsync(id, { startDate: nextStart, completionTime: nextEnd }, { background: true, skipFlush: true });
                        } catch (e) {
                            hint(`❌ 更新失败: ${e.message}`, 'error');
                        }
                        if (__tmCanUpdateTimelineDatesInPlace(task) && __tmUpdateTimelineTaskInDOM(id)) {
                            return;
                        }
                        __tmRefreshMainViewInPlace({ withFilters: true });
                    },
                    onUpdateTaskMeta: async (taskId, patch) => {
                        const id = String(taskId || '').trim();
                        if (!id || !patch || typeof patch !== 'object') return;
                        const task = state.flatTasks[id];
                        if (!task) return;
                        const hasMilestone = Object.prototype.hasOwnProperty.call(patch, 'milestone');
                        if (!hasMilestone) return;
                        const val = !!patch.milestone;
                        task.milestone = val;
                        try {
                            await __tmPersistMetaAndAttrsAsync(id, { milestone: val ? '1' : '' }, { background: true, skipFlush: true });
                        } catch (e) {
                            hint(`❌ 更新失败: ${e.message}`, 'error');
                        }
                        __tmRefreshMainViewInPlace({ withFilters: true });
                    },
                });
            } catch (e) {}
        }
        __tmScheduleTimelineTodayIndicatorRefresh();

        if (useGlobalScroll) {
            try { leftBody.scrollTop = 0; } catch (e) {}
            try { ganttBody.scrollTop = 0; } catch (e) {}
            try { ganttBody.scrollLeft = 0; } catch (e) {}
            try { globalScrollHost.scrollTop = savedTop; } catch (e) {}
            try { globalScrollHost.scrollLeft = savedLeft; } catch (e) {}
            try {
                const inner = ganttHeader?.querySelector?.('.tm-gantt-header-inner');
                if (inner) inner.style.transform = '';
            } catch (e) {}
        } else {
            try { leftBody.scrollTop = savedTop; } catch (e) {}
            try { ganttBody.scrollTop = savedTop; } catch (e) {}
            try { ganttBody.scrollLeft = savedLeft; } catch (e) {}
            try {
                const inner = ganttHeader?.querySelector?.('.tm-gantt-header-inner');
                if (inner) inner.style.transform = `translateX(${-ganttBody.scrollLeft}px)`;
            } catch (e) {}
        }

                const syncRowHeights = (force = false) => {
                    if (!force && Date.now() - (Number(state.__tmFlipTs) || 0) < 320) return;
                    const leftRowsNow = leftBody.querySelectorAll('tbody tr');
                    const rightRowsNow = ganttBody.querySelectorAll('.tm-gantt-row,.tm-gantt-row--group');
            const n = Math.min(leftRowsNow.length, rightRowsNow.length);
            if (n <= 0) return;
            for (let i = 0; i < n; i++) {
                const lr = leftRowsNow[i];
                const rr = rightRowsNow[i];
                if (!(lr instanceof Element) || !(rr instanceof Element)) continue;
                rr.style.height = '';
                rr.style.minHeight = '';
                rr.style.maxHeight = '';
                if ((lr.style.display || '') === 'none') continue;
                const h = lr.getBoundingClientRect?.().height;
                if (Number.isFinite(h) && h > 0) {
                    rr.style.height = `${h}px`;
                    rr.style.minHeight = `${h}px`;
                    rr.style.maxHeight = `${h}px`;
                }
                const bar = rr.querySelector?.('.tm-gantt-bar');
                if (bar) {
                    bar.style.top = 'calc((var(--tm-row-height) - var(--tm-gantt-card-height)) / 2)';
                    bar.style.transform = 'none';
                }
                    }
                };
        try {
            syncRowHeights(true);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                syncRowHeights();
                setTimeout(syncRowHeights, 60);
                setTimeout(syncRowHeights, 260);
                setTimeout(syncRowHeights, 420);
            }));
        } catch (e) {}

        try { queueMicrotask(() => { try { __tmRunFlipAnimation(modal); } catch (e) {} }); } catch (e) {
            try { Promise.resolve().then(() => { try { __tmRunFlipAnimation(modal); } catch (e2) {} }); } catch (e2) {}
        }
        try { __tmApplyReminderTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleReminderTaskNameMarksRefresh(modal); } catch (e) {}
        try { __tmApplyTodayScheduledTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleTodayScheduledTaskNameMarksRefresh(modal); } catch (e) {}
        return true;
    }

    function __tmBuildElementFromHtml(html) {
        const shell = document.createElement('div');
        try { shell.innerHTML = String(html || '').trim(); } catch (e) { return null; }
        return shell.firstElementChild instanceof HTMLElement ? shell.firstElementChild : null;
    }

    function __tmCleanupChecklistScrollFxForEl(paneEl) {
        if (!(paneEl instanceof HTMLElement)) return;
        try {
            if (paneEl.__tmChecklistScrollFxTimer) {
                clearTimeout(paneEl.__tmChecklistScrollFxTimer);
                paneEl.__tmChecklistScrollFxTimer = 0;
            }
        } catch (e) {}
        try {
            paneEl.__tmChecklistScrollResizeObserver?.disconnect?.();
            paneEl.__tmChecklistScrollResizeObserver = null;
        } catch (e) {}
        try {
            if (paneEl.__tmChecklistScrollStateTimer) {
                clearTimeout(paneEl.__tmChecklistScrollStateTimer);
                paneEl.__tmChecklistScrollStateTimer = 0;
            }
        } catch (e) {}
        try {
            if (paneEl.__tmChecklistScrollFxRaf) {
                cancelAnimationFrame(paneEl.__tmChecklistScrollFxRaf);
                paneEl.__tmChecklistScrollFxRaf = 0;
            }
        } catch (e) {}
        try { paneEl.__tmVerticalScrollNeedsMeasure = false; } catch (e) {}
        try { paneEl.classList.remove('tm-scroll-active'); } catch (e) {}
    }

    function __tmSyncSegmentButtonState(btn, active) {
        if (!(btn instanceof HTMLElement)) return;
        try { btn.classList.toggle('tm-view-seg-item--active', !!active); } catch (e) {}
        try { btn.setAttribute('data-state', active ? 'active' : 'inactive'); } catch (e) {}
        try { btn.setAttribute('aria-selected', active ? 'true' : 'false'); } catch (e) {}
    }

    function __tmSyncKanbanHeadingModeSegmentedUi(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        const headingActive = SettingsStore.data.kanbanHeadingGroupMode === true;
        let updated = false;
        try {
            modal.querySelectorAll('button[onclick*="tmSetKanbanHeadingGroupMode"]').forEach((btn) => {
                if (!(btn instanceof HTMLElement)) return;
                const onclick = String(btn.getAttribute('onclick') || '').trim();
                const isHeadingBtn = /tmSetKanbanHeadingGroupMode\(\s*['"]heading['"]/.test(onclick);
                const isStatusBtn = /tmSetKanbanHeadingGroupMode\(\s*['"]status['"]/.test(onclick);
                if (!isHeadingBtn && !isStatusBtn) return;
                __tmSyncSegmentButtonState(btn, isHeadingBtn ? headingActive : !headingActive);
                updated = true;
            });
        } catch (e) {}
        return updated;
    }

    function __tmRerenderChecklistInPlace(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        if (String(state.viewMode || '').trim() !== 'checklist') return false;
        try { __tmPushRefreshDebug('checklist-rerender-in-place', {}); } catch (e) {}
        const renderBodyHtml = state.renderChecklistBodyHtml;
        if (typeof renderBodyHtml !== 'function') return false;
        const body = modal.querySelector('.tm-body.tm-body--checklist');
        const pane = modal.querySelector('.tm-checklist-scroll');
        if (!(body instanceof HTMLElement) || !(pane instanceof HTMLElement)) return false;
        const staged = (state.pendingChecklistRenderRestore && typeof state.pendingChecklistRenderRestore === 'object')
            ? state.pendingChecklistRenderRestore
            : null;
        const panelState = __tmResolveChecklistDetailPanel(modal, { preferSheetMode: __tmChecklistUseSheetMode(modal) });
        const sheetMode = !!panelState.sheetMode;
        const detailPanel = panelState.panel;
        const detailTaskId = String(detailPanel?.__tmTaskDetailTask?.id || detailPanel?.dataset?.tmDetailTaskId || state.detailTaskId || '').trim();
        const paneTop = Number((staged && Number.isFinite(Number(staged.top))) ? Number(staged.top) : Number(pane.scrollTop || 0));
        const paneLeft = Number((staged && Number.isFinite(Number(staged.left))) ? Number(staged.left) : Number(pane.scrollLeft || 0));
        const detailTop = Number(detailPanel?.scrollTop || 0);
        const detailLeft = Number(detailPanel?.scrollLeft || 0);
        if (detailTaskId) {
            try {
                __tmPushDetailDebug('detail-host-rerender', {
                    scope: 'checklist',
                    source: 'checklist-rerender-in-place',
                    taskId: detailTaskId,
                    pendingSave: detailPanel?.__tmTaskDetailPendingSave === true,
                    hasActivePopover: !!detailPanel?.__tmTaskDetailActiveInlinePopover,
                    refreshHoldMsLeft: Math.max(0, Number(detailPanel?.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
                });
            } catch (e) {}
        }
        const nextBody = __tmBuildElementFromHtml(renderBodyHtml());
        if (!(nextBody instanceof HTMLElement)) return false;
        __tmCleanupChecklistScrollFxForEl(pane);
        try { body.replaceWith(nextBody); } catch (e) { return false; }
        try { __tmBindChecklistScrollVisibility(modal); } catch (e) {}
        try { __tmRefreshChecklistSelectionInPlace(modal, 'checklist-rerender'); } catch (e) {}
        try { __tmApplyReminderTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleReminderTaskNameMarksRefresh(modal); } catch (e) {}
        try { __tmApplyTodayScheduledTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleTodayScheduledTaskNameMarksRefresh(modal); } catch (e) {}
        const restore = () => {
            try {
                const nextPane = modal.querySelector('.tm-checklist-scroll');
                if (nextPane instanceof HTMLElement) {
                    nextPane.scrollTop = paneTop;
                    nextPane.scrollLeft = paneLeft;
                    try { nextPane.__tmChecklistScrollUpdateThumb?.(); } catch (e2) {}
                }
            } catch (e) {}
            try {
                const nextPanel = __tmResolveChecklistDetailPanel(modal, { preferSheetMode: sheetMode }).panel;
                if (nextPanel instanceof HTMLElement) {
                    nextPanel.scrollTop = detailTop;
                    nextPanel.scrollLeft = detailLeft;
                }
            } catch (e) {}
        };
        try { restore(); } catch (e) {}
        try { requestAnimationFrame(restore); } catch (e) {}
        try { setTimeout(restore, 30); } catch (e) {}
        try { setTimeout(restore, 90); } catch (e) {}
        state.pendingChecklistRenderRestore = null;
        return true;
    }

    function __tmRerenderKanbanInPlace(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        if (String(state.viewMode || '').trim() !== 'kanban') return false;
        const renderBodyHtml = state.renderKanbanBodyHtml;
        if (typeof renderBodyHtml !== 'function') return false;
        const body = modal.querySelector('.tm-body.tm-body--kanban');
        if (!(body instanceof HTMLElement)) return false;
        const bodyLeft = Number(body.scrollLeft || 0);
        const colScrollMap = new Map();
        try {
            modal.querySelectorAll('.tm-kanban-col').forEach((col) => {
                if (!(col instanceof HTMLElement)) return;
                const colKey = __tmGetKanbanColScrollKey(col);
                if (!colKey) return;
                const colBody = col.querySelector('.tm-kanban-col-body');
                if (!(colBody instanceof HTMLElement)) return;
                colScrollMap.set(colKey, Number(colBody.scrollTop || 0));
            });
        } catch (e) {}
        const detailScrollSnapshot = __tmCaptureKanbanDetailScrollSnapshot(modal);
        const detailPanel = modal.querySelector('#tmKanbanDetailPanel');
        const detailTaskId = String(detailPanel?.__tmTaskDetailTask?.id || detailPanel?.dataset?.tmDetailTaskId || state.kanbanDetailTaskId || '').trim();
        if (detailTaskId) {
            try {
                __tmPushDetailDebug('detail-host-rerender', {
                    scope: 'kanban',
                    source: 'kanban-rerender-in-place',
                    taskId: detailTaskId,
                    pendingSave: detailPanel?.__tmTaskDetailPendingSave === true,
                    hasActivePopover: !!detailPanel?.__tmTaskDetailActiveInlinePopover,
                    refreshHoldMsLeft: Math.max(0, Number(detailPanel?.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
                });
            } catch (e) {}
        }
        const nextBody = __tmBuildElementFromHtml(renderBodyHtml());
        if (!(nextBody instanceof HTMLElement)) return false;
        try { __tmClearKanbanDetailFloatingHandlers(); } catch (e) {}
        try { body.replaceWith(nextBody); } catch (e) { return false; }
        try { __tmBindKanbanPan(modal); } catch (e) {}
        try { __tmRefreshKanbanDetailInPlace(modal, { scrollSnapshot: detailScrollSnapshot, source: 'kanban-rerender-in-place' }); } catch (e) {}
        try { __tmApplyReminderTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleReminderTaskNameMarksRefresh(modal); } catch (e) {}
        try { __tmApplyTodayScheduledTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleTodayScheduledTaskNameMarksRefresh(modal); } catch (e) {}
        try { __tmSyncKanbanHeadingModeSegmentedUi(modal); } catch (e) {}
        const restore = () => {
            try {
                const nextBodyEl = modal.querySelector('.tm-body.tm-body--kanban');
                if (nextBodyEl instanceof HTMLElement) {
                    nextBodyEl.scrollLeft = bodyLeft;
                }
            } catch (e) {}
            try {
                modal.querySelectorAll('.tm-kanban-col').forEach((col) => {
                    if (!(col instanceof HTMLElement)) return;
                    const colKey = __tmGetKanbanColScrollKey(col);
                    if (!colKey || !colScrollMap.has(colKey)) return;
                    const colBody = col.querySelector('.tm-kanban-col-body');
                    if (!(colBody instanceof HTMLElement)) return;
                    colBody.scrollTop = Number(colScrollMap.get(colKey) || 0);
                });
            } catch (e) {}
            try { __tmSyncKanbanHeadingModeSegmentedUi(modal); } catch (e) {}
            try { __tmRefreshKanbanDetailInPlace(modal, { scrollSnapshot: detailScrollSnapshot, source: 'kanban-rerender-restore' }); } catch (e) {}
        };
        try { restore(); } catch (e) {}
        try { requestAnimationFrame(restore); } catch (e) {}
        return true;
    }

    function __tmRerenderWhiteboardInPlace(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        if (String(state.viewMode || '').trim() !== 'whiteboard') return false;
        const renderBodyHtml = state.renderWhiteboardBodyHtml;
        if (typeof renderBodyHtml !== 'function') return false;
        const body = modal.querySelector('.tm-body.tm-body--whiteboard');
        if (!(body instanceof HTMLElement)) return false;
        const bodyTop = Number(body.scrollTop || 0);
        const bodyLeft = Number(body.scrollLeft || 0);
        const sidebar = modal.querySelector('.tm-whiteboard-sidebar');
        const sidebarTop = Number(sidebar?.scrollTop || 0);
        const nextBody = __tmBuildElementFromHtml(renderBodyHtml());
        if (!(nextBody instanceof HTMLElement)) return false;
        try { body.replaceWith(nextBody); } catch (e) { return false; }
        try { __tmBindWhiteboardViewportInput(modal); } catch (e) {}
        try { __tmRefreshChecklistSelectionInPlace(modal, 'whiteboard-rerender'); } catch (e) {}
        const restore = () => {
            try {
                const nextBodyEl = modal.querySelector('.tm-body.tm-body--whiteboard');
                if (nextBodyEl instanceof HTMLElement) {
                    nextBodyEl.scrollTop = bodyTop;
                    nextBodyEl.scrollLeft = bodyLeft;
                }
            } catch (e) {}
            try {
                const nextSidebar = modal.querySelector('.tm-whiteboard-sidebar');
                if (nextSidebar instanceof HTMLElement) {
                    nextSidebar.scrollTop = sidebarTop;
                }
            } catch (e) {}
            try { __tmRefreshChecklistSelectionInPlace(modal, 'whiteboard-rerender-restore'); } catch (e) {}
        };
        try { restore(); } catch (e) {}
        try { requestAnimationFrame(restore); } catch (e) {}
        return true;
    }

    function __tmRerenderCurrentViewInPlace(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        if (state.homepageOpen) {
            try { __tmRefreshHomepageInPlace().catch(() => null); } catch (e) {}
            return true;
        }
        if (state.viewMode === 'calendar') {
            if (__tmHasCalendarSidebarChecklist(modal)) {
                __tmRefreshCalendarSidebarChecklistPreserveScroll();
                return true;
            }
            try {
                if (globalThis.__tmCalendar?.requestRefresh || globalThis.__tmCalendar?.refreshInPlace) {
                    __tmRequestCalendarRefresh({
                        reason: 'rerender-current-calendar-view',
                        main: true,
                        side: true,
                        flushTaskPanel: true,
                        hard: false,
                    }, { hard: false });
                    return true;
                }
            } catch (e) {}
        }
        if (state.viewMode === 'timeline') return __tmRerenderTimelineInPlace(modal);
        if (state.viewMode === 'list') return __tmRerenderListInPlace(modal);
        if (state.viewMode === 'checklist') return __tmRerenderChecklistInPlace(modal);
        if (state.viewMode === 'kanban') return __tmRerenderKanbanInPlace(modal);
        if (state.viewMode === 'whiteboard') return __tmRerenderWhiteboardInPlace(modal);
        return false;
    }

    function __tmRerenderCollapseInPlace() {
        const modal = state.modal;
        if (!modal) return false;
        if (state.viewMode === 'timeline') return __tmRerenderTimelineInPlace(modal);
        return __tmRerenderListInPlace(modal);
    }

