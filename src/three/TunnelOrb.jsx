import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/*
 * ============================================================
 * TUNNEL ORB — panelled shell, scroll-driven
 * ============================================================
 *
 * Shell construction (matches the "closed" reference):
 *   The shell is a spherified cube — 6 cube faces, each warped
 *   onto a sphere with the standard cube->sphere formula. Each
 *   face is cut into a 5-panel cross (center + top/bottom/
 *   left/right), so panels share exact edges — that's what
 *   produces the continuous glowing seam grid in the reference,
 *   for free, from EdgesGeometry.
 *
 * Opening (matches the "open" reference):
 *   Each panel already sits at its correct closed-sphere
 *   position (baked into its own geometry). To open, we just
 *   translate each panel's group outward along its own surface
 *   normal — no separate "closed vs open" geometry needed.
 *
 * scrollProgress (0..1) drives openAmount, eased with
 * THREE.MathUtils.damp so it always opens/closes smoothly
 * regardless of scroll speed.
 *
 * Usage from a parent (outside the <Canvas>):
 *
 *   const [progress, setProgress] = useState(0);
 *   const sectionRef = useRef(null);
 *
 *   useEffect(() => {
 *     const onScroll = () => {
 *       const el = sectionRef.current;
 *       if (!el) return;
 *       const rect = el.getBoundingClientRect();
 *       const vh = window.innerHeight;
 *       const raw = (vh - rect.top) / (vh + rect.height);
 *       setProgress(THREE.MathUtils.clamp(raw, 0, 1));
 *     };
 *     window.addEventListener("scroll", onScroll, { passive: true });
 *     onScroll();
 *     return () => window.removeEventListener("scroll", onScroll);
 *   }, []);
 *
 *   <div ref={sectionRef}>
 *     <Canvas>
 *       <TunnelOrb scrollProgress={progress} />
 *     </Canvas>
 *   </div>
 */


/* ============================================================
 * GLOW TEXTURE
 * ============================================================ */

function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.12, "rgba(220,245,255,1)");
  gradient.addColorStop(0.28, "rgba(100,190,255,0.9)");
  gradient.addColorStop(0.55, "rgba(30,110,255,0.35)");
  gradient.addColorStop(1, "rgba(0,40,160,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}


/* ============================================================
 * PLASMA SHADER (core — unchanged, already matches reference)
 * ============================================================ */

const PLASMA_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PLASMA_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uBrightness;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 2.4);
    float n1 = noise(vWorldPosition * 7.0 + uTime * 0.8);
    float n2 = noise(vWorldPosition * 15.0 - uTime * 0.55);
    float veins = smoothstep(0.56, 0.68, n1);
    veins *= smoothstep(0.35, 0.75, n2);
    float electric = pow(abs(sin(vWorldPosition.x * 17.0 + vWorldPosition.y * 13.0 + vWorldPosition.z * 8.0 + uTime * 2.5)), 18.0);
    float glow = fresnel * 0.65 + veins * 1.8 + electric * 0.7;
    glow = clamp(glow, 0.0, 1.5);
    vec3 finalColor = uColor * (0.8 + glow * 2.4) * uBrightness;
    gl_FragColor = vec4(finalColor, glow * uOpacity);
  }
