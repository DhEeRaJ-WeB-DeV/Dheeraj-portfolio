import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { projects } from "../data/resume";
import useTilt from "../hooks/useTilt";
import { useTheme } from "../theme.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import useIsMobileView from "../hooks/useIsMobileView";
import { FiFolder } from "react-icons/fi";
import "./Projects.css";
import "./MobileCards.css";

// Mirrors the isNarrow/mobile check used elsewhere (ProjectsDnaScene,
// ScrollTunnelBackground, etc.) — under 768px or a coarse (touch)
// pointer counts as mobile/tablet.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.innerWidth < 768 ||
      (window.matchMedia?.("(pointer: coarse)").matches ?? false)
    );
  });
  useEffect(() => {
    const onResize = () =>
      setIsMobile(
        window.innerWidth < 768 ||
          (window.matchMedia?.("(pointer: coarse)").matches ?? false)
      );
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

// Both pull in three.js and are already gated behind `sectionInView` at
// render time (see usage below), but they were still statically imported
// here, which put three.js in the initial bundle regardless of whether
// the user ever scrolls to Projects. Lazy-loading defers fetching/parsing
// that code until the section actually comes into view.
const FractalWaveCard = lazy(() => import("../three/FractalWaveCard"));
const ProjectsDnaScene = lazy(() => import("./ProjectsDnaScene"));

// The whole spring/helix drops + unwinds into place the first time the
// section scrolls into view — one assembly move instead of a per-card one.
const assemblyVariants = {
  hidden: { opacity: 0, scale: 0.75, rotateX: 22, y: 40 },
  visible: { opacity: 1, scale: 1, rotateX: 0, y: 0 },
};

const NUMBER_WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
];

// Spells out small counts ("Three coiled panels") the way the original
// copy did, and just falls back to the numeral once resume.js grows past
// what reads naturally as a word ("12 coiled panels").
function countLabel(n) {
  return NUMBER_WORDS[n] ?? String(n);
}

// Pulls the challenge write-up straight from resume.js instead of a
// hardcoded docker/deploy simulation — same animated log component,
// different source of lines.
function buildChallengeLog(project) {
  return project.challenges ?? [];
}

function DeployLog({ lines }) {
  return (
    <div className="proj-log mono">
      {lines.map((line, i) => (
        <motion.div
          key={line}
          className="proj-log-line"
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, delay: i * 0.12 }}
        >
          {line}
        </motion.div>
      ))}
      <motion.span
        className="proj-log-cursor"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </div>
  );
}

