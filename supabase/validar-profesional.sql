-- Aprobar a un profesional (se corre a mano en el SQL Editor de Supabase).
-- Mientras está "pendiente" no recibe pedidos ni aparece en las búsquedas.
-- Reemplazá el correo por el del profesional.

update public.profesionales
set estado_validacion = 'validado'
where id = (select id from auth.users where email = 'profesional@mail.com');

-- Marcar como verificados su DNI y sus certificados
-- (los certificados verificados le dan el sello "Matriculado")
update public.documentos
set estado = 'verificado'
where profesional_id = (select id from auth.users where email = 'profesional@mail.com');

-- Ver profesionales pendientes y sus documentos
select u.email, pf.nombre, pf.apellido, p.estado_validacion, d.tipo, d.nombre as documento, d.archivo, d.estado
from public.profesionales p
join public.perfiles pf on pf.id = p.id
join auth.users u on u.id = p.id
left join public.documentos d on d.profesional_id = p.id
where p.estado_validacion = 'pendiente'
order by u.email;
