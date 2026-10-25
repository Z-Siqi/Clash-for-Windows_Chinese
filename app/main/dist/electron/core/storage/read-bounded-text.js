"use strict";

// Keep size validation and reads on one descriptor. Limit bytes read even if a
// producer grows the file after fstat; never follow a final symlink on POSIX.
function readBoundedText({ fs, file, maxBytes = 33554432 }) {
    const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
    const descriptor = fs.openSync(file, flags);
    try {
        const stat = fs.fstatSync(descriptor);
        if (!stat.isFile() || stat.size > maxBytes) throw new Error("Invalid or oversized text file");
        const chunks = [];
        let total = 0;
        while (total <= maxBytes) {
            const chunk = Buffer.alloc(Math.min(65536, maxBytes + 1 - total));
            const count = fs.readSync(descriptor, chunk, 0, chunk.length, null);
            if (!count) return Buffer.concat(chunks, total).toString("utf8");
            total += count;
            if (total > maxBytes) throw new Error("Text file grew beyond its size limit");
            chunks.push(chunk.subarray(0, count));
        }
    } finally { fs.closeSync(descriptor); }
}

module.exports = { readBoundedText };
