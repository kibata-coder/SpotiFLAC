#!/bin/bash
set -e

echo "=== Starting Cloudflare WARP daemon ==="
warp-svc &
WARP_PID=$!

# Wait for the daemon to be ready
sleep 5

echo "=== Registering WARP (accept Terms of Service) ==="
warp-cli --accept-tos register || echo "Already registered"

echo "=== Setting WARP to proxy mode (SOCKS5 on port 40000) ==="
warp-cli --accept-tos set-mode proxy || echo "Mode already set"

echo "=== Connecting to WARP ==="
warp-cli --accept-tos connect || echo "Already connected"

# Wait for connection to stabilize
sleep 5

echo "=== WARP status ==="
warp-cli status || true

echo "=== Upgrading yt-dlp to latest ==="
pip install --upgrade yt-dlp --quiet

echo "=== Starting Flask app with gunicorn ==="
exec gunicorn app:app --bind "0.0.0.0:${PORT:-8080}" --timeout 120 --workers 2
