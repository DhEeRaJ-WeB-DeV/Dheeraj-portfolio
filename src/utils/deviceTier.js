// deviceTier.js — one-shot heuristic guess at device graphics capability,
// bucketed into "low" | "medium" | "high". Used to scale how much 3D/particle
// work the site does (ring/particle counts, DPR, antialiasing, Bloom
// postprocessing, dust-cloud density, and the embedded game's own effects)
// so the same site stays smooth on an old integrated-graphics laptop instead
// of just being tuned for whatever machine built it.
//
// Every signal here is best-effort and can be missing or misleading on its
// own (a masked GPU string, a browser that doesn't expose deviceMemory, a
// powerful laptop throttled by battery saver) — that's why this is combined
// into a small score rather than trusted on any single signal, and why
// perf.jsx layers a short live FPS probe on top of this as a correction
// pass once the page is actually running.

const LOW_GPU_KEYWORDS = [
  "swiftshader",
  "llvmpipe",
  "software",
  "microsoft basic render",
  "intel(r) hd graphics 3",
  "intel(r) hd graphics 4",
  "intel hd graphics 3",
  "intel hd graphics 4",
  "mali-4",
  "mali-t7",
  "mali-t6",
  "adreno 3",
  "adreno 4",
  "adreno 5",
  "powervr sgx",
  "gma ",
];

const HIGH_GPU_KEYWORDS = [
  "nvidia",
  "geforce",
  "rtx",
  "gtx",
  "radeon",
  "rx 5",
  "rx 6",
  "rx 7",
  "apple m1",
  "apple m2",
  "apple m3",
  "apple m4",
  "adreno 7",
  "adreno 8",
  "mali-g7",
  "mali-g8",
  "intel(r) iris xe",
  "intel iris xe",
  "intel(r) arc",
];

function getGpuRenderer() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return typeof renderer === "string" ? renderer.toLowerCase() : null;
  } catch {
    return null;
  }
}

function scoreGpu(renderer) {
  if (!renderer) return 0;
  if (LOW_GPU_KEYWORDS.some((k) => renderer.includes(k))) return -1;
  if (HIGH_GPU_KEYWORDS.some((k) => renderer.includes(k))) return 1;
  return 0;
}

// Returns "low" | "medium" | "high". Safe to call during render (no
// side effects beyond a throwaway offscreen canvas) but only needs to
// run once per load — perf.jsx calls this exactly once and then holds
// the result in context.
export function detectDeviceTier() {
  if (typeof window === "undefined") return "medium";

  const renderer = getGpuRenderer();

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = !!conn?.saveData;
  const slowConn = !!conn?.effectiveType && /2g|3g/.test(conn.effectiveType);
  if (saveData || slowConn) return "low";

  // No WebGL at all means none of the 3D-heavy rendering can run at full
  // quality regardless of anything else this machine might have going for it.
  if (!renderer) return "low";

  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory; // undefined on Firefox/Safari — skipped when absent
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches;
  const narrowViewport = window.innerWidth < 768;
  const isMobileClass = coarsePointer || narrowViewport;

  let score = scoreGpu(renderer);
  score += cores >= 8 ? 1 : cores <= 2 ? -1 : 0;
  if (memory !== undefined) {
    score += memory >= 8 ? 1 : memory <= 2 ? -1 : 0;
  }
  if (isMobileClass) score -= 1;

  if (score <= -2) return "low";
  if (score >= 2) return "high";
  return "medium";
}
