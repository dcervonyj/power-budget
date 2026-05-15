import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RotateUserDekUseCase } from './RotateUserDekUseCase.js';
import type {
  UserRepository,
  TotpSecretRepository,
  Encryption,
} from '../../../domain/auth/ports.js';
import type { UserId } from '@power-budget/core';

const makeUserRepo = (): UserRepository => ({
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  updateLocalePreference: vi.fn(),
});

const makeTotpRepo = (): TotpSecretRepository => ({
  findByUser: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
});

const makeEncryption = (): Encryption => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
});

describe('RotateUserDekUseCase', () => {
  let userRepo: UserRepository;
  let totpRepo: TotpSecretRepository;
  let encryption: Encryption;
  let useCase: RotateUserDekUseCase;

  beforeEach(() => {
    userRepo = makeUserRepo();
    totpRepo = makeTotpRepo();
    encryption = makeEncryption();
    useCase = new RotateUserDekUseCase(userRepo, totpRepo, encryption);
  });

  it('skips when user is not found', async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(null);

    const result = await useCase.execute({ userId: 'user-1' as UserId });

    expect(result).toEqual({ fieldsRotated: 0, skipped: true });
    expect(totpRepo.findByUser).not.toHaveBeenCalled();
  });

  it('returns 0 fields rotated when user has no TOTP secret', async () => {
    vi.mocked(userRepo.findById).mockResolvedValue({
      id: 'user-1' as UserId,
      email: 'test@example.com',
      displayName: 'Test',
      localePreference: null,
      defaultLocale: 'en',
      passwordHash: null,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(totpRepo.findByUser).mockResolvedValue(null);

    const result = await useCase.execute({ userId: 'user-1' as UserId });

    expect(result).toEqual({ fieldsRotated: 0, skipped: false });
    expect(encryption.decrypt).not.toHaveBeenCalled();
  });

  it('rotates TOTP secret when found', async () => {
    const userId = 'user-1' as UserId;
    vi.mocked(userRepo.findById).mockResolvedValue({
      id: userId,
      email: 'test@example.com',
      displayName: 'Test',
      localePreference: null,
      defaultLocale: 'en',
      passwordHash: null,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(totpRepo.findByUser).mockResolvedValue({
      userId,
      encryptedSecret: 'env-v1:aes-256-gcm:iv:ct:tag',
      enrolledAt: new Date(),
      verifiedAt: null,
    });
    vi.mocked(encryption.decrypt).mockResolvedValue('JBSWY3DPEHPK3PXP');
    vi.mocked(encryption.encrypt).mockResolvedValue(
      'env-v1:aes-256-gcm:newiv:newct:newtag' as import('@power-budget/core').EncryptedString,
    );

    const result = await useCase.execute({ userId });

    expect(result).toEqual({ fieldsRotated: 1, skipped: false });
    expect(encryption.decrypt).toHaveBeenCalledWith('env-v1:aes-256-gcm:iv:ct:tag');
    expect(encryption.encrypt).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
    expect(totpRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedSecret: 'env-v1:aes-256-gcm:newiv:newct:newtag',
      }),
    );
  });
});
