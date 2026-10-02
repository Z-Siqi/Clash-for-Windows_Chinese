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
    host.server.emit("message", { chaddr: "mac", options: { 12: "name", 61: "client", 99: "secret" }, private: "packet" });
    assert.deepEqual(host.events.at(-1), ["dhcp-event", { type: "message", value: { chaddr: "mac", options: { 12: "name", 61: "client" } } }]);
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
