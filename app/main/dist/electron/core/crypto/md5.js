"use strict";

// Legacy provider cache identities use MD5. This is not an authentication hash.
function md5(value) {
    const source = new TextEncoder().encode(String(value));
    const bytes = new Uint8Array(Math.ceil((source.length + 9) / 64) * 64);
    bytes.set(source);
    bytes[source.length] = 128;
    const view = new DataView(bytes.buffer);
    view.setUint32(bytes.length - 8, (source.length * 8) >>> 0, true);
    view.setUint32(bytes.length - 4, Math.floor(source.length / 536870912), true);
    const shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    let stateA = 0x67452301, stateB = 0xefcdab89, stateC = 0x98badcfe, stateD = 0x10325476;
    for (let offset = 0; offset < bytes.length; offset += 64) {
        const initial = [stateA, stateB, stateC, stateD];
        for (let round = 0; round < 64; round++) {
            const group = Math.floor(round / 16);
            const mixed = group === 0 ? (stateB & stateC) | (~stateB & stateD) : group === 1 ? (stateD & stateB) | (~stateD & stateC) : group === 2 ? stateB ^ stateC ^ stateD : stateC ^ (stateB | ~stateD);
            const word = group === 0 ? round : group === 1 ? (5 * round + 1) % 16 : group === 2 ? (3 * round + 5) % 16 : (7 * round) % 16;
            const sum = (stateA + mixed + Math.floor(Math.abs(Math.sin(round + 1)) * 4294967296) + view.getUint32(offset + word * 4, true)) | 0;
            const shift = shifts[group * 4 + round % 4];
            const next = (stateB + ((sum << shift) | (sum >>> (32 - shift)))) | 0;
            stateA = stateD; stateD = stateC; stateC = stateB; stateB = next;
        }
        stateA = (stateA + initial[0]) | 0; stateB = (stateB + initial[1]) | 0; stateC = (stateC + initial[2]) | 0; stateD = (stateD + initial[3]) | 0;
    }
    return [stateA, stateB, stateC, stateD].flatMap(word => [0, 8, 16, 24].map(shift => ((word >>> shift) & 255).toString(16).padStart(2, "0"))).join("");
}

module.exports = { md5 };
