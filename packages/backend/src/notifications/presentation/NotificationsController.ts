import { Controller, Post, Body, HttpCode, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import type { NotificationRepository } from '../domain/ports.js';
import { DrizzleNotificationRepository } from '../infrastructure/DrizzleNotificationRepository.js';

export class BounceWebhookDto {
  @IsEmail()
  email!: string;

  @IsString()
  type!: string;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(DrizzleNotificationRepository)
    private readonly notificationRepo: NotificationRepository,
  ) {}

  /**
   * Resend bounce webhook — POST /notifications/bounce
   * Called by Resend when an email hard-bounces. Flips emailBouncing flag
   * on the recipient so future dispatch is suppressed.
   */
  @Post('bounce')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle email bounce webhook from Resend' })
  async handleBounce(@Body() body: BounceWebhookDto): Promise<{ ok: true }> {
    if (body.type === 'email.bounced') {
      await this.notificationRepo.setEmailBouncing(body.email);
    }
    return { ok: true };
  }
}
