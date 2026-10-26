export const GALLERY_FILE_SUFFIX = '.gallery.tsx';

/** `src/x/Tokens.gallery.tsx` + `Swatches` gives `Tokens/Swatches`. Shared by the app and the Playwright discovery. */
export function galleryEntryId(filePath: string, exportName: string): string {
  const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);

  return `${fileName.slice(0, -GALLERY_FILE_SUFFIX.length)}/${exportName}`;
}
