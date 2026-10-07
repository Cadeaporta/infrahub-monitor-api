const { supabaseAdmin } = require('./supabaseAdmin');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'method not allowed' });
  }

  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  const { data, error } = await supabaseAdmin
    .from('maquinas_tv')
    .select('id, nome, url_esperada, url_atual, ultimo_heartbeat')
    .order('nome', { ascending: true });

  if (error) {
    console.error(error);
    return res.status(500).json({
      erro: 'falha ao buscar máquinas'
    });
  }

  return res.status(200).json({
    maquinas: data || []
  });
};