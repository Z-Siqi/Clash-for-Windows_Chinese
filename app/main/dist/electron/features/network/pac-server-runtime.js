"use strict";

const { parsePort } = require("../../core/network/tcp-port");
const { pacPortPolicy } = require("../../core/network/pac-port-policy");

function createPacServerRuntime({ Koa, getPort, defaultPac }) {
    let server;
    let status;
    return {
        getStatus: () => status && { ...status },
        async start({ getSettings, getMixedPort }) {
            if (server) await new Promise(resolve => server.close(resolve));
            const settings = getSettings();
            const policy = pacPortPolicy(settings.innerServerPort);
            const port = policy.port || await getPort({ host: "127.0.0.1" });
            const application = new Koa();
            application.use(context => {
                if (!/\/pac$/.test(context.path)) { context.status = 404; return; }
                const mixedPort = parsePort(getMixedPort());
                if (!mixedPort) return;
                context.set("content-type", "application/x-ns-proxy-autoconfig");
                context.body = (getSettings().pacContentText || defaultPac).replace(/%mixed-port%/g, mixedPort);
            });
            await new Promise((resolve, reject) => {
                server = application.listen(port, "127.0.0.1", resolve);
                server.once("error", reject);
            });
            status = { port, invalidConfiguredPort: policy.invalid };
            return port;
        },
        stop() { server?.close(); server = null; status = undefined; }
    };
}

module.exports = { createPacServerRuntime };
