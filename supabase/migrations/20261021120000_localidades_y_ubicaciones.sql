-- ============================================================
-- Ofix — localidades de todo el país y distancias por dirección
--
-- * Reemplaza la lista fija de 10 localidades por las ~3.900 de
--   Georef (supabase/datos/localidades.json), con provincia.
-- * Cada dirección guarda sus coordenadas: exactas si se pudo
--   ubicar la calle y la altura, o el centro de la localidad si no.
-- * Las distancias a los profesionales se calculan desde la
--   dirección del pedido. La ubicación exacta del cliente nunca se
--   expone a los profesionales: solo ven la distancia.
-- ============================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists http with schema extensions;

-- "Zárate" → "zarate", para buscar sin importar tildes ni mayúsculas
create function private.normalizar(t text) returns text
language sql immutable parallel safe set search_path = ''
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))) $$;

-- Distancia en km entre dos puntos (fórmula del semiverseno)
create function private.distancia_km(lat1 double precision, lng1 double precision,
                                     lat2 double precision, lng2 double precision)
returns double precision
language sql immutable parallel safe set search_path = ''
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- ---------- Catálogo nuevo ----------

create table public.localidades_ar (
  id text primary key,                -- id de Georef
  nombre text not null,
  departamento_id text not null,
  departamento text not null,
  provincia_id text not null,
  provincia text not null,
  lat double precision not null,      -- centro de la localidad
  lng double precision not null,
  busqueda text not null              -- nombre normalizado para buscar
);
create index on public.localidades_ar (provincia_id);

do $$
declare
  v_resp extensions.http_response;
  v_datos jsonb;
  v_cantidad int;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '60000');
  v_resp := extensions.http_get('https://raw.githubusercontent.com/leandrovaldez99/Ofix/main/supabase/datos/localidades.json');
  if v_resp.status <> 200 then
    raise exception 'No se pudo descargar localidades.json (HTTP %)', v_resp.status;
  end if;
  v_datos := v_resp.content::jsonb;

  insert into public.localidades_ar (id, nombre, departamento_id, departamento, provincia_id, provincia, lat, lng, busqueda)
  select f->>0, f->>1, f->>2, f->>3, f->>4, f->>5, (f->>6)::double precision, (f->>7)::double precision, private.normalizar(f->>1)
  from jsonb_array_elements(v_datos->'localidades') f;

  get diagnostics v_cantidad = row_count;
  if v_cantidad < 3000 then
    raise exception 'Se cargaron solo % localidades', v_cantidad;
  end if;
end;
$$;

drop extension http;

-- ---------- Columnas nuevas ----------

alter table public.direcciones
  drop constraint direcciones_localidad_fkey,
  add column localidad_id text references public.localidades_ar,
  add column provincia text,
  add column lat double precision,
  add column lng double precision,
  -- false: no se encontró la altura y se usa el centro de la localidad
  add column ubicacion_exacta boolean not null default false;

alter table public.profesionales
  drop constraint profesionales_localidad_fkey,
  add column localidad_id text references public.localidades_ar,
  add column provincia text,
  add column lat double precision,
  add column lng double precision;

alter table public.pedidos
  drop constraint pedidos_localidad_fkey,
  add column localidad_id text references public.localidades_ar,
  add column provincia text;

alter table public.ofertas
  add column distancia_km double precision;

-- Si había datos con las localidades viejas, se pasan a la más cercana
update public.direcciones d set localidad_id = (
  select n.id from public.localidades o, public.localidades_ar n
  where o.nombre = d.localidad
  order by private.distancia_km(o.lat, o.lng, n.lat, n.lng) limit 1);
update public.profesionales p set localidad_id = (
  select n.id from public.localidades o, public.localidades_ar n
  where o.nombre = p.localidad
  order by private.distancia_km(o.lat, o.lng, n.lat, n.lng) limit 1);
update public.pedidos p set localidad_id = (
  select n.id from public.localidades o, public.localidades_ar n
  where o.nombre = p.localidad
  order by private.distancia_km(o.lat, o.lng, n.lat, n.lng) limit 1);

update public.direcciones d set localidad = n.nombre, provincia = n.provincia, lat = n.lat, lng = n.lng
from public.localidades_ar n where n.id = d.localidad_id;
update public.profesionales p set localidad = n.nombre, provincia = n.provincia, lat = n.lat, lng = n.lng
from public.localidades_ar n where n.id = p.localidad_id;
update public.pedidos p set localidad = n.nombre, provincia = n.provincia
from public.localidades_ar n where n.id = p.localidad_id;

alter table public.direcciones
  alter column localidad_id set not null, alter column provincia set not null,
  alter column lat set not null, alter column lng set not null;
