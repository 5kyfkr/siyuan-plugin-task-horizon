    const __TM_FSRS_RATING_LABELS = Object.freeze({
        1: '重来',
        2: '困难',
        3: '良好',
        4: '简单',
    });
    const __TM_FSRS_REVIEW_OPTIONS = Object.freeze([
        { rating: 1, label: '重来', tone: 'again' },
        { rating: 2, label: '困难', tone: 'hard' },
        { rating: 3, label: '良好', tone: 'good' },
        { rating: 4, label: '简单', tone: 'easy' },
    ]);

    function __tmNormalizeFsrsRating(value) {
        if (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 4) return Number(value);
        const raw = String(value || '').trim().toLowerCase();
        if (raw === 'again' || raw === 'forgot' || raw === '忘记' || raw === '没记住' || raw === '重来') return 1;
        if (raw === 'hard' || raw === '困难') return 2;
        if (raw === 'good' || raw === 'remember' || raw === '记住' || raw === '良好') return 3;
        if (raw === 'easy' || raw === '轻松' || raw === '简单') return 4;
        return 0;
    }

    function __tmGetFsrsSettings() {
        const data = (typeof SettingsStore !== 'undefined' && SettingsStore?.data) ? SettingsStore.data : {};
        const desiredRetention = Number(data.fsrsDesiredRetention);
        const maximumIntervalDays = Number.parseInt(data.fsrsMaximumIntervalDays, 10);
        return {
            desiredRetention: Number.isFinite(desiredRetention)
                ? Math.max(0.8, Math.min(0.97, desiredRetention))
                : 0.9,
            maximumIntervalDays: Number.isFinite(maximumIntervalDays)
                ? Math.max(30, Math.min(3650, maximumIntervalDays))
                : 3650,
            enableFuzz: data.fsrsEnableFuzz === true,
        };
    }

    function __tmRequireFsrsRuntime() {
        const runtime = globalThis.FSRS;
        if (!runtime || typeof runtime.fsrs !== 'function' || typeof runtime.createEmptyCard !== 'function') {
            throw new Error('FSRS 调度器未加载');
        }
        return runtime;
    }

    function __tmFsrsDate(value, fallback = null) {
        const date = value instanceof Date ? new Date(value.getTime()) : new Date(value || '');
        if (!Number.isNaN(date.getTime())) return date;
        if (fallback instanceof Date && !Number.isNaN(fallback.getTime())) return new Date(fallback.getTime());
        return new Date();
    }

    function __tmFsrsDateForDateKey(value, fallback = null) {
        const key = __tmNormalizeDateOnly(value);
        const date = key ? __tmBuildLocalNoonDateFromKey(key) : null;
        return date || __tmFsrsDate(fallback);
    }

    function __tmSerializeFsrsCard(cardInput) {
        const card = (cardInput && typeof cardInput === 'object') ? cardInput : null;
        if (!card) return null;
        const due = __tmFsrsDate(card.due, null);
        if (Number.isNaN(due.getTime())) return null;
        const lastReview = card.last_review ? __tmFsrsDate(card.last_review, null) : null;
        return {
            due: due.toISOString(),
            stability: Math.max(0, Number(card.stability) || 0),
            difficulty: Math.max(0, Number(card.difficulty) || 0),
            elapsed_days: Math.max(0, Number.parseInt(card.elapsed_days, 10) || 0),
            scheduled_days: Math.max(0, Number.parseInt(card.scheduled_days, 10) || 0),
            reps: Math.max(0, Number.parseInt(card.reps, 10) || 0),
            lapses: Math.max(0, Number.parseInt(card.lapses, 10) || 0),
            state: Math.max(0, Math.min(3, Number.parseInt(card.state, 10) || 0)),
            last_review: lastReview && !Number.isNaN(lastReview.getTime()) ? lastReview.toISOString() : '',
        };
    }

    function __tmCreateFsrsCard(dueDateLike = new Date()) {
        const runtime = __tmRequireFsrsRuntime();
        const card = runtime.createEmptyCard(__tmFsrsDateForDateKey(dueDateLike, new Date()));
        return __tmSerializeFsrsCard(card);
    }

    function __tmHydrateFsrsCard(cardInput, dueDateLike, reviewedAt) {
        const runtime = __tmRequireFsrsRuntime();
        const stored = __tmNormalizeFsrsCardState(cardInput);
        if (!stored) return runtime.createEmptyCard(__tmFsrsDateForDateKey(dueDateLike, reviewedAt));
        return runtime.TypeConvert.card({
            ...stored,
            due: __tmFsrsDateForDateKey(dueDateLike || stored.due, reviewedAt),
            last_review: stored.last_review || null,
        });
    }

    function __tmBuildFsrsInitialState(taskLike, stateInput = null) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const state = __tmNormalizeTaskRepeatState(stateInput || task?.repeatState);
        const dueKey = __tmNormalizeDateOnly(task?.completionTime || task?.startDate || new Date());
        return __tmNormalizeTaskRepeatState({
            ...state,
            version: 2,
            lastInstanceStart: __tmNormalizeDateOnly(task?.startDate || ''),
            lastInstanceDue: dueKey,
            fsrsCard: __tmCreateFsrsCard(dueKey),
        });
    }

    function __tmBuildFsrsReviewPatch(taskLike, ratingInput, options = {}) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const rating = __tmNormalizeFsrsRating(ratingInput);
        if (!rating) throw new Error('FSRS 评分无效');
        const runtime = __tmRequireFsrsRuntime();
        const opts = (options && typeof options === 'object') ? options : {};
        const reviewedAt = __tmFsrsDate(opts.reviewedAt || opts.completedAt || new Date());
        const currentDue = __tmNormalizeDateOnly(task?.completionTime || task?.startDate || reviewedAt);
        const currentState = __tmNormalizeTaskRepeatState(task?.repeatState);
        const card = __tmHydrateFsrsCard(currentState.fsrsCard, currentDue, reviewedAt);
        const beforeCard = __tmSerializeFsrsCard(card);
        const settings = __tmGetFsrsSettings();
        const scheduler = runtime.fsrs({
            request_retention: settings.desiredRetention,
            maximum_interval: settings.maximumIntervalDays,
            enable_fuzz: settings.enableFuzz,
            enable_short_term: false,
        });
        const review = scheduler.next(card, reviewedAt, rating);
        const reviewDateKey = __tmNormalizeDateOnly(reviewedAt);
        const minimumNextKey = __tmShiftTaskRepeatDateKey(reviewDateKey, 1);
        const maximumNextKey = __tmShiftTaskRepeatDateKey(reviewDateKey, settings.maximumIntervalDays);
        let nextDue = __tmNormalizeDateOnly(review?.card?.due);
        if (!nextDue || (minimumNextKey && nextDue < minimumNextKey)) nextDue = minimumNextKey;
        if (maximumNextKey && nextDue > maximumNextKey) nextDue = maximumNextKey;
        if (!nextDue) throw new Error('FSRS 未生成有效的下次日期');
        review.card.due = __tmFsrsDateForDateKey(nextDue, reviewedAt);
        const nextDueDate = __tmBuildLocalNoonDateFromKey(nextDue);
        const reviewDate = __tmBuildLocalNoonDateFromKey(reviewDateKey);
        if (nextDueDate && reviewDate) {
            review.card.scheduled_days = Math.max(1, Math.round((nextDueDate.getTime() - reviewDate.getTime()) / 86400000));
        }
        const afterCard = __tmSerializeFsrsCard(review.card);
        const successful = rating !== 1;
        const nextStart = __tmNormalizeDateOnly(task?.startDate || '') ? nextDue : '';
        const completedAt = String(opts.completedAt || reviewedAt.toISOString()).trim() || reviewedAt.toISOString();
        const repeatState = __tmNormalizeTaskRepeatState({
            ...currentState,
            version: 2,
            occurrenceCount: currentState.occurrenceCount + (successful ? 1 : 0),
            lastCompletedAt: successful ? completedAt : currentState.lastCompletedAt,
            lastAdvancedAt: reviewedAt.toISOString(),
            lastInstanceStart: nextStart,
            lastInstanceDue: nextDue,
            fsrsCard: afterCard,
        });
        return {
            startDate: nextStart,
            completionTime: nextDue,
            repeatState,
            review: {
                rating,
                label: __TM_FSRS_RATING_LABELS[rating],
                successful,
                beforeCard,
                afterCard,
            },
        };
    }

    function __tmBuildFsrsReviewPreviews(taskLike, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const reviewedAt = __tmFsrsDate(opts.reviewedAt || new Date());
        return __TM_FSRS_REVIEW_OPTIONS.map((option) => {
            let completionTime = '';
            try {
                completionTime = __tmBuildFsrsReviewPatch(taskLike, option.rating, { reviewedAt }).completionTime;
            } catch (e) {}
            return { ...option, completionTime };
        });
    }

    function __tmFormatFsrsPreviewDate(value, referenceDate = new Date()) {
        const key = __tmNormalizeDateOnly(value);
        if (!key) return '待计算';
        const todayKey = __tmNormalizeDateOnly(referenceDate);
        if (key === todayKey) return '今天';
        if (key === __tmShiftTaskRepeatDateKey(todayKey, 1)) return '明天';
        const parts = key.split('-').map(Number);
        if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return key;
        return String(parts[0]) === String(todayKey || '').slice(0, 4)
            ? `${parts[1]}/${parts[2]}`
            : `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
