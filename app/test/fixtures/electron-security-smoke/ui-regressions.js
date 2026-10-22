"use strict";

// Runs only in the dashboard's private browser world, against the temporary fixture.
async function verifyUiRegressions() {
    const wait = duration => new Promise(resolve => setTimeout(resolve, duration));
    async function complete(operation, label) {
        let timer;
        try { return await Promise.race([operation, new Promise((_resolve, reject) => {
            timer = setTimeout(() => reject(Error(`UI operation timed out: ${label}`)), 3000);
        })]); } finally { clearTimeout(timer); }
    }
    const root = document.querySelector("#app").__vue__;
    function findComponent(predicate, component = root) {
        if (predicate(component)) return component;
        for (const child of component.$children) {
            const match = findComponent(predicate, child);
            if (match) return match;
        }
    }
    async function navigate(label) {
        const item = Array.from(document.querySelectorAll(".main-main-menu li.item")).find(candidate => label.test(candidate.innerText));
        if (!item) throw Error("Missing regression test route");
        item.click();
        await wait(400);
    }
    await navigate(/Connections|连接/i);
    await wait(1400);
    const connections = document.querySelector(".right-side").innerText.includes("fixture.live.test");
    const traffic = document.querySelector(".main-clash-traffic-view").innerText;
    await wait(350);
    const trafficUpdates = traffic !== document.querySelector(".main-clash-traffic-view").innerText;
    await navigate(/Settings|设置/i);
    const settingsElement = document.querySelector(".main-setting-view");
    const settings = findComponent(component => component.$options._scopeId === "data-v-fc0cd1de");
    const securitySection = settingsElement.querySelector(".main-setting-section");
    const securityRows = Array.from(securitySection.querySelector(".content").children).filter(node => node.classList.contains("item"));
    async function editSecurityRow(index, field, value) {
        const original = settings.settings[field];
        securityRows[index].querySelector(".hint").click();
        await wait(450);
        let editor = document.querySelector(".main-code-view").__vue__;
        while (editor && editor.$options.name !== "CodeView") editor = editor.$parent;
        editor.editor.setValue(value);
        editor.save();
        await wait(100);
        settings.loadSettings();
        await root.$nextTick();
        const saved = settings.settings[field] === value;
        settings.settings[field] = original || "";
        return saved;
    }
    const originalUnsafeUrls = settings.settings.unsafeURLsText || "urls: []\n";
    securityRows[1].querySelector(".hint").click();
    await wait(500);
    let securityEditor = document.querySelector(".main-code-view").__vue__;
    while (securityEditor && securityEditor.$options.name !== "CodeView") securityEditor = securityEditor.$parent;
    const certificateText = "urls:\n  - https://certificate.test/profile.yaml\n";
    securityEditor.editor.setValue(certificateText);
    securityEditor.save();
    await wait(150);
    settings.loadSettings();
    await root.$nextTick();
    const certificateSaved = settings.settings.unsafeURLsText === certificateText;
    settings.settings.unsafeURLsText = originalUnsafeUrls;
    const advertisementToggle = securityRows[2].querySelector("[data-v-37d0be30]");
    const originalAdsDisabled = settings.settings.disableLoadingAdsLink;
    advertisementToggle.click();
    await wait(100);
    settings.loadSettings();
    await root.$nextTick();
    const advertisementSaved = settings.settings.disableLoadingAdsLink === !originalAdsDisabled;
    advertisementToggle.click();
    await wait(100);
    const originSaved = await editSecurityRow(3, "unsafeURLOriginsText", "origins:\n  - https://certificate.test:8443\n");
    const limitsSaved = await editSecurityRow(4, "profileDownloadExceptionsText", "exceptions:\n  - url: https://download.test/profile.yaml\n    maxSizeMiB: 64\n    timeoutSeconds: 180\n    processingTimeoutSeconds: 600\n");
    let compatibilitySwitches = true;
    for (const [index, field] of [[5, "allowRemoteProfileParsers"], [6, "allowHttpExternalLinks"]]) {
        await root.$nextTick();
        const toggle = securityRows[index].querySelector("[data-v-37d0be30]");
        toggle.click();
        await wait(150);
        settings.loadSettings();
        await root.$nextTick();
        compatibilitySwitches = compatibilitySwitches && settings.settings[field] === true;
        toggle.click();
        await wait(100);
        compatibilitySwitches = compatibilitySwitches && settings.settings[field] === false;
    }
    const compatibilityLabels = [/Certificate Origin Exceptions|证书来源例外/, /Subscription Download Exceptions|订阅下载限制例外/,
        /Allow Remote JavaScript Parsers|允许远程 JavaScript 解析器/, /Allow HTTP Links in Browser|允许浏览器打开 HTTP 链接/]
        .every(label => label.test(securitySection.innerText));
    const securityChecks = { rows: securityRows.length === 7, compatibilityLabels, certificateSaved, originSaved, limitsSaved, compatibilitySwitches, advertisementSaved,
        advertisementRestored: settings.settings.disableLoadingAdsLink === originalAdsDisabled,
        secretAction: typeof settings.handleGenerateUUIDSecret === "function" };
    const securitySettings = Object.values(securityChecks).every(Boolean);
    if (!securitySettings) throw Error("Security settings UI failed: "
        + Object.entries(securityChecks).filter(([_name, passed]) => !passed).map(([name]) => name).join(", "));
    const scroller = settingsElement.querySelector(".content");
    const navigatorItems = settingsElement.querySelectorAll(".main-proxy-navigator .item");
    navigatorItems[navigatorItems.length - 1].click();
    // Chromium may advance smooth scrolling slowly while a package is loading.
    for (let attempt = 0; attempt < 30 && scroller.scrollTop <= scroller.clientHeight; attempt++) await wait(50);
    const settingsNavigation = scroller.scrollTop > scroller.clientHeight;
    settings.settings.trayOrders = [["traffic"], []];
    await wait(350);
    const trayDelayVisible = /Show Tray Proxy Delay Indicator|在托盘代理中显示节点可用性/.test(settingsElement.innerText);
    const enhancedInfo = findComponent(component => component.$options.name === "info-icon" && component.rounded);
    if (!enhancedInfo) throw Error("Rounded Enhanced Tray info component was not rendered");
    enhancedInfo.$el.dispatchEvent(new MouseEvent("mouseenter"));
    await wait(600);
    const popupStyle = getComputedStyle(enhancedInfo.$refs.content);
    const enhancedTrayRounded = enhancedInfo.isShowContent && ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"].every(key => popupStyle[key] === "8px");
    enhancedInfo.$el.dispatchEvent(new MouseEvent("mouseleave"));
    const codeResult = root.$code({ code: "mode: rule\nproxies: []\nproxy-groups: []\nrules: []\n", language: "yaml" }).catch(() => {});
    await wait(500);
    const codeElement = document.querySelector(".main-code-view");
    const codeNavigator = codeElement.querySelector(".navigator");
    const cardBounds = codeElement.querySelector(".card").getBoundingClientRect();
    const navBounds = codeNavigator.getBoundingClientRect();
    const editorNavigationHeight = Math.abs(cardBounds.height - navBounds.height) < 2 && Math.abs(cardBounds.top - navBounds.top) < 2;
    const editorNavigationColor = getComputedStyle(codeNavigator.querySelector(".item")).color === "rgb(255, 255, 255)";
    const originalTheme = settings.settings.theme ?? 0;
    const originalSystemTheme = settings.settings.systemTheme === true;
    settings.settings.systemTheme = false;
    let editorNavigationExpandedContrast = true;
    for (const theme of [0, 1]) {
        settings.settings.theme = theme;
        await wait(100);
        const firstItem = codeNavigator.querySelector(".item");
        firstItem.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        await wait(100);
        editorNavigationExpandedContrast = editorNavigationExpandedContrast
            && getComputedStyle(codeNavigator).backgroundColor === "rgb(30, 30, 30)"
            && getComputedStyle(firstItem).color === "rgb(255, 255, 255)";
        codeNavigator.dispatchEvent(new MouseEvent("mouseleave"));
        await wait(100);
        editorNavigationExpandedContrast = editorNavigationExpandedContrast
            && getComputedStyle(codeNavigator).backgroundColor === "rgba(0, 0, 0, 0)"
            && getComputedStyle(firstItem).color === "rgb(255, 255, 255)";
    }
    settings.settings.theme = originalTheme;
    settings.settings.systemTheme = originalSystemTheme;
    codeElement.querySelector(".save-btn").click();
    await codeResult;
    await navigate(/Profiles|配置/i);
    const profiles = document.querySelectorAll(".list-view .list-item");
    profiles[profiles.length - 1].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, button: 2, buttons: 2, clientX: 400, clientY: 300 }));
    await wait(100);
    const diffAction = Array.from(document.querySelectorAll(".main-menu-view-plugin .item")).find(item => item.innerText.includes("Diff"));
    if (!diffAction) throw Error("Profile context menu has no Diff action");
    diffAction.click();
    await wait(250);
    document.querySelector(".main-select-view-plugin .btns .btn").click();
    await wait(500);
    const diffElement = document.querySelector(".main-diff-view");
    let diff = diffElement.__vue__;
    while (diff && diff.$options.name !== "DiffView") diff = diff.$parent;
    if (!diff) throw Error("Diff modal owner was not found");
    if (diff.renderSideBySide) diffElement.querySelector(".change-btn-off").click();
    await wait(100);
    diffElement.querySelector(".change-btn-off").click();
    await wait(350);
    const originalBounds = diff.editor.getOriginalEditor().getDomNode().getBoundingClientRect();
    const modifiedBounds = diff.editor.getModifiedEditor().getDomNode().getBoundingClientRect();
    const diffSideBySide = diff.renderSideBySide && originalBounds.width > 100 && modifiedBounds.left > originalBounds.left + 100;
    diffElement.querySelector(".save-btn").click();
    await wait(350);
    const statusBar = findComponent(component => component.$options._scopeId === "data-v-65878d23");
    const pinIcon = Array.from(statusBar.$el.querySelectorAll(".icon")).find(icon => icon.textContent === "push_pin");
    let pinControl = !pinIcon && !statusBar.pinSupported;
    if (statusBar.pinSupported && pinIcon) {
        const initialPin = statusBar.isPinned;
        await statusBar.pinApp();
        const toggled = statusBar.isPinned !== initialPin;
        await statusBar.pinApp();
        pinControl = toggled && statusBar.isPinned === initialPin;
    }
    const minimize = document.querySelector(".close[data-v-65878d23] span[aria-hidden=true]").parentElement;
    const buttonBounds = minimize.getBoundingClientRect();
    const lineBounds = minimize.querySelector("span").getBoundingClientRect();
    const minimizeCentered = Math.abs(lineBounds.top + lineBounds.height / 2 - buttonBounds.top - buttonBounds.height / 2) < 1 && lineBounds.height === 1;
    settings.settings.proxyCore = "mihomo";
    await navigate(/General|主页/i);
    await wait(700);
    const general = findComponent(component => typeof component.handleCopyControllerURL === "function");
    if (!general) throw Error("General page component was not rendered");
    const version = Array.from(general.$el.querySelectorAll(".clickable")).find(element => element.textContent.includes(general.clashCoreVersion) && /Mihomo/i.test(element.textContent));
    if (!version) throw Error("Mihomo version action was not rendered");
    version.click();
    await wait(100);
    const home = general.$parent;
    await home.refreshProfile();
    let roundedDialogs = true;
    for (const open of [() => general.installService(), () => general.handleEditLogLevel()]) {
        const opening = open();
        await home.$nextTick();
        const panel = document.querySelector('.main-select-view-plugin');
        if (!panel) throw Error("General did not open its selection dialog");
        roundedDialogs = roundedDialogs && getComputedStyle(panel.querySelector('.card-main')).borderTopLeftRadius === "10px";
        let select = panel.__vue__;
        while (select && select.$options.name !== "SelectPlugin") select = select.$parent;
        if (!select) throw Error("Selection dialog did not expose its production component");
        select.handleCancel();
        await complete(opening, "cancel rounded selection dialog");
    }
    if (!roundedDialogs) throw Error("Service Mode and log level dialogs did not match the TAP radius");
    const deletion = home.$select({ title: "Delete", bounded: true,
        message: Array.from({ length: 500 }, (_, index) => `rules[${index}]`).join("\n"),
        items: ["Cancel", "Replace references and delete", "Delete with related rules", "Delete and keep references for editing"] });
    await home.$nextTick();
    const deletionPanel = document.querySelector('.main-select-view-plugin');
    const deletionBounds = deletionPanel.querySelector('.card-main').getBoundingClientRect();
    const deletionMessage = deletionPanel.querySelector('.content-message');
    if (deletionBounds.top < 25 || deletionBounds.bottom > innerHeight || deletionMessage.scrollHeight <= deletionMessage.clientHeight) {
        throw Error("A long deletion reference list escaped its bounded dialog");
    }
    deletionPanel.querySelector('.btns .btn').click(); await deletion;
    const choices = Array.from({ length: 500 }, (_, index) => `proxy-${index}`);
    const selecting = home.$select({ title: "Replacement target", choiceTitle: "Target", choiceItems: choices, items: ["Cancel", "Replace"] });
    await home.$nextTick();
    const choicePanel = document.querySelector('.main-select-view-plugin');
    const choiceList = choicePanel.querySelector('select');
    const choiceBounds = choicePanel.querySelector('.card-main').getBoundingClientRect();
    const replacementList = choiceList.options.length === 500 && choiceList.scrollHeight > choiceList.clientHeight
        && choicePanel.querySelectorAll('.btns .btn').length === 2 && choiceBounds.top >= 25 && choiceBounds.bottom <= innerHeight;
    if (!replacementList) throw Error("Replacement targets did not fit a scrollable choice list");
    choiceList.value = "499"; choiceList.dispatchEvent(new Event("change", { bubbles: true }));
    await home.$nextTick();
    await wait(350);
    globalThis.__cfwScreenshotStage = "replacement-list"; await wait(200); globalThis.__cfwScreenshotStage = "";
    choicePanel.querySelectorAll('.btns .btn')[1].click();
    const selected = await selecting;
    if (selected[0] !== 1 || selected[1] !== 499) throw Error("Replacement list did not confirm the last selected item");
    const tunRow = Array.from(general.$el.querySelectorAll(".item")).find(element => /TUN Mode|TUN 模式/.test(element.textContent));
    const tunGear = Array.from(tunRow.querySelectorAll(".tun-settings-icon")).find(element => element.textContent.trim() === "settings");
    tunGear.click();
    await home.$nextTick();
    const tunPanel = document.querySelector(".main-tun-settings-view");
    const tunSettings = findComponent(component => component.$options.name === "TunSettingsView");
    const tunSettingsDialog = !!tunPanel && !!tunSettings && /tun:/.test(tunPanel.querySelector("pre").textContent);
    if (!tunSettingsDialog) throw Error("TUN settings icon did not open a working preview");
    tunSettings.$emit("close");
    await home.$nextTick();
    const originalMixin = { enabled: home.isMixinEnable, type: home.settings.mixinType, text: home.settings.mixinText, code: home.settings.mixinCode };
    let mixinSwitch = true, mixinErrorVisible = false, networkModeWarnings = false, legacyTapControl = false;
    try {
        if (home.isMixinEnable) await general.handleMixinSwitchClick();
        home.settings.mixinType = 0;
        home.settings.mixinText = "";
        await home.$nextTick();
        await home.refreshProfile();
        if (!await general.handleMixinSwitchClick()) throw Error("Default YAML Mixin switch did not enable");
        mixinSwitch = home.isMixinEnable && !home.proxyBusy;
        if (!await general.handleMixinSwitchClick()) throw Error("Default YAML Mixin switch did not disable");
        home.settings.mixinText = 'mixin:\n  dns:\n    enable: true\n    nameserver: [1.1.1.1]\n    fake-ip-filter: [" *.n.n.srv.nintendo.net"]\n';
        await home.$nextTick();
        if (!await general.handleMixinSwitchClick()) throw Error("Saved legacy YAML Mixin switch did not enable");
        mixinSwitch = mixinSwitch && home.$store.state.app.currentProfilePayload.dns["fake-ip-filter"][0] === "*.n.n.srv.nintendo.net"
            && home.settings.mixinText.includes('" *.n.n.srv.nintendo.net"');
        if (!await general.handleMixinSwitchClick()) throw Error("Saved legacy YAML Mixin switch did not disable");
        home.settings.mixinText = "mixin: []";
        await home.$nextTick();
        const invalid = general.handleMixinSwitchClick();
        await wait(50);
        const alert = document.querySelector(".main-alert-view-plugin");
        mixinErrorVisible = !!alert && /Mixin/.test(alert.innerText) && !home.isMixinEnable;
        if (!alert) throw Error("Invalid Mixin was not reported inside the app");
        alert.querySelector(".btn-ok").click();
        const invalidResult = await invalid;
        mixinErrorVisible = mixinErrorVisible && invalidResult === false && !home.proxyBusy;
        home.settings.mixinType = 1;
        home.settings.mixinCode = 'module.exports.parse = ({ content }) => ({ ...content, "tcp-concurrent": true });';
        await home.$nextTick();
        await home.refreshProfile();
        if (!await general.handleMixinSwitchClick()) throw Error("JavaScript Mixin switch did not enable");
        mixinSwitch = mixinSwitch && home.isMixinEnable && home.$store.state.app.currentProfilePayload["tcp-concurrent"] === true;
        if (!await general.handleMixinSwitchClick()) throw Error("JavaScript Mixin switch did not disable");
        const savedTun = home.isTunEnable;
        try {
            if (!savedTun && !await general.handleTunSwitchClick()) throw Error("TUN did not enable for override verification");
            home.settings.mixinType = 0;
            home.settings.mixinText = "mixin:\n  tun:\n    enable: false\n  dns:\n    enable: false\n";
            await home.$nextTick();
            await home.refreshProfile();
            if (!await general.handleMixinSwitchClick()) throw Error("Mixin override did not apply");
            await home.$nextTick();
            const memoryIcon = Array.from(general.$el.querySelectorAll(".tun-settings-icon")).find(element => element.textContent.trim() === "memory");
            memoryIcon.click();
            await home.$nextTick();
            const statusDialog = document.querySelector(".main-select-view-plugin");
            networkModeWarnings = home.isTunEnable && !home.$store.state.app.currentProfilePayload.tun.enable
                && !!statusDialog && /Mixin/.test(statusDialog.innerText) && !general.$el.querySelector(".cfw-network-state");
            statusDialog.querySelector(".btns .btn").click();
            await wait(150);
            let finalEditor = document.querySelector(".main-code-view")?.__vue__;
            while (finalEditor && finalEditor.$options.name !== "CodeView") finalEditor = finalEditor.$parent;
            networkModeWarnings = networkModeWarnings && !!document.querySelector(".main-code-view") && finalEditor.readOnly;
            finalEditor.cancel();
            await home.$nextTick();
            if (!await general.handleMixinSwitchClick()) throw Error("Mixin override did not disable");
        } finally {
            if (home.isMixinEnable) await general.handleMixinSwitchClick();
            if (home.isTunEnable !== savedTun) await general.handleTunSwitchClick();
        }
    } finally {
        home.settings.mixinType = originalMixin.type;
        home.settings.mixinText = originalMixin.text;
        home.settings.mixinCode = originalMixin.code;
        await home.$nextTick();
        await home.refreshProfile();
        if (home.isMixinEnable !== originalMixin.enabled) await general.handleMixinSwitchClick();
    }
    if (general.isWindows) {
        const savedTap = home.settings.legacyTapMode;
        const savedTapInstalled = general.tapInstalled;
        const row = Array.from(general.$el.querySelectorAll(".item")).find(element => /TAP Adapter|TAP 网卡/.test(element.textContent));
        if (!row || row.querySelector('[role="switch"]') || !row.querySelector('.cfw-tap-status')) throw Error("TAP management row was not rendered");
        const tapIcon = row.querySelector('.item-left .cfw-tap-status');
        if (!tapIcon || Math.abs(tapIcon.getBoundingClientRect().width - 21.6) > 0.1) throw Error("TAP status icon was not reduced and aligned with its label");
        try {
            await general.installTapDevice();
            general.tapInstalled = true;
            await home.$nextTick();
            const dialog = general.$el.querySelector('.cfw-tap-dialog');
            if (!dialog || dialog.querySelectorAll('button[data-tap-mode]').length !== 3) throw Error("TAP segmented permission control was not rendered");
            const lock = row.querySelector('.cfw-tap-lock');
            const router = row.querySelector('.cfw-tap-router-locked');
            if (savedTap === "mixin" && (!lock || !router || getComputedStyle(router).clipPath === "none"
                || getComputedStyle(lock).backgroundColor !== "rgba(0, 0, 0, 0)")) throw Error("TAP Router did not leave clear space around its lock badge");
            if (home.settings.legacyTapMode !== "mixin") await general.handleTapModeChange("mixin");
            await home.$nextTick();
            const card = dialog.querySelector('.cfw-tap-card'), scroll = card.querySelector('.cfw-tap-scroll');
            card.style.maxHeight = "280px";
            dialog.querySelector('details').open = true;
            await home.$nextTick();
            const bounds = card.getBoundingClientRect();
            const corners = [[bounds.left + 1, bounds.top + 1], [bounds.right - 1, bounds.top + 1],
                [bounds.left + 1, bounds.bottom - 1], [bounds.right - 1, bounds.bottom - 1]];
            if (getComputedStyle(card).overflow !== "hidden" || getComputedStyle(card).borderTopRightRadius !== "10px"
                || scroll.scrollHeight <= scroll.clientHeight || !corners.every(([x, y]) => !document.elementFromPoint(x, y)?.closest('.cfw-tap-card'))) {
                throw Error("TAP scrollbar escaped the clipped rounded dialog surface");
            }
            scroll.scrollTop = scroll.scrollHeight;
            if (card.querySelector('footer').getBoundingClientRect().bottom > bounds.bottom) throw Error("TAP footer cannot be reached by scrolling");
            globalThis.__cfwScreenshotStage = "tap-scroll"; await wait(200); globalThis.__cfwScreenshotStage = "";
            card.style.maxHeight = ""; dialog.querySelector('details').open = false;
            const target = savedTap === "disabled" ? "mixin" : "disabled";
            if (!await general.handleTapModeChange(target)) throw Error("TAP permission did not change");
            legacyTapControl = home.settings.legacyTapMode === target;
        } finally {
            if (home.settings.legacyTapMode !== savedTap) await general.handleTapModeChange(savedTap);
            general.tapInstalled = savedTapInstalled;
            general.isTapManagementVisible = false;
            await home.$nextTick();
        }
    } else legacyTapControl = true;
    const originalTun = home.isTunEnable;
    const applying = general.handleTunSwitchClick();
    let proxyProgress = false, serviceProgress = true;
    try {
        await home.$nextTick();
        const spinner = general.$el.querySelector(".cfw-operation-spinner");
        const toggles = Array.from(general.$el.querySelectorAll('[role="switch"]'));
        const applyingTun = home.isTunEnable;
        for (let i = 0; i < 100; i++) spinner.parentElement.click();
        await home.$nextTick();
        proxyProgress = getComputedStyle(spinner).animationName === "cfw-operation-spin"
            && getComputedStyle(spinner).animationDuration === "1s"
            && getComputedStyle(spinner).fontSize === "19.8px" && getComputedStyle(spinner).opacity === "0.15"
            && getComputedStyle(spinner).position === "absolute" && getComputedStyle(spinner).zIndex === "-1"
            && !!spinner.parentElement.querySelector(home.proxyTarget ? ".tint-left" : ".tint-right")
            && getComputedStyle(spinner.parentElement.querySelector(home.proxyTarget ? ".tint-left" : ".tint-right")).backgroundColor === "rgb(139, 146, 153)"
            && general.$el.querySelectorAll(".cfw-operation-spinner").length === 1
            && general.tunLoading && !general.mixinLoading
            && toggles.every(toggle => toggle.getAttribute("aria-disabled") === "true")
            && home.isTunEnable === applyingTun;
    } finally {
        await applying;
        if (home.isTunEnable !== originalTun) await general.handleTunSwitchClick();
    }
    let releaseOperation;
    const heldOperation = home.runProxyOperation("tun", () => new Promise(resolve => { releaseOperation = resolve; }), true);
    let settingsDuringProxy;
    try {
        await navigate(/Settings|设置/i);
        const coreRow = Array.from(settings.$el.querySelectorAll(".item")).find(element => /Proxy Core|代理核心/.test(element.textContent));
        const core = settings.settings.proxyCore;
        const blocked = await settings.handleProxyCoreChange(core === "mihomo" ? 0 : 1);
        settings.settings.proxyCore = core === "mihomo" ? "clash" : "mihomo";
        settingsDuringProxy = home.$route.path === "/home/setting" && coreRow.querySelector('[aria-disabled="true"]')
            && blocked === false && settings.settings.proxyCore === core;
        const fontSize = settings.settings.editorFontSize;
        settings.settings.editorFontSize = 15;
        settingsDuringProxy = !!settingsDuringProxy && settings.settings.editorFontSize === 15;
        settings.settings.editorFontSize = fontSize;
    } finally { releaseOperation(true); await heldOperation; }
    await home.$nextTick();
    settingsDuringProxy = settingsDuringProxy && !settings.$el.querySelector(".cfw-operation-disabled");
    await navigate(/General|主页/i);
    try {
        for (const state of ["applying", "restarting"]) {
            home.serviceOperation = state;
            await home.$nextTick();
            const overlay = home.$el.querySelector('[role="status"][aria-busy="true"]');
            const bounds = overlay.getBoundingClientRect();
            const spinner = overlay.querySelector(".cfw-operation-spinner");
            serviceProgress = serviceProgress && home.$el.querySelector("main").inert
                && bounds.width === innerWidth && bounds.height === innerHeight
                && getComputedStyle(spinner).animationName === "cfw-operation-spin"
                && overlay.contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2));
        }
    } finally { home.serviceOperation = ""; await home.$nextTick(); }
    await navigate(/Profiles|配置/i);
    const profileView = findComponent(component => component.$options._scopeId === "data-v-820f0efe");
    const originalRefresh = home.refreshProfile;
    let releaseProfile;
    const heldRefresh = new Promise(resolve => { releaseProfile = resolve; });
    let profileWrites = 0;
    home.refreshProfile = () => { profileWrites++; return heldRefresh; };
    let profileSwitchLock = false;
    let profileSwitchFade = false;
    try {
        const cards = Array.from(profileView.$el.querySelectorAll('.list-item'));
        const first = profileView.handleProfileClick(0);
        for (let repeat = 0; repeat < 20; repeat++) for (const card of cards.slice(1)) card.click();
        if (profileWrites !== 1 || home.profiles.index !== 0) throw Error("Other profile cards were accepted before Vue's first update");
        await home.$nextTick();
        const other = cards.find(card => !card.classList.contains("item-cur"));
        if (!other) throw Error("Profile fade regression requires an unselected profile");
        const opacity = () => Number(getComputedStyle(other).opacity);
        const fadeSamples = [];
        const sample = label => { fadeSamples.push([label, opacity(), performance.now()]); return opacity(); };
        // Read style now so Chromium establishes the transition's start time.
        profileSwitchFade = sample("initial") === 1;
        const count = profileView.loadingProfileIndex.length;
        for (const card of cards) {
            card.click();
            card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
            card.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
        }
        await home.$nextTick();
        profileSwitchLock = home.proxyBusy && home.proxyOperation === "profile"
            && cards.every(card => card.getAttribute("aria-disabled") === "true")
            && profileView.loadingProfileIndex.length === count && home.profiles.index === 0 && profileWrites === 1;
        await wait(300);
        profileSwitchFade = sample("fast-pending") === 1 && profileSwitchFade;
        releaseProfile({ success: true });
        await complete(first, "finish locked profile selection");
        await home.$nextTick();
        profileSwitchLock = profileSwitchLock && !home.proxyBusy
            && cards.every(card => card.getAttribute("aria-disabled") === "false");
        await wait(350);
        profileSwitchFade = sample("fast-complete") === 1 && profileSwitchFade;

        let releaseSlow;
        const slowRefresh = new Promise(resolve => { releaseSlow = resolve; });
        home.refreshProfile = () => slowRefresh;
        const slow = profileView.handleProfileClick(0);
        await home.$nextTick();
        profileSwitchFade = sample("slow-start") === 1 && profileSwitchFade;
        await wait(430);
        profileSwitchFade = sample("slow-delay") === 1 && profileSwitchFade;
        await wait(150);
        const fading = sample("slow-fading");
        profileSwitchFade = profileSwitchFade && fading > .55 && fading < 1;
        await wait(200);
        profileSwitchFade = Math.abs(sample("slow-faded") - .55) < .01 && profileSwitchFade;
        releaseSlow({ success: true });
        await complete(slow, "finish slow profile selection");
        await home.$nextTick();
        await wait(70);
        const recovering = sample("recovering");
        profileSwitchFade = profileSwitchFade && recovering > .55 && recovering < 1;
        await wait(230);
        profileSwitchFade = sample("recovered") === 1 && profileSwitchFade && !home.proxyBusy;
        if (!profileSwitchFade) throw Error(`Profile fade samples: ${JSON.stringify(fadeSamples)}`);
    } finally { home.refreshProfile = originalRefresh; releaseProfile?.({ success: true }); }
    if (!profileSwitchLock) throw Error("Profile switching controls did not lock for mouse and keyboard input");
    if (!profileSwitchFade) throw Error("Profile disabled color did not delay and fade smoothly for fast/slow switches");
    return { connections, trafficUpdates, securitySettings, settingsNavigation, trayDelayVisible, enhancedTrayRounded, editorNavigationHeight, editorNavigationColor, editorNavigationExpandedContrast, diffSideBySide, minimizeCentered, pinControl, tunSettingsDialog, mixinSwitch, mixinErrorVisible, networkModeWarnings, legacyTapControl, proxyProgress, settingsDuringProxy, serviceProgress, roundedDialogs, replacementList, profileSwitchLock, profileSwitchFade };
}

module.exports = { verifyUiRegressions };
