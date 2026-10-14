const { supabaseAdmin } = require('./supabaseAdmin');
const { validarMaquina } = require('./auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'method not allowed' });
  }

  const { maquina_id, token, url_atual, comando_id, hostname } = req.body || {};
  const maquina = await validarMaquina(supabaseAdmin, maquina_id, token);

  if (!maquina) {
    return res.status(401).json({ erro: 'token inválido ou máquina não aprovada' });
  }

  const now = new Date().toISOString();
  const updates = {
    ultimo_heartbeat: now,
    ultima_atividade: now,
    url_atual: typeof url_atual === 'string' ? url_atual.slice(0, 2048) : null
  };

  // Hostname is informational. The trusted local helper is expected to supply it.
  if (typeof hostname === 'string' && hostname.trim()) {
    updates.hostname = hostname.trim().slice(0, 255);
  }

  const { error } = await supabaseAdmin
    .from('maquinas_tv')
    .update(updates)
    .eq('id', maquina.id)
    .eq('status_aprovacao', 'aprovada')
    .is('deleted_at', null);

  if (error) {
    console.error('[InfraHub] falha ao gravar heartbeat:', error);
    return res.status(500).json({ erro: 'falha ao gravar heartbeat' });
  }

  if (comando_id) {
    const { error: comandoError } = await supabaseAdmin
      .from('comandos')
      .update({
        executado: true,
        status: 'concluido',
        concluido_em: now,
        atualizado_em: now
      })
      .eq('id', comando_id)
      .eq('maquina_id', maquina.id)
      .neq('status', 'falhou');

    if (comandoError) {
      console.error('[InfraHub] falha ao confirmar comando:', comandoError);
      return res.status(500).json({ erro: 'heartbeat gravado, mas falha ao confirmar comando' });
    }
  }

  return res.status(200).json({ ok: true, servidor_em: now });
};
