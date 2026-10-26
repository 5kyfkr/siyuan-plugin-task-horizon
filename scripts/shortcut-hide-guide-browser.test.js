'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

execFileSync(process.execPath, [path.join(__dirname, 'shortcut-sidebar-browser-fixture.js')], { cwd: root });
const fixture = read('output/playwright/shortcut-sidebar-plugin.html');
const boot = '__tmApplyAppearanceThemeVars();load();applyFilters();render();';
assert.ok(fixture.includes(boot));
const html = fixture.replace(boot, `
    const params=new URLSearchParams(location.search);
    globalThis.__taskHorizonRuntimeClientKind=params.get('native')==='1'?'mobile-app':'desktop-browser';
    host.dataset.tmUiMode=params.get('hostMobile')==='1'?'mobile':'desktop';
    const mode=params.get('mode')||'full',acknowledged=params.get('acknowledged')==='1';
    if(!localStorage.getItem('fixture-shortcut-settings-file'))SettingsStore.data.shortcutSidebarPreferences={
        mobile:{mode,hideGuideAcknowledged:acknowledged},
        desktop:{mode,hideGuideAcknowledged:acknowledged},
    };
    __tmApplyAppearanceThemeVars();load();applyFilters();render();
`);

async function run() {
    const server = http.createServer((req, res) => {
        if (req.url.endsWith('.css')) {
            res.setHeader('content-type', 'text/css');
            res.end(read(req.url.includes('basecoat') ? 'src/basecoat/basecoat.css' : 'task-horizon.css'));
        } else if (req.url.startsWith('/api/')) {
            res.setHeader('content-type', 'application/json');res.end(JSON.stringify({ code: 0, data: [] }));
        } else {
            res.setHeader('content-type', 'text/html; charset=utf-8');res.end(html);
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    const url = `http://127.0.0.1:${server.address().port}`;
    const openPage = async ({mode = 'full', acknowledged = false, native = false, hostMobile = false,
        width = 1440, height = 900} = {}) => {
        const page = await browser.newPage({viewport:{width,height},isMobile:native,hasTouch:native||hostMobile});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.goto(`${url}/?mode=${mode}&acknowledged=${acknowledged?1:0}&native=${native?1:0}&hostMobile=${hostMobile?1:0}`);
        return {page,errors};
    };
    const guide = page => page.locator('.tm-shortcut-hide-guide');
    const waitGuide = page => guide(page).waitFor({state:'visible'});
    const mode = page => page.locator('.tm-shortcut-layout').getAttribute('data-shortcut-mode');
    try {
        {
            const {page,errors}=await openPage({mode:'hidden'});
            await waitGuide(page);
            assert.equal(await mode(page),'hidden','startup restores the fully hidden sidebar');
            assert.equal(await page.locator('.tm-shortcut-hide-guide-footer > span').innerText(),'按住可上下拖拽调节位置');
            assert.equal(await page.locator('.tm-shortcut-hide-guide-footer svg').count(),0,'drag instruction has no arrow icon');
            assert.equal(await page.locator('.tm-shortcut-hide-guide-acknowledge').innerText(),'知道了');
            assert.equal(await page.locator('.tm-shortcut-hide-guide-acknowledge').getAttribute('type'),'button');
            const button=await page.locator('.tm-shortcut-hide-guide-acknowledge').boundingBox();
            assert.ok(button.width<=80&&button.height<=32,'acknowledgement button stays compact');
            if(process.env.TM_HIDE_GUIDE_SCREENSHOT){
                fs.mkdirSync(path.join(root,'output/playwright/shortcut-hide-guide'),{recursive:true});
                await page.screenshot({path:path.join(root,'output/playwright/shortcut-hide-guide/formal-light.png'),animations:'disabled'});
                await page.evaluate(()=>{
                    const root=document.documentElement,keys=['--tm-bg-color','--tm-text-color','--tm-border-color','--tm-hover-bg','--tm-secondary-text','--tm-header-bg','--tm-primary-color','--tm-shadow'];
                    window.__hideGuideTheme=keys.map(key=>[key,root.style.getPropertyValue(key),root.style.getPropertyPriority(key)]);
                    Object.entries({'--tm-bg-color':'#1e1e1e','--tm-text-color':'#e0e0e0','--tm-border-color':'#333333','--tm-hover-bg':'#2d2d2d','--tm-secondary-text':'#aaaaaa','--tm-header-bg':'#252525','--tm-primary-color':'#6ba5ff','--tm-shadow':'0 10px 40px rgba(0,0,0,.5)'}).forEach(([key,value])=>root.style.setProperty(key,value));
                });
                await page.screenshot({path:path.join(root,'output/playwright/shortcut-hide-guide/formal-dark.png'),animations:'disabled'});
                await page.evaluate(()=>{const root=document.documentElement;window.__hideGuideTheme.forEach(([key,value,priority])=>value?root.style.setProperty(key,value,priority):root.style.removeProperty(key));delete window.__hideGuideTheme;});
            }
            await page.locator('.tm-shortcut-edge').click();
            await page.waitForFunction(() => document.querySelector('.tm-shortcut-layout').dataset.shortcutMode==='drawer');
            assert.equal(await guide(page).count(),0,'clicking the highlighted edge opens the drawer and closes the guide');
            assert.deepEqual(errors,[]);
            await page.reload();
            await waitGuide(page);
            assert.equal(await mode(page),'hidden','a reload returns the unacknowledged sidebar to its hidden base state with the guide');
            await page.close();
        }
        {
            const {page}=await openPage({mode:'hidden'});
            await waitGuide(page);
            await page.locator('[data-hide-guide-close]').last().click();
            assert.equal(await guide(page).count(),0,'close dismisses only this occurrence');
            assert.equal(await page.evaluate(()=>shortcutTest.SettingsStore.data.shortcutSidebarPreferences.desktop.hideGuideAcknowledged),false);
            await page.reload();await waitGuide(page);
            await page.keyboard.press('Escape');
            assert.equal(await guide(page).count(),0,'Escape dismisses only this occurrence');
            await page.reload();await waitGuide(page);
            await page.mouse.click(1200,100);
            assert.equal(await guide(page).count(),0,'the backdrop dismisses only this occurrence');
            assert.equal(await page.evaluate(()=>shortcutTest.SettingsStore.data.shortcutSidebarPreferences.desktop.hideGuideAcknowledged),false);
            await page.close();
        }
        {
            const {page,errors}=await openPage();
            await page.locator('[data-shortcut-action="collapse"]').click();
            await page.locator('[data-shortcut-action="hide"]').click();
            await waitGuide(page);
            assert.equal(await mode(page),'hidden','explicit hide completes before the guide is shown');
            const before=await page.locator('.tm-shortcut-edge').boundingBox();
            await page.mouse.move(before.x+10,before.y+24);await page.mouse.down();
            await page.mouse.move(before.x+10,700,{steps:12});await page.mouse.up();
            const after=await page.locator('.tm-shortcut-edge').boundingBox();
            assert.ok(after.y>before.y+100,'edge can still be dragged while the guide is open');
            assert.equal(await mode(page),'hidden','dragging does not open the sidebar');
            const aligned=await page.locator('.tm-shortcut-hide-guide-panel').evaluate(panel=>{
                const box=panel.getBoundingClientRect(),edge=document.querySelector('.tm-shortcut-edge').getBoundingClientRect();
                return Math.abs(box.top+parseFloat(getComputedStyle(panel).getPropertyValue('--tm-hide-guide-pointer-top'))-edge.top-edge.height/2)<2;
            });
            assert.ok(aligned,'guide pointer follows the dragged edge');
            await page.locator('.tm-shortcut-hide-guide-acknowledge').click();
            assert.equal(await guide(page).count(),0,'acknowledgement closes the guide');
            assert.equal(await page.evaluate(()=>shortcutTest.SettingsStore.data.shortcutSidebarPreferences.desktop.hideGuideAcknowledged),true);
            await page.locator('.tm-shortcut-edge').click();
            await page.locator('[data-shortcut-action="pin"]').click();
            await page.locator('[data-shortcut-action="collapse"]').click();
            await page.locator('[data-shortcut-action="hide"]').click();
            await page.waitForTimeout(100);
            assert.equal(await guide(page).count(),0,'acknowledgement permanently suppresses later hides');
            await page.reload();await page.waitForTimeout(100);
            assert.equal(await guide(page).count(),0,'acknowledgement survives reload');
            assert.deepEqual(errors,[]);
            await page.close();
        }
        {
            const {page}=await openPage();
            await page.locator('[data-shortcut-action="pin"]').click();
            await page.waitForTimeout(120);
            assert.equal(await guide(page).count(),0,'switching to floating mode does not trigger the guide');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            assert.equal(await guide(page).count(),0,'closing the floating drawer does not trigger the guide');
            await page.setViewportSize({width:640,height:844});
            await page.waitForTimeout(120);
            assert.equal(await mode(page),'hidden');
            assert.equal(await guide(page).count(),0,'automatic narrow-screen collapse does not trigger the guide');
            await page.close();
        }
        for (const device of [
            {label:'mobile app',native:true,width:390},
            {label:'mobile host',hostMobile:true,width:1024},
            {label:'narrow desktop',width:640},
        ]) {
            const {page}=await openPage({mode:'hidden',native:device.native,hostMobile:device.hostMobile,width:device.width,height:844});
            await page.waitForTimeout(120);
            assert.equal(await mode(page),'hidden',`${device.label} remains hidden`);
            assert.equal(await guide(page).count(),0,`${device.label} does not show the desktop-only guide`);
            await page.close();
        }
        {
            const {page}=await openPage({mode:'hidden',acknowledged:true});
            await page.waitForTimeout(120);
            assert.equal(await guide(page).count(),0,'an acknowledged preference suppresses startup guidance');
            await page.close();
        }
        console.log('Shortcut hide guide: startup, explicit hide, temporary and permanent dismissal, edge interaction, drag tracking and device gating passed.');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}

run().catch(error => { console.error(error);process.exitCode=1; });
