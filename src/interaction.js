import * as THREE from 'three/webgpu';

const PART_LABELS = [
  [/Tripo_BionicHand_Body/, '404 仿生机械手雕塑主体（拖拽手指可实时弯曲）'],
  [/Armor_Forearm_Wing_Left/, '前臂尺侧流线白陶护翼'],
  [/Armor_Forearm_Wing_Right/, '前臂桡侧流线白陶护翼'],
  [/Forearm_Core_Body/, '前臂高刚性钛合金主脊与底座'],
  [/Wrist_Gimbal_Hub/, '腕部谐波减速万向关节总成'],
  [/Joint_Wrist_InnerGimbalBall/, '腕部内置精密球形万向轴芯'],
  [/Armor_Palm_MainBody/, '掌心主陶瓷骨架与生物电透视腔体'],
  [/Armor_Palm_UlnarShell/, '手掌尺侧独立白陶护壳'],
  [/Armor_Palm_RadialDorsalPlate/, '手背桡侧独立白陶饰板'],
  [/Armor_Palm_DorsalTrim/, '手背腕部衔接饰条'],
  [/Bone_Palm_Metacarpal/, '仿生掌骨与生物电脉络核心'],
  [/Gear_Wrist_DorsalTurbine_Drum/, '腕背精密谐波减速涡轮表盘'],
  [/Neural_Wrist_Halo|Neural_Wrist_Accent/, '腕背双向流光光学谐波环'],
  [/Wrist_SwissGear_Ring/, '腕背 36 齿精密钟表擒纵齿轮环'],
  [/Wrist_SwissBezel_|Wrist_SwissTick_|Wrist_SwissScrew_/, '腕背拉丝钛表圈与 36 分度精密刻度'],
  [/Wrist_EscapementBridge_|Wrist_GoldJewel_|Wrist_SwissCenter_/, '腕背镂空陀飞轮擒纵桥与沉金宝石轴心'],
  [/Wrist_Bearing_/, '腕部侧向精密轴承总成'],
  [/Wrist_Gimbal_/, '腕部万向关节内芯总成'],
  [/Forearm_LightConduit_Lens/, '前臂冰蓝导光透镜条'],
  [/Forearm_FrontPlate_/, '前臂前侧钛合金护板'],
  [/Forearm_Spine_/, '前臂内部钛合金加强脊'],
  [/Joint_.*_Knuckle/, '仿生指节暗钛球形关节'],
  [/Thumb_CMC_Part/, '拇指腕掌精密万向关节'],
  [/Joint_.*_CoreAxle/, '指节内置暗钛机械转轴'],
  [/PCB_Palm_/, '掌心高密度神经控板 PCB（镀金焊盘 + SoC）'],
  [/PCB_Forearm_/, '前臂驱动控制 PCB 与传感器阵列'],
  [/Forearm_CopperCoil|Forearm_CopperMotor/, '前臂无刷铜线绕组线性作动电机'],
  [/Servo_Palm_CopperCoil|Servo_Palm_Stator/, '掌心微型铜绕组无刷肌腱伺服'],
  [/Wrist_CopperStator/, '腕部 12 极铜绕组谐波定子'],
  [/Wrist_BearingBall/, '腕部精密镀铬钢珠轴承'],
  [/Bolt_/, 'CNC 车削不锈钢梅花紧固微螺钉'],
  [/Forearm_BaseCuff/, '车削拉丝钛合金底座袖口'],
  [/Forearm_TitaniumCore/, '前臂高刚性钛合金主脊'],
  [/Hydraulic_Forearm_RearCylinder/, '前臂背面垂直液压作动筒'],
  [/Piston_Forearm_RearRod/, '前臂镀铬液压推杆'],
  [/Armor_Palm_DorsalCarapace/, '手背一体四脊雕塑背甲'],
  [/Armor_Palm_ThenarModule/, '大鱼际流线陶瓷护壳'],
  [/Armor_Palm_PalmarSurround/, '掌心五瓣倒角围框'],
  [/Glass_Palm_Shield/, '掌心半磨砂光学聚碳酸酯罩'],
  [/Bone_Palm_Metacarpal/, '缎面银钛仿生掌骨'],
  [/Bone_Palm_Carpal/, '仿生腕骨群组'],
  [/Gear_Wrist_DorsalTurbine/, '腕背 28 齿径向谐波涡轮'],
  [/Wrist_DorsalDrum/, '腕背谐波减速鼓壳'],
  [/Wrist_Front_VArch/, '腕前锻造 V 型钛合金桥架'],
  [/Servo_Palm/, '掌心隐蔽微型无刷伺服'],
  [/Tendon_Palm/, '钛合金屈肌拉索'],
  [/Neural_/, '冰蓝光纤生物电神经脉络'],
  [/Piston_Wrist/, '腕部微型镀铬液压推杆'],
  [/Plaque_404/, '404 激光蚀刻工业铭标'],
  [/Joint_Thumb_CMC/, '拇指多环钛金万向节'],
  [/Thumb/, '拇指仿生模组'],
  [/Index/, '食指仿生模组'],
  [/Middle/, '中指仿生模组'],
  [/Ring/, '无名指仿生模组'],
  [/Pinky/, '小指仿生模组'],
];

