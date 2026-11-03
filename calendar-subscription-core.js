(function (scope) {
    'use strict';

    const encoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;
    const CALENDAR_TIMEZONE = 'Asia/Shanghai';
    const CALENDAR_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;

    function utf8ByteLength(value) {
        const text = String(value ?? '');
        if (encoder) return encoder.encode(text).length;
        return unescape(encodeURIComponent(text)).length;
    }

    function escapeText(value) {
        return String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/\r\n|\r|\n/g, '\\n')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,');
    }

    function foldLine(value) {
        const text = String(value ?? '');
        const chunks = [];
        let chunk = '';
        let chunkBytes = 0;
        let first = true;
        for (const character of text) {
            const characterBytes = utf8ByteLength(character);
            const limit = first ? 75 : 74;
            if (chunk && chunkBytes + characterBytes > limit) {
                chunks.push(chunk);
                chunk = character;
                chunkBytes = characterBytes;
                first = false;
            } else {
                chunk += character;
                chunkBytes += characterBytes;
            }
        }
        chunks.push(chunk);
        return chunks.join('\r\n ');
    }

    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function formatUtc(value) {
        const date = value instanceof Date ? new Date(value.getTime()) : new Date(Number(value));
        if (Number.isNaN(date.getTime())) throw new Error('ICS 时间无效');
        return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
    }

    function formatCalendarTime(value) {
        const date = value instanceof Date ? new Date(value.getTime()) : new Date(Number(value));
        if (Number.isNaN(date.getTime())) throw new Error('ICS 时间无效');
        const local = new Date(date.getTime() + CALENDAR_TIMEZONE_OFFSET_MS);
        return `${local.getUTCFullYear()}${pad2(local.getUTCMonth() + 1)}${pad2(local.getUTCDate())}T${pad2(local.getUTCHours())}${pad2(local.getUTCMinutes())}${pad2(local.getUTCSeconds())}`;
    }

    function formatDateValue(value) {
        const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) throw new Error(`ICS 全天日期无效: ${String(value || '')}`);
        return `${match[1]}${match[2]}${match[3]}`;
    }

    function stableToken(value) {
        const text = String(value ?? '');
        let first = 0x811c9dc5;
        let second = 0x9e3779b9;
        for (let index = 0; index < text.length; index += 1) {
            const code = text.charCodeAt(index);
            first = Math.imul(first ^ code, 0x01000193) >>> 0;
            second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
        }
        return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
    }

    function stableStringify(value) {
        if (value === null || typeof value !== 'object') return JSON.stringify(value);
        if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
        const keys = Object.keys(value).sort();
        return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }

    async function hashText(value) {
        const text = String(value ?? '');
        if (scope.crypto?.subtle && encoder) {
            try {
                const digest = await scope.crypto.subtle.digest('SHA-256', encoder.encode(text));
                return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, '0')).join('');
            } catch (error) {}
        }
        return `fallback-${stableToken(text)}-${utf8ByteLength(text)}`;
    }

    function normalizeAlarmLines(event, title) {
        if (event?.completed === true || !event?.alarm) return [];
        const alarm = event.alarm;
        const trigger = String(alarm.trigger || '').trim();
        const absoluteAt = Number(alarm.absoluteAt);
        if (!trigger && !Number.isFinite(absoluteAt)) return [];
        return [
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            `DESCRIPTION:${escapeText(alarm.description || title)}`,
            Number.isFinite(absoluteAt)
                ? `TRIGGER;VALUE=DATE-TIME:${formatUtc(absoluteAt)}`
                : `TRIGGER:${trigger}`,
            'END:VALARM',
        ];
    }

    function serializeEvent(event, generatedAt) {
        const rawSource = String(event?.source || 'schedule').trim().toLowerCase();
        const source = rawSource === 'tomato'
            ? 'tomato'
            : (rawSource === 'task' ? 'task' : (rawSource === 'holiday' ? 'holiday' : 'schedule'));
        const title = String(event?.title || '').trim()
            || (source === 'tomato'
                ? '任务提醒'
                : (source === 'task' ? '任务' : (source === 'holiday' ? '个人休息日' : '日程')));
        const uidSeed = String(event?.uidSeed || '').trim();
        if (!uidSeed) throw new Error('ICS 事件缺少 uidSeed');
        const lines = [
            'BEGIN:VEVENT',
            `UID:${stableToken(uidSeed)}@siyuan-task-horizon`,
            `DTSTAMP:${formatUtc(generatedAt)}`,
        ];
        if (event?.allDay === true) {
            lines.push(`DTSTART;VALUE=DATE:${formatDateValue(event.startDate)}`);
            lines.push(`DTEND;VALUE=DATE:${formatDateValue(event.endDate)}`);
        } else {
            const startAt = Number(event?.startAt);
            if (!Number.isFinite(startAt)) throw new Error(`ICS 事件开始时间无效: ${uidSeed}`);
            lines.push(`DTSTART;TZID=${CALENDAR_TIMEZONE}:${formatCalendarTime(startAt)}`);
            const requestedEndAt = Number(event?.endAt);
            const endAt = Number.isFinite(requestedEndAt) && requestedEndAt > startAt
                ? requestedEndAt
                : startAt + 60_000;
            lines.push(`DTEND;TZID=${CALENDAR_TIMEZONE}:${formatCalendarTime(endAt)}`);
        }
        lines.push(`SUMMARY:${escapeText(title)}`);
        const description = String(event?.description || '').trim();
        if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
        lines.push(`CATEGORIES:${source === 'tomato'
            ? 'Task Horizon,Task Reminder'
            : (source === 'task'
                ? 'Task Horizon,Task Date'
                : (source === 'holiday' ? 'Task Horizon,Custom Holiday' : 'Task Horizon,Schedule'))}`);
        lines.push(`X-TASK-HORIZON-SOURCE:${source.toUpperCase()}`);
        if (event?.completed === true) lines.push('X-TASK-HORIZON-COMPLETED:TRUE');
        lines.push(...normalizeAlarmLines(event, title));
        lines.push('END:VEVENT');
        return lines;
    }

    function serializeCalendar(input = {}) {
        const generatedAt = Number(input.generatedAt) || Date.now();
        const events = Array.isArray(input.events) ? input.events.slice() : [];
        events.sort((left, right) => {
            const leftStart = left?.allDay === true ? String(left?.startDate || '') : Number(left?.startAt) || 0;
            const rightStart = right?.allDay === true ? String(right?.startDate || '') : Number(right?.startAt) || 0;
            if (leftStart < rightStart) return -1;
            if (leftStart > rightStart) return 1;
            return String(left?.uidSeed || '').localeCompare(String(right?.uidSeed || ''));
        });
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//SiYuan//Task Horizon//CN',
            'CALSCALE:GREGORIAN',
            `X-WR-CALNAME:${escapeText(input.calendarName || '任务管理器')}`,
            `X-WR-TIMEZONE:${CALENDAR_TIMEZONE}`,
            'BEGIN:VTIMEZONE',
            `TZID:${CALENDAR_TIMEZONE}`,
            `X-LIC-LOCATION:${CALENDAR_TIMEZONE}`,
            'BEGIN:STANDARD',
            'TZOFFSETFROM:+0800',
            'TZOFFSETTO:+0800',
            'TZNAME:CST',
            'DTSTART:19700101T000000',
            'END:STANDARD',
            'END:VTIMEZONE',
        ];
        for (const event of events) lines.push(...serializeEvent(event, generatedAt));
        lines.push('END:VCALENDAR');
        return `${lines.map(foldLine).join('\r\n')}\r\n`;
    }

    const CONTENT_TYPE = 'text/calendar; charset=utf-8';
    const CACHE_CONTROL = 'no-cache, max-age=0, must-revalidate';

    function fail(key) {
        const error = new Error(scope.__taskHorizonHostBridge?.i18n?.t(key) || key);
        error.code = key;
        throw error;
    }

    function normalizeUrl(value) {
        const text = String(value || '').trim();
        let url;
        try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); }
        catch (error) { fail('calendar.s3InvalidAddress'); }
        if (!text || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
            fail('calendar.s3InvalidAddress');
        }
        return url;
    }

    function isPrivateHost(hostname) {
        const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
        return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.lan')
            || /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)
            || host === '::1' || (/^(?:fc|fd|fe[89ab])/.test(host) && host.includes(':'))
            || /^::ffff:(?:127\.|10\.|192\.168\.)/.test(host);
    }

    function normalize(config = {}, siyuan = null) {
        const source = config.useSiyuanConfig ? siyuan : config;
        if (!source) fail('calendar.s3SiyuanConfigMissing');
        const bucket = String(config.bucket || source.bucket || '').trim();
        const endpoint = String(source.endpoint || '').trim();
        const accessKeyId = String(config.useSiyuanConfig ? source.accessKey || '' : source.accessKeyId || '').trim();
        const secretAccessKey = String(config.useSiyuanConfig ? source.secretKey || '' : source.secretAccessKey || '');
        if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) fail('calendar.s3ConfigIncomplete');
        if (/[\s/\\?#:@\[\]]/.test(bucket)) fail('calendar.s3InvalidBucket');
        const endpointUrl = normalizeUrl(endpoint);
        const prefix = String(config.storagePath || '').trim().replace(/^\/+|\/+$/g, '');
        if (prefix.split('/').some(part => part === '.' || part === '..') || /[\\\u0000-\u001f]/.test(prefix)) {
            fail('calendar.s3InvalidPath');
        }
        const fileName = String(config.fileName || '').trim();
        if (!fileName || !/\.ics$/i.test(fileName) || /[/\\\u0000-\u001f]/.test(fileName) || fileName === '.ics') {
            fail('calendar.s3InvalidFileName');
        }
        const key = `${prefix ? `${prefix}/` : ''}${fileName}`;
        const forcePathStyle = config.useSiyuanConfig ? source.pathStyle !== false : config.forcePathStyle !== false;
        const publicBase = String(config.publicBaseUrl || '').trim();
        const url = normalizeUrl(publicBase || endpoint);
        url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
        if (!publicBase) {
            if (forcePathStyle) url.pathname += `${encodeURIComponent(bucket)}/`;
            else {
                if (isPrivateHost(url.hostname) || url.hostname.includes(':')) fail('calendar.s3PathStyleRequired');
                url.hostname = `${bucket}.${url.hostname}`;
            }
        }
        url.pathname += key.split('/').map(encodeURIComponent).join('/');
        return {
            endpoint: endpointUrl.toString().replace(/\/$/, ''),
            region: String(source.region || 'auto').trim() || 'auto',
            bucket, accessKeyId, secretAccessKey, forcePathStyle, key, url: url.toString(),
            transport: config.transport === 'direct' || config.transport === 'proxy' ? config.transport : 'auto',
        };
    }

    function transportFor(url, transport = 'auto') {
        if (transport === 'direct' || transport === 'proxy') return transport;
        return isPrivateHost(new URL(url).hostname) ? 'direct' : 'proxy';
    }

    function sanitizeError(value, credentials = {}) {
        let message = String(value?.message || value || '');
        for (const secret of [credentials.accessKeyId, credentials.secretAccessKey]) {
            if (!secret) continue;
            for (const encoded of new Set([secret, encodeURIComponent(secret)])) message = message.split(encoded).join('[redacted]');
        }
        return message.replace(/https?:\/\/[^\s<>"']+/gi, '[S3 URL]')
            .replace(/(X-Amz-(?:Signature|Credential|Security-Token)=)[^&\s]+/gi, '$1[redacted]').slice(0, 600);
    }

    const DAV_NAMESPACE = 'DAV:';
    const CALDAV_NAMESPACE = 'urn:ietf:params:xml:ns:caldav';
    const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    function caldavFail(code, status) {
        const error = new Error(`CalDAV: ${code}${status ? ` (HTTP ${status})` : ''}`);
        error.code = code;
        error.status = status;
        return error;
    }
    function normalizeDavUrl(value, base) {
        let parsed;
        try { parsed = new URL(value, base); } catch (_) { throw caldavFail('invalidUrl'); }
        if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw caldavFail('invalidUrl');
        parsed.hash = '';
        return parsed.href;
    }
    function normalizeDavCollection(value) {
        const parsed = new URL(normalizeDavUrl(value));
        if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
        return parsed.href;
    }
    const xmlElements = (node, namespace, name) => Array.from(node.getElementsByTagNameNS(namespace, name));
    const xmlProperty = (node, namespace, name) => xmlElements(node, namespace, name)[0];
    const xmlText = (node, namespace, name) => xmlProperty(node, namespace, name)?.textContent?.trim() || '';
    function parseDavResponse(xmlTextValue, Parser) {
        const doc = new Parser().parseFromString(xmlTextValue, 'application/xml');
        if (xmlElements(doc, '*', 'parsererror').length || doc.documentElement?.localName !== 'multistatus'
            || doc.documentElement?.namespaceURI !== DAV_NAMESPACE) throw caldavFail('invalidResponse');
        return xmlElements(doc, DAV_NAMESPACE, 'response').map(response => {
            const href = xmlText(response, DAV_NAMESPACE, 'href');
            if (!href) throw caldavFail('invalidResponse');
            const props = xmlElements(response, DAV_NAMESPACE, 'propstat');
            const good = props.filter(item => /\s200(?:\s|$)/.test(xmlText(item, DAV_NAMESPACE, 'status')));
            return { href, good, failed: props.filter(item => !good.includes(item)), status: xmlText(response, DAV_NAMESPACE, 'status') };
        });
    }
    const davProp = (row, namespace, name) => row.good.map(item => xmlProperty(item, namespace, name)).find(Boolean);
    const davValue = (row, namespace, name) => davProp(row, namespace, name)?.textContent?.trim() || '';
    function icsProperty(ics, name) {
        const lines = String(ics).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
        return lines.find(line => line.toUpperCase().startsWith(`${name}:`))?.slice(name.length + 1) || '';
    }
    function semanticICS(ics) {
        const unfolded = String(ics).replace(/\r?\n[ \t]/g, '');
        const event = unfolded.slice(unfolded.indexOf('BEGIN:VEVENT'), unfolded.indexOf('END:VEVENT') + 'END:VEVENT'.length);
        return event.split(/\r?\n/)
            .filter(line => /^(?:BEGIN|END|UID|DTSTART|DTEND|SUMMARY|DESCRIPTION|CATEGORIES|ACTION|TRIGGER|X-TASK-HORIZON-(?:SOURCE|COMPLETED|OWNER|KEY))(?:[;:]|$)/i.test(line))
            .sort().join('\n');
    }
    function createCaldavClient(config, request, Parser = scope.DOMParser) {
        const root = normalizeDavCollection(config.url);
        const credentials = `${config.username || ''}:${config.password || ''}`;
        const authorization = config.username || config.password
            ? `Basic ${scope.btoa(Array.from(encoder.encode(credentials), byte => String.fromCharCode(byte)).join(''))}` : '';
        async function send(method, target, body = '', headers = {}) {
            const response = await request(normalizeDavUrl(target, root), method, { body, headers, authorization,
                contentType: method === 'PUT' ? CONTENT_TYPE : 'application/xml; charset=utf-8' });
            if (response.status < 200 || response.status >= 300) throw caldavFail('requestFailed', response.status);
            return response;
        }
        const query = async (target, depth) => parseDavResponse((await send('PROPFIND', target,
            `<d:propfind xmlns:d="DAV:" xmlns:c="${CALDAV_NAMESPACE}"><d:prop><d:resourcetype/><d:displayname/><d:current-user-principal/><c:calendar-home-set/><c:supported-calendar-component-set/><d:current-user-privilege-set/></d:prop></d:propfind>`, { Depth: String(depth) })).body, Parser);
        function calendars(rows, base) {
            return rows.filter(row => {
                const type = davProp(row, DAV_NAMESPACE, 'resourcetype');
                if (!type || !xmlElements(type, CALDAV_NAMESPACE, 'calendar').length) return false;
                const components = davProp(row, CALDAV_NAMESPACE, 'supported-calendar-component-set');
                if (components && !xmlElements(components, CALDAV_NAMESPACE, 'comp').some(item => item.getAttribute('name') === 'VEVENT')) return false;
                const rights = davProp(row, DAV_NAMESPACE, 'current-user-privilege-set');
                return !rights || ['all', 'write', 'write-content'].some(name => xmlElements(rights, DAV_NAMESPACE, name).length);
            }).map(row => ({ url: normalizeDavCollection(normalizeDavUrl(row.href, base)), name: davValue(row, DAV_NAMESPACE, 'displayname') || row.href }));
        }
        return {
            async discover() {
                const initial = await query(root, 0);
                const direct = calendars(initial, root);
                if (direct.length) return direct;
                let home = initial.map(row => davProp(row, CALDAV_NAMESPACE, 'calendar-home-set')).filter(Boolean).map(node => xmlText(node, DAV_NAMESPACE, 'href')).find(Boolean);
                if (!home) {
                    const principal = initial.map(row => davProp(row, DAV_NAMESPACE, 'current-user-principal')).filter(Boolean)
                        .map(node => xmlText(node, DAV_NAMESPACE, 'href')).find(Boolean);
                    if (principal) {
                        const principalUrl = normalizeDavUrl(principal, root);
                        const principals = await query(principalUrl, 0);
                        home = principals.map(row => davProp(row, CALDAV_NAMESPACE, 'calendar-home-set')).filter(Boolean)
                            .map(node => xmlText(node, DAV_NAMESPACE, 'href')).find(Boolean);
                        if (home) home = normalizeDavUrl(home, principalUrl);
                    }
                }
                const homeUrl = home ? normalizeDavUrl(home, root) : root;
                const found = calendars(await query(homeUrl, 1), homeUrl);
                if (!found.length) throw caldavFail('noCalendars');
                return Array.from(new Map(found.map(item => [item.url, item])).values());
            },
            async list(calendarUrl, owner) {
                const target = normalizeDavCollection(calendarUrl);
                const response = await send('REPORT', target,
                    `<c:calendar-query xmlns:d="DAV:" xmlns:c="${CALDAV_NAMESPACE}"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>`, { Depth: '1' });
                const found = new Map();
                for (const row of parseDavResponse(response.body, Parser)) {
                    const href = normalizeDavUrl(row.href, target);
                    if (href === target) continue;
                    if (!href.startsWith(target)) throw caldavFail('invalidResponse');
                    const data = davValue(row, CALDAV_NAMESPACE, 'calendar-data');
                    // A partial multistatus must never be mistaken for a complete empty calendar.
                    if (!data || row.failed.some(item => xmlProperty(item, CALDAV_NAMESPACE, 'calendar-data') || xmlProperty(item, DAV_NAMESPACE, 'getetag'))) throw caldavFail('incompleteResponse');
                    if (icsProperty(data, 'X-TASK-HORIZON-OWNER') !== owner) continue;
                    const key = icsProperty(data, 'X-TASK-HORIZON-KEY');
                    if (!key || !/(?:^|\r?\n)BEGIN:VEVENT(?:\r?\n|$)/.test(data) || found.has(key)) throw caldavFail('invalidResponse');
                    const etag = davValue(row, DAV_NAMESPACE, 'getetag');
                    if (!etag) throw caldavFail('missingEtag');
                    found.set(key, { href, etag, ics: data });
                }
                return found;
            },
            async put(target, ics, etag) {
                return send('PUT', target, ics, etag ? { 'If-Match': etag } : { 'If-None-Match': '*' });
            },
            async remove(target, etag) {
                if (!etag) throw caldavFail('missingEtag');
                try { await send('DELETE', target, '', { 'If-Match': etag }); }
                catch (error) { if (error.status !== 404) throw error; }
            },
        };
    }
    async function caldavResources(snapshot, owner, core, check = () => {}) {
        const result = new Map();
        for (const event of snapshot.events) {
            if (result.size && result.size % 128 === 0) await new Promise(resolve => setTimeout(resolve, 0));
            check();
            const key = core.stableToken(event.caldavKey || event.uidSeed);
            if (result.has(key)) throw caldavFail('duplicateIdentity');
            const content = { ...event, uidSeed: `caldav:${owner}:${key}` };
            const ics = core.serializeCalendar({ events: [content], calendarName: snapshot.calendarName, generatedAt: Date.now() })
                .replace('END:VEVENT', `X-TASK-HORIZON-OWNER:${owner}\r\nX-TASK-HORIZON-KEY:${key}\r\nEND:VEVENT`);
            result.set(key, { ics, name: `task-horizon-${owner}-${key}.ics` });
        }
        return result;
    }
    async function uploadCaldav(client, target, owner, desired, check, progress = () => {}) {
        check();
        const remote = await client.list(target, owner);
        check();
        const counts = { created: 0, updated: 0, deleted: 0, unchanged: 0 };
        for (const [key, item] of desired) {
            check();
            const previous = remote.get(key);
            if (previous && semanticICS(previous.ics) === semanticICS(item.ics)) counts.unchanged++;
            else {
                await client.put(previous?.href || new URL(item.name, normalizeDavCollection(target)).href, item.ics, previous?.etag);
                counts[previous ? 'updated' : 'created']++;
            }
            remote.delete(key);
            check();
            progress({ ...counts });
        }
        // Only this plugin's resources absent from a complete, current snapshot are removed.
        for (const previous of remote.values()) {
            check();
            await client.remove(previous.href, previous.etag);
            counts.deleted++;
            check();
            progress({ ...counts });
        }
        return counts;
    }

    const caldav = Object.freeze({
        createClient: createCaldavClient,
        resources: caldavResources,
        upload: uploadCaldav,
        semanticICS,
        collection: normalizeDavCollection,
        fail: caldavFail,
    });

    const s3 = Object.freeze({ CONTENT_TYPE, CACHE_CONTROL, normalize, transportFor, sanitizeError });

    const api = Object.freeze({
        version: 1,
        caldav,
        s3,
        escapeText,
        foldLine,
        formatCalendarTime,
        formatUtc,
        hashText,
        serializeCalendar,
        stableStringify,
        stableToken,
        utf8ByteLength,
    });

    scope.__tmCalendarSubscriptionCore = api;
    // CalDAV settings and upload runtime share the calendar subscription core.
    {
    const core = scope.__tmCalendarSubscriptionCore?.caldav;
    const t = (key, args) => scope.__taskHorizonHostBridge.i18n.t(key, args);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const runtime = { host: null, signature: '', revision: 0, timer: null, periodic: null, active: null, pending: false, root: null, status: {} };
    let deviceId;
    function identity() { return scope.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
    function device() {
        if (deviceId) return deviceId;
        try {
            deviceId = localStorage.getItem('tm-caldav-device') || identity();
            localStorage.setItem('tm-caldav-device', deviceId);
        } catch (_) { deviceId = identity(); }
        return deviceId;
    }
    function config(store = runtime.host?.getStore()) {
        const raw = store?.data?.calendarCaldav || {};
        return { enabled: raw.enabled === true, url: String(raw.url || '').trim(), username: String(raw.username || '').trim(),
            password: String(raw.password || ''), calendarUrl: String(raw.calendarUrl || '').trim(), namespace: String(raw.namespace || ''),
            mode: raw.mode === 'auto' ? 'auto' : 'manual', writerDevice: String(raw.writerDevice || '') };
    }
    function automatic() {
        const settings = config();
        return settings.enabled && settings.mode === 'auto' && settings.writerDevice === device() && !!settings.calendarUrl;
    }
    function statusKey() {
        const settings = config();
        return `tm-caldav-status:${settings.namespace}:${scope.__tmCalendarSubscriptionCore.stableToken(settings.calendarUrl)}`;
    }
    function update(patch) {
        Object.assign(runtime.status, patch);
        try { localStorage.setItem(statusKey(), JSON.stringify({ ...runtime.status, running: false })); } catch (_) {}
        runtime.host?.statusChanged?.();
        const root = runtime.root;
        if (!root) return;
        const status = root.querySelector('[data-tm-caldav-status]');
        if (status) {
            const counts = runtime.status.counts;
            status.textContent = [runtime.status.running ? t('caldav.uploading') : '', runtime.status.message || '',
                runtime.status.lastSuccess ? `${t('caldav.lastSuccess')}: ${new Date(runtime.status.lastSuccess).toLocaleString()}` : '',
                counts ? t('caldav.counts', counts) : ''].filter(Boolean).join(' · ');
        }
        root.querySelectorAll('[data-tm-caldav-action="upload"],[data-tm-caldav-action="discover"]').forEach(button => {
            button.disabled = !!runtime.active || (button.dataset.tmCaldavAction === 'upload' && !config().enabled);
        });
    }
    function message(error) {
        if (error.status) return t('caldav.httpError', { status: error.status });
        const known = ['invalidUrl', 'invalidResponse', 'incompleteResponse', 'missingEtag', 'noCalendars', 'duplicateIdentity', 'notReady', 'notConfigured', 'changed', 'timeout'];
        return known.includes(error.code) ? t(`caldav.${error.code}`) : t('caldav.failed');
    }
    function makeRun(discovery) {
        const signature = JSON.stringify(config());
        const revision = runtime.revision;
        const controller = new AbortController();
        let error;
        let rejectStopped;
        const stopped = new Promise((resolve, reject) => { rejectStopped = reject; });
        stopped.catch(() => {});
        const cancel = reason => {
            if (error) return;
            error = reason;
            controller.abort();
            rejectStopped(reason);
        };
        const deadline = setTimeout(() => cancel(core.fail('timeout')), 600000);
        const run = {
            cancel, remoteWriteStarted: false,
            check() {
                if (error) throw error;
                if (!runtime.host || JSON.stringify(config()) !== signature || (!discovery && runtime.revision !== revision)) throw core.fail('changed');
                if (!discovery && !config().enabled) throw core.fail('changed');
                run.assertCurrent?.();
            },
            async wait(phase, operation) {
                run.check();
                const timer = setTimeout(() => cancel(core.fail('timeout')), 60000);
                try {
                    const result = await Promise.race([stopped, Promise.resolve().then(() => operation(controller.signal))]);
                    run.check();
                    return result;
                } finally { clearTimeout(timer); }
            },
            dispose() { clearTimeout(deadline); cancel(core.fail('changed')); },
        };
        return run;
    }
    async function execute(discovery) {
        if (runtime.active) {
            if (runtime.active.discovery !== discovery) throw core.fail('notReady');
            return runtime.active.promise;
        }
        if (!runtime.host) throw core.fail('notReady');
        if (runtime.timer) clearTimeout(runtime.timer);
        runtime.timer = null;
        const initial = config();
        if (!initial.url || (!discovery && (!initial.enabled || !initial.calendarUrl || !initial.namespace))) throw core.fail('notConfigured');
        const run = makeRun(discovery);
        const active = { run, discovery, promise: null };
        runtime.active = active;
        runtime.pending = false;
        update({ running: true, message: '', counts: null });
        active.promise = Promise.resolve().then(async () => {
            const host = runtime.host;
            if (discovery) {
                const client = core.createClient(initial, (url, method, options) => host.request(url, method, options, run));
                return await client.discover();
            }
            const snapshot = await host.collect(run);
            run.check();
            const client = core.createClient(config(), (url, method, options) => host.request(url, method, options, run));
            const desired = await run.wait('', () => core.resources(snapshot, initial.namespace, scope.__tmCalendarSubscriptionCore, run.check));
            const counts = await core.upload(client, initial.calendarUrl, initial.namespace, desired, run.check, counts => update({ counts }));
            run.check();
            update({ counts, lastSuccess: Date.now(), lastError: '', message: t('caldav.success') });
            return counts;
        }).catch(error => {
            update({ lastError: message(error), message: message(error) });
            throw error;
        }).finally(() => {
            run.dispose();
            if (runtime.active !== active) return;
            runtime.active = null;
            update({ running: false });
            if (runtime.pending && automatic()) schedule(2000);
        });
        update({ running: true });
        return active.promise;
    }
    function schedule(delay = 2000) {
        if (!automatic()) return;
        if (runtime.active) { runtime.pending = true; return; }
        if (runtime.timer) clearTimeout(runtime.timer);
        runtime.timer = setTimeout(() => { runtime.timer = null; execute(false).catch(() => {}); }, runtime.host?.isReady?.() === false ? Math.max(20000, delay) : delay);
    }
    function markDirty() {
        runtime.revision++;
        schedule();
    }
    function reconcile() {
        const signature = JSON.stringify(config());
        const changed = runtime.signature !== signature;
        if (changed) {
            runtime.signature = signature;
            runtime.revision++;
            runtime.active?.run.cancel(core.fail('changed'));
            if (runtime.timer) clearTimeout(runtime.timer);
            runtime.timer = null;
            try { runtime.status = JSON.parse(localStorage.getItem(statusKey()) || '{}'); } catch (_) { runtime.status = {}; }
        }
        if (runtime.periodic) clearInterval(runtime.periodic);
        runtime.periodic = null;
        if (automatic()) {
            runtime.periodic = setInterval(() => schedule(0), 15 * 60 * 1000);
            if (changed) schedule(20000);
        } else if (runtime.timer) { clearTimeout(runtime.timer); runtime.timer = null; }
        update({});
    }
    function configure(host) { runtime.host = host; reconcile(); }
    function renderSettings(store) {
        const settings = config(store);
        const row = (label, input) => `<div class="tm-calendar-settings-row"><div class="tm-calendar-settings-label">${esc(label)}</div>${input}</div>`;
        const field = (name, type = 'text') => `<input class="tm-calendar-settings-input b3-text-field" type="${type}" autocomplete="${type === 'password' ? 'new-password' : 'off'}" aria-label="${esc(t(`caldav.${name}`))}" data-tm-caldav-field="${name}" value="${esc(settings[name])}">`;
        return `<section class="tm-settings-panel tm-calendar-settings-panel" data-tm-settings-section="calendar-caldav">
            <div class="tm-calendar-settings-section-title">${esc(t('caldav.title'))}</div>
            <div class="tm-settings-section-desc">${esc(t('caldav.description'))}</div>
            ${row(t('caldav.enabled'), `<input class="b3-switch" type="checkbox" aria-label="${esc(t('caldav.enabled'))}" data-tm-caldav-field="enabled" ${settings.enabled ? 'checked' : ''}>`)}
            ${row(t('caldav.url'), field('url', 'url'))}
            ${row(t('caldav.username'), field('username'))}
            ${row(t('caldav.password'), field('password', 'password'))}
            ${row(t('caldav.calendarUrl'), `<select class="tm-calendar-settings-select" aria-label="${esc(t('caldav.calendarUrl'))}" data-tm-caldav-field="calendarUrl"><option value="${esc(settings.calendarUrl)}">${esc(settings.calendarUrl || t('caldav.selectCalendar'))}</option></select>`)}
            ${row(t('caldav.mode'), `<select class="tm-calendar-settings-select" aria-label="${esc(t('caldav.mode'))}" data-tm-caldav-field="mode"><option value="manual">${esc(t('caldav.manual'))}</option><option value="auto" ${settings.mode === 'auto' && settings.writerDevice === device() ? 'selected' : ''}>${esc(t('caldav.auto'))}</option></select>`)}
            ${row(t('caldav.editContent'), `<button class="tm-btn" type="button" data-tm-call="tmOpenSettingsV2Page" data-tm-args='["calendar","c-ics"]'>${esc(t('caldav.editContent'))}</button>`)}
            <div class="tm-settings-section-desc">${esc(t('caldav.sharedContent'))}</div>
            <div class="tm-calendar-settings-row tm-calendar-settings-row--actions"><button class="tm-btn" type="button" data-tm-caldav-action="discover">${esc(t('caldav.discover'))}</button><button class="tm-btn" type="button" data-tm-caldav-action="upload" ${settings.enabled ? '' : 'disabled'}>${esc(t('caldav.uploadNow'))}</button></div>
            <div class="tm-settings-section-desc" role="status" aria-live="polite" data-tm-caldav-status></div>
        </section>`;
    }
    function bind(root, store, signal) {
        runtime.root = root;
        async function save(next) {
            if (!next.namespace) next.namespace = identity();
            store.data.calendarCaldav = next;
            reconcile();
            if (typeof store.saveNow === 'function') await store.saveNow();
            else if (typeof store.flushSave === 'function') { store.saveDirty = true; await store.flushSave(); }
            else await store.save();
            runtime.host?.changed?.();
        }
        root.addEventListener('change', async event => {
            const input = event.target;
            const name = input?.dataset?.tmCaldavField;
            if (!name) return;
            const next = config(store);
            if (!Object.hasOwn(next, name)) return;
            next[name] = name === 'enabled' ? input.checked : String(input.value);
            if (['url', 'username', 'password'].includes(name)) next.calendarUrl = '';
            if (name === 'mode') next.writerDevice = device();
            try { await save(next); update({ message: '' }); }
            catch (error) { update({ message: message(error) }); }
            const select = root.querySelector('[data-tm-caldav-field="calendarUrl"]');
            if (select && !next.calendarUrl) select.innerHTML = `<option value="">${esc(t('caldav.selectCalendar'))}</option>`;
        }, { signal });
        root.addEventListener('click', async event => {
            const button = event.target.closest?.('[data-tm-caldav-action]');
            if (!button || runtime.active) return;
            try {
                if (button.dataset.tmCaldavAction === 'upload') await execute(false);
                else {
                    const calendars = await execute(true);
                    if (signal.aborted || !root.isConnected) return;
                    const select = root.querySelector('[data-tm-caldav-field="calendarUrl"]');
                    const next = config(store);
                    if (!calendars.some(item => item.url === next.calendarUrl)) next.calendarUrl = calendars.length === 1 ? calendars[0].url : '';
                    select.innerHTML = `<option value="">${esc(t('caldav.selectCalendar'))}</option>` + calendars.map(item => `<option value="${esc(item.url)}">${esc(item.name)}</option>`).join('');
                    select.value = next.calendarUrl;
                    await save(next);
                    update({ message: t('caldav.discovered', { count: calendars.length }) });
                }
            } catch (error) { update({ message: message(error) }); }
        }, { signal });
        update({});
    }
    function cleanup() {
        runtime.active?.run.cancel(core.fail('changed'));
        if (runtime.timer) clearTimeout(runtime.timer);
        if (runtime.periodic) clearInterval(runtime.periodic);
        runtime.timer = runtime.periodic = null;
        runtime.host = runtime.root = null;
        runtime.signature = '';
    }
    scope.__tmCalendarCaldav = { configure, reconcile, markDirty, automatic, renderSettings, bind, cleanup,
        async uploadNow(options = {}) {
            try {
                const counts = await execute(false);
                if (options.interactive) runtime.host?.notify?.(t('caldav.success'), 'success');
                return counts;
            } catch (error) {
                if (options.interactive) runtime.host?.notify?.(message(error), 'error');
                throw error;
            }
        },
        discover: () => execute(true), isRunning: () => !!runtime.active, getStatus: () => ({ ...runtime.status }) };

    }

    if (typeof module === 'object' && module?.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
