#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="shadowweave"
BACKEND_SERVICE="shadowweave-backend"
WEB_SERVICE="shadowweave-web"

SHADOWWEAVE_REPO="${SHADOWWEAVE_REPO:-longxingze0925/Shadowweave}"
SHADOWWEAVE_REF="${SHADOWWEAVE_REF:-main}"
INSTALL_DIR="${SHADOWWEAVE_INSTALL_DIR:-/opt/shadowweave}"
CONFIG_DIR="${SHADOWWEAVE_CONFIG_DIR:-/etc/shadowweave}"
STATE_DIR="${SHADOWWEAVE_STATE_DIR:-/var/lib/shadowweave}"
SERVICE_USER="${SHADOWWEAVE_USER:-shadowweave}"
BACKEND_HOST="${SHADOWWEAVE_BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${SHADOWWEAVE_BACKEND_PORT:-18777}"
FRONTEND_HOST="${SHADOWWEAVE_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${SHADOWWEAVE_FRONTEND_PORT:-3000}"
PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE_URL-}"
DEMO_FALLBACK="${NEXT_PUBLIC_DEMO_FALLBACK:-0}"
ENTITLEHUB_BASE_URL="${ENTITLEHUB_BASE_URL:-https://ht.0000.icu}"
ENTITLEHUB_SERVER_KEY="${ENTITLEHUB_SERVER_KEY:-}"
ENTITLEHUB_MOCK="${ENTITLEHUB_MOCK:-}"
SESSION_COOKIE="${SHADOWWEAVE_SESSION_COOKIE:-shadowweave_session}"
SESSION_TTL_SECONDS="${SHADOWWEAVE_SESSION_TTL_SECONDS:-604800}"
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

install_rust() {
  if command -v cargo >/dev/null 2>&1; then
    log "cargo $(cargo --version | awk '{print $2}') is ready"
    return
  fi

  log "installing Rust toolchain"
  curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
}

ensure_toolchain() {
  if ! command -v apt-get >/dev/null 2>&1; then
    die "only Debian/Ubuntu apt-based servers are supported by this installer"
  fi

  apt_install_base
  install_node
  install_rust
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

write_env_files() {
  resolve_entitlehub_mode
  mkdir -p "$CONFIG_DIR"
  chmod 750 "$CONFIG_DIR"

  cat >"$CONFIG_DIR/backend.env" <<EOF
HOST=${BACKEND_HOST}
PORT=${BACKEND_PORT}
ENTITLEHUB_BASE_URL=${ENTITLEHUB_BASE_URL}
ENTITLEHUB_SERVER_KEY=${ENTITLEHUB_SERVER_KEY}
ENTITLEHUB_MOCK=${ENTITLEHUB_MOCK}
SHADOWWEAVE_SESSION_COOKIE=${SESSION_COOKIE}
SHADOWWEAVE_SESSION_TTL_SECONDS=${SESSION_TTL_SECONDS}
RUST_LOG=shadowweave_backend=info,backend=info,tower_http=info
EOF

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

  chmod 640 "$CONFIG_DIR/backend.env" "$CONFIG_DIR/web.env" "$INSTALL_DIR/.env.production"
}

build_app() {
  log "installing frontend dependencies"
  (cd "$INSTALL_DIR" && npm ci)

  log "building frontend"
  (cd "$INSTALL_DIR" && npm run build)

  log "building backend"
  # shellcheck disable=SC1090
  [[ -f "$HOME/.cargo/env" ]] && source "$HOME/.cargo/env"
  (cd "$INSTALL_DIR/backend" && cargo build --release)
}

write_systemd_units() {
  cat >"/etc/systemd/system/${BACKEND_SERVICE}.service" <<EOF
[Unit]
Description=Shadowweave Rust backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}/backend
EnvironmentFile=${CONFIG_DIR}/backend.env
ExecStart=${INSTALL_DIR}/backend/target/release/backend
Restart=always
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

  cat >"/etc/systemd/system/${WEB_SERVICE}.service" <<EOF
[Unit]
Description=Shadowweave Next.js frontend
After=network-online.target ${BACKEND_SERVICE}.service
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

  cat >"/etc/nginx/sites-available/shadowweave.conf" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 64m;

    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    location /api/ {
        proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT};
    }

    location = /healthz {
        proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT}/healthz;
    }

    location / {
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
  systemctl enable --now "$BACKEND_SERVICE"
  systemctl enable --now "$WEB_SERVICE"

  if [[ "$SKIP_NGINX" != "1" && "${SKIP_NGINX,,}" != "true" ]]; then
    systemctl enable --now nginx
    systemctl reload nginx
  fi
}

smoke_test() {
  log "checking backend health"
  curl -fsS "http://${BACKEND_HOST}:${BACKEND_PORT}/healthz" >/dev/null

  log "checking frontend"
  curl -fsS -I "http://${FRONTEND_HOST}:${FRONTEND_PORT}" >/dev/null

  if [[ "$SKIP_NGINX" != "1" && "${SKIP_NGINX,,}" != "true" ]]; then
    log "checking nginx entry"
    if [[ "$DOMAIN" == "_" ]]; then
      curl -fsS -I "http://127.0.0.1/" >/dev/null
    else
      curl -fsS -I -H "Host: ${DOMAIN}" "http://127.0.0.1/" >/dev/null
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
  log "backend service:  systemctl status ${BACKEND_SERVICE}"
  if [[ "$SKIP_NGINX" == "1" || "${SKIP_NGINX,,}" == "true" ]]; then
    log "open: http://${FRONTEND_HOST}:${FRONTEND_PORT}"
  else
    log "open: http://${DOMAIN}"
  fi
}

restart_app() {
  need_root
  systemctl restart "$BACKEND_SERVICE" "$WEB_SERVICE"
  if [[ "$SKIP_NGINX" != "1" && "${SKIP_NGINX,,}" != "true" ]]; then
    systemctl reload nginx || true
  fi
  status_app
}

status_app() {
  systemctl --no-pager --full status "$BACKEND_SERVICE" "$WEB_SERVICE" || true
}

logs_app() {
  journalctl -u "$BACKEND_SERVICE" -u "$WEB_SERVICE" -f
}

print_usage() {
  cat <<EOF
Usage:
  shadowweavectl.sh install
  shadowweavectl.sh restart
  shadowweavectl.sh status
  shadowweavectl.sh logs

Common env:
  SHADOWWEAVE_REPO=longxingze0925/Shadowweave
  SHADOWWEAVE_REF=main
  SHADOWWEAVE_INSTALL_DIR=/opt/shadowweave
  SHADOWWEAVE_STATE_DIR=/var/lib/shadowweave
  SHADOWWEAVE_DOMAIN=example.com
  ENTITLEHUB_BASE_URL=https://ht.0000.icu
  ENTITLEHUB_SERVER_KEY=ehsk_xxx
  NEXT_PUBLIC_API_BASE_URL=        # empty means same-origin /api through nginx
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
