"use strict";

const { defineComponent } = require("../component");

const DNS_STATUS_NAMES = {
    0: "NOERROR",
    1: "FORMERR",
    2: "SERVFAIL",
    3: "NXDOMAIN",
    4: "NOTIMP",
    5: "REFUSED",
    6: "YXDOMAIN",
    7: "YXRRSET",
    8: "NXRRSET",
    9: "NOTAUTH",
    10: "NOTZONE",
    11: "DSOTYPENI",
    16: "BADVERS",
    17: "BADKEY",
    18: "BADTIME",
    19: "BADMODE",
    20: "BADNAME",
    21: "BADALG",
    22: "BADTRUNC"
};

function flattenDnsRecords(records, recordTypes) {
    return records.flatMap(record => [
        record.name,
        record.TTL,
        recordTypes[record.type],
        record.data
    ]);
}

function createDns({ Vuex, escCaptureComponent, Language, modifyState } = {}) {
    const options = {
        components: { EscCapture: escCaptureComponent },
        name: "DNSView",
        props: [],
        data() {
            return {
                data: [],
                isShow: false,
                searchHost: "",
                searchType: "A",
                error: "",
                flags: [],
                status: "",
                answers: [],
                authorities: [],
                additionals: [],
                questions: [],
                resolve: null,
                reject: null,
                server: "",
                rttypes: {
                    1: "A",
                    28: "AAAA",
                    5: "CNAME",
                    15: "MX",
                    2: "NS",
                    12: "PTR",
                    6: "SOA",
                    33: "SRV",
                    16: "TXT"
                }
            };
        },
        watch: {},
        computed: {
            ...Vuex.mapGetters(["theme", "clashAxiosClient"]),
            questionMixed() {
                return this.questions.flatMap(question => [question.Name, this.rttypes[question.Qtype]]);
            },
            answerMixed() {
                return flattenDnsRecords(this.answers, this.rttypes);
            },
            authorityMixed() {
                return flattenDnsRecords(this.authorities, this.rttypes);
            },
            additionalMixed() {
                return flattenDnsRecords(this.additionals, this.rttypes);
            }
        },
        methods: {
            show() {
                this.isShow = true;
                this.$nextTick(() => this.$refs["search-input"].focus());
                return new Promise((resolve, reject) => {
                    this.resolve = resolve;
                    this.reject = reject;
                });
            },
            parseDoHData({
                Status,
                TC,
                RD,
                RA,
                AD,
                CD,
                Server = "",
                Question = [],
                Answer = [],
                Authority = [],
                Additional = []
            }) {
                this.status = DNS_STATUS_NAMES[Status];
                this.flags = [
                    TC ? "TC" : "",
                    RD ? "RD" : "",
                    RA ? "RA" : "",
                    AD ? "AD" : "",
                    CD ? "CD" : ""
                ].filter(Boolean);
                this.answers = Answer;
                this.authorities = Authority;
                this.additionals = Additional;
                this.questions = Question;
                this.server = Server;
            },
            clearResults() {
                this.additionals = [];
                this.authorities = [];
                this.answers = [];
                this.questions = [];
                this.status = "";
                this.flags = [];
                this.server = "";
            },
            async handleSearch() {
                const labels = new Language(modifyState.language);
                this.error = "";
                if (!this.searchHost) {
                    this.error = labels.pleaseInputDomain();
                    this.clearResults();
                    return;
                }

                try {
                    const response = await this.clashApi.queryDns(this.searchHost, this.searchType);
                    this.parseDoHData(response?.data);
                } catch (error) {
                    this.error = error.response?.data?.message || error.message;
                    this.clearResults();
                }
            },
            handleKeyDown() {},
            handleCancel() {
                this.isShow = false;
                this.reject();
            }
        }
    };

    return defineComponent(options, function renderDns() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = new Language(modifyState.language);
        if (!viewModel.isShow) return viewModel._e();

        const renderRecordGrid = (title, records) => records.length > 0
            ? createElement("div", { staticClass: "p" }, [
                createElement("span", [viewModel._v(title)]),
                viewModel._v(" "),
                createElement("div", {
                    staticClass: "text-sm c grid grid-cols-4 gap-x-4",
                    staticStyle: { "grid-template-columns": "repeat(4, auto)" }
                }, viewModel._l(records, (value, index) => createElement("div", {
                    key: index,
                    staticClass: "whitespace-pre-wrap break-all"
                }, [createElement("div", [viewModel._v(viewModel._s(value))])])), 0)
            ])
            : viewModel._e();

        return createElement("EscCapture", {
            staticClass: "main-dns-view bg-[color:var(--mask-c)]",
            class: [`theme-${viewModel.theme}`],
            on: {
                esc: viewModel.handleCancel,
                keydown: viewModel.handleKeyDown,
                mousedown: viewModel.handleCancel
            }
        }, [createElement("div", {
            staticClass: "card-main bg-[color:var(--bgc)] text-[color:var(--fgc)]",
            on: { mousedown: event => event.stopPropagation() }
        }, [createElement("div", { staticClass: "card-content p-4" }, [
            createElement("div", { staticClass: "px-2 text-lg" }, [viewModel._v(labels.queryDNS())]),
            viewModel._v(" "),
            createElement("div", { staticClass: "px-2 py-2 flex items-center gap-2" }, [
                createElement("input", {
                    directives: [{ name: "model", rawName: "v-model", value: viewModel.searchHost, expression: "searchHost" }],
                    ref: "search-input",
                    staticClass: "p-2 py-1 outline-none flex-grow",
                    attrs: { placeholder: labels.host() },
                    domProps: { value: viewModel.searchHost },
                    on: {
                        change: viewModel.handleSearch,
                        input: event => {
                            if (!event.target.composing) viewModel.searchHost = event.target.value;
                        }
                    }
                }),
                viewModel._v(" "),
                createElement("input", {
                    directives: [{ name: "model", rawName: "v-model", value: viewModel.searchType, expression: "searchType" }],
                    staticClass: "p-2 py-1 w-[80px] outline-none",
                    attrs: { placeholder: labels.type() },
                    domProps: { value: viewModel.searchType },
                    on: {
                        change: viewModel.handleSearch,
                        input: event => {
                            if (!event.target.composing) viewModel.searchType = event.target.value;
                        }
                    }
                }),
                viewModel._v(" "),
                createElement("button", {
                    staticClass: "bg-[color:#14A53A] rounded-full text-sm px-4 py-1 text-white",
                    on: { click: viewModel.handleSearch }
                }, [viewModel._v(`\n          ${labels.lookup()}\n        `)])
            ]),
            viewModel._v(" "),
            viewModel.status !== "" ? createElement("div", {
                staticClass: "px-2 content-items"
            }, [
                createElement("div", { staticClass: "flex justify-between gap-2" }, [
                    createElement("div", { staticClass: "p flex-grow" }, [
                        createElement("span", [viewModel._v(labels.server())]),
                        viewModel._v(" "),
                        createElement("div", { staticClass: "c" }, [viewModel._v(viewModel._s(viewModel.server))])
                    ]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "p" }, [
                        createElement("span", [viewModel._v(labels.status())]),
                        viewModel._v(" "),
                        createElement("div", { staticClass: "c" }, [viewModel._v(viewModel._s(viewModel.status))])
                    ]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "p" }, [
                        createElement("span", [viewModel._v(labels.flags())]),
                        viewModel._v(" "),
                        createElement("div", { staticClass: "text-sm c flex gap-x-3" }, viewModel._l(
                            viewModel.flags,
                            flag => createElement("div", { key: flag }, [viewModel._v(`\n                ${viewModel._s(flag)}\n              `)])
                        ), 0)
                    ])
                ]),
                viewModel._v(" "),
                renderRecordGrid("Answer", viewModel.answerMixed),
                viewModel._v(" "),
                renderRecordGrid(labels.authority(), viewModel.authorityMixed),
                viewModel._v(" "),
                renderRecordGrid("Additional", viewModel.additionalMixed)
            ]) : viewModel._e(),
            viewModel._v(" "),
            viewModel.status === "" && viewModel.error !== ""
                ? createElement("div", { staticClass: "error-hint" }, [viewModel._v(`\n        ${viewModel._s(viewModel.error)}\n      `)])
                : viewModel._e()
        ])])]);
    }, "6e0989c7");
}

module.exports = { createDns, flattenDnsRecords };
