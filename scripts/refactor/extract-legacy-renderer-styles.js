"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const rendererPath = path.join(root, "app/main/dist/electron/renderer.js");
const outputPath = path.join(root, "app/main/dist/electron/styles.css");
const source = fs.readFileSync(rendererPath, "utf8");
const pattern = /\.push\(\[e\.id,\s*(`(?:\\.|[^`])*`|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'),\s*""\]\)/gs;
const blocks = [];

for (const match of source.matchAll(pattern)) {
    const expression = match[1];
    let font = "";
    if (expression.includes("Material Icons")) font = "./fonts/MaterialIcons-Regular..woff2";
    if (expression.includes("TwemojiMozilla")) font = "./fonts/TwemojiMozilla..ttf";
    blocks.push(Function("h", `return ${expression}`)(font));
}

if (blocks.length !== 69) {
    throw new Error(`Expected 69 legacy style blocks, found ${blocks.length}`);
}
fs.writeFileSync(outputPath, `${blocks.join("\n\n")}\n`);
console.log(`Extracted ${blocks.length} readable style blocks to ${path.relative(root, outputPath)}`);
