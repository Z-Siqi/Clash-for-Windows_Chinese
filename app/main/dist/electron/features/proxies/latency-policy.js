"use strict";

const validDelay = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
const canceled = () => Object.assign(new Error("Latency test was superseded"), { code: "ERR_CANCELED" });

function createLatencyPolicy({ now = Date.now } = {}) {
    let scope = [];
    let scopeRevision = 0;
    const means = new Map();
    const keyFor = (name, provider) => JSON.stringify([provider?.name || null, name]);
    return {
        setScope(next) {
            if (scope.length !== next.length || scope.some((value, index) => value !== next[index])) { means.clear(); scopeRevision++; }
            scope = next;
        },
        async measure({ name, provider, core, kind, timeout, sample, current = () => true }) {
            const key = keyFor(name, provider), started = now(), revision = scopeRevision;
            means.delete(key);
            const live = () => { if (revision !== scopeRevision || !current()) throw canceled(); };
            let first, second, secondStart = started;
            try {
                live();
                first = await sample(timeout);
                live();
                if (kind !== "meanDelay") return validDelay(first.delay) ? first.delay : 0;
                if (validDelay(first.meanDelay)) return first.meanDelay;
                if (core !== "mihomo") return 0;
                const remaining = Math.floor(timeout - (now() - started));
                if (first.delay > 0 && remaining > 0) {
                    secondStart = now();
                    second = await sample(remaining);
                    live();
                }
            } catch (error) {
                if (error.code === "ERR_CANCELED" || error.__CANCEL__ || !current()) throw canceled();
                if (kind !== "meanDelay" || core !== "mihomo") throw error;
            }
            live();
            const value = first?.delay > 0 && second?.delay > 0 ? Math.round((first.delay + second.delay) / 2) : 0;
            means.set(key, { value, delay: second?.delay ?? (secondStart === started ? first?.delay : 0) ?? 0,
                started: secondStart, ended: now(), anchor: null });
            return value;
        },
        read({ name, provider, history = [], kind }) {
            const latest = history[history.length - 1];
            if (kind !== "meanDelay") return validDelay(latest?.delay) ? latest.delay : undefined;
            if (validDelay(latest?.meanDelay)) return latest.meanDelay;
            const key = keyFor(name, provider), mean = means.get(key);
            if (!mean) return latest?.delay === 0 ? 0 : undefined;
            if (!latest) return mean.value;
            if (mean.anchor !== null) {
                if (latest.time === mean.anchor) return mean.value;
                means.delete(key);
                return latest.delay === 0 ? 0 : undefined;
            }
            const time = Date.parse(latest.time);
            // An older poll can arrive before the paired test's history. Preserve
            // the result until a new history entry can identify the second sample.
            if (Number.isFinite(time) && time < mean.started) return mean.value;
            if (Number.isFinite(time) && time <= mean.ended && latest.delay === mean.delay) {
                mean.anchor = latest.time;
                return mean.value;
            }
            means.delete(key);
            return latest.delay === 0 ? 0 : undefined;
        }
    };
}

module.exports = { createLatencyPolicy };
