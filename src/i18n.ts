export type Locale = "zh" | "en";

type TranslationKey =
  | "appEyebrow"
  | "appTitle"
  | "currentState"
  | "waitingForData"
  | "noCurrentApp"
  | "quickStart"
  | "monitoringActive"
  | "monitoringActiveHelp"
  | "readyToFocus"
  | "readyToFocusHelp"
  | "sessionRunningTitle"
  | "sessionRunningHelp"
  | "sessionPausedTitle"
  | "sessionPausedHelp"
  | "currentSession"
  | "sessionStatusIdle"
  | "sessionStatusRunning"
  | "sessionStatusPaused"
  | "sessionStatusFinished"
  | "startSession"
  | "pauseSession"
  | "resumeSession"
  | "endSession"
  | "sessionStarted"
  | "sessionPaused"
  | "sessionPausedMonitoringLost"
  | "sessionResumed"
  | "sessionEnded"
  | "sessionPreparing"
  | "sessionPreparingShort"
  | "setupTitle"
  | "setupBody"
  | "setupAwTitle"
  | "setupAwBody"
  | "setupClassifyTitle"
  | "setupClassifyBody"
  | "recommended"
  | "optional"
  | "reasonFocusedApp"
  | "reasonInputIdle"
  | "reasonInputUnavailable"
  | "reasonDistractedApp"
  | "signalApp"
  | "signalInput"
  | "connected"
  | "disconnected"
  | "settingsMenu"
  | "settingsPanelTitle"
  | "settingsPanelHelp"
  | "closeSettings"
  | "language"
  | "languageHelp"
  | "toolsTitle"
  | "toolsHelp"
  | "monitoringToolsTitle"
  | "monitoringToolsHelp"
  | "reconnectAw"
  | "introTitle"
  | "introBody"
  | "introFeatureInput"
  | "introFeatureActivity"
  | "introFeatureReports"
  | "introPrivacy"
  | "introObservedTime"
  | "criteriaTitle"
  | "criteriaSummary"
  | "criteriaBody"
  | "inputIdleThresholdLabel"
  | "inputIdleThresholdHelp"
  | "nudgeSettingsTitle"
  | "nudgesEnabled"
  | "nudgeDelayLabel"
  | "workdayStartLabel"
  | "workdayEndLabel"
  | "nudgeSettingsHelp"
  | "nudgePermissionEnabled"
  | "nudgePermissionUnavailable"
  | "focusNudgeTitle"
  | "focusNudgeBody"
  | "backToFocus"
  | "allowCurrentApp"
  | "nudgeDurationLabel"
  | "allowedApps"
  | "distractingApps"
  | "allowedWindowTitles"
  | "distractingWindowTitles"
  | "allowedWindowTitlesHelp"
  | "distractingWindowTitlesHelp"
  | "allowedWindowTitlesPlaceholder"
  | "distractingWindowTitlesPlaceholder"
  | "matchedAllowedWindow"
  | "matchedDistractingWindow"
  | "rulesHelp"
  | "saveRules"
  | "rulesSaved"
  | "rulesReloadRequired"
  | "awAppsTitle"
  | "awAppsSummary"
  | "awAppsHelp"
  | "refreshAwApps"
  | "awAppsEmpty"
  | "searchApps"
  | "filterApps"
  | "appFilterAll"
  | "appFilterFocus"
  | "appFilterDistract"
  | "showingApps"
  | "appModeFocus"
  | "appModeDistract"
  | "appRuleUpdated"
  | "awWindowsTitle"
  | "awWindowsSummary"
  | "awWindowsHelp"
  | "refreshAwWindows"
  | "awWindowsEmpty"
  | "searchWindows"
  | "filterWindows"
  | "showingWindows"
  | "windowRuleUpdated"
  | "loadAw"
  | "openAw"
  | "openPermissions"
  | "exportDaily"
  | "exportWeekly"
  | "exportDailyShort"
  | "exportWeeklyShort"
  | "today"
  | "focusRatio"
  | "focused"
  | "longestRun"
  | "distracted"
  | "distractedHelp"
  | "inputActivity"
  | "inputMonitoring"
  | "inputIdle"
  | "inputUnavailable"
  | "inputUnavailableHelp"
  | "inputScopeSystem"
  | "inputScopeWindow"
  | "active"
  | "todaySessionTotal"
  | "todaySessionTotalHelp"
  | "emptyTitle"
  | "emptyBody"
  | "dailyTimeline"
  | "dailyBreakdown"
  | "weeklyTrend"
  | "noValidRecords"
  | "minutesShort"
  | "introSummary"
  | "dataTitle"
  | "dataSummary"
  | "dataBody"
  | "backupPrivacy"
  | "exportSettings"
  | "importSettings"
  | "restoreDefaults"
  | "restoreDefaultsConfirmTitle"
  | "restoreDefaultsConfirmBody"
  | "confirmRestore"
  | "clearLocalData"
  | "settingsExported"
  | "settingsImported"
  | "settingsImportFailed"
  | "defaultsRestored"
  | "clearLocalConfirmTitle"
  | "clearLocalConfirmBody"
  | "confirmClear"
  | "cancel"
  | "localDataCleared"
  | "ready"
  | "autoStartAw"
  | "awBrowserMode"
  | "connectingAw"
  | "loadedAw"
  | "loadedAwActivity"
  | "openedAw"
  | "awFailed"
  | "permissionsOpened"
  | "loadingAw"
  | "refreshingAwApps"
  | "retry"
  | "dismiss"
  | "chartLoading"
  | "savedReport"
  | "downloadedReport"
  | "noDailyData"
  | "noWeeklyData";

