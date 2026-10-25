"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const moment = require("../../main/dist/electron/core/i18n/moment");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createProfileEditor } = require("../../main/dist/electron/features/profiles/profile-editor-page");
const { createRuleEditor } = require("../../main/dist/electron/features/profiles/rule-editor-page");
const { createServerPage } = require("../../main/dist/electron/features/profiles/server-page");
const { createServerPageWorkflow } = require("../../main/dist/electron/features/profiles/server-page-workflow");
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
    assert.equal(context.saveBtnText, null);
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

test("Server page: updated profile age reacts immediately to language switches and new modification times", async () => {
    const language = Vue.observable({ index: 0 });
    const labels = createTranslator(() => language.index);
    const profiles = [{ name: "remote", time: "remote.yaml", url: "https://fixture.test/profile" },
        { name: "local", time: "local.yaml", url: "" }];
    const store = new Vuex.Store({
        state: { app: { profiles: { index: -1, files: profiles }, confData: {}, profilesPath: "virtual-profiles" } },
        getters: { clashAxiosClient: () => ({}) }
    });
    const workflow = createServerPageWorkflow({ labels, getLanguage: () => labels, moment, formatBytes: String });
    const Page = createServerPage({
        defineComponent, Vuex, getLanguage: () => labels, workflow,
        draggable: EmptyComponent, ProfileEditor: EmptyComponent, RuleEditor: EmptyComponent,
        Hint: EmptyComponent, qrcode: {}, shortenText: value => value
    });
    const page = new (Vue.extend(Page))({ store });
    page.now = moment("2026-10-22T12:00:00Z");
    page.profileModificationTimes = Object.fromEntries(profiles.map(profile => [profile.time, page.now.clone().subtract(5, "minutes").valueOf()]));
    function renderedTimes(vnode, result = []) {
        if (vnode.data?.class?.["item-time"]) result.push(vnode.children[0].text.trim());
        for (const child of vnode.children || vnode.componentOptions?.children || []) renderedTimes(child, result);
        return result;
    }
    let visible = renderedTimes(page._render());
    const stop = page.$watch(() => renderedTimes(page._render()).join("|"), value => { visible = value.split("|"); });
    for (const [index, expected] of [[1, "(5 minutes ago)"], [0, "(5 分钟前)"], [1, "(5 minutes ago)"]]) {
        language.index = index;
        await Vue.nextTick();
        assert.deepEqual(visible, [expected, expected]);
    }
    page.$set(page.profileModificationTimes, profiles[0].time, page.now.clone().subtract(30, "seconds").valueOf());
    await Vue.nextTick();
    assert.deepEqual(visible, ["(a few seconds ago)", "(5 minutes ago)"]);
    language.index = 0;
    await Vue.nextTick();
    assert.deepEqual(visible, ["(几秒前)", "(5 分钟前)"]);
    stop(); page.$destroy();
});
