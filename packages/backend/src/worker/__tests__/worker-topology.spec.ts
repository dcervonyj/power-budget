import 'reflect-metadata';
import { describe, it, expect, afterEach } from 'vitest';
import { ModulesContainer, NestFactory } from '@nestjs/core';
import type { INestApplicationContext, Type } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppModule } from '../../app.module.js';
import { WorkerModule } from '../worker.module.js';
import {
  QUEUE_BANK_SYNC,
  QUEUE_NOTIFICATION_DISPATCH,
  QUEUE_PERIOD_CLOSE,
} from '../../infrastructure/queue/queue.constants.js';

// Metadata keys written by @Processor (@nestjs/bullmq) and @Cron (@nestjs/schedule).
// Both libraries keep them in internal constants files that are not exported.
const PROCESSOR_METADATA = 'bullmq:processor_metadata';
const SCHEDULE_CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS';

const opened: INestApplicationContext[] = [];

interface Registrations {
  readonly processorQueues: string[];
  readonly cronNames: string[];
  readonly scheduleModules: number;
}

/**
 * Boots the module graph in Nest's preview mode: the real scanner resolves every
 * import (dynamic modules and de-duplication included) but no provider is
 * instantiated, so no database or Redis is needed.
 */
async function collectRegistrations(rootModule: Type<unknown>): Promise<Registrations> {
  const app: INestApplicationContext = await NestFactory.createApplicationContext(rootModule, {
    preview: true,
    logger: false,
  });
  opened.push(app);
  const processorQueues: string[] = [];
  const cronNames: string[] = [];
  let scheduleModules = 0;

  for (const moduleRef of app.get(ModulesContainer).values()) {
    if (moduleRef.metatype === ScheduleModule) {
      scheduleModules++;
    }
    for (const wrapper of moduleRef.providers.values()) {
      const providerClass = providerClassOf(wrapper.token, wrapper.metatype, wrapper.inject);
      if (providerClass === undefined) {
        continue;
      }
      const processor: { name: string } | undefined = Reflect.getMetadata(
        PROCESSOR_METADATA,
        providerClass,
      );
      if (processor !== undefined) {
        processorQueues.push(processor.name);
      }
      cronNames.push(...cronNamesOf(providerClass));
    }
  }

  return { processorQueues, cronNames, scheduleModules };
}

type ProviderClass = abstract new (...args: never[]) => unknown;

function isProviderClass(candidate: unknown): candidate is ProviderClass {
  return typeof candidate === 'function' && 'prototype' in candidate;
}

/** Factory providers (`inject` set) are keyed by their class token; class providers by metatype. */
function providerClassOf(
  token: unknown,
  metatype: unknown,
  inject: unknown,
): ProviderClass | undefined {
  const candidate = inject ? token : metatype;

  return isProviderClass(candidate) ? candidate : undefined;
}

function cronNamesOf(providerClass: ProviderClass): string[] {
  const names: string[] = [];
  const prototype: Record<string, unknown> = providerClass.prototype;
  for (const key of Object.getOwnPropertyNames(prototype)) {
    const method = Object.getOwnPropertyDescriptor(prototype, key)?.value;
    if (typeof method !== 'function') {
      continue;
    }
    const cron: { name?: string } | undefined = Reflect.getMetadata(SCHEDULE_CRON_OPTIONS, method);
    if (cron !== undefined) {
      names.push(cron.name ?? `${providerClass.name}.${key}`);
    }
  }

  return names;
}

describe('worker topology', () => {
  afterEach(async () => {
    while (opened.length > 0) {
      await opened.pop()?.close();
    }
  });

  it('API module graph registers no BullMQ processor, no cron and no ScheduleModule', async () => {
    const api = await collectRegistrations(AppModule);

    expect(api).toEqual({ processorQueues: [], cronNames: [], scheduleModules: 0 });
  });

  it('worker module registers each processor and each cron exactly once', async () => {
    const worker = await collectRegistrations(WorkerModule);

    expect([...worker.processorQueues].sort()).toEqual(
      [QUEUE_BANK_SYNC, QUEUE_NOTIFICATION_DISPATCH, QUEUE_PERIOD_CLOSE].sort(),
    );
    expect([...worker.cronNames].sort()).toEqual(
      [
        'bank-sync-schedule',
        'fx-daily-ingest',
        'outbox-relay',
        'period-close',
        'reconnect-reminders',
        'weekly-digest',
      ].sort(),
    );
    expect(worker.scheduleModules).toBe(1);
  });
});
