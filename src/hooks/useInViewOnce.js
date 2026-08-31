import { useEffect, useRef, useState } from "react";

// Flips to `true` the first time the observed element crosses into the
// viewport (plus rootMargin) and then stops observing — used to defer
// mounting/importing expensive below-the-fold content (WebGL canvases,
// CSS3D scenes) until it's actually about to be seen, instead of paying
// for it during initial page load. Unlike framer-motion's `useInView`
// with `once:false`, this never re-triggers, so it's cheap to leave
// attached for the life of the component.
export default function useInViewOnce({ rootMargin = "200px 0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return; // already triggered, nothing left to observe
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver support (very old browsers) — fail open
    // rather than never rendering the content at all.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView];
}
