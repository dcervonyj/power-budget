import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { NotificationRepository } from '../../../../domain/notifications/ports.js';
import { RecordEmailBounceUseCase } from '../RecordEmailBounceUseCase.js';

describe('RecordEmailBounceUseCase', () => {
  let repo: ReturnType<typeof mock<NotificationRepository>>;
  let useCase: RecordEmailBounceUseCase;

  beforeEach(() => {
    repo = mock<NotificationRepository>();
    useCase = new RecordEmailBounceUseCase(repo);
  });

  it('suppresses the address of a bounced email', async () => {
    const result = await useCase.execute({ type: 'email.bounced', email: 'victim@example.com' });

    expect(result).toEqual({ suppressed: true });
    expect(repo.setEmailBouncing).toHaveBeenCalledWith('victim@example.com');
  });

  it('ignores other event types', async () => {
    const result = await useCase.execute({ type: 'email.delivered', email: 'a@example.com' });

    expect(result).toEqual({ suppressed: false });
    expect(repo.setEmailBouncing).not.toHaveBeenCalled();
  });

  it('ignores a bounce without a usable email', async () => {
    const missing = await useCase.execute({ type: 'email.bounced', email: undefined });
    const empty = await useCase.execute({ type: 'email.bounced', email: '' });
    const notString = await useCase.execute({ type: 'email.bounced', email: 42 });

    expect([missing, empty, notString]).toEqual([
      { suppressed: false },
      { suppressed: false },
      { suppressed: false },
    ]);
    expect(repo.setEmailBouncing).not.toHaveBeenCalled();
  });
});
