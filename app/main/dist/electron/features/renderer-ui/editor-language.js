"use strict";

function installEditorLanguage({ monaco, axios, fs, path, store, hashText, showMessageBox, shell, clipboard, labels }) {
    const scrollPositions = new Map();
    const kinds = monaco.languages.CompletionItemKind;
    const insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
    async function suggestions(source, range, section) {
        try {
            const groups = source.split(/\r?\n/).reduce((items, line) => {
                const match = line.match(/name:\s"?(.+?)"?$/);
                if (match?.[1]) items.push(match[1]);
                return items;
            }, ["DIRECT", "REJECT", "GLOBAL"]);
            const fetch = name => axios.get(`https://raw.githubusercontent.com/Fndroid/clash-vscode/master/snippets/${name}.code-snippets`, { validateStatus: () => true });
            let response = await fetch(section);
            if (response.status !== 200) response = await fetch("top");
            const snippets = response.status === 200 ? response.data : {};
            const items = Object.values(snippets).map(snippet => {
                const body = typeof snippet.body === "string" ? snippet.body : snippet.body?.join("\n");
                return {
                    label: snippet.prefix, kind: kinds.Snippet,
                    insertText: section === "rules" ? body.replace(/\:policy/g, `|${groups.join(",").replace(/\|/g, "\\\\")}|`) : body,
                    insertTextRules, range
                };
            });
            return ["rules", "proxy-groups"].includes(section)
                ? [...items, ...groups.map(label => ({ label, kind: kinds.Keyword, insertText: label, insertTextRules }))]
                : items;
        } catch (_error) { return []; }
    }
    monaco.languages.registerCompletionItemProvider("yaml", {
        async provideCompletionItems(model, position) {
            const prefix = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
            const word = model.getWordUntilPosition(position);
            const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
            const sections = [...(`\n${prefix}`).matchAll(/\n(\S+?)\s*:/g)];
            const section = word.startColumn === 1 || !sections.length ? "top" : sections[sections.length - 1][1];
            return { suggestions: await suggestions(model.getValue(), range, section) };
        }
    });
    monaco.languages.registerCodeLensProvider("yaml", {
        async provideCodeLenses(model) {
            const lenses = [];
            for (let line = 1; line <= model.getLineCount(); line++) {
                const match = model.getLineContent(line).match(/url:\s(.+?)$/);
                if (!match) continue;
                const url = match[1].replace(/^[" ']+|[" ']+$/g, "");
                const hash = hashText(url);
                const providerPath = type => path.join(store.state.app.clashPath, "providers", type, `${hash}.yaml`);
                const proxy = providerPath("proxy"), rule = providerPath("rule");
                const file = fs.existsSync(proxy) ? proxy : fs.existsSync(rule) ? rule : "";
                lenses.push({
                    range: { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: 1 }, id: line,
                    command: file ? { id: "openFile", title: labels.showActualFile(), arguments: [file] }
                        : { id: "copyURLMD5", title: labels.copyURLAndMD5(), arguments: [hash] }
                });
            }
            return { lenses, dispose() {} };
        }
    });
    monaco.editor.registerCommand("openFile", async (_commandContext, file) => { shell.showItemInFolder(file); });
    monaco.editor.registerCommand("copyURLMD5", async (_commandContext, hash) => {
        clipboard.writeText(`${hash}.yaml`);
        showMessageBox({ title: "MD5 Copied", message: `MD5: ${hash}` });
    });
    return {
        saveScrollPosition: (key, value) => scrollPositions.set(key, value),
        getScrollPosition: key => scrollPositions.get(key) || 0
    };
}

module.exports = { installEditorLanguage };
