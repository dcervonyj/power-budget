/** Native Skia needs no loading; the web variant (`loadSkia.web.ts`) fetches CanvasKit. */
export function loadSkia(): Promise<void> {
  return Promise.resolve();
}
