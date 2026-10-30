'use strict';

// Legacy source contracts inspect literal Chinese UI copy together with code.
// Materialize only translation calls for those contracts. Behavior and browser
// tests continue to read the real source and use the actual runtime translator.
const fs = require('node:fs');
const path = require('node:path');
const messages = require('../i18n/zh-CN.json');
const project = path.resolve(__dirname, '..') + path.sep;
const quote = value => "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n') + "'";

function split(source, separator) {
    const parts = [];
    let start = 0, depth = 0, string = '', escaped = false;
    for (let i = 0; i < source.length; i++) {
        const c = source[i];
        if (string) {
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === string) string = '';
            continue;
        }
        if (c === '"' || c === "'" || c === '`') string = c;
        else if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        else if (c === separator && depth === 0) { parts.push(source.slice(start, i)); start = i + 1; }
    }
    parts.push(source.slice(start));
    return parts;
}

function materialize(source) {
    const pattern = /(?:\b__tmT|globalThis\.__taskHorizonHostBridge\.i18n\.html)\(\s*(["'])([\w.]+)\1/g;
    const edits = [];
    let match;
    while ((match = pattern.exec(source))) {
        const value = messages[match[2]];
        if (typeof value !== 'string') continue;
        let depth = 1, string = '', escaped = false, end = pattern.lastIndex;
        for (; end < source.length && depth; end++) {
            const c = source[end];
            if (string) {
                if (escaped) escaped = false;
                else if (c === '\\') escaped = true;
                else if (c === string) string = '';
            } else if (c === '"' || c === "'" || c === '`') string = c;
            else if (c === '(') depth++;
            else if (c === ')') depth--;
        }
        if (depth) continue;
        const params = new Map();
        const tail = source.slice(pattern.lastIndex, end - 1).trim();
        const object = tail.replace(/^,\s*\{/, '').replace(/\}\s*$/, '');
        if (tail.startsWith(',')) {
            for (const property of split(object, ',')) {
                const pair = split(property, ':');
                const key = pair.shift()?.trim();
                if (key) params.set(key, materialize(pair.length ? pair.join(':').trim() : key));
            }
        }
        const template = value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
            .replace(/\{([A-Za-z_$][\w$]*)\}/g, (placeholder, key) => params.has(key) ? '${' + params.get(key) + '}' : placeholder);
        let start = match.index, finish = end, replacement;
        if (source.slice(start - 2, start) === '${' && source[finish] === '}') {
            start -= 2; finish++; replacement = template;
        } else replacement = params.size ? '`' + template + '`' : quote(value);
        edits.push({ start, end: finish, replacement });
        pattern.lastIndex = end;
    }
    for (const edit of edits.reverse()) source = source.slice(0, edit.start) + edit.replacement + source.slice(edit.end);
    return source;
}

module.exports = {
    ...fs,
    readFileSync(file, options) {
        const result = fs.readFileSync(file, options);
        if (typeof result !== 'string' || typeof file !== 'string') return result;
        const absolute = path.resolve(file);
        if (!absolute.startsWith(project) || absolute.startsWith(__dirname + path.sep) || !absolute.endsWith('.js')) return result;
        return materialize(result);
    },
    materialize,
};
