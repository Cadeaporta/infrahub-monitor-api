const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Compara em tempo constante pra evitar timing attack na comparação do hash.
function hashesIguais(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function validarMaquina(supabaseAdmin, maquina_id, token) {
  if (!maquina_id || !token) return null;

  const { data, error } = await supabaseAdmin
    .from('maquinas_tv')
    .select('id, token_hash')
    .eq('id', maquina_id)
    .single();

  if (error || !data) return null;

  const tokenHash = hashToken(token);
  if (!hashesIguais(tokenHash, data.token_hash)) return null;

  return data;
}

module.exports = { hashToken, validarMaquina };
