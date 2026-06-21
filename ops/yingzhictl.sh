#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="shadowweave"
PROJECT_NAME="${SHADOWWEAVE_PROJECT_NAME:-shadowweave}"
INSTALL_DIR="${SHADOWWEAVE_INSTALL_DIR:-/opt/shadowweave}"
SHADOWWEAVE_REPO="${SHADOWWEAVE_REPO:-longxingze0925/yingzhi-AI}"
SHADOWWEAVE_REF="${SHADOWWEAVE_REF:-main}"
SHADOWWEAVE_RAW_BASE="${SHADOWWEAVE_RAW_BASE:-https://raw.githubusercontent.com/${SHADOWWEAVE_REPO}/${SHADOWWEAVE_REF}}"

ENV_FILE=".env.compose"
STATE_FILE=".install-state"
COMPOSE_FILE="compose.yaml"

WEB_IMAGE="${SHADOWWEAVE_WEB_IMAGE:-ghcr.io/${SHADOWWEAVE_REPO,,}-web:latest}"
BACKEND_IMAGE="${SHADOWWEAVE_BACKEND_IMAGE:-ghcr.io/${SHADOWWEAVE_REPO,,}-backend:latest}"
HTTP_PORT="${SHADOWWEAVE_HTTP_PORT:-80}"
ENTITLEHUB_BASE_URL="${ENTITLEHUB_BASE_URL:-https://ht.0000.icu}"
ENTITLEHUB_SERVER_KEY="${ENTITLEHUB_SERVER_KEY:-}"
ENTITLEHUB_MOCK="${ENTITLEHUB_MOCK:-}"
GHCR_USERNAME="${GHCR_USERNAME:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"

log() {
  printf '\n==> %s\n' "$*"
}

warn() {
  printf '警告：%s\n' "$*" >&2
}

die() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

pause() {
  printf '\n按 Enter 继续...'
  read -r _ || true
}

confirm() {
  local prompt="$1"
  local answer
  printf '%s [y/N]: ' "$prompt"
  if ! read -r answer; then
    return 1
  fi
  [[ "$answer" == "y" || "$answer" == "Y" || "$answer" == "yes" || "$answer" == "YES" || "$answer" == "是" ]]
}

ask() {
  local prompt="$1"
  local default="${2:-}"
  local value
  if [[ ! -t 0 ]]; then
    printf '%s' "$default"
    return
  fi
  if [[ -n "$default" ]]; then
    printf '%s [%s]: ' "$prompt" "$default" >&2
  else
    printf '%s: ' "$prompt" >&2
  fi
  read -r value || value=""
  if [[ -z "$value" ]]; then
    printf '%s' "$default"
  else
    printf '%s' "$value"
  fi
}

ask_secret_optional() {
  local prompt="$1"
  local value
  if [[ ! -t 0 ]]; then
    printf ''
    return
  fi
  printf '%s: ' "$prompt" >&2
  read -r -s value || value=""
  printf '\n' >&2
  printf '%s' "$value"
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "此操作需要 root 权限，请使用 sudo 或 root 重新运行。"
  fi
  if [[ -z "$INSTALL_DIR" || "$INSTALL_DIR" == "/" || "$INSTALL_DIR" == "/opt" || "$INSTALL_DIR" == "/usr" || "$INSTALL_DIR" == "/var" ]]; then
    die "安装目录不安全：$INSTALL_DIR"
  fi
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "缺少必需命令：$1"
}

is_installed() {
  [[ -f "$INSTALL_DIR/$COMPOSE_FILE" && -f "$INSTALL_DIR/$ENV_FILE" ]]
}

legacy_is_installed() {
  [[ -f "$INSTALL_DIR/docker-compose.yml" && -f "$INSTALL_DIR/.env" ]]
}

migrate_legacy_install() {
  if is_installed || ! legacy_is_installed; then
    return
  fi
  log "检测到旧版镜像安装目录，迁移配置文件名"
  cp "$INSTALL_DIR/docker-compose.yml" "$INSTALL_DIR/$COMPOSE_FILE"
  cp "$INSTALL_DIR/.env" "$INSTALL_DIR/$ENV_FILE"
  chmod 600 "$INSTALL_DIR/$ENV_FILE" || true
}

in_install_dir() {
  cd "$INSTALL_DIR"
}

