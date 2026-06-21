#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="影织 Shadowweave"
PROJECT_NAME="${SHADOWWEAVE_PROJECT_NAME:-shadowweave}"
INSTALL_DIR="${SHADOWWEAVE_INSTALL_DIR:-/opt/shadowweave}"
SHADOWWEAVE_REPO="${SHADOWWEAVE_REPO:-longxingze0925/yingzhi-AI}"
SHADOWWEAVE_REF="${SHADOWWEAVE_REF:-main}"
SHADOWWEAVE_RAW_BASE="${SHADOWWEAVE_RAW_BASE:-https://raw.githubusercontent.com/${SHADOWWEAVE_REPO}/${SHADOWWEAVE_REF}}"

ENV_FILE=".env.compose"
STATE_FILE=".install-state"
DIGEST_FILE="${SHADOWWEAVE_DIGEST_FILE:-compose.digests.yaml}"
PIN_DIGESTS="${SHADOWWEAVE_PIN_DIGESTS:-1}"

WEB_IMAGE="${SHADOWWEAVE_WEB_IMAGE:-ghcr.io/${SHADOWWEAVE_REPO,,}-web:latest}"
BACKEND_IMAGE="${SHADOWWEAVE_BACKEND_IMAGE:-ghcr.io/${SHADOWWEAVE_REPO,,}-backend:latest}"
CADDY_IMAGE="${CADDY_IMAGE:-caddy:2}"
ENTITLEHUB_BASE_URL="${ENTITLEHUB_BASE_URL:-https://ht.0000.icu}"
ENTITLEHUB_SERVER_KEY="${ENTITLEHUB_SERVER_KEY:-}"
ENTITLEHUB_MOCK="${ENTITLEHUB_MOCK:-}"
GHCR_USERNAME="${GHCR_USERNAME:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"

LOCAL_SOURCE_ROOT=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P || true)"
  if [[ -n "$script_dir" && -f "$script_dir/../deploy/docker-compose.yml" ]]; then
    LOCAL_SOURCE_ROOT="$(cd "$script_dir/.." && pwd -P)"
  fi
fi

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

ask() {
  local prompt="$1"
  local default="${2:-}"
  local value
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
  printf '%s: ' "$prompt" >&2
  read -r -s value || value=""
  printf '\n' >&2
  printf '%s' "$value"
}

confirm() {
  local prompt="$1"
  local answer
  printf '%s [y/N]: ' "$prompt"
  read -r answer || return 1
  [[ "$answer" == "y" || "$answer" == "Y" || "$answer" == "yes" || "$answer" == "YES" || "$answer" == "是" ]]
}

assert_safe_install_dir() {
  if [[ -z "$INSTALL_DIR" || "$INSTALL_DIR" == "/" || "$INSTALL_DIR" == "/opt" || "$INSTALL_DIR" == "/usr" || "$INSTALL_DIR" == "/var" ]]; then
    die "安装目录不安全：$INSTALL_DIR"
  fi
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "此操作需要 root 权限，请使用 sudo 或 root 重新运行。"
  fi
  assert_safe_install_dir
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "缺少必需命令：$1"
}

pin_digests_enabled() {
  [[ "$PIN_DIGESTS" != "0" && "$PIN_DIGESTS" != "false" && "$PIN_DIGESTS" != "FALSE" ]]
}

is_installed() {
  [[ -f "$INSTALL_DIR/compose.yaml" && -f "$INSTALL_DIR/$ENV_FILE" ]]
}

legacy_is_installed() {
  [[ -f "$INSTALL_DIR/docker-compose.yml" && -f "$INSTALL_DIR/.env" ]]
}

migrate_legacy_install() {
  if is_installed || ! legacy_is_installed; then
    return
  fi
  log "检测到旧版镜像安装目录，迁移配置文件名"
  cp "$INSTALL_DIR/docker-compose.yml" "$INSTALL_DIR/compose.yaml"
  cp "$INSTALL_DIR/.env" "$INSTALL_DIR/$ENV_FILE"
  chmod 600 "$INSTALL_DIR/$ENV_FILE" || true
}

in_install_dir() {
  cd "$INSTALL_DIR"
}

compose_args() {
  local args=(-p "$PROJECT_NAME" --env-file "$ENV_FILE" -f compose.yaml)
  if [[ -f compose.proxy.yml ]]; then
    args+=(-f compose.proxy.yml)
  fi
  if [[ -f "$DIGEST_FILE" ]] && pin_digests_enabled; then
    args+=(-f "$DIGEST_FILE")
  fi
  printf '%s\n' "${args[@]}"
}

