/**
 * POST /api/twilio-whisper
 *
 * Played to the person ANSWERING, before the two legs are bridged. The caller
 * never hears it.
 *
 * Two jobs. It tells whoever picks up which line rang, so a forwarded lead is
 * not answered like a personal call. And it gives the answering party notice
 * that the call is recorded, which is what makes recording defensible on
 * interstate calls where the other end may be a two-party-consent state.
 */

import { escapeXml, twiml } from '../../lib/twilio';

interface Env {
  BRAND?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  const brand = env.BRAND ?? 'Muncie Radon';

  return twiml(`<Say voice="Polly.Joanna">New ${escapeXml(brand)} lead. This call is recorded.</Say>`);
};
