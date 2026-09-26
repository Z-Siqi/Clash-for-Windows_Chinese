"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const BigNumber = require("../../main/node_modules/bignumber.js");
const yaml = require("../../main/node_modules/yaml");
const { createRendererUtilities } = require("../../main/dist/electron/entry/renderer/utilities");
const { installEditorLanguage } = require("../../main/dist/electron/features/renderer-ui/editor-language");

function utilities({ store, ipcRenderer, shell, Notification, storage = new Map(), locale = 0 }) {
    return createRendererUtilities({
        fs, path, yaml, crypto, BigNumber, store, ipcRenderer, shell, Notification,
        getLanguage: () => locale,
        cache: { get: key => storage.get(key), put: (key, value) => storage.set(key, value) },
        keys: { LAST_VERSION_CODE: "lastVersion" }
    });
}

test("Renderer utilities: confirmed links, notification click behavior and semantic DNS use production wiring", async () => {
    const calls = [], opened = [], notices = [];
    let response = 0, ready = false;
    const store = { state: { app: { settings: { showNotifications: false } } }, getters: {
        clashApi: { isReady: () => ready, queryDns: async (...args) => { calls.push(args); return { data: { Answer: [] } }; } }
    } };
    const api = utilities({ store, ipcRenderer: { invoke: async (...args) => { calls.push(args); return { response }; } }, shell: { openExternal: url => opened.push(url) },
        Notification: class { constructor(title, options) { this.title = title; this.options = options; notices.push(this); } }
    });
    await api.confirmOpenExternal("https://example.com");
    assert.equal(opened.length, 0);
    assert.equal(calls[0][2].message, "您确定要打开此 URL?");
    response = 1;
    await api.confirmOpenExternal("https://example.com");
    assert.deepEqual(opened, ["https://example.com/"]);
    assert.equal(await api.confirmOpenExternal("file:///C:/malware.exe"), false);
    assert.deepEqual(opened, ["https://example.com/"]);
    api.notify("disabled");
    assert.equal(notices.length, 0);
    store.state.app.settings.showNotifications = true;
    let clicked = 0;
    api.notify("title", "body", null, () => clicked++);
    notices[0].onclick();
    assert.deepEqual(calls.at(-1), ["window-control", "show"]);
    assert.equal(clicked, 1);
    const count = calls.length;
    api.notify("hidden", "", { hideWindowOnClick: true });
    notices[1].onclick();
    assert.equal(calls.length, count);
    await assert.rejects(api.queryDns("example.com", "A"), /not ready/);
    ready = true;
    assert.deepEqual(await api.queryDns("example.com", "A"), { Answer: [] });
    assert.deepEqual(calls.at(-1), ["example.com", "A"]);
});

test("Renderer utilities: settings helpers, version cache and temporary directory removal preserve their contracts", async t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-ui-tools-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const storage = new Map([["lastVersion", "old"]]);
    const api = utilities({ store: { state: { app: { settings: {} } } }, storage, ipcRenderer: { invoke: async () => "current" } });
    assert.equal(await api.isNewVersion(), true);
    assert.equal(await api.isNewVersion(), true);
    assert.equal(storage.get("lastVersion"), "current");
    assert.equal(api.hashText("abc"), "900150983cd24fb0d6963f7d28e17f72");
    assert.equal(api.flattenValues({ first: "one", nested: { second: "two" } }), "one\ntwo");
    assert.equal(api.shortenText("123456789", 4), "12...89");
    assert.equal(api.formatBytes(2048), "2.00 KB");
    for (const port of [1, 65535, "7890"]) assert.equal(api.isPortInRange(port), true);
    for (const port of [0, 65536, 1.5, "1.5", true, NaN]) assert.equal(api.isPortInRange(port), false);
    const file = path.join(home, "config.yaml");
    fs.writeFileSync(file, "mode: rule\n");
    await api.updateYaml(file, "mode", "direct");
    assert.match(fs.readFileSync(file, "utf8"), /mode: direct/);
    const directory = path.join(home, "nested");
    fs.mkdirSync(path.join(directory, "child"), { recursive: true });
    fs.writeFileSync(path.join(directory, "child", "data"), "test");
    api.removeDirectory(directory);
    assert.equal(fs.existsSync(directory), false);
    assert.equal(fs.existsSync(file), true);
});

test("Editor foundation: production bridge registers YAML completion, provider lenses, commands and scroll state", async () => {
    const providers = {}, commands = {}, calls = [];
    let fail = false;
    const monaco = {
        languages: {
            CompletionItemKind: { Snippet: 1, Keyword: 2 }, CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
            registerCompletionItemProvider: (language, provider) => { providers.completion = provider; assert.equal(language, "yaml"); },
            registerCodeLensProvider: (language, provider) => { providers.lens = provider; assert.equal(language, "yaml"); }
        }, editor: { create() {}, registerCommand: (name, handler) => { commands[name] = handler; } }
    };
    const api = installEditorLanguage({
        monaco,
        hashText: () => "hash",
        showMessageBox: options => calls.push(options),
        shell: { showItemInFolder: file => calls.push(file) },
        clipboard: { writeText: value => calls.push(value) },
        axios: { get: async url => {
            calls.push(url);
            if (fail) throw Error("offline");
            return { status: 200, data: { rule: { prefix: "MATCH", body: ["MATCH,${1:policy}"] } } };
        } },
        fs: { existsSync: file => file.endsWith(path.join("proxy", "hash.yaml")) },
        path,
        store: { state: { app: { clashPath: "/profile" } } },
        labels: new (require("../../main/dist/electron/core/i18n/language").Language)(1)
    });
    const model = {
        getValue: () => 'proxies:\n  - name: "node"\nrules:\n  ',
        getValueInRange() { return this.getValue(); }, getWordUntilPosition: () => ({ startColumn: 3, endColumn: 3 }),
        getLineCount: () => 1, getLineContent: () => 'url: "https://example.com/provider"'
    };
    const result = await providers.completion.provideCompletionItems(model, { lineNumber: 4, column: 3 });
    assert.equal(result.suggestions[0].insertText, "MATCH,${1|DIRECT,REJECT,GLOBAL,node|}");
    assert.ok(result.suggestions.some(item => item.label === "node"));
    assert.match(calls[0], /\/rules\.code-snippets$/);
    fail = true;
    assert.deepEqual(await providers.completion.provideCompletionItems(model, { lineNumber: 4, column: 3 }), { suggestions: [] });
    const lenses = await providers.lens.provideCodeLenses(model);
    assert.equal(lenses.lenses[0].command.id, "openFile");
    const file = lenses.lenses[0].command.arguments[0];
    await commands.openFile(null, file);
    assert.equal(calls.at(-1), file);
    await commands.copyURLMD5(null, "hash");
    assert.equal(calls.at(-2), "hash.yaml");
    api.saveScrollPosition("document", 84);
    assert.equal(api.getScrollPosition("document"), 84);
    assert.equal(api.getScrollPosition("new"), 0);
});
