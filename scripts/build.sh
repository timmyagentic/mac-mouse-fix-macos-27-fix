#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/build"
APP_NAME="MMF27 Dock Swipe Fix.app"
APP_PATH="$BUILD_DIR/$APP_NAME"
EXECUTABLE="$APP_PATH/Contents/MacOS/MMF27DockSwipeFix"
SIGNING_IDENTITY="${MMF27_SIGNING_IDENTITY:--}"

command -v xcrun >/dev/null 2>&1 || { echo "error: xcrun is required" >&2; exit 1; }
command -v codesign >/dev/null 2>&1 || { echo "error: codesign is required" >&2; exit 1; }

if [[ -e "$APP_PATH" ]]; then
  rm -rf "$APP_PATH"
fi
mkdir -p "$APP_PATH/Contents/MacOS"
cp "$PROJECT_DIR/resources/Info.plist" "$APP_PATH/Contents/Info.plist"

xcrun clang \
  -arch arm64 -arch x86_64 \
  -fobjc-arc -fmodules \
  -mmacosx-version-min=12.0 \
  -Wall -Wextra -Werror \
  "$PROJECT_DIR/src/main.m" \
  -framework AppKit \
  -framework ApplicationServices \
  -framework CoreGraphics \
  -framework Foundation \
  -o "$EXECUTABLE"

codesign --force --sign "$SIGNING_IDENTITY" --timestamp=none --options runtime "$APP_PATH"
codesign --verify --deep --strict "$APP_PATH"
plutil -lint "$APP_PATH/Contents/Info.plist" >/dev/null

echo "Built: $APP_PATH"
echo "Signed with: $SIGNING_IDENTITY"
"$EXECUTABLE" --self-test