const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  zh: {
    appEyebrow: "本地优先专注监视",
    appTitle: "专注伴侣",
    currentState: "当前状态",
    waitingForData: "等待数据",
    noCurrentApp: "暂无前台应用",
    quickStart: "快速开始",
    monitoringActive: "专注监测正在运行",
    monitoringActiveHelp: "键盘、鼠标和触控板输入状态只在本机读取，并按分钟写入时间线。",
    readyToFocus: "准备开始一次专注",
    readyToFocusHelp: "点击开始后会自动连接 ActivityWatch，并使用本机输入状态辅助判断专注。",
    sessionRunningTitle: "专注会话进行中",
    sessionRunningHelp: "当前时段正在计入日报，分心提醒也只会在会话进行时触发。",
    sessionPausedTitle: "专注会话已暂停",
    sessionPausedHelp: "暂停期间不会继续扩大日报统计范围，恢复后从当前时间继续。",
    currentSession: "本次会话",
    sessionStatusIdle: "尚未开始",
    sessionStatusRunning: "正在计时",
    sessionStatusPaused: "已暂停",
    sessionStatusFinished: "已结束",
    startSession: "开始专注会话",
    pauseSession: "暂停会话",
    resumeSession: "继续会话",
    endSession: "结束会话",
    sessionStarted: "专注会话已开始。",
    sessionPaused: "专注会话已暂停，暂停时间不会计入统计。",
    sessionPausedMonitoringLost: "监测连接已中断，会话已自动暂停。恢复连接后可继续。",
    sessionResumed: "专注会话已继续。",
    sessionEnded: "专注会话已结束。",
    sessionPreparing: "正在连接 ActivityWatch 并准备输入监测...",
    sessionPreparingShort: "正在准备监测...",
    setupTitle: "开始一次专注会话",
    setupBody: "点击上方“开始专注会话”，应用会自动准备 ActivityWatch 和输入监测，成功后再开始计时。",
    setupAwTitle: "连接 ActivityWatch",
    setupAwBody: "读取今天的前台软件和窗口记录，建立专注时间线。",
    setupClassifyTitle: "分类常用软件",
    setupClassifyBody: "把学习和工作软件设为允许，把容易分心的软件单独标记。",
    recommended: "推荐",
    optional: "可选",
    reasonFocusedApp: "当前有输入活动，且窗口或软件未命中分心规则。",
    reasonInputIdle: "键盘、鼠标和触控板已连续 60 秒无输入。",
    reasonInputUnavailable: "暂时无法读取系统输入状态，不会因此判定为分心。",
    reasonDistractedApp: "当前窗口或软件未被允许，或命中了分心规则。",
    signalApp: "软件",
    signalInput: "输入",
    connected: "ActivityWatch 已连接",
    disconnected: "未连接 / 无数据",
    settingsMenu: "设置",
    settingsPanelTitle: "设置与工具",
    settingsPanelHelp: "低频选项集中在这里，首页只保留实时监视和会话控制。",
    closeSettings: "关闭",
    language: "语言",
    languageHelp: "切换界面显示语言",
    toolsTitle: "报告导出",
    toolsHelp: "导出本机汇总生成的日报或周报。",
    monitoringToolsTitle: "监测连接",
    monitoringToolsHelp: "会话开始时会自动准备 ActivityWatch；系统输入状态在本机持续监测。",
    reconnectAw: "重新连接 ActivityWatch",
    introTitle: "功能说明",
    introBody:
      "它会把键盘、鼠标和触控板输入状态与 ActivityWatch 的前台应用、窗口标题合并，自动生成日/周复盘图表。",
    introFeatureInput: "只读取距最近系统输入的时间，不记录按键内容、指针坐标或手势轨迹。",
    introFeatureActivity: "前台进程和窗口标题来自本机 ActivityWatch，用于判断当前任务是否属于专注或分心。",
    introFeatureReports: "图表包括日内时间线、状态占比和周趋势，可以导出为 Markdown 报告。",
    introPrivacy: "语言、设置和最近一次聚合结果保存在本机 localStorage；原始活动数据保存在本机 ActivityWatch。",
    introObservedTime: "统计总量只覆盖专注伴侣运行期间或已有活动事件的时间；没有输入或缺少观测的分钟会并入分心。",
    criteriaTitle: "专注/分心如何判断",
    criteriaSummary: "输入空闲时间、提醒与手动规则",
    criteriaBody:
      "键盘、鼠标和触控板连续超过设定时间无输入时记为分心；分心窗口或软件会立即记为分心；其余有观测的状态合并计入专注。",
    inputIdleThresholdLabel: "无输入多久算分心",
    inputIdleThresholdHelp: "可在 30 秒到 30 分钟之间调整；修改后会立即重新计算今日数据。",
    nudgeSettingsTitle: "低打扰分心提醒",
    nudgesEnabled: "连续分心时提醒我",
    nudgeDelayLabel: "提醒前等待",
    workdayStartLabel: "提醒开始时间",
    workdayEndLabel: "提醒结束时间",
    nudgeSettingsHelp: "只在设定时段内提醒；同一段持续分心最多每 5 分钟提醒一次。桌面版会发送系统通知，应用内也会保留提示。",
    nudgePermissionEnabled: "分心提醒已开启。",
    nudgePermissionUnavailable: "无法取得系统通知权限，仍会使用应用内提醒。",
    focusNudgeTitle: "该回到任务了",
    focusNudgeBody: "检测到持续分心。停一下，确认你现在做的事是否仍然重要。",
    backToFocus: "我回来了",
    allowCurrentApp: "将当前软件设为允许",
    nudgeDurationLabel: "连续分心",
    allowedApps: "允许软件",
    distractingApps: "分心软件",
    allowedWindowTitles: "允许窗口",
    distractingWindowTitles: "不允许 / 分心窗口",
    allowedWindowTitlesHelp: "匹配窗口标题，可覆盖软件级分类。",
    distractingWindowTitlesHelp: "匹配窗口标题，优先级最高。",
    allowedWindowTitlesPlaceholder: "在线课程\n作业文档\nMDN Web Docs",
    distractingWindowTitlesPlaceholder: "YouTube\n短视频\n社交动态",
    matchedAllowedWindow: "允许窗口",
    matchedDistractingWindow: "分心窗口",
    rulesHelp: "每行一个关键词，按包含关系匹配。窗口规则优先于软件规则，因此同一个 Safari 可以按页面标题分别判为专注或分心；若允许窗口和分心窗口同时命中，分心窗口优先。",
    saveRules: "保存规则",
    rulesSaved: "规则已保存到本机。",
    rulesReloadRequired: "设置已保存；当前聚合结果缺少原始输入，请重新读取 ActivityWatch 后查看新规则的影响。",
    awAppsTitle: "ActivityWatch 软件列表",
    awAppsSummary: "搜索并分类今日使用过的软件",
    awAppsHelp: "读取今日前台应用后，直接选择它属于允许还是分心。未标记为分心的应用合并计入专注。",
    refreshAwApps: "刷新 AW 软件",
    awAppsEmpty: "尚未读取到应用。请先确认 ActivityWatch 正在运行，然后点击刷新。",
    searchApps: "搜索软件",
    filterApps: "筛选软件",
    appFilterAll: "全部",
    appFilterFocus: "允许",
    appFilterDistract: "分心",
    showingApps: "显示",
    appModeFocus: "允许",
    appModeDistract: "分心",
    appRuleUpdated: "软件分类已更新并重新计算。",
    awWindowsTitle: "ActivityWatch 窗口列表",
    awWindowsSummary: "独立查看并分类今日出现过的窗口",
    awWindowsHelp: "窗口标题与软件列表分开显示。窗口规则优先于软件规则，可用于区分同一浏览器中的工作页面和分心页面。",
    refreshAwWindows: "刷新 AW 窗口",
    awWindowsEmpty: "尚未读取到窗口。请确认 ActivityWatch 的 aw-watcher-window 正在运行，然后点击刷新。",
    searchWindows: "搜索窗口标题或所属软件",
    filterWindows: "筛选窗口",
    showingWindows: "显示窗口",
    windowRuleUpdated: "窗口分类已更新并重新计算。",
    loadAw: "读取 ActivityWatch",
    openAw: "打开 AW 窗口",
    openPermissions: "打开辅助功能权限",
    exportDaily: "导出日报 Markdown",
    exportWeekly: "导出周报 Markdown",
    exportDailyShort: "导出日报",
    exportWeeklyShort: "导出周报",
    today: "今天",
    focusRatio: "专注占比",
    focused: "专注",
    longestRun: "最长连续专注",
    distracted: "分心",
    distractedHelp: "包含无输入和缺少观测的时间",
    inputActivity: "输入状态",
    inputMonitoring: "输入监测",
    inputIdle: "无输入",
    inputUnavailable: "不可用",
    inputUnavailableHelp: "未读取到系统输入状态",
    inputScopeSystem: "系统级输入",
    inputScopeWindow: "仅当前页面输入",
    active: "活跃",
    todaySessionTotal: "今日专注会话",
    todaySessionTotalHelp: "今日所有会话累计时长",
    emptyTitle: "暂无数据",
    emptyBody: "首次进入不会加载演示数据。点击“读取 ActivityWatch”会尝试启动并连接 AW。",
    dailyTimeline: "最近三小时专注时间线",
    dailyBreakdown: "每日状态占比",
    weeklyTrend: "每周趋势",
    noValidRecords: "暂无有效记录",
    minutesShort: "分钟",
    introSummary: "隐私、数据来源与使用说明",
    dataTitle: "数据与备份",
    dataSummary: "备份设置、恢复偏好和清理本地缓存",
    dataBody: "设置备份适合迁移到另一台电脑，也可在调整规则前留一份副本。",
    backupPrivacy: "备份包含语言、提醒和软件/窗口规则；不包含实际窗口标题、输入明细、ActivityWatch 原始记录或报告。",
    exportSettings: "导出设置备份",
    importSettings: "导入设置备份",
    restoreDefaults: "恢复默认设置",
    restoreDefaultsConfirmTitle: "确认恢复默认设置？",
    restoreDefaultsConfirmBody: "自定义提醒时段和软件分类会被替换。ActivityWatch 原始记录不会删除。",
    confirmRestore: "确认恢复",
    clearLocalData: "清理本地聚合数据",
    settingsExported: "设置备份已下载。",
    settingsImported: "设置备份已导入并应用。",
    settingsImportFailed: "无法导入设置备份。",
    defaultsRestored: "已恢复默认设置。",
    clearLocalConfirmTitle: "确认清理本地聚合数据？",
    clearLocalConfirmBody: "将清除今日/每周聚合缓存、软件列表和今日专注会话计时。不会删除 ActivityWatch 原始记录，也不会删除已导出的报告。",
    confirmClear: "确认清理",
    cancel: "取消",
    localDataCleared: "本地聚合数据已清理；ActivityWatch 原始记录未受影响。",
    ready: "就绪。当前没有数据。",
    autoStartAw: "正在尝试自动启动 ActivityWatch...",
    awBrowserMode: "当前是浏览器开发模式，无法直接启动本机 ActivityWatch；桌面版会自动尝试打开。",
    connectingAw: "正在连接 ActivityWatch...",
    loadedAw: "已读取并保存本地聚合数据。",
    loadedAwActivity: "已刷新 ActivityWatch 软件和窗口列表。",
    openedAw: "已打开 ActivityWatch 窗口。",
    awFailed: "ActivityWatch 连接失败。",
    permissionsOpened: "已打开系统权限设置。若窗口标题缺失，请检查 ActivityWatch 的辅助功能权限。",
    loadingAw: "正在读取...",
    refreshingAwApps: "正在刷新...",
    retry: "重试",
    dismiss: "关闭",
    chartLoading: "正在加载图表...",
    savedReport: "报告已保存到",
    downloadedReport: "已下载 Markdown 报告。",
    noDailyData: "没有日报数据可导出。",
    noWeeklyData: "没有周报数据可导出。",
  },
  en: {
    appEyebrow: "Local-first focus monitor",
    appTitle: "Focus Companion",
    currentState: "Current state",
    waitingForData: "Waiting for data",
    noCurrentApp: "No foreground app",
    quickStart: "Quick start",
    monitoringActive: "Focus monitoring is active",
    monitoringActiveHelp: "Keyboard, mouse, and trackpad activity stays local and updates the timeline by minute.",
    readyToFocus: "Ready for a focus session",
    readyToFocusHelp: "Starting a session connects ActivityWatch and uses local input activity to support focus classification.",
    sessionRunningTitle: "Focus session in progress",
    sessionRunningHelp: "This period is included in reports. Distraction nudges only run during an active session.",
    sessionPausedTitle: "Focus session paused",
    sessionPausedHelp: "Paused time does not expand the report window. Resume when you are ready.",
    currentSession: "Current session",
    sessionStatusIdle: "Not started",
    sessionStatusRunning: "Timing",
    sessionStatusPaused: "Paused",
    sessionStatusFinished: "Finished",
    startSession: "Start focus session",
    pauseSession: "Pause session",
    resumeSession: "Resume session",
    endSession: "End session",
    sessionStarted: "Focus session started.",
    sessionPaused: "Focus session paused. Paused time will not be counted.",
    sessionPausedMonitoringLost: "Monitoring was interrupted, so the session paused automatically. Reconnect before resuming.",
    sessionResumed: "Focus session resumed.",
    sessionEnded: "Focus session ended.",
    sessionPreparing: "Connecting ActivityWatch and preparing input monitoring...",
    sessionPreparingShort: "Preparing monitoring...",
    setupTitle: "Start a focus session",
    setupBody: "Use Start focus session above. The app prepares ActivityWatch and input monitoring before timing begins.",
    setupAwTitle: "Connect ActivityWatch",
    setupAwBody: "Load today's foreground apps and windows to build the focus timeline.",
    setupClassifyTitle: "Classify frequent apps",
    setupClassifyBody: "Allow work and study apps, and mark software that tends to distract you.",
    recommended: "Recommended",
    optional: "Optional",
    reasonFocusedApp: "Input is active and the current window or app did not match a distracting rule.",
    reasonInputIdle: "No keyboard, mouse, or trackpad input has occurred for 60 seconds.",
    reasonInputUnavailable: "System input activity is unavailable and will not be treated as distraction.",
    reasonDistractedApp: "The current window or app is not allowed, or it matched a distracting rule.",
    signalApp: "App",
    signalInput: "Input",
    connected: "ActivityWatch connected",
    disconnected: "Disconnected / no data",
    settingsMenu: "Settings",
    settingsPanelTitle: "Settings and tools",
    settingsPanelHelp: "Less frequent controls live here so the dashboard stays focused on live monitoring.",
    closeSettings: "Close",
    language: "Language",
    languageHelp: "Change the interface language",
    toolsTitle: "Report exports",
    toolsHelp: "Export daily or weekly reports generated from local summaries.",
    monitoringToolsTitle: "Monitoring connections",
    monitoringToolsHelp: "Sessions prepare ActivityWatch automatically. System input activity is monitored locally.",
    reconnectAw: "Reconnect ActivityWatch",
    introTitle: "What it does",
    introBody:
      "It combines keyboard, mouse, and trackpad activity with ActivityWatch foreground app and window-title data to generate daily and weekly charts.",
    introFeatureInput: "Only time since the latest system input is read. Key contents, pointer coordinates, and gesture paths are never recorded.",
    introFeatureActivity: "Foreground app and window titles come from local ActivityWatch data to classify focus or distraction.",
    introFeatureReports: "Charts include a daily timeline, state breakdown, and weekly trend, exportable as Markdown reports.",
    introPrivacy: "Language, settings, and the latest aggregate are stored in localStorage; raw activity remains in local ActivityWatch.",
    introObservedTime: "Totals only cover time while Focus Companion is running, or time with existing activity events. Minutes with no input or missing observations are merged into distracted time.",
    criteriaTitle: "How focus/distraction is decided",
    criteriaSummary: "Input idle time, nudges, and manual rules",
    criteriaBody:
      "Keyboard, mouse, or trackpad idle time past your chosen threshold is distracted. Distracting apps or windows are distracted immediately. Other observed time is focused.",
    inputIdleThresholdLabel: "Input idle threshold",
    inputIdleThresholdHelp: "Adjust between 30 seconds and 30 minutes. Today's data recalculates immediately.",
    nudgeSettingsTitle: "Low-interruption nudges",
    nudgesEnabled: "Remind me after continuous distraction",
    nudgeDelayLabel: "Wait before reminding",
    workdayStartLabel: "Reminder start",
    workdayEndLabel: "Reminder end",
    nudgeSettingsHelp: "Nudges only appear during this window and repeat at most once every five minutes during continuous distraction. Desktop builds also send a system notification.",
    nudgePermissionEnabled: "Distraction nudges enabled.",
    nudgePermissionUnavailable: "System notification permission is unavailable; in-app nudges will still work.",
    focusNudgeTitle: "Time to return to your task",
    focusNudgeBody: "Continuous distraction was detected. Pause and check whether what you are doing still matters.",
    backToFocus: "I'm back",
    allowCurrentApp: "Allow current app",
    nudgeDurationLabel: "Distracted for",
    allowedApps: "Allowed apps",
    distractingApps: "Distracting apps",
    allowedWindowTitles: "Allowed windows",
    distractingWindowTitles: "Distracting / blocked windows",
    allowedWindowTitlesHelp: "Matches window titles and can override app classification.",
    distractingWindowTitlesHelp: "Matches window titles with the highest priority.",
    allowedWindowTitlesPlaceholder: "Online course\nAssignment document\nMDN Web Docs",
    distractingWindowTitlesPlaceholder: "YouTube\nShort videos\nSocial feed",
    matchedAllowedWindow: "Allowed window",
    matchedDistractingWindow: "Distracting window",
    rulesHelp: "Enter one substring per line. Window rules override app rules, so different Safari pages can be focused or distracting. If an allowed and distracting window rule both match, the distracting rule wins.",
    saveRules: "Save rules",
    rulesSaved: "Rules saved locally.",
    rulesReloadRequired: "Settings saved. The cached summary has no raw inputs; load ActivityWatch again to see the new rules applied.",
    awAppsTitle: "ActivityWatch app list",
    awAppsSummary: "Search and classify apps used today",
    awAppsHelp: "Load today's foreground apps, then classify each as allowed or distracting. Apps not marked as distracting are merged into focused time.",
    refreshAwApps: "Refresh AW apps",
    awAppsEmpty: "No apps loaded yet. Make sure ActivityWatch is running, then refresh.",
    searchApps: "Search apps",
    filterApps: "Filter apps",
    appFilterAll: "All",
    appFilterFocus: "Allowed",
    appFilterDistract: "Distracting",
    showingApps: "Showing",
    appModeFocus: "Allowed",
    appModeDistract: "Distracting",
    appRuleUpdated: "App classification updated and recalculated.",
    awWindowsTitle: "ActivityWatch window list",
    awWindowsSummary: "Review and classify today's windows separately",
    awWindowsHelp: "Window titles are separate from the app list. Window rules override app rules, so pages in the same browser can be classified differently.",
    refreshAwWindows: "Refresh AW windows",
    awWindowsEmpty: "No windows loaded yet. Make sure ActivityWatch's aw-watcher-window is running, then refresh.",
    searchWindows: "Search window titles or apps",
    filterWindows: "Filter windows",
    showingWindows: "Showing windows",
    windowRuleUpdated: "Window classification updated and recalculated.",
    loadAw: "Load ActivityWatch",
    openAw: "Open AW window",
    openPermissions: "Open accessibility permissions",
    exportDaily: "Export daily Markdown",
    exportWeekly: "Export weekly Markdown",
    exportDailyShort: "Export daily",
    exportWeeklyShort: "Export weekly",
    today: "Today",
    focusRatio: "focus ratio",
    focused: "Focused",
    longestRun: "Longest run",
    distracted: "Distracted",
    distractedHelp: "Includes no-input and missing-observation time",
    inputActivity: "Input activity",
    inputMonitoring: "Input monitoring",
    inputIdle: "No input",
    inputUnavailable: "Unavailable",
    inputUnavailableHelp: "System input activity could not be read",
    inputScopeSystem: "System-wide input",
    inputScopeWindow: "Current-page input only",
    active: "Active",
    todaySessionTotal: "Today's focus sessions",
    todaySessionTotalHelp: "Total time across today's sessions",
    emptyTitle: "No data yet",
    emptyBody: "The app starts without demo data. Click Load ActivityWatch to start and connect AW.",
    dailyTimeline: "Last three hours",
    dailyBreakdown: "Daily state breakdown",
    weeklyTrend: "Weekly trend",
    noValidRecords: "No valid records yet",
    minutesShort: "min",
    introSummary: "Privacy, data sources, and usage notes",
    dataTitle: "Data and backup",
    dataSummary: "Back up settings, restore preferences, and clear local cache",
    dataBody: "A settings backup can move your preferences to another computer or preserve them before rule changes.",
    backupPrivacy: "Backups contain language, nudges, and app/window rules. Actual window titles, input details, raw ActivityWatch records, and reports are excluded.",
    exportSettings: "Export settings backup",
    importSettings: "Import settings backup",
    restoreDefaults: "Restore defaults",
    restoreDefaultsConfirmTitle: "Restore default settings?",
    restoreDefaultsConfirmBody: "Custom reminder hours and app classifications will be replaced. Raw ActivityWatch records will not be deleted.",
    confirmRestore: "Restore now",
    clearLocalData: "Clear local aggregates",
    settingsExported: "Settings backup downloaded.",
    settingsImported: "Settings backup imported and applied.",
    settingsImportFailed: "Could not import the settings backup.",
    defaultsRestored: "Default settings restored.",
    clearLocalConfirmTitle: "Clear local aggregate data?",
    clearLocalConfirmBody: "This clears daily/weekly cache, the app list, and today's focus-session timing. Raw ActivityWatch records and exported reports are not deleted.",
    confirmClear: "Clear now",
    cancel: "Cancel",
    localDataCleared: "Local aggregate data cleared. Raw ActivityWatch records were not affected.",
    ready: "Ready. No data loaded.",
    autoStartAw: "Trying to start ActivityWatch automatically...",
    awBrowserMode: "Browser development mode cannot start the local ActivityWatch app; the desktop build will try automatically.",
    connectingAw: "Connecting to ActivityWatch...",
    loadedAw: "Loaded and saved local aggregate data.",
    loadedAwActivity: "ActivityWatch app and window lists refreshed.",
    openedAw: "Opened ActivityWatch window.",
    awFailed: "ActivityWatch connection failed.",
    permissionsOpened: "Opened system permission settings. If window titles are missing, check ActivityWatch accessibility access.",
    loadingAw: "Loading...",
    refreshingAwApps: "Refreshing...",
    retry: "Retry",
    dismiss: "Dismiss",
    chartLoading: "Loading chart...",
    savedReport: "Saved report to",
    downloadedReport: "Downloaded Markdown report.",
    noDailyData: "No daily data to export.",
    noWeeklyData: "No weekly data to export.",
  },
};

export function t(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key];
}
