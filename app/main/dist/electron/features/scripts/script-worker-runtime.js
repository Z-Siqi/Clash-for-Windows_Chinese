"use strict";

const { createUserScriptRunner, PROFILE_SCRIPT, PROXY_SCRIPT } = require("./user-script-runner");

function createScriptWorkerRuntime({ parentPort, axios, yaml, fs, Console, requireFromString }) {
    let sequence = 0;
    const pending = new Map();
    const clicks = new Map();
    function effect(job, method, args, onClick) {
        const id = ++sequence;
        if (onClick) clicks.set(id, onClick);
        return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            parentPort.postMessage({ type: "effect", job, id, method, args });
        });
    }
    parentPort.on("message", async event => {
        const message = event.data;
        if (message.type === "effect-result") {
            const result = pending.get(message.id);
            if (!result) return;
            pending.delete(message.id);
            message.ok ? result.resolve(message.value) : result.reject(new Error("Script context operation failed"));
            return;
        }
        if (message.type === "notification-click") {
            clicks.get(message.id)?.();
            clicks.delete(message.id);
            return;
        }
        if (message.type !== "run") return;
        try {
            if (message.scriptType === "tray") {
                const value = await requireFromString(`'use strict';\n${message.trayCode}`, message.trayPath).run();
                parentPort.postMessage({ type: "result", job: message.job, ok: true, value });
                return;
            }
            if (message.scriptType === "mixin") {
                const value = await requireFromString(message.mixinCode).parse(message.payload, {
                    axios, yaml,
                    notify: (title, body = "", silent = true) => {
                        effect(message.job, "notify", [title, body, { silent }]).catch(() => {});
                    }
                });
                parentPort.postMessage({ type: "result", job: message.job, ok: true, value });
                return;
            }
            const runner = createUserScriptRunner({
                store: {
                    state: { app: { clashPath: message.home, settings: { scriptsText: message.scriptsText } } },
                    dispatch: async () => message.logPath
                }, axios, yaml, fs, Console, requireFromString,
                notify: (title, body, options, onClick) => {
                    effect(message.job, "notify", [title, body, options], onClick).catch(() => {});
                },
                showMessageBox: options => effect(message.job, "dialog", [options]),
                resolveHost: (name, type) => effect(message.job, "resolveHost", [name, type])
            });
            await runner.run(message.payload, message.scriptType === "profile" ? PROFILE_SCRIPT : PROXY_SCRIPT);
            parentPort.postMessage({ type: "result", job: message.job, ok: true });
        } catch (_error) {
            parentPort.postMessage({ type: "result", job: message.job, ok: false });
        }
    });
}

module.exports = { createScriptWorkerRuntime };
