"use strict";

const { targets, prepareMihomo, updateMihomo } = require("./mihomo-dependency");

async function main(args = process.argv.slice(2)) {
    const [command, ...options] = args;
    if (command === "update" && options.length === 1) {
        const manifest = await updateMihomo(options[0].replace(/^v/, ""));
        console.log(`Locked Mihomo ${manifest.version} for ${manifest.targets.length} targets. Review the manifest, notices and service allow-lists before committing.`);
        return;
    }
    if (command === "prepare") {
        const targetNames = [];
        let all = false;
        let offline = process.env.CFW_MIHOMO_OFFLINE === "1";
        for (let index = 0; index < options.length; index++) {
            if (options[index] === "--all") all = true;
            else if (options[index] === "--offline") offline = true;
            else if (options[index] === "--target" && options[index + 1]) targetNames.push(options[++index]);
            else throw new Error(`Unknown Mihomo preparation option: ${options[index]}`);
        }
        if (all && targetNames.length) throw new Error("Use --all or --target, not both");
        if (!all && !targetNames.length) {
            const host = Object.keys(targets).find(name => targets[name].platform === process.platform && targets[name].arch === process.arch);
            if (!host) throw new Error(`Unsupported Mihomo host: ${process.platform}/${process.arch}; specify --target`);
            targetNames.push(host);
        }
        const manifest = await prepareMihomo({ targetNames: all ? Object.keys(targets) : targetNames, offline });
        console.log(`Mihomo ${manifest.version}: dependencies verified and ready`);
        return;
    }
    throw new Error("Usage: mihomo.js prepare [--all | --target <target>] [--offline], or mihomo.js update <exact-version>");
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