// A small closed tile that lives on the 3D ring. No detail lives here
// any more — it's just a name plate. Clicking it opens the full project
// in a fixed, viewport-centered modal (see ProjectModal), so no matter
// whether this tile is the top, middle, or bottom loop of the spring,
// the detail view always lands in the same place: dead center of the
// screen.
function ProjectTile({ p, index, onOpen, sectionInView, cardHeight, isMobile }) {
  const tilt = useTilt({ max: 6, scale: 1.015 });
  const [hovered, setHovered] = useState(false);
  const [glow, setGlow] = useState({ x: 50, y: 50 });
  const { theme } = useTheme();
  // The card wave now follows the active theme color directly, instead of
  // each project's own cat-{accent} category color.
  const accentColor = theme.colors[0];

  const handleMouseMove = (e) => {
    tilt.onMouseMove(e);
    const rect = e.currentTarget.getBoundingClientRect();
    setGlow({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <motion.div
      className={`proj-card cat-${p.accent}`}
      ref={tilt.ref}
      style={{
        overflow: "hidden",
        isolation: "isolate",
        transformStyle: "preserve-3d",
        ...(cardHeight ? { minHeight: cardHeight } : null),
      }}
      whileTap={{ scale: 0.985 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={(e) => {
        tilt.onMouseLeave(e);
        setHovered(false);
      }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open ${p.name} details`}
    >
      <span
        className="proj-panel-bg"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          borderRadius: "inherit",
          background: "linear-gradient(160deg, rgba(24,29,42,0.97), rgba(9,11,17,0.97))",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)",
          pointerEvents: "none",
        }}
      />

      {/* Shared canvas per tile — mounted only while the section is in
          view. Killing the WebGL render loop when it's off-screen.
          Skipped on mobile/tablet entirely: each of these is its own
          raw WebGL context (three per section, on top of the always-on
          tunnel background, the DNA scene canvas, and the other 3D
          layers elsewhere on the page), and phones enforce a low limit
          on how many WebGL contexts can be live at once. Going over
          that limit was crashing the tile (an uncaught error, since
          nothing recovers from a failed context creation) and taking
          the whole page down with it — the "background turns white"
          bug. The plain panel/spot-light layers already give the card
          its look without this, so it's a purely decorative loss on
          mobile, not a functional one. Desktop is untouched. Also
          wrapped in ErrorBoundary as a second line of defense, so even
          a context loss that slips through only drops this one card's
          effect instead of the page. */}
      {sectionInView && !isMobile && (
        <div className="proj-card-wave">
          <ErrorBoundary>
            <Suspense fallback={null}>
              <FractalWaveCard color={accentColor} mouse={glow} hovered={hovered} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      <span
        className="proj-spot"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          borderRadius: "inherit",
          background: `radial-gradient(260px circle at ${glow.x}% ${glow.y}%, var(--card-accent) 0%, transparent 65%)`,
          opacity: hovered ? 0.55 : 0,
          transition: "opacity 0.25s ease",
          pointerEvents: "none",
        }}
      />

      <div className="proj-face">
        <span className="proj-index mono">0{index + 1}</span>
        <h3 className="proj-face-name">{p.name}</h3>
        <span className="proj-face-hint mono">click to open →</span>
      </div>
    </motion.div>
  );
}

// The full project detail. Always rendered position: fixed and centered
// in the viewport — deliberately NOT nested inside the spinning 3D ring,
// so it never inherits the ring's rotateY/translateZ or a slot's vertical
// offset. That's what previously made the bottom card's detail land low
// on the page and the top card's land high: it was expanding in place,
// inside a slot that itself was offset up or down. Rendering the modal
// as a sibling of the ring sidesteps that entirely — one fixed window,
// always in the same spot, regardless of which loop of the spring was
// clicked.
function ProjectModal({ p, index, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const log = buildChallengeLog(p);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="proj-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <motion.div
        className={`proj-modal-card cat-${p.accent}`}
        initial={{ opacity: 0, scale: 0.92, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, mass: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="proj-modal-close mono" onClick={onClose} aria-label="Close">
          close ✕
        </button>

        <div className="proj-content">
          <div className="proj-top">
            <span className="proj-index mono">0{index + 1}</span>
            <span className="proj-status mono">
              <span className="proj-status-dot" />
              {p.status}
            </span>
          </div>

          <h3 className="proj-name proj-name--lg">{p.name}</h3>
          <p className="proj-tagline">{p.tagline}</p>

          <ul className="proj-points">
            {p.points.map((pt) => (
              <li key={pt}>{pt}</li>
            ))}
          </ul>

          <div className="proj-stack">
            {p.stack.map((s) => (
              <span key={s} className="tag">
                {s}
              </span>
            ))}
          </div>

          <button
            type="button"
            className="proj-expand-btn mono"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? "hide the challenge ↑" : "view the challenge ↓"}
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="log"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="proj-log-wrap"
              >
                <DeployLog lines={log} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="proj-links mono">
            {p.links.github && (
              <a href={p.links.github} target="_blank" rel="noreferrer">
                GitHub ↗
              </a>
            )}
            {p.links.demo && (
              <a href={p.links.demo} target="_blank" rel="noreferrer">
                Live Demo ↗
              </a>
            )}
            {p.links.docker && (
              <a href={p.links.docker} target="_blank" rel="noreferrer">
                Docker Hub ↗
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Clamp helper: keeps a value between [min, max].
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Fluidly interpolates every ring measurement (card size, radius, drop
// spacing, perspective depth, track height) from a phone-width baseline
// up to the original desktop numbers, keyed off the viewport width. The
// ring never falls back to a flat, non-rotating stack — it just gets a
// smaller stage to spin in — so the exact same 3D helix/spring behavior
// (drag, auto-rotate, scroll-wheel, click-to-open) is present at every
// breakpoint, phone through desktop.
function computeSpiralDims(vw, n) {
  // 0 at a small-phone width, 1 at (or past) the section's own max-width.
  const t = clamp((vw - 360) / (1180 - 360), 0, 1);
  const lerp = (min, max) => Math.round(min + t * (max - min));

  const cardWidth = lerp(148, 240);
  const cardHeight = lerp(158, 210);
  // Desktop's 480 is solved so a 240px-wide card's near edge reaches the
  // container edge under a 1700px perspective — scale both down together
  // so smaller viewports keep the same relative swing instead of the
  // ring overflowing (or shrinking to nothing) at odd widths.
  const radius = lerp(112, 480);
  const verticalSpread = lerp(92, 150);
  const perspective = lerp(820, 1700);
  const extraLoops = Math.max(0, n - 3);
  const trackHeight = lerp(420, 640) + extraLoops * Math.round(verticalSpread * 0.65);

  return { cardWidth, cardHeight, radius, verticalSpread, perspective, trackHeight };
}

function useSpiralDims(n) {
  const [dims, setDims] = useState(() =>
    computeSpiralDims(typeof window !== "undefined" ? window.innerWidth : 1180, n)
  );

  useEffect(() => {
    const onResize = () => setDims(computeSpiralDims(window.innerWidth, n));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [n]);

  return dims;
}

// A 3D helix/spring carousel: the three project tiles sit one-above-
// the-other (top / middle / bottom) around a shared vertical axis, each
// rotated 120° apart like loops of a coil. Drag, scroll, or just let it
// auto-turn — same idea as the Skills ring, stacked into a spring
// instead of a flat circle, and tuned to spin a touch faster.
//
// Performance note: rotation is driven entirely by refs + direct DOM
// style writes inside a single requestAnimationFrame loop (same pattern
// as useTilt). Earlier this called setState every frame, which re-
// rendered the whole tree — including the three WebGL wave canvases —
// 60x/sec and was the source of the jank. React only re-renders here
// when a tile is actually opened or closed (dims changing on resize is
// the only other, infrequent, re-render).
function ProjectsSpiral({ sectionInView, activeIndex, setActiveIndex }) {
  const n = projects.length;
  const angleStep = 360 / n;
  const isMobile = useIsMobile();
  const { cardWidth, cardHeight, radius, verticalSpread, perspective, trackHeight } =
    useSpiralDims(n);
  // top / middle / bottom for 3 items; falls back gracefully for other counts
  const mid = (n - 1) / 2;
  const yOffsets = projects.map((_, i) => Math.round((i - mid) * verticalSpread));

  const rotationRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  // Auto-rotate speed — matched to SkillsCarousel's 0.05deg/frame, then
  // nudged a little faster since this ring only has 3 stops to cycle
  // through (SkillsCarousel has more, so the same speed reads slower
  // per-card here).
  const AUTO_SPEED = 0.06;
  const velocityRef = useRef(AUTO_SPEED);
  const idleTimerRef = useRef(null);
  const trackRef = useRef(null);
  const ringRef = useRef(null);
  const slotRefs = useRef([]);

  const activeIndexRef = useRef(null);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Writes the current rotation + per-tile facing/opacity/z-index
  // straight to the DOM. No setState, so it never triggers React
  // reconciliation of the tile subtree.
  const paint = useCallback(() => {
    const rotation = rotationRef.current;
    if (ringRef.current) {
      ringRef.current.style.transform = `rotateY(${rotation}deg)`;
    }
    const active = activeIndexRef.current;
    for (let i = 0; i < n; i++) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const cardAngle = i * angleStep + rotation;
      const norm = ((cardAngle % 360) + 540) % 360 - 180;
      const facing = Math.cos((norm * Math.PI) / 180); // 1 = front, -1 = back
      const isActive = active === i;
      const isBack = facing < -0.2 && !isActive;
      // the open tile dims too (not just the others) — its real content
      // now lives in the fixed modal, so the ring copy is just a marker
      el.style.opacity = active === null ? Math.max(0.35, facing) : isActive ? 0.35 : 0.15;
      el.style.pointerEvents = isBack || isActive ? "none" : "auto";
      el.style.zIndex = isActive ? 50 : Math.round(facing * 10) + 5;
    }
  }, [angleStep, n]);

  // Single animation loop: free auto-rotate, drag stays put (pointer
  // handlers mutate the ref directly), and when a tile is active it
  // eases the ring toward that tile's front-facing angle.
  useEffect(() => {
    let raf;
    const tick = () => {
      const active = activeIndexRef.current;
      if (active !== null) {
        const target = -active * angleStep;
        const current = rotationRef.current;
        const delta = (((target - current + 540) % 360) + 360) % 360 - 180;
        rotationRef.current = Math.abs(delta) < 0.05 ? target : current + delta * 0.18;
      } else if (!draggingRef.current) {
        rotationRef.current += velocityRef.current;
      }
      paint();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paint, angleStep]);

  const onPointerDown = (e) => {
    if (activeIndexRef.current !== null) return; // don't spin while reading a card
    draggingRef.current = true;
    lastXRef.current = e.clientX;
    clearTimeout(idleTimerRef.current);
    velocityRef.current = 0;
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    rotationRef.current += dx * 0.35;
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      velocityRef.current = AUTO_SPEED;
    }, 900);
  };

  const onWheel = (e) => {
    if (activeIndexRef.current !== null) return;
    e.preventDefault();
    clearTimeout(idleTimerRef.current);
    velocityRef.current = 0;
    rotationRef.current -= e.deltaY * 0.15;
    idleTimerRef.current = setTimeout(() => {
      velocityRef.current = AUTO_SPEED;
    }, 900);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="proj-spiral-wrap">
      <div
        className="proj-spiral-track"
        ref={trackRef}
        style={{ perspective, height: trackHeight }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {/* WebGL canvas, sibling of the ring rather than a child of it —
            see ProjectsDnaScene.jsx for why. Reads rotationRef directly
            every frame, same source of truth the ring's own rAF loop
            uses, so the helix/web turn in exact lockstep with the cards.
            Kept mounted (and spinning) at every viewport size — the
            radius/yOffsets it receives already track the same fluid
            dims driving the CSS ring, so the two stay in lockstep down
            to phone widths instead of the helix being hidden there. */}
        {sectionInView && (
          <ErrorBoundary resetKey={sectionInView}>
            <Suspense fallback={null}>
              <ProjectsDnaScene
                rotationRef={rotationRef}
                cardCount={n}
                angleStep={angleStep}
                cardYOffsets={yOffsets}
                radius={radius}
              />
            </Suspense>
          </ErrorBoundary>
        )}
        <div className="proj-spiral-ring" ref={ringRef} style={{ width: cardWidth }}>
          {projects.map((p, i) => (
            <div
              key={p.id}
              ref={(el) => (slotRefs.current[i] = el)}
              className="proj-spiral-slot"
              style={{
                width: cardWidth,
                marginLeft: -cardWidth / 2,
                marginTop: -cardHeight / 2,
                transform: `translateY(${yOffsets[i]}px) rotateY(${i * angleStep}deg) translateZ(${radius}px)`,
              }}
            >
              <ProjectTile
                p={p}
                index={i}
                sectionInView={sectionInView}
                cardHeight={cardHeight}
                isMobile={isMobile}
                onOpen={() => setActiveIndex(i)}
              />
            </div>
          ))}
        </div>
      </div>
      <p className="proj-spiral-tip mono">drag or scroll to turn the spring · click a card to open it</p>
    </div>
  );
}

// Mobile-only replacement for the 3D spring: a plain stacked list of
// cards (no WebGL, no drag/spin, no entrance animation). Tapping a card
// opens the same detail modal the desktop tiles open.
const MOBILE_STACK_PREVIEW = 4;

function MobileProjectCards({ onOpen }) {
  return (
    <div className="m-card-list">
      {projects.map((p, i) => {
        const shown = p.stack.slice(0, MOBILE_STACK_PREVIEW);
        const extra = p.stack.length - shown.length;
        return (
          <button
            key={p.id}
            type="button"
            className="m-card"
            onClick={() => onOpen(i)}
            aria-label={`Open ${p.name} details`}
          >
            <div className="m-card-head">
              <span className="m-card-icon" aria-hidden="true">
                <FiFolder />
              </span>
              <span className="m-status">{p.status}</span>
            </div>
            <h3 className="m-card-title">{p.name}</h3>
            <p className="m-card-text">{p.tagline}</p>
            <div className="m-chips">
              {shown.map((s) => (
                <span key={s} className="m-chip">
                  {s}
                </span>
              ))}
              {extra > 0 && <span className="m-chip">+{extra}</span>}
            </div>
            <span className="m-card-more">View details</span>
          </button>
        );
      })}
    </div>
  );
}

export default function Projects() {
  const sectionRef = useRef(null);
  const sectionInView = useInView(sectionRef, { once: false, margin: "-80px 0px -80px 0px" });
  const [activeIndex, setActiveIndex] = useState(null);
  const isMobileView = useIsMobileView();

  // Derived from resume.js instead of a hardcoded "Three coiled panels" —
  // stays correct as projects are added to (or removed from) that file.
  const panelCount = projects.length;
  const panelWord = panelCount === 1 ? "panel" : "panels";

  // Lock page scroll while the fixed modal is open.
  useEffect(() => {
    if (activeIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeIndex]);

  return (
    <section className="section projects" id="projects" ref={sectionRef}>
      <div className="container">
        <div className="section-head-3d">
          <div>
            <p className="eyebrow">04 · Projects</p>
            <h2 className="section-title">Featured Projects</h2>
            <p className="section-sub">
              {countLabel(panelCount)} projects I've built and shipped — click one to open it and read the build.
            </p>
          </div>
          <div className="section-3d-canvas"></div>
        </div>

        {isMobileView ? (
          <MobileProjectCards onOpen={setActiveIndex} />
        ) : (
          <motion.div
            variants={assemblyVariants}
            initial="hidden"
            animate={sectionInView ? "visible" : "hidden"}
            transition={{ type: "spring", stiffness: 70, damping: 16, mass: 1 }}
          >
            <ProjectsSpiral
              sectionInView={sectionInView}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
            />
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {activeIndex !== null && (
          <ProjectModal
            key={activeIndex}
            p={projects[activeIndex]}
            index={activeIndex}
            onClose={() => setActiveIndex(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
