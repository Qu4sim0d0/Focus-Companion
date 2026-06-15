# Focus Companion

Focus Companion 是一个面向 macOS 的本地专注监测应用。它把以下两类信号合并成按分钟统计的专注时间线：

- macOS 系统级键盘、鼠标和触控板活跃状态
- ActivityWatch 提供的前台软件与窗口标题

所有原始数据都保存在本机。应用不会记录按键内容、鼠标坐标或触控板手势。

## 第一次运行

### 1. 一键完成项目安装

先在仓库根目录运行：

```bash
npm run setup
```

这个脚本会：

- macOS 13 或更高版本
- 检查 Node.js、npm、Rust/Cargo 和 Xcode Command Line Tools
- 自动加载 `~/.cargo/env` 并补充 `~/.cargo/bin` 到当前会话路径
- 安装项目依赖

如果缺少系统级前置条件，脚本会直接提示下一步怎么补齐。

如果你是在新开的终端里直接跑 `npm run tauri:dev`，但 `cargo` 仍然找不到，先执行：

```bash
source "$HOME/.cargo/env"
```

或者重新打开一个已加载 Rust 环境的终端。

### 2. 安装并启动 ActivityWatch

1. 打开 [ActivityWatch 下载页](https://activitywatch.net/downloads/)。
2. 下载 macOS `.dmg`，把 ActivityWatch 拖入“应用程序”。
3. 启动 ActivityWatch，确认菜单栏中出现 ActivityWatch 图标。
4. 在浏览器打开 <http://localhost:5600>。
5. 确认 ActivityWatch 页面能够显示数据，并且 `aw-watcher-window` 正在运行。

ActivityWatch 必须保持运行，否则 Focus Companion 无法取得前台软件和窗口标题。

## 推荐启动方式：桌面版

```bash
npm run tauri:dev
```

命令成功后会打开 Focus Companion 桌面窗口。桌面版通过 macOS CoreGraphics 读取整个系统的输入空闲时间，因此切换到其他软件后，键盘、鼠标和触控板输入仍然有效。

进入应用后：

1. 点击“开始专注会话”。
2. 应用会尝试启动并连接 ActivityWatch。
3. 打开“设置”可以配置软件规则和窗口规则。
4. “ActivityWatch 软件列表”和“ActivityWatch 窗口列表”彼此独立。
5. 首页图表每分钟更新一次，主时间线展示最近三小时。

## 浏览器开发模式

只修改 React 页面时可以使用：

```bash
npm run dev
```

然后打开 <http://127.0.0.1:1420>。

开发服务器包含两个本机桥接：

- 代理 ActivityWatch 的 `localhost:5600` API
- 通过 macOS `IOHIDSystem` 读取系统级输入空闲时间

因此使用 `npm run dev` 启动时，即使切换到其他窗口，系统输入仍然会被识别。

不要直接双击 `dist/index.html`，也不要把 `npm run preview` 当作完整功能模式。它们没有开发桥接；输入状态会降级成“仅当前页面输入”，ActivityWatch 也可能无法连接。

## 如何确认全局输入正常

1. 启动桌面版或 `npm run dev`。
2. 首页“输入状态”下方应显示“系统级输入”。
3. 切换到其他应用，等待几秒，然后移动鼠标或按键。
4. 切回 Focus Companion，“距最近输入时间”应重新接近 0 秒。
5. 连续 60 秒没有任何输入时，状态会变为“分心”。

如果页面显示“仅当前页面输入”，说明系统输入桥接不可用。请检查启动方式和下面的故障排查。

## 软件列表与窗口列表

两个列表都来自 ActivityWatch，但用途不同：

- 软件列表按应用名聚合，例如 `Safari`、`Code`、`Terminal`。
- 窗口列表按“应用名 + 窗口标题”聚合，例如 Safari 中不同的网站页面。
- 窗口规则优先于软件规则。
- 分心窗口规则优先于允许窗口规则。

例如可以把 `Safari` 设置为允许，再在窗口列表中把包含 `YouTube` 的页面设置为分心。

## 专注状态判定

每个有数据的分钟按以下顺序分类：

1. 系统连续 60 秒没有键盘、鼠标或触控板输入：分心。
2. 命中分心窗口规则：分心。
3. 命中允许窗口规则：专注。
4. 命中分心软件规则：分心。
5. 其余有观测的时间：专注。
6. 没有窗口数据也没有输入数据：离开。

主时间线使用一分钟一根柱：

- 绿色高柱：专注
- 橙色中柱：分心
- 灰色低柱：离开

所有图表和 ActivityWatch 汇总每分钟刷新一次。

## 常用命令

```bash
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

Rust 没有安装或当前终端尚未加载 Cargo：

```bash
source "$HOME/.cargo/env"
cargo --version
```

仍然找不到时，重新安装 Rust，然后关闭并重新打开终端。

### ActivityWatch 连接失败

依次检查：

1. ActivityWatch 是否已启动。
2. <http://localhost:5600> 是否能打开。
3. ActivityWatch 的 `aw-watcher-window` 是否正在运行。
4. 端口 `5600` 是否被代理或防火墙拦截。
5. 在 Focus Companion 设置中点击“重新连接 ActivityWatch”。

macOS 如果没有提供窗口标题，请在“系统设置 > 隐私与安全性 > 辅助功能”中检查 ActivityWatch 的权限。

### 输入只识别当前页面

- 优先使用 `npm run tauri:dev`。
- 浏览器模式必须通过 `npm run dev` 启动并访问 `127.0.0.1:1420`。
- 不要使用静态文件、其他 Web 服务器或 `npm run preview` 测试全局输入。
- 确认 `/usr/sbin/ioreg` 可以运行：

```bash
/usr/sbin/ioreg -c IOHIDSystem | grep HIDIdleTime
```

### 端口已被占用

开发服务器固定使用 `1420`，ActivityWatch 默认使用 `5600`：

```bash
lsof -nP -iTCP:1420 -sTCP:LISTEN
lsof -nP -iTCP:5600 -sTCP:LISTEN
```

结束旧进程后重新启动对应程序。

## 数据与隐私

Focus Companion 读取 ActivityWatch 的窗口 watcher bucket，并写入：

- `focus-input_<hostname>`：每分钟输入空闲状态
- `focus-companion-session_<hostname>`：专注会话边界

输入事件只包含：

```json
{
  "idleSeconds": 12,
  "active": true
}
```

不会保存按键内容、鼠标位置、触控板轨迹或摄像头数据。

ActivityWatch 官方入门说明：
<https://docs.activitywatch.net/en/latest/getting-started.html>
