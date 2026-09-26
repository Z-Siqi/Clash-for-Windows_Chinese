"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeExternalUrl } = require("../../main/dist/electron/core/network/external-url-policy");

test("external URL policy permits HTTPS and explicit loopback HTTP only", () => {
    assert.equal(normalizeExternalUrl("https://example.com/path"), "https://example.com/path");
    assert.equal(normalizeExternalUrl("http://127.0.0.1:9090/ui"), null);
    assert.equal(
        normalizeExternalUrl("http://127.0.0.1:9090/ui", { allowLoopbackHttp: true }),
        "http://127.0.0.1:9090/ui"
    );
    for (const value of ["file:///C:/malware.exe", "javascript:alert(1)", "clash://install", "not a URL"]) {
        assert.equal(normalizeExternalUrl(value, { allowLoopbackHttp: true }), null);
    }
});
