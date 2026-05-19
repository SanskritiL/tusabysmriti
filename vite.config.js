import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";

/** Relative base keeps asset URLs valid when served from subpaths without hard-coding the path. */
export default defineConfig({
  base: "./",
  plugins: [cloudflare()],
});