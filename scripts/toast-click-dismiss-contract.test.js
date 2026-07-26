'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const basecoat = read('src/basecoat/basecoat.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const license = read('src/task-horizon/main/08-license-runtime.js');
const calendar = read('calendar-view.js');

assert.match(basecoat, /const timer = setTimeout\(\(\) => removeToast\(el\)[\s\S]*?el\.addEventListener\('click'[\s\S]*?clearTimeout\(timer\)[\s\S]*?removeToast\(el\)/, 'Basecoat toasts must dismiss on click');
assert.match(dialogs, /function hint\(msg, type\)[\s\S]*?const timer = setTimeout\(\(\) => __tmRemoveHint\(el\)[\s\S]*?el\.addEventListener\('click'[\s\S]*?clearTimeout\(timer\)[\s\S]*?__tmRemoveHint\(el\)/, 'task-manager fallback hints must dismiss on click');
assert.match(license, /function __tmLicenseNotify\(message, type = 'info'\)[\s\S]*?const timer = setTimeout[\s\S]*?el\.addEventListener\('click'[\s\S]*?clearTimeout\(timer\)[\s\S]*?el\.remove\(\)/, 'license fallback hints must dismiss on click');
assert.match(calendar, /function toast\(msg, type\)[\s\S]*?const timer = setTimeout[\s\S]*?el\.addEventListener\('click'[\s\S]*?clearTimeout\(timer\)[\s\S]*?el\.remove\(\)/, 'calendar hints must dismiss on click');

console.log('toast click-dismiss contract tests passed');
