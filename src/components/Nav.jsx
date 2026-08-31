import { useEffect, useRef, useState } from "react";
import NavJellyfishIcon from "../three/NavJellyfishIcon.jsx";
import "./Nav.css";

// How long the click "kick" (a quick compress-and-spring-back on the icon
// itself) runs for, in ms — see Nav.css. The pulse ring's own duration
// lives entirely in its CSS animation.
const KICK_DURATION_MS = 260;

const LINKS = [
  { href: "#about", label: "about" },
  { href: "#skills", label: "skills" },
  { href: "#experience", label: "experience" },
  { href: "#projects", label: "projects" },
  { href: "#education", label: "education" },
  { href: "#contact", label: "contact" },
];

export default function Nav({ jellyfishActive, onToggleJellyfish }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Bumped on every click so a fresh <span key={pulseKey}> remounts and
  // its CSS animation restarts, in either direction (launch or return).
  const [pulseKey, setPulseKey] = useState(0);
  const [kicking, setKicking] = useState(false);
  const jellyfishBtnRef = useRef(null);
  const kickTimerRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    let nextScrolled = window.scrollY > 24;
    const onScroll = () => {
      nextScrolled = window.scrollY > 24;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = (e) => setReduceMotion(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => () => clearTimeout(kickTimerRef.current), []);

  function handleJellyfishClick() {
    const rect = jellyfishBtnRef.current?.getBoundingClientRect();
    const origin = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    onToggleJellyfish?.(origin);

    // The icon itself stays put and docked — it's the cursor jellyfish
    // (see CursorJellyfish.jsx) that actually detaches and swims off, or
    // dissolves back, using this same origin point. The icon just reacts
    // at the moment of the handoff: a quick compress-and-spring "kick"
    // plus an expanding ring, so it reads as pushing the creature off (or
    // receiving it back) rather than being a static, disconnected button.
    setPulseKey((k) => k + 1);
    setKicking(true);
    clearTimeout(kickTimerRef.current);
    kickTimerRef.current = setTimeout(() => setKicking(false), KICK_DURATION_MS);
  }

  return (
    <header className={`nav ${scrolled ? "nav-scrolled" : ""}`}>
      <div className="container nav-inner">
        <div className="nav-jellyfish-wrap">
          <button
            ref={jellyfishBtnRef}
            type="button"
            className={`nav-jellyfish-btn ${jellyfishActive ? "is-active" : ""}`}
            aria-label={jellyfishActive ? "Dismiss the cursor jellyfish" : "Summon a jellyfish to follow your cursor"}
            aria-pressed={jellyfishActive}
            onClick={handleJellyfishClick}
          >
            <span className={`nav-jellyfish-icon-wrap ${kicking ? "is-kicking" : ""}`}>
              <NavJellyfishIcon reduceMotion={reduceMotion} />
            </span>
          </button>
          {pulseKey > 0 && <span key={pulseKey} className="nav-jellyfish-pulse" aria-hidden="true" />}
        </div>

        <a href="#top" className="nav-logo mono">
          <span className="nav-logo-bracket">{"<"}</span>
          dheeraj.sure
          <span className="nav-logo-bracket">{" />"}</span>
        </a>

        <nav className="nav-links mono">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <a className="nav-cta mono" href="#contact">
          say hello
        </a>

        <button
          className={`nav-burger ${open ? "is-open" : ""}`}
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>
      </div>

      {open && (
        <div className="nav-mobile mono">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="#contact" onClick={() => setOpen(false)}>
            say hello
          </a>
        </div>
      )}
    </header>
  );
}
