#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/lunan/.nvm/versions/node/v22.22.2/bin:$PATH"
cd /home/lunan/workspace/ai_trading_research

PORT="${1:-3200}"
exec npm run dev -- --hostname 0.0.0.0 --port "$PORT"
