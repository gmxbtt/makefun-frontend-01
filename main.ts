// Entry point for makefun-frontend-01 (Node 22, standard library only).
// Copies this repository's app/ and screenshots/ beside this file into the
// output directory and writes /output/dossier.json with the vendored
// make.fun dossier library. The library copy under vendor/ must stay
// byte-for-byte as shipped in the kit: the scorer rebuilds the dossier
// with its own copy and compares.
//
// Run locally:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader, MAKEFUN_OUTPUT_DIR is unset and /output is used.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps mirror the gate: text capped at 160 KiB, at most 3 screenshots of
// 256 KiB each, app/ at most 993 files/dirs and 16 MiB. Anything over
// those limits makes buildDossier throw instead of writing a dossier.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  }),
);
