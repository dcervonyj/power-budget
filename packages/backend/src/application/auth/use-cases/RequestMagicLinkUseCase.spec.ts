import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId } from '@power-budget/core';
import type {
  UserRepository,
  MagicLinkTokenRepository,
  NotificationOutboxPort,
} from '../../../domain/auth/ports.js';
import { RequestMagicLinkUseCase } from './RequestMagicLinkUseCase.js';
import type { User } from '../../../domain/auth/entities.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;

function makeUser(): User {
  return {
    id: TEST_USER_ID,
    email: 'alice@example.com',
    displayName: 'alice',
    localePreference: null,
    defaultLocale: 'en',
    passwordHash: null,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('RequestMagicLinkUseCase', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let magicLinkTokenRepo: ReturnType<typeof mock<MagicLinkTokenRepository>>;
  let notificationOutbox: ReturnType<typeof mock<NotificationOutboxPort>>;
  let useCase: RequestMagicLinkUseCase;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    magicLinkTokenRepo = mock<MagicLinkTokenRepository>();
    notificationOutbox = mock<NotificationOutboxPort>();
    useCase = new RequestMagicLinkUseCase(userRepo, magicLinkTokenRepo, notificationOutbox);
  });

  it('enqueues a magic link notification for existing user', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());
    magicLinkTokenRepo.save.mockResolvedValue(undefined);
    notificationOutbox.enqueue.mockResolvedValue(undefined);

    await useCase.execute({ email: 'alice@example.com' });

    expect(magicLinkTokenRepo.save).toHaveBeenCalledOnce();
    expect(notificationOutbox.enqueue).toHaveBeenCalledOnce();
    const [call] = notificationOutbox.enqueue.mock.calls;
    expect(call?.[0]?.kind).toBe('magic_link');
  });

  it('returns silently when email is not found (no email enumeration)', async () => {
    userRepo.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute({ email: 'unknown@example.com' })).resolves.toBeUndefined();

    expect(magicLinkTokenRepo.save).not.toHaveBeenCalled();
    expect(notificationOutbox.enqueue).not.toHaveBeenCalled();
  });
});
