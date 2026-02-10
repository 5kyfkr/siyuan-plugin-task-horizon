// @name         思源笔记任务管理器
// @version      1.1.3
// @description  任务管理器，支持自定义筛选规则分组和排序
// @author       5KYFKR

(function() {
    'use strict';
    
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
    const __tmWindowKeysBefore = (() => {
        try {
            return new Set(Object.getOwnPropertyNames(window));
        } catch (e) {
            return new Set();
        }
    })();

    const __tmStyleEl = document.createElement('style');
    __tmStyleEl.dataset.tmTaskHorizonStyle = '1';
    __tmStyleEl.textContent = `
        :root {
            --tm-bg-color: #ffffff;
            --tm-text-color: #333333;
            --tm-border-color: #e9ecef;
            --tm-table-border-color: #e9ecef;
            --tm-hover-bg: #f8f9fa;
            --tm-secondary-text: #666666;
            --tm-modal-overlay: rgba(0,0,0,0.5);
            --tm-shadow: 0 10px 40px rgba(0,0,0,0.2);
            --tm-header-bg: #f8f9fa;
            --tm-input-bg: #ffffff;
            --tm-input-border: #ddd;
            --tm-table-header-bg: #f8f9fa;
            --tm-table-border: #e9ecef;
            --tm-task-done-color: #999999;
            --tm-doc-item-bg: #f8f9fa;
            --tm-doc-item-hover: #e8f0fe;
            --tm-doc-count-bg: #e8f0fe;
            --tm-doc-count-color: #4285f4;
            --tm-rule-group-bg: #f8f9fa;
            --tm-rule-item-bg: #f8f9fa;
            --tm-primary-color: #4285f4;
            --tm-success-color: #34a853;
            --tm-danger-color: #ea4335;
            --tm-info-bg: #f0f9ff;
            --tm-info-border: #4285f4;
            --tm-section-bg: #f8f9fa;
            --tm-card-bg: #ffffff;
            --tm-font-size: 14px;
            --tm-row-height: clamp(24px, calc(var(--tm-font-size) * 1.25 + 12px), 42px);
            --tm-gantt-bar-height: clamp(12px, calc(var(--tm-row-height) * 0.6), 22px);
            --tm-empty-cell-bg: #f1f3f4;
            --tm-topbar-grad-start: #667eea;
            --tm-topbar-grad-end: #764ba2;
            --tm-task-content-color: var(--tm-text-color);
            --tm-group-doc-label-color: var(--tm-text-color);
            --tm-time-group-base-color: #1a73e8;
            --tm-time-group-overdue-color: #d93025;
            --tm-quadrant-red: #ea4335;
            --tm-quadrant-yellow: #f9ab00;
            --tm-quadrant-blue: #1a73e8;
            --tm-quadrant-green: #34a853;
        }

        [data-theme-mode="dark"] {
            --tm-bg-color: #1e1e1e;
            --tm-text-color: #e0e0e0;
            --tm-border-color: #333333;
            --tm-table-border-color: #333333;
            --tm-hover-bg: #2d2d2d;
            --tm-secondary-text: #aaaaaa;
            --tm-modal-overlay: rgba(0,0,0,0.7);
            --tm-shadow: 0 10px 40px rgba(0,0,0,0.5);
            --tm-header-bg: #252525;
            --tm-input-bg: #2d2d2d;
            --tm-input-border: #444444;
            --tm-table-header-bg: #252525;
            --tm-table-border: #333333;
            --tm-task-done-color: #666666;
            --tm-doc-item-bg: #252525;
            --tm-doc-item-hover: #333333;
            --tm-doc-count-bg: #333333;
            --tm-doc-count-color: #6ba5ff;
            --tm-rule-group-bg: #252525;
            --tm-rule-item-bg: #2d2d2d;
            --tm-primary-color: #6ba5ff;
            --tm-success-color: #4caf50;
            --tm-danger-color: #ef5350;
            --tm-info-bg: #1a2733;
            --tm-info-border: #6ba5ff;
            --tm-section-bg: #252525;
            --tm-card-bg: #2d2d2d;
            --tm-empty-cell-bg: #1a1a1a;
            --tm-topbar-grad-start: #3b49b7;
            --tm-topbar-grad-end: #5b2d7a;
            --tm-task-content-color: var(--tm-text-color);
            --tm-group-doc-label-color: var(--tm-text-color);
            --tm-time-group-base-color: #6ba5ff;
            --tm-time-group-overdue-color: #ff6b6b;
            --tm-quadrant-red: #ef5350;
            --tm-quadrant-yellow: #f9ab00;
            --tm-quadrant-blue: #6ba5ff;
            --tm-quadrant-green: #4caf50;
        }

        .tm-color-picker-backdrop {
            position: fixed;
            inset: 0;
            background: var(--tm-modal-overlay);
            z-index: 200005;
            display: flex;
            justify-content: center;
            align-items: flex-end;
            padding: 12px;
            box-sizing: border-box;
        }

        .tm-color-picker-dialog {
            width: 100%;
            max-width: 520px;
            background: var(--tm-bg-color);
            border: 1px solid var(--tm-border-color);
            border-radius: 14px;
            box-shadow: var(--tm-shadow);
            padding: 14px;
            box-sizing: border-box;
        }

        .tm-color-grid-10 {
            display: grid;
            grid-template-columns: repeat(10, minmax(0, 1fr));
            gap: 8px;
        }

        .tm-color-grid-10 button {
            width: 100%;
            aspect-ratio: 1 / 1;
            border-radius: 8px;
            border: 1px solid var(--tm-border-color);
            padding: 0;
        }

        .tm-color-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 12px;
        }

        .tm-color-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border: 1px solid var(--tm-border-color);
            border-radius: 8px;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
            cursor: pointer;
            min-width: 120px;
            justify-content: space-between;
        }

        .tm-color-swatch {
            width: 18px;
            height: 18px;
            border-radius: 6px;
            border: 1px solid var(--tm-border-color);
            flex: 0 0 auto;
        }

        .tm-color-text {
            font-size: 12px;
            opacity: 0.9;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }

        .tm-cell-editable {
            cursor: pointer;
            user-select: none;
            white-space: normal;
            word-break: break-all;
        }

        .tm-cell-editable:hover {
            background: var(--tm-hover-bg);
        }

        .tm-inline-editor {
            position: fixed;
            z-index: 100003;
            background: var(--tm-bg-color);
            border: 1px solid var(--tm-border-color);
            border-radius: 10px;
            padding: 10px;
            box-shadow: var(--tm-shadow);
            min-width: 220px;
            color: var(--tm-text-color);
        }

        .tm-inline-editor input,
        .tm-inline-editor select {
            width: 100%;
            box-sizing: border-box;
            padding: 8px 10px;
            border: 1px solid var(--tm-input-border);
            border-radius: 8px;
            font-size: 13px;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
        }

        .tm-inline-editor-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 10px;
        }

        .tm-cell-editor-input,
        .tm-cell-editor-select {
            width: 100%;
            box-sizing: border-box;
            padding: 4px 8px;
            border: 1px solid var(--tm-input-border);
            border-radius: 6px;
            font-size: 12px;
            height: 28px;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
        }

        .tm-group-row td {
            background: var(--tm-header-bg);
            color: var(--tm-text-color);
            font-weight: 600;
            border-bottom: 1px solid var(--tm-table-border-color);
        }

        .tm-table .tm-group-row td {
            padding: 0;
        }

        .tm-group-sticky {
            position: sticky;
            left: 0;
            z-index: 3;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: var(--tm-header-bg);
        }
        
        /* 四象限分组样式 */
        .tm-quadrant-group {
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        
        .tm-quadrant-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        
        .tm-quadrant-red { color: var(--tm-quadrant-red); }
        .tm-quadrant-yellow { color: var(--tm-quadrant-yellow); }
        .tm-quadrant-blue { color: var(--tm-quadrant-blue); }
        .tm-quadrant-green { color: var(--tm-quadrant-green); }
        
        .tm-quadrant-bg-red { background: var(--tm-quadrant-red); }
        .tm-quadrant-bg-yellow { background: var(--tm-quadrant-yellow); }
        .tm-quadrant-bg-blue { background: var(--tm-quadrant-blue); }
        .tm-quadrant-bg-green { background: var(--tm-quadrant-green); }
        
        /* 规则管理器样式 */
        .tm-rules-manager {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: var(--tm-modal-overlay);
            z-index: 100002;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .tm-rules-box {
            background: var(--tm-bg-color);
            width: 800px;
            max-width: 90vw;
            max-height: 80vh;
            border-radius: 12px;
            box-shadow: var(--tm-shadow);
            padding: 24px;
            display: flex;
            flex-direction: column;
            color: var(--tm-text-color);
        }
        
        .tm-rules-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .tm-rules-title {
            font-size: 20px;
            font-weight: 600;
            color: var(--tm-text-color);
        }
        
        .tm-rules-body {
            flex: 1;
            overflow-y: auto;
            margin-bottom: 20px;
        }
        
        .tm-rule-group {
            background: var(--tm-rule-group-bg);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
            border: 1px solid var(--tm-border-color);
        }
        
        .tm-rule-group-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        
        .tm-rule-group-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--tm-text-color);
            flex: 1;
        }
        
        .tm-rule-group-controls {
            display: flex;
            gap: 8px;
        }
        
        .tm-rule-input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--tm-input-border);
            border-radius: 6px;
            font-size: 13px;
            margin-bottom: 10px;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
        }
        
        .tm-rule-input:focus {
            border-color: var(--tm-primary-color);
            outline: none;
        }
        
        .tm-rule-section {
            background: var(--tm-bg-color);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
            border: 1px solid var(--tm-border-color);
        }
        
        .tm-rule-section-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--tm-secondary-text);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .tm-status-tag {
            display: inline-flex;
            align-items: center;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            color: #fff;
            white-space: nowrap;
            cursor: pointer;
            transition: opacity 0.2s;
        }

        .tm-status-tag:hover {
            opacity: 0.8;
        }

        .tm-status-select-modal {
            position: fixed;
            background: var(--tm-bg-color);
            border: 1px solid var(--tm-border-color);
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            border-radius: 4px;
            z-index: 100005;
            padding: 4px;
            max-height: 200px;
            overflow-y: auto;
        }

        .tm-status-option {
            display: flex;
            align-items: center;
            padding: 6px 10px;
            cursor: pointer;
            border-radius: 4px;
            color: var(--tm-text-color);
            font-size: 13px;
        }

        .tm-status-option:hover {
            background: var(--tm-rule-item-bg);
        }

        .tm-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
        }

        .tm-rule-conditions {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .tm-rule-condition {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 6px;
            background: var(--tm-rule-item-bg);
            border-radius: 4px;
        }
        
        .tm-rule-condition-field {
            width: 120px;
            font-size: 12px;
            font-weight: 500;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
            border: 1px solid var(--tm-input-border);
            padding: 4px;
            border-radius: 4px;
        }
        
        .tm-rule-condition-operator {
            width: 80px;
            font-size: 12px;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
            border: 1px solid var(--tm-input-border);
            padding: 4px;
            border-radius: 4px;
        }
        
        .tm-rule-condition-value {
            flex: 1;
            font-size: 12px;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
            border: 1px solid var(--tm-input-border);
            padding: 4px;
            border-radius: 4px;
        }
        
        .tm-rule-sort-items {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .tm-rule-sort-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 6px;
            background: var(--tm-rule-item-bg);
            border-radius: 4px;
        }
        
        .tm-rule-sort-field {
            width: 120px;
            font-size: 12px;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
            border: 1px solid var(--tm-input-border);
            padding: 4px;
            border-radius: 4px;
        }
        
        .tm-rule-sort-order {
            width: 100px;
            font-size: 12px;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
            border: 1px solid var(--tm-input-border);
            padding: 4px;
            border-radius: 4px;
        }
        
        .tm-rule-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 10px;
        }
        
        .tm-rules-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid var(--tm-border-color);
        }
        
        /* 规则选择器样式 */
        .tm-rule-selector {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .tm-rule-select {
            min-width: 100px;
            padding: 6px 10px;
            border: 1px solid var(--tm-input-border);
            border-radius: 4px;
            font-size: 13px;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
        }
        
        .tm-rule-select:focus {
            border-color: var(--tm-primary-color);
            outline: none;
        }
        
        .tm-rule-info {
            font-size: 12px;
            color: var(--tm-secondary-text);
            background: var(--tm-info-bg);
            padding: 4px 8px;
            border-radius: 4px;
            border-left: 3px solid var(--tm-info-border);
        }
        
        .tm-rule-applied {
            font-size: 12px;
            color: var(--tm-success-color);
            font-weight: 500;
        }
        
        /* 时间范围选择器样式 */
        .tm-time-range {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .tm-time-input {
            padding: 4px 8px;
            border: 1px solid var(--tm-input-border);
            border-radius: 4px;
            font-size: 12px;
            width: 140px;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
        }
        
        .tm-time-separator {
            color: var(--tm-secondary-text);
            font-size: 12px;
        }
        
        /* 规则按钮样式 */
        .tm-rule-btn {
            padding: 4px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .tm-rule-btn-primary {
            background: var(--tm-primary-color);
            color: white;
        }
        
        .tm-rule-btn-secondary {
            background: #757575;
            color: white;
        }
        
        .tm-rule-btn-success {
            background: var(--tm-success-color);
            color: white;
        }
        
        .tm-rule-btn-danger {
            background: var(--tm-danger-color);
            color: white;
        }
        
        .tm-rule-btn-add {
            background: var(--tm-info-bg);
            color: var(--tm-primary-color);
            border: 1px dashed var(--tm-primary-color);
        }
        
        /* 新增的筛选工具栏样式 */
        .tm-filter-rule-bar {
            padding: 12px 24px;
            background: linear-gradient(135deg, var(--tm-topbar-grad-start) 0%, var(--tm-topbar-grad-end) 100%);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .tm-rule-display {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .tm-rule-name {
            font-weight: 600;
            font-size: 14px;
        }
        
        .tm-rule-stats {
            font-size: 12px;
            opacity: 0.9;
        }
        
        .tm-filter-active {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4); }
            70% { box-shadow: 0 0 0 5px rgba(66, 133, 244, 0); }
            100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0); }
        }

        /* 浮动的任务管理按钮样式 */
        .tm-fab {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--tm-topbar-grad-start) 0%, var(--tm-topbar-grad-end) 100%);
            color: white;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            z-index: 9999;
            padding: 10px;
        }

        .tm-fab:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }

        .tm-fab:active {
            transform: translateY(0);
            box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
        }

        /* 任务管理器弹窗样式 */
        .tm-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: var(--tm-modal-overlay);
            z-index: 100001;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .tm-modal.tm-modal--mobile {
            align-items: stretch;
            justify-content: stretch;
        }

        .tm-modal.tm-modal--mobile .tm-box {
            width: 100%;
            height: 100%;
            max-width: none;
            max-height: none;
            border-radius: 0;
        }

        .tm-modal.tm-modal--mobile .tm-body {
            max-height: none;
        }

        @media (max-width: 768px) {
            .tm-modal {
                align-items: stretch;
                justify-content: stretch;
            }
            .tm-modal .tm-box {
                width: 100%;
                height: 100%;
                max-width: none;
                max-height: none;
                border-radius: 0;
            }
            .tm-header {
                padding: 12px 14px;
            }
            .tm-body {
                max-height: none;
            }
        }

        /* Tab 模式下的容器样式（非遮罩层） */
        .tm-modal.tm-modal--tab {
            position: relative;
            top: auto;
            left: auto;
            width: 100%;
            height: 100%;
            z-index: auto;
            background: transparent;
            display: block;
        }

        .tm-modal.tm-modal--tab .tm-box {
            width: 100%;
            height: 100%;
            max-width: none;
            max-height: none;
            border-radius: 0;
            box-shadow: none;
        }

        .tm-modal.tm-modal--tab .tm-body {
            max-height: none;
            /* Tab 模式下也需要启用滚动以支持表头固定 */
            overflow-y: auto;
            overflow-x: auto;
        }

        .tm-modal.tm-modal--tab .tm-table th,
        .tm-modal.tm-modal--tab .tm-table thead th {
            /* Tab 模式下启用表头固定 */
            position: -webkit-sticky;
            position: sticky;
            top: 0;
            z-index: 10;
            /* 确保边框在滚动时可见 */
            box-shadow: inset 0 -1px 0 var(--tm-table-border-color);
        }

        .tm-box {
            background: var(--tm-bg-color);
            width: 90%;
            max-width: 95vw;
            max-height: 90vh;
            border-radius: 12px;
            box-shadow: var(--tm-shadow);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            color: var(--tm-text-color);
        }

        .tm-header {
            padding: 20px 24px;
            background: var(--tm-header-bg);
            border-bottom: 1px solid var(--tm-border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }

        .tm-stats {
            font-size: 13px;
            color: var(--tm-secondary-text);
        }

        .tm-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
        }

        .tm-btn-secondary {
            background: var(--tm-bg-color);
            color: var(--tm-text-color);
            border: 1px solid var(--tm-border-color);
        }

        .tm-btn-secondary:hover {
            background: var(--tm-hover-bg);
            border-color: var(--tm-text-color);
        }

        select.tm-btn-secondary {
            background: var(--tm-bg-color) !important;
            color: var(--tm-text-color) !important;
            border: 1px solid var(--tm-border-color) !important;
        }

        .tm-btn-primary {
            background: var(--tm-primary-color);
            color: white;
        }

        .tm-btn-primary:hover {
            opacity: 0.9;
        }

        .tm-btn-success {
            background: var(--tm-success-color);
            color: white;
        }

        .tm-btn-success:hover {
            opacity: 0.9;
        }

        .tm-btn-gray {
            background: #757575;
            color: white;
        }

        .tm-btn-gray:hover {
            background: #616161;
        }

        .tm-btn-danger {
            background: var(--tm-danger-color);
            color: white;
        }

        .tm-btn-danger:hover {
            opacity: 0.9;
        }

        .tm-btn-info {
            background: var(--tm-info-bg);
            color: var(--tm-primary-color);
            border: 1px solid var(--tm-primary-color);
        }

        .tm-btn-info:hover {
            opacity: 0.9;
        }

        .tm-filter-rule-bar {
            padding: 12px 24px;
            background: linear-gradient(135deg, var(--tm-topbar-grad-start) 0%, var(--tm-topbar-grad-end) 100%);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .tm-search-box {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .tm-search-input {
            padding: 6px 12px;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 4px;
            font-size: 13px;
            background: rgba(255,255,255,0.9);
            width: 200px;
            color: #333;
        }

        .tm-search-input:focus {
            outline: none;
            border-color: white;
        }

        .tm-body {
            flex: 1;
            overflow: auto;
            padding: 0;
            /* 允许水平滚动 */
            overflow-x: auto;
            /* 最大高度限制，启用表头冻结 */
            max-height: calc(100vh - 200px);
            position: relative;
            /* 显式设置 overflow-y，确保 sticky 表头生效 */
            overflow-y: auto;
        }

        .tm-body.tm-body--timeline {
            overflow: hidden;
            overflow-x: hidden;
            overflow-y: hidden;
            display: flex;
            flex-direction: column;
        }

        .tm-timeline-split {
            flex: 1;
            display: flex;
            min-height: 0;
            width: 100%;
        }

        .tm-timeline-left {
            flex: 0 0 auto;
            width: 540px;
            min-width: 360px;
            max-width: 900px;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        .tm-timeline-splitter {
            flex: 0 0 auto;
            width: 6px;
            cursor: col-resize;
            background: transparent;
            position: relative;
        }

        .tm-timeline-splitter::before {
            content: '';
            position: absolute;
            top: 0;
            bottom: 0;
            left: 2px;
            width: 2px;
            background: var(--tm-border-color);
            opacity: 0.9;
        }

        .tm-timeline-splitter:hover::before {
            background: var(--tm-primary-color);
            opacity: 1;
        }

        .tm-timeline-left-body {
            flex: 1;
            min-height: 0;
            overflow: auto;
            position: relative;
            scrollbar-width: none;
            -ms-overflow-style: none;
        }

        .tm-timeline-left-body::-webkit-scrollbar {
            width: 0;
            height: 0;
        }

        .tm-timeline-right {
            flex: 1 1 auto;
            min-width: 0;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        .tm-timeline-right-header {
            flex: 0 0 auto;
            overflow: hidden;
            background: var(--tm-table-header-bg);
            height: 44px;
            box-shadow: inset 0 -1px 0 var(--tm-border-color);
        }

        .tm-timeline-right-body {
            flex: 1;
            min-height: 0;
            overflow: auto;
            position: relative;
            background: var(--tm-bg-color);
        }

        .tm-timeline-table-left {
            min-width: 0;
            width: max-content;
            table-layout: fixed;
        }

        .tm-body--timeline .tm-timeline-table-left {
            border-collapse: separate;
            border-spacing: 0;
        }

        .tm-body--timeline .tm-timeline-table-left thead th {
            height: 44px;
            padding: 0 4px;
            line-height: 44px;
            vertical-align: middle;
        }

        .tm-body--timeline .tm-timeline-left-body thead th {
            position: sticky;
            top: 0;
            z-index: 6;
            background: var(--tm-table-header-bg);
            box-shadow: inset 0 -1px 0 var(--tm-border-color);
        }

        .tm-timeline-row td {
            height: var(--tm-row-height);
            max-height: var(--tm-row-height);
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            padding: 0 6px;
            box-sizing: border-box;
        }

        .tm-body--timeline .tm-cell-editable {
            white-space: nowrap;
            word-break: keep-all;
        }

        .tm-body--timeline .tm-task-cell {
            height: var(--tm-row-height);
            max-height: var(--tm-row-height);
            overflow: hidden;
            align-items: center;
            padding-top: 0;
            padding-bottom: 0;
        }

        .tm-body--timeline .tm-task-text,
        .tm-body--timeline .tm-task-content-clickable {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .tm-body--timeline .tm-group-row td {
            height: var(--tm-row-height);
            max-height: var(--tm-row-height);
            padding: 0 12px;
            line-height: var(--tm-row-height);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .tm-gantt-header-inner {
            display: flex;
            flex-direction: column;
            user-select: none;
        }

        .tm-gantt-month-row,
        .tm-gantt-day-row {
            display: flex;
            flex-direction: row;
        }

        .tm-gantt-month {
            height: 20px;
            line-height: 20px;
            font-size: 12px;
            padding-left: 6px;
            box-sizing: border-box;
            border-right: 1px solid var(--tm-border-color);
            color: var(--tm-text-color);
            opacity: 0.9;
        }

        .tm-gantt-day {
            height: 24px;
            line-height: 24px;
            font-size: 12px;
            text-align: center;
            box-sizing: border-box;
            border-right: 1px solid var(--tm-border-color);
            color: var(--tm-text-color);
            opacity: 0.9;
        }

        .tm-gantt-day--weekend {
            background: var(--tm-hover-bg);
        }

        .tm-gantt-day--month-start {
            border-left: 2px solid var(--tm-border-color);
        }

        .tm-gantt-body-inner {
            position: relative;
        }

        .tm-gantt-row {
            position: relative;
            height: var(--tm-row-height);
            box-sizing: border-box;
            border-bottom: 1px solid var(--tm-border-color);
        }

        .tm-gantt-row--group {
            background: var(--tm-header-bg);
        }

        .tm-gantt-today {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 2px;
            background: rgba(255, 82, 82, 0.55);
            pointer-events: none;
            z-index: 7;
        }

        .tm-gantt-bar {
            position: absolute;
            top: calc((var(--tm-row-height) - var(--tm-gantt-bar-height)) / 2);
            height: var(--tm-gantt-bar-height);
            background: var(--tm-primary-color);
            border-radius: calc(var(--tm-gantt-bar-height) / 2);
            box-shadow: 0 1px 2px rgba(0,0,0,0.18);
            cursor: grab;
            z-index: 4;
        }

        .tm-gantt-bar:active {
            cursor: grabbing;
        }

        .tm-gantt-bar-handle {
            position: absolute;
            top: 0;
            width: 10px;
            height: 100%;
            background: rgba(255,255,255,0.35);
            cursor: ew-resize;
        }

        .tm-gantt-bar-handle--start {
            left: 0;
            border-top-left-radius: 9px;
            border-bottom-left-radius: 9px;
        }

        .tm-gantt-bar-handle--end {
            right: 0;
            border-top-right-radius: 9px;
            border-bottom-right-radius: 9px;
        }

        .tm-gantt-drag-tip {
            position: fixed;
            z-index: 1000002;
            padding: 6px 10px;
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.78);
            color: #fff;
            font-size: 12px;
            line-height: 1;
            pointer-events: none;
            transform: translate(10px, -18px);
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
        }

        .tm-table {
            width: max-content;
            border-collapse: collapse;
            font-size: var(--tm-font-size);
            /* 最小宽度，确保在窄屏下可以横向滚动 */
            min-width: 800px;
            /* 固定表格布局，确保表头和单元格宽度一致 */
            table-layout: fixed;
        }

        .tm-table th {
            background: var(--tm-table-header-bg);
            padding: 4px 4px;
            text-align: left;
            font-weight: 600;
            color: var(--tm-text-color);
            /* 使用 box-shadow 替代 border-bottom，确保滚动时边框始终可见 */
            border-bottom: none;
            box-shadow: inset 0 -1px 0 var(--tm-table-border-color);
            /* 添加右侧列分隔线 */
            border-right: 1px solid var(--tm-table-border-color);
            /* 表头固定 */
            position: -webkit-sticky; /* Safari 浏览器 */
            position: sticky;
            top: 0;
            z-index: 10;
            /* 确保背景不透明，防止滚动时透视 */
            background-clip: padding-box;
            /* 表头文本截断样式：缩窄列时直接截断文本 */
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: clip !important;
        }

        .tm-table thead th {
            /* 使用 box-shadow 确保边框在滚动时始终可见 */
            box-shadow: inset 0 -1px 0 var(--tm-table-border-color);
            position: sticky;
            top: 0;
            z-index: 20;
            /* 最后一列不显示右侧边框 */
            border-right: 1px solid var(--tm-table-border-color);
        }
        
        /* 最后一列不显示右侧边框 */
        .tm-table th:last-child,
        .tm-table td:last-child {
            border-right: none;
        }

        /* 悬停时用浏览器原生提示条显示完整文本，不改变布局 */
        .tm-table th:hover {
            /* 保持截断样式不变，仅依赖title属性显示完整文本 */
        }

        /* 确保表头不受 .tm-cell-editable 影响 */
        .tm-table th.tm-cell-editable {
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: clip !important;
            word-break: normal !important;
        }

        .tm-table td {
            padding: 6px 6px;
            border-bottom: 1px solid var(--tm-table-border-color);
            border-right: 1px solid var(--tm-table-border-color);
            vertical-align: middle;
            color: var(--tm-text-color);
        }

        .tm-table td.tm-cell-empty {
            background: var(--tm-empty-cell-bg);
            color: var(--tm-secondary-text);
        }

        .tm-table tr:hover {
            background: var(--tm-hover-bg);
        }

        .tm-table tr.tm-timer-dim {
            opacity: 0.28;
        }

        .tm-table tr.tm-timer-focus {
            opacity: 1;
            background: rgba(66, 133, 244, 0.12);
            box-shadow: inset 0 0 0 2px var(--tm-primary-color);
        }

        .tm-table tr.tm-timer-focus:hover {
            background: rgba(66, 133, 244, 0.16);
        }

        /* 列宽调整手柄 */
        .tm-col-resize {
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: 6px;
            cursor: col-resize;
            background: transparent;
            transition: background 0.2s;
        }

        .tm-col-resize:hover,
        .tm-col-resize:active {
            background: #3498db;
        }

        th[data-col] {
            position: relative;
            user-select: none;
        }

        .tm-task-done {
            text-decoration: line-through;
            color: var(--tm-task-done-color);
        }

        .tm-block-highlight {
            outline: 2px solid var(--tm-primary-color);
            background: rgba(66, 133, 244, 0.12);
        }

        .tm-task-cell {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
            padding-top: 2px;
            padding-bottom: 2px;
        }

        .tm-task-text {
            flex: 1 1 auto;
            min-width: 0;
            display: block;
            overflow: hidden;
            white-space: normal;
            word-break: break-all;
            line-height: 1.5;
        }

        .tm-task-text:not(.tm-task-done) {
            color: var(--tm-task-content-color);
        }

        /* 顶层任务字体加粗 */
        .tm-task-text[data-level="0"] {
            font-weight: 600;
        }

        .tm-task-content-clickable {
            cursor: pointer;
            transition: color 0.2s;
        }
        
        .tm-task-content-clickable:hover {
            color: var(--tm-primary-color);
            text-decoration: underline;
        }

        .tm-tree-toggle {
            width: 14px;
            height: 14px;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            user-select: none;
            color: var(--tm-secondary-text);
            flex-shrink: 0;
            vertical-align: middle;
            margin-top: -3px;
        }

        .tm-tree-spacer {
            width: 14px;
            height: 14px;
            display: inline-flex;
            flex-shrink: 0;
            margin-top: calc((1.5em - 14px) / 2);
        }

        .tm-task-checkbox {
            width: 14px;
            height: 14px;
            margin: 0;
            flex-shrink: 0;
        }

        .tm-priority-high {
            color: var(--tm-danger-color) !important;
            font-weight: 600;
        }

        .tm-priority-medium {
            color: #f9ab00 !important;
            font-weight: 600;
        }

        .tm-priority-low {
            color: var(--tm-primary-color) !important;
            font-weight: 600;
        }

        .tm-priority-none {
            color: var(--tm-task-done-color) !important;
        }

        .tm-hint {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            z-index: 100003;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }

        /* 提示框样式 */
        .tm-prompt-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: var(--tm-modal-overlay);
            z-index: 100003;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .tm-prompt-box {
            background: var(--tm-bg-color);
            padding: 24px;
            border-radius: 12px;
            box-shadow: var(--tm-shadow);
            min-width: 350px;
            color: var(--tm-text-color);
        }

        .tm-prompt-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--tm-text-color);
            margin-bottom: 16px;
        }

        .tm-prompt-input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--tm-input-border);
            border-radius: 6px;
            font-size: 14px;
            margin-bottom: 16px;
            box-sizing: border-box;
            background: var(--tm-input-bg);
            color: var(--tm-text-color);
        }

        .tm-prompt-input:focus {
            border-color: var(--tm-primary-color);
            outline: none;
        }

        .tm-prompt-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .tm-prompt-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }

        .tm-prompt-btn-primary {
            background: var(--tm-primary-color);
            color: white;
        }

        .tm-prompt-btn-secondary {
            background: #757575;
            color: white;
        }

        /* 设置弹窗样式 */
        .tm-settings-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: var(--tm-modal-overlay);
            z-index: 100002;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .tm-settings-box {
            background: var(--tm-bg-color);
            width: 600px;
            max-width: 90vw;
            max-height: 80vh;
            border-radius: 12px;
            box-shadow: var(--tm-shadow);
            padding: 24px;
            display: flex;
            flex-direction: column;
            color: var(--tm-text-color);
        }

        .tm-settings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .tm-settings-title {
            font-size: 20px;
            font-weight: 600;
            color: var(--tm-text-color);
        }

        .tm-doc-list {
            flex: 1;
            overflow-y: auto;
            border: 1px solid var(--tm-border-color);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            min-height: 100px;
        }

        .tm-doc-item {
            display: flex;
            align-items: center;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 8px;
            background: var(--tm-doc-item-bg);
            transition: all 0.2s;
        }

        .tm-doc-item:hover {
            background: var(--tm-doc-item-hover);
        }

        .tm-doc-item:last-child {
            margin-bottom: 0;
        }

        .tm-doc-checkbox {
            margin-right: 12px;
            width: 18px;
            height: 18px;
            cursor: pointer;
        }

        .tm-doc-info {
            flex: 1;
        }

        .tm-doc-name {
            font-weight: 500;
            color: var(--tm-text-color);
            margin-bottom: 2px;
        }

        .tm-doc-path {
            font-size: 12px;
            color: var(--tm-secondary-text);
        }

        .tm-doc-count {
            font-size: 12px;
            color: var(--tm-doc-count-color);
            background: var(--tm-doc-count-bg);
            padding: 2px 8px;
            border-radius: 10px;
        }

        .tm-settings-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding-top: 16px;
            border-top: 1px solid var(--tm-border-color);
            margin-top: auto;
            flex-shrink: 0;
        }
    `;
    document.head.appendChild(__tmStyleEl);

    // 本地存储（用于快速读取和云端同步失败时的备用）
    // 主存储使用云端文件（/data/storage/ 目录）
    const Storage = {
        get(key, defaultValue) {
            try {
                const value = localStorage.getItem(key);
                return value !== null ? JSON.parse(value) : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {}
        },
        clear() {
            try {
                localStorage.clear();
            } catch (e) {}
        }
    };

    const PLUGIN_STORAGE_DIR = '/data/storage/petal/siyuan-plugin-task-horizon';
    const META_FILE_PATH = `${PLUGIN_STORAGE_DIR}/task-meta.json`;
    const SETTINGS_FILE_PATH = `${PLUGIN_STORAGE_DIR}/task-settings.json`;

    const MetaStore = {
        data: Storage.get('tm_meta_cache', {}) || {},
        loaded: false,
        saving: false,
        saveTimer: null,

        async load() {
            if (this.loaded) return;

            // 从云端加载元数据（优先）
            try {
                const res = await fetch('/api/file/getFile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: META_FILE_PATH }),
                });

                if (res.ok) {
                    const text = await res.text();
                    // 如果文件内容有效
                    if (text && text.trim() !== '') {
                        try {
                            const json = JSON.parse(text);
                            if (json && typeof json === 'object' && Object.keys(json).length > 0) {
                                this.data = json;
                                Storage.set('tm_meta_cache', this.data);
                                this.loaded = true;
                                return;
                            }
                        } catch (parseError) {
                        }
                    }
                }
            } catch (e) {
            }

            // 云端没有数据，使用本地缓存（已在初始化时加载）
            this.loaded = true;
        },

        get(id) {
            if (!id) return null;
            const v = this.data?.[id];
            return v && typeof v === 'object' ? v : null;
        },

        applyToTask(task) {
            const v = this.get(task?.id);
            if (!v) return;
            // 优先使用 MetaStore 的值（非空字符串、非 'null'、非 undefined）
            // 排除 'null' 字符串（SQL 查询返回的 null 会被转成字符串 'null'）
            const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';

            if ('priority' in v && isValidValue(v.priority)) task.priority = v.priority;
            if ('pinned' in v && isValidValue(v.pinned)) task.pinned = v.pinned;
            if ('duration' in v && isValidValue(v.duration)) task.duration = v.duration;
            if ('remark' in v && isValidValue(v.remark)) task.remark = v.remark;
            if ('completionTime' in v && isValidValue(v.completionTime)) task.completionTime = v.completionTime;
            if ('customTime' in v && isValidValue(v.customTime)) task.customTime = v.customTime;
            if ('customStatus' in v && isValidValue(v.customStatus)) task.customStatus = v.customStatus;
        },

        mergeFromTaskIfMissing(task) {
            if (!task?.id) return;
            const existing = this.get(task.id);
            if (existing) return;
            const candidate = {};
            if (task.priority) candidate.priority = task.priority;
            if (task.pinned !== undefined) candidate.pinned = task.pinned;
            if (task.duration) candidate.duration = task.duration;
            if (task.remark) candidate.remark = task.remark;
            if (task.completionTime) candidate.completionTime = task.completionTime;
            if (task.customTime) candidate.customTime = task.customTime;
            if (task.customStatus) candidate.customStatus = task.customStatus;
            if (Object.keys(candidate).length === 0) return;
            this.data[task.id] = candidate;
            this.scheduleSave();
        },

        set(id, patch) {
            if (!id) return;
            if (!this.data || typeof this.data !== 'object') this.data = {};
            const prev = (this.data[id] && typeof this.data[id] === 'object') ? this.data[id] : {};
            this.data[id] = { ...prev, ...(patch || {}) };
            this.scheduleSave();
        },

        remapId(oldId, newId) {
            if (!oldId || !newId || oldId === newId) return;
            if (!this.data || typeof this.data !== 'object') this.data = {};
            if (this.data[oldId] && !this.data[newId]) {
                this.data[newId] = this.data[oldId];
            }
            if (this.data[oldId]) delete this.data[oldId];
            this.scheduleSave();
        },

        scheduleSave() {
            try {
                if (this.saveTimer) clearTimeout(this.saveTimer);
            } catch (e) {}
            this.saveTimer = setTimeout(() => {
                this.saveTimer = null;
                this.saveNow();
            }, 500);
        },

        async saveNow() {
            if (this.saving) return;
            this.saving = true;
            try {
                Storage.set('tm_meta_cache', this.data || {});
                const formDir = new FormData();
                formDir.append('path', PLUGIN_STORAGE_DIR);
                formDir.append('isDir', 'true');
                await fetch('/api/file/putFile', { method: 'POST', body: formDir }).catch(() => null);

                const form = new FormData();
                form.append('path', META_FILE_PATH);
                form.append('isDir', 'false');
                form.append('file', new Blob([JSON.stringify(this.data || {}, null, 2)], { type: 'application/json' }));
                await fetch('/api/file/putFile', { method: 'POST', body: form });
            } catch (e) {} finally {
                this.saving = false;
            }
        }
    };

    // 设置存储（使用云端同步存储，支持跨设备同步）
    const SettingsStore = {
        data: {
            selectedDocIds: [],
            queryLimit: 500,
            groupByDocName: true,
            groupByTime: false,
            groupMode: 'doc',
            collapsedTaskIds: [],
            currentRule: null,
            filterRules: [],
            fontSize: 14,
            fontSizeMobile: 14,
            enableQuickbar: true,
            pinNewTasksByDefault: false,
            newTaskDocId: '',
            enableTomatoIntegration: true,
            tomatoSpentAttrMode: 'minutes',
            tomatoSpentAttrKeyMinutes: 'custom-tomato-minutes',
            tomatoSpentAttrKeyHours: 'custom-tomato-time',
            defaultDocId: '',
            defaultDocIdByGroup: {},
            // 默认状态选项
            customStatusOptions: [
                { id: 'todo', name: '待办', color: '#757575' },
                { id: 'in_progress', name: '进行中', color: '#2196F3' },
                { id: 'done', name: '已完成', color: '#4CAF50' },
                { id: 'blocked', name: '阻塞', color: '#F44336' },
                { id: 'review', name: '待审核', color: '#FF9800' }
            ],
            // 文档分组配置
            // 结构: [{ id: 'uuid', name: '分组名', docs: [{ id: 'docId', recursive: boolean }] }]
            docGroups: [],
            // 当前选中的分组ID (UI显示用)
            currentGroupId: 'all', 
            // 任务标题级别 (h1-h6)
            taskHeadingLevel: 'h2',
            // 时长显示格式: 'hours' 或 'minutes'
            durationFormat: 'hours',
            // 不查找已完成任务（提升性能）
            excludeCompletedTasks: true,
            // 开始日期（新增列）
            startDate: 90,
            // 时间轴模式左侧宽度
            timelineLeftWidth: 540,
            // 时间轴模式任务内容列宽度（不影响表格视图）
            timelineContentWidth: 360,
            // 外观配色（支持亮/暗）
            topbarGradientLightStart: '#667eea',
            topbarGradientLightEnd: '#764ba2',
            topbarGradientDarkStart: '#3b49b7',
            topbarGradientDarkEnd: '#5b2d7a',
            taskContentColorLight: '#333333',
            taskContentColorDark: '#e0e0e0',
            groupDocLabelColorLight: '#333333',
            groupDocLabelColorDark: '#e0e0e0',
            timeGroupBaseColorLight: '#1a73e8',
            timeGroupBaseColorDark: '#6ba5ff',
            timeGroupOverdueColorLight: '#d93025',
            timeGroupOverdueColorDark: '#ff6b6b',
            progressBarColorLight: '#4caf50',
            progressBarColorDark: '#81c784',
            tableBorderColorLight: '#e9ecef',
            tableBorderColorDark: '#333333',
            priorityScoreConfig: {
                base: 100,
                weights: { importance: 1, status: 1, due: 1, duration: 1, doc: 1 },
                importanceDelta: { high: 20, medium: 10, low: -5, none: 0 },
                statusDelta: { todo: 0, in_progress: 15, done: -80, blocked: -10, review: 5 },
                dueRanges: [
                    { days: 0, delta: 20 },
                    { days: 1, delta: 15 },
                    { days: 3, delta: 10 },
                    { days: 7, delta: 5 },
                    { days: 30, delta: 0 }
                ],
                durationBuckets: [
                    { maxMinutes: 15, delta: 10 },
                    { maxMinutes: 60, delta: 0 },
                    { maxMinutes: 240, delta: -5 },
                    { maxMinutes: 999999, delta: -10 }
                ],
                docDeltas: {}
            },
            // 四象限分组配置
            quadrantConfig: {
                enabled: false,
                rules: [
                    {
                        id: 'urgent-important',
                        name: '重要紧急',
                        color: 'red',
                        importance: ['high', 'medium'],
                        timeRanges: ['overdue', 'within7days']
                    },
                    {
                        id: 'not-urgent-important',
                        name: '重要不紧急',
                        color: 'yellow',
                        importance: ['high', 'medium'],
                        timeRanges: ['beyond7days', 'nodate']
                    },
                    {
                        id: 'urgent-not-important',
                        name: '不重要紧急',
                        color: 'blue',
                        importance: ['low', 'none'],
                        timeRanges: ['overdue', 'within7days']
                    },
                    {
                        id: 'not-urgent-not-important',
                        name: '不重要不紧急',
                        color: 'green',
                        importance: ['low', 'none'],
                        timeRanges: ['beyond7days', 'nodate']
                    }
                ]
            },
            // 列宽度设置（像素）
            columnWidths: {
                pinned: 48,             // 置顶
                content: 360,           // 任务内容
                status: 96,             // 状态
                score: 96,              // 优先级
                doc: 180,               // 文档
                h2: 180,                // 二级标题
                priority: 96,           // 重要性
                completionTime: 170,    // 完成时间
                startDate: 90,           // 开始日期
                duration: 96,           // 时长
                spent: 96,              // 耗时
                remark: 240             // 备注
            },
            // 列顺序设置（注意：startDate 在 completionTime 前面）
            columnOrder: ['pinned', 'content', 'status', 'score', 'doc', 'h2', 'priority', 'startDate', 'completionTime', 'duration', 'spent', 'remark']
        },
        loaded: false,
        saving: false,
        saveTimer: null,
        saveDirty: false,
        savePromise: null,
        savePromiseResolve: null,

        async load() {
            if (this.loaded) return;

            // 先从本地缓存加载一份作为兜底（避免云端旧版本配置缺字段导致覆盖丢失）
            // 云端数据存在时，再用云端字段覆盖本地字段
            try { this.loadFromLocal(); } catch (e) {}

            // 从云端加载设置（优先）
            try {
                const res = await fetch('/api/file/getFile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: SETTINGS_FILE_PATH }),
                });

                if (res.ok) {
                    const text = await res.text();
                    // 如果文件内容有效且有数据
                    if (text && text.trim() !== '') {
                        try {
                            const cloudData = JSON.parse(text);
                            if (cloudData && typeof cloudData === 'object' && Object.keys(cloudData).length > 0) {
                                // 应用云端数据
                                if (Array.isArray(cloudData.selectedDocIds)) this.data.selectedDocIds = cloudData.selectedDocIds;
                                if (typeof cloudData.queryLimit === 'number') this.data.queryLimit = cloudData.queryLimit;
                                if (typeof cloudData.groupByDocName === 'boolean') this.data.groupByDocName = cloudData.groupByDocName;
                                if (typeof cloudData.groupByTime === 'boolean') this.data.groupByTime = cloudData.groupByTime;
                                if (typeof cloudData.groupMode === 'string') this.data.groupMode = cloudData.groupMode;
                                if (Array.isArray(cloudData.collapsedTaskIds)) this.data.collapsedTaskIds = cloudData.collapsedTaskIds;
                                if (Array.isArray(cloudData.collapsedGroups)) this.data.collapsedGroups = cloudData.collapsedGroups;
                                if (cloudData.currentRule !== undefined) this.data.currentRule = cloudData.currentRule;
                                if (Array.isArray(cloudData.filterRules)) this.data.filterRules = cloudData.filterRules;
                                if (typeof cloudData.fontSize === 'number') this.data.fontSize = cloudData.fontSize;
                                if (typeof cloudData.fontSizeMobile === 'number') this.data.fontSizeMobile = cloudData.fontSizeMobile;
                                if (typeof cloudData.enableQuickbar === 'boolean') this.data.enableQuickbar = cloudData.enableQuickbar;
                                if (typeof cloudData.pinNewTasksByDefault === 'boolean') this.data.pinNewTasksByDefault = cloudData.pinNewTasksByDefault;
                                if (typeof cloudData.newTaskDocId === 'string') this.data.newTaskDocId = cloudData.newTaskDocId;
                                if (typeof cloudData.enableTomatoIntegration === 'boolean') this.data.enableTomatoIntegration = cloudData.enableTomatoIntegration;
                                if (typeof cloudData.tomatoSpentAttrMode === 'string') this.data.tomatoSpentAttrMode = cloudData.tomatoSpentAttrMode;
                                if (typeof cloudData.tomatoSpentAttrKeyMinutes === 'string') this.data.tomatoSpentAttrKeyMinutes = cloudData.tomatoSpentAttrKeyMinutes;
                                if (typeof cloudData.tomatoSpentAttrKeyHours === 'string') this.data.tomatoSpentAttrKeyHours = cloudData.tomatoSpentAttrKeyHours;
                                if (typeof cloudData.defaultDocId === 'string') this.data.defaultDocId = cloudData.defaultDocId;
                                if (cloudData.defaultDocIdByGroup && typeof cloudData.defaultDocIdByGroup === 'object') this.data.defaultDocIdByGroup = cloudData.defaultDocIdByGroup;
                                if (cloudData.priorityScoreConfig && typeof cloudData.priorityScoreConfig === 'object') this.data.priorityScoreConfig = cloudData.priorityScoreConfig;
                                if (cloudData.quadrantConfig && typeof cloudData.quadrantConfig === 'object') this.data.quadrantConfig = cloudData.quadrantConfig;
                                if (Array.isArray(cloudData.docGroups)) this.data.docGroups = cloudData.docGroups;
                                if (cloudData.currentGroupId) this.data.currentGroupId = cloudData.currentGroupId;
                                if (cloudData.taskHeadingLevel) this.data.taskHeadingLevel = cloudData.taskHeadingLevel;
                                if (typeof cloudData.topbarGradientLightStart === 'string') this.data.topbarGradientLightStart = cloudData.topbarGradientLightStart;
                                if (typeof cloudData.topbarGradientLightEnd === 'string') this.data.topbarGradientLightEnd = cloudData.topbarGradientLightEnd;
                                if (typeof cloudData.topbarGradientDarkStart === 'string') this.data.topbarGradientDarkStart = cloudData.topbarGradientDarkStart;
                                if (typeof cloudData.topbarGradientDarkEnd === 'string') this.data.topbarGradientDarkEnd = cloudData.topbarGradientDarkEnd;
                                if (typeof cloudData.taskContentColorLight === 'string') this.data.taskContentColorLight = cloudData.taskContentColorLight;
                                if (typeof cloudData.taskContentColorDark === 'string') this.data.taskContentColorDark = cloudData.taskContentColorDark;
                                if (typeof cloudData.groupDocLabelColorLight === 'string') this.data.groupDocLabelColorLight = cloudData.groupDocLabelColorLight;
                                if (typeof cloudData.groupDocLabelColorDark === 'string') this.data.groupDocLabelColorDark = cloudData.groupDocLabelColorDark;
                                if (typeof cloudData.timeGroupBaseColorLight === 'string') this.data.timeGroupBaseColorLight = cloudData.timeGroupBaseColorLight;
                                if (typeof cloudData.timeGroupBaseColorDark === 'string') this.data.timeGroupBaseColorDark = cloudData.timeGroupBaseColorDark;
                                if (typeof cloudData.timeGroupOverdueColorLight === 'string') this.data.timeGroupOverdueColorLight = cloudData.timeGroupOverdueColorLight;
                                if (typeof cloudData.timeGroupOverdueColorDark === 'string') this.data.timeGroupOverdueColorDark = cloudData.timeGroupOverdueColorDark;
                                if (typeof cloudData.progressBarColorLight === 'string') this.data.progressBarColorLight = cloudData.progressBarColorLight;
                                if (typeof cloudData.progressBarColorDark === 'string') this.data.progressBarColorDark = cloudData.progressBarColorDark;
                                if (typeof cloudData.tableBorderColorLight === 'string') this.data.tableBorderColorLight = cloudData.tableBorderColorLight;
                                if (typeof cloudData.tableBorderColorDark === 'string') this.data.tableBorderColorDark = cloudData.tableBorderColorDark;
                                if (Array.isArray(cloudData.customStatusOptions)) this.data.customStatusOptions = cloudData.customStatusOptions;
                                if (cloudData.columnWidths && typeof cloudData.columnWidths === 'object') {
                                    // 旧版本兼容：如果有 customTime 配置，迁移到 completionTime
                                    if (cloudData.columnWidths.customTime && !cloudData.columnWidths.completionTime) {
                                        cloudData.columnWidths.completionTime = cloudData.columnWidths.customTime;
                                    }
                                    this.data.columnWidths = { ...this.data.columnWidths, ...cloudData.columnWidths };
                                }
                                if (Array.isArray(cloudData.columnOrder)) this.data.columnOrder = cloudData.columnOrder;
                                
                                // 新增字段处理
                                if (typeof cloudData.durationFormat === 'string') this.data.durationFormat = cloudData.durationFormat;
                                if (typeof cloudData.excludeCompletedTasks === 'boolean') this.data.excludeCompletedTasks = cloudData.excludeCompletedTasks;
                                if (typeof cloudData.startDate === 'number') this.data.startDate = cloudData.startDate;
                                if (typeof cloudData.timelineLeftWidth === 'number') this.data.timelineLeftWidth = cloudData.timelineLeftWidth;
                                if (typeof cloudData.timelineContentWidth === 'number') this.data.timelineContentWidth = cloudData.timelineContentWidth;

                                const validModes = new Set(['none', 'doc', 'time', 'quadrant']);
                                if (!validModes.has(String(this.data.groupMode || ''))) {
                                    const q = !!(this.data.quadrantConfig && this.data.quadrantConfig.enabled);
                                    this.data.groupMode = q ? 'quadrant' : (this.data.groupByTime ? 'time' : (this.data.groupByDocName ? 'doc' : 'none'));
                                }
                                if (this.data.groupMode === 'doc') {
                                    this.data.groupByDocName = true;
                                    this.data.groupByTime = false;
                                    this.data.quadrantConfig = this.data.quadrantConfig || {};
                                    this.data.quadrantConfig.enabled = false;
                                } else if (this.data.groupMode === 'time') {
                                    this.data.groupByDocName = false;
                                    this.data.groupByTime = true;
                                    this.data.quadrantConfig = this.data.quadrantConfig || {};
                                    this.data.quadrantConfig.enabled = false;
                                } else if (this.data.groupMode === 'quadrant') {
                                    this.data.groupByDocName = false;
                                    this.data.groupByTime = false;
                                    this.data.quadrantConfig = this.data.quadrantConfig || {};
                                    this.data.quadrantConfig.enabled = true;
                                } else {
                                    this.data.groupByDocName = false;
                                    this.data.groupByTime = false;
                                    this.data.quadrantConfig = this.data.quadrantConfig || {};
                                    this.data.quadrantConfig.enabled = false;
                                    this.data.groupMode = 'none';
                                }

                                // 同步到本地缓存
                                this.normalizeColumns();
                                this.syncToLocal();
                                this.loaded = true;
                                return;
                            }
                        } catch (parseError) {
                        }
                    }
                }
            } catch (e) {
            }
            this.loaded = true;
        },

        // 从本地缓存加载
        loadFromLocal() {
            this.data.selectedDocIds = Storage.get('tm_selected_doc_ids', []) || [];
            this.data.queryLimit = Storage.get('tm_query_limit', 500);
            this.data.groupByDocName = Storage.get('tm_group_by_docname', true);
            this.data.groupByTime = Storage.get('tm_group_by_time', false);
            this.data.groupMode = Storage.get('tm_group_mode', this.data.groupMode);
            this.data.collapsedTaskIds = Storage.get('tm_collapsed_task_ids', []) || [];
            this.data.collapsedGroups = Storage.get('tm_collapsed_groups', []) || [];
            this.data.currentRule = Storage.get('tm_current_rule', null);
            this.data.filterRules = Storage.get('tm_filter_rules', []);
            this.data.fontSize = Storage.get('tm_font_size', 14);
            this.data.fontSizeMobile = Storage.get('tm_font_size_mobile', this.data.fontSize);
            this.data.topbarGradientLightStart = Storage.get('tm_topbar_gradient_light_start', this.data.topbarGradientLightStart);
            this.data.topbarGradientLightEnd = Storage.get('tm_topbar_gradient_light_end', this.data.topbarGradientLightEnd);
            this.data.topbarGradientDarkStart = Storage.get('tm_topbar_gradient_dark_start', this.data.topbarGradientDarkStart);
            this.data.topbarGradientDarkEnd = Storage.get('tm_topbar_gradient_dark_end', this.data.topbarGradientDarkEnd);
            this.data.taskContentColorLight = Storage.get('tm_task_content_color_light', this.data.taskContentColorLight);
            this.data.taskContentColorDark = Storage.get('tm_task_content_color_dark', this.data.taskContentColorDark);
            this.data.groupDocLabelColorLight = Storage.get('tm_group_doc_label_color_light', this.data.groupDocLabelColorLight);
            this.data.groupDocLabelColorDark = Storage.get('tm_group_doc_label_color_dark', this.data.groupDocLabelColorDark);
            this.data.timeGroupBaseColorLight = Storage.get('tm_time_group_base_color_light', this.data.timeGroupBaseColorLight);
            this.data.timeGroupBaseColorDark = Storage.get('tm_time_group_base_color_dark', this.data.timeGroupBaseColorDark);
            this.data.timeGroupOverdueColorLight = Storage.get('tm_time_group_overdue_color_light', this.data.timeGroupOverdueColorLight);
            this.data.timeGroupOverdueColorDark = Storage.get('tm_time_group_overdue_color_dark', this.data.timeGroupOverdueColorDark);
            this.data.progressBarColorLight = Storage.get('tm_progress_bar_color_light', this.data.progressBarColorLight);
            this.data.progressBarColorDark = Storage.get('tm_progress_bar_color_dark', this.data.progressBarColorDark);
            this.data.tableBorderColorLight = Storage.get('tm_table_border_color_light', this.data.tableBorderColorLight);
            this.data.tableBorderColorDark = Storage.get('tm_table_border_color_dark', this.data.tableBorderColorDark);
            this.data.enableQuickbar = Storage.get('tm_enable_quickbar', true);
            this.data.pinNewTasksByDefault = Storage.get('tm_pin_new_tasks_by_default', false);
            this.data.newTaskDocId = Storage.get('tm_new_task_doc_id', '');
            this.data.enableTomatoIntegration = Storage.get('tm_enable_tomato_integration', true);
            this.data.tomatoSpentAttrMode = Storage.get('tm_tomato_spent_attr_mode', 'minutes');
            this.data.tomatoSpentAttrKeyMinutes = Storage.get('tm_tomato_spent_attr_key_minutes', this.data.tomatoSpentAttrKeyMinutes);
            this.data.tomatoSpentAttrKeyHours = Storage.get('tm_tomato_spent_attr_key_hours', this.data.tomatoSpentAttrKeyHours);
            this.data.defaultDocId = Storage.get('tm_default_doc_id', '');
            this.data.defaultDocIdByGroup = Storage.get('tm_default_doc_id_by_group', {}) || {};
            this.data.priorityScoreConfig = Storage.get('tm_priority_score_config', this.data.priorityScoreConfig) || this.data.priorityScoreConfig;
            this.data.quadrantConfig = Storage.get('tm_quadrant_config', this.data.quadrantConfig);
            this.data.docGroups = Storage.get('tm_doc_groups', []);
            this.data.currentGroupId = Storage.get('tm_current_group_id', 'all');
            this.data.customStatusOptions = Storage.get('tm_custom_status_options', this.data.customStatusOptions);
            this.data.columnOrder = Storage.get('tm_column_order', this.data.columnOrder);
            this.data.durationFormat = Storage.get('tm_duration_format', this.data.durationFormat);
            this.data.excludeCompletedTasks = Storage.get('tm_exclude_completed_tasks', this.data.excludeCompletedTasks);
            this.data.startDate = Storage.get('tm_start_date', this.data.startDate);
            this.data.timelineLeftWidth = Storage.get('tm_timeline_left_width', this.data.timelineLeftWidth);
            this.data.timelineContentWidth = Storage.get('tm_timeline_content_width', this.data.timelineContentWidth);
            const savedWidths = Storage.get('tm_column_widths', null);
            if (savedWidths && typeof savedWidths === 'object') {
                if (savedWidths.customTime && !savedWidths.completionTime) {
                    savedWidths.completionTime = savedWidths.customTime;
                }
                this.data.columnWidths = { ...this.data.columnWidths, ...savedWidths };
            }
            const validModes = new Set(['none', 'doc', 'time', 'quadrant']);
            if (!validModes.has(String(this.data.groupMode || ''))) {
                const q = !!(this.data.quadrantConfig && this.data.quadrantConfig.enabled);
                this.data.groupMode = q ? 'quadrant' : (this.data.groupByTime ? 'time' : (this.data.groupByDocName ? 'doc' : 'none'));
            }
            if (this.data.groupMode === 'doc') {
                this.data.groupByDocName = true;
                this.data.groupByTime = false;
                this.data.quadrantConfig = this.data.quadrantConfig || {};
                this.data.quadrantConfig.enabled = false;
            } else if (this.data.groupMode === 'time') {
                this.data.groupByDocName = false;
                this.data.groupByTime = true;
                this.data.quadrantConfig = this.data.quadrantConfig || {};
                this.data.quadrantConfig.enabled = false;
            } else if (this.data.groupMode === 'quadrant') {
                this.data.groupByDocName = false;
                this.data.groupByTime = false;
                this.data.quadrantConfig = this.data.quadrantConfig || {};
                this.data.quadrantConfig.enabled = true;
            } else {
                this.data.groupByDocName = false;
                this.data.groupByTime = false;
                this.data.quadrantConfig = this.data.quadrantConfig || {};
                this.data.quadrantConfig.enabled = false;
                this.data.groupMode = 'none';
            }
            this.normalizeColumns();
        },

        // 同步到本地缓存
        syncToLocal() {
            Storage.set('tm_selected_doc_ids', this.data.selectedDocIds);
            Storage.set('tm_query_limit', this.data.queryLimit);
            Storage.set('tm_group_by_docname', this.data.groupByDocName);
            Storage.set('tm_group_by_time', this.data.groupByTime);
            Storage.set('tm_group_mode', String(this.data.groupMode || '').trim() || 'none');
            Storage.set('tm_collapsed_task_ids', this.data.collapsedTaskIds);
            Storage.set('tm_collapsed_groups', this.data.collapsedGroups || []);
            Storage.set('tm_current_rule', this.data.currentRule);
            Storage.set('tm_filter_rules', this.data.filterRules);
            Storage.set('tm_font_size', this.data.fontSize);
            Storage.set('tm_font_size_mobile', this.data.fontSizeMobile);
            Storage.set('tm_topbar_gradient_light_start', String(this.data.topbarGradientLightStart || '').trim());
            Storage.set('tm_topbar_gradient_light_end', String(this.data.topbarGradientLightEnd || '').trim());
            Storage.set('tm_topbar_gradient_dark_start', String(this.data.topbarGradientDarkStart || '').trim());
            Storage.set('tm_topbar_gradient_dark_end', String(this.data.topbarGradientDarkEnd || '').trim());
            Storage.set('tm_task_content_color_light', String(this.data.taskContentColorLight || '').trim());
            Storage.set('tm_task_content_color_dark', String(this.data.taskContentColorDark || '').trim());
            Storage.set('tm_group_doc_label_color_light', String(this.data.groupDocLabelColorLight || '').trim());
            Storage.set('tm_group_doc_label_color_dark', String(this.data.groupDocLabelColorDark || '').trim());
            Storage.set('tm_time_group_base_color_light', String(this.data.timeGroupBaseColorLight || '').trim());
            Storage.set('tm_time_group_base_color_dark', String(this.data.timeGroupBaseColorDark || '').trim());
            Storage.set('tm_time_group_overdue_color_light', String(this.data.timeGroupOverdueColorLight || '').trim());
            Storage.set('tm_time_group_overdue_color_dark', String(this.data.timeGroupOverdueColorDark || '').trim());
            Storage.set('tm_progress_bar_color_light', String(this.data.progressBarColorLight || '').trim());
            Storage.set('tm_progress_bar_color_dark', String(this.data.progressBarColorDark || '').trim());
            Storage.set('tm_table_border_color_light', String(this.data.tableBorderColorLight || '').trim());
            Storage.set('tm_table_border_color_dark', String(this.data.tableBorderColorDark || '').trim());
            Storage.set('tm_enable_quickbar', !!this.data.enableQuickbar);
            Storage.set('tm_pin_new_tasks_by_default', !!this.data.pinNewTasksByDefault);
            Storage.set('tm_new_task_doc_id', String(this.data.newTaskDocId || '').trim());
            Storage.set('tm_enable_tomato_integration', !!this.data.enableTomatoIntegration);
            Storage.set('tm_tomato_spent_attr_mode', String(this.data.tomatoSpentAttrMode || 'minutes'));
            Storage.set('tm_tomato_spent_attr_key_minutes', String(this.data.tomatoSpentAttrKeyMinutes || '').trim());
            Storage.set('tm_tomato_spent_attr_key_hours', String(this.data.tomatoSpentAttrKeyHours || '').trim());
            Storage.set('tm_default_doc_id', this.data.defaultDocId);
            Storage.set('tm_default_doc_id_by_group', this.data.defaultDocIdByGroup || {});
            Storage.set('tm_priority_score_config', this.data.priorityScoreConfig || {});
            Storage.set('tm_quadrant_config', this.data.quadrantConfig);
            Storage.set('tm_doc_groups', this.data.docGroups);
            Storage.set('tm_current_group_id', this.data.currentGroupId);
            Storage.set('tm_custom_status_options', this.data.customStatusOptions);
            Storage.set('tm_column_widths', this.data.columnWidths);
            Storage.set('tm_column_order', this.data.columnOrder);
            Storage.set('tm_timeline_left_width', this.data.timelineLeftWidth);
            Storage.set('tm_timeline_content_width', this.data.timelineContentWidth);
        },

        normalizeColumns() {
            const defaultOrder = ['pinned', 'content', 'status', 'score', 'doc', 'h2', 'priority', 'startDate', 'completionTime', 'duration', 'spent', 'remark'];
            const known = new Set(defaultOrder);
            if (!Array.isArray(this.data.columnOrder)) this.data.columnOrder = [...defaultOrder];
            this.data.columnOrder = this.data.columnOrder.filter(k => known.has(k));
            if (this.data.columnOrder.length === 0) this.data.columnOrder = [...defaultOrder];

            const percentFallback = { pinned: 5, content: 35, status: 8, score: 8, doc: 12, h2: 12, priority: 8, startDate: 7, completionTime: 18, duration: 8, spent: 8, remark: 19 };
            const pxDefault = { pinned: 48, content: 360, status: 96, score: 96, doc: 180, h2: 180, priority: 96, startDate: 90, completionTime: 170, duration: 96, spent: 96, remark: 240 };

            const widths = (this.data.columnWidths && typeof this.data.columnWidths === 'object') ? { ...this.data.columnWidths } : {};
            const vals = Object.values(widths).filter(v => typeof v === 'number' && Number.isFinite(v));
            const sum = vals.reduce((a, b) => a + b, 0);
            const max = vals.reduce((m, v) => Math.max(m, v), 0);
            const looksPercent = vals.length > 0 && sum <= 160 && max <= 60;
            if (looksPercent) {
                const basePx = 1200;
                defaultOrder.forEach(k => {
                    const pct = Number(widths[k] ?? percentFallback[k] ?? 10);
                    const safePct = Number.isFinite(pct) ? pct : 10;
                    widths[k] = Math.round(basePx * safePct / 100);
                });
            }
            defaultOrder.forEach(k => {
                const raw = Number(widths[k]);
                const d = pxDefault[k] || 120;
                const normalized = Number.isFinite(raw) ? Math.round(raw) : d;
                widths[k] = Math.max(40, Math.min(800, normalized));
            });
            this.data.columnWidths = widths;
        },

        async save() {
            this.syncToLocal();
            this.saveDirty = true;
            try { if (this.saveTimer) clearTimeout(this.saveTimer); } catch (e) {}
            if (!this.savePromise) {
                this.savePromise = new Promise((resolve) => {
                    this.savePromiseResolve = resolve;
                });
            }
            this.saveTimer = setTimeout(() => {
                this.saveTimer = null;
                this.flushSave();
            }, 350);
            return this.savePromise;
        },

        async flushSave() {
            if (this.saving) return;
            if (!this.saveDirty) return;
            this.saving = true;
            this.saveDirty = false;
            try {
                const formData = new FormData();
                formData.append('path', SETTINGS_FILE_PATH);
                formData.append('isDir', 'false');
                formData.append('file', new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' }));

                await fetch('/api/file/putFile', { method: 'POST', body: formData }).catch(() => null);
            } catch (e) {
            } finally {
                this.saving = false;
                if (this.saveDirty) {
                    try { if (this.saveTimer) clearTimeout(this.saveTimer); } catch (e) {}
                    this.saveTimer = setTimeout(() => {
                        this.saveTimer = null;
                        this.flushSave();
                    }, 50);
                    return;
                }
                try { this.savePromiseResolve?.(); } catch (e) {}
                this.savePromise = null;
                this.savePromiseResolve = null;
            }
        },

        // 便捷方法：更新列宽度
        async updateColumnWidth(column, width) {
            if (typeof width === 'number' && width >= 40 && width <= 800) {
                this.data.columnWidths[column] = width;
                await this.save();
            }
        },

        // 便捷方法：更新文档ID列表
        async updateDocIds(docIds) {
            this.data.selectedDocIds = docIds;
            await this.save();
        },

        // 便捷方法：添加文档
        async addDocId(docId) {
            if (!this.data.selectedDocIds.includes(docId)) {
                this.data.selectedDocIds.push(docId);
                await this.save();
            }
        },

        // 便捷方法：移除文档
        async removeDocId(index) {
            if (index >= 0 && index < this.data.selectedDocIds.length) {
                this.data.selectedDocIds.splice(index, 1);
                await this.save();
            }
        },

        // 便捷方法：清空文档
        async clearDocIds() {
            this.data.selectedDocIds = [];
            await this.save();
        },

        // 便捷方法：保存规则
        async saveRules(rules) {
            this.data.filterRules = rules;
            await this.save();
        },

        // 便捷方法：更新文档分组
        async updateDocGroups(groups) {
            this.data.docGroups = groups;
            await this.save();
        },

        // 便捷方法：更新当前分组ID
        async updateCurrentGroupId(groupId) {
            this.data.currentGroupId = groupId;
            await this.save();
        },

        // 便捷方法：更新字体大小
        async updateFontSize(size) {
            this.data.fontSize = size;
            await this.save();
        },
        // 便捷方法：更新移动端字体大小
        async updateFontSizeMobile(size) {
            this.data.fontSizeMobile = size;
            await this.save();
        }
    };

    // 规则管理器
    const RuleManager = {
        // 获取所有规则（优先从 SettingsStore 获取）
        getRules() {
            // 优先从 SettingsStore 获取
            if (SettingsStore.loaded && Array.isArray(SettingsStore.data.filterRules) && SettingsStore.data.filterRules.length > 0) {
                return SettingsStore.data.filterRules;
            }
            // 回退到本地存储
            return Storage.get('tm_filter_rules', []);
        },

        // 保存规则（使用 SettingsStore 保存到云端和本地）
        async saveRules(rules) {
            SettingsStore.data.filterRules = rules;
            await SettingsStore.save();
        },

        // 获取默认规则
        getDefaultRules() {
            return [
                {
                    id: 'default_all',
                    name: '所有任务',
                    enabled: true,
                    conditions: [],
                    sort: [
                        { field: 'priority', order: 'desc' },
                        { field: 'created', order: 'asc' }
                    ]
                },
                {
                    id: 'default_todo',
                    name: '待办任务',
                    enabled: true,
                    conditions: [
                        { field: 'done', operator: '=', value: false }
                    ],
                    sort: [
                        { field: 'priority', order: 'desc' },
                        { field: 'updated', order: 'desc' }
                    ]
                },
                {
                    id: 'default_today',
                    name: '今日任务',
                    enabled: true,
                    conditions: [
                        { field: 'done', operator: '=', value: false },
                        { 
                            field: 'completionTime', 
                            operator: 'range_today',
                            value: { from: '', to: '' }
                        }
                    ],
                    sort: [
                        { field: 'priority', order: 'desc' },
                        { field: 'completionTime', order: 'asc' }
                    ]
                },
                {
                    id: 'high_priority',
                    name: '高优先级',
                    enabled: true,
                    conditions: [
                        { field: 'done', operator: '=', value: false },
                        { field: 'priority', operator: '=', value: 'high' }
                    ],
                    sort: [
                        { field: 'created', order: 'asc' },
                        { field: 'completionTime', order: 'asc' }
                    ]
                }
            ];
        },

        // 初始化规则
        async initRules() {
            const rules = this.getRules();
            if (rules.length === 0) {
                const defaultRules = this.getDefaultRules();
                await this.saveRules(defaultRules);
                return defaultRules;
            }
            return rules;
        },

        // 创建新规则
        createRule(name) {
            return {
                id: 'rule_' + Date.now(),
                name: name || '新规则',
                enabled: true,
                conditions: [],
                sort: [
                    { field: 'priorityScore', order: 'desc' },
                    { field: 'priority', order: 'desc' }
                ]
            };
        },
        
        // 获取可用字段
        getAvailableFields() {
            return [
                { value: 'content', label: '任务内容', type: 'text' },
                { value: 'done', label: '完成状态', type: 'boolean' },
                { value: 'priority', label: '优先级', type: 'select', options: ['high', 'medium', 'low', 'none'] },
                { value: 'priorityScore', label: '优先级数值', type: 'number' },
                { value: 'customStatus', label: '状态', type: 'select' },
                { value: 'completionTime', label: '完成时间', type: 'datetime' },
                { value: 'created', label: '创建时间', type: 'datetime' },
                { value: 'updated', label: '更新时间', type: 'datetime' },
                { value: 'duration', label: '任务时长', type: 'text' },
                { value: 'remark', label: '备注', type: 'text' },
                { value: 'docName', label: '文档名称', type: 'text' },
                { value: 'level', label: '任务层级', type: 'number' }
            ];
        },
        
        // 获取可用操作符
        getOperators(fieldType) {
            const baseOperators = [
                { value: '=', label: '等于' },
                { value: '!=', label: '不等于' },
                { value: 'in', label: '在列表中' },        // 多值匹配
                { value: 'not_in', label: '不在列表中' },  // 多值排除
                { value: 'contains', label: '包含' },
                { value: 'not_contains', label: '不包含' }
            ];
            
            const numberOperators = [
                { value: '>', label: '大于' },
                { value: '<', label: '小于' },
                { value: '>=', label: '大于等于' },
                { value: '<=', label: '小于等于' },
                { value: 'between', label: '介于' }
            ];
            
            const datetimeOperators = [
                { value: 'range_today', label: '今天' },
                { value: 'range_week', label: '本周' },
                { value: 'range_month', label: '本月' },
                { value: 'range_year', label: '今年' },
                { value: 'before', label: '之前' },
                { value: 'after', label: '之后' },
                { value: 'between', label: '介于' }
            ];
            
            switch(fieldType) {
                case 'number':
                    return [...baseOperators, ...numberOperators];
                case 'datetime':
                    return [...baseOperators, ...datetimeOperators];
                case 'boolean':
                    return [
                        { value: '=', label: '是' },
                        { value: '!=', label: '不是' }
                    ];
                default:
                    return baseOperators;
            }
        },
        
        // 获取排序字段
        getSortFields() {
            return [
                { value: 'priorityScore', label: '优先级数值' },
                { value: 'priority', label: '优先级' },
                { value: 'customStatus', label: '状态' },
                { value: 'completionTime', label: '完成时间' },
                { value: 'created', label: '创建时间' },
                { value: 'updated', label: '更新时间' },
                { value: 'content', label: '任务内容' },
                { value: 'docName', label: '文档名称' },
                { value: 'h2', label: (() => {
                    const level = SettingsStore.data.taskHeadingLevel || 'h2';
                    const labels = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
                    return labels[level] || '标题';
                })() },
                { value: 'duration', label: '任务时长' }
            ];
        },
        
        // 应用规则筛选
        applyRuleFilter(tasks, rule) {
            if (!rule || !rule.conditions || rule.conditions.length === 0) {
                return tasks;
            }
            
            return tasks.filter(task => {
                return rule.conditions.every(condition => {
                    return this.evaluateCondition(task, condition);
                });
            });
        },
        
        // 评估单个条件
        evaluateCondition(task, condition) {
            const { field, operator, value } = condition;
            const taskValue = task[field];

            // 处理布尔值
            if (field === 'done') {
                const targetValue = value === true || value === 'true';
                if (operator === '=') return task.done === targetValue;
                if (operator === '!=') return task.done !== targetValue;
            }

            // 处理多值匹配（in / not_in）
            if (operator === 'in' || operator === 'not_in') {
                // value 应该是数组格式 ['high', 'medium', 'low']
                let values = [];
                if (Array.isArray(value)) {
                    values = value;
                } else if (typeof value === 'string' && value.includes(',')) {
                    values = value.split(',').map(v => v.trim());
                } else {
                    values = [value];
                }

                // 空值（无）也作为一个选项
                const hasEmpty = values.includes('') || values.includes('无');
                const nonEmptyValues = values.filter(v => v !== '' && v !== '无');

                const taskMatch = nonEmptyValues.includes(taskValue);
                const hasEmptyMatch = (!taskValue || taskValue === '') && hasEmpty;

                if (operator === 'in') {
                    return taskMatch || hasEmptyMatch;
                } else { // not_in
                    return !taskMatch && !hasEmptyMatch;
                }
            }

            // 处理文本字段
            if (typeof taskValue === 'string') {
                const taskStr = taskValue.toLowerCase();
                const valueStr = String(value).toLowerCase();

                switch(operator) {
                    case '=': return taskStr === valueStr;
                    case '!=': return taskStr !== valueStr;
                    case 'contains': return taskStr.includes(valueStr);
                    case 'not_contains': return !taskStr.includes(valueStr);
                }
            }

            // 处理时间字段
            if (field.includes('Time') || field === 'created' || field === 'updated') {
                return this.evaluateTimeCondition(taskValue, operator, value);
            }

            // 默认比较
            if (operator === '=') return taskValue === value;
            if (operator === '!=') return taskValue !== value;

            return true;
        },
        
        // 评估时间条件
        evaluateTimeCondition(taskTime, operator, value) {
            const taskTs = __tmParseTimeToTs(taskTime);
            if (!taskTs) return operator === '!='; // 空时间处理

            const taskDate = new Date(taskTs);
            const now = new Date();
            
            switch(operator) {
                case 'range_today': {
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
                    return taskDate >= todayStart && taskDate < todayEnd;
                }
                case 'range_week': {
                    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
                    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
                    return taskDate >= weekStart && taskDate < weekEnd;
                }
                case 'range_month': {
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    return taskDate >= monthStart && taskDate < monthEnd;
                }
                case 'range_year': {
                    const yearStart = new Date(now.getFullYear(), 0, 1);
                    const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
                    return taskDate >= yearStart && taskDate < yearEnd;
                }
                case 'before': {
                    const targetDate = new Date(__tmParseTimeToTs(value) || value);
                    return taskDate < targetDate;
                }
                case 'after': {
                    const targetDate = new Date(__tmParseTimeToTs(value) || value);
                    return taskDate > targetDate;
                }
                case 'between': {
                    let from = '';
                    let to = '';
                    if (value && typeof value === 'object') {
                        from = value.from || '';
                        to = value.to || '';
                    } else {
                        const parts = String(value || '').split(',');
                        from = parts[0] || '';
                        to = parts[1] || '';
                    }
                    const fromDate = new Date(__tmParseTimeToTs(from) || from);
                    const toDate = new Date(__tmParseTimeToTs(to) || to);
                    return taskDate >= fromDate && taskDate <= toDate;
                }
                case '=': return taskTime === value;
                case '!=': return taskTime !== value;
            }
            
            return true;
        },
        
        // 应用规则排序
        applyRuleSort(tasks, rule) {
            // 置顶任务始终排在最前
            const pinnedSort = (a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return 0;
            };

            if (!rule || !rule.sort || rule.sort.length === 0) {
                return [...tasks].sort(pinnedSort);
            }
            
            return [...tasks].sort((a, b) => {
                const pinnedRes = pinnedSort(a, b);
                if (pinnedRes !== 0) return pinnedRes;

                for (const sortRule of rule.sort) {
                    const { field, order } = sortRule;
                    let result = this.compareValues(a[field], b[field], field);
                    
                    if (result !== 0) {
                        return order === 'desc' ? -result : result;
                    }
                }
                return 0;
            });
        },
        
        // 比较值
        compareValues(a, b, field) {
            // 处理优先级特殊比较
            if (field === 'priority') {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                const na = ({ '高': 'high', '中': 'medium', '低': 'low' }[String(a ?? '').trim()] || String(a ?? '').trim());
                const nb = ({ '高': 'high', '中': 'medium', '低': 'low' }[String(b ?? '').trim()] || String(b ?? '').trim());
                return (priorityOrder[na] || 0) - (priorityOrder[nb] || 0);
            }
            if (field === 'priorityScore') {
                const na = Number(a);
                const nb = Number(b);
                const va = Number.isFinite(na) ? na : 0;
                const vb = Number.isFinite(nb) ? nb : 0;
                return va - vb;
            }

            // 处理状态排序
            if (field === 'customStatus') {
                const options = SettingsStore.data.customStatusOptions || [];
                const indexA = options.findIndex(o => o.id === a);
                const indexB = options.findIndex(o => o.id === b);
                const valA = indexA === -1 ? 9999 : indexA;
                const valB = indexB === -1 ? 9999 : indexB;
                return valA - valB;
            }
            
            // 处理时间比较
            if (field.includes('Time') || field === 'created' || field === 'updated') {
                const timeA = a ? __tmParseTimeToTs(a) : 0;
                const timeB = b ? __tmParseTimeToTs(b) : 0;
                return timeA - timeB;
            }
            
            // 默认比较
            if (a === b) return 0;
            return a < b ? -1 : 1;
        }
    };

    const API = {
        // ... 原有的API方法保持不变 ...
        async call(url, body) {
            try {
                const res = await fetch(url, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(body) 
                });
                return await res.json();
            } catch (err) { 
                return { code: -1, msg: err.message }; 
            }
        },

        async lsNotebooks() {
            const res = await this.call('/api/notebook/lsNotebooks', {});
            const notebooks = res?.data?.notebooks;
            return Array.isArray(notebooks) ? notebooks : [];
        },

        async createDocWithMd(notebook, path, markdown) {
            const res = await this.call('/api/filetree/createDocWithMd', { notebook, path, markdown });
            if (res.code !== 0) throw new Error(res.msg || '创建文档失败');
            return res.data;
        },

        async createDailyNote(notebook) {
            const box = String(notebook || '').trim();
            if (!box) throw new Error('未指定笔记本');
            const res = await this.call('/api/filetree/createDailyNote', { notebook: box });
            if (res.code !== 0) throw new Error(res.msg || '创建日记失败');
            const data = res.data;
            if (typeof data === 'string') return data;
            if (data && typeof data === 'object') {
                const id = data.id || data.ID || data.docId || data.docID || data.docid;
                if (id) return id;
            }
            throw new Error('创建日记失败');
        },

        async getDocNotebook(docId) {
            const id = String(docId || '').trim();
            if (!id) return '';
            const sql = `SELECT box FROM blocks WHERE id = '${id}' AND type = 'd'`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && Array.isArray(res.data) && res.data.length > 0) {
                return String(res.data[0]?.box || '').trim();
            }
            return '';
        },

        async getSubDocIds(docId) {
            try {
                // 先获取根文档的 path
                const pathSql = `SELECT hpath FROM blocks WHERE id = '${docId}' AND type = 'd'`;
                const pathRes = await this.call('/api/query/sql', { stmt: pathSql });
                if (pathRes.code !== 0 || !pathRes.data || pathRes.data.length === 0) return [];
                
                const hpath = pathRes.data[0].hpath;
                
                // 查询子文档
                const sql = `SELECT id FROM blocks WHERE hpath LIKE '${hpath}/%' AND type = 'd'`;
                const res = await this.call('/api/query/sql', { stmt: sql });
                if (res.code === 0 && res.data) {
                    return res.data.map(d => d.id);
                }
            } catch (e) {
            }
            return [];
        },

        async getBlockKramdown(id) {
            const res = await this.call('/api/block/getBlockKramdown', { id });
            if (res.code !== 0) throw new Error(res.msg || '获取块内容失败');
            const data = res.data;
            if (typeof data === 'string') return data;
            return data?.kramdown || data?.content || '';
        },

        async getDocId() {
            try {
                const m = location.hash.match(/id=([0-9a-z-]+)/);
                if (m) return m[1];
            } catch(e) {
            }
            return null;
        },

        parseTaskStatus(markdown) {
            if (!markdown) return { done: false, firstLine: '', content: '' };

            const lines = markdown.split('\n');
            const firstLine = lines[0].trim();

            const done = /^\s*[\*\-]\s*\[[xX]\]/.test(firstLine);

            let content = firstLine.replace(/^[\s\*\-]*\[[xX ]\]\s*/, '').trim();
            content = content.replace(/<span[^>]*>[\s\S]*?<\/span>/gi, '');
            content = content.replace(/\{\:\s*[^}]*\}/g, '');
            content = content.replace(/<[^>]+>/g, '');
            content = content.replace(/\s{2,}/g, ' ').trim();

            return { done, firstLine, content };
        },

        async getAllDocuments() {
            try {
                const sql = `
                    SELECT 
                        d.id, 
                        d.content as name,
                        d.hpath as path,
                        d.box as notebook,
                        d.created,
                        COALESCE(tc.task_count, 0) as task_count
                    FROM blocks d
                    LEFT JOIN (
                        SELECT root_id, COUNT(*) as task_count
                        FROM blocks
                        WHERE type = 'i' AND subtype = 't'
                        GROUP BY root_id
                    ) tc ON tc.root_id = d.id
                    WHERE d.type = 'd' 
                    ORDER BY d.content
                `;
                
                const res = await this.call('/api/query/sql', { stmt: sql });
                if (res.code === 0 && res.data) {
                    return res.data.map(doc => ({
                        id: doc.id,
                        name: doc.name || '未命名文档',
                        path: doc.path || '',
                        notebook: doc.notebook || '',
                        taskCount: parseInt(doc.task_count) || 0,
                        created: doc.created
                    }));
                }
                return [];
            } catch (e) {
                console.error('[文档] 获取文档列表失败:', e);
                return [];
            }
        },

        async getTasksByDocument(docId, limit = 500) {
            const tomatoEnabled = !!SettingsStore.data.enableTomatoIntegration;
            const tomatoMinutesKey = __tmSafeAttrName(SettingsStore.data.tomatoSpentAttrKeyMinutes, 'custom-tomato-minutes');
            const tomatoHoursKey = __tmSafeAttrName(SettingsStore.data.tomatoSpentAttrKeyHours, 'custom-tomato-time');
            const extraNames = tomatoEnabled ? [tomatoMinutesKey, tomatoHoursKey].filter((v, i, a) => v && a.indexOf(v) === i) : [];
            const attrNamesSql = [
                'custom-priority',
                'custom-duration',
                'custom-remark',
                'custom-start-date',
                'custom-completion-time',
                'custom-time',
                'custom-status',
                'custom-pinned',
                ...extraNames
            ].map(n => `'${n}'`).join(',\n                            ');

            // 不查找已完成任务的过滤条件
            // 不查找已完成任务的过滤条件（数据库层面暂不过滤，全部在JavaScript中过滤）
            const excludeCompletedCondition = '';

            const sql = `
                SELECT 
                    task.id,
                    task.markdown,
                    task.content as raw_content,
                    task.parent_id,
                    parent_task.id as parent_task_id,
                    task.root_id,
                    task.created,
                    task.updated,
                    
                    -- 文档信息
                    doc.content as doc_name,
                    doc.hpath as doc_path,
                    
                    -- 自定义属性
                    attr.priority,
                    attr.duration,
                    attr.remark,
                    attr.start_date,
                    attr.completion_time,
                    attr.time as custom_time,
                    attr.custom_status,
                    attr.pinned,
                    attr.tomato_minutes,
                    attr.tomato_hours
                    
                FROM blocks AS task
                
                -- 连接文档信息
                INNER JOIN blocks AS doc ON task.root_id = doc.id

                LEFT JOIN blocks AS parent_list ON parent_list.id = task.parent_id
                LEFT JOIN blocks AS parent_task ON parent_task.id = parent_list.parent_id AND parent_task.type = 'i' AND parent_task.subtype = 't'
                
                -- 左连接自定义属性（限制在当前文档的任务上，避免全表聚合）
                LEFT JOIN (
                    SELECT 
                        a.block_id,
                        MAX(CASE WHEN a.name = 'custom-priority' THEN a.value ELSE NULL END) as priority,
                        MAX(CASE WHEN a.name = 'custom-duration' THEN a.value ELSE NULL END) as duration,
                        MAX(CASE WHEN a.name = 'custom-remark' THEN a.value ELSE NULL END) as remark,
                        MAX(CASE WHEN a.name = 'custom-start-date' THEN a.value ELSE NULL END) as start_date,
                        MAX(CASE WHEN a.name = 'custom-completion-time' THEN a.value ELSE NULL END) as completion_time,
                        MAX(CASE WHEN a.name = 'custom-time' THEN a.value ELSE NULL END) as time,
                        MAX(CASE WHEN a.name = 'custom-status' THEN a.value ELSE NULL END) as custom_status,
                        MAX(CASE WHEN a.name = 'custom-pinned' THEN a.value ELSE NULL END) as pinned,
                        ${tomatoEnabled ? `MAX(CASE WHEN a.name = '${tomatoMinutesKey}' THEN a.value ELSE NULL END) as tomato_minutes` : `NULL as tomato_minutes`},
                        ${tomatoEnabled ? `MAX(CASE WHEN a.name = '${tomatoHoursKey}' THEN a.value ELSE NULL END) as tomato_hours` : `NULL as tomato_hours`}
                    FROM attributes a
                    INNER JOIN blocks t ON t.id = a.block_id
                    WHERE 
                        t.type = 'i'
                        AND t.subtype = 't'
                        AND t.root_id = '${docId}'
                        AND a.name IN (
                            ${attrNamesSql}
                        )
                    GROUP BY a.block_id
                ) AS attr ON attr.block_id = task.id
                
                WHERE 
                    task.type = 'i' 
                    AND task.subtype = 't'
                    AND task.root_id = '${docId}'
                    AND task.markdown IS NOT NULL
                    AND task.markdown != ''${excludeCompletedCondition}
                
                ORDER BY task.created
                LIMIT ${limit}
            `;
            
            const startTime = Date.now();
            const res = await this.call('/api/query/sql', { stmt: sql });
            const queryTime = Date.now() - startTime;
            
            if (res.code !== 0) {
                console.error(`[查询] 文档 ${docId.slice(0, 8)} 查询失败:`, res.msg);
                return { tasks: [], queryTime };
            }
            return { tasks: res.data || [], queryTime };
        },

        async getTasksByDocuments(docIds, limitPerDoc = 500) {
            const safeDocIds = Array.isArray(docIds) ? docIds.filter(id => /^[0-9]+-[a-zA-Z0-9]+$/.test(String(id || ''))) : [];
            if (safeDocIds.length === 0) return { tasks: [], queryTime: 0 };
            const idList = safeDocIds.map(id => `'${id}'`).join(',');
            const perDocLimit = Number.isFinite(limitPerDoc) ? Math.max(1, Math.min(5000, limitPerDoc)) : 500;

            const tomatoEnabled = !!SettingsStore.data.enableTomatoIntegration;
            const tomatoMinutesKey = __tmSafeAttrName(SettingsStore.data.tomatoSpentAttrKeyMinutes, 'custom-tomato-minutes');
            const tomatoHoursKey = __tmSafeAttrName(SettingsStore.data.tomatoSpentAttrKeyHours, 'custom-tomato-time');
            const extraNames = tomatoEnabled ? [tomatoMinutesKey, tomatoHoursKey].filter((v, i, a) => v && a.indexOf(v) === i) : [];
            const attrNamesSql = [
                'custom-priority',
                'custom-duration',
                'custom-remark',
                'custom-start-date',
                'custom-completion-time',
                'custom-time',
                'custom-status',
                'custom-pinned',
                ...extraNames
            ].map(n => `'${n}'`).join(',\n                        ');

            // 不查找已完成任务的过滤条件
            // 不查找已完成任务的过滤条件（数据库层面暂不过滤，全部在JavaScript中过滤）
            const excludeCompletedCondition = '';

            const sql = `
                WITH tasks0 AS (
                    SELECT
                        task.id,
                        task.markdown,
                        task.content AS raw_content,
                        task.parent_id,
                        task.root_id,
                        task.created,
                        task.updated,
                        doc.content AS doc_name,
                        doc.hpath AS doc_path,
                        ROW_NUMBER() OVER (PARTITION BY task.root_id ORDER BY task.created) AS rn
                    FROM blocks AS task
                    INNER JOIN blocks AS doc ON task.root_id = doc.id
                    LEFT JOIN blocks parent_list ON parent_list.id = task.parent_id
                    LEFT JOIN blocks parent_task ON parent_task.id = parent_list.parent_id AND parent_task.type = 'i' AND parent_task.subtype = 't'
                    WHERE
                        task.type = 'i'
                        AND task.subtype = 't'
                        AND task.root_id IN (${idList})
                        AND task.markdown IS NOT NULL
                        AND task.markdown != ''${excludeCompletedCondition}
                ),
                tasks AS (
                    SELECT * FROM tasks0 WHERE rn <= ${perDocLimit}
                ),
                attr AS (
                    SELECT
                        a.block_id,
                        MAX(CASE WHEN a.name = 'custom-priority' THEN a.value ELSE NULL END) AS priority,
                        MAX(CASE WHEN a.name = 'custom-duration' THEN a.value ELSE NULL END) AS duration,
                        MAX(CASE WHEN a.name = 'custom-remark' THEN a.value ELSE NULL END) AS remark,
                        MAX(CASE WHEN a.name = 'custom-start-date' THEN a.value ELSE NULL END) AS start_date,
                        MAX(CASE WHEN a.name = 'custom-completion-time' THEN a.value ELSE NULL END) AS completion_time,
                        MAX(CASE WHEN a.name = 'custom-time' THEN a.value ELSE NULL END) AS time,
                        MAX(CASE WHEN a.name = 'custom-status' THEN a.value ELSE NULL END) AS custom_status,
                        MAX(CASE WHEN a.name = 'custom-pinned' THEN a.value ELSE NULL END) AS pinned,
                        ${tomatoEnabled ? `MAX(CASE WHEN a.name = '${tomatoMinutesKey}' THEN a.value ELSE NULL END) AS tomato_minutes` : `NULL AS tomato_minutes`},
                        ${tomatoEnabled ? `MAX(CASE WHEN a.name = '${tomatoHoursKey}' THEN a.value ELSE NULL END) AS tomato_hours` : `NULL AS tomato_hours`}
                    FROM attributes a
                    INNER JOIN tasks t ON t.id = a.block_id
                    WHERE a.name IN (
                        ${attrNamesSql}
                    )
                    GROUP BY a.block_id
                )
                SELECT
                    t.id,
                    t.markdown,
                    t.raw_content,
                    t.parent_id,
                    parent_task.id AS parent_task_id,
                    t.root_id,
                    t.created,
                    t.updated,
                    t.doc_name,
                    t.doc_path,
                    attr.priority,
                    attr.duration,
                    attr.remark,
                    attr.start_date,
                    attr.completion_time,
                    attr.time AS custom_time,
                    attr.custom_status,
                    attr.pinned,
                    attr.tomato_minutes,
                    attr.tomato_hours
                FROM tasks t
                LEFT JOIN blocks parent_list ON parent_list.id = t.parent_id
                LEFT JOIN blocks parent_task ON parent_task.id = parent_list.parent_id AND parent_task.type = 'i' AND parent_task.subtype = 't'
                LEFT JOIN attr ON attr.block_id = t.id
                ORDER BY t.root_id, t.created
            `;

            const startTime = Date.now();
            const res = await this.call('/api/query/sql', { stmt: sql });
            const queryTime = Date.now() - startTime;
            if (res.code !== 0) {
                console.error(`[查询] 批量查询失败:`, res.msg);
                try {
                    const fallbackStart = Date.now();
                    const results = await Promise.all(safeDocIds.map(id => this.getTasksByDocument(id, perDocLimit)));
                    const tasks = [];
                    results.forEach(r => tasks.push(...(r?.tasks || [])));
                    const fallbackTime = Date.now() - fallbackStart;
                    return { tasks, queryTime: queryTime + fallbackTime };
                } catch (e) {
                    return { tasks: [], queryTime };
                }
            }
            return { tasks: res.data || [], queryTime };
        },

        async getTaskById(id) {
            if (!id) return null;
            const sql = `
                SELECT 
                    task.id,
                    task.markdown,
                    task.content as raw_content,
                    task.parent_id,
                    parent_task.id as parent_task_id,
                    task.root_id,
                    task.created,
                    task.updated,
                    doc.content as doc_name,
                    doc.hpath as doc_path,
                    attr.priority,
                    attr.duration,
                    attr.remark,
                    attr.start_date,
                    attr.completion_time,
                    attr.time as custom_time,
                    attr.custom_status
                FROM blocks AS task
                INNER JOIN blocks AS doc ON task.root_id = doc.id
                LEFT JOIN blocks AS parent_list ON parent_list.id = task.parent_id
                LEFT JOIN blocks AS parent_task ON parent_task.id = parent_list.parent_id AND parent_task.type = 'i' AND parent_task.subtype = 't'
                LEFT JOIN (
                    SELECT 
                        block_id,
                        MAX(CASE WHEN name = 'custom-priority' THEN value ELSE NULL END) as priority,
                        MAX(CASE WHEN name = 'custom-duration' THEN value ELSE NULL END) as duration,
                        MAX(CASE WHEN name = 'custom-remark' THEN value ELSE NULL END) as remark,
                        MAX(CASE WHEN name = 'custom-start-date' THEN value ELSE NULL END) as start_date,
                        MAX(CASE WHEN name = 'custom-completion-time' THEN value ELSE NULL END) as completion_time,
                        MAX(CASE WHEN name = 'custom-time' THEN value ELSE NULL END) as time,
                        MAX(CASE WHEN name = 'custom-status' THEN value ELSE NULL END) as custom_status
                    FROM attributes
                    WHERE block_id = '${id}'
                    GROUP BY block_id
                ) AS attr ON attr.block_id = task.id
                WHERE task.id = '${id}'
                LIMIT 1
            `;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                return res.data[0];
            }
            return null;
        },

        async getTasksHierarchy(taskIds) {
            if (!taskIds || taskIds.length === 0) return {};
            
            const idList = taskIds.map(id => `'${id}'`).join(',');
            const sql = `
                WITH RECURSIVE task_tree AS (
                    -- 起始：所有指定任务
                    SELECT 
                        id,
                        parent_id,
                        0 as level,
                        id as original_id
                    FROM blocks 
                    WHERE id IN (${idList})
                    
                    UNION ALL
                    
                    -- 递归：向上查找父列表
                    SELECT 
                        b.id,
                        b.parent_id,
                        tt.level + 1,
                        tt.original_id
                    FROM blocks b
                    INNER JOIN task_tree tt ON b.id = tt.parent_id
                    WHERE b.type = 'l' AND tt.level < 5
                )
                SELECT 
                    original_id as task_id,
                    MAX(level) as depth
                FROM task_tree
                GROUP BY original_id
            `;
            
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data) {
                const hierarchy = {};
                res.data.forEach(row => {
                    hierarchy[row.task_id] = {
                        level: row.depth || 0
                    };
                });
                return hierarchy;
            }
            return {};
        },

        async fetchH2Contexts(taskIds) {
            if (!taskIds || taskIds.length === 0) return new Map();
            const batchSize = 100;
            const contextMap = new Map();
            for (let i = 0; i < taskIds.length; i += batchSize) {
                const batch = taskIds.slice(i, i + batchSize);
                const idList = batch.map(id => `'${id}'`).join(',');
                const sql = `
                    WITH RECURSIVE ancestors AS (
                        SELECT id AS task_id, parent_id, id AS ancestor_id, 0 AS depth
                        FROM blocks
                        WHERE id IN (${idList})

                        UNION ALL

                        SELECT a.task_id, b.parent_id, b.id, a.depth + 1
                        FROM blocks b
                        INNER JOIN ancestors a ON b.id = a.parent_id
                        WHERE a.depth < 20
                    )
                    SELECT a.task_id, b.content, a.depth
                    FROM ancestors a
                    JOIN blocks b ON a.ancestor_id = b.id
                    WHERE b.type = 'h' AND b.subtype = '${SettingsStore.data.taskHeadingLevel || 'h2'}'
                    ORDER BY a.task_id, a.depth ASC
                `;
                try {
                    const res = await this.call('/api/query/sql', { stmt: sql });
                    if (res.code === 0 && res.data) {
                        res.data.forEach(row => {
                            if (!contextMap.has(row.task_id)) {
                                contextMap.set(row.task_id, row.content);
                            }
                        });
                    }
                } catch (e) {}
            }
            return contextMap;
        },

        async fetchNearestCustomPriority(taskIds, maxDepth = 8) {
            const ids = Array.from(new Set((taskIds || []).map(x => String(x || '').trim()).filter(Boolean)));
            if (ids.length === 0) return new Map();
            const depth = Number.isFinite(Number(maxDepth)) ? Math.max(1, Math.min(20, Math.floor(Number(maxDepth)))) : 8;
            const escapeId = (s) => String(s).replace(/'/g, "''");
            const seeds = ids.map(id => `('${escapeId(id)}','${escapeId(id)}',0)`).join(',');
            const sql = `
                WITH RECURSIVE up(start_id, id, depth) AS (
                    VALUES ${seeds}
                    UNION ALL
                    SELECT up.start_id, b.parent_id, up.depth + 1
                    FROM blocks b
                    JOIN up ON b.id = up.id
                    WHERE up.depth < ${depth}
                      AND b.parent_id IS NOT NULL
                      AND b.parent_id != ''
                ),
                candidates AS (
                    SELECT
                        up.start_id,
                        a.value AS priority,
                        up.depth,
                        ROW_NUMBER() OVER (PARTITION BY up.start_id ORDER BY up.depth ASC) AS rn
                    FROM up
                    JOIN attributes a ON a.block_id = up.id
                    WHERE a.name = 'custom-priority'
                      AND a.value IS NOT NULL
                      AND a.value != ''
                )
                SELECT start_id, priority
                FROM candidates
                WHERE rn = 1
            `;
            const res = await this.call('/api/query/sql', { stmt: sql });
            const map = new Map();
            if (res.code === 0 && Array.isArray(res.data)) {
                res.data.forEach(row => {
                    const id = String(row?.start_id || '').trim();
                    const v = String(row?.priority || '').trim();
                    if (id && v) map.set(id, v);
                });
            }
            return map;
        },

        async setAttr(id, key, val) {
            const res = await this.call('/api/attr/setBlockAttrs', { 
                id: id, 
                attrs: { [`custom-${key}`]: String(val) } 
            });
            if (res.code !== 0) throw new Error(res.msg || '保存属性失败');
            return true;
        },

        async setAttrs(id, attrs) {
            const payload = {};
            try {
                Object.entries(attrs || {}).forEach(([k, v]) => {
                    if (!k) return;
                    payload[String(k)] = String(v ?? '');
                });
            } catch (e) {}
            const res = await this.call('/api/attr/setBlockAttrs', { id, attrs: payload });
            if (res.code !== 0) throw new Error(res.msg || '保存属性失败');
            return true;
        },

        async updateBlock(id, md, dataType = 'markdown') {
            const res = await this.call('/api/block/updateBlock', {
                id: id,
                data: md,
                dataType: dataType
            });
            if (res.code !== 0) {
                if (res.msg?.includes('not found')) {
                    throw new Error(`块 ${id.slice(-6)} 不存在`);
                }
                throw new Error(res.msg || '更新块失败');
            }
            const opId = this._getInsertedId(res);
            return { res, id: opId || id };
        },

        // 生成任务DOM（用于DOM模式更新，避免ID变化）
        generateTaskDOM(id, content, done = false) {
            // HTML转义内容，防止特殊字符导致DOM解析错误
            const escapedContent = String(content || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            // 使用思源正确的DOM格式
            const checkboxIcon = done
                ? '<svg><use xlink:href="#iconCheck"></use></svg>'
                : '<svg><use xlink:href="#iconUncheck"></use></svg>';
            const doneClass = done ? ' protyle-task--done' : '';
            // 正确的DOM结构：div.NodeList > div.NodeListItem > div.protyle-action + div.NodeParagraph
            return `<div data-type="NodeList" data-subtype="t">
<div data-type="NodeListItem" class="li${doneClass}" data-node-id="${id}">
  <div class="protyle-action protyle-action--task" draggable="true">${checkboxIcon}</div>
  <div data-type="NodeParagraph" class="p">
    <div contenteditable="true" spellcheck="false">${escapedContent}</div>
    <div class="protyle-attr" contenteditable="false"></div>
  </div>
  <div class="protyle-attr" contenteditable="false"></div>
</div>
</div>`;
        },

        _getInsertedId(res) {
            try {
                const ops = res?.data;
                const id = ops?.[0]?.doOperations?.[0]?.id;
                return id || null;
            } catch (e) {
                return null;
            }
        },

        async insertBlock(parentId, md, nextID) {
            const payload = { parentID: parentId, data: md, dataType: 'markdown' };
            if (nextID) payload.nextID = nextID;
            const res = await this.call('/api/block/insertBlock', payload);
            if (res.code !== 0) throw new Error(res.msg);
            const id = this._getInsertedId(res);
            if (!id) throw new Error('插入失败');
            return id;
        },

        async appendBlock(parentId, md) {
            const res = await this.call('/api/block/appendBlock', { parentID: parentId, data: md, dataType: 'markdown' });
            if (res.code !== 0) throw new Error(res.msg);
            const id = this._getInsertedId(res);
            if (!id) throw new Error('追加失败');
            return id;
        },

        async moveBlock(id, { previousID, parentID } = {}) {
            const pid = String(previousID || '');
            const par = String(parentID || '');
            if (!pid && !par) throw new Error('移动失败：缺少目标位置');
            const payload = { id };
            if (pid) payload.previousID = pid;
            if (par) payload.parentID = par;
            const res = await this.call('/api/block/moveBlock', payload);
            if (res.code !== 0) throw new Error(res.msg || '移动块失败');
            return true;
        },

        async getLastDirectChildIdOfDoc(docId) {
            const id = String(docId || '').trim();
            if (!id) return null;
            const sql = `SELECT id FROM blocks WHERE parent_id = '${id}' ORDER BY created DESC LIMIT 1`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const lastId = String(res.data[0]?.id || '').trim();
                if (lastId && lastId !== id) return lastId;
            }
            return null;
        },

        async getFirstDirectChildListIdOfDoc(docId) {
            const id = String(docId || '').trim();
            if (!id) return null;
            const sql = `SELECT id FROM blocks WHERE parent_id = '${id}' AND type = 'l' ORDER BY created ASC LIMIT 1`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const listId = String(res.data[0]?.id || '').trim();
                if (listId) return listId;
            }
            return null;
        },

        async getBlockInfo(id) {
            const res = await this.call('/api/block/getBlockInfo', { id });
            if (res.code !== 0) throw new Error(res.msg);
            return res.data;
        },

        async getChildListIdOfTask(taskId) {
            const sql = `SELECT id FROM blocks WHERE parent_id = '${taskId}' AND type = 'l' LIMIT 1`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) return res.data[0].id || null;
            return null;
        },

        async getTaskIdsInList(listId) {
            const sql = `SELECT id FROM blocks WHERE parent_id = '${listId}' AND type = 'i' AND subtype = 't' ORDER BY created`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data) return res.data.map(r => r.id).filter(Boolean);
            return [];
        },

        async getFirstTaskIdUnderBlock(blockId) {
            const id = String(blockId || '').trim();
            if (!id) return null;
            const sql = `SELECT id FROM blocks WHERE parent_id = '${id}' AND type = 'i' AND subtype = 't' ORDER BY created ASC LIMIT 1`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const tid = String(res.data[0]?.id || '').trim();
                return tid || null;
            }
            return null;
        },

        async getFirstTaskDescendantId(blockId, maxDepth = 6) {
            const id = String(blockId || '').trim();
            const depth = Number.isFinite(Number(maxDepth)) ? Math.max(1, Math.min(20, Math.floor(Number(maxDepth)))) : 6;
            if (!id) return null;
            const sql = `
                WITH RECURSIVE tree(id, depth) AS (
                    SELECT '${id}' AS id, 0 AS depth
                    UNION ALL
                    SELECT b.id, t.depth + 1
                    FROM blocks b
                    JOIN tree t ON b.parent_id = t.id
                    WHERE t.depth < ${depth}
                )
                SELECT b.id
                FROM blocks b
                JOIN tree t ON t.id = b.id
                WHERE b.type = 'i' AND b.subtype = 't'
                ORDER BY t.depth ASC, b.created DESC
                LIMIT 1
            `;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const tid = String(res.data[0]?.id || '').trim();
                return tid || null;
            }
            return null;
        },

        async getBlocksByIds(ids) {
            const list = Array.from(new Set((ids || []).map(x => String(x || '').trim()).filter(Boolean)));
            if (list.length === 0) return [];
            const quoted = list.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
            const sql = `SELECT id, parent_id, type, subtype FROM blocks WHERE id IN (${quoted})`;
            const res = await this.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && Array.isArray(res.data)) return res.data;
            return [];
        },

        async deleteBlock(id) {
            const res = await this.call('/api/block/deleteBlock', { id: id });
            if (res.code !== 0) throw new Error(res.msg);
        }
    };

    const __tmMetaAttrMap = {
        priority: 'custom-priority',
        duration: 'custom-duration',
        remark: 'custom-remark',
        startDate: 'custom-start-date',
        completionTime: 'custom-completion-time',
        customTime: 'custom-time',
        customStatus: 'custom-status',
        pinned: 'custom-pinned'
    };

    function __tmPersistMetaAndAttrs(id, patch) {
        if (!id || !patch || typeof patch !== 'object') return;
        MetaStore.set(id, patch);
        const attrs = {};
        Object.entries(patch).forEach(([key, val]) => {
            const attrKey = __tmMetaAttrMap[key];
            if (!attrKey) return;
            attrs[attrKey] = String(val ?? '');
        });
        if (Object.keys(attrs).length === 0) return;
        API.setAttrs(id, attrs).catch(e => {
        });
    }

    async function __tmPersistMetaAndAttrsAsync(id, patch) {
        if (!id || !patch || typeof patch !== 'object') return false;
        MetaStore.set(id, patch);
        const attrs = {};
        Object.entries(patch).forEach(([key, val]) => {
            const attrKey = __tmMetaAttrMap[key];
            if (!attrKey) return;
            attrs[attrKey] = String(val ?? '');
        });
        if (Object.keys(attrs).length === 0) return true;
        let lastErr = null;
        for (let i = 0; i < 3; i++) {
            try {
                await API.setAttrs(id, attrs);
                try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e) {}
                try { await MetaStore.saveNow(); } catch (e) {}
                return true;
            } catch (e) {
                lastErr = e;
                await new Promise(r => setTimeout(r, 120 + i * 200));
            }
        }
        throw lastErr || new Error('保存属性失败');
    }
    let state = {
        // 数据状态
        taskTree: [],
        flatTasks: {},
        filteredTasks: [],
        
        // UI状态
        modal: null,
        settingsModal: null,
        rulesModal: null,
        priorityModal: null,
        quickAddModal: null,
        quickAddDocPicker: null,
        quickAdd: null,
        viewMode: 'list',
        docTabsHidden: false,
        ganttView: {
            dayWidth: 24,
            paddingDays: 7,
        },

        // 筛选状态
        currentRule: null,
        filterRules: [],  // 从 SettingsStore 加载
        searchKeyword: '',

        // 操作状态
        isRefreshing: false,
        openToken: 0,

        // 设置（从 SettingsStore 读取）
        selectedDocIds: [],
        allDocuments: [],
        queryLimit: 500,
        groupByDocName: true,
        collapsedTaskIds: new Set(),
        timerFocusTaskId: '',
        
        // 统计信息
        stats: {
            totalTasks: 0,
            doneTasks: 0,
            todoTasks: 0,
            queryTime: 0,
            docCount: 0
        },
        
        // 规则编辑器状态
        editingRule: null,
        priorityScoreDraft: null,
        
        // 四象限分组状态
        quadrantEnabled: false
    };

    let __tmMountEl = null;
    let __tmWakeReloadBound = false;
    let __tmWasHiddenAt = 0;
    let __tmWakeReloadTimer = null;
    let __tmWakeReloadInFlight = false;
    let __tmVisibilityHandler = null;
    let __tmFocusHandler = null;

    function __tmSetMount(el) {
        if (el && !document.body.contains(el)) {
            // if element not attached yet, still allow mount
        }
        __tmMountEl = el || null;
    }

    function __tmFindBestTabRoot() {
        try {
            const all = Array.from(document.querySelectorAll('.tm-tab-root')).filter(el => !!el && document.body.contains(el));
            if (all.length === 0) return null;
            const isVisible = (el) => {
                try {
                    if (!el) return false;
                    const rect = el.getBoundingClientRect?.();
                    if (!rect) return false;
                    return rect.width > 0 && rect.height > 0;
                } catch (e) {
                    return false;
                }
            };
            const visible = all.filter(isVisible);
            return visible[visible.length - 1] || all[all.length - 1] || null;
        } catch (e) {
            return null;
        }
    }

    function __tmEnsureMount() {
        if (__tmMountEl && !document.body.contains(__tmMountEl)) {
            __tmMountEl = null;
        }
        try {
            if (globalThis.__taskHorizonTabElement && !document.body.contains(globalThis.__taskHorizonTabElement)) {
                globalThis.__taskHorizonTabElement = null;
            }
        } catch (e) {}
        if (!__tmMountEl && globalThis.__taskHorizonTabElement && document.body.contains(globalThis.__taskHorizonTabElement)) {
            __tmSetMount(globalThis.__taskHorizonTabElement);
        }
        if (!__tmMountEl) {
            const best = __tmFindBestTabRoot();
            if (best) {
                try { globalThis.__taskHorizonTabElement = best; } catch (e) {}
                __tmSetMount(best);
            }
        }
    }

    function __tmGetMountRoot() {
        __tmEnsureMount();
        return __tmMountEl || document.body;
    }

    // ===== 全局清理句柄 =====
    let __tmGlobalClickHandler = null;
    let __tmDomReadyHandler = null;
    let __tmBreadcrumbObserver = null;
    let __tmThemeModeObserver = null;
    let __tmTopBarTimer = null;
    let __tmTopBarAdded = false;
    let __tmTopBarEl = null;
    let __tmTopBarClickCaptureHandler = null;
    let __tmTopBarClickInFlight = false;
    let __tmTomatoTimerHooked = false;
    let __tmTomatoOriginalTimerFns = null;
    let __tmTomatoAssociationListenerAdded = false;
    let __tmTomatoAssociationHandler = null;
    let __tmPinnedListenerAdded = false;
    let __tmQuickAddGlobalClickHandler = null;

    async function __tmSafeOpenManager(reason) {
        try {
            await openManager();
        } catch (e) {
            try { console.error(`[OpenManager:${String(reason || '')}]`, e); } catch (e2) {}
            try { hint(`❌ 加载失败: ${e?.message || String(e)}`, 'error'); } catch (e3) {}
        }
    }

function __tmScheduleWakeReload(reason) {
    try { if (__tmWakeReloadTimer) clearTimeout(__tmWakeReloadTimer); } catch (e) {}
    __tmWakeReloadTimer = setTimeout(() => {
        __tmWakeReloadTimer = null;
        // 只刷新数据，不自动打开管理器
        __tmRefreshAfterWake(reason).catch(() => {});
    }, 350);
}

// 新增：后台唤醒后只刷新数据，不自动跳转
async function __tmRefreshAfterWake(reason) {
    if (__tmWakeReloadInFlight) return;
    __tmWakeReloadInFlight = true;
    try {
        if (document.visibilityState === 'hidden') return;
        
        // 只有在管理器已经打开的情况下才刷新
        if (!state.modal || !document.body.contains(state.modal)) {
            return;
        }
        
        const best = __tmFindBestTabRoot();
        if (!best) return;
        
        try { globalThis.__taskHorizonTabElement = best; } catch (e) {}
        __tmSetMount(best);
        __tmEnsureMount();
        if (!__tmMountEl) return;
        
        // 静默刷新数据，不显示加载提示
        try { 
            await loadSelectedDocuments();
        } catch (e) {}
        
    } finally {
        __tmWakeReloadInFlight = false;
    }
}


    function __tmBindWakeReload() {
        if (__tmWakeReloadBound) return;
        __tmWakeReloadBound = true;
        __tmVisibilityHandler = () => {
            try {
                if (document.visibilityState === 'hidden') {
                    __tmWasHiddenAt = Date.now();
                    // 标记页面曾被隐藏，用于下次打开时跳过加载提示
                    state.wasHidden = true;
                    return;
                }
                const gap = Date.now() - (__tmWasHiddenAt || 0);
				// 只有管理器已打开时才刷新，且不再自动打开
				if (__tmWasHiddenAt && gap > 10000 && state.modal && document.body.contains(state.modal)) {
					__tmScheduleWakeReload('visibility');
				}
			} catch (e) {}
		};
		__tmFocusHandler = () => {
			try {
				const gap = Date.now() - (__tmWasHiddenAt || 0);
				// 只有管理器已打开时才刷新
				if (__tmWasHiddenAt && gap > 10000 && state.modal && document.body.contains(state.modal)) {
					__tmScheduleWakeReload('focus');
				}
            } catch (e) {}
        };
        try { document.addEventListener('visibilitychange', __tmVisibilityHandler); } catch (e) {}
        try { window.addEventListener('focus', __tmFocusHandler); } catch (e) {}
    }

    function __tmHookTomatoTimer() {
        if (__tmTomatoTimerHooked) return;
        const timer = globalThis.__tomatoTimer;
        if (!timer || typeof timer !== 'object') return;
        if (!__tmTomatoOriginalTimerFns) __tmTomatoOriginalTimerFns = {};
        const wrap = (name) => {
            const current = timer[name];
            if (typeof current !== 'function') return;
            if (current.__tmWrapped) return;
            if (!__tmTomatoOriginalTimerFns[name]) __tmTomatoOriginalTimerFns[name] = current;
            const original = __tmTomatoOriginalTimerFns[name];
            if (typeof original !== 'function') return;
            const wrapped = function(...args) {
                const res = original.apply(this, args);
                try {
                    state.timerFocusTaskId = '';
                    if (state.modal && document.body.contains(state.modal)) render();
                } catch (e) {}
                return res;
            };
            wrapped.__tmWrapped = true;
            try { timer[name] = wrapped; } catch (e) {}
        };
        [
            'clearTaskAssociation',
            'clearAssociation',
            'clearTask',
            'clearCurrentTask',
            'unbindTask',
            'stop',
            'reset',
        ].forEach(wrap);
        __tmTomatoTimerHooked = true;
    }

    function __tmListenTomatoAssociationCleared() {
        if (__tmTomatoAssociationListenerAdded) return;
        __tmTomatoAssociationHandler = () => {
            try {
                state.timerFocusTaskId = '';
                if (state.modal && document.body.contains(state.modal)) render();
            } catch (e) {}
        };
        try { window.addEventListener('tomato:association-cleared', __tmTomatoAssociationHandler); } catch (e) {}
        globalThis.__taskHorizonOnTomatoAssociationCleared = () => {
            try {
                state.timerFocusTaskId = '';
                if (state.modal && document.body.contains(state.modal)) render();
            } catch (e) {}
        };
        __tmTomatoAssociationListenerAdded = true;
    }

    function __tmListenPinnedChanged() {
        if (__tmPinnedListenerAdded) return;
        globalThis.__taskHorizonOnPinnedChanged = (taskId, pinned) => {
            try {
                const id = String(taskId || '').trim();
                if (!id) return;
                const task = state.flatTasks?.[id];
                if (!task) return;
                const val = !!pinned;
                task.pinned = val;
                try { MetaStore.set(id, { pinned: val }); } catch (e) {}
                try { applyFilters(); } catch (e) {}
                if (state.modal && document.body.contains(state.modal)) render();
            } catch (e) {}
        };
        __tmPinnedListenerAdded = true;
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function __tmSafeAttrName(name, fallback) {
        const f = String(fallback || '').trim() || 'custom-tomato-minutes';
        const s = String(name || '').trim() || f;
        if (!/^custom-[a-zA-Z0-9_-]+$/.test(s)) return f;
        return s;
    }

    function __tmParseNumber(value) {
        const s = String(value ?? '').trim();
        if (!s) return Number.NaN;
        const m = s.match(/-?\d+(?:\.\d+)?/);
        if (!m) return Number.NaN;
        return Number(m[0]);
    }

    const __tmIsMobileDevice = () => {
        try {
            if (window.siyuan?.config?.isMobile !== undefined) return !!window.siyuan.config.isMobile;
        } catch (e) {}
        const ua = navigator.userAgent || '';
        return /Mobile|Android|iPhone|iPad|iPod/i.test(ua) || (window.innerWidth || 0) <= 768;
    };

    const __tmGetFontSize = () => {
        const base = SettingsStore.data.fontSize || 14;
        const mobileSize = SettingsStore.data.fontSizeMobile || base;
        return __tmIsMobileDevice() ? mobileSize : base;
    };

    const __tmIsDarkMode = () => {
        try {
            return String(document.documentElement.getAttribute('data-theme-mode') || '').toLowerCase() === 'dark';
        } catch (e) {
            return false;
        }
    };

    function __tmClamp(n, min, max) {
        const v = Number(n);
        if (!Number.isFinite(v)) return min;
        return Math.min(max, Math.max(min, v));
    }

    function __tmNormalizeHexColor(input, fallback) {
        const s = String(input || '').trim();
        if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
        const f = String(fallback || '').trim();
        if (/^#[0-9a-fA-F]{6}$/.test(f)) return f.toLowerCase();
        return '';
    }

    function __tmHexToRgb(hex) {
        const h = __tmNormalizeHexColor(hex, '');
        if (!h) return null;
        const r = parseInt(h.slice(1, 3), 16);
        const g = parseInt(h.slice(3, 5), 16);
        const b = parseInt(h.slice(5, 7), 16);
        if (![r, g, b].every((x) => Number.isFinite(x))) return null;
        return { r, g, b };
    }

    function __tmWithAlpha(hex, alpha) {
        const rgb = __tmHexToRgb(hex);
        if (!rgb) return String(hex || '').trim();
        const a = __tmClamp(alpha, 0, 1);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
    }

    function __tmRemoveElementsById(...ids) {
        try {
            ids.forEach((id) => {
                const el = document.getElementById(String(id || '').trim());
                if (el) el.remove();
            });
        } catch (e) {}
    }

    function __tmOpenColorPickerDialog(titleText, initialColor, onApply, options = {}) {
        __tmRemoveElementsById('tm-color-picker-backdrop');
        const swatches = Array.isArray(options?.swatches) && options.swatches.length > 0 ? options.swatches : [
            '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
            '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
            '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800',
            '#795548', '#9E9E9E', '#607D8B', '#000000', '#FFFFFF'
        ];

        const defaultColor = __tmNormalizeHexColor(options?.defaultColor, '#f44336') || '#f44336';
        let current = __tmNormalizeHexColor(initialColor, defaultColor) || defaultColor;

        const backdrop = document.createElement('div');
        backdrop.id = 'tm-color-picker-backdrop';
        backdrop.className = 'tm-color-picker-backdrop';

        const dialog = document.createElement('div');
        dialog.className = 'tm-color-picker-dialog';

        const title = document.createElement('div');
        title.textContent = String(titleText || '选择颜色');
        title.style.cssText = 'font-weight:700;font-size:15px;margin-bottom:12px;color:var(--tm-text-color);';
        dialog.appendChild(title);

        const preview = document.createElement('div');
        preview.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;';
        const previewBox = document.createElement('div');
        previewBox.style.cssText = `width:44px;height:28px;border-radius:8px;border:1px solid var(--tm-border-color);background:${current};flex:0 0 auto;`;
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.value = String(current || '').toUpperCase();
        hexInput.placeholder = '#RRGGBB';
        hexInput.style.cssText = 'flex:1;padding:8px 10px;border:1px solid var(--tm-input-border);border-radius:8px;background:var(--tm-input-bg);color:var(--tm-text-color);';
        hexInput.oninput = () => {
            const norm = __tmNormalizeHexColor(hexInput.value, '');
            if (norm) {
                current = norm;
                previewBox.style.background = current;
                hexInput.style.borderColor = 'var(--tm-input-border)';
            } else {
                hexInput.style.borderColor = 'var(--tm-danger-color)';
            }
        };
        preview.appendChild(previewBox);
        preview.appendChild(hexInput);
        dialog.appendChild(preview);

        const grid = document.createElement('div');
        grid.className = 'tm-color-grid-10';
        swatches.forEach((c) => {
            const norm = __tmNormalizeHexColor(c, '');
            if (!norm) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.background = norm;
            btn.onclick = () => {
                current = norm;
                hexInput.value = String(current || '').toUpperCase();
                hexInput.style.borderColor = 'var(--tm-input-border)';
                previewBox.style.background = current;
            };
            grid.appendChild(btn);
        });
        dialog.appendChild(grid);

        const actions = document.createElement('div');
        actions.className = 'tm-color-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'tm-btn tm-btn-gray';
        cancelBtn.textContent = '取消';
        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'tm-btn tm-btn-primary';
        okBtn.textContent = '应用';

        const close = () => {
            try { backdrop.remove(); } catch (e) {}
        };

        cancelBtn.onclick = close;
        okBtn.onclick = () => {
            const norm = __tmNormalizeHexColor(current, '');
            if (!norm) return;
            try { onApply?.(norm); } catch (e) {}
            close();
        };
        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        dialog.appendChild(actions);

        backdrop.onclick = (e) => {
            if (e.target === backdrop) close();
        };

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    }

    function __tmApplyAppearanceThemeVars() {
        const isDark = __tmIsDarkMode();
        const root = document.documentElement;

        const start = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.topbarGradientDarkStart, '#3b49b7')
            : __tmNormalizeHexColor(SettingsStore.data.topbarGradientLightStart, '#667eea');
        const end = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.topbarGradientDarkEnd, '#5b2d7a')
            : __tmNormalizeHexColor(SettingsStore.data.topbarGradientLightEnd, '#764ba2');
        const taskColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.taskContentColorDark, '#e0e0e0')
            : __tmNormalizeHexColor(SettingsStore.data.taskContentColorLight, '#333333');
        const docGroupColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.groupDocLabelColorDark, '#e0e0e0')
            : __tmNormalizeHexColor(SettingsStore.data.groupDocLabelColorLight, '#333333');
        const timeBase = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, '#6ba5ff')
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, '#1a73e8');
        const timeOverdue = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b')
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025');
        const tableBorder = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.tableBorderColorDark, '#333333')
            : __tmNormalizeHexColor(SettingsStore.data.tableBorderColorLight, '#e9ecef');

        try { if (start) root.style.setProperty('--tm-topbar-grad-start', start); } catch (e) {}
        try { if (end) root.style.setProperty('--tm-topbar-grad-end', end); } catch (e) {}
        try { if (taskColor) root.style.setProperty('--tm-task-content-color', taskColor); } catch (e) {}
        try { if (docGroupColor) root.style.setProperty('--tm-group-doc-label-color', docGroupColor); } catch (e) {}
        try { if (timeBase) root.style.setProperty('--tm-time-group-base-color', timeBase); } catch (e) {}
        try { if (timeOverdue) root.style.setProperty('--tm-time-group-overdue-color', timeOverdue); } catch (e) {}
        try { if (tableBorder) root.style.setProperty('--tm-table-border-color', tableBorder); } catch (e) {}
    }

    function __tmDocHasUndoneTasks(doc) {
        if (!doc || !Array.isArray(doc.tasks) || doc.tasks.length === 0) return false;
        let hasUndone = false;
        const excludeCompletedParent = !!SettingsStore.data.excludeCompletedTasks;
        const walk = (list, parentDone) => {
            for (const t of list) {
                if (excludeCompletedParent && parentDone) continue;
                if (!t.done) {
                    hasUndone = true;
                    return;
                }
                if (t.children && t.children.length > 0) walk(t.children, excludeCompletedParent ? true : false);
                if (hasUndone) return;
            }
        };
        walk(doc.tasks, false);
        return hasUndone;
    }

    function hint(msg, type) {
        const colors = { success: '#34a853', error: '#ea4335', info: '#4285f4', warning: '#f9ab00' };
        const el = document.createElement('div');
        el.className = 'tm-hint';
        el.style.background = colors[type] || '#666';
        if (!__tmIsMobileDevice()) el.style.top = '35px';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    function showPrompt(title, placeholder = '', defaultValue = '') {
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();
            
            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';
            
            modal.innerHTML = `
                <div class="tm-prompt-box">
                    <div class="tm-prompt-title">${title}</div>
                    <input type="text" class="tm-prompt-input" placeholder="${placeholder}" value="${defaultValue}" autofocus>
                    <div class="tm-prompt-buttons">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-prompt-cancel">取消</button>
                        <button class="tm-prompt-btn tm-prompt-btn-primary" id="tm-prompt-ok">确定</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const input = modal.querySelector('.tm-prompt-input');
            const okBtn = modal.querySelector('#tm-prompt-ok');
            const cancelBtn = modal.querySelector('#tm-prompt-cancel');
            
            okBtn.onclick = () => {
                const value = input.value.trim();
                modal.remove();
                resolve(value);
            };
            
            cancelBtn.onclick = () => {
                modal.remove();
                resolve(null);
            };
            
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    okBtn.click();
                } else if (e.key === 'Escape') {
                    cancelBtn.click();
                }
            };
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cancelBtn.click();
                }
            };
        });
    }

    function showConfirm(title, message) {
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';

            modal.innerHTML = `
                <div class="tm-prompt-box">
                    <div class="tm-prompt-title">${esc(String(title || '确认'))}</div>
                    <div style="padding: 10px 0; color: var(--tm-text-color); font-size: 14px; line-height: 1.5;">
                        ${esc(String(message || ''))}
                    </div>
                    <div class="tm-prompt-buttons">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-confirm-cancel">取消</button>
                        <button class="tm-prompt-btn tm-prompt-btn-primary" id="tm-confirm-ok">确定</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const okBtn = modal.querySelector('#tm-confirm-ok');
            const cancelBtn = modal.querySelector('#tm-confirm-cancel');
            const cleanupKey = () => {
                try { document.removeEventListener('keydown', onKey, true); } catch (e) {}
            };
            function onKey(e) {
                if (e.key === 'Escape') {
                    cleanupKey();
                    cancelBtn.click();
                }
            }

            okBtn.onclick = () => {
                cleanupKey();
                modal.remove();
                resolve(true);
            };
            cancelBtn.onclick = () => {
                cleanupKey();
                modal.remove();
                resolve(false);
            };
            modal.onclick = (e) => {
                if (e.target === modal) cancelBtn.click();
            };
            document.addEventListener('keydown', onKey, true);
        });
    }

    function showSelectPrompt(title, options, defaultValue) {
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';

            const opts = Array.isArray(options) ? options : [];
            const items = opts.map(opt => {
                const value = typeof opt === 'string' ? opt : String(opt?.value || '');
                const label = typeof opt === 'string' ? opt : String(opt?.label || opt?.value || '');
                const selected = value === String(defaultValue ?? '') ? 'selected' : '';
                return `<option value="${esc(value)}" ${selected}>${esc(label)}</option>`;
            }).join('');

            modal.innerHTML = `
                <div class="tm-prompt-box">
                    <div class="tm-prompt-title">${title}</div>
                    <select class="tm-prompt-input" style="height: 36px;">
                        ${items}
                    </select>
                    <div class="tm-prompt-buttons">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-prompt-cancel">取消</button>
                        <button class="tm-prompt-btn tm-prompt-btn-primary" id="tm-prompt-ok">确定</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const select = modal.querySelector('.tm-prompt-input');
            const okBtn = modal.querySelector('#tm-prompt-ok');
            const cancelBtn = modal.querySelector('#tm-prompt-cancel');

            okBtn.onclick = () => {
                const value = String(select.value || '').trim();
                modal.remove();
                resolve(value);
            };
            cancelBtn.onclick = () => {
                modal.remove();
                resolve(null);
            };
            select.onkeydown = (e) => {
                if (e.key === 'Enter') okBtn.click();
                else if (e.key === 'Escape') cancelBtn.click();
            };
            modal.onclick = (e) => {
                if (e.target === modal) cancelBtn.click();
            };
        });
    }

    function __tmToDatetimeLocalValue(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function __tmParseDatetimeLocalToISO(raw) {
        const s = String(raw || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) === false && /^\d{4}-\d{2}-\d{2}$/.test(s) === false) {
            const d0 = new Date(s);
            if (!Number.isNaN(d0.getTime())) return d0.toISOString();
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const m0 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            const y0 = Number(m0[1]);
            const mon0 = Number(m0[2]) - 1;
            const d0 = Number(m0[3]);
            const dt0 = new Date(y0, mon0, d0, 0, 0, 0, 0);
            if (Number.isNaN(dt0.getTime())) return '';
            return dt0.toISOString();
        }
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
        if (!m) return '';
        const y = Number(m[1]);
        const mon = Number(m[2]) - 1;
        const d = Number(m[3]);
        const hh = Number(m[4]);
        const mm = Number(m[5]);
        const ss = Number(m[6] || 0);
        const dt = new Date(y, mon, d, hh, mm, ss, 0);
        if (Number.isNaN(dt.getTime())) return '';
        return dt.toISOString();
    }

    function showDateTimePrompt(title, defaultIso) {
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';

            modal.innerHTML = `
                <div class="tm-prompt-box">
                    <div class="tm-prompt-title">${title}</div>
                    <input type="datetime-local" class="tm-prompt-input" value="${esc(__tmToDatetimeLocalValue(defaultIso))}" autofocus>
                    <div class="tm-prompt-buttons" style="justify-content: space-between;">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-prompt-clear">清空</button>
                        <div style="display:flex;gap:10px;">
                            <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-prompt-cancel">取消</button>
                            <button class="tm-prompt-btn tm-prompt-btn-primary" id="tm-prompt-ok">确定</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const input = modal.querySelector('.tm-prompt-input');
            const okBtn = modal.querySelector('#tm-prompt-ok');
            const cancelBtn = modal.querySelector('#tm-prompt-cancel');
            const clearBtn = modal.querySelector('#tm-prompt-clear');

            okBtn.onclick = () => {
                const raw = String(input.value || '').trim();
                modal.remove();
                if (!raw) return resolve('');
                resolve(__tmParseDatetimeLocalToISO(raw));
            };
            clearBtn.onclick = () => {
                modal.remove();
                resolve('');
            };
            cancelBtn.onclick = () => {
                modal.remove();
                resolve(null);
            };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') okBtn.click();
                else if (e.key === 'Escape') cancelBtn.click();
            };
            modal.onclick = (e) => {
                if (e.target === modal) cancelBtn.click();
            };
        });
    }

    // 显示规则管理器
    async function showRulesManager() {
        if (state.rulesModal) return;
        
        state.rulesModal = document.createElement('div');
        state.rulesModal.className = 'tm-rules-manager';
        
        state.rulesModal.innerHTML = `
            <div class="tm-rules-box">
                <div class="tm-rules-header">
                    <div class="tm-rules-title">📋 筛选规则管理器</div>
                    <div style="display:flex;gap:10px;align-items:center;">
                        <button class="tm-rule-btn tm-rule-btn-secondary" data-tm-action="showPriorityScoreSettings">
                            优先级算法
                        </button>
                        <button class="tm-rule-btn tm-rule-btn-success" data-tm-action="addNewRule">
                            <span>+</span> 添加规则
                        </button>
                    </div>
                </div>
                
                <div class="tm-rules-body">
                    ${renderRulesList()}
                </div>
                
                <div class="tm-rules-footer">
                    <div class="tm-rule-info">
                        当前有 ${state.filterRules.filter(r => r.enabled).length} 个启用的规则
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="tm-rule-btn tm-rule-btn-secondary" data-tm-action="closeRulesManager">取消</button>
                        <button class="tm-rule-btn tm-rule-btn-success" data-tm-action="saveRules">保存规则</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(state.rulesModal);
        __tmBindRulesManagerEvents(state.rulesModal);
    }

    function __tmBindRulesManagerEvents(rootEl) {
        const root = rootEl || state.rulesModal;
        if (!root || root.__tmRulesManagerBound) return;
        root.__tmRulesManagerBound = true;

        root.addEventListener('click', async (e) => {
            const target = e.target?.closest?.('[data-tm-call],[data-tm-action]');
            if (!target || !root.contains(target)) return;
            const tag = String(target.tagName || '').toLowerCase();
            if (tag === 'select' || tag === 'input' || tag === 'textarea' || tag === 'option') return;
            e.preventDefault();

            const callName = String(target.dataset.tmCall || '');
            if (callName) {
                const fn = window[callName];
                if (typeof fn !== 'function') return;
                let args = [];
                const raw = target.dataset.tmArgs;
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        args = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e2) {}
                }
                return await fn(...args);
            }

            const action = String(target.dataset.tmAction || '');
            const ruleId = String(target.dataset.ruleId || '');
            const index = target.dataset.index !== undefined ? Number(target.dataset.index) : NaN;
            const delta = target.dataset.delta !== undefined ? Number(target.dataset.delta) : NaN;
            const tab = String(target.dataset.tab || '');

            if (action === 'editRule') return window.editRule?.(ruleId);
            if (action === 'deleteRule') return window.deleteRule?.(ruleId);
            if (action === 'applyRuleNow') return window.applyRuleNow?.(ruleId);
            if (action === 'removeCondition') return window.removeCondition?.(index);
            if (action === 'moveSortRule') return window.moveSortRule?.(index, delta);
            if (action === 'removeSortRule') return window.removeSortRule?.(index);
            if (action === 'tmSwitchSettingsTab') return window.tmSwitchSettingsTab?.(tab);

            const fn = window[action];
            if (typeof fn === 'function') return await fn();
        });

        root.addEventListener('change', (e) => {
            const target = e.target?.closest?.('[data-tm-call],[data-tm-change]');
            if (!target || !root.contains(target)) return;

            const callName = String(target.dataset.tmCall || '');
            if (callName) {
                const fn = window[callName];
                if (typeof fn !== 'function') return;
                let args = [];
                const raw = target.dataset.tmArgs;
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        args = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e2) {}
                }
                const val = (target.type === 'checkbox') ? !!target.checked : target.value;
                return fn(...args, val);
            }

            const changeType = String(target.dataset.tmChange || '');
            const ruleId = String(target.dataset.ruleId || '');
            const index = target.dataset.index !== undefined ? Number(target.dataset.index) : NaN;
            const optionValue = String(target.dataset.optionValue || '');
            const rangeKey = String(target.dataset.rangeKey || '');

            if (changeType === 'toggleRuleEnabled') return window.toggleRuleEnabled?.(ruleId, !!target.checked);
            if (changeType === 'updateConditionField') return window.updateConditionField?.(index, target.value);
            if (changeType === 'updateConditionOperator') return window.updateConditionOperator?.(index, target.value);
            if (changeType === 'updateConditionValue') return window.updateConditionValue?.(index, target.value);
            if (changeType === 'toggleConditionMultiValue') return window.toggleConditionMultiValue?.(index, optionValue, !!target.checked);
            if (changeType === 'updateConditionValueRange') return window.updateConditionValueRange?.(index, rangeKey, target.value);
            if (changeType === 'updateSortField') return window.updateSortField?.(index, target.value);
            if (changeType === 'updateSortOrder') return window.updateSortOrder?.(index, target.value);
        });

        root.addEventListener('input', (e) => {
            const target = e.target?.closest?.('[data-tm-call],[data-tm-input]');
            if (!target || !root.contains(target)) return;

            const callName = String(target.dataset.tmCall || '');
            if (callName) {
                const fn = window[callName];
                if (typeof fn !== 'function') return;
                let args = [];
                const raw = target.dataset.tmArgs;
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        args = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e2) {}
                }
                const val = (target.type === 'checkbox') ? !!target.checked : target.value;
                return fn(...args, val);
            }

            const inputType = String(target.dataset.tmInput || '');
            if (inputType === 'updateEditingRuleName') return window.updateEditingRuleName?.(target.value);
        });
    }

    // 渲染规则列表
    function renderRulesList() {
        const isAddingNew = state.editingRule && !state.filterRules.some(r => r.id === state.editingRule.id);

        if (state.filterRules.length === 0 && !isAddingNew) {
            return '<div style="text-align: center; padding: 40px; color: var(--tm-secondary-text);">暂无规则，点击"添加规则"创建</div>';
        }
        
        let html = state.filterRules.map((rule, index) => renderRuleItem(rule, index)).join('');

        if (isAddingNew) {
            html = renderRuleEditor(state.editingRule) + html;
        }
        
        return html;
    }

    // 渲染单个规则项
    function renderRuleItem(rule, index) {
        const isEditing = state.editingRule?.id === rule.id;
        
        if (isEditing) {
            return renderRuleEditor(rule);
        }
        
        const conditionText = rule.conditions.length > 0
            ? rule.conditions.map(c => {
                const field = RuleManager.getAvailableFields().find(f => f.value === c.field);
                let valueDisplay = c.value;

                // 状态字段特殊显示
                if (c.field === 'customStatus') {
                    if (Array.isArray(c.value)) {
                        valueDisplay = c.value.map(v => {
                            const option = SettingsStore.data.customStatusOptions.find(o => o.id === v);
                            return option ? option.name : v;
                        }).join('、');
                    } else {
                        const option = SettingsStore.data.customStatusOptions.find(o => o.id === c.value);
                        valueDisplay = option ? option.name : c.value;
                    }
                } else if (c.field === 'priority') {
                    // 优先级显示
                    const priorityMap = {
                        'high': '高',
                        'medium': '中',
                        'low': '低',
                        'none': '无'
                    };
                    if (Array.isArray(c.value)) {
                        valueDisplay = c.value.map(v => priorityMap[v] || v).join('、');
                    } else {
                        valueDisplay = priorityMap[c.value] || c.value;
                    }
                }

                // 多值显示处理
                if (Array.isArray(c.value) && c.field !== 'customStatus' && c.field !== 'priority') {
                    if (c.value.length > 1) {
                        valueDisplay = c.value.join('、');
                    } else {
                        valueDisplay = c.value[0] || '无';
                    }
                } else if ((c.operator === 'in' || c.operator === 'not_in') && c.field !== 'customStatus' && c.field !== 'priority') {
                    // 兼容旧格式（逗号分隔的字符串）
                    if (typeof c.value === 'string' && c.value.includes(',')) {
                        valueDisplay = c.value.split(',').join('、');
                    }
                }

                return `${field?.label || c.field} ${c.operator} ${valueDisplay}`;
            }).join('， ')
            : '无条件';
        
        const sortText = rule.sort.length > 0
            ? rule.sort.map((s, i) => {
                const fieldLabel = (RuleManager.getSortFields().find(f => f.value === s.field)?.label || s.field);
                return `${i + 1}. ${fieldLabel} (${s.order === 'desc' ? '降序' : '升序'})`;
            }).join(' → ')
            : '无排序';
        
        return `
            <div class="tm-rule-group">
                <div class="tm-rule-group-header">
                    <div class="tm-rule-group-title">
                        <input type="checkbox" ${rule.enabled ? 'checked' : ''} 
                               data-tm-change="toggleRuleEnabled"
                               data-rule-id="${esc(String(rule.id))}"
                               style="margin-right: 8px;">
                        ${esc(rule.name)}
                        ${state.currentRule === rule.id ? '<span style="color: var(--tm-success-color); margin-left: 8px;">(当前应用)</span>' : ''}
                    </div>
                    <div class="tm-rule-group-controls">
                        <button class="tm-rule-btn tm-rule-btn-primary" data-tm-action="editRule" data-rule-id="${esc(String(rule.id))}">
                            编辑
                        </button>
                        <button class="tm-rule-btn tm-rule-btn-danger" data-tm-action="deleteRule" data-rule-id="${esc(String(rule.id))}">
                            删除
                        </button>
                    </div>
                </div>
                
                <div style="font-size: 12px; color: var(--tm-secondary-text); margin-bottom: 8px;">
                    <strong>筛选条件：</strong>${conditionText}
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                    <strong>排序规则：</strong>${sortText}
                </div>
                
                <div class="tm-rule-actions">
                    <button class="tm-rule-btn tm-rule-btn-primary" data-tm-action="applyRuleNow" data-rule-id="${esc(String(rule.id))}">
                        立即应用
                    </button>
                </div>
            </div>
        `;
    }

    // 渲染规则编辑器
    function renderRuleEditor(rule) {
        const availableFields = RuleManager.getAvailableFields();
        const sortFields = RuleManager.getSortFields();
        
        return `
            <div class="tm-rule-group">
                <div class="tm-rule-group-header">
                    <input type="text" class="tm-rule-input" value="${esc(rule.name)}" 
                           placeholder="规则名称" data-tm-input="updateEditingRuleName">
                </div>
                
                <div class="tm-rule-section">
                    <div class="tm-rule-section-title">
                        <span>筛选条件</span>
                        <button class="tm-rule-btn tm-rule-btn-add" data-tm-action="addCondition">
                            + 添加条件
                        </button>
                    </div>
                    <div class="tm-rule-conditions">
                        ${renderConditions(rule.conditions)}
                    </div>
                </div>
                
                <div class="tm-rule-section">
                    <div class="tm-rule-section-title">
                        <span>排序规则</span>
                        <button class="tm-rule-btn tm-rule-btn-add" data-tm-action="addSortRule">
                            + 添加排序
                        </button>
                    </div>
                    <div class="tm-rule-sort-items">
                        ${renderSortRules(rule.sort)}
                    </div>
                </div>
                
                <div class="tm-rule-actions">
                    <button class="tm-rule-btn tm-rule-btn-secondary" data-tm-action="cancelEditRule">
                        取消
                    </button>
                    <button class="tm-rule-btn tm-rule-btn-success" data-tm-action="saveEditRule">
                        保存规则
                    </button>
                </div>
            </div>
        `;
    }

    // 渲染条件列表
    function renderConditions(conditions) {
        if (conditions.length === 0) {
            return '<div style="text-align: center; padding: 10px; color: var(--tm-secondary-text);">暂无筛选条件</div>';
        }
        
        const availableFields = RuleManager.getAvailableFields();
        
        return conditions.map((condition, index) => {
            const field = availableFields.find(f => f.value === condition.field);
            const operators = RuleManager.getOperators(field?.type || 'text');
            
            return `
                <div class="tm-rule-condition">
                    <select class="tm-rule-condition-field" data-tm-change="updateConditionField" data-index="${index}">
                        ${availableFields.map(f => 
                            `<option value="${f.value}" ${condition.field === f.value ? 'selected' : ''}>
                                ${f.label}
                            </option>`
                        ).join('')}
                    </select>
                    <select class="tm-rule-condition-operator" data-tm-change="updateConditionOperator" data-index="${index}">
                        ${operators.map(op => 
                            `<option value="${op.value}" ${condition.operator === op.value ? 'selected' : ''}>
                                ${op.label}
                            </option>`
                        ).join('')}
                    </select>
                    ${renderConditionValue(condition, index, field?.type)}
                    <button class="tm-rule-btn tm-rule-btn-danger" data-tm-action="removeCondition" data-index="${index}">
                        ×
                    </button>
                </div>
            `;
        }).join('');
    }

    // 渲染条件值输入
    function renderConditionValue(condition, index, fieldType) {
        if (fieldType === 'boolean') {
            return `
                <select class="tm-rule-condition-value" data-tm-change="updateConditionValue" data-index="${index}">
                    <option value="true" ${condition.value === true || condition.value === 'true' ? 'selected' : ''}>是</option>
                    <option value="false" ${condition.value === false || condition.value === 'false' ? 'selected' : ''}>否</option>
                </select>
            `;
        }
        
        if (fieldType === 'select') {
            const field = RuleManager.getAvailableFields().find(f => f.value === condition.field);
            
            // 准备选项和显示标签
            let allOptions = [];
            let optionLabels = { 'high': '高', 'medium': '中', 'low': '低', 'none': '无' };

            if (condition.field === 'customStatus') {
                allOptions = SettingsStore.data.customStatusOptions.map(o => o.id);
                optionLabels = SettingsStore.data.customStatusOptions.reduce((acc, cur) => {
                    acc[cur.id] = cur.name;
                    return acc;
                }, {});
            } else {
                allOptions = [...(field.options || []), '无'];
            }

            // 如果操作符是 in 或 not_in，显示多选框组
            if (condition.operator === 'in' || condition.operator === 'not_in') {
                // value 应该是数组
                let selectedValues = [];
                if (Array.isArray(condition.value)) {
                    selectedValues = condition.value;
                } else if (typeof condition.value === 'string' && condition.value.includes(',')) {
                    selectedValues = condition.value.split(',').map(v => v.trim());
                }

                return `
                    <div class="tm-multi-select" style="display: flex; flex-wrap: wrap; gap: 8px; min-width: 200px;">
                        ${allOptions.map(opt => `
                            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                <input type="checkbox"
                                       ${selectedValues.includes(opt) ? 'checked' : ''}
                                       data-tm-change="toggleConditionMultiValue"
                                       data-index="${index}"
                                       data-option-value="${esc(String(opt))}">
                                <span>${optionLabels[opt] || opt}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
            }
            // 否则显示单选下拉框
            // 如果值是数组（之前是in/not_in），转为空字符串
            const singleValue = Array.isArray(condition.value) ? '' : condition.value;
            
            return `
                <select class="tm-rule-condition-value" data-tm-change="updateConditionValue" data-index="${index}">
                    <option value="">-- 请选择 --</option>
                    ${allOptions.map(opt =>
                        `<option value="${opt}" ${singleValue === opt ? 'selected' : ''}>
                            ${optionLabels[opt] || opt}
                        </option>`
                    ).join('')}
                </select>
            `;
        }
        
        if (condition.operator === 'between' && (fieldType === 'datetime' || fieldType === 'number')) {
            const inputType = fieldType === 'datetime' ? 'date' : 'number';
            return `
                <div class="tm-time-range">
                    <input type="${inputType}" 
                           class="tm-time-input" 
                           placeholder="开始值"
                           value="${condition.value?.from || ''}"
                           data-tm-change="updateConditionValueRange"
                           data-index="${index}"
                           data-range-key="from">
                    <span class="tm-time-separator">至</span>
                    <input type="${inputType}" 
                           class="tm-time-input" 
                           placeholder="结束值"
                           value="${condition.value?.to || ''}"
                           data-tm-change="updateConditionValueRange"
                           data-index="${index}"
                           data-range-key="to">
                </div>
            `;
        }
        
        return `
            <input type="text" class="tm-rule-condition-value" 
                   value="${esc(String(condition.value || ''))}"
                   placeholder="输入值"
                   data-tm-change="updateConditionValue"
                   data-index="${index}">
        `;
    }

    // 渲染排序规则
    function renderSortRules(sortRules) {
        if (sortRules.length === 0) {
            return '<div style="text-align: center; padding: 10px; color: var(--tm-secondary-text);">暂无排序规则</div>';
        }
        
        const sortFields = RuleManager.getSortFields();
        
        return sortRules.map((sortRule, index) => `
            <div class="tm-rule-sort-item">
                <select class="tm-rule-sort-field" data-tm-change="updateSortField" data-index="${index}">
                    ${sortFields.map(f => 
                        `<option value="${f.value}" ${sortRule.field === f.value ? 'selected' : ''}>
                            ${f.label}
                        </option>`
                    ).join('')}
                </select>
                <select class="tm-rule-sort-order" data-tm-change="updateSortOrder" data-index="${index}">
                    <option value="asc" ${sortRule.order === 'asc' ? 'selected' : ''}>升序</option>
                    <option value="desc" ${sortRule.order === 'desc' ? 'selected' : ''}>降序</option>
                </select>
                <button class="tm-rule-btn tm-rule-btn-secondary" data-tm-action="moveSortRule" data-index="${index}" data-delta="-1" ${index === 0 ? 'disabled' : ''} style="width: 28px; padding: 2px 0;">↑</button>
                <button class="tm-rule-btn tm-rule-btn-secondary" data-tm-action="moveSortRule" data-index="${index}" data-delta="1" ${index === sortRules.length - 1 ? 'disabled' : ''} style="width: 28px; padding: 2px 0;">↓</button>
                <button class="tm-rule-btn tm-rule-btn-danger" data-tm-action="removeSortRule" data-index="${index}">
                    ×
                </button>
            </div>
        `).join('');
    }

    // 全局规则管理函数
    window.showRulesManager = showRulesManager;

    function __tmGetDefaultPriorityScoreConfig() {
        return {
            base: 100,
            weights: { importance: 1, status: 1, due: 1, duration: 1, doc: 1 },
            importanceDelta: { high: 20, medium: 10, low: -5, none: 0 },
            statusDelta: { todo: 0, in_progress: 15, done: -80, blocked: -10, review: 5 },
            dueRanges: [
                { days: 0, delta: 20 },
                { days: 1, delta: 15 },
                { days: 3, delta: 10 },
                { days: 7, delta: 5 },
                { days: 30, delta: 0 }
            ],
            durationUnit: 'minutes',
            durationBuckets: [
                { maxMinutes: 15, delta: 10 },
                { maxMinutes: 60, delta: 0 },
                { maxMinutes: 240, delta: -5 },
                { maxMinutes: 999999, delta: -10 }
            ],
            docDeltas: {}
        };
    }

    function __tmCloneJson(obj) {
        try { return JSON.parse(JSON.stringify(obj || {})); } catch (e) { return {}; }
    }

    function __tmEnsurePriorityDraft() {
        const base = __tmGetDefaultPriorityScoreConfig();
        const cur = (SettingsStore.data.priorityScoreConfig && typeof SettingsStore.data.priorityScoreConfig === 'object')
            ? SettingsStore.data.priorityScoreConfig
            : {};
        const merged = { ...base, ...__tmCloneJson(cur) };
        merged.weights = { ...base.weights, ...(merged.weights || {}) };
        merged.importanceDelta = { ...base.importanceDelta, ...(merged.importanceDelta || {}) };
        merged.statusDelta = { ...base.statusDelta, ...(merged.statusDelta || {}) };
        merged.dueRanges = Array.isArray(merged.dueRanges) ? merged.dueRanges : base.dueRanges;
        merged.durationUnit = (merged.durationUnit === 'hours' || merged.durationUnit === 'minutes') ? merged.durationUnit : 'minutes';
        merged.durationBuckets = Array.isArray(merged.durationBuckets) ? merged.durationBuckets : base.durationBuckets;
        merged.docDeltas = (merged.docDeltas && typeof merged.docDeltas === 'object') ? merged.docDeltas : {};

        const statuses = SettingsStore.data.customStatusOptions || [];
        statuses.forEach(s => {
            const id = String(s?.id || '').trim();
            if (!id) return;
            if (merged.statusDelta[id] === undefined) merged.statusDelta[id] = 0;
        });
        return merged;
    }

    function __tmRenderPriorityScoreSettings(isEmbeddedInSettings) {
        const embedded = !!isEmbeddedInSettings;
        const cfg = state.priorityScoreDraft || __tmEnsurePriorityDraft();
        const statuses = SettingsStore.data.customStatusOptions || [];
        const docs = state.allDocuments || [];
        const docRows = Object.entries(cfg.docDeltas || {}).map(([docId, delta]) => {
            const dName = docs.find(d => d.id === docId)?.name;
            return `
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
                    <button class="tm-btn tm-btn-secondary" data-tm-call="tmPickPriorityDocDelta" data-tm-args='["${esc(docId)}"]' style="flex:1;min-width:180px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
                        <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(dName || docId)}</span>
                        <span style="opacity:0.8;">▾</span>
                    </button>
                    <input class="tm-input" style="width:120px;" type="number" value="${Number(delta) || 0}" data-tm-call="tmSetPriorityDocDelta" data-tm-args='["${esc(docId)}"]'>
                    <button class="tm-btn tm-btn-gray" data-tm-call="tmRemovePriorityDocDelta" data-tm-args='["${esc(docId)}"]'>删除</button>
                </div>
            `;
        }).join('');

        const dueRows = (Array.isArray(cfg.dueRanges) ? cfg.dueRanges : []).map((r, i) => `
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                <span style="width:70px;color:var(--tm-secondary-text);">≤ 天数</span>
                <input class="tm-input" style="width:120px;" type="number" value="${Number(r.days) || 0}" data-tm-call="tmSetPriorityDueRange" data-tm-args='[${i},"days"]'>
                <span style="width:40px;color:var(--tm-secondary-text);">加分</span>
                <input class="tm-input" style="width:120px;" type="number" value="${Number(r.delta) || 0}" data-tm-call="tmSetPriorityDueRange" data-tm-args='[${i},"delta"]'>
                <button class="tm-btn tm-btn-gray" data-tm-call="tmRemovePriorityDueRange" data-tm-args='[${i}]'>删除</button>
            </div>
        `).join('');

        const durationUnit = (cfg.durationUnit === 'hours' || cfg.durationUnit === 'minutes') ? cfg.durationUnit : 'minutes';
        const __tmDurationBucketToInputValue = (maxMinutes) => {
            const m = Number(maxMinutes);
            if (!Number.isFinite(m)) return 0;
            const v = durationUnit === 'hours' ? (m / 60) : m;
            return Math.round(v * 100) / 100;
        };
        const durationLabel = durationUnit === 'hours' ? '≤ 小时' : '≤ 分钟';
        const durRows = (Array.isArray(cfg.durationBuckets) ? cfg.durationBuckets : []).map((b, i) => `
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                <span style="width:70px;color:var(--tm-secondary-text);">${durationLabel}</span>
                <input class="tm-input" style="width:120px;" type="number" value="${__tmDurationBucketToInputValue(b.maxMinutes)}" data-tm-call="tmSetPriorityDurationBucket" data-tm-args='[${i},"maxMinutes"]'>
                <span style="width:40px;color:var(--tm-secondary-text);">加分</span>
                <input class="tm-input" style="width:120px;" type="number" value="${Number(b.delta) || 0}" data-tm-call="tmSetPriorityDurationBucket" data-tm-args='[${i},"delta"]'>
                <button class="tm-btn tm-btn-gray" data-tm-call="tmRemovePriorityDurationBucket" data-tm-args='[${i}]'>删除</button>
            </div>
        `).join('');

        if (embedded) {
            return `
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <div style="font-weight: 700; font-size: 15px;">⚙️ 优先级算法</div>

                    <div class="tm-rule-section" style="margin-bottom:0;">
                        <div style="font-weight: 700; margin-bottom: 10px;">基础分</div>
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <input class="tm-input" type="number" value="${Number(cfg.base) || 100}" data-tm-call="tmSetPriorityBase" style="width: 180px;">
                            <div style="font-size: 12px; color: var(--tm-secondary-text);">用于所有任务的起始分</div>
                        </div>
                    </div>

                    <div class="tm-rule-section" style="margin-bottom:0;">
                        <div style="font-weight: 700; margin-bottom: 10px;">权重（微调）</div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
                            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">重要性 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.weights.importance) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["importance"]'></label>
                            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">状态 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.weights.status) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["status"]'></label>
                            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">完成时间 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.weights.due) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["due"]'></label>
                            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">时长 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.weights.duration) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["duration"]'></label>
                            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">文档 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.weights.doc) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["doc"]'></label>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
                        <div class="tm-rule-section" style="margin-bottom:0;">
                            <div style="font-weight: 700; margin-bottom: 10px;">重要性加减分</div>
                            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
                                <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">高 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.importanceDelta.high) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["high"]'></label>
                                <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">中 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.importanceDelta.medium) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["medium"]'></label>
                                <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">低 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.importanceDelta.low) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["low"]'></label>
                                <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">无 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.importanceDelta.none) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["none"]'></label>
                            </div>
                        </div>

                        <div class="tm-rule-section" style="margin-bottom:0;">
                            <div style="font-weight: 700; margin-bottom: 10px;">状态加减分</div>
                            <div style="display:flex;flex-wrap:wrap;gap:10px;">
                                ${statuses.map(s => `
                                    <label style="display:flex;align-items:center;gap:8px; padding: 6px 8px; border: 1px solid var(--tm-border-color); border-radius: 8px; background: var(--tm-bg-color);">
                                        <span style="max-width: 140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(s.name || s.id)}</span>
                                        <input class="tm-input" style="width:110px;" type="number" value="${Number(cfg.statusDelta[s.id]) || 0}" data-tm-call="tmSetPriorityStatus" data-tm-args='["${esc(String(s.id))}"]'>
                                    </label>
                                `).join('')}
                            </div>
                            ${statuses.length === 0 ? '<div style="color: var(--tm-secondary-text); font-size: 12px;">暂无自定义状态</div>' : ''}
                        </div>
                    </div>

                    <div class="tm-rule-section" style="margin-bottom:0;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
                            <div style="font-weight: 700;">完成时间接近度（按“≤ 天数”匹配）</div>
                            <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDueRange">+ 添加</button>
                        </div>
                        ${dueRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div class="tm-rule-section" style="margin-bottom:0;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
                            <div style="font-weight: 700;">时长分段</div>
                            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                                <select class="tm-input" style="width: 160px;" data-tm-call="tmSetPriorityDurationUnit">
                                    <option value="minutes" ${durationUnit === 'minutes' ? 'selected' : ''}>分钟</option>
                                    <option value="hours" ${durationUnit === 'hours' ? 'selected' : ''}>小时（可小数）</option>
                                </select>
                                <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDurationBucket">+ 添加</button>
                            </div>
                        </div>
                        ${durRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div class="tm-rule-section" style="margin-bottom:0;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
                            <div style="font-weight: 700;">文档加减分</div>
                            <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDocDelta">+ 添加</button>
                        </div>
                        ${docRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>
                </div>
            `;
        }

        return `
            <div class="tm-box" style="width: ${embedded ? '100%' : '720px'}; height: auto; ${embedded ? '' : 'max-height: 86vh;'}">
                <div class="tm-header">
                    <div style="font-size: 16px; font-weight: 700; color: var(--tm-text-color);">⚙️ 优先级算法</div>
                    ${embedded
                        ? '<button class="tm-btn tm-btn-gray" data-tm-action="tmSwitchSettingsTab" data-tab="rules">返回</button>'
                        : '<button class="tm-btn tm-btn-gray" data-tm-action="closePriorityScoreSettings">关闭</button>'}
                </div>
                <div style="padding: 14px; overflow: auto;">
                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">基础分</div>
                        <input class="tm-input" type="number" value="${Number(cfg.base) || 100}" data-tm-call="tmSetPriorityBase" style="width: 160px;">
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">权重（微调）</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            <label style="display:flex;align-items:center;gap:6px;">重要性 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.importance) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["importance"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">状态 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.status) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["status"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">完成时间 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.due) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["due"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">时长 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.duration) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["duration"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">文档 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.doc) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["doc"]'></label>
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">重要性加减分</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            <label style="display:flex;align-items:center;gap:6px;">高 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.high) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["high"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">中 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.medium) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["medium"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">低 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.low) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["low"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">无 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.none) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["none"]'></label>
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">状态加减分</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            ${statuses.map(s => `
                                <label style="display:flex;align-items:center;gap:6px;">
                                    ${esc(s.name || s.id)}
                                    <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.statusDelta[s.id]) || 0}" data-tm-call="tmSetPriorityStatus" data-tm-args='["${esc(String(s.id))}"]'>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                            <div style="font-weight: 700;">完成时间接近度（按“≤ 天数”匹配）</div>
                            <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDueRange">+ 添加</button>
                        </div>
                        ${dueRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
                            <div style="font-weight: 700;">时长分段</div>
                            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                                <select class="tm-input" style="width: 160px;" data-tm-call="tmSetPriorityDurationUnit">
                                    <option value="minutes" ${durationUnit === 'minutes' ? 'selected' : ''}>分钟</option>
                                    <option value="hours" ${durationUnit === 'hours' ? 'selected' : ''}>小时（可小数）</option>
                                </select>
                                <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDurationBucket">+ 添加</button>
                            </div>
                        </div>
                        ${durRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                            <div style="font-weight: 700;">文档加减分</div>
                            <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDocDelta">+ 添加</button>
                        </div>
                        ${docRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>
                </div>
                <div class="tm-settings-footer" style="padding: 12px 14px;">
                    <button class="tm-btn tm-btn-secondary" data-tm-action="closePriorityScoreSettings">取消</button>
                    <button class="tm-btn tm-btn-success" data-tm-action="savePriorityScoreSettings">保存</button>
                </div>
            </div>
        `;
    }

    function showPriorityScoreSettings() {
        if (state.priorityModal) return;
        state.priorityScoreDraft = __tmEnsurePriorityDraft();
        state.priorityModal = document.createElement('div');
        state.priorityModal.className = 'tm-modal';
        state.priorityModal.style.zIndex = '200002';
        state.priorityModal.innerHTML = __tmRenderPriorityScoreSettings(false);
        document.body.appendChild(state.priorityModal);
        __tmBindRulesManagerEvents(state.priorityModal);
    }
    window.showPriorityScoreSettings = showPriorityScoreSettings;

    function __tmRerenderPriorityScoreSettings() {
        if (state.priorityModal) {
            state.priorityModal.innerHTML = __tmRenderPriorityScoreSettings(false);
            return;
        }
        const container = state.settingsModal?.querySelector?.('#tm-priority-settings');
        if (container) container.innerHTML = __tmRenderPriorityScoreSettings(true);
    }

    window.closePriorityScoreSettings = function() {
        if (state.priorityModal) {
            state.priorityModal.remove();
            state.priorityModal = null;
            // 只有关闭独立的优先级设置模态框时才重置draft
            state.priorityScoreDraft = null;
        }
        // 在设置界面中切换Tab时，不重置draft，保留用户输入的数据
        if (state.settingsModal && state.settingsActiveTab === 'priority') {
            showSettings();
        }
    };

    window.savePriorityScoreSettings = async function() {
        if (!state.priorityScoreDraft) return;
        SettingsStore.data.priorityScoreConfig = state.priorityScoreDraft;
        await SettingsStore.save();
        applyFilters();
        render();
        closePriorityScoreSettings();
        hint('✅ 优先级算法已保存', 'success');
    };

    // 渲染四象限设置
    function renderQuadrantSettings() {
        const quadrantConfig = SettingsStore.data.quadrantConfig || {
            enabled: false,
            rules: [
                { id: 'urgent-important', name: '重要紧急', color: 'red', importance: ['high', 'medium'], timeRanges: ['overdue', 'today', 'tomorrow', 'within1days'] },
                { id: 'not-urgent-important', name: '重要不紧急', color: 'yellow', importance: ['high', 'medium'], timeRanges: ['within3days', 'beyond3days', 'within7days', 'beyond7days', 'within15days', 'beyond15days', 'within30days', 'beyond30days', 'nodate'] },
                { id: 'urgent-not-important', name: '不重要紧急', color: 'blue', importance: ['low', 'none'], timeRanges: ['overdue', 'today', 'tomorrow', 'within1days'] },
                { id: 'not-urgent-not-important', name: '不重要不紧急', color: 'green', importance: ['low', 'none'], timeRanges: ['within3days', 'beyond3days', 'within7days', 'beyond7days', 'within15days', 'beyond15days', 'within30days', 'beyond30days', 'nodate'] }
            ]
        };
        
        const rules = quadrantConfig.rules || [];
        const colorLabels = { red: '🔴 红色', yellow: '🟡 黄色', blue: '🔵 蓝色', green: '🟢 绿色' };
        const importanceLabels = { high: '高', medium: '中', low: '低', none: '无' };
        const timeRangeLabels = { 
            overdue: '已过期', 
            today: '今天', 
            tomorrow: '明天',
            within1days: '余1天以内',
            within3days: '余3天以内',
            beyond3days: '余3天以上',
            within7days: '余7天以内',
            beyond7days: '余7天以上',
            within15days: '余15天以内',
            beyond15days: '余15天以上',
            within30days: '余30天以内',
            beyond30days: '余30天以上',
            nodate: '无日期' 
        };
        
        let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
        
        rules.forEach((rule, index) => {
            const importanceNames = (rule.importance || []).map(i => importanceLabels[i] || i).join('+');
            const timeRangeNames = (rule.timeRanges || []).map(t => timeRangeLabels[t] || t).join('+');
            
            html += `
                <div style="background: var(--tm-bg-color); border: 1px solid var(--tm-border-color); border-radius: 8px; padding: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span class="tm-quadrant-indicator tm-quadrant-bg-${rule.color}"></span>
                        <span style="font-weight: 600; color: var(--tm-quadrant-${rule.color});">${esc(rule.name)}</span>
                        <span style="margin-left: auto; color: var(--tm-secondary-text); font-size: 12px;">${colorLabels[rule.color]}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                        <div style="padding: 8px; background: var(--tm-section-bg); border-radius: 4px;">
                            <div style="color: var(--tm-secondary-text); font-size: 11px; margin-bottom: 4px;">重要性</div>
                            <div>${esc(importanceNames)}</div>
                        </div>
                        <div style="padding: 8px; background: var(--tm-section-bg); border-radius: 4px;">
                            <div style="color: var(--tm-secondary-text); font-size: 11px; margin-bottom: 4px;">完成时间</div>
                            <div>${esc(timeRangeNames)}</div>
                        </div>
                    </div>
                    <div style="margin-top: 8px; display: flex; gap: 8px;">
                        <button class="tm-btn tm-btn-secondary" data-tm-call="tmEditQuadrantRule" data-tm-args='[${index}]' style="flex: 1; padding: 4px 8px; font-size: 12px;">编辑规则</button>
                        <button class="tm-btn tm-btn-secondary" data-tm-call="tmResetQuadrantRule" data-tm-args='[${index}]' style="padding: 4px 8px; font-size: 12px;">重置</button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        html += `
            <div style="margin-top: 16px; padding: 12px; background: var(--tm-info-bg); border: 1px solid var(--tm-info-border); border-radius: 8px; font-size: 12px; color: var(--tm-secondary-text);">
                <div style="font-weight: 600; margin-bottom: 8px;">📌 使用说明</div>
                <ul style="margin: 0; padding-left: 16px;">
                    <li>在顶部工具栏启用「四象限分组」即可按此规则分组显示</li>
                    <li>任务会根据「重要性」和「完成时间」自动分配到对应象限</li>
                    <li>点击「编辑规则」可自定义每个象限的条件</li>
                    <li>点击「重置」可恢复该象限的默认配置</li>
                </ul>
            </div>
        `;
        
        return html;
    }

    // 编辑四象限规则
    window.tmEditQuadrantRule = async function(index) {
        const quadrantConfig = SettingsStore.data.quadrantConfig || {
            enabled: false,
            rules: [
                { id: 'urgent-important', name: '重要紧急', color: 'red', importance: ['high', 'medium'], timeRanges: ['overdue', 'within7days'] },
                { id: 'not-urgent-important', name: '重要不紧急', color: 'yellow', importance: ['high', 'medium'], timeRanges: ['beyond7days', 'nodate'] },
                { id: 'urgent-not-important', name: '不重要紧急', color: 'blue', importance: ['low', 'none'], timeRanges: ['overdue', 'within7days'] },
                { id: 'not-urgent-not-important', name: '不重要不紧急', color: 'green', importance: ['low', 'none'], timeRanges: ['beyond7days', 'nodate'] }
            ]
        };
        
        const rules = quadrantConfig.rules || [];
        const rule = rules[index];
        if (!rule) return;
        
        const importanceOptions = [
            { value: 'high', label: '高' },
            { value: 'medium', label: '中' },
            { value: 'low', label: '低' },
            { value: 'none', label: '无' }
        ];
        
        const timeRangeOptions = [
            { value: 'overdue', label: '已过期' },
            { value: 'within3days', label: '余3天以内' },
            { value: 'beyond3days', label: '余3天以上' },
            { value: 'within7days', label: '余7天以内' },
            { value: 'beyond7days', label: '余7天以上' },
            { value: 'within15days', label: '余15天以内' },
            { value: 'beyond15days', label: '余15天以上' },
            { value: 'within30days', label: '余30天以内' },
            { value: 'beyond30days', label: '余30天以上' },
            { value: 'nodate', label: '无日期' }
        ];
        
        // 根据象限类型过滤时间范围选项
        // 判断是否紧急象限：ID必须以 'urgent-' 开头（urgent-important, urgent-not-important）
        const isUrgent = rule.id && (rule.id.startsWith('urgent-') || rule.id === 'urgent-important' || rule.id === 'urgent-not-important');
        const filteredTimeRangeOptions = timeRangeOptions.filter(opt => {
            if (isUrgent) {
                // 紧急象限：只显示已过期、以及余X天以内
                return opt.value === 'overdue' || opt.value.startsWith('within');
            } else {
                // 不紧急象限：只显示无日期、以及余X天以上
                return opt.value === 'nodate' || opt.value.startsWith('beyond');
            }
        });
        
        const importanceCheckboxes = importanceOptions.map(opt => `
            <label style="display: inline-flex; align-items: center; gap: 4px; margin-right: 12px; margin-bottom: 6px; cursor: pointer; white-space: nowrap;">
                <input type="checkbox" value="${opt.value}" ${rule.importance?.includes(opt.value) ? 'checked' : ''} data-quadrant-importance>
                ${opt.label}
            </label>
        `).join('');
        
        const timeRangeCheckboxes = filteredTimeRangeOptions.map(opt => `
            <label style="display: inline-flex; align-items: center; gap: 4px; margin-right: 12px; margin-bottom: 6px; cursor: pointer; white-space: nowrap;">
                <input type="checkbox" value="${opt.value}" ${rule.timeRanges?.includes(opt.value) ? 'checked' : ''} data-quadrant-timerange>
                ${opt.label}
            </label>
        `).join('');
        
        const modal = document.createElement('div');
        modal.className = 'tm-prompt-modal';
        modal.innerHTML = `
            <div class="tm-prompt-box" style="width: 90%; max-width: 400px; max-height: 90vh; overflow-y: auto; box-sizing: border-box;">
                <div class="tm-prompt-title">编辑四象限规则 - ${esc(rule.name)}</div>
                <div style="margin-bottom: 16px; max-height: 60vh; overflow-y: auto;">
                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 13px; font-weight: 500; margin-bottom: 6px;">重要性（可多选）</div>
                        ${importanceCheckboxes}
                    </div>
                    <div>
                        <div style="font-size: 13px; font-weight: 500; margin-bottom: 6px;">完成时间范围（可多选）</div>
                        ${timeRangeCheckboxes}
                    </div>
                </div>
                <div class="tm-prompt-buttons">
                    <button class="tm-prompt-btn tm-prompt-btn-secondary" onclick="this.closest('.tm-prompt-modal').remove()">取消</button>
                    <button class="tm-prompt-btn tm-prompt-btn-primary" id="tm-save-quadrant-rule">保存</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('tm-save-quadrant-rule').onclick = async function() {
            const selectedImportance = Array.from(modal.querySelectorAll('[data-quadrant-importance]:checked')).map(cb => cb.value);
            const selectedTimeRanges = Array.from(modal.querySelectorAll('[data-quadrant-timerange]:checked')).map(cb => cb.value);
            
            if (selectedImportance.length === 0) {
                hint('⚠ 请至少选择一个重要性条件', 'warning');
                return;
            }
            
            if (selectedTimeRanges.length === 0) {
                hint('⚠ 请至少选择一个时间范围条件', 'warning');
                return;
            }
            
            rules[index].importance = selectedImportance;
            rules[index].timeRanges = selectedTimeRanges;
            
            SettingsStore.data.quadrantConfig = quadrantConfig;
            await SettingsStore.save();
            
            modal.remove();
            hint('✅ 四象限规则已更新', 'success');
            showSettings();
        };
    };

    // 重置四象限规则
    window.tmResetQuadrantRule = async function(index) {
        const defaultRules = [
            { id: 'urgent-important', name: '重要紧急', color: 'red', importance: ['high', 'medium'], timeRanges: ['overdue', 'within7days'] },
            { id: 'not-urgent-important', name: '重要不紧急', color: 'yellow', importance: ['high', 'medium'], timeRanges: ['beyond7days', 'nodate'] },
            { id: 'urgent-not-important', name: '不重要紧急', color: 'blue', importance: ['low', 'none'], timeRanges: ['overdue', 'within7days'] },
            { id: 'not-urgent-not-important', name: '不重要不紧急', color: 'green', importance: ['low', 'none'], timeRanges: ['beyond7days', 'nodate'] }
        ];
        
        const quadrantConfig = SettingsStore.data.quadrantConfig || { enabled: false, rules: defaultRules };
        const rules = quadrantConfig.rules || [];
        
        if (rules[index]) {
            rules[index] = { ...defaultRules[index] };
            SettingsStore.data.quadrantConfig = quadrantConfig;
            await SettingsStore.save();
            hint('✅ 已重置为默认值', 'success');
            showSettings();
        }
    };

    window.tmSetPriorityBase = function(value) {
        if (!state.priorityScoreDraft) return;
        state.priorityScoreDraft.base = Number(value) || 0;
        __tmRerenderPriorityScoreSettings();
    };
    window.tmSetPriorityWeight = function(key, value) {
        if (!state.priorityScoreDraft) return;
        if (!state.priorityScoreDraft.weights) state.priorityScoreDraft.weights = {};
        state.priorityScoreDraft.weights[key] = Number(value) || 0;
        __tmRerenderPriorityScoreSettings();
    };
    window.tmSetPriorityDurationUnit = function(value) {
        if (!state.priorityScoreDraft) return;
        const v = String(value || '').trim();
        state.priorityScoreDraft.durationUnit = (v === 'hours' || v === 'minutes') ? v : 'minutes';
        __tmRerenderPriorityScoreSettings();
    };
    window.tmSetPriorityImportance = function(key, value) {
        if (!state.priorityScoreDraft) return;
        if (!state.priorityScoreDraft.importanceDelta) state.priorityScoreDraft.importanceDelta = {};
        state.priorityScoreDraft.importanceDelta[key] = Number(value) || 0;
        __tmRerenderPriorityScoreSettings();
    };
    window.tmSetPriorityStatus = function(statusId, value) {
        if (!state.priorityScoreDraft) return;
        if (!state.priorityScoreDraft.statusDelta) state.priorityScoreDraft.statusDelta = {};
        state.priorityScoreDraft.statusDelta[statusId] = Number(value) || 0;
        __tmRerenderPriorityScoreSettings();
    };
    window.tmAddPriorityDueRange = function() {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.dueRanges)) state.priorityScoreDraft.dueRanges = [];
        state.priorityScoreDraft.dueRanges.push({ days: 7, delta: 0 });
        __tmRerenderPriorityScoreSettings();
    };
    window.tmRemovePriorityDueRange = function(index) {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.dueRanges)) return;
        state.priorityScoreDraft.dueRanges.splice(index, 1);
        __tmRerenderPriorityScoreSettings();
    };
    window.tmSetPriorityDueRange = function(index, field, value) {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.dueRanges)) return;
        const row = state.priorityScoreDraft.dueRanges[index];
        if (!row) return;
        row[field] = Number(value) || 0;
        __tmRerenderPriorityScoreSettings();
    };
    window.tmAddPriorityDurationBucket = function() {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.durationBuckets)) state.priorityScoreDraft.durationBuckets = [];
        state.priorityScoreDraft.durationBuckets.push({ maxMinutes: 60, delta: 0 });
        __tmRerenderPriorityScoreSettings();
    };
    window.tmRemovePriorityDurationBucket = function(index) {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.durationBuckets)) return;
        state.priorityScoreDraft.durationBuckets.splice(index, 1);
        __tmRerenderPriorityScoreSettings();
    };
    window.tmSetPriorityDurationBucket = function(index, field, value) {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.durationBuckets)) return;
        const row = state.priorityScoreDraft.durationBuckets[index];
        if (!row) return;
        if (field === 'maxMinutes') {
            const unit = state.priorityScoreDraft.durationUnit === 'hours' ? 'hours' : 'minutes';
            const n = Number(value);
            if (!Number.isFinite(n)) {
                row.maxMinutes = 0;
            } else {
                const mins = unit === 'hours' ? (n * 60) : n;
                row.maxMinutes = Math.max(0, mins);
            }
        } else {
            row[field] = Number(value) || 0;
        }
        __tmRerenderPriorityScoreSettings();
    };
    window.tmAddPriorityDocDelta = function() {
        if (!state.priorityScoreDraft) return;
        state.priorityDocDeltaMode = 'add';
        state.priorityDocDeltaFromDocId = '';
        window.tmPickPriorityDocDelta?.('');
    };
    window.tmSetPriorityDocDelta = function(docId, value) {
        if (!state.priorityScoreDraft) return;
        if (!state.priorityScoreDraft.docDeltas || typeof state.priorityScoreDraft.docDeltas !== 'object') state.priorityScoreDraft.docDeltas = {};
        state.priorityScoreDraft.docDeltas[docId] = Number(value) || 0;
        // 不再调用 __tmRerenderPriorityScoreSettings()，避免重新渲染导致输入框失去焦点
        // 数据已保存在 state.priorityScoreDraft 中，用户点击"应用修改"或"保存"时会持久化
    };
    window.tmUpdatePriorityDocDelta = function(oldDocId, newDocId) {
        if (!state.priorityScoreDraft) return;
        const map = (state.priorityScoreDraft.docDeltas && typeof state.priorityScoreDraft.docDeltas === 'object') ? state.priorityScoreDraft.docDeltas : {};
        const from = String(oldDocId || '').trim();
        const to = String(newDocId || '').trim();
        if (!from || !to || from === to) return;
        const val = Number(map[from] ?? 0) || 0;
        delete map[from];
        if (map[to] === undefined) map[to] = val;
        state.priorityScoreDraft.docDeltas = map;
        __tmRerenderPriorityScoreSettings();
    };
    window.tmRemovePriorityDocDelta = function(docId) {
        if (!state.priorityScoreDraft) return;
        const map = (state.priorityScoreDraft.docDeltas && typeof state.priorityScoreDraft.docDeltas === 'object') ? state.priorityScoreDraft.docDeltas : {};
        delete map[docId];
        state.priorityScoreDraft.docDeltas = map;
        __tmRerenderPriorityScoreSettings();
    };

    window.tmClosePriorityDocDeltaPicker = function() {
        if (state.priorityDocDeltaPicker) {
            try { state.priorityDocDeltaPicker.remove(); } catch (e) {}
            state.priorityDocDeltaPicker = null;
        }
    };

    window.tmPriorityDocDeltaSelectDoc = function(docId) {
        const to = String(docId || '').trim();
        if (!to) return;
        const mode = String(state.priorityDocDeltaMode || 'replace');
        if (mode === 'add') {
            if (!state.priorityScoreDraft) return;
            if (!state.priorityScoreDraft.docDeltas || typeof state.priorityScoreDraft.docDeltas !== 'object') state.priorityScoreDraft.docDeltas = {};
            if (state.priorityScoreDraft.docDeltas[to] === undefined) state.priorityScoreDraft.docDeltas[to] = 0;
            __tmRerenderPriorityScoreSettings();
        } else {
            const from = String(state.priorityDocDeltaFromDocId || '').trim();
            if (!from || from === to) return;
            try { window.tmUpdatePriorityDocDelta?.(from, to); } catch (e) {}
        }
        state.priorityDocDeltaFromDocId = '';
        state.priorityDocDeltaMode = '';
        window.tmClosePriorityDocDeltaPicker?.();
    };

    window.tmPickPriorityDocDelta = async function(oldDocId) {
        if (!state.priorityScoreDraft) return;
        window.tmClosePriorityDocDeltaPicker?.();

        const docs = state.allDocuments || [];
        const groups = SettingsStore.data.docGroups || [];
        const resolveDocName = (docId) => {
            if (!docId) return '未知文档';
            const found = docs.find(d => d.id === docId);
            if (found) return found.name || '未命名文档';
            const entry = state.taskTree?.find?.(d => d.id === docId);
            return entry?.name || '未命名文档';
        };

        const selected = String(oldDocId || '').trim();
        state.priorityDocDeltaFromDocId = selected;
        state.priorityDocDeltaMode = selected ? 'replace' : 'add';

        const picker = document.createElement('div');
        picker.className = 'tm-prompt-modal';
        picker.style.zIndex = '100011';
        picker.innerHTML = `
            <div class="tm-prompt-box" style="width:min(92vw,520px);max-height:70vh;overflow:auto;">
                <div class="tm-prompt-title" style="margin:0 0 10px 0;">选择文档</div>
                <div id="tmPriorityDocDeltaList"></div>
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="tm-btn tm-btn-gray" onclick="tmClosePriorityDocDeltaPicker()" style="padding: 6px 10px; font-size: 12px;">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(picker);
        state.priorityDocDeltaPicker = picker;

        const listEl = picker.querySelector('#tmPriorityDocDeltaList');

        const renderGroup = (label, docs0, groupKey, initialOpen = false) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'border:1px solid var(--tm-border-color);border-radius:8px;margin-bottom:8px;overflow:hidden;';
            const head = document.createElement('div');
            head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--tm-header-bg);cursor:pointer;';
            head.innerHTML = `<div style="font-weight:600;">${esc(label)}</div><div style="opacity:0.75;">${initialOpen ? '▾' : '▸'}</div>`;
            const body = document.createElement('div');
            body.style.cssText = `padding:6px 10px;display:${initialOpen ? 'block' : 'none'};`;

            const renderDocs = (docList) => {
                body.innerHTML = '';
                if (!docList || docList.length === 0) {
                    body.innerHTML = '<div style="color:var(--tm-secondary-text);padding:8px 0;font-size:13px;">暂无文档</div>';
                    return;
                }
                docList.forEach(d => {
                    const id = String(d?.id || d || '').trim();
                    if (!id) return;
                    const row = document.createElement('div');
                    const checked = id === selected;
                    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;';
                    row.innerHTML = `<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(resolveDocName(id))}</div><div style="margin-left:10px;">${checked ? '✅' : '◻️'}</div>`;
                    row.onclick = () => window.tmPriorityDocDeltaSelectDoc?.(id);
                    body.appendChild(row);
                });
            };

            if (initialOpen) renderDocs(docs0);

            head.onclick = async () => {
                const open = body.style.display !== 'none';
                if (!open) {
                    body.style.display = 'block';
                    head.lastElementChild.textContent = '▾';
                    if (groupKey) {
                        body.innerHTML = '<div style="color:var(--tm-secondary-text);padding:8px 0;font-size:13px;">🔄 加载文档中...</div>';
                        try {
                            const allSet = new Set();
                            const entries = Array.isArray(docs0) ? docs0 : [];
                            await Promise.all(entries.map(async (d) => {
                                const id = String(d?.id || d || '').trim();
                                if (!id) return;
                                allSet.add(id);
                                const rec = !!(typeof d === 'object' && d && d.recursive);
                                if (rec) {
                                    try {
                                        const subIds = await API.getSubDocIds(id);
                                        (subIds || []).forEach(sid => {
                                            const s = String(sid || '').trim();
                                            if (s) allSet.add(s);
                                        });
                                    } catch (e) {}
                                }
                            }));
                            const allIds = Array.from(allSet);

                            const tasksMap = new Map();
                            allIds.forEach(id => {
                                const treeDoc = state.taskTree.find(d => d.id === id);
                                if (treeDoc && treeDoc.tasks && treeDoc.tasks.length > 0) tasksMap.set(id, true);
                            });

                            const uncheckedIds = allIds.filter(id => !tasksMap.has(id));
                            if (uncheckedIds.length > 0) {
                                const CHUNK_SIZE = 50;
                                for (let i = 0; i < uncheckedIds.length; i += CHUNK_SIZE) {
                                    const chunk = uncheckedIds.slice(i, i + CHUNK_SIZE);
                                    const idsStr = chunk.map(id => `'${id}'`).join(',');
                                    const sql = `SELECT DISTINCT root_id FROM blocks WHERE type='i' AND subtype='t' AND root_id IN (${idsStr})`;
                                    try {
                                        const res = await API.call('/api/query/sql', { stmt: sql });
                                        if (res.code === 0 && res.data) res.data.forEach(row => tasksMap.set(row.root_id, true));
                                    } catch (e) {}
                                }
                            }

                            const docList = allIds.map(id => ({ id, hasTasks: tasksMap.has(id) })).filter(item => item.hasTasks);
                            docList.sort((a, b) => resolveDocName(a.id).localeCompare(resolveDocName(b.id)));
                            renderDocs(docList);
                        } catch (e) {
                            renderDocs(docs0);
                        }
                    } else {
                        renderDocs(docs0);
                    }
                } else {
                    body.style.display = 'none';
                    head.lastElementChild.textContent = '▸';
                }
            };

            wrap.appendChild(head);
            wrap.appendChild(body);
            return wrap;
        };

        groups.forEach(g => {
            const ds = Array.isArray(g?.docs) ? g.docs : [];
            if (ds.length === 0) return;
            listEl.appendChild(renderGroup(String(g?.name || '分组'), ds, String(g?.id || '')));
        });
    };

    function __tmRerenderRulesManagerUI(scope) {
        const html = renderRulesList();
        if (state.rulesModal) {
            if (scope === 'conditions') {
                const el = state.rulesModal.querySelector('.tm-rule-conditions');
                if (el && state.editingRule) el.innerHTML = renderConditions(state.editingRule.conditions);
            } else if (scope === 'sort') {
                const el = state.rulesModal.querySelector('.tm-rule-sort-items');
                if (el && state.editingRule) el.innerHTML = renderSortRules(state.editingRule.sort);
            } else {
                const el = state.rulesModal.querySelector('.tm-rules-body');
                if (el) el.innerHTML = html;
            }
        }
        if (state.settingsModal) {
            if (scope === 'conditions') {
                const el = state.settingsModal.querySelector('.tm-rule-conditions');
                if (el && state.editingRule) el.innerHTML = renderConditions(state.editingRule.conditions);
            } else if (scope === 'sort') {
                const el = state.settingsModal.querySelector('.tm-rule-sort-items');
                if (el && state.editingRule) el.innerHTML = renderSortRules(state.editingRule.sort);
            } else {
                const el = state.settingsModal.querySelector('#tm-rules-list');
                if (el) el.innerHTML = html;
            }
        }
    }

    window.addNewRule = function() {
        const newRule = RuleManager.createRule('新规则');
        state.editingRule = newRule;
        __tmRerenderRulesManagerUI();
    };

    window.editRule = function(ruleId) {
        const rule = state.filterRules.find(r => r.id === ruleId);
        if (rule) {
            state.editingRule = JSON.parse(JSON.stringify(rule));
            __tmRerenderRulesManagerUI();
        }
    };

    window.cancelEditRule = function() {
        state.editingRule = null;
        __tmRerenderRulesManagerUI();
    };

    window.saveEditRule = async function() {
        if (!state.editingRule) return;
        
        const index = state.filterRules.findIndex(r => r.id === state.editingRule.id);
        if (index >= 0) {
            state.filterRules[index] = state.editingRule;
        } else {
            state.filterRules.push(state.editingRule);
        }
        
        state.editingRule = null;
        try { await RuleManager.saveRules(state.filterRules); } catch (e) {}
        __tmRerenderRulesManagerUI();
        hint('✅ 规则已保存', 'success');
    };

    window.updateEditingRuleName = function(name) {
        if (state.editingRule) {
            state.editingRule.name = name;
        }
    };

    window.addCondition = function() {
        if (!state.editingRule) return;
        
        const availableFields = RuleManager.getAvailableFields();
        const firstField = availableFields[0];
        const operators = RuleManager.getOperators(firstField.type);
        
        state.editingRule.conditions.push({
            field: firstField.value,
            operator: operators[0].value,
            value: ''
        });
        
        __tmRerenderRulesManagerUI('conditions');
    };

    window.updateConditionField = function(index, field) {
        if (state.editingRule && state.editingRule.conditions[index]) {
            state.editingRule.conditions[index].field = field;
            // 重置操作符和值为新字段的默认值
            const availableFields = RuleManager.getAvailableFields();
            const fieldInfo = availableFields.find(f => f.value === field);
            const operators = RuleManager.getOperators(fieldInfo?.type || 'text');
            state.editingRule.conditions[index].operator = operators[0].value;
            state.editingRule.conditions[index].value = '';
            
            if (state.rulesModal) {
                const conditionsDiv = state.rulesModal.querySelector('.tm-rule-conditions');
                conditionsDiv.innerHTML = renderConditions(state.editingRule.conditions);
            }
            if (state.settingsModal) {
                const conditionsDiv = state.settingsModal.querySelector('.tm-rule-conditions');
                if (conditionsDiv) conditionsDiv.innerHTML = renderConditions(state.editingRule.conditions);
            }
        }
    };

    window.updateConditionOperator = function(index, operator) {
        if (state.editingRule && state.editingRule.conditions[index]) {
            state.editingRule.conditions[index].operator = operator;

            // 如果操作符变为 between，初始化值对象
            if (operator === 'between') {
                state.editingRule.conditions[index].value = { from: '', to: '' };
            }
            // 如果操作符变为 in/not_in，初始化为数组
            else if (operator === 'in' || operator === 'not_in') {
                const fieldInfo = RuleManager.getAvailableFields().find(f => f.value === state.editingRule.conditions[index].field);
                if (fieldInfo?.type === 'select') {
                    // 初始化为所有选项都选中，或者根据当前单值转换
                    const currentValue = state.editingRule.conditions[index].value;
                    if (typeof currentValue === 'string' && currentValue && !currentValue.includes(',')) {
                        state.editingRule.conditions[index].value = [currentValue];
                    } else if (!Array.isArray(currentValue)) {
                        state.editingRule.conditions[index].value = [...(fieldInfo.options || [])];
                    }
                }
            }
            // 如果操作符从 in/not_in 变为其他，重置为单值
            else {
                const fieldInfo = RuleManager.getAvailableFields().find(f => f.value === state.editingRule.conditions[index].field);
                if (fieldInfo?.type === 'select' && Array.isArray(state.editingRule.conditions[index].value)) {
                    // 取第一个值或空
                    state.editingRule.conditions[index].value = state.editingRule.conditions[index].value[0] || '';
                }
            }
            
            // 立即重新渲染条件区域，以更新值输入框的类型
            __tmRerenderRulesManagerUI('conditions');
        }
    };

    window.updateConditionValue = function(index, value) {
        if (state.editingRule && state.editingRule.conditions[index]) {
            state.editingRule.conditions[index].value = value;
        }
    };

    // 切换多值选择的选项
    window.toggleConditionMultiValue = function(index, optionValue, isChecked) {
        if (!state.editingRule || !state.editingRule.conditions[index]) return;

        const condition = state.editingRule.conditions[index];
        let currentValues = [];

        if (Array.isArray(condition.value)) {
            currentValues = [...condition.value];
        } else if (typeof condition.value === 'string' && condition.value.includes(',')) {
            currentValues = condition.value.split(',').map(v => v.trim());
        }

        if (isChecked) {
            if (!currentValues.includes(optionValue)) {
                currentValues.push(optionValue);
            }
        } else {
            currentValues = currentValues.filter(v => v !== optionValue);
        }

        condition.value = currentValues;
    };

    window.updateConditionValueRange = function(index, key, value) {
        if (state.editingRule && state.editingRule.conditions[index]) {
            if (!state.editingRule.conditions[index].value || typeof state.editingRule.conditions[index].value !== 'object') {
                state.editingRule.conditions[index].value = { from: '', to: '' };
            }
            state.editingRule.conditions[index].value[key] = value;
        }
    };

    window.removeCondition = function(index) {
        if (state.editingRule) {
            state.editingRule.conditions.splice(index, 1);
            __tmRerenderRulesManagerUI('conditions');
        }
    };

    window.addSortRule = function() {
        if (!state.editingRule) return;
        
        state.editingRule.sort.push({
            field: 'priority',
            order: 'desc'
        });
        
        __tmRerenderRulesManagerUI('sort');
    };

    window.updateSortField = function(index, field) {
        if (state.editingRule && state.editingRule.sort[index]) {
            state.editingRule.sort[index].field = field;
        }
    };

    window.updateSortOrder = function(index, order) {
        if (state.editingRule && state.editingRule.sort[index]) {
            state.editingRule.sort[index].order = order;
        }
    };

    window.removeSortRule = function(index) {
        if (state.editingRule) {
            state.editingRule.sort.splice(index, 1);
            __tmRerenderRulesManagerUI('sort');
        }
    };

    window.moveSortRule = function(index, delta) {
        if (!state.editingRule) return;
        const list = state.editingRule.sort || [];
        const from = Number(index);
        const d = Number(delta);
        const to = from + d;
        if (!Number.isInteger(from) || !Number.isInteger(to)) return;
        if (from < 0 || from >= list.length) return;
        if (to < 0 || to >= list.length) return;
        const tmp = list[from];
        list[from] = list[to];
        list[to] = tmp;
        state.editingRule.sort = list;
        __tmRerenderRulesManagerUI('sort');
    };

    window.toggleRuleEnabled = function(ruleId, enabled) {
        const rule = state.filterRules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = enabled;
            try {
                SettingsStore.data.filterRules = state.filterRules;
                SettingsStore.save();
            } catch (e) {}
        }
    };

    window.deleteRule = function(ruleId) {
        if (!confirm('确定要删除这个规则吗？')) return;
        
        const index = state.filterRules.findIndex(r => r.id === ruleId);
        if (index >= 0) {
            state.filterRules.splice(index, 1);
            if (state.currentRule === ruleId) {
                state.currentRule = null;
            }
            try {
                SettingsStore.data.filterRules = state.filterRules;
                if (SettingsStore.data.currentRule === ruleId) SettingsStore.data.currentRule = null;
                SettingsStore.save();
            } catch (e) {}
            __tmRerenderRulesManagerUI();
            hint('✅ 规则已删除', 'success');
        }
    };

    window.applyRuleNow = async function(ruleId) {
        const rule = state.filterRules.find(r => r.id === ruleId);
        if (rule) {
            state.currentRule = ruleId;
            SettingsStore.data.currentRule = ruleId;
            await SettingsStore.save();
            applyFilters();
            render();
            closeRulesManager();
            hint(`✅ 已应用规则: ${rule.name}`, 'success');
        }
    };

    window.closeRulesManager = function() {
        if (state.rulesModal) {
            state.rulesModal.remove();
            state.rulesModal = null;
        }
        if (state.priorityModal) {
            state.priorityModal.remove();
            state.priorityModal = null;
        }
    };

    window.saveRules = async function() {
        await RuleManager.saveRules(state.filterRules);
        // 同时保存当前选中的规则
        SettingsStore.data.currentRule = state.currentRule;
        await SettingsStore.save();
        hint('✅ 所有规则已保存', 'success');
        closeRulesManager();
    };

    // 修改原有的applyFilters函数以支持规则
    function applyFilters() {
        let tasks = [];
        
        // 初始化 activeDocId
        state.activeDocId = state.activeDocId || 'all';
        
        // 收集所有任务
        state.taskTree.forEach(doc => {
            // 如果选中了特定文档，只收集该文档的任务
            if (state.activeDocId !== 'all' && doc.id !== state.activeDocId) return;

            // 递归收集所有子任务，确保扁平化列表包含所有层级
            const collect = (list) => {
                list.forEach(t => {
                    tasks.push(t);
                    if (t.children && t.children.length > 0) {
                        collect(t.children);
                    }
                });
            };
            collect(doc.tasks);
        });

        const taskMap = state.flatTasks || {};
        const hasDoneAncestor = (task) => {
            let parentId = task?.parentTaskId;
            const seen = new Set();
            while (parentId) {
                if (seen.has(parentId)) break;
                seen.add(parentId);
                const parent = taskMap[parentId];
                if (!parent) break;
                if (parent.done) return true;
                parentId = parent.parentTaskId;
            }
            return false;
        };

        // 排除已完成任务的设置
        const excludeCompleted = state.excludeCompletedTasks;

        // 检查当前规则是否明确排除已完成任务
        const currentRuleExcludesCompleted = () => {
            const rule = state.currentRule ? state.filterRules.find(r => r.id === state.currentRule) : null;
            if (!rule || !rule.conditions || rule.conditions.length === 0) return false;

            // 检查是否有条件明确要求排除已完成任务 (done = false)
            return rule.conditions.some(condition =>
                condition.field === 'done' &&
                condition.operator === '=' &&
                String(condition.value) === 'false'
            );
        };

        // 过滤逻辑：
        // 1. 未完成父任务下的所有子任务（无论是否完成）保留显示
        // 2. 如果 excludeCompleted 开启，已完成根任务：过滤
        // 3. 已完成父任务下的所有子任务：过滤
        // 4. 如果 excludeCompleted 开启且当前规则没有排除已完成，则已完成子任务（父任务未完成）保留显示
        const ruleExcludesCompleted = currentRuleExcludesCompleted();
        tasks = tasks.filter(t => {
            // 排除已完成任务时，已完成根任务才过滤
            if (excludeCompleted && t.done && !t.parentTaskId) return false;

            // 父任务已完成：过滤
            if (hasDoneAncestor(t)) return false;

            // 已完成子任务（父任务未完成）的处理
            if (excludeCompleted && t.done && t.parentTaskId) {
                // 如果当前规则没有明确排除已完成任务，则保留显示已完成子任务
                if (!ruleExcludesCompleted) return true;
                // 如果当前规则明确排除已完成任务，则过滤
                return false;
            }

            return true;
        });

        tasks.forEach(t => {
            try { t.priorityScore = __tmComputePriorityScore(t); } catch (e) { t.priorityScore = 0; }
        });
        
        const rule = state.currentRule ? state.filterRules.find(r => r.id === state.currentRule) : null;

        let matched = tasks;
        if (rule) {
            matched = RuleManager.applyRuleFilter(matched, rule);
        }

        if (state.searchKeyword) {
            const keyword = state.searchKeyword.toLowerCase();
            matched = matched.filter(task => String(task.content || '').toLowerCase().includes(keyword));
        }

        const matchedSet = new Set();
        matched.forEach(t => matchedSet.add(t.id));

        const ancestorSet = new Set();
        try {
            matched.forEach(t => {
                let parentId = t?.parentTaskId;
                const seen = new Set();
                while (parentId) {
                    if (seen.has(parentId)) break;
                    seen.add(parentId);
                    const p = taskMap[parentId];
                    if (!p) break;
                    ancestorSet.add(p.id);
                    parentId = p.parentTaskId;
                }
            });
        } catch (e) {}

        const ordered = [];
        const added = new Set();
        const traverse = (list, ancestorMatched = false) => {
            const siblings = RuleManager.applyRuleSort(list || [], rule);
            siblings.forEach(t => {
                if (!t) return;
                // 如果任务本身已完成且有已完成祖先，则不显示（这是合理的）
                // 但已完成子任务（父任务未完成）应该显示，所以不能在这里过滤
                // 这里只检查是否已存在于 matchedSet（由规则筛选结果决定）
                const isMatched = matchedSet.has(t.id);
                const isAncestor = ancestorSet.has(t.id);
                const show = isMatched || isAncestor || ancestorMatched;
                if (show && !added.has(t.id)) {
                    added.add(t.id);
                    ordered.push(t);
                }
                // 无论任务是否完成，都需要处理子任务
                if (t.children && t.children.length > 0) {
                    traverse(t.children, ancestorMatched || isMatched);
                }
            });
        };

        if (state.activeDocId === 'all') {
            // 全部模式下：先收集所有任务，再进行全局排序
            // 这样排序规则 > 文档分组
            
            // 收集所有文档的所有任务到一个扁平数组
            const allTasks = [];
            const collectAll = (list) => {
                list.forEach(t => {
                    allTasks.push(t);
                    if (t.children && t.children.length > 0) {
                        collectAll(t.children);
                    }
                });
            };
            state.taskTree.forEach(doc => {
                collectAll(doc.tasks || []);
            });
            
            // 确保所有任务都有 priorityScore（排序需要）
            allTasks.forEach(t => {
                try { t.priorityScore = __tmComputePriorityScore(t); } catch (e) { t.priorityScore = 0; }
            });
            
            // 对所有任务应用排序规则
            const sortedAllTasks = RuleManager.applyRuleSort(allTasks, rule);
            
            // 筛选并保持排序后的顺序
            const globalAdded = new Set();
            sortedAllTasks.forEach(t => {
                if (!t) return;

                // 检查是否应该过滤（与之前的过滤逻辑保持一致）
                let shouldFilter = false;

                // 已完成根任务且开启了排除已完成
                if (excludeCompleted && t.done && !t.parentTaskId) {
                    shouldFilter = true;
                }
                // 父任务已完成
                else if (hasDoneAncestor(t)) {
                    shouldFilter = true;
                }
                // 已完成子任务（父任务未完成）的处理
                else if (excludeCompleted && t.done && t.parentTaskId && !hasDoneAncestor(t)) {
                    // 如果当前规则没有明确排除已完成任务，则保留显示已完成子任务
                    if (ruleExcludesCompleted) {
                        shouldFilter = true;
                    }
                }

                if (shouldFilter) return;
                
                const isMatched = matchedSet.has(t.id);
                const isAncestor = ancestorSet.has(t.id);
                if (isMatched || isAncestor) {
                    if (!globalAdded.has(t.id)) {
                        globalAdded.add(t.id);
                        ordered.push(t);
                    }
                }
            });
        } else {
            // 单个文档模式下：保持原有逻辑
            state.taskTree.forEach(doc => {
                if (state.activeDocId !== 'all' && doc.id !== state.activeDocId) return;
                traverse(doc.tasks || [], false);
            });
        }

        state.filteredTasks = ordered;
    }

    window.tmSwitchDoc = function(docId) {
        state.activeDocId = docId;
        applyFilters();
        render();
    };

    // 搜索弹窗
    window.tmShowSearchModal = function() {
        const modal = document.createElement('div');
        modal.className = 'tm-modal';
        modal.style.zIndex = '200001'; // 高于主界面
        modal.innerHTML = `
            <div class="tm-box" style="width: 500px; height: auto; max-height: 80vh; position: relative;">
                <div class="tm-header">
                    <div style="font-size: 18px; font-weight: bold; color: var(--tm-text-color);">🔍 搜索任务</div>
                    <button class="tm-btn tm-btn-gray" onclick="this.closest('.tm-modal').remove()">关闭</button>
                </div>
                <div style="padding: 20px;">
                    <input type="text" id="tmPopupSearchInput" class="tm-input" 
                           placeholder="输入关键词搜索..." 
                           value="${state.searchKeyword}" 
                           style="width: 100%; margin-bottom: 15px; font-size: 16px; padding: 8px;">
                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                         <button class="tm-btn tm-btn-secondary" onclick="tmSearch(''); this.closest('.tm-modal').remove()">清除搜索</button>
                         <button class="tm-btn tm-btn-primary" onclick="tmSearch(document.getElementById('tmPopupSearchInput').value); this.closest('.tm-modal').remove()">搜索</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        // 自动聚焦
        setTimeout(() => modal.querySelector('input').focus(), 50);
        
        // 回车搜索
        const input = modal.querySelector('input');
        input.onkeyup = (e) => {
            if (e.key === 'Enter') {
                tmSearch(input.value);
                modal.remove();
            }
        };
    };

    window.tmSearch = function(keyword) {
        const next = String(keyword || '').trim();
        state.searchKeyword = next;
        applyFilters();
        render();
    };

    window.tmSwitchDocGroup = async function(groupId) {
        const nextGroupId = String(groupId || 'all').trim() || 'all';
        const prevGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (nextGroupId === prevGroupId) {
            try { __tmHideMobileMenu(); } catch (e) {}
            return;
        }
        SettingsStore.data.currentGroupId = nextGroupId;

        const firstRuleId = (state.filterRules || []).find(r => r && r.enabled)?.id || '';
        state.currentRule = firstRuleId || null;
        SettingsStore.data.currentRule = firstRuleId || null;

        await SettingsStore.save();
        try { __tmHideMobileMenu(); } catch (e) {}
        await loadSelectedDocuments();
    };

    window.tmDocTabDragOver = function(ev) {
        try {
            ev.preventDefault?.();
            ev.dataTransfer.dropEffect = 'move';
        } catch (e) {}
    };

    window.tmDocTabDragEnter = function(ev) {
        try {
            ev.preventDefault?.();
            ev.dataTransfer.dropEffect = 'move';
        } catch (e) {}
        try { ev.currentTarget?.classList?.add('is-drop-target'); } catch (e) {}
    };

    window.tmDocTabDragLeave = function(ev) {
        try { ev.currentTarget?.classList?.remove('is-drop-target'); } catch (e) {}
    };

    window.tmDocTabDrop = async function(ev, docId) {
        try {
            ev.preventDefault?.();
            ev.stopPropagation?.();
        } catch (e) {}
        try { ev.currentTarget?.classList?.remove('is-drop-target'); } catch (e) {}
        const targetDocId = String(docId || '').trim();
        if (!targetDocId || targetDocId === 'all') return;
        let taskId = '';
        try {
            taskId = String(ev?.dataTransfer?.getData?.('text/plain') || '').trim();
        } catch (e) {}
        if (!taskId) return;
        const task = state.flatTasks?.[taskId];
        if (!task) return;
        const fromDocId = String(task.docId || task.root_id || '').trim();
        if (fromDocId && fromDocId === targetDocId) return;
        try {
            hint('🔄 正在移动任务...', 'info');
            const topListId = await API.getFirstDirectChildListIdOfDoc(targetDocId);
            if (topListId) {
                await API.moveBlock(taskId, { parentID: topListId });
            } else {
                await API.moveBlock(taskId, { parentID: targetDocId });
            }
            try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e) {}

            try {
                const t = state.flatTasks?.[taskId];
                if (t) {
                    t.root_id = targetDocId;
                    t.docId = targetDocId;
                    const name = state.allDocuments.find(d => d.id === targetDocId)?.name || '';
                    if (name) {
                        t.doc_name = name;
                        t.docName = name;
                    }
                }
            } catch (e) {}

            hint('✅ 任务已移动', 'success');
            await loadSelectedDocuments();
        } catch (e) {
            hint(`❌ 移动失败: ${e.message}`, 'error');
        }
    };

    window.tmDragTaskStart = function(ev, taskId) {
        const id = String(taskId || '').trim();
        if (!id) return;
        try {
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('text/plain', id);
        } catch (e) {}
    };

    window.tmRowClick = function(ev, taskId) {
        const id = String(taskId || '').trim();
        if (!id) return;
        const t = ev?.target;
        if (t?.closest?.('button,input,select,textarea,a,.tm-task-content-clickable,.tm-tree-toggle,.tm-col-resize')) return;
        const task = state.flatTasks?.[id];
        if (!task) return;
        const filteredSet = new Set((state.filteredTasks || []).map(x => x.id));
        const hasVisibleChild = (task.children || []).some(c => filteredSet.has(c.id));
        if (!hasVisibleChild) return;
        tmToggleCollapse(id, ev);
    };

    window.tmToggleDocTabs = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        state.docTabsHidden = !state.docTabsHidden;
        try { Storage.set('tm_doc_tabs_hidden', !!state.docTabsHidden); } catch (e) {}
        render();
    };

    // 修改渲染函数以显示规则信息
    function render() {
        // 保存滚动位置
        let savedScrollTop = 0;
        let savedScrollLeft = 0;
        let savedTimelineScrollTop = 0;
        let savedTimelineScrollLeft = 0;
        if (state.modal) {
            const timelineLeftBody = state.modal.querySelector('#tmTimelineLeftBody');
            const ganttBody = state.modal.querySelector('#tmGanttBody');
            if (timelineLeftBody) {
                savedTimelineScrollTop = timelineLeftBody.scrollTop;
                if (ganttBody) savedTimelineScrollLeft = ganttBody.scrollLeft;
            } else {
                const body = state.modal.querySelector('.tm-body');
                if (body) {
                    savedScrollTop = body.scrollTop;
                    savedScrollLeft = body.scrollLeft;
                }
            }
            state.modal.remove();
        }
        try {
            state.viewScroll = state.viewScroll && typeof state.viewScroll === 'object' ? state.viewScroll : {};
            if (savedTimelineScrollTop || savedTimelineScrollLeft) {
                state.viewScroll.timeline = { top: savedTimelineScrollTop, left: savedTimelineScrollLeft };
            } else if (savedScrollTop || savedScrollLeft) {
                state.viewScroll.list = { top: savedScrollTop, left: savedScrollLeft };
            }
        } catch (e) {}
        
        // 应用字体大小
        document.documentElement.style.setProperty('--tm-font-size', (__tmGetFontSize()) + 'px');
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}

        const { totalTasks, doneTasks, queryTime } = state.stats;
        const todoTasks = totalTasks - doneTasks;
        const filteredCount = state.filteredTasks.length;
        
        const currentRule = state.currentRule ? 
            state.filterRules.find(r => r.id === state.currentRule) : null;

        const globalNewTaskDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        const visibleDocs = state.taskTree
            .filter(doc => __tmDocHasUndoneTasks(doc))
            .filter(doc => !globalNewTaskDocId || doc.id !== globalNewTaskDocId);
            
        // 获取文档分组信息
        const docGroups = SettingsStore.data.docGroups || [];
        const currentGroupId = SettingsStore.data.currentGroupId || 'all';
        const currentGroup = docGroups.find(g => g.id === currentGroupId);
        const groupName = currentGroupId === 'all' ? '全部文档' : (currentGroup ? currentGroup.name : '未知分组');
        const isMobile = __tmIsMobileDevice();
        const isLandscape = !!(isMobile && (() => { try { return !!window.matchMedia?.('(orientation: landscape)')?.matches; } catch (e) { return false; } })());
        
        state.modal = document.createElement('div');
        state.modal.className = 'tm-modal' + (__tmMountEl ? ' tm-modal--tab' : '') + (isMobile ? ' tm-modal--mobile' : '');
        
        // 构建规则选择选项
        const ruleOptions = state.filterRules
            .filter(rule => rule.enabled)
            .map(rule => `<option value="${rule.id}" ${state.currentRule === rule.id ? 'selected' : ''}>
                ${esc(rule.name)}
            </option>`)
            .join('');

        const __tmRenderListBodyHtml = () => `
                <div class="tm-body">
                    <table class="tm-table" id="tmTaskTable">
                        <thead>
                            <tr>
                                ${(() => {
                                    const colOrder = SettingsStore.data.columnOrder || ['pinned', 'content', 'status', 'score', 'doc', 'h2', 'priority', 'startDate', 'completionTime', 'duration', 'spent', 'remark'];
                                    const widths = SettingsStore.data.columnWidths || {};
                                    const headers = {
                                        pinned: `<th data-col="pinned" style="width: ${widths.pinned || 48}px; min-width: ${widths.pinned || 48}px; max-width: ${widths.pinned || 48}px; text-align: center; white-space: nowrap; overflow: hidden;">📌<span class="tm-col-resize" onmousedown="startColResize(event, 'pinned')"></span></th>`,
                                        content: `<th data-col="content" style="width: ${widths.content || 360}px; min-width: ${widths.content || 360}px; max-width: ${widths.content || 360}px; white-space: nowrap; overflow: hidden;">任务内容<span class="tm-col-resize" onmousedown="startColResize(event, 'content')"></span></th>`,
                                        score: `<th data-col="score" style="width: ${widths.score || 96}px; min-width: ${widths.score || 96}px; max-width: ${widths.score || 96}px; text-align: center; white-space: nowrap; overflow: hidden;">优先级<span class="tm-col-resize" onmousedown="startColResize(event, 'score')"></span></th>`,
                                        doc: `<th data-col="doc" style="width: ${widths.doc || 180}px; min-width: ${widths.doc || 180}px; max-width: ${widths.doc || 180}px; white-space: nowrap; overflow: hidden;">文档<span class="tm-col-resize" onmousedown="startColResize(event, 'doc')"></span></th>`,
                                        h2: (() => {
                                            const level = SettingsStore.data.taskHeadingLevel || 'h2';
                                            const labels = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
                                            const label = labels[level] || '标题';
                                            return `<th data-col="h2" style="width: ${widths.h2 || 180}px; min-width: ${widths.h2 || 180}px; max-width: ${widths.h2 || 180}px; white-space: nowrap; overflow: hidden;">${label}<span class="tm-col-resize" onmousedown="startColResize(event, 'h2')"></span></th>`;
                                        })(),
                                        priority: `<th data-col="priority" style="width: ${widths.priority || 96}px; min-width: ${widths.priority || 96}px; max-width: ${widths.priority || 96}px; text-align: center; white-space: nowrap; overflow: hidden;">重要性<span class="tm-col-resize" onmousedown="startColResize(event, 'priority')"></span></th>`,
                                        startDate: `<th data-col="startDate" style="width: ${widths.startDate || 90}px; min-width: ${widths.startDate || 90}px; max-width: ${widths.startDate || 90}px; white-space: nowrap; overflow: hidden;">开始日期<span class="tm-col-resize" onmousedown="startColResize(event, 'startDate')"></span></th>`,
                                        completionTime: `<th data-col="completionTime" style="width: ${widths.completionTime || 170}px; min-width: ${widths.completionTime || 170}px; max-width: ${widths.completionTime || 170}px; white-space: nowrap; overflow: hidden;">完成时间<span class="tm-col-resize" onmousedown="startColResize(event, 'completionTime')"></span></th>`,
                                        duration: `<th data-col="duration" style="width: ${widths.duration || 96}px; min-width: ${widths.duration || 96}px; max-width: ${widths.duration || 96}px; white-space: nowrap; overflow: hidden;">时长<span class="tm-col-resize" onmousedown="startColResize(event, 'duration')"></span></th>`,
                                        spent: `<th data-col="spent" style="width: ${widths.spent || 96}px; min-width: ${widths.spent || 96}px; max-width: ${widths.spent || 96}px; white-space: nowrap; overflow: hidden;">耗时<span class="tm-col-resize" onmousedown="startColResize(event, 'spent')"></span></th>`,
                                        remark: `<th data-col="remark" style="width: ${widths.remark || 240}px; min-width: ${widths.remark || 240}px; max-width: ${widths.remark || 240}px; white-space: nowrap; overflow: hidden;">备注<span class="tm-col-resize" onmousedown="startColResize(event, 'remark')"></span></th>`,
                                        status: `<th data-col="status" style="width: ${widths.status || 96}px; min-width: ${widths.status || 96}px; max-width: ${widths.status || 96}px; text-align: center; white-space: nowrap; overflow: hidden;">状态<span class="tm-col-resize" onmousedown="startColResize(event, 'status')"></span></th>`
                                    };
                                    return colOrder.map(col => headers[col] || '').join('');
                                })()}
                            </tr>
                        </thead>
                        <tbody>
                            ${renderTaskList()}
                        </tbody>
                    </table>
                </div>
            `;

        const __tmRenderTimelineBodyHtml = (rowModel) => {
            const widths = SettingsStore.data.columnWidths || {};
            const isGloballyLocked = GlobalLock.isLocked();
            const leftWidth0 = Number(SettingsStore.data.timelineLeftWidth);
            const timelineContentWidth0 = Number(SettingsStore.data.timelineContentWidth);
            const timelineContentWidth = Number.isFinite(timelineContentWidth0) ? Math.max(160, Math.min(800, Math.round(timelineContentWidth0))) : (Number(widths.content) || 360);
            const timelineStartW = Math.max(60, Math.min(240, Math.round(Number(widths.startDate) || 90)));
            const timelineEndW = Math.max(120, Math.min(360, Math.round(Number(widths.completionTime) || 170)));
            const leftTableWidth = Math.round(timelineContentWidth + timelineStartW + timelineEndW + 2);
            const computedAuto = leftTableWidth;
            const leftWidth = (Number.isFinite(leftWidth0) && leftWidth0 > 0)
                ? Math.max(360, Math.min(900, Math.round(leftWidth0)))
                : Math.max(360, Math.min(900, computedAuto));
            const isDark = __tmIsDarkMode();
            const progressBarColor = isDark
                ? __tmNormalizeHexColor(SettingsStore.data.progressBarColorDark, '#81c784')
                : __tmNormalizeHexColor(SettingsStore.data.progressBarColorLight, '#4caf50');

            const renderGroupRow = (row) => {
                const isCollapsed = !!row?.collapsed;
                const toggle = `<span class="tm-group-toggle" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;margin-right:8px;display:inline-block;width:12px;">${isCollapsed ? '▸' : '▾'}</span>`;
                if (row.kind === 'doc') {
                    return `<tr class="tm-group-row tm-timeline-row"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);">${toggle}<span class="tm-group-label" style="color: var(--tm-group-doc-label-color);">📄 ${esc(row.label || '')}</span> <span style="font-weight:normal;color:var(--tm-secondary-text);font-size:12px;background:var(--tm-doc-count-bg);padding:1px 6px;border-radius:10px;margin-left:4px;">${Number(row.count) || 0}</span></td></tr>`;
                }
                if (row.kind === 'time') {
                    const labelColor = String(row.labelColor || 'var(--tm-text-color)');
                    const durationSum = String(row.durationSum || '').trim();
                    return `<tr class="tm-group-row tm-timeline-row"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);">${toggle}<span class="tm-group-label" style="color:${labelColor};">${esc(row.label || '')}</span> <span style="font-weight:normal;color:var(--tm-secondary-text);font-size:12px;background:var(--tm-doc-count-bg);padding:1px 6px;border-radius:10px;margin-left:4px;">${Number(row.count) || 0}</span>${durationSum ? `<span style="font-weight:normal;color:var(--tm-primary-color);font-size:12px;background:var(--tm-info-bg);padding:1px 6px;border-radius:10px;margin-left:4px;border:1px solid var(--tm-info-border);">📊 ${esc(durationSum)}</span>` : ''}</td></tr>`;
                }
                if (row.kind === 'quadrant') {
                    const durationSum = String(row.durationSum || '').trim();
                    const colorMap = { red: 'var(--tm-quadrant-red)', yellow: 'var(--tm-quadrant-yellow)', blue: 'var(--tm-quadrant-blue)', green: 'var(--tm-quadrant-green)' };
                    const color = colorMap[String(row.color || '')] || 'var(--tm-text-color)';
                    return `<tr class="tm-group-row tm-timeline-row"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:${color};">${toggle}<span class="tm-quadrant-indicator tm-quadrant-bg-${esc(row.color || '')}"></span>${esc(row.label || '')} <span style="font-weight:normal;color:var(--tm-secondary-text);font-size:12px;background:var(--tm-doc-count-bg);padding:1px 6px;border-radius:10px;margin-left:4px;">${Number(row.count) || 0}</span>${durationSum ? `<span style="font-weight:normal;color:var(--tm-primary-color);font-size:12px;background:var(--tm-info-bg);padding:1px 6px;border-radius:10px;margin-left:4px;border:1px solid var(--tm-info-border);">📊 ${esc(durationSum)}</span>` : ''}</td></tr>`;
                }
                return `<tr class="tm-group-row tm-timeline-row"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);">${toggle}${esc(row.label || '')}</td></tr>`;
            };

            const renderTaskRow = (row) => {
                const task = state.flatTasks[row.id];
                if (!task) return '';
                const indent = (Math.max(0, Number(row.depth) || 0)) * 12;
                const toggle = row.hasChildren
                    ? `<span class="tm-tree-toggle" onclick="tmToggleCollapse('${task.id}', event)">${row.collapsed ? '▸' : '▾'}</span>`
                    : `<span class="tm-tree-spacer"></span>`;
                const focusId = SettingsStore.data.enableTomatoIntegration ? String(state.timerFocusTaskId || '').trim() : '';
                const rowClass = focusId ? (focusId === String(task.id) ? 'tm-timer-focus' : 'tm-timer-dim') : '';

                const allChildren = task.children || [];
                const totalChildren = allChildren.length;
                const completedChildren = allChildren.filter(c => c.done).length;
                const progressPercent = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
                const progressBgImage = (row.hasChildren && progressPercent > 0)
                    ? `linear-gradient(90deg, ${progressBarColor} ${progressPercent}%, transparent ${progressPercent}%)`
                    : '';
                const isDoneSubtask = !!task.done && (Math.max(0, Number(row.depth) || 0) > 0);
                const doneSubtaskBg = isDoneSubtask ? __tmWithAlpha(progressBarColor, isDark ? 0.22 : 0.14) : '';
                const contentCellBgStyle = `${doneSubtaskBg ? `background-color:${doneSubtaskBg};` : ''}${progressBgImage ? `background-image:${progressBgImage};background-repeat:no-repeat;` : ''}`;

                return `
                    <tr class="tm-timeline-row ${rowClass}" data-id="${task.id}" onclick="tmRowClick(event, '${task.id}')" oncontextmenu="tmShowTaskContextMenu(event, '${task.id}')">
                        <td style="width: ${timelineContentWidth}px; min-width: ${timelineContentWidth}px; max-width: ${timelineContentWidth}px; ${contentCellBgStyle}">
                            <div class="tm-task-cell" style="padding-left:${indent}px">
                                ${toggle}
                                <input class="tm-task-checkbox ${isGloballyLocked ? 'tm-operating' : ''}"
                                       type="checkbox" ${task.done ? 'checked' : ''}
                                       ${isGloballyLocked ? 'disabled' : ''}
                                       onchange="tmSetDone('${task.id}', this.checked, event)">
                                <span class="tm-task-text ${task.done ? 'tm-task-done' : ''}" data-level="${row.depth}" title="点击跳转到文档">
                                    <span class="tm-task-content-clickable" onclick="tmJumpToTask('${task.id}', event)">${esc(task.content || '')}</span>
                                </span>
                            </div>
                        </td>
                        <td class="tm-cell-editable" style="width:${timelineStartW}px; min-width:${timelineStartW}px; max-width:${timelineStartW}px;" onclick="tmBeginCellEdit('${task.id}','startDate',this,event)">${__tmFormatTaskTime(task.startDate)}</td>
                        <td class="tm-cell-editable" style="width:${timelineEndW}px; min-width:${timelineEndW}px; max-width:${timelineEndW}px;" onclick="tmBeginCellEdit('${task.id}','completionTime',this,event)">${__tmFormatTaskTime(task.completionTime)}</td>
                    </tr>
                `;
            };

            const leftRowsHtml = (Array.isArray(rowModel) ? rowModel : []).map(r => {
                if (r.type === 'group') return renderGroupRow(r);
                if (r.type === 'task') return renderTaskRow(r);
                return '';
            }).join('');

            return `
                <div class="tm-body tm-body--timeline">
                    <div class="tm-timeline-split">
                        <div class="tm-timeline-left" style="width:${leftWidth}px">
                            <div class="tm-timeline-left-body" id="tmTimelineLeftBody">
                                <table class="tm-table tm-timeline-table-left" id="tmTimelineLeftTable" style="width:${leftTableWidth}px;min-width:${leftTableWidth}px;max-width:${leftTableWidth}px;">
                                    <colgroup>
                                        <col id="tmTimelineColContent" style="width:${timelineContentWidth}px">
                                        <col id="tmTimelineColStart" style="width:${timelineStartW}px">
                                        <col id="tmTimelineColEnd" style="width:${timelineEndW}px">
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th style="width:${timelineContentWidth}px; min-width:${timelineContentWidth}px; max-width:${timelineContentWidth}px;">任务内容<span class="tm-col-resize" onmousedown="tmStartTimelineContentResize(event)"></span></th>
                                            <th style="width:${timelineStartW}px; min-width:${timelineStartW}px; max-width:${timelineStartW}px;">开始日期</th>
                                            <th style="width:${timelineEndW}px; min-width:${timelineEndW}px; max-width:${timelineEndW}px;">完成时间</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${leftRowsHtml || `<tr><td colspan="3" style="text-align:center; padding:40px; color:var(--tm-secondary-text);">暂无任务</td></tr>`}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="tm-timeline-splitter" onmousedown="tmStartTimelineSplitResize(event)" title="拖拽调整宽度"></div>
                        <div class="tm-timeline-right">
                            <div class="tm-timeline-right-header"><div id="tmGanttHeader"></div></div>
                            <div class="tm-timeline-right-body" id="tmGanttBody"></div>
                        </div>
                    </div>
                </div>
            `;
        };

        const __tmTimelineRowModel = state.viewMode === 'timeline' ? __tmBuildTaskRowModel() : null;
        const mainBodyHtml = state.viewMode === 'timeline'
            ? __tmRenderTimelineBodyHtml(__tmTimelineRowModel)
            : __tmRenderListBodyHtml();
        
        state.modal.innerHTML = `
            <div class="tm-box">
                <div class="tm-filter-rule-bar" style="padding: 8px 12px;">
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <div class="tm-title" onclick="tmToggleDocTabs(event)" style="font-size: 16px; font-weight: 700; white-space: nowrap;">📋 任务管理器</div>
                            <button class="tm-btn tm-btn-success" onclick="tmAdd()" style="padding: 0 10px; height: 30px; display: inline-flex; align-items: center; justify-content: center;">+</button>
                            ${isMobile ? `<button class="tm-btn tm-btn-info" onclick="tmRefresh()" style="padding: 0 10px; height: 30px; display: inline-flex; align-items: center; justify-content: center;">🔄️</button>` : ''}
                        </div>

                        <!-- 桌面端工具栏 -->
                        <div class="tm-desktop-toolbar tm-header-selectors" style="display:flex;align-items:center;gap:10px;flex:1;">
                            <div class="tm-rule-selector" style="margin-left: 6px;">
                                <span style="color: white; font-size: 13px;">分组:</span>
                                <select class="tm-rule-select" onchange="tmSwitchDocGroup(this.value)">
                                    <option value="all" ${currentGroupId === 'all' ? 'selected' : ''}>全部文档</option>
                                    ${docGroups.map(g => `<option value="${g.id}" ${currentGroupId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
                                </select>
                            </div>

                            <div class="tm-rule-selector">
                                <span style="color: white; font-size: 13px;">规则:</span>
                                <select class="tm-rule-select" onchange="applyFilterRule(this.value)">
                                    <option value="">-- 选择规则 --</option>
                                    ${ruleOptions}
                                </select>
                            </div>
                            ${currentRule ? `
                                <div class="tm-rule-display">
                                    <span class="tm-rule-stats">${filteredCount} 个任务</span>
                                </div>
                            ` : ''}
                            <div style="flex: 1 1 auto;"></div>
                            
                            <div class="tm-rule-selector">
                                <span style="color: white; font-size: 13px;">模式:</span>
                                <select class="tm-rule-select" onchange="tmSwitchGroupMode(this.value)">
                                    <option value="none" ${(!state.groupByDocName && !state.groupByTime && !state.quadrantEnabled) ? 'selected' : ''}>不分组</option>
                                    <option value="doc" ${state.groupByDocName ? 'selected' : ''}>按文档</option>
                                    <option value="time" ${state.groupByTime ? 'selected' : ''}>按时间</option>
                                    <option value="quadrant" ${state.quadrantEnabled ? 'selected' : ''}>四象限</option>
                                </select>
                            </div>

                        </div>
                        
                        <!-- 移动端菜单按钮 -->
                            <div class="tm-mobile-menu-btn" style="display:none;margin-left:auto;">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <button class="tm-btn tm-btn-info" onclick="tmToggleMobileMenu(event)" ontouchend="tmToggleMobileMenu(event)" style="padding: 0 10px; height: 30px; display: inline-flex; align-items: center; justify-content: center;">
                                    <span style="font-size: 16px; transform: translateY(1px); line-height: 1;">☰</span>
                                    <span style="margin-left: 4px;">菜单</span>
                                </button>
                                ${isMobile ? `<button class="tm-btn tm-btn-gray" onclick="tmClose(event)" ontouchend="tmClose(event)" style="padding: 0 10px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"><span style="transform: translateY(1px); line-height: 1;">✖</span></button>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <!-- 桌面端搜索栏 -->
                    <div class="tm-search-box tm-desktop-toolbar" style="flex-wrap: wrap;">
                        <button class="tm-btn tm-btn-info" onclick="tmRefresh()" style="padding: 4px 10px;" title="刷新">🔄️</button>
                        <button class="tm-btn tm-btn-info ${state.viewMode === 'timeline' ? 'tm-filter-active' : ''}" onclick="tmToggleTimelineMode()" style="padding: 4px 10px;" title="切换时间轴模式">🗓️ 时间轴</button>
                        ${state.viewMode === 'timeline' ? `
                            <button class="tm-btn tm-btn-info" onclick="tmGanttZoomOut()" style="padding: 4px 10px;" title="缩小">－</button>
                            <button class="tm-btn tm-btn-info" onclick="tmGanttZoomIn()" style="padding: 4px 10px;" title="放大">＋</button>
                            <button class="tm-btn tm-btn-info" onclick="tmGanttFit()" style="padding: 4px 10px;" title="适配范围">🎯</button>
                            <button class="tm-btn tm-btn-info" onclick="tmGanttToday()" style="padding: 4px 10px;" title="定位今天">📍</button>
                        ` : ''}
                        
                        <button class="tm-btn tm-btn-info" onclick="showSettings()" style="padding: 4px 10px;">⚙️ 设置</button>
                        ${!isMobile ? `
                            <button class="tm-btn tm-btn-info tm-desktop-menu-btn" onclick="tmToggleDesktopMenu(event)" style="padding: 4px 10px; display: flex; align-items: center; gap: 4px;">
                                <span>☰</span> 菜单
                            </button>
                        ` : ''}
                    </div>

                        <!-- 移动端下拉菜单 -->
                        <div id="tmMobileMenu" style="display:none; position:absolute; right:0; top:45px; width:200px; padding:10px; border:1px solid var(--tm-border-color); border-radius:6px; background:var(--tm-header-bg); z-index:10001; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <span style="color:var(--tm-text-color);width:60px;">分组:</span>
                                    <select class="tm-rule-select" style="flex:1;" onchange="tmSwitchDocGroup(this.value)">
                                        <option value="all" ${currentGroupId === 'all' ? 'selected' : ''}>全部文档</option>
                                        ${docGroups.map(g => `<option value="${g.id}" ${currentGroupId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <span style="color:var(--tm-text-color);width:60px;">规则:</span>
                                    <select class="tm-rule-select" style="flex:1;" onchange="applyFilterRule(this.value)">
                                        <option value="">-- 选择规则 --</option>
                                        ${ruleOptions}
                                    </select>
                                </div>
                                <div style="display:flex; gap:10px; align-items:center;">
                                    <button class="tm-btn tm-btn-info" onclick="tmShowSearchModal()" style="flex:1; padding: 6px;">
                                        🔍 搜索 ${state.searchKeyword ? `(${state.searchKeyword})` : ''}
                                    </button>
                                </div>
                                ${isLandscape ? `
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px;">
                                    <button class="tm-btn tm-btn-info" onclick="tmToggleTimelineMode(); try{document.getElementById('tmMobileMenu').style.display='none';}catch(e){}" style="flex:1; padding: 6px;">
                                        🗓️ 时间轴 ${state.viewMode === 'timeline' ? '(开)' : ''}
                                    </button>
                                </div>
                                ${state.viewMode === 'timeline' ? `
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px;">
                                    <button class="tm-btn tm-btn-info" onclick="tmGanttZoomOut(); try{document.getElementById('tmMobileMenu').style.display='none';}catch(e){}" style="flex:1; padding: 6px;">－</button>
                                    <button class="tm-btn tm-btn-info" onclick="tmGanttZoomIn(); try{document.getElementById('tmMobileMenu').style.display='none';}catch(e){}" style="flex:1; padding: 6px;">＋</button>
                                    <button class="tm-btn tm-btn-info" onclick="tmGanttFit(); try{document.getElementById('tmMobileMenu').style.display='none';}catch(e){}" style="flex:1; padding: 6px;">🎯</button>
                                    <button class="tm-btn tm-btn-info" onclick="tmGanttToday(); try{document.getElementById('tmMobileMenu').style.display='none';}catch(e){}" style="flex:1; padding: 6px;">📍</button>
                                </div>
                                ` : ''}
                                ` : ''}
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px;">
                                     <button class="tm-btn tm-btn-info" onclick="showSettings()" style="flex:1; padding: 6px;">⚙️ 设置</button>
                                </div>
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px;">
                                     <button class="tm-btn tm-btn-info" onclick="tmCollapseAllTasks()" style="flex:1; padding: 6px;">▸ 折叠</button>
                                     <button class="tm-btn tm-btn-info" onclick="tmExpandAllTasks()" style="flex:1; padding: 6px;">▾ 展开</button>
                                </div>
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <span style="color:var(--tm-text-color);width:60px;">模式:</span>
                                    <select class="tm-rule-select" style="flex:1;" onchange="tmSwitchGroupMode(this.value)">
                                        <option value="none" ${(!state.groupByDocName && !state.groupByTime && !state.quadrantEnabled) ? 'selected' : ''}>不分组</option>
                                        <option value="doc" ${state.groupByDocName ? 'selected' : ''}>按文档</option>
                                        <option value="time" ${state.groupByTime ? 'selected' : ''}>按时间</option>
                                        <option value="quadrant" ${state.quadrantEnabled ? 'selected' : ''}>四象限</option>
                                    </select>
                                </div>
                                ${currentRule ? `<div class="tm-mobile-only-item" style="color:var(--tm-secondary-text);font-size:12px;">当前规则: ${esc(currentRule.name)} (${filteredCount}任务)</div>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <style>
                        /* 默认隐藏移动端专属项（因为桌面端工具栏已经有了） */
                        .tm-mobile-only-item {
                            display: none !important;
                        }
                        
                        /* 移动端下显示 */
                        @media (max-width: 768px) {
                            .tm-mobile-only-item {
                                display: flex !important;
                            }
                        }
                    </style>

                <div class="tm-doc-tabs ${state.docTabsHidden ? 'tm-doc-tabs--hidden' : ''}">
                    <div style="display:flex; gap:8px; overflow-x:auto; flex:1; align-items:center; padding: ${isMobile ? '4px 12px 4px 12px' : '4px 0 4px 0'};">
                        <div class="tm-doc-tab ${state.activeDocId === 'all' ? 'active' : ''}" onclick="tmSwitchDoc('all')">全部</div>
                        ${(() => {
                            const id = String(SettingsStore.data.newTaskDocId || '').trim();
                            if (!id || id === '__dailyNote__') return '';
                            const docName = state.taskTree.find(d => d.id === id)?.name
                                || state.allDocuments.find(d => d.id === id)?.name
                                || '未命名文档';
                            const isActive = state.activeDocId === id;
                            return `<div class="tm-doc-tab ${isActive ? 'active' : ''}" onclick="tmSwitchDoc('${id}')" title="全局新建文档">📥 ${esc(docName)}</div>`;
                        })()}
                        ${visibleDocs.map(doc => {
                            const isActive = state.activeDocId === doc.id;
                            return `<div class="tm-doc-tab ${isActive ? 'active' : ''}" ondragenter="tmDocTabDragEnter(event)" ondragleave="tmDocTabDragLeave(event)" ondragover="tmDocTabDragOver(event)" ondrop="tmDocTabDrop(event, '${doc.id}')" onclick="tmSwitchDoc('${doc.id}')">${esc(doc.name)}</div>`;
                        }).join('')}
                    </div>
                    <div style="border-left:1px solid var(--tm-border-color); padding-left:8px; margin-left:8px; display:none; gap:8px;">
                         ${!isMobile ? `` : ''}
                    </div>
                </div>
                
                <style>
                    .tm-title {
                        cursor: pointer;
                        user-select: none;
                    }
                    .tm-doc-tabs {
                        display: flex;
                        align-items: center;
                        padding: 0 15px;
                        border-bottom: 1px solid var(--tm-border-color);
                        background: var(--tm-header-bg);
                        max-height: 56px;
                        overflow: hidden;
                        transition: max-height 0.18s ease, opacity 0.18s ease, border-color 0.18s ease, padding-top 0.18s ease, padding-bottom 0.18s ease;
                        opacity: 1;
                    }
                    .tm-doc-tabs.tm-doc-tabs--hidden {
                        max-height: 0;
                        opacity: 0;
                        border-bottom-color: transparent;
                        padding-top: 0;
                        padding-bottom: 0;
                        pointer-events: none;
                    }
                    .tm-doc-tabs > div::-webkit-scrollbar {
                        height: 4px;
                    }
                    .tm-doc-tabs > div::-webkit-scrollbar-thumb {
                        background: var(--tm-border-color);
                        border-radius: 2px;
                    }
                    .tm-doc-tab {
                        padding: 2px 8px;
                        border-radius: 6px;
                        background: var(--tm-bg-color);
                        color: var(--tm-text-color);
                        font-size: 13px;
                        cursor: pointer;
                        white-space: nowrap;
                        border: 1px solid var(--tm-border-color);
                        transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease, background 0.12s ease;
                        user-select: none;
                        height: 24px;
                        line-height: 16px;
                        display: flex;
                        align-items: center;
                    }
                    .tm-doc-tab:hover {
                        background: var(--tm-hover-bg);
                        border-color: var(--tm-text-color);
                    }
                    .tm-doc-tab.active {
                        background: var(--tm-primary-color);
                        color: white;
                        border-color: var(--tm-primary-color);
                        box-shadow: 0 0 0 1px var(--tm-primary-color);
                    }
                    .tm-doc-tab.is-drop-target {
                        transform: scale(1.06);
                        border-color: var(--tm-primary-color);
                        box-shadow: 0 6px 16px rgba(0,0,0,0.15);
                        z-index: 10;
                        transform-origin: center;
                    }
                    
                    @media (max-width: 768px) {
                        .tm-desktop-toolbar {
                            display: none !important;
                        }
                        .tm-mobile-menu-btn {
                            display: block !important;
                        }
                        .tm-filter-rule-bar {
                            flex-wrap: wrap;
                        }
                        .tm-doc-tabs {
                            padding: 8px 0;
                            width: 100%;
                            box-sizing: border-box;
                        }
                        .tm-doc-tab {
                            font-size: 12px;
                            padding: 2px 8px;
                            height: 24px;
                            border-radius: 6px;
                        }
                    }

                    @media (max-width: 1024px) {
                        .tm-header-selectors {
                            display: none !important;
                        }
                        .tm-mobile-menu-btn {
                            display: block !important;
                        }
                        .tm-mobile-only-item {
                            display: flex !important;
                        }
                        .tm-desktop-menu-btn {
                            display: none !important;
                        }
                    }
                </style>
                
                ${mainBodyHtml}
            </div>
        `;
        
        __tmGetMountRoot().appendChild(state.modal);

        // 恢复滚动位置
        if (state.viewMode === 'timeline') {
            const leftBody = state.modal.querySelector('#tmTimelineLeftBody');
            const ganttBody = state.modal.querySelector('#tmGanttBody');
            const ganttHeader = state.modal.querySelector('#tmGanttHeader');

            if (leftBody) leftBody.scrollTop = savedTimelineScrollTop;
            if (ganttBody) {
                ganttBody.scrollTop = savedTimelineScrollTop;
                ganttBody.scrollLeft = savedTimelineScrollLeft;
            }

            const rowModel = Array.isArray(__tmTimelineRowModel) ? __tmTimelineRowModel : __tmBuildTaskRowModel();
            const view = globalThis.__TaskHorizonGanttView;
            if (view && typeof view.render === 'function' && ganttHeader && ganttBody) {
                view.render({
                    headerEl: ganttHeader,
                    bodyEl: ganttBody,
                    rowModel,
                    getTaskById: (id) => state.flatTasks[String(id)],
                    viewState: state.ganttView,
                    onUpdateTaskDates: async (taskId, patch) => {
                        const id = String(taskId || '').trim();
                        if (!id) return;
                        const task = state.flatTasks[id];
                        if (!task) return;
                        const startDate = String(patch?.startDate || '').trim();
                        const completionTime = String(patch?.completionTime || '').trim();
                        const nextStart = startDate ? __tmNormalizeDateOnly(startDate) : '';
                        const nextEnd = completionTime ? __tmNormalizeDateOnly(completionTime) : '';
                        task.startDate = nextStart;
                        task.completionTime = nextEnd;
                        try {
                            await __tmPersistMetaAndAttrsAsync(id, { startDate: nextStart, completionTime: nextEnd });
                        } catch (e) {
                            hint(`❌ 更新失败: ${e.message}`, 'error');
                        }
                        applyFilters();
                        render();
                    },
                });
            }

            const syncHeaderX = () => {
                if (!ganttBody || !ganttHeader) return;
                const inner = ganttHeader.querySelector('.tm-gantt-header-inner');
                if (!inner) return;
                inner.style.transform = `translateX(${-ganttBody.scrollLeft}px)`;
            };
            syncHeaderX();

            const desiredTop = Number.isFinite(savedTimelineScrollTop) && savedTimelineScrollTop > 0
                ? savedTimelineScrollTop
                : (Number.isFinite(savedScrollTop) && savedScrollTop > 0 ? savedScrollTop : (Number(state.viewScroll?.timeline?.top) || Number(state.viewScroll?.list?.top) || 0));
            const forcedLeft = Number(state.ganttView?.__forceScrollLeft);
            const hasForcedLeft = Number.isFinite(forcedLeft);
            const desiredLeft = hasForcedLeft
                ? forcedLeft
                : (Number.isFinite(savedTimelineScrollLeft) && savedTimelineScrollLeft > 0
                    ? savedTimelineScrollLeft
                    : (Number.isFinite(savedScrollLeft) && savedScrollLeft > 0 ? savedScrollLeft : (Number(state.viewScroll?.timeline?.left) || 0)));
            requestAnimationFrame(() => requestAnimationFrame(() => {
                try { if (leftBody) leftBody.scrollTop = desiredTop; } catch (e) {}
                try { if (ganttBody) ganttBody.scrollTop = desiredTop; } catch (e) {}
                try { if (ganttBody) ganttBody.scrollLeft = desiredLeft; } catch (e) {}
                try { syncHeaderX(); } catch (e) {}
                try { if (hasForcedLeft) delete state.ganttView.__forceScrollLeft; } catch (e) {}
            }));

            const syncRowHeights = () => {
                if (!leftBody || !ganttBody) return;
                const leftRows = leftBody.querySelectorAll('tbody tr');
                const rightRows = ganttBody.querySelectorAll('.tm-gantt-row');
                const n = Math.min(leftRows.length, rightRows.length);
                if (n <= 0) return;
                for (let i = 0; i < n; i++) {
                    const h = leftRows[i]?.getBoundingClientRect?.().height;
                    if (!Number.isFinite(h) || h <= 0) continue;
                    const rr = rightRows[i];
                    rr.style.height = `${h}px`;
                    rr.style.minHeight = `${h}px`;
                    rr.style.maxHeight = `${h}px`;
                    const bar = rr.querySelector?.('.tm-gantt-bar');
                    if (bar) {
                        const barH = bar.getBoundingClientRect?.().height;
                        const bh = Number.isFinite(barH) && barH > 0 ? barH : Math.max(12, Math.min(22, Math.round(h * 0.6)));
                        const top = Math.max(2, (h - bh) / 2);
                        bar.style.top = `${top}px`;
                    }
                }
            };

            requestAnimationFrame(() => requestAnimationFrame(() => {
                syncRowHeights();
                setTimeout(syncRowHeights, 60);
                setTimeout(syncRowHeights, 260);
            }));

            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (!Number.isFinite(Number(SettingsStore.data.timelineLeftWidth)) || Number(SettingsStore.data.timelineLeftWidth) <= 0) {
                    const leftTable = state.modal?.querySelector?.('#tmTimelineLeftTable');
                    const w = leftTable?.getBoundingClientRect?.().width;
                    if (Number.isFinite(w) && w > 0) {
                        SettingsStore.data.timelineLeftWidth = Math.max(360, Math.min(900, Math.round(w)));
                        try { SettingsStore.save(); } catch (e) {}
                    }
                }
            }));

            if (leftBody && ganttBody) {
                const onGroupClick = (ev) => {
                    const el = ev?.target instanceof Element ? ev.target.closest('.tm-gantt-row--group') : null;
                    if (!el) return;
                    const key = String(el.getAttribute('data-group-key') || '').trim();
                    if (!key) return;
                    tmToggleGroupCollapse(key, ev);
                };
                let syncing = false;
                const syncFromLeft = () => {
                    if (syncing) return;
                    syncing = true;
                    requestAnimationFrame(() => {
                        try { ganttBody.scrollTop = leftBody.scrollTop; } catch (e) {}
                        syncing = false;
                    });
                };
                const syncFromRight = () => {
                    if (syncing) return;
                    syncing = true;
                    requestAnimationFrame(() => {
                        try { leftBody.scrollTop = ganttBody.scrollTop; } catch (e) {}
                        syncing = false;
                    });
                };
                leftBody.addEventListener('scroll', syncFromLeft, { passive: true });
                ganttBody.addEventListener('scroll', () => {
                    syncHeaderX();
                    syncFromRight();
                }, { passive: true });
                ganttBody.addEventListener('click', onGroupClick, true);
            } else if (ganttBody) {
                ganttBody.addEventListener('scroll', syncHeaderX, { passive: true });
            }
        } else {
            const newBody = state.modal.querySelector('.tm-body');
            if (newBody) {
                const desiredTop = Number.isFinite(savedScrollTop) && savedScrollTop > 0
                    ? savedScrollTop
                    : (Number.isFinite(savedTimelineScrollTop) && savedTimelineScrollTop > 0 ? savedTimelineScrollTop : (Number(state.viewScroll?.list?.top) || 0));
                const desiredLeft = Number.isFinite(savedScrollLeft) && savedScrollLeft > 0
                    ? savedScrollLeft
                    : (Number(state.viewScroll?.list?.left) || 0);
                try { newBody.scrollTop = desiredTop; } catch (e) {}
                try { newBody.scrollLeft = desiredLeft; } catch (e) {}
            }
        }
    }

    // 新增的规则应用函数
    window.applyFilterRule = async function(ruleId) {
        if (ruleId) {
            state.currentRule = ruleId;
            SettingsStore.data.currentRule = ruleId;
            await SettingsStore.save();
        } else {
            state.currentRule = null;
            SettingsStore.data.currentRule = null;
            await SettingsStore.save();
        }
        applyFilters();
        render();

        if (ruleId) {
            const rule = state.filterRules.find(r => r.id === ruleId);
            if (rule) {
                hint(`✅ 已应用规则: ${rule.name}`, 'success');
            }
        }
    };

    window.clearFilterRule = async function() {
        state.currentRule = null;
        SettingsStore.data.currentRule = null;
        await SettingsStore.save();
        applyFilters();
        render();
        hint('✅ 已清除筛选规则', 'success');
    };

    // 原有的其他函数保持不变...
    window.tmRefresh = async function() {
        if (state.isRefreshing) return;
        state.isRefreshing = true;
        hint('🔄 正在刷新...', 'info');
        try {
            await loadSelectedDocuments();
            hint('✅ 刷新完成', 'success');
        } catch (e) {
            hint(`❌ 刷新失败: ${e.message}`, 'error');
        } finally {
            state.isRefreshing = false;
        }
    };

    window.tmToggleTimelineMode = function() {
        state.viewMode = state.viewMode === 'timeline' ? 'list' : 'timeline';
        render();
    };

    window.tmGanttZoomIn = function() {
        const next = Math.min(60, Math.max(10, Math.round((Number(state.ganttView?.dayWidth) || 24) + 4)));
        state.ganttView.dayWidth = next;
        render();
    };

    window.tmGanttZoomOut = function() {
        const next = Math.min(60, Math.max(10, Math.round((Number(state.ganttView?.dayWidth) || 24) - 4)));
        state.ganttView.dayWidth = next;
        render();
    };

    window.tmGanttFit = function() {
        if (state.viewMode !== 'timeline') return;
        try {
            const body = state.modal?.querySelector?.('#tmGanttBody');
            const w = body?.clientWidth;
            if (!Number.isFinite(w) || w <= 0) {
                state.ganttView.__forceScrollLeft = 0;
                render();
                return;
            }
            const view = globalThis.__TaskHorizonGanttView;
            const parse = view?.parseDateOnlyToTs;
            const startOfDayTs = view?.startOfDayTs;
            const DAY_MS = Number(view?.DAY_MS) || 86400000;
            if (typeof parse !== 'function' || typeof startOfDayTs !== 'function') {
                state.ganttView.__forceScrollLeft = 0;
                render();
                return;
            }
            const rowModel = __tmBuildTaskRowModel();
            let minTs = 0;
            let maxTs = 0;
            for (const r of rowModel) {
                if (r?.type !== 'task') continue;
                const t = state.flatTasks[String(r.id)];
                if (!t) continue;
                const sTs = parse(t?.startDate);
                const eTs = parse(t?.completionTime);
                const a = sTs || eTs;
                const b = eTs || sTs;
                if (!a || !b) continue;
                if (!minTs || a < minTs) minTs = a;
                if (!maxTs || b > maxTs) maxTs = b;
            }
            const now = Date.now();
            const paddingDays = Math.max(0, Number(state.ganttView?.paddingDays) || 0);
            const pad = paddingDays * DAY_MS;
            const startTs = startOfDayTs((minTs || now) - pad);
            const endTs = startOfDayTs((maxTs || now) + pad);
            const dayCount = Math.max(1, Math.min(366, Math.round((endTs - startTs) / DAY_MS) + 1));
            const usableW = Math.max(120, w - 24);
            const next = Math.max(10, Math.min(60, Math.floor(usableW / dayCount)));
            state.ganttView.dayWidth = next;
            state.ganttView.__forceScrollLeft = 0;
            render();
        } catch (e) {
            try { state.ganttView.__forceScrollLeft = 0; } catch (e2) {}
            render();
        }
    };

    window.tmGanttToday = function() {
        const body = state.modal?.querySelector?.('#tmGanttBody');
        if (!body) return;
        const todayLine = body.querySelector('.tm-gantt-today');
        if (!todayLine) return;
        const left = Number.parseFloat(String(todayLine.style.left || '').replace('px', ''));
        if (!Number.isFinite(left)) return;
        const target = Math.max(0, Math.round(left - body.clientWidth * 0.35));
        body.scrollLeft = target;
        try { body.dispatchEvent(new Event('scroll')); } catch (e) {}
    };

    window.tmToggleDesktopMenu = function(e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        
        // 移除现有的菜单
        const existing = document.getElementById('tmDesktopMenu');
        if (existing) {
            if (state.desktopMenuCloseHandler) {
                try { document.removeEventListener('click', state.desktopMenuCloseHandler); } catch (e2) {}
                state.desktopMenuCloseHandler = null;
            }
            existing.remove();
            return;
        }
        
        const menu = document.createElement('div');
        menu.id = 'tmDesktopMenu';
        menu.className = 'tm-popup-menu';
        menu.style.cssText = `
            position: absolute;
            top: 45px;
            right: 15px;
            background: var(--tm-bg-color);
            border: 1px solid var(--tm-border-color);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 8px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 140px;
        `;
        
        menu.innerHTML = `
            <button class="tm-btn tm-btn-info" onclick="tmShowSearchModal(); document.getElementById('tmDesktopMenu').remove()" style="text-align:left; padding: 6px 12px;">🔍 搜索${state.searchKeyword ? ` (${String(state.searchKeyword || '').trim()})` : ''}</button>
            ${state.searchKeyword ? `<button class="tm-btn tm-btn-secondary" onclick="tmSearch(''); document.getElementById('tmDesktopMenu').remove()" style="text-align:left; padding: 6px 12px;">清除搜索</button>` : ''}
            <button class="tm-btn tm-btn-info" onclick="tmCollapseAllTasks(); document.getElementById('tmDesktopMenu').remove()" style="text-align:left; padding: 6px 12px;">▸ 全部折叠</button>
            <button class="tm-btn tm-btn-info" onclick="tmExpandAllTasks(); document.getElementById('tmDesktopMenu').remove()" style="text-align:left; padding: 6px 12px;">▾ 全部展开</button>
        `;
        
        // 点击外部关闭
        const closeHandler = (ev) => {
            if (!menu.contains(ev.target) && ev.target !== e.target) {
                menu.remove();
                try { document.removeEventListener('click', closeHandler); } catch (e2) {}
                if (state.desktopMenuCloseHandler === closeHandler) state.desktopMenuCloseHandler = null;
            }
        };
        state.desktopMenuCloseHandler = closeHandler;
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
        
        const container = document.querySelector('.tm-filter-rule-bar');
        if (container) {
            container.style.position = 'relative';
            container.appendChild(menu);
        }
    };

    function __tmHideMobileMenu() {
        const menu = document.getElementById('tmMobileMenu');
        if (menu) menu.style.display = 'none';
        if (state.mobileMenuCloseHandler) {
            try { document.removeEventListener('click', state.mobileMenuCloseHandler); } catch (e) {}
            try { document.removeEventListener('touchstart', state.mobileMenuCloseHandler); } catch (e) {}
            state.mobileMenuCloseHandler = null;
        }
    }

    window.tmToggleMobileMenu = function(e) {
        const menu = document.getElementById('tmMobileMenu');
        if (!menu) return;

        const now = Date.now();
        const type = String(e?.type || '');
        if (type.startsWith('touch')) {
            state.mobileMenuLastTouchTs = now;
        } else {
            const lastTouchTs = Number(state.mobileMenuLastTouchTs) || 0;
            if (lastTouchTs && now - lastTouchTs < 500) return;
        }
        if (e) {
            try { e.stopPropagation?.(); } catch (e2) {}
            try { e.preventDefault?.(); } catch (e2) {}
        }

        const open = menu.style.display !== 'none';
        if (!open) {
            menu.style.display = 'block';
            
            if (state.mobileMenuCloseHandler) {
                try { document.removeEventListener('click', state.mobileMenuCloseHandler); } catch (e2) {}
                try { document.removeEventListener('touchstart', state.mobileMenuCloseHandler); } catch (e2) {}
                state.mobileMenuCloseHandler = null;
            }
            const closeHandler = (ev) => {
                if (menu.contains(ev.target)) return;
                if (ev.target.closest('.tm-mobile-menu-btn')) return;
                __tmHideMobileMenu();
            };
            state.mobileMenuCloseHandler = closeHandler;
            
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
                document.addEventListener('touchstart', closeHandler);
            }, 0);
        } else {
            __tmHideMobileMenu();
        }
    };

    window.tmClose = function(event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        state.openToken = (Number(state.openToken) || 0) + 1;
        try { __tmHideMobileMenu(); } catch (e) {}
        
        // 强制移除所有可能的模态框（防御性编程）
        const modals = document.querySelectorAll('.tm-modal, .tm-settings-modal, .tm-rules-modal, .tm-prompt-modal');
        modals.forEach(el => {
            try { el.remove(); } catch (e) {}
        });

        // 清理状态引用
        state.modal = null;
        state.settingsModal = null;
        state.rulesModal = null;
        state.priorityModal = null;
        state.quickAddModal = null;
    };

    // 列宽调整功能
    let __tmResizeState = null;
    let __tmTimelineSplitResizeState = null;

    window.startColResize = function(event, colName) {
        event.preventDefault();
        event.stopPropagation();
        const th = event.target.closest('th');
        const startX = event.clientX;
        const startWidth = th.offsetWidth;

        __tmResizeState = {
            colName,
            startX,
            startWidth,
            th
        };

        document.addEventListener('mousemove', __tmOnResize);
        document.addEventListener('mouseup', __tmStopResize);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    function __tmOnResize(event) {
        if (!__tmResizeState) return;
        const deltaX = event.clientX - __tmResizeState.startX;
        const newWidth = Math.max(40, Math.min(800, Math.round(__tmResizeState.startWidth + deltaX)));
        __tmResizeState.th.style.width = newWidth + 'px';
        __tmResizeState.th.style.minWidth = newWidth + 'px';
        __tmResizeState.th.style.maxWidth = newWidth + 'px';
    }

    function __tmStopResize(event) {
        if (!__tmResizeState) return;

        const deltaX = event.clientX - __tmResizeState.startX;
        const newWidth = Math.max(40, Math.min(800, Math.round(__tmResizeState.startWidth + deltaX)));
        SettingsStore.updateColumnWidth(__tmResizeState.colName, newWidth);

        // 清理
        document.removeEventListener('mousemove', __tmOnResize);
        document.removeEventListener('mouseup', __tmStopResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        __tmResizeState = null;
    };

    window.tmStartTimelineSplitResize = function(event) {
        try { event.preventDefault(); } catch (e) {}
        try { event.stopPropagation(); } catch (e) {}
        const leftEl = state.modal?.querySelector?.('.tm-timeline-left');
        if (!leftEl) return;
        const startX = event.clientX;
        const startWidth = leftEl.getBoundingClientRect().width;
        __tmTimelineSplitResizeState = { startX, startWidth, leftEl };

        const onMove = (ev) => {
            if (!__tmTimelineSplitResizeState) return;
            const dx = ev.clientX - __tmTimelineSplitResizeState.startX;
            const next = Math.max(360, Math.min(900, Math.round(__tmTimelineSplitResizeState.startWidth + dx)));
            __tmTimelineSplitResizeState.leftEl.style.width = `${next}px`;
        };
        const onUp = async (ev) => {
            if (!__tmTimelineSplitResizeState) return;
            const dx = ev.clientX - __tmTimelineSplitResizeState.startX;
            const next = Math.max(360, Math.min(900, Math.round(__tmTimelineSplitResizeState.startWidth + dx)));
            __tmTimelineSplitResizeState = null;
            try { document.removeEventListener('mousemove', onMove); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp); } catch (e) {}
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            SettingsStore.data.timelineLeftWidth = next;
            try { await SettingsStore.save(); } catch (e) {}
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    window.tmStartTimelineContentResize = function(event) {
        try { event.preventDefault(); } catch (e) {}
        try { event.stopPropagation(); } catch (e) {}
        const th = event.target.closest('th');
        if (!th) return;
        const startX = event.clientX;
        const table = state.modal?.querySelector?.('#tmTimelineLeftTable');
        const col = state.modal?.querySelector?.('#tmTimelineColContent');
        const startWidth = th.getBoundingClientRect().width;
        const startW = Number.isFinite(startWidth) ? startWidth : th.offsetWidth;

        const onMove = (ev) => {
            const dx = ev.clientX - startX;
            const next = Math.max(160, Math.min(800, Math.round(startW + dx)));
            if (col) col.style.width = `${next}px`;
            th.style.width = `${next}px`;
            th.style.minWidth = `${next}px`;
            th.style.maxWidth = `${next}px`;
            const startW2 = Number(SettingsStore.data.columnWidths?.startDate) || 90;
            const endW2 = Number(SettingsStore.data.columnWidths?.completionTime) || 170;
            const total = Math.round(next + startW2 + endW2 + 2);
            if (table) {
                table.style.width = `${total}px`;
                table.style.minWidth = `${total}px`;
                table.style.maxWidth = `${total}px`;
            }
        };

        const onUp = async (ev) => {
            const dx = ev.clientX - startX;
            const next = Math.max(160, Math.min(800, Math.round(startW + dx)));
            try { document.removeEventListener('mousemove', onMove); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp); } catch (e) {}
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            SettingsStore.data.timelineContentWidth = next;
            try { await SettingsStore.save(); } catch (e) {}
            render();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    function normalizeTaskFields(task, docNameFallback) {
        if (!task || typeof task !== 'object') return task;

        const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';

        const normalizePriority = (raw) => {
            const s = String(raw ?? '').trim();
            if (!s) return '';
            const map = {
                high: 'high',
                medium: 'medium',
                low: 'low',
                none: '',
                '高': 'high',
                '中': 'medium',
                '低': 'low',
                '无': '',
            };
            if (Object.prototype.hasOwnProperty.call(map, s)) return map[s];
            const lower = s.toLowerCase();
            if (Object.prototype.hasOwnProperty.call(map, lower)) return map[lower];
            return '';
        };
        const p0 = task.priority ?? task.customPriority ?? task.custom_priority ?? '';
        task.priority = normalizePriority(p0);
        task.duration = isValidValue(task.duration) ? String(task.duration) : (isValidValue(task.custom_duration) ? String(task.custom_duration) : '');
        task.remark = isValidValue(task.remark) ? String(task.remark) : (isValidValue(task.custom_remark) ? String(task.custom_remark) : '');
        task.completionTime = isValidValue(task.completionTime) ? String(task.completionTime) : (isValidValue(task.completion_time) ? String(task.completion_time) : '');
        task.startDate = isValidValue(task.startDate) ? String(task.startDate) : (isValidValue(task.start_date) ? String(task.start_date) : '');
        task.customTime = isValidValue(task.customTime) ? String(task.customTime) : (isValidValue(task.custom_time) ? String(task.custom_time) : '');
        task.customStatus = isValidValue(task.customStatus) ? String(task.customStatus) : (isValidValue(task.custom_status) ? String(task.custom_status) : '');
        task.tomatoMinutes = isValidValue(task.tomatoMinutes) ? String(task.tomatoMinutes) : (isValidValue(task.tomato_minutes) ? String(task.tomato_minutes) : '');
        task.tomatoHours = isValidValue(task.tomatoHours) ? String(task.tomatoHours) : (isValidValue(task.tomato_hours) ? String(task.tomato_hours) : '');
        const pin0 = task.pinned ?? task.customPinned ?? task.custom_pinned ?? '';
        if (typeof pin0 === 'boolean') {
            task.pinned = pin0;
        } else {
            const s = String(pin0 || '').trim().toLowerCase();
            task.pinned = s === 'true' || s === '1';
        }

        const meta = MetaStore.get(task.id);
        if (meta) {
            if ('pinned' in meta) {
                const ms = meta.pinned;
                if (typeof ms === 'boolean') task.pinned = ms;
                else {
                    const s = String(ms || '').trim().toLowerCase();
                    if (s === 'true' || s === '1' || s === '') task.pinned = s === 'true' || s === '1';
                }
            }
            if (!isValidValue(task.priority) && isValidValue(meta.priority)) task.priority = normalizePriority(meta.priority);
            if (!isValidValue(task.duration) && isValidValue(meta.duration)) task.duration = meta.duration;
            if (!isValidValue(task.remark) && isValidValue(meta.remark)) task.remark = meta.remark;
            if (!isValidValue(task.completionTime) && isValidValue(meta.completionTime)) task.completionTime = meta.completionTime;
            if (!isValidValue(task.startDate) && isValidValue(meta.startDate)) task.startDate = meta.startDate;
            if (!isValidValue(task.customTime) && isValidValue(meta.customTime)) task.customTime = meta.customTime;
            if (!isValidValue(task.customStatus) && isValidValue(meta.customStatus)) task.customStatus = meta.customStatus;
        }

        task.docName = task.docName || task.doc_name || docNameFallback || '未知文档';
        task.parentTaskId = task.parentTaskId || task.parent_task_id || null;
        task.docId = task.docId || task.root_id || null;
        return task;
    }

    function __tmFormatDate(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleDateString();
    }

    function __tmFormatTaskTime(value) {
        const s = String(value || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 10);
        if (/^\d{14}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        if (/^\d+$/.test(s)) {
            const n = Number(s);
            if (Number.isFinite(n) && n > 0) {
                const ts = n < 1e12 ? n * 1000 : n;
                const d0 = new Date(ts);
                if (!Number.isNaN(d0.getTime())) {
                    const pad = (n) => String(n).padStart(2, '0');
                    return `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`;
                }
            }
        }
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return s;
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function __tmGetTaskSpentMinutes(task) {
        if (!SettingsStore.data.enableTomatoIntegration) return null;
        const mode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() || 'minutes';
        if (mode === 'hours') return null;
        const m = __tmParseNumber(task?.tomatoMinutes);
        if (!Number.isFinite(m) || m <= 0) return null;
        return Math.round(m);
    }

    function __tmFormatSpentHours(hours) {
        const n = Number(hours);
        if (!Number.isFinite(n) || n <= 0) return '';
        const rounded = Math.round(n * 100) / 100;
        return String(rounded);
    }

    function __tmFormatSpentMinutes(minutes) {
        const n = Number(minutes);
        if (!Number.isFinite(n) || n <= 0) return '';
        const total = Math.round(n);
        const h = Math.floor(total / 60);
        const m = total % 60;
        if (h > 0 && m > 0) return `${h}h${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    }

    function __tmNormalizeDateOnly(value) {
        const s = String(value || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}\s/.test(s)) return s.slice(0, 10);
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function __tmParseTimeToTs(value) {
        const s = String(value || '').trim();
        if (!s) return 0;
        if (/^\d{14}$/.test(s)) {
            const y = Number(s.slice(0, 4));
            const mon = Number(s.slice(4, 6)) - 1;
            const d = Number(s.slice(6, 8));
            const hh = Number(s.slice(8, 10));
            const mm = Number(s.slice(10, 12));
            const ss = Number(s.slice(12, 14));
            const dt = new Date(y, mon, d, hh, mm, ss, 0);
            return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
        }
        if (/^\d{8}$/.test(s)) {
            const y = Number(s.slice(0, 4));
            const mon = Number(s.slice(4, 6)) - 1;
            const d = Number(s.slice(6, 8));
            const dt = new Date(y, mon, d, 12, 0, 0, 0);
            return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
        }
        if (/^\d+$/.test(s)) {
            const n = Number(s);
            if (!Number.isFinite(n) || n <= 0) return 0;
            const ts = n < 1e12 ? n * 1000 : n;
            return ts;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
            const y = Number(m[1]);
            const mon = Number(m[2]) - 1;
            const d = Number(m[3]);
            const dt = new Date(y, mon, d, 12, 0, 0, 0);
            return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
        }
        const t = new Date(s).getTime();
        return Number.isNaN(t) ? 0 : t;
    }

    function __tmParseDurationMinutes(value) {
        const s = String(value || '').trim();
        if (!s) return null;
        if (/^\d+(\.\d+)?$/.test(s)) {
            const n = Number(s);
            return Number.isFinite(n) && n >= 0 ? n : null;
        }
        let total = 0;
        let matched = false;
        const re = /(\d+(?:\.\d+)?)\s*([dhm])/ig;
        let m;
        while ((m = re.exec(s))) {
            matched = true;
            const n = Number(m[1]);
            const unit = String(m[2] || '').toLowerCase();
            if (!Number.isFinite(n)) continue;
            if (unit === 'd') total += n * 1440;
            else if (unit === 'h') total += n * 60;
            else total += n;
        }
        if (matched) return total;
        const n0 = Number.parseFloat(s);
        return Number.isFinite(n0) && n0 >= 0 ? n0 : null;
    }

    function __tmComputePriorityScore(task) {
        const cfg = (SettingsStore.data.priorityScoreConfig && typeof SettingsStore.data.priorityScoreConfig === 'object')
            ? SettingsStore.data.priorityScoreConfig
            : {};
        const base = Number.isFinite(Number(cfg.base)) ? Number(cfg.base) : 100;
        const weights = (cfg.weights && typeof cfg.weights === 'object') ? cfg.weights : {};
        const w = (k) => {
            const n = Number(weights[k]);
            return Number.isFinite(n) ? n : 1;
        };

        let score = base;

        const impDeltaMap = (cfg.importanceDelta && typeof cfg.importanceDelta === 'object') ? cfg.importanceDelta : {};
        const imp = String(task?.priority || 'none').trim() || 'none';
        const impDelta = Number(impDeltaMap[imp] ?? impDeltaMap.none ?? 0);
        if (Number.isFinite(impDelta)) score += w('importance') * impDelta;

        const statusDeltaMap = (cfg.statusDelta && typeof cfg.statusDelta === 'object') ? cfg.statusDelta : {};
        const st = String(task?.customStatus || 'todo').trim() || 'todo';
        const stDelta = Number(statusDeltaMap[st] ?? 0);
        if (Number.isFinite(stDelta)) score += w('status') * stDelta;

        const dueStr = String(task?.completionTime || '').trim();
        if (dueStr) {
            const dueTs = __tmParseTimeToTs(dueStr);
            if (dueTs) {
                const daysUntil = (dueTs - Date.now()) / 86400000;
                const ranges0 = Array.isArray(cfg.dueRanges) ? cfg.dueRanges : [];
                const ranges = ranges0
                    .map(r => ({ days: Number(r?.days), delta: Number(r?.delta) }))
                    .filter(r => Number.isFinite(r.days) && Number.isFinite(r.delta))
                    .sort((a, b) => a.days - b.days);
                let delta = 0;
                for (const r of ranges) {
                    if (daysUntil <= r.days) { delta = r.delta; break; }
                }
                score += w('due') * delta;
            }
        }

        const mins = __tmParseDurationMinutes(task?.duration);
        if (mins != null) {
            const buckets0 = Array.isArray(cfg.durationBuckets) ? cfg.durationBuckets : [];
            const buckets = buckets0
                .map(b => ({ maxMinutes: Number(b?.maxMinutes), delta: Number(b?.delta) }))
                .filter(b => Number.isFinite(b.maxMinutes) && Number.isFinite(b.delta))
                .sort((a, b) => a.maxMinutes - b.maxMinutes);
            let delta = 0;
            for (const b of buckets) {
                if (mins <= b.maxMinutes) { delta = b.delta; break; }
            }
            score += w('duration') * delta;
        }

        const docId = String(task?.docId || task?.root_id || '').trim();
        if (docId) {
            const docDeltas = (cfg.docDeltas && typeof cfg.docDeltas === 'object') ? cfg.docDeltas : {};
            const delta = Number(docDeltas[docId] ?? 0);
            if (Number.isFinite(delta)) score += w('doc') * delta;
        }

        return Number.isFinite(score) ? score : base;
    }

    let __tmCellEditorState = null;

    function __tmCloseCellEditor(shouldRerender) {
        if (__tmCellEditorState?.cleanup) {
            try { __tmCellEditorState.cleanup(); } catch (e) {}
        }
        __tmCellEditorState = null;
        if (shouldRerender) {
            applyFilters();
            render();
        }
    }

    async function __tmCommitCellEdit(id, field, value) {
        const task = state.flatTasks[id];
        if (!task) return;
        try {
            if (field === 'priority') {
                const next = value === 'high' || value === 'medium' || value === 'low' ? value : '';
                task.priority = next;
                __tmPersistMetaAndAttrs(id, { priority: next });
                hint('✅ 优先级已更新', 'success');
                return;
            }
            if (field === 'duration') {
                const next = String(value || '').trim();
                task.duration = next;
                __tmPersistMetaAndAttrs(id, { duration: next });
                hint('✅ 时长已更新', 'success');
                return;
            }
            if (field === 'remark') {
                const next = String(value || '').trim();
                task.remark = next;
                __tmPersistMetaAndAttrs(id, { remark: next });
                hint('✅ 备注已更新', 'success');
                return;
            }
            if (field === 'completionTime') {
                const raw = String(value || '').trim();
                const next = raw ? __tmNormalizeDateOnly(raw) : '';
                task.completionTime = next;
                __tmPersistMetaAndAttrs(id, { completionTime: next });
                hint(next ? '✅ 完成时间已更新' : '✅ 完成时间已清空', 'success');
                return;
            }
            if (field === 'startDate') {
                const raw = String(value || '').trim();
                const next = raw ? __tmNormalizeDateOnly(raw) : '';
                task.startDate = next;
                __tmPersistMetaAndAttrs(id, { startDate: next });
                hint(next ? '✅ 开始日期已更新' : '✅ 开始日期已清空', 'success');
                return;
            }
            if (field === 'customTime') {
                const raw = String(value || '').trim();
                task.customTime = raw;
                __tmPersistMetaAndAttrs(id, { customTime: raw });
                hint(raw ? '✅ 任务时间已更新' : '✅ 任务时间已清空', 'success');
                return;
            }
        } catch (e) {
            hint(`❌ 更新失败: ${e.message}`, 'error');
        }
    }

    window.tmBeginCellEdit = function(id, field, td, ev) {
        try {
            if (ev) {
                if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
                if (typeof ev.preventDefault === 'function') ev.preventDefault();
            }
        } catch (e) {}

        if (!td) return;
        const existingInput = td.querySelector?.('input,select');
        if (existingInput) {
            try { existingInput.focus?.(); } catch (e) {}
            return;
        }

        __tmCloseInlineEditor();
        __tmCloseCellEditor(false);

        const originalText = td.textContent;
        const cleanupFns = [];
        const cleanup = () => {
            while (cleanupFns.length) {
                const fn = cleanupFns.pop();
                try { fn(); } catch (e) {}
            }
        };
        __tmCellEditorState = { td, cleanup };

        const task = state.flatTasks[id];
        if (!task) return;

        const finish = (rerender) => __tmCloseCellEditor(rerender);
        const cancel = () => finish(true);

        const commitAndClose = async (val) => {
            await __tmCommitCellEdit(id, field, val);
            finish(true);
        };

        td.innerHTML = '';

        if (field === 'priority') {
            const select = document.createElement('select');
            select.className = 'tm-cell-editor-select';
            select.innerHTML = `
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
            `;
            select.value = task.priority || 'medium';
            td.appendChild(select);

            select.onchange = () => commitAndClose(select.value);
            select.onblur = () => cancel();
            select.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter') commitAndClose(select.value);
            };
            try {
                select.focus();
                setTimeout(() => {
                    try { select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch (e) {}
                    try { select.click(); } catch (e) {}
                }, 0);
            } catch (e) {}
            return;
        }

        if (field === 'completionTime') {
            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'tm-cell-editor-input';
            const val = String(task.completionTime || '').trim();
            input.value = val ? val.slice(0, 10) : '';
            td.appendChild(input);

            const initial = input.value;
            let committed = false;
            const save = () => {
                if (committed) return;
                const next = String(input.value || '').trim();
                if (next === String(initial || '').trim()) {
                    committed = true;
                    finish(false);
                    return;
                }
                committed = true;
                commitAndClose(next);
            };
            input.onchange = () => save();
            input.onblur = () => {
                if (committed) return;
                committed = true;
                cancel();
            };
            input.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter') save();
            };
            input.onclick = () => {
                try { input.showPicker?.(); } catch (e) {}
            };
            try {
                input.focus();
                input.showPicker?.();
            } catch (e) {}
            return;
        }

        if (field === 'startDate') {
            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'tm-cell-editor-input';
            const val = String(task.startDate || '').trim();
            input.value = val ? val.slice(0, 10) : '';
            td.appendChild(input);

            const initial = input.value;
            let committed = false;
            const save = () => {
                if (committed) return;
                const next = String(input.value || '').trim();
                if (next === String(initial || '').trim()) {
                    committed = true;
                    finish(false);
                    return;
                }
                committed = true;
                commitAndClose(next);
            };
            input.onchange = () => save();
            input.onblur = () => {
                if (committed) return;
                committed = true;
                cancel();
            };
            input.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter') save();
            };
            input.onclick = () => {
                try { input.showPicker?.(); } catch (e) {}
            };
            try {
                input.focus();
                input.showPicker?.();
            } catch (e) {}
            return;
        }

        if (field === 'customTime') {
            const input = document.createElement('input');
            input.type = 'datetime-local';
            input.className = 'tm-cell-editor-input';
            const current = String(task.customTime || '').trim();
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(current)) input.value = current.slice(0, 16);
            else input.value = __tmToDatetimeLocalValue(current);
            td.appendChild(input);

            const initial = input.value;
            let committed = false;
            const save = () => {
                if (committed) return;
                const next = String(input.value || '').trim();
                if (next === String(initial || '').trim()) {
                    committed = true;
                    finish(false);
                    return;
                }
                committed = true;
                commitAndClose(next);
            };
            input.onchange = () => save();
            input.onblur = () => {
                if (committed) return;
                committed = true;
                cancel();
            };
            input.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter') save();
            };
            input.onclick = () => {
                try { input.showPicker?.(); } catch (e) {}
            };
            try {
                input.focus();
                input.showPicker?.();
            } catch (e) {}
            return;
        }

        if (field === 'duration' || field === 'remark') {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tm-cell-editor-input';
            input.value = field === 'duration' ? String(task.duration || '') : String(task.remark || '');
            td.appendChild(input);
            const save = () => commitAndClose(input.value);
            input.onblur = () => save();
            input.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter') save();
            };
            try {
                input.focus();
                input.select?.();
            } catch (e) {}
            return;
        }

        td.textContent = originalText;
        finish(false);
    };

    let __tmInlineEditorState = null;

    function __tmCloseInlineEditor() {
        if (!__tmInlineEditorState) return;
        try { __tmInlineEditorState.cleanup?.(); } catch (e) {}
        try { __tmInlineEditorState.el?.remove?.(); } catch (e) {}
        __tmInlineEditorState = null;
    }

    function __tmOpenInlineEditor(anchorEl, build) {
        if (!anchorEl) return null;
        __tmCloseInlineEditor();

        const editor = document.createElement('div');
        editor.className = 'tm-inline-editor';
        editor.tabIndex = -1;
        document.body.appendChild(editor);

        const cleanupFns = [];
        const cleanup = () => {
            while (cleanupFns.length) {
                const fn = cleanupFns.pop();
                try { fn(); } catch (e) {}
            }
        };

        const api = {
            editor,
            close: __tmCloseInlineEditor,
            onCleanup: (fn) => cleanupFns.push(fn),
        };

        build(api);

        const rect = anchorEl.getBoundingClientRect();
        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        const vh = window.innerHeight || document.documentElement.clientHeight || 0;

        const ew = editor.offsetWidth || 240;
        const eh = editor.offsetHeight || 120;
        const gap = 6;

        let left = rect.left;
        let top = rect.bottom + gap;
        if (left + ew + 8 > vw) left = Math.max(8, vw - ew - 8);
        if (top + eh + 8 > vh) {
            const up = rect.top - eh - gap;
            if (up >= 8) top = up;
            else top = Math.max(8, vh - eh - 8);
        }
        left = Math.max(8, left);

        editor.style.left = `${Math.round(left)}px`;
        editor.style.top = `${Math.round(top)}px`;

        const onDocPointerDown = (e) => {
            const t = e.target;
            if (editor.contains(t)) return;
            if (anchorEl.contains && anchorEl.contains(t)) return;
            __tmCloseInlineEditor();
        };
        const onDocKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                __tmCloseInlineEditor();
            }
        };

        document.addEventListener('pointerdown', onDocPointerDown, true);
        document.addEventListener('keydown', onDocKeyDown, true);

        cleanupFns.push(() => document.removeEventListener('pointerdown', onDocPointerDown, true));
        cleanupFns.push(() => document.removeEventListener('keydown', onDocKeyDown, true));

        __tmInlineEditorState = { el: editor, cleanup };

        try {
            const focusable = editor.querySelector('input,select,button,textarea');
            focusable?.focus?.();
            focusable?.select?.();
        } catch (e) {}

        return api;
    }

    function __tmBuildActions(okLabel, onOk, onCancel, extraButtons) {
        const wrap = document.createElement('div');
        wrap.className = 'tm-inline-editor-actions';

        if (Array.isArray(extraButtons)) {
            extraButtons.forEach(btn => wrap.appendChild(btn));
        }

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'tm-btn tm-btn-secondary';
        cancelBtn.textContent = '取消';
        cancelBtn.onclick = () => onCancel?.();

        const okBtn = document.createElement('button');
        okBtn.className = 'tm-btn tm-btn-primary';
        okBtn.textContent = okLabel || '确定';
        okBtn.onclick = () => onOk?.();

        wrap.appendChild(cancelBtn);
        wrap.appendChild(okBtn);
        return { wrap, okBtn, cancelBtn };
    }

    window.tmEditPriorityInline = function(id, el) {
        const task = state.flatTasks[id];
        if (!task) return;
        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const select = document.createElement('select');
            const opts = [
                { value: '', label: '无' },
                { value: 'high', label: '高' },
                { value: 'medium', label: '中' },
                { value: 'low', label: '低' },
            ];
            select.innerHTML = opts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
            select.value = task.priority || '';
            select.onchange = async () => {
                const next = String(select.value || '');
                try {
                    task.priority = next;
                    __tmPersistMetaAndAttrs(id, { priority: next });
                    close();
                    applyFilters();
                    render();
                    hint('✅ 优先级已更新', 'success');
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                }
            };
            editor.appendChild(select);
        });
    };

    window.tmEditDurationInline = function(id, el) {
        const task = state.flatTasks[id];
        if (!task) return;
        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '例如：30 或 30m';
            input.value = String(task.duration || '');
            editor.appendChild(input);
            const { wrap } = __tmBuildActions('保存', async () => {
                const next = String(input.value || '').trim();
                try {
                    task.duration = next;
                    __tmPersistMetaAndAttrs(id, { duration: next });
                    close();
                    applyFilters();
                    render();
                    hint('✅ 时长已更新', 'success');
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                }
            }, close);
            editor.appendChild(wrap);
            input.onkeydown = (e) => {
                if (e.key === 'Enter') wrap.querySelector('button.tm-btn-primary')?.click?.();
            };
        });
    };

    window.tmEditRemarkInline = function(id, el) {
        const task = state.flatTasks[id];
        if (!task) return;
        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '输入备注（可留空）';
            input.value = String(task.remark || '');
            editor.appendChild(input);
            const { wrap } = __tmBuildActions('保存', async () => {
                const next = String(input.value || '').trim();
                try {
                    task.remark = next;
                    __tmPersistMetaAndAttrs(id, { remark: next });
                    close();
                    applyFilters();
                    render();
                    hint('✅ 备注已更新', 'success');
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                }
            }, close);
            editor.appendChild(wrap);
            input.onkeydown = (e) => {
                if (e.key === 'Enter') wrap.querySelector('button.tm-btn-primary')?.click?.();
            };
        });
    };

    window.tmEditCompletionTimeInline = function(id, el) {
        const task = state.flatTasks[id];
        if (!task) return;
        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const input = document.createElement('input');
            input.type = 'date';
            input.value = __tmNormalizeDateOnly(task.completionTime || '');
            editor.appendChild(input);

            const clearBtn = document.createElement('button');
            clearBtn.className = 'tm-btn tm-btn-secondary';
            clearBtn.textContent = '清空';
            clearBtn.onclick = async () => {
                try {
                    task.completionTime = '';
                    __tmPersistMetaAndAttrs(id, { completionTime: '' });
                    close();
                    applyFilters();
                    render();
                    hint('✅ 完成时间已清空', 'success');
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                }
            };

            const save = async () => {
                const raw = String(input.value || '').trim();
                const next = raw ? __tmNormalizeDateOnly(raw) : '';
                try {
                    task.completionTime = next;
                    __tmPersistMetaAndAttrs(id, { completionTime: next });
                    close();
                    applyFilters();
                    render();
                    hint('✅ 完成时间已更新', 'success');
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                }
            };

            const actions = document.createElement('div');
            actions.className = 'tm-inline-editor-actions';
            actions.appendChild(clearBtn);
            editor.appendChild(actions);

            input.onchange = () => save();
            input.onkeydown = (e) => {
                if (e.key === 'Enter') save();
            };
        });
    };

    window.tmEditPriority = async function(id) {
        const task = state.flatTasks[id];
        if (!task) return;
        const next = await showSelectPrompt('设置优先级', [
            { value: '', label: '无' },
            { value: 'high', label: '高' },
            { value: 'medium', label: '中' },
            { value: 'low', label: '低' },
        ], task.priority || '');
        if (next == null) return;
        try {
            task.priority = next;
            __tmPersistMetaAndAttrs(id, { priority: next });
            applyFilters();
            render();
            hint('✅ 优先级已更新', 'success');
        } catch (e) {
            hint(`❌ 更新失败: ${e.message}`, 'error');
        }
    };

    window.tmEditDuration = async function(id) {
        const task = state.flatTasks[id];
        if (!task) return;
        const next = await showPrompt('设置时长', '例如：30 或 30m', String(task.duration || ''));
        if (next == null) return;
        try {
            task.duration = next;
            __tmPersistMetaAndAttrs(id, { duration: String(next || '').trim() });
            applyFilters();
            render();
            hint('✅ 时长已更新', 'success');
        } catch (e) {
            hint(`❌ 更新失败: ${e.message}`, 'error');
        }
    };

    window.tmEditRemark = async function(id) {
        const task = state.flatTasks[id];
        if (!task) return;
        const next = await showPrompt('设置备注', '输入备注（可留空）', String(task.remark || ''));
        if (next == null) return;
        try {
            task.remark = next;
            __tmPersistMetaAndAttrs(id, { remark: String(next || '').trim() });
            applyFilters();
            render();
            hint('✅ 备注已更新', 'success');
        } catch (e) {
            hint(`❌ 更新失败: ${e.message}`, 'error');
        }
    };

    window.tmEditCompletionTime = async function(id) {
        const task = state.flatTasks[id];
        if (!task) return;
        const next = await showDateTimePrompt('设置完成时间', task.completionTime || '');
        if (next == null) return;
        try {
            task.completionTime = next;
            __tmPersistMetaAndAttrs(id, { completionTime: String(next || '').trim() });
            applyFilters();
            render();
            hint('✅ 完成时间已更新', 'success');
        } catch (e) {
            hint(`❌ 更新失败: ${e.message}`, 'error');
        }
    };

    window.updateFontSize = async function(value) {
        const size = parseInt(value) || 14;
        await SettingsStore.updateFontSize(size);
        render();
    };

    window.updateFontSizeMobile = async function(value) {
        const size = parseInt(value) || 14;
        await SettingsStore.updateFontSizeMobile(size);
        render();
    };

    window.updateTaskHeadingLevel = async function(value) {
        const level = String(value || 'h2').trim();
        SettingsStore.data.taskHeadingLevel = level;
        await SettingsStore.save();
        render();
    };

    // 导航功能
    const __getPluginApp = () => globalThis.__taskHorizonPluginApp || globalThis.__tomatoPluginApp || (window.siyuan?.app) || null;
    
    // 尝试获取全局的 API 函数
    const getOpenTabFn = () => {
        return window.openTab || 
               window.siyuan?.openTab || 
               globalThis.__taskHorizonOpenTab ||
               globalThis.__tomatoOpenTab ||
               (window.siyuan?.ws?.openTab); // 某些版本可能在这里
    };

    const getOpenMobileFn = () => {
        return window.openMobileFileById || 
               window.siyuan?.openMobileFileById || 
               globalThis.__taskHorizonOpenMobileFileById ||
               globalThis.__tomatoOpenMobileFileById;
    };

    const __tmFindActiveProtyle = () => {
        const isVisible = (el) => {
            try { return !!el && el.offsetParent !== null; } catch (e) { return false; }
        };
        return (
            document.querySelector('.layout__wnd--active .protyle') ||
            Array.from(document.querySelectorAll('.protyle')).find(isVisible) ||
            null
        );
    };

    const __tmFindBlockElement = (blockId) => {
        if (!blockId) return null;
        const active = __tmFindActiveProtyle();
        const root = active?.querySelector?.('.protyle-wysiwyg') || active || document;
        const selectors = [
            `[data-node-id="${blockId}"]`,
            `.li[data-node-id="${blockId}"]`,
            `.p[data-node-id="${blockId}"]`
        ];
        for (const sel of selectors) {
            const el = root.querySelector(sel) || document.querySelector(sel);
            if (el) return el;
        }
        return null;
    };

    const __tmScrollToBlock = (blockId) => {
        if (!blockId) return false;
        try {
            if (window.siyuan?.block?.scrollToBlock) {
                window.siyuan.block.scrollToBlock(blockId);
            }
        } catch (e) {}
        const el = __tmFindBlockElement(blockId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('tm-block-highlight');
            setTimeout(() => {
                try { el.classList.remove('tm-block-highlight'); } catch (e) {}
            }, 1200);
            return true;
        }
        return false;
    };

    const __tmScheduleScrollToBlock = (blockId, retries = 12) => {
        let attempt = 0;
        const run = () => {
            attempt += 1;
            const ok = __tmScrollToBlock(blockId);
            if (!ok && attempt < retries) {
                setTimeout(run, 300);
            }
        };
        setTimeout(run, 200);
    };

    window.tmJumpToTask = async function(id, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const app = __getPluginApp();
        const closeAfterJump = () => {
            if (!__tmIsMobileDevice()) return;
            setTimeout(() => {
                try { window.tmClose?.(); } catch (e) {}
            }, 120);
        };

        // 1. 优先尝试移动端 API (如果在移动端环境下)
        const openMobile = getOpenMobileFn();
        if (typeof openMobile === 'function') {
            try {
                let docId = id;
                try {
                    const sql = `SELECT root_id FROM blocks WHERE id = '${id}' LIMIT 1`;
                    const res = await API.call('/api/query/sql', { stmt: sql });
                    const rows = (res && res.code === 0) ? res.data : [];
                    docId = (rows && rows[0] && rows[0].root_id) ? rows[0].root_id : id;
                } catch (e) {}
                openMobile(app, docId);
                setTimeout(() => __tmScheduleScrollToBlock(id, 24), 650);
                closeAfterJump();
                return;
            } catch (e) {}
        }
        
        // 2. 桌面端优先尝试 findDocumentIdByBlockId + openTab (参照 tomato.js)
        const openTab = getOpenTabFn();
        if (typeof openTab === 'function') {
            try {
                // 获取所在文档ID
                const sql = `SELECT root_id FROM blocks WHERE id = '${id}' LIMIT 1`;
                const res = await API.call('/api/query/sql', { stmt: sql });
                // API.call 返回的是 {code:0, data: [...]}
                const rows = (res && res.code === 0) ? res.data : [];
                const docId = (rows && rows[0]) ? rows[0].root_id : id;

                // 使用 openTab 打开文档
                // 构造参数：打开文档 root_id
                const params = { 
                    app, 
                    doc: { id: docId }
                };
                
                // 如果目标块不是文档本身，尝试通过 block 参数定位（注意：不同版本思源对 block 参数支持不同）
                // 另一种常见的定位方式是先打开文档，再通过 hash 定位，但 openTab 封装了这些
                if (docId !== id) {
                    // 尝试同时传入 block 信息，这通常会触发滚动高亮
                    params.block = { id: id, mode: 0 }; // mode: 0 可能表示不高亮聚焦？尝试一下
                }

                openTab(params);
                __tmScheduleScrollToBlock(id);
                closeAfterJump();
                // 补充：如果 openTab 不支持直接定位到块，可能需要发送消息或执行脚本
                // 但通常 openTab({doc:{id: rootId}}) 会打开文档，如果我们要定位到块，
                // 在新版思源中，可能需要 openFileById 风格的参数
                
                return;
            } catch (e) {}
        }

        // 3. 兜底：模拟点击 block-ref
        try {
            const tempSpan = document.createElement('span');
            tempSpan.setAttribute('data-type', 'block-ref');
            tempSpan.setAttribute('data-id', id);
            // 使用对布局无影响但可被交互的样式
            tempSpan.style.position = 'fixed';
            tempSpan.style.top = '-9999px';
            tempSpan.style.left = '-9999px';
            tempSpan.style.opacity = '0';
            tempSpan.style.pointerEvents = 'none';
            document.body.appendChild(tempSpan);
            
            const opts = {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1
            };
            tempSpan.dispatchEvent(new MouseEvent('mousedown', opts));
            tempSpan.dispatchEvent(new MouseEvent('mouseup', opts));
            tempSpan.dispatchEvent(new MouseEvent('click', opts));
            
            setTimeout(() => tempSpan.remove(), 100);
            closeAfterJump();
            return;
        } catch (e) {}

        // 4. 兜底：使用 URL Scheme
        window.open(`siyuan://blocks/${id}`);
        closeAfterJump();
    };

    function __tmBuildTaskRowModel() {
        if (!Array.isArray(state.filteredTasks) || state.filteredTasks.length === 0) return [];

        const isDark = __tmIsDarkMode();
        const timeBaseColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, '#6ba5ff')
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, '#1a73e8');
        const timeOverdueColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b')
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025');
        const __tmGetTimeGroupLabelColor = (groupInfo) => {
            const key = String(groupInfo?.key || '');
            const sortValue = Number(groupInfo?.sortValue);
            if (key === 'pending' || !Number.isFinite(sortValue)) return 'var(--tm-secondary-text)';
            if (sortValue < 0) return timeOverdueColor || 'var(--tm-danger-color)';
            const minA = isDark ? 0.52 : 0.42;
            const step = isDark ? 0.085 : 0.11;
            const alpha = __tmClamp(1 - sortValue * step, minA, 1);
            return __tmWithAlpha(timeBaseColor || 'var(--tm-primary-color)', alpha);
        };

        const rows = [];

        const filteredIdSet = new Set(state.filteredTasks.map(t => t.id));
        const orderMap = new Map(state.filteredTasks.map((t, i) => [t.id, i]));
        const getTaskOrder = (taskId) => orderMap.get(taskId) ?? Infinity;

        const rootTasks = state.filteredTasks.filter(t => {
            if (!t.parentTaskId) return true;
            return !filteredIdSet.has(t.parentTaskId);
        });

        const pinnedRoots = rootTasks.filter(t => t.pinned);
        const normalRoots = rootTasks.filter(t => !t.pinned);
        pinnedRoots.sort((a, b) => getTaskOrder(a.id) - getTaskOrder(b.id));
        normalRoots.sort((a, b) => getTaskOrder(a.id) - getTaskOrder(b.id));

        const emitTask = (task, depth, hasChildren, collapsed) => {
            rows.push({
                type: 'task',
                id: String(task?.id || ''),
                depth: Math.max(0, Number(depth) || 0),
                hasChildren: !!hasChildren,
                collapsed: !!collapsed,
            });
        };

        const walkTaskTree = (task, depth) => {
            const childTasks = (task.children || []).filter(c => filteredIdSet.has(c.id));
            childTasks.sort((a, b) => getTaskOrder(a.id) - getTaskOrder(b.id));
            const hasChildren = childTasks.length > 0;
            const collapsed = state.collapsedTaskIds.has(String(task.id));
            const showChildren = hasChildren && !task.done;
            emitTask(task, depth, showChildren, collapsed);
            if (showChildren && !collapsed) {
                childTasks.forEach(child => walkTaskTree(child, depth + 1));
            }
        };

        pinnedRoots.forEach(task => walkTaskTree(task, 0));

        if (state.quadrantEnabled && normalRoots.length > 0) {
            const quadrantRules = (SettingsStore.data.quadrantConfig && SettingsStore.data.quadrantConfig.rules) || [];
            const getImportanceLevel = (task) => {
                const priority = String(task.priority || '').toLowerCase();
                if (priority === 'a' || priority === '高' || priority === 'high') return 'high';
                if (priority === 'b' || priority === '中' || priority === 'medium') return 'medium';
                if (priority === 'c' || priority === '低' || priority === 'low') return 'low';
                return 'none';
            };
            const getTimeRange = (task) => {
                const timeStr = task.completionTime;
                if (!timeStr) return 'nodate';
                const taskDate = new Date(timeStr);
                if (isNaN(taskDate.getTime())) return 'nodate';
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const target = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
                const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) return 'overdue';
                if (diffDays <= 7) return 'within7days';
                if (diffDays <= 15) return 'within15days';
                if (diffDays <= 30) return 'within30days';
                return 'beyond30days';
            };
            const getTaskDays = (task) => {
                const timeStr = task.completionTime;
                if (!timeStr) return Infinity;
                const taskDate = new Date(timeStr);
                if (isNaN(taskDate.getTime())) return Infinity;
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const target = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
                return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
            };

            const quadrantGroups = {};
            quadrantRules.forEach(rule => {
                quadrantGroups[rule.id] = { ...rule, items: [] };
            });
            const quadrantOrder = ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'];

            normalRoots.forEach(task => {
                const importance = getImportanceLevel(task);
                const timeRange = getTimeRange(task);
                const taskDays = getTaskDays(task);
                let matchedRule = null;
                for (const rule of quadrantRules) {
                    const importanceMatch = rule.importance.includes(importance);
                    let timeRangeMatch = rule.timeRanges.includes(timeRange);
                    if (!timeRangeMatch) {
                        for (const range of rule.timeRanges) {
                            if (range.startsWith('beyond') && range !== 'beyond30days') {
                                const days = parseInt(range.replace('beyond', '').replace('days', ''));
                                if (!isNaN(days) && taskDays > days) { timeRangeMatch = true; break; }
                            }
                        }
                    }
                    if (importanceMatch && timeRangeMatch) { matchedRule = rule; break; }
                }
                if (matchedRule && quadrantGroups[matchedRule.id]) {
                    quadrantGroups[matchedRule.id].items.push(task);
                }
            });

            const calculateDuration = (items) => {
                const durationFormat = SettingsStore.data.durationFormat || 'hours';
                let totalMinutes = 0;
                items.forEach(task => {
                    const durationStr = String(task.duration || '').trim();
                    if (!durationStr) return;
                    let minutes = 0;
                    if (durationStr.toLowerCase().endsWith('h')) {
                        const hours = parseFloat(durationStr.toLowerCase().replace('h', ''));
                        if (!isNaN(hours)) minutes = hours * 60;
                    } else if (durationStr.toLowerCase().endsWith('min')) {
                        const mins = parseFloat(durationStr.toLowerCase().replace('min', ''));
                        if (!isNaN(mins)) minutes = mins;
                    } else {
                        const num = parseFloat(durationStr);
                        if (!isNaN(num)) minutes = num > 100 ? num : num * 60;
                    }
                    totalMinutes += minutes;
                });
                if (totalMinutes === 0) return '';
                if (durationFormat === 'hours') {
                    const hours = Math.round(totalMinutes / 60 * 10) / 10;
                    return `${hours}h`;
                }
                return `${totalMinutes}min`;
            };

            quadrantOrder.forEach((quadrantId) => {
                const group = quadrantGroups[quadrantId];
                if (!group || !Array.isArray(group.items) || group.items.length === 0) return;
                const groupKey = `quadrant_${quadrantId}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                rows.push({
                    type: 'group',
                    kind: 'quadrant',
                    key: groupKey,
                    label: String(group.name || ''),
                    color: String(group.color || ''),
                    count: group.items.length,
                    durationSum: calculateDuration(group.items),
                    collapsed: !!isCollapsed,
                });
                if (!isCollapsed) {
                    group.items.forEach(task => walkTaskTree(task, 0));
                }
            });
            return rows;
        }

        if (state.groupByDocName) {
            const docsInOrder = state.taskTree.map(d => d.id).filter(Boolean);
            docsInOrder.forEach(docId => {
                const docEntry = state.taskTree.find(d => d.id === docId);
                if (!docEntry) return;
                const docTasks = state.filteredTasks.filter(t => t.root_id === docId);
                if (docTasks.length === 0) return;
                const docRootTasks = docTasks.filter(t => {
                    if (!t.parentTaskId) return true;
                    return !filteredIdSet.has(t.parentTaskId);
                });
                const docNormal = docRootTasks.filter(t => !t.pinned);
                const docName = docEntry.name || '未知文档';
                const groupKey = `doc_${docId}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                rows.push({
                    type: 'group',
                    kind: 'doc',
                    key: groupKey,
                    label: String(docName),
                    count: docTasks.length,
                    collapsed: !!isCollapsed,
                });
                if (!isCollapsed) {
                    docNormal.forEach(task => walkTaskTree(task, 0));
                }
            });
            return rows;
        }

        if (state.groupByTime && normalRoots.length > 0) {
            const getTimeGroup = (task) => {
                const timeStr = task.completionTime;
                if (!timeStr) return { key: 'pending', label: '待定', sortValue: Infinity };
                const taskDate = new Date(timeStr);
                if (isNaN(taskDate.getTime())) return { key: 'pending', label: '待定', sortValue: Infinity };
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const target = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
                const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) return { key: 'overdue', label: '已过期', sortValue: diffDays };
                if (diffDays === 0) return { key: 'today', label: '今天', sortValue: 0 };
                if (diffDays === 1) return { key: 'tomorrow', label: '明天', sortValue: 1 };
                if (diffDays === 2) return { key: 'after_tomorrow', label: '后天', sortValue: 2 };
                return { key: `days_${diffDays}`, label: `余${diffDays}天`, sortValue: diffDays };
            };

            const timeGroups = new Map();
            normalRoots.forEach(task => {
                const groupInfo = getTimeGroup(task);
                if (!timeGroups.has(groupInfo.key)) timeGroups.set(groupInfo.key, { ...groupInfo, items: [] });
                timeGroups.get(groupInfo.key).items.push(task);
            });

            const sortedGroups = [...timeGroups.values()].sort((a, b) => a.sortValue - b.sortValue);
            const calculateGroupDuration = (items) => {
                const durationFormat = SettingsStore.data.durationFormat || 'hours';
                let totalMinutes = 0;
                items.forEach(task => {
                    const durationStr = String(task.duration || '').trim();
                    if (!durationStr) return;
                    let minutes = 0;
                    if (durationStr.toLowerCase().endsWith('h')) {
                        const hours = parseFloat(durationStr.toLowerCase().replace('h', ''));
                        if (!isNaN(hours)) minutes = hours * 60;
                    } else if (durationStr.toLowerCase().endsWith('min')) {
                        const mins = parseFloat(durationStr.toLowerCase().replace('min', ''));
                        if (!isNaN(mins)) minutes = mins;
                    } else {
                        const num = parseFloat(durationStr);
                        if (!isNaN(num)) minutes = num > 100 ? num : num * 60;
                    }
                    totalMinutes += minutes;
                });
                if (totalMinutes <= 0) return '';
                if (durationFormat === 'hours') {
                    const hours = totalMinutes / 60;
                    if (hours < 1) return `${Math.round(totalMinutes)}min`;
                    if (hours === Math.floor(hours)) return `${Math.round(hours)}h`;
                    return `${hours.toFixed(1)}h`;
                }
                return `${totalMinutes}min`;
            };

            sortedGroups.forEach(group => {
                const isCollapsed = state.collapsedGroups?.has(group.key);
                rows.push({
                    type: 'group',
                    kind: 'time',
                    key: String(group.key),
                    label: String(group.label || ''),
                    count: Array.isArray(group.items) ? group.items.length : 0,
                    labelColor: __tmGetTimeGroupLabelColor(group),
                    durationSum: calculateGroupDuration(group.items || []),
                    collapsed: !!isCollapsed,
                });
                if (!isCollapsed) {
                    group.items.sort((a, b) => getTaskOrder(a.id) - getTaskOrder(b.id));
                    group.items.forEach(task => walkTaskTree(task, 0));
                }
            });
            return rows;
        }

        normalRoots.forEach(task => walkTaskTree(task, 0));
        return rows;
    }

// 渲染任务列表（支持跨文档全局排序）
    function renderTaskList() {
        if (state.filteredTasks.length === 0) {
            const colCount = (SettingsStore.data.columnOrder || []).length || 7;
            return `<tr><td colspan="${colCount}" style="text-align: center; padding: 40px; color: var(--tm-secondary-text);">暂无任务</td></tr>`;
        }

        const isGloballyLocked = GlobalLock.isLocked();
        const colCount = (SettingsStore.data.columnOrder || []).length || 7;
        const isDark = __tmIsDarkMode();
        const timeBaseColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, '#6ba5ff')
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, '#1a73e8');
        const timeOverdueColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b')
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025');
        const __tmGetTimeGroupLabelColor = (groupInfo) => {
            const key = String(groupInfo?.key || '');
            const sortValue = Number(groupInfo?.sortValue);
            if (key === 'pending' || !Number.isFinite(sortValue)) return 'var(--tm-secondary-text)';
            if (sortValue < 0) return timeOverdueColor || 'var(--tm-danger-color)';
            const minA = isDark ? 0.52 : 0.42;
            const step = isDark ? 0.085 : 0.11;
            const alpha = __tmClamp(1 - sortValue * step, minA, 1);
            return __tmWithAlpha(timeBaseColor || 'var(--tm-primary-color)', alpha);
        };

        // 构建全局 Filtered ID 集合和顺序映射（用于保持全局排序）
        const filteredIdSet = new Set(state.filteredTasks.map(t => t.id));
        const orderMap = new Map(state.filteredTasks.map((t, i) => [t.id, i]));

        // 获取任务在 filtered 中的排序索引
        const getTaskOrder = (taskId) => orderMap.get(taskId) ?? Infinity;

        // 识别全局根任务：父任务不在 filtered 集合中，或本身就是顶层
        const rootTasks = state.filteredTasks.filter(t => {
            if (!t.parentTaskId) return true;
            return !filteredIdSet.has(t.parentTaskId);
        });

        // 分离置顶和非置顶的根任务
        const pinnedRoots = rootTasks.filter(t => t.pinned);
        const normalRoots = rootTasks.filter(t => !t.pinned);

        // 对根任务按照在 filteredTasks 中的顺序排序（确保全局排序生效）
        pinnedRoots.sort((a, b) => getTaskOrder(a.id) - getTaskOrder(b.id));
        normalRoots.sort((a, b) => getTaskOrder(a.id) - getTaskOrder(b.id));

        // 渲染单行（保持原有 emitRow 逻辑）
        const emitRow = (task, depth, hasChildren, collapsed) => {
            const { done, content, priority, completionTime, duration, remark, docName, pinned, startDate } = task;
            
            // 计算子任务统计信息
            const allChildren = task.children || [];
            const totalChildren = allChildren.length;
            const completedChildren = allChildren.filter(c => c.done).length;
            const remainingChildren = totalChildren - completedChildren;
            const childStatsHtml = remainingChildren > 0 
                ? `<span style="font-size: 11px; color: var(--tm-secondary-text); margin-left: 4px; background: var(--tm-doc-count-bg); padding: 1px 5px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; height: 14px;" title="共${totalChildren}个任务，已完成${completedChildren}个，剩余${remainingChildren}个">${remainingChildren}</span>`
                : '';
            
            const indent = Math.max(0, Number(depth) || 0) * 12;
            
            // 计算子任务进度条背景（复用已定义的 allChildren, totalChildren, completedChildren）
            const progressPercent = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
            const isDark = __tmIsDarkMode();
            const progressBarColor = isDark 
                ? __tmNormalizeHexColor(SettingsStore.data.progressBarColorDark, '#81c784')
                : __tmNormalizeHexColor(SettingsStore.data.progressBarColorLight, '#4caf50');
            const progressBarBgStyle = (hasChildren && progressPercent > 0) 
                ? `background: linear-gradient(90deg, ${progressBarColor} ${progressPercent}%, transparent ${progressPercent}%);` 
                : '';
            
            const toggle = hasChildren
                ? `<span class="tm-tree-toggle" onclick="tmToggleCollapse('${task.id}', event)">${collapsed ? '▸' : '▾'}</span>`
                : `<span class="tm-tree-spacer"></span>`;

            const widths = SettingsStore.data.columnWidths || {};
            const colOrder = SettingsStore.data.columnOrder || ['pinned', 'content', 'status', 'score', 'doc', 'h2', 'priority', 'startDate', 'completionTime', 'duration', 'spent', 'remark'];

            const cells = {
                pinned: () => `
                    <td style="text-align: center; width: ${widths.pinned || 48}px; min-width: ${widths.pinned || 48}px; max-width: ${widths.pinned || 48}px;">
                        <input type="checkbox" ${pinned ? 'checked' : ''}
                               onchange="tmSetPinned('${task.id}', this.checked, event)"
                               title="置顶">
                    </td>`,
                content: () => `
                    <td style="width: ${widths.content || 360}px; min-width: ${widths.content || 360}px; max-width: ${widths.content || 360}px; ${progressBarBgStyle}">
                        <div class="tm-task-cell" style="padding-left:${indent}px">
                            ${toggle}
                            <input class="tm-task-checkbox ${isGloballyLocked ? 'tm-operating' : ''}"
                                   type="checkbox" ${done ? 'checked' : ''}
                                   ${isGloballyLocked ? 'disabled' : ''}
                                   onchange="tmSetDone('${task.id}', this.checked, event)">
                            <span class="tm-task-text ${done ? 'tm-task-done' : ''}"
                                  data-level="${depth}"
                                  title="点击跳转到文档">
                                <span class="tm-task-content-clickable" onclick="tmJumpToTask('${task.id}', event)">${esc(content)}</span>
                            </span>
                            ${childStatsHtml}
                        </div>
                    </td>`,
                doc: () => `
                    <td style="width: ${widths.doc || 180}px; min-width: ${widths.doc || 180}px; max-width: ${widths.doc || 180}px;" title="${esc(docName || '')}">${esc(docName || '')}</td>`,
                h2: () => `
                    <td style="width: ${widths.h2 || 180}px; min-width: ${widths.h2 || 180}px; max-width: ${widths.h2 || 180}px;" title="${esc(task.h2 || '无')}">${esc(task.h2 || '无')}</td>`,
                score: () => {
                    const v = Number.isFinite(Number(task.priorityScore)) ? Math.round(Number(task.priorityScore)) : 0;
                    return `<td style="width: ${widths.score || 96}px; min-width: ${widths.score || 96}px; max-width: ${widths.score || 96}px; text-align: center; font-variant-numeric: tabular-nums;">${v}</td>`;
                },
                priority: () => {
                    const priorityClass = priority === 'high' ? 'tm-priority-high' : priority === 'low' ? 'tm-priority-low' : priority === 'medium' ? 'tm-priority-medium' : 'tm-priority-none';
                    const priorityText = priority ? ({ high: '高', medium: '中', low: '低' }[priority] || '无') : '无';
                    return `<td class="${priorityClass} tm-cell-editable" style="width: ${widths.priority || 96}px; min-width: ${widths.priority || 96}px; max-width: ${widths.priority || 96}px; text-align: center;" onclick="tmPickPriority('${task.id}', this, event)">${priorityText}</td>`;
                },
                startDate: () => `
                    <td class="tm-cell-editable" style="width: ${widths.startDate || 90}px; min-width: ${widths.startDate || 90}px; max-width: ${widths.startDate || 90}px;" onclick="tmBeginCellEdit('${task.id}','startDate',this,event)">${__tmFormatTaskTime(startDate)}</td>`,
                completionTime: () => `
                    <td class="tm-cell-editable" style="width: ${widths.completionTime || 170}px; min-width: ${widths.completionTime || 170}px; max-width: ${widths.completionTime || 170}px;" onclick="tmBeginCellEdit('${task.id}','completionTime',this,event)">${__tmFormatTaskTime(completionTime)}</td>`,
                duration: () => `
                    <td class="tm-cell-editable" style="width: ${widths.duration || 96}px; min-width: ${widths.duration || 96}px; max-width: ${widths.duration || 96}px;" onclick="tmBeginCellEdit('${task.id}','duration',this,event)">${esc(duration || '')}</td>`,
                spent: () => {
                    const mode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() || 'minutes';
                    const txt = (SettingsStore.data.enableTomatoIntegration && mode === 'hours')
                        ? __tmFormatSpentHours(__tmParseNumber(task?.tomatoHours))
                        : __tmFormatSpentMinutes(__tmGetTaskSpentMinutes(task));
                    return `<td style="width: ${widths.spent || 96}px; min-width: ${widths.spent || 96}px; max-width: ${widths.spent || 96}px; text-align:center; font-variant-numeric: tabular-nums;">${esc(txt)}</td>`;
                },
                remark: () => `
                    <td class="tm-cell-editable" style="width: ${widths.remark || 240}px; min-width: ${widths.remark || 240}px; max-width: ${widths.remark || 240}px;" title="${esc(remark || '')}" onclick="tmBeginCellEdit('${task.id}','remark',this,event)">${esc(remark || '')}</td>`,
                status: () => {
                     const statusOptions = SettingsStore.data.customStatusOptions || [];
                     const currentStatus = task.customStatus || 'todo';
                     const statusOption = statusOptions.find(o => o.id === currentStatus) || { name: currentStatus, color: '#757575' };
                     return `
                        <td style="width: ${widths.status || 96}px; min-width: ${widths.status || 96}px; max-width: ${widths.status || 96}px; text-align: center;" onclick="tmOpenStatusSelect('${task.id}', event)">
                            <span class="tm-status-tag" style="background-color: ${statusOption.color}; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 12px;">
                                ${statusOption.name}
                            </span>
                        </td>
                     `;
                }
            };

            const focusId = SettingsStore.data.enableTomatoIntegration ? String(state.timerFocusTaskId || '').trim() : '';
            const rowClass = focusId ? (focusId === String(task.id) ? 'tm-timer-focus' : 'tm-timer-dim') : '';
            let rowHtml = `<tr data-id="${task.id}" class="${rowClass}" draggable="true" ondragstart="tmDragTaskStart(event, '${task.id}')" onclick="tmRowClick(event, '${task.id}')" oncontextmenu="tmShowTaskContextMenu(event, '${task.id}')">`;
            colOrder.forEach(col => {
                if (cells[col]) rowHtml += cells[col]();
            });
            rowHtml += `</tr>`;
            return rowHtml;
        };

        // 递归渲染任务树，子任务按照全局 filteredTasks 顺序排列
        const renderTaskTree = (task, depth) => {
            const rows = [];

            // 获取该任务在 filtered 中的子任务
            const childTasks = (task.children || []).filter(c => filteredIdSet.has(c.id));

            // 按照全局排序顺序对子任务排序
            childTasks.sort((a, b) => getTaskOrder(a.id) - getTaskOrder(b.id));

            const hasChildren = childTasks.length > 0;
            const collapsed = state.collapsedTaskIds.has(String(task.id));
            const showChildren = hasChildren && !task.done;

            rows.push(emitRow(task, depth, showChildren, collapsed));

            if (showChildren && !collapsed) {
                childTasks.forEach(child => {
                    rows.push(...renderTaskTree(child, depth + 1));
                });
            }

            return rows;
        };

        const allRows = [];

        // 处理置顶任务（全局混排）
        if (pinnedRoots.length > 0) {
            pinnedRoots.forEach(task => {
                allRows.push(...renderTaskTree(task, 0));
            });
        }

        // 处理普通任务
        if (state.quadrantEnabled && normalRoots.length > 0) {
            // 四象限分组逻辑
            const quadrantRules = (SettingsStore.data.quadrantConfig && SettingsStore.data.quadrantConfig.rules) || [];
            
            // 获取任务的重要性等级
            const getImportanceLevel = (task) => {
                const priority = String(task.priority || '').toLowerCase();
                if (priority === 'a' || priority === '高' || priority === 'high') return 'high';
                if (priority === 'b' || priority === '中' || priority === 'medium') return 'medium';
                if (priority === 'c' || priority === '低' || priority === 'low') return 'low';
                return 'none';
            };
            
            // 获取任务的时间范围分类
            const getTimeRange = (task) => {
                const timeStr = task.completionTime;
                if (!timeStr) return 'nodate';
                
                const taskDate = new Date(timeStr);
                if (isNaN(taskDate.getTime())) return 'nodate';
                
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const target = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
                
                const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) return 'overdue';
                if (diffDays <= 7) return 'within7days';
                if (diffDays <= 15) return 'within15days';
                if (diffDays <= 30) return 'within30days';
                return 'beyond30days';
            };
            
            // 获取任务距离今天的天数
            const getTaskDays = (task) => {
                const timeStr = task.completionTime;
                if (!timeStr) return Infinity;
                const taskDate = new Date(timeStr);
                if (isNaN(taskDate.getTime())) return Infinity;
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const target = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
                return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
            };
            
            // 将任务分配到四象限
            const quadrantGroups = {};
            quadrantRules.forEach(rule => {
                quadrantGroups[rule.id] = {
                    ...rule,
                    items: [],
                    sortOrder: 0
                };
            });
            
            // 四象限排序：重要紧急 > 重要不紧急 > 不重要紧急 > 不重要不紧急
            const quadrantOrder = ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'];
            
            normalRoots.forEach(task => {
                const importance = getImportanceLevel(task);
                const timeRange = getTimeRange(task);
                const taskDays = getTaskDays(task);
                
                // 查找匹配的四象限规则
                let matchedRule = null;
                for (const rule of quadrantRules) {
                    const importanceMatch = rule.importance.includes(importance);
                    
                    // 检查时间范围匹配（支持 beyondXdays 范围）
                    let timeRangeMatch = rule.timeRanges.includes(timeRange);
                    if (!timeRangeMatch) {
                        // 检查是否选择了 "余X天以上" 选项
                        for (const range of rule.timeRanges) {
                            if (range.startsWith('beyond') && range !== 'beyond30days') {
                                const days = parseInt(range.replace('beyond', '').replace('days', ''));
                                if (!isNaN(days) && taskDays > days) {
                                    timeRangeMatch = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (importanceMatch && timeRangeMatch) {
                        matchedRule = rule;
                        break;
                    }
                }
                
                if (matchedRule) {
                    quadrantGroups[matchedRule.id].items.push(task);
                }
            });
            
            // 渲染四象限分组
            const colorMap = {
                red: 'var(--tm-quadrant-red)',
                yellow: 'var(--tm-quadrant-yellow)',
                blue: 'var(--tm-quadrant-blue)',
                green: 'var(--tm-quadrant-green)'
            };
            
            const bgColorMap = {
                red: 'var(--tm-quadrant-bg-red)',
                yellow: 'var(--tm-quadrant-bg-yellow)',
                blue: 'var(--tm-quadrant-bg-blue)',
                green: 'var(--tm-quadrant-bg-green)'
            };
            
            quadrantOrder.forEach((quadrantId, index) => {
                const group = quadrantGroups[quadrantId];
                if (!group || group.items.length === 0) return;
                
                const color = colorMap[group.color] || 'var(--tm-text-color)';
                
                // 支持折叠
                const groupKey = `quadrant_${quadrantId}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                const toggle = `<span class="tm-group-toggle" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;margin-right:8px;display:inline-block;width:12px;">${isCollapsed ? '▸' : '▾'}</span>`;
                
                // 计算时长总和
                const durationFormat = SettingsStore.data.durationFormat || 'hours';
                const calculateDuration = (items) => {
                    let totalMinutes = 0;
                    items.forEach(task => {
                        const durationStr = String(task.duration || '').trim();
                        if (!durationStr) return;
                        let minutes = 0;
                        if (durationStr.toLowerCase().endsWith('h')) {
                            const hours = parseFloat(durationStr.toLowerCase().replace('h', ''));
                            if (!isNaN(hours)) minutes = hours * 60;
                        } else if (durationStr.toLowerCase().endsWith('min')) {
                            const mins = parseFloat(durationStr.toLowerCase().replace('min', ''));
                            if (!isNaN(mins)) minutes = mins;
                        } else {
                            const num = parseFloat(durationStr);
                            if (!isNaN(num)) minutes = num > 100 ? num : num * 60;
                        }
                        totalMinutes += minutes;
                    });
                    if (totalMinutes === 0) return '';
                    if (durationFormat === 'hours') {
                        const hours = Math.round(totalMinutes / 60 * 10) / 10;
                        return `${hours}h`;
                    }
                    return `${totalMinutes}min`;
                };
                const durationSum = calculateDuration(group.items);
                
                allRows.push(`<tr class="tm-group-row"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:${color};border-bottom:1px solid var(--tm-table-border-color);"><div class="tm-group-sticky">${toggle}<span class="tm-quadrant-indicator tm-quadrant-bg-${group.color}"></span>${esc(group.name)} <span style="font-weight:normal;color:var(--tm-secondary-text);font-size:12px;background:var(--tm-doc-count-bg);padding:1px 6px;border-radius:10px;margin-left:4px;">${group.items.length}</span>${durationSum ? `<span style="font-weight:normal;color:var(--tm-primary-color);font-size:12px;background:var(--tm-info-bg);padding:1px 6px;border-radius:10px;margin-left:4px;border:1px solid var(--tm-info-border);">📊 ${durationSum}</span>` : ''}</div></td></tr>`);
                
                // 如果未折叠，渲染任务
                if (!isCollapsed) {
                    group.items.forEach(task => {
                        allRows.push(...renderTaskTree(task, 0));
                    });
                }
            });
        } else if (state.groupByDocName) {
            // 按文档分组模式：不应用全局混排，按文档顺序显示，支持折叠
            const docsInOrder = state.taskTree.map(d => d.id).filter(Boolean);

            docsInOrder.forEach(docId => {
                const docEntry = state.taskTree.find(d => d.id === docId);
                if (!docEntry) return;

                // 获取该文档在 filtered 中的任务
                const docTasks = state.filteredTasks.filter(t => t.root_id === docId);
                if (docTasks.length === 0) return;

                // 获取该文档的根任务
                const docRootTasks = docTasks.filter(t => {
                    if (!t.parentTaskId) return true;
                    return !filteredIdSet.has(t.parentTaskId);
                });

                // 分离置顶和非置顶
                const docNormal = docRootTasks.filter(t => !t.pinned);

                // 渲染文档标题（支持折叠）
                const docName = docEntry.name || '未知文档';
                const groupKey = `doc_${docId}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                const toggle = `<span class="tm-group-toggle" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;margin-right:8px;display:inline-block;width:12px;">${isCollapsed ? '▸' : '▾'}</span>`;

                allRows.push(`<tr class="tm-group-row"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);border-bottom:1px solid var(--tm-table-border-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color: var(--tm-group-doc-label-color);">📄 ${esc(docName)}</span> <span style="font-weight:normal;color:var(--tm-secondary-text);font-size:12px;background:var(--tm-doc-count-bg);padding:1px 6px;border-radius:10px;margin-left:4px;">${docTasks.length}</span></div></td></tr>`);

                // 渲染该文档的任务（如果未折叠）
                if (!isCollapsed) {
                    docNormal.forEach(task => {
                        allRows.push(...renderTaskTree(task, 0));
                    });
                }
            });
        } else if (state.groupByTime && normalRoots.length > 0) {
            // 按时间分组逻辑（跨文档）
            const getTimeGroup = (task) => {
                const timeStr = task.completionTime;
                if (!timeStr) {
                    return { key: 'pending', label: '待定', sortValue: Infinity };
                }

                const taskDate = new Date(timeStr);
                if (isNaN(taskDate.getTime())) {
                    return { key: 'pending', label: '待定', sortValue: Infinity };
                }

                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const target = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

                const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

                if (diffDays < 0) return { key: 'overdue', label: '已过期', sortValue: diffDays };
                if (diffDays === 0) return { key: 'today', label: '今天', sortValue: 0 };
                if (diffDays === 1) return { key: 'tomorrow', label: '明天', sortValue: 1 };
                if (diffDays === 2) return { key: 'after_tomorrow', label: '后天', sortValue: 2 };

                return { key: `days_${diffDays}`, label: `余${diffDays}天`, sortValue: diffDays };
            };

            // 按时间分组
            const timeGroups = new Map();
            normalRoots.forEach(task => {
                const groupInfo = getTimeGroup(task);
                if (!timeGroups.has(groupInfo.key)) {
                    timeGroups.set(groupInfo.key, { ...groupInfo, items: [] });
                }
                timeGroups.get(groupInfo.key).items.push(task);
            });

            // 按时间顺序渲染分组
            const sortedGroups = [...timeGroups.values()].sort((a, b) => a.sortValue - b.sortValue);

            // 计算时长总和的辅助函数
            const calculateGroupDuration = (items) => {
                const durationFormat = SettingsStore.data.durationFormat || 'hours';
                let totalMinutes = 0;
                
                items.forEach(task => {
                    // 获取任务的时长（可能是数字或字符串）
                    const durationStr = String(task.duration || '').trim();
                    if (!durationStr) return;
                    
                    // 尝试解析时长（支持 "1.5h", "90min", "90", "1.5" 等格式）
                    let minutes = 0;
                    
                    if (durationStr.toLowerCase().endsWith('h')) {
                        // 小时格式，如 "1.5h"
                        const hours = parseFloat(durationStr.toLowerCase().replace('h', ''));
                        if (!isNaN(hours)) minutes = hours * 60;
                    } else if (durationStr.toLowerCase().endsWith('min')) {
                        // 分钟格式，如 "90min"
                        const mins = parseFloat(durationStr.toLowerCase().replace('min', ''));
                        if (!isNaN(mins)) minutes = mins;
                    } else {
                        // 纯数字，可能是小时或分钟
                        const num = parseFloat(durationStr);
                        if (!isNaN(num)) {
                            // 如果数字大于100，认为是分钟，否则是小时
                            minutes = num > 100 ? num : num * 60;
                        }
                    }
                    
                    totalMinutes += minutes;
                });
                
                // 如果总时长为0，返回空字符串（不显示）
                if (totalMinutes <= 0) return '';
                
                // 根据设置格式化输出
                if (durationFormat === 'hours') {
                    const hours = totalMinutes / 60;
                    // 如果小于1小时，显示分钟；如果大于等于1小时，显示小时
                    if (hours < 1) {
                        return `${Math.round(totalMinutes)}min`;
                    } else if (hours === Math.floor(hours)) {
                        return `${Math.round(hours)}h`;
                    } else {
                        return `${hours.toFixed(1)}h`;
                    }
                } else {
                    return `${totalMinutes}min`;
                }
            };

            sortedGroups.forEach(group => {
                const isCollapsed = state.collapsedGroups?.has(group.key);
                const toggle = `<span class="tm-group-toggle" onclick="tmToggleGroupCollapse('${group.key}', event)" style="cursor:pointer;margin-right:8px;display:inline-block;width:12px;">${isCollapsed ? '▸' : '▾'}</span>`;
                const labelColor = __tmGetTimeGroupLabelColor(group);
                
                // 计算该分组下所有任务的时长总和
                const durationSum = calculateGroupDuration(group.items);
                
                allRows.push(`<tr class="tm-group-row"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${group.key}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);border-bottom:1px solid var(--tm-table-border-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">${esc(group.label)}</span> <span style="font-weight:normal;color:var(--tm-secondary-text);font-size:12px;background:var(--tm-doc-count-bg);padding:1px 6px;border-radius:10px;margin-left:4px;">${group.items.length}</span>${durationSum ? `<span style="font-weight:normal;color:var(--tm-primary-color);font-size:12px;background:var(--tm-info-bg);padding:1px 6px;border-radius:10px;margin-left:4px;border:1px solid var(--tm-info-border);">📊 ${durationSum}</span>` : ''}</div></td></tr>`);

                if (!isCollapsed) {
                    // 组内任务按照全局顺序排列
                    group.items.sort((a, b) => getTaskOrder(a.id) - getTaskOrder(b.id));
                    group.items.forEach(task => {
                        allRows.push(...renderTaskTree(task, 0));
                    });
                }
            });
        } else {
            // 普通全局混排（不按时间分组，不按文档分组）
            normalRoots.forEach(task => {
                allRows.push(...renderTaskTree(task, 0));
            });
        }

        if (allRows.length === 0) {
            return `<tr><td colspan="${colCount}" style="text-align: center; padding: 40px; color: var(--tm-secondary-text);">暂无任务</td></tr>`;
        }

        return allRows.join('');
    }

    // 切换任务状态
    window.tmToggle = async function(id) {
        const task = state.flatTasks[id];
        if (!task) return;

        await window.tmSetDone(id, !task.done);
    };

    function __tmUpdateDoneMarkdown(markdown, done) {
        const md = String(markdown || '');
        const replaced = md.replace(/^(\s*[\*\-]\s*)\[(?:\s|x|X)\]/, `$1[${done ? 'x' : ' '}]`);
        if (replaced === md) {
            const alt = md.replace(/^(\s*[\*\-]\s*)\[[xX ]\]\s*/, `$1[${done ? 'x' : ' '}] `);
            return alt;
        }
        return replaced;
    }

    let __tmRenderScheduled = false;
    function __tmScheduleRender() {
        if (__tmRenderScheduled) return;
        __tmRenderScheduled = true;
        requestAnimationFrame(() => {
            __tmRenderScheduled = false;
            applyFilters();
            render();
        });
    }

    // ========== 全局操作锁 ==========

    const GlobalLock = {
        locked: false,
        timer: null,

        lock() {
            this.locked = true;
            this.updateUI();

            // 清除之前的定时器
            if (this.timer) clearTimeout(this.timer);
            this.timer = null;

            // 不再使用自动解锁，而是等待 render() 完成后手动解锁
        },

        unlock() {
            this.locked = false;
            this.timer = null;
            this.updateUI();
        },

        updateUI() {
            // 更新所有复选框的禁用状态
            const checkboxes = document.querySelectorAll('.tm-task-checkbox');
            checkboxes.forEach(cb => {
                cb.disabled = this.locked;
                if (this.locked) {
                    cb.classList.add('tm-operating');
                } else {
                    cb.classList.remove('tm-operating');
                }
            });
        },

        isLocked() {
            return this.locked;
        }
    };

    // ============ 树形状态保护器（解决父子任务属性丢失） ============
    const TreeProtector = {
        // 操作前保存完整树状态：内容 -> {id, parentId, data, collapsed}
        snapshot: new Map(),
        idMapping: new Map(), // oldId -> newId
        collapsedState: new Map(), // oldId -> boolean

        // 递归保存树
        saveTree(tasks, parentId = null, level = 0) {
            tasks.forEach(task => {
                // 保存关键信息，以内容为key（因为ID会变，内容相对稳定）
                const key = `${level}:${parentId || 'root'}:${task.content}`;
                this.snapshot.set(key, {
                    oldId: task.id,
                    parentId: parentId,
                    level: level,
                    data: {
                        priority: task.priority || '',
                        duration: task.duration || '',
                        remark: task.remark || '',
                        completionTime: task.completionTime || '',
                        customTime: task.customTime || '',
                        customStatus: task.customStatus || ''
                    },
                    done: task.done
                });

                // 保存折叠状态
                this.collapsedState.set(task.id, state.collapsedTaskIds.has(task.id));

                // 递归保存子任务
                if (task.children && task.children.length > 0) {
                    this.saveTree(task.children, task.id, level + 1);
                }
            });
        },

        // 操作后恢复树属性
        restoreTree(tasks, parentId = null, level = 0) {
            tasks.forEach(task => {
                // 构建查找key
                const key = `${level}:${parentId || 'root'}:${task.content}`;
                const saved = this.snapshot.get(key);

                if (saved) {
                    // 建立ID映射
                    this.idMapping.set(saved.oldId, task.id);

                    // 恢复属性（优先使用保存的，除非新任务已有值）
                    if (!task.priority && saved.data.priority) task.priority = saved.data.priority;
                    if (!task.duration && saved.data.duration) task.duration = saved.data.duration;
                    if (!task.remark && saved.data.remark) task.remark = saved.data.remark;
                    if (!task.completionTime && saved.data.completionTime) task.completionTime = saved.data.completionTime;
                    if (!task.customTime && saved.data.customTime) task.customTime = saved.data.customTime;
                    if (!task.customStatus && saved.data.customStatus) task.customStatus = saved.data.customStatus;

                    // 恢复MetaStore映射
                    if (saved.oldId !== task.id) {
                        MetaStore.remapId(saved.oldId, task.id);
                    }
                }

                // 递归恢复子任务
                if (task.children && task.children.length > 0) {
                    this.restoreTree(task.children, task.id, level + 1);
                }
            });
        },

        // 恢复折叠状态（基于ID映射）
        restoreCollapsedState() {
            const newCollapsed = new Set();
            for (const [oldId, wasCollapsed] of this.collapsedState.entries()) {
                if (wasCollapsed) {
                    // 查找新ID
                    const newId = this.idMapping.get(oldId);
                    if (newId) {
                        newCollapsed.add(newId);
                    }
                }
            }
            state.collapsedTaskIds = newCollapsed;
            SettingsStore.data.collapsedTaskIds = [...newCollapsed];
            SettingsStore.save();
        },

        clear() {
            this.snapshot.clear();
            this.idMapping.clear();
            this.collapsedState.clear();
        }
    };

    // 保存任务完整状态到 MetaStore
    function saveTaskFullState(task) {
        if (!task?.id) return;

        const stateData = {
            priority: task.priority || '',
            duration: task.duration || '',
            remark: task.remark || '',
            completionTime: task.completionTime || '',
            customTime: task.customTime || '',
            content: task.content || '',
            done: task.done,
            parentTaskId: task.parentTaskId || null,
            timestamp: Date.now()
        };

        MetaStore.set(task.id, stateData);
    }

    // 从 MetaStore 恢复任务状态
    function restoreTaskFromMeta(task) {
        if (!task?.id) return task;

        const saved = MetaStore.get(task.id);
        if (!saved) return task;

        // 只有当当前值为空时才恢复（避免覆盖新输入）
        if (!task.priority && saved.priority) task.priority = saved.priority;
        if (!task.duration && saved.duration) task.duration = saved.duration;
        if (!task.remark && saved.remark) task.remark = saved.remark;
        if (!task.completionTime && saved.completionTime) task.completionTime = saved.completionTime;
        if (!task.customTime && saved.customTime) task.customTime = saved.customTime;

        return task;
    }

    // 更新 markdown 中的完成状态
    function updateDoneInMarkdown(markdown, done) {
        if (!markdown) return '- [ ] ';
        // 匹配列表项开头
        return markdown.replace(/^(\s*[\*\-]\s*)\[[ xX]\]/, `$1[${done ? 'x' : ' '}]`);
    }

    // ========== 原有完成状态处理 ==========

    const __tmDoneDesired = new Map();
    const __tmDoneBase = new Map();
    const __tmDoneChain = new Map();

    function __tmRemapTaskId(oldId, newId) {
        try {
            if (!oldId || !newId || oldId === newId) return;
            const task = state.flatTasks[oldId];
            if (!task) return;
            delete state.flatTasks[oldId];
            task.id = newId;
            state.flatTasks[newId] = task;
            try { MetaStore.remapId(oldId, newId); } catch (e) {}
            
            const updateRecursive = (list) => {
                list.forEach(t => {
                    if (t.id === oldId) t.id = newId;
                    if (t.children && t.children.length > 0) updateRecursive(t.children);
                });
            };

            state.taskTree.forEach(doc => {
                updateRecursive(doc.tasks);
            });
            if (__tmDoneDesired.has(oldId)) {
                __tmDoneDesired.set(newId, __tmDoneDesired.get(oldId));
                __tmDoneDesired.delete(oldId);
            }
            if (__tmDoneBase.has(oldId)) {
                __tmDoneBase.set(newId, __tmDoneBase.get(oldId));
                __tmDoneBase.delete(oldId);
            }
            if (__tmDoneChain.has(oldId)) {
                __tmDoneChain.set(newId, __tmDoneChain.get(oldId));
                __tmDoneChain.delete(oldId);
            }
        } catch (e) {}
    }

    async function __tmUpdateDoneRemote(id) {
        const task = state.flatTasks[id];
        if (!task) return;
        const desired = __tmDoneDesired.get(id);
        if (typeof desired !== 'boolean') return;

        const base = __tmDoneBase.get(id) ?? task.markdown;
        const md = __tmUpdateDoneMarkdown(base, desired);
        if (md === base) return;

        const attempt = async () => {
            let effectiveId = id;
            const upd = await API.updateBlock(effectiveId, md);
            const updatedId = upd?.id || effectiveId;
            if (updatedId && updatedId !== effectiveId) {
                __tmRemapTaskId(effectiveId, updatedId);
                effectiveId = updatedId;
            }
            __tmDoneBase.set(effectiveId, md);
            task.markdown = md;
            task.done = desired;
        };

        try {
            await attempt();
        } catch (e) {
            await new Promise(r => setTimeout(r, 120));
            await attempt();
        }
    }

    // ============ 重写设置完成状态（带完整树保护） ============
    window.tmSetPinned = async function(id, pinned, ev) {
        if (ev) ev.stopPropagation();

        const task = state.flatTasks[id];
        if (!task) return;

        const val = !!pinned;
        try {
            // Update state
            task.pinned = val;
            
            // Update MetaStore (fast cache)
            __tmPersistMetaAndAttrs(id, { pinned: val });

            applyFilters();
            render();
            hint(`✅ ${val ? '已置顶' : '已取消置顶'}`, 'success');
        } catch (e) {
            hint(`❌ 操作失败: ${e.message}`, 'error');
            if (ev?.target) ev.target.checked = !val;
        }
    };

    window.tmSetDone = async function(id, done, ev) {
        if (ev) {
            ev.stopPropagation();
            ev.preventDefault();
        }

        const task = state.flatTasks[id];
        if (!task) {
            hint('❌ 任务不存在', 'error');
            if (ev?.target) ev.target.checked = !done;
            return;
        }

        const targetDone = !!done;

        // 检查全局锁
        if (GlobalLock.isLocked()) {
            hint('⚠ 操作频繁，请等待10ms后再试', 'warning');
            if (ev?.target) ev.target.checked = !targetDone;
            return;
        }

        if (task.done === targetDone) return;

        // 锁定
        GlobalLock.lock();
        const docId = task.root_id;

        // 关键：保存整个文档树的完整状态（包括所有子任务）
        const doc = state.taskTree.find(d => d.id === docId);
        if (doc) {
            TreeProtector.clear();
            TreeProtector.saveTree(doc.tasks);
        }

        // 关键修改：先保存原始状态，然后保存到 MetaStore（保持原始状态，等点击完成后再更新）
        const originalMarkdown = task.markdown;
        const originalDone = task.done;

        // 立即保存当前任务到 MetaStore（保持原始done状态）
        MetaStore.set(id, {
            priority: task.priority || '',
            duration: task.duration || '',
            remark: task.remark || '',
            completionTime: task.completionTime || '',
            customTime: task.customTime || '',
            done: originalDone,
            content: task.content
        });

        // 关键：同时保存整个文档树的所有任务的属性到 MetaStore
        // 这样即使思源重新解析列表块，MetaStore 中有完整备份
        let savedCount = 1;
        const saveAllTasksToMetaRecursive = (tasks) => {
            tasks.forEach(t => {
                savedCount++;
                MetaStore.set(t.id, {
                    priority: t.priority || '',
                    duration: t.duration || '',
                    remark: t.remark || '',
                    completionTime: t.completionTime || '',
                    customTime: t.customTime || '',
                    done: t.done,
                    content: t.content
                });
                if (t.children && t.children.length > 0) {
                    saveAllTasksToMetaRecursive(t.children);
                }
            });
        };
        // 从已经获取的 doc 中获取所有任务并保存
        if (doc && doc.tasks) {
            saveAllTasksToMetaRecursive(doc.tasks);
        }

        // 注意：不要在这里 render()，因为还没点击复选框
        // render() 会在从DOM读取实际状态后调用

        try {
            // 优先尝试 API 更新（解决文档未打开无法操作的问题）
            let apiSuccess = false;
            let clickSuccess = false;
            try {
                // 1. 获取 kramdown
                const kramdown = await API.getBlockKramdown(id);

                if (kramdown) {
                    // 2. 正则匹配：匹配行首的任务标记，容忍前面的空白
                    // 匹配：(任意空白)(*或-或数字.)(任意空白)[(空格或xX)](右括号)
                    const statusRegex = /^(\s*(?:[\*\-]|\d+\.)\s*\[)([ xX])(\])/;
                    const match = kramdown.match(statusRegex);
                    
                    if (match) {
                        const currentStatusChar = match[2];
                        const isCurrentlyDone = currentStatusChar !== ' ';

                        if (isCurrentlyDone === targetDone) {
                            apiSuccess = true;
                        } else {
                            // 3. 构造新的 kramdown
                            const newStatusChar = targetDone ? 'x' : ' ';
                            const newKramdown = kramdown.replace(statusRegex, `$1${newStatusChar}$3`);
                            // 4. 调用 updateBlock
                            const res = await API.call('/api/block/updateBlock', {
                                dataType: 'markdown',
                                data: newKramdown,
                                id: id
                            });
                            
                            if (res && res.code === 0) {
                                apiSuccess = true;
                            } else {
                                console.error('[完成状态] API更新失败:', res);
                            }
                        }
                    } else {
                        // Fallback: 尝试查找内容中的第一个复选框标记（即使不在行首）
                        const fallbackRegex = /(\[)([ xX])(\])/;
                        const fallbackMatch = kramdown.match(fallbackRegex);
                        if (fallbackMatch) {
                             const newStatusChar = targetDone ? 'x' : ' ';
                             // 只替换第一个匹配项
                             const newKramdown = kramdown.replace(fallbackRegex, `$1${newStatusChar}$3`);
                             
                             const res = await API.call('/api/block/updateBlock', {
                                dataType: 'markdown',
                                data: newKramdown,
                                id: id
                            });
                            if (res && res.code === 0) {
                                apiSuccess = true;
                            }
                        } else {
                            console.error('[完成状态] 无法在kramdown中找到任务标记');
                        }
                    }
                } else {
                    console.error('[完成状态] 未获取到kramdown内容');
                }
            } catch (e) {
                console.error('[完成状态] API处理异常:', e);
            }

            // 只有当 API 失败时才尝试查找 DOM（作为回退）
            let taskElement = null;
            if (!apiSuccess) {
                // 尝试多种方式找到复选框并点击
                // 方式1：通过 task.id 直接查询列表项
                taskElement = document.querySelector(`[data-type="NodeListItem"][data-node-id="${id}"]`);
                
                // 方式2：遍历所有任务列表项，通过内容匹配
                if (!taskElement) {
                    const allItems = document.querySelectorAll('[data-type="NodeListItem"]');
                    for (const item of allItems) {
                        const paragraph = item.querySelector('[data-type="NodeParagraph"] > div[contenteditable="true"]');
                        if (paragraph && paragraph.textContent?.trim() === task.content) {
                            taskElement = item;
                            break;
                        }
                    }
                }

                // 方式3：遍历所有 protyle-wysiwyg 下的列表项
                if (!taskElement) {
                    const allItems = document.querySelectorAll('.protyle-wysiwyg [data-type="NodeListItem"]');
                    for (const item of allItems) {
                        const paragraph = item.querySelector('[data-type="NodeParagraph"] > div[contenteditable="true"]');
                        if (paragraph && paragraph.textContent?.trim() === task.content) {
                            taskElement = item;
                            break;
                        }
                    }
                }
            }

            if (taskElement) {
                // 找到 protyle-action--task 元素并触发点击
                const actionElement = taskElement.querySelector('.protyle-action--task');
                if (actionElement) {
                    // 使用多种事件触发方式
                    const mouseEvents = ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'];
                    for (const eventType of mouseEvents) {
                        const event = new MouseEvent(eventType, {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            button: 0
                        });
                        actionElement.dispatchEvent(event);
                    }
                    // 也尝试在列表项元素上触发点击
                    const parentEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    taskElement.dispatchEvent(parentEvent);

                    // 关键修复：直接点击真正的 checkbox input 元素并触发 change 事件
                    const checkboxInput = taskElement.querySelector('input[type="checkbox"]');
                    if (checkboxInput) {
                        // 直接修改 checkbox 状态
                        checkboxInput.checked = targetDone;
                        // 触发 change 事件
                        const changeEvent = new Event('change', {
                            bubbles: true,
                            cancelable: true
                        });
                        checkboxInput.dispatchEvent(changeEvent);
                    }

                    clickSuccess = true;
                }
            }

            // 等待思源处理完成
            await new Promise(r => setTimeout(r, 150));

            // 直接使用 targetDone 作为实际状态
            // 因为我们已经模拟点击了思源的复选框，思源会正确处理状态变化
            const actualDone = targetDone;

            // 保存到MetaStore
            MetaStore.set(id, {
                priority: task.priority || '',
                duration: task.duration || '',
                remark: task.remark || '',
                completionTime: task.completionTime || '',
                customTime: task.customTime || '',
                customStatus: task.customStatus || '',
                done: actualDone,
                content: task.content
            });

            // 更新本地状态
            task.done = actualDone;
            state.flatTasks[id] = task;

            // 递归更新所有子任务的done状态（如果需要）
            const updateChildrenDone = (tasks) => {
                tasks.forEach(t => {
                    t.done = t.done; // 保持不变
                    if (t.children && t.children.length > 0) {
                        updateChildrenDone(t.children);
                    }
                });
            };
            if (task.children && task.children.length > 0) {
                updateChildrenDone(task.children);
            }

            recalcStats();
            // 延迟 render() 确保思源原生处理完成
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    render();
                });
            });

            hint(actualDone ? '✅ 任务已完成' : '✅ 已取消完成', 'success');

        } catch (err) {
            console.error('[完成操作失败]', err);

            // 恢复
            task.markdown = originalMarkdown;
            task.done = !targetDone;

            // 尝试恢复树状态
            if (doc) {
                TreeProtector.restoreTree(doc.tasks);
            }

            recalcStats();
            render();
            hint(`❌ 操作失败: ${err.message}`, 'error');
        } finally {
            // render() 完成后手动解锁
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    GlobalLock.unlock();
                });
            });
        }
    };

    // 保存所有任务到MetaStore（递归）
    async function saveAllTasksToMeta(docId) {
        const doc = state.taskTree.find(d => d.id === docId);
        if (!doc) return;

        const saveRecursive = (tasks) => {
            tasks.forEach(task => {
                MetaStore.set(task.id, {
                    priority: task.priority || '',
                    duration: task.duration || '',
                    remark: task.remark || '',
                    completionTime: task.completionTime || '',
                    customTime: task.customTime || '',
                    customStatus: task.customStatus || '',
                    done: task.done,
                    content: task.content
                });
                if (task.children && task.children.length > 0) {
                    saveRecursive(task.children);
                }
            });
        };

        saveRecursive(doc.tasks);
        await MetaStore.saveNow();
    }

    // 通过内容在任务树中查找任务（使用更灵活的匹配）
    function findTaskByContent(tasks, content, depth = 0) {
        for (const t of tasks) {
            // 使用模糊匹配：检查内容是否包含或被包含
            const oldContent = String(t.content || '').trim();
            const newContent = String(content || '').trim();
            // 精确匹配或新内容包含旧内容（旧内容更短）
            if (oldContent === newContent || (newContent.length > oldContent.length && newContent.includes(oldContent))) {
                return t;
            }
            if (t.children && t.children.length > 0) {
                const found = findTaskByContent(t.children, content, depth + 1);
                if (found) return found;
            }
        }
        return null;
    }

    // ============ 受保护的重载（带树恢复） ============
    // manualRelationships: 可选，Map<childId, parentTaskId>，用于在SQL索引未更新时强制指定父子关系
    // injectedTasks: 可选，Array<Task>，用于在SQL索引未更新时强制注入新任务（乐观更新）
    async function reloadDocTasksProtected(docId, expectId = null, manualRelationships = null, injectedTasks = null) {
        // 0. 备份旧的父子关系（用于容灾，当SQL索引失效时恢复现有结构）
        const oldRelationships = new Map(); // Map<childId, {parentId: string, listId: string}>
        const backupRelationships = (tasks) => {
            tasks.forEach(t => {
                if (t.parentTaskId) {
                    oldRelationships.set(t.id, {
                        parentId: t.parentTaskId,
                        listId: t.parent_id // 列表块ID，用于校验是否移动了位置
                    });
                }
                if (t.children && t.children.length > 0) {
                    backupRelationships(t.children);
                }
            });
        };
        const currentDoc = state.taskTree.find(d => d.id === docId);
        if (currentDoc && currentDoc.tasks) {
            backupRelationships(currentDoc.tasks);
        }

        // 1. 重新加载数据 (带重试机制，等待索引更新)
        let flatTasks = [];
        let queryTime = 0;

        if (expectId) {
            let retries = 0;
            const maxRetries = 20; // 最多等待 5秒 (250ms * 20)
            while (retries < maxRetries) {
                const res = await API.getTasksByDocuments([docId], state.queryLimit);
                
                // 检查是否包含期望的ID
                if (res.tasks && res.tasks.find(t => t.id === expectId)) {
                    flatTasks = res.tasks;
                    queryTime = res.queryTime;
                    break;
                }
                
                // 如果是最后一次重试，仍然使用当前结果
                if (retries === maxRetries - 1) {
                    flatTasks = res.tasks || [];
                    queryTime = res.queryTime || 0;
                    break;
                }
                
                // 如果没找到，等待后重试
                await new Promise(r => setTimeout(r, 250));
                retries++;
            }
        } else {
             const res = await API.getTasksByDocuments([docId], state.queryLimit);
             flatTasks = res.tasks || [];
             queryTime = res.queryTime || 0;
        }

        // 1.5 注入强制任务（乐观更新）
        if (injectedTasks && injectedTasks.length > 0) {
            injectedTasks.forEach(injected => {
                if (!flatTasks.find(t => t.id === injected.id)) {
                    flatTasks.push(injected);
                }
            });
        }

        // 2. 关键：先建立内容到 MetaStore 数据的映射
        // 因为思源操作后子任务ID可能改变，需要用内容匹配来找回旧ID的MetaStore数据
        const contentToMeta = new Map();

        // 遍历旧的任务树（如果有的话），建立内容到MetaStore的映射
        const oldDoc = state.taskTree.find(d => d.id === docId);
        if (oldDoc && oldDoc.tasks) {
            const traverseOld = (tasks) => {
                tasks.forEach(t => {
                    const key = (t.content || '').trim();
                    if (key) {
                        const meta = MetaStore.get(t.id);
                        if (meta && Object.keys(meta).length > 0) {
                            contentToMeta.set(key, meta);
                        }
                    }
                    if (t.children && t.children.length > 0) {
                        traverseOld(t.children);
                    }
                });
            };
            traverseOld(oldDoc.tasks);
        }

        // 3. 构建树（保持原有逻辑）
        const taskMap = new Map();
        const rootTasks = [];

        // 先创建所有节点（从 MetaStore 读取所有自定义属性，不依赖 SQL 查询）
        flatTasks.forEach(t => {
            const parsed = API.parseTaskStatus(t.markdown);

            // 关键：优先从内容映射读取 MetaStore 数据（因为ID可能已变化）
            const contentKey = (parsed.content || '').trim();
            let meta = MetaStore.get(t.id) || {};

            // 如果当前ID没有MetaStore数据，尝试从内容映射找回
            if (Object.keys(meta).length === 0 && contentKey && contentToMeta.has(contentKey)) {
                const oldMeta = contentToMeta.get(contentKey);
                meta = oldMeta;

                // 同时保存到当前ID下，确保后续能直接读取
                MetaStore.set(t.id, oldMeta);
            }

            taskMap.set(t.id, {
                id: t.id,
                content: parsed.content,
                // 关键：优先使用 MetaStore 中的 done 状态，而不是从 markdown 解析
                done: meta.done !== undefined ? meta.done : parsed.done,
                markdown: t.markdown,
                parent_id: t.parent_id,
                root_id: t.root_id,
                doc_name: t.doc_name,
                children: [],
                priority: (() => {
                    const mv = Object.prototype.hasOwnProperty.call(meta, 'priority') ? String(meta.priority ?? '') : '';
                    if (mv && mv !== 'null') return mv;
                    return String(t.priority ?? '');
                })(),
                duration: Object.prototype.hasOwnProperty.call(meta, 'duration')
                    ? String(meta.duration ?? '')
                    : String(t.duration ?? ''),
                remark: Object.prototype.hasOwnProperty.call(meta, 'remark')
                    ? String(meta.remark ?? '')
                    : String(t.remark ?? ''),
                completionTime: Object.prototype.hasOwnProperty.call(meta, 'completionTime')
                    ? String(meta.completionTime ?? '')
                    : String(t.completion_time ?? ''),
                customTime: Object.prototype.hasOwnProperty.call(meta, 'customTime')
                    ? String(meta.customTime ?? '')
                    : String(t.custom_time ?? ''),
                pinned: (() => {
                    const raw = Object.prototype.hasOwnProperty.call(meta, 'pinned') ? meta.pinned : t.pinned;
                    if (typeof raw === 'boolean') return raw;
                    const s = String(raw || '').trim().toLowerCase();
                    return s === 'true' || s === '1';
                })(),
                customStatus: Object.prototype.hasOwnProperty.call(meta, 'customStatus')
                    ? String(meta.customStatus ?? '')
                    : String(t.custom_status ?? '')
            });
        });

        // 建立父子关系
        flatTasks.forEach(t => {
            const task = taskMap.get(t.id);

            // 0. 最优先：使用手动指定的关系（用于处理刚插入但索引未更新的任务）
            if (manualRelationships && manualRelationships.has(t.id)) {
                const parentId = manualRelationships.get(t.id);
                const parentTask = taskMap.get(parentId);
                if (parentTask) {
                    task.parentTaskId = parentTask.id;
                    parentTask.children.push(task);
                    return;
                }
            }

            // 1. 优先尝试直接从 SQL 结果中获取父任务 ID (API 已经通过 JOIN 查好了)
            if (t.parent_task_id) {
                const parentTask = taskMap.get(t.parent_task_id);
                if (parentTask) {
                    task.parentTaskId = parentTask.id;
                    parentTask.children.push(task);
                    return;
                }
            }

            // 2. 如果 SQL 没有查到 parent_task_id（可能是旧版本 API 或查询失败降级），尝试手动查找
            // 查找父任务（通过parent_id找到父列表的父任务）
            const parentList = taskMap.get(t.parent_id);
            if (parentList && parentList.parent_id) {
                const parentTask = taskMap.get(parentList.parent_id);
                if (parentTask) {
                    task.parentTaskId = parentTask.id;
                    parentTask.children.push(task);
                    return;
                }
            }

            // 3. 最后尝试使用旧数据的父子关系（容灾）
            // 如果任务所在的列表ID(parent_id)没变，说明它没有移动位置，可以安全沿用旧的父子关系
            if (oldRelationships.has(t.id)) {
                const oldRel = oldRelationships.get(t.id);
                if (oldRel.listId === t.parent_id) {
                    const parentTask = taskMap.get(oldRel.parentId);
                    if (parentTask) {
                        task.parentTaskId = parentTask.id;
                        parentTask.children.push(task);
                        return;
                    }
                }
            }

            task.parentTaskId = null;
            rootTasks.push(task);
        });

        // 3. 关键：通过内容匹配恢复旧ID到新ID的映射，并更新MetaStore
        // 因为思源操作后子任务ID可能改变，需要用内容匹配来找回旧ID
        const oldIdToNewId = new Map();
        const newIdToOldId = new Map();

        // 遍历旧的任务树（如果有的话），建立ID映射
        // 注意：oldDoc 已在前面声明，这里直接使用
        if (oldDoc && oldDoc.tasks) {
            const traverseOld = (tasks) => {
                tasks.forEach(t => {
                    if (t.content) {
                        // 在新任务树中找内容相同的任务
                        const newTask = findTaskByContent(rootTasks, t.content);
                        if (newTask && newTask.id !== t.id) {
                            oldIdToNewId.set(t.id, newTask.id);
                            newIdToOldId.set(newTask.id, t.id);

                            // 如果MetaStore中有旧ID的数据，复制到新ID
                            const oldMeta = MetaStore.get(t.id);
                            if (oldMeta) {
                                // 不覆盖新ID已有的数据
                                const newMeta = MetaStore.get(newTask.id) || {};
                                const mergedMeta = { ...oldMeta, ...newMeta };
                                MetaStore.set(newTask.id, mergedMeta);
                            }
                        }
                    }
                    if (t.children && t.children.length > 0) {
                        traverseOld(t.children);
                    }
                });
            };
            traverseOld(oldDoc.tasks);
        }

        TreeProtector.restoreTree(rootTasks);

        // 4. 恢复折叠状态
        TreeProtector.restoreCollapsedState();

        // 5. 更新状态
        const docIndex = state.taskTree.findIndex(d => d.id === docId);
        const docInfo = state.allDocuments.find(d => d.id === docId);

        const newDoc = {
            id: docId,
            name: docInfo?.name || (docIndex >= 0 ? state.taskTree[docIndex].name : '未知文档'),
            tasks: rootTasks
        };

        if (docIndex >= 0) {
            state.taskTree[docIndex] = newDoc;
        } else {
            state.taskTree.push(newDoc);
        }

        // 6. 更新flatTasks
        const flatten = (tasks) => {
            tasks.forEach(t => {
                state.flatTasks[t.id] = t;
                if (t.children && t.children.length > 0) flatten(t.children);
            });
        };

        // 清理旧数据
        Object.keys(state.flatTasks).forEach(key => {
            if (state.flatTasks[key].root_id === docId) delete state.flatTasks[key];
        });
        flatten(rootTasks);

        state.stats.queryTime = queryTime || 0;
        recalcStats();
        applyFilters();

        render();

        // 7. 保存恢复后的数据
        await MetaStore.saveNow();
    }

    window.tmPickPriority = function(id, el, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const task = state.flatTasks[id];
        if (!task) return;
        __tmOpenInlineEditor(el, ({ editor, close }) => {
            editor.style.minWidth = '120px';
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '6px';
            const mk = (value, label, color) => {
                const b = document.createElement('button');
                b.className = 'tm-btn tm-btn-secondary';
                b.style.padding = '4px 8px';
                b.style.fontSize = '12px';
                b.style.textAlign = 'left';
                b.style.background = 'transparent';
                b.style.border = `1px solid ${color}55`;
                b.style.color = color;
                b.textContent = label;
                b.onclick = async () => {
                    try {
                        task.priority = value;
                        __tmPersistMetaAndAttrs(id, { priority: value || '' });
                        close();
                        applyFilters();
                        render();
                    } catch (e) {
                        hint(`❌ 更新失败: ${e.message}`, 'error');
                    }
                };
                return b;
            };
            wrap.appendChild(mk('', '无', '#9e9e9e'));
            wrap.appendChild(mk('high', '高', '#ea4335'));
            wrap.appendChild(mk('medium', '中', '#f9ab00'));
            wrap.appendChild(mk('low', '低', '#4285f4'));
            editor.appendChild(wrap);
        });
    };

    window.tmOpenStatusSelect = function(id, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const el = ev.target.closest('td');
        const task = state.flatTasks[id];
        if (!task || !el) return;

        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const options = SettingsStore.data.customStatusOptions || [];
            const maxLen = options.reduce((m, o) => Math.max(m, String(o?.name || '').length), 0);
            const w = Math.min(260, Math.max(110, maxLen * 14 + 38));
            editor.style.minWidth = '0';
            editor.style.width = `${w}px`;
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';
            options.forEach(opt => {
                const b = document.createElement('button');
                b.className = 'tm-btn';
                b.style.padding = '4px 8px';
                b.style.fontSize = '12px';
                b.style.textAlign = 'left';
                b.style.backgroundColor = opt.color;
                b.style.color = '#fff';
                b.style.border = 'none';
                b.textContent = opt.name;
                b.onclick = async () => {
                    try {
                        task.customStatus = opt.id;
                        __tmPersistMetaAndAttrs(id, { customStatus: opt.id });
                        close();
                        applyFilters();
                        render();
                    } catch (e) {
                        hint(`❌ 更新失败: ${e.message}`, 'error');
                    }
                };
                wrap.appendChild(b);
            });
            
            editor.appendChild(wrap);
        });
    };

    // 辅助：手动插入任务到树中（支持位置控制）
    // position: 'before' | 'after' | 'child'
    // Removed manualInsertTaskToTree

    // Removed pollTaskInfo

    // Removed tmInsertSiblingAbove

    // Removed tmInsertSiblingBelow

    // Removed tmInsertChildTask

    // 编辑任务
    window.tmEdit = async function(id) {
        const task = state.flatTasks[id];
        if (!task) return;

        const newContent = await showPrompt('编辑任务', '请输入新任务内容', task.content);
        if (newContent === null || newContent === task.content) return;

        const prefix = task.markdown.match(/^(\s*[\*\-]\s*\[x?\])\s*/i)?.[1] || '- ';
        const newMarkdown = prefix + newContent;

        try {
            await API.updateBlock(id, newMarkdown);
            task.content = newContent;
            task.markdown = newMarkdown;
            applyFilters();
            render();
            hint('✅ 任务已更新', 'success');
        } catch (e) {
            hint(`❌ 更新失败: ${e.message}`, 'error');
        }
    };

    // 删除任务
    window.tmDelete = async function(id) {
        if (!confirm('确定要删除这个任务吗？此操作不可恢复。')) return;

        try {
            await API.deleteBlock(id);

            // 从本地数据中移除
            delete state.flatTasks[id];
            
            // 递归移除任务树中的任务
            const removeRecursive = (list) => {
                const idx = list.findIndex(t => t.id === id);
                if (idx !== -1) {
                    list.splice(idx, 1);
                    return true;
                }
                for (const t of list) {
                    if (t.children && removeRecursive(t.children)) return true;
                }
                return false;
            };

            state.taskTree.forEach(doc => {
                removeRecursive(doc.tasks);
            });

            recalcStats();
            applyFilters();
            render();
            hint('✅ 任务已删除', 'success');
        } catch (e) {
            hint(`❌ 删除失败: ${e.message}`, 'error');
        }
    };

    // 任务提醒
    window.tmReminder = async function(id) {
        if (!SettingsStore.data.enableTomatoIntegration) {
            hint('⚠ 番茄钟联动已关闭', 'warning');
            return;
        }
        const task = state.flatTasks[id];
        if (!task) return;
        const showDialog = globalThis.__tomatoReminder?.showDialog;
        if (typeof showDialog === 'function') {
            showDialog(id, task.content || '任务');
            return;
        }
        hint('⚠ 未检测到提醒功能，请确认番茄插件已启用', 'warning');
    };

    window.tmStartPomodoro = async function(id) {
        if (!SettingsStore.data.enableTomatoIntegration) {
            hint('⚠ 番茄钟联动已关闭', 'warning');
            return;
        }
        const task = state.flatTasks[id];
        if (!task) return;
        const timer = globalThis.__tomatoTimer;
        const startCountdown = timer?.startCountdown;
        const startPomodoro = timer?.startPomodoro;
        if (typeof startCountdown === 'function') {
            startCountdown(id, task.content || '任务', 30);
            return;
        }
        if (typeof startPomodoro === 'function') {
            startPomodoro(id, task.content || '任务', 30);
            return;
        }
        hint('⚠ 未检测到番茄计时功能，请确认番茄插件已启用', 'warning');
    };

    // 任务右键菜单
    window.tmShowTaskContextMenu = function(event, taskId) {
        event.preventDefault();
        event.stopPropagation();

        // Close any existing context menu
        const existingMenu = document.getElementById('tm-task-context-menu');
        if (existingMenu) existingMenu.remove();
        if (state.taskContextMenuCloseHandler) {
            try { document.removeEventListener('click', state.taskContextMenuCloseHandler); } catch (e) {}
            try { document.removeEventListener('contextmenu', state.taskContextMenuCloseHandler); } catch (e) {}
            state.taskContextMenuCloseHandler = null;
        }

        const menu = document.createElement('div');
        menu.id = 'tm-task-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            background: var(--b3-theme-background);
            border: 1px solid var(--b3-theme-surface-light);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            padding: 4px 0;
            z-index: 200000;
            min-width: 140px;
            user-select: none;
        `;

        const createItem = (label, onClick, isDanger) => {
            const item = document.createElement('div');
            item.textContent = label;
            item.style.cssText = `
                padding: 6px 12px;
                cursor: pointer;
                font-size: 13px;
                color: ${isDanger ? 'var(--b3-theme-error)' : 'var(--b3-theme-on-background)'};
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            item.onmouseenter = () => item.style.backgroundColor = 'var(--b3-theme-surface-light)';
            item.onmouseleave = () => item.style.backgroundColor = 'transparent';
            item.onclick = (e) => {
                e.stopPropagation();
                menu.remove();
                onClick();
            };
            return item;
        };

        const task = state.flatTasks[taskId];
        const taskName = task?.content || '任务';
        const tomatoEnabled = !!SettingsStore.data.enableTomatoIntegration;
        const timer = tomatoEnabled ? globalThis.__tomatoTimer : null;
        if (tomatoEnabled && timer && typeof timer === 'object') {
            const durations = (() => {
                const list = timer?.getDurations?.();
                const arr = Array.isArray(list) ? list.map(n => parseInt(n, 10)).filter(n => Number.isFinite(n) && n > 0) : [];
                return arr.length > 0 ? arr.slice(0, 8) : [5, 15, 25, 30, 45, 60];
            })();

            const timerWrap = document.createElement('div');
            timerWrap.style.cssText = 'padding: 6px 10px 8px;';
            const title = document.createElement('div');
            title.textContent = '🍅 计时';
            title.style.cssText = 'font-size: 12px; opacity: 0.75; padding: 2px 0 6px;';
            timerWrap.appendChild(title);
            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
            durations.forEach(min => {
                const b = document.createElement('button');
                b.className = 'tm-btn tm-btn-secondary';
                b.textContent = `${min}m`;
                b.style.cssText = 'padding: 2px 8px; font-size: 12px; line-height: 18px;';
                b.onclick = (e) => {
                    e.stopPropagation();
                    state.timerFocusTaskId = taskId;
                    render();
                    const startFromTaskBlock = timer?.startFromTaskBlock;
                    const startCountdown = timer?.startCountdown;
                    const p = (typeof startFromTaskBlock === 'function')
                        ? startFromTaskBlock(taskId, taskName, min, 'countdown')
                        : (typeof startCountdown === 'function' ? startCountdown(taskId, taskName, min) : null);
                    if (p && typeof p.finally === 'function') {
                        p.finally(() => setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150));
                    }
                    else tmStartPomodoro(taskId);
                    menu.remove();
                };
                btnRow.appendChild(b);
            });
            const sw = document.createElement('button');
            sw.className = 'tm-btn tm-btn-secondary';
            sw.textContent = '⏱️ 正计时';
            sw.style.cssText = 'padding: 2px 8px; font-size: 12px; line-height: 18px;';
            sw.onclick = (e) => {
                e.stopPropagation();
                state.timerFocusTaskId = taskId;
                render();
                const startFromTaskBlock = timer?.startFromTaskBlock;
                const startStopwatch = timer?.startStopwatch;
                const p = (typeof startFromTaskBlock === 'function')
                    ? startFromTaskBlock(taskId, taskName, 0, 'stopwatch')
                    : (typeof startStopwatch === 'function' ? startStopwatch(taskId, taskName) : null);
                if (p && typeof p.finally === 'function') {
                    p.finally(() => setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150));
                }
                else hint('⚠ 未检测到正计时功能，请确认番茄插件已启用', 'warning');
                menu.remove();
            };
            btnRow.appendChild(sw);
            timerWrap.appendChild(btnRow);
            menu.appendChild(timerWrap);

            const hrTimer = document.createElement('hr');
            hrTimer.style.cssText = 'margin: 4px 0; border: none; border-top: 1px solid var(--b3-theme-surface-light);';
            menu.appendChild(hrTimer);

            if (state.timerFocusTaskId) {
                menu.appendChild(createItem('👁️ 取消聚焦', () => {
                    state.timerFocusTaskId = '';
                    render();
                }));
            }
        }

        menu.appendChild(createItem('✏️ 编辑', () => tmEdit(taskId)));
        if (tomatoEnabled) {
            menu.appendChild(createItem('⏰ 提醒', () => tmReminder(taskId)));
        }
        menu.appendChild(createItem('🗑️ 删除', () => tmDelete(taskId), true));

        document.body.appendChild(menu);

        // Click outside to close
        const closeHandler = () => {
            menu.remove();
            try { document.removeEventListener('click', closeHandler); } catch (e) {}
            try { document.removeEventListener('contextmenu', closeHandler); } catch (e) {}
            if (state.taskContextMenuCloseHandler === closeHandler) state.taskContextMenuCloseHandler = null;
        };
        state.taskContextMenuCloseHandler = closeHandler;
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
            document.addEventListener('contextmenu', closeHandler);
        }, 0);
    };

    function __tmResolveDefaultDocId() {
        if (state.activeDocId && state.activeDocId !== 'all') return state.activeDocId;
        if (state.taskTree && state.taskTree.length > 0) return state.taskTree[0].id;
        if (state.selectedDocIds && state.selectedDocIds.length > 0) return state.selectedDocIds[0];
        return null;
    }

    function __tmResolveQuickAddDocId() {
        const configured = String(SettingsStore.data.newTaskDocId || '').trim();
        if (configured) {
            const exists = state.taskTree.some(d => d.id === configured) || state.allDocuments.some(d => d.id === configured);
            if (exists) return configured;
        }
        return __tmResolveDefaultDocId();
    }

    async function __tmCreateTaskInDoc({ docId, content, priority, completionTime, pinned, customStatus } = {}) {
        const parentDocId = String(docId || '').trim();
        const text = String(content || '').trim();
        if (!parentDocId) throw new Error('未设置文档');
        if (!text) throw new Error('请输入任务内容');
        const md = '- [ ] ' + text;

        const insertedId = await API.insertBlock(parentDocId, md);
        let taskId = insertedId;
        try {
            const rows = await API.getBlocksByIds([insertedId]);
            const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            const t = String(row?.type || '').trim();
            const st = String(row?.subtype || '').trim();
            if (!(t === 'i' && st === 't')) {
                // 尝试多次获取子任务ID，应对索引延迟
                // 优化：使用短间隔高频重试，减少用户等待时间
                let childTaskId = null;
                for (let i = 0; i < 30; i++) {
                    childTaskId = await API.getFirstTaskIdUnderBlock(insertedId);
                    if (childTaskId) break;
                    await new Promise(r => setTimeout(r, 50));
                }

                if (childTaskId) taskId = childTaskId;
                else {
                    const deepTaskId = await API.getFirstTaskDescendantId(insertedId, 8);
                    if (deepTaskId) taskId = deepTaskId;
                }
            }
        } catch (e) {}

        const patch = {};
        const pin = pinned !== undefined ? !!pinned : !!SettingsStore.data.pinNewTasksByDefault;
        if (pin) patch.pinned = true;
        const pr0 = String(priority ?? '').trim();
        const prMap = {
            '高': 'high',
            '中': 'medium',
            '低': 'low',
            '无': '',
            'none': '',
        };
        const pr = prMap.hasOwnProperty(pr0) ? prMap[pr0] : pr0;
        if (pr === 'high' || pr === 'medium' || pr === 'low') patch.priority = pr;
        const ct = String(completionTime || '').trim();
        if (ct) patch.completionTime = ct;
        const st0 = String(customStatus || '').trim();
        if (st0) {
            const options = SettingsStore.data.customStatusOptions || [];
            const ok = options.some(o => String(o?.id || '').trim() === st0);
            if (ok) patch.customStatus = st0;
        }
        if (Object.keys(patch).length > 0) {
            // 异步保存属性，不阻塞UI，只要Meta写入成功即可先返回
            __tmPersistMetaAndAttrsAsync(taskId, patch).catch(e => {
                hint('⚠ 属性同步失败，但已保存到本地数据', 'warning');
            });
        }

        const docName = state.allDocuments.find(d => d.id === parentDocId)?.name || '未知文档';
        const newTask = {
            id: taskId,
            done: false,
            pinned: !!pin,
            content: text,
            markdown: md,
            priority: patch.priority || '',
            duration: '',
            remark: '',
            completionTime: patch.completionTime || '',
            customTime: '',
            customStatus: patch.customStatus || '',
            docName,
            root_id: parentDocId,
            docId: parentDocId,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            children: [],
            level: 0,
        };
        try { normalizeTaskFields(newTask, docName); } catch (e) {}

        state.flatTasks[taskId] = newTask;
        const doc = state.taskTree.find(d => d.id === parentDocId);
        if (doc) {
            doc.tasks.push(newTask);
        }
        try { recalcStats(); } catch (e) {}
        try { applyFilters(); } catch (e) {}
        if (state.modal) render();
        return taskId;
    }

    // 注册全局刷新回调，供悬浮条调用
    globalThis.__taskHorizonRefresh = () => {
        try {
            if (!state.modal || !document.body.contains(state.modal)) return;
            // 重新加载当前文档或选中文档的任务数据（如果需要完全同步）
            // 但为了性能，这里先尝试只重新应用过滤器和渲染
            // 如果数据源是实时更新的（例如引用了同一个对象），这应该够了
            // 如果需要从 block 重新读取，可能需要更重的刷新
            // 考虑到悬浮条修改的是属性，而插件读取的是内存中的 state 或 block 属性
            // 我们可能需要触发一次轻量级的重载，或者直接调用 tmRefresh
            // 这里先试用 applyFilters + render，如果不行再调用 tmRefresh
            applyFilters();
            render();
        } catch (e) {
        }
    };

    window.tmQuickAddClose = function() {
        if (state.quickAddModal) {
            try { state.quickAddModal.remove(); } catch (e) {}
            state.quickAddModal = null;
        }
        if (state.quickAddDocPicker) {
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }
        state.quickAdd = null;
    };

    window.tmQuickAddOpen = function() {
        if (state.quickAddModal) {
            try { state.quickAddModal.remove(); } catch (e) {}
            state.quickAddModal = null;
        }
        if (state.quickAddDocPicker) {
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }

        const docId = __tmResolveQuickAddDocId();
        if (!docId) {
            hint('⚠ 请先在设置中选择文档', 'warning');
            showSettings();
            return;
        }

        const configuredNewTaskDoc = String(SettingsStore.data.newTaskDocId || '').trim();
        const initialMode = configuredNewTaskDoc === '__dailyNote__' ? 'dailyNote' : 'doc';
        const initialDocId = configuredNewTaskDoc === '__dailyNote__' ? __tmResolveDefaultDocId() : docId;

        const stOptions = SettingsStore.data.customStatusOptions || [];
        const defaultStatusId = String((stOptions[0] && stOptions[0].id) || 'todo').trim() || 'todo';
        state.quickAdd = {
            docId: initialDocId,
            docMode: initialMode,
            customStatus: defaultStatusId,
            priority: 'none',
            completionTime: '',
        };

        const modal = document.createElement('div');
        modal.className = 'tm-prompt-modal';
        modal.style.zIndex = '100010';
        
        // 优先级配置
        const prConfig = {
            'high': { label: '高', color: '#ea4335', bg: 'rgba(234, 67, 53, 0.1)' },
            'medium': { label: '中', color: '#f9ab00', bg: 'rgba(249, 171, 0, 0.1)' },
            'low': { label: '低', color: '#4285f4', bg: 'rgba(66, 133, 244, 0.1)' },
            'none': { label: '无', color: 'var(--tm-text-color)', bg: 'transparent' }
        };

        modal.innerHTML = `
            <div class="tm-prompt-box" style="width: min(92vw, 520px);">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <div class="tm-prompt-title" style="margin:0;">添加待办</div>
                    <button class="tm-btn tm-btn-primary" onclick="tmQuickAddSubmit()" style="padding: 6px 14px; font-size: 13px;">提交</button>
                </div>
                
                <input type="text" id="tmQuickAddInput" class="tm-prompt-input" placeholder="输入事项…" style="margin-top:16px; font-size: 16px; padding: 12px;">
                
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:16px;">
                    <button class="tm-btn tm-btn-secondary" onclick="tmQuickAddOpenDocPicker()" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:4px;">
                        📁 <span id="tmQuickAddDocName">文档</span>
                    </button>
                    
                    <button id="tmQuickAddPriorityBtn" class="tm-btn tm-btn-secondary" onclick="tmQuickAddCyclePriority()" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:4px;">
                        ⭐ 重要性: 无
                    </button>

                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:13px;">🏷</span>
                        <select id="tmQuickAddStatusSelect" onchange="tmQuickAddStatusChanged(this.value)" class="tm-btn tm-btn-secondary" style="padding: 6px 10px; font-size: 13px; height: 32px;">
                        </select>
                    </div>
                    
                    <div style="position:relative; display:inline-block;">
                        <!-- 桌面端/移动端通用的日期选择器 -->
                        <div style="position:relative; display:inline-block;">
                            <button class="tm-btn tm-btn-secondary" onclick="document.getElementById('tmQuickAddDateInput').showPicker ? document.getElementById('tmQuickAddDateInput').showPicker() : document.getElementById('tmQuickAddDateInput').click()" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:4px;">
                                🗓 <span id="tmQuickAddDateLabel">完成日</span>
                            </button>
                            <input type="date" id="tmQuickAddDateInput" onchange="tmQuickAddDateChanged(this.value)" 
                                   style="position:absolute; visibility:hidden; width:1px; height:1px; bottom:0; left:0;">
                        </div>
                    </div>

                    <div style="flex:1;"></div>
                    <button class="tm-btn tm-btn-gray" id="tmQuickAddCloseBtn" onclick="tmQuickAddClose()" style="padding: 6px 12px; font-size: 13px;">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        state.quickAddModal = modal;
        
        // 自动聚焦 (兼容移动端)
        const input = document.getElementById('tmQuickAddInput');
        if (input) {
            setTimeout(() => {
                input.focus();
                // 移动端尝试触发软键盘
                try { input.click(); } catch(e) {}
            }, 300);
        }

        window.tmQuickAddRenderMeta?.();
    };

    // 绑定全局点击事件，用于处理日期选择和关闭按钮（防止事件未被正确绑定）
    if (!window.tmQuickAddEventsBound) {
        window.tmQuickAddEventsBound = true;
        __tmQuickAddGlobalClickHandler = (e) => {
            const target = e.target;
            if (target.id === 'tmQuickAddCloseBtn' || (target.matches('.tm-btn-gray') && target.textContent.trim() === '关闭')) {
                if (state.quickAddModal) {
                    tmQuickAddClose();
                }
            }
        };
        document.addEventListener('click', __tmQuickAddGlobalClickHandler);
    }

    window.tmQuickAddRenderMeta = function() {
        try {
            const qa = state.quickAdd || {};
            
            // 更新文档按钮文字
            const docName = qa.docMode === 'dailyNote'
                ? '今天日记'
                : (state.allDocuments.find(d => d.id === qa.docId)?.name || '未知文档');
            const docBtn = document.getElementById('tmQuickAddDocName');
            if (docBtn) docBtn.textContent = docName;

            // 更新优先级按钮样式
            const prBtn = document.getElementById('tmQuickAddPriorityBtn');
            if (prBtn) {
                const prMap = {
                    'high': { label: '高', color: '#ea4335', icon: '🔴' },
                    'medium': { label: '中', color: '#f9ab00', icon: '🟠' },
                    'low': { label: '低', color: '#4285f4', icon: '🔵' },
                    'none': { label: '无', color: 'var(--tm-text-color)', icon: '⚪' }
                };
                const pr = qa.priority || 'none';
                const conf = prMap[pr] || prMap.none;
                
                prBtn.innerHTML = `${conf.icon} 重要性: <span style="font-weight:bold;">${conf.label}</span>`;
                prBtn.style.color = conf.color === 'var(--tm-text-color)' ? '' : conf.color;
                prBtn.style.borderColor = conf.color === 'var(--tm-text-color)' ? '' : conf.color;
                // prBtn.style.background = conf.bg; // 背景色可能太花，暂只改文字和边框颜色
            }

            const stSel = document.getElementById('tmQuickAddStatusSelect');
            if (stSel) {
                window.tmQuickAddRefreshStatusSelect?.();
                const options = SettingsStore.data.customStatusOptions || [];
                const id = String(qa.customStatus || '').trim() || 'todo';
                const opt = options.find(o => o && o.id === id) || options[0] || { id: 'todo', name: '待办', color: 'var(--tm-text-color)' };
                const c = String(opt.color || '').trim();
                stSel.style.color = c && c !== '#757575' ? c : '';
                stSel.style.borderColor = c && c !== '#757575' ? c : '';
            }

            // 更新日期显示
            const dateLabel = document.getElementById('tmQuickAddDateLabel');
            const dateInput = document.getElementById('tmQuickAddDateInput');
            if (dateLabel && dateInput) {
                const ct = qa.completionTime ? __tmFormatTaskTime(qa.completionTime) : '完成日';
                dateLabel.textContent = ct;
                dateInput.value = qa.completionTime ? __tmNormalizeDateOnly(qa.completionTime) : '';
                
                if (qa.completionTime) {
                    const btn = document.getElementById('tmQuickAddDateLabel')?.parentElement;
                    if (btn) {
                        btn.style.color = 'var(--tm-primary-color)';
                        btn.style.borderColor = 'var(--tm-primary-color)';
                    }
                }
            }
        } catch (e) {}
    };

    window.tmQuickAddStatusChanged = function(value) {
        const qa = state.quickAdd;
        if (!qa) return;
        qa.customStatus = String(value || '').trim();
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddRefreshStatusSelect = function() {
        const sel = document.getElementById('tmQuickAddStatusSelect');
        if (!sel) return;
        const options = SettingsStore.data.customStatusOptions || [];
        if (!Array.isArray(options) || options.length === 0) {
            sel.innerHTML = '';
            sel.disabled = true;
            return;
        }
        sel.disabled = false;
        const qa = state.quickAdd;
        let current = String(qa?.customStatus || '').trim();
        if (!options.some(o => String(o?.id || '').trim() === current)) {
            current = String(options[0]?.id || 'todo').trim() || 'todo';
            if (qa) qa.customStatus = current;
        }
        sel.innerHTML = options.map(o => {
            const id = String(o?.id || '').trim();
            const name = String(o?.name || id).trim() || id;
            if (!id) return '';
            return `<option value="${esc(id)}" ${id === current ? 'selected' : ''}>${esc(name)}</option>`;
        }).join('');
        try { sel.value = current; } catch (e) {}
    };

    window.tmQuickAddDateChanged = function(val) {
        const qa = state.quickAdd;
        if (!qa) return;
        qa.completionTime = String(val || '').trim();
        window.tmQuickAddRenderMeta?.();
    };
    // 确保该函数在全局可见
    window.tmQuickAddDateChanged = window.tmQuickAddDateChanged;

    window.tmQuickAddCyclePriority = function() {
        const qa = state.quickAdd;
        if (!qa) return;
        const order = ['none', 'low', 'medium', 'high'];
        const idx = Math.max(0, order.indexOf(String(qa.priority || 'none')));
        qa.priority = order[(idx + 1) % order.length];
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddPickCompletion = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        const v = await showPrompt('完成日', '输入日期，如 2026-02-07（留空清除）', String(qa.completionTime || ''));
        if (v === null) return;
        qa.completionTime = String(v || '').trim();
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddOpenDocPicker = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        if (state.quickAddDocPicker) {
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }
        const groups = SettingsStore.data.docGroups || [];
        // 移除未分组逻辑
        
        const resolveDocName = (docId) => {
            if (!docId) return '未知文档';
            const found = state.allDocuments.find(d => d.id === docId);
            if (found) return found.name || '未命名文档';
            const entry = state.taskTree.find(d => d.id === docId);
            return entry?.name || '未命名文档';
        };
        const defaultDocId = __tmResolveDefaultDocId();
        const defaultDocName = defaultDocId ? resolveDocName(defaultDocId) : '未设置';

        const picker = document.createElement('div');
        picker.className = 'tm-prompt-modal';
        picker.style.zIndex = '100011';
        picker.innerHTML = `
            <div class="tm-prompt-box" style="width:min(92vw,520px);max-height:70vh;overflow:auto;">
                <div class="tm-prompt-title" style="margin:0 0 10px 0;">选择文档</div>
                <div style="border:1px solid var(--tm-border-color);border-radius:8px;margin-bottom:8px;overflow:hidden;">
                    <div style="padding:8px 10px;background:var(--tm-header-bg);font-weight:600;">快捷</div>
                    <div style="padding:6px 10px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;" onclick="tmQuickAddUseTodayDiary();tmQuickAddCloseDocPicker();">
                            <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">今天日记</div>
                            <div style="margin-left:10px;">${qa.docMode === 'dailyNote' ? '✅' : '◻️'}</div>
                        </div>
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:${defaultDocId ? 'pointer' : 'not-allowed'};opacity:${defaultDocId ? 1 : 0.6};" onclick="${defaultDocId ? `tmQuickAddUseDefaultDoc();tmQuickAddCloseDocPicker();` : ''}">
                            <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">默认任务文档：${esc(defaultDocName)}</div>
                            <div style="margin-left:10px;">${qa.docMode !== 'dailyNote' && qa.docId === defaultDocId ? '✅' : '◻️'}</div>
                        </div>
                    </div>
                </div>
                <div id="tmQuickAddDocList"></div>
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="tm-btn tm-btn-gray" onclick="tmQuickAddCloseDocPicker()" style="padding: 6px 10px; font-size: 12px;">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(picker);
        state.quickAddDocPicker = picker;

        const listEl = picker.querySelector('#tmQuickAddDocList');
        const renderGroup = (label, docs, groupKey, initialOpen = false) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'border:1px solid var(--tm-border-color);border-radius:8px;margin-bottom:8px;overflow:hidden;';
            const head = document.createElement('div');
            head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--tm-header-bg);cursor:pointer;';
            head.innerHTML = `<div style="font-weight:600;">${esc(label)}</div><div style="opacity:0.75;">${initialOpen ? '▾' : '▸'}</div>`;
            const body = document.createElement('div');
            body.style.cssText = `padding:6px 10px;display:${initialOpen ? 'block' : 'none'};`;
            
            // 渲染文档列表的辅助函数
            const renderDocs = (docList) => {
                body.innerHTML = '';
                if (docList.length === 0) {
                    body.innerHTML = '<div style="color:var(--tm-secondary-text);padding:8px 0;font-size:13px;">暂无文档</div>';
                    return;
                }
                docList.forEach(d => {
                    const id = String(d?.id || d || '').trim();
                    if (!id) return;
                    const row = document.createElement('div');
                    const checked = id === qa.docId;
                    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;';
                    row.innerHTML = `<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(resolveDocName(id))}</div><div style="margin-left:10px;">${checked ? '✅' : '◻️'}</div>`;
                    row.onclick = () => window.tmQuickAddSelectDoc?.(id);
                    body.appendChild(row);
                });
            };

            // 初始状态下不渲染文档列表，或者渲染配置的文档（视需求而定）
            // 用户要求：点击后展示全部以查询到有任务的文档名，而不只是设置中的文档
            // 所以初始状态可以是空的或者只显示配置文档，展开时再动态加载
            if (initialOpen) {
                renderDocs(docs); // 初始展开时先显示配置的
            }

            // 点击分组标题展开/折叠
            head.onclick = async () => {
                const open = body.style.display !== 'none';
                if (!open) {
                    // 展开时
                    body.style.display = 'block';
                    head.lastElementChild.textContent = '▾';
                    
                    // 动态查询该分组下所有包含任务的文档
                    if (groupKey) {
                        // 显示加载中状态
                        body.innerHTML = '<div style="color:var(--tm-secondary-text);padding:8px 0;font-size:13px;">🔄 加载文档中...</div>';
                        try {
                            // 使用 SQL 查询：假设 docGroups 配置的是根文档或目录
                            // 但 docGroups 配置的是文档列表。
                            // 如果用户意图是：通过 SQL 查询该分组下（假设分组 ID 是目录 ID？）的文档
                            // 但 docGroups 的 ID 是随机生成的 UUID，不对应真实目录。
                            // 唯一关联真实目录的是 g.docs 里的文档 ID。
                            
                            // 另一种理解：用户希望在点击分组时，列出当前 state.taskTree 中加载的所有属于该分组的文档
                            // 即使它们不在 SettingsStore 的 g.docs 配置里（可能是递归加载进来的）
                            
                            // 1. 获取该分组配置的所有根文档 ID
                            const rootDocIds = new Set(docs.map(d => String(d?.id || d || '')));
                            
                            // 2. 遍历 state.taskTree，找到所有属于这些根文档（或其子文档）的文档
                            // state.taskTree 是扁平的文档列表（包含递归加载的子文档）
                            // 我们需要一种方法判断 taskTree 中的文档是否属于当前分组
                            // 这里的逻辑假设：如果 taskTree 中的文档是 g.docs 中某个文档的子孙，则属于该分组。
                            // 但 taskTree 结构中没有直接保留层级关系，只有 doc.id
                            // 幸好 resolveDocIdsFromGroups 会解析递归，加载到 taskTree
                            
                            // 所以，我们可以认为 state.taskTree 中目前加载的所有文档，
                            // 如果它是 g.docs 中某个文档的后代（或者就是它自己），那么它就属于该分组。
                            // 但我们如何判断“后代”关系？API.getSubDocIds 是异步的。
                            // state.allDocuments 包含了所有文档路径信息（如果有 path 字段）
                            // 但 state.allDocuments 只包含 ID 和 Name。
                            
                            // 简便方案：既然 resolveDocIdsFromGroups 已经处理了递归逻辑并将结果存入 state.taskTree
                            // 我们可以尝试重新运行一次 resolveDocIdsFromGroups 的逻辑（针对特定分组），
                            // 获取该分组应该包含的所有文档 ID（包括递归的）。
                            
                            // 获取该分组的所有目标文档（含递归标记）
                            const targetDocs = docs; 
                            const finalIds = new Set();
                            
                            const promises = targetDocs.map(async (doc) => {
                                const id = String(doc?.id || doc || '');
                                if (!id) return;
                                finalIds.add(id);
                                if (doc.recursive) {
                                    try {
                                        const subIds = await API.getSubDocIds(id);
                                        subIds.forEach(sid => finalIds.add(sid));
                                    } catch(e) {}
                                }
                            });
                            await Promise.all(promises);
                            
                            // 动态查询文档的任务状态（即使不在 taskTree 中）
                            const allIds = Array.from(finalIds);
                            // 1. 先从 taskTree 中检查
                            const tasksMap = new Map();
                            allIds.forEach(id => {
                                const treeDoc = state.taskTree.find(d => d.id === id);
                                if (treeDoc && treeDoc.tasks && treeDoc.tasks.length > 0) {
                                    tasksMap.set(id, true);
                                }
                            });
                            
                            // 2. 对于不在 taskTree 中或者 taskTree 显示无任务的文档，使用 SQL 查询
                            const uncheckedIds = allIds.filter(id => !tasksMap.has(id));
                            if (uncheckedIds.length > 0) {
                                // 批量查询：检查每个文档下是否有任务
                                // SELECT root_id FROM blocks WHERE type='i' AND subtype='t' AND root_id IN (...) GROUP BY root_id
                                const CHUNK_SIZE = 50; // 分批查询以避免 SQL 过长
                                for (let i = 0; i < uncheckedIds.length; i += CHUNK_SIZE) {
                                    const chunk = uncheckedIds.slice(i, i + CHUNK_SIZE);
                                    const idsStr = chunk.map(id => `'${id}'`).join(',');
                                    const sql = `SELECT DISTINCT root_id FROM blocks WHERE type='i' AND subtype='t' AND root_id IN (${idsStr})`;
                                    try {
                                        const res = await API.call('/api/query/sql', { stmt: sql });
                                        if (res.code === 0 && res.data) {
                                            res.data.forEach(row => tasksMap.set(row.root_id, true));
                                        }
                                    } catch(e) { console.error('SQL Query Error', e); }
                                }
                            }

                            // 过滤：只展示有任务的文档
                            const docList = allIds.map(id => {
                                return { id, hasTasks: tasksMap.has(id) };
                            }).filter(item => item.hasTasks);

                            // 排序：按名称
                            docList.sort((a, b) => {
                                return resolveDocName(a.id).localeCompare(resolveDocName(b.id));
                            });
                            
                            // 渲染
                            renderDocs(docList);
                            
                        } catch (e) {
                            console.error('[QuickAdd] 加载分组文档失败', e);
                            renderDocs(docs); // 回退
                        }
                    } else {
                        renderDocs(docs);
                    }
                } else {
                    body.style.display = 'none';
                    head.lastElementChild.textContent = '▸';
                }
            };

            wrap.appendChild(head);
            wrap.appendChild(body);
            return wrap;
        };

        groups.forEach(g => {
            const docs = Array.isArray(g?.docs) ? g.docs : [];
            if (docs.length === 0) return;
            // 传递 group.id 以便进行动态查询
            listEl.appendChild(renderGroup(String(g?.name || '分组'), docs, String(g?.id || '')));
        });
    };

    window.tmQuickAddCloseDocPicker = function() {
        if (state.quickAddDocPicker) {
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }
    };

    window.tmQuickAddSelectDoc = async function(docId) {
        const qa = state.quickAdd;
        if (!qa) return;
        const id = String(docId || '').trim();
        if (!id) return;
        // 仅更新本地状态，不修改全局设置
        qa.docId = id;
        qa.docMode = 'doc';
        // 移除对 updateNewTaskDocId 的调用，避免修改全局新建文档设置
        window.tmQuickAddRenderMeta?.();
        window.tmQuickAddCloseDocPicker?.();
    };

    window.tmQuickAddUseTodayDiary = function() {
        const qa = state.quickAdd;
        if (!qa) return;
        qa.docMode = 'dailyNote';
        try { window.tmQuickAddCloseDocPicker?.(); } catch (e) {}
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddUseDefaultDoc = function() {
        const qa = state.quickAdd;
        if (!qa) return;
        const id = __tmResolveDefaultDocId();
        if (!id) {
            hint('⚠ 未设置默认任务文档', 'warning');
            return;
        }
        qa.docId = id;
        qa.docMode = 'doc';
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddSubmit = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        const input = document.getElementById('tmQuickAddInput');
        const content = String(input?.value || '').trim();
        if (!content) return;
        try {
            let targetDocId = qa.docId;
            if (qa.docMode === 'dailyNote') {
                const notebook = await API.getDocNotebook(qa.docId);
                if (!notebook) throw new Error('无法确定日记所属笔记本');
                targetDocId = await API.createDailyNote(notebook);
                if (!String(targetDocId || '').trim()) throw new Error('获取日记文档失败');
            }
            await __tmCreateTaskInDoc({
                docId: targetDocId,
                content,
                priority: qa.priority,
                customStatus: qa.customStatus,
                completionTime: qa.completionTime,
            });
            hint('✅ 任务已创建', 'success');
            window.tmQuickAddClose?.();
        } catch (e) {
            hint(`❌ 创建失败: ${e.message}`, 'error');
        }
    };

    window.tmAdd = async function() {
        window.tmQuickAddOpen?.();
    };

    // 重新计算统计信息
    function recalcStats() {
        let total = 0, done = 0;
        const traverse = (tasks) => {
            tasks.forEach(task => {
                total++;
                if (task.done) done++;
                if (task.children && task.children.length > 0) {
                    traverse(task.children);
                }
            });
        };
        state.taskTree.forEach(doc => {
            traverse(doc.tasks);
        });
        state.stats.totalTasks = total;
        state.stats.doneTasks = done;
    }

    // 解析文档分组中的所有文档ID
    async function resolveDocIdsFromGroups() {
        const groups = SettingsStore.data.docGroups || [];
        const currentGroupId = SettingsStore.data.currentGroupId || 'all';
        const quickAddDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        
        let targetDocs = [];
        
        if (currentGroupId === 'all') {
            // “全部”模式：包含旧版 selectedDocIds 和所有分组中的文档
            // 1. 旧版 selectedDocIds (视为无递归)
            const legacyIds = SettingsStore.data.selectedDocIds || [];
            legacyIds.forEach(id => targetDocs.push({ id, recursive: false }));
            
            // 2. 所有分组中的文档
            groups.forEach(g => {
                if (Array.isArray(g.docs)) {
                    targetDocs.push(...g.docs);
                }
            });
        } else {
            // 特定分组模式
            const group = groups.find(g => g.id === currentGroupId);
            if (group && Array.isArray(group.docs)) {
                targetDocs = group.docs;
            }
        }
        
        // 解析递归文档
        const finalIds = new Set();
        if (quickAddDocId && quickAddDocId !== '__dailyNote__') finalIds.add(quickAddDocId);
        
        // 优化：并行处理
        const promises = targetDocs.map(async (doc) => {
            finalIds.add(doc.id);
            if (doc.recursive) {
                const subIds = await API.getSubDocIds(doc.id);
                subIds.forEach(id => finalIds.add(id));
            }
        });
        
        await Promise.all(promises);
        return Array.from(finalIds);
    }

    // 加载所有选中文档的任务（带递归支持）
    async function loadSelectedDocuments() {
        const token = Number(state.openToken) || 0;
        // 加载设置（包括文档ID列表）
        await SettingsStore.load();
        await MetaStore.load();
        try { globalThis.__taskHorizonQuickbarToggle?.(!!SettingsStore.data.enableQuickbar); } catch (e) {}
        const quickAddDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        
        // 将设置同步到 state
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        state.queryLimit = SettingsStore.data.queryLimit;
        const gm0 = String(SettingsStore.data.groupMode || '').trim();
        if (gm0 === 'doc') {
            state.groupByDocName = true;
            state.groupByTime = false;
            state.quadrantEnabled = false;
        } else if (gm0 === 'time') {
            state.groupByDocName = false;
            state.groupByTime = true;
            state.quadrantEnabled = false;
        } else if (gm0 === 'quadrant') {
            state.groupByDocName = false;
            state.groupByTime = false;
            state.quadrantEnabled = true;
        } else if (gm0 === 'none') {
            state.groupByDocName = false;
            state.groupByTime = false;
            state.quadrantEnabled = false;
        } else {
            state.groupByDocName = SettingsStore.data.groupByDocName;
            state.groupByTime = SettingsStore.data.groupByTime;
            state.quadrantEnabled = SettingsStore.data.quadrantConfig?.enabled || false;
        }
        state.collapsedTaskIds = new Set(SettingsStore.data.collapsedTaskIds || []);
        state.collapsedGroups = new Set(SettingsStore.data.collapsedGroups || []);
        state.currentRule = SettingsStore.data.currentRule;
        state.columnWidths = SettingsStore.data.columnWidths;
        state.excludeCompletedTasks = !!SettingsStore.data.excludeCompletedTasks;

        // 加载筛选规则
        state.filterRules = await RuleManager.initRules();

        // 1. 解析所有需要查询的文档ID
        const allDocIds = await resolveDocIdsFromGroups();
        
        // 如果没有文档，打开设置
        if (allDocIds.length === 0) {
            state.taskTree = [];
            state.flatTasks = {};
            applyFilters();
            if (state.modal && token === (Number(state.openToken) || 0)) render();
            if (state.modal && token === (Number(state.openToken) || 0)) showSettings();
            return;
        }

        try {
            const startTime = Date.now();
            
            // 2. 批量获取任务
            const res = await API.getTasksByDocuments(allDocIds, state.queryLimit);
            
            // 更新统计信息
            state.stats.queryTime = res.queryTime || (Date.now() - startTime);
            state.stats.totalTasks = res.totalCount || 0;
            state.stats.doneTasks = res.doneCount || 0;

            state.taskTree = [];
            state.flatTasks = {};
            const tasksByDoc = new Map();

            if (res.tasks) {
                let h2ContextMap = new Map();
                try {
                    h2ContextMap = await API.fetchH2Contexts(res.tasks.map(t => t.id));
                } catch (e) {
                    h2ContextMap = new Map();
                }
                const missingPriorityIds = [];

                // 3. 获取层级信息（不再依赖，改用前端递归计算）
                // const taskIds = res.tasks.map(t => t.id);
                // const hierarchyCache = await API.getTasksHierarchy(taskIds);

                // 4. 构建任务树
                state.taskTree = [];
                state.flatTasks = {};
                
                // 将任务按文档分组
                const tasksByDoc = new Map();
                res.tasks.forEach(task => {
                    // 确保任务有root_id
                    if (!task.root_id) return;
                    
                    // 解析任务状态
                    const parsed = API.parseTaskStatus(task.markdown);
                    const correctDone = parsed.done;
                    task.done = correctDone;
                    task.content = parsed.content;

                    // 应用 MetaStore
                    MetaStore.applyToTask(task);
                    task.done = correctDone; // 恢复正确状态
                    
                    // 标准化字段
                    const docName = task.docName || '未命名文档';
                    normalizeTaskFields(task, docName);
                    task.h2 = h2ContextMap.get(task.id) || '';
                    if (!task.priority) missingPriorityIds.push(task.id);

                    // 初始化 MetaStore（如果不存在）
                    const existing = MetaStore.get(task.id);
                    if (!existing) {
                        MetaStore.set(task.id, {
                            priority: task.priority || '',
                            duration: task.duration || '',
                            remark: task.remark || '',
                            completionTime: task.completionTime || '',
                            customTime: task.customTime || '',
                            content: task.content
                        });
                    }
                    
                    // 初始化层级（后续递归计算覆盖）
                    task.level = 0;
                    task.children = [];

                    if (!tasksByDoc.has(task.root_id)) {
                        tasksByDoc.set(task.root_id, []);
                    }
                    tasksByDoc.get(task.root_id).push(task);
                    state.flatTasks[task.id] = task;
                });

                try {
                    const ids = Array.from(new Set(missingPriorityIds)).filter(Boolean);
                    if (ids.length > 0) {
                        const map = await API.fetchNearestCustomPriority(ids, 10);
                        if (map && map.size > 0) {
                            ids.forEach(id => {
                                const v = map.get(id);
                                if (!v) return;
                                const t = state.flatTasks?.[id];
                                if (!t) return;
                                t.priority = v;
                                try { normalizeTaskFields(t, t.docName || '未命名文档'); } catch (e) {}
                            });
                        }
                    }
                } catch (e) {}

                // 按文档顺序构建树
                for (const docId of allDocIds) {
                    // 获取该文档的所有任务
                    const rawTasks = tasksByDoc.get(docId) || [];
                    
                    // 获取文档名称
                    let docName = '未命名文档';
                    if (rawTasks.length > 0) {
                        docName = rawTasks[0].docName;
                    } else {
                        const cachedDoc = state.allDocuments.find(d => d.id === docId);
                        if (cachedDoc) docName = cachedDoc.name;
                    }

                    // 准备构建当前文档的任务树
                    const idMap = new Map();
                    rawTasks.forEach(t => idMap.set(t.id, t));

                    try {
                        const needListIds = new Set();
                        rawTasks.forEach(t => {
                            if (!t.parentTaskId && t.parent_id) needListIds.add(String(t.parent_id));
                        });
                        let frontier = Array.from(needListIds).filter(Boolean);
                        const blockInfoMap = new Map();
                        for (let depth = 0; depth < 6 && frontier.length > 0; depth++) {
                            const rows = await API.getBlocksByIds(frontier);
                            const next = [];
                            rows.forEach(r => {
                                const id = String(r?.id || '').trim();
                                if (!id) return;
                                const parentId = String(r?.parent_id || '').trim();
                                blockInfoMap.set(id, { parentId, type: r?.type, subtype: r?.subtype });
                                if (parentId && !blockInfoMap.has(parentId) && !idMap.has(parentId)) {
                                    next.push(parentId);
                                }
                            });
                            frontier = Array.from(new Set(next));
                        }

                        rawTasks.forEach(t => {
                            if (t.parentTaskId) return;
                            let cur = String(t.parent_id || '').trim();
                            if (!cur) return;
                            const seen = new Set();
                            for (let i = 0; i < 6 && cur; i++) {
                                if (seen.has(cur)) break;
                                seen.add(cur);
                                const info = blockInfoMap.get(cur);
                                const pid = String(info?.parentId || '').trim();
                                if (pid && idMap.has(pid)) {
                                    t.parentTaskId = pid;
                                    return;
                                }
                                cur = pid;
                            }
                        });
                    } catch (e) {}

                    // 建立父子关系
                    const rootTasks = [];
                    rawTasks.forEach(t => {
                        // 确保 children 是空的
                        if (!t.children) t.children = [];
                        
                        if (t.parentTaskId && idMap.has(t.parentTaskId)) {
                            const parent = idMap.get(t.parentTaskId);
                            if (!parent.children) parent.children = [];
                            parent.children.push(t);
                        } else {
                            rootTasks.push(t);
                        }
                    });

                    // 关键：前端递归计算层级（保证视图缩进正确）
                    const calcLevel = (tasks, level) => {
                        tasks.forEach(t => {
                            t.level = level;
                            if (t.children && t.children.length > 0) {
                                calcLevel(t.children, level + 1);
                            }
                        });
                    };
                    calcLevel(rootTasks, 0);

                    // 添加到任务树
                    if (rawTasks.length > 0 || state.selectedDocIds.includes(docId) || (quickAddDocId && docId === quickAddDocId)) { 
                         state.taskTree.push({
                            id: docId,
                            name: docName,
                            tasks: rootTasks
                        });
                    }
                }
                
                applyFilters();
                if (state.modal && token === (Number(state.openToken) || 0)) render();
            }
        } catch (e) {
            console.error('[加载] 获取任务失败:', e);
            hint('❌ 加载任务失败', 'error');
        }
    }

    let __tmAllDocumentsFetchedAt = 0;
    let __tmAllDocumentsFetchPromise = null;
    function __tmEnsureAllDocumentsLoaded(force = false) {
        const now = Date.now();
        if (!force && Array.isArray(state.allDocuments) && state.allDocuments.length > 0 && (now - (__tmAllDocumentsFetchedAt || 0) < 60000)) {
            return;
        }
        if (__tmAllDocumentsFetchPromise) return;
        __tmAllDocumentsFetchPromise = Promise.resolve()
            .then(() => API.getAllDocuments())
            .then((docs) => {
                if (Array.isArray(docs)) state.allDocuments = docs;
                __tmAllDocumentsFetchedAt = Date.now();
            })
            .catch((e) => {
                try { console.error('[设置] 刷新文档列表失败:', e); } catch (e2) {}
            })
            .finally(() => {
                __tmAllDocumentsFetchPromise = null;
            });
    }

    // 显示设置
    function showSettings() {
        try { __tmHideMobileMenu(); } catch (e) {}
        if (state.settingsModal) {
            try { state.settingsModal.remove(); } catch (e) {}
            state.settingsModal = null;
        }

        state.settingsModal = document.createElement('div');
        state.settingsModal.className = 'tm-settings-modal';

        const groups = SettingsStore.data.docGroups || [];
        const currentGroupId = SettingsStore.data.currentGroupId || 'all';
        
        // 渲染分组选择器
        const renderGroupSelector = () => {
            return `
                <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <select id="groupSelector" data-tm-call="switchDocGroup" 
                            style="flex: 1; padding: 6px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                        <option value="all" ${currentGroupId === 'all' ? 'selected' : ''}>全部文档</option>
                        ${groups.map(g => `<option value="${g.id}" ${currentGroupId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
                    </select>
                    <button class="tm-btn tm-btn-primary" data-tm-action="createNewGroup" style="padding: 6px 10px; font-size: 12px;">+ 新建分组</button>
                    ${currentGroupId !== 'all' ? `<button class="tm-btn tm-btn-danger" data-tm-action="deleteCurrentGroup" style="padding: 6px 10px; font-size: 12px;">删除分组</button>` : ''}
                </div>
            `;
        };

        // 获取当前显示的文档列表
        let currentDocs = [];
        if (currentGroupId === 'all') {
            // 显示所有（包括旧版和各分组）
            const legacyIds = SettingsStore.data.selectedDocIds || [];
            legacyIds.forEach(id => currentDocs.push({ id, recursive: false }));
            groups.forEach(g => {
                if (Array.isArray(g.docs)) currentDocs.push(...g.docs);
            });
            // 去重
            const seen = new Set();
            currentDocs = currentDocs.filter(d => {
                if (seen.has(d.id)) return false;
                seen.add(d.id);
                return true;
            });
        } else {
            const group = groups.find(g => g.id === currentGroupId);
            if (group) currentDocs = group.docs || [];
        }

        const resolveDocName = (docId) => {
            if (!docId) return '未知文档';
            let doc = state.allDocuments.find(d => d.id === docId);
            if (!doc) {
                const docEntry = state.taskTree.find(d => d.id === docId);
                if (docEntry) doc = { id: docId, name: docEntry.name };
            }
            return doc?.name || '未知文档';
        };

        const defaultDocIdByGroup = (SettingsStore.data.defaultDocIdByGroup && typeof SettingsStore.data.defaultDocIdByGroup === 'object')
            ? SettingsStore.data.defaultDocIdByGroup
            : {};
        const defaultDocId = String((currentGroupId === 'all' ? SettingsStore.data.defaultDocId : defaultDocIdByGroup[currentGroupId]) || '').trim();
        const currentDocIds = currentDocs.map(d => (typeof d === 'object' ? d.id : d));
        const defaultDocOptions = [
            `<option value="" ${defaultDocId ? '' : 'selected'}>跟随当前/第一个文档</option>`
        ];
        currentDocs.forEach(docItem => {
            const docId = typeof docItem === 'object' ? docItem.id : docItem;
            const docName = resolveDocName(docId);
            defaultDocOptions.push(`<option value="${docId}" ${defaultDocId === docId ? 'selected' : ''}>${esc(docName)}</option>`);
        });
        if (defaultDocId && !currentDocIds.includes(defaultDocId)) {
            const fallbackName = resolveDocName(defaultDocId);
            defaultDocOptions.push(`<option value="${defaultDocId}" selected>${esc(fallbackName)} (不在当前列表)</option>`);
        }
        const allDocsForNewTask = (() => {
            const list = [];
            const legacyIds = SettingsStore.data.selectedDocIds || [];
            legacyIds.forEach(id => list.push({ id, recursive: false }));
            (SettingsStore.data.docGroups || []).forEach(g => {
                if (Array.isArray(g?.docs)) list.push(...g.docs);
            });
            const seen = new Set();
            return list.filter(d => {
                const id = String(d?.id || '').trim();
                if (!id) return false;
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });
        })();
        const allDocIdsForNewTask = allDocsForNewTask.map(d => String(d?.id || '').trim()).filter(Boolean);
        const newTaskDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        const newTaskDocOptions = [
            `<option value="" ${newTaskDocId ? '' : 'selected'}>未设置</option>`,
            `<option value="__dailyNote__" ${newTaskDocId === '__dailyNote__' ? 'selected' : ''}>今天日记</option>`
        ];
        allDocsForNewTask.forEach(docItem => {
            const docId = typeof docItem === 'object' ? docItem.id : docItem;
            const docName = resolveDocName(docId);
            newTaskDocOptions.push(`<option value="${docId}" ${newTaskDocId === docId ? 'selected' : ''}>${esc(docName)}</option>`);
        });
        if (newTaskDocId && !allDocIdsForNewTask.includes(newTaskDocId)) {
            const fallbackName = resolveDocName(newTaskDocId);
            newTaskDocOptions.push(`<option value="${newTaskDocId}" selected>${esc(fallbackName)} (不在当前列表)</option>`);
        }
        let activeTab = 'main';
        if (state.settingsActiveTab === 'appearance') activeTab = 'appearance';
        if (state.settingsActiveTab === 'rules') activeTab = 'rules';
        if (state.settingsActiveTab === 'quadrant') activeTab = 'quadrant';
        if (state.settingsActiveTab === 'priority') activeTab = 'priority';
        if (activeTab === 'main') {
            try { __tmEnsureAllDocumentsLoaded(false); } catch (e) {}
        }

        state.settingsModal.innerHTML = `
            <div class="tm-settings-box" style="overflow: hidden;">
                <div class="tm-settings-header">
                    <div class="tm-settings-title">⚙️ 任务管理器设置</div>
                    <button class="tm-btn tm-btn-gray" data-tm-action="closeSettings">关闭</button>
                </div>

                <div class="tm-settings-tabs" style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--tm-border-color); padding-bottom: 8px;">
                    ${activeTab !== 'rule_editor' ? `
                    <button class="tm-btn ${activeTab === 'main' ? 'tm-btn-primary' : 'tm-btn-secondary'}" data-tm-action="tmSwitchSettingsTab" data-tab="main" style="padding: 6px 10px; font-size: 12px;">常规设置</button>
                    <button class="tm-btn ${activeTab === 'appearance' ? 'tm-btn-primary' : 'tm-btn-secondary'}" data-tm-action="tmSwitchSettingsTab" data-tab="appearance" style="padding: 6px 10px; font-size: 12px;">外观</button>
                    <button class="tm-btn ${activeTab === 'rules' ? 'tm-btn-primary' : 'tm-btn-secondary'}" data-tm-action="tmSwitchSettingsTab" data-tab="rules" style="padding: 6px 10px; font-size: 12px;">规则管理</button>
                    <button class="tm-btn ${activeTab === 'quadrant' ? 'tm-btn-primary' : 'tm-btn-secondary'}" data-tm-action="tmSwitchSettingsTab" data-tab="quadrant" style="padding: 6px 10px; font-size: 12px;">四象限</button>
                    <button class="tm-btn ${activeTab === 'priority' ? 'tm-btn-primary' : 'tm-btn-secondary'}" data-tm-action="tmSwitchSettingsTab" data-tab="priority" style="padding: 6px 10px; font-size: 12px;">优先级算法</button>
                    ` : `
                    <button class="tm-btn tm-btn-primary" style="padding: 6px 10px; font-size: 12px;">${state.editingRule ? '编辑规则' : '新建规则'}</button>
                    `}
                </div>

                <div style="flex: 1; overflow-y: auto; min-height: 0; padding-right: 4px; margin-bottom: 16px;">
                    ${activeTab === 'appearance' ? `
                        <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;" class="tm-width-settings">
                            <div style="font-weight: 600; margin-bottom: 12px;">📏 列设置 (显示/排序/宽度)</div>
                            ${renderColumnWidthSettings()}
                        </div>
                        <div style="margin-bottom: 0; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                            <div style="font-weight: 600; margin-bottom: 12px;">🎨 配色</div>
                            ${renderAppearanceColorSettings()}
                        </div>
                    ` : ''}

                    ${activeTab === 'rules' ? `
                        <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="font-weight: 600;">📋 筛选规则管理</div>
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <button class="tm-btn tm-btn-secondary" data-tm-action="tmSwitchSettingsTab" data-tab="priority" style="padding: 4px 10px; font-size: 12px;">优先级算法</button>
                                    <button class="tm-btn tm-btn-primary" data-tm-action="addNewRule" style="padding: 4px 10px; font-size: 12px;">+ 新建规则</button>
                                </div>
                            </div>
                            <div id="tm-rules-list" style="display: flex; flex-direction: column; gap: 8px;">
                                ${renderRulesList()}
                            </div>
                            <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--tm-border-color);">
                                规则说明：支持多条件组合筛选，可设置“包含/不包含”关键词、“优先级”、“状态”等条件。
                            </div>
                        </div>
                    ` : ''}

                    ${activeTab === 'priority' ? `
                        <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                            <div id="tm-priority-settings">
                                ${__tmRenderPriorityScoreSettings(true)}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${activeTab === 'quadrant' ? `
                        <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                            <div style="font-weight: 600; margin-bottom: 12px;">📊 四象限分组规则</div>
                            <div style="font-size: 12px; color: var(--tm-secondary-text); margin-bottom: 12px;">
                                根据任务的「重要性」和「完成时间」自动将任务分配到四个象限。
                            </div>
                            ${renderQuadrantSettings()}
                        </div>
                    ` : ''}
                    
                    ${activeTab === 'rule_editor' ? `
                        <div class="tm-rule-editor-inline">
                            ${state.editingRule ? RuleManager.renderEditorContent(state.editingRule) : ''}
                        </div>
                    ` : ''}

                    ${activeTab === 'main' ? `
                    <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start;">
                        <label style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; row-gap: 6px; cursor: pointer; flex: 1 1 260px; min-width: 220px;">
                            <span>查询限制: </span>
                            <input type="number" value="${state.queryLimit}"
                                   onchange="updateQueryLimit(this.value)"
                                   style="width: 80px; padding: 4px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                            <span>条任务/文档</span>
                        </label>
                        
                        <label style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; row-gap: 6px; cursor: pointer; flex: 1 1 220px; min-width: 180px;">
                            <span>字体大小: </span>
                            <input type="number" value="${SettingsStore.data.fontSize}" min="10" max="30"
                                   onchange="updateFontSize(this.value)"
                                   style="width: 60px; padding: 4px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                            <span>px</span>
                        </label>

                        <label style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; row-gap: 6px; cursor: pointer; flex: 1 1 240px; min-width: 200px;">
                            <span>移动端字体: </span>
                            <input type="number" value="${SettingsStore.data.fontSizeMobile || SettingsStore.data.fontSize}" min="10" max="30"
                                   onchange="updateFontSizeMobile(this.value)"
                                   style="width: 60px; padding: 4px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                            <span>px</span>
                        </label>

                        <label style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; row-gap: 6px; cursor: pointer; flex: 1 1 240px; min-width: 200px;">
                            <span>任务标题级别: </span>
                            <select onchange="updateTaskHeadingLevel(this.value)"
                                    style="padding: 4px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                                <option value="h1" ${SettingsStore.data.taskHeadingLevel === 'h1' ? 'selected' : ''}>H1 一级标题</option>
                                <option value="h2" ${SettingsStore.data.taskHeadingLevel === 'h2' ? 'selected' : ''}>H2 二级标题</option>
                                <option value="h3" ${SettingsStore.data.taskHeadingLevel === 'h3' ? 'selected' : ''}>H3 三级标题</option>
                                <option value="h4" ${SettingsStore.data.taskHeadingLevel === 'h4' ? 'selected' : ''}>H4 四级标题</option>
                                <option value="h5" ${SettingsStore.data.taskHeadingLevel === 'h5' ? 'selected' : ''}>H5 五级标题</option>
                                <option value="h6" ${SettingsStore.data.taskHeadingLevel === 'h6' ? 'selected' : ''}>H6 六级标题</option>
                            </select>
                        </label>
                    </div>

                    <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 8px;">⚡ 性能与显示设置</div>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="checkbox" ${SettingsStore.data.excludeCompletedTasks ? 'checked' : ''} onchange="updateExcludeCompletedTasks(this.checked)">
                            不查找已完成父任务（提升搜索性能和长期使用性能）
                        </label>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 6px; margin-bottom: 12px;">
                            开启后仅查找未完成任务。含有子任务的任务，如果父任务未完成，已完成的子任务仍会显示。
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-size:12px;color:var(--tm-secondary-text);">时长显示格式:</span>
                            <select onchange="updateDurationFormat(this.value)" style="padding: 4px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                                <option value="hours" ${String(SettingsStore.data.durationFormat || 'hours') === 'hours' ? 'selected' : ''}>小时 (如 1.5h)</option>
                                <option value="minutes" ${String(SettingsStore.data.durationFormat || '') === 'minutes' ? 'selected' : ''}>分钟 (如 90min)</option>
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 8px;">🧷 任务悬浮条（quickbar）</div>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="checkbox" ${SettingsStore.data.enableQuickbar ? 'checked' : ''} onchange="updateEnableQuickbar(this.checked)">
                            启用任务悬浮条（点击任务块显示自定义字段）
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:8px;">
                            <input type="checkbox" ${SettingsStore.data.pinNewTasksByDefault ? 'checked' : ''} onchange="updatePinNewTasksByDefault(this.checked)">
                            新建任务默认置顶
                        </label>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 6px;">
                            关闭后将不再弹出悬浮条，也不会拦截点击/长按事件。
                        </div>
                    </div>

                    <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 8px;">🍅 番茄钟联动</div>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="checkbox" ${SettingsStore.data.enableTomatoIntegration ? 'checked' : ''} onchange="updateEnableTomatoIntegration(this.checked)">
                            启用 tomato.js 相关功能（计时/提醒/耗时列）
                        </label>
                        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;opacity:${SettingsStore.data.enableTomatoIntegration ? 1 : 0.6};">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <span style="font-size:12px;color:var(--tm-secondary-text);">耗时读取模式:</span>
                                <select onchange="updateTomatoSpentAttrMode(this.value)" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} style="padding: 4px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                                    <option value="minutes" ${String(SettingsStore.data.tomatoSpentAttrMode || 'minutes') === 'minutes' ? 'selected' : ''}>分钟属性</option>
                                    <option value="hours" ${String(SettingsStore.data.tomatoSpentAttrMode || '') === 'hours' ? 'selected' : ''}>小时属性</option>
                                </select>
                            </div>
                            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:220px;">
                                <span style="font-size:12px;color:var(--tm-secondary-text);white-space:nowrap;">分钟属性名</span>
                                <input type="text" value="${esc(String(SettingsStore.data.tomatoSpentAttrKeyMinutes || 'custom-tomato-minutes'))}" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoSpentAttrKeyMinutes(this.value)" style="flex:1; min-width:160px; padding: 6px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                            </div>
                            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:220px;">
                                <span style="font-size:12px;color:var(--tm-secondary-text);white-space:nowrap;">小时属性名</span>
                                <input type="text" value="${esc(String(SettingsStore.data.tomatoSpentAttrKeyHours || 'custom-tomato-time'))}" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoSpentAttrKeyHours(this.value)" style="flex:1; min-width:160px; padding: 6px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                            </div>
                        </div>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 6px;">
                            属性名指的是思源区块属性 name，例如 custom-tomato-minutes。
                        </div>
                    </div>

                    <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 8px;">📍 全局新建文档位置设置</div>
                        <select onchange="updateNewTaskDocIdFromSelect(this.value)" 
                                style="width: 100%; padding: 6px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                            ${newTaskDocOptions.join('')}
                        </select>
                        <div style="display:flex; gap:8px; margin-top: 8px; align-items:center;">
                            <input id="tmNewTaskDocIdInput" class="tm-input" list="tmNewTaskDocIdList"
                                   value="${esc(newTaskDocId === '__dailyNote__' ? '' : (newTaskDocId || ''))}"
                                   placeholder="也可直接输入文档ID"
                                   style="flex: 1; padding: 6px 8px;">
                            <button class="tm-btn tm-btn-secondary" onclick="tmApplyNewTaskDocIdInput()" style="padding: 6px 10px; font-size: 12px;">应用</button>
                            <button class="tm-btn tm-btn-gray" onclick="tmClearNewTaskDocIdInput()" style="padding: 6px 10px; font-size: 12px;">清空</button>
                        </div>
                        <datalist id="tmNewTaskDocIdList">
                            ${allDocsForNewTask.map(docItem => {
                                const docId = typeof docItem === 'object' ? docItem.id : docItem;
                                const docName = resolveDocName(docId);
                                return `<option value="${docId}">${esc(docName)}</option>`;
                            }).join('')}
                            ${newTaskDocId && !allDocIdsForNewTask.includes(newTaskDocId) ? `<option value="${newTaskDocId}"></option>` : ''}
                        </datalist>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 6px;">
                            用于“快速新建任务界面”的默认文档位置，可在新建界面临时切换。
                        </div>
                    </div>

                    <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 12px;">🏷️ 状态选项设置</div>
                        <div id="tm-status-options-list">
                            ${renderStatusOptionsList()}
                        </div>
                        <button class="tm-btn tm-btn-primary" data-tm-action="addStatusOption" style="margin-top: 8px; font-size: 12px;">+ 添加状态</button>
                    </div>

                    <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 8px;">📂 文档分组与管理</div>
                        ${renderGroupSelector()}
                        
                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                            <input type="text" id="manualDocId" placeholder="输入文档ID"
                                   style="flex: 1; padding: 8px 12px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 13px;">
                            <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; user-select: none;">
                                <input type="checkbox" id="recursiveCheck">
                                包含子文档
                            </label>
                            <button class="tm-btn tm-btn-primary" data-tm-action="addManualDoc">添加</button>
                        </div>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 8px;">
                            提示：在思源笔记中打开文档，文档菜单中复制ID即可得到文档ID
                        </div>
                    </div>

                    <div style="margin-bottom: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 600;">📚 当前列表文档（${currentDocs.length} 个）</span>
                            ${currentGroupId !== 'all' ? `<button class="tm-btn tm-btn-danger" data-tm-action="clearCurrentGroupDocs" style="padding: 4px 8px; font-size: 12px;">清空当前分组</button>` : ''}
                        </div>
                        ${currentDocs.length > 0 ? `
                            <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--tm-border-color); border-radius: 8px; padding: 8px;">
                                ${currentDocs.map((docItem, index) => {
                                    // 尝试从 allDocuments 中查找
                                    const docId = typeof docItem === 'object' ? docItem.id : docItem;
                                    const isRecursive = typeof docItem === 'object' ? !!docItem.recursive : false;
                                    
                                    let doc = state.allDocuments.find(d => d.id === docId);

                                    // 如果找不到，尝试从 taskTree 中查找
                                    if (!doc) {
                                        const docEntry = state.taskTree.find(d => d.id === docId);
                                        if (docEntry) {
                                            doc = { id: docId, name: docEntry.name };
                                        }
                                    }

                                    const docName = doc ? doc.name : '未知文档';
                                    const displayName = docName.length > 25 ? docName.substring(0, 25) + '...' : docName;

                                    return `
                                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--tm-card-bg); border-radius: 4px; margin-bottom: 4px;">
                                            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                                                <span style="color: var(--tm-primary-color); font-weight: 500;">${index + 1}.</span>
                                                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                                    <span title="${esc(docName)}">${esc(displayName)}</span>
                                                    ${isRecursive ? '<span style="font-size: 10px; background: var(--tm-info-bg); color: var(--tm-primary-color); padding: 1px 4px; border-radius: 4px; margin-left: 4px;">+子文档</span>' : ''}
                                                </div>
                                                <span style="font-size: 11px; color: var(--tm-task-done-color); font-family: monospace;">${docId.slice(0, 8)}...</span>
                                            </div>
                                            ${currentGroupId !== 'all' ? `
                                                <button class="tm-btn tm-btn-danger" onclick="removeDocFromGroup(${index})" style="padding: 2px 6px; font-size: 11px;">移除</button>
                                            ` : `
                                                <button class="tm-btn tm-btn-danger" onclick="removeDocFromAll('${docId}')" style="padding: 2px 6px; font-size: 11px;">移除</button>
                                            `}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : '<div style="color: var(--tm-secondary-text); font-size: 13px; padding: 10px; background: var(--tm-rule-group-bg); border-radius: 8px;">暂无文档，请添加</div>'}
                    </div>
                    ` : ''}
                </div>

                ${activeTab === 'priority' ? `
                <div class="tm-settings-footer">
                    <button class="tm-btn tm-btn-secondary" data-tm-action="closePriorityScoreSettings">取消</button>
                    <button class="tm-btn tm-btn-success" data-tm-action="savePriorityScoreSettings">保存算法</button>
                </div>
                ` : activeTab !== 'rule_editor' ? `
                <div class="tm-settings-footer">
                    <button class="tm-btn tm-btn-secondary" data-tm-action="closeSettings">取消</button>
                    <button class="tm-btn tm-btn-success" data-tm-action="saveSettings">保存设置</button>
                </div>
                ` : `
                <div class="tm-settings-footer">
                    <button class="tm-btn tm-btn-secondary" data-tm-action="cancelEditRule">取消</button>
                    <button class="tm-btn tm-btn-success" data-tm-action="saveEditRule">保存规则</button>
                </div>
                `}
            </div>
        `;

        document.body.appendChild(state.settingsModal);
        __tmBindRulesManagerEvents(state.settingsModal);
    }
    window.showSettings = showSettings;
    window.tmSwitchSettingsTab = function(tab) {
        const prev = state.settingsActiveTab || 'main';
        if (tab === 'rules') {
            state.settingsActiveTab = 'rules';
        } else if (tab === 'appearance') {
            state.settingsActiveTab = 'appearance';
        } else if (tab === 'quadrant') {
            state.settingsActiveTab = 'quadrant';
        } else if (tab === 'priority') {
            state.priorityScoreDraft = state.priorityScoreDraft || __tmEnsurePriorityDraft();
            state.settingsActiveTab = 'priority';
        } else {
            state.settingsActiveTab = 'main';
        }
        if ((state.settingsActiveTab || 'main') === prev) return;
        showSettings();
    };

    // 移除独立的规则管理器弹窗逻辑
    // window.showRulesManager = function() {...}
    // 改为直接跳转到设置页的规则标签
    window.showRulesManager = function() {
        state.settingsActiveTab = 'rules';
        showSettings();
    };

    // 渲染列设置（显示/排序/宽度）
    function renderColumnWidthSettings() {
        const availableCols = [
            { key: 'pinned', label: '置顶' },
            { key: 'content', label: '任务内容' },
            { key: 'status', label: '状态' },
            { key: 'score', label: '优先级' },
            { key: 'doc', label: '文档' },
            { key: 'h2', label: (() => {
                const level = SettingsStore.data.taskHeadingLevel || 'h2';
                const labels = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
                return labels[level] || '标题';
            })() },
            { key: 'priority', label: '重要性' },
            { key: 'startDate', label: '开始日期' },
            { key: 'completionTime', label: '完成时间' },
            { key: 'duration', label: '时长' },
            { key: 'spent', label: '耗时' },
            { key: 'remark', label: '备注' }
        ];

        const currentOrder = SettingsStore.data.columnOrder || ['pinned', 'content', 'status', 'score', 'doc', 'h2', 'priority', 'startDate', 'completionTime', 'duration', 'spent', 'remark'];
        const widths = SettingsStore.data.columnWidths || {};

        let html = '<div class="tm-column-list">';
        
        // Visible columns
        currentOrder.forEach((key, index) => {
            const colDef = availableCols.find(c => c.key === key) || { key, label: key };
            const width = widths[key] || 120;
            
            html += `
                <div class="tm-column-item" style="display: flex; align-items: center; gap: 8px; padding: 6px; background: var(--tm-input-bg); margin-bottom: 4px; border-radius: 4px;">
                    <input type="checkbox" checked onchange="toggleColumn('${key}', false)" title="显示/隐藏">
                    <span style="width: 70px; font-weight: bold; font-size: 13px;">${colDef.label}</span>
                    <div style="display: flex; gap: 2px;">
                        <button class="tm-btn" onclick="moveColumn('${key}', -1)" ${index === 0 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 10px;">↑</button>
                        <button class="tm-btn" onclick="moveColumn('${key}', 1)" ${index === currentOrder.length - 1 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 10px;">↓</button>
                    </div>
                    <input type="range" min="40" max="800" value="${width}" style="flex: 1; margin: 0 8px;" onchange="updateColumnWidth('${key}', parseInt(this.value))" title="宽度调整">
                    <span style="font-size: 12px; width: 52px; text-align: right;">${width}px</span>
                </div>
            `;
        });

        // Invisible columns
        const hiddenCols = availableCols.filter(c => !currentOrder.includes(c.key));
        if (hiddenCols.length > 0) {
            html += '<div style="margin-top: 12px; font-size: 12px; color: var(--tm-secondary-text); margin-bottom: 4px;">隐藏的列 (勾选以显示):</div>';
            hiddenCols.forEach(col => {
                html += `
                    <div class="tm-column-item" style="display: flex; align-items: center; gap: 8px; padding: 6px; opacity: 0.7;">
                        <input type="checkbox" onchange="toggleColumn('${col.key}', true)">
                        <span style="font-size: 13px;">${col.label}</span>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        return html;
    }

    function renderAppearanceColorSettings() {
        const d = SettingsStore.data || {};
        const isMobile = __tmIsMobileDevice();
        const items = [
            {
                title: '插件顶栏渐变',
                rows: [
                    { label: '亮色 起始', key: 'topbarGradientLightStart', value: d.topbarGradientLightStart || '#667eea' },
                    { label: '亮色 结束', key: 'topbarGradientLightEnd', value: d.topbarGradientLightEnd || '#764ba2' },
                    { label: '夜间 起始', key: 'topbarGradientDarkStart', value: d.topbarGradientDarkStart || '#3b49b7' },
                    { label: '夜间 结束', key: 'topbarGradientDarkEnd', value: d.topbarGradientDarkEnd || '#5b2d7a' }
                ]
            },
            {
                title: '任务内容列字体颜色',
                rows: [
                    { label: '亮色', key: 'taskContentColorLight', value: d.taskContentColorLight || '#333333' },
                    { label: '夜间', key: 'taskContentColorDark', value: d.taskContentColorDark || '#e0e0e0' }
                ]
            },
            {
                title: '子任务进度条背景',
                rows: [
                    { label: '亮色', key: 'progressBarColorLight', value: d.progressBarColorLight || '#4caf50' },
                    { label: '夜间', key: 'progressBarColorDark', value: d.progressBarColorDark || '#81c784' }
                ]
            },
            {
                title: '表格边框线颜色',
                rows: [
                    { label: '亮色', key: 'tableBorderColorLight', value: d.tableBorderColorLight || '#e9ecef' },
                    { label: '夜间', key: 'tableBorderColorDark', value: d.tableBorderColorDark || '#333333' }
                ]
            },
            {
                title: '分组名称（按文档分组）',
                rows: [
                    { label: '亮色', key: 'groupDocLabelColorLight', value: d.groupDocLabelColorLight || '#333333' },
                    { label: '夜间', key: 'groupDocLabelColorDark', value: d.groupDocLabelColorDark || '#e0e0e0' }
                ]
            },
            {
                title: '分组名称（按时间分组）',
                rows: [
                    { label: '未来基础色 亮色', key: 'timeGroupBaseColorLight', value: d.timeGroupBaseColorLight || '#1a73e8' },
                    { label: '未来基础色 夜间', key: 'timeGroupBaseColorDark', value: d.timeGroupBaseColorDark || '#6ba5ff' },
                    { label: '已过期 亮色', key: 'timeGroupOverdueColorLight', value: d.timeGroupOverdueColorLight || '#d93025' },
                    { label: '已过期 夜间', key: 'timeGroupOverdueColorDark', value: d.timeGroupOverdueColorDark || '#ff6b6b' }
                ]
            }
        ];

        const renderRow = (row) => {
            const raw = __tmNormalizeHexColor(row.value, '#000000') || '#000000';
            if (isMobile) {
                const upper = String(raw || '').toUpperCase();
                return `
                    <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;border:1px solid var(--tm-border-color);border-radius:8px;background:var(--tm-bg-color);">
                        <span style="font-size:12px;color:var(--tm-secondary-text);">${esc(row.label)}</span>
                        <button type="button" class="tm-color-btn" data-tm-color-key="${esc(row.key)}" data-tm-color-label="${esc(row.label)}" onclick="tmOpenAppearanceColorPicker(this)">
                            <span class="tm-color-swatch" style="background:${esc(raw)}"></span>
                            <span class="tm-color-text">${esc(upper)}</span>
                        </button>
                    </label>
                `;
            }
            return `
                <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;border:1px solid var(--tm-border-color);border-radius:8px;background:var(--tm-bg-color);">
                    <span style="font-size:12px;color:var(--tm-secondary-text);">${esc(row.label)}</span>
                    <input type="color" value="${esc(raw)}" onchange="tmUpdateAppearanceColor('${esc(row.key)}', this.value)" style="width:44px;height:28px;padding:0;border:none;background:transparent;">
                </label>
            `;
        };

        const cards = items.map((it) => `
            <div style="padding:10px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);">
                <div style="font-weight:600;margin-bottom:10px;">${esc(it.title)}</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
                    ${(it.rows || []).map(renderRow).join('')}
                </div>
            </div>
        `).join('');

        const previewLight = `linear-gradient(135deg, ${esc(__tmNormalizeHexColor(d.topbarGradientLightStart, '#667eea') || '#667eea')} 0%, ${esc(__tmNormalizeHexColor(d.topbarGradientLightEnd, '#764ba2') || '#764ba2')} 100%)`;
        const previewDark = `linear-gradient(135deg, ${esc(__tmNormalizeHexColor(d.topbarGradientDarkStart, '#3b49b7') || '#3b49b7')} 0%, ${esc(__tmNormalizeHexColor(d.topbarGradientDarkEnd, '#5b2d7a') || '#5b2d7a')} 100%)`;

        return `
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:12px;color:var(--tm-secondary-text);">预览(亮色):</span>
                    <div id="tmAppearancePreviewLight" style="width:180px;height:22px;border-radius:8px;background:${previewLight};border:1px solid rgba(0,0,0,0.06);"></div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:12px;color:var(--tm-secondary-text);">预览(夜间):</span>
                    <div id="tmAppearancePreviewDark" style="width:180px;height:22px;border-radius:8px;background:${previewDark};border:1px solid rgba(0,0,0,0.06);"></div>
                </div>
                <div style="flex:1;"></div>
                <button class="tm-btn tm-btn-gray" onclick="tmResetAppearanceColors()" style="padding: 4px 10px; font-size: 12px;">恢复默认</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
                ${cards}
            </div>
            <div style="margin-top:10px;font-size:12px;color:var(--tm-secondary-text);line-height:1.5;">
                按时间分组的分组名称会根据“距离今天的天数”自动变淡，已过期固定使用“已过期颜色”，以保证可读性并适配夜间模式。
            </div>
        `;
    }

    window.tmOpenAppearanceColorPicker = function(el) {
        const btn = el && el.nodeType === 1 ? el : null;
        const k = String(btn?.dataset?.tmColorKey || '').trim();
        const label = String(btn?.dataset?.tmColorLabel || '选择颜色').trim() || '选择颜色';
        if (!k) return;
        const defaults = {
            topbarGradientLightStart: '#667eea',
            topbarGradientLightEnd: '#764ba2',
            topbarGradientDarkStart: '#3b49b7',
            topbarGradientDarkEnd: '#5b2d7a',
            taskContentColorLight: '#333333',
            taskContentColorDark: '#e0e0e0',
            groupDocLabelColorLight: '#333333',
            groupDocLabelColorDark: '#e0e0e0',
            timeGroupBaseColorLight: '#1a73e8',
            timeGroupBaseColorDark: '#6ba5ff',
            timeGroupOverdueColorLight: '#d93025',
            timeGroupOverdueColorDark: '#ff6b6b',
            progressBarColorLight: '#4caf50',
            progressBarColorDark: '#81c784',
            tableBorderColorLight: '#e9ecef',
            tableBorderColorDark: '#333333'
        };
        const initial = __tmNormalizeHexColor(SettingsStore.data[k], defaults[k] || '#f44336') || (defaults[k] || '#f44336');
        __tmOpenColorPickerDialog(label, initial, (next) => {
            tmUpdateAppearanceColor(k, next);
        }, { defaultColor: defaults[k] || '#f44336' });
    };

    window.tmUpdateAppearanceColor = async function(key, value) {
        const allowed = new Set([
            'topbarGradientLightStart', 'topbarGradientLightEnd', 'topbarGradientDarkStart', 'topbarGradientDarkEnd',
            'taskContentColorLight', 'taskContentColorDark',
            'groupDocLabelColorLight', 'groupDocLabelColorDark',
            'timeGroupBaseColorLight', 'timeGroupBaseColorDark',
            'timeGroupOverdueColorLight', 'timeGroupOverdueColorDark',
            'progressBarColorLight', 'progressBarColorDark',
            'tableBorderColorLight', 'tableBorderColorDark'
        ]);
        const k = String(key || '').trim();
        if (!allowed.has(k)) return;
        const v = __tmNormalizeHexColor(value, '');
        if (!v) return;
        SettingsStore.data[k] = v;
        await SettingsStore.save();
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
        try {
            const buttons = Array.from(document.querySelectorAll(`[data-tm-color-key="${k}"]`));
            buttons.forEach((b) => {
                const sw = b.querySelector?.('.tm-color-swatch');
                const tx = b.querySelector?.('.tm-color-text');
                try { if (sw) sw.style.background = v; } catch (e) {}
                try { if (tx) tx.textContent = String(v || '').toUpperCase(); } catch (e) {}
            });
        } catch (e) {}
        try {
            const d = SettingsStore.data || {};
            const p1 = document.getElementById('tmAppearancePreviewLight');
            const p2 = document.getElementById('tmAppearancePreviewDark');
            const previewLight = `linear-gradient(135deg, ${__tmNormalizeHexColor(d.topbarGradientLightStart, '#667eea') || '#667eea'} 0%, ${__tmNormalizeHexColor(d.topbarGradientLightEnd, '#764ba2') || '#764ba2'} 100%)`;
            const previewDark = `linear-gradient(135deg, ${__tmNormalizeHexColor(d.topbarGradientDarkStart, '#3b49b7') || '#3b49b7'} 0%, ${__tmNormalizeHexColor(d.topbarGradientDarkEnd, '#5b2d7a') || '#5b2d7a'} 100%)`;
            if (p1) p1.style.background = previewLight;
            if (p2) p2.style.background = previewDark;
        } catch (e) {}
        render();
    };

    window.tmResetAppearanceColors = async function() {
        SettingsStore.data.topbarGradientLightStart = '#667eea';
        SettingsStore.data.topbarGradientLightEnd = '#764ba2';
        SettingsStore.data.topbarGradientDarkStart = '#3b49b7';
        SettingsStore.data.topbarGradientDarkEnd = '#5b2d7a';
        SettingsStore.data.taskContentColorLight = '#333333';
        SettingsStore.data.taskContentColorDark = '#e0e0e0';
        SettingsStore.data.groupDocLabelColorLight = '#333333';
        SettingsStore.data.groupDocLabelColorDark = '#e0e0e0';
        SettingsStore.data.timeGroupBaseColorLight = '#1a73e8';
        SettingsStore.data.timeGroupBaseColorDark = '#6ba5ff';
        SettingsStore.data.timeGroupOverdueColorLight = '#d93025';
        SettingsStore.data.timeGroupOverdueColorDark = '#ff6b6b';
        SettingsStore.data.progressBarColorLight = '#4caf50';
        SettingsStore.data.progressBarColorDark = '#81c784';
        SettingsStore.data.tableBorderColorLight = '#e9ecef';
        SettingsStore.data.tableBorderColorDark = '#333333';
        await SettingsStore.save();
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
        showSettings();
        render();
    };

    window.toggleColumn = function(key, show) {
        let order = SettingsStore.data.columnOrder || [];
        if (show) {
            if (!order.includes(key)) {
                order.push(key);
            }
        } else {
            order = order.filter(k => k !== key);
        }
        SettingsStore.data.columnOrder = order;
        SettingsStore.save();
        showSettings(); 
        render(); 
    };

    window.moveColumn = function(key, direction) {
        let order = [...(SettingsStore.data.columnOrder || [])];
        const idx = order.indexOf(key);
        if (idx === -1) return;
        
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= order.length) return;
        
        [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
        
        SettingsStore.data.columnOrder = order;
        SettingsStore.save();
        showSettings();
        render();
    };

    // ============ 状态选项管理 ============
    window.renderStatusOptionsList = function() {
        const options = SettingsStore.data.customStatusOptions || [];
        return options.map((opt, index) => `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                <input type="color" value="${opt.color}" onchange="updateStatusOption(${index}, 'color', this.value)" style="width: 24px; height: 24px; border: none; padding: 0; background: none; cursor: pointer;" title="点击修改颜色">
                <input type="text" value="${opt.name}" onchange="updateStatusOption(${index}, 'name', this.value)" style="width: 100px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 13px;" title="修改名称">
                <input type="text" value="${opt.id}" onchange="updateStatusOption(${index}, 'id', this.value)" style="width: 120px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 12px; font-family: monospace;" title="修改ID（将同步更新任务状态）">
                <div style="display: flex; gap: 2px;">
                    <button class="tm-btn" onclick="moveStatusOption(${index}, -1)" ${index === 0 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 11px;">↑</button>
                    <button class="tm-btn" onclick="moveStatusOption(${index}, 1)" ${index === options.length - 1 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 11px;">↓</button>
                </div>
                <button class="tm-btn tm-btn-danger" onclick="deleteStatusOption(${index})" style="padding: 2px 6px; font-size: 11px;">删除</button>
            </div>
        `).join('');
    };

    window.addStatusOption = async function() {
        const id = await showPrompt('添加状态', '请输入状态ID (唯一标识, 如: waiting)', 'waiting_' + Date.now().toString().slice(-4));
        if (!id) return;
        
        const options = SettingsStore.data.customStatusOptions || [];
        if (options.some(o => o.id === id)) {
            hint('ID已存在，请使用其他ID', 'warning');
            return;
        }

        const name = await showPrompt('添加状态', '请输入显示名称', '新状态');
        if (!name) return;
        
        const color = await showPrompt('添加状态', '请输入颜色代码 (如: #FF0000)', '#66ccff');
        if (!color) return;

        options.push({ id, name, color });
        SettingsStore.data.customStatusOptions = options;
        await SettingsStore.save();
        showSettings();
        render();
        try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
    };

    // 绑定添加规则函数
    window.tmAddRule = function() {
        // 创建一个新规则模板
        state.editingRule = {
            id: 'r_' + Date.now(),
            name: '新规则',
            conditions: [{
                id: 'c_' + Date.now(),
                field: 'content',
                operator: 'contains',
                value: ''
            }]
        };
        state.settingsActiveTab = 'rule_editor';
        showSettings();
    };

    // 绑定编辑规则函数
    window.tmEditRule = function(ruleId) {
        const rule = state.filterRules.find(r => r.id === ruleId);
        if (!rule) return;
        
        // 克隆规则对象，避免直接修改
        state.editingRule = JSON.parse(JSON.stringify(rule));
        state.settingsActiveTab = 'rule_editor';
        showSettings();
    };

    // 绑定关闭规则编辑器函数
    window.tmCloseRuleEditor = function() {
        state.editingRule = null;
        state.settingsActiveTab = 'rules';
        showSettings();
    };
    
    // 绑定规则保存函数
    window.tmSaveRule = async function() {
        if (!state.editingRule) return;
        const nameInput = document.getElementById('tmRuleName');
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
            hint('请输入规则名称', 'warning');
            return;
        }
        
        // 获取所有条件
        const conditionRows = document.querySelectorAll('.tm-rule-condition-row');
        const conditions = [];
        conditionRows.forEach(row => {
            const field = row.querySelector('.tm-rule-field').value;
            const operator = row.querySelector('.tm-rule-operator').value;
            let value = '';
            
            // 根据字段类型获取值
            if (field === 'priority' || field === 'customStatus') {
                // 多选
                const checkboxes = row.querySelectorAll('input[type="checkbox"]:checked');
                const values = Array.from(checkboxes).map(cb => cb.value);
                if (values.length > 0) value = values;
            } else if (field === 'done') {
                value = row.querySelector('.tm-rule-value').value;
            } else {
                value = row.querySelector('.tm-rule-value').value;
            }
            
            // 简单校验
            if (value === '' || (Array.isArray(value) && value.length === 0)) return;
            
            conditions.push({
                id: 'c_' + Date.now() + Math.random().toString(36).slice(2),
                field,
                operator,
                value
            });
        });
        
        // 更新规则
        state.editingRule.name = name;
        state.editingRule.conditions = conditions;
        
        // 如果是新规则，添加到列表
        const existing = state.filterRules.find(r => r.id === state.editingRule.id);
        if (!existing) {
            state.filterRules.push(state.editingRule);
        } else {
            // 更新现有规则（对象引用已更新，只需确保在列表中）
            const idx = state.filterRules.findIndex(r => r.id === state.editingRule.id);
            if (idx !== -1) state.filterRules[idx] = state.editingRule;
        }
        
        // 保存到设置
        SettingsStore.data.filterRules = state.filterRules;
        await SettingsStore.save();
        
        // 关闭编辑器并刷新
        tmCloseRuleEditor();
        showSettings();
        render(); // 如果当前应用了该规则，需要刷新主界面
    };

    function __tmRemapStatusId(oldId, newId) {
        if (!oldId || !newId || oldId === newId) return;

        // 更新当前内存中的任务状态
        try {
            Object.values(state.flatTasks || {}).forEach(t => {
                if (t && t.customStatus === oldId) t.customStatus = newId;
            });
        } catch (e) {}

        // 更新 MetaStore 中的状态值
        try {
            if (MetaStore?.data && typeof MetaStore.data === 'object') {
                Object.keys(MetaStore.data).forEach(taskId => {
                    const meta = MetaStore.data[taskId];
                    if (meta && meta.customStatus === oldId) {
                        MetaStore.data[taskId] = { ...meta, customStatus: newId };
                    }
                });
                if (typeof MetaStore.scheduleSave === 'function') MetaStore.scheduleSave();
            }
        } catch (e) {}

        // 更新规则里引用的状态值
        const patchRules = (rules) => {
            if (!Array.isArray(rules)) return;
            rules.forEach(rule => {
                if (!Array.isArray(rule.conditions)) return;
                rule.conditions.forEach(c => {
                    if (c?.field !== 'customStatus') return;
                    if (Array.isArray(c.value)) {
                        c.value = c.value.map(v => (v === oldId ? newId : v));
                    } else if (c.value === oldId) {
                        c.value = newId;
                    }
                });
            });
        };
        try {
            patchRules(state.filterRules);
            patchRules(SettingsStore.data.filterRules);
        } catch (e) {}
    }

    window.updateStatusOption = async function(index, field, value) {
        const options = SettingsStore.data.customStatusOptions || [];
        if (!options[index]) return;

        if (field === 'id') {
            const nextId = String(value || '').trim();
            if (!nextId) {
                hint('ID 不能为空', 'warning');
                showSettings();
                return;
            }
            if (options.some((o, i) => i !== index && o.id === nextId)) {
                hint('ID 已存在，请使用其他ID', 'warning');
                showSettings();
                return;
            }
            const prevId = options[index].id;
            options[index].id = nextId;
            SettingsStore.data.customStatusOptions = options;
            __tmRemapStatusId(prevId, nextId);
            await SettingsStore.save();
            showSettings();
            render();
            try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
            try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
            return;
        }

        options[index][field] = value;
        SettingsStore.data.customStatusOptions = options;
        await SettingsStore.save();
        // 不刷新整个界面，以免输入焦点丢失
        render(); // 刷新主界面
        try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
    };

    window.moveStatusOption = async function(index, direction) {
        const options = [...(SettingsStore.data.customStatusOptions || [])];
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= options.length) return;
        [options[index], options[newIndex]] = [options[newIndex], options[index]];
        SettingsStore.data.customStatusOptions = options;
        await SettingsStore.save();
        showSettings();
        render();
        try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
    };

    window.deleteStatusOption = async function(index) {
        const ok = await showConfirm('删除状态', '确定删除此状态吗？');
        if (!ok) return;
        const options = SettingsStore.data.customStatusOptions || [];
        options.splice(index, 1);
        SettingsStore.data.customStatusOptions = options;
        await SettingsStore.save();
        showSettings(); // 刷新界面
        render(); // 刷新主界面
        try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
    };

    // 更新列宽度
    window.updateColumnWidth = function(column, width) {
        if (!state.columnWidths) state.columnWidths = {};
        state.columnWidths[column] = width;
        SettingsStore.data.columnWidths = state.columnWidths;
        SettingsStore.save();
        render();
        // 更新设置界面的显示
        if (state.settingsModal) {
            const widthSettings = state.settingsModal.querySelector('.tm-width-settings');
            if (widthSettings) {
                widthSettings.innerHTML = renderColumnWidthSettings();
            }
        }
    };

    // 新增：切换分组
    window.switchDocGroup = async function(groupId) {
        await SettingsStore.updateCurrentGroupId(groupId);
        const firstRuleId = (state.filterRules || []).find(r => r && r.enabled)?.id || '';
        state.currentRule = firstRuleId || null;
        SettingsStore.data.currentRule = firstRuleId || null;
        await SettingsStore.save();
        showSettings();
    };

    // 新增：创建分组
    window.createNewGroup = async function() {
        const name = await showPrompt('新建分组', '请输入分组名称', '新分组');
        if (!name) return;
        
        const newGroup = {
            id: 'g_' + Date.now(),
            name: name,
            docs: []
        };
        
        const groups = SettingsStore.data.docGroups || [];
        groups.push(newGroup);
        await SettingsStore.updateDocGroups(groups);
        await SettingsStore.updateCurrentGroupId(newGroup.id);
        showSettings();
    };

    // 新增：删除当前分组
    window.deleteCurrentGroup = async function() {
        if (!confirm('确定要删除当前分组吗？')) return;
        
        const currentId = SettingsStore.data.currentGroupId;
        let groups = SettingsStore.data.docGroups || [];
        groups = groups.filter(g => g.id !== currentId);
        
        await SettingsStore.updateDocGroups(groups);
        await SettingsStore.updateCurrentGroupId('all');
        showSettings();
    };

    // 新增：清空当前分组文档
    window.clearCurrentGroupDocs = async function() {
        if (!confirm('确定要清空当前分组的所有文档吗？')) return;
        
        const currentId = SettingsStore.data.currentGroupId;
        if (currentId === 'all') return;
        
        const groups = SettingsStore.data.docGroups || [];
        const group = groups.find(g => g.id === currentId);
        if (group) {
            group.docs = [];
            await SettingsStore.updateDocGroups(groups);
            showSettings();
        }
    };

    // 新增：从分组移除文档
    window.removeDocFromGroup = async function(index) {
        const currentId = SettingsStore.data.currentGroupId;
        if (currentId === 'all') return;
        
        const groups = SettingsStore.data.docGroups || [];
        const group = groups.find(g => g.id === currentId);
        if (group && group.docs) {
            group.docs.splice(index, 1);
            await SettingsStore.updateDocGroups(groups);
            showSettings();
        }
    };

    window.removeDocFromAll = async function(docId) {
        const id = String(docId || '').trim();
        if (!id) return;

        let changed = false;

        try {
            const legacy = Array.isArray(SettingsStore.data.selectedDocIds) ? SettingsStore.data.selectedDocIds : [];
            const nextLegacy = legacy.filter(x => String(x) !== id);
            if (nextLegacy.length !== legacy.length) {
                SettingsStore.data.selectedDocIds = nextLegacy;
                changed = true;
            }
        } catch (e) {}

        try {
            const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
            let groupsChanged = false;
            groups.forEach(g => {
                if (!g || !Array.isArray(g.docs)) return;
                const before = g.docs.length;
                g.docs = g.docs.filter(d => String((typeof d === 'object' ? d?.id : d) || '') !== id);
                if (g.docs.length !== before) groupsChanged = true;
            });
            if (groupsChanged) {
                SettingsStore.data.docGroups = groups;
                changed = true;
            }
        } catch (e) {}

        if (!changed) {
            hint('⚠ 未找到该文档', 'warning');
            return;
        }

        await SettingsStore.save();
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        showSettings();
    };

    // 手动添加文档ID（增强版）
    window.addManualDoc = async function() {
        const input = document.getElementById('manualDocId');
        const recursiveCheck = document.getElementById('recursiveCheck');
        const docId = input.value.trim();
        const isRecursive = recursiveCheck ? recursiveCheck.checked : false;

        if (!docId) {
            hint('⚠ 请输入文档ID', 'warning');
            return;
        }

        // 验证ID格式（思源笔记ID格式：数字-字母数字组合）
        if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(docId)) {
            hint('⚠ 文档ID格式不正确，格式应为：数字-字母数字组合', 'warning');
            return;
        }

        const currentGroupId = SettingsStore.data.currentGroupId || 'all';
        
        if (currentGroupId === 'all') {
            // 添加到旧版列表（不支持递归标志，或者我们需要升级旧版列表结构）
            // 为了兼容，我们在 "全部" 模式下只操作 selectedDocIds
            if (isRecursive) {
                hint('⚠ "全部文档"模式下不支持递归选项，请先创建或选择一个分组', 'warning');
                return;
            }
            if (SettingsStore.data.selectedDocIds.includes(docId)) {
                hint('⚠ 该文档已被添加', 'warning');
                return;
            }
            await SettingsStore.addDocId(docId);
        } else {
            // 添加到当前分组
            const groups = SettingsStore.data.docGroups || [];
            const group = groups.find(g => g.id === currentGroupId);
            if (group) {
                if (!group.docs) group.docs = [];
                // 检查重复
                if (group.docs.some(d => d.id === docId)) {
                    hint('⚠ 该文档已在当前分组中', 'warning');
                    return;
                }
                group.docs.push({ id: docId, recursive: isRecursive });
                await SettingsStore.updateDocGroups(groups);
            }
        }

        // 尝试获取文档名称
        fetchDocName(docId).then(docName => {
            if (docName) {
                state.allDocuments.push({ id: docId, name: docName, path: '', taskCount: 0 });
            }
            showSettings(); // 重新渲染设置界面
        });

        input.value = '';
        if (recursiveCheck) recursiveCheck.checked = false;
        hint('✅ 已添加文档', 'success');
    };

    // 根据ID获取文档名称
    async function fetchDocName(docId) {
        try {
            const sql = `SELECT content, hpath FROM blocks WHERE id = '${docId}' AND type = 'd'`;
            const res = await API.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                return res.data[0].content || '未命名文档';
            }
        } catch (e) {
        }
        return null;
    }

    // 根据索引移除文档
    window.removeDocByIndex = async function(index) {
        await SettingsStore.removeDocId(index);
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        showSettings(); // 重新渲染设置界面
    };

    // 清空所有文档
    window.clearAllDocs = async function() {
        if (!confirm('确定要清空所有已选文档吗？')) return;
        await SettingsStore.clearDocIds();
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        showSettings(); // 重新渲染设置界面
    };

    window.updateQueryLimit = async function(value) {
        state.queryLimit = parseInt(value) || 500;
        SettingsStore.data.queryLimit = state.queryLimit;
        await SettingsStore.save();
    };

    window.updateEnableQuickbar = async function(enabled) {
        SettingsStore.data.enableQuickbar = !!enabled;
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarToggle?.(!!enabled); } catch (e) {}
        showSettings();
    };

    window.updateEnableTomatoIntegration = async function(enabled) {
        SettingsStore.data.enableTomatoIntegration = !!enabled;
        await SettingsStore.save();
        if (!enabled) state.timerFocusTaskId = '';
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { render(); } catch (e) {}
        }
    };

    window.updateTomatoSpentAttrMode = async function(mode) {
        const v = String(mode || '').trim();
        SettingsStore.data.tomatoSpentAttrMode = (v === 'hours') ? 'hours' : 'minutes';
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateTomatoSpentAttrKeyMinutes = async function(value) {
        SettingsStore.data.tomatoSpentAttrKeyMinutes = String(value || '').trim();
        await SettingsStore.save();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateTomatoSpentAttrKeyHours = async function(value) {
        SettingsStore.data.tomatoSpentAttrKeyHours = String(value || '').trim();
        await SettingsStore.save();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateExcludeCompletedTasks = async function(enabled) {
        SettingsStore.data.excludeCompletedTasks = !!enabled;
        await SettingsStore.save();
        state.excludeCompletedTasks = !!enabled;
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateDurationFormat = async function(format) {
        const v = String(format || '').trim();
        SettingsStore.data.durationFormat = (v === 'minutes') ? 'minutes' : 'hours';
        state.durationFormat = SettingsStore.data.durationFormat;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            render();
        }
    };

    window.updatePinNewTasksByDefault = async function(enabled) {
        SettingsStore.data.pinNewTasksByDefault = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateNewTaskDocId = async function(value, options) {
        const v = String(value || '').trim();
        SettingsStore.data.newTaskDocId = v;
        await SettingsStore.save();
        const opt = (options && typeof options === 'object') ? options : {};
        if (opt.refreshQuickAdd !== false) {
            const qa = state.quickAdd;
            if (qa) {
                if (v === '__dailyNote__') {
                    qa.docMode = 'dailyNote';
                    qa.docId = qa.docId || __tmResolveDefaultDocId();
                } else {
                    qa.docMode = 'doc';
                    qa.docId = v || __tmResolveDefaultDocId();
                }
                try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
            }
        }
        if (opt.refreshPicker !== false) {
            if (state.quickAddDocPicker) {
                try { window.tmQuickAddOpenDocPicker?.(); } catch (e) {}
            }
        }
    };

    window.updateNewTaskDocIdFromSelect = async function(value) {
        await updateNewTaskDocId(value);
        try {
            const input = document.getElementById('tmNewTaskDocIdInput');
            const v = String(value || '').trim();
            if (input) input.value = v === '__dailyNote__' ? '' : v;
        } catch (e) {}
    };

    window.tmApplyNewTaskDocIdInput = async function() {
        const input = document.getElementById('tmNewTaskDocIdInput');
        const v = String(input?.value || '').trim();
        await updateNewTaskDocId(v);
        showSettings();
    };

    window.tmClearNewTaskDocIdInput = async function() {
        await updateNewTaskDocId('');
        showSettings();
    };

    window.updateDefaultDocId = async function(value) {
        const v = String(value || '').trim();
        const groupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (groupId === 'all') {
            SettingsStore.data.defaultDocId = v;
        } else {
            const map = (SettingsStore.data.defaultDocIdByGroup && typeof SettingsStore.data.defaultDocIdByGroup === 'object')
                ? { ...SettingsStore.data.defaultDocIdByGroup }
                : {};
            map[groupId] = v;
            SettingsStore.data.defaultDocIdByGroup = map;
        }
        await SettingsStore.save();
    };

    window.updateDefaultDocIdFromSelect = async function(value) {
        await updateDefaultDocId(value);
        try {
            const input = document.getElementById('tmDefaultDocIdInput');
            if (input) input.value = String(value || '').trim();
        } catch (e) {}
    };

    window.tmApplyDefaultDocIdInput = async function() {
        const input = document.getElementById('tmDefaultDocIdInput');
        const v = String(input?.value || '').trim();
        await updateDefaultDocId(v);
        hint(v ? '✅ 默认文档ID已更新' : '✅ 默认文档已清空', 'success');
        showSettings();
    };

    window.tmClearDefaultDocIdInput = async function() {
        const input = document.getElementById('tmDefaultDocIdInput');
        if (input) input.value = '';
        await updateDefaultDocId('');
        hint('✅ 默认文档已清空', 'success');
        showSettings();
    };

    window.toggleGroupByTime = async function(checked) {
        state.groupByTime = !!checked;
        if (state.groupByTime) {
            state.groupByDocName = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = true;
            SettingsStore.data.groupMode = 'time';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        } else {
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupMode = 'none';
        }
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        applyFilters();
        render();
    };

    window.toggleGroupByDocName = async function(checked) {
        state.groupByDocName = !!checked;
        if (state.groupByDocName) {
            state.groupByTime = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupByDocName = true;
            SettingsStore.data.groupMode = 'doc';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        } else {
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupMode = 'none';
        }
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        applyFilters();
        render();
    };

    window.toggleQuadrantGroup = async function(checked) {
        state.quadrantEnabled = !!checked;
        if (state.quadrantEnabled) {
            state.groupByDocName = false;
            state.groupByTime = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupMode = 'quadrant';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = true;
        } else {
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
            SettingsStore.data.groupMode = 'none';
        }
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        applyFilters();
        render();
    };

    window.tmSwitchGroupMode = async function(mode) {
        const m = String(mode || '').trim();
        if (m === 'doc') return toggleGroupByDocName(true);
        if (m === 'time') return toggleGroupByTime(true);
        if (m === 'quadrant') return toggleQuadrantGroup(true);
        SettingsStore.data.groupByDocName = false;
        SettingsStore.data.groupByTime = false;
        SettingsStore.data.groupMode = 'none';
        SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
        SettingsStore.data.quadrantConfig.enabled = false;
        state.groupByDocName = false;
        state.groupByTime = false;
        state.quadrantEnabled = false;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        applyFilters();
        render();
    };

    window.tmToggleGroupCollapse = async function(groupKey, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        
        if (state.collapsedGroups.has(groupKey)) state.collapsedGroups.delete(groupKey);
        else state.collapsedGroups.add(groupKey);

        SettingsStore.data.collapsedGroups = [...state.collapsedGroups];
        // 直接同步到本地存储，不等待云端同步，避免延迟
        try { Storage.set('tm_collapsed_groups', SettingsStore.data.collapsedGroups); } catch (e) {}
        render();
    };

    window.tmToggleCollapse = async function(id, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const key = String(id || '');
        if (!key) return;
        if (state.collapsedTaskIds.has(key)) state.collapsedTaskIds.delete(key);
        else state.collapsedTaskIds.add(key);

        // 直接同步到本地存储，不等待云端同步，避免延迟
        SettingsStore.data.collapsedTaskIds = [...state.collapsedTaskIds];
        try { Storage.set('tm_collapsed_task_ids', SettingsStore.data.collapsedTaskIds); } catch (e) {}
        render();
    };

    window.tmCollapseAllTasks = async function() {
        const filteredSet = new Set(state.filteredTasks.map(t => t.id));
        const next = new Set(state.collapsedTaskIds || []);
        const applyCollapse = (list) => {
            list.forEach(t => {
                const hasVisibleChild = (t.children || []).some(c => filteredSet.has(c.id));
                if (filteredSet.has(t.id) && hasVisibleChild) {
                    next.add(String(t.id));
                }
                if (t.children && t.children.length > 0) applyCollapse(t.children);
            });
        };
        state.taskTree.forEach(doc => {
            if (state.activeDocId !== 'all' && doc.id !== state.activeDocId) return;
            applyCollapse(doc.tasks || []);
        });
        state.collapsedTaskIds = next;
        SettingsStore.data.collapsedTaskIds = [...next];
        await SettingsStore.save();
        render();
    };

    window.tmExpandAllTasks = async function() {
        state.collapsedTaskIds = new Set();
        SettingsStore.data.collapsedTaskIds = [];
        await SettingsStore.save();
        render();
    };

    window.closeSettings = function() {
        if (state.settingsModal) {
            state.settingsModal.remove();
            state.settingsModal = null;
        }
    };

    window.saveSettings = async function() {
        // 同步到 SettingsStore 并保存到本地插件存储
        SettingsStore.data.selectedDocIds = state.selectedDocIds;
        SettingsStore.data.queryLimit = state.queryLimit;
        SettingsStore.data.showCompletionTime = state.showCompletionTime;
        SettingsStore.data.groupByDocName = state.groupByDocName;
        SettingsStore.data.groupByTime = state.groupByTime;
        await SettingsStore.save();
        hint('✅ 设置已保存', 'success');
        render();
        closeSettings();
    };

    // 全局点击监听器，用于点击窗口外关闭
    __tmGlobalClickHandler = (e) => {
        // 关闭主模态框
        if (state.modal && e.target === state.modal) {
            tmClose();
        }
        // 关闭设置模态框
        if (state.settingsModal && e.target === state.settingsModal) {
            closeSettings();
        }
        // 关闭规则管理模态框
        if (state.rulesModal && e.target === state.rulesModal) {
            closeRulesManager();
        }
        // 关闭提示框
        const promptModal = document.querySelector('.tm-prompt-modal');
        if (promptModal && e.target === promptModal) {
            // 取消操作
            promptModal.remove();
            if (window._tmPromptResolve) {
                window._tmPromptResolve(null);
                window._tmPromptResolve = null;
            }
        }
    };
    window.addEventListener('click', __tmGlobalClickHandler);

    // 初始化
    /**
     * 在移动端面包屑栏右上角添加任务管理按钮
     * 支持多窗口（分屏）
     */
    let breadcrumbTimer = null;
    let breadcrumbTries = 0;
    function addBreadcrumbButton() {
        if (breadcrumbTimer != null) return;

        const scheduleTry = (delayMs) => {
            if (breadcrumbTimer != null) return;
            const d = Math.max(0, Number(delayMs) || 0);
            breadcrumbTimer = setTimeout(() => {
                breadcrumbTimer = null;
                tryAddButton();
            }, d);
        };

        const tryAddButton = () => {
            const breadcrumbs = document.querySelectorAll('.protyle-breadcrumb');
            if (breadcrumbs.length === 0) {
                breadcrumbTries += 1;
                if (breadcrumbTries <= 60) scheduleTry(500);
                return;
            }

            breadcrumbs.forEach(breadcrumb => {
                // 检查该面包屑下是否已存在按钮
                if (breadcrumb.querySelector('.tm-breadcrumb-btn')) return;

                // 创建任务管理按钮
                const tmBtn = document.createElement('button');
                tmBtn.className = 'tm-breadcrumb-btn'; // 使用 class 标识
                tmBtn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;line-height:0"><svg viewBox="0 0 24 24" width="14" height="14" style="display:block;fill:none;flex:0 0 auto;transform:translateY(1px)"><use xlink:href="#iconTaskHorizon"></use></svg></span>';
                tmBtn.title = '打开任务管理器';
                tmBtn.style.cssText = `
                    width: 28px;
                    height: 28px;
                    padding: 0 !important;
                    margin: 0 4px;
                    background: transparent;
                    color: var(--b3-theme-on-surface, inherit);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0;
                    line-height: 0;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    text-align: center !important;
                    flex-shrink: 0;
                    transition: all 0.2s;
                    z-index: 10;
                `;

                tmBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (tmBtn.__tmLongPressFired) {
                        tmBtn.__tmLongPressFired = false;
                        return;
                    }
                    try { window.tmQuickAddOpen?.(); } catch (e2) {}
                };

                try {
                    let pressTimer = null;
                    const startHandler = (e) => {
                        tmBtn.__tmLongPressFired = false;
                        if (pressTimer) clearTimeout(pressTimer);
                        pressTimer = setTimeout(() => {
                            tmBtn.__tmLongPressFired = true;
                            try { openManager(); } catch (e) {}
                        }, 450);
                    };
                    const cancelHandler = () => {
                        if (pressTimer) clearTimeout(pressTimer);
                        pressTimer = null;
                    };
                    const endHandler = (e) => {
                        if (pressTimer) clearTimeout(pressTimer);
                        pressTimer = null;
                        if (tmBtn.__tmLongPressFired) {
                            try { e.preventDefault(); } catch (e2) {}
                            try { e.stopPropagation(); } catch (e2) {}
                        }
                    };

                    tmBtn.addEventListener('touchstart', startHandler, { passive: true });
                    tmBtn.addEventListener('touchmove', cancelHandler, { passive: true });
                    tmBtn.addEventListener('touchend', endHandler, { passive: false });
                    
                    tmBtn.addEventListener('mousedown', startHandler);
                    tmBtn.addEventListener('mouseleave', cancelHandler);
                    tmBtn.addEventListener('mouseup', endHandler);
                } catch (e) {}

                breadcrumb.appendChild(tmBtn);
            });
            
            breadcrumbTries = 0;
        };

        // 延迟执行
        scheduleTry(0);
    }

    /**
     * 注册顶栏图标
     */
    function __tmSetUseIcon(root, iconId) {
        if (!root) return false;
        const use = root.querySelector?.('use');
        if (!use) return false;
        const href = `#${iconId}`;
        try { use.setAttribute('href', href); } catch (e) {}
        try { use.setAttribute('xlink:href', href); } catch (e) {}
        try { use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href); } catch (e) {}
        return true;
    }

    function __tmPatchTaskHorizonTabIcon() {
        const iconId = 'iconTaskHorizon';
        const tabId = globalThis.__taskHorizonCustomTabId;
        const uses = Array.from(document.querySelectorAll('use[href], use[xlink\\:href]'));
        let ok = false;
        for (const use of uses) {
            try {
                const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
                if (!href.includes('iconList') && !href.includes(iconId)) continue;
                const owner = tabId
                    ? (use.closest?.(`[data-id="${tabId}"], [data-key="${tabId}"]`) || use.closest?.('[data-id], [data-key], li, button, div'))
                    : (use.closest?.('[data-id], [data-key], li, button, div'));
                if (!owner) continue;
                if ((tabId && (owner.getAttribute?.('data-id') === tabId || owner.getAttribute?.('data-key') === tabId)) || String(owner.textContent || '').includes('任务管理器')) {
                    const root = owner.closest?.(`[data-id="${tabId}"], [data-key="${tabId}"]`) || owner;
                    if (__tmSetUseIcon(root, iconId)) ok = true;
                }
            } catch (e) {}
        }
        return ok;
    }

    function __tmFocusExistingTaskHorizonTab() {
        try {
            const tabId = globalThis.__taskHorizonCustomTabId;
            if (!tabId) return false;
            try {
                const tab = __tmFindExistingTaskManagerTab?.();
                if (tab && window.siyuan?.layout?.centerLayout?.switchTab) {
                    window.siyuan.layout.centerLayout.switchTab(tab);
                    return true;
                }
            } catch (e) {}

            const els = Array.from(document.querySelectorAll(`[data-id="${tabId}"], [data-key="${tabId}"]`));
            if (els.length === 0) return false;
            const el = els.find(x => x && x.querySelector && x.querySelector('.tm-tab-root')) || els[0];
            try {
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            } catch (e) {
                try { el.click(); } catch (e2) {}
            }
            return true;
        } catch (e) {}
        return false;
    }

    let __tmEnsureTabPromise = null;

    function __tmBindTopBarClickCapture(topBarEl) {
        const el = topBarEl || __tmTopBarEl;
        if (!el) return;
        if (__tmTopBarEl && __tmTopBarEl !== el && __tmTopBarClickCaptureHandler) {
            try { __tmTopBarEl.removeEventListener('click', __tmTopBarClickCaptureHandler, true); } catch (e) {}
        }
        __tmTopBarEl = el;
        if (__tmTopBarClickCaptureHandler) return;
        __tmTopBarClickCaptureHandler = (e) => {
            if (__tmTopBarClickInFlight) return;
            __tmTopBarClickInFlight = true;
            try {
                try { e.preventDefault?.(); } catch (e2) {}
                try { e.stopImmediatePropagation?.(); } catch (e2) {}
                try { e.stopPropagation?.(); } catch (e2) {}
                try { openManager(); } catch (e2) {}
            } finally {
                setTimeout(() => { __tmTopBarClickInFlight = false; }, 0);
            }
        };
        try { el.addEventListener('click', __tmTopBarClickCaptureHandler, true); } catch (e) {}
    }

    function addTopBarIcon() {
        if (__tmTopBarAdded) {
            try {
                const exists = document.querySelector('[aria-label="任务管理器"], [aria-label="任务管理"]');
                if (exists) __tmBindTopBarClickCapture(exists);
            } catch (e) {}
            return;
        }
        if (__tmIsMobileDevice()) return;
        // 尝试通过全局插件实例添加
        const pluginInstance = globalThis.__taskHorizonPluginInstance || globalThis.__tomatoPluginInstance;
        if (pluginInstance && typeof pluginInstance.addTopBar === 'function') {
            // 检查是否已添加（避免重复）
            // addTopBar 通常由插件管理，我们这里只是尝试调用
            // 如果已经添加过，思源可能会处理，或者我们可以检查 DOM
            // 但是 addTopBar 没有 ID 参数，不好检查。
            // 我们可以检查 aria-label 或 title
            const exists = document.querySelector('[aria-label="任务管理器"], [aria-label="任务管理"]');
            if (exists) {
                __tmSetUseIcon(exists, 'iconTaskHorizon');
                try { __tmBindTopBarClickCapture(exists); } catch (e) {}
                __tmTopBarAdded = true;
                return;
            }

            const topBarEl = pluginInstance.addTopBar({
                icon: "iconTaskHorizon",
                title: "任务管理器",
                position: "right",
                callback: () => {}
            });
            try { __tmBindTopBarClickCapture(topBarEl || document.querySelector('[aria-label="任务管理器"], [aria-label="任务管理"]')); } catch (e) {}
            __tmTopBarAdded = true;
            setTimeout(() => { try { __tmSetUseIcon(document.querySelector('[aria-label="任务管理器"], [aria-label="任务管理"]'), 'iconTaskHorizon'); } catch (e) {} }, 0);
        } else {
        }
    }

    function __tmFindExistingTaskHorizonCustomModel() {
        const tabType = String(globalThis.__taskHorizonTabType || 'task-horizon');
        const tabId = String(globalThis.__taskHorizonCustomTabId || '');
        try {
            const inst = globalThis.__taskHorizonPluginInstance;
            if (inst && typeof inst.getOpenedTab === 'function') {
                const opened = inst.getOpenedTab();
                if (opened && typeof opened === 'object') {
                    const customs = [];
                    Object.values(opened).forEach((arr) => {
                        if (Array.isArray(arr)) arr.forEach((c) => customs.push(c));
                    });
                    for (const c of customs) {
                        if (!c) continue;
                        if (c.type === tabType) return c;
                        if (tabId && c?.tab?.id === tabId) return c;
                        if (c.tab?.title === '任务管理器' || c.title === '任务管理器') return c;
                        if (__tmMountEl && c.element && c.element.contains(__tmMountEl)) return c;
                    }
                }
            }
        } catch (e) {}
        try {
            if (window.siyuan && typeof window.siyuan.getAllModels === 'function') {
                const models = window.siyuan.getAllModels();
                const list = Array.isArray(models?.custom) ? models.custom : [];
                for (const c of list) {
                    if (!c) continue;
                    if (c.type === tabType) return c;
                    if (tabId && c?.tab?.id === tabId) return c;
                    if (c.tab?.title === '任务管理器' || c.title === '任务管理器') return c;
                    if (__tmMountEl && c.element && c.element.contains(__tmMountEl)) return c;
                }
            }
        } catch (e) {}
        return null;
    }

    /**
     * 监听面包屑栏变化
     */
    function observeBreadcrumb() {
        // 先尝试添加一次
        addBreadcrumbButton();
        if (!__tmIsMobileDevice()) {
            addTopBarIcon();
        }

        // 使用 MutationObserver 监听面包屑栏变化
        if (__tmBreadcrumbObserver) {
            try { __tmBreadcrumbObserver.disconnect(); } catch (e) {}
            __tmBreadcrumbObserver = null;
        }
        const observer = new MutationObserver(() => {
            addBreadcrumbButton();
        });

        // 监听整个文档的子节点变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        __tmBreadcrumbObserver = observer;
        
        // 额外监听顶栏图标注入（如果插件实例加载较晚）
        if (!__tmIsMobileDevice()) __tmTopBarTimer = setTimeout(addTopBarIcon, 1000);
    }

    async function init() {
        try { __tmBindWakeReload(); } catch (e) {}

        // 1. 先加载设置（包括文档ID）
        try {
            await SettingsStore.load();

            // 初始化状态
            state.selectedDocIds = SettingsStore.data.selectedDocIds;
            state.queryLimit = SettingsStore.data.queryLimit;
            const gm0 = String(SettingsStore.data.groupMode || '').trim();
            if (gm0 === 'doc') {
                state.groupByDocName = true;
                state.groupByTime = false;
                state.quadrantEnabled = false;
            } else if (gm0 === 'time') {
                state.groupByDocName = false;
                state.groupByTime = true;
                state.quadrantEnabled = false;
            } else if (gm0 === 'quadrant') {
                state.groupByDocName = false;
                state.groupByTime = false;
                state.quadrantEnabled = true;
            } else if (gm0 === 'none') {
                state.groupByDocName = false;
                state.groupByTime = false;
                state.quadrantEnabled = false;
            } else {
                state.groupByDocName = SettingsStore.data.groupByDocName;
                state.groupByTime = SettingsStore.data.groupByTime;
                state.quadrantEnabled = SettingsStore.data.quadrantConfig?.enabled || false;
            }
            state.collapsedTaskIds = new Set(SettingsStore.data.collapsedTaskIds || []);
            state.collapsedGroups = new Set(SettingsStore.data.collapsedGroups || []);
            state.currentRule = SettingsStore.data.currentRule;
            state.columnWidths = SettingsStore.data.columnWidths;
            state.docTabsHidden = !!Storage.get('tm_doc_tabs_hidden', false);

            // 加载筛选规则
            state.filterRules = await RuleManager.initRules();
        } catch (e) {
            console.error('[初始化] 加载设置失败:', e);
        }

        try {
            if (__tmThemeModeObserver) {
                __tmThemeModeObserver.disconnect();
                __tmThemeModeObserver = null;
            }
            __tmThemeModeObserver = new MutationObserver(() => {
                try { __tmApplyAppearanceThemeVars(); } catch (e) {}
                try { if (state.modal) render(); } catch (e) {}
            });
            __tmThemeModeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-mode'] });
        } catch (e) {}
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}

        // 2. 获取所有文档列表
        try {
            state.allDocuments = await API.getAllDocuments();
        } catch (e) {
            console.error('[初始化] 加载文档列表失败:', e);
        }

        // 3. 创建浮动按钮 (已禁用)
        /*
        const fab = document.createElement('button');
        fab.className = 'tm-fab';
        fab.innerHTML = '📋 任务管理';
        fab.onclick = openManager;
        document.body.appendChild(fab);

        // 显示已选文档数量
        if (state.selectedDocIds.length > 0) {
            fab.title = `任务管理 (已选 ${state.selectedDocIds.length} 个文档)`;
        }
        */

        // 启动面包屑按钮观察者
        observeBreadcrumb();
    }

    async function __tmEnsureTabOpened(maxWaitMs = 1500) {
        if (typeof globalThis.__taskHorizonOpenTabView !== 'function') return;
        try {
            if (window.siyuan?.config?.isMobile) return;
        } catch (e) {}
        if (__tmIsMobileDevice()) return;
        __tmEnsureMount();
        // Removed aggressive openTabView call if mount exists, relying on findExistingModel logic instead
        
        try {
            const custom = __tmFindExistingTaskHorizonCustomModel();
            if (custom) {
                try {
                    const tab = custom.tab || custom;
                    if (tab && window.siyuan?.layout?.centerLayout?.switchTab) {
                        window.siyuan.layout.centerLayout.switchTab(tab);
                    } else if (tab?.headElement?.click) {
                        tab.headElement.click();
                    }
                } catch (e2) {}
                try {
                    const el = custom.element;
                    if (el && document.body.contains(el)) {
                        try { globalThis.__taskHorizonTabElement = el; } catch (e3) {}
                        __tmSetMount(el);
                    }
                } catch (e2) {}
                return;
            }
        } catch (e) {}
        try {
            const existingTab = __tmFindExistingTaskManagerTab?.();
            if (existingTab) {
                try { __tmSwitchToTab(existingTab); } catch (e) {}
                try {
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                } catch (e) {}
                __tmEnsureMount();
                if (__tmMountEl && document.body.contains(__tmMountEl)) return;
                const best = __tmFindBestTabRoot?.();
                if (best && document.body.contains(best)) {
                    try { globalThis.__taskHorizonTabElement = best; } catch (e) {}
                    __tmSetMount(best);
                }
                return;
            }
        } catch (e) {}
        
        // 尝试查找并点击标签页标题 (Fallback)
        try {
            const headers = document.querySelectorAll('.layout-tab-bar__item');
            for (const h of headers) {
                if ((h.innerText && h.innerText.includes('任务管理器')) || h.querySelector('[aria-label="任务管理器"]')) {
                    h.click();
                    
                    // 轮询等待内容加载 (最多 2 秒)
                    const start = Date.now();
                    while (Date.now() - start < 2000) {
                        await new Promise(r => setTimeout(r, 100));
                        __tmEnsureMount();
                        if (__tmMountEl && document.body.contains(__tmMountEl)) {
                            try { globalThis.__taskHorizonTabElement = __tmMountEl; } catch (e) {}
                            return;
                        }
                    }
                    // 即使超时，只要找到了 header，我们也认为不需要新建，避免重复
                    return;
                }
            }
        } catch(e) {}

        if (__tmEnsureTabPromise) return __tmEnsureTabPromise;
        __tmEnsureTabPromise = (async () => {
            try {
                try { globalThis.__taskHorizonOpenTabView(); } catch (e) {}
                const start = Date.now();
                while (!globalThis.__taskHorizonTabElement && Date.now() - start < (Number(maxWaitMs) || 1500)) {
                    try {
                        const tabId = globalThis.__taskHorizonCustomTabId;
                        if (tabId) {
                            const root = document.querySelector(`[data-id="${tabId}"] .tm-tab-root, [data-key="${tabId}"] .tm-tab-root`);
                            if (root) globalThis.__taskHorizonTabElement = root;
                        }
                    } catch (e) {}
                    await new Promise(r => setTimeout(r, 50));
                }
                __tmEnsureMount();
                if (globalThis.__taskHorizonTabElement && document.body.contains(globalThis.__taskHorizonTabElement)) {
                    __tmSetMount(globalThis.__taskHorizonTabElement);
                }
            } finally {
                __tmEnsureTabPromise = null;
            }
        })();
        return __tmEnsureTabPromise;
    }

    // 检查是否有任何分组包含文档（支持全部文档和自定义分组）
    async function checkAnyGroupHasDocs() {
        // 检查全部文档分组
        if (SettingsStore.data.selectedDocIds && SettingsStore.data.selectedDocIds.length > 0) {
            return true;
        }
        
        // 检查自定义分组
        const groups = SettingsStore.data.docGroups || [];
        for (const group of groups) {
            if (group.docs && group.docs.length > 0) {
                return true;
            }
        }
        
        return false;
    }

    // 查找已打开的任务管理器标签页
    function __tmFindExistingTaskManagerTab() {
        try {
            if (!window.siyuan || !window.siyuan.ws || !window.siyuan.ws.apps) return null;
            
            const apps = window.siyuan.ws.apps;
            for (const app of apps) {
                if (app && app.custom && app.custom['task-horizon']) {
                    return app;
                }
            }
        } catch (e) {}
        return null;
    }

    // 切换到指定标签页
    function __tmSwitchToTab(tab) {
        try {
            if (window.siyuan && window.siyuan.layout && window.siyuan.layout.centerLayout) {
                window.siyuan.layout.centerLayout.switchTab(tab);
            }
        } catch (e) {
            // 如果切换失败，则打开新标签页
            openManager();
        }
    }

    async function openManager(options) {
        state.openToken = (Number(state.openToken) || 0) + 1;
        const token = Number(state.openToken) || 0;
        try { __tmListenPinnedChanged(); } catch (e) {}

        if (!__tmIsMobileDevice()) {
            if (!options || !options.skipEnsureTabOpened) {
                await __tmEnsureTabOpened();
            } else {
                __tmEnsureMount();
            }
            try {
                setTimeout(() => { try { __tmPatchTaskHorizonTabIcon(); } catch (e) {} }, 0);
                setTimeout(() => { try { __tmPatchTaskHorizonTabIcon(); } catch (e) {} }, 250);
                setTimeout(() => { try { __tmPatchTaskHorizonTabIcon(); } catch (e) {} }, 900);
            } catch (e) {}
        }

        // 强制重新渲染，确保 DOM 存在
        try { render(); } catch (e) {
            console.error('[OpenManager] Render failed:', e);
        }

        // 静默加载，不显示加载提示（从后台切回时不提示）
        // 仅在首次手动打开时显示
        if (!state.wasHidden) {
            hint('🔄 加载任务中...', 'info');
        }
        state.wasHidden = false;

        await SettingsStore.load();
        if (SettingsStore.data.enableTomatoIntegration) {
            try { __tmHookTomatoTimer(); } catch (e) {}
            try { __tmListenTomatoAssociationCleared(); } catch (e) {}
        }
        state.selectedDocIds = SettingsStore.data.selectedDocIds;

        // 检查是否至少有一个分组包含文档
        const hasDocs = await checkAnyGroupHasDocs();
        if (!hasDocs) {
            hint('⚠ 请先在设置中添加要显示的文档', 'warning');
            if (state.modal && token === (Number(state.openToken) || 0)) showSettings();
            return;
        }

        if (!state.modal || token !== (Number(state.openToken) || 0)) return;
        try {
            await new Promise(resolve => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });
        } catch (e) {}
        loadSelectedDocuments().catch(e => hint(`❌ 加载失败: ${e.message}`, 'error'));
    }

    // ... 保留原有的 loadSelectedDocuments 和其他函数 ...

    // 插件卸载清理
    function __tmCleanup() {
        try {
            if (__tmVisibilityHandler) {
                document.removeEventListener('visibilitychange', __tmVisibilityHandler);
                __tmVisibilityHandler = null;
            }
        } catch (e) {}
        try {
            if (__tmFocusHandler) {
                window.removeEventListener('focus', __tmFocusHandler);
                __tmFocusHandler = null;
            }
        } catch (e) {}
        try {
            if (__tmGlobalClickHandler) {
                window.removeEventListener('click', __tmGlobalClickHandler);
                __tmGlobalClickHandler = null;
            }
        } catch (e) {}
        try {
            if (__tmTopBarClickCaptureHandler) {
                try { __tmTopBarEl?.removeEventListener?.('click', __tmTopBarClickCaptureHandler, true); } catch (e2) {}
                __tmTopBarClickCaptureHandler = null;
            }
            __tmTopBarEl = null;
            __tmTopBarClickInFlight = false;
        } catch (e) {}
        try {
            if (__tmQuickAddGlobalClickHandler) {
                document.removeEventListener('click', __tmQuickAddGlobalClickHandler);
                __tmQuickAddGlobalClickHandler = null;
            }
            try { if (window.tmQuickAddEventsBound) window.tmQuickAddEventsBound = false; } catch (e2) {}
        } catch (e) {}
        try {
            if (__tmWakeReloadTimer) {
                clearTimeout(__tmWakeReloadTimer);
                __tmWakeReloadTimer = null;
            }
            __tmWakeReloadInFlight = false;
            __tmWakeReloadBound = false;
            __tmWasHiddenAt = 0;
        } catch (e) {}
        try {
            if (__tmTomatoAssociationHandler) {
                window.removeEventListener('tomato:association-cleared', __tmTomatoAssociationHandler);
                __tmTomatoAssociationHandler = null;
            }
        } catch (e) {}
        try {
            const timer = globalThis.__tomatoTimer;
            if (timer && typeof timer === 'object' && __tmTomatoOriginalTimerFns) {
                Object.entries(__tmTomatoOriginalTimerFns).forEach(([k, fn]) => {
                    if (typeof fn === 'function') {
                        try { timer[k] = fn; } catch (e) {}
                    }
                });
            }
            __tmTomatoOriginalTimerFns = null;
            __tmTomatoTimerHooked = false;
        } catch (e) {}
        try {
            if (globalThis.__taskHorizonOnTomatoAssociationCleared) delete globalThis.__taskHorizonOnTomatoAssociationCleared;
            __tmTomatoAssociationListenerAdded = false;
        } catch (e) {}
        try {
            if (globalThis.__taskHorizonOnPinnedChanged) delete globalThis.__taskHorizonOnPinnedChanged;
            __tmPinnedListenerAdded = false;
        } catch (e) {}

        try {
            if (__tmDomReadyHandler) {
                document.removeEventListener('DOMContentLoaded', __tmDomReadyHandler);
                __tmDomReadyHandler = null;
            }
        } catch (e) {}

        try {
            if (breadcrumbTimer != null) {
                clearTimeout(breadcrumbTimer);
                breadcrumbTimer = null;
            }
        } catch (e) {}

        try {
            if (__tmTopBarTimer != null) {
                clearTimeout(__tmTopBarTimer);
                __tmTopBarTimer = null;
            }
        } catch (e) {}

        try {
            if (__tmBreadcrumbObserver) {
                __tmBreadcrumbObserver.disconnect();
                __tmBreadcrumbObserver = null;
            }
        } catch (e) {}

        try {
            if (__tmThemeModeObserver) {
                __tmThemeModeObserver.disconnect();
                __tmThemeModeObserver = null;
            }
        } catch (e) {}

        try {
            if (__tmResizeState) {
                document.removeEventListener('mousemove', __tmOnResize);
                document.removeEventListener('mouseup', __tmStopResize);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                __tmResizeState = null;
            }
        } catch (e) {}

        try { __tmHideMobileMenu?.(); } catch (e) {}
        try {
            if (state.desktopMenuCloseHandler) {
                document.removeEventListener('click', state.desktopMenuCloseHandler);
                state.desktopMenuCloseHandler = null;
            }
        } catch (e) {}
        try {
            if (state.taskContextMenuCloseHandler) {
                document.removeEventListener('click', state.taskContextMenuCloseHandler);
                document.removeEventListener('contextmenu', state.taskContextMenuCloseHandler);
                state.taskContextMenuCloseHandler = null;
            }
        } catch (e) {}
        try { __tmCloseInlineEditor(); } catch (e) {}
        try { __tmCloseCellEditor(false); } catch (e) {}

        try {
            if (state.modal) {
                state.modal.remove();
                state.modal = null;
            }
            if (state.settingsModal) {
                state.settingsModal.remove();
                state.settingsModal = null;
            }
            if (state.rulesModal) {
                state.rulesModal.remove();
                state.rulesModal = null;
            }
            if (state.priorityModal) {
                state.priorityModal.remove();
                state.priorityModal = null;
            }
        } catch (e) {}

        try {
            const promptModal = document.querySelector('.tm-prompt-modal');
            if (promptModal) promptModal.remove();
        } catch (e) {}

        try {
            const ctxMenu = document.getElementById('tm-task-context-menu');
            if (ctxMenu) ctxMenu.remove();
        } catch (e) {}
        try {
            const desktopMenu = document.getElementById('tmDesktopMenu');
            if (desktopMenu) desktopMenu.remove();
        } catch (e) {}

        try {
            document.querySelectorAll('.tm-breadcrumb-btn').forEach(btn => btn.remove());
        } catch (e) {}

        try {
            if (MetaStore.saveTimer) {
                clearTimeout(MetaStore.saveTimer);
                MetaStore.saveTimer = null;
            }
        } catch (e) {}
        try {
            if (SettingsStore?.saveTimer) {
                clearTimeout(SettingsStore.saveTimer);
                SettingsStore.saveTimer = null;
            }
            try { SettingsStore?.savePromiseResolve?.(); } catch (e2) {}
            try {
                SettingsStore.savePromise = null;
                SettingsStore.savePromiseResolve = null;
                SettingsStore.saveDirty = false;
                SettingsStore.saving = false;
            } catch (e2) {}
        } catch (e) {}

        try { __tmStyleEl?.remove?.(); } catch (e) {}
        try { document.getElementById('sy-custom-props-floatbar-style')?.remove?.(); } catch (e) {}
        try { document.querySelectorAll('.sy-custom-props-floatbar, .sy-custom-props-floatbar__select, .sy-custom-props-floatbar__input-editor').forEach(el => el.remove()); } catch (e) {}

        try { delete globalThis.__taskHorizonMount; } catch (e) {}
        try {
            const ns = window?.[__tmNsKey];
            const keys = Array.isArray(ns?.__exportKeys) ? ns.__exportKeys : [];
            keys.forEach((k) => {
                if (!k) return;
                try { delete window[k]; } catch (e) {
                    try { window[k] = undefined; } catch (e2) {}
                }
            });
        } catch (e) {}
        try { delete window[__tmNsKey]; } catch (e) {
            try { window[__tmNsKey] = undefined; } catch (e2) {}
        }
        try { delete globalThis.__TaskManagerCleanup; } catch (e) {}
    }

    // 暴露清理函数给插件卸载调用
    globalThis.__TaskManagerCleanup = __tmCleanup;
    // 暴露挂载函数供自定义 Tab 使用
    globalThis.__taskHorizonMount = (el) => {
        __tmSetMount(el);
        openManager({ skipEnsureTabOpened: true }).catch((e) => {
            try { console.error('[task-horizon] openManager failed:', e); } catch (e2) {}
            try { hint(`❌ 加载失败: ${e?.message || String(e)}`, 'error'); } catch (e3) {}
            try {
                setTimeout(() => {
                    if (document.visibilityState === 'hidden') return;
                    __tmSafeOpenManager('mount-retry');
                }, 900);
            } catch (e4) {}
        });
    };

    try {
        const now = Object.getOwnPropertyNames(window);
        const added = now.filter(k => !__tmWindowKeysBefore.has(k));
        const exportKeys = [];
        added.forEach((k) => {
            if (!k) return;
            const v = window[k];
            if (typeof v !== 'function') return;
            try { __tmNs[k] = v; } catch (e) {}
            exportKeys.push(k);
        });
        __tmNs.__exportKeys = exportKeys;
    } catch (e) {}

    __tmNs.uninstallCleanup = async function() {
        try {
            await fetch('/api/file/removeFile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: SETTINGS_FILE_PATH }),
            }).catch(() => null);
        } catch (e) {}

        try {
            await fetch('/api/file/removeFile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: META_FILE_PATH }),
            }).catch(() => null);
        } catch (e) {}

        try {
            [
                'tm_selected_doc_ids',
                'tm_query_limit',
                'tm_group_by_docname',
                'tm_group_by_time',
                'tm_group_mode',
                'tm_collapsed_task_ids',
                'tm_collapsed_groups',
                'tm_current_rule',
                'tm_filter_rules',
                'tm_font_size',
                'tm_font_size_mobile',
                'tm_enable_quickbar',
                'tm_pin_new_tasks_by_default',
                'tm_new_task_doc_id',
                'tm_enable_tomato_integration',
                'tm_tomato_spent_attr_mode',
                'tm_tomato_spent_attr_key_minutes',
                'tm_tomato_spent_attr_key_hours',
                'tm_default_doc_id',
                'tm_default_doc_id_by_group',
                'tm_priority_score_config',
                'tm_quadrant_config',
                'tm_doc_groups',
                'tm_current_group_id',
                'tm_custom_status_options',
                'tm_column_widths',
                'tm_column_order',
                'tm_topbar_gradient_light_start',
                'tm_topbar_gradient_light_end',
                'tm_topbar_gradient_dark_start',
                'tm_topbar_gradient_dark_end',
                'tm_task_content_color_light',
                'tm_task_content_color_dark',
                'tm_group_doc_label_color_light',
                'tm_group_doc_label_color_dark',
                'tm_time_group_base_color_light',
                'tm_time_group_base_color_dark',
                'tm_time_group_overdue_color_light',
                'tm_time_group_overdue_color_dark',
                'tm_table_border_color_light',
                'tm_table_border_color_dark',
                'tm_meta_cache',
            ].forEach((k) => {
                try { Storage.remove(k); } catch (e) {}
            });
        } catch (e) {}
    };

    (function () {
        const DAY_MS = 86400000;
        const cleanupMap = new WeakMap();
    
        function clamp(n, min, max) {
            return Math.max(min, Math.min(max, n));
        }
    
        function parseDateOnlyToTs(value) {
            const s = String(value || '').trim();
            if (!s) return 0;
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
                const y = Number(m[1]);
                const mon = Number(m[2]) - 1;
                const d = Number(m[3]);
                const dt = new Date(y, mon, d, 12, 0, 0, 0);
                return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
            }
            const t = new Date(s).getTime();
            return Number.isNaN(t) ? 0 : t;
        }
    
        function formatDateOnlyFromTs(ts) {
            const d = new Date(ts);
            if (Number.isNaN(d.getTime())) return '';
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
    
        function startOfDayTs(ts) {
            const d = new Date(ts);
            if (Number.isNaN(d.getTime())) return 0;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
        }
    
        function computeAutoRangeTs(taskItems, paddingDays) {
            let minTs = 0;
            let maxTs = 0;
            for (const t of taskItems) {
                const sTs = parseDateOnlyToTs(t?.startDate);
                const eTs = parseDateOnlyToTs(t?.completionTime);
                const a = sTs || eTs;
                const b = eTs || sTs;
                if (!a || !b) continue;
                if (!minTs || a < minTs) minTs = a;
                if (!maxTs || b > maxTs) maxTs = b;
            }
            const now = Date.now();
            if (!minTs || !maxTs) {
                const today = startOfDayTs(now);
                const start = today - 7 * DAY_MS;
                const end = today + 21 * DAY_MS;
                return { startTs: start, endTs: end };
            }
            const pad = Math.max(0, Number(paddingDays) || 0) * DAY_MS;
            const startTs = startOfDayTs(minTs - pad);
            const endTs = startOfDayTs(maxTs + pad);
            return { startTs, endTs };
        }
    
        function buildDayCellsHtml(startTs, dayCount, dayWidth) {
            const cells = [];
            let lastMonthKey = '';
            for (let i = 0; i < dayCount; i++) {
                const ts = startTs + i * DAY_MS;
                const d = new Date(ts);
                const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
                const isNewMonth = monthKey !== lastMonthKey;
                if (isNewMonth) lastMonthKey = monthKey;
                const day = d.getDate();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const cls = `tm-gantt-day${isWeekend ? ' tm-gantt-day--weekend' : ''}${isNewMonth ? ' tm-gantt-day--month-start' : ''}`;
                cells.push(`<div class="${cls}" style="width:${dayWidth}px">${day}</div>`);
            }
            return cells.join('');
        }
    
        function buildMonthHeaderHtml(startTs, dayCount, dayWidth) {
            const parts = [];
            let i = 0;
            while (i < dayCount) {
                const ts = startTs + i * DAY_MS;
                const d = new Date(ts);
                const y = d.getFullYear();
                const m = d.getMonth();
                const monthStartTs = new Date(y, m, 1, 0, 0, 0, 0).getTime();
                const nextMonthTs = new Date(y, m + 1, 1, 0, 0, 0, 0).getTime();
                const monthEndTs = nextMonthTs - DAY_MS;
                const startIndex = Math.max(0, Math.floor((monthStartTs - startTs) / DAY_MS));
                const endIndex = Math.min(dayCount - 1, Math.floor((monthEndTs - startTs) / DAY_MS));
                const spanDays = endIndex - startIndex + 1;
                const width = spanDays * dayWidth;
                const label = `${y}-${String(m + 1).padStart(2, '0')}`;
                parts.push(`<div class="tm-gantt-month" style="width:${width}px">${label}</div>`);
                i = endIndex + 1;
            }
            return parts.join('');
        }
    
        function getDayIndexByTs(startTs, ts) {
            return Math.round((startOfDayTs(ts) - startTs) / DAY_MS);
        }
    
        function renderGantt(opts) {
            const headerEl = opts?.headerEl;
            const bodyEl = opts?.bodyEl;
            const rowModel = Array.isArray(opts?.rowModel) ? opts.rowModel : [];
            const getTaskById = typeof opts?.getTaskById === 'function' ? opts.getTaskById : null;
            const onUpdateTaskDates = typeof opts?.onUpdateTaskDates === 'function' ? opts.onUpdateTaskDates : null;
            if (!headerEl || !bodyEl || !getTaskById) return;
    
            try { cleanupMap.get(bodyEl)?.(); } catch (e) {}
    
            const viewState = (opts.viewState && typeof opts.viewState === 'object') ? opts.viewState : {};
            const paddingDays = Number.isFinite(Number(viewState.paddingDays)) ? Number(viewState.paddingDays) : 7;
            const dayWidth = clamp(Number(viewState.dayWidth) || 24, 10, 60);
    
            const tasks = [];
            for (const r of rowModel) {
                if (r?.type !== 'task') continue;
                const t = getTaskById(r.id);
                if (t) tasks.push(t);
            }
    
            const range = computeAutoRangeTs(tasks, paddingDays);
            const startTs = range.startTs;
            const endTs = range.endTs;
            const dayCount = clamp(Math.round((endTs - startTs) / DAY_MS) + 1, 1, 366);
            const totalWidth = dayCount * dayWidth;
            try { bodyEl.dataset.tmGanttStartTs = String(startTs); } catch (e) {}
            try { bodyEl.dataset.tmGanttDayWidth = String(dayWidth); } catch (e) {}
            try { bodyEl.dataset.tmGanttDayCount = String(dayCount); } catch (e) {}
            try { bodyEl.dataset.tmGanttTotalWidth = String(totalWidth); } catch (e) {}
    
            headerEl.innerHTML = `
                <div class="tm-gantt-header-inner" style="width:${totalWidth}px">
                    <div class="tm-gantt-month-row">${buildMonthHeaderHtml(startTs, dayCount, dayWidth)}</div>
                    <div class="tm-gantt-day-row">${buildDayCellsHtml(startTs, dayCount, dayWidth)}</div>
                </div>
            `;
    
            const nowIdx = getDayIndexByTs(startTs, Date.now());
            const todayIdx = clamp(nowIdx, 0, dayCount - 1);
            const todayLeft = todayIdx * dayWidth;
            const rowsHtml = [];
            for (const r of rowModel) {
                if (r?.type === 'group') {
                    rowsHtml.push(`<div class="tm-gantt-row tm-gantt-row--group" data-group-key="${String(r?.key || '')}" style="width:${totalWidth}px;cursor:pointer"></div>`);
                    continue;
                }
                if (r?.type !== 'task') continue;
                const task = getTaskById(r.id);
                const sTs0 = parseDateOnlyToTs(task?.startDate);
                const eTs0 = parseDateOnlyToTs(task?.completionTime);
                const aTs = sTs0 || eTs0;
                const bTs = eTs0 || sTs0;
                if (!aTs && !bTs) {
                    rowsHtml.push(`<div class="tm-gantt-row" data-id="${String(r.id)}" style="width:${totalWidth}px"></div>`);
                    continue;
                }
                const startIdx = clamp(getDayIndexByTs(startTs, aTs), 0, dayCount - 1);
                const endIdx = clamp(getDayIndexByTs(startTs, bTs), 0, dayCount - 1);
                const left = Math.min(startIdx, endIdx) * dayWidth;
                const width = (Math.abs(endIdx - startIdx) + 1) * dayWidth;
                rowsHtml.push(`
                    <div class="tm-gantt-row" data-id="${String(r.id)}" style="width:${totalWidth}px">
                        <div class="tm-gantt-bar" style="left:${left}px;width:${width}px" title="${String(task?.content || '').trim()}\\n${formatDateOnlyFromTs(aTs)} ~ ${formatDateOnlyFromTs(bTs)}">
                            <div class="tm-gantt-bar-handle tm-gantt-bar-handle--start" data-handle="start"></div>
                            <div class="tm-gantt-bar-handle tm-gantt-bar-handle--end" data-handle="end"></div>
                        </div>
                    </div>
                `);
            }
    
            bodyEl.innerHTML = `
                <div class="tm-gantt-body-inner" style="width:${totalWidth}px">
                    <div class="tm-gantt-today" style="left:${todayLeft}px"></div>
                    ${rowsHtml.join('')}
                </div>
            `;
    
            const onPointerDown = (e) => {
                if (!onUpdateTaskDates) return;
                const target = e.target;
                if (!(target instanceof Element)) return;
                const handleEl = target.closest('.tm-gantt-bar-handle');
                const barEl = target.closest('.tm-gantt-bar');
                if (!barEl) return;
                const rowEl = barEl.closest('.tm-gantt-row');
                const taskId = rowEl?.getAttribute?.('data-id');
                if (!taskId) return;
    
                const handleType = handleEl?.getAttribute?.('data-handle');
                const action = handleType === 'start' ? 'start' : handleType === 'end' ? 'end' : 'move';
    
                const startTsStr = String(bodyEl.dataset?.tmGanttStartTs || '');
                const dayWidthStr = String(bodyEl.dataset?.tmGanttDayWidth || '');
                const dayCountStr = String(bodyEl.dataset?.tmGanttDayCount || '');
                const startTs0 = Number(startTsStr);
                const dayWidth0 = Number(dayWidthStr);
                const dayCount0 = Number(dayCountStr);
                if (!Number.isFinite(startTs0) || !Number.isFinite(dayWidth0) || !Number.isFinite(dayCount0) || dayWidth0 <= 0) return;
    
                const rect = bodyEl.getBoundingClientRect();
                const startX = e.clientX;
                const baseScrollLeft = bodyEl.scrollLeft;
                const initialLeftPx = Number.parseFloat(String(barEl.style.left || '').replace('px', '')) || 0;
                const initialWidthPx = Number.parseFloat(String(barEl.style.width || '').replace('px', '')) || dayWidth0;
                const initialStartIdx = clamp(Math.round(initialLeftPx / dayWidth0), 0, dayCount0 - 1);
                const initialLen = Math.max(1, Math.round(initialWidthPx / dayWidth0));
                const initialEndIdx = clamp(initialStartIdx + initialLen - 1, 0, dayCount0 - 1);
    
                let lastStartIdx = initialStartIdx;
                let lastEndIdx = initialEndIdx;
                let raf = 0;
                let dragging = true;
    
                const applyBar = (sIdx, eIdx) => {
                    const s = clamp(Math.min(sIdx, eIdx), 0, dayCount0 - 1);
                    const e2 = clamp(Math.max(sIdx, eIdx), 0, dayCount0 - 1);
                    lastStartIdx = s;
                    lastEndIdx = e2;
                    const left = s * dayWidth0;
                    const width = (e2 - s + 1) * dayWidth0;
                    barEl.style.left = `${left}px`;
                    barEl.style.width = `${width}px`;
                };
    
                const onMove = (ev) => {
                    if (!dragging) return;
                    const dx = (ev.clientX - startX);
                    const deltaDays = Math.round(dx / dayWidth0);
                    if (action === 'start') {
                        applyBar(initialStartIdx + deltaDays, initialEndIdx);
                    } else if (action === 'end') {
                        applyBar(initialStartIdx, initialEndIdx + deltaDays);
                    } else {
                        const len = Math.max(1, initialEndIdx - initialStartIdx + 1);
                        let nextStart = initialStartIdx + deltaDays;
                        let nextEnd = nextStart + len - 1;
                        if (nextStart < 0) { nextStart = 0; nextEnd = len - 1; }
                        if (nextEnd > dayCount0 - 1) { nextEnd = dayCount0 - 1; nextStart = nextEnd - len + 1; }
                        applyBar(nextStart, nextEnd);
                    }
                };
    
                const tip = document.createElement('div');
                tip.className = 'tm-gantt-drag-tip';
                tip.textContent = '';
                try {
                    tip.style.position = 'fixed';
                    tip.style.zIndex = '1000002';
                    tip.style.padding = '6px 10px';
                    tip.style.borderRadius = '8px';
                    tip.style.background = 'rgba(0, 0, 0, 0.78)';
                    tip.style.color = '#fff';
                    tip.style.fontSize = '12px';
                    tip.style.lineHeight = '1';
                    tip.style.pointerEvents = 'none';
                    tip.style.transform = 'translate(10px, -18px)';
                    tip.style.whiteSpace = 'nowrap';
                    tip.style.fontVariantNumeric = 'tabular-nums';
                } catch (e4) {}
                try {
                    const host = bodyEl?.ownerDocument?.body || document.body || bodyEl;
                    host.appendChild(tip);
                } catch (e4) {}
    
                const updateTip = (ev) => {
                    const sDate = formatDateOnlyFromTs(startTs0 + lastStartIdx * DAY_MS);
                    const eDate = formatDateOnlyFromTs(startTs0 + lastEndIdx * DAY_MS);
                    tip.textContent = action === 'start' ? sDate : action === 'end' ? eDate : `${sDate} ~ ${eDate}`;
                    tip.style.left = `${ev.clientX}px`;
                    tip.style.top = `${ev.clientY}px`;
                };
    
                const onWinPointerMove = (ev) => {
                    if (!dragging) return;
                    if (raf) return;
                    raf = requestAnimationFrame(() => {
                        raf = 0;
                        onMove(ev);
                        updateTip(ev);
                    });
                };
    
                const onUp = async () => {
                    if (!dragging) return;
                    dragging = false;
                    try { window.removeEventListener('pointermove', onWinPointerMove, true); } catch (e) {}
                    try { window.removeEventListener('pointerup', onUp, true); } catch (e) {}
                    try { window.removeEventListener('pointercancel', onUp, true); } catch (e) {}
                    try { window.removeEventListener('blur', onUp, true); } catch (e) {}
                    if (raf) cancelAnimationFrame(raf);
                    try { tip.remove(); } catch (e) {}
    
                    const startDate = formatDateOnlyFromTs(startTs0 + lastStartIdx * DAY_MS);
                    const completionTime = formatDateOnlyFromTs(startTs0 + lastEndIdx * DAY_MS);
                    try {
                        await onUpdateTaskDates(String(taskId), { startDate, completionTime });
                    } catch (e) {
                    }
                };
    
                try {
                    barEl.setPointerCapture?.(e.pointerId);
                } catch (e2) {}
    
                window.addEventListener('pointermove', onWinPointerMove, true);
                window.addEventListener('pointerup', onUp, true);
                window.addEventListener('pointercancel', onUp, true);
                window.addEventListener('blur', onUp, true);
    
                try { e.preventDefault(); } catch (e3) {}
                try { e.stopPropagation(); } catch (e3) {}
    
                if (action === 'move') {
                    const relX = e.clientX - rect.left + baseScrollLeft;
                    const anchor = clamp(relX, 0, totalWidth);
                    const newScroll = clamp(anchor - bodyEl.clientWidth * 0.5, 0, Math.max(0, totalWidth - bodyEl.clientWidth));
                    bodyEl.scrollLeft = newScroll;
                }
    
                updateTip(e);
            };
    
            bodyEl.addEventListener('pointerdown', onPointerDown, { passive: false });
            cleanupMap.set(bodyEl, () => {
                try { bodyEl.removeEventListener('pointerdown', onPointerDown, { passive: false }); } catch (e) {
                    try { bodyEl.removeEventListener('pointerdown', onPointerDown); } catch (e2) {}
                }
            });
        }
    
        globalThis.__TaskHorizonGanttView = {
            render: renderGantt,
            parseDateOnlyToTs,
            formatDateOnlyFromTs,
            startOfDayTs,
            DAY_MS,
        };
    })();

    if (document.readyState === 'loading') {
        __tmDomReadyHandler = init;
        document.addEventListener('DOMContentLoaded', __tmDomReadyHandler);
    } else {
        init();
    }
})();

