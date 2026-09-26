"use strict";

const { normalizeExternalUrl } = require("../../core/network/external-url-policy");

const FEEDBACK_LINKS = [
    "https://t.me/Rules_lhie1",
    "https://t.me/Fndroids",
    "https://github.com/Z-Siqi/Clash-for-Windows_Chinese-Attached",
    "https://github.com/Dreamacro/clash",
    "https://github.com/yichengchen/clashX",
    "https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/",
    "https://fndroid.github.io/clash-config-builder/",
    "https://github.com/tiagonmas/Windows-Loopback-Exemption-Manager",
    "https://github.com/Noisyfox/sysproxy",
    "https://github.com/eycorsican/go-tun2socks",
    "https://dev.maxmind.com/geoip/geoip2/geolite2/",
    "https://github.com/twitter/twemoji",
    "https://github.com/Jigsaw-Code/outline-client",
    "https://github.com/microsoft/terminal/",
    "https://www.wintun.net/",
    "https://github.com/winsw/winsw",
    "https://apps.apple.com/us/app-bundle/quantumult-x-upgrade/id1482985563",
    "https://github.com/Kr328/clash-premium-installer",
    "https://github.com/microsoft/monaco-editor",
    "https://fonts.google.com/icons",
    "https://github.com/MetaCubeX/mihomo",
    "https://openai.com/codex/"
];

function createLazyImage({ defineComponent, Language, modifyState }) {
    const DEFAULT = Symbol("default");
    const LOADED = Symbol("loaded");
    const FAILED = Symbol("failed");
    return defineComponent({
        props: ["src", "clickalbe"],
        data() { return { status: DEFAULT }; },
        computed: {
            isDefault() { return this.status === DEFAULT; },
            isLoaded() { return this.status === LOADED; },
            isFailed() { return this.status === FAILED; }
        },
        methods: {
            imgLoaded() { this.status = LOADED; },
            imgFailed() { this.status = FAILED; }
        }
    }, function renderLazyImage(createElement) {
        const labels = new Language(modifyState.language);
        return createElement("div", { attrs: { id: "lazy-image-view clickable" } }, [
            createElement("div", {
                directives: [{ name: "show", rawName: "v-show", value: this.isDefault, expression: "isDefault" }],
                staticClass: "placeholder ad-img twinkling"
            }, [createElement("div", [labels.imageIsOnWay()])]),
            createElement("img", {
                directives: [{ name: "show", rawName: "v-show", value: this.isLoaded, expression: "isLoaded" }],
                staticClass: "ad-img clickable",
                attrs: { src: this.src },
                on: { load: this.imgLoaded, error: this.imgFailed, click: () => this.$emit("click") }
            }),
            createElement("div", {
                directives: [{ name: "show", rawName: "v-show", value: this.isFailed, expression: "isFailed" }],
                staticClass: "ad-img error-img clickable",
                on: { click: () => this.$emit("click") }
            }, [createElement("div", [labels.imageFailedLoad()])])
        ]);
    }, "34599eb0");
}