compose_base() {
  in_install_dir
  local args=()
  mapfile -t args < <(compose_args)
  docker compose "${args[@]}" "$@"
}

compose_unpinned() {
  in_install_dir
  local args=(-p "$PROJECT_NAME" --env-file "$ENV_FILE" -f compose.yaml)
  if [[ -f compose.proxy.yml ]]; then
    args+=(-f compose.proxy.yml)
  fi
  docker compose "${args[@]}" "$@"
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
      if (!done) {
        print key "=" value
      }
    }
  ' "$file" > "$tmp"
  cat "$tmp" > "$file"
  rm -f "$tmp"
}

detect_public_ip() {
  local ip=""
  if command -v curl >/dev/null 2>&1; then
    ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  fi
  if [[ -z "$ip" ]]; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  printf '%s' "$ip"
}

http_url() {
  local host="$1"
  local port="$2"
  if [[ "$port" == "80" ]]; then
    printf 'http://%s' "$host"
  else
    printf 'http://%s:%s' "$host" "$port"
  fi
}

check_port_available() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ! ss -ltn "( sport = :$port )" | awk 'NR > 1 { found = 1 } END { exit found ? 0 : 1 }'
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    ! lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return
  fi
  return 0
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
  require_command openssl
  install_docker_prompt
  docker version >/dev/null
  docker compose version >/dev/null
}

copy_install_files() {
  local dest="$1"
  mkdir -p "$dest"

  if [[ -n "$LOCAL_SOURCE_ROOT" && "$LOCAL_SOURCE_ROOT" != "$INSTALL_DIR" ]]; then
    cp "$LOCAL_SOURCE_ROOT/deploy/docker-compose.yml" "$dest/compose.yaml"
    cp "$LOCAL_SOURCE_ROOT/ops/yingzhictl.sh" "$dest/yingzhictl.sh"
    cp "$LOCAL_SOURCE_ROOT/ops/install-image.sh" "$dest/install-image.sh"
    cp "$LOCAL_SOURCE_ROOT/ops/update-image.sh" "$dest/update-image.sh"
  else
    curl -fsSL "$SHADOWWEAVE_RAW_BASE/deploy/docker-compose.yml" -o "$dest/compose.yaml"
    curl -fsSL "$SHADOWWEAVE_RAW_BASE/ops/yingzhictl.sh" -o "$dest/yingzhictl.sh"
    curl -fsSL "$SHADOWWEAVE_RAW_BASE/ops/install-image.sh" -o "$dest/install-image.sh"
    curl -fsSL "$SHADOWWEAVE_RAW_BASE/ops/update-image.sh" -o "$dest/update-image.sh"
  fi
  chmod +x "$dest/yingzhictl.sh" "$dest/install-image.sh" "$dest/update-image.sh"
}

safe_refresh_source() {
  local tmp
  assert_safe_install_dir
  tmp="$(mktemp -d)"
  copy_install_files "$tmp"

  mkdir -p "$INSTALL_DIR"
  if [[ -f "$INSTALL_DIR/$ENV_FILE" ]]; then
    cp "$INSTALL_DIR/$ENV_FILE" "$tmp/$ENV_FILE"
  fi
  if [[ -f "$INSTALL_DIR/$STATE_FILE" ]]; then
    cp "$INSTALL_DIR/$STATE_FILE" "$tmp/$STATE_FILE"
  fi
  if [[ -f "$INSTALL_DIR/$DIGEST_FILE" ]]; then
    cp "$INSTALL_DIR/$DIGEST_FILE" "$tmp/$DIGEST_FILE"
  fi
  if [[ -d "$INSTALL_DIR/certs" ]]; then
    mkdir -p "$tmp/certs"
    cp -a "$INSTALL_DIR/certs/." "$tmp/certs/"
  fi
  for preserved in Caddyfile compose.proxy.yml reverse-proxy.nginx.example.conf backups; do
    if [[ -e "$INSTALL_DIR/$preserved" ]]; then
      cp -a "$INSTALL_DIR/$preserved" "$tmp/$preserved"
    fi
  done

  find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 \
    ! -name "$ENV_FILE" \
    ! -name "$STATE_FILE" \
    ! -name "$DIGEST_FILE" \
    ! -name 'certs' \
    ! -name 'Caddyfile' \
    ! -name 'compose.proxy.yml' \
    ! -name 'reverse-proxy.nginx.example.conf' \
    ! -name 'backups' \
    -exec rm -rf {} +

  cp -a "$tmp/." "$INSTALL_DIR/"
  rm -rf "$tmp"
}

