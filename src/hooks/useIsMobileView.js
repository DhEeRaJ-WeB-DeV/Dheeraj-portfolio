import { useSyncExternalStore } from "react";

// Phone-width viewport check (<= 768px). Used to swap the heavy 3D /
// game sections for simple cards on mobile only. Desktop widths always
// get the original experience.
//
// Deliberately width-only (not "pointer: coarse") so a touch-screen
// laptop or a tablet in landscape still gets the full desktop view.
const QUERY = "(max-width: 768px)";

function subscribe(callback) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export default function useIsMobileView() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
