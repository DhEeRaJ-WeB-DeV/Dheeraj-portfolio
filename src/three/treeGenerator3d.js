import * as THREE from "three";

// ---------------------------------------------------------------------------
// treeGenerator3d — deterministic recursive branch generator for the WebGL
// scroll trees. Produces a flat list of 3D branch segments (start/end/radius)
// plus leaf-cluster points near the terminal twigs and "fork" spark points
// where branches split, already normalized into a fixed design box so any
// seed produces a tree that fits the same frame.
//
// The root is planted at the BOTTOM of that box; growth (driven by scroll,
// see Tree3D) always proceeds outward from the root first, so on screen the
// tree grows bottom-to-top: trunk first, canopy last.
//
// v2 changes (matching the reference glow-tree artwork more closely):
//   - branches bow along a gentle bezier instead of running dead straight,
//     chopped into small sub-segments so growth still reveals them smoothly
//   - thin "epicormic" twigs sprout mid-branch (not just at tips), giving
//     the brambly, twice-branched density seen in the reference instead of
//     a clean binary-tree silhouette
//   - every fork gets a "node" entry so Tree3D can flash a bright spark
//     there the instant growth reaches it (the glowing joints in the ref art)
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

export const TREE_TARGET_W = 1.55; // inward reach, world units
export const TREE_TARGET_H = 7.2; // top-to-bottom reach, world units
export const TREE_TARGET_D = 1.7; // total depth span (z), world units
export const TREE_GROW_WINDOW = TREE_TARGET_H * 0.045;

const MAX_DEPTH = 7;
const MIN_LEN = 0.075;
const ROOT_LEN = 1.35;
const ROOT_ANGLE = 72; // degrees; in growBranch's local frame this trends
// toward -y ("downward") — tp() below flips the whole tree vertically so
// that local -y ends up pointing UP on screen, root at the bottom.
const SPREAD_BASE = 17;
const SPREAD_DEPTH = 1.2;
const JITTER = 7;
const Z_JITTER = 14; // degrees of out-of-plane twist introduced per split
const SHRINK_MIN = 0.64;
const SHRINK_RANGE = 0.13;
const ANGLE_MIN = 24;
const ANGLE_MAX = 128;
const ROOT_RADIUS = 0.052;
const RADIUS_SHRINK = 0.71;

// Organic curvature: each branch bows along a quadratic bezier instead of a
// straight line, split into this many straight sub-segments. Each piece is
// pushed into the same flat `branches` list as its own tapering segment, so
// the existing cumStart/cumEnd growth math in Tree3D needs no changes at
// all — it just sees more, smaller segments to draw in order.
const CURVE_SEGMENTS = 3;
const CURVE_BOW_MIN = 0.05;
const CURVE_BOW_MAX = 0.16;

