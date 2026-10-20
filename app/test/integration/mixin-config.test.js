"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const yaml = require("../../main/node_modules/yaml");
const { DEFAULT_MIXIN } = require("../../main/dist/electron/features/clash-core/general-page-workflow");
const { prepareProfile } = require("../../main/dist/electron/features/profiles/prepare-profile");
const { buildTunConfig } = require("../../main/dist/electron/features/tun/build-tun-config");

const root = path.resolve(__dirname, "../../..");
const targets = {
    "win32:x64": ["win_x64", "win/x64", "mihomo-windows-amd64.exe", "clash-win64.exe"],
    "win32:arm64": ["win32-arm64", "win/arm64", "mihomo-windows-arm64.exe", "clash-win-arm64.exe"],
    "linux:x64": ["linux-x64", "linux/x64", "mihomo-linux-amd64", "clash-linux"],
    "linux:arm64": ["linux-arm64", "linux/arm64", "mihomo-linux-arm64", "clash-linux"],
    "darwin:x64": ["darwin-x64", "darwin/x64", "mihomo-darwin-amd64", "clash-darwin"],
    "darwin:arm64": ["darwin-arm64", "darwin/arm64", "mihomo-darwin-arm64", "clash-darwin"]
};
const target = targets[`${process.platform}:${process.arch}`];

for (const [name, index] of [["Mihomo", 2], ["Clash", 3]]) {
    test(`${name}: General Mixin DNS template and saved legacy template both pass native validation`, {
        skip: !target && `unsupported host ${process.platform}/${process.arch}`
    }, async t => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-mixin-config-"));
        t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
        fs.copyFileSync(path.join(root, "app/clash_core/win_x64/static/files/default/Country.mmdb"), path.join(directory, "Country.mmdb"));
        const binary = path.join(root, "app/clash_core", target[0], "static/files", target[1], target[index]);
        if (process.platform !== "win32") fs.chmodSync(binary, 0o755);
        for (const legacy of [false, true]) {
            const text = legacy ? DEFAULT_MIXIN.replace('"*.n.n.srv.nintendo.net"', '" *.n.n.srv.nintendo.net"') : DEFAULT_MIXIN;
            const settings = { mixinType: 0, mixinText: text };
            const prepared = await prepareProfile({
                source: "mode: direct\nproxies: []\nrules: []\n", profile: {}, settings, mixinEnabled: true
            }, { yaml });
            const config = legacy ? prepared.config : { mode: "direct", proxies: [], rules: [], ...yaml.parse(text).mixin };
            assert.equal(settings.mixinText, text);
            const file = path.join(directory, "config.yaml");
            fs.writeFileSync(file, yaml.stringify(config));
            // -t only validates syntax; it never creates a TUN/TAP adapter or binds DNS.
            const result = spawnSync(binary, ["-t", "-d", directory, "-f", file], {
                encoding: "utf8", windowsHide: true, timeout: 15000
            });
            assert.equal(result.status, 0, `${name}, legacy=${legacy}: ${result.stderr || result.stdout || result.error}`);
        }
        for (let bits = 0; bits < 8; bits++) {
            const { config } = await prepareProfile({
                source: "mode: direct\nproxies: []\nrules: []\n", profile: {},
                settings: { mixinType: 0, mixinText: DEFAULT_MIXIN, legacyTapEnabled: false },
                tunConfig: bits & 4 ? buildTunConfig({}, process.platform) : null, mixinEnabled: !!(bits & 2)
            }, { yaml });
            const file = path.join(directory, "config.yaml");
            fs.writeFileSync(file, yaml.stringify(config));
            const result = spawnSync(binary, ["-t", "-d", directory, "-f", file], {
                encoding: "utf8", windowsHide: true, timeout: 15000
            });
            assert.equal(result.status, 0, `${name}, switches=${bits}: ${result.stderr || result.stdout || result.error}`);
        }
    });
}
