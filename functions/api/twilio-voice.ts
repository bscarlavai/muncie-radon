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
 *
 * What happens after the dial lives in /api/twilio-dial-status, not here. See
 * that file for why.
 */
import { escapeXml, readParams, rejectIfUnsigned, twiml, type TwilioEnv } from '../../lib/twilio';

interface Env extends TwilioEnv {
  /** E.164 destination the tracking number rings through to. */
  FORWARD_TO: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const params = await readParams(request);

  const rejected = await rejectIfUnsigned(request, params, env.TWILIO_AUTH_TOKEN, 'twilio-voice');
  if (rejected) return rejected;

  // Log first, forward second. A logging failure must not drop the call.
  try {
    await env.DB.prepare(
      `INSERT INTO calls (ts, call_sid, from_number, to_number, direction, status, from_city, from_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (call_sid) DO UPDATE SET
         status = CASE
           WHEN calls.status IS NULL OR calls.status IN ('queued', 'ringing', 'in-progress')
             THEN excluded.status
           ELSE calls.status
         END`,
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
  const dialStatusCb = `${origin}/api/twilio-dial-status`;

  return twiml(
    // timeout is 18 rather than something more generous on purpose. FORWARD_TO is
    // a mobile, and a carrier voicemail box typically answers around 20 to 30
    // seconds. If it wins that race Twilio counts the call as answered and
    // bridges it, so a radon lead hears a personal voicemail greeting and we log
    // nothing useful. Losing the race to our own <Record> is strictly better:
    // the greeting is written for this business and the recording lands in D1.
    // Cost is roughly two fewer rings to reach the phone.
    //
    // action hands control to twilio-dial-status when the dial ends. Nothing may
    // follow this verb: Twilio documents everything after a <Dial action> as
    // unreachable, so a <Say> parked here would look like a working fallback
    // while never once playing.
    `<Dial timeout="18" callerId="${escapeXml(params.To ?? '')}" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingCb)}" action="${escapeXml(dialStatusCb)}" answerOnBridge="true">` +
      `<Number url="${escapeXml(whisperUrl)}">${escapeXml(env.FORWARD_TO)}</Number>` +
      `</Dial>`,
  );
};
