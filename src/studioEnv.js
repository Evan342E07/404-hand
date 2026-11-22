import * as THREE from 'three/webgpu';

/**
 * Generates a high-dynamic-range procedural Leica Laboratory Studio Softbox Environment
 * baked via WebGPU/WebGL2 PMREMGenerator — produces razor-crisp architectural specular
 * reflections on brushed titanium, nano-ceramic lacquer, and optical polycarbonate glass.
 */
export function createLabStudioHDRI(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0c0f15);

  const addSoftbox = (colorHex, intensity, w, h, pos, lookAt = [0, 0, 0]) => {
    const mat = new THREE.MeshBasicNodeMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(...pos);
    mesh.lookAt(...lookAt);
    envScene.add(mesh);
  };

  // Overhead primary architectural softbox (sculpts crisp highlight across knuckles & bevels)
  addSoftbox(0xffffff, 5.2, 22, 6, [0, 18, 4]);
  // Right-front warm studio key softbox (sculpts palmar ceramic sheen & metacarpal bones)
  addSoftbox(0xfff5ec, 4.4, 14, 24, [18, 6, 16]);
  // Left-back cool cyan-white rim strip (carves razor-sharp silhouette edge on white ceramic)
  addSoftbox(0xd8ecff, 6.2, 8, 28, [-18, 8, -14]);
  // Right-back precision rim strip (highlights 4 dorsal tendon ridges & 36-tooth watch drum)
  addSoftbox(0xeaf2ff, 4.8, 7, 26, [17, 4, -15]);
  // Subtle cool floor bounce fill so dark gunmetal undersides keep machined grain
  addSoftbox(0x7c8ca8, 1.5, 26, 26, [0, -16, 0]);
  // Narrow vertical studio catchlight strip directly front-left for optical glass Fresnel edge
  addSoftbox(0xe8f6ff, 3.8, 3.4, 22, [-14, 3, 18]);

  const rt = pmrem.fromScene(envScene, 0.025);
  pmrem.dispose();
  return rt.texture;
}
