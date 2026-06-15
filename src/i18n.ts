export type Locale = "zh" | "en";

type TranslationKey =
  | "appEyebrow"
  | "appTitle"
  | "currentState"
  | "simulationMode"
  | "waitingForData"
  | "noCurrentApp"
  | "noCameraSample"
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
  | "setupCameraTitle"
  | "setupCameraBody"
  | "setupClassifyTitle"
  | "setupClassifyBody"
  | "recommended"
  | "optional"
  | "reasonFocusedApp"
  | "reasonFocusedCamera"
  | "reasonDistractedAttention"
  | "reasonDistractedApp"
  | "reasonAway"
  | "reasonWaiting"
  | "reasonDetectingFace"
  | "signalApp"
  | "signalCamera"
  | "signalThreshold"
  | "signalNoFace"
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
  | "introFeatureCamera"
  | "introFeatureActivity"
  | "introFeatureReports"
  | "introPrivacy"
  | "introObservedTime"
  | "criteriaTitle"
  | "criteriaSummary"
  | "criteriaBody"
  | "thresholdLabel"
  | "awayDelayLabel"
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
  | "appFilterNeutral"
  | "appFilterDistract"
  | "showingApps"
  | "appModeFocus"
  | "appModeNeutral"
  | "appModeDistract"
  | "appRuleUpdated"
  | "loadAw"
  | "openAw"
  | "openPermissions"
  | "startCamera"
  | "stopCamera"
  | "startSimulation"
  | "stopSimulation"
  | "exportDaily"
  | "exportWeekly"
  | "exportDailyShort"
  | "exportWeeklyShort"
  | "today"
  | "focusRatio"
  | "focused"
  | "longestRun"
  | "distracted"
  | "away"
  | "camera"
  | "attentionNow"
  | "todaySessionTotal"
  | "todaySessionTotalHelp"
  | "idle"
  | "cameraRunning"
  | "detecting"
  | "facePresent"
  | "noLiveMetric"
  | "emptyTitle"
  | "emptyBody"
  | "dailyTimeline"
  | "timelineFollowing"
  | "timelinePaused"
  | "timelineResume"
  | "dailyBreakdown"
  | "weeklyTrend"
  | "noValidRecords"
  | "minutesShort"
  | "cameraPreview"
  | "cameraDiagnostics"
  | "faceDetection"
  | "detected"
  | "notDetected"
  | "confidence"
  | "gazeStatus"
  | "lookingAway"
  | "lookingForward"
  | "cameraPrivacy"
  | "calibrationTitle"
  | "calibrationBody"
  | "calibrationReady"
  | "calibrationNotSet"
  | "calibrated"
  | "notCalibrated"
  | "startCalibration"
  | "startCameraFirst"
  | "recalibrate"
  | "resetCalibration"
  | "cancelCalibration"
  | "calibrationProgress"
  | "calibrationLimit"
  | "calibrationStarted"
  | "calibrationComplete"
  | "calibrationNeedsCamera"
  | "calibrationCancelled"
  | "calibrationReset"
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
  | "loadedAwApps"
  | "openedAw"
  | "awFailed"
  | "permissionsOpened"
  | "startingCamera"
  | "cameraActive"
  | "cameraLocalOnly"
  | "cameraFailed"
  | "cameraPermissionDenied"
  | "cameraNotFound"
  | "cameraBusy"
  | "cameraModelFailed"
  | "cameraUnknown"
  | "cameraStopped"
  | "loadingAw"
  | "refreshingAwApps"
  | "startingCameraShort"
  | "retry"
  | "dismiss"
  | "chartLoading"
  | "simulationLoaded"
  | "simulationStopped"
  | "savedReport"
  | "downloadedReport"
  | "noDailyData"
  | "noWeeklyData";

