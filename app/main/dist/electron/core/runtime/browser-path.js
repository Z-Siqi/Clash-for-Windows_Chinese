"use strict";

function createBrowserPath({ platform, cwd }) {
    const windows = platform === "win32", sep = windows ? "\\" : "/";
    function slash(value) {
        if (typeof value !== "string") throw new TypeError("Path must be a string");
        return windows ? value.replace(/\\/g, "/") : value;
    }
    function root(value) {
        if (!windows) return value.startsWith("/") ? "/" : "";
        const unc = value.match(/^\/\/[^/]+\/[^/]+(?:\/|$)/);
        if (unc) return unc[0].replace(/\/?$/, "/");
        const drive = value.match(/^[a-z]:\//i);
        return drive ? drive[0] : value.startsWith("/") ? "/" : "";
    }
    function normalize(value) {
        const input = slash(value), prefix = root(input), segments = [];
        for (const segment of input.slice(prefix.length).split("/")) {
            if (!segment || segment === ".") continue;
            if (segment === ".." && segments.length && segments.at(-1) !== "..") segments.pop();
            else if (segment !== ".." || !prefix) segments.push(segment);
        }
        let result = prefix + segments.join("/");
        if (!result) result = ".";
        if (input.endsWith("/") && result !== "." && !result.endsWith("/")) result += "/";
        return windows ? result.replace(/\//g, "\\") : result;
    }
    function join(...values) { return normalize(values.filter(value => { slash(value); return value !== ""; }).join(sep)); }
    function resolve(...values) {
        let selected = "";
        for (let index = values.length - 1; index >= -1; index--) {
            const current = slash(index < 0 ? cwd : values[index]);
            if (!current) continue;
            selected = current + (selected ? "/" + selected : "");
            if (root(current)) break;
        }
        let result = slash(normalize(selected));
        // Root-relative Windows paths inherit the current drive or UNC volume.
        if (windows && root(result) === "/") {
            const base = root(slash(cwd));
            result = base.replace(/\/$/, "") + result;
        }
        if (result.length > root(result).length) result = result.replace(/\/+$/, "");
        return windows ? result.replace(/\//g, "\\") : result;
    }
    function basename(value, suffix = "") {
        const input = slash(value).replace(/\/+$/, "");
        const name = input.slice(Math.max(input.lastIndexOf("/") + 1, windows && /^[a-z]:/i.test(input) ? 2 : 0));
        return suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
    }
    function dirname(value) {
        const input = slash(value), prefix = root(input);
        const trimmed = input.slice(prefix.length).replace(/\/+$/, "");
        const index = trimmed.lastIndexOf("/");
        if (index < 0) return prefix ? value.slice(0, prefix.length) : ".";
        const end = prefix.length + trimmed.slice(0, index).replace(/\/+$/, "").length;
        return value.slice(0, end);
    }
    return { sep, join, resolve, normalize, dirname, basename, isAbsolute: value => Boolean(root(slash(value))), extname(value) {
        const name = basename(value), index = name.lastIndexOf(".");
        return index <= 0 || name === ".." ? "" : name.slice(index);
    } };
}

module.exports = { createBrowserPath };
