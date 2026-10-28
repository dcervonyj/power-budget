import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseAppConfig, type AppConfig, type AppRole } from './AppConfig.js';

const WORKSPACE_MARKER = 'pnpm-workspace.yaml';

/**
 * Env file precedence, highest first: real environment variables, then the backend package
 * `.env`, then the repo-root `.env`. Files are located from this module, never from the
 * working directory, so starting the API from any cwd reads the same files.
 */
export function envFilesFor(moduleDir: string): readonly string[] {
  const packageDir = findUp(moduleDir, 'package.json');
  const rootDir = findUp(moduleDir, WORKSPACE_MARKER);
  const files = [packageDir, rootDir].filter(isDefined).map(toEnvFile);

  return [...new Set(files)];
}

/** Loads the files without overriding what is already set, so earlier entries win. */
export function loadEnvFiles(moduleDir: string): void {
  for (const file of envFilesFor(moduleDir)) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
    }
  }
}

/**
 * The single entry point for configuration: loads the `.env` files, then parses and
 * validates process.env. Safe to call more than once. Production code reads AppConfig only.
 */
export function loadAppConfig(role: AppRole): AppConfig {
  loadEnvFiles(__dirname);

  return parseAppConfig(process.env, role);
}

function findUp(startDir: string, marker: string): string | undefined {
  const parent = dirname(startDir);
  if (existsSync(join(startDir, marker))) {
    return startDir;
  }

  return parent === startDir ? undefined : findUp(parent, marker);
}

function isDefined(value: string | undefined): value is string {
  return value !== undefined;
}

function toEnvFile(dir: string): string {
  return join(dir, '.env');
}
