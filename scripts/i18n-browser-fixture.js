'use strict';

// Isolated browser tests load production scripts without SiYuan's plugin loader.
const fs = require('node:fs');
const path = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const runtime = fs.readFileSync(path.join(__dirname, '../src/i18n/runtime.js'), 'utf8');
const messages = require('../i18n/zh-CN.json');
const prelude = `${runtime}\nwindow.__taskHorizonHostBridge.i18n = window.__taskHorizonHostBridge.i18nRuntime.createI18n(${JSON.stringify(messages)}, { locale: 'zh-CN' });\nwindow.__tmT = window.__taskHorizonHostBridge.i18n.t;`;
const chromium = Object.create(playwright.chromium);
chromium.launch = async (...args) => {
    const browser = await playwright.chromium.launch(...args);
    const newContext = browser.newContext.bind(browser);
    const newPage = browser.newPage?.bind(browser);
    browser.newContext = async (...contextArgs) => {
        const context = await newContext(...contextArgs);
        await context.addInitScript(prelude);
        return context;
    };
    if (newPage) {
        browser.newPage = async (...pageArgs) => {
            const page = await newPage(...pageArgs);
            await page.addInitScript(prelude);
            return page;
        };
    }
    return browser;
};
module.exports = { ...playwright, chromium, i18nPrelude: prelude };
