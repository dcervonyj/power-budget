import { ApiProperty } from '@nestjs/swagger';

export class WebhookAcceptedDto {
  @ApiProperty({ type: Boolean, enum: [true], example: true })
  ok!: true;
}
