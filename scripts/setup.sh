#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '%s\n' "$1"
}

ensure_cargo_path() {
  if command -v cargo >/dev/null 2>&1; then
    return 0
  fi

  if [ -f "$HOME/.cargo/env" ]; then
    # Load Rustup's shell setup so cargo is available in non-login shells.
    # shellcheck disable=SC1090
    source "$HOME/.cargo/env"
  fi

  if [ -d "$HOME/.cargo/bin" ]; then
    export PATH="$HOME/.cargo/bin:$PATH"
  fi
}

require_cmd() {
  local cmd="$1"
  local install_hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "缺少依赖：$cmd"
    log "$install_hint"
    exit 1
  fi
}

log "检查运行环境..."
require_cmd node "请先安装 Node.js 20.19+ 或 22.12+。"
require_cmd npm "Node.js 安装后应自带 npm。"
ensure_cargo_path
require_cmd cargo "请先安装 Rust 与 Cargo。"
require_cmd xcode-select "请先安装 Xcode Command Line Tools。"

if ! xcode-select -p >/dev/null 2>&1; then
  log "Xcode Command Line Tools 未安装。"
  log "请运行：xcode-select --install"
  exit 1
fi

NODE_VERSION="$(node --version | sed 's/^v//')"
log "Node.js 版本：$NODE_VERSION"
log "Cargo 位置：$(command -v cargo)"

log "安装项目依赖..."
cd "$ROOT_DIR"
npm install

log "完成。若 tauri dev 仍提示 cargo 找不到，请执行：source \"$HOME/.cargo/env\""
log "接下来可以运行：npm run tauri:dev"
