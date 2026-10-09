    // V3 changes presentation only: production renderers and save handlers remain authoritative.
    const TM_SETTINGS_V2_PAGES = [
        ['docs', '任务', '任务', 'check-circle-2'], ['view', '视图', '界面', 'sidebar'],
        ['calendar', '时间', '时间', 'calendar-blank'], ['appearance', '外观', '界面', 'palette'],
        ['ai', '智能', '智能', 'sparkle'], ['algo', '规则', '规则', 'list-numbers'],
        ['about', '数据', '数据', 'cloud'], ['benefits', '授权', '授权', 'lock'],
    ];
    // Exact navigation glyphs from the approved v3 prototype, independent of the global icon set.
    const TM_SETTINGS_V3_NAV_ICONS = {
        "docs": "<circle cx=\"12\" cy=\"12\" r=\"8.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"/><path d=\"m8.4 12.2 2.5 2.5 4.7-5.1\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.7\"/>",
        "view": "<rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"15\" rx=\"2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"/><path d=\"M9.8 4.5v15M9.8 10h10.7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"/>",
        "calendar": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15\" rx=\"2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"/><path d=\"M7.6 3.2v3.6M16.4 3.2v3.6M3.5 9.6h17\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.7\"/>",
        "appearance": "<path d=\"M12 3.2a8.8 8.8 0 1 0 0 17.6c1.4 0 2-.9 1.6-2-.5-1.5.5-2.6 2-2.6h1.4A3.8 3.8 0 0 0 20.8 12 8.8 8.8 0 0 0 12 3.2Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"/><circle cx=\"8.6\" cy=\"10.4\" r=\"1.2\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"7.8\" r=\"1.2\" fill=\"currentColor\"/><circle cx=\"15.6\" cy=\"10.2\" r=\"1.2\" fill=\"currentColor\"/>",
        "ai": "<path d=\"m12 3 1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9L12 3Z\" fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"1.6\"/><path d=\"M18.4 16.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z\" fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"1.4\"/>",
        "algo": "<circle cx=\"12\" cy=\"12\" r=\"8.4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"/><circle cx=\"12\" cy=\"12\" r=\"2.6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"/><path d=\"M12 3.6v5.8M12 14.6v5.8M3.6 12h5.8M14.6 12h5.8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\"/>",
        "about": "<path d=\"M7.5 18.5h9.8a3.7 3.7 0 0 0 .4-7.4 5.4 5.4 0 0 0-10.4-1.3 4.4 4.4 0 0 0 .2 8.7Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"/>",
        "benefits": "<rect x=\"4.8\" y=\"10\" width=\"14.4\" height=\"10\" rx=\"2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"/><path d=\"M8.4 10V7.6a3.6 3.6 0 0 1 7.2 0V10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"/>"
};
    function __tmSettingsV3NavIcon(page) {
        return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" data-settings-icon="${page}">${TM_SETTINGS_V3_NAV_ICONS[page]}</svg>`;
    }
    const TM_SETTINGS_V3_SUBPAGES = {
        docs: [['t-src', '文档与来源'], ['t-new', '新建任务'], ['t-status', '状态列表'], ['t-done', '完成与归档'], ['t-review', '复习与日期']],
        view: [['v-start', '启动与入口'], ['v-float', '悬浮条与交互'], ['v-fields', '字段与分组'], ['v-table', '表格 / 清单'], ['v-tl', '时间轴 / 看板 / 白板']],
        calendar: [['c-cal', '日历'], ['c-content', '日程与显示'], ['c-remind', '提醒通知'], ['c-ics', 'ICS 订阅'], ['c-focus', '专注与联动']],
        appearance: [['l-density', '字号与密度'], ['l-icon', '图标与复选框'], ['l-color', '配色'], ['l-top', '顶栏控件']],
        ai: [['a-mode', '工作方式'], ['a-agent', '智能体'], ['a-legacy', '旧版接入'], ['a-policy', '安排规则']],
        algo: [['r-rules', '筛选与排序'], ['r-priority', '优先级数值'], ['r-quadrant', '四象限']],
        about: [['d-io', '导入导出'], ['d-sync', '同步与设备'], ['d-about', '版本与帮助'], ['d-reset', '重置']],
        benefits: [],
    };
    const __tmSettingsV2Sources = {
        docs: ['docs', 'main', 'appearance'], view: ['main', 'appearance'],
        appearance: ['main', 'appearance'], calendar: ['calendar', 'main'], ai: ['ai'],
        algo: ['rules', 'priority', 'quadrant'], about: ['about', 'docs', 'main', 'appearance'], benefits: ['benefits'],
    };
    const __tmSettingsV3GroupNames = {
        't-src:docs': '文档分组与来源', 't-src:tabs': '页签与归档入口', 't-src:search': '扫描范围',
        't-new:new-task': '新建位置与继承', 't-new:display': '任务标题',
        't-status:status': '状态与完成联动', 't-done:new-task': '删除与归档',
        't-done:display': '完成反馈', 't-done:search': '已完成任务显示',
        't-review:status': '间隔复习', 't-review:search': '语义日期', 't-review:display': '工作日计算',
        'v-start:layout': '启动与默认视图', 'v-start:topbar': '思源入口', 'v-start:appearance-topbar': '插件顶栏入口',
        'v-float:layout': '任务点击行为', 'v-float:quickbar': '任务悬浮条',
        'v-fields:layout': '紧凑字段', 'v-fields:search': '任务分组与排序',
        'v-table:columns': '表格列与自定义字段', 'v-table:layout': '清单布局', 'v-tl:layout': '时间轴、看板与白板',
        'l-density:display': '字号与阅读密度', 'l-density:layout': '紧凑字段字号',
        'l-icon:icons': '插件图标', 'l-icon:checkbox': '任务复选框', 'l-icon:colors': '重要性图标',
        'l-icon:task-count-badge': '任务数量角标',
        'l-color:colors': '主题与配色', 'l-top:colors': '顶栏控件细节',
        'c-focus:layout': '时长与番茄属性', 'c-focus:topbar': '嵌入待办统计', 'c-focus:tomato': '番茄钟与打卡联动',
        'd-io:import': '任务数据导入', 'd-io:backup': '设置备份与迁移',
        'd-sync:device': '设备识别与诊断', 'd-sync:search': '兼容与同步', 'd-about:version': '版本与帮助',
        'd-reset:colors': '恢复外观默认设置',
    };
    function __tmSettingsV3Handlers(node) {
        if (!node) return '';
        const selector = '[onchange],[onclick],[oninput],[data-tm-call],[data-tm-action]';
        return [node, ...node.querySelectorAll(selector)].map(el =>
            ['onchange', 'onclick', 'oninput', 'data-tm-call', 'data-tm-action'].map(key => el.getAttribute(key) || '').join(' ')).join(' ');
    }
    function __tmSettingsV3Route(tab, section = '', node) {
        const assigned = node?.closest?.('[data-tm-settings-subpage]');
        if (assigned) return { page: assigned.dataset.tmSettingsPage, sub: assigned.dataset.tmSettingsSubpage };
        const handlers = node?.matches?.('.tm-settings-panel') ? '' : __tmSettingsV3Handlers(node);
        let sub;
        if (tab === 'main') {
            if (/update(?:Fsrs|RemainingTimeUseWorkdays|SemanticDate)/.test(handlers)) sub = 't-review';
            else if (/updateTaskHeadingLevel/.test(handlers)) sub = 't-new';
            else if (/update(?:TaskDoneDelight|ShowCompletedTasks|CompletedTasks|TaskDeleteMode|TaskRecycleDocId|TaskCompletionArchive)/.test(handlers)) sub = 't-done';
            else if (/update(?:RecursiveDocLimit|TaskParentLookupDepth)/.test(handlers)) sub = 't-src';
            else if (/update(?:LegacyWin7|ServerSync)/.test(handlers)) sub = 'd-sync';
            else if (/update(?:DurationFormat|TomatoCountAttrKey|TomatoEstimateAttrKey|DocTitleEmbeddedTaskFocus)/.test(handlers)) sub = 'c-focus';
            else if (/(?:add|update|move|delete)DurationOption/.test(handlers)) sub = 'c-focus';
            else if (/updateChecklistCompactRightFontSize/.test(handlers)) sub = 'l-density';
            else if (/update(?:TaskTitleClickAction|DockTaskTitleClickAction|MobileTaskTitleClickAction)/.test(handlers)) sub = 'v-float';
            else if (/updateChecklistCompactMetaFieldVisibility/.test(handlers)) sub = 'v-fields';
            else if (/updateChecklistCompact(?:Mode|TreeGuides)/.test(handlers)) sub = 'v-table';
            else if (/update(?:DefaultViewMode|MobileAutoOpen|DocTabsAutoHide|DocTabProcrastination|DockSidebar|DockDefaultView|EnabledView)/.test(handlers)) sub = 'v-start';
            else sub = ({ display: 'l-density', 'new-task': 't-new', status: 't-status', layout: 'v-tl', search: 'v-fields', topbar: 'v-start', quickbar: 'v-float', tomato: 'c-focus' })[section] || 'v-start';
        } else if (tab === 'appearance') {
            if (/tmUpdateAppearanceMetric/.test(handlers)) sub = 'l-top';
            else if (/tmUpdatePriorityIconStyle/.test(handlers)) sub = 'l-icon';
            else if (/tmResetAppearanceColors/.test(handlers) && !/tmSelectAppearanceTheme/.test(handlers)) sub = 'd-reset';
            else sub = ({ columns: 'v-table', tabs: 't-src', topbar: 'v-start', icons: 'l-icon', checkbox: 'l-icon', colors: 'l-color' })[section] || 'l-density';
        } else if (tab === 'docs') sub = section === 'import' ? 'd-io' : 't-src';
        else if (tab === 'calendar') sub = ({ 'calendar-content': 'c-content', 'calendar-reminders': 'c-remind', 'calendar-subscription': 'c-ics' })[section] || 'c-cal';
        else if (tab === 'ai' || tab === 'scheduled') sub = ({ 'ai-agent': 'a-agent', 'ai-policy': 'a-policy', 'ai-connection': 'a-legacy' })[section] || 'a-mode';
        else if (['rules', 'rule_editor', 'priority', 'quadrant'].includes(tab)) sub = 'r-' + (tab === 'rule_editor' ? 'rules' : tab);
        else if (tab === 'about') sub = section === 'backup' ? 'd-io' : section === 'version' ? 'd-about' : 'd-sync';
        const page = Object.keys(TM_SETTINGS_V3_SUBPAGES).find(id => TM_SETTINGS_V3_SUBPAGES[id].some(item => item[0] === sub)) || (tab === 'benefits' ? 'benefits' : 'docs');
        return { page, sub: sub || '' };
    }
    function __tmSettingsV2PageFor(tab, section = '', title = '') {
        const match = state.settingsSearchGeneratedEntries?.find(entry => entry.tab === tab && entry.section === section && entry.title === title && entry.route);
        return match?.route.page || __tmSettingsV3Route(tab, section).page;
    }
    function __tmSettingsV2CurrentPage() {
        const tab = state.settingsActiveTab || 'docs';
        if (state.settingsV2Source === tab && __tmSettingsV2Sources[state.settingsV2Page]) return state.settingsV2Page;
        return __tmSettingsV2PageFor(tab);
    }
    window.tmOpenSettingsV2Page = function(page, sub) {
        const aliases = { general: ['view', 'v-start'], behavior: ['docs', 't-new'], links: ['calendar', 'c-focus'], task: ['docs'], look: ['appearance'], time: ['calendar'], rules: ['algo'], data: ['about'], lic: ['benefits'] };
        if (aliases[page]) [page, sub] = aliases[page];
        if (!__tmSettingsV2Sources[page]) return;
        __tmFlushSettingsInputs();
        state.settingsV2Page = page;
        state.settingsActiveTab = __tmSettingsV2Sources[page][0];
        state.settingsV2Source = state.settingsActiveTab;
        if (sub) (state.settingsV3Subpages ||= {})[page] = sub;
        state.settingsContentScrollTop = 0;
        state.settingsSubtabsScrollLeft = 0;
        state.settingsV3SearchOpen = false;
        showSettings();
    };
    function __tmSettingsV2Title(node) {
        return node.dataset?.tmSettingsSearchTitle || node.querySelector?.('[data-tm-settings-search-title]')?.dataset.tmSettingsSearchTitle
            || node.querySelector?.('.tm-setting-field-title,.tm-setting-switch-title')?.textContent?.trim() || '';
    }
    function __tmBuildSettingsV2(root, renderSource) {
        const page = __tmSettingsV2CurrentPage();
        if (page === 'algo') state.priorityScoreDraft ||= __tmEnsurePriorityDraft();
        state.settingsV2Page = page;
        state.settingsV2Source = state.settingsActiveTab;
        const content = root.querySelector('.tm-settings-content');
        const fragment = document.createDocumentFragment();
        const groups = new Map();
        function appendGroup(node, source, section, route, preservePanel = false) {
            if (route.page !== page) return;
            const groupKey = `${route.sub}:${source === 'appearance' && section === 'topbar' ? 'appearance-topbar' : section}`;
            if (preservePanel) {
                node.dataset.tmSettingsPage = page;
                node.dataset.tmSettingsSubpage = route.sub;
                node.dataset.tmSettingsLegacySection = section;
                const count = (groups.get(groupKey) || 0) + 1;
                groups.set(groupKey, count);
                node.dataset.tmSettingsSection = `${source}-${section}-${page}${count > 1 ? '-' + count : ''}`;
                fragment.append(node);
                return;
            }
            let panel = groups.get(groupKey);
            if (!(panel instanceof HTMLElement)) {
                panel = document.createElement('section');
                panel.className = 'tm-settings-panel';
                panel.dataset.tmSettingsPage = page;
                panel.dataset.tmSettingsSubpage = route.sub;
                panel.dataset.tmSettingsSection = `${source}-${section}-${page}-${route.sub}`;
                panel.dataset.tmSettingsLegacySection = section;
                const title = (source === 'docs' ? __tmSettingsV2Title(node) : '') || __tmSettingsV3GroupNames[groupKey] || TM_SETTINGS_V3_SUBPAGES[page].find(x => x[0] === route.sub)?.[1] || '设置';
                panel.innerHTML = `<div class="tm-settings-section-title">${esc(title)}</div>`;
                fragment.append(panel);
                groups.set(groupKey, panel);
            }
            panel.append(node);
        }
        (__tmSettingsV2Sources[page] || ['docs']).forEach(source => {
            const probe = document.createElement('div');
            probe.innerHTML = renderSource(source);
            __tmDecorateSettingsSearchCoverage(probe, source);
            const sourceContent = probe.querySelector('.tm-settings-content');
            if (!sourceContent) return;
            sourceContent.querySelectorAll('.tm-settings-subtabs').forEach(node => node.remove());
            Array.from(sourceContent.children).forEach(panel => {
                const section = panel.dataset.tmSettingsSection || source;
                if (source === 'benefits' || source === 'calendar') { fragment.append(panel); return; }
                if (source === 'main' || (source === 'appearance' && section === 'colors')) {
                    let previousRoute = __tmSettingsV3Route(source, section);
                    Array.from(panel.children).forEach(node => {
                        if (node.matches('.tm-settings-section-title,.tm-settings-section-desc')) return;
                        if (source === 'appearance' && node === panel.firstElementChild && !__tmSettingsV3Handlers(node)) return;
                        const route = __tmSettingsV3Handlers(node) ? __tmSettingsV3Route(source, section, node) : previousRoute;
                        previousRoute = route;
                        appendGroup(node, source, section, route);
                    });
                    if (source === 'appearance' && section === 'colors') {
                        const colorGroup = groups.get('l-color:colors');
                        if (colorGroup instanceof HTMLElement) {
                            Object.entries(panel.dataset).filter(([key]) => key.startsWith('tmSettingsSearch')).forEach(([key, value]) => { colorGroup.dataset[key] = value; });
                        }
                    }
                    return;
                }
                if (source === 'about' && section === 'device') {
                    const version = panel.querySelector('[data-tm-settings-version]');
                    if (version) appendGroup(version, source, 'version', { page: 'about', sub: 'd-about' });
                }
                const route = __tmSettingsV3Route(source, section, panel);
                // Preserve complex document, rule, policy and calendar containers, including their hooks.
                if (panel.classList.contains('tm-settings-panel')) appendGroup(panel, source, section, route, true);
                else appendGroup(panel, source, section, route);
            });
        });
        if (page === 'ai') {
            for (const [sub, label] of TM_SETTINGS_V3_SUBPAGES.ai) {
                if (fragment.querySelector(`[data-tm-settings-subpage="${sub}"]`)) continue;
                const note = document.createElement('div');
                note.className = 'tm-settings-v3-empty';
                note.innerHTML = `<p>${sub === 'a-policy' ? '安排规则需要启用思源智能体并具备对应功能权益。' : `当前工作方式未启用${esc(label)}，可在工作方式中切换。`}</p><button type="button" class="tm-btn" data-tm-call="tmOpenSettingsV3Subpage" data-tm-args='["a-mode"]'>查看工作方式</button>`;
                appendGroup(note, 'ai', sub, { page: 'ai', sub });
            }
        }
        if (state.settingsActiveTab !== 'rule_editor') content.replaceChildren(fragment);
        root.classList.add('tm-settings-v2', 'tm-settings-v3');
        root.classList.remove('tm-settings-modal--mobile');
        root.dataset.settingsPage = page;
        root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '任务管理器设置');
        const sidebar = root.querySelector('.tm-settings-sidebar');
        const search = sidebar.querySelector('[data-tm-settings-search-root]');
        const main = root.querySelector('.tm-settings-main');
        if (search) {
            main.prepend(search);
            search.querySelector('.tm-settings-search-icon').innerHTML = __tmRenderLucideIcon('search', '', { size: 16 });
            search.querySelector('input').placeholder = '搜索设置项，按 / 聚焦';
        }
        sidebar.querySelector('.tm-settings-tabs').innerHTML = TM_SETTINGS_V2_PAGES.map(([id, label]) =>
            `<button type="button" class="tm-settings-nav-btn${id === page ? ' is-active' : ''}" data-tm-call="tmOpenSettingsV2Page" data-tm-args='${esc(JSON.stringify([id]))}' ${id === page ? 'aria-current="page"' : ''} title="${esc(label)}">${__tmSettingsV3NavIcon(id)}<span>${esc(label)}</span></button>`).join('');
        const searchButton = document.createElement('button');
        searchButton.type = 'button'; searchButton.className = 'tm-settings-v3-rail-search';
        searchButton.setAttribute('aria-label', '搜索设置'); searchButton.title = '搜索设置（/）';
        searchButton.innerHTML = __tmRenderLucideIcon('search', '', { size: 18 });
        searchButton.addEventListener('click', () => __tmToggleSettingsV3Search(root));
        sidebar.prepend(searchButton);
        root.querySelectorAll('.tm-settings-actions').forEach(node => node.remove());
        const header = document.createElement('div');
        header.className = 'tm-settings-v2-header';
        header.innerHTML = `<div><h2>${esc(TM_SETTINGS_V2_PAGES.find(item => item[0] === page)?.[1] || '设置')}</h2></div><button type="button" class="tm-settings-v3-search-toggle" aria-label="搜索设置">${__tmRenderLucideIcon('search', '', { size: 18 })}</button><button type="button" class="bc-btn bc-btn--ghost tm-settings-v2-close" data-tm-action="closeSettings" aria-label="关闭设置">${__tmRenderLucideIcon('x', '', { size: 20 })}</button>`;
        header.querySelector('.tm-settings-v3-search-toggle').addEventListener('click', () => __tmToggleSettingsV3Search(root));
        main.prepend(header);
        const sections = document.createElement('nav');
        sections.className = 'tm-settings-v3-sections'; sections.setAttribute('aria-label', '设置子分类');
        sections.innerHTML = TM_SETTINGS_V3_SUBPAGES[page].map(([id, label]) => `<button type="button" data-tm-call="tmOpenSettingsV3Subpage" data-tm-args='${esc(JSON.stringify([id]))}' data-settings-subpage="${id}">${esc(label)}</button>`).join('');
        sections.hidden = !sections.childElementCount;
        main.insertBefore(sections, content);
        root.classList.toggle('is-searching', !!state.settingsV3SearchOpen);
        root.addEventListener('keydown', event => {
            if (event.key === '/' && !event.target.closest('input,textarea,select,[contenteditable="true"]')) {
                event.preventDefault(); __tmToggleSettingsV3Search(root, true);
            } else if (event.key === 'Escape' && root.classList.contains('is-searching')) {
                event.preventDefault(); event.stopPropagation(); __tmToggleSettingsV3Search(root, false);
            }
        }, true);
        content.addEventListener('pointerdown', () => {
            if (root.classList.contains('is-searching')) __tmToggleSettingsV3Search(root, false, false);
        });
        __tmDecorateSettingsV2(root);
        __tmBindSettingsInstantInputs(root);
        __tmRenderSettingsSaveFeedback();
        content.addEventListener('scroll', () => __tmSyncSettingsV2Nav(root), { passive: true });
    }
    function __tmToggleSettingsV3Search(root, open = !root.classList.contains('is-searching'), restoreFocus = true) {
        state.settingsV3SearchOpen = open;
        root.classList.toggle('is-searching', open);
        root.querySelectorAll('.tm-settings-v3-search-toggle,.tm-settings-v3-rail-search').forEach(button => button.setAttribute('aria-expanded', String(open)));
        if (open) {
            root.__tmSettingsSearchUnstack ||= __tmModalStackBind(() => __tmToggleSettingsV3Search(root, false));
            root.querySelector('[data-tm-settings-search-input]')?.focus({ preventScroll: true });
        }
        else {
            root.__tmSettingsSearchUnstack?.(); root.__tmSettingsSearchUnstack = null;
            state.settingsSearchResultsOpen = false;
            __tmRefreshSettingsSearchResults(root);
            if (restoreFocus) Array.from(root.querySelectorAll('.tm-settings-v3-search-toggle,.tm-settings-v3-rail-search')).find(el => el.getClientRects().length)?.focus({ preventScroll: true });
        }
    }
    function __tmSelectSettingsV3Subpage(root, requested, resetScroll = false) {
        const page = root.dataset.settingsPage;
        const choices = TM_SETTINGS_V3_SUBPAGES[page] || [];
        const sub = choices.some(item => item[0] === requested) ? requested : choices[0]?.[0] || '';
        (state.settingsV3Subpages ||= {})[page] = sub;
        root.dataset.settingsSubpage = sub;
        root.querySelectorAll('.tm-settings-content [data-tm-settings-subpage]').forEach(panel => { panel.hidden = panel.dataset.tmSettingsSubpage !== sub; });
        root.querySelectorAll('.tm-settings-v3-sections button').forEach(button => {
            const on = button.dataset.settingsSubpage === sub;
            button.classList.toggle('is-active', on); button.setAttribute('aria-pressed', String(on));
        });
        const calendar = root.querySelector('#tm-calendar-settings-root');
        if (calendar) calendar.hidden = sub === 'c-focus';
        if (resetScroll) {
            state.settingsContentScrollTop = 0; state.settingsSectionJump = null;
            root.querySelector('.tm-settings-content').scrollTop = 0;
        }
    }
    window.tmOpenSettingsV3Subpage = function(sub) {
        const root = state.settingsModal;
        if (!root) return;
        __tmFlushSettingsInputs();
        __tmSelectSettingsV3Subpage(root, sub, true);
        __tmToggleSettingsV3Search(root, false, false);
        __tmDecorateSettingsV2(root);
    };
    function __tmRevealSettingsV3Target(root, target) {
        const panel = target?.closest?.('[data-tm-settings-subpage]');
        if (!panel || panel.dataset.tmSettingsSubpage === root.dataset.settingsSubpage) return;
        __tmSelectSettingsV3Subpage(root, panel.dataset.tmSettingsSubpage, true);
        __tmDecorateSettingsV2(root);
    }
    function __tmDecorateSettingsV2(root = state.settingsModal) {
        if (!root?.classList.contains('tm-settings-v2')) return;
        __tmGuardSettingsControlHandlers(root);
        root.querySelectorAll('.tm-btn,.tm-rule-btn').forEach(button => {
            button.classList.add('bc-btn');
            button.classList.add(button.matches('.tm-btn-primary,.tm-btn-success,.tm-rule-btn-primary,.tm-rule-btn-success') ? 'bc-btn--primary' : 'bc-btn--ghost');
        });
        root.querySelectorAll('input.b3-text-field,textarea.b3-text-field').forEach(input => input.classList.add(input.tagName === 'TEXTAREA' ? 'bc-textarea' : 'bc-input'));
        root.querySelectorAll('.tm-setting-switch-row,.tm-setting-field-row').forEach((row, index) => {
            const label = row.querySelector('.tm-setting-switch-title,.tm-setting-field-title');
            if (!label) return;
            label.id ||= `tm-setting-v2-label-${index}`;
            row.querySelectorAll('input,select,textarea').forEach(input => {
                if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby')) input.setAttribute('aria-labelledby', label.id);
            });
        });
        __tmDecorateSettingsChoices(root); __tmObserveSettingsChoices(root);
        const content = root.querySelector('.tm-settings-content');
        const calendarLabels = { 'calendar-general': '基础视图', 'calendar-layout': '日历布局', 'calendar-content': '日程与显示', 'calendar-reminders': '提醒通知', 'calendar-subscription': '日历订阅' };
        const sections = Array.from(content.querySelectorAll('.tm-settings-panel[data-tm-settings-section]'));
        sections.forEach(panel => {
            const id = panel.dataset.tmSettingsSection;
            if (calendarLabels[id]) {
                panel.dataset.tmSettingsPage = 'calendar';
                panel.dataset.tmSettingsSubpage = __tmSettingsV3Route('calendar', id).sub;
            }
            let heading = panel.querySelector('.tm-settings-section-title,.tm-calendar-settings-section-title');
            if (!heading) heading = panel.querySelector(':scope > div[style*="font-weight"],:scope > div > div[style*="font-weight"]');
            if (!heading) {
                heading = document.createElement('div'); panel.prepend(heading);
                heading.textContent = TM_SETTINGS_V3_SUBPAGES[root.dataset.settingsPage]?.find(item => item[0] === panel.dataset.tmSettingsSubpage)?.[1] || '设置';
            }
            const label = (calendarLabels[id] || (panel.dataset.tmSettingsLegacySection === 'device' ? '设备识别与诊断' : '') || heading.textContent.trim()).replace(/^[^\p{Script=Han}A-Za-z0-9]+/u, '').trim();
            panel.dataset.tmSettingsSectionLabel = label;
            heading.classList.add('tm-settings-section-title'); heading.textContent = label;
            __tmLayoutSettingsV2Section(panel, heading);
        });
        __tmSelectSettingsV3Subpage(root, state.settingsV3Subpages?.[root.dataset.settingsPage]);
        let nav = content.querySelector(':scope > .tm-settings-subtabs');
        if (!nav) { nav = document.createElement('div'); nav.className = 'tm-settings-subtabs'; content.prepend(nav); }
        const visible = sections.filter(panel => !panel.hidden);
        const html = `<div class="tm-settings-subtabs-inner bc-tabs-list">${visible.map(panel => `<button type="button" class="tm-settings-subtab-btn bc-tabs-trigger" data-section-id="${esc(panel.dataset.tmSettingsSection)}" data-tm-call="tmJumpSettingsSection" data-tm-args='${esc(JSON.stringify([panel.dataset.tmSettingsSection]))}'>${esc(panel.dataset.tmSettingsSectionLabel)}</button>`).join('')}</div>`;
        if (nav.innerHTML !== html) nav.innerHTML = html;
        nav.hidden = visible.length < 2;
        __tmSyncSettingsV2Nav(root);
    }
    function __tmLayoutSettingsV2Section(panel, heading) {
        if (panel.querySelector(':scope > .tm-settings-v2-section-body')) return;
        let head = heading;
        while (head.parentElement !== panel) head = head.parentElement;
        if (head === heading) {
            const desc = heading.nextElementSibling;
            head = document.createElement('div'); heading.before(head); head.append(heading);
            if (desc?.matches('.tm-settings-section-desc')) head.append(desc);
        }
        head.classList.add('tm-settings-v2-section-head');
        const body = document.createElement('div'); body.className = 'tm-settings-v2-section-body';
        for (const node of Array.from(panel.childNodes)) if (node !== head) body.append(node);
        panel.append(body);
    }

    // Fixed, compact choices use the existing BASECOAT segmented styling. Keep the
    // native select as the source of truth so all existing change handlers still run.
    const TM_SETTINGS_CHOICE_HANDLERS = new Set([
        'updateTaskHeadingLevel', 'updateNewTaskLocationMode', 'updateTaskDeleteMode',
        'updateTaskCompletionArchiveMode', 'updateDefaultViewMode', 'updateDefaultViewModeMobile',
        'updateDockDefaultViewMode', 'updateTaskTitleClickAction', 'updateDockTaskTitleClickAction',
        'updateMobileTaskTitleClickAction', 'updateDocTabsArchiveButtonPosition',
        'tmUpdateTimelineDependencyScope', 'updateWhiteboardSequenceScope', 'tmSelectAppearanceTheme',
        'tmUpdatePriorityIconStyle', 'updateRowHeightMode', 'updateDocDisplayNameMode',
        'updateChecklistCompactRightFontSize', 'updateDurationFormat', 'updateTomatoSpentAttrMode',
        'tmUpdateAiExperienceMode', 'tmUpdateAiProvider', 'tmUpdateAiDefaultContextMode',
        'tmAgentPolicySetDeadlinePriority', 'tmAgentPolicyUpdateOccupancy', 'tmSetPriorityDurationUnit',
        'tmScheduledUpdateDraft', 'tmScheduledChangeScheduleKind',
        'updateConditionJoin', 'updateConditionMatchMode', 'updateSortOrder',
    ]);
    const TM_SETTINGS_CALENDAR_CHOICES = new Set([
        'calendarInitialViewDesktop', 'calendarInitialViewMobile', 'calendarFirstDay',
        'calendar3DayTodayPosition', 'calendarSidebarDefaultPage', 'calendarHourSlotHeightMode',
        'calendarMonthMinVisibleEvents', 'calendarIndependentScheduleTaskCreateMode',
        'calendarNewScheduleMaxDurationMin', 'calendarQuickAddScheduleTimeMode',
        'calendarTomatoColorMode', 'calendarTaskDateColorMode', 'calendarScheduleReminderDefaultMode',
        'calendarIcsProvider',
    ]);
    function __tmSyncSettingsChoice(select) {
        const group = select.__tmChoiceGroup;
        if (!group) return;
        const options = Array.from(select.options).filter((option) => !option.hidden);
        const buttons = Array.from(group.children);
        const disabled = select.matches(':disabled');
        group.setAttribute('aria-disabled', String(disabled));
        let tabStop = -1;
        buttons.forEach((button, index) => {
            const option = options[index];
            const selected = option?.selected === true;
            button.disabled = disabled || !option || option.disabled || option.parentElement?.disabled === true;
            button.setAttribute('aria-checked', String(selected));
            button.dataset.state = selected ? 'active' : 'inactive';
            button.tabIndex = -1;
            if (selected && !button.disabled) tabStop = index;
        });
        if (tabStop < 0) tabStop = buttons.findIndex((button) => !button.disabled);
        if (tabStop >= 0) buttons[tabStop].tabIndex = 0;
    }
    function __tmDecorateSettingsChoices(root) {
        root.querySelectorAll('.tm-settings-content select').forEach((select) => {
            if (select.__tmChoiceGroup?.isConnected || select.__tmChoiceGroup?.parentElement) {
                __tmSyncSettingsChoice(select);
                return;
            }
            const handler = select.dataset.tmCall || select.dataset.tmChange
                || (select.getAttribute('onchange') || '').match(/^\s*([\w$]+)\s*\(/)?.[1];
            if (!TM_SETTINGS_CHOICE_HANDLERS.has(handler) && !TM_SETTINGS_CALENDAR_CHOICES.has(select.dataset.tmCalSetting)) return;
            const options = Array.from(select.options).filter((option) => !option.hidden);
            if (select.hidden || select.multiple || select.size > 1 || options.length < 2 || options.length > 8) return;
            const group = document.createElement('div');
            group.className = 'bc-tabs-list tm-settings-choice-group';
            group.setAttribute('role', 'radiogroup');
            const labelledBy = select.getAttribute('aria-labelledby');
            if (labelledBy) group.setAttribute('aria-labelledby', labelledBy);
            else {
                const row = select.closest('[data-tm-settings-search-title],.tm-calendar-settings-row,.tm-agent-policy-group,label');
                const label = select.getAttribute('aria-label') || row?.dataset.tmSettingsSearchTitle
                    || row?.querySelector('.tm-calendar-settings-label,.tm-agent-policy-group__title,span')?.textContent?.trim()
                    || select.closest('[data-tm-settings-search-title]')?.dataset.tmSettingsSearchTitle || '选项';
                group.setAttribute('aria-label', label);
            }
            options.forEach((option) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'bc-tabs-trigger';
                button.setAttribute('role', 'radio');
                const label = option.label.trim();
                button.title = label;
                button.setAttribute('aria-label', label);
                button.textContent = handler === 'updateTaskHeadingLevel' ? label.replace(/^(H[1-6]).*$/, '$1')
                    : /^(updateDefaultViewMode(Mobile)?|updateDockDefaultViewMode)$/.test(handler) ? label.replace(/视图$/, '') : label;
                button.dataset.choiceValue = option.value;
                group.append(button);
            });
            const choose = (button) => {
                __tmSyncSettingsChoice(select);
                if (!button || button.disabled) return;
                button.focus({ preventScroll: true });
                if (select.value === button.dataset.choiceValue) return;
                select.value = button.dataset.choiceValue;
                __tmSyncSettingsChoice(select);
                select.dispatchEvent(new Event('change', { bubbles: true }));
                // A handler may reject or normalize a choice synchronously (e.g. permissions).
                __tmSyncSettingsChoice(select);
            };
            group.addEventListener('click', (event) => {
                const button = event.target.closest('button');
                if (!button || !group.contains(button)) return;
                event.preventDefault();
                choose(button);
            });
            group.addEventListener('keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
                const buttons = Array.from(group.children).filter((button) => !button.disabled);
                if (!buttons.length) return;
                event.preventDefault();
                const current = buttons.indexOf(document.activeElement);
                const step = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
                const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + step + buttons.length) % buttons.length;
                choose(buttons[index]);
            });
            group.__tmChoiceSelect = select;
            select.__tmChoiceGroup = group;
            select.hidden = true;
            select.tabIndex = -1;
            select.after(group);
            __tmSyncSettingsChoice(select);
        });
    }
    function __tmObserveSettingsChoices(root) {
        if (root.__tmChoiceObserver) return;
        // Calendar and rule editors replace their own contents without rebuilding the modal.
        const observer = new MutationObserver((records) => {
            if (!root.isConnected) return;
            if (records.some((record) => record.type === 'attributes'
                ? record.target.matches('select,option,optgroup')
                : Array.from(record.addedNodes).some((node) => node.nodeType === 1 && (node.matches('select') || node.querySelector('select'))))) {
                const calendar = root.querySelector('#tm-calendar-settings-root');
                if (calendar) __tmDecorateCalendarSettingsSearchRows(calendar);
                __tmDecorateSettingsV2(root);
                const focus = root.__tmChoiceFocus;
                if (focus && !focus.button.isConnected && document.activeElement === document.body) __tmRestoreSettingsFocus(root, focus.saved);
            }
        });
        observer.observe(root.querySelector('.tm-settings-content'), { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected'] });
        root.__tmChoiceObserver = observer;
        root.addEventListener('focusin', () => {
            const button = document.activeElement;
            root.__tmChoiceFocus = button?.closest('.tm-settings-choice-group') ? { button, saved: __tmCaptureSettingsFocus(root) } : null;
        });
        root.addEventListener('change', (event) => {
            if (event.target.__tmChoiceGroup) queueMicrotask(() => __tmSyncSettingsChoice(event.target));
        });
    }
    function __tmGuardSettingsControlHandlers(root) {
        const names = new Set();
        root.querySelectorAll('input,select,textarea').forEach((input) => {
            if (input.dataset.tmCall) names.add(input.dataset.tmCall);
            if (input.dataset.tmChange) names.add(input.dataset.tmChange);
            for (const attr of ['onchange', 'oninput']) {
                for (const match of (input.getAttribute(attr) || '').matchAll(/\b((?:tm|update|toggle)\w+)\s*\(/g)) names.add(match[1]);
            }
        });
        names.forEach((name) => {
            const original = window[name];
            if (typeof original !== 'function' || original.__tmSettingsErrorGuard) return;
            const guarded = function(...args) {
                const inSettings = !!state.settingsModal;
                const key = `control:${name}`;
                const success = (value) => {
                    if (inSettings && __tmSettingsSaveErrors.has(key)) {
                        const job = __tmSettingsSaveJobs.get(key);
                        if (job) job.failed = null;
                        __tmSettingsSaveFeedback(key);
                    }
                    return value;
                };
                const failure = (error) => {
                    if (!inSettings) throw error;
                    let job = __tmSettingsSaveJobs.get(key);
                    if (!job) {
                        job = { pending: null, running: false, promise: null, failed: null, timer: null };
                        __tmSettingsSaveJobs.set(key, job);
                    }
                    job.failed = { snapshot: null, write: () => original.apply(this, args) };
                    __tmSettingsSaveFeedback(key, `未生效：${String(error?.message || error)}`);
                    return false;
                };
                try {
                    const result = original.apply(this, args);
                    return result?.then ? result.then(success, failure) : success(result);
                } catch (error) { return failure(error); }
            };
            guarded.__tmSettingsErrorGuard = true;
            window[name] = guarded;
            if (__tmNs[name] === original) __tmNs[name] = guarded;
        });
    }
    function __tmSyncSettingsV2Nav(root) {
        if (!root) return;
        const content = root.querySelector('.tm-settings-content');
        const nav = root.querySelector('.tm-settings-subtabs');
        const panels = Array.from(content?.querySelectorAll('.tm-settings-panel[data-tm-settings-section]') || []).filter(panel => !panel.hidden);
        if (!panels.length) return;
        const top = content.getBoundingClientRect().top + (nav?.offsetHeight || 0) + 16;
        let id = panels[0].dataset.tmSettingsSection;
        panels.forEach((panel) => { if (panel.getBoundingClientRect().top <= top) id = panel.dataset.tmSettingsSection; });
        if (state.settingsSectionJump?.root === root && Date.now() < state.settingsSectionJump.until) id = state.settingsSectionJump.sectionId;
        root.querySelectorAll('.tm-settings-subtab-btn').forEach((button) => {
            const on = button.dataset.sectionId === id;
            button.classList.toggle('is-active', on);
            button.dataset.state = on ? 'active' : 'inactive';
            button.setAttribute('aria-pressed', String(on));
        });
    }

    // Debounced change events preserve all existing handlers, including native controls.
    const __tmSettingsInputTimers = new Map();
    let __tmSettingsFlushingInputs = false;
    function __tmFlushSettingsInputs() {
        if (__tmSettingsFlushingInputs) return;
        __tmSettingsFlushingInputs = true;
        try {
            for (const [input, timer] of __tmSettingsInputTimers) {
                clearTimeout(timer);
                __tmSettingsInputTimers.delete(input);
                if (input.isConnected && !input.disabled && input.checkValidity()) input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } finally { __tmSettingsFlushingInputs = false; }
    }
    function __tmBindSettingsInstantInputs(root) {
        if (root.__tmInstantInputsBound) return;
        root.__tmInstantInputsBound = true;
        const queueInput = (event) => {
            const input = event.target;
            if (event.isComposing || !input.matches?.('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),textarea')) return;
            if (!input.matches('[onchange],[data-tm-call],[data-tm-change]') || input.hasAttribute('oninput')) return;
            clearTimeout(__tmSettingsInputTimers.get(input));
            __tmSettingsInputTimers.set(input, setTimeout(() => {
                __tmSettingsInputTimers.delete(input);
                if (!input.isConnected || input.disabled) return;
                if (!input.checkValidity()) { input.reportValidity(); return; }
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }, 450));
        };
        root.addEventListener('input', queueInput);
        root.addEventListener('compositionend', queueInput);
        root.addEventListener('change', (event) => {
            clearTimeout(__tmSettingsInputTimers.get(event.target));
            __tmSettingsInputTimers.delete(event.target);
        }, true);
        root.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab') return;
            const controls = Array.from(root.querySelectorAll('button,input,select,textarea,[tabindex="0"]')).filter((el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
            if (!controls.length) return;
            if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
            else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
        });
    }

    function __tmCaptureSettingsFocus(root) {
        const active = document.activeElement;
        const choice = active?.closest('.tm-settings-choice-group');
        const el = choice?.__tmChoiceSelect || active;
        if (!root?.contains(el) || !el.matches('input,select,textarea')) return null;
        const controls = Array.from(root.querySelectorAll('input,select,textarea'));
        const identity = __tmSettingsControlIdentity(el);
        return { page: root.dataset.settingsPage, identity, index: controls.filter((input) => __tmSettingsControlIdentity(input) === identity).indexOf(el), start: el.selectionStart, end: el.selectionEnd, choiceValue: choice ? active.dataset.choiceValue : null };
    }
    function __tmSettingsControlIdentity(el) {
        return JSON.stringify([el.id, el.tagName, el.type, el.name, el.getAttribute('onchange'), el.getAttribute('oninput'), el.dataset.tmCall, el.dataset.tmArgs, el.dataset.tmChange, el.dataset.tmInput, el.dataset.tmCalSetting, el.closest('[data-tm-settings-search-key]')?.dataset.tmSettingsSearchKey]);
    }
    function __tmRestoreSettingsFocus(root, saved) {
        if (!saved || saved.page !== root.dataset.settingsPage) return;
        const el = Array.from(root.querySelectorAll('input,select,textarea')).filter((input) => __tmSettingsControlIdentity(input) === saved.identity)[saved.index];
        if (!el || el.disabled) return;
        if (el.__tmChoiceGroup) {
            const buttons = Array.from(el.__tmChoiceGroup.children).filter((button) => !button.disabled);
            (buttons.find((button) => button.dataset.choiceValue === saved.choiceValue) || buttons.find((button) => button.tabIndex === 0))?.focus({ preventScroll: true });
            return;
        }
        el.focus({ preventScroll: true });
        try { if (saved.start != null) el.setSelectionRange(saved.start, saved.end); } catch (e) {}
    }
    const __tmSettingsSaveJobs = new Map();
    const __tmSettingsSaveChains = new Map();
    const __tmSettingsSaveErrors = new Map();
    const __tmSettingsClone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
    function __tmSettingsSaveFeedback(key, message = '') {
        if (message) __tmSettingsSaveErrors.set(key, message);
        else __tmSettingsSaveErrors.delete(key);
        __tmRenderSettingsSaveFeedback();
        if (!state.settingsModal && message) hint(message, 'error');
    }
    function __tmRenderSettingsSaveFeedback() {
        const root = state.settingsModal;
        if (!root) return;
        let error = root.querySelector('.tm-settings-v2-error');
        if (!error) {
            error = document.createElement('div');
            error.className = 'tm-settings-v2-error';
            error.setAttribute('role', 'alert');
            root.querySelector('.tm-settings-v2-header')?.after(error);
        }
        error.replaceChildren();
        __tmSettingsSaveErrors.forEach((message, key) => {
            const row = document.createElement('div');
            const label = document.createElement('span');
            label.textContent = message;
            row.append(label);
            if (__tmSettingsSaveJobs.get(key)?.failed) {
                const retry = document.createElement('button');
                retry.type = 'button';
                retry.className = 'bc-btn bc-btn--ghost';
                retry.textContent = '重试';
                retry.addEventListener('click', () => {
                    const job = __tmSettingsSaveJobs.get(key);
                    if (!job?.failed) return;
                    job.pending ||= job.failed;
                    void __tmRunSettingsSave(key);
                });
                row.append(retry);
            }
            error.append(row);
        });
        error.hidden = !__tmSettingsSaveErrors.size;
    }
    function __tmQueueSettingsSave(key, snapshot, write, delay = 150) {
        let job = __tmSettingsSaveJobs.get(key);
        if (!job) { job = { pending: null, running: false, promise: null, failed: null, timer: null }; __tmSettingsSaveJobs.set(key, job); }
        job.pending = { snapshot: __tmSettingsClone(snapshot), write };
        clearTimeout(job.timer);
        job.timer = setTimeout(() => __tmRunSettingsSave(key), delay);
    }
    function __tmRunSettingsSave(key) {
        const job = __tmSettingsSaveJobs.get(key);
        if (!job) return Promise.resolve();
        if (job.running) return job.promise;
        clearTimeout(job.timer);
        job.running = true;
        job.promise = (async () => {
            try {
                while (job.pending) {
                    const next = job.pending;
                    job.pending = null;
                    try {
                        const domain = key.split(':')[0];
                        const write = (__tmSettingsSaveChains.get(domain) || Promise.resolve())
                            .catch(() => null).then(() => next.write(next.snapshot));
                        __tmSettingsSaveChains.set(domain, write);
                        await write;
                        job.failed = null;
                        __tmSettingsSaveFeedback(key);
                    } catch (error) {
                        job.failed = error?.code === 'STALE_REVISION' ? null : next;
                        __tmSettingsSaveFeedback(key, `未生效：${String(error?.message || error)}`);
                    }
                }
            } finally { job.running = false; }
        })();
        return job.promise;
    }
    function __tmFlushSettingsAutosave() {
        return Promise.all(Array.from(__tmSettingsSaveJobs, ([key, job]) => { clearTimeout(job.timer); return __tmRunSettingsSave(key); }));
    }
    async function __tmPersistPrioritySetting(draft) {
        const previous = SettingsStore.data.priorityScoreConfig;
        const plan = __tmBuildRuntimeCustomFieldLoadPlan();
        draft.customFieldDelta = __tmNormalizePriorityCustomFieldDelta(draft.customFieldDelta);
        SettingsStore.data.priorityScoreConfig = draft;
        try { await SettingsStore.save(); }
        catch (error) {
            if (SettingsStore.data.priorityScoreConfig === draft) SettingsStore.data.priorityScoreConfig = previous;
            throw error;
        }
        try { await __tmWarmPriorityGroupDeltaDocsMap(); } catch (e) {}
        if (__tmDoesCustomFieldPlanNeedReload(plan, __tmBuildRuntimeCustomFieldLoadPlan())) {
            await loadSelectedDocuments({ showInlineLoading: false, source: 'priority-custom-field-score' });
        }
        __tmScheduleRender({ withFilters: true });
    }
    async function __tmPersistEditingRule(rule) {
        if (!String(rule.name || '').trim()) throw new Error('规则名称不能为空');
        __tmNormalizeRuleSortConfigForCustomOrder(rule);
        const fields = RuleManager.getAvailableFields();
        (rule.conditions || []).forEach((condition) => {
            if (fields.find((field) => field.value === condition.field)?.type === 'boolean' && (condition.value == null || condition.value === '')) condition.value = 'true';
        });
        const previous = state.filterRules;
        const previousRule = previous.find((item) => item.id === rule.id);
        const rules = previous.map((item) => item.id === rule.id ? rule : item);
        if (!rules.some((item) => item.id === rule.id)) rules.push(rule);
        try { await RuleManager.saveRules(rules); }
        catch (error) { SettingsStore.data.filterRules = previous; throw error; }
        state.filterRules = rules;
        __tmRefreshRuleTopbarSelectsInPlace();
        if (state.currentRule === rule.id) {
            state.__tmQueryDoneOnly = !!rule.conditions?.some((c) => c.field === 'done' && c.operator === '=' && (c.value === true || c.value === 'true'));
            if (!previousRule || ['conditions', 'sort', 'enabled'].some((key) => JSON.stringify(previousRule[key]) !== JSON.stringify(rule[key]))) {
                __tmScheduleRender({ withFilters: true });
            }
        }
    }
    async function __tmPersistScheduledSetting(draft) {
        const error = __tmScheduledValidate(draft);
        if (error) throw new Error(error);
        if (!__tmScheduledSettingsSupported()) throw new Error('定时事件需要思源 3.7.3 或更高版本');
        const api = __tmScheduledSettingsApi();
        if (typeof api?.save !== 'function') throw new Error('定时事件服务尚未就绪，请稍后重试');
        // Execution records belong to the scheduler, never overwrite them with an editor snapshot.
        const current = api.list().find((item) => item.id === draft.id);
        if (current) ['lastRun', 'lastOccurrence', 'conversationId'].forEach((key) => { draft[key] = current[key]; });
        await api.save(draft);
        if (state.scheduledEventDraft?.id === draft.id) state.scheduledEventEditingId = draft.id;
        __tmScheduledRerenderSettings();
    }
    async function __tmPersistPolicySetting(snapshot) {
        const { draft, deletedDocuments, deletedGroups } = snapshot;
        const error = __tmAgentPolicyValidate(draft);
        if (error) throw new Error(error);
        const documentOverrides = __tmSettingsClone(draft.documentOverrides);
        const groupOverrides = __tmSettingsClone(draft.groupOverrides);
        deletedDocuments.forEach((id) => { documentOverrides[id] = null; });
        deletedGroups.forEach((id) => { groupOverrides[id] = null; });
        try {
            const preview = await __tmAgentPolicyCall('taskHorizonPreviewPolicyPatch', {
                expectedRevision: __tmAgentPolicyView.policy.revision,
                patch: { durationDefaults: draft.durationDefaults, global: draft.global, documentOverrides, groupOverrides },
            });
            const applied = await __tmAgentPolicyCall('taskHorizonApplyPolicyPatch', { expectedRevision: preview.expectedRevision, previewToken: preview.previewToken });
            const saved = __tmAgentPolicyNormalize(applied?.policy);
            __tmAgentPolicyView.policy = saved;
            __tmAgentPolicyView.draft.revision = saved.revision;
            __tmAgentPolicyWriteCache(saved);
            deletedDocuments.forEach((id) => __tmAgentPolicyView.deletedDocumentOverrides.delete(id));
            deletedGroups.forEach((id) => __tmAgentPolicyView.deletedGroupOverrides.delete(id));
        } catch (error2) {
            if (error2?.code === 'STALE_REVISION') {
                // Stop stale queued snapshots: never silently overwrite another device's edits.
                const job = __tmSettingsSaveJobs.get('policy');
                if (job) job.pending = null;
                await __tmLoadAgentPolicySettings(true);
                __tmAgentPolicyRerender();
                throw Object.assign(new Error('安排规则已在其他位置发生变化，已重新读取最新设置，请重新修改'), { code: 'STALE_REVISION' });
            }
            throw error2;
        }
    }
    function __tmSettingsDomainSnapshot(domain) {
        if (domain === 'priority') return state.priorityScoreDraft;
        if (domain === 'rule') return state.editingRule;
        if (domain === 'scheduled') return state.scheduledEventDraft;
        if (domain === 'policy' && __tmAgentPolicyView.loaded) return {
            draft: __tmAgentPolicyView.draft,
            deletedDocuments: Array.from(__tmAgentPolicyView.deletedDocumentOverrides),
            deletedGroups: Array.from(__tmAgentPolicyView.deletedGroupOverrides),
        };
        return null;
    }
    let __tmSettingsAutosaveInstalled = false;
    function __tmInstallSettingsAutosave() {
        if (__tmSettingsAutosaveInstalled) return;
        __tmSettingsAutosaveInstalled = true;
        const writers = { priority: __tmPersistPrioritySetting, rule: __tmPersistEditingRule, scheduled: __tmPersistScheduledSetting, policy: __tmPersistPolicySetting };
        const ruleNames = new Set(['addNewRule', 'tmAddRule', 'updateEditingRuleName', 'addCondition', 'removeCondition', 'updateConditionField', 'updateConditionOperator', 'updateConditionJoin', 'updateConditionMatchMode', 'updateConditionValue', 'toggleConditionMultiValue', 'updateConditionValueRange', 'addSortRule', 'removeSortRule', 'moveSortRule', 'updateSortField', 'updateSortOrder']);
        Object.keys(window).forEach((name) => {
            const domain = /^tm(?:Set|Add|Remove|Update|Delete|Reset|Toggle)Priority|^tmPriority(?:Doc|Group)DeltaSelect/.test(name) ? 'priority'
                : ruleNames.has(name) ? 'rule'
                : /^tmScheduled(?:Create|UseSummaryTemplate|UpdateDraft|ChangeScheduleKind|SetOutputMode|SetDocumentMode|SetInsertPosition|PickDocument)$/.test(name) ? 'scheduled'
                : /^tmAgentPolicy(?:Set|Update|Add|Move|Remove|Delete|Toggle)/.test(name) ? 'policy' : '';
            const original = window[name];
            if (!domain || typeof original !== 'function') return;
            window[name] = function(...args) {
                __tmFlushSettingsInputs();
                const before = JSON.stringify(__tmSettingsDomainSnapshot(domain));
                const finish = () => {
                    const snapshot = __tmSettingsDomainSnapshot(domain);
                    if (snapshot && JSON.stringify(snapshot) !== before) {
                        const key = domain === 'rule' || domain === 'scheduled' ? `${domain}:${snapshot.id}` : domain;
                        __tmQueueSettingsSave(key, snapshot, writers[domain]);
                    }
                    __tmDecorateSettingsV2();
                };
                const result = original.apply(this, args);
                if (result?.then) return result.then((value) => { finish(); return value; });
                finish();
                return result;
            };
            if (__tmNs[name] === original) __tmNs[name] = window[name];
        });
    }
