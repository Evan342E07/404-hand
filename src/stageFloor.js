import * as THREE from 'three/webgpu';
import { reflector, uv, length, smoothstep, exp, float, vec3 } from 'three/tsl';

/**
 * 404 BIONIC HAND STUDIO · 纯净极简暗玻反射展示台面
 * 仅保留实时暗玻镜面反射与柔和悬浮接触影（无额外彩色辉光，适配任意影棚背景切换）
 */
export function createStudioReflectiveFloor(scene) {
  const floorGroup = new THREE.Group();
  const floorY = -9.55;

  // 1. 暗玻实时镜面反射圆盘
  const reflection = reflector({ resolutionScale: 0.5, bounces: false });
  reflection.target.rotateX(-Math.PI / 2);
  reflection.target.position.y = floorY;
  scene.add(reflection.target);

  const radialFade = smoothstep(float(0.92), float(0.10), length(uv().sub(0.5)).mul(2.0));
  const softAlpha = radialFade.mul(radialFade).mul(0.24);

  const floorMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  floorMat.colorNode = reflection.rgb.mul(vec3(0.64, 0.70, 0.82));
  floorMat.opacityNode = softAlpha;

  const mirrorDisc = new THREE.Mesh(new THREE.CircleGeometry(13.5, 56), floorMat);
  mirrorDisc.rotation.x = -Math.PI / 2;
  mirrorDisc.position.y = floorY;
  mirrorDisc.renderOrder = 1;
  floorGroup.add(mirrorDisc);

  // 2. 柔和居中悬浮阴影
  const hoverDist = length(uv().sub(0.5)).mul(2.0);
  const hoverCore = exp(hoverDist.mul(hoverDist).negate().mul(4.8)).mul(0.62);
  const hoverHalo = exp(hoverDist.mul(hoverDist).negate().mul(1.6)).mul(0.26);
  const hoverMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  hoverMat.colorNode = vec3(0.015, 0.018, 0.026);
  hoverMat.opacityNode = hoverCore.add(hoverHalo).mul(smoothstep(float(1.0), float(0.68), hoverDist));

  const hoverShadow = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 11.5), hoverMat);
  hoverShadow.rotation.x = -Math.PI / 2;
  hoverShadow.position.set(0, floorY + 0.03, 0);
  hoverShadow.renderOrder = 2;
  floorGroup.add(hoverShadow);

  scene.add(floorGroup);

  return {
    floorGroup,
    setReflectionEnabled(flag) {
      mirrorDisc.visible = flag;
    },
    setVisible(flag) {
      floorGroup.visible = flag;
      reflection.target.visible = flag;
    },
    setAccentColor() {},
    update() {},
    setMoodTint() {},
  };
}
