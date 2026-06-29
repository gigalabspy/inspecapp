# Frontend InspecAPP — Fase 6

Frontend React + Vite + TypeScript preparado como PWA y como app Android con Capacitor.

## Desarrollo web

```bash
cp .env.example .env
npm install
npm run dev
```

## Android con Capacitor

```bash
cp .env.android.example .env
npm install
npm run build
npm run mobile:add:android
npm run mobile:sync
npm run mobile:open
```

## Scripts

- `npm run dev`: servidor local Vite.
- `npm run build`: compila el frontend.
- `npm run mobile:add:android`: genera carpeta Android nativa.
- `npm run mobile:sync`: compila y sincroniza assets con Android.
- `npm run mobile:open`: abre Android Studio.
- `npm run mobile:run`: ejecuta en emulador o celular conectado.

## Funciones móviles

- Cámara nativa para evidencias.
- Ubicación GPS para evidencias.
- Compartir PDF formal desde Android.
- Pantalla de estado móvil.
- Modo offline con IndexedDB.
