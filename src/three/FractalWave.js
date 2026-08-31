import * as THREE from "three";

// Up to three of these run at once on the Projects section (one per
// card) on top of the always-on tunnel background and the DNA/web
// canvas — on phones that's several concurrent WebGL contexts each
// doing a per-pixel voronoi shader. Capping the pixel ratio (and
// dropping antialiasing) on narrow viewports keeps that combined cost
// down without touching how it renders on desktop.
const IS_NARROW = typeof window !== "undefined" && window.innerWidth < 768;

export default class FractalWave {
  constructor(canvas, color) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !IS_NARROW });
    this.renderer.setPixelRatio(IS_NARROW ? 1 : Math.min(window.devicePixelRatio, 2));

    // Belt-and-braces: if this canvas's WebGL context ever gets lost
    // (the browser can do this under memory/context pressure even after
    // successful creation, e.g. juggling several other three.js canvases
    // elsewhere on the page), stop the render loop instead of letting
    // three.js keep calling .render() on a dead context every frame.
    // preventDefault() on the loss event is what allows a restore event
    // to fire at all, letting the card recover its glow instead of
    // staying blank for the rest of the visit.
    this._onContextLost = (e) => {
      e.preventDefault();
      this._contextLost = true;
    };
    this._onContextRestored = () => {
      this._contextLost = false;
    };
    canvas.addEventListener("webglcontextlost", this._onContextLost, false);
    canvas.addEventListener("webglcontextrestored", this._onContextRestored, false);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uHover: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uAspect: { value: 1 },
    };

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec2 uMouse;
        uniform float uHover;
        uniform vec3 uColor;
        uniform float uAspect;
        varying vec2 vUv;

        vec2 hash2(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return fract(sin(p) * 43758.5453123);
        }

        // Voronoi field: returns (distToEdge, cellId-ish brightness seed)
        vec2 voronoi(vec2 uv, float t, vec2 mouse) {
          vec2 p = floor(uv);
          vec2 f = fract(uv);
          float minDist1 = 8.0;
          float minDist2 = 8.0;
          vec2 closestPoint = vec2(0.0);

          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 g = vec2(float(x), float(y));
              vec2 o = hash2(p + g);
              // gentle per-cell wobble so the web breathes
              o = 0.5 + 0.5 * sin(t * 0.6 + 6.2831 * o);
              vec2 cellPoint = g + o;

              // pull nearby cell points toward the cursor on hover
              float distToMouse = length((p + cellPoint) / 12.0 - mouse);
              float pull = uHover * 0.35 * exp(-distToMouse * distToMouse * 3.0);
              cellPoint += (mouse * 12.0 - (p + cellPoint)) * pull * 0.08;

              vec2 r = cellPoint - f;
              float d = dot(r, r);
              if (d < minDist1) {
                minDist2 = minDist1;
                minDist1 = d;
                closestPoint = p + g;
              } else if (d < minDist2) {
                minDist2 = d;
              }
            }
          }
          float edgeDist = sqrt(minDist2) - sqrt(minDist1);
          float cellSeed = hash2(closestPoint).x;
          return vec2(edgeDist, cellSeed);
        }

        float hash1(vec2 p) {
          return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453123);
        }

        void main() {
          vec2 uv = vUv;
          uv.x *= uAspect;
          vec2 mouse = vec2(uMouse.x * uAspect, uMouse.y);

          float scale = 11.0; // cell density — raise for a finer web
          vec2 gv = uv * scale;

          vec2 vr = voronoi(gv, uTime, mouse);
          float edgeDist = vr.x;
          float cellSeed = vr.y;

          // thin glowing crack line at cell boundaries
          float lineWidth = 0.045 + uHover * 0.02;
          float edge = 1.0 - smoothstep(0.0, lineWidth, edgeDist);
          float coreGlow = 1.0 - smoothstep(0.0, lineWidth * 0.35, edgeDist);
          edge = edge * 0.55 + coreGlow * 0.9;

          // fine dot/stipple texture inside cells, brighter near edges
          vec2 dotUv = uv * 90.0;
          float dots = step(0.93, hash1(floor(dotUv) + cellSeed * 17.0));
          float nearEdge = smoothstep(0.35, 0.0, edgeDist);
          float dotGlow = dots * nearEdge * 0.5;

          float intensity = edge + dotGlow;
          float pulse = 0.85 + 0.15 * sin(uTime * 1.4 + cellSeed * 6.2831);
          intensity *= pulse;

          float alpha = intensity * (0.35 + uHover * 0.55);
          vec3 col = uColor * (0.6 + intensity * 0.8);

          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.mesh);

    this.resize();
    this.clock = new THREE.Timer();
    this._raf = requestAnimationFrame(this.tick);
  }

  resize = () => {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (w && h) {
      this.renderer.setSize(w, h, false);
      this.uniforms.uAspect.value = w / h;
    }
  };

  setMouse(x, y) {
    this.uniforms.uMouse.value.set(x, y);
  }

  setColor(color) {
    this.uniforms.uColor.value.set(color);
  }

  setHover(hovered) {
    this._targetHover = hovered ? 1 : 0;
  }

  tick = () => {
    this.clock.update();
    const dt = this.clock.getDelta();
    this.uniforms.uTime.value += dt;
    const target = this._targetHover ?? 0;
    this.uniforms.uHover.value += (target - this.uniforms.uHover.value) * Math.min(1, dt * 6);
    if (!this._contextLost) {
      this.renderer.render(this.scene, this.camera);
    }
    this._raf = requestAnimationFrame(this.tick);
  };

  dispose = () => {
    cancelAnimationFrame(this._raf);
    this.canvas.removeEventListener("webglcontextlost", this._onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this._onContextRestored);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.renderer.dispose();
  };
}