// Thin twigs that sprout out of the *middle* of a branch, not just where it
// forks at the tip — this is what gives the reference art its brambly,
// twice-branched density. They terminate in one short run (isTwig=true).
const TWIG_CHANCE = 0.4;
const TWIG_MAX_DEPTH_FOR_SPROUT = 4;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Deterministic PRNG so a given seed always produces the same tree shape.
function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A "planar" angle (as in the original 2D design, 0deg = +X, sweeping
// downward) plus a small twist around that same forward axis is enough to
// pull the branch out of the XY plane and into real 3D without losing the
// original silhouette.
function dirFromAngles(planarDeg, twistDeg) {
  const p = planarDeg * DEG;
  const t = twistDeg * DEG;
  const x = Math.cos(p);
  const y = -Math.sin(p);
  const z = Math.sin(t) * 0.55;
  return new THREE.Vector3(x, y, z).normalize();
}

// Bows a straight start->end run through one offset control point and
// chops the resulting curve into CURVE_SEGMENTS straight pieces, each
// pushed to `branches` as its own tapering segment (start/end/length/radius).
function pushCurvedBranch(start, end, radius, depth, rng, branches) {
  const chord = end.clone().sub(start);
  const len = chord.length();
  if (len < 1e-5) return;
  const dir = chord.clone().normalize();

  // Perpendicular bow axis — pick whichever world axis is least parallel
  // to the branch so the cross product doesn't degenerate near-vertical.
  const helper = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const perp = new THREE.Vector3().crossVectors(dir, helper).normalize();
  const bowSign = rng() < 0.5 ? -1 : 1;
  const bowAmount = (CURVE_BOW_MIN + rng() * (CURVE_BOW_MAX - CURVE_BOW_MIN)) * len * bowSign;
  const control = start.clone().addScaledVector(chord, 0.5).addScaledVector(perp, bowAmount);

  const startRadius = radius;
  const endRadius = radius * 0.88; // gentle taper along the branch's own run
  let prev = start;
  for (let i = 1; i <= CURVE_SEGMENTS; i++) {
    const t = i / CURVE_SEGMENTS;
    const omt = 1 - t;
    const point = new THREE.Vector3(
      omt * omt * start.x + 2 * omt * t * control.x + t * t * end.x,
      omt * omt * start.y + 2 * omt * t * control.y + t * t * end.y,
      omt * omt * start.z + 2 * omt * t * control.z + t * t * end.z
    );
    const segLen = point.distanceTo(prev);
    const segRadius = THREE.MathUtils.lerp(startRadius, endRadius, t) * (0.94 + rng() * 0.12);
    branches.push({
      start: prev.clone(),
      end: point.clone(),
      length: segLen,
      radius: Math.max(0.0025, segRadius),
      depth,
      dir: segLen > 1e-6 ? point.clone().sub(prev).normalize() : dir.clone(),
    });
    prev = point;
  }
}

function growBranch(pos, planarAngle, twist, length, radius, depth, rng, branches, leaves, nodes, isTwig) {
  const dir = dirFromAngles(planarAngle, twist);
  const end = pos.clone().addScaledVector(dir, length);
  const segStartIndex = branches.length;
  pushCurvedBranch(pos, end, radius, depth, rng, branches);
  if (branches.length === segStartIndex) return; // degenerate zero-length branch
  const lastSegIndex = branches.length - 1;

  const stop = depth >= MAX_DEPTH || length < MIN_LEN || isTwig;
  if (stop) {
    const clusterSize = 3 + Math.floor(rng() * 5);
    for (let i = 0; i < clusterSize; i++) {
      leaves.push({
        lastSegIndex,
        position: end.clone().addScaledVector(
          new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5),
          0.12
        ),
        size: 0.024 + rng() * 0.038,
        delay: i * 0.04 + rng() * 0.05,
        colorIndex: Math.floor(rng() * 5),
        sparkle: rng() * Math.PI * 2,
      });
    }
    return;
  }

  // Fork marker — a small bright spark where the branch splits, lit the
  // instant growth reaches this point (the glowing joints in the ref art).
  nodes.push({ lastSegIndex, position: end.clone(), seed: rng() });

  // Thin twig sprouting from partway along this branch, pushed *before* the
  // main children so it lights up shortly after its parent rather than
  // after the parent's whole far sub-canopy has already grown.
  if (depth <= TWIG_MAX_DEPTH_FOR_SPROUT && length > MIN_LEN * 2.2 && rng() < TWIG_CHANCE) {
    const alongT = 0.35 + rng() * 0.4;
    const twigStart = pos.clone().lerp(end, alongT);
    const twigPlanar = clamp(planarAngle + (rng() - 0.5) * (SPREAD_BASE + 10), ANGLE_MIN, ANGLE_MAX);
    const twigTwist = twist + (rng() - 0.5) * Z_JITTER * 3;
    const twigLength = length * (0.28 + rng() * 0.22);
    const twigRadius = Math.max(0.003, radius * 0.5);
    growBranch(twigStart, twigPlanar, twigTwist, twigLength, twigRadius, depth + 2, rng, branches, leaves, nodes, true);
  }

  const childCount = depth < 2 && rng() < 0.4 ? 3 : 2;
  const spread = Math.max(7, SPREAD_BASE - depth * SPREAD_DEPTH);
  for (let i = 0; i < childCount; i++) {
    const t = childCount === 1 ? 0 : i / (childCount - 1) - 0.5;
    const jitter = (rng() - 0.5) * JITTER;
    const childPlanar = clamp(planarAngle + t * spread + jitter, ANGLE_MIN, ANGLE_MAX);
    const childTwist = twist + (rng() - 0.5) * Z_JITTER * 2;
    const childLength = length * (SHRINK_MIN + rng() * SHRINK_RANGE);
    const childRadius = Math.max(0.0035, radius * RADIUS_SHRINK);
    growBranch(end, childPlanar, childTwist, childLength, childRadius, depth + 1, rng, branches, leaves, nodes, false);
  }
}

