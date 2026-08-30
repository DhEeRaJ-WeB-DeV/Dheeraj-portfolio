import * as THREE from "three";

// Shared by particle systems that recolor by depth/height (FractalWaveField,
// DnaHelix) — derives a small "near / far / crest" ramp from a single theme
// tint so they always match the active color theme instead of a baked-in
// green. Returned as raw {r,g,b} components (not THREE.Color instances) so
// per-frame loops can read them without allocating objects.
export function deriveDepthPalette(tintHex, { farMix = 0.055, crestMix = 0.55 } = {}) {
  const near = new THREE.Color(tintHex);
  const far = near.clone().multiplyScalar(farMix);
  const crest = near.clone().lerp(new THREE.Color("#ffffff"), crestMix);
  return {
    near: { r: near.r, g: near.g, b: near.b },
    far: { r: far.r, g: far.g, b: far.b },
    crest: { r: crest.r, g: crest.g, b: crest.b },
  };
}
