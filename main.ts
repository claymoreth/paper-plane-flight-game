// PAPER PLANE — build dossier (Node 22 stdlib saja).
// Menyalin game/ dan screenshots/ ke direktori output, lalu menulis
// dossier.json via buildDossier dari vendor/makefun-game.ts.
// OUTPUT SELALU /output (atau MAKEFUN_OUTPUT_DIR bila diset) —
// JANGAN PERNAH memakai MAKEFUN_BOT_DIR untuk output (di grader /bot read-only).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ? resolve(process.env.MAKEFUN_OUTPUT_DIR) : '/output';

mkdirSync(out, { recursive: true });

const gameDir = join(repoRoot, 'game');
if (existsSync(gameDir)) {
  cpSync(gameDir, join(out, 'game'), { recursive: true });
}

const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

// Tulis bytes dossier apa adanya (Uint8Array) — jangan JSON.stringify.
writeFileSync(join(out, 'dossier.json'), dossier);
