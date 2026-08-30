# Dheeraj Sure — Portfolio

A single-page developer portfolio built around one idea: **a backend engineer's
world is nodes, edges, requests, and things that ripple when you touch them.**
Every visual on this site — the hero graph, the card interactions, the
background — is built to reinforce that instead of just decorating the page.

Live stack: **React 19 + Vite**, **Three.js** via `@react-three/fiber` and
`@react-three/drei`, **Framer Motion** for UI animation, plain CSS (no
Tailwind/UI kit) with a small design-token system.

---

## 1. Tech stack & why

| Piece | What it's for |
|---|---|
| **Vite + React** | Fast dev server, plain JSX, no framework magic |
| **`three` / `@react-three/fiber` / `@react-three/drei`** | All 3D scenes — the hero network graph, the section decorations, and the fullscreen background |
| **`framer-motion`** | Scroll reveals, layout animation (card resizing), `AnimatePresence` for mount/unmount transitions, scroll-linked parallax (`useScroll` / `useTransform`) |
| **Plain CSS + CSS custom properties** | Design tokens, no build-time CSS framework — keeps bundle small and every value easy to find |
| **Google Fonts (`Space Grotesk`, `JetBrains Mono`, `Inter`)** | Loaded via `<link>` in `index.html` |

No component library, no CSS framework, no state management library — the
whole thing intentionally has a small dependency footprint.

---

## 2. Project structure

```
src/
  data/
    resume.js        # all resume content (profile, skills, experience, projects, education)
    graph.js          # node/edge data for the hero's 3D network graph
  hooks/
    useTilt.js        # shared mouse-tilt + spotlight hook, used by every interactive card
  three/               # every Three.js scene lives here, one file per scene
    Scene.jsx              # hero Canvas wrapper (camera, lights, fog)
    NetworkGraph.jsx       # hero's rotating node graph — composes the three below
    GraphNode.jsx           # single node: icosahedron + glow + label + hover/click
    GraphEdges.jsx           # static lines between nodes
    GraphPulses.jsx          # instanced traveling "request" pulses along edges
    MiniCanvas.jsx          # shared lightweight Canvas wrapper for section decorations
    SkillsOrb.jsx            # orbiting node cluster (Skills section)
    ExperienceHelix.jsx      # ascending spiral (Experience section)
    ProjectStack3D.jsx       # floating container stack (Projects section)
    FractalWaveField.jsx    # the particle wave-terrain background (see §5)
  components/
    UniverseBackground.jsx  # fixed fullscreen canvas: dust field + wave terrain
    ScrollProgress.jsx       # top progress bar tied to scroll position
    Nav.jsx / Hero.jsx / About.jsx / Skills.jsx / Experience.jsx /
    Projects.jsx / Education.jsx / Contact.jsx / Footer.jsx
    *.css                    # one stylesheet per component, co-located
  index.css               # design tokens + global resets + shared utility classes
  App.jsx                 # mounts everything, in DOM order
  main.jsx                 # React root
```

**Content is fully separated from layout.** Every word of resume copy lives
in `src/data/resume.js`; every node/edge in the hero graph lives in
`src/data/graph.js`. To update your info, you never need to touch a
component file.

---

## 3. Design system

Defined once at the top of `src/index.css` as CSS custom properties:

```css
--bg: #080b11;              /* page background */
--surface / --surface-2     /* card backgrounds */
--border / --border-soft    /* hairlines */
--text / --text-dim / --text-faint

--accent-core: #ffd37a;     /* "you" — the hero's center node */
--accent-frontend: #4dd8e6; /* cyan  — React/TS/Tailwind */
--accent-backend: #ff9f5a;  /* amber — Node/Express/Django */
--accent-data: #a78cf0;     /* violet — Mongo/Postgres/Redis */
--accent-infra: #5fe0a0;    /* green — AWS/Docker/Prometheus/Grafana */
```

The same four accent colors are used **everywhere** — the hero graph nodes,
the Skills card top-border + dot, the Projects card accent, and the mini 3D
scenes. Nothing on the site invents a new color for a one-off use; every
category always renders the same color, so the Skills section reads as the
"legend" for the colors you already saw in the hero.

Typography: `Space Grotesk` for headings (display font, geometric,
distinctive), `JetBrains Mono` for anything data/label/code-like (nav links,
tags, stats, terminal panels), `Inter` for body copy.

Layout is a `.container` (max-width 1180px) + `.section` (large vertical
padding) pattern, reused by every section — see the shared classes at the
bottom of `index.css` (`.eyebrow`, `.section-title`, `.section-sub`,
`.glass-card`, `.tag`, `.section-head-3d`).

---

## 4. The hero: interactive network graph

`three/Scene.jsx` → `NetworkGraph.jsx` composes three pieces:

