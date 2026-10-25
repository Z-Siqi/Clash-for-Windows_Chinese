"use strict";

const { writeAtomic } = require("../storage/atomic-file");
const CREDENTIAL_FILE = ".cfw-service-client.json";

function readServiceCredentials({ fs, path, home }) {
    const folder = fs.realpathSync(home);
    const file = path.join(folder, CREDENTIAL_FILE);
    if (fs.realpathSync(file) !== file) throw new Error("Redirected service credentials");
    const credentials = JSON.parse(fs.readFileSync(file, "utf8"));
    if (credentials.dataDirectory !== folder || !/^[a-f0-9]{64}$/.test(credentials.token)) throw new Error("Invalid service credentials");
    return credentials;
}

function createServiceCredentials({ fs, path, crypto, home, protectFile }) {
    const dataDirectory = fs.realpathSync(home);
    const credentials = { dataDirectory, token: crypto.randomBytes(32).toString("hex") };
    const file = path.join(dataDirectory, CREDENTIAL_FILE);
    writeAtomic({ fs, path, file, content: JSON.stringify(credentials) });
    protectFile?.(file);
    return { file, credentials };
}

module.exports = { CREDENTIAL_FILE, readServiceCredentials, createServiceCredentials };