// Builds one tree's branch/leaf/node list, normalized so the root sits at
// the bottom of the design box and the canopy fans up/inward toward the
// top — plus cumulative growth-length offsets (root first) so scroll
// progress maps directly onto how much of the tree is "drawn", growing
// bottom-to-top rather than top-to-bottom.
export function generateTree3D(seed) {
  const rng = mulberry32(seed);
  const branches = [];
  const leaves = [];
  const nodes = [];
  growBranch(new THREE.Vector3(0, 0, 0), ROOT_ANGLE, 0, ROOT_LEN, ROOT_RADIUS, 0, rng, branches, leaves, nodes, false);

  let maxX = -Infinity;
  let minY = Infinity;
  let maxZ = -Infinity;
  let minZ = Infinity;
  branches.forEach((b) => {
    maxX = Math.max(maxX, b.start.x, b.end.x);
    minY = Math.min(minY, b.start.y, b.end.y);
    maxZ = Math.max(maxZ, b.start.z, b.end.z);
    minZ = Math.min(minZ, b.start.z, b.end.z);
  });

  const scaleX = TREE_TARGET_W / (maxX || 1);
  const scaleY = TREE_TARGET_H / (-minY || 1);
  const zSpan = Math.max(0.0001, maxZ - minZ);
  const scaleZ = TREE_TARGET_D / zSpan;
  const zCenter = (maxZ + minZ) / 2;
  const radiusScale = (scaleX + scaleY) / 2;

  // NOTE the negation on y: growBranch's local coordinates put the root at
  // y=0 and grow toward increasingly negative y (see dirFromAngles/ROOT_ANGLE).
  // Flipping the sign here plants the root at the BOTTOM of the design box
  // and lets the canopy reach up toward the top, so growth (which always
  // proceeds outward from the root, i.e. root's branches first — see the
  // cumStart pass below) reads on screen as bottom-to-top, not top-to-bottom.
  const tp = (v) =>
    new THREE.Vector3(v.x * scaleX, -(TREE_TARGET_H / 2 + v.y * scaleY), (v.z - zCenter) * scaleZ);

  branches.forEach((b) => {
    b.start = tp(b.start);
    b.end = tp(b.end);
    b.length = b.start.distanceTo(b.end);
    b.radius = b.radius * radiusScale;
    b.dir = b.end.clone().sub(b.start).normalize();
  });
  leaves.forEach((l) => {
    l.position = tp(l.position);
    l.delay = l.delay * radiusScale;
  });
  nodes.forEach((n) => {
    n.position = tp(n.position);
  });

  let running = 0;
  branches.forEach((b) => {
    b.cumStart = running;
    running += b.length;
    b.cumEnd = running;
  });
  leaves.forEach((l) => {
    l.revealAt = branches[l.lastSegIndex].cumEnd + l.delay;
  });
  nodes.forEach((n) => {
    n.revealAt = branches[n.lastSegIndex].cumEnd;
  });

  return { branches, leaves, nodes, totalLength: running };
}
