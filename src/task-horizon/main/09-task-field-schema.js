    (function () {
        const definitions = Object.freeze([
            { field: 'content', aliases: ['title', 'text', 'raw_content', 'rawContent'], groups: ['search', 'calendar'] },
            { field: 'markdown' },
            { field: 'done', groups: ['completion', 'scoreSource', 'calendar'] },
            { field: 'customStatus', aliases: ['custom_status', 'custom-status'], groups: ['completion', 'scoreSource', 'calendar'] },
            { field: 'priority', aliases: ['custom_priority', 'custom-priority'], groups: ['scoreSource'] },
            { field: 'startDate', aliases: ['start_date', 'custom_start_date', 'custom-start-date'], groups: ['time', 'scoreSource', 'calendar'] },
            { field: 'completionTime', aliases: ['completion_time', 'custom_completion_time', 'custom-completion-time'], groups: ['time', 'scoreSource', 'calendar'] },
            { field: 'taskDateColor', aliases: ['task_date_color', 'custom_task_date_color', 'custom-task-date-color'], groups: ['calendar'] },
            { field: 'customTime', aliases: ['custom_time', 'custom-time'], groups: ['time', 'scoreSource', 'calendar'] },
            { field: 'taskCompleteAt', aliases: ['task_complete_at', 'task-complete-at', 'custom-task-complete-at'], groups: ['completion', 'scoreSource', 'calendar'] },
            { field: 'duration', aliases: ['custom_duration', 'custom-duration'], groups: ['scoreSource'] },
            { field: 'remark', aliases: ['custom_remark', 'custom-remark'], groups: ['search'] },
            { field: 'milestone', aliases: ['custom_milestone', 'custom-milestone-event'] },
            { field: 'pinned', aliases: ['custom_pinned', 'custom-pinned'] },
            { field: 'allDayBottom', aliases: ['all_day_bottom', 'custom_all_day_bottom', 'custom-all-day-bottom'], groups: ['calendar'] },
            { field: 'tomatoMinutes', aliases: ['tomato_minutes'] },
            { field: 'tomatoHours', aliases: ['tomato_hours'] },
            { field: 'tomatoCount', aliases: ['tomato_count'] },
            { field: 'tomatoEstimateCount', aliases: ['tomato_estimate_count'] },
            { field: 'repeatRule', aliases: ['repeat_rule'], groups: ['calendar'] },
            { field: 'repeatState', aliases: ['repeat_state'], groups: ['calendar'] },
            { field: 'repeatHistory', aliases: ['repeat_history'], groups: ['calendar'] },
            { field: 'customFieldValues', groups: ['scoreSource'] },
            { field: 'parentTaskId', aliases: ['parent_task_id', 'parentTaskID'] },
            { field: 'taskMarker', aliases: ['task_marker'] },
            { field: 'root_id', aliases: ['rootId'], groups: ['document', 'scoreSource'] },
            { field: 'docId', groups: ['document', 'scoreSource'] },
            { field: 'h2', groups: ['document'] },
            { field: 'h2Id', groups: ['document'] },
            { field: 'h2Path', groups: ['document'] },
            { field: 'h2Sort', groups: ['document'] },
            { field: 'h2Created', groups: ['document'] },
            { field: 'h2Rank', groups: ['document'] },
            { field: 'docSeq', groups: ['document'] },
            { field: 'blockPath', groups: ['document'] },
            { field: 'blockSort', groups: ['document'] },
        ]);

        const aliases = new Map();
        const groups = new Map();
        const readAliases = new Map();
        definitions.forEach((definition) => {
            const field = String(definition.field || '').trim();
            if (!field) return;
            aliases.set(field, field);
            const fieldAliases = Array.from(new Set((Array.isArray(definition.aliases) ? definition.aliases : [])
                .map((value) => String(value || '').trim())
                .filter(Boolean)));
            readAliases.set(field, Object.freeze(fieldAliases));
            fieldAliases.forEach((alias) => aliases.set(alias, field));
            (Array.isArray(definition.groups) ? definition.groups : []).forEach((groupName) => {
                const group = String(groupName || '').trim();
                if (!group) return;
                if (!groups.has(group)) groups.set(group, []);
                groups.get(group).push(field);
            });
        });

        const normalizeField = (value) => {
            const raw = String(value || '').trim();
            if (!raw || raw.startsWith('customField:')) return raw;
            return aliases.get(raw) || raw;
        };

        globalThis.__tmTaskFieldSchema = Object.freeze({
            normalizeField,
            getAliases(fieldInput) {
                const field = normalizeField(fieldInput);
                return Array.from(readAliases.get(field) || []);
            },
            getReadKeys(fieldInput) {
                const field = normalizeField(fieldInput);
                return field ? [field, ...Array.from(readAliases.get(field) || [])] : [];
            },
            getGroup(groupName) {
                return Array.from(groups.get(String(groupName || '').trim()) || []);
            },
        });
    })();
