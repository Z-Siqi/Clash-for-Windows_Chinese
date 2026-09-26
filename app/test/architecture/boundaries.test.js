"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const electronRoot = path.join(root, "app/main/dist/electron");
const featureRoot = path.join(electronRoot, "features");
const coreRoot = path.join(electronRoot, "core");

const jsFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const value = path.join(directory, entry.name);
    return entry.isDirectory() ? jsFiles(value) : entry.name.endsWith(".js") ? [value] : [];
});
const localRequires = file => {
    const source = fs.readFileSync(file, "utf8");
    return [...source.matchAll(/require\(["'](\.[^"']+)["']\)/g)].map(match => match[1]);
};
const normalized = value => path.normalize(value).toLowerCase();

for (const file of jsFiles(featureRoot)) {
    const relative = path.relative(featureRoot, file);
    const owner = relative.split(path.sep)[0];
    for (const request of localRequires(file)) {
        const target = normalized(path.resolve(path.dirname(file), request));
        assert.equal(
            target.startsWith(normalized(path.join(featureRoot, owner)) + path.sep)
                || target.startsWith(normalized(coreRoot) + path.sep),
            true,
            `${relative} crosses its feature boundary via ${request}`
        );
    }
}

for (const file of jsFiles(coreRoot)) {
    for (const request of localRequires(file)) {
        const target = normalized(path.resolve(path.dirname(file), request));
        assert.equal(
            target.startsWith(normalized(coreRoot) + path.sep),
            true,
            `${path.relative(coreRoot, file)} makes core depend on ${request}`
        );
    }
}

assert.equal(
    fs.existsSync(path.join(featureRoot, "register-core-ipc.js")),
    false,
    "cross-feature composition belongs in entry/, not features/"
);
assert.equal(
    fs.existsSync(path.join(electronRoot, "entry/main/register-core-ipc.js")),
    true
);

const rendererSource = fs.readFileSync(path.join(electronRoot, "renderer.js"), "latin1");
const mainSource = fs.readFileSync(path.join(electronRoot, "main.js"), "utf8");
const homePageSource = jsFiles(path.join(featureRoot, "home"))
    .map(file => fs.readFileSync(file, "utf8")).join("\n");
const rendererEntrySource = jsFiles(path.join(electronRoot, "entry/renderer"))
    .map(file => fs.readFileSync(file, "utf8")).join("\n");
