/**
 * 404 BIONIC HAND STUDIO · 实时 Apple 液态玻璃 HUD 镜像合成渲染器
 * 将 WebGPU 3D 画布与当前全部可见 HTML/CSS 交互界面、3D 结构探针、动作胶囊、
 * 右侧控制台、底部操作栏以及实时鼠标光标与点击涟漪以 60 FPS 无损合成到离屏 Canvas，
 * 彻底绕开内置 Webview / 浏览器对 getDisplayMedia 的限制，零弹窗一键录制完整演示视频！
 */

const FONT_SANS = '"Inter", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
const FONT_DISPLAY = '"Space Grotesk", "Inter", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, "SF Mono", Consolas, monospace';

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function isElVisible(el) {
  if (!el || el.classList?.contains('hidden')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) < 0.04) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0.5 && r.height > 0.5;
}

function drawGlassSurface(ctx, r, radius, opts = {}) {
  const {
    topColor = 'rgba(24, 30, 44, 0.80)',
    bottomColor = 'rgba(13, 18, 28, 0.85)',
    borderColor = 'rgba(255, 255, 255, 0.18)',
    shadowBlur = 22,
    specular = true,
  } = opts;

  ctx.save();
  if (shadowBlur > 0) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 8;
  }
  const grad = ctx.createLinearGradient(r.left, r.top, r.left, r.bottom);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);

  roundRectPath(ctx, r.left, r.top, r.width, r.height, radius);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // 外描边
  ctx.save();
  roundRectPath(ctx, r.left + 0.5, r.top + 0.5, r.width - 1, r.height - 1, radius);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 顶部 Apple 液态玻璃 1px 镜面高光边
  if (specular && r.width > 24) {
    const pad = Math.min(radius, r.width * 0.25);
    const specGrad = ctx.createLinearGradient(r.left + pad, r.top, r.right - pad, r.top);
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    specGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.30)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
    ctx.beginPath();
    ctx.moveTo(r.left + pad, r.top + 1);
    ctx.lineTo(r.right - pad, r.top + 1);
    ctx.strokeStyle = specGrad;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  if (!text) return y;
  let line = '';
  let curY = y;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, curY);
      line = ch;
      curY += lineHeight;
      count++;
      if (count >= maxLines - 1) {
        let rest = text.slice(i);
        while (rest.length > 1 && ctx.measureText(rest + '…').width > maxWidth) {
          rest = rest.slice(0, -1);
        }
        ctx.fillText(rest + (rest.length < text.slice(i).length ? '…' : ''), x, curY);
        return curY + lineHeight;
      }
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, curY);
    curY += lineHeight;
  }
  return curY;
}

export class StudioHudMirror {
  constructor(sourceCanvas) {
    this.sourceCanvas = sourceCanvas;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.rafId = null;
    this.active = false;
    this.scale = 1;
    this.cssW = 1280;
    this.cssH = 720;

    this.pointer = { x: -100, y: -100, down: false, visible: false };
    this.ripples = [];

    this._onPointerMove = (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointer.visible = true;
    };
    this._onPointerDown = (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointer.down = true;
      this.pointer.visible = true;
      this.ripples.push({ x: e.clientX, y: e.clientY, start: performance.now() });
      if (this.ripples.length > 8) this.ripples.shift();
    };
    this._onPointerUp = () => {
      this.pointer.down = false;
    };
  }

  _syncDimensions() {
    const w = Math.max(320, Math.round(window.innerWidth));
    const h = Math.max(240, Math.round(window.innerHeight));
    const dpr = window.devicePixelRatio || 1;
    // 上限 1920x1080 确保 60 FPS H.264 编码稳定零卡顿，且强制宽高为偶数
    const maxScale = Math.min(dpr, 1920 / w, 1080 / h);
    const scale = Math.max(1, maxScale);
    const pw = Math.max(320, Math.floor(w * scale) & ~1);
    const ph = Math.max(240, Math.floor(h * scale) & ~1);

    this.cssW = w;
    this.cssH = h;
    this.scale = pw / w;

    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
  }

