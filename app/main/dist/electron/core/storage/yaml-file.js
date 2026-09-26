"use strict";

const { writeAtomic } = require("./atomic-file");

function updateYamlValue({ fs, path, yaml, file, key, value }) {
    const document = yaml.parseDocument(fs.readFileSync(file, "utf8"));
    if (document.errors && document.errors.length) throw document.errors[0];
    document.set(key, value);
    writeAtomic({ fs, path, file, content: document.toString() });
}

module.exports = { updateYamlValue };
