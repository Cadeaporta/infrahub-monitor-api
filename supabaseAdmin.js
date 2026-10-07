const { createClient } = require('@supabase/supabase-js');

// Essa key NUNCA pode ir pro cliente/extensão. Só existe aqui, no servidor,
// lida via variável de ambiente da Vercel.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = { supabaseAdmin };
