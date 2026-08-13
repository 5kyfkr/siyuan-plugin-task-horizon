'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stores = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'), 'utf8');
const nativeHooks = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'shell', '72-shell-entrances-and-native-doc-hooks.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'shell', '80-shell-lifecycle.js'), 'utf8');
const listRuntime = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js'), 'utf8');
const viewRuntime = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const liveApply = segment(
    stores,
    'function __tmApplyLiveDocumentTaskContentPatch',
    'function __tmCanPatchTaskBlockIncrementally',
);
assert.match(liveApply, /__tmMarkLocalTaskPatchWatermark\(tid, presentationPatch/,
    'native document titles must be protected from an older SQL result');
assert.match(liveApply, /__tmTaskStore\?\.patchLocal\?\.\(tid, statePatch/,
    'native document titles must use the shared task store before repainting');
assert.match(liveApply, /__tmRefreshContentPatchPresentation\(tid, presentationPatch/,
    'native document titles must use the same cross-view projector as plugin title edits');
assert.match(liveApply, /allowMountedInactive: true/,
    'native document titles must update a mounted split-pane plugin while focus remains in the document');
assert.doesNotMatch(liveApply, /API\.|patchContent\(|updateBlock|setBlockAttrs/,
    'a native document input is already persisted by SiYuan and must not create a second write');

const inputBinding = segment(
    nativeHooks,
    'function __tmResolveNativeDocTaskContentInput',
    'function __tmBindNativeDocCheckboxStatusSync',
);
assert.match(inputBinding, /node === contentBlock \|\| contentBlock\.contains\(node\)/,
    'only the direct task title block may change a task title');
assert.match(inputBinding, /eventNode\.matches\?\.\('\.protyle-wysiwyg'\)[\s\S]*document\.getSelection\?\.\(\)[\s\S]*getRangeAt\(0\)\?\.startContainer/,
    'desktop SiYuan input events must resolve the edited block from the current selection');
assert.match(nativeHooks, /closestListItem\.children[\s\S]*protyle-action--task/,
    'title input must resolve the nearest task item by its own checkbox instead of the first checkbox in the editor');

const findTaskItemSource = segment(
    nativeHooks,
    'function __tmFindNativeDocTaskListItem',
    'function __tmResolveNativeDocTaskBlockId',
);
const resolveTitleInputSource = segment(
    nativeHooks,
    'function __tmResolveNativeDocTaskContentInput',
    'function __tmScheduleNativeDocTaskContentSync',
);
class NativeTitleElement {}
const editorRoot = Object.assign(new NativeTitleElement(), {
    matches: (selector) => selector === '.protyle-wysiwyg',
    contains: (node) => node === titleNode,
});
const taskAction = Object.assign(new NativeTitleElement(), {
    classList: { contains: (name) => name === 'protyle-action--task' },
});
const taskItem = Object.assign(new NativeTitleElement(), {
    children: [taskAction],
    closest: (selector) => selector === '.protyle-wysiwyg' ? editorRoot : null,
});
const contentBlock = Object.assign(new NativeTitleElement(), {
    contains: (node) => node === titleNode,
});
const titleNode = Object.assign(new NativeTitleElement(), {
    closest: (selector) => selector.includes('NodeListItem') ? taskItem : editorRoot,
});
const selectionText = { parentElement: titleNode };
const resolveEventElement = (target) => target instanceof NativeTitleElement ? target : target?.parentElement || null;
const isExcluded = () => false;
const findTaskItem = new Function(
    'globalThis',
    'Element',
    '__tmIsNativeDocCheckboxSyncExcludedTarget',
    '__tmResolveNativeDocEventElement',
    `${findTaskItemSource}; return __tmFindNativeDocTaskListItem;`,
)({ __tmCompat: { resolveNativeTaskListItem: () => null } }, NativeTitleElement, isExcluded, resolveEventElement);
const resolveTitleInput = new Function(
    'globalThis',
    'document',
    'Element',
    'state',
    '__tmResolveNativeDocEventElement',
    '__tmIsNativeDocCheckboxSyncExcludedTarget',
    '__tmFindNativeDocTaskListItem',
    '__tmFindLiveDocumentTaskContentBlock',
    '__tmResolveAnyBlockIdFromElement',
    `${resolveTitleInputSource}; return __tmResolveNativeDocTaskContentInput;`,
)(
    { __tmTaskBoundary: { getTask: (taskId) => taskId === 'task-1' ? { id: taskId } : null } },
    { getSelection: () => ({ rangeCount: 1, getRangeAt: () => ({ startContainer: selectionText }) }) },
    NativeTitleElement,
    { flatTasks: { 'task-1': { id: 'task-1' } } },
    resolveEventElement,
    isExcluded,
    findTaskItem,
    () => contentBlock,
    () => 'task-1',
);
assert.equal(resolveTitleInput(editorRoot)?.taskId, 'task-1',
    'a desktop editor-root input event must resolve the task under the current selection');
assert.match(nativeHooks, /__TM_NATIVE_DOC_TASK_CONTENT_SYNC_DELAY_MS = 80/,
    'title projection must be short and bounded without repainting on every keystroke');
assert.match(inputBinding, /__tmNativeDocTaskContentSyncTimers\.set\(tid/,
    'rapid title input must coalesce per task');
assert.match(inputBinding, /__tmApplyLiveDocumentTaskContentPatch\(tid/,
    'the input hook must delegate state and view updates to the shared content projector');
assert.match(inputBinding, /event\.isComposing === true/,
    'IME composition must not publish partial titles');
assert.match(inputBinding, /'compositionend'/,
    'IME completion must publish the final title immediately');

const lifecycleInit = segment(lifecycle, 'async function init()', '// 监听悬浮条修改任务事件');
const shellOnlyInit = segment(lifecycleInit, 'if (bindShellEntrances)', 'try { __tmBindNativeDocTaskContentSync(); }');
assert.doesNotMatch(shellOnlyInit, /__tmBindNativeDocTaskContentSync/,
    'Dock hosts must not be excluded from the read-only native title bridge');
assert.match(lifecycleInit, /}\s*try \{ __tmBindNativeDocTaskContentSync\(\); \} catch \(e\) \{}/,
    'the native title bridge must be bound in every runtime host');
assert.match(lifecycle, /off\?\.\(document, 'input', __tmNativeDocTaskContentInputHandler, true\)/,
    'the native title input listener must be removed on unload');
assert.match(lifecycle, /__tmNativeDocTaskContentSyncTimers\.clear\(\)/,
    'pending native title timers must be cleared on unload');
assert.doesNotMatch(stores, /\[Task Horizon\]\[NativeTitle\]\[Direct\]/,
    'temporary native title diagnostics must not remain in production');
assert.match(stores, /querySelectorAll\?\.\('\[contenteditable="true"\]'\)[\s\S]*owner === taskItem/,
    'the live reader must resolve the editable title owned by the nearest task item');
assert.match(listRuntime, /presentation:\s*\{[\s\S]*allowMountedInactive: opts\.allowMountedInactive === true/,
    'the shared content ChangeSet must preserve the split-pane override');
assert.match(viewRuntime, /const allowMountedInactive = opts\.allowMountedInactive === true[\s\S]*if \(!__tmIsPluginVisibleNow\(\) && !allowMountedInactive\)/,
    'the visibility gate must allow only an explicitly requested mounted split pane');

console.log('task-native-document-title-live-refresh-contract: ok');
