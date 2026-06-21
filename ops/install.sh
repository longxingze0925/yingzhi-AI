#!/usr/bin/env bash
set -Eeuo pipefail

SHADOWWEAVE_REPO="${SHADOWWEAVE_REPO:-longxingze0925/yingzhi-AI}"
SHADOWWEAVE_REF="${SHADOWWEAVE_REF:-main}"
SHADOWWEAVE_RAW_BASE="${SHADOWWEAVE_RAW_BASE:-https://raw.githubusercontent.com/${SHADOWWEAVE_REPO}/${SHADOWWEAVE_REF}}"
TARGET_SCRIPT="yingzhictl.sh"

if [[ "${1:-}" == "source" ]]; then
  shift || true
  TARGET_SCRIPT="shadowweavectl.sh"
fi

script_dir=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P || true)"
fi

if [[ -n "$script_dir" && -f "$script_dir/$TARGET_SCRIPT" ]]; then
  exec bash "$script_dir/$TARGET_SCRIPT" "$@"
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

curl -fsSL "$SHADOWWEAVE_RAW_BASE/ops/$TARGET_SCRIPT" -o "$tmp_dir/$TARGET_SCRIPT"
exec bash "$tmp_dir/$TARGET_SCRIPT" "$@"
