const { supabaseAdmin } = require('./supabaseAdmin');

module.exports = async (req, res) => {
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ erro: 'method not allowed' });
  }
  if (!process.env.ADMIN_SECRET || req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  if (req.method === 'DELETE') {
    const id = String((req.body || {}).id || '').trim();
    if (!id) return res.status(400).json({ erro: 'id é obrigatório' });

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('maquinas_tv')
      .update({
        status_aprovacao: 'revogada',
        revogada_em: now,
        deleted_at: now,
        updated_at: now
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[InfraHub] falha ao revogar TV:', error);
      return res.status(500).json({ erro: 'falha ao remover máquina' });
    }
    if (!data) return res.status(404).json({ erro: 'máquina não encontrada' });

    // Do not delete commands or events: they are audit history and may be needed for 14 days.
    return res.status(200).json({ ok: true, maquina_id: id, status_aprovacao: 'revogada' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('maquinas_tv')
      .select('id, nome, hostname, machine_uuid, status_aprovacao, aprovada_em, revogada_em, configuracao, perfil_id, url_esperada, url_atual, ultimo_heartbeat, ultima_atividade, ultimo_erro, unidade, created_at, updated_at')
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    if (error) {
      console.error('[InfraHub] falha ao buscar máquinas:', error);
      return res.status(500).json({ erro: 'falha ao buscar máquinas' });
    }

    const maquinas = data || [];
    const ids = maquinas.map((item) => item.id);
    if (!ids.length) return res.status(200).json({ maquinas: [] });

    const { data: comandos, error: comandosError } = await supabaseAdmin
      .from('comandos')
      .select('id, maquina_id, tipo, status, erro, created_at, recebido_em, iniciado_em, concluido_em, falhou_em, prazo_em')
      .in('maquina_id', ids)
      .order('created_at', { ascending: false })
      .limit(300);

    if (comandosError) {
      console.error('[InfraHub] falha ao buscar status dos comandos:', comandosError);
      return res.status(500).json({ erro: 'falha ao buscar status dos comandos' });
    }

    const ultimoPorMaquina = new Map();
    for (const comando of comandos || []) {
      if (!ultimoPorMaquina.has(comando.maquina_id)) ultimoPorMaquina.set(comando.maquina_id, comando);
    }

    return res.status(200).json({
      maquinas: maquinas.map((item) => ({
        ...item,
        ultimo_comando: ultimoPorMaquina.get(item.id) || null
      }))
    });
  }

  const body = req.body || {};
  const id = String(body.id || '').trim();
  if (!id) return res.status(400).json({ erro: 'id é obrigatório' });

  const updates = { updated_at: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(body, 'nome')) {
    const nome = String(body.nome || '').trim();
    if (!nome || nome.length > 255) return res.status(400).json({ erro: 'nome inválido' });
    updates.nome = nome;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'url_esperada')) {
    const raw = String(body.url_esperada || '').trim();
    if (raw) {
      try {
        const parsed = new URL(raw);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
      } catch {
        return res.status(400).json({ erro: 'url_esperada deve ser uma URL HTTP ou HTTPS válida' });
      }
    }
    updates.url_esperada = raw || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'configuracao')) {
    if (!body.configuracao || typeof body.configuracao !== 'object' || Array.isArray(body.configuracao)) {
      return res.status(400).json({ erro: 'configuracao deve ser um objeto JSON' });
    }
    updates.configuracao = body.configuracao;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'perfil_id')) {
    updates.perfil_id = body.perfil_id || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'unidade')) {
    // Kept only for legacy clients. The current dashboard should group units locally.
    updates.unidade = String(body.unidade || '').trim() || null;
  }
  delete updates.updated_at;
  if (!Object.keys(updates).length) {
    return res.status(400).json({ erro: 'informe pelo menos um campo para atualizar' });
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('maquinas_tv')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, nome, hostname, machine_uuid, status_aprovacao, configuracao, perfil_id, url_esperada, url_atual, ultimo_heartbeat, ultima_atividade, ultimo_erro, unidade, updated_at')
    .maybeSingle();

  if (error) {
    console.error('[InfraHub] falha ao atualizar máquina:', error);
    return res.status(500).json({ erro: 'falha ao atualizar máquina' });
  }
  if (!data) return res.status(404).json({ erro: 'máquina não encontrada' });
  return res.status(200).json({ maquina: data });
};
