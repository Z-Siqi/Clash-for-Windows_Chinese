"use strict";

const SET = Symbol("set");
const INSERT = Symbol("insert");
const DELETE = Symbol("delete");

function parseCommand(command) {
    const path = [];
    let operation = SET;
    let value = "";
    let quoted = false;
    let segment = "";
    for (let index = 0; index < command.length; index++) {
        const character = command[index];
        if (character === "-" && index === command.length - 1) {
            operation = DELETE;
            path.push(segment);
            break;
        }
        if (character === "(") quoted = true;
        else if (character === ")") quoted = false;
        else if (quoted) segment += character;
        else if (character === ".") {
            path.push(segment);
            segment = "";
        } else if (character === "+" || character === "=") {
            if (character === "+") operation = INSERT;
            path.push(segment);
            value = command.slice(index + 1);
            break;
        } else segment += character;
    }
    return { path, operation, value };
}

function generatedNames(value, proxies, groups, shuffle) {
    if (!/^\[\](shuffledProxyNames|proxyNames|groupNames)\|?(.+)?$/.test(value)) return null;
    const source = RegExp.$1 === "groupNames"
        ? groups
        : RegExp.$1 === "shuffledProxyNames" ? shuffle(proxies) : proxies;
    const filter = RegExp.$2 || "";
    return source.map(item => item.name).filter(name => new RegExp(filter).test(name));
}

function applyCommand(config, command, { reduce, shuffle }) {
    const { path, operation, value } = parseCommand(command);
    const proxies = config.proxies || [];
    const groups = config["proxy-groups"] || [];
    const parentPath = path.slice(0, -1);
    const key = path[path.length - 1];
    let parsedValue = value;
    try { parsedValue = JSON.parse(value); } catch (_error) {}
    const parent = reduce(parentPath, (current, part, index) => {
        if (current[part] !== undefined) return current[part];
        if (Array.isArray(current)) {
            const named = current.find(item => item.name === part);
            if (named) return named;
        }
        current[part] = path.length > index + 1 && parseInt(path[index + 1]) >= 0 ? [] : {};
        return current[part];
    }, config);
    const names = generatedNames(parsedValue, proxies, groups, shuffle);
    if (operation === SET) {
        if (names) parent[key] = names;
        else {
            const existingType = typeof parent[key];
            parent[key] = existingType === "number"
                ? 1 * parsedValue
                : existingType === "boolean"
                    ? typeof parsedValue === "boolean" ? parsedValue : parsedValue === "true"
                    : parsedValue;
        }
    } else if (operation === INSERT) {
        if (Array.isArray(parent)) parent.splice(key, 0, ...(names || [parsedValue]));
        else parent[key] = names || parsedValue;
    } else if (Array.isArray(parent)) {
        const index = parseInt(key) > -1 ? key : parent.findIndex(item => item.name === key);
        parent.splice(index, 1);
    } else delete parent[key];
}

function parseSubscriptionInfo(value) {
    const result = {};
    for (const key of ["upload", "download", "total", "expire"]) {
        const match = new RegExp(`${key}=(.+?)(;|$)`).exec(value || "");
        if (match) result[key] = parseInt(match[1].trim());
    }
    return result;
}

function parseHeaderString(value) {
    try {
        return value.split("\n").reduce((headers, line) => {
            const [name, headerValue] = line.split(":");
            headers[name.trim()] = headerValue.trim();
            return headers;
        }, {});
    } catch (_error) { return {}; }
}

