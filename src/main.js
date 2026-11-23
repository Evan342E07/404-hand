import * as THREE from 'three/webgpu';
import {
  pass,
  mrt,
  output,
  diffuseColor,
  normalView,
  velocity,
  uniform,
  float,
  vec2,
  vec3,
  vec4,
  uv,
  dot,
  sin,
  fract,
  mix,
  clamp,
  Fn,
} from 'three/tsl';
import { ssgi } from 'three/examples/jsm/tsl/display/SSGINode.js';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { traa } from 'three/examples/jsm/tsl/display/TRAANode.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './style.css';
import { BionicAudioEngine } from './audio.js';
import { createLabStudioHDRI } from './studioEnv.js';
import { upgradeGLBMaterials, SKIN_PRESETS } from './materialsOverride.js';
import { ExplodedViewController } from './explodedView.js';
import { SpatialHotspotManager } from './hotspots.js';
import { DirectInteractionController } from './interaction.js';
import { HandKinematicRig } from './rig.js';
import { getResponsiveCameraView, initUI } from './ui.js';
import { StudioVideoRecorder } from './recorder.js';
import { CameraHandTracker } from './handTracker.js';
import { BioNeuralParticleSystem } from './neuralParticles.js';
import { createStudioReflectiveFloor } from './stageFloor.js';
import { SectionSlicerController } from './sectionSlicer.js';

