import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import TunnelOrb from "./TunnelOrb";
import "./ScrollTunnelBackground.css";

// ---------------------------------------------------------------------------
// ScrollTunnelBackground — scroll-driven ring tunnel (ported from
// scroll-tunnel-bg.html), rebuilt as an R3F <Canvas>.
//
// The waypoint "energy orb" 3D model itself lives in ./TunnelOrb.jsx —
// edit that file to change what the markers look like; this file only
// owns the tunnel rings, particles, camera-scroll drive, and where orbs
// are placed.
// ---------------------------------------------------------------------------

const IS_MOBILE = typeof window !== "undefined" && window.innerWidth < 768;

const SECTION_COLORS = [
  0x4fb4ff, // blue
  0x6fe0d0, // teal
  0x9f7dff, // violet
  0xff7dc0, // pink
  0x7dffb0, // mint
];
const SECTION_COUNT = SECTION_COLORS.length;

const RING_COUNT = IS_MOBILE ? 30 : 48;
const RING_SPACING = 2.4;
const TUNNEL_LENGTH = RING_COUNT * RING_SPACING;
const START_Z = 6;
const TRAVEL_DISTANCE = TUNNEL_LENGTH - 8;
const PARTICLE_COUNT = IS_MOBILE ? 140 : 360;
const AMBIENT_DRIFT_SPEED = 0.15;
const RING_OPACITY_SCALE = 0.7; // dial the tunnel rings + their halos down to 70% opacity
const RING_BRIGHTNESS_SCALE = 0.8; // and their color/glow intensity down to 80% brightness

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(170,220,255,0.9)");
  g.addColorStop(0.6, "rgba(60,140,255,0.25)");
  g.addColorStop(1, "rgba(20,80,200,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Scene-wide lighting the orbs' metallic petals need (MeshStandardMaterial);
// everything else in this scene is unlit/additive and unaffected by it.
function TunnelLighting() {
  return (
    <>
      <hemisphereLight args={["#9fd6ff", "#050608", 0.55]} />
      <directionalLight color="#cfe8ff" intensity={0.8} position={[-4, 3, 6]} />
      <directionalLight color="#3a6fb0" intensity={0.4} position={[3, -2, -4]} />
    </>
  );
}

// Drives camera depth from scroll position (eased). Purely scroll-driven —
// no mouse/pointer parallax on the camera itself, so moving the cursor over
// the page never shifts or "shakes" the tunnel.
function ScrollCameraRig({ scrollRef }) {
  const smoothProgress = useRef(0);

  useFrame(({ camera }, dt) => {
    smoothProgress.current += (scrollRef.current - smoothProgress.current) * Math.min(1, dt * 4);
    camera.position.z = START_Z - smoothProgress.current * TRAVEL_DISTANCE;
    camera.position.x = 0;
    camera.position.y = 0;
    camera.lookAt(0, 0, camera.position.z - 10);
  });

  return null;
}

// The 48 thin rings + soft halos that recede into the tunnel, with color
// blending between the active pair of SECTION_COLORS as the camera moves.
function TunnelRingsField() {
  const ringRefs = useRef([]);
  const haloRefs = useRef([]);
  const currentColor = useMemo(() => new THREE.Color(SECTION_COLORS[0]), []);
  const tmpA = useMemo(() => new THREE.Color(), []);
  const tmpB = useMemo(() => new THREE.Color(), []);

  const ringData = useMemo(
    () =>
      new Array(RING_COUNT).fill(0).map((_, i) => ({
        z: -i * RING_SPACING,
        radius: 2.6 + Math.sin(i * 0.4) * 0.15,
        rotSpeed: (Math.random() - 0.5) * 0.15,
        baseOpacity: (0.15 + Math.random() * 0.25) * RING_OPACITY_SCALE,
      })),
    []
  );

  useFrame(({ camera, clock }, dt) => {
    const t = clock.elapsedTime;
    const smoothProgress = THREE.MathUtils.clamp(
      (START_Z - camera.position.z) / TRAVEL_DISTANCE,
      0,
      1
    );
    const sectionFloat = smoothProgress * (SECTION_COUNT - 1);
    const idx = Math.floor(sectionFloat);
    const frac = sectionFloat - idx;
    tmpA.set(SECTION_COLORS[Math.min(idx, SECTION_COUNT - 1)]);
    tmpB.set(SECTION_COLORS[Math.min(idx + 1, SECTION_COUNT - 1)]);
    currentColor.copy(tmpA).lerp(tmpB, frac);

    ringData.forEach((r, i) => {
      const ring = ringRefs.current[i];
      const halo = haloRefs.current[i];
      if (!ring || !halo) return;

      ring.rotation.z += r.rotSpeed * dt * (0.4 + AMBIENT_DRIFT_SPEED);
      halo.rotation.z = ring.rotation.z;

      const dist = Math.abs(r.z - camera.position.z);
      const depthFade = THREE.MathUtils.clamp(1 - dist / (TUNNEL_LENGTH * 0.55), 0, 1);
      ring.material.opacity = r.baseOpacity * depthFade * (0.8 + 0.2 * Math.sin(t * 1.5 + r.z));
      halo.material.opacity = ring.material.opacity * 0.35;

      ring.material.color.copy(currentColor).multiplyScalar(RING_BRIGHTNESS_SCALE);
      halo.material.color.copy(currentColor).multiplyScalar(RING_BRIGHTNESS_SCALE);
    });
  });

  return (
    <>
      {ringData.map((r, i) => (
        <group key={i} position={[0, 0, r.z]}>
          <mesh ref={(el) => (ringRefs.current[i] = el)}>
            <torusGeometry args={[r.radius, 0.012, 8, 96]} />
            <meshBasicMaterial
              transparent
              opacity={r.baseOpacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh ref={(el) => (haloRefs.current[i] = el)}>
            <torusGeometry args={[r.radius, 0.05, 6, 64]} />
            <meshBasicMaterial
              transparent
              opacity={0.06 * RING_OPACITY_SCALE}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

// Ambient drifting dust particles that wrap around behind the camera as it
// travels, same recycling trick as the source HTML.
function TunnelParticlesField() {
  const pointsRef = useRef();
  const glowTexture = useMemo(() => makeGlowTexture(), []);

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const speeds = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 3.2;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = Math.sin(angle) * r;
      positions[i * 3 + 2] = -Math.random() * TUNNEL_LENGTH;
      speeds[i] = 0.3 + Math.random() * 0.8;
    }
    return { positions, speeds };
  }, []);

  useFrame(({ camera }, dt) => {
    const points = pointsRef.current;
    if (!points) return;
    const posAttr = points.geometry.attributes.position;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let z = posAttr.array[i * 3 + 2] + speeds[i] * dt * AMBIENT_DRIFT_SPEED * 4;
      if (z > camera.position.z + TUNNEL_LENGTH * 0.1) {
        z -= TUNNEL_LENGTH;
      }
      posAttr.array[i * 3 + 2] = z;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        map={glowTexture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color={0xaaddff}
        toneMapped={false}
        sizeAttenuation
      />
    </points>
  );
}

export default function ScrollTunnelBackground() {
  const scrollRef = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tabHidden, setTabHidden] = useState(
    typeof document !== "undefined" ? document.hidden : false
  );
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    function updateScrollProgress() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      scrollRef.current =
        scrollable > 0 ? THREE.MathUtils.clamp(window.scrollY / scrollable, 0, 1) : 0;
    }
    function onVisibilityChange() {
      setTabHidden(document.hidden);
    }
    function onResize() {
      setIsNarrow(window.innerWidth < 768);
      updateScrollProgress();
    }

    updateScrollProgress();
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScrollProgress);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="scroll-tunnel-bg" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, START_Z], fov: 60, near: 0.1, far: 200 }}
        dpr={[1, isNarrow ? 1 : 1.25]}
        gl={{ antialias: !isNarrow, alpha: true, powerPreference: "high-performance" }}
        frameloop={reduceMotion || tabHidden ? "demand" : "always"}
        performance={{ min: 0.65, max: 1, debounce: 250 }}
        // See CursorJellyfish.jsx for why this is needed: r3f's Canvas
        // otherwise sets pointer-events:auto inline, overriding the
        // inherited pointer-events:none from ScrollTunnelBackground.css.
        style={{ pointerEvents: "none" }}
      >
        <fogExp2 attach="fog" args={["#000000", 0.045]} />

        <TunnelLighting />
        <ScrollCameraRig scrollRef={scrollRef} />
        <TunnelRingsField />
        <TunnelParticlesField />

        {/* {SECTION_COLORS.map((color, i) => (
          <TunnelOrb
            key={i}
            position={[0, 0, -(i / (SECTION_COUNT - 1)) * TRAVEL_DISTANCE]}
            color={color}
          />
        ))} */}

        {!isNarrow && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={3} luminanceThreshold={0} luminanceSmoothing={0} mipmapBlur />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
