"use strict";

const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { app, utilityProcess, ipcMain, BrowserWindow, shell } = require("electron");
require("./native-boundaries");
const { verifyLanguageHotload } = require("./language-hotload");
const { verifyEditorDigits } = require("./editor-digits");

const root = path.resolve(__dirname, "../../../..");
const applicationRoot = process.env.CFW_SECURITY_SMOKE_APP_ROOT || path.join(root, "app", "main");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-security-smoke-"));
async function verifyScriptWorker() {
    const output = path.join(temporaryRoot, "utility-script-result.txt");
    const worker = utilityProcess.fork(path.join(applicationRoot, "dist/electron/entry/utility/script-worker.js"), [], { stdio: "ignore" });
    const run = message => new Promise((resolve, reject) => {
        const receive = result => {
            if (result.type !== "result" || result.job !== message.job) return;
            worker.removeListener("message", receive);
            result.ok ? resolve(result.value) : reject(new Error("Utility script failed"));
        };
        worker.on("message", receive);
        worker.on("exit", code => { if (code !== 0) reject(new Error("Utility script worker exited")); });
        worker.postMessage(message);
    });
    const first = run({
        type: "run", job: 1, home: temporaryRoot, scriptType: "proxy", payload: { output },
        logPath: path.join(temporaryRoot, "utility-script.log"),
        scriptsText: JSON.stringify({ scripts: { proxy: { code: [
            "module.exports.run = payload => {",
            "  if (process.type !== 'utility' || require('electron').app) throw new Error('Unexpected script process');",
            "  require('fs').writeFileSync(payload.output, 'utility-ok');",
            "};"
        ].join("\n") } } })
    });
    try {
        await first;
        const mixin = await run({
            type: "run", job: 2, scriptType: "mixin", payload: { content: { rules: [] } },
            mixinCode: "module.exports.parse = async ({ content }) => { if (process.type !== 'utility' || require('electron').app) throw new Error('Unexpected Mixin process'); return { ...content, utilityVerified: true }; }"
        });
        return fs.readFileSync(output, "utf8") === "utility-ok" && mixin.utilityVerified === true;
    } finally { worker.kill(); }
}
for (const name of ["home", "userData", "sessionData", "temp", "logs"]) {
    const directory = path.join(temporaryRoot, name);
    fs.mkdirSync(directory, { recursive: true });
    app.setPath(name, directory);
}

let finished = false;
let profileUrl = "";
let profileResponseVersion = 0;
let controllerMode = "rule";
const controllerRequests = [];
const consoleMessages = [];
let enhancedTrayFrames = 0;
let enhancedTrayRendered = false;
let dashboardOpened = false;
// Exercise the real navigation IPC without opening a browser or recording a secret.
shell.openExternal = async value => {
    const url = new URL(value);
    dashboardOpened = url.protocol === "https:" && url.hostname === "yacd.haishan.me"
        && url.searchParams.get("hostname") === "127.0.0.1" && Number(url.searchParams.get("port")) > 0;
};
ipcMain.on("speed-update", (_event, image) => {
    if (typeof image === "string" && image.startsWith("data:image/png;")) {
        enhancedTrayFrames++;
    }
});
const timeout = setTimeout(() => finish({ ok: false, error: "window load timed out" }), 40000);
const controllerServer = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", chunk => chunks.push(chunk));
    request.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        // Diagnostics keep neither controller payloads nor authenticated query strings.
        controllerRequests.push({ method: request.method, url: request.url.split("?")[0], origin: request.headers.origin, bodyBytes: Buffer.byteLength(body) });
        if (request.url === "/profile.yaml") {
            profileResponseVersion++;
            response.writeHead(200, { "content-type": "text/yaml" });
            response.end(`profile-version: ${profileResponseVersion}\nmixed-port: 7890\nproxies: []\nproxy-groups: []\nrules:\n  - MATCH,DIRECT\n`);
            return;
        }
        if (request.url === "/configs" && request.method === "GET") {
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({ mode: controllerMode }));
            return;
        }
        if (request.url === "/configs" && ["PATCH", "PUT"].includes(request.method)) {
            try { controllerMode = JSON.parse(body).mode || controllerMode; } catch (_error) {}
            response.writeHead(204);
            response.end();
            return;
        }
        if (request.url === "/proxies") {
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({ proxies: {} }));
            return;
        }
        if (request.url === "/providers/proxies") {
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({ providers: {} }));
            return;
        }
        if (request.url === "/version") {
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({ version: "v1.0.0" }));
            return;
        }
        response.writeHead(404);
        response.end();
    });
});

