"use strict";

function createMulticastRoutes({ childProcess, path, filesPath, logger }) {
    const script = path.join(filesPath, "win", "common", "tun2socks", "multicast_route.ps1");
    const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script];
    function execute(parameters, timeout = 3000) {
        return new Promise((resolve, reject) => childProcess.execFile("powershell.exe", [...args, ...parameters],
            { windowsHide: true, timeout, maxBuffer: 4096 }, (error, stdout = "") => {
                if (error) { error.routeOutput = String(stdout); reject(error); }
                else resolve(String(stdout));
            }));
    }
    function parse(output) {
        const lease = JSON.parse(output.trim());
        if (typeof lease.changed !== "boolean" || !Number.isInteger(lease.interfaceIndex) || lease.interfaceIndex < 1
            || ![lease.originalMetric, lease.appliedMetric].every(value => Number.isInteger(value) && value >= 0 && value <= 65535)) {
            throw Error("Invalid TAP multicast route lease");
        }
        return lease;
    }
    async function release(lease) {
        if (!lease?.changed) return;
        await execute(["-Action", "Release", "-InterfaceIndex", String(lease.interfaceIndex),
            "-OriginalMetric", String(lease.originalMetric), "-AppliedMetric", String(lease.appliedMetric)]);
    }
    return {
        async acquire(timeout = 3000) {
            try { return parse(await execute(["-Action", "Acquire"], timeout)); }
            catch (error) {
                let retained = null;
                if (error.routeOutput) {
                    try {
                        const lease = parse(error.routeOutput);
                        try { await release(lease); }
                        catch (_restoreError) {
                            retained = lease;
                            logger.warn?.("Could not restore TAP multicast route after preparation failed");
                        }
                    } catch (_invalidLease) {}
                }
                // Packet filtering still prevents loops without elevation. Route
                // bypass is best effort, so existing non-admin TAP use can start.
                logger.warn?.("TAP multicast route bypass is unavailable; packet filtering remains enabled");
                // Keep a partial mutation owned if compensation failed, so
                // cancellation/process cleanup can retry instead of losing it.
                return retained;
            }
        },
        release
    };
}

module.exports = { createMulticastRoutes };
