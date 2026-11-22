import * as THREE from 'three/webgpu';

/**
 * Multi-Layer Mechanical Exploded View (0% ~ 100%) + Ultra-Fine 3D Engineering Leader Lines.
 * Tailored cleanly to V2 Sculptural CAD component hierarchy:
 *   - Outer Ceramic Armor Shells -> glide along true anatomical outward normals
 *   - Glass_Palm_Shield -> floats forward (+Z)
 *   - Neural_Palm_* -> floats cleanly in front of Bionic Metacarpal Skeleton
 *   - Bone_Palm_* -> subtle forward anatomical reveal while Tendon_* / Servo_* stay anchored in core
 */
export class ExplodedViewController {
  constructor(scene, rootObj) {
    this.scene = scene;
    this.rootObj = rootObj;
    this.items = [];
    this.amount = 0;
    this.targetAmount = 0;

    this.maxLines = 180;
    const posArr = new Float32Array(this.maxLines * 2 * 3);
    this.lineGeom = new THREE.BufferGeometry();
    this.lineGeom.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    this.lineMat = new THREE.LineBasicNodeMaterial({
      color: 0x8ce6ff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      depthTest: false,
    });
    this.leaderLines = new THREE.LineSegments(this.lineGeom, this.lineMat);
    this.leaderLines.frustumCulled = false;
    this.leaderLines.renderOrder = 10;
    scene.add(this.leaderLines);

    this._worldRest = new THREE.Vector3();
    this._worldCurr = new THREE.Vector3();
    this._tmpLocalRest = new THREE.Vector3();
    this._tmpLocalCurr = new THREE.Vector3();

    this._indexExplodableParts();
  }

