import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { AUDIT_LOG_PORT, AuditModule, REDACTING_AUDIT_LOGGER } from '../AuditModule.js';
import { RedactingAuditLogger } from '../RedactingAuditLogger.js';

describe('AuditModule wiring (audit H8)', () => {
  it('provides one redacting logger for both audit writer tokens', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AuditModule],
    }).compile();

    const logger = moduleRef.get(REDACTING_AUDIT_LOGGER);
    const port = moduleRef.get(AUDIT_LOG_PORT);

    expect(logger).toBeInstanceOf(RedactingAuditLogger);
    expect(port).toBe(logger);
    await moduleRef.close();
  });
});
