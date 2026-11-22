import * as THREE from 'three';
import { buildLoftedGeometry, createRoundedPlateShape, createVesselTube } from '../geometryUtils.js';

function createPhalanxShellGeometry(len, rxBase, rzBase, rxTop, rzTop) {
  const rings = [];
  const vSteps = 10;
  const uSteps = 20;

  for (let iv = 0; iv <= vSteps; iv++) {
    const v = iv / vSteps;
    const y = THREE.MathUtils.lerp(0.12, len - 0.12, v);
    const rx = THREE.MathUtils.lerp(rxBase, rxTop, v);
    const rz = THREE.MathUtils.lerp(rzBase, rzTop, v);

    const waist = 1 - 0.07 * Math.sin(Math.PI * v);
    const bevel = v < 0.12 ? 0.90 + 0.10 * (v / 0.12) : v > 0.88 ? 0.90 + 0.10 * ((1 - v) / 0.12) : 1.0;

    const ring = [];
    for (let iu = 0; iu < uSteps; iu++) {
      const th = (iu / uSteps) * Math.PI * 2;
      const cosT = Math.cos(th);
      const sinT = Math.sin(th);
      const squircleX = Math.sign(cosT) * Math.pow(Math.abs(cosT), 0.86);
      const squircleZ = Math.sign(sinT) * Math.pow(Math.abs(sinT), 0.86);
      ring.push(new THREE.Vector3(squircleX * rx * waist * bevel, y, squircleZ * rz * waist * bevel));
    }
    rings.push(ring);
  }
  return buildLoftedGeometry(rings, { closedU: true, capStart: true, capEnd: true });
}

function createDistalTipGeometry(len, rxBase, rzBase) {
  const rings = [];
  const vSteps = 14;
  const uSteps = 20;

  for (let iv = 0; iv <= vSteps; iv++) {
    const v = iv / vSteps;
    const y = THREE.MathUtils.lerp(0.10, len, v);
    const domeFactor = v < 0.55 ? 1 - 0.10 * (v / 0.55) : Math.sqrt(Math.max(0.002, 1 - Math.pow((v - 0.55) / 0.45, 2))) * 0.90;
    const rx = rxBase * domeFactor;
    const rz = rzBase * domeFactor;

    const ring = [];
    for (let iu = 0; iu < uSteps; iu++) {
      const th = (iu / uSteps) * Math.PI * 2;
      ring.push(new THREE.Vector3(Math.cos(th) * rx, y, Math.sin(th) * rz));
    }
    rings.push(ring);
  }
  return buildLoftedGeometry(rings, { closedU: true, capStart: true, capEnd: true });
}

function createMechanicalJoint(radius, width, materials) {
  const g = new THREE.Group();

  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 1.02, 16),
    materials.darkTitanium
  );
  pin.rotation.z = Math.PI / 2;
  g.add(pin);

  for (const sx of [-width * 0.48, width * 0.48]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.44, radius * 0.44, 0.08, 14),
      materials.titaniumMachined
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.x = sx;
    g.add(cap);
  }

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, width * 0.44, 16),
    materials.darkTitanium
  );
  collar.rotation.z = Math.PI / 2;
  g.add(collar);

  const ringAccent = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.90, 0.025, 8, 20),
    materials.titaniumMachined
  );
  ringAccent.rotation.y = Math.PI / 2;
  g.add(ringAccent);

  return g;
}

/**
 * Adds a sleek palmar (+Z) frosted milky translucent window revealing a slim brushed-titanium
 * internal flexor strut & glowing neural micro-trace inside proximal and middle finger segments.
 */
function addPalmarTranslucentWindow(parentGroup, len, rx, rz, materials) {
  // Subtle internal machined titanium flexor rod
  const strut = new THREE.Mesh(
    new THREE.CylinderGeometry(rx * 0.18, rx * 0.18, len * 0.56, 10),
    materials.titaniumBone
  );
  strut.position.set(0, len * 0.5, rz * 0.72);
  parentGroup.add(strut);

  // Subtle internal neural pulse hair-strand
  const microPulse = new THREE.Mesh(
    createVesselTube(
      [
        [0, len * 0.18, rz * 0.78],
        [rx * 0.08, len * 0.50, rz * 0.80],
        [0, len * 0.82, rz * 0.78],
      ],
      0.014,
      6,
      10
    ),
    materials.electricPulseVein
  );
  parentGroup.add(microPulse);

  // Milky frosted translucent belly bezel panel
  const winGeom = new THREE.ExtrudeGeometry(
    createRoundedPlateShape(rx * 1.12, len * 0.60, rx * 0.34),
    { depth: 0.025, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2 }
  );
  const winMesh = new THREE.Mesh(winGeom, materials.frostedPhalanx);
  winMesh.position.set(0, len * 0.50, rz * 0.76);
  winMesh.renderOrder = 2;
  parentGroup.add(winMesh);
}

