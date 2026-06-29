# Backend InspecAPP Fase 6

API Express para sincronización, evidencias, workflow, firmas y reportes PDF.

## Ejecutar

```bash
cp .env.example .env
npm install
npm run dev
```

## CORS para Android

El `.env.example` admite varios orígenes separados por coma:

```env
CORS_ORIGIN=http://localhost:5173,capacitor://localhost,https://localhost
```

Para producción usar solo el dominio web/app permitido.
