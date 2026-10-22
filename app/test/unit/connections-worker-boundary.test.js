"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

test("Connections worker ignores foreign origins and malformed envelopes without mutating its model", () => {
    const file = path.resolve(__dirname, "../../main/dist/electron/entry/worker/connections.js");
    const responses = [];
    const self = { postMessage: data => responses.push(data) };
    vm.runInNewContext(fs.readFileSync(file, "utf8"), { self, require: createRequire(file) });
    for (const origin of ["https://foreign.invalid", "null", undefined]) {
        self.onmessage({ origin, data: { id: 1, payload: { connections: [{}] }, query: {} } });
    }
    for (const data of [null, "message", {}, { id: "1" }, { id: 0 }, { id: -1 }]) self.onmessage({ origin: "", data });
    assert.equal(responses.length, 0);
    self.onmessage({ origin: "", data: { id: 2, query: {} } });
    assert.equal(responses.length, 1);
    assert.equal(responses[0].view.total, 0);
    self.onmessage({ origin: "https://foreign.invalid", data: { id: 3, operation: "closeBatch" } });
    assert.equal(responses.length, 1);
});
