'use strict';

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

async function build() {
    const result = await esbuild.build({
        absWorkingDir: __dirname, entryPoints: ['entry.js'], bundle: true, minify: true,
        format: 'iife', platform: 'browser', target: 'es2020', legalComments: 'eof',
        outfile: '../../src/vendor/s3-presigner.min.js', metafile: true,
    });
    const packages = new Map();
    for (const input of Object.keys(result.metafile.inputs)) {
        const match = input.replace(/\\/g, '/').match(/^node_modules\/((?:@[^/]+\/)?[^/]+)/);
        if (!match || packages.has(match[1])) continue;
        const directory = path.join(__dirname, 'node_modules', match[1]);
        const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
        const notices = fs.readdirSync(directory).filter(file => /^(?:licen[cs]e|notice|copyright)(?:\.|$)/i.test(file));
        if (!notices.length) throw new Error(`Missing license: ${metadata.name}`);
        packages.set(match[1], `${metadata.name} ${metadata.version} (${metadata.license})\n${notices.map(file => fs.readFileSync(path.join(directory, file), 'utf8')).join('\n')}`);
    }
    const licenses = [...packages].sort(([a], [b]) => a.localeCompare(b)).map(([, text]) => text);
    fs.writeFileSync(path.join(__dirname, '../../src/vendor/s3-presigner.LICENSE.txt'), licenses.join('\n\n========================================\n\n'));
    console.log(`Built browser S3 signer and ${licenses.length} dependency license notices`);
}

build().catch(error => { console.error(error); process.exitCode = 1; });
