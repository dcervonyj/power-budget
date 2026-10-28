import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StaticCrashFallback, pickCrashLocale } from '../StaticCrashFallback.js';

describe('StaticCrashFallback', () => {
  it('prefers the stored locale, then the browser language, then English', () => {
    expect(pickCrashLocale('pl', 'en-US')).toBe('pl');
    expect(pickCrashLocale(null, 'uk-UA')).toBe('uk');
    expect(pickCrashLocale('xx', 'de-DE')).toBe('en');
  });

  it('shows the stored locale text and reloads on click', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    localStorage.setItem('pb_locale', 'ru');
    render(<StaticCrashFallback />);

    expect(screen.getByRole('alert')).toHaveTextContent('Что-то пошло не так.');
    fireEvent.click(screen.getByRole('button', { name: 'Перезагрузить' }));

    expect(reload).toHaveBeenCalledTimes(1);
    localStorage.removeItem('pb_locale');
    vi.unstubAllGlobals();
  });
});
