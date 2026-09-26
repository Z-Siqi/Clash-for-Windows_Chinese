"use strict";

const PROXY_SCRIPT = Symbol("proxy-script");
const PROFILE_SCRIPT = Symbol("profile-script");

function createUserScriptRunner({
    store, axios, yaml, fs, Console, requireFromString,
    notify, showMessageBox, resolveHost
}) {
    function loadScript(script = {}) {
        const code = script?.code || "";
        const file = script?.file || "";
        if (code) return requireFromString(`'use strict';\n${code}`).run;
        if (file) {
            const source = fs.readFileSync(file, "utf8");
            return requireFromString(`'use strict';\n${source}`, file).run;
        }
        return () => "";
    }

    async function run(payload, type) {
        const logPath = await store.dispatch("getScriptLogPath");
        const context = {
            axios,
            yaml,
            homeDir: store.state.app.clashPath,
            console: new Console(fs.createWriteStream(logPath)),
            notify,
            dialog: showMessageBox,
            resolveHost
        };
        let scripts = {};
        const text = store.state.app.settings.scriptsText;
        if (text) try { scripts = yaml.parse(text).scripts || {}; } catch (_error) {}
        if (type === PROXY_SCRIPT) loadScript(scripts.proxy)(payload, context);
        else if (type === PROFILE_SCRIPT) loadScript(scripts.profile)(payload, context);
    }

    return { run };
}

module.exports = { PROFILE_SCRIPT, PROXY_SCRIPT, createUserScriptRunner };
