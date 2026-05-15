import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = (await NestFactory.create(
    AppModule,
    new FastifyAdapter(),
  )) as unknown as NestFastifyApplication;

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'same-origin' },
  });

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on port ${port}`);
}

void bootstrap();
