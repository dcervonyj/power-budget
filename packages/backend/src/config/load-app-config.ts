import { existsSync } from 'node:fs';
import { parseAppConfig, type AppConfig, type AppRole } from './AppConfig.js';

/** Repo-root `.env` first, then the package dir; variables already in the environment win. */
const ENV_FILES: readonly string[] = ['../../.env', '.env'];

/**
 * The single entry point for configuration: loads the `.env` files, then parses and
 * validates process.env. Safe to call more than once. Production code reads AppConfig only.
 */
export function loadAppConfig(role: AppRole): AppConfig {
  for (const file of ENV_FILES) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
    }
  }

  return parseAppConfig(process.env, role);
}
