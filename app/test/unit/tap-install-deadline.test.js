"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const Vue = require("../../main/node_modules/vue");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { createTapViews } = require("../../main/dist/electron/features/clash-core/tap-management-view");
const { createTunRuntime } = require("../../main/dist/electron/features/tun/tun-runtime");

test("TAP dialog blocks Close, Escape and backdrop dismissal throughout native and runtime work", () => {
    const { TapManagementView } = createTapViews({ defineComponent, EscCapture: {}, Hint: {}, getLanguage: () => createTranslator(1) });
    const vm = new (Vue.extend(TapManagementView))({ propsData: { busy: true } });
    let closed = 0; vm.$on("close", () => closed++);
    const tree = vm.$options.render.call(vm);
    const nodes = [];
    function visit(node) { if (!node) return; nodes.push(node); for (const child of node.children || node.componentOptions?.children || []) visit(child); }
    visit(tree);
    tree.componentOptions.listeners.esc(); tree.componentOptions.listeners.mousedown();
    const footer = nodes.find(node => node.tag === "footer");
    assert.equal(footer.children[0].data.attrs.disabled, true);
    footer.children[0].data.on.click(); assert.equal(closed, 0);
    assert.equal(nodes.find(node => node.tag === "section").data.attrs["aria-busy"], "true");
    vm.busy = false;
    vm.$options.render.call(vm).componentOptions.listeners.esc(); assert.equal(closed, 1);
    vm.$destroy();
});

test("route readiness has one ten-second budget and failure cleans up instead of reporting success", async () => {
    let time = 0; const calls = [];
    const runtime = createTunRuntime({ path, platform: "win32", arch: "x64", filesPath: "packaged", logger: { info() {} },
        now: () => time, sleep: async milliseconds => { time += milliseconds; }, childProcess: {
            spawn: () => ({ pid: 42 }), execFile(file, args, options, callback) {
                calls.push([file, args]);
                if (file === "route") { time += options.timeout; callback(Error("stalled")); }
                else callback(null, "");
            }
        } });
    await assert.rejects(runtime.spawnTun2socks({ mixedPort: 7890 }), /within 10 seconds/);
    assert.equal(time, 10000);
    assert.deepEqual(calls.at(-1), ["taskkill", ["/F", "/PID", "42"]]);
    assert.equal(calls.some(([file, args]) => file === "route" && args[0] === "add"), false);
});

test("post-install configuration is bounded separately from UAC and the installer on both Windows packages", () => {
    const roots = ["win_x64", "win32-arm64"].map(target => path.resolve(__dirname, "../../clash_core", target, "static/files/win/common/tun2socks"));
    const scripts = roots.map(root => fs.readFileSync(path.join(root, "add_tap_device.bat"), "utf8"));
    const workers = roots.map(root => fs.readFileSync(path.join(root, "configure_tap_device.ps1"), "utf8"));
    assert.equal(scripts[0], scripts[1]); assert.equal(workers[0], workers[1]);
    assert.match(scripts[0], /start "" \/wait/);
    assert.doesNotMatch(scripts[0], /^netsh |^".*tapinstall\.exe"/m);
    assert.doesNotMatch(scripts[0], /waitfor|wait_for_device/);
    assert.match(workers[0], /WaitForExit\(8000\)/);
    assert.match(workers[0], /WaitForExit\(500\)/);
    assert.match(workers[0], /CFW_TAP_SETUP_TIMEOUT/);
    assert.match(workers[0], /CreateNoWindow = \$true/);
});

test("a timed-out configuration is reported as a setup error rather than ordinary UAC cancellation", async () => {
    const runtime = createTunRuntime({ path, platform: "win32", arch: "x64", filesPath: "packaged", readTapState: async () => ({ exists: false, configured: false }), childProcess: {
        execFile(_file, _args, _options, callback) { callback(null, "admin"); },
        exec(_command, _options, callback) { callback(Error("exit 10"), "CFW_TAP_SETUP_TIMEOUT"); }
    } });
    await assert.rejects(runtime.setupTapDevice(true), /not complete after the setup deadline/);
});

test("a TAP spawn error during route discovery cannot add a default route or crash the main event loop", async () => {
    const process = new EventEmitter(), calls = [];
    const runtime = createTunRuntime({ path, platform: "win32", arch: "x64", filesPath: "packaged", logger: { info() {} }, childProcess: {
        spawn: () => process,
        execFile(file, args, _options, callback) {
            calls.push([file, ...args]);
            process.emit("error", Error("binary missing"));
            callback(null, "10.0.0.0 255.255.255.0 10.0.0.1");
        }
    } });
    await assert.rejects(runtime.spawnTun2socks({ mixedPort: 7890 }), /binary missing/);
    assert.equal(calls.some(call => call[1] === "add"), false);
});
