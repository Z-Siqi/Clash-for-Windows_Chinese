"use strict";

// unix-cron exposes parsed fields but does not normalize the UNIX Sunday alias.
// Preserve its parsing (including range steps) and every other calendar field.
function matchesCron(Cron, expression, date) {
    const schedule = new Cron(expression);
    if (schedule.dayOfWeek?.includes(7) && !schedule.dayOfWeek.includes(0)) schedule.dayOfWeek.push(0);
    return schedule.isMatchDate(date);
}

module.exports = { matchesCron };
