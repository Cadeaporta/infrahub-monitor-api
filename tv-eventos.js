const { supabaseAdmin } = require('./supabaseAdmin');
const { validarMaquina } = require('./auth');

const NIVEIS = new Set(['debug', 'info', 'aviso', 'erro']);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method not allowed' });
  const body = req.body || {};
  const maquina = await validarMaquina(supabaseAdmin, body.maquina_id, body.token);
  if (!maquina) return res.status(401).json({ erro: 'token inválido ou máquina não aprovada' });

  const entrada = Array.isArray(body.eventos) ? body.eventos : [body.evento || body];
  if (!entrada.length || entrada.length > 50) {
    return res.status(400).json({ erro: 'envie de 1 a 50 eventos por requisição' });
  }

  const recebido_em = new Date().toISOString();
  const rows = [];
  for (const item of entrada) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const tipo = String(item.tipo || item.evento || '').trim().slice(0, 100);
    if (!tipo) continue;
    const ocorrido = item.ocorrido_em ? new Date(item.ocorrido_em) : new Date();
    const nivel = NIVEIS.has(item.nivel) ? item.nivel : 'info';
    let detalhes = item.detalhes && typeof item.detalhes === 'object' && !Array.isArray(item.detalhes)
      ? item.detalhes : {};
    // Bound payload size to avoid a device accidentally flooding the event table.
    const detalhesTexto = JSON.stringify(detalhes);
    if (detalhesTexto.length > 8000) detalhes = { truncado: true, resumo: detalhesTexto.slice(0, 7900) };
    rows.push({
      maquina_id: maquina.id,
      machine_uuid: maquina.machine_uuid || null,
      hostname: maquina.hostname || null,
      tipo,
      nivel,
      mensagem: String(item.mensagem || '').slice(0, 2000) || null,
      detalhes,
      ocorrido_em: Number.isNaN(ocorrido.getTime()) ? recebido_em : ocorrido.toISOString(),
      recebido_em
    });
  }

  if (!rows.length) return res.status(400).json({ erro: 'nenhum evento válido' });
  const { error } = await supabaseAdmin.from('tv_eventos').insert(rows);
  if (error) {
    console.error('[InfraHub] falha ao gravar eventos:', error);
    return res.status(500).json({ erro: 'falha ao gravar eventos' });
  }

  const erros = rows.filter((row) => row.nivel === 'erro').slice(-1)[0];
  const updates = { ultima_atividade: recebido_em, updated_at: recebido_em };
  if (erros) updates.ultimo_erro = erros.mensagem || erros.tipo;
  await supabaseAdmin.from('maquinas_tv').update(updates).eq('id', maquina.id);

  return res.status(201).json({ ok: true, recebidos: rows.length });
};
