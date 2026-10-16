"use strict";

// Runs only in the dashboard's private browser world, against the temporary fixture.
async function verifyUiRegressions() {
    const wait = duration => new Promise(resolve => setTimeout(resolve, duration));
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
    return { connections, trafficUpdates, securitySettings, settingsNavigation, trayDelayVisible, enhancedTrayRounded, editorNavigationHeight, editorNavigationColor, editorNavigationExpandedContrast, diffSideBySide, minimizeCentered, pinControl };
}

module.exports = { verifyUiRegressions };
