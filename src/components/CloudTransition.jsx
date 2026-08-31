import { useEffect, useRef } from "react";
import "./CloudTransition.css";

// Fallback timers, in case the browser skips the cloud-wash `animationend`
// event. This has happened in practice: the transition kicks off at the
// exact moment the parent calls requestFullscreen() (for the "covering"
// phase), and the reflow/compositor work the Fullscreen API does can eat
// the animation frame that `animationend` depends on — so it just never
// fires. Without a fallback, onCoverComplete()/onClearComplete() (which is
// what actually mounts/unmounts the game) never runs, and the whole thing
// gets stuck behind the clouds forever. Values are the longest-running
// animation for each phase (cloud-puff roll, which starts last due to its
// stagger delay) plus a small buffer.
const COVER_FALLBACK_MS = 1200; // 0.85s roll-in + up to 0.2s stagger + buffer
const CLEAR_FALLBACK_MS = 1300; // 0.95s roll-out + up to 0.14s stagger + buffer

// Full-viewport "roll of clouds" used to mask the jump between the
// portfolio page and the Sword Quest game. Two phases:
//   "covering" — clouds roll in from the edges and swallow the whole
//                screen. When they've fully closed, the parent mounts
//                (or unmounts) whatever's underneath.
//   "clearing" — the same clouds drift up and away, revealing whatever
//                the parent just swapped in underneath them.
// The parent drives the phase and gets notified via onCoverComplete /
// onClearComplete (fired off the wash layer's own animationend — backed
// by a JS fallback timer below in case that event doesn't fire).
//
// Visual style: dark, storm-lit cloud bank (near-black with a bright
// diffused core) rather than a flat white/blue fade. The turbulent,
// torn-edge look comes from two SVG filters defined once below:
//   #storm-clouds   — feTurbulence rendered straight to grayscale and
//                      gamma-shaped into billowing dark/light clumps;
//                      used as a full-bleed texture layer.
//   #storm-displace — feDisplacementMap that warps each puff's clean
//                      circular edge into a wispy, irregular outline.
// Filter cost is deliberately kept low (few feTurbulence octaves, no
// SMIL <animate> driving the noise field — that used to run on every
// frame for as long as the filter was mounted). This whole overlay is
// only ever on screen for ~1-1.3s right as the game iframe mounts and
// its intro video starts decoding; a heavy per-frame SVG filter
// recompute sitting on the main thread at that exact moment was
// stealing frames from the video and made it stutter/skip frames
// right as the clouds cleared.
export default function CloudTransition({ phase, onCoverComplete, onClearComplete }) {
  // Guards against the fallback timer AND the real animationend both firing
  // (or the fallback firing twice across a re-render) — whichever gets
  // there first "wins" and the other is a no-op.
  const firedRef = useRef(false);

  useEffect(() => {
    if (phase === "idle") return undefined;
    firedRef.current = false;
    const complete = phase === "covering" ? onCoverComplete : onClearComplete;
    const timer = setTimeout(
      () => {
        if (firedRef.current) return;
        firedRef.current = true;
        complete();
      },
      phase === "covering" ? COVER_FALLBACK_MS : CLEAR_FALLBACK_MS
    );
    return () => clearTimeout(timer);
    // phase is really the only thing that should re-arm this; the
    // callbacks are stable-enough handlers from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "idle") return null;

  const covering = phase === "covering";

  return (
    <div
      className={"cloud-transition" + (covering ? " is-covering" : " is-clearing")}
      aria-hidden="true"
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter
            id="storm-clouds"
            filterUnits="userSpaceOnUse"
            x="-2000"
            y="-2000"
            width="4000"
            height="4000"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.006 0.009"
              numOctaves={3}
              seed={7}
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0.33 0.33 0.33 0 0
                      0.33 0.33 0.33 0 0
                      0.33 0.33 0.33 0 0
                      0    0    0    1 0"
              result="gray"
            />
            <feComponentTransfer in="gray" result="shaped">
              <feFuncR type="gamma" amplitude="1" exponent="1.8" offset="0" />
              <feFuncG type="gamma" amplitude="1" exponent="1.8" offset="0" />
              <feFuncB type="gamma" amplitude="1" exponent="1.8" offset="0" />
            </feComponentTransfer>
          </filter>
          <filter
            id="storm-clouds-fine"
            filterUnits="userSpaceOnUse"
            x="-2000"
            y="-2000"
            width="4000"
            height="4000"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018 0.026"
              numOctaves={3}
              seed={21}
              result="noise2"
            />
            <feColorMatrix
              in="noise2"
              type="matrix"
              values="0.33 0.33 0.33 0 0
                      0.33 0.33 0.33 0 0
                      0.33 0.33 0.33 0 0
                      0    0    0    1 0"
              result="gray2"
            />
            <feComponentTransfer in="gray2">
              <feFuncR type="gamma" amplitude="1" exponent="1.5" offset="0" />
              <feFuncG type="gamma" amplitude="1" exponent="1.5" offset="0" />
              <feFuncB type="gamma" amplitude="1" exponent="1.5" offset="0" />
            </feComponentTransfer>
          </filter>
          <filter id="storm-displace" x="-60%" y="-60%" width="220%" height="220%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.010"
              numOctaves={2}
              seed={3}
              result="warp"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="warp"
              scale="110"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div
        className="cloud-wash"
        onAnimationEnd={(e) => {
          if (e.animationName !== "cloud-wash-in" && e.animationName !== "cloud-wash-out") {
            return;
          }
          if (firedRef.current) return;
          firedRef.current = true;
          if (covering) onCoverComplete();
          else onClearComplete();
        }}
      />
      <div className="cloud-storm-texture" />
      <div className="cloud-storm-texture cloud-storm-texture-fine" />
      <div className="cloud-puff cloud-puff-1" />
      <div className="cloud-puff cloud-puff-2" />
      <div className="cloud-puff cloud-puff-3" />
      <div className="cloud-puff cloud-puff-4" />
      <div className="cloud-puff cloud-puff-5" />
      <div className="cloud-puff cloud-puff-6" />
    </div>
  );
}
