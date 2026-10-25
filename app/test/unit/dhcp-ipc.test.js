"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { isIPv4 } = require("node:net");
const { registerDhcpIpc } = require("../../main/dist/electron/features/router/register-dhcp-ipc");

function harness(t) {
    const app = new EventEmitter();
    const events = [], calls = [];
    const owner = Object.assign(new EventEmitter(), { mainFrame: {}, isDestroyed: () => false, send: (...args) => events.push(args) });
    const server = Object.assign(new EventEmitter(), { listen(port) { calls.push(["listen", port]); queueMicrotask(() => server.emit("listening")); }, close() { calls.push(["close"]); } });
    let handler, options;
    registerDhcpIpc({
        ipcMain: { handle(channel, callback) { assert.equal(channel, "dhcp"); handler = callback; } },
        app, getMainWindow: () => ({ webContents: owner }), isIPv4,
        networkInterfaces: () => ({ fixture: [{ address: "10.0.0.2", internal: false }] }),
        powerSaveBlocker: { start(type) { calls.push(["block", type]); return 42; }, stop(id) { calls.push(["unblock", id]); } },
        dhcp: { createServer(config) { options = config; return server; } }
    });
    t.after(() => app.emit("before-quit"));
    const event = { sender: owner, senderFrame: owner.mainFrame };
    const config = { localAddress: "10.0.0.2", rangeFrom: "10.0.0.100", rangeTo: "10.0.0.200", netmask: "255.255.255.0", defaultRouter: "10.0.0.1", broadAddress: "10.0.0.255", primaryDns: "8.8.8.8", secondlyDns: "1.1.1.1" };
    return { app, owner, server, handler, event, config, calls, events, get options() { return options; } };
}

test("DHCP host rejects foreign frames, unavailable interfaces and invalid subnets before creating a socket", async t => {
    const host = harness(t);
    await assert.rejects(host.handler({ ...host.event, senderFrame: {} }, "start", { config: host.config }), /Unauthorized/);
    for (const override of [{ localAddress: "10.0.0.3" }, { netmask: "255.0.255.0" }, { rangeFrom: "10.0.0.1" }, { rangeTo: "10.0.1.2" }, { broadAddress: "10.0.0.254" }, { primaryDns: "invalid" }]) {
        await assert.rejects(host.handler(host.event, "start", { config: { ...host.config, ...override } }));
    }
    assert.equal(host.options, undefined);
});

test("DHCP main owner fixes broadcast and port, updates policy and strips packet data before IPC", async t => {
    const host = harness(t);
    await host.handler(host.event, "start", { config: host.config, hijackAddresses: ["client"], hijackDns: ["10.0.0.53"] });
    assert.equal(host.options.broadcast, "10.0.0.255");
    assert.deepEqual(host.calls[0], ["listen", 67]);
    assert.deepEqual(host.options.router({ clientId: "client" }), ["10.0.0.2"]);
    assert.deepEqual(host.options.dns({ clientId: "client" }), ["10.0.0.53"]);
    assert.deepEqual(host.options.router({ chaddr: "mac", options: { 61: "client" } }), ["10.0.0.2"]);
    assert.deepEqual(host.options.dns({ chaddr: "mac", options: { 61: "client" } }), ["10.0.0.53"]);
    await host.handler(host.event, "policy", { hijackAddresses: [], hijackDns: [] });
    assert.deepEqual(host.options.router({ clientId: "client" }), ["10.0.0.1"]);
    await host.handler(host.event, "policy", { hijackAddresses: ["mac"], hijackDns: [] });
    assert.deepEqual(host.options.router({ chaddr: "mac", options: {} }), ["10.0.0.2"]);
    assert.deepEqual(host.options.router({ chaddr: "mac", options: { 61: "different-client" } }), ["10.0.0.1"]);
    host.server.emit("message", { chaddr: "mac", options: { 12: "name", 61: "client", 99: "secret" }, private: "packet" });
    assert.deepEqual(host.events.at(-1), ["dhcp-event", { type: "message", value: { chaddr: "mac", options: { 12: "name", 61: "client" }, policyIdentity: { kind: "raw", value: "client" } } }]);
    host.server.emit("bound", { [`client-id:${Buffer.from("client").toString("base64url")}`]: { address: "10.0.0.101" } });
    assert.deepEqual(host.events.at(-1)[1].value, { mac: { address: "10.0.0.101" } });
    await host.handler(host.event, "stop");
    assert.ok(host.calls.some(item => item[0] === "unblock" && item[1] === 42));
    assert.equal(host.calls.filter(item => item[0] === "close").length, 1);
});

