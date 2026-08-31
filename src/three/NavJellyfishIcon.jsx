import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useTheme } from "../theme";
import JellyfishModel3D from "./JellyfishModel3D";

// ---------------------------------------------------------------------------
// NavJellyfishIcon — the actual 3D dust-jellyfish (see JellyfishModel3D),
// rendered tiny inside the nav button instead of a flat SVG glyph.
//
// Uses the same "1 world unit == 1 css px at z=0" camera convention as
// CursorJellyfish, just calibrated to this canvas's own (much smaller)
// size instead of the full window — JellyfishModel3D derives its point-size
// scale from the live camera/canvas each frame, so the identical dust
// shader works correctly at both scales with no manual tuning here.
//
// This icon always renders fully "spawned" (uSpawn = 1, no materialize
// wipe) and just idles in place, always mounted. Nav.jsx handles the
// launch/return feel at the DOM level — a quick "kick" + expanding pulse
// ring on click — while CursorJellyfish.jsx spawns/dissolves the actual
// detached jellyfish from this icon's on-screen position. Keeping this
// component itself dumb/static avoids re-fighting the spawn-shader edge
// cases the big jellyfish already needs to handle.
// ---------------------------------------------------------------------------

const CAMERA_FOV = 50;
const DEG = Math.PI / 180;

// How tall the jellyfish renders inside the button, in css px. Kept a
// little under the button's full size so tentacle sway doesn't clip.
const ICON_HEIGHT_PX = 21;
// A lighter particle budget than the cursor jellyfish's 20,000 — the icon
// is small enough that this still reads as a dense, glowing shape.
const ICON_PARTICLE_BUDGET = 700;
const ICON_MIN_PARTICLES_PER_MESH = 24;
// Slightly finer dust than the big jellyfish so the icon doesn't read as
// a handful of oversized blobs at this scale.
const ICON_DUST_SIZE_SCALE = 0.62;

function IconCameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!camera.isPerspectiveCamera) return;
    const fovRad = CAMERA_FOV * DEG;
    const dist = size.height / (2 * Math.tan(fovRad / 2));
    camera.fov = CAMERA_FOV;
    camera.position.set(0, 0, Math.max(dist, 0.1));
    camera.near = 0.05;
    camera.far = Math.max(dist * 4, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function IconJellyfish({ colors, reduceMotion }) {
  const spawnRef = useRef(1);
  const dragRef = useRef({ x: 0, y: 0 });
  return (
    <group scale={[ICON_HEIGHT_PX, ICON_HEIGHT_PX, ICON_HEIGHT_PX]} position={[0, ICON_HEIGHT_PX * 0.42, 0]}>
      <JellyfishModel3D
        colors={colors}
        reduceMotion={reduceMotion}
        spawnRef={spawnRef}
        dragRef={dragRef}
        particleBudget={ICON_PARTICLE_BUDGET}
        minParticlesPerMesh={ICON_MIN_PARTICLES_PER_MESH}
        dustSizeScale={ICON_DUST_SIZE_SCALE}
      />
    </group>
  );
}

function IconLighting() {
  return (
    <>
      <hemisphereLight args={["#bfe4ff", "#04060a", 0.7]} />
      <directionalLight color="#dff0ff" intensity={1.1} position={[1, 1.4, 1.8]} />
    </>
  );
}

export default function NavJellyfishIcon({ reduceMotion }) {
  const { theme } = useTheme();
  const colors = useMemo(() => theme.colors, [theme]);

  return (
    <Canvas
      className="nav-jellyfish-icon-canvas"
      camera={{ fov: CAMERA_FOV, near: 0.05, far: 40 }}
      dpr={[1, 1]}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      frameloop={reduceMotion ? "demand" : "always"}
    >
      <IconCameraRig />
      <IconLighting />
      <Suspense fallback={null}>
        <IconJellyfish colors={colors} reduceMotion={reduceMotion} />
      </Suspense>
    </Canvas>
  );
}
