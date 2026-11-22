import * as THREE from 'three/webgpu';
import { computeSafeFrameCamera } from './ui.js';

export const SPATIAL_HOTSPOTS = [
  {
    id: 'thumb-servo',
    code: 'H-01',
    title: '拇指多环钛金万向关节',
    subtitle: 'THUMB CMC GIMBAL COLLAR',
    anchorBone: 'Thumb_CMC',
    localOffset: [0.22, 0.12, 0.52],
    camPos: [11.5, 6.6, 15.2],
    camTarget: [2.0, 4.2, 0.2],
    specs: [
      { k: '峰值扭矩', v: '4.8 N·m' },
      { k: '自由度', v: '2-DOF 万向对掌' },
      { k: '结构工艺', v: '三层精密槽环钛轴承' },
      { k: '指节形态', v: '收腰仿生陶瓷护壳' },
    ],
    desc: '暴露式拉丝钛合金多环万向节衔接大鱼际雕塑模块，支持 0.02° 精密捏取对掌定位。',
  },
  {
    id: 'palm-synapse',
    code: 'H-02',
    title: '掌心仿生掌骨与神经脉络',
    subtitle: 'BIONIC METACARPAL & NEURAL BAY',
    anchorBone: 'Palm',
    localOffset: [-0.45, 2.75, 1.05],
    camPos: [-0.2, 3.8, 17.8],
    camTarget: [-0.3, 3.6, 0.2],
    specs: [
      { k: '光学护罩', v: 'IOR 1.48 半磨砂聚碳酸酯' },
      { k: '内构骨架', v: '5× 缎面银钛仿生掌骨' },
      { k: '神经脉络', v: '5 路 S 型光纤生物电网络' },
      { k: '深层驱动', v: '隐蔽微伺服 + 肌腱拉索' },
    ],
    desc: '五瓣人体工学半磨砂光学视窗下，缎面钛合金仿生掌骨与冰蓝生物电脉冲脉络清晰可见。',
  },
  {
    id: 'wrist-varch',
    code: 'H-03',
    title: '腕前锻造 V 型钛合金桥架',
    subtitle: 'FORGED TITANIUM V-ARCH BRIDGE',
    anchorBone: 'Wrist',
    localOffset: [0.0, -0.35, 1.15],
    camPos: [2.6, 0.2, 15.6],
    camTarget: [0.0, 0.1, 0.2],
    specs: [
      { k: '活动行程', v: '俯仰 ±55° / 侧摆 ±25°' },
      { k: '桥架材质', v: '一体锻造拉丝 TC4 钛合金' },
      { k: '内部机构', v: '双镀铬微活塞 + 球形万向核' },
      { k: '正背差异', v: '前 V 型桥架 / 后谐波涡轮' },
    ],
    desc: '正面采用极具雕塑张力的锻造 V 型钛金桥架衔接前臂冰蓝核心光槽，彻底区别于背面涡轮结构。',
  },
  {
    id: 'dorsal-turbine',
    code: 'H-04',
    title: '手背 28 齿径向谐波涡轮',
    subtitle: 'DORSAL HARMONIC DRIVE DRUM',
    anchorBone: 'Wrist',
    // V2-DEF-08 fix: anchored on outer bezel rim so dot never looks like an LED glued on the watch center!
    localOffset: [0.88, 0.56, -1.04],
    camPos: [-3.8, 0.8, -16.0],
    camTarget: [0.0, 0.3, -0.3],
    specs: [
      { k: '减速机构', v: '28T 同心径向谐波齿环' },
      { k: '减速比', v: '1 : 80 零背隙刚性输出' },
      { k: '后置作动', v: '单柱镀铬垂直液压减震筒' },
      { k: '品牌铭刻', v: '手背激光蚀刻 404 徽标' },
    ],
    desc: '航空级零背隙同心谐波鼓直连前臂背面单柱垂直液压缸，上方无缝承接一体四脊雕塑背甲。',
  },
  {
    id: 'forearm-core',
    code: 'H-05',
    title: '前臂流线双翼与光导核心',
    subtitle: 'HOURGLASS FAIRING & TELEMETRY CORE',
    anchorBone: 'Forearm',
    localOffset: [0.0, 4.6, 1.32],
    camPos: [2.2, -3.5, 16.5],
    camTarget: [0.0, -3.8, 0.2],
    specs: [
      { k: '外甲工艺', v: '全长一体收腰纳米白陶双翼' },
      { k: '底座规格', v: 'Ø33mm 实心拉丝钛合金袖口' },
      { k: '光导系统', v: '前侧垂直漫射冰蓝遥测柱' },
      { k: '自由度', v: '±90° 前臂旋前/旋后伺服' },
    ],
    desc: '一体成型的收腰流线白陶双翼包覆高刚性拉丝钛合金主脊，底部稳固衔接重型车削钛金袖座。',
  },
];

