"use strict";

const { posixServiceDirectory, buildPosixServiceInstall } = require("./install-posix-service");

const SERVICE_STATUS = Object.freeze({
    Active: Symbol("Active"),
    Inactive: Symbol("Inactive"),
    NonExistent: Symbol("NonExistent"),
    Unknown: Symbol("Unknown")
});

const DARWIN_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>Label</key>
        <string>com.lbyczf.cfw.helper</string>
        <key>Program</key>
        <string>helperPath</string>
        <key>RunAtLoad</key>
        <true/>
        <key>KeepAlive</key>
        <true/>
        <key>HardResourceLimits</key>
        <dict><key>NumberOfFiles</key><integer>10240</integer></dict>
        <key>SoftResourceLimits</key>
        <dict><key>NumberOfFiles</key><integer>10240</integer></dict>
    </dict>
</plist>`;

const LINUX_SERVICE = `[Unit]
Description=Clash core service created by Clash for Windows
After=network-online.target nftables.service iptables.service

[Service]
Type=simple
ExecStart=helperPath
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target`;

function createServiceModeManager(dependencies) {
    const {
        platform,
        arch,
        fs,
        path,
        sudoExec,
        serviceApi,
        getFilesPath,
        getClashPath,
        getTempPath = async () => "",
        hashFile,
        adminActions,
        prepareCredentials,
        programFiles = "C:\\Program Files",
        now = Date.now,
        sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
    } = dependencies;

    const elevated = command => new Promise((resolve, reject) => {
        sudoExec(command, { name: platform === "win32" ? "ClashforWindows" : "Clash for Windows" },
            (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve(stdout ? stdout.toString() : (stderr ? stderr.toString() : ""));
            });
    });

    async function statusService() {
        const clashPath = getClashPath() || "";
        if (platform !== "win32" && !fs.existsSync(installedBinary())) {
            return SERVICE_STATUS.Inactive;
        }
        // Avoid blocking renderer startup on loopback retries when Service Mode
        // has never been installed. In Electron, failed XHR requests are much
        // slower than Node's ECONNREFUSED path.
        if (platform === "win32" && !api.isInstalled()) return SERVICE_STATUS.NonExistent;
        const attempts = platform === "win32" ? 3 : 1;
        let lastStatus = SERVICE_STATUS.Unknown;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
                const response = await serviceApi.ping(400);
                if (response.status === 200) return SERVICE_STATUS.Active;
                lastStatus = SERVICE_STATUS.Inactive;
            } catch (_error) {
                lastStatus = SERVICE_STATUS.Unknown;
            }
            if (attempt + 1 < attempts) await sleep(100);
        }
        return lastStatus;
    }

    const localApi = platform === "darwin"
        ? createDarwinManager()
        : platform === "linux" ? createLinuxManager() : createWindowsManager();
    const api = adminActions ? {
        ...localApi,
        installService: method => adminActions.install(method),
        uninstallService: () => adminActions.uninstall(),
        updateService: () => adminActions.update()
    } : localApi;
    return { status: SERVICE_STATUS, statusService, ...api };

    function sourceDirectory() {
        const relative = {
            darwin: { x64: "darwin/x64/service", arm64: "darwin/arm64/service" },
            linux: { x64: "linux/x64/service", arm64: "linux/arm64/service" },
            win32: { x64: "win/x64/service", arm64: "win/arm64/service" }
        }[platform][arch];
        return path.join(getFilesPath(), relative);
    }

    function installedBinary() {
        return path.join(posixServiceDirectory(platform), "clash-core-service");
    }

    function commonNeedUpdate() {
        const target = installedBinary();
        if (!fs.existsSync(target)) return fs.existsSync(path.join(getClashPath(), "service"));
        if (!fs.existsSync(path.join(posixServiceDirectory(platform), "service-config.json"))) return true;
        const names = platform === "linux" || platform === "darwin"
            ? ["clash-core-service", "core-hashes.json"]
            : ["clash-core-service"];
        return names.some(name => {
            const installed = path.join(posixServiceDirectory(platform), name);
            const source = path.join(sourceDirectory(), name);
            return !fs.existsSync(installed) || (fs.existsSync(source) && hashFile(installed) !== hashFile(source));
        });
    }

    function posixInstallCommand(serviceFile, serviceContent) {
        const source = sourceDirectory();
        const destination = posixServiceDirectory(platform);
        const { file } = prepareCredentials();
        const manifest = JSON.parse(fs.readFileSync(path.join(source, "core-hashes.json"), "utf8"));
        return buildPosixServiceInstall({ platform, path, source, destination, credentialFile: file, manifest, serviceFile, serviceContent });
    }

    function createDarwinManager() {
        const plist = "/Library/LaunchDaemons/com.lbyczf.cfw.helper.plist";
        const install = async () => {
            const command = posixInstallCommand(plist, DARWIN_PLIST.replace("helperPath", installedBinary()));
            await elevated(`launchctl unload ${plist} 2>/dev/null || true; ${command}; launchctl load -w ${plist}`);
        };
        return {
            installService: install,
            uninstallService: () => elevated(`launchctl unload ${plist}; rm -f ${plist}`),
            needUpdate: commonNeedUpdate,
            updateService: install
        };
    }

    function createLinuxManager() {
        const unit = "/usr/lib/systemd/system/clash-core-service.service";
        const installService = async () => {
            const command = posixInstallCommand(unit, LINUX_SERVICE.replace("helperPath", installedBinary()));
            await elevated(`systemctl stop clash-core-service 2>/dev/null || true; ${command}; systemctl daemon-reload; systemctl enable clash-core-service; systemctl start clash-core-service`);
        };
        return {
            installService,
            uninstallService: () => elevated(`systemctl stop clash-core-service; systemctl disable clash-core-service; rm -f ${unit}; systemctl daemon-reload`),
            needUpdate: commonNeedUpdate,
            updateService: installService
        };
    }

    function createWindowsManager() {
        const installedDir = path.join(programFiles, "Clash for Windows Service");
        const legacyDirectory = () => path.join(getClashPath(), "service");
        const installedScript = path.join(installedDir, "clash-core-service.ps1");
        const installedManifest = path.join(installedDir, "core-hashes.json");
        const installedLauncher = path.join(installedDir, "clash-core-service.cmd");
        const scheduledTaskConfig = path.join(installedDir, "schtasks.xml");
        const winswBinary = path.join(installedDir, "service.exe");
        const installedPathIsDirectory = () => fs.existsSync(installedDir)
            && fs.lstatSync(installedDir).isDirectory();
        const runCommands = (base, commands, { runBefore = "", runAfter = "" } = {}) => {
            const body = commands.map(({ cmd, options = [] }) =>
                `"${path.join(base, "service.exe")}" ${cmd} ${options.join(" ")}`
            ).join(" && ");
            return elevated([runBefore, body, runAfter].filter(Boolean).join(" && "));
        };
        const runScheduledTasks = (commands, options = {}) => {
            const body = commands.map(command =>
                `schtasks /${command.cmd} /tn "Clash Core Service" ${(command.options || []).join(" ")}`
            ).join(" && ");
            return elevated([options.runBefore, body].filter(Boolean).join(" && ")
                + (options.runAfter ? ` && ${options.runAfter}` : ""));
        };
        const installService = async (method = 0, { replace = false } = {}) => {
            const source = sourceDirectory();
            const { file: credentialFile } = prepareCredentials();
            const manifest = JSON.parse(fs.readFileSync(path.join(source, "core-hashes.json"), "utf8"));
            const common = path.join(source, "../../common");
            const replaceScheduledTask = replace
                ? `schtasks /end /tn "Clash Core Service" >nul 2>&1 & `
                    + `schtasks /delete /tn "Clash Core Service" /F >nul 2>&1 & `
                    + "ping 127.0.0.1 -n 2 >nul & "
                : "";
            // sudo-prompt writes this value as one batch line. An inline `if`
            // would condition the entire command chain and make clean installs
            // silently do nothing when the destination does not exist.
            const coreDir = path.join(installedDir, "cores");
            const coreCopies = manifest.cores.map(entry => {
                if (!/^[\w.-]+$/.test(entry.name) || entry.name === "." || entry.name === "..") throw new Error("Invalid service manifest");
                return `copy "${path.join(source, "..", entry.name)}" "${coreDir}" /Y >nul`;
            }).join(" && ");
            const copyHelper = `del /F /Q "${installedDir}" >nul 2>&1 & `
                + `mkdir "${installedDir}" >nul 2>&1 & `
                + `mkdir "${coreDir}" >nul 2>&1 & `
                + `copy "${path.join(common, "clash-core-service.ps1")}" "${installedDir}" /Y >nul && `
                + `copy "${path.join(common, "clash-core-service.cmd")}" "${installedDir}" /Y >nul && `
                + `copy "${path.join(source, "core-hashes.json")}" "${installedDir}" /Y >nul && `
                + `type nul > "${path.join(installedDir, "service-config.json")}" && `
                + `icacls "${path.join(installedDir, "service-config.json")}" /inheritance:r /grant:r *S-1-5-18:F *S-1-5-32-544:F >nul && `
                + `copy "${credentialFile}" "${path.join(installedDir, "service-config.json")}" /Y >nul && ${coreCopies} `;
            if (method === 0) {
                await runScheduledTasks([
                    { cmd: "create", options: [`/xml "${scheduledTaskConfig}"`, "/F"] },
                    { cmd: "run" }
                ], {
                    runBefore: replaceScheduledTask + copyHelper
                        + `&& copy "${path.join(common, "schtasks.xml")}" "${installedDir}" /Y >nul `
                });
                await waitForWindowsHelper();
                return;
            }
            await runCommands(installedDir, [{ cmd: "install" }, { cmd: "start" }], {
                runBefore: copyHelper
                    + `&& copy "${path.join(source, "service.exe")}" "${installedDir}" /Y `
                    + `&& copy "${path.join(common, "service.yml")}" "${installedDir}" /Y `
            });
            await waitForWindowsHelper();
        };
        const legacyExists = () => {
            const legacyDir = legacyDirectory();
            return fs.existsSync(legacyDir)
                && fs.existsSync(path.join(legacyDir, "service.yml"))
                && fs.existsSync(path.join(legacyDir, "service.exe"));
        };
        const stopWindowsHelper = async () => {
            let helperStopped = false;
            if (serviceApi.shutdown) {
                try {
                    await serviceApi.shutdown();
                    helperStopped = true;
                } catch (_error) {}
            }
            // Older helpers do not expose /shutdown. Stop their managed core
            // before removing the service so it cannot survive the app reload.
            if (!helperStopped && serviceApi.shutdownLegacy) {
                try { helperStopped = await serviceApi.shutdownLegacy(); } catch (_error) {}
            }
            if (!helperStopped && serviceApi.stop) await serviceApi.stop().catch(() => {});
        };
        const uninstallService = async () => {
            if (legacyExists() || fs.existsSync(installedDir)) await stopWindowsHelper();
            if (legacyExists()) {
                const legacyDir = legacyDirectory();
                // Never elevate a WinSW executable from a user-writable profile.
                // Service identity is fixed; retire only its marker as the user.
                await elevated('sc.exe stop "Clash Core Service" >nul 2>&1 & sc.exe delete "Clash Core Service"');
                const home = fs.realpathSync(getClashPath());
                if (fs.realpathSync(legacyDir) !== path.join(home, "service")) throw new Error("Legacy service directory is redirected");
                fs.unlinkSync(path.join(legacyDir, "service.yml"));
                return;
            }
            if (fs.existsSync(installedDir) && !installedPathIsDirectory()) {
                await elevated(
                    `schtasks /end /tn "Clash Core Service" 2>nul & `
                    + `schtasks /delete /tn "Clash Core Service" /F 2>nul & `
                    + `del /F /Q "${installedDir}"`
                );
                return;
            }
            const source = sourceDirectory();
            if (fs.existsSync(scheduledTaskConfig) || !fs.existsSync(winswBinary)) {
                // /shutdown normally ends the task before elevation. Keep task
                // deletion unconditional when `schtasks /end` reports that it
                // is no longer running.
                await elevated(
                    `schtasks /end /tn "Clash Core Service" >nul 2>&1 & `
                    + `schtasks /delete /tn "Clash Core Service" /F >nul 2>&1 & `
                    + "ping 127.0.0.1 -n 2 >nul & "
                    + `rmdir "${installedDir}" /s /q`
                );
                return;
            }
            await runCommands(installedDir, [{ cmd: "stop" }, { cmd: "uninstall" }], {
                runBefore: `copy "${path.join(source, "../../common/service.yml")}" "${installedDir}" /Y `,
                runAfter: `timeout /t 2 & rmdir "${installedDir}" /s /q`
            });
        };
        const needUpdate = () => {
            if (legacyExists()) return true;
            const source = sourceDirectory();
            const currentScript = path.join(source, "../../common/clash-core-service.ps1");
            const currentManifest = path.join(source, "core-hashes.json");
            const currentTask = path.join(source, "../../common/schtasks.xml");
            if (!fs.existsSync(installedScript) || !fs.existsSync(installedManifest)
                || !fs.existsSync(installedLauncher) || !fs.existsSync(path.join(installedDir, "service-config.json"))) {
                return fs.existsSync(installedDir);
            }
            return (fs.existsSync(currentScript) && hashFile(installedScript) !== hashFile(currentScript))
                || (fs.existsSync(currentManifest) && hashFile(installedManifest) !== hashFile(currentManifest))
                || (fs.existsSync(scheduledTaskConfig) && fs.existsSync(currentTask)
                    && hashFile(scheduledTaskConfig) !== hashFile(currentTask));
        };
        const isInstalled = () => legacyExists() || fs.existsSync(winswBinary)
            || (fs.existsSync(installedScript) && fs.existsSync(installedManifest)
                && fs.existsSync(installedLauncher));
        return {
            installService: async (method = 0) => {
                // Reinstall from an inactive old protocol must retire the old
                // task/service before rotating credentials and starting v2.
                if (isInstalled()) await uninstallService();
                await installService(method);
            },
            uninstallService,
            needUpdate,
            isInstalled,
            updateService: async () => {
                if (legacyExists()) {
                    await uninstallService();
                    await installService(0);
                    return;
                }
                const method = fs.existsSync(scheduledTaskConfig) || !fs.existsSync(winswBinary) ? 0 : 1;
                if (method === 0) {
                    await stopWindowsHelper();
                    await installService(0, { replace: true });
                    return;
                }
                await uninstallService();
                await installService(method);
            }
        };

        async function waitForWindowsHelper() {
            const deadline = now() + 30000;
            while (now() < deadline) {
                try {
                    if ((await serviceApi.ping(250)).status === 200) return;
                } catch (_error) {}
                await sleep(100);
            }
            throw new Error("Windows Service Mode helper did not become reachable after installation");
        }
    }

    function ensureDirectory(directory) {
        if (!fs.existsSync(directory)) fs.mkdirSync(directory);
    }

    function removeDirectory(directory) {
        if (!fs.existsSync(directory)) return;
        for (const entry of fs.readdirSync(directory)) {
            const target = path.join(directory, entry);
            if (fs.lstatSync(target).isDirectory()) removeDirectory(target);
            else fs.unlinkSync(target);
        }
        fs.rmdirSync(directory);
    }
}

module.exports = { SERVICE_STATUS, createServiceModeManager };
