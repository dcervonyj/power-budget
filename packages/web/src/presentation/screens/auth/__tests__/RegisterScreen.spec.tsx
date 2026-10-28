import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { RegisterScreen } from '../RegisterScreen.js';
import { spyOnApiClient } from '../../../../test/apiClientSpies.js';

const mockPost = spyOnApiClient().post;

function apiError(status: number, code: string): Error & { response: unknown } {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { statusCode: status, code, message: code } },
  });
}

function submit(password: string): void {
  renderWithProviders(<RegisterScreen />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('RegisterScreen errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the password rule up front and blocks a short password without a request', async () => {
    submit('short');

    expect(
      await screen.findByText('The password must be at least 8 characters.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('maps 409 to the email-in-use message', async () => {
    mockPost.mockRejectedValueOnce(apiError(409, 'email_in_use'));
    submit('long-enough-1');

    expect(
      await screen.findByText('An account with this email already exists.'),
    ).toBeInTheDocument();
  });

  it('maps a 400 from the API to a validation message', async () => {
    mockPost.mockRejectedValueOnce(apiError(400, 'validation_failed'));
    submit('long-enough-1');

    expect(
      await screen.findByText(/Check the email address and use a password of at least 8/),
    ).toBeInTheDocument();
  });

  it('maps 429 to the too-many-attempts message', async () => {
    mockPost.mockRejectedValueOnce(apiError(429, 'too_many_requests'));
    submit('long-enough-1');

    expect(await screen.findByText(/Too many attempts/)).toBeInTheDocument();
  });

  it('keeps the generic message for other failures', async () => {
    mockPost.mockRejectedValueOnce(apiError(500, 'internal'));
    submit('long-enough-1');

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });
});
