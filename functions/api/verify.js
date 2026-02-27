export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    return new Response(JSON.stringify({ ok: false, error: "Missing session_id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "Stripe key not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      },
    });

    if (!stripeRes.ok) {
      const text = await stripeRes.text();
      throw new Error(`Stripe error: ${text}`);
    }

    const session = await stripeRes.json();
    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ ok: false, error: "Payment not completed" }), {
        status: 402,
        headers: { "content-type": "application/json" },
      });
    }

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    return new Response(
      JSON.stringify({
        ok: true,
        access: {
          session_id: session.id,
          expiresAt,
        },
      }),
      {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
