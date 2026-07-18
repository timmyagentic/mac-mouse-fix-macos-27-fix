# MMF27 Dock Swipe Fix

An unofficial, installable companion repair for Mac Mouse Fix on macOS 27.

> [!IMPORTANT]
> This is an independent compatibility project. It is not affiliated with or
> endorsed by Mac Mouse Fix or Apple.

It restores the Dock Swipe actions used by:

- Spaces & Mission Control
- Application Windows
- Move Between Spaces
- Desktop & Launchpad

Unlike patchers that replace gestures with keyboard shortcuts, this repair keeps
Mac Mouse Fix's continuous gesture events and animations. It watches only the
synthetic Dock Swipe event type emitted by Mac Mouse Fix, adds the raw HID payload
required by macOS 27, and returns the event to the system.

Version 0.2 repairs the direction-dependent release rebound found in screen-recording
analysis. It normalizes both progress and exit velocity, preserves the source event's
timestamp, and runs the synchronous event tap on a dedicated `userInteractive` thread
instead of the menu-bar application's main thread.

The implementation combines the verified direction used by upstream PRs
[#1916](https://github.com/noah-nuebling/mac-mouse-fix/pull/1916),
[#1920](https://github.com/noah-nuebling/mac-mouse-fix/pull/1920), and
[#1924](https://github.com/noah-nuebling/mac-mouse-fix/pull/1924): use Apple's
`SLEventSetIOHIDEvent` instead of writing an HID pointer through unstable,
hard-coded `CGEvent` offsets.

## Why a companion app?

Mac Mouse Fix has no plugin API. Injecting a dylib into its Helper would invalidate
the original Developer ID signature and usually reset its Accessibility permission.
This project instead runs a tiny menu-bar companion app with its own permission. It
does not modify, re-sign, or replace Mac Mouse Fix.

## Install

### Release download

Download `MMF27-Dock-Swipe-Fix-0.2.0.app.zip` from the latest GitHub Release,
extract it, move **MMF27 Dock Swipe Fix.app** to `~/Applications`, and open it.
Approve the app under **System Settings > Privacy & Security > Accessibility**
when prompted. Add it under **System Settings > General > Login Items** if you
want it to start automatically after login.

The release app is Developer ID signed. Its SHA-256 checksum is published next
to the download. It is not notarized, so macOS may require you to Control-click
the app and choose **Open** the first time.

### Build from source

From this directory:

```bash
./scripts/install.sh
```

The installer:

1. Builds a universal Apple Silicon + Intel app using the installed Xcode tools.
2. Runs a non-disruptive HID payload self-test.
3. Installs the app under `~/Applications`.
4. Adds a per-user LaunchAgent so it starts at login.
5. Opens Accessibility settings for the one required approval.

By default the local build is ad-hoc signed. Set `MMF27_SIGNING_IDENTITY` to an
installed code-signing identity to keep a stable Accessibility code requirement
across future rebuilds:

```bash
MMF27_SIGNING_IDENTITY="Developer ID Application: Example (TEAMID)" ./scripts/install.sh
```

After approving **MMF27 Dock Swipe Fix**, the menu-bar mouse icon should say
`Active — Dock Swipe repair enabled`.

Diagnostic status can also be checked with:

```bash
"$HOME/Applications/MMF27 Dock Swipe Fix.app/Contents/MacOS/MMF27DockSwipeFix" --status
```

## Uninstall

```bash
./scripts/uninstall.sh
```

The app and LaunchAgent are moved to the Trash so the operation is recoverable.

## Security and scope

- No administrator privileges.
- No changes to `/Applications/Mac Mouse Fix.app`.
- No network access.
- No input recording or storage; only the current active/waiting status is saved.
- Only event type 30 with Mac Mouse Fix's Dock Swipe subtype is modified.
- Uses private SkyLight/HID APIs and is therefore intentionally limited to this
  temporary macOS 27 compatibility repair.

## Current compatibility

Designed and self-tested on macOS 27 with Mac Mouse Fix 3.1.0 Beta 1. The legacy
event format is shared with Mac Mouse Fix 3.0.x.

This should be removed once Mac Mouse Fix ships an official release containing the
upstream fix.

## 中文说明

这是一个 macOS 27 专用的 Mac Mouse Fix 伴随修复程序。它不会修改或重新签名
Mac Mouse Fix，而是给 Mac Mouse Fix 发出的 Dock Swipe 事件补上 macOS 27 新要求的
HID 数据，从而恢复 Mission Control、切换桌面、显示桌面和 Launchpad 手势。

安装：

```bash
./scripts/install.sh
```

安装后需要在“系统设置 > 隐私与安全性 > 辅助功能”里批准
**MMF27 Dock Swipe Fix**。菜单栏的鼠标图标显示 `Active` 后即已生效。

卸载：

```bash
./scripts/uninstall.sh
```
