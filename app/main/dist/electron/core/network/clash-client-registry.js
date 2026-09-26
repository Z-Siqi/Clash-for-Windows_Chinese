"use strict";

const { createAxiosClient } = require("./clash-clients");

function createClashClientRegistry({ axios }) {
    let client = null;

    return {
        update(info = {}) {
            if (info.port > 0) {
                client = createAxiosClient({
                    axios,
                    controllerPort: info.port,
                    secret: info.secret
                });
            }
        },
        getClient() {
            return client;
        }
    };
}

module.exports = { createClashClientRegistry };
