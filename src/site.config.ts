/**
 * SINGLE SOURCE OF TRUTH for everything city-specific.
 *
 * Templates and components MUST NOT contain hardcoded city strings. To stamp
 * city #2 (Kokomo) from this template: copy the repo, rewrite this file, and
 * rewrite the 10 content files in src/content/. Zero template edits.
 */

export type Service = {
  slug: string;
  /** Nav + card label */
  name: string;
  /** 2-3 sentence blurb used on the home "Radon Services" section and area pages */
  blurb: string;
  /** Shown on service cards under the blurb; omit when not price-bearing */
  priceNote?: string;
  /** Lucide icon name, resolved by astro-icon at build time */
  icon: string;
  /** Launch-minimum tier ships first; others roll out weekly */
  launchTier: boolean;
};

export type Area = {
  slug: string;
  name: string;
  county: string;
  /** Drive time from the hub city */
  driveTime: string;
};

export const site = {
  brand: 'Muncie Radon',
  domain: 'muncieradon.com',
  /** Long form, used in the footer and OG copy. */
  tagline: 'Certified radon testing & mitigation for Delaware County',
  /**
   * Short form for the header lockup. Say what we do and where. Resist the
   * urge to put a stat here: next to the shield mark, any credential-shaped
   * phrase reads as something we hold rather than something about the county.
   */
  headerTagline: 'Radon testing & mitigation · Delaware County',

  city: 'Muncie',
  state: 'Indiana',
  stateAbbr: 'IN',
  county: 'Delaware County',
  region: 'East Central Indiana',
  geo: { lat: 40.1934, lng: -85.3864 },

  /**
   * TRACKING NUMBER (Twilio). Replace BOTH values together, then run
   * `npm run audit:phone` to prove no stale number survives anywhere.
   * Until provisioned this forwards to Bret's phone (launch-window rule).
   */
  phone: {
    display: '(765) 722-2494',
    tel: '+17657222494',
    /** Flip to true once the real Twilio number is live. Build warns while false. */
    provisioned: true,
  },

  email: 'quotes@muncieradon.com',

  hours: 'Mon–Sat, 8am–7pm ET',

  priceRange: '$1,200–$2,000',
  priceRangeMin: 1200,
  priceRangeMax: 2000,

  /** Every one of these is verified-true. Do not add a fact you cannot check. */
  localFacts: {
    epaZone: 1,
    avgLevel: 4.0,
    epaActionLevel: 4.0,
    countyPopulation: '111,000',
    stateAvgInstallLow: 800,
    stateAvgInstallHigh: 1200,
    certifier: 'IDOH',
    certifierFull: 'Indiana Department of Health',
    peakSeason: 'winter',
  },

  /** POST target for the quote form (Cloudflare Pages Function) */
  formEndpoint: '/api/lead',

  /**
   * Cloudflare Web Analytics token. No GA4: GSC is the rank tracker, D1 is
   * conversion analytics, and gtag would cost the Lighthouse 100 and pull a
   * cookie banner in behind it.
   *
   * Not a secret. It ships in the HTML of every page, which is why it lives in
   * committed config rather than the secret store, and why it forks with the repo.
   *
   * RUM is set to "Enable with JS Snippet installation" in the dashboard, NOT
   * plain "Enable". Auto-injection plus this token would load two beacons and
   * double-count every pageview.
   */
  analyticsToken: 'fcab4e5cb86d46b294e68a518b90a2d1',

  services: [
    {
      slug: 'radon-mitigation',
      name: 'Radon Mitigation',
      blurb:
        'A sub-slab depressurization system vents radon from beneath your foundation to above the roofline. Most Muncie homes are a one-day install, and the job should end with a post-mitigation test that documents the new number.',
      priceNote: 'Typically $1,200–$2,000 installed',
      icon: 'lucide:house',
      launchTier: true,
    },
    {
      slug: 'radon-testing',
      name: 'Radon Testing',
      blurb:
        'A 48-hour professional test tells you the one thing you cannot see, smell, or taste. In a county where the average home sits at the EPA action level, testing is the only way to know which side of the line your house is on.',
      priceNote: 'Free estimates',
      icon: 'lucide:gauge',
      launchTier: true,
    },
    {
      slug: 'real-estate-radon',
      name: 'Real Estate Radon',
      blurb:
        'Failed the radon test during inspection? Radon is one of the more fixable inspection findings. Testing and mitigation for buyers, sellers, and agents working against a closing date.',
      priceNote: 'Built around your closing date',
      icon: 'lucide:key-round',
      launchTier: true,
    },
    {
      slug: 'crawl-space-radon',
      name: 'Crawl Space Radon',
      blurb:
        'A large share of Delaware County homes sit on crawl spaces, where standard sub-slab systems do not apply. Sub-membrane depressurization seals the ground with heavy-gauge liner and pulls the soil gas out from under it.',
      priceNote: 'Sealed liner system',
      icon: 'lucide:layers',
      launchTier: false,
    },
    {
      slug: 'system-repair',
      name: 'System Repair & Fan Replacement',
      blurb:
        'Radon fans wear out at around ten years, and a dead fan is a silent failure: the system looks correct while the house fills back up. Fan replacement, undersized-system fixes, and a retest to confirm the repair worked.',
      priceNote: 'Quoted after diagnosis',
      icon: 'lucide:wrench',
      launchTier: false,
    },
    {
      slug: 'commercial-radon',
      name: 'Commercial & Multifamily',
      blurb:
        'Schools, daycares, offices, and apartment buildings need multi-unit testing protocols and engineered mitigation designs, plus documentation that satisfies a board or a lender.',
      priceNote: 'Quoted per building',
      icon: 'lucide:building-2',
      launchTier: false,
    },
  ] satisfies Service[],

  areas: [
    { slug: 'anderson', name: 'Anderson', county: 'Madison County', driveTime: '20 minutes' },
    { slug: 'yorktown', name: 'Yorktown', county: 'Delaware County', driveTime: '10 minutes' },
    { slug: 'albany', name: 'Albany', county: 'Delaware County', driveTime: '15 minutes' },
    { slug: 'daleville', name: 'Daleville', county: 'Delaware County', driveTime: '15 minutes' },
  ] satisfies Area[],

  /** Towns named in copy + footer that do not (yet) get their own page. */
  additionalTowns: ['Eaton', 'Gaston', 'Selma', 'Chesterfield', 'Middletown'],

  nav: [
    { href: '/services/radon-mitigation/', label: 'Mitigation' },
    { href: '/services/radon-testing/', label: 'Testing' },
    { href: '/services/real-estate-radon/', label: 'Real Estate' },
    { href: '/service-areas/', label: 'Service Areas' },
    { href: '/about/', label: 'About' },
    { href: '/contact/', label: 'Contact' },
  ],
};

/* ---------- Derived helpers (keep templates free of string assembly) ---------- */

export const cityState = `${site.city}, ${site.state}`;
export const cityStateAbbr = `${site.city}, ${site.stateAbbr}`;

export const serviceBySlug = (slug: string) =>
  site.services.find((s) => s.slug === slug);

export const areaBySlug = (slug: string) =>
  site.areas.find((a) => a.slug === slug);

/** "Yorktown, Albany, Daleville and Anderson" */
export const areaListSentence = () => {
  const names = site.areas.map((a) => a.name);
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export type SiteConfig = typeof site;
