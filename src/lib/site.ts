// Placeholder until Jon picks the domain. Change SITE_URL and SITE_NAME, then set PREVIEW to false to let Google in.
export const SITE_URL = 'https://fuse-box-diagrams.pages.dev';
export const SITE_NAME = 'Fuse Box Diagram Finder';
// While true: every page is noindex, robots.txt blocks crawlers, and a banner says the data is sample data.
export const PREVIEW = true;
export const AMAZON_TAG = 'booforgen-20';
export const amazonUrl = (q: string) =>
  `https://www.amazon.com/s?k=${encodeURIComponent(q)}${AMAZON_TAG ? `&tag=${AMAZON_TAG}` : ''}`;
