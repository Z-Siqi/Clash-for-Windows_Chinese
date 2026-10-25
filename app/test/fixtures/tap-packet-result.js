"use strict";

// Upstream lwIP's sys_init creates a missing per-user CryptoAPI keyset on a
// fresh Windows runner. Its C output may flush this notice after the decision.
const FIRST_USE_NOTICE = "CryptAcquireContext failed with error -2146893802, trying to create NEWKEYSET";

function packetResult(output) {
    const lines = output.split(/\r?\n/).map(line => line.trim()).filter(line => line && line !== FIRST_USE_NOTICE);
    if (lines.length !== 1 || !["DROP", "FORWARD"].includes(lines[0])) throw Error("Unexpected native packet classifier output");
    return lines[0];
}

module.exports = { packetResult, FIRST_USE_NOTICE };
