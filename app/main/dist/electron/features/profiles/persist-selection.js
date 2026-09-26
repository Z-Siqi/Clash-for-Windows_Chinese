"use strict";

async function persistSelection({ getProfiles, clashApi, changeProfile }) {
    const profiles = getProfiles();
    const profile = profiles.files && profiles.files[profiles.index];
    if (!(profiles.index >= 0) || !profile) return;
    try {
        const response = await clashApi.getProxies();
        const selected = Object.values(response.data.proxies || {})
            .filter(proxy => proxy.type === "Selector")
            .map(({ name, now }) => ({ name, now }));
        // A profile may be deleted or switched while the controller request is in flight.
        const current = getProfiles();
        if (current.index !== profiles.index || !current.files[current.index] || current.files[current.index].time !== profile.time) return;
        changeProfile({ index: current.index, profile: { ...current.files[current.index], selected } });
    } catch (_error) {
        // Selection persistence is best effort when a core is shutting down.
    }
}

module.exports = { persistSelection };