compose_base() {
  in_install_dir
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

get_env_value() {
  local key="$1"
  local file="${2:-$INSTALL_DIR/$ENV_FILE}"
  [[ -f "$file" ]] || return 1
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$file"
}

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { done = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      done = 1
      next
    }
    { print }
    END {
      if (!done) print key "=" value
    }
  ' "$file" > "$tmp"
  cat "$tmp" > "$file"
  rm -f "$tmp"
}

install_docker_prompt() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  warn "未检测到 Docker 或 Docker Compose 插件。"
  if confirm "是否现在使用 Docker 官方脚本安装？"; then
    require_command curl
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker >/dev/null 2>&1 || true
  else
    die "请先安装 Docker 和 Docker Compose 插件，然后重新运行安装器。"
  fi
}

preflight() {
  require_root
  require_command curl
  install_docker_prompt
  docker version >/dev/null
  docker compose version >/dev/null
}

download_deploy_files() {
  mkdir -p "$INSTALL_DIR"
  curl -fsSL "$SHADOWWEAVE_RAW_BASE/deploy/docker-compose.yml" -o "$INSTALL_DIR/$COMPOSE_FILE"
  curl -fsSL "$SHADOWWEAVE_RAW_BASE/deploy/nginx.conf" -o "$INSTALL_DIR/nginx.conf"
  curl -fsSL "$SHADOWWEAVE_RAW_BASE/ops/yingzhictl.sh" -o "$INSTALL_DIR/yingzhictl.sh"
  curl -fsSL "$SHADOWWEAVE_RAW_BASE/ops/update-image.sh" -o "$INSTALL_DIR/update-image.sh"
  chmod +x "$INSTALL_DIR/yingzhictl.sh" "$INSTALL_DIR/update-image.sh"
}

resolve_entitlehub_mode() {
  if [[ -z "$ENTITLEHUB_SERVER_KEY" && -t 0 && "${ENTITLEHUB_MOCK,,}" != "true" && "${ENTITLEHUB_MOCK}" != "1" ]]; then
    ENTITLEHUB_SERVER_KEY="$(ask_secret_optional 'EntitleHub Server Key，留空则使用 mock 模式')"
  fi

  if [[ -z "$ENTITLEHUB_MOCK" ]]; then
    if [[ -n "$ENTITLEHUB_SERVER_KEY" ]]; then
      ENTITLEHUB_MOCK="false"
    else
      ENTITLEHUB_MOCK="true"
    fi
  fi
}

write_env_file() {
  resolve_entitlehub_mode
  HTTP_PORT="$(ask 'HTTP 端口' "$HTTP_PORT")"
  umask 077
  cat > "$INSTALL_DIR/$ENV_FILE" <<EOF
SHADOWWEAVE_WEB_IMAGE=${WEB_IMAGE}
SHADOWWEAVE_BACKEND_IMAGE=${BACKEND_IMAGE}
SHADOWWEAVE_HTTP_PORT=${HTTP_PORT}
ENTITLEHUB_BASE_URL=${ENTITLEHUB_BASE_URL}
ENTITLEHUB_SERVER_KEY=${ENTITLEHUB_SERVER_KEY}
ENTITLEHUB_MOCK=${ENTITLEHUB_MOCK}
SHADOWWEAVE_SESSION_COOKIE=${SHADOWWEAVE_SESSION_COOKIE:-shadowweave_session}
SHADOWWEAVE_SESSION_TTL_SECONDS=${SHADOWWEAVE_SESSION_TTL_SECONDS:-604800}
EOF
}

write_state() {
  cat > "$INSTALL_DIR/$STATE_FILE" <<EOF
INSTALLED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SOURCE_REF=${SHADOWWEAVE_REF}
HTTP_PORT=${HTTP_PORT}
EOF
  chmod 600 "$INSTALL_DIR/$STATE_FILE"
}

docker_login_if_needed() {
  if [[ -n "$GHCR_USERNAME" && -n "$GHCR_TOKEN" ]]; then
    log "登录 ghcr.io"
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
  else
    warn "未提供 GHCR 登录信息；镜像必须是 public，或服务器已提前 docker login。"
  fi
}

pull_images() {
  log "拉取镜像"
  compose_base pull
}

start_stack() {
  log "启动服务"
  compose_base up -d --remove-orphans
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-60}"
  local i
  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      printf '%s 已就绪。\n' "$name"
      return 0
    fi
    sleep 3
  done
  return 1
}

diagnose_stack() {
  warn "服务未通过健康检测，输出最近日志用于定位。"
  compose_base ps || true
  compose_base logs --tail=120 backend || true
  compose_base logs --tail=120 web || true
  compose_base logs --tail=120 nginx || true
}

