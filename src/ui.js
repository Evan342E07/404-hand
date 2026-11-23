import { POSE_PRESETS } from './rig.js';

export const BASE_CAMERA_VIEWS = {
  front: { pos: [0, 2.2, 47.0], target: [0, 2.1, 0] },
  back: { pos: [0, 2.2, -47.0], target: [0, 2.1, 0] },
  threeQuarter: { pos: [24.5, 4.6, 38.0], target: [0, 2.2, 0] },
  palmMacro: { pos: [-0.2, 3.8, 15.2], target: [-0.3, 3.8, 0.2] },
  wristDetail: { pos: [-8.8, 0.2, -14.2], target: [0, 0.1, 0] },
};

/**
 * Shared viewport-aware Safe-Frame camera transform used by BOTH preset views AND hotspot fly-tos
 * (V2-DEF-03 fix: guarantees zoomed macro targets NEVER collide with header, telemetry card, or right console!)
 */
export function computeSafeFrameCamera(basePos, baseTarget, width = window.innerWidth, height = window.innerHeight) {
  const aspect = width / Math.max(1, height);
  const isMobileSheet = width <= 768;
  const panelCollapsed =
    isMobileSheet ||
    document.body.classList.contains('zen-mode') ||
    document.getElementById('control-panel')?.classList.contains('is-collapsed');
  const panelW = panelCollapsed ? 0 : width <= 1060 ? 256 : 284;
  const panelFrac = panelW / Math.max(400, width);

  // 竖屏手机适度微调取景，保证整只机械手尽量饱满大尺寸居中且避开上下精简栏
  let narrowBoost = 1.0;
  if (aspect < 0.85) {
    narrowBoost = Math.min(1.22, 0.78 / Math.max(0.45, aspect));
  } else if (aspect < 1.35) {
    narrowBoost = 1.12;
  }

  const distVec = [
    (basePos[0] - baseTarget[0]) * narrowBoost,
    (basePos[1] - baseTarget[1]) * narrowBoost,
    (basePos[2] - baseTarget[2]) * narrowBoost,
  ];
  const dist = Math.hypot(distVec[0], distVec[1], distVec[2]);

  const visH = 2 * dist * Math.tan((34 * Math.PI) / 360);
  const visW = visH * aspect;
  const rightShift = visW * (panelFrac * 0.44);

  const fwdX = -distVec[0];
  const fwdZ = -distVec[2];
  const fwdLen = Math.hypot(fwdX, fwdZ) || 1;
  const rx = -fwdZ / fwdLen;
  const rz = fwdX / fwdLen;

  const yOffset = isMobileSheet ? 0.35 : 0;
  const target = [baseTarget[0] + rx * rightShift, baseTarget[1] + yOffset, baseTarget[2] + rz * rightShift];
  const pos = [target[0] + distVec[0], target[1] + distVec[1], target[2] + distVec[2]];
  return { pos, target };
}

export function getResponsiveCameraView(viewKey, width = window.innerWidth, height = window.innerHeight) {
  const base = BASE_CAMERA_VIEWS[viewKey] || BASE_CAMERA_VIEWS.front;
  return computeSafeFrameCamera(base.pos, base.target, width, height);
}

function paintSliderTrack(el) {
  if (!el) return;
  const min = parseFloat(el.min) || 0;
  const max = parseFloat(el.max) || 1;
  const val = parseFloat(el.value) || 0;
  const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
  el.style.background = `linear-gradient(90deg, rgba(120,216,255,0.85) ${pct}%, rgba(255,255,255,0.14) ${pct}%)`;
}

