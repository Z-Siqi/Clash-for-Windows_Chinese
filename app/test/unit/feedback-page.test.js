"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const {
    FEEDBACK_LINKS,
    createFeedbackPage
} = require("../../main/dist/electron/features/feedback/page");

class Labels {
    imageIsOnWay() { return "loading"; }
    imageFailedLoad() { return "failed"; }
    developer() { return "developer"; }
    relevance() { return "relevance"; }
    docs() { return "docs"; }
    disclaimerStatement() { return "disclaimer"; }
    disclaimerStatementDescribe() { return "statement"; }
    credits() { return "credits"; }
    other() { return "other"; }
    advertisementOriginal() { return "ads"; }
}

function createPage(overrides = {}) {
    const opened = [];
    const saved = [];
    const page = createFeedbackPage({
        defineComponent,
        escCaptureComponent: {},
        Language: Labels,
        modifyState: { language: 0, adImages: "https://example/ads?t=" },
        cache: { get: () => [{ img: "cached", click: "https://cached.test/" }], put: (...args) => saved.push(args) },
        keys: { AD_IMAGES: "ads" },
        httpClient: { get: async () => ({ status: 200, data: { feedback: [{ img: "fresh", click: "https://fresh.test/path" }] } }) },
        shell: { openExternal: value => opened.push(value) },
        ...overrides
    });
    return { page, opened, saved };
}

test("feedback page owns external links and advertisement refresh", async () => {
    const { page, opened, saved } = createPage();
    const vm = { ...page.data(), ...page.methods };
    vm.select(2);
    assert.equal(opened[0], FEEDBACK_LINKS[2]);
    let enter;
    page.beforeRouteEnter({}, {}, callback => { enter = callback; });
    await enter(vm);
    assert.deepEqual(vm.adImages, [{ img: "fresh", click: "https://fresh.test/path" }]);
    assert.deepEqual(saved, [["ads", [{ img: "fresh", click: "https://fresh.test/path" }]]]);
    vm.adClick(0);
    assert.equal(opened[1], "https://fresh.test/path");
    vm.adImages = [{ click: "file:///C:/malware.exe" }];
    assert.equal(vm.adClick(0), false);
    assert.equal(opened.length, 2);
});

test("feedback lazy image preserves loading, loaded and failed states", () => {
    const { page } = createPage();
    const lazy = page.components.LazyImageView;
    const vm = { ...lazy.data(), ...lazy.methods };
    assert.equal(lazy.computed.isDefault.call(vm), true);
    vm.imgLoaded();
    assert.equal(lazy.computed.isLoaded.call(vm), true);
    vm.imgFailed();
    assert.equal(lazy.computed.isFailed.call(vm), true);
});

test("feedback page leaves vertical space above every title", () => {
    const styles = fs.readFileSync(path.resolve(__dirname, "../../main/dist/electron/styles.css"), "utf8");
    assert.match(styles, /\.title\[data-v-4a737543\]\s*\{[^}]*margin-top:\s*0\.618em;/);
});
