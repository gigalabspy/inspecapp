@echo off
cd /d %~dp0\..\frontend
if not exist .env (
  copy .env.android.example .env
  echo Se creo frontend\.env desde .env.android.example. Revisar VITE_API_URL antes de compilar.
)
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
