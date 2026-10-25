"use strict";

const { writeAtomic } = require("../../core/storage/atomic-file");

function createAutoLaunch({ ipcRenderer }) {
    return enabled => ipcRenderer.invoke("app", "setLoginItemSettings", { openAtLogin: enabled });
}

function createLoginItemRuntime({ platform, app, fs, path }) {
    return async function setAutoLaunch(enabled) {
        if (platform !== "linux") return app.setLoginItemSettings({ openAtLogin: enabled });
        const version = app.getVersion();
        const executable = app.getPath("exe");
        const home = app.getPath("home");
        if (/[\x00-\x1f]/.test(executable) || /[\r\n]/.test(version)) throw new Error("Invalid autostart metadata");
        const escapedExecutable = Array.from(executable, character => character === "%" ? "%%" : ["\\", '"', "`", "$"].includes(character) ? `\\${character}` : character).join("");
        const directory = path.join(home, ".config", "autostart");
        const file = path.join(directory, "cfw.desktop");
        const content = `[Desktop Entry]\nType=Application\nVersion=${version}\nName=Clash for Windows\nComment=Clash for Windows startup script\nExec="${escapedExecutable}"\nStartupNotify=false\nTerminal=false\n`;
        if (enabled) {
            fs.mkdirSync(directory, { recursive: true });
            writeAtomic({ fs, path, file, content });
        } else if (fs.existsSync(file)) fs.unlinkSync(file);
    };
}

module.exports = { createAutoLaunch, createLoginItemRuntime };
