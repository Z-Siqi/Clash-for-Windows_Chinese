"use strict";

function shouldNavigateForShortcut(event) {
    if (!event || event.defaultPrevented || event.isComposing) return false;
    const target = event.target;
    if (target?.isContentEditable) return false;
    return !(target?.closest?.('.no-esc, .monaco-editor, input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])'));
}

function bindMenuShortcuts({ mousetrap, getMenuItems, navigate, onNavigate }) {
    for (let position = 1; position <= 9; position++) {
        mousetrap.bind(`${position}`, event => {
            // Monaco can use EditContext on a div, so Mousetrap's textarea guard is insufficient.
            if (!shouldNavigateForShortcut(event)) return undefined;
            const item = getMenuItems()[position - 1];
            if (!item) return undefined;
            onNavigate();
            navigate(item.path);
            return false;
        });
    }
}

module.exports = { bindMenuShortcuts, shouldNavigateForShortcut };
