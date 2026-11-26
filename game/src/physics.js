// MODEL GLIDER ARCADE — pesawat kertas tanpa throttle.
// State: pos (Vector3), heading θ (rad), pitch γ (rad), speed s (m/s), bank φ (rad).
// Dijalankan di FIXED STEP dt = 1/60 dari accumulator di main.js.
// BUKAN di frame dt — kecepatan dan belokan harus sama di frame rate apa pun.
//
// Tanda-tanda (periksa dua kali, ini yang paling penting):
// - bank kanan = φ > 0. Heading θ NAIK saat belok kanan (kompas standar:
//   utara 0°, timur 90°). Rumus belok: θ += (g * tan φ / s) * dt.
//   tan φ > 0 saat φ > 0 → θ naik. BENAR.
// - pitch naik = γ > 0 = hidung naik. Kecepatan: s += (g * sin(-γ) - drag) * dt.
//   Saat nukik (γ < 0), sin(-γ) > 0 → speed bertambah (gravitasi menarik).
//   Saat naik (γ > 0), sin(-γ) < 0 → speed berkurang. BENAR.
// - Forward = (sin θ * cos γ, sin γ, -cos θ * cos γ).
//   θ = 0 → (0, sin γ, -cos γ): ke utara (-Z) dan naik bila γ > 0. BENAR.
//   θ = 90° → (cos γ, sin γ, 0): ke timur (+X). BENAR.

import * as THREE from 'three';
import { CFG } from './config.js';

function moveToward(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

export function createGliderState(spawn) {
  const s = spawn || CFG.SPAWN;
  return {
    pos: new THREE.Vector3(s.x, s.y, s.z),
    prevPos: new THREE.Vector3(s.x, s.y, s.z),
    vel: new THREE.Vector3(0, 0, 0),
    heading: s.heading, // θ, rad
    pitch: s.pitch, // γ, rad
    speed: s.speed, // s, m/s
    bank: 0, // φ, rad
    inThermal: false,
    frozen: false, // true setelah crash / landing: pesawat BERHENTI TOTAL
  };
}

export function resetGliderState(state, spawn) {
  const s = spawn || CFG.SPAWN;
  state.pos.set(s.x, s.y, s.z);
  state.prevPos.set(s.x, s.y, s.z);
  state.vel.set(0, 0, 0);
  state.heading = s.heading;
  state.pitch = s.pitch;
  state.speed = s.speed;
  state.bank = 0;
  state.inThermal = false;
  state.frozen = false;
}

// Satu fixed step. input: { bank: -1..1, pitch: -1..1 }.
//   bank +1 = belok kanan, pitch +1 = hidung naik.
// isInThermal: fungsi (pos) => boolean, atau null kalau termal tidak aktif.
export function stepGlider(state, input, dt, isInThermal) {
  if (state.frozen) {
    state.vel.set(0, 0, 0);
    state.inThermal = false;
    return;
  }

  // --- Bank menuju target input (laju 2.5 rad/s, maks 0.9 rad) ---
  const bankTarget = (input.bank || 0) * CFG.MAX_BANK;
  state.bank = moveToward(state.bank, bankTarget, CFG.BANK_RATE * dt);

  // --- Pitch menuju target input (laju 1.5 rad/s, maks 0.5 rad) ---
  // Tanpa input pitch, γ ease ke -0.05 (glider tenggelam pelan).
  // Stall: kalau speed <= 8.5 m/s, γ dipaksa menuju -0.3 (hidung jatuh).
  let pitchTarget;
  if (state.speed <= CFG.STALL_SPEED) {
    pitchTarget = CFG.STALL_PITCH;
  } else if (input.pitch) {
    pitchTarget = input.pitch * CFG.MAX_PITCH;
  } else {
    pitchTarget = CFG.GLIDE_PITCH;
  }
  state.pitch = moveToward(state.pitch, pitchTarget, CFG.PITCH_RATE * dt);
  state.pitch = Math.max(-CFG.MAX_PITCH, Math.min(CFG.MAX_PITCH, state.pitch));

  // --- Kecepatan: dive menambah, climb mengurangi, drag ∝ s² ---
  const accel =
    CFG.GRAVITY * Math.sin(-state.pitch) - CFG.DRAG_K * state.speed * state.speed;
  state.speed += accel * dt;

  // --- HARD CLAMP di SETIAP step: tidak pernah di atas 42, tidak di bawah 8 ---
  // (LIFT_K dipakai di sini secara tidak langsung: STALL_SPEED = sqrt(g / LIFT_K).)
  state.speed = Math.max(CFG.MIN_SPEED, Math.min(CFG.MAX_SPEED, state.speed));

  // --- Heading: bank kanan (φ > 0) HARUS menaikkan θ ---
  state.heading += (CFG.GRAVITY * Math.tan(state.bank) / Math.max(state.speed, CFG.MIN_SPEED)) * dt;

  // --- Velocity + integrasi posisi ---
  const cosPitch = Math.cos(state.pitch);
  state.vel.set(
    state.speed * Math.sin(state.heading) * cosPitch,
    state.speed * Math.sin(state.pitch),
    -state.speed * Math.cos(state.heading) * cosPitch,
  );
  state.prevPos.copy(state.pos);
  state.pos.addScaledVector(state.vel, dt);

  // --- Termal: di dalam silinder (radius 18 m, tanah s.d. y=120) ---
  state.inThermal = false;
  if (isInThermal && isInThermal(state.pos)) {
    state.pos.y += CFG.THERMAL_LIFT * dt;
    state.inThermal = true;
  }
}

// Heading dalam derajat kompas 0..359 (0 = utara, 90 = timur).
export function headingDegrees(state) {
  let deg = (state.heading * 180) / Math.PI;
  deg = deg % 360;
  if (deg < 0) deg += 360;
  return deg;
}

// Arah forward 3D (termasuk pitch) sebagai Vector3 baru.
export function forwardVector(state) {
  const cosPitch = Math.cos(state.pitch);
  return new THREE.Vector3(
    Math.sin(state.heading) * cosPitch,
    Math.sin(state.pitch),
    -Math.cos(state.heading) * cosPitch,
  );
}
