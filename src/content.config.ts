import { defineCollection } from 'astro:content';
// Astro 7 deprecated re-exporting `z` from astro:content.
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const faqSchema = z.object({
  /**
   * Phrase these the way people actually type them. The build spec requires
   * mined Reddit/PAA phrasing to survive into the question verbatim-adjacent
   * ("Is 3.3 pCi/L worth mitigating?"): do not smooth them into brochure voice.
   */
  q: z.string(),
  /** Inline HTML allowed (internal links). Stripped to text for JSON-LD. */
  a: z.string(),
});

const seo = {
  /** <title>. Under ~60 chars. Written for the SERP. */
  title: z.string().max(70),
  description: z.string().min(70).max(180),
  /** Visible page heading. Must differ from title: title sells the click, H1 confirms the landing. */
  h1: z.string(),
  /** Answer-first opening paragraph. Rendered above the prose body. */
  intro: z.string(),
  primaryKeyword: z.string(),
  faqs: z.array(faqSchema).default([]),
  order: z.number().default(50),
};

const services = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/services' }),
  schema: z.object({
    ...seo,
    /** Emit price range in Service JSON-LD. False for pages we don't price publicly. */
    priced: z.boolean().default(false),
    /** Sibling slugs to surface in the "related services" block */
    related: z.array(z.string()).default([]),
  }),
});

const areas = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/areas' }),
  schema: z.object({
    ...seo,
    /**
     * Town-true facts. The build spec's hard rule: "each page must contain
     * facts unique to the town or it doesn't ship." The area template refuses
     * to build with fewer than two.
     */
    localFacts: z.array(z.string()).min(2),
    /** Which three services this town's page leads with */
    featuredServices: z.array(z.string()).length(3),
  }),
});

export const collections = { services, areas };
