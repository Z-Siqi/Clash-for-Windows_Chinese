"use strict";

function createServerPage({
    defineComponent,
    Vuex,
    getLanguage,
    getLanguageIndex,
    workflow,
    draggable,
    ProfileEditor,
    RuleEditor,
    Hint,
    qrcode,
    shortenText,
    confirmOpenExternal
}) {
    const QRCodeView = defineComponent({
        name: "QRCodeView",
        props: { url: String },
        data() { return { src: "", isWithSheme: true }; },
        watch: { isWithSheme() { this.updateQrcode(); } },
        computed: {
            finalURL() {
                return this.isWithSheme ? `clash://install-config?url=${encodeURIComponent(this.url)}` : this.url;
            },
            shorternFinalURL() { return this.finalURL ? shortenText(this.finalURL, 120) : ""; }
        },
        methods: {
            handleGoToURL() { confirmOpenExternal(this.url); },
            async updateQrcode() {
                try { this.src = await qrcode.toDataURL(this.finalURL); } catch (_error) {}
            }
        },
        mounted() { this.updateQrcode(); }
    }, function renderQRCodeView() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        return createElement("div", {
            staticClass: "qrcode-view-main",
            on: { click: () => viewModel.$emit("hide") }
        }, [createElement("div", {
            staticClass: "content",
            on: { click: event => event.stopPropagation() }
        }, [createElement("img", {
            attrs: { src: viewModel.src, alt: "" }
        }), viewModel._v(" "), createElement("div", {
            staticClass: "url",
            on: { click: viewModel.handleGoToURL }
        }, [viewModel._v(`\n      ${viewModel._s(viewModel.shorternFinalURL)}\n    `)]), viewModel._v(" "), createElement("div", {
            staticClass: "btn",
            on: { click: () => { viewModel.isWithSheme = !viewModel.isWithSheme; } }
        }, [viewModel._v(`\n      ${viewModel._s(viewModel.isWithSheme ? labels.delete() : labels.include())} ${labels.scheme()}\n    `)])])]);
    }, "2c37fa0d");

    const ServerPage = defineComponent({
        data: workflow.data,
        components: { draggable, ConfigView: ProfileEditor, RuleView: RuleEditor, QRCodeView, Hint },
        directives: {
            focus: { update(element, binding) { if (binding.value) element.focus(); } }
        },
        computed: {
            ...Vuex.mapState({
                clashPath: state => state.app.clashPath,
                pfs: state => state.app.profiles,
                confData: state => state.app.confData,
                profilesPath: state => state.app.profilesPath
            }),
            ...Vuex.mapGetters(["clashAxiosClient"]),
            ...workflow.computed
        },
        methods: {
            ...Vuex.mapMutations({
                changeProfiles: "CHANGE_PROFILES",
                changeProfilesIndex: "CHANGE_PROFILES_INDEX",
                changeProfile: "CHANGE_PROFILE",
                appendProfile: "APPEND_PROFILE",
                deleteProfile: "DELETE_PROFILE"
            }),
            ...workflow.methods
        },
        beforeRouteEnter: workflow.beforeRouteEnter,
        beforeRouteLeave: workflow.beforeRouteLeave
    }, function renderServerPage() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const closeEditor = () => {
            viewModel.editProfileName = "";
            viewModel.editProfileType = -1;
        };
        const renderProfile = (profile, index) => {
            const updatedTimeChinese = `\n                (${viewModel._s(viewModel.parseTime(profile))})\n              `;
            const updatedTimeEnglish = updatedTimeChinese
                .replace(/前/g, " ago")
                .replace(/几秒/g, "seconds")
                .replace(/秒/g, "seconds")
                .replace(/分钟/g, "minutes")
                .replace(/小时/g, "hours")
                .replace(/天/g, "days")
                .replace(/个月/g, "month")
                .replace(/年/g, "years");
            const updatedTime = getLanguageIndex() === 0 ? updatedTimeChinese : updatedTimeEnglish;
            const stopAndRun = action => event => {
                event.stopPropagation();
                action();
            };

            return createElement("div", {
                key: index,
                class: ["list-item", index === viewModel.pfs.index ? "item-cur" : ""],
                on: {
                    click: () => viewModel.handleProfileClick(index),
                    contextmenu: event => viewModel.handleProfileRightClick(event, profile, index)
                }
            }, [
                createElement("div", { staticClass: "indicator relative overflow-clip" }, [
                    index === viewModel.pfs.index ? [
                        createElement("transition", { attrs: { name: "expand" } }, [
                            viewModel.loadingProfileIndex.includes(index)
                                ? viewModel._e()
                                : createElement("div", {
                                    staticClass: "absolute bg-[color:var(--proxy-item-selected-border-c)] w-full h-full"
                                })
                        ]),
                        viewModel._v(" "),
                        createElement("div", {
                            staticClass: "bg-[color:var(--proxy-item-selected-border-c)] absolute w-full h-3/5 rounded-[10px] animate-cycle"
                        })
                    ] : viewModel._e()
                ], 2),
                viewModel._v(" "),
                createElement("div", { staticClass: "item-info" }, [
                    createElement("div", { staticClass: "item-name" }, [
                        createElement("div", { staticClass: "item-name-top" }, [
                            createElement("div", { attrs: { title: profile.name } }, [viewModel._v(viewModel._s(profile.name))])
                        ]),
                        viewModel._v(" "),
                        createElement("div", {
                            staticClass: "item-name-bottom flex gap-1 w-full",
                            attrs: { title: profile.url }
                        }, [
                            createElement("span", { staticClass: "overflow-hidden text-ellipsis" }, [
                                viewModel._v(viewModel._s(viewModel.parseDomain(profile.url)))
                            ]),
                            viewModel._v(" "),
                            createElement("span", {
                                staticClass: "flex-shrink",
                                class: { "item-time": true, "item-expired": viewModel.isProifleExpired(profile) }
                            }, [viewModel._v(updatedTime)])
                        ]),
                        viewModel._v(" "),
                        viewModel.subInfoArr(profile.subInfo || {}) ? createElement("div", {
                            staticClass: "item-subinfo"
                        }, [
                            createElement("div", { staticClass: "item-subinfo-texts" }, viewModel._l(
                                viewModel.subInfoArr(profile.subInfo || {}),
                                (value, subInfoIndex) => createElement("div", {
                                    key: subInfoIndex
                                }, [viewModel._v(`\n                  ${viewModel._s(value)}\n                `)])
                            ), 0),
                            viewModel._v(" "),
                            createElement("div", { staticClass: "progress" }, [
                                createElement("div", {
                                    staticClass: "percent",
                                    style: viewModel.subInfoPercent(profile.subInfo || {})
                                })
                            ])
                        ]) : viewModel._e()
                    ]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "h-full flex flex-col justify-center" }, [
                        profile.url !== "" ? createElement("Hint", {
                            staticClass: "item-icon",
                            attrs: { hint: labels.update() },
                            on: { click: stopAndRun(() => viewModel.refreshProfile(profile)) }
                        }, [createElement("span", {
                            staticClass: "icon",
                            class: { rotating: profile.url in viewModel.downlodingUrls }
                        }, [viewModel._v("refresh")])]) : createElement("Hint", {
                            staticClass: "item-icon",
                            attrs: { hint: labels.edit() },
                            on: { click: stopAndRun(() => viewModel.openProfile(profile)) }
                        }, [createElement("span", { staticClass: "icon" }, [viewModel._v("code")])])
                    ], 1)
                ])
            ]);
        };

        return createElement("div", {
            attrs: { id: "main-server-view" },
            on: { drop: viewModel.dropProfile, dragover: viewModel.dragOverProfile }
        }, [viewModel.editProfileName && viewModel.editProfileType === 0 ? createElement("config-view", {
            attrs: { "clash-path": viewModel.clashPath, "profile-name": viewModel.editProfileName },
            on: { cancel: closeEditor, done: viewModel.editDone, error: closeEditor }
        }) : viewModel.editProfileName && viewModel.editProfileType === 1 ? createElement("rule-view", {
            attrs: { "clash-path": viewModel.clashPath, "profile-name": viewModel.editProfileName },
            on: { cancel: closeEditor, done: viewModel.editDone, error: closeEditor }
        }) : createElement("div", {
            staticClass: "main"
        }, [createElement("div", {
            class: ["card", "remote-view"]
        }, [createElement("div", {
            staticClass: "input-container"
        }, [createElement("input", {
            directives: [
                { name: "focus", rawName: "v-focus", value: viewModel.inputFocus, expression: "inputFocus" },
                { name: "model", rawName: "v-model", value: viewModel.subUrl, expression: "subUrl" }
            ],
            attrs: { spellcheck: "false", type: "text", placeholder: labels.downloadFromURL() },
            domProps: { value: viewModel.subUrl },
            on: {
                keydown: viewModel.handleURLConfirm,
                input: event => { if (!event.target.composing) viewModel.subUrl = event.target.value; }
            }
        }), viewModel._v(" "), viewModel.subUrl !== "" ? createElement("span", {
            staticClass: "icon text-[color:var(--fgc)] opacity-50 clear-icon clickable",
            on: { click: () => { viewModel.subUrl = ""; } }
        }, [viewModel._v("backspace")]) : createElement("span", {
            staticClass: "icon clear-icon clickable text-[color:var(--fgc)] opacity-50",
            on: { click: viewModel.pasteURL }
        }, [viewModel._v("content_copy")])]), viewModel._v(" "), createElement("div", {
            staticClass: "btns-container"
        }, [createElement("div", {
            class: viewModel.getBtnClass,
            on: { click: viewModel.handleDownload }
        }, [viewModel._v(`\n          ${viewModel._s(viewModel.getBtnText)}\n        `)]), viewModel._v(" "), createElement("div", {
            staticClass: "confirm confirm-right update-all-btn",
            on: { click: viewModel.handleUpdateAllProfiles }
        }, [viewModel._v(`\n          ${labels.updateAll()}\n        `)]), viewModel._v(" "), createElement("div", {
            staticClass: "confirm confirm-right",
            on: { click: viewModel.handleImport }
        }, [viewModel._v(labels.import())])])]), viewModel._v(" "), createElement("draggable", {
            ref: "mixin-scroll-content",
            staticClass: "list-view",
            attrs: { delay: 300, animation: 200, "delay-on-touch-only": true },
            on: { start: viewModel.handleDragStart, end: viewModel.handleDragEnd },
            model: {
                value: viewModel.profiles,
                callback: value => { viewModel.profiles = value; },
                expression: "profiles"
            }
        }, [
            viewModel._l(viewModel.profiles, renderProfile),
            viewModel._v(" "),
            viewModel._l(new Array(20), (_unusedItem, hiddenIndex) => createElement("i", {
                key: `hidden${hiddenIndex}`
            }))
        ], 2)], 1), viewModel._v(" "), viewModel.qrcodeURL ? createElement("QRCodeView", {
            attrs: { url: viewModel.qrcodeURL },
            on: { hide: () => { viewModel.qrcodeURL = ""; } }
        }) : viewModel._e()], 1);
    }, "820f0efe");

    return ServerPage;
}

module.exports = { createServerPage };
