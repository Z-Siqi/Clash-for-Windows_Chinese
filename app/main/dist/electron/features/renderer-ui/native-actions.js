"use strict";

const { Language } = require("../../core/i18n/language");
const { normalizeExternalUrl } = require("../../core/network/external-url-policy");

function createNativeActions({ ipcRenderer, shell, Notification, getSettings, getLanguage }) {
    const showMessageBox = async options => ipcRenderer.invoke("dialog", "showMessageBox", { title: "Clash for Windows", ...options });
    return {
        showMessageBox,
        notify(title, body = "", options = null, onClick = () => {}) {
            if (!getSettings().showNotifications) return;
            const notification = new Notification(title, { body, silent: true, ...options });
            notification.onclick = () => {
                if (options?.hideWindowOnClick !== true) ipcRenderer.invoke("window-control", "show");
                onClick();
            };
        },
        async confirmOpenExternal(url) {
            const safeUrl = normalizeExternalUrl(url, { allowLoopbackHttp: true });
            if (!safeUrl) return false;
            const labels = new Language(getLanguage());
            const result = await showMessageBox({
                type: "question", buttons: [labels.no(), labels.yes()], message: labels.askOpenURL(), detail: safeUrl
            });
            if (result.response === 1) await shell.openExternal(safeUrl);
            return result.response === 1;
        }
    };
}

module.exports = { createNativeActions };
