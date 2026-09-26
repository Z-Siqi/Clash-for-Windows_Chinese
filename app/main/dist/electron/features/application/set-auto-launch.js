"use strict";

function createAutoLaunch({ platform, ipcRenderer, fs, path }) {
    return async function setAutoLaunch(enabled) {
        if (platform !== "linux") return ipcRenderer.invoke("app", "setLoginItemSettings", { openAtLogin: enabled });
        const [version, executable, home] = await Promise.all([
            ["getVersion"], ["getPath", "exe"], ["getPath", "home"]
        ].map(args => ipcRenderer.invoke("app", ...args)));
        const directory = path.join(home, ".config", "autostart");
        const file = path.join(directory, "cfw.desktop");
        const content = `[Desktop Entry]\n    Type=Application\n    Version=${version}\n    Name=Clash for Windows\n    Comment=Clash for Windows startup script\n    Exec="${executable}"\n    StartupNotify=false\n    Terminal=false`;
        if (enabled) {
            if (!fs.existsSync(directory)) fs.mkdirSync(directory);
            fs.writeFileSync(file, content);
        } else if (fs.existsSync(file)) fs.unlinkSync(file);
    };
}

module.exports = { createAutoLaunch };
