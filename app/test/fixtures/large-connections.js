"use strict";

function largeConnections(count = 100000, traffic = 0) {
    return Array.from({ length: count }, (_, index) => ({
        id: `connection-${index}`, start: new Date(1700000000000 + index * 1000).toISOString(),
        upload: index + traffic, download: index * 2 + traffic * 2,
        chains: ["DIRECT"], rule: "Match", rulePayload: "",
        metadata: { host: `host-${index}.test`, network: index % 2 ? "udp" : "tcp", type: "Socks5",
            sourceIP: "10.0.0.1", sourcePort: String(index % 65535 + 1), destinationIP: "198.18.0.1", destinationPort: "443",
            processPath: "C:\\test\\process.exe", dnsMode: "fake-ip" }
    }));
}

module.exports = { largeConnections };
