'use strict';

// Source-slice tests receive the same translator as a real plugin host.
const vm = require('node:vm');
const { createI18n } = require('../src/i18n/runtime');
const messages = require('../i18n/zh-CN.json');
function prepare(context = {}) {
    const i18n = createI18n(messages, { locale: 'zh-CN' });
    context.__tmT ||= i18n.t;
    context.__taskHorizonHostBridge ||= {};
    context.__taskHorizonHostBridge.i18n ||= i18n;
    if (context.siyuan?.plugin) context.siyuan.plugin.i18n ||= messages;
    if (context.window && context.window !== context) {
        context.window.__taskHorizonHostBridge ||= context.__taskHorizonHostBridge;
    }
    return context;
}
module.exports = {
    ...vm,
    prepare,
    createContext: (context, options) => vm.createContext(prepare(context), options),
    runInNewContext: (code, context, options) => vm.runInNewContext(code, prepare(context), options),
};
