"use strict";

// Runs in the private browser world against the fixture's temporary profile.
// Native effects are replaced by main.js/native-boundaries.js, not by the UI.
async function verifyInteractionAudit() {
    const root = document.querySelector("#app").__vue__;
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const tick = async () => { await root.$nextTick(); await wait(35); };
    const result = { General: [], Proxies: [], Profiles: [], Logs: [], Connections: [], Settings: [], models: [] };
    function assert(value, label) { if (!value) throw Error(`Interaction audit: ${label}`); }
    function components(parent = root) { return [parent, ...parent.$children.flatMap(child => components(child))]; }
    const home = components().find(vm => vm.$options.name === "landing-page");
    assert(home, "home component");
    const settingsBefore = JSON.parse(JSON.stringify(home.settings));
    const originalRestart = home.handlerRestartClash;
    // Core process compatibility and restart ordering are verified separately;
    // the browser walk checks the controls without relaunching its own fixture.
    home.handlerRestartClash = async () => true;
    function nodes(vm) {
        const found = [], visited = new Set();
        function walk(node) {
            if (!node || visited.has(node)) return;
            visited.add(node); found.push(node);
            for (const child of node.children || node.componentOptions?.children || []) walk(child);
            if (node.componentInstance) walk(node.componentInstance._vnode);
        }
        walk(vm._vnode); return found;
    }
    function functions(handler) {
        if (Array.isArray(handler)) return handler.flatMap(functions);
        if (handler?.fns) return functions(handler.fns);
        return typeof handler === "function" ? [handler] : [];
    }
    function action(vm, name, event) {
        for (const node of nodes(vm)) for (const type of event ? [event] : ["click", "contextmenu"]) {
            const handlers = [...functions(node.data?.on?.[type]), ...functions(node.componentOptions?.listeners?.[type])];
            if (handlers.some(fn => fn === vm[name] || String(fn).includes(name))) return { node, type };
        }
        const icons = { openCmdWithProxy: "terminal", isInterfacesVisible: "device_hub", handleShowDNSQueryDialog: "dns",
            handleShowScriptTestDialog: "play_arrow", handlePreviewCurrentPayload: "memory", handleEditMixin: "settings", isTunSettingsVisible: "settings" };
        if (icons[name]) {
            const candidates = [...vm.$el.querySelectorAll(".icon")].filter(item => item.textContent.trim() === icons[name]);
            const element = name === "handleEditMixin" ? candidates.at(-1) : candidates[0];
            if (element) return { node: { elm: element }, type: "click" };
        }
    }
    async function fire(vm, name, event) {
        const binding = action(vm, name, event);
        assert(binding?.node.elm?.dispatchEvent, `rendered binding ${name}`);
        binding.node.elm.dispatchEvent(new MouseEvent(binding.type, { bubbles: true, cancelable: true, button: binding.type === "contextmenu" ? 2 : 0 }));
        await tick();
    }
    function activePlugin() {
        // Dialog plugins have their own Vue roots and are not children of #app.
        for (const element of [...document.querySelectorAll(".no-esc")].reverse()) {
            let vm = element.__vue__;
            while (vm) {
                if (vm.isShow === true && ["CodeView", "SelectPlugin", "InputView", "ScriptView", "DNSView", "AlertView", "DiffView", "MenuView"].includes(vm.$options.name)) return vm;
                vm = vm.$parent;
            }
        }
    }
    async function dismiss() {
        for (let count = 0; count < 5; count++) {
            const plugin = activePlugin();
            if (!plugin) break;
            if (plugin.handleCancel) await plugin.handleCancel();
            else if (plugin.cancel) await plugin.cancel();
            else throw Error(`Interaction audit: no cancel for ${plugin.$options.name}`);
            await tick();
        }
    }
    async function open(vm, method, page, expected) {
        await fire(vm, method);
        assert(expected ? document.querySelector(expected) : activePlugin(), `${method} opens its interaction`);
        result[page].push(method);
        await dismiss();
    }
    async function navigate(label, selector) {
        await dismiss();
        const menu = [...document.querySelectorAll(".main-main-menu li.item")].find(item => label.test(item.innerText));
        assert(menu, `navigation ${label}`); menu.click(); await wait(200); await tick();
        const element = document.querySelector(selector);
        const scopes = { ".main-general-view": "data-v-357ec510", "#main-server-view": "data-v-820f0efe", "#main-proxy-view": "data-v-0729f95b",
            ".main-setting-view": "data-v-fc0cd1de", ".main-log-view": "data-v-6acd51f2", ".main-connection-view": "data-v-39b270f2" };
        const vm = components().find(candidate => candidate.$options._scopeId === scopes[selector]);
        assert(vm && element, `page ${selector}`); return vm;
    }
    async function settle() {
        for (let attempt = 0; attempt < 120 && home.proxyBusy; attempt++) await wait(25);
        assert(!home.proxyBusy, "proxy operation completes"); await tick();
    }
    async function models(vm, prefix, visited = new Set()) {
        // Controls appear conditionally after switching another setting. Rescan
        // until every currently reachable model has been exercised.
        for (let pass = 0; pass < 3; pass++) {
            const current = nodes(vm).filter(node => node.data?.model && node.componentInstance);
            for (const node of current) {
                const expression = node.data.model.expression;
                let child = node.componentInstance;
                const identity = `${prefix}/${expression}/${child.$options.name || child.$options._scopeId}`;
                if (visited.has(identity) || child._isDestroyed) continue;
                visited.add(identity);
                const value = node.data.model.value;
                // These confirmation branches were exercised by ui-regressions
                // with both locales and the native confirmation boundary.
                if (/allowRemoteProfileParsers|allowHttpExternalLinks/.test(expression)) continue;
                if (child.$options.name === "SelectView") {
                    const original = child.index;
                    const count = child.items.length;
                    const live = () => nodes(vm).find(candidate => candidate.data?.model?.expression === expression && candidate.componentInstance?.$options.name === "SelectView")?.componentInstance;
                    for (let index = 0; index < count; index++) {
                        child = live();
                        if (!child) break;
                        child.$el.children[index].click(); await settle();
                        assert(child.index === index, `selection ${identity}/${index}`);
                        await models(vm, prefix, visited);
                    }
                    child = live();
                    if (child) child.$el.children[original ?? 0]?.click();
                    else node.data.model.callback(value);
                    await settle();
                } else if (child.$options.props?.on && child.$el?.click && child.handleClick) {
                    child.$el.click(); await settle();
                    assert(child.on === !value, `switch ${identity}`);
                    await models(vm, prefix, visited);
                    child.$el.click(); await settle();
                } else if (child.handleTextChange && child.handleBlur) {
                    const input = child.$el.querySelector("input");
                    if (!input) continue;
                    const initial = input.value;
                    const changed = input.type === "number" ? "16" : "fixture-value";
                    input.value = changed; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("blur"));
                    await tick();
                    assert(!child.validationError, `input ${identity}`);
                    assert(String(child.value) === changed, `input updates its setting ${identity}`);
                    input.value = initial; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("blur")); await tick();
                } else if (child.$options.name === "EditListView" && !child.disabled) {
                    const original = child.list.length;
                    child.$el.querySelector(".btn-add").click(); await tick(); assert(child.list.length === original + 1, `add ${identity}`);
                    const input = child.$el.querySelectorAll("input")[original]; input.value = "fixture.test"; input.dispatchEvent(new Event("input", { bubbles: true })); await tick();
                    assert(child.list[original] === "fixture.test", `edit ${identity}`);
                    [...child.$el.querySelectorAll(".btn-remove")].at(-1).click(); await tick(); assert(child.list.length === original, `remove ${identity}`);
                } else if (child.$options.name === "EditObjectView" && !child.disabled) {
                    const key = "fixture.audit.test";
                    const input = child.$el.querySelector("input[placeholder]");
                    assert(input, `object key field ${identity}`);
                    input.value = key; input.dispatchEvent(new Event("input", { bubbles: true })); await tick();
                    await fire(child, "handleAddItem"); assert(Object.hasOwn(child.object, key), `object add ${identity}`);
                    const remove = [...child.$el.querySelectorAll(".item")].find(item => item.textContent.includes(key))?.querySelector(".btn-remove");
                    assert(remove, `object remove control ${identity}`); remove.click(); await tick(); assert(!Object.hasOwn(child.object, key), `object remove ${identity}`);
                } else if (child.$options.name === "key-capture") {
                    const input = child.$el.querySelector("input"); input.click();
                    for (const [key, keyCode] of [["Control", 17], ["F12", 123], ["Enter", 13]]) input.dispatchEvent(new KeyboardEvent("keydown", { key, keyCode, bubbles: true }));
                    await tick(); assert(child.shortcut === "Control+F12", `shortcut capture ${identity}`);
                    child.$emit("change", value || ""); await tick();
                } else continue;
                result.models.push(identity);
            }
        }
    }
    try {
        const general = await navigate(/General|主页/i, ".main-general-view");
        const originalCore = general.settings.proxyCore;
        general.settings.proxyCore = "clash"; await tick();
        for (const method of ["handleEditMixedPort", "handleEditBindAddress", "handleEditLogLevel", "openCmdWithProxy",
            "handleEditMixin", "handleShowDNSQueryDialog", "handleShowScriptTestDialog", "handlePreviewCurrentPayload", "installService"]) {
            if (action(general, method)) await open(general, method, "General");
            else assert(false, `General ${method}; scope ${general.$options._scopeId}, method ${typeof general[method]}, event nodes ${nodes(general).filter(node => node.data?.on).length}`);
        }
        for (const node of nodes(general).filter(node => node.componentInstance?.$options.props?.on)) {
            const child = node.componentInstance;
            if (child.disabled || child.loading) continue;
            const original = child.on;
            child.$el.click(); await settle();
            assert(child.on === !original, "General toggle applies");
            child.$el.click(); await settle();
            result.General.push("toggle/apply/restore");
        }
        await fire(general, "installTapDevice");
        assert(document.querySelector(".cfw-tap-dialog"), "TAP management opens");
        const tap = general.$children.find(vm => vm.$options.props?.installed && vm.$options.props?.busy);
        assert(tap, "TAP dialog component");
        for (const index of [0, 1, 0]) {
            tap.$el.querySelectorAll(".cfw-tap-actions button")[index].click(); await tick();
            assert(tap.busy && tap.$el.querySelector("footer button").disabled, "TAP Close disabled while native setup runs");
            tap.$el.querySelector("footer button").click();
            tap.$el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
            tap.$el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); await tick();
            assert(general.isTapManagementVisible, "TAP cannot close during setup");
            await settle(); assert(general.tapInstalled === (index === 0), "TAP installation status after native completion");
        }
        result.General.push("TAP/install/uninstall/busy-close");
        const customize = tap.$el.querySelectorAll(".cfw-tap-actions button")[2];
        customize.click(); await tick(); assert(activePlugin(), "TAP customization form"); await dismiss(); await settle();
        tap.$el.querySelector("footer button").click(); await tick();
        assert(!document.querySelector(".cfw-tap-dialog"), "TAP Close after completion"); result.General.push("TAP/customize/close");
        for (const property of ["isTunSettingsVisible", "isInterfacesVisible", "isResetDNSSettingsVisible"]) {
            if (property === "isResetDNSSettingsVisible" && !general.isMacOS) continue;
            const binding = nodes(general).find(node => ["click", "contextmenu"].some(type => functions(node.data?.on?.[type]).some(fn => String(fn).includes(property))))
                || action(general, property)?.node;
            assert(binding, `General nested entry ${property}; launching ${general.isLaunching}; icons ${[...general.$el.querySelectorAll(".icon")].map(item => item.textContent.trim()).join(",")}`);
            const type = functions(binding.data?.on?.contextmenu).some(fn => String(fn).includes(property)) ? "contextmenu" : "click";
            binding.elm.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: type === "contextmenu" ? 2 : 0 })); await tick();
            assert(general[property] === true, `General nested view ${property}`);
            const view = general.$children.find(child => child.$options.name === { isTunSettingsVisible: "TunSettingsView", isInterfacesVisible: "InterfacesView", isResetDNSSettingsVisible: "ResetDNSSettingsView" }[property]);
            assert(view?.$el?.nodeType === 1, `rendered ${property}`);
            await models(view, property); view.$emit("close");
            general[property] = false; await tick(); result.General.push(property);
        }
        const settings = await navigate(/Settings|设置/i, ".main-setting-view");
        general.settings.proxyCore = originalCore; await tick();
        const editorMethods = ["handleEditBypass", "handleEditPACContent", "handleEditMixinYAML", "handleEditMixinJS", "handleEditUnsafeURLs", "handleEditHeaders",
            "handleEditChildProcess", "handleEditActionScripts", "handleEditSSIDStrategy", "handleEditProfileParsers"];
        for (const method of editorMethods) {
            settings.settings.systemProxyTypeIndex = method === "handleEditPACContent" ? 1 : 0;
            settings.settings.mixinType = method === "handleEditMixinJS" ? 1 : 0;
            await tick(); await open(settings, method, "Settings", ".main-code-view");
        }
        for (const method of ["handleSelectInterface", "handleFetchCurrentSSID", "handleReset"]) await open(settings, method, "Settings");
        await models(settings, "Settings");
        // Cover the alternate PAC and JS Mixin branches, then restore defaults.
        settings.settings.systemProxyTypeIndex = 1; settings.settings.mixinType = 1; await tick(); await models(settings, "Settings/PAC/JS");
        for (const method of ["handleChooseDefaultIcon", "handleChooseSystemProxytOnIcon", "handleChooseProfilePath", "handleSelectTrayScriptPath",
            "handleOpenGUILog", "handleOpenGUIDataFolder", "handleOpenActionScriptsConsoleFile", "handleOpenConsoleFile", "handleGenerateUUIDSecret", "handleQuit", "handlerClearFakeIPCache"]) {
            if (!action(settings, method)) continue;
            await fire(settings, method); await dismiss(); result.Settings.push(method);
        }
        const profiles = await navigate(/Profiles|配置/i, "#main-server-view");
        const remoteIndex = Math.max(0, profiles.profiles.findIndex(profile => profile.url));
        profiles.$set(profiles.profiles[remoteIndex], "homeWeb", "https://example.test/"); await tick();
        const card = profiles.$el.querySelectorAll(".list-item")[remoteIndex]; assert(card, "profile fixture card");
        card.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 })); await tick();
        let menu = activePlugin(); assert(menu?.$options.name === "MenuView", "profile right-click menu");
        const entries = menu.items.filter(item => !item.hide && !item.disabled).map(item => item.text);
        menu.handleCancel();
        for (const text of entries) {
            profiles.$el.querySelectorAll(".list-item")[remoteIndex].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 })); await tick();
            menu = activePlugin();
            const item = [...menu.$el.querySelectorAll(".item.clickable")].find(element => element.innerText.trim().endsWith(text));
            assert(item, `profile menu item ${text}`); item.click(); await tick();
            const graphics = profiles.$children.find(child => child.$options.props?.profileName && child.$el?.nodeType === 1);
            if (graphics) { await models(graphics, "Profiles/editor"); graphics.$emit("cancel"); }
            const qr = profiles.$children.find(child => child.$options.name === "QRCodeView");
            if (qr) { await wait(100); assert(qr.src.startsWith("data:image/png"), "QR image"); qr.$el.querySelector(".btn").click(); await tick(); qr.$emit("hide"); }
            const selection = activePlugin();
            if (selection?.$options.name === "SelectPlugin" && (text === "Diff" || /Parser|解析/.test(text))) {
                selection.$el.querySelector(".btns .btn")?.click(); await tick(); await wait(100);
                assert(activePlugin()?.$options.name === (text === "Diff" ? "DiffView" : "CodeView"), `nested ${text} editor`);
            }
            await dismiss(); await settle(); result.Profiles.push(text);
        }
        const logs = await navigate(/Logs|日志/i, ".main-log-view");
        logs.parseLog({ level: "info", message: "fixture audit", fields: [{ key: "rAddr", value: "fixture.audit.test:443" }] }); await tick();
        const log = logs.$el.querySelector(".log-item"); assert(log, "log row"); log.click(); await tick();
        assert(logs.showDetailItemIDs.length > 0, "log details expand");
        log.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 })); await tick();
        menu = activePlugin(); assert(menu?.$options.name === "MenuView", "log context menu");
        menu.$el.querySelector(".item.clickable").click(); await tick();
        await models(logs, "Logs");
        logs.$el.querySelector(".button-clear").click(); await tick(); assert(logs.listData.length === 0, "clear logs");
        const pauseButton = logs.$el.querySelector(".button-on, .button-off"); pauseButton.click(); await tick(); assert(logs.isPaused, "pause logs"); pauseButton.click(); await tick();
        result.Logs.push("details", "context-copy", "style/level", "clear", "pause/resume");
        const connections = await navigate(/Connections|连接/i, ".main-connection-view"); await wait(150);
        connections.$el.querySelector("input").click(); await tick(); assert(connections.isShowTypeFilter, "connection filter opens");
        const filters = nodes(connections).filter(node => functions(node.data?.on?.click).some(fn => /filterTypeIndex\s*=/.test(String(fn))));
        assert(filters.length === 9, "all connection filter fields");
        for (let index = 0; index < filters.length; index++) { filters[index].elm.click(); await tick(); assert(connections.filterTypeIndex === index, "connection filter type"); }
        connections.isShowTypeFilter = false; result.Connections.push("nine filter fields");
        const row = nodes(connections).find(node => functions(node.data?.on?.click).some(fn => String(fn).includes("handleItemSelected")));
        assert(row?.elm, "connection row"); row.elm.click(); await tick();
        const details = connections.$children.find(child => child.$options.name === "ConnectionInfoView");
        assert(details?.$el.querySelector(".content-list"), "connection details");
        const copy = details.$el.querySelector(".item-value > div"); assert(copy, "connection copy"); copy.click(); details.$emit("close"); await tick();
        for (const method of ["handleSwitchPauseStatus", "handleCloseAllConnections"]) { await fire(connections, method); result.Connections.push(method); }
        await fire(connections, "handleSwitchPauseStatus");
        for (const label of connections.$el.querySelectorAll(".label")) { label.click(); await tick(); }
        result.Connections.push("details/copy", "sort/reverse");
        const proxies = await navigate(/Proxies|代理/i, "#main-proxy-view");
        proxies.settings.showProxyFilter = true; await tick();
        // Drive all four legacy modes, then verify the Mihomo branch hides Script.
        proxies.settings.proxyCore = "clash"; await tick();
        for (const button of proxies.$el.querySelectorAll("#main-mode-switcher .btn")) { button.click(); await settle(); assert(button.classList.contains("selected"), "proxy mode selection"); result.Proxies.push("mode"); }
        const rule = [...proxies.$el.querySelectorAll("#main-mode-switcher .btn")].find(button => /Rule|规则/i.test(button.textContent));
        rule.click(); await settle(); proxies.settings.proxyCore = "mihomo"; await tick();
        assert(proxies.$el.querySelectorAll("#main-mode-switcher .btn").length === 3, "Mihomo hides Script mode");
        assert(proxies.proxies.length > 0, "proxy groups");
        await fire(proxies, "handleFilterIconClick"); await tick(); assert(proxies.isShowFilter, "proxy filter");
        proxies.filterKeyword = "["; await tick(); proxies.filterKeyword = "";
        for (let index = 0; index < proxies.proxyInMode.length; index++) {
            const group = proxies.proxyInMode[index];
            await proxies.switchVisible(index); await tick();
            if (!proxies.showSecIdxs.includes(index)) await proxies.switchVisible(index);
            await tick();
            const proxyNode = nodes(proxies).find(node => functions(node.data?.on?.contextmenu).some(fn => String(fn).includes("handleProxyRightClick")));
            if (proxyNode?.elm) { proxyNode.elm.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 })); await tick(); assert(activePlugin(), "proxy context menu"); await dismiss(); }
            await proxies.startLatencyTest(group.name, index); await tick();
            const selectable = proxies.$el.querySelector(".proxy-item.clickable:not(.selected)");
            if (selectable) { selectable.click(); await tick(); assert(selectable.classList.contains("selected"), "proxy node selection"); }
            await proxies.switchHideTimeout(group.name); await proxies.switchHideTimeout(group.name);
            result.Proxies.push(`group/${group.name}/expand/context/test/hide-timeout`);
        }
        // Exercise every contextual branch, including the nested-group scroll
        // action, navigation to filtered connections, and the saved script hook.
        const contextNodes = nodes(proxies).filter(node => functions(node.data?.on?.contextmenu).some(fn => String(fn).includes("handleProxyRightClick")));
        const contextNode = contextNodes.find(node => /Auto/.test(node.elm.textContent)) || contextNodes[0];
        assert(contextNode, "proxy context target");
        contextNode.elm.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 })); await tick();
        const contextItems = activePlugin().items.filter(item => !item.hide && !item.disabled).map(item => item.text); await dismiss();
        for (const text of contextItems) {
            contextNode.elm.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 })); await tick();
            const item = [...activePlugin().$el.querySelectorAll(".item.clickable")].find(element => element.textContent.trim().endsWith(text));
            assert(item, `proxy menu ${text}`); item.click(); await tick();
            if (home.$route.path === "/home/connection") { assert(home.$route.query.searchText, "proxy opens filtered connections"); await navigate(/Proxies|代理/i, "#main-proxy-view"); }
            await dismiss(); result.Proxies.push(`context/${text}`);
        }
        assert(result.models.length >= 25, "settings and nested models were exercised");
        return { counts: Object.fromEntries(Object.entries(result).map(([key, items]) => [key, items.length])), checks: result };
    } finally {
        await dismiss();
        home.handlerRestartClash = originalRestart;
        home.saveSettingsObject?.({ obj: settingsBefore });
    }
}

module.exports = { verifyInteractionAudit };
