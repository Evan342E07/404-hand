import * as THREE from 'three/webgpu';
import { vec3, uniform } from 'three/tsl';

/**
 * Native WebGPU / TSL 3D Laser Section Slicer Controller:
 * Drives shared TSL `uSliceY` & `uSliceActive` uniforms directly in ceramic armor & optical glass
 * shaders via `Discard()` + glowing HDR cyan laser-cut edge seam, exposing the sculpted silver
 * titanium metacarpals, neural veins, tendons, and micro-servos cleanly on WebGPU & WebGL2!
 */
export class SectionSlicerController {
  constructor(scene) {
    this.scene = scene;
    this.amount = 0;
    this.targetAmount = 0;
    this.sharedUniforms = null;
    this.uRingOpacity = uniform(0.0);

    const ringGeom = new THREE.RingGeometry(3.8, 3.92, 64);
    const ringMat = new THREE.MeshBasicNodeMaterial({
      color: 0x7ae2ff,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    ringMat.opacityNode = this.uRingOpacity;
    ringMat.colorNode = vec3(0.48, 0.92, 1.0).mul(1.85);

    this.scanRing = new THREE.Mesh(ringGeom, ringMat);
    this.scanRing.rotation.x = -Math.PI / 2;
    this.scanRing.visible = false;
    this.scanRing.renderOrder = 9;
    scene.add(this.scanRing);
  }

  attachModel(rootObj, matRefs) {
    this.sharedUniforms = matRefs?.sharedUniforms || null;
    this._syncPlane();
  }

  setTarget(val) {
    this.targetAmount = THREE.MathUtils.clamp(val, 0, 1);
  }

  _syncPlane() {
    if (this.amount <= 0.005) {
      if (this.sharedUniforms?.uSliceActive) {
        this.sharedUniforms.uSliceActive.value = 0.0;
        this.sharedUniforms.uSliceY.value = 30.0;
      }
      this.scanRing.visible = false;
      this.uRingOpacity.value = 0.0;
      return;
    }
    const cutY = THREE.MathUtils.lerp(13.2, -8.4, this.amount);
    if (this.sharedUniforms?.uSliceActive) {
      this.sharedUniforms.uSliceActive.value = 1.0;
      this.sharedUniforms.uSliceY.value = cutY;
    }
    this.scanRing.position.y = cutY;
    this.scanRing.visible = true;
    this.uRingOpacity.value = 0.72;
  }

  update(dt) {
    const alpha = 1 - Math.exp(-dt * 11.0);
    if (Math.abs(this.targetAmount - this.amount) > 0.0005) {
      this.amount += (this.targetAmount - this.amount) * alpha;
      this._syncPlane();
    }
  }
}