function getFriendlyLabel(name) {
  for (const [re, label] of PART_LABELS) {
    if (re.test(name)) return label;
  }
  return name.replace(/_/g, ' ');
}

function detectDigitKeyFromNode(obj, hitPointWorld = null, rootObj = null) {
  let curr = obj;
  while (curr) {
    const n = curr.name || '';
    if (n.includes('Thumb')) return 'thumb';
    if (n.includes('Index')) return 'index';
    if (n.includes('Middle')) return 'middle';
    if (n.includes('Ring')) return 'ring';
    if (n.includes('Pinky')) return 'pinky';
    curr = curr.parent;
  }
  // Spatial fallback for unified Tripo SkinnedMesh: map local 3D hit coordinates directly to the 5 digits!
  if (hitPointWorld && rootObj) {
    const lp = rootObj.worldToLocal(hitPointWorld.clone());
    if (lp.x > 1.95 && lp.y >= 3.4 && lp.y <= 8.5) return 'thumb';
    if (lp.y >= 5.6) {
      if (lp.x < -2.75) return 'pinky';
      if (lp.x < -1.18) return 'ring';
      if (lp.x < 0.55) return 'middle';
      if (lp.x < 2.35) return 'index';
    }
  }
  return null;
}

function isPoppableArmor(mesh) {
  return mesh.name.startsWith('Armor_') || mesh.name === 'Glass_Palm_Shield';
}

export class DirectInteractionController {
  constructor({ domElement, camera, controls, rootObj, rig, audio, onDigitDrag, onHiddenCountChange }) {
    this.domElement = domElement;
    this.camera = camera;
    this.controls = controls;
    this.rootObj = rootObj;
    this.rig = rig;
    this.audio = audio;
    this.onDigitDrag = onDigitDrag;
    this.onHiddenCountChange = onHiddenCountChange;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hoveredMesh = null;
    this.hoveredOrigEmissive = new THREE.Color();
    this.hoveredOrigIntensity = 0;

    this.dragDigit = null;
    this.dragStartY = 0;
    this.dragStartVal = 0;
    this.lastHoverTs = 0;
    this.hiddenSet = new Set();
    this.activePointers = new Set();
    this.lastTapTime = 0;
    this.lastTapX = 0;
    this.lastTapY = 0;

    this.tooltipEl = document.getElementById('hover-tooltip');
    this.pickables = [];
    this.rootObj.traverse((node) => {
      if (node.isMesh) this.pickables.push(node);
    });

    this._bindEvents();
  }

  _updatePointer(e) {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _pickVisibleHit() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    for (const h of hits) {
      if (h.object.visible && !h.object.userData.hiddenByUser) return h;
    }
    return null;
  }

  _pickVisibleMesh() {
    return this._pickVisibleHit()?.object || null;
  }

  _clearHover() {
    if (this.hoveredMesh && this.hoveredMesh.material && this.hoveredMesh.material.emissive) {
      this.hoveredMesh.material.emissive.copy(this.hoveredOrigEmissive);
      this.hoveredMesh.material.emissiveIntensity = this.hoveredOrigIntensity;
    }
    this.hoveredMesh = null;
    if (this.tooltipEl) this.tooltipEl.classList.add('hidden');
    if (!this.dragDigit) this.domElement.style.cursor = 'grab';
  }

  _setHover(hit, clientX, clientY) {
    const mesh = hit?.object || null;
    if (this.hoveredMesh !== mesh) {
      this._clearHover();
      this.hoveredMesh = mesh;
      if (
        mesh &&
        mesh.material &&
        mesh.material.emissive &&
        !mesh.name.startsWith('Neural_') &&
        !mesh.name.startsWith('Tripo_')
      ) {
        this.hoveredOrigEmissive.copy(mesh.material.emissive);
        this.hoveredOrigIntensity = mesh.material.emissiveIntensity ?? 0;
        mesh.material.emissive.setHex(0x52c8ff);
        mesh.material.emissiveIntensity = 0.20;
      }
    }

    if (mesh && this.tooltipEl) {
      const digit = detectDigitKeyFromNode(mesh, hit?.point, this.rootObj);
      const pop = isPoppableArmor(mesh);
      const hints = [];
      if (digit) hints.push('上下拖拽弯曲');
      if (pop) hints.push('双击局部拆解');
      this.tooltipEl.innerHTML = `<strong>${getFriendlyLabel(mesh.name)}</strong>${
        hints.length ? `<span>${hints.join(' · ')}</span>` : ''
      }`;
      this.tooltipEl.style.transform = `translate3d(${Math.min(window.innerWidth - 220, clientX + 16)}px, ${Math.max(12, clientY - 14)}px, 0)`;
      this.tooltipEl.classList.remove('hidden');
      this.domElement.style.cursor = digit ? 'ns-resize' : pop ? 'pointer' : 'grab';
    }
  }

