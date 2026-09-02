import { useRef, useState, useLayoutEffect } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { experience } from "../data/resume";
import "./Experience.css";

function ExperienceNode({ nodeRef, threshold, scrollYProgress }) {
  const t = threshold ?? 0;
  const range = [Math.max(t - 0.04, 0), t];

  const borderColor = useTransform(
    scrollYProgress,
    range,
    ["var(--border-soft)", "var(--accent-infra)"]
  );
  const background = useTransform(
    scrollYProgress,
    range,
    ["transparent", "var(--accent-infra)"]
  );
  const scale = useTransform(scrollYProgress, range, [1, 1.25]);
  const glow = useTransform(
    scrollYProgress,
    range,
    ["0 0 0px rgba(0,0,0,0)", "0 0 10px var(--accent-infra)"]
  );

  return (
    <motion.span
      ref={nodeRef}
      className="exp-node"
      style={{ borderColor, background, scale, boxShadow: glow }}
    />
  );
}

export default function Experience() {
  const listRef = useRef(null);
  const nodeRefs = useRef([]);
  const [thresholds, setThresholds] = useState([]);

  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start center", "end center"],
  });

  const fillScaleY = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 30,
    restDelta: 0.001,
  });

  // measure each node's real position inside the track so the
  // light-up syncs with where the fill line actually is, not an
  // assumed even split across items
  useLayoutEffect(() => {
    const measure = () => {
      const list = listRef.current;
      if (!list) return;
      const listRect = list.getBoundingClientRect();
      const listHeight = listRect.height || 1;

      const next = nodeRefs.current.map((el) => {
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        const centerY = r.top + r.height / 2 - listRect.top;
        return Math.min(Math.max(centerY / listHeight, 0), 1);
      });
      setThresholds(next);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <section className="section experience" id="experience">
      <div className="container">
        <div className="section-head-3d">
          <div>
            <p className="eyebrow">03 · Experience</p>
            <h2 className="section-title">Work Experience</h2>
          </div>
        </div>

        <div className="exp-list" ref={listRef}>
          <div className="exp-track" />
          <motion.div className="exp-track-fill" style={{ scaleY: fillScaleY }} />

          {experience.map((job, i) => (
            <div className="exp-item" key={job.org}>
              <div className="exp-rail">
                <ExperienceNode
                  nodeRef={(el) => (nodeRefs.current[i] = el)}
                  threshold={thresholds[i]}
                  scrollYProgress={scrollYProgress}
                />
              </div>
              <div className="exp-body">
                <span className="exp-period mono">{job.period}</span>
                <div className="exp-head">
                  <h3 className="exp-role">{job.role}</h3>
                  <p className="exp-org">{job.org}</p>
                </div>
                <ul className="exp-points">
                  {job.points.map((p, pi) => (
                    <motion.li
                      key={p}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{
                        duration: 0.4,
                        delay: i * 0.1 + 0.4 + pi * 0.08,
                      }}
                    >
                      <span className="exp-bullet">•</span>
                      {p}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}