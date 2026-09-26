"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createProfileEditor } = require("../../main/dist/electron/features/profiles/profile-editor-page");
const { createRuleEditor } = require("../../main/dist/electron/features/profiles/rule-editor-page");
const { createServerPage } = require("../../main/dist/electron/features/profiles/server-page");
const { assertRendererComposition } = require("../fixtures/assert-renderer-composition");

Vue.use(Vuex);
const EmptyComponent = { render: h => h("span") };
const labels = new Proxy({}, { get: (_target, key) => () => String(key) });

function editorDependencies(overrides = {}) {
    return {
        defineComponent,
        Vuex,
        getLanguage: () => labels,
        buildProxyConfig: value => value,
        fs: { readFileSync: () => Buffer.from("{}"), writeFileSync() {} },
        path,
        yaml: { parse: () => ({}), stringify: JSON.stringify },
        draggable: EmptyComponent,
        ...overrides
    };
}

test("Server page: profile editor delegates proxy construction with AnyTLS fields intact", () => {
    let state;
    const ProfileEditor = createProfileEditor(editorDependencies({
        buildProxyConfig(value) { state = value; return { name: value.proxyName, type: value.proxyType }; }
    }));
    const AppendProxyView = ProfileEditor.components.AppendProxyView;
    const vm = new (Vue.extend(AppendProxyView))({ propsData: { type: 1 } });
    let result;
    vm.$on("inputDone", value => { result = value; });
    Object.assign(vm, {
        proxyType: "anytls", proxyName: "edge", proxyServer: "server.test", proxyPort: 443,
        proxyPassword: "secret", proxySni: "sni.test", proxyAlpn: "h2,http/1.1",
        proxyIdleSessionCheckInterval: 11, proxyIdleSessionTimeout: 22, proxyMinIdleSession: 3
    });

    vm.confirmInput();

    assert.equal(state.proxyType, "anytls");
    assert.equal(state.proxySni, "sni.test");
    assert.equal(state.proxyAlpn, "h2,http/1.1");
    assert.equal(state.proxyIdleSessionCheckInterval, 11);
    assert.equal(state.proxyIdleSessionTimeout, 22);
    assert.equal(state.proxyMinIdleSession, 3);
    assert.deepEqual(result.content, { name: "edge", type: "anytls" });
    assert.equal(vm.$options._scopeId, "data-v-f638b328");
    assert.equal(ProfileEditor._scopeId, "data-v-9e0b3cf4");
    vm.$destroy();
});

test("Server page: rule editor emits MATCH rules and applies serialized rules", () => {
    const writes = [];
    const RuleEditor = createRuleEditor({
        defineComponent,
        Vuex,
        getLanguage: () => labels,
        moment: () => ({ locale() { return this; }, fromNow: () => "now" }),
        yaml: { parse: () => ({ existing: true }), stringify: JSON.stringify },
        fs: {
            readFileSync: () => Buffer.from("{}"),
            writeFileSync: (...args) => writes.push(args)
        },
        path,
        lodash: { debounce: callback => callback },
        notify() {},
        cloneJson: value => JSON.parse(JSON.stringify(value)),
        schedule: callback => callback()
    });
    const RuleAlterView = RuleEditor.components.RuleAlterView;
    const alter = new (Vue.extend(RuleAlterView))({ propsData: { profileName: "profile.yml" } });
    let emitted;
    alter.$on("done", value => { emitted = value; });
    alter.selectedType = "MATCH";
    alter.selectedGroup = "DIRECT";
    alter.inputDone();
    assert.deepEqual(emitted, { type: "MATCH", payload: "", proxy: "DIRECT" });
    assert.equal(alter.$options._scopeId, "data-v-eea841c4");

    const context = {
        profilesPath: "profiles", profileName: "profile.yml",
        memoryData: [
            { type: "DOMAIN", payload: "example.test", proxy: "DIRECT", params: "" },
            { type: "MATCH", payload: "", proxy: "REJECT", params: "" }
        ],
        saveBtnText: "Save",
        $emit() {}
    };
    RuleEditor.methods.applyRules.call(context);
    assert.deepEqual(JSON.parse(writes[0][1]).rules, ["DOMAIN,example.test,DIRECT", "MATCH,REJECT"]);
    assert.equal(context.saveBtnText, "save");
    assert.equal(RuleEditor._scopeId, "data-v-459dde1e");
    alter.$destroy();
});

test("Server page: extracted production component renders the profile shell", () => {
    const workflow = {
        data: () => ({
            editProfileName: "", editProfileType: -1, inputFocus: false, subUrl: "",
            qrcodeURL: "", loadingProfileIndex: [], downlodingUrls: {}
        }),
        computed: {
            profiles: { get() { return this.pfs.files || []; }, set() {} },
            getBtnClass: () => ({ confirm: true })
        },
        methods: {
            dropProfile() {}, dragOverProfile() {}, handleURLConfirm() {}, handleDownload() {},
            handleUpdateAllProfiles() {}, handleImport() {}, handleDragStart() {}, handleDragEnd() {}
        },
        beforeRouteEnter() {}, beforeRouteLeave() {}
    };
    const store = new Vuex.Store({
        state: { app: { clashPath: "", profiles: { index: -1, files: [] }, confData: {}, profilesPath: "" } },
        getters: { clashAxiosClient: () => ({}) },
        mutations: {
            CHANGE_PROFILES() {}, CHANGE_PROFILES_INDEX() {}, CHANGE_PROFILE() {},
            APPEND_PROFILE() {}, DELETE_PROFILE() {}
        }
    });
    const ServerPage = createServerPage({
        defineComponent, Vuex, getLanguage: () => labels, getLanguageIndex: () => 1,
        workflow, draggable: EmptyComponent, ProfileEditor: EmptyComponent,
        RuleEditor: EmptyComponent, Hint: EmptyComponent,
        qrcode: { toDataURL: async () => "data:image/png;base64,test" },
        shortenText: value => value, confirmOpenExternal() {}
    });
    const vm = new (Vue.extend(ServerPage))({ store });

    assert.equal(vm._render().data.attrs.id, "main-server-view");
    assert.equal(vm.$options._scopeId, "data-v-820f0efe");
    assert.equal(ServerPage.components.QRCodeView._scopeId, "data-v-2c37fa0d");
    vm.$destroy();
});

test("Server page: production entry delegates to named factories", () => {
    for (const factory of ["createProfileEditor", "createRuleEditor", "createServerPage"])
        assertRendererComposition(factory);
    assertRendererComposition("createServerPage", [
        'name: "QRCodeView"', "confirmInput: function", "handleRuleClick: function"
    ]);
});
