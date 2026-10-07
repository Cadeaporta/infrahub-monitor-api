const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { validarMaquina } = require('../lib/auth');

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

  // Mantém o comportamento atual: o comando é consumido ao ser entregue
  // à extensão. A extensão registra no console quando recebe e executa.
  if (comandos.length > 0) {
    const ids = comandos.map((c) => c.id);

    const { error: updateError } = await supabaseAdmin
      .from('comandos')
      .update({ executado: true })
      .in('id', ids);

    if (updateError) {
      console.error('[InfraHub] falha ao marcar comandos:', updateError);
      return res.status(500).json({ erro: 'falha ao atualizar comandos' });
    }
  }

  return res.status(200).json({
    comandos
  });
};
