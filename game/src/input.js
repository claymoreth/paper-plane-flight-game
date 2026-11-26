// INPUT — action map bernama. Held vs edge dibedakan:
// - held: pitchUp / pitchDown / bankLeft / bankRight (ditahan selama tombol ditekan)
// - edge: pause / mute / restart / start / menu / camera (sekali per tekanan)
// Arrow dan Space di-preventDefault supaya halaman tidak scroll.
// Input penerbangan diabaikan saat menu (kecuali Enter dan Digit1-4 pilih misi).

const HELD_KEYS = {
  pitchUp: ['KeyW', 'ArrowUp'],
  pitchDown: ['KeyS', 'ArrowDown'],
  bankLeft: ['KeyA', 'ArrowLeft'],
  bankRight: ['KeyD', 'ArrowRight'],
};

const EDGE_KEYS = {
  pause: ['KeyP'],
  mute: ['KeyM'],
  restart: ['KeyR'],
  start: ['Enter'],
  menu: ['Escape'],
  camera: ['KeyC'],
};

export class Input {
  constructor() {
    this._down = new Set(); // code yang sedang ditekan
    this._edge = new Set(); // action edge yang belum dikonsumsi
    this._digitEdge = 0; // 1..4 saat Digit1..4 ditekan (edge)
    this._onKeyDown = (e) => {
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
        e.preventDefault();
      }
      if (e.repeat) return;
      this._down.add(e.code);
      for (const [action, codes] of Object.entries(EDGE_KEYS)) {
        if (codes.includes(e.code)) this._edge.add(action);
      }
      if (e.code.startsWith('Digit')) {
        const n = Number.parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 4) this._digitEdge = n;
      }
    };
    this._onKeyUp = (e) => {
      this._down.delete(e.code);
    };
    this._onBlur = () => {
      this._down.clear();
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  // Apakah action held sedang ditekan (untuk pitch/bank).
  held(action) {
    const codes = HELD_KEYS[action];
    if (!codes) return false;
    return codes.some((c) => this._down.has(c));
  }

  // Ambil dan konsumsi satu edge (true sekali per tekanan tombol).
  edge(action) {
    if (this._edge.has(action)) {
      this._edge.delete(action);
      return true;
    }
    return false;
  }

  // Ambil dan konsumsi pilihan misi Digit1-4 (0 = tidak ada).
  digit() {
    const n = this._digitEdge;
    this._digitEdge = 0;
    return n;
  }

  // Nilai input penerbangan gabungan: bank -1 (kiri) .. +1 (kanan),
  // pitch -1 (nukik) .. +1 (naik).
  flightInput() {
    const bank = (this.held('bankRight') ? 1 : 0) - (this.held('bankLeft') ? 1 : 0);
    const pitch = (this.held('pitchUp') ? 1 : 0) - (this.held('pitchDown') ? 1 : 0);
    return { bank, pitch };
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
