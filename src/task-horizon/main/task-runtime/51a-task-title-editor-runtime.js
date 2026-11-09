    // 名称的编辑值始终是源内容；纯文本只用于展示和检索。
    let __tmTaskTitleLute = null;
    let __tmTaskTitlePopover = null;
    function __tmGetTaskTitleMarkdown(task) {
        const markdown = String(task?.markdown || '').trim();
        return String((markdown && API.extractTaskContentLine(markdown)) || task?.content || '').trim();
    }

    function __tmGetTaskTitleLute() {
        if (__tmTaskTitleLute) return __tmTaskTitleLute;
        const engine = globalThis.Lute || globalThis.window?.Lute;
        if (typeof engine?.New !== 'function') return null;
        const lute = engine.New();
        for (const [method, value] of [
            ['SetTextMark', true], ['SetHTMLTag2TextMark', true], ['SetBlockRef', true],
            ['SetKramdownIAL', true], ['SetLinkRef', false], ['SetSanitize', true],
            // 标题不是正在输入 Markdown 的 Protyle，避免对代码字面内容做二次解析。
            ['SetProtyleWYSIWYG', false],
        ]) lute[method]?.(value);
        __tmTaskTitleLute = lute;
        return lute;
    }

    function __tmCleanTaskTitleInlineHtml(html, editable = false) {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        template.content.querySelectorAll('script,style,iframe,object,embed,form,input,button').forEach(el => el.remove());
        template.content.querySelectorAll('a[href]').forEach(anchor => {
            const link = document.createElement('span');
            link.setAttribute('data-type', 'a');
            link.setAttribute('data-href', anchor.getAttribute('href'));
            if (anchor.hasAttribute('title')) link.setAttribute('data-title', anchor.getAttribute('title'));
            if (anchor.hasAttribute('style')) link.setAttribute('style', anchor.getAttribute('style'));
            link.append(...Array.from(anchor.childNodes));
            anchor.replaceWith(link);
        });
        template.content.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (/^on/i.test(attr.name) || /^(?:contenteditable|tabindex|role|aria-.+|data-tm-.+)$/.test(attr.name)) el.removeAttribute(attr.name);
                if (/^(?:href|src|data-href)$/.test(attr.name) && /^\s*(?:javascript|vbscript|data):/i.test(attr.value)) el.removeAttribute(attr.name);
            });
            if (el.matches('[data-type~="a"], [data-type~="block-ref"]')) {
                if (editable) {
                    el.setAttribute('contenteditable', 'false');
                    el.tabIndex = 0;
                    el.setAttribute('role', 'button');
                    el.setAttribute('aria-label', __tmT('title.editLink'));
                }
            }
        });
        return template.innerHTML;
    }

    function __tmTaskTitleInlineFromDOM(html) {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        return template.content.querySelector('[contenteditable="true"]')?.innerHTML || '';
    }

    function __tmTaskTitleInlineFromMarkdown(markdown) {
        const lute = __tmGetTaskTitleLute();
        if (!lute) return null;
        const source = String(markdown || '');
        const native = document.createElement('template');
        native.innerHTML = source;
        const protectedNodes = new Map();
        let prefix = 'TMTitleNative';
        while (source.includes(prefix)) prefix += 'X';
        native.content.querySelectorAll('span[data-type]').forEach(node => {
            if (node.parentElement?.closest('span[data-type]')) return;
            const token = `${prefix}${protectedNodes.size}End`;
            protectedNodes.set(token, node.outerHTML);
            node.replaceWith(document.createTextNode(token));
        });
        const template = document.createElement('template');
        template.innerHTML = lute.InlineMd2BlockDOM(protectedNodes.size ? native.innerHTML : source);
        // 标准模式保护代码字面值，但把行内 HTML 渲染成占位块；整体还原原生 span。
        const fragments = [];
        template.content.querySelectorAll('[data-type="NodeHTMLBlock"]').forEach(block => {
            const html = block.querySelector('protyle-html[data-content]')?.getAttribute('data-content');
            if (html === undefined) return;
            const marker = `tm-title-inline-${fragments.length}`;
            fragments.push({ marker, html });
            block.replaceWith(document.createComment(marker));
        });
        let dom = template.innerHTML;
        for (const { marker, html } of fragments) dom = dom.replace(`<!--${marker}-->`, () => html);
        template.innerHTML = __tmTaskTitleInlineFromDOM(dom);
        const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        for (const text of textNodes) {
            if (!text.data.includes(prefix)) continue;
            if (text.parentElement?.closest('[data-type~="code"]')) {
                for (const [token, html] of protectedNodes) text.data = text.data.replaceAll(token, html);
                continue;
            }
            const result = document.createDocumentFragment();
            let remaining = text.data;
            while (remaining) {
                let match = null;
                for (const [token, html] of protectedNodes) {
                    const index = remaining.indexOf(token);
                    if (index >= 0 && (!match || index < match.index)) match = { token, html, index };
                }
                if (!match) { result.appendChild(document.createTextNode(remaining)); break; }
                result.appendChild(document.createTextNode(remaining.slice(0, match.index)));
                const fragment = document.createElement('template'); fragment.innerHTML = match.html;
                result.appendChild(fragment.content);
                remaining = remaining.slice(match.index + match.token.length);
            }
            text.replaceWith(result);
        }
        return __tmCleanTaskTitleInlineHtml(template.innerHTML);
    }

    function __tmSerializeTaskTitleInline(html) {
        const lute = __tmGetTaskTitleLute();
        if (!lute) throw new Error(__tmT('title.editorUnavailable'));
        const paragraph = document.createElement('div');
        paragraph.setAttribute('data-type', 'NodeParagraph');
        const content = paragraph.appendChild(document.createElement('div'));
        content.setAttribute('contenteditable', 'true');
        content.innerHTML = __tmCleanTaskTitleInlineHtml(html);
        // 不生成新的块 ID，也不把临时编辑属性写进任务名称。
        return lute.BlockDOM2Md(paragraph.outerHTML).trim();
    }

    function __tmRenderNativeTaskTitleHtml(source) {
        const html = __tmTaskTitleInlineFromMarkdown(source);
        if (html === null) return null;
        const template = document.createElement('template');
        template.innerHTML = html;
        template.content.querySelectorAll('[data-type]').forEach(el => {
            const types = new Set(String(el.getAttribute('data-type') || '').split(/\s+/));
            if (types.has('a') || types.has('block-ref')) el.classList.add('tm-linked-text');
            if (types.has('a') && el.getAttribute('data-href')) {
                el.classList.add('tm-task-title-link');
                el.setAttribute('data-tm-title-link-href', el.getAttribute('data-href'));
                el.tabIndex = 0;
            }
            if (types.has('block-ref')) {
                el.classList.add('tm-task-title-block-ref');
                el.setAttribute('data-tm-block-ref-id', el.getAttribute('data-id') || '');
            }
        });
        return `<span class="tm-native-title">${template.innerHTML}</span>`;
    }

    function __tmBuildTaskTitleEditorHtml(task, options = {}) {
        const source = __tmGetTaskTitleMarkdown(task);
        const html = __tmTaskTitleInlineFromMarkdown(source);
        const readOnly = options.readOnly === true || html === null;
        return `<div class="${esc(options.className || 'tm-task-detail-title-input')} tm-title-editor" data-tm-title-editor data-tm-title-source="${esc(source)}" data-tm-title-readonly="${readOnly ? '1' : '0'}" ${options.attributes || ''} contenteditable="${readOnly ? 'false' : 'true'}" role="textbox" aria-multiline="false" aria-readonly="${readOnly}" aria-label="${esc(__tmT('title.taskName'))}" tabindex="0" title="${esc(options.title || '')}">${html === null ? esc(task?.content || '') : html}</div>`;
    }

    function __tmIsTaskTitleEditor(element) {
        return element instanceof HTMLTextAreaElement || (element instanceof HTMLElement && element.hasAttribute('data-tm-title-editor'));
    }

    function __tmTaskTitleOwnsFocus(element, target = document.activeElement) {
        return !!(target && (target === element || element?.contains?.(target)
            || (__tmTaskTitlePopover?.owner === element && __tmTaskTitlePopover.element.contains(target))));
    }

    function __tmTaskTitleHasOpenPopover(root) {
        return !!(__tmTaskTitlePopover && root?.contains?.(__tmTaskTitlePopover.owner));
    }

    function __tmRequestTaskTitleMobileKeyboard(element) {
        const bridge = globalThis.JSHarmony || globalThis.JSAndroid;
        if (!bridge || typeof bridge.showKeyboard !== 'function') return false;
        const now = Date.now();
        if (Number(element?.__tmTitleKeyboardRequestAt || 0) > now - 500) return false;
        try { element.__tmTitleKeyboardRequestAt = now; } catch (e) {}
        try { bridge.setWebViewFocusable?.(true); } catch (e) {}
        try {
            bridge.showKeyboard();
            globalThis.dispatchEvent?.(new CustomEvent('siyuan-mobile-keyboard-change', { detail: true }));
            return true;
        } catch (error) {
            return false;
        }
    }

    function __tmPatchTaskTitleEditor(element, task) {
        if (!__tmIsTaskTitleEditor(element)) return false;
        if (__tmTaskTitleOwnsFocus(element) || element.dataset.composing === 'true' || element.__tmTitleEditor?.dirty()) return true;
        element.value = __tmGetTaskTitleMarkdown(task);
        element.dataset.savedValue = element.value;
        return true;
    }

    function __tmMountTaskTitleEditor(element, task, options = {}) {
        if (!(element instanceof HTMLElement) || !element.hasAttribute('data-tm-title-editor')) return null;
        if (element.__tmTitleEditor) return element.__tmTitleEditor;
        const signal = options.signal;
        let source = element.getAttribute('data-tm-title-source') || __tmGetTaskTitleMarkdown(task);
        let baselineHtml = '';
        const readOnly = element.getAttribute('data-tm-title-readonly') === '1';
        const normalize = () => __tmCleanTaskTitleInlineHtml(element.innerHTML);
        const decorate = () => { element.innerHTML = __tmCleanTaskTitleInlineHtml(element.innerHTML, !readOnly); baselineHtml = normalize(); };
        decorate();
        element.dataset.savedValue = source;
        const getValue = () => normalize() === baselineHtml ? source : __tmSerializeTaskTitleInline(element.innerHTML);
        const setValue = value => {
            const next = String(value || '').trim();
            if (next === getValue()) return;
            const html = __tmTaskTitleInlineFromMarkdown(next);
            if (html === null) return;
            source = next;
            element.innerHTML = html;
            decorate();
        };
        Object.defineProperties(element, {
            value: { configurable: true, get: getValue, set: setValue },
            readOnly: { configurable: true, get: () => readOnly },
        });
        const on = (target, event, handler, capture = false) => target.addEventListener(event, handler, { capture, ...(signal ? { signal } : {}) });
        const insert = html => {
            element.focus();
            return document.execCommand('insertHTML', false, __tmCleanTaskTitleInlineHtml(html, true));
        };
        let hideTimer = 0;
        let popoverEvents = null;
        const closePopover = () => {
            clearTimeout(hideTimer);
            popoverEvents?.abort();
            popoverEvents = null;
            if (__tmTaskTitlePopover?.owner !== element) return;
            __tmTaskTitlePopover.element.remove();
            __tmTaskTitlePopover = null;
        };
        const showPopover = (node, edit = false) => {
            if (!(node instanceof HTMLElement) || !element.contains(node)) return;
            __tmTaskTitlePopover?.close();
            const panel = document.createElement('div');
            panel.className = 'tm-task-detail-inline-popover tm-title-link-popover';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', __tmT('title.editLink'));
            const isRef = node.matches('[data-type~="block-ref"]');
            const dynamic = isRef && node.getAttribute('data-subtype') !== 's';
            const target = isRef ? node.getAttribute('data-id') : node.getAttribute('data-href');
            const icon = name => __tmPhosphorBoldSvg(name, { size: 16, className: 'tm-title-link-icon' });
            panel.innerHTML = `<div class="tm-title-link-actions"><button type="button" class="bc-btn bc-btn--sm" data-title-open>${icon('arrow-up-right')}${__tmT('title.openLink')}</button>${readOnly ? '' : `<button type="button" class="bc-btn bc-btn--sm" data-title-edit>${icon('pencil-simple')}${__tmT('title.editLink')}</button>`}</div>
                ${readOnly ? '' : `<form class="tm-title-link-form" ${edit ? '' : 'hidden'}><label>${__tmT('task.linkText')}<input class="bc-input" name="label" value="${esc(node.textContent || '')}" ${dynamic ? 'disabled' : ''}></label><label>${__tmT(isRef ? 'title.blockTarget' : 'title.linkAddress')}<input class="bc-input" name="target" value="${esc(target || '')}" required autocomplete="off"></label>${isRef ? `<label class="tm-title-link-dynamic"><input type="checkbox" name="dynamic" ${dynamic ? 'checked' : ''}>${__tmT('title.followBlockName')}</label>` : ''}<div class="tm-title-link-error" role="alert"></div><div class="tm-title-link-form-actions"><button type="button" class="bc-btn bc-btn--sm" data-title-unlink>${__tmT('title.unlink')}</button><button type="button" class="bc-btn bc-btn--sm" data-title-cancel>${__tmT('common.cancel')}</button><button type="submit" class="bc-btn bc-btn--sm bc-btn--primary">${__tmT('common.save')}</button></div></form>`}`;
            (element.closest('dialog') || document.body).appendChild(panel);
            __tmTaskTitlePopover = { owner: element, element: panel, node, close: closePopover };
            popoverEvents = new AbortController();
            const eventOptions = { capture: true, signal: popoverEvents.signal };
            document.addEventListener('pointerdown', event => { if (!__tmTaskTitleOwnsFocus(element, event.target)) closePopover(); }, eventOptions);
            window.addEventListener('resize', closePopover, { signal: popoverEvents.signal });
            document.addEventListener('scroll', event => { if (!panel.contains(event.target)) closePopover(); }, eventOptions);
            const position = () => {
                if (!node.isConnected) { closePopover(); return; }
                const rect = node.getBoundingClientRect();
                const width = Math.min(340, window.innerWidth - 24);
                panel.style.maxWidth = `${width}px`;
                panel.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - panel.offsetWidth - 12))}px`;
                panel.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - panel.offsetHeight - 8))}px`;
            };
            const form = panel.querySelector('form');
            const formField = name => form?.elements.namedItem(name);
            const openEdit = () => { if (!form) return; form.hidden = false; panel.classList.add('is-editing'); position(); formField(dynamic ? 'target' : 'label').focus(); };
            panel.querySelector('[data-title-edit]')?.addEventListener('click', openEdit);
            panel.querySelector('[data-title-cancel]')?.addEventListener('click', () => { closePopover(); element.focus(); });
            panel.querySelector('[data-title-open]').addEventListener('click', () => {
                if (isRef) void __tmOpenTaskAttachmentBlockRef(target);
                else __tmOpenTaskTitleLink(target);
                closePopover();
            });
            formField('dynamic')?.addEventListener('change', () => { formField('label').disabled = formField('dynamic').checked; });
            const replaceNode = replacement => {
                if (!node.isConnected || !element.contains(node)) return false;
                element.focus();
                const range = document.createRange();
                range.selectNode(node);
                const selection = window.getSelection();
                selection.removeAllRanges(); selection.addRange(range);
                return insert(replacement);
            };
            panel.querySelector('[data-title-unlink]')?.addEventListener('click', () => {
                const copy = node.cloneNode(true);
                const types = String(copy.getAttribute('data-type') || '').split(/\s+/).filter(type => type !== (isRef ? 'block-ref' : 'a'));
                for (const attr of isRef ? ['data-id', 'data-subtype'] : ['data-href', 'data-title']) copy.removeAttribute(attr);
                copy.setAttribute('data-type', types.join(' '));
                if (replaceNode(types.length ? copy.outerHTML : esc(copy.textContent || ''))) closePopover();
            });
            form?.addEventListener('submit', async event => {
                event.preventDefault();
                const error = panel.querySelector('[role="alert"]');
                try {
                    const copy = node.cloneNode(true);
                    let value = formField('target').value.trim();
                    let label = formField('label').value;
                    if (isRef) {
                        value = value.replace(/^siyuan:\/\/blocks\//, '').split(/[?#]/)[0];
                        if (!/^\d{14}-[a-z0-9]{7}$/i.test(value)) throw new Error(__tmT('title.invalidTarget'));
                        const result = await API.call('/api/block/getRefText', { id: value });
                        if (result.code !== 0 || !result.data) throw new Error(__tmT('title.invalidTarget'));
                        if (!node.isConnected || __tmTaskTitlePopover?.element !== panel) return;
                        if (formField('dynamic').checked) {
                            const template = document.createElement('template'); template.innerHTML = result.data;
                            label = template.content.textContent || value;
                        }
                        copy.setAttribute('data-id', value);
                        copy.setAttribute('data-subtype', formField('dynamic').checked ? 'd' : 's');
                    } else {
                        if (!value || /^\s*(?:javascript|vbscript|data):/i.test(value)) throw new Error(__tmT('title.invalidTarget'));
                        copy.setAttribute('data-href', value);
                    }
                    if ((label || value) !== node.textContent) copy.textContent = label || value;
                    if (replaceNode(copy.outerHTML)) closePopover();
                } catch (e) { error.textContent = e.message; position(); }
            });
            panel.addEventListener('keydown', event => {
                event.stopPropagation();
                if (event.key === 'Escape') { event.preventDefault(); closePopover(); element.focus(); }
            });
            panel.addEventListener('pointerenter', () => clearTimeout(hideTimer));
            panel.addEventListener('pointerleave', () => {
                if (form?.hidden !== false) hideTimer = setTimeout(closePopover, 180);
            });
            position();
            if (edit) openEdit();
        };
        on(element, 'pointerover', event => {
            if (event.pointerType === 'touch') return;
            const node = event.target.closest?.('[data-type~="a"], [data-type~="block-ref"]');
            clearTimeout(hideTimer);
            if (__tmTaskTitlePopover?.owner === element && (__tmTaskTitlePopover.node === node || __tmTaskTitlePopover.element.querySelector('form')?.hidden === false)) return;
            if (node) showPopover(node);
        });
        on(element, 'pointerout', event => {
            if (__tmTaskTitlePopover?.owner !== element || __tmTaskTitleOwnsFocus(element, event.relatedTarget)) return;
            if (__tmTaskTitlePopover.element.querySelector('form')?.hidden !== false) hideTimer = setTimeout(closePopover, 180);
        });
        on(element, 'focusin', event => {
            const node = event.target.closest?.('[data-type~="a"], [data-type~="block-ref"]');
            if (node && __tmTaskTitlePopover?.node !== node) showPopover(node);
        });
        on(element, 'click', event => {
            const node = event.target.closest?.('[data-type~="a"], [data-type~="block-ref"]');
            if (!node) return;
            event.preventDefault(); event.stopPropagation(); showPopover(node);
        });
        on(element, 'click', event => {
            if (readOnly) return;
            const target = event?.target instanceof Element ? event.target : null;
            if (target?.closest?.('[data-type~="a"], [data-type~="block-ref"]')) return;
            __tmRequestTaskTitleMobileKeyboard(element);
        });
        on(element, 'keydown', event => {
            const node = event.target.closest?.('[data-type~="a"], [data-type~="block-ref"]');
            if (node && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); showPopover(node, !readOnly); }
            else if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
        });
        on(element, 'paste', event => {
            if (readOnly || event.clipboardData?.files?.length) return;
            event.preventDefault(); event.stopPropagation();
            const html = event.clipboardData.getData('application/x-task-horizon-title');
            const text = event.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ');
            const external = event.clipboardData.getData('text/html');
            const lute = __tmGetTaskTitleLute();
            const content = html || (external ? __tmTaskTitleInlineFromDOM(lute.HTML2BlockDOM(external)) : __tmTaskTitleInlineFromMarkdown(text));
            insert(content || esc(text));
        });
        on(element, 'copy', event => {
            const selection = window.getSelection();
            if (!selection?.rangeCount || !element.contains(selection.anchorNode) || !element.contains(selection.focusNode)) return;
            const wrapper = document.createElement('div'); wrapper.appendChild(selection.getRangeAt(0).cloneContents());
            event.clipboardData.setData('application/x-task-horizon-title', __tmCleanTaskTitleInlineHtml(wrapper.innerHTML));
            event.clipboardData.setData('text/plain', selection.toString());
            event.preventDefault();
        });
        const controller = { dirty: () => getValue() !== String(element.dataset.savedValue || ''), close: closePopover, getValue };
        element.__tmTitleEditor = controller;
        signal?.addEventListener('abort', () => { closePopover(); delete element.__tmTitleEditor; }, { once: true });
        // 在用户开始编辑前读取原生内容；异步结果不能覆盖活动草稿。
        const hydrateNativeContent = () => {
            if (!task?.id || typeof API.getTaskContentBlockId !== 'function' || typeof API.getBlockDOM !== 'function') return;
            const expected = source;
            Promise.resolve(API.getTaskContentBlockId(task.id)).then(id => id ? API.getBlockDOM(id) : '').then(dom => {
                if (!dom || signal?.aborted || !element.isConnected || __tmTaskTitleOwnsFocus(element) || getValue() !== expected) return;
                const html = __tmTaskTitleInlineFromDOM(dom);
                if (!html) return;
                element.innerHTML = html; decorate();
            }).catch(() => null);
        };
        if (element.hasAttribute('data-tm-detail-subtask-content')) {
            element.addEventListener('pointerenter', hydrateNativeContent, { once: true, ...(signal ? { signal } : {}) });
        } else hydrateNativeContent();
        return controller;
    }

    function __tmShowTaskTitleDialog(task) {
        return new Promise(resolve => {
            const dialog = document.createElement('dialog');
            dialog.className = 'tm-title-dialog';
            dialog.innerHTML = `<h3>${__tmT('task.editTask')}</h3>${__tmBuildTaskTitleEditorHtml(task)}<div class="tm-title-link-form-actions"><button class="bc-btn" data-title-dismiss>${__tmT('common.cancel')}</button><button class="bc-btn bc-btn--primary" data-title-confirm>${__tmT('common.save')}</button></div>`;
            document.body.appendChild(dialog);
            const abort = new AbortController();
            const editor = dialog.querySelector('[data-tm-title-editor]');
            const controller = __tmMountTaskTitleEditor(editor, task, { signal: abort.signal });
            const done = value => { abort.abort(); dialog.close(); dialog.remove(); resolve(value); };
            dialog.querySelector('[data-title-dismiss]').onclick = () => done(null);
            dialog.querySelector('[data-title-confirm]').onclick = () => done(controller.getValue());
            dialog.addEventListener('cancel', event => { event.preventDefault(); done(null); });
            dialog.showModal(); editor.focus();
        });
    }
