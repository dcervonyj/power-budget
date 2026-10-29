import { createMock } from '@golevelup/ts-jest';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { LoginScreen } from '../LoginScreen.js';
import { renderAuth } from './authTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockLogin = jest.fn();

jest.mock('../../../../infrastructure/index.js', () => ({
  authService: { login: (params: unknown): Promise<unknown> => mockLogin(params) },
}));

function renderLogin(navigate = jest.fn()): ReturnType<typeof renderAuth> {
  const navigation = createMock<React.ComponentProps<typeof LoginScreen>['navigation']>({
    navigate,
  });
  const route = createMock<React.ComponentProps<typeof LoginScreen>['route']>({
    key: 'Login',
    name: 'Login',
  });

  return renderAuth(<LoginScreen navigation={navigation} route={route} />);
}

describe('LoginScreen', () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it('asks for both fields without calling the API', async () => {
    await renderLogin();

    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Email and password are required.')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows the code field when the server requires two-factor, then sends the code', async () => {
    mockLogin.mockResolvedValueOnce({ requiresTotp: true });
    mockLogin.mockResolvedValueOnce({ requiresTotp: false });
    await renderLogin();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'anna@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'correct horse');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(screen.getByLabelText('Authenticator code')).toBeTruthy());

    await fireEvent.changeText(screen.getByLabelText('Authenticator code'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(2));
    expect(mockLogin).toHaveBeenLastCalledWith({
      email: 'anna@example.com',
      password: 'correct horse',
      totpCode: '123456',
    });
  });

  it('shows the wrong-password error from the API code', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { status: 401, data: { code: 'invalid_credentials' } },
    });
    await renderLogin();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'anna@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByText('Invalid email or password.')).toBeTruthy());
  });

  it('navigates to the register and magic link screens', async () => {
    const navigate = jest.fn();
    await renderLogin(navigate);

    await fireEvent.press(screen.getByRole('link', { name: 'Create account' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(navigate).toHaveBeenNthCalledWith(1, 'Register');
    expect(navigate).toHaveBeenNthCalledWith(2, 'MagicLink');
  });
});
