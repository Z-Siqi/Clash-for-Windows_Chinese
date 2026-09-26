"use strict";

function createSudoPromptCompat({ sudoPrompt, util }) {
    if (!sudoPrompt || typeof sudoPrompt.exec !== "function") {
        throw new TypeError("sudo-prompt must expose exec()");
    }
    if (!util || (typeof util !== "object" && typeof util !== "function")) {
        throw new TypeError("Node util module is required");
    }

    return {
        exec(...args) {
            // @vscode/sudo-prompt 9.3.1 still calls these APIs, which were
            // removed from the Node runtime bundled with Electron 44. They are
            // only needed while exec() synchronously validates its arguments.
            const previous = {
                isObject: util.isObject,
                isFunction: util.isFunction
            };
            const owned = {
                isObject: Object.prototype.hasOwnProperty.call(util, "isObject"),
                isFunction: Object.prototype.hasOwnProperty.call(util, "isFunction")
            };
            if (typeof util.isObject !== "function") {
                util.isObject = value => value !== null && typeof value === "object";
            }
            if (typeof util.isFunction !== "function") {
                util.isFunction = value => typeof value === "function";
            }
            try {
                return sudoPrompt.exec(...args);
            } finally {
                restore("isObject", previous.isObject, owned.isObject);
                restore("isFunction", previous.isFunction, owned.isFunction);
            }
        }
    };

    function restore(name, value, wasOwned) {
        if (wasOwned) util[name] = value;
        else delete util[name];
    }
}

module.exports = { createSudoPromptCompat };
