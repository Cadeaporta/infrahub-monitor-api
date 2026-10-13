const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Compara em tempo constante pra evitar timing attack na comparação do hash.
function hashesIguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function validarMaquina(supabaseAdmin, maquina_id, token) {
  if (typeof maquina_id !== 'string' || !maquina_id.trim() ||
      typeof token !== 'string' || !token.trim()) return null;

  const { data, error } = await supabaseAdmin
    .from('maquinas_tv')
    .select('id, token_hash, status_aprovacao, deleted_at, hostname, machine_uuid')
    .eq('id', maquina_id.trim())
    .maybeSingle();

  if (error || !data || data.deleted_at || data.status_aprovacao !== 'aprovada') return null;

  const tokenHash = hashToken(token);
  if (!hashesIguais(tokenHash, data.token_hash)) return null;

  return data;
}

module.exports = { hashToken, validarMaquina };
