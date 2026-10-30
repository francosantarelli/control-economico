-- ============================================================
-- Gastos fijos (servicios, cuota del club, biblioteca, colaboraciones
-- con entidades...): sector dentro de la pestaña Vencimientos. Cada
-- gasto se carga una vez y se ve siempre; cada mes pagado queda en
-- gastos_fijos_pagos — pegar en el SQL Editor de Supabase (Project →
-- SQL Editor → New query → Run)
-- ============================================================

create table gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  tipo text not null default 'otro' check (tipo in ('servicio','club','biblioteca','colaboracion','otro')),
  monto numeric(14,2) default 0,             -- monto por mes (los meses pagados guardan lo que se pagó de verdad)
  dia_vencimiento int not null check (dia_vencimiento between 1 and 31), -- si el mes tiene menos días, vence el último
  centro_id uuid references centros(id) on delete set null,
  desde text not null check (desde ~ '^\d{4}-\d{2}$'),  -- primer mes en que aparece ('YYYY-MM')
  hasta text check (hasta ~ '^\d{4}-\d{2}$'),           -- último mes (al borrarlo con pagos); null = vigente
  created_at timestamptz default now()
);

create table gastos_fijos_pagos (
  id uuid primary key default gen_random_uuid(),
  gasto_fijo_id uuid not null references gastos_fijos(id) on delete cascade,
  periodo text not null check (periodo ~ '^\d{4}-\d{2}$'),  -- 'YYYY-MM'
  fecha date not null,
  monto numeric(14,2) default 0,             -- lo que se pagó (puede diferir del monto del gasto fijo)
  movimiento_id uuid references movimientos(id) on delete set null, -- egreso cargado al marcarlo pagado (opcional)
  created_at timestamptz default now(),
  unique (gasto_fijo_id, periodo)
);

alter table gastos_fijos enable row level security;
alter table gastos_fijos_pagos enable row level security;

create policy "logueados_todo_gastos_fijos" on gastos_fijos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_gastos_fijos_pagos" on gastos_fijos_pagos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
