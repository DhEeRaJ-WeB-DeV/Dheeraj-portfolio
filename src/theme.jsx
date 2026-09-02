import { createContext, useContext, useEffect, useMemo } from "react";

// Central theme registry. Each entry drives the CSS custom properties
// (see [data-theme="..."] blocks in src/index.css) AND supplies a small
// hex palette that the WebGL/three.js scenes read via useTheme().colors
// so the 3D visuals re-tint along with the rest of the page.
//
// The site now ships with a single, fixed theme (blue) — the old
// multi-theme picker (green/violet/red/mono + the Nav dropdown) has
// been removed. THEMES is kept as a one-item list, and setThemeId is
// kept as a no-op, purely so the rest of the app (three.js scenes that
// read theme/themeId) doesn't need to change shape.
export const THEMES = [
  {
    id: "blue",
    label: "Blue",
    swatch: ["#2323ff", "#24aeff", "#4d9bff"],
    colors: ["#24aeff", "#2fa0ff", "#6bd2ff", "#4d9bff", "#7ec8ff"],
  },
];

const DEFAULT_THEME = "blue";

const ThemeContext = createContext({
  themeId: DEFAULT_THEME,
  theme: THEMES[0],
  setThemeId: () => {},
});

export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", DEFAULT_THEME);
  }, []);

  const value = useMemo(
    () => ({ themeId: DEFAULT_THEME, theme: THEMES[0], setThemeId: () => {} }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