function createFeedbackPage({
    defineComponent, escCaptureComponent, Language, modifyState,
    cache, keys, httpClient, shell
}) {
    const LazyImageView = createLazyImage({ defineComponent, Language, modifyState });
    const linkClass = "text-[color:var(--feedback-link-c)] cursor-pointer";
    const credits = [
        ["Mihomo", 20], ["Codex", 21],
        ["Clash", 3], ["ClashX", 4], ["Quantumult(X)", 16], ["GeoLite2", 10],
        ["twemoji", 11], ["EnableLoopback", 7], ["sysproxy", 8], ["go-tun2socks", 9],
        ["outline-client", 12], ["terminal", 13], ["Wintun", 14], ["winsw", 15],
        ["clash-premium-installer", 17], ["monaco-editor", 18], ["Material Icons", 19]
    ];
    const component = {
        components: { LazyImageView, EscCapture: escCaptureComponent },
        data() {
            return { adImages: [], isShowDisclaimerStatement: false, isShowAds: false };
        },
        methods: {
            select(index) { return shell.openExternal(FEEDBACK_LINKS[index]); },
            adClick(index) {
                const url = normalizeExternalUrl(this.adImages[index]?.click);
                return url ? shell.openExternal(url) : false;
            }
        },
        beforeRouteEnter(_to, _from, next) {
            next(async vm => {
                vm.adImages = cache.get(keys.AD_IMAGES) || [];
                const response = await httpClient.get(modifyState.adImages + Date.now());
                if (response.status === 200 && response.data.feedback) {
                    cache.put(keys.AD_IMAGES, response.data.feedback);
                    vm.adImages = response.data.feedback;
                }
            });
        }
    };
    return defineComponent(component, function renderFeedbackPage(createElement) {
        const labels = new Language(modifyState.language);
        const link = (text, index) => createElement("div", {
            staticClass: linkClass,
            on: { click: () => this.select(index) }
        }, [text]);
        const overlay = (close, content) => createElement("EscCapture", {
            staticClass: "w-full h-full absolute bg-[color:var(--mask-c)] top-0 left-0",
            on: {
                mousedown: event => { if (event.target === event.currentTarget) close(); },
                esc: close
            }
        }, [createElement("pre", {
            staticClass: "left-1/2 top-1/2 w-3/5 break-words whitespace-pre-wrap text-sm absolute bg-[color:var(--bgc)] px-4 py-3 h-4/5 scrolly -translate-x-1/2 -translate-y-1/2 rounded-md shadow-2xl font-sans select-text"
        }, content)]);
        const slogan = () => createElement("div", { staticClass: "absolute mt-[1000px]" }, [
            decodeURIComponent("%E7%8B%AC%E7%AB%8B%E6%80%9D%E8%80%83%EF%BC%8C%E6%98%8E%E8%BE%A8%E6%98%AF%E9%9D%9E%E3%80%82")
        ]);
        return createElement("div", {
            staticClass: "relative w-full h-full",
            attrs: { id: "main-about-view" }
        }, [
            createElement("div", { staticClass: "section" }, [
                createElement("div", { staticClass: "title" }, [labels.developer()]),
                createElement("div", { staticClass: "content" }, ["404 Frror - (" + labels.developerEndVersion() + ")"])
            ]),
            createElement("div", { staticClass: "section" }, [
                createElement("div", { staticClass: "title" }, [labels.optVersionDeveloper()]),
                createElement("div", { staticClass: "content" }, ["Z-Siqi"])
            ]),
            createElement("div", { staticClass: "section" }, [
                createElement("div", { staticClass: "title" }, [labels.relevance()]),
                createElement("div", { staticClass: "chat-list gap-[20px]" }, [
                    link("Github", 2), link(labels.docs(), 5),
                    createElement("div", {
                        staticClass: linkClass,
                        on: { click: () => { this.isShowDisclaimerStatement = true; } }
                    }, [labels.disclaimerStatement()])
                ])
            ]),
            createElement("div", { staticClass: "section" }, [
                createElement("div", { staticClass: "title" }, [labels.credits()]),
                createElement("div", { staticClass: "flex flex-wrap gap-x-[20px]" }, credits.map(([text, index]) => link(text, index)))
            ]),
            createElement("div", { staticClass: "title" }, [labels.other()]),
            createElement("div", { staticClass: "section ad-section" }, [
                createElement("div", {
                    staticClass: linkClass,
                    on: { click: () => { this.isShowAds = true; } }
                }, [labels.advertisementOriginal()])
            ]),
            slogan(),
            this.isShowAds ? overlay(() => { this.isShowAds = false; }, [
                createElement("div", { staticClass: "section ad-section" }, [
                    createElement("div", { staticClass: "title" }, [labels.advertisementOriginal()]),
                    createElement("div", { staticClass: "ad-img-list" }, this.adImages.map((image, index) =>
                        createElement("div", { key: index, staticClass: "ad-img" }, [
                            createElement("lazy-image-view", {
                                attrs: { clickalbe: image.click, src: image.img },
                                on: { click: () => this.adClick(index) }
                            })
                        ])
                    ))
                ])
            ]) : null,
            slogan(),
            this.isShowDisclaimerStatement
                ? overlay(() => { this.isShowDisclaimerStatement = false; }, [labels.disclaimerStatementDescribe()])
                : null
        ]);
    }, "4a737543");
}

module.exports = { FEEDBACK_LINKS, createFeedbackPage, createLazyImage };
