"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const { createCoreConfigRepository } = require("../../main/dist/electron/features/settings/core-config-repository");

function setup(t, platform = "linux") {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-config-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const home = path.join(directory, "data"), assets = path.join(directory, "assets");
    fs.mkdirSync(path.join(assets, "default"), { recursive: true });
    fs.mkdirSync(path.join(assets, "win", "x64"), { recursive: true });
    fs.writeFileSync(path.join(assets, "default", "Country.mmdb"), "fixture");
    fs.writeFileSync(path.join(assets, "win", "x64", "wintun.dll"), "fixture");
    const repo = createCoreConfigRepository({ fs, path, yaml, platform, arch: "x64", uuid: () => "", shouldReplaceWintun: async () => false });
    return { repo, home, assets };
}

test("initialization creates loopback defaults and platform assets, and preserves existing config", async t => {
    const { repo, home, assets } = setup(t, "win32");
    await repo.initialize(home, assets);
    assert.equal(repo.load(home)["external-controller"], "127.0.0.1:9090");
    assert.equal(repo.load(home)["allow-lan"], false);
    assert.equal(fs.existsSync(path.join(home, "wintun.dll")), true);
    fs.writeFileSync(path.join(home, "config.yaml"), "# original\nmixed-port: 7895\n");
    await repo.initialize(home, assets);
    assert.equal(fs.readFileSync(path.join(home, "config.yaml"), "utf8"), "# original\nmixed-port: 7895\n");
});

test("legacy config.yml and separate ports migrate without losing comments", async t => {
    const { repo, home, assets } = setup(t);
    fs.mkdirSync(home); fs.writeFileSync(path.join(home, "config.yml"), "# user comment\nport: 7897\nsocks-port: 7898\n");
    await repo.initialize(home, assets);
    assert.equal(repo.load(home)["mixed-port"], 7897);
    assert.equal(repo.load(home).port, undefined);
    assert.match(fs.readFileSync(path.join(home, "config.yaml"), "utf8"), /# user comment/);
    assert.equal(fs.existsSync(path.join(home, "config.yml")), false);
});

test("invalid existing core config survives initialization and fails load", async t => {
    const { repo, home, assets } = setup(t);
    fs.mkdirSync(home); fs.writeFileSync(path.join(home, "config.yaml"), "[broken");
    await repo.initialize(home, assets);
    assert.equal(fs.readFileSync(path.join(home, "config.yaml"), "utf8"), "[broken");
    assert.throws(() => repo.load(home));
});

test("random controller port remains loopback and manual mixed port survives startup", async t => {
    const { repo, home, assets } = setup(t);
    await repo.initialize(home, assets);
    fs.writeFileSync(path.join(home, "config.yaml"), "mixed-port: 7896\nexternal-controller: 127.0.0.1:9090\n");
    const changes = [];
    const input = { clashPath: home, confData: repo.load(home), settings: { randomControllerPort: true, randomMixedPort: false }, getPort: async () => 12345, onChange: data => changes.push(data) };
    await repo.randomizePorts(input);
    assert.equal(repo.load(home)["mixed-port"], 7896);
    assert.equal(repo.load(home)["external-controller"], "127.0.0.1:12345");
    assert.equal(changes.length, 1);
    for (const skip of [{ devMode: true }, { lightweightMode: true }]) {
        await repo.randomizePorts({ ...input, ...skip, getPort: () => { throw Error("must not run"); } });
    }
    await assert.rejects(repo.randomizePorts({ ...input, getPort: async () => 65536 }), /Invalid generated/);
    assert.equal(changes.length, 1);
});
