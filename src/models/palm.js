import * as THREE from 'three';
import {
  buildLoftedGeometry,
  createAnatomicalBoneGeometry,
  createVesselTube,
} from '../geometryUtils.js';

function palmEnvelopeX(v) {
  const xMin =
    -1.56 * Math.pow(1 - v, 2) -
    2 * 2.52 * v * (1 - v) -
    2.24 * Math.pow(v, 2);
  const thenarBulge = Math.exp(-Math.pow((v - 0.40) / 0.29, 2)) * 0.96;
  const xMax = THREE.MathUtils.lerp(1.62, 2.08, v) + thenarBulge;
  return { xMin, xMax };
}

export function palmTopArchY(u) {
  return (
    6.98 -
    0.72 * Math.pow(u - 0.24, 2) -
    0.26 * Math.max(0, -u - 0.15)
  );
}

function evalDorsalSurface(f, v, thicknessOffset = 0) {
  const u = f * 2 - 1;
  const { xMin, xMax } = palmEnvelopeX(v);
  const x = THREE.MathUtils.lerp(xMin, xMax, f);

  const bottomY = 0.58 + 0.44 * Math.exp(-Math.pow(u / 0.46, 2));
  const topY = palmTopArchY(u) - 0.04;
  const y = THREE.MathUtils.lerp(bottomY, topY, v);

  const edgeTaper = Math.sin(Math.PI * Math.pow(f, 0.88));
  const vertTaper = Math.sin(Math.PI * (0.08 + 0.86 * v));

  const ridgeWeight =
    THREE.MathUtils.smoothstep(v, 0.12, 0.42) *
    (1 - 0.25 * THREE.MathUtils.smoothstep(v, 0.88, 1.0));
  const ridgeCenters = [-0.68, -0.24, 0.22, 0.66];
  let ridgeHeight = 0;
  for (const rc of ridgeCenters) {
    const d = Math.abs(u - rc);
    ridgeHeight += Math.max(0, 1 - d / 0.19) * 0.28;
  }

  const zOuter = -0.26 - edgeTaper * (0.64 * vertTaper + ridgeWeight * ridgeHeight);
  const z = zOuter + thicknessOffset;
  return new THREE.Vector3(x, y, z);
}

function buildSolidDorsalArmorGeometry() {
  const vSteps = 24;
  const uSteps = 26;
  const rings = [];

  for (let iv = 0; iv <= vSteps; iv++) {
    const v = iv / vSteps;
    const ring = [];
    for (let iu = 0; iu <= uSteps; iu++) {
      ring.push(evalDorsalSurface(iu / uSteps, v, 0));
    }
    for (let iu = uSteps; iu >= 0; iu--) {
      const f = iu / uSteps;
      const concaveWall = 0.16 + 0.14 * Math.sin(Math.PI * f);
      ring.push(evalDorsalSurface(f, v, concaveWall));
    }
    ring.reverse();
    rings.push(ring);
  }

  return buildLoftedGeometry(rings, { closedU: true, capStart: true, capEnd: true });
}

/**
 * Maps polar angle theta -> rounded-square parameter (cx, sy) in [-1, 1]^2
 * so the palmar frame follows a true anatomical trapezoid/pentagon rather than an oval!
 */
function polarToSuperSquare(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const p = 3.0;
  const denom = Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(s), p), 1 / p);
  return { cx: c / denom, sy: s / denom };
}

function evalPalmarOuterXY(theta) {
  const { cx, sy } = polarToSuperSquare(theta);
  const v = (sy + 1) * 0.5; // 0 (wrist) .. 1 (knuckles)
  const { xMin, xMax } = palmEnvelopeX(v);
  const x = THREE.MathUtils.lerp(xMin, xMax, (cx + 1) * 0.5);
  const bottomY = 0.92 + 0.16 * (1 - Math.abs(cx));
  const topY = palmTopArchY(cx * 0.95) - 0.08;
  const y = THREE.MathUtils.lerp(bottomY, topY, v);
  return { x, y };
}

function evalPalmarInnerXY(theta) {
  const { cx, sy } = polarToSuperSquare(theta);
  const v = (sy + 1) * 0.5;
  const { xMin, xMax } = palmEnvelopeX(v);
  // Generous sculpted white thenar cushion along lower-right (+X, v < 0.72) framing concave hollow
  const thenarInset = 0.42 + 0.88 * Math.max(0, 1 - v / 0.78);
  const innerMin = xMin + 0.36;
  const innerMax = xMax - thenarInset;
  const x = THREE.MathUtils.lerp(innerMin, innerMax, (cx + 1) * 0.5);

  const bottomY = 1.38 + 0.12 * (1 - Math.abs(cx));
  const topY = palmTopArchY(cx * 0.88) - 0.56;
  const y = THREE.MathUtils.lerp(bottomY, topY, v);
  return { x, y };
}

