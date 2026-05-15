import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigPort } from '../../domain/auth/ports.js';

@Injectable()
export class AppConfigAdapter implements AppConfigPort {
  constructor(private readonly config: ConfigService) {}

  get(key: 'APP_BASE_URL'): string {
    return this.config.get<string>(key) ?? 'http://localhost:3000';
  }
}
