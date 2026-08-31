import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { detectDeviceTier } from "./utils/deviceTier";

// perf.jsx — site-wide "how much graphics work can this machine afford"
// context. Every heavy 3D/particle component reads its tier from usePerf()
// and scales ring/particle counts, DPR, antialiasing, and postprocessing
// accordingly (see ScrollTunnelBackground.jsx, TreeModel3D.jsx,
// CursorJellyfish.jsx, ProjectsDnaScene.jsx, and the embedded game via
// GameShowcase.jsx's ?gfx= URL param).
//
// Two passes decide the tier:
//   1. detectDeviceTier() runs synchronously on first render (GPU string,
//      core count, memory, mobile signals) so the very first frame already
//      renders at the right quality — no flash of full-quality graphics
//      that then drops a frame later.
//   2. A short live FPS probe runs after mount and drops the tier by one
//      step if the page is actually struggling in practice, catching cases
//      the heuristic can't see up front (an old GPU driver, battery saver
//      throttling, a "high-end" laptop that's actually busy with other
//      tabs). It only ever downgrades, and only once.
//
// `?gfx=low|medium|high` on the page URL forces a tier and skips the probe
// entirely — for testing each quality level on any machine.

const TIERS = ["low", "medium", "high"];
const PerfContext = createContext({ tier: "medium" });

function tierFromUrl() {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("gfx");
  return TIERS.includes(v) ? v : null;
}

function downgrade(tier) {
  const i = TIERS.indexOf(tier);
  return TIERS[Math.max(0, i - 1)];
}

// How long to sample frame rate for, and how bad it has to be to trigger
// the one-step downgrade. Deliberately forgiving — this is a safety net for
// clearly-struggling machines, not a tuner fighting the heuristic on every
// borderline case.
const PROBE_DURATION_MS = 4000;
const PROBE_MIN_FPS = 40;

export function PerfProvider({ children }) {
  const forced = useMemo(tierFromUrl, []);
  const [tier, setTier] = useState(() => forced || detectDeviceTier());
  const probedRef = useRef(false);

  useEffect(() => {
    if (forced || probedRef.current) return; // forced tier (testing) skips the live probe
    probedRef.current = true;

    let raf;
    let frames = 0;
    const start = performance.now();

    function tick(now) {
      frames += 1;
      if (now - start < PROBE_DURATION_MS) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const fps = (frames * 1000) / (now - start);
      if (fps < PROBE_MIN_FPS) {
        setTier((t) => downgrade(t));
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [forced]);

  const value = useMemo(() => ({ tier }), [tier]);

  return <PerfContext.Provider value={value}>{children}</PerfContext.Provider>;
}

export function usePerf() {
  return useContext(PerfContext);
}