alter table public.profesionales
  alter column localidad_id set not null, alter column provincia set not null,
  alter column lat set not null, alter column lng set not null;
alter table public.pedidos
  alter column localidad_id set not null, alter column provincia set not null;

create index on public.direcciones (localidad_id);
create index on public.profesionales (localidad_id);
create index on public.pedidos (localidad_id);

-- ---------- Reemplazo del catálogo viejo ----------

-- Las funciones viejas usan la tabla y la distancia por nombre: se reescriben abajo
drop function public.buscar_profesionales(text, text, int, boolean, boolean, text);
drop table public.localidades;
drop function private.distancia_km(text, text);
alter table public.localidades_ar rename to localidades;
alter index public.localidades_ar_pkey rename to localidades_pkey;
alter index public.localidades_ar_provincia_id_idx rename to localidades_provincia_id_idx;

alter table public.localidades enable row level security;
create policy "catálogo público" on public.localidades for select to anon, authenticated using (true);
revoke all on public.localidades from anon, authenticated;
grant select on public.localidades to anon, authenticated;

-- Ubicación exacta de cada pedido (copia de la dirección al publicarlo).
-- Está en el esquema privado: solo la usan las funciones del servidor.
create table private.pedidos_ubicacion (
  pedido_id bigint primary key references public.pedidos on delete cascade,
  lat double precision not null,
  lng double precision not null
);
alter table private.pedidos_ubicacion enable row level security;
revoke all on private.pedidos_ubicacion from public, anon, authenticated;

-- ---------- Completar localidad y coordenadas al guardar ----------

-- Direcciones: el nombre y la provincia salen del catálogo. Si el navegador
-- no pudo ubicar la dirección, se usa el centro de la localidad.
create function private.completar_direccion() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v public.localidades;
begin
  select * into v from public.localidades where id = new.localidad_id;
  if v.id is null then
    raise exception 'Elegí una localidad de la lista';
  end if;
  new.localidad := v.nombre;
  new.provincia := v.provincia;
  if new.lat is null or new.lng is null then
    new.lat := v.lat;
    new.lng := v.lng;
    new.ubicacion_exacta := false;
  elsif private.distancia_km(new.lat, new.lng, v.lat, v.lng) > 60 then
    raise exception 'La ubicación de la dirección no coincide con la localidad elegida';
  else
    new.ubicacion_exacta := true;
  end if;
  return new;
end;
$$;

create trigger completar_direccion before insert or update of localidad_id, lat, lng on public.direcciones
for each row execute function private.completar_direccion();

-- Profesionales: la base es el centro de su localidad
create function private.completar_profesional() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v public.localidades;
begin
  select * into v from public.localidades where id = new.localidad_id;
  if v.id is null then
    raise exception 'Elegí una localidad de la lista';
  end if;
  new.localidad := v.nombre;
  new.provincia := v.provincia;
  new.lat := v.lat;
  new.lng := v.lng;
  return new;
end;
$$;

create trigger completar_profesional before insert or update of localidad_id on public.profesionales
for each row execute function private.completar_profesional();

-- ---------- Permisos por columna ----------

revoke insert, update on public.direcciones from authenticated;
grant insert (calle, numero, localidad_id, cp, principal, lat, lng),
      update (calle, numero, localidad_id, cp, principal, lat, lng)
  on public.direcciones to authenticated;

revoke insert, update on public.profesionales from authenticated;
grant insert (id, descripcion, localidad_id, radio_km), update (descripcion, localidad_id, radio_km)
  on public.profesionales to authenticated;

-- ---------- Vista pública de profesionales (columnas nuevas al final) ----------

create or replace view public.profesionales_publicos with (security_invoker = true) as
select
  p.id,
  pf.nombre,
  pf.apellido,
  p.descripcion,
  p.localidad,
  p.radio_km,
  p.estado_validacion,
  p.created_at,
  (p.disponible_fecha = private.hoy()) as disponible_hoy,
  exists (
    select 1 from public.documentos d
    where d.profesional_id = p.id and d.tipo = 'certificado' and d.estado = 'verificado'
  ) as matriculado,
  coalesce((select array_agg(o.oficio_id order by of.orden)
            from public.profesional_oficios o join public.oficios of on of.id = o.oficio_id
            where o.profesional_id = p.id), '{}') as oficios,
  (select round(avg(r.puntaje)::numeric, 1) from public.resenas r where r.profesional_id = p.id) as promedio,
  (select count(*) from public.resenas r where r.profesional_id = p.id)::int as cantidad_resenas,
  private.servicios(p.id) as servicios,
  p.localidad_id,
  p.provincia,
  p.lat,
  p.lng
from public.profesionales p
join public.perfiles pf on pf.id = p.id;

