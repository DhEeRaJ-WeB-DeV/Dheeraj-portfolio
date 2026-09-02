# Dheeraj Sure — Portfolio

A single-page developer portfolio built around one idea: **a scroll-driven
journey through a glowing 3D tunnel**, with each section punctuated by its
own small piece of Three.js — a spinning skill carousel, a DNA-helix project
rack, glowing branch trees framing the viewport, a jellyfish companion that
follows your cursor — plus a fully playable browser game at the bottom.
Every visual is tuned to actually run well across a wide range of laptops,
not just the one it was built on (see §8, Adaptive graphics).

Live stack: **React 19 + Vite**, **Three.js** via `@react-three/fiber` +
`@react-three/drei` + `@react-three/postprocessing`, **Framer Motion** for
UI animation, plain CSS (no Tailwind/UI kit) with a small design-token
system, and a standalone static browser game (**Sword Quest**) embedded via
iframe.

---

## 1. Tech stack & why

| Piece | What it's for |
|---|---|
| **Vite + React** | Fast dev server, plain JSX, no framework magic |
| **`three` / `@react-three/fiber` / `@react-three/drei` / `@react-three/postprocessing`** | Every 3D scene — the scroll tunnel background, the corner trees, the cursor jellyfish, the skills carousel, the projects DNA helix, Bloom glow |
| **`framer-motion`** | Scroll reveals, layout animation, `AnimatePresence` mount/unmount transitions, scroll-linked parallax (`useScroll`/`useTransform`), the hero's typing/particle sequence |
| **Plain CSS + CSS custom properties** | Design tokens, no build-time CSS framework — keeps the bundle small and every value easy to find |
| **`vite-plugin-static-copy`** | Copies the standalone `/game` folder into `dist/game` on build, so it stays reachable at `/game/index.html` in both dev and production |
| **Google Fonts (`Space Grotesk`, `JetBrains Mono`, `Inter`)** | Loaded via `<link>` in `index.html` |

No component library, no CSS framework, no state management library — the
dependency footprint is intentionally small.

---

## 2. Project structure

```
src/
  data/
    resume.js         # all resume content (profile, skillGroups, experience, projects, education)
    skillDetails.js    # per-skill blurb + tool list shown on the Skills carousel card back
  hooks/
    useTilt.js          # shared mouse-tilt + spotlight hook, used by interactive cards
    useInViewOnce.js    # IntersectionObserver hook — lazily reveals/mounts a section once
  utils/
    deviceTier.js       # device-capability heuristic (low/medium/high) — see §8
    skillIcons.js        # skill name -> icon URL/slug/monogram lookup
  three/                # every Three.js scene lives here, one file per scene
    ScrollTunnelBackground.jsx  # the always-on scroll tunnel (rings, particles, Bloom) — see §5
    TunnelOrb.jsx / TunnelRings.jsx   # tunnel scene pieces
    ScrollTrees.jsx / TreeModel3D.jsx / Tree3D.jsx / treeGenerator3d.js
                                  # the two glowing corner trees, sharing one Canvas — see §6
    CursorJellyfish.jsx / JellyfishModel3D.jsx / NavJellyfishIcon.jsx
                                  # the cursor-trailing jellyfish companion — see §6
    SkillsCarousel.jsx           # the draggable 3D skill ring (Skills section)
    DnaHelixModel.jsx            # the rotating project-card helix (Projects section)
    FractalWave.js / FractalWaveCard.jsx   # per-project-card canvas wave effect
    PhotoParticles.jsx           # hero portrait's particle-converge entrance
    MiniCanvas.jsx / FloatingParticles.jsx / WaterReflection.jsx / WebStrings.jsx
                                  # smaller shared/section 3D helpers
    themePalette.js / profileSilhouetteData.js
  components/
    Nav.jsx / Hero.jsx / About.jsx / Skills.jsx / Experience.jsx /
    Projects.jsx / ProjectsDnaScene.jsx / Education.jsx / Contact.jsx /
    GameShowcase.jsx / CloudTransition.jsx / PhotoReveal.jsx /
    ResumeModal.jsx / Footer.jsx
    *.css                        # one stylesheet per component, co-located
  index.css                # design tokens + global resets + shared utility classes
  theme.jsx                 # theme context (single fixed "blue" theme; see §7)
  perf.jsx                  # PerfProvider/usePerf() — device-tier context; see §8
  App.jsx                  # mounts everything, in DOM order
  main.jsx                  # React root — wraps App in PerfProvider + ThemeProvider

game/                    # Sword Quest — standalone static browser game (own HTML/CSS/JS,
                          # no build step, no React). See §9.
  index.html
  styles.css
  js/00_quality.js …10_main.js
  assets/

public/
  models/                 # .glb assets (tree branch, jellyfish) used by the three/ scenes
  Dheeraj_Sure_Resume.pdf
```

