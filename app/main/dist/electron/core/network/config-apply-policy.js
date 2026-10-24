"use strict";

function configApplyTimeout({ hasProviders = false } = {}) {
    // Every full reload can rebuild listeners or DNS, including Mixin removal.
    // Do not infer its cost from the resulting TUN flag or Mixin switch alone.
    // Provider loads retain the host's separate, bounded cold-download policy.
    return hasProviders ? 0 : 60000;
}

module.exports = { configApplyTimeout };
