const { supabaseAdmin } = require('./supabaseAdmin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'method not allowed' });
  }

  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  const { maquina_id, tipo, payload } = req.body || {};

  if (!maquina_id || !tipo) {
    return res.status(400).json({
      erro: 'maquina_id e tipo são obrigatórios'
    });
  }

  const { data: maquina, error: maquinaError } = await supabaseAdmin
    .from('maquinas_tv')
    .select('id')
    .eq('id', maquina_id)
    .single();

  if (maquinaError || !maquina) {
    return res.status(404).json({
      erro: 'máquina não encontrada'
    });
  }

  const { data, error } = await supabaseAdmin
    .from('comandos')
    .insert({
      maquina_id,
      tipo,
      payload: payload || {}
    })
    .select('id, maquina_id, tipo, payload, executado, created_at')
    .single();

  if (error) {
    console.error(error);
    return res.status(500).json({
      erro: 'falha ao criar comando'
    });
  }

  return res.status(201).json({
    ok: true,
    comando: data
  });
};