const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/shell/80-shell-lifecycle.js'),
    'utf8'
);

assert.match(source,
    /attributeFilter:\s*\['data-theme-mode', 'data-light-theme', 'data-dark-theme', 'data-mode', 'class'\]/,
    'theme refresh must observe theme attributes and palette classes');
assert.doesNotMatch(source,
    /__tmThemeModeObserver\.observe\(document\.body/,
    'body class/style mutations must not trigger global theme refreshes');
assert.match(source,
    /paletteChanged && readThemeStylesheetState\(\) !== appliedThemeStylesheets/,
    'head observation must filter palette sources and ignore identical stylesheet writes');
assert.doesNotMatch(source,
    /\[96, 320\]\.forEach/,
    'theme changes must not schedule delayed global refreshes');
assert.doesNotMatch(source,
    /__tmThemeRuntimeComputedStyleSignature|getComputedStyle\(document\.documentElement\)/,
    'theme refresh must not scan every root CSS variable on each render');
assert.doesNotMatch(source,
    /attributeFilter:\s*\[[^\]]*'style'/,
    'inline style mutations must not trigger global theme refreshes');

console.log('theme appearance refresh contract tests passed');
