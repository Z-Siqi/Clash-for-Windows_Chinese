"use strict";

function language(languageIndex, english, chinese) {
    return languageIndex === 0 ? chinese : english;
}
class Language {
    constructor(language) {
        this.language = language === null ? 0 : language
    }
    locale() { return language(this.language, 'en-us', 'zh-cn') }
    languageString() { return language(this.language, "Language", "语言") }
    loading() { return language(this.language, "Loading...", "加载中...") }
    error() { return language(this.language, "Error", "错误") }
    yes() { return language(this.language, "Yes", "是") }
    no() { return language(this.language, "No", "否") }
    failedConnectCore() { return language(this.language, "Could not connect to Clash core, logs are not available.", "无法连接到 Clash core 核心，日志不可用") }
    homeDirectory() { return language(this.language, "Home Directory", "主目录") }
    openFolder() { return language(this.language, "Open Folder", "打开文件夹") }
    logsFolder() { return language(this.language, "Logs Folder", "日志文件夹") }
    tryRepair() { return language(this.language, "Try to repair", "尝试修复") }
    ok() { return language(this.language, "OK", "确定") }
    text() { return language(this.language, "Text", "文本") }
    install() { return language(this.language, "Install", "安装") }
    uninstall() { return language(this.language, "Uninstall", "卸载") }
    name() { return language(this.language, "Name", "名字") }
    save() { return language(this.language, "Save", "保存") }
    cancel() { return language(this.language, "Cancel", "取消") }
    add() { return language(this.language, "Add", "添加") }
    quit() { return language(this.language, "Quit", "退出") }
    restartingCore() { return language(this.language, "Restarting core...", "重新启动核心...") }
    noProxyGroupInProfile() { return language(this.language, "No proxy group in this profile", "此配置文件中没有代理组") }
    connectInfo() { return language(this.language, "Connection Info", "连接信息") }
    cfwRunInBg() { return language(this.language, "Clash is running in the background", "Clash 正在后台运行") }
    enjoyFreedom() { return language(this.language, "Enjoy your free time", "享受您的自由时间") }
    failUpdateUrlProfile() { return language(this.language, "fail to update profile with url", "无法使用 url 更新配置资料") }
    profileUpdateFail() { return language(this.language, "Profile update failed", "配置资料更新失败") }
    profileDownloaded() { return language(this.language, "Profile had been downloaded successfully", "配置资料已成功下载") }
    appExiting() { return language(this.language, "app exiting, turn off system proxy", "应用退出, 关闭系统代理") }
    httpFailStart() { return language(this.language, "http server failed to start with error", "http 服务器因错误而无法启动") }
    httpStartAt() { return language(this.language, "http server started at", "http 服务器开始于") }
    firstLunach() { return language(this.language, "first luanch, creating config.yaml...", "首次发布, 创建 config.yaml 中...") }
    appStartWithMode() { return language(this.language, "app start with mode", "应用程序以模式开始") }
    failLoadGeneralCfg() { return language(this.language, "fail to load general config.yaml with error", "无法加载常规 config.yaml 并出现错误") }
    loadDataFromGeneral() { return language(this.language, "load data from general config.yaml", "从一般加载 config.yaml 数据") }
    general() { return language(this.language, "General", "主页") }
    proxies() { return language(this.language, "Proxies", "代理") }
    profiles() { return language(this.language, "Profiles", "配置") }
    logs() { return language(this.language, "Logs", "日志") }
    connections() { return language(this.language, "Connections", "连接") }
    feedback() { return language(this.language, "Feedback", "关于") }
    providers() { return language(this.language, "Providers", "提供") }
    stopSorting() { return language(this.language, "Stop Sorting", "停止排序") }
    connected() { return language(this.language, "Connected", "已连接") }
    disconnected() { return language(this.language, "Disconnected", "未连接") }
    nowVersionUpToDate() { return language(this.language, "You are awesome", "当前版本是最新的") }
    nowVersionUpToDateDescribe() { return language(this.language, "The current version is up to date.", "当前汉化版本也是最新的") }
    updatedThenRestartAsk() { return language(this.language, "Update installed successfully, do you want to restart the APP?", "更新安装成功，要重启APP吗?") }
    downloadDoneRunAsk() { return language(this.language, "Package downloaded successfully, do you want to execute it?", "包下载成功，要执行吗?") }
    port() { return language(this.language, "Port", "端口") }
    changeMixedPort() { return language(this.language, "Change Mixed Port", "更改混合端口") }
    newPort() { return language(this.language, "New Port", "新端口") }
    mixedPortUnavailable() { return language(this.language, "The proxy port is unavailable", "代理端口不可用") }
    mixedPortRecoveryDescribe() { return language(this.language, "The configured port is occupied. Enter another port or let the app find an available one.", "配置的端口已被占用。请输入其他端口，或让应用查找一个可用端口。") }
    invalidPort() { return language(this.language, "Port must be an integer between 1 and 65535", "端口必须是 1 到 65535 之间的整数") }
    portUnavailable() { return language(this.language, "That port is occupied or could not be activated. Please choose another one.", "该端口已被占用或无法启用，请选择其他端口。") }
    noAvailablePort() { return language(this.language, "No available port could be activated. Please enter one manually.", "无法启用可用端口，请手动输入一个端口。") }
    allowLAN() { return language(this.language, "Allow LAN", "允许局域网") }
    infoAllowLAN() { return language(this.language, "Turn on to listen on all interfaces by default, or else only listen\n          on 127.0.0.1. You can change the Bind Address on the right side to\n          specify a particular interface.", "默认开启监听所有接口，否则只监听127.0.0.1。 您可以更改右侧的绑定地址以指定特定接口") }
    logLevel() { return language(this.language, "Log Level", "日志级别") }
    clashCore() { return language(this.language, "Clash Core", "Clash 内核") }
    loopbackUWP() { return language(this.language, "UWP Loopback", "UWP 应用联网限制解除工具") }
    deviceTAP() { return language(this.language, "TAP Device", "虚拟网卡安装（TAP 模式）") }
    serviceMode() { return language(this.language, "Service Mode", "服务模式") }
    mixin() { return language(this.language, "Mixin", "混合配置") }
    sysProxy() { return language(this.language, "System Proxy", "系统代理") }
    askOpenURL() { return language(this.language, "Are you sure to open this URL", "您确定要打开此 URL?") }
    silent() { return language(this.language, "silent", "静默") }
    errorS() { return language(this.language, "error", "错误") }
    warn() { return language(this.language, "warn", "警告") }
    warning() { return language(this.language, "Warning", "警告") }
    info() { return language(this.language, "info", "信息") }
    debug() { return language(this.language, "debug", "调试") }
    logLevelSelection() { return language(this.language, ["silent", "error", "warn", "info", "debug"], ["静默", "错误", "警告", "信息", "调试"]) }
    silentDescribe() { return language(this.language, "silent will prevent .log file to generate on next startup", "静默将阻止 .log 文件在下次启动时生成, 而调试将收集所有运行信息至 .log 文件") }
    changeLogLevel() { return language(this.language, "Change Log Level", "更改日志收集级别") }
    global() { return language(this.language, "Global", "全局") }
    rule() { return language(this.language, "Rule", "规则") }
    direct() { return language(this.language, "Direct", "直连") }
    script() { return language(this.language, "Script", "脚本") }
    settings() { return language(this.language, "Settings", "设置") }
    resetAllSettings() { return language(this.language, "Reset All Settings", "重置所有设置") }
    forceQuit() { return language(this.language, "Force Quit", "强制退出") }
    security() { return language(this.language, "Security", "安全") }
    coreSecret() { return language(this.language, "Core Secret", "核心Secret") }
    coreSecretDscribeFirst() { return language(this.language, "Set Clash Core's", "将 Clash Core 的") }
    coreSecretDscribeSecond() { return language(this.language, "to a random RFC", "设置为随机的 RFC") }
    coreSecretDscribeThird() { return language(this.language, "4122 version 4 UUID, so that Clash REST API cannot be accessed arbitrarily.", "4122 版本 4 UUID，这样 Clash REST API 就不能被任意访问。") }
    coreSecretDscribeFourth() { return language(this.language, "The value is stored in the", "该值存储在于") }
    coreSecretDscribeFifth() { return language(this.language, "For details, see", "有关详细信息，请参阅Clash文档:") }
    allowUnsafeURLs() { return language(this.language, "Allow Unsafe URLs", "允许不安全的 URL") }
    allowUnsafeURLsDescribeFirst() { return language(this.language, "Set the URLs that do not verify the certificate when requesting", "设置请求时不验证证书的URL") }
    allowUnsafeURLsDescribeSecond() { return language(this.language, "Do not  ", "不要更改它") }
    allowUnsafeURLsDescribeThird() { return language(this.language, "change it, if you do not know what it is", ", 除非你知道它是什么") }
    settingsEditor() { return language(this.language, "Settings Editor", "配置编辑器") }
    settingsEditorFirst() { return language(this.language, "Text editor used by Settings.", "设置使用的文本编辑器") }
    settingsEditorSecond() { return language(this.language, "For", "对于") }
    settingsEditorThird() { return language(this.language, ", the command should only return control", ", 该命令只应在编辑文件关闭后返回控制权。") }
    settingsEditorFourth() { return language(this.language, "after the edited file is closed. For example:", "例如:") }
    custom() { return language(this.language, "Custom", "自定义") }
    actions() { return language(this.language, "Actions", "操作(Actions)") }
    theme() { return language(this.language, "Theme", "主题") }
    themeOption() { return language(this.language, ["Light", "Dark", "Minecraft", "Cyberpunk"], ["明亮", "深色", "我的世界", "赛博朋克"]) }
    networkInterfaces() { return language(this.language, "Network Interfaces", "网络端口") }
    mixinAllowsDescribe() { return language(this.language, "Mixin allows you to overwrite the original configuration file", "Mixin允许您覆盖原始配置文件") }
    startWithWindows() { return language(this.language, "Start with Windows", "开机自启动") }
    sortDescribe() { return language(this.language, "Drag to sort or add to the list on the right", "拖动以排序或添加到右侧列表中") }
    manage() { return language(this.language, "Manage", "管理") }
    reinstallDescribeWithTAP() { return language(this.language, "You need to reinstall the TAP device after you change these fields.", "更改这些字段后，您需要重新安装虚拟网卡") }
    TAPdeviceManagement() { return language(this.language, "TAP device management", "虚拟网卡设置管理") }
    TAPinstallDescribe() { return language(this.language, "An adapter named “cfw-tap” will route your data into clash.\n\n If the installation box pops up, keep clicking “Next”, until the installation is complete.", "名为 “cfw-tap” 的适配器会将您的数据路由到Clash中.\n\n如果弹出安装框, 请继续单击 “下一步”,  直到安装完成") }
    customize() { return language(this.language, "Customize", "定制") }
    serviceManagement() { return language(this.language, "Service management", "服务管理") }
    serviceManagementDescribe() { return language(this.language, "It might take a while.\nThe APP will be relaunched automatically.\n\nCurrent status: ", "这可能需要一段时间.\n该APP将自动重新启动.\n\n当前状态: ") }
    inactive() { return language(this.language, "Inactive", "未安装") }
    active() { return language(this.language, "Active", "已安装") }
    IPaddress() { return language(this.language, "IP Address", "IP地址") }
    subnetMask() { return language(this.language, "Subnet Mask", "子网掩码") }
    defaultGateway() { return language(this.language, "Default Gateway", "默认网关") }
    success() { return language(this.language, "Success", "成功") }
    failed() { return language(this.language, "Failed", "失败") }
    tapDeviceInstalled() { return language(this.language, "cfw-tap device had been installed", "cfw-tap 已安装") }
    notInstallTapDevice() { return language(this.language, "counld not install cfw-tap device", "无法安装 cfw-tap") }
    tapDeviceRemoved() { return language(this.language, "cfw-tap device had been removed", "cfw-tap 已被移除") }
    notRemoveTapDevice() { return language(this.language, "counld not remove cfw-tap device", "无法移除 cfw-tap") }
    TUNmode() { return language(this.language, "TUN Mode", "TUN 模式") }
    TUNmodeDescribe() { return language(this.language, "To enable this mode, please install Service Mode first. After enabling, all applications can be proxied.", "类似于虚拟网卡，启用后可代理所有应用。要启用此模式，请先安装服务模式") }
    recommended() { return language(this.language, "recommended", "推荐") }
    installMethod() { return language(this.language, "Install method:", "安装方法:") }
    cmmandsInCopied() { return language(this.language, "Commands have been copied to Clipboad", "命令已复制到剪贴板") }
    openTerminalSetProxy() { return language(this.language, "Open terminal with proxy set up", "打开终端并设置代理") }
    runAsAdmin() { return language(this.language, "run as admin", "以管理员身份运行") }
    selectTterminal() { return language(this.language, "Select a terminal", "选择一个终端") }
    copyCommandsOnly() { return language(this.language, "Copy Commands Only", "仅复制命令") }
    copyCommand() { return language(this.language, "Copy Command", "复制命令") }
    copyProxySettingCommands() { return language(this.language, "Copy proxy setting commands", "复制代理设置命令") }
    terminal() { return language(this.language, "terminal", "终端") }
    specialProxies() { return language(this.language, "Special Proxies", "特殊代理") }
    randomMixedPort() { return language(this.language, "Random Mixed Port", "随机混合端口") }
    randomMixedPortDescribeFirst() { return language(this.language, "Turn on to generate a new proxy server port number when the app starts.\n            ", "打开应用程序启动时生成新的代理服务器端口号。\n            ") }
    randomMixedPortDescribeSecond() { return language(this.language, "The value is shown as Port in General, and is \n            stored as\n            ", "该值在 General 中显示为 Port，\n            并存储为\n            ") }
    randomMixedPortDescribeThird() { return language(this.language, "\n            in the\n            ", "\n            位于: \n            ") }
    launchHelper() { return language(this.language, "Launch Helper", "启动助手") }
    bind() { return language(this.language, "Bind: ", "绑定地址: ") }
    newBindAddress() { return language(this.language, "New Bind Address", "新绑定地址") }
    changeBindAddress() { return language(this.language, "Change Bind Address", "更改绑定地址") }
    changeBindAddressDescribe() { return language(this.language, "Allow LAN will only bind to address you set, * means all interfaces", "允许LAN只会绑定到您设置的地址，* 表示所有接口") }
    serversDNS() { return language(this.language, "DNS Servers", "DNS 服务器") }
    modeSettingsTUN() { return language(this.language, "TUN Mode Settings", "TUN 模式设置") }
    fallbackDNSServers() { return language(this.language, "Fallback DNS Servers", "后备 DNS 服务器") }
    deaultNameserver() { return language(this.language, "Deault Nameserver", "默认名称服务器") }
    fakeIPFilter() { return language(this.language, "Fake IP Filter", "Fake IP 过滤器") }
    nameserverPolicy() { return language(this.language, "Nameserver Policy", "域名服务器政策") }
    domain() { return language(this.language, "domain", "域名") }
    hijacksDNS() { return language(this.language, "DNS Hijacks", "DNS 劫持") }
    stackTUN() { return language(this.language, "TUN Stack", "TUN 码(TUN Stack)") }
    autoDetectInterface() { return language(this.language, "Auto Detect Interface", "自动检测接口") }
    eg() { return language(this.language, "eg: ", "例子: ") }
    addFirewallRules() { return language(this.language, "add firewall rules (for Allow LAN and system stack)", "添加防火墙规则 (允许 LAN 和系统堆栈)") }
    previewCfgToClashCore() { return language(this.language, "Preview the final configuration file that was submitted to Clash Core", "预览提交给 Clash Core 的最终配置文件") }
    useClashCoreSeeHost() { return language(this.language, "Resolve a host using Clash core", "使用 Clash core 解析 Host") }
    testByScriptMode() { return language(this.language, "Test script using by Script mode", "使用脚本模式测试脚本") }
    authority() { return language(this.language, "Authority", "授权") }
    queryDNS() { return language(this.language, "DNS Query", "DNS 查询") }
    host() { return language(this.language, "Host", "主机（Host）") }
    lookup() { return language(this.language, "Lookup", "检索") }
    pleaseInputDomain() { return language(this.language, "Please input domain", "请输入域名") }
    scriptTest() { return language(this.language, "Script Test", "脚本测试") }
    network() { return language(this.language, "Network", "网络") }
    modeDNS() { return language(this.language, "DNS Mode", "DNS 模式") }
    sourceIP() { return language(this.language, "Source IP", "源 IP") }
    sourcePort() { return language(this.language, "Source Port", "源端口") }
    destinationIP() { return language(this.language, "Destination IP", "目的地 IP") }
    destinationPort() { return language(this.language, "Destination Port", "目的地端口") }
    processPath() { return language(this.language, "Process Path", "进程路径") }
    type() { return language(this.language, "type", "类型") }
    typeDescribe() { return language(this.language, "Windows accepts an HTTP endpoint or PAC\n            (proxy auto-configuration) script. The HTTP mode is generally\n            sufficient.", "Windows 接受 HTTP 端点或 PAC\n            （代理自动配置）脚本。\n            HTTP 模式通常就足够了。") }
    customizeTrayIconInProxy() { return language(this.language, "Proxy On Icon Path", "自定义代理启用时的状态栏图标") }
    customizeTrayIconInProxyDescribe() { return language(this.language, "Set the taskbar icon when system proxy/TUN/hybrid configuration is turned on", "设置当 系统代理/TUN/混合配置 开启时的任务栏图标") }
    customizeTrayIcon() { return language(this.language, "Default Icon Path", "自定义状态栏图标") }
    customizeTrayIconDescribe() { return language(this.language, "Set the taskbar icon in the default state", "设置默认的任务栏图标") }
    check() { return language(this.language, "Check", "测试") }
    timeout() { return language(this.language, "Timeout", "超时") }
    profileDescribeStart() { return language(this.language, "Go to", "前往") }
    profileDescribeEnd() { return language(this.language, "to import/switch a profile", "导入/切换配置文件") }
    allTrafficGoDirectly() { return language(this.language, "All traffic will go directly", "所有流量都会直连") }
    routedThroughSelectedProxy() { return language(this.language, "Routed through the selected proxy", "通过选定的代理路由") }
    routedAccordingRule() { return language(this.language, "Routed according to the rules", "按规则路由") }
    goDirectly() { return language(this.language, "Go directly", "直接连接") }
    routedAccordingScript() { return language(this.language, "Routed according to the script", "根据脚本进行路由") }
    inbound() { return language(this.language, "Inbounds", "进入") }
    edit() { return language(this.language, "Edit", "编辑") }
    editExternally() { return language(this.language, "Edit externally", "在系统中编辑") }
    update() { return language(this.language, "Update", "更新") }
    openFile() { return language(this.language, "Open File", "打开文件") }
    showInFolder() { return language(this.language, "Show in folder", "打开文件所在位置") }
    diffDescribe() { return language(this.language, "Make changes to a profile then merge them for it when refresh profile.", "对配置文件进行更改，然后在更新时合并它们。") }
    docs() { return language(this.language, "Docs", "文档") }
    initDiffFiles() { return language(this.language, "Init diff files", "初始化 diff 文件") }
    sideBySideMode() { return language(this.language, "Side by side mode", "并排模式") }
    diffControlsDescribe() { return language(this.language, "Controls whether the diff editor shows the diff side by side or inline.", "控制 diff 编辑器是并排还是内联显示 diff") }
    makeChangesAndDelete() { return language(this.language, ["Make changes", "Delete diff files"], ["修改文件", "删除 diff 文件"]) }
    askDelete() { return language(this.language, "Are you sure to delete ", "您确定要删除 ") }
    diffFiles() { return language(this.language, "diff files", "diff 文件") }
    failMergeProfile() { return language(this.language, 'Fail to merge profiles, "Make changes" to solve issues.', '无法合并配置文件, "修改文件" 以解决问题.') }
    scrollGroup() { return language(this.language, "Scroll to group", "移动至组") }
    proxyGroups() { return language(this.language, "Proxy Groups", "代理组") }
    diffChangeContainConflict() { return language(this.language, 'Changes contains conflict, "Make changes" to solve issues', '更改包含冲突, "修改(diff)文件" 以解决问题') }
    askSaveChange() { return language(this.language, "Do you want to save the changes?", "是否要保存更改?") }
    requestRefresh() { return language(this.language, "A refresh is required to apply the different changes. Do it now?", "需要刷新才能应用不同的更改。立即执行?") }
    requestRefreshOption() { return language(this.language, ["Refresh", "Not now"], ["刷新", "现在不要"]) }
    fiterByKeywords() { return language(this.language, "fiter by keywords", "按关键字过滤") }
    scrollToProxy() { return language(this.language, "scroll to selected proxy", "移动到选定的代理") }
    showHieDashboard() { return language(this.language, "Show/Hide Dashboard", "显示/隐藏仪表板") }
    showHieTimedOutProxies() { return language(this.language, "Show/Hide timed-out proxies", "显示/隐藏超时节点") }
    runTrayScript() { return language(this.language, "Run Tray Script", "运行托盘脚本") }
    showConnections() { return language(this.language, "Show connections", "显示连接") }
    testLatency() { return language(this.language, "test latency", "测试延迟") }
    runScript() { return language(this.language, "Run script", "运行脚本") }
    topMatchRule() { return language(this.language, "Top 100 matching rules", "前100个匹配规则") }
    copy() { return language(this.language, "Copy", "复制") }
    duplicateProfile() { return language(this.language, "duplicate profile", "复制配置文件") }
    inputNewFileName() { return language(this.language, "Input a new file name", "输入一个新的文件名") }
    downloadFromURL() { return language(this.language, "Download from a URL", "从URL下载") }
    downloading() { return language(this.language, "Downloading", "下载中") }
    download() { return language(this.language, "Download", "下载") }
    copyURL() { return language(this.language, "Copy URL", "复制 URL") }
    updateAll() { return language(this.language, "Update All", "更新全部") }
    import() { return language(this.language, "Import", "导入") }
    scheme() { return language(this.language, "Scheme", "跳转方案") }
    delete() { return language(this.language, "Delete", "删除") }
    editProfileInformation() { return language(this.language, "Edit profile information", "编辑配置信息") }
    updateInterval() { return language(this.language, "Update Interval (hour)", "更新间隔(小时)") }
    localFileAlreadyExist() { return language(this.language, "Local file already exist.", "本地文件已存在.") }
    closeEditingFileSave() { return language(this.language, "Close the editing file to Save", "关闭编辑文件以保存") }
    requestLogs() { return language(this.language, "Request Logs", "请求日志") }
    emptyLogList() { return language(this.language, "Empty log list", "空日志列表") }
    start() { return language(this.language, "Start", "开始") }
    pause() { return language(this.language, "Pause", "暂停") }
    refreshBrowserMakeRequest() { return language(this.language, "Refresh your browser to make requests.", "刷新浏览器以发出请求.") }
    clear() { return language(this.language, "Clear", "清除") }
    search() { return language(this.language, "Search", "搜索") }
    resume() { return language(this.language, "Resume", "恢复") }
    headers() { return language(this.language, "Headers", "标头") }
    updateCron() { return language(this.language, "Update ", "更新定时程序 ") }
    parsers() { return language(this.language, "Parsers", "配置文件预处理") }
    parsersOption() { return language(this.language, ["Edit Parsers", "OK"], ["编辑解析器", "确认"]) }
    parsersDescribeStart() { return language(this.language, "Modify and customize your profiles after download but before", "在下载后修改和自定义你的配置，在") }
    parsersDescribeEnd() { return language(this.language, ".", "开始之前.") }
    parsersStart() { return language(this.language, "Found ", "找到 ") }
    parsersEnd() { return language(this.language, " matching parsers", " 个匹配解析器") }
    qrCode() { return language(this.language, "QR Code", "二维码") }
    chains() { return language(this.language, "Chains: ", "模式: ") }
    simpleAndDetailed() { return language(this.language, ["Simple", "Detailed"], ["简略", "详细"]) }
    infoAndDebug() { return language(this.language, ["info", "debug"], ["信息", "调试"]) }
    server() { return language(this.language, "server", "服务器") }
    updateThroughBuiltInProxyDescribe() { return language(this.language, "By default, requests in CFW will follow the system proxy\n            settings. When this switch is turned on, the update requests for\n            Profiles will be directed through the built-in proxy in\n            Clash.", "默认情况下，CFW 中的请求将遵循系统代理设置。 当此开关打开时，Profiles 的更新请求将通过内置代理定向至 Clash。") }
    updateThroughBuiltInProxy() { return language(this.language, "Update Through Built-in Proxy", "通过内置代理更新") }
    checkForUpdate() { return language(this.language, "Check For Updates", "检查更新") }
    checkForUpdateDescribe() { return language(this.language, "Set whether to check for updates every 6 hours", "设置是否每6小时检查一次更新") }
    ssid() { return language(this.language, "Service Set Identifier (SSID)", "服务集标识 (SSID)") }
    closeAll() { return language(this.language, "Close All", "全部关闭") }
    startTime() { return language(this.language, "Start Time", "开始时间") }
    uploadSpeed() { return language(this.language, "Upload Speed", "上传速度") }
    downloadSpeed() { return language(this.language, "Download Speed", "下载速度") }
    total() { return language(this.language, "Total", "总共") }
    uploadTraffic() { return language(this.language, "Upload Traffic", "上传流量") }
    downloadTraffic() { return language(this.language, "Download Traffic", "下载流量") }
    destination() { return language(this.language, "Destination", "目的地") }
    reorder() { return language(this.language, "Reorder", "重新排序") }
    scrollViewMore() { return language(this.language, "scroll to view more", "滑动鼠标以查看更多") }
    askResetAllSettings() { return language(this.language, "Are you sure to reset all settings?", "您确定要重设所有设置吗?") }
    askQuit() { return language(this.language, "Are you sure to quit?", "你确定要退出吗?") }
    path() { return language(this.language, "path", "路径") }
    appearance() { return language(this.language, "Appearance", "外观") }
    notifications() { return language(this.language, "Send Relevant Information", "向系统通知栏发送相关信息") }
    notificationsDescribe() { return language(this.language, "Set whether to allow pop-up system-level notifications which is related to Clash For Windows", "向系统通知栏发送相关信息") }
    silentStart() { return language(this.language, "Silent Start", "开启Clash时默认缩小到任务栏") }
    silentStartDescribe() { return language(this.language, "Set whether to display dashboard at startup", "设置是否在程序启动时显示仪表板窗口") }
    randomControllerPort() { return language(this.language, "Random Controller Port", "随机占用端口") }
    randomControllerPortDescribe() { return language(this.language, "Set whether to use a random port as the core controller port (the\n            port section of external-controller in Home\n            Directory/config.ymal)", "设置是否使用随机端口作为核心控制器端口 (\n            Home Directory/config.yaml 中 external-controller\n            的端口部分)") }
    lightweightMode() { return language(this.language, "Lightweight Mode", "轻量模式") }
    lightweightModeDescribeStart() { return language(this.language, "Turn on to terminate app processes after closing the dashboard,\n            but keep Clash Core running in the background. Most of the。\n            features provided by CFW will be unavailable then.\n            ", "关闭仪表板后打开以终止应用程序进程,\n            但保持 Clash Core 在后台运行。\n            届时，CFW 提供的大部分功能将不可用\n            ") }
    lightweightModeDescribeEnd() { return language(this.language, "Relies on the ", "依赖: ") }
    runTimeFormat() { return language(this.language, "Run Time Format", "运行时间格式") }
    guiLogFolder() { return language(this.language, "GUI Log Folder", "GUI日志文件夹") }
    guiDataFolder() { return language(this.language, "GUI Data Folder", "GUI数据文件夹") }
    open() { return language(this.language, "Open", "打开") }
    followSystemTheme() { return language(this.language, "Follow System Theme", "遵循系统主题") }
    fontFamily() { return language(this.language, "Font Family", "字体系列") }
    useSystemEmoji() { return language(this.language, "Use System Emoji", "使用系统表情符号") }
    assetpath() { return language(this.language, "asset path", "路径") }
    enhancedTray() { return language(this.language, "Enhanced Tray", "悬浮窗") }
    enhancedTrayDescribeFirst() { return language(this.language, "Set whether to enable custom taskbar (macOS) / hover window\n            (Windows)", "设置是否启用自定义任务栏 (macOS) / 悬停窗口\n            (Windows)") }
    enhancedTrayDescribeSecond() { return language(this.language, "Drag icons between ”show” and ”hide“ to control", "在“显示”和“隐藏”之间拖动图标来控制") }
    textdisplayTray() { return language(this.language, "Text to display in tray", "要显示在悬浮窗中的文本") }
    select() { return language(this.language, "Select", "选择") }
    transparent() { return language(this.language, "Transparent", "透明") }
    foregroundColor() { return language(this.language, "foreground color", "前景色") }
    scriptToRun() { return language(this.language, "Script to run", "要运行的脚本") }
    showNewVersionIcon() { return language(this.language, "Show New Version Icon", "有新版本时提醒") }
    bypassDomain() { return language(this.language, "Bypass Domain", "绕过域/网络") }
    bypassDomainDescribeStart() { return language(this.language, "Bypass (don't use) the proxy server when visiting certain\n            addresses.", "访问某些地址时绕过（不使用）代理服务器。") }
    bypassDomainDescribeEnd() { return language(this.language, "\n            The interpretation of this list is OS-dependent and app-dependent.\n            In other words, your operating systems and applications may\n            evaluate the rules differently.", "\n            此列表的解释取决于操作系统和应用程序. 换句话说，您的操作系统和应用程序可能会以不同的方式评估规则") }
    specifyProtocol() { return language(this.language, "Specify Protocol", "指定协议") }
    specifyProtocolDescribeStart() { return language(this.language, "Turn on to forcibly add scheme to the system proxy settings.", "打开以强制将方案添加到系统代理设置") }
    specifyProtocolDescribeEnd() { return language(this.language, "\n            This is not for general-purpose use, and indeed violates the\n            current spec of Windows. Consider it only when an old Python\n            program has trouble.", "\n            这不是通用用途,\n            并且确实违反了当前的 Windows 规范.\n            仅在使用旧的 Python 时才考虑它.") }
    staticHost() { return language(this.language, "Static Host", "静态主机") }
    staticHostDescribe() { return language(this.language, "Set the system proxy Host part to static content, if not set, the\n            host defaults to 127.0.0.1", "将系统代理主机部分设置为静态内容, 如果没有设置,\n            主机默认为 127.0.0.1") }
    proxyItemWidth() { return language(this.language, "Proxy Item Width", "代理项目宽度") }
    proxyItemWidthDescribe() { return language(this.language, "Set the display width of each proxy in the Proxies module", "在代理界面中设置每个节点的显示宽度") }
    breakWhenProxyChange() { return language(this.language, "Break When Proxy Change", "代理更改时中断连接") }
    breakWhenProxyChangeOption() { return language(this.language, ["None", "Chain", "All"], ["不中断", "旧链接", "所有"]) }
    breakWhenProxyChangeDescribeFirst() { return language(this.language, "Set the strategy for closing connections when switching proxies in the Proxies module.", "在代理模块中设置切换代理时关闭连接的策略:") }
    breakWhenProxyChangeDescribeSecond() { return language(this.language, "None", "不中断") }
    breakWhenProxyChangeDescribeThird() { return language(this.language, "Do not close", "不关闭任何链接") }
    breakWhenProxyChangeDescribeFourth() { return language(this.language, "Chain", "旧链接") }
    breakWhenProxyChangeDescribeFifth() { return language(this.language, "Close connections with proxy name in chain", "中断通过该代理组的连接") }
    all() { return language(this.language, "All", "全部") }
    breakWhenProxyChangeDescribeSeventh() { return language(this.language, "Close all connections", "关闭所有连接") }
    miniListWidth() { return language(this.language, "Mini List Width", "策略组导航器宽度") }
    miniListWidthDescribe() { return language(this.language, "Set the width of the minilist in the Proxies module", "设置代理界面导航栏宽度") }
    orderBy() { return language(this.language, "Order By", "自定义节点排序") }
    orderByOption() { return language(this.language, ["Default", "Latency", "Alphabet"], ["默认", "延迟", "字母"]) }
    latencyTestURL() { return language(this.language, "Latency Test URL", "延迟测试网址") }
    latencyTestURLDescribe() { return language(this.language, "Set the URL used when clicking the Delay Test button in the Proxies module", "设置在代理模块中单击延迟测试按钮时使用的 URL") }
    latencyTestTimeout() { return language(this.language, "Latency Test Timeout", "延迟测试超时") }
    showFilter() { return language(this.language, "Show Filter", "显示筛选过滤器") }
    showFilterDescribe() { return language(this.language, "Set the Proxies module to display the keyword filter icon or not", "设置代理模块是否显示关键字过滤器图标") }
    hideUnselectableGroup() { return language(this.language, "Hide Unselectable Group", "隐藏无法选择的代理组") }
    hideUnselectableGroupDescribe() { return language(this.language, "Set whether to hide unselectable proxy groups in the Proxies", "设置是否隐藏代理模块中不可选择的代理组") }
    forDetails() { return language(this.language, "For details, see", "有关详细信息，请参阅:") }
    docs() { return language(this.language, "docs", "帮助文档") }
    titleBarText() { return language(this.language, "Title Bar Text", "标题栏文本") }
    titleBarTextDescribe() { return language(this.language, "Text to display in title bar", "要在标题栏中显示的文本") }
    titleBarTextDescribeFirst() { return language(this.language, "Set the text in title bar, some placeholders for replacement:", "设置标题栏的文字，一些替换的占位符:") }
    titleBarTextDescribeSecond() { return language(this.language, "Current proxy mode", "当前代理模式") }
    titleBarTextDescribeThird() { return language(this.language, "System Proxy status, On or Off", "系统代理状态，打开或关闭") }
    titleBarTextDescribeFourth() { return language(this.language, "TUN Mode status, On or Off", "TUN 模式状态，开或关") }
    titleBarTextDescribeFifth() { return language(this.language, "Mixin status, On or Off", "Mixin 状态，开或关") }
    breakWhenProfileChange() { return language(this.language, "Break When Profile Change", "配置文件更改时中断连接") }
    breakWhenProfileChangeDescribe() { return language(this.language, "Set whether to close all connections when switching", "设置配置文件改变时是否关闭所有连接") }
    breakWhenModeChange() { return language(this.language, "Break When Core Routing Mode Changes", "核心路由模式切换时断开连接") }
    breakWhenModeChangeDescribe() { return language(this.language, "Close all core connections when switching between Rule, Global, Direct or Script. This does not refer to the System Proxy, TUN or Mixin switches.", "在 Rule（规则）、Global（全局）、Direct（直连）或 Script（脚本）之间切换时，断开所有核心连接。此处不指 System Proxy、TUN 或 Mixin 开关。") }
    breakWhenProxyDisabled() { return language(this.language, "Close Existing Connections When Disabling Proxy", "关闭代理时断开旧连接") }
    breakWhenProxyDisabledDescribe() { return language(this.language, "After System Proxy is successfully turned off, or turning off TUN/Mixin actually disables TUN/TAP, close the core connections that existed before the operation. Enabling a proxy or an ordinary configuration refresh does not trigger this option. Connections created afterward are kept. Enabled by default.", "成功关闭 System Proxy，或关闭 TUN/Mixin 并实际停用 TUN/TAP 后，断开操作前已存在的核心连接。开启代理或普通配置刷新不会触发此选项，操作后新建的连接会保留。默认开启。") }
    displayChainType() { return language(this.language, "Display Chain Type", "显示链接类型") }
    displayChainTypeDescribe() { return language(this.language, "Set the type of chain displayed in the Connections module", "设置连接模块中显示的链类型") }
    displayChainTypeOption() { return language(this.language, ["Proxy", "Group", "Both"], ["节点名", "分组名", "全部"]) }
    outbound() { return language(this.language, "Outbound", "选择流量出接口") }
    interfaceName() { return language(this.language, "Interface Name", "接口名称") }
    interfaceNameDescribe() { return language(this.language, "Set interface name to overwrite like Mixin, will be removed in the future", "像 Mixin 一样设置接口名覆盖，以后会移除") }
    detected() { return language(this.language, "Detected", "侦测到") }
    childProcesses() { return language(this.language, "Child Processes", "子进程") }
    processes() { return language(this.language, "Processes", "启动其他应用") }
    processesDescribe() { return language(this.language, "Set child processes to be spawned with dashboard", "设置要使用仪表板生成的子进程") }
    consoleOutput() { return language(this.language, "Console Output", "控制台输出") }
    folderPathDescribe() { return language(this.language, "Set the path to the profiles folder, default: Home\n            Directory/profiles", "设置配置文件文件夹的路径，如果在CFW软件根目录下创建名为 data 的文件夹则会开启便携模式，默认路径: Home\n            Directory/profiles") }
    folderPath() { return language(this.language, "Folder Path", "资料夹路径") }
    requestHeaders() { return language(this.language, "Request Headers", "自定义请求头") }
    requestHeadersDescribeFirst() { return language(this.language, "Set the request header content when updating a profile", "更新配置文件时设置请求标头内容") }
    requestHeadersDescribeSecond() { return language(this.language, "the individual profile request header content in the Profiles", "在 Profiles 模块中设置单独的配置文件请求头内容") }
    scriptActionDescribe() { return language(this.language, "Set the code to be called when the Action is executed", "设置执行Action时要调用的代码") }
    selectAfterUpdated() { return language(this.language, "Select After Updated", "更新后选择") }
    selectAfterUpdatedDescribe() { return language(this.language, "Set whether the profile is selected after updating", "设置是否在更新后选择已更新的配置文件") }
    profilesFolderPath() { return language(this.language, "Profiles folder path", "配置文件文件夹路径") }
    healthCheckAll() { return language(this.language, "Health Check All", "检查全部连接") }
    proxyProviders() { return language(this.language, "Proxy Providers", "代理提供者") }
    chooseOutboundInterface() { return language(this.language, "Choose outbound interface", "选择出接口") }
    chooseOutboundInterfaceDescribe() { return language(this.language, "only works when TAP mode enabled", "仅在启用TAP模式时有效") }
    reset() { return language(this.language, "Reset", "重置") }
    onlineDocs() { return language(this.language, "Docs", "在线文档") }
    shortcut() { return language(this.language, "Shortcuts", "快捷键") }
    globalMode() { return language(this.language, "Global Mode", "全局模式") }
    ruleMode() { return language(this.language, "Rule Mode", "规则模式") }
    directMode() { return language(this.language, "Direct Mode", "直连模式") }
    scriptMode() { return language(this.language, "Script Mode", "脚本模式") }
    pressEnterStop() { return language(this.language, "Press Enter to stop", "按 Enter 停止") }
    record() { return language(this.language, "Record", "点击以录制热键") }
    recording() { return language(this.language, "Recording...", "记录中...") }
    developer() { return language(this.language, "Original Developer", "原版作者") }
    developerEndVersion() { return language(this.language, "Until v0.20.39", "v0.20.39 之前") }
    optVersionDeveloper() { return language(this.language, "Optimize Version Developer", "优化版开发者") }
    relevance() { return language(this.language, "Relevance", "关于") }
    credits() { return language(this.language, "Credits", "鸣谢") }
    advertisementOriginal() { return language(this.language, "Original Advertisement", "原版广告") }
    imageIsOnWay() { return language(this.language, "Image is on the way", "图片正在加载") }
    updateIntervalMustBeInteger() { return language(this.language, "Update Interval must be an integer", "更新间隔必须是整数") }
    downloadProfile() { return language(this.language, "Download profile", "下载资料") }
    failedErrorHTTP() { return language(this.language, "failed with error: HTTP Response Status Code", "失败，错误：HTTP 响应状态代码") }
    serviceModeCtrlSysProxy() { return language(this.language, "Service Mode to control system proxy", "用于控制系统代理的服务模式") }
    makeSureYouHave() { return language(this.language, "Make sure you have ", "确定你 ") }
    unknowErr() { return language(this.language, "unknow error", "未知错误") }
    updateFailedNetErr() { return language(this.language, "update failed(Network Error)", "更新失败(网络错误)!") }
    couldNotSwitchProfile() { return language(this.language, "Could not switch to this profile!", "无法切换到此配置文件!") }
    downloadDbErrGeoIP() { return language(this.language, "Download GeoIP database failed with error", "下载 GeoIP 数据库失败并出现错误") }
    inputFieldAlternative() { return language(this.language, "Input fields are alternative", "输入字段是替代的") }
    updateDbGeoIP() { return language(this.language, "Update GeoIP database", "更新 GeoIP 数据库") }
    updatingDbNotAllowedCFW() { return language(this.language, "Updating GeoIP database is not allowed in CFW, please do it manually", "CFW 不允许更新 GeoIP 数据库，请手动进行") }
    imageFailedLoad() { return language(this.language, "The image failed to load, click to redirect to the website.", "图片加载失败，点击重定向至网站") }
    updating() { return language(this.language, "Updating", "更新中") }
    hide() { return language(this.language, "hide", "隐藏") }
    couldNotUpdateProvider() { return language(this.language, "could not update provider", "无法更新提供者") }
    dhcpServer() { return language(this.language, "DHCP Server", "DHCP 服务器") }
    localIpAddress() { return language(this.language, "Local IP Address", "本地 IP 地址") }
    cfg() { return language(this.language, "Configuration", "配置") }
    include() { return language(this.language, "Include", "包括") }
    updated() { return language(this.language, "updated", "已更新") }
    installed() { return language(this.language, "installed", "已安装") }
    now() { return language(this.language, "Now", "现在") }
    askRestartAPP() { return language(this.language, "Do you want to restart the APP?", "是否要重启 APP?") }
    restart() { return language(this.language, "Restart", "重新启动") }
    clashCoreFailedStartup() { return language(this.language, "clash core startup failed!!!", "clash 核心启动失败!!!") }
    restoreProxyGroup() { return language(this.language, "restore proxy group", "恢复代理组") }
    modeTAPEnableNoINthisYAML() { return language(this.language, "TAP mode enabled but no interface-name in this YAML", "\u542f\u7528 TAP \u6a21\u5f0f\u4f46\u6b64 YAML \u4e2d\u6ca1\u6709\u63a5\u53e3\u540d\u79f0") }
    tunModeEnableButIssue() { return language(this.language, "TUN mode enable but no interface-name in this YAML", "启用 TUN 模式但此 YAML 中没有接口名称") }
    couldNotEditProxyGroupType() { return language(this.language, "Could not edit proxy gorup type", "无法编辑代理组类型") }
    contentPAC() { return language(this.language, "PAC Content", "PAC 内容") }
    scriptInterval() { return language(this.language, "Script Interval", "脚本间隔") }
    automaticUpgrade() { return language(this.language, "Automatic Upgrade", "自动升级") }
    automaticUpgradeDescribe() { return language(this.language, "Set whether to update automatically, after turning on the new，\n            version will be updated in the background, the next launch will be\n            the latest version\n          ", "设置是否自动更新，\n            开启新版本后后台更新，\n            下次启动为最新版本\n          ") }
    automaticUpgradeCompleted() { return language(this.language, "Automatic Upgrade completed", "自动升级完成") }
    updateProvider() { return language(this.language, "Update provider", "更新提供者") }
    hideTrayIcon() { return language(this.language, "Hide Tray Icon", "隐藏托盘图标") }
    hideTrayIconDescribe() { return language(this.language, "Set whether to hide the taskbar icon or not", "设置是否隐藏任务栏图标") }
    proxyPolicy() { return language(this.language, "Proxy or Policy", "代理或策略") }
    content() { return language(this.language, "Content", "内容") }
    createNewRule() { return language(this.language, "Create a new rule", "创建新规则") }
    skipCertVerify() { return language(this.language, "Skip Cert Verify", "跳过证书验证") }
    customEditorCommand() { return language(this.language, "Custom Editor Command", "自定义编辑器命令") }
    editMixinContent() { return language(this.language, "Edit Mixin content", "编辑 Mixin 内容") }
    fakeIPCache() { return language(this.language, "Fake IP Cache", "Fake IP 缓存") }
    cache() { return language(this.language, "Cache", "缓存") }
    cannotEditReadOnlyEditor() { return language(this.language, "Cannot edit in read-only editor", "无法在只读编辑器中编辑(请在右边进行编辑)") }
    startWithLinux() { return language(this.language, "Start with Linux", "开机自启动") }
    startWithMacOS() { return language(this.language, "Start with macOS", "开机自启动") }
    geoIPDatabase() { return language(this.language, "GeoIP Database", "GeoIP 数据库更新") }
    preload() { return language(this.language, "Preload", "预载") }
    preloadDescribe() { return language(this.language, "Set the number of log lines to be preloaded in the Logs module,\n            set to 0 to not preload", "在 Logs 模块中设置要预加载的日志行数,\n            设置为 0 不预加载") }
    lines() { return language(this.language, "lines", "线程") }
    experimentalFeatures() { return language(this.language, "Experimental Features", "实验功能") }
    selectInterface() { return language(this.language, "Select a interface", "选择一个接口") }
    hadBeenReleased() { return language(this.language, " had been released", " 已发布") }
    pleaseConfirm() { return language(this.language, "Please confirm", "请确认") }
    cfgWillBeRemoved() { return language(this.language, "config.yaml and country.mmdb will be removed.", "config.yaml 和 country.mmdb 将被删除.") }
    router() { return language(this.language, "Router", "路由器") }
    editInTextMode() { return language(this.language, ["OK", "Edit in Text Mode"], ["好的", "在文本模式下编辑"]) }
    upgradeFailedWithErr() { return language(this.language, "upgrade app failed with error: ", "升级应用程序失败并出现错误: ") }
    dontSave() { return language(this.language, "Don't Save", "不保存") }
    failRestoreLastProfileErr() { return language(this.language, "fail to restore last profile with error: ", "无法恢复最后一个配置文件并出现错误: ") }
    askSetConfig() { return language(this.language, "Do you want to set a new uuidv4 secret in Home Directory/config.yaml and restart the APP?", "是否要在 Home Directory/config.yaml 中设置新的 uuidv4 secret 并重启 APP?") }
    recommendGenerateSecret() { return language(this.language, "secret is currently empty, we strongly recommend to generate one", "secret 当前为空，我们强烈建议生成一个") }
    generate() { return language(this.language, "Generate", "生成更新") }
    overallColorSettings() { return language(this.language, "Overall foreground color. This color is only used if not overridden by a component", "整体前景色。这个颜色只在没有被组件覆盖的情况下使用") }
    overallColorSettingsErr() { return language(this.language, "Overall foreground color for error messages. This color is only used if not overridden by a component", "错误信息的整体前景色。这个颜色只在没有被组件覆盖的情况下使用") }
    colorNeedValue() { return language(this.language, "Color needs a value", "颜色需要一个值") }
    invalidColorArgument() { return language(this.language, "Invalid color ctor argument", "无效颜色参数") }
    proxyName() { return language(this.language, "Proxy Name", "代理名称") }
    cannotEditProxyType() { return language(this.language, "Could not edit proxy type", "无法编辑代理类型") }
    trayProxyGroupsStyle() { return language(this.language, "Tray Proxy Groups Style", "托盘代理组样式") }
    trayProxyGroupsStyleDescribeFirst() { return language(this.language, "Set the proxy group style in the taskbar menu", "在任务栏菜单中设置代理组样式") }
    trayProxyGroupsStyleDescribeSecond() { return language(this.language, "Flat all proxy groups", "扁平化所有代理组") }
    trayProxyGroupsStyleDescribeThird() { return language(this.language, "Show proxy groups in submenu", "在折叠中显示代理组") }
    trayProxyGroupsStyleDescribeFourth() { return language(this.language, "Hide proxy groups", "隐藏代理组") }
    submenu() { return language(this.language, "Submenu", "折叠") }
    expand() { return language(this.language, "Expand", "展开") }
    hidden() { return language(this.language, "Hidden", "隐蔽") }
    showProcessIfPresent() { return language(this.language, "Show Process If Present", "显示进程（如果存在）") }
    showProcessIfPresentDescribe() { return language(this.language, "Set whether to show Process Name (if present) in Connections", "设置是否显示连接中的进程名称（如果存在）") }
    showTrayProxyDelayIndicator() { return language(this.language, "Show Tray Proxy Delay Indicator", "在托盘代理中显示节点可用性") }
    showTrayProxyDelayIndicatorDescribe() { return language(this.language, "Set whether the delay indicator is displayed in the proxy of the\n            taskbar menu", "设置是否在任务栏菜单的代理中\n            显示延迟指示器") }
    reloadAPP() { return language(this.language, "Reload APP", "重新加载 APP") }
    failTo() { return language(this.language, "Fail to ", "未能") }
    delayType() { return language(this.language, "Delay Type", "延迟类型") }
    delayTypeDescribeStart() { return language(this.language, "Delay of a latency test", "延迟测试的延迟") }
    delayTypeDescribeEnd() { return language(this.language, "Average delay of two latency tests", "两次延迟测试的平均延迟") }
    default() { return language(this.language, "Default", "默认") }
    meanDelay() { return language(this.language, "Mean Delay", "平均延迟") }
    fetch() { return language(this.language, "Fetch", "获取") }
    currentSSID() { return language(this.language, "Current SSID", "当前的 SSID") }
    currentSSIDDescribe() { return language(this.language, "Copy the SSID to the clipboard", "将 SSID 复制到剪贴板") }
    getCurrentSSID() { return language(this.language, "Get Current SSID", "获取当前的 SSID") }
    getCurrentSSIDDescribe() { return language(this.language, "Multiple SSIDs are joined by", "多个 SSID 的连接方式为") }
    strategy() { return language(this.language, "Strategy", "策略") }
    failedWithError() { return language(this.language, "failed with error: ", "失败，错误: ") }
    preserveCase() { return language(this.language, "Preserve Case", "保留大写") }
    previousMatch() { return language(this.language, "Previous Match", "上一个匹配") }
    nextMatch() { return language(this.language, "Next Match", "下一个匹配") }
    find() { return language(this.language, "Find", "查找") }
    findinSelection() { return language(this.language, "Find in Selection", "在选择中查找") }
    toggleReplace() { return language(this.language, "Toggle Replace", "切换到替换模式") }
    close() { return language(this.language, "Close", "关闭") }
    replace() { return language(this.language, "Replace", "替换") }
    replaceAll() { return language(this.language, "Replace All", "替换全部") }
    resultHighlighted() { return language(this.language, "Only the first {0} results are highlighted, but all find operations work on the entire text.", "仅突出显示前 {0} 个结果，但所有查找操作均作用于整个文本。") }
    numberOf() { return language(this.language, "{0} of {1}", "{0} / {1}") }
    noResults() { return language(this.language, "No results", "无结果") }
    useProxyServerWindows() { return language(this.language, "Use a proxy server in Windows", "在 Windows 中使用代理服务器") }
    enterProxyServerSettingsMac() { return language(this.language, "Enter proxy server settings on Mac", "在 Mac 上输入代理服务器设置") }
    followLink() { return language(this.language, "Follow link", "进入链接") }
    proxyName() { return language(this.language, " - Proxy Name", "") }
    proxy() { return language(this.language, "Proxy", "节点名") }
    groupName() { return language(this.language, " - Group name", "") }
    group() { return language(this.language, "Group", "分组名") }
    bothName() { return language(this.language, " - Proxy name and group name", " - 节点名和分组名") }
    both() { return language(this.language, "Both", "全部") }
    color() { return language(this.language, "colors:", "颜色:") }
    available() { return language(this.language, "available", "可用的") }
    unknown() { return language(this.language, "unknown", "未知") }
    alive() { return language(this.language, "Alive", "活动") }
    useModeIcons() { return language(this.language, "Use Mode Icons", "使用连接模式图标") }
    useModeIconsDescribe() { return language(this.language, "Use first letter of current mode as tray icon", "使用当前选择的模式作为托盘图标") }
    showActualFile() { return language(this.language, "Show actual file", "显示实际文件") }
    fontSize() { return language(this.language, "Font Size", "字体大小") }
    copyURLAndMD5() { return language(this.language, "Copy URL MD5", "复制 URL MD5") }
    executeCommand() { return language(this.language, "Execute command", "执行命令") }
    openWebPage() { return language(this.language, "Open web page", "打开配置网站") }
    cut() { return language(this.language, "Cut", "剪切") }
    paste() { return language(this.language, "Paste", "粘贴") }
    status() { return language(this.language, "Status", "状态") }
    flags() { return language(this.language, "Flags", "标签") }
    disclaimerStatement() { return language(this.language, "Disclaimer Statement", "免责声明") }
    disclaimerStatementDescribe() {
        return language(this.language,
            "1. This software is only intended for the purpose of learning and researching network technology. Users must comply with the laws and regulations in their respective regions and must not use it for illegal purposes. The software will not be held responsible for any actions of the user. \n\n2. Users must strictly abide by the laws, regulations, and policies of their own countries/regions when using this software. Any consequences or liabilities resulting from violations of relevant laws, regulations, and policies shall be borne by the user.\n\n3. The software is not responsible for the transmission of content. Therefore, if any problems or consequences arise from the use of this software, the user shall bear all responsibility.\n\n4. If the software violates any laws and regulations of the user's country/region, the user must immediately stop using it and bear the corresponding legal responsibility.\n\n5. While using this software, the user acknowledges and agrees that the software cannot guarantee network stability, accuracy, timeliness, and security. The software will not be held responsible for any connection problems or inability to connect caused by network congestion, firewall restrictions, DNS pollution, operator interference, and other reasons.\n\n6. The software does not provide technical support and is not responsible for any direct or indirect losses caused by the user's use of this software, including but not limited to property damage, data loss, and other forms of loss.\n\n7. The software has made every effort to ensure the stability and safety of the software, but will not be held responsible for any direct or indirect losses suffered by the user due to the use of this software.\n\n8. The software reserves the right to change the terms and conditions at any time. Once the terms and conditions change, an announcement will be posted on the software page. Users need to pay attention and abide by the latest version of the terms and conditions.\n\n9. The software may display advertisements from third-party entities. The software does not endorse, guarantee, or assume responsibility for the accuracy, relevancy, or quality of the information presented in these advertisements. Users acknowledge and agree that the software is not liable for any loss or damage arising from the display of advertisements or any transactions or interactions users may have with the advertisers. The user is solely responsible for any interactions with advertisers and is advised to exercise caution and conduct due diligence before engaging in any transactions or interactions with advertisers.\n    ",
            "1. 本软件仅供学习和研究网络技术之用，用户必须遵守所在地区的法律法规，不得用于非法用途，本软件不对任何人的行为负责。 \n\n2. 用户在使用本软件时必须严格遵守所在国家/地区的法律、法规和政策。 因违反有关法律、法规和政策而导致的任何后果或责任由用户自行承担。\n\n3. 本软件不负责传输内容。 因此，如因使用本软件而产生任何问题或后果，由用户自行承担全部责任。\n\n4. 如本软件违反用户所在国家/地区的任何法律法规，用户必须立即停止使用并承担相应的法律责任。\n\n5. 用户在使用本软件时，即承认并同意本软件不能保证网络的稳定性、准确性、及时性和安全性。 因网络拥塞、防火墙限制、DNS污染、运营商干扰等原因造成的连接问题或无法连接，本软件不承担任何责任。\n\n6. 本软件不提供技术支持，对因用户使用本软件而造成的任何直接或间接损失，包括但不限于财产损失、数据丢失及其他形式的损失不承担任何责任。\n\n7. 本软件已尽力确保软件的稳定性和安全性，但对用户因使用本软件而遭受的任何直接或间接损失不承担任何责任。\n\n8. 软件保留随时更改条款和条件的权利。 一旦条款和条件发生变化，将在软件页面上发布公告。 用户需关注并遵守最新版本的条款和条件。\n\n9. 本软件可能会显示来自第三方实体的广告。本软件不认可、保证或承担这些广告中所呈现信息的准确性、相关性或质量的责任。用户确认并同意，本软件对因显示广告或用户与广告商进行的任何交易或互动而产生的任何损失或损害概不负责。用户应对与广告商的任何互动承担全部责任，并建议用户在与广告商进行任何交易或互动之前谨慎行事并进行尽职调查。\n    "
        )
    }
    matchCase() { return language(this.language, "Match Case", "匹配大小写") }
    matchWholeWord() { return language(this.language, "Match Whole Word", "匹配全词") }
    useRegularExpression() { return language(this.language, "Use Regular Expression", "使用正则表达式") }
    failWithError() { return language(this.language, "Fail, error: ", "失败, 错误: ") }
    resetDNSSettings() { return language(this.language, "Reset DNS Settings", "重置 DNS 设置") }
    enable() { return language(this.language, "Enable", "启用") }
    enabled() { return language(this.language, "Enabled", "已启用") }
    customServers() { return language(this.language, "Custom Servers", "自定义服务器") }
    forHistory() { return language(this.language, "for history", "查看历史记录") }
    textWillDescribe() { return language(this.language, "Text will be prefixed with ⇅ plus a single space, then used as a hint where input field keeps history", "文本将以 ⇅ 加上一个空格作为前缀，然后用作输入字段保留历史记录的提示") }
    timeoutInTimeDiff() { return language(this.language, "Timeout in milliseconds after which diff computation is cancelled. Use 0 for no timeout.", "以毫秒为单位的超时，之后差异计算被取消。 使用 0 表示没有超时") }
    fileSizeInMBForDiff() { return language(this.language, "Maximum file size in MB for which to compute diffs. Use 0 for no limit.", "计算差异的最大文件大小（以 MB 为单位）。 使用 0 表示没有限制") }
    ssidStrategy() { return language(this.language, "SSID Strategy", "SSID策略") }
    strategyDescribe() { return language(this.language, "\n              Set the strategy for SSID matching, the first matched strategy\n              will be used,\n              ", "\n              设置SSID匹配策略，第一个匹配的策略\n              将被使用,\n              ") }
    useCFWEditor() { return language(this.language, "Use CFW Editor", "使用 CFW 编辑器") }
    other() { return language(this.language, "Other", "其它") }
    show() { return language(this.language, "show", "显示") }
    disableLoadingAdsLink() { return language(this.language, "Disable Loading Ads Link", "禁用加载广告链接") }
    proxyCore() { return language(this.language, "Proxy Core", "\u4ee3\u7406\u6838\u5fc3") }
    proxyCoreDescribe() { return language(this.language, "Choose the compatible legacy Clash core or Mihomo for modern protocols such as AnyTLS. Changing the core restarts the proxy service.", "\u9009\u62e9\u517c\u5bb9\u65e7\u914d\u7f6e\u7684 Clash \u6838\u5fc3\uff0c\u6216\u9009\u62e9\u652f\u6301 AnyTLS \u7b49\u73b0\u4ee3\u534f\u8bae\u7684 Mihomo\u3002\u5207\u6362\u6838\u5fc3\u4f1a\u91cd\u542f\u4ee3\u7406\u670d\u52a1\u3002") }
    legacyClashCore() { return language(this.language, "Clash (Legacy)", "Clash\uff08\u65e7\u7248\uff09") }
    mihomoCore() { return "Mihomo" }
}

module.exports = { language, Language };
