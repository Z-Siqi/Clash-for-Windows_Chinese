"use strict";

function createConnectionPipeline({ worker, onView, onError = () => {} }) {
    let sequence = 0;
    let active;
    let pending;
    let stopped = false;
    let revision = 0;
    let latestQuery = {};
    let queryKey;
    const commands = [];

    function pump() {
        if (stopped || active) return;
        const job = commands.shift() || pending;
        if (!job) return;
        if (job === pending) pending = undefined;
        active = job;
        worker.postMessage({ ...job.message, id: ++sequence });
    }
    function fail() {
        if (stopped) return;
        onError();
        pipeline.dispose();
    }
    worker.onmessage = ({ data }) => {
        if (stopped || !active || data.id !== sequence) return;
        const job = active;
        active = undefined;
        if (data.error) { job.reject?.(new Error(data.error)); onError(); }
        else {
            // A slow sort must not move the viewport back after newer scrolling.
            if (data.view && data.view.revision === revision) onView(Object.freeze(data.view));
            job.resolve?.(data);
        }
        pump();
    };
    worker.onerror = fail;
    const pipeline = {
        update(query, payload, sampledAt) {
            if (stopped) return;
            const key = JSON.stringify(query);
            if (key !== queryKey) { queryKey = key; revision++; }
            latestQuery = { ...query, revision };
            const message = { ...pending?.message, query: latestQuery };
            if (payload !== undefined) Object.assign(message, { payload, sampledAt });
            // Only the newest full snapshot waits behind the in-flight job.
            pending = { message };
            pump();
        },
        command(operation, query = latestQuery) {
            if (stopped) return Promise.reject(new Error("Connections worker stopped"));
            return new Promise((resolve, reject) => {
                commands.push({ message: { operation, query }, resolve, reject });
                pump();
            });
        },
        dispose() {
            stopped = true;
            worker.terminate();
            active?.reject?.(new Error("Connections worker stopped"));
            for (const job of commands) job.reject?.(new Error("Connections worker stopped"));
            commands.length = 0;
            active = pending = undefined;
        }
    };
    return pipeline;
}

module.exports = { createConnectionPipeline };
