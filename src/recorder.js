import { StudioHudMirror } from './hudMirror.js';

/**
 * 404 BIONIC HAND STUDIO · 内置 60 FPS 高清录屏引擎（零第三方依赖）
 * 支持三种录制模式：
 *   1. 纯 3D 画布自录（canvas.captureStream(60) + 实时 Web Audio 音效，隐藏 UI 纯净成片）
 *   2. 完整页面自录（免弹窗 60 FPS 实时合成：3D 画布 + Apple 液态玻璃 UI + 交互光标与点击涟漪 + 实时音效）
 *   3. 一键自动运镜大片（16 秒自动串演全部核心姿态 + 腕背流光特写 + 机械爆炸图并自动保存）
 */
export class StudioVideoRecorder {
  constructor({ canvas, audio, onStateChange, onToast }) {
    this.canvas = canvas;
    this.audio = audio;
    this.onStateChange = onStateChange;
    this.onToast = onToast;

    this.mediaRecorder = null;
    this.hudMirror = null;
    this.activeStreams = [];
    this.chunks = [];
    this.isRecording = false;
    this.mode = null;
    this.startTime = 0;
    this.timerId = null;
    this.demoTimers = [];
    this.fileExt = 'webm';
  }

  _pickSupportedMime() {
    if (typeof MediaRecorder === 'undefined') return { mimeType: '', ext: 'webm' };
    const candidates = [
      { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
      { mimeType: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
      { mimeType: 'video/mp4', ext: 'mp4' },
      { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
      { mimeType: 'video/webm;codecs=vp9', ext: 'webm' },
      { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
      { mimeType: 'video/webm', ext: 'webm' },
    ];
    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
      } catch {
        // 忽略个别浏览器对特定 codec 字符串的异常
      }
    }
    return { mimeType: '', ext: 'webm' };
  }

  _formatTimestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  _formatDuration(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  _clearDemoTimers() {
    for (const id of this.demoTimers) clearTimeout(id);
    this.demoTimers = [];
  }

  _beginRecorder(combinedStream, modeLabel, modeKey) {
    const { mimeType, ext } = this._pickSupportedMime();
    this.fileExt = ext;
    this.chunks = [];
    this.mode = modeKey;

    const opts = { videoBitsPerSecond: 16_000_000 };
    if (mimeType) opts.mimeType = mimeType;

    this.mediaRecorder = new MediaRecorder(combinedStream, opts);
    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
    };

    this.mediaRecorder.onstop = () => {
      this._clearDemoTimers();
      this.hudMirror?.stop();
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      const tracks = [];
      for (const s of this.activeStreams) {
        s.getTracks().forEach((t) => tracks.push(t));
      }
      // 仅停止采集轨道，不销毁持久 WebAudio 节点
      tracks.forEach((t) => {
        if (t.kind === 'video') t.stop();
      });
      this.activeStreams = [];

      const blobType = mimeType || `video/${this.fileExt}`;
      const blob = new Blob(this.chunks, { type: blobType });
      this.chunks = [];
      this.isRecording = false;
      const finishedMode = this.mode;
      this.mode = null;

      this.onStateChange?.({ recording: false, elapsed: '00:00', mode: null });

      if (blob.size > 0) {
        const tag = finishedMode === 'screen' ? 'UI' : finishedMode === 'demo' ? 'AutoDemo' : '3D';
        const filename = `404-BionicHand-${tag}-${this._formatTimestamp()}.${this.fileExt}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    };

    this.isRecording = true;
    this.startTime = performance.now();
    this.mediaRecorder.start(250);
    this.onStateChange?.({ recording: true, elapsed: '00:00', mode: modeKey });

    this.timerId = setInterval(() => {
      if (!this.isRecording) return;
      this.onStateChange?.({
        recording: true,
        elapsed: this._formatDuration(performance.now() - this.startTime),
        mode: this.mode,
      });
    }, 250);
  }

  /**
   * 模式 1：纯 3D 画布 60 FPS 直录（自动混入实时机械音效，零弹窗、可自由操作控制台而画面保持纯净！）
   */
  startCanvasRecording(modeKey = 'canvas', modeLabel = '纯 3D 60FPS 大片') {
    if (this.isRecording) return false;
    if (!this.canvas || typeof this.canvas.captureStream !== 'function') {
      this.onToast?.('当前浏览器不支持 Canvas 录屏，请尝试“完整页面”模式');
      return false;
    }
    try {
      const videoStream = this.canvas.captureStream(60);
      this.activeStreams = [videoStream];
      const combined = new MediaStream([...videoStream.getVideoTracks()]);

      const audioStream = this.audio?.getAudioStream?.();
      if (audioStream) {
        audioStream.getAudioTracks().forEach((t) => combined.addTrack(t));
      }

      this._beginRecorder(combined, modeLabel, modeKey);
      return true;
    } catch (err) {
      console.error('Canvas recording failed:', err);
      this.onToast?.(`录制启动失败：${err.message || '请检查浏览器权限'}`);
      return false;
    }
  }

  /**
   * 模式 2：完整页面自录（含 UI 交互 + 实时光标与点击波纹 + 机械音效）
   * 采用 60 FPS 实时离屏合成引擎，无需系统共享弹窗，在内置浏览器与所有桌面浏览器中 100% 即点即录！
   */
  async startScreenRecording() {
    if (this.isRecording) return false;
    try {
      if (!this.hudMirror) {
        this.hudMirror = new StudioHudMirror(this.canvas);
      }
      const compositeCanvas = this.hudMirror.start();
      if (typeof compositeCanvas.captureStream !== 'function') {
        this.hudMirror.stop();
        this.onToast?.('当前浏览器不支持 Canvas 录屏，请更换新版 Chrome / Edge');
        return false;
      }

      const videoStream = compositeCanvas.captureStream(60);
      this.activeStreams = [videoStream];
      const combined = new MediaStream([...videoStream.getVideoTracks()]);

      const audioStream = this.audio?.getAudioStream?.();
      if (audioStream) {
        audioStream.getAudioTracks().forEach((t) => combined.addTrack(t));
      }

      this._beginRecorder(combined, '完整页面（含 UI 与交互光标）', 'screen');
      return true;
    } catch (err) {
      this.hudMirror?.stop();
      console.error('Composite UI recording failed:', err);
      this.onToast?.(`页面录屏启动失败：${err?.message || '请重试'}`);
      return false;
    }
  }

  /**
   * 模式 3：一键 16 秒电影级自动演示大片（纯 3D 60FPS + 自动切视角、演完核心手势、腕背流光环与爆炸图并自动保存）
   */
  startAutoDemoRecording({ setView, setPreset, setExplode, setHotspots }) {
    if (this.isRecording) return false;
    const ok = this.startCanvasRecording('demo', '16 秒一键自动大片');
    if (!ok) return false;

    setHotspots?.(false);
    setExplode?.(0);
    setView?.('front');
    setPreset?.('open');

    const timeline = [
      [1400, () => { setView?.('threeQuarter'); setPreset?.('pinch'); }],
      [3800, () => { setPreset?.('fist'); }],
      [6200, () => { setView?.('front'); setPreset?.('sign404'); }],
      [10400, () => { setPreset?.('open'); setView?.('back'); }],
      [12600, () => { setView?.('threeQuarter'); setExplode?.(1.0); }],
      [15200, () => { setExplode?.(0.0); }],
      [16400, () => { if (this.isRecording) this.stop(); }],
    ];

    this.demoTimers = timeline.map(([delay, fn]) =>
      setTimeout(() => {
        if (this.isRecording) fn();
      }, delay)
    );
    return true;
  }

  stop() {
    this._clearDemoTimers();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // 忽略已停止状态
      }
    }
  }
}
