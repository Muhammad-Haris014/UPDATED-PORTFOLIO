// Build for Netlify: copy only the site into dist/ and fill in the site's public URL.
// No dependencies. Netlify sets URL to the site's primary address; locally it falls back to
// SITE_URL, or to relative links.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'dist');
const SITE_URL = (process.env.URL || process.env.SITE_URL || '').replace(/\/$/, '');
const COPY = ['index.html', '404.html', 'robots.txt', 'css', 'js', 'assets', 'data'];
const TEMPLATED = ['index.html', '404.html', 'robots.txt'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const item of COPY) {
  if (existsSync(join(ROOT, item))) await cp(join(ROOT, item), join(OUT, item), { recursive: true });
}

// %%SITE_URL%% becomes the live address (absolute links are what share previews need).
for (const file of TEMPLATED) {
  const path = join(OUT, file);
  if (!existsSync(path)) continue;
  let text = await readFile(path, 'utf8');
  if (!SITE_URL && file === 'robots.txt') text = text.replace(/^Sitemap:.*\r?\n?/m, '');
  await writeFile(path, text.replaceAll('%%SITE_URL%%', SITE_URL));
}

// One-page site, one sitemap entry.
if (SITE_URL) {
  const today = new Date().toISOString().slice(0, 10);
  await writeFile(join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod></url>\n</urlset>\n`);
}

console.log(`Built dist/ for ${SITE_URL || '(relative links)'}`);
