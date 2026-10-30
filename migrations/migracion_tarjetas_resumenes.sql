-- ============================================================
-- Tarjetas de crédito y sus resúmenes — pegar en el SQL Editor de
-- Supabase (Project → SQL Editor → New query → Run)
--
-- Cada tarjeta tiene un día de cierre y uno de vencimiento
-- aproximados: con eso la app calcula sola en qué resumen cae un
-- consumo (según su fecha de consumo) y en cuál cada cuota. Los
-- resúmenes se crean solos al cargar o importar consumos; al
-- importar el resumen real se corrigen sus fechas (y las de sus
-- movimientos). Los movimientos de tarjeta cargados antes de esto
-- quedan sin tarjeta asignada y siguen funcionando como hasta ahora.
-- ============================================================

create table tarjetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                -- ej. "Visa Nación"
  banco text,                          -- formato del resumen al importar: 'nacion' | 'santander' | 'provincia' | 'mercadopago'
  marca text,                          -- Visa, Mastercard, Amex...
  centro_id uuid references centros(id) on delete set null, -- cuenta desde la que se paga el resumen
  dia_cierre int not null default 25 check (dia_cierre between 1 and 31),
  dia_vencimiento int not null default 5 check (dia_vencimiento between 1 and 31),
  activa boolean not null default true,
  created_at timestamptz default now()
);

create table resumenes_tarjeta (
  id uuid primary key default gen_random_uuid(),
  tarjeta_id uuid not null references tarjetas(id) on delete cascade,
  fecha_cierre date not null,
  fecha_vencimiento date not null,
  total_real numeric(14,2),            -- lo que vino en el resumen (se carga al pagarlo)
  estado text not null default 'abierto' check (estado in ('abierto','pagado')),
  created_at timestamptz default now()
);

alter table movimientos add column if not exists tarjeta_id uuid references tarjetas(id) on delete set null;
alter table movimientos add column if not exists resumen_id uuid references resumenes_tarjeta(id) on delete set null;

alter table tarjetas enable row level security;
alter table resumenes_tarjeta enable row level security;

create policy "logueados_todo_tarjetas" on tarjetas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_resumenes_tarjeta" on resumenes_tarjeta
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