const rendererDelegationSource = `${rendererSource}\n${rendererEntrySource}\n${homePageSource}`;
assert.doesNotMatch(
    rendererEntrySource,
    /legacy(?:Utilities|Platform|StatusModule)|schedulerModule|scripts\.(?:TX|lJ|ay)|firewall\.(?:A7|Kz|Qz)/,
    "renderer composition must expose named dependencies instead of compatibility bridge keys"
);
assert.doesNotMatch(mainSource, /^\s*\d+:\s*/m, "main entry must not contain numeric webpack modules");
assert.doesNotMatch(mainSource, /\b[a-z]\(\d+\)/, "main entry must use named CommonJS imports");
assert.doesNotMatch(rendererSource, /^\s*\d+:\s*/m, "renderer entry must not contain numeric webpack modules");
assert.doesNotMatch(rendererSource, /\b[a-z]\(\d+\)/, "renderer entry must use named CommonJS imports");
assert.doesNotMatch(
    rendererSource,
    /\.clashAxiosClient\.(get|put|patch|delete|post)\(/,
    "renderer features must use the semantic Clash API instead of the transport client"
);
assert.doesNotMatch(
    rendererSource,
    /http:\/\/127\.0\.0\.1:53000\//,
    "Clash service endpoints belong in core/network/clash-service-api.js"
);
assert.doesNotMatch(
    rendererSource,
    /clashAxiosClient\([^)]*,\s*\{/,
    "renderer features must not invoke Axios transport directly"
);

for (const call of ["refreshRendererProfile(this,", "createRendererAppModule({", "createRendererStore({", "createRendererConfiguration(this,", "mountRendererApplication({", "createRendererRouter({", "createRendererCapabilities({", "persistSelection({"]) {
    assert.equal(rendererDelegationSource.includes(call), true, `renderer composition must delegate via ${call}`);
}
for (const factory of [
    "createProfileParser", "createUserScriptRunner", "createFeedbackPage",
    "createIntervalScheduler", "createUpdateRuntime", "createServerPageWorkflow",
    "createProfileEditor", "createRuleEditor", "createServerPage", "createProvidersPage",
    "createRouterPage", "createGeneralPageWorkflow", "createGeneralPage", "createHomePage",
    "createSettingsPage", "createProxiesPage", "createConnectionsPage", "createLogsPage"
]) {
    assert.equal(rendererEntrySource.includes(factory), true, `missing renderer feature delegation: ${factory}`);
}
for (const oldOwner of ["SAVE_SETTINGS_OBJECT: function", "SAVE_PROFILES: function", "restore at index:", "./providers/proxy/", "new(s().Store)"]) {
    assert.equal(rendererSource.includes(oldOwner), false, `extracted owner returned to renderer: ${oldOwner}`);
}

for (const oldOwner of [
    '"mix-proxy-providers"',
    'message: "[Parser Error] "',
    'const c = require("original-fs");',
    'id: "lazy-image-view clickable"',
    'https://github.com/Z-Siqi/Clash-for-Windows_Chinese-Attached',
    'hdiutil attach',
    'intervalId: r,',
    'handleUpdateAllProfiles: function',
    'handleEditMixedPort: function',
    'serviceNeedUpdate: !1',
    'name: "TunSettingsView"',
    'name: "EditListView"',
    'name: "EditObjectView"',
    'name: "ResetDNSSettingsView"',
    'name: "InterfacesView"'
]) {
    assert.equal(rendererSource.includes(oldOwner), false, `extracted renderer owner returned to bundle: ${oldOwner}`);
}

for (const oldOwner of [
    "handleAllProvidersUpdate: function",
    'name: "RouterConfigView"',
    "handleConfigConfirm: function",
    'name: "QRCodeView"',
    "confirmInput: function",
    "handleRuleClick: function"
]) {
    assert.equal(rendererSource.includes(oldOwner), false, `extracted page owner returned to bundle: ${oldOwner}`);
}

for (const oldOwner of [
    'name: "landing-page"',
    'name: "setting-section"',
    'name: "ConnectionInfoView"',
    "startLatencyTest: function",
    "openLogStream: function"
]) {
    assert.equal(rendererSource.includes(oldOwner), false, `extracted remaining page owner returned to bundle: ${oldOwner}`);
}

for (const oldOwner of ["class Language {", "mixinScrollTop: 0", "h.ZP.mixin({", "name: \"EscCapture\"", "name: \"AlertView\"", "name: \"CodeView\"", "name: \"DiffView\"", "name: \"ScriptView\"", "name: \"ToastView\"", "registerCompletionItemProvider(\"yaml\""]) {
    assert.equal(rendererSource.includes(oldOwner), false, `renderer foundation owner returned to bundle: ${oldOwner}`);
}
for (const name of ["simple-input", "esc-capture", "hint", "info-icon", "navigator", "select-view", "toggle", "alert", "code-editor", "diff-editor", "dns", "input", "menu", "script-editor", "select", "toast"]) {
    const factory = `create${name.split("-").map(part => part[0].toUpperCase() + part.slice(1)).join("")}`;
    assert.equal(rendererEntrySource.includes(factory), true, `missing component delegation: ${name}`);
}
for (const file of jsFiles(path.join(featureRoot, "renderer-ui"))) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\bi\(\d+\)/, `shared UI must not depend on numeric webpack IDs: ${file}`);
    assert.doesNotMatch(source, /\.clashAxiosClient\.(get|put|patch|delete|post)\(/, `shared UI must use semantic Clash API: ${file}`);
}

const generalPageSource = fs.readFileSync(path.join(featureRoot, "clash-core/general-page.js"), "utf8");
assert.doesNotMatch(generalPageSource, /\bi\(\d+\)/, "General page must not depend on numeric webpack module IDs");
assert.doesNotMatch(generalPageSource, /\b(modifyState|VERSION)\b/, "General page globals must be injected by its adapter");

for (const relative of [
    "providers/page.js",
    "router/page.js",
    "profiles/profile-editor-page.js",
    "profiles/rule-editor-page.js",
    "profiles/server-page.js",
    "home/page.js",
    "settings/page.js",
    "proxies/page.js",
    "connections/page.js",
    "logs/page.js"
]) {
    const source = fs.readFileSync(path.join(featureRoot, relative), "utf8");
    assert.doesNotMatch(source, /\bi\(\d+\)/, `${relative} must not depend on numeric webpack module IDs`);
    assert.doesNotMatch(source, /\b(modifyState|VERSION)\b/, `${relative} globals must be injected by its adapter`);
}

console.log("architecture boundaries: PASS");
