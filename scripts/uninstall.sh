#!/bin/bash
set -euo pipefail

INSTALL_APP="$HOME/Applications/MMF27 Dock Swipe Fix.app"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/local.timmy.mmf27-dock-swipe-fix.plist"
LABEL="local.timmy.mmf27-dock-swipe-fix"
GUI_DOMAIN="gui/$(id -u)"
STAMP="$(date +%Y%m%d-%H%M%S)"
TRASH_DIR="$HOME/.Trash/MMF27 Dock Swipe Fix Uninstall $STAMP"

launchctl bootout "$GUI_DOMAIN/$LABEL" >/dev/null 2>&1 || true
mkdir -p "$TRASH_DIR"

if [[ -e "$INSTALL_APP" ]]; then
  mv "$INSTALL_APP" "$TRASH_DIR/"
fi
if [[ -e "$LAUNCH_AGENT" ]]; then
  mv "$LAUNCH_AGENT" "$TRASH_DIR/"
fi

echo "Uninstalled. Recoverable files were moved to: $TRASH_DIR"
