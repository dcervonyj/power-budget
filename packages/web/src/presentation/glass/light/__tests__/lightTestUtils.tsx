import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, type RenderResult } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { vi } from 'vitest';
import { REDUCED_MOTION_QUERY } from '../../../theme/themePreference.js';
import { stubMatchMedia } from '../../../theme/__tests__/matchMediaStub.js';

export function loadGlassLightMessages(locale: string): Record<string, string> {
  const path = resolve(process.cwd(), 'public/locales', locale, 'glass-light.json');

  return JSON.parse(readFileSync(path, 'utf8'));
}

export function allowMotion(): void {
  stubMatchMedia({ [REDUCED_MOTION_QUERY]: false });
}

export function restoreMedia(): void {
  vi.unstubAllGlobals();
}

export function renderLight(element: React.ReactElement, locale = 'en'): RenderResult {
  return render(
    <IntlProvider locale={locale} messages={loadGlassLightMessages(locale)}>
      {element}
    </IntlProvider>,
  );
}
