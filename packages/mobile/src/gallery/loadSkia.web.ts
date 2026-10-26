import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

/** CanvasKit wasm is served from `public/canvaskit.wasm` (copied into the export root). */
export function loadSkia(): Promise<void> {
  return LoadSkiaWeb({ locateFile: locateCanvasKit });
}

function locateCanvasKit(file: string): string {
  return `/${file}`;
}
