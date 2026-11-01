'use strict';

const assert = require('node:assert/strict');
const { createHash, createHmac, webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const s3 = require('../calendar-subscription-core').s3;
const base = {
    endpoint: 'http://192.168.1.10:9000', region: 'us-east-1', bucket: 'calendar',
    accessKeyId: 'fixture-access-key', secretAccessKey: 'fixture-secret-key',
    storagePath: 'calendar/task-horizon', fileName: 'tasks.ics', forcePathStyle: true,
};

test('MinIO paths retain the API port and encode Unicode, spaces and percent signs once', () => {
    const target = s3.normalize({ ...base, storagePath: '/我的 日历/100%/', fileName: '任务 #1.ics' });
    assert.equal(target.key, '我的 日历/100%/任务 #1.ics');
    const url = new URL(target.url);
    assert.equal(url.host, '192.168.1.10:9000');
    assert.equal(decodeURIComponent(url.pathname), '/calendar/我的 日历/100%/任务 #1.ics');
    assert.equal(url.hash, '');
    assert.equal(s3.normalize({ ...base, storagePath: '' }).key, 'tasks.ics');
});

test('virtual-hosted endpoints and bucket-scoped public URLs produce fixed unsigned subscription URLs', () => {
    const virtual = s3.normalize({ ...base, endpoint: 'https://s3.example.test/', forcePathStyle: false });
    assert.equal(virtual.url, 'https://calendar.s3.example.test/calendar/task-horizon/tasks.ics');
    const r2 = s3.normalize({ ...base, endpoint: 'https://account.r2.cloudflarestorage.com', region: 'auto', publicBaseUrl: 'https://calendar.example.test/published/' });
    assert.equal(r2.url, 'https://calendar.example.test/published/calendar/task-horizon/tasks.ics');
    assert.equal(new URL(r2.url).search, '');
});

test('SiYuan credentials are resolved afresh while preserving the dedicated bucket and path', () => {
    const inherited = { endpoint: 'https://s3.example.test', bucket: 'siyuan-sync', region: 'us-east-1', accessKey: 'inherited-access', secretKey: 'inherited-secret', pathStyle: false };
    const target = s3.normalize({ ...base, useSiyuanConfig: true, bucket: 'calendar-only' }, inherited);
    assert.equal(target.bucket, 'calendar-only');
    assert.equal(target.accessKeyId, inherited.accessKey);
    assert.equal(target.secretAccessKey, inherited.secretKey);
    assert.equal(target.forcePathStyle, false);
    assert.equal(s3.normalize({ ...base, useSiyuanConfig: true, bucket: '' }, inherited).bucket, 'siyuan-sync');
    inherited.secretKey = 'rotated-secret';
    assert.equal(s3.normalize({ ...base, useSiyuanConfig: true }, inherited).secretAccessKey, 'rotated-secret');
});

test('invalid addresses, missing credentials and path traversal stop before signing', () => {
    for (const [patch, code] of [
        [{ endpoint: 'https://user:password@s3.example.test' }, 'calendar.s3InvalidAddress'],
        [{ publicBaseUrl: 'https://calendar.example.test/?token=secret' }, 'calendar.s3InvalidAddress'],
        [{ secretAccessKey: '' }, 'calendar.s3ConfigIncomplete'],
        [{ storagePath: 'calendar/../sync' }, 'calendar.s3InvalidPath'],
        [{ fileName: '../tasks.ics' }, 'calendar.s3InvalidFileName'],
        [{ bucket: 'bucket@wrong-host' }, 'calendar.s3InvalidBucket'],
    ]) assert.throws(() => s3.normalize({ ...base, ...patch }), error => error.code === code);
});

test('local IPv4 and IPv6 MinIO endpoints use direct requests and custom internal domains can opt in', () => {
    for (const url of ['http://127.0.0.1:9000', 'http://192.168.1.2:9000', 'http://10.1.2.3:9000', 'http://172.20.0.2:9000', 'http://[::1]:9000', 'http://[fd00::1]:9000', 'http://minio.local:9000']) {
        assert.equal(s3.transportFor(url), 'direct', url);
    }
    assert.equal(s3.transportFor('https://s3.example.test'), 'proxy');
    assert.equal(s3.transportFor('https://minio.example.test', 'direct'), 'direct');
    assert.equal(s3.transportFor('http://192.168.1.2:9000', 'proxy'), 'proxy');
});

test('SDK errors never expose keys or presigned query parameters', () => {
    const error = s3.sanitizeError(new Error(`request https://s3.example.test/?X-Amz-Credential=${base.accessKeyId}&X-Amz-Signature=secret-signature failed ${base.secretAccessKey}`), base);
    for (const value of [base.accessKeyId, base.secretAccessKey, 'secret-signature', 'X-Amz-Credential']) assert.ok(!error.includes(value));
});

test('the shipped browser signer produces an independently verified SigV4 PUT for MinIO', async () => {
    const context = vm.createContext({
        URL, URLSearchParams, TextEncoder, TextDecoder, crypto: webcrypto, console,
        setTimeout, clearTimeout, Request, Response, Headers, ReadableStream, Blob, AbortController,
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/vendor/s3-presigner.min.js'), 'utf8'), context);
    const target = s3.normalize({ ...base, storagePath: '我的 日历/100%', fileName: '任务.ics' });
    const signed = new URL(await context.__tmCalendarS3Signer.presignPut(target, s3.CONTENT_TYPE, s3.CACHE_CONTROL));
    assert.equal(signed.host, '192.168.1.10:9000');
    assert.equal(decodeURIComponent(signed.pathname), `/calendar/${target.key}`);
    assert.equal(signed.searchParams.get('X-Amz-Expires'), '900');
    assert.equal(signed.searchParams.get('X-Amz-Content-Sha256'), 'UNSIGNED-PAYLOAD');
    assert.ok(!signed.searchParams.has('x-amz-checksum-crc32'), 'compatible stores do not require an SDK-selected checksum');
    const encode = text => encodeURIComponent(text).replace(/[!'()*]/g, ch => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
    const query = [...signed.searchParams].filter(([key]) => key !== 'X-Amz-Signature')
        .map(([key, value]) => [encode(key), encode(value)]).sort(([ak, av], [bk, bv]) => ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0)
        .map(pair => pair.join('=')).join('&');
    const headerValues = { host: signed.host, 'content-type': s3.CONTENT_TYPE, 'cache-control': s3.CACHE_CONTROL };
    const signedHeaders = signed.searchParams.get('X-Amz-SignedHeaders');
    const canonicalHeaders = signedHeaders.split(';').map(key => `${key}:${headerValues[key]}\n`).join('');
    const canonical = ['PUT', signed.pathname, query, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n');
    const [, date, region, service, terminator] = signed.searchParams.get('X-Amz-Credential').split('/');
    const scope = [date, region, service, terminator].join('/');
    const stringToSign = ['AWS4-HMAC-SHA256', signed.searchParams.get('X-Amz-Date'), scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
    const hmac = (key, text) => createHmac('sha256', key).update(text).digest();
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${base.secretAccessKey}`, date), region), service), terminator);
    assert.equal(createHmac('sha256', signingKey).update(stringToSign).digest('hex'), signed.searchParams.get('X-Amz-Signature'));
});
