import { profile } from "../data/resume";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner mono">
        <span>© {new Date().getFullYear()} {profile.name}</span>
        <span className="footer-status">
          <span className="status-dot" /> AVAILABLE FOR OPPORTUNITIES
        </span>
        <a href="#top">back to top ↑</a>
      </div>
    </footer>
  );
}
