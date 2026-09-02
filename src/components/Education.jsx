import { motion } from "framer-motion";
import { education } from "../data/resume";
import "./Education.css";

export default function Education() {
  return (
    <section className="section education" id="education">
      <div className="container">
        <p className="eyebrow">05 · Education</p>
        <h2 className="section-title">Education</h2>

        <div className="edu-list">
          {education.map((e, i) => (
            <motion.div
              key={e.degree}
              className="edu-row"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
            >
              <span className="edu-period mono">{e.period}</span>
              <div className="edu-main">
                <h3 className="edu-degree">{e.degree}</h3>
                <p className="edu-org">{e.org}</p>
              </div>
              <span className="tag edu-detail">{e.detail}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
