// STATE MACHINE MISI: menu → flying → complete | failed | paused.
// Tiga misi + Free Flight. Mission Complete / Failed nyata (bukan placeholder),
// skor akhir dihitung, restart R mengulang misi yang sama dari spawn.
//
// Aturan mendarat (dipakai semua misi):
// - Menyentuh tanah (pos.y <= groundHeight + 0.6) dengan |γ| < 0.18 DAN
//   speed < 20 = pendaratan aman. Kalau tidak memenuhi = CRASH.
// - Sungai (isOverRiver dan pos.y <= 1) = crash, pesawat BERHENTI TOTAL.
// - Gunung (jarak horizontal < radius dan pos.y < tinggi) = crash.
// - Pendaratan aman di luar target (misi 1/2) = misi belum selesai, penerbangan
//   berakhir dengan status 'failed' beralasan 'landed-early' (overlay
//   menampilkan "PENDARATAN AMAN", bukan "MISSION FAILED" yang menyesatkan).

import { CFG } from './config.js';

export const MISSION_DEFS = [
  { id: 'ring-run', num: 1, name: 'Ring Run', short: 'Lewati 8 cincin dalam 180 detik.' },
  { id: 'thermal-chase', num: 2, name: 'Thermal Chase', short: 'Naik 3 termal, capai 100 m, terbang ke marker akhir.' },
  { id: 'precision-landing', num: 3, name: 'Precision Landing', short: 'Mendarat di dalam lingkaran target.' },
  { id: 'free-flight', num: 4, name: 'Free Flight', short: 'Terbang bebas tanpa timer.' },
];

export function missionDef(id) {
  return MISSION_DEFS.find((m) => m.id === id) || MISSION_DEFS[3];
}

export class MissionManager {
  constructor() {
    this.missionId = 'ring-run';
    this.status = 'menu'; // menu | flying | complete | failed | paused
    this.timeLeft = 0;
    this.score = 0;
    this.ringsPassed = 0;
    this.ringsTotal = CFG.RING_POSITIONS.length;
    this.thermalsVisited = 0;
    this.thermalsTotal = CFG.THERMAL_POSITIONS.length;
    this.altitudeReached = false;
    this.endpointReached = false;
    this.reason = ''; // 'rings' | 'time' | 'crash' | 'river' | 'mountain' | 'landing' | 'landed-early'
    this.events = []; // antrean event untuk HUD / audio / FX (dikonsumsi main.js)
    this._thermalSeen = new Set();
  }

  start(missionId) {
    this.missionId = missionId;
    this.status = 'flying';
    this.timeLeft = missionId === 'ring-run' ? CFG.RING_RUN_DURATION : 0;
    this.score = 0;
    this.ringsPassed = 0;
    this.thermalsVisited = 0;
    this.altitudeReached = false;
    this.endpointReached = false;
    this.reason = '';
    this.events = [];
    this._thermalSeen = new Set();
  }

  pause() {
    if (this.status === 'flying') this.status = 'paused';
  }

  resume() {
    if (this.status === 'paused') this.status = 'flying';
  }

  toMenu() {
    this.status = 'menu';
    this.reason = '';
    this.events = [];
  }

