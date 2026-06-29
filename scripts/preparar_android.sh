#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../frontend"

if [ ! -f .env ]; then
  cp .env.android.example .env
  echo "Se creó frontend/.env desde .env.android.example. Revisá VITE_API_URL antes de compilar."
fi

npm install
npm run build
npx cap add android || true
npx cap sync android
npx cap open android
