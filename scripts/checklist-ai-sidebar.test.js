const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const checklistSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'task-horizon', 'main', 'render', '42-render-list-and-checklist-body.js'),
    'utf8',
);
const viewPolicySource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'task-horizon', 'main', '31-view-host-policies.js'),
    'utf8',
);

const task = { id: 'task-1', content: 'Task' };
const state = {
    viewMode: 'checklist',
    flatTasks: { [task.id]: task },
    pendingInsertedTasks: {},
    filteredTasks: [],
    listRenderStep: 20,
    listRenderLimit: 20,
    groupByDocName: false,
    groupByTaskName: false,
    groupByTime: false,
    quadrantEnabled: false,
    detailTaskId: task.id,
    checklistDetailDismissed: false,
    checklistDetailSheetOpen: false,
    checklistDetailSheetFullscreen: false,
};
let useChecklistSheetMode = false;

const context = vm.createContext({
    state,
    Element: class Element {},
    window: { innerWidth: 1440 },
    SettingsStore: {
        data: {
            enableGroupTaskBgByGroupColor: false,
            checklistCompactMode: false,
            checklistCompactTreeGuides: false,
            checklistDetailWidth: 320,
        },
    },
    __TM_CHECKLIST_COMPACT_META_FIELD_DEFAULTS: [],
    __tmBuildTaskRowModel: () => [],
    __tmNormalizeDateOnly: () => '',
    __tmIsDarkMode: () => false,
    __tmGetChecklistCompactRightFontSize: () => 12,
    __tmGetCustomFieldDefs: () => [],
    __tmGetWrapConfig: () => ({ enabled: false }),
    __tmChecklistUseSheetMode: () => useChecklistSheetMode,
    __tmGetEffectiveProgressBarColor: () => '',
    __tmResolveFirstVisibleTaskIdFromRowModel: () => '',
    __tmShouldRenderTaskDetailNoteView: () => false,
    __tmBuildTaskDetailNoteViewInnerHtml: () => '<div data-detail>detail</div>',
    __tmBuildTaskDetailInnerHtml: () => '<div data-detail>detail</div>',
    __tmHasCalendarSidebarChecklist: () => false,
    __tmShouldShowCalendarSideDock: () => false,
    __tmShouldShowAiSidebar: () => true,
    __tmIsMobileDevice: () => false,
});

vm.runInContext(viewPolicySource, context, { filename: '31-view-host-policies.js' });
vm.runInContext(checklistSource, context, { filename: '42-render-list-and-checklist-body.js' });

const regularHtml = context.__tmBuildRenderSceneChecklistBodyHtml();
assert.match(regularHtml, /class="tm-checklist-resizer"/);
assert.match(regularHtml, /class="tm-checklist-side"/);
assert.equal(context.__tmViewPolicy.shouldUseChecklistSheetMode(), false);

state.aiSidebarOpen = true;
assert.equal(context.__tmViewPolicy.shouldUseChecklistSheetMode(), true);
state.aiSidebarOpen = false;
assert.equal(context.__tmViewPolicy.shouldUseChecklistSheetMode(), false);
state.aiSidebarOpen = true;
assert.equal(context.__tmViewPolicy.shouldUseChecklistSheetMode(), true);
useChecklistSheetMode = context.__tmViewPolicy.shouldUseChecklistSheetMode();
const aiSidebarHtml = context.__tmBuildRenderSceneChecklistBodyHtml();
assert.doesNotMatch(aiSidebarHtml, /class="tm-checklist-resizer"/);
assert.doesNotMatch(aiSidebarHtml, /class="tm-checklist-side"/);
assert.match(aiSidebarHtml, /class="tm-checklist-pane/);
assert.match(aiSidebarHtml, /id="tmChecklistSheet"/);
assert.equal(state.detailTaskId, task.id);

console.log('checklist AI sidebar contract: ok');
