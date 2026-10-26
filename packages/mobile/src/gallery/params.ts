import type { ResolvedThemeName } from '../presentation/theme/index.js';

export interface GalleryParams {
  readonly theme: ResolvedThemeName;
  readonly entry: string | null;
}

/** `?theme=dark|light` (default dark) and `?entry=<Entry id>`, read from the launch URL. */
export function parseGalleryParams(url: string | null | undefined): GalleryParams {
  const query = url == null ? '' : queryOf(url);
  const values = new Map<string, string>();
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key !== undefined && key !== '') {
      values.set(decodeURIComponent(key), decodeURIComponent(value.replace(/\+/g, ' ')));
    }
  }

  return {
    theme: values.get('theme') === 'light' ? 'light' : 'dark',
    entry: values.get('entry') ?? null,
  };
}

export function galleryEntryHref(entry: string, theme: ResolvedThemeName): string {
  return `?entry=${encodeURIComponent(entry)}&theme=${theme}`;
}

function queryOf(url: string): string {
  const start = url.indexOf('?');
  if (start === -1) {
    return '';
  }
  const end = url.indexOf('#', start);

  return url.slice(start + 1, end === -1 ? undefined : end);
}
