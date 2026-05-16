import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResendEmailChannel } from '../ResendEmailChannel.js';

vi.mock('resend', () => {
  const mockSend = vi.fn();
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
    __mockSend: mockSend,
  };
});

describe('ResendEmailChannel', () => {
  let channel: ResendEmailChannel;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const resendModule = await import('resend');
    mockSend = (resendModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    channel = new ResendEmailChannel('test-api-key', 'noreply@test.com');
  });

  it('calls Resend.emails.send with correct to/from/subject/html', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    await channel.send({
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        from: 'noreply@test.com',
      }),
    );
  });

  it('uses custom from address when provided', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-2' }, error: null });

    await channel.send({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      from: 'custom@test.com',
    });

    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ from: 'custom@test.com' }));
  });

  it('does not throw on successful Resend API response', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-3' }, error: null });

    await expect(
      channel.send({ to: 'user@example.com', subject: 'OK', html: '<p>OK</p>' }),
    ).resolves.toBeUndefined();
  });

  it('throws an error when Resend returns an error object', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'API rate limit exceeded' } });

    await expect(
      channel.send({ to: 'user@example.com', subject: 'Fail', html: '<p>Fail</p>' }),
    ).rejects.toThrow('API rate limit exceeded');
  });
});