/**
 * Builds ONE seamless continuous sculpted Palmar CNC Bezel + Integrated Thenar Cushion Shell
 * framing the sunken concave frosted palm window (replaces chunky tubes and glued sphere pad!).
 */
function buildSeamlessPalmarBezelGeometry() {
  const segsU = 48;
  const rings = [];
  // Cross-section profile points from outer rim bevel -> thick front lip -> smooth slope down into concave bowl edge
  const profileSteps = 10;

  // Sweep rings along cross-section profile tProfile in [0..1] around closed theta loop?
  // Wait: lofting along theta cleanly requires closed or capped loop; easier: rings index radial profile, vertices index theta!
  // Let's check normal winding: if ring i goes around theta counter-clockwise (0..2PI in XY, viewing from +Z),
  // and ring order goes from outer edge inward/then back underneath:
  // Going from outer edge -> crest -> inner sunken bowl edge along +Z side:
  // Let rings progress along closed cross-section perimeter (12 points around bezel cross-section) across theta!
  // Better yet: each ring corresponds to a step around the cross-section (14 pts), and points along each ring wrap theta = 0..2PI!
  // Wait: closedU=true along theta makes a seamless closed torus-like anatomical frame with ZERO end-caps or seams!

  const crossSection = [
    // Outer seam edge tucked onto dorsal shell perimeter (0 = outer, 1 = inner)
    { t: 0.0, z: -0.14 },
    { t: 0.08, z: 0.16 },
    { t: 0.28, z: 0.44 },
    { t: 0.56, z: 0.54 }, // smooth ergonomic rounded crest
    { t: 0.84, z: 0.44 },
    { t: 1.0, z: 0.28 },  // recessed lip meeting frosted palm dome
    // Inner return under-lip back to outer edge for closed watertight shell
    { t: 0.88, z: 0.08 },
    { t: 0.42, z: 0.02 },
    { t: 0.04, z: -0.16 },
  ];

  for (let ir = 0; ir < crossSection.length; ir++) {
    const cs = crossSection[ir];
    const ring = [];
    for (let iu = 0; iu < segsU; iu++) {
      // Counter-clockwise in XY when viewed from +Z so crossSection progression inward gives +Z outward normal!
      const th = (iu / segsU) * Math.PI * 2;
      const pOut = evalPalmarOuterXY(th);
      const pIn = evalPalmarInnerXY(th);

      const x = THREE.MathUtils.lerp(pOut.x, pIn.x, cs.t);
      const y = THREE.MathUtils.lerp(pOut.y, pIn.y, cs.t);

      // Add subtle gentle palmar cushion swelling across the thenar zone (lower-right, cos > 0 & sin < 0.4)
      const c = Math.cos(th);
      const s = Math.sin(th);
      const thenarSwell = Math.max(0, c) * Math.max(0, 0.48 - s) * (cs.z > 0.2 ? 0.28 : 0.05);
      // Slight hypothenar swell on lower-left (cos < 0 & sin < 0.2)
      const hypoSwell = Math.max(0, -c) * Math.max(0, 0.30 - s) * (cs.z > 0.2 ? 0.14 : 0.03);

      const z = cs.z + thenarSwell + hypoSwell;
      ring.push(new THREE.Vector3(x, y, z));
    }
    rings.push(ring);
  }

  return buildLoftedGeometry(rings, { closedU: true, capStart: false, capEnd: false });
}

/**
 * Concave Frosted Milky Translucent Palm Bowl Lens sized precisely inside evalPalmarInnerXY contour.
 */
function buildConcaveFrostedPalmGeometry() {
  const rSteps = 14;
  const uSteps = 44;
  const rings = [];

  for (let ir = 0; ir <= rSteps; ir++) {
    const rho = 1 - ir / rSteps; // 1 at rim -> 0.04 at deep bowl center
    const ring = [];
    for (let iu = 0; iu <= uSteps; iu++) {
      const th = (iu / uSteps) * Math.PI * 2;
      const pRim = evalPalmarInnerXY(th);
      const x = THREE.MathUtils.lerp(-0.10, pRim.x, Math.max(0.02, rho));
      const y = THREE.MathUtils.lerp(3.75, pRim.y, Math.max(0.02, rho));

      // Gentle bowl concavity: edges meet bezel rim at +0.34, center dips gracefully inward to +0.16!
      const rimZ = 0.34;
      const centerZ = 0.16;
      const z = THREE.MathUtils.lerp(centerZ, rimZ, Math.pow(rho, 1.45));
      ring.push(new THREE.Vector3(x, y, z));
    }
    // Wait: rho decreases inward (rSteps goes rim -> center), theta increases CCW -> ring-to-ring cross theta-tangent = +Z outward!
    rings.push(ring);
  }

  return buildLoftedGeometry(rings, { closedU: false, capStart: false, capEnd: false });
}

