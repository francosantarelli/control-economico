-- ============================================================
-- Marca "Gasto fijo" en vencimientos: se listan en su propia
-- sección de la pestaña Vencimientos y, al marcarlos pagados, la
-- app crea el vencimiento del mes siguiente — pegar en el SQL
-- Editor de Supabase (Project → SQL Editor → New query → Run)
-- ============================================================

alter table vencimientos add column if not exists gasto_fijo boolean not null default false;
