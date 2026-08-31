import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useTheme } from "../theme";
import JellyfishModel3D from "./JellyfishModel3D";
import { usePerf } from "../perf.jsx";
import "./CursorJellyfish.css";

// DPR ceiling and antialiasing scale with device tier, same as the other
// always-on 3D layers (see ScrollTunnelBackground.jsx).
const TIER_DPR_MAX = { low: 1, medium: 1.25, high: 1.5 };

// ---------------------------------------------------------------------------
// CursorJellyfish — a small companion jellyfish (see JellyfishModel3D) that
// swims out of the jellyfish icon in the nav bar and trails the cursor
// around the page until it's toggled off again, at which point it shrinks
// and dissolves back into the icon it came from.
//
// Shares the same "one world unit == one CSS pixel at z=0" camera
// convention as ScrollTrees.jsx, so the icon's on-screen position (a
// getBoundingClientRect() center, in viewport px) and the live cursor
// position can both be converted into this scene's world space with the
// same simple formula and fed straight into a position lerp — no separate
// screen-to-world projection math needed.
// ---------------------------------------------------------------------------

const CAMERA_FOV = 50;
const DEG = Math.PI / 180;

const HEIGHT_VH_FRACTION = 0.24;
const HEIGHT_MIN_PX = 130;
const HEIGHT_MAX_PX = 220;

const ENTER_DURATION = 0.62; // seconds — icon -> fully materialized
// Exported so Nav.jsx can time the nav icon's own pop-back-in animation to
// finish exactly when this dissolve finishes, so the two read as one
// continuous creature instead of two independently-timed animations.
export const EXIT_DURATION = 0.48; // seconds — dissolve back toward the icon
const FOLLOW_LAMBDA = 2.4; // higher = snappier trailing, lower = laggier — kept slow/laggy so it visibly trails behind while you move, but it still fully catches up and settles with the head right on the cursor once you stop
const HEADING_LAMBDA = 6; // how quickly the body turns to actually face its direction of travel
const MIN_TURN_SPEED = 12; // px/s — below this the cursor is basically stationary, so hold the last heading instead of chasing tiny mouse jitter
const IDLE_YAW_SPEED = 0.55; // rad/s for the slow idle turn-in-place sway
const IDLE_YAW_AMPLITUDE = 0.24; // rad

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}
function easeInCubic(x) {
  return x * x * x;
}

function screenToWorld(point) {
  if (!point) return null;
  return {
    x: point.x - window.innerWidth / 2,
    y: -(point.y - window.innerHeight / 2),
  };
}

