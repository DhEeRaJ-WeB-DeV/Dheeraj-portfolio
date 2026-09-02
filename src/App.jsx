import { memo, useEffect, useRef, useState } from "react";
import ScrollTunnelBackground from "./three/ScrollTunnelBackground";
import ScrollTrees from "./three/ScrollTrees";
import CursorJellyfish from "./three/CursorJellyfish";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import About from "./components/About";
import Skills from "./components/Skills";
import Experience from "./components/Experience";
import Projects from "./components/Projects";
import Education from "./components/Education";
import Contact from "./components/Contact";
import Footer from "./components/Footer";

// A second tap has to land within this long of the first, and this close
// to it on screen, to count as a "double tap" rather than two unrelated
// taps. Generous enough to forgive an imprecise finger on mobile, tight
// enough that it won't fire from two ordinary, separate clicks.
const DOUBLE_TAP_MAX_DELAY_MS = 350;
const DOUBLE_TAP_MAX_DISTANCE_PX = 40;

const StableScrollTunnelBackground = memo(ScrollTunnelBackground);
const StableScrollTrees = memo(ScrollTrees);
const StableNav = memo(Nav);
const StableHero = memo(Hero);
const StableAbout = memo(About);
const StableSkills = memo(Skills);
const StableExperience = memo(Experience);
const StableProjects = memo(Projects);
const StableEducation = memo(Education);
const StableContact = memo(Contact);
const StableFooter = memo(Footer);

export default function App() {
  const [jellyfish, setJellyfish] = useState({ active: false, origin: null });
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  function handleToggleJellyfish(origin) {
    setJellyfish((prev) =>
      prev.active ? { active: false, origin: origin || prev.origin } : { active: true, origin }
    );
  }

  // Double-tap (or double-click) anywhere on the page dismisses the
  // jellyfish back into its nav icon — using whatever `origin` it was
  // last summoned from, same as clicking the nav icon again. Only
  // listens while the jellyfish is actually out, so this adds no
  // overhead the rest of the time. The nav jellyfish button itself is
  // excluded since a single tap there already toggles it; without this
  // exclusion a quick double-tap on the icon would end up toggling twice
  // and fighting its own click handler.
  useEffect(() => {
    if (!jellyfish.active) return undefined;

    function onPointerDown(e) {
      if (e.target.closest?.(".nav-jellyfish-btn")) return;
      const now = Date.now();
      const last = lastTapRef.current;
      const dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
      if (now - last.time < DOUBLE_TAP_MAX_DELAY_MS && dist < DOUBLE_TAP_MAX_DISTANCE_PX) {
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        handleToggleJellyfish(jellyfish.origin);
      } else {
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
      }
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [jellyfish.active, jellyfish.origin]);

  return (
    <>
      <StableScrollTunnelBackground />
      <StableScrollTrees />
      <CursorJellyfish active={jellyfish.active} origin={jellyfish.origin} />

      <StableNav jellyfishActive={jellyfish.active} onToggleJellyfish={handleToggleJellyfish} />
      <main>
        <StableHero />
        <StableAbout />
        <StableSkills />
        <StableExperience />
        <StableProjects />
        <StableEducation />
        <StableContact />
      </main>
      <StableFooter />
    </>
  );
}

