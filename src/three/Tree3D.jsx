import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TREE_GROW_WINDOW } from "./treeGenerator3d";

// ---------------------------------------------------------------------------
// Tree3D — one glowing procedural tree, rendered as:
//   1. an InstancedMesh of tapered, gently-curved cylinders (the branches)
//   2. a second, fatter/transparent InstancedMesh sharing the same
//      transforms (a cheap "halo" that fakes bloom without postprocessing)
//   3. a custom-shader Points cloud (leaf/frond clusters at the tips, with a
//      soft lobed silhouette and a slow shimmer instead of plain round dots)
//   4. a second, small custom-shader Points cloud (bright white "spark"
//      flashes at every branch fork, the instant growth reaches that joint)
//
// Growth is driven by page scroll: on scroll we recompute how much of the
// tree's total branch length should be "drawn" (same easing curve as the
// original 2D version, but never fully zero — see MIN_VISIBLE_FRACTION),
// then write per-instance matrices for the branches (scaled from zero at
// the base, so each branch visibly grows outward from its parent, base
// first) and update shader uniforms for the leaves/sparks (so reveal costs
// nothing extra on the CPU no matter how many of them exist).
// ---------------------------------------------------------------------------

const UNIT_HEIGHT = 1;
const TOP_RADIUS_RATIO = 0.55;

// The tree is never fully invisible, even before the user has scrolled at
// all — a small rooted stub is already lit on page load (matching the
// reference art's "01 PAGE LOAD" stage), and growth fills outward from
// that base rather than popping in from nothing.
const MIN_VISIBLE_FRACTION = 0.035;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function buildLeafShaderMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uProgress: { value: 0 },
      uGrowWindow: { value: TREE_GROW_WINDOW },
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aRevealAt;
      attribute float aSize;
      attribute float aSparkle;
      uniform float uProgress;
      uniform float uGrowWindow;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSparkle;
      void main() {
        float t = clamp((uProgress - aRevealAt) / uGrowWindow, 0.0, 1.0);
        vAlpha = t;
        vColor = aColor;
        vSparkle = aSparkle;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (420.0 / max(-mvPosition.z, 0.001)) * (0.45 + 0.55 * t);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSparkle;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv) * 2.0;
        float ang = atan(uv.y, uv.x);
        // Gentle 5-lobed silhouette so clusters read as leaf/frond tufts
        // instead of perfectly round dots, closer to the reference foliage.
        float lobe = 0.86 + 0.14 * sin(ang * 5.0 + vSparkle);
        float alpha = smoothstep(lobe, lobe - 0.35, d) * vAlpha;
        float shimmer = 0.82 + 0.18 * sin(uTime * 1.6 + vSparkle * 3.0);
        alpha *= shimmer;
        if (alpha <= 0.004) discard;
        gl_FragColor = vec4(vColor * (1.0 + (1.0 - d) * 0.4), alpha);
      }
    `,
  });
}

// Small bright flashes at every branch fork: a quick additive "pop" the
// instant growth reaches that joint, settling to a soft steady glow — the
// glowing white joints visible in the reference art.
function buildNodeShaderMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uProgress: { value: 0 },
      uGrowWindow: { value: TREE_GROW_WINDOW },
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float aRevealAt;
      attribute float aSize;
      attribute float aSeed;
      uniform float uProgress;
      uniform float uGrowWindow;
      uniform float uTime;
      varying float vAlpha;
      varying float vFlash;
      void main() {
        float t = clamp((uProgress - aRevealAt) / uGrowWindow, 0.0, 1.0);
        vAlpha = t;
        vFlash = exp(-t * 7.0) * step(0.001, t);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float pulse = 0.9 + 0.1 * sin(uTime * 2.2 + aSeed * 6.2831);
        gl_PointSize = aSize * (420.0 / max(-mvPosition.z, 0.001)) * (0.3 + 0.9 * t) * pulse;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vFlash;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        float core = smoothstep(0.5, 0.0, d);
        float alpha = core * (vAlpha * 0.7 + vFlash);
        if (alpha <= 0.003) discard;
        gl_FragColor = vec4(vec3(1.0), alpha);
      }
    `,
  });
}

