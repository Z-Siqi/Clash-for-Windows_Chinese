"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const parser = require("../../main/node_modules/@babel/parser");

const root = path.resolve(__dirname, "../../..");
const electronRoot = path.join(root, "app/main/dist/electron");

function collectJavaScript(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectJavaScript(target);
        return entry.name.endsWith(".js") ? [target] : [];
    });
}

const files = [
    path.join(electronRoot, "main.js"),
    path.join(electronRoot, "renderer.js"),
    ...collectJavaScript(path.join(electronRoot, "core")),
    ...collectJavaScript(path.join(electronRoot, "features")),
    ...collectJavaScript(path.join(electronRoot, "entry"))
];

function bindingIdentifiers(pattern) {
    if (!pattern) return [];
    if (pattern.type === "Identifier") return [pattern];
    if (pattern.type === "RestElement") return bindingIdentifiers(pattern.argument);
    if (pattern.type === "AssignmentPattern") return bindingIdentifiers(pattern.left);
    if (pattern.type === "ArrayPattern") return pattern.elements.flatMap(bindingIdentifiers);
    if (pattern.type === "ObjectPattern") return pattern.properties.flatMap(property =>
        property.type === "RestElement" ? bindingIdentifiers(property.argument) : bindingIdentifiers(property.value)
    );
    return [];
}

function walk(node, visit) {
    if (!node || typeof node !== "object") return;
    visit(node);
    for (const [key, value] of Object.entries(node)) {
        if (["loc", "start", "end", "extra"].includes(key)) continue;
        if (Array.isArray(value)) value.forEach(child => child?.type && walk(child, visit));
        else if (value?.type) walk(value, visit);
    }
}

for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const result = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8",
        windowsHide: true
    });
    assert.equal(result.status, 0, `${path.relative(root, file)}\n${result.stderr}`);
    assert.doesNotMatch(source, /\bi\(\d+\)|__webpack_require__\(\d+\)|\.mark\(|\.wrap\(/,
        `${path.relative(root, file)} contains generated webpack or regenerator control flow`);

    const ast = parser.parse(source, {
        sourceType: "script",
        plugins: ["optionalChaining", "nullishCoalescingOperator", "objectRestSpread"]
    });
    walk(ast, node => {
        let bindings = [];
        if (node.type === "VariableDeclarator") bindings = bindingIdentifiers(node.id);
        else if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type)) {
            bindings = node.params.flatMap(bindingIdentifiers);
        } else if (node.type === "CatchClause") bindings = bindingIdentifiers(node.param);
        for (const binding of bindings) {
            assert.notEqual(binding.name.length, 1,
                `${path.relative(root, file)}:${binding.loc.start.line} uses unreadable binding '${binding.name}'`);
        }
    });
}

console.log(`JavaScript syntax: PASS (${files.length} files)`);
