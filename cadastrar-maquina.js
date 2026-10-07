const crypto = require('crypto');
const { supabaseAdmin } = require('./supabaseAdmin');
const { hashToken } = require('./auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'method not allowed' });
  }

  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  const { id, nome, url_esperada } = req.body || {};

  if (!id || !nome) {
    return res.status(400).json({
      erro: 'id e nome são obrigatórios'
    });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const token_hash = hashToken(token);

  const { error } = await supabaseAdmin
    .from('maquinas_tv')
    .upsert({
      id,
      nome,
      url_esperada: url_esperada || null,
      token_hash
    });

  if (error) {
    console.error(error);
    return res.status(500).json({
      erro: 'falha ao cadastrar'
    });
  }

  return res.status(200).json({
    ok: true,
    maquina_id: id,
    token
  });
};