  // Dipanggil tiap fixed step saat flying. ctx: { state, rings, thermals, world }.
  // Mengembalikan true bila misi baru saja berakhir (complete/failed).
  update(dt, ctx) {
    if (this.status !== 'flying') return false;
    const { state, rings, thermals, world } = ctx;

    // --- Timer Ring Run ---
    if (this.missionId === 'ring-run') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        return this._fail('time');
      }
    }

    // --- Cincin (misi Ring Run; di misi lain cincin tetap dihitung skornya) ---
    const ringIndex = rings.update(state.pos);
    if (ringIndex >= 0) {
      this.ringsPassed++;
      this.score += CFG.SCORE_RING;
      this.events.push({ type: 'ring', index: ringIndex });
      if (this.missionId === 'ring-run' && rings.allPassed()) {
        this.score += Math.round(this.timeLeft) * 2; // bonus waktu tersisa
        return this._complete('rings');
      }
    }

    // --- Termal (misi Thermal Chase) ---
    const colIndex = thermals.columnIndexAt(state.pos);
    if (colIndex >= 0 && !this._thermalSeen.has(colIndex)) {
      this._thermalSeen.add(colIndex);
      this.thermalsVisited++;
      thermals.markVisited(colIndex);
      this.score += CFG.SCORE_THERMAL;
      this.events.push({ type: 'thermal', index: colIndex });
    }

    // --- Thermal Chase: ketinggian lalu titik akhir ---
    if (this.missionId === 'thermal-chase') {
      if (!this.altitudeReached && this.thermalsVisited >= this.thermalsTotal && state.pos.y >= CFG.THERMAL_TARGET_ALT) {
        this.altitudeReached = true;
        this.score += CFG.SCORE_ALTITUDE;
        this.events.push({ type: 'altitude' });
      }
      if (this.altitudeReached) {
        const dx = state.pos.x - CFG.ENDPOINT.x;
        const dy = state.pos.y - CFG.ENDPOINT.y;
        const dz = state.pos.z - CFG.ENDPOINT.z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < CFG.ENDPOINT_RADIUS) {
          this.endpointReached = true;
          this.score += CFG.SCORE_ENDPOINT;
          return this._complete('endpoint');
        }
      }
    }

    // --- Tabrakan gunung (profil kerucut: radius mengecil dengan ketinggian,
    // supaya terbang di atas lereng yang secara visual sudah jauh tidak crash) ---
    for (const m of world.mountains) {
      const d = Math.hypot(state.pos.x - m.x, state.pos.z - m.z);
      const rEff = m.radius * Math.max(0, 1 - state.pos.y / m.height);
      if (d < rEff + 2 && state.pos.y < m.height) {
        state.frozen = true;
        return this._fail('mountain');
      }
    }

    // --- Sungai: kontak air = crash, tidak boleh taxi ---
    if (world.isOverRiver(state.pos.x, state.pos.z) && state.pos.y <= 1) {
      state.pos.y = 1;
      state.frozen = true;
      return this._fail('river');
    }

    // --- Kontak tanah: landing aman atau crash ---
    const ground = world.groundHeight(state.pos.x, state.pos.z);
    if (state.pos.y <= ground + CFG.LANDING_TOUCH_HEIGHT) {
      state.pos.y = ground + CFG.LANDING_TOUCH_HEIGHT;
      const gentle = Math.abs(state.pitch) < CFG.LANDING_MAX_PITCH && state.speed < CFG.LANDING_MAX_SPEED;
      if (!gentle) {
        state.frozen = true;
        return this._fail('crash');
      }
      // Pendaratan aman.
      state.frozen = true;
      const landDist = Math.hypot(
        state.pos.x - CFG.LANDING_CENTER.x,
        state.pos.z - CFG.LANDING_CENTER.z,
      );
      if (this.missionId === 'precision-landing') {
        if (landDist < CFG.LANDING_RADIUS) {
          this.score += CFG.SCORE_LANDING;
          return this._complete('landing');
        }
        return this._fail('landed-early');
      }
      if (this.missionId === 'free-flight') {
        this.score += CFG.SCORE_SAFE_LANDING;
        return this._complete('landing');
      }
      // Misi 1/2: mendarat aman di mana saja = penerbangan selesai,
      // tapi misi belum complete.
      return this._fail('landed-early');
    }

    return false;
  }

  _complete(reason) {
    this.status = 'complete';
    this.reason = reason;
    this.events.push({ type: 'complete', reason });
    return true;
  }

  _fail(reason) {
    this.status = 'failed';
    this.reason = reason;
    this.events.push({ type: 'failed', reason });
    return true;
  }

  // Teks objektif untuk HUD (berubah mengikuti progres).
  objectiveText() {
    switch (this.missionId) {
      case 'ring-run':
        return `Ring Run — lewati cincin ${this.ringsPassed}/${this.ringsTotal}`;
      case 'thermal-chase': {
        if (this.thermalsVisited < this.thermalsTotal) {
          return `Thermal Chase — masuk termal ${this.thermalsVisited}/${this.thermalsTotal}`;
        }
        if (!this.altitudeReached) {
          return `Thermal Chase — naik sampai ${CFG.THERMAL_TARGET_ALT} m`;
        }
        return 'Thermal Chase — terbang ke marker akhir di atas lingkaran landing';
      }
      case 'precision-landing':
        return 'Precision Landing — mendarat di dalam lingkaran merah';
      default:
        return 'Free Flight — terbang bebas, mendarat aman kapan saja';
    }
  }

  endTitle() {
    if (this.status === 'complete') return 'MISSION COMPLETE';
    if (this.reason === 'landed-early') return 'PENDARATAN AMAN';
    return 'MISSION FAILED';
  }

  endSubtitle() {
    if (this.status === 'complete') {
      if (this.reason === 'rings') return 'Semua 8 cincin dilewati. Kerja bagus, pilot kertas!';
      if (this.reason === 'endpoint') return 'Tiga termal, 100 meter, dan marker akhir tercapai.';
      return 'Pendaratan presisi di dalam lingkaran. Mulus sekali.';
    }
    switch (this.reason) {
      case 'time':
        return 'Waktu 180 detik habis sebelum semua cincin dilewati.';
      case 'crash':
        return 'Mendarat terlalu cepat atau terlalu curam — pesawat kertas remuk.';
      case 'river':
        return 'Jatuh ke sungai kertas. Kertas basah tidak bisa terbang.';
      case 'mountain':
        return 'Menabrak gunung origami.';
      case 'landed-early':
        return 'Pendaratan aman, tapi target misi belum tercapai.';
      default:
        return 'Misi belum selesai.';
    }
  }
}
