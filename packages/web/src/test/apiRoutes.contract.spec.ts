import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Static half of the web <-> backend contract (CLN-017; the runtime half, real
 * responses against the spec, is packages/web/e2e/contract.spec.ts).
 *
 * Every HTTP call the web app (and the shared-app client it uses) makes must be
 * an operation of packages/backend/openapi.json, which CI keeps in sync with the
 * controllers. Calls to routes the backend does not have (audit C9, C15) fail here.
 */

const ROOT = path.resolve(__dirname, '../../..');
const SOURCE_DIRS = [path.join(ROOT, 'web/src'), path.join(ROOT, 'shared-app/src')];
const SPEC_FILE = path.join(ROOT, 'backend/openapi.json');
// `<receiver>.get<T>('/path...')`, `.post(\`/plans/${id}\`, ...)`: the first argument is a literal path.
const CALL = /\.(get|post|patch|put|delete)\s*(?:<[^()]*?>)?\(\s*(['"`])(\/[^'"`]*)\2/g;

/**
 * Calls the web app makes today that the backend does not serve. Each one is a
 * product bug to fix in the web app or the API; the last test fails once a gap
 * closes, so the entry gets removed instead of rotting.
 */
const KNOWN_GAPS: readonly string[] = [
  // HouseholdCategoryStore drill-in: no aggregate endpoint.
  'GET /categories/{param}/aggregate',
  // Settings export polling: the API only has POST /households/export.
  'GET /households/export/status',
  // Bank consent callback: the API has GET /bank-connections/{id}/complete instead.
  'POST /bank-connections/consent-callback',
];

interface Operation {
  readonly method: string;
  readonly path: string;
}

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }

  return files;
}

/** `/plans/${plan.id}/items?x=1` -> `/plans/{param}/items` */
function normalise(rawPath: string): string {
  const withoutQuery = rawPath.replace(/\?.*$/, '').replace(/\$\{[^}]*\?[^}]*\}$/, '');

  return withoutQuery.replace(/\$\{[^}]+\}/g, '{param}').replace(/\/+$/, '');
}

function webCalls(): Operation[] {
  const calls = new Map<string, Operation>();
  for (const file of SOURCE_DIRS.flatMap(sourceFiles)) {
    for (const match of readFileSync(file, 'utf8').matchAll(CALL)) {
      const method = (match[1] ?? '').toUpperCase();
      const callPath = normalise(match[3] ?? '');
      calls.set(`${method} ${callPath}`, { method, path: callPath });
    }
  }

  return [...calls.values()].sort((a, b) => key(a).localeCompare(key(b)));
}

function specOperations(): Operation[] {
  const spec: { paths: Record<string, Record<string, unknown>> } = JSON.parse(
    readFileSync(SPEC_FILE, 'utf8'),
  );

  return Object.entries(spec.paths).flatMap(([specPath, operations]) =>
    Object.keys(operations).map((method) => ({ method: method.toUpperCase(), path: specPath })),
  );
}

function isParam(segment: string): boolean {
  return segment.startsWith('{') && segment.endsWith('}');
}

function served(call: Operation, operations: readonly Operation[]): boolean {
  const callSegments = call.path.split('/');

  return operations.some((operation) => {
    const specSegments = operation.path.split('/');

    return (
      operation.method === call.method &&
      specSegments.length === callSegments.length &&
      specSegments.every((segment, index) => {
        const callSegment = callSegments[index] ?? '';

        return isParam(segment) ? callSegment !== '' : segment === callSegment;
      })
    );
  });
}

function key(operation: Operation): string {
  return `${operation.method} ${operation.path}`;
}

describe('web -> backend routes (openapi.json)', () => {
  const calls = webCalls();
  const operations = specOperations();

  it('finds the API calls of the web app', () => {
    // Guards the scanner itself: an empty list would make the next test pass vacuously.
    expect(calls.length).toBeGreaterThan(30);
    expect(calls.map(key)).toEqual(
      expect.arrayContaining(['POST /auth/login', 'GET /plans/{param}/dashboard']),
    );
  });

  it('calls only routes the backend serves (apart from the known gaps)', () => {
    const missing = calls.filter((call) => !served(call, operations)).map(key);

    expect(missing.filter((call) => !KNOWN_GAPS.includes(call))).toEqual([]);
  });

  it('still has every known gap (remove the entry once it is fixed)', () => {
    const missing = calls.filter((call) => !served(call, operations)).map(key);

    expect(KNOWN_GAPS.filter((gap) => !missing.includes(gap))).toEqual([]);
  });
});
