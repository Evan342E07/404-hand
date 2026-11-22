import * as THREE from 'three/webgpu';

export const POSE_PRESETS = {
  open: {
    wristFlex: 0,
    wristTilt: 0,
    forearmRot: 0,
    spread: 0.14,
    thumb: 0.06,
    index: 0.04,
    middle: 0.04,
    ring: 0.05,
    pinky: 0.06,
  },
  relax: {
    wristFlex: 6,
    wristTilt: -3,
    forearmRot: 8,
    spread: 0.08,
    thumb: 0.24,
    index: 0.22,
    middle: 0.30,
    ring: 0.38,
    pinky: 0.44,
  },
  pinch: {
    wristFlex: 8,
    wristTilt: -4,
    forearmRot: -16,
    spread: 0.06,
    thumb: 0.68,
    index: 0.72,
    middle: 0.14,
    ring: 0.18,
    pinky: 0.24,
  },
  fist: {
    wristFlex: -6,
    wristTilt: 0,
    forearmRot: 0,
    spread: -0.34,
    thumb: 0.94,
    index: 0.96,
    middle: 0.96,
    ring: 0.98,
    pinky: 0.98,
  },
  point: {
    wristFlex: 4,
    wristTilt: 2,
    forearmRot: -10,
    spread: 0.06,
    thumb: 0.92,
    index: 0.02,
    middle: 0.96,
    ring: 0.96,
    pinky: 0.96,
  },
  wave: {
    wristFlex: 0,
    wristTilt: 0,
    forearmRot: 0,
    spread: 0.28,
    thumb: 0.14,
    index: 0.20,
    middle: 0.20,
    ring: 0.20,
    pinky: 0.20,
  },
  count1to5: {
    wristFlex: 2,
    wristTilt: 0,
    forearmRot: 0,
    spread: 0.24,
    thumb: 0.92,
    index: 0.0,
    middle: 0.96,
    ring: 0.96,
    pinky: 0.96,
  },
  sign404: {
    wristFlex: 4,
    wristTilt: -4,
    forearmRot: -10,
    spread: 0.36,
    thumb: 0.92,
    index: 0.0,
    middle: 0.0,
    ring: 0.0,
    pinky: 0.0,
  },
};

const ANIMATED_PRESETS = new Set(['wave', 'count1to5', 'sign404']);
// 大拇指收在掌心内侧时，仅食指与中指位于大拇指正外侧包覆区
const THUMB_COVER_FINGERS = ['index', 'middle'];

/**
 * 评估精编手部动作关键帧（`count1to5` 与 `sign404`）：
 * 统一采用“大拇指平贴掌心内侧、四指从外侧包覆与独立伸屈”的逻辑，动作干脆零穿模、大拇指零多余晃动。
 */
