import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { deriveDepthPalette } from "./themePalette";

// ---------------------------------------------------------------------------
// JellyfishModel3D — the scanned jellyfish mesh (public/models/jellyfish.glb)
// rendered in the same "made of light-dust" language as TreeModel3D.jsx: a
// dense cloud of tiny additive-blended glow points sampled across the mesh's
// own surface, tinted by the active theme, with a bright crest pulse and a
// soft per-particle twinkle instead of a lit, filled surface. This keeps the
// jellyfish reading as part of the same visual family as the corner trees.
//
// Unlike the tree (one static mesh, growth driven by scroll), the source
// file is 27 separate un-indexed-by-hierarchy meshes — one bell + many thin
// tentacle strands — with no shared root transform, so they're merged by
// hand into one dust cloud instead of via useGLTF's scene graph. Each mesh
// contributes particles weighted by sqrt(surface area) with a floor per
// mesh, so the (much larger) bell doesn't starve the thin tentacles of any
// visible density.
//
// Every dust point still carries a barycentrically-interpolated position,
// a triangle face normal (for the same fixed-light diffuse term as the
// tree), a random seed, and a size — plus one new attribute, aTentacle
// (0 at the bell crown, 1 at a tentacle tip), which drives:
//   - the "materialize" reveal used for the spawn/despawn animation
//     (bell-first, like the tree's bottom-up growth front, but keyed by
//     an externally-driven uSpawn 0..1 instead of scroll)
//   - an idle bell "breathing" pulse and a tentacle undulation wave, so
//     the jellyfish reads as alive while it drifts after the cursor
//   - a velocity "drag" offset (uDrag) so the tentacles trail behind the
//     direction of travel instead of rigidly tagging along
// ---------------------------------------------------------------------------

const MODEL_URL = "/models/jellyfish.glb";
const TOTAL_DUST_PARTICLES = 20000;
const MIN_PARTICLES_PER_MESH = 70;
const EDGE_WIDTH = 0.16; // softness of the materialize front (bigger = softer than the tree's, since this is a quick pop-in, not a slow scroll reveal)
const SPAWN_SEED_JITTER = 0.18; // how much per-particle randomness roughs up the materialize front
const DUST_SIZE_MIN = 2.2;
const DUST_SIZE_RANGE = 2.4;
// Fallback only, used for the very first frame before uPixelScale gets its
// real value below — matches roughly what a full-height desktop window
// produces so there's no visible flash of oversized points on mount.
const DUST_PIXEL_SCALE_FALLBACK = 900.0;

// Hover shimmer — same idea as the tree's leaf/dust hover reaction, tuned
// down a bit since the jellyfish is already a small, constantly-moving
// object instead of a big static backdrop.
const HOVER_RADIUS = 0.16;
const HOVER_PUSH = 0.045;
const HOVER_FLUTTER = 0.018;
const HOVER_SIZE_BOOST = 0.55;

