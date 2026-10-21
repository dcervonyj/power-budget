import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { MjmlTemplateRenderer } from '../MjmlTemplateRenderer.js';
import { SUBJECT_BY_KIND } from '../workers/DispatchNotificationProcessor.js';

const TEMPLATE_DIR = join(__dirname, '..', 'templates');
const LOCALES = ['en', 'pl', 'uk', 'ru'];

describe('MjmlTemplateRenderer', () => {
  const renderer = new MjmlTemplateRenderer(TEMPLATE_DIR);

  it('HTML-escapes interpolated values', async () => {
    const html = await renderer.render('weekly_digest', 'en', {
      name: '<script>alert("x")</script>',
      planName: `Tom & Jerry's <b>plan</b>`,
      totalSpent: '10,00 zł',
      totalPlanned: '20,00 zł',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('Tom &amp; Jerry&#39;s &lt;b&gt;plan&lt;/b&gt;');
  });

  it.each(LOCALES)(
    'renders the magic_link template in %s with the sign-in link',
    async (locale) => {
      const link = 'https://power-budget.pages.dev/auth/magic-link?token=abc123&x=1';

      const html = await renderer.render('magic_link', locale, { link });

      expect(html).toContain(
        'href="https://power-budget.pages.dev/auth/magic-link?token=abc123&amp;x=1"',
      );
      expect(html).not.toContain('{{');
    },
  );

  it('ships a template in every locale for every notification kind', () => {
    const files = readdirSync(TEMPLATE_DIR);
    const expected = Object.keys(SUBJECT_BY_KIND).flatMap((kind) =>
      LOCALES.map((locale) => `${kind}.${locale}.mjml`),
    );

    expect(files).toEqual(expect.arrayContaining(expected));
  });

  it.each(readdirSync(TEMPLATE_DIR).filter((file) => file.endsWith('.mjml')))(
    'renders %s without MJML errors',
    async (file) => {
      const [kind = '', locale = ''] = file.split('.');

      await expect(renderer.render(kind, locale, {})).resolves.toContain('<html');
    },
  );
});
