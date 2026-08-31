import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "../theme.jsx";

export default function FloatingParticles() {
  const ref = useRef();
  const { theme } = useTheme();
  const color = theme.colors[0];

  // Halved on mobile: this loop runs 3 trig calls per particle every
  // single frame (it's a continuous drift, so unlike WaveGrid it can't
  // just skip idle frames) — count is the main cost lever here, and a
  // phone screen doesn't need the full desktop density to still read as
  // "ambient dust".
  const COUNT = typeof window !== "undefined" && window.innerWidth < 768 ? 2000 : 4000;

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);

    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 45;
      arr[i * 3 + 1] = Math.random() * 12;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 45;
    }

    return arr;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    const pos = ref.current.geometry.attributes.position.array;

    for (let i = 0; i < COUNT; i++) {
      const id = i * 3;

      pos[id] += Math.sin(t * 0.12 + i) * 0.001;
      pos[id + 1] += Math.sin(t * 0.25 + i) * 0.0015;
      pos[id + 2] += Math.cos(t * 0.18 + i) * 0.001;
    }

    ref.current.geometry.attributes.position.needsUpdate = true;
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
        size={0.025}
        color={color}
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}