/**
 * Smoke test that every URL the TwiML points at actually resolves.
 *
 *   npm run check:webhooks                       against the live site
 *   npm run check:webhooks -- http://localhost:8788
 *
 * This exists because of a bug that already happened once: the TwiML referenced
 * /api/twilio-recording before that endpoint existed, so every recording
 * callback 404'd silently and recording_url stayed null for weeks. Twilio does
 * not complain about a dead callback URL, and a dead callback loses data
 * without losing calls, which is the kind of failure nobody notices.
 *
 * Every request here is unsigned on purpose. A signed webhook would be a real
 * one, and this must not write rows. Unsigned means the handler answers 403,
 * and a 403 still proves the route exists, which is the only claim being made.
 * A 404 or 405 means the route is missing or does not accept POST.
 */
const origin = (process.argv[2] ?? 'https://muncieradon.com').replace(/\/$/, '');

// Every callback URL twilio-voice.ts and twilio-dial-status.ts can emit.
const routes = [
  '/api/twilio-voice',
  '/api/twilio-whisper',
  '/api/twilio-recording',
  '/api/twilio-voicemail',
  '/api/twilio-dial-status',
];

const results = await Promise.all(
  routes.map(async (path) => {
    try {
      const res = await fetch(origin + path, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'CallSid=SMOKE_TEST_NOT_A_REAL_CALL',
      });
      return { path, status: res.status, ok: res.status !== 404 && res.status !== 405 };
    } catch (error) {
      return { path, status: error.message, ok: false };
    }
  }),
);

console.log(`\n${origin}`);
for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${String(r.status).padEnd(6)} ${r.path}`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(
    `\n${failed.length} callback URL(s) unreachable. Twilio will not report this,` +
      `\nit will just stop recording data. Deploy before trusting the call log.`,
  );
  process.exit(1);
}
console.log(`\nall ${results.length} callback URLs routed (403 is expected: these are unsigned)`);
