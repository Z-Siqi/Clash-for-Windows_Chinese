"use strict";

const { supportsScriptMode } = require("../../core/clash-core/core-capabilities");
const { proxyMenuEntries } = require("./proxy-operation-progress");
const { createTranslator } = require("../../core/i18n/language");

function createContextMenuBuilder({
    state,
    isLinux,
    clashApi,
    nativeImage,
    path,
    staticRoot,
    localize,
    actions
}) {
    const statusIcon = status => nativeImage
        .createFromPath(path.join(staticRoot, "imgs", `tray-proxy-${status}.png`))
        .resize({ width: 8, height: 8 });
    const onlineIcon = statusIcon("online");
    const offlineIcon = statusIcon("offline");
    let menuSequence = 0;

    return async function buildContextMenu() {
        const menuId = ++menuSequence;
        let proxyGroups = [];
        if (!isLinux() && state.menuStyle !== 2) {
            try {
                proxyGroups = await loadProxyGroups();
            } catch (_error) {
                proxyGroups = [];
            }
        }

        const proxySection = [
            [
                { label: localize("Proxy Groups", "代理组"), enabled: false },
                ...proxyGroups
            ],
            [{ label: localize("Proxy Groups", "代理组"), submenu: proxyGroups }],
            []
        ][state.menuStyle || 0];

        return [
            { label: localize("Dashboard", "仪表盘"), click: actions.showDashboard },
            {
                label: localize("Run Tray Script", "运行任务栏脚本"),
                visible: !isLinux(),
                click: actions.runTrayScript
            },
            { type: "separator" },
            ...checkbox("System Proxy", "&系统代理", "system-proxy", state.systemProxyChecked,
                !isLinux(), "system-proxy-changed"),
            ...checkbox("TUN Mode", "TUN 模式", "tun", state.tunModeChecked, true, "tun-changed"),
            ...checkbox(createTranslator(1).mixin(), createTranslator(0).mixin(), "mixin", state.mixinChecked, true, "mixin-changed"),
            { type: "separator" },
            { label: localize("Proxy Mode", "代理模式"), id: "mode", enabled: false },
            ...modeItem("Global", "全局", "global"),
            ...modeItem("Rule", "规则", "rule"),
            ...modeItem("Direct", "直连", "direct"),
            ...modeItem("Script", "脚本", "script"),
            { type: "separator" },
            ...proxySection,
            { type: "separator" },
            { label: localize("Connections", "连接"), id: "connection", enabled: false },
            {
                label: localize("Close All", "关闭全部"),
                enabled: state.isReady,
                click: () => clashApi.closeConnections()
            },
            { type: "separator" },
            {
                label: localize("More", "更多"),
                submenu: [
                    { label: localize("Toggle DevTools", "切换Dev工具"), click: actions.toggleDevTools },
                    {
                        label: localize("Move Dashboard To Nearest Monitor", "将仪表板移至最近的显示器"),
                        click: actions.moveToNearestMonitor
                    },
                    { label: localize("Restart", "重启"), click: actions.restart },
                    { label: localize("Force Quit", "强制退出"), click: actions.forceQuit }
                ]
            },
            { type: "separator" },
            { label: localize("Quit", "退出"), click: actions.requestQuit }
        ];

        function checkbox(english, chinese, id, checked, visible, channel) {
            return proxyMenuEntries({ state, actions, operation: id === "system-proxy" ? "system" : id, item: {
                label: localize(english, chinese),
                type: "checkbox",
                id,
                checked,
                enabled: state.isReady,
                visible,
            } });
        }

        function modeItem(english, chinese, mode) {
            return proxyMenuEntries({ state, actions, operation: "mode", item: {
                label: localize(english, chinese),
                type: "radio",
                id: `mode-${mode}`,
                enabled: state.isReady,
                checked: state.menuMode === mode,
                visible: mode !== "script" || supportsScriptMode(state.coreType),
            } });
        }

        async function loadProxyGroups() {
            const proxyRequest = clashApi.getProxies();
            const health = new Map(), proxyItems = [];
            // Provider health is optional decoration; a slow provider must not delay node selection.
            if (state.isShowDelayIcon) {
                const updateHealth = async () => {
                    const response = await clashApi.getProxyProviders({ timeout: 1500 });
                    for (const provider of Object.values(response?.data?.providers || {})) {
                        for (const proxy of provider?.proxies || []) health.set(proxy.name, proxy.alive);
                    }
                    for (const item of proxyItems) item.icon = healthIcon(item.label);
                    actions.updateProxyIcons?.(proxyItems.map(({ id, icon }) => ({ id, icon })));
                };
                updateHealth().catch(() => {});
            }
            const proxyResponse = await proxyRequest;
            const proxies = (proxyResponse && proxyResponse.data && proxyResponse.data.proxies) || {};
            if (!Object.keys(proxies).length) return [];
            function healthIcon(name) {
                if (!state.isShowDelayIcon) return null;
                const alive = health.has(name) ? health.get(name) : proxies[name]?.alive;
                return alive === true ? onlineIcon : alive === false ? offlineIcon : null;
            }
            const globalOrder = (proxies.GLOBAL && proxies.GLOBAL.all) || [];
            const globalRank = new Map(globalOrder.map((name, index) => [name, index]));

            return Object.entries(proxies)
                .filter(([, proxy]) => proxy && proxy.type === "Selector")
                .map(([name, proxy]) => ({ name, all: proxy.all, now: proxy.now }))
                .sort((left, right) => (globalRank.get(left.name) ?? -1) - (globalRank.get(right.name) ?? -1))
                .map((group, groupIndex) => ({
                    label: group.name,
                    submenu: group.all.map((proxyName, proxyIndex) => {
                        const item = {
                            id: `tray-proxy-${menuId}-${groupIndex}-${proxyIndex}`,
                            label: proxyName,
                            type: "radio",
                            checked: proxyName === group.now,
                            enabled: state.isReady && !state.proxyBusy,
                            icon: healthIcon(proxyName),
                            click: () => selectProxy(group.name, proxyName)
                        };
                        proxyItems.push(item);
                        return item;
                    })
                }));
        }

        function selectProxy(groupName, proxyName) {
            if (!state.isReady || state.proxyBusy) return;
            return clashApi.selectProxy(groupName, proxyName)
                .then(response => {
                    if (response.status === 204) {
                        actions.sendRenderer("persist-selected-proxy");
                        actions.sendRenderer("break-connections", groupName);
                    }
                })
                .catch(() => {});
        }
    };
}

module.exports = { createContextMenuBuilder };
