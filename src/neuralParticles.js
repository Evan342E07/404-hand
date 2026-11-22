import * as THREE from 'three/webgpu';
import {
  Fn,
  uv,
  uniform,
  instancedArray,
  instanceIndex,
  attribute,
  float,
  vec3,
  vec4,
  sin,
  cos,
  exp,
  fract,
  length,
  mix,
  smoothstep,
  max,
} from 'three/tsl';

const TOTAL_PARTICLES = 16384; // 16K GPU Compute Shader Particle Field!
const VEIN_PARTICLES = 12288;  // 12,288 high-density bio-electric photons along neural veins & forearm core

// 4 Sculpted S-curved palmar neural veins (world-rest space transformed directly by Bone_Palm_Metacarpal_Center.matrixWorld!)
// + Forearm vertical telemetry light bar (transformed directly by Forearm_LightConduit_Lens.matrixWorld!)
const NEURAL_PATHS_WORLD = [
  { p0: [-0.08, 1.98, 1.56], p1: [ 0.96, 5.10, 1.50], amp: 0.12, isPalm: true },
  { p0: [-0.42, 1.95, 1.58], p1: [-0.28, 5.42, 1.52], amp: 0.14, isPalm: true },
  { p0: [-0.62, 2.25, 1.58], p1: [-1.38, 5.20, 1.50], amp: 0.12, isPalm: true },
  { p0: [-0.98, 2.60, 1.54], p1: [-2.16, 4.98, 1.46], amp: 0.10, isPalm: true },
  // Forearm vertical ice-blue telemetry conduit (dead-center inside tripo_part_29!)
  { p0: [-0.32, -5.32, 0.80], p1: [-0.32, -2.06, 0.78], amp: 0.018, isPalm: false },
  { p0: [-0.32, -5.10, 0.80], p1: [-0.32, -2.20, 0.79], amp: 0.014, isPalm: false },
];

/**
 * 16,384-Particle Dual-Backend Native WebGPU Compute Shader & TSL Bio-Electric Field:
 *   - On WebGPU Backend: executes a true WGSL Compute Shader (`Fn(...).compute(16384)`) updating
 *     16,384 particle states in GPU storage buffers (`instancedArray`) every frame via `renderer.compute()`!
 *   - On WebGL2 Fallback Backend: automatically executes an equivalent zero-CPU-overhead TSL GPU
 *     analytic vertex-node shader on the same 16,384 instanced `SpriteNodeMaterial` billboards!
 *   - Single Draw Call (`THREE.Sprite` with `count = 16384`).
 */
export class BioNeuralParticleSystem {
  constructor() {
    this.count = TOTAL_PARTICLES;
    this.sprite = null;
    this.computeUpdate = null;
    this.isComputeMode = false;
    this.enabled = true;
    this.fieldEnabled = true;

    this.uTime = uniform(0.0);
    this.uDelta = uniform(0.016);
    this.uPulseBoost = uniform(0.0);
    this.uEnabled = uniform(1.0);
    this.uFieldEnabled = uniform(1.0);
    this.uPalmMatrix = uniform(new THREE.Matrix4());
    this.uForearmMatrix = uniform(new THREE.Matrix4());
    this.uAccentCore = uniform(new THREE.Color(0x52ccff));
    this.uAccentHot = uniform(new THREE.Color(0xf2fcff));
  }

