"use strict";

function windowsServiceDirectory(path, programFiles = "C:\\Program Files") {
    return path.join(programFiles, "Clash for Windows Service");
}

module.exports = { windowsServiceDirectory };
