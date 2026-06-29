# InspecAPP Android — guía rápida

## Comandos principales

```bash
npm install
npm run build
npm run mobile:add:android
npm run mobile:sync
npm run mobile:open
```

## Después de modificar React

Cada vez que cambies el frontend:

```bash
npm run mobile:sync
```

## Ejecutar en celular conectado

```bash
npm run mobile:run
```

## Configurar backend

Para emulador Android, normalmente podés usar:

```env
VITE_API_URL=http://10.0.2.2:3001
```

Para celular físico en la misma red WiFi:

```env
VITE_API_URL=http://IP_DE_TU_PC:3001
```

Para producción:

```env
VITE_API_URL=https://api.tu-dominio.com
```

## Permisos esperados

- Cámara.
- Ubicación.
- Acceso a internet.
- Almacenamiento temporal para compartir PDF.

## Nota sobre HTTP local

Para pruebas se configuró `cleartext: true` en Capacitor. Para producción se debe usar HTTPS y retirar cualquier dependencia de HTTP plano.
