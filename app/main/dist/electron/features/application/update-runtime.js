"use strict";

function createUpdateRuntime({
    isMacOS,
    path,
    ipcRenderer,
    store,
    execFileSync
}) {
    async function download(url) {
        return new Promise((resolve, reject) => {
            let terminalState;
            let target;
            const complete = () => {
                if (terminalState === "completed" && target) resolve(target);
            };
            const onDownload = (_event, state, value) => {
                if (state === "downloading") {
                    store.commit("SET_UPDATE_DOWNLOAD_PROGRESS", { progress: value });
                    return;
                }
                if (state !== "completed" && state !== "failed") return;
                ipcRenderer.removeListener?.("download", onDownload);
                store.commit("SET_UPDATE_DOWNLOAD_PROGRESS", { progress: null });
                terminalState = state;
                if (state === "completed") complete();
                else reject(value);
            };
            ipcRenderer.on("download", onDownload);
            ipcRenderer.invoke("start-download", url).then(value => {
                target = value;
                if (!terminalState) store.commit("SET_UPDATE_DOWNLOAD_PROGRESS", { progress: 0.01 });
                complete();
            }, error => {
                ipcRenderer.removeListener?.("download", onDownload);
                reject(error);
            });
        });
    }

    async function install(url) {
        const target = await download(url);
        if (!target) return target;
        if (isMacOS) {
            const applicationName = await ipcRenderer.invoke("app", "getName");
            const output = execFileSync("hdiutil", ["attach", target, "-nobrowse"]).toString();
            if (/\/Volumes\/(Clash for Windows.+?)\n/.test(output)) {
                const volume = RegExp.$1;
                if (applicationName !== "Clash for Windows" || /[\/\\\0]/.test(volume)) throw new Error("Invalid update mount");
                execFileSync("cp", ["-R", `/Volumes/${volume}/${applicationName}.app`, "/Applications/"]);
                execFileSync("hdiutil", ["eject", `/Volumes/${volume}`], { stdio: ["ignore", "ignore", "ignore"] });
            }
        }
        return target;
    }

    return { download, install };
}

module.exports = { createUpdateRuntime };