  init(scene, renderer, options = {}) {
    this.dispose();
    const isWebGPU = Boolean(renderer?.backend?.isWebGPUBackend);
    this.isComputeMode = isWebGPU;

    const totalCount = Math.max(1024, Math.min(TOTAL_PARTICLES, options.maxParticles || TOTAL_PARTICLES));
    const veinCount = Math.floor(totalCount * 0.75);
    this.count = totalCount;

    // Pre-generate deterministic initial particle seed arrays
    const startArr = new Float32Array(totalCount * 4);
    const endArr = new Float32Array(totalCount * 4);
    // paramArr: x = phase [0..1], y = speed, z = size, w = kind (0 = neural vein photon, 1 = ambient plasma mote)
    const paramArr = new Float32Array(totalCount * 4);
    const stateArr = new Float32Array(totalCount * 4);

    for (let i = 0; i < totalCount; i++) {
      const i4 = i * 4;
      if (i < veinCount) {
        const seg = NEURAL_PATHS_WORLD[i % NEURAL_PATHS_WORLD.length];
        const phase = Math.random();
        const speed = 0.28 + Math.random() * 0.42;
        const size = 0.036 + Math.random() * 0.052;
        const jitterX = (Math.random() - 0.5) * 0.06;
        const jitterZ = (Math.random() - 0.5) * 0.035;

        startArr[i4] = seg.p0[0] + jitterX;
        startArr[i4 + 1] = seg.p0[1];
        startArr[i4 + 2] = seg.p0[2] + jitterZ;
        startArr[i4 + 3] = seg.amp;

        endArr[i4] = seg.p1[0] + jitterX;
        endArr[i4 + 1] = seg.p1[1];
        endArr[i4 + 2] = seg.p1[2] + jitterZ;
        endArr[i4 + 3] = seg.isPalm ? 1.0 : 0.0;

        paramArr[i4] = phase;
        paramArr[i4 + 1] = speed;
        paramArr[i4 + 2] = size;
        paramArr[i4 + 3] = 0.0; // neural vein photon

        stateArr[i4] = startArr[i4] + (endArr[i4] - startArr[i4]) * phase;
        stateArr[i4 + 1] = startArr[i4 + 1] + (endArr[i4 + 1] - startArr[i4 + 1]) * phase;
        stateArr[i4 + 2] = startArr[i4 + 2] + (endArr[i4 + 2] - startArr[i4 + 2]) * phase;
        stateArr[i4 + 3] = phase;
      } else {
        // 4,096 ultra-delicate near-field bio-aura motes hugging the bionic hand silhouette (clean dark backdrop!)
        const theta = Math.random() * Math.PI * 2;
        const radius = 2.6 + Math.pow(Math.random(), 1.25) * 4.4;
        const yPos = -8.2 + Math.random() * 19.6;
        const phase = Math.random();
        const speed = 0.05 + Math.random() * 0.12;
        const size = 0.018 + Math.random() * 0.032;

        startArr[i4] = theta;
        startArr[i4 + 1] = radius;
        startArr[i4 + 2] = yPos;
        startArr[i4 + 3] = (Math.random() - 0.5) * 0.55; // vertical drift

        endArr[i4] = Math.cos(theta) * radius;
        endArr[i4 + 1] = yPos;
        endArr[i4 + 2] = Math.sin(theta) * radius;
        endArr[i4 + 3] = 0.0;

        paramArr[i4] = phase;
        paramArr[i4 + 1] = speed;
        paramArr[i4 + 2] = size;
        paramArr[i4 + 3] = 1.0; // ambient micro-plasma mote

        stateArr[i4] = endArr[i4];
        stateArr[i4 + 1] = endArr[i4 + 1];
        stateArr[i4 + 2] = endArr[i4 + 2];
        stateArr[i4 + 3] = phase;
      }
    }

    const mat = new THREE.SpriteNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Shared circular soft Gaussian photon glow kernel in Sprite UV space
    const radialDist = length(uv().sub(0.5)).mul(2.0);
    const coreGlow = exp(radialDist.mul(radialDist).negate().mul(5.8)).mul(
      smoothstep(float(1.0), float(0.75), radialDist)
    );

    if (isWebGPU) {
      // === TRUE NATIVE WEBGPU COMPUTE SHADER (16,384 GPU THREADS IN PARALLEL) ===
      const stateBuf = instancedArray(stateArr, 'vec4');
      const startBuf = instancedArray(startArr, 'vec4');
      const endBuf = instancedArray(endArr, 'vec4');
      const paramBuf = instancedArray(paramArr, 'vec4');

      this.computeUpdate = Fn(() => {
        const idx = instanceIndex;
        const st = stateBuf.element(idx);
        const p0 = startBuf.element(idx);
        const p1 = endBuf.element(idx);
        const prm = paramBuf.element(idx);

        const speed = prm.y;
        const isAmbient = prm.w;
        const boostSpeed = float(0.45).add(this.uPulseBoost.mul(0.85));
        const nextPhase = fract(st.w.add(this.uDelta.mul(speed).mul(boostSpeed)));

        // Branchless GPU trajectory evaluation: vein impulse vs helical ambient field
        const vPos = mix(p0.xyz, p1.xyz, nextPhase);
        const waveX = sin(nextPhase.mul(6.28318).add(prm.x.mul(14.0))).mul(p0.w);
        const waveZ = cos(nextPhase.mul(3.14159)).mul(0.03);
        const veinLocal = vec3(vPos.x.add(waveX), vPos.y, vPos.z.add(waveZ));

        // Rigidly lock palm veins to live Palm world matrix & forearm stream to live Forearm world matrix (ZERO clipping on wrist flexion!)
        const veinPalmWorld = this.uPalmMatrix.mul(vec4(veinLocal, 1.0)).xyz;
        const veinForearmWorld = this.uForearmMatrix.mul(vec4(veinLocal, 1.0)).xyz;
        const veinWorld = mix(veinForearmWorld, veinPalmWorld, p1.w);

        // Ambient cleanroom helical orbital drift
        const ang = p0.x.add(this.uTime.mul(speed).mul(0.55));
        const rad = p0.y.add(sin(this.uTime.mul(0.6).add(prm.x.mul(10.0))).mul(0.35));
        const ay = p0.z.add(sin(this.uTime.mul(0.45).add(prm.x.mul(12.0))).mul(0.65));
        const ambWorld = vec3(cos(ang).mul(rad), ay, sin(ang).mul(rad));

        const finalPos = mix(veinWorld, ambWorld, isAmbient);

        st.assign(vec4(finalPos, nextPhase));
      })().compute(totalCount);

      const curState = stateBuf.toAttribute();
      const curParam = paramBuf.toAttribute();

      mat.positionNode = curState.xyz;
      mat.scaleNode = curParam.z.mul(
        mix(float(0.85).add(this.uPulseBoost.mul(0.42)), float(0.75), curParam.w)
      );

      const env = sin(curState.w.mul(3.14159));
      const veinAlpha = env.mul(env).mul(0.56).mul(float(0.65).add(this.uPulseBoost.mul(0.50)));
      const ambPulse = sin(this.uTime.mul(1.2).add(curParam.x.mul(18.0))).mul(0.5).add(0.5);
      const ambAlpha = float(0.012).add(ambPulse.mul(0.022));

      const visAlpha = mix(veinAlpha, ambAlpha.mul(this.uFieldEnabled), curParam.w)
        .mul(this.uEnabled)
        .mul(coreGlow);

      const veinCol = mix(this.uAccentCore, this.uAccentHot, coreGlow);
      const ambCol = mix(this.uAccentCore.mul(0.85), this.uAccentHot, coreGlow);
      mat.colorNode = mix(veinCol, ambCol, curParam.w).mul(float(1.45));
      mat.opacityNode = visAlpha;
    } else {
      // === WEBGL2 FALLBACK: PURE TSL ZERO-CPU ANALYTIC GPU PARTICLE SHADER ===
      const aStart = attribute('aStart', 'vec4');
      const aEnd = attribute('aEnd', 'vec4');
      const aParam = attribute('aParam', 'vec4');

      const boostSpeed = float(0.45).add(this.uPulseBoost.mul(0.85));
      const t = fract(aParam.x.add(this.uTime.mul(aParam.y).mul(boostSpeed)));

      const vPos = mix(aStart.xyz, aEnd.xyz, t);
      const waveX = sin(t.mul(6.28318).add(aParam.x.mul(14.0))).mul(aStart.w);
      const waveZ = cos(t.mul(3.14159)).mul(0.03);
      const veinLocal = vec3(vPos.x.add(waveX), vPos.y, vPos.z.add(waveZ));

      const veinPalmWorld = this.uPalmMatrix.mul(vec4(veinLocal, 1.0)).xyz;
      const veinForearmWorld = this.uForearmMatrix.mul(vec4(veinLocal, 1.0)).xyz;
      const veinWorld = mix(veinForearmWorld, veinPalmWorld, aEnd.w);

      const ang = aStart.x.add(this.uTime.mul(aParam.y).mul(0.55));
      const rad = aStart.y.add(sin(this.uTime.mul(0.6).add(aParam.x.mul(10.0))).mul(0.35));
      const ay = aStart.z.add(sin(this.uTime.mul(0.45).add(aParam.x.mul(12.0))).mul(0.65));
      const ambWorld = vec3(cos(ang).mul(rad), ay, sin(ang).mul(rad));

      const finalPos = mix(veinWorld, ambWorld, aParam.w);

      mat.positionNode = finalPos;
      mat.scaleNode = aParam.z.mul(
        mix(float(0.85).add(this.uPulseBoost.mul(0.42)), float(0.75), aParam.w)
      );

      const env = sin(t.mul(3.14159));
      const veinAlpha = env.mul(env).mul(0.56).mul(float(0.65).add(this.uPulseBoost.mul(0.50)));
      const ambPulse = sin(this.uTime.mul(1.2).add(aParam.x.mul(18.0))).mul(0.5).add(0.5);
      const ambAlpha = float(0.012).add(ambPulse.mul(0.022));

      mat.colorNode = mix(
        mix(this.uAccentCore, this.uAccentHot, coreGlow),
        mix(this.uAccentCore.mul(0.85), this.uAccentHot, coreGlow),
        aParam.w
      ).mul(float(1.45));
      mat.opacityNode = mix(veinAlpha, ambAlpha.mul(this.uFieldEnabled), aParam.w)
        .mul(this.uEnabled)
        .mul(coreGlow);
    }

    const sprite = new THREE.Sprite(mat);
    sprite.count = totalCount;
    sprite.frustumCulled = false;
    sprite.renderOrder = 6;

    if (!isWebGPU) {
      sprite.geometry.setAttribute('aStart', new THREE.InstancedBufferAttribute(startArr, 4));
      sprite.geometry.setAttribute('aEnd', new THREE.InstancedBufferAttribute(endArr, 4));
      sprite.geometry.setAttribute('aParam', new THREE.InstancedBufferAttribute(paramArr, 4));
    }

    this.sprite = sprite;
    scene.add(sprite);
  }

