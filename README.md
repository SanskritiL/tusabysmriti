# tusabysmriti

## Local development

```bash
npm ci
npm run dev
```

## Production build / GitHub Pages

This site uses Vue-free Vite: run `npm run build` and deploy the **`dist/`** folder (bundled CSS + JS), not raw `index.html` + `/src/*.js`.

- **Automated**: push to `main` or `master` with the workflow in `.github/workflows/deploy-github-pages.yml`, then enable **Settings → Pages → Build and deployment → GitHub Actions**.
- **`VITE_*` variables**: expose them **before** `npm run build` in the workflow (for example echo into `.env.production.local` from encrypted repo secrets / variables) — Vite replaces `import.meta.env` at compile time only.

**Tailwind** is compiled via PostCSS (`tailwind.config.js`). Do **not** use `cdn.tailwindcss.com` in production — it warns and duplicates your real toolchain.

This project does **not** use Clerk. If your deployed site still throws errors about **`@clerk/clerk-js`**, remove any Clerk snippets from the hosted HTML/`src/*.js`, rebuild, and redeploy **`dist/`** from a branch that matches this repo.
