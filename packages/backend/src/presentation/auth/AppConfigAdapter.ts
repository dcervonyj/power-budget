import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/AppConfig.js';
import type { AppConfigPort } from '../../domain/auth/ports.js';

@Injectable()
export class AppConfigAdapter implements AppConfigPort {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get(key: 'APP_BASE_URL'): string {
    const values = { APP_BASE_URL: this.config.appBaseUrl };

    return values[key];
  }
}
