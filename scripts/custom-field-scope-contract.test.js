'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const listSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
const timelineSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js'), 'utf8');
const servicesSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const settingsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/62-settings-columns-and-rules.js'), 'utf8');
const groupSettingsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/70-doc-group-and-settings-actions.js'), 'utf8');
const quickbarSource = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/81-ai-bridge-runtime.js'), 'utf8');
const kernelSource = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

function sliceSource(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.ok(start >= 0, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(end > start, `missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

const fields = [
    { id: 'global', enabled: true, scope: null },
    { id: 'direct', enabled: true, scope: { docIds: ['doc-direct'], docGroupIds: [], docTabGroupIds: [] } },
    { id: 'grouped', enabled: true, scope: { docIds: [], docGroupIds: ['group-a'], docTabGroupIds: [] } },
    { id: 'tabbed', enabled: true, scope: { docIds: [], docGroupIds: [], docTabGroupIds: ['tab-a'] } },
    { id: 'missing', enabled: true, scope: { docIds: [], docGroupIds: ['deleted-group'], docTabGroupIds: ['deleted-tab'] } },
];
const fieldMap = new Map(fields.map((field) => [field.id, field]));
const context = vm.createContext({
    console,
    Date,
    JSON,
    Map,
    Set,
    Promise,
    SettingsStore: {
        data: {
            customFieldDefs: fields,
            docGroups: [{ id: 'group-a', name: 'Group A' }],
            docTabCustomGroups: [{ id: 'tab-a', name: 'Tab A' }],
        },
    },
    state: { allDocuments: [], filteredTasks: [], activeDocId: '' },
    API: { getAllDocuments: async () => [] },
    __tmGetCustomFieldDefs: () => fields,
    __tmGetCustomFieldDefMap: () => fieldMap,
    __tmParseCustomFieldColumnKey: (key) => String(key || '').startsWith('customField:') ? String(key).slice(12) : '',
    resolveDocIdsFromGroups: async ({ groupId }) => groupId === 'group-a' ? ['doc-group'] : [],
    __tmGetDocTabCustomGroups: () => [{ id: 'tab-a', name: 'Tab A' }],
    __tmExpandDocTabCustomGroup: (group) => group?.id === 'tab-a' ? new Map([['doc-tab', {}]]) : new Map(),
});

vm.runInContext(sliceSource(
    storeSource,
    'function __tmNormalizeCustomFieldIdList',
    '    function __tmBuildRuntimeCustomFieldLoadPlan',
), context);
vm.runInContext(`${sliceSource(
    storeSource,
    'const __tmCustomFieldScopeRuntime',
    '    function __tmGetCustomFieldAttrKeyMap',
)}\nglobalThis.scopeRuntime = __tmCustomFieldScopeRuntime;`, context);

(async () => {
    await vm.runInContext('__tmRefreshCustomFieldScopeMembership({ force: true })', context);

    const applies = (fieldId, docId) => {
        context.field = fieldMap.get(fieldId);
        context.docId = docId;
        return vm.runInContext('__tmIsCustomFieldApplicableToDoc(field, docId)', context);
    };
    assert.equal(applies('global', 'any-doc'), true, 'null scope must remain global');
    assert.equal(applies('direct', 'doc-direct'), true, 'explicit documents must match');
    assert.equal(applies('grouped', 'doc-group'), true, 'resolved document groups must match');
    assert.equal(applies('tabbed', 'doc-tab'), true, 'expanded tab groups must match');
    assert.equal(applies('missing', 'doc-group'), false, 'deleted references must fail closed');
    assert.equal(vm.runInContext(`__tmIsCustomFieldApplicableToDoc({ enabled: true, scope: { docIds: [], docGroupIds: [], docTabGroupIds: [] } }, 'doc-direct')`, context), false, 'an explicit empty scope must not broaden to global');

    context.order = ['content', 'customField:direct', 'doc', 'customField:grouped', 'customField:tabbed', 'customField:missing'];
    context.viewTasks = [{ root_id: 'doc-group' }, { root_id: 'doc-tab' }];
    const effectiveOrder = vm.runInContext('__tmGetEffectiveCustomFieldColumnOrder(order, viewTasks)', context);
    assert.deepEqual(Array.from(effectiveOrder), ['content', 'doc', 'customField:grouped', 'customField:tabbed'], 'scope filtering must preserve persisted relative order');

    assert.match(settingsSource, /data-tm-custom-field-scope-mode[\s\S]*data-tm-custom-field-scope-docs[\s\S]*data-tm-custom-field-scope-doc-groups[\s\S]*data-tm-custom-field-scope-tab-groups/, 'field settings must expose all three scope target types');
    assert.match(settingsSource, /tmOpenCustomFieldDialog = async function[\s\S]*__tmEnsureAllDocumentsLoaded\(false\)/, 'field settings must load document choices before opening the scope editor');
    assert.match(settingsSource, /type="checkbox" \$\{dataAttr\}[\s\S]*selected\.has\(id\) \? 'checked'/, 'scope options must expose an explicit checked state');
    assert.match(settingsSource, /tm-custom-field-scope-selection[\s\S]*已选择范围[\s\S]*selectedScopeSummaryHtml/, 'scope settings must show selected targets in a separate summary');
    assert.match(settingsSource, /type="search"[\s\S]*data-tm-custom-field-scope-doc-search[\s\S]*placeholder="搜索并选择文档"/, 'document scope choices must support name search');
    assert.doesNotMatch(settingsSource, /data-tm-custom-field-scope-doc-result/, 'document search must not render a result count beside its label');
    assert.doesNotMatch(settingsSource, /data-tm-custom-field-scope-doc-search[^>]*>[\s\S]{0,120}__tmRenderLucideIcon\('search'\)/, 'document search must not render a separate search icon');
    assert.doesNotMatch(settingsSource, /data-tm-custom-field-scope-trigger="(?:docGroup|tabGroup)"[\s\S]{0,300}__tmRenderLucideIcon\('chevron-down'\)/, 'group scope triggers must not render separate dropdown icons');
    assert.match(settingsSource, /resolveDocScopeSearchResults[\s\S]*if \(!query\) return \{ matches: \[\], shown: \[\] \};[\s\S]*matches\.slice\(0, 60\)/, 'document choices must stay empty before search and cap broad result sets');
    assert.match(settingsSource, /data-tm-custom-field-scope-doc-list[\s\S]*\$\{scopeDocSearch \? docScopeChoices : '<div class="tm-custom-field-scope-empty">输入文档名称开始搜索<\/div>'\}/, 'an empty document search must render guidance instead of all documents');
    assert.match(settingsSource, /renderedIds[\s\S]*!renderedIds\.has\(id\)[\s\S]*previousScope\.docIds/, 'search result changes must preserve selected documents that are not currently rendered');
    assert.match(settingsSource, /data-tm-custom-field-scope-remove[\s\S]*draft\.scope\[key\][\s\S]*filter/, 'selected scope targets must be removable from the summary');
    assert.doesNotMatch(settingsSource, /<select multiple|Ctrl 或 Command/, 'scope selection must not rely on ambiguous native multi-select highlighting');
    assert.match(stylesSource, /\.tm-custom-field-scope-choice:has\(input:checked\)[\s\S]*accent-color:/, 'checked scope rows must have both selection emphasis and a native checkmark');
    assert.match(settingsSource, /scope: nextScope/g, 'both create and update paths must persist the normalized scope');
    assert.match(listSource, /!__tmIsCustomFieldApplicableToTask\(field, task\)[\s\S]*<td class="tm-task-meta-cell"/, 'list rows outside scope must render a non-editable placeholder cell');
    assert.match(timelineSource, /!__tmIsCustomFieldApplicableToTask\(field, task\)[\s\S]*<td class="tm-task-meta-cell"/, 'timeline rows outside scope must render a non-editable placeholder cell');
    assert.match(timelineSource, /__tmBuildTimelineColumnShellHtml[\s\S]*colgroupHtml[\s\S]*headerHtml/, 'timeline header and colgroup must share one effective column shell');
    assert.match(servicesSource, /__tmGetEffectiveCustomFieldColumnOrder\(__tmGetTimelineColumnOrder\(\), state\.filteredTasks\)[\s\S]*timelineColumnShell[\s\S]*tmTableWidth/, 'in-place timeline refresh must update order, shell, and table width together');
    assert.match(quickbarSource, /quickbarCustomFieldScopeByDoc = new Map\(\)[\s\S]*quickbarCustomFieldScopePromises = new Map\(\)/, 'quickbar must keep one applicability cache and in-flight request per root document');
    assert.match(quickbarSource, /\.map\(\(itemKey\) => getQuickbarCustomFieldConfigByToken\(itemKey\)\)[\s\S]*\.filter\(Boolean\)[\s\S]*\.filter\(\(config\) => isQuickbarCustomFieldConfigApplicable\(config, currentQuickbarApplicableCustomFieldIds\)\)/, 'quickbar must discard non-custom entries before applying custom field scope filters');
    const quickbarBridgeGetterSource = sliceSource(quickbarSource, 'async function getTaskHorizonBridgeCustomProps', 'function resolveQuickbarAttrBindingFromBlockId');
    let bridgeGetterOptions = null;
    const getTaskHorizonBridgeCustomProps = new Function('getTaskHorizonSharedApi', 'normalizeCustomProps', `${quickbarBridgeGetterSource}; return getTaskHorizonBridgeCustomProps;`)(
        () => ({ quickbarBridge: { getTaskCustomPropsByAnyId: async (_id, options) => {
            bridgeGetterOptions = options;
            return {
                props: { status: 'todo' },
                taskId: 'task-a',
                attrHostId: 'host-a',
                sourceDocId: 'doc-source',
                attrContext: { taskId: 'task-a', primaryHostId: 'host-a', state: 'state1-parent' },
                applicableCustomFieldIds: ['direct'],
            };
        } } }),
        (value) => value,
    );
    const bridgedProps = await getTaskHorizonBridgeCustomProps('task-a', { forceFresh: true });
    assert.equal(bridgedProps?.applicableCustomFieldIds, undefined, 'task property snapshots must not carry document applicability metadata');
    assert.equal(bridgedProps?.sourceDocId, undefined, 'ordinary quickbar reads must not opt into source context');
    const contextualProps = await getTaskHorizonBridgeCustomProps('task-a', { includeContext: true });
    assert.equal(bridgeGetterOptions?.includeContext, true, 'embedded quickbar reads must opt into source context explicitly');
    assert.equal(contextualProps?.sourceDocId, 'doc-source', 'embedded quickbar reads must preserve the source document ID');
    assert.equal(contextualProps?.attrContext?.primaryHostId, 'host-a', 'embedded quickbar reads must preserve the authoritative attr host');
    assert.match(quickbarSource, /function renderInlineMetaHtml\(cfg, props, blockEl = null, applicableCustomFieldIds = null\)[\s\S]*isQuickbarCustomFieldConfigApplicable\(config, applicableCustomFieldIds\)[\s\S]*renderInlineMetaField/, 'persistent quickbar fields must receive document applicability separately from task properties');
    const quickbarApplicabilitySource = sliceSource(quickbarSource, 'function isQuickbarCustomFieldConfigApplicable', 'function normalizeQuickbarCustomFieldScope');
    const isQuickbarFieldApplicable = new Function(`${quickbarApplicabilitySource}; return isQuickbarCustomFieldConfigApplicable;`)();
    assert.equal(isQuickbarFieldApplicable({ customFieldId: 'global', customField: { scope: null } }, new Set()), true, 'quickbar global fields must remain visible');
    assert.equal(isQuickbarFieldApplicable({ customFieldId: 'direct', customField: { scope: {} } }, new Set(['direct'])), true, 'quickbar scoped fields must be visible for matching documents');
    assert.equal(isQuickbarFieldApplicable({ customFieldId: 'direct', customField: { scope: {} } }, new Set()), false, 'quickbar scoped fields must be hidden for out-of-scope documents');
    const quickbarScopeCacheSource = sliceSource(quickbarSource, 'function clearQuickbarCustomFieldScopeCache', 'async function ensureInlineMetaScopeDocIds');
    let docScopeQueryCount = 0;
    const previousSharedApi = globalThis['siyuan-plugin-task-horizon'];
    globalThis['siyuan-plugin-task-horizon'] = { quickbarBridge: { getApplicableCustomFieldIdsForDoc: async () => {
        docScopeQueryCount += 1;
        await Promise.resolve();
        return ['direct'];
    } } };
    const scopeCache = new Function(`
        let quickbarCustomFieldScopeByDoc = new Map();
        let quickbarCustomFieldScopePromises = new Map();
        let quickbarCustomFieldScopeRevision = 0;
        ${quickbarScopeCacheSource}
        return { clearQuickbarCustomFieldScopeCache, ensureQuickbarCustomFieldIdsForDoc };
    `)();
    const [firstDocScope, secondDocScope] = await Promise.all([
        scopeCache.ensureQuickbarCustomFieldIdsForDoc('doc-a'),
        scopeCache.ensureQuickbarCustomFieldIdsForDoc('doc-a'),
    ]);
    assert.equal(docScopeQueryCount, 1, 'tasks in the same document must share one scope lookup');
    assert.deepEqual(Array.from(firstDocScope), ['direct']);
    assert.equal(firstDocScope, secondDocScope, 'concurrent renderers must share the same document scope result');
    scopeCache.clearQuickbarCustomFieldScopeCache();
    await scopeCache.ensureQuickbarCustomFieldIdsForDoc('doc-a');
    assert.equal(docScopeQueryCount, 2, 'scope changes must invalidate the document result');
    if (previousSharedApi === undefined) delete globalThis['siyuan-plugin-task-horizon'];
    else globalThis['siyuan-plugin-task-horizon'] = previousSharedApi;
    assert.match(quickbarScopeCacheSource, /globalThis\?\.\['siyuan-plugin-task-horizon'\]\?\.quickbarBridge\?\.getApplicableCustomFieldIdsForDoc/, 'outer scope cache must access the shared bridge without relying on an inner helper');
    const floatBarSource = sliceSource(quickbarSource, 'async function showFloatBar', 'async function refreshVisibleQuickbarCustomFieldScope');
    assert.match(floatBarSource, /resolveDocIdFromTaskBlock\(blockEl\)[\s\S]*await ensureQuickbarCustomFieldIdsForDoc\(docIdAtOpen\)[\s\S]*currentQuickbarApplicableCustomFieldIds = applicableCustomFieldIds[\s\S]*renderFloatBar\(\)[\s\S]*floatBar\.style\.display = 'flex'/, 'floating quickbar must resolve document scope before its first visible render');
    const inlineRenderSource = sliceSource(quickbarSource, 'async function renderInlineMetaForBlock', 'function scheduleInlineMetaRender');
    assert.match(inlineRenderSource, /isEmbedded \? String\(embedContext\?\.sourceDocId[\s\S]*: resolveDocIdFromTaskBlock\(blockEl\)[\s\S]*await ensureQuickbarCustomFieldIdsForDoc\(docId\)[\s\S]*renderInlineMetaHtml\(cfg, cachedPropsForRender, blockEl, applicableCustomFieldIds\)/, 'persistent fields must use source scope only for embedded instances');
    assert.doesNotMatch(quickbarSource, /__tmApplicableCustomFieldIds|canReuseQuickbarPropsCache|hasScopedCustomFields/, 'quickbar must not fall back to per-task applicability state');
    assert.doesNotMatch(quickbarSource, /async function isInlineMetaScopeAllowedForBlock\(/, 'quickbar must not retain the unused async inline scope wrapper');
    assert.equal((quickbarSource.match(/isQuickbarCustomFieldConfigApplicable\(config, currentQuickbarApplicableCustomFieldIds\)/g) || []).length, 1, 'floating quickbar must apply custom field scope only once');
    assert.doesNotMatch(quickbarSource, /ensureQuickbarCustomFieldIdsForDoc\(docId, forceRefresh|refreshVisibleQuickbarCustomFieldScope\(forceRefresh/, 'document scope helpers must not retain unused force-refresh parameters');
    const quickbarRefreshGlobalsSource = sliceSource(quickbarSource, 'globalThis.__taskHorizonQuickbarRefreshInline =', 'globalThis.__taskHorizonQuickbarInlineStats');
    assert.doesNotMatch(quickbarRefreshGlobalsSource, /clearQuickbarCustomFieldScopeCache/, 'ordinary quickbar refreshes must preserve the document scope cache');
    assert.match(quickbarRefreshGlobalsSource, /__taskHorizonQuickbarInvalidateCustomFieldScope[\s\S]*invalidateQuickbarCustomFieldScope\(\)/, 'custom field scope must have a dedicated invalidation entry point');
    const storageListenerSource = sliceSource(quickbarSource, 'function initStatusOptionsListener', 'globalThis.__taskHorizonQuickbarToggle');
    assert.doesNotMatch(storageListenerSource, /tm_custom_field_defs|tm_custom_field_defs_version|refreshVisibleQuickbarCustomFieldScope/, 'the outer storage listener must not duplicate custom field scope refreshes');
    assert.match(settingsSource, /__taskHorizonQuickbarInvalidateCustomFieldScope/, 'custom field settings must use the dedicated scope invalidation entry point');
    assert.match(storeSource, /function __tmInvalidateDocScopeCache[\s\S]*__taskHorizonQuickbarInvalidateCustomFieldScope/, 'document group scope invalidation must propagate to quickbar custom fields');
    assert.match(groupSettingsSource, /async function __tmSaveDocTabCustomGroups[\s\S]*__taskHorizonQuickbarInvalidateCustomFieldScope/, 'tab group changes must invalidate quickbar custom field scope');
    assert.doesNotMatch(quickbarSource, /field\.enabled !== false && field\.type !== 'text'/, 'quickbar custom field discovery must not discard text fields');
    assert.match(quickbarSource, /fieldType === 'text' \? 'text' : 'select'[\s\S]*customFieldType: fieldType/, 'quickbar text fields must use the existing text editor configuration');
    assert.match(quickbarSource, /customFieldType \|\| ''\)\.trim\(\) === 'text'[\s\S]*data-type="text"/, 'quickbar must render scoped text fields as editable text properties');
    assert.match(bridgeSource, /async function __tmGetQuickbarApplicableCustomFieldIdsForDoc\(docId\)[\s\S]*__tmRefreshCustomFieldScopeMembership\(\)[\s\S]*__tmIsCustomFieldApplicableToDoc\(field, did\)/, 'the quickbar bridge must resolve applicability once from the root document');
    assert.match(bridgeSource, /getApplicableCustomFieldIdsForDoc\(docId\)[\s\S]*__tmGetQuickbarApplicableCustomFieldIdsForDoc\(docId\)/, 'the shared quickbar bridge must expose document-level applicability');
    const taskPropsBridgeSource = sliceSource(bridgeSource, 'async function __tmGetQuickbarTaskCustomPropsByAnyId', 'async function __tmGetQuickbarApplicableCustomFieldIdsForDoc');
    assert.doesNotMatch(taskPropsBridgeSource, /__tmRefreshCustomFieldScopeMembership|applicableCustomFieldIds|__tmGetApplicableCustomFieldDefsForTask/, 'task property reads must not recompute document scope');
    assert.match(taskPropsBridgeSource, /opts\.includeContext === true[\s\S]*__tmResolveTaskAttrContext\([\s\S]*result\.sourceDocId[\s\S]*result\.attrContext/, 'the bridge must resolve source context only when explicitly requested');
    assert.match(kernelSource, /membersByTabGroup[\s\S]*tabGroupCount/, 'the kernel membership snapshot must include tab groups');

    process.stdout.write('custom field scope contract tests passed\n');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