- **`GraphNode.jsx`** — each skill is an icosahedron mesh with an outer glow
  sphere. On hover it scales up, its label brightens, and a `GET /api/skills/x`
  line gets logged into the HUD panel (`Hero.jsx` owns that log state). On
  click it fires a burst.
- **`GraphEdges.jsx`** — plain `THREE.BufferGeometry` lines between nodes,
  defined declaratively in `data/graph.js` (mostly spokes from the core, plus
  a few peer-to-peer edges so it reads like a real service map, not a wheel).
- **`GraphPulses.jsx`** — the "alive" part. An `InstancedMesh` pool of 40
  small spheres. Ambient pulses spawn on a timer and travel random edges;
  clicking a node spawns a 3-pulse burst from the core to that node. Using
  one instanced mesh instead of 40 real components keeps this cheap.

The whole graph slowly auto-rotates and tilts a few degrees toward the
cursor (`useFrame` reading `state.pointer`, lerped for smoothness).

`Hero.jsx` also uses `framer-motion`'s `useScroll({ target: sectionRef })` to
scale/fade the canvas and drift the headline as you scroll past the hero —
the 3D piece is tied to scroll position, not just a static background.

---

## 5. The background: particle wave field

A rolling terrain of glowing dots that ripples continuously and reacts to
the cursor — modeled directly on the reference screenshot (a dense dot-grid
ridge, brightest near camera / at the crest, fading to near-black in the
distance, with dust and light-streaks falling through the space above it).

`three/FractalWaveField.jsx` is built from three layered pieces:

- **`WaveGrid`** — a single `THREE.Points` cloud, a 34×90 grid (~3,000
  points) spanning the visible width/depth, brick-staggered and jittered per
  point so it reads as organic dust rather than a perfect lattice. Every
  frame, each point's height is recomputed from three layered sine waves
  (different frequencies/phases per axis) so the surface ripples like fabric,
  not a single flat sine, and a Gaussian bump
  (`2.1 * exp(-dist² / 14)`) is added at the cursor's position projected onto
  the wave plane — so wherever you move your mouse, the terrain bulges
  upward under it in real time. Color is recomputed alongside position each
  frame: a near→far cyan-to-near-black gradient (matching the reference's
  glowing-near / fading-far look) that also brightens toward a hot highlight
  wherever a point is currently near a wave crest, so the ridge visibly
  glows as it moves.
- **`FallingDust`** — ~260 sparse points drifting straight down through the
  space above the terrain, wrapping back to the top when they fall out of
  view, matching the rain-like dust in the upper half of the reference image.
- **`DustStreaks`** — ~46 short `THREE.LineSegments`, each a two-point
  vertical dash with a dim top vertex and a bright bottom vertex (vertex
  colors, not per-vertex alpha, since `LineBasicMaterial` only supports the
  former) — reads as a falling light-trail, and matches the streaked marks
  visible above the terrain in the reference.

All three pieces sit at `z <= 0`, extending straight back and away from the
camera, with the camera positioned above and behind
(`[0, 4.5, 9]`, default look-at `(0,0,0)`) — this keeps the field
unambiguously in front of the camera rather than straddling it, which is an
easy way to accidentally render nothing if the math is off.

Colors are stored and interpolated as raw `{r,g,b}` component objects rather
than `THREE.Color` instances, specifically so the per-frame position/color
update never allocates — important since it runs for ~3,000 points every
frame.

**Important implementation detail (unchanged from before):** the background
canvas has
`pointer-events: none` (so it never blocks clicks on real content), which
means React Three Fiber's built-in `state.pointer` never updates — it only
updates from events fired *on the canvas element*, and a `pointer-events:
none` element receives no mouse events at all. So cursor tracking is done
manually: `UniverseBackground.jsx` adds a `window.addEventListener("pointermove", ...)`
and stores normalized coordinates in a ref, which is threaded down as a prop
into every strand. This is the same pattern used for scroll position
(a `scrollRef` updated by a `window` scroll listener) so the 3D scene can
react to page state without needing React re-renders on every pixel of
mouse movement.

`UniverseBackground.jsx` mounts this alongside a light `DustField` (900
additive points, slow rotation, slight scroll-based Z parallax) for depth,
inside a `position: fixed; z-index: -1` div so it sits behind every section
on the page, all the way down.

---

## 6. Card interactions

Three different hover/click treatments, one per section, all built on a
shared foundation:

### `hooks/useTilt.js`
A tiny imperative hook: on `mousemove`, it computes the cursor's position
inside the element (0–1) and directly sets `element.style.transform` (a
perspective tilt) plus two CSS custom properties, `--mx`/`--my` (the cursor
position as a percentage) and `--spot-opacity`. It's imperative on purpose —
using React state for a value that changes on every `mousemove` would cause
a re-render per pixel; mutating the DOM directly through a ref is instant and
never triggers React's render cycle.

