# Control Economico

App de control de ingresos/egresos, movimientos, vencimientos y resumen, conectada a Supabase.

## Archivos
- `index.html` - estructura de la página (login + contenedor de la app). Se publica directo con GitHub Pages.
- `style.css` - estilos de toda la app.
- `app.js` - lógica de la app (estado, parsers de importación, render, acciones). Sin build ni dependencias: JS plano cargado directo por el navegador.
- `schema.sql` - esquema de base de datos para Supabase (tablas, seguridad, datos iniciales). Correr una sola vez en el SQL Editor de Supabase.

## Deploy
Este repo esta conectado a GitHub Pages: cada cambio en `main` se publica solo.