function evaluateChoreography(preset, seqTime) {
  if (preset === 'count1to5') {
    const cycle = 5.65;
    const t = seqTime % cycle;
    // Stage 0 (0.00..0.55s): 蓄力握拳预备（大拇指在内，四指包在外）
    if (t < 0.55) {
      return {
        stepId: 'c0',
        label: '逐指计数 · 1 → 5',
        steps: ['1', '2', '3', '4', '5'],
        activeIdx: -1,
        pose: {
          wristFlex: -6, wristTilt: 0, forearmRot: -5,
          spread: -0.08, thumb: 0.94, index: 0.96, middle: 0.96, ring: 0.98, pinky: 0.98,
        },
        zeroRing: 0,
      };
    }
    // Stage 1 (0.55..1.35s): 数字 1（大拇指稳贴掌心内侧，食指直接从外侧立起）
    if (t < 1.35) {
      const p = (t - 0.55) / 0.80;
      const nod = Math.sin(Math.min(1, p * 2.2) * Math.PI) * 3.8;
      return {
        stepId: 'c1',
        label: '逐指计数 · 1 → 5',
        steps: ['1', '2', '3', '4', '5'],
        activeIdx: 0,
        pose: {
          wristFlex: 3 + nod, wristTilt: 2, forearmRot: -9,
          spread: 0.08, thumb: 0.92, index: 0.0, middle: 0.96, ring: 0.98, pinky: 0.98,
        },
        zeroRing: 0,
      };
    }
    // Stage 2 (1.35..2.15s): 数字 2
    if (t < 2.15) {
      const p = (t - 1.35) / 0.80;
      const nod = Math.sin(Math.min(1, p * 2.2) * Math.PI) * 3.2;
      return {
        stepId: 'c2',
        label: '逐指计数 · 1 → 5',
        steps: ['1', '2', '3', '4', '5'],
        activeIdx: 1,
        pose: {
          wristFlex: 2 + nod, wristTilt: -2, forearmRot: -4,
          spread: 0.36, thumb: 0.92, index: 0.0, middle: 0.0, ring: 0.98, pinky: 0.98,
        },
        zeroRing: 0,
      };
    }
    // Stage 3 (2.15..2.95s): 数字 3
    if (t < 2.95) {
      const p = (t - 2.15) / 0.80;
      const nod = Math.sin(Math.min(1, p * 2.2) * Math.PI) * 3.2;
      return {
        stepId: 'c3',
        label: '逐指计数 · 1 → 5',
        steps: ['1', '2', '3', '4', '5'],
        activeIdx: 2,
        pose: {
          wristFlex: 3 + nod, wristTilt: 2, forearmRot: 2,
          spread: 0.38, thumb: 0.92, index: 0.0, middle: 0.0, ring: 0.0, pinky: 0.98,
        },
        zeroRing: 0,
      };
    }
    // Stage 4 (2.95..3.75s): 数字 4（四指全部立起，大拇指仍平贴掌心内侧）
    if (t < 3.75) {
      const p = (t - 2.95) / 0.80;
      const nod = Math.sin(Math.min(1, p * 2.2) * Math.PI) * 3.2;
      return {
        stepId: 'c4',
        label: '逐指计数 · 1 → 5',
        steps: ['1', '2', '3', '4', '5'],
        activeIdx: 3,
        pose: {
          wristFlex: 2 + nod, wristTilt: -2, forearmRot: 6,
          spread: 0.34, thumb: 0.92, index: 0.0, middle: 0.0, ring: 0.0, pinky: 0.0,
        },
        zeroRing: 0,
      };
    }
    // Stage 5 (3.75..4.95s): 数字 5（大拇指从掌心优雅展开成五指全开！）
    if (t < 4.95) {
      const p = (t - 3.75) / 1.20;
      const flourish = Math.sin(Math.min(1, p * 1.8) * Math.PI) * 4.2;
      return {
        stepId: 'c5',
        label: '逐指计数 · 1 → 5',
        steps: ['1', '2', '3', '4', '5'],
        activeIdx: 4,
        pose: {
          wristFlex: 4 + flourish, wristTilt: 0, forearmRot: 0,
          spread: 0.56, thumb: 0.0, index: 0.0, middle: 0.0, ring: 0.0, pinky: 0.0,
        },
        zeroRing: 0,
      };
    }
    // Stage 6 (4.95..5.65s): 大拇指先平贴收进掌心，随后四指依次从外侧卷拢复位！
    const cp = (t - 4.95) / 0.70;
    return {
      stepId: 'c_close',
      label: '逐指计数 · 1 → 5',
      steps: ['1', '2', '3', '4', '5'],
      activeIdx: 4,
      pose: {
        wristFlex: -4, wristTilt: 0, forearmRot: -4,
        spread: -0.06,
        thumb: Math.min(0.94, cp * 2.8),
        pinky: Math.min(0.98, Math.max(0, cp - 0.16) * 2.5),
        ring: Math.min(0.98, Math.max(0, cp - 0.24) * 2.5),
        middle: Math.min(0.96, Math.max(0, cp - 0.32) * 2.5),
        index: Math.min(0.96, Math.max(0, cp - 0.40) * 2.5),
      },
      zeroRing: 0,
    };
  }

  if (preset === 'sign404') {
    const cycle = 4.45;
    const t = seqTime % cycle;
    // Beat 1 (0.00..1.05s): 第一个 "4"（大拇指平贴掌心内侧，四指笔直张开）
    if (t < 1.05) {
      const p = t / 1.05;
      const nod = Math.sin(Math.min(1, p * 2.2) * Math.PI) * 3.8;
      return {
        stepId: 's4a',
        label: '404 铭印 · SIGNAL',
        steps: ['4', 'Ø', '4'],
        activeIdx: 0,
        pose: {
          wristFlex: 3 + nod, wristTilt: -4, forearmRot: -14,
          spread: 0.38, thumb: 0.92, index: 0.0, middle: 0.0, ring: 0.0, pinky: 0.0,
        },
        zeroRing: 0,
      };
    }
    // Beat 2 (1.05..2.50s): 大圆润闭合 "0"（对照真实手部照片标定：前臂 -82°、微展腕、四指高拱与大拇指指尖远端轻吻成大圆环！）
    if (t < 2.50) {
      const p = (t - 1.05) / 1.45;
      const breath = Math.sin(p * Math.PI) * 1.4;
      return {
        stepId: 's0',
        label: '404 铭印 · SIGNAL',
        steps: ['4', 'Ø', '4'],
        activeIdx: 1,
        pose: {
          wristFlex: -6 + breath, wristTilt: -2, forearmRot: -82,
          spread: -0.22, thumb: 0.44, index: 0.50, middle: 0.52, ring: 0.50, pinky: 0.46,
        },
        zeroRing: 1.0,
      };
    }
    // Beat 3 (2.50..3.75s): 第二个 "4"
    if (t < 3.75) {
      const p = (t - 2.50) / 1.25;
      const snap = Math.sin(Math.min(1, p * 2.5) * Math.PI) * 4.0;
      const openIdx = p < 0.05 ? 0.32 : 0.0;
      const openMid = p < 0.09 ? 0.36 : 0.0;
      const openRng = p < 0.13 ? 0.40 : 0.0;
      const openPnk = p < 0.17 ? 0.44 : 0.0;
      return {
        stepId: 's4b',
        label: '404 铭印 · SIGNAL',
        steps: ['4', 'Ø', '4'],
        activeIdx: 2,
        pose: {
          wristFlex: 4 + snap, wristTilt: 4, forearmRot: 12,
          spread: 0.40, thumb: 0.92, index: openIdx, middle: openMid, ring: openRng, pinky: openPnk,
        },
        zeroRing: 0,
      };
    }
    // Beat 4 (3.75..4.45s): 轻盈呼吸衔接回正
    return {
      stepId: 's_rest',
      label: '404 铭印 · SIGNAL',
      steps: ['4', 'Ø', '4'],
      activeIdx: 2,
      pose: {
        wristFlex: -2, wristTilt: 0, forearmRot: 0,
        spread: 0.14, thumb: 0.24, index: 0.22, middle: 0.26, ring: 0.30, pinky: 0.34,
      },
      zeroRing: 0,
    };
  }

  return null;
}