  _classifyExplosionVector(mesh) {
    // Support 2-material glTF split primitives cleanly (parent Group holds logical part name, child primitives are _1/_2)
    const rawName = mesh.name;
    const isSecondPrim = /_[234]$/.test(rawName);
    const parentName = mesh.parent && !mesh.parent.isScene && mesh.parent.type === 'Group' ? mesh.parent.name : '';
    const n = parentName && (parentName.startsWith('Armor_') || parentName.startsWith('Forearm_') || parentName.startsWith('Wrist_') || parentName.startsWith('Gear_') || parentName.startsWith('Joint_') || parentName.startsWith('Hydraulic_') || parentName.startsWith('Bone_'))
      ? parentName
      : rawName;
    const lp = mesh.position;
    const lineOk = (flag) => Boolean(flag) && !isSecondPrim;

    // 1. Optical Polycarbonate Palm Shield -> floats crisply forward (+Z)
    if (n === 'Glass_Palm_Shield') return { vec: new THREE.Vector3(0, 0, 3.85), drawLine: lineOk(true) };

    // 2. V9 Hybrid Forearm: Tripo Ceramic Wings (+/-X), Base Cuff (-Y), Intact V-Yoke (+Z), Hydraulics (-Z), Dyson Copper Motor & Emerald PCB!
    if (n.includes('Armor_Forearm_Wing_Left')) return { vec: new THREE.Vector3(-2.85, 0, 0.18), drawLine: lineOk(true) };
    if (n.includes('Armor_Forearm_Wing_Right')) return { vec: new THREE.Vector3(2.85, 0, 0.18), drawLine: lineOk(true) };
    if (n.startsWith('Forearm_BaseCuff') || n.startsWith('Forearm_BaseTrim_')) {
      return { vec: new THREE.Vector3(0, -1.65, 0), drawLine: lineOk(n === 'Forearm_BaseCuff' || n === 'Forearm_BaseCuff_Titanium') };
    }
    if (n === 'Forearm_FrontPlate_Left') return { vec: new THREE.Vector3(-1.25, 0, 1.55), drawLine: lineOk(true) };
    if (n === 'Forearm_FrontPlate_Right') return { vec: new THREE.Vector3(1.25, 0, 1.55), drawLine: lineOk(true) };
    if (n === 'Forearm_Spine_Left') return { vec: new THREE.Vector3(-1.35, 0, -0.95), drawLine: false };
    if (n === 'Forearm_Spine_Right') return { vec: new THREE.Vector3(1.35, 0, -0.95), drawLine: false };
    if (n === 'Forearm_UpperFront_Collar') return { vec: new THREE.Vector3(0, 0.25, 1.35), drawLine: false };
    if (n.startsWith('Hydraulic_Forearm_') || n === 'Piston_Forearm_RearRod') {
      return { vec: new THREE.Vector3(0, 0, -2.15), drawLine: lineOk(n.includes('LowerCylinder') || n.includes('RearCylinder')) };
    }
    if (n.startsWith('PCB_Forearm_') || n.startsWith('Bolt_Forearm_')) {
      return { vec: new THREE.Vector3(0, 0, 2.25), drawLine: lineOk(n === 'PCB_Forearm_TelemetryBoard') };
    }
    if (n === 'Forearm_LightConduit_Lens' || n.includes('Neural_Forearm_TelemetryCore')) {
      return { vec: new THREE.Vector3(0, 0, 2.85), drawLine: lineOk(n.includes('TelemetryCore')) };
    }
    if (n.startsWith('Wrist_Front_VArch') || n === 'Wrist_Front_VKeystone') {
      return { vec: new THREE.Vector3(0, 0.15, 1.85), drawLine: lineOk(true) };
    }
    if (n.startsWith('Forearm_CopperCoil_') || n.startsWith('Forearm_MotorRetainer_')) {
      return { vec: new THREE.Vector3(0, 0, 0.45), drawLine: false };
    }

    // 3. V9 Hybrid Palm Multi-Layer Teardown (Neural -> Champagne Metacarpals -> Thenar/Ulnar Shells -> Dyson Copper Servos -> Emerald PCB -> Dorsal Carapace!)
    if (n.includes('Armor_Palm_ThenarModule')) return { vec: new THREE.Vector3(2.45, -0.15, 1.25), drawLine: lineOk(true) };
    if (n === 'Armor_Palm_UlnarShell') return { vec: new THREE.Vector3(-2.55, 0.0, 0.15), drawLine: lineOk(true) };
    if (n === 'Armor_Palm_RadialDorsalPlate') return { vec: new THREE.Vector3(1.95, 0.10, -1.95), drawLine: lineOk(true) };
    if (n === 'Armor_Palm_DorsalTrim') return { vec: new THREE.Vector3(0, -0.15, -2.15), drawLine: false };
    if (n === 'Armor_Palm_MainBody') return { vec: new THREE.Vector3(0, 0.05, -2.55), drawLine: lineOk(true) };
    if (n.startsWith('Plaque_404_')) return { vec: new THREE.Vector3(0, 0.05, -2.55), drawLine: false };
    // Wrist dorsal flowing optical halos & Swiss horology accents MUST explode backward (-Z) with wrist drum, NOT forward to palm!
    if (n === 'Neural_Wrist_HaloOuter' || n === 'Neural_Wrist_HaloInner' || n.startsWith('Neural_Wrist_Accent_')) {
      return { vec: new THREE.Vector3(0, 0.02, -2.62), drawLine: false };
    }
    if (n.startsWith('Neural_')) return { vec: new THREE.Vector3(0, 0.05, 2.95), drawLine: false };
    if (n === 'Bone_Palm_Metacarpal_Center') return { vec: new THREE.Vector3(0.0, 0.05, 1.95), drawLine: lineOk(true) };
    if (n === 'Bone_Palm_Metacarpal_Radial') return { vec: new THREE.Vector3(0.55, 0.05, 2.25), drawLine: lineOk(true) };
    if (n === 'Bone_Palm_Metacarpal_Ulnar') return { vec: new THREE.Vector3(-0.65, 0.05, 2.25), drawLine: lineOk(true) };
    if (n.startsWith('Bone_Palm_')) return { vec: new THREE.Vector3(lp.x * 0.18, 0.08, 1.85), drawLine: false };
    if (n.startsWith('Servo_Palm_')) return { vec: new THREE.Vector3(0, 0.02, 0.55), drawLine: lineOk(n.startsWith('Servo_Palm_Stator_')) };
    if (n.startsWith('PCB_Palm_') || n.startsWith('Bolt_Palm_')) {
      return { vec: new THREE.Vector3(0, 0.05, -0.95), drawLine: lineOk(n === 'PCB_Palm_NeuralController') };
    }

    // 4. Swiss Horology + Tripo Wrist Cutaway (Gimbal Ball -> Copper Stator -> Chrome Bearing Balls -> Drum -> 36-Tooth Gear -> Escapement Bridges & Bezel!)
    if (n.startsWith('Wrist_CopperStator_')) return { vec: new THREE.Vector3(0, 0, -1.05), drawLine: false };
    if (n.startsWith('Wrist_BearingBall_')) return { vec: new THREE.Vector3(0, 0, -1.55), drawLine: false };
    if (n === 'Wrist_SwissBezel_Outer' || n.startsWith('Wrist_SwissScrew_') || n.startsWith('Wrist_SwissTick_')) {
      return { vec: new THREE.Vector3(0, 0.03, -2.42), drawLine: false };
    }
    if (n === 'Wrist_SwissGear_Ring' || n === 'Wrist_SwissBezel_Inner') {
      return { vec: new THREE.Vector3(0, 0.02, -2.75), drawLine: false };
    }
    if (
      n === 'Wrist_SwissCenter_Cap' ||
      n === 'Wrist_SwissCenter_Ring' ||
      n === 'Wrist_SwissCenter_Jewel' ||
      n.startsWith('Wrist_EscapementBridge_') ||
      n.startsWith('Wrist_GoldJewel_')
    ) {
      return { vec: new THREE.Vector3(0, 0.02, -3.05), drawLine: lineOk(n === 'Wrist_SwissCenter_Cap') };
    }
    if (n === 'Gear_Wrist_DorsalTurbine_Drum') return { vec: new THREE.Vector3(0, 0.05, -2.15), drawLine: lineOk(true) };
    if (n === 'Wrist_Bearing_Right' || n === 'Wrist_Gimbal_RightCollar') {
      return { vec: new THREE.Vector3(2.05, 0.0, 0.0), drawLine: lineOk(n === 'Wrist_Bearing_Right') };
    }
    if (n === 'Wrist_Bearing_LeftOuter' || n === 'Wrist_Gimbal_LeftCollar') {
      return { vec: new THREE.Vector3(-2.05, 0.0, 0.0), drawLine: lineOk(n === 'Wrist_Bearing_LeftOuter') };
    }
    if (n === 'Wrist_Gimbal_FrontLink') return { vec: new THREE.Vector3(-0.90, 0.0, 1.15), drawLine: false };

    // 5. V9 Semantic Thumb & 4-Finger Assemblies (staggered solid dark-metal knuckles + spotless ceramic phalanges!)
    if (n.startsWith('Joint_Thumb_CMC')) return { vec: new THREE.Vector3(1.15, 0.25, 0.35), drawLine: lineOk(n.endsWith('FrontRing')) };
    if (n === 'Armor_Thumb_Proximal') return { vec: new THREE.Vector3(1.85, 0.55, 0.25), drawLine: lineOk(true) };
    if (n.startsWith('Joint_Thumb_MCP') || n.startsWith('Joint_Thumb_IP')) {
      return { vec: new THREE.Vector3(2.35, 0.80, 0.20), drawLine: lineOk(n.startsWith('Joint_Thumb_IP')) };
    }
    if (n === 'Armor_Thumb_Distal') return { vec: new THREE.Vector3(2.95, 1.15, 0.15), drawLine: lineOk(true) };

    const fingerSpread = { Index: 0.42, Middle: 0.0, Ring: -0.42, Pinky: -0.86 };
    for (const [fn, sx] of Object.entries(fingerSpread)) {
      if (n.startsWith(`Joint_${fn}_MCP`)) return { vec: new THREE.Vector3(sx * 0.45, 0.40, -0.12), drawLine: false };
      if (n === `Armor_${fn}_Proximal`) return { vec: new THREE.Vector3(sx * 0.90, 0.88, -0.26), drawLine: lineOk(true) };
      if (n.startsWith(`Joint_${fn}_PIP`)) return { vec: new THREE.Vector3(sx * 1.25, 1.38, -0.38), drawLine: false };
      if (n === `Armor_${fn}_Middle`) return { vec: new THREE.Vector3(sx * 1.60, 1.88, -0.50), drawLine: lineOk(true) };
      if (n.startsWith(`Joint_${fn}_DIP`)) return { vec: new THREE.Vector3(sx * 1.95, 2.38, -0.62), drawLine: false };
      if (n === `Armor_${fn}_Distal`) return { vec: new THREE.Vector3(sx * 2.30, 2.88, -0.74), drawLine: lineOk(true) };
    }

    return null;
  }

