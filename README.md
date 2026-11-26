# PAPER PLANE

[![bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/claymoreth/paper-plane-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/claymoreth/paper-plane-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

Pesawat kertas melayang di dunia origami: lembah kertas krem, sungai kertas biru, gunung origami warna-warni, pohon kertas, awan datar, dan bangau kertas. Ini glider tanpa throttle — kecepatan datang dari nukik, ketinggian datang dari termal. Tiga misi plus Free Flight, semua di three.js (r187) tanpa aset luar.

Kompetisi: [make.fun — best-flight-game-20261126-0057](https://make.fun/bounty/best-flight-game-20261126-0057) · [make.fun](https://make.fun)

## Cara main

- **W/S** atau **↑/↓**: pitch (naik / nukik) — nukik menambah kecepatan, naik menguranginya.
- **A/D** atau **←/→**: bank / belok. Belok kanan menaikkan angka heading (kompas standar).
- **C**: ganti kamera (chase / cockpit-ish).
- **P**: pause · **M**: mute · **R**: restart misi · **Enter**: mulai · **Esc**: menu.
- Pilih misi di menu dengan tombol **1–4** atau klik.

## Misi

1. **Ring Run** — lewati 8 cincin kertas berurutan dalam 180 detik. +100 per cincin, bonus waktu tersisa.
2. **Thermal Chase** — masuk 3 kolom termal (naik +6 m/s di dalamnya), capai ketinggian 100 m, lalu terbang ke marker emas di atas lingkaran landing.
3. **Precision Landing** — mendarat di dalam lingkaran merah: pelan (di bawah 20 m/s) dan datar (|pitch| di bawah 0.18 rad). Mendarat cepat/curam, jatuh ke sungai, atau menabrak gunung = crash.
4. **Free Flight** — terbang bebas tanpa timer; mendarat aman kapan saja.

## Aturan terbang

- Kecepatan di-clamp keras di setiap fixed step: tidak pernah di atas **42 m/s**, tidak di bawah **8 m/s**. Di bawah 8.5 m/s pesawat stall dan hidung jatuh.
- Tanpa input pitch, glider tenggelam pelan (pitch natural −0.05 rad).
- Setelah crash atau mendarat, pesawat berhenti total — tidak bisa taxi di darat maupun di air.

## Menjalankan lokal

```sh
node serve.ts        # http://localhost:8080/
```

Shot deterministik untuk screenshot: `?shot=hero|rings|thermal|landing&seed=1`.
