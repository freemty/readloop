#!/bin/sh
set -a
[ -f .env ] && . .env
set +a

node proxy.mjs &
PROXY_PID=$!

npx vite --host &
VITE_PID=$!

trap 'kill $PROXY_PID $VITE_PID 2>/dev/null; exit' INT TERM

echo ""
echo "  ReadLoop running:"
echo "    App:   http://localhost:5174/"
echo "    Proxy: http://localhost:3001/"
echo "    Ctrl+C to stop both"
echo ""

wait
