# tusabysmriti

## Local development

```bash
npm ci
npm run dev
```

## Production build / hosting (Cloudflare Pages)

This site uses Vue-free Vite: run `npm run build` and serve the **`dist/`** folder (bundled CSS + JS), not raw `index.html` + `/src/*.js`. Serving the repo root without building first leaves the dev entry (`/src/main.js`) in place; the browser cannot resolve npm package names without Vite’s bundler.

**Cloudflare Pages** (recommended):

1. Connect this repo and use **Framework preset: Vite** (or equivalent), **Build command**: `npm run build`, **Build output directory**: `dist`.
2. `vite.config.js` defines a **`plugins` array** (even if empty). Cloudflare / Wrangler may inject tooling into it during deploy; without that array you can see deploy errors such as “could not find a valid plugins array.”
3. **`VITE_*` variables**: add them under **Pages → Settings → Environment variables**, then redeploy — Vite inlines them at **build time** only.

**Tailwind** is compiled via PostCSS (`tailwind.config.js`). Do **not** use `cdn.tailwindcss.com` in production — it warns and duplicates your real toolchain.

This project does **not** use Clerk. If your deployed site still throws errors about **`@clerk/clerk-js`**, remove any Clerk snippets from the hosted HTML/`src/*.js`, rebuild, and redeploy **`dist/`** from a branch that matches this repo.
