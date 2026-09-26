"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const ascii = value => Buffer.from(value, "utf8");

function findUnique(buffer, needle, label) {
    const first = buffer.indexOf(needle);
    if (first < 0 || buffer.indexOf(needle, first + 1) >= 0) {
        throw new Error(`${label} was not found uniquely`);
    }
    return first;
}

const requireAnchor = ascii('const { mergeSettings } = require("./features/settings/settings-defaults");');
const requireLine = ascii('const { loadSettingsFromDisk } = require("./features/settings/load-settings");');
if (source.indexOf(requireLine) < 0) {
    const at = findUnique(source, requireAnchor, "settings require anchor");
    const after = at + requireAnchor.length;
    source = Buffer.concat([source.subarray(0, after), ascii("\n"), requireLine, source.subarray(after)]);
}

const startNeedle = ascii("                loadSettings: function() {");
const endNeedle = ascii("            }),\n            beforeRouteEnter: function");
const start = findUnique(source, startNeedle, "loadSettings start");
const end = source.indexOf(endNeedle, start);
if (end < 0) throw new Error("loadSettings end not found");

const replacement = ascii(`                loadSettings: function() {
                    const mergedSettings = loadSettingsFromDisk({
                        fs: H(),
                        path: V(),
                        yaml: S(),
                        clashPath: this.clashPath,
                        onProfileLanguage: function(language) {
                            modifyState.languageInProfile = language
                        }
                    });
                    this.setSettingsObject({ obj: mergedSettings })
                }
`);
source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(end)]);
fs.writeFileSync(rendererPath, source);
console.log("renderer settings loader extraction applied");