export default function Tree3D({ data, colors, reduceMotion }) {
  const groupRef = useRef(null);
  const branchMeshRef = useRef(null);
  const haloMeshRef = useRef(null);
  const leafPointsRef = useRef(null);
  const nodePointsRef = useRef(null);
  const swayPhase = useRef(Math.random() * Math.PI * 2);
  const { invalidate } = useThree();

  const branchGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(TOP_RADIUS_RATIO, 1, UNIT_HEIGHT, 6, 1, false);
    geo.translate(0, UNIT_HEIGHT / 2, 0); // pivot at the base so scale.y grows outward
    return geo;
  }, []);

  const branchMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors[0],
        emissive: colors[0],
        emissiveIntensity: 2.3,
        roughness: 0.35,
        metalness: 0.15,
        toneMapped: false,
        // The right-side tree is mirrored via a negative group scale (see
        // ScrollTrees.jsx), which flips triangle winding — DoubleSide keeps
        // it lit correctly instead of going invisible/inside-out.
        side: THREE.DoubleSide,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const haloMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors[0],
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const leafMaterial = useMemo(() => buildLeafShaderMaterial(), []);
  const nodeMaterial = useMemo(() => buildNodeShaderMaterial(), []);

  const leafGeometry = useMemo(() => {
    const count = data.leaves.length;
    const positions = new Float32Array(count * 3);
    const colorArr = new Float32Array(count * 3);
    const revealAt = new Float32Array(count);
    const sizes = new Float32Array(count);
    const sparkle = new Float32Array(count);
    const tmp = new THREE.Color();

    data.leaves.forEach((l, i) => {
      positions[i * 3] = l.position.x;
      positions[i * 3 + 1] = l.position.y;
      positions[i * 3 + 2] = l.position.z;
      tmp.set(colors[l.colorIndex % colors.length]);
      colorArr[i * 3] = tmp.r;
      colorArr[i * 3 + 1] = tmp.g;
      colorArr[i * 3 + 2] = tmp.b;
      revealAt[i] = l.revealAt;
      sizes[i] = l.size * 120;
      sparkle[i] = l.sparkle;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colorArr, 3));
    geo.setAttribute("aRevealAt", new THREE.BufferAttribute(revealAt, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aSparkle", new THREE.BufferAttribute(sparkle, 1));
    return geo;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const nodeGeometry = useMemo(() => {
    const count = data.nodes.length;
    const positions = new Float32Array(count * 3);
    const revealAt = new Float32Array(count);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);

    data.nodes.forEach((n, i) => {
      positions[i * 3] = n.position.x;
      positions[i * 3 + 1] = n.position.y;
      positions[i * 3 + 2] = n.position.z;
      revealAt[i] = n.revealAt;
      sizes[i] = 55 + n.seed * 35;
      seeds[i] = n.seed;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aRevealAt", new THREE.BufferAttribute(revealAt, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return geo;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-tint on theme change without regenerating geometry.
  useEffect(() => {
    branchMaterial.color.set(colors[0]);
    branchMaterial.emissive.set(colors[0]);
    haloMaterial.color.set(colors[0]);
    const colorAttr = leafGeometry.getAttribute("aColor");
    const tmp = new THREE.Color();
    data.leaves.forEach((l, i) => {
      tmp.set(colors[l.colorIndex % colors.length]);
      colorAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
    });
    colorAttr.needsUpdate = true;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors]);

  // Writes instance matrices for both the branch mesh and its halo twin from
  // the current scroll-driven "grown length", then nudges leaf/spark reveal
  // via shader uniforms.
  const applyGrowth = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? clamp(window.scrollY / scrollable, 0, 1) : 0;
    const eased = 1 - Math.pow(1 - progress, 1.6);
    const minLen = data.totalLength * MIN_VISIBLE_FRACTION;
    const scrollLen = minLen + eased * (data.totalLength - minLen);

    const branchMesh = branchMeshRef.current;
    const haloMesh = haloMeshRef.current;
    if (branchMesh && haloMesh) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const scale = new THREE.Vector3();

      data.branches.forEach((b, i) => {
        const drawn = clamp(scrollLen - b.cumStart, 0, b.length);
        const growth = b.length > 0 ? drawn / b.length : 0;
        q.setFromUnitVectors(up, b.dir);

        scale.set(b.radius, b.length * growth, b.radius);
        m.compose(b.start, q, scale);
        branchMesh.setMatrixAt(i, m);

        scale.set(b.radius * 2.6, b.length * growth, b.radius * 2.6);
        m.compose(b.start, q, scale);
        haloMesh.setMatrixAt(i, m);
      });
      branchMesh.instanceMatrix.needsUpdate = true;
      haloMesh.instanceMatrix.needsUpdate = true;
    }

    if (leafPointsRef.current) {
      leafPointsRef.current.material.uniforms.uProgress.value = scrollLen;
    }
    if (nodePointsRef.current) {
      nodePointsRef.current.material.uniforms.uProgress.value = scrollLen;
    }

    invalidate();
  };

  useEffect(() => {
    let rafId = null;
    function onScroll() {
      if (rafId == null) rafId = requestAnimationFrame(() => {
        applyGrowth();
        rafId = null;
      });
    }
    applyGrowth();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Slow idle sway around the rooted edge (sells the "3D model" feel even
  // when the user isn't scrolling) plus the shimmer/pulse clocks for the
  // leaf and spark shaders. All skipped under prefers-reduced-motion
  // (frameloop stays "demand" in that case anyway, so this simply won't
  // tick on its own).
  useFrame(({ clock }) => {
    if (reduceMotion) return;
    const t = clock.elapsedTime;
    leafMaterial.uniforms.uTime.value = t;
    nodeMaterial.uniforms.uTime.value = t;
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.16 + swayPhase.current) * 0.035;
      groupRef.current.rotation.x = Math.sin(t * 0.11 + swayPhase.current) * 0.012;
    }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={branchMeshRef}
        args={[branchGeometry, branchMaterial, data.branches.length]}
      />
      <instancedMesh
        ref={haloMeshRef}
        args={[branchGeometry, haloMaterial, data.branches.length]}
      />
      <points ref={leafPointsRef} geometry={leafGeometry} material={leafMaterial} />
      <points ref={nodePointsRef} geometry={nodeGeometry} material={nodeMaterial} />
    </group>
  );
}
