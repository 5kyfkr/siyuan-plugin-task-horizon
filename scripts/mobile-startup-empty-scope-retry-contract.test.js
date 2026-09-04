'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(
    __dirname,
    '../src/task-horizon/main/task-runtime/53c-document-loader-runtime.js',
), 'utf8');

const loadStart = source.indexOf('async function loadSelectedDocuments(');
const emptyStateStart = source.indexOf("if (allDocIds.length === 0) {", loadStart);
assert.notEqual(loadStart, -1, 'document loader must exist');
assert.notEqual(emptyStateStart, -1, 'document loader must keep an explicit empty-state path');

const beforeEmptyState = source.slice(loadStart, emptyStateStart);
assert.match(beforeEmptyState, /if \(allDocIds\.length === 0 && \(retryEmptyDocScope \|\| waitForDocScopeResolve\)\)/,
    'startup recovery must run before committing an empty task tree');
assert.match(beforeEmptyState, /configuredScope = !!\([\s\S]*scopeContext\?\.entries[\s\S]*scopeContext\?\.otherBlockRefs/,
    'empty-scope retries must require configured document sources');
assert.match(beforeEmptyState, /const quickAddDocId = String\(scopeContext\?\.quickAddDocId/,
    'the quick-add document must count as a configured source');
assert.match(beforeEmptyState, /retryCount = Math\.max\(1, Math\.min\(4,[\s\S]*for \(let retryIndex = 0; retryIndex < retryCount/,
    'startup recovery must use a bounded retry count');
assert.match(beforeEmptyState, /await __tmRefreshNotebookCache\(true\)[\s\S]*forceRefreshScope: true,[\s\S]*skipPersistedScope: true,[\s\S]*skipResolvedDocIdsCache: true/,
    'each retry must refresh notebook state and bypass stale scope caches');
assert.match(beforeEmptyState, /if \(!isTokenCurrent\(\)\) return/,
    'startup recovery must stop when its manager open token is stale');
assert.match(source, /if \(retryEmptyDocScope \|\| waitForDocScopeResolve\) return false;/,
    'an unresolved configured scope must report startup failure so the next open can retry');

console.log('mobile startup empty-scope retry contract tests passed');
