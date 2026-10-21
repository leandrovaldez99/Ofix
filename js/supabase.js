// Conexión con Supabase. La clave "publishable" es pública: la seguridad
// la dan las políticas RLS de la base de datos, no esta clave.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/+esm';

const SUPABASE_URL = 'https://tfbuydlfzrsktqypudht.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Y4B6Ylp9vrysB2wMXGpkvw_IMe6kPg_';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
});
