'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../src/task-horizon/main');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const state = {dateFilter:null,filteredTasks:[],viewMode:'checklist'};
let refreshes = 0;
const context = vm.createContext({
    state, console, Date, Map, Set,
    window:{}, SettingsStore:{data:{}},
    __tmIsCheckinTask:task=>task.checkin===true,
    __tmGetTaskCheckinCurrentDate:(task,from)=>task.planned.find(day=>day>=from)||'',
    __tmGetTaskCheckinHistory:task=>(task.checked||[]).map(scheduledDate=>({scheduledDate})),
    __tmGetTodayDateKey:()=> '2026-10-26',
    __tmInvalidateFilteredTaskDerivedStateCache(){},
    __tmScheduleRender:()=>refreshes++,
});
const model=read('task-runtime/50-task-model-and-repeat-utils.js');
const from=model.indexOf('    function __tmNormalizeDateOnly(');
vm.runInContext(model.slice(from,model.indexOf('\n    }',from)+6),context);
vm.runInContext(read('38-date-filter.js'),context);
const filter=context.__tmDateFilter;
const due={id:'due',completionTime:'2026-10-26 23:59:59'};
const span={id:'span',startDate:'2026-10-20',completionTime:'2026-11-03'};
const other={id:'other',startDate:'2026-11-10'};
const undated={id:'none'};
filter.setCandidates([due,span,other,undated]);
filter.setRange('2026-10-26');
assert.equal(filter.active(),true);
assert.equal(filter.count(),2,'Single-day filter includes due and spanning tasks');
assert.equal(filter.matches(undated),false,'Undated tasks do not match a date filter');
assert.equal(filter.matches({start_date:'2026-10-26'}),true,'Single-ended dates and aliases work');
assert.equal(filter.matches({startDate:'2026-11-03',completionTime:'2026-10-20'}),true,'Legacy reversed task endpoints are normalized without writes');
filter.setRange('2026-10-30','2026-10-26');
assert.equal(filter.signature(),'2026-10-26:2026-10-30','Reverse selection normalizes the range');
assert.equal(filter.matches({completionTime:'2026-10-30'}),true,'Range includes its final day');
assert.equal(filter.matches({completionTime:'2026-10-31'}),false);
assert.equal(filter.matches({checkin:true,planned:['2026-10-27','2026-10-29']}),true,'Planned check-ins match without using legacy task dates');
assert.equal(filter.matches({checkin:true,planned:['2026-11-02'],completionTime:'2026-10-26'}),false);
assert.equal(filter.matches({checkin:true,planned:[],checked:['2026-10-28']}),true,'Recorded extra check-ins remain discoverable');
state.filteredTasks=[due,span];
const events=[{taskId:'due',start:'2026-10-26',endExclusive:'2026-10-27'},
    {taskId:'other',start:'2026-10-26',endExclusive:'2026-10-27'},
    {taskId:'span',start:'2026-11-01',endExclusive:'2026-11-02'}];
assert.equal(filter.filterCalendarEvents(events,{calendar:'main'}).length,1,'Main calendar honors both task scope and dates');
assert.equal(filter.filterCalendarEvents(events,{calendar:'side'}),events,'Independent calendar dock is unchanged');
assert.equal(filter.filterCalendarEvents(events,{source:'calendar-ics-task-dates'}),events,'ICS publication does not consume a temporary view filter');
state.homepageOpen=true;
assert.equal(filter.active(),false,'Home statistics do not inherit the task-list filter');
assert.equal(filter.signature(),'');
state.homepageOpen=false;
assert.equal(filter.active(),true,'Returning to a task view restores the session condition');
filter.setRange(null);
assert.equal(state.dateFilter,null);
assert.equal(filter.matches(undated),true,'Clearing restores undated tasks');
assert.equal(refreshes,3,'One task refresh per committed selection');
filter.setRange('2026-10-26');
const refreshesBeforeContextClear=refreshes;
assert.equal(filter.clearForContextChange(),true,'A context change clears an active date range');
assert.equal(state.dateFilter,null);
assert.equal(filter.active(),false);
assert.equal(filter.clearForContextChange(),false,'Clearing an empty filter is idempotent');
assert.equal(refreshes,refreshesBeforeContextClear,'Context owners schedule their own render');
vm.runInContext(read('09-task-field-schema.js'),context);
vm.runInContext(read('34-task-projection-engine.js'),context);
for(const field of ['startDate','completionTime','repeatRule','repeatState','repeatHistory']) {
    assert.equal(context.__tmTaskProjectionEngine.analyzePatch({[field]:'changed'},{dateFilterActive:true}).filter,true,
        field+' edits must recompute active date membership');
}
console.log('Shortcut date filter: interval matching, check-ins, temporary scope, calendar isolation and patch dependencies passed');
