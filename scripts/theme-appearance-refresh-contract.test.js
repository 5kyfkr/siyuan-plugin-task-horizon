const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/shell/80-shell-lifecycle.js'),
    'utf8'
);

assert.match(source,
    /attributeFilter:\s*\['data-theme-mode', 'data-light-theme', 'data-dark-theme', 'data-mode', 'style', 'class'\]/,
    'theme refresh must observe theme attributes, root style, and palette classes');
assert.match(source,
    /readRootThemeStyleSignature\s*=\s*\(\)\s*=>[\s\S]*?getComputedStyle\(document\.documentElement\)/,
    'root class changes must be evaluated through computed CSS variables, independent of theme names');
assert.match(source,
    /__tmThemeModeObserver\.observe\(document\.body,[\s\S]*?attributeFilter: \['style', 'class'\]/,
    'body-based theme class/style changes must be covered without a theme-name whitelist');
assert.match(source,
    /record\.attributeName === 'class'[\s\S]*?nextSignature !== themeStyleSignature/,
    'unrelated root class changes must not trigger a full task view render');
assert.match(source,
    /__tmThemeHeadObserver\s*=\s*new MutationObserver/,
    'theme refresh must observe replacement stylesheet links in document.head');
assert.match(source,
    /\[96, 320\]\.forEach/,
    'theme refresh must retry after asynchronous theme.css replacement');
assert.match(source,
    /__tmThemeRuntimeRootStyleSnapshot/,
    'theme refresh must ignore root style mutations produced by the plugin itself');

console.log('theme appearance refresh contract tests passed');