test("DHCP startup handles bind failures and navigation releases only owned resources", async t => {
    const host = harness(t);
    host.server.listen = () => { throw new Error("native bind failure"); };
    await assert.rejects(host.handler(host.event, "start", { config: host.config }), /cancelled/);
    assert.equal(host.calls.filter(item => item[0] === "close").length, 1);
    host.server.listen = () => queueMicrotask(() => host.server.emit("listening"));
    await host.handler(host.event, "start", { config: host.config });
    host.owner.emit("did-start-loading");
    assert.equal(host.calls.filter(item => item[0] === "unblock").length, 1);
});

test("DHCP long identities match complete values in a separate namespace without changing raw identity precedence", async t => {
    const host = harness(t);
    await host.handler(host.event, "start", { config: host.config });
    const prefix = "x".repeat(128), one = prefix + "one", two = prefix + "two";
    const packet = value => ({ chaddr: "long-client", options: { 61: value } });
    host.server.emit("message", packet(one));
    const first = host.events.at(-1)[1].value;
    assert.equal(first.options[61], prefix);
    assert.equal(first.policyIdentity.kind, "sha256");
    assert.match(first.policyIdentity.value, /^[a-f0-9]{64}$/);
    const count = host.events.length;
    host.server.emit("message", packet(one));
    assert.equal(host.events.length, count, "unchanged packets do not flood the UI");
    host.server.emit("message", packet(two));
    assert.notEqual(host.events.at(-1)[1].value.policyIdentity.value, first.policyIdentity.value, "full identity changes survive identical display prefixes");
    await host.handler(host.event, "policy", { hijackAddresses: [prefix], hijackIdentityTokens: [first.policyIdentity.value], hijackDns: ["10.0.0.53"] });
    assert.deepEqual(host.options.router(packet(one)), ["10.0.0.2"]);
    assert.deepEqual(host.options.dns(packet(one)), ["10.0.0.53"]);
    assert.deepEqual(host.options.router(packet(two)), ["10.0.0.1"]);
    assert.deepEqual(host.options.router(packet(first.policyIdentity.value)), ["10.0.0.1"], "a raw ID equal to a digest must not inherit its policy");
    assert.deepEqual(host.options.router(packet(prefix)), ["10.0.0.2"], "existing short raw selections remain intact");
    await host.handler(host.event, "policy", { hijackAddresses: [first.policyIdentity.value], hijackIdentityTokens: [] });
    assert.deepEqual(host.options.router(packet(one)), ["10.0.0.1"]);
    assert.deepEqual(host.options.router(packet(first.policyIdentity.value)), ["10.0.0.2"]);
    host.server.emit("message", { chaddr: "fallback-client", clientId: "fallback-id", options: {} });
    assert.deepEqual(host.events.at(-1)[1].value.policyIdentity, { kind: "raw", value: "fallback-id" });
    const restarted = harness(t);
    await restarted.handler(restarted.event, "start", { config: restarted.config });
    restarted.server.emit("message", packet(one));
    assert.deepEqual(restarted.events.at(-1)[1].value.policyIdentity, first.policyIdentity, "long selections survive service restart");
});

test("DHCP token IPC preserves validation and a combined selection budget", async t => {
    const host = harness(t), token = "a".repeat(64);
    for (const tokens of ["bad", [null], ["A".repeat(64)], ["a".repeat(63)], Array(2049).fill(token)]) {
        await assert.rejects(host.handler(host.event, "policy", { hijackIdentityTokens: tokens }), /Invalid DHCP policy/);
    }
    await assert.rejects(host.handler(host.event, "policy", { hijackAddresses: Array.from({ length: 2048 }, (_value, index) => `client-${index}`), hijackIdentityTokens: [token] }), /Invalid DHCP policy/);
    await assert.rejects(host.handler({ ...host.event, senderFrame: {} }, "policy", { hijackIdentityTokens: [token] }), /Unauthorized/);
});

