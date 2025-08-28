// netlify/functions/create-checkout.js
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { program, amount, name, email, phone } = JSON.parse(event.body || '{}');
    if (!program || !amount || !name || !email || !phone) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields.' }) };
    }

    // Build your site base URL for callbacks (https on Netlify)
    const host = event.headers['x-forwarded-host'] || event.headers.host;
    const baseUrl = `https://${host}`;

    // Environment variables (set in Netlify → Site settings → Environment)
    const PUBLIC_KEY  = process.env.AFFIRM_PUBLIC_KEY;   // never hardcode
    const PRIVATE_KEY = process.env.AFFIRM_PRIVATE_KEY;  // never hardcode
    const AFFIRM_BASE = process.env.AFFIRM_BASE || 'https://sandbox.affirm.com'; // use sandbox first!

    // Affirm requires HTTP Basic auth using your PUBLIC:PRIVATE key pair
    const basicAuth = 'Basic ' + Buffer.from(`${PUBLIC_KEY}:${PRIVATE_KEY}`).toString('base64');

    // Minimal checkout object (services use shipping_amount/tax_amount = 0)
    // Full field reference: The Checkout Object. :contentReference[oaicite:7]{index=7}
    const checkout = {
      merchant: {
        public_api_key: PUBLIC_KEY,
        user_confirmation_url: `${baseUrl}/api/affirm/confirm`,
        user_cancel_url:       `${baseUrl}/cancel.html`,
        user_confirmation_url_action: 'GET',
        name: 'ElevateMe'
      },
      // For non-physical goods, shipping is not required; set amounts to 0
      items: [{
        display_name: program,
        sku: program.toUpperCase().replace(/\s+/g, '-'),
        unit_price: amount,  // cents (e.g., $100.00 => 10000)
        qty: 1
      }],
      currency: 'USD',
      shipping_amount: 0,
      tax_amount: 0,
      total: amount,
      metadata: { source: 'netlify-site' },
      // You can include customer info to reduce data entry in Affirm
      customer: {
        email: email,
        phone_number: phone,
        name: { full: name }
      }
    };

    // Call Affirm Direct Checkout to get a redirect link
    // Endpoint: POST /api/v2/checkout/direct  (sandbox or live base)  :contentReference[oaicite:8]{index=8}
    const resp = await fetch(`${AFFIRM_BASE}/api/v2/checkout/direct`, {
      method: 'POST',
      headers: {
        'Authorization': basicAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkout)
    });

    const data = await resp.json();

    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: data }) };
    }

    // Typically contains a redirect URL (and a checkout_id)
    return {
      statusCode: 200,
      body: JSON.stringify({
        redirect_url: data.redirect_url || data.redirect_checkout_url || null,
        checkout_id:  data.id || data.checkout_id || null
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
