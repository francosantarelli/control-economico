-- ============================================================
-- ESQUEMA "CONTROL ECONÓMICO" — pegar todo esto en el SQL Editor
-- de Supabase (Project → SQL Editor → New query → Run)
-- ============================================================

-- Centros de Costo
create table centros (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  color text,  -- color de fondo del chip en Movimientos y ABM, ej: '#4E9D77'
  color_texto text,  -- color de texto del chip (opcional); si es null, se calcula el contraste automático
  created_at timestamptz default now()
);

-- Categorías
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text,  -- 'ingreso' | 'egreso' | 'ahorro' | 'tec'
  color text,  -- color de fondo del chip en Movimientos y ABM, ej: '#D97B6C'
  color_texto text,  -- color de texto del chip (opcional); si es null, se calcula el contraste automático
  created_at timestamptz default now()
);

-- Subcategorías
create table subcategorias (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categorias(id) on delete cascade,
  nombre text not null,
  created_at timestamptz default now()
);

-- Movimientos
create table movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  centro_id uuid references centros(id) on delete set null,
  categoria_id uuid references categorias(id) on delete set null,
  subcategoria_id uuid references subcategorias(id) on delete set null,
  proveedor text,
  detalle text,
  ingreso numeric(14,2) default 0,
  egreso numeric(14,2) default 0,
  created_at timestamptz default now()
);

-- Vencimientos
create table vencimientos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  fecha date not null,
  monto numeric(14,2) default 0,
  centro_id uuid references centros(id) on delete set null,
  estado text default 'pendiente', -- 'pendiente' | 'pagado'
  created_at timestamptz default now()
);

-- Gimnasio (bonus track: competencia de perseverancia Ana vs Franco)
create table gimnasio_visitas (
  id uuid primary key default gen_random_uuid(),
  persona text not null check (persona in ('ana','franco')),
  fecha date not null,
  created_at timestamptz default now(),
  unique (persona, fecha)
);

-- ============================================================
-- SEGURIDAD: solo usuarios logueados (vos y tu pareja) pueden
-- leer y escribir. Nadie sin cuenta puede ver ni tocar nada.
-- ============================================================

alter table centros enable row level security;
alter table categorias enable row level security;
alter table subcategorias enable row level security;
alter table movimientos enable row level security;
alter table vencimientos enable row level security;
alter table gimnasio_visitas enable row level security;

create policy "logueados_todo_centros" on centros
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_categorias" on categorias
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_subcategorias" on subcategorias
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_movimientos" on movimientos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_vencimientos" on vencimientos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_gimnasio_visitas" on gimnasio_visitas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- Centros de Costo por defecto (los mismos que ya venías usando)
-- ============================================================
insert into centros (codigo, nombre) values
  ('MPF', 'Mercado Pago'),
  ('BSF', 'Banco Santander'),
  ('BNF', 'Banco Nación'),
  ('BPF', 'Banco Provincia');