function mergeProfileYaml(source, mixin, { yaml, cloneDeep, reduce, shuffle }) {
    const {
        "append-rules": appendRules = [], "prepend-rules": prependRules = [],
        "append-proxies": appendProxies = [], "prepend-proxies": prependProxies = [],
        "append-proxy-groups": appendGroups = [], "prepend-proxy-groups": prependGroups = [],
        "mix-proxy-providers": proxyProviders = {}, "mix-rule-providers": ruleProviders = {},
        "mix-object": mixedObject = {}, commands = [], "key-orders": keyOrders = []
    } = mixin;
    const original = yaml.parse(source);
    const result = cloneDeep(original);
    if (prependRules || appendRules) result.rules = prependRules.concat(original.rules || []).concat(appendRules);
    if (prependProxies || appendProxies) result.proxies = prependProxies.concat(original.proxies || []).concat(appendProxies);
    if (prependGroups || appendGroups) {
        result["proxy-groups"] = prependGroups.concat(original["proxy-groups"] || []).concat(appendGroups);
    }
    if (proxyProviders) result["proxy-providers"] = { ...(original["proxy-providers"] || {}), ...proxyProviders };
    if (ruleProviders) result["rule-providers"] = { ...(original["rule-providers"] || {}), ...ruleProviders };
    for (const command of commands) applyCommand(result, command, { reduce, shuffle });
    const options = {};
    if (keyOrders.length) options.sortMapEntries = (left, right) => {
        const leftIndex = keyOrders.indexOf(left.key.value);
        const rightIndex = keyOrders.indexOf(right.key.value);
        return (leftIndex === -1 ? Infinity : leftIndex) - (rightIndex === -1 ? Infinity : rightIndex);
    };
    return yaml.stringify({ ...result, ...mixedObject }, options);
}

