-- ============ MIGRACIÓN 014: promociones de tarjetas de crédito ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 013.
--
-- Dos clases de tablas, con dos regímenes de acceso distintos:
--
-- * Las PROMOS son globales: son datos del banco, no de una familia. Las
--   escriben solo la ingesta (crons de GNB/Itaú) y la carga manual, las dos
--   con el admin client (service role). Un usuario autenticado puede
--   leerlas pero no escribirlas: si pudiera, una familia podría editar las
--   promos que ven las demás.
-- * Las TARJETAS y los COMERCIOS FAVORITOS son de cada familia: patrón
--   estándar de cuatro políticas con family_id = hogar.current_family_id().
--
-- Las promos se guardan aunque ninguna tarjeta de la familia aplique hoy:
-- el filtro por tarjeta se hace al mostrar y al notificar
-- (lib/promos/matching.ts), así una tarjeta nueva ve las promos sin volver
-- a ingerir.

set search_path = hogar;

-- ============ promociones ============
-- clave_externa: gnb:{id} / itau:{b}:{c}; null en las cargas manuales
-- (unique admite varios null). reemplazada_por: versionado de las manuales
-- — la versión vieja queda con activa = false apuntando a la nueva, no se
-- borra. hash_contenido: solo se vuelve a normalizar con Claude si cambia.

create table hogar.promociones (
  id              uuid primary key default gen_random_uuid(),
  banco           text not null check (banco in ('gnb','itau','sudameris','basa')),
  origen          text not null check (origen in ('api','web','manual')),
  clave_externa   text unique,
  titulo          text not null,
  resumen         text,
  rubro           text not null
                    check (rubro in ('supermercado','farmacia','combustible','electrodomesticos')),
  url_fuente      text,
  archivo_path    text,
  version_doc     text,
  vigencia_desde  date,
  vigencia_hasta  date,
  canal           text,
  acumulable      boolean,
  hash_contenido  text,
  raw             jsonb,
  activa          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  reemplazada_por uuid references hogar.promociones(id) on delete set null,
  check (vigencia_desde is null or vigencia_hasta is null or vigencia_desde <= vigencia_hasta)
);
create index on hogar.promociones (banco, activa);
create index on hogar.promociones (activa, vigencia_hasta);

-- hogar.set_updated_at() escribe updated_at; acá la columna se llama
-- actualizado_en, así que lleva su propia función.
create or replace function hogar.promociones_set_actualizado_en()
returns trigger
language plpgsql
set search_path = hogar
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger promociones_set_actualizado_en
  before update on hogar.promociones
  for each row execute function hogar.promociones_set_actualizado_en();