// Color cycling — the jellyfish slowly recolors itself, stepping through
// the active theme's palette every few seconds. COLOR_CYCLE_INTERVAL_MS
// is the time between the *start* of one color change and the next;
// COLOR_TRANSITION_MS (shorter than the interval) is how long each sweep
// itself takes to complete, so the new color holds solid for the
// remainder before the next sweep begins. COLOR_EDGE_WIDTH controls how
// soft/wide the top-to-bottom sweep front is — same technique as the
// spawn materialize wipe (EDGE_WIDTH above), just driven by a different
// progress value and a bit wider so the color change itself reads as a
// slow wash rather than a hard line.
const COLOR_CYCLE_INTERVAL_MS = 7000;
const COLOR_TRANSITION_MS = 4200;
const COLOR_EDGE_WIDTH = 0.85;
const COLOR_SEED_JITTER = 0.22;
// The jellyfish always cycles through these three deep-sea shades —
// blue, a darker near-navy blue, then violet — regardless of which
// accent color the rest of the site is currently themed with. Kept as a
// fixed palette (rather than reading from the theme's `colors` prop)
// since a jellyfish flashing the site's red or green theme accent looked
// out of place; these three read as one coherent, oceanic creature no
// matter what theme is active.
const JELLY_COLOR_CYCLE = ["#2f8dff", "#0b1a4d", "#7e3dff"];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hash3(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function buildDustMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSpawn: { value: 0 },
      uEdgeWidth: { value: EDGE_WIDTH },
      uNear: { value: new THREE.Color() },
      uFar: { value: new THREE.Color() },
      uCrest: { value: new THREE.Color() },
      // "Target" color set the jellyfish is sweeping toward, plus how far
      // that sweep has progressed (0 = still fully uNear/uFar/uCrest, 1 =
      // fully uNearB/uFarB/uCrestB). Driven from JS on a ~3s cycle — see
      // COLOR_CYCLE_INTERVAL_MS below — rather than an instant swap.
      uNearB: { value: new THREE.Color() },
      uFarB: { value: new THREE.Color() },
      uCrestB: { value: new THREE.Color() },
      uColorProgress: { value: 1 },
      uColorEdgeWidth: { value: COLOR_EDGE_WIDTH },
      uTime: { value: 0 },
      uMouseLocal: { value: new THREE.Vector3(9999, 9999, 9999) },
      uHoverRadius: { value: HOVER_RADIUS },
      uDrag: { value: new THREE.Vector2(0, 0) },
      // Points-in-pixels scale factor. This must equal the *actual* current
      // camera's `viewportHeight / (2 * tan(fov/2))` — i.e. the camera
      // distance a "1 world unit == 1 css px at z=0" rig sits at — or point
      // sizes come out wrong for any camera/canvas that isn't the exact one
      // this was eyeballed against. It's recomputed every frame in the
      // component below instead of hardcoded, so the same material works
      // unmodified in both the full-window CursorJellyfish canvas and the
      // tiny NavJellyfishIcon canvas.
      uPixelScale: { value: DUST_PIXEL_SCALE_FALLBACK },
      // Per-instance fudge so a small canvas (like the nav icon) can render
      // proportionally finer-grained dust than the big cursor jellyfish,
      // without touching the pixel-scale math above.
      uSizeScale: { value: 1.0 },
    },
    vertexShader: `
      attribute float aTentacle;
      attribute vec3 aNormal2;
      attribute float aSeed;
      attribute float aSize;
      varying float vGrowFade;
      varying float vFront;
      varying float vDiffuse;
      varying float vSeed;
      varying float vHover;
      varying float vColorT;
      uniform float uSpawn;
      uniform float uEdgeWidth;
      uniform float uColorProgress;
      uniform float uColorEdgeWidth;
      uniform float uTime;
      uniform vec3 uMouseLocal;
      uniform float uHoverRadius;
      uniform vec2 uDrag;
      uniform float uPixelScale;
      uniform float uSizeScale;
      void main() {
        // Materialize front: bell (aTentacle 0) resolves first, tentacle
        // tips (aTentacle 1) last, roughed up by per-particle seed so it
        // doesn't read as a laser-flat wipe.
        float reveal = aTentacle * (1.0 - ${SPAWN_SEED_JITTER.toFixed(3)}) + aSeed * ${SPAWN_SEED_JITTER.toFixed(3)};
        float t = clamp((uSpawn - reveal) / uEdgeWidth, 0.0, 1.0);
        vGrowFade = t;
        vFront = exp(-t * 6.0) * step(0.001, t);
        vSeed = aSeed;

        // Color sweep: as uColorProgress runs 0->1 (over COLOR_TRANSITION_MS,
        // driven from JS), the new target color washes down the body from
        // the bell (aTentacle 0) to the tentacle tips (aTentacle 1) — same
        // "reveal front" technique as the materialize wipe above, just
        // keyed off a different progress value and jittered by aSeed so it
        // doesn't read as a hard, perfectly flat line.
        float colorReveal = aTentacle * (1.0 - ${COLOR_SEED_JITTER.toFixed(3)}) + aSeed * ${COLOR_SEED_JITTER.toFixed(3)};
        vColorT = clamp((uColorProgress - colorReveal) / uColorEdgeWidth, 0.0, 1.0);

        vec3 nrmW = normalize(mat3(modelMatrix) * aNormal2);
        vec3 lightDir = normalize(vec3(0.4, 0.85, 0.55));
        vDiffuse = 0.45 + 0.55 * max(dot(nrmW, lightDir), 0.0);

        vec3 displaced = position;

        // Idle bell "breathing" pulse — a gentle radial squeeze/expand
        // near the crown, fading out down the tentacles.
        float bellFactor = smoothstep(0.4, 0.0, aTentacle);
        float pulse = sin(uTime * 2.2) * 0.5 + 0.5;
        displaced.xz *= 1.0 + bellFactor * (pulse - 0.5) * 0.14;
        displaced.y += bellFactor * sin(uTime * 2.2) * 0.02;

        // Tentacle undulation — a wave that travels DOWN each tentacle,
        // from bell (aTentacle 0) toward tip (aTentacle 1), so it reads as
        // a real swimming ripple rather than every point wiggling in
        // place. The negative aTentacle phase offset below is what
        // creates the travelling-wave look; aSeed still roughs up the
        // phase a little so neighboring tentacle strands don't animate in
        // perfect lockstep. Amplitude grows toward the tips (tent2) and a
        // faster secondary ripple is layered on top for a more organic,
        // whip-like motion instead of one clean sine wave.
        float tent2 = aTentacle * aTentacle;
        float travelPhase = uTime * 2.4 - aTentacle * 7.5;
        float wavePhase = travelPhase + aSeed * 20.0 + position.x * 3.0;
        float waveAmp = tent2 * 0.16;
        float ripple = sin(wavePhase * 2.1 + aSeed * 9.0) * 0.4;
        displaced.x += (sin(wavePhase) + ripple) * waveAmp;
        displaced.z += (cos(wavePhase * 0.82) + ripple * 0.7) * waveAmp;
        displaced.y -= tent2 * 0.02 * (0.5 + 0.5 * sin(wavePhase * 0.5));

        // Drag: tentacles trail behind the direction of travel.
        displaced.xz += uDrag * tent2;

        // Hover shimmer, same mechanic as the tree.
        float dist = distance(position.xy, uMouseLocal.xy);
        float hover = smoothstep(uHoverRadius, 0.0, dist);
        vHover = hover;
        vec2 pushDir = dist > 0.0001 ? normalize(position.xy - uMouseLocal.xy) : vec2(0.0, 1.0);
        float flutter = sin(uTime * 9.0 + aSeed * 31.0) * 0.4 + sin(uTime * 5.3 + aSeed * 11.0) * 0.6;
        displaced.xy += pushDir * hover * ${HOVER_PUSH.toFixed(3)};
        displaced.x += flutter * hover * ${HOVER_FLUTTER.toFixed(3)};
        displaced.y += cos(uTime * 7.0 + aSeed * 17.0) * hover * ${HOVER_FLUTTER.toFixed(3)};

        float twinkle = sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 40.0);

        vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
        float sizeMul = (0.35 + 0.65 * t) * (1.0 + hover * ${HOVER_SIZE_BOOST.toFixed(2)}) * (0.85 + 0.15 * twinkle);
        gl_PointSize = aSize * uSizeScale * (uPixelScale / max(-mvPosition.z, 0.001)) * sizeMul;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uNear;
      uniform vec3 uFar;
      uniform vec3 uCrest;
      uniform vec3 uNearB;
      uniform vec3 uFarB;
      uniform vec3 uCrestB;
      uniform float uTime;
      varying float vGrowFade;
      varying float vFront;
      varying float vDiffuse;
      varying float vSeed;
      varying float vHover;
      varying float vColorT;
      void main() {
        if (vGrowFade <= 0.003) discard;
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        float core = smoothstep(0.5, 0.0, d);
        if (core <= 0.01) discard;

        vec3 baseA = mix(uFar, uNear, vDiffuse);
        vec3 baseB = mix(uFarB, uNearB, vDiffuse);
        vec3 base = mix(baseA, baseB, vColorT);
        vec3 crest = mix(uCrest, uCrestB, vColorT);
        float twinkle = 0.75 + 0.25 * sin(uTime * (2.0 + vSeed * 3.0) + vSeed * 60.0);
        vec3 color = base * twinkle + crest * vFront * 1.3 + crest * vHover * 0.6;

        float alpha = core * vGrowFade * (0.75 + vFront * 0.6 + vHover * 0.35);
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
      }
    `,
  });
}

