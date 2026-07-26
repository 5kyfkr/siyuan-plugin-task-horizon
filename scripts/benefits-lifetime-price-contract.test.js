'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const runtimeSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'),
    'utf8',
);

const offerStart = runtimeSource.indexOf('const TM_BENEFITS_LIFETIME_STANDARD_PRICE_AT');
const offerEnd = runtimeSource.indexOf('\n    function __tmGetBenefitsAuthInfo()', offerStart);
assert.ok(offerStart >= 0 && offerEnd > offerStart, 'lifetime offer helper must be discoverable');

const context = {};
vm.runInNewContext(`
    ${runtimeSource.slice(offerStart, offerEnd)}
    globalThis.getLifetimeOffer = __tmGetBenefitsLifetimeOffer;
`, context);

const beforeCutover = context.getLifetimeOffer(Date.parse('2026-07-31T15:59:59.999Z'));
assert.equal(beforeCutover.price, 50, 'early-bird price must remain 50 yuan before Beijing midnight');
assert.equal(beforeCutover.originalPrice, 98, 'early-bird offer must show the 98 yuan original price');

const atCutover = context.getLifetimeOffer(Date.parse('2026-07-31T16:00:00.000Z'));
assert.equal(atCutover.price, 98, 'standard price must take effect at Beijing midnight on August 1');
assert.equal(atCutover.originalPrice, 0, 'standard price must not render a crossed-out original price');
assert.equal(atCutover.tag, '永久买断');
assert.doesNotMatch(atCutover.description, /早鸟|2026年7月31日|已捐助|补齐差额/);
assert.doesNotMatch(atCutover.summary, /早鸟|2026年7月31日|已捐助|补齐差额/);
assert.match(atCutover.summary, /98 元/);

assert.match(runtimeSource, /const lifetimeOffer = __tmGetBenefitsLifetimeOffer\(\);[\s\S]*?__tmRenderBenefitsLifetimePrice\(lifetimeOffer\)[\s\S]*?lifetimeOffer\.description/);
assert.match(runtimeSource, /lifetime:\s*\{[\s\S]*?summary: lifetimeOffer\.summary/);
assert.match(runtimeSource, /__tmScheduleBenefitsLifetimeRefresh\(\);/);
assert.match(runtimeSource, /dialog\.dataset\.tmBenefitsPlan = planKey;/);
assert.match(runtimeSource, /dialog\?\.dataset\?\.tmBenefitsPlan === 'lifetime'[\s\S]*?summary\.textContent = offer\.summary/);

console.log('benefits lifetime price contract tests passed');
