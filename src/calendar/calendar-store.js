(function (global) {
    'use strict';

    const dateMath = global.__tmCalendarDate || {};

    function cloneDate(value) {
        const date = dateMath.toDate?.(value);
        return date ? new Date(date.getTime()) : null;
    }

    function normalizeEventInput(input, sourceId = '') {
        const source = input && typeof input === 'object' ? input : {};
        const start = cloneDate(source.start);
        if (!start) return null;
        const allDay = source.allDay === true;
        let end = cloneDate(source.end);
        if (!end || end.getTime() <= start.getTime()) {
            end = new Date(start.getTime() + (allDay ? dateMath.DAY_MS : 30 * 60 * 1000));
        }
        const extendedProps = source.extendedProps && typeof source.extendedProps === 'object'
            ? { ...source.extendedProps }
            : {};
        const id = String(source.id || `${sourceId || 'event'}:${start.getTime()}:${Math.random().toString(36).slice(2, 8)}`).trim();
        return {
            id,
            title: String(source.title || ''),
            start,
            end,
            allDay,
            backgroundColor: source.backgroundColor || source.color || '',
            borderColor: source.borderColor || '',
            textColor: source.textColor || '',
            classNames: Array.isArray(source.classNames) ? source.classNames.slice() : [],
            extendedProps,
            sourceId: String(source.sourceId || source.__tmSourceId || sourceId || '').trim(),
            editable: source.editable !== false,
            durationEditable: source.durationEditable !== false,
            _raw: source,
        };
    }

    function createEventApi(input, sourceId, callbacks = {}) {
        const record = normalizeEventInput(input, sourceId);
        if (!record) return null;
        const notify = (kind, detail) => {
            try { callbacks.onChange?.(kind, api, detail); } catch (e) {}
        };
        const api = {
            get id() { return record.id; },
            get title() { return record.title; },
            set title(value) { record.title = String(value || ''); },
            get start() { return record.start ? new Date(record.start.getTime()) : null; },
            get end() { return record.end ? new Date(record.end.getTime()) : null; },
            get allDay() { return record.allDay === true; },
            get backgroundColor() { return record.backgroundColor; },
            get borderColor() { return record.borderColor; },
            get textColor() { return record.textColor; },
            get classNames() { return record.classNames.slice(); },
            get extendedProps() { return record.extendedProps; },
            get source() { return { id: record.sourceId }; },
            get editable() { return record.editable !== false; },
            get durationEditable() { return record.durationEditable !== false; },
            setDates(start, end, options = {}) {
                const nextStart = cloneDate(start);
                const nextEnd = cloneDate(end);
                if (!nextStart) return false;
                record.start = nextStart;
                record.end = nextEnd && nextEnd.getTime() > nextStart.getTime()
                    ? nextEnd
                    : new Date(nextStart.getTime() + (options.allDay === true ? dateMath.DAY_MS : 30 * 60 * 1000));
                if (Object.prototype.hasOwnProperty.call(options, 'allDay')) record.allDay = options.allDay === true;
                notify('dates', { start: api.start, end: api.end, allDay: api.allDay });
                return true;
            },
            setStart(start, options = {}) { return api.setDates(start, api.end, options); },
            setEnd(end, options = {}) { return api.setDates(api.start, end, options); },
            setExtendedProp(key, value) {
                const name = String(key || '').trim();
                if (!name) return false;
                record.extendedProps[name] = value;
                notify('extendedProp', { key: name, value });
                return true;
            },
            setProp(key, value) {
                const name = String(key || '').trim();
                if (name === 'title') record.title = String(value || '');
                else if (name === 'backgroundColor' || name === 'color') record.backgroundColor = String(value || '');
                else if (name === 'borderColor') record.borderColor = String(value || '');
                else if (name === 'textColor') record.textColor = String(value || '');
                else if (name === 'classNames' || name === 'className') record.classNames = Array.isArray(value) ? value.slice() : String(value || '').split(/\s+/).filter(Boolean);
                else return false;
                notify('prop', { key: name, value });
                return true;
            },
            remove() {
                notify('remove');
                return true;
            },
            toPlainObject() {
                return {
                    id: record.id,
                    title: record.title,
                    start: api.start,
                    end: api.end,
                    allDay: api.allDay,
                    backgroundColor: record.backgroundColor,
                    borderColor: record.borderColor,
                    textColor: record.textColor,
                    classNames: record.classNames.slice(),
                    extendedProps: { ...record.extendedProps },
                };
            },
            _record: record,
        };
        return api;
    }

    function createCalendarStore(options = {}) {
        const sourceEvents = new Map();
        const events = new Map();
        const sourceByEventId = new Map();
        let revision = 0;
        let requestSeq = 0;
        const sourceGenerations = new Map();
        const sourceAborts = new Map();
        let batchDepth = 0;
        let dirty = false;

        const emit = (reason = 'change') => {
            dirty = true;
            if (batchDepth > 0) return;
            dirty = false;
            revision += 1;
            try { options.onChange?.({ reason, revision, events: getEvents() }); } catch (e) {}
        };

        const rebuild = () => {
            events.clear();
            sourceByEventId.clear();
            sourceEvents.forEach((list, sourceId) => {
                list.forEach((event) => {
                    if (!event) return;
                    events.set(event.id, event);
                    sourceByEventId.set(event.id, sourceId);
                });
            });
        };

        const setSourceEvents = (sourceId, inputs) => {
            const id = String(sourceId || 'default').trim() || 'default';
            const list = (Array.isArray(inputs) ? inputs : [])
                .map((input) => createEventApi(input, id, {
                    onChange: (kind, event) => {
                        if (kind === 'remove') removeEvent(event.id);
                        else emit(`event-${kind}`);
                    },
                }))
                .filter(Boolean);
            sourceEvents.set(id, list);
            rebuild();
            emit(`source:${id}`);
            return list;
        };

        const getEvents = () => Array.from(events.values());
        const getEventById = (id) => events.get(String(id || '').trim()) || null;
        const addEvent = (input, sourceId = 'manual') => {
            const id = String(sourceId || 'manual').trim() || 'manual';
            const list = sourceEvents.get(id) || [];
            const event = createEventApi(input, id, {
                onChange: (kind, eventApi) => {
                    if (kind === 'remove') removeEvent(eventApi.id);
                    else emit(`event-${kind}`);
                },
            });
            if (!event) return null;
            list.push(event);
            sourceEvents.set(id, list);
            rebuild();
            emit(`add:${id}`);
            return event;
        };
        const removeEvent = (id) => {
            const eventId = String(id || '').trim();
            const sourceId = sourceByEventId.get(eventId);
            if (!sourceId) return false;
            const list = sourceEvents.get(sourceId) || [];
            const next = list.filter((item) => item.id !== eventId);
            sourceEvents.set(sourceId, next);
            rebuild();
            emit(`remove:${eventId}`);
            return next.length !== list.length;
        };
        const removeAll = () => {
            sourceEvents.clear();
            rebuild();
            emit('clear');
        };

        async function loadSources(sources, info, context = {}) {
            const seq = ++requestSeq;
            const list = Array.isArray(sources) ? sources : [];
            const requests = list.map((source) => {
                const sourceId = String(source?.id || 'default').trim() || 'default';
                const generation = (sourceGenerations.get(sourceId) || 0) + 1;
                sourceGenerations.set(sourceId, generation);
                const previousAbort = sourceAborts.get(sourceId);
                if (previousAbort) {
                    try { previousAbort.abort(); } catch (e) {}
                }
                const abort = typeof AbortController === 'function' ? new AbortController() : null;
                sourceAborts.set(sourceId, abort);
                return { source, sourceId, generation, signal: abort?.signal };
            });
            const results = await Promise.all(requests.map(async ({ source, sourceId, generation, signal }) => {
                try {
                    const value = await new Promise((resolve, reject) => {
                        let settled = false;
                        const success = (events) => { if (!settled) { settled = true; resolve(events); } };
                        const failure = (error) => { if (!settled) { settled = true; reject(error); } };
                        let result;
                        if (typeof source?.events === 'function') result = source.events({ ...info, signal, context }, success, failure);
                        else result = source?.events;
                        if (result && typeof result.then === 'function') result.then(success, failure);
                        else if (Array.isArray(result)) success(result);
                        else if (typeof source?.events !== 'function') success([]);
                    });
                    return { sourceId, generation, events: Array.isArray(value) ? value : [], error: null };
                } catch (error) {
                    return { sourceId, generation, events: [], error };
                }
            }));
            batchDepth += 1;
            let committedCount = 0;
            try {
                results.forEach((result) => {
                    if (sourceGenerations.get(result.sourceId) !== result.generation || result.error) return;
                    setSourceEvents(result.sourceId, result.events);
                    committedCount += 1;
                });
            } finally {
                batchDepth = Math.max(0, batchDepth - 1);
                if (dirty) {
                    dirty = false;
                    revision += 1;
                    try { options.onChange?.({ reason: 'range-loaded', revision, events: getEvents(), results }); } catch (e) {}
                }
            }
            const stale = committedCount === 0 && results.length > 0
                && results.every((result) => sourceGenerations.get(result.sourceId) !== result.generation);
            return { stale, revision, results, requestSeq: seq, committedCount };
        }

        function beginBatch() { batchDepth += 1; }
        function endBatch(reason = 'batch') {
            batchDepth = Math.max(0, batchDepth - 1);
            if (batchDepth === 0 && dirty) {
                dirty = false;
                revision += 1;
                try { options.onChange?.({ reason, revision, events: getEvents() }); } catch (e) {}
            }
        }

        return {
            get revision() { return revision; },
            get requestSeq() { return requestSeq; },
            getEvents,
            getEventById,
            setSourceEvents,
            addEvent,
            removeEvent,
            removeAll,
            loadSources,
            beginBatch,
            endBatch,
            abort() {
                sourceAborts.forEach((controller) => {
                    try { controller?.abort?.(); } catch (e) {}
                });
                sourceAborts.clear();
                sourceGenerations.forEach((generation, sourceId) => sourceGenerations.set(sourceId, generation + 1));
                requestSeq += 1;
            },
        };
    }

    global.__tmCalendarStore = Object.freeze({ createCalendarStore, normalizeEventInput, createEventApi });
})(typeof globalThis !== 'undefined' ? globalThis : window);
