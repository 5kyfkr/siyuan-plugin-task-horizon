    function __tmBuildRenderSceneContext(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const bodyAnimClass = String(opts.bodyAnimClass || '');
        const tableAvailableWidth = Number.isFinite(Number(opts.tableAvailableWidth))
            ? Number(opts.tableAvailableWidth)
            : (Number(state.tableAvailableWidth) || 0);
        const isMobile = !!opts.isMobile;
        const isDockHost = !!opts.isDockHost;
        const isRuntimeMobile = !!opts.isRuntimeMobile;
        const isLandscape = !!opts.isLandscape;
        const isDesktopNarrow = !!opts.isDesktopNarrow;
        const __tmMountEl = opts.mountEl instanceof Element ? opts.mountEl : (opts.mountEl || null);


        const __tmRenderListBodyHtml = () => __tmBuildRenderSceneListBodyHtml({
            bodyAnimClass,
            tableAvailableWidth,
        });

        const __tmGetBodyAnimClassForRender = (renderOptions) => {
            const renderOpts = (renderOptions && typeof renderOptions === 'object') ? renderOptions : {};
            return renderOpts.withBodyAnimation ? bodyAnimClass : '';
        };

        function __tmRenderChecklistBodyHtml(renderOptions = {}) {
            return __tmBuildRenderSceneChecklistBodyHtml({
                bodyAnimClass: __tmGetBodyAnimClassForRender(renderOptions),
            });
        }

        const __tmRenderTimelineBodyHtml = (rowModel) => __tmBuildRenderSceneTimelineBodyHtml({
            bodyAnimClass,
            rowModel,
            isMobile,
            isDockHost,
        });

        const __tmRenderKanbanBodyHtml = (renderOptions = {}) => __tmBuildRenderSceneKanbanBodyHtml({
            bodyAnimClass: __tmGetBodyAnimClassForRender(renderOptions),
        });

        const __tmRenderCalendarBodyHtml = () => __tmBuildRenderSceneCalendarBodyHtml({
            bodyAnimClass,
        });

        const __tmRenderWhiteboardBodyHtml = (renderOptions = {}) => __tmBuildRenderSceneWhiteboardBodyHtml({
            bodyAnimClass: __tmGetBodyAnimClassForRender(renderOptions),
            isMobile,
            isDockHost,
        });

        state.renderChecklistBodyHtml = __tmRenderChecklistBodyHtml;
        state.renderKanbanBodyHtml = __tmRenderKanbanBodyHtml;
        state.renderWhiteboardBodyHtml = __tmRenderWhiteboardBodyHtml;

        const renderMode = state.attachmentLibraryOpen ? 'attachments' : (state.homepageOpen ? 'home' : String(state.viewMode || '').trim());
        const homepageBodyAnimClass = renderMode === 'home' ? '' : bodyAnimClass;
        const __tmTimelineFullRowModel = renderMode === 'timeline' ? __tmBuildTaskRowModel() : null;
        const __tmTimelineProgressive = renderMode === 'timeline'
            && state.__tmProgressiveViewRender?.mode === 'timeline'
            && state.__tmProgressiveViewRender?.tasksRef === state.filteredTasks;
        const __tmTimelineRowModel = __tmTimelineProgressive
            ? __tmSliceTaskRowModelByTaskWindow(
                __tmTimelineFullRowModel,
                0,
                Math.max(20, Number(state.listRenderLimit) || 20)
            ).rows
            : __tmTimelineFullRowModel;
        if (renderMode === 'timeline') {
            try { state.__tmTimelineFullRowModel = __tmTimelineFullRowModel; } catch (e) {}
            try { globalThis.__tmTimelineRowModel = __tmTimelineFullRowModel; } catch (e) {}
        }
        const mainBodyHtml = renderMode === 'attachments'
            ? __tmRenderAttachmentLibraryBodyHtml({ bodyAnimClass })
            : renderMode === 'home'
            ? `<div class="tm-body tm-body--homepage${homepageBodyAnimClass}" style="display:flex;flex-direction:column;min-height:0;"><div id="tmHomepageRoot" style="flex:1;min-height:0;"></div></div>`
            : renderMode === 'calendar'
            ? __tmRenderCalendarBodyHtml()
            : renderMode === 'whiteboard'
                ? __tmRenderWhiteboardBodyHtml({ withBodyAnimation: true })
            : renderMode === 'checklist'
                ? __tmRenderChecklistBodyHtml({ withBodyAnimation: true })
            : renderMode === 'timeline'
                ? __tmRenderTimelineBodyHtml(__tmTimelineRowModel)
                : renderMode === 'kanban'
                    ? __tmRenderKanbanBodyHtml({ withBodyAnimation: true })
                    : __tmRenderListBodyHtml();
        const showCalendarSideDock = !state.homepageOpen && !state.attachmentLibraryOpen && __tmShouldShowCalendarSideDock() && !isMobile;
        const showAiSideDock = !state.attachmentLibraryOpen && __tmShouldShowAiSidebar() && !!state.aiSidebarOpen && !isMobile && !isDockHost;
        const calendarSideDockWidth = Math.max(260, Math.min(760, Math.round(Number(SettingsStore.data.calendarSideDockWidth) || 340)));
        const aiSideDockWidth = Math.max(320, Math.min(720, Math.round(Number(state.aiSidebarWidth) || 380)));
        const showTaskDetailSheet = renderMode !== 'checklist' && !!globalThis.__tmViewPolicy?.shouldUseTaskDetailSheetMode?.(renderMode, state.modal);
        const taskDetailSheetTaskId = String(state.detailTaskId || '').trim();
        const taskDetailSheetTask = showTaskDetailSheet && taskDetailSheetTaskId
            ? (
                (typeof __tmGetTaskDetailTaskById === 'function'
                    ? __tmGetTaskDetailTaskById(taskDetailSheetTaskId, { includePending: true, preferPending: true, includeWhiteboard: true })
                    : null)
                || globalThis.__tmRuntimeState?.getTaskById?.(taskDetailSheetTaskId, { includePending: true, preferPending: true })
                || state.flatTasks?.[taskDetailSheetTaskId]
                || state.pendingInsertedTasks?.[taskDetailSheetTaskId]
                || null
            )
            : null;
        const taskDetailSheetInnerHtml = taskDetailSheetTask
            ? (typeof __tmShouldRenderTaskDetailNoteView === 'function' && __tmShouldRenderTaskDetailNoteView('sheet', taskDetailSheetTask)
                ? __tmBuildTaskDetailNoteViewInnerHtml(taskDetailSheetTask, { embedded: true, closeable: true })
                : __tmBuildTaskDetailInnerHtml(taskDetailSheetTask, { embedded: true, closeable: true }))
            : `<div class="tm-checklist-empty-detail">选择任务后，这里会显示可编辑的详情。</div>`;
        const showMobileBottomViewBar = isDockHost
            ? (!isRuntimeMobile || !isLandscape)
            : !!(isMobile && !isLandscape);
        const mobileBottomViewbarActive = showMobileBottomViewBar && (Date.now() < (Number(state.mobileBottomViewbarActiveUntil) || 0));
        const mobileBottomViewbarSwitching = showMobileBottomViewBar && (Date.now() < (Number(state.mobileBottomViewbarSwitchingUntil) || 0));
        const useCompactTopbar = !isMobile || isDockHost;
        const topbarPadding = useCompactTopbar ? '5px 10px' : '10px 10px';
        const topbarHeightStyle = useCompactTopbar ? 'min-height:42px;max-height:42px;height:42px;' : '';
        const whiteboardActiveDocId = String(state.activeDocId || 'all').trim() || 'all';
        const showWhiteboardAllTabsModeToggle = renderMode === 'whiteboard' && whiteboardActiveDocId === 'all';
        const whiteboardAllTabsLayoutMode = __tmGetWhiteboardAllTabsLayoutMode();
        const showWhiteboardMobileLayoutModeToggle = renderMode === 'whiteboard';
        const whiteboardMobileMenuLayoutMode = showWhiteboardAllTabsModeToggle ? whiteboardAllTabsLayoutMode : 'board';
        const showInlineDocGroupQuickSelect = isMobile || isDockHost;
        const showAdaptiveTabDocGroupQuickSelect = !!(__tmMountEl && !isMobile && !isDockHost);
        const showMobileTimelineFloatingToolbar = !!(isMobile && !isDockHost && !isLandscape && renderMode === 'timeline');
        const showDockTimelineFloatingToolbar = !!(isDockHost && renderMode === 'timeline');
        const showDesktopTimelineFloatingToolbar = !!(!isMobile && !isDockHost && renderMode === 'timeline');
        const showTimelineFloatingToolbar = !!(showMobileTimelineFloatingToolbar || showDockTimelineFloatingToolbar || showDesktopTimelineFloatingToolbar);
        const showMobileLandscapeTimelineTopbar = !!(isMobile && !isDockHost && isLandscape && renderMode === 'timeline');
        const showDesktopNarrowTimelineTopbar = !!(!isMobile && !isDockHost && isDesktopNarrow && renderMode === 'timeline');
        const showTopbarTimelineToolbar = !!(!isMobile && !isDockHost && renderMode === 'timeline');
        const topbarAddBtnHtml = `<button class="tm-btn tm-btn-info tm-topbar-add-btn bc-btn bc-btn--sm" onclick="tmAdd()" aria-label="新建任务" data-tm-floating-tooltip-label="新建任务" data-tm-tooltip-side="bottom" data-tm-tooltip-align="center" style="padding: 0; width: 30px; height: 30px; min-width: 30px; min-height: 30px; display: inline-flex; align-items: center; justify-content: center;">${__tmRenderLucideIcon('plus')}</button>`;
        const timelineScaleState = globalThis.__TaskHorizonGanttView?.resolveScaleState?.(state.ganttView) || {
            scale: ['day', 'week', 'month'].includes(String(state.ganttView?.scale || '')) ? String(state.ganttView.scale) : 'day',
            label: '日',
            canZoomOut: true,
            canZoomIn: true,
        };
        const timelineScale = timelineScaleState.scale;
        const useMobileTimelineSidebar = isMobile && !isDockHost;
        const timelineSidebarCollapsed = useMobileTimelineSidebar
            ? state.timelineMobileSidebarExpanded !== true
            : !!SettingsStore.data.timelineSidebarCollapsed;
        const timelineSidebarToggleLabel = timelineSidebarCollapsed ? '展开时间轴侧栏' : '隐藏时间轴侧栏';
        const __tmRenderTimelineToolbarIcon = (iconName, size = 14) => `<span class="tm-timeline-toolbar-icon">${__tmPhosphorBoldSvg(iconName, { size, className: 'tm-timeline-toolbar-icon__svg' })}</span>`;
        const __tmRenderTimelineSidebarToggleButton = ({ buttonClass = '', buttonStyle = '', interactionAttrs = '', clickPrefix = '' } = {}) => {
            const buttonClassName = ['tm-btn', 'tm-btn-info', 'tm-timeline-toolbar-btn', 'bc-btn', 'bc-btn--sm', String(buttonClass || '').trim()].filter(Boolean).join(' ');
            const styleAttr = buttonStyle ? ` style="${__tmEscAttr(buttonStyle)}"` : '';
            return `<button type="button" class="${buttonClassName}" onclick="${String(clickPrefix || '')}tmTimelineToggleSidebar(event)"${styleAttr}${String(interactionAttrs || '')}${__tmBuildTooltipAttrs(timelineSidebarToggleLabel, { side: 'bottom' })}>${__tmRenderTimelineToolbarIcon('sidebar')}</button>`;
        };
        const timelineSidebarToggleButtonHtml = renderMode === 'timeline'
            ? __tmRenderTimelineSidebarToggleButton({ buttonStyle: 'padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;' })
            : '';
        const __tmRenderTimelineScaleSegments = () => `<div class="tm-view-segmented bc-tabs-list" role="tablist" aria-label="时间轴尺度">${[
            ['day', '日'],
            ['week', '周'],
            ['month', '月'],
        ].map(([value, label]) => {
            const active = timelineScale === value;
            return `<button type="button" class="tm-view-seg-item bc-tabs-trigger ${active ? 'tm-view-seg-item--active' : ''}" data-state="${active ? 'active' : 'inactive'}" data-tm-timeline-scale="${value}" role="tab" aria-selected="${active ? 'true' : 'false'}" onclick="tmGanttSetScale('${value}', event)">${label}</button>`;
        }).join('')}</div>`;
        const __tmRenderTimelineScaleMenu = ({ interactionAttrs = '' } = {}) => `<details class="tm-timeline-scale-menu">
            <summary class="tm-timeline-scale-menu__trigger" aria-label="时间轴尺度：${timelineScaleState.label || '日'}"${String(interactionAttrs || '')}>${__tmRenderTimelineToolbarIcon('ruler')}<span class="tm-timeline-scale-menu__label">${timelineScaleState.label || '日'}</span>${__tmRenderTimelineToolbarIcon('caret-down', 11)}</summary>
            <div class="tm-timeline-scale-menu__popover" role="menu" aria-label="选择时间轴尺度">${[
                ['day', '日'],
                ['week', '周'],
                ['month', '月'],
            ].map(([value, label]) => `<button type="button" role="menuitemradio" aria-checked="${timelineScale === value ? 'true' : 'false'}" data-tm-timeline-scale="${value}" class="tm-timeline-scale-menu__option${timelineScale === value ? ' is-active' : ''}" onclick="tmGanttSetScale('${value}', event)">${label}</button>`).join('')}</div>
        </details>`;
        const __tmRenderTimelineToolbarButtons = ({ buttonClass = '', buttonStyle = '', interactionAttrs = '', clickPrefix = '' } = {}) => {
            const buttonClassName = ['tm-btn', 'tm-btn-info', 'tm-timeline-toolbar-btn', 'bc-btn', 'bc-btn--sm', String(buttonClass || '').trim()].filter(Boolean).join(' ');
            const styleAttr = buttonStyle ? ` style="${__tmEscAttr(buttonStyle)}"` : '';
            const extraAttrs = String(interactionAttrs || '');
            const clickStart = String(clickPrefix || '');
            return `
                <button type="button" class="${buttonClassName}" data-tm-timeline-zoom="out" onclick="${clickStart}tmGanttZoomOut()"${timelineScaleState.canZoomOut ? '' : ' disabled'}${styleAttr}${extraAttrs}${__tmBuildTooltipAttrs('缩小', { side: 'bottom' })}>${__tmRenderTimelineToolbarIcon('minus')}</button>
                <button type="button" class="${buttonClassName}" data-tm-timeline-zoom="in" onclick="${clickStart}tmGanttZoomIn()"${timelineScaleState.canZoomIn ? '' : ' disabled'}${styleAttr}${extraAttrs}${__tmBuildTooltipAttrs('放大', { side: 'bottom' })}>${__tmRenderTimelineToolbarIcon('plus')}</button>
                <button type="button" class="${buttonClassName}" onclick="${clickStart}tmGanttFit()"${styleAttr}${extraAttrs}${__tmBuildTooltipAttrs('适配范围', { side: 'bottom' })}>${__tmRenderTimelineToolbarIcon('corners-out')}</button>
                <button type="button" class="${buttonClassName}" onclick="${clickStart}tmGanttToday()"${styleAttr}${extraAttrs}${__tmBuildTooltipAttrs('定位今天', { side: 'bottom' })}>${__tmRenderTimelineToolbarIcon('calendar-blank')}</button>
            `;
        };
        const __tmRenderTimelineToolbarGroup = ({ includeSidebarToggle = false, buttonClass = '', buttonStyle = '', interactionAttrs = '', clickPrefix = '' } = {}) => {
            const inner = `${includeSidebarToggle ? timelineSidebarToggleButtonHtml : ''}${__tmRenderTimelineScaleSegments()}`;
            return inner ? `<div class="tm-timeline-toolbar-group">${inner}</div>` : '';
        };
        const timelineInlineToolbarButtonsHtml = __tmRenderTimelineToolbarButtons({
            buttonStyle: 'padding: 0 8px; height: 30px; display: inline-flex; align-items: center; justify-content: center;'
        });
        const timelineCompactToolbarButtonsHtml = `${__tmRenderTimelineScaleMenu()}${__tmRenderTimelineToolbarButtons({
            buttonStyle: 'padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;'
        })}`;
        const timelineInlineToolbarGroupHtml = __tmRenderTimelineToolbarGroup({
            includeSidebarToggle: true,
            buttonStyle: 'padding: 0 8px; height: 30px; display: inline-flex; align-items: center; justify-content: center;'
        });
        const timelineCompactToolbarGroupHtml = __tmRenderTimelineToolbarGroup({
            includeSidebarToggle: true,
            buttonStyle: 'padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;'
        });
        const showFloatingTimelineSidebarToggle = !!(isMobile && !showMobileLandscapeTimelineTopbar);
        const timelineFloatingTouchAttrs = isMobile ? ' onpointerdown="tmTouchTimelineMobileToolbarButton(event)"' : '';
        const timelineFloatingClickPrefix = isMobile ? 'tmTouchTimelineMobileToolbarButton(event);' : '';
        const timelineFloatingToolbarHtml = showTimelineFloatingToolbar
            ? `<div class="tm-timeline-floating-toolbar${showDesktopTimelineFloatingToolbar ? ' tm-timeline-floating-toolbar--desktop' : ''}"><div class="tm-timeline-floating-toolbar__inner">${showFloatingTimelineSidebarToggle ? __tmRenderTimelineSidebarToggleButton({
                buttonClass: 'tm-timeline-floating-toolbar__btn',
                interactionAttrs: timelineFloatingTouchAttrs,
                clickPrefix: timelineFloatingClickPrefix
            }) : ''}${showDesktopTimelineFloatingToolbar ? '' : __tmRenderTimelineScaleMenu({
                interactionAttrs: timelineFloatingTouchAttrs
            })}${__tmRenderTimelineToolbarButtons({
                buttonClass: 'tm-timeline-floating-toolbar__btn',
                interactionAttrs: timelineFloatingTouchAttrs,
                clickPrefix: timelineFloatingClickPrefix
            })}</div></div>`
            : '';
        const mainStageBottomInset = showMobileBottomViewBar
            ? 'calc(var(--tm-mobile-bottom-viewbar-offset, env(safe-area-inset-bottom, 0px)) + 52px)'
            : '0px';
        const bodyWithSideDockHtml = (showCalendarSideDock || showAiSideDock)
            ? `
                <div class="tm-main-body-with-cal-dock">
                    ${mainBodyHtml}
                    ${showAiSideDock ? `
                        <div class="tm-ai-side-dock-resizer" onmousedown="tmStartAiSideDockResize(event)" title="拖拽调整 AI 侧栏宽度"></div>
                        <aside class="tm-ai-side-dock" style="width:${aiSideDockWidth}px;min-width:${aiSideDockWidth}px;">
                            <div id="tmAiSidebarPanel" style="height:100%;min-height:0;"></div>
                        </aside>
                    ` : ''}
                    ${showCalendarSideDock ? `
                        <div class="tm-calendar-side-dock-resizer" onmousedown="tmStartCalendarSideDockResize(event)" title="拖拽调整侧栏宽度"></div>
                        <aside class="tm-calendar-side-dock" style="width:${calendarSideDockWidth}px;min-width:${calendarSideDockWidth}px;">
                            <div id="tmCalendarSideDockPanel"></div>
                        </aside>
                    ` : ''}
                </div>
            `
            : mainBodyHtml;
        const multiSelectCount = __tmGetMultiSelectedTaskIds().length;
        const showMultiSelectBar = __tmIsMultiSelectActive() && __tmIsMultiSelectSupportedView();
        const multiSelectBarBottom = showTimelineFloatingToolbar
            ? (showDesktopTimelineFloatingToolbar
                ? '72px'
                : 'calc(var(--tm-mobile-bottom-viewbar-offset, env(safe-area-inset-bottom, 0px)) + 108px)')
            : (showMobileBottomViewBar
                ? 'calc(var(--tm-mobile-bottom-viewbar-offset, env(safe-area-inset-bottom, 0px)) + 52px)'
                : '14px');
        const multiSelectActionDisabledAttr = multiSelectCount > 0 ? '' : ' disabled';
        const multiSelectBarHtml = showMultiSelectBar
            ? `
                <div class="tm-multi-bulkbar" style="bottom:${multiSelectBarBottom};">
                    <div class="tm-multi-bulkbar__inner">
                        <div class="tm-multi-bulkbar__summary">
                            <span class="tm-multi-bulkbar__count" data-tm-multi-count title="已选任务数">${multiSelectCount}</span>
                        </div>
                        <div class="tm-multi-bulkbar__actions">
                            <button class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-multi-bulkbar__btn tm-multi-bulkbar__btn--icon" type="button" data-tm-multi-action="1" onclick="tmMultiSelectSendToAi()"${multiSelectActionDisabledAttr}${__tmBuildTooltipAttrs('发送到 AI', { side: 'top' })}><span class="tm-multi-bulkbar__icon">${__tmPhosphorBoldSvg('sparkle', { size: 14, className: 'tm-multi-bulkbar__icon-svg' })}</span></button>
                            <button class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-multi-bulkbar__btn tm-multi-bulkbar__btn--icon" type="button" data-tm-multi-action="1" onclick="tmMultiSelectBatchSetStartDate()"${multiSelectActionDisabledAttr}${__tmBuildTooltipAttrs('批量设置开始日期', { side: 'top' })}><span class="tm-multi-bulkbar__icon">${__tmPhosphorBoldSvg('calendar-plus-2', { size: 14, className: 'tm-multi-bulkbar__icon-svg' })}</span></button>
                            <button class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-multi-bulkbar__btn tm-multi-bulkbar__btn--icon" type="button" data-tm-multi-action="1" onclick="tmMultiSelectBatchSetCompletionDate()"${multiSelectActionDisabledAttr}${__tmBuildTooltipAttrs('批量设置截止日期', { side: 'top' })}><span class="tm-multi-bulkbar__icon">${__tmPhosphorBoldSvg('calendar-check', { size: 14, className: 'tm-multi-bulkbar__icon-svg' })}</span></button>
                            <button class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-multi-bulkbar__btn tm-multi-bulkbar__btn--icon" type="button" data-tm-multi-action="1" onclick="tmMultiSelectBatchSetPriority()"${multiSelectActionDisabledAttr}${__tmBuildTooltipAttrs('批量设置重要性', { side: 'top' })}><span class="tm-multi-bulkbar__icon">${__tmPhosphorBoldSvg('flag', { size: 14, className: 'tm-multi-bulkbar__icon-svg' })}</span></button>
                            <button class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-multi-bulkbar__btn tm-multi-bulkbar__btn--icon" type="button" data-tm-multi-action="1" onclick="tmMultiSelectBatchSetStatus()"${multiSelectActionDisabledAttr}${__tmBuildTooltipAttrs('批量设置状态', { side: 'top' })}><span class="tm-multi-bulkbar__icon">${__tmPhosphorBoldSvg('circle-dot', { size: 14, className: 'tm-multi-bulkbar__icon-svg' })}</span></button>
                            <button class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-multi-bulkbar__btn tm-multi-bulkbar__btn--icon" type="button" data-tm-multi-action="1" data-tm-multi-more-btn="1" onclick="tmMultiSelectToggleMoreMenu(event)"${multiSelectActionDisabledAttr}${__tmBuildTooltipAttrs('更多批量操作', { side: 'top' })}><span class="tm-multi-bulkbar__icon">${__tmPhosphorBoldSvg('dots-three', { size: 14, className: 'tm-multi-bulkbar__icon-svg' })}</span></button>
                            <button class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-multi-bulkbar__btn tm-multi-bulkbar__btn--wide" type="button" data-tm-multi-action="1" onclick="tmMultiSelectClear()"${multiSelectActionDisabledAttr}><span class="tm-multi-bulkbar__icon">${__tmPhosphorBoldSvg('x-circle', { size: 14, className: 'tm-multi-bulkbar__icon-svg' })}</span><span>清空</span></button>
                            <button class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-multi-bulkbar__btn tm-multi-bulkbar__btn--wide" type="button" onclick="tmMultiSelectExit()"><span class="tm-multi-bulkbar__icon">${__tmPhosphorBoldSvg('x', { size: 14, className: 'tm-multi-bulkbar__icon-svg' })}</span><span>退出</span></button>
                        </div>
                    </div>
                </div>
            `
            : '';
        const taskDetailSheetHtml = showTaskDetailSheet
            ? `<div id="tmTaskDetailSheetBackdrop" class="tm-checklist-sheet-backdrop ${state.checklistDetailSheetOpen && taskDetailSheetTask ? 'tm-checklist-sheet-backdrop--open' : ''}" onclick="tmTaskDetailSheetClose(event)"></div>
                <div id="tmTaskDetailSheet" class="tm-checklist-sheet ${state.checklistDetailSheetOpen && taskDetailSheetTask ? 'tm-checklist-sheet--open' : ''}${state.checklistDetailSheetOpen && taskDetailSheetTask && state.checklistDetailSheetFullscreen ? ' tm-checklist-sheet--fullscreen' : ''}" onpointerdown="tmTaskDetailSheetDragStart(event)">
                    <div class="tm-checklist-sheet-handle"></div>
                    <div class="tm-checklist-sheet-body" id="tmTaskDetailSheetPanel">${taskDetailSheetInnerHtml}</div>
                </div>`
            : '';


        return {
            renderMode,
            mainBodyHtml,
            showCalendarSideDock,
            showAiSideDock,
            calendarSideDockWidth,
            aiSideDockWidth,
            showTaskDetailSheet,
            taskDetailSheetTaskId,
            taskDetailSheetTask,
            taskDetailSheetHtml,
            showMobileBottomViewBar,
            mobileBottomViewbarActive,
            mobileBottomViewbarSwitching,
            useCompactTopbar,
            topbarPadding,
            topbarHeightStyle,
            whiteboardActiveDocId,
            showWhiteboardAllTabsModeToggle,
            whiteboardAllTabsLayoutMode,
            showWhiteboardMobileLayoutModeToggle,
            whiteboardMobileMenuLayoutMode,
            showInlineDocGroupQuickSelect,
            showAdaptiveTabDocGroupQuickSelect,
            showMobileTimelineFloatingToolbar,
            showDockTimelineFloatingToolbar,
            showDesktopTimelineFloatingToolbar,
            showTimelineFloatingToolbar,
            showMobileLandscapeTimelineTopbar,
            showDesktopNarrowTimelineTopbar,
            showTopbarTimelineToolbar,
            topbarAddBtnHtml,
            timelineSidebarToggleLabel,
            timelineSidebarToggleButtonHtml,
            timelineInlineToolbarButtonsHtml,
            timelineCompactToolbarButtonsHtml,
            timelineInlineToolbarGroupHtml,
            timelineCompactToolbarGroupHtml,
            timelineFloatingToolbarHtml,
            timelineRowModel: __tmTimelineRowModel,
            timelineFullRowModel: __tmTimelineFullRowModel,
            mainStageBottomInset,
            bodyWithSideDockHtml,
            multiSelectCount,
            showMultiSelectBar,
            multiSelectBarBottom,
            multiSelectActionDisabledAttr,
            multiSelectBarHtml,
        };
    }
