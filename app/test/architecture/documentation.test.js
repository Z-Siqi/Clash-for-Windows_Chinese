"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const docsRoot = path.join(root, "docs");

const markdownFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith(".md") ? [file] : [];
});

for (const file of markdownFiles(docsRoot)) {
    const relative = path.relative(docsRoot, file);
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(relative, /(^|[\\/])\d+[-_. ]/, `${relative} uses an ordered filename`);
    assert.doesNotMatch(source, /[\u3400-\u9fff]/, `${relative} must be written in English`);
}

console.log("documentation policy: PASS");
