"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");
const esbuild = require("esbuild");

test("browser time formatting supports both UI languages without Node locale loading or a global locale change", () => {
    const bundle = esbuild.buildSync({
        entryPoints: [path.resolve(__dirname, "../../main/dist/electron/core/i18n/moment.js")],
        bundle: true, platform: "browser", format: "iife", globalName: "dateTime", write: false
    });
    const browser = {};
    vm.runInNewContext(bundle.outputFiles[0].text, browser);
    const moment = browser.dateTime;
    assert.equal(moment.locale(), "en");
    assert.ok(moment.locales().includes("zh-cn"));
    const now = moment("2026-10-22T12:00:00Z");
    const cases = [
        [30, "seconds", "几秒前", "a few seconds ago"],
        [1, "minute", "1 分钟前", "a minute ago"],
        [5, "minutes", "5 分钟前", "5 minutes ago"],
        [2, "hours", "2 小时前", "2 hours ago"],
        [3, "days", "3 天前", "3 days ago"],
        [2, "months", "2 个月前", "2 months ago"],
        [2, "years", "2 年前", "2 years ago"]
    ];
    for (const [amount, unit, chinese, english] of cases) {
        const updated = now.clone().subtract(amount, unit);
        for (const [locale, expected] of [["zh-cn", chinese], ["en-us", english], ["zh-cn", chinese]]) {
            assert.equal(updated.clone().locale(locale).from(now), expected);
            assert.equal(moment.locale(), "en");
        }
    }
});