const { WebSocketServer } = require(path.join(root, "app/main/node_modules/ws"));
const streamServer = new WebSocketServer({ noServer: true });
controllerServer.on("upgrade", (request, socket, head) => {
    const endpoint = request.url.split("?")[0];
    if (!["/traffic", "/connections", "/logs"].includes(endpoint)) { socket.destroy(); return; }
    streamServer.handleUpgrade(request, socket, head, stream => {
        let sequence = 0;
        const timer = setInterval(() => {
            if (stream.readyState !== 1) return;
            sequence++;
            if (endpoint === "/traffic") stream.send(JSON.stringify({ up: sequence * 1024, down: sequence * 2048 }));
            if (endpoint === "/connections") stream.send(JSON.stringify({ uploadTotal: sequence, downloadTotal: sequence, connections: [{
                id: "fixture-connection", start: "2026-01-01T00:00:00Z", upload: sequence, download: sequence,
                chains: ["DIRECT"], metadata: { host: "fixture.live.test", network: "tcp", type: "HTTP", sourceIP: "127.0.0.1", sourcePort: "1234", destinationIP: "127.0.0.1", destinationPort: "80" }
            }] }));
        }, 100);
        stream.on("close", () => clearInterval(timer));
    });
});

app.on("browser-window-created", (_event, window) => {
    window.webContents.on("console-message", (_consoleEvent, ...details) => {
        consoleMessages.push(details.map(detail =>
            typeof detail === "object" ? detail.message : String(detail)
        ).filter(Boolean).join(" | "));
    });
    window.webContents.on("did-fail-load", (_loadEvent, code, description) => {
        finish({ ok: false, error: `did-fail-load ${code}: ${description}` });
    });
    window.webContents.on("render-process-gone", (_goneEvent, details) => {
        finish({ ok: false, error: `render-process-gone: ${details.reason}` });
    });
    window.webContents.on("did-finish-load", async () => {
        if (window.webContents.getURL().endsWith("/cfw-sub.html")) {
            enhancedTrayRendered = await window.webContents.executeJavaScript(`Boolean(document.querySelector("#img")?.src.startsWith("data:image/png;"))`);
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            const result = await window.webContents.executeJavaScript(`({
                processType: typeof process,
                requireType: typeof require,
                staticType: typeof window.__static,
                monacoType: typeof window.__CFW_MONACO__,
                hostType: typeof window.__CFW_HOST__,
                appChildren: document.querySelector("#app").childElementCount,
                menuItems: Array.from(document.querySelectorAll(".main-main-menu li.item")).map(item => item.innerText.trim()),
                route: location.hash
            })`);
            const scriptWorkerIsolated = await verifyScriptWorker();
            const isolation = await window.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: `(() => {
                let nodeModulesBlocked = false;
                try { require('fs'); } catch { nodeModulesBlocked = true; }
                return { rendererSandboxed: globalThis.__CFW_HOST__?.rendererSandboxed === true, nodeModulesBlocked };
            })()` }]);
            isolation.rendererSandboxed = isolation.rendererSandboxed && window.webContents.getLastWebPreferences().sandbox === true;
            const monacoEditingVerified = await window.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: `(async () => {
                const container = document.createElement('div');
                container.style.cssText = 'position:fixed;width:400px;height:200px;left:-1000px;top:0';
                document.body.appendChild(container);
                const monaco = globalThis.__CFW_MONACO__;
                const original = monaco.editor.createModel('rules:\\n- MATCH,DIRECT', 'yaml');
                const modified = monaco.editor.createModel('rules:\\n- MATCH,REJECT', 'yaml');
                const editor = monaco.editor.createDiffEditor(container, { renderSideBySide: false, automaticLayout: false, links: false, minimap: { enabled: false } });
                try {
                    const updated = new Promise(resolve => {
                        const timer = setTimeout(() => resolve(false), 5000);
                        const listener = editor.onDidUpdateDiff(() => { clearTimeout(timer); listener.dispose(); resolve(true); });
                    });
                    editor.setModel({ original, modified });
                    return await updated && editor.getLineChanges()?.length > 0 && editor.getModifiedEditor().getValue().includes('REJECT');
                } finally { editor.dispose(); original.dispose(); modified.dispose(); container.remove(); }
            })()` }]);
            const isolatedEvalBlocked = await window.webContents.executeJavaScriptInIsolatedWorld(999, [{
                code: "(() => { try { Function('return 1')(); return false; } catch (_error) { return true; } })()"
            }]);
            const settingsClick = await window.webContents.executeJavaScript(`(() => {
                const item = Array.from(document.querySelectorAll(".main-main-menu li.item"))
                    .find(candidate => /Settings|设置/i.test(candidate.innerText));
                if (!item) return false;
                item.click();
                return true;
            })()`);
            await new Promise(resolve => setTimeout(resolve, 750));
            const settings = await window.webContents.executeJavaScript(`({
                route: location.hash,
                visible: Boolean(document.querySelector(".main-setting-view")),
                rightText: document.querySelector(".right-side").innerText.slice(0, 300)
            })`);
            const languageHotload = await window.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: `(${verifyLanguageHotload.toString()})()` }]);
            const editorDigits = await verifyEditorDigits(window);
            const proxiesClick = await window.webContents.executeJavaScript(`(() => {
                const item = Array.from(document.querySelectorAll(".main-main-menu li.item"))
                    .find(candidate => /Proxies|代理/i.test(candidate.innerText));
                if (!item) return false;
                item.click();
                return true;
            })()`);
            await new Promise(resolve => setTimeout(resolve, 750));
            const scriptClick = await window.webContents.executeJavaScript(`(() => {
                const button = Array.from(document.querySelectorAll("#main-mode-switcher .btn"))
                    .find(candidate => /Script|脚本/i.test(candidate.innerText));
                if (!button) return false;
                button.click();
                return true;
            })()`);
            await new Promise(resolve => setTimeout(resolve, 750));
            const proxies = await window.webContents.executeJavaScript(`({
                route: location.hash,
                scriptSelected: Boolean(Array.from(document.querySelectorAll("#main-mode-switcher .btn.selected"))
                    .find(candidate => /Script|脚本/i.test(candidate.innerText))),
                modeButtons: Array.from(document.querySelectorAll("#main-mode-switcher .btn"))
                    .map(button => ({ text: button.innerText.trim(), className: button.className }))
            })`);
            const profilesClick = await window.webContents.executeJavaScript(`(() => {
                const item = Array.from(document.querySelectorAll(".main-main-menu li.item"))
                    .find(candidate => /Profiles|配置/i.test(candidate.innerText));
                if (!item) return false;
                item.click();
                return true;
            })()`);
            await new Promise(resolve => setTimeout(resolve, 750));
            const downloadClick = await window.webContents.executeJavaScript(`(() => {
                const input = document.querySelector(".remote-view input");
                const button = document.querySelector(".remote-view .btns-container > div");
                if (!input || !button) return false;
                input.value = ${JSON.stringify(profileUrl)};
                input.dispatchEvent(new Event("input", { bubbles: true }));
                button.click();
                return true;
            })()`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const profiles = await window.webContents.executeJavaScript(`({
                route: location.hash,
                profileItems: document.querySelectorAll(".list-view .list-item").length,
                inputValue: document.querySelector(".remote-view input")?.value || ""
            })`);
            const updateAllClick = await window.webContents.executeJavaScript(`(() => {
                const button = document.querySelector(".update-all-btn");
                if (!button) return false;
                button.click();
                return true;
            })()`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const profileRequestCount = controllerRequests.filter(request => request.url === "/profile.yaml").length;
            const profileRequestSeen = profileRequestCount > 0;
            const yaml = require(path.join(root, "app/main/node_modules/yaml"));
            const clashDirectory = path.join(app.getPath("home"), ".config", "clash");
            const profileList = yaml.parse(fs.readFileSync(path.join(clashDirectory, "profiles", "list.yml"), "utf8"));
            const downloadedProfile = profileList.files.find(profile => profile.url === profileUrl);
            const downloadedContent = downloadedProfile
                ? yaml.parse(fs.readFileSync(path.join(clashDirectory, "profiles", downloadedProfile.time), "utf8"))
                : null;
            const profileUpdatePersisted = downloadedContent?.["profile-version"] === profileRequestCount;
            const pageResults = await window.webContents.executeJavaScript(`(async () => {
                const pages = [
                    [/Home|主页/i, "#/home/general"],
                    [/Proxies|代理/i, "#/home/proxy"],
                    [/Profiles|配置/i, "#/home/server"],
                    [/Logs|日志/i, "#/home/log"],
                    [/Connections|连接/i, "#/home/connection"],
                    [/Settings|设置/i, "#/home/setting"],
                    [/Feedback|About|关于/i, "#/home/about"]
                ];
                const results = [];
                for (const [label, expectedRoute] of pages) {
                    const item = Array.from(document.querySelectorAll(".main-main-menu li.item"))
                        .find(candidate => label.test(candidate.innerText));
                    if (!item) {
                        results.push({ expectedRoute, clicked: false });
                        continue;
                    }
                    item.click();
                    await new Promise(resolve => setTimeout(resolve, 300));
                    results.push({
                        expectedRoute,
                        clicked: true,
                        route: location.hash,
                        rightChildren: document.querySelector(".right-side")?.childElementCount || 0
                    });
                }
                return results;
            })()`);
            const allPagesRendered = pageResults.every(page =>
                page.clicked && page.route === page.expectedRoute && page.rightChildren > 0
            );
            const { verifyUiRegressions } = require("./ui-regressions");
            const uiRegressions = await window.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: `(${verifyUiRegressions.toString()})()` }]);
            uiRegressions.mihomoVersionNavigation = dashboardOpened;
            uiRegressions.languageHotload = languageHotload;
            uiRegressions.editorDigits = editorDigits;
            const indicatorWindow = BrowserWindow.getAllWindows().find(candidate => candidate.webContents.getURL().endsWith("/cfw-sub.html"));
            let indicatorUpdates = false;
            if (indicatorWindow) {
                const initialFrame = await indicatorWindow.webContents.executeJavaScript(`document.querySelector("#img").src`);
                await new Promise(resolve => setTimeout(resolve, 250));
                const nextFrame = await indicatorWindow.webContents.executeJavaScript(`document.querySelector("#img").src`);
                indicatorUpdates = initialFrame !== nextFrame;
            }
            uiRegressions.enhancedTray = enhancedTrayFrames > 0 && enhancedTrayRendered && indicatorUpdates;
            finish({
                ok: result.processType === "undefined"
                    && result.requireType === "undefined"
                    && result.staticType === "undefined"
                    && result.monacoType === "undefined"
                    && result.hostType === "undefined"
                    && isolation.rendererSandboxed && isolation.nodeModulesBlocked
                    && monacoEditingVerified
                    && result.appChildren > 0
                    && settingsClick
                    && settings.visible
                    && proxiesClick
                    && scriptClick
                    && proxies.scriptSelected
                    && profilesClick
                    && downloadClick
                    && profiles.profileItems > 0
                    && profileRequestSeen
                    && updateAllClick
                    && profileRequestCount > 1
                    && profileUpdatePersisted
                    && allPagesRendered
                    && scriptWorkerIsolated && isolatedEvalBlocked
                    && Object.values(uiRegressions).every(Boolean),
                uiRegressions,
                error: Object.values(uiRegressions).every(Boolean) ? undefined : `UI regressions failed: ${Object.entries(uiRegressions).filter(([_name, passed]) => !passed).map(([name]) => name).join(", ")}`,
                result,
                scriptWorkerIsolated,
                isolatedEvalBlocked,
                isolation,
                monacoEditingVerified,
                navigation: {
                    settingsClick, settings, proxiesClick, scriptClick, proxies,
                    profilesClick, downloadClick, profiles, profileRequestSeen,
                    updateAllClick, profileRequestCount, profileUpdatePersisted, pageResults, allPagesRendered
                },
                controllerRequests,
                consoleMessages
            });
        } catch (error) {
            finish({ ok: false, error: error.message, consoleMessages });
        }
    });
});

