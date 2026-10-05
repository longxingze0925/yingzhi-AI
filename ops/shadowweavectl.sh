#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="shadowweave"
WEB_SERVICE="shadowweave-web"

SHADOWWEAVE_REPO="${SHADOWWEAVE_REPO:-longxingze0925/yingzhi-AI}"
SHADOWWEAVE_REF="${SHADOWWEAVE_REF:-main}"
INSTALL_DIR="${SHADOWWEAVE_INSTALL_DIR:-/opt/shadowweave}"
CONFIG_DIR="${SHADOWWEAVE_CONFIG_DIR:-/etc/shadowweave}"
STATE_DIR="${SHADOWWEAVE_STATE_DIR:-/var/lib/shadowweave}"
SERVICE_USER="${SHADOWWEAVE_USER:-shadowweave}"
FRONTEND_HOST="${SHADOWWEAVE_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${SHADOWWEAVE_FRONTEND_PORT:-3000}"
PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE_URL:-/api}"
DEMO_FALLBACK="${NEXT_PUBLIC_DEMO_FALLBACK:-0}"
NEW_API_UPSTREAM="${NEW_API_UPSTREAM:-https://new.0000.icu}"
NEW_API_HOST="${NEW_API_HOST:-}"
DOMAIN="${SHADOWWEAVE_DOMAIN:-_}"
SKIP_NGINX="${SHADOWWEAVE_SKIP_NGINX:-0}"

log() {
  printf '[%s] %s\n' "$APP_NAME" "$*"
}

die() {
  printf '[%s] ERROR: %s\n' "$APP_NAME" "$*" >&2
  exit 1
}

need_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "please run as root, for example: sudo bash ops/install.sh"
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

apt_install_base() {
  require_cmd apt-get
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  local packages=(ca-certificates curl git build-essential pkg-config)
  if [[ "$SKIP_NGINX" != "1" && "${SKIP_NGINX,,}" != "true" ]]; then
    packages+=(nginx)
  fi
  apt-get install -y "${packages[@]}"
}

node_major() {
  if ! command -v node >/dev/null 2>&1; then
    printf '0'
    return
  fi
  node -v | sed -E 's/^v([0-9]+).*/\1/'
}

