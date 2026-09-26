"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(
    __dirname,
    "../../app/main/dist/electron/renderer.js"
);
let source = fs.readFileSync(rendererPath);
const newline = source.includes(Buffer.from("\r\n")) ? "\r\n" : "\n";

source = insertOnce(
    source,
    Buffer.from(`};${newline}(() => {`),
    Buffer.from(
        `};${newline}const { mergeSettings } = require("./features/settings/settings-defaults");${newline}(() => {`
    )
);

source = replaceRange(
    source,
    "                    const showNewVersionIcon = settings.showNewVersionIcon !== false;",
    "                    if (settings.language != null) {",
    ""
);

source = replaceRange(
    source,
    "                    const mergedSettings = {",
    "                    this.setSettingsObject({ obj: mergedSettings });",
    `                    const mergedSettings = mergeSettings(settings);${newline}${newline}`
);

fs.writeFileSync(rendererPath, source);
console.log("renderer settings-default extraction applied");

function insertOnce(buffer, needle, replacement) {
    const first = buffer.indexOf(needle);
    if (first < 0 || buffer.indexOf(needle, first + 1) >= 0) {
        throw new Error("renderer insertion anchor must occur exactly once");
    }
    return splice(buffer, first, first + needle.length, replacement);
}

function replaceRange(buffer, startText, endText, replacementText) {
    const startNeedle = Buffer.from(startText);
    const endNeedle = Buffer.from(endText);
    const start = buffer.indexOf(startNeedle);
    const end = buffer.indexOf(endNeedle, start + startNeedle.length);
    if (start < 0 || end < 0) {
        throw new Error(`renderer range anchors not found: ${startText}`);
    }
    if (buffer.indexOf(startNeedle, start + 1) >= 0) {
        throw new Error(`renderer start anchor is ambiguous: ${startText}`);
    }
    return splice(buffer, start, end, Buffer.from(replacementText));
}

function splice(buffer, start, end, replacement) {
    return Buffer.concat([buffer.subarray(0, start), replacement, buffer.subarray(end)]);
}
