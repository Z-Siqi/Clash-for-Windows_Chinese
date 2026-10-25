"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { registerDialogIpc } = require("../../main/dist/electron/features/dialog/register-dialog-ipc");
const { registerAppLifecycle } = require("../../main/dist/electron/features/application/register-app-lifecycle");

test("native message boxes translate implicit OK using the current language and preserve explicit options", async () => {
    let language = 0, handler;
    const labels = createTranslator(() => language), calls = [], window = {};
    registerDialogIpc({ ipcMain: { handle: (_name, callback) => { handler = callback; } },
        dialog: { showMessageBox: (...args) => calls.push(args) }, getMainWindow: () => window, getLanguage: () => labels });
    for (language of [0, 1, 0]) {
        await handler(null, "showMessageBox", { message: "diagnostic" });
        assert.deepEqual(calls.at(-1), [window, { buttons: [labels.ok()], message: "diagnostic" }]);
        const options = { message: "user script text", buttons: ["custom"], defaultId: 0, cancelId: 0, checkboxLabel: "custom checkbox" };
        await handler(null, "showMessageBox", options);
        assert.deepEqual(calls.at(-1), [window, options]);
    }
});

test("certificate prompts translate title, trust/cancel and Keychain instructions without changing trust policy", async () => {
    let language = 0, response = 1;
    const labels = createTranslator(() => language), app = new EventEmitter(), dialogs = [], trustDialogs = [];
    Object.assign(app, { setAppUserModelId() {}, setAsDefaultProtocolClient() {}, setName() {}, setAboutPanelOptions() {}, requestSingleInstanceLock: () => true });
    const window = {}, certificate = {}, url = "https://untrusted.test/path?a=1&b=2";
    registerAppLifecycle({ app, dialog: {
        showMessageBox: async options => { dialogs.push(options); return { response }; },
        showCertificateTrustDialog: async (owner, options) => { assert.equal(owner, window); trustDialogs.push(options); }
    }, getMainWindow: () => window, unsafeUrlPolicy: { allowsCertificate: () => false }, getLanguage: () => labels });
    for (language of [0, 1, 0]) {
        response = language === 1 ? 1 : 0;
        let result;
        await app.listeners("certificate-error")[0]({ preventDefault() { assert.fail("untrusted certificate cannot be accepted"); } }, null,
            url, "ERR_CERT", certificate, value => { result = value; });
        const options = dialogs.at(-1);
        assert.equal(options.title, labels.certificateErrorTitle());
        assert.deepEqual(options.buttons, [labels.trustCertificate(), labels.cancel()]);
        assert.equal(options.message, labels.certificateErrorMessage({ url }));
        assert.ok(options.message.includes(url));
        assert.equal(result, false);
        if (response === 0) assert.deepEqual(trustDialogs.at(-1), { certificate, message: labels.certificateTrustMessage() });
    }
    assert.equal(trustDialogs.length, 2);
});