-- ============ promo_comercios ============
-- Una promo puede cubrir varios comercios, cada uno con su propia ventana
-- (BASA súper: "La Rosarina desde 10/09", "Casa Paraná excluida desde
-- 01/10" → hasta = 30/09).

create table hogar.promo_comercios (
  id              uuid primary key default gen_random_uuid(),
  promo_id        uuid not null references hogar.promociones(id) on delete cascade,
  comercio_nombre text not null,
  desde           date,
  hasta           date
);
create index on hogar.promo_comercios (promo_id);

-- ============ promo_beneficios ============
-- Capas dentro de una promo (General, Especial, Black/Signature…). Una capa
-- vale los dias_semana (0 = domingo … 6 = sábado) y/o las fechas
-- explícitas; si ambos son null, vale todos los días de la vigencia. Si dos
-- capas aplican el mismo día a la misma tarjeta, gana la de mayor
-- prioridad (Farmacenter: la Especial reemplaza a la General).

create table hogar.promo_beneficios (
  id          uuid primary key default gen_random_uuid(),
  promo_id    uuid not null references hogar.promociones(id) on delete cascade,
  nombre      text not null default 'General',
  dias_semana int[] check (dias_semana is null or dias_semana <@ array[0,1,2,3,4,5,6]),
  fechas      date[],
  prioridad   int not null default 0
);
create index on hogar.promo_beneficios (promo_id);

-- ============ promo_beneficio_componentes ============
-- Los componentes de una capa se SUMAN: descuento en caja + reintegro +
-- cuotas. alcance: sobre qué productos ('medicamentos', 'productos
-- seleccionados'); dos componentes del mismo tipo con distinto alcance
-- (25% en caja salvo medicamentos / 20% en medicamentos) son dos filas.

create table hogar.promo_beneficio_componentes (
  id           uuid primary key default gen_random_uuid(),
  beneficio_id uuid not null references hogar.promo_beneficios(id) on delete cascade,
  tipo         text not null
                 check (tipo in ('descuento_caja','reintegro','descuento_monto','cuotas')),
  porcentaje   numeric(5,2) check (porcentaje is null or (porcentaje > 0 and porcentaje <= 100)),
  monto        numeric(14,0) check (monto is null or monto > 0),
  cuotas       int check (cuotas is null or cuotas > 0),
  es_hasta     boolean not null default false,
  alcance      text,
  tope_monto   numeric(14,0) check (tope_monto is null or tope_monto > 0),
  tope_periodo text check (tope_periodo in ('dia','mes','promo')),
  tope_alcance text
);
create index on hogar.promo_beneficio_componentes (beneficio_id);

-- ============ promo_beneficio_tarjetas ============
-- Reglas de inclusión/exclusión por capa. Un campo null es comodín. La
-- exclusión siempre gana; sin reglas 'incluye', la capa aplica a todas las
-- tarjetas de crédito del banco. Los valores se guardan normalizados
-- (minúsculas, sin tildes, sinónimos resueltos: lib/promos/normalize.ts).

create table hogar.promo_beneficio_tarjetas (
  id           uuid primary key default gen_random_uuid(),
  beneficio_id uuid not null references hogar.promo_beneficios(id) on delete cascade,
  regla        text not null check (regla in ('incluye','excluye')),
  marca        text,
  nivel        text,
  afinidad     text,
  tipo         text check (tipo in ('credito','debito','prepaga'))
);
create index on hogar.promo_beneficio_tarjetas (beneficio_id);

-- ============ promo_descartadas ============
-- Promos automáticas que no pasaron el filtro (rubro 'otro', sin
-- porcentaje ni monto, solo cuotas). Se registra el hash para no volver a
-- normalizarlas con Claude todos los días: solo se reprocesan si cambia.

create table hogar.promo_descartadas (
  clave_externa text primary key,
  hash          text not null,
  motivo        text not null,
  descartada_en timestamptz not null default now()
);

-- ============ promo_ingestas ============
-- Una fila por corrida de ingesta, para la línea de estado "última
-- ingesta OK por banco" (detectar si una fuente se rompió).

create table hogar.promo_ingestas (
  id           uuid primary key default gen_random_uuid(),
  banco        text not null check (banco in ('gnb','itau','sudameris','basa')),
  iniciada_en  timestamptz not null default now(),
  terminada_en timestamptz,
  ok           boolean not null default false,
  detalle      jsonb
);
create index on hogar.promo_ingestas (banco, iniciada_en desc);

-- ============ tarjetas_familia ============
-- Sin números de tarjeta: solo banco, marca, nivel, afinidad y un alias.
-- tipo no estaba en el diseño original: hace falta porque una capa sin
-- reglas 'incluye' aplica solo a las de crédito, y las reglas pueden
-- filtrar por tipo (Sudameris "Visa y Mastercard de crédito").

create table hogar.tarjetas_familia (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references hogar.families(id) on delete cascade,
  member_id  uuid not null references hogar.family_members(id) on delete cascade,
  banco      text not null check (banco in ('gnb','itau','sudameris','basa')),
  marca      text not null check (marca in ('visa','mastercard','amex')),
  nivel      text not null,
  afinidad   text,
  tipo       text not null default 'credito' check (tipo in ('credito','debito','prepaga')),
  alias      text not null,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);
create index on hogar.tarjetas_familia (family_id);

-- ============ comercios_favoritos ============

create table hogar.comercios_favoritos (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references hogar.families(id) on delete cascade,
  nombre     text not null,
  rubro      text not null
               check (rubro in ('supermercado','farmacia','combustible','electrodomesticos')),
  created_at timestamptz not null default now()
);
create index on hogar.comercios_favoritos (family_id);

-- ============ RLS: tablas globales de promos ============
-- Lectura para cualquier autenticado (las promos no son de nadie), sin
-- políticas de escritura. promo_descartadas no tiene nada que mostrar:
-- política restrictiva, mismo patrón que telegram_sessions (012).

alter table hogar.promociones enable row level security;
create policy "promociones_select" on hogar.promociones
  for select to authenticated using (true);

alter table hogar.promo_comercios enable row level security;
create policy "promo_comercios_select" on hogar.promo_comercios
  for select to authenticated using (true);

alter table hogar.promo_beneficios enable row level security;
create policy "promo_beneficios_select" on hogar.promo_beneficios
  for select to authenticated using (true);

alter table hogar.promo_beneficio_componentes enable row level security;
create policy "promo_beneficio_componentes_select" on hogar.promo_beneficio_componentes
  for select to authenticated using (true);

alter table hogar.promo_beneficio_tarjetas enable row level security;
create policy "promo_beneficio_tarjetas_select" on hogar.promo_beneficio_tarjetas
  for select to authenticated using (true);

alter table hogar.promo_ingestas enable row level security;
create policy "promo_ingestas_select" on hogar.promo_ingestas
  for select to authenticated using (true);

alter table hogar.promo_descartadas enable row level security;
create policy "promo_descartadas_no_access" on hogar.promo_descartadas
  for all to authenticated
  using (false)
  with check (false);

-- ============ RLS: tablas por familia ============

alter table hogar.tarjetas_familia enable row level security;

create policy "tarjetas_familia_select" on hogar.tarjetas_familia
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "tarjetas_familia_insert" on hogar.tarjetas_familia
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "tarjetas_familia_update" on hogar.tarjetas_familia
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "tarjetas_familia_delete" on hogar.tarjetas_familia
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.comercios_favoritos enable row level security;

create policy "comercios_favoritos_select" on hogar.comercios_favoritos
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "comercios_favoritos_insert" on hogar.comercios_favoritos
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "comercios_favoritos_update" on hogar.comercios_favoritos
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "comercios_favoritos_delete" on hogar.comercios_favoritos
  for delete to authenticated
  using (family_id = hogar.current_family_id());

-- ============ Grants ============
-- El ALTER DEFAULT PRIVILEGES de la 005 le da select/insert/update/delete
-- a authenticated sobre toda tabla nueva de hogar. En las tablas globales
-- se revoca y se deja solo select (dos barreras: sin política de escritura
-- y sin privilegio). promo_descartadas, nada. Lo mismo para anon.

revoke all on hogar.promociones, hogar.promo_comercios, hogar.promo_beneficios,
  hogar.promo_beneficio_componentes, hogar.promo_beneficio_tarjetas,
  hogar.promo_descartadas, hogar.promo_ingestas
  from authenticated, anon;

grant select on hogar.promociones, hogar.promo_comercios, hogar.promo_beneficios,
  hogar.promo_beneficio_componentes, hogar.promo_beneficio_tarjetas,
  hogar.promo_ingestas
  to authenticated;

grant select, insert, update, delete on hogar.tarjetas_familia to authenticated;
grant select, insert, update, delete on hogar.comercios_favoritos to authenticated;

-- service_role: la 007 ya dejó un default privilege, pero se otorga
-- explícito igual (regla 12 del CLAUDE.md).

grant select, insert, update, delete on hogar.promociones, hogar.promo_comercios,
  hogar.promo_beneficios, hogar.promo_beneficio_componentes,
  hogar.promo_beneficio_tarjetas, hogar.promo_descartadas, hogar.promo_ingestas,
  hogar.tarjetas_familia, hogar.comercios_favoritos
  to service_role;