  start() {
    if (this.active) return this.canvas;
    this.active = true;
    this._syncDimensions();

    window.addEventListener('pointermove', this._onPointerMove, { capture: true, passive: true });
    window.addEventListener('pointerdown', this._onPointerDown, { capture: true, passive: true });
    window.addEventListener('pointerup', this._onPointerUp, { capture: true, passive: true });

    // 先同步绘制第一帧，确保 captureStream 首帧非黑屏
    this._renderFrame(performance.now());

    const loop = (now) => {
      if (!this.active) return;
      this._renderFrame(now);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
    return this.canvas;
  }

  stop() {
    this.active = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('pointermove', this._onPointerMove, { capture: true });
    window.removeEventListener('pointerdown', this._onPointerDown, { capture: true });
    window.removeEventListener('pointerup', this._onPointerUp, { capture: true });
    this.ripples = [];
  }

  _renderFrame(now) {
    const ctx = this.ctx;
    if (!ctx) return;

    const pw = this.canvas.width;
    const ph = this.canvas.height;
    const sx = pw / this.cssW;
    const sy = ph / this.cssH;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d111a';
    ctx.fillRect(0, 0, pw, ph);

    // 1. 底层 3D WebGPU 画面无损拷贝
    if (this.sourceCanvas && this.sourceCanvas.width > 0 && this.sourceCanvas.height > 0) {
      try {
        ctx.drawImage(this.sourceCanvas, 0, 0, pw, ph);
      } catch {
        // 忽略个别帧 WebGPU 上下文切换瞬态
      }
    }

    ctx.setTransform(sx, 0, 0, sy, 0, 0);

    const isZen = document.body.classList.contains('zen-mode');

    // 2. 3D 空间结构探针
    this._drawHotspots(ctx, now);

    // 3. 悬浮部件提示
    this._drawHoverTooltip(ctx);

    if (!isZen) {
      // 4. 左上品牌条 + 视角切换胶囊
      this._drawHeader(ctx);
      // 5. 动作编排胶囊（逐指计数 / 404 铭印）
      this._drawChoreoPill(ctx);
      // 6. 左下工程参数卡
      this._drawTelemetryCard(ctx);
      // 7. 右侧 Apple 液态玻璃控制台
      this._drawControlPanel(ctx);
      // 8. 底部悬浮操作栏
      this._drawBottomDock(ctx, now);
    } else {
      this._drawExitZenBtn(ctx);
    }

    // 9. 实时点击波纹 + 高清交互光标
    this._drawPointerAndRipples(ctx, now);
  }

  _drawHotspots(ctx, now) {
    const layer = document.getElementById('hotspot-layer');
    if (!isElVisible(layer)) return;
    const pins = layer.querySelectorAll('.spatial-pin');
    const pulse = (now * 0.0014) % 1;

    pins.forEach((pin) => {
      if (!isElVisible(pin)) return;
      const r = pin.getBoundingClientRect();
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.5;
      const isActive = pin.classList.contains('active');

      // 呼吸外圈
      ctx.save();
      const ringR = 7 + pulse * 10;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = isActive
        ? `rgba(255, 186, 130, ${(1 - pulse) * 0.68})`
        : `rgba(118, 222, 255, ${(1 - pulse) * 0.62})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // 深色底环 + 发光圆芯
      ctx.beginPath();
      ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 14, 22, 0.90)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 4.4, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#ffba82' : '#76deff';
      ctx.shadowColor = isActive ? 'rgba(255, 186, 130, 0.95)' : 'rgba(118, 222, 255, 0.95)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      // 若悬浮显示标签
      const tag = pin.querySelector('.pin-tag');
      if (tag && isElVisible(tag)) {
        const tr = tag.getBoundingClientRect();
        drawGlassSurface(ctx, tr, tr.height * 0.5, {
          topColor: 'rgba(18, 24, 36, 0.90)',
          bottomColor: 'rgba(12, 16, 26, 0.92)',
          borderColor: 'rgba(118, 222, 255, 0.52)',
          shadowBlur: 12,
        });
        ctx.save();
        ctx.font = `600 11px ${FONT_SANS}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tag.textContent.trim(), tr.left + tr.width * 0.5, tr.top + tr.height * 0.5 + 0.5);
        ctx.restore();
      }
    });
  }

  _drawHoverTooltip(ctx) {
    const tip = document.getElementById('hover-tooltip');
    if (!isElVisible(tip)) return;
    const r = tip.getBoundingClientRect();
    drawGlassSurface(ctx, r, 12, {
      topColor: 'rgba(20, 26, 38, 0.90)',
      bottomColor: 'rgba(12, 16, 26, 0.92)',
      borderColor: 'rgba(255, 255, 255, 0.22)',
      shadowBlur: 16,
    });
    const strong = tip.querySelector('strong');
    const span = tip.querySelector('span');
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let curY = r.top + 7;
    if (strong && strong.textContent) {
      ctx.font = `600 11.5px ${FONT_SANS}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(strong.textContent.trim(), r.left + 12, curY);
      curY += 15;
    }
    if (span && span.textContent) {
      ctx.font = `500 10.5px ${FONT_SANS}`;
      ctx.fillStyle = '#8de4ff';
      ctx.fillText(span.textContent.trim(), r.left + 12, curY);
    }
    ctx.restore();
  }

  _drawHeader(ctx) {
    const header = document.querySelector('.hud-header');
    if (!isElVisible(header)) return;

    // 品牌条
    const strip = header.querySelector('.brand-strip');
    if (isElVisible(strip)) {
      const r = strip.getBoundingClientRect();
      drawGlassSurface(ctx, r, 16);

      const mark = strip.querySelector('.brand-mark');
      if (isElVisible(mark)) {
        const mr = mark.getBoundingClientRect();
        drawGlassSurface(ctx, mr, 10, {
          topColor: 'rgba(255, 255, 255, 0.20)',
          bottomColor: 'rgba(100, 210, 255, 0.14)',
          borderColor: 'rgba(255, 255, 255, 0.30)',
          shadowBlur: 0,
        });
        ctx.save();
        ctx.font = `700 15px ${FONT_DISPLAY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mark.textContent.trim(), mr.left + mr.width * 0.5, mr.top + mr.height * 0.5 + 0.5);
        ctx.restore();
      }

      const h1 = strip.querySelector('h1');
      if (isElVisible(h1)) {
        const hr = h1.getBoundingClientRect();
        ctx.save();
        ctx.font = `700 12.5px ${FONT_DISPLAY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(h1.textContent.trim(), hr.left, hr.top + hr.height * 0.5);
        ctx.restore();
      }

      strip.querySelectorAll('.fps-pill').forEach((pill) => {
        if (!isElVisible(pill)) return;
        const pr = pill.getBoundingClientRect();
        ctx.save();
        roundRectPath(ctx, pr.left, pr.top, pr.width, pr.height, pr.height * 0.5);
        ctx.fillStyle = 'rgba(100, 210, 255, 0.18)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(118, 222, 255, 0.36)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = `600 10px ${FONT_MONO}`;
        ctx.fillStyle = '#8de4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pill.textContent.trim(), pr.left + pr.width * 0.5, pr.top + pr.height * 0.5 + 0.5);
        ctx.restore();
      });

      const status = strip.querySelector('#phase-status');
      if (isElVisible(status)) {
        const sr = status.getBoundingClientRect();
        ctx.save();
        ctx.font = `500 11px ${FONT_SANS}`;
        ctx.fillStyle = 'rgba(228, 236, 248, 0.84)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(status.textContent.trim(), sr.left, sr.top + sr.height * 0.5);
        ctx.restore();
      }
    }

    // 视角胶囊轨道
    const rail = header.querySelector('.camera-rail');
    if (isElVisible(rail)) {
      const rr = rail.getBoundingClientRect();
      drawGlassSurface(ctx, rr, rr.height * 0.5);

      rail.querySelectorAll('.cam-btn').forEach((btn) => {
        if (!isElVisible(btn)) return;
        const br = btn.getBoundingClientRect();
        const active = btn.classList.contains('active');
        if (active) {
          drawGlassSurface(ctx, br, br.height * 0.5, {
            topColor: 'rgba(118, 222, 255, 0.34)',
            bottomColor: 'rgba(72, 178, 235, 0.22)',
            borderColor: 'rgba(148, 230, 255, 0.56)',
            shadowBlur: 0,
          });
        }
        ctx.save();
        ctx.font = `${active ? 600 : 500} 11.5px ${FONT_SANS}`;
        ctx.fillStyle = active ? '#ffffff' : 'rgba(232, 240, 252, 0.82)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.textContent.trim(), br.left + br.width * 0.5, br.top + br.height * 0.5 + 0.5);
        ctx.restore();
      });
    }
  }

  _drawChoreoPill(ctx) {
    const pill = document.getElementById('choreo-pill');
    if (!isElVisible(pill)) return;
    const r = pill.getBoundingClientRect();
    drawGlassSurface(ctx, r, r.height * 0.5, {
      borderColor: 'rgba(118, 222, 255, 0.42)',
    });

    const label = pill.querySelector('#choreo-label');
    if (isElVisible(label)) {
      const lr = label.getBoundingClientRect();
      ctx.save();
      ctx.font = `600 11.5px ${FONT_SANS}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.textContent.trim(), lr.left, lr.top + lr.height * 0.5);
      ctx.restore();
    }

    pill.querySelectorAll('.choreo-step').forEach((step) => {
      if (!isElVisible(step)) return;
      const sr = step.getBoundingClientRect();
      const active = step.classList.contains('active');
      const done = step.classList.contains('done');
      ctx.save();
      roundRectPath(ctx, sr.left, sr.top, sr.width, sr.height, sr.height * 0.5);
      ctx.fillStyle = active
        ? 'rgba(118, 222, 255, 0.34)'
        : done
          ? 'rgba(118, 222, 255, 0.14)'
          : 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
      ctx.strokeStyle = active ? 'rgba(155, 232, 255, 0.82)' : 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `700 11px ${FONT_MONO}`;
      ctx.fillStyle = active ? '#ffffff' : done ? '#8de4ff' : 'rgba(220, 230, 245, 0.72)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(step.textContent.trim(), sr.left + sr.width * 0.5, sr.top + sr.height * 0.5 + 0.5);
      ctx.restore();
    });
  }

  _drawTelemetryCard(ctx) {
    const card = document.getElementById('telemetry-card');
    if (!isElVisible(card)) return;
    const r = card.getBoundingClientRect();
    drawGlassSurface(ctx, r, 18, {
      borderColor: 'rgba(118, 222, 255, 0.32)',
    });

    const code = card.querySelector('#tel-code');
    if (isElVisible(code)) {
      const cr = code.getBoundingClientRect();
      ctx.save();
      ctx.font = `700 10.5px ${FONT_MONO}`;
      ctx.fillStyle = '#8de4ff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(code.textContent.trim(), cr.left, cr.top + cr.height * 0.5);
      ctx.restore();
    }

    const title = card.querySelector('#tel-title');
    if (isElVisible(title)) {
      const tr = title.getBoundingClientRect();
      ctx.save();
      ctx.font = `700 15px ${FONT_SANS}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(title.textContent.trim(), tr.left, tr.top + 1);
      ctx.restore();
    }

    const desc = card.querySelector('#tel-desc');
    if (isElVisible(desc)) {
      const dr = desc.getBoundingClientRect();
      ctx.save();
      ctx.font = `400 11.5px ${FONT_SANS}`;
      ctx.fillStyle = 'rgba(230, 238, 250, 0.86)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      drawWrappedText(ctx, desc.textContent.trim(), dr.left, dr.top + 1, dr.width, 17, 4);
      ctx.restore();
    }

    card.querySelectorAll('.tel-spec').forEach((item) => {
      if (!isElVisible(item)) return;
      const ir = item.getBoundingClientRect();
      ctx.save();
      roundRectPath(ctx, ir.left, ir.top, ir.width, ir.height, 9);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const k = item.querySelector('span');
      const v = item.querySelector('strong');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (k) {
        ctx.font = `500 10px ${FONT_SANS}`;
        ctx.fillStyle = 'rgba(198, 212, 232, 0.78)';
        ctx.fillText(k.textContent.trim(), ir.left + 8, ir.top + 6);
      }
      if (v) {
        ctx.font = `600 11px ${FONT_SANS}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(v.textContent.trim(), ir.left + 8, ir.top + 20);
      }
      ctx.restore();
    });
  }

  _drawControlPanel(ctx) {
    const panel = document.getElementById('control-panel');
    if (!isElVisible(panel)) return;
    const pr = panel.getBoundingClientRect();
    drawGlassSurface(ctx, pr, 20);

    // 顶栏
    const led = panel.querySelector('.status-led');
    if (isElVisible(led)) {
      const lr = led.getBoundingClientRect();
      ctx.save();
      ctx.beginPath();
      ctx.arc(lr.left + lr.width * 0.5, lr.top + lr.height * 0.5, lr.width * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#76deff';
      ctx.shadowColor = 'rgba(100, 210, 255, 0.95)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    }

    const title = panel.querySelector('.panel-title');
    if (isElVisible(title)) {
      const tr = title.getBoundingClientRect();
      ctx.save();
      ctx.font = `700 11.5px ${FONT_DISPLAY}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(title.textContent.trim(), tr.left, tr.top + tr.height * 0.5);
      ctx.restore();
    }

    const muteBtn = panel.querySelector('#toggle-mute-btn');
    if (isElVisible(muteBtn)) {
      const mr = muteBtn.getBoundingClientRect();
      const muted = muteBtn.classList.contains('muted');
      ctx.save();
      roundRectPath(ctx, mr.left, mr.top, mr.width, mr.height, mr.height * 0.5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `500 10.5px ${FONT_SANS}`;
      ctx.fillStyle = muted ? 'rgba(220, 230, 245, 0.56)' : '#f2f6ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(muteBtn.textContent.trim(), mr.left + mr.width * 0.5, mr.top + mr.height * 0.5 + 0.5);
      ctx.restore();
    }

    const colBtn = panel.querySelector('#collapse-panel-btn');
    if (isElVisible(colBtn)) {
      const cr = colBtn.getBoundingClientRect();
      ctx.save();
      ctx.font = `600 14px ${FONT_SANS}`;
      ctx.fillStyle = 'rgba(230, 238, 250, 0.82)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(colBtn.textContent.trim(), cr.left + cr.width * 0.5, cr.top + cr.height * 0.5);
      ctx.restore();
    }

    // 3 分段标签栏
    const tabs = panel.querySelector('#panel-tabs');
    if (isElVisible(tabs)) {
      const tr = tabs.getBoundingClientRect();
      ctx.save();
      roundRectPath(ctx, tr.left, tr.top, tr.width, tr.height, 12);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      tabs.querySelectorAll('.tab-btn').forEach((tb) => {
        if (!isElVisible(tb)) return;
        const br = tb.getBoundingClientRect();
        const active = tb.classList.contains('active');
        if (active) {
          drawGlassSurface(ctx, br, 9, {
            topColor: 'rgba(255, 255, 255, 0.24)',
            bottomColor: 'rgba(255, 255, 255, 0.14)',
            borderColor: 'rgba(255, 255, 255, 0.26)',
            shadowBlur: 0,
          });
        }
        ctx.save();
        ctx.font = `${active ? 600 : 500} 11.5px ${FONT_SANS}`;
        ctx.fillStyle = active ? '#ffffff' : 'rgba(222, 232, 248, 0.78)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tb.textContent.trim(), br.left + br.width * 0.5, br.top + br.height * 0.5 + 0.5);
        ctx.restore();
      });
    }

    // 主体可滚动区域（裁剪绘制）
    const body = panel.querySelector('#panel-body');
    if (!isElVisible(body)) return;
    const br = body.getBoundingClientRect();
    const activePane = body.querySelector('.tab-pane.active');
    if (!activePane) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(br.left, br.top, br.width, br.height);
    ctx.clip();

    // 分组标题
    activePane.querySelectorAll('.block-label').forEach((el) => {
      if (!isElVisible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < br.top || r.top > br.bottom) return;
      ctx.font = `600 10.5px ${FONT_DISPLAY}`;
      ctx.fillStyle = 'rgba(202, 218, 240, 0.74)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.textContent.trim(), r.left, r.top + r.height * 0.5);
    });

    // 姿态 / 布光 / 上传 / 涂装按钮
    activePane.querySelectorAll('.preset-btn, .mood-btn, .mini-btn, .upload-btn, .skin-btn').forEach((btn) => {
      if (!isElVisible(btn)) return;
      const r = btn.getBoundingClientRect();
      if (r.bottom < br.top || r.top > br.bottom) return;
      const active = btn.classList.contains('active');
      const isChoreo = btn.classList.contains('preset-choreo');
      const isSkin = btn.classList.contains('skin-btn');
      drawGlassSurface(ctx, r, 11, {
        topColor: active
          ? 'rgba(100, 210, 255, 0.34)'
          : isChoreo
            ? 'rgba(100, 210, 255, 0.13)'
            : 'rgba(255, 255, 255, 0.08)',
        bottomColor: active
          ? 'rgba(62, 166, 224, 0.22)'
          : isChoreo
            ? 'rgba(72, 160, 215, 0.08)'
            : 'rgba(255, 255, 255, 0.04)',
        borderColor: active
          ? 'rgba(148, 232, 255, 0.70)'
          : isChoreo
            ? 'rgba(118, 222, 255, 0.30)'
            : 'rgba(255, 255, 255, 0.15)',
        shadowBlur: 0,
        specular: active,
      });
      if (isSkin) {
        const sw = btn.querySelector('.skin-swatch');
        if (sw) {
          const sr = sw.getBoundingClientRect();
          const swBg = window.getComputedStyle(sw).getPropertyValue('--swatch').trim() || '#e4e8f0';
          ctx.save();
          ctx.beginPath();
          ctx.arc(sr.left + sr.width * 0.5, sr.top + sr.height * 0.5, sr.width * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = swBg;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        }
        ctx.font = `${active ? 600 : 500} 11.5px ${FONT_SANS}`;
        ctx.fillStyle = active ? '#ffffff' : 'rgba(240, 246, 255, 0.90)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.textContent.trim(), r.left + 29, r.top + r.height * 0.5 + 0.5);
      } else {
        ctx.font = `${active ? 600 : 500} 12px ${FONT_SANS}`;
        ctx.fillStyle = active ? '#ffffff' : 'rgba(240, 246, 255, 0.90)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.textContent.trim(), r.left + r.width * 0.5, r.top + r.height * 0.5 + 0.5);
      }
    });

    // 精准滑块
    activePane.querySelectorAll('.precision-slider').forEach((wrap) => {
      if (!isElVisible(wrap)) return;
      const wr = wrap.getBoundingClientRect();
      if (wr.bottom < br.top || wr.top > br.bottom) return;

      const labelSpan = wrap.querySelector('.slider-meta span');
      const outEl = wrap.querySelector('.slider-meta output');
      const input = wrap.querySelector('input[type="range"]');

      if (labelSpan) {
        const sr = labelSpan.getBoundingClientRect();
        ctx.font = `500 11.5px ${FONT_SANS}`;
        ctx.fillStyle = 'rgba(235, 242, 252, 0.90)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelSpan.textContent.trim(), sr.left, sr.top + sr.height * 0.5);
      }
      if (outEl) {
        const or = outEl.getBoundingClientRect();
        ctx.font = `600 11px ${FONT_MONO}`;
        ctx.fillStyle = '#8de4ff';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(outEl.textContent.trim(), or.right, or.top + or.height * 0.5);
      }
      if (input) {
        const ir = input.getBoundingClientRect();
        const min = parseFloat(input.min) || 0;
        const max = parseFloat(input.max) || 1;
        const val = parseFloat(input.value) || 0;
        const pct = Math.max(0, Math.min(1, (val - min) / Math.max(1e-6, max - min)));
        const cy = ir.top + ir.height * 0.5;
        const trackH = 4;

        // 底轨
        roundRectPath(ctx, ir.left, cy - trackH * 0.5, ir.width, trackH, trackH * 0.5);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fill();

        // 已填进度轨
        const fillW = Math.max(trackH, ir.width * pct);
        roundRectPath(ctx, ir.left, cy - trackH * 0.5, fillW, trackH, trackH * 0.5);
        ctx.fillStyle = 'rgba(118, 222, 255, 0.90)';
        ctx.fill();

        // 发光白圆点 Handle
        const thumbX = ir.left + 6 + (ir.width - 12) * pct;
        ctx.save();
        ctx.beginPath();
        ctx.arc(thumbX, cy, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(118, 222, 255, 0.95)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      }
    });

    // Apple 风格开关
    activePane.querySelectorAll('.swiss-switch').forEach((sw) => {
      if (!isElVisible(sw)) return;
      const sr = sw.getBoundingClientRect();
      if (sr.bottom < br.top || sr.top > br.bottom) return;

      const labelSpan = sw.querySelector('span:first-child');
      const chk = sw.querySelector('input[type="checkbox"]');
      const track = sw.querySelector('.switch-track');

      if (labelSpan) {
        const lr = labelSpan.getBoundingClientRect();
        ctx.font = `500 12px ${FONT_SANS}`;
        ctx.fillStyle = 'rgba(238, 245, 255, 0.92)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelSpan.textContent.trim(), lr.left, lr.top + lr.height * 0.5);
      }
      if (track) {
        const tr = track.getBoundingClientRect();
        const checked = !!chk?.checked;
        roundRectPath(ctx, tr.left, tr.top, tr.width, tr.height, tr.height * 0.5);
        ctx.fillStyle = checked ? 'rgba(92, 206, 255, 0.88)' : 'rgba(255, 255, 255, 0.16)';
        ctx.fill();
        ctx.strokeStyle = checked ? 'rgba(155, 232, 255, 0.72)' : 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const thumbR = tr.height * 0.5 - 2.5;
        const thumbX = checked ? tr.right - thumbR - 2.5 : tr.left + thumbR + 2.5;
        const thumbY = tr.top + tr.height * 0.5;
        ctx.beginPath();
        ctx.arc(thumbX, thumbY, thumbR, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    });

    ctx.restore();
  }

  _drawBottomDock(ctx, now) {
    const dock = document.querySelector('.action-dock');
    if (isElVisible(dock)) {
      const dr = dock.getBoundingClientRect();
      drawGlassSurface(ctx, dr, dr.height * 0.5);

      dock.querySelectorAll('.dock-sep').forEach((sep) => {
        if (!isElVisible(sep)) return;
        const sr = sep.getBoundingClientRect();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(sr.left, sr.top, Math.max(1, sr.width), sr.height);
      });

      dock.querySelectorAll('.dock-btn').forEach((btn) => {
        if (!isElVisible(btn)) return;
        const br = btn.getBoundingClientRect();
        const active = btn.classList.contains('active');
        const recording = btn.classList.contains('recording');
        const accent = btn.classList.contains('dock-accent');

        if (recording) {
          const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
          drawGlassSurface(ctx, br, br.height * 0.5, {
            topColor: `rgba(255, 69, 58, ${0.28 + pulse * 0.12})`,
            bottomColor: 'rgba(200, 38, 32, 0.24)',
            borderColor: `rgba(255, 110, 102, ${0.62 + pulse * 0.28})`,
            shadowBlur: 0,
          });
        } else if (active || accent) {
          drawGlassSurface(ctx, br, br.height * 0.5, {
            topColor: 'rgba(110, 216, 255, 0.28)',
            bottomColor: 'rgba(66, 170, 228, 0.18)',
            borderColor: 'rgba(148, 232, 255, 0.54)',
            shadowBlur: 0,
          });
        }

        // 状态指示小圆点（结构探针蓝点 / 录制红点）
        const blueDot = btn.querySelector('.dot-indicator');
        const redDot = btn.querySelector('.rec-dot');
        let textOffsetX = 0;

        if (blueDot && isElVisible(blueDot)) {
          const dotR = blueDot.getBoundingClientRect();
          ctx.save();
          ctx.beginPath();
          ctx.arc(dotR.left + dotR.width * 0.5, dotR.top + dotR.height * 0.5, dotR.width * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = active ? '#76deff' : 'rgba(200, 212, 228, 0.45)';
          if (active) {
            ctx.shadowColor = 'rgba(118, 222, 255, 0.95)';
            ctx.shadowBlur = 8;
          }
          ctx.fill();
          ctx.restore();
          textOffsetX = 7;
        } else if (redDot && isElVisible(redDot)) {
          const dotR = redDot.getBoundingClientRect();
          ctx.save();
          ctx.beginPath();
          ctx.arc(dotR.left + dotR.width * 0.5, dotR.top + dotR.height * 0.5, dotR.width * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ff453a';
          ctx.shadowColor = 'rgba(255, 69, 58, 0.95)';
          ctx.shadowBlur = recording ? 10 : 6;
          ctx.fill();
          ctx.restore();
          textOffsetX = 7;
        }

        ctx.save();
        ctx.font = `${active || recording ? 600 : 500} 11.5px ${recording ? FONT_MONO : FONT_SANS}`;
        ctx.fillStyle = recording ? '#ffffff' : active ? '#ffffff' : 'rgba(235, 242, 252, 0.88)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.textContent.trim(), br.left + br.width * 0.5 + textOffsetX, br.top + br.height * 0.5 + 0.5);
        ctx.restore();
      });
    }

    const hint = document.querySelector('.hint-micro');
    if (isElVisible(hint)) {
      const hr = hint.getBoundingClientRect();
      ctx.save();
      ctx.font = `500 10.5px ${FONT_SANS}`;
      ctx.fillStyle = 'rgba(210, 222, 240, 0.68)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hint.textContent.trim(), hr.left + hr.width * 0.5, hr.top + hr.height * 0.5);
      ctx.restore();
    }
  }

  _drawExitZenBtn(ctx) {
    const btn = document.getElementById('exit-zen-btn');
    if (!isElVisible(btn)) return;
    const r = btn.getBoundingClientRect();
    drawGlassSurface(ctx, r, r.height * 0.5);
    ctx.save();
    ctx.font = `500 11.5px ${FONT_SANS}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.textContent.trim(), r.left + r.width * 0.5, r.top + r.height * 0.5 + 0.5);
    ctx.restore();
  }

  _drawPointerAndRipples(ctx, now) {
    // 点击冰蓝微光涟漪
    const RIPPLE_MS = 440;
    this.ripples = this.ripples.filter((rp) => now - rp.start < RIPPLE_MS);
    for (const rp of this.ripples) {
      const t = (now - rp.start) / RIPPLE_MS;
      const ease = 1 - Math.pow(1 - t, 3);
      const rad = 5 + ease * 24;
      const alpha = (1 - t) * 0.78;
      ctx.save();
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rad, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(128, 226, 255, ${alpha})`;
      ctx.lineWidth = 2.2 * (1 - t * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    if (!this.pointer.visible) return;
    const { x, y, down } = this.pointer;
    const s = down ? 0.90 : 1.0;

    // Apple / macOS 风格高对比矢量箭头光标
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 17.5);
    ctx.lineTo(4.4, 13.6);
    ctx.lineTo(7.4, 20.2);
    ctx.lineTo(10.0, 19.0);
    ctx.lineTo(7.0, 12.5);
    ctx.lineTo(12.6, 12.2);
    ctx.closePath();

    ctx.fillStyle = '#0f141e';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }
}
