// ==UserScript==
// @name         思源笔记任务管理器（代码片段版）
// @namespace    siyuan://plugins/snippets
// @version      9.0
// @description  任务管理器，支持自定义筛选规则分组和排序（适配思源笔记代码片段）
// @author       You
// @match        *://localhost:6806/*
// @run-at       document-end
// ==/UserScript*/

/*
使用方法：
1. 在思源笔记中打开：设置 → 外观 → 代码片段 → JavaScript
2. 点击"新建"
3. 将此脚本完整复制粘贴到编辑器中
4. 保存并启用
5. 在思源笔记页面刷新后，右下角会显示"📋 任务管理"按钮
*/

(function() {
    'use strict';
    
    console.log('🍅 任务管理器 v9.0 启动 - 支持自定义筛选规则');
    
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --tm-bg-color: #ffffff;
            --tm-text-color: #333333;
            --tm-border-color: #e9ecef;
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
        }

        [data-theme-mode="dark"] {
            --tm-bg-color: #1e1e1e;
            --tm-text-color: #e0e0e0;
            --tm-border-color: #333333;
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
            border-bottom: 1px solid var(--tm-border-color);
        }
        
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

        .tm-toolbar-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 4px 6px;
            border-radius: 6px;
            font-size: 16px;
            line-height: 1;
            color: white;
        }

        .tm-toolbar-btn:hover {
            background: rgba(255,255,255,0.2);
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
            box-shadow: inset 0 -1px 0 var(--tm-border-color);
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            box-shadow: inset 0 -1px 0 var(--tm-border-color);
            /* 添加右侧列分隔线 */
            border-right: 1px solid var(--tm-border-color);
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
            box-shadow: inset 0 -1px 0 var(--tm-border-color);
            position: sticky;
            top: 0;
            z-index: 20;
            /* 最后一列不显示右侧边框 */
            border-right: 1px solid var(--tm-border-color);
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
            border-bottom: 1px solid var(--tm-border-color);
            border-right: 1px solid var(--tm-border-color);
            vertical-align: middle;
            color: var(--tm-text-color);
        }

        .tm-table tr:hover {
            background: var(--tm-hover-bg);
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
        }

        .tm-task-text {
            overflow: hidden;
            white-space: normal;
            word-break: break-all;
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
            display: inline-flex;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            color: var(--tm-secondary-text);
        }

        .tm-tree-spacer {
            width: 14px;
            display: inline-flex;
        }

        .tm-task-checkbox {
            width: 14px;
            height: 14px;
            margin: 0;
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
            color: var(--tm-success-color) !important;
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
    document.head.appendChild(style);

    // 本地存储（用于快速读取和云端同步失败时的备用）
    // 主存储使用云端文件（/data/storage/ 目录）
    const Storage = {
        get(key, defaultValue) {
            try {
                const value = localStorage.getItem(key);
                return value !== null ? JSON.parse(value) : defaultValue;
            } catch (e) {
                console.warn(`[存储] 读取 ${key} 失败:`, e);
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.warn(`[存储] 保存 ${key} 失败:`, e);
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
                            console.warn('[元数据] 解析云端数据失败，跳过同步:', parseError);
                        }
                    }
                }
            } catch (e) {
                console.warn('[元数据] 从云端加载失败:', e);
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
            // 调试：检查应用前的数据
            console.log(`[Meta应用] 任务 ${task.id?.slice(-6)}: 现有 priority='${task.priority}', MetaStore=${JSON.stringify(v || {})}`);

            // 优先使用 MetaStore 的值（非空字符串、非 'null'、非 undefined）
            // 排除 'null' 字符串（SQL 查询返回的 null 会被转成字符串 'null'）
            const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';

            // 关键：优先应用 MetaStore 的 done 状态（如果存在）
            if ('done' in v && v.done !== undefined && v.done !== null) {
                console.log(`[Meta应用] 任务 ${task.id?.slice(-6)}: 应用 MetaStore done=${v.done} (原 done=${task.done})`);
                task.done = v.done;
            }
            if ('priority' in v && isValidValue(v.priority)) task.priority = v.priority;
            if ('pinned' in v && isValidValue(v.pinned)) task.pinned = v.pinned;
            if ('duration' in v && isValidValue(v.duration)) task.duration = v.duration;
            if ('remark' in v && isValidValue(v.remark)) task.remark = v.remark;
            if ('completionTime' in v && isValidValue(v.completionTime)) task.completionTime = v.completionTime;
            if ('customTime' in v && isValidValue(v.customTime)) task.customTime = v.customTime;
            if ('customStatus' in v && isValidValue(v.customStatus)) task.customStatus = v.customStatus;

            // 调试：检查应用后的数据
            console.log(`[Meta应用后] 任务 ${task.id?.slice(-6)}: done='${task.done}', priority='${task.priority}', completionTime='${task.completionTime}'`);
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
            collapsedTaskIds: [],
            currentRule: null,
            filterRules: [],
            fontSize: 14,
            fontSizeMobile: 14,
            enableQuickbar: true,
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
                duration: 96,           // 时长
                remark: 240             // 备注
            },
            // 列顺序设置
            columnOrder: ['pinned', 'content', 'status', 'score', 'doc', 'h2', 'priority', 'completionTime', 'duration', 'remark']
        },
        loaded: false,

        async load() {
            if (this.loaded) return;

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
                                if (Array.isArray(cloudData.collapsedTaskIds)) this.data.collapsedTaskIds = cloudData.collapsedTaskIds;
                                if (Array.isArray(cloudData.collapsedGroups)) this.data.collapsedGroups = cloudData.collapsedGroups;
                                if (cloudData.currentRule !== undefined) this.data.currentRule = cloudData.currentRule;
                                if (Array.isArray(cloudData.filterRules)) this.data.filterRules = cloudData.filterRules;
                                if (typeof cloudData.fontSize === 'number') this.data.fontSize = cloudData.fontSize;
                                if (typeof cloudData.fontSizeMobile === 'number') this.data.fontSizeMobile = cloudData.fontSizeMobile;
                                if (typeof cloudData.enableQuickbar === 'boolean') this.data.enableQuickbar = cloudData.enableQuickbar;
                                if (typeof cloudData.defaultDocId === 'string') this.data.defaultDocId = cloudData.defaultDocId;
                                if (cloudData.defaultDocIdByGroup && typeof cloudData.defaultDocIdByGroup === 'object') this.data.defaultDocIdByGroup = cloudData.defaultDocIdByGroup;
                                if (cloudData.priorityScoreConfig && typeof cloudData.priorityScoreConfig === 'object') this.data.priorityScoreConfig = cloudData.priorityScoreConfig;
                                if (Array.isArray(cloudData.docGroups)) this.data.docGroups = cloudData.docGroups;
                                if (cloudData.currentGroupId) this.data.currentGroupId = cloudData.currentGroupId;
                                if (Array.isArray(cloudData.customStatusOptions)) this.data.customStatusOptions = cloudData.customStatusOptions;
                                if (cloudData.columnWidths && typeof cloudData.columnWidths === 'object') {
                                    // 旧版本兼容：如果有 customTime 配置，迁移到 completionTime
                                    if (cloudData.columnWidths.customTime && !cloudData.columnWidths.completionTime) {
                                        cloudData.columnWidths.completionTime = cloudData.columnWidths.customTime;
                                    }
                                    this.data.columnWidths = { ...this.data.columnWidths, ...cloudData.columnWidths };
                                }
                                if (Array.isArray(cloudData.columnOrder)) this.data.columnOrder = cloudData.columnOrder;

                                // 同步到本地缓存
                                this.normalizeColumns();
                                this.syncToLocal();
                                this.loaded = true;
                                return;
                            }
                        } catch (parseError) {
                            console.warn('[设置] 解析云端设置失败，跳过同步:', parseError);
                        }
                    }
                }
            } catch (e) {
                console.warn('[设置] 从云端加载设置失败:', e);
            }

            // 云端没有数据，从本地缓存读取
            this.loadFromLocal();
            this.loaded = true;
        },

        // 从本地缓存加载
        loadFromLocal() {
            this.data.selectedDocIds = Storage.get('tm_selected_doc_ids', []) || [];
            this.data.queryLimit = Storage.get('tm_query_limit', 500);
            this.data.groupByDocName = Storage.get('tm_group_by_docname', true);
            this.data.groupByTime = Storage.get('tm_group_by_time', false);
            this.data.collapsedTaskIds = Storage.get('tm_collapsed_task_ids', []) || [];
            this.data.collapsedGroups = Storage.get('tm_collapsed_groups', []) || [];
            this.data.currentRule = Storage.get('tm_current_rule', null);
            this.data.filterRules = Storage.get('tm_filter_rules', []);
            this.data.fontSize = Storage.get('tm_font_size', 14);
            this.data.fontSizeMobile = Storage.get('tm_font_size_mobile', this.data.fontSize);
            this.data.enableQuickbar = Storage.get('tm_enable_quickbar', true);
            this.data.defaultDocId = Storage.get('tm_default_doc_id', '');
            this.data.defaultDocIdByGroup = Storage.get('tm_default_doc_id_by_group', {}) || {};
            this.data.priorityScoreConfig = Storage.get('tm_priority_score_config', this.data.priorityScoreConfig) || this.data.priorityScoreConfig;
            this.data.docGroups = Storage.get('tm_doc_groups', []);
            this.data.currentGroupId = Storage.get('tm_current_group_id', 'all');
            this.data.customStatusOptions = Storage.get('tm_custom_status_options', this.data.customStatusOptions);
            this.data.columnOrder = Storage.get('tm_column_order', this.data.columnOrder);
            const savedWidths = Storage.get('tm_column_widths', null);
            if (savedWidths && typeof savedWidths === 'object') {
                if (savedWidths.customTime && !savedWidths.completionTime) {
                    savedWidths.completionTime = savedWidths.customTime;
                }
                this.data.columnWidths = { ...this.data.columnWidths, ...savedWidths };
            }
            this.normalizeColumns();
        },

        // 同步到本地缓存
        syncToLocal() {
            Storage.set('tm_selected_doc_ids', this.data.selectedDocIds);
            Storage.set('tm_query_limit', this.data.queryLimit);
            Storage.set('tm_group_by_docname', this.data.groupByDocName);
            Storage.set('tm_group_by_time', this.data.groupByTime);
            Storage.set('tm_collapsed_task_ids', this.data.collapsedTaskIds);
            Storage.set('tm_collapsed_groups', this.data.collapsedGroups || []);
            Storage.set('tm_current_rule', this.data.currentRule);
            Storage.set('tm_filter_rules', this.data.filterRules);
            Storage.set('tm_font_size', this.data.fontSize);
            Storage.set('tm_font_size_mobile', this.data.fontSizeMobile);
            Storage.set('tm_enable_quickbar', !!this.data.enableQuickbar);
            Storage.set('tm_default_doc_id', this.data.defaultDocId);
            Storage.set('tm_default_doc_id_by_group', this.data.defaultDocIdByGroup || {});
            Storage.set('tm_priority_score_config', this.data.priorityScoreConfig || {});
            Storage.set('tm_doc_groups', this.data.docGroups);
            Storage.set('tm_current_group_id', this.data.currentGroupId);
            Storage.set('tm_custom_status_options', this.data.customStatusOptions);
            Storage.set('tm_column_widths', this.data.columnWidths);
            Storage.set('tm_column_order', this.data.columnOrder);
        },

        normalizeColumns() {
            const defaultOrder = ['pinned', 'content', 'status', 'score', 'doc', 'h2', 'priority', 'completionTime', 'duration', 'remark'];
            const known = new Set(defaultOrder);
            if (!Array.isArray(this.data.columnOrder)) this.data.columnOrder = defaultOrder;
            this.data.columnOrder = this.data.columnOrder.filter(k => known.has(k));
            defaultOrder.forEach(k => {
                if (!this.data.columnOrder.includes(k)) this.data.columnOrder.push(k);
            });

            const percentFallback = { pinned: 5, content: 35, status: 8, score: 8, doc: 12, h2: 12, priority: 8, completionTime: 18, duration: 8, remark: 19 };
            const pxDefault = { pinned: 48, content: 360, status: 96, score: 96, doc: 180, h2: 180, priority: 96, completionTime: 170, duration: 96, remark: 240 };

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
            // 先同步到本地缓存
            this.syncToLocal();

            // 保存到云端
            try {
                const formData = new FormData();
                formData.append('path', SETTINGS_FILE_PATH);
                formData.append('isDir', 'false');
                formData.append('file', new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' }));

                const res = await fetch('/api/file/putFile', { method: 'POST', body: formData });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                console.log('[设置] 已保存到云端');
            } catch (e) {
                console.warn('[设置] 保存到云端失败，本地数据已保存:', e);
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
                { value: 'h2', label: '二级标题' },
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
            if (!taskTime) return operator === '!='; // 空时间处理
            
            const taskDate = new Date(taskTime);
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
                    const targetDate = new Date(value);
                    return taskDate < targetDate;
                }
                case 'after': {
                    const targetDate = new Date(value);
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
                    const fromDate = new Date(from);
                    const toDate = new Date(to);
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
                return (priorityOrder[a] || 0) - (priorityOrder[b] || 0);
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
                console.warn('[API] 获取子文档失败:', e);
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
                console.warn('[文档] URL获取失败:', e.message);
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
            console.log(`[查询] 开始查询文档 ${docId.slice(0, 8)}... 的任务`);
            
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
                    attr.completion_time,
                    attr.time as custom_time,
                    attr.custom_status
                    
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
                        MAX(CASE WHEN a.name = 'custom-completion-time' THEN a.value ELSE NULL END) as completion_time,
                        MAX(CASE WHEN a.name = 'custom-time' THEN a.value ELSE NULL END) as time,
                        MAX(CASE WHEN a.name = 'custom-status' THEN a.value ELSE NULL END) as custom_status
                    FROM attributes a
                    INNER JOIN blocks t ON t.id = a.block_id
                    WHERE 
                        t.type = 'i'
                        AND t.subtype = 't'
                        AND t.root_id = '${docId}'
                        AND a.name IN (
                            'custom-priority',
                            'custom-duration',
                            'custom-remark',
                            'custom-completion-time',
                            'custom-time',
                            'custom-status'
                        )
                    GROUP BY a.block_id
                ) AS attr ON attr.block_id = task.id
                
                WHERE 
                    task.type = 'i' 
                    AND task.subtype = 't'
                    AND task.root_id = '${docId}'
                    AND task.markdown IS NOT NULL
                    AND task.markdown != ''
                
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

            console.log(`[查询] 文档 ${docId.slice(0, 8)} 获取到 ${res.data?.length || 0} 个任务，耗时 ${queryTime}ms`);
            return { tasks: res.data || [], queryTime };
        },

        async getTasksByDocuments(docIds, limitPerDoc = 500) {
            const safeDocIds = Array.isArray(docIds) ? docIds.filter(id => /^[0-9]+-[a-zA-Z0-9]+$/.test(String(id || ''))) : [];
            if (safeDocIds.length === 0) return { tasks: [], queryTime: 0 };
            const idList = safeDocIds.map(id => `'${id}'`).join(',');
            const perDocLimit = Number.isFinite(limitPerDoc) ? Math.max(1, Math.min(5000, limitPerDoc)) : 500;

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
                    WHERE
                        task.type = 'i'
                        AND task.subtype = 't'
                        AND task.root_id IN (${idList})
                        AND task.markdown IS NOT NULL
                        AND task.markdown != ''
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
                        MAX(CASE WHEN a.name = 'custom-completion-time' THEN a.value ELSE NULL END) AS completion_time,
                        MAX(CASE WHEN a.name = 'custom-time' THEN a.value ELSE NULL END) AS time,
                        MAX(CASE WHEN a.name = 'custom-status' THEN a.value ELSE NULL END) AS custom_status
                    FROM attributes a
                    INNER JOIN tasks t ON t.id = a.block_id
                    WHERE a.name IN (
                        'custom-priority',
                        'custom-duration',
                        'custom-remark',
                        'custom-completion-time',
                        'custom-time',
                        'custom-status'
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
                    attr.completion_time,
                    attr.time AS custom_time,
                    attr.custom_status
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
            console.log(`[查询] 批量获取到 ${res.data?.length || 0} 个任务，耗时 ${queryTime}ms`);
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
                    WHERE b.type = 'h' AND b.subtype = 'h2'
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

        async deleteBlock(id) {
            const res = await this.call('/api/block/deleteBlock', { id: id });
            if (res.code !== 0) throw new Error(res.msg);
        }
    };

    const __tmMetaAttrMap = {
        priority: 'custom-priority',
        duration: 'custom-duration',
        remark: 'custom-remark',
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
            console.warn('[属性] 保存到区块失败:', e);
        });
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
        priorityScoreDraft: null
    };

    let __tmMountEl = null;

    function __tmSetMount(el) {
        if (el && !document.body.contains(el)) {
            // if element not attached yet, still allow mount
        }
        __tmMountEl = el || null;
    }

    function __tmEnsureMount() {
        if (__tmMountEl && !document.body.contains(__tmMountEl)) {
            __tmMountEl = null;
        }
        if (!__tmMountEl && globalThis.__taskHorizonTabElement) {
            __tmSetMount(globalThis.__taskHorizonTabElement);
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
    let __tmTopBarTimer = null;
    let __tmEntryMountTimer = null;
    let __tmEntryObserverTimer = null;
    let __tmTopBarAdded = false;

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
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

    function __tmDocHasUndoneTasks(doc) {
        if (!doc || !Array.isArray(doc.tasks) || doc.tasks.length === 0) return false;
        let hasUndone = false;
        const walk = (list) => {
            for (const t of list) {
                if (!t.done) {
                    hasUndone = true;
                    return;
                }
                if (t.children && t.children.length > 0) walk(t.children);
                if (hasUndone) return;
            }
        };
        walk(doc.tasks);
        return hasUndone;
    }

    function hint(msg, type) {
        const colors = { success: '#34a853', error: '#ea4335', info: '#4285f4', warning: '#f9ab00' };
        const el = document.createElement('div');
        el.className = 'tm-hint';
        el.style.background = colors[type] || '#666';
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
                        <button class="tm-rule-btn tm-rule-btn-secondary" onclick="showPriorityScoreSettings()">
                            优先级算法
                        </button>
                        <button class="tm-rule-btn tm-rule-btn-success" onclick="addNewRule()">
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
                        <button class="tm-rule-btn tm-rule-btn-secondary" onclick="closeRulesManager()">取消</button>
                        <button class="tm-rule-btn tm-rule-btn-success" onclick="saveRules()">保存规则</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(state.rulesModal);
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
                               onchange="toggleRuleEnabled('${rule.id}', this.checked)"
                               style="margin-right: 8px;">
                        ${esc(rule.name)}
                        ${state.currentRule === rule.id ? '<span style="color: var(--tm-success-color); margin-left: 8px;">(当前应用)</span>' : ''}
                    </div>
                    <div class="tm-rule-group-controls">
                        <button class="tm-rule-btn tm-rule-btn-primary" onclick="editRule('${rule.id}')">
                            编辑
                        </button>
                        <button class="tm-rule-btn tm-rule-btn-danger" onclick="deleteRule('${rule.id}')">
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
                    <button class="tm-rule-btn tm-rule-btn-primary" onclick="applyRuleNow('${rule.id}')">
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
                           placeholder="规则名称" oninput="updateEditingRuleName(this.value)">
                </div>
                
                <div class="tm-rule-section">
                    <div class="tm-rule-section-title">
                        <span>筛选条件</span>
                        <button class="tm-rule-btn tm-rule-btn-add" onclick="addCondition()">
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
                        <button class="tm-rule-btn tm-rule-btn-add" onclick="addSortRule()">
                            + 添加排序
                        </button>
                    </div>
                    <div class="tm-rule-sort-items">
                        ${renderSortRules(rule.sort)}
                    </div>
                </div>
                
                <div class="tm-rule-actions">
                    <button class="tm-rule-btn tm-rule-btn-secondary" onclick="cancelEditRule()">
                        取消
                    </button>
                    <button class="tm-rule-btn tm-rule-btn-success" onclick="saveEditRule()">
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
                    <select class="tm-rule-condition-field" onchange="updateConditionField(${index}, this.value)">
                        ${availableFields.map(f => 
                            `<option value="${f.value}" ${condition.field === f.value ? 'selected' : ''}>
                                ${f.label}
                            </option>`
                        ).join('')}
                    </select>
                    <select class="tm-rule-condition-operator" onchange="updateConditionOperator(${index}, this.value)">
                        ${operators.map(op => 
                            `<option value="${op.value}" ${condition.operator === op.value ? 'selected' : ''}>
                                ${op.label}
                            </option>`
                        ).join('')}
                    </select>
                    ${renderConditionValue(condition, index, field?.type)}
                    <button class="tm-rule-btn tm-rule-btn-danger" onclick="removeCondition(${index})">
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
                <select class="tm-rule-condition-value" onchange="updateConditionValue(${index}, this.value)">
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
                                       onchange="toggleConditionMultiValue(${index}, '${opt}', this.checked)">
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
                <select class="tm-rule-condition-value" onchange="updateConditionValue(${index}, this.value)">
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
                           onchange="updateConditionValueRange(${index}, 'from', this.value)">
                    <span class="tm-time-separator">至</span>
                    <input type="${inputType}" 
                           class="tm-time-input" 
                           placeholder="结束值"
                           value="${condition.value?.to || ''}"
                           onchange="updateConditionValueRange(${index}, 'to', this.value)">
                </div>
            `;
        }
        
        return `
            <input type="text" class="tm-rule-condition-value" 
                   value="${esc(String(condition.value || ''))}"
                   placeholder="输入值"
                   onchange="updateConditionValue(${index}, this.value)">
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
                <select class="tm-rule-sort-field" onchange="updateSortField(${index}, this.value)">
                    ${sortFields.map(f => 
                        `<option value="${f.value}" ${sortRule.field === f.value ? 'selected' : ''}>
                            ${f.label}
                        </option>`
                    ).join('')}
                </select>
                <select class="tm-rule-sort-order" onchange="updateSortOrder(${index}, this.value)">
                    <option value="asc" ${sortRule.order === 'asc' ? 'selected' : ''}>升序</option>
                    <option value="desc" ${sortRule.order === 'desc' ? 'selected' : ''}>降序</option>
                </select>
                <button class="tm-rule-btn tm-rule-btn-secondary" onclick="moveSortRule(${index}, -1)" ${index === 0 ? 'disabled' : ''} style="width: 28px; padding: 2px 0;">↑</button>
                <button class="tm-rule-btn tm-rule-btn-secondary" onclick="moveSortRule(${index}, 1)" ${index === sortRules.length - 1 ? 'disabled' : ''} style="width: 28px; padding: 2px 0;">↓</button>
                <button class="tm-rule-btn tm-rule-btn-danger" onclick="removeSortRule(${index})">
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

    function __tmRenderPriorityScoreSettings() {
        const cfg = state.priorityScoreDraft || __tmEnsurePriorityDraft();
        const statuses = SettingsStore.data.customStatusOptions || [];
        const docs = state.allDocuments || [];
        const docOptions = docs.map(d => `<option value="${d.id}">${esc(d.name || d.id)}</option>`).join('');
        const docRows = Object.entries(cfg.docDeltas || {}).map(([docId, delta]) => {
            const dName = docs.find(d => d.id === docId)?.name;
            return `
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                    <select class="tm-input" style="flex:1;min-width:180px;" onchange="tmUpdatePriorityDocDelta('${esc(docId)}', this.value)">
                        <option value="${esc(docId)}" selected>${esc(dName || docId)}</option>
                        ${docOptions}
                    </select>
                    <input class="tm-input" style="width:120px;" type="number" value="${Number(delta) || 0}" onchange="tmSetPriorityDocDelta('${esc(docId)}', this.value)">
                    <button class="tm-btn tm-btn-gray" onclick="tmRemovePriorityDocDelta('${esc(docId)}')">删除</button>
                </div>
            `;
        }).join('');

        const dueRows = (Array.isArray(cfg.dueRanges) ? cfg.dueRanges : []).map((r, i) => `
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                <span style="width:70px;color:var(--tm-secondary-text);">≤ 天数</span>
                <input class="tm-input" style="width:120px;" type="number" value="${Number(r.days) || 0}" onchange="tmSetPriorityDueRange(${i}, 'days', this.value)">
                <span style="width:40px;color:var(--tm-secondary-text);">加分</span>
                <input class="tm-input" style="width:120px;" type="number" value="${Number(r.delta) || 0}" onchange="tmSetPriorityDueRange(${i}, 'delta', this.value)">
                <button class="tm-btn tm-btn-gray" onclick="tmRemovePriorityDueRange(${i})">删除</button>
            </div>
        `).join('');

        const durRows = (Array.isArray(cfg.durationBuckets) ? cfg.durationBuckets : []).map((b, i) => `
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                <span style="width:70px;color:var(--tm-secondary-text);">≤ 分钟</span>
                <input class="tm-input" style="width:120px;" type="number" value="${Number(b.maxMinutes) || 0}" onchange="tmSetPriorityDurationBucket(${i}, 'maxMinutes', this.value)">
                <span style="width:40px;color:var(--tm-secondary-text);">加分</span>
                <input class="tm-input" style="width:120px;" type="number" value="${Number(b.delta) || 0}" onchange="tmSetPriorityDurationBucket(${i}, 'delta', this.value)">
                <button class="tm-btn tm-btn-gray" onclick="tmRemovePriorityDurationBucket(${i})">删除</button>
            </div>
        `).join('');

        return `
            <div class="tm-box" style="width: 720px; height: auto; max-height: 86vh;">
                <div class="tm-header">
                    <div style="font-size: 16px; font-weight: 700; color: var(--tm-text-color);">⚙️ 优先级算法</div>
                    <button class="tm-btn tm-btn-gray" onclick="closePriorityScoreSettings()">关闭</button>
                </div>
                <div style="padding: 14px; overflow: auto;">
                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">基础分</div>
                        <input class="tm-input" type="number" value="${Number(cfg.base) || 100}" onchange="tmSetPriorityBase(this.value)" style="width: 160px;">
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">权重（微调）</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            <label style="display:flex;align-items:center;gap:6px;">重要性 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.importance) || 1}" onchange="tmSetPriorityWeight('importance', this.value)"></label>
                            <label style="display:flex;align-items:center;gap:6px;">状态 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.status) || 1}" onchange="tmSetPriorityWeight('status', this.value)"></label>
                            <label style="display:flex;align-items:center;gap:6px;">完成时间 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.due) || 1}" onchange="tmSetPriorityWeight('due', this.value)"></label>
                            <label style="display:flex;align-items:center;gap:6px;">时长 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.duration) || 1}" onchange="tmSetPriorityWeight('duration', this.value)"></label>
                            <label style="display:flex;align-items:center;gap:6px;">文档 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.doc) || 1}" onchange="tmSetPriorityWeight('doc', this.value)"></label>
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">重要性加减分</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            <label style="display:flex;align-items:center;gap:6px;">高 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.high) || 0}" onchange="tmSetPriorityImportance('high', this.value)"></label>
                            <label style="display:flex;align-items:center;gap:6px;">中 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.medium) || 0}" onchange="tmSetPriorityImportance('medium', this.value)"></label>
                            <label style="display:flex;align-items:center;gap:6px;">低 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.low) || 0}" onchange="tmSetPriorityImportance('low', this.value)"></label>
                            <label style="display:flex;align-items:center;gap:6px;">无 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.none) || 0}" onchange="tmSetPriorityImportance('none', this.value)"></label>
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">状态加减分</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            ${statuses.map(s => `
                                <label style="display:flex;align-items:center;gap:6px;">
                                    ${esc(s.name || s.id)}
                                    <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.statusDelta[s.id]) || 0}" onchange="tmSetPriorityStatus('${esc(s.id)}', this.value)">
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                            <div style="font-weight: 700;">完成时间接近度（按“≤ 天数”匹配）</div>
                            <button class="tm-btn tm-btn-secondary" onclick="tmAddPriorityDueRange()">+ 添加</button>
                        </div>
                        ${dueRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                            <div style="font-weight: 700;">时长分段（分钟）</div>
                            <button class="tm-btn tm-btn-secondary" onclick="tmAddPriorityDurationBucket()">+ 添加</button>
                        </div>
                        ${durRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                            <div style="font-weight: 700;">文档加减分</div>
                            <button class="tm-btn tm-btn-secondary" onclick="tmAddPriorityDocDelta()">+ 添加</button>
                        </div>
                        ${docRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>
                </div>
                <div class="tm-settings-footer" style="padding: 12px 14px;">
                    <button class="tm-btn tm-btn-secondary" onclick="closePriorityScoreSettings()">取消</button>
                    <button class="tm-btn tm-btn-success" onclick="savePriorityScoreSettings()">保存</button>
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
        state.priorityModal.innerHTML = __tmRenderPriorityScoreSettings();
        document.body.appendChild(state.priorityModal);
    }
    window.showPriorityScoreSettings = showPriorityScoreSettings;

    function __tmRerenderPriorityScoreSettings() {
        if (!state.priorityModal) return;
        state.priorityModal.innerHTML = __tmRenderPriorityScoreSettings();
    }

    window.closePriorityScoreSettings = function() {
        if (state.priorityModal) {
            state.priorityModal.remove();
            state.priorityModal = null;
        }
        state.priorityScoreDraft = null;
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
        row[field] = Number(value) || 0;
        __tmRerenderPriorityScoreSettings();
    };
    window.tmAddPriorityDocDelta = function() {
        if (!state.priorityScoreDraft) return;
        if (!state.priorityScoreDraft.docDeltas || typeof state.priorityScoreDraft.docDeltas !== 'object') state.priorityScoreDraft.docDeltas = {};
        const docs = state.allDocuments || [];
        const docId = String((docs[0] && docs[0].id) || '').trim();
        if (!docId) return;
        if (state.priorityScoreDraft.docDeltas[docId] === undefined) state.priorityScoreDraft.docDeltas[docId] = 0;
        __tmRerenderPriorityScoreSettings();
    };
    window.tmSetPriorityDocDelta = function(docId, value) {
        if (!state.priorityScoreDraft) return;
        if (!state.priorityScoreDraft.docDeltas || typeof state.priorityScoreDraft.docDeltas !== 'object') state.priorityScoreDraft.docDeltas = {};
        state.priorityScoreDraft.docDeltas[docId] = Number(value) || 0;
        __tmRerenderPriorityScoreSettings();
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

    window.addNewRule = function() {
        const newRule = RuleManager.createRule('新规则');
        state.editingRule = newRule;
        if (state.rulesModal) {
            state.rulesModal.querySelector('.tm-rules-body').innerHTML = renderRulesList();
        }
    };

    window.editRule = function(ruleId) {
        const rule = state.filterRules.find(r => r.id === ruleId);
        if (rule) {
            state.editingRule = JSON.parse(JSON.stringify(rule));
            if (state.rulesModal) {
                state.rulesModal.querySelector('.tm-rules-body').innerHTML = renderRulesList();
            }
        }
    };

    window.cancelEditRule = function() {
        state.editingRule = null;
        if (state.rulesModal) {
            state.rulesModal.querySelector('.tm-rules-body').innerHTML = renderRulesList();
        }
    };

    window.saveEditRule = function() {
        if (!state.editingRule) return;
        
        const index = state.filterRules.findIndex(r => r.id === state.editingRule.id);
        if (index >= 0) {
            state.filterRules[index] = state.editingRule;
        } else {
            state.filterRules.push(state.editingRule);
        }
        
        state.editingRule = null;
        if (state.rulesModal) {
            state.rulesModal.querySelector('.tm-rules-body').innerHTML = renderRulesList();
        }
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
        
        if (state.rulesModal) {
            state.rulesModal.querySelector('.tm-rule-conditions').innerHTML = renderConditions(state.editingRule.conditions);
        }
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
            if (state.rulesModal) {
                const conditionsDiv = state.rulesModal.querySelector('.tm-rule-conditions');
                conditionsDiv.innerHTML = renderConditions(state.editingRule.conditions);
            }
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
            if (state.rulesModal) {
                const conditionsDiv = state.rulesModal.querySelector('.tm-rule-conditions');
                conditionsDiv.innerHTML = renderConditions(state.editingRule.conditions);
            }
        }
    };

    window.addSortRule = function() {
        if (!state.editingRule) return;
        
        state.editingRule.sort.push({
            field: 'priority',
            order: 'desc'
        });
        
        if (state.rulesModal) {
            const sortDiv = state.rulesModal.querySelector('.tm-rule-sort-items');
            sortDiv.innerHTML = renderSortRules(state.editingRule.sort);
        }
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
            if (state.rulesModal) {
                const sortDiv = state.rulesModal.querySelector('.tm-rule-sort-items');
                sortDiv.innerHTML = renderSortRules(state.editingRule.sort);
            }
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
        if (state.rulesModal) {
            const sortDiv = state.rulesModal.querySelector('.tm-rule-sort-items');
            sortDiv.innerHTML = renderSortRules(state.editingRule.sort);
        }
    };

    window.toggleRuleEnabled = function(ruleId, enabled) {
        const rule = state.filterRules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = enabled;
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
            if (state.rulesModal) {
                state.rulesModal.querySelector('.tm-rules-body').innerHTML = renderRulesList();
            }
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
        hint('✅ 所有规则已保存（已同步到云端）', 'success');
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

        // 父任务完成则子任务不显示
        tasks = tasks.filter(t => !hasDoneAncestor(t));

        tasks.forEach(t => {
            try { t.priorityScore = __tmComputePriorityScore(t); } catch (e) { t.priorityScore = 0; }
        });
        
        // 应用当前规则
        if (state.currentRule) {
            const rule = state.filterRules.find(r => r.id === state.currentRule);
            if (rule) {
                // 应用筛选
                tasks = RuleManager.applyRuleFilter(tasks, rule);
                
                // 应用排序
                tasks = RuleManager.applyRuleSort(tasks, rule);
            }
        } else {
            // 即使没有选择规则，也要应用置顶排序
            tasks = RuleManager.applyRuleSort(tasks, null);
        }
        
        // 关键词搜索
        if (state.searchKeyword) {
            const keyword = state.searchKeyword.toLowerCase();
            tasks = tasks.filter(task => 
                String(task.content || '').toLowerCase().includes(keyword) ||
                String(task.remark || '').toLowerCase().includes(keyword) ||
                String(task.docName || '').toLowerCase().includes(keyword)
            );
        }

        // 将子任务一同带上（父任务命中时）
        const expanded = [];
        const added = new Set();
        const addWithChildren = (task) => {
            if (!task || added.has(task.id)) return;
            added.add(task.id);
            expanded.push(task);
            if (task.done) return;
            const children = (task.children || []).filter(c => !hasDoneAncestor(c));
            children.forEach(child => addWithChildren(child));
        };
        tasks.forEach(t => addWithChildren(t));

        state.filteredTasks = expanded;
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

    window.tmSwitchDocGroup = async function(groupId) {
        SettingsStore.data.currentGroupId = groupId;
        await SettingsStore.save();
        loadSelectedDocuments();
    };

    // 修改渲染函数以显示规则信息
    function render() {
        // 保存滚动位置
        let savedScrollTop = 0;
        if (state.modal) {
            const body = state.modal.querySelector('.tm-body');
            if (body) savedScrollTop = body.scrollTop;
            state.modal.remove();
        }
        
        // 应用字体大小
        document.documentElement.style.setProperty('--tm-font-size', (__tmGetFontSize()) + 'px');

        const { totalTasks, doneTasks, queryTime } = state.stats;
        const todoTasks = totalTasks - doneTasks;
        const filteredCount = state.filteredTasks.length;
        
        const currentRule = state.currentRule ? 
            state.filterRules.find(r => r.id === state.currentRule) : null;

        const visibleDocs = state.taskTree.filter(doc => __tmDocHasUndoneTasks(doc));
            
        // 获取文档分组信息
        const docGroups = SettingsStore.data.docGroups || [];
        const currentGroupId = SettingsStore.data.currentGroupId || 'all';
        const currentGroup = docGroups.find(g => g.id === currentGroupId);
        const groupName = currentGroupId === 'all' ? '全部文档' : (currentGroup ? currentGroup.name : '未知分组');
        const isMobile = __tmIsMobileDevice();
        
        state.modal = document.createElement('div');
        state.modal.className = 'tm-modal' + (__tmMountEl ? ' tm-modal--tab' : '');
        
        // 构建规则选择选项
        const ruleOptions = state.filterRules
            .filter(rule => rule.enabled)
            .map(rule => `<option value="${rule.id}" ${state.currentRule === rule.id ? 'selected' : ''}>
                ${esc(rule.name)}
            </option>`)
            .join('');
        
        state.modal.innerHTML = `
            <div class="tm-box">
                <div class="tm-filter-rule-bar" style="padding: 8px 12px;">
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                        <div style="font-size: 16px; font-weight: 700; white-space: nowrap;">📋 任务管理器</div>
                        <button class="tm-btn tm-btn-info" onclick="tmRefresh()" style="padding: 4px 10px;">刷新</button>
                        <button class="tm-btn tm-btn-success" onclick="tmAdd()" style="padding: 4px 10px;">+ 新建</button>
                        ${isMobile ? `<button class="tm-btn tm-btn-gray" onclick="tmClose();return false;" ontouchstart="tmClose();return false;" style="padding: 4px 10px;">关闭</button>` : ''}

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
                                <span class="tm-rule-name">${esc(currentRule.name)}</span>
                                <span class="tm-rule-stats">${filteredCount} 个任务</span>
                            </div>
                        ` : ''}
                    </div>

                    <div class="tm-search-box" style="flex-wrap: wrap;">
                        <button class="tm-btn tm-btn-info" onclick="tmShowSearchModal()" style="padding: 4px 10px; display: flex; align-items: center; gap: 4px;">
                            🔍 搜索 ${state.searchKeyword ? `<span style="background:rgba(255,255,255,0.2); padding:0 4px; border-radius:4px; font-size:11px;">${state.searchKeyword}</span>` : ''}
                        </button>
                        ${state.searchKeyword ? `<button class="tm-btn tm-btn-secondary" onclick="tmSearch('')" style="padding: 4px 10px;">清除</button>` : ''}

                        <label style="display:flex;align-items:center;gap:6px;color:white;font-size:13px;cursor:pointer;">
                            <input type="checkbox" ${state.groupByDocName ? 'checked' : ''} onchange="toggleGroupByDocName(this.checked)">
                            按文档分组
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;color:white;font-size:13px;cursor:pointer;">
                            <input type="checkbox" ${state.groupByTime ? 'checked' : ''} onchange="toggleGroupByTime(this.checked)">
                            按时间分组
                        </label>
                    </div>
                </div>

                <div class="tm-doc-tabs">
                    <div style="display:flex; gap:8px; overflow-x:auto; flex:1; align-items:center; padding-bottom: 2px;">
                        <div class="tm-doc-tab ${state.activeDocId === 'all' ? 'active' : ''}" onclick="tmSwitchDoc('all')">全部</div>
                        ${visibleDocs.map(doc => {
                            const isActive = state.activeDocId === doc.id;
                            return `<div class="tm-doc-tab ${isActive ? 'active' : ''}" onclick="tmSwitchDoc('${doc.id}')">${esc(doc.name)}</div>`;
                        }).join('')}
                    </div>
                    <div style="border-left:1px solid var(--tm-border-color); padding-left:8px; margin-left:8px; display:flex; gap:8px;">
                         <button class="tm-btn tm-btn-info" onclick="tmCollapseAllTasks()" style="padding: 2px 8px; font-size: 12px;">▸ 折叠</button>
                         <button class="tm-btn tm-btn-info" onclick="tmExpandAllTasks()" style="padding: 2px 8px; font-size: 12px;">▾ 展开</button>
                         <button class="tm-btn tm-btn-info" onclick="showSettings()" style="padding: 2px 8px; font-size: 12px;">⚙️ 设置</button>
                         <button class="tm-btn tm-btn-info" onclick="showRulesManager()" style="padding: 2px 8px; font-size: 12px;">📋 规则</button>
                    </div>
                </div>
                
                <style>
                    .tm-doc-tabs {
                        display: flex;
                        align-items: center;
                        padding: 8px 15px;
                        border-bottom: 1px solid var(--tm-border-color);
                        background: var(--tm-header-bg);
                    }
                    .tm-doc-tabs > div::-webkit-scrollbar {
                        height: 4px;
                    }
                    .tm-doc-tabs > div::-webkit-scrollbar-thumb {
                        background: var(--tm-border-color);
                        border-radius: 2px;
                    }
                    .tm-doc-tab {
                        padding: 4px 12px;
                        border-radius: 4px;
                        background: var(--tm-bg-color);
                        color: var(--tm-text-color);
                        font-size: 13px;
                        cursor: pointer;
                        white-space: nowrap;
                        border: 1px solid var(--tm-border-color);
                        transition: all 0.2s;
                        user-select: none;
                        height: 26px;
                        line-height: 16px;
                        display: flex;
                        align-items: center;
                    }
                    .tm-doc-tab:hover {
                        background: var(--tm-hover-bg);
                    }
                    .tm-doc-tab.active {
                        background: var(--tm-primary-color);
                        color: white;
                        border-color: var(--tm-primary-color);
                    }
                </style>
                
                <div class="tm-body">
                    <table class="tm-table" id="tmTaskTable">
                        <thead>
                            <tr>
                                ${(() => {
                                    const colOrder = SettingsStore.data.columnOrder || ['pinned', 'content', 'status', 'score', 'doc', 'h2', 'priority', 'completionTime', 'duration', 'remark'];
                                    const widths = SettingsStore.data.columnWidths || {};
                                    const headers = {
                                        pinned: `<th data-col="pinned" style="width: ${widths.pinned || 48}px; min-width: ${widths.pinned || 48}px; max-width: ${widths.pinned || 48}px; text-align: center; white-space: nowrap; overflow: hidden;">📌<span class="tm-col-resize" onmousedown="startColResize(event, 'pinned')"></span></th>`,
                                        content: `<th data-col="content" style="width: ${widths.content || 360}px; min-width: ${widths.content || 360}px; max-width: ${widths.content || 360}px; white-space: nowrap; overflow: hidden;">任务内容<span class="tm-col-resize" onmousedown="startColResize(event, 'content')"></span></th>`,
                                        score: `<th data-col="score" style="width: ${widths.score || 96}px; min-width: ${widths.score || 96}px; max-width: ${widths.score || 96}px; text-align: center; white-space: nowrap; overflow: hidden;">优先级<span class="tm-col-resize" onmousedown="startColResize(event, 'score')"></span></th>`,
                                        doc: `<th data-col="doc" style="width: ${widths.doc || 180}px; min-width: ${widths.doc || 180}px; max-width: ${widths.doc || 180}px; white-space: nowrap; overflow: hidden;">文档<span class="tm-col-resize" onmousedown="startColResize(event, 'doc')"></span></th>`,
                                        h2: `<th data-col="h2" style="width: ${widths.h2 || 180}px; min-width: ${widths.h2 || 180}px; max-width: ${widths.h2 || 180}px; white-space: nowrap; overflow: hidden;">二级标题<span class="tm-col-resize" onmousedown="startColResize(event, 'h2')"></span></th>`,
                                        priority: `<th data-col="priority" style="width: ${widths.priority || 96}px; min-width: ${widths.priority || 96}px; max-width: ${widths.priority || 96}px; text-align: center; white-space: nowrap; overflow: hidden;">重要性<span class="tm-col-resize" onmousedown="startColResize(event, 'priority')"></span></th>`,
                                        completionTime: `<th data-col="completionTime" style="width: ${widths.completionTime || 170}px; min-width: ${widths.completionTime || 170}px; max-width: ${widths.completionTime || 170}px; white-space: nowrap; overflow: hidden;">完成时间<span class="tm-col-resize" onmousedown="startColResize(event, 'completionTime')"></span></th>`,
                                        duration: `<th data-col="duration" style="width: ${widths.duration || 96}px; min-width: ${widths.duration || 96}px; max-width: ${widths.duration || 96}px; white-space: nowrap; overflow: hidden;">时长<span class="tm-col-resize" onmousedown="startColResize(event, 'duration')"></span></th>`,
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
            </div>
        `;
        
        __tmGetMountRoot().appendChild(state.modal);

        // 恢复滚动位置
        if (savedScrollTop > 0) {
            const newBody = state.modal.querySelector('.tm-body');
            if (newBody) newBody.scrollTop = savedScrollTop;
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

    window.tmClose = function() {
        state.openToken = (Number(state.openToken) || 0) + 1;
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
    };

    // 列宽调整功能
    let __tmResizeState = null;

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

    function normalizeTaskFields(task, docNameFallback) {
        if (!task || typeof task !== 'object') return task;

        const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';

        const p0 = task.priority ?? task.customPriority ?? task.custom_priority ?? '';
        task.priority = (p0 === 'high' || p0 === 'medium' || p0 === 'low' || p0 === 'none') ? p0 : '';
        task.duration = isValidValue(task.duration) ? String(task.duration) : (isValidValue(task.custom_duration) ? String(task.custom_duration) : '');
        task.remark = isValidValue(task.remark) ? String(task.remark) : (isValidValue(task.custom_remark) ? String(task.custom_remark) : '');
        task.completionTime = isValidValue(task.completionTime) ? String(task.completionTime) : (isValidValue(task.completion_time) ? String(task.completion_time) : '');
        task.customTime = isValidValue(task.customTime) ? String(task.customTime) : (isValidValue(task.custom_time) ? String(task.custom_time) : '');
        task.customStatus = isValidValue(task.customStatus) ? String(task.customStatus) : (isValidValue(task.custom_status) ? String(task.custom_status) : '');

        const meta = MetaStore.get(task.id);
        if (meta) {
            if ('done' in meta && meta.done !== undefined && meta.done !== null) task.done = meta.done;
            if ('pinned' in meta && isValidValue(meta.pinned)) task.pinned = meta.pinned;
            if (!isValidValue(task.priority) && isValidValue(meta.priority)) task.priority = meta.priority;
            if (!isValidValue(task.duration) && isValidValue(meta.duration)) task.duration = meta.duration;
            if (!isValidValue(task.remark) && isValidValue(meta.remark)) task.remark = meta.remark;
            if (!isValidValue(task.completionTime) && isValidValue(meta.completionTime)) task.completionTime = meta.completionTime;
            if (!isValidValue(task.customTime) && isValidValue(meta.customTime)) task.customTime = meta.customTime;
            if (!isValidValue(task.customStatus) && isValidValue(meta.customStatus)) task.customStatus = meta.customStatus;
        }

        task.docName = task.docName || task.doc_name || docNameFallback || '未知文档';
        task.parentTaskId = task.parentTaskId || task.parent_task_id || null;
        task.docId = task.docId || task.root_id || null;
        return task;
    }

    function __tmFormatDate(value) {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleDateString();
    }

    function __tmFormatTaskTime(value) {
        const s = String(value || '').trim();
        if (!s) return '-';
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 10);
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return s;
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

            const save = () => commitAndClose(input.value);
            input.onblur = () => save();
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

            const save = () => commitAndClose(input.value);
            input.onblur = () => save();
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

            const { wrap } = __tmBuildActions('保存', async () => {
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
            }, close, [clearBtn]);
            editor.appendChild(wrap);
            input.onkeydown = (e) => {
                if (e.key === 'Enter') wrap.querySelector('button.tm-btn-primary')?.click?.();
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

        console.log(`[跳转] 目标ID: ${id}`);
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
                console.log('[跳转] 使用 openMobileFileById');
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
            } catch (e) {
                console.warn('[跳转] openMobileFileById 失败，尝试其他方式:', e);
            }
        }
        
        // 2. 桌面端优先尝试 findDocumentIdByBlockId + openTab (参照 tomato.js)
        const openTab = getOpenTabFn();
        if (typeof openTab === 'function') {
            try {
                console.log('[跳转] 使用 findDocumentIdByBlockId + openTab');
                
                // 获取所在文档ID
                const sql = `SELECT root_id FROM blocks WHERE id = '${id}' LIMIT 1`;
                const res = await API.call('/api/query/sql', { stmt: sql });
                // API.call 返回的是 {code:0, data: [...]}
                const rows = (res && res.code === 0) ? res.data : [];
                const docId = (rows && rows[0]) ? rows[0].root_id : id;
                
                console.log(`[跳转] 这里的docId: ${docId}, 目标块id: ${id}`);

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
            } catch (e) {
                console.warn('[跳转] openTab 失败，尝试其他方式:', e);
            }
        }

        // 3. 兜底：模拟点击 block-ref
        try {
            console.log('[跳转] 尝试模拟 block-ref 点击');
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
        } catch (e) {
            console.warn('[跳转] 模拟点击失败:', e);
        }

        // 4. 兜底：使用 URL Scheme
        console.log('[跳转] 使用 URL Scheme 兜底');
        window.open(`siyuan://blocks/${id}`);
        closeAfterJump();
    };

// 渲染任务列表（支持跨文档全局排序）
    function renderTaskList() {
        if (state.filteredTasks.length === 0) {
            const colCount = (SettingsStore.data.columnOrder || []).length || 7;
            return `<tr><td colspan="${colCount}" style="text-align: center; padding: 40px; color: var(--tm-secondary-text);">暂无任务</td></tr>`;
        }

        const isGloballyLocked = GlobalLock.isLocked();
        const colCount = (SettingsStore.data.columnOrder || []).length || 7;

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
            const { done, content, priority, completionTime, duration, remark, docName, pinned } = task;
            const indent = Math.max(0, Number(depth) || 0) * 12;
            const toggle = hasChildren
                ? `<span class="tm-tree-toggle" onclick="tmToggleCollapse('${task.id}', event)">${collapsed ? '▸' : '▾'}</span>`
                : `<span class="tm-tree-spacer"></span>`;

            const widths = SettingsStore.data.columnWidths || {};
            const colOrder = SettingsStore.data.columnOrder || ['pinned', 'content', 'status', 'score', 'doc', 'h2', 'priority', 'completionTime', 'duration', 'remark'];

            const cells = {
                pinned: () => `
                    <td style="text-align: center; width: ${widths.pinned || 48}px; min-width: ${widths.pinned || 48}px; max-width: ${widths.pinned || 48}px;">
                        <input type="checkbox" ${pinned ? 'checked' : ''}
                               onchange="tmSetPinned('${task.id}', this.checked, event)"
                               title="置顶">
                    </td>`,
                content: () => `
                    <td style="width: ${widths.content || 360}px; min-width: ${widths.content || 360}px; max-width: ${widths.content || 360}px;">
                        <div class="tm-task-cell" style="padding-left:${indent}px">
                            ${toggle}
                            <input class="tm-task-checkbox ${isGloballyLocked ? 'tm-operating' : ''}"
                                   type="checkbox" ${done ? 'checked' : ''}
                                   ${isGloballyLocked ? 'disabled' : ''}
                                   onchange="tmSetDone('${task.id}', this.checked, event)">
                            <span class="tm-task-text ${done ? 'tm-task-done' : ''} tm-task-content-clickable"
                                  onclick="tmJumpToTask('${task.id}', event)"
                                  title="点击跳转到文档">${esc(content)}</span>
                        </div>
                    </td>`,
                doc: () => `
                    <td style="width: ${widths.doc || 180}px; min-width: ${widths.doc || 180}px; max-width: ${widths.doc || 180}px;" title="${esc(docName || '')}">${esc(docName || '-')}</td>`,
                h2: () => `
                    <td style="width: ${widths.h2 || 180}px; min-width: ${widths.h2 || 180}px; max-width: ${widths.h2 || 180}px;" title="${esc(task.h2 || '')}">${esc(task.h2 || '-')}</td>`,
                score: () => {
                    const v = Number.isFinite(Number(task.priorityScore)) ? Math.round(Number(task.priorityScore)) : 0;
                    return `<td style="width: ${widths.score || 96}px; min-width: ${widths.score || 96}px; max-width: ${widths.score || 96}px; text-align: center; font-variant-numeric: tabular-nums;">${v}</td>`;
                },
                priority: () => {
                    const priorityClass = priority === 'high' ? 'tm-priority-high' : priority === 'low' ? 'tm-priority-low' : priority === 'medium' ? 'tm-priority-medium' : 'tm-priority-none';
                    const priorityText = priority ? ({ high: '高', medium: '中', low: '低' }[priority] || '无') : '无';
                    return `<td class="${priorityClass} tm-cell-editable" style="width: ${widths.priority || 96}px; min-width: ${widths.priority || 96}px; max-width: ${widths.priority || 96}px; text-align: center;" onclick="tmPickPriority('${task.id}', this, event)">${priorityText}</td>`;
                },
                completionTime: () => `
                    <td class="tm-cell-editable" style="width: ${widths.completionTime || 170}px; min-width: ${widths.completionTime || 170}px; max-width: ${widths.completionTime || 170}px;" onclick="tmBeginCellEdit('${task.id}','completionTime',this,event)">${__tmFormatTaskTime(completionTime)}</td>`,
                duration: () => `
                    <td class="tm-cell-editable" style="width: ${widths.duration || 96}px; min-width: ${widths.duration || 96}px; max-width: ${widths.duration || 96}px;" onclick="tmBeginCellEdit('${task.id}','duration',this,event)">${esc(duration || '-')}</td>`,
                remark: () => `
                    <td class="tm-cell-editable" style="width: ${widths.remark || 240}px; min-width: ${widths.remark || 240}px; max-width: ${widths.remark || 240}px;" title="${esc(remark || '')}" onclick="tmBeginCellEdit('${task.id}','remark',this,event)">${esc(remark || '-')}</td>`,
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

            let rowHtml = `<tr data-id="${task.id}" oncontextmenu="tmShowTaskContextMenu(event, '${task.id}')">`;
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
        if (state.groupByDocName) {
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
                const docPinned = docRootTasks.filter(t => t.pinned);
                const docNormal = docRootTasks.filter(t => !t.pinned);

                // 渲染文档标题（支持折叠）
                const docName = docEntry.name || '未知文档';
                const groupKey = `doc_${docId}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                const toggle = `<span class="tm-group-toggle" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;margin-right:8px;display:inline-block;width:12px;">${isCollapsed ? '▸' : '▾'}</span>`;

                allRows.push(`<tr class="tm-group-row"><td colspan="${colCount}" style="background:var(--tm-header-bg);padding:8px 12px;font-weight:bold;color:var(--tm-text-color);border-bottom:1px solid var(--tm-border-color);">${toggle}📄 ${esc(docName)} <span style="font-weight:normal;color:var(--tm-secondary-text);font-size:12px;background:var(--tm-doc-count-bg);padding:1px 6px;border-radius:10px;margin-left:4px;">${docTasks.length}</span></td></tr>`);

                // 渲染该文档的任务（如果未折叠）
                if (!isCollapsed) {
                    docPinned.forEach(task => {
                        allRows.push(...renderTaskTree(task, 0));
                    });
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

            sortedGroups.forEach(group => {
                const isCollapsed = state.collapsedGroups?.has(group.key);
                const toggle = `<span class="tm-group-toggle" onclick="tmToggleGroupCollapse('${group.key}', event)" style="cursor:pointer;margin-right:8px;display:inline-block;width:12px;">${isCollapsed ? '▸' : '▾'}</span>`;

                allRows.push(`<tr class="tm-group-row"><td colspan="${colCount}" style="background:var(--tm-header-bg);padding:8px 12px;font-weight:bold;color:var(--tm-text-color);border-bottom:1px solid var(--tm-border-color);">${toggle}${group.label} <span style="font-weight:normal;color:var(--tm-secondary-text);font-size:12px;background:var(--tm-doc-count-bg);padding:1px 6px;border-radius:10px;margin-left:4px;">${group.items.length}</span></td></tr>`);

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
            console.log('[全局锁] 已锁定，所有复选框禁用');
        },

        unlock() {
            this.locked = false;
            this.timer = null;
            this.updateUI();
            console.log('[全局锁] 已解锁');
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
            console.log(`[树保护] 已保存 ${TreeProtector.snapshot.size} 个任务状态`);
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
                // 调试日志
                const metaBefore = MetaStore.get(t.id);
                console.log(`[Meta保存] 任务 ${t.id.slice(-6)}: priority='${t.priority}', remark='${t.remark}' (MetaStore已有: ${JSON.stringify(metaBefore || {})})`);

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
        console.log(`[Meta备份] 已保存 ${savedCount} 个任务到 MetaStore`);

        // 调试：验证保存后的 MetaStore 内容
        setTimeout(() => {
            console.log('[Meta验证] 保存后检查 MetaStore:');
            const docAfter = state.taskTree.find(d => d.id === docId);
            if (docAfter && docAfter.tasks) {
                const checkTasks = (tasks, level = 0) => {
                    tasks.forEach(t => {
                        const meta = MetaStore.get(t.id);
                        console.log(`  ${'  '.repeat(level)}任务 ${t.id.slice(-6)}: MetaStore=${JSON.stringify(meta || {})}`);
                        if (t.children && t.children.length > 0) {
                            checkTasks(t.children, level + 1);
                        }
                    });
                };
                checkTasks(docAfter.tasks);
            }
        }, 50);

        // 注意：不要在这里 render()，因为还没点击复选框
        // render() 会在从DOM读取实际状态后调用

        try {
            // 优先尝试 API 更新（解决文档未打开无法操作的问题）
            let apiSuccess = false;
            let clickSuccess = false;
            try {
                console.log(`[完成状态] 准备API更新: ${id} -> ${targetDone}`);
                
                // 1. 获取 kramdown
                const kramdown = await API.getBlockKramdown(id);
                // 使用 console.warn 确保在某些过滤级别下可见
                console.warn(`[完成状态] ID=${id} kramdown内容: >>>${kramdown}<<<`);

                if (kramdown) {
                    // 2. 正则匹配：匹配行首的任务标记，容忍前面的空白
                    // 匹配：(任意空白)(*或-或数字.)(任意空白)[(空格或xX)](右括号)
                    const statusRegex = /^(\s*(?:[\*\-]|\d+\.)\s*\[)([ xX])(\])/;
                    const match = kramdown.match(statusRegex);
                    
                    if (match) {
                        const currentStatusChar = match[2];
                        const isCurrentlyDone = currentStatusChar !== ' ';
                        console.log(`[完成状态] 解析当前状态: '${currentStatusChar}' (done=${isCurrentlyDone})`);

                        if (isCurrentlyDone === targetDone) {
                            apiSuccess = true;
                            console.log('[完成状态] 状态已一致，无需更新');
                        } else {
                            // 3. 构造新的 kramdown
                            const newStatusChar = targetDone ? 'x' : ' ';
                            const newKramdown = kramdown.replace(statusRegex, `$1${newStatusChar}$3`);
                            
                            console.log(`[完成状态] 准备提交更新: >>>${newKramdown}<<<`);
                            
                            // 4. 调用 updateBlock
                            const res = await API.call('/api/block/updateBlock', {
                                dataType: 'markdown',
                                data: newKramdown,
                                id: id
                            });
                            
                            if (res && res.code === 0) {
                                apiSuccess = true;
                                console.log('[完成状态] API更新成功');
                            } else {
                                console.error('[完成状态] API更新失败:', res);
                            }
                        }
                    } else {
                        console.warn('[完成状态] 正则匹配失败，尝试宽松匹配');
                        // Fallback: 尝试查找内容中的第一个复选框标记（即使不在行首）
                        const fallbackRegex = /(\[)([ xX])(\])/;
                        const fallbackMatch = kramdown.match(fallbackRegex);
                        if (fallbackMatch) {
                             console.log('[完成状态] 使用宽松正则匹配成功');
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
                                console.log('[完成状态] 宽松匹配API更新成功');
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
                console.log(`[完成状态] API 未成功，尝试模拟点击，targetDone=${targetDone}`);

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
                    console.log(`[完成状态] 找到复选框元素`);
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
                        console.log(`[完成状态] 直接点击 checkbox input 元素`);
                        // 直接修改 checkbox 状态
                        checkboxInput.checked = targetDone;
                        // 触发 change 事件
                        const changeEvent = new Event('change', {
                            bubbles: true,
                            cancelable: true
                        });
                        checkboxInput.dispatchEvent(changeEvent);
                        console.log(`[完成状态] checkbox input 已设为 checked=${checkboxInput.checked}`);
                    }

                    clickSuccess = true;
                    console.log(`[完成状态] 事件已触发`);
                } else {
                    console.log(`[完成状态] 未找到 protyle-action--task 元素`);
                }
            } else {
                console.log(`[完成状态] 未找到任务元素`);
            }

            // 等待思源处理完成
            await new Promise(r => setTimeout(r, 150));

            // 直接使用 targetDone 作为实际状态
            // 因为我们已经模拟点击了思源的复选框，思源会正确处理状态变化
            const actualDone = targetDone;
            console.log(`[完成状态] 使用目标状态: actualDone=${actualDone}, targetDone=${targetDone}`);

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
            console.log(`[完成状态] 已保存到MetaStore（ID: ${id.slice(-6)}，done=${actualDone}）`);

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
                console.log(`[匹配] 找到任务 "${oldContent}" (深度=${depth})`);
                return t;
            }
            if (t.children && t.children.length > 0) {
                const found = findTaskByContent(t.children, content, depth + 1);
                if (found) return found;
            }
        }
        console.log(`[匹配] 未找到任务 "${content}"`);
        return null;
    }

    // ============ 受保护的重载（带树恢复） ============
    // manualRelationships: 可选，Map<childId, parentTaskId>，用于在SQL索引未更新时强制指定父子关系
    // injectedTasks: 可选，Array<Task>，用于在SQL索引未更新时强制注入新任务（乐观更新）
    async function reloadDocTasksProtected(docId, expectId = null, manualRelationships = null, injectedTasks = null) {
        console.log(`[受保护重载] 文档 ${docId.slice(-6)} ${expectId ? '(等待ID: ' + expectId.slice(-6) + ')' : ''}`);

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
                    console.log(`[重载] 成功找到新ID ${expectId.slice(-6)} (重试 ${retries} 次)`);
                    break;
                }
                
                // 如果是最后一次重试，仍然使用当前结果
                if (retries === maxRetries - 1) {
                    console.warn(`[重载] 超时仍未找到新ID ${expectId.slice(-6)}，使用当前结果`);
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
                    console.log(`[乐观更新] 强制注入任务 ${injected.id.slice(-6)}`);
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
                            console.log(`[内容映射] "${key.slice(0, 15)}" -> MetaStore数据: done=${meta.done}, priority=${meta.priority}`);
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
                console.log(`[内容恢复] 任务 "${contentKey.slice(0, 15)}" 通过内容匹配找回MetaStore数据: done=${oldMeta.done}, priority=${oldMeta.priority}`);
                meta = oldMeta;

                // 同时保存到当前ID下，确保后续能直接读取
                MetaStore.set(t.id, oldMeta);
            } else if (Object.keys(meta).length > 0) {
                console.log(`[Meta读取] 任务 ${t.id.slice(-6)} 直接从 MetaStore 读取: done=${meta.done}, priority=${meta.priority}`);
            }

            // 调试日志：检查是否从 MetaStore 读取到属性
            if (meta.priority || meta.duration || meta.remark || meta.completionTime || meta.customTime) {
                console.log(`[Meta读取] 任务 ${t.id.slice(-6)} 从 MetaStore 读取到属性:`, {
                    priority: meta.priority,
                    duration: meta.duration,
                    remark: meta.remark,
                    completionTime: meta.completionTime,
                    customTime: meta.customTime
                });
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
                // 所有自定义属性都从 MetaStore 读取，忽略 SQL 查询的值
                priority: meta.priority || '',
                duration: meta.duration || '',
                remark: meta.remark || '',
                completionTime: meta.completionTime || '',
                customTime: meta.customTime || ''
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
                        // console.log(`[树恢复] 使用旧关系恢复子任务: ${t.id.slice(-6)} -> ${parentTask.id.slice(-6)}`);
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
                            console.log(`[ID映射] 内容匹配 "${t.content?.slice(0, 15)}": ${t.id.slice(-6)} -> ${newTask.id.slice(-6)}`);

                            // 如果MetaStore中有旧ID的数据，复制到新ID
                            const oldMeta = MetaStore.get(t.id);
                            if (oldMeta) {
                                // 不覆盖新ID已有的数据
                                const newMeta = MetaStore.get(newTask.id) || {};
                                const mergedMeta = { ...oldMeta, ...newMeta };
                                MetaStore.set(newTask.id, mergedMeta);
                                console.log(`[Meta同步] 已将旧ID ${t.id.slice(-6)} 的数据同步到新ID ${newTask.id.slice(-6)}`);
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
        console.log(`[树恢复] 已建立 ${TreeProtector.idMapping.size} 个ID映射`);

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

        // 调试：验证 state.flatTasks 中的数据
        console.log('[验证] 重新加载后 state.flatTasks 中的任务属性:');
        Object.keys(state.flatTasks).forEach(key => {
            const t = state.flatTasks[key];
            if (t.root_id === docId) {
                console.log(`  任务 ${key.slice(-6)}: priority='${t.priority}', duration='${t.duration}', remark='${t.remark}'`);
            }
        });

        state.stats.queryTime = queryTime || 0;
        recalcStats();
        applyFilters();

        // 调试：检查 state.taskTree 中的数据
        const docAfter = state.taskTree.find(d => d.id === docId);
        if (docAfter && docAfter.tasks) {
            console.log('[验证] state.taskTree 中的任务属性:');
            const checkTasks = (tasks, level = 0) => {
                tasks.forEach(t => {
                    console.log(`  ${'  '.repeat(level)}任务 ${t.id.slice(-6)}: priority='${t.priority}', duration='${t.duration}', remark='${t.remark}'`);
                    if (t.children && t.children.length > 0) {
                        checkTasks(t.children, level + 1);
                    }
                });
            };
            checkTasks(docAfter.tasks);
        }

        render();

        // 调试：验证 render 后 state.flatTasks 中的数据
        setTimeout(() => {
            console.log('[验证] render 后 state.flatTasks 中的任务属性:');
            Object.keys(state.flatTasks).forEach(key => {
                const t = state.flatTasks[key];
                if (t.root_id === docId) {
                    console.log(`  任务 ${key.slice(-6)}: priority='${t.priority}', duration='${t.duration}', remark='${t.remark}'`);
                }
            });
        }, 100);

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
            editor.style.minWidth = '140px';
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.gap = '6px';
            wrap.style.justifyContent = 'space-between';
            const mk = (value, label) => {
                const b = document.createElement('button');
                b.className = 'tm-btn tm-btn-info';
                b.style.padding = '4px 8px';
                b.style.fontSize = '12px';
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
            wrap.appendChild(mk('', '无'));
            wrap.appendChild(mk('high', '高'));
            wrap.appendChild(mk('medium', '中'));
            wrap.appendChild(mk('low', '低'));
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
            editor.style.minWidth = '160px';
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';
            
            const options = SettingsStore.data.customStatusOptions || [];
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
        const timer = globalThis.__tomatoTimer;
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

        menu.appendChild(createItem('✏️ 编辑', () => tmEdit(taskId)));
        menu.appendChild(createItem('⏰ 提醒', () => tmReminder(taskId)));
        menu.appendChild(createItem('🗑️ 删除', () => tmDelete(taskId), true));

        document.body.appendChild(menu);

        // Click outside to close
        const closeHandler = () => {
            menu.remove();
            document.removeEventListener('click', closeHandler);
            document.removeEventListener('contextmenu', closeHandler);
        };
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
            document.addEventListener('contextmenu', closeHandler);
        }, 0);
    };

    function __tmResolveDefaultDocId() {
        const groupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const byGroup = (SettingsStore.data.defaultDocIdByGroup && typeof SettingsStore.data.defaultDocIdByGroup === 'object')
            ? SettingsStore.data.defaultDocIdByGroup
            : {};
        if (groupId !== 'all') {
            const groupConfigured = String(byGroup[groupId] || '').trim();
            if (groupConfigured) {
                const exists = state.taskTree.some(d => d.id === groupConfigured) || state.allDocuments.some(d => d.id === groupConfigured);
                if (exists) return groupConfigured;
            }
        }
        const configured = String(SettingsStore.data.defaultDocId || '').trim();
        if (configured) {
            const exists = state.taskTree.some(d => d.id === configured) || state.allDocuments.some(d => d.id === configured);
            if (exists) return configured;
        }
        if (state.activeDocId && state.activeDocId !== 'all') return state.activeDocId;
        if (state.taskTree && state.taskTree.length > 0) return state.taskTree[0].id;
        if (state.selectedDocIds && state.selectedDocIds.length > 0) return state.selectedDocIds[0];
        return null;
    }

    // 新建任务
    window.tmAdd = async function() {
        const docId = __tmResolveDefaultDocId();
        if (!docId) {
            hint('⚠ 请先在设置中选择文档', 'warning');
            showSettings();
            return;
        }

        const content = await showPrompt('新建任务', '请输入任务内容');
        if (!content) return;

        const markdown = '- [ ] ' + content;

        try {
            const newId = await API.insertBlock(docId, markdown);

            // 添加到本地数据
            const newTask = {
                id: newId,
                done: false,
                content: content,
                markdown: markdown,
                priority: '',
                duration: '',
                remark: '',
                completionTime: '',
                customTime: '',
                customStatus: '',
                docName: state.allDocuments.find(d => d.id === docId)?.name || '未知文档',
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            };

            state.flatTasks[newId] = newTask;
            const doc = state.taskTree.find(d => d.id === docId);
            if (doc) {
                doc.tasks.push(newTask);
            }

            recalcStats();
            applyFilters();
            render();
            hint('✅ 任务已创建', 'success');
        } catch (e) {
            hint(`❌ 创建失败: ${e.message}`, 'error');
        }
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
        
        // 将设置同步到 state
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        state.queryLimit = SettingsStore.data.queryLimit;
        state.groupByDocName = SettingsStore.data.groupByDocName;
        state.groupByTime = SettingsStore.data.groupByTime;
        state.collapsedTaskIds = new Set(SettingsStore.data.collapsedTaskIds || []);
        state.collapsedGroups = new Set(SettingsStore.data.collapsedGroups || []);
        state.currentRule = SettingsStore.data.currentRule;
        state.columnWidths = SettingsStore.data.columnWidths;

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

        console.log(`[加载] 准备查询 ${allDocIds.length} 个文档的任务`);

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

                // 按文档顺序构建树
                allDocIds.forEach(docId => {
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
                    if (rawTasks.length > 0 || state.selectedDocIds.includes(docId)) { 
                         state.taskTree.push({
                            id: docId,
                            name: docName,
                            tasks: rootTasks
                        });
                    }
                });
                
                applyFilters();
                if (state.modal && token === (Number(state.openToken) || 0)) render();
            }
        } catch (e) {
            console.error('[加载] 获取任务失败:', e);
            hint('❌ 加载任务失败', 'error');
        }
    }

    // 显示设置
    function showSettings() {
        if (state.settingsModal) {
            try { state.settingsModal.remove(); } catch (e) {}
            state.settingsModal = null;
        }

        state.settingsModal = document.createElement('div');
        state.settingsModal.className = 'tm-settings-modal';

        // 确保文档列表是最新的
        try {
            API.getAllDocuments().then(docs => {
                state.allDocuments = docs;
            }).catch(e => {
                console.error('[设置] 刷新文档列表失败:', e);
            });
        } catch (e) {}

        const groups = SettingsStore.data.docGroups || [];
        const currentGroupId = SettingsStore.data.currentGroupId || 'all';
        
        // 渲染分组选择器
        const renderGroupSelector = () => {
            return `
                <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <select id="groupSelector" onchange="switchDocGroup(this.value)" 
                            style="flex: 1; padding: 6px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                        <option value="all" ${currentGroupId === 'all' ? 'selected' : ''}>全部文档</option>
                        ${groups.map(g => `<option value="${g.id}" ${currentGroupId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
                    </select>
                    <button class="tm-btn tm-btn-primary" onclick="createNewGroup()" style="padding: 6px 10px; font-size: 12px;">+ 新建分组</button>
                    ${currentGroupId !== 'all' ? `<button class="tm-btn tm-btn-danger" onclick="deleteCurrentGroup()" style="padding: 6px 10px; font-size: 12px;">删除分组</button>` : ''}
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
        const activeTab = state.settingsActiveTab === 'appearance' ? 'appearance' : 'main';

        state.settingsModal.innerHTML = `
            <div class="tm-settings-box" style="overflow: hidden;">
                <div class="tm-settings-header">
                    <div class="tm-settings-title">⚙️ 任务管理器设置</div>
                    <button class="tm-btn tm-btn-gray" onclick="closeSettings()">关闭</button>
                </div>

                <div style="display:flex;gap:8px;padding:0 2px 12px 2px;">
                    <button class="tm-btn ${activeTab === 'main' ? 'tm-btn-primary' : 'tm-btn-secondary'}" onclick="tmSwitchSettingsTab('main')" style="padding: 6px 10px; font-size: 12px;">主设置</button>
                    <button class="tm-btn ${activeTab === 'appearance' ? 'tm-btn-primary' : 'tm-btn-secondary'}" onclick="tmSwitchSettingsTab('appearance')" style="padding: 6px 10px; font-size: 12px;">外观</button>
                </div>

                <div style="flex: 1; overflow-y: auto; min-height: 0; padding-right: 4px; margin-bottom: 16px;">
                    ${activeTab === 'appearance' ? `
                        <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;" class="tm-width-settings">
                            <div style="font-weight: 600; margin-bottom: 12px;">📏 列设置 (显示/排序/宽度)</div>
                            ${renderColumnWidthSettings()}
                        </div>
                    ` : ''}

                    ${activeTab === 'main' ? `
                    <div style="margin-bottom: 16px; display: flex; gap: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <span>查询限制: </span>
                            <input type="number" value="${state.queryLimit}"
                                   onchange="updateQueryLimit(this.value)"
                                   style="width: 80px; padding: 4px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                            <span>条任务/文档</span>
                        </label>
                        
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <span>字体大小: </span>
                            <input type="number" value="${SettingsStore.data.fontSize}" min="10" max="30"
                                   onchange="updateFontSize(this.value)"
                                   style="width: 60px; padding: 4px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                            <span>px</span>
                        </label>

                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <span>移动端字体: </span>
                            <input type="number" value="${SettingsStore.data.fontSizeMobile || SettingsStore.data.fontSize}" min="10" max="30"
                                   onchange="updateFontSizeMobile(this.value)"
                                   style="width: 60px; padding: 4px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                            <span>px</span>
                        </label>
                    </div>

                    <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 8px;">🧷 任务悬浮条（quickbar）</div>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="checkbox" ${SettingsStore.data.enableQuickbar ? 'checked' : ''} onchange="updateEnableQuickbar(this.checked)">
                            启用任务悬浮条（点击任务块显示自定义字段）
                        </label>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 6px;">
                            关闭后将不再弹出悬浮条，也不会拦截点击/长按事件。
                        </div>
                    </div>

                    <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 8px;">📝 新建任务默认文档</div>
                        <select onchange="updateDefaultDocIdFromSelect(this.value)" 
                                style="width: 100%; padding: 6px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                            ${defaultDocOptions.join('')}
                        </select>
                        <div style="display:flex; gap:8px; margin-top: 8px; align-items:center;">
                            <input id="tmDefaultDocIdInput" class="tm-input" list="tmDefaultDocIdList"
                                   value="${esc(defaultDocId || '')}"
                                   placeholder="也可直接输入文档ID"
                                   style="flex: 1; padding: 6px 8px;">
                            <button class="tm-btn tm-btn-secondary" onclick="tmApplyDefaultDocIdInput()" style="padding: 6px 10px; font-size: 12px;">应用</button>
                            <button class="tm-btn tm-btn-gray" onclick="tmClearDefaultDocIdInput()" style="padding: 6px 10px; font-size: 12px;">清空</button>
                        </div>
                        <datalist id="tmDefaultDocIdList">
                            ${currentDocs.map(docItem => {
                                const docId = typeof docItem === 'object' ? docItem.id : docItem;
                                const docName = resolveDocName(docId);
                                return `<option value="${docId}">${esc(docName)}</option>`;
                            }).join('')}
                            ${defaultDocId && !currentDocIds.includes(defaultDocId) ? `<option value="${defaultDocId}"></option>` : ''}
                        </datalist>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 6px;">
                            未设置时，将使用当前文档或列表中的第一个文档。
                        </div>
                    </div>

                    <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 12px;">🏷️ 状态选项设置</div>
                        <div id="tm-status-options-list">
                            ${renderStatusOptionsList()}
                        </div>
                        <button class="tm-btn tm-btn-primary" onclick="addStatusOption()" style="margin-top: 8px; font-size: 12px;">+ 添加状态</button>
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
                            <button class="tm-btn tm-btn-primary" onclick="addManualDoc()">添加</button>
                        </div>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 8px;">
                            提示：在思源笔记中打开文档，浏览器地址栏的 id= 后面的就是文档ID
                        </div>
                    </div>

                    <div style="margin-bottom: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 600;">📚 当前列表文档（${currentDocs.length} 个）</span>
                            ${currentGroupId !== 'all' ? `<button class="tm-btn tm-btn-danger" onclick="clearCurrentGroupDocs()" style="padding: 4px 8px; font-size: 12px;">清空当前分组</button>` : ''}
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
                                            ` : '<span style="font-size: 11px; color: var(--tm-secondary-text);">只读</span>'}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : '<div style="color: var(--tm-secondary-text); font-size: 13px; padding: 10px; background: var(--tm-rule-group-bg); border-radius: 8px;">暂无文档，请添加</div>'}
                    </div>
                    ` : ''}
                </div>

                <div class="tm-settings-footer">
                    <button class="tm-btn tm-btn-secondary" onclick="closeSettings()">取消</button>
                    <button class="tm-btn tm-btn-success" onclick="saveSettings()">保存设置</button>
                </div>
            </div>
        `;

        document.body.appendChild(state.settingsModal);
    }
    window.showSettings = showSettings;
    window.tmSwitchSettingsTab = function(tab) {
        state.settingsActiveTab = tab === 'appearance' ? 'appearance' : 'main';
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
            { key: 'h2', label: '二级标题' },
            { key: 'priority', label: '重要性' },
            { key: 'completionTime', label: '完成时间' },
            { key: 'duration', label: '时长' },
            { key: 'remark', label: '备注' }
        ];

        const currentOrder = SettingsStore.data.columnOrder || ['pinned', 'content', 'status', 'score', 'doc', 'h2', 'priority', 'completionTime', 'duration', 'remark'];
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
        
        options.push({ id, name, color: '#888888' });
        SettingsStore.data.customStatusOptions = options;
        await SettingsStore.save();
        showSettings(); // 刷新界面
        render(); // 刷新主界面
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
            return;
        }

        options[index][field] = value;
        SettingsStore.data.customStatusOptions = options;
        await SettingsStore.save();
        // 不刷新整个界面，以免输入焦点丢失
        render(); // 刷新主界面
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
    };

    window.deleteStatusOption = async function(index) {
        if (!confirm('确定删除此状态吗？')) return;
        const options = SettingsStore.data.customStatusOptions || [];
        options.splice(index, 1);
        SettingsStore.data.customStatusOptions = options;
        await SettingsStore.save();
        showSettings(); // 刷新界面
        render(); // 刷新主界面
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
        hint('✅ 已添加文档（已同步到云端）', 'success');
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
            console.warn('[文档] 获取文档信息失败:', e);
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

    window.toggleGroupByDocName = async function(checked) {
        state.groupByDocName = !!checked;
        if (state.groupByDocName) {
            state.groupByTime = false;
            SettingsStore.data.groupByTime = false;
        }
        SettingsStore.data.groupByDocName = state.groupByDocName;
        await SettingsStore.save();
        applyFilters();
        render();
    };

    window.toggleGroupByTime = async function(checked) {
        state.groupByTime = !!checked;
        if (state.groupByTime) {
            state.groupByDocName = false;
            SettingsStore.data.groupByDocName = false;
        }
        SettingsStore.data.groupByTime = state.groupByTime;
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
        await SettingsStore.save();
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

        // 同步到云端存储
        SettingsStore.data.collapsedTaskIds = [...state.collapsedTaskIds];
        await SettingsStore.save();
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
        // 同步到 SettingsStore 并保存到云端
        SettingsStore.data.selectedDocIds = state.selectedDocIds;
        SettingsStore.data.queryLimit = state.queryLimit;
        SettingsStore.data.showCompletionTime = state.showCompletionTime;
        SettingsStore.data.groupByDocName = state.groupByDocName;
        SettingsStore.data.groupByTime = state.groupByTime;
        await SettingsStore.save();
        hint('✅ 设置已保存（已同步到云端）', 'success');
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
                tmBtn.innerHTML = '📋';
                tmBtn.title = '打开任务管理';
                tmBtn.style.cssText = `
                    width: 28px;
                    height: 28px;
                    padding: 0;
                    margin: 0 4px;
                    background: transparent;
                    color: var(--b3-theme-on-surface, inherit);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    transition: all 0.2s;
                    z-index: 10;
                `;

                tmBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openManager();
                };

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
    function addTopBarIcon() {
        if (__tmTopBarAdded) return;
        if (__tmIsMobileDevice()) return;
        // 尝试通过全局插件实例添加
        const pluginInstance = globalThis.__taskHorizonPluginInstance || globalThis.__tomatoPluginInstance;
        if (pluginInstance && typeof pluginInstance.addTopBar === 'function') {
            // 检查是否已添加（避免重复）
            // addTopBar 通常由插件管理，我们这里只是尝试调用
            // 如果已经添加过，思源可能会处理，或者我们可以检查 DOM
            // 但是 addTopBar 没有 ID 参数，不好检查。
            // 我们可以检查 aria-label 或 title
            const exists = document.querySelector('[aria-label="任务管理"]');
            if (exists) return;

            pluginInstance.addTopBar({
                icon: "iconList", // 使用内置列表图标，或者自定义
                title: "任务管理",
                position: "right",
                callback: () => {
                    openManager();
                }
            });
            __tmTopBarAdded = true;
            console.log('🍅 已注册顶栏图标');
        } else {
            console.warn('🍅 无法注册顶栏图标：未找到插件实例');
        }
    }

    /**
     * 监听面包屑栏变化
     */
    function observeBreadcrumb() {
        // 先尝试添加一次
        if (__tmIsMobileDevice()) {
            addBreadcrumbButton();
        } else {
            addTopBarIcon();
        }

        // 使用 MutationObserver 监听面包屑栏变化
        if (__tmBreadcrumbObserver) {
            try { __tmBreadcrumbObserver.disconnect(); } catch (e) {}
            __tmBreadcrumbObserver = null;
        }
        const observer = new MutationObserver(() => {
            if (__tmIsMobileDevice()) addBreadcrumbButton();
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
        console.log('🍅 任务管理器 v9.0 初始化...');

        // 1. 先加载设置（包括文档ID）
        try {
            await SettingsStore.load();
            console.log('[设置] 已加载:', SettingsStore.data.selectedDocIds);

            // 初始化状态
            state.selectedDocIds = SettingsStore.data.selectedDocIds;
            state.queryLimit = SettingsStore.data.queryLimit;
            state.groupByDocName = SettingsStore.data.groupByDocName;
            state.groupByTime = SettingsStore.data.groupByTime;
            state.collapsedTaskIds = new Set(SettingsStore.data.collapsedTaskIds || []);
            state.collapsedGroups = new Set(SettingsStore.data.collapsedGroups || []);
            state.currentRule = SettingsStore.data.currentRule;
            state.columnWidths = SettingsStore.data.columnWidths;

            // 加载筛选规则
            state.filterRules = await RuleManager.initRules();
        } catch (e) {
            console.error('[初始化] 加载设置失败:', e);
        }

        // 2. 获取所有文档列表
        try {
            state.allDocuments = await API.getAllDocuments();
            console.log('[文档] 已加载文档列表:', state.allDocuments.length);
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

        // 尝试在工具栏中挂载按钮（作为增强）
        const isVisible = (el) => {
            try { return !!el && el.offsetParent !== null; } catch (e) { return false; }
        };

        const mountToolbarBtn = () => {
            const activeProtyle =
                document.querySelector('.layout__wnd--active .protyle') ||
                Array.from(document.querySelectorAll('.protyle')).find(isVisible) ||
                null;

            let toolbar =
                activeProtyle?.querySelector?.('.protyle-toolbar') ||
                document.querySelector('.layout__wnd--active .protyle-toolbar') ||
                null;

            if (!toolbar || !isVisible(toolbar)) {
                const all = Array.from(document.querySelectorAll('.protyle-toolbar')).filter(isVisible);
                toolbar = all[all.length - 1] || null;
            }
            if (!toolbar) return;

            const host =
                toolbar.querySelector('.protyle-toolbar__buttons, .protyle-toolbar__items, .protyle-toolbar__content') ||
                toolbar;

            if (document.getElementById('tmEntryBtn')) return;

            const btn = document.createElement('button');
            btn.id = 'tmEntryBtn';
            const sampleBtn = host.querySelector('button');
            btn.className = (sampleBtn?.className ? `${sampleBtn.className} ` : '') + 'tm-toolbar-btn';
            btn.type = 'button';
            btn.title = '任务管理';
            btn.textContent = '📋';
            btn.onclick = openManager;
            host.appendChild(btn);
        };

        if (!__tmIsMobileDevice()) {
            __tmEntryMountTimer = setTimeout(mountToolbarBtn, 0);
            __tmEntryObserverTimer = setTimeout(() => {
                if (!globalThis.__tmEntryObserver) {
                    globalThis.__tmEntryObserver = new MutationObserver(() => {
                        if (!document.getElementById('tmEntryBtn')) {
                            mountToolbarBtn();
                        }
                    });
                    globalThis.__tmEntryObserver.observe(document.body, { childList: true, subtree: true });
                }
            }, 300);
        }

        // 启动面包屑按钮观察者
        observeBreadcrumb();

        console.log('🍅 任务管理器 v9.0 已启动');
    }

    async function __tmEnsureTabOpened() {
        if (typeof globalThis.__taskHorizonOpenTabView !== 'function') return;
        if (globalThis.__taskHorizonPluginIsMobile) return;
        __tmEnsureMount();
        if (__tmMountEl && document.body.contains(__tmMountEl)) return;

        globalThis.__taskHorizonOpenTabView();

        const start = Date.now();
        while (!globalThis.__taskHorizonTabElement && Date.now() - start < 1500) {
            await new Promise(r => setTimeout(r, 50));
        }
        if (globalThis.__taskHorizonTabElement) {
            __tmSetMount(globalThis.__taskHorizonTabElement);
        }
    }

    async function openManager() {
        state.openToken = (Number(state.openToken) || 0) + 1;
        const token = Number(state.openToken) || 0;
        console.log('[打开管理器] 当前文档ID:', state.selectedDocIds);

        await __tmEnsureTabOpened();

        if (!state.modal) {
            try { render(); } catch (e) {}
        }

        hint('🔄 加载任务中...', 'info');

        await SettingsStore.load();
        state.selectedDocIds = SettingsStore.data.selectedDocIds;

        if (!state.selectedDocIds || state.selectedDocIds.length === 0) {
            hint('⚠ 请先选择要显示的文档', 'warning');
            if (state.modal && token === (Number(state.openToken) || 0)) showSettings();
            return;
        }

        if (!state.modal || token !== (Number(state.openToken) || 0)) return;
        await loadSelectedDocuments();
    }

    // ... 保留原有的 loadSelectedDocuments 和其他函数 ...

    // 插件卸载清理
    function __tmCleanup() {
        try {
            if (__tmGlobalClickHandler) {
                window.removeEventListener('click', __tmGlobalClickHandler);
                __tmGlobalClickHandler = null;
            }
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
            if (__tmEntryMountTimer != null) {
                clearTimeout(__tmEntryMountTimer);
                __tmEntryMountTimer = null;
            }
        } catch (e) {}

        try {
            if (__tmEntryObserverTimer != null) {
                clearTimeout(__tmEntryObserverTimer);
                __tmEntryObserverTimer = null;
            }
        } catch (e) {}

        try {
            if (__tmBreadcrumbObserver) {
                __tmBreadcrumbObserver.disconnect();
                __tmBreadcrumbObserver = null;
            }
        } catch (e) {}

        try {
            if (globalThis.__tmEntryObserver) {
                globalThis.__tmEntryObserver.disconnect();
                globalThis.__tmEntryObserver = null;
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
            const entryBtn = document.getElementById('tmEntryBtn');
            if (entryBtn) entryBtn.remove();
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
    }

    // 暴露清理函数给插件卸载调用
    globalThis.__TaskManagerCleanup = __tmCleanup;
    // 暴露挂载函数供自定义 Tab 使用
    globalThis.__taskHorizonMount = (el) => {
        __tmSetMount(el);
        openManager().catch(() => {});
    };

    if (document.readyState === 'loading') {
        __tmDomReadyHandler = init;
        document.addEventListener('DOMContentLoaded', __tmDomReadyHandler);
    } else {
        init();
    }
})();



