// PESAWAT KERTAS — badan segitiga + 2 sayap dari bidang lipat tipis.
// Merah di atas, putih di bawah, aksen krem. Tanpa aset luar, semua geometri
// dibuat dari BufferGeometry di kode.
//
// Orientasi (konvensi dunia: utara = -Z, timur = +X, atas = +Y):
//   mesh.rotation.order = 'YXZ' (yaw-bank-pitch independen)
//   mesh.rotation.y = -θ   (heading θ; cek: R_y(-θ) memetakan forward lokal -Z
//                           ke (sin θ, 0, -cos θ). θ=0 → utara. BENAR.)
//   mesh.rotation.x = +γ   (pitch; cek: R_x(a) pada titik hidung (0,0,-1)
//                           memberi y' = sin a. a>0 → hidung NAIK. Jadi
//                           rotation.x = +γ benar untuk hidung naik.)
//   mesh.rotation.z = -φ   (bank; cek: R_z(-φ) pada titik sayap kanan (1,0,0)
//                           memberi y' = -sin φ. φ>0 → sayap kanan TURUN.
//                           Bank kanan = sayap kanan turun. BENAR.)

import * as THREE from 'three';

function triangleGeometry(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([ax, ay, az, bx, by, bz, cx, cy, cz], 3));
  geo.computeVertexNormals();
  return geo;
}

export function createPaperPlane() {
  const group = new THREE.Group();
  group.name = 'paper-plane';

  const redMat = new THREE.MeshStandardMaterial({
    color: 0xe23b3b,
    roughness: 0.7,
    metalness: 0,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xf5efe0,
    roughness: 0.8,
    metalness: 0,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  // Hidung di (0, 0, -2.2), ekor di z = +1.4, lebar sayap 3.0 m.
  const NOSE = [0, 0, -2.2];
  const TAIL_C = [0, 0.06, 1.2];
  const TAIL_L = [-1.5, 0.14, 1.4];
  const TAIL_R = [1.5, 0.14, 1.4];

  // Sayap kiri (merah, atas) + sayap kanan (merah, atas).
  const wingL = new THREE.Mesh(triangleGeometry(...NOSE, ...TAIL_L, ...TAIL_C), redMat);
  const wingR = new THREE.Mesh(triangleGeometry(...NOSE, ...TAIL_C, ...TAIL_R), redMat);
  // Lapisan bawah putih (sedikit di bawah, supaya terlihat dari bawah).
  const underL = new THREE.Mesh(
    triangleGeometry(0, -0.04, -2.2, -1.5, 0.1, 1.4, 0, 0.02, 1.2),
    whiteMat,
  );
  const underR = new THREE.Mesh(
    triangleGeometry(0, -0.04, -2.2, 0, 0.02, 1.2, 1.5, 0.1, 1.4),
    whiteMat,
  );
  // Lunas tengah (keel) vertikal — lipatan khas pesawat kertas, krem.
  const keel = new THREE.Mesh(
    triangleGeometry(0, -0.28, 1.15, 0, 0.55, 1.15, 0, 0, -2.2),
    creamMat,
  );
  // Sirip ekor kecil.
  const tailFin = new THREE.Mesh(
    triangleGeometry(0, 0.06, 1.2, 0, 0.55, 1.35, 0, 0.06, 0.55),
    redMat,
  );

  for (const m of [wingL, wingR, underL, underR, keel, tailFin]) {
    m.castShadow = true;
    group.add(m);
  }

  group.rotation.order = 'YXZ';
  return group;
}

// Terapkan state fisika ke mesh. alpha = fraksi interpolasi render (0..1)
// antara prevPos dan pos — pesawat digambar di antara dua fixed step.
export function applyPlaneTransform(mesh, state, alpha) {
  const a = alpha === undefined ? 1 : Math.max(0, Math.min(1, alpha));
  mesh.position.set(
    state.prevPos.x + (state.pos.x - state.prevPos.x) * a,
    state.prevPos.y + (state.pos.y - state.prevPos.y) * a,
    state.prevPos.z + (state.pos.z - state.prevPos.z) * a,
  );
  mesh.rotation.y = -state.heading;
  mesh.rotation.x = state.pitch;
  mesh.rotation.z = -state.bank;
}
