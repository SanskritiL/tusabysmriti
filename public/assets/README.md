# Site images (`public/assets`)

Put your image files here. Vite serves everything under `public/` from the **site root**, so a file named `hero.jpg` in this folder is available at **`/assets/hero.jpg`**.

## Expected filenames

Match these names (or edit the `SITE_IMAGES` object at the top of `src/main.js`):

| File | Used for |
|------|-----------|
| `hero.jpg` | Hero — finished portrait (bottom / “Finished” side of the swipe) |
| `hero-sketch.jpg` | Same garment / pose as `hero.jpg` — sketch version (top / “Sketch” side); drag to compare |
| `sketch-vision.jpg` | From Sketch to Silk — left card (Phase I) |
| `sketch-structure.jpg` | From Sketch to Silk — right card (Phase II) |
| `journey-1.jpg` … `journey-4.jpg` | “What your journey looks like” — four steps, in order |
| `portfolio-crimson.jpg` | Portfolio — first highlight |
| `portfolio-heritage.jpg` | Portfolio — second highlight |
| `portfolio-ivory.jpg` | Portfolio — third highlight |

## Tips

- **Formats:** JPG, PNG, or WebP are fine; update the filename in `SITE_IMAGES` if you use `.webp`.
- **Size:** For hero and portfolio (full-width crops), aim for **roughly 1600–2400px** on the long edge; journey/step images work well around **1200–1600px** wide. Compress for web (export ~70–85% JPEG quality or use WebP).
- **Aspect:** The layout uses fixed aspect ratios in CSS (`object-cover` / `object-contain`); slightly taller/wider sources still look good.

After adding or renaming files, restart `npm run dev` if the dev server was already running (usually not required for new files).
