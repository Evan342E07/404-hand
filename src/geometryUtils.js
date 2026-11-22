import * as THREE from 'three';

/**
 * Builds a closed or open lofted BufferGeometry from an array of cross-section rings.
 * Each ring must have the same number of THREE.Vector3 points.
 * Supports smooth shading + optional end caps so CNC shells look sculpted rather than primitive.
 */
export function buildLoftedGeometry(rings, { closedU = false, capStart = true, capEnd = true } = {}) {
  const numRings = rings.length;
  const ringLen = rings[0].length;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r < numRings; r++) {
    const v = r / Math.max(1, numRings - 1);
    for (let i = 0; i < ringLen; i++) {
      const p = rings[r][i];
      positions.push(p.x, p.y, p.z);
      uvs.push(i / Math.max(1, ringLen - 1), v);
    }
  }

  const segCount = closedU ? ringLen : ringLen - 1;
  for (let r = 0; r < numRings - 1; r++) {
    for (let i = 0; i < segCount; i++) {
      const nextI = (i + 1) % ringLen;
      const a = r * ringLen + i;
      const b = r * ringLen + nextI;
      const c = (r + 1) * ringLen + nextI;
      const d = (r + 1) * ringLen + i;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (capStart) {
    const centerStart = new THREE.Vector3();
    for (let i = 0; i < ringLen; i++) centerStart.add(rings[0][i]);
    centerStart.divideScalar(ringLen);
    const centerIdx = positions.length / 3;
    positions.push(centerStart.x, centerStart.y, centerStart.z);
    uvs.push(0.5, 0);
    for (let i = 0; i < segCount; i++) {
      const nextI = (i + 1) % ringLen;
      indices.push(centerIdx, nextI, i);
    }
  }

  if (capEnd) {
    const lastOffset = (numRings - 1) * ringLen;
    const centerEnd = new THREE.Vector3();
    for (let i = 0; i < ringLen; i++) centerEnd.add(rings[numRings - 1][i]);
    centerEnd.divideScalar(ringLen);
    const centerIdx = positions.length / 3;
    positions.push(centerEnd.x, centerEnd.y, centerEnd.z);
    uvs.push(0.5, 1);
    for (let i = 0; i < segCount; i++) {
      const nextI = (i + 1) % ringLen;
      indices.push(centerIdx, lastOffset + i, lastOffset + nextI);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Helper to create a tapered anatomical titanium metacarpal/phalanx bone
 * using LatheGeometry along local Y axis from y0 to y1.
 */
export function createAnatomicalBoneGeometry(length, rShaft = 0.22, rHead = 0.36, segs = 20) {
  const pts = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * length;
    // Epiphysis flare at both ends, slender diaphysis waist in middle
    const endFlare =
      Math.exp(-Math.pow(t / 0.18, 2)) * (rHead - rShaft) +
      Math.exp(-Math.pow((1 - t) / 0.18, 2)) * (rHead * 1.08 - rShaft);
    // Slight cap rounding at extremes
    let cap = 1;
    if (t === 0 || t === 1) cap = 0.01;
    else if (t < 0.05) cap = Math.sin((t / 0.05) * (Math.PI / 2));
    else if (t > 0.95) cap = Math.sin(((1 - t) / 0.05) * (Math.PI / 2));

    const r = (rShaft + endFlare) * cap;
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const geom = new THREE.LatheGeometry(pts, segs);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Helper to build a smooth organic TubeGeometry along an array of [x,y,z] coordinates.
 */
export function createVesselTube(pointsArray, radius = 0.055, radialSegs = 10, tubularSegs = 32) {
  const curve = new THREE.CatmullRomCurve3(
    pointsArray.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'catmullrom',
    0.5
  );
  return new THREE.TubeGeometry(curve, tubularSegs, radius, radialSegs, false);
}

/**
 * Creates a rounded CNC panel shape (e.g. for bezel inserts or fingernail facets).
 */
export function createRoundedPlateShape(w, h, r) {
  const hw = w / 2;
  const hh = h / 2;
  const cr = Math.min(r, hw, hh);
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hh);
  s.lineTo(hw - cr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  s.lineTo(hw, hh - cr);
  s.quadraticCurveTo(hw, hh, hw - cr, hh);
  s.lineTo(-hw + cr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  s.lineTo(-hw, -hh + cr);
  s.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
  return s;
}