`;


/* ============================================================
 * SPHERIFIED CUBE MATH
 * ============================================================ */

// Standard cube -> sphere warp (keeps panels rectangular-ish
// instead of pinching at cube corners).
function spherify(p) {
  const x2 = p.x * p.x;
  const y2 = p.y * p.y;
  const z2 = p.z * p.z;
  const sx = p.x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3);
  const sy = p.y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3);
  const sz = p.z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3);
  return new THREE.Vector3(sx, sy, sz);
}

// 6 cube faces, defined so cross(uAxis, vAxis) == normal
// (keeps triangle winding / outward normals consistent).
const FACES = [
  { normal: [1, 0, 0], uAxis: [0, 0, -1], vAxis: [0, 1, 0] }, // +X
  { normal: [-1, 0, 0], uAxis: [0, 0, 1], vAxis: [0, 1, 0] }, // -X
  { normal: [0, 1, 0], uAxis: [0, 0, 1], vAxis: [1, 0, 0] }, // +Y
  { normal: [0, -1, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1] }, // -Y
  { normal: [0, 0, 1], uAxis: [1, 0, 0], vAxis: [0, 1, 0] }, // +Z
  { normal: [0, 0, -1], uAxis: [-1, 0, 0], vAxis: [0, 1, 0] }, // -Z
];

// Each face is cut into a 5-panel cross: center + top/bottom/left/right.
// C is the half-width of the center square, in the face's local [-1,1] space.
const C = 0.42;
const REGIONS = [
  { u: [-1, -C], v: [-C, C] }, // left
  { u: [C, 1], v: [-C, C] }, // right
  { u: [-1, 1], v: [C, 1] }, // top
  { u: [-1, 1], v: [-1, -C] }, // bottom
  { u: [-C, C], v: [-C, C] }, // center
];

// Builds one panel's front+back+stitched-side geometry from a
// (s,t) in [0,1] -> world position function.
function createGridPanel(pointFn, segments, thickness) {
  const positions = [];
  const normals = [];
  const indices = [];
  const rowSize = segments + 1;

  for (let j = 0; j <= segments; j++) {
    const t = j / segments;
    for (let i = 0; i <= segments; i++) {
      const s = i / segments;
      const p = pointFn(s, t);
      positions.push(p.x, p.y, p.z);
      const n = p.clone().normalize();
      normals.push(n.x, n.y, n.z);
    }
  }

  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * rowSize + i;
      const b = a + 1;
      const c = a + rowSize;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const frontCount = positions.length / 3;
  for (let k = 0; k < frontCount; k++) {
    const x = positions[k * 3];
    const y = positions[k * 3 + 1];
    const z = positions[k * 3 + 2];
    const n = new THREE.Vector3(x, y, z).normalize();
    positions.push(x - n.x * thickness, y - n.y * thickness, z - n.z * thickness);
    normals.push(-n.x, -n.y, -n.z);
  }

  const backOffset = frontCount;
  const frontIndexCount = indices.length;
  for (let idx = 0; idx < frontIndexCount; idx += 3) {
    indices.push(indices[idx] + backOffset, indices[idx + 2] + backOffset, indices[idx + 1] + backOffset);
  }

  function connect(a, b) {
    indices.push(a, b, a + backOffset);
    indices.push(b, b + backOffset, a + backOffset);
  }

  for (let i = 0; i < segments; i++) {
    connect(i, i + 1);
    connect(segments * rowSize + i, segments * rowSize + i + 1);
  }
  for (let j = 0; j < segments; j++) {
    connect(j * rowSize, (j + 1) * rowSize);
    connect(j * rowSize + segments, (j + 1) * rowSize + segments);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Deterministic pseudo-random in [0,1) from an integer seed
// (avoids Math.random() so SSR/hydration stays stable).
function seededRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Dials every opacity source on the orb (plasma, veins, halo, panel edges,
// energy arcs, hot core) down to 70% uniformly, so it dims without
// changing the relative brightness balance between those parts.
const OPACITY_SCALE = 0.7;
// Separately dims the core's actual color/glow intensity (plasma shader
// output + hot center) down to 80% brightness.
const CORE_BRIGHTNESS_SCALE = 0.8;
const HOT_CORE_COLOR = "#" + new THREE.Color("#cfe9ff").multiplyScalar(CORE_BRIGHTNESS_SCALE).getHexString();


/* ============================================================
 * ORB
 * ============================================================ */

export default function TunnelOrb({
  position = [0, 0, 0],
  color = "#4fb4ff",
  proximityRange = 6,
  // 0 = fully closed sphere, 1 = fully open, core revealed.
  scrollProgress = null,
  // Lower = slower / dreamier opening.
  openSpeed = 1.6,
  radius = 0.85,
}) {
  const groupRef = useRef();
  const hotCoreRef = useRef();
  const plasmaMatRef = useRef();
  const veinRef = useRef();
  const haloRef = useRef();
  const haloMatRef = useRef();
  const lightRef = useRef();
  const panelGroupRefs = useRef([]);
  const arcRefs = useRef([]);

  const currentOpenRef = useRef(0);

  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const glowTexture = useMemo(() => makeGlowTexture(), []);
  const tintColor = useMemo(() => new THREE.Color(color), [color]);

  const plasmaUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: tintColor.clone() },
      uOpacity: { value: 0.9 * OPACITY_SCALE },
      uBrightness: { value: CORE_BRIGHTNESS_SCALE },
    }),
    [tintColor]
  );

  // Dark glossy clearcoat metal — the "wet plastic armor" look
  // from the reference. Shared across all panels.
  const panelMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x14181f,
        metalness: 0.92,
        roughness: 0.38,
        clearcoat: 0.85,
        clearcoatRoughness: 0.28,
        reflectivity: 0.5,
        emissive: tintColor.clone(),
        emissiveIntensity: 0.025,
        side: THREE.DoubleSide,
        envMapIntensity: 1.1,
      }),
    [tintColor]
  );

  const edgeMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#79c9f0",
        transparent: true,
        opacity: 0.75 * OPACITY_SCALE,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  // Build the 30 panels (6 faces x 5 regions) once.
  const panelsData = useMemo(() => {
    const list = [];
    let seed = 0;

    FACES.forEach((face) => {
      const normal = new THREE.Vector3(...face.normal);
      const uAxis = new THREE.Vector3(...face.uAxis);
      const vAxis = new THREE.Vector3(...face.vAxis);

      REGIONS.forEach((region) => {
        const [u0, u1] = region.u;
        const [v0, v1] = region.v;

        const pointFn = (s, t) => {
          const u = THREE.MathUtils.lerp(u0, u1, s);
          const v = THREE.MathUtils.lerp(v0, v1, t);
          const cubeP = normal
            .clone()
            .add(uAxis.clone().multiplyScalar(u))
            .add(vAxis.clone().multiplyScalar(v));
          return spherify(cubeP).multiplyScalar(radius);
        };

        const segments = 6;
        const geometry = createGridPanel(pointFn, segments, 0.06 * radius);

        // Average the front-face vertices to get this panel's
        // outward direction (used to fly it open).
        const posAttr = geometry.attributes.position;
        const frontCount = (segments + 1) * (segments + 1);
        const centroid = new THREE.Vector3();
        for (let i = 0; i < frontCount; i++) {
          centroid.x += posAttr.getX(i);
          centroid.y += posAttr.getY(i);
          centroid.z += posAttr.getZ(i);
        }
        centroid.divideScalar(frontCount);
        const direction = centroid.clone().normalize();

        seed += 1;
        const jitter = seededRandom(seed);

        list.push({
          geometry,
          direction,
          openDistance: 0.55 + jitter * 0.4,
          rotSpeed: 0.35 + jitter * 0.45,
          rotPhase: seededRandom(seed + 400) * Math.PI * 2,
          // Max rotation the panel tumbles to at full open — kept
          // small so it still reads as "one panel of a sphere",
          // not tumbling debris.
          rotAmplitude: 0.35 + jitter * 0.25,
          rotDir: new THREE.Vector3(
            seededRandom(seed + 100) > 0.5 ? 1 : -1,
            seededRandom(seed + 200) > 0.5 ? 1 : -1,
            seededRandom(seed + 300) > 0.5 ? 1 : -1
          ),
        });
      });
    });

    return list;
  }, [radius]);

  const arcGeometries = useMemo(() => {
    const build = (radiusVal) => {
      const points = [];
      for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        const angle = t * Math.PI * 2;
        const wobble = 1 + Math.sin(angle * 7) * 0.035 + Math.sin(angle * 13) * 0.02;
        const r = radiusVal * wobble;
        points.push(new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle * 2.2) * 0.08, Math.sin(angle) * r));
      }
      return new THREE.BufferGeometry().setFromPoints(points);
    };
    return [build(0.68), build(0.74), build(0.8)];
  }, []);

  const arcMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0x9cddff,
        transparent: true,
        opacity: 0.85 * OPACITY_SCALE,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  /* ==========================================================
   * ANIMATION
   * ========================================================== */

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const time = state.clock.elapsedTime;

    group.getWorldPosition(worldPosition);
    const distance = worldPosition.distanceTo(state.camera.position);
    const proximity = THREE.MathUtils.clamp(1 - distance / proximityRange, 0, 1);
    const proximityOpen = THREE.MathUtils.smoothstep(proximity, 0.05, 0.9);

    const target =
      scrollProgress === null || scrollProgress === undefined
        ? proximityOpen
        : THREE.MathUtils.clamp(scrollProgress, 0, 1);

    currentOpenRef.current = THREE.MathUtils.damp(currentOpenRef.current, target, openSpeed, delta);
    const openAmount = currentOpenRef.current;

    /* CORE */
    if (hotCoreRef.current) {
      const pulse = 1 + Math.sin(time * 2.4) * 0.08;
      const scale = 0.72 + openAmount * 0.5;
      hotCoreRef.current.scale.setScalar(scale * pulse);
    }

    /* PLASMA */
    if (plasmaMatRef.current) {
      plasmaMatRef.current.uniforms.uTime.value = time;
      plasmaMatRef.current.uniforms.uOpacity.value = (0.14 + openAmount * 0.28) * OPACITY_SCALE;
    }

    /* VEINS */
    if (veinRef.current) {
      veinRef.current.rotation.y += delta * (0.18 + openAmount * 0.45);
      veinRef.current.rotation.x += delta * 0.09;
      veinRef.current.material.opacity = (0.35 + openAmount * 0.55) * OPACITY_SCALE;
    }

    /* HALO */
    if (haloRef.current) {
      const haloScale = 2.4 + openAmount * 1.8;
      haloRef.current.scale.setScalar(haloScale * (1 + Math.sin(time * 1.5) * 0.06));
    }
    if (haloMatRef.current) {
      haloMatRef.current.opacity = (0.12 + openAmount * 0.28) * OPACITY_SCALE;
    }

    /* CORE LIGHT */
    if (lightRef.current) {
      lightRef.current.intensity = 0.25 + openAmount * 1.0;
    }

    /* PANEL MATERIAL — brighter emissive seams as it opens */
    panelMaterial.emissiveIntensity = 0.025 + openAmount * 0.075;
    edgeMaterial.opacity = (0.75 - openAmount * 0.2) * OPACITY_SCALE;

    /* PANELS */
    panelGroupRefs.current.forEach((panelGroup, index) => {
      if (!panelGroup) return;
      const data = panelsData[index];
      if (!data) return;

      const targetPos = data.direction.clone().multiplyScalar(openAmount * data.openDistance);
      panelGroup.position.lerp(targetPos, 1 - Math.pow(0.0001, delta));

      // Rotation is a direct function of openAmount + time, not an
      // accumulator — so it always eases back to exactly zero when
      // the shell closes, however many times you scroll up/down.
      const wobble = Math.sin(time * data.rotSpeed + data.rotPhase) * openAmount * data.rotAmplitude;
      panelGroup.rotation.x = wobble * data.rotDir.x;
      panelGroup.rotation.y = wobble * data.rotDir.y;
      panelGroup.rotation.z = wobble * data.rotDir.z;
    });

    /* ENERGY ARCS */
    arcRefs.current.forEach((arc, index) => {
      if (!arc) return;
      arc.rotation.x += delta * (0.25 + index * 0.12);
      arc.rotation.y += delta * (index % 2 === 0 ? 0.45 : -0.35);
      arc.rotation.z += delta * (index % 2 === 0 ? 0.22 : -0.18);
      arc.material.opacity =
        (0.12 + openAmount * 0.78) * (0.85 + Math.sin(time * 4 + index) * 0.15) * OPACITY_SCALE;
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {/* WHITE HOT CENTER */}
      <mesh ref={hotCoreRef}>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshBasicMaterial color={HOT_CORE_COLOR} transparent opacity={0.35 * OPACITY_SCALE} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* MAIN PLASMA SPHERE */}
      <mesh>
        <sphereGeometry args={[0.52, 64, 64]} />
        <shaderMaterial
          ref={plasmaMatRef}
          uniforms={plasmaUniforms}
          vertexShader={PLASMA_VERTEX}
          fragmentShader={PLASMA_FRAGMENT}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ELECTRIC INNER STRUCTURE */}
      <lineSegments ref={veinRef}>
        <icosahedronGeometry args={[0.55, 2]} />
        <lineBasicMaterial color="#ccefff" transparent opacity={0.8 * OPACITY_SCALE} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </lineSegments>

      {/* LARGE SOFT BLUE GLOW */}
      <sprite ref={haloRef} scale={[3, 3, 1]}>
        <spriteMaterial ref={haloMatRef} map={glowTexture} color={color} transparent opacity={0.9 * OPACITY_SCALE} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>

      {/* BLUE CORE LIGHT */}
      <pointLight ref={lightRef} color={color} intensity={0.55} distance={5} decay={2} />

      {/* KEY + RIM LIGHTS — give the clearcoat panels real
          highlights to catch, independent of the core glow */}
      <pointLight position={[2.5, 3, 2.5]} intensity={0.6} color="#e8f4ff" distance={8} decay={2} />
      <pointLight position={[-2.5, -1.5, -2]} intensity={0.35} color={color} distance={8} decay={2} />

      {/* ELECTRIC ORBITS */}
      <primitive
        ref={(el) => { if (el) arcRefs.current[0] = el; }}
        object={useMemo(() => new THREE.Line(arcGeometries[0], arcMaterial.clone()), [arcGeometries, arcMaterial])}
        rotation={[0.4, 0.2, 0.7]}
      />
      <primitive
        ref={(el) => { if (el) arcRefs.current[1] = el; }}
        object={useMemo(() => new THREE.Line(arcGeometries[1], arcMaterial.clone()), [arcGeometries, arcMaterial])}
        rotation={[1.4, 0.5, 0.2]}
      />
      <primitive
        ref={(el) => { if (el) arcRefs.current[2] = el; }}
        object={useMemo(() => new THREE.Line(arcGeometries[2], arcMaterial.clone()), [arcGeometries, arcMaterial])}
        rotation={[0.2, 1.3, 1.0]}
      />

      {/* SHELL — 30 panels, closed = seamless sphere, open = flies apart */}
      {panelsData.map((panel, index) => (
        <group key={index} ref={(el) => { if (el) panelGroupRefs.current[index] = el; }}>
          <mesh geometry={panel.geometry} material={panelMaterial} />
          <lineSegments geometry={new THREE.EdgesGeometry(panel.geometry, 1)} material={edgeMaterial} />
        </group>
      ))}
    </group>
  );
}