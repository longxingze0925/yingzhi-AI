#!/usr/bin/env bash
set -Eeuo pipefail

INSTALL_DIR="${SHADOWWEAVE_INSTALL_DIR:-/opt/shadowweave}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  printf '[shadowweave] ERROR: please run as root, for example: sudo bash ops/update-image.sh\n' >&2
  exit 1
fi

if [[ ! -f "$INSTALL_DIR/docker-compose.yml" || ! -f "$INSTALL_DIR/.env" ]]; then
  printf '[shadowweave] ERROR: missing %s/docker-compose.yml or %s/.env\n' "$INSTALL_DIR" "$INSTALL_DIR" >&2
  exit 1
fi

docker compose --env-file "$INSTALL_DIR/.env" -f "$INSTALL_DIR/docker-compose.yml" pull
docker compose --env-file "$INSTALL_DIR/.env" -f "$INSTALL_DIR/docker-compose.yml" up -d
docker compose --env-file "$INSTALL_DIR/.env" -f "$INSTALL_DIR/docker-compose.yml" ps
