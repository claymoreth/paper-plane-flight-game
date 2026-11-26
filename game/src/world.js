// LEMBAH ORIGAMI — dunia kertas lipat ~1200×1200 m.
// Tanah kertas krem dengan lipatan halus, sungai kertas biru berliku,
// 6 gunung origami warna-warni, pohon kertas, awan datar, bangau kertas,
// lingkaran landing. Semua penempatan acak memakai RNG seeded (deterministik).

import * as THREE from 'three';
import { CFG, riverX } from './config.js';
import { range, pick } from './random.js';

const MOUNTAIN_COLORS = [0xe23b3b, 0xf08a24, 0xf2c230, 0x4caf50, 0x3b82e2, 0x8b5cf6];
const TREE_GREENS = [0x4caf50, 0x66bb6a, 0x2e9e5b, 0x81c784];

function groundBump(rng) {
  // Lipatan halus: jumlah beberapa sinus dengan fase acak (deterministik per seed).
  const a1 = range(rng, 0, Math.PI * 2);
  const a2 = range(rng, 0, Math.PI * 2);
  const a3 = range(rng, 0, Math.PI * 2);
  return (x, z) =>
    0.8 * Math.sin(x * 0.008 + a1) * Math.cos(z * 0.006 + a2) +
    0.5 * Math.sin((x + z) * 0.004 + a3);
}

