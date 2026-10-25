"use strict";

const SERVICE_STATUS = Object.freeze({ Active: "Active", Inactive: "Inactive", NonExistent: "NonExistent", Unknown: "Unknown" });

function createServiceModeClient({ service }) {
    return Object.freeze({
        status: SERVICE_STATUS,
        statusService: () => service.status(),
        needUpdate: () => service.needUpdate(),
        installService: method => service.install(method),
        uninstallService: () => service.uninstall(),
        updateService: () => service.update()
    });
}

module.exports = { SERVICE_STATUS, createServiceModeClient };
