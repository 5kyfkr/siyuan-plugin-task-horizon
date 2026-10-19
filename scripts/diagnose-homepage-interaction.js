// 在故障发生时，将本文件内容粘贴到思源开发者工具 Console 执行。
(async () => {
    const describe = (el) => {
        if (!(el instanceof Element)) return null;
        return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '')
            + [...el.classList].slice(0, 8).map((name) => `.${name}`).join('');
    };
    const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0
            && r.top < innerHeight && r.left < innerWidth && s.display !== 'none' && s.visibility !== 'hidden';
    };
    const box = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return {
            node: describe(el), rect: {x: r.x, y: r.y, width: r.width, height: r.height},
            inlineStyle: el.getAttribute('style'), pointerEvents: s.pointerEvents,
            opacity: s.opacity, zIndex: s.zIndex, position: s.position,
            appRegion: s.getPropertyValue('-webkit-app-region'),
            inertAncestor: describe(el.closest('[inert]')),
            snapshotAncestor: describe(el.closest('[data-task-horizon-dock-snapshot="1"]')),
        };
    };
    const liveModal = globalThis.__tmRuntimeState?.getModal?.() || null;
    const shells = [...document.querySelectorAll('.tm-modal')]
        .filter((el) => el.matches('[data-task-horizon-shell="1"],[data-task-horizon-dock-snapshot="1"]')
            || el.querySelector('.tm-main-stage')).filter(visible);
    const samples = [];
    for (const shell of shells) {
        for (const selector of ['.tm-homepage-entry-btn', '.tm-header-selects button', '.tm-shortcut-tool', '.tm-homepage-settings-btn', '.tm-body--homepage']) {
            const el = shell.querySelector(selector);
            if (!el || !visible(el)) continue;
            const r = el.getBoundingClientRect();
            const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
            const y = Math.max(0, Math.min(innerHeight - 1, r.top + Math.min(r.height / 2, 120)));
            const hits = document.elementsFromPoint(x, y);
            const top = hits[0];
            samples.push({selector, ...box(el), point: {x, y},
                hitExpected: !!top && (el === top || el.contains(top)),
                hitStack: hits.slice(0, 6).map(box),
                ancestors: (() => {
                    const out = [];
                    for (let p = el.parentElement; p && out.length < 9; p = p.parentElement) out.push(box(p));
                    return out;
                })(),
            });
        }
    }
    let mutationRecords = 0;
    const observer = new MutationObserver((records) => { mutationRecords += records.length; });
    shells.forEach((shell) => observer.observe(shell, {attributes: true, childList: true, subtree: true}));
    const start = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 500));
    observer.disconnect();
    const report = {
        capturedAt: new Date().toISOString(),
        sampleElapsedMs: Math.round(performance.now() - start), mutationRecords,
        liveModal: liveModal ? {...box(liveModal), connected: liveModal.isConnected} : null,
        visibleShells: shells.map((shell) => ({...box(shell), isLive: shell === liveModal,
            renderMode: shell.getAttribute('data-tm-render-mode'),
            snapshotKind: shell.getAttribute('data-task-horizon-snapshot-kind'),
            homepageRootPresent: !!shell.querySelector('#tmHomepageRoot'),
        })),
        samples,
        dialogs: [...document.querySelectorAll('[role="dialog"][aria-modal="true"],dialog[open],.tm-inline-loading-overlay,.tm-shortcut-scrim')]
            .filter(visible).slice(0, 15).map(box),
        themes: [...document.querySelectorAll('link[rel="stylesheet"]')]
            .filter((el) => /theme|appearance/i.test(el.href) || /theme/i.test(el.id))
            .map((el) => ({id: el.id, href: el.getAttribute('href')})),
    };
    console.log('Task Horizon homepage interaction diagnostic\n' + JSON.stringify(report, null, 2));
    return report;
})();
