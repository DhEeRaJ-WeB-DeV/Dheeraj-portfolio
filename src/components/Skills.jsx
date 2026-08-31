import { lazy, Suspense } from "react";
import useInViewOnce from "../hooks/useInViewOnce";
import "./Skills.css";

const SkillsCarousel = lazy(() => import("../three/SkillsCarousel"));

export default function Skills() {
  const [sectionRef, inView] = useInViewOnce({ rootMargin: "400px 0px" });

  return (
    <section ref={sectionRef} className="section skills" id="skills">
      <div className="container">
        <div className="section-head-3d">
          <p className="eyebrow">02 · Stack</p>
          <h2 className="section-title">Skills & Technologies</h2>
          <p className="section-sub">
            The languages, frameworks, and tools I use regularly — drag to spin it around.
          </p>
        </div>

        {inView ? (
          <Suspense fallback={<div className="skills-carousel" aria-hidden="true" style={{ height: 144 }} />} >
            <SkillsCarousel />
          </Suspense>
        ) : (
          <div className="skills-carousel" aria-hidden="true" style={{ height: 144 }} />
        )}
      </div>
    </section>
  );
}