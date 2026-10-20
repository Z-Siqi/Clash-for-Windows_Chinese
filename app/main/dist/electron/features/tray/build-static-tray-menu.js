"use strict";

const { supportsScriptMode } = require("../../core/clash-core/core-capabilities");
const { proxyMenuEntries } = require("./proxy-operation-progress");

const LABELS = {
    en: {
        dashboard: "Dashboard",
        tun: "TUN Mode",
        mixin: "Mixin",
        proxyMode: "Proxy Mode",
        global: "Global",
        rule: "Rule",
        direct: "Direct",
        script: "Script",
        more: "More",
        devTools: "Toggle DevTools",
        moveMonitor: "Move Dashboard To Nearest Monitor",
        restart: "Restart",
        forceQuit: "Force Quit",
        quit: "Quit"
    },
    cn: {
        dashboard: "仪表盘",
        tun: "TUN 模式",
        mixin: "混合配置",
        proxyMode: "代理模式",
        global: "全局",
        rule: "规则",
        direct: "直连",
        script: "脚本",
        more: "更多",
        devTools: "切换Dev工具",
        moveMonitor: "将仪表板移至最近的显示器",
        restart: "重启",
        forceQuit: "强制退出",
        quit: "退出"
    }
};

function buildStaticTrayMenu({ Menu, locale, state, actions }) {
    const labels = LABELS[locale] || LABELS.en;
    const send = actions.sendRenderer;
    return Menu.buildFromTemplate([
        { label: labels.dashboard, click: actions.showDashboard },
        { type: "separator" },
        ...proxyMenuEntries({ state, actions, operation: "tun", item: {
            label: labels.tun,
            type: "checkbox",
            id: "tun",
            checked: state.tunModeChecked
        } }),
        ...proxyMenuEntries({ state, actions, operation: "mixin", item: {
            label: labels.mixin,
            type: "checkbox",
            id: "mixin",
            checked: state.mixinChecked
        } }),
        { type: "separator" },
        { label: labels.proxyMode, id: "mode", enabled: false },
        ...modeItem(labels.global, "global", false, false),
        ...modeItem(labels.rule, "rule", state.isReady, state.menuMode === "rule"),
        ...modeItem(labels.direct, "direct", false, false),
        ...modeItem(labels.script, "script", false, false, supportsScriptMode(state.coreType)),
        { type: "separator" },
        {
            label: labels.more,
            submenu: [
                { label: labels.devTools, click: actions.toggleDevTools },
                { label: labels.moveMonitor, click: actions.moveToNearestMonitor },
                { label: labels.restart, click: actions.restart },
                { label: labels.forceQuit, click: actions.forceQuit }
            ]
        },
        { type: "separator" },
        { label: labels.quit, click: actions.requestQuit }
    ]);

    function modeItem(label, mode, enabled, checked, visible = true) {
        return proxyMenuEntries({ state, actions, operation: "mode", item: {
            label,
            type: "radio",
            id: `mode-${mode}`,
            enabled,
            checked,
            visible,
        } });
    }
}

module.exports = { buildStaticTrayMenu };
