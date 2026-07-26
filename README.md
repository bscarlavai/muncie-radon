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
wrangler d1 create muncie-radon
# paste the returned database_id into wrangler.toml
wrangler d1 execute muncie-radon --remote --file=./schema.sql
```

### 3. Secrets

Set in the Pages dashboard or via `wrangler pages secret put <NAME>`:

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

```bash
npm run build
wrangler pages deploy dist --project-name=muncie-radon
```

Then attach the `muncieradon.com` custom domain in the Pages dashboard.

### 6. Verify live

- [ ] Submit a test lead. Confirm the row in D1 **and** the notification email.
  ```bash
  wrangler d1 execute muncie-radon --remote --command="SELECT ts,name,phone,page,form_id FROM leads ORDER BY id DESC LIMIT 5"
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
