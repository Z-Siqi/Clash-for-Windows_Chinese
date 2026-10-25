"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const { md5 } = require("../../main/dist/electron/core/crypto/md5");
const { createBrowserPath } = require("../../main/dist/electron/core/runtime/browser-path");
const browserIp = require("../../main/dist/electron/core/network/browser-ip");
const { randomUuid } = require("../../main/dist/electron/core/crypto/browser-uuid");

test("browser provider hashes preserve UTF-8 legacy MD5 cache identities", () => {
    for (const value of ["", "abc", "https://example.invalid/provider?key=fixture", "中文路径😀", "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(10000)]) {
        assert.equal(md5(value), crypto.createHash("md5").update(value).digest("hex"));
    }
});

test("browser UUIDs retain version and variant using Web Crypto entropy", () => {
    const values = new Set(Array.from({ length: 100 }, () => randomUuid(crypto.webcrypto)));
    assert.equal(values.size, 100);
    for (const value of values) assert.match(value, /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
});

test("browser path operations match native application paths on Windows, macOS and Linux", () => {
    for (const [platform, cwd, native, paths] of [
        ["win32", "C:\\app", path.win32, ["C:\\Users\\fixture\\.config\\clash", "C:/app/resources/../static/files/", "\\\\server\\share\\profiles\\one.yaml", "static/files", "C:\\", "/rooted/file", "./profiles/../config.yaml"]],
        ["linux", "/opt/app", path.posix, ["/home/fixture/.config/clash", "/opt/app/resources/../static/files/", "/", "static/files", "./profiles/../config.yaml"]]
    ]) {
        const browser = createBrowserPath({ platform, cwd });
        for (const value of paths) {
            for (const operation of ["normalize", "basename", "dirname", "extname", "isAbsolute"]) assert.equal(browser[operation](value), native[operation](value), `${platform} ${operation} ${value}`);
            assert.equal(browser.resolve(value), native.resolve(cwd, value), `${platform} resolve ${value}`);
            assert.equal(browser.join(value, "profiles", "..", "config.yaml"), native.join(value, "profiles", "..", "config.yaml"));
        }
    }
});

test("browser IP validation matches accepted controller and DNS address literals", () => {
    for (const value of ["127.0.0.1", "0.0.0.0", "255.255.255.255", "256.1.1.1", "01.1.1.1", "bad", "::1", "fe80::1%en0", "::ffff:192.0.2.1", ":::1"]) assert.equal(browserIp.isIP(value), net.isIP(value), value);
});
