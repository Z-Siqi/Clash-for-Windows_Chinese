"use strict";

const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { app } = require("electron");

const root = path.resolve(__dirname, "../../../..");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-security-smoke-"));
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
const timeout = setTimeout(() => finish({ ok: false, error: "window load timed out" }), 30000);
const controllerServer = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", chunk => chunks.push(chunk));
    request.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        controllerRequests.push({ method: request.method, url: request.url, origin: request.headers.origin, body });
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
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            const result = await window.webContents.executeJavaScript(`({
                processType: typeof process,
                requireType: typeof require,
                staticType: typeof window.__static,
                monacoType: typeof window.__CFW_MONACO__,
                appChildren: document.querySelector("#app").childElementCount,
                menuItems: Array.from(document.querySelectorAll(".main-main-menu li.item")).map(item => item.innerText.trim()),
                route: location.hash
            })`);
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
            finish({
                ok: result.processType === "undefined"
                    && result.requireType === "undefined"
                    && result.staticType === "undefined"
                    && result.monacoType === "undefined"
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
                    && allPagesRendered,
                result,
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
controllerServer.listen(0, "127.0.0.1", () => {
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
    fs.writeFileSync(path.join(fixtureWorkingDirectory, "package.json"), JSON.stringify({
        name: "cfw-electron-security-smoke",
        version: "1.0.0"
    }));
    process.chdir(fixtureWorkingDirectory);
    fs.writeFileSync(path.join(clashDirectory, "config.yml"), [
        "mixed-port: 7890",
        `external-controller: 127.0.0.1:${port}`,
        "secret: ''",
        "mode: rule",
        "proxies: []",
        "proxy-groups: []",
        "rules:",
        "  - MATCH,DIRECT",
        ""
    ].join("\n"));
    require(path.join(root, "app/main/dist/electron/main.js"));
});
