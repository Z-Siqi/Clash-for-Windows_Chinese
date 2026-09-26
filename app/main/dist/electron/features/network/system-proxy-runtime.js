"use strict";

function createSystemProxyRuntime({
    platform,
    childProcess,
    path,
    filesPath,
    clashPath,
    runMacCommand,
    parseBypass,
    defaultBypass = [],
    logger = console
}) {
    const defaultHost = "127.0.0.1";

    async function set({ enabled, settings = {}, mixedPort, innerServerPort }) {
        logger.info("set system proxy to", enabled);
        if (!mixedPort) return false;

        let bypass = defaultBypass;
        if (settings.bypassText) {
            try {
                const parsed = parseBypass(settings.bypassText);
                bypass = parsed.bypass || [];
            } catch (_error) {
                bypass = [];
            }
        }
        const host = settings.staticSystemProxyHost || defaultHost;

        try {
            if (platform === "darwin") {
                const proxyArgs = enabled
                    ? ["-http", `${host}:${mixedPort}`, "-https", `${host}:${mixedPort}`, "-socks", `${host}:${mixedPort}`]
                    : ["-stop"];
                const proxyResult = await runMacCommand(proxyArgs);
                if (!proxyResult.success) return false;
                const bypassResult = await runMacCommand(["-bypass", bypass.join(",")]);
                return Boolean(bypassResult.success);
            }

            if (platform === "win32") {
                const type = settings.systemProxyTypeIndex || 0;
                const args = ["set", "1"];
                if (enabled && type === 0) {
                    const address = `${host}:${mixedPort}`;
                    const proxy = settings.specifyHttpProxyProtocol
                        ? `http=http://${address};https=http://${address}`
                        : address;
                    args.splice(0, args.length, "global", proxy, bypass.join(";"));
                } else if (enabled && type === 1) {
                    args.splice(0, args.length, "pac", `http://${host}:${innerServerPort}/pac?t=${Date.now()}`);
                }
                const result = childProcess.spawnSync("sysproxy.exe", args, {
                    cwd: path.join(filesPath, "win", "common"),
                    windowsHide: true
                });
                return result.status === 0;
            }
        } catch (error) {
            logger.error(error.stack || error);
        }
        return false;
    }

    function getStatus() {
        if (platform === "darwin") {
            const result = childProcess.spawnSync("./sysproxy", ["-show"], {
                cwd: clashPath,
                windowsHide: true
            });
            if (result.error) return false;
            return Boolean(result.output && /socks=/.test(result.output.toString()));
        }
        if (platform === "win32") {
            const result = childProcess.spawnSync("sysproxy.exe", ["query"], {
                cwd: path.join(filesPath, "win", "common"),
                windowsHide: true
            });
            if (result.error || result.status !== 0 || !result.stdout) return false;
            return result.stdout[0] === 51 || result.stdout[0] === 53;
        }
        return false;
    }

    return { set, getStatus };
}

module.exports = { createSystemProxyRuntime };
