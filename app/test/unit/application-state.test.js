"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createAppMutations } = require("../../main/dist/electron/features/application-state/mutations");
const { createAppGetters } = require("../../main/dist/electron/features/application-state/getters");
const { createAppActions } = require("../../main/dist/electron/features/application-state/actions");
const { persistSelection } = require("../../main/dist/electron/features/profiles/persist-selection");
const { createProfileNetworkEffects } = require("../../main/dist/electron/features/network/profile-network-effects");

test("state transitions retain mode/status guards, immutable profile changes and counters", () => {
    const connectionStatus = { CONNECTED: Symbol(), DISCONNECTED: Symbol() };
    const mutations = createAppMutations({ path, connectionStatus });
    const state = { mode: "direct", clashStatus: connectionStatus.DISCONNECTED, profiles: { index: 0, files: [{ time: "a" }] }, errors: [], profileRefreshTimes: 0, clashAxiosFlyingRequestCount: 0 };
    mutations.CHANGE_MODE(state, { mode: "invalid" }); assert.equal(state.mode, "direct");
    mutations.SET_CLASH_STATUS(state, { status: "unknown" }); assert.equal(state.clashStatus, connectionStatus.DISCONNECTED);
    mutations.SET_CLASH_STATUS(state, { status: connectionStatus.CONNECTED }); assert.equal(state.clashStatus, connectionStatus.CONNECTED);
    const previous = state.profiles;
    mutations.APPEND_PROFILE(state, { profile: { time: "b" } }); assert.equal(previous.files.length, 1);
    mutations.CHANGE_PROFILE(state, { index: 0, profile: { time: "c" } }); assert.equal(previous.files[0].time, "a");
    mutations.DELETE_PROFILE(state, { index: 1 }); assert.equal(state.profiles.files.length, 1);
    mutations.ADD_PROFILE_REFRESH_TIMES(state, {}); assert.equal(state.profileRefreshTimes, 1);
    mutations.ADD_AXIOS_FLYING_REQUEST_COUNT(state, { count: 2 }); assert.equal(state.clashAxiosFlyingRequestCount, 2);
    mutations.SET_IS_DEV_MODE(state, { isDevMode: true }); assert.equal(state.isWindowShow, true);
});

test("getters select both packaged cores, theme and controller clients", () => {
    let clientOptions;
    const getters = createAppGetters({ path, platform: "win32", arch: "x64", cache: { get: () => ["B", "A"] }, keys: {}, trim: value => value.trim(), axios: { create: options => { clientOptions = options; return {}; } } });
    const state = { settings: {}, confData: {}, isDevMode: false, exePath: path.join("test", "CFW.exe"), menuItems: [{ title: "A" }, { title: "B" }] };
    assert.equal(getters.theme(state), "unknown");
    state.settings = { systemTheme: true }; state.shouldUseDarkTheme = true; assert.equal(getters.theme(state), "dark");
    assert.deepEqual(getters.menuItemsWithOrder(state).map(item => item.title), ["B", "A"]);
    assert.equal(state.menuItems[0].title, "A");
    assert.match(getters.clashBinaryPath(state, { filesPath: "files" }), /clash-win64.exe$/);
    state.settings.proxyCore = "mihomo";
    assert.match(getters.clashBinaryPath(state, { filesPath: "files" }), /mihomo-windows-amd64.exe$/);
    getters.clashAxiosClient(state, { controllerPort: 12345, secret: "" });
    assert.equal(clientOptions.baseURL, "http://127.0.0.1:12345/");
});

test("mode actions tolerate offline clients without mutating state", async () => {
    const actions = createAppActions({ path, ipcRenderer: {} });
    const context = { commit() { throw Error("must not commit"); }, state: { settings: { proxyCore: "clash" } }, getters: { clashApi: { getConfig: async () => { throw Error("offline"); }, patchConfig: async () => { throw Error("offline"); } } } };
    await actions.getMode(context); await actions.setMode(context, { mode: "rule" });
});

test("mode actions normalize legacy Script mode before calling Mihomo", async () => {
    const requests = [], commits = [];
    const actions = createAppActions({ path, ipcRenderer: {} });
    await actions.setMode({
        state: { settings: { proxyCore: "mihomo" } },
        getters: { clashApi: { patchConfig: async body => (requests.push(body), { status: 204 }) } },
        commit: (name, payload) => commits.push([name, payload])
    }, { mode: "script" });
    assert.deepEqual(requests, [{ mode: "rule" }]);
    assert.deepEqual(commits, [["CHANGE_MODE", { mode: "rule" }]]);
});

test("selection persistence never writes an old response into a newly selected profile", async () => {
    let finish;
    let profiles = { index: 0, files: [{ time: "a" }, { time: "b" }] };
    const changes = [];
    const running = persistSelection({ getProfiles: () => profiles, changeProfile: value => changes.push(value), clashApi: { getProxies: () => new Promise(resolve => { finish = resolve; }) } });
    profiles = { ...profiles, index: 1 };
    finish({ data: { proxies: { group: { type: "Selector", name: "group", now: "DIRECT" } } } });
    await running; assert.equal(changes.length, 0);
    await persistSelection({ getProfiles: () => profiles, changeProfile: value => changes.push(value), clashApi: { getProxies: async () => ({ data: { proxies: { group: { type: "Selector", name: "group", now: "DIRECT" }, node: { type: "Direct" } } } }) } });
    assert.deepEqual(changes[0].profile.selected, [{ name: "group", now: "DIRECT" }]);
});

test("DHCP retries stop after five attempts even when probing fails", async () => {
    let tick; const cancellations = [];
    const effects = createProfileNetworkEffects({ childProcess: {}, getPort: async () => { throw Error("probe failed"); }, setInterval: fn => { tick = fn; return 5; }, clearInterval: handle => cancellations.push(handle) });
    effects.renewDhcp();
    for (let i = 0; i < 5; i++) await tick();
    assert.deepEqual(cancellations, [5]);
});
