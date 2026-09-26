"use strict";

let sequence = 0;
function writeAtomic({ fs, path, file, content }) {
    // Same-directory rename prevents readers from seeing a truncated YAML document.
    const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${++sequence}.tmp`);
    try {
        fs.writeFileSync(temporary, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
        fs.renameSync(temporary, file);
    } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
}

module.exports = { writeAtomic };