-- ---------- Flujo del pedido con distancias exactas ----------

-- Punto del pedido: la dirección exacta o, si falta, el centro de la localidad
create function private.punto_pedido(p_pedido bigint, out lat double precision, out lng double precision)
language sql stable set search_path = ''
as $$
  select coalesce(u.lat, l.lat), coalesce(u.lng, l.lng)
  from public.pedidos p
  join public.localidades l on l.id = p.localidad_id
  left join private.pedidos_ubicacion u on u.pedido_id = p.id
  where p.id = p_pedido
$$;

create or replace function private.ofrecer(p_pedido bigint) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_pedido public.pedidos;
  v_punto record;
  v_cantidad int;
begin
  select * into v_pedido from public.pedidos where id = p_pedido;
  select * into v_punto from private.punto_pedido(p_pedido);

  -- Las ofertas viejas que nadie tomó se vuelven a ofrecer
  delete from public.ofertas where pedido_id = p_pedido and estado in ('pendiente', 'no_disponible');

  with candidatos as (
    select p.id, p.radio_km,
      private.distancia_km(p.lat, p.lng, v_punto.lat, v_punto.lng) as km,
      coalesce((select avg(r.puntaje) from public.resenas r where r.profesional_id = p.id), 4.0) as prom,
      (select count(*) from public.pedidos t where t.profesional_id = p.id and t.estado = 'terminado') as hechos
    from public.profesionales p
    join public.profesional_oficios po on po.profesional_id = p.id and po.oficio_id = v_pedido.oficio_id
    where p.estado_validacion = 'validado'
      and p.disponible_fecha = private.hoy()
      and p.id <> v_pedido.cliente_id
      and not exists (
        select 1 from public.ofertas o
        where o.pedido_id = p_pedido and o.profesional_id = p.id and o.estado = 'rechazada'
      )
  ),
  ranking as (
    select id, km, row_number() over (order by prom * 20 + least(hechos, 50) * 0.4 - km * 2 desc) as puesto
    from candidatos
    where km <= least(v_pedido.radio_km, radio_km)
  )
  insert into public.ofertas (pedido_id, profesional_id, visible_desde, prioridad_hasta, distancia_km)
  select p_pedido, id,
    case when puesto = 1 then now() else now() + interval '5 minutes' end,
    case when puesto = 1 then now() + interval '5 minutes' end,
    km
  from ranking;

  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;

