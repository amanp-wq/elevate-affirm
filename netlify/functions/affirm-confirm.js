// netlify/functions/affirm-confirm.js
export async function handler(event) {
  try {
    const PUBLIC_KEY  = process.env.AFFIRM_PUBLIC_KEY;
    const PRIVATE_KEY = process.env.AFFIRM_PRIVATE_KEY;
    const AFFIRM_BASE = process.env.AFFIRM_BASE || 'https://sandbox.affirm.com';

    const token =
      (event.queryStringParameters && event.queryStringParameters.checkout_token) ||
      (event.queryStringParameters && event.queryStringParameters.checkout_id);

    if (!token) {
      return { statusCode: 400, body: 'Missing checkout_token' };
    }

    const basicAuth = 'Basic ' + Buffer.from(`${PUBLIC_KEY}:${PRIVATE_KEY}`).toString('base64');

    // Authorize the transaction so it becomes active.  :contentReference[oaicite:10]{index=10}
    const resp = await fetch(`${AFFIRM_BASE}/api/v1/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': basicAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transaction_id: token })
    });

    const data = await resp.json();

    // Redirect your customer to a simple thank-you page
    const host = event.headers['x-forwarded-host'] || event.headers.host;
    const thankyou = `https://${host}/confirm.html`;
    if (resp.ok) {
      return { statusCode: 302, headers: { Location: thankyou }, body: '' };
    }
    // If something failed, send them to cancel with a message
    const cancel = `https://${host}/cancel.html?msg=${encodeURIComponent(data?.type || 'auth_failed')}`;
    return { statusCode: 302, headers: { Location: cancel }, body: '' };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
}
