import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { skillGroups } from "../data/resume";
import { skillDetails } from "../data/skillDetails";
import { iconUrl, iconSlug, monogram } from "../utils/skillIcons";
import "./SkillsCarousel.css";

// Drag distance (px) below which a pointerdown+up is treated as a click
// rather than a carousel drag.
const CLICK_DRAG_THRESHOLD = 6;

// Clamp helper: keeps a value between [min, max].
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Card size shrinks fluidly on narrower viewports so more of the ring
// stays visible at once instead of the fixed 100px cards crowding the
// edges and clipping mid-card on a phone-width screen. Interpolates
// from a small-phone floor up to the original desktop size (100×120).
function computeCarouselDims(vw) {
  const t = clamp((vw - 340) / (860 - 340), 0, 1);
  const cardWidth = Math.round(66 + t * (100 - 66));
  const cardHeight = Math.round(80 + t * (120 - 80));
  return { cardWidth, cardHeight };
}

function useCarouselDims() {
  const [dims, setDims] = useState(() =>
    computeCarouselDims(typeof window !== "undefined" ? window.innerWidth : 860)
  );
  useEffect(() => {
    const onResize = () => setDims(computeCarouselDims(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return dims;
}

// Fixed, viewport-centered detail card — same pattern as the project
// modal (Projects.jsx). Rendering it as a sibling of the spinning ring,
// at a real DOM size instead of a scaled-up 3D-flip face, is what keeps
// the text crisp: a CSS `scale()` transform enlarges the *paint* but not
// the *layout*, so wrapped text still measures itself against the tiny
// 100px card and clips. A real modal has no such mismatch.
function SkillModal({ skill, index, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="skill-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <motion.div
        className={`skill-modal-card cat-${skill.category}`}
        initial={{ opacity: 0, scale: 0.92, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, mass: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="skill-modal-close mono" onClick={onClose} aria-label="Close">
          close ✕
        </button>

        <div className="skill-modal-top">
          <span className="skill-modal-index mono">{String(index + 1).padStart(2, "0")}</span>
          {iconUrl(skill.item) ? (
            <img className="skill-modal-icon" src={iconUrl(skill.item)} alt="" loading="lazy" />
          ) : (
            <span className="skill-modal-monogram">{monogram(skill.item)}</span>
          )}
        </div>

        <h3 className="skill-modal-title">{skill.item}</h3>
        <p className="skill-modal-detail">{skillDetails[skill.item] || skill.group}</p>

        <span className="skill-modal-tag">{skill.group}</span>
      </motion.div>
    </motion.div>
  );
}

export default function SkillsCarousel() {
  const items = skillGroups.flatMap((g) =>
    g.items.map((item) => ({ item, category: g.category, group: g.label }))
  );
  const n = items.length;
  const angleStep = 360 / n;

  // radius large enough that neighboring cards don't overlap — derived
  // from the fluid cardWidth below so the ring's spacing shrinks in
  // lockstep with the cards on narrower viewports.
  const { cardWidth, cardHeight } = useCarouselDims();
  const radius = Math.round(cardWidth / 2 / Math.tan(Math.PI / n)) + 24;

  const rotationRef = useRef(0);
  const ringRef = useRef(null);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const dragDistRef = useRef(0);
  const velocityRef = useRef(0.05); // gentle auto-rotate
  const idleTimerRef = useRef(null);
  const trackRef = useRef(null);

  // which card (by index) currently has its detail modal open
  const [openIndex, setOpenIndex] = useState(null);

  // Keep high-frequency rotation out of React state. Updating state every
  // frame caused the entire carousel tree to re-render continuously.
  const applyRotation = useCallback((deg) => {
    rotationRef.current = deg;
    if (ringRef.current) ringRef.current.style.transform = `rotateY(${deg}deg)`;
  }, []);

  // Only animate while the carousel is near the viewport. This avoids a
  // permanent RAF loop when the user is elsewhere on the page or the tab is hidden.
  useEffect(() => {
    if (openIndex !== null) return undefined;
    const el = trackRef.current;
    if (!el) return undefined;

    let raf = 0;
    let visible = false;
    let hidden = document.hidden;
    const tick = () => {
      raf = 0;
      if (!visible || hidden) return;
      if (!draggingRef.current) applyRotation(rotationRef.current + velocityRef.current);
      raf = requestAnimationFrame(tick);
    };
    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !hidden && !raf) raf = requestAnimationFrame(tick);
        }, { rootMargin: "120px 0px" })
      : null;
    if (observer) observer.observe(el);
    else visible = true;

    const onVisibilityChange = () => {
      hidden = document.hidden;
      if (!hidden && visible && !raf) raf = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (visible && !hidden) raf = requestAnimationFrame(tick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [applyRotation, openIndex]);

  // lock page scroll while the fixed modal is open
  useEffect(() => {
    if (openIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openIndex]);

  const onPointerDown = (e) => {
    if (openIndex !== null) return;
    draggingRef.current = true;
    lastXRef.current = e.clientX;
    dragDistRef.current = 0;
    clearTimeout(idleTimerRef.current);
    velocityRef.current = 0;
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    dragDistRef.current += Math.abs(dx);
    applyRotation(rotationRef.current + dx * 0.35);
  };

  const endDrag = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      velocityRef.current = 0.05; // resume gentle auto-rotate after idling
    }, 900);
  };

  const onWheel = (e) => {
    if (openIndex !== null) return;
    e.preventDefault();
    clearTimeout(idleTimerRef.current);
    velocityRef.current = 0;
    applyRotation(rotationRef.current - e.deltaY * 0.15);
    idleTimerRef.current = setTimeout(() => {
      velocityRef.current = 0.05;
    }, 900);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCardClick = (i) => {
    // ignore clicks that were actually part of a drag gesture
    if (dragDistRef.current > CLICK_DRAG_THRESHOLD) return;
    setOpenIndex(i);
  };

  return (
    <div className="skills-carousel" style={{ height: cardHeight + 24 }}>
      <div
        className="skills-carousel-track"
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <div
          className="skills-carousel-ring"
          ref={ringRef}
          style={{
            width: cardWidth,
            height: cardHeight,
            transform: `rotateY(${rotationRef.current}deg)`,
            willChange: "transform",
          }}
        >
          {items.map((skill, i) => {
            return (
              <div
                key={skill.item}
                className={`carousel-card cat-${skill.category}`}
                style={{
                  transform: `rotateY(${i * angleStep}deg) translateZ(${radius}px)`,
                }}
                onClick={() => handleCardClick(i)}
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick(i);
                  }
                }}
              >
                {iconUrl(skill.item) ? (
                  <img src={iconUrl(skill.item)} alt={skill.item} loading="lazy" />
                ) : (
                  <span className="carousel-card-monogram">{monogram(skill.item)}</span>
                )}
                <span>{skill.item}</span>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {openIndex !== null && (
          <SkillModal
            key={openIndex}
            skill={items[openIndex]}
            index={openIndex}
            onClose={() => setOpenIndex(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