const KNOWN_JOINTS = new Set([
  'Forearm',
  'Wrist',
  'Palm',
  'Thumb_CMC',
  'Thumb_MCP',
  'Thumb_IP',
  'Index_MCP',
  'Index_PIP',
  'Index_DIP',
  'Middle_MCP',
  'Middle_PIP',
  'Middle_DIP',
  'Ring_MCP',
  'Ring_PIP',
  'Ring_DIP',
  'Pinky_MCP',
  'Pinky_PIP',
  'Pinky_DIP',
]);

export class HandKinematicRig {
  constructor({ audio }) {
    this.audio = audio;
    this.rootObj = null;
    this.bones = {};
    this.restRotations = new Map();
    this.gears = [];
    this.pistons = [];
    this.palmGlassMeshes = [];
    this.neuralUniforms = null;

    this.activePreset = 'open';
    this.idleMotion = true;
    this.pulseEnabled = true;
    this.dampingSpeed = 1.0;

    this.target = { ...POSE_PRESETS.open, palmClarity: 0.78 };
    this.current = { ...this.target };
    this.velocity = {};
    for (const k of Object.keys(this.target)) this.velocity[k] = 0;

    this.phalanxLag = {};
    for (const prefix of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) {
      this.phalanxLag[prefix] = { mid: 0.04, dist: 0.04 };
    }

    this.seqTime = 0;
    this.zeroRingWeight = 0;
    this.pinchWeight = 0;
    // 滞回锁存标志：仅在“大拇指在内”的两个双向穿越边界启用，绝对无临界颤抖
    this.waitThumbTuckFirst = false;
    this.waitFingersOpenForThumb = false;
    this.lastChoreoStepId = null;
    this.onChoreoStep = null;

    this.motionEnergy = 0;
    this.gripTension = 0;
  }

