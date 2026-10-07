const { supabaseAdmin } = require('./supabaseAdmin');
const { validarMaquina } = require('./auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'method not allowed' });
  }

  const { maquina_id, token } = req.query || {};

  const maquina = await validarMaquina(supabaseAdmin, maquina_id, token);

  if (!maquina) {
    return res.status(401).json({ erro: 'token inválido' });
  }

  const { data: pendentes, error } = await supabaseAdmin
    .from('comandos')
    .select('id, tipo, payload, created_at')
    .eq('maquina_id', maquina.id)
    .eq('executado', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[InfraHub] falha ao buscar comandos:', error);
    return res.status(500).json({ erro: 'falha ao buscar comandos' });
  }

  const comandos = (pendentes || []).map((comando) => {
    let payload = comando.payload || {};

    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }

    return {
      ...comando,
      payload
    };
  });

  return res.status(200).json({ comandos });
};
