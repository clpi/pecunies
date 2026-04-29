import { EmailMessage } from 'cloudflare:email';

const FROM = 'chris@pecunies.com';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: corsHeaders() });
    }

    if (!env.BOOKING_EMAIL) {
      return Response.json({ error: 'BOOKING_EMAIL binding is not configured.' }, { status: 500, headers: corsHeaders() });
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: corsHeaders() });
    }

    const recipients = Array.isArray(body?.to)
      ? body.to.map((value) => String(value).trim()).filter(isEmail).slice(0, 3)
      : [];
    const subject = String(body?.subject ?? 'Portfolio booking request').slice(0, 160);
    const message = String(body?.body ?? '').slice(0, 4000);

    if (!recipients.length || !message) {
      return Response.json({ error: 'Expected to, subject, and body.' }, { status: 400, headers: corsHeaders() });
    }

    await Promise.all(
      recipients.map((recipient) =>
        env.BOOKING_EMAIL.send(new EmailMessage(FROM, recipient, rawEmail(recipient, subject, message))),
      ),
    );

    return Response.json({ ok: true, sent: recipients.length }, { headers: corsHeaders() });
  },
};

function rawEmail(to, subject, body) {
  return [
    `From: Chris Pecunies <${FROM}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n');
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://pecunies.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Cache-Control': 'no-store',
  };
}
