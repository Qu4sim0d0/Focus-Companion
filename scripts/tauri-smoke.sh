#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="$ROOT_DIR/src-tauri/target/release/bundle/macos/Focus Companion.app"
PLIST_PATH="$APP_PATH/Contents/Info.plist"

cd "$ROOT_DIR"

echo "Checking Tauri Cargo metadata..."
cargo metadata --manifest-path src-tauri/Cargo.toml --no-deps --format-version 1 >/dev/null

echo "Building frontend..."
npm run build

if [ "${TAURI_SMOKE_BUILD:-0}" = "1" ]; then
  echo "Building Tauri app bundle..."
  npm run tauri:build
  npm run tauri:sign-local
fi

if [ -d "$APP_PATH" ]; then
  echo "Checking macOS app bundle..."
  test -f "$PLIST_PATH"
  EXECUTABLE_NAME="$(/usr/libexec/PlistBuddy -c "Print :CFBundleExecutable" "$PLIST_PATH")"
  test -n "$EXECUTABLE_NAME"
  test -x "$APP_PATH/Contents/MacOS/$EXECUTABLE_NAME"
else
  echo "No release .app bundle found. Set TAURI_SMOKE_BUILD=1 to build and validate it."
fi

echo "Tauri smoke checks passed."
