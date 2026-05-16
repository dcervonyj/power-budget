import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  authenticateAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { BiometricUnlockService, BIOMETRIC_PREF_KEY } from '../BiometricUnlockService.js';

const mockHasHardware = vi.mocked(LocalAuthentication.hasHardwareAsync);
const mockIsEnrolled = vi.mocked(LocalAuthentication.isEnrolledAsync);
const mockAuthenticate = vi.mocked(LocalAuthentication.authenticateAsync);
const mockGetItem = vi.mocked(SecureStore.getItemAsync);
const mockSetItem = vi.mocked(SecureStore.setItemAsync);

describe('BiometricUnlockService', () => {
  let service: BiometricUnlockService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BiometricUnlockService();
  });

  describe('canUseBiometrics', () => {
    it('returns false when no hardware', async () => {
      mockHasHardware.mockResolvedValue(false);
      expect(await service.canUseBiometrics()).toBe(false);
      expect(mockIsEnrolled).not.toHaveBeenCalled();
    });

    it('returns false when hardware present but not enrolled', async () => {
      mockHasHardware.mockResolvedValue(true);
      mockIsEnrolled.mockResolvedValue(false);
      expect(await service.canUseBiometrics()).toBe(false);
    });

    it('returns true when hardware present and enrolled', async () => {
      mockHasHardware.mockResolvedValue(true);
      mockIsEnrolled.mockResolvedValue(true);
      expect(await service.canUseBiometrics()).toBe(true);
    });
  });

  describe('authenticate', () => {
    it('returns true on successful authentication', async () => {
      mockAuthenticate.mockResolvedValue({ success: true } as Awaited<
        ReturnType<typeof LocalAuthentication.authenticateAsync>
      >);
      expect(await service.authenticate('Confirm identity')).toBe(true);
      expect(mockAuthenticate).toHaveBeenCalledWith(
        expect.objectContaining({ promptMessage: 'Confirm identity' }),
      );
    });

    it('returns false when authentication fails', async () => {
      mockAuthenticate.mockResolvedValue({ success: false, error: 'user_cancel' } as Awaited<
        ReturnType<typeof LocalAuthentication.authenticateAsync>
      >);
      expect(await service.authenticate('Confirm identity')).toBe(false);
    });
  });

  describe('isBiometricEnabled', () => {
    it('returns true when stored value is "true"', async () => {
      mockGetItem.mockResolvedValue('true');
      expect(await service.isBiometricEnabled()).toBe(true);
      expect(mockGetItem).toHaveBeenCalledWith(BIOMETRIC_PREF_KEY);
    });

    it('returns false when stored value is "false"', async () => {
      mockGetItem.mockResolvedValue('false');
      expect(await service.isBiometricEnabled()).toBe(false);
    });

    it('returns false when no value stored', async () => {
      mockGetItem.mockResolvedValue(null);
      expect(await service.isBiometricEnabled()).toBe(false);
    });
  });

  describe('setBiometricEnabled', () => {
    it('stores "true" when enabled', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await service.setBiometricEnabled(true);
      expect(mockSetItem).toHaveBeenCalledWith(BIOMETRIC_PREF_KEY, 'true');
    });

    it('stores "false" when disabled', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await service.setBiometricEnabled(false);
      expect(mockSetItem).toHaveBeenCalledWith(BIOMETRIC_PREF_KEY, 'false');
    });
  });
});