resolve_entitlehub_mode() {
  if [[ -z "$ENTITLEHUB_SERVER_KEY" && -t 0 && "${ENTITLEHUB_MOCK,,}" != "true" && "$ENTITLEHUB_MOCK" != "1" ]]; then
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
  local mode="$1"
  local public_url="$2"
  local host_bind="$3"
  local http_port="$4"
  local backend_port="$5"
  local web_port="$6"
  local env_path="$INSTALL_DIR/$ENV_FILE"

  if [[ ! -f "$env_path" ]]; then
    resolve_entitlehub_mode
    umask 077
    cat > "$env_path" <<EOF
COMPOSE_HOST_BIND=${host_bind}
SHADOWWEAVE_HTTP_PORT=${http_port}
SHADOWWEAVE_BACKEND_HOST_PORT=${backend_port}
SHADOWWEAVE_WEB_HOST_PORT=${web_port}
SHADOWWEAVE_PUBLIC_URL=${public_url}
SHADOWWEAVE_WEB_IMAGE=${WEB_IMAGE}
SHADOWWEAVE_BACKEND_IMAGE=${BACKEND_IMAGE}
CADDY_IMAGE=${CADDY_IMAGE}
ENTITLEHUB_BASE_URL=${ENTITLEHUB_BASE_URL}
ENTITLEHUB_SERVER_KEY=${ENTITLEHUB_SERVER_KEY}
ENTITLEHUB_MOCK=${ENTITLEHUB_MOCK}
SHADOWWEAVE_SESSION_COOKIE=${SHADOWWEAVE_SESSION_COOKIE:-shadowweave_session}
SHADOWWEAVE_SESSION_TTL_SECONDS=${SHADOWWEAVE_SESSION_TTL_SECONDS:-604800}
EOF
  else
    warn "已保留现有 $ENV_FILE，EntitleHub Server Key 不会被覆盖。"
  fi

  set_env_value "$env_path" COMPOSE_HOST_BIND "$host_bind"
  set_env_value "$env_path" SHADOWWEAVE_HTTP_PORT "$http_port"
  set_env_value "$env_path" SHADOWWEAVE_BACKEND_HOST_PORT "$backend_port"
  set_env_value "$env_path" SHADOWWEAVE_WEB_HOST_PORT "$web_port"
  set_env_value "$env_path" SHADOWWEAVE_PUBLIC_URL "$public_url"
  set_env_value "$env_path" SHADOWWEAVE_WEB_IMAGE "$WEB_IMAGE"
  set_env_value "$env_path" SHADOWWEAVE_BACKEND_IMAGE "$BACKEND_IMAGE"
  set_env_value "$env_path" CADDY_IMAGE "$CADDY_IMAGE"
  set_env_value "$env_path" ENTITLEHUB_BASE_URL "$(get_env_value ENTITLEHUB_BASE_URL "$env_path" || printf '%s' "$ENTITLEHUB_BASE_URL")"
  chmod 600 "$env_path"
}

write_state() {
  local mode="$1"
  local public_url="$2"
  local domain="${3:-}"
  cat > "$INSTALL_DIR/$STATE_FILE" <<EOF
MODE=$mode
PUBLIC_URL=$public_url
DOMAIN=$domain
INSTALLED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SOURCE_REF=$SHADOWWEAVE_REF
EOF
  chmod 600 "$INSTALL_DIR/$STATE_FILE"
}

write_caddy_files() {
  local site_address="$1"
  local tls_mode="$2"
  local cert_path="${3:-}"
  local key_path="${4:-}"

  mkdir -p "$INSTALL_DIR/certs"
  if [[ "$tls_mode" == "custom" ]]; then
    [[ -f "$cert_path" ]] || die "证书文件不存在：$cert_path"
    [[ -f "$key_path" ]] || die "私钥文件不存在：$key_path"
    openssl x509 -in "$cert_path" -noout >/dev/null
    openssl pkey -in "$key_path" -noout >/dev/null
    cp "$cert_path" "$INSTALL_DIR/certs/fullchain.pem"
    cp "$key_path" "$INSTALL_DIR/certs/privkey.pem"
    chmod 600 "$INSTALL_DIR/certs/privkey.pem"
  fi

  cat > "$INSTALL_DIR/Caddyfile" <<EOF
$site_address {
    encode zstd gzip
EOF

  if [[ "$tls_mode" == "custom" ]]; then
    cat >> "$INSTALL_DIR/Caddyfile" <<'EOF'
    tls /etc/caddy/certs/fullchain.pem /etc/caddy/certs/privkey.pem
EOF
  fi

  cat >> "$INSTALL_DIR/Caddyfile" <<'EOF'

    handle /api* {
        reverse_proxy backend:18777
    }

    handle /healthz {
        reverse_proxy backend:18777
    }

    handle {
        reverse_proxy web:3000
    }
}
EOF

  if [[ "$tls_mode" == "auto" || "$tls_mode" == "custom" ]]; then
    cat > "$INSTALL_DIR/compose.proxy.yml" <<'EOF'
services:
  caddy:
    image: ${CADDY_IMAGE:-caddy:2}
    depends_on:
      backend:
        condition: service_healthy
      web:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./certs:/etc/caddy/certs:ro
      - caddy-data:/data
      - caddy-config:/config
    restart: unless-stopped

volumes:
  caddy-data:
  caddy-config:
EOF
  else
    cat > "$INSTALL_DIR/compose.proxy.yml" <<'EOF'
services:
  caddy:
    image: ${CADDY_IMAGE:-caddy:2}
    depends_on:
      backend:
        condition: service_healthy
      web:
        condition: service_healthy
    ports:
      - "${COMPOSE_HOST_BIND:-127.0.0.1}:${SHADOWWEAVE_HTTP_PORT:-13080}:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    restart: unless-stopped

volumes:
  caddy-data:
  caddy-config:
EOF
  fi
}

