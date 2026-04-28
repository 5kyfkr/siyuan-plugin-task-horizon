// @name         思源笔记任务管理器
// @version      2.3.8
// @description  任务管理器，支持自定义筛选规则分组和排序
// @author       5KYFKR

(function() {
    'use strict';

    const __tmExplicitWindowExportKeys = (() => {
        try {
            const raw = Array.isArray(globalThis.__taskHorizonExplicitWindowExportKeys)
                ? globalThis.__taskHorizonExplicitWindowExportKeys
                : [];
            const out = [];
            const seen = new Set();
            raw.forEach((item) => {
                const key = String(item || '').trim();
                if (!key || seen.has(key)) return;
                seen.add(key);
                out.push(key);
            });
            return out;
        } catch (e) {
            return [];
        }
    })();
    const __tmExplicitWindowExportSnapshot = (() => {
        const out = new Map();
        try {
            __tmExplicitWindowExportKeys.forEach((key) => {
                if (!key) return;
                const hasOwn = Object.prototype.hasOwnProperty.call(window, key);
                const descriptor = hasOwn ? Object.getOwnPropertyDescriptor(window, key) || null : null;
                out.set(key, { hasOwn, descriptor });
            });
        } catch (e) {}
        return out;
    })();

    if (globalThis.__TaskHorizonLoaded) return;
    globalThis.__TaskHorizonLoaded = true;

    const __tmNsKey = 'siyuan-plugin-task-horizon';
    const __tmNs = (() => {
        try {
            const w = window;
            const existing = w[__tmNsKey];
            if (!existing || typeof existing !== 'object') w[__tmNsKey] = {};
            return w[__tmNsKey];
        } catch (e) {
            return {};
        }
    })();
    const __tmSyncExplicitWindowExports = () => {
        const exportKeys = __tmExplicitWindowExportKeys.slice();
        try { __tmNs.__exportKeys = exportKeys; } catch (e) {}
        exportKeys.forEach((key) => {
            if (!key) return;
            let value;
            try {
                value = window[key];
            } catch (e) {
                return;
            }
            if (typeof value !== 'function') return;
            try { __tmNs[key] = value; } catch (e) {}
        });
        return exportKeys;
    };

    const __tmStyleEl = (() => {
        try {
            return document.querySelector('style[data-tm-style-source="task-horizon.css"]') || null;
        } catch (e) {
            return null;
        }
    })();

    // 本地存储（用于快速读取和云端同步失败时的备用）
    // 主存储使用云端文件（/data/storage/ 目录）
