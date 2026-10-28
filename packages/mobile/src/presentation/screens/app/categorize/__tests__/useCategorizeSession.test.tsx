import { act, renderHook } from '@testing-library/react-native';
import { useCategorizeSession } from '../useCategorizeSession.js';
import type { CategorizeSessionInput } from '../useCategorizeSession.js';
import { BOLT, CHOICES, ORLEN, QUEUE, ZABKA } from '../categorizeFixtures.js';

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
    expect(onConfirmed).toHaveBeenCalledWith('orlen');

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

  it('starts the preview of the next payment from what the confirmed ones took', async () => {
    const { result, calls } = await setup({ queue: [ORLEN, ZABKA], startIndex: 0 });
    const before = result.current.options.find((o) => o.plannedItemId === 'item-transport');
    expect(before?.spentMinor).toBe(31239n);

    await act(() => result.current.confirm());
    await settle(calls[0], 'resolve');
    await act(() => result.current.next());
    await act(() => result.current.pick('item-transport'));

    const after = result.current.options.find((o) => o.plannedItemId === 'item-transport');
    expect(after?.spentMinor).toBe(31239n + 12930n);
  });

  it('does not add a confirmed payment again once the loaded balances include it', async () => {
    const { result, calls, rerender } = await setup({ queue: [ORLEN, ZABKA], startIndex: 0 });
    await act(() => result.current.confirm());
    await settle(calls[0], 'resolve');
    await act(() => result.current.next());
    await act(() => result.current.pick('item-transport'));
    const added = result.current.options.find((o) => o.plannedItemId === 'item-transport');
    expect(added?.spentMinor).toBe(31239n + 12930n);

    // A retry reloaded balances that already count the confirmed payment.
    const reloaded = CHOICES.map((c) =>
      c.plannedItemId === 'item-transport' ? { ...c, spentMinor: c.spentMinor + 12930n } : c,
    );
    await rerender({ choices: reloaded, choicesCover: new Set([ORLEN.data.id]) });

    const after = result.current.options.find((o) => o.plannedItemId === 'item-transport');
    expect(after?.spentMinor).toBe(31239n + 12930n);
  });

  it('settles a write that finishes after the sheet unmounted without throwing', async () => {
    const { calls, unmount, result, onConfirmed, input } = await setup();
    await act(() => result.current.confirm());
    await unmount();

    await settle(calls[0], 'resolve');

    expect(onConfirmed).toHaveBeenCalledWith('orlen');
    expect(input.busyIds.size).toBe(0);
  });
});