write_external_proxy_files() {
  local domain="$1"
  local backend_port="$2"
  local web_port="$3"
  cat > "$INSTALL_DIR/compose.proxy.yml" <<'EOF'
services:
  backend:
    ports:
      - "${COMPOSE_HOST_BIND:-127.0.0.1}:${SHADOWWEAVE_BACKEND_HOST_PORT:-18077}:18777"
  web:
    ports:
      - "${COMPOSE_HOST_BIND:-127.0.0.1}:${SHADOWWEAVE_WEB_HOST_PORT:-13000}:3000"
EOF

  cat > "$INSTALL_DIR/reverse-proxy.nginx.example.conf" <<EOF
server {
    listen 443 ssl http2;
    server_name $domain;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    client_max_body_size 64m;

    location /api/ {
        proxy_pass http://127.0.0.1:${backend_port};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /healthz {
        proxy_pass http://127.0.0.1:${backend_port}/healthz;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://127.0.0.1:${web_port};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
}

docker_login_if_needed() {
  if [[ -n "$GHCR_USERNAME" && -n "$GHCR_TOKEN" ]]; then
    log "登录 ghcr.io"
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
  else
    warn "未提供 GHCR 登录信息；镜像必须是 public，或服务器已提前 docker login。"
  fi
}

pin_image_digests() {
  if ! pin_digests_enabled; then
    warn "已跳过镜像 digest 锁定。"
    rm -f "$INSTALL_DIR/$DIGEST_FILE"
    return
  fi

  log "锁定本次部署使用的镜像"
  in_install_dir

  local tmp_file
  tmp_file="$(mktemp)"
  {
    printf '# Generated by ops/yingzhictl.sh. Do not edit by hand.\n'
    printf 'services:\n'
  } > "$tmp_file"

  local count=0
  local service image digest
  while IFS=$'\t' read -r service image; do
    [[ -n "$service" && -n "$image" ]] || continue

    if [[ "$image" == *@sha256:* ]]; then
      digest="$image"
    else
      printf '拉取镜像：%s\n' "$image"
      docker pull "$image"
      digest="$(docker image inspect --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' "$image" 2>/dev/null || true)"
      [[ -n "$digest" ]] || die "无法获取镜像 digest：$image"
    fi

    {
      printf '  %s:\n' "$service"
      printf '    image: "%s"\n' "$digest"
    } >> "$tmp_file"
    count=$((count + 1))
  done < <(
    compose_unpinned config | awk '
      /^  [A-Za-z0-9_.-]+:$/ {
        service = $1
        sub(/:$/, "", service)
        next
      }
      service != "" && /^    image:[[:space:]]+/ {
        image = $0
        sub(/^    image:[[:space:]]+/, "", image)
        gsub(/^"|"$/, "", image)
        gsub(/^'\''|'\''$/, "", image)
        print service "\t" image
      }
    '
  )

  [[ "$count" -gt 0 ]] || die "未找到可锁定的镜像服务。"
  mv "$tmp_file" "$INSTALL_DIR/$DIGEST_FILE"
  chmod 644 "$INSTALL_DIR/$DIGEST_FILE"
  printf '镜像版本已锁定：%s\n' "$INSTALL_DIR/$DIGEST_FILE"
}

prepare_images() {
  in_install_dir
  if pin_digests_enabled; then
    pin_image_digests
  else
    log "拉取服务镜像"
    compose_unpinned pull
  fi
}

start_stack() {
  log "启动服务"
  in_install_dir
  compose_base up -d --remove-orphans
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-40}"
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
  compose_base logs --tail=120 caddy || true
}

run_smoke() {
  log "运行冒烟检测"
  in_install_dir

  local mode public_url backend_port web_port http_port
  mode="$(get_env_value MODE "$INSTALL_DIR/$STATE_FILE" || true)"
  public_url="$(get_env_value PUBLIC_URL "$INSTALL_DIR/$STATE_FILE" || true)"
  backend_port="$(get_env_value SHADOWWEAVE_BACKEND_HOST_PORT || printf '18077')"
  web_port="$(get_env_value SHADOWWEAVE_WEB_HOST_PORT || printf '13000')"
  http_port="$(get_env_value SHADOWWEAVE_HTTP_PORT || printf '13080')"

  compose_base ps

  if [[ "$mode" == "external-proxy" ]]; then
    if ! wait_for_http "http://127.0.0.1:${backend_port}/healthz" "影织后端直连" 60; then
      diagnose_stack
      die "影织后端直连检查失败。"
    fi
    if ! wait_for_http "http://127.0.0.1:${web_port}/" "影织前端直连" 40; then
      diagnose_stack
      die "影织前端直连检查失败。"
    fi
    if [[ -n "$public_url" && "$public_url" == https://* ]]; then
      wait_for_http "$public_url" "公网 HTTPS" 20 || warn "公网 HTTPS 检查失败，请检查外部反向代理。"
    fi
    return
  fi

  [[ -n "$public_url" ]] || die "缺少访问地址，无法检测。"
  if [[ "$public_url" == https://* ]]; then
    wait_for_http "$public_url" "公网 HTTPS" 40 || warn "公网 HTTPS 检查失败，请检查 DNS、防火墙和证书状态。"
    return
  fi

  local local_http_url
  local_http_url="$(http_url "127.0.0.1" "$http_port")"
  if ! wait_for_http "${local_http_url}/healthz" "影织后端健康检查" 60; then
    diagnose_stack
    die "影织后端健康检查失败。"
  fi
  if ! wait_for_http "${local_http_url}/" "影织前端" 40; then
    diagnose_stack
    die "影织前端检查失败。"
  fi
}

install_local_command() {
  if [[ -w /usr/local/bin || "${EUID:-$(id -u)}" -eq 0 ]]; then
    mkdir -p /usr/local/bin
    cat > /usr/local/bin/yingzhi <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
export SHADOWWEAVE_INSTALL_DIR="${INSTALL_DIR}"
export SHADOWWEAVE_PROJECT_NAME="${PROJECT_NAME}"
export SHADOWWEAVE_REPO="${SHADOWWEAVE_REPO}"
export SHADOWWEAVE_REF="${SHADOWWEAVE_REF}"
export SHADOWWEAVE_RAW_BASE="${SHADOWWEAVE_RAW_BASE}"
bash <(curl -fsSL "\$SHADOWWEAVE_RAW_BASE/ops/install.sh")
EOF
    chmod +x /usr/local/bin/yingzhi
    ln -sf /usr/local/bin/yingzhi /usr/local/bin/shadowweave
  fi
}

configure_access_files() {
  local mode="$1"
  local domain="$2"
  local cert="${3:-}"
  local key="${4:-}"
  local backend_port="${5:-18077}"
  local web_port="${6:-13000}"

  rm -f "$INSTALL_DIR/compose.proxy.yml" "$INSTALL_DIR/Caddyfile" "$INSTALL_DIR/reverse-proxy.nginx.example.conf"
  case "$mode" in
    local | ip)
      write_caddy_files ":80" "http"
      ;;
    domain-auto)
      write_caddy_files "$domain" "auto"
      ;;
    domain-custom)
      write_caddy_files "$domain" "custom" "$cert" "$key"
      ;;
    external-proxy)
      write_external_proxy_files "$domain" "$backend_port" "$web_port"
      ;;
    *)
      die "未知访问方式：$mode"
      ;;
  esac
}

