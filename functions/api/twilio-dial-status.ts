/**
 * POST /api/twilio-dial-status
 *
 * The <Dial action> handler. Twilio calls this the moment the forwarded leg
 * ends, and hands over DialCallStatus and DialCallDuration, which is the only
 * place the answered-or-not question gets a truthful answer. Before this
 * existed, `calls.status` was written once at ring time and every row in the
 * database read "ringing" forever.
 *
 * That matters commercially. "47 calls" is a weak pitch to a contractor;
 * "47 calls, 38 answered, average 3 minutes" is the number they actually buy.
 *
 * This handler also owns the voicemail branch, and has to. Setting `action` on
 * <Dial> makes every verb after it unreachable, so the <Say> and <Record> that
 * used to sit inline in twilio-voice.ts moved here. The upside is that the
 * greeting is now conditional: it plays only when nobody picked up. Previously
 * Twilio resumed the original document after ANY completed dial, so a lead who
 * had a full conversation and whose contractor hung up first was then told
 * "sorry we missed you" and asked to leave a message.
 *
 * Every path returns TwiML, including the failure paths. A 500 here drops a
 * live caller, so a logging error must never become a dropped lead.
 */
import { escapeXml, readParams, rejectIfUnsigned, twiml, type TwilioEnv } from '../../lib/twilio';

/** Twilio reports 'completed' when the dialed party picked up and the call ended. */
const ANSWERED = new Set(['completed', 'answered']);

function voicemail(origin: string): Response {
  return twiml(
    `<Say>Sorry we missed you. Please leave a message after the tone and we will call you back.</Say>` +
      `<Record maxLength="120" transcribe="false" recordingStatusCallback="${escapeXml(`${origin}/api/twilio-voicemail`)}"/>`,
  );
}

export const onRequestPost: PagesFunction<TwilioEnv> = async ({ request, env }) => {
  const origin = new URL(request.url).origin;

  let params: Record<string, string> = {};
  try {
    params = await readParams(request);
  } catch (error) {
    console.error('twilio-dial-status: unreadable body, falling back to voicemail', error);
    return voicemail(origin);
  }

  const rejected = await rejectIfUnsigned(
    request,
    params,
    env.TWILIO_AUTH_TOKEN,
    'twilio-dial-status',
  );
  if (rejected) return rejected;

  const status = params.DialCallStatus ?? '';
  const answered = ANSWERED.has(status);
  const talk = Number(params.DialCallDuration);

  try {
    // Upsert, because a callback can in principle arrive before the row exists.
    await env.DB.prepare(
      `INSERT INTO calls (ts, call_sid, status, talk_sec)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (call_sid) DO UPDATE SET
         status   = excluded.status,
         talk_sec = COALESCE(excluded.talk_sec, calls.talk_sec)`,
    )
      .bind(
        new Date().toISOString(),
        params.CallSid ?? null,
        status || null,
        Number.isFinite(talk) && talk > 0 ? talk : null,
      )
      .run();
  } catch (error) {
    // Deliberately swallowed. The caller is still on the line.
    console.error('twilio-dial-status: status write failed, continuing the call', error);
  }

  // The conversation happened. Ending the call here is the whole point: without
  // it the caller hears the voicemail greeting after hanging up with a human.
  if (answered) return twiml(`<Hangup/>`);

  return voicemail(origin);
};