// Procedural Radial Leica Charcoal Studio Cyclorama Backdrop Texture
function createStudioBackdropTexture(centerHex, midHex, edgeHex) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(232, 224, 18, 256, 256, 360);
  grad.addColorStop(0.0, centerHex);
  grad.addColorStop(0.55, midHex);
  grad.addColorStop(1.0, edgeHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const STUDIO_BACKDROPS = {
  studio: createStudioBackdropTexture('#343a47', '#21252f', '#13161d'),
  dramatic: createStudioBackdropTexture('#202633', '#11141c', '#08090e'),
  sakura: createStudioBackdropTexture('#4a344b', '#2b1e32', '#140e1a'),
};

const STUDIO_MOODS = {
  studio: {
    env: 0.90,
    exp: 0.94,
    key: 1.06,
    rim: 1.56,
    fill: 0.76,
    back: 0.98,
    keyColor: 0xfffaf4,
    rimColor: 0xd4ebff,
    fillColor: 0xeef4ff,
    backColor: 0xfff7f0,
  },
  dramatic: {
    env: 0.68,
    exp: 0.92,
    key: 1.02,
    rim: 2.25,
    fill: 0.34,
    back: 0.90,
    keyColor: 0xf4f8ff,
    rimColor: 0x9ce2ff,
    fillColor: 0xd0e4ff,
    backColor: 0xeaf4ff,
  },
  sakura: {
    env: 1.04,
    exp: 1.00,
    key: 1.14,
    rim: 1.72,
    fill: 0.94,
    back: 1.08,
    keyColor: 0xfff3f8,
    rimColor: 0xdfccff,
    fillColor: 0xffe4f0,
    backColor: 0xf9ecff,
  },
};

async function boot() {
  const canvas = document.getElementById('viewport');
  const statusEl = document.getElementById('phase-status');
  const fpsEl = document.getElementById('fps-badge');
  const backendBadgeEl = document.getElementById('backend-badge');

  // 智能检测移动端设备与强制 WebGL2 调试开关（?renderer=webgl 可随时预览优雅降级）
  const urlParams = new URLSearchParams(window.location.search);
  const forceWebGL = urlParams.get('renderer') === 'webgl';
  const isMobileDevice =
    urlParams.get('mobile') === '1' ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth <= 900) ||
    window.innerWidth <= 768;

  // === 1. NATIVE THREE.JS r187 WEBGPU RENDERER + WEBGL2 优雅自动降级 ===
  const shouldPreferWebGL = forceWebGL || !navigator.gpu;
  const createStudioRenderer = (useWebGL) => {
    const r = new THREE.WebGPURenderer({
      canvas,
      forceWebGL: useWebGL,
      // 桌面 WebGPU 由 TRAA 负责抗锯齿；WebGL2 / 移动端轻量化直渲开启原生硬件 MSAA！
      antialias: useWebGL || isMobileDevice,
      alpha: true,
      powerPreference: 'high-performance',
    });
    const maxDpr = isMobileDevice ? 1.45 : 1.6;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    r.setSize(window.innerWidth, window.innerHeight);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.94;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.localClippingEnabled = true;
    return r;
  };

  let renderer = createStudioRenderer(shouldPreferWebGL);
  try {
    await renderer.init();
  } catch (gpuErr) {
    console.warn('WebGPU 初始化受限，自动优雅降级至 WebGL2 渲染管线:', gpuErr);
    try {
      renderer.dispose?.();
    } catch {
      // 忽略清理异常
    }
    renderer = createStudioRenderer(true);
    await renderer.init();
  }

  const isWebGPU = Boolean(renderer.backend?.isWebGPUBackend);
  const useFullPostPipeline = isWebGPU && !isMobileDevice;
  const supportsSSGI = useFullPostPipeline && renderer.hasFeature('rg11b10ufloat-renderable');

  if (backendBadgeEl) {
    if (useFullPostPipeline) {
      backendBadgeEl.textContent = 'WebGPU · MRT SSGI';
    } else if (isMobileDevice) {
      backendBadgeEl.textContent = isWebGPU ? 'Mobile · WebGPU' : 'Mobile · WebGL2';
    } else {
      backendBadgeEl.textContent = 'WebGL2 · 轻量优化';
    }
  }

  // === 2. STUDIO SCENE, HDRI ENVIRONMENT & LEICA SOFTBOX LIGHTING (ZERO BLOWN-OUT WHITES!) ===
  const scene = new THREE.Scene();
  scene.background = STUDIO_BACKDROPS.studio;
  scene.environment = createLabStudioHDRI(renderer);
  scene.environmentIntensity = isWebGPU ? 0.90 : 0.96;

  const keyLight = new THREE.DirectionalLight(0xfffaf4, 1.06);
  keyLight.position.set(11, 20, 18);
  keyLight.castShadow = true;
  const shadowRes = isMobileDevice ? 1024 : 2048;
  keyLight.shadow.mapSize.set(shadowRes, shadowRes);
  keyLight.shadow.camera.near = 4;
  keyLight.shadow.camera.far = 52;
  keyLight.shadow.camera.left = -11;
  keyLight.shadow.camera.right = 11;
  keyLight.shadow.camera.top = 16;
  keyLight.shadow.camera.bottom = -12;
  keyLight.shadow.bias = -0.0003;
  keyLight.shadow.radius = isMobileDevice ? 2.0 : 3.2;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xd4ebff, 1.56);
  rimLight.position.set(-16, 13, -15);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xeef4ff, 0.76);
  fillLight.position.set(-14, 5, 16);
  scene.add(fillLight);

  const backKey = new THREE.DirectionalLight(0xfff7f0, 0.98);
  backKey.position.set(11, 8, -19);
  scene.add(backKey);

  // Native TSL Reflector Obsidian Mirror Floor + Contact Shadow（移动端默认省去二次镜面渲染，保留柔和悬浮影）
  const stageFloor = createStudioReflectiveFloor(scene);
  if (isMobileDevice) {
    stageFloor.setReflectionEnabled(false);
    const floorChk = document.getElementById('ctrl-floor-reflect');
    if (floorChk) floorChk.checked = false;
  }

  let activeMoodKey = 'studio';
  let isArLiveMode = false;

  function applyStudioMood(moodKey) {
    activeMoodKey = STUDIO_MOODS[moodKey] ? moodKey : 'studio';
    const m = STUDIO_MOODS[activeMoodKey];
    if (!isArLiveMode) {
      scene.background = STUDIO_BACKDROPS[activeMoodKey];
    }
    scene.environmentIntensity = m.env;
    renderer.toneMappingExposure = m.exp;
    keyLight.intensity = m.key;
    rimLight.intensity = m.rim;
    fillLight.intensity = m.fill;
    backKey.intensity = m.back;
    keyLight.color.setHex(m.keyColor);
    rimLight.color.setHex(m.rimColor);
    fillLight.color.setHex(m.fillColor);
    backKey.color.setHex(m.backColor);
    stageFloor.setMoodTint();
  }

  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.2, 200);
  const initView = getResponsiveCameraView('front');
  camera.position.set(...initView.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 6.5;
  controls.maxDistance = 82;
  controls.rotateSpeed = isMobileDevice ? 0.78 : 1.0;
  controls.zoomSpeed = isMobileDevice ? 0.92 : 1.0;
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };
  controls.target.set(...initView.target);

  // === 3. SINGLE-PASS MRT TSL RENDER PIPELINE（桌面 WebGPU 满血 MRT SSGI；WebGL2 / 移动端自动降级为轻量化直渲） ===
  const uSsgiEnabled = uniform(supportsSSGI ? 1.0 : 0.0);
  const uCinemaEnabled = uniform(1.0);
  const uCinemaTime = uniform(0.0);
  let renderPipeline = null;

  if (useFullPostPipeline) {
    // 4-Attachment Single-Pass MRT strictly <= 28 bytes/sample (100% WebGPU universal spec!)
    const scenePass = pass(scene, camera);
    scenePass.setMRT(
      mrt({
        output,
        normal: normalView,
        diffuseColor,
        velocity,
      })
    );

    const normalTexture = scenePass.getTexture('normal');
    if (normalTexture) normalTexture.type = THREE.HalfFloatType;
    const diffuseTexture = scenePass.getTexture('diffuseColor');
    if (diffuseTexture) diffuseTexture.type = THREE.UnsignedByteType;
    const velocityTexture = scenePass.getTexture('velocity');
    if (velocityTexture) {
      velocityTexture.format = THREE.RGFormat;
      velocityTexture.type = THREE.HalfFloatType;
    }

    const scenePassColor = scenePass.getTextureNode('output');
    const scenePassDiffuse = scenePass.getTextureNode('diffuseColor');
    const scenePassDepth = scenePass.getTextureNode('depth');
    const scenePassNormal = scenePass.getTextureNode('normal');
    const scenePassVelocity = scenePass.getTextureNode('velocity');

    let litComposite = scenePassColor;

    if (supportsSSGI) {
      const giPass = ssgi(scenePassColor, scenePassDepth, scenePassNormal, camera);
      giPass.sliceCount.value = 3;
      giPass.stepCount.value = 10;
      giPass.radius.value = 3.8;
      giPass.aoIntensity.value = 0.76;
      giPass.giIntensity.value = 1.45;
      giPass.useTemporalFiltering = true;

      const aoVal = mix(float(1.0), giPass.getAONode().r, uSsgiEnabled);
      const giBounce = giPass.getGINode().rgb.mul(scenePassDiffuse.rgb).mul(uSsgiEnabled);
      litComposite = vec4(scenePassColor.rgb.mul(aoVal).add(giBounce), scenePassColor.a);
    }

    const bloomPass = bloom(scenePassColor, 0.22, 0.34, 1.56);
    const hdrComposite = vec4(litComposite.rgb.add(bloomPass.rgb), litComposite.a);
    const aaPass = traa(hdrComposite, scenePassDepth, scenePassVelocity, camera);

    const cinemaOutput = Fn(() => {
      const uvCoord = uv();
      const baseCol = aaPass.rgb;
      const centered = uvCoord.sub(0.5);
      const distSq = dot(centered, centered);
      const vig = clamp(float(1.0).sub(distSq.mul(0.22)), float(0.76), float(1.0));
      const graded = baseCol.mul(vig);
      return vec4(mix(baseCol, graded, uCinemaEnabled), aaPass.a);
    })();

    renderPipeline = new THREE.RenderPipeline(renderer, cinemaOutput);
  } else {
    const ssgiChk = document.getElementById('ctrl-ssgi');
    if (ssgiChk) ssgiChk.checked = false;
  }

  // === 4. KINEMATICS, 16,384 COMPUTE SHADER PARTICLES, SLICER & DIRECT INTERACTION ===
  // Spherical Turntable Orbit Fly-To (orbits cleanly around the sculpture on Front <-> Back flips!)
  let camTargetPos = null;
  let camTargetLook = null;
  const _sphCur = new THREE.Spherical();
  const _sphTgt = new THREE.Spherical();
  const _offCur = new THREE.Vector3();
  const _offTgt = new THREE.Vector3();
  const flyCameraTo = (posArr, lookArr) => {
    camTargetPos = new THREE.Vector3(...posArr);
    camTargetLook = new THREE.Vector3(...lookArr);
  };
  controls.addEventListener('start', () => {
    camTargetPos = null;
    camTargetLook = null;
  });

  const audio = new BionicAudioEngine();
  const rig = new HandKinematicRig({ audio });
  const neuralParticles = new BioNeuralParticleSystem();
  neuralParticles.init(scene, renderer, { maxParticles: isMobileDevice ? 4096 : 16384 });
  const slicerCtrl = new SectionSlicerController(scene);

  let activeModelRoot = null;
  let activePalmAnchor = null;
  let activeForearmAnchor = null;
  let activeMatRefs = null;
  let explodedCtrl = null;
  let hotspotMgr = null;
  let directCtrl = null;
  let uiApi = null;
  let activeViewKey = 'front';
  let activeSkinKey = 'ceramic';

  function applySkinPreset(skinKey) {
    const validKey = SKIN_PRESETS[skinKey] ? skinKey : 'ceramic';
    activeSkinKey = validKey;
    const preset = activeMatRefs?.setSkinPreset?.(validKey) || SKIN_PRESETS[validKey];
    neuralParticles.setAccentColor(preset.accentCore, preset.accentHot);
    stageFloor.setAccentColor(preset.accentCore, preset.accentHot);
    return preset;
  }

  const gltfLoader = new GLTFLoader();

  function loadGLBFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.glb')) return;
    const url = URL.createObjectURL(file);
    gltfLoader.load(url, (gltf) => {
      mountGLBScene(gltf, `自定义高模预览 · ${file.name}`);
      URL.revokeObjectURL(url);
    });
  }

  uiApi = initUI({
    rig,
    explodedCtrl: {
      get targetAmount() {
        return explodedCtrl ? explodedCtrl.targetAmount : 0;
      },
      setTarget(v) {
        explodedCtrl?.setTarget(v);
      },
    },
    slicerCtrl: {
      setTarget(v) {
        slicerCtrl.setTarget(v);
      },
    },
    hotspotMgr: {
      setEnabled(flag) {
        hotspotMgr?.setEnabled(flag);
      },
      clearSelection() {
        hotspotMgr?.clearSelection();
      },
    },
    audio,
    onSelectCameraView: (viewKey) => {
      activeViewKey = viewKey;
      const v = getResponsiveCameraView(viewKey);
      flyCameraTo(v.pos, v.target);
    },
    onResetAll: () => {
      activeViewKey = 'front';
      rig.applyPreset('open');
      rig.setParam('palmClarity', 0.78);
      applySkinPreset('ceramic');
      directCtrl?.restoreAllArmor();
      hotspotMgr?.clearSelection();
      explodedCtrl?.setTarget(0);
      slicerCtrl.setTarget(0);
      const v = getResponsiveCameraView('front');
      flyCameraTo(v.pos, v.target);
    },
    onRestoreArmor: () => {
      directCtrl?.restoreAllArmor();
    },
    onSkinChange: (skinKey) => {
      applySkinPreset(skinKey);
    },
    onStudioMoodChange: (moodKey) => {
      applyStudioMood(moodKey);
    },
    onSSGIChange: (enabled) => {
      uSsgiEnabled.value = enabled && supportsSSGI ? 1.0 : 0.0;
    },
    onComputeFieldChange: (enabled) => {
      neuralParticles.setFieldEnabled(enabled);
    },
    onUltraOpticsChange: (enabled) => {
      activeMatRefs?.setUltraOptics?.(enabled);
    },
    onCinemaLensChange: (enabled) => {
      uCinemaEnabled.value = enabled ? 1.0 : 0.0;
    },
    onFloorReflectChange: (enabled) => {
      stageFloor.setReflectionEnabled(enabled);
    },
    onLoadCustomGLB: loadGLBFile,
  });

  const recMenuBtn = document.getElementById('record-menu-btn');
  const recBtnLabel = document.getElementById('record-btn-label');
  const recPopover = document.getElementById('record-popover');
  const recToast = document.getElementById('record-toast');
  let toastTimer = null;

  const showRecToast = (msg) => {
    if (!recToast) return;
    recToast.textContent = msg;
    recToast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => recToast.classList.add('hidden'), 4200);
  };

  // === 摄像头实时手势追踪 & AR 实景机械手替换绑定（MediaPipe Hands · 手机优先后置镜头） ===
  const camTrackBtn = document.getElementById('camera-track-btn');
  const camBtnLabel = document.getElementById('camera-btn-label');
  if (camBtnLabel) camBtnLabel.textContent = isMobileDevice ? '手势' : '手势追踪';
  const trackerArBtn = document.getElementById('tracker-ar-btn');
  const trackerFlipBtn = document.getElementById('tracker-flip-btn');
  const trackerCloseBtn = document.getElementById('tracker-close-btn');

  let prevHotspotsBeforeAr = true;

  const setArVisualState = (enabled) => {
    isArLiveMode = Boolean(enabled);
    if (isArLiveMode) {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      stageFloor.setVisible(false);
      prevHotspotsBeforeAr = hotspotMgr ? hotspotMgr.enabled : true;
      hotspotMgr?.setEnabled(false);
      controls.enabled = false;
      camTargetPos = null;
      camTargetLook = null;
      camera.position.set(0, 2.5, 42.0);
      controls.target.set(0, 2.5, 0);
      camera.lookAt(0, 2.5, 0);
    } else {
      scene.background = STUDIO_BACKDROPS[activeMoodKey] || STUDIO_BACKDROPS.studio;
      renderer.setClearColor(0x000000, 1);
      stageFloor.setVisible(true);
      hotspotMgr?.setEnabled(prevHotspotsBeforeAr);
      controls.enabled = true;
      if (activeModelRoot) {
        activeModelRoot.visible = true;
        activeModelRoot.position.set(0, 0, 0);
        activeModelRoot.rotation.set(0, 0, 0);
        activeModelRoot.scale.setScalar(1);
      }
      const v = getResponsiveCameraView(activeViewKey);
      flyCameraTo(v.pos, v.target);
    }
  };

  const handTracker = new CameraHandTracker({
    rig,
    isMobile: isMobileDevice,
    onStateChange: ({ active, loading, arMode, error }) => {
      camTrackBtn?.classList.toggle('tracking', Boolean(active));
      camTrackBtn?.classList.toggle('loading', Boolean(loading && !active));
      if (camBtnLabel) {
        if (loading && !active) {
          camBtnLabel.textContent = '加载中...';
        } else if (isMobileDevice) {
          camBtnLabel.textContent = active ? (arMode ? 'AR中' : '追踪中') : '手势';
        } else {
          camBtnLabel.textContent = active ? (arMode ? 'AR 替换中' : '追踪中') : '手势追踪';
        }
      }
      if (error) showRecToast(error);
    },
    onArModeChange: (arActive) => {
      setArVisualState(arActive);
      if (camBtnLabel && handTracker.active) {
        if (isMobileDevice) {
          camBtnLabel.textContent = arActive ? 'AR中' : '追踪中';
        } else {
          camBtnLabel.textContent = arActive ? 'AR 替换中' : '追踪中';
        }
      }
    },
    onArTransform: (tf) => {
      if (!activeModelRoot) return;
      if (!tf) {
        activeModelRoot.visible = true;
        activeModelRoot.position.set(0, 0, 0);
        activeModelRoot.rotation.order = 'XYZ';
        activeModelRoot.rotation.set(0, 0, 0);
        activeModelRoot.scale.setScalar(1);
        return;
      }
      activeModelRoot.visible = Boolean(tf.visible);
      if (tf.visible) {
        // 先绕 Z 随镜头平面倾斜，再绕手腕 Y 轴自由翻手（绝不覆盖 rig.js 的 forearmRot 翻手角！）
        activeModelRoot.rotation.order = 'ZXY';
        activeModelRoot.position.set(tf.x, tf.y, 0);
        activeModelRoot.rotation.z = tf.rollZ;
        activeModelRoot.scale.setScalar(tf.scale);
      }
    },
    onPoseSync: (pose) => {
      uiApi?.syncSingleSlider('thumb', pose.thumb);
      uiApi?.syncSingleSlider('index', pose.index);
      uiApi?.syncSingleSlider('middle', pose.middle);
      uiApi?.syncSingleSlider('ring', pose.ring);
      uiApi?.syncSingleSlider('pinky', pose.pinky);
    },
  });

  camTrackBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    if (handTracker.active) {
      handTracker.stop();
    } else {
      handTracker.start();
    }
  });

  trackerArBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    handTracker.toggleArMode();
  });

  trackerFlipBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    handTracker.toggleFacingMode();
  });

  trackerCloseBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    handTracker.stop();
  });

  // === 内置 60 FPS 高清录屏交互绑定（纯 3D 画布 / 含 UI 标签页 / 16s 自动大片） ===

  const recorder = new StudioVideoRecorder({
    canvas,
    audio,
    onToast: showRecToast,
    onStateChange: ({ recording, elapsed }) => {
      recMenuBtn?.classList.toggle('recording', recording);
      if (recBtnLabel) {
        recBtnLabel.textContent = recording ? `停止 ${elapsed}` : '录制视频';
      }
      if (recording) {
        recPopover?.classList.add('hidden');
        recToast?.classList.add('hidden');
      }
    },
  });

  recMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    audio?.playUiClick();
    if (recorder.isRecording) {
      recorder.stop();
    } else {
      recPopover?.classList.toggle('hidden');
    }
  });

  document.addEventListener('click', (e) => {
    if (!recPopover || recPopover.classList.contains('hidden')) return;
    if (!recPopover.contains(e.target) && e.target !== recMenuBtn) {
      recPopover.classList.add('hidden');
    }
  });

  document.getElementById('rec-mode-canvas')?.addEventListener('click', () => {
    audio?.playUiClick();
    recPopover?.classList.add('hidden');
    recorder.startCanvasRecording();
  });

  document.getElementById('rec-mode-screen')?.addEventListener('click', () => {
    audio?.playUiClick();
    recPopover?.classList.add('hidden');
    recorder.startScreenRecording();
  });

  document.getElementById('rec-mode-demo')?.addEventListener('click', () => {
    audio?.playUiClick();
    recPopover?.classList.add('hidden');
    recorder.startAutoDemoRecording({
      setView: (viewKey) => {
        activeViewKey = viewKey;
        document.querySelectorAll('.cam-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === viewKey));
        const v = getResponsiveCameraView(viewKey);
        flyCameraTo(v.pos, v.target);
      },
      setPreset: (presetKey) => {
        rig.applyPreset(presetKey);
        document.querySelectorAll('.preset-btn').forEach((b) => b.classList.toggle('active', b.dataset.preset === presetKey));
      },
      setExplode: (val) => {
        explodedCtrl?.setTarget(val);
        const sl = document.getElementById('ctrl-explode');
        const out = document.getElementById('val-explode');
        if (sl) sl.value = String(val);
        if (out) out.textContent = `${Math.round(val * 100)}%`;
        document.getElementById('toggle-explode-btn')?.classList.toggle('active', val > 0.05);
      },
      setHotspots: (enabled) => {
        hotspotMgr?.setEnabled(enabled);
        document.getElementById('toggle-hotspots-btn')?.classList.toggle('active', enabled);
      },
    });
  });

  function mountGLBScene(gltf, label) {
    if (activeModelRoot) {
      directCtrl?.dispose();
      activeMatRefs?.disposeTextures?.();
      scene.remove(activeModelRoot);
      activeModelRoot.traverse((n) => {
        if (n.isMesh) {
          n.geometry?.dispose();
          if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
          else n.material?.dispose();
        }
      });
    }
    if (explodedCtrl) {
      scene.remove(explodedCtrl.leaderLines);
      explodedCtrl.lineGeom.dispose();
      explodedCtrl.lineMat.dispose();
    }

    const model = gltf.scene;
    const matRefs = upgradeGLBMaterials(model);
    scene.add(model);
    activeModelRoot = model;
    activePalmAnchor =
      model.getObjectByName('Bone_Palm_Metacarpal_Center') ||
      model.getObjectByName('Armor_Palm_MainBody') ||
      model.getObjectByName('Palm') ||
      null;
    activeForearmAnchor =
      model.getObjectByName('Forearm_LightConduit_Lens') ||
      model.getObjectByName('Forearm_BaseCuff') ||
      model.getObjectByName('Forearm') ||
      null;
    activeMatRefs = matRefs;
    applySkinPreset(activeSkinKey);

    rig.attachModel(model, matRefs);
    slicerCtrl.attachModel(model, matRefs);
    explodedCtrl = new ExplodedViewController(scene, model);

    directCtrl = new DirectInteractionController({
      domElement: renderer.domElement,
      camera,
      controls,
      rootObj: model,
      rig,
      audio,
      onDigitDrag: (digitKey, val) => {
        uiApi?.syncSingleSlider(digitKey, val);
        document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      },
      onHiddenCountChange: (count) => {
        uiApi?.updateHiddenCount(count);
      },
    });

    hotspotMgr = new SpatialHotspotManager({
      container: document.getElementById('hotspot-layer'),
      cardEl: document.getElementById('telemetry-card'),
      camera,
      boneMap: rig.bones,
      onFlyTo: flyCameraTo,
      audio,
    });

    window.__BIONIC_STUDIO__ = {
      backend: isWebGPU ? 'WebGPU' : 'WebGL2',
      isMobile: isMobileDevice,
      useFullPostPipeline,
      supportsSSGI,
      particleCount: neuralParticles.count,
      computeParticles: neuralParticles.isComputeMode,
      rig,
      explodedCtrl,
      slicerCtrl,
      hotspotMgr,
      directCtrl,
      flyCameraTo,
      applyStudioMood,
      applySkinPreset,
      getSkinPreset: () => activeSkinKey,
      handTracker,
      getFps: () => currentFps,
      getPartCount: () => directCtrl?.pickables.length || 0,
    };
  }

  const modelLoaderPill = document.getElementById('model-loader-pill');
  const modelLoaderText = document.getElementById('model-loader-text');
  const modelLoaderRetry = document.getElementById('model-loader-retry');

  const loadStudioGLB = (attempt = 0) => {
    modelLoaderPill?.classList.remove('hidden');
    modelLoaderRetry?.classList.add('hidden');
    if (modelLoaderText) {
      modelLoaderText.textContent =
        attempt > 0 ? `正在重新连接加载模型 (第 ${attempt} 次)...` : '正在加载精密机械手高模...';
    }
    const url = attempt > 0 ? `./models/hand_404_rigged.glb?v=94&retry=${attempt}` : './models/hand_404_rigged.glb?v=94';
    gltfLoader.load(
      url,
      (gltf) => {
        if (modelLoaderText) modelLoaderText.textContent = '正在编译材质与骨骼...';
        mountGLBScene(gltf, '');
        modelLoaderPill?.classList.add('hidden');
      },
      (xhr) => {
        if (!modelLoaderText) return;
        const total = xhr.total || 12463820;
        const pct = Math.min(99, Math.round((xhr.loaded / total) * 100));
        const loadedMb = (xhr.loaded / (1024 * 1024)).toFixed(1);
        const totalMb = (total / (1024 * 1024)).toFixed(1);
        modelLoaderText.textContent = `加载机械手高模 ${pct}% (${loadedMb}/${totalMb} MB)`;
      },
      (err) => {
        console.error('Failed to load GLB:', err);
        if (attempt < 2) {
          setTimeout(() => loadStudioGLB(attempt + 1), 1200);
          return;
        }
        if (modelLoaderText) {
          modelLoaderText.textContent = '模型加载超时，请点击重试或用系统浏览器打开';
        }
        modelLoaderRetry?.classList.remove('hidden');
        showRecToast('3D 模型加载失败，请点击屏幕中央「重试」');
      }
    );
  };

  modelLoaderRetry?.addEventListener('click', () => loadStudioGLB(1));
  loadStudioGLB(0);

  // Window Drag & Drop GLB Preview
  const dropOverlay = document.getElementById('drop-overlay');
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropOverlay?.classList.remove('hidden');
  });
  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) dropOverlay?.classList.add('hidden');
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay?.classList.add('hidden');
    loadGLBFile(e.dataTransfer?.files?.[0]);
  });

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const curDpr = Math.min(window.devicePixelRatio || 1, isMobileDevice ? 1.45 : 1.6);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(curDpr);
    renderer.setSize(w, h);
    const v = getResponsiveCameraView(activeViewKey, w, h);
    flyCameraTo(v.pos, v.target);
  });

  // === 5. REAL-TIME 60/120 FPS ANIMATION LOOP ===
  const clock = new THREE.Clock();
  let frameCount = 0;
  let fpsAccum = 0;
  let currentFps = 60;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;

    frameCount++;
    fpsAccum += dt;
    if (fpsAccum >= 0.5) {
      currentFps = Math.round(frameCount / fpsAccum);
      if (fpsEl) fpsEl.textContent = `${currentFps} FPS`;
      frameCount = 0;
      fpsAccum = 0;
    }

    if (camTargetPos && camTargetLook) {
      const camAlpha = 1 - Math.exp(-dt * 8.2);
      controls.target.lerp(camTargetLook, camAlpha);
      _offCur.copy(camera.position).sub(controls.target);
      _offTgt.copy(camTargetPos).sub(camTargetLook);
      _sphCur.setFromVector3(_offCur);
      _sphTgt.setFromVector3(_offTgt);
      // Shortest angular arc around azimuth theta so Front <-> Back glides cleanly around the sculpture!
      let dTheta = _sphTgt.theta - _sphCur.theta;
      while (dTheta > Math.PI) dTheta -= Math.PI * 2;
      while (dTheta < -Math.PI) dTheta += Math.PI * 2;
      _sphCur.radius += (_sphTgt.radius - _sphCur.radius) * camAlpha;
      _sphCur.phi += (_sphTgt.phi - _sphCur.phi) * camAlpha;
      _sphCur.theta += dTheta * camAlpha;
      _offCur.setFromSpherical(_sphCur);
      camera.position.copy(controls.target).add(_offCur);
      if (camera.position.distanceTo(camTargetPos) < 0.06 && controls.target.distanceTo(camTargetLook) < 0.05) {
        camera.position.copy(camTargetPos);
        controls.target.copy(camTargetLook);
        camTargetPos = null;
        camTargetLook = null;
      }
    }

    rig.update(dt, elapsed);
    slicerCtrl.update(dt);
    explodedCtrl?.update(dt);
    stageFloor.update(elapsed, rig.pulseBoost || 0);
    activeModelRoot?.updateMatrixWorld(true);
    neuralParticles.update(
      renderer,
      dt,
      rig.pulseBoost || 0,
      rig.pulseEnabled,
      activePalmAnchor,
      activeForearmAnchor
    );
    uCinemaTime.value = elapsed;

    controls.update();
    // AR 实景替换模式强制使用原生 alpha 透明直渲，使 3D 机械手无瑕叠加于真实摄像头画面之上！
    if (renderPipeline && !isArLiveMode) {
      renderPipeline.render();
    } else {
      renderer.render(scene, camera);
    }
    hotspotMgr?.update(window.innerWidth, window.innerHeight);
  });
}

boot().catch((err) => {
  console.error('WebGPU / TSL Studio boot failed:', err);
  const statusEl = document.getElementById('phase-status');
  if (statusEl) statusEl.textContent = `渲染管线初始化失败: ${err.message}`;
});
