import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "../theme.jsx";
import { PROFILE_SILHOUETTE } from "./profileSilhouetteData.js";

// Particles start scattered across a wide volume and converge into the
// actual shape of the profile photo (sampled from its alpha silhouette),
// giving the impression the portrait "assembles" out of light rather than
// a generic blob. Once converged they hang for a beat, then fade out —
// onDone fires so the parent can swap this canvas out once it's fully
// invisible and hand off to the real <img>, which stays clearly visible.
const COUNT = typeof window !== "undefined" && window.innerWidth < 768 ? 900 : 1800;
const CONVERGE_AT = 1.15; // seconds until particles reach their target
const HOLD_UNTIL = 1.55; // seconds to hang before fading
const FADE_UNTIL = 2.25; // seconds until fully invisible

function easeOutExpo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

export default function PhotoParticles({ onDone }) {
  const ref = useRef();
  const doneRef = useRef(false);
  const { theme } = useTheme();
  const color = theme.colors[0];

  const { start, target } = useMemo(() => {
    const start = new Float32Array(COUNT * 3);
    const target = new Float32Array(COUNT * 3);

    const pool = PROFILE_SILHOUETTE;
    const poolLen = pool.length;

    for (let i = 0; i < COUNT; i++) {
      const id = i * 3;

      // scattered origin, wide sphere-ish burst
      const r = 3.5 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      start[id] = r * Math.sin(phi) * Math.cos(theta);
      start[id + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6 + 0.4;
      start[id + 2] = r * Math.cos(phi) * 0.5;

      // target: sample a real point from the photo's silhouette so the
      // cloud converges into the recognizable shape of the actual photo
      const p = pool[(i * 7 + Math.floor(Math.random() * poolLen)) % poolLen];
      const jitter = 0.012;
      target[id] = p[0] + (Math.random() - 0.5) * jitter;
      target[id + 1] = p[1] + (Math.random() - 0.5) * jitter;
      target[id + 2] = (Math.random() - 0.5) * 0.22 * p[2];
    }

    return { start, target };
  }, []);

  const positions = useMemo(() => start.slice(), [start]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pos = ref.current.geometry.attributes.position.array;

    const convergeT = Math.min(t / CONVERGE_AT, 1);
    const eased = easeOutExpo(convergeT);

    for (let i = 0; i < COUNT; i++) {
      const id = i * 3;
      pos[id] = start[id] + (target[id] - start[id]) * eased;
      pos[id + 1] = start[id + 1] + (target[id + 1] - start[id + 1]) * eased;
      pos[id + 2] = start[id + 2] + (target[id + 2] - start[id + 2]) * eased;

      // gentle drift once converged
      if (convergeT >= 1) {
        pos[id] += Math.sin(t * 0.6 + i) * 0.0015;
        pos[id + 1] += Math.cos(t * 0.5 + i) * 0.0012;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;

    let opacity = 1;
    if (t > HOLD_UNTIL) {
      const fadeT = Math.min((t - HOLD_UNTIL) / (FADE_UNTIL - HOLD_UNTIL), 1);
      opacity = 1 - fadeT;
    } else if (t < 0.15) {
      opacity = t / 0.15;
    }
    ref.current.material.opacity = opacity * 0.9;

    if (t > FADE_UNTIL && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={COUNT}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.042}
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}
