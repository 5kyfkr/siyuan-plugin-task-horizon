'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');

assert.match(source, /const TASK_TEMPLATES_FILE_PATH = `\$\{PLUGIN_STORAGE_DIR\}\/task-templates\.json`;/,
    'task templates have a dedicated synchronized storage file');
assert.match(source,
    /async saveTaskTemplates\(input\)[\s\S]*__tmWriteJsonFile\(TASK_TEMPLATES_FILE_PATH,[\s\S]*items: library\.items/,
    'template edits replace the complete dedicated file atomically');
assert.match(source, /delete payload\.taskTemplateLibrary;/,
    'regular settings saves cannot overwrite the template group');
assert.match(source,
    /const taskTemplateFile = await __tmReadJsonFile\(TASK_TEMPLATES_FILE_PATH\);[\s\S]*applyDedicatedTaskTemplateLibrary/,
    'startup and sync reload read the dedicated template file');
assert.match(source,
    /if \(cloudData\.taskTemplateLibrary\) this\.data\.taskTemplateLibrary = __tmNormalizeTaskTemplateLibrary\(cloudData\.taskTemplateLibrary\);/,
    'legacy settings remain a migration fallback');
assert.match(source, /Storage\.set\('tm_task_template_library', this\.data\.taskTemplateLibrary\);/,
    'the complete template library is persisted locally');
assert.doesNotMatch(source, /task-template-sync\.log|__tmLogTaskTemplateSync/,
    'temporary diagnostic logging is removed');

console.log('task templates use a dedicated atomic sync file');