**Content is fully separated from layout.** Every word of resume copy lives
in `src/data/resume.js`; per-skill blurbs live in `src/data/skillDetails.js`.
To update your info, you never need to touch a component file.

---

## 3. Page layout (`App.jsx`)

Two always-mounted 3D layers sit behind/around everything —
`ScrollTunnelBackground` (fixed, full-viewport) and `ScrollTrees` (the two
corner trees) — plus `CursorJellyfish`, which mounts only while summoned.
On top of those, `Nav` and then the section stack in DOM order: **Hero →
About → Skills → Experience → Projects → Education → Contact → Footer**.

A page-wide double-tap/double-click listener dismisses the cursor
jellyfish back into its nav icon from anywhere on the page — it only
attaches while the jellyfish is actually active, so it adds no overhead
the rest of the time.

---

## 4. Design system

Defined as CSS custom properties in `src/index.css`, applied per `[data-theme]`
block. The site currently ships a single fixed theme ("blue" — see §7), so
in practice only that block is active, but the token *names* below are what
every component and 3D scene reads from:

```css
--bg / --bg-elevated / --surface / --surface-2   /* backgrounds */
--border / --border-soft                          /* hairlines */
--text / --text-dim / --text-faint

--accent-core      /* origin/identity accent */
--accent-frontend  /* React/TS/Tailwind-family */
--accent-backend   /* Node/Express/Django-family */
--accent-data      /* Mongo/Postgres/Redis-family */
--accent-infra     /* AWS/Docker/Prometheus-family */
--accent-danger
```

`theme.jsx` mirrors the active theme's palette as a plain hex array
(`useTheme().colors`) so WebGL/three.js materials — which can't read CSS
custom properties directly — stay in sync with the rest of the page.

Typography: `Space Grotesk` for headings, `JetBrains Mono` for anything
data/label/code-like (nav links, tags, stats, the Hero's terminal-style
request log), `Inter` for body copy.

Layout is a `.container` (max-width) + `.section` (large vertical padding)
pattern reused by every section — see the shared classes at the bottom of
`index.css` (`.eyebrow`, `.section-title`, `.section-sub`, `.glass-card`,
`.tag`, `.section-head-3d`).

---

## 5. The background: scroll tunnel

`three/ScrollTunnelBackground.jsx` is a single fixed, full-viewport
`<Canvas>` that renders a tunnel of receding, glowing rings and drifting
particles, with color blending between section-accent colors as you scroll
through the page — the camera's Z position is driven directly by scroll
progress (a `scrollRef` updated by a `window` scroll listener, smoothed via
lerp in `useFrame`), so the tunnel visually "travels" with you rather than
just sitting static behind the content.

Every count in the scene — ring count, particle count, DPR ceiling,
antialiasing, and whether the Bloom post-processing pass runs at all (the
single most expensive effect here) — comes from a tier-keyed config table
driven by `usePerf().tier` (see §8), with an additional cap applied on
narrow/mobile viewports. Canvas has `pointer-events: none` so it never
intercepts clicks on real content, and the frame loop switches to
`"demand"` when the tab is hidden or `prefers-reduced-motion` is set.

---

## 6. Corner trees & the cursor jellyfish

