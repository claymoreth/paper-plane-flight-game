// HUD — update DOM dari event/state. Angka (ALT/SPEED/HEADING/TIME/SCORE)
// diupdate tiap frame karena nilainya berubah; teks objektif hanya diupdate
// saat isinya berubah. TIDAK ADA FPS counter di mana pun.
//
// Kompas: strip N/E/S/W bergeser ke KIRI saat heading naik (kompas berputar
// ke kanan — konvensi standar: belok kanan → angka heading naik → strip
// bergerak kiri supaya label berikutnya masuk dari kanan).

import { headingDegrees } from './physics.js';
import { CFG } from './config.js';

function el(id) {
  const node = document.getElementById(id);
  return node || null;
}

export class HUD {
  constructor() {
    this.alt = el('hud-alt');
    this.speed = el('hud-speed');
    this.headingNum = el('hud-heading-num');
    this.compassStrip = el('compass-strip');
    this.time = el('hud-time');
    this.score = el('hud-score');
    this.objective = el('hud-objective');
    this.rings = el('hud-rings');
    this.thermal = el('hud-thermal');
    this.menu = el('menu');
    this.pauseOverlay = el('pause-overlay');
    this.endOverlay = el('end-overlay');
    this.endTitle = el('end-title');
    this.endSubtitle = el('end-subtitle');
    this.endScore = el('end-score');
    this.missionName = el('hud-mission');
    this._lastObjective = '';
    this._lastRings = '';
    this._buildCompass();
  }

  // Strip kompas: tick tiap 15°, label kardinal tiap 90°, dua putaran (0..720°)
  // supaya geseran selalu mulus melewati batas 0/360. 3 px per derajat.
  _buildCompass() {
    if (!this.compassStrip) return;
    const PX_PER_DEG = 3;
    let html = '';
    for (let deg = 0; deg <= 720; deg += 15) {
      const label = deg % 360 === 0 ? 'N' : deg % 360 === 90 ? 'E' : deg % 360 === 180 ? 'S' : deg % 360 === 270 ? 'W' : '';
      const cls = label ? 'tick cardinal' : 'tick';
      html += `<span class="${cls}" style="left:${deg * PX_PER_DEG}px">${label || '·'}</span>`;
    }
    this.compassStrip.innerHTML = html;
    this.compassStrip.style.width = `${721 * PX_PER_DEG}px`;
    this._pxPerDeg = PX_PER_DEG;
  }

  update(state, mission, cameraMode) {
    const deg = headingDegrees(state);

    if (this.alt) this.alt.textContent = `${Math.max(0, Math.round(state.pos.y))} m`;
    if (this.speed) this.speed.textContent = `${state.speed.toFixed(1)} / ${CFG.MAX_SPEED} m/s`;
    if (this.headingNum) this.headingNum.textContent = `${String(Math.round(deg)).padStart(3, '0')}°`;

    // Strip bergeser ke KIRI saat heading naik.
    if (this.compassStrip) {
      const centerDeg = deg + 360; // putaran kedua supaya tidak ada lompatan
      const centerX = this.compassStrip.parentElement
        ? this.compassStrip.parentElement.clientWidth / 2
        : 120;
      this.compassStrip.style.transform = `translateX(${centerX - centerDeg * this._pxPerDeg}px)`;
    }

    if (this.time) {
      if (mission.missionId === 'ring-run' && mission.status !== 'menu') {
        const t = Math.max(0, Math.ceil(mission.timeLeft));
        this.time.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      } else {
        this.time.textContent = '--:--';
      }
    }
    if (this.score) this.score.textContent = String(mission.score);
    if (this.missionName) {
      this.missionName.textContent =
        mission.status === 'menu' ? 'PAPER PLANE' : missionDefName(mission.missionId);
    }

    const obj = mission.status === 'menu' ? '' : mission.objectiveText();
    if (obj !== this._lastObjective) {
      this._lastObjective = obj;
      if (this.objective) this.objective.textContent = obj;
    }

    const ringsText = `RINGS ${mission.ringsPassed}/${mission.ringsTotal}`;
    if (ringsText !== this._lastRings) {
      this._lastRings = ringsText;
      if (this.rings) this.rings.textContent = ringsText;
    }

    if (this.thermal) {
      this.thermal.classList.toggle('on', state.inThermal);
      this.thermal.textContent = state.inThermal ? 'THERMAL ↑ +6 m/s' : 'THERMAL —';
    }
  }

  showMenu() {
    if (this.menu) this.menu.classList.remove('hidden');
    if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
    if (this.endOverlay) this.endOverlay.classList.add('hidden');
  }

  hideMenu() {
    if (this.menu) this.menu.classList.add('hidden');
  }

  showPause(show) {
    if (this.pauseOverlay) this.pauseOverlay.classList.toggle('hidden', !show);
  }

  showEnd(mission) {
    if (this.endTitle) this.endTitle.textContent = mission.endTitle();
    if (this.endSubtitle) this.endSubtitle.textContent = mission.endSubtitle();
    if (this.endScore) this.endScore.textContent = `SKOR AKHIR: ${mission.score}`;
    if (this.endOverlay) this.endOverlay.classList.remove('hidden');
  }

  hideEnd() {
    if (this.endOverlay) this.endOverlay.classList.add('hidden');
  }
}

function missionDefName(id) {
  if (id === 'ring-run') return 'RING RUN';
  if (id === 'thermal-chase') return 'THERMAL CHASE';
  if (id === 'precision-landing') return 'PRECISION LANDING';
  return 'FREE FLIGHT';
}
