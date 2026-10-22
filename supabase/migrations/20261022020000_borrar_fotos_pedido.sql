-- ============================================================
-- Ofix — el cliente puede quitar fotos de su pedido
-- (al reactivarlo, desde la pantalla de publicar)
-- ============================================================

create policy "borrar fotos de mi pedido" on storage.objects for delete to authenticated
  using (bucket_id = 'pedidos' and private.es_cliente_pedido(private.pedido_de_ruta(name)));
