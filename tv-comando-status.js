const { supabaseAdmin } = require('./supabaseAdmin');
const { validarMaquina } = require('./auth');

const TRANSITIONS = {
  recebido: ['enviado', 'recebido'],
  executando: ['recebido', 'executando'],
  concluido: ['recebido', 'executando', 'concluido'],
  falhou: ['recebido', 'executando', 'falhou']
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method not allowed' });
  const body = req.body || {};
  const maquina = await validarMaquina(supabaseAdmin, body.maquina_id, body.token);
  if (!maquina) return res.status(401).json({ erro: 'token inválido ou máquina não aprovada' });

  const comando_id = String(body.comando_id || '').trim();
  const status = String(body.status || '').trim();
  const erro = typeof body.erro === 'string' ? body.erro.slice(0, 2000) : null;
  if (!comando_id || !Object.prototype.hasOwnProperty.call(TRANSITIONS, status)) {
    return res.status(400).json({ erro: 'comando_id ou status inválido' });
  }

  const { data: comando, error: lookupError } = await supabaseAdmin
    .from('comandos')
    .select('id, status, executado')
    .eq('id', comando_id)
    .eq('maquina_id', maquina.id)
    .maybeSingle();

  if (lookupError) {
    console.error('[InfraHub] falha ao consultar comando:', lookupError);
    return res.status(500).json({ erro: 'falha ao consultar comando' });
  }
  if (!comando) return res.status(404).json({ erro: 'comando não encontrado' });
  if (!TRANSITIONS[status].includes(comando.status)) {
    return res.status(409).json({ erro: 'transição de status inválida', status_atual: comando.status });
  }

  const now = new Date().toISOString();
  const updates = { status, atualizado_em: now };
  if (status === 'recebido') updates.recebido_em = now;
  if (status === 'executando') updates.iniciado_em = now;
  if (status === 'concluido') {
    updates.concluido_em = now;
    updates.executado = true;
    updates.erro = null;
  }
  if (status === 'falhou') {
    updates.falhou_em = now;
    updates.executado = true;
    updates.erro = erro || 'A TV informou que a execução falhou.';
  }

  const { data, error } = await supabaseAdmin
    .from('comandos')
    .update(updates)
    .eq('id', comando_id)
    .eq('maquina_id', maquina.id)
    .select('id, status, erro, recebido_em, iniciado_em, concluido_em, falhou_em')
    .single();

  if (error) {
    console.error('[InfraHub] falha ao atualizar status do comando:', error);
    return res.status(500).json({ erro: 'falha ao atualizar status do comando' });
  }
  return res.status(200).json({ ok: true, comando: data });
};
