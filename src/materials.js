import * as THREE from 'three';

/**
 * Brushed anisotropic metal texture for dark-titanium and actuator surfaces.
 */
function createBrushedMetalTexture(baseHex = '#808080', contrast = 42) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y++) {
    const v = Math.floor((Math.random() - 0.5) * contrast);
    const alpha = Math.abs(v) / 255;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, y, 256, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

/**
 * Whisper-fine tonal ceramic micro-contour bump texture for sleek pearl fingertips
 * (replaces dark gray rubber patches with harmonious luxury satin ceramic texture).
 */
function createPearlTactileBump() {
  const w = 256;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const cx = w * 0.5;
  const cy = h * 0.6;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) * 1.1;
      const dy = (y - cy) * 0.72;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ridge = 0.5 + 0.5 * Math.sin(dist * 0.65);
      const val = Math.floor(115 + ridge * 60);
      const idx = (y * w + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Soft milky radial mask texture for the concave frosted optical palm window.
 */
function createFrostedPalmMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 128);
  grad.addColorStop(0.0, 'rgba(240, 245, 250, 0.44)');
  grad.addColorStop(0.65, 'rgba(235, 240, 246, 0.66)');
  grad.addColorStop(1.0, 'rgba(226, 231, 238, 0.90)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Traveling electric-current pulse texture (scrolled seamlessly along TubeGeometry U coordinates).
 */
function createElectricPulseTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#182430';
  ctx.fillRect(0, 0, 256, 16);

  // Subtle dual traveling energy packets along the neural vessel length
  const grad1 = ctx.createLinearGradient(0, 0, 256, 0);
  grad1.addColorStop(0.0, 'rgba(130, 220, 255, 0.08)');
  grad1.addColorStop(0.22, 'rgba(130, 220, 255, 0.12)');
  grad1.addColorStop(0.32, 'rgba(165, 238, 255, 0.95)');
  grad1.addColorStop(0.42, 'rgba(220, 250, 255, 1.0)');
  grad1.addColorStop(0.54, 'rgba(110, 210, 255, 0.14)');
  grad1.addColorStop(0.85, 'rgba(130, 220, 255, 0.08)');
  grad1.addColorStop(1.0, 'rgba(130, 220, 255, 0.08)');
  ctx.fillStyle = grad1;
  ctx.fillRect(0, 0, 256, 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Micro-milled geometric "404" emblem decal (used strictly on dorsal lower-left bevel ONLY).
 */
function create404DecalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#484d57';
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const drawFour = (ox, oy) => {
    ctx.beginPath();
    ctx.moveTo(ox + 64, oy + 12);
    ctx.lineTo(ox + 12, oy + 76);
    ctx.lineTo(ox + 82, oy + 76);
    ctx.moveTo(ox + 64, oy + 12);
    ctx.lineTo(ox + 64, oy + 114);
    ctx.stroke();
  };

  drawFour(64, 38);

  const zx = 212;
  const zy = 42;
  const zw = 82;
  const zh = 108;
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(zx + r, zy);
  ctx.lineTo(zx + zw - r, zy);
  ctx.quadraticCurveTo(zx + zw, zy, zx + zw, zy + r);
  ctx.lineTo(zx + zw, zy + zh - r);
  ctx.quadraticCurveTo(zx + zw, zy + zh, zx + zw - r, zy + zh);
  ctx.lineTo(zx + r, zy + zh);
  ctx.quadraticCurveTo(zx, zy + zh, zx, zy + zh - r);
  ctx.lineTo(zx, zy + r);
  ctx.quadraticCurveTo(zx, zy, zx + r, zy);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(zx + 14, zy + zh - 14);
  ctx.lineTo(zx + zw - 14, zy + 14);
  ctx.stroke();

  drawFour(334, 38);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMaterialPalette() {
  const brushedBump = createBrushedMetalTexture('#808080', 44);
  const pearlBump = createPearlTactileBump();
  const frostedMap = createFrostedPalmMap();
  const pulseTex = createElectricPulseTexture();
  const logo404Tex = create404DecalTexture();

  const satinPearlWhite = new THREE.MeshPhysicalMaterial({
    color: 0xeef0f4,
    metalness: 0.08,
    roughness: 0.27,
    clearcoat: 0.28,
    clearcoatRoughness: 0.28,
    reflectivity: 0.65,
  });

  const satinWhiteRim = new THREE.MeshPhysicalMaterial({
    color: 0xe4e7eb,
    metalness: 0.1,
    roughness: 0.31,
    clearcoat: 0.22,
  });

  const ceramicNailWhite = new THREE.MeshPhysicalMaterial({
    color: 0xf7f8fa,
    metalness: 0.02,
    roughness: 0.13,
    clearcoat: 0.68,
    clearcoatRoughness: 0.10,
  });

  // Harmonious unified matte-pearl ceramic fingertip tactile surface (no dark gray rubber block!)
  const pearlTactileTip = new THREE.MeshPhysicalMaterial({
    color: 0xeaecef,
    metalness: 0.03,
    roughness: 0.36,
    clearcoat: 0.28,
    bumpMap: pearlBump,
    bumpScale: 0.009,
  });

  const darkTitanium = new THREE.MeshStandardMaterial({
    color: 0x424751,
    metalness: 0.88,
    roughness: 0.32,
    bumpMap: brushedBump,
    bumpScale: 0.008,
  });

  const titaniumMachined = new THREE.MeshStandardMaterial({
    color: 0x717884,
    metalness: 0.92,
    roughness: 0.22,
    bumpMap: brushedBump,
    bumpScale: 0.005,
  });

  const titaniumBone = new THREE.MeshPhysicalMaterial({
    color: 0x9aa1ac,
    metalness: 0.82,
    roughness: 0.24,
    clearcoat: 0.22,
  });

  const palmCavityLiner = new THREE.MeshStandardMaterial({
    color: 0x525761,
    metalness: 0.55,
    roughness: 0.48,
  });

  const silverVein = new THREE.MeshStandardMaterial({
    color: 0xdadce0,
    metalness: 0.86,
    roughness: 0.22,
  });

  // Animated traveling ice-blue neural current pulse material
  const electricPulseVein = new THREE.MeshStandardMaterial({
    color: 0x8ad8f0,
    map: pulseTex,
    emissive: new THREE.Color(0x56c8f5),
    emissiveMap: pulseTex,
    emissiveIntensity: 1.35,
    metalness: 0.35,
    roughness: 0.2,
  });

  // Smoked translucent polycarbonate shield for front short-forearm dual pistons
  const smokedGlass = new THREE.MeshPhysicalMaterial({
    color: 0x262b33,
    metalness: 0.05,
    roughness: 0.18,
    clearcoat: 0.85,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });

  // Frosted milky-white translucent palm hollow & phalanx belly composite
  const frostedPalm = new THREE.MeshPhysicalMaterial({
    color: 0xf2f5f9,
    map: frostedMap,
    metalness: 0.02,
    roughness: 0.34,
    clearcoat: 0.46,
    clearcoatRoughness: 0.24,
    sheen: 0.5,
    sheenColor: new THREE.Color(0xffffff),
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });

  const frostedPhalanx = new THREE.MeshPhysicalMaterial({
    color: 0xf1f4f8,
    metalness: 0.02,
    roughness: 0.32,
    clearcoat: 0.42,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });

  const logo404 = new THREE.MeshStandardMaterial({
    map: logo404Tex,
    transparent: true,
    roughness: 0.42,
    metalness: 0.3,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    depthWrite: false,
  });

  const seamLineMat = new THREE.MeshStandardMaterial({
    color: 0x262930,
    metalness: 0.45,
    roughness: 0.58,
  });

  return {
    satinPearlWhite,
    satinWhiteRim,
    ceramicNailWhite,
    pearlTactileTip,
    darkTitanium,
    titaniumMachined,
    titaniumBone,
    palmCavityLiner,
    silverVein,
    electricPulseVein,
    pulseTex,
    smokedGlass,
    frostedPalm,
    frostedPhalanx,
    logo404,
    seamLineMat,
  };
}
