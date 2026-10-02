"use strict";

function createTunClient({ tun, getTapInfo }) {
    return Object.freeze({
        setupTapDevice: install => tun.setup(install, getTapInfo()),
        spawnTun2socks: ({ mixedPort }) => tun.start(mixedPort, getTapInfo()),
        killSpawned: () => tun.stop()
    });
}

module.exports = { createTunClient };