  attachModel(rootObj, matRefs) {
    this.rootObj = rootObj;
    this.bones = {};
    this.restRotations.clear();
    this.gears = [];
    this.pistons = [];
    this.palmGlassMeshes = [];
    this.neuralUniforms = matRefs?.sharedUniforms || null;

    rootObj.traverse((node) => {
      if (node.isBone || KNOWN_JOINTS.has(node.name)) {
        this.bones[node.name] = node;
        this.restRotations.set(node.name, node.rotation.clone());
      }
      if (node.isMesh) {
        if (node.name === 'Glass_Palm_Shield' && node.material?.isMeshPhysicalMaterial) {
          this.palmGlassMeshes.push(node);
        }
        if (node.name.startsWith('Gear_') && !node.name.includes('_Drum')) {
          this.gears.push({ mesh: node, restRot: node.rotation.clone(), dir: this.gears.length % 2 === 0 ? 1 : -1 });
        }
        if (node.name.startsWith('Piston_')) {
          this.pistons.push({ mesh: node, restPos: node.position.clone() });
        }
      }
    });
  }

  applyPreset(name) {
    if (!POSE_PRESETS[name]) return;
    this.activePreset = name;
    this.seqTime = 0;
    this.lastChoreoStepId = null;
    Object.assign(this.target, POSE_PRESETS[name]);
    if (!ANIMATED_PRESETS.has(name) || name === 'wave') {
      this.onChoreoStep?.(null);
    }
  }

  isAnimatedPreset() {
    return ANIMATED_PRESETS.has(this.activePreset);
  }

  setParam(key, value) {
    this.target[key] = value;
  }

  /**
   * “大拇指统一收在掌心内侧”防穿模滞回时序门控（数学零颤抖）：
   * 1. 收拢握拳时（大拇指要收进掌心 >0.65，且食/中指也要卷曲 >0.62）：
   *    先让大拇指平贴收进掌心（>=0.72），食/中指在外侧稍候，等大拇指收好后再从外侧包覆卷拢；
   * 2. 从握拳张开大拇指时（大拇指要离开掌心 <0.50，但当前食/中指正包在外面 >0.48）：
   *    先让外侧的食/中指张开让道（<0.36），大拇指稳稳停在掌心内侧等待，待通道清空后再丝滑张开；
   * 3. 握拳 -> 食指点触 / 逐指计数 1·2·3·4：大拇指始终稳贴掌心内侧，外侧四指自由伸屈，零干涉零抖动！
   */
  _applyAntiCollisionGate(rawDesired) {
    const gated = { ...rawDesired };
    const cur = this.current;

    const coverWantsClose = THUMB_COVER_FINGERS.some((f) => gated[f] > 0.62);
    const coverCurrentlyClosed = THUMB_COVER_FINGERS.some((f) => cur[f] > (this.waitFingersOpenForThumb ? 0.36 : 0.48));

    // 状态 A：大拇指要往掌心内收，且食/中指也要往外侧包覆 -> 大拇指先收进掌心！
    if (!this.waitThumbTuckFirst) {
      if (gated.thumb > 0.65 && coverWantsClose && cur.thumb < 0.70) {
        this.waitThumbTuckFirst = true;
      }
    } else if (gated.thumb <= 0.65 || !coverWantsClose || cur.thumb >= 0.76) {
      this.waitThumbTuckFirst = false;
    }

    // 状态 B：大拇指当前被包在里面（>0.55）且目标要张开（<0.55），但食/中指仍压在外面 -> 外侧手指先张开！
    if (!this.waitFingersOpenForThumb) {
      if (cur.thumb > 0.55 && gated.thumb < 0.55 && coverCurrentlyClosed) {
        this.waitFingersOpenForThumb = true;
      }
    } else if (gated.thumb >= 0.55 || !coverCurrentlyClosed) {
      this.waitFingersOpenForThumb = false;
    }

    if (this.waitThumbTuckFirst) {
      for (const f of THUMB_COVER_FINGERS) {
        if (gated[f] > 0.62) {
          gated[f] = Math.min(gated[f], Math.max(cur[f], 0.34));
          // 若食/中指当前本来就低于 0.34，则保持在 <=0.34 等待大拇指先收进掌心
          if (cur[f] < 0.38) gated[f] = Math.min(gated[f], 0.32);
        }
      }
    }

    if (this.waitFingersOpenForThumb) {
      // 外侧包覆指未张开前，大拇指稳稳留在掌心内侧，纹丝不动
      gated.thumb = Math.max(gated.thumb, 0.88);
    }

    return gated;
  }

