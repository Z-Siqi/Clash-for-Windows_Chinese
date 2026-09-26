"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath).toString("latin1");
const before = '                    }), e._v(" " + Lg.skipCertVerify())])]), e._v(" "), "vmess" === e.proxyType ? t("div", {';
const after = '                    }), e._v(" " + Lg.skipCertVerify())])]) : e._e(), e._v(" "), "vmess" === e.proxyType ? t("div", {';
if (source.includes(before)) source = source.replace(before, after);
else if (!source.includes(after)) throw new Error("Expected AnyTLS render branch was not found");
const oldComment = "case 52: //TODO: Support meta (/.config/clash -> /.config/mihomo)";
const newComment = "case 52: // Clash and Mihomo intentionally share the existing CFW home directory.";
if (source.includes(oldComment)) source = source.replace(oldComment, newComment);
else if (!source.includes(newComment)) throw new Error("Expected core home directory comment was not found");
fs.writeFileSync(rendererPath, Buffer.from(source, "latin1"));
console.log("AnyTLS render branch fixed");
