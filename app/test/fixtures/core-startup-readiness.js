"use strict";

async function waitForInitialConfig({ request, child, mixedPort, now = Date.now, delay = () => new Promise(resolve => setTimeout(resolve, 20)), timeout = 12000 }) {
    const deadline = now() + timeout;
    while (now() < deadline) {
        if (child.exitCode !== null) throw new Error("Core exited before initial configuration was ready");
        try {
            const response = await request();
            const config = JSON.parse(response.data);
            if (response.status === 200 && config["mixed-port"] === mixedPort && config.mode === "direct") return;
        } catch (_) {}
        await delay();
    }
    throw new Error("Core initial configuration did not become ready");
}

module.exports = { waitForInitialConfig };
