"use strict";

const https = require("https");

function createCertificateRequestOptions({ url, allowsCertificate, createAgent = options => new https.Agent(options) }) {
    // This agent belongs to one request chain. Never mutate a shared/global agent:
    // HTTPS connection pools must distinguish verified and unverified connections.
    const httpsAgent = createAgent({ keepAlive: false, rejectUnauthorized: !allowsCertificate(url) });
    return {
        httpsAgent,
        beforeRedirect(options) {
            const rejectUnauthorized = !allowsCertificate(options.href);
            options.rejectUnauthorized = rejectUnauthorized;
            httpsAgent.options.rejectUnauthorized = rejectUnauthorized;
            // Axios may wrap our private agent in an environment-proxy tunnel.
            // Restore verification for every unlisted redirect, including on that tunnel.
            const transportAgent = options.agents?.https;
            if (transportAgent?.options) transportAgent.options.rejectUnauthorized = rejectUnauthorized;
        }
    };
}

module.exports = { createCertificateRequestOptions };
