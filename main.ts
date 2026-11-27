// Token Radar's build step (Node 22, standard library only).
//
// Read the sealed protocol snapshot, score every pre-token protocol with the model in lib/model.ts,
// hand back three things the gate asks for: board.json (the ranked rows), data.js (the page's whole
// dataset), and copies of dashboard/ and screenshots/. Then write dossier.json with the vendored
// make.fun library, last, because the scorer rebuilds it from the finished /output and compares bytes.
//
// Run it against a local snapshot the same way:
//   MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));

// The scorer's caps: the text cap shapes the dossier, the screenshot caps are hard refusals.
const DOSSIER_TEXT_CAP = 65_536;
const SHOT_CAP = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAP = { max_files: 400, max_bytes: 4_194_304 };
// The gate's own name rule for a dashboard file or a screenshot.
const FILE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function flag(name: string, fallback: string): string {
  const plain = process.argv.indexOf(`--${name}`);
  if (plain >= 0 && plain + 1 < process.argv.length) return process.argv[plain + 1]!;
  const inline = process.argv.find((argument) => argument.startsWith(`--${name}=`));
  return inline === undefined ? fallback : inline.slice(name.length + 3);
}

function die(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

/** Every regular file in `from`, copied flat into `to`; a leading dot is never a hand-in file. */
function copyFlat(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    if (!statSync(source).isFile()) continue;
    copyFileSync(source, join(to, name));
    names.push(name);
  }
  return names;
}

const input = flag('input', '/input');
const snapshotPath = input.endsWith('.json') ? input : join(input, 'snapshot.json');
if (!existsSync(snapshotPath)) {
  process.stderr.write(`token radar: no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}

const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const refused = boardIssue(board, snapshot);
if (refused !== null) die(`the board the model wrote would not pass the gate: ${refused}`);

const out = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

const dashboardFiles = copyFlat(join(repo, 'dashboard'), join(out, 'dashboard'));
const shots = copyFlat(join(repo, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  die(`screenshots/ holds ${shots.length}: hand in the board, a protocol's detail view and a filtered view`);
}
for (const name of [...dashboardFiles, ...shots]) {
  if (!FILE_NAME.test(name)) die(`"${name}" is not a file name the gate takes: letters, digits and . _ - only`);
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, {
  text_max_bytes: DOSSIER_TEXT_CAP,
  screenshots: SHOT_CAP,
  dashboard: DASHBOARD_CAP,
}));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ` +
    `${board.length} rows ranked (${radar.early_size} early, ${radar.live_size} live tokens set aside)\n` +
    `token radar: wrote board.json, data.js, dashboard/ (${dashboardFiles.length} files), screenshots/ (${shots.length}) and dossier.json to ${out}\n`,
);
