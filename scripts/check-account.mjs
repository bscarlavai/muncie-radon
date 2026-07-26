/**
 * Deploy guard: refuse to deploy into the wrong Cloudflare account.
 *
 * This repo lives in the lavailabs account. The personal account is wrangler's
 * `default` profile, and the binding that selects between them is keyed on this
 * directory's absolute path:
 *
 *   ~/Library/Preferences/.wrangler/profiles/directory-bindings.json
 *
 * So moving or renaming this directory silently falls back to the personal
 * account, and without this check the next deploy would quietly create a second
 * muncie-radon project somewhere nobody thinks to look. The natural place to pin
 * this would be account_id in wrangler.toml, but Pages rejects that field, so the
 * check runs here instead.
 */
import { execFileSync } from 'node:child_process';

const EXPECTED_ACCOUNT = 'd42538cebc7d337a0c0769a11f261ea5';
const EXPECTED_PROFILE = 'lavailabs';

let out;
try {
  out = execFileSync('npx', ['wrangler', 'whoami'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (err) {
  console.error(`\x1b[31mfail\x1b[0m  Could not run \`wrangler whoami\`: ${err.message}`);
  process.exit(1);
}

// whoami prints account ids inside a box-drawing table, so match the id shape
// rather than trying to parse the table itself.
const ids = [...out.matchAll(/\b[0-9a-f]{32}\b/g)].map((m) => m[0]);
const profile = out.match(/Active profile:\s*(\S+)/)?.[1];

if (!ids.includes(EXPECTED_ACCOUNT)) {
  console.error(
    `\x1b[31mfail\x1b[0m  Wrangler is not authenticated to the expected Cloudflare account.\n` +
      `        expected ${EXPECTED_ACCOUNT} (profile "${EXPECTED_PROFILE}")\n` +
      `        got      ${ids.join(', ') || 'no account id in whoami output'}` +
      `${profile ? ` (profile "${profile}")` : ' (no active profile: using the personal default)'}\n\n` +
      `        Fix:  npx wrangler auth activate ${EXPECTED_PROFILE} .\n` +
      `        This usually means the directory binding was lost, which happens\n` +
      `        when the repo is moved or renamed.`,
  );
  process.exit(1);
}

console.log(`\x1b[32mok\x1b[0m    Cloudflare account ${EXPECTED_ACCOUNT} (profile "${profile ?? 'default'}")`);
