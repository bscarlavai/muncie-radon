# Muncie Radon

Rank-and-rent lead generation site for radon testing and mitigation in Muncie, Indiana.

Astro static → Cloudflare Pages. Lead capture via Pages Functions → D1 → Resend.
Call tracking via Twilio → D1.

**18 pages.** 6 services, 4 service areas, home, about, contact, services index,
service-areas index, privacy, thanks, 404.

---

## Local development

```bash
npm install
npm run dev          # http://localhost:4321
```

The Astro 7 dev server daemonizes. `npx astro dev stop` to kill it, `npx astro dev logs`
to tail it.

If a content collection reports as empty after you add the first file to a new
directory, the content layer cached the empty state at boot. `rm -rf .astro` and
restart.

---

## Launch checklist

Work top to bottom. Nothing below depends on anything above it being skipped.

### 0. Point wrangler at the right Cloudflare account

This site lives in the apps account, **not** the personal account that holds the
older Pages projects. Wrangler's default login is the personal one, so every
command in this checklist would otherwise create resources in the wrong place.

Commands below use `npx wrangler` deliberately. It resolves to the version pinned
in `devDependencies`, which is the version this config was validated against. A
global install is per-node-version under nvm, so it disappears when you switch
node and drifts out of date on its own. That already happened once here: a global
4.86.0 was shadowing the local 4.114.0 and did not have `wrangler auth` profiles
at all.

Do not `wrangler logout`. Use a named auth profile bound to this directory:

```bash
npx wrangler auth create lavailabs      # opens the browser; log in as the APPS account
npx wrangler auth activate lavailabs .  # binds that profile to this directory
```

**Name the profile after the account, not the project.** Wrangler stores a
directory-to-profile map in `~/Library/Preferences/.wrangler/profiles/directory-bindings.json`,
so one profile binds to many directories. The next app under this account runs
`npx wrangler auth activate lavailabs .` in its own directory and reuses this
same login. A per-project profile name would mean a redundant OAuth grant per
repo for the same account.

The personal account stays as `default`, which is the fallback for any directory
with no binding. That is why every other repo keeps working untouched, and why
renaming `default` would be a bad idea.

After that, verify:

```bash
npx wrangler whoami        # from this directory: bret@lavailabs.com
npx wrangler auth list     # profile plus its bound directories
```

`account_id` in `wrangler.toml` is already pinned to this account. That pin is a
guard, not a convenience: it makes a wrong-account session fail loudly instead of
silently creating a second `muncie-radon` project somewhere you will not think to
look.

`npx wrangler auth` is marked experimental in wrangler 4.114. The fallback, if it
misbehaves, is a scoped API token in the environment instead:

```bash
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...   # Pages:Edit, D1:Edit on the apps account
```

### 1. Tracking number

- [ ] Provision the Twilio number for the 765 area code.
- [ ] Set `phone.display` and `phone.tel` in `src/site.config.ts` **together**,
      and flip `phone.provisioned` to `true`.
- [ ] `npm run audit` — passes with zero warnings about the phone.
- [ ] Point the Twilio number's Voice webhook at
      `https://muncieradon.com/api/twilio-voice` (HTTP POST).

Launch-window routing: `FORWARD_TO` is your own phone. Two-line script, then
hand-route free samples to the outreach shortlist in `docs/SCOUT-BRIEF-MUNCIE.md`.
Never a dead end.

### 2. D1

```bash
npx wrangler d1 create muncie-radon
npx wrangler d1 execute muncie-radon --remote --file=./schema.sql
```

Paste the returned id into **both** `database_id` slots in `wrangler.toml`, the
top-level one and the one under `[env.preview]`. Pages does not inherit bindings
into named environments, so a preview deployment with an empty `DB` binding 500s
on every form submit. `npm run audit` warns until both are filled in.

### 3. Secrets

Set in the Pages dashboard or via `npx wrangler pages secret put <NAME>`:

| Name | What it is |
|---|---|
| `RESEND_API_KEY` | Resend key for new-lead notification email |
| `NOTIFY_TO` | Where new-lead emails land |
| `NOTIFY_FROM` | Verified Resend sender, e.g. `leads@muncieradon.com` |
| `FORWARD_TO` | E.164 number the tracking line rings through to |
| `TWILIO_AUTH_TOKEN` | Verifies the Twilio webhook signature |

`TWILIO_AUTH_TOKEN` is optional in code so local testing works, but **set it in
production**. Without it, anyone who finds the webhook URL can write junk into
the `calls` table, which is the dataset the renter pitch depends on.

### 4. Analytics

- [ ] Enable Cloudflare Web Analytics, paste the token into `analyticsToken` in
      `src/site.config.ts`.

No GA4 and no paid rank tracker. GSC is the rank tracker; D1 is the conversion
analytics.

### 5. Deploy

Create the project once, then deploy:

