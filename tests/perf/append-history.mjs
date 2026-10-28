// CLN-060: appends one line per CI run to the k6 history file and prints a table (last runs)
// for the job summary, so a creeping p95 shows before it crosses the gate.
//
//   node tests/perf/append-history.mjs k6-summary.json perf-history/history.jsonl
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [summaryPath, historyPath] = process.argv.slice(2);
const SHOWN_RUNS = 10;
const GATED = ['dashboard', 'transactions_first_page', 'transactions_unmapped'];

if (!summaryPath || !historyPath) {
  console.error('usage: append-history.mjs <k6-summary.json> <history.jsonl>');
  process.exit(2);
}

const metrics = JSON.parse(readFileSync(summaryPath, 'utf8')).metrics;
const p95 = Object.fromEntries(
  GATED.map((name) => [name, metrics[`http_req_duration{name:${name}}`]?.['p(95)'] ?? null]),
);
const entry = {
  at: new Date().toISOString(),
  sha: process.env.GITHUB_SHA ?? 'local',
  ref: process.env.GITHUB_REF_NAME ?? 'local',
  run: process.env.GITHUB_RUN_ID ?? 'local',
  p95,
};

mkdirSync(dirname(historyPath), { recursive: true });
appendFileSync(historyPath, `${JSON.stringify(entry)}\n`);

const rows = readFileSync(historyPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .slice(-SHOWN_RUNS)
  .reverse();
const ms = (value) => (typeof value === 'number' ? `${value.toFixed(1)} ms` : 'n/a');
const lines = [
  '## k6 p95 history (newest first)',
  '',
  `| run | ref | sha | ${GATED.join(' | ')} |`,
  `|---|---|---|${GATED.map(() => '---').join('|')}|`,
  ...rows.map(
    (row) =>
      `| ${row.run} | ${row.ref} | ${row.sha.slice(0, 7)} | ${GATED.map((name) => ms(row.p95[name])).join(' | ')} |`,
  ),
];
console.log(lines.join('\n'));
if (!existsSync(historyPath)) {
  process.exit(1);
}
