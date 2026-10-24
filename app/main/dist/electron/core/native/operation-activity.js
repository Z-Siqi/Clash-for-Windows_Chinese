"use strict";

function createOperationActivity() {
    let active = 0, frozen = false;
    const busy = () => Object.assign(new Error("Profile operations are still active"), { code: "CFW_PROFILE_ACTIVITY_BUSY" });
    return {
        isBusy: () => active > 0 || frozen,
        assertOpen() { if (frozen) throw busy(); },
        begin() {
            this.assertOpen(); active++;
            let released = false;
            return () => { if (!released) { released = true; active--; } };
        },
        async run(action) { const release = this.begin(); try { return await action(); } finally { release(); } },
        freeze() {
            if (active || frozen) throw busy();
            frozen = true;
            let released = false;
            return () => { if (!released) { released = true; frozen = false; } };
        }
    };
}
module.exports = { createOperationActivity };
