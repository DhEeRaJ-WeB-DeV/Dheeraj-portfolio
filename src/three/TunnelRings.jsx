import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "../theme.jsx";

// ---------------------------------------------------------------------------
// TunnelRings — glowing rings + accent "waypoint" orbs that recede into the
// depth of the existing UniverseBackground scene. As the page scrolls, the
// whole tunnel slides toward the camera (each ring holds a fixed local z),
// giving the flying-through-a-tunnel feeling from the reference effect,
// while sitting alongside FractalWaveField/FloatingParticles rather than
// replacing them. Colors follow the active theme (theme.colors) so it
// re-tints with the rest of the site instead of a baked-in rainbow.
//
// Waypoint orbs (TunnelOrb) reproduce the reference image: a crackling
// plasma sphere (fresnel + noise "veins" shader) dead center, wrapped by a
// ring of dark metallic armor blades. Each orb manages its own small
// useFrame — there are only a handful of them, so per-instance
// subscriptions are cheap, unlike the 26 rings which share one loop.
// ---------------------------------------------------------------------------

const IS_MOBILE = typeof window !== "undefined" && window.innerWidth < 768;

const RING_COUNT = IS_MOBILE ? 16 : 26;
const RING_SPACING = 2.6;
const RING_RADIUS = 9;
const TUNNEL_LENGTH = RING_COUNT * RING_SPACING;
const ORB_COUNT = IS_MOBILE ? 4 : 6;

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.7)");
  g.addColorStop(0.65, "rgba(255,255,255,0.18)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Evenly distribute N points on a unit sphere (Fibonacci sphere) — used to
// place the armor blades around each orb.
function fibonacciSphere(samples) {
  const points = [];
  const offset = 2 / samples;
  const increment = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < samples; i++) {
    const y = i * offset - 1 + offset / 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * increment;
    points.push(new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r));
  }
  return points;
}

// Shared across every orb instance (perf: one geometry, not one per blade).
const BLADE_GEOMETRY = new THREE.TorusGeometry(1.0, 0.16, 8, 16, Math.PI * 0.5);
const BLADE_DIRECTIONS = fibonacciSphere(8);

const PLASMA_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PLASMA_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vPos;
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
    vec3 viewDir = normalize(cameraPosition - vPos);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.2);
    float n = noise(vPos * 6.0 + uTime * 0.6);
    float veins = smoothstep(0.55, 0.62, n) - smoothstep(0.62, 0.7, n);
    veins += smoothstep(0.75, 0.8, noise(vPos * 10.0 - uTime * 0.4));
    float glow = fresnel * 0.6 + veins * 1.4;
    gl_FragColor = vec4(uColor * glow, glow * uOpacity);
  }
