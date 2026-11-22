import * as THREE from 'three';

/**
 * High-Tech Aerospace Coaxial Gyroscopic & Harmonic Turbine Wrist Centerpiece (at y = 0):
 * - Dorsal (-Z): Concentric multi-ring harmonic spline bearing + 24 radial turbine micro-vanes
 *   matching pair2_v6_back.jpg's signature wrist highlight.
 * - Palmar (+Z): Precision dark-titanium coaxial universal gimbal rings + chamfered turbine
 *   collar & flanking torque forks (ZERO copper wires).
 */
export function buildWristAssembly(materials) {
  const wristLower = new THREE.Group();
  wristLower.name = 'WristLowerAssembly';

  // Recessed cylindrical lower wrist socket collar (sits neatly inside upper forearm white wings!)
  const cupPts = [
    new THREE.Vector2(0.01, -1.35),
    new THREE.Vector2(1.18, -1.35),
    new THREE.Vector2(1.14, -0.75),
    new THREE.Vector2(0.98, -0.28),
    new THREE.Vector2(0.01, -0.28),
  ];
  const cupGeom = new THREE.LatheGeometry(cupPts, 36);
  cupGeom.scale(1.0, 1.0, 0.78);
  const cupMesh = new THREE.Mesh(cupGeom, materials.darkTitanium);
  cupMesh.castShadow = true;
  wristLower.add(cupMesh);

  for (const sx of [-0.94, 0.94]) {
    const cheek = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 1.28, 18),
      materials.darkTitanium
    );
    cheek.position.set(sx, -0.54, 0);
    cheek.rotation.z = sx > 0 ? -0.08 : 0.08;
    wristLower.add(cheek);
  }

  // Central Articulated Wrist Pivot Group
  const wristPivot = new THREE.Group();
  wristPivot.name = 'WristPivot';

  // Spherical dark-titanium gimbal core sealing all flexion/tilt seams
  const coreBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.92, 24, 18),
    materials.darkTitanium
  );
  coreBall.scale.set(1.18, 0.92, 0.76);
  coreBall.position.y = 0.06;
  wristPivot.add(coreBall);

  const mainAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 2.34, 24),
    materials.darkTitanium
  );
  mainAxle.rotation.z = Math.PI / 2;
  wristPivot.add(mainAxle);

  // --- DORSAL (-Z) HIGH-TECH GYROSCOPIC HARMONIC TURBINE BEARING ---
  const dorsalBearing = new THREE.Group();
  dorsalBearing.position.set(0, 0.04, -0.58);

  const outerBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.98, 0.98, 0.34, 48),
    materials.darkTitanium
  );
  outerBezel.rotation.x = Math.PI / 2;
  outerBezel.castShadow = true;
  dorsalBearing.add(outerBezel);

  // Outer stepped titanium flange
  const flangeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.89, 0.055, 12, 48),
    materials.titaniumMachined
  );
  flangeRing.position.z = -0.17;
  dorsalBearing.add(flangeRing);

  // 24 Radial Precision Turbine / Planetary Spline Vanes
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const vane = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.22, 0.10),
      materials.titaniumMachined
    );
    vane.position.set(Math.cos(a) * 0.71, Math.sin(a) * 0.71, -0.16);
    vane.rotation.z = a + Math.PI / 2;
    dorsalBearing.add(vane);
  }

  // Inner concentric gimbal race ring
  const innerRace = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.045, 12, 36),
    materials.titaniumMachined
  );
  innerRace.position.z = -0.18;
  dorsalBearing.add(innerRace);

  // Micro 8-bolt harmonic hub face
  const capDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.44, 0.30, 32),
    materials.titaniumMachined
  );
  capDisc.rotation.x = Math.PI / 2;
  capDisc.position.z = -0.14;
  dorsalBearing.add(capDisc);

  wristPivot.add(dorsalBearing);

  // --- PALMAR (+Z) COAXIAL TITANIUM GIMBAL & TORQUE RING (ZERO COPPER WIRES) ---
  const palmarGimbal = new THREE.Group();
  palmarGimbal.position.set(0, 0.04, 0.40);

  // Coaxial central machined titanium harmonic drum visible between palmar clevis forks
  const frontHarmonicDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, 1.32, 28),
    materials.titaniumMachined
  );
  frontHarmonicDrum.rotation.z = Math.PI / 2;
  frontHarmonicDrum.position.z = 0.06;
  palmarGimbal.add(frontHarmonicDrum);

  // Stepped dark-titanium spline rings wrapping coaxial wrist axle cleanly
  for (const rx of [-0.46, -0.18, 0.18, 0.46]) {
    const splineRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.038, 10, 28),
      materials.darkTitanium
    );
    splineRing.rotation.y = Math.PI / 2;
    splineRing.position.set(rx, 0, 0.06);
    palmarGimbal.add(splineRing);
  }

  // Dual lateral brushed titanium torque forks bridging forearm socket into carpal tunnel
  for (const cx of [-0.78, 0.78]) {
    const fork = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 1.05, 0.56),
      materials.darkTitanium
    );
    fork.position.set(cx, 0.02, 0.12);
    palmarGimbal.add(fork);
  }

  // Central recessed machined actuator link cylinder
  const centerPist = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.18, 1.32, 16),
    materials.titaniumMachined
  );
  centerPist.position.set(0, 0.06, 0.22);
  palmarGimbal.add(centerPist);

  wristPivot.add(palmarGimbal);

  return { wristLower, wristPivot };
}
