"use strict";

const test = require("node:test");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "../../..");

test("Linux Service Mode switches between both packaged cores", {
    skip: process.platform !== "linux" ? "requires a Linux host" : false,
    timeout: 30000
}, () => {
    execFileSync("bash", [
        path.join(root, "app/test/fixtures/linux-service-helper-smoke.sh"),
        root
    ], { stdio: "inherit" });
});
