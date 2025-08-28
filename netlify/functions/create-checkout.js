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

    const host = event.headers['x-forwarded-host'] || event.headers.host;
    const baseUrl = `https://${host}`;

    const PUBLIC_KEY  = process.env.AFFIRM_PUBLIC_KEY;
    const PRIVATE_KEY = process.env.AFFIRM_PRIVATE_KEY;
    const AFFIRM_BASE = process.env.AFFIRM_BASE || 'https://sandbox.affirm.com';

    const auth = 'Basic ' + Buffer.from(`${PUBLIC_KEY}:${PRIVATE_KEY}`).toString('base64');

    // Split full name into first + last
    const [firstName, ...rest] = name.trim().split(" ");
    const lastName = rest.length > 0 ? rest.join(" ") : "Customer";

    const checkout = {
      merchant: {
        public_api_key: PUBLIC_KEY,
        user_confirmation_url: `${baseUrl}/api/affirm/confirm`,
        user_cancel_url: `${baseUrl}/cancel.html`,
        user_confirmation_url_action: 'GET',
        name: 'Elevate Affirm'
      },
      items: [{
        display_name: program,
        sku: program.toUpperCase().replace(/\s+/g, '-'),
        unit_price: amount, // cents
        qty: 1
      }],
      currency: "USD",
      shipping_amount: 0,
      tax_amount: 0,
      total: amount,

      // ✅ Customer info
      customer: {
        email: email,
        phone_number: phone
      },

      // ✅ Billing (required by Affirm)
      billing: {
        name: {
          first: firstName,
          last: lastName
        },
        address: {
          line1: "123 Test St",
          line2: "Apt 1",
          city: "San Francisco",
          state: "CA",
          zipcode: "94105",
          country: "USA"
        }
      },

      // ✅ Shipping (required by Affirm)
      shipping: {
        name: {
          first: firstName,
          last: lastName
        },
        address: {
          line1: "123 Test St",
          line2: "Apt 1",
          city: "San Francisco",
          state: "CA",
          zipcode: "94105",
          country: "USA"
        }
      }
    };

    console.log("Checkout payload:", JSON.stringify(checkout, null, 2));

    const resp = await fetch(`${AFFIRM_BASE}/api/v2/checkout/direct`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkout)
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    console.log("Affirm response:", resp.status, data);

    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: data }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        redirect_url: data.redirect_url || data.redirect_checkout_url || null,
        checkout_id: data.id || data.checkout_id || null
      })
    };
  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
