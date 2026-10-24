"use strict";

const ACTIONS = new Set(["shortcutSystemProxy", "shortcutTun", "shortcutMixin", "shortcutGlobalMode",
    "shortcutRuleMode", "shortcutDirectMode", "shortcutScriptMode", "shortcutRunTrayScript", "shortcutShowHideDashboard"]);

function createShortcutBindings({ globalShortcut, onPressed }) {
    const bindings = new Map();
    let capturing = false;
    return {
        capture(value) { if (typeof value !== "boolean") throw new Error("Invalid shortcut capture state"); capturing = value; },
        bind(action, shortcut) {
            if (!ACTIONS.has(action) || typeof shortcut !== "string" || shortcut.length > 128) throw new Error("Invalid shortcut binding");
            const previous = bindings.get(action) || "";
            if (shortcut === previous && (!shortcut || globalShortcut.isRegistered(shortcut))) return { success: true, shortcut };
            if (shortcut) {
                try {
                    if (!globalShortcut.register(shortcut, () => { if (!capturing) onPressed(action); })) {
                        return { success: false, shortcut: previous };
                    }
                } catch (_error) { return { success: false, shortcut: previous }; }
            }
            // A failed replacement never unregisters the previously working key.
            if (previous && previous !== shortcut) globalShortcut.unregister(previous);
            if (shortcut) bindings.set(action, shortcut);
            else bindings.delete(action);
            return { success: true, shortcut };
        }
    };
}

module.exports = { createShortcutBindings };
