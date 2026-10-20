"use strict";

let requestCounter = 0;

function createTunClient({ tun, getTapInfo }) {
    return Object.freeze({
        setupTapDevice: install => tun.setup(install, getTapInfo()),
        async spawnTun2socks({ mixedPort, isCurrent = () => true, signal }) {
            if (!isCurrent() || signal?.aborted) return null;
            const requestId = `${Date.now()}-${++requestCounter}`;
            let cancellation;
            const cancel = () => {
                // Send only a request identity across IPC, never a callback or AbortSignal.
                cancellation = Promise.resolve().then(() => tun.cancel(requestId)).catch(() => {});
            };
            const starting = tun.start(mixedPort, getTapInfo(), requestId);
            signal?.addEventListener("abort", cancel, { once: true });
            try {
                const processHandle = await starting;
                if (!isCurrent() || signal?.aborted) { if (!cancellation) cancel(); await cancellation; return null; }
                return processHandle;
            } finally { signal?.removeEventListener("abort", cancel); }
        },
        killSpawned: () => tun.stop()
    });
}

module.exports = { createTunClient };