install_flow() {
  require_root
  preflight
  migrate_legacy_install

  if is_installed; then
    warn "$APP_NAME 已安装在 $INSTALL_DIR。"
    confirm "是否继续刷新安装文件并重新选择访问方式？" || return
  fi

  printf '\n请选择访问方式：\n'
  printf '1) 不使用域名，仅本机访问\n'
  printf '2) 不使用域名，使用服务器 IP 访问\n'
  printf '3) 使用域名，自动申请 HTTPS 证书\n'
  printf '4) 使用域名，使用自有证书\n'
  printf '5) 已有反向代理 / 负载均衡\n'
  printf '请选择：'
  local choice
  read -r choice

  local mode public_url host_bind http_port backend_port web_port domain cert key detected_ip
  backend_port="18077"
  web_port="13000"

  case "$choice" in
    1)
      mode="local"
      host_bind="127.0.0.1"
      http_port="$(ask "HTTP 端口" "13080")"
      public_url="$(http_url "127.0.0.1" "$http_port")"
      domain=""
      ;;
    2)
      mode="ip"
      host_bind="0.0.0.0"
      detected_ip="$(detect_public_ip)"
      detected_ip="$(ask "服务器 IP 或主机名" "$detected_ip")"
      http_port="$(ask "HTTP 端口" "80")"
      public_url="$(http_url "$detected_ip" "$http_port")"
      domain=""
      ;;
    3)
      mode="domain-auto"
      domain="$(ask "域名")"
      [[ -n "$domain" ]] || die "必须填写域名。"
      check_port_available 80 || die "80 端口已被占用。"
      check_port_available 443 || die "443 端口已被占用。"
      host_bind="0.0.0.0"
      http_port="80"
      public_url="https://${domain}"
      ;;
    4)
      mode="domain-custom"
      domain="$(ask "域名")"
      [[ -n "$domain" ]] || die "必须填写域名。"
      cert="$(ask "证书 fullchain.pem 路径")"
      key="$(ask "私钥路径")"
      check_port_available 80 || die "80 端口已被占用。"
      check_port_available 443 || die "443 端口已被占用。"
      host_bind="0.0.0.0"
      http_port="80"
      public_url="https://${domain}"
      ;;
    5)
      mode="external-proxy"
      domain="$(ask "公网域名或 URL 主机")"
      [[ -n "$domain" ]] || die "必须填写域名。"
      host_bind="127.0.0.1"
      http_port="0"
      backend_port="$(ask "后端直连端口" "$backend_port")"
      web_port="$(ask "前端直连端口" "$web_port")"
      public_url="https://${domain}"
      ;;
    *)
      warn "已取消。"
      return
      ;;
  esac

  log "准备安装目录"
  safe_refresh_source
  write_env_file "$mode" "$public_url" "$host_bind" "$http_port" "$backend_port" "$web_port"
  configure_access_files "$mode" "${domain:-}" "${cert:-}" "${key:-}" "$backend_port" "$web_port"
  write_state "$mode" "$public_url" "${domain:-}"
  install_local_command
  docker_login_if_needed
  prepare_images
  start_stack
  run_smoke

  printf '\n安装完成。\n'
  printf '访问地址：%s\n' "$public_url"
  printf '安装目录：%s\n' "$INSTALL_DIR"
}

