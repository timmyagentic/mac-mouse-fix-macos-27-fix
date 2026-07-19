#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_APP="$PROJECT_DIR/build/MMF27 Dock Swipe Fix.app"
INSTALL_ROOT="$HOME/Applications"
INSTALL_APP="$INSTALL_ROOT/MMF27 Dock Swipe Fix.app"
SUPPORT_ROOT="$HOME/Library/Application Support/MMF27 Dock Swipe Fix"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/local.timmy.mmf27-dock-swipe-fix.plist"
LABEL="local.timmy.mmf27-dock-swipe-fix"
GUI_DOMAIN="gui/$(id -u)"

major="$(sw_vers -productVersion | awk -F. '{print $1}')"
if [[ ! "$major" =~ ^[0-9]+$ ]] || (( major < 27 )); then
  echo "error: this repair is only intended for macOS 27 or later" >&2
  exit 1
fi

if [[ ! -d "/Applications/Mac Mouse Fix.app" ]]; then
  echo "error: Mac Mouse Fix is not installed in /Applications" >&2
  exit 1
fi

"$SCRIPT_DIR/build.sh"

launchctl bootout "$GUI_DOMAIN/$LABEL" >/dev/null 2>&1 || true

mkdir -p "$INSTALL_ROOT" "$SUPPORT_ROOT/Backups" "$HOME/Library/LaunchAgents"
if [[ -e "$INSTALL_APP" ]]; then
  stamp="$(date +%Y%m%d-%H%M%S)"
  # Do not leave additional .app bundles with the same identifier on disk.
  # LaunchServices/TCC can otherwise bind Accessibility permission to a backup
  # instead of the installed copy.
  backup="$SUPPORT_ROOT/Backups/$stamp-MMF27 Dock Swipe Fix.app.backup"
  mv "$INSTALL_APP" "$backup"
  echo "Previous repair app backed up to: $backup"
fi

ditto "$SOURCE_APP" "$INSTALL_APP"
codesign --verify --deep --strict "$INSTALL_APP"
"$INSTALL_APP/Contents/MacOS/MMF27DockSwipeFix" --self-test

if [[ -e "$LAUNCH_AGENT" ]]; then
  stamp="$(date +%Y%m%d-%H%M%S)"
  cp "$LAUNCH_AGENT" "$SUPPORT_ROOT/Backups/$stamp-launch-agent.plist"
fi

cat > "$LAUNCH_AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$INSTALL_APP/Contents/MacOS/MMF27DockSwipeFix</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Interactive</string>
  <key>StandardOutPath</key>
  <string>$SUPPORT_ROOT/plugin.log</string>
  <key>StandardErrorPath</key>
  <string>$SUPPORT_ROOT/plugin.log</string>
</dict>
</plist>
PLIST

plutil -lint "$LAUNCH_AGENT" >/dev/null
launchctl bootstrap "$GUI_DOMAIN" "$LAUNCH_AGENT"
launchctl kickstart -k "$GUI_DOMAIN/$LABEL"
sleep 2

echo
echo "Installed: $INSTALL_APP"
echo "The mouse icon appears during startup or when attention is needed."
echo "When runtime=active it hides automatically unless Always Show is enabled."
echo "To reopen its controls later, run: open \"$INSTALL_APP\""
echo "If macOS asks, approve MMF27 Dock Swipe Fix under:"
echo "System Settings > Privacy & Security > Accessibility"
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility" >/dev/null 2>&1 || true
