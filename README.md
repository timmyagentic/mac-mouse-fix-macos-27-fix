# MMF27 Dock Swipe Fix

[English](#english) · [中文](#中文)

An unofficial, temporary companion repair for Mac Mouse Fix Dock Swipe gestures
on macOS 27.

> [!IMPORTANT]
> This is an independent compatibility project. It is not affiliated with or
> endorsed by Mac Mouse Fix or Apple. Remove it after Mac Mouse Fix ships an
> official macOS 27 fix.

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

### Requirements

- macOS 27 or later
- Mac Mouse Fix installed; the source installer expects it at
  `/Applications/Mac Mouse Fix.app`
- Accessibility permission for **MMF27 Dock Swipe Fix**
- For source builds: Xcode Command Line Tools

Use an official, unmodified Mac Mouse Fix installation. If you previously used
a patcher that modifies or re-signs Mac Mouse Fix, restore the official app
before installing this companion. Do not run multiple macOS 27 workarounds at
the same time.

### Installation tutorial

#### Option A — Download the release app

This is the easiest installation method.

1. Open the [latest release](https://github.com/timmyagentic/mac-mouse-fix-macos-27-fix/releases/latest).
2. Download `MMF27-Dock-Swipe-Fix-0.2.0.app.zip` and the matching `.sha256` file.
3. Double-click the ZIP file to extract **MMF27 Dock Swipe Fix.app**.
4. In Finder, choose **Go > Go to Folder…**, enter `~/Applications`, and move
   the app there. Create the folder if it does not exist.
5. Control-click the app and choose **Open**. The release is Developer ID signed
   but not notarized, so a normal double-click may be blocked the first time.
6. Open **System Settings > Privacy & Security > Accessibility** and enable
   **MMF27 Dock Swipe Fix**. If it is not listed, click `+` and select:
   `~/Applications/MMF27 Dock Swipe Fix.app`.
7. Open the app again. Its mouse icon appears in the menu bar. Installation is
   complete when the menu says **Active — low-latency Dock Swipe repair enabled**.
8. Optional: add the app under **System Settings > General > Login Items** so it
   starts automatically after login.

Published SHA-256 checksums are assets on the same Release page. To verify a
download in Terminal:

```bash
cd "$HOME/Downloads"
shasum -a 256 -c MMF27-Dock-Swipe-Fix-0.2.0.app.zip.sha256
```

#### Option B — Build and install from source

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

### Verify that it is working

The menu-bar status must say **Active**. You can also run:

```bash
"$HOME/Applications/MMF27 Dock Swipe Fix.app/Contents/MacOS/MMF27DockSwipeFix" --status
```

A healthy installation reports:

```text
private_api=ok
accessibility=granted
self_test=pass
runtime=active
```

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
bind permission to the wrong copy. A visible switch is not enough—the menu status
must become **Active**.

#### macOS says the app cannot be opened

The release is signed but not notarized. Control-click the app in Finder, choose
**Open**, and confirm once. Do not disable Gatekeeper globally.

#### The menu says Active, but gestures still do not work

- Confirm the Mac Mouse Fix action is one of the Dock Swipe actions listed above.
- Restore the official Mac Mouse Fix app if another patcher modified it.
- Make sure only one macOS 27 workaround is running.
- Run the status command and include its output, your macOS version, Mac Mouse
  Fix version, and mouse model in a
  [new issue](https://github.com/timmyagentic/mac-mouse-fix-macos-27-fix/issues/new).

### Uninstall

If you installed from source, run this inside the cloned repository:

```bash
./scripts/uninstall.sh
```

The installed app and LaunchAgent are moved to the Trash so the operation is
recoverable.

If you installed the release app manually:

1. Quit it from the menu-bar mouse icon.
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
- No network access
- No input recording or storage
- Only the current active/waiting status is saved locally
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
[#1924](https://github.com/noah-nuebling/mac-mouse-fix/pull/1924): attach the
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

### 使用要求

- macOS 27 或更高版本
- 已安装 Mac Mouse Fix；源码安装脚本要求它位于
  `/Applications/Mac Mouse Fix.app`
- 给 **MMF27 Dock Swipe Fix** 授予“辅助功能”权限
- 如果从源码构建，需要安装 Xcode Command Line Tools

请使用官方、未经修改的 Mac Mouse Fix。如果以前安装过会修改或重新签名 Mac Mouse
Fix 的补丁，请先恢复官方应用。不要同时运行多个 macOS 27 修复方案。

### 安装教程

#### 方式一：下载已经构建好的应用

这是最简单的安装方式。

1. 打开[最新 Release](https://github.com/timmyagentic/mac-mouse-fix-macos-27-fix/releases/latest)。
2. 下载 `MMF27-Dock-Swipe-Fix-0.2.0.app.zip` 和对应的 `.sha256` 文件。
3. 双击 ZIP，解压得到 **MMF27 Dock Swipe Fix.app**。
4. 在访达中选择“前往 > 前往文件夹…”，输入 `~/Applications`，把应用移动进去。
   如果这个文件夹不存在，可以先新建。
5. 按住 Control 点击应用并选择“打开”。Release 使用 Developer ID 签名，但还没有
   经过 Apple 公证，因此第一次普通双击可能会被 macOS 拦截。
6. 打开“系统设置 > 隐私与安全性 > 辅助功能”，启用
   **MMF27 Dock Swipe Fix**。如果列表中没有它，点击 `+` 并选择：
   `~/Applications/MMF27 Dock Swipe Fix.app`。
7. 再次打开应用。菜单栏会出现鼠标图标；当菜单显示
   **Active — low-latency Dock Swipe repair enabled** 时，安装完成。
8. 可选：在“系统设置 > 通用 > 登录项”中添加这个应用，让它登录后自动启动。

Release 页面同时提供 SHA-256 校验文件。可以在终端中验证下载内容：

```bash
cd "$HOME/Downloads"
shasum -a 256 -c MMF27-Dock-Swipe-Fix-0.2.0.app.zip.sha256
```

#### 方式二：从源码构建并自动安装

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

### 验证是否生效

菜单栏状态必须显示 **Active**。也可以运行：

```bash
"$HOME/Applications/MMF27 Dock Swipe Fix.app/Contents/MacOS/MMF27DockSwipeFix" --status
```

正常状态应该包含：

```text
private_api=ok
accessibility=granted
self_test=pass
runtime=active
```

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
看到开关打开并不代表成功，菜单状态必须真正变成 **Active**。

#### macOS 提示无法打开应用

Release 已签名但尚未公证。请在访达中按住 Control 点击应用，选择“打开”，并确认一次。
不建议全局关闭 Gatekeeper。

#### 已经显示 Active，但手势还是不工作

- 确认 Mac Mouse Fix 中配置的是上面列出的 Dock Swipe 功能。
- 如果其他补丁修改过 Mac Mouse Fix，请恢复官方版本。
- 确认系统里只运行一个 macOS 27 修复方案。
- 运行状态检查命令，并把输出、macOS 版本、Mac Mouse Fix 版本和鼠标型号附在
  [新 issue](https://github.com/timmyagentic/mac-mouse-fix-macos-27-fix/issues/new) 中。

### 卸载

如果通过源码安装，请在克隆的仓库目录中运行：

```bash
./scripts/uninstall.sh
```

脚本会把应用和 LaunchAgent 移到废纸篓，仍然可以恢复。

如果手动安装了 Release 应用：

1. 从菜单栏鼠标图标退出应用。
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
- 不访问网络
- 不记录或保存输入内容
- 本地只保存当前 active/waiting 状态
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
探索的更安全方向：通过 `SLEventSetIOHIDEvent` 附加 HID 数据，而不是依赖不稳定的
硬编码 `CGEvent` 内部偏移写入指针。

### 许可证

[MIT](LICENSE)
