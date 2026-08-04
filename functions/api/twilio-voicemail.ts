/**
 * POST /api/twilio-voicemail
 *
 * Recording status callback for the voicemail <Record>, meaning a caller who
 * was never connected to anyone. Same storage as /api/twilio-recording, but the
 * row is tagged so "47 calls" can be split into the calls that got answered and
 * the ones that got a greeting.
 */
import { recordingCallback } from '../../lib/twilio';

export const onRequestPost = recordingCallback('voicemail');
