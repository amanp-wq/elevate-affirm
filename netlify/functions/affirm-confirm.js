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
      console.error("Missing checkout_token in callback URL");
      return { statusCode: 400, body: "Missing checkout_token" };
    }

    const auth = 'Basic ' + Buffer.from(`${PUBLIC_KEY}:${PRIVATE_KEY}`).toString('base64');

    console.log("Authorizing Affirm transaction with token:", token);

    const resp = await fetch(`${AFFIRM_BASE}/api/v1/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transaction_id: token })
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    console.log("Affirm confirm response:", resp.status, data);

    const host = event.headers['x-forwarded-host'] || event.headers.host;
    const baseUrl = `https://${host}`;

    if (resp.ok) {
      // Redirect user to thank-you page
      return {
        statusCode: 302,
        headers: { Location: `${baseUrl}/confirm.html` },
        body: ""
      };
    } else {
      // Redirect user to cancel page with error info
      const errMsg = encodeURIComponent(
        (data && (data.message || data.type)) || "auth_failed"
      );
      return {
        statusCode: 302,
        headers: { Location: `${baseUrl}/cancel.html?msg=${errMsg}` },
        body: ""
      };
    }
  } catch (err) {
    console.error("Function error in affirm-confirm:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
