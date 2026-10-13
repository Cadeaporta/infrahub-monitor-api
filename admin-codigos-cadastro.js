const crypto = require('crypto');
const { supabaseAdmin } = require('./supabaseAdmin');
const { hashToken } = require('./auth');

module.exports = async (req, res) => {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ erro: 'method not allowed' });
  if (!process.env.ADMIN_SECRET || req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('tv_codigos_cadastro')
      .select('id, descricao, criado_por, criado_em, expira_em, usado_em, usado_por_machine_uuid, revogado_em')
      .order('criado_em', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[InfraHub] falha ao listar códigos:', error);
      return res.status(500).json({ erro: 'falha ao listar códigos de cadastro' });
    }
    return res.status(200).json({ codigos: data || [] });
  }

  const body = req.body || {};
  const descricao = String(body.descricao || '').trim().slice(0, 255);
  const criado_por = typeof body.criado_por === 'string' ? body.criado_por : null;
  const ttl_minutes = Number(body.ttl_minutes || 60);
  if (!Number.isInteger(ttl_minutes) || ttl_minutes < 5 || ttl_minutes > 1440) {
    return res.status(400).json({ erro: 'ttl_minutes deve ficar entre 5 e 1440' });
  }

  const codigo = crypto.randomBytes(32).toString('hex');
  const criado_em = new Date();
  const expira_em = new Date(criado_em.getTime() + ttl_minutes * 60000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('tv_codigos_cadastro')
    .insert({
      codigo_hash: hashToken(codigo),
      criado_por,
      descricao: descricao || null,
      expira_em
    })
    .select('id, descricao, criado_em, expira_em')
    .single();

  if (error) {
    console.error('[InfraHub] falha ao gerar código:', error);
    return res.status(500).json({ erro: 'falha ao gerar código de cadastro' });
  }
  return res.status(201).json({ ok: true, codigo, registro: data });
};
