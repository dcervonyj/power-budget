import { act, renderHook } from '@testing-library/react-native';
import { useCategorizeSession } from '../useCategorizeSession.js';
import type { CategorizeSessionInput } from '../useCategorizeSession.js';
import { BOLT, CHOICES, ORLEN, QUEUE, ZABKA, paymentOf } from '../categorizeFixtures.js';

interface Deferred {
  readonly resolve: () => void;
  readonly reject: () => void;
}

/** A write that stays pending until the test settles it. */
async function setup(overrides: Partial<CategorizeSessionInput> = {}) {
  const calls: { id: string; plannedItemId: string | null; settle: Deferred }[] = [];
  const write = jest.fn((id: string, plannedItemId: string | null): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      calls.push({
        id,
        plannedItemId,
        settle: { resolve: () => resolve(), reject: () => reject(new Error('write failed')) },
      });
    });
  });
  const onConfirmed = jest.fn();
  const onUndone = jest.fn();
  const input: CategorizeSessionInput = {
    queue: QUEUE,
    startIndex: 0,
    choices: CHOICES,
    ledger: new Map(),
    write,
    busyIds: new Set<string>(),
    onConfirmed,
    onUndone,
    ...overrides,
  };
  const hook = await renderHook(
    (extra: Partial<CategorizeSessionInput>) => useCategorizeSession({ ...input, ...extra }),
    { initialProps: {} },
  );

  return { ...hook, calls, write, onConfirmed, onUndone, input };
}

async function settle(call: { settle: Deferred } | undefined, how: 'resolve' | 'reject') {
  await act(async () => {
    call?.settle[how]();
    await Promise.resolve();
  });
}

