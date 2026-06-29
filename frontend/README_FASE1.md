# InspecAPP — Fase 1 PWA

Esta carpeta contiene la **Fase 1** de InspecAPP: una aplicación web progresiva (PWA) hecha con React + TypeScript + Vite.

## Qué incluye esta fase

- Pantalla de datos de cliente, instalación e inspector.
- Selección de tipo de inspección: inicial, intermedia, final o existente.
- Definición de circuitos.
- Checklist cargado como datos (`src/data/checklistDSE001.ts`).
- Registro de resultados: cumple, no cumple, no aplica o pendiente.
- Observaciones por punto de inspección.
- Marcado de RES (Requisitos Esenciales de Seguridad).
- Evidencias fotográficas asociadas a cada requisito.
- Registro de mediciones.
- Guardado local automático en el navegador.
- Exportación JSON.
- Reporte preliminar HTML imprimible o guardable como PDF desde el navegador.
- Manifest y service worker básico para comportamiento PWA.

## Cómo probar en una computadora

1. Instalar Node.js.
2. Entrar a la carpeta del proyecto:

```bash
cd InspecAPP_Fase1_PWA
```

3. Instalar dependencias:

```bash
npm install
```

4. Ejecutar en modo desarrollo:

```bash
npm run dev
```

5. Abrir la URL que indique Vite, normalmente:

```bash
http://localhost:5173
```

## Cómo instalarla como app en el celular

1. Publicar el proyecto en un servidor HTTPS o probarlo en red local.
2. Abrir la URL desde Chrome/Edge en Android.
3. Elegir “Agregar a pantalla principal” o “Instalar app”.

## Próxima fase recomendada

La Fase 2 debería migrar el guardado local desde `localStorage` a `IndexedDB`, para soportar más inspecciones, más fotos y trabajo offline real con cola de sincronización.

## Nota técnica

Esta fase es un prototipo funcional. Para producción faltan autenticación, backend, base de datos central, control de versiones del checklist, firma, trazabilidad, permisos de usuarios, auditoría y generación formal de PDF.
