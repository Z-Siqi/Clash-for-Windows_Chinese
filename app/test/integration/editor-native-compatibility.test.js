"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const Vue = require("../../main/node_modules/vue");
const draggable = require("../../main/node_modules/vuedraggable");
const yaml = require("../../main/node_modules/yaml");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { createProfileEditor } = require("../../main/dist/electron/features/profiles/profile-editor-page");
const { buildProxyConfig } = require("../../main/dist/electron/features/profiles/proxy-editor-config");
const { parseRule, serializeRule } = require("../../main/dist/electron/features/profiles/rule-syntax");
const { replaceReferences, removeReferences } = require("../../main/dist/electron/features/profiles/profile-references");
const { builtinProxyTargets } = require("../../main/dist/electron/core/clash-core/core-capabilities");
const { resolveCoreBinaryPath } = require("../../main/dist/electron/core/clash-core/core-selection");

const directories = { "win32:x64": "win_x64", "win32:arm64": "win32-arm64", "linux:x64": "linux-x64",
    "linux:arm64": "linux-arm64", "darwin:x64": "darwin-x64", "darwin:arm64": "darwin-arm64" };
const directory = directories[`${process.platform}:${process.arch}`];
const root = path.resolve(__dirname, "../../..");

for (const coreType of ["clash", "mihomo"]) {
    test(`${coreType}: graphical edits preserve native-valid plugins, providers and rule semantics`, {
        skip: !directory && `unsupported host ${process.platform}/${process.arch}`
    }, async t => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-editor-native-"));
        t.after(() => fs.rmSync(home, { recursive: true, force: true }));
        const binary = resolveCoreBinaryPath({ path, filesPath: path.join(root, "app/clash_core", directory, "static/files"), coreType });
        fs.copyFileSync(path.join(root, "app/clash_core/win_x64/static/files/default/Country.mmdb"), path.join(home, "Country.mmdb"));
        fs.writeFileSync(path.join(home, "provider.yaml"), yaml.stringify({ proxies: [
            { name: "provider-node", type: "http", server: "127.0.0.1", port: 1234 }
        ] }));
        function validate(config) {
            const file = path.join(home, "config.yaml");
            fs.writeFileSync(file, yaml.stringify(config));
            const result = spawnSync(binary, ["-t", "-d", home, "-f", file], { encoding: "utf8", windowsHide: true, timeout: 15000 });
            assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
        }
        let saved;
        const Profile = createProfileEditor({ defineComponent, Vuex: { mapState: () => ({}) }, buildProxyConfig,
            draggable, yaml, getLanguage: () => createTranslator(1),
            profileFiles: { writeProfile: async (_directory, _name, text) => { saved = text; } } });
        function edit(node, type, changes) {
            const vm = new (Vue.extend(Profile.components.AppendProxyView))({ propsData: { type, data: { ...node, _index: 0 } } });
            vm.$options.mounted.forEach(hook => hook.call(vm));
            Object.assign(vm, changes);
            let content;
            vm.$on("inputDone", result => { content = result.content; });
            vm.confirmInput(); vm.$destroy();
            return content;
        }
        const node = { name: "node", type: "ss", server: "127.0.0.1", port: 1234, cipher: "aes-128-gcm", password: "fixture",
            plugin: "v2ray-plugin", "plugin-opts": { mode: "websocket", host: "example.test", path: "/ws", tls: true } };
        const group = { name: "Auto", type: "select", use: ["local"], proxies: ["node"], lazy: false, tolerance: 100 };
        const config = { proxies: [node], "proxy-providers": { local: { type: "file", path: "./provider.yaml" } },
            "proxy-groups": [group], rules: ["IP-CIDR,10.0.0.0/8,Auto,no-resolve", "MATCH,Auto"] };
        if (coreType === "mihomo") config.rules.unshift("AND,((NETWORK,UDP),(DST-PORT,443)),Auto");
        validate(config);
        config.proxies[0] = edit(node, 1, { proxyName: "renamed" });
        config["proxy-groups"][0] = edit(group, 0, {});
        config["proxy-groups"][0].proxies = ["renamed"];
        config.rules = config.rules.map(parseRule).map(serializeRule);
        validate(config);
        assert.equal(config.proxies[0].plugin, "v2ray-plugin");
        assert.equal(config.rules.some(rule => rule.endsWith(",no-resolve")), true);
        assert.deepEqual(config["proxy-groups"][0].use, ["local"]);
        const target = { name: "Drag Test", type: "select", proxies: [] };
        config["proxy-groups"].push(target);
        const editor = new (Vue.extend(Profile))();
        editor.conf = config;
        editor.proxyCore = coreType;
        function dragSources(vnode) {
            if (vnode.componentOptions?.tag === "draggable" && vnode.data.attrs.group.pull === "clone") {
                const source = new vnode.componentOptions.Ctor({ propsData: vnode.componentOptions.propsData });
                target.proxies.push(source.clone(vnode.data.model.value[0]));
                source.$destroy();
            }
            for (const child of vnode.children || vnode.componentOptions?.children || []) dragSources(child);
        }
        dragSources(editor._render());
        await editor.saveData();
        assert.equal(typeof saved, "string");
        const dragged = yaml.parse(saved);
        assert.deepEqual(dragged["proxy-groups"][1].proxies, ["DIRECT", "Auto", "renamed"]);
        validate(dragged);
        editor.$destroy();
        replaceReferences(config, "Auto", "DIRECT");
        config["proxy-groups"] = [];
        validate(config);
        replaceReferences(config, "renamed", "DIRECT");
        config.proxies = [];
        validate(config);
        for (const target of builtinProxyTargets(coreType)) validate({ ...config, rules: [`MATCH,${target}`] });
        const deleted = { proxies: [], "proxy-groups": [
            { name: "EmptyAfterDelete", type: "select", proxies: ["deleted-node"] },
            { name: "Keep", type: "select", proxies: ["deleted-node", "DIRECT"] }
        ], rules: ["DOMAIN,removed.example,deleted-node", "DOMAIN,empty.example,EmptyAfterDelete", "MATCH,Keep"] };
        removeReferences(deleted, "deleted-node");
        validate(deleted);
        assert.deepEqual(deleted.rules, ["MATCH,Keep"]);
    });
}
