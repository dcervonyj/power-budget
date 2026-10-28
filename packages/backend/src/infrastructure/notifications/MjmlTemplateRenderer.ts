import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TemplateRenderer } from '../../domain/notifications/ports.js';

type MjmlRender = (
  input: string,
  opts?: { validationLevel?: string },
) => Promise<{ html: string; errors: Array<{ formattedMessage: string }> }>;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export class MjmlTemplateRenderer implements TemplateRenderer {
  private readonly templateDir: string;
  private readonly cache = new Map<string, string>();
  private mjml2html: MjmlRender | undefined;

  constructor(templateDir?: string) {
    this.templateDir = templateDir ?? join(__dirname, 'templates');
  }

  async render(kind: string, locale: string, variables: Record<string, string>): Promise<string> {
    const key = `${kind}.${locale}`;
    let mjmlTemplate = this.cache.get(key);

    if (mjmlTemplate === undefined) {
      const filePath = join(this.templateDir, `${kind}.${locale}.mjml`);
      try {
        mjmlTemplate = readFileSync(filePath, 'utf-8');
      } catch {
        const fallbackPath = join(this.templateDir, `${kind}.en.mjml`);
        mjmlTemplate = readFileSync(fallbackPath, 'utf-8');
      }
      this.cache.set(key, mjmlTemplate);
    }

    const interpolated = this.interpolate(mjmlTemplate, variables);
    const { html, errors } = await this.loadMjml()(interpolated, { validationLevel: 'soft' });

    if (errors.length > 0) {
      const msgs = errors.map((e) => e.formattedMessage).join('; ');
      throw new Error(`MJML render errors: ${msgs}`);
    }

    return html;
  }

  /**
   * mjml costs about 37 MB RSS and 170-280 ms to load, so it is required on the first render
   * instead of at boot (an API-only process never sends an email).
   * mjml 5 renders asynchronously: the result is a Promise (v4 returned it directly).
   */
  private loadMjml(): MjmlRender {
    if (this.mjml2html === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const render: MjmlRender = require('mjml');
      this.mjml2html = render;
    }

    return this.mjml2html;
  }

  /** Values are HTML-escaped: names and plan names are user input. */
  private interpolate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (placeholder: string, key: string) => {
      const value = variables[key];

      return value === undefined ? placeholder : this.escapeHtml(value);
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char: string) => HTML_ESCAPES[char] ?? char);
  }
}
