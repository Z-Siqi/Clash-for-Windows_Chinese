"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    supportsScriptMode,
    isRoutingModeSupported,
    normalizeRoutingMode
} = require("../../main/dist/electron/core/clash-core/core-capabilities");

test("routing modes reflect the selected core's actual API capability", () => {
    assert.equal(supportsScriptMode("clash"), true);
    assert.equal(supportsScriptMode("mihomo"), false);
    assert.equal(isRoutingModeSupported("clash", "script"), true);
    assert.equal(isRoutingModeSupported("mihomo", "script"), false);
    assert.equal(isRoutingModeSupported("mihomo", "rule"), true);
    assert.equal(normalizeRoutingMode("mihomo", "script"), "rule");
    assert.equal(normalizeRoutingMode("mihomo", "direct"), "direct");
});
