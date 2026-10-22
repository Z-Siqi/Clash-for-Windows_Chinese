"use strict";

const { execFileAsync } = require("../../core/process/commands");
const { tapRouteState } = require("./tap-route-state");

function createTunRuntime({
    childProcess,
    sudoExec,
    path,
    platform,
    arch,
    filesPath,
    tapInfo = {},
    logger = console,
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    now = Date.now,
    readTapState
}) {
    const normalizedTapInfo = tapInfo || {};
    const ip = normalizedTapInfo.ip || "10.0.0.1";
    const subnet = normalizedTapInfo.subnet || "255.255.255.0";
    const gateway = normalizedTapInfo.gateway || "10.0.0.0";
    if (![ip, subnet, gateway].every(require("net").isIPv4)) throw new Error("TAP addresses must be IPv4 literals");
    const queryTapState = readTapState || (async (timeout = 5000) => {
        const script = path.join(filesPath, "win", "common", "tun2socks", "get_tap_state.ps1");
        const output = await execFileAsync(childProcess, "powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script,
            "-IP", ip, "-Subnet", subnet, "-Gateway", gateway], { timeout });
        const state = JSON.parse(output.toString().trim());
        if (!state || typeof state.configured !== "boolean" || typeof state.exists !== "boolean") throw Error("Invalid TAP adapter state");
        return state;
    });

    async function sudoRun(command, callback = null) {
        const administrator = await isAdministrator();
        return new Promise((resolve, reject) => {
            const complete = (error, stdout, stderr) => {
                if (/CFW_TAP_SETUP_TIMEOUT/.test(`${stdout || ""}\n${stderr || ""}`)) {
                    reject(new Error("TAP adapter configuration is not complete after the setup deadline. Retry once Windows has finished initializing the adapter."));
                    return;
                }
                if (callback) callback(error === undefined || error === null);
                resolve(error === undefined || error === null);
            };
            if (!administrator) {
                sudoExec(command, { name: "Clash for Windows" }, complete);
                return;
            }
            childProcess.exec(command, { windowsHide: true }, complete);
        });
    }

    async function isAdministrator() {
        try {
            await execFileAsync(childProcess, "net", ["session"]);
            return true;
        } catch (_error) {
            return false;
        }
    }

    async function setupTapDevice(install = true) {
        if (platform !== "win32") return false;
        // Packaged TAP kernel drivers are x86/x64 only; user-mode emulation
        // cannot make the i386 driver work on Windows ARM64.
        if (arch !== "x64") throw new Error("The packaged TAP driver is unavailable for this architecture; use native TUN Mode");
        const folder = path.join(filesPath, "win", "common", "tun2socks");
        const tapArch = "amd64";
        const script = path.join(folder, `${install ? "add" : "remove"}_tap_device.bat`);
        if (!install) return sudoRun(`"${script}" ${tapArch} ${ip} ${subnet} ${gateway}`);
        // The wizard's exit code and a supervisor deadline are observations,
        // not the result: PnP/configuration may have completed before they exit.
        const before = await queryTapState();
        if (before.configured) return true;
        // Adapter queries inside a batch file have no Node timeout and can
        // stall after PnP removal. Select repair here using the bounded reader.
        const configureOnly = before.exists ? " configure" : "";
        let succeeded, commandError;
        try { succeeded = await sudoRun(`"${script}" ${tapArch} ${ip} ${subnet} ${gateway}${configureOnly}`); }
        catch (error) { commandError = error; }
        const actual = await queryTapState();
        if (actual.configured) return true;
        if (actual.exists) throw Error("TAP is installed, but its address, mask, gateway or DNS configuration is incomplete. Retry TAP setup; the driver does not need to be installed again.");
        if (commandError) throw commandError;
        if (succeeded) throw Error("The TAP installer exited, but the configured cfw-tap adapter was not found.");
        return false;
    }

    async function spawnTun2socks({ currentProcess, mixedPort, isCurrent = () => true, onSpawn = () => {} }) {
        if (platform === "darwin" || platform === "linux") return currentProcess;
        if (!isCurrent()) return currentProcess;
        logger.info("Spawn go-tun2socks");
        if (currentProcess) await killSpawned(currentProcess);
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
        onSpawn(processHandle);
        let processError;
        processHandle.once?.("error", error => { processError = error; });
        processHandle.once?.("exit", (code, signal) => { processError = Error(`go-tun2socks exited before TAP was ready (code ${code}, signal ${signal || "none"}).`); });

        // PnP can take longer than two seconds. Observe active routes within
        // one bounded budget, without treating a duplicate ADD as failure.
        const deadline = now() + 10000;
        let ready = false;
        let lastError;
        for (; now() < deadline;) {
            // A profile switch may supersede startup while the adapter route is pending.
            if (!isCurrent()) { await killSpawned(processHandle); return null; }
            if (processError) break;
            try {
                const routes = (await execFileAsync(childProcess,
                    "route", ["print", "-4"],
                    { timeout: Math.max(1, Math.min(1000, deadline - now())) }
                )).toString();
                if (processError) break;
                if (!isCurrent()) { await killSpawned(processHandle); return null; }
                const state = tapRouteState(routes, { ip, subnet, gateway });
                if (state.defaultRoute) { ready = true; break; }
                if (state.connected) {
                    const adapter = await queryTapState(Math.max(1, deadline - now()));
                    if (!isCurrent()) { await killSpawned(processHandle); return null; }
                    if (processError) break;
                    if (!Number.isInteger(adapter.interfaceIndex) || adapter.interfaceIndex < 1) throw Error("TAP interface index is unavailable");
                    if (now() >= deadline) break;
                    await execFileAsync(childProcess,
                        "route", ["add", "0.0.0.0", "mask", "0.0.0.0", gateway, "metric", "1", "if", String(adapter.interfaceIndex)],
                        { timeout: Math.max(1, Math.min(1000, deadline - now())) }
                    );
                    // Re-read after ADD, including when another owner/PnP has
                    // installed the same route and ADD reports "already exists".
                }
            } catch (error) { lastError = error; }
            if (now() < deadline) await sleep(Math.min(250, deadline - now()));
        }
        if (!isCurrent()) { await killSpawned(processHandle); return null; }
        if (!ready || processError) {
            await killSpawned(processHandle);
            throw processError || new Error(`TAP active route did not become ready within 10 seconds.${lastError ? ` ${lastError.message}` : ""}`);
        }
        return processHandle;
    }

    async function killSpawned(processHandle) {
        const pid = processHandle && processHandle.pid;
        if (!Number.isSafeInteger(pid) || pid <= 0) return;
        // Do not use a PID after its owned process exited and Windows may reuse it.
        if (processHandle.exitCode != null || processHandle.signalCode != null) return;
        if (typeof processHandle.kill === "function" && typeof processHandle.once === "function") {
            // Use the owned OS handle rather than a PID that Windows could reuse.
            await new Promise((resolve, reject) => {
                const exited = () => { clearTimeout(timer); processHandle.removeListener("exit", exited); resolve(); };
                const timer = setTimeout(() => {
                    processHandle.removeListener("exit", exited);
                    reject(Error("The managed TAP process did not stop; retry before changing TAP settings."));
                }, 2000);
                processHandle.once("exit", exited);
                try {
                    if (!processHandle.kill("SIGKILL") && processHandle.exitCode == null && processHandle.signalCode == null) {
                        clearTimeout(timer); processHandle.removeListener("exit", exited);
                        reject(Error("Could not stop the managed TAP process."));
                    }
                } catch (error) { clearTimeout(timer); processHandle.removeListener("exit", exited); reject(error); }
            });
        } else if (platform === "win32") {
            await execFileAsync(childProcess, "taskkill", ["/F", "/PID", String(pid)], { timeout: 1000 });
        }
    }

    function setRoutes() {
        const script = path.join(filesPath, "tun2socks", "set_routes.bat");
        return sudoRun(`"${script}"`);
    }

    return { sudoRun, setupTapDevice, spawnTun2socks, killSpawned, setRoutes };
}

module.exports = { createTunRuntime };
