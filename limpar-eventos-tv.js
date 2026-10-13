const { supabaseAdmin } = require('./supabaseAdmin');

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ erro: 'method not allowed' });
  }
  const secret = process.env.CRON_SECRET;
  const authorization = String(req.headers.authorization || '');
  if (!secret || authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from('tv_eventos')
    .delete()
    .lt('ocorrido_em', cutoff);

  if (error) {
    console.error('[InfraHub] falha na retenção de eventos:', error);
    return res.status(500).json({ erro: 'falha ao limpar eventos antigos' });
  }

  return res.status(200).json({
    ok: true,
    retencao_dias: 14,
    anteriores_a: cutoff
  });
};
