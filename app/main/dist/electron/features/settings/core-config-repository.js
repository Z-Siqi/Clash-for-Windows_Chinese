"use strict";

const { writeAtomic } = require("../../core/storage/atomic-file");
const { updateYamlValue } = require("../../core/storage/yaml-file");

function createCoreConfigRepository({ fs, path, yaml, uuid, platform, arch, shouldReplaceWintun }) {
    return {
        load(clashPath) {
            const data = yaml.parse(fs.readFileSync(path.join(clashPath, "config.yaml"), "utf8"), { prettyErrors: true, strict: false });
            if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid core configuration");
            return data;
        },
        async initialize(clashPath, filesPath) {
            fs.mkdirSync(clashPath, { recursive: true });
            const file = path.join(clashPath, "config.yaml");
            const legacy = path.join(clashPath, "config.yml");
            if (fs.existsSync(legacy)) {
                writeAtomic({ fs, path, file, content: fs.readFileSync(legacy, "utf8") });
                fs.unlinkSync(legacy);
            }
            if (fs.existsSync(file) && fs.readFileSync(file, "utf8") !== "") {
                try {
                    const document = yaml.parseDocument(fs.readFileSync(file, "utf8"));
                    if (document.errors.length) throw document.errors[0];
                    if (document.get("mixed-port") === undefined) {
                        const port = document.get("port") || document.get("socks-port") || 7890;
                        const comments = document.contents.items
                            .filter(pair => ["port", "socks-port"].includes(pair.key.value))
                            .flatMap(pair => [pair.key.commentBefore, pair.key.comment, pair.value && pair.value.commentBefore, pair.value && pair.value.comment]);
                        document.commentBefore = [document.commentBefore, ...comments].filter(Boolean).join("\n") || null;
                        document.delete("port"); document.delete("socks-port"); document.set("mixed-port", port);
                        writeAtomic({ fs, path, file, content: document.toString() });
                    }
                } catch (_error) {
                    // Loading reports invalid existing files; initialization must not replace user data.
                }
            } else {
                writeAtomic({ fs, path, file, content: yaml.stringify({
                    "mixed-port": 7890, "allow-lan": false, "external-controller": "127.0.0.1:9090", secret: uuid()
                }) });
            }
            const geoip = path.join(clashPath, "Country.mmdb");
            if (!fs.existsSync(geoip)) fs.copyFileSync(path.join(filesPath, "default/Country.mmdb"), geoip);
            if (platform === "win32") {
                const wintun = path.join(clashPath, "wintun.dll");
                if (await shouldReplaceWintun() && fs.existsSync(wintun)) fs.unlinkSync(wintun);
                if (!fs.existsSync(wintun)) fs.copyFileSync(path.join(filesPath, `win/${arch === "arm" ? "ia32" : arch}/wintun.dll`), wintun);
            }
            fs.mkdirSync(path.join(clashPath, "logs"), { recursive: true });
        },
        async randomizePorts({ clashPath, confData, settings, devMode, lightweightMode, getPort, onChange }) {
            if (devMode || lightweightMode) return;
            for (const [key, enabled] of [["external-controller", settings.randomControllerPort !== false], ["mixed-port", settings.randomMixedPort]]) {
                if (!enabled) continue;
                const port = await getPort();
                if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid generated TCP port");
                const value = key === "external-controller" ? `127.0.0.1:${port}` : port;
                updateYamlValue({ fs, path, yaml, file: path.join(clashPath, "config.yaml"), key, value });
                confData = { ...confData, [key]: value };
                onChange(confData);
            }
        }
    };
}

module.exports = { createCoreConfigRepository };
