"use strict";

function createTunRuntime({
    childProcess,
    sudoExec,
    path,
    platform,
    arch,
    filesPath,
    tapInfo = {},
    logger = console,
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
}) {
    const normalizedTapInfo = tapInfo || {};
    const ip = normalizedTapInfo.ip || "10.0.0.1";
    const subnet = normalizedTapInfo.subnet || "255.255.255.0";
    const gateway = normalizedTapInfo.gateway || "10.0.0.0";

    function sudoRun(command, callback = null) {
        return new Promise(resolve => {
            if (!isAdministrator()) {
                sudoExec(command, { name: "Clash for Windows" }, error => {
                    if (callback) callback(error === undefined || error === null);
                    resolve(error === undefined || error === null);
                });
                return;
            }
            childProcess.exec(command, { windowsHide: true }, error => {
                if (callback) callback(error === undefined || error === null);
                resolve(error === undefined || error === null);
            });
        });
    }

    function isAdministrator() {
        try {
            childProcess.execSync("net session", { windowsHide: true });
            return true;
        } catch (_error) {
            return false;
        }
    }

    function setupTapDevice(install = true) {
        const folder = path.join(filesPath, "win", "common", "tun2socks");
        const tapArch = { x64: "amd64", ia32: "i386", arm64: "i386" }[arch];
        const script = path.join(folder, `${install ? "add" : "remove"}_tap_device.bat`);
        return sudoRun(`"${script}" ${tapArch} ${ip} ${subnet} ${gateway}`);
    }

    async function spawnTun2socks({ currentProcess, mixedPort }) {
        if (platform === "darwin" || platform === "linux") return currentProcess;
        logger.info("Spawn go-tun2socks");
        if (currentProcess) killSpawned(currentProcess);
        if (!mixedPort) return null;

        const args = [
            "-tunName", "cfw-tap",
            "-tunDns", ip,
            "-tunAddr", ip,
            "-tunMask", subnet,
            "-tunGw", gateway,
            "-proxyServer", `127.0.0.1:${mixedPort}`,
            "-loglevel", "none"
        ];
        const binaryFolder = path.join(
            filesPath,
            "win",
            { x64: "x64", ia32: "ia32", arm64: "ia32" }[arch]
        );
        const processHandle = childProcess.spawn("go-tun2socks.exe", args, {
            cwd: binaryFolder,
            windowsHide: true
        });

        for (let remaining = 10; remaining > 0; remaining -= 1) {
            try {
                const routes = childProcess.execSync(
                    `route print ${gateway} mask ${subnet}`,
                    { windowsHide: true }
                ).toString();
                const escapeDots = value => value.replace(/\./g, "\\.");
                const routePattern = new RegExp(
                    `${escapeDots(gateway)}\\s+?${escapeDots(subnet)}[\\s\\S]+${escapeDots(ip)}`
                );
                if (routePattern.test(routes)) {
                    childProcess.execSync(
                        `route add 0.0.0.0 mask 0.0.0.0 ${gateway} metric 1`,
                        { windowsHide: true }
                    );
                    break;
                }
            } catch (_error) {}
            await sleep(1000);
        }
        return processHandle;
    }

    function killSpawned(processHandle) {
        const pid = processHandle && processHandle.pid;
        if (!pid) return;
        try {
            const command = platform === "darwin" || platform === "linux"
                ? `kill -9 ${pid}`
                : `taskkill /F /PID ${pid}`;
            childProcess.execSync(command, { windowsHide: true });
        } catch (_error) {}
    }

    function setRoutes() {
        const script = path.join(filesPath, "tun2socks", "set_routes.bat");
        return sudoRun(`"${script}"`);
    }

    return { sudoRun, setupTapDevice, spawnTun2socks, killSpawned, setRoutes };
}

module.exports = { createTunRuntime };
