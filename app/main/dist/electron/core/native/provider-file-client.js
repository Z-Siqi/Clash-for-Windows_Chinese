"use strict";

function createProviderFileClient({ ipcRenderer, getHome }) {
    async function call(operation, request) {
        const result = await ipcRenderer.invoke("provider-file", operation, { home: getHome(), ...request });
        if (!result?.ok) throw new Error(result?.error || "Provider file operation failed");
        return result.value;
    }
    return {
        read: (kind, name) => call("read", { kind, name }),
        write: (kind, name, source) => call("write", { kind, name, source }),
        open: (kind, name) => call("open", { kind, name }),
        findCache: hash => call("find-cache", { hash }),
        revealCache: hash => call("reveal-cache", { hash })
    };
}

module.exports = { createProviderFileClient };