  restoreAllArmor() {
    if (this.hiddenSet.size === 0) return;
    for (const mesh of this.hiddenSet) {
      mesh.userData.hiddenByUser = false;
      mesh.visible = true;
    }
    this.hiddenSet.clear();
    this.audio?.playArmorPop(false);
    this.onHiddenCountChange?.(0);
  }

  _popArmorMesh(hitMesh) {
    if (!hitMesh || !isPoppableArmor(hitMesh)) return false;
    this._clearHover();
    hitMesh.userData.hiddenByUser = true;
    this.hiddenSet.add(hitMesh);
    this.audio?.playArmorPop(true);
    this.onHiddenCountChange?.(this.hiddenSet.size);
    return true;
  }

  _bindEvents() {
    this._onPointerMove = (e) => {
      if (this.activePointers.size >= 2) {
        if (this.dragDigit) {
          this.dragDigit = null;
          this.controls.enabled = true;
        }
        return;
      }
      this._updatePointer(e);
      if (this.dragDigit) {
        const dy = e.clientY - this.dragStartY;
        const sensitivity = e.pointerType === 'touch' ? 0.0068 : 0.0055;
        const nextVal = THREE.MathUtils.clamp(this.dragStartVal + dy * sensitivity, 0, 1);
        this.rig.activePreset = 'custom';
        this.rig.onChoreoStep?.(null);
        this.rig.setParam(this.dragDigit, nextVal);
        this.onDigitDrag?.(this.dragDigit, nextVal);
        this.audio?.playDetentTick();
        return;
      }
      // 手机端纯触控不展示悬停微浮窗，避免遮挡画面
      if (e.pointerType === 'touch') return;

      const now = performance.now();
      if (now - this.lastHoverTs < 32) return;
      this.lastHoverTs = now;

      const hit = this._pickVisibleHit();
      if (hit) this._setHover(hit, e.clientX, e.clientY);
      else this._clearHover();
    };

    this._onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.activePointers.add(e.pointerId);

      // 一旦进入双指捏合缩放/平移，立刻释放单指弯曲拖拽，确保双指缩放丝滑零冲突
      if (this.activePointers.size >= 2) {
        if (this.dragDigit) {
          this.dragDigit = null;
          this.controls.enabled = true;
        }
        this._clearHover();
        return;
      }

      this._updatePointer(e);
      const hit = this._pickVisibleHit();
      if (!hit) return;

      // 移动端快速双点白甲局部拆解（touch-action: none 下原生 dblclick 不稳定）
      if (e.pointerType === 'touch') {
        const now = performance.now();
        const dist = Math.hypot(e.clientX - this.lastTapX, e.clientY - this.lastTapY);
        if (now - this.lastTapTime < 310 && dist < 28 && isPoppableArmor(hit.object)) {
          this.lastTapTime = 0;
          this._popArmorMesh(hit.object);
          return;
        }
        this.lastTapTime = now;
        this.lastTapX = e.clientX;
        this.lastTapY = e.clientY;
      }

      const digit = detectDigitKeyFromNode(hit.object, hit.point, this.rootObj);
      if (digit) {
        this.dragDigit = digit;
        this.dragStartY = e.clientY;
        this.dragStartVal = this.rig.target[digit] ?? 0;
        this.controls.enabled = false;
        if (e.pointerType !== 'touch') this.domElement.style.cursor = 'grabbing';
        this.audio?.playUiClick();
      }
    };

    this._onPointerUp = (e) => {
      this.activePointers.delete(e.pointerId);
      if (this.dragDigit && this.activePointers.size === 0) {
        this.dragDigit = null;
        this.controls.enabled = true;
        this.domElement.style.cursor = 'grab';
      }
    };

    this._onDblClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._updatePointer(e);
      const hit = this._pickVisibleMesh();
      this._popArmorMesh(hit);
    };

    this.domElement.addEventListener('pointermove', this._onPointerMove);
    this.domElement.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    this.domElement.addEventListener('dblclick', this._onDblClick);
  }

  dispose() {
    this.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    this.domElement.removeEventListener('dblclick', this._onDblClick);
  }
}
