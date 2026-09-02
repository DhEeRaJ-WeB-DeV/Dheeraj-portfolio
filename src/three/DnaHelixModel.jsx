import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "../theme.jsx";

// A helix built from glowing particle "dust" instead of solid tube
// geometry — additive-blended points read as a bright, glossy sparkle
// under bloom (see ProjectsDnaScene/AboutDnaScene, which add the
// <Bloom> pass), closer to how the reference photo's strand catches
// light than a flat-shaded mesh does.
class HelixCurve extends THREE.Curve {
  constructor(radius, height, turns, phase) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
    this.phase = phase;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const angle = t * Math.PI * 2 * this.turns + this.phase;
    const x = Math.cos(angle) * this.radius;
    const z = Math.sin(angle) * this.radius;
    const y = (t - 0.5) * this.height;
    return target.set(x, y, z);
  }
}

function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.32)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Near-white "glint" kept constant across every theme — reads as a glossy
// highlight/reflection rather than part of the color identity.
const GLINT = new THREE.Color("#f2fff5");

// Derives the strand's two-tone palette (bright core accent + secondary
// accent) and the rungs' "unlit" base color from the active theme, instead
// of a hardcoded lime/mint/deep-green set.
function deriveHelixPalette(theme) {
  const lime = new THREE.Color(theme.colors[4]); // brightest/core accent
  const mint = new THREE.Color(theme.colors[0]); // secondary/frontend accent
  const deep = mint.clone().multiplyScalar(0.14); // dark "unlit" rung base
  return { lime, mint, deep };
}

function buildStrand(radius, height, turns, phase, count, fuzz, palette) {
  const curve = new HelixCurve(radius, height, turns, phase);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const p = new THREE.Vector3();
  const { lime, mint } = palette;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    curve.getPoint(t, p);
    positions[i * 3] = p.x + (Math.random() - 0.5) * fuzz;
    positions[i * 3 + 1] = p.y + (Math.random() - 0.5) * fuzz;
    positions[i * 3 + 2] = p.z + (Math.random() - 0.5) * fuzz;

    const roll = Math.random();
    const base = roll > 0.94 ? GLINT : roll > 0.7 ? mint : lime;
    const brightness = 3.0 + Math.random() * 0.8;
    colors[i * 3] = base.r * brightness;
    colors[i * 3 + 1] = base.g * brightness;
    colors[i * 3 + 2] = base.b * brightness;
  }
  return { positions, colors };
}

function buildRungs(radius, height, turns, rungCount, pointsPerRung, palette) {
  const curveA = new HelixCurve(radius, height, turns, 0);
  const curveB = new HelixCurve(radius, height, turns, Math.PI);
  const total = rungCount * pointsPerRung;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const c = new THREE.Color();
  const { deep } = palette;
  let idx = 0;
  for (let r = 0; r < rungCount; r++) {
    const t = r / (rungCount - 1);
    curveA.getPoint(t, pA);
    curveB.getPoint(t, pB);
    for (let p = 0; p < pointsPerRung; p++) {
      const f = p / (pointsPerRung - 1);
      positions[idx * 3] = THREE.MathUtils.lerp(pA.x, pB.x, f);
      positions[idx * 3 + 1] = THREE.MathUtils.lerp(pA.y, pB.y, f);
      positions[idx * 3 + 2] = THREE.MathUtils.lerp(pA.z, pB.z, f);

      c.copy(deep).lerp(GLINT, 0.35 + Math.random() * 0.5);
      colors[idx * 3] = c.r;
      colors[idx * 3 + 1] = c.g;
      colors[idx * 3 + 2] = c.b;
      idx++;
    }
  }
  return { positions, colors };
}

// Scaling constants the helix grows by, per project/panel it represents.
// Tuned so that the original fixed-3-project look (radius 1.15, height 5.4,
// turns 3.6, 1500 strand particles, 40 rungs) falls out exactly at
// projectCount = 3 — i.e. existing visuals are unchanged for the current
// resume.js, and the helix scales up automatically the moment a project is
// added to (or removed from) that file.
const HEIGHT_PER_PROJECT = 1.8; // 1.8 * 3 = 5.4
const TURNS_PER_PROJECT = 1.2; // 1.2 * 3 = 3.6
const STRAND_PARTICLES_PER_PROJECT = 500; // 500 * 3 = 1500
const RUNGS_PER_PROJECT = 40 / 3; // (40/3) * 3 = 40
const MIN_PROJECTS = 1;

