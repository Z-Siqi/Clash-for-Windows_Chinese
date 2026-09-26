"use strict";

function createProfileNetworkEffects({ childProcess, getPort, setInterval: schedule = setInterval, clearInterval: cancel = clearInterval }) {
    return {
        hasTap() {
            try { return childProcess.execSync("netsh interface show interface", { windowsHide: true }).toString().includes("cfw-tap"); }
            catch (_error) { return true; }
        },
        renewDhcp() {
            let attempts = 0;
            const timer = schedule(async () => {
                try {
                    if (await getPort({ port: 7777 }) !== 7777) childProcess.exec("ipconfig /renew", { windowsHide: true });
                } catch (_error) {
                    // DHCP probing is best effort; failure must not reject a completed profile apply.
                } finally { if (++attempts === 5) cancel(timer); }
            }, 2000);
        }
    };
}

module.exports = { createProfileNetworkEffects };
