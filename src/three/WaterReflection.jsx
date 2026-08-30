import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "../theme.jsx";

export default function WaterReflection() {
  const mesh = useRef();
  const { theme } = useTheme();
  // A deep, low-saturation version of the theme tint — reads as a dark
  // reflective surface in every theme instead of a fixed forest green.
  const color = new THREE.Color(theme.colors[0]).multiplyScalar(0.16).getStyle();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    mesh.current.material.opacity =
      0.06 +
      Math.sin(t * 0.7) * 0.008;

    mesh.current.position.y =
      -1.35 +
      Math.sin(t * 0.35) * 0.03;
  });

  return (
    <mesh
      ref={mesh}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -1.35, 0]}
    >
      <planeGeometry args={[120, 120]} />

      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.06}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}