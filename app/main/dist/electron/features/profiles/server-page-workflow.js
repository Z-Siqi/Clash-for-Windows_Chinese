"use strict";

const MANUAL_STOP = "manual-stop";

function createServerPageWorkflow({
    labels,
    getLanguage,
    moment,
    yaml,
    fs,
    path,
    electron,
    lodash,
    CancelToken,
    downloadProfile,
    runUserScript,
    profileScriptType,
    scheduler,
    confirmOpenExternal,
    cloneJson,
    showMessageBox,
    formatBytes,
    schedule = setTimeout
}) {
    const data = () => ({
        btnType: 0,
        resultHint: labels.downloadFromURL(),
        editProfileName: "",
        editProfileType: -1,
        fileWatcher: null,
        inputFocus: false,
        subUrl: "",
        downlodingUrls: {},
        dragSelectedName: "",
        qrcodeURL: "",
        intervalID: null,
        now: moment(),
        loadingProfileIndex: []
    });

    const computed = {
        profiles: {
            get() { return this.pfs.files || []; },
            set(profiles) { this.changeProfiles({ profiles }); }
        },
        getBtnText() {
            return this.btnType === 3 ? labels.downloading()
                : this.btnType === 1 ? `${labels.error()}!`
                    : this.btnType === 2 ? `${labels.success()}!` : labels.download();
        },
        getRightBtnText() { return labels.directMode(); },
        getRightBtnClass() {
            return {
                confirm: true, "confirm-right": true,
                "btn-error": this.btnType === 1,
                "btn-success": this.btnType === 2,
                "btn-loading": this.btnType === 3
            };
        },
        getBtnClass() {
            return {
                confirm: true, "confirm-left": true,
                "btn-error": this.btnType === 1,
                "btn-success": this.btnType === 2,
                "btn-loading": this.btnType === 3
            };
        }
    };

    const methods = {
        handleOpenHomeWeb(url) { confirmOpenExternal(url); },
        isProifleExpired({ time, interval }) {
            if (interval > 0 && time) try {
                const modified = fs.statSync(path.join(this.profilesPath, time)).mtime;
                if (modified) return moment(modified).isBefore(moment().subtract(interval, "hours"));
            } catch (_error) {}
            return false;
        },
        parserHint({ url, reg }) {
            return url ? `url (${url.slice(0, 8)}...${url.slice(-20)})` : reg ? `reg (${reg})` : "";
        },
        matchingParserCount({ url }) {
            let parsers = [];
            const text = this.settings.profileParsersText;
            if (text) try { parsers = yaml.parse(text).parsers || []; } catch (_error) {}
            return url ? parsers.filter(parser => parser.url
                ? parser.url === url
                : parser.reg ? new RegExp(parser.reg).test(url) : false) : [];
        },
        handleProfileRightClick(event, profile, index) {
            if (event.which !== 3) return;
            const isLocal = profile.url === "";
            this.$menu([{
                icon: "home", text: labels.openWebPage(), hide: !profile?.homeWeb,
                click: () => this.handleOpenHomeWeb(profile.homeWeb)
            }, {
                icon: "edit", text: labels.edit(), click: () => this.openProfile(profile)
            }, {
                icon: "edit", text: labels.editExternally(), click: () => this.openProfile(profile, true)
            }, {
                icon: "refresh", text: labels.update(), hide: isLocal, click: () => this.refreshProfile(profile)
            }, {
                text: labels.showInFolder(), icon: "folder", click: () => this.openProfileInFolder(profile)
            }, {
                icon: "merge_type", text: "Diff", hide: isLocal, click: () => this.makeDiff(profile)
            }, {
                icon: "send", text: labels.proxies(), click: () => this.editProfile(profile)
            }, {
                icon: "rule", text: labels.rule(), click: () => this.editProfileRule(profile)
            }, {
                icon: "content_copy", text: labels.copy(), click: () => this.handleCopyProfile(profile)
            }, {
                icon: "qr_code", text: labels.qrCode(), hide: isLocal, click: () => this.handleQrcodeOpen(profile)
            }, {
                icon: "account_tree", text: labels.parsers(), hide: isLocal, click: () => this.handleParserInfoShow(profile)
            }, {
                icon: "code", text: labels.runScript(), click: () => this.handleRunScirpt(profile)
            }, {
                icon: "settings", text: labels.settings(), click: () => this.handleEditItem(index)
            }, {
                icon: "delete", text: labels.delete(), click: () => this.handleDeleteProfile(index)
            }], event);
        },
        openProfileInFolder(profile) {
            electron.shell.showItemInFolder(path.join(this.profilesPath, profile.time));
        },
        async handleUpdateAllProfiles() {
            return Promise.all(this.profiles.map(profile =>
                this.refreshProfile(profile, { ignoreSelectAfterUpdated: true })
            ));
        },
        async handleParserInfoShow(profile) {
            const parsers = this.matchingParserCount(profile);
            const message = parsers.map((parser, index) => `${index + 1}. ${this.parserHint(parser)}`).join("\n");
            const [selection] = await this.$select({
                title: `${labels.parsersStart()}${parsers.length}${labels.parsersEnd()}`,
                message,
                items: labels.parsersOption()
            });
            if (selection !== 0) return;
            const key = "profileParsersText";
            const original = this.settings[key] || "parsers: # array\n";
            try {
                const { code = "" } = await this.$code({
                    code: original,
                    language: "yaml",
                    fontSize: this.settings.editorFontSize
                });
                this.settings[key] = code;
            } catch (_error) {}
        },
        async handleRunScirpt(profile) {
            runUserScript(cloneJson(profile), profileScriptType);
        },
        handleQrcodeOpen({ url }) { if (url) this.qrcodeURL = url; },
        handleDragStart() {
            const index = this.pfs.index ?? -1;
            if (index >= 0) this.dragSelectedName = this.pfs.files[index].time;
        },
        handleDragEnd() {
            if (this.dragSelectedName === "") return;
            const index = this.pfs.files.findIndex(profile => profile.time === this.dragSelectedName);
            this.changeProfilesIndex({ index });
        },
        async handleCopyProfile(profile) {
            const language = getLanguage();
            try {
                const { filename = "" } = await this.$input({
                    title: language.duplicateProfile(),
                    data: [{
                        name: language.name(), key: "filename",
                        placeholder: language.inputNewFileName(), required: true
                    }]
                });
                this.localCopy(filename, path.join(this.profilesPath, profile.time));
            } catch (_error) {}
        },
        async handleEditItem(index) {
            const language = getLanguage();
            const profile = { ...this.pfs.files[index] };
            const data = [{ key: "name", name: language.name(), required: true, value: profile.name },
                { key: "url", name: "URL", value: profile.url },
                { key: "headers", name: language.headers(), value: profile.headers, placeholder: "key1:value1\nkey2:value2" },
                {
                    key: "interval", name: language.updateInterval(), value: profile.interval ?? 0,
                    validate: value => /^\d+$/.test(value) ? "" : language.updateIntervalMustBeInteger()
                },
                { key: "cron", name: `${language.updateCron()}Cron (UNIX)`, value: profile.cron ?? "", placeholder: "0 0 * * *" }];
            try {
                const result = await this.$input({ title: language.editProfileInformation(), data });
                Object.assign(profile, {
                    name: result.name || "", url: result.url || "", interval: 1 * (result.interval || 0),
                    cron: result.cron || "", headers: result.headers || ""
                });
                this.changeProfile({ index, profile });
            } catch (_error) {}
        },
        listItemClassNames(index) {
            const classes = ["list-item"];
            if (this.pfs.files[index].url === "") classes.push("item-local");
            if (index === (this.pfs.index ?? -1)) classes.push("item-cur");
            return classes;
        },
        async handleURLConfirm(event) { if (event.keyCode === 13) await this.handleDownload(); },
        async handleDownload() {
            if (this.subUrl === "" || this.btnType === 3) return;
            try {
                this.btnType = 3;
                if (await this.updateConfig({ url: this.subUrl, selectAfterUpdated: true })) {
                    this.subUrl = "";
                    this.btnType = 2;
                } else this.btnType = 1;
            } catch (_error) { this.btnType = 1; }
            schedule(() => { this.btnType = 0; }, 3000);
        },
        async handleImport() {
            const files = await electron.ipcRenderer.invoke("dialog", "showOpenDialogSync", { properties: ["openFile"] });
            if (files?.length) this.localCopy(path.basename(files[0]), path.resolve(files[0]));
        },
        dropProfile(event) {
            event.preventDefault();
            event.stopPropagation();
            for (const file of event.dataTransfer.files) this.localCopy(path.basename(file.path), path.resolve(file.path));
        },
        dragOverProfile(event) { event.preventDefault(); event.stopPropagation(); },
        editDone() {
            const index = this.pfs.files.findIndex(profile => profile.time === this.editProfileName);
            if (index === this.pfs.index) this.switchProfile(index);
            this.editProfileName = "";
            this.editProfileType = -1;
        },
        localCopy(name, source = "") {
            if (name === "") return;
            const time = `${Date.now()}.yml`;
            const profiles = { ...this.pfs };
            const duplicate = profiles.files.findIndex(profile => profile.name === name && profile.url === "");
            if (duplicate > -1 && duplicate < profiles.files.length) {
                this.$alert({ content: labels.localFileAlreadyExist(), title: labels.error() });
                return;
            }
            this.appendProfile({ profile: { url: "", time, name, selected: [] } });
            let copyFrom = path.join(this.clashPath, "config.yaml");
            const selectedIndex = profiles.index ?? -1;
            if (selectedIndex >= 0 && selectedIndex < profiles.files.length) {
                const selected = path.join(this.profilesPath, profiles.files[selectedIndex].time);
                if (fs.existsSync(selected)) copyFrom = selected;
            }
            if (source !== "") copyFrom = source;
            fs.copyFileSync(copyFrom, path.join(this.profilesPath, time));
        },
        async handleDeleteProfile(index) {
            const language = getLanguage();
            const profile = this.pfs.files[index];
            const response = await showMessageBox({
                type: "warning",
                message: `${language.askDelete()}"${profile.name}"?`,
                buttons: [language.no(), language.yes()]
            });
            if (response.response !== 1) return;
            try {
                const base = profile.time.slice(0, -4);
                for (const name of [profile.time, `${base}.base.yml`, `${base}.change.yml`]) {
                    const target = path.join(this.profilesPath, name);
                    if (fs.existsSync(target)) fs.unlinkSync(target);
                }
            } catch (_error) {}
            this.deleteProfile({ index });
            const selected = this.pfs.index ?? -1;
            if (index === selected) this.changeProfilesIndex({ index: -1 });
            else if (index < selected) this.changeProfilesIndex({ index: selected - 1 });
        },
        async openProfile(profile, externally = false) {
            const target = path.join(this.profilesPath, profile.time);
            if (externally) {
                electron.shell.openPath(target);
                return;
            }
            try {
                const { code = "" } = await this.$code({
                    code: fs.readFileSync(target).toString(),
                    fontSize: this.settings.editorFontSize
                });
                fs.writeFileSync(target, code);
            } catch (_error) {}
        },
        async handleProfileClick(index) {
            this.loadingProfileIndex = [...this.loadingProfileIndex, index];
            try { await this.switchProfile(index); }
            catch (error) {
                this.changeProfilesIndex({ index: -1 });
                await showMessageBox({
                    type: "error", message: labels.couldNotSwitchProfile(),
                    detail: error.message || String(error), buttons: [labels.ok()]
                });
            }
            this.loadingProfileIndex = this.loadingProfileIndex.filter(value => value !== index);
        },
        async switchProfile(index) {
            if (index === -1) return;
            const previous = this.pfs.index;
            this.changeProfilesIndex({ index });
            const { success, message } = await this.$parent.refreshProfile();
            if (!success) {
                const response = await showMessageBox({
                    type: "error", message: labels.couldNotSwitchProfile(), detail: message || "",
                    buttons: labels.editInTextMode()
                });
                if (response.response === 1) this.openProfile(this.pfs.files[index]);
                this.changeProfilesIndex({ index: -1 });
            } else if (index !== previous && (this.settings.connProfile ?? false)) {
                await this.clashApi.closeConnections();
            }
        },
        async refreshProfile(profile, { ignoreSelectAfterUpdated = false } = {}) {
            const { url = "", headers = "" } = profile;
            if (url === "") return;
            const existing = this.downlodingUrls[url];
            if (existing) {
                existing(MANUAL_STOP);
                this.$delete(this.downlodingUrls, url);
                return;
            }
            try {
                const cancelToken = new CancelToken(cancel => {
                    this.downlodingUrls = { ...this.downlodingUrls, [url]: cancel };
                });
                return await this.updateConfig({
                    url,
                    cancelToken,
                    selectAfterUpdated: !ignoreSelectAfterUpdated && (this.settings.selectAfterUpdated ?? false),
                    headers
                });
            } catch (error) {
                this.$alert({ content: error?.message || String(error) });
                return false;
            }
            finally { this.$delete(this.downlodingUrls, url); }
        },
        editProfile(profile) { this.editProfileName = profile.time; this.editProfileType = 0; },
        editProfileRule(profile) { this.editProfileName = profile.time; this.editProfileType = 1; },
        parseDomain(value) {
            const fallback = "local file";
            try {
                const url = new URL(value);
                return url.protocol === "file:" ? fallback : url.host || "empty host";
            } catch (_error) { return fallback; }
        },
        parseTime({ time }) {
            try {
                return moment(fs.statSync(path.join(this.profilesPath, time)).mtime).locale(labels.locale()).from(this.now);
            } catch (_error) { return "missing file"; }
        },
        async updateConfig({ url, headers = "", cancelToken = null, selectAfterUpdated = false }) {
            let result;
            try {
                result = await downloadProfile({ url, cancelToken, headersString: headers });
            } catch (error) {
                result = { success: false, message: error?.message || String(error) };
            }
            const { success = false, message = "Unknown profile download error", targetIndex } = result || {};
            if (success) {
                if (selectAfterUpdated) await this.switchProfile(targetIndex).catch(() => {});
                this.now = moment();
            } else if (!String(message).endsWith(MANUAL_STOP)) this.$alert({ content: message });
            return success;
        },
        subInfoArr({ upload = 0, download = 0, total = 0, expire = 0 }) {
            if (upload >= 0 && download >= 0 && total > 0) {
                const values = [formatBytes(upload + download, 1, false), formatBytes(total, 1, false)];
                return expire ? [...values, moment(1000 * expire).format("YYYY-MM-DD")] : values;
            }
            return "";
        },
        subInfoPercent({ upload = 0, download = 0, total = 0 }) {
            if (upload >= 0 && download >= 0 && total > 0) {
                const percent = (upload + download) / total * 100;
                return { "clip-path": `inset(0 ${percent <= 100 ? 100 - percent : 0}% 0 0)` };
            }
            return { "clip-path": "inset(0 100% 0 0)" };
        },
        async pasteURL() {
            this.inputFocus = false;
            try {
                this.subUrl = await electron.clipboard.readText();
            } finally {
                this.inputFocus = true;
            }
        },
        async makeDiff(profile) {
            const language = getLanguage();
            const content = fs.readFileSync(path.join(this.profilesPath, profile.time), "utf8").toString();
            const basePath = path.join(this.profilesPath, `${profile.time.slice(0, -4)}.base.yml`);
            const changePath = path.join(this.profilesPath, `${profile.time.slice(0, -4)}.change.yml`);
            const initialized = fs.existsSync(basePath) && fs.existsSync(changePath);
            const items = initialized ? language.makeChangesAndDelete() : [language.initDiffFiles()];
            const itemStyles = initialized ? [{}, { color: "mc" }] : [];
            const [selection] = await this.$select({
                title: "Diff",
                html: `${language.diffDescribe()} <a href="https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/contents/diff.html">${language.docs()}</a>`,
                items,
                itemStyles
            });
            const edit = async () => {
                const base = fs.readFileSync(basePath, "utf8").toString();
                const change = fs.readFileSync(changePath, "utf8").toString();
                fs.writeFileSync(changePath, await this.$diff({ base, change }));
                const response = await showMessageBox({
                    message: language.requestRefresh(), buttons: language.requestRefreshOption(), defaultId: 0
                });
                if (response.response === 0) this.refreshProfile(profile, { ignoreSelectAfterUpdated: true });
            };
            if (initialized) {
                if (selection === 0) edit();
                else if (selection === 1) {
                    const response = await showMessageBox({
                        type: "warning", message: `${language.askDelete()}${language.diffFiles()}?`,
                        buttons: [language.no(), language.yes()]
                    });
                    if (response.response === 1) { fs.unlinkSync(basePath); fs.unlinkSync(changePath); }
                }
            } else {
                fs.writeFileSync(basePath, content);
                fs.writeFileSync(changePath, content);
                edit();
            }
        },
        setupWatcher() {
            const onChange = lodash.debounce((_event, filename) => {
                if (!/^\d+(?:\.yml)$/.test(filename)) return;
                const index = this.pfs.files.findIndex(profile => profile.time === filename);
                if (index > -1 && index === this.pfs.index) this.switchProfile(index);
            }, 0);
            this.fileWatcher = fs.watch(path.join(this.profilesPath), {}, onChange);
        },
        removeWatcher() { if (this.fileWatcher) this.fileWatcher.close(); }
    };

    function beforeRouteEnter(_to, _from, next) {
        next(async vm => {
            vm.now = moment();
            vm.intervalID = scheduler.add(() => { vm.now = moment(); }, 60000);
            vm.setupWatcher();
            if (vm.pfs.files?.length === 0) {
                vm.localCopy("config.yaml");
                await vm.switchProfile(0);
            }
        });
    }

    function beforeRouteLeave(_to, _from, next) {
        if (this.intervalID) scheduler.stop(this.intervalID);
        this.removeWatcher();
        for (const url in this.downlodingUrls) this.downlodingUrls[url](MANUAL_STOP);
        next();
    }

    return { data, computed, methods, beforeRouteEnter, beforeRouteLeave };
}

module.exports = { MANUAL_STOP, createServerPageWorkflow };
