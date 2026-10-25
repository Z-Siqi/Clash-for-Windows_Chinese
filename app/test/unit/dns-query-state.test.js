"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const { createDns } = require("../../main/dist/electron/features/renderer-ui/components/dns");

function fixture() {
    const options = createDns({ Vuex: { mapGetters: () => ({}) }, getLanguage: () => ({ pleaseInputDomain: () => "domain required" }) });
    const vm = new (Vue.extend(options))();
    const pending = [];
    vm.clashApi = { queryDns: (name, type) => new Promise((resolve, reject) => pending.push({ name, type, resolve, reject })) };
    return { vm, pending };
}
const answer = name => ({ data: { Status: 0, Answer: [{ name, type: 1, data: "192.0.2.1" }] } });

test("DNS results and errors belong only to the latest query", async () => {
    const { vm, pending } = fixture();
    vm.searchHost = "old.test"; const old = vm.handleSearch();
    vm.searchHost = "new.test"; const current = vm.handleSearch();
    pending[1].resolve(answer("new.test")); await current;
    pending[0].resolve(answer("old.test")); await old;
    assert.equal(vm.answers[0].name, "new.test");
    const stale = vm.handleSearch(); const next = vm.handleSearch();
    pending[3].resolve(answer("current.test")); await next;
    pending[2].reject(new Error("obsolete error")); await stale;
    assert.equal(vm.error, ""); assert.equal(vm.answers[0].name, "current.test");
    vm.$destroy();
});

test("canceling or clearing a DNS query invalidates pending responses without changing core DNS", async () => {
    const { vm, pending } = fixture();
    vm.reject = () => {};
    vm.searchHost = "cancelled.test"; const cancelled = vm.handleSearch();
    vm.handleCancel(); pending[0].resolve(answer("cancelled.test")); await cancelled;
    assert.equal(vm.answers.length, 0);
    vm.searchHost = "pending.test"; const stale = vm.handleSearch();
    vm.searchHost = ""; await vm.handleSearch();
    pending[1].resolve(answer("pending.test")); await stale;
    assert.equal(vm.answers.length, 0); assert.equal(vm.error, "domain required");
    vm.searchHost = "active.test"; const active = vm.handleSearch();
    pending[2].reject(new Error("current error")); await active;
    assert.equal(vm.error, "current error");
    vm.$destroy();
});