install_node() {
  local major
  major="$(node_major)"
  if [[ "$major" -ge 20 ]]; then
    log "node $(node -v) is ready"
    return
  fi

  log "installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}

ensure_toolchain() {
  if ! command -v apt-get >/dev/null 2>&1; then
    die "only Debian/Ubuntu apt-based servers are supported by this installer"
  fi

  apt_install_base
  install_node
  require_cmd npm
  require_cmd git
  require_cmd systemctl
}

ensure_user() {
  if id "$SERVICE_USER" >/dev/null 2>&1; then
    return
  fi
  useradd --system --create-home --home-dir "$STATE_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
}

clone_or_update_repo() {
  mkdir -p "$(dirname "$INSTALL_DIR")"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    log "updating source in $INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch --depth 1 origin "$SHADOWWEAVE_REF"
    git -C "$INSTALL_DIR" checkout --force FETCH_HEAD
  elif [[ -e "$INSTALL_DIR" && -n "$(find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 2>/dev/null)" ]]; then
    die "$INSTALL_DIR exists and is not an empty git checkout"
  else
    log "cloning $SHADOWWEAVE_REPO#$SHADOWWEAVE_REF into $INSTALL_DIR"
    git clone --depth 1 --branch "$SHADOWWEAVE_REF" "https://github.com/${SHADOWWEAVE_REPO}.git" "$INSTALL_DIR"
  fi
}

normalize_new_api_settings() {
  NEW_API_UPSTREAM="${NEW_API_UPSTREAM%/}"
  [[ "$NEW_API_UPSTREAM" == http://* || "$NEW_API_UPSTREAM" == https://* ]] || die "NEW_API_UPSTREAM must start with http:// or https://"
  if [[ -z "$NEW_API_HOST" ]]; then
    NEW_API_HOST="${NEW_API_UPSTREAM#*://}"
    NEW_API_HOST="${NEW_API_HOST%%/*}"
  fi
  [[ -n "$NEW_API_HOST" && "$NEW_API_HOST" != *[[:space:]/]* ]] || die "NEW_API_HOST is invalid"
}

write_env_files() {
  normalize_new_api_settings
  mkdir -p "$CONFIG_DIR"
  chmod 750 "$CONFIG_DIR"

  cat >"$CONFIG_DIR/web.env" <<EOF
NODE_ENV=production
PORT=${FRONTEND_PORT}
HOSTNAME=${FRONTEND_HOST}
NEXT_PUBLIC_API_BASE_URL=${PUBLIC_API_BASE}
NEXT_PUBLIC_DEMO_FALLBACK=${DEMO_FALLBACK}
EOF

  cat >"$INSTALL_DIR/.env.production" <<EOF
NEXT_PUBLIC_API_BASE_URL=${PUBLIC_API_BASE}
NEXT_PUBLIC_DEMO_FALLBACK=${DEMO_FALLBACK}
EOF

  chmod 640 "$CONFIG_DIR/web.env" "$INSTALL_DIR/.env.production"
}

build_app() {
  log "installing frontend dependencies"
  (cd "$INSTALL_DIR" && npm ci)

  log "building frontend"
  (cd "$INSTALL_DIR" && npm run build)
}

write_systemd_units() {
  cat >"/etc/systemd/system/${WEB_SERVICE}.service" <<EOF
[Unit]
Description=Shadowweave Next.js frontend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${CONFIG_DIR}/web.env
ExecStart=/usr/bin/npm run start -- -H ${FRONTEND_HOST} -p ${FRONTEND_PORT}
Restart=always
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
}

write_nginx_site() {
  if [[ "$SKIP_NGINX" == "1" || "${SKIP_NGINX,,}" == "true" ]]; then
    log "skipping nginx configuration"
    return
  fi
  normalize_new_api_settings

  cat >"/etc/nginx/sites-available/shadowweave.conf" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 64m;

    proxy_http_version 1.1;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    location /api/ {
        proxy_pass ${NEW_API_UPSTREAM};
        proxy_set_header Host ${NEW_API_HOST};
        proxy_ssl_server_name on;
        proxy_ssl_name ${NEW_API_HOST};
    }

    location = /healthz {
        access_log off;
        default_type text/plain;
        return 200 "ok\n";
    }

    location / {
        proxy_set_header Host \$host;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_pass http://${FRONTEND_HOST}:${FRONTEND_PORT};
    }
}
EOF

  ln -sfn /etc/nginx/sites-available/shadowweave.conf /etc/nginx/sites-enabled/shadowweave.conf
  nginx -t
}

fix_permissions() {
  mkdir -p "$STATE_DIR"
  chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" "$CONFIG_DIR" "$STATE_DIR"
}

start_services() {
  systemctl daemon-reload
  systemctl enable --now "$WEB_SERVICE"

  if [[ "$SKIP_NGINX" != "1" && "${SKIP_NGINX,,}" != "true" ]]; then
    systemctl enable --now nginx
    systemctl reload nginx
  fi
}

smoke_test() {
  normalize_new_api_settings
  log "checking New API upstream"
  curl -fsS "${NEW_API_UPSTREAM}/api/status" >/dev/null

  log "checking frontend"
  curl -fsS -I "http://${FRONTEND_HOST}:${FRONTEND_PORT}" >/dev/null

  if [[ "$SKIP_NGINX" != "1" && "${SKIP_NGINX,,}" != "true" ]]; then
    log "checking nginx entry and same-origin API proxy"
    if [[ "$DOMAIN" == "_" ]]; then
      curl -fsS -I "http://127.0.0.1/" >/dev/null
      curl -fsS "http://127.0.0.1/api/status" >/dev/null
    else
      curl -fsS -I -H "Host: ${DOMAIN}" "http://127.0.0.1/" >/dev/null
      curl -fsS -H "Host: ${DOMAIN}" "http://127.0.0.1/api/status" >/dev/null
    fi
  fi
}

install_app() {
  need_root
  ensure_toolchain
  ensure_user
  clone_or_update_repo
  write_env_files
  build_app
  fix_permissions
  write_systemd_units
  write_nginx_site
  start_services
  smoke_test

  log "installation complete"
  log "frontend service: systemctl status ${WEB_SERVICE}"
  if [[ "$SKIP_NGINX" == "1" || "${SKIP_NGINX,,}" == "true" ]]; then
    log "open: http://${FRONTEND_HOST}:${FRONTEND_PORT}"
  else
    log "open: http://${DOMAIN}"
  fi
}

restart_app() {
  need_root
  systemctl restart "$WEB_SERVICE"
  if [[ "$SKIP_NGINX" != "1" && "${SKIP_NGINX,,}" != "true" ]]; then
    systemctl reload nginx || true
  fi
  status_app
}

status_app() {
  systemctl --no-pager --full status "$WEB_SERVICE" || true
}

logs_app() {
  journalctl -u "$WEB_SERVICE" -f
}

print_usage() {
  cat <<EOF
Usage:
  shadowweavectl.sh install
  shadowweavectl.sh restart
  shadowweavectl.sh status
  shadowweavectl.sh logs

Common env:
  SHADOWWEAVE_REPO=longxingze0925/yingzhi-AI
  SHADOWWEAVE_REF=main
  SHADOWWEAVE_INSTALL_DIR=/opt/shadowweave
  SHADOWWEAVE_STATE_DIR=/var/lib/shadowweave
  SHADOWWEAVE_DOMAIN=example.com
  NEW_API_UPSTREAM=https://new.0000.icu
  NEW_API_HOST=new.0000.icu
  NEXT_PUBLIC_API_BASE_URL=/api
  SHADOWWEAVE_SKIP_NGINX=1
EOF
}

main() {
  local cmd="${1:-install}"
  shift || true

  case "$cmd" in
    install) install_app "$@" ;;
    restart) restart_app "$@" ;;
    status) status_app "$@" ;;
    logs) logs_app "$@" ;;
    -h|--help|help) print_usage ;;
    *) die "unknown command: $cmd" ;;
  esac
}

main "$@"