export function createWorld(scene, rng) {
  const group = new THREE.Group();
  group.name = 'origami-valley';
  scene.add(group);

  const bump = groundBump(rng);
  const half = CFG.WORLD_SIZE / 2;

  // --- Tanah: PlaneGeometry dengan lipatan halus + flat shading, kertas krem ---
  const groundGeo = new THREE.PlaneGeometry(CFG.WORLD_SIZE, CFG.WORLD_SIZE, 60, 60);
  groundGeo.rotateX(-Math.PI / 2);
  const posAttr = groundGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    let h = bump(x, z);
    // Ratakan dekat sungai (sungai harus tetap di atas tanah) dan dekat landing.
    const riverDist = Math.abs(x - riverX(z));
    if (riverDist < 40) h *= 0.15;
    const landDist = Math.hypot(x - CFG.LANDING_CENTER.x, z - CFG.LANDING_CENTER.z);
    if (landDist < 45) h = 0;
    posAttr.setY(i, h);
  }
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xf2e6c9,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  // --- Sungai kertas biru: strip datar mengikuti meander, y = 0.25 (zona crash) ---
  const riverPts = [];
  const SEG = 60;
  for (let i = 0; i <= SEG; i++) {
    const z = -half + (i / SEG) * CFG.WORLD_SIZE;
    riverPts.push({ z, cx: riverX(z) });
  }
  const riverPositions = [];
  const riverIndex = [];
  for (let i = 0; i < riverPts.length; i++) {
    const { z, cx } = riverPts[i];
    riverPositions.push(cx - CFG.RIVER_HALF_WIDTH, 0.25, z);
    riverPositions.push(cx + CFG.RIVER_HALF_WIDTH, 0.25, z);
    if (i < riverPts.length - 1) {
      const a = i * 2;
      riverIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(riverPositions, 3));
  riverGeo.setIndex(riverIndex);
  riverGeo.computeVertexNormals();
  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x7fc4e8,
    roughness: 0.5,
    metalness: 0,
    flatShading: true,
  });
  const river = new THREE.Mesh(riverGeo, riverMat);
  river.name = 'river';
  group.add(river);

  // --- Gunung origami: kerucut 5 sisi (lipatan), warna-warni, flat shading ---
  const mountains = [];
  for (let i = 0; i < CFG.MOUNTAINS.length; i++) {
    const m = CFG.MOUNTAINS[i];
    const geo = new THREE.ConeGeometry(m.radius, m.height, 5);
    const mat = new THREE.MeshStandardMaterial({
      color: MOUNTAIN_COLORS[i % MOUNTAIN_COLORS.length],
      roughness: 0.9,
      metalness: 0,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(m.x, m.height / 2 - 2, m.z);
    mesh.rotation.y = range(rng, 0, Math.PI);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `mountain-${i}`;
    group.add(mesh);
    // Salju kertas di puncak: kerucut kecil putih.
    const capGeo = new THREE.ConeGeometry(m.radius * 0.28, m.height * 0.22, 5);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(m.x, m.height - 2 - m.height * 0.11, m.z);
    cap.rotation.y = mesh.rotation.y;
    group.add(cap);
    mountains.push({ x: m.x, z: m.z, radius: m.radius, height: m.height });
  }

  // --- Pohon kertas: batang silinder + tajuk kerucut, ~40 pohon ---
  const treePositions = [];
  let guard = 0;
  while (treePositions.length < CFG.TREE_COUNT && guard < 800) {
    guard++;
    const x = range(rng, -half + 40, half - 40);
    const z = range(rng, -half + 40, half - 40);
    if (Math.abs(x - riverX(z)) < 45) continue; // jangan tumbuh di sungai
    if (mountains.some((m) => Math.hypot(x - m.x, z - m.z) < m.radius + 20)) continue;
    if (Math.hypot(x - CFG.LANDING_CENTER.x, z - CFG.LANDING_CENTER.z) < 35) continue;
    treePositions.push({ x, z });
  }
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xb08954, roughness: 1, flatShading: true });
  for (const t of treePositions) {
    const tree = new THREE.Group();
    const h = range(rng, 5, 9);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, h * 0.45, 5), trunkMat);
    trunk.position.y = (h * 0.45) / 2;
    tree.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({
      color: pick(rng, TREE_GREENS),
      roughness: 1,
      flatShading: true,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(h * 0.38, h * 0.75, 6), leafMat);
    cone.position.y = h * 0.45 + (h * 0.75) / 2 - 0.5;
    cone.castShadow = true;
    tree.add(cone);
    tree.position.set(t.x, 0, t.z);
    tree.rotation.y = range(rng, 0, Math.PI * 2);
    group.add(tree);
  }

  // --- Awan datar putih: bola pipih di y 80–120 ---
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const clouds = [];
  for (let i = 0; i < CFG.CLOUD_COUNT; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < puffs; j++) {
      const r = range(rng, 6, 14);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), cloudMat);
      puff.position.set(range(rng, -14, 14), range(rng, -2, 2), range(rng, -6, 6));
      puff.scale.y = 0.35;
      cloud.add(puff);
    }
    cloud.position.set(range(rng, -half + 80, half - 80), range(rng, 80, 120), range(rng, -half + 80, half - 80));
    group.add(cloud);
    clouds.push(cloud);
  }

  // --- Bangau kertas: bentuk sederhana dari cone + box putih, 5 ekor (kolektibel visual) ---
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
  const cranes = [];
  for (let i = 0; i < CFG.CRANE_COUNT; i++) {
    const crane = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5, 4), craneMat);
    body.rotation.x = Math.PI / 2; // hidung ke -Z
    body.rotation.y = Math.PI / 4;
    crane.add(body);
    const wingGeo = new THREE.PlaneGeometry(4.5, 2.2);
    const wingL = new THREE.Mesh(wingGeo, craneMat);
    wingL.position.set(-2.2, 0.4, 0.3);
    wingL.rotation.z = 0.35;
    crane.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, craneMat);
    wingR.position.set(2.2, 0.4, 0.3);
    wingR.rotation.z = -0.35;
    crane.add(wingR);
    const baseX = range(rng, -300, 300);
    const baseZ = range(rng, -400, 200);
    const baseY = range(rng, 40, 70);
    crane.position.set(baseX, baseY, baseZ);
    crane.rotation.y = range(rng, 0, Math.PI * 2);
    group.add(crane);
    cranes.push({ mesh: crane, baseY, phase: range(rng, 0, Math.PI * 2) });
  }

  // --- Lingkaran landing: ring putih/merah radius 15 m di tanah ---
  const landingGroup = new THREE.Group();
  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(CFG.LANDING_RADIUS - 2, CFG.LANDING_RADIUS, 48),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }),
  );
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.3;
  landingGroup.add(outerRing);
  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(CFG.LANDING_RADIUS - 4, CFG.LANDING_RADIUS - 2, 48),
    new THREE.MeshStandardMaterial({ color: 0xe23b3b, roughness: 0.8, side: THREE.DoubleSide }),
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.31;
  landingGroup.add(innerRing);
  const centerDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2, 24),
    new THREE.MeshStandardMaterial({ color: 0xe23b3b, roughness: 0.8, side: THREE.DoubleSide }),
  );
  centerDisc.rotation.x = -Math.PI / 2;
  centerDisc.position.y = 0.31;
  landingGroup.add(centerDisc);
  landingGroup.position.set(CFG.LANDING_CENTER.x, 0, CFG.LANDING_CENTER.z);
  landingGroup.name = 'landing-circle';
  group.add(landingGroup);

  // --- API dunia untuk fisika / misi ---
  function groundHeight(x, z) {
    // Lipatan tanah yang sama dengan mesh visual (supaya pesawat tidak
    // tenggelam/melayang saat mendarat), lalu profil kerucut gunung.
    let h = bump(x, z);
    const riverDist = Math.abs(x - riverX(z));
    if (riverDist < 40) h *= 0.15;
    const landDist = Math.hypot(x - CFG.LANDING_CENTER.x, z - CFG.LANDING_CENTER.z);
    if (landDist < 45) h = 0;
    for (const m of mountains) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.radius) {
        h = Math.max(h, m.height * (1 - d / m.radius));
      }
    }
    return h;
  }

  function isOverRiver(x, z) {
    return Math.abs(x - riverX(z)) < CFG.RIVER_HALF_WIDTH;
  }

  // Animasi ringan: bangau melayang naik-turun, awan bergeser pelan.
  function update(dt, t) {
    for (const c of cranes) {
      c.mesh.position.y = c.baseY + Math.sin(t * 0.5 + c.phase) * 1.5;
    }
    for (let i = 0; i < clouds.length; i++) {
      clouds[i].position.x += dt * 0.8;
      if (clouds[i].position.x > half + 60) clouds[i].position.x = -half - 60;
    }
  }

  return { group, groundHeight, isOverRiver, mountains, update };
}
