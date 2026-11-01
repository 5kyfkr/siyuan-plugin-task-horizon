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

    const s3 = Object.freeze({ CONTENT_TYPE, CACHE_CONTROL, normalize, transportFor, sanitizeError });

    const api = Object.freeze({
        version: 1,
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
    if (typeof module === 'object' && module?.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
