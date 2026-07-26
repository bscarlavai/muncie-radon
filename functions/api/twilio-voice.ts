/**
 * POST /api/twilio-voice
 *
 * Twilio Voice webhook for the tracking number. Logs the call to D1 and
 * returns TwiML that forwards to the destination phone.
 *
 * Recording is on from day one, because the recordings are half the pitch when
 * a renter asks what the leads actually sound like. The announcement plays on
 * the FORWARD leg only, so the caller is not greeted by a robot before a human
 * says hello, while the party being recorded still gets notice. Indiana is a
 * one-party-consent state; the announcement covers interstate calls where the
 * other end may be two-party.
 */

interface Env {
  DB: D1Database;
  /** E.164 destination the tracking number rings through to. */
  FORWARD_TO: string;
  /** Twilio auth token, used to verify the request signature. */
  TWILIO_AUTH_TOKEN?: string;
}

function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );

/**
 * Twilio signs every webhook. Without this check anyone who finds the URL can
 * write junk into the calls table, which is the one dataset the renter pitch
 * depends on being clean.
 */
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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') params[key] = value;
  }

  if (env.TWILIO_AUTH_TOKEN) {
    const signature = request.headers.get('x-twilio-signature') ?? '';
    const valid = await isValidSignature(request.url, params, signature, env.TWILIO_AUTH_TOKEN);
    if (!valid) {
      console.warn('twilio-voice: rejected unsigned or mis-signed request');
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Log first, forward second. A logging failure must not drop the call.
  try {
    await env.DB.prepare(
      `INSERT INTO calls (ts, call_sid, from_number, to_number, direction, status, from_city, from_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (call_sid) DO UPDATE SET status = excluded.status`,
    )
      .bind(
        new Date().toISOString(),
        params.CallSid ?? null,
        params.From ?? null,
        params.To ?? null,
        params.Direction ?? 'inbound',
        params.CallStatus ?? null,
        params.FromCity ?? null,
        params.FromState ?? null,
      )
      .run();
  } catch (error) {
    console.error('twilio-voice: call log failed, forwarding anyway', error);
  }

  if (!env.FORWARD_TO) {
    console.error('twilio-voice: FORWARD_TO is not set, caller would hit a dead end');
    return twiml(
      `<Say>We are sorry. We are unable to take your call right now. Please try again shortly.</Say>`,
    );
  }

  // Absolute callback URLs, derived from the request we are answering. Twilio
  // does resolve relative URLs against the TwiML document, but being explicit
  // removes any dependence on how the proxy presented the path.
  const origin = new URL(request.url).origin;
  const recordingCb = `${origin}/api/twilio-recording`;
  const whisperUrl = `${origin}/api/twilio-whisper`;

  return twiml(
    `<Dial timeout="25" callerId="${escapeXml(params.To ?? '')}" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingCb)}" answerOnBridge="true">` +
      `<Number url="${escapeXml(whisperUrl)}">${escapeXml(env.FORWARD_TO)}</Number>` +
      `</Dial>` +
      `<Say>Sorry we missed you. Please leave a message after the tone and we will call you back.</Say>` +
      `<Record maxLength="120" transcribe="false" recordingStatusCallback="${escapeXml(recordingCb)}"/>`,
  );
};
