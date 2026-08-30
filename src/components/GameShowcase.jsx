import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import titleImg from "../assets/sword-quest-title.webp";
import playButtonImg from "../assets/play-button.webp";
import brazierImg from "../assets/brazier-flame.webp";
import bannerImg from "../assets/chaos-banner.webp";
import CloudTransition from "./CloudTransition";
import "./GameShowcase.css";

// GameShowcase — replaces the old SkillsScene (floating 3D skill sphere)
// in the Contact section with a link to a playable project: Sword Quest, a
// browser game that lives as a fully static site under /game (its own
// index.html, js/, assets/ — no build step, copied into the build output
// by vite-plugin-static-copy).
//
// The game is loaded into an iframe inside a full-viewport overlay rather
// than a new tab, so that the "Play" click's user-gesture can be used to
// request fullscreen (the Fullscreen API requires a direct user gesture —
// a gesture in this tab can't be handed off to a separately opened tab).
const GAME_URL = "/game/index.html?autoplay=1";

function requestFullscreen(el) {
  const fn =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen;
  if (fn) {
    try {
      const result = fn.call(el);
      if (result && result.catch) result.catch(() => {});
    } catch {
      // Ignore — some browsers reject if not a "trusted" gesture; the game
      // still opens, just not fullscreen, and the in-game ⛶ button can
      // still be used to enter fullscreen manually.
    }
  }
}

function exitFullscreen() {
  const fn =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen;
  if (fn && document.fullscreenElement) {
    try {
      fn.call(document);
    } catch {
      // ignore
    }
  }
}

function BrazierCluster({ mirrored }) {
  return (
    <div
      className={
        "game-showcase-cluster" + (mirrored ? " game-showcase-cluster-mirrored" : "")
      }
      aria-hidden="true"
    >
      <img
        className="game-showcase-cluster-brazier"
        src={brazierImg}
        alt=""
        draggable="false"
      />
    </div>
  );
}

// The two chaos-banner flags — now hung to either side of the "SWORD QUEST"
// title, dropped a little lower than it so they read as flanking pennants
// rather than sitting in a strict row.
function TitleBanner({ mirrored }) {
  return (
    <img
      className={
        "game-showcase-title-banner" +
        (mirrored ? " game-showcase-title-banner-mirrored" : "")
      }
      src={bannerImg}
      alt=""
      draggable="false"
      aria-hidden="true"
    />
  );
}

export default function GameShowcase() {
  const [open, setOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // "idle" | "covering" | "clearing" — drives the CloudTransition overlay.
  // Clouds roll in first; once they've fully closed, whatever's underneath
  // (the game mounting, or unmounting back to the page) gets swapped while
  // hidden, then the same clouds roll back out to reveal it.
  const [transitionPhase, setTransitionPhase] = useState("idle");
  const pendingActionRef = useRef(null);
  const overlayRef = useRef(null);
  const iframeRef = useRef(null);

  const handlePlay = (e) => {
    e.preventDefault();
    if (transitionPhase !== "idle") return;
    // Fire fullscreen synchronously off the same click gesture — has to
    // happen here, before any state/animation delay, or browsers will
    // reject it as not being a direct user gesture anymore.
    requestFullscreen(document.documentElement);
    pendingActionRef.current = "open";
    setTransitionPhase("covering");
  };

  const handleClose = () => {
    if (transitionPhase !== "idle") return;
    pendingActionRef.current = "close";
    setTransitionPhase("covering");
  };

  const handleCloudCoverComplete = () => {
    // Screen is fully clouded over now — safe to swap what's underneath.
    if (pendingActionRef.current === "open") {
      setOpen(true);
    } else if (pendingActionRef.current === "close") {
      exitFullscreen();
      setOpen(false);
    }
    setTransitionPhase("clearing");
  };

  const handleCloudClearComplete = () => {
    pendingActionRef.current = null;
    setTransitionPhase("idle");
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      exitFullscreen();
    } else {
      requestFullscreen(overlayRef.current || document.documentElement);
    }
  };

  const focusGame = () => {
    // The game listens for keydown on its own window, so it only sees key
    // presses (like Enter to skip the intro) once the iframe itself has
    // focus — otherwise they go to the parent page and do nothing.
    iframeRef.current?.contentWindow?.focus();
  };

  useEffect(() => {
    // Registered unconditionally (not gated on `open`) so it's already
    // listening for the fullscreenchange fired by the very first
    // requestFullscreen() call in handlePlay — that call happens before
    // `open` becomes true, so a listener that only attaches once `open`
    // flips misses that first event entirely and isFullscreen gets stuck
    // showing the wrong icon/state.
    //
    // Exiting fullscreen (Esc, F11, etc.) should just drop back to a normal
    // window with the game still open — it shouldn't close the game. Only
    // the ✕ button closes it.
    const onFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
      if (open) focusGame();
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Give the iframe focus once it's up so keyboard input (including
    // Enter to skip the intro) reaches the game right away.
    const focusTimer = setTimeout(focusGame, 150);
    return () => clearTimeout(focusTimer);
  }, [open]);

  return (
    <motion.div
      className="game-showcase"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55 }}
    >
      <div className="game-showcase-title-row">
        <TitleBanner />
        <img
          className="game-showcase-title"
          src={titleImg}
          alt="Sword Quest"
          draggable="false"
        />
        <TitleBanner mirrored />
      </div>

      <p className="game-showcase-tagline">Got bored? Try playing this game.</p>

      <div className="game-showcase-flanked">
        <BrazierCluster />

        <a
          href={GAME_URL}
          className="game-showcase-play"
          onClick={handlePlay}
          aria-label="Play"
        >
          <span className="game-showcase-play-glow" aria-hidden="true" />
          <img
            className="game-showcase-play-img"
            src={playButtonImg}
            alt="Play"
            draggable="false"
          />
        </a>

        <BrazierCluster mirrored />
      </div>

      {open && (
        <div className="game-showcase-overlay" ref={overlayRef}>
          <div className="game-showcase-controls">
            <button
              type="button"
              className="game-showcase-icon-btn"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? "⤢" : "⛶"}
            </button>
            <button
              type="button"
              className="game-showcase-icon-btn"
              onClick={handleClose}
              aria-label="Close game"
              title="Close game"
            >
              ✕
            </button>
          </div>
          <iframe
            ref={iframeRef}
            title="Sword Quest"
            src={GAME_URL}
            className="game-showcase-frame"
            allow="fullscreen; autoplay"
            allowFullScreen
            onLoad={focusGame}
          />
        </div>
      )}

      {transitionPhase !== "idle" && (
        <CloudTransition
          phase={transitionPhase}
          onCoverComplete={handleCloudCoverComplete}
          onClearComplete={handleCloudClearComplete}
        />
      )}
    </motion.div>
  );
}
