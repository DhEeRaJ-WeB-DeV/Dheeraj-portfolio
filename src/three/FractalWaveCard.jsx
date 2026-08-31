import { useEffect, useRef } from "react";
import FractalWave from "./FractalWave";

export default function FractalWaveCard({ color = "#5fe0a0", mouse, hovered }) {
  const canvasRef = useRef(null);
  const fxRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    fxRef.current = new FractalWave(canvasRef.current, color);
    const ro = new ResizeObserver(() => fxRef.current?.resize());
    ro.observe(canvasRef.current);
    return () => {
      ro.disconnect();
      fxRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fxRef.current?.setHover(hovered);
  }, [hovered]);

  useEffect(() => {
    if (color) fxRef.current?.setColor(color);
  }, [color]);

  useEffect(() => {
    if (mouse) {
      // glow.x/y come in as 0–100 percentages; flip y since UV origin is bottom-left
      fxRef.current?.setMouse(mouse.x / 100, 1 - mouse.y / 100);
    }
  }, [mouse]);

  return (
    <canvas
      ref={canvasRef}
      className="proj-fractal-canvas"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}