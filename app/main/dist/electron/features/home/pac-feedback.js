"use strict";

const { parsePort } = require("../../core/network/tcp-port");

// Only a completed PAC listener startup may produce this warning. Core API
// connectivity and temporary runtime port values are deliberately not inputs.
function createPacFeedback({ getLanguage, showMessageBox }) {
    let shown = false;
    return async function showPacFeedback(vm, result, error) {
        if (shown || (!error && !result?.invalidConfiguredPort)) return;
        shown = true;
        const labels = getLanguage();
        if (error) {
            const reason = error.code === "EADDRINUSE" ? labels.pacPortOccupied()
                : error.code === "EACCES" ? labels.pacPortDenied() : labels.pacStartFailed();
            await showMessageBox({ type: "error", message: reason, buttons: [labels.ok()] });
            return;
        }
        const { response } = await showMessageBox({ type: "warning", message: labels.pacInvalidLegacyPort({ port: result.port }),
            buttons: [labels.pacUseRandom(), labels.pacSetFixed(), labels.later()], defaultId: 2, cancelId: 2 });
        if (response === 0) vm.$set(vm.settings, "innerServerPort", "");
        else if (response === 1) {
            try {
                const { port } = await vm.$input({ title: labels.pacSetFixed(), data: [{ key: "port", name: labels.port(), required: true,
                    value: "", validate: value => parsePort(value) !== null ? "" : labels.invalidPort() }], hint: labels.pacPortRestart() });
                vm.$set(vm.settings, "innerServerPort", parsePort(port));
            } catch (_cancelled) {}
        }
    };
}

module.exports = { createPacFeedback };
