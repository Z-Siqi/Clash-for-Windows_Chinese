const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const patchLayerDir = path.join(repoRoot, "app", "main", "dist", "electron", "patch-layer");
const rendererPatchPath = path.join(patchLayerDir, "renderer-patch.js");
const settingsDefaultsPath = path.join(patchLayerDir, "packages", "settings", "settings-defaults.js");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function runScript(context, scriptPath) {
    const source = fs.readFileSync(scriptPath, "utf8");
    const script = new vm.Script(source, {
        filename: scriptPath
    });

    script.runInContext(context);
}

function createRuntime() {
    const runtime = {
        console,
        location: {
            href: "file:///D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree/app/main/dist/electron/index.html"
        },
        document: {
            readyState: "loading",
            documentElement: {
                dataset: {}
            },
            getElementById(id) {
                return id === "app" ? { id: "app" } : null;
            },
            querySelector(selector) {
                return selector === "#app" ? { id: "app" } : null;
            },
            addEventListener() {}
        }
    };

    runtime.addEventListener = function addEventListener() {};
    runtime.window = runtime;
    runtime.globalThis = runtime;
    return runtime;
}

function main() {
    const runtime = createRuntime();
    const context = vm.createContext(runtime);

    runScript(context, rendererPatchPath);
    runScript(context, settingsDefaultsPath);

    const settingsDefaults = runtime.__CFW_SETTINGS_DEFAULTS__;
    const merged = settingsDefaults.mergeSettings({
        language: "zh",
        hideAfterStartup: true,
        showNewVersionIcon: false,
        runTimeFormat: "",
        trayOrders: [["status"]]
    });
    const fallback = settingsDefaults.mergeSettings({});

    assert(settingsDefaults.version === "008-batched-enforced-extractions", "settings defaults version mismatch.");
    assert(merged.language === "zh", "settings merge did not preserve existing values.");
    assert(merged.hideAfterStartup === true, "hideAfterStartup default/merge mismatch.");
    assert(merged.showNewVersionIcon === false, "showNewVersionIcon explicit false was not preserved.");
    assert(merged.randomControllerPort === true, "randomControllerPort default mismatch.");
    assert(merged.runTimeFormat === "hh : mm : ss", "runTimeFormat fallback mismatch.");
    assert(merged.trayOrders[0][0] === "status", "trayOrders explicit value mismatch.");
    assert(fallback.showNewVersionIcon === true, "showNewVersionIcon default mismatch.");
    assert(fallback.hideAfterStartup === false, "hideAfterStartup default mismatch.");
    assert(fallback.trayOrders[0][0] === "icon", "trayOrders default mismatch.");
    assert(runtime.__CFW_PATCH_LAYER__.scriptOrder.some((entry) => entry.name === "packages/settings/settings-defaults.js"), "settings defaults script order missing.");

    console.log("Settings defaults smoke check passed.");
    console.log(`Version: ${settingsDefaults.version}`);
    console.log(`Run time format: ${fallback.runTimeFormat}`);
    console.log(`Tray first item: ${fallback.trayOrders[0][0]}`);
}

main();
