"use strict";

const NETWORK_SETTINGS = new Set([
    "proxyCore", "profilePath", "childProcessText", "interfaceName", "clashAuthentication",
    "systemProxyTypeIndex", "pacContentText", "bypassText", "specifyHttpProxyProtocol", "staticSystemProxyHost",
    "mixinType", "mixinText", "mixinCode", "legacyTapMode", "isUsingResetDNSServers", "resetDNSServers",
    "ssidStrategyText", "connMode", "connProxyDisconnect", "enableDHCPServer", "randomMixedPort", "randomControllerPort"
]);
const NETWORK_ACTIONS = new Set([
    "handleProxyCoreChange", "refreshCore", "handleSelectInterface", "handleEditChildProcess", "handleChooseProfilePath",
    "handleEditPACContent", "handleEditBypass", "handleEditMixinYAML", "handleEditMixinJS", "handleEditSSIDStrategy",
    "handleReset", "handlerClearFakeIPCache", "handleGenerateUUIDSecret", "handleTrayScriptManualRun"
]);

function isProxySetting(key) { return NETWORK_SETTINGS.has(key); }

function guardSettingsMethods(methods) {
    for (const name of NETWORK_ACTIONS) {
        const action = methods[name];
        if (action) methods[name] = function(...args) {
            if (this.$parent?.proxyBusy || this.proxyBusy) return false;
            return action.apply(this, args);
        };
    }
    return methods;
}

// Keep the large production render function readable. Guard both model callbacks
// and action controls, including events emitted by a stale child after navigation.
function settingsElement(vm, createElement) {
    return (tag, data, ...args) => {
        const key = data?.model?.expression?.match(/^settings\.(\w+)$/)?.[1];
        const action = Object.entries(data?.on || {}).some(([, handler]) =>
            [...NETWORK_ACTIONS].some(name => handler === vm[name]));
        if (isProxySetting(key) || action) {
            data = { ...data };
            if (data.model) {
                const callback = data.model.callback;
                data.model = { ...data.model, callback: value => { if (!vm.proxyBusy) return callback(value); } };
            }
            if (vm.proxyBusy) {
                data.attrs = { ...data.attrs, disabled: true, inert: "", "aria-disabled": "true" };
                data.class = [data.class, "cfw-operation-disabled"];
                data.style = { ...data.style, pointerEvents: "none" };
            }
        }
        return createElement(tag, data, ...args);
    };
}

module.exports = { isProxySetting, guardSettingsMethods, settingsElement };
