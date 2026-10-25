"use strict";

const { execFileAsync } = require("../../core/process/commands");

function createProfileNetworkEffects({ childProcess, getPort, setInterval: schedule = setInterval, clearInterval: cancel = clearInterval,
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) }) {
    let tapLookup;
    let tapRevision = 0;
    return {
        hasTap() {
            if (!tapLookup) {
                const revision = tapRevision;
                const query = () => execFileAsync(childProcess, "netsh", ["interface", "show", "interface"], { timeout: 2000 })
                    .then(output => {
                        // A failed named lookup cannot distinguish absence from a
                        // transient OS failure. Only a complete table proves absence.
                        const lines = String(output).split(/\r?\n/);
                        const separator = lines.findIndex(line => /^\s*-{3,}\s*$/.test(line));
                        if (revision !== tapRevision || separator < 0) return null;
                        const rows = lines.slice(separator + 1).map(line => line.trim()).filter(Boolean).map(line => line.split(/\s{2,}/));
                        if (rows.some(columns => columns.length < 4)) return null;
                        return rows.some(columns => columns.length === 4 && columns[3].toLowerCase() === "cfw-tap");
                    }, () => null);
                const lookup = query().then(async installed => {
                    if (installed !== false) return installed;
                    // PnP can omit an existing adapter for one enumeration.
                    // Confirm removal before publishing a negative observation.
                    await sleep(150);
                    if (revision !== tapRevision) return null;
                    return query();
                }).then(installed => revision === tapRevision ? installed : null)
                    .finally(() => { if (tapLookup === lookup) tapLookup = null; });
                tapLookup = lookup;
            }
            return tapLookup;
        },
        invalidateTap() { tapRevision++; tapLookup = null; },
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