update_flow() {
  require_root
  preflight
  migrate_legacy_install
  is_installed || die "$APP_NAME 尚未安装。"

  if [[ ! -f "$INSTALL_DIR/$STATE_FILE" || ! -f "$INSTALL_DIR/compose.proxy.yml" ]]; then
    warn "当前安装缺少新版访问方式配置，请先重新执行安装并选择访问方式。"
    install_flow
    return
  fi

  printf '\n更新选项：\n'
  printf '1) 更新到最新稳定版本\n'
  printf '2) 取消\n'
  printf '请选择：'
  local choice
  read -r choice
  [[ "$choice" == "1" ]] || return

  safe_refresh_source
  docker_login_if_needed
  prepare_images
  start_stack
  run_smoke
  printf '\n更新完成。\n'
}

uninstall_flow() {
  require_root
  migrate_legacy_install
  is_installed || die "$APP_NAME 尚未安装。"

  printf '\n卸载选项：\n'
  printf '1) 安全卸载，保留安装目录和证书\n'
  printf '2) 彻底清除，包括 Docker 数据卷和安装目录\n'
  printf '3) 取消\n'
  printf '请选择：'
  local choice
  read -r choice

  in_install_dir
  case "$choice" in
    1)
      compose_base down --remove-orphans
      rm -f /usr/local/bin/yingzhi /usr/local/bin/shadowweave
      printf '服务已停止，%s 已保留。\n' "$INSTALL_DIR"
      ;;
    2)
      printf '请输入 DELETE SHADOWWEAVE DATA 确认清除：'
      local phrase
      read -r phrase
      [[ "$phrase" == "DELETE SHADOWWEAVE DATA" ]] || die "确认短语不匹配。"
      compose_base down -v --rmi local --remove-orphans
      rm -f /usr/local/bin/yingzhi /usr/local/bin/shadowweave
      rm -rf "$INSTALL_DIR"
      printf '已彻底清除。\n'
      ;;
    *)
      warn "已取消。"
      ;;
  esac
}

