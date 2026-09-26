"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolvePackagedResourcesRoot } = require("../../../scripts/build/package-application");
const repositoryRoot = path.resolve(__dirname, "../../..");

test("the macOS application icon is a complete ICNS resource", () => {
    const icon = fs.readFileSync(path.join(repositoryRoot, "app/icon.icns"));
    assert.equal(icon.subarray(0, 4).toString("ascii"), "icns");
    assert.equal(icon.length > 300 * 1024, true);
});

test("packaging resolves the platform-specific Electron resources directory", () => {
    const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-package-resources-"));
    try {
        fs.mkdirSync(path.join(packageRoot, "Clash for Windows.app"));
        assert.equal(
            resolvePackagedResourcesRoot(packageRoot, { platform: "darwin" }),
            path.join(packageRoot, "Clash for Windows.app", "Contents", "Resources")
        );
        assert.equal(
            resolvePackagedResourcesRoot(packageRoot, { platform: "linux" }),
            path.join(packageRoot, "resources")
        );
    } finally {
        fs.rmSync(packageRoot, { recursive: true, force: true });
    }
});
