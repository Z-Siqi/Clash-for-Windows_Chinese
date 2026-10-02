"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

async function runElectronSecuritySmoke({ binary, applicationRoot, timeout = 45000, spawnProcess = spawn }) {
    const executable = path.resolve(binary);
    // A packaged app ignores the fixture argument and could open a real profile.
    if (!fs.existsSync(path.join(path.dirname(executable), "resources", "default_app.asar"))) {
        throw new Error("Security smoke requires an unpacked stock Electron runtime, not a packaged application");
    }
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-electron-smoke-result-"));
    const resultFile = path.join(temporary, "result.json");
    const env = { ...process.env, CFW_SECURITY_SMOKE_RESULT: resultFile };
    delete env.ELECTRON_RUN_AS_NODE;
    if (applicationRoot) env.CFW_SECURITY_SMOKE_APP_ROOT = path.resolve(applicationRoot);
    else delete env.CFW_SECURITY_SMOKE_APP_ROOT;
    const fixture = path.resolve(__dirname, "../app/test/fixtures/electron-security-smoke");
    let child;
    try {
        return await new Promise((resolve, reject) => {
            let settled = false;
            let timer;
            let poll;
            function finish(error, value) {
                if (settled) return;
                settled = true; clearTimeout(timer); clearInterval(poll);
                error ? reject(error) : resolve(value);
            }
            function readResult() {
                if (!fs.existsSync(resultFile)) return false;
                try {
                    const result = JSON.parse(fs.readFileSync(resultFile, "utf8"));
                    if (!result.ok) finish(new Error(result.error || "Electron security smoke assertions failed"));
                    else finish(null, result);
                    return true;
                } catch (error) {
                    if (error instanceof SyntaxError) return false;
                    finish(error); return true;
                }
            }
            child = spawnProcess(executable, [fixture], { env, windowsHide: true, stdio: "ignore" });
            child.once("error", error => finish(error));
            child.once("exit", code => {
                if (!readResult()) finish(new Error(`Electron fixture exited before verification (${code})`));
            });
            poll = setInterval(readResult, 100);
            timer = setTimeout(() => finish(new Error("Electron security smoke timed out")), timeout);
        });
    } finally {
        child?.kill();
        fs.rmSync(temporary, { recursive: true, force: true });
    }
}

if (require.main === module) {
    runElectronSecuritySmoke({ binary: process.argv[2], applicationRoot: process.argv[3] }).then(result => {
        console.log(JSON.stringify({ ok: result.ok, scriptWorkerIsolated: result.scriptWorkerIsolated, allPagesRendered: result.navigation.allPagesRendered, monacoEditingVerified: result.monacoEditingVerified, uiRegressions: result.uiRegressions, ...result.isolation }));
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { runElectronSecuritySmoke };
