#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repoRoot, 'src', 'task-horizon', 'main');
const strict = process.argv.includes('--strict') || process.env.TM_WRITER_BOUNDARY_STRICT === '1';
const showAllowed = process.argv.includes('--all');

const writeMethodPattern = '(setAttrs|updateBlock|insertBlock|appendBlock|moveBlock|deleteBlock)';
const checks = [
  {
    name: '__tmBackendAdapter',
    pattern: new RegExp(`\\b__tmBackendAdapter\\s*\\.\\s*${writeMethodPattern}\\s*\\(`),
  },
  {
    name: 'API',
    pattern: new RegExp(`\\bAPI\\s*\\.\\s*${writeMethodPattern}\\s*\\(`),
  },
  {
    name: 'block-api-endpoint',
    pattern: /['"]\/api\/block\/(?:updateBlock|insertBlock|appendBlock|moveBlock|deleteBlock)['"]/,
  },
  {
    name: 'attr-api-endpoint',
    pattern: /['"]\/api\/attr\/setBlockAttrs['"]/,
  },
];

const whitelist = [
  {
    test: (rel) => rel === '20-api-and-runtime-services.js',
    reason: 'backend adapter, outbox executor, legacy writer kernels',
  },
  {
    test: (rel) => rel === path.join('task-runtime', '53-list-render-and-document-loader.js'),
    reason: 'legacy content/delete task writer kernels; migrate or wrap later',
  },
  {
    test: (rel) => rel === path.join('task-runtime', '53b-task-create-and-quick-add-runtime.js'),
    reason: 'legacy create task writer kernels; migrate or wrap later',
  },
  {
    test: (rel) => /^task-runtime[\\/]55-.*\.js$/.test(rel),
    reason: 'task writer service modules',
  },
  {
    test: (rel) => rel === path.join('settings', '61-settings-appearance-and-import.js'),
    reason: 'settings import tools; review before tightening',
  },
  {
    test: (rel) => rel === path.join('settings', '70-doc-group-and-settings-actions.js'),
    reason: 'settings/doc actions; review before tightening',
  },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function normalizeRel(file) {
  return path.relative(sourceRoot, file);
}

function getWhitelist(rel) {
  return whitelist.find((item) => item.test(rel)) || null;
}

function scanFile(file) {
  const rel = normalizeRel(file);
  const allow = getWhitelist(rel);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const matches = [];
  lines.forEach((line, index) => {
    checks.forEach((check) => {
      if (check.pattern.test(line)) {
        matches.push({
          rel,
          line: index + 1,
          check: check.name,
          allowed: !!allow,
          reason: allow ? allow.reason : '',
          text: line.trim(),
        });
      }
    });
  });
  return matches;
}

function printMatch(match) {
  const tag = match.allowed ? 'ALLOW' : 'REVIEW';
  const reason = match.allowed ? ` (${match.reason})` : '';
  console.log(`[${tag}] ${match.rel}:${match.line} ${match.check}${reason}`);
  console.log(`        ${match.text}`);
}

if (!fs.existsSync(sourceRoot)) {
  console.error(`Task Horizon source root not found: ${sourceRoot}`);
  process.exit(2);
}

const matches = walk(sourceRoot).flatMap(scanFile);
const review = matches.filter((item) => !item.allowed);
const allowed = matches.filter((item) => item.allowed);

console.log('Task Horizon writer boundary scan');
console.log(`source: ${path.relative(repoRoot, sourceRoot) || sourceRoot}`);
console.log(`matches: ${matches.length}, allowed: ${allowed.length}, review: ${review.length}`);

if (review.length) {
  console.log('\nReview these direct backend writes:');
  review.forEach(printMatch);
}

if (showAllowed && allowed.length) {
  console.log('\nAllowed direct backend writes:');
  allowed.forEach(printMatch);
}

if (!review.length) {
  console.log('\nNo direct backend writes outside the current whitelist.');
}

if (strict && review.length) {
  process.exitCode = 1;
}
