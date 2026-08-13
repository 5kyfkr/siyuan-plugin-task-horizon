'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createHarness() {
    const storage = new Map();
    const rpc = {};
    let corruptNextPut = '';
    const siyuan = {
        plugin: { lifecycle: {} },
        rpc: {
            async bind(name, handler) { rpc[name] = handler; },
            async unbind(name) { delete rpc[name]; },
        },
        agent: {
            async registerCapability() {},
            async unregisterCapability() {},
        },
        storage: {
            async get(name) {
                if (!storage.has(name)) throw new Error(`open ${name}: The system cannot find the file specified.`);
                return { async text() { return storage.get(name); } };
            },
            async put(name, content) {
                storage.set(name, corruptNextPut === name ? '{broken' : String(content));
                if (corruptNextPut === name) corruptNextPut = '';
            },
        },
        client: {
            async fetch() {
                throw new Error('unexpected kernel API call');
            },
        },
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'kernel.js'), 'utf8');
    vm.runInNewContext(source, { siyuan, console, setTimeout, clearTimeout, Date, Math, JSON, Map, Set, Promise });
    return {
        storage,
        async start() { await siyuan.plugin.lifecycle.onload(); },
        async call(name, ...args) {
            assert.equal(typeof rpc[name], 'function', `${name} must be bound`);
            return rpc[name](...args);
        },
        corruptNextWrite(name) { corruptNextPut = name; },
    };
}

function scheduledEvent() {
    return {
        id: 'evt-persistence',
        name: '今晚任务总结',
        enabled: true,
        prompt: '总结今日任务',
        type: 'agent_prompt',
        condition: 'always',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        schedule: { kind: 'daily', date: '', weekday: 0, time: '22:00' },
        output: { mode: 'notification', documentId: '' },
    };
}

function policySnapshot(revision = 13) {
    return {
        schemaVersion: 2,
        revision,
        global: {
            weeklyAvailability: { mon: '09:00-12:00' },
            fixedOccupancy: [],
            deadlinePriority: { enabled: true, priority: 'high' },
            defaultCalendarID: '',
            customInstructions: '',
        },
        documentOverrides: {},
        groupOverrides: { groupA: { customInstructions: '保留分组规则' } },
        durationDefaults: {
            enabled: true,
            syncToManualDrag: true,
            fallbackMinutes: 25,
            rules: [{ id: 'meeting', name: '会议', keywords: ['会议'], minutes: 30 }],
        },
        previous: null,
    };
}

async function run() {
    const calendarSource = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
    const calendarLoadStart = calendarSource.indexOf('async function loadScheduleAll()');
    const calendarLoadEnd = calendarSource.indexOf('\n    async function refreshScheduleCacheFromSharedFile()', calendarLoadStart);
    const calendarLoad = calendarSource.slice(calendarLoadStart, calendarLoadEnd);
    assert.match(calendarLoad, /sourceReadError = true;[\s\S]*localStorage\.getItem\(STORAGE\.SCHEDULE_LS_KEY\)/,
        'calendar loading must retain the local shadow after an authoritative read failure');
    assert.doesNotMatch(calendarLoad, /const parsed = JSON\.parse\(raw\);\s*sourceReadError = false;\s*sourceLoaded = true;/,
        'a local calendar shadow must not be mislabeled as an authoritative shared-file read');

    const harness = createHarness();
    await harness.start();

    const missingEvents = await harness.call('taskHorizonLoadAgentSchedules');
    assert.equal(missingEvents.ok, false);
    assert.equal(missingEvents.error.code, 'STORAGE_MISSING');

    const savedEvents = await harness.call('taskHorizonReplaceAgentSchedules', { events: [scheduledEvent()] });
    assert.equal(savedEvents.ok, true);
    assert.equal(savedEvents.data.length, 1);
    assert.equal((await harness.call('taskHorizonLoadAgentSchedules')).data[0].name, '今晚任务总结');

    const clearedEvents = await harness.call('taskHorizonReplaceAgentSchedules', { events: [] });
    assert.equal(clearedEvents.ok, true);
    const validEmptyEvents = await harness.call('taskHorizonLoadAgentSchedules');
    assert.equal(validEmptyEvents.ok, true, 'an existing empty list must remain authoritative');
    assert.deepEqual(JSON.parse(JSON.stringify(validEmptyEvents.data)), []);

    harness.storage.set('agent-scheduled-events.json', '{broken');
    const corruptEvents = await harness.call('taskHorizonLoadAgentSchedules');
    assert.equal(corruptEvents.ok, false);
    assert.equal(corruptEvents.error.code, 'STORAGE_CORRUPT');

    const missingPolicy = await harness.call('taskHorizonGetPolicy');
    assert.equal(missingPolicy.ok, true);
    assert.equal(missingPolicy.data.__storageState, 'missing');

    const restoredPolicy = await harness.call('taskHorizonRestorePolicy', policySnapshot());
    assert.equal(restoredPolicy.ok, true);
    assert.equal(restoredPolicy.data.revision, 13);
    assert.equal(restoredPolicy.data.durationDefaults.syncToManualDrag, true);
    const validPolicy = await harness.call('taskHorizonGetPolicy');
    assert.equal(validPolicy.data.__storageState, 'valid');
    assert.equal(validPolicy.data.groupOverrides.groupA.customInstructions, '保留分组规则');

    const ignoredOlderRestore = await harness.call('taskHorizonRestorePolicy', policySnapshot(2));
    assert.equal(ignoredOlderRestore.ok, true);
    assert.equal(ignoredOlderRestore.data.revision, 13, 'recovery must not overwrite an existing valid policy');

    const missingSchedules = await harness.call('taskHorizonLoadSchedules');
    assert.equal(missingSchedules.ok, false);
    assert.equal(missingSchedules.error.code, 'STORAGE_MISSING');
    const initializedSchedules = await harness.call('taskHorizonSaveSchedules', [], { allowSchedulePrune: true });
    assert.equal(initializedSchedules.ok, true);
    const validEmptySchedules = await harness.call('taskHorizonLoadSchedules');
    assert.equal(validEmptySchedules.ok, true);
    assert.deepEqual(JSON.parse(JSON.stringify(validEmptySchedules.data)), []);

    harness.storage.set('agent-scheduled-events.json', '[]');
    harness.corruptNextWrite('agent-scheduled-events.json');
    const failedVerification = await harness.call('taskHorizonReplaceAgentSchedules', { events: [scheduledEvent()] });
    assert.equal(failedVerification.ok, false);
    assert.equal(failedVerification.error.code, 'STORAGE_ERROR');
    assert.match(failedVerification.error.message, /回读不一致/);

    console.log('kernel settings persistence tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