function buildFinger(spec, materials) {
  const { name, origin, baseSplayZ, lengths, radii } = spec;
  const [l1, l2, l3] = lengths;
  const [r1, r2, r3] = radii;

  const mcpGroup = new THREE.Group();
  mcpGroup.name = `${name}_MCP`;
  mcpGroup.position.set(...origin);
  mcpGroup.rotation.z = baseSplayZ;

  mcpGroup.add(createMechanicalJoint(r1 * 0.92, r1 * 2.05, materials));

  // Proximal Phalanx (Dorsal clean white CNC shell + Palmar frosted translucent belly window)
  const proxShell = new THREE.Mesh(
    createPhalanxShellGeometry(l1, r1, r1 * 0.92, r1 * 0.88, r1 * 0.84),
    materials.satinPearlWhite
  );
  proxShell.castShadow = true;
  proxShell.receiveShadow = true;
  mcpGroup.add(proxShell);
  addPalmarTranslucentWindow(mcpGroup, l1, r1, r1 * 0.92, materials);

  const proxCollar = new THREE.Mesh(
    new THREE.TorusGeometry(r1 * 0.85, 0.02, 8, 18),
    materials.darkTitanium
  );
  proxCollar.rotation.x = Math.PI / 2;
  proxCollar.position.y = l1 * 0.08;
  mcpGroup.add(proxCollar);

  // PIP Joint
  const pipGroup = new THREE.Group();
  pipGroup.name = `${name}_PIP`;
  pipGroup.position.y = l1;
  pipGroup.add(createMechanicalJoint(r2 * 0.90, r2 * 2.0, materials));

  // Middle Phalanx (Dorsal clean white CNC shell + Palmar frosted translucent belly window)
  const midShell = new THREE.Mesh(
    createPhalanxShellGeometry(l2, r2, r2 * 0.90, r2 * 0.86, r2 * 0.82),
    materials.satinPearlWhite
  );
  midShell.castShadow = true;
  midShell.receiveShadow = true;
  pipGroup.add(midShell);
  addPalmarTranslucentWindow(pipGroup, l2, r2, r2 * 0.90, materials);

  // DIP Joint
  const dipGroup = new THREE.Group();
  dipGroup.name = `${name}_DIP`;
  dipGroup.position.y = l2;
  dipGroup.add(createMechanicalJoint(r3 * 0.88, r3 * 1.95, materials));

  // Distal Phalanx (Sleek unified pearl-white ceramic tip on BOTH back nail & front tactile pad!)
  const distalShell = new THREE.Mesh(
    createDistalTipGeometry(l3, r3, r3 * 0.88),
    materials.satinPearlWhite
  );
  distalShell.castShadow = true;
  distalShell.receiveShadow = true;
  dipGroup.add(distalShell);

  // Dorsal (-Z) White Ceramic Fingernail Facet
  const nailGeom = new THREE.ExtrudeGeometry(
    createRoundedPlateShape(r3 * 1.24, l3 * 0.56, r3 * 0.45),
    { depth: 0.05, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.022, bevelSegments: 2 }
  );
  const nailMesh = new THREE.Mesh(nailGeom, materials.ceramicNailWhite);
  nailMesh.position.set(0, l3 * 0.52, -r3 * 0.78);
  nailMesh.rotation.y = Math.PI;
  nailMesh.rotation.x = -0.06;
  dipGroup.add(nailMesh);

  // Palmar (+Z) Sleek Harmonious Matte Pearl Ceramic Fingertip Pad (NO dark gray rubber patches!)
  const tipPadGeom = new THREE.ExtrudeGeometry(
    createRoundedPlateShape(r3 * 1.22, l3 * 0.58, r3 * 0.46),
    { depth: 0.035, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }
  );
  const tipPadMesh = new THREE.Mesh(tipPadGeom, materials.pearlTactileTip);
  tipPadMesh.position.set(0, l3 * 0.48, r3 * 0.72);
  tipPadMesh.rotation.x = -0.05;
  dipGroup.add(tipPadMesh);

  pipGroup.add(dipGroup);
  mcpGroup.add(pipGroup);

  return { mcpGroup, pipGroup, dipGroup };
}

