export const SITE_URL = 'https://fuseboxdiagrams.com';
export const SITE_NAME = 'Fuse Box Diagrams';
// While true: every page is noindex, robots.txt blocks crawlers, and a banner says the site isn't launched.
export const PREVIEW = false;
export const AMAZON_TAG = 'booforgen-20';
export const amazonUrl = (q: string) =>
  `https://www.amazon.com/s?k=${encodeURIComponent(q)}${AMAZON_TAG ? `&tag=${AMAZON_TAG}` : ''}`;
