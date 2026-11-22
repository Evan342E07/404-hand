/**
 * 404 BIONIC HAND STUDIO · MediaPipe Hands 实时手势追踪 + AR 实景机械手替换引擎
 * 特性：
 *   - 100% 本地自托管 WASM + hand_landmarker.task（免翻墙、国内直连秒开）
 *   - 手机端默认优先授权后置摄像头（facingMode: environment）并自动开启 AR 实景机械手替换
 *   - 支持一键在「AR 实景替换模式」与「影棚画中画模式」间自由切换，支持一键翻转前/后置镜头
 *   - 基于 3D worldLandmarks 解算五指独立弯曲、张角与手腕旋转，同时按 object-fit: cover 精确反算真手屏幕锚点、缩放与倾斜角，实现 1:1 实景替换！
 */

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

function sub3(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
}

function len3(v) {
  return Math.hypot(v.x, v.y, v.z) || 1e-6;
}

function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function angleBetween(a, b) {
  const cos = Math.max(-1, Math.min(1, dot3(a, b) / (len3(a) * len3(b))));
  return Math.acos(cos);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class CameraHandTracker {
  constructor({ rig, onStateChange, onPoseSync, onArTransform, onArModeChange, isMobile = false }) {
    this.rig = rig;
    this.onStateChange = onStateChange;
    this.onPoseSync = onPoseSync;
    this.onArTransform = onArTransform;
    this.onArModeChange = onArModeChange;
    this.isMobile = isMobile;

    this.landmarker = null;
    this.loadingModel = false;
    this.active = false;
    this.arMode = false;
    this.isMirrored = false;
    this.stream = null;
    this.rafId = null;
    this.lastVideoTime = -1;
    // 手机默认优先后置摄像头（直接进入 AR 实景替换真手！）
    this.facingMode = isMobile ? 'environment' : 'user';

    this.pipEl = document.getElementById('tracker-pip');
    this.videoEl = document.getElementById('tracker-video');
    this.arBgVideoEl = document.getElementById('ar-bg-video');
    this.overlayCanvas = document.getElementById('tracker-canvas');
    this.overlayCtx = this.overlayCanvas?.getContext('2d') || null;
    this.statusTextEl = document.getElementById('tracker-status-text');
    this.arBtnEl = document.getElementById('tracker-ar-btn');

    this.smoothed = {
      thumb: 0.06,
      index: 0.04,
      middle: 0.04,
      ring: 0.05,
      pinky: 0.06,
      spread: 0.14,
      wristFlex: 0,
      wristTilt: 0,
      forearmRot: 0,
    };
    this.arSmooth = { x: 0, y: 0, scale: 1.0, rollZ: 0, visible: false };
    this.hasHand = false;
    this.missedFrames = 0;
  }

  _setStatus(text, detected = false) {
    if (this.statusTextEl) {
      this.statusTextEl.textContent = text;
    }
    this.pipEl?.classList.toggle('hand-locked', detected);
  }

  _syncArUI() {
    this.pipEl?.classList.toggle('is-ar-compact', this.arMode);
    this.arBtnEl?.classList.toggle('active', this.arMode);
    if (this.arBtnEl) {
      this.arBtnEl.textContent = this.arMode ? 'AR 开' : 'AR 实景';
    }
    if (this.arBgVideoEl) {
      this.arBgVideoEl.classList.toggle('hidden', !this.arMode || !this.active);
      this.arBgVideoEl.classList.toggle('is-mirrored', this.isMirrored);
    }
    document.body.classList.toggle('ar-live-mode', this.arMode && this.active);
    this.onArModeChange?.(this.arMode && this.active);
  }

  setArMode(enabled) {
    this.arMode = Boolean(enabled);
    if (this.arMode && this.stream && this.arBgVideoEl) {
      if (this.arBgVideoEl.srcObject !== this.stream) {
        this.arBgVideoEl.srcObject = this.stream;
      }
      this.arBgVideoEl.play?.().catch(() => {});
    }
    this._syncArUI();
    if (!this.arMode) {
      this.onArTransform?.(null);
    }
  }

  toggleArMode() {
    if (!this.active) return;
    this.setArMode(!this.arMode);
  }

  async _ensureLandmarker() {
    if (this.landmarker) return this.landmarker;
    this.loadingModel = true;
    this._setStatus('加载手势引擎中...', false);

    const visionPkg = await import('@mediapipe/tasks-vision');
    const { FilesetResolver, HandLandmarker } = visionPkg;

    const wasmBase = new URL('./mediapipe/wasm', window.location.href).href;
    const modelUrl = new URL('./mediapipe/hand_landmarker.task', window.location.href).href;

    const vision = await FilesetResolver.forVisionTasks(wasmBase);
    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    }

    this.loadingModel = false;
    return this.landmarker;
  }

  async _openCameraStream(facingMode) {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      throw new Error('当前页面需要 HTTPS 或 localhost 环境才能授权摄像头');
    }

    const tryConstraints = [
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      },
      { video: true, audio: false },
    ];

    let lastErr = null;
    for (const c of tryConstraints) {
      try {
        return await navigator.mediaDevices.getUserMedia(c);
      } catch (err) {
        lastErr = err;
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          throw err;
        }
      }
    }
    throw lastErr || new Error('未检测到可用摄像头');
  }

  async start(preferredFacing, forceArMode = null) {
    if (this.active || this.loadingModel) return false;
    if (preferredFacing) this.facingMode = preferredFacing;

    this.pipEl?.classList.remove('hidden');
    this._setStatus('请求摄像头授权...', false);

    try {
      const stream = await this._openCameraStream(this.facingMode);
      this.stream = stream;

      if (this.videoEl) {
        this.videoEl.srcObject = stream;
        this.videoEl.playsInline = true;
        this.videoEl.muted = true;
        await this.videoEl.play();
      }
      if (this.arBgVideoEl) {
        this.arBgVideoEl.srcObject = stream;
        this.arBgVideoEl.playsInline = true;
        this.arBgVideoEl.muted = true;
      }

      const trackSettings = stream.getVideoTracks()[0]?.getSettings?.() || {};
      const actualFacing = trackSettings.facingMode || this.facingMode;
      this.isMirrored = actualFacing !== 'environment';
      this.pipEl?.classList.toggle('is-mirrored', this.isMirrored);

      await this._ensureLandmarker();

      this.active = true;
      this.lastVideoTime = -1;
      this.missedFrames = 0;
      this.hasHand = false;

      // 手机后置摄像头开启时，自动激活 AR 实景机械手替换模式！
      const shouldEnableAr = forceArMode !== null ? forceArMode : actualFacing === 'environment';
      this.setArMode(shouldEnableAr);

      this.rig.activePreset = 'custom';
      this.rig.onChoreoStep?.(null);
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));

      this._setStatus(this.arMode ? 'AR 对准人手即可替换' : '请将手放入镜头中', false);
      this.onStateChange?.({ active: true, facingMode: actualFacing, arMode: this.arMode });

      const loop = () => {
        if (!this.active) return;
        this._processFrame();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
      return true;
    } catch (err) {
      this.stop();
      const msg =
        err?.name === 'NotAllowedError'
          ? '摄像头授权已取消，请允许浏览器访问摄像头后重试'
          : err?.message || '摄像头启动失败';
      this.onStateChange?.({ active: false, error: msg });
      return false;
    }
  }

  async toggleFacingMode() {
    const next = this.facingMode === 'environment' ? 'user' : 'environment';
    const keepAr = this.arMode;
    this.facingMode = next;
    if (!this.active) return;
    this.stop(true);
    await this.start(next, keepAr);
  }

  stop(keepPipVisible = false) {
    this.active = false;
    this.loadingModel = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoEl) this.videoEl.srcObject = null;
    if (this.arBgVideoEl) {
      this.arBgVideoEl.srcObject = null;
      this.arBgVideoEl.classList.add('hidden');
    }
    if (this.overlayCtx && this.overlayCanvas) {
      this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }
    if (!keepPipVisible) {
      this.arMode = false;
      this._syncArUI();
      this.onArTransform?.(null);
      this.pipEl?.classList.add('hidden');
      this.pipEl?.classList.remove('hand-locked');
      this.onStateChange?.({ active: false });
    }
  }

  _processFrame() {
    const video = this.videoEl;
    if (!video || video.readyState < 2 || !this.landmarker) return;
    if (video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;

    const nowMs = performance.now();
    let result = null;
    try {
      result = this.landmarker.detectForVideo(video, nowMs);
    } catch {
      return;
    }

    const landmarks2D = result?.landmarks?.[0] || null;
    const worldLm = result?.worldLandmarks?.[0] || landmarks2D;

    if (!this.arMode) {
      this._drawOverlay(landmarks2D);
    }

    if (!landmarks2D || !worldLm) {
      this.missedFrames++;
      if (this.missedFrames > 14 && this.hasHand) {
        this.hasHand = false;
        this._setStatus(this.arMode ? 'AR 对准人手即可替换' : '请将手放入镜头中', false);
        if (this.arMode) {
          this.arSmooth.visible = false;
          this.onArTransform?.({ ...this.arSmooth, visible: false });
        }
      }
      return;
    }

    this.missedFrames = 0;
    if (!this.hasHand) {
      this.hasHand = true;
      this._setStatus(this.arMode ? 'AR 实景机械手已锁定' : '追踪锁定 · 实时同步', true);
    }

    const pose = this._solvePoseFromLandmarks(worldLm, landmarks2D);
    const alpha = 0.38;
    for (const k of Object.keys(pose)) {
      this.smoothed[k] = lerp(this.smoothed[k], pose[k], alpha);
      // AR 实景模式下平面旋转由整个手臂根节点 rollZ 精准承担，避免与 wristTilt 叠加过度倾斜
      if (this.arMode && k === 'wristTilt') {
        this.rig.setParam(k, 0);
      } else {
        this.rig.setParam(k, this.smoothed[k]);
      }
    }
    this.onPoseSync?.(this.smoothed);

    // 若处于 AR 实景机械手替换模式，同步解算真手在屏幕中的精确坐标、大小与旋转角
    if (this.arMode) {
      const arRaw = this._solveArTransform(landmarks2D, video);
      const arAlpha = this.arSmooth.visible ? 0.34 : 1.0;
      this.arSmooth.x = lerp(this.arSmooth.x, arRaw.x, arAlpha);
      this.arSmooth.y = lerp(this.arSmooth.y, arRaw.y, arAlpha);
      this.arSmooth.scale = lerp(this.arSmooth.scale, arRaw.scale, arAlpha);
      // 最短弧角插值避免 ±π 翻转跳变
      let dRoll = arRaw.rollZ - this.arSmooth.rollZ;
      while (dRoll > Math.PI) dRoll -= Math.PI * 2;
      while (dRoll < -Math.PI) dRoll += Math.PI * 2;
      this.arSmooth.rollZ += dRoll * arAlpha;
      this.arSmooth.visible = true;
      this.onArTransform?.({ ...this.arSmooth });
    }
  }

  /**
   * 精确换算 object-fit: cover 视频流中的 2D 关键点到全屏视口 NDC，并解算 3D 机械手贴合位置与比例
   */
  _solveArTransform(n2d, video) {
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const sw = window.innerWidth || 1280;
    const sh = window.innerHeight || 720;

    // 匹配 CSS object-fit: cover 的缩放裁剪几何
    const scaleCover = Math.max(sw / vw, sh / vh);
    const dispW = vw * scaleCover;
    const dispH = vh * scaleCover;
    const offX = (sw - dispW) * 0.5;
    const offY = (sh - dispH) * 0.5;

    const toScreenPx = (pt) => {
      const nx = this.isMirrored ? 1.0 - pt.x : pt.x;
      return {
        x: offX + nx * dispW,
        y: offY + pt.y * dispH,
      };
    };

    const pWrist = toScreenPx(n2d[0]);
    const pMidMcp = toScreenPx(n2d[9]);
    const dxPx = pMidMcp.x - pWrist.x;
    const dyPx = pMidMcp.y - pWrist.y;
    const palmPx = Math.max(24, Math.hypot(dxPx, dyPx));

    // AR 透视相机固定在 [0, 2.5, 42] 看向 [0, 2.5, 0]，FOV = 34°
    const camDist = 42.0;
    const camCenterY = 2.5;
    const visH = 2.0 * camDist * Math.tan((34 * Math.PI) / 360);
    const visW = visH * (sw / Math.max(1, sh));

    // 机械手模型 Wrist(y=0) → Middle_MCP(y=6.82) 的实测长度
    const palmWorldH = (palmPx / sh) * visH;
    const scale = clamp((palmWorldH / 6.82) * 1.06, 0.38, 2.25);

    const worldX = (pWrist.x / sw - 0.5) * visW;
    const worldY = (0.5 - pWrist.y / sh) * visH + camCenterY;
    const rollZ = -Math.atan2(dxPx, -dyPx);

    return { x: worldX, y: worldY, scale, rollZ };
  }

  /**
   * 21 关键点 3D 骨骼向量 → 机械手 5 指 + 张角 + 腕部姿态实时解算
   */
  _solvePoseFromLandmarks(w, n2d) {
    const fingerCurl = (mcpIdx, pipIdx, dipIdx, tipIdx) => {
      const v0 = sub3(w[mcpIdx], w[0]);
      const v1 = sub3(w[pipIdx], w[mcpIdx]);
      const v2 = sub3(w[dipIdx], w[pipIdx]);
      const v3 = sub3(w[tipIdx], w[dipIdx]);
      const bend = angleBetween(v0, v1) * 0.52 + angleBetween(v1, v2) * 0.96 + angleBetween(v2, v3) * 0.52;
      return clamp((bend - 0.22) / 2.05, 0, 1);
    };

    const index = fingerCurl(5, 6, 7, 8);
    const middle = fingerCurl(9, 10, 11, 12);
    const ring = fingerCurl(13, 14, 15, 16);
    const pinky = fingerCurl(17, 18, 19, 20);

    const palmWidth = Math.max(0.03, len3(sub3(w[5], w[17])));
    const thumbAcross = len3(sub3(w[4], w[17])) / palmWidth;
    const thumbAcrossCurl = clamp((1.62 - thumbAcross) / 0.92, 0, 1);

    const t1 = sub3(w[2], w[1]);
    const t2 = sub3(w[3], w[2]);
    const t3 = sub3(w[4], w[3]);
    const thumbJointCurl = clamp((angleBetween(t1, t2) + angleBetween(t2, t3) - 0.18) / 1.45, 0, 1);
    const thumb = clamp(thumbAcrossCurl * 0.68 + thumbJointCurl * 0.32, 0, 1);

    const dIdx = sub3(w[6], w[5]);
    const dMid = sub3(w[10], w[9]);
    const dRng = sub3(w[14], w[13]);
    const dPnk = sub3(w[18], w[17]);
    const avgGap = (angleBetween(dIdx, dMid) + angleBetween(dMid, dRng) + angleBetween(dRng, dPnk)) / 3;
    const avgCurl = (index + middle + ring + pinky) * 0.25;
    const openSpread = clamp((avgGap - 0.08) / 0.36, 0, 1);
    const spread = lerp(openSpread, -0.26, clamp((avgCurl - 0.55) / 0.4, 0, 1));

    const dx2 = n2d[9].x - n2d[0].x;
    const dy2 = n2d[9].y - n2d[0].y;
    const tiltRad = Math.atan2(dx2, -dy2);
    const wristTilt = clamp(((tiltRad * 180) / Math.PI) * 0.65, -22, 22);

    const palmU = sub3(w[5], w[0]);
    const palmV = sub3(w[17], w[0]);
    const palmN = cross3(palmU, palmV);
    const nLen = len3(palmN);
    const nx = palmN.x / nLen;
    const ny = palmN.y / nLen;
    const forearmRot = clamp(nx * 68, -72, 72);
    const wristFlex = clamp(-ny * 34, -26, 28);

    return { thumb, index, middle, ring, pinky, spread, wristFlex, wristTilt, forearmRot };
  }

  _drawOverlay(landmarks2D) {
    const canvas = this.overlayCanvas;
    const ctx = this.overlayCtx;
    if (!canvas || !ctx) return;

    const w = canvas.clientWidth || 180;
    const h = canvas.clientHeight || 135;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);
    if (!landmarks2D) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(116, 226, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = landmarks2D[a];
      const pb = landmarks2D[b];
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
    }
    ctx.stroke();

    for (let i = 0; i < landmarks2D.length; i++) {
      const p = landmarks2D[i];
      const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, isTip ? 3.8 : 2.3, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? '#ffffff' : '#64d2ff';
      ctx.fill();
    }
    ctx.restore();
  }
}
