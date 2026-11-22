/**
 * 精密仿生机械手 Web Audio 高级微声学引擎（零外部音频依赖）：
 * 摒弃廉价蚊蝇蜂鸣式三角波，采用“丝滑磁浮气动微气流 + 极低频纯净正弦谐振 + Apple Taptic 级钛金微阻尼触感音”。
 */
export class BionicAudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;

    // 丝滑气动微气流通道（无蜂鸣、静止完全静音）
    this.airNoise = null;
    this.airFilter = null;
    this.airGain = null;

    // 极低频磁浮纯净正弦共鸣通道（76~102 Hz，无高频锯齿/三角波杂音）
    this.subOsc = null;
    this.subGain = null;
    // 供录屏模块采集实时音效的混音输出节点
    this.recordDest = null;

    this.lastTickTime = 0;

    const unlock = () => {
      this._ensureInit();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  _ensureInit() {
    if (this.ctx) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    try {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.14;
      this.master.connect(this.ctx.destination);
      if (typeof this.ctx.createMediaStreamDestination === 'function') {
        this.recordDest = this.ctx.createMediaStreamDestination();
        this.master.connect(this.recordDest);
      }

      // 1. 生成循环粉红噪声缓冲（柔滑丝绸气动声，绝无高频刺耳嘶声）
      const sr = this.ctx.sampleRate;
      const len = sr * 2;
      const buf = this.ctx.createBuffer(1, len, sr);
      const out = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }

      this.airNoise = this.ctx.createBufferSource();
      this.airNoise.buffer = buf;
      this.airNoise.loop = true;

      this.airFilter = this.ctx.createBiquadFilter();
      this.airFilter.type = 'lowpass';
      this.airFilter.frequency.value = 520;
      this.airFilter.Q.value = 0.65;

      this.airGain = this.ctx.createGain();
      this.airGain.gain.value = 0.0;

      this.airNoise.connect(this.airFilter);
      this.airFilter.connect(this.airGain);
      this.airGain.connect(this.master);
      this.airNoise.start();

      // 2. 极轻柔深沉磁浮纯净正弦共鸣（72~96 Hz，模拟精密无刷直驱电机柔顺推力）
      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'sine';
      this.subOsc.frequency.value = 74;

      this.subGain = this.ctx.createGain();
      this.subGain.gain.value = 0.0;

      this.subOsc.connect(this.subGain);
      this.subGain.connect(this.master);
      this.subOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  setMuted(isMuted) {
    this.muted = isMuted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(isMuted ? 0 : 0.14, this.ctx.currentTime, 0.03);
    }
  }

  /**
   * 获取实时音频流供纯 3D 画布录屏同步混入音效
   */
  getAudioStream() {
    if (!this._ensureInit()) return null;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.recordDest?.stream || null;
  }

  /**
   * Apple Taptic Engine 风格清脆微阻尼点击音（短促纯净、无尖锐电子味）
   */
  playUiClick() {
    if (this.muted || !this._ensureInit()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.018);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.025);
  }

  /**
   * 精密表冠/徕卡对焦环微棘轮滴答声（柔和圆润）
   */
  playDetentTick() {
    if (this.muted || !this._ensureInit()) return;
    const now = performance.now();
    if (now - this.lastTickTime < 55) return;
    this.lastTickTime = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.014);
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.016);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.018);
  }

  /**
   * 装甲磁吸解锁 / 复位轻气动阻尼音
   */
  playArmorPop(isHiding = true) {
    if (this.muted || !this._ensureInit()) return;
    const t = this.ctx.currentTime;

    const bufSize = Math.floor(this.ctx.sampleRate * 0.11);
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.8);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(isHiding ? 1100 : 1600, t);
    filt.frequency.exponentialRampToValueAtTime(420, t + 0.10);

    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.18, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    noise.connect(filt);
    filt.connect(ng);
    ng.connect(this.master);
    noise.start(t);

    const latch = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    latch.type = 'sine';
    latch.frequency.setValueAtTime(isHiding ? 320 : 480, t);
    latch.frequency.exponentialRampToValueAtTime(isHiding ? 160 : 620, t + 0.04);
    lg.gain.setValueAtTime(0.20, t);
    lg.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    latch.connect(lg);
    lg.connect(this.master);
    latch.start(t);
    latch.stop(t + 0.05);
  }

  /**
   * 空间镜头轻盈空气滑行音
   */
  playFlyToSwoosh() {
    if (this.muted || !this._ensureInit()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(175, t);
    osc.frequency.exponentialRampToValueAtTime(98, t + 0.18);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.10, t + 0.045);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.20);
  }

  /**
   * 实时关节运动声学反馈：丝滑低通微气流 + 极轻沉磁浮正弦共鸣（微呼吸时完全静音，绝无蜂鸣杂音！）
   */
  updateServoHum(motionVelocity) {
    if (!this.ctx || !this.airGain || !this.subGain || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const v = Math.min(1.0, Math.max(0.0, motionVelocity));
    // 死区阈值 0.08：微呼吸律动或静止时彻底静音，仅大幅动作时泛起轻柔磁浮气流声
    const active = v > 0.08 ? Math.min(1.0, (v - 0.08) / 0.72) : 0.0;

    const targetAir = this.muted ? 0 : active * 0.22;
    const targetSub = this.muted ? 0 : active * 0.055;

    this.airGain.gain.setTargetAtTime(targetAir, t, 0.06);
    this.airFilter.frequency.setTargetAtTime(420 + active * 760, t, 0.07);

    this.subGain.gain.setTargetAtTime(targetSub, t, 0.06);
    this.subOsc.frequency.setTargetAtTime(72 + active * 28, t, 0.07);
  }
}
