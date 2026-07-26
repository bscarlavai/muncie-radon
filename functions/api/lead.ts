/**
 * POST /api/lead
 *
 * Quote form -> D1 -> email notification.
 *
 * Design rule for this endpoint: a lead must never be lost because something
 * downstream failed. The D1 write is the source of truth and happens first;
 * the email is best-effort. If Resend is down we still have the lead, and the
 * visitor still gets a success response.
 */

interface Env {
  DB: D1Database;
  RESEND_API_KEY?: string;
  NOTIFY_TO?: string;
  NOTIFY_FROM?: string;
}

const MAX = { name: 120, phone: 40, email: 160, message: 2000, page: 200, utm: 300, ua: 300 };

const clean = (value: FormDataEntryValue | null, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/** US numbers to E.164 where we confidently can; otherwise leave it null. */
function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } });
}

/**
 * The client script fetches with `Accept: application/json`. A browser doing a
 * native form POST (JavaScript off or still loading) does not, and would
 * otherwise be shown raw JSON on a blank page. Those visitors get a redirect.
 */
const wantsJson = (request: Request) =>
  (request.headers.get('accept') ?? '').includes('application/json');

/** Send a no-JS visitor back where they came from, never off-site. */
function backToForm(request: Request): string {
  const referer = request.headers.get('referer');
  if (!referer) return '/contact/#quote';
  try {
    const url = new URL(referer);
    if (url.origin !== new URL(request.url).origin) return '/contact/#quote';
    return `${url.pathname}?e=1#quote`;
  } catch {
    return '/contact/#quote';
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  // Honeypot. Bots fill every field they find; humans never see this one.
  // Return 200 so the bot records a success and does not retry or adapt.
  if (clean(form.get('company'), 100)) {
    return wantsJson(request) ? json({ ok: true }) : seeOther('/thanks/');
  }

  // Submitted impossibly fast means scripted. `started_at` is stamped on page
  // load by the client script. Missing or unparseable is fine (JS may be off).
  const startedAt = Number(clean(form.get('started_at'), 20));
  if (Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < 2000) {
    return wantsJson(request) ? json({ ok: true }) : seeOther('/thanks/');
  }

  const name = clean(form.get('name'), MAX.name);
  const phone = clean(form.get('phone'), MAX.phone);

  if (!name || phone.replace(/\D/g, '').length < 10) {
    return wantsJson(request)
      ? json({ ok: false, error: 'validation' }, 422)
      : seeOther(backToForm(request));
  }

  const record = {
    ts: new Date().toISOString(),
    name,
    phone,
    phone_e164: toE164(phone),
    email: clean(form.get('email'), MAX.email) || null,
    service: clean(form.get('service'), 60) || null,
    message: clean(form.get('message'), MAX.message) || null,
    page: clean(form.get('page'), MAX.page) || null,
    form_id: clean(form.get('form_id'), 60) || null,
    utm: clean(form.get('utm'), MAX.utm) || null,
    referrer: (request.headers.get('referer') ?? '').slice(0, MAX.page) || null,
    user_agent: (request.headers.get('user-agent') ?? '').slice(0, MAX.ua) || null,
    ip_country: request.headers.get('cf-ipcountry') ?? null,
  };

  try {
    await env.DB.prepare(
      `INSERT INTO leads
        (ts, name, phone, phone_e164, email, service, message, page, form_id, utm, referrer, user_agent, ip_country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        record.ts,
        record.name,
        record.phone,
        record.phone_e164,
        record.email,
        record.service,
        record.message,
        record.page,
        record.form_id,
        record.utm,
        record.referrer,
        record.user_agent,
        record.ip_country,
      )
      .run();
  } catch (error) {
    // The one failure we cannot swallow: if D1 rejected the write, the lead is
    // gone. Surface it so the client shows the phone number instead.
    console.error('lead: D1 insert failed', error);
    return wantsJson(request)
      ? json({ ok: false, error: 'storage' }, 500)
      : seeOther(backToForm(request));
  }

  // Best effort from here. The lead is already safe.
  if (env.RESEND_API_KEY && env.NOTIFY_TO && env.NOTIFY_FROM) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: env.NOTIFY_FROM,
          to: [env.NOTIFY_TO],
          reply_to: record.email ?? undefined,
          subject: `New radon lead: ${record.name} (${record.phone})`,
          text: [
            `Name:     ${record.name}`,
            `Phone:    ${record.phone}${record.phone_e164 ? ` (${record.phone_e164})` : ''}`,
            record.email ? `Email:    ${record.email}` : null,
            `Service:  ${record.service || 'not specified'}`,
            '',
            'Message:',
            record.message || '(none)',
            '',
            '---',
            `Page:     ${record.page || '(unknown)'}`,
            `Form:     ${record.form_id || '(unknown)'}`,
            record.utm ? `Query:    ${record.utm}` : null,
            `Time:     ${record.ts}`,
          ]
            .filter(Boolean)
            .join('\n'),
        }),
      });
    } catch (error) {
      console.error('lead: notification email failed (lead is stored)', error);
    }
  }

  return wantsJson(request) ? json({ ok: true }) : seeOther('/thanks/');
};

// Only onRequestPost is exported on purpose. Pages answers other methods with
// a 405 automatically; adding an onRequest catch-all here would shadow this
// handler rather than chain to it.