```bash
npx wrangler pages project create muncie-radon --production-branch=main
npm run build
npx wrangler pages deploy dist --project-name=muncie-radon
```

That is direct upload: no GitHub remote required, and it is the fastest path to
a live URL. The tradeoff is that deploys happen from your machine, so whatever
is in `dist/` at that moment is what ships.

To move to git-connected builds later (the pattern the other projects use),
push the repo to GitHub, connect it in the Pages dashboard, and set the build
command to `npm run build` with output directory `dist`. Cloudflare then builds
on push. `npm run audit` runs as part of `npm run build`, so the house rules
gate the deploy either way.

**Custom domain.** The domain was registered in this same account, so the zone
already exists and no nameserver change is needed.

`site.config.ts` sets `domain: 'muncieradon.com'`, so **the apex is canonical**
and every `<link rel="canonical">` and sitemap URL already points there. Add the
apex as the Pages custom domain, then send www to it with a bulk redirect or a
redirect rule (`www.muncieradon.com/*` → `https://muncieradon.com/$1`, 301).

Do not serve both hostnames. Two hostnames answering the same pages splits link
signals and makes GSC report the site twice, which is a slow problem to unwind
after indexing starts.

### 6. Verify live

- [ ] Submit a test lead. Confirm the row in D1 **and** the notification email.
  ```bash
  npx wrangler d1 execute muncie-radon --remote --command="SELECT ts,name,phone,page,form_id FROM leads ORDER BY id DESC LIMIT 5"
  ```
- [ ] Place a test call. Confirm the `calls` row, that the forward connects, and
      that the recording announcement plays on the answering leg.
- [ ] Tap a call button on a phone. Confirm a `call_clicks` row with the right
      `placement`.
- [ ] Re-run Lighthouse against the live domain.

### 7. Search

- [ ] Google Search Console, **domain property**, verified by DNS TXT in Cloudflare.
- [ ] Submit `https://muncieradon.com/sitemap-index.xml`.
- [ ] Request indexing on the money pages: home, radon-mitigation, real-estate-radon,
      radon-testing, contact.
- [ ] Bing Webmaster Tools, one-click import from GSC.

---

## Verification already done

Checked against the built output in `dist/`, not assumed:

- **Lighthouse mobile: 100 / 100 / 100 / 100** (performance, accessibility,
  best practices, SEO) on home, radon-mitigation, real-estate-radon, and contact.
- **50 JSON-LD blocks, 0 invalid.** 18 WebSite, 18 Organization, 15 BreadcrumbList,
  11 FAQPage, 6 Service.
- **1,156 internal links, 0 broken.**
- **0 em dashes** across `src/`, enforced by `npm run audit` on every build.
- **0 hardcoded phone numbers** outside `site.config.ts`, same enforcement.

Two accessibility defects were found and fixed rather than shipped: `--gray-500`
measured 4.40:1 on white (under the 4.5:1 AA floor) and the header brand link
carried an `aria-label` that omitted its own visible tagline.

---

## Deliberate omissions

Things that look missing but are not:

- **No `LocalBusiness` schema.** It implies a verifiable entity with hours, an
  address, and in practice a Google Business Profile. This is a lead-gen brand
  routing to a certified operator. Upgrade to `LocalBusiness` in the GBP phase,
  once the renter's real entity backs it. `WebSite` + `Organization` ship now.
- **No street address in the NAP.** Service-area business. Inventing one poisons
  citation consistency later.
- **No testimonials, review counts, years in business, or team page.** New brand.
- **No guarantee language.** It ships when a renter relationship exists to back it.
- **Towns in the footer's "Also serving" row are unlinked.** They have no pages,
  and spun pages are worse than no pages.

---

## Forking to a new city

The template is built for this. Kokomo is city #2.

1. Copy the repo, register the domain.
2. Rewrite `src/site.config.ts`. That is the only place city strings live.
3. Rewrite the 10 files in `src/content/`. Fresh content pass, not find-and-replace,
   because the local facts are the entire value of these pages.
4. Regenerate icons: `npm run icons`.
5. Work the launch checklist above.

No template edits should be required. If you need one, that is a bug in the
config abstraction; fix it in both repos.

---

## Post-launch

The Monday glance: GSC positions plus D1 leads and calls.

```sql
SELECT date(ts) d, count(*) FROM leads GROUP BY d ORDER BY d DESC LIMIT 14;
SELECT page, count(*) FROM leads GROUP BY page ORDER BY 2 DESC;
SELECT placement, count(*) FROM call_clicks GROUP BY placement ORDER BY 2 DESC;
```

Rule: rankings down but calls stable → ignore. Both down → investigate.

At roughly two months with leads flowing, open the outreach shortlist in
`docs/SCOUT-BRIEF-MUNCIE.md` (Great Lakes Radon → Clean Worx → AAA Environmental
→ Apex → Hoosier). Verify IDOH certification for each before routing anything.
