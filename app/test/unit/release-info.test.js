"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const release = require("../../main/dist/electron/core/release/release-info");
const { selectReleaseAsset } = require("../../main/dist/electron/core/release/update-policy");
const { synchronizeRelease } = require("../../../scripts/build/sync-release");

test("release versions compare numeric components, v tags and historical Opt tags", () => {
    assert.equal(release.compareVersions("0.20.39.10", "0.20.39.9"), 1);
    assert.equal(release.compareVersions("v0.20.39-Opt.4", "0.20.39.4"), 0);
    assert.equal(release.compareVersions("1.0.0", "0.20.39.999"), 1);
    assert.equal(release.compareVersions("0.20.39", "0.20.39.1"), -1);
    assert.equal(release.compareVersions("0.2039.4.1", "0.20.39.4"), 1);
    assert.throws(() => release.compareVersions("garbage", "0.20.39.4"), /Invalid/);
});

test("display labels and remote installer names are independent of numeric versions", () => {
    assert.equal(release.displayVersion(), release.config.displayVersion);
    const version = "0.2039.4.1";
    const feed = release.createUpdateFeed({ version, displayVersion: "Opt-4.1", targets: ["win-x64", "win-arm64"] });
    assert.equal(feed.tag_name, version);
    assert.equal(feed.display_version, "Opt-4.1");
    for (const arch of ["x64", "arm64"]) {
        const asset = selectReleaseAsset(feed, { platform: "win32", arch });
        const name = `Clash.for.Windows.Setup_Opt-4.1${arch === "arm64" ? ".arm64" : ""}.exe`;
        assert.equal(asset.name, name);
        assert.equal(asset.browser_download_url, release.assetUrl(name, version));
    }
    // A label-only change keeps the comparison version unchanged.
    const relabeled = release.createUpdateFeed({ version, displayVersion: "Opt-999" });
    assert.equal(release.compareVersions(relabeled.tag_name, feed.tag_name), 0);
    assert.throws(() => release.displayVersion("../Opt-4.1"), /Invalid display/);
});

test("older feeds without a display label still match historical Setup_Opt names", () => {
    const feed = release.createUpdateFeed({ version: "0.20.39.3", displayVersion: "Opt-3" });
    delete feed.display_version;
    assert.equal(selectReleaseAsset(feed, { platform: "win32", arch: "x64" }).name, "Clash.for.Windows.Setup_Opt-3.exe");
});

test("feed asset names round-trip for every supported platform and architecture", () => {
    const targets = ["win-x64", "win-arm64", "mac-x64", "mac-arm64", "linux-x64", "linux-arm64"];
    const feed = release.createUpdateFeed({ targets });
    for (const target of targets) {
        const [prefix, arch] = target.split("-");
        const platform = { win: "win32", mac: "darwin", linux: "linux" }[prefix];
        assert.equal(selectReleaseAsset(feed, { platform, arch }).name, release.assetName(target));
        if (platform !== "linux") {
            assert.equal(selectReleaseAsset(feed, { platform, arch, portable: true }), null);
            const name = release.assetName(target, feed.tag_name, true);
            const portable = { ...feed, assets: [{ name, browser_download_url: release.assetUrl(name) }] };
            assert.equal(selectReleaseAsset(portable, { platform, arch, portable: true }).name, name);
        }
    }
    assert.equal(selectReleaseAsset(feed, { platform: "win32", arch: "ia32" }), null);
});

test("published Setup_Opt installer and historical numeric installer names are accepted only from the configured release", () => {
    const feed = release.createUpdateFeed();
    assert.equal(selectReleaseAsset(feed, { platform: "win32", arch: "x64" }).name, release.assetName("win-x64"));
    assert.equal(selectReleaseAsset(feed, { platform: "win32", arch: "arm64" }), null);
    const unsupportedName = "Clash.for.Windows-0.20.39.ia32.exe";
    const unsupported = { ...feed, assets: [{ name: unsupportedName, browser_download_url: release.assetUrl(unsupportedName) }] };
    assert.equal(selectReleaseAsset(unsupported, { platform: "win32", arch: "x64" }), null);
    const name = "Clash.for.Windows-0.20.39.exe";
    const legacy = { ...feed, assets: [{ name, browser_download_url: release.assetUrl(name) }] };
    assert.equal(selectReleaseAsset(legacy, { platform: "win32", arch: "x64" }).name, name);
    for (const url of ["https://example.com/app.exe", release.assetUrl(name, "0.20.39.3")]) {
        legacy.assets[0].browser_download_url = url;
        assert.equal(selectReleaseAsset(legacy, { platform: "win32", arch: "x64" }), null);
    }
});

test("one version change synchronizes application, lock, feed and installer without touching dependency pins", t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-release-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, "app/main"), { recursive: true });
    fs.mkdirSync(path.join(root, "CFW/BuildRelease/InnoSetup"), { recursive: true });
    const dependencies = { yaml: "2.8.0" };
    fs.writeFileSync(path.join(root, "app/main/package.json"), JSON.stringify({ version: "0.0.0", dependencies }));
    fs.writeFileSync(path.join(root, "app/main/package-lock.json"), JSON.stringify({ version: "0.0.0", packages: { "": { version: "0.0.0", dependencies }, "node_modules/yaml": { version: "2.8.0", integrity: "pinned" } } }));
    fs.writeFileSync(path.join(root, "update"), JSON.stringify({ body: "release notes" }));
    const info = {
        ...release, config: { ...release.config, version: "0.20.39.5", displayVersion: "Opt-4.1" },
        displayVersion: () => "Opt-4.1",
        assetName: target => release.assetName(target, "0.20.39.5", false, "Opt-4.1"),
        createUpdateFeed: options => release.createUpdateFeed({ ...options, version: "0.20.39.5", displayVersion: "Opt-4.1" })
    };
    assert.throws(() => synchronizeRelease(root, info, true), /out of date/);
    assert.equal(synchronizeRelease(root, info).length, 4);
    assert.deepEqual(synchronizeRelease(root, info, true), []);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "app/main/package.json")));
    const lock = JSON.parse(fs.readFileSync(path.join(root, "app/main/package-lock.json")));
    assert.equal(manifest.version, info.config.version);
    assert.deepEqual(manifest.dependencies, dependencies);
    assert.equal(lock.packages[""].version, info.config.version);
    assert.deepEqual(lock.packages["node_modules/yaml"], { version: "2.8.0", integrity: "pinned" });
    const feed = JSON.parse(fs.readFileSync(path.join(root, "update")));
    assert.equal(feed.tag_name, info.config.version);
    assert.equal(feed.body, "release notes");
    assert.match(fs.readFileSync(path.join(root, "CFW/BuildRelease/InnoSetup/release.generated.iss"), "utf8"), /MyAppVersion "0\.20\.39\.5"/);
    assert.equal(feed.display_version, "Opt-4.1");
    assert.match(feed.assets[0].name, /Opt-4\.1/);
    assert.match(fs.readFileSync(path.join(root, "CFW/BuildRelease/InnoSetup/release.generated.iss"), "utf8"), /MyAppDisplayVersion "Opt-4\.1"/);
});

test("checked-in release metadata agrees with the single release configuration", () => {
    assert.deepEqual(synchronizeRelease(path.resolve(__dirname, "../../.."), release, true), []);
});
