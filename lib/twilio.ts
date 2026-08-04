/**
 * Shared plumbing for the Twilio webhooks in functions/api/twilio-*.ts.
 *
 * Signature verification was copy-pasted into two handlers before this file
 * existed, and the dial-status handler would have made three. Three copies of a
 * security check is three chances for them to drift, and the copy that drifts
 * is the one nobody reads again.
 *
 * This lives outside functions/ on purpose. Every file under functions/ is a
 * route, and Cloudflare does not document any underscore-prefix escape hatch,
 * so a shared module parked there risks becoming a publicly callable endpoint.
 * Pages bundles the imports wherever they live.
 */

export interface TwilioEnv {
  DB: D1Database;
  TWILIO_AUTH_TOKEN?: string;
}

export function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );

/** Twilio posts application/x-www-form-urlencoded. Flatten it to plain strings. */
export async function readParams(request: Request): Promise<Record<string, string>> {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') params[key] = value;
  }
  return params;
}

/** Twilio signs webhooks with HMAC-SHA1 over the full URL plus sorted params. */
async function isValidSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string,
): Promise<boolean> {
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join('');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Constant-time-ish compare.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Returns the 403 to send back when the request is not genuinely from Twilio,
 * or null when it is. Without the check, anyone who finds these URLs can write
 * junk into the calls table, which is the one dataset the renter pitch depends
 * on being clean.
 *
 * Verification is skipped when TWILIO_AUTH_TOKEN is unset so that a
 * half-configured deployment still routes calls instead of 403ing every one.
 */
export async function rejectIfUnsigned(
  request: Request,
  params: Record<string, string>,
  authToken: string | undefined,
  label: string,
): Promise<Response | null> {
  if (!authToken) return null;
  const signature = request.headers.get('x-twilio-signature') ?? '';
  if (await isValidSignature(request.url, params, signature, authToken)) return null;
  console.warn(`${label}: rejected unsigned or mis-signed request`);
  return new Response('Forbidden', { status: 403 });
}

/**
 * Builds a recording status-callback handler.
 *
 * There are two kinds of recording and they mean opposite things: `call` is a
 * conversation that actually happened, `voicemail` is one that did not. They
 * get separate routes rather than one route with a ?kind= query, because the
 * signature is computed over the full URL including its query string, and a
 * proxy that touches the query breaks authentication rather than just the
 * label. Two routes, one implementation.
 */
export function recordingCallback(kind: 'call' | 'voicemail'): PagesFunction<TwilioEnv> {
  const label = `twilio-recording(${kind})`;

  return async ({ request, env }) => {
    const params = await readParams(request);

    const rejected = await rejectIfUnsigned(request, params, env.TWILIO_AUTH_TOKEN, label);
    if (rejected) return rejected;

    const callSid = params.CallSid;
    if (!callSid) return new Response(null, { status: 204 });

    const duration = Number(params.RecordingDuration);

    try {
      // The call row may not exist yet if callbacks arrive out of order, so this
      // upserts rather than assuming an UPDATE will match something.
      await env.DB.prepare(
        `INSERT INTO calls (ts, call_sid, recording_url, duration_sec, recording_kind)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (call_sid) DO UPDATE SET
           recording_url  = COALESCE(excluded.recording_url, calls.recording_url),
           duration_sec   = COALESCE(excluded.duration_sec, calls.duration_sec),
           recording_kind = COALESCE(excluded.recording_kind, calls.recording_kind)`,
      )
        .bind(
          new Date().toISOString(),
          callSid,
          params.RecordingUrl ?? null,
          Number.isFinite(duration) && duration > 0 ? duration : null,
          kind,
        )
        .run();
    } catch (error) {
      console.error(`${label}: upsert failed`, error);
    }

    return new Response(null, { status: 204 });
  };
}

