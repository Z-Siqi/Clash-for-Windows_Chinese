"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const electronRoot = path.join(root, "app/main/dist/electron");
const { readRendererCompositionSource } = require("../fixtures/renderer-composition-source");
const { parsePort, buildDashboardUrl } = require(path.join(
    electronRoot,
    "features/clash-core/general-settings"
));

assert.equal(parsePort("1"), 1);
assert.equal(parsePort(" 65535 "), 65535);
for (const invalid of ["", "0", "65536", "65353.5", "1e3", "text", null]) {
    assert.equal(parsePort(invalid), null, `accepted invalid port ${String(invalid)}`);
}

const dashboard = new URL(buildDashboardUrl({
    controllerPort: 9090,
    secret: "token + / 中文"
}));
assert.equal(dashboard.protocol, "http:");
assert.equal(dashboard.hostname, "yacd.haishan.me");
assert.equal(dashboard.searchParams.get("hostname"), "127.0.0.1");
assert.equal(dashboard.searchParams.get("port"), "9090");
assert.equal(dashboard.searchParams.get("secret"), "token + / 中文");
assert.throws(() => buildDashboardUrl({ controllerPort: 0 }), RangeError);

const renderer = readRendererCompositionSource(root);
const workflow = fs.readFileSync(path.join(
    electronRoot, "features/clash-core/general-page-workflow.js"
), "utf8");
assert.match(renderer, /require\("\.\/general-settings"\)/);
assert.match(renderer, /features\/clash-core\/general-page-workflow/);
assert.match(workflow, /parsePort\(value\) !== null/);
assert.match(workflow, /this\.settings\.randomMixedPort = false/);
assert.match(workflow, /openExternal\(buildDashboardUrl\(/);
assert.doesNotMatch(renderer, /clash\.razord\.top/);
assert.doesNotMatch(renderer, /65353/);

console.log("general settings smoke: PASS");
