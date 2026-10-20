"use strict";

const { createProfileApplication } = require("../../features/profiles/profile-application");
const { buildTunConfig } = require("../../features/tun/build-tun-config");
const { createProfileNetworkEffects } = require("../../features/network/profile-network-effects");
const { prepareDisconnectCleanup } = require("../../features/connections/disconnect-cleanup");
const { trackProfileRefresh } = require("../../core/network/profile-refresh-state");

// Serialize refreshes on each renderer instance so async mixins cannot apply out of order.
const pending = new WeakMap();
const applied = new WeakMap();
function refreshProfile(vm, dependencies) {
    const run = async () => {
        const { platform, childProcess, setDns, getPort, messages } = dependencies;
        const previous = applied.get(vm);
        const state = { tun: vm.isTunEnable === true, mixin: vm.isMixinEnable === true, tapAllowed: vm.settings.legacyTapEnabled !== false };
        const turnedOff = previous && ((previous.tun && !state.tun) || (previous.mixin && !state.mixin)
            || (previous.tapAllowed && !state.tapAllowed));
        const cleanup = await prepareDisconnectCleanup({
            api: vm.clashApi, settings: vm.settings,
            disconnecting: turnedOff && previous.tunnelActive,
            scope: "tunnel",
            // Legacy TAP enters the core through SOCKS. Its metadata cannot be
            // distinguished from macOS System Proxy or manually configured SOCKS.
            includeSocks: previous?.tapActive && vm.isSystemProxyOn !== true,
            onError: () => dependencies.onDisconnectCleanupError?.()
        });
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
                startTap() { return vm.spawnTun2socks(); },
                async stopTap() { await vm.killSpawned(vm.tun2socks); vm.tun2socks = null; }
            }
        });
        const result = await apply({
            profiles: vm.profiles, profilesPath: vm.profilesPath,
            confData: vm.confData, settings: vm.settings,
            tunConfig: state.tun ? buildTunConfig(vm.tunSettings, platform) : null,
            mixinEnabled: state.mixin
        });
        if (result.success) {
            const tunnelActive = !!(payload?.tun?.enable || vm.tun2socks);
            applied.set(vm, { ...state, tunnelActive, tapActive: !!vm.tun2socks });
            await cleanup(!tunnelActive);
            dependencies.onProfileApplied?.();
        }
        return result;
    };
    const result = (pending.get(vm) || Promise.resolve()).then(run, run);
    pending.set(vm, result);
    trackProfileRefresh(vm.clashApi, result);
    return result;
}

module.exports = { refreshProfile };
