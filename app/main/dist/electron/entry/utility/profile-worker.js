"use strict";

const { createProfileWorkerRuntime } = require("../../features/profiles/profile-worker-runtime");
const { Language } = require("../../core/i18n/language");
const lodash = require("lodash");

createProfileWorkerRuntime({
    parentPort: process.parentPort,
    createLanguage: language => new Language(language),
    parserDependencies: {
        axios: require("axios"), got: require("got"), fs: require("fs"), path: require("path"), yaml: require("yaml"),
        cloneDeep: lodash.cloneDeep, reduce: lodash.reduce, shuffle: lodash.shuffle,
        requireFromString: require("require-from-string"), Console: require("console").Console,
        diff3Merge: require("node-diff3").merge, parseContentDisposition: require("content-disposition").parse,
        HttpsProxyAgent: require("hpagent").HttpsProxyAgent,
        createProfileTime: () => `${Date.now()}-${require("crypto").randomUUID()}.yml`
    }
});
