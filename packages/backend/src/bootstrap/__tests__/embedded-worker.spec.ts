import { describe, it, expect, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { INestApplicationContext } from '@nestjs/common';
import { startEmbeddedWorker } from '../embedded-worker.js';

describe('startEmbeddedWorker', () => {
  it('does not load or boot the worker when START_WORKER=false', async () => {
    const boot = vi.fn();
    const log = vi.fn();

    const started = await startEmbeddedWorker({ startWorker: false }, { boot, log });

    expect(started).toBe(false);
    expect(boot).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('boots the worker once and enables shutdown hooks when START_WORKER=true', async () => {
    const context = mock<INestApplicationContext>();
    const boot = vi.fn().mockResolvedValue(context);
    const log = vi.fn();

    const started = await startEmbeddedWorker({ startWorker: true }, { boot, log });

    expect(started).toBe(true);
    expect(boot).toHaveBeenCalledTimes(1);
    expect(context.enableShutdownHooks).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Embedded worker started (single-process free-tier topology)');
  });
});
