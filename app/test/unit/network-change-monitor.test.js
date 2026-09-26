"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    createNetworkSnapshot,
    createNetworkChangeMonitor
} = require("../../main/dist/electron/features/network/network-change-monitor");

test("network snapshots are deterministic and contain only auditable interface data", () => {
    const interfaces = {
        WiFi: [
            { address: "192.0.2.2", family: "IPv4", internal: false, mac: "00:11", netmask: "255.255.255.0" },
            { address: "2001:db8::2", family: "IPv6", internal: false, mac: "00:11", netmask: "ffff::", scopeid: 4 }
        ]
    };
    assert.equal(createNetworkSnapshot(() => interfaces), createNetworkSnapshot(() => interfaces));
    assert.match(createNetworkSnapshot(() => interfaces), /192\.0\.2\.2/);
});

test("network monitor starts once, reports changes, and releases its timer", () => {
    let addresses = [{ address: "192.0.2.2", family: "IPv4", internal: false }];
    let intervalCallback;
    const cleared = [];
    const monitor = createNetworkChangeMonitor({
        networkInterfaces: () => ({ WiFi: addresses }),
        setIntervalFn(callback, delay) {
            assert.equal(delay, 2000);
            intervalCallback = callback;
            return { unref() {} };
        },
        clearIntervalFn: timer => cleared.push(timer)
    });
    const events = [];
    const unsubscribe = monitor.subscribe((error, status) => events.push({ error, status }));
    monitor.subscribe(() => {});
    intervalCallback();
    assert.equal(events.length, 0);
    addresses = [{ address: "198.51.100.4", family: "IPv4", internal: false }];
    intervalCallback();
    assert.deepEqual(events, [{ error: null, status: { type: "network", code: "network_interfaces_changed" } }]);
    unsubscribe();
    assert.equal(cleared.length, 0, "the second subscriber keeps the monitor alive");
    monitor.stop();
    assert.equal(cleared.length, 1);
});
