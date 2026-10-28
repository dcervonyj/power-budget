import { Global, Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_CONFIG, parseAppConfig, type AppRole } from './AppConfig.js';

/**
 * Loads `.env` (repo root, then the package dir), validates it once and exposes the typed
 * AppConfig under APP_CONFIG. Validation runs when the module initialises (before the app
 * listens), so a bad env stops boot with the full problem list, not at import time. Used by AppModule (role `api`) and WorkerModule (role `worker`).
 * ConfigService keeps working for existing consumers and sees the same raw env.
 */
@Global()
@Module({})
export class AppConfigModule {
  static forRole(role: AppRole): DynamicModule {
    return {
      module: AppConfigModule,
      imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] })],
      providers: [
        {
          provide: APP_CONFIG,
          useFactory: () => parseAppConfig(process.env, role),
        },
      ],
      exports: [APP_CONFIG],
    };
  }
}
