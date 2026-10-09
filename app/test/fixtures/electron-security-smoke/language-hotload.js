"use strict";

// Serialized into the isolated renderer world by the native smoke fixture.
async function verifyLanguageHotload() {
    const root = document.querySelector("#app").__vue__;
    const descendants = vm => [vm, ...vm.$children.flatMap(descendants)];
    const settings = descendants(root).find(vm => vm.$options._scopeId === "data-v-fc0cd1de");
    const selection = descendants(settings).find(vm => vm.items?.[0] === "简体中文");
    if (!selection) throw Error("Language dropdown was not rendered");
    const route = root.$route.path;
    const uid = settings._uid;
    const sidebar = descendants(root).find(vm => vm.$options._scopeId === "data-v-149ea1bd");
    const paths = sidebar.tabs.map(tab => tab.path).join(",");
    const scrollTop = settings.scrollTop;
    const original = selection.index;
    for (const index of [1, 0, 1, original]) {
        selection.handleItemClick(index);
        await root.$nextTick();
        const menu = Array.from(document.querySelectorAll(".main-main-menu li.item"))
            .map(item => item.innerText.trim());
        const checks = {
            settingsText: menu.some(text => text.includes(index === 0 ? "设置" : "Settings")),
            generalText: menu.some(text => text.includes(index === 0 ? "主页" : "General")),
            sections: settings.sections[0] === (index === 0 ? "安全" : "Security"),
            savedSetting: root.$store.state.app.settings.language === index,
            route: root.$route.path === route, selection: selection.index === index,
            order: sidebar.tabs.map(tab => tab.path).join(",") === paths,
            settingsInstance: descendants(root).find(vm => vm.$options._scopeId === "data-v-fc0cd1de")._uid === uid,
            rootInstance: document.querySelector("#app").__vue__ === root,
            scroll: settings.scrollTop === scrollTop
        };
        const failed = Object.keys(checks).filter(key => !checks[key]);
        if (failed.length) throw Error(`Language hotload failed (${index}): ${failed.join(", ")}`);
    }
    return true;
}

module.exports = { verifyLanguageHotload };
