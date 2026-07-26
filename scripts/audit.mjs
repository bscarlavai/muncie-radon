/**
 * Pre-launch audit. Runs in CI and before every build.
 *
 * These are the checks that catch the mistakes that actually cost money on a
 * rank-and-rent site: a stale tracking number surviving in one forgotten
 * template, or copy drifting back into house style we've ruled out.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC = 'src';
const EXTS = new Set(['.astro', '.ts', '.mdx', '.md', '.css', '.js', '.mjs']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(full).isDirectory() ? walk(full) : EXTS.has(extname(full)) ? [full] : [];
  });
}

const files = walk(SRC);
const errors = [];
const warnings = [];

/* ---- 1. No em dashes. House style. ---------------------------------------- */
for (const file of files) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (line.includes('—')) {
        errors.push(`${file}:${i + 1} contains an em dash: ${line.trim().slice(0, 90)}`);
      }
    });
}

/* ---- 2. The phone number renders from exactly one component --------------- */
const config = readFileSync('src/site.config.ts', 'utf8');
const display = config.match(/display:\s*'([^']+)'/)?.[1];
const tel = config.match(/tel:\s*'([^']+)'/)?.[1];

if (!display || !tel) {
  errors.push('src/site.config.ts: could not parse phone.display / phone.tel');
} else {
  const digits = (s) => s.replace(/\D/g, '');
  if (digits(display) !== digits(tel).replace(/^1/, '')) {
    errors.push(
      `Phone mismatch: display "${display}" and tel "${tel}" are different numbers. ` +
        `Both must be updated together.`,
    );
  }

  // Any literal phone number outside the config is a number that will not get
  // updated when the tracking line changes.
  const phoneLike = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
  for (const file of files) {
    if (file.endsWith('site.config.ts')) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        // Placeholders inside form `placeholder=` attributes are illustrative,
        // not dialable, and are deliberately exempt.
        if (line.includes('placeholder=')) return;
        const hits = line.match(phoneLike);
        if (hits) {
          errors.push(
            `${file}:${i + 1} hardcodes a phone number (${hits[0]}). ` +
              `Render it through PhoneLink so the tracking number has one source.`,
          );
        }
      });
  }
}

/* ---- 3. Tracking number must be real before launch ------------------------ */
if (/provisioned:\s*false/.test(config)) {
  warnings.push(
    `Tracking number is not provisioned yet (phone.provisioned = false in site.config.ts). ` +
      `Swap in the real Twilio number and flip the flag before going live.`,
  );
}
if (/555-?01\d\d/.test(display ?? '')) {
  warnings.push(`Phone "${display}" is a 555 placeholder, not a dialable number.`);
}

/* ---- 4. Analytics token present ------------------------------------------- */
if (/analyticsToken:\s*''/.test(config)) {
  warnings.push('Cloudflare Web Analytics token is empty; no pageview data will be collected.');
}

/* ---- 5. Deploy target is filled in ----------------------------------------- */
// This site deploys to the apps account, not the personal one. An unreplaced
// account_id is how a project ends up created in the wrong account, and an
// unreplaced database_id means the deploy fails outright.
const wrangler = readFileSync('wrangler.toml', 'utf8');
for (const [placeholder, consequence] of [
  ['REPLACE_WITH_ACCOUNT_ID', 'wrangler cannot tell which Cloudflare account to deploy to'],
  ['REPLACE_WITH_D1_DATABASE_ID', 'the DB binding will not resolve and lead capture will fail'],
]) {
  const n = wrangler.split(placeholder).length - 1;
  if (n) {
    warnings.push(
      `wrangler.toml still has ${placeholder} in ${n} place(s); ${consequence}. ` +
        `Note the preview environment keeps its own copy of the database id.`,
    );
  }
}

/* ---- Report ---------------------------------------------------------------- */
for (const w of warnings) console.warn(`\x1b[33mwarn\x1b[0m  ${w}`);
for (const e of errors) console.error(`\x1b[31mfail\x1b[0m  ${e}`);

console.log(
  `\naudit: ${files.length} files checked, ${errors.length} error(s), ${warnings.length} warning(s)`,
);

if (errors.length) process.exit(1);
