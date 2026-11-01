    // Template definitions, editor and instance plans. Writes use the existing task mutation service.
    const __tmRunningTaskTemplateIds = new Set();

    function __tmTemplateId() {
        return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    }

    function __tmDefaultTaskTemplateLibrary() {
        const n = (id, key, children = []) => ({ id, title: __tmT(key), children });
        return { schemaVersion: 1, items: [
            { id: 'builtin-release', name: __tmT("taskTemplate.release"), defaultTopic: __tmT("taskTemplate.releaseTopic"), revision: 1, nodes: [
                n('release', 'taskTemplate.releaseRoot', [n('requirements', 'taskTemplate.requirements'),
                    n('development', 'taskTemplate.development', [n('implementation', 'taskTemplate.implementation'), n('edgeCases', 'taskTemplate.edgeCases')]),
                    n('delivery', 'taskTemplate.delivery', [n('verification', 'taskTemplate.verification'), n('releaseNotes', 'taskTemplate.releaseNotes')])]),
            ] },
            { id: 'builtin-article', name: __tmT("taskTemplate.article"), defaultTopic: __tmT("taskTemplate.articleTopic"), revision: 1, nodes: [
                n('article', 'taskTemplate.articleRoot', [n('audience', 'taskTemplate.audience'), n('writing', 'taskTemplate.writing'),
                    n('editing', 'taskTemplate.editing', [n('references', 'taskTemplate.references'), n('layout', 'taskTemplate.layout')]), n('publish', 'taskTemplate.publish')]),
            ] },
            { id: 'builtin-weekly', name: __tmT("taskTemplate.weekly"), defaultTopic: __tmT("taskTemplate.weeklyTopic"), revision: 1, nodes: [
                n('review', 'taskTemplate.reviewRoot', [n('completed', 'taskTemplate.completed'), n('lessons', 'taskTemplate.lessons'), n('unfinished', 'taskTemplate.unfinished')]),
                n('plan', 'taskTemplate.planRoot', [n('goals', 'taskTemplate.goals'), n('arrange', 'taskTemplate.arrange')]),
            ] },
        ] };
    }

    function __tmNormalizeTaskTemplateLibrary(input) {
        if (input == null) return __tmDefaultTaskTemplateLibrary();
        const items = Array.isArray(input?.items) ? input.items : [];
        const templateIds = new Set();
        return { schemaVersion: 1, items: items.slice(0, 100).filter(item => item && typeof item === 'object').map(item => {
            let id = String(item.id || '').trim();
            if (!id || templateIds.has(id)) id = __tmTemplateId();
            templateIds.add(id);
            const nodeIds = new Set();
            let count = 0;
            const nodes = (list, depth = 0) => depth > 16 ? [] : (Array.isArray(list) ? list : []).filter(value => value && typeof value === 'object').flatMap(value => {
                if (++count > 500) return [];
                let nodeId = String(value.id || '').trim();
                if (!nodeId || nodeIds.has(nodeId)) nodeId = __tmTemplateId();
                nodeIds.add(nodeId);
                return [{ id: nodeId, title: String(value.title || '').trim().slice(0, 500), children: nodes(value.children, depth + 1) }];
            });
            return { id, name: String(item.name || '').trim().slice(0, 80), defaultTopic: String(item.defaultTopic || '').slice(0, 120),
                revision: Math.max(1, Math.floor(Number(item.revision) || 1)), nodes: nodes(item.nodes) };
        }) };
    }

    function __tmTemplateFlat(nodes, parentId = '', depth = 0) {
        return (nodes || []).flatMap(node => [{ node, parentId, depth }, ...__tmTemplateFlat(node.children, node.id, depth + 1)]);
    }

    function __tmTaskTemplateLibrary() {
        return __tmNormalizeTaskTemplateLibrary(SettingsStore.data.taskTemplateLibrary);
    }

    function __tmNormalizeTaskTemplateDraft(value) {
        if (!value || typeof value !== 'object' || !Array.isArray(value.nodes)) return null;
        const template = __tmNormalizeTaskTemplateLibrary({ items: [{ id: value.templateId, name: value.name,
            defaultTopic: value.topic, revision: value.revision, nodes: value.nodes }] }).items[0];
        if (!template) return null;
        const ids = new Set(__tmTemplateFlat(template.nodes).map(entry => entry.node.id));
        return { templateId: template.id, name: template.name, revision: template.revision, topic: String(value.topic || ''), nodes: template.nodes,
            excludedIds: (Array.isArray(value.excludedIds) ? value.excludedIds : []).filter(id => ids.has(id)),
            collapsedIds: (Array.isArray(value.collapsedIds) ? value.collapsedIds : []).filter(id => ids.has(id)),
            execution: value.execution && typeof value.execution === 'object' ? value.execution : null };
    }

    function __tmTemplatePlan(instance) {
        const excluded = new Set(instance.excludedIds);
        const result = [];
        const visit = (nodes, parentId = '') => nodes.forEach(node => {
            if (excluded.has(node.id)) return;
            result.push({ id: node.id, parentId, title: node.title.split('{{主题}}').join(instance.topic.trim()).trim() });
            visit(node.children, node.id);
        });
        visit(instance.nodes);
        return result;
    }

    function __tmTemplateDraftScope(qa = state.quickAdd, templateId = qa?.templateInstance?.templateId) {
        const id = String(templateId || '').trim();
        if (!id) return '';
        const base = String(qa?.draftScope || '').trim();
        return `${base ? `${base}:` : ''}template:${id}`;
    }

    function __tmPersistTemplateInstance(qa = state.quickAdd) {
        if (!qa) return;
        if (qa.templateInstance) __tmSaveQuickAddDraft('', {
            scope: __tmTemplateDraftScope(qa), remark: '', template: qa.templateInstance,
        });
        const current = state.quickAdd === qa;
        const directDraft = current ? null : __tmGetQuickAddDraft(qa.draftScope);
        __tmSaveQuickAddDraft(current ? document.getElementById('tmQuickAddInput')?.value || '' : directDraft?.value || '', {
            scope: qa.draftScope,
            remark: current ? document.getElementById('tmQuickAddRemark')?.value || '' : directDraft?.remark || '',
        });
    }

    function __tmRestoreTemplateExecutionContext(qa) {
        const payload = qa?.templateInstance?.execution?.payload;
        if (!payload) return;
        for (const key of ['relation', 'sourceTaskId', 'docId', 'docMode', 'headingId', 'priority', 'customStatus', 'customFieldValues',
            'startDate', 'completionTime', 'dateMode', 'repeatRule', 'repeatState', 'inheritedDateFields']) {
            if (Object.prototype.hasOwnProperty.call(payload, key)) qa[key] = payload[key];
        }
    }

    function __tmTemplateCount(qa = state.quickAdd) {
        return qa?.templateInstance ? __tmTemplatePlan(qa.templateInstance).length : null;
    }

    function __tmRenderQuickAddTemplate() {
        const modal = state.quickAddModal;
        const qa = state.quickAdd;
        if (!modal || !qa) return;
        let panel = modal.querySelector('[data-tm-template-preview]');
        if (!panel) {
            panel = document.createElement('section');
            panel.dataset.tmTemplatePreview = '';
            panel.className = 'tm-task-template-preview';
            document.getElementById('tmQuickAddInput').after(panel);
            let composingTopic = false;
            const updateTopic = event => {
                if (!event.target.matches('[data-template-topic]') || composingTopic || event.isComposing || !qa.templateInstance) return;
                qa.templateInstance.topic = event.target.value;
                // Keep the topic input mounted so IME composition, focus and caret remain native.
                const nodes = new Map(__tmTemplateFlat(qa.templateInstance.nodes).map(entry => [entry.node.id, entry.node]));
                panel.querySelectorAll('.tm-task-template-row').forEach(row => {
                    const checkbox = row.querySelector('[data-template-include]');
                    const node = nodes.get(checkbox?.dataset.templateInclude);
                    if (!node) return;
                    const title = node.title.split('{{主题}}').join(qa.templateInstance.topic);
                    row.lastElementChild.textContent = title;
                    checkbox.setAttribute('aria-label', title);
                    row.querySelector('[data-template-fold]')?.setAttribute('aria-label', title);
                });
                __tmPersistTemplateInstance();
            };
            panel.addEventListener('compositionstart', event => {
                if (event.target.matches('[data-template-topic]')) composingTopic = true;
            });
            panel.addEventListener('compositionend', event => {
                if (!event.target.matches('[data-template-topic]')) return;
                composingTopic = false;
                updateTopic(event);
            });
            panel.addEventListener('input', updateTopic);
            panel.addEventListener('click', event => {
                if (event.target.closest('[data-template-plain]') && qa.templateInstance) {
                    qa.templateInstance = null;
                    __tmRenderQuickAddTemplate();
                    __tmPersistTemplateInstance();
                    return;
                }
                const fold = event.target.closest('[data-template-fold]');
                if (!fold || !qa.templateInstance) return;
                const collapsed = new Set(qa.templateInstance.collapsedIds);
                collapsed.has(fold.dataset.templateFold) ? collapsed.delete(fold.dataset.templateFold) : collapsed.add(fold.dataset.templateFold);
                qa.templateInstance.collapsedIds = [...collapsed];
                __tmRenderQuickAddTemplate();
                __tmPersistTemplateInstance();
            });
            panel.addEventListener('change', event => {
                const input = event.target.closest('[data-template-include]');
                if (!input || !qa.templateInstance) return;
                const instance = qa.templateInstance;
                const entries = __tmTemplateFlat(instance.nodes);
                const entry = entries.find(item => item.node.id === input.dataset.templateInclude);
                const excluded = new Set(instance.excludedIds);
                const affected = entry ? __tmTemplateFlat([entry.node]) : entries;
                affected.forEach(item => input.checked ? excluded.delete(item.node.id) : excluded.add(item.node.id));
                if (input.checked && entry) {
                    let parentId = entry.parentId;
                    while (parentId) { excluded.delete(parentId); parentId = entries.find(item => item.node.id === parentId)?.parentId || ''; }
                }
                instance.excludedIds = [...excluded];
                __tmRenderQuickAddTemplate();
                __tmPersistTemplateInstance();
            });
        }
        const instance = qa.templateInstance;
        const input = document.getElementById('tmQuickAddInput');
        input.hidden = !!instance;
        panel.hidden = !instance;
        const tools = modal.querySelector('.tm-quick-add-tools');
        if (tools) tools.inert = !!qa.initializing || !!instance?.execution;
        __tmRenderQuickAddCustomFields();
        __tmApplyQuickAddFieldVisibility();
        if (!instance) {
            __tmRefreshQuickAddInputLayout(modal);
            return;
        }
        const active = document.activeElement;
        const editingTopic = panel.contains(active) && active.matches('[data-template-topic]');
        const selection = editingTopic ? [active.selectionStart, active.selectionEnd] : null;
        const collapsed = new Set(instance.collapsedIds);
        const excluded = new Set(instance.excludedIds);
        const executing = !!instance.execution;
        let rows = '';
        const visit = (nodes, depth = 0) => nodes.forEach(node => {
            const title = node.title.split('{{主题}}').join(instance.topic);
            rows += `<div class="tm-task-template-row" style="--template-depth:${depth}">${node.children.length
                ? `<button type="button" class="tm-task-template-fold" data-template-fold="${esc(node.id)}" aria-label="${esc(title)}" aria-expanded="${!collapsed.has(node.id)}">${__tmRenderLucideIcon(collapsed.has(node.id) ? 'chevron-right' : 'caret-down')}</button>`
                : '<span class="tm-task-template-fold"></span>'}<input type="checkbox" data-template-include="${esc(node.id)}" ${excluded.has(node.id) ? '' : 'checked'} ${executing ? 'disabled' : ''} aria-label="${esc(title)}"><span${excluded.has(node.id) ? ' class="is-excluded"' : ''}>${esc(title)}</span></div>`;
            if (!collapsed.has(node.id)) visit(node.children, depth + 1);
        });
        visit(instance.nodes);
        panel.innerHTML = `<div class="tm-task-template-preview-head"><strong>${esc(instance.name)}</strong><div class="tm-task-template-preview-actions"><button type="button" class="tm-task-template-direct" data-template-plain>${__tmRenderLucideIcon('list-bullets')}<span>${__tmT("taskTemplate.direct")}</span></button><label><input type="checkbox" data-template-include="all" ${executing ? 'disabled' : ''}>${__tmT("taskTemplate.selectAll")}</label></div></div><div class="tm-task-template-preview-tree">${rows}</div><label class="tm-task-template-topic">${__tmT("taskTemplate.topic")}<input type="text" data-template-topic maxlength="120" value="${esc(instance.topic)}" ${executing ? 'disabled' : ''}></label>${instance.execution?.error ? `<p class="tm-task-template-error" role="alert">${esc(instance.execution.error)}</p>` : ''}`;
        const all = panel.querySelector('[data-template-include="all"]');
        const total = __tmTemplateFlat(instance.nodes).length;
        all.checked = excluded.size === 0;
        all.indeterminate = excluded.size > 0 && excluded.size < total;
        if (editingTopic) {
            const topic = panel.querySelector('[data-template-topic]');
            topic.focus({ preventScroll: true }); topic.setSelectionRange(...selection);
        }
        __tmRefreshQuickAddInputLayout(modal);
    }

    window.tmQuickAddOpenTemplatePicker = function() {
        const qa = state.quickAdd;
        const anchor = document.getElementById('tmQuickAddMoreBtn');
        if (!qa || !anchor || qa.templateSubmitting) return;
        __tmOpenInlineEditor(anchor, ({ editor, close }) => {
            editor.classList.add('tm-task-template-picker');
            const library = __tmTaskTemplateLibrary();
            editor.innerHTML = `<input type="search" class="tm-prompt-input" data-template-search placeholder="${esc(__tmT("taskTemplate.search"))}" aria-label="${esc(__tmT("taskTemplate.search"))}"><div data-template-options></div><button type="button" class="tm-quick-add-menu-row" data-template-manage>${__tmRenderLucideIcon('settings')}<span>${__tmT("taskTemplate.manage")}</span></button>`;
            const render = () => {
                const query = editor.querySelector('[data-template-search]').value.trim().toLowerCase();
                const items = library.items.filter(item => item.name.toLowerCase().includes(query));
                editor.querySelector('[data-template-options]').innerHTML = items.map(item => `<button type="button" class="tm-quick-add-menu-row" data-template-use="${esc(item.id)}" ${qa.templateInstance?.execution || __tmRunningTaskTemplateIds.has(item.id) ? 'disabled' : ''}><span>${esc(item.name)}</span><small>${__tmTemplateFlat(item.nodes).length}</small></button>`).join('')
                    || `<p class="tm-task-template-empty">${__tmT("taskTemplate.noTemplates")}</p>`;
            };
            editor.addEventListener('input', render);
            editor.addEventListener('click', async event => {
                const use = event.target.closest('[data-template-use]');
                if (use && !use.disabled) {
                    close();
                    await window.tmQuickAddUseTemplate(use.dataset.templateUse);
                } else if (event.target.closest('[data-template-manage]')) {
                    close(); window.tmOpenTaskTemplateManager();
                }
            });
            render();
        }, { autoFocus: !__tmIsMobileDevice() });
    };

    window.tmQuickAddUseTemplate = async function(templateId) {
        const qa = state.quickAdd;
        const id = String(templateId || '').trim();
        if (!qa || !id || __tmRunningTaskTemplateIds.has(id)) return false;
        const template = __tmTaskTemplateLibrary().items.find(item => item.id === id);
        if (!template) return false;
        const savedDraft = __tmGetQuickAddDraft(__tmTemplateDraftScope(qa, template.id));
        const savedInstance = savedDraft?.template ? __tmNormalizeTaskTemplateDraft(savedDraft.template) : null;
        qa.templateInstance = savedInstance && (savedInstance.execution || savedInstance.revision === template.revision)
            ? savedInstance
            : __tmNormalizeTaskTemplateDraft({ templateId: template.id, name: template.name, revision: template.revision,
                topic: template.defaultTopic, nodes: template.nodes });
        if (qa.reminderDraft) {
            qa.reminderDraft = null;
            hint(__tmT("taskTemplate.reminderAfterCreation"), 'warning');
        }
        if (qa.templateInstance.execution) {
            const docId = qa.templateInstance.execution.payload?.docId;
            if (docId && docId !== qa.docId) await __tmRefreshQuickAddCustomFieldScope(docId);
            if (state.quickAdd !== qa) return false;
            __tmRestoreTemplateExecutionContext(qa);
            window.tmQuickAddRenderMeta?.();
        }
        __tmRenderQuickAddTemplate();
        __tmPersistTemplateInstance();
        return true;
    };

    let __tmTaskTemplateManager = null;

    function __tmCloseTaskTemplateManager(force = false) {
        const manager = __tmTaskTemplateManager;
        if (!manager) return true;
        if (manager.saving) return false;
        if (!force && manager.dirty) {
            manager.dialog.querySelector('[data-template-discard]').hidden = false;
            return false;
        }
        manager.unstack?.();
        manager.cleanup?.();
        manager.dialog.remove();
        manager.modal.hidden = manager.wasHidden;
        manager.modal.inert = manager.wasInert;
        __tmTaskTemplateManager = null;
        document.getElementById('tmQuickAddMoreBtn')?.focus({ preventScroll: true });
        return true;
    }

    window.tmOpenTaskTemplateManager = function() {
        const modal = state.quickAddModal;
        if (!modal || __tmTaskTemplateManager || state.quickAdd?.templateSubmitting) return;
        const library = __tmTaskTemplateLibrary();
        const dialog = document.createElement('div');
        dialog.className = 'tm-task-template-modal';
        dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', __tmT("taskTemplate.manage"));
        dialog.innerHTML = `<div class="tm-task-template-manager"><header><h2>${__tmT("taskTemplate.manage")}</h2><button type="button" class="tm-task-template-icon" data-template-close aria-label="${esc(__tmT("taskTemplate.close"))}">${__tmRenderLucideIcon('x')}</button></header><div class="tm-task-template-manager-body"><aside><div class="tm-task-template-library-head"><span>${__tmT("taskTemplate.templates")}</span><button type="button" data-template-new>${__tmT("taskTemplate.new")}</button></div><select data-template-mobile-list aria-label="${esc(__tmT("taskTemplate.templates"))}"></select><div class="tm-task-template-mobile-order" role="group" aria-label="${esc(__tmT("taskTemplate.templates"))}"><button type="button" class="tm-task-template-icon" data-template-order-mobile="up" disabled>${__tmRenderLucideIcon('arrow-up')}</button><button type="button" class="tm-task-template-icon" data-template-order-mobile="down" disabled>${__tmRenderLucideIcon('arrow-down')}</button></div><div data-template-list></div></aside><section data-template-editor></section></div><p class="tm-task-template-error" data-template-manager-error role="alert" hidden></p><div class="tm-task-template-discard" data-template-discard hidden><span>${__tmT("taskTemplate.discardQuestion")}</span><button type="button" data-template-keep>${__tmT("taskTemplate.keepEditing")}</button><button type="button" data-template-discard-confirm>${__tmT("taskTemplate.discard")}</button></div><footer><small data-template-save-status></small><div><button type="button" class="tm-btn tm-btn-secondary" data-template-close>${__tmT("common.cancel")}</button><button type="button" class="tm-btn tm-btn-primary" data-template-save disabled>${__tmT("common.save")}</button></div></footer></div>`;
        const manager = { dialog, modal, wasHidden: modal.hidden, wasInert: modal.inert, library,
            baseline: JSON.stringify(library), activeId: library.items.find(item => item.id === state.quickAdd?.templateInstance?.templateId)?.id || library.items[0]?.id || '',
            dirty: false, saving: false, undo: [], collapsed: new Set() };
        __tmTaskTemplateManager = manager;
        modal.hidden = true; modal.inert = true;
        document.body.appendChild(dialog);
        const syncViewport = () => {
            const viewport = window.visualViewport;
            Object.assign(dialog.style, { inset: 'auto', left: `${viewport?.offsetLeft || 0}px`, top: `${viewport?.offsetTop || 0}px`,
                width: `${viewport?.width || window.innerWidth}px`, height: `${viewport?.height || window.innerHeight}px` });
        };
        syncViewport();
        window.addEventListener('resize', syncViewport);
        window.visualViewport?.addEventListener('resize', syncViewport);
        window.visualViewport?.addEventListener('scroll', syncViewport);
        manager.cleanup = () => {
            window.removeEventListener('resize', syncViewport);
            window.visualViewport?.removeEventListener('resize', syncViewport);
            window.visualViewport?.removeEventListener('scroll', syncViewport);
        };
        manager.unstack = __tmModalStackBind(() => __tmCloseTaskTemplateManager());
        const activeTemplate = () => manager.library.items.find(item => item.id === manager.activeId);
        const markDirty = () => {
            manager.dirty = true;
            dialog.querySelector('[data-template-save]').disabled = false;
            dialog.querySelector('[data-template-save-status]').textContent = __tmT("taskTemplate.unsaved");
            dialog.querySelector('[data-template-manager-error]').hidden = true;
        };
        const moveTemplate = (templateId, direction) => {
            const index = manager.library.items.findIndex(item => item.id === templateId);
            const target = index + (direction === 'up' ? -1 : 1);
            if (index < 0 || target < 0 || target >= manager.library.items.length) return;
            const [item] = manager.library.items.splice(index, 1);
            manager.library.items.splice(target, 0, item);
            manager.activeId = item.id;
            markDirty();
            renderEditor();
        };
        const renderList = () => {
            dialog.querySelector('[data-template-list]').innerHTML = manager.library.items.map((item, index) => `<div class="tm-task-template-library-row"><button type="button" class="tm-task-template-library-item" data-template-edit="${esc(item.id)}" aria-pressed="${item.id === manager.activeId}"><span>${esc(item.name)}</span><small>${__tmTemplateFlat(item.nodes).length}</small></button><div class="tm-task-template-library-order"><button type="button" class="tm-task-template-icon" data-template-order="up" data-template-id="${esc(item.id)}" aria-label="${esc(__tmT("taskTemplate.moveUp", { name: item.name }))}" title="${esc(__tmT("taskTemplate.moveUp", { name: item.name }))}" ${index === 0 ? 'disabled' : ''}>${__tmRenderLucideIcon('arrow-up')}</button><button type="button" class="tm-task-template-icon" data-template-order="down" data-template-id="${esc(item.id)}" aria-label="${esc(__tmT("taskTemplate.moveDown", { name: item.name }))}" title="${esc(__tmT("taskTemplate.moveDown", { name: item.name }))}" ${index === manager.library.items.length - 1 ? 'disabled' : ''}>${__tmRenderLucideIcon('arrow-down')}</button></div></div>`).join('');
            const select = dialog.querySelector('[data-template-mobile-list]');
            select.innerHTML = manager.library.items.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
            select.value = manager.activeId;
            const activeIndex = manager.library.items.findIndex(item => item.id === manager.activeId);
            const active = manager.library.items[activeIndex];
            const up = dialog.querySelector('[data-template-order-mobile="up"]');
            const down = dialog.querySelector('[data-template-order-mobile="down"]');
            up.disabled = activeIndex <= 0;
            down.disabled = activeIndex < 0 || activeIndex >= manager.library.items.length - 1;
            const upLabel = __tmT("taskTemplate.moveUp", { name: active?.name || '' });
            const downLabel = __tmT("taskTemplate.moveDown", { name: active?.name || '' });
            up.title = upLabel;
            up.setAttribute('aria-label', upLabel);
            down.title = downLabel;
            down.setAttribute('aria-label', downLabel);
        };
        const renderEditor = (focusId = '') => {
            renderList();
            const template = activeTemplate();
            const editor = dialog.querySelector('[data-template-editor]');
            if (!template) { editor.innerHTML = `<p class="tm-task-template-empty">${__tmT("taskTemplate.noTemplates")}</p>`; return; }
            const last = manager.undo.filter(item => item.templateId === template.id).at(-1);
            let rows = '';
            const visit = (nodes, depth = 0) => nodes.forEach(node => {
                rows += `<div class="tm-task-template-edit-row" data-template-node="${esc(node.id)}" style="--template-depth:${depth}"><div>${node.children.length ? `<button type="button" class="tm-task-template-fold" data-template-edit-fold aria-expanded="${!manager.collapsed.has(node.id)}" aria-label="${esc(node.title)}">${__tmRenderLucideIcon(manager.collapsed.has(node.id) ? 'chevron-right' : 'caret-down')}</button>` : '<span class="tm-task-template-fold"></span>'}<input type="text" data-template-node-title value="${esc(node.title)}" maxlength="500" aria-label="${esc(__tmT("taskTemplate.taskTitle"))}"></div><div><button type="button" class="tm-task-template-icon" data-template-child title="${esc(__tmT("taskTemplate.addChild"))}" aria-label="${esc(__tmT("taskTemplate.addChild"))}">${__tmRenderLucideIcon('plus')}</button><button type="button" class="tm-task-template-icon" data-template-delete-node title="${esc(__tmT("taskTemplate.deleteBranch"))}" aria-label="${esc(__tmT("taskTemplate.deleteBranch"))}">${__tmRenderLucideIcon('trash-2')}</button></div></div>`;
                if (!manager.collapsed.has(node.id)) visit(node.children, depth + 1);
            });
            visit(template.nodes);
            editor.innerHTML = `<div class="tm-task-template-name"><label>${__tmT("taskTemplate.name")}<input type="text" data-template-name value="${esc(template.name)}" maxlength="80"></label><button type="button" data-template-copy>${__tmT("task.copy")}</button><button type="button" data-template-delete>${__tmT("common.delete")}</button></div><div class="tm-task-template-delete-confirm" data-template-delete-confirm hidden><span>${__tmT("taskTemplate.deleteQuestion")}</span><button type="button" data-template-delete-cancel>${__tmT("common.cancel")}</button><button type="button" data-template-delete-confirmed>${__tmT("common.delete")}</button></div><div class="tm-task-template-editor-scroll"><div class="tm-task-template-columns"><span>${__tmT("taskTemplate.taskTitle")}</span><span>${__tmT("taskTemplate.actions")}</span></div>${last ? `<div class="tm-task-template-undo">${__tmT("taskTemplate.deletedNodes", { count: last.count })}<button type="button" data-template-undo>${__tmT("taskTemplate.undo")}</button></div>` : ''}<div data-template-edit-tree>${rows}</div><button type="button" class="tm-task-template-add-root" data-template-add-root>${__tmT("taskTemplate.addRoot")}</button><details class="tm-task-template-default-topic"><summary>${__tmT("taskTemplate.defaultTopic")}<small>${__tmT("taskTemplate.topicSyntaxShort")}</small></summary><input type="text" data-template-default-topic value="${esc(template.defaultTopic)}" maxlength="120" placeholder="${esc(__tmT("taskTemplate.defaultTopicExample"))}" aria-label="${esc(__tmT("taskTemplate.defaultTopic"))}"><p>${__tmT("taskTemplate.topicHint")}</p></details></div>`;
            if (focusId) { const input = [...editor.querySelectorAll('[data-template-node]')].find(row => row.dataset.templateNode === focusId)?.querySelector('input'); input?.focus(); input?.select(); }
        };
        dialog.addEventListener('input', event => {
            const template = activeTemplate();
            if (!template || manager.saving) return;
            if (event.target.matches('[data-template-name]')) { template.name = event.target.value; renderList(); }
            else if (event.target.matches('[data-template-default-topic]')) template.defaultTopic = event.target.value;
            else if (event.target.matches('[data-template-node-title]')) {
                const entry = __tmTemplateFlat(template.nodes).find(item => item.node.id === event.target.closest('[data-template-node]').dataset.templateNode);
                if (entry) entry.node.title = event.target.value;
            } else return;
            markDirty();
        });
        dialog.addEventListener('change', event => {
            if (event.target.matches('[data-template-mobile-list]')) { manager.activeId = event.target.value; renderEditor(); }
        });
        dialog.addEventListener('click', async event => {
            const button = event.target.closest('button');
            if (!button || manager.saving) return;
            if (button.matches('[data-template-close]')) { __tmCloseTaskTemplateManager(); return; }
            if (button.matches('[data-template-keep]')) { dialog.querySelector('[data-template-discard]').hidden = true; return; }
            if (button.matches('[data-template-discard-confirm]')) { __tmCloseTaskTemplateManager(true); return; }
            if (button.matches('[data-template-edit]')) { manager.activeId = button.dataset.templateEdit; renderEditor(); return; }
            if (button.matches('[data-template-order], [data-template-order-mobile]')) {
                moveTemplate(button.dataset.templateId || manager.activeId, button.dataset.templateOrder || button.dataset.templateOrderMobile);
                return;
            }
            if (button.matches('[data-template-new]')) {
                const item = { id: __tmTemplateId(), name: __tmT("taskTemplate.untitled"), defaultTopic: '', revision: 1,
                    nodes: [{ id: __tmTemplateId(), title: __tmT("taskTemplate.newTask"), children: [] }] };
                manager.library.items.push(item); manager.activeId = item.id; markDirty(); renderEditor();
                const input = dialog.querySelector('[data-template-name]'); input.focus(); input.select(); return;
            }
            if (button.matches('[data-template-save]')) {
                const error = dialog.querySelector('[data-template-manager-error]');
                try {
                    if (manager.library.items.length > 100) throw new Error(__tmT("taskTemplate.limit"));
                    manager.library.items.forEach(item => {
                        const nodes = __tmTemplateFlat(item.nodes);
                        if (nodes.length > 500 || nodes.some(entry => entry.depth > 16)) throw new Error(__tmT("taskTemplate.limit"));
                        if (!item.name.trim() || !item.nodes.length || nodes.some(entry => !entry.node.title.trim())) throw new Error(__tmT("taskTemplate.invalid"));
                    });
                    if (JSON.stringify(__tmTaskTemplateLibrary()) !== manager.baseline) throw new Error(__tmT("taskTemplate.changedElsewhere"));
                    const next = __tmNormalizeTaskTemplateLibrary(manager.library);
                    next.items.forEach(item => {
                        const old = __tmTaskTemplateLibrary().items.find(value => value.id === item.id);
                        if (old && JSON.stringify({ ...old, revision: 0 }) !== JSON.stringify({ ...item, revision: 0 })) item.revision = old.revision + 1;
                    });
                    const previous = SettingsStore.data.taskTemplateLibrary;
                    manager.saving = true; button.disabled = true;
                    dialog.querySelector('.tm-task-template-manager-body').inert = true;
                    SettingsStore.data.taskTemplateLibrary = next;
                    try {
                        await SettingsStore.saveTaskTemplates(next);
                        const receipt = SettingsStore.lastSaveResult;
                        if (!receipt?.ok || receipt.codeOk === false || receipt.taskTemplateFingerprint !== JSON.stringify(next)) throw new Error(__tmT("taskTemplate.saveFailed"));
                    } catch (failure) {
                        if (JSON.stringify(SettingsStore.data.taskTemplateLibrary) === JSON.stringify(next)) {
                            SettingsStore.data.taskTemplateLibrary = previous;
                            if (SettingsStore.loadedSettingsFieldSnapshot) SettingsStore.loadedSettingsFieldSnapshot.taskTemplateLibrary = previous;
                            Storage.set('tm_task_template_library', previous);
                        }
                        throw failure;
                    }
                    manager.saving = false; manager.dirty = false;
                    __tmCloseTaskTemplateManager(true);
                    hint(__tmT("taskTemplate.saved"), 'success');
                } catch (failure) {
                    manager.saving = false; button.disabled = false;
                    dialog.querySelector('.tm-task-template-manager-body').inert = false;
                    error.textContent = String(failure.message || failure); error.hidden = false;
                }
                return;
            }
            const template = activeTemplate();
            if (!template) return;
            if (button.matches('[data-template-copy]')) {
                const copy = JSON.parse(JSON.stringify(template)); copy.id = __tmTemplateId();
                copy.name = __tmT("taskTemplate.copyName", { name: copy.name });
                __tmTemplateFlat(copy.nodes).forEach(entry => entry.node.id = __tmTemplateId());
                manager.library.items.push(copy); manager.activeId = copy.id; markDirty(); renderEditor(); return;
            }
            if (button.matches('[data-template-delete]')) { dialog.querySelector('[data-template-delete-confirm]').hidden = false; return; }
            if (button.matches('[data-template-delete-cancel]')) { dialog.querySelector('[data-template-delete-confirm]').hidden = true; return; }
            if (button.matches('[data-template-delete-confirmed]')) {
                const index = manager.library.items.indexOf(template); manager.library.items.splice(index, 1);
                manager.activeId = manager.library.items[Math.min(index, manager.library.items.length - 1)]?.id || '';
                markDirty(); renderEditor(); return;
            }
            if (button.matches('[data-template-add-root]')) {
                const node = { id: __tmTemplateId(), title: __tmT("taskTemplate.newTask"), children: [] };
                template.nodes.push(node); markDirty(); renderEditor(node.id); return;
            }
            if (button.matches('[data-template-undo]')) {
                const index = manager.undo.findLastIndex(item => item.templateId === template.id);
                const undo = manager.undo[index];
                if (!undo) return;
                const parent = undo.parentId ? __tmTemplateFlat(template.nodes).find(item => item.node.id === undo.parentId)?.node : null;
                if (undo.parentId && !parent) return;
                (parent ? parent.children : template.nodes).splice(undo.index, 0, undo.node);
                manager.undo.splice(index, 1); markDirty(); renderEditor(undo.node.id); return;
            }
            const row = button.closest('[data-template-node]');
            const entry = row && __tmTemplateFlat(template.nodes).find(item => item.node.id === row.dataset.templateNode);
            if (!entry) return;
            if (button.matches('[data-template-edit-fold]')) {
                manager.collapsed.has(entry.node.id) ? manager.collapsed.delete(entry.node.id) : manager.collapsed.add(entry.node.id); renderEditor();
            } else if (button.matches('[data-template-child]')) {
                const node = { id: __tmTemplateId(), title: __tmT("taskTemplate.newTask"), children: [] };
                entry.node.children.push(node); manager.collapsed.delete(entry.node.id); markDirty(); renderEditor(node.id);
            } else if (button.matches('[data-template-delete-node]')) {
                const parent = entry.parentId ? __tmTemplateFlat(template.nodes).find(item => item.node.id === entry.parentId).node : null;
                const siblings = parent ? parent.children : template.nodes;
                const index = siblings.indexOf(entry.node);
                manager.undo.push({ templateId: template.id, parentId: entry.parentId, index, node: entry.node, count: __tmTemplateFlat([entry.node]).length });
                siblings.splice(index, 1); markDirty(); renderEditor();
            }
        });
        dialog.addEventListener('keydown', event => {
            if (event.key === 'Tab') {
                const controls = [...dialog.querySelectorAll('button,input,select,summary')].filter(element => !element.disabled && element.getClientRects().length);
                if (controls.length && event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
                else if (controls.length && !event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
            }
        });
        renderEditor();
        dialog.querySelector('[data-template-close]').focus({ preventScroll: true });
    };

    async function __tmExecuteTaskTemplatePlan(instance, payload, persist = () => __tmPersistTemplateInstance()) {
        if (!instance.execution) {
            const plan = __tmTemplatePlan(instance);
            if (!plan.length || plan.some(item => !item.title)) throw new Error(__tmT("taskTemplate.invalid"));
            instance.execution = { payload, steps: plan.map(item => ({ ...item, requestedTaskId: __tmNewTaskBlockId(), requestedContainerId: __tmNewTaskBlockId(), status: 'pending' })), targetDocId: '', insertOptions: null, error: '' };
            persist();
        }
        const execution = instance.execution;
        execution.payload = { ...execution.payload, completionTime: '', dateMode: 'manual', pinned: false };
        payload = execution.payload;
        if (!execution.targetDocId) {
            let docId = payload.docId;
            if (payload.docMode === 'dailyNote') {
                let notebook = __tmResolveConfiguredDailyNoteNotebookId();
                if (!notebook) { await __tmRefreshNotebookCache(); notebook = __tmResolveConfiguredDailyNoteNotebookId(); }
                if (!notebook && docId) notebook = await API.getDocNotebook(docId);
                if (!notebook) throw new Error(__tmT("task.unableToDetermineTheDailyNoteSNotebook"));
                docId = await API.createDailyNote(notebook);
            }
            if (!docId) throw new Error(__tmT("task.noDocumentSet"));
            execution.targetDocId = docId;
            persist();
        }
        if (!execution.insertOptions) {
            execution.insertOptions = payload.relation ? {} : await __tmResolveDefaultNewTaskInsertOptions(execution.targetDocId, payload.docMode, {
                contentCount: execution.steps.filter(step => !step.parentId).length, headingId: payload.headingId,
            });
            persist();
        }
        const roots = execution.steps.filter(step => !step.parentId);
        const reverse = payload.relation === 'sibling' || !!execution.insertOptions?.insertAfterId;
        const order = [];
        const visit = step => { order.push(step); execution.steps.filter(child => child.parentId === step.id).forEach(visit); };
        (reverse ? roots.slice().reverse() : roots).forEach(visit);
        for (const step of order) {
            if (step.status === 'done') continue;
            // Stable IDs make retries safe even when the previous request committed before its response failed.
            if (!/^\d{14}-[a-z0-9]{7}$/i.test(step.requestedTaskId) || !/^\d{14}-[a-z0-9]{7}$/i.test(step.requestedContainerId)) throw new Error(__tmT("taskTemplate.invalid"));
            const parent = step.parentId ? execution.steps.find(item => item.id === step.parentId) : null;
            if (parent && parent.status !== 'done') throw new Error(__tmT("taskTemplate.parentPending"));
            const first = step.id === execution.steps[0].id;
            const { headingPatch, ...placement } = execution.insertOptions || {};
            const taskPayload = { ...payload, ...placement, docId: execution.targetDocId, content: step.title,
                requestedTaskId: step.requestedTaskId, requestedContainerId: step.requestedContainerId,
                remark: first ? payload.remark : '', attachments: first ? payload.attachments : [], wait: true, showErrorHint: false };
            const kind = parent || payload.relation === 'subtask' ? 'createSubtask' : payload.relation === 'sibling' ? 'createSibling' : 'createTaskInDoc';
            const create = globalThis.__tmRequireTaskMutation(kind);
            const id = kind === 'createTaskInDoc' ? await create(taskPayload) : await create(parent?.realId || payload.sourceTaskId, step.title, {
                requestedTaskId: step.requestedTaskId, requestedContainerId: step.requestedContainerId,
                initialPatch: { priority: '', customStatus: '', startDate: '', completionTime: '', customFieldValues: {}, ...__tmBuildCreateTaskInDocAttrPatchFromPayload(taskPayload) },
                inheritedDateFields: payload.inheritedDateFields || [], silent: true, wait: true, skipInteractionGate: true,
            });
            if (!id) throw new Error(__tmT("taskTemplate.createFailed"));
            step.realId = id; step.status = 'done';
            if (headingPatch) __tmApplyHeadingPatchToTaskLocal(id, headingPatch, 'task-template-create');
            persist();
        }
        return execution.steps.length;
    }

    async function __tmQuickAddSubmitTemplate() {
        const qa = state.quickAdd;
        const instance = qa?.templateInstance;
        if (!instance || qa.templateSubmitting) return;
        const templateId = String(instance.templateId || '').trim();
        if (!templateId || __tmRunningTaskTemplateIds.has(templateId)) return;
        const modal = state.quickAddModal;
        const compose = modal.querySelector('.tm-quick-add-compose-view');
        qa.templateSubmitting = true; state.quickAddSubmitting = true; compose.inert = true;
        modal.querySelector('#tmQuickAddCloseBtn').disabled = true;
        const images = Array.isArray(qa.images) ? qa.images.slice() : [];
        const payload = { relation: qa.relation, sourceTaskId: qa.sourceTaskId, docId: qa.docId, docMode: qa.docMode, headingId: qa.headingId,
            priority: qa.priority, customStatus: qa.customStatus, customFieldValues: __tmNormalizeQuickAddCustomFieldValues(qa.customFieldValues || {}),
            startDate: qa.startDate || '', completionTime: '', dateMode: 'manual', pinned: false, repeatRule: qa.repeatRule, repeatState: qa.repeatState,
            inheritedDateFields: qa.inheritedDateFields || [], remark: '' };
        const scope = __tmTemplateDraftScope(qa, templateId);
        const persist = () => __tmPersistTemplateInstance(qa);
        __tmRunningTaskTemplateIds.add(templateId);
        __tmDetachQuickAddImagesForTemplate(qa, images);
        qa.templateSubmitting = false; state.quickAddSubmitting = false;
        window.tmQuickAddClose();
        hint(__tmT("taskTemplate.creatingInBackground"), 'info', { duration: 6000 });
        setTimeout(async () => {
            let uploadComplete = false;
            try {
                const savedAttachments = instance.execution?.payload?.attachments;
                const attachments = Array.isArray(savedAttachments) ? savedAttachments
                    : images.length ? await __tmUploadQuickAddImages({ images }) : [];
                uploadComplete = true;
                const count = await __tmExecuteTaskTemplatePlan(instance, { ...payload, attachments }, persist);
                const submitted = __tmGetQuickAddDraft(scope);
                __tmClearQuickAddDraft(submitted);
                if (images.length) __tmClearSubmittedQuickAddImages(qa.draftScope, images);
                hint(__tmT("task.createdTasks", { length: count }), 'success');
            } catch (error) {
                const done = instance.execution?.steps?.filter(step => step.status === 'done').length || 0;
                const total = instance.execution?.steps?.length || __tmTemplatePlan(instance).length;
                const message = __tmT("taskTemplate.partialFailure", { done, remaining: total - done, message: String(error?.message || error) });
                if (instance.execution) instance.execution.error = message;
                if (uploadComplete && images.length) __tmClearSubmittedQuickAddImages(qa.draftScope, images);
                else __tmRestoreQuickAddImagesAfterTemplateFailure(qa.draftScope, images);
                persist();
                hint(message, 'warning');
            } finally {
                __tmRunningTaskTemplateIds.delete(templateId);
                const search = document.querySelector('.tm-task-template-picker [data-template-search]');
                if (search) search.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, 0);
        return true;
    }
