"use strict";

const FIREWALL_DESCRIPTION = "Work with Clash for Windows.";

function createFirewallRuntime({
    isWindows,
    exec,
    sudoExec,
    getBinaryPath,
    realpathSync,
    elevationName = "ClashforWindows"
}) {
    const run = (elevated, script) => new Promise((resolve, reject) => {
        const encoded = Buffer.from(script, "utf16le").toString("base64");
        const command = "powershell.exe -NoLogo -NoProfile -NonInteractive "
            + `-ExecutionPolicy Bypass -EncodedCommand ${encoded}`;
        const callback = (error, stdout = "", stderr = "") => {
            if (error) {
                error.stdout = String(stdout);
                error.stderr = String(stderr);
                reject(error);
                return;
            }
            resolve({ stdout: String(stdout), stderr: String(stderr) });
        };
        if (elevated) sudoExec(command, { name: elevationName }, callback);
        else exec(command, { windowsHide: true }, callback);
    });

    const literal = value => `'${String(value).replace(/'/g, "''")}'`;
    const binaryPath = () => realpathSync(getBinaryPath());

    async function status() {
        if (!isWindows()) return false;
        try {
            const script = [
                "$ErrorActionPreference = 'Stop'",
                `$program = ${literal(binaryPath())}`,
                `$description = ${literal(FIREWALL_DESCRIPTION)}`,
                "$filters = Get-NetFirewallRule -Description $description -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' } | Get-NetFirewallApplicationFilter",
                "[Console]::Out.Write((@($filters | Where-Object { $_.Program -ieq $program }).Count -gt 0))"
            ].join("\n");
            const result = await run(false, script);
            return result.stdout.trim().toLowerCase() === "true";
        } catch (error) {
            console.error("get firewall rule status failed with error:", error);
            return false;
        }
    }

    async function add() {
        if (!isWindows()) return false;
        const script = [
            "$ErrorActionPreference = 'Stop'",
            `$program = ${literal(binaryPath())}`,
            `$description = ${literal(FIREWALL_DESCRIPTION)}`,
            "Remove-NetFirewallRule -Description $description -ErrorAction SilentlyContinue",
            "'TCP', 'UDP' | ForEach-Object {",
            "  New-NetFirewallRule -DisplayName 'Clash Core' -Profile Private,Public -Description $description -Direction Inbound -Protocol $_ -Action Allow -Program $program | Out-Null",
            "}"
        ].join("\n");
        await run(true, script);
        return status();
    }

    async function remove() {
        if (!isWindows()) return false;
        const script = "$ErrorActionPreference = 'Stop'\n"
            + `$description = ${literal(FIREWALL_DESCRIPTION)}\n`
            + "Remove-NetFirewallRule -Description $description -ErrorAction SilentlyContinue";
        await run(true, script);
        return !(await status());
    }

    return { status, add, remove };
}

module.exports = { FIREWALL_DESCRIPTION, createFirewallRuntime };
