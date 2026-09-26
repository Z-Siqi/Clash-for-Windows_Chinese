"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const lodash = require("../../main/node_modules/lodash");
const {
    createProfileParser,
    mergeProfileYaml,
    parseCommand,
    parseHeaderString,
    parseSubscriptionInfo
} = require("../../main/dist/electron/features/profiles/profile-parser");

const mergeDependencies = {
    yaml,
    cloneDeep: lodash.cloneDeep,
    reduce: lodash.reduce,
    shuffle: values => values.slice().reverse()
};

test("profile parser commands retain nested names, generated proxy lists and scalar types", () => {
    assert.deepEqual(parseCommand("proxy-groups.(Group.One).proxies=[]proxyNames|^A$"), {
        path: ["proxy-groups", "Group.One", "proxies"],
        operation: parseCommand("value=x").operation,
        value: "[]proxyNames|^A$"
    });
    const result = yaml.parse(mergeProfileYaml(yaml.stringify({
        port: 7890,
        enabled: false,
        rules: ["MATCH,DIRECT"],
        proxies: [{ name: "A" }, { name: "B" }],
        "proxy-groups": [{ name: "Group.One", proxies: [] }]
    }), {
        "prepend-rules": ["DOMAIN,example.com,DIRECT"],
        "append-rules": ["MATCH,A"],
        "mix-proxy-providers": { remote: { type: "http" } },
        commands: [
            "proxy-groups.(Group.One).proxies=[]proxyNames|^A$",
            "port=9000",
            "enabled=true"
        ]
    }, mergeDependencies));
    assert.deepEqual(result.rules, ["DOMAIN,example.com,DIRECT", "MATCH,DIRECT", "MATCH,A"]);
    assert.deepEqual(result["proxy-groups"][0].proxies, ["A"]);
    assert.equal(result.port, 9000);
    assert.equal(result.enabled, true);
    assert.equal(result["proxy-providers"].remote.type, "http");
});

test("profile parser preserves omitted sections when a mixin explicitly disables them", () => {
    const result = yaml.parse(mergeProfileYaml("mode: rule\n", {
        "prepend-rules": null, "append-rules": null,
        "prepend-proxies": null, "append-proxies": null,
        "prepend-proxy-groups": null, "append-proxy-groups": null,
        "mix-proxy-providers": null, "mix-rule-providers": null
    }, mergeDependencies));
    assert.deepEqual(result, { mode: "rule" });
});

test("profile parser applies inline, YAML file, declarative and remote parsers in order", async () => {
    const calls = [];
    const fakeFs = {
        createWriteStream: value => ({ value }),
        readFileSync: file => file.endsWith(".yaml") ? "append-rules:\n  - DOMAIN,file,DIRECT\n" : "file-script",
        existsSync: () => false,
        writeFileSync() {}
    };
    const store = {
        state: { app: {
            clashPath: "C:/cfw",
            profiles: { files: [{ url: "https://example/profile", name: "saved" }] },
            settings: { allowRemoteProfileParsers: true, profileParsersText: yaml.stringify({ parsers: [{
                reg: "example", code: "inline-script", file: "parser.yaml",
                yaml: { "append-rules": ["DOMAIN,declarative,DIRECT"] },
                remote: { url: "https://example/parser.js", cache: true }
            }] }) }
        } },
        dispatch: async action => { assert.equal(action, "getParserLogPath"); return "parser.log"; }
    };
    const parser = createProfileParser({
        store,
        axios: { get: async (url, options) => {
            calls.push([url, options]);
            return { status: 200, data: "remote-script" };
        } },
        got() {}, fs: fakeFs, path, yaml,
        cloneDeep: lodash.cloneDeep, reduce: lodash.reduce, shuffle: lodash.shuffle,
        requireFromString: source => ({ parse: async (value, context, profile) => {
            assert.equal(context.homeDir, "C:/cfw");
            assert.equal(profile.name, "saved");
            const data = yaml.parse(value);
            data[source.includes("remote-script") ? "remoteApplied" : "inlineApplied"] = true;
            return yaml.stringify(data);
        } }),
        Console: class { constructor(stream) { this.stream = stream; } },
        notify() {}, diff3Merge() {}, parseContentDisposition() {}, HttpsProxyAgent: class {},
        getLanguage() { return {}; }
    });
    const result = await parser.parseProfile("https://example/profile", "rules:\n  - MATCH,DIRECT\n", true);
    assert.match(result, /DOMAIN,file,DIRECT/);
    assert.match(result, /DOMAIN,declarative,DIRECT/);
    assert.equal(yaml.parse(result).inlineApplied, true);
    assert.equal(yaml.parse(result).remoteApplied, true);
    assert.equal(calls[0][1].headers["cache-control"], "max-age=3600");
});

test("profile parser rejects remote JavaScript unless the unsafe compatibility switch is explicit", async () => {
    let requested = false;
    const store = {
        state: { app: {
            clashPath: "C:/cfw",
            profiles: { files: [] },
            settings: { profileParsersText: yaml.stringify({ parsers: [{
                reg: "example", remote: { url: "https://example/parser.js" }
            }] }) }
        } },
        dispatch: async () => "parser.log"
    };
    const parser = createProfileParser({
        store,
        axios: { get: async () => { requested = true; return { status: 200, data: "" }; } },
        got() {}, fs: { createWriteStream: () => ({}) }, path, yaml,
        cloneDeep: lodash.cloneDeep, reduce: lodash.reduce, shuffle: lodash.shuffle,
        requireFromString() {}, Console: class {}, notify() {}, diff3Merge() {},
        parseContentDisposition() {}, HttpsProxyAgent: class {}, getLanguage: () => ({})
    });
    await assert.rejects(
        parser.parseProfile("https://example/profile", "mode: rule\n", true),
        error => /disabled for security/.test(error.message)
    );
    assert.equal(requested, false);
});

