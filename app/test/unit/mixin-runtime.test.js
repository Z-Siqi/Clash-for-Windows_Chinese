"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const { readRendererCompositionSource } = require("../fixtures/renderer-composition-source");
const {
    DEFAULT_YAML_MIXIN,
    ensureMixinDefaults,
    validateMixinSettings
} = require(path.join(root, "app/main/dist/electron/features/mixin/mixin-runtime"));

const yamlParser = require("../../main/node_modules/yaml").parse;
const codeCompiler = source => source.includes("module.exports.parse") ? { parse() {} } : {};

const yamlSettings = { mixinType: 0, mixinText: "" };
ensureMixinDefaults(yamlSettings);
assert.equal(yamlSettings.mixinText, DEFAULT_YAML_MIXIN);
assert.equal(yamlParser(yamlSettings.mixinText).mixin.dns.enable, true);
assert.equal(yamlParser(yamlSettings.mixinText).mixin.dns.listen, ":53");
for (const text of ["mixin: {}\n", "mixin:\n  ipv6: true\n"]) {
    const saved = { mixinText: text };
    ensureMixinDefaults(saved);
    assert.equal(saved.mixinText, text, "preserve explicit saved Mixin, including no-op configurations");
}
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
assert.match(renderer, /validateMixinSettings\(settings/);
assert.match(workflow, /requestProfileToggle\("mixin"/);
console.log("mixin runtime smoke: PASS");
