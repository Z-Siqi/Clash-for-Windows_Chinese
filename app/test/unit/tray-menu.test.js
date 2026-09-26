"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const mainPath = path.join(root, "app/main/dist/electron/main.js");
const {
    buildStaticTrayMenu
} = require(path.join(root, "app/main/dist/electron/features/tray/build-static-tray-menu"));
const {
    createContextMenuBuilder
} = require(path.join(root, "app/main/dist/electron/features/tray/build-context-menu"));
const { createClashApi } = require(path.join(
    root,
    "app/main/dist/electron/core/network/clash-api"
));

const calls = [];
const Menu = {
    buildFromTemplate(template) {
        return {
            template,
            getMenuItemById(id) {
                const pending = [...template];
                while (pending.length) {
                    const item = pending.shift();
                    if (item.id === id) return item;
                    if (Array.isArray(item.submenu)) pending.push(...item.submenu);
                }
            }
        };
    }
};
const actions = {
    showDashboard: () => calls.push(["dashboard"]),
    sendRenderer: (...args) => calls.push(["send", ...args]),
    toggleDevTools: () => calls.push(["devtools"]),
    moveToNearestMonitor: () => calls.push(["move"]),
    restart: () => calls.push(["restart"]),
    forceQuit: () => calls.push(["force-quit"]),
    requestQuit: () => calls.push(["quit"])
};

const english = buildStaticTrayMenu({
    Menu,
    locale: "en",
    state: { isReady: true, menuMode: "rule" },
    actions
});
const chinese = buildStaticTrayMenu({
    Menu,
    locale: "cn",
    state: { isReady: false, menuMode: "global" },
    actions
});

assert.equal(english.template[0].label, "Dashboard");
assert.equal(chinese.template[0].label, "仪表盘");
assert.equal(english.getMenuItemById("mode-rule").enabled, true);
assert.equal(english.getMenuItemById("mode-rule").checked, true);
assert.equal(english.getMenuItemById("mode-script").visible, true);
assert.equal(chinese.getMenuItemById("mode-rule").enabled, false);

english.template[0].click();
english.getMenuItemById("tun").click({ checked: true });
english.getMenuItemById("mode-global").click();
const more = english.template.find(item => item.label === "More").submenu;
for (const item of more) item.click();
english.template.at(-1).click();
assert.deepEqual(calls, [
    ["dashboard"],
    ["send", "tun-changed", true],
    ["send", "mode-changed", "global"],
    ["devtools"],
    ["move"],
    ["restart"],
    ["force-quit"],
    ["quit"]
]);

const mainSource = fs.readFileSync(mainPath, "utf8");
assert.match(mainSource, /require\("\.\/features\/tray\/build-static-tray-menu"\)/);
assert.match(mainSource, /buildStaticTrayMenu\(\{/);
assert.doesNotMatch(mainSource, /var O_CN = host\.Menu\.buildFromTemplate/);
assert.doesNotMatch(mainSource, /var O_EN = host\.Menu\.buildFromTemplate/);
assert.match(mainSource, /createContextMenuBuilder\(\{/);
assert.doesNotMatch(mainSource, /p\(\)\.mark\(function e\$\$13/);

async function checkDynamicMenu() {
    const requests = [];
    const client = {
        get(url) {
            requests.push(["get", url]);
            if (url === "/proxies") {
                return Promise.resolve({
                    data: {
                        proxies: {
                            GLOBAL: { type: "Selector", all: ["Auto"], now: "Auto" },
                            Auto: { type: "Selector", all: ["Fast", "Slow"], now: "Fast" }
                        }
                    }
                });
            }
            return Promise.resolve({
                data: { providers: { demo: { proxies: [
                    { name: "Fast", alive: true },
                    { name: "Slow", alive: false }
                ] } } }
            });
        },
        put(url, body) {
            requests.push(["put", url, body]);
            return Promise.resolve({ status: 204 });
        },
        delete(url) {
            requests.push(["delete", url]);
        }
    };
    const dynamicCalls = [];
    const builder = createContextMenuBuilder({
        state: {
            language: "en",
            menuStyle: 1,
            menuMode: "rule",
            isReady: true,
            isShowDelayIcon: true,
            systemProxyChecked: true,
            tunModeChecked: false,
            mixinChecked: true,
            coreType: "mihomo"
        },
        isLinux: () => false,
        clashApi: createClashApi({ getClient: () => client }),
        nativeImage: {
            createFromPath(iconPath) {
                return { resize: size => ({ iconPath, size }) };
            }
        },
        path,
        staticRoot: "C:\\static",
        localize: english => english,
        actions: {
            ...actions,
            sendRenderer: (...args) => dynamicCalls.push(args),
            runTrayScript: () => dynamicCalls.push(["run-tray-script"])
        }
    });

    const menu = await builder();
    assert.equal(menu.find(item => item.id === "mode-script").visible, false);
    assert.deepEqual(requests.slice(0, 2), [
        ["get", "/proxies"],
        ["get", "/providers/proxies"]
    ]);
    const groups = menu.find(item => item.label === "Proxy Groups").submenu;
    assert.equal(groups[0].label, "GLOBAL");
    assert.equal(groups[1].submenu[0].icon.size.width, 8);
    groups[1].submenu[1].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(requests.at(-1), ["put", "/proxies/Auto", { name: "Slow" }]);
    assert.deepEqual(dynamicCalls.slice(-2), [
        ["persist-selected-proxy"],
        ["break-connections", "Auto"]
    ]);

    menu.find(item => item.id === "system-proxy").click({ checked: false });
    menu.find(item => item.id === "mode-global").click();
    assert.deepEqual(dynamicCalls.slice(-2), [
        ["system-proxy-changed", false],
        ["mode-changed", "global"]
    ]);
}

checkDynamicMenu()
    .then(() => console.log("tray menu smoke: PASS"))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
