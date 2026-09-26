"use strict";

const { createProfileApplication } = require("../../features/profiles/profile-application");
const { buildTunConfig } = require("../../features/tun/build-tun-config");
const { createProfileNetworkEffects } = require("../../features/network/profile-network-effects");
const { prepareDisconnectCleanup } = require("../../features/connections/disconnect-cleanup");

// Serialize refreshes on each renderer instance so async mixins cannot apply out of order.
const pending = new WeakMap();
const applied = new WeakMap();
function refreshProfile(vm, dependencies) {
    const run = async () => {
        const { platform, childProcess, setDns, getPort, messages } = dependencies;
        const previous = applied.get(vm);
        const state = { tun: vm.isTunEnable === true, mixin: vm.isMixinEnable === true };
        const turnedOff = previous && ((previous.tun && !state.tun) || (previous.mixin && !state.mixin));
        const cleanup = await prepareDisconnectCleanup({
            api: vm.clashApi, settings: vm.settings,
            disconnecting: turnedOff && previous.tunnelActive,
            onError: () => dependencies.onDisconnectCleanupError?.()
        });
        let payload;
        const apply = createProfileApplication({
            ...dependencies,
            clashApi: vm.clashApi,
            effects: {
                ...createProfileNetworkEffects({ childProcess, getPort }),
                detectInterface() { vm.detectInterfaceName(); return vm.finalInterfaceName; },
                setPayload(config) { payload = config; vm.setCurrentProfilePayload({ payload: config }); },
                setProvidersVisible(visible) {
                    const title = messages.providers;
                    const items = vm.menuItems;
                    if (visible && !items.some(item => item.title === title)) {
                        vm.setMenuItems({ items: [...items, { title, path: "/home/provider" }] });
                    } else if (!visible) vm.setMenuItems({ items: items.filter(item => item.title !== title) });
                },
                setDns,
                setDnsChanged(changed) { vm.isUserDNSChanged = changed; },
                resetDns() { return vm.resetDNS(); },
                switchMode(mode) { return vm.switchMode(mode, false); },
                startTap() { return vm.spawnTun2socks(); },
                stopTap() { vm.killSpawned(vm.tun2socks); vm.tun2socks = null; }
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
            applied.set(vm, { ...state, tunnelActive });
            await cleanup(!tunnelActive);
        }
        return result;
    };
    const result = (pending.get(vm) || Promise.resolve()).then(run, run);
    pending.set(vm, result);
    return result;
}

module.exports = { refreshProfile };