  setAccentColor(coreHex, hotHex) {
    if (coreHex != null) this.uAccentCore.value.setHex(coreHex);
    if (hotHex != null) this.uAccentHot.value.setHex(hotHex);
  }

  setFieldEnabled(flag) {
    this.fieldEnabled = flag;
    this.uFieldEnabled.value = flag ? 1.0 : 0.0;
  }

  update(renderer, dt, boost, enabled, palmAnchor = null, forearmAnchor = null) {
    const safeDt = Math.min(dt, 0.05);
    this.uDelta.value = safeDt;
    this.uTime.value += safeDt * (1.0 + boost * 1.15);
    this.uPulseBoost.value = boost;
    this.uEnabled.value = enabled ? 1.0 : 0.0;

    if (palmAnchor) {
      palmAnchor.updateWorldMatrix(true, false);
      this.uPalmMatrix.value.copy(palmAnchor.matrixWorld);
    } else {
      this.uPalmMatrix.value.identity();
    }
    if (forearmAnchor) {
      forearmAnchor.updateWorldMatrix(true, false);
      this.uForearmMatrix.value.copy(forearmAnchor.matrixWorld);
    } else {
      this.uForearmMatrix.value.identity();
    }

    if (this.sprite) {
      this.sprite.visible = enabled || this.fieldEnabled;
    }
    if (this.isComputeMode && this.computeUpdate && (enabled || this.fieldEnabled)) {
      renderer.compute(this.computeUpdate);
    }
  }

  dispose() {
    if (this.sprite) {
      this.sprite.parent?.remove(this.sprite);
      this.sprite.material?.dispose();
      this.sprite = null;
    }
    this.computeUpdate = null;
  }
}
