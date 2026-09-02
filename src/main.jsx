import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./theme.jsx";
import { PerfProvider } from "./perf.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* Top-level safety net: without this, any uncaught error anywhere
        in the tree (most likely a WebGL context failing to create on a
        phone with several 3D canvases already mounted) unmounts
        everything and the page goes blank/white. See ErrorBoundary.jsx. */}
    <ErrorBoundary>
      <PerfProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </PerfProvider>
    </ErrorBoundary>
  </StrictMode>
);
