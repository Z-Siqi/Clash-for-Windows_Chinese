"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const { readRendererCompositionSource } = require("../fixtures/renderer-composition-source");
const {
    ensureMixinDefaults,
    validateMixinSettings
} = require(path.join(root, "app/main/dist/electron/features/mixin/mixin-runtime"));

const yamlParser = source => source.trim() === "mixin: {}" ? { mixin: {} } : null;
const codeCompiler = source => source.includes("module.exports.parse") ? { parse() {} } : {};

const yamlSettings = { mixinType: 0, mixinText: "" };
ensureMixinDefaults(yamlSettings);
assert.equal(yamlSettings.mixinText, "mixin: {}\n");
assert.equal(validateMixinSettings(yamlSettings, { parseYaml: yamlParser, compileCode: codeCompiler }), true);

const codeSettings = { mixinType: 1, mixinCode: "" };
ensureMixinDefaults(codeSettings);
assert.match(codeSettings.mixinCode, /module\.exports\.parse/);
assert.equal(validateMixinSettings(codeSettings, { parseYaml: yamlParser, compileCode: codeCompiler }), true);

assert.throws(
    () => validateMixinSettings(
        { mixinType: 0, mixinText: "dns: {}" },
        { parseYaml: yamlParser, compileCode: codeCompiler }
    ),
    /mixin.*object/i
);

const renderer = readRendererCompositionSource(root);
const workflow = fs.readFileSync(path.join(
    root, "app/main/dist/electron/features/clash-core/general-page-workflow.js"
), "utf8");
assert.match(renderer, /features\/mixin\/mixin-runtime/);
assert.match(renderer, /features\/clash-core\/general-page-workflow/);
assert.match(workflow, /validateMixinSettings\(this\.settings/);
console.log("mixin runtime smoke: PASS");
