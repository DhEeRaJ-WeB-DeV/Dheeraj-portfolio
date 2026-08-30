import { Canvas } from "@react-three/fiber";
import { useRef, useEffect, useState } from "react";
import "./UniverseBackground.css";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import FloatingParticles from "../three/FloatingParticles";
import CameraRig from "../three/CameraRig";
import TunnelRings, { TunnelLighting } from "../three/TunnelRings";
import { useTheme } from "../theme.jsx";


// Note: an earlier DustField points-cloud and an AmbientWaveOverlay (plus
// the LightRays/WaterReflection/DnaHelix imports they pulled in) used to
// live here but were fully commented out of the render tree — dead code
// that added unused modules to the dependency graph for nothing. Removed;
// see git history if this ambient layer needs to come back.

export default function UniverseBackground() {
  const scrollRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);
  // Tab is backgrounded: no point paying for a continuous WebGL + bloom
  // render loop the user can't see. `frameloop` reacts to this and drops
  // to "demand" (only re-renders when something explicitly invalidates
  // it) instead of ticking every frame in a hidden tab.
  const [tabHidden, setTabHidden] = useState(
    typeof document !== "undefined" ? document.hidden : false
  );
  // Cheap heuristic for lower-powered/mobile devices: halve the pixel
  // ratio ceiling so the fullscreen background + bloom pass isn't
  // shading 2-3x the physical pixels on a phone for a background layer.
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const { theme } = useTheme();
  const fogColor = theme.id === "mono" ? "#0d0d0d" : theme.id === "blue" ? "#010a1c" : theme.id === "violet" ? "#0a0420" : theme.id === "red" ? "#140505" : "#020e08";

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollRef.current = max > 0 ? window.scrollY / max : 0;
    }
    function onPointerMove(e) {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }
    function onVisibilityChange() {
      setTabHidden(document.hidden);
    }
    function onResize() {
      setIsNarrow(window.innerWidth < 768);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="universe-bg" aria-hidden="true">
      <Canvas
        camera={{
    position:[0,2.8,8],
    fov:36
}}
        dpr={isNarrow ? [1, 1] : [1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        frameloop={reduceMotion || tabHidden ? "demand" : "always"}
      >
        <fogExp2
    attach="fog"
    args={[fogColor,0.045]}
  />

<CameraRig pointerRef={pointerRef} />
<FloatingParticles />
        <TunnelLighting />
        <TunnelRings scrollRef={scrollRef} pointerRef={pointerRef} />
        {!isNarrow && (
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={5}
              luminanceThreshold={0}
              luminanceSmoothing={0}
              mipmapBlur
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}