import { useState } from "react";
import {
  FiMail,
  FiPhone,
  FiGithub,
  FiLinkedin,
  FiInstagram,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { profile } from "../data/resume";
import "./Contact.css";
import GameShowcase from "./GameShowcase";

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  function handleSubmit(e) {
    e.preventDefault();
    setSent(true);
    const subject = encodeURIComponent(`Portfolio contact from ${form.name || "a visitor"}`);
    const body = encodeURIComponent(`${form.message}\n\n— ${form.name} (${form.email})`);
    window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
  }

  return (
    <section className="section contact" id="contact">
      <div className="container contact-grid">
        <div>
          <p className="eyebrow">06 · Contact</p>
          <h2 className="section-title">
            Let's build something<br />that stays up.
          </h2>
          <p className="section-sub">
            Open to backend and full-stack roles, freelance builds, or just talking
            architecture over email.
          </p>

          <div className="contact-links mono">
  <a href={`mailto:${profile.email}`} className="contact-link">
    <FiMail className="contact-link-icon" />
    <span className="contact-link-label">EMAIL</span>
    {profile.email}
  </a>

  <a
    href={`tel:${profile.phone.replace(/\s/g, "")}`}
    className="contact-link"
  >
    <FiPhone className="contact-link-icon" />
    <span className="contact-link-label">PHONE</span>
    {profile.phone}
  </a>

  <a
    href={profile.github}
    target="_blank"
    rel="noreferrer"
    className="contact-link"
  >
    <FiGithub className="contact-link-icon" />
    <span className="contact-link-label">GITHUB</span>
    github.com/DhEeRaJ-WeB-DeV
  </a>

  <a
    href={profile.linkedin}
    target="_blank"
    rel="noreferrer"
    className="contact-link"
  >
    <FiLinkedin className="contact-link-icon" />
    <span className="contact-link-label">LINKEDIN</span>
    in/dheeraj-sure
  </a>

  <a
    href={profile.instagram}
    target="_blank"
    rel="noreferrer"
    className="contact-link"
  >
    <FiInstagram className="contact-link-icon" />
    <span className="contact-link-label">INSTAGRAM</span>
    dheeraj.s_005
  </a>
</div>
        </div>

        <motion.form
          className="contact-form glass-card"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55 }}
        >
          <div className="form-titlebar mono">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
            <span className="form-titlebar-label">new_message.sh</span>
          </div>

          <div className="form-body">
            <label className="mono">
              name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </label>
            <label className="mono">
              email
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@company.com"
              />
            </label>
            <label className="mono">
              message
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Tell me about the role or project..."
              />
            </label>
            <button type="submit" className="btn btn-primary form-submit">
              {sent ? "Opening mail client…" : "Send message →"}
            </button>
          </div>
        </motion.form>
      </div>
      <GameShowcase />
    </section>
  );
}
