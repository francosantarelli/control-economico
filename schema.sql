-- ============================================================
-- ESQUEMA "CONTROL ECONÓMICO" — pegar todo esto en el SQL Editor
-- de Supabase (Project → SQL Editor → New query → Run) para
-- levantar la base desde cero.
--
-- Este archivo se mantiene al día con TODAS las migraciones de
-- migrations/*.sql (cada una sigue existiendo por separado como
-- registro histórico de cuándo y por qué se agregó cada cosa).
-- Si agregás una tabla o columna nueva: migración nueva en
-- migrations/ Y reflejarla acá, para que este archivo siga
-- sirviendo para levantar una base nueva de un solo saque.
-- ============================================================

-- Centros de Costo
create table centros (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  color text,  -- color de fondo del chip en Movimientos y ABM, ej: '#4E9D77'
  color_texto text,  -- color de texto del chip (opcional); si es null, se calcula el contraste automático
  entidad text,  -- banco/billetera para el logo en Saldos: 'santander' | 'nacion' | 'provincia' | 'icbc' | 'mercadopago' | null
  moneda text not null default 'ARS' check (moneda in ('ARS','USD','AMBAS')),  -- 'AMBAS': la cuenta tiene un saldo en pesos y otro en dólares
  created_at timestamptz default now()
);

-- Categorías
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text,  -- tratamiento en reportes: null (normal) | 'tec' | 'inversion' | 'sueldo' | 'control'
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

-- Tarjetas de crédito: con el día de cierre y de vencimiento la app calcula en qué resumen cae cada consumo
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

-- Resúmenes de tarjeta: se crean solos al cargar/importar consumos; al importar el real se corrigen las fechas
create table resumenes_tarjeta (
  id uuid primary key default gen_random_uuid(),
  tarjeta_id uuid not null references tarjetas(id) on delete cascade,
  fecha_cierre date not null,
  fecha_vencimiento date not null,
  total_real numeric(14,2),            -- lo que vino en el resumen (se carga al pagarlo)
  estado text not null default 'abierto' check (estado in ('abierto','pagado')),
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
  fecha_consumo date, -- fecha real de la compra (para movimientos de tarjeta); puede diferir de "fecha" (vencimiento del resumen)
  tarjeta boolean not null default false, -- si se pagó con tarjeta de crédito (agrupa en el resumen de tarjeta)
  tarjeta_marca text, -- Visa, Mastercard, Amex, etc. (para agrupar y titular el resumen de tarjeta correspondiente)
  cuotas text, -- texto libre, ej. "5/6"
  moneda text not null default 'ARS' check (moneda in ('ARS','USD')),
  cambio_id uuid, -- une las dos patas (USD y pesos) de una compra/venta de dólares
  tarjeta_id uuid references tarjetas(id) on delete set null, -- tarjeta con la que se pagó (si está cargada en ABM → Tarjetas)
  resumen_id uuid references resumenes_tarjeta(id) on delete set null, -- resumen en el que se paga (su vencimiento es "fecha")
  created_at timestamptz default now()
);
create index movimientos_cambio_id_idx on movimientos(cambio_id);

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

-- Deudas (para la pestaña "Flujo de Caja")
create table deudas (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  saldo_pendiente numeric(14,2) default 0,   -- lo que falta pagar hoy
  cuota_mensual numeric(14,2) default 0,
  centro_id uuid references centros(id) on delete set null,  -- de dónde sale la cuota (opcional)
  estado text default 'activa', -- 'activa' | 'cancelada'
  created_at timestamptz default now()
);

-- Gastos fijos (servicios, club, biblioteca, colaboraciones...): se cargan una vez y se ven siempre en Vencimientos
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

-- Meses pagados de cada gasto fijo (uno por gasto y por mes)
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

-- Tenencia de USDT (ingresos y ventas)
create table usdt_movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo text not null check (tipo in ('ingreso','venta')),
  cantidad numeric(18,8) not null,              -- USDT (positivo siempre; el signo lo da "tipo")
  monto_ars numeric(14,2),                       -- pesos recibidos, solo en 'venta'
  cotizacion numeric(14,4),                      -- monto_ars / cantidad, solo en 'venta' (informativo)
  centro_id uuid references centros(id) on delete set null,       -- CC destino de los pesos, solo en 'venta'
  categoria_id uuid references categorias(id) on delete set null,
  subcategoria_id uuid references subcategorias(id) on delete set null,
  movimiento_id uuid references movimientos(id) on delete set null, -- ingreso en pesos creado automáticamente por la venta
  detalle text,
  created_at timestamptz default now()
);

-- Facturación ARCA de ventas de USDT
create table facturas (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid references movimientos(id) on delete set null,
  fecha date not null,
  tipo_comprobante text not null default 'C',   -- Factura C (Monotributo, a Consumidor Final)
  punto_venta integer not null,
  numero integer,                                -- lo asigna ARCA; queda null hasta que estado='emitida'
  importe numeric(14,2) not null,
  cae text,
  cae_vencimiento date,
  estado text not null default 'pendiente' check (estado in ('pendiente','emitida','error')),
  error text,                                    -- motivo del rechazo (propio o de ARCA), solo si estado='error'
  ambiente text not null default 'homologacion' check (ambiente in ('homologacion','produccion')),
  detalle text,                                  -- ej: "5.2 USDT a $850" (solo informativo, no se envía a ARCA)
  created_at timestamptz default now()
);

-- Evita facturar dos veces el mismo movimiento EN EL MISMO AMBIENTE (una vez emitida).
-- Cada ambiente lleva su propia cuenta, para no bloquear producción con algo ya probado en homologación.
create unique index facturas_movimiento_emitida_unq on facturas (movimiento_id, ambiente) where estado = 'emitida';

-- Configuración editable de a pares clave/valor: para datos que cambian por normativa
-- (ej. el tope de facturación de la categoría de Monotributo), no por deploy.
create table configuracion (
  clave text primary key,
  valor text not null
);

-- Caché del Token+Sign de WSAA (dura ~12hs; pedir uno nuevo antes de que expire el
-- anterior hace que ARCA lo rechace). La usa la Edge Function facturar-arca.
create table arca_ta (
  ambiente text primary key check (ambiente in ('homologacion','produccion')),
  token text not null,
  sign text not null,
  expira_en timestamptz not null
);

-- Reglas de categorización al importar: proveedor -> categoría/subcategoría sugeridas
-- al previsualizar una importación (coincidencia parcial, sin distinguir mayúsculas).
create table reglas_categorizacion (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null,
  categoria text not null,
  subcategoria text,
  created_at timestamptz default now()
);

-- ============================================================
-- SEGURIDAD: solo usuarios logueados (vos y tu pareja) pueden
-- leer y escribir. Nadie sin cuenta puede ver ni tocar nada.
--
-- IMPORTANTE: "authenticated" es cualquier cuenta autenticada del
-- proyecto, no solo la tuya y la de tu pareja. Esto solo es seguro
-- si en Authentication → Settings tenés deshabilitado "Allow new
-- users to sign up" (o restringido por dominio/invitación) — si
-- no, cualquiera que se cree una cuenta pasa a tener acceso total.
-- ============================================================

alter table centros enable row level security;
alter table categorias enable row level security;
alter table subcategorias enable row level security;
alter table movimientos enable row level security;
alter table vencimientos enable row level security;
alter table gimnasio_visitas enable row level security;
alter table deudas enable row level security;
alter table gastos_fijos enable row level security;
alter table gastos_fijos_pagos enable row level security;
alter table usdt_movimientos enable row level security;
alter table facturas enable row level security;
alter table configuracion enable row level security;
alter table arca_ta enable row level security;
alter table reglas_categorizacion enable row level security;
alter table tarjetas enable row level security;
alter table resumenes_tarjeta enable row level security;

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

create policy "logueados_todo_deudas" on deudas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_gastos_fijos" on gastos_fijos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_gastos_fijos_pagos" on gastos_fijos_pagos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_usdt_movimientos" on usdt_movimientos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_facturas" on facturas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_configuracion" on configuracion
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_arca_ta" on arca_ta
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_reglas_categorizacion" on reglas_categorizacion
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_tarjetas" on tarjetas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "logueados_todo_resumenes_tarjeta" on resumenes_tarjeta
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- Datos iniciales
-- ============================================================

-- Centros de Costo por defecto (los mismos que ya venías usando)
insert into centros (codigo, nombre) values
  ('MPF', 'Mercado Pago'),
  ('BSF', 'Banco Santander'),
  ('BNF', 'Banco Nación'),
  ('BPF', 'Banco Provincia');

insert into configuracion (clave, valor) values
  ('monotributo_limite_categoria_b', '1400000'),
  ('arca_cuit', '27357665278'),
  ('arca_razon_social', 'Ana Laura Casadei');

-- Reglas de categorización que ya venías usando (antes vivían hardcodeadas en app.js)
insert into reglas_categorizacion (proveedor, categoria, subcategoria) values
  ('Barrientos', 'Casa', 'Limpieza'),
  ('Zuvilivia', 'Comida', 'Carnicería'),
  ('Melina', 'Comida', 'Verdulería'),
  ('Rocio Jaqueline Oderda', 'Comida', 'Panadería'),
  ('Kiosco las flores', 'Salida', 'Kiosco'),
  ('Rendimientos', 'Intereses', 'Rendimientos'),
  ('Nahir Aldana Kastelan', 'Emma y Juli', 'Librería'),
  ('Carina Ines', 'Emma y Juli', 'Pañalera'),
  ('Macarena', 'Emma y Juli', 'Niñera'),
  ('Boqon', 'Salida', null),
  ('Casa oriental', 'Casa', null),
  ('Claudio Gabriel Valerio', 'Super', null),
  ('Luis Alberto Aguero', 'Obra', 'Albañil'),
  ('Francisco Mira', 'Comida', 'Dietética'),
  ('Mariano Del Valle', 'Comida', 'Pollería'),
  ('Gustavo Canale', 'Obra', null),
  ('PEMASYS S. A.', 'Sueldo', 'Maslow'),
  ('Rendimiento', 'Intereses', null),
  ('LA ANóNIMA SUC 100', 'Super', null),
  ('APPYPF 03008 COMBUST', 'Auto', null),
  ('Spotify', 'Servicios', 'Spotify'),
  ('IMPUESTO DE SELLOS', 'Servicios', 'Gastos Bancarios'),
  ('IIBB PERCEP-BSAS 2,00%( 5499,00)', 'Servicios', 'Gastos Bancarios'),
  ('IVA RG 4240 21%( 5499,00)', 'Servicios', 'Gastos Bancarios'),
  ('DB.RG 5617 30% ( 5499,00 )', 'Servicios', 'Gastos Bancarios');
