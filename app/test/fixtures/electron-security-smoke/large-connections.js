"use strict";

async function verifyLargeConnections() {
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const root = document.querySelector("#app").__vue__;
    async function until(predicate, label) {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) { if (predicate()) return; await wait(20); }
        throw Error(`Large connections timed out: ${label}`);
    }
    await root.$router.push("/home/connection");
    const page = document.querySelector(".main-connection-view").__vue__;
    page.searchText = "";
    let maxDelay = 0, previous = performance.now();
    const delays = [];
    const timer = setInterval(() => {
        const now = performance.now();
        const delay = Math.max(0, now - previous - 10);
        delays.push(delay); maxDelay = Math.max(maxDelay, delay); previous = now;
    }, 10);
    const rowCount = () => document.querySelectorAll(".main-connection-view .conn-item").length;
    try {
        await until(() => page.data.count === 100000, "live snapshot");
        const initialTotal = page.data.uploadTotal;
        await until(() => page.data.uploadTotal > initialTotal, "second live snapshot");
        const rows = rowCount();
        if (rows < 1 || rows > 100 || page.data.__ob__) throw Error("Full connections dataset entered Vue/DOM");
        const viewport = page.$refs.connectionsViewport;
        viewport.scrollTop = viewport.scrollHeight;
        viewport.dispatchEvent(new Event("scroll"));
        await until(() => page.data.range.end === 100000, "last viewport");
        await root.$nextTick();
        if (!page.$el.textContent.includes("host-99999.test")) throw Error("Last connection is unreachable");
        async function returnToBottom(label) {
            const savedTop = page.$refs.connectionsViewport.scrollTop;
            await root.$router.push("/home/general");
            await wait(50);
            await root.$router.push("/home/connection");
            await until(() => page.$refs.connectionsViewport?.scrollTop === savedTop
                && page.data.range.end === 100000 && page.$el.textContent.includes("host-99999.test"), label);
            const list = page.$refs.connectionsViewport;
            const visible = [...list.querySelectorAll(".conn-item")].some(item => {
                const row = item.getBoundingClientRect(), area = list.getBoundingClientRect();
                return row.bottom > area.top && row.top < area.bottom;
            });
            if (!visible) throw Error(`Connections rendered outside its viewport: ${label}`);
        }
        await returnToBottom("live bottom restored without scrolling");
        page.handleSwitchPauseStatus();
        await returnToBottom("paused bottom restored without scrolling");
        page.handleSwitchPauseStatus();
        page.detailConnectionId = "connection-99999";
        await until(() => page.detailConnection?.id === "connection-99999", "detail lookup");
        page.detailConnectionId = "";
        page.isShowTypeFilter = true;
        page.filterTypeIndex = 2;
        await until(() => page.data.labelRange.height === 3200000, "100k filter labels");
        if (page.data.labels.length > 100) throw Error("Unbounded filter label DOM");
        page.isShowTypeFilter = false;
        page.searchText = "network=udp";
        await until(() => page.data.count === 50000, "exact metadata filter");
        page.searchText = "host-99999";
        await until(() => page.data.count === 1, "full dataset search");
        page.searchText = "";
        page.handleLabelSelect(3);
        await until(() => page.data.count === 100000 && page.data.rows[0]?.id === "connection-99999", "traffic sort");
        page.handleLabelSelect(3);
        await until(() => page.data.rows[0]?.id === "connection-0", "sort reversal");
        page.handleSwitchPauseStatus();
        if (page.client !== null) throw Error("Pause left the controller stream open");
        page.searchText = "host-99999";
        await until(() => page.data.count === 1, "paused search");
        await root.$router.push("/home/general");
        await root.$router.push("/home/connection");
        page.searchText = "host-99998";
        await until(() => page.data.rows[0]?.id === "connection-99998", "cached paused snapshot after navigation");
        page.searchText = "";
        page.handleSwitchPauseStatus();
        page.handleLabelSelect(4);
        await until(() => page.data.count === 100000, "resume");
        delays.sort((a, b) => a - b);
        const p95Delay = delays[Math.floor(delays.length * 0.95)] || 0;
        if (maxDelay > 250 || p95Delay > 50) throw Error(`100k renderer stalled: max=${maxDelay.toFixed(1)}ms, p95=${p95Delay.toFixed(1)}ms`);
        return { connections: 100000, renderedRows: rows, maxDelayMs: +maxDelay.toFixed(1), p95DelayMs: +p95Delay.toFixed(1),
            samples: delays.length, liveUpdates: true, search: true, sort: true, filterLabels: true, pauseResume: true, navigationRestoresBottom: true };
    } finally {
        clearInterval(timer);
        page.searchText = "";
        page.isShowTypeFilter = false;
        page.detailConnectionId = "";
        if (page.isPause) page.handleSwitchPauseStatus();
        await root.$router.push("/home/general");
    }
}

module.exports = { verifyLargeConnections };
