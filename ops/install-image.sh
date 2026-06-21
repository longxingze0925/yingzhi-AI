#!/usr/bin/env bash
set -Eeuo pipefail

SHADOWWEAVE_REPO="${SHADOWWEAVE_REPO:-longxingze0925/yingzhi-AI}"
SHADOWWEAVE_REF="${SHADOWWEAVE_REF:-main}"
SHADOWWEAVE_RAW_BASE="${SHADOWWEAVE_RAW_BASE:-https://raw.githubusercontent.com/${SHADOWWEAVE_REPO}/${SHADOWWEAVE_REF}}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

curl -fsSL "$SHADOWWEAVE_RAW_BASE/ops/yingzhictl.sh" -o "$tmp_dir/yingzhictl.sh"
exec bash "$tmp_dir/yingzhictl.sh" install "$@"
