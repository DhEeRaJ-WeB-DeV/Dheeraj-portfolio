import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "../theme.jsx";

// Deterministic pseudo-random — stable across renders (no re-shuffling
// the mesh every time this re-renders) without needing to seed a real
// RNG library.
function seeded(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
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
// highlight rather than part of the color identity.
const GLINT = new THREE.Color("#f2fff5");

function quadraticPoint(p0, p1, p2, t, out) {
  const it = 1 - t;
  out.x = it * it * p0.x + 2 * it * t * p1.x + t * t * p2.x;
  out.y = it * it * p0.y + 2 * it * t * p1.y + t * t * p2.y;
  out.z = it * it * p0.z + 2 * it * t * p1.z + t * t * p2.z;
  return out;
}

// A tangled, irregular mesh of connections — dense dust sampled along
// each thread (instead of a solid line) so it reads as the same
// particle-built material as the helix, plus brighter standalone
// "dew-drop" dots at the junctions/anchor points for the glow accents.
//
// Two kinds of thread:
//  - "card" threads: irregular bundles converging on each project card,
//    departing from a scattered, non-uniform point rather than a tidy
//    fan.
//  - "scatter" threads: connect loose points floating between the core
//    and the cards to their own nearest neighbours, filling the gaps
//    between bundles so it reads as an actual tangled web instead of
//    clean spokes.
export default function WebStrings({
  cardCount = 3,
  cardAngleStep = 120,
  cardRadius = 2.6,
  cardYOffsets = [1.3, 0, -1.3],
  coreRadius = 1.3,
  ambientCount = 130,
  strandsPerCard = 26,
  pointsPerEdge = 20,
  threadParticleSize = 0.038,
  dotParticleSize = 0.095,
  pulseCount = 48,
  pulseParticleSize = 0.17,
  pulseSpeedRange = [0.16, 0.42],
  rotationRef = null,
}) {
  const groupRef = useRef();
  const pulseGeoRef = useRef();
  const pulseTmp = useMemo(() => new THREE.Vector3(), []);
  const texture = useMemo(() => createGlowTexture(), []);
  const { theme, themeId } = useTheme();
  // Same palette mapping as DnaHelixModel — brightest accent for the
  // primary strand color, secondary accent for the mix-in, so the web
  // reads as part of the same particle system and re-tints together.
  const lime = useMemo(() => new THREE.Color(theme.colors[4]), [theme]);
  const mint = useMemo(() => new THREE.Color(theme.colors[0]), [theme]);

  const scatterPoints = useMemo(() => {
    const maxY = Math.max(1, ...cardYOffsets.map((y) => Math.abs(y))) * 2 + 1.4;
    const pts = [];
    for (let i = 0; i < ambientCount; i++) {
      const angle = seeded(i * 3.71 + 1.3) * Math.PI * 2;
      const rFrac = 0.2 + seeded(i * 5.93 + 2.9) * 0.7;
      const r = coreRadius + rFrac * (cardRadius - coreRadius);
      const y = (seeded(i * 8.11 + 6.4) - 0.5) * maxY;
      pts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
    }
    return pts;
  }, [ambientCount, cardRadius, coreRadius, cardYOffsets]);

  const edges = useMemo(() => {
    const list = [];

    for (let c = 0; c < cardCount; c++) {
      const baseAngle = c * cardAngleStep;
      const cardY = cardYOffsets[c] ?? 0;
      // Matches the DOM card's actual position: the CSS ring applies
      // `rotateY(angle) translateZ(radius)` to each slot, which puts a
      // point that starts at (0,0,radius) through the rotateY matrix as
      // (radius*sin, radius*cos) — X and Z swapped from the naive
      // (cos, sin) parametrization used below elsewhere. Getting this
      // wrong is what made the threads converge ~90° off from where the
      // card actually rendered.
      const cardPos = new THREE.Vector3(
        Math.sin(THREE.MathUtils.degToRad(baseAngle)) * cardRadius,
        cardY,
        Math.cos(THREE.MathUtils.degToRad(baseAngle)) * cardRadius
      );

      for (let j = 0; j < strandsPerCard; j++) {
        const s1 = seeded(c * 97.1 + j * 13.7 + 1);
        const s2 = seeded(c * 51.3 + j * 7.2 + 4.1);
        const s3 = seeded(c * 29.8 + j * 3.1 + 8.6);
        const startAngle = baseAngle + (s1 * 2 - 1) * 42;
        const startRadius = coreRadius * (0.55 + s2 * 0.6);
        const startY = cardY + (s3 - 0.5) * 2.6;
        const start = new THREE.Vector3(
          Math.sin(THREE.MathUtils.degToRad(startAngle)) * startRadius,
          startY,
          Math.cos(THREE.MathUtils.degToRad(startAngle)) * startRadius
        );
        const mid = start.clone().lerp(cardPos, 0.5);
        mid.y -= 0.15 + s1 * 0.4;

        list.push({ p0: start, p1: mid, p2: cardPos, isPrimary: j === 0 });
      }
    }

    scatterPoints.forEach((a, i) => {
      const nearest = scatterPoints
        .map((p, k) => ({ k, d: k === i ? Infinity : a.distanceTo(p) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, 3);

      nearest.forEach(({ k }) => {
        const b = scatterPoints[k];
        const mid = a.clone().lerp(b, 0.5);
        mid.y -= 0.04 + seeded(i * 4.4 + k * 2.2) * 0.18;
        list.push({ p0: a, p1: mid, p2: b, isPrimary: false });
      });
    });

    return list;
  }, [cardCount, cardAngleStep, cardRadius, cardYOffsets, coreRadius, strandsPerCard, scatterPoints]);

  // A pool of traveling lights, each riding along one edge of the web —
  // like a signal hopping through a neural net rather than the whole
  // mesh just sitting there glowing statically. Positions are mutated
  // in place every frame (see useFrame below); only the pool's initial
  // assignment (which edge, starting phase, speed) is memoized.
  const pulses = useMemo(() => {
    if (edges.length === 0) return [];
    return Array.from({ length: pulseCount }, (_, i) => ({
      edgeIndex: Math.floor(seeded(i * 13.13 + 2.7) * edges.length),
      t: seeded(i * 7.31 + 4.1),
      speed: pulseSpeedRange[0] + seeded(i * 9.97 + 1.2) * (pulseSpeedRange[1] - pulseSpeedRange[0]),
    }));
  }, [edges, pulseCount, pulseSpeedRange]);

  const pulsePositions = useMemo(() => new Float32Array(pulseCount * 3), [pulseCount]);
  const pulseColors = useMemo(() => {
    // Pushed past 1.0 on purpose — additive blending + toneMapped=false
    // means these aren't clamped to normal display range, so an
    // overbright value here feeds more energy into the Bloom pass
    // (see ProjectsDnaScene.jsx) instead of just being a bigger white dot.
    const boost = 1.7;
    const arr = new Float32Array(pulseCount * 3);
    for (let i = 0; i < pulseCount; i++) {
      arr[i * 3] = GLINT.r * boost;
      arr[i * 3 + 1] = GLINT.g * boost;
      arr[i * 3 + 2] = GLINT.b * boost;
    }
    return arr;
  }, [pulseCount]);
  const threadDust = useMemo(() => {
    const total = edges.length * pointsPerEdge;
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const p = new THREE.Vector3();
    let idx = 0;
    edges.forEach((e, ei) => {
      for (let s = 0; s < pointsPerEdge; s++) {
        const t = s / (pointsPerEdge - 1);
        quadraticPoint(e.p0, e.p1, e.p2, t, p);
        positions[idx * 3] = p.x;
        positions[idx * 3 + 1] = p.y;
        positions[idx * 3 + 2] = p.z;

        const roll = seeded(ei * 7.7 + s * 1.9 + 2.3);
        const base = roll > 0.93 ? GLINT : roll > 0.6 ? mint : lime;
        const brightness = (e.isPrimary ? 0.85 : 0.5) + roll * 0.5;
        colors[idx * 3] = base.r * brightness;
        colors[idx * 3 + 1] = base.g * brightness;
        colors[idx * 3 + 2] = base.b * brightness;
        idx++;
      }
    });
    return { positions, colors, count: total };
  }, [edges, pointsPerEdge, lime, mint]);

  // Brighter standalone dots at every junction/anchor point — the
  // "glowing dots" that give the web the same dew-drop-on-silk accents
  // the helix gets from its glint particles.
  const nodeDots = useMemo(() => {
    const nodes = [...scatterPoints];
    for (let c = 0; c < cardCount; c++) {
      const baseAngle = c * cardAngleStep;
      const cardY = cardYOffsets[c] ?? 0;
      nodes.push(
        new THREE.Vector3(
          Math.sin(THREE.MathUtils.degToRad(baseAngle)) * cardRadius,
          cardY,
          Math.cos(THREE.MathUtils.degToRad(baseAngle)) * cardRadius
        )
      );
    }
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);
    nodes.forEach((n, i) => {
      positions[i * 3] = n.x;
      positions[i * 3 + 1] = n.y;
      positions[i * 3 + 2] = n.z;
      const base = seeded(i * 6.1 + 3.4) > 0.75 ? GLINT : mint;
      const brightness = 0.75 + seeded(i * 2.2 + 1.1) * 0.45;
      colors[i * 3] = base.r * brightness;
      colors[i * 3 + 1] = base.g * brightness;
      colors[i * 3 + 2] = base.b * brightness;
    });
    return { positions, colors, count: nodes.length };
  }, [scatterPoints, cardCount, cardAngleStep, cardRadius, cardYOffsets, mint]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (g && rotationRef) {
      g.rotation.y = THREE.MathUtils.degToRad(rotationRef.current);
    }

    if (!pulses.length) return;
    for (let i = 0; i < pulses.length; i++) {
      const p = pulses[i];
      p.t += delta * p.speed;
      if (p.t > 1) {
        p.t -= 1;
        // Hop to a new random edge so the signal keeps traveling to a
        // different part of the web instead of looping the same thread.
        p.edgeIndex = Math.floor(seeded((state.clock.elapsedTime + i * 3.1) * 17.37) * edges.length);
      }
      const e = edges[p.edgeIndex];
      quadraticPoint(e.p0, e.p1, e.p2, p.t, pulseTmp);
      pulsePositions[i * 3] = pulseTmp.x;
      pulsePositions[i * 3 + 1] = pulseTmp.y;
      pulsePositions[i * 3 + 2] = pulseTmp.z;
    }
    const geo = pulseGeoRef.current;
    if (geo) geo.attributes.position.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry key={`thread-${themeId}`}>
          <bufferAttribute
            attach="attributes-position"
            count={threadDust.count}
            array={threadDust.positions}
            itemSize={3}
          />
          <bufferAttribute attach="attributes-color" count={threadDust.count} array={threadDust.colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          map={texture}
          size={threadParticleSize}
          vertexColors
          transparent
          opacity={1}
          alphaTest={0.02}
          sizeAttenuation
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points>
        <bufferGeometry key={`nodes-${themeId}`}>
          <bufferAttribute attach="attributes-position" count={nodeDots.count} array={nodeDots.positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={nodeDots.count} array={nodeDots.colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          map={texture}
          size={dotParticleSize}
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

      {/* Traveling signals — brightest, biggest particles, positions
          rewritten every frame in useFrame above. */}
      <points>
        <bufferGeometry ref={pulseGeoRef}>
          <bufferAttribute attach="attributes-position" count={pulseCount} array={pulsePositions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={pulseCount} array={pulseColors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          map={texture}
          size={pulseParticleSize}
          vertexColors
          transparent
          opacity={1}
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
