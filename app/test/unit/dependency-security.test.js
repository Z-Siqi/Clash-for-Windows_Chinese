"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { SourceMapConsumer } = require("../../main/node_modules/source-map-js");

test("indexed source maps reject offsets that would amplify tiny inputs into excessive work", () => {
    const leaf = { version: 3, sources: ["source.js"], names: [], mappings: "AAAA" };
    const indexed = (line, map = leaf) => ({ version: 3, sections: [{ offset: { line, column: 0 }, map }] });
    for (const line of [-1, 0.5, "1", Infinity, 2147483647]) {
        assert.throws(() => new SourceMapConsumer(indexed(line)), /offset|integers/i);
    }
    assert.throws(() => new SourceMapConsumer(indexed(6000000, indexed(6000000))), /offset/i);
    const consumer = new SourceMapConsumer(indexed(2));
    assert.deepEqual(consumer.sources, ["source.js"]);
});
