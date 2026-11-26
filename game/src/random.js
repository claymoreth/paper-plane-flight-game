// RNG deterministik (mulberry32). Seed dari ?seed=, default 1.
// Semua penempatan acak dunia (pohon, awan, bangau, lipatan tanah) memakai ini
// supaya screenshot dan playtest bisa diulang persis dengan seed yang sama.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ambil seed dari query string (?seed=...). Fallback 1 kalau tidak ada / tidak valid.
export function seedFromLocation(search) {
  const params = new URLSearchParams(search || '');
  const raw = params.get('seed');
  const n = raw === null ? 1 : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 1;
}

// Helper: angka acak dalam [min, max) dari rng yang diberikan.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Helper: pilih satu elemen array secara acak.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
