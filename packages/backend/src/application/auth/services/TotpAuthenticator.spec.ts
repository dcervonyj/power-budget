import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { EncryptedString, UserId } from '@power-budget/core';
import type {
  Encryption,
  TotpSecretRepository,
  TotpStepUpStore,
  TotpVerifier,
} from '../../../domain/auth/ports.js';
import type { TotpSecret, User } from '../../../domain/auth/entities.js';
import {
  TotpEnrollmentRequiredError,
  TotpInvalidError,
  TotpRequiredError,
} from '../../../domain/auth/errors.js';
import { TotpAuthenticator } from './TotpAuthenticator.js';

const USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const CIPHERTEXT = 'env-v1:aes-256-gcm:iv:ct:tag' as EncryptedString;
const PENDING_CIPHERTEXT = 'env-v1:aes-256-gcm:iv2:ct2:tag2' as EncryptedString;
const CONTEXT = `totp:${USER_ID}`;
const NOW = new Date('2026-10-21T10:00:00.000Z');

function makeUser(): User {
  return {
    id: USER_ID,
    email: 'alice@example.com',
    displayName: 'alice',
    localePreference: null,
    defaultLocale: 'en',
    passwordHash: 'hashed',
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeSecret(overrides: Partial<TotpSecret> = {}): TotpSecret {
  return {
    userId: USER_ID,
    encryptedSecret: CIPHERTEXT,
    enrolledAt: new Date(),
    verifiedAt: new Date(),
    lastUsedTimeStep: 100,
    pendingEncryptedSecret: null,
    ...overrides,
  };
}

describe('TotpAuthenticator', () => {
  let totpSecretRepo: ReturnType<typeof mock<TotpSecretRepository>>;
  let totpVerifier: ReturnType<typeof mock<TotpVerifier>>;
  let encryption: ReturnType<typeof mock<Encryption>>;
  let stepUpStore: ReturnType<typeof mock<TotpStepUpStore>>;
  let totp: TotpAuthenticator;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    totpSecretRepo = mock<TotpSecretRepository>();
    totpVerifier = mock<TotpVerifier>();
    encryption = mock<Encryption>();
    stepUpStore = mock<TotpStepUpStore>();
    totp = new TotpAuthenticator(totpSecretRepo, totpVerifier, encryption, stepUpStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isEnabled', () => {
    it('is false without an enrolment', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(null);

      await expect(totp.isEnabled(USER_ID)).resolves.toBe(false);
    });

    it('is false for a pending (unverified) enrolment', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(makeSecret({ verifiedAt: null }));

      await expect(totp.isEnabled(USER_ID)).resolves.toBe(false);
    });

    it('is true once verified', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(makeSecret());

      await expect(totp.isEnabled(USER_ID)).resolves.toBe(true);
    });

    it('stays true while a replacement is pending', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(
        makeSecret({ pendingEncryptedSecret: PENDING_CIPHERTEXT }),
      );

      await expect(totp.isEnabled(USER_ID)).resolves.toBe(true);
    });
  });

  describe('enrol', () => {
    beforeEach(() => {
      totpVerifier.generateSecret.mockReturnValue({
        secret: 'PLAINSECRET',
        otpauthUri: 'otpauth://totp/PowerBudget:alice',
      });
      encryption.encrypt.mockResolvedValue(CIPHERTEXT);
    });

    it('enrols a fresh user without any step-up (audit C7) and stores only ciphertext', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(null);

      const result = await totp.enrol(makeUser());

      expect(result).toEqual({
        qrCodeUri: 'otpauth://totp/PowerBudget:alice',
        secret: 'PLAINSECRET',
      });
      expect(stepUpStore.isRecent).not.toHaveBeenCalled();
      expect(encryption.encrypt).toHaveBeenCalledWith('PLAINSECRET', CONTEXT);
      expect(totpSecretRepo.save).toHaveBeenCalledWith({
        userId: USER_ID,
        encryptedSecret: CIPHERTEXT,
        enrolledAt: NOW,
        verifiedAt: null,
        lastUsedTimeStep: null,
        pendingEncryptedSecret: null,
      });
      expect(totpSecretRepo.savePending).not.toHaveBeenCalled();
    });

    it('restarts a pending enrolment without step-up', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(makeSecret({ verifiedAt: null }));

      await totp.enrol(makeUser());

      expect(stepUpStore.isRecent).not.toHaveBeenCalled();
      expect(totpSecretRepo.save).toHaveBeenCalledOnce();
    });

    it('refuses to replace an enabled TOTP without a recent step-up', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(makeSecret());
      stepUpStore.isRecent.mockResolvedValue(false);

      await expect(totp.enrol(makeUser())).rejects.toThrow(TotpRequiredError);
      expect(totpSecretRepo.save).not.toHaveBeenCalled();
      expect(totpSecretRepo.savePending).not.toHaveBeenCalled();
    });

    it('stores a replacement of an enabled TOTP as pending, keeping the active secret (BE-BUGS-01)', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(makeSecret());
      stepUpStore.isRecent.mockResolvedValue(true);
      encryption.encrypt.mockResolvedValue(PENDING_CIPHERTEXT);

      const result = await totp.enrol(makeUser());

      expect(result).toEqual({
        qrCodeUri: 'otpauth://totp/PowerBudget:alice',
        secret: 'PLAINSECRET',
      });
      expect(stepUpStore.isRecent).toHaveBeenCalledWith(USER_ID);
      expect(encryption.encrypt).toHaveBeenCalledWith('PLAINSECRET', CONTEXT);
      expect(totpSecretRepo.savePending).toHaveBeenCalledWith(USER_ID, PENDING_CIPHERTEXT);
      expect(totpSecretRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    beforeEach(() => {
      encryption.decrypt.mockResolvedValue('PLAINSECRET');
    });

    it('accepts a valid code, claims its time step and stamps the step-up', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(makeSecret());
      totpVerifier.verify.mockReturnValue(101);
      totpSecretRepo.claimTimeStep.mockResolvedValue(true);

      await totp.verify(USER_ID, '123456');

      expect(encryption.decrypt).toHaveBeenCalledWith(CIPHERTEXT, CONTEXT);
      expect(totpVerifier.verify).toHaveBeenCalledWith('PLAINSECRET', '123456', 100);
      expect(totpSecretRepo.claimTimeStep).toHaveBeenCalledWith(USER_ID, 101, NOW);
      expect(stepUpStore.stamp).toHaveBeenCalledWith(USER_ID);
    });

    it('rejects a wrong or already used code', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(makeSecret());
      totpVerifier.verify.mockReturnValue(null);

      await expect(totp.verify(USER_ID, '123456')).rejects.toThrow(TotpInvalidError);
      expect(totpSecretRepo.claimTimeStep).not.toHaveBeenCalled();
      expect(stepUpStore.stamp).not.toHaveBeenCalled();
    });

    it('rejects a code a concurrent request claimed first (replay)', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(makeSecret());
      totpVerifier.verify.mockReturnValue(101);
      totpSecretRepo.claimTimeStep.mockResolvedValue(false);

      await expect(totp.verify(USER_ID, '123456')).rejects.toThrow(TotpInvalidError);
      expect(stepUpStore.stamp).not.toHaveBeenCalled();
    });

    it('requires an enrolment', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(null);

      await expect(totp.verify(USER_ID, '123456')).rejects.toThrow(TotpEnrollmentRequiredError);
    });

    it('confirms a pending enrolment (first code, no previous step)', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(
        makeSecret({ verifiedAt: null, lastUsedTimeStep: null }),
      );
      totpVerifier.verify.mockReturnValue(55);
      totpSecretRepo.claimTimeStep.mockResolvedValue(true);

      await totp.verify(USER_ID, '654321');

      expect(totpVerifier.verify).toHaveBeenCalledWith('PLAINSECRET', '654321', null);
      expect(totpSecretRepo.claimTimeStep).toHaveBeenCalledWith(USER_ID, 55, NOW);
    });

    it('checks only the active secret while a replacement is pending', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(
        makeSecret({ pendingEncryptedSecret: PENDING_CIPHERTEXT }),
      );
      totpVerifier.verify.mockReturnValue(null);

      await expect(totp.verify(USER_ID, '123456')).rejects.toThrow(TotpInvalidError);
      expect(encryption.decrypt).toHaveBeenCalledOnce();
      expect(encryption.decrypt).toHaveBeenCalledWith(CIPHERTEXT, CONTEXT);
      expect(totpSecretRepo.promotePending).not.toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('swaps in a pending replacement on its first valid code', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(
        makeSecret({ pendingEncryptedSecret: PENDING_CIPHERTEXT }),
      );
      encryption.decrypt.mockResolvedValue('NEWSECRET');
      totpVerifier.verify.mockReturnValue(102);
      totpSecretRepo.promotePending.mockResolvedValue(true);

      await totp.confirm(USER_ID, '222222');

      expect(encryption.decrypt).toHaveBeenCalledWith(PENDING_CIPHERTEXT, CONTEXT);
      expect(totpVerifier.verify).toHaveBeenCalledWith('NEWSECRET', '222222', null);
      expect(totpSecretRepo.promotePending).toHaveBeenCalledWith(
        USER_ID,
        PENDING_CIPHERTEXT,
        102,
        NOW,
      );
      expect(totpSecretRepo.claimTimeStep).not.toHaveBeenCalled();
      expect(stepUpStore.stamp).toHaveBeenCalledWith(USER_ID);
    });

    it('rejects a pending code that a concurrent request already used', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(
        makeSecret({ pendingEncryptedSecret: PENDING_CIPHERTEXT }),
      );
      encryption.decrypt.mockResolvedValue('NEWSECRET');
      totpVerifier.verify.mockReturnValue(102);
      totpSecretRepo.promotePending.mockResolvedValue(false);

      await expect(totp.confirm(USER_ID, '222222')).rejects.toThrow(TotpInvalidError);
      expect(stepUpStore.stamp).not.toHaveBeenCalled();
    });

    it('falls back to the active secret when the code is not the pending one', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(
        makeSecret({ pendingEncryptedSecret: PENDING_CIPHERTEXT }),
      );
      encryption.decrypt.mockResolvedValueOnce('NEWSECRET').mockResolvedValueOnce('PLAINSECRET');
      totpVerifier.verify.mockReturnValueOnce(null).mockReturnValueOnce(101);
      totpSecretRepo.claimTimeStep.mockResolvedValue(true);

      await totp.confirm(USER_ID, '123456');

      expect(totpVerifier.verify).toHaveBeenNthCalledWith(2, 'PLAINSECRET', '123456', 100);
      expect(totpSecretRepo.promotePending).not.toHaveBeenCalled();
      expect(totpSecretRepo.claimTimeStep).toHaveBeenCalledWith(USER_ID, 101, NOW);
      expect(stepUpStore.stamp).toHaveBeenCalledWith(USER_ID);
    });

    it('confirms a first enrolment against the active secret', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(
        makeSecret({ verifiedAt: null, lastUsedTimeStep: null }),
      );
      encryption.decrypt.mockResolvedValue('PLAINSECRET');
      totpVerifier.verify.mockReturnValue(55);
      totpSecretRepo.claimTimeStep.mockResolvedValue(true);

      await totp.confirm(USER_ID, '654321');

      expect(totpVerifier.verify).toHaveBeenCalledOnce();
      expect(totpSecretRepo.claimTimeStep).toHaveBeenCalledWith(USER_ID, 55, NOW);
    });

    it('requires an enrolment', async () => {
      totpSecretRepo.findByUser.mockResolvedValue(null);

      await expect(totp.confirm(USER_ID, '123456')).rejects.toThrow(TotpEnrollmentRequiredError);
    });
  });
});
