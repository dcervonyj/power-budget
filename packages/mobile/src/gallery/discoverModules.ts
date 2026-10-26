import type { GalleryModules } from './registry.js';

/**
 * Metro-only: `require.context` needs the regex as a literal. Never imported by jest or by the
 * production entry, so the gallery stays out of the production bundle.
 */
export function discoverGalleryModules(): GalleryModules {
  const context = require.context('..', true, /\.gallery\.tsx$/);
  const modules: GalleryModules = {};
  for (const key of context.keys()) {
    modules[key] = context(key);
  }

  return modules;
}
