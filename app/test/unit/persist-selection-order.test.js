"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { persistSelection } = require("../../main/dist/electron/features/profiles/persist-selection");

test("selection persistence discards older core snapshots across fresh callback closures", async () => {
    const pending = [];
    const clashApi = { getProxies: () => new Promise(resolve => pending.push(resolve)) };
    const profiles = { index: 0, files: [{ time: "profile.yaml", selected: [] }] };
    const changes = [];
    const save = () => persistSelection({ clashApi, getProfiles: () => profiles,
        changeProfile: ({ profile }) => { profiles.files[0] = profile; changes.push(profile.selected); } });
    const first = save(), second = save();
    const response = (auto, other) => ({ data: { proxies: {
        Auto: { name: "Auto", type: "Selector", now: auto }, Other: { name: "Other", type: "Selector", now: other }
    } } });
    pending[1](response("latest", "new")); await second;
    pending[0](response("earlier", "old")); await first;
    assert.deepEqual(changes, [[{ name: "Auto", now: "latest" }, { name: "Other", now: "new" }]]);
});

test("selection persistence remains independent for different core API owners", async () => {
    const pending = [], changes = [];
    const profiles = { index: 0, files: [{ time: "profile.yaml" }] };
    const saves = ["one", "two"].map(now => persistSelection({ getProfiles: () => profiles,
        clashApi: { getProxies: () => new Promise(resolve => pending.push(() => resolve({ data: { proxies: { Auto: { name: "Auto", type: "Selector", now } } } }))) },
        changeProfile: ({ profile }) => changes.push(profile.selected[0].now) }));
    pending[1](); pending[0](); await Promise.all(saves);
    assert.deepEqual(changes, ["two", "one"]);
});