// Collects every mesh's geometry from the loaded scene, in file order
// (geometry_0 = bell, geometry_1..26 = tentacle strands).
function collectMeshGeometries(scene) {
  const geoms = [];
  scene.traverse((child) => {
    if (child.isMesh && child.geometry) geoms.push(child.geometry);
  });
  return geoms;
}

function triangleArea(pA, pB, pC, ab, ac, cross) {
  ab.subVectors(pB, pA);
  ac.subVectors(pC, pA);
  return cross.crossVectors(ab, ac).length() * 0.5;
}

// Samples `count` dust points across one mesh's triangles, weighted by
// triangle area, appending raw (un-normalized) positions/normals/seeds
// into the shared output arrays starting at `writeOffset`. Returns the
// number of points actually written (== count).
//
// Picks a triangle per-particle via weighted-random selection over a
// cumulative area distribution, rather than pre-allocating an integer
// particle count per triangle up front. The latter (Math.round-per-
// triangle) silently drops entire meshes to zero particles whenever the
// requested count is small relative to the triangle count — e.g. a
// few-thousand-triangle scanned mesh asked for only ~24-100 points (as
// the small nav-icon jellyfish does) rounds every single triangle's
// share down to 0, so `written` never advances past 0. Weighted-random
// selection has no such threshold: it always places exactly `count`
// points regardless of how many triangles are competing for them.
function sampleMeshDust(geometry, count, seedOffset, out, writeOffset) {
  const posAttr = geometry.getAttribute("position");
  const index = geometry.index;
  const triCount = index ? index.count / 3 : posAttr.count / 3;
  const getVertexIndex = (tri, corner) =>
    index ? index.getX(tri * 3 + corner) : tri * 3 + corner;

  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();

  const cumulativeAreas = new Float32Array(triCount);
  let totalArea = 0;
  for (let t = 0; t < triCount; t++) {
    pA.fromBufferAttribute(posAttr, getVertexIndex(t, 0));
    pB.fromBufferAttribute(posAttr, getVertexIndex(t, 1));
    pC.fromBufferAttribute(posAttr, getVertexIndex(t, 2));
    totalArea += triangleArea(pA, pB, pC, ab, ac, cross);
    cumulativeAreas[t] = totalArea;
  }

  // Binary-searches the cumulative area array for the triangle whose
  // running-total area first exceeds `r` (r in [0, totalArea)).
  function pickTriangle(r) {
    let lo = 0;
    let hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cumulativeAreas[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  let idx = writeOffset;
  let written = 0;
  if (totalArea > 0 && triCount > 0) {
    for (let s = 0; s < count; s++) {
      const t = pickTriangle(Math.random() * totalArea);
      const ia = getVertexIndex(t, 0);
      const ib = getVertexIndex(t, 1);
      const ic = getVertexIndex(t, 2);
      pA.fromBufferAttribute(posAttr, ia);
      pB.fromBufferAttribute(posAttr, ib);
      pC.fromBufferAttribute(posAttr, ic);
      ab.subVectors(pB, pA);
      ac.subVectors(pC, pA);
      cross.crossVectors(ab, ac).normalize();

      let u = Math.random();
      let v = Math.random();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      const w = 1 - u - v;
      const x = pA.x * w + pB.x * u + pC.x * v;
      const y = pA.y * w + pB.y * u + pC.y * v;
      const z = pA.z * w + pB.z * u + pC.z * v;

      out.positions[idx * 3] = x;
      out.positions[idx * 3 + 1] = y;
      out.positions[idx * 3 + 2] = z;
      out.normals[idx * 3] = cross.x;
      out.normals[idx * 3 + 1] = cross.y;
      out.normals[idx * 3 + 2] = cross.z;
      const seed = hash3(x * 13.1 + seedOffset * 0.7, y * 7.7 + s * 0.3, z * 5.3 + seedOffset);
      out.seeds[idx] = seed;
      out.sizes[idx] = DUST_SIZE_MIN + seed * DUST_SIZE_RANGE;
      idx++;
      written++;
    }
  }
  return written;
}

// Builds the full merged dust cloud across every mesh in the file, then
// normalizes it into TreeModel3D's own convention: centered on x/z, bell
// crown at y=0, uniformly rescaled so total height is exactly 1 unit
// (root-at-bottom for the tree becomes crown-at-top here, since the group
// this renders into is positioned at the cursor and the tentacles should
// hang below that point, not above it).
function buildJellyDustGeometry(
  meshGeoms,
  totalDustParticles = TOTAL_DUST_PARTICLES,
  minParticlesPerMesh = MIN_PARTICLES_PER_MESH
) {
  // Pass 1: per-mesh surface area, for sqrt-area-weighted particle budgets
  // (linear-area weighting would starve the thin tentacle strands next to
  // the much larger bell).
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();

  const areas = meshGeoms.map((geo) => {
    const posAttr = geo.getAttribute("position");
    const index = geo.index;
    const triCount = index ? index.count / 3 : posAttr.count / 3;
    const getVertexIndex = (tri, corner) =>
      index ? index.getX(tri * 3 + corner) : tri * 3 + corner;
    let area = 0;
    for (let t = 0; t < triCount; t++) {
      pA.fromBufferAttribute(posAttr, getVertexIndex(t, 0));
      pB.fromBufferAttribute(posAttr, getVertexIndex(t, 1));
      pC.fromBufferAttribute(posAttr, getVertexIndex(t, 2));
      area += triangleArea(pA, pB, pC, ab, ac, cross);
    }
    return Math.max(area, 1e-6);
  });

  const weights = areas.map((a) => Math.sqrt(a));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const remaining = Math.max(totalDustParticles - minParticlesPerMesh * meshGeoms.length, 0);
  const counts = weights.map((w) =>
    Math.max(minParticlesPerMesh, Math.round(minParticlesPerMesh + (w / totalWeight) * remaining))
  );
  const total = counts.reduce((s, c) => s + c, 0);

  const out = {
    positions: new Float32Array(total * 3),
    normals: new Float32Array(total * 3),
    seeds: new Float32Array(total),
    sizes: new Float32Array(total),
  };

  let offset = 0;
  for (let m = 0; m < meshGeoms.length; m++) {
    const written = sampleMeshDust(meshGeoms[m], counts[m], m * 97.13, out, offset);
    offset += written;
  }
  const count = offset; // actual written count (== total unless a mesh had zero triangles)

  // Pass 2: global bbox across every sampled point, for normalization.
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = out.positions[i * 3];
    const y = out.positions[i * 3 + 1];
    const z = out.positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const height = Math.max(maxY - minY, 1e-6);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const positions = new Float32Array(count * 3);
  const tentacle = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = out.positions[i * 3];
    const y = out.positions[i * 3 + 1];
    const z = out.positions[i * 3 + 2];
    positions[i * 3] = (x - centerX) / height;
    positions[i * 3 + 1] = (y - maxY) / height; // 0 at crown, negative going down
    positions[i * 3 + 2] = (z - centerZ) / height;
    tentacle[i] = clamp(-(y - maxY) / height, 0, 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aTentacle", new THREE.BufferAttribute(tentacle, 1));
  geo.setAttribute("aNormal2", new THREE.BufferAttribute(out.normals.subarray(0, count * 3), 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(out.seeds.subarray(0, count), 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(out.sizes.subarray(0, count), 1));
  return geo;
}

function applyPalette(nearColor, farColor, crestColor, hex) {
  const p = deriveDepthPalette(hex);
  nearColor.setRGB(p.near.r, p.near.g, p.near.b);
  farColor.setRGB(p.far.r, p.far.g, p.far.b);
  crestColor.setRGB(p.crest.r, p.crest.g, p.crest.b);
}

export default function JellyfishModel3D({
  // Kept for backwards compatibility with existing callers (CursorJellyfish,
  // NavJellyfishIcon still pass the active theme's colors), but no longer
  // used here — the jellyfish's own color cycle is the fixed
  // JELLY_COLOR_CYCLE above, independent of the site's theme.
  // eslint-disable-next-line no-unused-vars
  colors,
  reduceMotion,
  spawnRef,
  dragRef,
  // Lets a small instance (e.g. the nav icon) ask for a much lighter dust
  // cloud than the full cursor jellyfish's 20,000 points.
  particleBudget = TOTAL_DUST_PARTICLES,
  minParticlesPerMesh = MIN_PARTICLES_PER_MESH,
  // Extra multiplier on top of the auto-computed pixel scale, for tuning
  // how coarse/fine the dust reads at a given instance's physical size.
  dustSizeScale = 1,
}) {
  const { scene } = useGLTF(MODEL_URL);
  const groupRef = useRef(null);
  const dustPointsRef = useRef(null);

  const mouseWorld = useRef({ x: 1e6, y: 1e6 });
  const tmpMatrix = useRef(new THREE.Matrix4());
  const tmpVec = useRef(new THREE.Vector3());

  useEffect(() => {
    function onPointerMove(e) {
      mouseWorld.current.x = e.clientX - window.innerWidth / 2;
      mouseWorld.current.y = -(e.clientY - window.innerHeight / 2);
    }
    function onPointerLeave() {
      mouseWorld.current.x = 1e6;
      mouseWorld.current.y = 1e6;
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  const meshGeoms = useMemo(() => collectMeshGeometries(scene), [scene]);
  const dustGeometry = useMemo(
    () =>
      meshGeoms.length
        ? buildJellyDustGeometry(meshGeoms, particleBudget, minParticlesPerMesh)
        : null,
    [meshGeoms, particleBudget, minParticlesPerMesh]
  );
  const dustMaterial = useMemo(() => buildDustMaterial(), []);

  useEffect(() => {
    dustMaterial.uniforms.uSizeScale.value = dustSizeScale;
  }, [dustMaterial, dustSizeScale]);

  useEffect(() => {
    return () => {
      dustMaterial.dispose();
      if (dustGeometry) dustGeometry.dispose();
    };
  }, [dustMaterial, dustGeometry]);

  // Color-cycle bookkeeping: which theme-palette entry the sweep last
  // finished landing on, and when the current 3s cycle began. Reset
  // whenever the `colors` array itself changes (e.g. the person switches
  // the site's color theme), so the cycle always starts fresh from that
  // theme's first color instead of blending from a stale one.
  const colorIndexRef = useRef(0);
  const colorChangeTimeRef = useRef(Date.now());

  useEffect(() => {
    colorIndexRef.current = 0;
    colorChangeTimeRef.current = Date.now();
    applyPalette(
      dustMaterial.uniforms.uNear.value,
      dustMaterial.uniforms.uFar.value,
      dustMaterial.uniforms.uCrest.value,
      JELLY_COLOR_CYCLE[0]
    );
    applyPalette(
      dustMaterial.uniforms.uNearB.value,
      dustMaterial.uniforms.uFarB.value,
      dustMaterial.uniforms.uCrestB.value,
      JELLY_COLOR_CYCLE[0]
    );
    dustMaterial.uniforms.uColorProgress.value = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dustMaterial]);

  useFrame(({ clock, camera, size }) => {
    const t = clock.elapsedTime;
    if (!reduceMotion) dustMaterial.uniforms.uTime.value = t;

    dustMaterial.uniforms.uSpawn.value = spawnRef?.current ?? 1;
    if (dragRef?.current) {
      dustMaterial.uniforms.uDrag.value.set(dragRef.current.x, dragRef.current.y);
    }

    // Slowly step the jellyfish through the active theme's palette. Every
    // COLOR_CYCLE_INTERVAL_MS the target color advances to the next entry
    // — the *previous* target becomes the new starting point (so there's
    // never a jump back to some earlier color), and uColorProgress sweeps
    // 0->1 over COLOR_TRANSITION_MS. The vertex shader turns that single
    // progress value into a top-to-bottom wash using each particle's
    // aTentacle value, so the new color visibly pours down the bell and
    // out along the tentacles rather than snapping everywhere at once.
    if (!reduceMotion && JELLY_COLOR_CYCLE.length > 1) {
      const now = Date.now();
      const elapsed = now - colorChangeTimeRef.current;
      if (elapsed >= COLOR_CYCLE_INTERVAL_MS) {
        dustMaterial.uniforms.uNear.value.copy(dustMaterial.uniforms.uNearB.value);
        dustMaterial.uniforms.uFar.value.copy(dustMaterial.uniforms.uFarB.value);
        dustMaterial.uniforms.uCrest.value.copy(dustMaterial.uniforms.uCrestB.value);
        colorIndexRef.current = (colorIndexRef.current + 1) % JELLY_COLOR_CYCLE.length;
        applyPalette(
          dustMaterial.uniforms.uNearB.value,
          dustMaterial.uniforms.uFarB.value,
          dustMaterial.uniforms.uCrestB.value,
          JELLY_COLOR_CYCLE[colorIndexRef.current]
        );
        colorChangeTimeRef.current = now;
        dustMaterial.uniforms.uColorProgress.value = 0;
      } else {
        dustMaterial.uniforms.uColorProgress.value = clamp(elapsed / COLOR_TRANSITION_MS, 0, 1);
      }
    }

    // Derive the real "world units at z=0 -> screen pixels" scale from
    // this frame's actual camera + canvas, so point sizes come out right
    // whether this is rendered in a full-window canvas or a 20px nav icon.
    if (camera.isPerspectiveCamera) {
      const fovRad = (camera.fov * Math.PI) / 180;
      dustMaterial.uniforms.uPixelScale.value = size.height / (2 * Math.tan(fovRad / 2));
    }

    if (dustPointsRef.current && !reduceMotion) {
      tmpMatrix.current.copy(dustPointsRef.current.matrixWorld).invert();
      tmpVec.current.set(mouseWorld.current.x, mouseWorld.current.y, 0).applyMatrix4(tmpMatrix.current);
      dustMaterial.uniforms.uMouseLocal.value.copy(tmpVec.current);
    }
  });

  if (!dustGeometry) return null;

  return (
    <group ref={groupRef}>
      <points ref={dustPointsRef} geometry={dustGeometry} material={dustMaterial} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