export class SpatialHotspotManager {
  constructor({ container, cardEl, camera, boneMap, onFlyTo, audio }) {
    this.container = container;
    this.cardEl = cardEl;
    this.camera = camera;
    this.boneMap = boneMap;
    this.onFlyTo = onFlyTo;
    this.audio = audio;
    this.enabled = true;
    this.activeId = null;

    this.pins = [];
    this._tmpVec = new THREE.Vector3();
    this._tmpWorldCenter = new THREE.Vector3();
    this._tmpLocalToPt = new THREE.Vector3();
    this._tmpCamToPt = new THREE.Vector3();
    this._tmpCamDir = new THREE.Vector3();
    this._visibleScreenPts = [];
    this._buildDom();
  }

  _buildDom() {
    this.container.innerHTML = '';
    for (const hs of SPATIAL_HOTSPOTS) {
      const btn = document.createElement('button');
      btn.className = 'spatial-pin';
      btn.dataset.id = hs.id;
      btn.setAttribute('aria-label', hs.title);
      btn.innerHTML = `<span class="pin-dot"></span><span class="pin-ring"></span><span class="pin-tag">${hs.code} · ${hs.title}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectHotspot(hs.id);
      });
      this.container.appendChild(btn);
      this.pins.push({ spec: hs, el: btn, offset: new THREE.Vector3(...hs.localOffset) });
    }

    const closeBtn = this.cardEl.querySelector('#telemetry-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.clearSelection());
    }
  }

  setEnabled(flag) {
    this.enabled = flag;
    this.container.classList.toggle('hidden', !flag);
    if (!flag) this.clearSelection();
  }

  clearSelection() {
    this.activeId = null;
    this.cardEl.classList.add('hidden');
    for (const p of this.pins) p.el.classList.remove('active');
  }

  selectHotspot(id) {
    const found = this.pins.find((p) => p.spec.id === id);
    if (!found) return;
    if (this.activeId === id) {
      this.clearSelection();
      return;
    }
    this.activeId = id;
    for (const p of this.pins) p.el.classList.toggle('active', p.spec.id === id);

    const s = found.spec;
    this.audio?.playFlyToSwoosh();
    // V2-DEF-03 fix: route ALL hotspot fly-tos through responsive Safe-Frame so zoomed focus clears right console & telemetry card!
    const safeCam = computeSafeFrameCamera(s.camPos, s.camTarget);
    this.onFlyTo(safeCam.pos, safeCam.target);

    this.cardEl.querySelector('#tel-code').textContent = `${s.code} · ${s.subtitle}`;
    this.cardEl.querySelector('#tel-title').textContent = s.title;
    this.cardEl.querySelector('#tel-desc').textContent = s.desc;
    const grid = this.cardEl.querySelector('#tel-specs');
    grid.innerHTML = s.specs
      .map((item) => `<div class="tel-kv"><span>${item.k}</span><strong>${item.v}</strong></div>`)
      .join('');
    this.cardEl.classList.remove('hidden');
  }

  update(width, height) {
    if (!this.enabled) return;
    this.camera.getWorldDirection(this._tmpCamDir);
    const panelCollapsed =
      document.getElementById('control-panel')?.classList.contains('is-collapsed') ||
      document.body.classList.contains('zen-mode');
    const panelReserve = panelCollapsed ? 28 : width <= 1060 ? 270 : 302;
    const safeRight = width - panelReserve;
    this._visibleScreenPts.length = 0;

    for (const p of this.pins) {
      const anchor = this.boneMap[p.spec.anchorBone];
      if (!anchor) {
        p.el.style.display = 'none';
        continue;
      }
      this._tmpVec.copy(p.offset).applyMatrix4(anchor.matrixWorld);
      this._tmpWorldCenter.setFromMatrixPosition(anchor.matrixWorld);
      this._tmpLocalToPt.subVectors(this._tmpVec, this._tmpWorldCenter).normalize();
      this._tmpCamToPt.subVectors(this.camera.position, this._tmpVec).normalize();
      const facing = this._tmpLocalToPt.dot(this._tmpCamToPt);

      this._tmpVec.project(this.camera);
      const inFront = this._tmpVec.z > -1 && this._tmpVec.z < 1;
      const sx = (this._tmpVec.x * 0.5 + 0.5) * width;
      let sy = (-this._tmpVec.y * 0.5 + 0.5) * height;

      const isSelected = p.spec.id === this.activeId;
      const visible =
        inFront &&
        (isSelected || facing > -0.05) &&
        sx > 24 &&
        sx < safeRight &&
        sy > 76 &&
        sy < height - 74;
      if (!visible) {
        p.el.style.display = 'none';
        continue;
      }

      for (const prev of this._visibleScreenPts) {
        if (Math.abs(sx - prev.x) < 34 && Math.abs(sy - prev.y) < 28) {
          sy = prev.y + 30;
        }
      }
      this._visibleScreenPts.push({ x: sx, y: sy });

      // V2-DEF-03 fix: auto-flip pill leftward when close to right console so tag NEVER clips behind console!
      p.el.classList.toggle('flip-left', sx > safeRight - 210);
      p.el.style.display = 'flex';
      p.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      p.el.style.opacity = '1';
    }
  }
}
