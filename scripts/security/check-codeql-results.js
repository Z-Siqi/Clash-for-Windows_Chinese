"use strict";

const fs = require("node:fs");
const path = require("node:path");

function inspectCodeqlReport(report) {
    if (report.version !== "2.1.0" || !Array.isArray(report.runs) || report.runs.length === 0) {
        throw new Error("Missing CodeQL analysis runs");
    }
    let rules = 0;
    for (const run of report.runs) {
        if (run.tool?.driver?.name !== "CodeQL" || !Array.isArray(run.results)) {
            throw new Error("Invalid CodeQL report");
        }
        // The CLI puts rules on the driver; the Action groups them by query
        // pack in SARIF extensions. Both are valid CodeQL report formats.
        const queries = [run.tool.driver, ...(run.tool.extensions || [])]
            .flatMap(component => Array.isArray(component.rules) ? component.rules : []);
        if (queries.length === 0) throw new Error("No CodeQL queries ran");
        rules += queries.length;
        if (!Array.isArray(run.invocations) || run.invocations.length === 0) {
            throw new Error("Missing CodeQL invocation status");
        }
        for (const invocation of run.invocations) {
            if (invocation.executionSuccessful !== true ||
                (invocation.toolExecutionNotifications || []).some(item => item.level === "error")) {
                throw new Error("CodeQL extraction or analysis errors remain");
            }
        }
        if (run.results.length > 0) throw new Error(`CodeQL findings remain: ${run.results.length}`);
    }
    return { runs: report.runs.length, rules };
}

function checkDirectory(directory) {
    const files = fs.readdirSync(directory).filter(file => file.endsWith(".sarif"));
    if (files.length === 0) throw new Error("No SARIF reports were produced");
    for (const file of files) {
        const summary = inspectCodeqlReport(JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")));
        console.log(`${file}: ${summary.rules} queries, zero findings, no extraction errors`);
    }
}

if (require.main === module) {
    try { checkDirectory(process.argv[2] || "codeql-results"); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { inspectCodeqlReport, checkDirectory };