translate_mode() {
  case "$1" in
    local) printf '不使用域名，仅本机访问' ;;
    ip) printf '不使用域名，服务器 IP 访问' ;;
    domain-auto) printf '使用域名，自动申请 HTTPS 证书' ;;
    domain-custom) printf '使用域名，自有证书' ;;
    external-proxy) printf '已有反向代理 / 负载均衡' ;;
    *) printf '%s' "$1" ;;
  esac
}

status_flow() {
  migrate_legacy_install
  is_installed || die "$APP_NAME 尚未安装。"
  in_install_dir
  printf '\n安装目录：%s\n' "$INSTALL_DIR"
  if [[ -f "$STATE_FILE" ]]; then
    local mode public_url domain installed_at source_ref
    mode="$(get_env_value MODE "$STATE_FILE" || true)"
    public_url="$(get_env_value PUBLIC_URL "$STATE_FILE" || true)"
    domain="$(get_env_value DOMAIN "$STATE_FILE" || true)"
    installed_at="$(get_env_value INSTALLED_AT "$STATE_FILE" || true)"
    source_ref="$(get_env_value SOURCE_REF "$STATE_FILE" || true)"
    [[ -n "$mode" ]] && printf '访问方式：%s\n' "$(translate_mode "$mode")"
    [[ -n "$public_url" ]] && printf '访问地址：%s\n' "$public_url"
    [[ -n "$domain" ]] && printf '域名：%s\n' "$domain"
    [[ -n "$installed_at" ]] && printf '安装时间：%s\n' "$installed_at"
    [[ -n "$source_ref" ]] && printf '源码版本：%s\n' "$source_ref"
  fi
  if [[ -f "$DIGEST_FILE" ]]; then
    printf '镜像锁定：已启用（%s）\n' "$DIGEST_FILE"
  else
    printf '镜像锁定：未启用\n'
  fi
  compose_base ps
}

logs_flow() {
  migrate_legacy_install
  is_installed || die "$APP_NAME 尚未安装。"
  in_install_dir
  printf '服务名，留空查看全部：'
  local service
  read -r service || service=""
  if [[ -n "$service" ]]; then
    compose_base logs --tail=200 -f "$service"
  else
    compose_base logs --tail=200 -f
  fi
}

restart_flow() {
  require_root
  migrate_legacy_install
  is_installed || die "$APP_NAME 尚未安装。"
  in_install_dir
  compose_base restart
  run_smoke
}

change_key_flow() {
  require_root
  migrate_legacy_install
  is_installed || die "$APP_NAME 尚未安装。"
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

cert_flow() {
  require_root
  migrate_legacy_install
  is_installed || die "$APP_NAME 尚未安装。"

  printf '\n证书管理：\n'
  printf '1) 查看证书状态\n'
  printf '2) 切换到自动申请证书\n'
  printf '3) 切换到自有证书\n'
  printf '4) 切换到外部反向代理\n'
  printf '5) 重载代理\n'
  printf '6) 返回\n'
  printf '请选择：'
  local choice
  read -r choice

  local domain cert key
  in_install_dir
  case "$choice" in
    1)
      compose_base logs --tail=120 caddy || true
      ;;
    2)
      domain="$(ask "域名")"
      [[ -n "$domain" ]] || die "必须填写域名。"
      check_port_available 80 || warn "80 端口可能已被占用，如果是当前 caddy 可忽略。"
      check_port_available 443 || warn "443 端口可能已被占用，如果是当前 caddy 可忽略。"
      set_env_value "$ENV_FILE" COMPOSE_HOST_BIND "0.0.0.0"
      set_env_value "$ENV_FILE" SHADOWWEAVE_HTTP_PORT "80"
      set_env_value "$ENV_FILE" SHADOWWEAVE_PUBLIC_URL "https://${domain}"
      configure_access_files "domain-auto" "$domain"
      write_state "domain-auto" "https://${domain}" "$domain"
      prepare_images
      compose_base up -d --remove-orphans
      run_smoke
      ;;
    3)
      domain="$(ask "域名")"
      [[ -n "$domain" ]] || die "必须填写域名。"
      cert="$(ask "证书 fullchain.pem 路径")"
      key="$(ask "私钥路径")"
      set_env_value "$ENV_FILE" COMPOSE_HOST_BIND "0.0.0.0"
      set_env_value "$ENV_FILE" SHADOWWEAVE_HTTP_PORT "80"
      set_env_value "$ENV_FILE" SHADOWWEAVE_PUBLIC_URL "https://${domain}"
      configure_access_files "domain-custom" "$domain" "$cert" "$key"
      write_state "domain-custom" "https://${domain}" "$domain"
      prepare_images
      compose_base up -d --remove-orphans
      run_smoke
      ;;
    4)
      domain="$(ask "公网域名或 URL 主机")"
      [[ -n "$domain" ]] || die "必须填写域名。"
      set_env_value "$ENV_FILE" COMPOSE_HOST_BIND "127.0.0.1"
      set_env_value "$ENV_FILE" SHADOWWEAVE_PUBLIC_URL "https://${domain}"
      local backend_port web_port
      backend_port="$(get_env_value SHADOWWEAVE_BACKEND_HOST_PORT || printf '18077')"
      web_port="$(get_env_value SHADOWWEAVE_WEB_HOST_PORT || printf '13000')"
      backend_port="$(ask "后端直连端口" "$backend_port")"
      web_port="$(ask "前端直连端口" "$web_port")"
      set_env_value "$ENV_FILE" SHADOWWEAVE_BACKEND_HOST_PORT "$backend_port"
      set_env_value "$ENV_FILE" SHADOWWEAVE_WEB_HOST_PORT "$web_port"
      configure_access_files "external-proxy" "$domain" "" "" "$backend_port" "$web_port"
      write_state "external-proxy" "https://${domain}" "$domain"
      prepare_images
      compose_base up -d --remove-orphans
      run_smoke
      ;;
    5)
      compose_base exec -T caddy caddy reload --config /etc/caddy/Caddyfile || compose_base restart caddy
      ;;
    *)
      return
      ;;
  esac
}

