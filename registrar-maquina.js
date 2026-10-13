const crypto = require('crypto');
const { supabaseAdmin } = require('./supabaseAdmin');
const { hashToken } = require('./auth');

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method not allowed' });
  if (!process.env.TV_ENROLLMENT_SECRET ||
      req.headers['x-enrollment-secret'] !== process.env.TV_ENROLLMENT_SECRET) {
    return res.status(401).json({ erro: 'credencial de cadastro inválida' });
  }

  const body = req.body || {};
  const machine_uuid = String(body.machine_uuid || '').trim().toLowerCase();
  const hostname = String(body.hostname || '').trim().slice(0, 255);
  const nome = String(body.nome || hostname || 'TV pendente').trim().slice(0, 255);
  const url_esperada = typeof body.url_esperada === 'string' ? body.url_esperada.trim() : '';

  if (!validUuid(machine_uuid) || !hostname) {
    return res.status(400).json({ erro: 'machine_uuid UUID válido e hostname são obrigatórios' });
  }
  if (url_esperada) {
    try {
      const parsed = new URL(url_esperada);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
    } catch {
      return res.status(400).json({ erro: 'url_esperada deve ser uma URL HTTP ou HTTPS válida' });
    }
  }

  const { data: existente, error: lookupError } = await supabaseAdmin
    .from('maquinas_tv')
    .select('id, status_aprovacao')
    .eq('machine_uuid', machine_uuid)
    .maybeSingle();

  if (lookupError) {
    console.error('[InfraHub] falha ao consultar identidade:', lookupError);
    return res.status(500).json({ erro: 'falha ao consultar identidade' });
  }
  if (existente) {
    return res.status(409).json({
      erro: 'dispositivo já cadastrado; solicite revalidação no painel',
      maquina_id: existente.id,
      status_aprovacao: existente.status_aprovacao
    });
  }

  const maquina_id = 'tv-' + machine_uuid.replace(/-/g, '').slice(0, 16);
  const token = crypto.randomBytes(32).toString('hex');
  const { data, error } = await supabaseAdmin
    .from('maquinas_tv')
    .insert({
      id: maquina_id,
      nome,
      hostname,
      machine_uuid,
      url_esperada: url_esperada || null,
      token_hash: hashToken(token),
      status_aprovacao: 'pendente',
      ultima_atividade: new Date().toISOString()
    })
    .select('id, nome, hostname, machine_uuid, status_aprovacao')
    .single();

  if (error) {
    console.error('[InfraHub] falha ao registrar dispositivo:', error);
    return res.status(500).json({ erro: 'falha ao registrar dispositivo' });
  }

  // The local installer/helper must store this token securely. It is returned only here.
  return res.status(201).json({ ok: true, maquina: data, token });
};
