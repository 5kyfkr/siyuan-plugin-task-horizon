# Task move performance: diagnostics removed

After user confirmation, the temporary move-performance logger, its call sites,
timing wrappers, frame-delay probes and trace-only metadata were removed from
the runtime. The local-refresh, placement and websocket-coalescing fixes remain.
Normal error reporting remains available. No logging switch is required.

The versioned timings below are historical investigation records, not enabled
diagnostics in the current package.

## Changes

- r5 preserves kanban columns and their scroll hosts. A scoped move/outdent
  renders changed tasks and old/new ancestor branches; unaffected cards are
  represented by temporary references while building HTML and reused in the
  live DOM. References are disabled for subsequent progressive loads. Counts,
  order and grouping still come from the production renderer. Unknown scope
  and changed column layouts retain the full-render fallback.
  Scroll-deferred scoped changes merge task/parent IDs instead of replacing
  the preceding scope; lower-priority pagination cannot discard that refresh.
- The initial scoped column implementation (r4) still rebuilt every card in
  an affected column. The supplied 78-record r4 excerpt confirms one outdent
  generated 328,322 HTML characters in 179.3 ms, parsed in 12.0 ms and updated
  the column DOM in 82.4 ms. The commit projection took 322.2 ms. This is not a
  whole-board refresh, but it is still expensive and can cause visible jitter.
  The same excerpt has 387.2 ms of sequential authoritative placement reads,
  162.2 ms of optimistic publication and 937.6 ms of move execution. Those are
  separate costs; r5 branch rendering does not remove backend latency.
- Checklist automatic refreshes now retain the changed-task scope for their
  existing group/segment reconciliation. Table and timeline scoped fallbacks
  preserve equal rows and move/rebuild changed rows; timeline keeps the loaded
  window and reuses its axis/background when the date range and scale match.
  These views still compute markup for their bounded visible window.
- Whiteboard scoped structure refreshes reuse the canvas, unchanged task
  branches, notes, frames, drawings and task-pool document sections. Changed
  document layouts or unknown children retain the regular layout fallback.
  Whiteboard still computes a candidate body before reconciling its nodes.
- Calendar was audited: task-date source refresh already compares events and
  patches changed events without refetching unrelated schedule sources. Its
  local task completion/date paths and explicit manual refresh are retained.
- Deferred websocket reads do not escalate stale task-store results into a
  full selected-document reload. A notification arriving during a refresh is
  retained for its next pass. Foreground/view-switch paths reuse that work.
- Isolated Chromium regressions cover node identity, outdent placement,
  same-column and cross-column moves, scroll preservation, confirmation echoes,
  lazy continuation, table/Gantt row ordering, scale fallback and whiteboard
  branches/layers. Mobile viewport emulation is not physical-device timing.
  The r4 sample reports `mobile:false`; it does not measure mobile performance.

- Structural projection sends `detailOnly: true` with its detail notification.
  Related visible details still refresh. A missing or unrelated detail does not
  fall back to a whole main-view render. The structural main-view update and
  its separately scheduled fallback remain in place.
- Nested render measurements inherit the current projection operation IDs.
  Unscoped measurements use only the newest matching operation per task.
  This fixes r1 logging a later outdent render under earlier moves of the same
  task as well as the outdent preparation trace.
- Other callers of detail refresh retain their existing fallback behavior.

## User-provided before/after samples

Both samples report desktop kanban (`mobile: false`), 61 loaded documents,
172 filtered tasks and a render limit of 23. Each includes one move followed
by one outdent of the same task. Times below are measured durations in ms;
they are observations from these samples, not a cross-device benchmark.

| Measured work | r1 | r2 |
| --- | ---: | ---: |
| First move: optimistic projection batch | 434.5 | 41.4 |
| First move: commit projection batch | 358.1 | 39.9 |
| Outdent: optimistic projection batch | 386.7 | 39.5 |
| Outdent: commit projection batch | 356.1 | 48.2 |
| Detail refresh inside those batches | 310.4–340.1 | 0.2–0.7 |
| Whole-kanban HTML renders inside those batches | 4 | 0 |
| First move: optimistic mutation publication | 112.4 | 115.7 |
| Outdent: optimistic mutation publication | 119.0 | 111.3 |

The r2 sample has 62 records. Both moves return successful acknowledgement and
settle with `ok: true`; there are no recorded failures. `detail.targeted` with
`result: false` means the targeted detail refresh did not update a matching
visible panel; the main-view projection has its own path. This is not a failed
move. r1 nested events were duplicated across trace IDs; count work by the
actual projection invocation, not every logged HTML event.

Remaining observations:

- Optimistic mutation publication still takes 111–116 ms synchronously.
- Outdent reads the current task placement and then its parent's placement:
  173.1 ms and 177.2 ms in r2, about 351 ms elapsed before the move starts.
- Mutation execution is about 772–809 ms elapsed, includes asynchronous waits,
  and overlaps front-end work. It is not a measurement of pure server CPU or
  main-thread blocking. Do not add it to nested projection durations.
