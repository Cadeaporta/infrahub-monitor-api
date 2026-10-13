const crypto = require('crypto');
const { supabaseAdmin } = require('./supabaseAdmin');
const { hashToken } = require('./auth');

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method not allowed' });
  const body = req.body || {};
  const codigo_cadastro = String(body.codigo_cadastro || '').trim();
  const machine_uuid = String(body.machine_uuid || '').trim().toLowerCase();
  const hostname = String(body.hostname || '').trim().slice(0, 255);
  const nome = String(body.nome || hostname || 'TV pendente').trim().slice(0, 255);
  const url_esperada = typeof body.url_esperada === 'string' ? body.url_esperada.trim() : '';

  if (!validUuid(machine_uuid) || !hostname || !codigo_cadastro) {
    return res.status(400).json({ erro: 'codigo_cadastro, machine_uuid UUID válido e hostname são obrigatórios' });
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

  // Consume the enrollment code atomically: a code is single-use and expires.
  const now = new Date().toISOString();
  const { data: codigo, error: codigoError } = await supabaseAdmin
    .from('tv_codigos_cadastro')
    .update({ usado_em: now, usado_por_machine_uuid: machine_uuid })
    .eq('codigo_hash', hashToken(codigo_cadastro))
    .is('usado_em', null)
    .is('revogado_em', null)
    .gt('expira_em', now)
    .select('id')
    .maybeSingle();

  if (codigoError) {
    console.error('[InfraHub] falha ao validar código de cadastro:', codigoError);
    return res.status(500).json({ erro: 'falha ao validar código de cadastro' });
  }
  if (!codigo) return res.status(401).json({ erro: 'código de cadastro inválido, expirado ou já utilizado' });

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
