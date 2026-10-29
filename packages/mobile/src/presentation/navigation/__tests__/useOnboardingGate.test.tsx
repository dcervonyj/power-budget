import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useOnboardingGate } from '../useOnboardingGate.js';

function sourceAnswering(answer: Promise<boolean>): {
  isCompleted: jest.Mock<Promise<boolean>, []>;
} {
  return { isCompleted: jest.fn<Promise<boolean>, []>().mockReturnValue(answer) };
}

describe('useOnboardingGate', () => {
  it('needs onboarding for a user who has not completed it', async () => {
    const source = sourceAnswering(Promise.resolve(false));
    const { result } = await renderHook(() => useOnboardingGate(true, source));

    await waitFor(() => {
      expect(result.current.status).toBe('needed');
    });
  });

  it('lets a user who completed onboarding through', async () => {
    const source = sourceAnswering(Promise.resolve(true));
    const { result } = await renderHook(() => useOnboardingGate(true, source));

    await waitFor(() => {
      expect(result.current.status).toBe('completed');
    });
  });

  it('does not read the profile while signed out', async () => {
    const source = sourceAnswering(Promise.resolve(false));
    const { result } = await renderHook(() => useOnboardingGate(false, source));

    expect(result.current.status).toBe('checking');
    expect(source.isCompleted).not.toHaveBeenCalled();
  });

  it('keeps the gate closed when the profile cannot be read', async () => {
    const source = sourceAnswering(Promise.reject(new Error('offline')));
    const { result } = await renderHook(() => useOnboardingGate(true, source));

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
    });
  });

  it('reads the profile again on retry', async () => {
    const source = {
      isCompleted: jest
        .fn<Promise<boolean>, []>()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(false),
    };
    const { result } = await renderHook(() => useOnboardingGate(true, source));
    await waitFor(() => {
      expect(result.current.status).toBe('failed');
    });

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('needed');
    });
    expect(source.isCompleted).toHaveBeenCalledTimes(2);
  });

  it('opens the gate once onboarding is completed', async () => {
    const source = sourceAnswering(Promise.resolve(false));
    const { result } = await renderHook(() => useOnboardingGate(true, source));
    await waitFor(() => {
      expect(result.current.status).toBe('needed');
    });

    await act(async () => {
      result.current.markCompleted();
    });

    expect(result.current.status).toBe('completed');
  });
});
