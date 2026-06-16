# Focus Companion

Focus Companion 是一个面向 macOS 的本地优先专注监测应用。它结合系统级输入空闲状态和 ActivityWatch 的前台应用/窗口数据，按分钟判断你是在专注还是分心，并生成当天与一周的专注概览。

## 核心能力

- 记录系统级键盘、鼠标、触控板最近输入时间
- 读取 ActivityWatch 的前台应用和窗口标题
- 按分钟生成专注/分心时间线
- 支持开始、暂停、恢复、结束专注会话
- 支持应用规则和窗口规则
- 支持分心提醒、日报/周报导出、设置备份

## 隐私

- 所有数据默认保存在本机
- 不记录按键内容、鼠标坐标或触控板手势
- 写入 ActivityWatch 的自定义数据只包含输入空闲状态和会话边界

## 系统要求

- macOS 13+
- Node.js 20.19+ 或 22.12+
- Rust / Cargo
- Xcode Command Line Tools
- ActivityWatch

## 快速开始

### 1. 安装项目依赖

在仓库根目录运行：

```bash
npm run setup
```

这个脚本会检查 Node、npm、Cargo、Xcode Command Line Tools，并安装前端依赖。  
如果新开的终端里 `cargo` 仍然不可用，执行：

```bash
source "$HOME/.cargo/env"
```

### 2. 安装并启动 ActivityWatch

1. 打开 <https://activitywatch.net/downloads/>
2. 安装并启动 ActivityWatch
3. 确认浏览器可以打开 <http://localhost:5600>
4. 确认 `aw-watcher-window` 正在运行

没有 ActivityWatch，Focus Companion 无法读取前台应用和窗口标题。

### 3. 启动应用

推荐使用桌面版开发模式：

```bash
npm run tauri:dev
```

这会打开桌面窗口，并通过 macOS 原生能力读取全局输入空闲时间。

如果只调试前端页面，可以运行：

```bash
npm run dev
```

然后访问 <http://127.0.0.1:1420>。

## 两种运行模式的区别

### `npm run tauri:dev`

- 推荐日常开发使用
- 有完整桌面能力
- 可以读取系统级输入空闲时间
- 可以调用本地通知、导出报告、打开系统设置

### `npm run dev`

- 适合只调试 React 页面
- 通过 Vite dev server 提供本机桥接
- 可以代理 ActivityWatch API
- 可以读取 macOS 输入空闲时间

不要直接打开 `dist/index.html`，也不要把 `npm run preview` 当成完整功能模式。

## 使用流程

1. 启动应用
2. 点击“开始专注会话”
3. 连接 ActivityWatch
4. 在设置中配置允许/分心的软件和窗口规则
5. 查看首页实时状态、当日时间线和周趋势
6. 需要时导出日报或周报

## 专注判定规则

每个有数据的分钟按以下顺序判断：

1. 超过输入空闲阈值：分心
2. 命中分心窗口规则：分心
3. 命中允许窗口规则：专注
4. 命中分心软件规则：分心
5. 其他有观测数据的时间：专注
6. 没有窗口数据也没有输入数据：分心

窗口规则优先于软件规则。

## 常用命令

```bash
# 安装依赖
npm run setup

# 启动桌面开发版
npm run tauri:dev

# 启动浏览器开发版
npm run dev

# 运行测试
npm test

# 构建前端
npm run build

# 构建 macOS 安装包
npm run tauri:build
```

Tauri 构建产物通常位于：

```text
src-tauri/target/release/bundle/
```

## 故障排查

### `cargo: command not found`

```bash
source "$HOME/.cargo/env"
cargo --version
```

如果仍然失败，重新安装 Rust 并重开终端。

### ActivityWatch 连接失败

- 确认 ActivityWatch 已启动
- 确认 <http://localhost:5600> 可访问
- 确认 `aw-watcher-window` 正在运行
- 确认端口 `5600` 未被防火墙或代理阻断

### 输入只识别当前页面

- 优先使用 `npm run tauri:dev`
- 浏览器模式必须通过 `npm run dev` 启动
- 不要使用静态文件或 `npm run preview`

### 端口被占用

```bash
lsof -nP -iTCP:1420 -sTCP:LISTEN
lsof -nP -iTCP:5600 -sTCP:LISTEN
```

## 数据写入

Focus Companion 会读取 ActivityWatch 的窗口 watcher bucket，并写入两个自定义 bucket：

- `focus-input_<hostname>`：输入空闲状态
- `focus-companion-session_<hostname>`：专注会话边界

输入事件只包含类似下面的数据：

```json
{
  "idleSeconds": 12,
  "active": true
}
```
