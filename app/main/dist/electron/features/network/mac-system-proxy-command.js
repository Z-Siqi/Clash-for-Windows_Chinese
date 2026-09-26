"use strict";

function createMacSystemProxyCommand({
    platform,
    arch,
    path,
    serviceApi,
    isDevelopmentMode,
    getFilesPath
}) {
    return async function runMacSystemProxyCommand(args = []) {
        if (platform !== "darwin") return false;

        const filesPath = isDevelopmentMode()
            ? path.join(path.resolve("./"), "static", "files")
            : getFilesPath();
        const binaryArch = arch === "arm64" ? "arm64" : "x64";
        const binary = path.join(filesPath, "darwin", binaryArch, "sysproxy");
        try {
            const response = await serviceApi.systemProxy(binary, args);
            return {
                success: response.status === 200,
                output: response.data
            };
        } catch (_error) {
            return { success: false, output: "" };
        }
    };
}

module.exports = { createMacSystemProxyCommand };
