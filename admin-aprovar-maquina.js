const { supabaseAdmin } = require('./supabaseAdmin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method not allowed' });
  if (!process.env.ADMIN_SECRET || req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  const body = req.body || {};
  const id = String(body.id || '').trim();
  const action = String(body.action || '').trim();
  if (!id || !['aprovar', 'revogar'].includes(action)) {
    return res.status(400).json({ erro: 'id e action (aprovar|revogar) são obrigatórios' });
  }

  const now = new Date().toISOString();
  const updates = action === 'aprovar'
    ? { status_aprovacao: 'aprovada', aprovada_em: now, revogada_em: null, deleted_at: null, updated_at: now }
    : { status_aprovacao: 'revogada', revogada_em: now, updated_at: now };

  const { data, error } = await supabaseAdmin
    .from('maquinas_tv')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, nome, hostname, machine_uuid, status_aprovacao, aprovada_em, revogada_em')
    .maybeSingle();

  if (error) {
    console.error('[InfraHub] falha ao alterar aprovação:', error);
    return res.status(500).json({ erro: 'falha ao alterar aprovação' });
  }
  if (!data) return res.status(404).json({ erro: 'máquina não encontrada ou removida' });

  return res.status(200).json({ ok: true, maquina: data });
};
