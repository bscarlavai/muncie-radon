/**
 * JSON-LD builders.
 *
 * DELIBERATE OMISSION: no LocalBusiness node ships at launch. LocalBusiness
 * implies a verifiable business entity with hours, an address, and (in
 * practice) a Google Business Profile. This site is a lead-generation brand
 * that routes to a certified operator: claiming LocalBusiness before that
 * relationship exists is a claim we can't back. Upgrade to LocalBusiness in
 * the GBP phase, once the renter's real entity is behind it.
 */
import { site } from '../site.config';

const ORIGIN = `https://${site.domain}`;

export const url = (path = '/') => `${ORIGIN}${path}`;

/** Stable @id references so the graph nodes link instead of duplicating. */
export const IDS = {
  website: url('/#website'),
  organization: url('/#organization'),
};

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': IDS.organization,
    name: site.brand,
    url: ORIGIN,
    telephone: site.phone.tel,
    email: site.email,
    description: `${site.brand} connects ${site.city}, ${site.state} homeowners with ${site.localFacts.certifier}-certified radon testing and mitigation professionals.`,
    areaServed: [
      { '@type': 'City', name: site.city },
      ...site.areas.map((area) => ({ '@type': 'City', name: area.name })),
      { '@type': 'AdministrativeArea', name: site.county },
    ],
  };
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': IDS.website,
    url: ORIGIN,
    name: site.brand,
    inLanguage: 'en-US',
    publisher: { '@id': IDS.organization },
  };
}

/** Sitewide graph: rendered once, in the base layout. */
export function siteGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [websiteSchema(), organizationSchema()],
  };
}

export function serviceSchema(opts: {
  name: string;
  description: string;
  path: string;
  /** Omit for services we don't publish a price band for */
  priceRange?: { min: number; max: number };
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    url: url(opts.path),
    serviceType: opts.name,
    provider: { '@id': IDS.organization },
    areaServed: [
      { '@type': 'City', name: site.city },
      { '@type': 'AdministrativeArea', name: site.county },
    ],
    ...(opts.priceRange
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'PriceSpecification',
              minPrice: opts.priceRange.min,
              maxPrice: opts.priceRange.max,
              priceCurrency: 'USD',
              valueAddedTaxIncluded: false,
            },
          },
        }
      : {}),
  };
}
