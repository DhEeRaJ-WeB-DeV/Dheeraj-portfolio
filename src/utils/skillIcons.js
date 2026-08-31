export const ICON_SLUG = {
  JavaScript: "javascript",
  TypeScript: "typescript",
  Golang: "go",
  "React.js": "react",
  HTML5: "html5",
  "Tailwind CSS": "tailwindcss",
  "Node.js": "nodedotjs",
  "Express.js": "express",
  Django: "django",
  JWT: "jsonwebtokens",
  WebSockets: "socketdotio",
  MongoDB: "mongodb",
  PostgreSQL: "postgresql",
  Redis: "redis",
  Docker: "docker",
  Git: "git",
  GitHub: "github",
  "CI/CD": "githubactions",
  Prometheus: "prometheus",
  Grafana: "grafana",
  Jest: "jest",
  Vitest: "vitest",
  Postman: "postman",
  n8n: "n8n",
};

// Icons that don't exist in Simple Icons at all (no slug to fall back
// to) get a direct URL here instead. Loki has an open, still-unfulfilled
// request in Simple Icons (github.com/simple-icons/simple-icons/issues/12138),
// so its real logo comes from Dashboard Icons via jsDelivr instead.
export const ICON_URL_OVERRIDE = {
  Loki: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/loki.svg",
};

// Returns null (not a guessed slug) for anything not explicitly
// listed above, so callers know to render a fallback instead of
// requesting an image that will 404.
export function iconSlug(name) {
  return ICON_SLUG[name] || null;
}

export function iconUrl(name, color = "ffffff") {
  if (ICON_URL_OVERRIDE[name]) return ICON_URL_OVERRIDE[name];
  const slug = iconSlug(name);
  return slug ? `https://cdn.simpleicons.org/${slug}/${color}` : null;
}


export function monogram(name) {
  const words = name.split(/[\s./]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join("").slice(0, 3).toUpperCase();
}