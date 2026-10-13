const { supabaseAdmin } = require('./supabaseAdmin');

const ALLOWED_TYPES = new Set([
  'reload', 'navigate', 'navegar', 'abrir_url', 'abrir_urls',
  'tab_turner_start', 'tab_turner_stop', 'config_sync'
]);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method not allowed' });
  if (!process.env.ADMIN_SECRET || req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  const { maquina_id, tipo, payload } = req.body || {};
  if (!maquina_id || !tipo) return res.status(400).json({ erro: 'maquina_id e tipo são obrigatórios' });
  if (!ALLOWED_TYPES.has(tipo)) return res.status(400).json({ erro: 'tipo de comando não permitido' });

  const { data: maquina, error: maquinaError } = await supabaseAdmin
    .from('maquinas_tv')
    .select('id, status_aprovacao, deleted_at')
    .eq('id', maquina_id)
    .maybeSingle();

  if (maquinaError || !maquina || maquina.deleted_at || maquina.status_aprovacao !== 'aprovada') {
    return res.status(404).json({ erro: 'máquina não encontrada ou não aprovada' });
  }

  const payloadSafe = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const now = new Date();
  const prazo = new Date(now.getTime() + 120000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('comandos')
    .insert({
      maquina_id,
      tipo,
      payload: payloadSafe,
      executado: false,
      status: 'enviado',
      prazo_em: prazo,
      atualizado_em: now.toISOString()
    })
    .select('id, maquina_id, tipo, payload, executado, status, prazo_em, created_at')
    .single();

  if (error) {
    console.error('[InfraHub] falha ao criar comando:', error);
    return res.status(500).json({ erro: 'falha ao criar comando' });
  }

  return res.status(201).json({ ok: true, comando: data });
};
