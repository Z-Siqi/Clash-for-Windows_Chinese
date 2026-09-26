"use strict";

function createSettingsPageRender({ getLanguage, cache, keys, setLanguageIndex, languageKey, renderConnectionDisconnectSettings }) {
    return function renderSettingsPage() {
                    const viewModel = this;
                    const createElement = viewModel._self._c;
                    const labels = getLanguage();
                    return createElement("div", {
                        staticClass: "main-setting-view"
                    }, [createElement("div", {
                        class: ["title", viewModel.isEditingExternal ? "blur" : ""]
                    }, [createElement("div", [viewModel._v(labels.settings())]), viewModel._v(" "), createElement("div", {
                        staticClass: "btns"
                    }, [createElement("div", {
                        staticClass: "btn",
                        on: {
                            click: viewModel.handleReset
                        }
                    }, [viewModel._v(labels.resetAllSettings())]), viewModel._v(" "), createElement("div", {
                        staticClass: "btn clickable btn-force-quit",
                        on: {
                            click: function(value) {
                                return viewModel.handleQuit(!0)
                            }
                        }
                    }, [viewModel._v("\n        " + labels.forceQuit() + "\n      ")]), viewModel._v(" "), createElement("div", {
                        staticClass: "btn clickable btn-quit",
                        on: {
                            click: function(value) {
                                return viewModel.handleQuit()
                            }
                        }
                    }, [viewModel._v(labels.quit())])])]), viewModel._v(" "), viewModel.settings ? createElement("div", {
                        ref: "mixin-scroll-content",
                        class: ["content", , viewModel.isEditingExternal ? "blur" : ""]
                    }, [createElement("Section", {
                        attrs: {
                            title: labels.security()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "relative flex items-center"
                    }, [createElement("div", [viewModel._v(labels.coreSecret())]), viewModel._v(" "), createElement("Info", [viewModel._v("\n            " + labels.coreSecretDscribeFirst() + " "), createElement("span", {
                        staticClass: "quote"
                    }, [viewModel._v("secret")]), viewModel._v(" " + labels.coreSecretDscribeSecond() + "\n            " + labels.coreSecretDscribeThird() + "\n             "), createElement("br"), createElement("br"), viewModel._v(labels.coreSecretDscribeFourth() + "\n            "), createElement("span", {
                        staticClass: "quote"
                    }, [viewModel._v("Home Directory/config.yaml")]), viewModel._v(".\n            "), createElement("br"), createElement("br"), viewModel._v(labels.coreSecretDscribeFifth() + "\n            "), createElement("ul", [createElement("li", [createElement("a", {
                        attrs: {
                            href: "https://web.archive.org/web/20231001060822/dreamacro.github.io/clash/configuration/configuration-reference.html"
                        }
                    }, [viewModel._v(labels.profiles())])])])]), viewModel._v(" "), createElement("Hint", {
                        staticClass: "gird ml-1 items-center",
                        attrs: {
                            position: "right",
                            hint: labels.recommendGenerateSecret()
                        }
                    }, ["" === viewModel.secret ? createElement("span", {
                        staticClass: "icon h-fit text-base text-[#FFAD00]"
                    }, [viewModel._v("warning")]) : viewModel._e()])], 1), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: "" === viewModel.secret ? labels.generate() : labels.update()
                        },
                        on: {
                            click: viewModel.handleGenerateUUIDSecret
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "relative flex items-center"
                    }, [createElement("div", [viewModel._v(labels.allowUnsafeURLs())]), viewModel._v(" "), createElement("Info", [viewModel._v("\n            " + labels.allowUnsafeURLsDescribeFirst()), createElement("br"), createElement("br"), viewModel._v("\n\n             "), createElement("strong", [viewModel._v(labels.allowUnsafeURLsDescribeSecond())]), viewModel._v(labels.allowUnsafeURLsDescribeThird()  +"\n          ")])], 1), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.edit()
                        },
                        on: {
                            click: viewModel.handleEditUnsafeURLs
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.disableLoadingAdsLink())]), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.disableLoadingAdsLink,
                            callback: function (value) {
                                if (value) {
                                    cache.put(keys.AD_IMAGES, "");
                                }
                                viewModel.$set(viewModel.settings, "disableLoadingAdsLink", value)
                            },
                            expression: "settings.disableLoadingAdsLink"
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.general()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.proxyCore())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.proxyCoreDescribe())])], 1), viewModel._v(" "), createElement("SelectView", {
                        attrs: {
                            items: [labels.legacyClashCore(), labels.mihomoCore()]
                        },
                        model: {
                            value: "mihomo" === viewModel.settings.proxyCore ? 1 : 0,
                            callback: function(value) {
                                return viewModel.handleProxyCoreChange(value)
                            },
                            expression: "settings.proxyCore"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.settingsEditor())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.settingsEditorFirst()), createElement("br"), createElement("br"), viewModel._v(labels.settingsEditorSecond() + "\n            "), createElement("strong", [viewModel._v(labels.custom())]), viewModel._v(labels.settingsEditorThird() + "\n            " + labels.settingsEditorFourth()), createElement("br"), viewModel._v(" "), createElement("span", {
                        staticClass: "quote"
                    }, [viewModel._v("code --wait")]), createElement("br"), viewModel._v(" "), createElement("span", {
                        staticClass: "quote"
                    }, [viewModel._v("subl --wait")])])], 1), viewModel._v(" "), createElement("SelectView", {
                        attrs: {
                            items: ["CFW", "Visual Studio Code", labels.custom()]
                        },
                        model: {
                            value: viewModel.settings.editor,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "editor", value)
                            },
                            expression: "settings.editor"
                        }
                    })], 1), viewModel._v(" "), 2 === viewModel.settings.editor ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.customEditorCommand())]), viewModel._v(" "), createElement("SimpleInput", {
                        staticClass: "input",
                        attrs: {
                            placeholder: "subl --wait"
                        },
                        model: {
                            value: viewModel.settings.editorCustomCommand,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "editorCustomCommand", value)
                            },
                            expression: "settings.editorCustomCommand"
                        }
                    })], 1) : viewModel._e(), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.notifications())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.notificationsDescribe())])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.showNotifications,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "showNotifications", value)
                            },
                            expression: "settings.showNotifications"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.silentStart())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.silentStartDescribe())])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.hideAfterStartup,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "hideAfterStartup", value)
                            },
                            expression: "settings.hideAfterStartup"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.randomControllerPort())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.randomControllerPortDescribe())])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.randomControllerPort,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "randomControllerPort", value)
                            },
                            expression: "settings.randomControllerPort"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.randomMixedPort())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.randomMixedPortDescribeFirst()), createElement("br"), createElement("br"), viewModel._v(labels.randomMixedPortDescribeSecond()), createElement("a", {
                        attrs: {
                            href: "https://web.archive.org/web/20231001060822/dreamacro.github.io/clash/configuration/configuration-reference.htmll"
                        }
                    }, [viewModel._v("mixed-port")]), viewModel._v(labels.randomMixedPortDescribeThird()), createElement("span", {
                        staticClass: "quote"
                    }, [viewModel._v("Home Directory/config.yaml")]), viewModel._v(".")])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.randomMixedPort,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "randomMixedPort", value)
                            },
                            expression: "settings.randomMixedPort"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.lightweightMode())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.lightweightModeDescribeStart()), createElement("br"), createElement("br"), viewModel._v(labels.lightweightModeDescribeEnd()), createElement("strong", [viewModel._v(labels.serviceMode())]), viewModel._v(".\n            "), createElement("br"), createElement("br"), viewModel._v(labels.forDetails() + "\n            "), createElement("a", {
                        attrs: {
                            href: "https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/contents/lightweight.html"
                        }
                    }, [viewModel._v(labels.docs())]), viewModel._v(".")])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.lightweightMode,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "lightweightMode", value)
                            },
                            expression: "settings.lightweightMode"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.guiLogFolder())]), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.open()
                        },
                        on: {
                            click: viewModel.handleOpenGUILog
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.guiDataFolder())]), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.open()
                        },
                        on: {
                            click: viewModel.handleOpenGUIDataFolder
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.checkForUpdate())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.checkForUpdateDescribe())])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.checkForUpdates,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "checkForUpdates", value)
                            },
                            expression: "settings.checkForUpdates"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.showNewVersionIcon())]), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.showNewVersionIcon,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "showNewVersionIcon", value)
                            },
                            expression: "settings.showNewVersionIcon"
                        }
                    })], 1), viewModel._v(" "), viewModel.isMacOS ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.automaticUpgrade())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.automaticUpgradeDescribe())])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.silentUpdate,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "silentUpdate", value)
                            },
                            expression: "settings.silentUpdate"
                        }
                    })], 1) : viewModel._e(), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.languageString())]), viewModel._v(" "), createElement("SelectView", {
                        attrs: {
                            items: ["简体中文", "English"]
                        },
                        model: {
                            value: cache.get(languageKey) === null ? 0 : cache.get(languageKey),
                            callback: function (value) {
                                if (value != cache.get(languageKey)) {
                                    cache.put(languageKey, value);
                                    setLanguageIndex(value);
                                    viewModel.$set(viewModel.settings, "language", value);
                                    require("electron").ipcRenderer.invoke("window", "reload");
                                }
                            },
                            expression: "settings.language"
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.appearance()
                        }
                    }, [viewModel.settings.systemTheme ? viewModel._e() : createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.theme())]), viewModel._v(" "), createElement("SelectView", {
                        attrs: {
                            items: labels.themeOption()
                        },
                        model: {
                            value: viewModel.settings.theme,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "theme", value)
                            },
                            expression: "settings.theme"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.followSystemTheme())]), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.systemTheme,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "systemTheme", value)
                            },
                            expression: "settings.systemTheme"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.fontFamily())]), viewModel._v(" "), createElement("SimpleInput", {
                        attrs: {
                            placeholder: viewModel.fontFamilyPlaceholder
                        },
                        model: {
                            value: viewModel.settings.fontFamily,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "fontFamily", value)
                            },
                            expression: "settings.fontFamily"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.titleBarText())]), viewModel._v(" "), createElement("Info", [createElement("div", [viewModel._v("\n              " + labels.titleBarTextDescribeFirst() + "\n            ")]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v("%mode%")]), viewModel._v(" - " + labels.titleBarTextDescribeSecond())]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v("%systemProxy%")]), viewModel._v(" - " + labels.titleBarTextDescribeThird())]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v("%tun%")]), viewModel._v(" - " + labels.titleBarTextDescribeFourth())]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v("%mixin%")]), viewModel._v(" - " + labels.titleBarTextDescribeFifth())])])], 1), viewModel._v(" "), createElement("SimpleInput", {
                        staticClass: "input",
                        attrs: {
                            placeholder: labels.titleBarTextDescribe()
                        },
                        model: {
                            value: viewModel.settings.titleBarText,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "titleBarText", value)
                            },
                            expression: "settings.titleBarText"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.runTimeFormat())]), viewModel._v(" "), createElement("SimpleInput", {
                        staticClass: "input",
                        attrs: {
                            placeholder: "hh : mm : ss"
                        },
                        model: {
                            value: viewModel.settings.runTimeFormat,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "runTimeFormat", value)
                            },
                            expression: "settings.runTimeFormat"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.useSystemEmoji())]), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.useSystemEmoji,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "useSystemEmoji", value)
                            },
                            expression: "settings.useSystemEmoji"
                        }
                    })], 1), viewModel._v(" "), viewModel.isWindows ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.useModeIcons())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.useModeIcons())])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.useModeIcons,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "useModeIcons", value)
                            },
                            expression: "settings.useModeIcons"
                        }
                    })], 1) : viewModel._e(), viewModel._v(" "), viewModel.isWindows && !viewModel.settings.useModeIcons ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.customizeTrayIcon())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.customizeTrayIconDescribe())])], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("SimpleInput", {
                        staticClass: "short-input",
                        attrs: {
                            placeholder: "ICO(.ico) " + labels.assetpath()
                        },
                        model: {
                            value: viewModel.settings.iconDefault,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "iconDefault", value)
                            },
                            expression: "settings.iconDefault"
                        }
                    }), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.select()
                        },
                        on: {
                            click: viewModel.handleChooseDefaultIcon
                        }
                    })], 1)]) : viewModel._e(), viewModel._v(" "), viewModel.isWindows && !viewModel.settings.useModeIcons ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.customizeTrayIconInProxy())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.customizeTrayIconInProxyDescribe())])], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("SimpleInput", {
                        staticClass: "short-input",
                        attrs: {
                            placeholder: "ICO(.ico) " + labels.assetpath()
                        },
                        model: {
                            value: viewModel.settings.iconSystemProxy,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "iconSystemProxy", value)
                            },
                            expression: "settings.iconSystemProxy"
                        }
                    }), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.select()
                        },
                        on: {
                            click: viewModel.handleChooseSystemProxytOnIcon
                        }
                    })], 1)]) : viewModel._e(), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.hideTrayIcon())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.hideTrayIconDescribe())])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.hideTrayIcon,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "hideTrayIcon", value)
                            },
                            expression: "settings.hideTrayIcon"
                        }
                    })], 1), viewModel._v(" "), viewModel.isLinux ? viewModel._e() : createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.trayProxyGroupsStyle())]), viewModel._v(" "), createElement("Info", [createElement("div", [viewModel._v(labels.trayProxyGroupsStyleDescribeFirst() + ":")]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v(labels.expand())]), viewModel._v(" - " + labels.trayProxyGroupsStyleDescribeSecond())]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v(labels.submenu())]), viewModel._v(" - " + labels.trayProxyGroupsStyleDescribeThird())]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v(labels.hidden())]), viewModel._v(" - " + labels.trayProxyGroupsStyleDescribeFourth())])])], 1), viewModel._v(" "), createElement("SelectView", {
                        attrs: {
                            items: [labels.submenu(), labels.expand(), labels.hidden()]
                        },
                        model: {
                            value: viewModel.settings.trayProxiesStyle,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "trayProxiesStyle", value)
                            },
                            expression: "settings.trayProxiesStyle"
                        }
                    })], 1), viewModel._v(" "), !viewModel.isLinux && [0, 1].includes(viewModel.settings.trayProxiesStyle) ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.showTrayProxyDelayIndicator())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.showTrayProxyDelayIndicatorDescribe()), createElement("br"), viewModel._v(" "), createElement("br"), viewModel._v("\n            " + labels.color() + "\n            "), createElement("li", [createElement("div", {
                        staticClass: "bg-green-400 w-2 h-2 rounded-full inline-block"
                    }), viewModel._v("\n              - " + labels.available() + "\n            ")]), viewModel._v(" "), createElement("li", [createElement("div", {
                        staticClass: "bg-red-400 w-2 h-2 rounded-full inline-block"
                    }), viewModel._v("\n              - " + labels.timeout() + "\n            ")]), viewModel._v(" "), createElement("li", [createElement("div", {
                        staticClass: "bg-gray-400 w-2 h-2 rounded-full inline-block"
                    }), viewModel._v("\n              - " + labels.unknown() + "\n            ")])])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.showTrayProxyDelayIndicator,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "showTrayProxyDelayIndicator", value)
                            },
                            expression: "settings.showTrayProxyDelayIndicator"
                        }
                    })], 1) : viewModel._e(), viewModel._v(" "), viewModel.isLinux ? viewModel._e() : createElement("separator"), viewModel._v(" "), viewModel.isLinux ? viewModel._e() : createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.enhancedTray())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.enhancedTrayDescribeFirst()), createElement("br"), createElement("br"), createElement("b", [viewModel._v("")]), viewModel._v(labels.enhancedTrayDescribeSecond() + ' \n           \n            '), createElement("a", {
                        attrs: {
                            href: "https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/contents/tray.html"
                        }
                    }, [viewModel._v(labels.onlineDocs())])])], 1), viewModel._v(" "), createElement("TrayOrder", {
                        model: {
                            value: viewModel.settings.trayOrders,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "trayOrders", value)
                            },
                            expression: "settings.trayOrders"
                        }
                    })], 1), viewModel._v(" "), viewModel.isLinux ? viewModel._e() : createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.text())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("SimpleInput", {
                        attrs: {
                            placeholder: labels.textdisplayTray()
                        },
                        model: {
                            value: viewModel.settings.trayText,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "trayText", value)
                            },
                            expression: "settings.trayText"
                        }
                    })], 1)]), viewModel._v(" "), viewModel.settings.trayText ? viewModel._e() : createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.script())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("SimpleInput", {
                        staticClass: "short-input",
                        attrs: {
                            placeholder: labels.scriptToRun()
                        },
                        model: {
                            value: viewModel.settings.trayScriptPath,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "trayScriptPath", value)
                            },
                            expression: "settings.trayScriptPath"
                        }
                    }), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.select()
                        },
                        on: {
                            click: viewModel.handleSelectTrayScriptPath
                        }
                    })], 1)]), viewModel._v(" "), !viewModel.settings.trayText && viewModel.settings.trayScriptPath ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.scriptInterval())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("SimpleInput", {
                        staticClass: "shorter-input",
                        attrs: {
                            placeholder: "seconds",
                            suffix: "s",
                            type: "number"
                        },
                        model: {
                            value: viewModel.settings.trayScriptInterval,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "trayScriptInterval", value)
                            },
                            expression: "settings.trayScriptInterval"
                        }
                    }), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: "Manual Run"
                        },
                        on: {
                            click: viewModel.handleTrayScriptManualRun
                        }
                    })], 1)]) : viewModel._e(), viewModel._v(" "), viewModel.isWindows ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.transparent())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("SimpleInput", {
                        staticClass: "shorter-input",
                        staticStyle: {
                            "margin-right": "10px"
                        },
                        attrs: {
                            placeholder: labels.foregroundColor()
                        },
                        model: {
                            value: viewModel.settings.trayColorForeground,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "trayColorForeground", value)
                            },
                            expression: "settings.trayColorForeground"
                        }
                    }), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.trayColorTransparent,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "trayColorTransparent", value)
                            },
                            expression: "settings.trayColorTransparent"
                        }
                    })], 1)]) : viewModel._e()], 1), viewModel._v(" "), viewModel.isLinux ? viewModel._e() : createElement("Section", {
                        attrs: {
                            title: labels.sysProxy()
                        }
                    }, [viewModel.isWindows ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.type())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.typeDescribe()), createElement("br"), createElement("br"), viewModel._v("\n            " + labels.forDetails()), createElement("br"), viewModel._v(" "), createElement("ul", [createElement("li", [createElement("a", {
                        attrs: {
                            href: "https://support.microsoft.com/en-us/windows/use-a-proxy-server-in-windows-03096c53-0554-4ffe-b6ab-8b1deee8dae1"
                        }
                    }, [viewModel._v(labels.useProxyServerWindows())])])])])], 1), viewModel._v(" "), createElement("SelectView", {
                        attrs: {
                            items: ["HTTP", "PAC"]
                        },
                        model: {
                            value: viewModel.settings.systemProxyTypeIndex,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "systemProxyTypeIndex", value)
                            },
                            expression: "settings.systemProxyTypeIndex"
                        }
                    })], 1) : viewModel._e(), viewModel._v(" "), viewModel.isWindows && 1 === viewModel.settings.systemProxyTypeIndex ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.contentPAC())]), viewModel._v(" "), createElement("Info", [createElement("a", {
                        attrs: {
                            href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file"
                        }
                    }, [viewModel._v("Learn PAC")]), viewModel._v(" "), createElement("br"), createElement("br"), viewModel._v(" "), createElement("span", {
                        staticClass: "quote"
                    }, [viewModel._v("%mixed-port%")]), viewModel._v(" is the placeholder of the\n            "), createElement("strong", [viewModel._v(labels.port())]), viewModel._v(" in "), createElement("strong", [viewModel._v(labels.general())])])], 1), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.edit()
                        },
                        on: {
                            click: viewModel.handleEditPACContent
                        }
                    })], 1) : viewModel._e(), viewModel._v(" "), viewModel.isWindows && 1 === viewModel.settings.systemProxyTypeIndex ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v("PAC Server Port")]), viewModel._v(" "), createElement("Info", [viewModel._v("\n            Leave it empty to use a random port."), createElement("br"), createElement("br"), viewModel._v(" "), createElement("strong", [viewModel._v("Restart the APP")]), viewModel._v(" to take effect.\n          ")])], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("SimpleInput", {
                        attrs: {
                            placeholder: "random",
                            type: "number"
                        },
                        model: {
                            value: viewModel.settings.innerServerPort,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "innerServerPort", value)
                            },
                            expression: "settings.innerServerPort"
                        }
                    })], 1)]) : viewModel._e(), viewModel._v(" "), 1 !== viewModel.settings.systemProxyTypeIndex || viewModel.isMacOS ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.bypassDomain())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.bypassDomainDescribeStart()), createElement("br"), createElement("br"), viewModel._v(labels.bypassDomainDescribeEnd()), createElement("br"), createElement("br"), viewModel._v("\n            " + labels.forDetails()), createElement("br"), viewModel._v(" "), createElement("ul", [createElement("li", [createElement("a", {
                        attrs: {
                            href: "https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/contents/bypass.html"
                        }
                    }, [viewModel._v(labels.onlineDocs())])]), viewModel._v(" "), createElement("li", [createElement("a", {
                        attrs: {
                            href: "https://support.microsoft.com/en-us/windows/use-a-proxy-server-in-windows-03096c53-0554-4ffe-b6ab-8b1deee8dae1"
                        }
                    }, [viewModel._v(labels.useProxyServerWindows() + "\n                ")])]), viewModel._v(" "), createElement("li", [createElement("a", {
                        attrs: {
                            href: "https://support.apple.com/guide/mac-help/enter-proxy-server-settings-on-mac-mchlp25912/mac"
                        }
                    }, [viewModel._v(labels.enterProxyServerSettingsMac())])]), viewModel._v(" "), createElement("li", [createElement("a", {
                        attrs: {
                            href: "https://source.chromium.org/chromium/chromium/src/+/main:net/proxy_resolution/"
                        }
                    }, [viewModel._v("Chromium\n                ")])])])])], 1), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.edit()
                        },
                        on: {
                            click: viewModel.handleEditBypass
                        }
                    })], 1) : viewModel._e(), viewModel._v(" "), viewModel.isWindows && 1 !== viewModel.settings.systemProxyTypeIndex ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.specifyProtocol())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.specifyProtocolDescribeStart()), createElement("br"), createElement("br"), viewModel._v(labels.specifyProtocolDescribeEnd()), createElement("br"), createElement("br"), viewModel._v("\n            " + labels.forDetails()), createElement("br"), viewModel._v(" "), createElement("ul", [createElement("li", [createElement("a", {
                        attrs: {
                            href: "https://github.com/python/cpython/pull/26307"
                        }
                    }, [viewModel._v("python/cpython#26307")])])])])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.specifyHttpProxyProtocol,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "specifyHttpProxyProtocol", value)
                            },
                            expression: "settings.specifyHttpProxyProtocol"
                        }
                    })], 1) : viewModel._e(), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.staticHost())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.staticHostDescribe())])], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("SimpleInput", {
                        attrs: {
                            placeholder: "127.0.0.1"
                        },
                        model: {
                            value: viewModel.settings.staticSystemProxyHost,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "staticSystemProxyHost", value)
                            },
                            expression: "settings.staticSystemProxyHost"
                        }
                    })], 1)])]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.mixin()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.type())]), viewModel._v(" "), createElement("Info", [createElement("a", {
                        attrs: {
                            href: "https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/contents/mixin.html"
                        }
                    }, [viewModel._v(labels.onlineDocs())])])], 1), viewModel._v(" "), createElement("SelectView", {
                        attrs: {
                            items: ["YAML", "JavaScript"]
                        },
                        model: {
                            value: viewModel.settings.mixinType,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "mixinType", value)
                            },
                            expression: "settings.mixinType"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v("YAML")]), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.edit()
                        },
                        on: {
                            click: viewModel.handleEditMixinYAML
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v("JavaScript")]), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.edit()
                        },
                        on: {
                            click: viewModel.handleEditMixinJS
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.proxies()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.proxyItemWidth())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.proxyItemWidthDescribe())])], 1), viewModel._v(" "), createElement("SimpleInput", {
                        attrs: {
                            placeholder: "290",
                            suffix: "px"
                        },
                        model: {
                            value: viewModel.settings.proxyItemWidth,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "proxyItemWidth", value)
                            },
                            expression: "settings.proxyItemWidth"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.miniListWidth())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.miniListWidthDescribe())])], 1), viewModel._v(" "), createElement("SimpleInput", {
                        attrs: {
                            placeholder: "100(0=" + labels.hide() + ")",
                            suffix: "px"
                        },
                        model: {
                            value: viewModel.settings.proxyMiniListWidth,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "proxyMiniListWidth", value)
                            },
                            expression: "settings.proxyMiniListWidth"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.orderBy())]), viewModel._v(" "), createElement("SelectView", {
                        attrs: {
                            items: labels.orderByOption()
                        },
                        model: {
                            value: viewModel.settings.proxyOrder,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "proxyOrder", value)
                            },
                            expression: "settings.proxyOrder"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.delayType())]), viewModel._v(" "), createElement("Info", [createElement("li", [createElement("b", [viewModel._v(labels.default())]), viewModel._v(" - " + labels.delayTypeDescribeStart())]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v(labels.meanDelay())]), viewModel._v(" - " + labels.delayTypeDescribeEnd())])])], 1), viewModel._v(" "), createElement("SelectView", {
                        attrs: {
                            items: [labels.default(), labels.meanDelay()]
                        },
                        model: {
                            value: viewModel.settings.proxyDelayType,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "proxyDelayType", value)
                            },
                            expression: "settings.proxyDelayType"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.latencyTestURL())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.latencyTestURLDescribe() + "\n           ")])], 1), viewModel._v(" "), createElement("SimpleInput", {
                        attrs: {
                            placeholder: "https://www.gstatic.com/generate_204"
                        },
                        model: {
                            value: viewModel.settings.latencyUrl,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "latencyUrl", value)
                            },
                            expression: "settings.latencyUrl"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.latencyTestTimeout())]), viewModel._v(" "), createElement("SimpleInput", {
                        attrs: {
                            type: "number",
                            placeholder: "3000",
                            suffix: "ms"
                        },
                        model: {
                            value: viewModel.settings.latencyTimeout,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "latencyTimeout", value)
                            },
                            expression: "settings.latencyTimeout"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.showFilter())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.showFilterDescribe() + "\n           ")])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.showProxyFilter,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "showProxyFilter", value)
                            },
                            expression: "settings.showProxyFilter"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.hideUnselectableGroup())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.hideUnselectableGroupDescribe() + "\n            ")])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.hideUnselectableGroup,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "hideUnselectableGroup", value)
                            },
                            expression: "settings.hideUnselectableGroup"
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.connections()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.breakWhenProxyChange())]), viewModel._v(" "), createElement("Info", [createElement("div", [viewModel._v("\n              " + labels.breakWhenProxyChangeDescribeFirst() + "\n            ")]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v(labels.breakWhenProxyChangeDescribeSecond())]), viewModel._v(" - " + labels.breakWhenProxyChangeDescribeThird())]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v(labels.breakWhenProxyChangeDescribeFourth())]), viewModel._v(" - " + labels.breakWhenProxyChangeDescribeFifth())]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v(labels.all())]), viewModel._v(" - " + labels.breakWhenProxyChangeDescribeSeventh())])])], 1), viewModel._v(" "), createElement("SelectView", {
                        attrs: {
                            items: labels.breakWhenProxyChangeOption()
                        },
                        model: {
                            value: viewModel.settings.connProxy,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "connProxy", value)
                            },
                            expression: "settings.connProxy"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.breakWhenProfileChange())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.breakWhenProfileChangeDescribe() + "\n            ")])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.connProfile,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "connProfile", value)
                            },
                            expression: "settings.connProfile"
                        }
                    })], 1), viewModel._v(" "), ...renderConnectionDisconnectSettings(viewModel, viewModel.$createElement, labels), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.showProcessIfPresent())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.showProcessIfPresentDescribe() + " \n            ")])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.connShowProcess,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "connShowProcess", value)
                            },
                            expression: "settings.connShowProcess"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.displayChainType())]), viewModel._v(" "), createElement("Info", [createElement("div", [viewModel._v("\n              " + labels.displayChainTypeDescribe() + "\n            ")]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v(labels.proxy())]), viewModel._v(labels.proxyName())]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v(labels.group())]), viewModel._v(labels.groupName())]), viewModel._v(" "), createElement("li", [createElement("b", [viewModel._v(labels.both())]), viewModel._v(labels.bothName())])])], 1), viewModel._v(" "), createElement("SelectView", {
                        attrs: {
                            items: labels.displayChainTypeOption()
                        },
                        model: {
                            value: viewModel.settings.connChainType,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "connChainType", value)
                            },
                            expression: "settings.connChainType"
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.providers()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.useCFWEditor())]), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.editProfileWithCFWEditor,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "editProfileWithCFWEditor", value)
                            },
                            expression: "settings.editProfileWithCFWEditor"
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.outbound()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.interfaceName())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.interfaceNameDescribe() + "\n           ")])], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [viewModel.detectedInterfaceName ? createElement("MoreHint", {
                        staticClass: "interface-hint",
                        attrs: {
                            text: labels.detected() + ": ".concat(viewModel.detectedInterfaceName),
                            clickable: !1
                        }
                    }) : viewModel._e(), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: viewModel.settings.interfaceName || labels.select()
                        },
                        on: {
                            click: viewModel.handleSelectInterface
                        }
                    })], 1)])]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.childProcesses()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.processes())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.processesDescribe() + ",\n            "), createElement("a", {
                        attrs: {
                            href: "https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/contents/childprocess.html"
                        }
                    }, [viewModel._v(labels.onlineDocs())])])], 1), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.edit()
                        },
                        on: {
                            click: viewModel.handleEditChildProcess
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.profiles()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.parsers())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.parsersDescribeStart() + "\n            "), createElement("a", {
                        attrs: {
                            href: "https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/contents/diff.html"
                        }
                    }, [viewModel._v("Diff")]), viewModel._v(labels.parsersDescribeEnd() + "\n            "), createElement("ul", [createElement("li", [createElement("a", {
                        attrs: {
                            href: "https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/contents/parser.html"
                        }
                    }, [viewModel._v(labels.onlineDocs())])])])])], 1), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.edit()
                        },
                        on: {
                            click: viewModel.handleEditProfileParsers
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.consoleOutput())]), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.openFile()
                        },
                        on: {
                            click: viewModel.handleOpenConsoleFile
                        }
                    })], 1), viewModel._v(" "), createElement("separator"), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.folderPath())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.folderPathDescribe())])], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("SimpleInput", {
                        staticClass: "short-input",
                        attrs: {
                            placeholder: labels.profilesFolderPath()
                        },
                        model: {
                            value: viewModel.settings.profilePath,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "profilePath", value)
                            },
                            expression: "settings.profilePath"
                        }
                    }), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.select()
                        },
                        on: {
                            click: viewModel.handleChooseProfilePath
                        }
                    })], 1)]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.requestHeaders())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.requestHeadersDescribeFirst()), createElement("br"), createElement("br"), viewModel._v("\n            " + labels.requestHeadersDescribeSecond() + "\n            ")])], 1), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.edit()
                        },
                        on: {
                            click: viewModel.handleEditHeaders
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.selectAfterUpdated())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.selectAfterUpdatedDescribe())])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.selectAfterUpdated,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "selectAfterUpdated", value)
                            },
                            expression: "settings.selectAfterUpdated"
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.updateThroughBuiltInProxy())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.updateThroughBuiltInProxyDescribe())])], 1), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.updateProfileThroughClashProxy,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "updateProfileThroughClashProxy", value)
                            },
                            expression: "settings.updateProfileThroughClashProxy"
                        }
                    })], 1)], 1), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.logs()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.preload())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.preloadDescribe())])], 1), viewModel._v(" "), createElement("SimpleInput", {
                        attrs: {
                            type: "number",
                            placeholder: "30",
                            suffix: labels.lines()
                        },
                        model: {
                            value: viewModel.settings.logPreloadLineCount,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "logPreloadLineCount", value)
                            },
                            expression: "settings.logPreloadLineCount"
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.ssid()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "relative flex items-center"
                    }, [createElement("div", [viewModel._v(labels.strategy())]), viewModel._v(" "), createElement("Info", [createElement("div", [viewModel._v(labels.strategyDescribe()), createElement("a", {
                        attrs: {
                            href: "https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/contents/ssid.html"
                        }
                    }, [viewModel._v(labels.onlineDocs())])])])], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "flex-grow"
                    }), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.edit()
                        },
                        on: {
                            click: viewModel.handleEditSSIDStrategy
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "relative flex items-center"
                    }, [createElement("div", [viewModel._v(labels.getCurrentSSID())]), viewModel._v(" "), createElement("Info", [createElement("div", [viewModel._v("\n              " + labels.getCurrentSSIDDescribe()), createElement("span", {
                        staticClass: "quote"
                    }, [viewModel._v(",")])])])], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "flex-grow"
                    }), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.fetch()
                        },
                        on: {
                            click: viewModel.handleFetchCurrentSSID
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.actions()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", {
                        staticClass: "flex items-center"
                    }, [createElement("div", [viewModel._v(labels.script())]), viewModel._v(" "), createElement("Info", [viewModel._v(labels.scriptActionDescribe() + ",\n            "), createElement("a", {
                        attrs: {
                            href: "https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/contents/actions.html"
                        }
                    }, [viewModel._v(labels.onlineDocs())])])], 1), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.edit()
                        },
                        on: {
                            click: viewModel.handleEditActionScripts
                        }
                    })], 1), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.consoleOutput())]), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.openFile()
                        },
                        on: {
                            click: viewModel.handleOpenActionScriptsConsoleFile
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.shortcut()
                        }
                    }, [viewModel.isLinux ? viewModel._e() : createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.sysProxy())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("KeyCapture", {
                        staticClass: "input",
                        attrs: {
                            placeholder: labels.record()
                        },
                        model: {
                            value: viewModel.settings.shortcutSystemProxy,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "shortcutSystemProxy", value)
                            },
                            expression: "settings.shortcutSystemProxy"
                        }
                    })], 1)]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.TUNmode())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("KeyCapture", {
                        staticClass: "input",
                        attrs: {
                            placeholder: labels.record()
                        },
                        model: {
                            value: viewModel.settings.shortcutTun,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "shortcutTun", value)
                            },
                            expression: "settings.shortcutTun"
                        }
                    })], 1)]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.mixin())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("KeyCapture", {
                        staticClass: "input",
                        attrs: {
                            placeholder: labels.record()
                        },
                        model: {
                            value: viewModel.settings.shortcutMixin,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "shortcutMixin", value)
                            },
                            expression: "settings.shortcutMixin"
                        }
                    })], 1)]), viewModel._v(" "), createElement("separator"), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.globalMode())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("KeyCapture", {
                        staticClass: "input",
                        attrs: {
                            placeholder: labels.record()
                        },
                        model: {
                            value: viewModel.settings.shortcutGlobalMode,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "shortcutGlobalMode", value)
                            },
                            expression: "settings.shortcutGlobalMode"
                        }
                    })], 1)]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.ruleMode())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("KeyCapture", {
                        staticClass: "input",
                        attrs: {
                            placeholder: labels.record()
                        },
                        model: {
                            value: viewModel.settings.shortcutRuleMode,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "shortcutRuleMode", value)
                            },
                            expression: "settings.shortcutRuleMode"
                        }
                    })], 1)]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.directMode())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("KeyCapture", {
                        staticClass: "input",
                        attrs: {
                            placeholder: labels.record()
                        },
                        model: {
                            value: viewModel.settings.shortcutDirectMode,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "shortcutDirectMode", value)
                            },
                            expression: "settings.shortcutDirectMode"
                        }
                    })], 1)]), viewModel._v(" "), viewModel.scriptModeVisible ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.scriptMode())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("KeyCapture", {
                        staticClass: "input",
                        attrs: {
                            placeholder: labels.record()
                        },
                        model: {
                            value: viewModel.settings.shortcutScriptMode,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "shortcutScriptMode", value)
                            },
                            expression: "settings.shortcutScriptMode"
                        }
                    })], 1)]) : viewModel._e(), viewModel._v(" "), createElement("separator"), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.showHieDashboard())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("KeyCapture", {
                        staticClass: "input",
                        attrs: {
                            placeholder: labels.record()
                        },
                        model: {
                            value: viewModel.settings.shortcutShowHideDashboard,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "shortcutShowHideDashboard", value)
                            },
                            expression: "settings.shortcutShowHideDashboard"
                        }
                    })], 1)]), viewModel._v(" "), viewModel.isLinux ? viewModel._e() : createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.runTrayScript())]), viewModel._v(" "), createElement("div", {
                        staticClass: "item"
                    }, [createElement("KeyCapture", {
                        staticClass: "input",
                        attrs: {
                            placeholder: labels.record()
                        },
                        model: {
                            value: viewModel.settings.shortcutRunTrayScript,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "shortcutRunTrayScript", value)
                            },
                            expression: "settings.shortcutRunTrayScript"
                        }
                    })], 1)])], 1), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.settingsEditor()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.fontSize())]), viewModel._v(" "), createElement("SimpleInput", {
                        attrs: {
                            type: "number",
                            placeholder: "13",
                            suffix: "px"
                        },
                        model: {
                            value: viewModel.settings.editorFontSize,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "editorFontSize", value)
                            },
                            expression: "settings.editorFontSize"
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.cache()
                        }
                    }, [createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.fakeIPCache())]), viewModel._v(" "), createElement("MoreHint", {
                        staticClass: "hint",
                        attrs: {
                            text: labels.clear()
                        },
                        on: {
                            click: viewModel.handlerClearFakeIPCache
                        }
                    })], 1)]), viewModel._v(" "), createElement("Section", {
                        attrs: {
                            title: labels.experimentalFeatures()
                        }
                    }, [viewModel.isMacOS ? createElement("div", {
                        staticClass: "item"
                    }, [createElement("div", [viewModel._v(labels.dhcpServer())]), viewModel._v(" "), createElement("SwitchView", {
                        model: {
                            value: viewModel.settings.enableDHCPServer,
                            callback: function(value) {
                                viewModel.$set(viewModel.settings, "enableDHCPServer", value)
                            },
                            expression: "settings.enableDHCPServer"
                        }
                    })], 1) : viewModel._e()])], 1) : viewModel._e(), viewModel._v(" "), createElement("navigator", {
                        attrs: {
                            list: viewModel.sections
                        },
                        on: {
                            select: viewModel.handleNavigatToGroup
                        }
                    }), viewModel._v(" "), viewModel.isEditingExternal ? createElement("div", {
                        staticClass: "edit-hint"
                    }, [createElement("div", [viewModel._v("\n      " + viewModel._s(["", "Visual Studio Code", "Sublime Text"][viewModel.settings.editor]) + " is\n      launching for editing.\n    ")]), viewModel._v(" "), createElement("div", [viewModel._v(labels.closeEditingFileSave())]), viewModel._v(" "), createElement("div", {
                        staticClass: "btn",
                        on: {
                            click: viewModel.cancelExternalEdit
                        }
                    }, [viewModel._v(labels.cancel())])]) : viewModel._e()], 1)
                };
}

module.exports = { createSettingsPageRender };
