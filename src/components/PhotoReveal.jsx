import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { motion } from "framer-motion";
import PhotoParticles from "../three/PhotoParticles.jsx";
import { useTheme } from "../theme.jsx";

// Orchestrates the hero portrait's entrance: a burst of theme-colored
// particles converges into a silhouette, the photo pops in right as
// they finish converging, and the particle canvas fades itself out and
// unmounts once fully invisible (onDone from PhotoParticles).
export default function PhotoReveal({ src, alt }) {
  const [particlesDone, setParticlesDone] = useState(false);
  const { theme } = useTheme();

  return (
    <div className="hero-photo">
      <div className="hero-photo-shadow" />
      <div className="hero-photo-glow" />

      {!particlesDone && (
        <Canvas
          className="hero-photo-canvas"
          camera={{ position: [0, 0, 6], fov: 40 }}
          dpr={[1, 1.25]}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <Suspense fallback={null}>
            <PhotoParticles key={theme.id} onDone={() => setParticlesDone(true)} />
          </Suspense>
        </Canvas>
      )}

      <motion.img
        src={src}
        alt={alt}
        className="hero-photo-img"
        initial={{ opacity: 0, scale: 0.82, y: 24, filter: "blur(6px)" }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, delay: 0.95, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}
