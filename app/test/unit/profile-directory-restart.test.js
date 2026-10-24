"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const { createOperationActivity } = require("../../main/dist/electron/core/native/operation-activity");
const { createProfileDirectoryClient } = require("../../main/dist/electron/core/native/profile-directory-client");
const { createProfileDirectoryRestart } = require("../../main/dist/electron/features/settings/profile-directory-restart");
const { createSettingsRepository } = require("../../main/dist/electron/features/settings/settings-repository");
const { createSettingsPageOptions } = require("../../main/dist/electron/features/settings/page-options");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

test("failed relaunch restores the exact settings file and releases the write barrier", t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-directory-restart-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const file = path.join(home, "cfw-settings.yaml"), original = "# retained comment\nproxyCore: clash\nprofilePath: ''\n";
    fs.writeFileSync(file, original);
    const activity = createOperationActivity(), settings = createSettingsRepository({ fs, path, yaml });
    const restart = createProfileDirectoryRestart({ activity, settings, fs, path, app: { relaunch() { throw new Error("launch failed"); } },
        uuid: () => "test-token", validateDirectory() {}, stopWatchers() {} });
    const sender = {}, prepared = restart.prepare(sender, home, path.join(home, "new"));
    assert.equal(activity.isBusy(), true);
    assert.throws(() => restart.commit({}, prepared.token), /Invalid/);
    assert.throws(() => restart.commit(sender, prepared.token), /launch failed/);
    assert.equal(fs.readFileSync(file, "utf8"), original);
    assert.equal(activity.isBusy(), false);
    assert.throws(() => restart.commit(sender, prepared.token), /Invalid/);
});

test("renderer preparation also freezes queued callbacks and releases on cancellation or native rejection", async () => {
    const activity = createOperationActivity();
    let reject = false;
    const client = createProfileDirectoryClient({ activity, getHome: () => "isolated", ipcRenderer: { async invoke(_channel, operation) {
        if (reject) return { ok: false, code: "CFW_PROFILE_ACTIVITY_BUSY" };
        return { ok: true, value: operation === "prepare" ? { token: "test" } : undefined };
    } } });
    await client.prepare("new");
    assert.throws(() => activity.begin(), /active/);
    await client.cancel("test");
    assert.equal(client.isBusy(), false);
    reject = true;
    await assert.rejects(client.prepare("new"), { code: "CFW_PROFILE_ACTIVITY_BUSY" });
    assert.equal(client.isBusy(), false);
});

test("a rejected atomic save releases preparation without attempting another failing write", t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-directory-save-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const file = path.join(home, "cfw-settings.yaml"); fs.writeFileSync(file, "profilePath: ''\n");
    const activity = createOperationActivity();
    let writes = 0;
    const guardedFs = Object.assign({}, fs, { renameSync() { writes++; throw Object.assign(new Error("denied"), { code: "EACCES" }); } });
    const restart = createProfileDirectoryRestart({ activity, settings: createSettingsRepository({ fs: guardedFs, path, yaml }),
        fs: guardedFs, path, app: {}, uuid: () => "test", validateDirectory() {}, stopWatchers() {} });
    const sender = {}, prepared = restart.prepare(sender, home, path.join(home, "new"));
    assert.throws(() => restart.commit(sender, prepared.token), { code: "EACCES" });
    assert.equal(writes, 1); assert.equal(activity.isBusy(), false);
    assert.equal(fs.readFileSync(file, "utf8"), "profilePath: ''\n");
});

test("a failed rollback keeps the old renderer blocked and returns a distinct recovery failure", t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-directory-rollback-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const file = path.join(home, "cfw-settings.yaml"); fs.writeFileSync(file, "profilePath: ''\n");
    const activity = createOperationActivity();
    let deny = false;
    const guardedFs = Object.assign({}, fs, { renameSync(...args) { if (deny) throw new Error("denied"); return fs.renameSync(...args); } });
    const restart = createProfileDirectoryRestart({ activity, settings: createSettingsRepository({ fs: guardedFs, path, yaml }),
        fs: guardedFs, path, app: { relaunch() { deny = true; throw new Error("launch failed"); } }, uuid: () => "test", validateDirectory() {}, stopWatchers() {} });
    const sender = {}, prepared = restart.prepare(sender, home, path.join(home, "new"));
    assert.throws(() => restart.commit(sender, prepared.token), { code: "CFW_PROFILE_DIRECTORY_ROLLBACK_FAILED" });
    restart.abandon(sender);
    assert.equal(activity.isBusy(), true);
});

test("Settings flushes a draft before save and never publishes its directory into the old renderer", async () => {
    const calls = [], labels = createTranslator(1);
    const page = createSettingsPageOptions({ Vuex: { mapState: () => ({}), mapGetters: () => ({}), mapMutations: () => ({}), mapActions: () => ({}) },
        isMacOS: () => false, isWindows: () => true, path, getLanguage: () => labels,
        showMessageBox: async () => ({ response: 1 }), profileDirectory: {
            isBusy: () => false, async prepare(directory) { calls.push(["prepare", directory]); return { token: "test" }; },
            async commit() { calls.push(["commit"]); }
        } });
    const parent = { proxyBusy: false, serviceOperation: "", async runProxyOperation(_name, action) { return action(); },
        async killClashCore() { calls.push(["core"]); }, async killSpawned() { calls.push(["tap"]); },
        async resetDNS() {}, async $setSystemProxy(enabled) { assert.equal(enabled, false); return true; } };
    const vm = { ...page.methods, $parent: parent, profilePathDraft: "partial", settings: { profilePath: "old" }, confData: {}, clashPath: "home",
        $refs: { profilePathInput: { handleBlur() { vm.profilePathDraft = "new-directory"; } } } };
    assert.equal(await vm.handleSaveProfilePath(), true);
    assert.equal(vm.settings.profilePath, "old");
    assert.equal(parent.serviceOperation, "restarting");
    assert.deepEqual(calls, [["prepare", "new-directory"], ["core"], ["tap"], ["commit"]]);
});
