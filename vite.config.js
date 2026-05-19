import { defineConfig } from "vite";

/** Relative base keeps asset URLs valid on GitHub project pages (`/repo/`) without hard-coding the repo name. */
export default defineConfig({
  base: "./",
});
