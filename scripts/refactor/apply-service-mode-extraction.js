"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath).toString("latin1");

const importAnchor = 'const { createSystemProxyRuntime } = require("./features/network/system-proxy-runtime");';
if (!source.includes(importAnchor)) throw new Error("service-mode import anchor not found");
source = source.replace(
    importAnchor,
    `${importAnchor}\nconst { createServiceModeManager } = require("./features/service-mode/service-mode-manager");`
);

function wrapper(id, platform, clientExpression, extra = "") {
    return `            ${id}: (e, t, i) => {
                "use strict";
                var store = i(59273).Z,
                    fileSystem = i(57147),
                    paths = i(71017),
                    utilities = i(8369),
                    manager = createServiceModeManager({
                        platform: "${platform}",
                        arch: process.arch,
                        fs: fileSystem,
                        path: paths,
                        sudoExec: i(72378).exec,
                        serviceApi: createClashServiceApi({ client: ${clientExpression} }),
                        getFilesPath: function() { return store.getters.filesPath },
                        getClashPath: function() { return store.state.app.clashPath },
                        hashFile: function(file) { return utilities.Ll(fileSystem.readFileSync(file)) }${extra}
                    });
                i.r(t), i.d(t, {
                    installService: () => manager.installService,
                    needUpdate: () => manager.needUpdate,
                    status: () => manager.status,
                    statusService: () => manager.statusService,
                    uninstallService: () => manager.uninstallService,
                    updateService: () => manager.updateService
                })
            },
`;
}

function replaceModule(id, nextId, replacement) {
    const startAnchor = `            ${id}: (e, t, i) => {`;
    const endAnchor = `            ${nextId}: (e, t, i) => {`;
    const start = source.indexOf(startAnchor);
    const end = source.indexOf(endAnchor, start);
    if (start < 0 || end < 0) throw new Error(`module ${id} range not found`);
    source = source.slice(0, start) + replacement + source.slice(end);
}

replaceModule("44224", "33130", wrapper("44224", "darwin", "i(54387)"));
replaceModule(
    "33130",
    "34668",
    wrapper(
        "33130",
        "linux",
        "i(54387)",
        ',\n                        getTempPath: function() { return i(72298).ipcRenderer.invoke("app", "getPath", "temp") }'
    )
);
replaceModule("34668", "58511", wrapper("34668", "win32", "i.n(i(54387))()"));

fs.writeFileSync(rendererPath, Buffer.from(source, "latin1"));
console.log("service mode extraction applied");
