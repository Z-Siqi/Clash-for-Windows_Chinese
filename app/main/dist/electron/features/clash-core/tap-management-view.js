"use strict";

const { TAP_MODES } = require("../../core/network/legacy-tap-policy");

// Google Material Symbols Router Off, Apache-2.0; bundled inline for offline use.
// https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/router_off/default/24px.svg
const ROUTER_OFF = "m570-630-58-58q26-24 58-38t70-14q38 0 70 14t58 38l-58 58q-14-14-31.5-22t-38.5-8q-21 0-38.5 8T570-630ZM470-730l-56-56q44-44 102-69t124-25q66 0 124 25t102 69l-56 56q-33-33-76.5-51.5T640-800q-50 0-93.5 18.5T470-730Zm370 496L600-474v-126h80v160h80q33 0 56.5 23.5T840-360v126Zm-640 34h446L486-360H200v160ZM791-55l-65-65H200q-33 0-56.5-23.5T120-200v-160q0-33 23.5-56.5T200-440h206L55-791l57-57 736 736-57 57ZM251.5-251.5Q240-263 240-280t11.5-28.5Q263-320 280-320t28.5 11.5Q320-297 320-280t-11.5 28.5Q297-240 280-240t-28.5-11.5Zm140 0Q380-263 380-280t11.5-28.5Q403-320 420-320t28.5 11.5Q460-297 460-280t-11.5 28.5Q437-240 420-240t-28.5-11.5Zm140 0Q520-263 520-280t11.5-28.5Q543-320 560-320t28.5 11.5Q600-297 600-280t-11.5 28.5Q577-240 560-240t-28.5-11.5ZM200-200v-160 160Z";

function tapStatus(installed, mode, labels) {
    const key = installed === null ? "tapStatusUnknown" : installed === false ? "tapNotInstalled"
        : mode === "disabled" ? "tapDisabled" : mode === "mixin" ? "tapRestricted" : "tapEnabled";
    return { label: labels[key](), enabled: installed === true && mode !== "disabled", locked: installed === true && mode === "mixin" };
}

function createTapViews({ defineComponent, EscCapture, Hint, getLanguage }) {
    const TapStatusIcon = defineComponent({
        props: { installed: { default: null }, mode: { default: "mixin" } }
    }, function renderTapStatusIcon() {
        const createElement = this._self._c, status = tapStatus(this.installed, this.mode, getLanguage());
        return createElement("Hint", { attrs: { hint: status.label, position: "right" } }, [createElement("span", {
            staticClass: "cfw-tap-status", style: { color: this.installed === true ? "#13AF42" : "#8b9299" },
            attrs: { role: "img", "aria-label": status.label, "data-tap-mode": this.mode }
        }, [status.enabled
            ? createElement("span", { staticClass: "icon", class: { "cfw-tap-router-locked": status.locked }, attrs: { "aria-hidden": "true" } }, [this._v("router")])
            : createElement("svg", { attrs: { viewBox: "0 -960 960 960", width: "22", height: "22", "aria-hidden": "true" } }, [createElement("path", { attrs: { fill: "currentColor", d: ROUTER_OFF } })]),
        status.locked ? createElement("span", { staticClass: "icon cfw-tap-lock", attrs: { "aria-hidden": "true" } }, [this._v("lock")]) : this._e()])]);
    });
    TapStatusIcon.components = { Hint };

    const TapManagementView = defineComponent({
        components: { EscCapture, TapStatusIcon },
        props: { mode: { default: "mixin" }, installed: { default: null }, busy: Boolean, allowMulticast: Boolean }
    }, function renderTapManagementView() {
        const createElement = this._self._c, labels = getLanguage();
        const choices = [labels.enable(), labels.tapMixinOnly(), labels.tapDisable()];
        const descriptions = [labels.tapEnabledDescribe(), labels.tapMixinDescribe(), labels.tapDisabledDescribe()];
        const close = () => { if (!this.busy) this.$emit("close"); };
        return createElement("EscCapture", { staticClass: "cfw-tap-dialog", on: { esc: close, mousedown: close } }, [createElement("section", {
            staticClass: "cfw-tap-card", attrs: { role: "dialog", "aria-modal": "true", "aria-busy": String(this.busy), "aria-label": labels.TAPdeviceManagement() },
            on: { mousedown: event => event.stopPropagation() }
        }, [createElement("div", { staticClass: "cfw-tap-scroll" }, [createElement("header", [createElement("span", [this._v(labels.TAPdeviceManagement())]), createElement("TapStatusIcon", { props: { installed: this.installed, mode: this.mode } })]),
        createElement("p", { staticClass: "cfw-tap-summary" }, [this._v(tapStatus(this.installed, this.mode, labels).label)]),
        createElement("div", { staticClass: "cfw-tap-segments", attrs: { role: "group", "aria-label": labels.tapPermission() } }, TAP_MODES.map((mode, index) => createElement("button", {
            key: mode, class: { selected: this.mode === mode }, attrs: { type: "button", disabled: this.busy, "aria-pressed": String(this.mode === mode), "data-tap-mode": mode },
            on: { click: () => { if (!this.busy && mode !== this.mode) this.$emit("change-mode", mode); } }
        }, [this._v(choices[index])]))),
        createElement("p", { staticClass: "cfw-tap-description" }, [this._v(descriptions[TAP_MODES.indexOf(this.mode)] || descriptions[1])]),
        createElement("label", { staticClass: "cfw-tap-multicast", style: { display: "flex", alignItems: "center", gap: "8px" } }, [
            createElement("input", { attrs: { type: "checkbox", disabled: this.busy }, domProps: { checked: this.allowMulticast },
                on: { change: event => { if (!this.busy) this.$emit("change-multicast", event.target.checked); } } }),
            this._v(labels.tapAllowMulticast())
        ]),
        createElement("p", { staticClass: "cfw-tap-description" }, [this._v(labels.tapAllowMulticastDescribe())]),
        this.mode === "mixin" ? createElement("details", { staticClass: "cfw-tap-examples" }, [createElement("summary", [this._v(labels.tapAuthorizationExample())]),
            createElement("p", [this._v(labels.tapYamlAuthorization())]), createElement("pre", [this._v("mixin:\n  dns:\n    enable: true\n    listen: :53\n    nameserver: [1.1.1.1]")]),
            createElement("p", [this._v(labels.tapJsAuthorization())]), createElement("pre", [this._v('module.exports.parse = ({ content }) => ({\n  ...content,\n  "cfw-tap": true,\n  dns: { ...content.dns, enable: true, listen: ":53" }\n})')])]) : this._e(),
        this.installed !== true ? createElement("p", { staticClass: "cfw-tap-summary" }, [this._v(labels.TAPinstallDescribe())]) : this._e(),
        createElement("div", { staticClass: "cfw-tap-actions" }, [labels.install(), labels.uninstall(), labels.customize()].map((label, index) => createElement("button", {
            attrs: { type: "button", disabled: this.busy }, on: { click: () => { if (!this.busy) this.$emit("action", index); } }
        }, [this._v(label)]))),
        this.busy ? createElement("p", { attrs: { role: "status" } }, [this._v(labels.pleaseWait())]) : this._e(),
        createElement("footer", [createElement("button", { attrs: { type: "button", disabled: this.busy }, on: { click: close } }, [this._v(labels.close())])])])])]);
    });
    return { TapStatusIcon, TapManagementView };
}

module.exports = { createTapViews, tapStatus };
