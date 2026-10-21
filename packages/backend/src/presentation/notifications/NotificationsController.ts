import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Inject,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { NotificationRepository } from '../../domain/notifications/ports.js';
import { DrizzleNotificationRepository } from '../../infrastructure/notifications/DrizzleNotificationRepository.js';
import { SvixWebhookVerifier } from '../../infrastructure/notifications/SvixWebhookVerifier.js';

/**
 * Signed third-party payload: authenticity comes from the Svix signature, and
 * the provider may add fields at any time, so it is a plain type (the global
 * whitelist/forbidNonWhitelisted ValidationPipe skips non-class bodies) and
 * its fields are checked after the signature.
 */
export interface BounceWebhookBody {
  readonly email?: unknown;
  readonly type?: unknown;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(DrizzleNotificationRepository)
    private readonly notificationRepo: NotificationRepository,
    @Inject(SvixWebhookVerifier)
    private readonly webhookVerifier: SvixWebhookVerifier,
  ) {}

  /**
   * Resend bounce webhook — POST /notifications/bounce
   * Called by Resend when an email hard-bounces. Flips emailBouncing flag
   * on the recipient so future dispatch is suppressed. Requests without a
   * valid Svix signature (RESEND_WEBHOOK_SECRET) are rejected (audit H2).
   */
  @Post('bounce')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle email bounce webhook from Resend' })
  @ApiResponse({ status: 200, description: 'Webhook accepted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid webhook signature' })
  async handleBounce(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers('svix-id') svixId: string | undefined,
    @Headers('svix-timestamp') svixTimestamp: string | undefined,
    @Headers('svix-signature') svixSignature: string | undefined,
    @Body() body: BounceWebhookBody,
  ): Promise<{ ok: true }> {
    const signed = this.webhookVerifier.verify(req.rawBody, {
      id: svixId,
      timestamp: svixTimestamp,
      signature: svixSignature,
    });
    if (!signed) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (body.type === 'email.bounced' && typeof body.email === 'string') {
      await this.notificationRepo.setEmailBouncing(body.email);
    }

    return { ok: true };
  }
}
