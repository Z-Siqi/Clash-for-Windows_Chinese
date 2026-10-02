"use strict";

const fs = require("node:fs");
const file = process.argv.at(-1);
fs.writeFileSync(file, `${fs.readFileSync(file, "utf8")} :: edited by CLI`);
