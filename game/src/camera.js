// KAMERA CHASE + MODE COCKPIT-ISH.
// - Chase: posisi target = pos - forward*10 + up*3.5, smoothing eksponensial
//   1-exp(-6*dt), look-ahead = pos + velocity*0.35, deadzone 0.5 m.
// - Update SETELAH pesawat bergerak (late update, dipanggil main.js sesudah
//   semua fixed step).
// - Shake HANYA offset kamera: trauma² * sinus acak halus, decay 1.2/dtk.
//   TIDAK PERNAH menggerakkan pesawat.

import * as THREE from 'three';
import { CFG } from './config.js';
import { forwardVector } from './physics.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase'; // 'chase' | 'cockpit'
    this.trauma = 0;
    this._smoothPos = new THREE.Vector3(0, 60, 280);
    this._smoothLook = new THREE.Vector3(0, 55, 250);
    this._time = 0;
    this._initialized = false;
  }

  toggleMode() {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
    this.camera.fov = this.mode === 'cockpit' ? CFG.COCKPIT_FOV : CFG.CHASE_FOV;
    this.camera.updateProjectionMatrix();
    return this.mode;
  }

  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  snapTo(state) {
    // Posisikan kamera langsung di belakang pesawat (dipakai saat reset/shot).
    const fwd = forwardVector(state);
    const target = new THREE.Vector3().copy(state.pos).addScaledVector(fwd, -CFG.CAMERA_DISTANCE);
    target.y += CFG.CAMERA_HEIGHT;
    this._smoothPos.copy(target);
    this._smoothLook.copy(state.pos);
    this._initialized = true;
  }

  update(dt, state, alpha) {
    this._time += dt;
    this.trauma = Math.max(0, this.trauma - CFG.SHAKE_DECAY * dt);

    // Posisi pesawat terinterpolasi (render) untuk kamera yang halus.
    const a = Math.max(0, Math.min(1, alpha === undefined ? 1 : alpha));
    const px = state.prevPos.x + (state.pos.x - state.prevPos.x) * a;
    const py = state.prevPos.y + (state.pos.y - state.prevPos.y) * a;
    const pz = state.prevPos.z + (state.pos.z - state.prevPos.z) * a;
    const interp = new THREE.Vector3(px, py, pz);
    const fwd = forwardVector(state);

    let desiredPos;
    let desiredLook;
    if (this.mode === 'cockpit') {
      // Dekat di belakang hidung, melihat jauh ke depan.
      desiredPos = new THREE.Vector3().copy(interp).addScaledVector(fwd, -CFG.COCKPIT_DISTANCE);
      desiredPos.y += CFG.COCKPIT_HEIGHT;
      desiredLook = new THREE.Vector3().copy(interp).addScaledVector(fwd, 30);
    } else {
      desiredPos = new THREE.Vector3().copy(interp).addScaledVector(fwd, -CFG.CAMERA_DISTANCE);
      desiredPos.y += CFG.CAMERA_HEIGHT;
      desiredLook = new THREE.Vector3().copy(interp).addScaledVector(state.vel, CFG.CAMERA_LOOKAHEAD);
    }

    if (!this._initialized) {
      this._smoothPos.copy(desiredPos);
      this._smoothLook.copy(desiredLook);
      this._initialized = true;
    }

    // Deadzone kecil: abaikan gerak target < 0.5 m dari posisi halus saat ini.
    const k = 1 - Math.exp(-CFG.CAMERA_SMOOTH_RATE * dt);
    if (desiredPos.distanceTo(this._smoothPos) > CFG.CAMERA_DEADZONE) {
      this._smoothPos.lerp(desiredPos, k);
    }
    if (desiredLook.distanceTo(this._smoothLook) > CFG.CAMERA_DEADZONE) {
      this._smoothLook.lerp(desiredLook, k);
    }

    // Shake: offset kamera saja, trauma², sinus dengan frekuensi berbeda.
    const shake = this.trauma * this.trauma;
    const t = this._time;
    const ox = shake * 0.6 * Math.sin(t * 47.3);
    const oy = shake * 0.6 * Math.sin(t * 39.7 + 1.3);
    const oz = shake * 0.6 * Math.sin(t * 43.1 + 2.1);

    this.camera.position.set(
      this._smoothPos.x + ox,
      this._smoothPos.y + oy,
      this._smoothPos.z + oz,
    );
    this.camera.lookAt(this._smoothLook);
  }
}
