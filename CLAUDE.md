# muncieradon.com

Rank-and-rent lead generation site for radon testing and mitigation in Muncie, Indiana.
Astro static on Cloudflare Pages. Config-templated so city #2 (Kokomo) forks from this repo.

Specs live in `docs/`. Read `docs/MUNCIE-RADON-SPEC.md` before changing content strategy.

## Commands

```
npm run dev      # dev server (daemonizes; `npx astro dev stop` to kill)
npm run build    # audit + production build to dist/
npm run audit    # house-rules check, also runs as part of build
npm run icons    # regenerate favicon PNGs + OG image from public/favicon.svg
```

## Architecture

**`src/site.config.ts` is the single source of truth for everything city-specific.**
Templates and components contain zero hardcoded city strings. Forking to a new
city means rewriting that one file plus the 10 content files, with no template
edits. If you find yourself typing "Muncie" into a `.astro` file, it belongs in
config instead.

- `src/content/services/*.mdx` — 6 service pages
- `src/content/areas/*.mdx` — 4 service-area pages
- `src/pages/services/[slug].astro`, `src/pages/service-areas/[slug].astro` — templates
- `functions/api/*` — Cloudflare Pages Functions (lead capture, call tracking)
- `schema.sql` — D1 tables

Content frontmatter is validated by `src/content.config.ts`. Area pages require
at least two `localFacts`, enforced at build time, because the whole point of an
area page is that it says something true only of that town.

## House rules

These are enforced by `npm run audit`, which fails the build:

1. **No em dashes.** Anywhere. Rewrite the sentence instead of substituting a
   different dash.
2. **No hardcoded phone numbers.** The tracking number renders only through
   `PhoneLink.astro`, which also fires the call-click beacon. One source means
   the number can be swapped without hunting through templates.

Not machine-enforceable, so hold the line manually:

3. **Claim nothing we cannot back 100%.** No invented years in business, team,
   review counts, testimonials, certifications, guarantees, or response-time
   promises. The brand is a connector: it routes leads to IDOH-certified
   professionals, and the certification belongs to them. Where a number is
   quoted, it traces to the spec's verified facts or to arithmetic shown on the
   page.
4. **No spun area pages.** A town gets a page when someone writes facts true
   only of that town. Until then it goes in the footer's "Also serving" row,
   unlinked.
5. **Answer-first paragraphs** under every H2, and FAQ questions phrased the way
   people actually type them.

## Accessibility

Lighthouse must stay at 100 across all four categories on mobile. Muted text is
where contrast quietly breaks: `--gray-500` is tuned to clear 4.5:1 on **both**
white and `--alt-bg`, so re-measure if you lighten it.

## Design tokens

All colors, spacing, and radii live in `:root` in `src/styles/global.css`.
Never use a raw hex outside that block.

Note `--field-border` is deliberately stronger than `--subtle-border`: form
inputs need more contrast than card edges to read as fields.

## Icons

Lucide via `astro-icon`, inlined as SVG at build time. Reference as
`<Icon name="lucide:phone" />`. No client JS, no sprite request.

The brand mark is `src/components/Logo.astro`. Its arrow is centered on the
shield's **optical** center (y=15), not the geometric center (y=16), because a
shield's mass sits above its midpoint. Keep `(apex + tail) / 2 === 15`.

## Client JS

`src/scripts/site.ts` is the entire client-side runtime: submit the quote form,
beacon call-clicks. Nothing else ships. Everything else on the site is a link.

## Before launch

See the checklist in `README.md`. The short version: real Twilio number in
config with `provisioned: true`, D1 created and schema applied, secrets set,
then GSC verification and sitemap submission.
