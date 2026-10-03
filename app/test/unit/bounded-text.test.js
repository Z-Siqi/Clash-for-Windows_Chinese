"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readBoundedText } = require("../../main/dist/electron/core/storage/read-bounded-text");

test("bounded text reads reject files that grow after descriptor validation and close the descriptor", t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-bounded-text-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const file = path.join(root, "file.txt");
    fs.writeFileSync(file, "small");
    assert.equal(readBoundedText({ fs, file, maxBytes: 8 }), "small");
    let closed = false;
    const growing = { ...fs,
        fstatSync(fd) { const stat = fs.fstatSync(fd); fs.appendFileSync(file, "now oversized"); return stat; },
        closeSync(fd) { closed = true; fs.closeSync(fd); }
    };
    assert.throws(() => readBoundedText({ fs: growing, file, maxBytes: 8 }), /grew/);
    assert.equal(closed, true);
    assert.throws(() => readBoundedText({ fs, file, maxBytes: 8 }), /oversized/);
});

test("bounded text reads refuse final symlinks on POSIX", { skip: process.platform === "win32" }, t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-bounded-link-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const file = path.join(root, "file"), link = path.join(root, "link");
    fs.writeFileSync(file, "content"); fs.symlinkSync(file, link);
    assert.throws(() => readBoundedText({ fs, file: link }), /ELOOP/);
});