/**
 * Thumb on radial (+X) side with clean brushed titanium rotary base hinge (ZERO exposed copper coils!).
 */
function buildThumb(materials) {
  const cmcGroup = new THREE.Group();
  cmcGroup.name = 'Thumb_CMC';
  cmcGroup.position.set(2.45, 4.18, 0.34);
  cmcGroup.rotation.set(0.18, -0.34, -0.62);

  cmcGroup.add(createMechanicalJoint(0.46, 0.96, materials));

  // Brushed machined titanium harmonic collar rings instead of exposed copper wire
  for (const offset of [-0.14, 0, 0.14]) {
    const tiBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.046, 10, 24),
      materials.titaniumMachined
    );
    tiBand.rotation.y = Math.PI / 2;
    tiBand.position.x = offset;
    cmcGroup.add(tiBand);
  }

  const proxLen = 2.08;
  const proxShell = new THREE.Mesh(
    createPhalanxShellGeometry(proxLen, 0.46, 0.42, 0.40, 0.38),
    materials.satinPearlWhite
  );
  proxShell.castShadow = true;
  proxShell.receiveShadow = true;
  cmcGroup.add(proxShell);
  addPalmarTranslucentWindow(cmcGroup, proxLen, 0.44, 0.40, materials);

  const ipGroup = new THREE.Group();
  ipGroup.name = 'Thumb_IP';
  ipGroup.position.y = proxLen;
  ipGroup.rotation.z = 0.28;
  ipGroup.add(createMechanicalJoint(0.38, 0.78, materials));

  const distLen = 1.72;
  const distMesh = new THREE.Mesh(
    createDistalTipGeometry(distLen, 0.38, 0.35),
    materials.satinPearlWhite
  );
  distMesh.castShadow = true;
  distMesh.receiveShadow = true;
  ipGroup.add(distMesh);

  const nailGeom = new THREE.ExtrudeGeometry(
    createRoundedPlateShape(0.46, 0.88, 0.18),
    { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }
  );
  const nailMesh = new THREE.Mesh(nailGeom, materials.ceramicNailWhite);
  nailMesh.position.set(0, distLen * 0.52, -0.29);
  nailMesh.rotation.y = Math.PI;
  ipGroup.add(nailMesh);

  // Seamless Pearl Tactile Pad on Thumb Tip (NO gray patch)
  const tipPadGeom = new THREE.ExtrudeGeometry(
    createRoundedPlateShape(0.44, 0.90, 0.18),
    { depth: 0.035, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }
  );
  const tipPadMesh = new THREE.Mesh(tipPadGeom, materials.pearlTactileTip);
  tipPadMesh.position.set(0, distLen * 0.48, 0.28);
  ipGroup.add(tipPadMesh);

  cmcGroup.add(ipGroup);

  return { cmcGroup, ipGroup };
}

export function buildAllDigits(materials) {
  const digitsGroup = new THREE.Group();
  digitsGroup.name = 'DigitsAssembly';

  const specs = [
    {
      key: 'index',
      name: 'Index',
      origin: [1.56, 6.72, 0.08],
      baseSplayZ: -0.05,
      lengths: [2.42, 1.58, 1.38],
      radii: [0.40, 0.35, 0.31],
    },
    {
      key: 'middle',
      name: 'Middle',
      origin: [0.48, 7.06, 0.12],
      baseSplayZ: -0.01,
      lengths: [2.72, 1.84, 1.52],
      radii: [0.42, 0.36, 0.32],
    },
    {
      key: 'ring',
      name: 'Ring',
      origin: [-0.62, 6.80, 0.08],
      baseSplayZ: 0.03,
      lengths: [2.44, 1.64, 1.38],
      radii: [0.39, 0.34, 0.30],
    },
    {
      key: 'pinky',
      name: 'Pinky',
      origin: [-1.66, 6.08, 0.02],
      baseSplayZ: 0.09,
      lengths: [1.88, 1.24, 1.14],
      radii: [0.34, 0.29, 0.26],
    },
  ];

  const fingerRigs = {};
  for (const s of specs) {
    const built = buildFinger(s, materials);
    digitsGroup.add(built.mcpGroup);
    fingerRigs[s.key] = { ...built, baseSplayZ: s.baseSplayZ };
  }

  const thumb = buildThumb(materials);
  digitsGroup.add(thumb.cmcGroup);
  fingerRigs.thumb = thumb;

  return { digitsGroup, fingerRigs };
}
