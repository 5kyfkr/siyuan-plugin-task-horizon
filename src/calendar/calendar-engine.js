(function (global) {
    'use strict';

    const dateMath = global.__tmCalendarDate || {};
    const storeApi = global.__tmCalendarStore || {};
    const rendererApi = global.__tmCalendarRenderer || {};

    function createCalendarEngine(root, options = {}) {
        const viewTypeInitial = String(options.initialView || 'timeGridWeek').trim() || 'timeGridWeek';
        let viewType = viewTypeInitial;
        let currentDate = dateMath.toDate?.(options.initialDate) || new Date();
        let destroyed = false;
        let rendering = false;
        const optionState = { ...(options || {}) };
        const eventSources = Array.isArray(options.eventSources) ? options.eventSources.slice() : [];
        const normalizeSourceId = (source) => String(source?.id || 'default').trim() || 'default';
        const sourceMap = new Map(eventSources.map((source) => [normalizeSourceId(source), source]));
        let pointerCleanup = null;
        let view = null;
        let api = null;

        const renderer = rendererApi.createCalendarRenderer?.({
            render(model) {
                try { options.onRender?.(model); } catch (e) {}
            },
            onError(error) { try { options.onRenderError?.(error); } catch (e) {} },
        });
        const store = storeApi.createCalendarStore?.({
            onChange(detail) {
                if (destroyed) return;
                renderer?.invalidate?.(renderer?.buildViewModel?.(view, detail.events, { columns: view?.range?.days }) || { view, events: detail.events }, detail.reason);
                try { options.eventsSet?.(detail.events); } catch (e) {}
            },
        });

        function buildView() {
            const range = dateMath.getVisibleRange?.(viewType, currentDate, {
                firstDay: optionState.firstDay,
                views: optionState.views,
                fixedWeekCount: optionState.views?.dayGridMonth?.fixedWeekCount,
                monthScroll: optionState.monthScroll === true,
                monthScrollPast: optionState.monthScrollPast,
                monthScrollFuture: optionState.monthScrollFuture,
            }) || { start: currentDate, end: new Date(currentDate.getTime() + 86400000), days: 1 };
            // `currentStart`/`currentEnd` describe the logical month, while
            // `activeStart`/`activeEnd` include the leading and trailing days
            // needed to paint a complete calendar grid. Keep that contract in
            // every month view; otherwise mobile month rendering treats the
            // grid's first visible day as the selected month.
            const titleRange = viewType === 'dayGridMonth'
                ? {
                    start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
                    end: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
                }
                : range;
            const title = dateMath.formatViewTitle?.(viewType, titleRange, 'zh-CN') || '';
            view = {
                type: viewType,
                currentStart: new Date(titleRange.start.getTime()),
                currentEnd: new Date(titleRange.end.getTime()),
                activeStart: new Date(range.start.getTime()),
                activeEnd: new Date(range.end.getTime()),
                title,
                range,
            };
            return view;
        }

        function sourceInfo() {
            const range = view?.range || buildView().range;
            return {
                start: new Date(range.start.getTime()),
                end: new Date(range.end.getTime()),
                startStr: dateMath.formatDateKey?.(range.start) || '',
                endStr: dateMath.formatDateKey?.(range.end) || '',
                view,
            };
        }

        let lastCommittedRangeKey = '';
        let rangeLoadSeq = 0;

        async function load() {
            if (destroyed || !store) return;
            const loadSeq = ++rangeLoadSeq;
            const info = sourceInfo();
            try { options.loading?.(true); } catch (e) {}
            try {
                const result = await store.loadSources(eventSources, info, { calendar: api });
                if (destroyed || loadSeq !== rangeLoadSeq) return;
                if (!result?.stale) {
                    lastCommittedRangeKey = `${dateMath.formatDateKey?.(info.start) || ''}|${dateMath.formatDateKey?.(info.end) || ''}`;
                    try { options.datesSet?.(info); } catch (e) {}
                }
            } catch (e) {
                // Source callbacks normally convert failures into per-source
                // results. Keep the engine promise contained if the store
                // itself fails so a void load() cannot create an unhandled
                // rejection or leave the loading lifecycle open.
            } finally {
                if (!destroyed && loadSeq === rangeLoadSeq) {
                    try { options.loading?.(false); } catch (e) {}
                }
            }
        }

        async function loadSource(sourceId) {
            if (destroyed || !store) return;
            const source = sourceMap.get(sourceId);
            if (!source) return;
            const result = await store.loadSources([source], sourceInfo(), { calendar: api, sourceRefetch: true });
            if (destroyed) return;
            if (result?.stale) return;
        }

        function setDate(value) {
            const date = dateMath.toDate?.(value);
            if (!date) return false;
            currentDate = date;
            const previousKey = view
                ? `${dateMath.formatDateKey?.(view.activeStart) || ''}|${dateMath.formatDateKey?.(view.activeEnd) || ''}`
                : '';
            buildView();
            const nextKey = `${dateMath.formatDateKey?.(view.activeStart) || ''}|${dateMath.formatDateKey?.(view.activeEnd) || ''}`;
            if (previousKey && previousKey === nextKey && nextKey === lastCommittedRangeKey) {
                // Same resolved window AND its events are committed: skip the
                // source refetch and only republish lifecycle state. The
                // virtual month strip relies on this to follow the browsed
                // month without refetching on every month boundary crossing.
                try { options.datesSet?.(sourceInfo()); } catch (e) {}
                return true;
            }
            void load();
            return true;
        }

        function shiftMonth(amount) {
            const next = new Date(currentDate.getTime());
            next.setMonth(next.getMonth() + Number(amount || 0), 1);
            return setDate(next);
        }

        function snapshotEvent(event) {
            if (!event) return null;
            return {
                id: event.id,
                title: event.title,
                start: event.start instanceof Date ? new Date(event.start.getTime()) : dateMath.toDate?.(event.start),
                end: event.end instanceof Date ? new Date(event.end.getTime()) : dateMath.toDate?.(event.end),
                allDay: event.allDay === true,
                extendedProps: { ...(event.extendedProps || {}) },
                source: event.source,
            };
        }

        function invokeAsync(callback, payload) {
            if (typeof callback !== 'function') return;
            try {
                const result = callback(payload);
                if (result && typeof result.then === 'function') result.catch(() => {});
            } catch (e) {}
        }

        function updateEventDates(id, nextStart, nextEnd, meta = {}, kind = 'drop') {
            const event = store?.getEventById?.(id);
            if (!event || event.editable === false) return false;
            const start = dateMath.toDate?.(nextStart);
            const end = dateMath.toDate?.(nextEnd);
            if (!start || !end || end.getTime() <= start.getTime()) return false;
            const oldEvent = snapshotEvent(event);
            const jsEvent = meta?.jsEvent || null;
            const el = meta?.el || null;
            const lifecycle = kind === 'resize' ? 'eventResize' : 'eventDrop';
            try {
                if (kind === 'resize') options.eventResizeStart?.({ event, jsEvent, el, view });
                else options.eventDragStart?.({ event, jsEvent, el, view });
            } catch (e) {}
            const hasAllDayOverride = !!meta && Object.prototype.hasOwnProperty.call(meta, 'allDay');
            event.setDates(start, end, { allDay: hasAllDayOverride ? meta.allDay === true : event.allDay });
            const payload = {
                event,
                oldEvent,
                view,
                jsEvent,
                el,
                delta: meta?.delta || null,
                revert() {
                    try { event.setDates(oldEvent.start, oldEvent.end, { allDay: oldEvent.allDay }); } catch (e) {}
                },
            };
            invokeAsync(options[lifecycle], payload);
            try {
                if (kind === 'resize') options.eventResizeStop?.(payload);
                else options.eventDragStop?.(payload);
            } catch (e) {}
            return true;
        }

        api = {
            get view() { return view; },
            render() {
                if (destroyed || rendering) return api;
                rendering = true;
                buildView();
                try { options.viewDidMount?.({ view }); } catch (e) {}
                rendering = false;
                void load();
                return api;
            },
            destroy() {
                if (destroyed) return;
                destroyed = true;
                store?.abort?.();
                renderer?.destroy?.();
                pointerCleanup?.();
                try { options.viewWillUnmount?.({ view }); } catch (e) {}
                try { root?.removeAttribute?.('data-tm-calendar-engine'); } catch (e) {}
            },
            getDate() { return new Date(currentDate.getTime()); },
            getEvents() { return store?.getEvents?.() || []; },
            getEventById(id) { return store?.getEventById?.(id) || null; },
            dispatchEventClick(id, jsEvent = null, el = null) {
                const event = store?.getEventById?.(id);
                if (!event) return false;
                invokeAsync(options.eventClick, { event, jsEvent, el, view });
                return true;
            },
            dispatchEventContextMenu(id, jsEvent = null, el = null) {
                const event = store?.getEventById?.(id);
                if (!event) return false;
                const payload = { event, jsEvent, el, view };
                if (typeof options.eventContextMenu === 'function') invokeAsync(options.eventContextMenu, payload);
                else if (typeof options.contextmenu === 'function') invokeAsync(options.contextmenu, payload);
                return true;
            },
            dispatchEventDrop(id, nextStart, nextEnd, meta = {}) {
                return updateEventDates(id, nextStart, nextEnd, meta, 'drop');
            },
            dispatchEventResize(id, nextStart, nextEnd, meta = {}) {
                return updateEventDates(id, nextStart, nextEnd, meta, 'resize');
            },
            dispatchDateClick(date, allDay = false, jsEvent = null, el = null) {
                const value = dateMath.toDate?.(date);
                if (!value) return false;
                invokeAsync(options.dateClick, { date: value, dateStr: dateMath.formatDateKey?.(value) || '', allDay: allDay === true, jsEvent, el, view });
                return true;
            },
            dispatchSelect(start, end, allDay = false, jsEvent = null, el = null) {
                const a = dateMath.toDate?.(start);
                const b = dateMath.toDate?.(end);
                if (!a || !b || b.getTime() <= a.getTime()) return false;
                invokeAsync(options.select, { start: a, end: b, startStr: a.toISOString(), endStr: b.toISOString(), allDay: allDay === true, jsEvent, el, view });
                return true;
            },
            getEventSourceById(id) {
                const sourceId = String(id || '').trim();
                if (!sourceId || !sourceMap.has(sourceId)) return null;
                return {
                    id: sourceId,
                    refetch: () => { void loadSource(sourceId); return true; },
                    remove: () => { sourceMap.delete(sourceId); return true; },
                };
            },
            getOption(name) { return optionState[String(name || '').trim()]; },
            setOption(name, value) {
                const key = String(name || '').trim();
                if (!key) return false;
                optionState[key] = value;
                if (key === 'firstDay' || key === 'views') {
                    buildView();
                    void load();
                } else {
                    renderer?.invalidate?.(renderer?.buildViewModel?.(view, api.getEvents(), { columns: view?.range?.days }) || { view, events: api.getEvents() }, `option:${key}`);
                }
                return true;
            },
            changeView(nextView, dateValue) {
                const next = String(nextView || '').trim();
                if (!next) return false;
                try {
                    viewType = next;
                    if (dateValue !== undefined) currentDate = dateMath.toDate?.(dateValue) || currentDate;
                    buildView();
                    void load();
                    return true;
                } catch (e) {}
                return false;
            },
            gotoDate(value) { return setDate(value); },
            prev() {
                if (viewType === 'dayGridMonth' || viewType === 'listMonth') {
                    return shiftMonth(-1);
                }
                const step = (viewType === 'timeGridWeek' || viewType === 'timeGridWorkdays') ? -7 : -(view?.range?.days || 1);
                const target = dateMath.addDays?.(currentDate, step);
                return setDate(target);
            },
            next() {
                if (viewType === 'dayGridMonth' || viewType === 'listMonth') {
                    return shiftMonth(1);
                }
                const step = (viewType === 'timeGridWeek' || viewType === 'timeGridWorkdays') ? 7 : (view?.range?.days || 1);
                const target = dateMath.addDays?.(currentDate, step);
                return setDate(target);
            },
            refetchEvents() { void load(); return true; },
            rerenderEvents() {
                renderer?.invalidate?.(renderer?.buildViewModel?.(view, api.getEvents(), { columns: view?.range?.days }) || { view, events: api.getEvents() }, 'rerender');
                return true;
            },
            updateSize() { return true; },
            batchRendering(callback) {
                if (typeof callback !== 'function') return false;
                try { store?.beginBatch?.(); callback(); } finally { store?.endBatch?.('batch'); }
                return true;
            },
            unselect() { return true; },
            addEvent(input, source) { return store?.addEvent?.(input, source?.id || source || 'manual') || null; },
            addEventSource(source) {
                if (!source) return false;
                const id = String(source.id || `source-${sourceMap.size + 1}`).trim();
                sourceMap.set(id, { ...source, id });
                eventSources.push({ ...source, id });
                void load();
                return true;
            },
            removeAllEventSources() { store?.removeAll?.(); return true; },
            setEvents(events) { store?.setSourceEvents?.('manual', events); return true; },
        };

        if (typeof Element !== 'undefined' && root instanceof Element) {
            try { root.setAttribute('data-tm-calendar-engine', '1'); } catch (e) {}
            const hasPointerLifecycle = typeof options.pointerDragStart === 'function'
                || typeof options.pointerDragMove === 'function'
                || typeof options.pointerDragEnd === 'function';
            if (hasPointerLifecycle) {
                pointerCleanup = global.__tmCalendarInteraction?.bindCalendarPointerInteractions?.(root, {
                    longPressMs: optionState.longPressDelay || 500,
                    onStart: options.pointerDragStart,
                    onMove: options.pointerDragMove,
                    onEnd: options.pointerDragEnd,
                }) || null;
            }
        }
        buildView();
        return api;
    }

    global.__tmCalendarEngine = Object.freeze({ createCalendarEngine });
})(typeof globalThis !== 'undefined' ? globalThis : window);
