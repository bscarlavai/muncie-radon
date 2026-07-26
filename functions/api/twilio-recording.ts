/**
 * POST /api/twilio-recording
 *
 * Twilio recording status callback. Attaches the recording URL to the call row
 * that /api/twilio-voice already created.
 *
 * This endpoint was referenced by the TwiML before it existed, which meant
 * every recording callback 404'd and `calls.recording_url` stayed permanently
 * null. The recordings are half the renter pitch ("here is what these leads
 * sound like"), so a silent 404 here quietly destroys the asset.
 */

interface Env {
  DB: D1Database;
  TWILIO_AUTH_TOKEN?: string;
}

/** Shared with twilio-voice.ts. Twilio signs with HMAC-SHA1 over url + sorted params. */
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

  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') params[key] = value;
  }

  if (env.TWILIO_AUTH_TOKEN) {
    const signature = request.headers.get('x-twilio-signature') ?? '';
    if (!(await isValidSignature(request.url, params, signature, env.TWILIO_AUTH_TOKEN))) {
      console.warn('twilio-recording: rejected mis-signed request');
      return new Response('Forbidden', { status: 403 });
    }
  }

  const callSid = params.CallSid;
  if (!callSid) return new Response(null, { status: 204 });

  const duration = Number(params.RecordingDuration);

  try {
    // The call row may not exist yet if callbacks arrive out of order, so this
    // upserts rather than assuming an UPDATE will match something.
    await env.DB.prepare(
      `INSERT INTO calls (ts, call_sid, recording_url, duration_sec)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (call_sid) DO UPDATE SET
         recording_url = COALESCE(excluded.recording_url, calls.recording_url),
         duration_sec  = COALESCE(excluded.duration_sec, calls.duration_sec)`,
    )
      .bind(
        new Date().toISOString(),
        callSid,
        params.RecordingUrl ?? null,
        Number.isFinite(duration) && duration > 0 ? duration : null,
      )
      .run();
  } catch (error) {
    console.error('twilio-recording: upsert failed', error);
  }

  return new Response(null, { status: 204 });
};
