# MMF27 Dock Swipe Fix

[![npm version](https://img.shields.io/npm/v/mmf27-dock-swipe-fix.svg)](https://www.npmjs.com/package/mmf27-dock-swipe-fix)
[![GitHub release](https://img.shields.io/github/v/release/timmyagentic/mac-mouse-fix-macos-27-fix)](https://github.com/timmyagentic/mac-mouse-fix-macos-27-fix/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An unofficial, temporary companion repair for Mac Mouse Fix Dock Swipe gestures
on macOS 27.

[English](#english) · [中文](#中文)

## Install with an AI agent / 使用 AI Agent 安装

Copy either prompt into Codex, Claude Code, Cursor, or another local coding
agent. The agent can install and verify the app, but **you must personally
approve Accessibility permission in macOS System Settings**.

<details open>
<summary><strong>English prompt</strong></summary>

```text
Install or update MMF27 Dock Swipe Fix from the official npm package. First
verify that this Mac is running macOS 27 or later and that the official Mac
Mouse Fix exists at /Applications/Mac Mouse Fix.app. Run
`npm view mmf27-dock-swipe-fix version` and stop if it reports a version below
0.3.0, because the adaptive menu-bar release is not public yet. Then run:

npx --yes mmf27-dock-swipe-fix@latest install

Do not use sudo, disable Gatekeeper, remove quarantine attributes, edit the TCC
database, or modify/re-sign Mac Mouse Fix. Stop if checksum, Developer ID,
Bundle ID, architecture, or self-test verification fails. If Accessibility is
pending, open the correct System Settings page and ask me to enable MMF27 Dock
Swipe Fix manually. Finally run:

npx --yes mmf27-dock-swipe-fix@latest status --json

Report the installed version and whether code_signature, private_api,
accessibility, self_test, service, and runtime are healthy. Also report
menu_bar_mode and menu_bar_icon. A healthy runtime normally hides its menu-bar
icon after a short startup grace period; that is expected, not a failure.
```

</details>

<details>
<summary><strong>中文提示词</strong></summary>

```text
请通过官方 npm 包安装或更新 MMF27 Dock Swipe Fix。先确认这台 Mac 运行的是
macOS 27 或更高版本，并确认原版 Mac Mouse Fix 位于
/Applications/Mac Mouse Fix.app。先运行 `npm view mmf27-dock-swipe-fix version`；
如果版本低于 0.3.0，请停止，因为自适应菜单栏版本尚未公开发布。确认后再运行：

npx --yes mmf27-dock-swipe-fix@latest install

不要使用 sudo，不要关闭 Gatekeeper、删除隔离属性、修改 TCC 数据库，也不要修改或
重新签名 Mac Mouse Fix。如果 SHA-256、Developer ID、Bundle ID、双架构或自检任一
验证失败，立即停止。如果辅助功能权限尚未授权，请打开正确的系统设置页面，让我手动
启用 MMF27 Dock Swipe Fix。最后运行：

npx --yes mmf27-dock-swipe-fix@latest status --json

向我报告已安装版本，以及 code_signature、private_api、accessibility、self_test、
service 和 runtime 是否健康，同时报告 menu_bar_mode 与 menu_bar_icon。健康状态下，
菜单栏图标通常会在短暂的启动展示后自动隐藏；这是预期行为，并不表示程序退出。
```

</details>

> [!IMPORTANT]
> This is an independent compatibility project. It is not affiliated with or
> endorsed by Mac Mouse Fix or Apple. Remove it after Mac Mouse Fix ships an
> official macOS 27 fix.

## One-command install / 一行命令安装

Requires Node.js 18.17 or later with npm. This command performs a persistent
per-user installation—`npx` is only the explicit installer entry point.

```bash
npx --yes mmf27-dock-swipe-fix@latest install
```

Each npm package contains its matching pinned, signed app artifact. Before
touching the existing installation, it verifies the SHA-256, expanded size,
archive paths and file types, Apple Developer ID requirement, Team ID, Bundle
ID, app version, Apple Silicon + Intel architectures, and a non-disruptive HID
payload self-test. It never uses `postinstall`, `sudo`, or automatic TCC
modification.

> [!NOTE]
> The v0.3.0 app is Developer ID signed but not yet Apple-notarized.
> The installer does not bypass Gatekeeper or remove quarantine attributes. If
> macOS displays a warning, follow the manual Control-click **Open** step below.
>
> **中文：** v0.3.0 已使用 Developer ID 签名，但尚未经过 Apple
> 公证。安装器不会绕过 Gatekeeper 或删除隔离属性；如果 macOS 显示警告，请按下文
> 方法按住 Control 点击应用并选择“打开”。

After approving **System Settings > Privacy & Security > Accessibility**, run:

```bash
npx --yes mmf27-dock-swipe-fix@latest status --json
```

After npm reports v0.3.0 or later, these commands are also available:

```bash
npx --yes mmf27-dock-swipe-fix@latest update
npx --yes mmf27-dock-swipe-fix@latest show
npx --yes mmf27-dock-swipe-fix@latest verify-release
npx --yes mmf27-dock-swipe-fix@latest uninstall
```

<a id="english"></a>

## English

### What it fixes

On macOS 27, Mac Mouse Fix can still recognize mouse buttons while its
continuous system gestures stop responding. This companion restores the Dock
Swipe event path used by:

- Spaces & Mission Control
- Application Windows (App Exposé)
- Move Between Spaces
- Desktop & Launchpad

It preserves the interactive gesture animation. It does not replace the gesture
with a one-shot keyboard shortcut, modify Mac Mouse Fix, inject code into its
Helper, or re-sign the original application.

Version 0.2.0 also fixes a direction-dependent rebound at the end of a Space
transition. It normalizes progress and exit velocity together, preserves the
source event timestamp, and handles events on a dedicated `userInteractive`
thread.

Version 0.3.0 adds an adaptive menu-bar controller. The icon appears while the
app starts, waits for permission, or reports an error, then hides automatically
after the runtime becomes healthy. An **Always Show Menu Bar Icon** preference
is available for users who prefer a permanent control surface.

### Requirements

- macOS 27 or later
- Mac Mouse Fix installed at
  `/Applications/Mac Mouse Fix.app`
- Accessibility permission for **MMF27 Dock Swipe Fix**
- For the recommended npm installer: Node.js 18.17 or later with npm
- For source builds: Xcode Command Line Tools

Use an official, unmodified Mac Mouse Fix installation. If you previously used
a patcher that modifies or re-signs Mac Mouse Fix, restore the official app
before installing this companion. Do not run multiple macOS 27 workarounds at
the same time.

### Installation tutorial

#### Option A — Install with npm (recommended)

```bash
npx --yes mmf27-dock-swipe-fix@latest install
```

The command verifies and installs the signed app under `~/Applications`,
registers a per-user LaunchAgent so it starts after login, launches it, and
opens the Accessibility settings page when approval is still needed. It does
not require an npm global install or administrator privileges.

The v0.3.0 artifact is signed but not yet Apple-notarized. The installer
will never disable Gatekeeper or remove quarantine attributes on your behalf.

To preview the exact target paths without changing anything:

```bash
npx --yes mmf27-dock-swipe-fix@latest install --dry-run
```

#### Option B — Download the release app manually

Use this if Node.js/npm is not installed.

1. Open the [latest release](https://github.com/timmyagentic/mac-mouse-fix-macos-27-fix/releases/latest).
2. Download `MMF27-Dock-Swipe-Fix-0.3.0.app.zip` and the matching `.sha256` file.
3. Double-click the ZIP file to extract **MMF27 Dock Swipe Fix.app**.
4. In Finder, choose **Go > Go to Folder…**, enter `~/Applications`, and move
   the app there. Create the folder if it does not exist.
5. Control-click the app and choose **Open**. The release is Developer ID signed
   but not notarized, so a normal double-click may be blocked the first time.
6. Open **System Settings > Privacy & Security > Accessibility** and enable
   **MMF27 Dock Swipe Fix**. If it is not listed, click `+` and select:
   `~/Applications/MMF27 Dock Swipe Fix.app`.
7. Open the app again. Its mouse icon appears briefly while startup checks run.
   When healthy, the icon hides automatically; confirm installation with the
   status command below and check that it reports `runtime=active`.
8. Optional: add the app under **System Settings > General > Login Items** so it
   starts automatically after login.

Published SHA-256 checksums are assets on the same Release page. To verify a
download in Terminal:

```bash
cd "$HOME/Downloads"
shasum -a 256 -c MMF27-Dock-Swipe-Fix-0.3.0.app.zip.sha256
```

#### Option C — Build and install from source

Install the Xcode Command Line Tools if needed:

```bash
xcode-select --install
```

Clone the repository and run the installer:

```bash
git clone https://github.com/timmyagentic/mac-mouse-fix-macos-27-fix.git
cd mac-mouse-fix-macos-27-fix
./scripts/install.sh
```

The installer builds a universal Apple Silicon + Intel app, runs a
non-disruptive HID payload self-test, installs it under `~/Applications`, adds a
per-user LaunchAgent, and opens Accessibility settings.

Source builds are ad-hoc signed by default. Developers can provide an installed
signing identity to preserve a stable Accessibility code requirement across
rebuilds:

```bash
MMF27_SIGNING_IDENTITY="Developer ID Application: Example (TEAMID)" ./scripts/install.sh
```

### Adaptive menu-bar behavior

Version 0.3.0 keeps the menu-bar icon out of the way when no attention is
required:

- On first install or launch, the icon stays visible briefly while startup
  checks finish.
- With `runtime=active`, the icon hides automatically after that grace period.
- Waiting for Accessibility permission, an Event Tap startup failure, an
  unavailable private API, an unsupported system version, or any other error
  makes the icon appear automatically.
- After an error recovers and the runtime becomes healthy, the icon hides
  again.
- Enable **Always Show Menu Bar Icon** in the menu to keep it visible. This
  preference is off by default and persists across launches.

The menu continues to provide **Open Accessibility Settings…**, **Run
Self-Test**, the current status, and **Quit**. If the healthy icon is hidden,
reveal the controls with:

```bash
npx --yes mmf27-dock-swipe-fix@latest show
```

For a source-installed app, use the exact application path instead:

```bash
open "$HOME/Applications/MMF27 Dock Swipe Fix.app"
```

This temporarily reveals the icon; click it to open the diagnostic menu.
Adaptive hiding resumes after the menu closes or its reveal grace period ends.

### Verify that it is working

Because a healthy icon is hidden by default, use the npm installer's
machine-readable status instead of relying on a visible menu item:

```bash
npx --yes mmf27-dock-swipe-fix@latest status --json
```

You can also call the installed app directly:

```bash
"$HOME/Applications/MMF27 Dock Swipe Fix.app/Contents/MacOS/MMF27DockSwipeFix" --status
```

A healthy installation reports:

```text
private_api=ok
accessibility=granted
self_test=pass
runtime=active
service=running
menu_bar_mode=adaptive
menu_bar_icon=hidden
```

If **Always Show Menu Bar Icon** is enabled, a healthy installation instead
reports `menu_bar_mode=always` and `menu_bar_icon=visible`.

If the app is not running, the CLI reports `service=stopped` and
`menu_bar_icon=not_running`; use `show` or the exact `open` command above to
start it and restore the controls.

Then test the same Mac Mouse Fix action that failed before, such as holding the
configured mouse button and dragging left or right to move between Spaces.

### Troubleshooting

#### The menu says “Waiting for Accessibility permission”

1. Quit **MMF27 Dock Swipe Fix**.
2. In **System Settings > Privacy & Security > Accessibility**, remove any old
   or duplicate **MMF27 Dock Swipe Fix** entries.
3. Click `+` and select the exact installed copy at
   `~/Applications/MMF27 Dock Swipe Fix.app`.
4. Enable it and open the app again.

An old test build or backup with the same bundle identifier can cause macOS to
bind permission to the wrong copy. A visible switch is not enough—the status
command must report `accessibility=granted` and `runtime=active`. While the app
is waiting, its menu-bar icon remains visible for troubleshooting.

#### macOS says the app cannot be opened

The release is signed but not notarized. Control-click the app in Finder, choose
**Open**, and confirm once. Do not disable Gatekeeper globally.

#### Status says Active, but gestures still do not work

- Confirm the Mac Mouse Fix action is one of the Dock Swipe actions listed above.
- Restore the official Mac Mouse Fix app if another patcher modified it.
- Make sure only one macOS 27 workaround is running.
- Run the status command and include its output, your macOS version, Mac Mouse
  Fix version, and mouse model in a
  [new issue](https://github.com/timmyagentic/mac-mouse-fix-macos-27-fix/issues/new).

### Uninstall

For an npm installation, run:

```bash
npx --yes mmf27-dock-swipe-fix@latest uninstall
```

The app and LaunchAgent are moved to a timestamped folder in the Trash, so the
operation remains recoverable. Logs and installation backups are retained.

If you installed from source, run this inside the cloned repository:

```bash
./scripts/uninstall.sh
```

The installed app and LaunchAgent are moved to the Trash so the operation is
recoverable.

If you installed the release app manually:

1. Reopen the installed app with
   `open "$HOME/Applications/MMF27 Dock Swipe Fix.app"`, then quit it from its
   mouse icon.
2. Remove it from **System Settings > General > Login Items**, if added.
3. Move `~/Applications/MMF27 Dock Swipe Fix.app` to the Trash.
4. Optionally remove its Accessibility entry.

### How it works

Mac Mouse Fix has no plugin API. This project therefore runs as a small menu-bar
companion with its own Accessibility permission. It watches only synthetic event
type 30 with Mac Mouse Fix's Dock Swipe subtype 23. If the event does not already
carry a macOS 27 HID payload, the companion reconstructs the Dock Swipe
motion/phase/progress/velocity data and attaches it through
`SLEventSetIOHIDEvent`.

Events outside that narrow scope pass through unchanged. If a future Mac Mouse
Fix build already attaches the expected HID payload, the companion leaves that
event alone.

### Security and privacy

- No administrator privileges
- No modification or re-signing of `/Applications/Mac Mouse Fix.app`
- The npm client downloads the installer package; the installed companion app
  itself has no network access
- No input recording or storage
- Only runtime status and the **Always Show Menu Bar Icon** preference are saved
  locally
- The npm package has no `preinstall`, `install`, or `postinstall` lifecycle
  scripts; system changes happen only after the explicit `install` command
- The npm installer verifies a pinned SHA-256, archive paths, Developer ID Team
  `4356B4HF9R`, the Apple Developer ID requirement, Bundle ID, app version,
  expanded size and file types, both CPU architectures, and the built-in HID
  self-test before replacing an existing installation
- Source code and reproducible local build scripts are included
- Uses private SkyLight/HID APIs, so this should be treated as a temporary
  compatibility repair rather than a permanent system extension

### Compatibility

Designed and self-tested on macOS 27 with Mac Mouse Fix 3.1.0 Beta 1. Mac Mouse
Fix 3.0.x uses the same legacy Dock Swipe event fields, but not every version and
mouse model has been independently tested.

### Related upstream work

The implementation follows the safer direction explored in upstream PRs
[#1916](https://github.com/noah-nuebling/mac-mouse-fix/pull/1916),
[#1920](https://github.com/noah-nuebling/mac-mouse-fix/pull/1920), and
[#1924](https://github.com/noah-nuebling/mac-mouse-fix/pull/1924). The tested
companion findings were also submitted upstream in
[#1936](https://github.com/noah-nuebling/mac-mouse-fix/pull/1936): attach the
HID payload through `SLEventSetIOHIDEvent` instead of writing a pointer through
unstable, hard-coded `CGEvent` offsets.

### License

[MIT](LICENSE)

---

<a id="中文"></a>

## 中文

### 这个项目修复什么

在 macOS 27 上，Mac Mouse Fix 仍然可以识别鼠标按键，但一些连续系统手势会完全
失效。这个伴随程序用于恢复以下 Dock Swipe 功能：

- 空间与调度中心（Spaces & Mission Control）
- 应用程序窗口（App Exposé）
- 在空间之间移动
- 桌面与启动台（Desktop & Launchpad）

它会保留跟随鼠标移动的连续动画，不会把手势替换成一次性的键盘快捷键，也不会修改、
注入或重新签名原版 Mac Mouse Fix。

0.2.0 还修复了空间切换结束时偶发的反向回弹：进度和离手速度会一起做方向校正，
原始事件时间戳会被保留，事件处理则运行在独立的 `userInteractive` 线程中。

0.3.0 新增了自适应菜单栏控制：程序启动、等待权限或发生异常时会显示图标；运行状态
恢复健康后则自动隐藏。如果希望始终保留控制入口，可以打开
**Always Show Menu Bar Icon** 选项。

### 使用要求

- macOS 27 或更高版本
- 已安装 Mac Mouse Fix，并且它位于
  `/Applications/Mac Mouse Fix.app`
- 给 **MMF27 Dock Swipe Fix** 授予“辅助功能”权限
- 如果使用推荐的 npm 安装方式，需要 Node.js 18.17 或更高版本以及 npm
- 如果从源码构建，需要安装 Xcode Command Line Tools

请使用官方、未经修改的 Mac Mouse Fix。如果以前安装过会修改或重新签名 Mac Mouse
Fix 的补丁，请先恢复官方应用。不要同时运行多个 macOS 27 修复方案。

### 安装教程

#### 方式一：通过 npm 安装（推荐）

```bash
npx --yes mmf27-dock-swipe-fix@latest install
```

这条命令会验证签名与完整性，把应用安装到 `~/Applications`，注册当前用户的
LaunchAgent 以便登录后自动启动，运行应用，并在仍需授权时打开辅助功能设置页面。
它不需要全局安装 npm 包，也不需要管理员权限。

v0.3.0 已使用 Developer ID 签名，但尚未经过 Apple 公证。安装器不会替你关闭
Gatekeeper，也不会删除隔离属性；如果 macOS 显示警告，请按下面手动安装部分的方法，
按住 Control 点击应用并选择“打开”。

如果只想预览安装目标而不修改任何内容：

```bash
npx --yes mmf27-dock-swipe-fix@latest install --dry-run
```

#### 方式二：手动下载已经构建好的应用

如果没有安装 Node.js/npm，可以使用这种方式。

1. 打开[最新 Release](https://github.com/timmyagentic/mac-mouse-fix-macos-27-fix/releases/latest)。
2. 下载 `MMF27-Dock-Swipe-Fix-0.3.0.app.zip` 和对应的 `.sha256` 文件。
3. 双击 ZIP，解压得到 **MMF27 Dock Swipe Fix.app**。
4. 在访达中选择“前往 > 前往文件夹…”，输入 `~/Applications`，把应用移动进去。
   如果这个文件夹不存在，可以先新建。
5. 按住 Control 点击应用并选择“打开”。Release 使用 Developer ID 签名，但还没有
   经过 Apple 公证，因此第一次普通双击可能会被 macOS 拦截。
6. 打开“系统设置 > 隐私与安全性 > 辅助功能”，启用
   **MMF27 Dock Swipe Fix**。如果列表中没有它，点击 `+` 并选择：
   `~/Applications/MMF27 Dock Swipe Fix.app`。
7. 再次打开应用。启动检查期间菜单栏会短暂出现鼠标图标；健康后图标会自动隐藏。
   请使用下文的状态命令确认它报告 `runtime=active`。
8. 可选：在“系统设置 > 通用 > 登录项”中添加这个应用，让它登录后自动启动。

Release 页面同时提供 SHA-256 校验文件。可以在终端中验证下载内容：

```bash
cd "$HOME/Downloads"
shasum -a 256 -c MMF27-Dock-Swipe-Fix-0.3.0.app.zip.sha256
```

#### 方式三：从源码构建并自动安装

如果还没有安装 Xcode Command Line Tools：

```bash
xcode-select --install
```

克隆仓库并运行安装脚本：

```bash
git clone https://github.com/timmyagentic/mac-mouse-fix-macos-27-fix.git
cd mac-mouse-fix-macos-27-fix
./scripts/install.sh
```

脚本会构建同时支持 Apple Silicon 和 Intel 的应用，执行不会触发真实手势的 HID
自测，安装到 `~/Applications`，创建当前用户的 LaunchAgent，并打开辅助功能设置。

源码构建默认使用 ad-hoc 签名。开发者也可以指定本机已有的签名身份，让后续重新构建
保持稳定的辅助功能代码要求：

```bash
MMF27_SIGNING_IDENTITY="Developer ID Application: Example (TEAMID)" ./scripts/install.sh
```

### 自适应菜单栏行为

0.3.0 会在不需要用户处理时自动收起菜单栏图标：

- 首次安装或每次启动时，图标会短暂显示，等待启动检查结束。
- `runtime=active` 时，图标会在这段缓冲时间后自动隐藏。
- 等待辅助功能权限、Event Tap 启动失败、私有 API 不可用、系统版本不符或任何其他
  异常，都会让图标自动出现。
- 异常恢复、运行状态重新健康后，图标会再次自动隐藏。
- 如果希望图标常驻，请在菜单中打开 **Always Show Menu Bar Icon**。该选项默认关闭，
  并会跨启动持久保存。

菜单仍然保留“打开辅助功能设置”“运行自检”、当前状态和“退出”等排障入口。健康时
图标隐藏后，可以用下面的命令重新显示控制入口：

```bash
npx --yes mmf27-dock-swipe-fix@latest show
```

使用源码安装时，请改用精确的应用路径：

```bash
open "$HOME/Applications/MMF27 Dock Swipe Fix.app"
```

这会临时显示图标；点击它即可打开排障菜单。菜单关闭或临时展示时间结束后，自适应隐藏
会继续生效。

### 验证是否生效

由于健康状态下图标默认隐藏，请使用 npm 安装器提供的 JSON 状态检查，不要以菜单栏
是否有图标作为健康判据：

```bash
npx --yes mmf27-dock-swipe-fix@latest status --json
```

也可以直接调用已安装应用：

```bash
"$HOME/Applications/MMF27 Dock Swipe Fix.app/Contents/MacOS/MMF27DockSwipeFix" --status
```

正常状态应该包含：

```text
private_api=ok
accessibility=granted
self_test=pass
runtime=active
service=running
menu_bar_mode=adaptive
menu_bar_icon=hidden
```

如果打开了 **Always Show Menu Bar Icon**，健康状态会改为报告
`menu_bar_mode=always` 和 `menu_bar_icon=visible`。

如果应用没有运行，CLI 会报告 `service=stopped` 和
`menu_bar_icon=not_running`；请使用上面的 `show` 或精确 `open` 命令启动应用并恢复
控制入口。

然后测试之前失效的 Mac Mouse Fix 动作，例如按住配置好的鼠标键并左右拖动切换空间。

### 常见问题

#### 菜单显示“Waiting for Accessibility permission”

1. 退出 **MMF27 Dock Swipe Fix**。
2. 在“系统设置 > 隐私与安全性 > 辅助功能”中删除旧的或重复的
   **MMF27 Dock Swipe Fix** 记录。
3. 点击 `+`，明确选择
   `~/Applications/MMF27 Dock Swipe Fix.app` 这个已安装副本。
4. 打开权限开关，然后重新启动应用。

旧测试版或备份应用如果使用相同 Bundle ID，macOS 可能会把权限绑定到错误副本。仅仅
看到开关打开并不代表成功，状态命令必须报告 `accessibility=granted` 和
`runtime=active`。等待期间菜单栏图标会保持显示，便于排障。

#### macOS 提示无法打开应用

Release 已签名但尚未公证。请在访达中按住 Control 点击应用，选择“打开”，并确认一次。
不建议全局关闭 Gatekeeper。

#### 状态已经是 Active，但手势还是不工作

- 确认 Mac Mouse Fix 中配置的是上面列出的 Dock Swipe 功能。
- 如果其他补丁修改过 Mac Mouse Fix，请恢复官方版本。
- 确认系统里只运行一个 macOS 27 修复方案。
- 运行状态检查命令，并把输出、macOS 版本、Mac Mouse Fix 版本和鼠标型号附在
  [新 issue](https://github.com/timmyagentic/mac-mouse-fix-macos-27-fix/issues/new) 中。

### 卸载

如果通过 npm 安装，请运行：

```bash
npx --yes mmf27-dock-swipe-fix@latest uninstall
```

应用和 LaunchAgent 会被移动到废纸篓里的时间戳文件夹，因此仍然可以恢复；日志和安装
备份会被保留。

如果通过源码安装，请在克隆的仓库目录中运行：

```bash
./scripts/uninstall.sh
```

脚本会把应用和 LaunchAgent 移到废纸篓，仍然可以恢复。

如果手动安装了 Release 应用：

1. 先运行 `open "$HOME/Applications/MMF27 Dock Swipe Fix.app"` 重新显示图标，再从
   鼠标图标退出应用。
2. 如果添加过登录项，请在“系统设置 > 通用 > 登录项”中移除。
3. 把 `~/Applications/MMF27 Dock Swipe Fix.app` 移到废纸篓。
4. 可以同时删除它的辅助功能授权记录。

### 实现原理

Mac Mouse Fix 没有插件 API，因此这个项目采用一个拥有独立辅助功能权限的小型菜单栏
伴随程序。它只观察 Mac Mouse Fix 发出的事件类型 30、Dock Swipe 子类型 23。如果
事件还没有携带 macOS 27 需要的 HID 数据，程序会重建 motion、phase、progress 和
velocity，并通过 `SLEventSetIOHIDEvent` 附加到原事件。

其他事件会原样通过。如果未来的 Mac Mouse Fix 已经附加了正确 HID 数据，这个程序
也会跳过该事件。

### 安全与隐私

- 不需要管理员权限
- 不修改或重新签名 `/Applications/Mac Mouse Fix.app`
- npm 客户端只在获取安装器包时访问网络；安装后的伴随应用本身不访问网络
- 不记录或保存输入内容
- 本地只保存运行状态和 **Always Show Menu Bar Icon** 偏好
- npm 包不包含 `preinstall`、`install` 或 `postinstall` 生命周期脚本；只有用户明确
  执行 `install` 子命令后才会修改本地安装
- 替换旧安装前，npm 安装器会验证固定 SHA-256、解压大小、压缩包路径与文件类型、
  Apple Developer ID 要求、Developer ID Team `4356B4HF9R`、Bundle ID、应用版本、
  两种 CPU 架构以及内置 HID 自检
- 仓库包含完整源码和可在本机构建的脚本
- 使用 SkyLight/HID 私有 API，因此它应该被视为临时兼容性修复，而不是永久系统扩展

### 兼容性

已针对 macOS 27 和 Mac Mouse Fix 3.1.0 Beta 1 设计并完成自测。Mac Mouse Fix
3.0.x 使用相同的旧版 Dock Swipe 事件字段，但并非每个版本和鼠标型号都经过独立测试。

### 相关上游工作

实现采用了上游 PR
[#1916](https://github.com/noah-nuebling/mac-mouse-fix/pull/1916)、
[#1920](https://github.com/noah-nuebling/mac-mouse-fix/pull/1920) 和
[#1924](https://github.com/noah-nuebling/mac-mouse-fix/pull/1924)
探索的更安全方向；这个伴随程序的实测结论也已经通过
[#1936](https://github.com/noah-nuebling/mac-mouse-fix/pull/1936)
提交给上游：通过 `SLEventSetIOHIDEvent` 附加 HID 数据，而不是依赖不稳定的硬编码
`CGEvent` 内部偏移写入指针。

### 许可证

[MIT](LICENSE)