test("profile download preserves request headers and appends a parsed profile", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-profile-parser-"));
    const logPath = path.join(directory, "parser.log");
    const profileFs = {
        createWriteStream: () => ({}),
        existsSync: fs.existsSync,
        readFileSync: fs.readFileSync,
        writeFileSync: fs.writeFileSync
    };
    const commits = [];
    const store = {
        state: { app: {
            clashPath: directory,
            profilesPath: directory,
            confData: { "mixed-port": 7890 },
            profiles: { files: [] },
            settings: { headersText: "headers:\n  X-Global: global\n", profileParsersText: "", updateProfileThroughClashProxy: false }
        } },
        dispatch: async () => logPath,
        commit: (name, payload) => commits.push([name, payload])
    };
    let request;
    const parser = createProfileParser({
        store,
        axios: { get: async (url, options) => {
            request = { url, options };
            return {
                status: 200,
                data: "mode: rule\n",
                headers: {
                    "content-disposition": "attachment",
                    "profile-update-interval": "12",
                    "subscription-userinfo": "upload=1; download=2; total=3; expire=4"
                }
            };
        } },
        got() {}, fs: profileFs, path, yaml,
        cloneDeep: lodash.cloneDeep, reduce: lodash.reduce, shuffle: lodash.shuffle,
        requireFromString() {}, Console: class {},
        notify() {}, diff3Merge() {}, parseContentDisposition: () => ({ parameters: { filename: "named.yml" } }),
        HttpsProxyAgent: class {},
        getLanguage: () => ({
            downloadProfile: () => "download", failedErrorHTTP: () => "http",
            failedWithError: () => "error", unknowErr: () => "unknown",
            diffChangeContainConflict: () => "conflict", failMergeProfile: () => "merge"
        })
    });
    try {
        const result = await parser.downloadProfile({
            url: "https://example/profile.yaml", headersString: "X-Request: request"
        });
        assert.deepEqual(result, { success: true, targetIndex: 0 });
        assert.equal(request.options.headers["X-Request"], "request");
        assert.equal(request.options.headers["X-Global"], "global");
        assert.equal(commits[0][0], "APPEND_PROFILE");
        assert.equal(commits[0][1].profile.name, "named.yml");
        assert.equal(commits[0][1].profile.interval, 12);
        assert.deepEqual(commits[0][1].profile.subInfo, { upload: 1, download: 2, total: 3, expire: 4 });
        assert.equal(fs.readFileSync(path.join(directory, commits[0][1].profile.time), "utf8"), "mode: rule\n");
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("profile download through Clash uses Axios with an authenticated loopback proxy", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-profile-proxy-"));
    const requests = [];
    const profileFs = {
        createWriteStream: () => ({}),
        existsSync: fs.existsSync,
        readFileSync: fs.readFileSync,
        writeFileSync: fs.writeFileSync
    };
    class FakeHttpsProxyAgent {
        constructor(options) { this.options = options; }
    }
    const store = {
        state: { app: {
            clashPath: directory,
            profilesPath: directory,
            confData: { "mixed-port": 7890, authentication: ["user:pass"] },
            profiles: { files: [] },
            settings: { profileParsersText: "", updateProfileThroughClashProxy: true }
        } },
        dispatch: async () => path.join(directory, "parser.log"),
        commit() {}
    };
    const parser = createProfileParser({
        store,
        axios: { get: async (url, options) => {
            requests.push({ url, options });
            return { status: 200, data: "mode: rule\n", headers: {} };
        } },
        got() { throw new Error("legacy Got transport must not be used"); },
        fs: profileFs, path, yaml,
        cloneDeep: lodash.cloneDeep, reduce: lodash.reduce, shuffle: lodash.shuffle,
        requireFromString() {}, Console: class {}, notify() {}, diff3Merge() {},
        parseContentDisposition() {}, HttpsProxyAgent: FakeHttpsProxyAgent,
        getLanguage: () => ({
            downloadProfile: () => "download", failedErrorHTTP: () => "http",
            failedWithError: () => "error", unknowErr: () => "unknown",
            diffChangeContainConflict: () => "conflict", failMergeProfile: () => "merge"
        })
    });
    try {
        assert.deepEqual(await parser.downloadProfile({ url: "https://example/profile.yaml" }), {
            success: true,
            targetIndex: 0
        });
        assert.equal(requests[0].options.proxy, false);
        assert.equal(requests[0].options.httpsAgent.options.proxy, "http://user:pass@127.0.0.1:7890");
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("profile metadata parsers keep legacy fallbacks", () => {
    assert.deepEqual(parseHeaderString("A: one\nB: two"), { A: "one", B: "two" });
    assert.deepEqual(parseHeaderString("broken"), {});
    assert.deepEqual(parseSubscriptionInfo("upload=5; total=9"), { upload: 5, total: 9 });
});
