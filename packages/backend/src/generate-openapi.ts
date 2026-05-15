import 'reflect-metadata';
// Provide minimal stubs for env vars required during module construction.
// These are only used at spec-generation time — no real crypto or DB queries run.
process.env['KEK_BASE64'] ??= 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; // 32 null bytes
process.env['DATABASE_URL'] ??=
  'postgresql://power_budget:power_budget@localhost:5432/power_budget';
process.env['REDIS_URL'] ??= 'redis://localhost:6379';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module.js';

async function generate() {
  const app: INestApplication = await NestFactory.create(AppModule, new FastifyAdapter(), {
    logger: ['error', 'warn'],
  });

  const config = new DocumentBuilder()
    .setTitle('Power Budget API')
    .setVersion('1.0')
    .setOpenAPIVersion('3.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outPath = resolve('openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n');
  console.log(`OpenAPI spec written to ${outPath}`);

  await app.close();
  process.exit(0);
}

generate().catch((err) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
