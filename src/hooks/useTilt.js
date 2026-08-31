import { useRef } from "react";

// Imperative tilt + spotlight — avoids React re-renders on every mousemove.
// Attach the returned ref + handlers to the element you want tilting.
export default function useTilt({ max = 10, scale = 1.02 } = {}) {
  const ref = useRef(null);

  function handleMouseMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * max * 2;
    const ry = (px - 0.5) * max * 2;
    el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
    el.style.setProperty("--spot-opacity", "1");
  }

  function handleMouseLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)";
    el.style.setProperty("--spot-opacity", "0");
  }

  return { ref, onMouseMove: handleMouseMove, onMouseLeave: handleMouseLeave };
}
