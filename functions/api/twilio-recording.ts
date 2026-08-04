/**
 * POST /api/twilio-recording
 *
 * Recording status callback for the FORWARDED leg, meaning a conversation that
 * actually happened. Attaches the recording URL to the call row that
 * /api/twilio-voice already created, and marks it as a real call rather than a
 * voicemail, which /api/twilio-voicemail handles.
 *
 * This endpoint was once referenced by the TwiML before it existed, so every
 * recording callback 404'd and `calls.recording_url` stayed permanently null.
 * The recordings are half the renter pitch ("here is what these leads sound
 * like"), so a silent 404 here quietly destroys the asset. Both routes are
 * smoke-tested in scripts/check-webhooks.mjs for that reason.
 */
import { recordingCallback } from '../../lib/twilio';

export const onRequestPost = recordingCallback('call');
