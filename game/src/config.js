// PAPER PLANE — semua konstanta bernama di satu tempat.
// Konvensi dunia: utara = -Z, timur = +X, atas = +Y.
// Heading θ: 0 = utara, 90° = timur, NAIK saat belok KANAN.
// Forward = (sin θ, 0, -cos θ).

export const CFG = {
  // --- Fisika glider ---
  MAX_SPEED: 42, // m/s, HARD CLAMP di setiap fixed step (bukan di kertas)
  MIN_SPEED: 8, // m/s, di bawah ini pesawat tidak bisa terbang
  STALL_SPEED: 8.5, // m/s, di bawah ini hidung dipaksa jatuh
  GRAVITY: 9.81,
  DRAG_K: 0.0015, // drag ∝ s² ; cruise datar ≈ 18 m/s pada γ = -0.05
  // LIFT_K dipakai untuk menghitung stall speed dari gaya angkat:
  // stall terjadi saat LIFT_K * s² < GRAVITY  →  s_stall = sqrt(GRAVITY / LIFT_K) ≈ 8.5
  LIFT_K: 9.81 / (8.5 * 8.5),
  MAX_BANK: 0.9, // rad, kemiringan maksimum
  BANK_RATE: 2.5, // rad/s, laju bank menuju target
  MAX_PITCH: 0.5, // rad, pitch maksimum
  PITCH_RATE: 1.5, // rad/s, laju pitch menuju target
  GLIDE_PITCH: -0.05, // rad, pitch natural tanpa input (glider tenggelam pelan)
  STALL_PITCH: -0.3, // rad, hidung dipaksa jatuh saat stall
  THERMAL_LIFT: 6, // m/s, tambahan kecepatan vertikal di dalam kolom termal

  // --- Dunia ---
  WORLD_SIZE: 1200, // m, lembah 1200×1200 berpusat di (0,0)
  RIVER_HALF_WIDTH: 25, // m
  MOUNTAINS: [
    // { x, z, radius, height } — kerucut origami di tepi lembah
    { x: -380, z: -350, radius: 120, height: 140 },
    { x: 380, z: -300, radius: 110, height: 120 },
    { x: -420, z: 150, radius: 130, height: 150 },
    { x: 400, z: 200, radius: 100, height: 110 },
    { x: -300, z: 380, radius: 120, height: 130 },
    { x: 300, z: 420, radius: 110, height: 120 },
  ],
  TREE_COUNT: 40,
  CLOUD_COUNT: 8,
  CRANE_COUNT: 5,

  // --- Cincin (Ring Run) ---
  RING_RADIUS: 6, // m, toleransi pass
  RING_POSITIONS: [
    { x: 0, y: 55, z: 180 },
    { x: 45, y: 60, z: 100 },
    { x: -35, y: 65, z: 20 },
    { x: 25, y: 70, z: -60 },
    { x: -55, y: 60, z: -140 },
    { x: 35, y: 55, z: -220 },
    { x: 0, y: 65, z: -300 },
    { x: 15, y: 50, z: -380 },
  ],

  // --- Termal ---
  THERMAL_RADIUS: 18, // m, silinder dari tanah sampai THERMAL_TOP
  THERMAL_TOP: 120, // m
  THERMAL_POSITIONS: [
    { x: 60, z: 80 },
    { x: -70, z: -100 },
    { x: 0, z: -260 },
  ],
  THERMAL_TARGET_ALT: 100, // m, ketinggian target misi Thermal Chase

  // --- Landing ---
  LANDING_CENTER: { x: 0, z: -460 },
  LANDING_RADIUS: 15, // m
  LANDING_MAX_PITCH: 0.18, // rad, |γ| harus di bawah ini saat menyentuh tanah
  LANDING_MAX_SPEED: 20, // m/s, kecepatan maksimum saat menyentuh tanah
  LANDING_TOUCH_HEIGHT: 0.6, // m di atas groundHeight saat kontak dihitung

  // --- Titik akhir Thermal Chase (marker melayang di atas lingkaran landing) ---
  ENDPOINT: { x: 0, y: 90, z: -460 },
  ENDPOINT_RADIUS: 20, // m

  // --- Spawn ---
  SPAWN: { x: 0, y: 55, z: 260, heading: 0, pitch: -0.02, speed: 20 },

  // --- Misi ---
  RING_RUN_DURATION: 180, // detik
  SCORE_RING: 100,
  SCORE_THERMAL: 150,
  SCORE_ALTITUDE: 200,
  SCORE_ENDPOINT: 300,
  SCORE_LANDING: 200,
  SCORE_SAFE_LANDING: 100,

  // --- Kamera ---
  CAMERA_DISTANCE: 10, // m di belakang pesawat
  CAMERA_HEIGHT: 3.5, // m di atas pesawat
  CAMERA_SMOOTH_RATE: 6, // 1-exp(-rate*dt)
  CAMERA_LOOKAHEAD: 0.35, // detik ke depan dari velocity
  CAMERA_DEADZONE: 0.5, // m, gerak di bawah ini diabaikan
  COCKPIT_DISTANCE: 3, // m di belakang hidung (mode cockpit-ish)
  COCKPIT_HEIGHT: 1.2,
  COCKPIT_FOV: 70,
  CHASE_FOV: 60,
  SHAKE_RING: 0.15, // trauma saat ring pass
  SHAKE_LAND: 0.4, // trauma saat landing / crash
  SHAKE_DECAY: 1.2, // per detik (real-time)
};

// Sungai kertas berliku: garis tengah x sebagai fungsi z (meander halus).
export function riverX(z) {
  return 150 * Math.sin(z * 0.005) + 60 * Math.sin(z * 0.013);
}
