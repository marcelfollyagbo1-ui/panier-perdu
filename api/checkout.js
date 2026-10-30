module.exports = async (req, res) => {
  const body = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': process.env.STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    success_url: 'https://panier-perdu-eight-beta.vercel.app/?paiement=ok',
    cancel_url: 'https://panier-perdu-eight-beta.vercel.app/?paiement=annule',
  });

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const session = await r.json();

  if (!session.url) {
    res.statusCode = 500;
    res.end('Paiement indisponible, réessayez plus tard.');
    return;
  }
  res.statusCode = 303;
  res.setHeader('Location', session.url);
  res.end();
};