`;

function TunnelOrb({ position, color }) {
  const groupRef = useRef();
  const hotCoreRef = useRef();
  const plasmaMatRef = useRef();
  const veinRef = useRef();
  const haloMatRef = useRef();
  const haloRef = useRef();
  const lightRef = useRef();
  const petalRefs = useRef([]);
  const worldPos = useMemo(() => new THREE.Vector3(), []);

  const glowTexture = useMemo(() => makeGlowTexture(), []);
  const tintColor = useMemo(() => new THREE.Color(color), [color]);
  const plasmaUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: tintColor.clone() },
      uOpacity: { value: 0.9 },
    }),
    [tintColor]
  );
  const veinsGeometry = useMemo(
    () => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.72, 1)),
    []
  );
  const bladeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x15181d,
        metalness: 0.9,
        roughness: 0.32,
        emissive: tintColor.clone(),
        emissiveIntensity: 0.08,
      }),
    [tintColor]
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const t = state.clock.elapsedTime;

    group.getWorldPosition(worldPos);
    const dist = worldPos.distanceTo(state.camera.position);
    const proximity = THREE.MathUtils.clamp(1 - dist / 9, 0, 1);
    const pulse = 1 + Math.sin(t * 1.8) * 0.06 * proximity;

    if (hotCoreRef.current) {
      hotCoreRef.current.scale.setScalar(pulse * (0.7 + proximity * 0.6));
    }
    if (plasmaMatRef.current) {
      plasmaMatRef.current.uniforms.uTime.value = t;
      plasmaMatRef.current.uniforms.uOpacity.value = 0.25 + proximity * 0.75;
    }
    if (veinRef.current) {
      veinRef.current.rotation.y += delta * (0.15 + proximity * 0.35);
      veinRef.current.rotation.x += delta * 0.08;
      veinRef.current.material.opacity =
        (0.25 + proximity * 0.55) * (0.85 + 0.15 * Math.sin(t * 11 + position[2]));
    }
    if (haloMatRef.current) {
      haloMatRef.current.opacity = 0.2 + proximity * 0.75;
    }
    if (haloRef.current) {
      haloRef.current.scale.setScalar((3.2 + proximity * 1.8) * (1 + Math.sin(t * 1.2) * 0.05));
    }
    if (lightRef.current) {
      lightRef.current.intensity = 0.5 + proximity * 2.4;
    }
    petalRefs.current.forEach((p, idx) => {
      if (!p) return;
      const floatAmt = 0.1 * Math.sin(t * 1.3 + idx * 0.9) * (0.4 + proximity * 0.6);
      const dist2 = p.userData.baseDist + floatAmt;
      p.position.copy(p.userData.dir).multiplyScalar(dist2);
      p.rotation.z += delta * 0.06;
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Bright white-hot center */}
      <mesh ref={hotCoreRef}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Crackling plasma shell — fresnel rim + animated noise veins */}
      <mesh>
        <sphereGeometry args={[0.85, 48, 48]} />
        <shaderMaterial
          ref={plasmaMatRef}
          args={[
            {
              uniforms: plasmaUniforms,
              vertexShader: PLASMA_VERTEX,
              fragmentShader: PLASMA_FRAGMENT,
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            },
          ]}
        />
      </mesh>

      {/* Tangled crackling wire veins over the core */}
      <lineSegments ref={veinRef} geometry={veinsGeometry}>
        <lineBasicMaterial
          color="#dff3ff"
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>

      {/* Soft outer halo */}
      <sprite ref={haloRef} scale={[4.2, 4.2, 1]}>
        <spriteMaterial
          ref={haloMatRef}
          map={glowTexture}
          color={color}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      {/* Local light so the metal shell picks up the core's color */}
      <pointLight ref={lightRef} color={color} intensity={1.2} distance={6} decay={2} />

      {/* Dark metallic armor shell — curved blade petals floating around the core */}
      {BLADE_DIRECTIONS.map((dir, idx) => {
        const baseDist = 1.3;
        return (
          <group
            key={idx}
            ref={(el) => {
              if (!el) return;
              el.userData.dir = dir;
              el.userData.baseDist = baseDist;
              el.position.copy(dir).multiplyScalar(baseDist);
              el.lookAt(0, 0, 0);
              petalRefs.current[idx] = el;
            }}
          >
            <mesh geometry={BLADE_GEOMETRY} material={bladeMaterial} rotation={[Math.PI / 2, 0, 0.35]} />
            <mesh
              geometry={BLADE_GEOMETRY}
              material={bladeMaterial}
              rotation={[Math.PI / 2, 0, Math.PI - 0.35]}
            />
          </group>
        );
      })}
    </group>
  );
}

// Scene-wide lighting for the orbs' metallic armor shells (MeshStandardMaterial
// needs real lights — everything else in this scene is unlit/additive and is
// unaffected by these). Rendered once, outside the scroll-driven tunnel
// group, so it stays fixed regardless of tunnel movement/parallax.
export function TunnelLighting() {
  return (
    <>
      <hemisphereLight args={["#9fd6ff", "#050608", 0.55]} />
      <directionalLight color="#cfe8ff" intensity={0.8} position={[-4, 3, 6]} />
      <directionalLight color="#3a6fb0" intensity={0.4} position={[3, -2, -4]} />
    </>
  );
}

export default function TunnelRings({ scrollRef, pointerRef }) {
  const groupRef = useRef();
  const ringRefs = useRef([]);
  const haloRefs = useRef([]);
  const smoothProgress = useRef(0);

  const { theme } = useTheme();

  const ringData = useMemo(
    () =>
      new Array(RING_COUNT).fill(0).map((_, i) => ({
        z: -i * RING_SPACING,
        radius: RING_RADIUS + Math.sin(i * 0.4) * 0.6,
        rotSpeed: (Math.random() - 0.5) * 0.12,
        baseOpacity: 0.1 + Math.random() * 0.16,
        phase: Math.random() * Math.PI * 2,
      })),
    []
  );

  const orbData = useMemo(
    () =>
      new Array(ORB_COUNT).fill(0).map((_, i) => ({
        z: -((i + 1) / (ORB_COUNT + 1)) * TUNNEL_LENGTH,
        angle: (i / ORB_COUNT) * Math.PI * 2,
      })),
    []
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const t = state.clock.elapsedTime;
    const scrollProgress = scrollRef?.current ?? 0;

    // Ease scroll so the tunnel glides rather than jumps with each scroll tick.
    const target = scrollProgress * (TUNNEL_LENGTH - RING_SPACING * 4);
    smoothProgress.current += (target - smoothProgress.current) * Math.min(1, delta * 4);
    group.position.z = smoothProgress.current;

    // Gentle parallax tilt so the tunnel isn't perfectly static under the cursor.
    if (pointerRef) {
      group.rotation.y += (pointerRef.current.x * 0.06 - group.rotation.y) * 0.03;
      group.rotation.x += (-pointerRef.current.y * 0.04 - group.rotation.x) * 0.03;
    }

    const cameraZ = state.camera.position.z;
    const tint = theme.colors[0];

    ringData.forEach((r, i) => {
      const ring = ringRefs.current[i];
      const halo = haloRefs.current[i];
      if (!ring || !halo) return;

      ring.rotation.z += r.rotSpeed * delta;
      halo.rotation.z = ring.rotation.z;

      const worldZ = group.position.z + r.z;
      const dist = Math.abs(worldZ - cameraZ);
      const depthFade = THREE.MathUtils.clamp(1 - dist / (TUNNEL_LENGTH * 0.6), 0, 1);
      const flicker = 0.8 + 0.2 * Math.sin(t * 1.4 + r.phase);

      ring.material.opacity = r.baseOpacity * depthFade * flicker;
      halo.material.opacity = ring.material.opacity * 0.4;
      ring.material.color.set(tint);
      halo.material.color.set(tint);
    });
  });

  return (
    <group ref={groupRef} position={[0, 1.6, 4]}>
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
              opacity={0.04}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {orbData.map((o, i) => {
        const color = theme.colors[i % theme.colors.length];
        // Waypoint orbs sit dead-center on the tunnel axis (x=0, y=0 locally)
        // so the plasma sphere reads front-and-center as you pass through it,
        // matching the reference image rather than being offset to one side.
        return <TunnelOrb key={i} position={[0, 0, o.z]} color={color} />;
      })}
    </group>
  );
}
