# Jeremy — Track Day portfolio

A motion-heavy portfolio for an independent designer & developer, built as a racing lap:
start-light loader, a racing line that draws down the page, a horizontal speed run through
concept builds, a laptop that opens on scroll, a pit-stop configurator that renders a visitor's
own site live on 3D devices, and a chequered-flag contact form.

**Live:** https://jeremygideonbareh.github.io/jeremy-portfolio/

## Stack
Vite · GSAP + ScrollTrigger · Lenis · Three.js · Blender (devices and ceramics) · Playwright (capture tooling)

## Develop
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Make it yours
Edit `src/config.js`: `SITE.email`, `SITE.formEndpoint` (e.g. Formspree), `SITE.socials`, and the
`PROJECTS` list (set `concept: false` for real client work).

## 3D assets
- `blender/build_devices.py`: phone and laptop → `public/models/devices.glb`, compressed with
  `gltf-transform` (meshopt)
- `blender/render_ceramics.py`: product shots for the Kiln & Co. concept
- Concept photography: CC0 from Poly Haven. See `public/images/CREDITS.txt`.

Deploys to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`).
