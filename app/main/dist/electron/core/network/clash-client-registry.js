"use strict";

const { createAxiosClient } = require("./clash-clients");

function createClashClientRegistry({ axios }) {
    let client = null;
    let connectionInfo = null;

    return {
        update(info = {}) {
            if (info.port > 0) {
                client = createAxiosClient({
                    axios,
                    controllerPort: info.port,
                    secret: info.secret
                });
                connectionInfo = { controllerPort: info.port, secret: info.secret || "" };
            }
        },
        getClient() {
            return client;
        },
        getConnectionInfo() {
            return connectionInfo && { ...connectionInfo };
        }
    };
}

module.exports = { createClashClientRegistry };
