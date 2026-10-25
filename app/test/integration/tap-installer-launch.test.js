"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");
const { promisify } = require("node:util");
const { createTunRuntime } = require("../../main/dist/electron/features/tun/tun-runtime");

const execFile = promisify(childProcess.execFile);

test("TAP setup launches the packaged wizard through real cmd and waits for it before configuration", {
    skip: process.platform !== "win32" ? "requires Windows cmd and .NET stub compilation" : false
}, async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-tap-launch-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
    // Native executables are inert stubs. No actual TAP tool, registry writer,
    // network command, elevation request or installer is run by this test.
    const stubSource = path.join(directory, "Stub.cs"), stubBinary = path.join(directory, "Stub.exe");
    fs.writeFileSync(stubSource, `using System; using System.IO; using System.Threading;
public class Stub {
  [STAThread] public static int Main(string[] args) {
    string name = Path.GetFileNameWithoutExtension(System.Reflection.Assembly.GetEntryAssembly().Location);
    string trace = Environment.GetEnvironmentVariable("CFW_TEST_TAP_TRACE");
    if (name == "tap-windows-installer") {
      File.AppendAllText(trace, "installer-start\\n");
      Thread.Sleep(200);
      File.AppendAllText(trace, "installer-exit\\n");
      return Int32.Parse(Environment.GetEnvironmentVariable("CFW_TEST_TAP_INSTALL_EXIT"));
    }
    if (name == "powershell") { File.AppendAllText(trace, "configure\\n"); return 0; }
    File.AppendAllText(trace, name + "-must-not-run\\n"); return 0;
  }
}`);
    const compileScript = path.join(directory, "compile.ps1");
    fs.writeFileSync(compileScript, "param([string]$Source, [string]$Output)\n$ErrorActionPreference = 'Stop'\nAdd-Type -Path $Source -OutputAssembly $Output -OutputType WindowsApplication\n");
    await execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", compileScript, stubSource, stubBinary], { windowsHide: true, timeout: 15000 });

    const filesPath = path.join(directory, "Program Files & 中文", "files");
    const folder = path.join(filesPath, "win", "common", "tun2socks");
    fs.mkdirSync(path.join(folder, "amd64"), { recursive: true });
    const productionScript = path.resolve(__dirname, "../../clash_core/win_x64/static/files/win/common/tun2socks/add_tap_device.bat");
    fs.copyFileSync(productionScript, path.join(folder, "add_tap_device.bat"));
    for (const filename of ["tap-windows-installer.exe", "powershell.exe", "netsh.exe", "amd64/tapinstall.exe"]) {
        fs.copyFileSync(stubBinary, path.join(folder, filename));
    }

    for (const scenario of ["missing", "reboot-exit", "repair", "elevated-boundary"]) {
        await t.test(scenario, async () => {
            const trace = path.join(directory, `${scenario}.txt`);
            const env = { ...process.env, CFW_TEST_TAP_TRACE: trace, CFW_TEST_TAP_INSTALL_EXIT: scenario === "reboot-exit" ? "3010" : "0" };
            delete env.NoDefaultCurrentDirectoryInExePath;
            let elevationCalls = 0;
            const runBatch = (command, callback) => childProcess.exec(command, { env, cwd: folder, windowsHide: true, timeout: 5000 }, callback);
            const runtime = createTunRuntime({ path, platform: "win32", arch: "x64", filesPath,
                readTapState: async () => ({ exists: scenario === "repair" || fs.existsSync(trace), configured: fs.existsSync(trace) && fs.readFileSync(trace, "utf8").includes("configure\n") }),
                childProcess: {
                    execFile(file, args, options, callback) {
                        assert.equal(file, "net"); assert.deepEqual(args, ["session"]);
                        callback(scenario === "elevated-boundary" ? Error("not elevated") : null, "");
                    },
                    exec(command, _options, callback) { return runBatch(command, callback); }
                },
                sudoExec(command, _options, callback) { elevationCalls++; return runBatch(command, callback); }
            });
            assert.equal(await runtime.setupTapDevice(), true);
            assert.equal(fs.readFileSync(trace, "utf8"), scenario === "repair" ? "configure\n" : "installer-start\ninstaller-exit\nconfigure\n");
            assert.equal(elevationCalls, scenario === "elevated-boundary" ? 1 : 0);
        });
    }
});
