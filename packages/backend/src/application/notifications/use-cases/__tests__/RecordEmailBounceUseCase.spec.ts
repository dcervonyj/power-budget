import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { NotificationRepository } from '../../../../domain/notifications/ports.js';
import { RecordEmailBounceUseCase } from '../RecordEmailBounceUseCase.js';

describe('RecordEmailBounceUseCase', () => {
  let repo: ReturnType<typeof createMock<NotificationRepository>>;
  let useCase: RecordEmailBounceUseCase;

  beforeEach(() => {
    repo = createMock<NotificationRepository>();
    useCase = new RecordEmailBounceUseCase(repo);
  });

  it('suppresses the recipient of a bounced email', async () => {
    const result = await useCase.execute({
      type: 'email.bounced',
      recipients: ['victim@example.com'],
    });

    expect(result).toEqual({ suppressed: true });
    expect(repo.setEmailBouncing).toHaveBeenCalledTimes(1);
    expect(repo.setEmailBouncing).toHaveBeenCalledWith('victim@example.com');
  });

  it('suppresses every recipient of a bounced email', async () => {
    const result = await useCase.execute({
      type: 'email.bounced',
      recipients: ['a@example.com', 'b@example.com'],
    });

    expect(result).toEqual({ suppressed: true });
    expect(repo.setEmailBouncing).toHaveBeenNthCalledWith(1, 'a@example.com');
    expect(repo.setEmailBouncing).toHaveBeenNthCalledWith(2, 'b@example.com');
  });

  it('accepts a single address that is not wrapped in a list', async () => {
    const result = await useCase.execute({ type: 'email.bounced', recipients: 'a@example.com' });

    expect(result).toEqual({ suppressed: true });
    expect(repo.setEmailBouncing).toHaveBeenCalledWith('a@example.com');
  });

  it('ignores other event types', async () => {
    const result = await useCase.execute({
      type: 'email.delivered',
      recipients: ['a@example.com'],
    });

    expect(result).toEqual({ suppressed: false });
    expect(repo.setEmailBouncing).not.toHaveBeenCalled();
  });

  it('ignores a bounce without a usable address', async () => {
    const missing = await useCase.execute({ type: 'email.bounced', recipients: undefined });
    const empty = await useCase.execute({ type: 'email.bounced', recipients: [] });
    const blank = await useCase.execute({ type: 'email.bounced', recipients: [''] });
    const notString = await useCase.execute({ type: 'email.bounced', recipients: [42] });

    expect([missing, empty, blank, notString]).toEqual([
      { suppressed: false },
      { suppressed: false },
      { suppressed: false },
      { suppressed: false },
    ]);
    expect(repo.setEmailBouncing).not.toHaveBeenCalled();
  });

  it('skips unusable entries next to a usable address', async () => {
    const result = await useCase.execute({
      type: 'email.bounced',
      recipients: [null, '', 'a@example.com'],
    });

    expect(result).toEqual({ suppressed: true });
    expect(repo.setEmailBouncing).toHaveBeenCalledTimes(1);
    expect(repo.setEmailBouncing).toHaveBeenCalledWith('a@example.com');
  });
});