test("DHCP identity churn keeps current and recent lease owners while bounding history without exposing encoded keys", async t => {
    const host = harness(t);
    await host.handler(host.event, "start", { config: host.config });
    const key = value => `client-id:${Buffer.from(value).toString("base64url")}`;
    host.server.emit("message", { chaddr: "stable-mac", options: { 61: "stable" } });
    host.server.emit("message", { chaddr: "changing-mac", options: { 61: "old" } });
    for (let index = 0; index < 4100; index++) host.server.emit("message", { chaddr: "changing-mac", options: { 61: `change-${index}` } });
    host.server.emit("bound", { [key("old")]: { address: "10.0.0.101" }, [key("stable")]: { address: "10.0.0.102" }, [key("change-4099")]: { address: "10.0.0.103" } });
    assert.deepEqual(host.events.at(-1)[1].value, { "stable-mac": { address: "10.0.0.102" }, "changing-mac": { address: "10.0.0.103" } });
});

test("DHCP bound snapshots aggregate old/new identities for one MAC and prioritize the current lease in either order", async t => {
    const host = harness(t);
    await host.handler(host.event, "start", { config: host.config });
    const key = value => `client-id:${Buffer.from(value).toString("base64url")}`;
    host.server.emit("message", { chaddr: "same-mac", options: { 61: "first-id" } });
    host.server.emit("message", { chaddr: "same-mac", options: { 61: "second-id" } });
    const entries = [[key("first-id"), { address: "10.0.0.101" }], [key("second-id"), { address: "10.0.0.102" }]];
    for (const snapshot of [entries, [...entries].reverse()]) {
        assert.doesNotThrow(() => host.server.emit("bound", Object.fromEntries(snapshot)));
        assert.deepEqual(host.events.at(-1)[1].value, { "same-mac": { address: "10.0.0.102" } });
    }
    host.server.emit("message", { chaddr: "new-mac", options: { 61: "second-id" } });
    host.server.emit("bound", { [key("second-id")]: { address: "10.0.0.103" } });
    assert.deepEqual(host.events.at(-1)[1].value, { "new-mac": { address: "10.0.0.103" } }, "a moved client ID belongs to its latest MAC");
});

test("DHCP routing options work with the pinned package using an injected socket and no real DHCP traffic", async t => {
    const { Server } = require("../../main/node_modules/dhcp");
    const app = new EventEmitter(), owner = Object.assign(new EventEmitter(), { mainFrame: {}, isDestroyed: () => false, send() {} });
    let handler, server;
    registerDhcpIpc({
        ipcMain: { handle(_channel, callback) { handler = callback; } }, app,
        getMainWindow: () => ({ webContents: owner }), isIPv4,
        networkInterfaces: () => ({ fixture: [{ address: "10.0.0.2", internal: false }] }),
        powerSaveBlocker: { start: () => 1, stop() {} },
        dhcp: { createServer(config) {
            server = new Server(config, false, new EventEmitter());
            server.listen = port => { assert.equal(port, 67); queueMicrotask(() => server.emit("listening")); };
            server.close = () => {};
            return server;
        } }
    });
    t.after(() => app.emit("before-quit"));
    await handler({ sender: owner, senderFrame: owner.mainFrame }, "start", {
        config: { localAddress: "10.0.0.2", rangeFrom: "10.0.0.100", rangeTo: "10.0.0.200", netmask: "255.255.255.0", defaultRouter: "10.0.0.1", broadAddress: "10.0.0.255", primaryDns: "8.8.8.8", secondlyDns: "" },
        hijackAddresses: ["client"], hijackDns: ["10.0.0.53"]
    });
    const packet = { chaddr: "00-11-22-33-44-55", giaddr: "0.0.0.0", ciaddr: "0.0.0.0", yiaddr: "0.0.0.0", options: { 61: "client" } };
    const response = server.getOptions({ 53: 2 }, [1, 3, 6, 54], [], packet);
    assert.deepEqual(response[3], ["10.0.0.2"]);
    assert.deepEqual(response[6], ["10.0.0.53"]);
});
