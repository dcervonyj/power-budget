import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { APP_CONFIG, parseAppConfig } from '../../../config/AppConfig.js';
import { AppConfigModule } from '../../../config/app-config.module.js';
import { describe, expect, it } from 'vitest';
import { AUDIT_LOG_PORT, AuditModule, REDACTING_AUDIT_LOGGER } from '../AuditModule.js';
import { RedactingAuditLogger } from '../RedactingAuditLogger.js';

describe('AuditModule wiring (audit H8)', () => {
  it('provides one redacting logger for both audit writer tokens', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule.forRole('api'), AuditModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(
        parseAppConfig(
          {
            NODE_ENV: 'test',
            KEK_BASE64: Buffer.alloc(32).toString('base64'),
          },
          'api',
        ),
      )
      .compile();

    const logger = moduleRef.get(REDACTING_AUDIT_LOGGER);
    const port = moduleRef.get(AUDIT_LOG_PORT);

    expect(logger).toBeInstanceOf(RedactingAuditLogger);
    expect(port).toBe(logger);
    await moduleRef.close();
  });
});