  _indexExplodableParts() {
    this.rootObj.traverse((node) => {
      if (!node.isMesh) return;
      node.userData.restPos = node.position.clone();
      node.userData.popProgress = 0;
      node.userData.hiddenByUser = false;

      const info = this._classifyExplosionVector(node);
      if (info) {
        // Compute true geometry bounding-box center so 3D engineering leader lines connect
        // each exploded shell's actual visual centroid back to its exact rest seat!
        node.geometry.computeBoundingBox();
        const geomCenter = new THREE.Vector3();
        if (node.geometry.boundingBox) {
          node.geometry.boundingBox.getCenter(geomCenter);
        }
        this.items.push({
          mesh: node,
          restPos: node.position.clone(),
          geomCenter,
          explodeVec: info.vec,
          drawLine: info.drawLine,
        });
      }
    });
  }

  setTarget(val) {
    this.targetAmount = THREE.MathUtils.clamp(val, 0, 1);
  }

  update(dt) {
    const alpha = 1 - Math.exp(-dt * 9.0);
    this.amount += (this.targetAmount - this.amount) * alpha;

    const posAttr = this.lineGeom.attributes.position;
    let lineIdx = 0;
    const worldRest = this._worldRest;
    const worldCurr = this._worldCurr;
    const localRest = this._tmpLocalRest;
    const localCurr = this._tmpLocalCurr;

    for (const item of this.items) {
      const m = item.mesh;
      const popTarget = m.userData.hiddenByUser ? 1 : 0;
      m.userData.popProgress += (popTarget - m.userData.popProgress) * (1 - Math.exp(-dt * 10));

      const totalScale = this.amount + m.userData.popProgress * 1.15;
      m.position.copy(item.restPos).addScaledVector(item.explodeVec, totalScale);

      if (m.userData.popProgress > 0.02) {
        m.material.transparent = true;
        m.material.opacity = Math.max(0.0, 1.0 - m.userData.popProgress * 1.1);
        m.visible = m.userData.popProgress < 0.96;
      } else if (m.name !== 'Glass_Palm_Shield' && m.material.opacity !== 1.0 && !m.userData.hiddenByUser) {
        m.material.opacity = 1.0;
        m.material.transparent = false;
        m.visible = true;
      } else if (!m.userData.hiddenByUser) {
        m.visible = true;
      }

      if (item.drawLine && this.amount > 0.03 && m.visible && lineIdx < this.maxLines && m.parent) {
        localRest.copy(item.geomCenter).applyQuaternion(m.quaternion).add(item.restPos);
        localCurr.copy(item.geomCenter).applyQuaternion(m.quaternion).add(m.position);
        worldRest.copy(localRest).applyMatrix4(m.parent.matrixWorld);
        worldCurr.copy(localCurr).applyMatrix4(m.parent.matrixWorld);

        const base = lineIdx * 6;
        posAttr.array[base] = worldRest.x;
        posAttr.array[base + 1] = worldRest.y;
        posAttr.array[base + 2] = worldRest.z;
        posAttr.array[base + 3] = worldCurr.x;
        posAttr.array[base + 4] = worldCurr.y;
        posAttr.array[base + 5] = worldCurr.z;
        lineIdx++;
      }
    }

    posAttr.needsUpdate = true;
    this.lineGeom.setDrawRange(0, lineIdx * 2);
    this.lineMat.opacity = this.amount > 0.03 ? Math.min(0.62, this.amount * 0.78) : 0;
    this.leaderLines.visible = this.amount > 0.03 && lineIdx > 0;
  }
}
