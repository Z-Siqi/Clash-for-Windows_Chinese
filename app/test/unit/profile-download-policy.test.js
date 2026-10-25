"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const yaml = require("../../main/node_modules/yaml");
const { DEFAULT_DOWNLOAD_POLICY, readDownloadExceptions, resolveDownloadPolicy } = require("../../main/dist/electron/core/network/profile-download-policy");

const url = "https://subscription.test/profile.yaml?account=example";
const settingsFor = entry => ({ profileDownloadExceptionsText: yaml.stringify({ exceptions: [entry] }) });

test("download exceptions are opt-in and match the entire URL instead of a prefix or hostname", () => {
    assert.equal(resolveDownloadPolicy({ settings: {}, yaml, url }), DEFAULT_DOWNLOAD_POLICY);
    const settings = settingsFor({ url, maxSizeMiB: 64, timeoutSeconds: 180, processingTimeoutSeconds: 600 });
    const policy = resolveDownloadPolicy({ settings, yaml, url });
    assert.equal(policy.maxContentLength, 64 * 1024 * 1024);
    assert.equal(policy.timeout, 180000); assert.equal(policy.workerTimeout, 600000);
    for (const other of [url + "&other=1", url.replace("account=example", "account=other"), url.replace("subscription.test", "subscription.test.evil"), url.replace("https:", "http:")]) {
        assert.equal(resolveDownloadPolicy({ settings, yaml, url: other }), DEFAULT_DOWNLOAD_POLICY);
    }
    assert.equal(resolveDownloadPolicy({ settings: settingsFor({ url, timeoutSeconds: 1800 }), yaml, url }).workerTimeout, 1860000);
    assert.equal(resolveDownloadPolicy({ settings: settingsFor({ url: "http://lan.test/profile", maxSizeMiB: 32 }), yaml, url: "http://lan.test/profile" }).maxContentLength, 32 * 1024 * 1024);
});

test("download exceptions reject unlimited, overflowing, malformed or misspelled policy without losing default protection", () => {
    const badEntries = [null, [], { url: "file:///tmp/profile" }, { url: url + "#fragment" },
        { url, maxSizeMiB: 0 }, { url, maxSizeMiB: -1 }, { url, maxSizeMiB: 257 }, { url, maxSizeMiB: "64" },
        { url, timeoutSeconds: 0 }, { url, timeoutSeconds: 1801 }, { url, timeoutSeconds: Infinity },
        { url, processingTimeoutSeconds: 3601 }, { url, processingTimeoutSeconds: 119.5 }, { url, maxSizeMB: 64 }];
    for (const entry of badEntries) {
        const settings = settingsFor(entry);
        assert.throws(() => readDownloadExceptions({ yaml, text: settings.profileDownloadExceptionsText }));
        assert.equal(resolveDownloadPolicy({ settings, yaml, url }), DEFAULT_DOWNLOAD_POLICY);
    }
    for (const text of ["[broken", "exceptions: invalid", "exceptions: []\nunknown: true", yaml.stringify({ exceptions: Array(129).fill({ url }) })]) {
        assert.throws(() => readDownloadExceptions({ yaml, text }));
        assert.equal(resolveDownloadPolicy({ settings: { profileDownloadExceptionsText: text }, yaml, url }), DEFAULT_DOWNLOAD_POLICY);
    }
});
