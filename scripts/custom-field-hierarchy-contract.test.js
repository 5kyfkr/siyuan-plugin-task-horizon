'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'),
    'utf8',
);
const settingsSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'settings', '62-settings-columns-and-rules.js'), 'utf8');
const pickerSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '53a-list-field-edit-runtime.js'), 'utf8');
const quickAddSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '53b-task-create-and-quick-add-runtime.js'), 'utf8');
const batchSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'shell', '81-ai-bridge-runtime.js'), 'utf8');
const quickbarSource = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');
const kernelSource = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');
const workbenchSource = fs.readFileSync(path.join(root, 'src', 'ai', 'agent-workbench.js'), 'utf8');
const start = source.indexOf('function __tmNormalizeCustomFieldOption');
const end = source.indexOf('    const __tmCustomFieldDefsRuntimeCache', start);
assert.ok(start >= 0 && end > start, 'custom field hierarchy helpers must remain extractable');

const context = vm.createContext({
    Map,
    Set,
    __tmNormalizeCustomFieldId: (value, fallback) => String(value || fallback || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
    __tmNormalizeHexColor: (value, fallback) => String(value || fallback || ''),
    __tmGetCustomFieldPresetColor: () => '#3b82f6',
    __tmNormalizeCustomFieldAttrName: (value, fallback) => String(value || fallback || '').trim(),
    __tmNormalizeCustomFieldScope: (value) => value || null,
    __tmNormalizeCustomFieldValue: (field, value) => String(field?.type || '') === 'multi'
        ? (Array.isArray(value) ? value : [])
        : String(value || '').trim(),
});
vm.runInContext(source.slice(start, end), context);
const valueStart = source.indexOf('function __tmFindCustomFieldOption');
const valueEnd = source.indexOf('    function __tmNormalizeTaskCustomFieldValues', valueStart);
assert.ok(valueStart >= 0 && valueEnd > valueStart, 'custom field value helpers must remain extractable');
vm.runInContext(source.slice(valueStart, valueEnd), context);
const syncStart = source.indexOf('function __tmCloneCustomFieldDefs');
const syncEnd = source.indexOf('    function __tmMaybeBackfillTaskCustomFieldAttrs', syncStart);
assert.ok(syncStart >= 0 && syncEnd > syncStart, 'custom field sync helpers must remain extractable');
Object.assign(context, {
    __tmCloneJsonSafe: (value, fallback) => {
        try { return JSON.parse(JSON.stringify(value)); } catch (e) { return fallback; }
    },
    __tmParseVersionNumber: (value) => Math.max(0, Math.floor(Number(value) || 0)),
});
vm.runInContext(source.slice(syncStart, syncEnd), context);

const run = (expression, values = {}) => {
    Object.assign(context, values);
    return vm.runInContext(expression, context);
};

const legacy = run(`__tmNormalizeCustomFieldDef({
    id: 'topic', name: '主题', type: 'single', options: [{ id: 'reading', name: '读书' }]
})`);
assert.equal(legacy.options[0].parentId, '', 'legacy options must default to root');
assert.equal(legacy.options[0].archived, false, 'legacy options must default to active');

const field = run(`__tmNormalizeCustomFieldDef({
    id: 'topic', name: '主题', type: 'multi', options: [
        { id: 'computer', name: '计算机', parentId: 'reading' },
        { id: 'asset', name: '资产', archived: true },
        { id: 'reading', name: '读书', parentId: 'invest' },
        { id: 'invest', name: '投资' },
        { id: 'finance', name: '理财', parentId: 'asset' }
    ]
})`);
assert.deepEqual(Array.from(field.options, (option) => option.id), ['asset', 'finance', 'invest', 'reading', 'computer'], 'normalized options must use depth-first tree order');

context.field = field;
const runtime = run('__tmBuildCustomFieldOptionRuntime(field)');
assert.equal(runtime.depthById.get('computer'), 2, 'tree depth must be capped at three levels');
assert.equal(runtime.pathById.get('computer'), '投资 / 读书 / 计算机', 'paths must include every visible ancestor after an over-depth subtree is rooted');
assert.deepEqual(Array.from(runtime.ancestorIdsById.get('computer')), ['invest', 'reading']);
assert.equal(runtime.effectiveArchivedById.get('finance'), true, 'an archived parent must make its branch effectively archived');
assert.equal(runtime.optionById.get('asset').archived, true, 'explicit archive state must be preserved');
assert.deepEqual(Array.from(run(`__tmNormalizeCustomFieldValue(field, '计算机')`)), ['computer'], 'an old task attribute name must still resolve after its option is moved');
assert.equal(run(`__tmSerializeCustomFieldValue(field, 'computer')`), '计算机', 'moving an option must not rewrite the task attribute to a hierarchy path');
assert.deepEqual(Array.from(run(`__tmNormalizeCustomFieldValue(field, '理财')`)), ['finance'], 'archived historical values must remain readable');

context.localFlatDefs = [{
    id: 'topic', name: '主题', type: 'single', options: [
        { id: 'parent', name: '父级' },
        { id: 'child', name: '子级' },
    ],
}];
context.remoteTreeDefs = [{
    id: 'topic', name: '主题', type: 'single', options: [
        { id: 'parent', name: '父级' },
        { id: 'child', name: '子级', parentId: 'parent' },
    ],
}];
const mobileResolved = run(`__tmResolveCustomFieldDefsOnLoad(localFlatDefs, remoteTreeDefs, {
    localVersion: 4, remoteVersion: 4
})`);
assert.equal(mobileResolved.defs[0].options.find((option) => option.id === 'child').parentId, 'parent', 'same-version mobile caches must not flatten richer remote hierarchy metadata');
assert.equal(mobileResolved.repairRemote, false, 'a richer remote definition needs no cloud repair');
const desktopResolved = run(`__tmResolveCustomFieldDefsOnLoad(remoteTreeDefs, localFlatDefs, {
    localVersion: 4, remoteVersion: 4
})`);
assert.equal(desktopResolved.defs[0].options.find((option) => option.id === 'child').parentId, 'parent', 'same-version flat remote data must not flatten a richer desktop cache');
assert.equal(desktopResolved.repairRemote, true, 'a richer local definition must request cloud repair');
context.localRenamedFlatDefs = [{
    id: 'topic', name: '本机名称', type: 'single', options: [{ id: 'parent', name: '父级' }],
}];
context.remoteRenamedFlatDefs = [{
    id: 'topic', name: '云端名称', type: 'single', options: [{ id: 'parent', name: '父级' }],
}];
const ordinaryConflict = run(`__tmResolveCustomFieldDefsOnLoad(localRenamedFlatDefs, remoteRenamedFlatDefs, {
    localVersion: 4, remoteVersion: 4
})`);
assert.equal(ordinaryConflict.repairRemote, false, 'ordinary same-version field differences must not trigger hierarchy repair writes');

const invalid = run(`__tmNormalizeCustomFieldDef({
    id: 'invalid', name: '异常', type: 'single', options: [
        { id: 'missing', name: 'Missing', parentId: 'gone' },
        { id: 'self', name: 'Self', parentId: 'self' },
        { id: 'a', name: 'A', parentId: 'b' },
        { id: 'b', name: 'B', parentId: 'a' }
    ]
})`);
assert.equal(invalid.options.length, 4, 'invalid hierarchy must never delete options');
assert.ok(invalid.options.every((option) => option.parentId === ''), 'missing, self, and cyclic parents must normalize to root');

const overDepth = run(`__tmNormalizeCustomFieldDef({
    id: 'deep', name: '过深', type: 'single', options: [
        { id: 'e', name: 'E', parentId: 'd' },
        { id: 'd', name: 'D', parentId: 'c' },
        { id: 'c', name: 'C', parentId: 'b' },
        { id: 'b', name: 'B', parentId: 'a' },
        { id: 'a', name: 'A' }
    ]
})`);
assert.equal(overDepth.options.find((option) => option.id === 'd').parentId, '', 'the shallowest over-depth node must become the new subtree root');
assert.equal(overDepth.options.find((option) => option.id === 'e').parentId, 'd', 'over-depth recovery must keep descendants attached regardless of source order');

context.options = [
    { id: 'a', name: 'A', color: '#111111', parentId: '', archived: false },
    { id: 'b', name: 'B', color: '#222222', parentId: '', archived: false },
    { id: 'b1', name: 'B1', color: '#333333', parentId: 'b', archived: false },
    { id: 'c', name: 'C', color: '#444444', parentId: '', archived: false },
];
const moved = run(`__tmMoveCustomFieldOptionSubtree(options, {
    sourceId: 'c', targetParentId: 'b', targetSiblingIndex: 1
})`);
assert.equal(moved.ok, true);
assert.deepEqual(Array.from(moved.options, (option) => option.id), ['a', 'b', 'b1', 'c']);
assert.equal(moved.options.find((option) => option.id === 'c').parentId, 'b');
assert.equal(run(`__tmMoveCustomFieldOptionSubtree(options, {
    sourceId: 'b', targetParentId: 'b1', targetSiblingIndex: 0
}).reason`), 'cycle', 'a node cannot move into its descendant');
assert.equal(run(`__tmMoveCustomFieldOptionSubtree([
    { id: 'a', parentId: '' }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: '' }, { id: 'd', parentId: 'c' }
], { sourceId: 'c', targetParentId: 'b', targetSiblingIndex: 0 }).reason`), 'max-depth', 'moves must preserve the three-level limit for the whole subtree');

context.rollupField = {
    type: 'multi',
    options: [
        { id: 'parent', name: '父级', parentId: '' },
        { id: 'child', name: '子级', parentId: 'parent' },
    ],
};
const rollup = run(`__tmResolveCustomFieldRollupOptionIds(rollupField, ['parent', 'child'])`);
assert.deepEqual(Array.from(rollup.directIds), ['parent', 'child'], 'direct values must keep explicit selections');
assert.deepEqual(Array.from(rollup.rollupIds), ['parent', 'child'], 'rollup values must include ancestors without double counting');

const kernelDefinitionStart = kernelSource.indexOf('function customFieldDefinitions');
const kernelDefinitionEnd = kernelSource.indexOf('    function statusDefinitions', kernelDefinitionStart);
const kernelBreakdownStart = kernelSource.indexOf('function customFieldBreakdown');
const kernelBreakdownEnd = kernelSource.indexOf('    async function aggregateTaskStats', kernelBreakdownStart);
assert.ok(kernelDefinitionStart >= 0 && kernelDefinitionEnd > kernelDefinitionStart, 'Kernel hierarchy serializer must remain extractable');
assert.ok(kernelBreakdownStart >= 0 && kernelBreakdownEnd > kernelBreakdownStart, 'Kernel hierarchy aggregation must remain extractable');
const kernelContext = vm.createContext({
    Map,
    Set,
    text: (value) => String(value == null ? '' : value).trim(),
});
vm.runInContext(kernelSource.slice(kernelDefinitionStart, kernelDefinitionEnd), kernelContext);
vm.runInContext(kernelSource.slice(kernelBreakdownStart, kernelBreakdownEnd), kernelContext);
kernelContext.registry = {
    fields: [{
        id: 'topic', name: '主题', label: '主题', type: 'multi', attr: 'custom-tm-topic', custom: true,
        options: [
            { id: 'invest', name: '投资' },
            { id: 'reading', name: '读书', parentId: 'invest' },
            { id: 'computer', name: '计算机', parentId: 'reading' },
            { id: 'archive', name: '旧分类', archived: true },
            { id: 'legacy', name: '旧标签', parentId: 'archive' },
        ],
    }],
};
const aiDefinitions = vm.runInContext('customFieldDefinitions(registry)', kernelContext);
const computerDefinition = aiDefinitions[0].options.find((option) => option.id === 'computer');
const legacyDefinition = aiDefinitions[0].options.find((option) => option.id === 'legacy');
assert.equal(aiDefinitions[0].attr, 'custom-tm-topic');
assert.equal(aiDefinitions[0].maxDepth, 3);
assert.equal(computerDefinition.parentID, 'reading');
assert.equal(computerDefinition.depth, 2);
assert.equal(computerDefinition.path, '投资 / 读书 / 计算机');
assert.deepEqual(Array.from(computerDefinition.ancestorIDs), ['invest', 'reading']);
assert.equal(legacyDefinition.effectiveArchived, true, 'Kernel metadata must retain inherited archive state for historical AI reads');

kernelContext.statsRows = [
    { topic: '投资, 计算机' },
    { topic: '计算机' },
    { topic: '读书' },
    { topic: '' },
];
kernelContext.statsField = kernelContext.registry.fields[0];
const aiBreakdown = vm.runInContext("customFieldBreakdown(statsRows, statsField, 'topic')", kernelContext);
const investStats = aiBreakdown.hierarchyItems.find((option) => option.id === 'invest');
const readingStats = aiBreakdown.hierarchyItems.find((option) => option.id === 'reading');
const computerStats = aiBreakdown.hierarchyItems.find((option) => option.id === 'computer');
assert.equal(investStats.directCount, 1);
assert.equal(investStats.totalCount, 3, 'a task selecting both parent and child must count once in the parent rollup');
assert.equal(readingStats.totalCount, 3);
assert.equal(computerStats.directCount, 2);
assert.equal(aiBreakdown.items.find((item) => item.key === '未设置').count, 1);

assert.match(settingsSource, /tm-custom-field-option-tree[\s\S]*data-tm-custom-field-option-drag[\s\S]*__tmMoveCustomFieldOptionSubtree/, 'settings must expose one tree editor backed by the shared subtree move helper');
assert.match(settingsSource, /'indent', 'text-indent'[\s\S]*'promote', 'text-outdent'/, 'tree indent controls must use the Phosphor Bold text indent icons');
assert.match(settingsSource, /children\.length \? '有子项时不能删除'[\s\S]*children\.length > 0/, 'parents with children must not be deletable');
assert.match(settingsSource, /__tmRefreshSettingsProjectionView\('custom-field-def-change'\)/, 'definition changes must immediately refresh filtering and sorting');
assert.match(settingsSource, /parentId:[\s\S]*archived:/, 'settings save must preserve hierarchy and archive metadata');
assert.match(pickerSource, /function __tmRenderCustomFieldOptionTreePicker[\s\S]*已归档或历史值/, 'the main picker must render current historical values separately');
assert.match(pickerSource, /function __tmGetDefaultExpandedCustomFieldOptionIds[\s\S]*hasActiveChildren[\s\S]*expandedIds\.add\(optionId\)/, 'the main picker must default every active parent branch to expanded');
assert.match(pickerSource, /max-height:min\(300px,50vh\);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain/, 'the shared custom-field option list must scroll independently like the status picker');
assert.doesNotMatch(pickerSource, /appendSectionLabel\('可选项'\)/, 'the main custom-field picker must not add a redundant active-options heading');
assert.match(pickerSource, /effectiveArchivedById[\s\S]*historicalIds/, 'the main picker must derive history from effective archive state');
assert.match(pickerSource, /expandColumnWidth = useTouchLayout \? 36 : 22[\s\S]*optionRowHeight = useTouchLayout \? 36 : 30[\s\S]*grid-template-columns:minmax\(0,1fr\) \$\{expandColumnWidth\}px[\s\S]*width:100%[\s\S]*row\.append\(button, expand\)/, 'the main picker must keep compact mobile rows and the expand control at the popover right edge');
assert.match(pickerSource, /wrap\.style\.alignItems = 'stretch'[\s\S]*wrap\.style\.width = '100%'[\s\S]*list\.style\.width = '100%'/, 'the task-detail picker must stretch its tree through the popover width');
assert.match(pickerSource, /actions\.style\.width = '100%'[\s\S]*actions\.style\.alignSelf = 'stretch'[\s\S]*actions\.style\.boxSizing = 'border-box'/, 'the main picker footer divider must span the full menu content width');
assert.match(quickAddSource, /__tmRenderCustomFieldOptionTreePicker\(list, field, draft/, 'quick add must reuse the main hierarchy picker behavior');
assert.match(quickAddSource, /expandedIds = __tmGetDefaultExpandedCustomFieldOptionIds\(field\)/, 'quick add must open with every active parent branch expanded');
assert.match(quickAddSource, /wrap\.style\.width = '100%'[\s\S]*list\.style\.width = '100%'/, 'quick add must give the shared tree the full popover width');
assert.match(batchSource, /pathById[\s\S]*effectiveArchivedById[\s\S]*filter\(isActiveOptionId\)/, 'batch selection must show paths and reject archived new values');
assert.match(bridgeSource, /getCustomFieldSelectModel\(fieldId\)[\s\S]*pathLabel:[\s\S]*effectiveArchived:/, 'Quickbar must consume a read-only selection model from the main runtime');
assert.match(quickbarSource, /parentId: String\(source\.parentId[\s\S]*archived: source\.archived === true/, 'Quickbar fallback parsing must retain hierarchy metadata');
assert.match(quickbarSource, /activeOptions[\s\S]*option\?\.effectiveArchived !== true/, 'Quickbar must exclude effectively archived options from active choices');
assert.match(quickbarSource, /getHistoricalOptions[\s\S]*已归档或历史值/, 'Quickbar must keep selected historical values removable');
assert.doesNotMatch(quickbarSource, /select-section">可选项/, 'Quickbar must not add a redundant active-options heading');
assert.match(quickbarSource, /activeChildrenByParentId[\s\S]*renderCustomTreeNodes[\s\S]*renderCustomTreeNodes\(value, depth \+ 1\)/, 'Quickbar must render active custom-field options recursively from parent groups');
assert.match(quickbarSource, /activeChildrenByParentId\.forEach\(\(children, parentId\)[\s\S]*expandedCustomOptionIds\.add\(parentId\)/, 'Quickbar must open with every active parent branch expanded');
assert.match(quickbarSource, /select-list[\s\S]*max-height: min\(300px, 50vh\);[\s\S]*overflow-y: auto;[\s\S]*overflow-x: hidden;[\s\S]*overscroll-behavior: contain;/, 'Quickbar custom-field options must scroll independently while footer actions remain outside the list');
assert.match(quickbarSource, /selectMenu\.onclick = async[\s\S]*closest\('\[data-expand-option-id\]'\)[\s\S]*renderSelectMenuContent\(\)[\s\S]*closest\('\.sy-custom-props-floatbar__option'\)/, 'Quickbar expansion must rerender without entering the option selection path');
assert.match(quickbarSource, /custom-tree-row[\s\S]*grid-template-columns: minmax\(0, 1fr\) 22px/, 'Quickbar must keep its expand control in the rightmost tree column');
assert.match(quickbarSource, /@media \(max-width: 720px\), \(pointer: coarse\)[\s\S]*custom-tree-row[\s\S]*grid-template-columns: minmax\(0, 1fr\) 36px[\s\S]*custom-expand[\s\S]*width: 36px/, 'Quickbar must retain visible compact tree expansion controls on mobile');
assert.match(quickbarSource, /viewportWidth[\s\S]*maxLeft[\s\S]*Math\.min\(desiredLeft, maxLeft\)/, 'Quickbar must clamp the rightmost tree control inside the mobile viewport');
assert.match(quickbarSource, /customFieldChromeWidth = \(isTouchLike \? 36 : 22\) \+ 64[\s\S]*maxLen \* 12 \+ customFieldChromeWidth/, 'Quickbar width estimation must reserve space for hierarchy controls and selection state');
assert.match(quickbarSource, /alignToAnchorRight[\s\S]*anchorRect\.right - menuWidth/, 'Quickbar custom-field menus on the right side must expand left from the anchor');
assert.match(source, /remoteCustomFieldDefsVersion === loadedCustomFieldDefsVersion[\s\S]*__tmMergeSameVersionCustomFieldDefs/, 'settings save must reconcile same-version flat and hierarchical device caches');
assert.match(source, /resolvedCustomFieldSchema\.repairRemote === true[\s\S]*this\.save\(\{ suppressMobileCloseSyncDirty: true \}\)/, 'settings load must repair flattened cloud hierarchy metadata');
assert.match(kernelSource, /taskHorizonGetCustomFieldDefinitions[\s\S]*customFieldDefinitions\(await getFieldRegistry\(\)\)/, 'Kernel must expose the shared hierarchy serializer through a read-only RPC');
assert.match(kernelSource, /aggregate_task_stats[\s\S]*hierarchyItems[\s\S]*directCount\/totalCount/, 'the stats tool must document direct and ancestor rollups for AI');
assert.match(workbenchSource, /customFieldHierarchyInstruction[\s\S]*taskHorizonGetCustomFieldDefinitions[\s\S]*ancestorIDs[\s\S]*hierarchyItems\.totalCount/, 'the AI prompt must receive live hierarchy and aggregation semantics from Kernel');
assert.match(workbenchSource, /只有实际改选标签时才写任务 patch/, 'definition metadata must not enter the task patch chain');

process.stdout.write('custom field hierarchy contract tests passed\n');
