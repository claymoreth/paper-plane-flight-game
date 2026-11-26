// 8 CINCIN KERTAS (Ring Run) — torus tegak menghadap arah terbang.
// Pass detection: perubahan tanda dot(pos - center, normal) SAAT melewati
// bidang cincin, dan jarak ke pusat < RING_RADIUS. Ini mencegah pass palsu
// dari pesawat yang hanya terbang di dekat cincin tanpa melewatinya.

import * as THREE from 'three';
import { CFG } from './config.js';

function numberTexture(n) {
  // Label nomor urut digambar di canvas runtime (bukan aset luar).
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRings(scene) {
  const group = new THREE.Group();
  group.name = 'rings';
  scene.add(group);

  const rings = [];
  const positions = CFG.RING_POSITIONS;

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const center = new THREE.Vector3(p.x, p.y, p.z);
    // Normal cincin = arah ke cincin berikutnya (cincin terakhir: -Z / utara).
    let normal;
    if (i < positions.length - 1) {
      const q = positions[i + 1];
      normal = new THREE.Vector3(q.x - p.x, q.y - p.y, q.z - p.z).normalize();
    } else {
      normal = new THREE.Vector3(0, 0, -1);
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffc93c,
      emissive: 0xcc8800,
      emissiveIntensity: 0.6,
      roughness: 0.4,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(CFG.RING_RADIUS, 0.5, 12, 40), mat);
    mesh.position.copy(center);
    // Torus default menghadap +Z (bidang XY); putar sumbu Z ke normal.
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    mesh.castShadow = true;
    group.add(mesh);

    // Nomor urut melayang di atas cincin.
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      new THREE.MeshBasicMaterial({
        map: numberTexture(i + 1),
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    label.position.set(center.x, center.y + CFG.RING_RADIUS + 2.4, center.z);
    group.add(label);

    rings.push({
      index: i,
      center,
      normal,
      mesh,
      mat,
      label,
      passed: false,
      prevSide: 0, // tanda dot(pos-center, normal) di step sebelumnya
    });
  }

  let nextIndex = 0;

  function reset() {
    nextIndex = 0;
    for (const r of rings) {
      r.passed = false;
      r.prevSide = 0;
      r.mat.color.setHex(0xffc93c);
      r.mat.emissive.setHex(0xcc8800);
      r.mat.emissiveIntensity = 0.6;
    }
    highlightActive();
  }

  function highlightActive() {
    for (const r of rings) {
      if (r.passed) {
        r.mat.color.setHex(0x2ecc71);
        r.mat.emissive.setHex(0x1e8449);
        r.mat.emissiveIntensity = 0.25; // sudah dilewati: hijau redup
      } else if (r.index === nextIndex) {
        r.mat.color.setHex(0xffc93c);
        r.mat.emissive.setHex(0xffaa00);
        r.mat.emissiveIntensity = 1.4; // cincin aktif: menyala
      } else {
        r.mat.color.setHex(0xffc93c);
        r.mat.emissive.setHex(0xcc8800);
        r.mat.emissiveIntensity = 0.6;
      }
    }
  }

  // Dipanggil tiap fixed step saat status flying. Mengembalikan indeks cincin
  // yang baru saja dilewati, atau -1.
  function update(pos) {
    if (nextIndex >= rings.length) return -1;
    const r = rings[nextIndex];
    const toPlane = new THREE.Vector3().subVectors(pos, r.center);
    const side = Math.sign(toPlane.dot(r.normal)) || 1;
    let passed = -1;
    if (r.prevSide !== 0 && side !== r.prevSide) {
      // Baru saja menembus bidang cincin — cek jarak ke pusat.
      const dist = pos.distanceTo(r.center);
      if (dist < CFG.RING_RADIUS + 2) {
        r.passed = true;
        passed = r.index;
        nextIndex++;
        highlightActive();
      }
    }
    r.prevSide = side;
    return passed;
  }

  function count() {
    return rings.length;
  }

  function passedCount() {
    return nextIndex;
  }

  function allPassed() {
    return nextIndex >= rings.length;
  }

  // Label nomor selalu menghadap kamera.
  function faceLabels(camera) {
    for (const r of rings) {
      r.label.quaternion.copy(camera.quaternion);
    }
  }

  reset();
  return { group, rings, update, reset, count, passedCount, allPassed, faceLabels };
}
