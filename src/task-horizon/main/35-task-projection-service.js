    // ProjectionService is the single entry point for recalculating derived task views.
    // Existing view schedulers own coalescing and input deferral; this service owns
    // neither task data nor ordering rules.
    const __tmProjectionService = (() => {
        let generation = 0;
        let appliedGeneration = 0;

        const recomputeNow = (options = {}) => {
            const currentGeneration = ++generation;
            const reason = String(options?.reason || '').trim() || 'projection';
            state.__tmLastTaskProjectionReason = reason;
            let applied = false;
            let error = null;
            try {
                applyFilters();
                applied = true;
                appliedGeneration = currentGeneration;
            } catch (caught) {
                error = caught;
                try {
                    globalThis.console?.warn?.('[task-horizon] task-projection-failed', {
                        reason,
                        generation: currentGeneration,
                        error: caught,
                    });
                } catch (e) {}
            }
            return { applied, generation: currentGeneration, appliedGeneration, error };
        };

        return {
            recomputeNow,
            getGeneration: () => generation,
            getAppliedGeneration: () => appliedGeneration,
        };
    })();

    function __tmRecomputeTaskProjection(options = {}) {
        return __tmProjectionService.recomputeNow(options);
    }

    globalThis.__tmProjectionService = __tmProjectionService;
    globalThis.__tmRecomputeTaskProjection = __tmRecomputeTaskProjection;