describe('useCategorizeSession', () => {
  it('preselects the suggestion, lists it first and starts on the chosen payment', async () => {
    const { result } = await setup({ startIndex: 2 });

    expect(result.current.row).toBe(ZABKA);
    expect(result.current.position).toBe(3);
    expect(result.current.picked?.plannedItemId).toBe('item-groceries');
    expect(result.current.options[0]?.plannedItemId).toBe('item-groceries');
  });

  it('flows pick, confirm and undo, writing each change once', async () => {
    const { result, calls, write, onConfirmed, onUndone } = await setup();

    await act(() => result.current.pick('item-health'));
    expect(result.current.picked?.name).toBe('Health');
    await act(() => result.current.confirm());
    expect(result.current.phase).toBe('saving');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith('orlen', 'item-health');

    await settle(calls[0], 'resolve');
    expect(result.current.phase).toBe('done');
    expect(onConfirmed).toHaveBeenCalledWith(paymentOf(ORLEN), 'item-health');

    await act(() => result.current.undo());
    expect(result.current.phase).toBe('undoing');
    expect(write).toHaveBeenLastCalledWith('orlen', null);

    await settle(calls[1], 'resolve');
    expect(result.current.phase).toBe('choosing');
    expect(onUndone).toHaveBeenCalledWith('orlen');
    expect(result.current.picked?.plannedItemId).toBe('item-health');
  });

  it('ignores a second Confirm while the first is in flight', async () => {
    const { result, calls, write, onConfirmed } = await setup();

    await act(() => {
      result.current.confirm();
      result.current.confirm();
    });
    await act(() => result.current.confirm());
    await settle(calls[0], 'resolve');
    await act(() => result.current.confirm());

    expect(write).toHaveBeenCalledTimes(1);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('does not confirm a payment whose write is still on its way from an earlier sheet', async () => {
    const busyIds = new Set<string>(['orlen']);
    const { result, write } = await setup({ busyIds });

    await act(() => result.current.confirm());

    expect(write).not.toHaveBeenCalled();
  });

  it('goes back to choosing with an error when Confirm fails, and a retry writes again', async () => {
    const { result, calls, write, onConfirmed, input } = await setup();

    await act(() => result.current.confirm());
    await settle(calls[0], 'reject');

    expect(result.current.phase).toBe('choosing');
    expect(result.current.failure).toBe('confirm');
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(input.busyIds.size).toBe(0);

    await act(() => result.current.confirm());
    expect(write).toHaveBeenCalledTimes(2);
    expect(result.current.failure).toBeNull();
  });

  it('keeps the payment confirmed with an error when Undo fails', async () => {
    const { result, calls, onUndone } = await setup();
    await act(() => result.current.confirm());
    await settle(calls[0], 'resolve');

    await act(() => result.current.undo());
    await settle(calls[1], 'reject');

    expect(result.current.phase).toBe('done');
    expect(result.current.failure).toBe('undo');
    expect(onUndone).not.toHaveBeenCalled();
  });

  it('accepts no Undo or Next while the Confirm is still saving', async () => {
    const { result, write } = await setup();
    await act(() => result.current.confirm());

    await act(() => {
      result.current.undo();
      result.current.next();
    });

    expect(write).toHaveBeenCalledTimes(1);
    expect(result.current.position).toBe(1);
  });

  it('accepts no second Undo or Next while the Undo is in flight', async () => {
    const { result, calls, write } = await setup();
    await act(() => result.current.confirm());
    await settle(calls[0], 'resolve');
    await act(() => result.current.undo());

    await act(() => {
      result.current.undo();
      result.current.next();
    });

    expect(write).toHaveBeenCalledTimes(2);
    expect(result.current.position).toBe(1);
  });

  it('moves on one payment per Next even when it is tapped twice', async () => {
    const { result, calls } = await setup();
    await act(() => result.current.confirm());
    await settle(calls[0], 'resolve');

    await act(() => {
      result.current.next();
      result.current.next();
    });

    expect(result.current.row).toBe(BOLT);
    expect(result.current.position).toBe(2);
  });

  it('names the next payment and ends in All sorted with the count', async () => {
    const { result, calls } = await setup({ queue: [ORLEN, BOLT], startIndex: 0 });
    expect(result.current.nextTitle).toBe('Bolt');

    await act(() => result.current.confirm());
    await settle(calls[0], 'resolve');
    await act(() => result.current.next());
    expect(result.current.nextTitle).toBeUndefined();
    await act(() => result.current.confirm());
    await settle(calls[1], 'resolve');
    await act(() => result.current.next());

    expect(result.current.allDone).toBe(true);
    expect(result.current.sortedCount).toBe(2);
    expect(result.current.row).toBeUndefined();
  });

  describe('previews from the balances plus the ledger, owning no adjustments itself', () => {
    const orlenEntry = (covered: boolean, undone = false) => ({
      payment: paymentOf(ORLEN),
      plannedItemId: 'item-transport',
      covered,
      undone,
    });
    const transportOf = (options: readonly { plannedItemId: string; spentMinor: bigint }[]) =>
      options.find((o) => o.plannedItemId === 'item-transport')?.spentMinor;

    it.each([
      ['an empty ledger', undefined, 31239n],
      ['an uncovered earlier payment', orlenEntry(false), 31239n + 12930n],
      ['an earlier payment the balances already count', orlenEntry(true), 31239n],
      [
        'an earlier payment that was undone but is still counted',
        orlenEntry(true, true),
        31239n - 12930n,
      ],
    ])('next payment with %s', async (_name, entry, spent) => {
      const ledger = entry === undefined ? new Map() : new Map([['orlen', entry]]);
      const { result } = await setup({ queue: [ZABKA], startIndex: 0, ledger });

      expect(transportOf(result.current.options)).toBe(spent);
    });

    it.each([
      ['not in the ledger yet', undefined, 31239n],
      ['uncovered', orlenEntry(false), 31239n],
      ['covered by a refresh, taken out of the balances once', orlenEntry(true), 31239n - 12930n],
    ])('the payment itself, %s', async (_name, entry, spent) => {
      const ledger = entry === undefined ? new Map() : new Map([['orlen', entry]]);
      const { result } = await setup({ queue: [ORLEN], startIndex: 0, ledger });

      expect(transportOf(result.current.options)).toBe(spent);
    });
  });

  it('settles a write that finishes after the sheet unmounted without throwing', async () => {
    const { calls, unmount, result, onConfirmed, input } = await setup();
    await act(() => result.current.confirm());
    await unmount();

    await settle(calls[0], 'resolve');

    expect(onConfirmed).toHaveBeenCalledWith(paymentOf(ORLEN), 'item-transport');
    expect(input.busyIds.size).toBe(0);
  });
});
