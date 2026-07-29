/**
 * Inbound call log, straight from D1, so nobody has to navigate the Twilio
 * console to answer "did anyone call, and what did they say".
 *
 *   npm run calls              list recent calls
 *   npm run calls -- 20        list the last 20
 *   npm run calls -- play 7    download call #7's recording and open it
 *
 * `play` needs the Twilio auth token in the environment. It is never read from
 * or written to a file here:
 *
 *   TWILIO_AUTH_TOKEN=xxxx npm run calls -- play 7
 *
 * The account SID is parsed out of the recording URL rather than configured,
 * because Twilio already embeds it there and one source beats two.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const playIdx = args.indexOf('play');
const playId = playIdx !== -1 ? args[playIdx + 1] : null;
const limit = Number(args.find((a) => /^\d+$/.test(a))) || 15;

function d1(sql) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'muncie-radon', '--remote', '-y', '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  // wrangler prints a banner before the JSON, so seek to the array.
  return JSON.parse(out.slice(out.indexOf('[')))[0].results;
}

const local = (iso) =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Indiana/Indianapolis',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

if (playId) {
  const [row] = d1(`SELECT id, recording_url FROM calls WHERE id = ${Number(playId)}`);
  if (!row?.recording_url) {
    console.error(`call #${playId} has no recording`);
    process.exit(1);
  }
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    console.error(
      'TWILIO_AUTH_TOKEN is not set. Run:\n' +
        `  TWILIO_AUTH_TOKEN=xxxx npm run calls -- play ${playId}`,
    );
    process.exit(1);
  }
  const account = row.recording_url.split('/Accounts/')[1].split('/')[0];
  const file = `/tmp/call-${playId}.mp3`;
  console.log(`downloading call #${playId}...`);
  const mp3 = execFileSync(
    'curl',
    ['-sS', '-u', `${account}:${token}`, `${row.recording_url}.mp3`],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  );
  writeFileSync(file, mp3);
  execFileSync('open', [file]);
  console.log(`${file} (${(mp3.length / 1024).toFixed(0)} KB)`);
  process.exit(0);
}

const calls = d1(
  `SELECT id, ts, from_number, from_city, from_state, status, duration_sec, recording_url
   FROM calls ORDER BY id DESC LIMIT ${limit}`,
);

if (!calls.length) {
  console.log('no calls yet');
  process.exit(0);
}

console.log('');
for (const c of calls) {
  const where = [c.from_city, c.from_state].filter(Boolean).join(', ') || 'unknown';
  const dur = c.duration_sec ? `${c.duration_sec}s` : '--';
  console.log(
    `#${String(c.id).padEnd(3)} ${local(c.ts).padEnd(18)} ${(c.from_number ?? '?').padEnd(14)} ${where.padEnd(22)} ${dur.padEnd(6)} ${c.recording_url ? `play: npm run calls -- play ${c.id}` : 'no recording'}`,
  );
}

// status is logged when Twilio first rings the Function, so it reads "ringing"
// even on calls that completed. Say so rather than presenting it as truth.
console.log(
  `\n${calls.length} call(s). Duration is the RECORDING length, and an answered call and a` +
    `\nvoicemail both produce one, so this does not yet distinguish answered from missed.`,
);