create or replace function public.publicar_pedido(
  p_oficio text, p_titulo text, p_descripcion text, p_direccion bigint,
  p_modo text, p_profesional uuid default null
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_dir public.direcciones;
  v_id bigint;
begin
  if not exists (select 1 from public.perfiles where id = v_uid and rol = 'cliente') then
    raise exception 'Solo los clientes pueden publicar pedidos';
  end if;
  select * into v_dir from public.direcciones where id = p_direccion and cliente_id = v_uid;
  if v_dir.id is null then
    raise exception 'Elegí una de tus direcciones';
  end if;
  if p_modo not in ('primero', 'elegido') then
    raise exception 'Modo inválido';
  end if;

  insert into public.pedidos (cliente_id, oficio_id, titulo, descripcion, direccion_id,
    localidad_id, localidad, provincia, modo, estado, vence_at)
  values (v_uid, p_oficio, p_titulo, p_descripcion, p_direccion,
    v_dir.localidad_id, v_dir.localidad, v_dir.provincia, p_modo,
    case when p_modo = 'elegido' and p_profesional is null then 'borrador' else 'buscando' end,
    case when p_modo = 'elegido' and p_profesional is null then null else now() + interval '30 minutes' end)
  returning id into v_id;

  insert into private.pedidos_ubicacion (pedido_id, lat, lng) values (v_id, v_dir.lat, v_dir.lng);

  if p_modo = 'primero' then
    perform private.ofrecer(v_id);
  elsif p_profesional is not null then
    perform public.elegir_profesional(v_id, p_profesional);
  end if;
  return v_id;
end;
$$;

create or replace function public.elegir_profesional(p_pedido bigint, p_profesional uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_pedido public.pedidos;
  v_km double precision;
begin
  select * into v_pedido from public.pedidos where id = p_pedido and cliente_id = auth.uid() for update;
  if v_pedido.id is null then raise exception 'Pedido no encontrado'; end if;
  if v_pedido.estado not in ('borrador', 'buscando') then
    raise exception 'El pedido ya tiene profesional';
  end if;
  if not exists (
    select 1 from public.profesionales p
    join public.profesional_oficios po on po.profesional_id = p.id and po.oficio_id = v_pedido.oficio_id
    where p.id = p_profesional and p.estado_validacion = 'validado'
  ) then
    raise exception 'Ese profesional no trabaja en este oficio';
  end if;

  select private.distancia_km(p.lat, p.lng, pt.lat, pt.lng) into v_km
  from public.profesionales p, private.punto_pedido(p_pedido) pt
  where p.id = p_profesional;

  delete from public.ofertas where pedido_id = p_pedido and estado in ('pendiente', 'no_disponible');
  insert into public.ofertas (pedido_id, profesional_id, elegido, distancia_km)
  values (p_pedido, p_profesional, true, v_km)
  on conflict (pedido_id, profesional_id)
  do update set estado = 'pendiente', elegido = true, visible_desde = now(), prioridad_hasta = null,
    distancia_km = excluded.distancia_km;

  update public.pedidos
  set modo = 'elegido', estado = 'buscando', vence_at = now() + interval '30 minutes'
  where id = p_pedido;
end;
$$;

-- Búsqueda de profesionales desde un punto (la dirección del cliente)
create function public.buscar_profesionales(
  p_oficio text, p_lat double precision, p_lng double precision, p_radio int default 15,
  p_solo_hoy boolean default false, p_solo_matriculados boolean default false,
  p_orden text default 'puntaje'
) returns table (
  id uuid, nombre text, apellido text, localidad text, provincia text, distancia_km double precision,
  promedio numeric, cantidad_resenas int, oficios text[], disponible_hoy boolean, matriculado boolean
)
language sql stable set search_path = ''
as $$
  select * from (
    select pp.id, pp.nombre, pp.apellido, pp.localidad, pp.provincia,
      private.distancia_km(pp.lat, pp.lng, p_lat, p_lng) as distancia_km,
      pp.promedio, pp.cantidad_resenas, pp.oficios, pp.disponible_hoy, pp.matriculado
    from public.profesionales_publicos pp
    where pp.estado_validacion = 'validado'
      and p_oficio = any (pp.oficios)
      and (not p_solo_hoy or pp.disponible_hoy)
      and (not p_solo_matriculados or pp.matriculado)
  ) t
  where t.distancia_km <= p_radio
  order by
    case when p_orden = 'cerca' then t.distancia_km end asc,
    t.promedio desc nulls last,
    t.distancia_km asc
$$;

-- ---------- Búsqueda de localidades ----------

-- Hasta 20 localidades que contienen el texto; primero las que empiezan igual
create function public.buscar_localidades(p_texto text, p_provincia text default null)
returns table (id text, nombre text, departamento text, provincia_id text, provincia text,
               lat double precision, lng double precision)
language sql stable security definer set search_path = ''
as $$
  with q as (
    select replace(replace(replace(private.normalizar(trim(p_texto)), '\', ''), '%', ''), '_', '') as t
  )
  select l.id, l.nombre, l.departamento, l.provincia_id, l.provincia, l.lat, l.lng
  from public.localidades l, q
  where char_length(q.t) >= 2
    and (p_provincia is null or l.provincia_id = p_provincia)
    and l.busqueda like '%' || q.t || '%'
  order by (l.busqueda like q.t || '%') desc, char_length(l.nombre), l.nombre
  limit 20
$$;

-- La localidad más cercana a un punto (para "Usar mi ubicación")
create function public.localidad_cercana(p_lat double precision, p_lng double precision)
returns table (id text, nombre text, departamento text, provincia_id text, provincia text,
               lat double precision, lng double precision, distancia_km double precision)
language sql stable security definer set search_path = ''
as $$
  select l.id, l.nombre, l.departamento, l.provincia_id, l.provincia, l.lat, l.lng,
    private.distancia_km(p_lat, p_lng, l.lat, l.lng) as distancia_km
  from public.localidades l
  order by 8
  limit 1
$$;

-- ---------- Permisos de las funciones nuevas ----------

revoke execute on function private.normalizar(text) from public, anon;
revoke execute on function private.distancia_km(double precision, double precision, double precision, double precision) from public, anon;
revoke execute on function private.punto_pedido(bigint) from public, anon, authenticated;
grant execute on function private.normalizar(text) to authenticated;
grant execute on function private.distancia_km(double precision, double precision, double precision, double precision) to authenticated;

revoke execute on function public.buscar_profesionales(text, double precision, double precision, int, boolean, boolean, text) from public, anon;
grant execute on function public.buscar_profesionales(text, double precision, double precision, int, boolean, boolean, text) to authenticated;

revoke execute on function public.buscar_localidades(text, text) from public;
revoke execute on function public.localidad_cercana(double precision, double precision) from public;
grant execute on function public.buscar_localidades(text, text) to anon, authenticated;
grant execute on function public.localidad_cercana(double precision, double precision) to anon, authenticated;