**`ScrollTrees.jsx`** renders two real 3D branch-tree models
(`public/models/tree-branch.glb`, via `TreeModel3D.jsx`) grounded at the
bottom-left/bottom-right corners of the viewport, sharing a single
`<Canvas>`/WebGL context with each other (the page already runs several
WebGL contexts per section, so this avoids adding two more — browsers only
guarantee a modest number of simultaneous contexts before older ones start
getting silently dropped). The camera is recalibrated on every resize so
one world unit equals one CSS pixel at `z=0`, turning "plant a tree near
this corner" into plain pixel arithmetic. The right tree reuses the same
model mirrored via a negative group scale. Each tree is "made of" a dense
dust-cloud of small glowing points scattered across its own mesh triangles
(weighted by triangle area); this per-tree particle count is the one thing
here that scales hardest with device tier (§8), since it's the single
biggest per-tree cost in the scene.

**`CursorJellyfish.jsx`** is a small companion (`JellyfishModel3D.jsx`)
that swims out of the jellyfish icon in the nav bar (`NavJellyfishIcon.jsx`)
and trails the cursor around the page until toggled off, at which point it
shrinks and dissolves back into the icon. Shares the same "one world unit
== one CSS pixel" camera convention as the corner trees. DPR ceiling and
antialiasing are tier-aware (§8).

---

## 7. Theming

`theme.jsx` is a small context that drives the `[data-theme]` attribute on
`<html>` and exposes a matching hex palette via `useTheme()` for the 3D
scenes to read. The site currently ships a single fixed theme ("blue") —
an earlier multi-theme picker (a Nav dropdown with green/violet/red/mono
options) was removed, but `THEMES` is kept as a one-item list and
`setThemeId` kept as a no-op specifically so nothing downstream that reads
`theme`/`themeId` had to change shape. Re-adding a picker would mean adding
entries back to `THEMES` and un-stubbing `setThemeId`.

---

## 8. Adaptive graphics — scaling to the machine it's running on

The site targets everything from a discrete-GPU desktop to an old
integrated-graphics laptop by scaling how much 3D/particle work it does to
what the machine can actually afford, rather than shipping one fixed
quality level.

**`src/utils/deviceTier.js`** — a one-shot heuristic that buckets the
machine into `"low"` / `"medium"` / `"high"` from:
- the WebGL GPU renderer string (via the `WEBGL_debug_renderer_info`
  extension), keyword-matched against known low-power vs. discrete/higher-end GPUs
- `navigator.hardwareConcurrency` (logical core count)
- `navigator.deviceMemory` (approximate RAM, Chromium-only)
- coarse-pointer / narrow-viewport (treated as a mobile-class signal)
- `navigator.connection.saveData` / a slow `effectiveType` (explicit "go easy" signal)

**`src/perf.jsx`** — `PerfProvider`/`usePerf()`, wrapping the whole app in
`main.jsx`:
- Applies the heuristic synchronously on first render, so the very first
  frame already renders at the right quality — no flash of full-quality
  graphics that then drops a frame later.
- Runs a short (~4s) live FPS probe after mount and drops the tier by one
  step if the page is actually struggling in practice — catches cases the
  heuristic alone can't see, like an old GPU driver or battery-saver
  throttling. It only ever downgrades, and only once.
- `?gfx=low|medium|high` on the page URL forces a tier and skips the probe
  entirely, for testing each quality level on any machine.

**Wired into every heavy render path:**
- `ScrollTunnelBackground.jsx` — ring count, particle count, DPR ceiling,
  antialiasing, and the Bloom pass all scale with tier (§5).
- `TreeModel3D.jsx` — the per-tree dust-cloud particle count scales with tier (§6).
- `CursorJellyfish.jsx` — DPR ceiling and antialiasing scale with tier (§6).
- `ProjectsDnaScene.jsx` — extends its existing mobile-only Bloom/DPR gating to also respect tier on desktop.

**The embedded game inherits it too** — `GameShowcase.jsx` builds the game's
iframe/link URL with `&gfx=<tier>` so Sword Quest starts at the same
quality the portfolio already settled on, instead of re-detecting from
scratch. Inside the game, `game/js/00_quality.js` is a standalone plain-JS
port of the same heuristic (the game has no build step and can't import
React app modules) that self-detects if opened directly with no `?gfx=`
param. It exposes `window.GFX.scaleCount()`, used to cut particle-spawn
volume in hit/blood effects, and `window.GFX.glowFilter()`, used to trim
the game's stacked `drop-shadow` glow layers — down to none at all on low
tier, where the base sprite art still reads clearly without them.