function createCurvedDecalMesh(centerX, centerY, surfaceZAt, width, height, normalFlipZ, material) {
  const geom = new THREE.PlaneGeometry(width, height, 6, 4);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const wx = normalFlipZ ? centerX - lx : centerX + lx;
    const wy = centerY + ly;
    const wz = surfaceZAt(wx, wy);
    pos.setXYZ(i, wx, wy, wz);
  }
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, material);
  mesh.renderOrder = 3;
  return mesh;
}

export function buildPalmAssembly(materials) {
  const root = new THREE.Group();
  root.name = 'PalmAssembly';

  // 1. Recessed Concave Dark-Titanium Inner Palm Floor
  const floorRings = [];
  for (let iv = 0; iv <= 12; iv++) {
    const v = iv / 12;
    const { xMin, xMax } = palmEnvelopeX(v);
    const ring = [];
    for (let iu = 0; iu <= 14; iu++) {
      const f = iu / 14;
      const u = f * 2 - 1;
      const x = THREE.MathUtils.lerp(xMin + 0.32, xMax - 0.38, f);
      const yTop = palmTopArchY(u * 0.88) - 0.36;
      const y = THREE.MathUtils.lerp(1.10, yTop, v);
      const bowl = Math.sin(Math.PI * f) * Math.sin(Math.PI * v);
      const z = -0.02 - bowl * 0.14;
      ring.push(new THREE.Vector3(x, y, z));
    }
    floorRings.push(ring);
  }
  const floorMesh = new THREE.Mesh(
    buildLoftedGeometry(floorRings, { closedU: false, capStart: false, capEnd: false }),
    materials.palmCavityLiner
  );
  root.add(floorMesh);

  // 2. Dorsal (-Z) 4-Ridge Satin White CNC Armor
  const dorsalMesh = new THREE.Mesh(buildSolidDorsalArmorGeometry(), materials.satinPearlWhite);
  dorsalMesh.castShadow = true;
  dorsalMesh.receiveShadow = true;
  root.add(dorsalMesh);

  // 3. Seamless Unibody Palmar CNC Bezel + Ergonomic Thenar/Hypothenar Cushions (NO tubes or egg spheres!)
  const palmarBezel = new THREE.Mesh(
    buildSeamlessPalmarBezelGeometry(),
    materials.satinPearlWhite
  );
  palmarBezel.castShadow = true;
  palmarBezel.receiveShadow = true;
  root.add(palmarBezel);

  // Subtle dorsal bevel seam on thumb-base flank matching pair2_v6_back.jpg
  const dorsalSeam = new THREE.Mesh(
    createVesselTube(
      [
        [1.16, 1.35, -0.58],
        [1.68, 2.02, -0.52],
        [2.22, 2.75, -0.32],
      ],
      0.015,
      6,
      14
    ),
    materials.seamLineMat
  );
  root.add(dorsalSeam);

  // Micro-milled "404" STRICTLY on Dorsal Lower-Left Bevel ONLY (ZERO on Front Palm!)
  const dorsalLogo = createCurvedDecalMesh(
    1.18,
    2.18,
    (wx, wy) => -0.78 - 0.08 * Math.exp(-Math.pow((wx - 1.18) / 0.7, 2)) + 0.02 * (wy - 2.18),
    0.88,
    0.34,
    true,
    materials.logo404
  );
  root.add(dorsalLogo);

  // 4. Deeply Recessed Concave Titanium Palmar Skeleton
  const internalAnatomy = new THREE.Group();
  internalAnatomy.name = 'InternalAnatomy';

  const carpalBlocks = [
    [-0.56, 1.62, 0.02, 0.28, 0.20, 0.14],
    [-0.08, 1.52, 0.04, 0.32, 0.22, 0.16],
    [0.44, 1.62, 0.02, 0.28, 0.20, 0.14],
    [-0.32, 2.08, 0.02, 0.26, 0.22, 0.14],
    [0.24, 2.12, 0.04, 0.28, 0.22, 0.14],
  ];
  for (const [cx, cy, cz, sx, sy, sz] of carpalBlocks) {
    const carpal = new THREE.Mesh(
      new THREE.CapsuleGeometry(sx * 0.54, sy * 0.54, 6, 12),
      materials.titaniumBone
    );
    carpal.scale.set(1.15, 0.85, sz / (sx * 0.54));
    carpal.position.set(cx, cy, cz);
    carpal.rotation.z = (cx - 0.1) * 0.3;
    internalAnatomy.add(carpal);
  }

  const metacarpalSpecs = [
    { start: [-0.88, 2.08, 0.0], end: [-1.42, 5.75, 0.06], len: 3.72, rShaft: 0.14, rHead: 0.22 },
    { start: [-0.34, 2.20, 0.02], end: [-0.52, 6.42, 0.08], len: 4.24, rShaft: 0.15, rHead: 0.24 },
    { start: [0.22, 2.24, 0.04], end: [0.46, 6.68, 0.10], len: 4.46, rShaft: 0.16, rHead: 0.25 },
    { start: [0.72, 2.18, 0.02], end: [1.34, 6.30, 0.06], len: 4.18, rShaft: 0.15, rHead: 0.24 },
  ];
  for (const mc of metacarpalSpecs) {
    const boneMesh = new THREE.Mesh(
      createAnatomicalBoneGeometry(mc.len, mc.rShaft, mc.rHead, 16),
      materials.titaniumBone
    );
    const pStart = new THREE.Vector3(...mc.start);
    const pEnd = new THREE.Vector3(...mc.end);
    const dir = pEnd.clone().sub(pStart).normalize();
    boneMesh.position.copy(pStart);
    boneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    internalAnatomy.add(boneMesh);
  }

  // 5. Flowing Organic Electric-Current Neural Pathways inside Concave Palm Bowl
  const pulseCurves = [
    [
      [0.06, 1.15, 0.12],
      [0.04, 2.25, 0.14],
      [0.16, 3.60, 0.13],
      [0.36, 5.05, 0.18],
      [0.48, 6.32, 0.22],
    ],
    [
      [0.12, 2.35, 0.14],
      [0.48, 3.50, 0.16],
      [0.98, 4.82, 0.20],
      [1.36, 6.08, 0.22],
    ],
    [
      [0.02, 2.15, 0.14],
      [-0.28, 3.40, 0.15],
      [-0.48, 4.82, 0.18],
      [-0.56, 6.14, 0.20],
    ],
    [
      [-0.12, 1.85, 0.13],
      [-0.66, 3.05, 0.15],
      [-1.12, 4.38, 0.18],
      [-1.44, 5.56, 0.20],
    ],
    [
      [0.24, 1.95, 0.13],
      [0.68, 2.85, 0.18],
      [1.18, 3.65, 0.22],
      [1.86, 4.18, 0.22],
    ],
  ];

  for (let i = 0; i < pulseCurves.length; i++) {
    const r = i === 0 ? 0.036 : 0.026;
    const pulseTube = new THREE.Mesh(
      createVesselTube(pulseCurves[i], r, 8, 32),
      materials.electricPulseVein
    );
    internalAnatomy.add(pulseTube);
  }

  const silverBranches = [
    [
      [-0.08, 1.35, 0.11],
      [-0.22, 2.65, 0.12],
      [-0.08, 4.15, 0.13],
      [-0.38, 5.60, 0.18],
    ],
    [
      [0.18, 3.35, 0.13],
      [0.52, 4.18, 0.15],
      [0.88, 5.32, 0.18],
    ],
    [
      [-0.48, 2.48, 0.12],
      [-0.96, 3.72, 0.15],
      [-1.28, 5.12, 0.18],
    ],
  ];
  for (const branch of silverBranches) {
    const vessel = new THREE.Mesh(
      createVesselTube(branch, 0.018, 8, 24),
      materials.silverVein
    );
    internalAnatomy.add(vessel);
  }

  root.add(internalAnatomy);

  // 6. Concave Cupped Frosted Milky Translucent Palm Bowl Lens
  const palmDomeMesh = new THREE.Mesh(buildConcaveFrostedPalmGeometry(), materials.frostedPalm);
  palmDomeMesh.name = 'FrostedPalmWindow';
  palmDomeMesh.renderOrder = 2;
  root.add(palmDomeMesh);

  return { palmGroup: root, palmDomeMesh };
}
