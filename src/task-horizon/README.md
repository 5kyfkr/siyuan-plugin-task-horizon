# Task Horizon Source Root

`src/task-horizon/` is the development source root for the main task manager runtime.

- Development mode: [index.js](/abs/path/d:/AI/trae/siyuan-plugin-task-horizon/index.js:1) loads scripts from `manifest.main.json` in order.
- Root [task-horizon.css](/abs/path/d:/AI/trae/siyuan-plugin-task-horizon/task-horizon.css:1) is loaded before the main runtime so bootstrap styles stay outside the concatenated JS payload and survive release packaging.
- Release mode: [build.ps1](/abs/path/d:/AI/trae/siyuan-plugin-task-horizon/build.ps1:1) concatenates those scripts into the root `task.js` inside the temporary packaging directory.
- Root `task.js` remains the published/fallback entry and should not be treated as the long-term source of truth.

Current active layout:

- `main/00-bootstrap-and-styles.js`
  Responsibility: namespace bootstrap, explicit global-export registry helpers, top-level shared helpers.
- `main/05-siyuan-host-adapter.js`
  Responsibility: official SiYuan host bridge, plugin/app/eventBus/openTab/openMobileFileById access.
- `main/06-siyuan-compat-adapter.js`
  Responsibility: fragile SiYuan DOM and legacy layout fallback encapsulation with soft-degrade behavior.
- `main/07-siyuan-capabilities.js`
  Responsibility: centralized capability detection so shell features can degrade instead of hard-failing.
- `main/10-stores-rules-and-cache.js`
  Responsibility: storage, meta/settings/whiteboard stores, rule engine, cache helpers.
- `main/20-api-and-runtime-services.js`
  Responsibility: API layer, runtime services, data-side shared logic.
- `main/30-dialogs-and-ui-foundation.js`
  Responsibility: dialogs, pickers, UI helper foundation before the main render pipeline.
- `main/31-view-host-policies.js`
  Responsibility: view and interaction policy facade for checklist, calendar sidebar, host-mode-specific title-click behavior, and sheet-mode rules.
- `main/32-runtime-state-and-events.js`
  Responsibility: thin runtime state/event facade for modal liveness, open-token/view-mode reads, task lookup, and safe event bind/unbind helpers.
- `main/render/40-render-list-context-helpers.js`
  Responsibility: shared list/table render context helpers used by split render files and document-loading runtime.
- `main/40-render-runtime.js`
  Responsibility: main render pipeline orchestration, final modal template, core render runtime.
- `main/render/41-render-scene-context.js`
  Responsibility: render scene context builder, render-mode dispatch, dock/toolbar/mobile-sheet HTML assembly used by `render()`.
- `main/render/42-render-list-and-checklist-body.js`
  Responsibility: list body and checklist body HTML builders for the main render scene.
- `main/render/43-render-timeline-kanban-calendar-body.js`
  Responsibility: timeline, kanban, and calendar body HTML builders for the main render scene.
- `main/render/44-render-whiteboard-body.js`
  Responsibility: whiteboard body HTML builder for the main render scene.
- `main/render/45-render-shell-controls-and-resize.js`
  Responsibility: timeline indicator timer, desktop/mobile menu shell controls, popup animation, topbar select, close flow, resize handlers.
- `main/render/46-render-local-task-time-refresh.js`
  Responsibility: cross-view task time field local refresh and optimistic DOM patch helpers.
- `main/render/47-render-side-panels-and-view-switching.js`
  Responsibility: calendar side dock, AI/sidebar mounting, homepage toggles, and view-mode switching runtime.
- `main/render/48-render-calendar-support-runtime.js`
  Responsibility: calendar task cache, fallback task table, calendar query helpers, floating drag helpers, and task date update bridge.
- `main/render/49-render-whiteboard-interactions.js`
  Responsibility: whiteboard viewport interactions, marquee selection, note editor runtime, whiteboard edge rendering, task-link drag/drop, and whiteboard action handlers.
- `main/render/39-render-doc-group-sync-and-refresh.js`
  Responsibility: doc-group dropdown sync, collapsed-session sync, manual refresh session preservation, and refresh-core orchestration helpers.

Task runtime:

- `main/task-runtime/50-task-model-and-repeat-utils.js`
  Responsibility: task time/priority/repeat normalization, task-detail session and refresh primitives.
- `main/task-runtime/51-whiteboard-and-link-runtime.js`
  Responsibility: whiteboard state snapshots, manual-link data helpers, and whiteboard card state helpers.
- `main/task-runtime/52-task-detail-runtime.js`
  Responsibility: task detail HTML, detail binding, visible detail refresh, kanban detail panel behavior.
- `main/task-runtime/53-list-render-and-document-loader.js`
  Responsibility: list rendering, selected-document loading, settings section anchor helpers.
- `main/task-runtime/54-recurring-task-runtime.js`
  Responsibility: recurring task apply/delete/advance flow, repeat-history maintenance, and recurring-task load reconciliation.

Settings runtime:

- `main/settings/60-settings-screen.js`
  Responsibility: settings modal rendering and top-level settings UI shell.
- `main/settings/61-settings-appearance-and-import.js`
  Responsibility: device recognition helpers, appearance controls, TickTick/theme import flows.
- `main/settings/62-settings-columns-and-rules.js`
  Responsibility: column controls, rules, custom fields, group management helpers before summary/export.
- `main/settings/63-summary-runtime.js`
  Responsibility: summary modal data collection and markdown preview generation.
- `main/settings/64-export-runtime.js`
  Responsibility: export runtime, Excel helpers, export dialog/output generation.
- `main/settings/70-doc-group-and-settings-actions.js`
  Responsibility: doc-group actions and general settings mutation handlers.
- `main/settings/71-ai-settings-and-save.js`
  Responsibility: AI settings mutation handlers and save entry points.

Shell and integrations:

- `main/shell/72-shell-entrances-and-native-doc-hooks.js`
  Responsibility: shell entrances, breadcrumb/topbar hooks, native doc checkbox sync.
- `main/shell/80-shell-lifecycle.js`
  Responsibility: init, openManager, cleanup, shell lifecycle orchestration.
- `main/shell/81-ai-bridge-runtime.js`
  Responsibility: AI bridge helpers and AI-facing task/document operations.
- `main/shell/82-gantt-runtime.js`
  Responsibility: gantt/timeline runtime and final boot-time appendices.

Migration note:

- `legacy-task.js` is kept as a snapshot baseline from phase 1.
- `manifest.main.json` is the only active source order contract for development and release builds.
- Runtime code that touches SiYuan host/runtime boundaries should prefer `__tmHost`, `__tmCompat`, and `__tmCaps` before reaching for raw `window.siyuan` or internal DOM selectors.
- Runtime code that needs host context such as `dock/tab` mode, host mobile UI, navigation `app/topWin/topDoc`, or mobile close-after-open behavior should prefer `__tmRuntimeHost`.
- Host policy branches such as `desktop dock`, `desktop tab`, `scoped mobile host`, and `mobile interaction UI` should be derived from `__tmRuntimeHost` helpers instead of repeating raw boolean combinations.
- View and interaction rules such as checklist title-click behavior, calendar sidebar checklist handling, compact checklist field selection, and checklist sheet-mode selection should prefer `__tmViewPolicy`.
- High-frequency runtime reads such as `modal` liveness, `openToken`, `viewMode`, and `flatTasks/pendingInsertedTasks` lookups should prefer `__tmRuntimeState`.
- Safe DOM/event-bus binding and unbinding should prefer `__tmRuntimeEvents` where the same listener lifecycle is repeated.
