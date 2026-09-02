import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import "./ResumeModal.css";

const RESUME_PATH = "/Dheeraj_Sure_Resume.pdf";

// Reuses the same fixed, viewport-centered overlay pattern as
// ProjectModal (Projects.jsx) — click outside or Escape to close.
export default function ResumeModal({ onClose }) {
  // Most mobile browsers (iOS Safari, Chrome on Android, etc.) have no
  // built-in PDF renderer for <iframe> the way desktop browsers do — the
  // frame just loads blank or shows a broken-file icon. Rather than show
  // that dead-end on phones, detect narrow/coarse-pointer viewports and
  // swap in a simple "open/download" panel instead of the iframe.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    setIsMobile(mq.matches);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Lock page scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <motion.div
      className="resume-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <motion.div
        className="resume-modal-card"
        initial={{ opacity: 0, scale: 0.92, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, mass: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="resume-modal-head">
          <span className="resume-modal-title mono">Résumé — Dheeraj Sure</span>
          <div className="resume-modal-actions">
            <a
              className="resume-modal-download mono"
              href={RESUME_PATH}
              download="Dheeraj_Sure_Resume.pdf"
            >
              download ↓
            </a>
            <button
              type="button"
              className="resume-modal-close mono"
              onClick={onClose}
              aria-label="Close"
            >
              close ✕
            </button>
          </div>
        </div>

        <div className="resume-modal-body">
          {isMobile ? (
            // Phones generally can't render a PDF inline in an iframe, so
            // give a direct way to view/download it instead of a blank frame.
            <div className="resume-modal-fallback">
              <p className="mono">Tap below to view the résumé.</p>
              <a
                className="btn btn-primary"
                href={RESUME_PATH}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open résumé
              </a>
              <a
                className="btn btn-ghost"
                href={RESUME_PATH}
                download="Dheeraj_Sure_Resume.pdf"
              >
                Download PDF
              </a>
            </div>
          ) : (
            // Native browser PDF viewer — no extra dependency needed, and
            // it's already what every browser uses for PDFs opened
            // directly, so behavior here matches what users expect.
            <iframe
              src={RESUME_PATH}
              title="Dheeraj Sure — Résumé"
              className="resume-modal-frame"
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
