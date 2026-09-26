"use strict";

function renderConnectionDisconnectSettings(viewModel, createElement, labels) {
    const row = (key, title, description) => createElement("div", { staticClass: "item" }, [
        createElement("div", { staticClass: "flex items-center" }, [
            createElement("div", [title]), createElement("Info", [description])
        ]),
        createElement("SwitchView", { model: {
            value: viewModel.settings[key], callback: value => viewModel.$set(viewModel.settings, key, value), expression: `settings.${key}`
        } })
    ]);
    return [
        row("connMode", labels.breakWhenModeChange(), labels.breakWhenModeChangeDescribe()),
        row("connProxyDisconnect", labels.breakWhenProxyDisabled(), labels.breakWhenProxyDisabledDescribe())
    ];
}

module.exports = { renderConnectionDisconnectSettings };
