const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IDS = Object.freeze({
    doc: '20260101000000-doc',
    singleList: '20260101000001-list',
    singleTask: '20260101000002-task',
    childBlock: '20260101000003-child',
    multiList: '20260101000004-list',
    firstTask: '20260101000005-task',
    secondTask: '20260101000006-task',
    otherDoc: '20260101000007-doc',
    otherList: '20260101000008-list',
    otherTask: '20260101000009-task',
    personalParentDoc: '20260101000014-doc',
    formattedList: '20260101000010-list',
    formattedTask: '20260101000010-task',
    fuzzyList: '20260101000012-list',
    fuzzyTask: '20260101000013-task',
    monthlyDoc: '20260101000015-doc',
    nestedMonthlyDoc: '20260101000016-doc',
    paragraphTitleTask: '20260101000017-task',
    childList: '20260101000018-list',
    childTask: '20260101000019-task',
});

function createHarness(options = {}) {
    const blocks = new Map([
        [IDS.doc, { id: IDS.doc, parent_id: '', root_id: IDS.doc, type: 'd', subtype: '', markdown: '', content: 'Contract Doc', path: `/${IDS.doc}.sy`, hpath: '/Contract Doc', updated: '20260101000000', created: '20260101000000', sort: 0 }],
        [IDS.singleList, { id: IDS.singleList, parent_id: IDS.doc, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260101000001', created: '20260101000001', sort: 1 }],
        [IDS.singleTask, { id: IDS.singleTask, parent_id: IDS.singleList, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Alpha\n\n  detail', content: 'Alpha detail', updated: '20260101000002', created: '20260101000002', sort: 1 }],
        [IDS.childBlock, { id: IDS.childBlock, parent_id: IDS.singleTask, root_id: IDS.doc, type: 'p', subtype: '', markdown: 'detail', content: 'detail', updated: '20260101000003', created: '20260101000003', sort: 1 }],
        [IDS.multiList, { id: IDS.multiList, parent_id: IDS.doc, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260101000004', created: '20260101000004', sort: 2 }],
        [IDS.firstTask, { id: IDS.firstTask, parent_id: IDS.multiList, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] First', content: 'First', updated: '20260101000005', created: '20260101000005', sort: 1 }],
        [IDS.secondTask, { id: IDS.secondTask, parent_id: IDS.multiList, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Second', content: 'Second', updated: '20260101000006', created: '20260101000006', sort: 2 }],
        [IDS.personalParentDoc, { id: IDS.personalParentDoc, parent_id: '', root_id: IDS.personalParentDoc, type: 'd', subtype: '', markdown: '', content: 'Personal', path: `/${IDS.personalParentDoc}.sy`, hpath: '/Personal', updated: '20260101000014', created: '20260101000014', sort: 0 }],
        [IDS.monthlyDoc, { id: IDS.monthlyDoc, parent_id: '', root_id: IDS.monthlyDoc, type: 'd', subtype: '', markdown: '', content: '2026-07', path: `/${IDS.personalParentDoc}/${IDS.monthlyDoc}.sy`, hpath: '/Personal/2026-07', updated: '20260101000015', created: '20260101000015', sort: 0 }],
        [IDS.nestedMonthlyDoc, { id: IDS.nestedMonthlyDoc, parent_id: '', root_id: IDS.nestedMonthlyDoc, type: 'd', subtype: '', markdown: '', content: '2026-08', path: `/${IDS.personalParentDoc}/${IDS.monthlyDoc}/${IDS.nestedMonthlyDoc}.sy`, hpath: '/Personal/2026-07/2026-08', updated: '20260101000016', created: '20260101000016', sort: 0 }],
        [IDS.otherDoc, { id: IDS.otherDoc, parent_id: '', root_id: IDS.otherDoc, type: 'd', subtype: '', markdown: '', content: 'Other Doc', path: `/${IDS.personalParentDoc}/${IDS.otherDoc}.sy`, hpath: '', updated: '20260101000007', created: '20260101000007', sort: 0 }],
        [IDS.otherList, { id: IDS.otherList, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260101000008', created: '20260101000008', sort: 1 }],
        [IDS.otherTask, { id: IDS.otherTask, parent_id: IDS.otherList, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] 全局同名提醒任务', content: '全局同名提醒任务', updated: '20260101000009', created: '20260101000009', sort: 1 }],
        [IDS.formattedList, { id: IDS.formattedList, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260101000010', created: '20260101000010', sort: 2 }],
        [IDS.formattedTask, { id: IDS.formattedTask, parent_id: IDS.formattedList, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] **Formatted Reminder Task**', content: 'Formatted Reminder Task', updated: '20260101000011', created: '20260101000011', sort: 1 }],
        [IDS.fuzzyList, { id: IDS.fuzzyList, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260101000012', created: '20260101000012', sort: 3 }],
        [IDS.fuzzyTask, { id: IDS.fuzzyTask, parent_id: IDS.fuzzyList, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] 准备发布说明', content: '准备发布说明', updated: '20260101000013', created: '20260101000013', sort: 1 }],
        [IDS.paragraphTitleTask, { id: IDS.paragraphTitleTask, parent_id: IDS.fuzzyList, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '- [ ] \n    6646\n\n  - [ ] 323232', content: '6646 323232', updated: '20260101000017', created: '20260101000017', sort: 2 }],
        [IDS.childList, { id: IDS.childList, parent_id: IDS.singleTask, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260101000018', created: '20260101000018', sort: 2 }],
        [IDS.childTask, { id: IDS.childTask, parent_id: IDS.childList, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Existing child', content: 'Existing child', updated: '20260101000019', created: '20260101000019', sort: 1 }],
    ]);
    const attrs = new Map([
        [IDS.singleList, { 'custom-existing-extension': 'keep-me' }],
    ]);
    const initialAttrs = options.initialAttrs instanceof Map
        ? options.initialAttrs
        : new Map(Object.entries(options.initialAttrs || {}));
    initialAttrs.forEach((value, id) => {
        attrs.set(id, { ...(attrs.get(id) || {}), ...((value && typeof value === 'object') ? value : {}) });
    });
    const storage = new Map([
        ['agent-mcp-config.json', JSON.stringify({ schemaVersion: 2, enabled: true, tools: {} })],
        ['calendar-events.json', JSON.stringify([{
            id: 'schedule-existing',
            taskId: IDS.singleTask,
            title: 'Existing schedule',
            start: '2026-07-14T09:00:00+08:00',
            end: '2026-07-14T10:00:00+08:00',
            reminder: { minutes: 15 },
            recurrence: { type: 'weekly' },
            extension: 'keep-me',
        }])],
        ['task-settings.json', JSON.stringify({
            customFieldDefs: [{
                id: 'energy', name: 'Energy', type: 'single', agentWritable: true,
                options: [
                    { id: 'high', name: 'High', parentId: 'reading' },
                    { id: 'reading', name: 'Reading', parentId: 'invest' },
                    { id: 'invest', name: 'Investment' },
                    { id: 'legacy', name: 'Legacy', parentId: 'archive' },
                    { id: 'archive', name: 'Archive', archived: true },
                ],
            }],
            docGroups: [
                { id: 'work', name: '工作', docs: [{ id: IDS.doc, recursive: false }] },
                { id: 'personal', name: '个人', docs: [{ id: IDS.personalParentDoc, recursive: true }] },
            ],
            taskMetaAttrKeyAliases: { priority: ['custom-old-priority'] },
            customStatusOptions: [
                { id: 'todo', name: '待办', color: '#777777', marker: ' ' },
                { id: 'in_progress', name: '进行中', color: '#4285f4', marker: '?' },
                { id: 'done', name: '已完成', color: '#34a853', marker: 'X' },
            ],
        })],
    ]);
    const rpcCalls = {};
    const mcpTools = {};
    const apiCalls = [];
    let failNextToolRegistration = '';
    let failNextTransaction = false;
    let skipNextTransaction = false;
    let skipNextMove = false;
    let createdBlockSequence = 0;
    let createdDocumentSequence = 0;

    const firstTaskForList = (parentID) => Array.from(blocks.values())
        .filter((block) => block.parent_id === parentID && block.type === 'i' && block.subtype === 't')
        .sort((left, right) => left.sort - right.sort)[0] || null;

    function taskRow(id) {
        const task = blocks.get(id);
        if (!task || task.type !== 'i' || task.subtype !== 't') return null;
        const parent = blocks.get(task.parent_id);
        const siblings = Array.from(blocks.values()).filter((block) => block.parent_id === task.parent_id && block.type === 'i' && block.subtype === 't');
        return {
            ...task,
            raw_content: task.content,
            block_path: '',
            block_sort: task.sort,
            box: 'box',
            doc_name: blocks.get(task.root_id)?.content || '',
            doc_path: blocks.get(task.root_id)?.hpath || '',
            parent_type: parent?.type || '',
            parent_task_id: blocks.get(parent?.parent_id)?.type === 'i' ? parent.parent_id : '',
            parent_task_count: siblings.length,
            first_task_id: firstTaskForList(task.parent_id)?.id || '',
        };
    }

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const decodeHtml = (value) => String(value || '')
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');

    function taskBlockDOM(id) {
        const block = blocks.get(id);
        if (!block) return '';
        const rawMarker = String(block.markdown || '').match(/^\s*[*+-]\s+\[([^\]\r\n]?)\]/)?.[1] || ' ';
        const marker = String(rawMarker).toLowerCase() === 'x' ? 'X' : rawMarker;
        const done = marker !== ' ';
        const title = id === IDS.paragraphTitleTask
            ? String(block.markdown.split(/\r?\n/)[1] || '').trim()
            : String(block.markdown || '').replace(/^\s*[*+-]\s+\[[^\]]\]\s*/, '').split(/\r?\n/)[0].trim();
        return `<div data-task="${marker}" data-marker="*" data-subtype="t" data-node-id="${id}" data-type="NodeListItem" class="li${done ? ' protyle-task--done' : ''}"><div class="protyle-action protyle-action--task"><svg><use xlink:href="#icon${done ? 'Check' : 'Uncheck'}"></use></svg></div><div data-node-id="${id.slice(0, 14)}-paragraph" data-type="NodeParagraph" class="p"><div contenteditable="true">${escapeHtml(title)}</div><div class="protyle-attr" contenteditable="false"></div></div><div class="protyle-attr" contenteditable="false"></div></div>`;
    }

    function applyTaskDOMUpdate(id, dom) {
        const block = blocks.get(id);
        if (!block) throw new Error('update source not found');
        const domMarker = String(dom || '').match(/\bdata-task="([^"]*)"/)?.[1] || ' ';
        const marker = domMarker === 'X' ? 'x' : domMarker;
        const title = decodeHtml(String(dom || '').match(/data-type="NodeParagraph"[\s\S]*?<div contenteditable="true">([\s\S]*?)<\/div>/)?.[1] || '').replace(/<[^>]+>/g, '');
        const lines = String(block.markdown || '').split(/\r?\n/);
        if (/^\s*[*+-]\s+\[[^\]]\]\s*$/.test(lines[0] || '') && lines.length > 1) {
            lines[0] = String(lines[0]).replace(/\[[^\]]\]/, `[${marker}]`);
            lines[1] = `${String(lines[1]).match(/^\s*/)?.[0] || ''}${title}`;
        } else {
            lines[0] = String(lines[0] || '* [ ]').replace(/^(\s*[*+-]\s+)\[[^\]]\][\s\S]*$/, `$1[${marker}] ${title}`);
        }
        block.markdown = lines.join('\n');
        block.content = title;
        block.updated = String(Number(block.updated) + 1).padStart(14, '0');
    }

    function moveBlock(body) {
        const block = blocks.get(body.id);
        if (!block) throw new Error('move source not found');
        let parent;
        let insertIndex = 0;
        if (body.previousID) {
            const previous = blocks.get(body.previousID);
            if (!previous) throw new Error('move previous block not found');
            parent = blocks.get(previous.parent_id);
            const siblings = Array.from(blocks.values())
                .filter((item) => item.parent_id === previous.parent_id && item.id !== block.id)
                .sort((left, right) => left.sort - right.sort || String(left.created || '').localeCompare(String(right.created || '')) || left.id.localeCompare(right.id));
            insertIndex = siblings.findIndex((item) => item.id === previous.id) + 1;
            siblings.splice(insertIndex, 0, block);
            block.parent_id = previous.parent_id;
            block.root_id = previous.root_id;
            siblings.forEach((item, index) => { item.sort = index + 1; });
            return;
        }
        if (body.parentID) {
            parent = blocks.get(body.parentID);
            if (!parent) throw new Error('move parent block not found');
            const siblings = Array.from(blocks.values())
                .filter((item) => item.parent_id === parent.id && item.id !== block.id)
                .sort((left, right) => left.sort - right.sort || String(left.created || '').localeCompare(String(right.created || '')) || left.id.localeCompare(right.id));
            siblings.unshift(block);
            block.parent_id = parent.id;
            block.root_id = parent.type === 'd' ? parent.id : parent.root_id;
            siblings.forEach((item, index) => { item.sort = index + 1; });
        }
    }

    function query(statement) {
        if (/SELECT 1 AS task_horizon_session_probe/.test(statement)) return [{ task_horizon_session_probe: 1 }];
        if (/SELECT DISTINCT a\.block_id AS id[\s\S]*FROM attributes a[\s\S]*JOIN blocks b ON b\.id = a\.block_id[\s\S]*b\.type = 'l'/.test(statement)) {
            const exactNames = new Set(Array.from(statement.matchAll(/a\.name = '([^']+)'/g)).map((match) => match[1]));
            const prefixes = Array.from(statement.matchAll(/a\.name LIKE '([^']+)%'/g)).map((match) => match[1]);
            const offset = Number(statement.match(/OFFSET (\d+)/)?.[1] || 0);
            const limit = Number(statement.match(/LIMIT (\d+)/)?.[1] || 500);
            return Array.from(attrs.entries())
                .filter(([id, row]) => blocks.get(id)?.type === 'l'
                    && Object.keys(row || {}).some((name) => exactNames.has(name) || prefixes.some((prefix) => name.startsWith(prefix))))
                .map(([id]) => ({ id }))
                .sort((left, right) => left.id.localeCompare(right.id))
                .slice(offset, offset + limit);
        }
        const agentOutputParentMatch = statement.match(/SELECT id, box, path, hpath FROM blocks WHERE id = '([^']+)' AND type = 'd' LIMIT 1/);
        if (agentOutputParentMatch) {
            const block = blocks.get(agentOutputParentMatch[1]);
            return block?.type === 'd' ? [{ id: block.id, box: 'box', path: block.path, hpath: block.hpath }] : [];
        }
        if (/SELECT id, path FROM blocks\s+WHERE type = 'd'/.test(statement)) {
            const content = statement.match(/content = '([^']+)'/)?.[1]?.replace(/''/g, "'") || '';
            const prefix = statement.match(/path LIKE '([^']+)%'/)?.[1]?.replace(/''/g, "'") || '';
            return Array.from(blocks.values())
                .filter((block) => block.type === 'd' && block.content === content && String(block.path || '').startsWith(prefix))
                .sort((left, right) => String(left.created || '').localeCompare(String(right.created || '')))
                .map((block) => ({ id: block.id, path: block.path }));
        }
        if (/SELECT id, box, path, hpath FROM blocks WHERE type = 'd' AND id IN/.test(statement)) {
            const ids = Array.from(statement.matchAll(/'(\d{14}-[^']+)'/g)).map((match) => match[1]);
            return ids.map((id) => blocks.get(id)).filter((block) => block?.type === 'd').map((block) => ({
                id: block.id,
                box: 'box',
                path: block.path || `/${block.id}.sy`,
                hpath: block.hpath,
            }));
        }
        if (/FROM blocks doc\s+WHERE doc\.type = 'd'/.test(statement)) {
            return Array.from(blocks.values())
                .filter((block) => block.type === 'd' && /contract/i.test(`${block.content} ${block.hpath}`))
                .map((block) => ({ id: block.id, name: block.content, path: block.hpath, box: 'box', updated: block.updated }));
        }
        const reminderTitleQuery = /SELECT task\.id, task\.markdown, task\.content AS raw_content, task\.updated/.test(statement);
        if (reminderTitleQuery) {
            const titles = Array.from(statement.matchAll(/instr\(lower\(task\.markdown\), lower\('((?:''|[^'])*)'\)\) > 0/g))
                .map((match) => match[1].replace(/''/g, "'").toLocaleLowerCase());
            return Array.from(blocks.values())
                .filter((block) => {
                    if (block.type !== 'i' || block.subtype !== 't') return false;
                    const haystack = `${block.markdown || ''}\n${block.content || ''}`.toLocaleLowerCase();
                    return titles.some((title) => haystack.includes(title));
                })
                .sort((left, right) => String(right.updated || '').localeCompare(String(left.updated || '')))
                .map((block) => ({ id: block.id, markdown: block.markdown, raw_content: block.content, updated: block.updated }));
        }
        if (/SELECT block_id, name, value FROM attributes WHERE block_id IN/.test(statement)) {
            const ids = new Set(Array.from(statement.matchAll(/'(\d{14}-[^']+)'/g)).map((match) => match[1]));
            const nameClause = statement.match(/\bname IN \(([^)]+)\)/)?.[1] || '';
            const names = new Set(Array.from(nameClause.matchAll(/'((?:''|[^'])*)'/g))
                .map((match) => match[1].replace(/''/g, "'")));
            return Array.from(attrs.entries()).flatMap(([blockID, values]) => {
                if (!ids.has(blockID)) return [];
                return Object.entries(values || {})
                    .filter(([name]) => !names.size || names.has(name))
                    .map(([name, value]) => ({ block_id: blockID, name, value }));
            });
        }
        if (/SELECT source\.id AS list_id,[\s\S]*AS task_id[\s\S]*FROM blocks source[\s\S]*WHERE source\.id IN/.test(statement)) {
            const ids = Array.from(statement.matchAll(/'(\d{14}-[^']+)'/g)).map((match) => match[1]);
            return ids.map((id) => ({
                list_id: id,
                task_id: firstTaskForList(id)?.id || '',
            }));
        }
        if (/SELECT id, parent_id, root_id, type, subtype FROM blocks WHERE id IN/.test(statement)) {
            const ids = Array.from(statement.matchAll(/'(\d{14}-[^']+)'/g)).map((match) => match[1]);
            return ids.map((id) => blocks.get(id)).filter(Boolean).map((block) => ({
                id: block.id,
                parent_id: block.parent_id,
                root_id: block.root_id,
                type: block.type,
                subtype: block.subtype,
            }));
        }
        if (/WHERE task\.id IN/.test(statement)) {
            const ids = Array.from(statement.matchAll(/'(\d{14}-[^']+)'/g)).map((match) => match[1]);
            return ids.map(taskRow).filter(Boolean).map((row) => ({
                ...row,
                parent_task_count: 0,
                first_task_id: '',
                previous_sibling_id: '',
                next_sibling_id: '',
            }));
        }
        const taskMatch = statement.match(/WHERE task\.id = '([^']+)'/);
        if (taskMatch) {
            const row = taskRow(taskMatch[1]);
            return row ? [row] : [];
        }
        const blockMatch = statement.match(/SELECT id, parent_id, (?:root_id, )?type, subtype FROM blocks WHERE id = '([^']+)'/);
        if (blockMatch) {
            const block = blocks.get(blockMatch[1]);
            return block ? [{ id: block.id, parent_id: block.parent_id, root_id: block.root_id, type: block.type, subtype: block.subtype }] : [];
        }
        const duplicateListMatch = statement.match(/SELECT id, parent_id, type FROM blocks WHERE id = '([^']+)'/);
        if (duplicateListMatch) {
            const block = blocks.get(duplicateListMatch[1]);
            return block ? [{ id: block.id, parent_id: block.parent_id, type: block.type }] : [];
        }
        const headingSectionMatch = statement.match(/SELECT id, type, subtype FROM blocks\s+WHERE parent_id = '([^']+)'/);
        if (headingSectionMatch) {
            return Array.from(blocks.values())
                .filter((block) => block.parent_id === headingSectionMatch[1])
                .sort((left, right) => left.sort - right.sort || String(left.created || '').localeCompare(String(right.created || '')) || left.id.localeCompare(right.id))
                .map((block) => ({ id: block.id, type: block.type, subtype: block.subtype }));
        }
        const ancestorBatchMatch = statement.match(/WITH RECURSIVE ancestors\(id, parent_id, depth\)[\s\S]*SELECT id, parent_id, 0 FROM blocks WHERE id = '([^']+)'[\s\S]*SELECT id FROM ancestors WHERE id IN \(([^)]+)\)/);
        if (ancestorBatchMatch) {
            const sourceIDs = new Set(Array.from(ancestorBatchMatch[2].matchAll(/'([^']+)'/g)).map((match) => match[1]));
            let current = blocks.get(ancestorBatchMatch[1]);
            while (current) {
                if (sourceIDs.has(current.id)) return [{ id: current.id }];
                current = blocks.get(current.parent_id);
            }
            return [];
        }
        const siblingsMatch = statement.match(/SELECT id FROM blocks\s+WHERE parent_id = '([^']+)'([\s\S]*?)ORDER BY sort ASC, created ASC, id ASC/);
        if (siblingsMatch) {
            const excludedIDs = new Set(Array.from(siblingsMatch[2].matchAll(/id <> '([^']+)'/g)).map((match) => match[1]));
            const notIn = siblingsMatch[2].match(/id NOT IN \(([^)]+)\)/)?.[1] || '';
            Array.from(notIn.matchAll(/'([^']+)'/g)).forEach((match) => excludedIDs.add(match[1]));
            return Array.from(blocks.values())
                .filter((block) => block.parent_id === siblingsMatch[1]
                    && !excludedIDs.has(block.id)
                    && (!/type = 'l'/.test(statement) || block.type === 'l')
                    && (!/type = 'i'/.test(statement) || (block.type === 'i' && block.subtype === 't')))
                .sort((left, right) => left.sort - right.sort)
                .slice(0, /LIMIT 1/.test(statement) ? 1 : (/LIMIT 2/.test(statement) ? 2 : undefined))
                .map((block) => ({ id: block.id }));
        }
        const lastChildMatch = statement.match(/SELECT id FROM blocks\s+WHERE parent_id = '([^']+)'([\s\S]*?)ORDER BY sort DESC, created DESC, id DESC LIMIT 1/);
        if (lastChildMatch) {
            const excludedIDs = new Set();
            const notIn = lastChildMatch[2].match(/id NOT IN \(([^)]+)\)/)?.[1] || '';
            Array.from(notIn.matchAll(/'([^']+)'/g)).forEach((match) => excludedIDs.add(match[1]));
            return Array.from(blocks.values())
                .filter((block) => block.parent_id === lastChildMatch[1] && !excludedIDs.has(block.id))
                .sort((left, right) => right.sort - left.sort || String(right.created || '').localeCompare(String(left.created || '')) || right.id.localeCompare(left.id))
                .slice(0, 1)
                .map((block) => ({ id: block.id }));
        }
        const insertedTreeMatch = statement.match(/WITH RECURSIVE tree[\s\S]*SELECT '([^']+)', 0/);
        if (insertedTreeMatch) {
            const rootID = insertedTreeMatch[1];
            const queue = [rootID];
            const seen = new Set();
            while (queue.length) {
                const id = queue.shift();
                if (!id || seen.has(id)) continue;
                seen.add(id);
                const block = blocks.get(id);
                if (block?.type === 'i' && block?.subtype === 't') return [{ id }];
                Array.from(blocks.values())
                    .filter((item) => item.parent_id === id)
                    .sort((left, right) => left.sort - right.sort)
                    .forEach((item) => queue.push(item.id));
            }
            return [];
        }
        const taskTreeMatch = statement.match(/WITH RECURSIVE task_tree\(id, depth\)[\s\S]*SELECT id, 0\s+FROM blocks\s+WHERE id = '([^']+)'/);
        if (taskTreeMatch) {
            const root = blocks.get(taskTreeMatch[1]);
            if (!root || root.type !== 'i' || root.subtype !== 't') return [];
            const queue = [{ id: root.id, depth: 0 }];
            const seen = new Set();
            const tasks = [];
            while (queue.length) {
                const current = queue.shift();
                if (!current?.id || seen.has(current.id) || current.depth > 128) continue;
                seen.add(current.id);
                const block = blocks.get(current.id);
                if (!block) continue;
                tasks.push({ id: block.id, depth: current.depth });
                const childListIDs = new Set(Array.from(blocks.values())
                    .filter((item) => item.parent_id === current.id && item.type === 'l')
                    .map((item) => item.id));
                Array.from(blocks.values())
                    .filter((item) => childListIDs.has(item.parent_id) && item.type === 'i' && item.subtype === 't')
                    .sort((left, right) => left.id.localeCompare(right.id))
                    .forEach((item) => queue.push({ id: item.id, depth: current.depth + 1 }));
            }
            return tasks
                .sort((left, right) => left.depth - right.depth || left.id.localeCompare(right.id))
                .slice(0, 10001)
                .map((item) => ({ id: item.id, tree_depth: item.depth }));
        }
        throw new Error(`Unhandled SQL in contract test: ${statement}`);
    }

    async function api(pathname, body) {
        apiCalls.push({ pathname, body: JSON.parse(JSON.stringify(body || {})) });
        if (pathname === '/api/query/sql') return query(String(body.stmt || ''));
        if (pathname === '/api/attr/getBlockAttrs') return { ...(attrs.get(body.id) || {}) };
        if (pathname === '/api/block/getBlockDOM') return { dom: taskBlockDOM(body.id) };
        if (pathname === '/api/block/getBlockBreadcrumb') {
            const path = [];
            let current = blocks.get(body.id) || null;
            while (current) {
                path.unshift(current);
                current = blocks.get(current.parent_id) || null;
            }
            return path
                .filter((block) => block.type !== 'l' || block.id === body.id)
                .map((block) => ({ id: block.id, type: block.type, subType: block.subtype }));
        }
        if (pathname === '/api/block/getChildBlocks') {
            return Array.from(blocks.values())
                .filter((block) => block.parent_id === body.id)
                .sort((left, right) => left.sort - right.sort || String(left.created || '').localeCompare(String(right.created || '')) || left.id.localeCompare(right.id))
                .map((block) => ({ id: block.id, type: block.type, subType: block.subtype }));
        }
        if (pathname === '/api/transactions') {
            if (failNextTransaction) {
                failNextTransaction = false;
                throw new Error('injected transaction failure');
            }
            if (skipNextTransaction) {
                skipNextTransaction = false;
                return null;
            }
            for (const transaction of body.transactions || []) {
                for (const operation of transaction.doOperations || []) {
                    if (operation.action === 'setAttrs') {
                        const nextAttrs = JSON.parse(String(operation.data || '{}'));
                        attrs.set(operation.id, { ...(attrs.get(operation.id) || {}), ...nextAttrs });
                    } else if (operation.action === 'update') {
                        applyTaskDOMUpdate(operation.id, operation.data);
                    } else if (operation.action === 'move') {
                        await api('/api/block/moveBlock', operation);
                    } else if (operation.action === 'delete') {
                        await api('/api/block/deleteBlock', operation);
                    } else if (operation.action === 'insert') {
                        const parent = blocks.get(operation.parentID || blocks.get(operation.previousID)?.parent_id);
                        if (!parent) throw new Error('insert parent not found');
                        const rootID = parent.type === 'd' ? parent.id : parent.root_id;
                        const dom = String(operation.data || '');
                        const insertedID = String(operation.id || dom.match(/data-node-id="([^"]+)"/)?.[1] || '');
                        const isList = /data-type="NodeList"/.test(dom) && !/data-node-id="[^"]+"[^>]*data-type="NodeListItem"/.test(dom.split('>')[0] || '');
                        blocks.set(insertedID, {
                            id: insertedID,
                            parent_id: parent.id,
                            root_id: rootID,
                            type: isList ? 'l' : 'i',
                            subtype: isList ? '' : 't',
                            markdown: isList ? '' : '* [ ] Inserted',
                            content: isList ? '' : 'Inserted',
                            updated: insertedID.slice(0, 14),
                            created: insertedID.slice(0, 14),
                            sort: 1,
                        });
                        if (isList) {
                            const taskMatch = dom.match(/<div[^>]*data-node-id="([^"]+)"[^>]*data-type="NodeListItem"/);
                            const taskID = String(taskMatch?.[1] || '');
                            if (taskID) {
                                const marker = String(dom.match(/\bdata-task="([^"]*)"/)?.[1] || ' ');
                                const title = decodeHtml(String(dom.match(/data-type="NodeParagraph"[\s\S]*?<div contenteditable="true">([\s\S]*?)<\/div>/)?.[1] || '').replace(/<[^>]+>/g, ''));
                                blocks.set(taskID, {
                                    id: taskID,
                                    parent_id: insertedID,
                                    root_id: rootID,
                                    type: 'i',
                                    subtype: 't',
                                    markdown: `* [${marker === 'X' ? 'x' : marker}] ${title}`,
                                    content: title,
                                    updated: taskID.slice(0, 14),
                                    created: taskID.slice(0, 14),
                                    sort: 1,
                                });
                            }
                        }
                    }
                }
            }
            return null;
        }
        if (pathname === '/api/attr/setBlockAttrs') {
            attrs.set(body.id, { ...(attrs.get(body.id) || {}), ...(body.attrs || {}) });
            return null;
        }
        if (pathname === '/api/attr/batchSetBlockAttrs') {
            for (const item of body.blockAttrs || []) {
                attrs.set(item.id, { ...(attrs.get(item.id) || {}), ...(item.attrs || {}) });
            }
            return null;
        }
        if (pathname === '/api/block/updateTaskListItemMarker') {
            const block = blocks.get(body.id);
            const parent = blocks.get(block?.parent_id);
            if (!block || parent?.type !== 'l') {
                throw new Error('SiYuan 3.8 rejected an invalid task-list-item replacement');
            }
            const marker = body.marker === 'X' ? 'x' : String(body.marker || ' ');
            block.markdown = block.markdown.replace(/^(\s*[*+-]\s+)\[[^\]]\]/, `$1[${marker}]`);
            block.updated = String(Number(block.updated) + 1).padStart(14, '0');
            return null;
        }
        if (pathname === '/api/block/batchUpdateTaskListItemMarker') {
            for (const item of body.items || []) await api('/api/block/updateTaskListItemMarker', item);
            return null;
        }
        if (pathname === '/api/block/updateBlock') {
            const block = blocks.get(body.id);
            block.markdown = String(body.data || '');
            block.content = block.markdown.replace(/^\s*[*+-]\s+\[[ xX-]\]\s*/, '').split('\n')[0];
            block.updated = String(Number(block.updated) + 1).padStart(14, '0');
            return null;
        }
        if (pathname === '/api/block/moveBlock') {
            if (skipNextMove) {
                skipNextMove = false;
                return null;
            }
            moveBlock(body);
            return null;
        }
        if (pathname === '/api/block/insertBlock') {
            const previous = blocks.get(body.previousID);
            const parent = previous ? blocks.get(previous.parent_id) : blocks.get(body.parentID);
            if (!parent) throw new Error('insert parent not found');
            createdBlockSequence += 1;
            const stamp = `202607200200${String(createdBlockSequence).padStart(2, '0')}`;
            const listID = `${stamp}-list`;
            const taskID = `${stamp}-task`;
            const rootID = parent.type === 'd' ? parent.id : parent.root_id;
            const siblings = Array.from(blocks.values())
                .filter((item) => item.parent_id === parent.id)
                .sort((left, right) => left.sort - right.sort);
            const previousIndex = previous ? siblings.findIndex((item) => item.id === previous.id) : -1;
            siblings.splice(previousIndex + 1, 0, {
                id: listID,
                parent_id: parent.id,
                root_id: rootID,
                type: 'l',
                subtype: 't',
                markdown: '',
                content: '',
                updated: stamp.slice(0, 14),
                created: stamp.slice(0, 14),
                sort: 0,
            });
            siblings.forEach((item, index) => {
                item.sort = index + 1;
                blocks.set(item.id, item);
            });
            blocks.set(taskID, {
                id: taskID,
                parent_id: listID,
                root_id: rootID,
                type: 'i',
                subtype: 't',
                markdown: String(body.data || ''),
                content: '',
                updated: stamp.slice(0, 14),
                created: stamp.slice(0, 14),
                sort: 1,
            });
            return [{ doOperations: [{ id: listID }] }];
        }
        if (pathname === '/api/sqlite/flushTransaction') return null;
        if (pathname === '/api/block/appendBlock') {
            const parent = blocks.get(body.parentID);
            if (!parent) throw new Error('append parent not found');
            createdBlockSequence += 1;
            const stamp = `202607200100${String(createdBlockSequence).padStart(2, '0')}`;
            const listID = `${stamp}-list`;
            const taskID = `${stamp}-task`;
            const title = String(body.data || '').replace(/^\s*[*+-]\s+\[[ xX-]\]\s*/, '').split('\n')[0];
            const rootID = parent.type === 'd' ? parent.id : parent.root_id;
            const nextSort = Array.from(blocks.values()).filter((item) => item.parent_id === parent.id).length + 1;
            blocks.set(listID, { id: listID, parent_id: parent.id, root_id: rootID, type: 'l', subtype: '', markdown: '', content: '', updated: stamp.slice(0, 14), created: stamp.slice(0, 14), sort: nextSort });
            blocks.set(taskID, { id: taskID, parent_id: listID, root_id: rootID, type: 'i', subtype: 't', markdown: String(body.data || ''), content: title, updated: stamp.slice(0, 14), created: stamp.slice(0, 14), sort: 1 });
            return [{ doOperations: [{ id: listID }] }];
        }
        if (pathname === '/api/filetree/createDocWithMd') {
            const parent = blocks.get(body.parentID);
            if (!parent || parent.type !== 'd') throw new Error('parent document not found');
            createdDocumentSequence += 1;
            const id = `202607210100${String(createdDocumentSequence).padStart(2, '0')}-doc`;
            const title = String(body.path || '').split('/').filter(Boolean).at(-1) || 'Untitled';
            const parentPath = String(parent.path || '').replace(/\.sy$/, '');
            blocks.set(id, {
                id,
                parent_id: '',
                root_id: id,
                type: 'd',
                subtype: '',
                markdown: String(body.markdown || ''),
                content: title,
                path: `${parentPath}/${id}.sy`,
                hpath: `${String(parent.hpath || '').replace(/\/$/, '')}/${title}`,
                updated: id.slice(0, 14),
                created: id.slice(0, 14),
                sort: 0,
            });
            return id;
        }
        if (pathname === '/api/block/deleteBlock') {
            const queue = [body.id];
            while (queue.length) {
                const id = queue.shift();
                Array.from(blocks.values()).filter((item) => item.parent_id === id).forEach((item) => queue.push(item.id));
                blocks.delete(id);
                attrs.delete(id);
            }
            return null;
        }
        throw new Error(`Unhandled API in contract test: ${pathname}`);
    }

    const siyuan = {
        plugin: { lifecycle: {} },
        rpc: {
            async bind(name, handler) { rpcCalls[name] = handler; },
            async unbind(name) { delete rpcCalls[name]; },
        },
        agent: options.agentAvailable === false ? undefined : {
            async registerCapability(name, schema, handler) {
                if (failNextToolRegistration === name) {
                    failNextToolRegistration = '';
                    throw new Error(`register failed: ${name}`);
                }
                mcpTools[name] = { schema, handler };
            },
            async unregisterCapability(name) { delete mcpTools[name]; },
        },
        mcp: options.legacyMcpAvailable === true ? {
            async registerTool(name, schema, handler) { mcpTools[name] = { schema, handler }; },
            async unregisterTool(name) { delete mcpTools[name]; },
        } : undefined,
        storage: {
            async get(name) {
                if (!storage.has(name)) throw new Error('not found');
                return { async text() { return storage.get(name); } };
            },
            async put(name, content) { storage.set(name, String(content)); },
        },
        client: {
            async fetch(pathname, requestOptions) {
                const requestBody = JSON.parse(requestOptions?.body || '{}');
                if (pathname === '/api/plugin/rpc?name=siyuan-plugin-docktomato') {
                    apiCalls.push({ pathname, body: JSON.parse(JSON.stringify(requestBody)), hasSignal: !!requestOptions?.signal });
                    const payload = typeof options.dockTomatoRpc === 'function'
                        ? await options.dockTomatoRpc(requestBody)
                        : { jsonrpc: '2.0', id: requestBody.id, error: { code: -32001, message: 'Plugin not loaded' } };
                    const status = Number(options.dockTomatoHttpStatus) || 200;
                    return { ok: status >= 200 && status < 300, status, async json() { return payload; } };
                }
                try {
                    const data = await api(pathname, requestBody);
                    return { ok: true, status: 200, async json() { return { code: 0, data }; } };
                } catch (error) {
                    return { ok: true, status: 200, async json() { return { code: -1, msg: error.message }; } };
                }
            },
        },
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'kernel.js'), 'utf8');
    vm.runInNewContext(source, {
        siyuan,
        console,
        setTimeout,
        clearTimeout,
        Date,
        Math,
        JSON,
        Map,
        Set,
        Promise,
        AbortController,
    });

    async function start() {
        await siyuan.plugin.lifecycle.onload();
    }

    async function call(name, ...args) {
        assert.equal(typeof rpcCalls[name], 'function', `${name} RPC should be bound`);
        return await rpcCalls[name](...args);
    }

    return {
        apiCalls,
        attrs,
        blocks,
        call,
        mcpTools,
        start,
        storage,
        failNextRegistration(name) { failNextToolRegistration = name; },
        failTransactionOnce() { failNextTransaction = true; },
        skipTransactionOnce() { skipNextTransaction = true; },
        skipMoveOnce() { skipNextMove = true; },
    };
}

async function run() {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'plugin.json'), 'utf8'));
    assert.equal(manifest.version, '2.9.4');
    assert.ok(Array.isArray(manifest.kernels) && manifest.kernels.includes('all'), 'plugin.json must enable the kernel plugin on supported backends');
    assert.equal(manifest.minAppVersion, '3.8.0', 'the release must require the SiYuan version whose plugin readOnly and startup RPC contracts were reviewed');

    const state1MigrationHarness = createHarness({
        initialAttrs: {
            [IDS.singleList]: {
                'custom-priority': 'high',
                'custom-status': 'done',
                'custom-data-assets-th-0': 'assets/legacy.pdf',
                'custom-data-assets-th-meta': JSON.stringify([{ path: 'assets/legacy.pdf', addedAt: 42 }]),
                'custom-tomato-reminder': JSON.stringify({ taskId: IDS.singleTask, enabled: true }),
                bookmark: '⏰',
                'custom-unrelated-extension': 'keep-parent',
            },
            [IDS.singleTask]: {
                'custom-status': '',
                'custom-unrelated-item': 'keep-item',
            },
        },
    });
    await state1MigrationHarness.start();
    assert.equal(state1MigrationHarness.attrs.get(IDS.singleTask)['custom-priority'], 'high');
    assert.equal(state1MigrationHarness.attrs.get(IDS.singleTask)['custom-status'], '', 'an explicit item value must win a migration conflict');
    assert.equal(state1MigrationHarness.attrs.get(IDS.singleTask)['custom-data-assets-th-0'], 'assets/legacy.pdf');
    assert.equal(state1MigrationHarness.attrs.get(IDS.singleTask).bookmark, '⏰');
    assert.equal(state1MigrationHarness.attrs.get(IDS.singleTask)['custom-unrelated-item'], 'keep-item');
    assert.equal(state1MigrationHarness.attrs.get(IDS.singleList)['custom-priority'], '');
    assert.equal(state1MigrationHarness.attrs.get(IDS.singleList)['custom-status'], 'done');
    assert.equal(state1MigrationHarness.attrs.get(IDS.singleList)['custom-data-assets-th-0'], '');
    assert.equal(state1MigrationHarness.attrs.get(IDS.singleList)['custom-tomato-reminder'], '');
    assert.equal(state1MigrationHarness.attrs.get(IDS.singleList).bookmark, '');
    assert.equal(state1MigrationHarness.attrs.get(IDS.singleList)['custom-unrelated-extension'], 'keep-parent');
    const state1MigrationReport = JSON.parse(state1MigrationHarness.storage.get('task-attr-storage.json'));
    assert.equal(state1MigrationReport.version, 1);
    assert.deepEqual(state1MigrationReport.conflicts[0].keys, ['custom-status']);
    const migrationTransactionCount = state1MigrationHarness.apiCalls.filter((call) => call.pathname === '/api/transactions').length;
    await state1MigrationHarness.start();
    assert.equal(
        state1MigrationHarness.apiCalls.filter((call) => call.pathname === '/api/transactions').length,
        migrationTransactionCount,
        'a completed versioned migration must not run again',
    );

    const state3MigrationHarness = createHarness({
        initialAttrs: {
            [IDS.multiList]: {
                'custom-task-horizon-attr-host-owner': IDS.firstTask,
                'custom-task-horizon-attr-host-updated-at': '1',
                'custom-start-date': '2026-08-15',
                'custom-priority': 'low',
                'custom-unrelated-extension': 'keep-state3-parent',
            },
            [IDS.firstTask]: { 'custom-priority': 'high' },
        },
    });
    await state3MigrationHarness.start();
    assert.equal(state3MigrationHarness.attrs.get(IDS.firstTask)['custom-start-date'], '2026-08-15');
    assert.equal(state3MigrationHarness.attrs.get(IDS.firstTask)['custom-priority'], 'high');
    assert.equal(state3MigrationHarness.attrs.get(IDS.multiList)['custom-start-date'], '');
    assert.equal(state3MigrationHarness.attrs.get(IDS.multiList)['custom-priority'], 'low');
    assert.equal(state3MigrationHarness.attrs.get(IDS.multiList)['custom-task-horizon-attr-host-owner'], IDS.firstTask,
        'a parent owner marker must remain while a managed conflict remains');
    assert.equal(state3MigrationHarness.attrs.get(IDS.multiList)['custom-unrelated-extension'], 'keep-state3-parent');

    const ambiguousMigrationHarness = createHarness({
        initialAttrs: { [IDS.multiList]: { 'custom-priority': 'medium' } },
    });
    await ambiguousMigrationHarness.start();
    assert.equal(ambiguousMigrationHarness.attrs.get(IDS.firstTask), undefined);
    assert.equal(JSON.parse(ambiguousMigrationHarness.storage.get('task-attr-storage.json')).skippedAmbiguous.length, 1,
        'a shared list without an owner must not be guessed');

    const state2OwnerMigrationHarness = createHarness({
        initialAttrs: {
            [IDS.multiList]: {
                'custom-task-horizon-attr-host-owner': IDS.secondTask,
                'custom-priority': 'medium',
            },
        },
    });
    await state2OwnerMigrationHarness.start();
    assert.equal(state2OwnerMigrationHarness.attrs.get(IDS.secondTask), undefined);
    assert.equal(JSON.parse(state2OwnerMigrationHarness.storage.get('task-attr-storage.json')).skippedOwner.length, 1,
        'a state-2 owner must never take attributes from its shared parent list');

    const failedMigrationHarness = createHarness({
        initialAttrs: { [IDS.singleList]: { 'custom-priority': 'high' } },
    });
    failedMigrationHarness.failTransactionOnce();
    await assert.rejects(failedMigrationHarness.start(), /任务属性迁移未完成/);
    const failedMigrationReport = JSON.parse(failedMigrationHarness.storage.get('task-attr-storage.json'));
    assert.equal(failedMigrationReport.version, 0);
    assert.equal(failedMigrationReport.status, 'failed');

    const harness = createHarness();
    await harness.start();

    const initialCapabilities = await harness.call('taskHorizonGetCapabilities');
    assert.equal(initialCapabilities.ok, true);
    assert.equal(initialCapabilities.data.totalToolCount, 24);
    assert.equal(initialCapabilities.data.mcpAuthorized, false);
    assert.equal(initialCapabilities.data.mcpEnabled, false);
    assert.equal(initialCapabilities.data.registeredToolCount, 0, 'kernel startup must not restore MCP tools before entitlement verification');
    assert.equal(initialCapabilities.data.toolGroups.length, 6);

    const focusAssociation = (candidateIds, focusSec, sessionKey, buckets = []) => ({
        candidateIds,
        focusSec,
        countdownSec: focusSec,
        stopwatchSec: 0,
        distractionCount: 0,
        sessionCount: 1,
        focusSessionCount: 1,
        completedSessionCount: 1,
        countdownSessionCount: 1,
        stopwatchSessionCount: 0,
        lastEndMs: Date.parse('2026-07-15T10:00:00+08:00'),
        buckets,
    });
    const focusBucket = (focusSec, sessionKey) => ({
        key: '2026-07-15',
        from: '2026-07-15T00:00:00+08:00',
        to: '2026-07-16T00:00:00+08:00',
        focusSec,
        countdownSec: focusSec,
        stopwatchSec: 0,
        distractionCount: 0,
        sessionCount: 1,
        focusSessionCount: 1,
        completedSessionCount: 1,
        countdownSessionCount: 1,
        stopwatchSessionCount: 0,
        lastEndMs: Date.parse('2026-07-15T10:00:00+08:00'),
    });
    const rawFocusStats = {
        contractVersion: 2,
        range: { from: '2026-07-15T00:00:00+08:00', to: '2026-07-16T00:00:00+08:00', bucket: 'day' },
        associations: [
            focusAssociation(['root-alias'], 600, 'root-session', [focusBucket(600, 'root-session')]),
            focusAssociation(['child-alias'], 1200, 'child-session', [focusBucket(1200, 'child-session')]),
            focusAssociation([], 300, 'unattributed-session', [focusBucket(300, 'unattributed-session')]),
        ],
        meta: { source: 'contract-test' },
    };
    const focusSnapshot = {
        revision: 7,
        tasks: [
            { id: IDS.singleTask, aliasIDs: ['root-alias'], title: 'Root', documentID: IDS.doc, customFieldValues: { labels: ['deep'] } },
            { id: IDS.childTask, aliasIDs: ['child-alias'], parentTaskID: IDS.singleTask, title: 'Child', documentID: IDS.doc, customFieldValues: { labels: ['deep', 'urgent'] } },
        ],
    };
    const globalFocus = await harness.call('taskHorizonProjectFocusStatistics', rawFocusStats, {
        bucket: 'day',
        groupBy: 'customField',
        customFieldID: 'labels',
        rootTaskID: IDS.singleTask,
    }, focusSnapshot);
    assert.equal(globalFocus.ok, true);
    assert.equal(globalFocus.data.totals.focusSec, 2100, 'global focus totals must include unattributed history');
    assert.equal(globalFocus.data.totals.sessionCount, 3);
    assert.equal(Object.hasOwn(globalFocus.data.totals, 'sessionKeys'), false, 'v2 projection must keep scalar session counts only');
    assert.equal(globalFocus.data.unattributed.focusSec, 300);
    assert.equal(globalFocus.data.parentDetail.self.focusSec, 600);
    assert.equal(globalFocus.data.parentDetail.descendants.focusSec, 1200);
    assert.equal(globalFocus.data.parentDetail.combined.focusSec, 1800);
    assert.equal(globalFocus.data.classification.find((item) => item.id === 'deep').focusSec, 1800);
    assert.equal(globalFocus.data.classification.find((item) => item.id === 'urgent').focusSec, 1200, 'multi-select values must each receive the full task duration');
    assert.equal(globalFocus.data.meta.taskSnapshotRevision, 7);
    const scopedFocus = await harness.call('taskHorizonProjectFocusStatistics', rawFocusStats, {
        bucket: 'day',
        groupBy: 'task',
        taskIDs: [IDS.childTask],
    }, focusSnapshot);
    assert.equal(scopedFocus.ok, true);
    assert.equal(scopedFocus.data.totals.focusSec, 1200);
    assert.equal(scopedFocus.data.tasks.length, 1);
    assert.equal(scopedFocus.data.unattributed.focusSec, 0, 'explicit task scopes must exclude unattributed history');
    const emptyFocus = await harness.call('taskHorizonProjectFocusStatistics', rawFocusStats, {
        bucket: 'day',
        groupBy: 'task',
        taskIDs: [],
    }, focusSnapshot);
    assert.equal(emptyFocus.ok, true);
    assert.equal(emptyFocus.data.totals.focusSec, 0, 'an explicitly empty document-group scope must not fall back to global statistics');
    assert.equal(emptyFocus.data.tasks.length, 0);

    const oversizedCustomSnapshot = {
        revision: 8,
        tasks: [{
            id: IDS.singleTask,
            aliasIDs: ['root-alias'],
            title: 'Root',
            documentID: IDS.doc,
            customFieldValues: { oversized: 'x'.repeat(8 * 1024 * 1024 + 1) },
        }],
    };
    const projectedOversizedFocus = await harness.call('taskHorizonProjectFocusStatistics', {
        ...rawFocusStats,
        associations: [focusAssociation(['root-alias'], 600, 'root-session', [])],
    }, { groupBy: 'task' }, oversizedCustomSnapshot);
    assert.equal(projectedOversizedFocus.ok, true,
        'unused custom fields must be projected out before Kernel snapshot byte accounting');
    const rejectedOversizedFocus = await harness.call('taskHorizonProjectFocusStatistics', {
        ...rawFocusStats,
        associations: [focusAssociation(['root-alias'], 600, 'root-session', [])],
    }, {
        groupBy: 'customField',
        customFieldID: 'oversized',
    }, oversizedCustomSnapshot);
    assert.equal(rejectedOversizedFocus.ok, false);
    assert.equal(rejectedOversizedFocus.error.code, 'FOCUS_SCOPE_TOO_LARGE');
    assert.equal(rejectedOversizedFocus.error.details.maxSnapshotBytes, 8 * 1024 * 1024);

    const batchFocusStart = harness.apiCalls.length;
    const directFocusStats = {
        ...rawFocusStats,
        associations: [
            focusAssociation([IDS.childBlock], 600, 'root-direct', []),
            focusAssociation([IDS.childList], 1200, 'child-direct', []),
        ],
    };
    const batchFocus = await harness.call('taskHorizonProjectFocusStatistics', directFocusStats, { groupBy: 'task' });
    assert.equal(batchFocus.ok, true);
    assert.equal(batchFocus.data.tasks.length, 2);
    const batchFocusSqlCalls = harness.apiCalls.slice(batchFocusStart)
        .filter((item) => item.pathname === '/api/query/sql');
    assert.ok(batchFocusSqlCalls.length <= 5,
        `focus task projection must batch ancestor and task reads, received ${batchFocusSqlCalls.length} SQL calls`);

    const missingFocusStart = harness.apiCalls.length;
    const missingFocusStats = {
        ...rawFocusStats,
        associations: Array.from({ length: 5000 }, (_, index) => (
            focusAssociation([`20260103000000-missing-${index}`], 1, `missing-${index}`, [])
        )),
    };
    const missingFocus = await harness.call('taskHorizonProjectFocusStatistics', missingFocusStats, { groupBy: 'task' });
    assert.equal(missingFocus.ok, true);
    assert.equal(missingFocus.data.tasks.length, 0);
    const missingFocusSqlCalls = harness.apiCalls.slice(missingFocusStart)
        .filter((item) => item.pathname === '/api/query/sql');
    assert.ok(missingFocusSqlCalls.length <= 25,
        `5000 missing associations must use chunked negative lookup, received ${missingFocusSqlCalls.length} SQL calls`);
    const focusKernelSource = fs.readFileSync(path.join(__dirname, '..', 'kernel.js'), 'utf8');
    const focusProjectionSource = focusKernelSource.slice(
        focusKernelSource.indexOf('function taskMatchesFocusScope('),
        focusKernelSource.indexOf('async function queryFocusStatistics('),
    );
    assert.match(focusProjectionSource, /const scopeTaskIDs = new Set\(scope\?\.taskIDs \|\| \[\]\)/,
        'focus projection must build task-scope membership once');
    assert.match(focusProjectionSource, /const scopeDocumentIDs = new Set\(scope\?\.documentIDs \|\| \[\]\)/,
        'focus projection must build document-scope membership once');
    assert.doesNotMatch(focusProjectionSource, /scope\.(?:taskIDs|documentIDs)\.includes\(/,
        'focus association scans must not perform linear scope membership checks');

    const bridgeHarness = createHarness({
        dockTomatoRpc(request) {
            const data = request.method === 'dockTomatoQueryFocus'
                ? {
                    contractVersion: 2,
                    range: {},
                    totals: { focusSec: 0 },
                    buckets: [],
                    associations: [],
                    meta: { source: 'fallback-memory', revision: 17 },
                }
                : (request.method === 'dockTomatoQueryRoutine'
                    ? { contractVersion: 2, groups: [], totals: { focusSec: 0 }, buckets: [], meta: { source: 'indexed-shards', revision: 18 } }
                    : { contractVersion: 2, items: [], meta: { source: 'indexed-shards', revision: 19 } });
            return { jsonrpc: '2.0', id: request.id, result: { ok: true, data, error: null } };
        },
    });
    await bridgeHarness.start();
    const bridgeRange = {
        from: '2026-07-15T00:00:00.000Z',
        to: '2026-07-16T00:00:00.000Z',
        bucket: 'day',
        rootTaskID: IDS.singleTask,
    };
    const bridgedFocus = await bridgeHarness.call('taskHorizonQueryFocusStatistics', bridgeRange);
    assert.equal(bridgedFocus.ok, true, 'Task Horizon must query focus data through DockTomato\'s Kernel RPC');
    assert.equal(bridgedFocus.data.meta.source, 'fallback-memory', 'DockTomato fallback metadata must pass through unchanged');
    assert.equal(bridgedFocus.data.meta.revision, 17);
    const bridgedRoutine = await bridgeHarness.call('taskHorizonQueryRoutineStatistics', bridgeRange);
    assert.equal(bridgedRoutine.ok, true);
    const bridgedSessions = await bridgeHarness.call('taskHorizonListFocusSessions', bridgeRange);
    assert.equal(bridgedSessions.ok, true);
    const dockRpcCalls = bridgeHarness.apiCalls.filter((item) => item.pathname === '/api/plugin/rpc?name=siyuan-plugin-docktomato');
    assert.deepEqual(dockRpcCalls.map((item) => item.body.method), [
        'dockTomatoQueryFocus',
        'dockTomatoQueryRoutine',
        'dockTomatoListSessions',
    ]);
    assert.ok(dockRpcCalls.every((item) => Array.isArray(item.body.params) && item.body.params.length === 1));
    assert.ok(dockRpcCalls.every((item) => Number(item.body.params[0].deadlineAt) > Date.now()),
        'all direct Task Horizon statistics RPCs must share a total deadline with DockTomato');
    assert.ok(dockRpcCalls.every((item) => item.hasSignal),
        'Task Horizon must make DockTomato RPC response reads abortable');
    assert.deepEqual(dockRpcCalls[0].body.params[0].candidateIDs, [IDS.childTask, IDS.singleTask].sort(),
        'root-task descendants must be resolved before DockTomato aggregates associations');
    assert.equal(dockRpcCalls[0].body.params[0].candidateIDsConstrainTotals, true,
        'direct Kernel statistics must constrain totals to the resolved semantic scope');
    const rootScopeSql = bridgeHarness.apiCalls
        .filter((item) => item.pathname === '/api/query/sql')
        .map((item) => String(item.body?.stmt || ''))
        .find((statement) => statement.includes('WITH RECURSIVE task_tree(id, depth)'));
    assert.match(rootScopeSql, /JOIN blocks child_list[\s\S]*child_list\.type = 'l'/,
        'root scope recursion must traverse only child lists owned by a task');
    assert.match(rootScopeSql, /JOIN blocks child[\s\S]*child\.type = 'i'[\s\S]*child\.subtype = 't'/,
        'root scope recursion must enqueue only nested task items');
    assert.match(rootScopeSql, /WHERE task_tree\.depth < 128\s+LIMIT 10001/,
        'the recursive CTE itself must stop after the bounded task budget');
    assert.equal(bridgeHarness.apiCalls.some((item) => item.pathname === '/api/file/getFile'), false,
        'Task Horizon must not read DockTomato history or source files directly');
    const dockCallsBeforeExpired = dockRpcCalls.length;
    const expiredStats = await bridgeHarness.call('taskHorizonQueryFocusStatistics', {
        ...bridgeRange,
        deadlineAt: Date.now() - 1,
    });
    assert.equal(expiredStats.ok, false);
    assert.equal(expiredStats.error.code, 'STATS_QUERY_EXPIRED');
    assert.equal(bridgeHarness.apiCalls.filter((item) => item.pathname === '/api/plugin/rpc?name=siyuan-plugin-docktomato').length,
        dockCallsBeforeExpired, 'an expired direct query must stop before DockTomato RPC');
    const nonTaskScope = await bridgeHarness.call('taskHorizonResolveFocusCandidateIDs', {
        rootTaskID: IDS.childBlock,
    });
    assert.equal(nonTaskScope.ok, false);
    assert.equal(nonTaskScope.error.code, 'INVALID_ARGUMENT',
        'a non-task root must fail closed instead of being treated as a task candidate');

    let deepParentID = IDS.singleTask;
    for (let depth = 1; depth <= 128; depth += 1) {
        const listID = `20260102000000-depth${depth}list`;
        const taskID = `20260102000000-depth${depth}task`;
        bridgeHarness.blocks.set(listID, {
            id: listID,
            parent_id: deepParentID,
            root_id: IDS.doc,
            type: 'l',
            subtype: '',
            markdown: '',
            content: '',
            updated: '20260102000000',
            created: '20260102000000',
            sort: depth,
        });
        bridgeHarness.blocks.set(taskID, {
            id: taskID,
            parent_id: listID,
            root_id: IDS.doc,
            type: 'i',
            subtype: 't',
            markdown: '* [ ] Deep task',
            content: 'Deep task',
            updated: '20260102000000',
            created: '20260102000000',
            sort: 1,
        });
        deepParentID = taskID;
    }
    const deepScope = await bridgeHarness.call('taskHorizonQueryFocusStatistics', bridgeRange);
    assert.equal(deepScope.ok, false);
    assert.equal(deepScope.error.code, 'FOCUS_SCOPE_TOO_LARGE',
        'a root scope beyond the supported depth must fail closed instead of truncating candidates');
    assert.equal(bridgeHarness.apiCalls.filter((item) => item.pathname === '/api/plugin/rpc?name=siyuan-plugin-docktomato').length,
        dockCallsBeforeExpired, 'an over-deep root scope must fail before DockTomato RPC');

    const unavailableStatsHarness = createHarness();
    await unavailableStatsHarness.start();
    const unavailableStats = await unavailableStatsHarness.call('taskHorizonQueryRoutineStatistics', bridgeRange);
    assert.equal(unavailableStats.ok, false);
    assert.equal(unavailableStats.error.code, 'DOCK_TOMATO_STATS_UNAVAILABLE');

    const failedStatsHttpHarness = createHarness({ dockTomatoHttpStatus: 503 });
    await failedStatsHttpHarness.start();
    const failedStatsHttp = await failedStatsHttpHarness.call('taskHorizonListFocusSessions', bridgeRange);
    assert.equal(failedStatsHttp.ok, false);
    assert.equal(failedStatsHttp.error.code, 'DOCK_TOMATO_STATS_UNAVAILABLE');

    const failedStatsStorageHarness = createHarness({
        dockTomatoRpc(request) {
            return {
                jsonrpc: '2.0',
                id: request.id,
                result: {
                    ok: false,
                    data: null,
                    error: {
                        code: 'HISTORY_SOURCE_UNAVAILABLE',
                        message: 'history read failed',
                        details: { source: 'indexed-shards' },
                    },
                },
            };
        },
    });
    await failedStatsStorageHarness.start();
    const failedStatsStorage = await failedStatsStorageHarness.call('taskHorizonQueryFocusStatistics', bridgeRange);
    assert.equal(failedStatsStorage.ok, false);
    assert.equal(failedStatsStorage.error.code, 'HISTORY_SOURCE_UNAVAILABLE', 'DockTomato storage errors must not become empty statistics');
    assert.equal(failedStatsStorage.error.details.source, 'indexed-shards', 'DockTomato error details must survive the RPC boundary');

    const unsupportedHarness = createHarness({ agentAvailable: false });
    await unsupportedHarness.start();
    const unsupportedCapabilities = await unsupportedHarness.call('taskHorizonGetCapabilities');
    assert.equal(unsupportedCapabilities.ok, true);
    assert.equal(unsupportedCapabilities.data.mcpAvailable, false);
    const unsupportedEntitlement = await unsupportedHarness.call('taskHorizonSyncMcpEntitlement', { allowed: true });
    assert.equal(unsupportedEntitlement.ok, false, 'missing Agent capability APIs must fail without a runtime TypeError');
    assert.equal(unsupportedEntitlement.error.code, 'UNSUPPORTED');
    assert.match(unsupportedEntitlement.error.message, /Agent 能力接口/);

    const legacyHarness = createHarness({ agentAvailable: false, legacyMcpAvailable: true });
    await legacyHarness.start();
    assert.equal((await legacyHarness.call('taskHorizonGetCapabilities')).data.mcpAvailable, true);
    const legacyEntitlement = await legacyHarness.call('taskHorizonSyncMcpEntitlement', { allowed: true });
    assert.equal(legacyEntitlement.ok, true, 'legacy siyuan.mcp runtimes must remain supported');
    assert.equal(legacyHarness.mcpTools.query_tasks.schema.readOnly, true);

    const freeEnable = await harness.call('taskHorizonSetMcpEnabled', true);
    assert.equal(freeEnable.ok, false, 'an unauthorized kernel client must not enable MCP tools');
    assert.equal(freeEnable.error.code, 'UNSUPPORTED');
    const freeEntitlement = await harness.call('taskHorizonSyncMcpEntitlement', { allowed: false });
    assert.equal(freeEntitlement.ok, true);
    assert.equal(freeEntitlement.data.mcpEnabled, false);
    assert.equal(freeEntitlement.data.registeredToolCount, 0);
    const proEntitlement = await harness.call('taskHorizonSyncMcpEntitlement', { allowed: true });
    assert.equal(proEntitlement.ok, true);
    assert.equal(proEntitlement.data.mcpAuthorized, true);
    assert.equal(proEntitlement.data.mcpEnabled, true, 'verified Pro entitlement must restore the persisted MCP preference');
    assert.equal(proEntitlement.data.registeredToolCount, 24);
    const expectedMcpToolNames = [
        'list_task_scopes', 'get_task', 'query_tasks', 'create_task', 'update_task', 'move_task', 'delete_task', 'batch_tasks',
        'query_schedules', 'create_schedule', 'update_schedule', 'delete_schedule', 'batch_schedules', 'apply_task_operation_plan',
        'configure_task_reminder', 'manage_agent_schedules', 'get_task_policy', 'preview_task_policy_patch', 'apply_task_policy_patch',
        'aggregate_task_stats', 'aggregate_time_usage', 'query_focus_statistics', 'query_routine_statistics', 'list_focus_sessions',
    ];
    assert.deepEqual(Object.keys(harness.mcpTools).sort(), expectedMcpToolNames.slice().sort(), 'all 24 configured tools must register a handler');
    expectedMcpToolNames.forEach((name) => {
        const tool = harness.mcpTools[name];
        assert.equal(typeof tool?.handler, 'function', `${name} must register a callable handler`);
        assert.equal(tool?.schema?.inputSchema?.type, 'object', `${name} must register an object input schema`);
        assert.ok(tool?.schema?.effects || tool?.schema?.actionEffects, `${name} must declare capability effects`);
    });
    assert.equal(proEntitlement.data.toolGroups.flatMap((group) => group.tools).find((tool) => tool.name === 'query_tasks').readOnly, true);
    assert.equal(harness.mcpTools.query_tasks.schema.effects.localRead, true, 'plugin read capabilities must declare localRead');
    assert.equal(harness.mcpTools.aggregate_task_stats.schema.effects.localRead, true);
    assert.equal(harness.mcpTools.create_task.schema.effects.localWrite, true, 'plugin write capabilities must declare localWrite');
    assert.equal(harness.mcpTools.delete_task.schema.actionEffects.get.localRead, true, 'mixed capabilities must declare read actions precisely');
    assert.equal(harness.mcpTools.delete_task.schema.actionEffects.delete.localWrite, true, 'mixed capabilities must declare write actions precisely');
    assert.equal(harness.mcpTools.manage_agent_schedules.schema.actionEffects.list.localRead, true);
    assert.equal(harness.mcpTools.manage_agent_schedules.schema.actionEffects.create.localWrite, true);
    assert.equal(Object.prototype.hasOwnProperty.call(harness.mcpTools.query_tasks.schema, 'readOnly'), false, 'legacy MCP metadata must not leak into Agent capability config');

    const statsOff = await harness.call('taskHorizonSetMcpToolConfig', { groupID: 'stats', enabled: false });
    assert.equal(statsOff.ok, true);
    assert.equal(statsOff.data.registeredToolCount, 19);
    assert.equal(harness.mcpTools.aggregate_task_stats, undefined);
    assert.equal(harness.mcpTools.aggregate_time_usage, undefined);
    const oneStatOn = await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'aggregate_task_stats', enabled: true });
    assert.equal(oneStatOn.ok, true);
    assert.ok(harness.mcpTools.aggregate_task_stats);
    assert.equal(harness.mcpTools.aggregate_time_usage, undefined);
    await harness.call('taskHorizonSetMcpToolConfig', { groupID: 'stats', enabled: true });

    const createOff = await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'create_task', enabled: false });
    assert.equal(createOff.ok, true);
    assert.equal(harness.mcpTools.create_task, undefined);
    const guardedBatch = await harness.mcpTools.batch_tasks.handler({
        action: 'get',
        phase: 'preview',
        operations: [{ action: 'create', title: 'Must stay blocked', documentID: IDS.doc }],
    });
    assert.equal(guardedBatch.ok, false);
    assert.equal(guardedBatch.error.code, 'UNSUPPORTED');
    harness.failNextRegistration('create_task');
    const failedCreateOn = await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'create_task', enabled: true });
    assert.equal(failedCreateOn.ok, false, 'failed MCP registration must surface to the caller');
    assert.equal(harness.mcpTools.create_task, undefined, 'failed MCP registration must restore the previous registered tool set');
    assert.equal(JSON.parse(harness.storage.get('agent-mcp-config.json')).tools.create_task, false, 'failed MCP registration must restore the previous persisted config');
    await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'create_task', enabled: true });
    const storedMcpConfig = JSON.parse(harness.storage.get('agent-mcp-config.json'));
    assert.equal(storedMcpConfig.schemaVersion, 2);
    assert.equal(storedMcpConfig.tools.create_task, true);
    await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'update_task', enabled: false });
    const guardedPatchBatch = await harness.mcpTools.batch_tasks.handler({
        action: 'get',
        phase: 'preview',
        operations: [{ action: 'patch', taskID: IDS.singleTask, patch: { priority: 'must-stay-blocked' } }],
    });
    assert.equal(guardedPatchBatch.ok, false);
    assert.equal(guardedPatchBatch.error.code, 'UNSUPPORTED');
    assert.deepEqual(Array.from(guardedPatchBatch.error.details.tools), ['update_task']);
    await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'update_task', enabled: true });

    const resolved = await harness.call('taskHorizonResolveTaskBinding', IDS.childBlock);
    assert.equal(resolved.ok, true);
    assert.equal(resolved.data.taskID, IDS.singleTask);
    assert.equal(resolved.data.primaryHostID, IDS.singleTask);
    assert.deepEqual(Array.from(resolved.data.mirrorHostIDs), []);

    const invalidCreateTarget = await harness.call('taskHorizonCreateTask', { title: 'Invalid target', documentID: IDS.childBlock });
    assert.equal(invalidCreateTarget.ok, false);
    assert.equal(invalidCreateTarget.error.code, 'INVALID_ARGUMENT');
    assert.match(harness.mcpTools.create_task.schema.description, /^任务管理器插件：/, 'MCP tools must identify the task manager plugin in their descriptions');
    assert.match(harness.mcpTools.create_task.schema.description, /无需预览/, 'single-task creation must advertise its direct path');
    const directCreate = await harness.mcpTools.create_task.handler({ action: 'create', title: 'Direct task', documentID: IDS.doc });
    assert.equal(directCreate.ok, true);
    assert.equal(directCreate.data.task.title, 'Direct task');
    assert.equal(directCreate.data.task.documentID, IDS.doc);
    assert.equal(directCreate.data.refresh.kind, 'task-mutation');
    assert.equal(directCreate.data.refresh.action, 'create');
    assert.deepEqual(Array.from(directCreate.data.refresh.documentIDs), [IDS.doc]);
    const undoCreated = await harness.mcpTools.create_task.handler({ action: 'create', title: 'Undo-created task', documentID: IDS.doc });
    assert.equal(undoCreated.ok, true);
    assert.match(undoCreated.data.undoID, /^undo_/, 'reversible writes must return their undo ID');
    const unrelatedCreate = await harness.mcpTools.create_task.handler({ action: 'create', title: 'Other write', documentID: IDS.doc });
    assert.equal(unrelatedCreate.ok, true);
    const staleUndo = await harness.call('taskHorizonUndoLastMutation', { undoID: undoCreated.data.undoID });
    assert.equal(staleUndo.ok, false, 'an older receipt must not undo a newer write');
    assert.equal(staleUndo.error.code, 'NOT_FOUND');
    const undoCreatedResult = await harness.call('taskHorizonUndoLastMutation', { undoID: unrelatedCreate.data.undoID });
    assert.equal(undoCreatedResult.ok, true);
    assert.equal(undoCreatedResult.data.data.refresh.action, 'delete');
    assert.deepEqual(Array.from(undoCreatedResult.data.data.refresh.taskIDs), [unrelatedCreate.data.task.id]);

    const invalidMoveTarget = await harness.call('taskHorizonMoveTask', { taskID: IDS.firstTask, parentID: IDS.childBlock });
    assert.equal(invalidMoveTarget.ok, false);
    assert.equal(invalidMoveTarget.error.code, 'INVALID_ARGUMENT');
    const invalidPreviousTarget = await harness.call('taskHorizonMoveTask', { taskID: IDS.firstTask, previousID: IDS.doc });
    assert.equal(invalidPreviousTarget.ok, false);
    assert.equal(invalidPreviousTarget.error.code, 'INVALID_ARGUMENT');
    const unrelatedMoveListIDs = Array.from({ length: 12 }, (_, index) => `202608150300${String(index).padStart(2, '0')}-perflst`);
    unrelatedMoveListIDs.forEach((listID, index) => {
        const taskID = `202608150301${String(index).padStart(2, '0')}-perftsk`;
        harness.blocks.set(listID, { id: listID, parent_id: IDS.doc, root_id: IDS.doc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260815030000', created: `202608150300${String(index).padStart(2, '0')}`, sort: 200 + index });
        harness.blocks.set(taskID, { id: taskID, parent_id: listID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Unrelated move task', content: 'Unrelated move task', updated: '20260815030100', created: `202608150301${String(index).padStart(2, '0')}`, sort: 1 });
    });
    const moveBeforeCallStart = harness.apiCalls.length;
    const moveBefore = await harness.call('taskHorizonMoveTask', {
        taskID: IDS.firstTask,
        nextID: IDS.secondTask,
        targetListID: IDS.multiList,
    });
    assert.equal(moveBefore.ok, true);
    assert.equal(moveBefore.data.refresh.action, 'move');
    assert.deepEqual(Array.from(moveBefore.data.refresh.taskIDs), [IDS.firstTask]);
    assert.deepEqual(Array.from(moveBefore.data.refresh.documentIDs), [IDS.doc]);
    const moveRequest = harness.apiCalls.filter((item) => item.pathname === '/api/block/moveBlock').at(-1)?.body || {};
    assert.equal(moveRequest.nextID, undefined, 'nextID must be translated before calling the SiYuan move API');
    assert.equal(moveRequest.parentID, IDS.multiList);
    const moveBeforeChildReads = harness.apiCalls.slice(moveBeforeCallStart)
        .filter((item) => item.pathname === '/api/block/getChildBlocks');
    assert.equal(moveBeforeChildReads.some((item) => unrelatedMoveListIDs.includes(String(item.body?.id || ''))), false,
        'a same-level move with a verified list hint must not scan unrelated document lists');
    assert.ok(moveBeforeChildReads.length <= 6,
        'same-level move tree reads must stay constant as unrelated document lists grow');
    const moveUndo = await harness.call('taskHorizonUndoLastMutation', {});
    assert.equal(moveUndo.ok, true);
    assert.equal(moveUndo.data.data.refresh.action, 'move');
    const moveUndoRequest = harness.apiCalls.filter((item) => item.pathname === '/api/block/moveBlock').at(-1)?.body || {};
    assert.equal(moveUndoRequest.nextID, undefined, 'move undo must use the same SiYuan-compatible placement resolver');
    unrelatedMoveListIDs.forEach((listID, index) => {
        harness.blocks.delete(`202608150301${String(index).padStart(2, '0')}-perftsk`);
        harness.blocks.delete(listID);
    });

    const authoritativeMove = await harness.call('taskHorizonMoveTask', {
        taskID: IDS.secondTask,
        previousID: IDS.firstTask,
        authoritative: true,
        recordUndo: false,
    });
    assert.equal(authoritativeMove.ok, true);
    assert.equal(authoritativeMove.data.authoritative, true);
    assert.equal(authoritativeMove.data.placement.parentListID, IDS.multiList);
    assert.equal(authoritativeMove.data.placement.previousSiblingID, IDS.firstTask);
    assert.equal(authoritativeMove.data.placement.documentID, IDS.doc);
    assert.equal(authoritativeMove.data.task.parentListID, IDS.multiList);
    assert.equal(authoritativeMove.data.task.previousSiblingID, IDS.firstTask);

    const staleHintSourceListID = '20260815030300-stalsrc';
    const staleHintSourceTaskID = '20260815030301-stalt01';
    const staleHintTargetListID = '20260815030302-staltgt';
    const staleHintTargetTaskID = '20260815030303-stalt02';
    harness.blocks.set(staleHintSourceListID, { id: staleHintSourceListID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260815030300', created: '20260815030300', sort: 140 });
    harness.blocks.set(staleHintSourceTaskID, { id: staleHintSourceTaskID, parent_id: staleHintSourceListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Stale hint source', content: 'Stale hint source', updated: '20260815030301', created: '20260815030301', sort: 1 });
    harness.blocks.set(staleHintTargetListID, { id: staleHintTargetListID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260815030302', created: '20260815030302', sort: 141 });
    harness.blocks.set(staleHintTargetTaskID, { id: staleHintTargetTaskID, parent_id: staleHintTargetListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Stale hint target', content: 'Stale hint target', updated: '20260815030303', created: '20260815030303', sort: 1 });
    const staleHintMove = await harness.call('taskHorizonMoveTask', {
        taskID: staleHintSourceTaskID,
        previousID: staleHintTargetTaskID,
        targetListID: staleHintSourceListID,
        authoritative: true,
        recordUndo: false,
    });
    assert.equal(staleHintMove.ok, true);
    assert.equal(staleHintMove.data.placement.parentListID, staleHintTargetListID,
        'a stale list hint must fall back to the live tree instead of becoming structural truth');
    assert.equal(harness.blocks.get(staleHintSourceTaskID).parent_id, staleHintTargetListID);
    harness.blocks.delete(staleHintSourceTaskID);
    harness.blocks.delete(staleHintTargetTaskID);
    harness.blocks.delete(staleHintSourceListID);
    harness.blocks.delete(staleHintTargetListID);

    const moveKernelSource = fs.readFileSync(path.join(__dirname, '..', 'kernel.js'), 'utf8');
    const singleChildMoveSource = moveKernelSource.slice(
        moveKernelSource.indexOf('async function moveTaskIntoParent'),
        moveKernelSource.indexOf('async function verifyBatchChildMove'),
    );
    const directMoveSource = moveKernelSource.slice(
        moveKernelSource.indexOf('async function buildMovePlan'),
        moveKernelSource.indexOf('function applyPlacementToTaskDTO'),
    );
    const batchChildMoveSource = moveKernelSource.slice(
        moveKernelSource.indexOf('async function batchMoveTasksIntoParent'),
        moveKernelSource.indexOf('async function batchMoveTasks('),
    );
    assert.doesNotMatch(singleChildMoveSource, /await sql\(/,
        'single child moves must not use the asynchronous SQL index for structure');
    assert.doesNotMatch(directMoveSource, /await sql\(/,
        'same-level and document edge moves must not use the asynchronous SQL index for structure');
    assert.doesNotMatch(batchChildMoveSource, /await sql\(/,
        'batch child moves must not use the asynchronous SQL index for structure');
    assert.match(batchChildMoveSource, /capturePlacement\(id, rows\[index\]\)/,
        'batch moves must verify the already-read parent-list hint instead of scanning every document list');
    assert.match(singleChildMoveSource, /placementFromTaskList\(id, listID, await readTreeChildren\(listID\)/,
        'child moves must confirm their committed placement from the block tree');

    const unrelatedChildListID = '20260815030200-perflst';
    const unrelatedChildTaskID = '20260815030201-perftsk';
    harness.blocks.set(unrelatedChildListID, { id: unrelatedChildListID, parent_id: IDS.singleTask, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260815030200', created: '20260815030200', sort: 20 });
    harness.blocks.set(unrelatedChildTaskID, { id: unrelatedChildTaskID, parent_id: unrelatedChildListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Unrelated child-list task', content: 'Unrelated child-list task', updated: '20260815030201', created: '20260815030201', sort: 1 });
    const firstChildMoveCallStart = harness.apiCalls.length;
    const firstChildMove = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: IDS.firstTask,
        mode: 'child',
        parentTaskID: IDS.singleTask,
        requestedListID: IDS.childList,
        authoritative: true,
        recordUndo: false,
    });
    const secondChildMove = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: IDS.secondTask,
        mode: 'child',
        parentTaskID: IDS.singleTask,
        requestedListID: IDS.childList,
        authoritative: true,
        recordUndo: false,
    });
    assert.equal(firstChildMove.ok, true);
    assert.equal(secondChildMove.ok, true);
    assert.deepEqual(
        Array.from(harness.blocks.values())
            .filter((block) => block.parent_id === IDS.childList && block.type === 'i' && block.subtype === 't')
            .sort((left, right) => left.sort - right.sort)
            .map((block) => block.id),
        [IDS.childTask, IDS.firstTask, IDS.secondTask],
        'rapid consecutive child moves must retain both moved tasks in tree order',
    );
    assert.equal(firstChildMove.data.value.placement.parentListID, IDS.childList);
    assert.equal(secondChildMove.data.value.placement.previousSiblingID, IDS.firstTask);
    const firstChildMoveCalls = harness.apiCalls.slice(firstChildMoveCallStart);
    assert.equal(firstChildMoveCalls.some((item) => (
        item.pathname === '/api/block/getChildBlocks' && item.body?.id === unrelatedChildListID
    )), false, 'a preferred child list must avoid reads from unrelated lists under the same task');
    harness.blocks.delete(unrelatedChildTaskID);
    harness.blocks.delete(unrelatedChildListID);

    const nestedOwnerID = '20260815020000-nestown';
    const nestedSourceListID = '20260815020001-nestlst';
    const nestedSourceTaskID = '20260815020002-nesttsk';
    const nestedTargetListID = '20260815020003-tgtlist';
    harness.blocks.set(nestedOwnerID, { id: nestedOwnerID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'b', subtype: '', markdown: '', content: '', updated: '20260815020000', created: '20260815020000', sort: 50 });
    harness.blocks.set(nestedSourceListID, { id: nestedSourceListID, parent_id: nestedOwnerID, root_id: IDS.otherDoc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260815020001', created: '20260815020001', sort: 1 });
    harness.blocks.set(nestedSourceTaskID, { id: nestedSourceTaskID, parent_id: nestedSourceListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Nested source', content: 'Nested source', updated: '20260815020002', created: '20260815020002', sort: 1 });
    harness.blocks.set(nestedTargetListID, { id: nestedTargetListID, parent_id: IDS.otherTask, root_id: IDS.otherDoc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260815020003', created: '20260815020003', sort: 1 });
    const nestedSourceChildMove = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: nestedSourceTaskID,
        mode: 'child',
        parentTaskID: IDS.otherTask,
        requestedListID: nestedTargetListID,
        authoritative: true,
        recordUndo: false,
    });
    assert.equal(nestedSourceChildMove.ok, true,
        'a task list below an intermediate container must still resolve its source placement');
    assert.equal(nestedSourceChildMove.data.value.placement.parentListID, nestedTargetListID);

    const concurrentSourceListID = '20260815010000-racelst';
    const concurrentFirstTaskID = '20260815010001-racet01';
    const concurrentSecondTaskID = '20260815010002-racet02';
    const concurrentParentTaskID = '20260815010003-racepar';
    const concurrentFirstListID = '20260815010004-raceli1';
    const concurrentSecondListID = '20260815010005-raceli2';
    harness.blocks.set(concurrentSourceListID, { id: concurrentSourceListID, parent_id: IDS.doc, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260815010000', created: '20260815010000', sort: 50 });
    harness.blocks.set(concurrentFirstTaskID, { id: concurrentFirstTaskID, parent_id: concurrentSourceListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Race first', content: 'Race first', updated: '20260815010001', created: '20260815010001', sort: 1 });
    harness.blocks.set(concurrentSecondTaskID, { id: concurrentSecondTaskID, parent_id: concurrentSourceListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Race second', content: 'Race second', updated: '20260815010002', created: '20260815010002', sort: 2 });
    harness.blocks.set(concurrentParentTaskID, { id: concurrentParentTaskID, parent_id: concurrentSourceListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Race parent', content: 'Race parent', updated: '20260815010003', created: '20260815010003', sort: 3 });
    const concurrentMoves = await Promise.all([
        harness.call('taskHorizonMutateTask', {
            action: 'move', taskID: concurrentFirstTaskID, mode: 'child', parentTaskID: concurrentParentTaskID,
            requestedListID: concurrentFirstListID, authoritative: true, recordUndo: false,
        }),
        harness.call('taskHorizonMutateTask', {
            action: 'move', taskID: concurrentSecondTaskID, mode: 'child', parentTaskID: concurrentParentTaskID,
            requestedListID: concurrentSecondListID, authoritative: true, recordUndo: false,
        }),
    ]);
    assert.ok(concurrentMoves.every((result) => result.ok === true));
    const concurrentChildLists = Array.from(harness.blocks.values())
        .filter((block) => block.parent_id === concurrentParentTaskID && block.type === 'l');
    assert.equal(concurrentChildLists.length, 1,
        'different task lanes targeting one parent must not create duplicate child lists');
    const concurrentChildListID = concurrentChildLists[0].id;
    assert.deepEqual(
        Array.from(harness.blocks.values())
            .filter((block) => block.parent_id === concurrentChildListID && block.type === 'i' && block.subtype === 't')
            .sort((left, right) => left.sort - right.sort)
            .map((block) => block.id),
        [concurrentFirstTaskID, concurrentSecondTaskID],
    );
    assert.ok(concurrentMoves.every((result) => result.data.value.placement.parentListID === concurrentChildListID));

    const documents = await harness.call('taskHorizonSearchDocuments', { keyword: 'Contract', limit: 20 });
    assert.equal(documents.ok, true);
    assert.equal(documents.data.items.length, 1);
    assert.equal(documents.data.items[0].id, IDS.doc);
    assert.equal(documents.data.items[0].name, 'Contract Doc');

    const single = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { priority: 'high' });
    assert.equal(single.ok, true);
    assert.equal(single.data.task.attrHostID, IDS.singleTask);
    assert.equal(harness.attrs.get(IDS.singleList)['custom-priority'], undefined);
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-priority'], 'high');
    assert.equal(harness.attrs.get(IDS.singleList)['custom-task-horizon-attr-host-owner'], undefined);
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-task-horizon-attr-host-owner'], IDS.singleTask);
    assert.equal(harness.attrs.get(IDS.singleList)['custom-existing-extension'], 'keep-me');

    const paragraphTitle = await harness.call('taskHorizonGetTask', IDS.paragraphTitleTask);
    assert.equal(paragraphTitle.ok, true);
    assert.equal(paragraphTitle.data.title, '6646', 'a task title stored in its own paragraph must exclude nested child text');
    const renamedParagraphTitle = await harness.call('taskHorizonUpdateTask', IDS.paragraphTitleTask, { title: 'Renamed parent' });
    assert.equal(renamedParagraphTitle.ok, true);
    assert.equal(renamedParagraphTitle.data.task.title, 'Renamed parent');
    assert.equal(harness.blocks.get(IDS.paragraphTitleTask).markdown, '- [ ] \n    Renamed parent\n\n  - [ ] 323232', 'renaming must preserve the empty marker layout and nested child task');

    const first = await harness.call('taskHorizonUpdateTask', IDS.firstTask, { startDate: '2026-07-14' });
    assert.equal(first.ok, true);
    assert.equal(harness.attrs.get(IDS.firstTask)['custom-start-date'], '2026-07-14');
    assert.equal(harness.attrs.get(IDS.multiList)?.['custom-start-date'], undefined);
    assert.equal(harness.attrs.get(IDS.multiList)?.['custom-task-horizon-attr-host-owner'], undefined);

    const second = await harness.call('taskHorizonUpdateTask', IDS.secondTask, { completionTime: '2026-07-20' });
    assert.equal(second.ok, true);
    assert.equal(harness.attrs.get(IDS.secondTask)['custom-completion-time'], '2026-07-20');
    assert.equal(harness.attrs.get(IDS.multiList)?.['custom-completion-time'], undefined);

    const custom = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { customFieldValues: { energy: 'high' } });
    assert.equal(custom.ok, true);
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-tm-energy'], 'High');
    assert.equal(harness.attrs.get(IDS.singleList)['custom-tm-energy'], undefined);

    const statusInProgress = await harness.call('taskHorizonMutateTask', {
        action: 'patch',
        taskID: IDS.firstTask,
        patch: { customStatus: 'in_progress' },
    });
    assert.equal(statusInProgress.ok, true);
    assert.equal(statusInProgress.data.outcome, 'committed');
    assert.equal(statusInProgress.data.task.customStatus, 'in_progress');
    assert.equal(statusInProgress.data.task.customStatusName, '进行中');
    assert.equal(statusInProgress.data.task.done, true, 'a non-space SiYuan task marker is checked');
    assert.match(harness.blocks.get(IDS.firstTask).markdown, /^\* \[\?\] First/);
    assert.equal(harness.attrs.get(IDS.firstTask)['custom-status'], 'in_progress');
    assert.ok(harness.attrs.get(IDS.firstTask)['custom-task-complete-at']);
    const statusTransaction = harness.apiCalls.filter((item) => item.pathname === '/api/transactions').at(-1)?.body;
    assert.deepEqual(Array.from(statusTransaction.transactions[0].doOperations.map((item) => item.action)), ['update', 'setAttrs'],
        'status marker and the task item attributes must share one kernel transaction');
    assert.equal(statusTransaction.transactions[0].doOperations[1].id, IDS.firstTask);

    const statusDone = await harness.call('taskHorizonMutateTask', {
        action: 'patch',
        taskID: IDS.firstTask,
        patch: { customStatus: 'done' },
    });
    assert.equal(statusDone.ok, true);
    assert.equal(statusDone.data.outcome, 'committed');
    assert.match(harness.blocks.get(IDS.firstTask).markdown, /^\* \[[xX]\] First/);
    assert.equal(harness.attrs.get(IDS.firstTask)['custom-status'], 'done');

    const statusTodo = await harness.call('taskHorizonMutateTask', {
        action: 'patch',
        taskID: IDS.firstTask,
        patch: { customStatus: 'todo' },
    });
    assert.equal(statusTodo.ok, true);
    assert.equal(statusTodo.data.outcome, 'committed');
    assert.equal(statusTodo.data.task.done, false);
    assert.match(harness.blocks.get(IDS.firstTask).markdown, /^\* \[ \] First/);
    assert.equal(harness.attrs.get(IDS.firstTask)['custom-status'], 'todo');
    assert.equal(harness.attrs.get(IDS.firstTask)['custom-task-complete-at'], '');

    const statusBeforeFailedTransaction = {
        markdown: harness.blocks.get(IDS.firstTask).markdown,
        attrs: { ...(harness.attrs.get(IDS.firstTask) || {}) },
    };
    harness.failTransactionOnce();
    const failedStatus = await harness.call('taskHorizonMutateTask', {
        action: 'patch',
        taskID: IDS.firstTask,
        patch: { customStatus: 'in_progress' },
    });
    assert.equal(failedStatus.ok, true, 'the command gateway returns a typed failure receipt');
    assert.notEqual(failedStatus.data.outcome, 'committed');
    assert.equal(harness.blocks.get(IDS.firstTask).markdown, statusBeforeFailedTransaction.markdown);
    assert.deepEqual(harness.attrs.get(IDS.firstTask), statusBeforeFailedTransaction.attrs,
        'a rejected transaction must not partially update status attrs');

    harness.attrs.set(IDS.singleTask, {
        ...harness.attrs.get(IDS.singleTask),
        'custom-status': 'in_progress',
        'custom-start-date': '',
        'custom-completion-time': '',
        'custom-task-complete-at': '2026-07-15T10:30:00+08:00',
        'custom-duration': '90分钟',
        'custom-remark': 'Read every task field',
        'custom-tomato-estimate-count': '4',
        'custom-tomato-count': '3',
        'custom-tomato-minutes': '75',
        'custom-data-assets-th-0': 'assets/report.pdf',
        'custom-data-assets-th-1': `block:${IDS.childBlock}`,
        'custom-data-assets-th-meta': JSON.stringify({ version: 1, items: [{ path: 'assets/report.pdf', addedAt: 123456 }] }),
        'custom-tomato-reminder': JSON.stringify({ enabled: true, at: '2026-07-20T09:00:00+08:00', extension: 'keep-reminder-extension' }),
        'custom-task-repeat-rule': JSON.stringify({ enabled: true, type: 'weekly' }),
        'custom-task-repeat-state': JSON.stringify({ next: '2026-07-22' }),
    });
    harness.attrs.set(IDS.singleTask, {
        ...harness.attrs.get(IDS.singleTask),
        'custom-start-date': '2026-07-16',
        'custom-completion-time': '2026-07-20',
    });
    const readable = await harness.call('taskHorizonGetTask', IDS.singleTask, [
        'priority', 'customStatus', 'startDate', 'completionTime', 'taskCompleteAt', 'duration', 'remark',
        'tomatoEstimateCount', 'tomatoCount', 'tomatoMinutes', 'attachments', 'attachmentCount',
        'reminder', 'hasReminder', 'repeatRule', 'repeatState', 'customFieldValues',
    ]);
    assert.equal(readable.ok, true);
    assert.equal(readable.data.priority, 'high');
    assert.equal(readable.data.priorityName, '高');
    assert.equal(readable.data.customStatus, 'in_progress');
    assert.equal(readable.data.customStatusName, '进行中');
    assert.equal(readable.data.statusDefinitions.find((item) => item.id === 'in_progress').name, '进行中');
    assert.equal(readable.data.priorityDefinitions.find((item) => item.id === 'high').name, '高');
    assert.equal(readable.data.startDate, '2026-07-16');
    assert.equal(readable.data.completionTime, '2026-07-20');
    assert.equal(readable.data.taskCompleteAt, '2026-07-15T10:30:00+08:00');
    assert.equal(readable.data.duration, '90分钟');
    assert.equal(readable.data.remark, 'Read every task field');
    assert.equal(readable.data.tomatoEstimateCount, 4);
    assert.equal(readable.data.tomatoCount, 3);
    assert.equal(readable.data.tomatoMinutes, 75);
    assert.equal(readable.data.attachmentCount, 2);
    assert.equal(readable.data.attachments[0].path, 'assets/report.pdf');
    assert.equal(readable.data.attachments[0].addedAt, 123456);
    assert.equal(readable.data.attachments[1].kind, 'block-ref');
    assert.equal(readable.data.hasReminder, true);
    assert.equal(readable.data.reminder.enabled, true);
    assert.equal(readable.data.repeatRule.type, 'weekly');
    assert.equal(readable.data.repeatState.next, '2026-07-22');
    assert.equal(readable.data.customFieldValues.energy, 'High');
    assert.equal(readable.data.customFieldDefinitions.length, 1);
    assert.equal(readable.data.customFieldDefinitions[0].id, 'energy');
    assert.equal(readable.data.customFieldDefinitions[0].label, 'Energy');
    assert.equal(readable.data.customFieldDefinitions[0].type, 'single');
    assert.equal(readable.data.customFieldDefinitions[0].options[0].id, 'high');
    assert.equal(readable.data.customFieldDefinitions[0].options[0].label, 'High');
    assert.equal(readable.data.customFieldDefinitions[0].options[0].parentID, 'reading');
    assert.equal(readable.data.customFieldDefinitions[0].options[0].depth, 2);
    assert.equal(readable.data.customFieldDefinitions[0].options[0].path, 'Investment / Reading / High');
    assert.deepEqual(Array.from(readable.data.customFieldDefinitions[0].options[0].ancestorIDs), ['invest', 'reading']);
    assert.equal(readable.data.customFieldDefinitions[0].options.find((option) => option.id === 'legacy').effectiveArchived, true);
    const customFieldDefinitionsResult = await harness.call('taskHorizonGetCustomFieldDefinitions');
    assert.equal(customFieldDefinitionsResult.ok, true);
    assert.equal(customFieldDefinitionsResult.data[0].options[0].path, 'Investment / Reading / High');

    const reminderTool = harness.mcpTools.configure_task_reminder;
    assert.ok(reminderTool, 'configure_task_reminder must be registered');
    const reminderSchema = reminderTool.schema.inputSchema;
    assert.deepEqual(Array.from(reminderSchema.properties.action.enum), ['apply'], 'reminder writes must use one direct apply call');
    assert.equal(reminderSchema.properties.phase, undefined, 'the public reminder schema must not expose a preview phase');
    assert.equal(reminderSchema.properties.previewToken, undefined, 'the public reminder schema must not require a second preview-token call');
    assert.deepEqual(Array.from(reminderSchema.required), ['action', 'operation'], 'a new reminder task must not require a pre-existing taskID');
    assert.equal(reminderSchema.properties.taskTitle.type, 'string');
    assert.equal(reminderSchema.properties.documentID.type, 'string');
    assert.match(reminderTool.schema.description, /先用 query_tasks 检索已有任务[\s\S]*先精确、再按可见标题模糊匹配[\s\S]*允许少量错字/, 'unbound reminder lookup must search candidates first and retain fuzzy visible-title matching');
    const reminderFollowSchema = reminderTool.schema.inputSchema.properties.follow;
    assert.deepEqual(Array.from(reminderFollowSchema.required), ['date', 'times']);
    assert.deepEqual(Object.keys(reminderFollowSchema.properties), ['date', 'times'], 'follow reminders must accept only the requested date and times');
    const completedDuplicate = await harness.mcpTools.create_task.handler({
        action: 'create',
        title: '全局同名提醒任务',
        documentID: IDS.doc,
        patch: { done: true },
    });
    assert.equal(completedDuplicate.ok, true);
    const tasksBeforeReuse = Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length;
    const reusedGlobalTask = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '全局同名提醒任务',
        mode: 'independent',
        schedule: { startDate: '2026-07-22', times: ['08:30'], interval: 'once' },
    });
    assert.equal(reusedGlobalTask.ok, true);
    assert.equal(reusedGlobalTask.data.taskID, IDS.otherTask, 'global lookup must bind an unfinished exact-title task from another document');
    assert.equal(reusedGlobalTask.data.taskReused, true);
    assert.equal(reusedGlobalTask.data.taskCreated, false);
    assert.equal(Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length, tasksBeforeReuse, 'reusing a global exact-title task must not create another task');
    assert.equal(JSON.parse(harness.attrs.get(IDS.otherTask)['custom-tomato-reminder']).taskId, IDS.otherTask);
    const reusedFormattedTask = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: 'formatted reminder task',
        mode: 'independent',
        schedule: { startDate: '2026-07-22', times: ['09:30'], interval: 'once' },
    });
    assert.equal(reusedFormattedTask.ok, true);
    assert.equal(reusedFormattedTask.data.taskID, IDS.formattedTask, 'global exact-title lookup must compare the visible title without Markdown or case differences');
    assert.equal(reusedFormattedTask.data.taskReused, true);
    assert.equal(reusedFormattedTask.data.taskMatchType, 'exact');
    assert.equal(reusedFormattedTask.data.taskCreated, false);
    assert.equal(Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length, tasksBeforeReuse, 'formatted exact-title reuse must not create another task');
    const reusedFuzzyTask = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '准备发布说名',
        mode: 'independent',
        schedule: { startDate: '2026-07-22', times: ['10:30'], interval: 'once' },
    });
    assert.equal(reusedFuzzyTask.ok, true, JSON.stringify(reusedFuzzyTask));
    assert.equal(reusedFuzzyTask.data.taskID, IDS.fuzzyTask, 'a one-character typo must reuse the closest existing task');
    assert.equal(reusedFuzzyTask.data.taskTitle, '准备发布说明');
    assert.equal(reusedFuzzyTask.data.taskReused, true);
    assert.equal(reusedFuzzyTask.data.taskMatchType, 'fuzzy');
    assert.equal(reusedFuzzyTask.data.taskMatchDistance, 1);
    assert.equal(reusedFuzzyTask.data.taskCreated, false);
    assert.equal(Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length, tasksBeforeReuse, 'fuzzy reminder matching must not create a duplicate task');
    const createdIndependent = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '新建独立提醒任务',
        documentID: IDS.doc,
        mode: 'independent',
        schedule: { startDate: '2026-07-23', times: ['09:15'], interval: 'once' },
    });
    assert.equal(createdIndependent.ok, true);
    assert.equal(createdIndependent.data.taskCreated, true);
    assert.equal(createdIndependent.data.createdDocumentID, IDS.doc);
    assert.equal(createdIndependent.data.taskTitle, '新建独立提醒任务');
    assert.equal(JSON.parse(harness.attrs.get(createdIndependent.data.attrHostID)['custom-tomato-reminder']).repeatMode, 'manual');
    const createdFollow = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '新建跟随提醒任务',
        documentID: IDS.doc,
        mode: 'follow_task',
        follow: { date: '2026-07-24', times: ['20:00'] },
    });
    assert.equal(createdFollow.ok, true);
    assert.equal(createdFollow.data.taskCreated, true);
    assert.equal(createdFollow.data.completionTime, '2026-07-24');
    assert.equal(createdFollow.data.task.title, '新建跟随提醒任务');
    assert.equal(createdFollow.data.refresh.action, 'reminder');
    assert.deepEqual(Array.from(createdFollow.data.refresh.documentIDs), [IDS.doc]);
    assert.equal(JSON.parse(harness.attrs.get(createdFollow.data.attrHostID)['custom-tomato-reminder']).repeatMode, 'followTaskRepeat');
    const missingReminderTarget = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '缺少位置',
        mode: 'independent',
        schedule: { startDate: '2026-07-25', times: ['10:00'], interval: 'once' },
    });
    assert.equal(missingReminderTarget.ok, false);
    assert.equal(missingReminderTarget.error.code, 'INVALID_ARGUMENT');
    const tasksBeforeFailedReminder = Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length;
    const failedCreatedReminder = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '不应残留的提醒任务',
        documentID: IDS.doc,
        mode: 'independent',
        schedule: { startDate: '2026-07-25', times: ['10:00'], interval: 'unsupported' },
    });
    assert.equal(failedCreatedReminder.ok, false);
    assert.equal(failedCreatedReminder.error.code, 'INVALID_ARGUMENT');
    assert.equal(Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length, tasksBeforeFailedReminder, 'failed reminder creation must remove its carrier task');
    harness.attrs.set(IDS.singleList, {
        ...harness.attrs.get(IDS.singleList),
        'custom-completion-time': '',
    });
    harness.attrs.set(IDS.singleTask, {
        ...harness.attrs.get(IDS.singleTask),
        'custom-completion-time': '',
    });
    harness.attrs.set(IDS.singleTask, {
        ...harness.attrs.get(IDS.singleTask),
        'custom-tomato-reminder': JSON.stringify({ taskId: IDS.singleTask, enabled: true, startDate: '2026-07-19', times: ['08:00'], extension: 'keep-reminder-extension' }),
        bookmark: '⏰',
    });
    const reminderExecute = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskID: IDS.singleTask,
        mode: 'follow_task',
        follow: { date: '2026-07-20', times: ['08:00'] },
    });
    assert.equal(reminderExecute.ok, true);
    assert.equal(reminderExecute.data.task.id, IDS.singleTask);
    assert.equal(reminderExecute.data.refresh.kind, 'task-mutation');
    assert.equal(reminderExecute.data.refresh.action, 'reminder');
    assert.equal(reminderExecute.data.reminder.startDate, '2026-07-20');
    assert.equal(reminderExecute.data.taskTitle, 'Alpha');
    assert.equal(reminderExecute.data.reminder.blockName, 'Alpha', 'a parent reminder name must exclude descendant content');
    assert.equal(reminderExecute.data.reminder.blockContent, 'Alpha', 'a parent reminder body must exclude descendant content');
    assert.equal(reminderExecute.data.reminder.followAnchor, 'completionTime');
    assert.equal(reminderExecute.data.reminder.followDayOffset, 0);
    assert.equal(reminderExecute.data.reminder.syncTaskDone, true);
    const followedReminder = JSON.parse(harness.attrs.get(IDS.singleTask)['custom-tomato-reminder']);
    assert.equal(followedReminder.repeatMode, 'followTaskRepeat');
    assert.equal(followedReminder.syncTaskDone, true);
    assert.equal(followedReminder.followAnchor, 'completionTime');
    assert.equal(followedReminder.followDayOffset, 0);
    assert.equal(followedReminder.blockName, 'Alpha');
    assert.equal(followedReminder.blockContent, 'Alpha');
    assert.equal(reminderExecute.data.completionTime, '2026-07-20');
    assert.equal(reminderExecute.data.completionChanged, true);
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-completion-time'], '2026-07-20', 'execute must write the requested reminder date on the task block');
    assert.equal(harness.attrs.get(IDS.singleList)['custom-completion-time'], '', 'state-1 writes must not touch the parent list');
    assert.equal(followedReminder.at, undefined, 'stale legacy time aliases must be cleared');
    assert.equal(harness.attrs.get(IDS.singleTask).bookmark, '⏰');
    assert.equal(JSON.parse(harness.attrs.get(IDS.singleTask)['custom-tomato-reminder']).extension, 'keep-reminder-extension', 'task-item reminder updates must preserve unknown reminder fields');

    const clearFollowReminder = await reminderTool.handler({
        action: 'apply',
        operation: 'clear',
        taskID: IDS.singleTask,
    });
    assert.equal(clearFollowReminder.ok, true);
    assert.equal(clearFollowReminder.data.completionCleared, true, 'clearing a follow-task reminder must clear its synchronized deadline');
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-completion-time'], '');

    const independentPreview = await reminderTool.handler({
        action: 'get',
        phase: 'preview',
        operation: 'set',
        taskID: IDS.singleTask,
        mode: 'independent',
        schedule: {
            startDate: '2026-07-21',
            endDate: '2026-08-31',
            times: ['09:30'],
            interval: 'weekly',
            every: 2,
            monthlyMode: 'date',
            calendarMode: 'solar',
        },
    });
    assert.equal(independentPreview.ok, true);
    const independentExecute = await reminderTool.handler({
        action: 'apply',
        phase: 'execute',
        operation: 'set',
        taskID: IDS.singleTask,
        previewToken: independentPreview.data.previewToken,
    });
    assert.equal(independentExecute.ok, true);
    const independentReminder = JSON.parse(harness.attrs.get(IDS.singleTask)['custom-tomato-reminder']);
    assert.equal(independentReminder.repeatMode, 'manual');
    assert.equal(independentReminder.syncTaskDone, false);
    assert.equal(independentReminder.taskRepeatRule, null);
    assert.deepEqual(independentReminder.completedOccurrences, []);
    assert.equal(independentReminder.taskId, IDS.singleTask, 'independent reminders must retain the logical task item ID');

    harness.attrs.set(IDS.singleList, { ...harness.attrs.get(IDS.singleList), 'custom-completion-time': '2026-08-15' });
    harness.attrs.set(IDS.singleTask, { ...harness.attrs.get(IDS.singleTask), 'custom-completion-time': '2026-08-15' });

    const clearPreview = await reminderTool.handler({ action: 'get', phase: 'preview', operation: 'clear', taskID: IDS.singleTask });
    assert.equal(clearPreview.ok, true);
    const clearExecute = await reminderTool.handler({
        action: 'apply',
        phase: 'execute',
        operation: 'clear',
        taskID: IDS.singleTask,
        previewToken: clearPreview.data.previewToken,
    });
    assert.equal(clearExecute.ok, true);
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-tomato-reminder'], '');
    assert.equal(harness.attrs.get(IDS.singleTask).bookmark, '');
    assert.equal(clearExecute.data.completionCleared, false, 'clearing an independent reminder must not clear the task deadline');
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-completion-time'], '2026-08-15');

    harness.attrs.set(IDS.firstTask, {
        ...harness.attrs.get(IDS.firstTask),
        'custom-tomato-reminder': JSON.stringify({ taskId: IDS.firstTask, enabled: true, startDate: '2026-07-22', times: ['10:00'], legacyExtension: 'keep-on-move' }),
        bookmark: '⏰',
    });
    const multiReminderPreview = await reminderTool.handler({
        action: 'get',
        phase: 'preview',
        operation: 'set',
        taskID: IDS.firstTask,
        mode: 'independent',
        schedule: { startDate: '2026-07-22', times: ['10:00'], interval: 'once' },
    });
    assert.equal(multiReminderPreview.ok, true);
    const multiReminderExecute = await reminderTool.handler({
        action: 'apply',
        phase: 'execute',
        operation: 'set',
        taskID: IDS.firstTask,
        previewToken: multiReminderPreview.data.previewToken,
    });
    assert.equal(multiReminderExecute.ok, true);
    const movedMultiReminder = JSON.parse(harness.attrs.get(IDS.firstTask)['custom-tomato-reminder']);
    assert.equal(movedMultiReminder.taskId, IDS.firstTask);
    assert.equal(movedMultiReminder.legacyExtension, 'keep-on-move', 'task-item reminder updates must preserve unknown reminder fields');
    assert.equal(harness.attrs.get(IDS.multiList)?.['custom-tomato-reminder'], undefined, 'state-3 reminders must not write the parent list');

    const agentScheduleTool = harness.mcpTools.manage_agent_schedules;
    assert.ok(agentScheduleTool, 'manage_agent_schedules must be registered');
    const invalidAgentSchedule = await agentScheduleTool.handler({
        action: 'create',
        event: {
            name: 'Invalid date',
            prompt: 'Must not persist',
            schedule: { kind: 'once', date: '2026-02-31', time: '19:00' },
            output: { mode: 'notification' },
        },
    });
    assert.equal(invalidAgentSchedule.ok, false, 'nonexistent calendar dates must be rejected');
    assert.equal(invalidAgentSchedule.error.code, 'INVALID_ARGUMENT');
    assert.match(agentScheduleTool.schema.description, /必须先用 question/);
    const createdAgentSchedule = await agentScheduleTool.handler({
        action: 'create',
        event: {
            name: '每日任务复盘',
            prompt: '总结今天完成的任务',
            condition: 'today_has_completed_tasks',
            schedule: { kind: 'daily', time: '19:00' },
            output: { mode: 'document', documentId: IDS.personalParentDoc, documentMode: 'monthly_child', insertPosition: 'top' },
        },
    });
    assert.equal(createdAgentSchedule.ok, true);
    assert.equal(createdAgentSchedule.data.schedule.time, '19:00');
    assert.equal(createdAgentSchedule.data.output.documentMode, 'monthly_child');
    assert.equal(createdAgentSchedule.data.output.insertPosition, 'top');
    assert.match(JSON.stringify(agentScheduleTool.schema), /daily_note/, 'manage_agent_schedules must expose diary output mode');
    const existingMonthlyOutput = await harness.call('taskHorizonResolveAgentScheduleOutputDocument', {
        parentDocumentID: IDS.personalParentDoc,
        month: '2026-07',
    });
    assert.equal(existingMonthlyOutput.ok, true);
    assert.equal(existingMonthlyOutput.data.documentID, IDS.monthlyDoc, 'an existing direct monthly child must be reused');
    assert.equal(existingMonthlyOutput.data.created, false);
    const concurrentMonthlyOutputs = await Promise.all([
        harness.call('taskHorizonResolveAgentScheduleOutputDocument', { parentDocumentID: IDS.personalParentDoc, month: '2026-08' }),
        harness.call('taskHorizonResolveAgentScheduleOutputDocument', { parentDocumentID: IDS.personalParentDoc, month: '2026-08' }),
    ]);
    assert.equal(concurrentMonthlyOutputs.every((result) => result.ok), true);
    assert.equal(concurrentMonthlyOutputs[0].data.documentID, concurrentMonthlyOutputs[1].data.documentID, 'concurrent resolution must reuse one monthly document');
    assert.notEqual(concurrentMonthlyOutputs[0].data.documentID, IDS.nestedMonthlyDoc, 'a nested document with the same name must not be reused');
    assert.equal(harness.apiCalls.filter((item) => item.pathname === '/api/filetree/createDocWithMd').length, 1, 'one direct monthly child must be created');
    const otherParentOutput = await harness.call('taskHorizonResolveAgentScheduleOutputDocument', {
        parentDocumentID: IDS.doc,
        month: '2026-08',
    });
    assert.equal(otherParentOutput.ok, true);
    assert.notEqual(otherParentOutput.data.documentID, concurrentMonthlyOutputs[0].data.documentID, 'different parents must use different monthly documents');
    const missingParentOutput = await harness.call('taskHorizonResolveAgentScheduleOutputDocument', {
        parentDocumentID: '20260101999999-missing',
        month: '2026-08',
    });
    assert.equal(missingParentOutput.ok, false);
    assert.equal(missingParentOutput.error.code, 'NOT_FOUND');
    const listedAgentSchedules = await agentScheduleTool.handler({ action: 'list' });
    assert.equal(listedAgentSchedules.ok, true);
    assert.equal(listedAgentSchedules.data.items.length, 1);
    const agentScheduleID = createdAgentSchedule.data.id;
    const occurrenceKey = `${agentScheduleID}:2026-07-21T19:00`;
    const concurrentClaims = await Promise.all([
        harness.call('taskHorizonClaimAgentScheduleOccurrence', { scheduleID: agentScheduleID, occurrenceKey }),
        harness.call('taskHorizonClaimAgentScheduleOccurrence', { scheduleID: agentScheduleID, occurrenceKey }),
    ]);
    assert.equal(concurrentClaims.filter((result) => result.ok && result.data.claimed).length, 1, 'the kernel must grant one runner per occurrence');
    const winningClaim = concurrentClaims.find((result) => result.ok && result.data.claimed).data;
    const staleScheduleSave = await harness.call('taskHorizonSaveAgentSchedule', {
        ...createdAgentSchedule.data,
        name: '每日任务复盘（已编辑）',
        lastOccurrence: {},
        lastRun: {},
    });
    assert.equal(staleScheduleSave.ok, true);
    assert.equal(staleScheduleSave.data.lastOccurrence.ownerId, winningClaim.ownerID, 'definition edits must not overwrite an active Kernel lease');
    const rejectedRenewal = await harness.call('taskHorizonRenewAgentScheduleOccurrence', {
        scheduleID: agentScheduleID,
        occurrenceKey,
        ownerID: 'another-runner',
    });
    assert.equal(rejectedRenewal.ok, false);
    assert.equal(rejectedRenewal.error.code, 'CONFLICT');
    const renewedOccurrence = await harness.call('taskHorizonRenewAgentScheduleOccurrence', {
        scheduleID: agentScheduleID,
        occurrenceKey,
        ownerID: winningClaim.ownerID,
    });
    assert.equal(renewedOccurrence.ok, true);
    assert.ok(renewedOccurrence.data.leaseUntil >= winningClaim.event.lastOccurrence.leaseUntil, 'the active runner must be able to extend its lease');
    const finishedOccurrence = await harness.call('taskHorizonFinishAgentScheduleOccurrence', {
        scheduleID: agentScheduleID,
        occurrenceKey,
        ownerID: winningClaim.ownerID,
        status: 'succeeded',
        patch: { title: '完成', markdown: '结果' },
    });
    assert.equal(finishedOccurrence.ok, true);
    const terminalClaim = await harness.call('taskHorizonClaimAgentScheduleOccurrence', { scheduleID: agentScheduleID, occurrenceKey });
    assert.equal(terminalClaim.ok, true);
    assert.equal(terminalClaim.data.claimed, false, 'terminal occurrences must stay deduplicated');
    const updatedAgentSchedule = await agentScheduleTool.handler({
        action: 'update',
        scheduleID: agentScheduleID,
        patch: { enabled: false },
    });
    assert.equal(updatedAgentSchedule.ok, true);
    assert.equal(updatedAgentSchedule.data.enabled, false);
    const rpcAgentSchedules = await harness.call('taskHorizonLoadAgentSchedules');
    assert.equal(rpcAgentSchedules.ok, true);
    assert.equal(rpcAgentSchedules.data[0].id, agentScheduleID);
    const deletedAgentSchedule = await agentScheduleTool.handler({ action: 'delete', scheduleID: agentScheduleID });
    assert.equal(deletedAgentSchedule.ok, true);
    assert.deepEqual(JSON.parse(harness.storage.get('agent-scheduled-events.json')), []);

    harness.storage.set('ai-policy-config.json', JSON.stringify({
        schemaVersion: 2,
        revision: 3,
        global: { keywordClassification: [{ keyword: '报销', targetDocumentID: IDS.doc }] },
        documentOverrides: { [IDS.doc]: { keywordClassification: [{ keyword: '会议', targetDocumentID: IDS.doc }] } },
        groupOverrides: { work: { keywordClassification: [{ keyword: '项目', targetDocumentID: IDS.doc }] } },
        previous: { global: { keywordClassification: [{ keyword: '旧规则', targetDocumentID: IDS.doc }] } },
    }));
    const policy = await harness.call('taskHorizonGetPolicy');
    assert.equal(policy.ok, true);
    assert.equal(policy.data.durationDefaults.enabled, true);
    assert.equal(policy.data.durationDefaults.syncToManualDrag, false);
    assert.equal(policy.data.durationDefaults.fallbackMinutes, 25);
    assert.deepEqual(Array.from(policy.data.durationDefaults.rules[0].keywords), ['会议', '例会', '周会']);
    const disabledManualDurations = await harness.call('taskHorizonResolveDurationDefaults', {
        mode: 'manual-drag',
        items: [{ taskID: 'manual-disabled', title: '周会' }],
    });
    assert.equal(disabledManualDurations.ok, true);
    assert.deepEqual(JSON.parse(JSON.stringify(disabledManualDurations.data.items[0])), {
        taskID: 'manual-disabled', minutes: null, source: 'missing', ruleID: '', ruleName: '',
    });
    assert.equal(policy.data.global.keywordClassification, undefined);
    assert.equal(policy.data.documentOverrides[IDS.doc].keywordClassification, undefined);
    assert.equal(policy.data.groupOverrides.work.keywordClassification, undefined);
    assert.equal(policy.data.previous.global.keywordClassification, undefined);
    const removedPolicyPreview = await harness.call('taskHorizonPreviewPolicyPatch', {
        expectedRevision: policy.data.revision,
        patch: { global: { keywordClassification: [] } },
    });
    assert.equal(removedPolicyPreview.ok, false);
    assert.equal(removedPolicyPreview.error.code, 'INVALID_ARGUMENT');
    const policyPreview = await harness.call('taskHorizonPreviewPolicyPatch', {
        expectedRevision: policy.data.revision,
        patch: {
            durationDefaults: { ...policy.data.durationDefaults, syncToManualDrag: true },
            global: { weeklyAvailability: { mon: '09:00-18:00' }, defaultCalendarID: 'default' },
            groupOverrides: { work: { defaultCalendarID: 'group:work', customInstructions: '会议前后预留 15 分钟' } },
            documentOverrides: { [IDS.doc]: { deadlinePriority: { enabled: true, priority: 'high' } } },
        },
    });
    assert.equal(policyPreview.ok, true);
    const policyApply = await harness.call('taskHorizonApplyPolicyPatch', {
        expectedRevision: policyPreview.data.expectedRevision,
        previewToken: policyPreview.data.previewToken,
    });
    assert.equal(policyApply.ok, true);
    assert.equal(policyApply.data.policy.durationDefaults.syncToManualDrag, true);
    assert.equal(policyApply.data.policy.groupOverrides.work.defaultCalendarID, 'group:work');
    assert.equal(policyApply.data.policy.documentOverrides[IDS.doc].deadlinePriority.priority, 'high');
    const groupSnapshot = await harness.call('taskHorizonRegisterDocumentGroupSnapshot', {
        groups: [
            { id: 'work', name: '工作', documentIDs: [IDS.doc] },
            { id: 'personal', name: '个人', documentIDs: [IDS.otherDoc] },
        ],
    });
    assert.equal(groupSnapshot.ok, true);
    assert.equal(groupSnapshot.data.groupCount, 2);
    assert.equal(groupSnapshot.data.documentCount, 2);
    const effectivePolicy = await harness.mcpTools.get_task_policy.handler({
        action: 'get',
        documentIDs: [IDS.doc, IDS.otherDoc],
        durationCandidates: [
            { taskID: 'duration-meeting', title: '准备周会', documentID: IDS.doc },
            { taskID: 'duration-writing', title: '写 Q3 复盘报告', documentID: IDS.doc },
            { taskID: `repeatinst:${IDS.firstTask}:20260720120000`, title: '周报更新', documentID: IDS.doc },
            { taskID: 'duration-sync', title: 'sync project status', documentID: IDS.doc },
            { taskID: 'duration-standup', title: 'standup', documentID: IDS.doc },
            { taskID: 'duration-fallback', title: '同步计划', documentID: IDS.doc },
        ],
    });
    assert.equal(effectivePolicy.ok, true);
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.doc].documentGroupID, 'work');
    assert.deepEqual(Array.from(effectivePolicy.data.effectiveByDocument[IDS.doc].documentGroups, (group) => group.id), ['work']);
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.doc].appliedGroupRuleID, 'work');
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.doc].membershipSource, 'pluginResolvedSnapshot');
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.doc].config.defaultCalendarID, 'group:work');
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.doc].config.customInstructions, '会议前后预留 15 分钟');
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.doc].config.deadlinePriority.priority, 'high');
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.otherDoc].documentGroupID, 'personal');
    assert.deepEqual(Array.from(effectivePolicy.data.effectiveByDocument[IDS.otherDoc].documentGroups, (group) => group.id), ['personal']);
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.otherDoc].appliedGroupRuleID, '');
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.otherDoc].membershipSource, 'pluginResolvedSnapshot');
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.otherDoc].config.defaultCalendarID, 'default');
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.otherDoc].config.customInstructions, '');
    assert.deepEqual(Array.from(effectivePolicy.data.durationEstimates, (item) => [item.taskID, item.minutes, item.source]), [
        ['duration-meeting', 30, 'rule'],
        ['duration-writing', 60, 'rule'],
        [`repeatinst:${IDS.firstTask}:20260720120000`, 60, 'rule'],
        ['duration-sync', 25, 'fallback'],
        ['duration-standup', 25, 'fallback'],
        ['duration-fallback', 25, 'fallback'],
    ]);
    const manualDurations = await harness.call('taskHorizonResolveDurationDefaults', {
        mode: 'manual-drag',
        items: [
            { taskID: 'manual-meeting', title: '例会准备' },
            { taskID: 'manual-fallback', title: '整理本周计划' },
        ],
    });
    assert.equal(manualDurations.ok, true);
    assert.deepEqual(Array.from(manualDurations.data.items, (item) => [item.minutes, item.source]), [[30, 'rule'], [15, 'rule']]);
    const invalidDurationDefaults = await harness.call('taskHorizonPreviewPolicyPatch', {
        expectedRevision: policyApply.data.policy.revision,
        patch: { durationDefaults: { ...policyApply.data.policy.durationDefaults, fallbackMinutes: 10 } },
    });
    assert.equal(invalidDurationDefaults.ok, false);
    assert.equal(invalidDurationDefaults.error.code, 'INVALID_ARGUMENT');
    const policyDeletePreview = await harness.call('taskHorizonPreviewPolicyPatch', {
        expectedRevision: policyApply.data.policy.revision,
        patch: { documentOverrides: { [IDS.doc]: null }, groupOverrides: { work: null } },
    });
    const policyDelete = await harness.call('taskHorizonApplyPolicyPatch', {
        expectedRevision: policyDeletePreview.data.expectedRevision,
        previewToken: policyDeletePreview.data.previewToken,
    });
    assert.equal(policyDelete.ok, true);
    assert.equal(policyDelete.data.policy.documentOverrides[IDS.doc], undefined);
    assert.equal(policyDelete.data.policy.groupOverrides.work, undefined);

    const readableFieldSchema = harness.mcpTools.get_task.schema.inputSchema.properties.fields;
    assert.match(readableFieldSchema.description, /completionTime=截止日期/);
    assert.ok(readableFieldSchema.items.enum.includes('customStatus'));
    assert.ok(readableFieldSchema.items.enum.includes('customStatusName'));
    assert.ok(readableFieldSchema.items.enum.includes('priorityName'));
    assert.ok(readableFieldSchema.items.enum.includes('priorityScore'));
    assert.ok(readableFieldSchema.items.enum.includes('attachments'));
    assert.ok(readableFieldSchema.items.enum.includes('customFieldValues'));
    const queryFilterSchema = harness.mcpTools.query_tasks.schema.inputSchema.properties.filters;
    assert.equal(queryFilterSchema.additionalProperties, false);
    assert.equal(queryFilterSchema.properties.dateRange.additionalProperties, false);
    assert.ok(queryFilterSchema.properties.dateRange.properties.field.enum.includes('taskSpan'));
    assert.equal(queryFilterSchema.properties.overdue.type, 'boolean');
    assert.equal(harness.mcpTools.aggregate_task_stats.schema.inputSchema.properties.customFieldIDs.maxItems, 20);
    const kernelSource = fs.readFileSync(path.join(__dirname, '..', 'kernel.js'), 'utf8');
    const completionExpressionSource = kernelSource.slice(
        kernelSource.indexOf('function completionAttrExpression'),
        kernelSource.indexOf('function normalizeTaskScope'),
    );
    assert.doesNotMatch(completionExpressionSource, /parent_id|SELECT s\.id FROM blocks s/,
        'attribute filters must read only task item attributes');
    const calendarSource = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
    assert.match(calendarSource, /async function dedupeReminderBlocks[\s\S]*taskHorizonResolveTaskBinding[\s\S]*primaryHostID/, 'duplicate reminder reads must prefer the real attribute host');
    assert.match(calendarSource, /const safe = await dedupeReminderBlocks/, 'calendar reminder reads must apply logical-task deduplication');

    const uiAttrs = await harness.call('taskHorizonPersistUiTaskAttrs', IDS.singleTask, {
        'custom-task-repeat-rule': '{"enabled":true}',
        'custom-data-assets-th-0': 'assets/example.png',
        'custom-data-assets-th-meta': '[]',
    });
    assert.equal(uiAttrs.ok, true);
    assert.equal(uiAttrs.data.attrHostID, IDS.singleTask);
    assert.deepEqual(Array.from(uiAttrs.data.mirrorHostIDs), []);
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-data-assets-th-0'], 'assets/example.png');
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-task-repeat-rule'], '{"enabled":true}');
    assert.equal(harness.attrs.get(IDS.singleList)['custom-data-assets-th-0'], undefined);
    assert.equal(harness.attrs.get(IDS.singleList)['custom-task-repeat-rule'], undefined);

    const unsafeUiAttrs = await harness.call('taskHorizonPersistUiTaskAttrs', IDS.singleTask, { 'custom-unregistered': 'no' });
    assert.equal(unsafeUiAttrs.ok, false);
    assert.equal(unsafeUiAttrs.error.code, 'INVALID_ARGUMENT');

    const unknownTaskField = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { arbitrary: 'no' });
    assert.equal(unknownTaskField.ok, false);
    assert.equal(unknownTaskField.error.code, 'INVALID_ARGUMENT');

    const batchAttrsCallStart = harness.apiCalls.length;
    const batchAttrs = await harness.call('taskHorizonPersistUiBlockOperation', {
        action: 'batchSetAttrs',
        entries: [
            { id: IDS.firstTask, attrs: { 'custom-batch-test': 'first' } },
            { id: IDS.secondTask, attrs: { 'custom-batch-test': 'second' } },
        ],
    });
    assert.equal(batchAttrs.ok, true);
    assert.equal(batchAttrs.data.written, 2);
    assert.equal(harness.attrs.get(IDS.firstTask)['custom-batch-test'], 'first');
    assert.equal(harness.attrs.get(IDS.secondTask)['custom-batch-test'], 'second');
    const batchAttrsApiCalls = harness.apiCalls.slice(batchAttrsCallStart);
    assert.equal(batchAttrsApiCalls.filter((call) => call.pathname === '/api/attr/batchSetBlockAttrs').length, 1);
    assert.equal(batchAttrsApiCalls.filter((call) => call.pathname === '/api/attr/setBlockAttrs').length, 0);
    assert.deepEqual(batchAttrsApiCalls[0], {
        pathname: '/api/attr/batchSetBlockAttrs',
        body: {
            blockAttrs: [
                { id: IDS.firstTask, attrs: { 'custom-batch-test': 'first' } },
                { id: IDS.secondTask, attrs: { 'custom-batch-test': 'second' } },
            ],
        },
    });

    const markerCallStart = harness.apiCalls.length;
    const marker = await harness.call('taskHorizonPersistUiBlockOperation', { action: 'updateMarker', id: IDS.secondTask, marker: '?' });
    assert.equal(marker.ok, true);
    assert.match(harness.blocks.get(IDS.secondTask).markdown, /^\* \[\?\]/);
    assert.equal(
        harness.apiCalls.slice(markerCallStart).some((call) => call.pathname === '/api/transactions'),
        false,
        'a valid state-2 task must not trigger a structural repair transaction',
    );

    const content = await harness.call('taskHorizonPersistUiBlockOperation', { action: 'updateBlock', id: IDS.secondTask, data: '* [ ] Renamed' });
    assert.equal(content.ok, true);
    assert.equal(harness.blocks.get(IDS.secondTask).content, 'Renamed');

    const createScheduleSchema = harness.mcpTools.create_schedule.schema.inputSchema.properties;
    assert.deepEqual(Array.from(createScheduleSchema.reminderMode.enum), ['inherit', 'custom']);
    assert.equal(createScheduleSchema.reminderEnabled.type, 'boolean');
    assert.equal(createScheduleSchema.reminderOffsetMin.enum, undefined, 'SiYuan Kernel only accepts string-valued JSON Schema enums');
    assert.equal(createScheduleSchema.reminderOffsetMin.minimum, 0);
    assert.equal(createScheduleSchema.reminderOffsetMin.maximum, 60);
    assert.match(createScheduleSchema.reminderOffsetMin.description, /0、5、10、15、30、60/);
    const assertStringSchemaEnums = (value, schemaPath = 'inputSchema') => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value.enum)) {
            assert.equal(value.enum.every((item) => typeof item === 'string'), true, `${schemaPath}.enum must contain strings for SiYuan Kernel`);
        }
        Object.entries(value).forEach(([key, child]) => assertStringSchemaEnums(child, `${schemaPath}.${key}`));
    };
    Object.entries(harness.mcpTools).forEach(([name, tool]) => assertStringSchemaEnums(tool.schema.inputSchema, name));

    const invalidScheduleLink = await harness.mcpTools.create_schedule.handler({
        action: 'create',
        taskId: IDS.doc,
        title: 'Invalid link',
        start: '2026-07-16T09:00:00+08:00',
        end: '2026-07-16T10:00:00+08:00',
    });
    assert.equal(invalidScheduleLink.ok, false);
    assert.equal(invalidScheduleLink.error.code, 'NOT_FOUND');
    const childLinkedSchedule = await harness.mcpTools.create_schedule.handler({
        action: 'create',
        taskId: IDS.childBlock,
        title: 'Canonical link',
        start: '2026-07-16T10:00:00+08:00',
        end: '2026-07-16T11:00:00+08:00',
        reminderMode: 'custom',
        reminderEnabled: true,
        reminderOffsetMin: 15,
    });
    assert.equal(childLinkedSchedule.ok, true);
    assert.equal(childLinkedSchedule.data.schedule.taskId, IDS.singleTask, 'schedule links must store the real task ID');
    assert.equal(childLinkedSchedule.data.schedule.reminderMode, 'custom');
    assert.equal(childLinkedSchedule.data.schedule.reminderEnabled, true);
    assert.equal(childLinkedSchedule.data.schedule.reminderOffsetMin, 15);

    const scheduleUpdate = await harness.call('taskHorizonUpdateSchedule', {
        id: 'schedule-existing',
        patch: {
            title: 'Updated schedule',
            start: '2026-07-14T10:00:00+08:00',
            end: '2026-07-14T11:00:00+08:00',
            reminderMode: 'custom',
            reminderEnabled: false,
            reminderOffsetMin: 30,
        },
    });
    assert.equal(scheduleUpdate.ok, true);
    const savedSchedules = JSON.parse(harness.storage.get('calendar-events.json'));
    assert.equal(savedSchedules[0].reminder.minutes, 15);
    assert.equal(savedSchedules[0].recurrence.type, 'weekly');
    assert.equal(savedSchedules[0].extension, 'keep-me');
    assert.equal(savedSchedules[0].reminderMode, 'custom');
    assert.equal(savedSchedules[0].reminderEnabled, false);
    assert.equal(savedSchedules[0].reminderOffsetMin, 30);

    const inheritedScheduleReminder = await harness.call('taskHorizonUpdateSchedule', {
        id: 'schedule-existing',
        patch: { reminderMode: 'inherit' },
    });
    assert.equal(inheritedScheduleReminder.ok, true);
    assert.equal(inheritedScheduleReminder.data.schedule.reminderMode, 'inherit');
    assert.equal(inheritedScheduleReminder.data.schedule.reminderEnabled, null);
    assert.equal(inheritedScheduleReminder.data.schedule.reminderOffsetMin, null);

    const invalidScheduleReminder = await harness.call('taskHorizonUpdateSchedule', {
        id: 'schedule-existing',
        patch: { reminderMode: 'custom', reminderEnabled: true, reminderOffsetMin: 7 },
    });
    assert.equal(invalidScheduleReminder.ok, false);
    assert.equal(invalidScheduleReminder.error.code, 'INVALID_ARGUMENT');

    const [groupedScheduleA, groupedScheduleB] = await Promise.all([
        harness.call('taskHorizonCreateSchedule', {
            id: 'schedule-group-a', title: 'Group A', start: '2026-07-14T11:00:00+08:00', end: '2026-07-14T11:30:00+08:00',
        }),
        harness.call('taskHorizonCreateSchedule', {
            id: 'schedule-group-b', title: 'Group B', start: '2026-07-14T11:30:00+08:00', end: '2026-07-14T12:00:00+08:00',
        }),
    ]);
    const groupedUndo = await harness.call('taskHorizonGroupUndoMutations', {
        undoIDs: [groupedScheduleB.data.undoID, groupedScheduleA.data.undoID],
        label: '撤销本轮 AI 操作',
    });
    assert.equal(groupedUndo.ok, true);
    assert.equal(groupedUndo.data.count, 2);
    const undoGroupedSchedules = await harness.call('taskHorizonUndoLastMutation', { undoID: groupedUndo.data.undoID });
    assert.equal(undoGroupedSchedules.ok, true);
    assert.equal(JSON.parse(harness.storage.get('calendar-events.json')).some((item) => item.id === 'schedule-group-a'), false);
    assert.equal(JSON.parse(harness.storage.get('calendar-events.json')).some((item) => item.id === 'schedule-group-b'), false);

    await Promise.all([
        harness.call('taskHorizonCreateSchedule', { id: 'schedule-a', title: 'A', start: '2026-07-14T12:00:00+08:00', end: '2026-07-14T12:30:00+08:00' }),
        harness.call('taskHorizonCreateSchedule', { id: 'schedule-b', title: 'B', start: '2026-07-14T13:00:00+08:00', end: '2026-07-14T13:30:00+08:00' }),
    ]);
    assert.equal(JSON.parse(harness.storage.get('calendar-events.json')).length, 4);

    const invalidAction = await harness.mcpTools.create_task.handler({ action: 'update', title: 'Should not write', documentID: IDS.doc });
    assert.equal(invalidAction.ok, false);
    assert.equal(invalidAction.error.code, 'INVALID_ARGUMENT');

    const taskOperationSchema = harness.mcpTools.batch_tasks.schema.inputSchema.properties.operations;
    assert.equal(taskOperationSchema.items.additionalProperties, false, 'batch task operations must not expose an opaque object schema');
    assert.deepEqual(Array.from(taskOperationSchema.items.properties.kind.enum), ['create', 'update', 'move', 'delete']);
    assert.deepEqual(Array.from(taskOperationSchema.items.properties.action.enum), ['create', 'update', 'move', 'delete', 'patch']);
    assert.deepEqual(Array.from(taskOperationSchema.items.properties.type.enum), ['create', 'update', 'move', 'delete', 'patch']);
    const scheduleOperationSchema = harness.mcpTools.batch_schedules.schema.inputSchema.properties.operations;
    assert.equal(scheduleOperationSchema.items.additionalProperties, false, 'batch schedule operations must not expose an opaque object schema');
    assert.deepEqual(Array.from(scheduleOperationSchema.items.properties.kind.enum), ['create', 'update', 'delete']);
    assert.deepEqual(Array.from(scheduleOperationSchema.items.properties.action.enum), ['create', 'update', 'delete']);
    assert.deepEqual(harness.mcpTools.apply_task_operation_plan.schema.inputSchema.properties.taskOperations.items, taskOperationSchema.items);
    assert.deepEqual(harness.mcpTools.apply_task_operation_plan.schema.inputSchema.properties.scheduleOperations.items, scheduleOperationSchema.items);

    const batchPreview = await harness.mcpTools.batch_tasks.handler({
        action: 'get',
        phase: 'preview',
        operations: [{ kind: 'update', taskID: IDS.singleTask, patch: { priority: 'preview-only' } }],
    });
    assert.equal(batchPreview.ok, true);
    assert.equal(batchPreview.data.previewOnly, true);
    assert.notEqual(harness.attrs.get(IDS.singleTask)['custom-priority'], 'preview-only');

    const batchExecute = await harness.mcpTools.batch_tasks.handler({
        action: 'apply',
        phase: 'execute',
        operations: [{ kind: 'update', taskID: IDS.singleTask, patch: { priority: 'batch-value' } }],
    });
    assert.equal(batchExecute.ok, true);
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-priority'], 'batch-value');
    assert.equal(batchExecute.data.items[0].changes.refresh.action, 'update');
    const batchUndo = await harness.call('taskHorizonUndoLastMutation', {});
    assert.equal(batchUndo.ok, true);
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-priority'], 'high');
    assert.equal(batchUndo.data.data.items[0].refresh.action, 'update');

    for (const variant of [
        { field: 'action', value: 'update', priority: 'batch-action-value' },
        { field: 'type', value: 'update', priority: 'batch-type-value' },
        { field: 'action', value: 'patch', priority: 'batch-patch-value' },
    ]) {
        const result = await harness.mcpTools.batch_tasks.handler({
            action: 'apply',
            phase: 'execute',
            operations: [{ [variant.field]: variant.value, taskID: IDS.singleTask, patch: { priority: variant.priority } }],
        });
        assert.equal(result.ok, true, `${variant.field}=${variant.value} must resolve to a task update`);
        assert.equal(result.data.items[0].kind, 'task:update');
        assert.equal(harness.attrs.get(IDS.singleTask)['custom-priority'], variant.priority);
    }

    const unknownBatchAction = await harness.mcpTools.batch_tasks.handler({
        action: 'get',
        phase: 'preview',
        operations: [{ action: 'rename', taskID: IDS.singleTask }],
    });
    assert.equal(unknownBatchAction.ok, false);
    assert.equal(unknownBatchAction.error.code, 'INVALID_ARGUMENT');
    assert.match(unknownBatchAction.error.message, /第 1 项任务操作未知/);

    const missingBatchAction = await harness.mcpTools.batch_tasks.handler({
        action: 'get',
        phase: 'preview',
        operations: [{ taskID: IDS.singleTask, patch: { priority: 'must-not-write' } }],
    });
    assert.equal(missingBatchAction.ok, false);
    assert.equal(missingBatchAction.error.code, 'INVALID_ARGUMENT');
    assert.match(missingBatchAction.error.message, /第 1 项任务操作缺少 kind\/action\/type/);

    const conflictingBatchAction = await harness.mcpTools.batch_tasks.handler({
        action: 'get',
        phase: 'preview',
        operations: [{ kind: 'update', action: 'delete', taskID: IDS.singleTask, patch: { priority: 'must-not-write' } }],
    });
    assert.equal(conflictingBatchAction.ok, false);
    assert.equal(conflictingBatchAction.error.code, 'INVALID_ARGUMENT');
    assert.match(conflictingBatchAction.error.message, /第 1 项任务操作类型冲突/);
    assert.notEqual(harness.attrs.get(IDS.singleTask)['custom-priority'], 'must-not-write');

    const batchScheduleAction = await harness.mcpTools.batch_schedules.handler({
        action: 'apply',
        phase: 'execute',
        operations: [{ action: 'update', id: 'schedule-a', patch: { title: 'Batch schedule action' } }],
    });
    assert.equal(batchScheduleAction.ok, true);
    assert.equal(batchScheduleAction.data.items[0].kind, 'schedule:update');
    assert.equal(JSON.parse(harness.storage.get('calendar-events.json')).find((item) => item.id === 'schedule-a').title, 'Batch schedule action');

    const aliasDeleteSchedule = await harness.call('taskHorizonCreateSchedule', {
        id: 'schedule-alias-delete',
        title: 'Alias delete',
        start: '2026-07-14T14:00:00+08:00',
        end: '2026-07-14T14:30:00+08:00',
    });
    assert.equal(aliasDeleteSchedule.ok, true);
    const aliasDeletePreview = await harness.mcpTools.batch_schedules.handler({
        action: 'get',
        phase: 'preview',
        operations: [{ kind: 'delete', scheduleID: 'schedule-alias-delete' }],
    });
    assert.equal(aliasDeletePreview.ok, true);
    assert.match(aliasDeletePreview.data.previewToken, /^schedules_plan_/);
    const aliasDeleteExecute = await harness.mcpTools.batch_schedules.handler({
        action: 'apply',
        phase: 'execute',
        previewToken: aliasDeletePreview.data.previewToken,
        operations: [{ action: 'delete', scheduleID: 'schedule-alias-delete' }],
    });
    assert.equal(aliasDeleteExecute.ok, true, 'preview and execute may use different supported operation aliases');
    assert.equal(JSON.parse(harness.storage.get('calendar-events.json')).some((item) => item.id === 'schedule-alias-delete'), false);

    const combinedAliasPlan = await harness.mcpTools.apply_task_operation_plan.handler({
        action: 'apply',
        taskOperations: [{ type: 'patch', taskID: IDS.singleTask, patch: { priority: 'combined-alias-value' } }],
        scheduleOperations: [{ type: 'update', id: 'schedule-b', patch: { title: 'Combined schedule type' } }],
    });
    assert.equal(combinedAliasPlan.ok, true);
    assert.equal(combinedAliasPlan.data.summary.succeeded, 2);
    assert.deepEqual(Array.from(combinedAliasPlan.data.items.map((item) => item.kind)), ['task:update', 'schedule:update']);
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-priority'], 'combined-alias-value');
    assert.equal(JSON.parse(harness.storage.get('calendar-events.json')).find((item) => item.id === 'schedule-b').title, 'Combined schedule type');

    const combinedDeleteAlias = await harness.mcpTools.apply_task_operation_plan.handler({
        action: 'apply',
        taskOperations: [{ action: 'delete', taskID: IDS.singleTask }],
        scheduleOperations: [],
    });
    assert.equal(combinedDeleteAlias.ok, false);
    assert.equal(combinedDeleteAlias.error.code, 'INVALID_ARGUMENT');
    assert.match(combinedDeleteAlias.error.message, /组合操作不支持删除/);
    assert.equal(harness.blocks.has(IDS.singleTask), true);

    const deleteWithoutToken = await harness.mcpTools.delete_task.handler({ action: 'delete', phase: 'execute', taskID: IDS.singleTask });
    assert.equal(deleteWithoutToken.ok, false);
    assert.equal(deleteWithoutToken.error.code, 'CONFIRMATION_REQUIRED');

    const deletePreview = await harness.mcpTools.delete_task.handler({ action: 'get', phase: 'preview', taskID: directCreate.data.task.id });
    assert.equal(deletePreview.ok, true);
    const deletedDirectTask = await harness.mcpTools.delete_task.handler({
        action: 'delete',
        phase: 'execute',
        taskID: directCreate.data.task.id,
        previewToken: deletePreview.data.previewToken,
    });
    assert.equal(deletedDirectTask.ok, true);
    assert.equal(deletedDirectTask.data.refresh.action, 'delete');
    assert.deepEqual(Array.from(deletedDirectTask.data.refresh.taskIDs), [directCreate.data.task.id]);
    assert.deepEqual(Array.from(deletedDirectTask.data.refresh.documentIDs), [IDS.doc]);

    const subtreeListID = '20260811000000-list';
    const subtreeParentID = '20260811000001-task';
    const subtreeChildListID = '20260811000002-list';
    const subtreeChildID = '20260811000003-task';
    harness.blocks.set(subtreeListID, { id: subtreeListID, parent_id: IDS.doc, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260811000000', created: '20260811000000', sort: 20 });
    harness.blocks.set(subtreeParentID, { id: subtreeParentID, parent_id: subtreeListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Delete parent', content: 'Delete parent', updated: '20260811000001', created: '20260811000001', sort: 1 });
    harness.blocks.set(subtreeChildListID, { id: subtreeChildListID, parent_id: subtreeParentID, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260811000002', created: '20260811000002', sort: 1 });
    harness.blocks.set(subtreeChildID, { id: subtreeChildID, parent_id: subtreeChildListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Delete child', content: 'Delete child', updated: '20260811000003', created: '20260811000003', sort: 1 });
    harness.storage.set('calendar-events.json', JSON.stringify([
        ...JSON.parse(harness.storage.get('calendar-events.json')),
        { id: 'schedule-delete-parent', taskId: subtreeParentID },
        { id: 'schedule-delete-child', taskId: subtreeChildID },
    ]));
    const subtreePreview = await harness.mcpTools.delete_task.handler({ action: 'get', phase: 'preview', taskID: subtreeParentID });
    assert.equal(subtreePreview.ok, true);
    assert.deepEqual(Array.from(subtreePreview.data.deletedTaskIDs), [subtreeParentID, subtreeChildID]);
    assert.equal(subtreePreview.data.linkedScheduleCount, 2, 'delete preview must include schedules linked to descendant tasks');
    const subtreeDelete = await harness.mcpTools.delete_task.handler({
        action: 'delete',
        phase: 'execute',
        taskID: subtreeParentID,
        previewToken: subtreePreview.data.previewToken,
    });
    assert.equal(subtreeDelete.ok, true);
    assert.equal(harness.blocks.has(subtreeParentID), false);
    assert.equal(harness.blocks.has(subtreeChildID), false);
    assert.deepEqual(Array.from(subtreeDelete.data.refresh.taskIDs), [subtreeParentID, subtreeChildID]);
    const schedulesAfterSubtreeDelete = JSON.parse(harness.storage.get('calendar-events.json'));
    assert.equal(schedulesAfterSubtreeDelete.some((item) => item.taskId === subtreeParentID || item.taskId === subtreeChildID), false);

    const partialListID = '20260811000004-list';
    const partialTaskID = '20260811000005-task';
    harness.blocks.set(partialListID, { id: partialListID, parent_id: IDS.doc, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260811000004', created: '20260811000004', sort: 21 });
    harness.blocks.set(partialTaskID, { id: partialTaskID, parent_id: partialListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Partial delete', content: 'Partial delete', updated: '20260811000005', created: '20260811000005', sort: 1 });
    harness.storage.set('calendar-events.json', '{invalid json');
    try {
        const partialDelete = await harness.call('taskHorizonMutateTask', { action: 'delete', taskID: partialTaskID });
        assert.equal(partialDelete.ok, true);
        assert.equal(partialDelete.data.outcome, 'committed', 'a deleted block must remain committed when schedule cleanup fails');
        assert.equal(harness.blocks.has(partialTaskID), false);
        assert.equal(partialDelete.data.value.cleanupWarnings.some((item) => item.step === 'delete-task-schedules'), true);
    } finally {
        harness.storage.set('calendar-events.json', JSON.stringify(schedulesAfterSubtreeDelete));
    }

    const nakedTaskID = '20260814000000-task';
    harness.blocks.set(nakedTaskID, {
        id: nakedTaskID,
        parent_id: IDS.doc,
        root_id: IDS.doc,
        type: 'i',
        subtype: 't',
        markdown: '* [ ] Legacy naked task',
        content: 'Legacy naked task',
        updated: '20260814000000',
        created: '20260814000000',
        sort: 35,
    });
    harness.attrs.set(nakedTaskID, {
        'custom-priority': 'medium',
        'custom-unrelated-extension': 'preserve-me',
    });
    const nakedRepairCallStart = harness.apiCalls.length;
    const nakedReconcile = await harness.call('taskHorizonMutateTask', {
        action: 'reconcileAttrs',
        taskIDs: [nakedTaskID],
    });
    assert.equal(nakedReconcile.ok, true);
    assert.equal(nakedReconcile.data.outcome, 'committed');
    const repairedNakedTask = await harness.call('taskHorizonUpdateTask', nakedTaskID, { done: true });
    assert.equal(repairedNakedTask.ok, true);
    assert.equal(harness.blocks.has(nakedTaskID), true, 'repair must preserve the original task item ID');
    const repairedNakedRow = harness.blocks.get(nakedTaskID);
    const repairedNakedList = harness.blocks.get(repairedNakedRow.parent_id);
    assert.equal(repairedNakedList?.type, 'l');
    assert.equal(repairedNakedList?.parent_id, IDS.doc);
    assert.equal(
        Array.from(harness.blocks.values()).some((block) => block.parent_id === IDS.doc && block.type === 'i' && block.subtype === 't'),
        false,
        'a committed task update must leave no document-level task list item',
    );
    assert.equal(harness.attrs.get(nakedTaskID)['custom-unrelated-extension'], 'preserve-me');
    assert.equal(harness.attrs.get(nakedTaskID)['custom-priority'], 'medium');
    assert.equal(harness.attrs.get(repairedNakedList.id)?.['custom-priority'], undefined);
    assert.equal(harness.attrs.get(repairedNakedList.id)?.['custom-task-horizon-attr-host-owner'], undefined);
    const repairTransactions = harness.apiCalls.slice(nakedRepairCallStart)
        .filter((item) => item.pathname === '/api/transactions');
    assert.deepEqual(
        repairTransactions[0].body.transactions[0].doOperations.slice(0, 2).map((operation) => operation.action),
        ['delete', 'insert'],
        'the illegal task item must be replaced by its list wrapper in one transaction',
    );

    const nakedMarkerTaskID = '20260814000001-task';
    harness.blocks.set(nakedMarkerTaskID, {
        id: nakedMarkerTaskID,
        parent_id: IDS.doc,
        root_id: IDS.doc,
        type: 'i',
        subtype: 't',
        markdown: '* [ ] Legacy naked marker task',
        content: 'Legacy naked marker task',
        updated: '20260814000001',
        created: '20260814000001',
        sort: 36,
    });
    const nakedMarkerCallStart = harness.apiCalls.length;
    const nakedMarker = await harness.call('taskHorizonMutateTask', {
        action: 'blockOperation',
        operation: { action: 'updateMarker', id: nakedMarkerTaskID, marker: 'X' },
    });
    assert.equal(nakedMarker.ok, true);
    assert.equal(nakedMarker.data.outcome, 'committed');
    assert.equal(harness.blocks.get(harness.blocks.get(nakedMarkerTaskID).parent_id)?.type, 'l');
    assert.match(harness.blocks.get(nakedMarkerTaskID).markdown, /^\* \[x\]/);
    const nakedMarkerCalls = harness.apiCalls.slice(nakedMarkerCallStart);
    assert.ok(
        nakedMarkerCalls.findIndex((call) => call.pathname === '/api/transactions')
            < nakedMarkerCalls.findIndex((call) => call.pathname === '/api/block/updateTaskListItemMarker'),
        'an invalid legacy task must be wrapped before its marker is updated',
    );

    const nakedBatchTaskID = '20260814000002-task';
    harness.blocks.set(nakedBatchTaskID, {
        id: nakedBatchTaskID,
        parent_id: IDS.doc,
        root_id: IDS.doc,
        type: 'i',
        subtype: 't',
        markdown: '* [ ] Legacy naked batch task',
        content: 'Legacy naked batch task',
        updated: '20260814000002',
        created: '20260814000002',
        sort: 37,
    });
    const nakedBatchMarker = await harness.call('taskHorizonMutateTask', {
        action: 'blockOperation',
        operation: {
            action: 'batchUpdateMarker',
            items: [
                { id: IDS.secondTask, marker: 'X' },
                { id: nakedBatchTaskID, marker: 'X' },
            ],
        },
    });
    assert.equal(nakedBatchMarker.ok, true);
    assert.equal(nakedBatchMarker.data.outcome, 'committed');
    assert.equal(harness.blocks.get(harness.blocks.get(nakedBatchTaskID).parent_id)?.type, 'l');
    assert.match(harness.blocks.get(nakedBatchTaskID).markdown, /^\* \[x\]/);

    const nakedAttrTaskID = '20260814000003-task';
    harness.blocks.set(nakedAttrTaskID, {
        id: nakedAttrTaskID,
        parent_id: IDS.doc,
        root_id: IDS.doc,
        type: 'i',
        subtype: 't',
        markdown: '* [ ] Legacy naked attr task',
        content: 'Legacy naked attr task',
        updated: '20260814000003',
        created: '20260814000003',
        sort: 38,
    });
    const nakedAttrCallStart = harness.apiCalls.length;
    const nakedAttrWrite = await harness.call('taskHorizonMutateTask', {
        action: 'attrs',
        taskID: nakedAttrTaskID,
        attrs: { 'custom-priority': 'high' },
    });
    assert.equal(nakedAttrWrite.ok, true);
    assert.equal(nakedAttrWrite.data.outcome, 'committed');
    assert.equal(harness.blocks.get(harness.blocks.get(nakedAttrTaskID).parent_id)?.type, 'l');
    assert.equal(harness.attrs.get(nakedAttrTaskID)['custom-priority'], 'high');
    const nakedAttrTransactions = harness.apiCalls.slice(nakedAttrCallStart)
        .filter((call) => call.pathname === '/api/transactions');
    assert.deepEqual(
        nakedAttrTransactions.map((call) => call.body.transactions[0].doOperations[0].action),
        ['delete', 'setAttrs'],
        'task attributes must be written only after the invalid task item has been wrapped',
    );

    const done = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { done: true });
    assert.equal(done.ok, true);
    assert.equal(done.data.refresh.action, 'update');
    assert.match(harness.blocks.get(IDS.singleTask).markdown, /^\* \[x\]/);
    assert.match(harness.attrs.get(IDS.singleTask)['custom-task-complete-at'], /^\d{4}-\d{2}-\d{2}T/);

    const undone = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { done: false });
    assert.equal(undone.ok, true);
    assert.match(harness.blocks.get(IDS.singleTask).markdown, /^\* \[ \]/);
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-task-complete-at'], '');

    const guardedUpdate = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { priority: 'undo-guard' });
    assert.equal(guardedUpdate.ok, true);
    harness.attrs.set(IDS.singleTask, { ...harness.attrs.get(IDS.singleTask), 'custom-priority': 'external-change' });
    const conflictedUndo = await harness.call('taskHorizonUndoLastMutation', {});
    assert.equal(conflictedUndo.ok, false);
    assert.equal(conflictedUndo.error.code, 'CONFLICT');
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-priority'], 'external-change');

    const headingWithListID = '20260813000000-heading';
    const headingListID = '20260813000001-list';
    const headingExistingTaskID = '20260813000002-task';
    const headingSourceListID = '20260813000003-list';
    const headingSourceTaskID = '20260813000004-task';
    harness.blocks.set(headingWithListID, { id: headingWithListID, parent_id: IDS.doc, root_id: IDS.doc, type: 'h', subtype: 'h2', markdown: '## Existing target', content: 'Existing target', updated: '20260813000000', created: '20260813000000', sort: 40 });
    harness.blocks.set(headingListID, { id: headingListID, parent_id: IDS.doc, root_id: IDS.doc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260813000001', created: '20260813000001', sort: 41 });
    harness.blocks.set(headingExistingTaskID, { id: headingExistingTaskID, parent_id: headingListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Existing target task', content: 'Existing target task', updated: '20260813000002', created: '20260813000002', sort: 1 });
    harness.blocks.set(headingSourceListID, { id: headingSourceListID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260813000003', created: '20260813000003', sort: 40 });
    harness.blocks.set(headingSourceTaskID, { id: headingSourceTaskID, parent_id: headingSourceListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Move to existing target', content: 'Move to existing target', updated: '20260813000004', created: '20260813000004', sort: 1 });
    const moveToExistingHeadingList = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: headingSourceTaskID,
        mode: 'heading',
        headingID: headingWithListID,
        targetDocumentID: IDS.doc,
        requestedListID: '20260813000005-list',
        authoritative: true,
    });
    assert.equal(moveToExistingHeadingList.ok, true);
    assert.equal(moveToExistingHeadingList.data.outcome, 'committed');
    assert.equal(harness.blocks.get(headingSourceTaskID).parent_id, headingSourceListID,
        'heading moves must preserve the task inside its source list');
    assert.equal(harness.blocks.get(headingSourceListID).parent_id, IDS.doc,
        'the source task list must move into the target document');
    const existingHeadingMoveCall = harness.apiCalls
        .filter((item) => item.pathname === '/api/block/moveBlock')
        .at(-1);
    assert.equal(existingHeadingMoveCall?.body?.previousID, headingWithListID,
        'an unrelated task list after the heading must never replace the heading anchor');
    assert.equal(existingHeadingMoveCall?.body?.id, headingSourceListID,
        'a list item must not be moved directly under a document');

    const emptyHeadingID = '20260813000006-heading';
    const followingHeadingID = '20260813000007-heading';
    const emptyHeadingSourceListID = '20260813000008-list';
    const emptyHeadingSourceTaskID = '20260813000009-task';
    const requestedHeadingListID = '20260813000010-list';
    harness.blocks.set(emptyHeadingID, { id: emptyHeadingID, parent_id: IDS.doc, root_id: IDS.doc, type: 'h', subtype: 'h2', markdown: '## Empty target', content: 'Empty target', updated: '20260813000006', created: '20260813000006', sort: 50 });
    harness.blocks.set(followingHeadingID, { id: followingHeadingID, parent_id: IDS.doc, root_id: IDS.doc, type: 'h', subtype: 'h2', markdown: '## Following', content: 'Following', updated: '20260813000007', created: '20260813000007', sort: 60 });
    harness.blocks.set(emptyHeadingSourceListID, { id: emptyHeadingSourceListID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260813000008', created: '20260813000008', sort: 50 });
    harness.blocks.set(emptyHeadingSourceTaskID, { id: emptyHeadingSourceTaskID, parent_id: emptyHeadingSourceListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Move to empty target', content: 'Move to empty target', updated: '20260813000009', created: '20260813000009', sort: 1 });
    const moveToEmptyHeading = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: emptyHeadingSourceTaskID,
        mode: 'heading',
        headingID: emptyHeadingID,
        targetDocumentID: IDS.doc,
        requestedListID: requestedHeadingListID,
        authoritative: true,
    });
    assert.equal(moveToEmptyHeading.ok, true);
    assert.equal(moveToEmptyHeading.data.outcome, 'committed');
    assert.equal(harness.blocks.get(emptyHeadingSourceTaskID).parent_id, emptyHeadingSourceListID,
        'an empty heading must accept the moved task list directly after the heading');
    assert.equal(harness.blocks.get(emptyHeadingSourceListID).parent_id, IDS.doc);
    const emptyHeadingCalls = harness.apiCalls.filter((item) => (
        item.pathname === '/api/block/insertBlock'
        || item.pathname === '/api/block/moveBlock'
        || item.pathname === '/api/block/deleteBlock'
    ));
    assert.equal(emptyHeadingCalls.some((item) => item.pathname === '/api/block/insertBlock'), false,
        'an independent source list must not create a scaffold task list');

    const failedHeadingID = '20260813000011-heading';
    const failedSourceListID = '20260813000012-list';
    const failedSourceTaskID = '20260813000013-task';
    harness.blocks.set(failedHeadingID, { id: failedHeadingID, parent_id: IDS.doc, root_id: IDS.doc, type: 'h', subtype: 'h2', markdown: '## Failed target', content: 'Failed target', updated: '20260813000011', created: '20260813000011', sort: 70 });
    harness.blocks.set(failedSourceListID, { id: failedSourceListID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260813000012', created: '20260813000012', sort: 60 });
    harness.blocks.set(failedSourceTaskID, { id: failedSourceTaskID, parent_id: failedSourceListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Must remain at source', content: 'Must remain at source', updated: '20260813000013', created: '20260813000013', sort: 1 });
    harness.skipMoveOnce();
    const rejectedHeadingMove = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: failedSourceTaskID,
        mode: 'heading',
        headingID: failedHeadingID,
        targetDocumentID: IDS.doc,
        authoritative: true,
    });
    assert.equal(rejectedHeadingMove.ok, true);
    assert.equal(rejectedHeadingMove.data.outcome, 'conflict',
        'a structure-rejected move that returns code zero must not be reported as committed');
    assert.equal(harness.blocks.get(failedSourceListID).parent_id, IDS.otherDoc);

    const recycleSourceListID = '20260813000018-list';
    const recycleSourceTaskID = '20260813000019-task';
    harness.blocks.set(recycleSourceListID, { id: recycleSourceListID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260813000018', created: '20260813000018', sort: 100 });
    harness.blocks.set(recycleSourceTaskID, { id: recycleSourceTaskID, parent_id: recycleSourceListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Recycle independent task', content: 'Recycle independent task', updated: '20260813000019', created: '20260813000019', sort: 1 });
    const recycleMoveStart = harness.apiCalls.length;
    const recycleIndependent = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: recycleSourceTaskID,
        mode: 'recycle-document',
        targetDocumentID: IDS.doc,
        authoritative: true,
    });
    assert.equal(recycleIndependent.ok, true);
    assert.equal(recycleIndependent.data.outcome, 'committed');
    assert.equal(harness.blocks.get(recycleSourceListID).parent_id, IDS.doc);
    assert.equal(harness.blocks.get(recycleSourceTaskID).parent_id, recycleSourceListID);
    const recycleIndependentCalls = harness.apiCalls.slice(recycleMoveStart);
    assert.equal(recycleIndependentCalls.some((item) => (
        item.pathname === '/api/block/moveBlock'
        && item.body.id === recycleSourceListID
        && item.body.parentID === IDS.doc
    )), true, 'recycling an independent task must move its outer list into the recycle document');
    assert.equal(recycleIndependentCalls.some((item) => (
        item.pathname === '/api/block/moveBlock'
        && item.body.id === recycleSourceTaskID
        && item.body.parentID === IDS.doc
    )), false, 'recycling must never attach a list item directly to a document');

    const sharedRecycleListID = '20260813000020-list';
    const sharedRecycleTaskID = '20260813000021-task';
    const sharedRecycleSiblingID = '20260813000022-task';
    harness.blocks.set(sharedRecycleListID, { id: sharedRecycleListID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260813000020', created: '20260813000020', sort: 110 });
    harness.blocks.set(sharedRecycleTaskID, { id: sharedRecycleTaskID, parent_id: sharedRecycleListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Recycle from shared list', content: 'Recycle from shared list', updated: '20260813000021', created: '20260813000021', sort: 1 });
    harness.blocks.set(sharedRecycleSiblingID, { id: sharedRecycleSiblingID, parent_id: sharedRecycleListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Keep in source list', content: 'Keep in source list', updated: '20260813000022', created: '20260813000022', sort: 2 });
    const sharedRecycle = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: sharedRecycleTaskID,
        mode: 'recycle-document',
        targetDocumentID: IDS.doc,
        authoritative: true,
    });
    assert.equal(sharedRecycle.ok, true);
    assert.equal(sharedRecycle.data.outcome, 'committed');
    const sharedRecycleTargetListID = sharedRecycle.data.value.listID;
    assert.notEqual(sharedRecycleTargetListID, sharedRecycleListID);
    assert.equal(harness.blocks.get(sharedRecycleTaskID).parent_id, sharedRecycleTargetListID,
        'a task from a shared list must be split into a new independent recycle list');
    assert.equal(harness.blocks.get(sharedRecycleSiblingID).parent_id, sharedRecycleListID,
        'other tasks in the source list must remain in place');
    assert.equal(harness.blocks.get(sharedRecycleTargetListID).parent_id, IDS.doc);
    assert.equal(Array.from(harness.blocks.values()).filter((item) => item.parent_id === sharedRecycleTargetListID).length, 1,
        'the recycle list must contain only the moved task after deleting its scaffold');

    const rejectedRecycleListID = '20260813000023-list';
    const rejectedRecycleTaskID = '20260813000024-task';
    harness.blocks.set(rejectedRecycleListID, { id: rejectedRecycleListID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260813000023', created: '20260813000023', sort: 120 });
    harness.blocks.set(rejectedRecycleTaskID, { id: rejectedRecycleTaskID, parent_id: rejectedRecycleListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Reject false recycle success', content: 'Reject false recycle success', updated: '20260813000024', created: '20260813000024', sort: 1 });
    harness.skipMoveOnce();
    const rejectedRecycle = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: rejectedRecycleTaskID,
        mode: 'recycle-document',
        targetDocumentID: IDS.doc,
        authoritative: true,
    });
    assert.equal(rejectedRecycle.ok, true);
    assert.equal(rejectedRecycle.data.outcome, 'conflict',
        'a recycle move that SiYuan did not apply must not be reported as committed');
    assert.equal(harness.blocks.get(rejectedRecycleListID).parent_id, IDS.otherDoc);

    const restoreSourceListID = '20260813000014-list';
    const restoreSourceTaskID = '20260813000015-task';
    harness.blocks.set(restoreSourceListID, { id: restoreSourceListID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260813000014', created: '20260813000014', sort: 80 });
    harness.blocks.set(restoreSourceTaskID, { id: restoreSourceTaskID, parent_id: restoreSourceListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Restore to default position', content: 'Restore to default position', updated: '20260813000015', created: '20260813000015', sort: 1 });
    const restoreToDocument = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: restoreSourceTaskID,
        mode: 'document-list',
        targetDocumentID: IDS.doc,
        sourceDocumentID: IDS.otherDoc,
        sourceListID: restoreSourceListID,
        authoritative: true,
    });
    assert.equal(restoreToDocument.ok, true);
    assert.equal(restoreToDocument.data.outcome, 'committed');
    assert.equal(harness.blocks.get(restoreSourceTaskID).parent_id, restoreSourceListID,
        'restoring a completed task must preserve the task inside its independent list');
    assert.equal(harness.blocks.get(restoreSourceListID).parent_id, IDS.doc);
    const restoreMoveCall = harness.apiCalls
        .filter((item) => item.pathname === '/api/block/moveBlock')
        .at(-1);
    assert.equal(restoreMoveCall?.body?.id, restoreSourceListID,
        'restoring to the default document position must move the outer list, not the task item');
    assert.equal(restoreMoveCall?.body?.parentID, IDS.doc);

    const sharedRestoreListID = '20260813000025-list';
    const sharedRestoreSiblingID = '20260813000026-task';
    const sharedRestoreTaskID = '20260813000027-task';
    harness.blocks.set(sharedRestoreListID, { id: sharedRestoreListID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260813000025', created: '20260813000025', sort: 130 });
    harness.blocks.set(sharedRestoreSiblingID, { id: sharedRestoreSiblingID, parent_id: sharedRestoreListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Keep archived sibling', content: 'Keep archived sibling', updated: '20260813000026', created: '20260813000026', sort: 1 });
    harness.blocks.set(sharedRestoreTaskID, { id: sharedRestoreTaskID, parent_id: sharedRestoreListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Restore residual state-2 task', content: 'Restore residual state-2 task', updated: '20260813000027', created: '20260813000027', sort: 2 });
    harness.attrs.set(sharedRestoreTaskID, {
        'custom-priority': 'high',
        'custom-task-horizon-attr-host-owner': sharedRestoreTaskID,
    });
    const sharedRestore = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: sharedRestoreTaskID,
        mode: 'document-list',
        targetDocumentID: IDS.doc,
        sourceDocumentID: IDS.otherDoc,
        sourceListID: '',
        authoritative: true,
    });
    assert.equal(sharedRestore.ok, true);
    assert.equal(sharedRestore.data.outcome, 'committed');
    const sharedRestoreTargetListID = sharedRestore.data.value.listID;
    assert.notEqual(sharedRestoreTargetListID, sharedRestoreListID,
        'a residual state-2 task must be split into a new independent list');
    assert.equal(harness.blocks.get(sharedRestoreTaskID).parent_id, sharedRestoreTargetListID);
    assert.equal(harness.blocks.get(sharedRestoreSiblingID).parent_id, sharedRestoreListID,
        'restoring one residual task must not move its archived sibling');
    assert.equal(harness.blocks.get(sharedRestoreTargetListID).parent_id, IDS.doc);
    assert.equal(harness.attrs.get(sharedRestoreTargetListID)?.['custom-priority'], undefined,
        'a repaired independent list must remain structure-only');
    assert.equal(harness.attrs.get(sharedRestoreTaskID)['custom-priority'], 'high',
        'the original task item must retain its mirrored attributes');

    const rejectedRestoreListID = '20260813000016-list';
    const rejectedRestoreTaskID = '20260813000017-task';
    harness.blocks.set(rejectedRestoreListID, { id: rejectedRestoreListID, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: 't', markdown: '', content: '', updated: '20260813000016', created: '20260813000016', sort: 90 });
    harness.blocks.set(rejectedRestoreTaskID, { id: rejectedRestoreTaskID, parent_id: rejectedRestoreListID, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] Reject false success', content: 'Reject false success', updated: '20260813000017', created: '20260813000017', sort: 1 });
    harness.skipMoveOnce();
    const rejectedRestore = await harness.call('taskHorizonMutateTask', {
        action: 'move',
        taskID: rejectedRestoreTaskID,
        mode: 'document-list',
        targetDocumentID: IDS.doc,
        sourceDocumentID: IDS.otherDoc,
        sourceListID: rejectedRestoreListID,
        authoritative: true,
    });
    assert.equal(rejectedRestore.ok, true);
    assert.equal(rejectedRestore.data.outcome, 'conflict',
        'a document-list move that was not applied must not be reported as committed');
    assert.equal(harness.blocks.get(rejectedRestoreListID).parent_id, IDS.otherDoc);

    const batchTransactionStart = harness.apiCalls.filter((item) => item.pathname === '/api/transactions').length;
    const batchMove = await harness.call('taskHorizonMutateTask', {
        action: 'batchMove',
        taskIDs: [IDS.firstTask, IDS.secondTask],
        parentTaskID: IDS.singleTask,
        requestedListID: IDS.childList,
        mode: 'child',
    });
    assert.equal(batchMove.ok, true);
    assert.equal(batchMove.data.outcome, 'committed');
    assert.equal(batchMove.data.value.transactionCount, 1, 'an existing child list must use one kernel transaction');
    assert.equal(batchMove.data.value.results.length, 2);
    const batchTransactions = harness.apiCalls
        .filter((item) => item.pathname === '/api/transactions')
        .slice(batchTransactionStart);
    assert.equal(batchTransactions.length, 1, 'batch child moves must issue one transactions request');
    assert.equal(batchTransactions[0].body.transactions.length, 1, 'batch child moves must use one atomic transaction');
    assert.deepEqual(
        batchTransactions[0].body.transactions[0].doOperations
            .filter((operation) => operation.action === 'move')
            .map((operation) => operation.id),
        [IDS.secondTask, IDS.firstTask],
        'move operations must be reversed around the stable target anchor',
    );
    const childOrder = Array.from(harness.blocks.values())
        .filter((block) => block.parent_id === IDS.childList)
        .sort((left, right) => left.sort - right.sort)
        .map((block) => block.id);
    assert.deepEqual(childOrder, [IDS.childTask, IDS.firstTask, IDS.secondTask]);
    assert.deepEqual(
        batchMove.data.value.results.map((item) => item.placement.parentListID),
        [IDS.childList, IDS.childList],
    );

    const newBatchListID = '20260812000000-list';
    const newBatchFirstID = '20260812000001-task';
    const newBatchSecondID = '20260812000002-task';
    const newBatchParentID = '20260812000003-task';
    const requestedChildListID = '20260812000004-list';
    harness.blocks.set(newBatchListID, { id: newBatchListID, parent_id: IDS.doc, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260812000000', created: '20260812000000', sort: 30 });
    harness.blocks.set(newBatchFirstID, { id: newBatchFirstID, parent_id: newBatchListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Batch first', content: 'Batch first', updated: '20260812000001', created: '20260812000001', sort: 1 });
    harness.blocks.set(newBatchSecondID, { id: newBatchSecondID, parent_id: newBatchListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Batch second', content: 'Batch second', updated: '20260812000002', created: '20260812000002', sort: 2 });
    harness.blocks.set(newBatchParentID, { id: newBatchParentID, parent_id: newBatchListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Batch parent', content: 'Batch parent', updated: '20260812000003', created: '20260812000003', sort: 3 });
    const createBatchTransactionStart = harness.apiCalls.filter((item) => item.pathname === '/api/transactions').length;
    const createBatchMove = await harness.call('taskHorizonMutateTask', {
        action: 'batchMove',
        taskIDs: [newBatchFirstID, newBatchSecondID],
        parentTaskID: newBatchParentID,
        requestedListID: requestedChildListID,
        mode: 'child',
    });
    assert.equal(createBatchMove.ok, true);
    assert.equal(createBatchMove.data.outcome, 'committed');
    assert.equal(createBatchMove.data.value.transactionCount, 1, 'creating a child list and moving all selected tasks must remain atomic');
    const createBatchTransactions = harness.apiCalls
        .filter((item) => item.pathname === '/api/transactions')
        .slice(createBatchTransactionStart);
    assert.equal(createBatchTransactions.length, 1);
    assert.deepEqual(
        createBatchTransactions[0].body.transactions[0].doOperations.map((operation) => operation.action),
        ['delete', 'insert', 'move'],
    );
    assert.deepEqual(
        Array.from(harness.blocks.values())
            .filter((block) => block.parent_id === requestedChildListID)
            .sort((left, right) => left.sort - right.sort)
            .map((block) => block.id),
        [newBatchFirstID, newBatchSecondID],
    );

    const rejectedBatchListID = '20260812000005-list';
    const rejectedBatchFirstID = '20260812000006-task';
    const rejectedBatchSecondID = '20260812000007-task';
    harness.blocks.set(rejectedBatchListID, { id: rejectedBatchListID, parent_id: IDS.doc, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260812000005', created: '20260812000005', sort: 31 });
    harness.blocks.set(rejectedBatchFirstID, { id: rejectedBatchFirstID, parent_id: rejectedBatchListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Rejected first', content: 'Rejected first', updated: '20260812000006', created: '20260812000006', sort: 1 });
    harness.blocks.set(rejectedBatchSecondID, { id: rejectedBatchSecondID, parent_id: rejectedBatchListID, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Rejected second', content: 'Rejected second', updated: '20260812000007', created: '20260812000007', sort: 2 });
    harness.skipTransactionOnce();
    const uncommittedBatchMove = await harness.call('taskHorizonMutateTask', {
        action: 'batchMove',
        taskIDs: [rejectedBatchFirstID, rejectedBatchSecondID],
        parentTaskID: IDS.singleTask,
        requestedListID: IDS.childList,
        mode: 'child',
    });
    assert.equal(uncommittedBatchMove.ok, true);
    assert.notEqual(uncommittedBatchMove.data.outcome, 'committed', 'an HTTP-successful but unapplied transaction must not be acknowledged');
    assert.equal(harness.blocks.get(rejectedBatchFirstID).parent_id, rejectedBatchListID);
    assert.equal(harness.blocks.get(rejectedBatchSecondID).parent_id, rejectedBatchListID);

    const downgraded = await harness.call('taskHorizonSyncMcpEntitlement', { allowed: false });
    assert.equal(downgraded.ok, true);
    assert.equal(downgraded.data.mcpAuthorized, false);
    assert.equal(downgraded.data.mcpEnabled, false);
    assert.equal(downgraded.data.registeredToolCount, 0, 'losing Pro entitlement must unregister every MCP tool immediately');
    const enableAfterDowngrade = await harness.call('taskHorizonSetMcpEnabled', true);
    assert.equal(enableAfterDowngrade.ok, false);
    assert.equal(enableAfterDowngrade.error.code, 'UNSUPPORTED');
    const enableToolAfterDowngrade = await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'create_task', enabled: true });
    assert.equal(enableToolAfterDowngrade.ok, false);
    assert.equal(enableToolAfterDowngrade.error.code, 'UNSUPPORTED');
}

run().then(() => {
    process.stdout.write('kernel contract tests passed\n');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
