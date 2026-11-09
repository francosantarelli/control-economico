# Instalación y operación — Control Económico

Guía para quien administra la app: levantar una base nueva, publicar, dar usuarios, facturación y tests. Para el uso diario ver [GUIA-DE-USO.md](GUIA-DE-USO.md).

## Arquitectura

- **Frontend:** `index.html` + `app.js` + `style.css`. JS plano sin build; carga Bootstrap, Supabase JS, ExcelJS y qrcode-generator desde CDN.
- **Backend:** Supabase (Postgres + Auth + Edge Functions). La URL y la clave *anon* están al comienzo de `app.js`.
- **Hosting:** GitHub Pages, publicado por GitHub Actions.
- **Extras:** facturación ARCA (Edge Function).

## 1. Base de datos nueva

1. Crear un proyecto en [Supabase](https://supabase.com).
2. En **SQL Editor → New query**, pegar todo [`schema.sql`](../schema.sql) y ejecutar. Crea tablas, políticas de seguridad (RLS) y datos iniciales; ya incluye todas las migraciones.
3. Poner la URL y la clave *anon* del proyecto en las primeras líneas de `app.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).

Para una base **ya en uso**, aplicar solo las migraciones faltantes de [`migrations/`](../migrations), en orden. Al cambiar el esquema: migración nueva **y** reflejarla en `schema.sql`.

## 2. Usuarios y seguridad

- En Supabase: **Authentication → Users → Add user** (email y contraseña) para cada persona.
- **Deshabilitar el signup público** (Authentication → Settings). Las políticas RLS dan acceso total a *cualquier* cuenta autenticada: sin esto, cualquiera que se registre vería todos los datos.
- El CC de efectivo por defecto se resuelve por email (`codigoCentroPorUsuario` en `app.js`); para usuarios nuevos hay que agregarlos ahí.

## 3. Publicación (GitHub Pages)

1. En el repo: **Settings → Pages → Source: “GitHub Actions”** (no “Deploy from a branch”).
2. Cada push a `main` ejecuta `.github/workflows/test.yml`: corre los tests y, solo si pasan, publica. Se publican únicamente `index.html`, `app.js`, `style.css`, favicons y `assets/`.
3. Los pull requests corren los tests pero no publican.

## 4. Desarrollo local y tests

```bash
npm ci
npm test            # una corrida (vitest + jsdom)
npm run test:watch
```

Para ver la app localmente alcanza con servir la carpeta con cualquier servidor estático. El `index.html` referencia `/control-economico/favicon.ico`, así que ese ícono solo se ve bajo esa ruta.

## Facturación ARCA

La Edge Function `supabase/functions/facturar-arca` emite **Factura C a Consumidor Final** para ventas de USDT, valida el tope de Monotributo (12 meses móviles) y guarda el resultado en la tabla `facturas`. Corre con el JWT del usuario logueado (mismas políticas RLS).

- Las tablas necesarias (`facturas`, `configuracion`) ya están en `schema.sql`.
- Homologación (pruebas) y producción son independientes; se alterna con el secret `ARCA_AMBIENTE`.
- Los secrets se cargan con `npx supabase secrets set NOMBRE=valor`, nunca en el código ni en el chat:

| Secret | Detalle |
|---|---|
| `ARCA_CUIT` | CUIT sin guiones |
| `ARCA_AMBIENTE` | `homologacion` o `produccion` (empezar en homologación) |
| `ARCA_CERT_B64_HOMOLOGACION` / `ARCA_CERT_B64_PRODUCCION` | Certificado emitido por ARCA, en base64 |
| `ARCA_KEY_B64_HOMOLOGACION` / `ARCA_KEY_B64_PRODUCCION` | Clave privada **sin passphrase**, en base64 |
| `ARCA_PUNTO_VENTA_HOMOLOGACION` / `ARCA_PUNTO_VENTA_PRODUCCION` | Punto de venta de tipo Web Services |
| `ARCA_CONCEPTO` | Opcional; `2` (Servicios) por defecto, `1` Productos. Consultarlo con el contador |
| `ARCA_WSAA_URL_*` / `ARCA_WSFE_URL_*` | Opcionales; ya traen el valor correcto por ambiente |

Despliegue: `npx supabase functions deploy facturar-arca`.

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| La app queda en “Cargando datos…” o muestra un error rojo | Falta alguna tabla o columna: aplicar las migraciones pendientes. |
| No se puede iniciar sesión | Usuario inexistente en Supabase Auth. |
| El deploy no ocurre | Fallan los tests, o Pages no está en “GitHub Actions”. |
| La factura ARCA es rechazada | Revisar certificado y punto de venta del ambiente activo, y el mensaje que devuelve ARCA. |
