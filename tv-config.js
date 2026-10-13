const { supabaseAdmin } = require('./supabaseAdmin');
const { validarMaquina } = require('./auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'method not allowed' });
  const maquina = await validarMaquina(supabaseAdmin, req.query?.maquina_id, req.query?.token);
  if (!maquina) return res.status(401).json({ erro: 'token inválido ou máquina não aprovada' });

  const { data, error } = await supabaseAdmin
    .from('maquinas_tv')
    .select('id, nome, url_esperada, configuracao, perfil_id')
    .eq('id', maquina.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[InfraHub] falha ao buscar configuração:', error);
    return res.status(error ? 500 : 404).json({ erro: 'falha ao buscar configuração da TV' });
  }

  let perfil = null;
  if (data.perfil_id) {
    const { data: perfilData, error: perfilError } = await supabaseAdmin
      .from('tv_perfis_navegacao')
      .select('id, nome, sites, intervalo_segundos, ativo')
      .eq('id', data.perfil_id)
      .eq('ativo', true)
      .maybeSingle();
    if (perfilError) {
      console.error('[InfraHub] falha ao buscar perfil:', perfilError);
      return res.status(500).json({ erro: 'falha ao buscar perfil' });
    }
    perfil = perfilData || null;
  }

  return res.status(200).json({
    ok: true,
    servidor_em: new Date().toISOString(),
    configuracao: data.configuracao || {},
    perfil
  });
};
