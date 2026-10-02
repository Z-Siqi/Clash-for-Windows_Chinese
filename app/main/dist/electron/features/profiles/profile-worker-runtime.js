"use strict";

const { createProfileParser } = require("./profile-parser");

function createProfileWorkerRuntime({ parentPort, parserDependencies, createLanguage }) {
    parentPort.on("message", async event => {
        const message = event.data;
        if (message.type !== "download") return;
        try {
            const mutations = [];
            const store = {
                state: { app: message.app }, dispatch: async () => message.logPath,
                commit(type, payload) { mutations.push({ type, payload }); }
            };
            const parser = createProfileParser({
                ...parserDependencies, store, getLanguage: () => createLanguage(message.language),
                notify: (title, body, silent) => parentPort.postMessage({ type: "notify", title, body, silent })
            });
            const result = await parser.downloadProfile({ url: message.url, headersString: message.headersString });
            parentPort.postMessage({ type: "result", ok: true, value: { result, mutations } });
        } catch (_error) {
            parentPort.postMessage({ type: "result", ok: false });
        }
    });
}

module.exports = { createProfileWorkerRuntime };
