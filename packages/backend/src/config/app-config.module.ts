import { Global, Module, type DynamicModule } from '@nestjs/common';
import { APP_CONFIG, type AppRole } from './AppConfig.js';
import { loadAppConfig } from './load-app-config.js';

/**
 * Exposes the validated AppConfig under APP_CONFIG. Used by AppModule (role `api`) and
 * WorkerModule (role `worker`). Validation runs when the module initialises (before the app
 * listens), so a bad env stops boot with the full problem list, not at import time.
 */
@Global()
@Module({})
export class AppConfigModule {
  static forRole(role: AppRole): DynamicModule {
    return {
      module: AppConfigModule,
      providers: [{ provide: APP_CONFIG, useFactory: () => loadAppConfig(role) }],
      exports: [APP_CONFIG],
    };
  }
}
