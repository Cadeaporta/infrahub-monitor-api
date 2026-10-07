const { supabaseAdmin } = require('./supabaseAdmin');
const { validarMaquina } = require('./auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'method not allowed' });
  }

  const { maquina_id, token, url_atual } = req.body || {};

  const maquina = await validarMaquina(
    supabaseAdmin,
    maquina_id,
    token
  );

  if (!maquina) {
    return res.status(401).json({
      erro: 'token inválido'
    });
  }

  const { error } = await supabaseAdmin
    .from('maquinas_tv')
    .update({
      ultimo_heartbeat: new Date().toISOString(),
      url_atual: url_atual || null
    })
    .eq('id', maquina.id);

  if (error) {
    console.error(error);

    return res.status(500).json({
      erro: 'falha ao gravar heartbeat'
    });
  }

  return res.status(200).json({
    ok: true
  });
};