export default function DnaHelixModel({
  // Number of projects/panels this helix should visually represent — the
  // single source of truth for how big the strand grows. Pass
  // `projects.length` from resume.js (via ProjectsDnaScene) so the model
  // automatically lengthens, adds twists, and thickens as more projects are
  // added, with no need to hand-tune radius/height/turns per project count.
  projectCount = 3,
  // Any of the sizing props below can still be passed explicitly to
  // override the automatic, projectCount-driven scaling.
  radius = 1.15,
  height,
  turns,
  strandParticles,
  rungCount,
  pointsPerRung = 9,
  particleSize = 0.05,
  rungParticleSize = 0.032,
  fuzz = 0.02,
  rotationRef = null,
  autoRotateSpeed = 0,
}) {
  const n = Math.max(MIN_PROJECTS, projectCount);
  const resolvedHeight = height ?? n * HEIGHT_PER_PROJECT;
  const resolvedTurns = turns ?? n * TURNS_PER_PROJECT;
  const resolvedStrandParticles = strandParticles ?? Math.round(n * STRAND_PARTICLES_PER_PROJECT);
  const resolvedRungCount = rungCount ?? Math.max(4, Math.round(n * RUNGS_PER_PROJECT));

  const groupRef = useRef();
  const texture = useMemo(() => createGlowTexture(), []);
  const { theme } = useTheme();
  const palette = useMemo(() => deriveHelixPalette(theme), [theme]);

  const strandA = useMemo(
    () => buildStrand(radius, resolvedHeight, resolvedTurns, 0, resolvedStrandParticles, fuzz, palette),
    [radius, resolvedHeight, resolvedTurns, resolvedStrandParticles, fuzz, palette]
  );
  const strandB = useMemo(
    () => buildStrand(radius, resolvedHeight, resolvedTurns, Math.PI, resolvedStrandParticles, fuzz, palette),
    [radius, resolvedHeight, resolvedTurns, resolvedStrandParticles, fuzz, palette]
  );
  const rungs = useMemo(
    () => buildRungs(radius, resolvedHeight, resolvedTurns, resolvedRungCount, pointsPerRung, palette),
    [radius, resolvedHeight, resolvedTurns, resolvedRungCount, pointsPerRung, palette]
  );

  const strandAAttrs = useRef();
  const strandBAttrs = useRef();
  const rungAttrs = useRef();

  // These points regenerate their whole Float32Array (position + color
  // together) on theme change, so both attributes need a fresh upload —
  // unlike the split geometry/color split used elsewhere, this model is
  // small enough (a few hundred to ~1500 particles) that a full rebuild on
  // theme switch is cheap and simpler than splitting the two concerns.
  useEffect(() => {
    if (strandAAttrs.current) {
      strandAAttrs.current.position.needsUpdate = true;
      strandAAttrs.current.color.needsUpdate = true;
    }
    if (strandBAttrs.current) {
      strandBAttrs.current.position.needsUpdate = true;
      strandBAttrs.current.color.needsUpdate = true;
    }
    if (rungAttrs.current) {
      rungAttrs.current.position.needsUpdate = true;
      rungAttrs.current.color.needsUpdate = true;
    }
  }, [strandA, strandB, rungs]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    if (rotationRef) {
      g.rotation.y = THREE.MathUtils.degToRad(rotationRef.current);
    } else if (autoRotateSpeed) {
      g.rotation.y += autoRotateSpeed;
    }
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            ref={(el) => {
              if (!strandAAttrs.current) strandAAttrs.current = {};
              strandAAttrs.current.position = el;
            }}
            attach="attributes-position"
            count={resolvedStrandParticles}
            array={strandA.positions}
            itemSize={3}
          />
          <bufferAttribute
            ref={(el) => {
              if (!strandAAttrs.current) strandAAttrs.current = {};
              strandAAttrs.current.color = el;
            }}
            attach="attributes-color"
            count={resolvedStrandParticles}
            array={strandA.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          map={texture}
          size={particleSize}
          vertexColors
          transparent
          opacity={0.95}
          alphaTest={0.02}
          sizeAttenuation
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points>
        <bufferGeometry>
          <bufferAttribute
            ref={(el) => {
              if (!strandBAttrs.current) strandBAttrs.current = {};
              strandBAttrs.current.position = el;
            }}
            attach="attributes-position"
            count={resolvedStrandParticles}
            array={strandB.positions}
            itemSize={3}
          />
          <bufferAttribute
            ref={(el) => {
              if (!strandBAttrs.current) strandBAttrs.current = {};
              strandBAttrs.current.color = el;
            }}
            attach="attributes-color"
            count={resolvedStrandParticles}
            array={strandB.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          map={texture}
          size={particleSize}
          vertexColors
          transparent
          opacity={0.95}
          alphaTest={0.02}
          sizeAttenuation
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points>
        <bufferGeometry>
          <bufferAttribute
            ref={(el) => {
              if (!rungAttrs.current) rungAttrs.current = {};
              rungAttrs.current.position = el;
            }}
            attach="attributes-position"
            count={resolvedRungCount * pointsPerRung}
            array={rungs.positions}
            itemSize={3}
          />
          <bufferAttribute
            ref={(el) => {
              if (!rungAttrs.current) rungAttrs.current = {};
              rungAttrs.current.color = el;
            }}
            attach="attributes-color"
            count={resolvedRungCount * pointsPerRung}
            array={rungs.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          map={texture}
          size={rungParticleSize}
          vertexColors
          transparent
          opacity={0.85}
          alphaTest={0.02}
          sizeAttenuation
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
