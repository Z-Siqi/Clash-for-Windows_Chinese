"use strict";

function createUpdateRuntime({
    isMacOS,
    path,
    ipcRenderer,
    store,
    execSync
}) {
    const updateFilename = `cfw-update${isMacOS ? ".dmg" : ".exe"}`;

    async function download(url) {
        const tempPath = await ipcRenderer.invoke("app", "getPath", "temp");
        const target = path.join(tempPath, updateFilename);
        await ipcRenderer.invoke("start-download", url, target);
        store.commit("SET_UPDATE_DOWNLOAD_PROGRESS", { progress: 0.01 });
        return new Promise((resolve, reject) => {
            const onDownload = (_event, state, value) => {
                if (state === "downloading") {
                    store.commit("SET_UPDATE_DOWNLOAD_PROGRESS", { progress: value });
                    return;
                }
                if (state !== "completed" && state !== "failed") return;
                ipcRenderer.removeListener?.("download", onDownload);
                store.commit("SET_UPDATE_DOWNLOAD_PROGRESS", { progress: null });
                if (state === "completed") resolve(target);
                else reject(value);
            };
            ipcRenderer.on("download", onDownload);
        });
    }

    async function install(url) {
        const target = await download(url);
        if (!target) return target;
        if (isMacOS) {
            const applicationName = await ipcRenderer.invoke("app", "getName");
            const output = execSync(`hdiutil attach '${target}' -nobrowse`).toString();
            if (/\/Volumes\/(Clash for Windows.+?)\n/.test(output)) {
                const volume = RegExp.$1;
                execSync(`rm -rf '/Applications/${applicationName}.app' && cp -R '/Volumes/${volume}/${applicationName}.app' '/Applications/${applicationName}.app'`);
                execSync(`hdiutil eject '/Volumes/${volume}'`, { stdio: ["ignore", "ignore", "ignore"] });
            }
        }
        return target;
    }

    return { download, install };
}

module.exports = { createUpdateRuntime };
