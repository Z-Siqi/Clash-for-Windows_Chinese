"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { Language, language } = require("../../main/dist/electron/core/i18n/language");
const { removeEmoji } = require("../../main/dist/electron/core/text/remove-emoji");
const { getRendererTrayIcon } = require("../../main/dist/electron/features/tray/renderer-tray-icon");
const { createAutoLaunch } = require("../../main/dist/electron/features/application/set-auto-launch");
const { createRendererCapabilities } = require("../../main/dist/electron/entry/renderer/capabilities");
const { createPlatform } = require("../../main/dist/electron/core/runtime/platform");

test("platform identities preserve packaged target comparisons and Windows ARM32 fallback", () => {
    for (const [platform, arch, key] of [
        ["win32", "x64", "windowsX64"], ["win32", "ia32", "windowsX86"], ["win32", "arm64", "windowsArm64"],
        ["darwin", "x64", "macX64"], ["darwin", "arm64", "macArm64"],
        ["linux", "x64", "linuxX64"], ["linux", "arm64", "linuxArm64"]
    ]) {
        const target = createPlatform({ platform, arch });
        assert.equal(target.current(), target[key]);
        assert.equal(target.assetTarget(), target[key]);
        assert.equal(target.isWindows(), platform === "win32");
        assert.equal(target.isMacOS(), platform === "darwin");
        assert.equal(target.isLinux(), platform === "linux");
    }
    const arm = createPlatform({ platform: "win32", arch: "arm" });
    assert.equal(arm.current(), arm.windowsArm);
    assert.equal(arm.assetTarget(), arm.windowsX86);
    const unknown = createPlatform({ platform: "freebsd", arch: "x64" });
    assert.equal(unknown.current(), unknown.unknown);
    assert.equal(unknown.isLinux(), false);
});

test("language retains legacy defaults, fallback and every page translation method", () => {
    assert.equal(new Language(null).locale(), "zh-cn");
    assert.equal(new Language(0).feedback(), "关于");
    assert.equal(new Language(1).feedback(), "Feedback");
    assert.equal(language(-1, "en", "cn"), "en");
    for (const key of Object.getOwnPropertyNames(Language.prototype).filter(key => key !== "constructor")) {
        for (const locale of [0, 1]) {
            const value = new Language(locale)[key]();
            assert.ok(typeof value === "string" || Array.isArray(value), `${key}/${locale}`);
        }
    }
});

test("emoji removal preserves plain text and removes flags and joined family sequences", () => {
    assert.equal(removeEmoji("🇸🇬 test 👨‍👩‍👧‍👦 代理"), " test  代理");
    assert.equal(removeEmoji("plain 123 中文"), "plain 123 中文");
});

test("tray icons reflect every TUN/mixin/proxy combination and custom/mode preferences", () => {
    const colors = ["normal", "reverse", "purple", "light_blue", "pink", "green", "brown", "orange"];
    for (let mask = 0; mask < 8; mask++) {
        assert.equal(getRendererTrayIcon({ path: path.posix, staticRoot: "/assets", isTun: !!(mask & 4), isMixin: !!(mask & 2), enabled: !!(mask & 1) }), `/assets/tray/win/tray_${colors[mask]}.ico`);
    }
    const deps = { path: path.posix, staticRoot: "/assets", clashPath: "/profile", enabled: true };
    assert.equal(getRendererTrayIcon({ ...deps, settings: { iconSystemProxy: "custom.ico" } }), "/profile/custom.ico");
    assert.equal(getRendererTrayIcon({ ...deps, settings: { iconSystemProxy: "/custom.ico" } }), "/custom.ico");
    assert.equal(getRendererTrayIcon({ ...deps, settings: { useModeIcons: true }, mode: "global" }), "/assets/tray/win/on_global.png");
    const assetRoot = path.join(__dirname, "../../main/dist/electron/static/tray/win");
    for (const name of [
        "tray_normal.ico", "tray_reverse.ico", "tray_purple.ico", "tray_light_blue.ico",
        "tray_pink.ico", "tray_green.ico", "tray_brown.ico", "tray_orange.ico",
        "on_global.png", "on_rule.png", "on_direct.png", "on_script.png",
        "off_global.png", "off_rule.png", "off_direct.png", "off_script.png"
    ]) assert.equal(require("node:fs").existsSync(path.join(assetRoot, name)), true, name);
});

test("auto launch uses only injected filesystem on Linux and native IPC elsewhere", async () => {
    const calls = [], files = new Map();
    const deps = { path: path.posix, ipcRenderer: { invoke: async (...args) => {
        calls.push(args);
        return args[1] === "getVersion" ? "1.0" : args[2] === "exe" ? "/app/cfw" : "/home/user";
    } }, fs: {
        existsSync: file => files.has(file), mkdirSync: file => files.set(file, "directory"),
        writeFileSync: (file, content) => files.set(file, content), unlinkSync: file => files.delete(file)
    } };
    const launch = createAutoLaunch({ ...deps, platform: "linux" });
    await launch(true);
    assert.match(files.get("/home/user/.config/autostart/cfw.desktop"), /Exec="\/app\/cfw"/);
    await launch(false);
    assert.equal(files.has("/home/user/.config/autostart/cfw.desktop"), false);
    for (const platform of ["win32", "darwin"]) {
        await createAutoLaunch({ ...deps, platform })(false);
        assert.deepEqual(calls.at(-1), ["app", "setLoginItemSettings", { openAtLogin: false }]);
    }
});

test("Vue capability plugin reads current settings and publishes proxy status only after success", async () => {
    const calls = [], commands = [];
    let success = true;
    const store = { state: { app: { settings: {}, clashPath: "/profile" } }, getters: { filesPath: "/files", mixedPort: 7890 }, commit: (...args) => calls.push(args) };
    const Vue = { prototype: {} };
    createRendererCapabilities({
        path, platform: "win32", staticRoot: "/static", modifyState: {},
        childProcess: { spawnSync: (...args) => { commands.push(args); return { status: success ? 0 : 1 }; } },
        status: { SYSTEM_PROXY: "on", DEFAULT: "off" }, logger: { info() {}, error() {} }
    }).install(Vue, { store });
    assert.equal(await Vue.prototype.$setSystemProxy(true), true);
    assert.deepEqual(calls.at(-1), ["CHANGE_STATUS", { status: "on" }]);
    const count = calls.length;
    success = false;
    assert.equal(await Vue.prototype.$setSystemProxy(false), false);
    assert.equal(calls.length, count);
    assert.ok(commands.length >= 2);
});
