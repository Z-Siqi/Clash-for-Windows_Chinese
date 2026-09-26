"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const allowedGroups = new Set(["unit", "integration", "architecture", "application", "all"]);
const group = process.argv[2];
if (!allowedGroups.has(group)) {
    console.error(`Expected one of: ${[...allowedGroups].join(", ")}`);
    process.exit(2);
}

const root = path.resolve(__dirname, "..");
const groups = group === "all" ? ["architecture", "integration", "unit"] : [group === "application" ? "integration" : group];
const applicationFiles = new Set(["core-api-compatibility.test.js", "profile-application.test.js", "renderer-store.test.js", "configuration-application.test.js", "dashboard-shortcut.test.js", "renderer-foundation.test.js", "renderer-components.test.js", "renderer-utilities.test.js"]);
const files = groups.flatMap(name => {
    const directory = path.join(root, "app", "test", name);
    return fs.readdirSync(directory)
        .filter(file => file.endsWith(".test.js") && (group !== "application" || applicationFiles.has(file)))
        .sort()
        .map(file => path.join(directory, file));
});
const result = spawnSync(process.execPath, [
    "--test",
    "--test-concurrency=1",
    ...files
], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true
});

process.exit(result.status === null ? 1 : result.status);
