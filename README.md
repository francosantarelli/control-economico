# Control Economico

App de control de ingresos/egresos, movimientos, vencimientos y resumen, conectada a Supabase.

## Archivos
- `index.html` - estructura de la página (login + contenedor de la app). Se publica directo con GitHub Pages.
- `style.css` - estilos de toda la app.
- `app.js` - lógica de la app (estado, parsers de importación, render, acciones). Sin build ni dependencias: JS plano cargado directo por el navegador.
- `assets/` - logos de entidades (Saldos) y otros assets estáticos que sí se publican.
- `schema.sql` - esquema completo de base de datos para Supabase (tablas, seguridad, datos iniciales), al día con todas las migraciones. Para levantar una base nueva de cero, correr solo este archivo una vez en el SQL Editor de Supabase.
- `migrations/*.sql` - historial de cada cambio de esquema que se le fue aplicando a la base ya existente, en orden. `schema.sql` ya los incluye a todos — estos archivos quedan como registro de cuándo y por qué se agregó cada cosa, y para aplicar el cambio puntual a una base que ya está en uso (no hace falta correrlos si armás la base de cero con `schema.sql`).
- `test/` - tests (vitest + jsdom, corren contra el `index.html`/`app.js` reales).
- `scripts/backup-a-drive/` - script del backup diario a Google Drive (ver `.github/workflows/backup-diario.yml`).
- `supabase/functions/` - Edge Functions (Deno) para la facturación electrónica vía ARCA.

## Deploy
Este repo está conectado a GitHub Pages vía Actions (`.github/workflows/test.yml`): cada push a `main` corre los tests primero, y solo si pasan se publica automáticamente. Publica únicamente `index.html`, `app.js`, `style.css`, los favicons y `assets/` — no el repo entero (antes, con "Deploy from a branch", se servía la raíz completa tal cual, `schema.sql` y `migrations/` incluidos).

Para que esto funcione hace falta que en el repo, en **Settings → Pages → Source**, esté elegido **"GitHub Actions"** (no "Deploy from a branch").

## Seguridad
Las políticas de RLS de Supabase dan acceso total a cualquier cuenta `authenticated` del proyecto, no a una lista puntual de emails — así que la app depende de que el signup público esté deshabilitado en **Authentication → Settings** de Supabase. Sin eso, cualquiera que se cree una cuenta tendría acceso a todos los datos.
