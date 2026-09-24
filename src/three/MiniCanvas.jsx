import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { useTheme } from "../theme.jsx";

export default function MiniCanvas({ children, camera = { position: [0, 0.3, 6], fov: 42 }, style }) {
  const { theme } = useTheme();
  return (
    <Canvas
      camera={camera}
      dpr={[1, 1.25]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none", ...style }}
    >
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 3, 5]} intensity={35} color="#ffffff" />
      <pointLight position={[-4, -2, -3]} intensity={20} color={theme.colors[0]} />
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}
