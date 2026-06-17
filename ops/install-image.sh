#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="shadowweave"
SHADOWWEAVE_REPO="${SHADOWWEAVE_REPO:-longxingze0925/yingzhi-AI}"
SHADOWWEAVE_REF="${SHADOWWEAVE_REF:-main}"
SHADOWWEAVE_RAW_BASE="${SHADOWWEAVE_RAW_BASE:-https://raw.githubusercontent.com/${SHADOWWEAVE_REPO}/${SHADOWWEAVE_REF}}"
INSTALL_DIR="${SHADOWWEAVE_INSTALL_DIR:-/opt/shadowweave}"
WEB_IMAGE="${SHADOWWEAVE_WEB_IMAGE:-ghcr.io/${SHADOWWEAVE_REPO,,}-web:latest}"
BACKEND_IMAGE="${SHADOWWEAVE_BACKEND_IMAGE:-ghcr.io/${SHADOWWEAVE_REPO,,}-backend:latest}"
HTTP_PORT="${SHADOWWEAVE_HTTP_PORT:-80}"
ENTITLEHUB_BASE_URL="${ENTITLEHUB_BASE_URL:-https://ht.0000.icu}"
ENTITLEHUB_SERVER_KEY="${ENTITLEHUB_SERVER_KEY:-}"
ENTITLEHUB_MOCK="${ENTITLEHUB_MOCK:-}"
GHCR_USERNAME="${GHCR_USERNAME:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"

log() {
  printf '[%s] %s\n' "$APP_NAME" "$*"
}

die() {
  printf '[%s] ERROR: %s\n' "$APP_NAME" "$*" >&2
  exit 1
}

need_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "please run as root, for example: sudo bash ops/install-image.sh"
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "docker is ready"
    return
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    die "only Debian/Ubuntu apt-based servers are supported by this installer"
  fi

  log "installing Docker"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  local repo_os="${ID}"
  if [[ "$repo_os" == "debian" ]]; then
    printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian %s stable\n' \
      "$(dpkg --print-architecture)" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
  else
    printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
      "$(dpkg --print-architecture)" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
  fi
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

download_deploy_files() {
  mkdir -p "$INSTALL_DIR"
  curl -fsSL "$SHADOWWEAVE_RAW_BASE/deploy/docker-compose.yml" -o "$INSTALL_DIR/docker-compose.yml"
  curl -fsSL "$SHADOWWEAVE_RAW_BASE/deploy/nginx.conf" -o "$INSTALL_DIR/nginx.conf"
  curl -fsSL "$SHADOWWEAVE_RAW_BASE/ops/update-image.sh" -o "$INSTALL_DIR/update-image.sh"
  chmod +x "$INSTALL_DIR/update-image.sh"
}

resolve_entitlehub_mode() {
  if [[ -z "$ENTITLEHUB_SERVER_KEY" && -t 0 && "${ENTITLEHUB_MOCK,,}" != "true" && "${ENTITLEHUB_MOCK}" != "1" ]]; then
    printf 'EntitleHub Server Key (leave empty to install mock mode): '
    read -r -s ENTITLEHUB_SERVER_KEY
    printf '\n'
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
  umask 077
  cat >"$INSTALL_DIR/.env" <<EOF
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

docker_login_if_needed() {
  if [[ -n "$GHCR_USERNAME" && -n "$GHCR_TOKEN" ]]; then
    log "logging in to ghcr.io"
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
  else
    log "skipping ghcr.io login; images must be public or already logged in"
  fi
}

start_stack() {
  log "pulling images"
  docker compose --env-file "$INSTALL_DIR/.env" -f "$INSTALL_DIR/docker-compose.yml" pull
  log "starting containers"
  docker compose --env-file "$INSTALL_DIR/.env" -f "$INSTALL_DIR/docker-compose.yml" up -d
}

smoke_test() {
  log "checking stack"
  docker compose --env-file "$INSTALL_DIR/.env" -f "$INSTALL_DIR/docker-compose.yml" ps
  curl -fsS "http://127.0.0.1:${HTTP_PORT}/healthz" >/dev/null
  curl -fsS -I "http://127.0.0.1:${HTTP_PORT}/" >/dev/null
}

install_app() {
  need_root
  install_docker
  download_deploy_files
  write_env_file
  docker_login_if_needed
  start_stack
  smoke_test
  log "installation complete"
  log "compose dir: $INSTALL_DIR"
  log "open: http://127.0.0.1:${HTTP_PORT}"
}

install_app "$@"
