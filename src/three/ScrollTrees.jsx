import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useTheme } from "../theme";
import TreeModel3D from "./TreeModel3D";
import "./ScrollTrees.css";

// ---------------------------------------------------------------------------
// ScrollTrees — two real 3D (three.js) glowing branch trees, grounded at the
// bottom-left/bottom-right corners of the viewport, sharing ONE <Canvas>/
// WebGL context (the page already runs several other WebGL canvases per
// section, so this intentionally avoids adding two more contexts — browsers
// only guarantee a modest number of simultaneous contexts before older ones
// start getting silently dropped).
//
// The shared camera is calibrated every resize so that, at the z=0 plane,
// one world unit equals one CSS pixel — that turns "plant a tree near the
// bottom-left corner" into simple pixel arithmetic. The right tree reuses
// the same model, mirrored via a negative group scale (TreeModel3D's
// DoubleSide materials keep it lit correctly despite the flipped winding).
//
// Why bottom corners and not a full-height edge span: the actual mesh
// (public/models/tree-branch.glb) is a real scanned/generated branch
// structure with natural roughly-1:1 width:height proportions — a round,
// bushy canopy shape, not a tall slender silhouette. Force-stretching a
// real mesh non-uniformly to hug the entire viewport height (the way the
// old procedural cylinder trees did, since cylinders hide distortion
// invisibly) would look visibly warped. Anchoring it at the bottom edge
// and letting it sit at its natural proportions — while still uniformly
// scaling to a size that reads as a real presence in the layout — reads as
// an actual grounded 3D tree instead of a stretched decal.
// ---------------------------------------------------------------------------

const CAMERA_FOV = 50;
const DEG = Math.PI / 180;

// Target on-screen height for each tree, clamped so it stays a strong but
// not overwhelming presence across common viewport sizes. (+40% over the
// original 0.52 / 260 / 620 — the trees are now meant to read as a large,
// soft, blurred backdrop layer rather than a crisp foreground element; see
// the blur filter on .scroll-trees-root in ScrollTrees.css.)
const HEIGHT_VH_FRACTION = 0.728;
const HEIGHT_MIN_PX = 364;
const HEIGHT_MAX_PX = 868;

// Horizontal inset from the viewport edge and vertical lift off the very
// bottom, scaled up alongside the size increase so bigger trees keep the
// same relative composition instead of crowding the edges.
const INSET_MIN_PX = 34;
const INSET_MAX_PX = 98;
const LIFT_MIN_PX = 11;
const LIFT_MAX_PX = 50;

function TreeLighting() {
  return (
    <>
      <hemisphereLight args={["#bfe4ff", "#04060a", 0.6]} />
      <directionalLight color="#dff0ff" intensity={1.1} position={[1.2, 1.5, 2]} />
      <directionalLight color="#2a5fb0" intensity={0.35} position={[-1, -0.5, -1.5]} />
    </>
  );
}

// Frames the shared camera so world units map 1:1 to CSS pixels at z=0, then
// grounds/scales the two tree groups at the bottom-left/bottom-right corners.
function TreesRig({ leftGroupRef, rightGroupRef }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const fovRad = CAMERA_FOV * DEG;
    const dist = size.height / (2 * Math.tan(fovRad / 2));
    camera.fov = CAMERA_FOV;
    camera.position.set(0, 0, Math.max(dist, 1));
    camera.near = 0.1;
    camera.far = Math.max(dist * 4, 20);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    const heightPx = THREE.MathUtils.clamp(size.height * HEIGHT_VH_FRACTION, HEIGHT_MIN_PX, HEIGHT_MAX_PX);
    const insetPx = THREE.MathUtils.clamp(size.width * 0.035, INSET_MIN_PX, INSET_MAX_PX);
    const liftPx = THREE.MathUtils.clamp(size.height * 0.02, LIFT_MIN_PX, LIFT_MAX_PX);
    const k = heightPx; // model is pre-normalized to exactly 1 unit tall

    const baseY = -size.height / 2 + liftPx;

    if (leftGroupRef.current) {
      leftGroupRef.current.position.set(-size.width / 2 + insetPx, baseY, 0);
      leftGroupRef.current.scale.set(k, k, k);
      leftGroupRef.current.rotation.z = -0.045;
    }
    if (rightGroupRef.current) {
      rightGroupRef.current.position.set(size.width / 2 - insetPx, baseY, 0);
      rightGroupRef.current.scale.set(-k, k, k); // mirrored
      rightGroupRef.current.rotation.z = 0.045;
    }
  }, [camera, size, leftGroupRef, rightGroupRef]);

  return null;
}

function TreesScene({ colors, reduceMotion }) {
  const leftGroupRef = useRef(null);
  const rightGroupRef = useRef(null);

  return (
    <>
      <TreeLighting />
      <TreesRig leftGroupRef={leftGroupRef} rightGroupRef={rightGroupRef} />
      <Suspense fallback={null}>
        <group ref={leftGroupRef}>
          <TreeModel3D colors={colors} reduceMotion={reduceMotion} />
        </group>
        <group ref={rightGroupRef}>
          <TreeModel3D colors={colors} reduceMotion={reduceMotion} />
        </group>
      </Suspense>
    </>
  );
}

export default function ScrollTrees() {
  const { theme, themeId } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tabHidden, setTabHidden] = useState(typeof document !== "undefined" ? document.hidden : false);
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1300 : false
  );

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    function onVisibilityChange() {
      setTabHidden(document.hidden);
    }
    function onResize() {
      setIsNarrow(window.innerWidth < 1300);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  if (isNarrow) return null;

  return (
    <div className="scroll-trees-root" data-theme-linked={themeId} aria-hidden="true">
      <Canvas
        camera={{ fov: CAMERA_FOV, near: 0.1, far: 40 }}
        dpr={[1, 1]}
        gl={{ antialias: true, alpha: true }}
        frameloop={reduceMotion || tabHidden ? "demand" : "always"}
        // See CursorJellyfish.jsx for why this is needed: r3f's Canvas
        // otherwise sets pointer-events:auto inline, overriding the
        // inherited pointer-events:none from ScrollTrees.css.
        style={{ pointerEvents: "none" }}
      >
        <TreesScene colors={theme.colors} reduceMotion={reduceMotion} />
      </Canvas>
    </div>
  );
}
