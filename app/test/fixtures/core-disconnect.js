"use strict";
const net = require("node:net");
const assert = require("node:assert/strict");
const { prepareDisconnectCleanup } = require("../../main/dist/electron/features/connections/disconnect-cleanup");

async function until(check, description = "loopback connection state") {
    // The controller and mixed listener can be ready before Mihomo publishes a
    // newly established tunnel on a loaded Windows runner. Keep this bounded,
    // but allow the same startup window used by the core integration harness.
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
        if (await check()) return;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error(`Timed out waiting for ${description}`);
}

async function verifyDisconnect(api, proxyPort) {
    const sockets = [];
    const server = net.createServer(socket => {
        sockets.push(socket);
        socket.on("error", () => {});
        socket.on("data", data => socket.write(data));
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    async function connect() {
        let socket;
        // The controller can respond before the mixed-port is listening.
        await until(async () => {
            socket = net.connect(proxyPort, "127.0.0.1");
            sockets.push(socket);
            socket.on("error", () => {});
            return new Promise((resolve, reject) => {
                socket.once("connect", () => resolve(true));
                socket.once("error", error => error.code === "ECONNREFUSED" ? resolve(false) : reject(error));
            });
        }, `mixed-port ${proxyPort} listener`).catch(async error => {
            const config = await api.getConfig();
            throw new Error(`${error.message}: expected mixed-port ${proxyPort}, configured ${config.data["mixed-port"]}`);
        });
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(Error("CONNECT timeout")), 3000);
            let header = "";
            const read = chunk => {
                header += chunk;
                if (!header.includes("\r\n\r\n")) return;
                clearTimeout(timer); socket.off("data", read);
                if (/^HTTP\/1\.[01] 200/.test(header)) resolve();
                else reject(Error("Loopback CONNECT rejected"));
            };
            socket.on("data", read);
            socket.write(`CONNECT 127.0.0.1:${server.address().port} HTTP/1.1\r\nHost: 127.0.0.1:${server.address().port}\r\n\r\n`);
        });
        // Cores can respond with null until the new tunnel is registered.
        await until(
            async () => ((await api.getConnections()).data.connections || []).some(c => Number(c.metadata.sourcePort) === socket.localPort),
            "core connection registration"
        );
        return socket;
    }
    try {
        const old = await connect();
        const finish = await prepareDisconnectCleanup({ api, settings: {}, disconnecting: true, onError: () => assert.fail("Core connection cleanup failed") });
        const newer = await connect();
        await finish(true);
        await until(() => old.destroyed, "old connection cleanup");
        assert.equal(newer.destroyed, false);
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(Error("New connection stopped forwarding")), 3000);
            newer.once("data", data => { clearTimeout(timer); try { assert.equal(data.toString(), "still-alive"); resolve(); } catch (e) { reject(e); } });
            newer.write("still-alive");
        });
        const remaining = (await api.getConnections()).data.connections;
        assert.equal(remaining.some(c => Number(c.metadata.sourcePort) === newer.localPort), true);
    } finally {
        for (const socket of sockets) socket.destroy();
        await new Promise(resolve => server.close(resolve));
    }
}

module.exports = { verifyDisconnect };
