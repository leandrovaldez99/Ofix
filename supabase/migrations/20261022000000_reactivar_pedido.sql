-- ============================================================
-- Ofix — desactivar y reactivar un pedido
--
-- "Desactivar" es cancelar (estado 'cancelado'). Un pedido que el
-- cliente desactivó antes de confirmar a un profesional se puede
-- reactivar: vuelve a ofrecerse con el mismo número, sin crear una
-- copia. Si ya había un profesional confirmado (hubo chat), se
-- publica de nuevo como pedido nuevo.
-- ============================================================

-- Devuelve el estado nuevo: 'buscando' (se ofrece al primero disponible)
-- o 'borrador' (el cliente elige profesional de la lista)
create function public.reactivar_pedido(p_pedido bigint) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_pedido public.pedidos;
begin
  select * into v_pedido from public.pedidos
  where id = p_pedido and cliente_id = auth.uid() for update;
  if v_pedido.id is null then
    raise exception 'Pedido no encontrado';
  end if;
  if v_pedido.estado <> 'cancelado' then
    raise exception 'El pedido no está desactivado';
  end if;
  if v_pedido.confirmado_at is not null then
    raise exception 'Este trabajo ya se había confirmado con un profesional. Publicalo de nuevo como pedido nuevo.';
  end if;

  -- Se empieza de cero: todos los profesionales vuelven a poder recibirlo
  delete from public.ofertas where pedido_id = p_pedido;

  update public.pedidos set
    estado = case when modo = 'primero' then 'buscando' else 'borrador' end,
    vence_at = case when modo = 'primero' then now() + interval '30 minutes' end,
    profesional_id = null,
    asignado_at = null,
    visita_at = null,
    terminado_cliente = false,
    terminado_profesional = false,
    cancelado_at = null,
    cancelado_por = null
  where id = p_pedido;

  if v_pedido.modo = 'primero' then
    perform private.ofrecer(p_pedido);
    return 'buscando';
  end if;
  return 'borrador';
end;
$$;

revoke execute on function public.reactivar_pedido(bigint) from public, anon;
grant execute on function public.reactivar_pedido(bigint) to authenticated;
