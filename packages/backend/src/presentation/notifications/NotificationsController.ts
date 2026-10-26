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
import { RecordEmailBounceUseCase } from '../../application/notifications/use-cases/RecordEmailBounceUseCase.js';
import { SvixWebhookVerifier } from '../../infrastructure/notifications/SvixWebhookVerifier.js';
import { WebhookAcceptedDto } from './dto/webhook-response.dto.js';

/**
 * Signed third-party payload: authenticity comes from the Svix signature, and
 * the provider may add fields at any time, so it is a plain type (the global
 * whitelist/forbidNonWhitelisted ValidationPipe skips non-class bodies) and
 * its fields are checked after the signature. Resend puts the recipients of
 * the bounced email in `data.to`.
 */
export interface BounceWebhookBody {
  readonly type?: unknown;
  readonly data?: { readonly to?: unknown } | null;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(RecordEmailBounceUseCase)
    private readonly recordEmailBounce: RecordEmailBounceUseCase,
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
  @ApiResponse({ status: 200, description: 'Webhook accepted', type: WebhookAcceptedDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid webhook signature' })
  async handleBounce(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers('svix-id') svixId: string | undefined,
    @Headers('svix-timestamp') svixTimestamp: string | undefined,
    @Headers('svix-signature') svixSignature: string | undefined,
    @Body() body: BounceWebhookBody | null | undefined,
  ): Promise<WebhookAcceptedDto> {
    const signed = this.webhookVerifier.verify(req.rawBody, {
      id: svixId,
      timestamp: svixTimestamp,
      signature: svixSignature,
    });
    if (!signed) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    // A signed JSON `null` carries no address; accept it without recording anything.
    if (body === null || body === undefined) {
      return { ok: true };
    }

    await this.recordEmailBounce.execute({ type: body.type, recipients: body.data?.to });

    return { ok: true };
  }
}
