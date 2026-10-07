const { supabaseAdmin } = require('./supabaseAdmin');

module.exports = async (req, res) => {
  if (!['GET', 'PUT'].includes(req.method)) {
    return res.status(405).json({ erro: 'method not allowed' });
  }

  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('maquinas_tv')
      .select('id, nome, url_esperada, url_atual, ultimo_heartbeat')
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

  if (!id || !urlEsperada) {
    return res.status(400).json({
      erro: 'id e url_esperada são obrigatórios'
    });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(urlEsperada);
  } catch {
    return res.status(400).json({
      erro: 'url_esperada inválida'
    });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({
      erro: 'url_esperada deve usar http ou https'
    });
  }

  const { data, error } = await supabaseAdmin
    .from('maquinas_tv')
    .update({ url_esperada: urlEsperada })
    .eq('id', id)
    .select('id, nome, url_esperada, url_atual, ultimo_heartbeat')
    .maybeSingle();

  if (error) {
    console.error(error);
    return res.status(500).json({
      erro: 'falha ao atualizar URL esperada'
    });
  }

  if (!data) {
    return res.status(404).json({
      erro: 'máquina não encontrada'
    });
  }

  return res.status(200).json({ maquina: data });
};
