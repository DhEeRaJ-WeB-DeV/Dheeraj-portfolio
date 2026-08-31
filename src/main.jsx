import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./theme.jsx";
import { PerfProvider } from "./perf.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PerfProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </PerfProvider>
  </StrictMode>
);
