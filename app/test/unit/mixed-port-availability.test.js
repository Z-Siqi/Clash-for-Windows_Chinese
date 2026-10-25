"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const dgram = require("node:dgram");
const { EventEmitter } = require("node:events");
const { randomInt } = require("node:crypto");
const { isMixedPortAvailable, mixedPortHost } = require("../../main/dist/electron/core/network/mixed-port-availability");

const available = (port, config = {}) => isMixedPortAvailable({ net, dgram, port, config });
async function freePort() {
    for (let attempt = 0; attempt < 100; attempt++) {
        const port = randomInt(20000, 60000);
        if (await available(port)) return port;
    }
    throw Error("No available test port");
}
const close = socket => new Promise(resolve => socket.close(resolve));

test("mixed-port scope preserves loopback, distinct addresses, brackets and custom hostname semantics", () => {
    for (const [config, expected] of [
        [{ "allow-lan": false, "bind-address": "[::]" }, "127.0.0.1"],
        [{ "allow-lan": true }, "::"],
        [{ "allow-lan": true, "bind-address": "0.0.0.0", ipv6: false }, "::"],
        [{ "allow-lan": true, "bind-address": "127.0.0.2" }, "127.0.0.2"],
        [{ "allow-lan": true, "bind-address": "[::1]" }, "::1"],
        [{ "allow-lan": true, "bind-address": "localhost" }, "127.0.0.1"],
        [{ "allow-lan": true, "bind-address": "custom-host" }, null],
        [{ "allow-lan": true, "bind-address": "::1" }, null]
    ]) assert.equal(mixedPortHost(config, net.isIP), expected);
});

test("mixed-port preflight rejects TCP and UDP collisions while preserving same-port different-IP users", async t => {
    for (const protocol of ["tcp", "udp"]) {
        const port = await freePort();
        const socket = protocol === "tcp" ? net.createServer() : dgram.createSocket("udp4");
        await new Promise((resolve, reject) => {
            socket.once("error", reject);
            if (protocol === "tcp") socket.listen(port, "127.0.0.2", resolve);
            else socket.bind(port, "127.0.0.2", resolve);
        });
        try {
            assert.equal(await available(port), true, `${protocol}: another local address must remain usable`);
            assert.equal(await available(port, { "allow-lan": true, "bind-address": "127.0.0.2" }), false);
            // Windows permits a dual-stack wildcard beside a specific IPv4
            // listener. Both packaged cores preserve that working arrangement.
            const wildcardAvailable = process.platform === "win32";
            assert.equal(await available(port, { "allow-lan": true, "bind-address": "*" }), wildcardAvailable, `${protocol} wildcard scope`);
            assert.equal(await available(port, { "allow-lan": true, "bind-address": "0.0.0.0", ipv6: false }), wildcardAvailable);
        } finally { await close(socket); }
        assert.equal(await available(port), true, "both temporary probes must be released");
    }
    assert.equal(await available(0), false);
    assert.equal(await available(12345, { "allow-lan": true, "bind-address": "custom-host" }), null);
});

test("IPv6 mixed-port probes cover UDP collisions on a bracketed loopback address", async t => {
    const socket = dgram.createSocket("udp6");
    try {
        await new Promise((resolve, reject) => { socket.once("error", reject); socket.bind(0, "::1", resolve); });
    } catch (error) {
        try { socket.close(); } catch {}
        if (["EAFNOSUPPORT", "EADDRNOTAVAIL", "EPROTONOSUPPORT"].includes(error.code)) return t.skip("IPv6 loopback is unavailable");
        throw error;
    }
    try { assert.equal(await available(socket.address().port, { "allow-lan": true, "bind-address": "[::1]" }), false); }
    finally { await close(socket); }
});

test("mixed-port preflight rejects actual wildcard collisions on both protocols", async t => {
    for (const protocol of ["tcp", "udp"]) {
        const socket = protocol === "tcp" ? net.createServer() : dgram.createSocket("udp6");
        try {
            await new Promise((resolve, reject) => {
                socket.once("error", reject);
                if (protocol === "tcp") socket.listen({ host: "::", port: 0, ipv6Only: false }, resolve);
                else socket.bind({ address: "::", port: 0 }, resolve);
            });
        } catch (error) {
            try { socket.close(); } catch {}
            if (["EAFNOSUPPORT", "EADDRNOTAVAIL", "EPROTONOSUPPORT"].includes(error.code)) return t.skip("IPv6 wildcard is unavailable");
            throw error;
        }
        try { assert.equal(await available(socket.address().port, { "allow-lan": true, "bind-address": "*" }), false, protocol); }
        finally { await close(socket); }
    }
});

test("wildcard fallback is limited to unsupported IPv6 and never hides collision or permission errors", async () => {
    for (const [code, permissionMayDiffer, expected, hosts] of [
        ["EAFNOSUPPORT", false, true, ["::", "0.0.0.0"]],
        ["EADDRINUSE", false, false, ["::"]],
        ["EACCES", false, false, ["::"]],
        ["EACCES", true, null, ["::"]],
        ["EADDRINUSE", true, false, ["::"]]
    ]) {
        const listened = [];
        const fakeNet = { isIP: net.isIP, createServer() {
            const socket = new EventEmitter();
            socket.listen = (options, callback) => {
                listened.push(options.host);
                queueMicrotask(() => options.host === "::" ? socket.emit("error", { code }) : callback());
            };
            socket.close = callback => callback();
            return socket;
        } };
        const fakeDgram = { createSocket() {
            const socket = new EventEmitter();
            socket.bind = (_options, callback) => queueMicrotask(callback);
            socket.close = callback => callback();
            return socket;
        } };
        assert.equal(await isMixedPortAvailable({ net: fakeNet, dgram: fakeDgram, port: 12345, config: { "allow-lan": true }, permissionMayDiffer }), expected);
        assert.deepEqual(listened, hosts);
    }
});
