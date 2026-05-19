import { defineConfig } from "vite";

/** Relative base keeps asset URLs valid when served from subpaths without hard-coding the path. */
export default defineConfig({
  base: "./",
  plugins: [],
});
