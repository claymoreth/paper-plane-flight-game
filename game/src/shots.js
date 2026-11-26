// SHOT STATES — ?shot=hero/rings/thermal/landing (+&seed=).
// Set state deterministik untuk screenshot: auto-mulai misi terkait,
// pesawat terbang lurus pelan, tanpa input user. Menu disembunyikan.
// - hero: pesawat di atas lembah, gunung + cincin di depan, kamera chase.
// - rings: pesawat 20 m di depan cincin #1, cincin menyala.
// - thermal: pesawat di dalam kolom termal #1, partikel naik.
// - landing: final approach 60 m dari lingkaran target, rendah dan pelan.

import { CFG } from './config.js';

export function applyShot(search, ctx) {
  const params = new URLSearchParams(search || '');
  const shot = params.get('shot');
  if (!shot) return null;
  const { state, missions, rings, thermals, camera, hud } = ctx;

  const startFlying = (missionId, x, y, z, heading, pitch, speed) => {
    missions.start(missionId);
    rings.reset();
    thermals.reset();
    state.pos.set(x, y, z);
    state.prevPos.set(x, y, z);
    state.heading = heading;
    state.pitch = pitch;
    state.speed = speed;
    state.bank = 0;
    state.vel.set(0, 0, 0);
    state.frozen = false;
    state.inThermal = false;
    camera.snapTo(state);
    if (hud) hud.hideMenu();
  };

  if (shot === 'hero') {
    // Di atas lembah menghadap utara: gunung di kejauhan, cincin #1 di depan.
    startFlying('free-flight', 0, 70, 300, 0, -0.02, 20);
    return 'hero';
  }
  if (shot === 'rings') {
    // 20 m di depan cincin #1 (pusat 0,55,180 → pesawat di z=200).
    const c = CFG.RING_POSITIONS[0];
    startFlying('ring-run', c.x, c.y, c.z + 20, 0, 0, 18);
    return 'rings';
  }
  if (shot === 'thermal') {
    // Di dalam kolom termal #1 (60, 80), ketinggian 50 m, partikel naik.
    const t = CFG.THERMAL_POSITIONS[0];
    startFlying('thermal-chase', t.x, 50, t.z, 0, 0.1, 14);
    state.inThermal = true;
    return 'thermal';
  }
  if (shot === 'landing') {
    // Final approach: 60 m di selatan lingkaran (z=-400), rendah, pelan.
    startFlying(
      'precision-landing',
      CFG.LANDING_CENTER.x,
      12,
      CFG.LANDING_CENTER.z + 60,
      0,
      -0.08,
      16,
    );
    return 'landing';
  }
  return null;
}
