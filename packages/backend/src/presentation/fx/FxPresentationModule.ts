import { Module } from '@nestjs/common';
import { FxModule } from '../../infrastructure/fx/FxModule.js';
import { DrizzleFxRateRepository } from '../../infrastructure/fx/DrizzleFxRateRepository.js';
import { GetFxRatesUseCase } from '../../application/fx/use-cases/GetFxRatesUseCase.js';
import { FxController } from './FxController.js';

@Module({
  imports: [FxModule],
  controllers: [FxController],
  providers: [
    {
      provide: GetFxRatesUseCase,
      inject: [DrizzleFxRateRepository],
      useFactory: (repo: DrizzleFxRateRepository) => new GetFxRatesUseCase(repo),
    },
  ],
})
export class FxPresentationModule {}