function JellyfishRig({ active, origin, colors, reduceMotion }) {
  const { camera, size } = useThree();
  const groupRef = useRef(null);

  const spawnRef = useRef(0);
  const dragRef = useRef({ x: 0, y: 0 });
  // Smoothed heading angle (roll around the camera-facing axis) that turns
  // the whole body to actually face its direction of travel, plus a
  // separate slow idle yaw sway on top so it keeps turning gently even at
  // rest — together these are what make the bell visibly orient itself
  // instead of translating flat across the screen like a 2D sprite.
  const headingRef = useRef(0);
  const idleYawRef = useRef(0);
  // Deliberately starts false regardless of the initial `active` prop: this
  // component only ever mounts at the moment it's needed (see the
  // `visible` gate in CursorJellyfish below), so the very first effect run
  // must still be treated as a rising edge to snap the jellyfish onto the
  // icon and kick off the entrance animation.
  const activeRef = useRef(false);
  const changeTimeRef = useRef(Date.now());
  const posRef = useRef(new THREE.Vector3(0, 0, 0));
  const prevPosRef = useRef(new THREE.Vector3(0, 0, 0));
  const initializedRef = useRef(false);

  useEffect(() => {
    const fovRad = CAMERA_FOV * DEG;
    const dist = size.height / (2 * Math.tan(fovRad / 2));
    camera.fov = CAMERA_FOV;
    camera.position.set(0, 0, Math.max(dist, 1));
    camera.near = 0.1;
    camera.far = Math.max(dist * 4, 20);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);

  const mouseWorld = useRef({ x: 0, y: -size.height / 2 + 40 });

  // On rising/falling edges of `active`, snap the timing reference so the
  // spawn/dissolve animation restarts, and — the first time it goes active
  // — snap the jellyfish's actual position to the icon's on-screen spot so
  // it visibly launches from there rather than fading in wherever the
  // cursor happens to be.
  useEffect(() => {
    if (activeRef.current === active) return;
    activeRef.current = active;
    changeTimeRef.current = Date.now();
    if (active) {
      const originWorld = screenToWorld(origin) || { x: 0, y: -size.height / 2 + 40 };
      posRef.current.set(originWorld.x, originWorld.y, 0);
      prevPosRef.current.copy(posRef.current);
      // Also seed the "follow the cursor" target with the same point. The
      // click that triggered this IS a mouse position, so this is a real
      // value, not a guess — without it, `mouseWorld` sits at its stale
      // hardcoded fallback (bottom-center of the screen) until the browser
      // fires the next real pointermove, and the jellyfish spends that gap
      // lerping toward the fallback instead of staying put beside the
      // icon — which is exactly what read as it "popping in, then
      // immediately dropping straight down."
      mouseWorld.current.x = originWorld.x;
      mouseWorld.current.y = originWorld.y;
      initializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    function onPointerMove(e) {
      mouseWorld.current.x = e.clientX - window.innerWidth / 2;
      mouseWorld.current.y = -(e.clientY - window.innerHeight / 2);
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  useFrame((_, delta) => {
    const now = Date.now();
    const elapsed = (now - changeTimeRef.current) / 1000;
    const duration = activeRef.current ? ENTER_DURATION : EXIT_DURATION;
    const raw = clamp(duration > 0 ? elapsed / duration : 1, 0, 1);
    const eased = activeRef.current ? easeOutCubic(raw) : easeInCubic(raw);
    spawnRef.current = activeRef.current ? eased : 1 - eased;

    if (!initializedRef.current) return;

    // Follow the cursor once active (and while still materializing, so it
    // flies toward wherever the pointer is as it forms); ease back toward
    // the icon's spot while dissolving out. The head — see
    // buildJellyDustGeometry's "crown at y=0" normalization, which makes
    // the bell's crown the model's local origin — is what this position
    // actually places, so it's the head itself doing the tracking, not
    // some other point on the body. FOLLOW_LAMBDA alone (below) is what
    // keeps it slow/laggy while moving; there's no separate offset keeping
    // it away from the pointer, so once it catches up it settles with the
    // head right on the cursor.
    const originWorld = screenToWorld(origin) || { x: 0, y: -size.height / 2 + 40 };
    const target = activeRef.current ? mouseWorld.current : originWorld;

    let vx = 0;
    let vy = 0;
    if (!reduceMotion) {
      const lerpAmount = 1 - Math.exp(-delta * FOLLOW_LAMBDA);
      prevPosRef.current.copy(posRef.current);
      posRef.current.x += (target.x - posRef.current.x) * lerpAmount;
      posRef.current.y += (target.y - posRef.current.y) * lerpAmount;

      vx = (posRef.current.x - prevPosRef.current.x) / Math.max(delta, 0.001);
      vy = (posRef.current.y - prevPosRef.current.y) / Math.max(delta, 0.001);
      const heightPx = clamp(size.height * HEIGHT_VH_FRACTION, HEIGHT_MIN_PX, HEIGHT_MAX_PX);
      dragRef.current.x = clamp(-vx / heightPx * 0.05, -0.35, 0.35);
      dragRef.current.y = clamp(-vy / heightPx * 0.05, -0.35, 0.35);
    } else {
      posRef.current.set(target.x, target.y, 0);
    }

    if (groupRef.current) {
      const heightPx = clamp(size.height * HEIGHT_VH_FRACTION, HEIGHT_MIN_PX, HEIGHT_MAX_PX);
      // Entrance: grow from 0 -> 1 on the exact same `eased` curve (and the
      // exact same ENTER_DURATION) that drives the particle materialize
      // wipe above, so the silhouette's overall size and the dust cloud
      // filling it in advance together at one smooth, matched rate instead
      // of the bounding scale racing ahead (or lagging behind) the reveal
      // — that mismatch is what read as an abrupt "pop" before. No spring
      // overshoot, just a continuous grow straight out of the icon.
      // Exit is unchanged: it shrinks via the spawnRef factor below, down
      // to a small floor so it visibly tucks back into the icon.
      const growth = reduceMotion ? 1 : activeRef.current ? eased : 1;
      const scale = heightPx * clamp(growth, 0.001, 1) * (activeRef.current ? 1 : Math.max(spawnRef.current, 0.08));
      groupRef.current.position.copy(posRef.current);
      groupRef.current.scale.set(scale, scale, scale);

      if (!reduceMotion) {
        // Turn the whole body to actually face its direction of travel —
        // e.g. moving the cursor down should visibly rotate the bell to
        // point down, not just lean toward/away from the camera. That
        // needs a roll around the camera-facing (Z) axis specifically:
        // this world's XY plane already matches the screen 1:1 (see the
        // module comment on screenToWorld), so rotating around Z is what
        // actually reorients the silhouette as seen on screen, unlike
        // rotating around X or Y which mostly tilt it toward/away from
        // the camera with little visible on-screen change. The model's
        // default "up" (head/bell, per buildJellyDustGeometry's "crown at
        // y=0" normalization) is the facing direction being aimed at the
        // current travel heading. Below MIN_TURN_SPEED we hold the last
        // heading rather than chasing tiny mouse jitter while idling.
        const speed = Math.hypot(vx, vy);
        if (speed > MIN_TURN_SPEED) {
          const targetHeading = Math.atan2(-vx, vy);
          const diff = Math.atan2(
            Math.sin(targetHeading - headingRef.current),
            Math.cos(targetHeading - headingRef.current)
          );
          const rotLerp = 1 - Math.exp(-delta * HEADING_LAMBDA);
          headingRef.current += diff * rotLerp;
        }

        idleYawRef.current += delta * IDLE_YAW_SPEED;
        const yaw = Math.sin(idleYawRef.current) * IDLE_YAW_AMPLITUDE;

        groupRef.current.rotation.set(0, yaw, headingRef.current);
      } else {
        groupRef.current.rotation.set(0, 0, 0);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <JellyfishModel3D colors={colors} reduceMotion={reduceMotion} spawnRef={spawnRef} dragRef={dragRef} />
    </group>
  );
}

function JellyLighting() {
  return (
    <>
      <hemisphereLight args={["#bfe4ff", "#04060a", 0.6]} />
      <directionalLight color="#dff0ff" intensity={1.1} position={[1.2, 1.5, 2]} />
      <directionalLight color="#2a5fb0" intensity={0.35} position={[-1, -0.5, -1.5]} />
    </>
  );
}

export default function CursorJellyfish({ active, origin }) {
  const { theme } = useTheme();
<<<<<<< HEAD
  const { tier } = usePerf();
=======
>>>>>>> 806618d63991c0e0182d420b08c40261ccf1a032
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tabHidden, setTabHidden] = useState(typeof document !== "undefined" ? document.hidden : false);

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    function onVisibilityChange() {
      setTabHidden(document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (active) {
      setVisible(true);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(false), EXIT_DURATION * 1000 + 80);
    return () => clearTimeout(timer);
  }, [active]);

  const colors = useMemo(() => theme.colors, [theme]);

  if (!visible) return null;

  return (
    <div className="cursor-jellyfish-root" aria-hidden="true">
      <Canvas
        camera={{ fov: CAMERA_FOV, near: 0.1, far: 40 }}
<<<<<<< HEAD
        dpr={[1, TIER_DPR_MAX[tier] ?? TIER_DPR_MAX.medium]}
        gl={{ antialias: tier !== "low", alpha: true }}
=======
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
>>>>>>> 806618d63991c0e0182d420b08c40261ccf1a032
        frameloop={tabHidden ? "demand" : "always"}
        // react-three-fiber's Canvas sets `pointer-events: auto` as an
        // INLINE style on its own wrapper div whenever no custom
        // `eventSource` is given — and an inline style always wins over
        // the inherited `pointer-events: none` on .cursor-jellyfish-root
        // in the CSS file. Without this override, this full-viewport
        // canvas silently sat on top of the entire page and swallowed
        // every click, even though it looks/reads as a transparent
        // decorative overlay. This is the one line that actually lets
        // clicks fall through to buttons/cards/links underneath while
        // the jellyfish is out.
        style={{ pointerEvents: "none" }}
      >
        <JellyLighting />
        <Suspense fallback={null}>
          <JellyfishRig active={active} origin={origin} colors={colors} reduceMotion={reduceMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}
