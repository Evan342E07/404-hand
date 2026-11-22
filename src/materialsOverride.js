import * as THREE from 'three/webgpu';
import {
  Fn,
  uv,
  uniform,
  attribute,
  texture,
  positionLocal,
  positionWorld,
  normalView,
  positionViewDirection,
  float,
  vec3,
  vec4,
  sin,
  cos,
  pow,
  mix,
  clamp,
  max,
  smoothstep,
  length,
  fract,
  floor,
  dot,
  abs,
  Discard,
  If,
} from 'three/tsl';

/**
 * Procedural directional anisotropic CNC-brushed titanium normal map
 * for genuine lathe-turned rotating metallic highlights at macro close-up.
 */
function createAnisotropicBrushedNormalMap() {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);

  const rowVals = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    rowVals[y] = (Math.random() - 0.5) * 2.0;
  }
  for (let y = 0; y < h; y++) {
    const dy = rowVals[(y + 1) % h] - rowVals[(y - 1 + h) % h];
    for (let x = 0; x < w; x++) {
      const micro = (Math.random() - 0.5) * 0.14;
      const nx = micro;
      const ny = dy * 0.28;
      const nz = Math.sqrt(Math.max(0.01, 1.0 - nx * nx - ny * ny));
      const idx = (y * w + x) * 4;
      img.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

/**
 * Procedural ultra-fine ceramic glaze clearcoat normal map for tactile macro satin sheen.
 */
function createCeramicClearcoatNormalMap() {
  const s = 128;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const nx = (Math.random() - 0.5) * 0.08;
    const ny = (Math.random() - 0.5) * 0.08;
    img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
    img.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    img.data[i + 2] = 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

/**
 * Procedural radial optical thickness map for Glass_Palm_Shield.
 */
function createOpticalThicknessMap() {
  const s = 128;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grad.addColorStop(0.0, '#4a4a4a');
  grad.addColorStop(0.65, '#969696');
  grad.addColorStop(1.0, '#ffffff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Guarantees clean UVs, finite unit vertex tangents, AND fallback white `color` attribute
 * (when a custom user GLB lacks Blender-baked BVH 3D Vertex AO `COLOR_0`) so TSL AO shading
 * works on 100% of meshes with zero errors!
 */
function ensureCleanAttributes(geom, isPalmGlass = false) {
  if (!geom || !geom.attributes?.position) return;
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  const count = pos.count;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bb.getSize(size);
  bb.getCenter(center);
  const sx = Math.max(size.x, 0.01);
  const sy = Math.max(size.y, 0.01);

  if (!geom.attributes.uv) {
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      if (isPalmGlass) {
        uvs[i * 2] = (px - center.x) / sx + 0.5;
        uvs[i * 2 + 1] = (py - center.y) / sy + 0.5;
      } else {
        const nx = norm ? Math.abs(norm.getX(i)) : 0;
        const ny = norm ? Math.abs(norm.getY(i)) : 1;
        const nz = norm ? Math.abs(norm.getZ(i)) : 0;
        let u, v;
        if (ny > nx && ny > nz) {
          u = (px - center.x) * 0.45 + 0.5;
          v = (pz - center.z) * 0.45 + 0.5;
        } else {
          const ang = Math.atan2(pz - center.z, px - center.x);
          u = ang / (Math.PI * 2) + 0.5;
          v = (py - center.y) / sy + 0.5;
        }
        uvs[i * 2] = Number.isFinite(u) ? u : 0.5;
        uvs[i * 2 + 1] = Number.isFinite(v) ? v : 0.5;
      }
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  // Ensure vertex color attribute exists (preserves Blender-baked BVH 3D Vertex AO!)
  if (!geom.attributes.color) {
    const cols = new Float32Array(count * 3);
    cols.fill(1.0);
    geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }

  // Analytic orthonormal unit tangents so WebGPU anisotropy NEVER hits dFdx(0) = NaN!
  if (geom.attributes.normal) {
    const tangents = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const nx = norm.getX(i);
      const nz = norm.getZ(i);
      let tx = -nz;
      let tz = nx;
      let len = Math.hypot(tx, tz);
      if (len < 1e-4) {
        tx = 1.0;
        tz = 0.0;
        len = 1.0;
      }
      tangents[i * 4] = tx / len;
      tangents[i * 4 + 1] = 0.0;
      tangents[i * 4 + 2] = tz / len;
      tangents[i * 4 + 3] = 1.0;
    }
    geom.setAttribute('tangent', new THREE.BufferAttribute(tangents, 4));
  }
}

/**
 * Pure TSL World-Space Micro-Ceramic Grain Roughness Node.
 */
const ceramicMicroRoughnessNode = Fn(() => {
  const wp = positionWorld.mul(38.0);
  const cell = floor(wp);
  const h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
  return float(0.335).add(h.sub(0.5).mul(0.038));
});

/**
 * Helper: Applies Blender-baked BVH 3D Vertex Ambient Occlusion (`COLOR_0`) cleanly to any TSL material!
 */
function applyBakedVertexAO(mat, baseColorHex, aoStrength = 0.68) {
  const c = new THREE.Color(baseColorHex);
  const baseRgb = vec3(c.r, c.g, c.b);
  const strength = float(aoStrength);
  mat.colorNode = Fn(() => {
    const bakedAO = attribute('color', 'vec3').r;
    const shade = mix(float(1.0), bakedAO, strength);
    return baseRgb.mul(shade);
  })();
  return mat;
}

/**
 * 多套大师级外观涂装预设（纯 TSL Uniform 实时秒切，零卡顿，WebGPU & WebGL2 双后端全兼容）
 */
export const SKIN_PRESETS = {
  ceramic: {
    label: '纳米纯白陶',
    swatch: '#e4e8f0',
    armorColor: 0xd8dce2,
    armorOverride: 0.0,
    armorMetal: 0.015,
    armorRough: 0.27,
    clearcoat: 0.52,
    pearlAmount: 0.0,
    xrayMode: 0.0,
    jointLift: 1.0,
    jointTint: 0xffffff,
    accentCore: 0x52ccff,
    accentHot: 0xebfcff,
  },
  obsidian: {
    label: '曜石暗钛',
    swatch: '#1c202a',
    armorColor: 0x161922,
    armorOverride: 0.94,
    armorMetal: 0.86,
    armorRough: 0.23,
    clearcoat: 0.64,
    pearlAmount: 0.0,
    xrayMode: 0.0,
    jointLift: 1.32,
    jointTint: 0xf4f7fc,
    accentCore: 0xff9e2c,
    accentHot: 0xfff0c2,
  },
  transparent: {
    label: '透明探索版',
    swatch: '#38e8dc',
    armorColor: 0x263d54,
    armorOverride: 0.88,
    armorMetal: 0.14,
    armorRough: 0.10,
    clearcoat: 0.96,
    pearlAmount: 0.0,
    xrayMode: 1.0,
    jointLift: 1.18,
    jointTint: 0xe6f8ff,
    accentCore: 0x24f5df,
    accentHot: 0xdcfffa,
  },
  sakura: {
    label: '樱花珠光粉',
    swatch: '#f5c2d4',
    armorColor: 0xf4cddb,
    armorOverride: 0.92,
    armorMetal: 0.08,
    armorRough: 0.21,
    clearcoat: 0.88,
    pearlAmount: 1.0,
    xrayMode: 0.0,
    jointLift: 1.18,
    jointTint: 0xe6b8b0,
    accentCore: 0xff78b8,
    accentHot: 0xfff0f8,
  },
};

/**
 * Pure TSL Dynamic Bioluminescent Neural Vein Shader (HDR emissive > 1.6 for crisp selective bloom).
 */
function createDynamicNeuralNodeMaterial(
  uTime,
  uPulseBoost,
  uPulseEnabled,
  uAccentCore,
  uAccentHot,
  isSynapseNode = false
) {
  const mat = new THREE.MeshStandardNodeMaterial({
    color: isSynapseNode ? 0xd8f6ff : 0x8ce0fc,
    metalness: 0.08,
    roughness: 0.16,
  });

  const baseGain = float(isSynapseNode ? 2.15 : 1.78);

  mat.emissiveNode = Fn(() => {
    const waveA = sin(positionWorld.y.mul(1.45).sub(uTime.mul(3.4))).mul(0.5).add(0.5);
    const waveB = sin(positionWorld.y.mul(2.7).sub(uTime.mul(5.8)).add(positionWorld.x.mul(1.15)))
      .mul(0.5)
      .add(0.5);
    const pulsePacket = pow(waveA, float(4.0)).mul(0.88).add(pow(waveB, float(6.0)).mul(0.48));
    const activeEnergy = float(0.65).add(pulsePacket.mul(float(0.85).add(uPulseBoost.mul(0.75))));
    const energy = mix(float(0.28), activeEnergy, uPulseEnabled);
    const col = isSynapseNode ? mix(uAccentCore, uAccentHot, float(0.42)) : uAccentCore;
    return col.mul(baseGain).mul(energy);
  })();

  return mat;
}

/**
 * Pure TSL Orbital Flowing Optical Halo Shader for Dorsal Wrist Horology Rings (`Mat_Wrist_HaloFlow` / `Mat_Wrist_HaloFlowInner`):
 */
function createWristHaloFlowNodeMaterial(
  uTime,
  uPulseBoost,
  uPulseEnabled,
  uAccentCore,
  uAccentHot,
  isInnerRing = false
) {
  const mat = new THREE.MeshStandardNodeMaterial({
    color: isInnerRing ? 0xc2f4ff : 0x8ce2ff,
    metalness: 0.10,
    roughness: 0.14,
  });

  const speed = float(isInnerRing ? -3.2 : 2.35);
  const speed2 = float(isInnerRing ? 2.1 : -1.55);

  mat.emissiveNode = Fn(() => {
    const theta = uv().x.mul(6.2831853);
    const arcPrimary = pow(sin(theta.mul(2.0).sub(uTime.mul(speed))).mul(0.5).add(0.5), float(5.5));
    const arcCounter = pow(sin(theta.mul(3.0).add(uTime.mul(speed2))).mul(0.5).add(0.5), float(9.0)).mul(0.55);
    const microScan = sin(theta.mul(12.0).sub(uTime.mul(speed).mul(1.8))).mul(0.5).add(0.5).mul(0.22);

    const flowPeak = clamp(arcPrimary.add(arcCounter), float(0.0), float(1.4));
    const boostScale = float(1.0).add(uPulseBoost.mul(0.75));
    const activeIntensity = float(0.68).add(microScan).add(flowPeak.mul(2.15).mul(boostScale));
    const energy = mix(float(0.35), activeIntensity, uPulseEnabled);

    const coreTint = isInnerRing ? mix(uAccentCore, uAccentHot, float(0.22)) : uAccentCore;
    const haloColor = mix(coreTint, uAccentHot, clamp(arcPrimary.mul(0.85), float(0.0), float(1.0)));
    return haloColor.mul(energy).mul(float(isInnerRing ? 1.55 : 1.72));
  })();

  return mat;
}

/**
 * V4 TSL Frosted Subsurface Resin Membrane (`Glass_Palm_Shield`):
 * Uses Blender's exact polar UV contour (center=0, overlapping outer skirt=1) so the semi-frosted
 * translucent palm membrane melts 100% invisibly into the satin alabaster porcelain palm body —
 * revealing the organically fused champagne-platinum skeleton & embedded ice-blue veins through
 * soft milky translucency matching FRONT_final.png!
 */
function createOpticalPalmGlassNodeMaterial(
  opticalThicknessMap,
  uGlassTransmission,
  uGlassRoughness,
  uSliceY,
  uSliceActive
) {
  const mat = new THREE.MeshPhysicalNodeMaterial({
    color: 0xdce2e8,
    metalness: 0.0,
    roughness: 0.22,
    transmission: 0.84,
    ior: 1.48,
    thickness: 0.92,
    thicknessMap: opticalThicknessMap,
    dispersion: 0.42,
    iridescence: 0.28,
    iridescenceIOR: 1.32,
    iridescenceThicknessRange: [180, 380],
    clearcoat: 0.82,
    clearcoatRoughness: 0.09,
    sheen: 0.24,
    sheenRoughness: 0.58,
    sheenColor: new THREE.Color(0xeef4fa),
    envMapIntensity: 1.55,
    attenuationColor: new THREE.Color(0xdde6f0),
    attenuationDistance: 3.4,
    specularIntensity: 0.92,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });

  // Wide smooth radial transition from frosted optical center into milky satin ceramic perimeter!
  const radialEdge = Fn(() => {
    const r = length(uv().sub(0.5)).mul(2.0);
    return smoothstep(float(0.36), float(0.95), r);
  });

  const rimOpaque = Fn(() => {
    const r = length(uv().sub(0.5)).mul(2.0);
    return smoothstep(float(0.72), float(0.98), r);
  });

  mat.roughnessNode = Fn(() => {
    const edge = radialEdge();
    return mix(uGlassRoughness, float(0.36), edge.mul(0.90));
  })();

  mat.transmissionNode = Fn(() => {
    const edge = radialEdge();
    const outer = rimOpaque();
    const midTrans = mix(uGlassTransmission, float(0.28), edge.mul(0.82));
    return mix(midTrans, float(0.03), outer);
  })();

  mat.colorNode = Fn(() => {
    If(uSliceActive.greaterThan(0.5).and(positionWorld.y.greaterThan(uSliceY)), () => {
      Discard();
    });
    const edge = radialEdge();
    // Subtle milky frost center blending into exact satin alabaster ceramic white at perimeter!
    return mix(vec3(0.88, 0.91, 0.95), vec3(0.76, 0.78, 0.81), edge);
  })();

  return mat;
}

/**
 * 樱花珠光粉（Rose Pearl Ceramic）视角贝母虹彩 TSL 着色节点：
 * 正视呈温润高定初樱釉粉，侧光折射出梦幻薰衣草紫与月光珍珠母贝微光！
 */
function createPearlIridescenceNode() {
  const ndotv = abs(dot(normalView, positionViewDirection));
  const fresnel = pow(clamp(float(1.0).sub(ndotv), float(0.0), float(1.0)), float(1.9));
  const shimmer = sin(positionLocal.y.mul(1.8).add(positionLocal.x.mul(1.4)).add(ndotv.mul(4.5))).mul(0.5).add(0.5);
  const pearlColor = mix(vec3(1.0, 0.84, 0.92), vec3(0.84, 0.82, 1.0), shimmer);
  return { fresnel, pearlColor };
}

/**
 * Tripo V9.4 Hybrid TSL Material（支持 4 套外观涂装实时秒切 + 樱花珠光贝母虹彩 + 透明探索版菲涅尔透视）
 */
function createTripoEnhancedNodeMaterial(
  origMat,
  uTime,
  uPulseBoost,
  uPulseEnabled,
  uSliceY,
  uSliceActive,
  skinUniforms,
  enablePalmVeinGlow = true,
  isCeramicArmor = false
) {
  const {
    uArmorTint,
    uArmorOverride,
    uArmorMetal,
    uArmorRough,
    uPearlAmount,
    uXrayMode,
    uJointLift,
    uJointTint,
    uAccentCore,
  } = skinUniforms;

  const mat = new THREE.MeshPhysicalNodeMaterial({
    normalMap: origMat.normalMap || null,
    normalScale: isCeramicArmor ? new THREE.Vector2(0.06, 0.06) : new THREE.Vector2(0.26, 0.26),
    aoMap: origMat.aoMap || null,
    aoMapIntensity: 0.35,
    metalness: 0.5,
    roughness: 0.3,
    clearcoat: isCeramicArmor ? 0.52 : 0.38,
    clearcoatRoughness: isCeramicArmor ? 0.14 : 0.18,
    sheen: 0.22,
    sheenRoughness: 0.54,
    sheenColor: new THREE.Color(0xf6f9ff),
    anisotropy: isCeramicArmor ? 0.18 : 0.52,
    envMapIntensity: 1.28,
    side: THREE.DoubleSide,
  });

  const colorTex = origMat.map ? texture(origMat.map) : vec4(0.82, 0.84, 0.86, 1.0);
  const ormTex = origMat.roughnessMap ? texture(origMat.roughnessMap) : vec4(1.0, 0.31, 0.15, 1.0);

  const ceramicMask = Fn(() => {
    const luma = dot(colorTex.rgb, vec3(0.299, 0.587, 0.114));
    return smoothstep(float(0.32), float(0.52), luma);
  });

  const palmVeinMask = Fn(() => {
    if (!enablePalmVeinGlow) return float(0.0);
    const cyanDiff = colorTex.b.sub(colorTex.r);
    const inPalmY = smoothstep(float(1.5), float(2.1), positionLocal.y).mul(
      smoothstep(float(6.0), float(5.2), positionLocal.y)
    );
    const inFront = smoothstep(float(0.25), float(0.75), positionLocal.z);
    return smoothstep(float(0.018), float(0.052), cyanDiff).mul(inPalmY).mul(inFront);
  });

  mat.colorNode = Fn(() => {
    If(uSliceActive.greaterThan(0.5).and(positionWorld.y.greaterThan(uSliceY)), () => {
      Discard();
    });
    const isCer = ceramicMask();
    const bakedAO = attribute('color', 'vec3').r;
    const aoShade = mix(float(1.0), bakedAO, float(0.72));

    // 暗钛关节区域（曜石黑提亮银骨，樱花粉柔和渲染为香槟玫瑰金！）
    const liftedMetal = colorTex.rgb
      .mul(1.14)
      .mul(uJointLift)
      .mul(uJointTint)
      .mul(mix(float(1.0), bakedAO, float(0.50)));

    // 原始纳米纯白陶基准色
    const origCer = mix(colorTex.rgb.mul(1.22), vec3(0.845, 0.855, 0.875), float(isCeramicArmor ? 0.72 : 0.52));
    // 切换涂装目标色（保留原始贴图明暗层次）
    const tintedCer = mix(
      origCer,
      uArmorTint.mul(mix(float(0.82), float(1.08), dot(colorTex.rgb, vec3(0.33, 0.34, 0.33)))),
      uArmorOverride
    );

    // 樱花珠光粉：叠加视角贝母虹彩光泽（初樱粉 -> 薰衣草月光珠光）
    const { fresnel, pearlColor } = createPearlIridescenceNode();
    const pearledCer = mix(tintedCer, pearlColor, fresnel.mul(uPearlAmount).mul(0.52));

    const finalCer = pearledCer.mul(aoShade);
    return clamp(mix(liftedMetal, finalCer, isCer), vec3(0.02), vec3(0.95));
  })();

  mat.metalnessNode = Fn(() => {
    const isCer = ceramicMask();
    return mix(max(ormTex.b, float(0.86)), uArmorMetal, isCer);
  })();

  mat.roughnessNode = Fn(() => {
    const isCer = ceramicMask();
    const metalRough = clamp(ormTex.g.mul(0.82), float(0.16), float(0.38));
    return mix(metalRough, uArmorRough, isCer);
  })();

  if (isCeramicArmor) {
    mat.opacityNode = Fn(() => {
      const isCer = ceramicMask();
      const ndotv = abs(dot(normalView, positionViewDirection));
      const fresnel = pow(clamp(float(1.0).sub(ndotv), float(0.0), float(1.0)), float(2.2));
      const glassAlpha = clamp(float(0.16).add(fresnel.mul(0.68)), float(0.14), float(0.86));
      const xrayAlpha = mix(float(0.94), glassAlpha, isCer);
      return mix(float(1.0), xrayAlpha, uXrayMode);
    })();
  }

  mat.emissiveNode = Fn(() => {
    const vMask = palmVeinMask();
    const waveA = sin(positionLocal.y.mul(1.5).sub(uTime.mul(3.4))).mul(0.5).add(0.5);
    const waveB = sin(positionLocal.y.mul(2.8).sub(uTime.mul(5.8)).add(positionLocal.x.mul(1.2)))
      .mul(0.5)
      .add(0.5);
    const pulsePacket = pow(waveA, float(3.5)).mul(0.95).add(pow(waveB, float(5.5)).mul(0.55));
    const energy = mix(float(0.35), float(0.85).add(pulsePacket.mul(float(1.10).add(uPulseBoost.mul(0.9)))), uPulseEnabled);
    const veinGlow = uAccentCore.mul(vMask).mul(energy).mul(2.1);

    let rimGlow = vec3(0.0, 0.0, 0.0);
    if (isCeramicArmor) {
      const isCer = ceramicMask();
      const ndotv = abs(dot(normalView, positionViewDirection));
      const fresnel = pow(clamp(float(1.0).sub(ndotv), float(0.0), float(1.0)), float(3.0));
      const xrayRim = uAccentCore.mul(fresnel).mul(isCer).mul(uXrayMode).mul(0.48);
      // 樱花珠光粉柔和丝绸边缘微辉
      const pearlRim = vec3(1.0, 0.80, 0.92).mul(fresnel).mul(isCer).mul(uPearlAmount).mul(0.16);
      rimGlow = xrayRim.add(pearlRim);
    }

    const dist = abs(positionWorld.y.sub(uSliceY));
    const edgeGlow = smoothstep(float(0.18), float(0.0), dist).mul(uSliceActive);
    const sliceGlow = uAccentCore.mul(edgeGlow.mul(2.5));

    return veinGlow.add(rimGlow).add(sliceGlow);
  })();

  return mat;
}

/**
 * V4 Leica-Calibrated Native WebGPU / TSL Node Material Pipeline:
 *   - Incorporates Blender-baked BVH 3D Vertex AO (`COLOR_0`) across all opaque ceramic & titanium parts!
 *   - Physically calibrated Alabaster Porcelain Albedo (`0xcfd3d9`) -> rich curvature gradation, ZERO blown-out white!
 *   - Warm Satin Gunmetal Finger Hinges (`0x5c626e`) -> crisp metallic rib highlights, NEVER pitch black!
 *   - Warm Champagne-Platinum Fused Biomechanical Skeleton (`0xc4bdb6`) behind frosted TSL resin membrane!
 */
export function upgradeGLBMaterials(rootObj) {
  const brushedNormalMap = createAnisotropicBrushedNormalMap();
  const ceramicCoatNormal = createCeramicClearcoatNormalMap();
  const opticalThicknessMap = createOpticalThicknessMap();

  const uTime = uniform(0.0);
  const uPulseBoost = uniform(0.0);
  const uPulseEnabled = uniform(1.0);
  const uGlassTransmission = uniform(0.84);
  const uGlassRoughness = uniform(0.22);
  const uSliceY = uniform(30.0);
  const uSliceActive = uniform(0.0);

  // 多套外观涂装共享 TSL Uniforms（零重编译热切）
  const uArmorTint = uniform(new THREE.Color(SKIN_PRESETS.ceramic.armorColor));
  const uArmorOverride = uniform(SKIN_PRESETS.ceramic.armorOverride);
  const uArmorMetal = uniform(SKIN_PRESETS.ceramic.armorMetal);
  const uArmorRough = uniform(SKIN_PRESETS.ceramic.armorRough);
  const uPearlAmount = uniform(SKIN_PRESETS.ceramic.pearlAmount);
  const uXrayMode = uniform(SKIN_PRESETS.ceramic.xrayMode);
  const uJointLift = uniform(SKIN_PRESETS.ceramic.jointLift);
  const uJointTint = uniform(new THREE.Color(SKIN_PRESETS.ceramic.jointTint));
  const uAccentCore = uniform(new THREE.Color(SKIN_PRESETS.ceramic.accentCore));
  const uAccentHot = uniform(new THREE.Color(SKIN_PRESETS.ceramic.accentHot));

  const skinUniforms = {
    uArmorTint,
    uArmorOverride,
    uArmorMetal,
    uArmorRough,
    uPearlAmount,
    uXrayMode,
    uJointLift,
    uJointTint,
    uAccentCore,
    uAccentHot,
  };

  const sharedUniforms = {
    uTime,
    uPulseBoost,
    uPulseEnabled,
    uGlassTransmission,
    uGlassRoughness,
    uSliceY,
    uSliceActive,
    ...skinUniforms,
  };

  // Pure TSL 3D Laser Section Slicer + Baked 3D Vertex AO + 多套涂装（含樱花珠光与透明探索）
  const attachArmorAOSlicerNodes = (mat, baseColorHex, aoStrength = 0.72) => {
    const c = new THREE.Color(baseColorHex);
    const baseRgb = vec3(c.r, c.g, c.b);
    const strength = float(aoStrength);
    mat.colorNode = Fn(() => {
      If(uSliceActive.greaterThan(0.5).and(positionWorld.y.greaterThan(uSliceY)), () => {
        Discard();
      });
      const bakedAO = attribute('color', 'vec3').r;
      const shade = mix(float(1.0), bakedAO, strength);
      const tinted = mix(baseRgb, uArmorTint, uArmorOverride);
      const { fresnel, pearlColor } = createPearlIridescenceNode();
      const pearled = mix(tinted, pearlColor, fresnel.mul(uPearlAmount).mul(0.52));
      return pearled.mul(shade);
    })();
    mat.metalnessNode = uArmorMetal;
    mat.roughnessNode = mix(ceramicMicroRoughnessNode(), uArmorRough, uArmorOverride);
    mat.opacityNode = Fn(() => {
      const ndotv = abs(dot(normalView, positionViewDirection));
      const fresnel = pow(clamp(float(1.0).sub(ndotv), float(0.0), float(1.0)), float(2.2));
      const glassAlpha = clamp(float(0.16).add(fresnel.mul(0.68)), float(0.14), float(0.86));
      return mix(float(1.0), glassAlpha, uXrayMode);
    })();
    mat.emissiveNode = Fn(() => {
      const ndotv = abs(dot(normalView, positionViewDirection));
      const fresnel = pow(clamp(float(1.0).sub(ndotv), float(0.0), float(1.0)), float(3.0));
      const xrayRim = uAccentCore.mul(fresnel).mul(uXrayMode).mul(0.48);
      const pearlRim = vec3(1.0, 0.80, 0.92).mul(fresnel).mul(uPearlAmount).mul(0.16);

      const dist = abs(positionWorld.y.sub(uSliceY));
      const edgeGlow = smoothstep(float(0.16), float(0.0), dist).mul(uSliceActive);
      return xrayRim.add(pearlRim).add(uAccentCore.mul(edgeGlow.mul(2.5)));
    })();
    mat.side = THREE.DoubleSide;
    return mat;
  };

  // 1. Flush Frosted Subsurface Resin Palm Membrane
  const opticalPalmGlass = createOpticalPalmGlassNodeMaterial(
    opticalThicknessMap,
    uGlassTransmission,
    uGlassRoughness,
    uSliceY,
    uSliceActive
  );

  // 2. Leica-Calibrated Satin Alabaster Nano-Ceramic Armor (0xd8dce2 -> seamless match with Tripo purified porcelain!)
  const makeNanoCeramicMat = () => {
    const m = new THREE.MeshPhysicalNodeMaterial({
      color: 0xd8dce2,
      metalness: 0.015,
      roughness: 0.28,
      clearcoat: 0.48,
      clearcoatRoughness: 0.16,
      clearcoatNormalMap: ceramicCoatNormal,
      clearcoatNormalScale: new THREE.Vector2(0.08, 0.08),
      sheen: 0.20,
      sheenRoughness: 0.56,
      sheenColor: new THREE.Color(0xf2f6fc),
      reflectivity: 0.66,
    });
    m.roughnessNode = ceramicMicroRoughnessNode();
    return attachArmorAOSlicerNodes(m, 0xd8dce2, 0.72);
  };
  const nanoCeramicWhite = makeNanoCeramicMat();

  const makeCeramicNailMat = () => {
    const m = new THREE.MeshPhysicalNodeMaterial({
      color: 0xdce0e6,
      metalness: 0.02,
      roughness: 0.16,
      clearcoat: 0.80,
      clearcoatRoughness: 0.10,
      iridescence: 0.12,
      iridescenceIOR: 1.35,
    });
    return attachArmorAOSlicerNodes(m, 0xdce0e6, 0.55);
  };
  const ceramicNail = makeCeramicNailMat();

  // 3. Warm Satin Gunmetal Titanium (Finger Hinge Slats, Y-Yoke, Wrist Bezel — luminous chamfers, never black!)
  const darkBrushedTi = applyBakedVertexAO(
    new THREE.MeshPhysicalNodeMaterial({
      color: 0x5c626e,
      metalness: 0.88,
      roughness: 0.25,
      anisotropy: 0.62,
      anisotropyRotation: 0.0,
      normalMap: brushedNormalMap,
      normalScale: new THREE.Vector2(0.14, 0.14),
      envMapIntensity: 1.72,
    }),
    0x5c626e,
    0.58
  );

  // 4. Brushed Natural Titanium (Base Cuff, Forearm Core, Horology Drum, Hydraulic Cylinder)
  const brushedTi = applyBakedVertexAO(
    new THREE.MeshPhysicalNodeMaterial({
      color: 0x868c96,
      metalness: 0.91,
      roughness: 0.22,
      anisotropy: 0.74,
      anisotropyRotation: Math.PI * 0.5,
      normalMap: brushedNormalMap,
      normalScale: new THREE.Vector2(0.18, 0.18),
      clearcoat: 0.10,
      clearcoatRoughness: 0.24,
      envMapIntensity: 1.38,
    }),
    0x868c96,
    0.66
  );

  // 5. Warm Satin Champagne-Platinum Fused Biomechanical Metacarpal Skeleton (FRONT_final.png!)
  const bionicBoneTi = applyBakedVertexAO(
    new THREE.MeshPhysicalNodeMaterial({
      color: 0xc4bdb6,
      metalness: 0.80,
      roughness: 0.27,
      anisotropy: 0.48,
      clearcoat: 0.26,
      clearcoatRoughness: 0.18,
      normalMap: brushedNormalMap,
      normalScale: new THREE.Vector2(0.07, 0.07),
      envMapIntensity: 1.48,
    }),
    0xc4bdb6,
    0.82
  );

  // 6. Luminous Warm-Grey Satin Titanium Palm Bay Liner
  const palmBayLiner = applyBakedVertexAO(
    new THREE.MeshPhysicalNodeMaterial({
      color: 0x767a84,
      metalness: 0.58,
      roughness: 0.38,
      anisotropy: 0.25,
      envMapIntensity: 1.15,
    }),
    0x767a84,
    0.85
  );

  // 7. Machined Chrome Steel (Mirror Piston Rod & Horology Micro-Ticks)
  const chromeSteel = applyBakedVertexAO(
    new THREE.MeshPhysicalNodeMaterial({
      color: 0xd4dae4,
      metalness: 0.97,
      roughness: 0.10,
      anisotropy: 0.35,
      clearcoat: 0.22,
      clearcoatRoughness: 0.08,
    }),
    0xd4dae4,
    0.45
  );

  const carbonRecess = applyBakedVertexAO(
    new THREE.MeshStandardNodeMaterial({
      color: 0x20252e,
      metalness: 0.38,
      roughness: 0.48,
    }),
    0x20252e,
    0.55
  );

  // Subtle, refined Leica satin metallic titanium-grey laser etching for '4Ø4' matching BACK_final.png!
  const brand404Ti = new THREE.MeshStandardNodeMaterial({
    color: 0x5e6772,
    metalness: 0.78,
    roughness: 0.26,
  });

  // Machined dark gunmetal CNC steel for internal wrist gimbal sphere & finger joint core axles
  const wristGimbalSteel = new THREE.MeshPhysicalNodeMaterial({
    color: 0x22262e,
    metalness: 0.92,
    roughness: 0.26,
    anisotropy: 0.72,
    normalMap: brushedNormalMap,
    normalScale: new THREE.Vector2(0.24, 0.24),
    envMapIntensity: 1.15,
  });

  // V8 Dyson-Grade Internal Hardware Materials (Burnished Copper Coils, Emerald PCB, ENIG Gold, Silicon IC!)
  const copperCoil = applyBakedVertexAO(
    new THREE.MeshPhysicalNodeMaterial({
      color: 0xd0763e,
      metalness: 0.96,
      roughness: 0.20,
      anisotropy: 0.78,
      anisotropyRotation: Math.PI * 0.5,
      normalMap: brushedNormalMap,
      normalScale: new THREE.Vector2(0.22, 0.22),
      clearcoat: 0.22,
      clearcoatRoughness: 0.14,
      envMapIntensity: 1.55,
    }),
    0xd0763e,
    0.55
  );

  // 未来量子光子芯片主板（深邃黑蓝宝石晶圆 + 激光微米光刻动态流光走线，告别古早绿色电路板！）
  const pcbSubstrate = new THREE.MeshPhysicalNodeMaterial({
    color: 0x0c1320,
    metalness: 0.42,
    roughness: 0.14,
    clearcoat: 0.96,
    clearcoatRoughness: 0.06,
    iridescence: 0.48,
    iridescenceIOR: 1.42,
    envMapIntensity: 1.75,
  });
  pcbSubstrate.colorNode = Fn(() => {
    const bakedAO = attribute('color', 'vec3').r;
    const lp = positionLocal;
    const gx = abs(fract(lp.x.mul(14.0)).sub(0.5));
    const gy = abs(fract(lp.y.mul(14.0)).sub(0.5));
    const traceLine = smoothstep(float(0.06), float(0.015), gx).max(smoothstep(float(0.06), float(0.015), gy));
    const waferBase = mix(vec3(0.045, 0.068, 0.115), vec3(0.11, 0.18, 0.28), traceLine.mul(0.55));
    return waferBase.mul(mix(float(1.0), bakedAO, float(0.45)));
  })();
  pcbSubstrate.emissiveNode = Fn(() => {
    const lp = positionLocal;
    const gx = abs(fract(lp.x.mul(14.0)).sub(0.5));
    const gy = abs(fract(lp.y.mul(14.0)).sub(0.5));
    const traceX = smoothstep(float(0.042), float(0.008), gx);
    const traceY = smoothstep(float(0.042), float(0.008), gy);
    const bus = traceX.max(traceY);
    const flowA = pow(sin(lp.y.mul(6.5).sub(uTime.mul(4.2)).add(lp.x.mul(2.5))).mul(0.5).add(0.5), float(6.0));
    const flowB = pow(sin(lp.x.mul(9.0).add(uTime.mul(3.1))).mul(0.5).add(0.5), float(8.0));
    const pulse = float(0.14).add(flowA.mul(1.15).add(flowB.mul(0.65)).mul(float(1.0).add(uPulseBoost.mul(0.85))));
    const energy = mix(float(0.10), pulse, uPulseEnabled);
    return uAccentCore.mul(bus).mul(energy).mul(1.25);
  })();

  // 超精炼冷香槟铂金光子微导轨
  const goldTrace = new THREE.MeshPhysicalNodeMaterial({
    color: 0xead8b4,
    metalness: 0.98,
    roughness: 0.10,
    clearcoat: 0.35,
    clearcoatRoughness: 0.06,
    iridescence: 0.22,
    envMapIntensity: 1.85,
  });
  goldTrace.emissiveNode = Fn(() => {
    const shimmer = pow(sin(positionLocal.y.mul(8.0).sub(uTime.mul(3.6))).mul(0.5).add(0.5), float(7.0));
    return uAccentCore.mul(shimmer).mul(uPulseEnabled).mul(0.42);
  })();

  // Apple M-Series / 量子级幻彩单晶硅光子核心 Die（薄膜干涉虹彩 + 激光微光栅 + 核心能量脉动）
  const icSilicon = new THREE.MeshPhysicalNodeMaterial({
    color: 0x121a2a,
    metalness: 0.88,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    iridescence: 0.95,
    iridescenceIOR: 1.65,
    iridescenceThicknessRange: [220, 560],
    envMapIntensity: 2.1,
  });
  icSilicon.emissiveNode = Fn(() => {
    const lp = positionLocal;
    const ndotv = abs(dot(normalView, positionViewDirection));
    const fresnel = pow(clamp(float(1.0).sub(ndotv), float(0.0), float(1.0)), float(2.2));
    const dieGrid = smoothstep(float(0.09), float(0.015), abs(fract(lp.x.mul(22.0)).sub(0.5)))
      .mul(smoothstep(float(0.09), float(0.015), abs(fract(lp.y.mul(22.0)).sub(0.5))));
    const beat = sin(uTime.mul(3.2)).mul(0.5).add(0.5);
    const coreGlow = mix(uAccentCore, uAccentHot, float(0.38))
      .mul(dieGrid.mul(1.6).add(fresnel.mul(0.65)).add(beat.mul(0.24)))
      .mul(mix(float(0.25), float(1.0).add(uPulseBoost.mul(0.65)), uPulseEnabled));
    return coreGlow;
  })();

  // Spotless CNC dark brushed satin titanium for AI-completed interior/backside armor walls (ZERO zebra smears in Exploded View!)
  const interiorBrushedTi = applyBakedVertexAO(
    new THREE.MeshPhysicalNodeMaterial({
      color: 0x363c46,
      metalness: 0.88,
      roughness: 0.28,
      anisotropy: 0.64,
      normalMap: brushedNormalMap,
      normalScale: new THREE.Vector2(0.16, 0.16),
      envMapIntensity: 1.35,
      side: THREE.DoubleSide,
    }),
    0x363c46,
    0.58
  );

  const neuralFiberMat = createDynamicNeuralNodeMaterial(uTime, uPulseBoost, uPulseEnabled, uAccentCore, uAccentHot, false);
  const synapseNodeMat = createDynamicNeuralNodeMaterial(uTime, uPulseBoost, uPulseEnabled, uAccentCore, uAccentHot, true);
  const wristHaloOuterMat = createWristHaloFlowNodeMaterial(uTime, uPulseBoost, uPulseEnabled, uAccentCore, uAccentHot, false);
  const wristHaloInnerMat = createWristHaloFlowNodeMaterial(uTime, uPulseBoost, uPulseEnabled, uAccentCore, uAccentHot, true);

  const byMatName = {
    Mat_Palm_OpticalGlass: opticalPalmGlass,
    Mat_Ceramic_White: nanoCeramicWhite,
    Mat_Ceramic_Nail: ceramicNail,
    Mat_Dark_Titanium: darkBrushedTi,
    Mat_Wrist_GimbalSteel: wristGimbalSteel,
    Mat_Interior_BrushedTi: interiorBrushedTi,
    Mat_Brushed_Titanium: brushedTi,
    Mat_BionicBone_Titanium: bionicBoneTi,
    Mat_Palm_BayLiner: palmBayLiner,
    Mat_Chrome_Steel: chromeSteel,
    Mat_Carbon_Recess: carbonRecess,
    Mat_Brand_404: brand404Ti,
    Mat_Neural_IceBlue: neuralFiberMat,
    Mat_Neural_Node: synapseNodeMat,
    Mat_Wrist_HaloFlow: wristHaloOuterMat,
    Mat_Wrist_HaloFlowInner: wristHaloInnerMat,
    Mat_Copper_Coil: copperCoil,
    Mat_PCB_Substrate: pcbSubstrate,
    Mat_Gold_Trace: goldTrace,
    Mat_IC_Silicon: icSilicon,
  };

  const glassClones = [];
  const tripoMats = [];
  const armorMats = [];
  const armorMeshes = [];

  rootObj.traverse((node) => {
    if (!node.isMesh) return;
    ensureCleanAttributes(node.geometry, node.name === 'Glass_Palm_Shield');
    const origMat = node.material;
    const origName = origMat?.name || '';

    // Preserve & enhance ALL Tripo V9 Hybrid Exterior Parts (purified porcelain + crisp dark titanium joints!)
    if (
      origName === 'Mat_Tripo_BionicPBR' ||
      origName.startsWith('Mat_TripoPart_') ||
      origName.startsWith('tripo_part_') ||
      (origMat?.map && !byMatName[origName])
    ) {
      const partName = node.name.startsWith('Armor_') || node.parent?.name?.startsWith('Armor_')
        ? (node.name.startsWith('Armor_') ? node.name : node.parent.name)
        : node.name;
      const isCeramicArmor = partName.startsWith('Armor_');
      const enablePalmVeinGlow = partName === 'Armor_Palm_MainBody' || partName.startsWith('Tripo_');
      const enhanced = createTripoEnhancedNodeMaterial(
        origMat,
        uTime,
        uPulseBoost,
        uPulseEnabled,
        uSliceY,
        uSliceActive,
        skinUniforms,
        enablePalmVeinGlow,
        isCeramicArmor
      );
      node.material = enhanced;
      node.castShadow = true;
      node.receiveShadow = true;
      tripoMats.push(enhanced);
      if (isCeramicArmor) {
        armorMats.push(enhanced);
        armorMeshes.push(node);
      }
      return;
    }

    let replacement = byMatName[origName];

    if (!replacement) {
      if (node.name === 'Glass_Palm_Shield') replacement = opticalPalmGlass;
      else if (node.name === 'Neural_Wrist_HaloInner') replacement = wristHaloInnerMat;
      else if (node.name.startsWith('Neural_Wrist_')) replacement = wristHaloOuterMat;
      else if (node.name.startsWith('Neural_Node')) replacement = synapseNodeMat;
      else if (node.name.startsWith('Neural_')) replacement = neuralFiberMat;
      else if (node.name.startsWith('Bone_Palm')) replacement = bionicBoneTi;
      else if (node.name === 'Chassis_Palm_InternalBay') replacement = palmBayLiner;
      else if (node.name.startsWith('Plaque_404')) replacement = brand404Ti;
      else if (node.name.startsWith('Armor_') && node.name.includes('Nail')) replacement = ceramicNail;
      else if (node.name.startsWith('Armor_')) replacement = nanoCeramicWhite;
      else if (node.name.startsWith('Gear_')) replacement = brushedTi;
      else if (node.name.startsWith('Wrist_Front_VArch')) replacement = darkBrushedTi;
      else if (node.name.startsWith('Piston_')) replacement = chromeSteel;
      else if (node.name.startsWith('Chassis_')) replacement = carbonRecess;
    }

    if (replacement) {
      if (node.name === 'Glass_Palm_Shield') {
        const cloned = createOpticalPalmGlassNodeMaterial(
          opticalThicknessMap,
          uGlassTransmission,
          uGlassRoughness,
          uSliceY,
          uSliceActive
        );
        node.material = cloned;
        glassClones.push(cloned);
      } else if (node.name.startsWith('Armor_') && replacement === nanoCeramicWhite) {
        const m = makeNanoCeramicMat();
        node.material = m;
        armorMats.push(m);
        armorMeshes.push(node);
      } else if (node.name.startsWith('Armor_') && replacement === ceramicNail) {
        const m = makeCeramicNailMat();
        node.material = m;
        armorMats.push(m);
        armorMeshes.push(node);
      } else if (node.name.startsWith('Armor_')) {
        const m = replacement.clone();
        node.material = m;
        if (replacement === nanoCeramicWhite || replacement === ceramicNail) {
          armorMats.push(m);
          armorMeshes.push(node);
        }
      } else {
        node.material = replacement;
      }
    }

    if (node.name === 'Glass_Palm_Shield') {
      node.renderOrder = 4;
      node.castShadow = false;
      node.receiveShadow = false;
    } else if (
      node.name.startsWith('Neural_') ||
      node.name.startsWith('Wrist_DorsalPin') ||
      node.name.startsWith('Wrist_DorsalTick') ||
      node.name.startsWith('Wrist_SwissTick') ||
      node.name.startsWith('Wrist_SwissScrew') ||
      node.name.startsWith('Plaque_404')
    ) {
      node.castShadow = false;
      node.receiveShadow = false;
    } else {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  let activeSkinKey = 'ceramic';

  return {
    sharedUniforms,
    opticalPalmGlass,
    neuralFiberMat,
    synapseNodeMat,
    getSkinPreset() {
      return activeSkinKey;
    },
    setSkinPreset(skinKey) {
      const p = SKIN_PRESETS[skinKey] || SKIN_PRESETS.ceramic;
      activeSkinKey = SKIN_PRESETS[skinKey] ? skinKey : 'ceramic';

      uArmorTint.value.setHex(p.armorColor);
      uArmorOverride.value = p.armorOverride;
      uArmorMetal.value = p.armorMetal;
      uArmorRough.value = p.armorRough;
      uPearlAmount.value = p.pearlAmount;
      uXrayMode.value = p.xrayMode;
      uJointLift.value = p.jointLift;
      uJointTint.value.setHex(p.jointTint ?? 0xffffff);
      uAccentCore.value.setHex(p.accentCore);
      uAccentHot.value.setHex(p.accentHot);

      const isXray = p.xrayMode > 0.5;
      for (const m of armorMats) {
        m.clearcoat = p.clearcoat;
        const nextTrans = isXray;
        if (m.transparent !== nextTrans || m.depthWrite !== !nextTrans) {
          m.transparent = nextTrans;
          m.depthWrite = !nextTrans;
          m.needsUpdate = true;
        }
      }
      for (const mesh of armorMeshes) {
        mesh.castShadow = !isXray;
        mesh.renderOrder = isXray ? 5 : 0;
      }
      return p;
    },
    setUltraOptics(enabled) {
      for (const gm of glassClones) {
        gm.dispersion = enabled ? 0.42 : 0.0;
        gm.iridescence = enabled ? 0.28 : 0.0;
      }
      darkBrushedTi.anisotropy = enabled ? 0.62 : 0.0;
      brushedTi.anisotropy = enabled ? 0.74 : 0.0;
      bionicBoneTi.anisotropy = enabled ? 0.48 : 0.0;
      chromeSteel.anisotropy = enabled ? 0.35 : 0.0;
      for (const tm of tripoMats) {
        tm.anisotropy = enabled ? 0.45 : 0.0;
      }
    },
    disposeTextures() {
      brushedNormalMap.dispose();
      ceramicCoatNormal.dispose();
      opticalThicknessMap.dispose();
    },
  };
}
