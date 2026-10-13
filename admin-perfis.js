const { supabaseAdmin } = require('./supabaseAdmin');

function normalizeSites(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const sites = [];
  for (const item of value) {
    const url = String(typeof item === 'string' ? item : item?.url || '').trim();
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    } catch {
      return null;
    }
    sites.push({ url, nome: String(typeof item === 'object' ? item?.nome || '' : '').trim().slice(0, 100) });
  }
  return sites;
}

module.exports = async (req, res) => {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ erro: 'method not allowed' });
  if (!process.env.ADMIN_SECRET || req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('tv_perfis_navegacao')
      .select('id, nome, descricao, sites, intervalo_segundos, ativo, criado_em, atualizado_em')
      .order('nome', { ascending: true });
    if (error) {
      console.error('[InfraHub] falha ao listar perfis:', error);
      return res.status(500).json({ erro: 'falha ao listar perfis' });
    }
    return res.status(200).json({ perfis: data || [] });
  }

  const body = req.body || {};
  const nome = String(body.nome || '').trim().slice(0, 100);
  const descricao = String(body.descricao || '').trim().slice(0, 500);
  const sites = normalizeSites(body.sites);
  const intervalo_segundos = Number(body.intervalo_segundos || 60);
  const ativo = body.ativo !== false;
  const id = String(body.id || '').trim();

  if (!nome || !sites) {
    return res.status(400).json({ erro: 'nome e de 1 a 20 URLs HTTP/HTTPS válidas são obrigatórios' });
  }
  if (!Number.isInteger(intervalo_segundos) || intervalo_segundos < 30 || intervalo_segundos > 3600) {
    return res.status(400).json({ erro: 'intervalo_segundos deve ficar entre 30 e 3600' });
  }

  const values = {
    nome,
    descricao: descricao || null,
    sites,
    intervalo_segundos,
    ativo,
    atualizado_em: new Date().toISOString()
  };
  let query = supabaseAdmin.from('tv_perfis_navegacao');
  if (id) {
    const { data, error } = await query.update(values).eq('id', id)
      .select('id, nome, descricao, sites, intervalo_segundos, ativo, atualizado_em').maybeSingle();
    if (error) {
      console.error('[InfraHub] falha ao atualizar perfil:', error);
      return res.status(error.code === '23505' ? 409 : 500).json({ erro: error.code === '23505' ? 'já existe um perfil com esse nome' : 'falha ao atualizar perfil' });
    }
    if (!data) return res.status(404).json({ erro: 'perfil não encontrado' });
    return res.status(200).json({ ok: true, perfil: data });
  }

  const { data, error } = await query.insert(values)
    .select('id, nome, descricao, sites, intervalo_segundos, ativo, criado_em, atualizado_em').single();
  if (error) {
    console.error('[InfraHub] falha ao criar perfil:', error);
    return res.status(error.code === '23505' ? 409 : 500).json({ erro: error.code === '23505' ? 'já existe um perfil com esse nome' : 'falha ao criar perfil' });
  }
  return res.status(201).json({ ok: true, perfil: data });
};
