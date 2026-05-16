import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mjml2html = require('mjml') as (
  input: string,
  opts?: { validationLevel?: string },
) => { html: string; errors: Array<{ formattedMessage: string }> };
import type { TemplateRenderer } from '../domain/ports.js';

export class MjmlTemplateRenderer implements TemplateRenderer {
  private readonly templateDir: string;
  private readonly cache = new Map<string, string>();

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
    const { html, errors } = mjml2html(interpolated, { validationLevel: 'soft' });

    if (errors.length > 0) {
      const msgs = errors.map((e) => e.formattedMessage).join('; ');
      throw new Error(`MJML render errors: ${msgs}`);
    }

    return html;
  }

  private interpolate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`);
  }
}