  update(dt, elapsed) {
    const safeDt = Math.min(dt, 0.04);
    const omega = 10.5 * Math.pow(this.dampingSpeed, 0.72);

    let waveMod = null;
    let targetZeroRing = 0.0;
    const targetPinch = this.activePreset === 'pinch' ? 1.0 : 0.0;

    if (this.activePreset === 'wave') {
      this.seqTime += safeDt * this.dampingSpeed;
      const w = this.seqTime * 2.85;
      waveMod = {
        thumb: 0.14 + 0.24 * (0.5 + 0.5 * Math.sin(w + 0.3)),
        index: 0.52 * (0.5 + 0.5 * Math.sin(w - 0.45)),
        middle: 0.52 * (0.5 + 0.5 * Math.sin(w - 1.05)),
        ring: 0.52 * (0.5 + 0.5 * Math.sin(w - 1.65)),
        pinky: 0.52 * (0.5 + 0.5 * Math.sin(w - 2.25)),
        wristFlex: Math.sin(w * 0.5) * 9,
        wristTilt: Math.cos(w * 0.5) * 5,
      };
    } else if (this.activePreset === 'count1to5' || this.activePreset === 'sign404') {
      this.seqTime += safeDt * this.dampingSpeed;
      const choreo = evaluateChoreography(this.activePreset, this.seqTime);
      if (choreo) {
        waveMod = choreo.pose;
        targetZeroRing = choreo.zeroRing || 0;
        if (choreo.stepId !== this.lastChoreoStepId) {
          this.lastChoreoStepId = choreo.stepId;
          this.onChoreoStep?.({
            preset: this.activePreset,
            label: choreo.label,
            steps: choreo.steps,
            activeIdx: choreo.activeIdx,
          });
          if (choreo.activeIdx >= 0) this.audio?.playDetentTick();
        }
      }
    }

    const rawDesired = {};
    for (const k of Object.keys(this.current)) {
      rawDesired[k] = waveMod && waveMod[k] !== undefined ? waveMod[k] : this.target[k];
    }
    const desiredMap = this.activePreset === 'custom' ? rawDesired : this._applyAntiCollisionGate(rawDesired);

    const safeForPinch = targetPinch > 0.5 && !this.waitFingersOpenForThumb && this.current.middle < 0.45 ? 1.0 : 0.0;
    const blendRate = 1 - Math.exp(-safeDt * 9.5 * Math.pow(this.dampingSpeed, 0.65));
    this.zeroRingWeight += (targetZeroRing - this.zeroRingWeight) * blendRate;
    this.pinchWeight += (safeForPinch - this.pinchWeight) * blendRate;

    let deltaSum = 0;
    const expDecay = Math.exp(-omega * safeDt);
    for (const k of Object.keys(this.current)) {
      const desired = desiredMap[k];
      const prev = this.current[k];
      if (k === 'palmClarity') {
        const a = 1 - Math.exp(-safeDt * 10.0);
        this.current[k] += (desired - prev) * a;
      } else {
        const x = prev - desired;
        const v = this.velocity[k] || 0;
        const temp = (v + omega * x) * safeDt;
        const nextVal = desired + (x + temp) * expDecay;
        const nextV = (v - omega * temp) * expDecay;
        this.velocity[k] = nextV;
        this.current[k] = nextVal;
        const scale = k.includes('wrist') || k.includes('forearm') ? 0.025 : 1.0;
        deltaSum += Math.abs(nextVal - prev) * scale;
      }
    }

    const instVelocity = Math.min(1.5, (deltaSum / Math.max(safeDt, 0.008)) * 0.45);
    this.motionEnergy += (instVelocity - this.motionEnergy) * (1 - Math.exp(-safeDt * 6.0));
    this.audio?.updateServoHum(this.motionEnergy);

    if (!this.rootObj) return;

    const breatheBase = this.idleMotion ? Math.sin(elapsed * 1.65) * 0.012 : 0;
    const microWrist = this.idleMotion ? Math.sin(elapsed * 1.1) * 0.012 : 0;
    const microTilt = this.idleMotion ? Math.cos(elapsed * 0.85) * 0.009 : 0;

    const setJointOffset = (name, rx = 0, ry = 0, rz = 0) => {
      const node = this.bones[name];
      if (!node) return;
      const rest = this.restRotations.get(name);
      node.rotation.set(rest.x + rx, rest.y + ry, rest.z + rz);
    };

    // 1. 前臂旋前与手腕俯仰/侧摆
    this.rootObj.rotation.y = THREE.MathUtils.degToRad(this.current.forearmRot);
    const wristFlexRad = THREE.MathUtils.degToRad(this.current.wristFlex) + microWrist;
    const wristTiltRad = THREE.MathUtils.degToRad(this.current.wristTilt) + microTilt;
    setJointOffset('Wrist', wristFlexRad, 0, wristTiltRad);

    // 2. 四指紧实握拳外包覆运动学（MCP 压低成厚重拳峰、PIP 垂直下扣、DIP 适度微收）：
    //    - 食/中指（1.32/1.28/0.36）：拳峰紧凑、指尖下探至 Y=3.7 完整包裹内侧大拇指（Z=2.74~3.22 > 大拇指 Z=2.13~2.50），绝不呈半张爪状！
    //    - 无名指/小指（1.38/1.36/0.44）：紧实贴合尺侧掌面而不扎入掌骨！
    const splayMap = { Index: -0.18, Middle: -0.02, Ring: 0.14, Pinky: 0.28 };
    const phaseOffsets = { Index: 0.0, Middle: 0.35, Ring: 0.70, Pinky: 1.05 };
    const convergeYawMap = { Index: -0.08, Middle: 0.01, Ring: 0.14, Pinky: 0.32 };
    const convergeRollMap = { Index: 0.05, Middle: 0.0, Ring: -0.08, Pinky: -0.16 };
    const maxMcpMap = { Index: 1.30, Middle: 1.32, Ring: 1.36, Pinky: 1.34 };
    const maxPipMap = { Index: 1.40, Middle: 1.42, Ring: 1.44, Pinky: 1.40 };
    const maxDipMap = { Index: 0.46, Middle: 0.48, Ring: 0.52, Pinky: 0.52 };
    // 404 铭印 "0" 逐指精准标定（对照实拍图大圆润中空 O 环：圆孔 3.6×3.8cm，四指指尖齐平轻触大拇指尖 (1.83, 6.71, 3.78)！）
    const zeroRingPoseMap = {
      Index:  { mcp: 0.50, pip: 1.12, dip: 0.72, yaw: 0.06, roll: -0.03 },
      Middle: { mcp: 0.47, pip: 1.25, dip: 0.85, yaw: 0.00, roll:  0.00 },
      Ring:   { mcp: 0.50, pip: 1.02, dip: 0.72, yaw: 0.06, roll: -0.04 },
      Pinky:  { mcp: 0.62, pip: 0.58, dip: 0.42, yaw: 0.12, roll: -0.08 },
    };
    const keyMap = { Index: 'index', Middle: 'middle', Ring: 'ring', Pinky: 'pinky' };

    const zW = this.zeroRingWeight;
    const pW = this.pinchWeight;
    const lagAlphaMid = 1 - Math.exp(-safeDt * 18.5 * this.dampingSpeed);
    const lagAlphaDist = 1 - Math.exp(-safeDt * 13.0 * this.dampingSpeed);
    let gripTension = 0;

    for (const prefix of ['Index', 'Middle', 'Ring', 'Pinky']) {
      const digitBreathe = this.idleMotion ? Math.sin(elapsed * 1.65 - phaseOffsets[prefix]) * 0.012 : 0;
      const flexMcp = THREE.MathUtils.clamp(this.current[keyMap[prefix]] + digitBreathe, -0.04, 1.02);
      const lag = this.phalanxLag[prefix];
      lag.mid += (flexMcp - lag.mid) * lagAlphaMid;
      lag.dist += (lag.mid - lag.dist) * lagAlphaDist;

      gripTension += Math.max(0, flexMcp);
      const splay = splayMap[prefix] * (this.current.spread - 0.14) * 1.05;
      const convT = Math.max(0, (flexMcp - 0.18) / 0.82);
      const yawIn = convT * convergeYawMap[prefix];
      const rollIn = convT * convergeRollMap[prefix];

      let rxMcp = flexMcp * maxMcpMap[prefix];
      let ryMcp = yawIn;
      let rzMcp = splay + rollIn;
      let rxPip = lag.mid * maxPipMap[prefix];
      let rxDip = lag.dist * maxDipMap[prefix];

      // 精密捏取几何标定：食指高拱起成优雅 O 型环，指尖精准轻扣在大拇指指腹正上方
      if (prefix === 'Index' && pW > 0.001) {
        rxMcp = THREE.MathUtils.lerp(rxMcp, 0.525, pW);
        ryMcp = THREE.MathUtils.lerp(ryMcp, 0.14, pW);
        rzMcp = THREE.MathUtils.lerp(rzMcp, -0.07, pW);
        rxPip = THREE.MathUtils.lerp(rxPip, 1.125, pW);
        rxDip = THREE.MathUtils.lerp(rxDip, 0.60, pW);
      }

      // 404 铭印闭合中空 "0" 环（四指按指长独立收敛到同一指尖切点，彻底消除错位与爪感！）
      if (zW > 0.001) {
        const zp = zeroRingPoseMap[prefix];
        rxMcp = THREE.MathUtils.lerp(rxMcp, zp.mcp, zW);
        ryMcp = THREE.MathUtils.lerp(ryMcp, zp.yaw, zW);
        rzMcp = THREE.MathUtils.lerp(rzMcp, zp.roll, zW);
        rxPip = THREE.MathUtils.lerp(rxPip, zp.pip, zW);
        rxDip = THREE.MathUtils.lerp(rxDip, zp.dip, zW);
      }

      setJointOffset(`${prefix}_MCP`, rxMcp, ryMcp, rzMcp);
      setJointOffset(`${prefix}_PIP`, rxPip, 0, 0);
      setJointOffset(`${prefix}_DIP`, rxDip, 0, 0);
    }

    // 3. 紧凑低位贴掌大拇指运动学（稳卧掌心低洼处 Y=4.19~4.45, Z=2.13~2.50，被外侧紧实四指自然包裹！）
    const thumbFlex = THREE.MathUtils.clamp(this.current.thumb + breatheBase * 0.55, -0.04, 1.02);
    const tLag = this.phalanxLag.Thumb;
    tLag.mid += (thumbFlex - tLag.mid) * lagAlphaMid;
    tLag.dist += (tLag.mid - tLag.dist) * lagAlphaDist;

    gripTension = (gripTension + Math.max(0, thumbFlex)) / 5.0;
    this.gripTension = gripTension;

    let tCmcRx = thumbFlex * 1.30;
    let tCmcRy = -thumbFlex * 0.30;
    let tCmcRz = thumbFlex * 0.60 - (this.current.spread - 0.14) * 0.14;
    let tMcpRx = tLag.mid * 0.14;
    let tMcpRz = tLag.mid * 0.65;
    let tIpRx = tLag.dist * 0.16;
    let tIpRz = tLag.dist * 0.65;

    if (pW > 0.001) {
      tCmcRx = THREE.MathUtils.lerp(tCmcRx, 0.52, pW);
      tCmcRy = THREE.MathUtils.lerp(tCmcRy, -0.34, pW);
      tCmcRz = THREE.MathUtils.lerp(tCmcRz, 0.12, pW);
      tMcpRx = THREE.MathUtils.lerp(tMcpRx, 0.14, pW);
      tMcpRz = THREE.MathUtils.lerp(tMcpRz, 0.14, pW);
      tIpRx = THREE.MathUtils.lerp(tIpRx, 0.18, pW);
      tIpRz = THREE.MathUtils.lerp(tIpRz, 0.16, pW);
    }

    if (zW > 0.001) {
      // 404 铭印大圆润 "0" 下半圆大拇指弧线：虎口大张、指尖优雅前伸上挑至 (1.83, 6.71, 3.78) 与食指指尖 3D 精准轻吻！
      tCmcRx = THREE.MathUtils.lerp(tCmcRx, 0.55, zW);
      tCmcRy = THREE.MathUtils.lerp(tCmcRy, -0.75, zW);
      tCmcRz = THREE.MathUtils.lerp(tCmcRz, 0.20, zW);
      tMcpRx = THREE.MathUtils.lerp(tMcpRx, 0.16, zW);
      tMcpRz = THREE.MathUtils.lerp(tMcpRz, 0.06, zW);
      tIpRx = THREE.MathUtils.lerp(tIpRx, 0.20, zW);
      tIpRz = THREE.MathUtils.lerp(tIpRz, 0.08, zW);
    }

    setJointOffset('Thumb_CMC', tCmcRx, tCmcRy, tCmcRz);
    setJointOffset('Thumb_MCP', tMcpRx, 0, tMcpRz);
    setJointOffset('Thumb_IP', tIpRx, 0, tIpRz);

    // 4. 腕部联动机械次级运动
    const gearAngle = gripTension * 2.8 + wristFlexRad * 2.2 + elapsed * (this.idleMotion ? 0.16 : 0);
    for (const g of this.gears) {
      g.mesh.rotation.z = g.restRot.z + gearAngle * g.dir;
    }
    for (const p of this.pistons) {
      const slide = wristFlexRad * 0.32 + gripTension * 0.08;
      p.mesh.position.y = p.restPos.y + slide;
    }

    // 5. 掌心光学罩通透度
    const clarity = this.current.palmClarity;
    if (this.neuralUniforms?.uGlassTransmission && this.neuralUniforms?.uGlassRoughness) {
      this.neuralUniforms.uGlassTransmission.value = THREE.MathUtils.lerp(0.56, 0.95, clarity);
      this.neuralUniforms.uGlassRoughness.value = THREE.MathUtils.lerp(0.36, 0.08, clarity);
    }

    // 6. 生物电脉络与腕背流光环动态速率
    const boost = Math.min(1.6, gripTension * 0.85 + this.motionEnergy * 1.2);
    this.pulseBoost = boost;
    if (this.neuralUniforms) {
      const speedMult = 1.0 + boost * 1.75;
      this.neuralUniforms.uTime.value += safeDt * speedMult;
      this.neuralUniforms.uPulseBoost.value = boost;
      this.neuralUniforms.uPulseEnabled.value = this.pulseEnabled ? 1.0 : 0.0;
    }
  }
}