---

## 9. Sword Quest — the embedded game

`Contact.jsx` renders `GameShowcase.jsx`, which links to **Sword Quest**, a
fully static, no-build-step browser game living in the top-level `/game`
folder (its own `index.html`, `styles.css`, `js/00_quality.js` through
`js/10_main.js`, and `assets/`). It's kept as a clearly separate project in
the repo rather than folded into `/public`; `vite-plugin-static-copy`
serves it at `/game` in dev and copies it into `dist/game` on build, so the
URL is the same either way.

Clicking "Play" opens the game inside a full-viewport overlay (not a new
tab) so the click's user-gesture can be used to request fullscreen — the
Fullscreen API requires a direct gesture, which can't be handed off to a
separately opened tab. `CloudTransition.jsx` masks the jump with a
full-viewport cloud-roll animation, with fallback timers in case the
browser skips the `animationend` event the transition normally waits on
(observed in practice around the exact moment `requestFullscreen()` fires).

---

## 10. Card interactions

### `hooks/useTilt.js`
An imperative hook: on `mousemove`, computes the cursor's position inside
the element (0–1) and directly sets `element.style.transform` (a
perspective tilt) plus `--mx`/`--my`/`--spot-opacity` CSS custom
properties. Deliberately imperative — using React state for a value that
changes on every `mousemove` would re-render per pixel; mutating the DOM
through a ref is instant and never triggers React's render cycle.

### `hooks/useInViewOnce.js`
A small `IntersectionObserver` wrapper used to lazily mount/reveal
heavier sections (e.g. the Skills carousel) only once they're actually
scrolled near, rather than on initial page load.

### Skills — 3D carousel
`SkillsCarousel.jsx`: a draggable ring of 3D skill cards, each backed by
`skillDetails.js` for the flip-side blurb + tool count. Card size scales
fluidly with viewport width.

### Projects — DNA helix
`ProjectsDnaScene.jsx` + `DnaHelixModel.jsx`: project cards arranged around
a rotating helix, each card getting its own `FractalWaveCard.jsx` canvas
wave effect on hover, with Bloom post-processing gated by both viewport
width and device tier (§8).

---

## 11. Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build -> dist/ (includes dist/game)
npm run preview   # preview the production build
```

No environment variables, no backend — it's a fully static build. Lint with
`npm run lint` (uses `oxlint`).

## 12. Editing your content

- **Resume content** (name, blurb, skills, experience, projects, education,
  links) → `src/data/resume.js` only.
- **Per-skill carousel-card blurbs** → `src/data/skillDetails.js`.
- **Colors** → the `--accent-*` variables in `src/index.css`, under the
  active `[data-theme]` block (see §7). Changing one updates it everywhere
  since nothing hardcodes a hex value outside `index.css`/`theme.jsx`.
- **Sword Quest** content/balance → `game/js/*.js` directly (plain JS, no
  build step — edits are live on refresh in dev).

## 13. Deploying

Static Vite build — `npm run build` outputs `dist/` (including
`dist/game`), deployable as-is to Vercel, Netlify, GitHub Pages, or any
static host. No server-side code.

## 14. Performance notes

The site runs **several WebGL canvases at once** (scroll-tunnel background,
corner trees, the skills carousel, the projects DNA scene, and the cursor
jellyfish when active), plus the embedded game's own 2D canvas when open.
All of the always-on 3D layers now scale to the device via the adaptive
graphics system in §8 rather than a single fixed quality level — ring/
particle counts, DPR, antialiasing, and Bloom all drop automatically on
weaker machines. `prefers-reduced-motion` is respected by freezing the
scroll-tunnel's frame loop (`frameloop="demand"`), and canvases pause when
the tab is hidden. If you add more always-on 3D scenes and notice jank even
after tier-scaling them, the next lever to pull is pausing canvases that
are scrolled out of view with an `IntersectionObserver` (the pattern
`useInViewOnce.js` already uses for lazy-mounting).