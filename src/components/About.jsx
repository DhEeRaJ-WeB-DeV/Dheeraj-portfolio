import { motion } from "framer-motion";
import "./About.css";

const FACTS = [
  { k: "15+", v: "production REST APIs shipped" },
  { k: "CI/CD", v: "automated build, test & deployment workflows" },
  { k: "10+", v: "technologies used across projects" },
  { k: "8.0 CGPA", v: "B.E. Robotics & AI, 2026" },
];

export default function About() {
  return (
    <section className="section about" id="about">
      <div className="container about-grid">
        <div>
          <p className="eyebrow">01 · About</p>
          <h2 className="section-title">
            A Curious Engineer<br />who solves problems end to end.
          </h2>
          <p className="section-sub">
          I’m a Software Engineer who enjoys turning ideas into things people can actually use. 
          I like figuring out how things work, solving problems along the way,
           and building projects from the ground up.
          </p>
          <p className="section-sub">
            I’m always curious to learn something new, experiment with different ideas, and improve the way I build. 
            For me, the best part of development is taking something from a simple idea to a working product.
          </p>
        </div>

        <motion.div
          className="about-facts"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          {FACTS.map((f) => (
            <div className="fact glass-card" key={f.v}>
              <div className="fact-k mono">{f.k}</div>
              <div className="fact-v">{f.v}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
