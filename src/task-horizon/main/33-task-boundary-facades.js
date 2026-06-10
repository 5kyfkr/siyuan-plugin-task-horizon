    (function () {
        const ns = globalThis.__tmTaskBoundary || {};

        const callLocal = (name, args) => {
            try {
                if (name === 'loadSnapshotForScope' && typeof __tmLoadTaskSnapshotForScope === 'function') {
                    return __tmLoadTaskSnapshotForScope(...args);
                }
                if (name === 'loadLatestSnapshotForGroup' && typeof __tmLoadLatestTaskSnapshotForGroup === 'function') {
                    return __tmLoadLatestTaskSnapshotForGroup(...args);
                }
                if (name === 'refreshSnapshotCacheIfChanged' && typeof __tmRefreshTaskSnapshotStoreCacheIfChanged === 'function') {
                    return __tmRefreshTaskSnapshotStoreCacheIfChanged(...args);
                }
                if (name === 'warmSnapshotStore' && typeof __tmScheduleWarmTaskSnapshotStore === 'function') {
                    return __tmScheduleWarmTaskSnapshotStore(...args);
                }
                if (name === 'restoreSnapshotIntoState' && typeof __tmRestoreTaskSnapshotIntoState === 'function') {
                    return __tmRestoreTaskSnapshotIntoState(...args);
                }
                if (name === 'restoreSnapshotViewState' && typeof __tmRestoreTaskSnapshotViewState === 'function') {
                    return __tmRestoreTaskSnapshotViewState(...args);
                }
                if (name === 'schedulePersistSnapshot' && typeof __tmSchedulePersistTaskSnapshot === 'function') {
                    return __tmSchedulePersistTaskSnapshot(...args);
                }
                if (name === 'scheduleSnapshotAfterLocalPatch' && typeof __tmScheduleTaskSnapshotAfterLocalPatch === 'function') {
                    return __tmScheduleTaskSnapshotAfterLocalPatch(...args);
                }
                if (name === 'scheduleSnapshotAfterLocalStructurePatch' && typeof __tmScheduleTaskSnapshotAfterLocalStructurePatch === 'function') {
                    return __tmScheduleTaskSnapshotAfterLocalStructurePatch(...args);
                }
            } catch (e) {}
            return undefined;
        };

        const snapshot = {
            load: (...args) => callLocal('loadSnapshotForScope', args),
            loadLatestForGroup: (...args) => callLocal('loadLatestSnapshotForGroup', args),
            refreshCache: (...args) => callLocal('refreshSnapshotCacheIfChanged', args),
            warm: (...args) => callLocal('warmSnapshotStore', args),
            restore: (...args) => callLocal('restoreSnapshotIntoState', args),
            restoreViewState: (...args) => callLocal('restoreSnapshotViewState', args),
            schedulePersist: (...args) => callLocal('schedulePersistSnapshot', args),
            scheduleAfterLocalPatch: (...args) => callLocal('scheduleSnapshotAfterLocalPatch', args),
            scheduleAfterLocalStructurePatch: (...args) => callLocal('scheduleSnapshotAfterLocalStructurePatch', args),
        };

        globalThis.__tmTaskSnapshotService = snapshot;
        if (globalThis.__tmTaskHorizonOutbox && typeof globalThis.__tmTaskHorizonOutbox === 'object') {
            globalThis.__tmTaskOutbox = globalThis.__tmTaskHorizonOutbox;
        }
        globalThis.__tmTaskBoundary = {
            ...ns,
            snapshot,
            get taskStore() { return globalThis.__tmTaskStore || null; },
            get mutationBus() { return globalThis.__tmTaskMutationBus || null; },
            get outbox() { return globalThis.__tmTaskOutbox || globalThis.__tmTaskHorizonOutbox || null; },
            getTaskStore: () => globalThis.__tmTaskStore || null,
            getMutationBus: () => globalThis.__tmTaskMutationBus || null,
            getOutbox: () => globalThis.__tmTaskOutbox || globalThis.__tmTaskHorizonOutbox || null,
            getSnapshotService: () => globalThis.__tmTaskSnapshotService || snapshot,
        };
    })();
