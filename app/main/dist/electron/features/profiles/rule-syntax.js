"use strict";

// Logical rules contain commas inside their parenthesized expression. Keep the
// original text as the save representation, including syntax this UI cannot edit.
function splitRuleFields(text) {
    if (!["AND", "OR", "NOT", "SUB-RULE"].includes(text.slice(0, text.indexOf(",")).trim())) return text.split(",");
    const fields = [];
    let depth = 0, start = 0;
    for (let index = 0; index < text.length; index++) {
        if (text[index] === "\\") { index++; continue; }
        if (text[index] === "(") depth++;
        else if (text[index] === ")") depth--;
        else if (text[index] === "," && depth === 0) {
            fields.push(text.slice(start, index));
            start = index + 1;
        }
    }
    fields.push(text.slice(start));
    return fields;
}

function parseRule(raw) {
    const fields = typeof raw === "string" ? splitRuleFields(raw) : [];
    const short = ["MATCH", "FINAL"].includes(fields[0]?.trim());
    return {
        raw,
        type: fields[0]?.trim() || "",
        payload: short ? "" : fields[1]?.trim() || "",
        proxy: fields[short ? 1 : 2]?.trim() || "",
        params: fields.length > (short ? 2 : 3) ? `,${fields.slice(short ? 2 : 3).join(",")}` : ""
    };
}

function serializeRule(rule) {
    if (Object.prototype.hasOwnProperty.call(rule, "raw")) return rule.raw;
    return [rule.type, ...(rule.payload ? [rule.payload] : []), rule.proxy].join(",") + (rule.params || "");
}

function renameRuleTarget(rule, from, to) {
    if (typeof rule !== "string" || from === to) return rule;
    const fields = splitRuleFields(rule);
    // SUB-RULE targets a separate rule namespace, not a proxy or proxy group.
    if (fields[0]?.trim() === "SUB-RULE") return rule;
    const index = ["MATCH", "FINAL"].includes(fields[0]?.trim()) ? 1 : 2;
    if (fields[index]?.trim() !== from) return rule;
    fields[index] = fields[index].replace(/^(\s*).*?(\s*)$/, (_match, leading, trailing) => `${leading}${to}${trailing}`);
    return fields.join(",");
}

module.exports = { parseRule, serializeRule, renameRuleTarget };
