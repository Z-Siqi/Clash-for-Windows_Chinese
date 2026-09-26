"use strict";

const { execFileSync } = require("child_process");

function fixShellPath(platform = process.platform) {
    if (platform !== "darwin") return;
    for (const shell of ["/bin/zsh", "/bin/bash"]) {
        try {
            const value = execFileSync(shell, ["-ilc", "printf %s \"$PATH\""], {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
                timeout: 5000
            }).trim();
            if (value) {
                process.env.PATH = value;
                return;
            }
        } catch (_error) {}
    }
    const fallback = ["./node_modules/.bin", "/opt/homebrew/bin", "/usr/local/bin"];
    process.env.PATH = [...fallback, process.env.PATH || ""].filter(Boolean).join(":");
}

module.exports = fixShellPath;
