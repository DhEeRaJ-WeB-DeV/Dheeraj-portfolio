import { Component } from "react";

// ErrorBoundary — the app previously had zero error boundaries anywhere,
// so any uncaught error thrown during render or in a useEffect (e.g. a
// WebGL context that fails to create because the browser hit its
// concurrent-context limit — easy to do on mobile once enough three.js
// canvases are mounted at once: the always-on tunnel background, the
// jellyfish, the skills carousel, and then Projects adds its own DNA
// scene plus one canvas per project card) unmounts the ENTIRE React
// tree. Since nothing but `body`'s CSS background is left behind, that
// reads to the user as "the page just went white".
//
// Wrapping individual heavy/WebGL sections in this means a failure in
// one of them (say, a card's fractal-wave canvas losing its WebGL
// context) just quietly drops that one piece instead of taking the
// whole page down with it.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Left as a console warning rather than surfaced in the UI — these
    // are decorative 3D layers; the rest of the section still works fine
    // without them.
    console.warn("ErrorBoundary caught an error, rendering fallback instead:", error, info);
  }

  componentDidUpdate(prevProps) {
    // Allow recovering automatically if whatever this boundary is keyed
    // on changes (e.g. the section scrolls out of view and back in).
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
