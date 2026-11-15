#!/bin/sh
# Runs the Go API and nginx inside a single container so the app fits on the
# free tier of a PaaS that only allows one always-on service.
#
#   public  : nginx  -> 0.0.0.0:$WEB_PORT   (this is the port the platform exposes)
#   private : api    -> 127.0.0.1:$API_PORT (never reachable from the internet)
set -eu

# The platform decides the public port (Render injects PORT, default 10000).
WEB_PORT="${WEB_PORT:-${PORT:-8080}}"
API_PORT="${API_PORT:-9000}"
export WEB_PORT
export PORT="$API_PORT"

log() { echo "[entrypoint] $*" >&2; }

# Platforms that expose a public URL announce it; use it as the CORS/allowed
# origin so the deployment works without hardcoding a domain.
if [ -n "${RENDER_EXTERNAL_URL:-}" ]; then
  : "${PUBLIC_WEB_URL:=$RENDER_EXTERNAL_URL}"
  : "${CORS_ORIGINS:=$RENDER_EXTERNAL_URL}"
  export PUBLIC_WEB_URL CORS_ORIGINS
fi
log "public=$WEB_PORT api=$API_PORT cors=${CORS_ORIGINS:-unset}"

# Keep the nginx listener in sync with WEB_PORT (EXPOSE must match it).
sed -i "s/listen 8080;/listen ${WEB_PORT};/" /etc/nginx/conf.d/default.conf

# Optional one-shot admin bootstrap. The seed binary resets the admin password,
# so turn RUN_SEED_ON_BOOT back to "false" once the account exists.
if [ "${RUN_SEED_ON_BOOT:-false}" = "true" ]; then
  attempt=1
  while :; do
    if /app/seed; then
      log "admin seeded"
      break
    fi
    if [ "$attempt" -ge 5 ]; then
      log "seed failed after $attempt attempts, starting anyway"
      break
    fi
    log "seed attempt $attempt failed, retrying in 5s"
    attempt=$((attempt + 1))
    sleep 5
  done
fi

/app/api &
api_pid=$!

nginx -g "daemon off;" &
nginx_pid=$!

shutdown() {
  code="${1:-0}"
  log "shutting down (exit $code)"
  kill -TERM "$api_pid" 2>/dev/null || true
  nginx -s quit 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
  exit "$code"
}

trap 'shutdown 0' INT TERM

# If either process dies the container must die too, so the platform restarts it.
while kill -0 "$api_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 2
done

trap - INT TERM
shutdown 1
