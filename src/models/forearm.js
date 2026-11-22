import * as THREE from 'three';
import { buildLoftedGeometry } from '../geometryUtils.js';

/**
 * Shortened ~45% Forearm Taper Envelope (y from -6.85 to -1.05):
 * Matches the sleek twin wrap-around split white side shells + titanium base cuff
 * from pair2_v6_back.jpg, cropped gracefully to emphasize hand dexterity.
 */
function forearmProfile(t) {
  const rx = THREE.MathUtils.lerp(1.56, 1.50, t) - 0.12 * Math.sin(Math.PI * t);
  const rz = THREE.MathUtils.lerp(1.24, 1.18, t) - 0.08 * Math.sin(Math.PI * t);
  return { rx, rz };
}

function createShortForearmShell(side = 1) {
  const yStart = -5.78;
  const yEnd = -0.38;
  const vSteps = 22;
  const uOuterSteps = 12;
  const wallThickness = 0.22;
  const rings = [];

  for (let iv = 0; iv <= vSteps; iv++) {
    const t = iv / vSteps;
    const y = THREE.MathUtils.lerp(yStart, yEnd, t);
    const { rx, rz } = forearmProfile(t);

    const endBevel =
      t < 0.08 ? 0.55 + 0.45 * (t / 0.08) : t > 0.86 ? 0.45 + 0.55 * ((1 - t) / 0.14) : 1.0;

    // Upper rim arches up nicely along lateral flanks (-/+ X) while receding gracefully below wrist center!
    let slotHalfX = 0.46;
    if (t < 0.18) slotHalfX = THREE.MathUtils.lerp(0.68, 0.46, t / 0.18);
    else if (t > 0.72) slotHalfX = THREE.MathUtils.lerp(0.46, rx * 0.76, (t - 0.72) / 0.28);

    const edgeTheta = Math.acos(THREE.MathUtils.clamp(slotHalfX / rx, 0.05, 0.92));
    const thetaStart = side > 0 ? -edgeTheta : Math.PI - edgeTheta;
    const thetaEnd = side > 0 ? edgeTheta : Math.PI + edgeTheta;

    const ringPts = [];
    for (let iu = 0; iu <= uOuterSteps; iu++) {
      const f = iu / uOuterSteps;
      const th = THREE.MathUtils.lerp(thetaStart, thetaEnd, f);
      const scale = endBevel === 1 ? 1 : 0.97 + 0.03 * endBevel;
      ringPts.push(new THREE.Vector3(Math.cos(th) * rx * scale, y, Math.sin(th) * rz * scale));
    }
    const thickness = wallThickness * endBevel;
    for (let iu = uOuterSteps; iu >= 0; iu--) {
      const f = iu / uOuterSteps;
      const th = THREE.MathUtils.lerp(thetaStart, thetaEnd, f);
      ringPts.push(
        new THREE.Vector3(Math.cos(th) * (rx - thickness), y, Math.sin(th) * (rz - thickness))
      );
    }
    ringPts.reverse();
    rings.push(ringPts);
  }

  return buildLoftedGeometry(rings, { closedU: true, capStart: true, capEnd: true });
}

/**
 * Builds the shortened high-tech Forearm Cuff:
 * - Zero exposed orange copper wires anywhere
 * - Dorsal (-Z): CNC stepped telescoping titanium linear piston actuator matching pair2_v6_back.jpg
 * - Palmar (+Z): Twin machined parallel brushed-titanium actuators shielded behind smoked optical glass
 */