function finish(result) {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    controllerServer.close();
    if (process.env.CFW_SECURITY_SMOKE_RESULT) {
        fs.writeFileSync(process.env.CFW_SECURITY_SMOKE_RESULT, JSON.stringify(result));
    }
    process.stdout.write(`CFW_SECURITY_SMOKE ${JSON.stringify(result)}\n`);
    const exitCode = result.ok ? 0 : 1;
    app.exit(exitCode);
    setTimeout(() => process.exit(exitCode), 1000).unref();
}

process.on("exit", () => {
    process.chdir(root);
    const resolved = path.resolve(temporaryRoot);
    const expectedPrefix = path.resolve(os.tmpdir(), "cfw-security-smoke-");
    if (resolved.startsWith(expectedPrefix)) fs.rmSync(resolved, { recursive: true, force: true });
});

controllerServer.on("error", error => finish({ ok: false, error: error.message, consoleMessages }));
controllerServer.listen(0, "127.0.0.1", async () => {
    const { port } = controllerServer.address();
    profileUrl = `http://127.0.0.1:${port}/profile.yaml`;
    const clashDirectory = path.join(app.getPath("home"), ".config", "clash");
    fs.mkdirSync(clashDirectory, { recursive: true });
    const fixtureWorkingDirectory = path.join(temporaryRoot, "working-directory");
    const fixtureFiles = path.join(fixtureWorkingDirectory, "static", "files");
    const packagedFiles = path.join(root, "app", "clash_core", "win_x64", "static", "files");
    fs.mkdirSync(path.join(fixtureFiles, "default"), { recursive: true });
    fs.mkdirSync(path.join(fixtureFiles, "win", "x64"), { recursive: true });
    fs.copyFileSync(path.join(packagedFiles, "default", "Country.mmdb"), path.join(fixtureFiles, "default", "Country.mmdb"));
    fs.copyFileSync(path.join(packagedFiles, "win", "x64", "wintun.dll"), path.join(fixtureFiles, "win", "x64", "wintun.dll"));
    for (const core of ["clash-win64.exe", "mihomo-windows-amd64.exe"]) {
        fs.copyFileSync(path.join(packagedFiles, "win", "x64", core), path.join(fixtureFiles, "win", "x64", core));
    }
    fs.writeFileSync(path.join(fixtureWorkingDirectory, "package.json"), JSON.stringify({
        name: "cfw-electron-security-smoke",
        version: "1.0.0"
    }));
    process.chdir(fixtureWorkingDirectory);
    fs.writeFileSync(path.join(clashDirectory, "config.yml"), [
        `mixed-port: ${await require(path.join(root, "app/main/node_modules/get-port"))({ host: "127.0.0.1" })}`,
        `external-controller: 127.0.0.1:${port}`,
        "secret: ''",
        "mode: rule",
        "proxies: []",
        "proxy-groups: []",
        "rules:",
        "  - MATCH,DIRECT",
        ""
    ].join("\n"));
    require(path.join(applicationRoot, "dist/electron/main.js"));
});