const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  zh: {
    appEyebrow: "本地优先专注监视",
    appTitle: "专注伴侣",
    currentState: "当前状态",
    simulationMode: "模拟运行中",
    waitingForData: "等待数据",
    noCurrentApp: "暂无前台应用",
    noCameraSample: "暂无摄像头样本",
    quickStart: "快速开始",
    monitoringActive: "专注监测正在运行",
    monitoringActiveHelp: "摄像头只在本机处理，注意力变化会实时写入时间线。",
    readyToFocus: "准备开始一次专注",
    readyToFocusHelp: "点击开始后会自动连接 ActivityWatch 并开启摄像头；两项都准备好后才开始计时。",
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
    sessionPreparing: "正在连接 ActivityWatch 并启动摄像头...",
    sessionPreparingShort: "正在准备监测...",
    setupTitle: "开始一次专注会话",
    setupBody: "点击上方“开始专注会话”，应用会自动准备 ActivityWatch 和摄像头，成功后再开始计时。手动连接工具在设置菜单中。",
    setupAwTitle: "连接 ActivityWatch",
    setupAwBody: "读取今天的前台软件和窗口记录，建立专注时间线。",
    setupCameraTitle: "开启本地注意力指标",
    setupCameraBody: "可选。只保存人脸存在与注意力数值，不保存画面。",
    setupClassifyTitle: "分类常用软件",
    setupClassifyBody: "把学习和工作软件设为允许，把容易分心的软件单独标记。",
    recommended: "推荐",
    optional: "可选",
    reasonFocusedApp: "当前窗口或软件规则允许，注意力也达到阈值。",
    reasonFocusedCamera: "摄像头检测到稳定注意力，暂未取得前台应用。",
    reasonDistractedAttention: "注意力低于当前阈值，可以调整姿势或回到任务。",
    reasonDistractedApp: "当前窗口或软件未被允许，或命中了分心规则。",
    reasonAway: "连续未检测到人脸，当前记为离开。",
    reasonWaiting: "开启摄像头或读取 ActivityWatch 后，这里会解释当前判断。",
    reasonDetectingFace: "正在等待稳定的人脸检测；达到离开确认时间后才会记为离开。",
    signalApp: "软件",
    signalCamera: "摄像头",
    signalThreshold: "阈值",
    signalNoFace: "等待人脸",
    connected: "ActivityWatch 已连接",
    disconnected: "未连接 / 无数据",
    settingsMenu: "设置",
    settingsPanelTitle: "设置与工具",
    settingsPanelHelp: "低频选项集中在这里，首页只保留实时监视和会话控制。",
    closeSettings: "关闭",
    language: "语言",
    languageHelp: "切换界面显示语言",
    toolsTitle: "模拟与导出",
    toolsHelp: "测试数据和复盘报告不影响实时监视。",
    monitoringToolsTitle: "监测连接",
    monitoringToolsHelp: "会话开始时会自动准备；这里用于手动重连和排查。计时期间摄像头由会话保护。",
    reconnectAw: "重新连接 ActivityWatch",
    introTitle: "功能说明",
    introBody:
      "它会把摄像头推断出的注意力指标和 ActivityWatch 的前台应用、窗口标题合并，自动生成日/周复盘图表，帮助你看清自己在一段时间内是否真的专注。",
    introFeatureCamera: "摄像头只在本机推理，不保存图片或视频，只保存是否在座、注意力分数等数值。",
    introFeatureActivity: "前台进程和窗口标题来自本机 ActivityWatch，用于判断当前任务是否属于专注或分心。",
    introFeatureReports: "图表包括日内时间线、状态占比和周趋势，可以导出为 Markdown 报告。",
    introPrivacy: "语言、设置和最近一次聚合结果保存在本机 localStorage；原始活动数据保存在本机 ActivityWatch。",
    introObservedTime: "统计总量只覆盖专注伴侣运行期间或已有活动事件的时间，不会把没有打开本应用的整天时间都算作离开。",
    criteriaTitle: "专注/分心如何判断",
    criteriaSummary: "阈值、离开延迟、提醒与手动规则",
    criteriaBody:
      "专注不是只看是否注视屏幕。前台软件先按允许/分心列表分类；摄像头有有效数据时，再用注意力阈值修正结果。连续检测不到人脸达到设定的离开确认时间后直接记为离开，确认期间沿用上一状态，空数据不会当成 0%。",
    thresholdLabel: "摄像头注意力阈值",
    awayDelayLabel: "离开确认时间",
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
    awAppsHelp: "读取今日前台应用后，直接选择它属于允许、中立还是分心。修改会立即重算今日数据。",
    refreshAwApps: "刷新 AW 软件",
    awAppsEmpty: "尚未读取到应用。请先确认 ActivityWatch 正在运行，然后点击刷新。",
    searchApps: "搜索软件",
    filterApps: "筛选软件",
    appFilterAll: "全部",
    appFilterFocus: "允许",
    appFilterNeutral: "中立",
    appFilterDistract: "分心",
    showingApps: "显示",
    appModeFocus: "允许",
    appModeNeutral: "中立",
    appModeDistract: "分心",
    appRuleUpdated: "软件分类已更新并重新计算。",
    loadAw: "读取 ActivityWatch",
    openAw: "打开 AW 窗口",
    openPermissions: "打开辅助功能权限",
    startCamera: "开始摄像头指标",
    stopCamera: "停止摄像头",
    startSimulation: "载入模拟运行",
    stopSimulation: "退出模拟",
    exportDaily: "导出日报 Markdown",
    exportWeekly: "导出周报 Markdown",
    exportDailyShort: "导出日报",
    exportWeeklyShort: "导出周报",
    today: "今天",
    focusRatio: "专注占比",
    focused: "专注",
    longestRun: "最长连续专注",
    distracted: "分心",
    away: "离开",
    camera: "摄像头",
    attentionNow: "当前注意力",
    todaySessionTotal: "今日专注会话",
    todaySessionTotalHelp: "今日所有会话累计时长",
    idle: "未启动",
    cameraRunning: "运行中",
    detecting: "检测中",
    facePresent: "检测到人脸",
    noLiveMetric: "暂无实时指标",
    emptyTitle: "暂无数据",
    emptyBody: "首次进入不会加载演示数据。点击“读取 ActivityWatch”会先尝试启动并连接 AW；需要实时注意力指标时再开启摄像头。",
    dailyTimeline: "每日注意力时间线",
    timelineFollowing: "实时跟随",
    timelinePaused: "已暂停实时跟随，可以缩放或拖动时间轴。",
    timelineResume: "恢复实时",
    dailyBreakdown: "每日状态占比",
    weeklyTrend: "每周趋势",
    noValidRecords: "暂无有效记录",
    minutesShort: "分钟",
    cameraPreview: "摄像头预览",
    cameraDiagnostics: "查看画面与本地检测质量",
    faceDetection: "人脸检测",
    detected: "已检测",
    notDetected: "未检测",
    confidence: "检测质量",
    gazeStatus: "视线状态",
    lookingAway: "偏离屏幕",
    lookingForward: "正向 / 向下",
    cameraPrivacy: "画面只在本地 WebView 中转成数值指标，不会持久化保存。",
    calibrationTitle: "个人姿态校准",
    calibrationBody: "保持你平时阅读或低头书写的姿势约 5 秒。应用会用本地数值建立个人基线，减少坐姿和摄像头距离造成的误判。",
    calibrationReady: "已使用个人基线",
    calibrationNotSet: "当前使用通用基线",
    calibrated: "已校准",
    notCalibrated: "未校准",
    startCalibration: "校准当前姿势",
    startCameraFirst: "请先开启摄像头",
    recalibrate: "重新校准",
    resetCalibration: "恢复通用基线",
    cancelCalibration: "取消校准",
    calibrationProgress: "姿态校准进度",
    calibrationLimit: "校准可以改善低头写作的识别，但仅凭人脸关键点无法可靠区分写作业和玩手机。",
    calibrationStarted: "姿态校准已开始，请保持平时学习或书写姿势。",
    calibrationComplete: "姿态校准完成，新的个人基线已应用。",
    calibrationNeedsCamera: "请先开启摄像头，再进行姿态校准。",
    calibrationCancelled: "已取消姿态校准。",
    calibrationReset: "已恢复通用摄像头基线。",
    introSummary: "隐私、数据来源与使用说明",
    dataTitle: "数据与备份",
    dataSummary: "备份设置、恢复偏好和清理本地缓存",
    dataBody: "设置备份适合迁移到另一台电脑，也可在调整规则前留一份副本。",
    backupPrivacy: "备份包含语言、阈值、提醒、软件/窗口规则和可选的姿态校准基线；不包含实际窗口标题、摄像头画面、逐次指标、ActivityWatch 原始记录或报告。",
    exportSettings: "导出设置备份",
    importSettings: "导入设置备份",
    restoreDefaults: "恢复默认设置",
    restoreDefaultsConfirmTitle: "确认恢复默认设置？",
    restoreDefaultsConfirmBody: "自定义阈值、提醒时段和软件分类会被替换。ActivityWatch 原始记录不会删除。",
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
    loadedAwApps: "已刷新 ActivityWatch 软件列表。",
    openedAw: "已打开 ActivityWatch 窗口。",
    awFailed: "ActivityWatch 连接失败。",
    permissionsOpened: "已打开系统权限设置。macOS 需要你手动勾选 ActivityWatch/本应用。",
    startingCamera: "正在启动摄像头指标...",
    cameraActive: "摄像头指标已启动。",
    cameraLocalOnly: "摄像头指标已启动；ActivityWatch 写入不可用，当前使用本地实时数据。",
    cameraFailed: "摄像头启动失败。",
    cameraPermissionDenied: "没有摄像头权限。请在系统设置中允许本应用访问摄像头后重试。",
    cameraNotFound: "没有找到可用摄像头，请检查设备连接。",
    cameraBusy: "摄像头可能正被其他应用占用。关闭占用摄像头的软件后重试。",
    cameraModelFailed: "本地人脸检测模型未能加载，请检查应用资源是否完整。",
    cameraUnknown: "摄像头或本地检测器启动失败，请重试。",
    cameraStopped: "摄像头已停止。",
    loadingAw: "正在读取...",
    refreshingAwApps: "正在刷新...",
    startingCameraShort: "正在启动...",
    retry: "重试",
    dismiss: "关闭",
    chartLoading: "正在加载图表...",
    simulationLoaded: "已载入模拟运行：专注、分心、离开和恢复专注。",
    simulationStopped: "已退出模拟运行。",
    savedReport: "报告已保存到",
    downloadedReport: "已下载 Markdown 报告。",
    noDailyData: "没有日报数据可导出。",
    noWeeklyData: "没有周报数据可导出。",
  },
  en: {
    appEyebrow: "Local-first focus monitor",
    appTitle: "Focus Companion",
    currentState: "Current state",
    simulationMode: "Simulation running",
    waitingForData: "Waiting for data",
    noCurrentApp: "No foreground app",
    noCameraSample: "No camera sample",
    quickStart: "Quick start",
    monitoringActive: "Focus monitoring is active",
    monitoringActiveHelp: "Camera processing stays local and attention changes update the timeline live.",
    readyToFocus: "Ready for a focus session",
    readyToFocusHelp: "Starting a session connects ActivityWatch and starts the camera automatically. Timing begins only when both are ready.",
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
    sessionPreparing: "Connecting ActivityWatch and starting the camera...",
    sessionPreparingShort: "Preparing monitoring...",
    setupTitle: "Start a focus session",
    setupBody: "Use Start focus session above. The app prepares ActivityWatch and the camera automatically, then starts timing. Manual connection tools remain in Settings.",
    setupAwTitle: "Connect ActivityWatch",
    setupAwBody: "Load today's foreground apps and windows to build the focus timeline.",
    setupCameraTitle: "Enable local attention metrics",
    setupCameraBody: "Optional. Only face presence and numeric attention metrics are stored, never frames.",
    setupClassifyTitle: "Classify frequent apps",
    setupClassifyBody: "Allow work and study apps, and mark software that tends to distract you.",
    recommended: "Recommended",
    optional: "Optional",
    reasonFocusedApp: "The current window or app rule is allowed and attention is above the threshold.",
    reasonFocusedCamera: "The camera sees stable attention; foreground app data is not available yet.",
    reasonDistractedAttention: "Attention is below the current threshold. Adjust your posture or return to the task.",
    reasonDistractedApp: "The current window or app is not allowed, or it matched a distracting rule.",
    reasonAway: "No face has been detected for the configured delay, so the state is away.",
    reasonWaiting: "Start the camera or load ActivityWatch to see an explanation of the current state.",
    reasonDetectingFace: "Waiting for a stable face detection. Away starts only after the confirmation delay.",
    signalApp: "App",
    signalCamera: "Camera",
    signalThreshold: "threshold",
    signalNoFace: "Waiting for face",
    connected: "ActivityWatch connected",
    disconnected: "Disconnected / no data",
    settingsMenu: "Settings",
    settingsPanelTitle: "Settings and tools",
    settingsPanelHelp: "Less frequent controls live here so the dashboard stays focused on live monitoring.",
    closeSettings: "Close",
    language: "Language",
    languageHelp: "Change the interface language",
    toolsTitle: "Simulation and exports",
    toolsHelp: "Test data and review reports do not affect live monitoring.",
    monitoringToolsTitle: "Monitoring connections",
    monitoringToolsHelp: "Sessions prepare these automatically. Use these controls for reconnects and troubleshooting; the camera is protected while timing.",
    reconnectAw: "Reconnect ActivityWatch",
    introTitle: "What it does",
    introBody:
      "It combines webcam-derived attention metrics with ActivityWatch foreground app and window-title data, then generates daily and weekly charts so you can review whether a work period was actually focused.",
    introFeatureCamera: "Camera frames are processed locally. Images and video are not saved; only numeric metrics are stored.",
    introFeatureActivity: "Foreground app and window titles come from local ActivityWatch data to classify focus or distraction.",
    introFeatureReports: "Charts include a daily timeline, state breakdown, and weekly trend, exportable as Markdown reports.",
    introPrivacy: "Language, settings, and the latest aggregate are stored in localStorage; raw activity remains in local ActivityWatch.",
    introObservedTime: "Totals only cover time while Focus Companion is running, or time with existing activity events. The rest of the day is not counted as away.",
    criteriaTitle: "How focus/distraction is decided",
    criteriaSummary: "Thresholds, away delay, nudges, and manual rules",
    criteriaBody:
      "Focus is not based only on gaze. The foreground app is classified first, then valid camera data refines the result. Continuous no-face samples become away after the configured confirmation delay; the previous state is retained during that delay, and missing data is never treated as 0%.",
    thresholdLabel: "Camera attention threshold",
    awayDelayLabel: "Away confirmation delay",
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
    awAppsHelp: "Load today's foreground apps, then classify each as allowed, neutral, or distracting. Changes recalculate today immediately.",
    refreshAwApps: "Refresh AW apps",
    awAppsEmpty: "No apps loaded yet. Make sure ActivityWatch is running, then refresh.",
    searchApps: "Search apps",
    filterApps: "Filter apps",
    appFilterAll: "All",
    appFilterFocus: "Allowed",
    appFilterNeutral: "Neutral",
    appFilterDistract: "Distracting",
    showingApps: "Showing",
    appModeFocus: "Allowed",
    appModeNeutral: "Neutral",
    appModeDistract: "Distracting",
    appRuleUpdated: "App classification updated and recalculated.",
    loadAw: "Load ActivityWatch",
    openAw: "Open AW window",
    openPermissions: "Open accessibility permissions",
    startCamera: "Start camera metrics",
    stopCamera: "Stop camera",
    startSimulation: "Load simulation",
    stopSimulation: "Exit simulation",
    exportDaily: "Export daily Markdown",
    exportWeekly: "Export weekly Markdown",
    exportDailyShort: "Export daily",
    exportWeeklyShort: "Export weekly",
    today: "Today",
    focusRatio: "focus ratio",
    focused: "Focused",
    longestRun: "Longest run",
    distracted: "Distracted",
    away: "Away",
    camera: "Camera",
    attentionNow: "Attention now",
    todaySessionTotal: "Today's focus sessions",
    todaySessionTotalHelp: "Total time across today's sessions",
    idle: "Idle",
    cameraRunning: "Running",
    detecting: "Detecting",
    facePresent: "face present",
    noLiveMetric: "no live metric",
    emptyTitle: "No data yet",
    emptyBody: "The app starts without demo data. Click Load ActivityWatch to try starting and connecting AW; turn on the camera only when you need live attention metrics.",
    dailyTimeline: "Daily attention timeline",
    timelineFollowing: "Following live",
    timelinePaused: "Live following is paused. You can zoom or drag the timeline.",
    timelineResume: "Resume live",
    dailyBreakdown: "Daily state breakdown",
    weeklyTrend: "Weekly trend",
    noValidRecords: "No valid records yet",
    minutesShort: "min",
    cameraPreview: "Camera preview",
    cameraDiagnostics: "View the feed and local detection quality",
    faceDetection: "Face detection",
    detected: "Detected",
    notDetected: "Not detected",
    confidence: "Detection quality",
    gazeStatus: "Gaze status",
    lookingAway: "Looking away",
    lookingForward: "Forward / downward",
    cameraPrivacy: "Frames are reduced to numeric metrics in the local WebView and are not persisted.",
    calibrationTitle: "Personal posture calibration",
    calibrationBody: "Hold your usual reading or downward writing posture for about five seconds. Local numeric samples create a personal baseline to reduce posture and camera-distance errors.",
    calibrationReady: "Personal baseline active",
    calibrationNotSet: "Using the general baseline",
    calibrated: "Calibrated",
    notCalibrated: "Not calibrated",
    startCalibration: "Calibrate this posture",
    startCameraFirst: "Start the camera first",
    recalibrate: "Recalibrate",
    resetCalibration: "Use general baseline",
    cancelCalibration: "Cancel calibration",
    calibrationProgress: "Posture calibration progress",
    calibrationLimit: "Calibration can improve downward-writing detection, but face landmarks alone cannot reliably distinguish homework from phone use.",
    calibrationStarted: "Posture calibration started. Hold your normal study or writing posture.",
    calibrationComplete: "Posture calibration complete. Your personal baseline is now active.",
    calibrationNeedsCamera: "Start the camera before posture calibration.",
    calibrationCancelled: "Posture calibration cancelled.",
    calibrationReset: "Restored the general camera baseline.",
    introSummary: "Privacy, data sources, and usage notes",
    dataTitle: "Data and backup",
    dataSummary: "Back up settings, restore preferences, and clear local cache",
    dataBody: "A settings backup can move your preferences to another computer or preserve them before rule changes.",
    backupPrivacy: "Backups contain language, thresholds, nudges, app/window rules, and an optional posture baseline. Actual window titles, camera frames, per-sample metrics, raw ActivityWatch records, and reports are excluded.",
    exportSettings: "Export settings backup",
    importSettings: "Import settings backup",
    restoreDefaults: "Restore defaults",
    restoreDefaultsConfirmTitle: "Restore default settings?",
    restoreDefaultsConfirmBody: "Custom thresholds, reminder hours, and app classifications will be replaced. Raw ActivityWatch records will not be deleted.",
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
    loadedAwApps: "ActivityWatch app list refreshed.",
    openedAw: "Opened ActivityWatch window.",
    awFailed: "ActivityWatch connection failed.",
    permissionsOpened: "Opened system permission settings. macOS still requires you to approve ActivityWatch/the app manually.",
    startingCamera: "Starting camera metric pipeline...",
    cameraActive: "Camera metrics active.",
    cameraLocalOnly: "Camera metrics active. ActivityWatch writes are unavailable, so live data is kept locally.",
    cameraFailed: "Camera start failed.",
    cameraPermissionDenied: "Camera permission is blocked. Allow camera access in system settings, then retry.",
    cameraNotFound: "No available camera was found. Check that the device is connected.",
    cameraBusy: "Another app may be using the camera. Close it and retry.",
    cameraModelFailed: "The local face-detection model could not load. Check that the app resources are complete.",
    cameraUnknown: "The camera or local detector could not start. Please retry.",
    cameraStopped: "Camera stopped.",
    loadingAw: "Loading...",
    refreshingAwApps: "Refreshing...",
    startingCameraShort: "Starting...",
    retry: "Retry",
    dismiss: "Dismiss",
    chartLoading: "Loading chart...",
    simulationLoaded: "Loaded a simulated run with focus, distraction, away, and recovery phases.",
    simulationStopped: "Exited the simulated run.",
    savedReport: "Saved report to",
    downloadedReport: "Downloaded Markdown report.",
    noDailyData: "No daily data to export.",
    noWeeklyData: "No weekly data to export.",
  },
};

export function t(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key];
}
