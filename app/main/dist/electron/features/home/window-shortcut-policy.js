"use strict";

function shouldCloseWindowForShortcut(event) {
    const target = event && event.target;
    return !(target && typeof target.closest === "function" && target.closest(".no-esc"));
}

module.exports = { shouldCloseWindowForShortcut };
