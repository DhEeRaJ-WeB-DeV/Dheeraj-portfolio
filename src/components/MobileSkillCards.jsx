import {
  FiCode,
  FiLayout,
  FiServer,
  FiDatabase,
  FiCloud,
  FiActivity,
  FiCheckCircle,
} from "react-icons/fi";
import { skillGroups } from "../data/resume";
import "./MobileCards.css";

// One icon per skill group id (see skillGroups in resume.js). Anything
// new falls back to the code icon.
const GROUP_ICONS = {
  languages: FiCode,
  frontend: FiLayout,
  backend: FiServer,
  data: FiDatabase,
  cloud: FiCloud,
  monitoring: FiActivity,
  testing: FiCheckCircle,
};

// Mobile-only replacement for the 3D skills carousel: one plain card per
// group with a chip for every skill. No WebGL, no drag, no animation.
export default function MobileSkillCards() {
  return (
    <div className="m-card-list">
      {skillGroups.map((group) => {
        const Icon = GROUP_ICONS[group.id] || FiCode;
        return (
          <article key={group.id} className="m-card">
            <span className="m-card-icon" aria-hidden="true">
              <Icon />
            </span>
            <h3 className="m-card-title">{group.label}</h3>
            <div className="m-chips">
              {group.items.map((item) => (
                <span key={item} className="m-chip">
                  {item}
                </span>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