- The two-rAF delay is 18.7–43.3 ms in r2. It measures callback latency, not
  isolated paint time.

These logs validate removal of the redundant main-view rendering on this
desktop path. They do not establish mobile frame times, verify all visual
placement details, or resolve the separately reported intermittent hard freeze.

## Verification

Behavior tests cover list/checklist/kanban structural projection, closed and
unrelated details, matching parent details, failed local projection fallback,
and legacy detail refresh behavior. Logger tests cover operation correlation,
unchanged return/error behavior, limits, expiry, disabling, payload exclusion,
and coalesced finite rAF probes. Relevant existing outdent, parent-progress,
detail isolation and projection tests are also exercised.

## r3: placement after outdent and subsequent refresh

The later r2 user sample contains 43 records. The outdent settles successfully
at 888.2 ms, then a separate `view.refresh` in `current` mode starts at 986.6 ms.
It generates 520,664 HTML characters in 182.8 ms and ends at 1271 ms. There is
no recorded rollback. r2 did not log the refresh reason or placement fields,
so this sample alone cannot identify which refresh producer caused the bounce.

Two stale-placement paths are reproducible in production-function tests:

- Incremental refresh built its confirmation records from raw SQL before
  pending structural protection, then copied only `children` from the resolved
  tree. A later `getProjected()` could return the old SQL parent. Confirmation
  now takes placement, depth and order from that same resolved tree while
  retaining server values for ordinary fields.
- A sparse successful move receipt was merged onto the pre-move confirmed
  record. Joined-parent aliases and descendants absent from the receipt could
  revert. It now merges onto the acknowledged local record for moves.

Checklist items and kanban cards carry document/parent placement stamps.
Structural fast paths reject changed placement or an unstamped older DOM.
Kanban parent reconciliation updates both the old and new parent; root/subtask
transitions and document changes use the existing main-view refresh. Unsupported
parent-only reconciliation is rejected before generating staging HTML.
Same-parent reordering retains its fast path.

The shared “加载中” indicator is raised by document loading, refresh-core or
view switching. It is not a separate move write. r3 adds console-only
`loading.scheduled`, `loading.shown`, `loading.end`, refresh `reason` and
`placement.acknowledged` events. Loading events are associated with the latest
move only within 15 seconds and explicitly labeled `association: recent-move`;
this is temporal association, not proof of causality. No extra requests,
storage writes or periodic timers were introduced by that instrumentation.
Those temporary events and their enable/disable switch have now been removed.

The isolated Chromium regression exercises actual DOM projection, parent
reconciliation and body replacement with minimal renderer fixtures and the
production task store. It checks desktop/mobile-size outdent, a later refresh,
cross-parent and cross-document movement, indent, same-parent reorder, checklist
placement guards, and stale SQL confirmation followed by rendering. Mobile
viewport emulation verifies DOM behavior, not real-device performance. These
checks do not establish the cause of every previously reported hard freeze.

## Latest r3 user sample: websocket-triggered full refresh remains

Attachment `0850bf41-4b65-43b5-8d01-478be24f4f18/pasted-text.txt`
contains 129 move-performance records. All report `move-perf-r3` and desktop
kanban (`mobile: false`), 61 loaded documents and 172 filtered tasks. The three
move operations all acknowledge and settle successfully. The middle operation
is an outdent whose acknowledged `parentTaskId` is explicitly empty.

| Measurement (ms) | First move (m1) | Outdent (m3) | Third move (m4) |
| --- | ---: | ---: | ---: |
| Move start to successful settlement | 965.6 | 839.1 | 906.0 |
| Optimistic publication | 169.9 | 90.6 | 91.2 |
| Commit-triggered current-view refresh | 353.5 | 299.4 | 293.8 |
| Whole-board HTML generation inside that refresh | 239.9 | 187.3 | 190.1 |
| Auto-refresh loading scheduled to end | 1884.3 | 1570.7 | 1808.7 |
| Loading indicator actually visible | 1424.9 | 1120.3 | 1324.8 |

Every current-view refresh identifies `queue-moveTask-commit` as its reason.
Every subsequent loading interval identifies `refresh-core:auto:ws-main-batch`.
The code path invalidates SQL caches and calls `loadSelectedDocuments` with
`forceFreshTasks: true`, then recomputes and refreshes the current view. The
sample therefore identifies what the loading indicator is doing. It does not
record whether the incremental refresh was skipped, declined or threw before
this full fallback, nor does it establish the exact number of network requests.

There is no recorded move rollback, timeout, failed acknowledgement, or
unclosed loading interval in this excerpt. It does not log final DOM placement
after the automatic refresh, so a successful outdent receipt is not by itself
proof that the visual bounce is gone. The tracing version also does not identify
the exact source revision: do not infer inclusion of every later placement fix.

The unrelated startup warning comes from `siyuan-plugin-math-enhance` and says
its relative asset location cannot be determined. No evidence in this excerpt
links that warning to the task move or the websocket refresh timings.
