"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const { createSudoPromptCompat } = require(path.join(
    root,
    "app/main/dist/electron/core/native/sudo-prompt-compat"
));

async function run() {
    const util = require("node:util");
    const childProcess = require("node:child_process");
    const sudoPrompt = require(path.join(root, "app/main/node_modules/@vscode/sudo-prompt"));
    const original = {
        isObject: util.isObject,
        isFunction: util.isFunction,
        hasIsObject: Object.prototype.hasOwnProperty.call(util, "isObject"),
        hasIsFunction: Object.prototype.hasOwnProperty.call(util, "isFunction")
    };
    const compat = createSudoPromptCompat({ sudoPrompt, util });

    const error = await new Promise(resolve => {
        // An invalid title exercises sudo-prompt's complete argument validation
        // without launching an elevation prompt or changing system state.
        compat.exec("echo compatibility-probe", { name: "invalid!" }, resolve);
    });

    assert.match(error.message, /options\.name must be alphanumeric/);
    assert.equal(util.isObject, original.isObject);
    assert.equal(util.isFunction, original.isFunction);
    assert.equal(Object.prototype.hasOwnProperty.call(util, "isObject"), original.hasIsObject);
    assert.equal(Object.prototype.hasOwnProperty.call(util, "isFunction"), original.hasIsFunction);

    if (process.platform === "win32") {
        const originalExec = childProcess.exec;
        const childCommands = [];
        try {
            childProcess.exec = (command, options, callback) => {
                childCommands.push(command);
                setImmediate(() => callback(new Error("blocked test elevation"), "", ""));
                return { stdin: { end() {} } };
            };
            const elevationError = await new Promise(resolve => {
                compat.exec("echo compatibility-probe", { name: "ClashforWindows" }, resolve);
            });
            assert.match(elevationError.message, /did not grant permission/i);
            const elevationCommand = childCommands.find(command => command.startsWith("powershell.exe Start-Process "));
            assert.equal(typeof elevationCommand, "string");
            assert.match(elevationCommand, /^powershell\.exe Start-Process /);
            assert.match(elevationCommand, /-Verb runAs$/);
        } finally {
            childProcess.exec = originalExec;
        }
    }

    const fakeUtil = {};
    let observed;
    const fake = createSudoPromptCompat({
        util: fakeUtil,
        sudoPrompt: {
            exec(command, options, callback) {
                observed = [
                    fakeUtil.isObject(options),
                    fakeUtil.isFunction(callback),
                    command
                ];
            }
        }
    });
    fake.exec("probe", {}, () => {});
    assert.deepEqual(observed, [true, true, "probe"]);
    assert.equal("isObject" in fakeUtil, false);
    assert.equal("isFunction" in fakeUtil, false);

    console.log("sudo-prompt Electron 44 compatibility smoke: PASS");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
