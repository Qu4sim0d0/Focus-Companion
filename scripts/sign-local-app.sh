#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_APP_PATH="$ROOT_DIR/src-tauri/target/release/bundle/macos/Focus Companion.app"
APP_PATH="${1:-$DEFAULT_APP_PATH}"

log() {
  printf '%s\n' "$1"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "缺少命令：$cmd"
    exit 1
  fi
}

require_cmd codesign

if [ ! -d "$APP_PATH" ]; then
  log "未找到应用包：$APP_PATH"
  log "请先运行：npm run tauri:build"
  exit 1
fi

log "为本机运行追加 ad-hoc 签名..."
codesign --force --deep --sign - "$APP_PATH"

log "校验签名..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

log "完成：$APP_PATH"
log "如需打开，可执行：open \"$APP_PATH\""
