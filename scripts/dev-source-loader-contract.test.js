'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const aiSettings = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/71-ai-settings-and-save.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/task-horizon/manifest.main.json'), 'utf8'));

assert.ok(Array.isArray(manifest.scripts) && manifest.scripts.length > 0, 'development source manifest must list scripts');
for (const script of manifest.scripts) {
    assert.ok(fs.existsSync(path.join(root, 'src/task-horizon', script)), `development source is missing: ${script}`);
}
assert.match(index, /const devLoad = await loadTaskDevManifestScripts\(\);[\s\S]*if \(devLoad\.status === "loaded"\)[\s\S]*if \(hasTaskMainRuntime\(\)\)/, 'development sources must load before the bundled fallback');
assert.match(index, /console\.log\(`\[task-horizon\] dev sources loaded \(\$\{devLoad\.scripts\.length\} files\): task-horizon\.dev-main\.js`\)/, 'successful development source startup must be visible in the console');
assert.match(index, /const bundledLoaded = await loadScriptText\(TASK_SCRIPT_PATH, "task\.js"\)/, 'installed packages must retain the bundled fallback');
assert.match(index, /const ready = await ensureAiExperienceRuntime\(normalized\);[\s\S]*persistAiExperienceMode\(normalized\)/, 'AI mode changes must load the target runtime before committing the new mode');
assert.match(index, /catch \(error\) \{[\s\S]*ensureAiExperienceRuntime\(previousMode\)[\s\S]*persistAiExperienceMode\(previousMode\)[\s\S]*throw error/, 'failed AI mode changes must restore the previous runtime and setting');
assert.match(aiSettings, /const previousMode[\s\S]*__taskHorizonSetAiExperienceMode\(mode,[\s\S]*SettingsStore\.data\.aiExperienceMode = mode/, 'settings must update only after the target AI runtime is ready');
assert.match(aiSettings, /catch \(e\) \{[\s\S]*SettingsStore\.data\.aiExperienceMode = previousMode[\s\S]*return false/, 'settings must report a failed mode switch and retain the previous mode');

console.log('development source loader contract tests passed');
