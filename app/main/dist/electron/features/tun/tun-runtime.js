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
    if (![ip, subnet, gateway].every(require("net").isIPv4)) throw new Error("TAP addresses must be IPv4 literals");

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
            childProcess.execFileSync("net", ["session"], { windowsHide: true });
            return true;
        } catch (_error) {
            return false;
        }
    }

    function setupTapDevice(install = true) {
        const folder = path.join(filesPath, "win", "common", "tun2socks");
        const tapArch = { x64: "amd64", arm64: "i386" }[arch];
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
            { x64: "x64", arm64: "arm64" }[arch]
        );
        const processHandle = childProcess.spawn(path.join(binaryFolder, "go-tun2socks.exe"), args, {
            cwd: binaryFolder,
            windowsHide: true,
            shell: false
        });

        for (let remaining = 10; remaining > 0; remaining -= 1) {
            try {
                const routes = childProcess.execFileSync(
                    "route", ["print", gateway, "mask", subnet],
                    { windowsHide: true }
                ).toString();
                const routeExists = routes.split(/\r?\n/).some(line => {
                    const fields = line.trim().split(/\s+/);
                    return fields[0] === gateway && fields[1] === subnet && fields.slice(2).includes(ip);
                });
                if (routeExists) {
                    childProcess.execFileSync(
                        "route", ["add", "0.0.0.0", "mask", "0.0.0.0", gateway, "metric", "1"],
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
        if (!Number.isSafeInteger(pid) || pid <= 0) return;
        try {
            if (platform === "win32") childProcess.execFileSync("taskkill", ["/F", "/PID", String(pid)], { windowsHide: true });
            else processHandle.kill("SIGKILL");
        } catch (_error) {}
    }

    function setRoutes() {
        const script = path.join(filesPath, "tun2socks", "set_routes.bat");
        return sudoRun(`"${script}"`);
    }

    return { sudoRun, setupTapDevice, spawnTun2socks, killSpawned, setRoutes };
}

module.exports = { createTunRuntime };
