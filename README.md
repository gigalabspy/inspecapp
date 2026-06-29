# InspecAPP — Fase 6: App Android con Capacitor

Esta fase toma la Fase 5 y la deja preparada para funcionar como:

1. **PWA web** en navegador.
2. **App Android instalable** mediante Capacitor.
3. App de campo con **cámara nativa**, **ubicación**, **offline**, **sincronización**, **reportes PDF**, **firmas** y **cierre formal**.

> Importante: este paquete no incluye un APK ya compilado. Para generar el APK/AAB se necesita Android Studio, Android SDK y una clave de firma propia del organismo o empresa.

---

## Estructura

```txt
InspecAPP_Fase6_AndroidCapacitor/
├── backend/       API, sincronización, evidencias, workflow y reportes PDF
├── frontend/      PWA React + Capacitor Android
└── package.json   scripts generales
```

---

## 1. Probar primero como web/PWA

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Abrir:

```txt
http://localhost:5173
```

---

## 2. Preparar Android

Requisitos en la PC:

- Node.js LTS.
- Android Studio.
- Android SDK instalado desde Android Studio.
- JDK compatible con Android Gradle Plugin.
- Un celular Android con depuración USB o un emulador.

Desde la carpeta `frontend`:

```bash
cd frontend
npm install
npm run build
npm run mobile:add:android
npm run mobile:sync
npm run mobile:open
```

Eso abre Android Studio con el proyecto nativo generado por Capacitor.

---

## 3. Configurar API para celular físico

En navegador de PC se puede usar:

```env
VITE_API_URL=http://localhost:3001
```

Pero en un celular físico **localhost apunta al celular**, no a la PC. Para pruebas en LAN, usar la IP de la computadora:

```env
VITE_API_URL=http://192.168.1.10:3001
```

Ejemplo:

```bash
cd frontend
cp .env.android.example .env
npm run build
npm run mobile:sync
```

Para producción se recomienda usar HTTPS y dominio real:

```env
VITE_API_URL=https://api.inspecapp.com.py
```

---

## 4. Funciones móviles agregadas

- `capacitor.config.ts` con appId `py.com.inspecapp.mobile`.
- Cámara nativa con `@capacitor/camera`.
- Ubicación GPS con `@capacitor/geolocation`.
- Compartir reporte PDF con `@capacitor/share`.
- Escritura temporal de PDF con `@capacitor/filesystem`.
- Módulo visual nuevo: **8. Móvil**.
- Evidencias con coordenadas cuando el permiso esté disponible.
- Botón **Tomar foto con cámara nativa**.
- Botón **Compartir PDF en Android**.

---

## 5. Generar APK de prueba desde Android Studio

Después de ejecutar `npm run mobile:open`:

1. Esperar que Android Studio sincronice Gradle.
2. Ir a `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
3. Android Studio generará un APK de prueba.

Para distribución formal conviene generar **AAB**:

```txt
Build > Generate Signed Bundle / APK > Android App Bundle
```

---

## 6. Consideraciones para producción

Antes de entregar a organismos de inspección o clientes:

- Usar HTTPS obligatorio para backend.
- Cambiar credenciales demo.
- Pasar almacenamiento JSON del backend a PostgreSQL.
- Configurar backup automático de evidencias.
- Firmar APK/AAB con keystore institucional.
- Definir política de retención de fotos, informes y trazabilidad.
- Evaluar firma digital certificada si se requiere validez jurídica plena.

---

## Credenciales demo

```txt
Inspector:
inspector@inspecapp.local
inspecapp123

Supervisor:
supervisor@inspecapp.local
inspecapp123

Administrador:
admin@inspecapp.local
inspecapp123
```

---

## Próxima fase sugerida

**Fase 7: despliegue en servidor de prueba**, con PostgreSQL, Nginx, HTTPS, backups y dominio para probar InspecAPP con varios inspectores reales.
