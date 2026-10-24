"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Cron = require("../../main/node_modules/unix-cron");
const { matchesCron } = require("../../main/dist/electron/core/time/cron-match");

test("UNIX Sunday 7 works without changing range steps, other weekdays, months or saved expressions", () => {
    const sunday = new Date(2026, 9, 25), saturday = new Date(2026, 9, 24), monday = new Date(2026, 9, 26);
    for (const weekday of ["7", "0", "SUN", "5-7", "7-7", "1,7"]) {
        const expression = `0 0 * * ${weekday}`;
        assert.equal(matchesCron(Cron, expression, sunday), true, expression);
        assert.equal(expression, `0 0 * * ${weekday}`);
    }
    assert.equal(matchesCron(Cron, "0 0 * * 7", monday), false);
    assert.equal(matchesCron(Cron, "0 0 * * 6-7/2", sunday), false);
    assert.equal(matchesCron(Cron, "0 0 * * 6-7/2", saturday), true);
    assert.equal(matchesCron(Cron, "0 0 * 7 7", sunday), false);
    assert.equal(matchesCron(Cron, "0 0 * 7 7", new Date(2026, 6, 26)), true);
    assert.ok(new Cron("0 0 * * 7").dayOfWeek.includes(7), "pin the wrapped library's public field contract");
});
