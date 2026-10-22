"use strict";

const { createProfileApplication } = require("../../features/profiles/profile-application");
const { buildTunConfig } = require("../../features/tun/build-tun-config");
const { createProfileNetworkEffects } = require("../../features/network/profile-network-effects");
const { prepareDisconnectCleanup } = require("../../features/connections/disconnect-cleanup");
const { trackProfileRefresh } = require("../../core/network/profile-refresh-state");
const { resolveTapMode, allowsLegacyTap, isTapDns } = require("../../core/network/legacy-tap-policy");
const { createTranslator } = require("../../core/i18n/language");

// Serialize core writes, but let a newer request retire obsolete preparation and TAP startup.
const pending = new WeakMap();
const applied = new WeakMap();
const acceptedTap = new WeakMap();
const completed = new WeakMap();
function refreshProfile(vm, dependencies) {
    const predecessor = pending.get(vm);
    const request = { controller: new AbortController() };
    predecessor?.controller.abort();
    const isCurrent = () => pending.get(vm) === request;
    const run = async () => {
        if (!isCurrent()) return { success: false, message: null, superseded: true };
        const { platform, childProcess, setDns, getPort, messages } = dependencies;
        const previous = applied.get(vm);
        const previousPolicy = completed.get(vm);
        const previousMenu = [...(vm.menuItems || [])];
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
                setPayload(config, policy) {
                    payload = config;
                    acceptedTap.set(vm, { config, submitted: policy?.submitted, authorized: policy?.tapAuthorized === true,
                        profileTime: vm.profiles.files[vm.profiles.index]?.time, ...state });
                    vm.setCurrentProfilePayload({ payload: config });
                },
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
            completed.set(vm, { ...acceptedTap.get(vm), mode: vm.mode, tapActive: !!vm.tun2socks });
            await cleanup(!tunnelActive);
            if (isCurrent()) dependencies.onProfileApplied?.();
        } else if (result.tapFailed && isCurrent()) {
            const labels = dependencies.getLanguage?.() || createTranslator(1);
            let restored = false;
            try {
                // A controller write has already succeeded. Stop the failed
                // TAP attempt and compensate with the last completed payload;
                // flipping a Vue switch alone cannot undo DNS/rule changes.
                await vm.killSpawned(vm.tun2socks);
                vm.tun2socks = null;
                const failedCleanup = vm.clashApi.isReady ? await prepareDisconnectCleanup({ api: vm.clashApi, settings: vm.settings,
                    disconnecting: true, scope: "tunnel", includeSocks: vm.isSystemProxyOn !== true,
                    onError: () => dependencies.onDisconnectCleanupError?.() }) : async () => {};
                if (!previousPolicy?.submitted) throw Error(labels.tapNoPreviousConfiguration());
                const rollback = await vm.clashApi.putConfig({ payload: previousPolicy.submitted }, { validateStatus: () => true, timeout: 10000 });
                if (rollback.status !== 204) throw Error(labels.profileSwitchStatus({ status: rollback.status }));
                restored = true;
                acceptedTap.set(vm, previousPolicy);
                vm.setCurrentProfilePayload({ payload: previousPolicy.config });
                vm.setMenuItems({ items: previousMenu });
                if (previousPolicy.mode && vm.switchMode && await vm.switchMode(previousPolicy.mode, false) === false) {
                    throw Error(labels.failedConnectCore());
                }
                await failedCleanup(true);
                if (previousPolicy.tapActive && isCurrent()) await vm.spawnTun2socks({ isCurrent, signal: request.controller.signal });
                applied.set(vm, { ...previous, tapActive: !!vm.tun2socks, tunnelActive: !!(previousPolicy.config.tun?.enable || vm.tun2socks) });
                return { ...result, rolledBack: true, actualState: previousPolicy, restoredProfileTime: previousPolicy.profileTime };
            } catch (error) {
                return { ...result, rolledBack: restored, actualState: restored ? previousPolicy : state,
                    ...(restored ? { restoredProfileTime: previousPolicy.profileTime } : {}),
                    message: `${result.message}\n\n${labels.tapRollbackFailed({ reason: error.message })}` };
            }
        }
        return result;
    };
    const result = (predecessor?.result || Promise.resolve()).then(run, run);
    request.result = result;
    pending.set(vm, request);
    trackProfileRefresh(vm.clashApi, result);
    return result;
}

async function refreshTapAfterSetup(vm, { hasTap, connectedStatus }, installed) {
    // The driver did not change the core configuration. Reuse the policy the
    // core already accepted instead of re-downloading Providers or rerunning JS.
    await vm.killSpawned(vm.tun2socks);
    vm.tun2socks = null;
    const previous = applied.get(vm);
    if (previous) applied.set(vm, { ...previous, tapActive: false, tunnelActive: !!vm.currentProfilePayload?.tun?.enable });
    const policy = acceptedTap.get(vm);
    const updateCompletedTap = () => {
        const completedPolicy = completed.get(vm);
        if (completedPolicy && completedPolicy.config === policy?.config) {
            completed.set(vm, { ...completedPolicy, tapActive: !!vm.tun2socks });
        }
    };
    updateCompletedTap();
    if (installed === false || !policy || vm.clashStatus !== connectedStatus) return { success: true };
    if (policy.tun !== (vm.isTunEnable === true) || policy.mixin !== (vm.isMixinEnable === true)
        || policy.tapMode !== resolveTapMode(vm.settings)) return { success: false, message: "TAP policy changed; apply the current profile before starting TAP." };
    const eligible = allowsLegacyTap(vm.settings, policy.authorized) && !policy.config.tun?.enable && isTapDns(policy.config.dns);
    if (!eligible || (installed === undefined && !await hasTap())) return { success: true };
    if (!policy.config["interface-name"] && !policy.config.tun?.["auto-detect-interface"]) {
        return { success: false, message: "TAP is installed, but no upstream interface was available when the core configuration was applied. Connect to a network and apply the profile again." };
    }
    await vm.spawnTun2socks({ isCurrent: () => acceptedTap.get(vm) === policy && !vm.isCoreRestarting });
    if (previous) applied.set(vm, { ...previous, tapActive: !!vm.tun2socks, tunnelActive: !!(policy.config.tun?.enable || vm.tun2socks) });
    updateCompletedTap();
    return { success: true };
}

module.exports = { refreshProfile, refreshTapAfterSetup };
