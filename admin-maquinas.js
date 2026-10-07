const { supabaseAdmin } = require('./supabaseAdmin');

module.exports = async (req, res) => {
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ erro: 'method not allowed' });
  }

  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  if (req.method === 'DELETE') {
    const body = req.body || {};
    const id = String(body.id || '').trim();

    if (!id) return res.status(400).json({ erro: 'id é obrigatório' });

    const { error: comandosError } = await supabaseAdmin
      .from('comandos')
      .delete()
      .eq('maquina_id', id);

    if (comandosError) {
      console.error(comandosError);
      return res.status(500).json({ erro: 'falha ao excluir comandos da máquina' });
    }

    const { data: maquina, error: maquinaError } = await supabaseAdmin
      .from('maquinas_tv')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (maquinaError) {
      console.error(maquinaError);
      return res.status(500).json({ erro: 'falha ao excluir máquina' });
    }

    if (!maquina) {
      return res.status(404).json({ erro: 'máquina não encontrada' });
    }

    return res.status(200).json({ ok: true, maquina_id: id });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('maquinas_tv')
      .select('id, nome, unidade, url_esperada, url_atual, ultimo_heartbeat')
      .order('nome', { ascending: true });

    if (error) {
      console.error(error);
      return res.status(500).json({ erro: 'falha ao buscar máquinas' });
    }

    return res.status(200).json({ maquinas: data || [] });
  }

  const body = req.body || {};
  const id = String(body.id || '').trim();
  const urlEsperada = String(body.url_esperada || '').trim();
  const unidade = String(body.unidade || '').trim();

  if (!id) {
    return res.status(400).json({ erro: 'id é obrigatório' });
  }

  if (unidade && ![
    'Nova Campinas',
    'Guanabara',
    'Casa de Saude',
    'HVC',
    'Hospital Care',
    'Indaiatuba'
  ].includes(unidade)) {
    return res.status(400).json({ erro: 'unidade inválida' });
  }

  if (urlEsperada) {
    let parsedUrl;
    try {
      parsedUrl = new URL(urlEsperada);
    } catch {
      return res.status(400).json({ erro: 'url_esperada inválida' });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        erro: 'url_esperada deve usar http ou https'
      });
    }
  }

  const updates = {};
  if (unidade) updates.unidade = unidade;
  if (urlEsperada) updates.url_esperada = urlEsperada;

  if (!Object.keys(updates).length) {
    return res.status(400).json({
      erro: 'informe pelo menos um campo para atualizar'
    });
  }

  const { data, error } = await supabaseAdmin
    .from('maquinas_tv')
    .update(updates)
    .eq('id', id)
    .select('id, nome, unidade, url_esperada, url_atual, ultimo_heartbeat')
    .maybeSingle();

  if (error) {
    console.error(error);
    return res.status(500).json({
      erro: 'falha ao atualizar máquina'
    });
  }

  if (!data) {
    return res.status(404).json({
      erro: 'máquina não encontrada'
    });
  }

  return res.status(200).json({ maquina: data });
};
