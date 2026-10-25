"use strict";

const { supportsScriptMode } = require("../../core/clash-core/core-capabilities");
const IDS = ["system-proxy", "tun", "mixin", "mode-global", "mode-rule", "mode-direct", "mode-script"];
const CHANNELS = { system: "system-proxy-changed", tun: "tun-changed", mixin: "mixin-changed", mode: "mode-changed" };

function pendingId(state) {
    return state.proxyOperation === "system" ? "system-proxy" : state.proxyOperation === "mode"
        ? `mode-${state.proxyTarget}` : state.proxyOperation;
}

function proxyMenuEntries({ state, item, operation, actions }) {
    const pending = state.proxyBusy && pendingId(state) === item.id;
    return [
        { ...item, enabled: state.isReady && !state.proxyBusy, visible: item.visible !== false && !pending,
            click: nativeItem => {
                if (!state.isReady || state.proxyBusy) return false;
                const target = operation === "mode" ? item.id.slice(5) : nativeItem.checked;
                return actions.requestProxyOperation(operation, target);
            } },
        { id: `${item.id}-pending`, label: item.label, type: "normal", enabled: false,
            visible: item.visible !== false && !!pending, icon: actions.getProxyProgressIcon?.() }
    ];
}

function createTrayProxyProgress({ state, nativeImage, sendRenderer, getMenus, refreshMenu,
    repeat = setInterval, cancel = clearInterval }) {
    let timer = null, frame = 0;
    let requestSequence = 0, reservedRequest = null;
    const icons = [];
    let choicesEnabled;
    function getIcon() {
        if (!icons[frame]) {
            const pixels = Buffer.alloc(16 * 16 * 4);
            for (let row = 0; row < 16; row++) for (let column = 0; column < 16; column++) {
                const dx = column - 7.5, dy = row - 7.5, distance = Math.hypot(dx, dy);
                if (distance < 4.4 || distance > 6.2) continue;
                const angle = (Math.atan2(dy, dx) / (2 * Math.PI) + 2 - frame / 12) % 1;
                const index = (row * 16 + column) * 4;
                pixels[index] = pixels[index + 1] = pixels[index + 2] = 128;
                pixels[index + 3] = Math.round(255 * (.15 + .85 * angle));
            }
            icons[frame] = nativeImage.createFromBitmap(pixels, { width: 16, height: 16 });
        }
        return icons[frame];
    }
    function refresh() {
        const pending = state.proxyBusy ? pendingId(state) : "";
        const enabled = state.isReady && !state.proxyBusy;
        function updateChoices(items = []) {
            for (const item of items) {
                if (item.id?.startsWith("tray-proxy-")) item.enabled = enabled;
                if (item.submenu?.items) updateChoices(item.submenu.items);
            }
        }
        for (const menu of getMenus()) {
            if (!menu) continue;
            if (choicesEnabled !== enabled) updateChoices(menu.items);
            for (const id of IDS) {
                const item = menu.getMenuItemById(id), progress = menu.getMenuItemById(`${id}-pending`);
                if (!item) continue;
                const supported = id !== "mode-script" || supportsScriptMode(state.coreType);
                item.enabled = state.isReady && !state.proxyBusy && supported;
                item.visible = supported && id !== pending;
                if (id === "system-proxy") item.checked = state.systemProxyChecked;
                else if (id === "tun") item.checked = state.tunModeChecked;
                else if (id === "mixin") item.checked = state.mixinChecked;
                else item.checked = state.menuMode === id.slice(5);
                if (progress) { progress.visible = supported && id === pending; progress.icon = getIcon(); }
            }
        }
        choicesEnabled = enabled;
        refreshMenu();
    }
    function apply(snapshot) {
        if (!snapshot || typeof snapshot.busy !== "boolean") return;
        state.proxyBusy = snapshot.busy;
        state.proxyOperation = typeof snapshot.operation === "string" ? snapshot.operation : "";
        state.proxyTarget = snapshot.target;
        if (state.proxyBusy && !timer) {
            timer = repeat(() => { frame = (frame + 1) % 12; refresh(); }, 80);
            timer?.unref?.();
        } else if (!state.proxyBusy && timer) { cancel(timer); timer = null; }
        refresh();
    }
    function update(snapshot) {
        // Ignore state already in flight before a tray click. Only its renderer
        // acknowledgement may release the main-process reservation.
        if (reservedRequest !== null && snapshot?.requestId !== reservedRequest) return;
        if (!snapshot || typeof snapshot.busy !== "boolean") return;
        reservedRequest = null;
        apply(snapshot);
    }
    function request(operation, target) {
        if (!state.isReady || state.proxyBusy || !CHANNELS[operation]) return false;
        // Reserve in the main process before IPC, closing the rapid-click window.
        apply({ busy: true, operation, target });
        reservedRequest = ++requestSequence;
        try { sendRenderer(CHANNELS[operation], target, reservedRequest); }
        catch (_error) { reservedRequest = null; apply({ busy: false, operation: "", target: null }); return false; }
        return true;
    }
    return { update, request, refresh, getIcon };
}

module.exports = { proxyMenuEntries, createTrayProxyProgress };
