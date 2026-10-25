"use strict";

function renderSecurityCompatibilitySettings(createElement, viewModel, labels) {
    // Use Vue's public $createElement: this hand-written renderer has text children.
    const row = (title, description, control) => createElement("div", { staticClass: "item" }, [
        createElement("div", { staticClass: "relative flex items-center" }, [createElement("div", [title]), createElement("Info", [description])]), control
    ]);
    const edit = action => createElement("MoreHint", { staticClass: "hint", attrs: { text: labels.edit() }, on: { click: action } });
    return [
        row(labels.trustedCertificateOrigins(), labels.trustedCertificateOriginsDescribe(), edit(viewModel.handleEditUnsafeOrigins)),
        row(labels.profileDownloadExceptions(), labels.profileDownloadExceptionsDescribe(), edit(viewModel.handleEditDownloadExceptions)),
        row(labels.allowRemoteProfileParsers(), labels.allowRemoteProfileParsersDescribe(), createElement("SwitchView", {
            model: { value: viewModel.settings.allowRemoteProfileParsers === true,
                callback: viewModel.handleRemoteProfileParsersChange, expression: "settings.allowRemoteProfileParsers" }
        })),
        row(labels.allowHttpExternalLinks(), labels.allowHttpExternalLinksDescribe(), createElement("SwitchView", {
            model: { value: viewModel.settings.allowHttpExternalLinks === true,
                callback: viewModel.handleHttpExternalLinksChange, expression: "settings.allowHttpExternalLinks" }
        }))
    ];
}

module.exports = { renderSecurityCompatibilitySettings };
