# Muhammad Haris — Portfolio

A static portfolio site with no framework. It's plain HTML, CSS and ES modules, plus a tiny build step that copies the site into `dist/`.

## Run locally

ES modules don't load from `file://`, so serve the folder:

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## Test

```bash
npm test
```

## Deploy to Netlify

`netlify.toml` already holds the settings. The build runs the tests, then `node scripts/build.mjs`, and publishes `dist/`. There's nothing to install. On Netlify the build fills in the live address for share previews, `robots.txt` and `sitemap.xml`.

**Option A: connect GitHub.** Netlify then redeploys on every push.

1. Push this repo to GitHub.
2. On https://app.netlify.com go to **Add new project → Import an existing project → GitHub**, then pick the repo.
3. Netlify reads `netlify.toml`, so you don't need to change any build settings. Click **Deploy**.
4. Under **Project configuration → Change project name**, set a unique name such as `muhammad-haris-ai`. The site then lives at https://muhammad-haris-ai.netlify.app.
5. Trigger one more deploy (**Deploys → Trigger deploy**) so the share previews pick up the new address.

**Option B: drag and drop.**

1. Build locally with your final address:
   ```bash
   SITE_URL=https://muhammad-haris-ai.netlify.app npm run build
   ```
   In Windows PowerShell, run `$env:SITE_URL="https://muhammad-haris-ai.netlify.app"; npm run build` instead.
2. Drop the `dist/` folder onto https://app.netlify.com/drop, then rename the project as in step 4 above.

## Where things live

- `index.html`: all page content.
- `css/style.css`: all styles.
- `js/main.js`: wires up each section. Every effect has its own module in `js/` (hero ring, skyline, ledger, journey, menu, WhatsApp orb…).
- `assets/`: CV, share image, icons and link-preview screenshots.
- `data/contributions.json`: GitHub activity snapshot, used if the live API is unreachable.
- `scripts/build.mjs`: the Netlify build.
- To change the WhatsApp number, edit `mountWhatsAppOrb(…, { phone: '923437354889' })` in `js/main.js`.
