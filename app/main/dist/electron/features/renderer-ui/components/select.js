"use strict";

const { defineComponent } = require("../component");

function createSelect({ Vuex, escCaptureComponent, selectViewComponent, utilities } = {}) {
    const CheckBox = defineComponent({
        name: "CheckBox",
        model: { prop: "checked", event: "change" },
        props: {
            checked: { type: Boolean, default: false },
            size: { type: Number, default: 20 }
        },
        data() {
            return {};
        }
    }, function renderCheckBox() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", {
            staticClass: "main-check-box",
            on: { click: () => viewModel.$emit("change", !viewModel.checked) }
        }, [
            [createElement("span", {
                staticClass: "icon text-[color:var(--fgc)] text-[20px]"
            }, [viewModel._v(`check_box${viewModel._s(viewModel.checked ? "" : "_outline_blank")}`)])],
            viewModel._v(" "),
            createElement("div", { staticClass: "slot" }, [viewModel._t("default")], 2)
        ], 2);
    }, "1c767bad");

    const options = {
        components: {
            EscCapture: escCaptureComponent,
            CheckBox,
            SelectView: selectViewComponent
        },
        name: "SelectPlugin",
        props: [],
        data() {
            return {
                isShow: false,
                title: "",
                message: "",
                html: "",
                items: [],
                resolve: null,
                reject: null,
                checkList: [],
                itemStyles: [],
                reactions: null,
                reactionClick() {},
                subSelectItems: [],
                subSelectIndex: 0,
                subSelectTitle: "",
                isLastDifferent: false
            };
        },
        computed: {
            ...Vuex.mapGetters(["theme"]),
            reactionList() {
                const emojiByReaction = {
                    "+1": "👍",
                    laugh: "😄",
                    hooray: "🎉",
                    heart: "❤️",
                    rocket: "🚀",
                    eyes: "👀"
                };
                return Object.entries(emojiByReaction).reduce((items, [reaction, emoji]) => {
                    if (this.reactions[reaction]) {
                        items.push({ key: emoji, value: this.reactions[reaction] });
                    }
                    return items;
                }, []);
            }
        },
        methods: {
            show({
                items = [],
                title = "Select",
                message = "",
                checkList = [],
                itemStyles = [],
                html = "",
                reactions = null,
                reactionClick = () => {},
                subSelectItems = [],
                subSelectTitle = "",
                isLastDifferent
            }) {
                this.isShow = true;
                this.title = title;
                this.items = items;
                this.message = message;
                this.checkList = checkList;
                this.itemStyles = itemStyles;
                this.html = html;
                this.reactions = reactions;
                this.reactionClick = reactionClick;
                this.subSelectItems = subSelectItems;
                this.subSelectTitle = subSelectTitle;
                this.isLastDifferent = isLastDifferent === undefined
                    ? items[items.length - 1] === "Cancel"
                    : isLastDifferent;
                return new Promise((resolve, reject) => {
                    this.resolve = resolve;
                    this.reject = reject;
                });
            },
            handleCancel() {
                this.isShow = false;
                this.reject();
            },
            handleDone() {
                this.isShow = false;
                this.resolve({});
            },
            handleItemSelect(index) {
                this.isShow = false;
                if (this.subSelectItems.length > 0) {
                    this.resolve([index, this.subSelectIndex]);
                } else if (this.checkList?.length > 0) {
                    this.resolve([index, this.checkList]);
                } else {
                    this.resolve([index]);
                }
            },
            handleHTMLClick(event) {
                if (event.target.tagName !== "A") return;
                event.preventDefault();
                const url = event.target.getAttribute("href");
                if (url) utilities.confirmOpenExternal(url);
            }
        }
    };

    return defineComponent(options, function renderSelect() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        if (!viewModel.isShow) return viewModel._e();

        return createElement("EscCapture", {
            staticClass: "main-select-view-plugin bg-[color:var(--mask-c)]",
            class: [`theme-${viewModel.theme}`],
            on: { esc: viewModel.handleCancel, mousedown: viewModel.handleCancel }
        }, [createElement("div", {
            staticClass: "card-main bg-[color:var(--bgc)] text-[color:var(--fgc)]",
            on: { mousedown: event => event.stopPropagation() }
        }, [createElement("div", { staticClass: "card-content" }, [
            createElement("div", { staticClass: "content-title" }, [viewModel._v(viewModel._s(viewModel.title))]),
            viewModel._v(" "),
            viewModel.message
                ? createElement("div", { staticClass: "content-message" }, viewModel._l(
                    viewModel.message.split("\n"),
                    line => createElement("p", { key: line }, [viewModel._v(`\n          ${viewModel._s(line)}\n        `)])
                ), 0)
                : createElement("div", {
                    staticClass: "html-list",
                    domProps: { innerHTML: viewModel._s(viewModel.html) },
                    on: { click: viewModel.handleHTMLClick }
                }),
            viewModel._v(" "),
            viewModel.reactions ? createElement("div", {
                staticClass: "flex gap-3 mb-[10px]",
                on: { click: viewModel.reactionClick }
            }, viewModel._l(viewModel.reactionList, reaction => createElement("div", {
                key: reaction.key,
                staticClass: "flex justify-center items-center gap-1 border-[1px] rounded-lg border-[color:var(--bc)] px-2"
            }, [
                createElement("div", [viewModel._v(viewModel._s(reaction.key))]),
                viewModel._v(" "),
                createElement("div", { staticClass: "text-sm font-normal" }, [viewModel._v(viewModel._s(reaction.value))])
            ])), 0) : viewModel._e(),
            viewModel._v(" "),
            viewModel.checkList?.length > 0 ? createElement("div", {
                staticClass: "check-list"
            }, viewModel._l(viewModel.checkList, item => createElement("div", {
                key: item,
                staticClass: "check-item"
            }, [createElement("check-box", {
                model: {
                    value: item.value,
                    callback: value => viewModel.$set(item, "value", value),
                    expression: "item.value"
                }
            }, [viewModel._v(viewModel._s(item.key))])], 1)), 0) : viewModel._e(),
            viewModel._v(" "),
            viewModel.subSelectItems.length > 0 ? createElement("div", {
                staticClass: "mb-[10px] flex items-center gap-2"
            }, [
                createElement("div", [viewModel._v(viewModel._s(viewModel.subSelectTitle))]),
                viewModel._v(" "),
                createElement("SelectView", {
                    attrs: { items: viewModel.subSelectItems },
                    model: {
                        value: viewModel.subSelectIndex,
                        callback: value => { viewModel.subSelectIndex = value; },
                        expression: "subSelectIndex"
                    }
                })
            ], 1) : viewModel._e(),
            viewModel._v(" "),
            createElement("div", { staticClass: "btns" }, viewModel._l(viewModel.items, (item, index) => createElement("div", {
                key: index,
                staticClass: "btn",
                class: { "last-btn": viewModel.isLastDifferent && index === viewModel.items.length - 1 },
                style: viewModel.itemStyles[index],
                on: { click: () => viewModel.handleItemSelect(index) }
            }, [item ? createElement("span", [viewModel._v(viewModel._s(item))]) : viewModel._e()])), 0)
        ])])]);
    }, "0826c2c0");
}

module.exports = { createSelect };
