export type GalleryTheme = 'dark' | 'light';

export interface GalleryParams {
  readonly theme: GalleryTheme;
  readonly entry: string | null;
}

/** `?theme=dark|light` (default dark) and `?entry=<Entry id>`. */
export function parseGalleryParams(search: string): GalleryParams {
  const params = new URLSearchParams(search);
  const theme = params.get('theme') === 'light' ? 'light' : 'dark';

  return { theme, entry: params.get('entry') };
}

export function galleryEntryHref(entry: string, theme: GalleryTheme): string {
  return `?${new URLSearchParams({ entry, theme }).toString()}`;
}
