const { supabaseAdmin } = require('./supabaseAdmin');
const { validarMaquina } = require('./auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'method not allowed' });
  const { maquina_id, token } = req.query || {};
  const maquina = await validarMaquina(supabaseAdmin, maquina_id, token);
  if (!maquina) return res.status(401).json({ erro: 'token inválido ou máquina não aprovada' });

  const now = new Date().toISOString();

  // Expired commands that never completed are marked failed and retained for audit.
  const { error: timeoutError } = await supabaseAdmin
    .from('comandos')
    .update({
      status: 'falhou',
      executado: true,
      falhou_em: now,
      atualizado_em: now,
      erro: 'A TV não confirmou a execução dentro do prazo.'
    })
    .eq('maquina_id', maquina.id)
    .eq('executado', false)
    .in('status', ['enviado', 'recebido', 'executando'])
    .lt('prazo_em', now);

  if (timeoutError) {
    console.error('[InfraHub] falha ao expirar comandos:', timeoutError);
    return res.status(500).json({ erro: 'falha ao verificar timeout de comandos' });
  }

  const { data: pendentes, error } = await supabaseAdmin
    .from('comandos')
    .select('id, tipo, payload, status, prazo_em, created_at')
    .eq('maquina_id', maquina.id)
    .eq('executado', false)
    .eq('status', 'enviado')
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) {
    console.error('[InfraHub] falha ao buscar comandos:', error);
    return res.status(500).json({ erro: 'falha ao buscar comandos' });
  }

  const ids = (pendentes || []).map((item) => item.id);
  if (ids.length) {
    const { error: receiveError } = await supabaseAdmin
      .from('comandos')
      .update({ status: 'recebido', recebido_em: now, atualizado_em: now })
      .in('id', ids)
      .eq('maquina_id', maquina.id)
      .eq('status', 'enviado');
    if (receiveError) {
      console.error('[InfraHub] falha ao marcar comandos recebidos:', receiveError);
      return res.status(500).json({ erro: 'falha ao confirmar recebimento dos comandos' });
    }
  }

  const comandos = (pendentes || []).map((comando) => {
    let payload = comando.payload || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }
    return { ...comando, status: 'recebido', payload };
  });

  return res.status(200).json({ comandos });
};
