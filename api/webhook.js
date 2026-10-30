const crypto = require('crypto');

// Lit le corps brut de la requête, nécessaire pour vérifier la signature
function lireCorpsBrut(req) {
  return new Promise((resolve, reject) => {
    const morceaux = [];
    req.on('data', (m) => morceaux.push(m));
    req.on('end', () => resolve(Buffer.concat(morceaux)));
    req.on('error', reject);
  });
}

// Vérifie que le message vient bien de Stripe
function signatureValide(corps, enTete, secret) {
  if (!enTete) return false;
  const parties = Object.fromEntries(enTete.split(',').map((p) => p.split('=')));
  const t = parties.t;
  const v1 = parties.v1;
  if (!t || !v1) return false;

  // Refuse les messages vieux de plus de 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;

  const attendue = crypto
    .createHmac('sha256', secret)
    .update(t + '.' + corps.toString('utf8'))
    .digest('hex');

  const a = Buffer.from(attendue);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Méthode non autorisée');
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    res.statusCode = 500;
    return res.end('Configuration manquante');
  }

  const corps = await lireCorpsBrut(req);

  if (!signatureValide(corps, req.headers['stripe-signature'], secret)) {
    res.statusCode = 400;
    return res.end('Signature invalide');
  }

  const evenement = JSON.parse(corps.toString('utf8'));

  if (evenement.type === 'checkout.session.completed') {
    const session = evenement.data.object;
    const paye =
      session.payment_status === 'paid' ||
      session.payment_status === 'no_payment_required';

    if (paye) {
      // Étape suivante : enregistrer session.id en base pour éviter les doublons,
      // puis envoyer l'accès. Pour l'instant, on confirme seulement la réception.
      console.log('Paiement confirmé par Stripe :', session.id);
    }
  }

  res.statusCode = 200;
  res.end('ok');
};
