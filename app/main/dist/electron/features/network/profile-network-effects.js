"use strict";

function createProfileNetworkEffects({ childProcess, getPort, setInterval: schedule = setInterval, clearInterval: cancel = clearInterval }) {
    return {
        hasTap() {
            try { return childProcess.execFileSync("netsh", ["interface", "show", "interface"], { windowsHide: true }).toString().includes("cfw-tap"); }
            catch (_error) { return true; }
        },
        renewDhcp() {
            let attempts = 0;
            const timer = schedule(async () => {
                try {
                    if (await getPort({ port: 7777, host: "127.0.0.1" }) !== 7777) childProcess.execFile("ipconfig", ["/renew"], { windowsHide: true }, () => {});
                } catch (_error) {
                    // DHCP probing is best effort; failure must not reject a completed profile apply.
                } finally { if (++attempts === 5) cancel(timer); }
            }, 2000);
            return () => cancel(timer);
        }
    };
}

module.exports = { createProfileNetworkEffects };