doctor_flow() {
  printf '\n环境诊断：\n'
  command -v docker >/dev/null 2>&1 && printf 'docker: 正常\n' || printf 'docker: 缺失\n'
  docker compose version >/dev/null 2>&1 && printf 'docker compose: 正常\n' || printf 'docker compose: 缺失\n'
  command -v curl >/dev/null 2>&1 && printf 'curl: 正常\n' || printf 'curl: 缺失\n'
  command -v openssl >/dev/null 2>&1 && printf 'openssl: 正常\n' || printf 'openssl: 缺失\n'
  df -h "$INSTALL_DIR" 2>/dev/null || df -h /
  if is_installed; then
    status_flow || true
    run_smoke || true
  fi
}

print_header() {
  clear 2>/dev/null || true
  migrate_legacy_install
  printf '========================================\n'
  printf ' %s 一键管理器\n' "$APP_NAME"
  printf '========================================\n'
  if is_installed; then
    printf '状态：已安装\n'
    printf '安装目录：%s\n' "$INSTALL_DIR"
    if [[ -f "$INSTALL_DIR/$STATE_FILE" ]]; then
      awk -F= '$1 == "PUBLIC_URL" { print "访问地址：" $2 }' "$INSTALL_DIR/$STATE_FILE"
      awk -F= '$1 == "SOURCE_REF" { print "源码版本：" $2 }' "$INSTALL_DIR/$STATE_FILE"
    fi
  else
    printf '状态：未安装\n'
    printf '安装目录：%s\n' "$INSTALL_DIR"
  fi
  printf '\n'
}

main_menu() {
  while true; do
    print_header
    if is_installed; then
      cat <<'EOF'
1) 更新到最新版
2) 查看状态
3) 查看日志
4) 证书管理
5) 修改 EntitleHub Server Key
6) 运行诊断
7) 重启服务
8) 卸载
9) 退出
EOF
      printf '请选择：'
      local choice
      read -r choice
      case "$choice" in
        1) update_flow; pause ;;
        2) status_flow; pause ;;
        3) logs_flow ;;
        4) cert_flow; pause ;;
        5) change_key_flow; pause ;;
        6) doctor_flow; pause ;;
        7) restart_flow; pause ;;
        8) uninstall_flow; pause ;;
        9) exit 0 ;;
        *) warn "无效选择。"; pause ;;
      esac
    else
      cat <<'EOF'
1) 安装
2) 运行诊断
3) 退出
EOF
      printf '请选择：'
      local choice
      read -r choice
      case "$choice" in
        1) install_flow; pause ;;
        2) doctor_flow; pause ;;
        3) exit 0 ;;
        *) warn "无效选择。"; pause ;;
      esac
    fi
  done
}

case "${1:-menu}" in
  install) install_flow ;;
  update) update_flow ;;
  restart) restart_flow ;;
  status) status_flow ;;
  logs) logs_flow ;;
  smoke) require_root; migrate_legacy_install; is_installed || die "$APP_NAME 尚未安装。"; run_smoke ;;
  change-key) change_key_flow ;;
  cert) cert_flow ;;
  doctor) doctor_flow ;;
  uninstall) uninstall_flow ;;
  menu|-h|--help|help) main_menu ;;
  *) die "未知命令：$1" ;;
esac
