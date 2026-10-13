const crypto = require('crypto');
const { supabaseAdmin } = require('./supabaseAdmin');
const { hashToken } = require('./auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method not allowed' });
  if (!process.env.ADMIN_SECRET || req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  const body = req.body || {};
  const id = String(body.id || '').trim();
  const nome = String(body.nome || '').trim();
  const url_esperada = typeof body.url_esperada === 'string' ? body.url_esperada.trim() : '';

  if (!id || !nome || id.length > 255 || nome.length > 255) {
    return res.status(400).json({ erro: 'id e nome válidos são obrigatórios' });
  }
  if (url_esperada) {
    try {
      const parsed = new URL(url_esperada);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
    } catch {
      return res.status(400).json({ erro: 'url_esperada deve ser uma URL HTTP ou HTTPS válida' });
    }
  }

  const token = crypto.randomBytes(32).toString('hex');
  const { data, error } = await supabaseAdmin
    .from('maquinas_tv')
    .insert({
      id,
      nome,
      url_esperada: url_esperada || null,
      token_hash: hashToken(token),
      status_aprovacao: 'pendente'
    })
    .select('id, nome, status_aprovacao')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ erro: 'já existe uma TV com esse ID; não foi alterada' });
    }
    console.error('[InfraHub] falha ao cadastrar TV:', error);
    return res.status(500).json({ erro: 'falha ao cadastrar' });
  }

  // Token is returned once, but cannot be used until an administrator approves the device.
  return res.status(201).json({ ok: true, maquina: data, maquina_id: id, token });
};