run_smoke() {
  log "运行冒烟检测"
  local port
  port="$(get_env_value SHADOWWEAVE_HTTP_PORT || printf '%s' "$HTTP_PORT")"
  compose_base ps
  if ! wait_for_http "http://127.0.0.1:${port}/healthz" "影织后端健康检查" 60; then
    diagnose_stack
    die "影织后端健康检查失败。"
  fi
  if ! wait_for_http "http://127.0.0.1:${port}/" "影织前端" 40; then
    diagnose_stack
    die "影织前端检查失败。"
  fi
}

smoke_flow() {
  require_root
  migrate_legacy_install
  is_installed || die "尚未安装。"
  run_smoke
}

install_flow() {
  preflight
  download_deploy_files
  write_env_file
  docker_login_if_needed
  pull_images
  start_stack
  write_state
  run_smoke
  log "安装完成"
  printf '安装目录：%s\n' "$INSTALL_DIR"
  printf '访问地址：http://服务器IP:%s\n' "$(get_env_value SHADOWWEAVE_HTTP_PORT)"
}

update_flow() {
  preflight
  migrate_legacy_install
  is_installed || die "尚未安装，请先执行安装。"
  download_deploy_files
  docker_login_if_needed
  pull_images
  start_stack
  run_smoke
  log "更新完成"
}

restart_flow() {
  require_root
  migrate_legacy_install
  is_installed || die "尚未安装。"
  compose_base restart
  run_smoke
}

status_flow() {
  require_root
  migrate_legacy_install
  is_installed || die "尚未安装。"
  compose_base ps
}

logs_flow() {
  require_root
  migrate_legacy_install
  is_installed || die "尚未安装。"
  local service="${1:-}"
  if [[ -n "$service" ]]; then
    compose_base logs --tail=200 -f "$service"
  else
    compose_base logs --tail=200 -f
  fi
}

change_key_flow() {
  require_root
  migrate_legacy_install
  is_installed || die "尚未安装。"
  local key mock
  key="$(ask_secret_optional '新的 EntitleHub Server Key，留空则切换 mock 模式')"
  if [[ -n "$key" ]]; then
    mock="false"
  else
    mock="true"
  fi
  set_env_value "$INSTALL_DIR/$ENV_FILE" ENTITLEHUB_SERVER_KEY "$key"
  set_env_value "$INSTALL_DIR/$ENV_FILE" ENTITLEHUB_MOCK "$mock"
  compose_base up -d --force-recreate backend
  run_smoke
}

uninstall_flow() {
  require_root
  migrate_legacy_install
  is_installed || die "尚未安装。"
  if confirm "确认停止并删除影织容器？镜像和安装目录默认保留"; then
    compose_base down --remove-orphans
  fi
}

main_menu() {
  while true; do
    printf '\n%s 一键安装 / 运维\n' "$APP_NAME"
    printf '安装目录：%s\n' "$INSTALL_DIR"
    migrate_legacy_install
    if is_installed; then
      cat <<'EOF'
1) 更新
2) 查看状态
3) 查看日志
4) 重启服务
5) 修改 EntitleHub Server Key
6) 运行健康检测
7) 卸载
0) 退出
EOF
      printf '请选择: '
      read -r choice
      case "$choice" in
        1) update_flow; pause ;;
        2) status_flow; pause ;;
        3) logs_flow ;;
        4) restart_flow; pause ;;
        5) change_key_flow; pause ;;
        6) smoke_flow; pause ;;
        7) uninstall_flow; pause ;;
        0) exit 0 ;;
        *) warn "未知选项。" ;;
      esac
    else
      cat <<'EOF'
1) 安装
0) 退出
EOF
      printf '请选择: '
      read -r choice
      case "$choice" in
        1) install_flow; pause ;;
        0) exit 0 ;;
        *) warn "未知选项。" ;;
      esac
    fi
  done
}

case "${1:-menu}" in
  install) install_flow ;;
  update) update_flow ;;
  restart) restart_flow ;;
  status) status_flow ;;
  logs) shift || true; logs_flow "$@" ;;
  smoke) smoke_flow ;;
  change-key) change_key_flow ;;
  uninstall) uninstall_flow ;;
  menu) if [[ -t 0 ]]; then main_menu; else install_flow; fi ;;
  -h|--help|help) main_menu ;;
  *) die "未知命令：$1" ;;
esac
