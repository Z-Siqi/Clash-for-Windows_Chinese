"use strict";

// renderer.js contains legacy non-UTF-8 bytes. Apply only guarded ASCII byte
// replacements so unrelated webpack/Monaco payloads remain byte-for-byte intact.
const fs = require("node:fs");
const path = require("node:path");

const file = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(file);

function count(needle) {
    let found = 0;
    let offset = 0;
    while ((offset = source.indexOf(needle, offset)) >= 0) {
        found += 1;
        offset += needle.length;
    }
    return found;
}

function replaceOnce(beforeText, afterText) {
    const before = Buffer.from(beforeText, "ascii");
    const after = Buffer.from(afterText, "ascii");
    if (count(after) === 1) return;
    if (count(before) !== 1) {
        throw new Error(`Expected one renderer anchor: ${beforeText.slice(0, 80)}`);
    }
    const index = source.indexOf(before);
    source = Buffer.concat([
        source.subarray(0, index),
        after,
        source.subarray(index + before.length)
    ]);
}

replaceOnce(
    'const { normalizeCoreVersion, normalizeStructuredLog, parseCoreLogLine, normalizeConnectionsSnapshot } = require("./features/clash-core/core-api-compat");',
    'const { normalizeCoreVersion, normalizeStructuredLog, parseCoreLogLine, normalizeConnectionsSnapshot } = require("./features/clash-core/core-api-compat");\nconst { parsePort, buildDashboardUrl } = require("./features/clash-core/general-settings");'
);
replaceOnce(
    'return /^\\d+$/.test(e) && 1 * e >= 0 && 1 * e <= 65353 ? "" : "Port must be an integer between 0 to 65353"',
    'return null !== parsePort(e) ? "" : "Port must be an integer between 1 and 65535"'
);
replaceOnce(
    'if (n = t.sent, !(o = n.port)) {',
    'if (n = t.sent, null === (o = parsePort(n.port))) {'
);
replaceOnce(
    'return e.port = 1 * o, t.next = 14, (0, R.F0)(g().join(e.clashPath, "config.yaml"), "mixed-port", 1 * o);',
    'return e.port = o, e.settings.randomMixedPort = !1, t.next = 14, (0, R.F0)(g().join(e.clashPath, "config.yaml"), "mixed-port", o);'
);
replaceOnce(
    'P.shell.openExternal("https://clash.razord.top/#/?host=127.0.0.1&port=".concat(this.controllerPort, "&secret=").concat(encodeURIComponent(this.secret)))',
    'P.shell.openExternal(buildDashboardUrl({ controllerPort: this.controllerPort, secret: this.secret }))'
);

fs.writeFileSync(file, source);
console.log("General settings renderer integration applied.");
