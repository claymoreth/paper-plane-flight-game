// 3 KOLOM TERMAL — silinder transparan + partikel naik berputar.
// Masuk ke dalam kolom = pesawat naik +6 m/s (lihat physics.js) dan
// misi Thermal Chase menghitung kunjungan.

import * as THREE from 'three';
import { CFG } from './config.js';

const PARTICLES_PER_COLUMN = 120;

// Tekstur titik lembut (lingkaran radial) — tanpa ini THREE.Points
// ter-render sebagai KOTAK putih; dari dekat (kamera di dalam kolom)
// kotak-kotak itu menutupi layar (cacat visual shot thermal, 26 Nov).
function makeSoftDotTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createThermals(scene, rng) {
  const group = new THREE.Group();
  group.name = 'thermals';
  scene.add(group);

  const columns = [];

  for (let i = 0; i < CFG.THERMAL_POSITIONS.length; i++) {
    const t = CFG.THERMAL_POSITIONS[i];
    const cx = t.x;
    const cz = t.z;

    // Silinder transparan penanda kolom.
    const cylMat = new THREE.MeshBasicMaterial({
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(CFG.THERMAL_RADIUS, CFG.THERMAL_RADIUS, CFG.THERMAL_TOP, 24, 1, true),
      cylMat,
    );
    cyl.position.set(cx, CFG.THERMAL_TOP / 2, cz);
    group.add(cyl);

    // Ring penanda di tanah.
    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(CFG.THERMAL_RADIUS - 1.5, CFG.THERMAL_RADIUS, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.set(cx, 0.35, cz);
    group.add(baseRing);

    // Partikel naik: THREE.Points, ~120 titik per kolom.
    const positions = new Float32Array(PARTICLES_PER_COLUMN * 3);
    const speeds = new Float32Array(PARTICLES_PER_COLUMN);
    const angles = new Float32Array(PARTICLES_PER_COLUMN);
    const radii = new Float32Array(PARTICLES_PER_COLUMN);
    for (let j = 0; j < PARTICLES_PER_COLUMN; j++) {
      angles[j] = rng() * Math.PI * 2;
      radii[j] = Math.sqrt(rng()) * (CFG.THERMAL_RADIUS - 2);
      positions[j * 3] = cx + Math.cos(angles[j]) * radii[j];
      positions[j * 3 + 1] = rng() * CFG.THERMAL_TOP;
      positions[j * 3 + 2] = cz + Math.sin(angles[j]) * radii[j];
      speeds[j] = 4 + rng() * 5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.9,
      map: makeSoftDotTexture(),
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    group.add(points);

    columns.push({ cx, cz, cylMat, baseRing, points, positions, speeds, angles, radii, visited: false });
  }

  function isInside(pos) {
    for (const c of columns) {
      const dx = pos.x - c.cx;
      const dz = pos.z - c.cz;
      if (dx * dx + dz * dz < CFG.THERMAL_RADIUS * CFG.THERMAL_RADIUS && pos.y > 0 && pos.y < CFG.THERMAL_TOP) {
        return c;
      }
    }
    return null;
  }

  // Mengembalikan indeks kolom yang sedang dimasuki, atau -1.
  function columnIndexAt(pos) {
    const c = isInside(pos);
    return c ? columns.indexOf(c) : -1;
  }

  function markVisited(index) {
    if (columns[index]) {
      columns[index].visited = true;
      columns[index].cylMat.opacity = 0.05;
    }
  }

  function reset() {
    for (const c of columns) {
      c.visited = false;
      c.cylMat.opacity = 0.1;
    }
  }

  function update(dt) {
    for (const c of columns) {
      const arr = c.positions;
      for (let j = 0; j < PARTICLES_PER_COLUMN; j++) {
        // Naik + berputar pelan; reset ke bawah saat mencapai puncak.
        c.angles[j] += dt * 0.6;
        arr[j * 3 + 1] += c.speeds[j] * dt;
        if (arr[j * 3 + 1] > CFG.THERMAL_TOP) arr[j * 3 + 1] = 0;
        arr[j * 3] = c.cx + Math.cos(c.angles[j]) * c.radii[j];
        arr[j * 3 + 2] = c.cz + Math.sin(c.angles[j]) * c.radii[j];
      }
      c.points.geometry.attributes.position.needsUpdate = true;
    }
  }

  return { group, columns, isInside, columnIndexAt, markVisited, reset, update };
}