export function initUI({
  rig,
  explodedCtrl,
  slicerCtrl,
  hotspotMgr,
  audio,
  onSelectCameraView,
  onResetAll,
  onRestoreArmor,
  onSkinChange,
  onStudioMoodChange,
  onSSGIChange,
  onComputeFieldChange,
  onUltraOpticsChange,
  onCinemaLensChange,
  onFloorReflectChange,
  onLoadCustomGLB,
}) {
  const controlPanel = document.getElementById('control-panel');
  const panelTabs = document.getElementById('panel-tabs');
  const panelBody = document.getElementById('panel-body');
  const collapseBtn = document.getElementById('collapse-panel-btn');

  // Panel Collapse Toggle & 移动端底部抽屉控制
  const mobilePanelBtn = document.getElementById('mobile-panel-btn');
  const setMobileSheetOpen = (open) => {
    controlPanel?.classList.toggle('mobile-open', open);
    mobilePanelBtn?.classList.toggle('active', open);
    if (collapseBtn && window.innerWidth <= 768) {
      collapseBtn.textContent = open ? '收起 ▾' : '▾';
    }
  };

  collapseBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    if (window.innerWidth <= 768) {
      setMobileSheetOpen(false);
      return;
    }
    const collapsed = panelBody.classList.toggle('collapsed');
    panelTabs?.classList.toggle('collapsed', collapsed);
    controlPanel?.classList.toggle('is-collapsed', collapsed);
    collapseBtn.textContent = collapsed ? '▸' : '▾';
  });

  mobilePanelBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    const isOpen = controlPanel?.classList.contains('mobile-open');
    setMobileSheetOpen(!isOpen);
  });

  // 外观涂装一键切换（纳米纯白陶 / 曜石暗钛 / 透明探索版 / 樱花珠光粉）
  const SKIN_ORDER = ['ceramic', 'obsidian', 'transparent', 'sakura'];
  const SKIN_DOT_COLORS = {
    ceramic: '#e4e8f0',
    obsidian: '#ff9e2c',
    transparent: '#24f5df',
    sakura: '#ff8cc4',
  };
  let curSkinKey = 'ceramic';
  const skinBtns = document.querySelectorAll('.skin-btn');
  const mobileSkinBtn = document.getElementById('mobile-skin-btn');
  const mobileSkinDot = document.getElementById('mobile-skin-dot');

  const syncSkinUI = (skinKey) => {
    curSkinKey = SKIN_ORDER.includes(skinKey) ? skinKey : 'ceramic';
    skinBtns.forEach((b) => b.classList.toggle('active', b.dataset.skin === curSkinKey));
    if (mobileSkinDot) {
      mobileSkinDot.style.background = SKIN_DOT_COLORS[curSkinKey] || '#e4e8f0';
    }
  };

  const syncMoodUI = (moodKey) => {
    document.querySelectorAll('.mood-btn').forEach((b) => b.classList.toggle('active', b.dataset.mood === moodKey));
  };

  skinBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      audio?.playUiClick();
      const key = btn.dataset.skin;
      syncSkinUI(key);
      onSkinChange?.(key);
      const pairedMood = key === 'sakura' ? 'sakura' : 'studio';
      syncMoodUI(pairedMood);
      onStudioMoodChange?.(pairedMood);
    });
  });

  mobileSkinBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    const idx = SKIN_ORDER.indexOf(curSkinKey);
    const nextKey = SKIN_ORDER[(idx + 1) % SKIN_ORDER.length];
    syncSkinUI(nextKey);
    onSkinChange?.(nextKey);
    const pairedMood = nextKey === 'sakura' ? 'sakura' : 'studio';
    syncMoodUI(pairedMood);
    onStudioMoodChange?.(pairedMood);
  });

  // 3-Tab Precision Console Navigation
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      audio?.playUiClick();
      const targetTab = btn.dataset.tab;
      tabBtns.forEach((b) => {
        const isAct = b.dataset.tab === targetTab;
        b.classList.toggle('active', isAct);
        b.setAttribute('aria-selected', String(isAct));
      });
      tabPanes.forEach((p) => p.classList.toggle('active', p.dataset.pane === targetTab));
    });
  });

  // Audio Mute Toggle
  const muteBtn = document.getElementById('toggle-mute-btn');
  muteBtn?.addEventListener('click', () => {
    const nextMuted = !audio.muted;
    audio.setMuted(nextMuted);
    muteBtn.classList.toggle('muted', nextMuted);
    muteBtn.textContent = nextMuted ? '静音' : '音效开';
    if (!nextMuted) audio.playUiClick();
  });

  // Zen / Pure Showcase Mode (button + mobile zen button + 'H' keyboard shortcut)
  const zenBtn = document.getElementById('toggle-zen-btn');
  const mobileZenBtn = document.getElementById('mobile-zen-btn');
  const exitZenBtn = document.getElementById('exit-zen-btn');
  const setZenMode = (enabled) => {
    document.body.classList.toggle('zen-mode', enabled);
    exitZenBtn?.classList.toggle('hidden', !enabled);
    zenBtn?.classList.toggle('active', enabled);
    mobileZenBtn?.classList.toggle('active', enabled);
  };
  zenBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    setZenMode(!document.body.classList.contains('zen-mode'));
  });
  mobileZenBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    setZenMode(!document.body.classList.contains('zen-mode'));
  });
  exitZenBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    setZenMode(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'h' || e.key === 'H') {
      setZenMode(!document.body.classList.contains('zen-mode'));
    }
  });

  // Camera View Switcher
  const camBtns = document.querySelectorAll('.cam-btn');
  const setActiveCamBtn = (key) => {
    camBtns.forEach((b) => b.classList.toggle('active', b.dataset.view === key));
  };
  camBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      audio?.playFlyToSwoosh();
      setActiveCamBtn(btn.dataset.view);
      hotspotMgr?.clearSelection();
      onSelectCameraView(btn.dataset.view);
    });
  });

  // Studio Lighting Mood Switcher (Tab 3: LAB)
  const moodBtns = document.querySelectorAll('.mood-btn');
  moodBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      audio?.playUiClick();
      moodBtns.forEach((b) => b.classList.toggle('active', b === btn));
      onStudioMoodChange?.(btn.dataset.mood);
    });
  });

  // 3D Laser Section Slicer & Ultra Optics Controls (Tab 3: LAB)
  const sliceEl = document.getElementById('ctrl-slice');
  const sliceVal = document.getElementById('val-slice');
  const setSliceValue = (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    if (sliceEl) {
      sliceEl.value = clamped;
      paintSliderTrack(sliceEl);
    }
    if (sliceVal) sliceVal.textContent = clamped <= 0.01 ? '关闭' : `${Math.round(clamped * 100)}%`;
    slicerCtrl?.setTarget(clamped);
  };
  if (sliceEl) {
    paintSliderTrack(sliceEl);
    sliceEl.addEventListener('input', () => {
      setSliceValue(parseFloat(sliceEl.value));
      audio?.playDetentTick();
    });
  }

  document.getElementById('ctrl-ssgi')?.addEventListener('change', (e) => {
    audio?.playUiClick();
    onSSGIChange?.(e.target.checked);
  });
  document.getElementById('ctrl-compute-field')?.addEventListener('change', (e) => {
    audio?.playUiClick();
    onComputeFieldChange?.(e.target.checked);
  });
  document.getElementById('ctrl-ultra-optics')?.addEventListener('change', (e) => {
    audio?.playUiClick();
    onUltraOpticsChange?.(e.target.checked);
  });
  document.getElementById('ctrl-cinema-lens')?.addEventListener('change', (e) => {
    audio?.playUiClick();
    onCinemaLensChange?.(e.target.checked);
  });
  document.getElementById('ctrl-floor-reflect')?.addEventListener('change', (e) => {
    audio?.playUiClick();
    onFloorReflectChange?.(e.target.checked);
  });

  // Reference Compare Overlay (Tab 3: LAB)
  const refChk = document.getElementById('toggle-ref-chk');
  const refOverlay = document.getElementById('ref-overlay');
  const refControls = document.getElementById('ref-controls');
  const refImg = document.getElementById('ref-overlay-img');
  const refOpacity = document.getElementById('ref-opacity');
  const refOpacityVal = document.getElementById('val-ref-opacity');
  const refSwitchBtns = refControls?.querySelectorAll('.mini-btn') || [];

  refChk?.addEventListener('change', () => {
    audio?.playUiClick();
    const active = refChk.checked;
    refOverlay?.classList.toggle('hidden', !active);
    refControls?.classList.toggle('hidden', !active);
  });

  refSwitchBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      audio?.playUiClick();
      refSwitchBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (refImg) refImg.src = btn.dataset.ref;
      const vKey = btn.dataset.ref.includes('BACK') ? 'back' : 'front';
      setActiveCamBtn(vKey);
      onSelectCameraView(vKey);
    });
  });

  if (refOpacity) {
    paintSliderTrack(refOpacity);
    refOpacity.addEventListener('input', () => {
      const v = parseFloat(refOpacity.value);
      if (refImg) refImg.style.opacity = v;
      if (refOpacityVal) refOpacityVal.textContent = `${Math.round(v * 100)}%`;
      paintSliderTrack(refOpacity);
    });
  }

  // Custom GLB File Upload Button (Tab 3: LAB)
  const uploadBtn = document.getElementById('upload-glb-btn');
  const fileInput = document.getElementById('glb-file-input');
  uploadBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) onLoadCustomGLB?.(file);
  });

  // Spatial Hotspots Toggle
  const hotspotsBtn = document.getElementById('toggle-hotspots-btn');
  hotspotsBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    const active = hotspotsBtn.classList.toggle('active');
    hotspotMgr?.setEnabled(active);
  });

  // Exploded View Toggle & Hairline Slider (0% ~ 100%)
  const explodeEl = document.getElementById('ctrl-explode');
  const explodeVal = document.getElementById('val-explode');
  const explodeQuickBtn = document.getElementById('toggle-explode-btn');

  const setExplodeValue = (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    explodeEl.value = clamped;
    explodeVal.textContent = `${Math.round(clamped * 100)}%`;
    paintSliderTrack(explodeEl);
    explodedCtrl?.setTarget(clamped);
    explodeQuickBtn?.classList.toggle('active', clamped > 0.02);
  };
  paintSliderTrack(explodeEl);

  explodeEl.addEventListener('input', () => {
    setExplodeValue(parseFloat(explodeEl.value));
    audio?.playDetentTick();
  });

  explodeQuickBtn?.addEventListener('click', () => {
    const isOpen = parseFloat(explodeEl.value) > 0.05;
    audio?.playArmorPop(!isOpen);
    setExplodeValue(isOpen ? 0 : 0.78);
  });

  // Restore hidden armor pill & Full Reset
  const restoreBtn = document.getElementById('restore-armor-btn');
  restoreBtn?.addEventListener('click', () => onRestoreArmor?.());

  const resetBtn = document.getElementById('reset-all-btn');
  resetBtn?.addEventListener('click', () => {
    audio?.playUiClick();
    setExplodeValue(0);
    setSliceValue(0);
    setActiveCamBtn('front');
    syncSkinUI('ceramic');
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.toggle('active', b.dataset.preset === 'open'));
    document.querySelectorAll('.m-pose-btn').forEach((b) => b.classList.toggle('active', b.dataset.preset === 'open'));
    syncSlidersFromPose({ ...POSE_PRESETS.open, palmClarity: 0.78 });
    onResetAll?.();
  });

  // Precision Hairline Sliders
  const sliderConfigs = [
    { id: 'ctrl-wrist-flex', valId: 'val-wrist-flex', key: 'wristFlex', fmt: (v) => `${Math.round(v)}°` },
    { id: 'ctrl-wrist-tilt', valId: 'val-wrist-tilt', key: 'wristTilt', fmt: (v) => `${Math.round(v)}°` },
    { id: 'ctrl-forearm-rot', valId: 'val-forearm-rot', key: 'forearmRot', fmt: (v) => `${Math.round(v)}°` },
    { id: 'ctrl-spread', valId: 'val-spread', key: 'spread', fmt: (v) => `${Math.round(v * 100)}%` },
    { id: 'ctrl-thumb', valId: 'val-thumb', key: 'thumb', fmt: (v) => `${Math.round(v * 100)}%` },
    { id: 'ctrl-index', valId: 'val-index', key: 'index', fmt: (v) => `${Math.round(v * 100)}%` },
    { id: 'ctrl-middle', valId: 'val-middle', key: 'middle', fmt: (v) => `${Math.round(v * 100)}%` },
    { id: 'ctrl-ring', valId: 'val-ring', key: 'ring', fmt: (v) => `${Math.round(v * 100)}%` },
    { id: 'ctrl-pinky', valId: 'val-pinky', key: 'pinky', fmt: (v) => `${Math.round(v * 100)}%` },
    { id: 'ctrl-palm-xray', valId: 'val-palm-xray', key: 'palmClarity', fmt: (v) => `${Math.round(v * 100)}%` },
  ];

  const syncSingleSlider = (key, value) => {
    const cfg = sliderConfigs.find((c) => c.key === key);
    if (!cfg) return;
    const el = document.getElementById(cfg.id);
    const valEl = document.getElementById(cfg.valId);
    if (el) {
      el.value = value;
      paintSliderTrack(el);
    }
    if (valEl) valEl.textContent = cfg.fmt(value);
  };

  const syncSlidersFromPose = (pose) => {
    for (const cfg of sliderConfigs) {
      if (pose[cfg.key] === undefined) continue;
      syncSingleSlider(cfg.key, pose[cfg.key]);
    }
  };

  for (const cfg of sliderConfigs) {
    const el = document.getElementById(cfg.id);
    const valEl = document.getElementById(cfg.valId);
    if (!el) continue;
    paintSliderTrack(el);
    el.addEventListener('input', () => {
      const num = parseFloat(el.value);
      valEl.textContent = cfg.fmt(num);
      paintSliderTrack(el);
      if (rig.isAnimatedPreset() && cfg.key !== 'palmClarity') {
        rig.activePreset = 'custom';
        rig.onChoreoStep?.(null);
        document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      }
      rig.setParam(cfg.key, num);
      audio?.playDetentTick();
    });
  }

  // Switches & Speed
  const idleChk = document.getElementById('ctrl-idle-motion');
  idleChk?.addEventListener('change', () => {
    audio?.playUiClick();
    rig.idleMotion = idleChk.checked;
  });

  const pulseChk = document.getElementById('ctrl-pulse-motion');
  pulseChk?.addEventListener('change', () => {
    audio?.playUiClick();
    rig.pulseEnabled = pulseChk.checked;
  });

  const speedEl = document.getElementById('ctrl-speed');
  const speedVal = document.getElementById('val-speed');
  if (speedEl) {
    paintSliderTrack(speedEl);
    speedEl.addEventListener('input', () => {
      const v = parseFloat(speedEl.value);
      speedVal.textContent = `${v.toFixed(1)}x`;
      paintSliderTrack(speedEl);
      rig.dampingSpeed = v;
      audio?.playDetentTick();
    });
  }

  // Choreography Stage HUD Pill (Top-Center minimal indicator for `count1to5` & `sign404`)
  const choreoPill = document.getElementById('choreo-pill');
  const choreoLabel = document.getElementById('choreo-label');
  const choreoSteps = document.getElementById('choreo-steps');
  const updateChoreoHUD = (info) => {
    if (!choreoPill || !choreoLabel || !choreoSteps) return;
    if (!info) {
      choreoPill.classList.add('hidden');
      return;
    }
    const isCount = info.steps?.length >= 5;
    choreoPill.classList.toggle('is-compact-count', isCount);
    choreoLabel.textContent = isCount ? '计数' : '404';
    choreoSteps.innerHTML = info.steps
      .map(
        (s, idx) =>
          `<span class="choreo-step ${idx === info.activeIdx ? 'active' : idx < info.activeIdx ? 'done' : ''}">${s}</span>`
      )
      .join('<span class="choreo-dot">·</span>');
    choreoPill.classList.remove('hidden');
  };
  rig.onChoreoStep = updateChoreoHUD;

  // Pose Presets（右侧面板按钮 + 手机顶部快捷动作条双向同步）
  const presetBtns = document.querySelectorAll('.preset-btn');
  const mobilePoseBtns = document.querySelectorAll('.m-pose-btn');
  const triggerPosePreset = (preset) => {
    audio?.playUiClick();
    presetBtns.forEach((b) => b.classList.toggle('active', b.dataset.preset === preset));
    mobilePoseBtns.forEach((b) => b.classList.toggle('active', b.dataset.preset === preset));
    rig.applyPreset(preset);
    syncSlidersFromPose(POSE_PRESETS[preset]);
  };
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => triggerPosePreset(btn.dataset.preset));
  });
  mobilePoseBtns.forEach((btn) => {
    btn.addEventListener('click', () => triggerPosePreset(btn.dataset.preset));
  });

  return {
    syncSingleSlider,
    updateChoreoHUD,
    updateHiddenCount(count) {
      if (!restoreBtn) return;
      restoreBtn.classList.toggle('hidden', count === 0);
      restoreBtn.textContent = `还原装甲 (${count})`;
    },
  };
}
