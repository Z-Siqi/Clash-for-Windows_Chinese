"use strict";

const { supportsScriptMode } = require("../../core/clash-core/core-capabilities");

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

    return async function buildContextMenu() {
        let proxyGroups = [];
        if (!isLinux()) {
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
            checkbox("System Proxy", "&系统代理", "system-proxy", state.systemProxyChecked,
                !isLinux(), "system-proxy-changed"),
            checkbox("TUN Mode", "TUN 模式", "tun", state.tunModeChecked, true, "tun-changed"),
            checkbox("Mixin", "混合配置", "mixin", state.mixinChecked, true, "mixin-changed"),
            { type: "separator" },
            { label: localize("Proxy Mode", "代理模式"), id: "mode", enabled: false },
            modeItem("Global", "全局", "global"),
            modeItem("Rule", "规则", "rule"),
            modeItem("Direct", "直连", "direct"),
            modeItem("Script", "脚本", "script"),
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
            return {
                label: localize(english, chinese),
                type: "checkbox",
                id,
                checked,
                enabled: state.isReady,
                visible,
                click: item => actions.sendRenderer(channel, item.checked)
            };
        }

        function modeItem(english, chinese, mode) {
            return {
                label: localize(english, chinese),
                type: "radio",
                id: `mode-${mode}`,
                enabled: state.isReady,
                checked: state.menuMode === mode,
                visible: mode !== "script" || supportsScriptMode(state.coreType),
                click: () => actions.sendRenderer("mode-changed", mode)
            };
        }

        async function loadProxyGroups() {
            const [proxyResponse, providerResponse] = await Promise.all([
                clashApi.getProxies(),
                clashApi.getProxyProviders()
            ]);
            const proxies = (proxyResponse && proxyResponse.data && proxyResponse.data.proxies) || {};
            const providers = (providerResponse && providerResponse.data && providerResponse.data.providers) || {};
            if (!Object.keys(proxies).length) return [];

            const providerProxies = Object.values(providers).flatMap(provider =>
                (provider && provider.proxies) || []
            );
            const globalOrder = (proxies.GLOBAL && proxies.GLOBAL.all) || [];

            return Object.entries(proxies)
                .filter(([, proxy]) => proxy && proxy.type === "Selector")
                .map(([name, proxy]) => ({ name, all: proxy.all, now: proxy.now }))
                .sort((left, right) => globalOrder.indexOf(left.name) - globalOrder.indexOf(right.name))
                .map(group => ({
                    label: group.name,
                    submenu: group.all.map(proxyName => {
                        const detail = providerProxies.find(proxy => proxy.name === proxyName) || {};
                        return {
                            label: proxyName,
                            type: "radio",
                            checked: proxyName === group.now,
                            icon: state.isShowDelayIcon
                                ? (detail.alive ? onlineIcon : offlineIcon)
                                : null,
                            click: () => selectProxy(group.name, proxyName)
                        };
                    })
                }));
        }

        function selectProxy(groupName, proxyName) {
            clashApi.selectProxy(groupName, proxyName)
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