function createProfileParser(dependencies) {
    const {
        store, axios, got, fs, path, yaml, cloneDeep, reduce, shuffle,
        requireFromString, Console, notify, diff3Merge, parseContentDisposition,
        HttpsProxyAgent, getLanguage
    } = dependencies;

    function configuredHeaders(extra = {}) {
        let custom = {};
        const text = store.state.app.settings.headersText;
        if (text) try { custom = yaml.parse(text).headers || {}; } catch (_error) {}
        return { pragma: "no-cache", ...extra, ...custom };
    }

    function directRequest(url, options = {}, headers = {}) {
        return axios.get(url, {
            validateStatus: () => true,
            ...options,
            headers: configuredHeaders(headers),
            responseType: "text",
            transformResponse: [value => value]
        });
    }

    function proxiedRequest(url, options = {}, headers = {}) {
        const { "mixed-port": mixedPort, authentication = [] } = store.state.app.confData;
        const httpsAgent = new HttpsProxyAgent({
            proxy: `http://${authentication.length ? `${authentication[0]}@` : ""}127.0.0.1:${mixedPort}`
        });
        return axios.get(url, {
            validateStatus: () => true,
            ...options,
            headers: configuredHeaders(headers),
            responseType: "text",
            transformResponse: [value => value],
            httpsAgent,
            proxy: false
        });
    }

    async function parseProfile(url, content, logToFile = false) {
        try {
            const files = store.state.app.profiles.files || [];
            const profile = files.find(item => item.url === url) || { url };
            const logPath = await store.dispatch("getParserLogPath");
            const logger = new Console(fs.createWriteStream(logPath));
            const context = {
                axios, yaml, homeDir: store.state.app.clashPath,
                console: logToFile ? logger : console,
                notify(message, title = "", silent = true) { notify(message, title, silent); }
            };
            let parsers = [];
            const parserText = store.state.app.settings.profileParsersText;
            if (parserText) try { parsers = yaml.parse(parserText).parsers || []; } catch (_error) {}
            const matched = parsers.filter(parser => parser.url
                ? parser.url === url
                : parser.reg ? new RegExp(parser.reg).test(url) : false);
            let result = content;
            for (const parser of matched) {
                if (parser.code) {
                    result = await requireFromString(`'use strict';\n${parser.code}`).parse(result, context, profile);
                }
                if (parser.file) {
                    const fileContent = fs.readFileSync(parser.file, "utf-8");
                    if (/\.ya?ml$/.test(parser.file)) {
                        result = mergeProfileYaml(result, yaml.parse(fileContent), { yaml, cloneDeep, reduce, shuffle });
                    } else if (/\.js$/.test(parser.file)) {
                        result = await requireFromString(`'use strict';\n${fileContent}`, parser.file).parse(result, context, profile);
                    }
                }
                if (parser.yaml) {
                    result = mergeProfileYaml(result, parser.yaml, { yaml, cloneDeep, reduce, shuffle });
                }
                if (parser.remote) {
                    if (store.state.app.settings.allowRemoteProfileParsers !== true) {
                        throw new Error("Remote JavaScript profile parsers are disabled for security");
                    }
                    const { url: remoteUrl, cache = false } = parser.remote;
                    if (!remoteUrl) throw new Error("Remote parser url is required");
                    const response = await axios.get(remoteUrl, {
                        headers: { "cache-control": cache ? "max-age=3600" : "no-cache" }
                    });
                    if (response.status !== 200) {
                        throw new Error(`Remote parser download failed with status: ${response.status}`);
                    }
                    result = await requireFromString(`'use strict';\n${response.data}`).parse(result, context, profile);
                }
            }
            return result;
        } catch (error) {
            throw { ...error, message: `[Parser Error] ${error.message}` };
        }
    }

    async function downloadProfile({ url, cancelToken = null, headersString = "" }) {
        const language = getLanguage();
        try {
            const throughProxy = store.state.app.settings.updateProfileThroughClashProxy;
            const response = throughProxy
                ? await proxiedRequest(url, { cancelToken }, parseHeaderString(headersString))
                : await directRequest(url, { cancelToken }, parseHeaderString(headersString));
            const body = response.data;
            const status = response.status;
            const headers = response.headers || {};
            let name = "config.yaml";
            const time = `${Date.now()}.yml`;
            try { name = path.basename(url); } catch (error) { console.error(error.stack); }
            if (/([^/]*?)(?:$|\?)/.test(url)) name = decodeURIComponent(RegExp.$1.trim());
            const interval = parseInt(headers["profile-update-interval"] || 0) || 0;
            const homeWeb = headers["profile-web-page-url"] || "";
            const disposition = headers["content-disposition"];
            const subscription = headers["subscription-userinfo"] || "";
            try {
                const filename = parseContentDisposition(disposition)?.parameters?.filename;
                if (filename) name = filename;
            } catch (_error) {}
            if (status !== 200) {
                return {
                    success: false,
                    message: `${language.downloadProfile()}(${url}) ${language.failedErrorHTTP()}(${status})`
                };
            }
            const parsed = await parseProfile(url, body, true);
            const profiles = store.state.app.profiles.files || [];
            const index = profiles.findIndex(item => item.url === url);
            const profilesPath = store.state.app.profilesPath;
            let targetPath = path.join(profilesPath, time);
            let targetIndex;
            if (index > -1) {
                const existing = profiles[index];
                targetPath = path.join(profilesPath, existing.time);
                store.commit("CHANGE_PROFILE", {
                    index,
                    profile: {
                        ...existing,
                        subInfo: parseSubscriptionInfo(subscription || parsed),
                        homeWeb
                    }
                });
                targetIndex = index;
            } else {
                store.commit("APPEND_PROFILE", {
                    profile: {
                        time, name, url, selected: [], interval,
                        subInfo: parseSubscriptionInfo(subscription || parsed), homeWeb
                    }
                });
                targetIndex = profiles.length;
            }
            const basePath = `${targetPath.slice(0, -4)}.base.yml`;
            const changePath = `${targetPath.slice(0, -4)}.change.yml`;
            let finalContent = parsed;
            if (fs.existsSync(basePath) && fs.existsSync(changePath)) {
                const base = fs.readFileSync(basePath).toString();
                const change = fs.readFileSync(changePath).toString();
                if (/<{7}[\S\s]+?={7}[\S\s]+?>{7}/.test(change)) {
                    return { success: false, message: language.diffChangeContainConflict() };
                }
                const merged = diff3Merge(change, base, parsed, { stringSeparator: /\n|\r\n/ });
                fs.writeFileSync(basePath, parsed);
                fs.writeFileSync(changePath, merged.result.join("\n"));
                if (merged.conflict) return { success: false, message: language.failMergeProfile() };
                finalContent = merged.result.join("\n");
            }
            fs.writeFileSync(targetPath, finalContent || parsed);
            return { success: true, targetIndex };
        } catch (error) {
            console.error(error);
            if (error.message) {
                return {
                    success: false,
                    message: `${language.downloadProfile()}(${url}) ${language.failedWithError()}${error.message}`
                };
            }
            return { success: false, message: language.unknowErr() };
        }
    }

    return { downloadProfile, parseProfile };
}

module.exports = {
    applyCommand,
    createProfileParser,
    mergeProfileYaml,
    parseCommand,
    parseHeaderString,
    parseSubscriptionInfo
};
