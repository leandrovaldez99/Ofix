-- ============================================================
-- Ofix — reactivar un pedido eligiendo de nuevo cómo buscar
--
-- "Reactivar pedido" abre la pantalla de publicar con los datos del
-- pedido. El cliente puede corregirlos y elige otra vez entre "Que lo
-- tome el primero disponible" y "Quiero elegir yo". Se actualiza el
-- mismo pedido (mismo número), sin crear una copia.
-- ============================================================

drop function public.reactivar_pedido(bigint);

-- Devuelve el estado nuevo: 'buscando' o 'borrador'
create function public.reactivar_pedido(
  p_pedido bigint, p_modo text, p_oficio text, p_titulo text, p_descripcion text, p_direccion bigint
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pedido public.pedidos;
  v_dir public.direcciones;
begin
  select * into v_pedido from public.pedidos
  where id = p_pedido and cliente_id = v_uid for update;
  if v_pedido.id is null then
    raise exception 'Pedido no encontrado';
  end if;
  if v_pedido.estado <> 'cancelado' then
    raise exception 'El pedido no está desactivado';
  end if;
  if v_pedido.confirmado_at is not null then
    raise exception 'Este trabajo ya se había confirmado con un profesional. Publicalo de nuevo como pedido nuevo.';
  end if;
  if p_modo not in ('primero', 'elegido') then
    raise exception 'Modo inválido';
  end if;
  select * into v_dir from public.direcciones where id = p_direccion and cliente_id = v_uid;
  if v_dir.id is null then
    raise exception 'Elegí una de tus direcciones';
  end if;

  -- Se empieza de cero: todos los profesionales vuelven a poder recibirlo
  delete from public.ofertas where pedido_id = p_pedido;

  update public.pedidos set
    oficio_id = p_oficio,
    titulo = p_titulo,
    descripcion = p_descripcion,
    direccion_id = v_dir.id,
    localidad_id = v_dir.localidad_id,
    localidad = v_dir.localidad,
    provincia = v_dir.provincia,
    modo = p_modo,
    estado = case when p_modo = 'primero' then 'buscando' else 'borrador' end,
    vence_at = case when p_modo = 'primero' then now() + interval '30 minutes' end,
    profesional_id = null,
    asignado_at = null,
    visita_at = null,
    terminado_cliente = false,
    terminado_profesional = false,
    cancelado_at = null,
    cancelado_por = null
  where id = p_pedido;

  insert into private.pedidos_ubicacion (pedido_id, lat, lng)
  values (p_pedido, v_dir.lat, v_dir.lng)
  on conflict (pedido_id) do update set lat = excluded.lat, lng = excluded.lng;

  if p_modo = 'primero' then
    perform private.ofrecer(p_pedido);
    return 'buscando';
  end if;
  return 'borrador';
end;
$$;

revoke execute on function public.reactivar_pedido(bigint, text, text, text, text, bigint) from public, anon;
grant execute on function public.reactivar_pedido(bigint, text, text, text, text, bigint) to authenticated;
