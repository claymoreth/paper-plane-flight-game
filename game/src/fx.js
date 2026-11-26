// FX — burst partikel THREE.Points saat ring pass (30 titik emas, mekar
// 0.6 detik) + jejak tipis saat di termal. Deterministik, tanpa aset luar.
// Implementasi: satu pool Points 300 slot; tiap titik punya kecepatan dan
// sisa hidup; warna memudar ke hitam (additive blending → hitam = tak terlihat).

import * as THREE from 'three';

const POOL_SIZE = 300;
const GOLD = new THREE.Color(0xffc93c);
const WHITE = new THREE.Color(0xffffff);

// Tekstur titik lembut (lingkaran radial) — tanpa ini THREE.Points
// ter-render sebagai KOTAK putih; jejak termal (2 titik/frame di posisi
// pesawat) menumpuk jadi kolom balok putih raksasa di belakang pesawat
// (cacat visual shot thermal, 26 Nov).
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

export class FX {
  constructor(scene) {
    this.positions = new Float32Array(POOL_SIZE * 3);
    this.colors = new Float32Array(POOL_SIZE * 3);
    this.velocities = new Float32Array(POOL_SIZE * 3);
    this.life = new Float32Array(POOL_SIZE); // sisa hidup (detik), 0 = mati
    this.maxLife = new Float32Array(POOL_SIZE);
    this.baseColor = new Float32Array(POOL_SIZE * 3);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.9,
      map: makeSoftDotTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  _spawn(x, y, z, vx, vy, vz, life, color) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % POOL_SIZE;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.velocities[i * 3] = vx;
    this.velocities[i * 3 + 1] = vy;
    this.velocities[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.baseColor[i * 3] = color.r;
    this.baseColor[i * 3 + 1] = color.g;
    this.baseColor[i * 3 + 2] = color.b;
  }

  // Burst emas saat ring pass: 30 titik mekar ke segala arah, hidup 0.6 dtk.
  burst(pos) {
    for (let i = 0; i < 30; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 4 + Math.random() * 8;
      this._spawn(
        pos.x, pos.y, pos.z,
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        0.6,
        GOLD,
      );
    }
  }

  // Jejak tipis saat di termal: 2 titik putih naik pelan dari posisi pesawat.
  trail(pos) {
    for (let i = 0; i < 2; i++) {
      this._spawn(
        pos.x + (Math.random() - 0.5) * 2,
        pos.y + (Math.random() - 0.5) * 1,
        pos.z + (Math.random() - 0.5) * 2,
        0, 2 + Math.random() * 2, 0,
        0.8,
        WHITE,
      );
    }
  }

  update(dt) {
    let anyAlive = false;
    for (let i = 0; i < POOL_SIZE; i++) {
      if (this.life[i] <= 0) {
        this.colors[i * 3] = 0;
        this.colors[i * 3 + 1] = 0;
        this.colors[i * 3 + 2] = 0;
        continue;
      }
      anyAlive = true;
      this.life[i] -= dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      this.colors[i * 3] = this.baseColor[i * 3] * f;
      this.colors[i * 3 + 1] = this.baseColor[i * 3 + 1] * f;
      this.colors[i * 3 + 2] = this.baseColor[i * 3 + 2] * f;
    }
    if (anyAlive) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }
}
