"use strict";

const { createProfileApplication } = require("../../features/profiles/profile-application");
const { buildTunConfig } = require("../../features/tun/build-tun-config");
const { createProfileNetworkEffects } = require("../../features/network/profile-network-effects");
const { prepareDisconnectCleanup } = require("../../features/connections/disconnect-cleanup");
const { trackProfileRefresh } = require("../../core/network/profile-refresh-state");
const { resolveTapMode } = require("../../core/network/legacy-tap-policy");

// Serialize core writes, but let a newer request retire obsolete preparation and TAP startup.
const pending = new WeakMap();
const applied = new WeakMap();
function refreshProfile(vm, dependencies) {
    const predecessor = pending.get(vm);
    const request = { controller: new AbortController() };
    predecessor?.controller.abort();
    const isCurrent = () => pending.get(vm) === request;
    const run = async () => {
        if (!isCurrent()) return { success: false, message: null, superseded: true };
        const { platform, childProcess, setDns, getPort, messages } = dependencies;
        const previous = applied.get(vm);
        const state = { tun: vm.isTunEnable === true, mixin: vm.isMixinEnable === true, tapMode: resolveTapMode(vm.settings) };
        const turnedOff = previous && ((previous.tun && !state.tun) || (previous.mixin && !state.mixin)
            || (previous.tapMode !== state.tapMode));
        const cleanup = await prepareDisconnectCleanup({
            api: vm.clashApi, settings: vm.settings,
            disconnecting: turnedOff && previous.tunnelActive,
            scope: "tunnel",
            // Legacy TAP enters the core through SOCKS. Its metadata cannot be
            // distinguished from macOS System Proxy or manually configured SOCKS.
            includeSocks: previous?.tapActive && vm.isSystemProxyOn !== true,
            onError: () => dependencies.onDisconnectCleanupError?.()
        });
        if (!isCurrent()) return { success: false, message: null, superseded: true };
        let payload;
        const apply = createProfileApplication({
            ...dependencies,
            clashApi: vm.clashApi,
            effects: {
                ...(dependencies.profileNetworkEffects || createProfileNetworkEffects({ childProcess, getPort })),
                async detectInterface() {
                    vm.isDetectingProfileInterface = true;
                    try {
                        await vm.detectInterfaceName();
                        await vm.$nextTick?.();
                        return vm.finalInterfaceName;
                    } finally { vm.isDetectingProfileInterface = false; }
                },
                setPayload(config) { payload = config; vm.setCurrentProfilePayload({ payload: config }); },
                setProvidersVisible(visible) {
                    const items = vm.menuItems;
                    if (visible && !items.some(item => item.path === "/home/provider")) {
                        vm.setMenuItems({ items: [...items, { path: "/home/provider" }] });
                    } else if (!visible) vm.setMenuItems({ items: items.filter(item => item.path !== "/home/provider") });
                },
                setDns,
                setDnsChanged(changed) { vm.isUserDNSChanged = changed; },
                resetDns() { return vm.resetDNS(); },
                switchMode(mode) { return vm.switchMode(mode, false); },
                startTap(options) { return vm.spawnTun2socks(options); },
                async stopTap() { await vm.killSpawned(vm.tun2socks); vm.tun2socks = null; }
            }
        });
        const result = await apply({
            profiles: vm.profiles, profilesPath: vm.profilesPath,
            confData: vm.confData, settings: vm.settings,
            tunConfig: state.tun ? buildTunConfig(vm.tunSettings, platform) : null,
            mixinEnabled: state.mixin, isCurrent, signal: request.controller.signal
        });
        if (result.success) {
            const tunnelActive = !!(payload?.tun?.enable || vm.tun2socks);
            applied.set(vm, { ...state, tunnelActive, tapActive: !!vm.tun2socks });
            await cleanup(!tunnelActive);
            if (isCurrent()) dependencies.onProfileApplied?.();
        }
        return result;
    };
    const result = (predecessor?.result || Promise.resolve()).then(run, run);
    request.result = result;
    pending.set(vm, request);
    trackProfileRefresh(vm.clashApi, result);
    return result;
}

module.exports = { refreshProfile };
