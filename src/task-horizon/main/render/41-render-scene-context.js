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
        });

        state.renderChecklistBodyHtml = __tmRenderChecklistBodyHtml;
        state.renderKanbanBodyHtml = __tmRenderKanbanBodyHtml;
        state.renderWhiteboardBodyHtml = __tmRenderWhiteboardBodyHtml;

        const renderMode = state.homepageOpen ? 'home' : String(state.viewMode || '').trim();
        const homepageBodyAnimClass = renderMode === 'home' ? '' : bodyAnimClass;
        const __tmTimelineRowModel = renderMode === 'timeline' ? __tmBuildTaskRowModel() : null;
        const mainBodyHtml = renderMode === 'home'
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
        const showCalendarSideDock = !state.homepageOpen && __tmShouldShowCalendarSideDock() && !isMobile;
        const showAiSideDock = __tmShouldShowAiSidebar() && !!state.aiSidebarOpen && !isMobile;
        const calendarSideDockWidth = Math.max(260, Math.min(760, Math.round(Number(SettingsStore.data.calendarSideDockWidth) || 340)));
        const aiSideDockWidth = Math.max(320, Math.min(720, Math.round(Number(state.aiSidebarWidth) || 380)));
        const showWhiteboardMobileDetailSheet = renderMode === 'whiteboard' && (__tmIsMobileDevice() || __tmHostUsesMobileUI()) && __tmChecklistUseSheetMode();
        const whiteboardDetailTaskId = String(state.detailTaskId || '').trim();
        const whiteboardDetailTask = showWhiteboardMobileDetailSheet && whiteboardDetailTaskId ? (state.flatTasks?.[whiteboardDetailTaskId] || null) : null;
        const whiteboardDetailHtml = whiteboardDetailTask
            ? __tmBuildTaskDetailInnerHtml(whiteboardDetailTask, { embedded: true, closeable: true })
            : `<div class="tm-checklist-empty-detail">选择任务后，这里会显示可编辑的详情。</div>`;
        const showMobileBottomViewBar = isDockHost
            ? (!isRuntimeMobile || !isLandscape)
            : !!(isMobile && !isLandscape);
        const mobileBottomViewbarActive = showMobileBottomViewBar && (Date.now() < (Number(state.mobileBottomViewbarActiveUntil) || 0));
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
        const showTimelineFloatingToolbar = !!(showMobileTimelineFloatingToolbar || showDockTimelineFloatingToolbar);
        const showMobileLandscapeTimelineTopbar = !!(isMobile && !isDockHost && isLandscape && renderMode === 'timeline');
        const showDesktopNarrowTimelineTopbar = !!(!isMobile && !isDockHost && isDesktopNarrow && renderMode === 'timeline');
        const showTopbarTimelineToolbar = !!(renderMode === 'timeline' && !showTimelineFloatingToolbar);
        const topbarAddBtnHtml = `<button class="tm-btn tm-btn-info tm-topbar-add-btn bc-btn bc-btn--sm" onclick="tmAdd()" aria-label="新建任务" data-tm-floating-tooltip-label="新建任务" data-tm-tooltip-side="bottom" data-tm-tooltip-align="center" style="padding: 0; width: 30px; height: 30px; min-width: 30px; min-height: 30px; display: inline-flex; align-items: center; justify-content: center;">${__tmRenderLucideIcon('plus')}</button>`;
        const timelineSidebarToggleLabel = SettingsStore.data.timelineSidebarCollapsed ? '展开时间轴侧栏' : '隐藏时间轴侧栏';
        const timelineSidebarToggleButtonHtml = renderMode === 'timeline'
            ? `<button class="tm-btn tm-btn-info tm-timeline-toolbar-btn bc-btn bc-btn--sm" onclick="tmTimelineToggleSidebar(event)" style="padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs(timelineSidebarToggleLabel, { side: 'bottom' })}>${__tmRenderLucideIcon('panel-left')}</button>`
            : '';
        const __tmRenderTimelineToolbarButtons = ({ buttonClass = '', buttonStyle = '', interactionAttrs = '', clickPrefix = '' } = {}) => {
            const buttonClassName = ['tm-btn', 'tm-btn-info', 'tm-timeline-toolbar-btn', 'bc-btn', 'bc-btn--sm', String(buttonClass || '').trim()].filter(Boolean).join(' ');
            const styleAttr = buttonStyle ? ` style="${__tmEscAttr(buttonStyle)}"` : '';
            const extraAttrs = String(interactionAttrs || '');
            const clickStart = String(clickPrefix || '');
            return `
                <button class="${buttonClassName}" onclick="${clickStart}tmGanttZoomOut()"${styleAttr}${extraAttrs}${__tmBuildTooltipAttrs('缩小', { side: 'bottom' })}>${__tmRenderLucideIcon('minus')}</button>
                <button class="${buttonClassName}" onclick="${clickStart}tmGanttZoomIn()"${styleAttr}${extraAttrs}${__tmBuildTooltipAttrs('放大', { side: 'bottom' })}>${__tmRenderLucideIcon('plus')}</button>
                <button class="${buttonClassName}" onclick="${clickStart}tmGanttFit()"${styleAttr}${extraAttrs}${__tmBuildTooltipAttrs('适配范围', { side: 'bottom' })}>${__tmRenderLucideIcon('map')}</button>
                <button class="${buttonClassName}" onclick="${clickStart}tmGanttToday()"${styleAttr}${extraAttrs}${__tmBuildTooltipAttrs('定位今天', { side: 'bottom' })}>${__tmRenderLucideIcon('calendar-days')}</button>
            `;
        };
        const __tmRenderTimelineToolbarGroup = ({ includeSidebarToggle = false, buttonClass = '', buttonStyle = '', interactionAttrs = '', clickPrefix = '' } = {}) => {
            const inner = `${includeSidebarToggle ? timelineSidebarToggleButtonHtml : ''}${__tmRenderTimelineToolbarButtons({ buttonClass, buttonStyle, interactionAttrs, clickPrefix })}`;
            return inner ? `<div class="tm-timeline-toolbar-group">${inner}</div>` : '';
        };
        const timelineInlineToolbarButtonsHtml = __tmRenderTimelineToolbarButtons({
            buttonStyle: 'padding: 0 8px; height: 30px; display: inline-flex; align-items: center; justify-content: center;'
        });
        const timelineCompactToolbarButtonsHtml = __tmRenderTimelineToolbarButtons({
            buttonStyle: 'padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;'
        });
        const timelineInlineToolbarGroupHtml = __tmRenderTimelineToolbarGroup({
            includeSidebarToggle: true,
            buttonStyle: 'padding: 0 8px; height: 30px; display: inline-flex; align-items: center; justify-content: center;'
        });
        const timelineCompactToolbarGroupHtml = __tmRenderTimelineToolbarGroup({
            includeSidebarToggle: true,
            buttonStyle: 'padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;'
        });
        const timelineFloatingToolbarHtml = showTimelineFloatingToolbar
            ? `<div class="tm-timeline-mobile-toolbar"><div class="tm-timeline-mobile-toolbar__inner">${__tmRenderTimelineToolbarButtons({
                buttonClass: 'tm-timeline-mobile-toolbar__btn',
                interactionAttrs: showMobileTimelineFloatingToolbar ? ' onpointerdown=\"tmTouchTimelineMobileToolbarButton(event)\"' : '',
                clickPrefix: showMobileTimelineFloatingToolbar ? 'tmTouchTimelineMobileToolbarButton(event);' : ''
            })}</div></div>`
            : '';
        const mainStageBottomInset = showTimelineFloatingToolbar
            ? 'calc(var(--tm-mobile-bottom-viewbar-offset, env(safe-area-inset-bottom, 0px)) + 112px)'
            : (showMobileBottomViewBar
                ? 'calc(var(--tm-mobile-bottom-viewbar-offset, env(safe-area-inset-bottom, 0px)) + 52px)'
                : '0px');
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
            ? 'calc(var(--tm-mobile-bottom-viewbar-offset, env(safe-area-inset-bottom, 0px)) + 108px)'
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
        const whiteboardMobileDetailSheetHtml = showWhiteboardMobileDetailSheet
            ? `<div id="tmChecklistSheetBackdrop" class="tm-checklist-sheet-backdrop ${state.checklistDetailSheetOpen && whiteboardDetailTask ? 'tm-checklist-sheet-backdrop--open' : ''}" onclick="tmChecklistCloseSheet(event)"></div>
                <div id="tmChecklistSheet" class="tm-checklist-sheet ${state.checklistDetailSheetOpen && whiteboardDetailTask ? 'tm-checklist-sheet--open' : ''}" onpointerdown="tmChecklistSheetDragStart(event)">
                    <div class="tm-checklist-sheet-handle"></div>
                    <div class="tm-checklist-sheet-body" id="tmChecklistSheetPanel">${whiteboardDetailHtml}</div>
                </div>`
            : '';


        return {
            renderMode,
            mainBodyHtml,
            showCalendarSideDock,
            showAiSideDock,
            calendarSideDockWidth,
            aiSideDockWidth,
            showWhiteboardMobileDetailSheet,
            whiteboardDetailTaskId,
            whiteboardDetailTask,
            whiteboardDetailHtml,
            showMobileBottomViewBar,
            mobileBottomViewbarActive,
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
            mainStageBottomInset,
            bodyWithSideDockHtml,
            multiSelectCount,
            showMultiSelectBar,
            multiSelectBarBottom,
            multiSelectActionDisabledAttr,
            multiSelectBarHtml,
            whiteboardMobileDetailSheetHtml,
        };
    }
