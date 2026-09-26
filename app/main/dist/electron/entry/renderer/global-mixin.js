"use strict";

const { createSettingsProxy } = require("../../features/settings/settings-proxy");
const { loadSettingsFromDisk } = require("../../features/settings/load-settings");

function createGlobalMixin({ Vuex, platform, ipcRenderer, fs, path, yaml, cloneDeep, modifyState, schedule = setTimeout }) {
    return {
        data() { return { mixinScrollTop: 0 }; },
        computed: {
            ...Vuex.mapState({ clashPath: state => state.app.clashPath, sts: state => state.app.settings }),
            ...Vuex.mapGetters({ theme: "theme", clashApi: "clashApi" }),
            isWindows() { return platform === "win32"; },
            isMacOS() { return platform === "darwin"; },
            isLinux() { return platform === "linux"; },
            settings() {
                return createSettingsProxy({
                    getSettings: () => this.sts,
                    saveSettings: obj => this.saveSettingsObject({ obj }), cloneDeep
                });
            }
        },
        methods: {
            ...Vuex.mapMutations({ saveSettingsObject: "SAVE_SETTINGS_OBJECT", setSettingsObject: "SET_SETTINGS_OBJECT" }),
            async reloadElectron() {
                await ipcRenderer.invoke("app", "relaunch");
                await ipcRenderer.invoke("app", "exit", 0);
            },
            loadSettings() {
                const mergedSettings = loadSettingsFromDisk({
                    fs, path, yaml, clashPath: this.clashPath,
                    onProfileLanguage(language) { modifyState.languageInProfile = language; }
                });
                this.setSettingsObject({ obj: mergedSettings });
            }
        },
        beforeRouteEnter(to, from, next) {
            next(vm => {
                const ref = vm.$refs["mixin-scroll-content"];
                if (!ref) return;
                const element = "$el" in ref ? ref.$el : ref;
                element.style.scrollBehavior = "auto";
                schedule(() => { element.style.scrollBehavior = "smooth"; }, 1);
                vm.$nextTick(() => { element.scrollTop = vm.mixinScrollTop; });
            });
        },
        beforeRouteLeave(to, from, next) {
            const ref = this.$refs["mixin-scroll-content"];
            if (ref) this.mixinScrollTop = "$el" in ref ? ref.$el.scrollTop : ref.scrollTop;
            next();
        }
    };
}

module.exports = { createGlobalMixin };
