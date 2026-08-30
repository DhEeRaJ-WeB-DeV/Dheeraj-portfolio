import { useRef, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { profile } from "../data/resume";
import profilePhoto from "../assets/profile.png";
import PhotoReveal from "./PhotoReveal.jsx";
import "./Hero.css";

// Lazy-loaded: the resume PDF viewer (iframe + modal chrome) is only
// needed once someone actually clicks "View Resume", so there's no
// reason to ship or parse it as part of the initial Hero bundle.
const ResumeModal = lazy(() => import("./ResumeModal"));

const METHODS = ["GET", "GET", "POST", "GET"];

function randomLatency() {
  return (Math.random() * 60 + 4).toFixed(0);
}

// A single animated character. It plays the staggered entrance once on
// mount (duration 0.5s + its own delay), then flips to a fast, no-delay
// transition for everything after — otherwise every hover-out re-used
// the entrance transition (delay included), so a character deep into
// the headline would sit through its *entire* original stagger delay
// again before settling back from the hover state.
function Char({ char, delay }) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSettled(true), (delay + 0.5) * 1000);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <motion.span
      className="hero-char"
      style={{ display: "inline-block" }}
      initial={{ opacity: 0, y: 26, rotateX: -50 }}
      animate={{
        opacity: 1,
        y: 0,
        rotateX: 0,
        transition: settled
          ? { duration: 0.2, ease: "easeOut" }
          : { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] },
      }}
      whileHover={{
        y: -6,
        scale: 1.15,
        color: "var(--accent-frontend)",
        transition: { duration: 0.2, ease: "easeOut" },
      }}
    >
      {char}
    </motion.span>
  );
}

// Splits the text into word-runs (plus separate space runs), each in
// its own inline-block wrapper. Every letter still animates
// individually via <Char>, but wrapping each word as one unbreakable
// inline-block keeps the browser from line-wrapping in the middle of a
// word — which was happening because every single-letter span was its
// own inline-block, and adjacent inline-blocks are valid break points
// by default regardless of whether a space actually sits between them.
function AnimatedChars({ text, className = "", delay = 0, stagger = 0.018 }) {
  const chars = Array.from(text);
  const words = [];
  let current = [];
  chars.forEach((char, i) => {
    if (char === " ") {
      if (current.length) words.push(current);
      words.push([{ char: " ", i }]);
      current = [];
    } else {
      current.push({ char, i });
    }
  });
  if (current.length) words.push(current);

  return (
    <span className={className} style={{ display: "inline-block" }}>
      {words.map((word, wi) => (
        <span key={wi} style={{ display: "inline-block", whiteSpace: "pre" }}>
          {word.map(({ char, i }) => (
            <Char key={i} char={char} delay={delay + i * stagger} />
          ))}
        </span>
      ))}
    </span>
  );
}

export default function Hero() {
  const [log, setLog] = useState([
    { id: 0, text: "$ connecting to dheeraj.dev/api/graph ...", tone: "dim" },
    { id: 1, text: "$ 14 services online — link established", tone: "ok" },
  ]);
  const [resumeOpen, setResumeOpen] = useState(false);

  const idRef = useRef(2);
  const spawnApi = useRef(null);
  const sectionRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const canvasScale = useTransform(scrollYProgress, [0, 1], [1, 1.35]);
  const canvasOpacity = useTransform(scrollYProgress, [0, 0.75, 1], [1, 0.35, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const pushLog = useCallback((line, tone = "dim") => {
    setLog((prev) => {
      const next = [...prev, { id: idRef.current++, text: line, tone }];
      return next.slice(-6);
    });
  }, []);

  const handleSelect = useCallback(
    (node) => {
      spawnApi.current?.(node.id);
      pushLog(`$ POST /api/connect { target: "${node.id}" } · 201 Created`, "accent");
    },
    [pushLog]
  );

  // Build up staggered start-delays so each headline segment picks up
  // right where the previous one's letters finished animating in.
  const charStagger = 0.018;
  let cursor = 0.35;
  const nextDelay = (text) => {
    const d = cursor;
    cursor += text.length * charStagger;
    return d;
  };

  const d1 = nextDelay("Hi, I'm ");
  const d2 = nextDelay(profile.name);
  const d3 = nextDelay(".");
  const d4 = nextDelay("I ship backend systems");
  const d5 = nextDelay("that don't fall over.");
  const blurbDelay = cursor + 0.15;

  return (
    <section className="hero" id="top" ref={sectionRef}>
      <motion.div
        className="hero-canvas"
        style={{ scale: canvasScale, opacity: canvasOpacity }}
      >
      </motion.div>

      {/* dark gradient scrim so headline/body text stays legible over
          the busy grid + wave background regardless of what's behind it */}
      <div className="hero-scrim" />
      {/* fades the very bottom of the section into the page background
          color so it blends into the next section instead of ending in
          a hard dark line */}
      <div className="hero-blend-fade" />

      <motion.div
        className="hero-overlay container"
        style={{ y: textY, opacity: textOpacity }}
      >
        <div className="hero-columns">
          <div className="hero-copy">
            <motion.div
              className="hero-status"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="status-dot" />
              <span className="mono">AVAILABLE FOR HIRE</span>
            </motion.div>

            <div>
              <motion.p
                className="hero-eyebrow mono"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                {profile.role} · {profile.focus}
              </motion.p>

              <h1 className="hero-title" style={{ perspective: 600 }}>
              <AnimatedChars text="Hi, I'm " delay={d1} stagger={charStagger} />
              <AnimatedChars
                text={profile.name}
                delay={d2}
                stagger={charStagger}
                className="hero-title-accent"
              />
              <AnimatedChars text="." delay={d3} stagger={charStagger} />

              <br />

              <AnimatedChars
                text="I build things. Break things. Then build them better."
                delay={d4}
                stagger={charStagger}
              />
            </h1>

              <motion.p
                className="hero-blurb"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: blurbDelay }}
              >
                {profile.blurb}
              </motion.p>
            </div>

            <motion.div
              className="hero-actions"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: blurbDelay + 0.15 }}
            >
              <button type="button" className="btn btn-primary" onClick={() => setResumeOpen(true)}>
                View Resume
              </button>
              <a className="btn btn-ghost" href="#contact">
                Get in touch
              </a>
            </motion.div>
          </div>

          <PhotoReveal src={profilePhoto} alt={profile.name} />
        </div>
      </motion.div>

      <div className="hero-scroll-cue mono">SCROLL <span>↓</span></div>

      <AnimatePresence>
        {resumeOpen && (
          <Suspense fallback={null}>
            <ResumeModal onClose={() => setResumeOpen(false)} />
          </Suspense>
        )}
      </AnimatePresence>
    </section>
  );
}