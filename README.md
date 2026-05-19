# tusabysmriti

## Local development

```bash
npm ci
npm run dev
```

## Production build / static hosting (GitHub Pages, GitLab Pages, etc.)

This site uses Vue-free Vite: run `npm run build` and deploy the **`dist/`** folder (bundled CSS + JS), not raw `index.html` + `/src/*.js`. Serving the repo root without building first leaves the dev entry (`/src/main.js`) in place; the browser cannot resolve npm package names like `@clerk/...` or `@scope/pkg` without Vite’s bundler.

- **GitHub Pages (automated)**: push to `main` or `master` with `.github/workflows/deploy-github-pages.yml`, then enable **Settings → Pages → Build and deployment → GitHub Actions**.
- **GitLab Pages (automated)**: `.gitlab-ci.yml` runs `npm ci && npm run build` and publishes the **`dist/`** output as the Pages artifact. After the pipeline succeeds, the site should load `./assets/*.js`, not `/src/main.js`. If you previously used a manual “folder” deployment from the repo root, switch to this pipeline or set your build to output **`dist/`** only.
- **`VITE_*` variables**: expose them **before** `npm run build` in the workflow (for example echo into `.env.production.local` from encrypted repo secrets / variables) — Vite replaces `import.meta.env` at compile time only.

**Tailwind** is compiled via PostCSS (`tailwind.config.js`). Do **not** use `cdn.tailwindcss.com` in production — it warns and duplicates your real toolchain.

This project does **not** use Clerk. If your deployed site still throws errors about **`@clerk/clerk-js`**, remove any Clerk snippets from the hosted HTML/`src/*.js`, rebuild, and redeploy **`dist/`** from a branch that matches this repo.
