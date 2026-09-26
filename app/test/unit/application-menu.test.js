"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const featureRoot = path.join(root, "app/main/dist/electron/features");
const mainPath = path.join(root, "app/main/dist/electron/main.js");
const {
    installApplicationMenu
} = require(path.join(featureRoot, "application/install-application-menu"));
const {
    createWindowBoundsNormalizer
} = require(path.join(featureRoot, "window/normalize-window-bounds"));

const calls = [];
const Menu = {
    buildFromTemplate(template) {
        calls.push(["build", template]);
        return { template };
    },
    setApplicationMenu(menu) {
        calls.push(["install", menu]);
    }
};
const menu = installApplicationMenu({
    Menu,
    app: { name: "CFW" },
    shell: { openExternal: url => calls.push(["open", url]) },
    requestQuit: () => calls.push(["quit"])
});

assert.equal(menu.template[0].label, "CFW");
assert.equal(calls.at(-1)[0], "install");
const quit = menu.template[0].submenu.find(item => item.accelerator === "Command+Q");
quit.click();
assert.deepEqual(calls.at(-1), ["quit"]);
const help = menu.template.find(item => item.role === "help").submenu;
help[0].click();
help[1].click();
assert.deepEqual(calls.slice(-2), [
    ["open", "https://github.com/Fndroid/clash_for_windows_pkg"],
    ["open", "https://docs.cfw.lbyczf.com/"]
]);

const normalize = createWindowBoundsNormalizer({
    screen: {
        getAllDisplays: () => [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }],
        getDisplayNearestPoint: point => {
            calls.push(["nearest", point]);
            return { bounds: { x: 1920, y: 0, width: 1920, height: 1080 } };
        }
    }
});
assert.deepEqual(normalize({ x: 100, y: 100, width: 800, height: 600 }), { x: 100, y: 100 });
assert.deepEqual(normalize({ x: 5000, y: 5000, width: 800, height: 600 }), { x: 1920, y: 0 });
assert.deepEqual(calls.at(-1), ["nearest", { x: 5000, y: 5000 }]);

const mainSource = fs.readFileSync(mainPath, "utf8");
assert.match(mainSource, /installApplicationMenu\(\{/);
assert.match(mainSource, /createWindowBoundsNormalizer\(\{/);
assert.doesNotMatch(mainSource, /function B\(e\)/);
assert.doesNotMatch(mainSource, /host\.Menu\.setApplicationMenu/);

console.log("application menu smoke: PASS");
