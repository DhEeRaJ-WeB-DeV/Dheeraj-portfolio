import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import DnaHelixModel from "../three/DnaHelixModel";
import WebStrings from "../three/WebStrings";
import { useTheme } from "../theme.jsx";
import "./ProjectsDnaScene.css";

export default function ProjectsDnaScene({ rotationRef, cardCount, angleStep, cardYOffsets, radius }) {

  const SCALE = 1 / 90;
  const cardRadius = radius * SCALE;
  const worldYOffsets = cardYOffsets.map((y) => -y * SCALE);
  const { theme } = useTheme();

  return (
    <div className="proj-dna-scene" aria-hidden="true">
      <Canvas
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.4, 9.5], fov: 32 }}
        dpr={[1, 1.25]}
        // react-three-fiber sets pointerEvents:'auto' on its container
        // div by default (so meshes can be clicked) — that was silently
        // sitting on top of the card ring and eating every click before
        // it reached the cards underneath. This scene has nothing
        // interactive, so it should never intercept pointer events.
        performance={{ min: 0.6, max: 1, debounce: 250 }}
        style={{ pointerEvents: "none" }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[3, 4, 5]} intensity={40} color="#eaffff" />
        <pointLight position={[-4, -3, 4]} intensity={22} color={theme.colors[0]} />
        <directionalLight position={[0, 6, 3]} intensity={0.55} color="#ffffff" />
        <DnaHelixModel projectCount={cardCount} radius={1.15} rotationRef={rotationRef} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={1.3} luminanceThreshold={0.14} luminanceSmoothing={0.85} mipmapBlur radius={0.68} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