export function buildForearmAssembly(materials) {
  const root = new THREE.Group();
  root.name = 'ForearmAssembly';

  // 1. Floating Brushed Dark-Titanium Circular Base Cuff (y = -6.85 to -5.72)
  const cuffPts = [
    new THREE.Vector2(0.01, -6.85),
    new THREE.Vector2(1.48, -6.85),
    new THREE.Vector2(1.52, -6.77),
    new THREE.Vector2(1.52, -5.92),
    new THREE.Vector2(1.44, -5.80),
    new THREE.Vector2(1.36, -5.68),
    new THREE.Vector2(0.01, -5.68),
  ];
  const cuffGeom = new THREE.LatheGeometry(cuffPts, 48);
  cuffGeom.scale(1.0, 1.0, 0.83);
  const cuffMesh = new THREE.Mesh(cuffGeom, materials.darkTitanium);
  cuffMesh.castShadow = true;
  cuffMesh.receiveShadow = true;
  root.add(cuffMesh);

  const cuffRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.48, 0.028, 10, 48),
    materials.titaniumMachined
  );
  cuffRing.rotation.x = Math.PI / 2;
  cuffRing.scale.set(1.0, 0.83, 1.0);
  cuffRing.position.y = -5.90;
  root.add(cuffRing);

  // 2. Dark Titanium Inner Structural Core Housing
  const coreRings = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = THREE.MathUtils.lerp(-5.78, -1.05, t);
    const { rx, rz } = forearmProfile(t);
    const coreRx = rx - 0.30;
    const coreRz = rz - 0.34;
    const ring = [];
    for (let j = 0; j < 26; j++) {
      const th = -(j / 26) * Math.PI * 2;
      ring.push(new THREE.Vector3(Math.cos(th) * coreRx, y, Math.sin(th) * coreRz * 0.84));
    }
    coreRings.push(ring);
  }
  const coreMesh = new THREE.Mesh(
    buildLoftedGeometry(coreRings, { closedU: true, capStart: true, capEnd: true }),
    materials.darkTitanium
  );
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  root.add(coreMesh);

  // 3. Sculpted Tapered Satin Pearl-White Split Shells
  const shellRight = new THREE.Mesh(createShortForearmShell(1), materials.satinPearlWhite);
  shellRight.castShadow = true;
  shellRight.receiveShadow = true;
  root.add(shellRight);

  const shellLeft = new THREE.Mesh(createShortForearmShell(-1), materials.satinPearlWhite);
  shellLeft.castShadow = true;
  shellLeft.receiveShadow = true;
  root.add(shellLeft);

  // 4. Dorsal (-Z) Aerospace Telescoping Titanium Linear Piston (matching pair2_v6_back.jpg!)
  const dorsalSlot = new THREE.Group();
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.25, 2.35, 24),
    materials.titaniumMachined
  );
  barrel.position.set(0, -4.15, -0.78);
  dorsalSlot.add(barrel);

  const midCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.32, 24),
    materials.darkTitanium
  );
  midCollar.position.set(0, -3.15, -0.78);
  dorsalSlot.add(midCollar);

  const lowerCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.28, 24),
    materials.darkTitanium
  );
  lowerCap.position.set(0, -5.22, -0.78);
  dorsalSlot.add(lowerCap);

  const upperRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 1.95, 18),
    materials.titaniumBone
  );
  upperRod.position.set(0, -2.08, -0.78);
  dorsalSlot.add(upperRod);
  root.add(dorsalSlot);

  // 5. Palmar (+Z) Smoked-Glass Shielded Twin Precision Titanium Micro-Pistons (Zero copper wires!)
  const palmarSlot = new THREE.Group();
  for (const sx of [-0.22, 0.22]) {
    const pCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.15, 2.6, 18),
      materials.titaniumMachined
    );
    pCyl.position.set(sx, -4.05, 0.72);
    palmarSlot.add(pCyl);

    const pRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.55, 16),
      materials.titaniumBone
    );
    pRod.position.set(sx, -2.18, 0.72);
    palmarSlot.add(pRod);
  }

  // Machined bridge bracket holding twin micro-pistons
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.28, 0.28),
    materials.darkTitanium
  );
  bridge.position.set(0, -2.85, 0.74);
  palmarSlot.add(bridge);

  // Smoked translucent optical armor shield enclosing the palmar dual pistons
  const shield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.48, 3.6, 18, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
    materials.smokedGlass
  );
  shield.position.set(0, -3.55, 0.56);
  palmarSlot.add(shield);

  root.add(palmarSlot);

  return root;
}