### Skills — flip
Click toggles a `rotateY(180deg)` on `.skill-card-inner`, revealing a back
face with a short note + tool count.

### Experience — tilt only
Simpler treatment: each timeline entry gets `useTilt`'s perspective tilt, no
click interaction — these are meant to feel substantial, not playful.

### Projects — "shatter to reveal"
The most involved one. Each card has three layers:

- `.proj-panel-bg` — the actual background/border, in its own `<span>` so it
  can fade to fully transparent independently of everything else.
- `.proj-spot` — a pure-CSS cursor spotlight (a `radial-gradient` positioned
  at `--mx`/`--my`, opacity driven by `--spot-opacity`), both set by
  `useTilt` on `mousemove`.
- `ParticleField` — on hover, ~34 small rotated rectangles ("shards") spawn
  **along the card's edges** (not the center) and animate outward with
  `framer-motion`, each with randomized size/rotation/duration — so it reads
  as the box's boundary breaking apart, not a generic particle burst.
- Content itself: an `AnimatePresence mode="wait"` swap between a minimal
  "sealed" shell (name + status + a `hover to decrypt →` hint) and the full
  card content (tagline, bullets, stack tags, links, and a click-to-expand
  "deploy log" that types out fake `docker build/push/deploy` lines).

The card's own height animates smoothly between the shell and full-content
states via Framer Motion's `layout` prop, so nothing jumps.

Touch devices are detected via `window.matchMedia("(hover: hover)")` — if
the device can't hover, tapping the card toggles the same open/closed state
instead.

---

## 7. Section-specific 3D decorations

Small, cheap `Canvas` instances (via the shared `MiniCanvas.jsx` wrapper)
next to each section heading, hidden on mobile (`@media (max-width: 860px)`)
to keep things fast on phones:

- **Skills** → `SkillsOrb.jsx`: 10 small icosahedrons in the four category
  colors, orbiting a gold core on individual elliptical paths.
- **Experience** → `ExperienceHelix.jsx`: a `CatmullRomCurve3` tube spiraling
  upward with glowing beads along it and a gold "summit" marker — growth,
  visually.
- **Projects** → `ProjectStack3D.jsx`: three floating, gently bobbing boxes
  in the project accent colors — a nod to Docker containers.

---

## 8. Scroll-driven animation

- **`ScrollProgress.jsx`** — a `useScroll()` + `useSpring()` scaleX bar
  pinned to the top of the viewport.
- **Hero parallax** — as covered in §4, the hero canvas scales/fades and the
  text drifts down, both driven by `useScroll({ target: sectionRef })`.
- **Section reveals** — every card/section uses `whileInView` (Framer
  Motion) with `viewport={{ once: true, margin: "-60px" }}` so things
  animate in once, staggered by index, as they cross into view.
- **The background** reacts to scroll too — `UniverseBackground` tracks
  `window.scrollY / (scrollHeight - innerHeight)` in a ref and uses it to
  dolly the dust field's Z position, so the whole field appears to drift
  as you scroll (see §5 for why it's a manual listener instead of relying
  on any built-in scroll state).

---

## 9. Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build -> dist/
npm run preview   # preview the production build
```

No environment variables, no backend — it's a fully static build. Lint with
`npm run lint` (uses `oxlint`, configured in `.oxlintrc.json`).

## 10. Editing your content

- **Resume content** (name, blurb, skills, experience, projects, education,
  links) → `src/data/resume.js` only. Update the placeholder GitHub/LinkedIn/
  demo links here before deploying.
- **Hero graph nodes/edges** → `src/data/graph.js`. Add a node to the `raw`
  array and it's automatically placed on the sphere and colored by category;
  add an edge as an `[idA, idB]` pair.
- **Colors** → the four `--accent-*` variables in `src/index.css`. Changing
  one updates it everywhere (hero, mini 3D scenes, card accents) since
  nothing hardcodes a hex value outside that file.

## 11. Deploying

Static Vite build — `npm run build` outputs `dist/`, deployable as-is to
Vercel, Netlify, GitHub Pages, or any static host. No server-side code.

## 12. Performance notes

This site runs **multiple WebGL canvases simultaneously** (hero + universe
background + up to 3 mini section scenes). All of them use capped device
pixel ratios (`dpr={[1, 1.5]}` or `[1, 1.75]`), modest particle/geometry
counts, and `prefers-reduced-motion` is respected by freezing the
frame loop (`frameloop="demand"`) on the background. Section mini-scenes are
hidden outright below 860px viewport width. If you add more 3D scenes and
notice jank on lower-end devices, the next lever to pull is pausing canvases
that are scrolled out of view with an `IntersectionObserver`.
